import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

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
      errorFormat: 'pretty',
    });

    // Global Soft-Delete Query Middleware:
    // Automatically excludes soft-deleted rows (deletedAt != null) on findFirst, findMany, count, aggregate, and groupBy
    // unless caller explicitly specifies `deletedAt` in the `where` clause.
    this.$use(async (params, next) => {
      applySoftDeleteMiddlewareParams(params);
      return next(params);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database via Prisma.');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database.');
  }
}
