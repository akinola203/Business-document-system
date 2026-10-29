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

  await t.test('handles null taxRate and null discountPercent gracefully without throwing', () => {
    const result = FinancialMathUtil.calculateLineItem({
      quantity: 10,
      unitPrice: 100,
      discountPercent: null as any,
      taxRate: null as any,
    });

    assert.equal(result.discountAmount.toString(), '0');
    assert.equal(result.taxRate.toString(), '7.5');
    assert.equal(result.lineTotal.toString(), '1075');
  });

  await t.test('10,000 random inputs parity between frontend money.ts and backend financial-math.util.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const ts = require('typescript');
    const moneyFile = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/lib/money.ts'), 'utf-8');
    const transpileResult = ts.transpileModule(moneyFile, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const moneyModule = { exports: {} as any };
    const fn = new Function('require', 'module', 'exports', transpileResult.outputText);
    fn(require, moneyModule, moneyModule.exports);
    const { calcLine, calcTotals } = moneyModule.exports;

    let seed = 42;
    function random() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    const testLines: Array<{ quantity: number; unitPrice: number; discountPercent: number; taxRate: number }> = [];

    for (let i = 0; i < 10000; i++) {
      const qty = Math.floor(random() * 500) + 1;
      const unitPrice = Math.round(random() * 100000 * 100) / 100;
      const discountPct = Math.round(random() * 30 * 10) / 10;
      const taxRate = random() > 0.3 ? 7.5 : random() > 0.5 ? 0 : 5;

      const be = FinancialMathUtil.calculateLineItem({
        quantity: qty,
        unitPrice,
        discountPercent: discountPct,
        taxRate,
      });

      const fe = calcLine(qty, unitPrice, discountPct, taxRate);

      assert.strictEqual(fe.gross, be.grossAmount.toNumber(), `Mismatch in gross at iteration ${i}`);
      assert.strictEqual(fe.discount, be.discountAmount.toNumber(), `Mismatch in discount at iteration ${i}`);
      assert.strictEqual(fe.taxable, be.taxableAmount.toNumber(), `Mismatch in taxable at iteration ${i}`);
      assert.strictEqual(fe.tax, be.taxAmount.toNumber(), `Mismatch in tax at iteration ${i}`);
      assert.strictEqual(fe.total, be.lineTotal.toNumber(), `Mismatch in total at iteration ${i}`);

      if (i < 50) {
        testLines.push({ quantity: qty, unitPrice, discountPercent: discountPct, taxRate });
      }
    }

    // Also test calcTotals multi-line parity
    const beTotals = FinancialMathUtil.calculateDocumentTotals(testLines);
    const feTotals = calcTotals(testLines);
    assert.strictEqual(feTotals.subtotal, beTotals.subtotal.toNumber());
    assert.strictEqual(feTotals.totalDiscount, beTotals.discountAmount.toNumber());
    assert.strictEqual(feTotals.totalTax, beTotals.taxAmount.toNumber());
    assert.strictEqual(feTotals.grandTotal, beTotals.totalAmount.toNumber());
  });
});

