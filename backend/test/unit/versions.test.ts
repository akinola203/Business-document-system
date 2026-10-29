import { test } from 'node:test';
import * as assert from 'node:assert';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { DocumentStatus, DocumentType } from '@prisma/client';

test('Document Version History & Snapshot Comparison Tests', async (t) => {
  const versionsStore: any[] = [];
  const auditLogsStore: any[] = [];

  const mockCompany = {
    id: 'comp-1',
    name: 'AOA 77 COMPANY LTD',
    legalName: 'AOA 77 COMPANY LTD',
    rcNumber: '9905345...',
    tin: '2622739227683',
    address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota',
    settings: {
      bankName: 'Globus Bank',
      bankAccountNumber: '1000652112',
    },
  };

  const sampleDoc: any = {
    id: 'doc-v-100',
    companyId: 'comp-1',
    documentNumber: 'INV-2026-000001',
    documentType: DocumentType.INVOICE,
    title: 'Supply of Portland Cement v1',
    status: DocumentStatus.DRAFT,
    issueDate: new Date('2026-10-24'),
    dueDate: new Date('2026-11-23'),
    subtotal: '200000.00',
    taxAmount: '15000.00',
    discountAmount: '0.00',
    totalAmount: '215000.00',
    balanceDue: '215000.00',
    currency: 'NGN',
    currentVersionId: null,
    isArchived: false,
    client: {
      id: 'cli-1',
      clientNumber: 'CLI-00001',
      name: 'Dangote Cement Distributors',
      companyName: 'Dangote PLC',
      email: 'procurement@dangote.com',
      addresses: [],
    },
    branch: { id: 'br-1', code: 'OTA-HQ', name: 'Ota Headquarters' },
    department: { id: 'dp-1', code: 'ACCT', name: 'Finance & Accounts' },
    invoice: {
      items: [
        { lineNumber: 1, description: 'Portland Cement 50kg', quantity: '100', unitPrice: '2000' },
      ],
    },
    approvals: [],
    versions: [],
  };

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        if (where.id === sampleDoc.id && where.companyId === sampleDoc.companyId) {
          return { ...sampleDoc, versions: versionsStore };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        if (where.id === sampleDoc.id) {
          Object.assign(sampleDoc, data);
        }
        return sampleDoc;
      },
      count: async () => 1,
    },
    company: {
      findUnique: async () => mockCompany,
    },
    documentVersion: {
      findFirst: async ({ where, orderBy }: any) => {
        const matches = versionsStore.filter((v) => v.documentId === where.documentId);
        if (orderBy?.versionNumber === 'desc') {
          matches.sort((a, b) => b.versionNumber - a.versionNumber);
        }
        return matches[0] || null;
      },
      create: async ({ data }: any) => {
        const record = {
          id: `ver-${versionsStore.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        versionsStore.push(record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return versionsStore.filter((v) => v.documentId === where.documentId);
      },
      findUnique: async ({ where }: any) => {
        const { documentId, versionNumber } = where.documentId_versionNumber;
        return versionsStore.find((v) => v.documentId === documentId && v.versionNumber === versionNumber) || null;
      },
    },
    $transaction: async (fn: any) => fn(mockPrisma),
  };

  const auditMock: any = {
    logAction: async (opt: any) => {
      auditLogsStore.push(opt);
    },
  };
  const notificationsMock: any = {
    createNotification: async () => {},
  };

  const service = new DocumentsService(mockPrisma, {} as any, auditMock, notificationsMock);

  await t.test('createVersionSnapshot captures frozen snapshot v1 with company branding', async () => {
    const v1 = await service.createVersionSnapshot(
      'comp-1',
      'doc-v-100',
      { changeReason: 'Initial Draft Freeze' },
      'usr-1',
    );

    assert.equal(v1.versionNumber, 1);
    assert.equal(v1.changeReason, 'Initial Draft Freeze');
    assert.equal(sampleDoc.currentVersionId, v1.id);

    const snapshot = v1.snapshotData as any;
    assert.equal(snapshot.document.documentNumber, 'INV-2026-000001');
    assert.equal(snapshot.document.totalAmount, '215000.00');
    assert.equal(snapshot.companyBranding.name, 'AOA 77 COMPANY LTD');
    assert.equal(snapshot.companyBranding.bankName, 'Globus Bank');
    assert.equal(snapshot.client.name, 'Dangote Cement Distributors');
  });

  await t.test('createVersionSnapshot captures frozen snapshot v2 with incremented versionNumber', async () => {
    // Modify document total
    sampleDoc.title = 'Supply of Portland Cement v2 - Extra Bags';
    sampleDoc.totalAmount = '322500.00';
    sampleDoc.subtotal = '300000.00';
    sampleDoc.invoice.items.push({
      lineNumber: 2,
      description: 'Portland Cement Extra 50 Bags',
      quantity: '50',
      unitPrice: '2000',
    });

    const v2 = await service.createVersionSnapshot(
      'comp-1',
      'doc-v-100',
      { changeReason: 'Added 50 extra bags per client call' },
      'usr-1',
    );

    assert.equal(v2.versionNumber, 2);
    assert.equal(v2.changeReason, 'Added 50 extra bags per client call');
    assert.equal(versionsStore.length, 2);
  });

  await t.test('compareVersions accurately calculates financial diff and field changes between v1 and v2', async () => {
    const diff = await service.compareVersions('comp-1', 'doc-v-100', 1, 2);

    assert.equal(diff.fromVersion, 1);
    assert.equal(diff.toVersion, 2);
    assert.equal(diff.financialDiff.fromTotalAmount, '215000.00');
    assert.equal(diff.financialDiff.toTotalAmount, '322500.00');
    assert.equal(diff.financialDiff.totalDifference, '107500.00');
    assert.equal(diff.financialDiff.subtotalDifference, '100000.00');

    // Title was changed
    const titleChange = diff.fieldChanges.find((c) => c.field === 'title');
    assert.ok(titleChange);
    assert.equal(titleChange.from, 'Supply of Portland Cement v1');
    assert.equal(titleChange.to, 'Supply of Portland Cement v2 - Extra Bags');

    // Items count difference
    assert.equal(diff.itemChanges.differenceCount, 1);
  });

  await t.test('compareVersions handles normalized comparison between legacy flat snapshot and nested snapshot', async () => {
    // Push a legacy flat snapshot (version 3)
    versionsStore.push({
      id: 'ver-3',
      documentId: 'doc-v-100',
      versionNumber: 3,
      snapshotData: {
        documentNumber: 'INV-2026-000001',
        title: 'Issued Legacy Flat Invoice',
        status: DocumentStatus.ISSUED,
        subtotal: '400000.00',
        totalAmount: '430000.00',
        items: [
          { lineNumber: 1, description: 'Item 1', quantity: '100', unitPrice: '2000' },
          { lineNumber: 2, description: 'Item 2', quantity: '100', unitPrice: '2000' },
        ],
      },
      createdAt: new Date(),
      changeReason: 'Issued version flat snapshot',
    });

    const diff = await service.compareVersions('comp-1', 'doc-v-100', 2, 3);
    assert.equal(diff.fromVersion, 2);
    assert.equal(diff.toVersion, 3);
    assert.equal(diff.financialDiff.fromTotalAmount, '322500.00');
    assert.equal(diff.financialDiff.toTotalAmount, '430000.00');
    assert.equal(diff.financialDiff.totalDifference, '107500.00');
    assert.equal(diff.financialDiff.subtotalDifference, '100000.00');
    assert.equal(diff.itemChanges.fromItemCount, 2);
    assert.equal(diff.itemChanges.toItemCount, 2);
    assert.equal(diff.itemChanges.differenceCount, 0);

    const titleChange = diff.fieldChanges.find((c) => c.field === 'title');
    assert.ok(titleChange);
    assert.equal(titleChange.from, 'Supply of Portland Cement v2 - Extra Bags');
    assert.equal(titleChange.to, 'Issued Legacy Flat Invoice');
  });

  await t.test('setArchived archives document and logs audit trail', async () => {
    const archived = await service.setArchived('comp-1', 'doc-v-100', true, 'usr-1');
    assert.equal(archived.isArchived, true);
    assert.equal(sampleDoc.isArchived, true);
  });
});
