import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, InvoicePaymentStatus, PaymentMethod } from '@prisma/client';
import Decimal from 'decimal.js';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { PaymentLedgerUtil } from '../../src/modules/payments/utils/payment-ledger.util';

test('PaymentLedgerUtil Authoritative Math Tests', async (t) => {
  await t.test('summarizes empty ledger as UNPAID with full balance due', () => {
    const summary = PaymentLedgerUtil.summarize('500000.00', []);
    assert.equal(summary.invoiceTotal.toFixed(2), '500000.00');
    assert.equal(summary.totalPaid.toFixed(2), '0.00');
    assert.equal(summary.balanceDue.toFixed(2), '500000.00');
    assert.equal(summary.creditAmount.toFixed(2), '0.00');
    assert.equal(summary.paymentStatus, InvoicePaymentStatus.UNPAID);
  });

  await t.test('summarizes partial payments as PARTIALLY_PAID with correct balance due', () => {
    const entries = [
      { amount: new Decimal('150000.00'), isReversed: false },
      { amount: new Decimal('50000.00'), isReversed: true }, // Reversed - ignored
      { amount: new Decimal('100000.00'), isReversed: false },
    ];
    const summary = PaymentLedgerUtil.summarize('500000.00', entries);
    assert.equal(summary.invoiceTotal.toFixed(2), '500000.00');
    assert.equal(summary.totalPaid.toFixed(2), '250000.00');
    assert.equal(summary.balanceDue.toFixed(2), '250000.00');
    assert.equal(summary.creditAmount.toFixed(2), '0.00');
    assert.equal(summary.paymentStatus, InvoicePaymentStatus.PARTIALLY_PAID);
  });

  await t.test('summarizes exact full settlement as PAID with zero balance due', () => {
    const entries = [
      { amount: new Decimal('250000.00'), isReversed: false },
      { amount: new Decimal('250000.00'), isReversed: false },
    ];
    const summary = PaymentLedgerUtil.summarize('500000.00', entries);
    assert.equal(summary.totalPaid.toFixed(2), '500000.00');
    assert.equal(summary.balanceDue.toFixed(2), '0.00');
    assert.equal(summary.creditAmount.toFixed(2), '0.00');
    assert.equal(summary.paymentStatus, InvoicePaymentStatus.PAID);
  });

  await t.test('summarizes excess payment as OVERPAID with client credit', () => {
    const entries = [{ amount: new Decimal('550000.00'), isReversed: false }];
    const summary = PaymentLedgerUtil.summarize('500000.00', entries);
    assert.equal(summary.totalPaid.toFixed(2), '550000.00');
    assert.equal(summary.balanceDue.toFixed(2), '0.00');
    assert.equal(summary.creditAmount.toFixed(2), '50000.00');
    assert.equal(summary.paymentStatus, InvoicePaymentStatus.OVERPAID);
  });

  await t.test('derives overdue status dynamically without storing an overdue flag', () => {
    const pastDate = new Date('2026-01-01');
    const futureDate = new Date('2026-12-31');
    const referenceNow = new Date('2026-06-01T12:00:00Z');

    // Overdue: past due date + positive balance + payable state
    const res1 = PaymentLedgerUtil.overdue(pastDate, new Decimal('1000.00'), true, referenceNow);
    assert.equal(res1.isOverdue, true);
    assert.ok(res1.daysOverdue > 0);

    // Not overdue: future due date
    const res2 = PaymentLedgerUtil.overdue(futureDate, new Decimal('1000.00'), true, referenceNow);
    assert.equal(res2.isOverdue, false);
    assert.equal(res2.daysOverdue, 0);

    // Not overdue: zero balance
    const res3 = PaymentLedgerUtil.overdue(pastDate, new Decimal('0.00'), true, referenceNow);
    assert.equal(res3.isOverdue, false);

    // Not overdue: non-payable state (e.g. DRAFT or CANCELLED)
    const res4 = PaymentLedgerUtil.overdue(pastDate, new Decimal('1000.00'), false, referenceNow);
    assert.equal(res4.isOverdue, false);
  });
});

test('PaymentsService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
  let invoicesDb: any[] = [];
  let paymentsDb: any[] = [];
  let auditLogs: any[] = [];
  let notifications: any[] = [];
  let seqCounter = 0;

  function resetDb() {
    seqCounter = 0;
    auditLogs = [];
    notifications = [];
    documentsDb = [
      {
        id: 'doc-inv-1',
        companyId: 'comp-1',
        documentNumber: 'INV-2026-000001',
        documentType: DocumentType.INVOICE,
        title: 'Hardware Procurement',
        status: DocumentStatus.ISSUED,
        isArchived: false,
        currency: 'NGN',
        subtotal: '400000.00',
        taxAmount: '30000.00',
        discountAmount: '0.00',
        totalAmount: '430000.00',
        balanceDue: '430000.00',
        createdById: 'usr-staff-1',
        dueDate: new Date('2026-11-30'),
      },
      {
        id: 'doc-inv-draft',
        companyId: 'comp-1',
        documentNumber: 'INV-2026-000002',
        documentType: DocumentType.INVOICE,
        title: 'Draft Invoice',
        status: DocumentStatus.DRAFT,
        isArchived: false,
        currency: 'NGN',
        totalAmount: '100000.00',
        balanceDue: '100000.00',
        createdById: 'usr-staff-1',
      },
      {
        id: 'doc-inv-archived',
        companyId: 'comp-1',
        documentNumber: 'INV-2026-000003',
        documentType: DocumentType.INVOICE,
        title: 'Archived Invoice',
        status: DocumentStatus.ISSUED,
        isArchived: true,
        currency: 'NGN',
        totalAmount: '200000.00',
        balanceDue: '200000.00',
        createdById: 'usr-staff-1',
      },
    ];

    invoicesDb = [
      {
        id: 'inv-row-1',
        documentId: 'doc-inv-1',
        paymentStatus: InvoicePaymentStatus.UNPAID,
      },
      {
        id: 'inv-row-draft',
        documentId: 'doc-inv-draft',
        paymentStatus: InvoicePaymentStatus.UNPAID,
      },
      {
        id: 'inv-row-archived',
        documentId: 'doc-inv-archived',
        paymentStatus: InvoicePaymentStatus.UNPAID,
      },
    ];

    paymentsDb = [];
  }

  resetDb();

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find(
          (d) =>
            d.id === where.id &&
            d.companyId === where.companyId &&
            (!where.documentType || d.documentType === where.documentType),
        );
        if (!doc) return null;
        const inv = invoicesDb.find((i) => i.documentId === doc.id);
        return {
          ...doc,
          invoice: inv
            ? {
                ...inv,
                payments: paymentsDb.filter((p) => p.invoiceId === inv.id),
              }
            : null,
        };
      },
      update: async ({ where, data }: any) => {
        const idx = documentsDb.findIndex((d) => d.id === where.id);
        documentsDb[idx] = { ...documentsDb[idx], ...data };
        return documentsDb[idx];
      },
    },
    invoice: {
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find((d) => d.id === where.documentId && d.companyId === where.document?.companyId);
        if (!doc) return null;
        const inv = invoicesDb.find((i) => i.documentId === doc.id);
        return inv ? { id: inv.id } : null;
      },
      update: async ({ where, data }: any) => {
        const idx = invoicesDb.findIndex((i) => i.id === where.id);
        invoicesDb[idx] = { ...invoicesDb[idx], ...data };
        return invoicesDb[idx];
      },
    },
    payment: {
      findFirst: async ({ where }: any) => {
        const item = paymentsDb.find((p) => {
          if (where.id && p.id !== where.id) return false;
          if (where.companyId && p.companyId !== where.companyId) return false;
          if (where.isReversed !== undefined && p.isReversed !== where.isReversed) return false;
          if (where.method && p.method !== where.method) return false;
          if (where.referenceNumber) {
            const searchRef = where.referenceNumber.equals || where.referenceNumber;
            if (p.referenceNumber.toLowerCase() !== searchRef.toLowerCase()) return false;
          }
          return true;
        });
        if (!item) return null;
        const inv = invoicesDb.find((i) => i.id === item.invoiceId);
        const doc = documentsDb.find((d) => d.id === inv?.documentId);
        return {
          ...item,
          invoice: inv ? { ...inv, document: doc } : null,
          recordedBy: { id: item.recordedById, firstName: 'Finance', lastName: 'Officer', email: 'finance@dola.ng' },
        };
      },
      findMany: async ({ where }: any) => {
        return paymentsDb
          .filter((p) => {
            if (where.invoiceId && p.invoiceId !== where.invoiceId) return false;
            if (where.companyId && p.companyId !== where.companyId) return false;
            if (where.isReversed !== undefined && p.isReversed !== where.isReversed) return false;
            return true;
          })
          .map((item) => ({
            ...item,
            recordedBy: { id: item.recordedById, firstName: 'Finance', lastName: 'Officer', email: 'finance@dola.ng' },
          }));
      },
      create: async ({ data }: any) => {
        const item = { id: `pmt-${paymentsDb.length + 1}`, createdAt: new Date(), ...data, isReversed: false };
        paymentsDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = paymentsDb.findIndex((p) => p.id === where.id);
        paymentsDb[idx] = { ...paymentsDb[idx], ...data };
        return paymentsDb[idx];
      },
      count: async () => paymentsDb.length,
    },
    $queryRaw: async (query: any) => {
      const sqlText = Array.isArray(query) ? query.join(' ') : query?.strings ? query.strings.join(' ') : String(query);
      if (sqlText.includes('payment_number_sequences')) {
        seqCounter += 1;
        return [{ prefix: 'PAY', currentNumber: seqCounter, padding: 6 }];
      }
      return [{ id: 'inv-row-1' }];
    },
    $transaction: async (fn: any) => fn(mockPrisma),
  };

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogs.push(entry);
    },
  };

  const mockNotificationsService: any = {
    createNotification: async (
      companyId: string,
      userId: string,
      title: string,
      message: string,
      type: string,
      metadata: any,
    ) => {
      notifications.push({ companyId, userId, title, message, type, metadata });
    },
  };

  const service = new PaymentsService(mockPrisma, mockAuditService, mockNotificationsService);

  await t.test('rejects payment with zero or negative amount', async () => {
    resetDb();
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-1',
          {
            amount: '0.00',
            paymentDate: '2026-10-25',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'TRF-001',
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('rejects payment with future date', async () => {
    resetDb();
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-1',
          {
            amount: '50000.00',
            paymentDate: '2099-01-01',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'TRF-001',
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('rejects payment against non-ISSUED (DRAFT) invoice', async () => {
    resetDb();
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-draft',
          {
            amount: '50000.00',
            paymentDate: '2026-10-25',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'TRF-001',
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('rejects payment against archived invoice', async () => {
    resetDb();
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-archived',
          {
            amount: '50000.00',
            paymentDate: '2026-10-25',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'TRF-001',
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('rejects currency mismatch', async () => {
    resetDb();
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-1',
          {
            amount: '500.00',
            currency: 'USD', // Invoice is NGN
            paymentDate: '2026-10-25',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'TRF-001',
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('records valid partial payment, updates balanceDue and logs audit', async () => {
    resetDb();
    const result = await service.recordPayment(
      'comp-1',
      'doc-inv-1',
      {
        amount: '200000.00',
        paymentDate: '2026-10-25',
        method: PaymentMethod.BANK_TRANSFER,
        referenceNumber: 'ZEN-TRF-100234',
        notes: 'Deposit tranche 1',
      },
      'usr-finance',
    );

    assert.equal(result.payment.paymentNumber, `PAY-${new Date().getFullYear()}-000001`);
    assert.equal(result.summary.paymentStatus, InvoicePaymentStatus.PARTIALLY_PAID);
    assert.equal(result.summary.totalPaid, '200000.00');
    assert.equal(result.summary.balanceDue, '230000.00');
    assert.equal(result.summary.creditAmount, '0.00');

    // DB state updated
    const doc = documentsDb.find((d) => d.id === 'doc-inv-1');
    assert.equal(doc.balanceDue, '230000.00');
    const inv = invoicesDb.find((i) => i.documentId === 'doc-inv-1');
    assert.equal(inv.paymentStatus, InvoicePaymentStatus.PARTIALLY_PAID);

    // Audit logged
    const audit = auditLogs.find((a) => a.action === 'PAYMENT_RECORDED');
    assert.ok(audit);
    assert.equal(audit.newValues.paymentNumber, result.payment.paymentNumber);
    assert.equal(audit.newValues.amount, '200000.00');

    // No notification for partial payment
    assert.equal(notifications.length, 0);
  });

  await t.test('rejects duplicate bank reference on the same payment method', async () => {
    // Attempt to record payment with same reference ZEN-TRF-100234
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-1',
          {
            amount: '30000.00',
            paymentDate: '2026-10-25',
            method: PaymentMethod.BANK_TRANSFER,
            referenceNumber: 'zen-trf-100234', // Case-insensitive check
          },
          'usr-finance',
        ),
      ConflictException,
    );
  });

  await t.test('rejects overpayment when acknowledgeOverpayment is false', async () => {
    // Current balance due is 230,000. Attempt 250,000 without flag
    await assert.rejects(
      async () =>
        service.recordPayment(
          'comp-1',
          'doc-inv-1',
          {
            amount: '250000.00',
            paymentDate: '2026-10-26',
            method: PaymentMethod.CHEQUE,
            referenceNumber: 'CHQ-998811',
            acknowledgeOverpayment: false,
          },
          'usr-finance',
        ),
      BadRequestException,
    );
  });

  await t.test('settles invoice fully (PAID) and fires INVOICE_PAID notification', async () => {
    // Exactly 230,000 remaining
    const result = await service.recordPayment(
      'comp-1',
      'doc-inv-1',
      {
        amount: '230000.00',
        paymentDate: '2026-10-26',
        method: PaymentMethod.BANK_TRANSFER,
        referenceNumber: 'ZEN-TRF-100235',
      },
      'usr-finance',
    );

    assert.equal(result.summary.paymentStatus, InvoicePaymentStatus.PAID);
    assert.equal(result.summary.totalPaid, '430000.00');
    assert.equal(result.summary.balanceDue, '0.00');

    // Notification emitted to invoice creator
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'INVOICE_PAID');
    assert.equal(notifications[0].userId, 'usr-staff-1');
  });

  await t.test('allows overpayment when acknowledgeOverpayment=true and flags client credit', async () => {
    // Invoice is currently PAID (balance = 0). Add 10,000 with acknowledgeOverpayment=true
    const result = await service.recordPayment(
      'comp-1',
      'doc-inv-1',
      {
        amount: '10000.00',
        paymentDate: '2026-10-26',
        method: PaymentMethod.CARD,
        referenceNumber: 'POS-REC-4411',
        acknowledgeOverpayment: true,
      },
      'usr-finance',
    );

    assert.equal(result.summary.paymentStatus, InvoicePaymentStatus.OVERPAID);
    assert.equal(result.summary.totalPaid, '440000.00');
    assert.equal(result.summary.balanceDue, '0.00');
    assert.equal(result.summary.creditAmount, '10000.00');

    const flagAudit = auditLogs.find((a) => a.action === 'PAYMENT_OVERPAYMENT_FLAGGED');
    assert.ok(flagAudit);
    assert.equal(flagAudit.newValues.creditAmount, '10000.00');
  });

  await t.test('reverses a payment, re-derives invoice ledger, and never deletes the row', async () => {
    const paymentToReverse = paymentsDb.find((p) => p.referenceNumber === 'POS-REC-4411');
    assert.ok(paymentToReverse);

    const reversedResult = await service.reversePayment(
      'comp-1',
      paymentToReverse.id,
      { reason: 'Customer accidentally tapped card twice' },
      'usr-manager',
    );

    // Payment row is marked isReversed=true, NOT deleted
    assert.equal(reversedResult.payment.isReversed, true);
    assert.equal(reversedResult.payment.reversalReason, 'Customer accidentally tapped card twice');
    assert.ok(reversedResult.payment.reversedAt);

    // Invoice status re-derived from remaining active payments (reverts to PAID from OVERPAID)
    assert.equal(reversedResult.summary.paymentStatus, InvoicePaymentStatus.PAID);
    assert.equal(reversedResult.summary.totalPaid, '430000.00');
    assert.equal(reversedResult.summary.balanceDue, '0.00');
    assert.equal(reversedResult.summary.creditAmount, '0.00');

    const revAudit = auditLogs.find((a) => a.action === 'PAYMENT_REVERSED');
    assert.ok(revAudit);
    assert.equal(revAudit.newValues.reason, 'Customer accidentally tapped card twice');

    // Attempting to reverse again throws BadRequestException
    await assert.rejects(
      async () =>
        service.reversePayment(
          'comp-1',
          paymentToReverse.id,
          { reason: 'Second attempt' },
          'usr-manager',
        ),
      BadRequestException,
    );
  });

  await t.test('retrieves full invoice ledger with overdue state and all transactions', async () => {
    const ledger = await service.getInvoiceLedger('comp-1', 'doc-inv-1');
    assert.equal(ledger.documentNumber, 'INV-2026-000001');
    assert.equal(ledger.payments.length, 3); // 2 active, 1 reversed
    assert.equal(ledger.summary.paymentStatus, InvoicePaymentStatus.PAID);
    assert.equal(ledger.summary.isOverdue, false);
  });
});
