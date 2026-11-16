export type SupportedCurrencyCode = 'NGN' | 'USD' | 'JPY' | 'GBP' | 'EUR';

export interface CurrencyOption {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  locale: string;
  decimals: number;
  label: string;
  fallbackRateToNgn: number;
}

export const CURRENCY_CONFIG: Record<SupportedCurrencyCode, CurrencyOption> = {
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    locale: 'en-NG',
    decimals: 2,
    label: 'NGN (Nigerian Naira - ₦)',
    fallbackRateToNgn: 1.0,
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    locale: 'en-US',
    decimals: 2,
    label: 'USD (US Dollar - $)',
    fallbackRateToNgn: 1550.0,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    locale: 'ja-JP',
    decimals: 0,
    label: 'JPY (Japanese Yen - ¥)',
    fallbackRateToNgn: 10.25,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    locale: 'en-GB',
    decimals: 2,
    label: 'GBP (British Pound - £)',
    fallbackRateToNgn: 1960.0,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    locale: 'de-DE',
    decimals: 2,
    label: 'EUR (Euro - €)',
    fallbackRateToNgn: 1680.0,
  },
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  CURRENCY_CONFIG.NGN,
  CURRENCY_CONFIG.USD,
  CURRENCY_CONFIG.JPY,
  CURRENCY_CONFIG.GBP,
  CURRENCY_CONFIG.EUR,
];

export function normalizeCurrencyCode(currency?: string | null): SupportedCurrencyCode {
  const code = (currency || 'NGN').trim().toUpperCase();
  if (code in CURRENCY_CONFIG) {
    return code as SupportedCurrencyCode;
  }
  return 'NGN';
}

export function getCurrencySymbol(currency?: string | null): string {
  const code = normalizeCurrencyCode(currency);
  return CURRENCY_CONFIG[code].symbol;
}

/**
 * Formats a monetary value using Intl.NumberFormat with locale-specific rules
 * and currency decimal precision (0 decimals for JPY, 2 decimals for NGN, USD, GBP, EUR).
 */
export function formatCurrencyLocale(
  amount: number | string | undefined | null,
  currency: string = 'NGN',
): string {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const code = normalizeCurrencyCode(currency);
  const config = CURRENCY_CONFIG[code];

  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(safeNum);
  } catch {
    return `${config.symbol}${safeNum.toFixed(config.decimals)}`;
  }
}

export function convertToBaseNgn(
  amount: number | string | undefined | null,
  fromCurrency: string = 'NGN',
  rateToNgn?: number,
): number {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const code = normalizeCurrencyCode(fromCurrency);
  if (code === 'NGN') return safeNum;
  const rate =
    rateToNgn && Number.isFinite(rateToNgn) && rateToNgn > 0
      ? rateToNgn
      : CURRENCY_CONFIG[code].fallbackRateToNgn;
  return Number((safeNum * rate).toFixed(2));
}

