import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from '../../src/modules/invoices/dto/create-invoice.dto';
import { InvoiceItemDto } from '../../src/modules/invoices/dto/invoice-item.dto';

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
        if (where.id === 'client-1' && where.companyId === 'comp-1') return { id: 'client-1', name: 'Dangote Hub', companyId: where.companyId };
        return null;
      },
    },
    clientAddress: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'addr-1' && where.clientId === 'client-1') {
          return { id: 'addr-1', clientId: 'client-1', addressLine1: '45 Commercial Road', city: 'Ikeja', state: 'Lagos' };
        }
        return null;
      },
    },
    branch: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1') return { id: where.id, companyId: 'comp-1' };
        return null;
      },
    },
    department: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1') return { id: where.id, companyId: 'comp-1' };
        return null;
      },
    },
    template: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1') return { id: where.id, companyId: 'comp-1' };
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
        const item = { id: `doc-${documentsDb.length + 1}`, versionCounter: 1, ...data };
        documentsDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = documentsDb.findIndex((d) => d.id === where.id);
        documentsDb[idx] = { ...documentsDb[idx], ...data };
        return documentsDb[idx];
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        documentsDb.forEach((d) => {
          if (d.id === where.id && d.companyId === where.companyId) {
            if (where.status?.in && !where.status.in.includes(d.status)) return;
            if (where.versionCounter !== undefined && d.versionCounter !== where.versionCounter) return;
            if (data.versionCounter?.increment) {
              d.versionCounter = (d.versionCounter || 0) + data.versionCounter.increment;
            }
            if (data.status) d.status = data.status;
            count++;
          }
        });
        return { count };
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

  await t.test('updateDraft updates title, line items, and recalculates authoritative totals', async () => {
    const docId = documentsDb[0].id;
    const updated = await service.updateDraft(
      'comp-1',
      docId,
      {
        title: 'Updated Cement Supply Batch #1',
        items: [
          { description: 'Portland Cement (50kg)', quantity: 200, unit: 'Bags', unitPrice: 8500, discountPercent: 0, taxRate: 7.5 },
        ],
      },
      'usr-staff-1',
    );

    assert.equal(updated.title, 'Updated Cement Supply Batch #1');
    // 200 * 8500 = 1,700,000 + 7.5% VAT (127,500) = 1,827,500
    assert.equal(updated.totalAmount.toString(), '1827500');
    assert.equal(updated.balanceDue.toString(), '1827500');
  });

  await t.test('updateDraft rejects update with OCC ConflictException if version does not match', async () => {
    const docId = documentsDb[0].id;
    await assert.rejects(
      async () => {
        await service.updateDraft(
          'comp-1',
          docId,
          {
            title: 'Concurrent Edit',
            expectedVersion: 999, // Stale version
          },
          'usr-staff-1',
        );
      },
      (err: any) => err.status === 409,
    );
  });

  await t.test('updateDraft rejects update if invoice is not in DRAFT or REJECTED status', async () => {
    const docId = documentsDb[0].id;
    // Simulate invoice having been transitioned to ISSUED
    documentsDb[0].status = DocumentStatus.ISSUED;

    await assert.rejects(
      async () => {
        await service.updateDraft(
          'comp-1',
          docId,
          {
            title: 'Illegal Edit on Issued Document',
          },
          'usr-staff-1',
        );
      },
      BadRequestException,
    );

    // Reset status back to DRAFT for subsequent tests
    documentsDb[0].status = DocumentStatus.DRAFT;
  });

  await t.test('createDraft accepts valid selectedAddressId and persists it in metadata', async () => {
    const inv = await service.createDraft(
      'comp-1',
      {
        title: 'Invoice with Address Override',
        clientId: 'client-1',
        selectedAddressId: 'addr-1',
        items: [
          { description: 'Test Item', quantity: 1, unit: 'Units', unitPrice: 1000 },
        ],
      },
      'usr-staff-1',
    );

    assert.equal((inv.metadata as any)?.selectedAddressId, 'addr-1');
  });

  await t.test('createDraft rejects invalid selectedAddressId not belonging to client', async () => {
    await assert.rejects(
      async () => {
        await service.createDraft(
          'comp-1',
          {
            title: 'Invoice with Invalid Address',
            clientId: 'client-1',
            selectedAddressId: 'wrong-addr',
            items: [
              { description: 'Test Item', quantity: 1, unit: 'Units', unitPrice: 1000 },
            ],
          },
          'usr-staff-1',
        );
      },
      BadRequestException,
    );
  });

  await t.test('CreateInvoiceDto validates dueDate cannot be earlier than issueDate', async () => {
    const invalidDto = plainToInstance(CreateInvoiceDto, {
      title: 'Backdated Due Date Invoice',
      clientId: 'client-1',
      issueDate: '2026-10-25',
      dueDate: '2026-10-20',
      items: [
        { description: 'Test Item', quantity: 1, unit: 'Units', unitPrice: 1000 },
      ],
    });

    const errors = await validate(invalidDto);
    const dueDateError = errors.find((e) => e.property === 'dueDate');
    assert.ok(dueDateError, 'Should have validation error on dueDate');
    assert.ok(
      Object.values(dueDateError.constraints || {}).some((msg) =>
        msg.includes('dueDate cannot be earlier than issueDate'),
      ),
    );
  });

  await t.test('InvoiceItemDto rejects quantities and prices exceeding @Max limits', async () => {
    const invalidItem = plainToInstance(InvoiceItemDto, {
      description: 'Super Mass Consignment',
      quantity: 2000000000, // Exceeds 1,000,000,000
      unit: 'Kg',
      unitPrice: 2000000000000, // Exceeds 1,000,000,000,000
    });

    const errors = await validate(invalidItem);
    assert.ok(errors.some((e) => e.property === 'quantity'));
    assert.ok(errors.some((e) => e.property === 'unitPrice'));
  });
});
