import Decimal from 'decimal.js';

// Configure Decimal.js with 20 decimal places and standard half-up commercial rounding
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawLineItem {
  quantity: number | string | Decimal;
  unitPrice: number | string | Decimal;
  discountPercent?: number | string | Decimal;
  taxRate?: number | string | Decimal;
}

export interface CalculatedLineItem {
  quantity: Decimal;
  unitPrice: Decimal;
  discountPercent: Decimal;
  taxRate: Decimal;
  grossAmount: Decimal;
  discountAmount: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
}

export interface CalculatedDocumentSummary {
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  balanceDue: Decimal;
  items: CalculatedLineItem[];
}

export class FinancialMathUtil {
  /**
   * Calculates precise line item financials: gross, discount, tax, and line total.
   */
  static calculateLineItem(item: RawLineItem): CalculatedLineItem {
    const qty = new Decimal(item.quantity ?? 0);
    const price = new Decimal(item.unitPrice ?? 0);
    const discountPct = new Decimal(item.discountPercent ?? 0);
    const taxPct = new Decimal(item.taxRate ?? 7.50);

    const gross = qty.times(price);
    const discount = gross.times(discountPct.dividedBy(100)).toDecimalPlaces(2);
    const taxable = gross.minus(discount);
    const tax = taxable.times(taxPct.dividedBy(100)).toDecimalPlaces(2);
    const total = taxable.plus(tax).toDecimalPlaces(2);

    return {
      quantity: qty,
      unitPrice: price.toDecimalPlaces(2),
      discountPercent: discountPct.toDecimalPlaces(2),
      taxRate: taxPct.toDecimalPlaces(2),
      grossAmount: gross.toDecimalPlaces(2),
      discountAmount: discount,
      taxableAmount: taxable.toDecimalPlaces(2),
      taxAmount: tax,
      lineTotal: total,
    };
  }

  /**
   * Calculates overall document financial summary from a list of items.
   */
  static calculateDocumentTotals(
    items: RawLineItem[],
    totalPaid: number | string | Decimal = 0,
  ): CalculatedDocumentSummary {
    const calculatedItems = items.map((item) => this.calculateLineItem(item));

    let grossSubtotal = new Decimal(0);
    let totalDiscount = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalAmount = new Decimal(0);

    for (const item of calculatedItems) {
      grossSubtotal = grossSubtotal.plus(item.grossAmount);
      totalDiscount = totalDiscount.plus(item.discountAmount);
      totalTax = totalTax.plus(item.taxAmount);
      totalAmount = totalAmount.plus(item.lineTotal);
    }

    const netSubtotal = grossSubtotal.minus(totalDiscount).toDecimalPlaces(2);
    const paid = new Decimal(totalPaid || 0).toDecimalPlaces(2);
    const balance = totalAmount.minus(paid).toDecimalPlaces(2);

    return {
      subtotal: netSubtotal,
      discountAmount: totalDiscount.toDecimalPlaces(2),
      taxAmount: totalTax.toDecimalPlaces(2),
      totalAmount: totalAmount.toDecimalPlaces(2),
      balanceDue: balance.isNegative() ? new Decimal(0) : balance,
      items: calculatedItems,
    };
  }
}
