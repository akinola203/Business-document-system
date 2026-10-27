import { test } from 'node:test';
import * as assert from 'node:assert';
import { VendorsService } from '../../src/modules/vendors/vendors.service';
import { SuppliesService } from '../../src/modules/supplies/supplies.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VendorCategory, SupplyOrderStatus } from '@prisma/client';

test('Vendors & Supplies Comprehensive Integration Unit Tests', async (t) => {
  const companyId = 'c0000000-0000-0000-0000-000000000001';
  const userId = 'usr-admin-1';

  // In-memory mock storage
  const mockVendors: any[] = [];
  const mockSupplyItems: any[] = [];
  const mockSupplyOrders: any[] = [];
  const mockAuditLogs: any[] = [];

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      mockAuditLogs.push(entry);
    },
  };

  const mockPrisma: any = {
    vendor: {
      findFirst: async ({ where }: any) => {
        return (
          mockVendors.find((v) => {
            if (where.companyId && v.companyId !== where.companyId) return false;
            if (where.vendorCode && v.vendorCode === where.vendorCode) return true;
            if (where.id && v.id === where.id) return true;
            return false;
          }) || null
        );
      },
      findUnique: async ({ where, include }: any) => {
        const v = mockVendors.find((x) => x.id === where.id);
        if (!v) return null;
        const res = { ...v };
        if (include?.supplyItems) {
          res.supplyItems = mockSupplyItems.filter((it) => it.preferredVendorId === v.id);
        }
        if (include?.supplyOrders) {
          res.supplyOrders = mockSupplyOrders.filter((so) => so.vendorId === v.id);
        }
        return res;
      },
      count: async ({ where }: any) => {
        return mockVendors.filter((v) => {
          if (where.companyId && v.companyId !== where.companyId) return false;
          if (where.category && v.category !== where.category) return false;
          if (where.status && v.status !== where.status) return false;
          return true;
        }).length;
      },
      findMany: async ({ where, skip = 0, take = 50 }: any) => {
        return mockVendors
          .filter((v) => {
            if (where.companyId && v.companyId !== where.companyId) return false;
            if (where.category && v.category !== where.category) return false;
            if (where.status && v.status !== where.status) return false;
            return true;
          })
          .slice(skip, skip + take)
          .map((v) => ({
            ...v,
            _count: { supplyItems: 0, supplyOrders: 0 },
          }));
      },
      create: async ({ data }: any) => {
        const newVendor = {
          id: `vnd-${Date.now()}`,
          status: data.status || 'ACTIVE',
          ...data,
          totalSuppliedAmount: Number(data.totalSuppliedAmount || 0),
          outstandingPayable: Number(data.outstandingPayable || 0),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockVendors.push(newVendor);
        return newVendor;
      },
      update: async ({ where, data }: any) => {
        const idx = mockVendors.findIndex((v) => v.id === where.id);
        if (idx === -1) throw new Error('Vendor not found');
        const updated = { ...mockVendors[idx] };
        const { totalSuppliedAmount, outstandingPayable, ...restData } = data;
        if (totalSuppliedAmount?.increment) {
          updated.totalSuppliedAmount =
            Number(updated.totalSuppliedAmount) + Number(totalSuppliedAmount.increment);
        } else if (totalSuppliedAmount !== undefined) {
          updated.totalSuppliedAmount = Number(totalSuppliedAmount);
        }
        if (outstandingPayable?.increment) {
          updated.outstandingPayable =
            Number(updated.outstandingPayable) + Number(outstandingPayable.increment);
        } else if (outstandingPayable !== undefined) {
          updated.outstandingPayable = Number(outstandingPayable);
        }
        mockVendors[idx] = { ...updated, ...restData, updatedAt: new Date() };
        return mockVendors[idx];
      },
    },

    supplyItem: {
      findFirst: async ({ where }: any) => {
        return (
          mockSupplyItems.find((it) => {
            if (where.companyId && it.companyId !== where.companyId) return false;
            if (where.sku && it.sku === where.sku) return true;
            if (where.id && it.id === where.id) return true;
            return false;
          }) || null
        );
      },
      findUnique: async ({ where, include }: any) => {
        const it = mockSupplyItems.find((x) => x.id === where.id);
        if (!it) return null;
        const res = { ...it };
        if (include?.preferredVendor) {
          res.preferredVendor = mockVendors.find((v) => v.id === it.preferredVendorId) || null;
        }
        return res;
      },
      count: async ({ where }: any) => {
        return mockSupplyItems.filter((it) => {
          if (where.companyId && it.companyId !== where.companyId) return false;
          return true;
        }).length;
      },
      findMany: async ({ where, skip = 0, take = 50 }: any) => {
        return mockSupplyItems
          .filter((it) => {
            if (where.companyId && it.companyId !== where.companyId) return false;
            return true;
          })
          .slice(skip, skip + take);
      },
      create: async ({ data }: any) => {
        const newItem = {
          id: `item-${Date.now()}-${Math.random()}`,
          ...data,
          unitCost: Number(data.unitCost || 0),
          sellingPrice: Number(data.sellingPrice || 0),
          taxRate: Number(data.taxRate || 7.5),
          currentStock: Number(data.currentStock || 0),
          reorderLevel: Number(data.reorderLevel || 10),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSupplyItems.push(newItem);
        return newItem;
      },
      update: async ({ where, data }: any) => {
        const idx = mockSupplyItems.findIndex((it) => it.id === where.id);
        if (idx === -1) throw new Error('Item not found');
        const updated = { ...mockSupplyItems[idx] };
        if (data.currentStock?.increment) {
          updated.currentStock = Number(updated.currentStock) + Number(data.currentStock.increment);
        } else if (data.currentStock !== undefined) {
          updated.currentStock = Number(data.currentStock);
        }
        if (data.sellingPrice !== undefined) updated.sellingPrice = Number(data.sellingPrice);
        if (data.unitCost !== undefined) updated.unitCost = Number(data.unitCost);
        mockSupplyItems[idx] = updated;
        return updated;
      },
    },

    supplyOrder: {
      findFirst: async ({ where }: any) => {
        return (
          mockSupplyOrders.find((so) => {
            if (where.companyId && so.companyId !== where.companyId) return false;
            if (where.supplyNumber && so.supplyNumber === where.supplyNumber) return true;
            if (where.id && so.id === where.id) return true;
            return false;
          }) || null
        );
      },
      findUnique: async ({ where, include }: any) => {
        const so = mockSupplyOrders.find((x) => x.id === where.id);
        if (!so) return null;
        const res = { ...so };
        if (include?.vendor) {
          res.vendor = mockVendors.find((v) => v.id === so.vendorId);
        }
        return res;
      },
      count: async () => mockSupplyOrders.length,
      findMany: async () => mockSupplyOrders,
      create: async ({ data }: any) => {
        const newOrder = {
          id: `order-${Date.now()}`,
          ...data,
          items: data.items?.create || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSupplyOrders.push(newOrder);
        return newOrder;
      },
      update: async ({ where, data }: any) => {
        const idx = mockSupplyOrders.findIndex((so) => so.id === where.id);
        if (idx === -1) throw new Error('Order not found');
        mockSupplyOrders[idx] = { ...mockSupplyOrders[idx], ...data, updatedAt: new Date() };
        return mockSupplyOrders[idx];
      },
    },

    $transaction: async (fn: any) => {
      return fn(mockPrisma);
    },
  };

  const vendorsService = new VendorsService(mockPrisma, mockAuditService);
  const suppliesService = new SuppliesService(mockPrisma, mockAuditService);

  await t.test('1. Vendors: creates vendor with VND code and audit record', async () => {
    const vendor = await vendorsService.create(
      companyId,
      {
        name: 'NNPC Retail Logistics & Fuels',
        category: VendorCategory.LOGISTICS_HAULAGE,
        contactPerson: 'Engr. Farouk Ahmed',
        email: 'haulage@nnpc.gov.ng',
        phone: '+234 802 334 1100',
        bankName: 'First Bank of Nigeria',
        bankAccountNumber: '2034981123',
        bankAccountName: 'NNPC Retail Operations',
      },
      userId
    );

    assert.ok(vendor.id);
    assert.match(vendor.vendorCode, /^VND-\d{4}$/);
    assert.equal(vendor.name, 'NNPC Retail Logistics & Fuels');
    assert.equal(vendor.status, 'ACTIVE');

    // Audit log generated
    const audit = mockAuditLogs.find((a) => a.action === 'VENDOR_CREATED' && a.entityType === 'Vendor');
    assert.ok(audit);
    assert.equal(audit.actorId, userId);
  });

  await t.test('2. Vendors: rejects duplicate vendor code within company', async () => {
    await assert.rejects(
      async () => {
        await vendorsService.create(
          companyId,
          {
            vendorCode: mockVendors[0].vendorCode,
            name: 'Impostor Logistics',
            category: VendorCategory.GENERAL,
          },
          userId
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /already in use/);
        return true;
      }
    );
  });

  await t.test('3. Supplies: creates catalog item and enforces unique SKU', async () => {
    const item = await suppliesService.createItem(
      companyId,
      {
        sku: 'SUP-CEM-001',
        name: 'Portland Limestone Cement 50kg',
        category: 'RAW_MATERIALS',
        unit: 'Bags',
        unitCost: 8500,
        sellingPrice: 10500,
        taxRate: 7.5,
        currentStock: 100,
        reorderLevel: 20,
        preferredVendorId: mockVendors[0].id,
      },
      userId
    );

    assert.ok(item.id);
    assert.equal(item.sku, 'SUP-CEM-001');
    assert.equal(item.currentStock, 100);

    // Duplicate SKU rejection
    await assert.rejects(
      async () => {
        await suppliesService.createItem(
          companyId,
          {
            sku: 'SUP-CEM-001',
            name: 'Another Cement',
            category: 'RAW_MATERIALS',
            unit: 'Bags',
            unitCost: 8800,
            sellingPrice: 11000,
          },
          userId
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        return true;
      }
    );
  });

  await t.test(
    '4. Sourcing & Stock: Supply Order with RECEIVED increments warehouse stock and updates vendor totals',
    async () => {
      const targetItem = mockSupplyItems[0];
      const targetVendor = mockVendors[0];
      const initialStock = Number(targetItem.currentStock);
      const initialVendorSupplied = Number(targetVendor.totalSuppliedAmount);

      const order = await suppliesService.createOrder(
        companyId,
        {
          vendorId: targetVendor.id,
          deliveryRef: 'WB-NNPC-8891',
          status: SupplyOrderStatus.RECEIVED,
          currency: 'NGN',
          items: [
            {
              supplyItemId: targetItem.id,
              description: targetItem.name,
              unit: targetItem.unit,
              quantity: 50,
              unitCost: 8500,
            },
          ],
        },
        userId
      );

      assert.ok(order.id);
      assert.match(order.supplyNumber, /^SUP-\d{4}-\d{4}$/);
      assert.equal(order.status, 'RECEIVED');
      assert.equal(order.subtotal, 425000);
      assert.equal(order.taxTotal, 31875);
      assert.equal(order.grandTotal, 456875);

      // Verify stock incremented by 50 in memory
      const updatedItem = mockSupplyItems.find((it) => it.id === targetItem.id);
      assert.equal(updatedItem.currentStock, initialStock + 50);

      // Verify vendor totals updated
      const updatedVendor = mockVendors.find((v) => v.id === targetVendor.id);
      assert.equal(updatedVendor.totalSuppliedAmount, initialVendorSupplied + 456875);
    }
  );
});
