import { test } from 'node:test';
import * as assert from 'node:assert';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/modules/auth/auth.service';

test('AuthService Unit Tests', async (t) => {
  let mockUserDb: any = null;
  let mockRefreshTokenDb: any = null;
  let updateCalls: any[] = [];
  let tokenUpdateManyCalls: any[] = [];
  let mockClaimCount = 1;

  const mockPrisma: any = {
    user: {
      findUnique: async (args: any) => {
        if (args?.where?.email && mockUserDb?.email !== args.where.email) {
          return null;
        }
        return mockUserDb;
      },
      findFirst: async (args: any) => {
        if (args?.where?.passwordResetToken) {
          if (mockUserDb?.passwordResetToken === args.where.passwordResetToken) {
            return mockUserDb;
          }
          return null;
        }
        return mockUserDb;
      },
      update: async (args: any) => {
        updateCalls.push(args);
        const data = { ...args.data };
        if (data.failedLoginAttempts && typeof data.failedLoginAttempts === 'object' && 'increment' in data.failedLoginAttempts) {
          data.failedLoginAttempts = ((mockUserDb && mockUserDb.failedLoginAttempts) || 0) + data.failedLoginAttempts.increment;
        }
        mockUserDb = { ...mockUserDb, ...data };
        return mockUserDb;
      },
    },
    refreshToken: {
      create: async (args: any) => args.data,
      findUnique: async () => mockRefreshTokenDb,
      update: async () => ({}),
      updateMany: async (args: any) => {
        tokenUpdateManyCalls.push(args);
        return { count: mockClaimCount };
      },
    },
  };

  const mockJwtService: any = {
    sign: () => 'mock-access-token-jwt',
  };

  const mockConfigService: any = {
    get: (key: string, defaultVal: any) => defaultVal,
    getOrThrow: (key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'test-jwt-access-secret-32-chars-minimum-key';
      return 'test-secret';
    },
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

    // Verify lockout was applied: call 1 increments counter, call 2 applies lockout and resets counter
    assert.equal(updateCalls.length, 2);
    assert.deepEqual(updateCalls[0].data.failedLoginAttempts, { increment: 1 });
    assert.equal(updateCalls[1].data.failedLoginAttempts, 0);
    assert.ok(updateCalls[1].data.lockoutUntil instanceof Date);
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

  await t.test('refreshTokens atomically claims token and returns new token pair', async () => {
    tokenUpdateManyCalls = [];
    mockClaimCount = 1;
    mockRefreshTokenDb = {
      id: 'token-1',
      tokenHash: 'somehash',
      userId: 'usr-1',
      familyId: 'family-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'usr-1',
        email: 'staff@aoa77.com',
        isActive: true,
        companyUsers: [
          {
            companyId: 'comp-1',
            status: 'ACTIVE',
            role: {
              name: 'Staff',
              rolePermissions: [{ permission: { slug: 'invoice:read' } }],
            },
            company: { id: 'comp-1', name: 'AOA 77 COMPANY LTD' },
          },
        ],
      },
    };

    const result = await authService.refreshTokens('some-raw-token');
    assert.equal(result.accessToken, 'mock-access-token-jwt');
    assert.ok(result.refreshToken);
    assert.equal(tokenUpdateManyCalls.length, 1);
    assert.deepEqual(tokenUpdateManyCalls[0].where, { id: 'token-1', isRevoked: false });
    assert.deepEqual(tokenUpdateManyCalls[0].data, { isRevoked: true });
  });

  await t.test('refreshTokens detects reuse and revokes family when revoked > 10s ago', async () => {
    tokenUpdateManyCalls = [];
    mockClaimCount = 0; // claim failed because already revoked
    mockRefreshTokenDb = {
      id: 'token-1',
      tokenHash: 'somehash',
      userId: 'usr-1',
      familyId: 'family-1',
      isRevoked: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60000),
      updatedAt: new Date(Date.now() - 20000), // revoked 20s ago (> 10s)
      user: {
        id: 'usr-1',
        email: 'staff@aoa77.com',
        isActive: true,
        companyUsers: [],
      },
    };

    await assert.rejects(
      async () => {
        await authService.refreshTokens('some-raw-token');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.ok(err.message.includes('token reuse detected'));
        return true;
      },
    );

    // Family revocation call was made
    assert.equal(tokenUpdateManyCalls.length, 2);
    assert.deepEqual(tokenUpdateManyCalls[1].where, { familyId: 'family-1' });
    assert.deepEqual(tokenUpdateManyCalls[1].data, { isRevoked: true });
  });

  await t.test('refreshTokens allows grace window when revoked <= 10s ago without revoking family', async () => {
    tokenUpdateManyCalls = [];
    mockClaimCount = 0; // claim failed
    mockRefreshTokenDb = {
      id: 'token-1',
      tokenHash: 'somehash',
      userId: 'usr-1',
      familyId: 'family-1',
      isRevoked: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 5000),
      updatedAt: new Date(Date.now() - 2000), // revoked 2s ago (<= 10s)
      user: {
        id: 'usr-1',
        email: 'staff@aoa77.com',
        isActive: true,
        companyUsers: [],
      },
    };

    await assert.rejects(
      async () => {
        await authService.refreshTokens('some-raw-token');
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.ok(err.message.includes('recently rotated'));
        return true;
      },
    );

    // Family revocation was NOT called (length is 1 for the failed claim)
    assert.equal(tokenUpdateManyCalls.length, 1);
  });

  await t.test('forgotPassword handles non-existent email gracefully without leaking existence', async () => {
    mockUserDb = null;
    const res = await authService.forgotPassword({ email: 'ghost@aoa77.com' });
    assert.ok(res.message.includes('If an account exists'));
    assert.strictEqual((res as any).token, undefined);
  });

  await t.test('forgotPassword generates 20-minute reset token for valid active user', async () => {
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      firstName: 'Adebayo',
      lastName: 'Akinola',
      isActive: true,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    };

    const res = await authService.forgotPassword({ email: 'staff@aoa77.com' });
    assert.ok(res.message.includes('If an account exists'));
    assert.ok(mockUserDb.passwordResetToken);
    assert.ok(mockUserDb.passwordResetExpiresAt > new Date());
  });

  await t.test('forgotPassword dispatches email via MailService when injected', async () => {
    let sentEmailTo = '';
    let sentResetUrl = '';
    let sentUserName = '';

    const mockMailService: any = {
      sendPasswordResetEmail: async (to: string, resetUrl: string, userName?: string) => {
        sentEmailTo = to;
        sentResetUrl = resetUrl;
        sentUserName = userName || '';
        return { delivered: true, simulated: false };
      },
    };

    const authWithMail = new AuthService(mockPrisma, mockJwtService, mockConfigService, mockMailService);

    mockUserDb = {
      id: 'usr-1',
      email: 'executive@aoa77.com',
      firstName: 'Adebayo',
      lastName: 'Akinola',
      isActive: true,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    };

    const res = await authWithMail.forgotPassword({ email: 'executive@aoa77.com' });
    assert.ok(res.message.includes('If an account exists'));
    assert.equal(sentEmailTo, 'executive@aoa77.com');
    assert.ok(sentResetUrl.includes('/reset-password?token='));
    assert.equal(sentUserName, 'Adebayo');
  });

  await t.test('resetPassword rejects invalid or unknown token', async () => {
    await assert.rejects(
      async () => {
        await authService.resetPassword({ token: 'unknown-token-123', newPassword: 'NewPassword99!' });
      },
      /Invalid or expired password reset token/,
    );
  });

  await t.test('resetPassword rejects expired token', async () => {
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordResetToken: 'expired-token',
      passwordResetExpiresAt: new Date(Date.now() - 60000), // 1 minute in past
    };

    await assert.rejects(
      async () => {
        await authService.resetPassword({ token: 'expired-token', newPassword: 'NewPassword99!' });
      },
      /Password reset token has expired/,
    );
  });

  await t.test('resetPassword updates password with Argon2id, clears token, and clears lockout', async () => {
    const oldHash = await argon2.hash('OldPassword123!');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash: oldHash,
      passwordResetToken: 'valid-token-xyz',
      passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      failedLoginAttempts: 3,
      lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
    };

    const res = await authService.resetPassword({ token: 'valid-token-xyz', newPassword: 'BrandNewSecurePassword123!' });
    assert.ok(res.message.includes('successfully reset'));
    assert.strictEqual(mockUserDb.passwordResetToken, null);
    assert.strictEqual(mockUserDb.passwordResetExpiresAt, null);
    assert.strictEqual(mockUserDb.failedLoginAttempts, 0);
    assert.strictEqual(mockUserDb.lockoutUntil, null);

    // Verify new password verifies against Argon2id
    const isNewValid = await argon2.verify(mockUserDb.passwordHash, 'BrandNewSecurePassword123!');
    assert.strictEqual(isNewValid, true);
  });
});
