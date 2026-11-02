import { test } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { JwtStrategy, assertStrongJwtSecretInProduction } from '../../src/modules/auth/strategies/jwt.strategy';
import { assertSeedAllowed } from '../../prisma/seed';
import { buildAllowedCorsOrigins, isOriginAllowed } from '../../src/common/utils/cors.util';

test('AuthService Unit Tests', async (t) => {
  let mockUserDb: any = null;
  let mockRefreshTokenDb: any = null;
  let updateCalls: any[] = [];
  let tokenUpdateManyCalls: any[] = [];
  let auditLogCalls: any[] = [];
  let mockClaimCount = 1;

  let lastSignOptions: any = null;
  let lastCreatedRefreshToken: any = null;

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
      create: async (args: any) => {
        lastCreatedRefreshToken = args.data;
        return args.data;
      },
      findUnique: async () => mockRefreshTokenDb,
      update: async () => ({}),
      updateMany: async (args: any) => {
        tokenUpdateManyCalls.push(args);
        return { count: mockClaimCount };
      },
    },
    auditLog: {
      create: async (args: any) => {
        auditLogCalls.push(args);
        return args.data;
      },
    },
  };

  const mockJwtService: any = {
    sign: (_payload: any, options: any) => {
      lastSignOptions = options;
      return 'mock-access-token-jwt';
    },
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
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      lockoutUntil: new Date(Date.now() + 15 * 60 * 1000),
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
    auditLogCalls = [];
    const passwordHash = await argon2.hash('SecretAOA77!');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash,
      failedLoginAttempts: 4, // 4 failed attempts previously
      lockedUntil: null,
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
    assert.ok(updateCalls[1].data.lockedUntil instanceof Date);
    assert.equal(auditLogCalls.length, 1);
    assert.equal(auditLogCalls[0].data.action, 'USER_ACCOUNT_LOCKED');
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
      lockedUntil: null,
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
    assert.equal(updateCalls[0].data.lockedUntil, null);
  });

  await t.test('login handles rememberMe by extending JWT and refresh token lifetimes', async () => {
    const passwordHash = await argon2.hash('SecretAOA77!');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
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

    // 1. Without rememberMe (default session)
    const standardResult = await authService.login({
      email: 'staff@aoa77.com',
      password: 'SecretAOA77!',
      rememberMe: false,
    });
    assert.equal(lastSignOptions.expiresIn, '15m');
    assert.equal(standardResult.rememberMe, false);
    const standardDays = Math.round((lastCreatedRefreshToken.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    assert.ok(standardDays >= 6 && standardDays <= 8);

    // 2. With rememberMe = true (extended persistent session)
    const rememberedResult = await authService.login({
      email: 'staff@aoa77.com',
      password: 'SecretAOA77!',
      rememberMe: true,
    });
    assert.equal(lastSignOptions.expiresIn, '7d');
    assert.equal(rememberedResult.rememberMe, true);
    const rememberedDays = Math.round((lastCreatedRefreshToken.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    assert.ok(rememberedDays >= 29 && rememberedDays <= 31);
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

  await t.test('forgotPassword generates 20-minute SHA-256 hashed reset token and invalidates prior token on re-issue', async () => {
    let sentUrl1 = '';
    let sentUrl2 = '';
    const mockMail: any = {
      sendPasswordResetEmail: async (_to: string, url: string) => {
        if (!sentUrl1) sentUrl1 = url;
        else sentUrl2 = url;
        return { delivered: true, simulated: false };
      },
    };
    const svc = new AuthService(mockPrisma, mockJwtService, mockConfigService, mockMail);

    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      firstName: 'Adebayo',
      lastName: 'Akinola',
      isActive: true,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    };

    const res1 = await svc.forgotPassword({ email: 'staff@aoa77.com' });
    assert.ok(res1.message.includes('If an account exists'));
    assert.strictEqual((res1 as any).token, undefined);
    assert.strictEqual((res1 as any).debugResetLink, undefined);

    const rawToken1 = new URL(sentUrl1).searchParams.get('token')!;
    const expectedHash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
    assert.strictEqual(mockUserDb.passwordResetToken, expectedHash1);
    assert.notStrictEqual(mockUserDb.passwordResetToken, rawToken1);
    assert.ok(mockUserDb.passwordResetExpiresAt > new Date());

    // Re-issue invalidates previous token hash
    await svc.forgotPassword({ email: 'staff@aoa77.com' });
    const rawToken2 = new URL(sentUrl2).searchParams.get('token')!;
    const expectedHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
    assert.strictEqual(mockUserDb.passwordResetToken, expectedHash2);
    assert.notStrictEqual(expectedHash1, expectedHash2);
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
    const expiredRaw = 'expired-token';
    const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordResetToken: expiredHash,
      passwordResetExpiresAt: new Date(Date.now() - 60000), // 1 minute in past
    };

    await assert.rejects(
      async () => {
        await authService.resetPassword({ token: expiredRaw, newPassword: 'NewPassword99!' });
      },
      /Password reset token has expired/,
    );
  });

  await t.test('resetPassword updates password with Argon2id, clears token, and clears lockout', async () => {
    const oldHash = await argon2.hash('OldPassword123!');
    const validRaw = 'valid-token-xyz';
    const validHash = crypto.createHash('sha256').update(validRaw).digest('hex');
    mockUserDb = {
      id: 'usr-1',
      email: 'staff@aoa77.com',
      passwordHash: oldHash,
      passwordResetToken: validHash,
      passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      failedLoginAttempts: 3,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
    };

    const res = await authService.resetPassword({ token: validRaw, newPassword: 'BrandNewSecurePassword123!' });
    assert.ok(res.message.includes('successfully reset'));
    assert.strictEqual(mockUserDb.passwordResetToken, null);
    assert.strictEqual(mockUserDb.passwordResetExpiresAt, null);
    assert.strictEqual(mockUserDb.failedLoginAttempts, 0);
    assert.strictEqual(mockUserDb.lockoutUntil, null);
    assert.strictEqual(mockUserDb.lockedUntil, null);

    // Verify new password verifies against Argon2id
    const isNewValid = await argon2.verify(mockUserDb.passwordHash, 'BrandNewSecurePassword123!');
    assert.strictEqual(isNewValid, true);
  });

  await t.test('CORS allowlist and AuthController CSRF Origin verification', async () => {
    const allowedProd = buildAllowedCorsOrigins({
      corsOrigin: 'https://app.aoa77.com, https://portal.aoa77.com/',
      frontendUrl: 'https://frontend.aoa77.com',
      nodeEnv: 'production',
    });

    assert.strictEqual(isOriginAllowed('https://app.aoa77.com', allowedProd, true), true);
    assert.strictEqual(isOriginAllowed('https://portal.aoa77.com', allowedProd, true), true);
    assert.strictEqual(isOriginAllowed('https://evil.vercel.app', allowedProd, true), false);
    assert.strictEqual(isOriginAllowed('null', allowedProd, true), false);
    assert.strictEqual(isOriginAllowed('*', allowedProd, true), false);

    const controller = new AuthController({
      refreshTokens: async () => ({ accessToken: 'new-jwt', refreshToken: 'new-refresh' }),
      logout: async () => ({ loggedOut: true }),
    } as any);

    const mockRes: any = {
      cookie: () => {},
      clearCookie: () => {},
    };

    // Missing Origin header on /auth/refresh must be blocked
    await assert.rejects(
      async () => {
        await controller.refresh({ headers: {}, cookies: { refresh_token: 'tok' }, socket: {} } as any, mockRes);
      },
      ForbiddenException,
    );

    // Untrusted Origin header on /auth/logout must be blocked
    await assert.rejects(
      async () => {
        await controller.logout(
          { headers: { origin: 'https://attacker.example.com' }, cookies: { refresh_token: 'tok' } } as any,
          mockRes,
        );
      },
      ForbiddenException,
    );

    // Allowlisted Origin succeeds
    const refreshRes = await controller.refresh(
      {
        headers: { origin: 'http://localhost:5173' },
        cookies: { refresh_token: 'tok' },
        socket: {},
        get: () => 'test-agent',
      } as any,
      mockRes,
    );
    assert.strictEqual(refreshRes.accessToken, 'new-jwt');
  });

  await t.test('Secrets, Seed Safeguards & JwtStrategy isSystemAdmin computation', async () => {
    // Reject weak or default JWT secret in production
    assert.throws(() => {
      assertStrongJwtSecretInProduction('dev-jwt-secret-change-in-production', 'production');
    }, /JWT_ACCESS_SECRET/);

    assert.throws(() => {
      assertStrongJwtSecretInProduction('short-secret', 'production');
    }, /JWT_ACCESS_SECRET/);

    // Accept strong 32+ char secret in production
    assert.doesNotThrow(() => {
      assertStrongJwtSecretInProduction('x9K#mP2$vL8@nQ5!rT1&wZ4^yB7*cF0_dH3+jG6', 'production');
    });

    // Reject production seeding unless ALLOW_PRODUCTION_SEED=true
    assert.throws(() => {
      assertSeedAllowed({ NODE_ENV: 'production' } as any);
    }, /Refusing to run database seed in production/);

    assert.doesNotThrow(() => {
      assertSeedAllowed({ NODE_ENV: 'production', ALLOW_PRODUCTION_SEED: 'true' } as any);
    });

    // JwtStrategy computes isSystemAdmin
    const strategy = new JwtStrategy(mockConfigService, {
      user: {
        findUnique: async ({ where }: any) => ({
          id: where.id,
          email: 'admin@aoa77.com',
          firstName: 'Alade',
          lastName: 'Adebayo',
          isActive: true,
          companyUsers: [
            {
              companyId: 'comp-1',
              status: 'ACTIVE',
              role: {
                name: where.id === 'usr-admin' ? 'Admin' : 'Staff',
                rolePermissions: [{ permission: { slug: 'invoice:view' } }],
              },
            },
          ],
        }),
      },
    } as any);

    const adminUser = await strategy.validate({ sub: 'usr-admin', email: 'admin@aoa77.com', companyId: 'comp-1' } as any);
    assert.strictEqual(adminUser.isSystemAdmin, true);

    const staffUser = await strategy.validate({ sub: 'usr-staff', email: 'staff@aoa77.com', companyId: 'comp-1' } as any);
    assert.strictEqual(staffUser.isSystemAdmin, false);
  });
});
