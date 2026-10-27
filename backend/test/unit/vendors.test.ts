import { test } from 'node:test';
import * as assert from 'node:assert';
import { VendorsService } from '../../src/modules/vendors/vendors.service';
import { VendorCategory, VendorStatus } from '@prisma/client';

test('VendorsService Unit Tests', async (t) => {
  const vendorsStore: any[] = [];
  const auditLogsStore: any[] = [];

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogsStore.push(entry);
    },
  };

  const mockPrisma: any = {
    vendor: {
      count: async ({ where }: any) => {
        return vendorsStore.filter((v) => v.companyId === where.companyId).length;
      },
      findFirst: async ({ where }: any) => {
        return vendorsStore.find((v) => {
          let match = true;
          if (where.id) match = match && v.id === where.id;
          if (where.companyId) match = match && v.companyId === where.companyId;
          if (where.vendorCode) match = match && v.vendorCode === where.vendorCode;
          return match;
        }) || null;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let list = vendorsStore.filter((v) => v.companyId === where.companyId);
        if (where.category) list = list.filter((v) => v.category === where.category);
        if (where.status) list = list.filter((v) => v.status === where.status);
        if (where.OR) {
          const search = where.OR[0].name.contains.toLowerCase();
          list = list.filter((v) =>
            v.name.toLowerCase().includes(search) || v.vendorCode.toLowerCase().includes(search),
          );
        }
        return list.slice(skip, skip + take).map((v) => ({
          ...v,
          _count: { supplyItems: 0, supplyOrders: 0 },
        }));
      },
      create: async ({ data }: any) => {
        const item = {
          id: `vnd-${vendorsStore.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        vendorsStore.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = vendorsStore.findIndex((v) => v.id === where.id);
        vendorsStore[idx] = { ...vendorsStore[idx], ...data, updatedAt: new Date() };
        return vendorsStore[idx];
      },
    },
  };

  const vendorsService = new VendorsService(mockPrisma, mockAuditService);

  await t.test('create auto-allocates VND-0001 code and logs audit entry', async () => {
    const vendor = await vendorsService.create(
      'comp-1',
      {
        name: 'NNPC Retail Logistics & Fuels',
        category: VendorCategory.LOGISTICS_HAULAGE,
        email: 'logistics@nnpcretail.com',
        bankName: 'Globus Bank Plc',
        bankAccountNumber: '1000652199',
      },
      'usr-1',
    );

    assert.equal(vendor.vendorCode, 'VND-0001');
    assert.equal(vendor.name, 'NNPC Retail Logistics & Fuels');
    assert.equal(vendor.bankName, 'Globus Bank Plc');
    assert.equal(auditLogsStore.length, 1);
    assert.equal(auditLogsStore[0].action, 'VENDOR_CREATED');
  });

  await t.test('create rejects duplicate vendor code in company', async () => {
    await assert.rejects(
      async () => {
        await vendorsService.create(
          'comp-1',
          {
            name: 'Duplicate Vendor',
            vendorCode: 'VND-0001',
          },
          'usr-1',
        );
      },
      { message: 'Vendor code "VND-0001" is already in use.' },
    );
  });

  await t.test('findAll returns paginated vendors with search and category filtering', async () => {
    const result = await vendorsService.findAll('comp-1', {
      search: 'NNPC',
      category: VendorCategory.LOGISTICS_HAULAGE,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.meta.total, 1);
    assert.equal(result.items[0].name, 'NNPC Retail Logistics & Fuels');
  });

  await t.test('update updates payout details and status with audit logging', async () => {
    const updated = await vendorsService.update(
      'comp-1',
      'vnd-1',
      {
        status: VendorStatus.SUSPENDED,
        notes: 'Compliance audit pending for bank KYC.',
      },
      'usr-1',
    );

    assert.equal(updated.status, VendorStatus.SUSPENDED);
    assert.equal(updated.notes, 'Compliance audit pending for bank KYC.');
    assert.equal(auditLogsStore[auditLogsStore.length - 1].action, 'VENDOR_UPDATED');
  });
});
