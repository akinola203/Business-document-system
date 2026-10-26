import { test } from 'node:test';
import * as assert from 'node:assert';
import { AuditService } from '../../src/modules/audit/audit.service';

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
        if (where?.entityType) filtered = filtered.filter((l) => l.entityType === where.entityType);
        if (where?.entityId) filtered = filtered.filter((l) => l.entityId === where.entityId);
        if (where?.action) filtered = filtered.filter((l) => l.action === where.action);
        return filtered.slice(skip, skip + take);
      },
      count: async ({ where }: any) => {
        let filtered = [...auditLogsStore];
        if (where?.companyId) filtered = filtered.filter((l) => l.companyId === where.companyId);
        if (where?.entityType) filtered = filtered.filter((l) => l.entityType === where.entityType);
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
});
