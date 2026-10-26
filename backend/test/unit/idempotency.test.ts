import { test } from 'node:test';
import * as assert from 'node:assert';
import { IdempotencyService } from '../../src/modules/idempotency/idempotency.service';
import { ConflictException } from '@nestjs/common';

test('IdempotencyService Unit Tests', async (t) => {
  const idempotencyKeysStore: Map<string, any> = new Map();

  const mockPrisma: any = {
    idempotencyKey: {
      findUnique: async ({ where }: any) => {
        const compositeKey = `${where.companyId_key.companyId}:${where.companyId_key.key}`;
        return idempotencyKeysStore.get(compositeKey) || null;
      },
      create: async ({ data }: any) => {
        const record = { id: `key-${idempotencyKeysStore.size + 1}`, ...data };
        const compositeKey = `${data.companyId}:${data.key}`;
        idempotencyKeysStore.set(compositeKey, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const compositeKey = `${where.companyId_key.companyId}:${where.companyId_key.key}`;
        const existing = idempotencyKeysStore.get(compositeKey);
        const updated = { ...existing, ...data };
        idempotencyKeysStore.set(compositeKey, updated);
        return updated;
      },
      delete: async ({ where }: any) => {
        for (const [k, v] of idempotencyKeysStore.entries()) {
          if (v.id === where.id) {
            idempotencyKeysStore.delete(k);
            break;
          }
        }
      },
      deleteMany: async ({ where }: any) => {
        const compositeKey = `${where.companyId}:${where.key}`;
        idempotencyKeysStore.delete(compositeKey);
        return { count: 1 };
      },
    },
  };

  const service = new IdempotencyService(mockPrisma);

  await t.test('hashPayload produces consistent SHA-256 hex string', () => {
    const payload = { title: 'Test Invoice', amount: 50000 };
    const hash1 = service.hashPayload(payload);
    const hash2 = service.hashPayload(payload);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  await t.test('lockKey creates initial lock when key is new', async () => {
    const result = await service.lockKey(
      'comp-1',
      'usr-1',
      '/invoices',
      'req-key-001',
      { title: 'New Invoice' },
    );

    assert.equal(result.isCached, false);
    assert.ok(result.recordId);
  });

  await t.test('lockKey throws ConflictException when identical key is currently in-flight', async () => {
    await assert.rejects(
      async () => {
        await service.lockKey(
          'comp-1',
          'usr-1',
          '/invoices',
          'req-key-001',
          { title: 'New Invoice' },
        );
      },
      (err: any) => {
        assert.ok(err instanceof ConflictException);
        assert.match(err.message, /currently in progress/);
        return true;
      },
    );
  });

  await t.test('saveResponse updates cached status and body', async () => {
    await service.saveResponse('comp-1', 'req-key-001', 201, {
      id: 'inv-1',
      documentNumber: 'INV-2026-000001',
    });

    const compositeKey = 'comp-1:req-key-001';
    const saved = idempotencyKeysStore.get(compositeKey);
    assert.equal(saved.responseStatus, 201);
    assert.equal(saved.responseBody.documentNumber, 'INV-2026-000001');
  });

  await t.test('lockKey returns cached result when key was previously completed', async () => {
    const result = await service.lockKey(
      'comp-1',
      'usr-1',
      '/invoices',
      'req-key-001',
      { title: 'New Invoice' },
    );

    assert.equal(result.isCached, true);
    assert.equal(result.status, 201);
    assert.equal((result.body as any).documentNumber, 'INV-2026-000001');
  });

  await t.test('releaseKey clears pending key on handler failure so client can retry', async () => {
    await service.lockKey('comp-1', 'usr-1', '/invoices', 'retry-key-002', { title: 'Fail' });
    await service.releaseKey('comp-1', 'retry-key-002');

    const result = await service.lockKey('comp-1', 'usr-1', '/invoices', 'retry-key-002', { title: 'Retry' });
    assert.equal(result.isCached, false);
  });
});
