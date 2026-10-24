import { test } from 'node:test';
import * as assert from 'node:assert';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/modules/auth/auth.service';

test('AuthService Unit Tests', async (t) => {
  let mockUserDb: any = null;
  let updateCalls: any[] = [];

  const mockPrisma: any = {
    user: {
      findUnique: async () => mockUserDb,
      update: async (args: any) => {
        updateCalls.push(args);
        return { ...mockUserDb, ...args.data };
      },
    },
    refreshToken: {
      create: async (args: any) => args.data,
      findUnique: async () => null,
      update: async () => ({}),
      updateMany: async () => ({}),
    },
  };

  const mockJwtService: any = {
    sign: () => 'mock-access-token-jwt',
  };

  const mockConfigService: any = {
    get: (key: string, defaultVal: any) => defaultVal,
  };

  const authService = new AuthService(mockPrisma, mockJwtService, mockConfigService);

  await t.test('throws UnauthorizedException if user does not exist', async () => {
    mockUserDb = null;
    await assert.rejects(
      async () => {
        await authService.login({ email: 'unknown@aoa77.com', password: 'password123' });
      },
      UnauthorizedException,
    );
  });

  await t.test('throws ForbiddenException if user is locked out', async () => {
    mockUserDb = {
      id: 'usr-1',
      email: 'locked@aoa77.com',
      lockoutUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      isActive: true,
    };
    await assert.rejects(
      async () => {
        await authService.login({ email: 'locked@aoa77.com', password: 'password123' });
      },
      ForbiddenException,
    );
  });

  await t.test('tracks failed attempts and triggers lockout after 5 consecutive failures', async () => {
    updateCalls = [];
    const passwordHash = await argon2.hash('SecretAOA77!');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash,
      failedLoginAttempts: 4, // 4 failed attempts previously
      lockoutUntil: null,
      isActive: true,
      companyUsers: [
        {
          companyId: 'comp-1',
          status: 'ACTIVE',
          role: {
            name: 'Staff',
            rolePermissions: [{ permission: { slug: 'invoice:create' } }],
          },
          company: { id: 'comp-1', name: 'AOA 77 COMPANY LTD' },
        },
      ],
    };

    // Attempt with incorrect password
    await assert.rejects(
      async () => {
        await authService.login({ email: 'staff@aoa77.com', password: 'WrongPassword!' });
      },
      UnauthorizedException,
    );

    // Verify lockout was applied
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.failedLoginAttempts, 5);
    assert.ok(updateCalls[0].data.lockoutUntil instanceof Date);
  });

  await t.test('resets failed attempts and returns access token on valid credentials', async () => {
    updateCalls = [];
    const passwordHash = await argon2.hash('SecretAOA77!');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash,
      firstName: 'Alade',
      lastName: 'Adebayo',
      failedLoginAttempts: 3,
      lockoutUntil: null,
      isActive: true,
      companyUsers: [
        {
          companyId: 'comp-1',
          branchId: 'branch-1',
          departmentId: 'dept-1',
          status: 'ACTIVE',
          role: {
            name: 'Staff',
            rolePermissions: [{ permission: { slug: 'invoice:create' } }],
          },
          company: { id: 'comp-1', name: 'AOA 77 COMPANY LTD' },
        },
      ],
    };

    const result = await authService.login({ email: 'staff@aoa77.com', password: 'SecretAOA77!' });

    assert.equal(result.accessToken, 'mock-access-token-jwt');
    assert.ok(result.refreshToken.length >= 64);
    assert.equal(result.user.email, 'staff@aoa77.com');
    assert.equal(result.user.role, 'Staff');
    assert.deepEqual(result.user.permissions, ['invoice:create']);

    // Verify reset of failed attempts
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].data.failedLoginAttempts, 0);
    assert.equal(updateCalls[0].data.lockoutUntil, null);
  });
});
