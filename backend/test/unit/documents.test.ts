import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { DocumentStatus, DocumentType } from '@prisma/client';

test('DocumentsService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
  let versionsDb: any[] = [];
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    document: {
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let list = documentsDb.filter((d) => d.companyId === where.companyId);
        if (where.documentType) list = list.filter((d) => d.documentType === where.documentType);
        if (where.status) list = list.filter((d) => d.status === where.status);
        return list.slice(skip, skip + take);
      },
      count: async ({ where }: any) => {
        let list = documentsDb.filter((d) => d.companyId === where.companyId);
        if (where.documentType) list = list.filter((d) => d.documentType === where.documentType);
        return list.length;
      },
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find((d) => d.id === where.id && d.companyId === where.companyId);
        if (!doc) return null;
        return {
          ...doc,
          company: { id: doc.companyId, name: 'AOA 77 LTD', settings: {} },
          client: { id: 'client-1', name: 'Dangote Ltd' },
          approvals: [],
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
      update: async ({ where, data }: any) => {
        const doc = documentsDb.find((d) => d.invoice?.id === where.id);
        if (doc && doc.invoice) {
          doc.invoice = { ...doc.invoice, ...data };
        }
        return doc?.invoice;
      },
    },
    waybill: {
      update: async ({ where, data }: any) => {
        const doc = documentsDb.find((d) => d.waybill?.id === where.id);
        if (doc && doc.waybill) {
          doc.waybill = { ...doc.waybill, ...data };
        }
        return doc?.waybill;
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
    getNextDocumentNumber: async () => 'INV-2026-000099',
  };

  const mockAuditService: any = {
    logAction: async (opt: any) => {
      auditLogs.push(opt);
    },
  };

  const mockNotificationsService: any = {
    createNotification: async () => {},
  };

  const service = new DocumentsService(
    mockPrisma,
    mockNumberingService,
    mockAuditService,
    mockNotificationsService,
  );

  await t.test('findAll filters documents and returns pagination metadata', async () => {
    documentsDb = [
      { id: 'doc-1', companyId: 'comp-1', documentType: DocumentType.INVOICE, status: DocumentStatus.ISSUED },
      { id: 'doc-2', companyId: 'comp-1', documentType: DocumentType.WAYBILL, status: DocumentStatus.DRAFT },
    ];

    const results = await service.findAll('comp-1', { documentType: DocumentType.INVOICE });
    assert.equal(results.items.length, 1);
    assert.equal(results.meta.total, 1);
  });

  await t.test('cancel sets status to CANCELLED with reason', async () => {
    const cancelled = await service.cancel(
      'comp-1',
      'doc-1',
      { reason: 'Order rescinded by customer' },
      'usr-1',
    );

    assert.equal(cancelled.status, DocumentStatus.CANCELLED);
    assert.equal(cancelled.cancellationReason, 'Order rescinded by customer');
  });

  await t.test('cancel rejects already cancelled document', async () => {
    await assert.rejects(
      async () => {
        await service.cancel('comp-1', 'doc-1', { reason: 'Double cancel' }, 'usr-1');
      },
      BadRequestException,
    );
  });

  await t.test('duplicate creates new DRAFT with fresh number and resets balance', async () => {
    documentsDb.push({
      id: 'doc-source',
      companyId: 'comp-1',
      documentType: DocumentType.INVOICE,
      documentNumber: 'INV-2026-000001',
      title: 'Original Invoice',
      status: DocumentStatus.ISSUED,
      subtotal: '100000',
      totalAmount: '107500',
      balanceDue: '0',
    });

    const duplicated = await service.duplicate('comp-1', 'doc-source', 'usr-staff-1');

    assert.equal(duplicated.documentNumber, 'INV-2026-000099');
    assert.equal(duplicated.status, DocumentStatus.DRAFT);
    // Balance due should be reset to total amount
    assert.equal(duplicated.balanceDue, '107500');
  });

  await t.test('issue rejects documents not in APPROVED status', async () => {
    documentsDb.push({
      id: 'doc-draft-inv',
      companyId: 'comp-1',
      documentType: DocumentType.INVOICE,
      documentNumber: 'INV-2026-000002',
      status: DocumentStatus.DRAFT,
      invoice: { id: 'inv-1', items: [{ id: 'item-1', quantity: 1, unitPrice: 100 }] },
    });

    await assert.rejects(
      async () => {
        await service.issue('comp-1', 'doc-draft-inv', {}, 'usr-manager-1');
      },
      BadRequestException,
    );
  });

  await t.test('issue polymorphically issues an APPROVED invoice', async () => {
    const docIdx = documentsDb.findIndex((d) => d.id === 'doc-draft-inv');
    documentsDb[docIdx].status = DocumentStatus.APPROVED;

    const issued = await service.issue('comp-1', 'doc-draft-inv', {}, 'usr-manager-1');
    assert.equal(issued.status, DocumentStatus.ISSUED);
    assert.equal(versionsDb.length, 1);
  });

  await t.test('issue polymorphically issues an APPROVED waybill and transitions deliveryStatus', async () => {
    documentsDb.push({
      id: 'doc-wb-approved',
      companyId: 'comp-1',
      documentType: DocumentType.WAYBILL,
      documentNumber: 'WB-2026-000001',
      status: DocumentStatus.APPROVED,
      waybill: {
        id: 'wb-1',
        deliveryStatus: 'PREPARING',
        items: [{ id: 'wb-item-1', description: 'Industrial Parts', quantity: 10 }],
      },
    });

    const issued = await service.issue(
      'comp-1',
      'doc-wb-approved',
      {
        vehicleNumber: 'OG-500-ABC',
        driverName: 'Lateef Gbadamosi',
        driverPhone: '+234 803 111 2222',
      },
      'usr-ops-1',
    );

    assert.equal(issued.status, DocumentStatus.ISSUED);
    assert.equal(versionsDb.length, 2);
  });

  await t.test('issue polymorphically issues an APPROVED letter', async () => {
    documentsDb.push({
      id: 'doc-let-approved',
      companyId: 'comp-1',
      documentType: DocumentType.LETTER,
      documentNumber: 'AOA/LET/2026/0001',
      status: DocumentStatus.APPROVED,
      letter: {
        id: 'let-1',
        recipientName: 'Mr. Adewale',
        subject: 'Partnership Agreement',
        bodyHtml: '<p>Agreement details</p>',
      },
    });

    const issued = await service.issue('comp-1', 'doc-let-approved', {}, 'usr-admin-1');
    assert.equal(issued.status, DocumentStatus.ISSUED);
    assert.equal(versionsDb.length, 3);
  });
});
