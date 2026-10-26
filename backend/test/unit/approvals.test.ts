import { test } from 'node:test';
import * as assert from 'node:assert';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

test('Approvals Workflow & Anti-Self-Approval Tests', async (t) => {
  const documentsStore: any[] = [];
  const approvalsStore: any[] = [];
  const auditLogsStore: any[] = [];
  const notificationsStore: any[] = [];

  const mockCompany = {
    id: 'comp-1',
    name: 'AOA 77 COMPANY LTD',
    settings: {
      allowSelfApproval: false, // Corporate rule: self-approval disabled
    },
  };

  // Seed sample draft document created by 'usr-creator-1'
  const sampleDoc: any = {
    id: 'doc-inv-001',
    companyId: 'comp-1',
    documentNumber: 'INV-2026-000001',
    documentType: DocumentType.INVOICE,
    title: 'Test Invoice for Cement Supply',
    status: DocumentStatus.DRAFT,
    createdById: 'usr-creator-1',
    subtotal: '100000.00',
    taxAmount: '7500.00',
    discountAmount: '0.00',
    totalAmount: '107500.00',
    balanceDue: '107500.00',
    currency: 'NGN',
    invoice: {
      items: [{ lineNumber: 1, description: 'Cement', quantity: '50', unitPrice: '2000' }],
    },
    approvals: [],
    versions: [],
  };
  documentsStore.push(sampleDoc);

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        const doc = documentsStore.find((d) => d.id === where.id && d.companyId === where.companyId);
        if (!doc) return null;
        return {
          ...doc,
          company: mockCompany,
          approvals: approvalsStore.filter((a) => a.documentId === doc.id),
        };
      },
      update: async ({ where, data }: any) => {
        const doc = documentsStore.find((d) => d.id === where.id);
        if (doc) Object.assign(doc, data);
        return doc;
      },
      count: async () => documentsStore.length,
    },
    company: {
      findUnique: async () => mockCompany,
    },
    documentApproval: {
      create: async ({ data }: any) => {
        const record = { id: `app-${approvalsStore.length + 1}`, ...data, createdAt: new Date() };
        approvalsStore.push(record);
        return record;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const a of approvalsStore) {
          if (a.documentId === where.documentId && (where.status === undefined || a.status === where.status)) {
            Object.assign(a, data);
            count++;
          }
        }
        return { count };
      },
      findMany: async ({ where }: any) => {
        return approvalsStore.filter((a) => a.documentId === where.documentId);
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogsStore.push(data);
        return data;
      },
    },
    notification: {
      create: async ({ data }: any) => {
        notificationsStore.push(data);
        return data;
      },
    },
    $transaction: async (fn: any) => fn(mockPrisma),
  };

  const numberingMock: any = {};
  const auditMock: any = {
    logAction: async (opt: any) => {
      auditLogsStore.push(opt);
    },
  };
  const notificationsMock: any = {
    createNotification: async (...args: any[]) => {
      notificationsStore.push(args);
    },
  };

  const service = new DocumentsService(mockPrisma, numberingMock, auditMock, notificationsMock);

  await t.test('submitForApproval transitions document from DRAFT to PENDING_APPROVAL and records approval step', async () => {
    const submitted = await service.submitForApproval(
      'comp-1',
      'doc-inv-001',
      { comment: 'Ready for manager review' },
      'usr-creator-1',
    );

    assert.equal(submitted.status, DocumentStatus.PENDING_APPROVAL);
    assert.equal(approvalsStore.length, 1);
    assert.equal(approvalsStore[0].status, 'PENDING');
    assert.equal(approvalsStore[0].stepNumber, 1);
    assert.equal(approvalsStore[0].comment, 'Ready for manager review');
  });

  await t.test('approve throws ForbiddenException if document creator attempts self-approval', async () => {
    await assert.rejects(
      async () => {
        // Creator attempting to approve own document
        await service.approve('comp-1', 'doc-inv-001', { comment: 'Self approving' }, 'usr-creator-1');
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenException);
        assert.match(err.message, /Self-approval of documents is prohibited/);
        return true;
      },
    );
  });

  await t.test('reject transitions document to REJECTED and records mandatory reason', async () => {
    const rejected = await service.reject(
      'comp-1',
      'doc-inv-001',
      { reason: 'Price per bag is missing agreed discount.' },
      'usr-manager-2',
    );

    assert.equal(rejected.status, DocumentStatus.REJECTED);
    assert.equal(approvalsStore[0].status, 'REJECTED');
    assert.equal(approvalsStore[0].comment, 'Price per bag is missing agreed discount.');
    assert.equal(approvalsStore[0].approverId, 'usr-manager-2');
  });

  await t.test('resubmitting REJECTED document transitions back to PENDING_APPROVAL with new stepNumber', async () => {
    const resubmitted = await service.submitForApproval(
      'comp-1',
      'doc-inv-001',
      { comment: 'Discount applied as requested' },
      'usr-creator-1',
    );

    assert.equal(resubmitted.status, DocumentStatus.PENDING_APPROVAL);
    assert.equal(approvalsStore.length, 2);
    assert.equal(approvalsStore[1].stepNumber, 2);
    assert.equal(approvalsStore[1].status, 'PENDING');
  });

  await t.test('approve succeeds when authorized manager approves the document', async () => {
    const approved = await service.approve(
      'comp-1',
      'doc-inv-001',
      { comment: 'Approved for issuance' },
      'usr-manager-2',
    );

    assert.equal(approved.status, DocumentStatus.APPROVED);
    assert.equal(approvalsStore[1].status, 'APPROVED');
    assert.equal(approvalsStore[1].approverId, 'usr-manager-2');
  });

  await t.test('getApprovals retrieves chronological step audit history', async () => {
    const history = await service.getApprovals('comp-1', 'doc-inv-001');
    assert.equal(history.length, 2);
    assert.equal(history[0].stepNumber, 1);
    assert.equal(history[0].status, 'REJECTED');
    assert.equal(history[1].stepNumber, 2);
    assert.equal(history[1].status, 'APPROVED');
  });
});
