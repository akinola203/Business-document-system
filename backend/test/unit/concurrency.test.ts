import { test } from 'node:test';
import * as assert from 'node:assert';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { WaybillsService } from '../../src/modules/waybills/waybills.service';
import { LettersService } from '../../src/modules/letters/letters.service';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

test('Optimistic Concurrency Control (OCC) Tests', async (t) => {
  // Test Invoice Concurrency
  await t.test('InvoicesService OCC: rejects edits with stale expectedVersion and increments on match', async () => {
    const invoiceDoc: any = {
      id: 'inv-occ-1',
      companyId: 'comp-1',
      documentNumber: 'INV-2026-000001',
      documentType: DocumentType.INVOICE,
      title: 'Original Title',
      status: DocumentStatus.DRAFT,
      versionCounter: 2, // Document is currently at version 2
      subtotal: '1000.00',
      taxAmount: '75.00',
      discountAmount: '0.00',
      totalAmount: '1075.00',
      balanceDue: '1075.00',
      currency: 'NGN',
      invoice: {
        id: 'child-inv-1',
        items: [{ id: 'item-1', description: 'Item 1', quantity: '1', unitPrice: '1000' }],
      },
    };

    const mockPrisma: any = {
      document: {
        findFirst: async () => invoiceDoc,
        update: async ({ data }: any) => {
          const prevVersion = invoiceDoc.versionCounter;
          Object.assign(invoiceDoc, data);
          if (data.versionCounter?.increment) {
            invoiceDoc.versionCounter = prevVersion + data.versionCounter.increment;
          }
          return invoiceDoc;
        },
        updateMany: async ({ where, data }: any) => {
          const matchVersion = where.versionCounter === undefined || invoiceDoc.versionCounter === where.versionCounter;
          const matchStatus = !where.status || (where.status.in ? where.status.in.includes(invoiceDoc.status) : invoiceDoc.status === where.status);
          if (matchVersion && matchStatus) {
            if (data.versionCounter?.increment) {
              invoiceDoc.versionCounter += data.versionCounter.increment;
            }
            if (data.status) invoiceDoc.status = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      invoice: {
        update: async () => invoiceDoc.invoice,
      },
      auditLog: {
        create: async () => {},
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    const service = new InvoicesService(mockPrisma, {} as any);

    // 1. Conflict: Stale version 1 provided when document is at version 2
    await assert.rejects(
      async () => {
        await service.updateDraft(
          'comp-1',
          'inv-occ-1',
          { title: 'Concurrent Edit', expectedVersion: 1 },
          'usr-1',
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /Current version is 2/);
        return true;
      },
    );

    // 2. Success: Matching version 2 provided
    service.findOne = async () => invoiceDoc;

    await service.updateDraft(
      'comp-1',
      'inv-occ-1',
      { title: 'Valid Edit', expectedVersion: 2 },
      'usr-1',
    );

    assert.equal(invoiceDoc.title, 'Valid Edit');
    assert.equal(invoiceDoc.versionCounter, 3); // Incremented from 2 to 3
  });

  // Test Waybill Concurrency
  await t.test('WaybillsService OCC: rejects edits with stale expectedVersion', async () => {
    const waybillDoc: any = {
      id: 'wb-occ-1',
      companyId: 'comp-1',
      documentNumber: 'WB-2026-000001',
      documentType: DocumentType.WAYBILL,
      title: 'Original Waybill Title',
      status: DocumentStatus.DRAFT,
      versionCounter: 5,
      waybill: {
        id: 'child-wb-1',
        items: [],
      },
    };

    const mockPrisma: any = {
      document: {
        findFirst: async () => waybillDoc,
        update: async ({ data }: any) => {
          const prevVersion = waybillDoc.versionCounter;
          Object.assign(waybillDoc, data);
          if (data.versionCounter?.increment) {
            waybillDoc.versionCounter = prevVersion + data.versionCounter.increment;
          }
          return waybillDoc;
        },
        updateMany: async ({ where, data }: any) => {
          const matchVersion = where.versionCounter === undefined || waybillDoc.versionCounter === where.versionCounter;
          const matchStatus = !where.status || (where.status.in ? where.status.in.includes(waybillDoc.status) : waybillDoc.status === where.status);
          if (matchVersion && matchStatus) {
            if (data.versionCounter?.increment) {
              waybillDoc.versionCounter += data.versionCounter.increment;
            }
            if (data.status) waybillDoc.status = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      waybill: {
        update: async () => waybillDoc.waybill,
      },
      auditLog: {
        create: async () => {},
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    const service = new WaybillsService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Conflict: Stale version 4 provided
    await assert.rejects(
      async () => {
        await service.updateDraft(
          'comp-1',
          'wb-occ-1',
          { title: 'Conflicting Driver Update', expectedVersion: 4 },
          'usr-1',
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /current version is 5/i);
        return true;
      },
    );

    // Success: Matching version 5 provided
    service.findOne = async () => waybillDoc;
    await service.updateDraft(
      'comp-1',
      'wb-occ-1',
      { title: 'Updated Waybill', expectedVersion: 5 },
      'usr-1',
    );
    assert.equal(waybillDoc.title, 'Updated Waybill');
    assert.equal(waybillDoc.versionCounter, 6);
  });

  // Test Letter Concurrency
  await t.test('LettersService OCC: rejects edits with stale expectedVersion', async () => {
    const letterDoc: any = {
      id: 'let-occ-1',
      companyId: 'comp-1',
      documentNumber: 'AOA/LET/2026/0001',
      documentType: DocumentType.LETTER,
      title: 'Original Letter',
      status: DocumentStatus.DRAFT,
      versionCounter: 3,
      letter: {
        id: 'child-let-1',
      },
    };

    const mockPrisma: any = {
      document: {
        findFirst: async () => letterDoc,
        update: async ({ data }: any) => {
          const prevVersion = letterDoc.versionCounter;
          Object.assign(letterDoc, data);
          if (data.versionCounter?.increment) {
            letterDoc.versionCounter = prevVersion + data.versionCounter.increment;
          }
          return letterDoc;
        },
        updateMany: async ({ where, data }: any) => {
          const matchVersion = where.versionCounter === undefined || letterDoc.versionCounter === where.versionCounter;
          const matchStatus = !where.status || (where.status.in ? where.status.in.includes(letterDoc.status) : letterDoc.status === where.status);
          if (matchVersion && matchStatus) {
            if (data.versionCounter?.increment) {
              letterDoc.versionCounter += data.versionCounter.increment;
            }
            if (data.status) letterDoc.status = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      letter: {
        update: async () => letterDoc.letter,
      },
      auditLog: {
        create: async () => {},
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    const service = new LettersService(mockPrisma, {} as any);

    // Conflict: Stale version 1 provided
    await assert.rejects(
      async () => {
        await service.updateDraft(
          'comp-1',
          'let-occ-1',
          { title: 'Concurrent Letter Body Edit', expectedVersion: 1 },
          'usr-1',
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /Current version is 3/);
        return true;
      },
    );

    // Success: Matching version 3 provided
    service.findOne = async () => letterDoc;
    await service.updateDraft(
      'comp-1',
      'let-occ-1',
      { title: 'Updated Letter Subject', expectedVersion: 3 },
      'usr-1',
    );
    assert.equal(letterDoc.title, 'Updated Letter Subject');
    assert.equal(letterDoc.versionCounter, 4);
  });
});
