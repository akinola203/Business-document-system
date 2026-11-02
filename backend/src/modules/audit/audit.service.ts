import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { Prisma } from '@prisma/client';

const SENSITIVE_KEY_REGEX = /pass|token|secret|authorization|cvv|pin$|hash/i;

export interface CreateAuditLogInput {
  companyId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Deeply sanitizes an object to redact passwords, tokens, and sensitive keys
   * before persisting to the immutable audit trail.
   */
  sanitize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitize(val);
        }
      }
      return result;
    }

    return value;
  }

  /**
   * Records an immutable audit entry. Can be invoked either standalone or inside a Prisma transaction.
   */
  async logAction(
    input: CreateAuditLogInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const oldSanitized = input.oldValues ? (this.sanitize(input.oldValues) as Prisma.InputJsonValue) : Prisma.DbNull;
    const newSanitized = input.newValues ? (this.sanitize(input.newValues) as Prisma.InputJsonValue) : Prisma.DbNull;

    try {
      return await client.auditLog.create({
        data: {
          companyId: input.companyId,
          actorId: input.actorId || null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: oldSanitized,
          newValues: newSanitized,
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for ${input.action} on ${input.entityType}:${input.entityId}`, error);
      // Do not crash the business operation if standalone audit logging fails unless inside tx
      if (tx) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Lists paginated and filtered audit logs for a company.
   */
  async findAll(companyId: string, query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      companyId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
    };

    const from = query.startDate || query.dateFrom;
    const to = query.endDate || query.dateTo;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
   * Retrieves chronological audit history for a specific entity (e.g., Document ID).
   */
  async getEntityHistory(companyId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        companyId,
        entityType: { equals: entityType, mode: 'insensitive' },
        entityId,
      },
      orderBy: { createdAt: 'desc' },
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
    });
  }
}
