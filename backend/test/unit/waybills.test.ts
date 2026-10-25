import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { WaybillsService } from '../../src/modules/waybills/waybills.service';
import { DocumentStatus, DocumentType, WaybillDeliveryStatus } from '@prisma/client';

test('WaybillsService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
  let waybillsDb: any[] = [];
  let waybillItemsDb: any[] = [];
  let versionsDb: any[] = [];
  let auditLogs: any[] = [];

  const mockCompany = {
    id: 'comp-1',
    name: 'AOA 77 COMPANY LTD',
    legalName: 'AOA 77 COMPANY LTD',
    address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota',
    phone: '+234 803 000 0000',
  };

  const mockClient = {
    id: 'client-1',
    name: 'Dangote Hub',
    companyName: 'Dangote Industries Limited',
    phone: '+234 802 000 1111',
    addresses: [
      { id: 'addr-1', isDefault: true, addressLine1: 'Plot 45 Industrial Way', city: 'Ota', state: 'Ogun' },
    ],
  };

  const mockPrisma: any = {
    company: {
      findUnique: async () => mockCompany,
    },
    client: {
      findFirst: async () => mockClient,
    },
    document: {
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find((d) => d.id === where.id && d.companyId === where.companyId);
        if (!doc) return null;
        const wb = waybillsDb.find((w) => w.documentId === doc.id);
        const items = wb ? waybillItemsDb.filter((it) => it.waybillId === wb.id) : [];
        return {
          ...doc,
          client: mockClient,
          waybill: wb ? { ...wb, items } : null,
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
    waybill: {
      create: async ({ data }: any) => {
        const id = `wb-${waybillsDb.length + 1}`;
        const item = { id, ...data };
        waybillsDb.push(item);
        if (data.items?.create) {
          data.items.create.forEach((it: any) => {
            waybillItemsDb.push({ id: `item-${waybillItemsDb.length + 1}`, waybillId: id, ...it });
          });
        }
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = waybillsDb.findIndex((w) => w.id === where.id);
        waybillsDb[idx] = { ...waybillsDb[idx], ...data };
        return waybillsDb[idx];
      },
    },
    documentVersion: {
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
    getNextDocumentNumber: async () => 'WB-2026-000001',
  };

  const service = new WaybillsService(mockPrisma, mockNumberingService);

  await t.test('createDraft creates waybill with consignor/consignee snapshots and WB number', async () => {
    documentsDb = [];
    waybillsDb = [];
    waybillItemsDb = [];

    const waybill = await service.createDraft(
      'comp-1',
      {
        title: 'Cement Consignment Dispatch #1',
        clientId: 'client-1',
        originAddress: 'AOA 77 Ota Depot',
        destinationAddress: 'Dangote Hub Agbara',
        items: [
          { description: 'Portland Cement Bags', quantity: 200, unit: 'Bags', weightKg: 10000 },
        ],
      },
      'usr-ops-1',
    );

    assert.equal(waybill.documentNumber, 'WB-2026-000001');
    assert.equal(waybill.status, DocumentStatus.DRAFT);
    assert.equal(waybill.waybill?.deliveryStatus, WaybillDeliveryStatus.PREPARING);
    assert.equal(waybill.waybill?.items.length, 1);
  });

  await t.test('dispatch transitions delivery to IN_TRANSIT and status to ISSUED', async () => {
    const docId = documentsDb[0].id;
    const dispatched = await service.dispatch(
      'comp-1',
      docId,
      {
        vehicleNumber: 'OG-123-AAA',
        driverName: 'Kabiru Alabi',
        driverPhone: '+234 803 777 8888',
        trackingNumber: 'TRK-2026-001',
      },
      'usr-ops-1',
    );

    assert.equal(dispatched.status, DocumentStatus.ISSUED);
    assert.equal(dispatched.waybill?.deliveryStatus, WaybillDeliveryStatus.IN_TRANSIT);
    assert.equal(dispatched.waybill?.driverName, 'Kabiru Alabi');
    assert.equal(versionsDb.length, 1);
  });

  await t.test('complete transitions delivery to DELIVERED and status to COMPLETED', async () => {
    const docId = documentsDb[0].id;
    const completed = await service.complete(
      'comp-1',
      docId,
      {
        receivedByName: 'Alhaji Musa Ibrahim',
      },
      'usr-ops-1',
    );

    assert.equal(completed.status, DocumentStatus.COMPLETED);
    assert.equal(completed.waybill?.deliveryStatus, WaybillDeliveryStatus.DELIVERED);
    assert.equal(completed.waybill?.receivedByName, 'Alhaji Musa Ibrahim');
  });
});
