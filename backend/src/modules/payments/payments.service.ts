import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { LedgerSummary, PaymentLedgerUtil } from './utils/payment-ledger.util';

/** Invoice document states in which money may be received against the invoice. */
const PAYABLE_STATUSES: DocumentStatus[] = [DocumentStatus.ISSUED];

const PAYMENT_INCLUDE = {
  recordedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  invoice: {
    select: {
      id: true,
      paymentStatus: true,
      document: {
        select: { id: true, documentNumber: true, title: true, currency: true, totalAmount: true, clientId: true },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // RECORD PAYMENT
  // ---------------------------------------------------------------------------

  /**
   * Records a payment against an ISSUED invoice.
   *
   * Transaction boundary: invoice row lock -> validations against the locked ledger -> payment number
   * allocation -> payment insert -> balance/status cache rewrite -> audit. All-or-nothing.
   * The notification is sent after commit so a notification failure cannot roll back money.
   */
  async recordPayment(companyId: string, documentId: string, dto: RecordPaymentDto, actorId: string) {
    const amount = new Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const paymentDate = new Date(dto.paymentDate);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (Number.isNaN(paymentDate.getTime()) || paymentDate > endOfToday) {
      throw new BadRequestException('Payment date cannot be in the future.');
    }

    const referenceNumber = dto.referenceNumber.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const invoiceId = await this.lockInvoiceForDocument(tx, companyId, documentId);

      // Re-read AFTER acquiring the lock so status and ledger cannot change underneath us.
      const document = await tx.document.findFirst({
        where: { id: documentId, companyId, documentType: DocumentType.INVOICE },
        include: { invoice: true },
      });
      if (!document || !document.invoice) {
        throw new NotFoundException(`Invoice with ID "${documentId}" not found.`);
      }

      if (!PAYABLE_STATUSES.includes(document.status)) {
        throw new BadRequestException(
          `Payments can only be recorded against ISSUED invoices. Current status is ${document.status}.`,
        );
      }
      if (document.isArchived) {
        throw new BadRequestException('Payments cannot be recorded against an archived invoice. Unarchive it first.');
      }

      const currency = (dto.currency ?? document.currency).toUpperCase();
      if (currency !== document.currency) {
        throw new BadRequestException(
          `Payment currency (${currency}) must match the invoice currency (${document.currency}). Cross-currency settlement is not supported in Release 1.`,
        );
      }

      const duplicate = await tx.payment.findFirst({
        where: {
          companyId,
          method: dto.method,
          isReversed: false,
          referenceNumber: { equals: referenceNumber, mode: 'insensitive' },
        },
        select: { paymentNumber: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `A ${dto.method} payment with reference "${referenceNumber}" is already recorded as ${duplicate.paymentNumber}. ` +
            'If that entry is wrong, reverse it first.',
        );
      }

      const activePayments = await tx.payment.findMany({
        where: { invoiceId, isReversed: false },
        select: { amount: true, isReversed: true },
      });
      const before = PaymentLedgerUtil.summarize(document.totalAmount, activePayments);

      if (amount.greaterThan(before.balanceDue) && !dto.acknowledgeOverpayment) {
        throw new BadRequestException(
          `Payment of ${currency} ${amount.toFixed(2)} exceeds the outstanding balance of ${currency} ${before.balanceDue.toFixed(2)}. ` +
            'Set acknowledgeOverpayment=true to record the excess as a client credit.',
        );
      }

      const paymentNumber = await this.allocatePaymentNumber(tx, companyId);

      const payment = await tx.payment.create({
        data: {
          companyId,
          invoiceId,
          paymentNumber,
          amount: amount.toFixed(2),
          currency,
          paymentDate,
          method: dto.method,
          referenceNumber,
          notes: dto.notes?.trim(),
          recordedById: actorId,
        },
      });

      const after = PaymentLedgerUtil.summarize(document.totalAmount, [
        ...activePayments,
        { amount, isReversed: false },
      ]);
      await this.writeLedgerCache(tx, document.id, invoiceId, after);

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'PAYMENT_RECORDED',
          entityType: 'Payment',
          entityId: payment.id,
          oldValues: { paymentStatus: before.paymentStatus, balanceDue: before.balanceDue.toFixed(2) },
          newValues: {
            paymentNumber,
            documentId: document.id,
            documentNumber: document.documentNumber,
            amount: amount.toFixed(2),
            currency,
            method: dto.method,
            referenceNumber,
            paymentStatus: after.paymentStatus,
            balanceDue: after.balanceDue.toFixed(2),
          },
        },
        tx,
      );

      if (after.creditAmount.greaterThan(0)) {
        await this.auditService.logAction(
          {
            companyId,
            actorId,
            action: 'PAYMENT_OVERPAYMENT_FLAGGED',
            entityType: 'Document',
            entityId: document.id,
            newValues: { paymentNumber, creditAmount: after.creditAmount.toFixed(2), currency },
          },
          tx,
        );
      }

      return { payment, document, after };
    });

    if (result.after.balanceDue.isZero()) {
      await this.notificationsService.createNotification(
        companyId,
        result.document.createdById,
        `Invoice Paid: ${result.document.documentNumber}`,
        `Invoice "${result.document.documentNumber}" has been fully settled (${result.after.paymentStatus}).`,
        'INVOICE_PAID',
        { documentId: result.document.id, paymentId: result.payment.id },
      );
    }

    this.logger.log(
      `Payment "${result.payment.paymentNumber}" (${result.payment.currency} ${result.payment.amount}) recorded against ` +
        `"${result.document.documentNumber}" by user "${actorId}". Status: ${result.after.paymentStatus}.`,
    );

    return { payment: result.payment, summary: this.serializeSummary(result.after) };
  }

  // ---------------------------------------------------------------------------
  // REVERSE PAYMENT
  // ---------------------------------------------------------------------------

  /**
   * Reverses (voids) a payment. The row is never deleted; it is flagged with actor, time and reason,
   * and the invoice balance/status is re-derived from the remaining active ledger.
   */
  async reversePayment(companyId: string, paymentId: string, dto: ReversePaymentDto, actorId: string) {
    const reason = dto.reason.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id: paymentId, companyId },
        select: { id: true, invoiceId: true },
      });
      if (!existing) {
        throw new NotFoundException(`Payment with ID "${paymentId}" not found.`);
      }

      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${existing.invoiceId} FOR UPDATE`;

      const payment = await tx.payment.findFirst({
        where: { id: paymentId, companyId },
        include: { invoice: { include: { document: true } } },
      });
      if (!payment) {
        throw new NotFoundException(`Payment with ID "${paymentId}" not found.`);
      }
      if (payment.isReversed) {
        throw new BadRequestException(`Payment "${payment.paymentNumber}" has already been reversed.`);
      }

      const document = payment.invoice.document;
      const activeBefore = await tx.payment.findMany({
        where: { invoiceId: payment.invoiceId, isReversed: false },
        select: { id: true, amount: true, isReversed: true },
      });
      const before = PaymentLedgerUtil.summarize(document.totalAmount, activeBefore);

      const reversed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversedById: actorId,
          reversalReason: reason,
        },
      });

      const after = PaymentLedgerUtil.summarize(
        document.totalAmount,
        activeBefore.filter((p) => p.id !== payment.id),
      );
      await this.writeLedgerCache(tx, document.id, payment.invoiceId, after);

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'PAYMENT_REVERSED',
          entityType: 'Payment',
          entityId: payment.id,
          oldValues: {
            isReversed: false,
            paymentStatus: before.paymentStatus,
            balanceDue: before.balanceDue.toFixed(2),
          },
          newValues: {
            isReversed: true,
            reason,
            paymentNumber: payment.paymentNumber,
            amount: payment.amount.toString(),
            documentNumber: document.documentNumber,
            paymentStatus: after.paymentStatus,
            balanceDue: after.balanceDue.toFixed(2),
          },
        },
        tx,
      );

      return { reversed, document, after };
    });

    this.logger.log(
      `Payment "${result.reversed.paymentNumber}" reversed by user "${actorId}". ` +
        `Invoice "${result.document.documentNumber}" is now ${result.after.paymentStatus}.`,
    );

    return { payment: result.reversed, summary: this.serializeSummary(result.after) };
  }

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  /** Full ledger (including reversed entries, for traceability) plus derived balance and overdue state. */
  async getInvoiceLedger(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId, documentType: DocumentType.INVOICE },
      include: {
        invoice: {
          include: {
            payments: {
              include: { recordedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
              orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!document || !document.invoice) {
      throw new NotFoundException(`Invoice with ID "${documentId}" not found.`);
    }

    const summary = PaymentLedgerUtil.summarize(document.totalAmount, document.invoice.payments);
    const overdue = PaymentLedgerUtil.overdue(
      document.dueDate,
      summary.balanceDue,
      PAYABLE_STATUSES.includes(document.status),
    );

    return {
      documentId: document.id,
      documentNumber: document.documentNumber,
      status: document.status,
      currency: document.currency,
      dueDate: document.dueDate,
      summary: { ...this.serializeSummary(summary), ...overdue },
      payments: document.invoice.payments,
    };
  }

  async findAll(companyId: string, query: QueryPaymentsDto) {
    const { page = 1, limit = 20, documentId, clientId, method, search, startDate, endDate, includeReversed } = query;

    const where: Prisma.PaymentWhereInput = {
      companyId,
      ...(includeReversed ? {} : { isReversed: false }),
      ...(method ? { method } : {}),
      ...(documentId || clientId
        ? {
            invoice: {
              ...(documentId ? { documentId } : {}),
              ...(clientId ? { document: { clientId } } : {}),
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            paymentDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { paymentNumber: { contains: search, mode: 'insensitive' } },
              { referenceNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(companyId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found.`);
    }
    return payment;
  }

  // ---------------------------------------------------------------------------
  // INTERNAL HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Resolves the Invoice row for a document and takes a row-level lock on it (SELECT ... FOR UPDATE).
   * Every ledger mutation for the same invoice is serialized through this lock, which prevents two
   * concurrent payments from both passing the overpayment check against the same stale balance.
   */
  private async lockInvoiceForDocument(
    tx: Prisma.TransactionClient,
    companyId: string,
    documentId: string,
  ): Promise<string> {
    const invoice = await tx.invoice.findFirst({
      where: { documentId, document: { companyId, documentType: DocumentType.INVOICE } },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${documentId}" not found.`);
    }
    await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoice.id} FOR UPDATE`;
    return invoice.id;
  }

  /**
   * Allocates PAY-YYYY-NNNNNN with a single atomic INSERT ... ON CONFLICT DO UPDATE statement, so
   * concurrent first-of-year allocations cannot collide or abort the surrounding transaction.
   */
  private async allocatePaymentNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await tx.$queryRaw<Array<{ prefix: string; currentNumber: number; padding: number }>>`
      INSERT INTO "payment_number_sequences" ("id", "companyId", "resetYear", "currentNumber", "updatedAt")
      VALUES (gen_random_uuid()::text, ${companyId}, ${year}, 1, NOW())
      ON CONFLICT ("companyId", "resetYear")
      DO UPDATE SET "currentNumber" = "payment_number_sequences"."currentNumber" + 1, "updatedAt" = NOW()
      RETURNING "prefix", "currentNumber", "padding"`;

    const seq = rows[0];
    if (!seq) {
      throw new Error('Payment number allocation returned no row.');
    }
    return `${seq.prefix}-${year}-${String(seq.currentNumber).padStart(seq.padding, '0')}`;
  }

  /** Rewrites the cached balance/status fields from the authoritative ledger summary. */
  private async writeLedgerCache(
    tx: Prisma.TransactionClient,
    documentId: string,
    invoiceId: string,
    summary: LedgerSummary,
  ) {
    await tx.document.update({
      where: { id: documentId },
      data: { balanceDue: summary.balanceDue.toFixed(2) },
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paymentStatus: summary.paymentStatus },
    });
  }

  private serializeSummary(summary: LedgerSummary) {
    return {
      invoiceTotal: summary.invoiceTotal.toFixed(2),
      totalPaid: summary.totalPaid.toFixed(2),
      balanceDue: summary.balanceDue.toFixed(2),
      creditAmount: summary.creditAmount.toFixed(2),
      paymentStatus: summary.paymentStatus,
    };
  }
}
