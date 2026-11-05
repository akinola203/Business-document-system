import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

interface MemoryBucket {
  count: number;
  resetAt: number; // millisecond timestamp
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly logger = new Logger(RateLimitGuard.name);
  private static memoryStore = new Map<string, MemoryBucket>();
  private static redisClient: Redis | null = null;
  private static redisConnected = false;
  private static hasAttemptedRedisInit = false;

  constructor(private readonly reflector: Reflector = new Reflector()) {}

  /**
   * Initialize or retrieve the Redis connection singleton.
   */
  private static getRedisClient(): Redis | null {
    if (this.redisClient) {
      return this.redisConnected ? this.redisClient : null;
    }

    if (this.hasAttemptedRedisInit) {
      return null;
    }
    this.hasAttemptedRedisInit = true;

    const redisUrl = process.env.REDIS_URL?.trim();
    const redisHost = process.env.REDIS_HOST?.trim();

    if (!redisUrl && !redisHost) {
      return null;
    }

    try {
      const client = redisUrl
        ? new Redis(redisUrl, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 1500,
            retryStrategy: () => null,
          })
        : new Redis({
            host: redisHost,
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            connectTimeout: 1500,
            retryStrategy: () => null,
          });

      client.on('connect', () => {
        RateLimitGuard.redisConnected = true;
        RateLimitGuard.logger.log('RateLimitGuard: Connected to Redis successfully.');
      });

      client.on('error', (err) => {
        RateLimitGuard.redisConnected = false;
        RateLimitGuard.logger.warn(
          `RateLimitGuard: Redis connection error: ${err.message}. Operating in in-memory fallback mode.`,
        );
      });

      // Attempt async connection in background
      client.connect().catch((err) => {
        RateLimitGuard.redisConnected = false;
        RateLimitGuard.logger.warn(
          `RateLimitGuard: Initial Redis connect failed: ${err.message}. Operating in in-memory fallback mode.`,
        );
      });

      RateLimitGuard.redisClient = client;
      return RateLimitGuard.redisConnected ? RateLimitGuard.redisClient : null;
    } catch (err: any) {
      RateLimitGuard.logger.warn(
        `RateLimitGuard: Failed to instantiate Redis client (${err.message}). Using in-memory store.`,
      );
      return null;
    }
  }

  /**
   * Allows unit tests to inject a mock or test Redis instance.
   */
  public static setRedisClient(client: Redis | null): void {
    RateLimitGuard.redisClient = client;
    RateLimitGuard.redisConnected = Boolean(client);
    RateLimitGuard.hasAttemptedRedisInit = true;
  }

  /**
   * Resets in-memory bucket store (useful for tests).
   */
  public static clearStore(): void {
    RateLimitGuard.memoryStore.clear();
  }

  /**
   * Closes active Redis client if open.
   */
  public static async closeRedis(): Promise<void> {
    if (RateLimitGuard.redisClient) {
      try {
        await RateLimitGuard.redisClient.quit();
      } catch {
        // ignore errors on teardown
      }
      RateLimitGuard.redisClient = null;
      RateLimitGuard.redisConnected = false;
      RateLimitGuard.hasAttemptedRedisInit = false;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If neither method nor class is decorated with @RateLimit, allow access
    if (!options) {
      return true;
    }

    const { limit, ttl, keyPrefix } = options;
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 1. Identify client: user_{id} for authenticated; ip_{ip} for unauthenticated
    const user = request.user;
    let clientIdentifier: string;
    if (user && (user.id || user.sub)) {
      clientIdentifier = `user_${user.id || user.sub}`;
    } else {
      const forwarded = request.headers?.['x-forwarded-for'];
      let clientIp: string | undefined;
      if (typeof forwarded === 'string') {
        clientIp = forwarded.split(',')[0].trim();
      } else if (Array.isArray(forwarded) && forwarded.length > 0) {
        clientIp = forwarded[0].trim();
      }
      if (!clientIp) {
        clientIp = request.ip || request.socket?.remoteAddress || '127.0.0.1';
      }
      clientIdentifier = `ip_${clientIp}`;
    }

    // 2. Build route namespace
    const routeScope = keyPrefix
      ? keyPrefix
      : `${request.method || 'REQ'}:${request.route?.path || request.path || context.getHandler().name}`;
    const storageKey = `rate_limit:${routeScope}:${clientIdentifier}`;

    // 3. Atomically query count & TTL
    const { count, remainingTtlSeconds } = await this.incrementAndCheck(storageKey, ttl);

    // 4. Attach standard rate-limit response headers if possible
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count).toString());
      response.setHeader(
        'X-RateLimit-Reset',
        (Math.floor(Date.now() / 1000) + remainingTtlSeconds).toString(),
      );
    }

    // 5. Exceeded limit check
    if (count > limit) {
      const retryAfter = Math.max(1, remainingTtlSeconds);
      if (response && typeof response.setHeader === 'function') {
        response.setHeader('Retry-After', retryAfter.toString());
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Increments the request counter in Redis (or in-memory fallback) and returns the current count & remaining TTL.
   */
  private async incrementAndCheck(
    key: string,
    ttlSeconds: number,
  ): Promise<{ count: number; remainingTtlSeconds: number }> {
    const redis = RateLimitGuard.getRedisClient();

    if (redis) {
      try {
        // Atomic Lua script to INCR and set EXPIRE on first hit, then read TTL
        const luaScript = `
          local current = redis.call('INCR', KEYS[1])
          if current == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
          end
          local ttl = redis.call('TTL', KEYS[1])
          return {current, ttl}
        `;
        const result = (await redis.eval(luaScript, 1, key, ttlSeconds)) as [number, number];
        const count = Number(result[0]);
        const remainingTtlSeconds = Math.max(1, Number(result[1]));
        return { count, remainingTtlSeconds };
      } catch (err: any) {
        RateLimitGuard.logger.warn(
          `RateLimitGuard: Redis command failed (${err.message}). Defaulting to memory fallback.`,
        );
      }
    }

    // Fallback: In-Memory Sliding Fixed Window
    const now = Date.now();
    const bucket = RateLimitGuard.memoryStore.get(key);

    if (!bucket || now >= bucket.resetAt) {
      RateLimitGuard.memoryStore.set(key, {
        count: 1,
        resetAt: now + ttlSeconds * 1000,
      });
      return { count: 1, remainingTtlSeconds: ttlSeconds };
    }

    bucket.count += 1;
    const remainingMs = Math.max(0, bucket.resetAt - now);
    const remainingTtlSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { count: bucket.count, remainingTtlSeconds };
  }
}

