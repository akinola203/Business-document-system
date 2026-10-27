import { test } from 'node:test';
import * as assert from 'node:assert';
import { ReportsService } from '../../src/modules/reports/reports.service';

test('ReportsService Unit Tests', async (t) => {
  const mockDocuments = [
    {
      id: 'doc-1',
      companyId: 'comp-1',
      branchId: 'br-1',
      clientId: 'cli-1',
      documentType: 'INVOICE',
      documentNumber: 'INV-2026-000001',
      title: 'Structural Steel Supply',
      status: 'ISSUED',
      issueDate: new Date('2026-06-01T10:00:00Z'),
      dueDate: new Date('2026-07-01T10:00:00Z'),
      currency: 'NGN',
      subtotal: '1000000.00',
      taxAmount: '75000.00',
      discountAmount: '0.00',
      totalAmount: '1075000.00',
      balanceDue: '575000.00',
      isArchived: false,
    },
    {
      id: 'doc-2',
      companyId: 'comp-1',
      branchId: 'br-1',
      clientId: 'cli-2',
      documentType: 'INVOICE',
      documentNumber: 'INV-2026-000002',
      title: 'Haulage Logistics',
      status: 'PAID',
      issueDate: new Date('2026-06-15T10:00:00Z'),
      dueDate: new Date('2026-07-15T10:00:00Z'),
      currency: 'NGN',
      subtotal: '2000000.00',
      taxAmount: '150000.00',
      discountAmount: '0.00',
      totalAmount: '2150000.00',
      balanceDue: '0.00',
      isArchived: false,
    },
    {
      id: 'doc-3',
      companyId: 'comp-1',
      branchId: 'br-1',
      clientId: 'cli-1',
      documentType: 'WAYBILL',
      documentNumber: 'WB-2026-000001',
      title: 'Dispatch Batch 1',
      status: 'ISSUED',
      issueDate: new Date('2026-06-20T10:00:00Z'),
      currency: 'NGN',
      subtotal: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      totalAmount: '0.00',
      balanceDue: '0.00',
      isArchived: false,
    },
  ];

  const mockPayments = [
    {
      id: 'pay-1',
      companyId: 'comp-1',
      amount: '500000.00',
      currency: 'NGN',
      paymentDate: new Date('2026-06-10T12:00:00Z'),
      isReversed: false,
    },
    {
      id: 'pay-2',
      companyId: 'comp-1',
      amount: '2150000.00',
      currency: 'NGN',
      paymentDate: new Date('2026-06-18T12:00:00Z'),
      isReversed: false,
    },
    {
      id: 'pay-3',
      companyId: 'comp-1',
      amount: '100000.00',
      currency: 'NGN',
      paymentDate: new Date('2026-06-20T12:00:00Z'),
      isReversed: true, // Should be ignored
    },
  ];

  const mockClients = [
    {
      id: 'cli-1',
      name: 'Dangote Industries Ltd',
      clientNumber: 'CLI-00001',
      creditLimit: '10000000.00',
      balance: '575000.00',
    },
    {
      id: 'cli-2',
      name: 'Julius Berger Nigeria Plc',
      clientNumber: 'CLI-00002',
      creditLimit: '25000000.00',
      balance: '0.00',
    },
  ];

  const mockWaybills = [
    {
      id: 'wb-1',
      deliveryStatus: 'DELIVERED',
      shipmentDate: new Date('2026-06-20T08:00:00Z'),
      receivedDate: new Date('2026-06-22T14:00:00Z'),
      document: { companyId: 'comp-1' },
    },
    {
      id: 'wb-2',
      deliveryStatus: 'IN_TRANSIT',
      shipmentDate: new Date('2026-06-25T08:00:00Z'),
      receivedDate: null,
      document: { companyId: 'comp-1' },
    },
  ];

  const mockApprovals = [
    {
      id: 'app-1',
      createdAt: new Date('2026-06-01T08:00:00Z'),
      actionDate: new Date('2026-06-01T12:00:00Z'), // 4 hours
      document: { companyId: 'comp-1' },
    },
  ];

  const mockPrisma: any = {
    document: {
      findMany: async () => mockDocuments,
    },
    payment: {
      findMany: async () => mockPayments.filter((p) => !p.isReversed),
    },
    client: {
      findMany: async () => mockClients,
    },
    waybill: {
      findMany: async () => mockWaybills,
    },
    documentApproval: {
      findMany: async () => mockApprovals,
    },
  };

  const reportsService = new ReportsService(mockPrisma);

  await t.test('calculates revenue, collections, recovery rate, and VAT correctly', async () => {
    const summary = await reportsService.getSummary('comp-1', {});

    // Invoiced total = 1075000 + 2150000 = 3225000
    assert.equal(summary.revenueAndCashflow.invoicedTotal, 3225000);
    // Collected total = 500000 + 2150000 = 2650000 (reversed excluded)
    assert.equal(summary.revenueAndCashflow.collectedTotal, 2650000);
    // Outstanding total = 575000 + 0 = 575000
    assert.equal(summary.revenueAndCashflow.outstandingTotal, 575000);
    // VAT Accrued = 75000 + 150000 = 225000
    assert.equal(summary.revenueAndCashflow.vatAccrued, 225000);
    // Recovery rate ~ 82.2%
    assert.ok(summary.revenueAndCashflow.recoveryRate > 80);
  });

  await t.test('computes aging receivables buckets', async () => {
    const summary = await reportsService.getSummary('comp-1', {});
    assert.ok(summary.agingReceivables);
    assert.equal(summary.agingReceivables.totalOverdue, 575000);
  });

  await t.test('ranks top client revenue and credit utilization', async () => {
    const summary = await reportsService.getSummary('comp-1', {});
    assert.equal(summary.topClients.length, 2);
    // Dangote has 1,075,000 invoiced, Julius Berger has 2,150,000 invoiced
    assert.equal(summary.topClients[0].name, 'Julius Berger Nigeria Plc');
    assert.equal(summary.topClients[1].name, 'Dangote Industries Ltd');
    assert.equal(summary.topClients[1].creditUtilization, 6); // 575,000 / 10,000,000 ~ 5.75% -> 6%
  });

  await t.test('calculates logistics telemetry and on-time rate', async () => {
    const summary = await reportsService.getSummary('comp-1', {});
    assert.equal(summary.logisticsTelemetry.totalConsignments, 2);
    assert.equal(summary.logisticsTelemetry.statusBreakdown.DELIVERED, 1);
    assert.equal(summary.logisticsTelemetry.statusBreakdown.IN_TRANSIT, 1);
    assert.equal(summary.logisticsTelemetry.onTimeDeliveryRate, 50);
  });

  await t.test('tracks document velocity and approval turnaround', async () => {
    const summary = await reportsService.getSummary('comp-1', {});
    assert.equal(summary.documentVelocity.totalDocuments, 3);
    assert.equal(summary.documentVelocity.byType.INVOICE, 2);
    assert.equal(summary.documentVelocity.byType.WAYBILL, 1);
    assert.equal(summary.documentVelocity.averageApprovalHours, 4.0);
  });
});
