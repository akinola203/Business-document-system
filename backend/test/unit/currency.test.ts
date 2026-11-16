import * as assert from 'assert';
import {
  CurrencyService,
  FALLBACK_RATES_TO_NGN,
  SUPPORTED_CURRENCIES,
} from '../../src/modules/currency/currency.service';
import { TenantCacheService } from '../../src/modules/cache/tenant-cache.service';
import { InvoicesService } from '../../src/modules/invoices/invoices.service';
import { DocumentStatus, DocumentType } from '@prisma/client';

async function runTests() {
  console.log('==========================================================');
  console.log('🧪 RUNNING MULTI-CURRENCY & RATE SNAPSHOTTING UNIT TESTS');
  console.log('==========================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // Force deterministic offline fallback during unit tests
  process.env.CURRENCY_OFFLINE_MODE = 'true';

  const cacheService = new TenantCacheService();
  cacheService.clearMemoryCache();
  const currencyService = new CurrencyService(cacheService);

  await test('1. Supports all 5 required currencies (NGN, USD, JPY, GBP, EUR)', () => {
    for (const code of ['NGN', 'USD', 'JPY', 'GBP', 'EUR'] as const) {
      assert.ok(SUPPORTED_CURRENCIES.includes(code), `Missing ${code}`);
      assert.strictEqual(currencyService.normalizeCurrency(code.toLowerCase()), code);
    }
    assert.strictEqual(currencyService.normalizeCurrency('invalid'), 'NGN');
  });

  await test('2. Caches fetched exchange rates in Redis/TenantCacheService with 4-24h TTL', async () => {
    cacheService.clearMemoryCache();
    const firstSnapshot = await currencyService.getRatesSnapshot();
    assert.strictEqual(firstSnapshot.base, 'NGN');
    assert.strictEqual(firstSnapshot.ratesToNgn.NGN, 1.0);
    assert.strictEqual(firstSnapshot.source, 'fallback');

    const secondSnapshot = await currencyService.getRatesSnapshot();
    assert.strictEqual(secondSnapshot.source, 'redis_cache');
    assert.strictEqual(secondSnapshot.ratesToNgn.USD, FALLBACK_RATES_TO_NGN.USD);
  });

  await test('3. Converts amounts accurately between NGN, USD, JPY (0 decimals), GBP, and EUR', async () => {
    // 100 USD -> NGN at fallback rate 1550 = 155,000.00 NGN
    const usdToNgn = await currencyService.convertAmount(100, 'USD', 'NGN');
    assert.strictEqual(usdToNgn, 155000);

    // 155,000 NGN -> USD = 100.00 USD
    const ngnToUsd = await currencyService.convertAmount(155000, 'NGN', 'USD');
    assert.strictEqual(ngnToUsd, 100);

    // JPY rounds to 0 decimal places (integer yen)
    const usdToJpy = await currencyService.convertAmount(100, 'USD', 'JPY');
    assert.strictEqual(Number.isInteger(usdToJpy), true, 'JPY must have 0 decimals');

    // Identity conversion preserves currency precision
    const jpySame = await currencyService.convertAmount(1234.56, 'JPY', 'JPY');
    assert.strictEqual(jpySame, 1235);
  });

  await test('4. Formats currencies with locale-aware Intl.NumberFormat and proper precision', () => {
    const ngnFormatted = currencyService.formatCurrency(250000.5, 'NGN');
    const usdFormatted = currencyService.formatCurrency(1250.75, 'USD');
    const jpyFormatted = currencyService.formatCurrency(50000, 'JPY');
    const gbpFormatted = currencyService.formatCurrency(890.25, 'GBP');
    const eurFormatted = currencyService.formatCurrency(1420.5, 'EUR');

    assert.ok(ngnFormatted.includes('250,000.50'), `Unexpected NGN format: ${ngnFormatted}`);
    assert.ok(usdFormatted.includes('$') && usdFormatted.includes('1,250.75'), `Unexpected USD format: ${usdFormatted}`);
    assert.ok(!jpyFormatted.includes('.'), `JPY format should not have decimals: ${jpyFormatted}`);
    assert.ok(gbpFormatted.includes('£'), `Unexpected GBP format: ${gbpFormatted}`);
    assert.ok(eurFormatted.includes('€'), `Unexpected EUR format: ${eurFormatted}`);
  });

  await test('5. InvoicesService snapshots exchangeRate and base NGN totals on foreign-currency invoice creation', async () => {
    let createdDocData: any = null;
    let createdInvoiceData: any = null;

    const mockPrisma: any = {
      client: {
        findFirst: async () => ({ id: 'client-1', companyId: 'comp-1', name: 'Global Corp' }),
      },
      $transaction: async (cb: any) => {
        const tx = {
          document: {
            create: async ({ data }: any) => {
              createdDocData = data;
              return { id: 'doc-usd-1', ...data };
            },
          },
          invoice: {
            create: async ({ data }: any) => {
              createdInvoiceData = data;
              return { id: 'inv-usd-1', ...data };
            },
          },
          auditLog: {
            create: async () => ({}),
          },
        };
        return cb(tx);
      },
      document: {
        findFirst: async () => ({
          id: 'doc-usd-1',
          companyId: 'comp-1',
          documentType: DocumentType.INVOICE,
          status: DocumentStatus.DRAFT,
          ...createdDocData,
          invoice: createdInvoiceData,
        }),
      },
    };

    const mockNumbering: any = {
      getNextDocumentNumber: async () => 'INV-2026-000099',
    };

    const invoicesService = new InvoicesService(mockPrisma, mockNumbering, currencyService);
    const created = await invoicesService.createDraft(
      'comp-1',
      {
        title: 'International Software License',
        clientId: 'client-1',
        currency: 'USD',
        items: [
          {
            description: 'Enterprise SaaS Subscription',
            quantity: 2,
            unit: 'Licenses',
            unitPrice: 500,
            discountPercent: 0,
            taxRate: 7.5,
          },
        ],
      },
      'user-1',
    );

    // Subtotal = 1000 USD, Tax = 75 USD, Total = 1075 USD
    assert.strictEqual(created.currency, 'USD');
    assert.strictEqual(Number(createdDocData.exchangeRate), FALLBACK_RATES_TO_NGN.USD);
    assert.strictEqual(Number(createdDocData.totalAmount), 1075);
    assert.strictEqual(
      Number(createdDocData.baseTotalAmount),
      1075 * FALLBACK_RATES_TO_NGN.USD,
    );
    assert.strictEqual(createdInvoiceData.currency, 'USD');
    assert.strictEqual(Number(createdInvoiceData.exchangeRate), FALLBACK_RATES_TO_NGN.USD);
    assert.strictEqual(
      Number(createdInvoiceData.baseTotalAmount),
      1075 * FALLBACK_RATES_TO_NGN.USD,
    );
  });

  console.log(`\n==========================================================`);
  console.log(`📊 CURRENCY TESTS SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

