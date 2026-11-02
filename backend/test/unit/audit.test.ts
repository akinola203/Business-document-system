import { test } from 'node:test';
import * as assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../src/modules/audit/audit.service';
import { applySoftDeleteMiddlewareParams } from '../../src/modules/prisma/prisma.service';
import { HealthController } from '../../src/modules/health/health.controller';

test('AuditService Unit Tests', async (t) => {
  const auditLogsStore: any[] = [];

  const mockPrisma: any = {
    auditLog: {
      create: async ({ data }: any) => {
        const record = { id: `aud-${auditLogsStore.length + 1}`, ...data, createdAt: new Date() };
        auditLogsStore.push(record);
        return record;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let filtered = [...auditLogsStore];
        if (where?.companyId) filtered = filtered.filter((l) => l.companyId === where.companyId);
        if (where?.entityType) {
          const expected = typeof where.entityType === 'object' && 'equals' in where.entityType ? where.entityType.equals : where.entityType;
          filtered = filtered.filter((l) => l.entityType?.toLowerCase() === String(expected)?.toLowerCase());
        }
        if (where?.entityId) filtered = filtered.filter((l) => l.entityId === where.entityId);
        if (where?.action) filtered = filtered.filter((l) => l.action === where.action);
        return filtered.slice(skip, skip + take);
      },
      count: async ({ where }: any) => {
        let filtered = [...auditLogsStore];
        if (where?.companyId) filtered = filtered.filter((l) => l.companyId === where.companyId);
        if (where?.entityType) {
          const expected = typeof where.entityType === 'object' && 'equals' in where.entityType ? where.entityType.equals : where.entityType;
          filtered = filtered.filter((l) => l.entityType?.toLowerCase() === String(expected)?.toLowerCase());
        }
        return filtered.length;
      },
    },
  };

  const auditService = new AuditService(mockPrisma);

  await t.test('sanitize recursively scrubs passwords, tokens, and sensitive secrets', () => {
    const rawPayload = {
      username: 'admin@aoa77.com',
      password: 'SuperSecretPassword123!',
      passwordHash: '$argon2id$v=19$m=65536...',
      nested: {
        refreshToken: 'uuid-refresh-token',
        accessToken: 'bearer-jwt-token',
        cvv: '123',
        pin: '9999',
        publicNote: 'Payment processed',
      },
      items: [
        { name: 'Item 1', secret: 'secret-key-xyz' },
        { name: 'Item 2', amount: 5000 },
      ],
    };

    const sanitized = auditService.sanitize(rawPayload) as any;

    assert.equal(sanitized.username, 'admin@aoa77.com');
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.passwordHash, '[REDACTED]');
    assert.equal(sanitized.nested.refreshToken, '[REDACTED]');
    assert.equal(sanitized.nested.accessToken, '[REDACTED]');
    assert.equal(sanitized.nested.cvv, '[REDACTED]');
    assert.equal(sanitized.nested.pin, '[REDACTED]');
    assert.equal(sanitized.nested.publicNote, 'Payment processed');
    assert.equal(sanitized.items[0].secret, '[REDACTED]');
    assert.equal(sanitized.items[1].amount, 5000);
  });

  await t.test('logAction records audit entry with sanitized values', async () => {
    const log = await auditService.logAction({
      companyId: 'comp-1',
      actorId: 'usr-1',
      action: 'INVOICE_CREATED',
      entityType: 'Document',
      entityId: 'doc-100',
      oldValues: null,
      newValues: {
        documentNumber: 'INV-2026-000001',
        totalAmount: '450000.00',
        token: 'secret-token-value',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    });

    assert.ok(log);
    assert.equal(log.action, 'INVOICE_CREATED');
    assert.equal(log.entityType, 'Document');
    assert.equal((log.newValues as any).documentNumber, 'INV-2026-000001');
    assert.equal((log.newValues as any).token, '[REDACTED]');
    assert.equal(log.ipAddress, '127.0.0.1');
  });

  await t.test('findAll returns paginated audit records with meta', async () => {
    const result = await auditService.findAll('comp-1', { page: 1, limit: 10 });
    assert.equal(result.items.length, 1);
    assert.equal(result.meta.total, 1);
    assert.equal(result.meta.page, 1);
  });

  await t.test('getEntityHistory returns chronological history for a specific entity', async () => {
    const history = await auditService.getEntityHistory('comp-1', 'Document', 'doc-100');
    assert.equal(history.length, 1);
    assert.equal(history[0].entityId, 'doc-100');
  });

  await t.test('sanitize redacts substring-matched keys (/pass|token|secret|authorization|cvv|pin$|hash/i)', () => {
    const payload = {
      authorizationHeader: 'Bearer eyJhbGci...',
      userPin: '1234',
      pinNumber: 'not-ending-in-pin',
      apiSecretKey: 'sk_live_123',
      resetTokenHash: 'sha256-digest',
      adminPasscode: 'pass-999',
    };

    const sanitized = auditService.sanitize(payload) as any;
    assert.equal(sanitized.authorizationHeader, '[REDACTED]');
    assert.equal(sanitized.userPin, '[REDACTED]');
    assert.equal(sanitized.pinNumber, 'not-ending-in-pin');
    assert.equal(sanitized.apiSecretKey, '[REDACTED]');
    assert.equal(sanitized.resetTokenHash, '[REDACTED]');
    assert.equal(sanitized.adminPasscode, '[REDACTED]');
  });

  await t.test('Prisma soft-delete middleware injects deletedAt: null on aggregate and groupBy queries', () => {
    const aggParams: any = { model: 'Document', action: 'aggregate', args: { where: { companyId: 'comp-1' } } };
    applySoftDeleteMiddlewareParams(aggParams);
    assert.strictEqual(aggParams.args.where.deletedAt, null);

    const groupByParams: any = { model: 'Client', action: 'groupBy', args: {} };
    applySoftDeleteMiddlewareParams(groupByParams);
    assert.strictEqual(groupByParams.args.where.deletedAt, null);
  });

  await t.test('HealthController requires internal health token or audit:view permission on /health/database and /health/storage', async () => {
    const prevToken = process.env.HEALTH_CHECK_TOKEN;
    process.env.HEALTH_CHECK_TOKEN = 'internal-health-secret-token';

    const healthController = new HealthController({
      $queryRaw: async () => [{ '?column?': 1 }],
    } as any);

    // Rejects when neither valid token nor audit:view user is provided
    await assert.rejects(
      async () => {
        await healthController.checkDatabase(
          { headers: { 'x-health-token': 'wrong-token' } } as any,
          { permissions: [] } as any,
        );
      },
      ForbiddenException,
    );

    // Succeeds with valid x-health-token
    const dbHealth = await healthController.checkDatabase(
      { headers: { 'x-health-token': 'internal-health-secret-token' } } as any,
      undefined,
    );
    assert.strictEqual(dbHealth.database, 'connected');
    assert.strictEqual((dbHealth as any).nodeVersion, undefined);

    // Succeeds with audit:view user even without token
    const storageHealth = await healthController.checkStorage(undefined, {
      role: 'Staff',
      permissions: ['audit:view'],
    } as any);
    assert.strictEqual(storageHealth.storage, 'writable');
    assert.strictEqual((storageHealth as any).storagePath, undefined);

    if (prevToken === undefined) delete process.env.HEALTH_CHECK_TOKEN;
    else process.env.HEALTH_CHECK_TOKEN = prevToken;
  });
});
