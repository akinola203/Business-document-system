import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { DocumentStatus, DocumentType } from '@prisma/client';

test('InvoicesService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
  let invoicesDb: any[] = [];
  let invoiceItemsDb: any[] = [];
  let approvalsDb: any[] = [];
  let versionsDb: any[] = [];
  let auditLogs: any[] = [];
  let companyDb: any = { id: 'comp-1', settings: { allowSelfApproval: false } };

  const mockPrisma: any = {
    client: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'client-1') return { id: 'client-1', name: 'Dangote Hub', companyId: where.companyId };
        return null;
      },
    },
    company: {
      findUnique: async () => companyDb,
    },
    document: {
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find((d) => d.id === where.id && d.companyId === where.companyId);
        if (!doc) return null;
        const inv = invoicesDb.find((i) => i.documentId === doc.id);
        const items = inv ? invoiceItemsDb.filter((it) => it.invoiceId === inv.id) : [];
        return {
          ...doc,
          company: companyDb,
          invoice: inv ? { ...inv, items, payments: [] } : null,
          approvals: approvalsDb.filter((a) => a.documentId === doc.id),
          versions: versionsDb.filter((v) => v.documentId === doc.id),
        };
      },
      create: async ({ data }: any) => {
        const item = { id: `doc-${documentsDb.length + 1}`, ...data };
        documentsDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = documentsDb.findIndex((d) => d.id === where.id);
        documentsDb[idx] = { ...documentsDb[idx], ...data };
        return documentsDb[idx];
      },
    },
    invoice: {
      create: async ({ data }: any) => {
        const id = `inv-${invoicesDb.length + 1}`;
        const item = { id, ...data };
        invoicesDb.push(item);
        if (data.items?.create) {
          data.items.create.forEach((it: any) => {
            invoiceItemsDb.push({ id: `item-${invoiceItemsDb.length + 1}`, invoiceId: id, ...it });
          });
        }
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = invoicesDb.findIndex((i) => i.id === where.id);
        invoicesDb[idx] = { ...invoicesDb[idx], ...data };
        return invoicesDb[idx];
      },
    },
    invoiceItem: {
      deleteMany: async ({ where }: any) => {
        invoiceItemsDb = invoiceItemsDb.filter((it) => it.invoiceId !== where.invoiceId);
        return { count: 1 };
      },
      createMany: async ({ data }: any) => {
        data.forEach((it: any) => {
          invoiceItemsDb.push({ id: `item-${invoiceItemsDb.length + 1}`, ...it });
        });
        return { count: data.length };
      },
    },
    documentApproval: {
      create: async ({ data }: any) => {
        const item = { id: `appr-${approvalsDb.length + 1}`, ...data };
        approvalsDb.push(item);
        return item;
      },
      updateMany: async ({ where, data }: any) => {
        approvalsDb.forEach((a) => {
          if (a.documentId === where.documentId && a.status === where.status) {
            Object.assign(a, data);
          }
        });
        return { count: 1 };
      },
    },
    documentVersion: {
      findFirst: async ({ where }: any) => {
        const list = versionsDb
          .filter((v) => v.documentId === where.documentId)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return list[0] ?? null;
      },
      create: async ({ data }: any) => {
        const item = { id: `ver-${versionsDb.length + 1}`, ...data };
        versionsDb.push(item);
        return item;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: 'audit-1', ...data };
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const mockNumberingService: any = {
    getNextDocumentNumber: async () => 'INV-2026-000001',
  };

  const service = new InvoicesService(mockPrisma, mockNumberingService);

  await t.test('createDraft creates invoice with authoritative math and INV number', async () => {
    documentsDb = [];
    invoicesDb = [];
    invoiceItemsDb = [];
    auditLogs = [];

    const invoice = await service.createDraft(
      'comp-1',
      {
        title: 'Cement Supply Batch #1',
        clientId: 'client-1',
        items: [
          { description: 'Portland Cement (50kg)', quantity: 100, unit: 'Bags', unitPrice: 8500, discountPercent: 0, taxRate: 7.5 },
        ],
      },
      'usr-staff-1',
    );

    assert.equal(invoice.documentNumber, 'INV-2026-000001');
    assert.equal(invoice.status, DocumentStatus.DRAFT);
    // 100 * 8500 = 850,000 + 7.5% VAT (63,750) = 913,750
    assert.equal(invoice.totalAmount.toString(), '913750');
    assert.equal(invoice.balanceDue.toString(), '913750');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'INVOICE_CREATED');
  });

  await t.test('issue rejects a DRAFT invoice (approval cannot be bypassed)', async () => {
    const docId = documentsDb[0].id;
    await assert.rejects(
      async () => service.issue('comp-1', docId, 'usr-manager-2'),
      BadRequestException,
    );
    assert.equal(versionsDb.length, 0);
  });

  await t.test('submitForApproval transitions status to PENDING_APPROVAL', async () => {
    const docId = documentsDb[0].id;
    const submitted = await service.submitForApproval('comp-1', docId, 'usr-staff-1');
    assert.equal(submitted.status, DocumentStatus.PENDING_APPROVAL);
  });

  await t.test('approve enforces corporate rule prohibiting self-approval', async () => {
    const docId = documentsDb[0].id;
    // Approver is usr-staff-1 (same as creator) and allowSelfApproval is false
    await assert.rejects(
      async () => {
        await service.approve('comp-1', docId, 'usr-staff-1', 'Self-approval attempt');
      },
      ForbiddenException,
    );
  });

  await t.test('approve succeeds when an authorized manager approves', async () => {
    const docId = documentsDb[0].id;
    const approved = await service.approve('comp-1', docId, 'usr-manager-2', 'Approved for billing');
    assert.equal(approved.status, DocumentStatus.APPROVED);
  });

  await t.test('issue freezes official DocumentVersion and locks record', async () => {
    const docId = documentsDb[0].id;
    const issued = await service.issue('comp-1', docId, 'usr-manager-2');
    assert.equal(issued.status, DocumentStatus.ISSUED);
    assert.equal(versionsDb.length, 1);
    assert.equal(versionsDb[0].versionNumber, 1);

    // Attempting to update an issued invoice must fail
    await assert.rejects(
      async () => {
        await service.updateDraft('comp-1', docId, { title: 'Illegal Edit' }, 'usr-staff-1');
      },
      BadRequestException,
    );
  });
});
