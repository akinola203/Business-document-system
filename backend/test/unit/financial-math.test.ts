import { test } from 'node:test';
import * as assert from 'node:assert';
import { FinancialMathUtil } from '../../src/modules/documents/utils/financial-math.util';

test('FinancialMathUtil Authoritative Math Tests', async (t) => {
  await t.test('calculates line item gross, discount, tax, and line total correctly', () => {
    // 100 bags @ 8,500 = 850,000 gross. 10% discount = 85,000. Taxable = 765,000. 7.5% VAT = 57,375. Total = 822,375.
    const result = FinancialMathUtil.calculateLineItem({
      quantity: 100,
      unitPrice: 8500,
      discountPercent: 10,
      taxRate: 7.5,
    });

    assert.equal(result.grossAmount.toString(), '850000');
    assert.equal(result.discountAmount.toString(), '85000');
    assert.equal(result.taxableAmount.toString(), '765000');
    assert.equal(result.taxAmount.toString(), '57375');
    assert.equal(result.lineTotal.toString(), '822375');
  });

  await t.test('calculates multi-line document summary with VAT and net balances', () => {
    const items = [
      { quantity: 50, unitPrice: 10000, discountPercent: 0, taxRate: 7.5 }, // 500,000 + 37,500 = 537,500
      { quantity: 20, unitPrice: 5000, discountPercent: 5, taxRate: 7.5 },  // 100,000 - 5,000 = 95,000 + 7,125 = 102,125
    ];

    const summary = FinancialMathUtil.calculateDocumentTotals(items, 200000); // 200,000 partial payment

    // Net subtotal: 500,000 + 95,000 = 595,000
    assert.equal(summary.subtotal.toString(), '595000');
    assert.equal(summary.discountAmount.toString(), '5000');
    // Total VAT: 37,500 + 7,125 = 44,625
    assert.equal(summary.taxAmount.toString(), '44625');
    // Total: 595,000 + 44,625 = 639,625
    assert.equal(summary.totalAmount.toString(), '639625');
    // Balance due: 639,625 - 200,000 = 439,625
    assert.equal(summary.balanceDue.toString(), '439625');
  });
});
