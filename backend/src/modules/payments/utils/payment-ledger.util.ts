import Decimal from 'decimal.js';
import { InvoicePaymentStatus } from '@prisma/client';

export interface LedgerEntry {
  amount: Decimal.Value | { toString(): string };
  isReversed: boolean;
}

export interface LedgerSummary {
  invoiceTotal: Decimal;
  totalPaid: Decimal;
  /** Outstanding amount owed by the client. Never negative. */
  balanceDue: Decimal;
  /** Amount received in excess of the invoice total (credit owed to client). Never negative. */
  creditAmount: Decimal;
  paymentStatus: InvoicePaymentStatus;
}

export interface OverdueInfo {
  isOverdue: boolean;
  daysOverdue: number;
}

/**
 * Authoritative, side-effect-free derivation of invoice balances from the payment ledger.
 *
 * Rules (approved in Phase 0):
 *  - Only non-reversed payments count.
 *  - UNPAID: paid = 0; PARTIALLY_PAID: 0 < paid < total; PAID: paid = total; OVERPAID: paid > total.
 *  - The stored Document.balanceDue / Invoice.paymentStatus are caches of this calculation and are
 *    always rewritten from it inside the same transaction as the ledger mutation.
 */
export class PaymentLedgerUtil {
  static toDecimal(value: Decimal.Value | { toString(): string } | null | undefined): Decimal {
    if (value === null || value === undefined) return new Decimal(0);
    return new Decimal(value.toString());
  }

  static summarize(invoiceTotal: Decimal.Value | { toString(): string }, entries: LedgerEntry[]): LedgerSummary {
    const total = this.toDecimal(invoiceTotal);
    const totalPaid = entries
      .filter((e) => !e.isReversed)
      .reduce((sum, e) => sum.plus(this.toDecimal(e.amount)), new Decimal(0));

    const difference = total.minus(totalPaid);
    const balanceDue = Decimal.max(difference, 0);
    const creditAmount = Decimal.max(difference.negated(), 0);

    let paymentStatus: InvoicePaymentStatus;
    if (totalPaid.isZero()) {
      paymentStatus = InvoicePaymentStatus.UNPAID;
    } else if (totalPaid.lessThan(total)) {
      paymentStatus = InvoicePaymentStatus.PARTIALLY_PAID;
    } else if (totalPaid.equals(total)) {
      paymentStatus = InvoicePaymentStatus.PAID;
    } else {
      paymentStatus = InvoicePaymentStatus.OVERPAID;
    }

    return { invoiceTotal: total, totalPaid, balanceDue, creditAmount, paymentStatus };
  }

  /**
   * Overdue is derived, never stored: an invoice is overdue when it has an outstanding balance,
   * is in a payable state, and its due date (end of day) has passed.
   */
  static overdue(
    dueDate: Date | null | undefined,
    balanceDue: Decimal,
    isPayableState: boolean,
    now: Date = new Date(),
  ): OverdueInfo {
    if (!dueDate || !isPayableState || balanceDue.lessThanOrEqualTo(0)) {
      return { isOverdue: false, daysOverdue: 0 };
    }
    const endOfDueDay = new Date(dueDate);
    endOfDueDay.setHours(23, 59, 59, 999);
    if (now <= endOfDueDay) {
      return { isOverdue: false, daysOverdue: 0 };
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysOverdue = Math.ceil((now.getTime() - endOfDueDay.getTime()) / msPerDay);
    return { isOverdue: true, daysOverdue };
  }
}
