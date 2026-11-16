import { Injectable, Logger, Optional } from '@nestjs/common';
import Decimal from 'decimal.js';
import { TenantCacheService } from '../cache/tenant-cache.service';

export type SupportedCurrency = 'NGN' | 'USD' | 'JPY' | 'GBP' | 'EUR';

export interface CurrencyConfig {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  locale: string;
  decimals: number;
}

export interface ExchangeRatesSnapshot {
  base: 'NGN';
  /**
   * Value in NGN for 1 unit of each currency (e.g. USD: 1352.36 means 1 USD = 1352.36 NGN).
   */
  ratesToNgn: Record<SupportedCurrency, number>;
  /**
   * Value in foreign currency for 1 NGN (e.g. USD: 0.00073945).
   */
  ratesFromNgn: Record<SupportedCurrency, number>;
  source: 'live_api' | 'redis_cache' | 'fallback';
  fetchedAt: string;
}

export const CURRENCY_METADATA: Record<SupportedCurrency, CurrencyConfig> = {
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    locale: 'en-NG',
    decimals: 2,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    locale: 'en-US',
    decimals: 2,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    locale: 'ja-JP',
    decimals: 0,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    locale: 'en-GB',
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    locale: 'de-DE',
    decimals: 2,
  },
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  'NGN',
  'USD',
  'JPY',
  'GBP',
  'EUR',
];

/**
 * Deterministic fallback rates (1 unit of currency in NGN) used when offline or in air-gapped CI.
 */
export const FALLBACK_RATES_TO_NGN: Record<SupportedCurrency, number> = {
  NGN: 1.0,
  USD: 1550.0,
  EUR: 1680.0,
  GBP: 1960.0,
  JPY: 10.25,
};

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  public static readonly CACHE_NAMESPACE = 'currency:exchange-rates';
  public static readonly CACHE_SUBKEY = 'ngn-base-v1';

  /**
   * Default 12 hours (43,200 seconds) — within the 4 to 24-hour Redis caching window.
   */
  private readonly cacheTtlSeconds: number;
  private readonly apiEndpoint: string;
  private readonly cacheService: TenantCacheService;

  constructor(@Optional() cacheService?: TenantCacheService) {
    this.cacheService = cacheService ?? new TenantCacheService();
    const configuredTtl = Number(process.env.CURRENCY_CACHE_TTL_SECONDS);
    this.cacheTtlSeconds =
      Number.isFinite(configuredTtl) && configuredTtl >= 14400 && configuredTtl <= 86400
        ? configuredTtl
        : 43200; // 12 hours default
    this.apiEndpoint =
      process.env.EXCHANGE_RATE_API_URL?.trim() ||
      'https://open.er-api.com/v6/latest/NGN';
  }

  public normalizeCurrency(currency?: string | null): SupportedCurrency {
    const upper = (currency || 'NGN').trim().toUpperCase();
    if ((SUPPORTED_CURRENCIES as string[]).includes(upper)) {
      return upper as SupportedCurrency;
    }
    return 'NGN';
  }

  public getCurrencyMetadata(currency?: string | null): CurrencyConfig {
    return CURRENCY_METADATA[this.normalizeCurrency(currency)];
  }

  /**
   * Retrieves daily exchange rates relative to NGN, backed by Redis caching (4-24h TTL).
   */
  public async getRatesSnapshot(forceRefresh = false): Promise<ExchangeRatesSnapshot> {
    const cacheKey = this.cacheService.buildGlobalKey(
      CurrencyService.CACHE_NAMESPACE,
      CurrencyService.CACHE_SUBKEY,
    );

    if (!forceRefresh) {
      const cached = await this.cacheService.get<ExchangeRatesSnapshot>(cacheKey);
      if (cached && cached.ratesToNgn && cached.ratesToNgn.NGN === 1) {
        return {
          ...cached,
          source: 'redis_cache',
        };
      }
    }

    const freshSnapshot = await this.fetchLiveRatesWithFallback();
    await this.cacheService.set(cacheKey, freshSnapshot, this.cacheTtlSeconds);
    return freshSnapshot;
  }

  /**
   * Returns the exchange rate relative to NGN for 1 unit of `currency`
   * (e.g., 1 USD -> ~1550 NGN, 1 NGN -> 1.0 NGN).
   */
  public async getExchangeRateToNgn(currency: string): Promise<number> {
    const normalized = this.normalizeCurrency(currency);
    if (normalized === 'NGN') {
      return 1.0;
    }

    const snapshot = await this.getRatesSnapshot();
    const rate = snapshot.ratesToNgn[normalized];
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      return FALLBACK_RATES_TO_NGN[normalized] ?? 1.0;
    }
    return Number(new Decimal(rate).toFixed(6));
  }

  /**
   * Returns the conversion multiplier from `from` currency to `to` currency.
   * Example: getExchangeRate('USD', 'NGN') -> ~1550.0
   */
  public async getExchangeRate(from: string, to: string = 'NGN'): Promise<number> {
    const fromCode = this.normalizeCurrency(from);
    const toCode = this.normalizeCurrency(to);

    if (fromCode === toCode) {
      return 1.0;
    }

    const snapshot = await this.getRatesSnapshot();
    const fromInNgn = new Decimal(
      snapshot.ratesToNgn[fromCode] || FALLBACK_RATES_TO_NGN[fromCode] || 1,
    );
    const toInNgn = new Decimal(
      snapshot.ratesToNgn[toCode] || FALLBACK_RATES_TO_NGN[toCode] || 1,
    );

    // 1 unit of `from` in `NGN` divided by 1 unit of `to` in `NGN`
    const crossRate = fromInNgn.div(toInNgn);
    return Number(crossRate.toFixed(10));
  }

  /**
   * Converts a monetary amount between two currencies using Decimal.js precision
   * and rounds according to the target currency's ISO precision (0 decimals for JPY, 2 for others).
   */
  public async convertAmount(
    amount: number,
    from: string,
    to: string,
  ): Promise<number> {
    if (!Number.isFinite(amount)) {
      throw new Error('CurrencyService.convertAmount: amount must be a finite number.');
    }

    const fromCode = this.normalizeCurrency(from);
    const toCode = this.normalizeCurrency(to);
    const targetConfig = CURRENCY_METADATA[toCode];

    const decimalAmount = new Decimal(amount);
    if (fromCode === toCode) {
      return Number(
        decimalAmount.toDecimalPlaces(targetConfig.decimals, Decimal.ROUND_HALF_UP),
      );
    }

    const snapshot = await this.getRatesSnapshot();
    const fromInNgn = new Decimal(
      snapshot.ratesToNgn[fromCode] || FALLBACK_RATES_TO_NGN[fromCode] || 1,
    );
    const toInNgn = new Decimal(
      snapshot.ratesToNgn[toCode] || FALLBACK_RATES_TO_NGN[toCode] || 1,
    );
    const converted = decimalAmount.mul(fromInNgn).div(toInNgn);

    return Number(
      converted.toDecimalPlaces(targetConfig.decimals, Decimal.ROUND_HALF_UP),
    );
  }

  /**
   * Converts a Decimal financial amount in `fromCurrency` into base NGN (2 decimal places)
   * using a provided historical exchangeRate snapshot (or live rate if omitted).
   */
  public async convertDecimalToNgn(
    amount: Decimal | number | string,
    fromCurrency: string,
    exchangeRateToNgn?: Decimal | number,
  ): Promise<Decimal> {
    const fromCode = this.normalizeCurrency(fromCurrency);
    const decAmount = new Decimal(amount);

    if (fromCode === 'NGN') {
      return decAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    const resolvedRate =
      exchangeRateToNgn !== undefined
        ? new Decimal(exchangeRateToNgn)
        : new Decimal(await this.getExchangeRateToNgn(fromCode));

    return decAmount.mul(resolvedRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * Formats a numeric or Decimal amount using Intl.NumberFormat for the specified currency.
   */
  public formatCurrency(
    amount: number | string | Decimal,
    currency: string = 'NGN',
  ): string {
    const code = this.normalizeCurrency(currency);
    const meta = CURRENCY_METADATA[code];
    const numValue =
      amount instanceof Decimal ? amount.toNumber() : Number(amount || 0);

    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(Number.isFinite(numValue) ? numValue : 0);
  }

  private async fetchLiveRatesWithFallback(): Promise<ExchangeRatesSnapshot> {
    if (process.env.CURRENCY_OFFLINE_MODE === 'true') {
      return this.buildFallbackSnapshot();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from exchange rate provider`);
      }

      const payload: any = await response.json();
      const rawRates = payload?.rates || payload?.conversion_rates;
      if (!rawRates || typeof rawRates !== 'object') {
        throw new Error('Malformed exchange rate payload (missing rates object)');
      }

      const baseCurrency = (payload.base_code || payload.base || 'NGN').toUpperCase();
      const ratesToNgn: Record<SupportedCurrency, number> = { ...FALLBACK_RATES_TO_NGN };
      const ratesFromNgn: Record<SupportedCurrency, number> = {
        NGN: 1,
        USD: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.USD).toFixed(8)),
        EUR: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.EUR).toFixed(8)),
        GBP: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.GBP).toFixed(8)),
        JPY: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.JPY).toFixed(8)),
      };

      if (baseCurrency === 'NGN') {
        for (const code of SUPPORTED_CURRENCIES) {
          if (code === 'NGN') {
            ratesToNgn.NGN = 1.0;
            ratesFromNgn.NGN = 1.0;
            continue;
          }
          const perNgn = Number(rawRates[code]);
          if (Number.isFinite(perNgn) && perNgn > 0) {
            ratesFromNgn[code] = Number(new Decimal(perNgn).toFixed(8));
            ratesToNgn[code] = Number(new Decimal(1).div(perNgn).toFixed(6));
          }
        }
      } else {
        // Provider returned another base (e.g. USD or EUR)
        const ngnPerBase = Number(rawRates.NGN);
        if (Number.isFinite(ngnPerBase) && ngnPerBase > 0) {
          for (const code of SUPPORTED_CURRENCIES) {
            if (code === 'NGN') {
              ratesToNgn.NGN = 1.0;
              ratesFromNgn.NGN = 1.0;
              continue;
            }
            const codePerBase = code === baseCurrency ? 1.0 : Number(rawRates[code]);
            if (Number.isFinite(codePerBase) && codePerBase > 0) {
              const toNgn = new Decimal(ngnPerBase).div(codePerBase);
              ratesToNgn[code] = Number(toNgn.toFixed(6));
              ratesFromNgn[code] = Number(new Decimal(1).div(toNgn).toFixed(8));
            }
          }
        }
      }

      return {
        base: 'NGN',
        ratesToNgn,
        ratesFromNgn,
        source: 'live_api',
        fetchedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.warn(
        `CurrencyService: Live exchange rate fetch failed (${err.message}). Using deterministic fallback rates.`,
      );
      return this.buildFallbackSnapshot();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildFallbackSnapshot(): ExchangeRatesSnapshot {
    const ratesToNgn: Record<SupportedCurrency, number> = {
      ...FALLBACK_RATES_TO_NGN,
    };
    const ratesFromNgn: Record<SupportedCurrency, number> = {
      NGN: 1.0,
      USD: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.USD).toFixed(8)),
      JPY: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.JPY).toFixed(8)),
      GBP: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.GBP).toFixed(8)),
      EUR: Number(new Decimal(1).div(FALLBACK_RATES_TO_NGN.EUR).toFixed(8)),
    };

    return {
      base: 'NGN',
      ratesToNgn,
      ratesFromNgn,
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
    };
  }
}
