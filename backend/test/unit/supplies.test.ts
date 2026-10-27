import { test } from 'node:test';
import * as assert from 'node:assert';
import { SuppliesService } from '../../src/modules/supplies/supplies.service';
import { SupplyOrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

test('SuppliesService Unit Tests', async (t) => {
  const itemsStore: any[] = [];
  const ordersStore: any[] = [];
  const vendorsStore: any[] = [
    {
      id: 'vnd-1',
      companyId: 'comp-1',
      name: 'WAPC Packaging Solutions',
      totalSuppliedAmount: new Decimal(0),
      outstandingPayable: new Decimal(0),
    },
  ];
  const auditLogsStore: any[] = [];

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogsStore.push(entry);
    },
  };

  const mockPrisma: any = {
    vendor: {
      findFirst: async ({ where }: any) => {
        return vendorsStore.find((v) => v.id === where.id && v.companyId === where.companyId) || null;
      },
      update: async ({ where, data }: any) => {
        const v = vendorsStore.find((vend) => vend.id === where.id);
        if (data.totalSuppliedAmount?.increment) {
          v.totalSuppliedAmount = v.totalSuppliedAmount.plus(data.totalSuppliedAmount.increment);
        }
        if (data.outstandingPayable?.increment) {
          v.outstandingPayable = v.outstandingPayable.plus(data.outstandingPayable.increment);
        }
        return v;
      },
    },
    supplyItem: {
      findFirst: async ({ where }: any) => {
        return itemsStore.find((i) => {
          let match = true;
          if (where.id) match = match && i.id === where.id;
          if (where.companyId) match = match && i.companyId === where.companyId;
          if (where.sku) match = match && i.sku === where.sku;
          return match;
        }) || null;
      },
      findMany: async ({ where }: any) => {
        return itemsStore.filter((i) => i.companyId === where.companyId).map((i) => ({
          ...i,
          preferredVendor: { id: 'vnd-1', name: 'WAPC Packaging Solutions' },
        }));
      },
      count: async ({ where }: any) => {
        return itemsStore.filter((i) => i.companyId === where.companyId).length;
      },
      create: async ({ data }: any) => {
        const item = {
          id: `item-${itemsStore.length + 1}`,
          ...data,
          currentStock: new Decimal(data.currentStock || 0),
          reorderLevel: new Decimal(data.reorderLevel || 0),
          unitCost: new Decimal(data.unitCost),
          sellingPrice: new Decimal(data.sellingPrice),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        itemsStore.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const item = itemsStore.find((i) => i.id === where.id);
        if (data.currentStock?.increment) {
          item.currentStock = item.currentStock.plus(data.currentStock.increment);
        }
        return item;
      },
    },
    supplyOrder: {
      count: async () => ordersStore.length,
      findFirst: async ({ where }: any) => {
        return ordersStore.find((o) => o.id === where.id && o.companyId === where.companyId) || null;
      },
      findMany: async () => ordersStore,
      create: async ({ data }: any) => {
        const order = {
          id: `ord-${ordersStore.length + 1}`,
          ...data,
          subtotal: new Decimal(data.subtotal),
          taxTotal: new Decimal(data.taxTotal),
          grandTotal: new Decimal(data.grandTotal),
          amountPaid: new Decimal(data.amountPaid || 0),
          items: data.items.create.map((it: any, idx: number) => ({
            id: `ord-it-${idx + 1}`,
            ...it,
            lineTotal: new Decimal(it.lineTotal),
          })),
        };
        ordersStore.push(order);
        return order;
      },
      update: async ({ where, data }: any) => {
        const ord = ordersStore.find((o) => o.id === where.id);
        Object.assign(ord, data);
        return ord;
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const suppliesService = new SuppliesService(mockPrisma, mockAuditService);

  await t.test('createItem creates catalog item and rejects duplicate SKU', async () => {
    const item = await suppliesService.createItem(
      'comp-1',
      {
        sku: 'SUP-CEM-001',
        name: 'Portland Limestone Cement 50kg',
        category: 'RAW_MATERIALS',
        unit: 'Bags',
        unitCost: 6800.0,
        sellingPrice: 8500.0,
        currentStock: 100,
        reorderLevel: 200,
        preferredVendorId: 'vnd-1',
      },
      'usr-1',
    );

    assert.equal(item.sku, 'SUP-CEM-001');
    assert.equal(item.name, 'Portland Limestone Cement 50kg');

    await assert.rejects(
      async () => {
        await suppliesService.createItem(
          'comp-1',
          {
            sku: 'SUP-CEM-001',
            name: 'Another Cement',
            category: 'RAW_MATERIALS',
            unit: 'Bags',
            unitCost: 7000,
            sellingPrice: 8900,
          },
          'usr-1',
        );
      },
      { message: 'Supply item with SKU "SUP-CEM-001" already exists.' },
    );
  });

  await t.test('createOrder with status RECEIVED automatically increments stock & vendor total', async () => {
    const order = await suppliesService.createOrder(
      'comp-1',
      {
        vendorId: 'vnd-1',
        deliveryRef: 'WAPC-REC-001',
        status: SupplyOrderStatus.RECEIVED,
        items: [
          {
            supplyItemId: 'item-1',
            description: 'Portland Limestone Cement 50kg (Batch 1)',
            unit: 'Bags',
            quantity: 50,
            unitCost: 6800.0,
          },
        ],
      },
      'usr-1',
    );

    assert.ok(order.supplyNumber.startsWith('SUP-2026-'));
    assert.equal(order.status, SupplyOrderStatus.RECEIVED);

    // Initial stock was 100, added 50 -> 150
    const item = itemsStore.find((i) => i.id === 'item-1');
    assert.equal(item.currentStock.toNumber(), 150);

    // Vendor total supplied was 0 + (50 * 6800 * 1.075) = 365,500
    const vendor = vendorsStore.find((v) => v.id === 'vnd-1');
    assert.equal(vendor.totalSuppliedAmount.toNumber(), 365500);
  });

  await t.test('findAllItems correctly applies lowStockOnly filtering', async () => {
    // Current stock is 150, reorderLevel is 200, so it qualifies as low stock!
    const result = await suppliesService.findAllItems('comp-1', { lowStockOnly: true });
    assert.equal(result.items.length, 1);
  });
});
