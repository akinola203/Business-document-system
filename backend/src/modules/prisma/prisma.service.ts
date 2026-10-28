import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'minimal',
    });

    // Auto-reconnect middleware for Neon cloud serverless PostgreSQL idle drops
    this.$use(async (params, next) => {
      let attempts = 0;
      while (attempts < 2) {
        try {
          return await next(params);
        } catch (error: any) {
          attempts++;
          const isConnectionDrop =
            error?.message?.includes('closed the connection') ||
            error?.message?.includes('Connection terminated') ||
            error?.message?.includes('Connection closed') ||
            error?.code === 'P1001' ||
            error?.code === 'P2024';

          if (isConnectionDrop && attempts < 2) {
            this.logger.warn(
              `Prisma connection dropped during ${params.model}.${params.action}. Reconnecting & retrying...`,
            );
            try {
              await this.$connect();
            } catch {
              // ignore reconnect error to let retry attempt proceed or throw original
            }
            continue;
          }
          throw error;
        }
      }
      return next(params);
    });
  }

  /**
   * Overrides $transaction to enforce cloud-resilient timeouts (30s timeout, 10s maxWait)
   * preventing interactive transaction timeouts when roundtripping to Neon Cloud PostgreSQL.
   */
  override $transaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  override $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<any>;
  override $transaction(arg: any, options?: any): Promise<any> {
    if (typeof arg === 'function') {
      return super.$transaction(arg, {
        maxWait: 10000,
        timeout: 30000,
        ...options,
      });
    }
    return super.$transaction(arg, options);
  }

  async onModuleInit() {
    this.logger.log('Connecting to PostgreSQL database via Prisma...');
    await this.$connect();
    this.logger.log('PostgreSQL database connection established successfully.');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from PostgreSQL database...');
    await this.$disconnect();
    this.logger.log('PostgreSQL database connection closed.');
  }
}
