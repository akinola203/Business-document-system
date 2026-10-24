import { test } from 'node:test';
import * as assert from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from '../../src/modules/organization/departments.service';
import { BranchesService } from '../../src/modules/organization/branches.service';

test('Organization (Departments & Branches) Unit Tests', async (t) => {
  let departmentsDb: any[] = [];
  let branchesDb: any[] = [];
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    department: {
      findMany: async () => departmentsDb,
      findFirst: async ({ where }: any) => departmentsDb.find((d) => d.id === where.id && d.companyId === where.companyId),
      findUnique: async ({ where }: any) => {
        if (where.companyId_code) {
          return departmentsDb.find(
            (d) => d.companyId === where.companyId_code.companyId && d.code === where.companyId_code.code,
          );
        }
        return departmentsDb.find((d) => d.id === where.id);
      },
      create: async ({ data }: any) => {
        const item = { id: `dept-${departmentsDb.length + 1}`, isActive: true, ...data };
        departmentsDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = departmentsDb.findIndex((d) => d.id === where.id);
        departmentsDb[idx] = { ...departmentsDb[idx], ...data };
        return departmentsDb[idx];
      },
    },
    branch: {
      findMany: async () => branchesDb,
      findFirst: async ({ where }: any) => branchesDb.find((b) => b.id === where.id && b.companyId === where.companyId),
      findUnique: async ({ where }: any) => {
        if (where.companyId_code) {
          return branchesDb.find(
            (b) => b.companyId === where.companyId_code.companyId && b.code === where.companyId_code.code,
          );
        }
        return branchesDb.find((b) => b.id === where.id);
      },
      create: async ({ data }: any) => {
        const item = { id: `branch-${branchesDb.length + 1}`, isActive: true, ...data };
        branchesDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = branchesDb.findIndex((b) => b.id === where.id);
        branchesDb[idx] = { ...branchesDb[idx], ...data };
        return branchesDb[idx];
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: 'audit-1', ...data };
      },
    },
  };

  const deptService = new DepartmentsService(mockPrisma);
  const branchService = new BranchesService(mockPrisma);

  await t.test('DepartmentsService creates unique department and rejects duplicates', async () => {
    departmentsDb = [];
    const dept = await deptService.create(
      'comp-1',
      { code: 'acct', name: 'Finance & Accounts', description: 'Financial ledger' },
      'usr-1',
    );

    assert.equal(dept.code, 'ACCT');
    assert.equal(dept.name, 'Finance & Accounts');

    await assert.rejects(
      async () => {
        await deptService.create('comp-1', { code: 'ACCT', name: 'Duplicate Dept' }, 'usr-1');
      },
      ConflictException,
    );
  });

  await t.test('DepartmentsService deactivates department without dropping data', async () => {
    const dept = departmentsDb[0];
    const deactivated = await deptService.remove('comp-1', dept.id, 'usr-1');
    assert.equal(deactivated.isActive, false);
  });

  await t.test('BranchesService creates unique branch and rejects duplicates', async () => {
    branchesDb = [];
    const branch = await branchService.create(
      'comp-1',
      {
        code: 'ota-hq',
        name: 'Ota Headquarters',
        address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota',
      },
      'usr-1',
    );

    assert.equal(branch.code, 'OTA-HQ');
    assert.equal(branch.name, 'Ota Headquarters');

    await assert.rejects(
      async () => {
        await branchService.create('comp-1', { code: 'OTA-HQ', name: 'Duplicate Branch' }, 'usr-1');
      },
      ConflictException,
    );
  });

  await t.test('BranchesService updates contact information', async () => {
    const branch = branchesDb[0];
    const updated = await branchService.update(
      'comp-1',
      branch.id,
      { phone: '+234 803 000 9999', email: 'operations-ota@aoa77.com' },
      'usr-1',
    );

    assert.equal(updated.phone, '+234 803 000 9999');
    assert.equal(updated.email, 'operations-ota@aoa77.com');
  });
});
