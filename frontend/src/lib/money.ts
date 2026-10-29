import Decimal from 'decimal.js';

// Configure Decimal.js with 20 decimal places and standard half-up commercial rounding
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface LineInput {
  quantity: number | string | Decimal;
  unitPrice: number | string | Decimal;
  discountPercent?: number | string | Decimal | null;
  taxRate?: number | string | Decimal | null;
}

export interface LineResult {
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

export interface DocumentTotalsResult {
  subtotal: number;
  grossSubtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Calculates line financials mirroring backend FinancialMathUtil.calculateLineItem
 */
export function calcLine(
  qty: number | string | Decimal,
  unitPrice: number | string | Decimal,
  discountPct: number | string | Decimal = 0,
  taxRate: number | string | Decimal = 7.5,
): LineResult {
  const dQty = new Decimal(qty ?? 0);
  const dPrice = new Decimal(unitPrice ?? 0);
  const dDiscountPct = new Decimal(discountPct ?? 0);
  const dTaxPct = new Decimal(taxRate ?? 7.5);

  const gross = dQty.times(dPrice);
  const discount = gross.times(dDiscountPct.dividedBy(100)).toDecimalPlaces(2);
  const taxable = gross.minus(discount);
  const tax = taxable.times(dTaxPct.dividedBy(100)).toDecimalPlaces(2);
  const total = taxable.plus(tax).toDecimalPlaces(2);

  return {
    gross: gross.toDecimalPlaces(2).toNumber(),
    discount: discount.toNumber(),
    taxable: taxable.toDecimalPlaces(2).toNumber(),
    tax: tax.toNumber(),
    total: total.toNumber(),
  };
}

/**
 * Calculates overall document totals mirroring backend FinancialMathUtil.calculateDocumentTotals
 */
export function calcTotals(lines: LineInput[]): DocumentTotalsResult {
  let grossSubtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const line of lines) {
    const dQty = new Decimal(line.quantity ?? 0);
    const dPrice = new Decimal(line.unitPrice ?? 0);
    const dDiscountPct = new Decimal(line.discountPercent ?? 0);
    const dTaxPct = new Decimal(line.taxRate ?? 7.5);

    const gross = dQty.times(dPrice);
    const discount = gross.times(dDiscountPct.dividedBy(100)).toDecimalPlaces(2);
    const taxable = gross.minus(discount);
    const tax = taxable.times(dTaxPct.dividedBy(100)).toDecimalPlaces(2);
    const total = taxable.plus(tax).toDecimalPlaces(2);

    grossSubtotal = grossSubtotal.plus(gross.toDecimalPlaces(2));
    totalDiscount = totalDiscount.plus(discount);
    totalTax = totalTax.plus(tax);
    grandTotal = grandTotal.plus(total);
  }

  const subtotal = grossSubtotal.minus(totalDiscount).toDecimalPlaces(2);

  return {
    subtotal: subtotal.toNumber(),
    grossSubtotal: grossSubtotal.toDecimalPlaces(2).toNumber(),
    totalDiscount: totalDiscount.toDecimalPlaces(2).toNumber(),
    totalTax: totalTax.toDecimalPlaces(2).toNumber(),
    grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
  };
}
