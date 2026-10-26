import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';

export interface IdempotencyCheckResult {
  isCached: boolean;
  status?: number;
  body?: unknown;
  recordId?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a deterministic SHA-256 hash of the request body.
   */
  hashPayload(payload: unknown): string {
    const serialized = payload ? JSON.stringify(payload) : '';
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Checks or locks an idempotency key.
   * If already processed, returns the cached response.
   * If currently processing, throws a 409 Conflict.
   * If new, locks the key for processing.
   */
  async lockKey(
    companyId: string,
    userId: string,
    endpoint: string,
    key: string,
    payload: unknown,
  ): Promise<IdempotencyCheckResult> {
    const requestHash = this.hashPayload(payload);
    const now = new Date();

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        companyId_key: {
          companyId,
          key,
        },
      },
    });

    if (existing) {
      // Check for expiration
      if (existing.expiresAt < now) {
        await this.prisma.idempotencyKey.delete({ where: { id: existing.id } });
      } else if (existing.responseStatus === null) {
        // In-flight concurrent request with the same idempotency key
        throw new ConflictException(
          `A mutation with idempotency key "${key}" is currently in progress. Please wait for completion.`,
        );
      } else {
        // Return cached response
        this.logger.debug(
          `Idempotency cache hit for key "${key}" on endpoint "${endpoint}" (status ${existing.responseStatus}).`,
        );
        return {
          isCached: true,
          status: existing.responseStatus,
          body: existing.responseBody,
        };
      }
    }

    // Register lock
    const expiresAt = new Date(now.getTime() + this.TTL_HOURS * 60 * 60 * 1000);
    const created = await this.prisma.idempotencyKey.create({
      data: {
        companyId,
        userId,
        endpoint,
        key,
        requestHash,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        expiresAt,
      },
    });

    return {
      isCached: false,
      recordId: created.id,
    };
  }

  /**
   * Caches response status and body after successful operation completion.
   */
  async saveResponse(companyId: string, key: string, status: number, body: unknown) {
    try {
      const sanitizedBody = body ? (body as Prisma.InputJsonValue) : Prisma.DbNull;
      await this.prisma.idempotencyKey.update({
        where: {
          companyId_key: {
            companyId,
            key,
          },
        },
        data: {
          responseStatus: status,
          responseBody: sanitizedBody,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to cache idempotency response for key "${key}": ${(error as Error).message}`);
    }
  }

  /**
   * Releases key in case of unhandled server exception so client can retry.
   */
  async releaseKey(companyId: string, key: string) {
    try {
      await this.prisma.idempotencyKey.deleteMany({
        where: {
          companyId,
          key,
          responseStatus: null, // only delete if not already completed
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to release idempotency key "${key}": ${(error as Error).message}`);
    }
  }
}
