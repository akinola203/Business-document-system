import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format numeric currency with standard locale spacing (e.g. NGN 250,000.00)
 */
export function formatCurrency(amount: number | string | undefined | null, currency = 'NGN'): string {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format dates into friendly short corporate format (e.g. 24 Oct 2026)
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Return humanized relative time (e.g. "2 days ago", "In 5 days")
 */
export function formatRelativeTime(date: string | Date | undefined | null): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Universal safe unwrapper for backend paginated or enveloped list responses
 * Handles:
 * - Direct array: [...]
 * - NestJS envelope: { success: true, data: [...] }
 * - Paginated list: { items: [...], meta: {...} }
 * - Enveloped paginated list: { success: true, data: { items: [...], meta: {...} } }
 */
export function extractArray<T>(data: any, fallback: T[] = []): T[] {
  if (!data) return fallback;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  return fallback;
}
