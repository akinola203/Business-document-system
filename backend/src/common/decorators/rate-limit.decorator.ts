import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit_options';

export interface RateLimitOptions {
  limit: number;
  ttl: number; // TTL in seconds
  keyPrefix?: string;
}

/**
 * Custom decorator to configure Redis cache-backed rate limiting per controller or method.
 *
 * @param options.limit Maximum allowed requests within the time window.
 * @param options.ttl Time-to-live / window duration in seconds.
 * @param options.keyPrefix Optional custom namespace prefix for the rate-limit bucket.
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

