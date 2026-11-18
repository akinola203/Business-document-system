import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  PrismaService,
  tuneConnectionPoolUrl,
} from '../../src/modules/prisma/prisma.service';
import { TenantCacheService } from '../../src/modules/cache/tenant-cache.service';
import { CompaniesService } from '../../src/modules/companies/companies.service';
import { RolesService } from '../../src/modules/iam/roles.service';
import { BranchesService } from '../../src/modules/organization/branches.service';

test('Connection Pool Tuning Tests', async (t) => {
  await t.test('adds connection_limit and pool_timeout when missing', () => {
    const tuned = tuneConnectionPoolUrl(
      'postgresql://user:pass@localhost:5432/aoa77?schema=public',
      { connectionLimit: 25, poolTimeout: 30 },
    );
    assert.ok(tuned);
    const parsed = new URL(tuned!);
    assert.strictEqual(parsed.searchParams.get('connection_limit'), '25');
    assert.strictEqual(parsed.searchParams.get('pool_timeout'), '30');
    assert.strictEqual(parsed.searchParams.get('schema'), 'public');
  });

  await t.test('preserves explicit URL pool settings unless overrideExisting is true', () => {
    const existing = 'postgresql://user:pass@localhost:5432/aoa77?connection_limit=10&pool_timeout=15';
    const preserved = tuneConnectionPoolUrl(existing, {
      connectionLimit: 40,
      poolTimeout: 60,
      overrideExisting: false,
    });
    assert.strictEqual(new URL(preserved!).searchParams.get('connection_limit'), '10');
    assert.strictEqual(new URL(preserved!).searchParams.get('pool_timeout'), '15');

    const overridden = tuneConnectionPoolUrl(existing, {
      connectionLimit: 40,
      poolTimeout: 60,
      overrideExisting: true,
    });
    assert.strictEqual(new URL(overridden!).searchParams.get('connection_limit'), '40');
    assert.strictEqual(new URL(overridden!).searchParams.get('pool_timeout'), '60');
  });

  await t.test('automatically enforces sslmode=require for remote cloud PostgreSQL hosts (e.g. Neon)', () => {
    const neonUrl = 'postgresql://user:pass@ep-cool-lake-123456.eu-central-1.aws.neon.tech:5432/aoa77?schema=public';
    const tuned = tuneConnectionPoolUrl(neonUrl, {
      connectionLimit: 20,
      poolTimeout: 30,
    });
    assert.ok(tuned);
    const parsed = new URL(tuned!);
    assert.strictEqual(parsed.searchParams.get('sslmode'), 'require');
    assert.strictEqual(parsed.searchParams.get('connection_limit'), '20');
  });
});

test('PrismaService Primary-Replica Read/Write Splitting Tests', async (t) => {
  const prevReplicaEnv = process.env.DATABASE_READ_REPLICA_URL;
  const prevWindowEnv = process.env.DB_READ_AFTER_WRITE_WINDOW_MS;
  delete process.env.DATABASE_READ_REPLICA_URL;
  process.env.DB_READ_AFTER_WRITE_WINDOW_MS = '2000';

  const prisma = new PrismaService();
  const primaryCalls: Array<{ model: string; action: string; args: any }> = [];
  const replicaCalls: Array<{ model: string; action: string; args: any }> = [];

  // Stub internal primary Prisma execution engine so $extends executes end-to-end offline
  (prisma as any)._executeRequest = async (params: any) => {
    primaryCalls.push({ model: params.model, action: params.action, args: params.args });
    if (params.action === 'create') {
      return { id: 'pay-created-1', companyId: params.args?.data?.companyId || 'comp-a', currency: 'NGN' };
    }
    if (params.action === 'update') {
      return { id: params.args?.where?.id || 'pay-created-1', companyId: 'comp-a', currency: 'USD' };
    }
    if (params.action === 'upsert') {
      return { id: 'comp-setting-1', companyId: params.args?.where?.companyId || 'comp-a' };
    }
    if (params.action === 'delete') {
      return { id: params.args?.where?.id || 'pay-created-1' };
    }
    if (params.action === 'aggregate') {
      return { _count: { _all: 5 } };
    }
    if (params.action === 'findUnique') {
      return { id: params.args?.where?.id || 'pay-created-1', source: 'primary' };
    }
    return [{ id: 'pay-primary-1', source: 'primary' }];
  };

  let failNextReplicaCall = false;
  const mockReplicaClient: any = {
    payment: {
      findMany: async (args: any) => {
        if (failNextReplicaCall) {
          failNextReplicaCall = false;
          const err: any = new Error("Can't reach database server at replica:5432");
          err.code = 'P1001';
          throw err;
        }
        replicaCalls.push({ model: 'Payment', action: 'findMany', args });
        return [{ id: 'pay-replica-1', source: 'replica' }];
      },
      findUnique: async (args: any) => {
        replicaCalls.push({ model: 'Payment', action: 'findUnique', args });
        return { id: args?.where?.id || 'pay-replica-1', source: 'replica' };
      },
      aggregate: async (args: any) => {
        replicaCalls.push({ model: 'Payment', action: 'aggregate', args });
        return { _count: { _all: 42 } };
      },
    },
    document: {
      findMany: async (args: any) => {
        replicaCalls.push({ model: 'Document', action: 'findMany', args });
        return [{ id: 'doc-replica-1', deletedAt: args?.where?.deletedAt }];
      },
    },
    $disconnect: async () => {},
  };

  prisma.setReadReplicaClient(mockReplicaClient);

  const resetTrace = () => {
    primaryCalls.length = 0;
    replicaCalls.length = 0;
    prisma.clearRecentWrites();
    prisma.resetRoutingStats();
  };

  await t.test('routes findMany, findUnique, and aggregate to Read Replica when no recent writes exist', async () => {
    resetTrace();

    const list: any = await prisma.payment.findMany({ where: { companyId: 'comp-a' } });
    const single: any = await prisma.payment.findUnique({ where: { id: 'pay-123' } });
    const agg: any = await prisma.payment.aggregate({
      where: { companyId: 'comp-a' },
      _count: { _all: true },
    });

    assert.strictEqual(list[0].source, 'replica');
    assert.strictEqual(single.source, 'replica');
    assert.strictEqual(agg._count._all, 42);
    assert.strictEqual(replicaCalls.length, 3);
    assert.strictEqual(primaryCalls.length, 0);
    assert.strictEqual(prisma.getRoutingStats().replicaQueries, 3);
  });

  await t.test('applies soft-delete deletedAt=null filter on Replica reads', async () => {
    resetTrace();
    await prisma.document.findMany({ where: { companyId: 'comp-a' } });
    assert.strictEqual(replicaCalls.length, 1);
    assert.strictEqual(replicaCalls[0].args.where.deletedAt, null);
  });

  await t.test('routes create, update, upsert, and delete strictly to Primary', async () => {
    resetTrace();

    await prisma.payment.create({
      data: {
        companyId: 'comp-a',
        invoiceId: 'inv-1',
        paymentNumber: 'PAY-2026-000001',
        amount: 1000,
        currency: 'NGN',
        referenceNumber: 'REF-001',
        recordedById: 'user-1',
      },
    });
    await prisma.payment.update({
      where: { id: 'pay-created-1' },
      data: { notes: 'Updated remittance reference' },
    });
    await prisma.companySetting.upsert({
      where: { companyId: 'comp-a' },
      update: { defaultPaymentTermsDays: 14 },
      create: { companyId: 'comp-a', defaultPaymentTermsDays: 14 },
    });
    await prisma.payment.delete({
      where: { id: 'pay-created-1' },
    });

    assert.strictEqual(replicaCalls.length, 0);
    assert.strictEqual(primaryCalls.length, 4);
    assert.deepStrictEqual(
      primaryCalls.map((c) => c.action),
      ['create', 'update', 'upsert', 'delete'],
    );
  });

  await t.test('pins recent mutation reads to Primary to prevent replication lag, while isolating other tenants to Replica', async () => {
    resetTrace();

    // Tenant A performs a mutation
    const created: any = await prisma.payment.create({
      data: {
        companyId: 'comp-a',
        invoiceId: 'inv-2',
        paymentNumber: 'PAY-2026-000002',
        amount: 500,
        currency: 'NGN',
        referenceNumber: 'REF-002',
        recordedById: 'user-1',
      },
    });

    // Immediate read by Tenant A (both findMany by companyId AND findUnique by id alone) MUST go to Primary!
    const tenantAList: any = await prisma.payment.findMany({ where: { companyId: 'comp-a' } });
    const tenantASingle: any = await prisma.payment.findUnique({ where: { id: created.id } });

    assert.strictEqual(tenantAList[0].source, 'primary');
    assert.strictEqual(tenantASingle.source, 'primary');
    assert.strictEqual(prisma.getRoutingStats().consistencyPinnedReads, 2);

    // Meanwhile, Tenant B's reads are NOT impacted and still route to Read Replica
    const tenantBList: any = await prisma.payment.findMany({ where: { companyId: 'comp-b' } });
    assert.strictEqual(tenantBList[0].source, 'replica');
    assert.strictEqual(replicaCalls.length, 1);

    // Once the consistency window clears/expires, Tenant A returns to Read Replica
    prisma.clearRecentWrites();
    const tenantALater: any = await prisma.payment.findMany({ where: { companyId: 'comp-a' } });
    assert.strictEqual(tenantALater[0].source, 'replica');
  });

  await t.test('fails over cleanly to Primary if Read Replica encounters a connection error', async () => {
    resetTrace();
    failNextReplicaCall = true;

    const result: any = await prisma.payment.findMany({ where: { companyId: 'comp-a' } });
    assert.strictEqual(result[0].source, 'primary');
    assert.strictEqual(prisma.getRoutingStats().replicaFailovers, 1);
  });

  await t.test('runOnPrimary forces reads inside async block to Primary', async () => {
    resetTrace();

    const result: any = await prisma.runOnPrimary(async () => {
      return prisma.payment.findMany({ where: { companyId: 'comp-a' } });
    });

    assert.strictEqual(result[0].source, 'primary');
    assert.strictEqual(replicaCalls.length, 0);
  });

  // Restore env
  if (prevReplicaEnv !== undefined) {
    process.env.DATABASE_READ_REPLICA_URL = prevReplicaEnv;
  }
  if (prevWindowEnv !== undefined) {
    process.env.DB_READ_AFTER_WRITE_WINDOW_MS = prevWindowEnv;
  } else {
    delete process.env.DB_READ_AFTER_WRITE_WINDOW_MS;
  }
  await prisma.$disconnect().catch(() => {});
});

test('Tenant-Scoped Caching Layer Tests', async (t) => {
  await t.test('enforces strict tenant namespacing and refuses empty companyId', async () => {
    const cache = new TenantCacheService();
    cache.setRedisClient(null, false);

    assert.throws(() => cache.buildTenantKey('', 'company', 'profile'));
    const keyA = cache.buildTenantKey('comp-a', 'company', 'profile');
    const keyB = cache.buildTenantKey('comp-b', 'company', 'profile');
    assert.notStrictEqual(keyA, keyB);
    assert.ok(keyA.includes('tenant:comp-a:company:profile'));
  });

  await t.test('uses Redis client when connected and invalidates namespace cleanly', async () => {
    const cache = new TenantCacheService();
    const fakeRedisStore = new Map<string, string>();
    const mockRedis: any = {
      get: async (k: string) => fakeRedisStore.get(k) ?? null,
      set: async (k: string, v: string) => {
        fakeRedisStore.set(k, v);
        return 'OK';
      },
      del: async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (fakeRedisStore.delete(k)) count += 1;
        }
        return count;
      },
      scan: async (_cursor: string, _match: string, pattern: string) => {
        const prefix = pattern.replace(/\*$/, '');
        const matched = Array.from(fakeRedisStore.keys()).filter((k) => k.startsWith(prefix));
        return ['0', matched];
      },
      quit: async () => 'OK',
    };

    cache.setRedisClient(mockRedis, true);

    let dbHits = 0;
    const companyLoader = async () => {
      dbHits += 1;
      return { id: 'comp-a', name: 'AOA 77 Ltd' };
    };

    const first = await cache.getOrSetTenant('comp-a', 'company', 'profile', 300, companyLoader);
    const second = await cache.getOrSetTenant('comp-a', 'company', 'profile', 300, companyLoader);

    assert.strictEqual(dbHits, 1, 'Second read must be served from Redis cache');
    assert.strictEqual(first.name, 'AOA 77 Ltd');
    assert.strictEqual(second.name, 'AOA 77 Ltd');
    assert.strictEqual(cache.getStats().hits, 1);
    assert.strictEqual(cache.getStats().misses, 1);

    await cache.invalidateTenantNamespace('comp-a', 'company');
    const third = await cache.getOrSetTenant('comp-a', 'company', 'profile', 300, companyLoader);
    assert.strictEqual(dbHits, 2, 'Read after invalidation must re-query DB');
    assert.strictEqual(third.name, 'AOA 77 Ltd');

    await cache.onModuleDestroy();
  });

  await t.test('CompaniesService, RolesService, and BranchesService utilize TenantCacheService and invalidate on mutation', async () => {
    const cache = new TenantCacheService();
    cache.setRedisClient(null, false);

    let companyDbQueries = 0;
    let roleDbQueries = 0;
    let branchDbQueries = 0;

    let companyName = 'Initial Co';
    const mockPrisma: any = {
      company: {
        findUnique: async ({ where }: any) => {
          companyDbQueries += 1;
          return { id: where.id, name: companyName, settings: null };
        },
        update: async ({ data }: any) => {
          companyName = data.name;
          return { id: 'comp-a', name: companyName, settings: null };
        },
      },
      role: {
        findMany: async () => {
          roleDbQueries += 1;
          return [{ id: 'role-1', name: 'Admin', rolePermissions: [] }];
        },
      },
      branch: {
        findMany: async () => {
          branchDbQueries += 1;
          return [{ id: 'br-1', code: 'HQ', name: 'Head Office' }];
        },
        findUnique: async () => null,
        create: async ({ data }: any) => ({ id: 'br-2', ...data }),
      },
      auditLog: {
        create: async () => ({ id: 'aud-1' }),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    const companiesService = new CompaniesService(mockPrisma, cache);
    const rolesService = new RolesService(mockPrisma, { logAction: async () => {} } as any, cache);
    const branchesService = new BranchesService(mockPrisma, cache);

    // 1. Company caching + invalidation
    await companiesService.getCurrentCompany('comp-a');
    await companiesService.getCurrentCompany('comp-a');
    assert.strictEqual(companyDbQueries, 1);

    await companiesService.updateCompany('comp-a', { name: 'Updated Co' }, 'user-1');
    const updatedCo = await companiesService.getCurrentCompany('comp-a');
    assert.strictEqual(updatedCo.name, 'Updated Co');
    assert.strictEqual(companyDbQueries, 2); // 1 initial cache fill + 1 after cache invalidation

    // 2. Roles caching
    await rolesService.findAllRoles('comp-a');
    await rolesService.findAllRoles('comp-a');
    assert.strictEqual(roleDbQueries, 1);

    // 3. Branches caching + invalidation
    await branchesService.findAll('comp-a', true);
    await branchesService.findAll('comp-a', true);
    assert.strictEqual(branchDbQueries, 1);

    await branchesService.create('comp-a', { code: 'ABJ', name: 'Abuja Branch' }, 'user-1');
    await branchesService.findAll('comp-a', true);
    assert.strictEqual(branchDbQueries, 2);
  });
});
