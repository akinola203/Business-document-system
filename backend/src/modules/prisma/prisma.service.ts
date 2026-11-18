import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Models in schema.prisma that include a `deletedAt DateTime?` column for soft-delete.
 */
export const SOFT_DELETABLE_MODELS = new Set([
  'Company',
  'User',
  'Client',
  'Document',
  'Vendor',
  'SupplyItem',
  'SupplyOrder',
]);

export const SOFT_DELETE_READ_ACTIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

export const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

export const READ_OPERATIONS = new Set([
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'aggregate',
  'count',
  'groupBy',
]);

export interface PoolTuningOptions {
  connectionLimit: number;
  poolTimeout: number;
  overrideExisting?: boolean;
  enforceSsl?: boolean;
}

const LOCAL_DB_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'postgres-replica',
  'db',
]);

export interface PrismaRoutingContext {
  insideTransaction?: boolean;
  forcePrimary?: boolean;
  hasRecentWrite?: boolean;
  lastWriteAt?: number;
  companyId?: string;
}

export interface PrismaRoutingStats {
  primaryQueries: number;
  replicaQueries: number;
  consistencyPinnedReads: number;
  replicaFailovers: number;
  replicaConfigured: boolean;
  consistencyWindowMs: number;
}

export const prismaRoutingContextStorage = new AsyncLocalStorage<PrismaRoutingContext>();

/**
 * Appends or updates Prisma connection pooling query parameters (`connection_limit`, `pool_timeout`)
 * and enforces TLS (`sslmode=require`) for remote/cloud PostgreSQL hosts (e.g., Neon, Render, RDS).
 */
export function tuneConnectionPoolUrl(
  rawUrl: string | undefined,
  options: PoolTuningOptions,
): string | undefined {
  if (!rawUrl || !rawUrl.trim()) {
    return undefined;
  }

  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (options.overrideExisting || !parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', String(options.connectionLimit));
    }
    if (options.overrideExisting || !parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(options.poolTimeout));
    }
    const hostname = parsed.hostname.toLowerCase();
    const isRemoteHost = Boolean(hostname) && !LOCAL_DB_HOSTS.has(hostname);
    if (isRemoteHost || options.enforceSsl) {
      const currentSslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
      if (!currentSslMode || currentSslMode === 'disable' || currentSslMode === 'allow' || currentSslMode === 'prefer') {
        parsed.searchParams.set('sslmode', 'require');
      }
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function applySoftDeleteMiddlewareParams(params: {
  model?: string;
  action: string;
  args?: any;
}) {
  if (params.model && SOFT_DELETABLE_MODELS.has(params.model)) {
    if (SOFT_DELETE_READ_ACTIONS.has(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }
  }
  return params;
}

function isReplicaConnectionError(err: any): boolean {
  const code = String(err?.code || '');
  const message = String(err?.message || '').toLowerCase();
  return (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    message.includes("can't reach database server") ||
    message.includes('connection refused') ||
    message.includes('connection terminated')
  );
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readReplicaClient: PrismaClient | null = null;
  private extendedClient: any;
  private primarySoftDeleteClient: any;
  private replicaSoftDeleteClient: any;

  private readonly consistencyWindowMs: number;
  private readonly recentWrites = new Map<string, number>();

  private routingStats = {
    primaryQueries: 0,
    replicaQueries: 0,
    consistencyPinnedReads: 0,
    replicaFailovers: 0,
  };

  constructor() {
    const primaryLimit = Number(process.env.DB_PRIMARY_CONNECTION_LIMIT) || 20;
    const replicaLimit = Number(process.env.DB_REPLICA_CONNECTION_LIMIT) || 30;
    const poolTimeout = Number(process.env.DB_POOL_TIMEOUT) || 30;

    const tunedPrimaryUrl = tuneConnectionPoolUrl(process.env.DATABASE_URL, {
      connectionLimit: primaryLimit,
      poolTimeout,
      overrideExisting: Boolean(process.env.DB_PRIMARY_CONNECTION_LIMIT),
    });

    super({
      ...(tunedPrimaryUrl ? { datasources: { db: { url: tunedPrimaryUrl } } } : {}),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'pretty',
    });

    this.consistencyWindowMs =
      Number(process.env.DB_READ_AFTER_WRITE_WINDOW_MS) || 2000;

    const rawReplicaUrl = process.env.DATABASE_READ_REPLICA_URL?.trim();
    if (rawReplicaUrl) {
      const tunedReplicaUrl = tuneConnectionPoolUrl(rawReplicaUrl, {
        connectionLimit: replicaLimit,
        poolTimeout,
        overrideExisting: Boolean(process.env.DB_REPLICA_CONNECTION_LIMIT),
      });

      this.readReplicaClient = new PrismaClient({
        datasources: { db: { url: tunedReplicaUrl } },
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
        errorFormat: 'pretty',
      });
    }

    this.primarySoftDeleteClient = this.createSoftDeleteExtension(this);
    this.rebuildExtendedClient();

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === '$transaction') {
          return async (...txArgs: any[]) => {
            const existingStore = prismaRoutingContextStorage.getStore();
            const txContext: PrismaRoutingContext = {
              insideTransaction: true,
              forcePrimary: true,
              hasRecentWrite: existingStore?.hasRecentWrite ?? false,
              lastWriteAt: existingStore?.lastWriteAt ?? 0,
              companyId: existingStore?.companyId,
            };

            const result = await prismaRoutingContextStorage.run(txContext, () =>
              (target.extendedClient.$transaction as (...args: any[]) => Promise<any>)(...txArgs),
            );

            target.recordTransactionCompletion(txContext.companyId, result);
            return result;
          };
        }

        // Preserve explicit PrismaService methods and properties
        if (
          prop in target &&
          (prop === 'onModuleInit' ||
            prop === 'onModuleDestroy' ||
            prop === '$primary' ||
            prop === '$replica' ||
            prop === 'isReplicaConfigured' ||
            prop === 'getRoutingStats' ||
            prop === 'resetRoutingStats' ||
            prop === 'clearRecentWrites' ||
            prop === 'setReadReplicaClient' ||
            prop === 'runOnPrimary' ||
            prop === 'runWithRequestScope' ||
            String(prop).startsWith('$'))
        ) {
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }

        // Route all Prisma model delegates through the primary-replica $extends client
        if (target.extendedClient && prop in target.extendedClient) {
          const extValue = Reflect.get(target.extendedClient, prop, target.extendedClient);
          return typeof extValue === 'function' ? extValue.bind(target.extendedClient) : extValue;
        }

        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  private createSoftDeleteExtension(client: PrismaClient) {
    return client.$extends({
      name: 'soft-delete-filter',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const safeArgs: any = args ? { ...args } : {};
            if (safeArgs.where) {
              safeArgs.where = { ...safeArgs.where };
            }
            if (model) {
              applySoftDeleteMiddlewareParams({
                model,
                action: operation,
                args: safeArgs,
              });
            }
            return query(safeArgs);
          },
        },
      },
    });
  }

  private rebuildExtendedClient(): void {
    const self = this;

    if (this.readReplicaClient && typeof (this.readReplicaClient as any).$extends === 'function') {
      this.replicaSoftDeleteClient = this.createSoftDeleteExtension(this.readReplicaClient);
    } else {
      this.replicaSoftDeleteClient = this.readReplicaClient;
    }

    this.extendedClient = this.$extends({
      name: 'primary-replica-routing',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const safeArgs: any = args ? { ...args } : {};
            if (safeArgs.where) {
              safeArgs.where = { ...safeArgs.where };
            }

            if (model) {
              applySoftDeleteMiddlewareParams({
                model,
                action: operation,
                args: safeArgs,
              });
            }

            // 1. Write operations always route to Primary and stamp consistency keys
            if (WRITE_OPERATIONS.has(operation)) {
              self.routingStats.primaryQueries += 1;
              const result = await query(safeArgs);
              if (model) {
                self.recordMutationConsistency(model, safeArgs, result);
              }
              return result;
            }

            // 2. Read operations route to Read Replica unless consistency requires Primary
            if (model && READ_OPERATIONS.has(operation)) {
              const ctx = prismaRoutingContextStorage.getStore();

              if (ctx?.insideTransaction || ctx?.forcePrimary) {
                self.routingStats.primaryQueries += 1;
                return query(safeArgs);
              }

              if (self.hasRecentMutationForScope(model, safeArgs, ctx)) {
                self.routingStats.primaryQueries += 1;
                self.routingStats.consistencyPinnedReads += 1;
                return query(safeArgs);
              }

              if (self.readReplicaClient) {
                const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
                const replicaDelegate = (self.readReplicaClient as any)[modelKey];

                if (replicaDelegate && typeof replicaDelegate[operation] === 'function') {
                  self.routingStats.replicaQueries += 1;
                  try {
                    return await replicaDelegate[operation](safeArgs);
                  } catch (err: any) {
                    if (isReplicaConnectionError(err)) {
                      self.logger.warn(
                        `Read replica connection error during ${model}.${operation} (${err?.code || err?.message}); failing over read to primary.`,
                      );
                      self.routingStats.replicaFailovers += 1;
                      self.routingStats.primaryQueries += 1;
                      return query(safeArgs);
                    }
                    throw err;
                  }
                }
              }
            }

            // Default: execute on Primary
            self.routingStats.primaryQueries += 1;
            return query(safeArgs);
          },
        },
      },
    });
  }

  private extractCompanyId(args: any, result?: any): string | undefined {
    const candidate =
      args?.where?.companyId ??
      args?.data?.companyId ??
      (Array.isArray(args?.data) ? args.data[0]?.companyId : undefined) ??
      result?.companyId;

    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim()
      : undefined;
  }

  private extractRecordId(args: any, result?: any): string | undefined {
    const candidate = args?.where?.id ?? result?.id;
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim()
      : undefined;
  }

  private pruneExpiredWrites(now: number): void {
    if (this.recentWrites.size <= 2000) {
      return;
    }
    for (const [key, expiresAt] of this.recentWrites.entries()) {
      if (now >= expiresAt) {
        this.recentWrites.delete(key);
      }
    }
  }

  private recordMutationConsistency(model: string, args: any, result?: any): void {
    const now = Date.now();
    const expiresAt = now + this.consistencyWindowMs;
    this.pruneExpiredWrites(now);

    const companyId = this.extractCompanyId(args, result);
    const recordId = this.extractRecordId(args, result);

    if (companyId) {
      this.recentWrites.set(`tenant:${companyId}`, expiresAt);
    }
    if (recordId) {
      this.recentWrites.set(`record:${model}:${recordId}`, expiresAt);
    }
    if (!companyId && !recordId) {
      this.recentWrites.set(`model:${model}`, expiresAt);
    }

    const ctx = prismaRoutingContextStorage.getStore();
    if (ctx) {
      ctx.hasRecentWrite = true;
      ctx.lastWriteAt = now;
      if (companyId && !ctx.companyId) {
        ctx.companyId = companyId;
      }
    }
  }

  private recordTransactionCompletion(companyId?: string, result?: any): void {
    const now = Date.now();
    const expiresAt = now + this.consistencyWindowMs;
    const resolvedCompanyId = companyId ?? this.extractCompanyId(undefined, result);
    if (resolvedCompanyId) {
      this.recentWrites.set(`tenant:${resolvedCompanyId}`, expiresAt);
    }
    const ctx = prismaRoutingContextStorage.getStore();
    if (ctx) {
      ctx.hasRecentWrite = true;
      ctx.lastWriteAt = now;
    }
  }

  private hasRecentMutationForScope(
    model: string,
    args: any,
    ctx?: PrismaRoutingContext,
  ): boolean {
    const now = Date.now();

    if (ctx?.hasRecentWrite && ctx.lastWriteAt && now - ctx.lastWriteAt < this.consistencyWindowMs) {
      return true;
    }

    const companyId = this.extractCompanyId(args) ?? ctx?.companyId;
    if (companyId) {
      const tenantExpiry = this.recentWrites.get(`tenant:${companyId}`);
      if (tenantExpiry && now < tenantExpiry) {
        return true;
      }
    }

    const recordId = this.extractRecordId(args);
    if (recordId) {
      const recordExpiry = this.recentWrites.get(`record:${model}:${recordId}`);
      if (recordExpiry && now < recordExpiry) {
        return true;
      }
    }

    const modelExpiry = this.recentWrites.get(`model:${model}`);
    if (modelExpiry && now < modelExpiry) {
      return true;
    }

    return false;
  }

  /**
   * Returns a primary-pinned Prisma client (with soft-delete enabled) for strong-consistency reads.
   */
  public $primary(): this {
    return this.primarySoftDeleteClient;
  }

  /**
   * Returns the read-replica Prisma client (with soft-delete enabled) when configured,
   * or falls back to the primary client.
   */
  public $replica(): this {
    return this.replicaSoftDeleteClient ?? this.primarySoftDeleteClient;
  }

  public isReplicaConfigured(): boolean {
    return Boolean(this.readReplicaClient);
  }

  public getRoutingStats(): PrismaRoutingStats {
    return {
      ...this.routingStats,
      replicaConfigured: this.isReplicaConfigured(),
      consistencyWindowMs: this.consistencyWindowMs,
    };
  }

  public resetRoutingStats(): void {
    this.routingStats = {
      primaryQueries: 0,
      replicaQueries: 0,
      consistencyPinnedReads: 0,
      replicaFailovers: 0,
    };
  }

  public clearRecentWrites(): void {
    this.recentWrites.clear();
  }

  /**
   * Allows unit and integration tests to inject a mock or dedicated read-replica Prisma client.
   */
  public setReadReplicaClient(client: any): void {
    this.readReplicaClient = client;
    this.rebuildExtendedClient();
  }

  /**
   * Executes a block strictly against the Primary database.
   */
  public async runOnPrimary<T>(fn: () => Promise<T>): Promise<T> {
    const current = prismaRoutingContextStorage.getStore();
    return prismaRoutingContextStorage.run(
      { ...current, forcePrimary: true },
      fn,
    );
  }

  /**
   * Executes a block bound to a tenant request scope for read-after-write consistency tracking.
   */
  public async runWithRequestScope<T>(
    companyId: string | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    const current = prismaRoutingContextStorage.getStore();
    return prismaRoutingContextStorage.run(
      { ...current, companyId: companyId ?? current?.companyId },
      fn,
    );
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to Primary PostgreSQL database via Prisma.');
    } catch (error) {
      this.logger.error('Failed to connect to Primary PostgreSQL database:', error);
      throw error;
    }

    if (this.readReplicaClient) {
      try {
        await this.readReplicaClient.$connect();
        this.logger.log('Successfully connected to Read-Replica PostgreSQL database via Prisma.');
      } catch (error: any) {
        this.logger.warn(
          `Failed to connect to Read-Replica PostgreSQL database (${error?.message}). Read queries will fail over to Primary.`,
        );
      }
    } else {
      this.logger.log(
        'DATABASE_READ_REPLICA_URL not configured; read/write splitting defaulting reads to Primary.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.readReplicaClient) {
      await this.readReplicaClient.$disconnect().catch(() => {});
    }
    this.logger.log('Disconnected from PostgreSQL database connections.');
  }
}
