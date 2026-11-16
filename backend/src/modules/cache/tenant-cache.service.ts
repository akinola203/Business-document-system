import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class TenantCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantCacheService.name);
  private static readonly MAX_MEMORY_ENTRIES = 5000;
  private static readonly KEY_PREFIX = 'aoa77:cache';

  private redisClient: Redis | null = null;
  private redisConnected = false;
  private hasAttemptedInit = false;
  private readonly memoryStore = new Map<string, MemoryCacheEntry>();

  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };

  constructor() {
    this.initRedisClient();
  }

  private initRedisClient(): void {
    if (this.hasAttemptedInit) {
      return;
    }
    this.hasAttemptedInit = true;

    const redisUrl = process.env.REDIS_URL?.trim();
    const redisHost = process.env.REDIS_HOST?.trim();

    if (!redisUrl && !redisHost) {
      return;
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
        this.redisConnected = true;
        this.logger.log('TenantCacheService: Connected to Redis cache.');
      });

      client.on('error', (err) => {
        this.redisConnected = false;
        this.logger.warn(
          `TenantCacheService: Redis error (${err.message}). Falling back to in-memory cache.`,
        );
      });

      client.on('close', () => {
        this.redisConnected = false;
      });

      client.connect().catch((err) => {
        this.redisConnected = false;
        this.logger.warn(
          `TenantCacheService: Initial Redis connect failed (${err.message}). Using in-memory cache fallback.`,
        );
      });

      this.redisClient = client;
    } catch (err: any) {
      this.logger.warn(
        `TenantCacheService: Failed to instantiate Redis client (${err.message}). Using in-memory fallback.`,
      );
    }
  }

  /**
   * Allows tests to inject a mock or test Redis client.
   */
  public setRedisClient(client: Redis | null, connected = Boolean(client)): void {
    this.redisClient = client;
    this.redisConnected = connected;
    this.hasAttemptedInit = true;
  }

  public clearMemoryCache(): void {
    this.memoryStore.clear();
  }

  public getStats() {
    return {
      ...this.stats,
      redisActive: Boolean(this.redisClient && this.redisConnected),
      memoryEntries: this.memoryStore.size,
    };
  }

  /**
   * Builds a strictly tenant-isolated cache key.
   * Throws if companyId is empty to eliminate cross-tenant cache key collisions.
   */
  public buildTenantKey(companyId: string, namespace: string, subKey?: string): string {
    const cleanCompanyId = companyId?.trim();
    if (!cleanCompanyId) {
      throw new Error(`TenantCacheService: Refusing to build tenant cache key without a valid companyId (namespace=${namespace}).`);
    }
    const cleanNamespace = namespace.trim();
    return subKey
      ? `${TenantCacheService.KEY_PREFIX}:tenant:${cleanCompanyId}:${cleanNamespace}:${subKey.trim()}`
      : `${TenantCacheService.KEY_PREFIX}:tenant:${cleanCompanyId}:${cleanNamespace}`;
  }

  /**
   * Builds a global cache key for shared immutable/system lookup tables (e.g., master permission catalog).
   */
  public buildGlobalKey(namespace: string, subKey?: string): string {
    const cleanNamespace = namespace.trim();
    return subKey
      ? `${TenantCacheService.KEY_PREFIX}:global:${cleanNamespace}:${subKey.trim()}`
      : `${TenantCacheService.KEY_PREFIX}:global:${cleanNamespace}`;
  }

  public async get<T>(key: string): Promise<T | null> {
    if (this.redisClient && this.redisConnected) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw !== null) {
          this.stats.hits += 1;
          return JSON.parse(raw) as T;
        }
        this.stats.misses += 1;
        return null;
      } catch (err: any) {
        this.logger.warn(`TenantCacheService: Redis GET failed (${err.message}); checking memory fallback.`);
      }
    }

    const memEntry = this.memoryStore.get(key);
    if (!memEntry) {
      this.stats.misses += 1;
      return null;
    }

    if (Date.now() >= memEntry.expiresAt) {
      this.memoryStore.delete(key);
      this.stats.misses += 1;
      return null;
    }

    this.stats.hits += 1;
    return JSON.parse(memEntry.value) as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    if (value === undefined) {
      return;
    }

    const serialized = JSON.stringify(value);
    const safeTtl = Math.max(1, Math.floor(ttlSeconds));

    if (this.redisClient && this.redisConnected) {
      try {
        await this.redisClient.set(key, serialized, 'EX', safeTtl);
        return;
      } catch (err: any) {
        this.logger.warn(`TenantCacheService: Redis SET failed (${err.message}); writing to memory fallback.`);
      }
    }

    // Evict oldest entry if bounded memory store reaches capacity
    if (this.memoryStore.size >= TenantCacheService.MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memoryStore.keys().next().value;
      if (oldestKey) {
        this.memoryStore.delete(oldestKey);
      }
    }

    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: Date.now() + safeTtl * 1000,
    });
  }

  public async del(key: string): Promise<void> {
    this.stats.invalidations += 1;
    this.memoryStore.delete(key);

    if (this.redisClient && this.redisConnected) {
      try {
        await this.redisClient.del(key);
      } catch (err: any) {
        this.logger.warn(`TenantCacheService: Redis DEL failed (${err.message}).`);
      }
    }
  }

  /**
   * Cache-aside lookup helper.
   */
  public async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await loader();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }

  /**
   * Tenant-scoped cache-aside lookup helper.
   */
  public async getOrSetTenant<T>(
    companyId: string,
    namespace: string,
    subKey: string | undefined,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const key = this.buildTenantKey(companyId, namespace, subKey);
    return this.getOrSet(key, ttlSeconds, loader);
  }

  /**
   * Invalidates all cached entries under a specific tenant namespace (and optional subKey prefix).
   */
  public async invalidateTenantNamespace(companyId: string, namespace: string): Promise<void> {
    const prefix = this.buildTenantKey(companyId, namespace);
    this.stats.invalidations += 1;

    for (const memKey of Array.from(this.memoryStore.keys())) {
      if (memKey === prefix || memKey.startsWith(`${prefix}:`)) {
        this.memoryStore.delete(memKey);
      }
    }

    if (this.redisClient && this.redisConnected) {
      try {
        const pattern = `${prefix}*`;
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redisClient.del(...keys);
          }
        } while (cursor !== '0');
      } catch (err: any) {
        this.logger.warn(`TenantCacheService: Redis namespace invalidation failed (${err.message}).`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
      this.redisClient = null;
      this.redisConnected = false;
    }
  }
}

