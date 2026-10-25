import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { DocumentStatus, DocumentType } from '@prisma/client';

test('DocumentsService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
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
        return documentsDb.find((d) => d.id === where.id && d.companyId === where.companyId) || null;
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

  const service = new DocumentsService(mockPrisma, mockNumberingService);

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
});
