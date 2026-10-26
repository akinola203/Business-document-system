import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { Prisma } from '@prisma/client';

export interface AuditLogOptions {
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  private readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'refreshtoken',
    'accesstoken',
    'secret',
    'authorization',
    'creditcard',
    'cvv',
    'pin',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recursively sanitizes payloads to ensure sensitive credentials and secrets are never persisted in audit trails.
   */
  sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitizedObj[key] = this.sanitize(value);
      } else {
        sanitizedObj[key] = value;
      }
    }

    return sanitizedObj;
  }

  /**
   * Persists an audit log entry. Supports optional external transaction context.
   */
  async logAction(options: AuditLogOptions, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    const sanitizedOld = options.oldValues ? (this.sanitize(options.oldValues) as Prisma.InputJsonValue) : undefined;
    const sanitizedNew = options.newValues ? (this.sanitize(options.newValues) as Prisma.InputJsonValue) : undefined;

    try {
      const record = await db.auditLog.create({
        data: {
          companyId: options.companyId,
          actorId: options.actorId || null,
          action: options.action,
          entityType: options.entityType,
          entityId: options.entityId,
          oldValues: sanitizedOld,
          newValues: sanitizedNew,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null,
        },
      });

      return record;
    } catch (error) {
      this.logger.error(`Failed to record audit log for action "${options.action}": ${(error as Error).message}`);
      // Audit failures in background shouldn't silently swallow if tx fails, but if outside tx, avoid crashing caller
      if (tx) throw error;
      return null;
    }
  }

  /**
   * Retrieves paginated audit logs for a company with optional filters.
   */
  async findAll(companyId: string, query: QueryAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      entityType,
      entityId,
      action,
      actorId,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      companyId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves chronological audit history for a specific entity.
   */
  async getEntityHistory(companyId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId,
        entityType,
        entityId,
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
