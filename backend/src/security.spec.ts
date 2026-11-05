import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompanyScopeGuard } from './common/guards/company-scope.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RATE_LIMIT_KEY } from './common/decorators/rate-limit.decorator';
import { IS_PUBLIC_KEY } from './common/decorators/public.decorator';
import { PERMISSIONS_KEY } from './common/decorators/require-permissions.decorator';
import { PaymentsService } from './modules/payments/payments.service';
import { PaymentsController } from './modules/payments/payments.controller';
import { PaymentMethod, DocumentType, DocumentStatus, InvoicePaymentStatus } from '@prisma/client';

describe('AOA 77 Document Management System - Security & Isolation Audit Suite', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    RateLimitGuard.clearStore();
    RateLimitGuard.setRedisClient(null);
  });

  afterEach(async () => {
    RateLimitGuard.clearStore();
    await RateLimitGuard.closeRedis();
  });

  // Helper to build realistic NestJS ExecutionContext mocks
  const createMockContext = (options: {
    user?: any;
    headers?: Record<string, string>;
    ip?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    method?: string;
    path?: string;
    handler?: any;
    classRef?: any;
  }): { context: ExecutionContext; responseHeaders: Record<string, string> } => {
    const responseHeaders: Record<string, string> = {};
    const req = {
      user: options.user,
      headers: options.headers || {},
      ip: options.ip || '127.0.0.1',
      params: options.params || {},
      query: options.query || {},
      body: options.body || {},
      method: options.method || 'GET',
      route: { path: options.path || '/test' },
      path: options.path || '/test',
      url: options.path || '/test',
      get: (header: string) => options.headers?.[header.toLowerCase()],
      socket: { remoteAddress: options.ip || '127.0.0.1' },
    };

    const res = {
      setHeader: (name: string, value: string) => {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => options.handler || (() => {}),
      getClass: () => options.classRef || class TestController {},
    } as unknown as ExecutionContext;

    return { context, responseHeaders };
  };

  // =========================================================================
  // 1. UNAUTHENTICATED BLOCKS (401 Unauthorized)
  // =========================================================================
  describe('1. Authentication Gatekeeping & Public Route Isolation (JwtAuthGuard)', () => {
    it('throws 401 Unauthorized when no user is attached to request on protected routes', () => {
      const guard = new JwtAuthGuard(reflector);

      // Handler is not public
      reflector.getAllAndOverride = (key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        return undefined;
      };

      // Simulates passport failure when no token is supplied
      assert.throws(
        () => guard.handleRequest(null, null, { message: 'No auth token' }),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
          assert.match(err.message, /Authentication required/i);
          return true;
        },
      );
    });

    it('allows unauthenticated requests through on routes marked with @Public()', () => {
      const guard = new JwtAuthGuard(reflector);
      reflector.getAllAndOverride = (key: string) => {
        if (key === IS_PUBLIC_KEY) return true; // @Public() decorator present
        return false;
      };

      const { context } = createMockContext({ user: undefined });
      const canActivate = guard.canActivate(context);
      assert.equal(canActivate, true);
    });

    it('allows valid authenticated sessions to proceed past JwtAuthGuard', () => {
      const guard = new JwtAuthGuard(reflector);
      reflector.getAllAndOverride = () => false;

      const validUser = {
        id: 'usr-valid-1',
        email: 'staff@aoa77.com',
        companyId: 'comp-aoa77',
        role: 'Staff',
        permissions: ['invoice:view'],
      };

      const result = guard.handleRequest(null, validUser, null);
      assert.deepStrictEqual(result, validUser);
    });
  });

  // =========================================================================
  // 2. RBAC & ROLE ENFORCEMENT (403 Forbidden)
  // =========================================================================
  describe('2. RBAC & Administrative Role Enforcement', () => {
    it('blocks Staff roles with 403 Forbidden when attempting admin permissions (e.g. user:manage)', () => {
      const guard = new PermissionsGuard(reflector);

      reflector.getAllAndOverride = (key: string) => {
        if (key === PERMISSIONS_KEY) return ['user:manage'];
        return undefined;
      };

      const { context } = createMockContext({
        user: {
          id: 'usr-staff-1',
          email: 'staff@aoa77.com',
          role: 'Staff',
          permissions: ['invoice:create', 'invoice:view'],
        },
      });

      assert.throws(
        () => guard.canActivate(context),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.equal(err.getStatus(), HttpStatus.FORBIDDEN);
          assert.match(err.message, /lack the required permission/i);
          return true;
        },
      );
    });

    it('grants full administrative access to Administrator / Admin roles overriding granular permissions', () => {
      const guard = new PermissionsGuard(reflector);

      reflector.getAllAndOverride = (key: string) => {
        if (key === PERMISSIONS_KEY) return ['super:admin:privilege'];
        return undefined;
      };

      const { context } = createMockContext({
        user: {
          id: 'usr-admin-1',
          email: 'admin@aoa77.com',
          role: 'Admin',
          permissions: [], // Even with empty granular array, Admin role succeeds
        },
      });

      assert.equal(guard.canActivate(context), true);
    });

    it('blocks Staff roles with 403 Forbidden at Controller & Service level for Payment Reversals', async () => {
      // Mock minimal service to verify controller role guard
      const mockService = {
        reversePayment: async () => ({ status: 'reversed' }),
      } as unknown as PaymentsService;

      const controller = new PaymentsController(mockService);

      const staffUser: any = {
        id: 'usr-staff-1',
        email: 'staff@aoa77.com',
        companyId: 'comp-1',
        role: 'Staff', // Non-admin/manager role
        permissions: ['payment:reverse'],
      };

      // Controller level role check
      await assert.rejects(
        async () =>
          controller.reversePayment(staffUser, 'PAY-2026-0001', {
            reason: 'Accidental double tapping on POS terminal',
          }),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.equal(err.getStatus(), HttpStatus.FORBIDDEN);
          assert.match(err.message, /Only Managers or Administrators/i);
          return true;
        },
      );
    });

    it('permits Manager and Administrator roles to initiate Payment Reversals', async () => {
      let passedActorRole: string | undefined;
      const mockService = {
        reversePayment: async (
          _companyId: string,
          _id: string,
          _dto: any,
          _actorId: string,
          userRole?: string,
        ) => {
          passedActorRole = userRole;
          return { success: true };
        },
      } as unknown as PaymentsService;

      const controller = new PaymentsController(mockService);

      const managerUser: any = {
        id: 'usr-mgr-1',
        email: 'manager@aoa77.com',
        companyId: 'comp-1',
        role: 'Manager',
        permissions: ['payment:reverse'],
      };

      const result = await controller.reversePayment(managerUser, 'PAY-2026-0001', {
        reason: 'Customer initiated official charge dispute',
      });

      assert.deepStrictEqual(result, { success: true });
      assert.equal(passedActorRole, 'Manager');
    });
  });

  // =========================================================================
  // 3. RATE-LIMIT THROTTLING (HTTP 429 Too Many Requests)
  // =========================================================================
  describe('3. Cache-Backed Rate-Limiting Guard (RateLimitGuard)', () => {
    it('identifies unauthenticated clients by IP and throttles after exceeding limit with HTTP 429', async () => {
      const guard = new RateLimitGuard(reflector);
      reflector.getAllAndOverride = (key: string) => {
        if (key === RATE_LIMIT_KEY) return { limit: 5, ttl: 60 };
        return undefined;
      };

      const ip = '197.210.64.12';
      const makeRequest = () =>
        createMockContext({
          ip,
          headers: { 'x-forwarded-for': ip },
          path: '/api/v1/auth/login',
          method: 'POST',
        });

      // Rapidly fire 5 requests (all should succeed)
      for (let i = 1; i <= 5; i++) {
        const { context, responseHeaders } = makeRequest();
        const allowed = await guard.canActivate(context);
        assert.equal(allowed, true);
        assert.equal(responseHeaders['x-ratelimit-limit'], '5');
        assert.equal(responseHeaders['x-ratelimit-remaining'], (5 - i).toString());
      }

      // 6th request exceeds threshold -> must throw HttpException with 429
      const { context: excessContext, responseHeaders } = makeRequest();
      await assert.rejects(
        async () => guard.canActivate(excessContext),
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
          const response = err.getResponse() as any;
          assert.equal(response.statusCode, 429);
          assert.equal(response.error, 'Too Many Requests');
          assert.ok(response.retryAfter >= 1);
          assert.match(response.message, /Rate limit exceeded/i);
          return true;
        },
      );

      assert.ok(responseHeaders['retry-after']);
    });

    it('identifies authenticated clients by user_{id} independently of their IP', async () => {
      const guard = new RateLimitGuard(reflector);
      reflector.getAllAndOverride = (key: string) => {
        if (key === RATE_LIMIT_KEY) return { limit: 2, ttl: 30 };
        return undefined;
      };

      const userA = { id: 'usr-client-alpha', role: 'Staff' };
      const userB = { id: 'usr-client-beta', role: 'Staff' };
      const sharedIp = '10.0.0.1'; // Same shared NAT or corporate VPN IP

      // User A makes 2 requests
      for (let i = 0; i < 2; i++) {
        const { context } = createMockContext({ user: userA, ip: sharedIp, path: '/invoices', method: 'POST' });
        assert.equal(await guard.canActivate(context), true);
      }

      // User A makes 3rd request -> Blocked
      const { context: userABlocked } = createMockContext({ user: userA, ip: sharedIp, path: '/invoices', method: 'POST' });
      await assert.rejects(async () => guard.canActivate(userABlocked), HttpException);

      // User B on SAME IP still has clean quota
      const { context: userBContext } = createMockContext({ user: userB, ip: sharedIp, path: '/invoices', method: 'POST' });
      assert.equal(await guard.canActivate(userBContext), true);
    });

    it('operates with mock Redis client and handles Redis evaluation seamlessly', async () => {
      const guard = new RateLimitGuard(reflector);
      reflector.getAllAndOverride = () => ({ limit: 5, ttl: 60 });

      // Mock Redis client returning atomic Lua script [count, ttl]
      let scriptExecuted = false;
      const mockRedis: any = {
        eval: async (_script: string, _numKeys: number, _key: string, _ttl: number) => {
          scriptExecuted = true;
          return [6, 45]; // Over limit: count 6, 45 seconds remaining
        },
      };

      RateLimitGuard.setRedisClient(mockRedis);

      const { context, responseHeaders } = createMockContext({ ip: '192.168.1.1' });
      await assert.rejects(
        async () => guard.canActivate(context),
        (err: any) => {
          assert.equal(err.getStatus(), 429);
          assert.equal((err.getResponse() as any).retryAfter, 45);
          return true;
        },
      );

      assert.equal(scriptExecuted, true);
      assert.equal(responseHeaders['retry-after'], '45');
    });

    it('falls back to memory store when Redis client throws an error', async () => {
      const guard = new RateLimitGuard(reflector);
      reflector.getAllAndOverride = () => ({ limit: 3, ttl: 60 });

      // Mock Redis client that fails with network disconnect
      const faultyRedis: any = {
        eval: async () => {
          throw new Error('ECONNRESET: Redis connection lost');
        },
      };
      RateLimitGuard.setRedisClient(faultyRedis);

      // Should not crash the server; should fallback to in-memory store
      const { context } = createMockContext({ ip: '10.20.30.40' });
      const allowed = await guard.canActivate(context);
      assert.equal(allowed, true);
    });
  });

  // =========================================================================
  // 4. AUDIT VALIDATION ON PAYMENT REVERSALS (400 Bad Request)
  // =========================================================================
  describe('4. Audit Validation & Minimum Justification Length', () => {
    let paymentsService: PaymentsService;
    let mockPrisma: any;
    let mockAuditService: any;
    let mockNotificationsService: any;

    beforeEach(() => {
      mockPrisma = {
        $transaction: async (cb: any) => cb(mockPrisma),
        $queryRaw: async () => [],
        payment: {
          findFirst: async () => ({
            id: 'pay-uuid-1',
            invoiceId: 'inv-uuid-1',
            companyId: 'comp-aoa77',
            paymentNumber: 'PAY-2026-0001',
            isReversed: false,
            amount: '50000.00',
            invoice: {
              id: 'inv-uuid-1',
              document: { id: 'doc-uuid-1', totalAmount: '100000.00', documentNumber: 'INV-001' },
            },
          }),
          findMany: async () => [],
          update: async ({ data }: any) => ({ id: 'pay-uuid-1', ...data }),
        },
        document: {
          update: async () => ({}),
        },
        invoice: {
          update: async () => ({}),
        },
      };

      mockAuditService = {
        logAction: async () => ({ id: 'audit-log-1' }),
      };

      mockNotificationsService = {
        notifyUser: async () => ({}),
      };

      paymentsService = new PaymentsService(
        mockPrisma,
        mockAuditService,
        mockNotificationsService,
      );
    });

    it('rejects reversal when reason is missing, empty, or whitespace only', async () => {
      // 1. Missing / empty reason
      await assert.rejects(
        async () =>
          paymentsService.reversePayment('comp-aoa77', 'pay-uuid-1', { reason: '' } as any, 'usr-mgr', 'Manager'),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.match(err.message, /at least 5 characters/i);
          return true;
        },
      );

      // 2. Whitespace only
      await assert.rejects(
        async () =>
          paymentsService.reversePayment('comp-aoa77', 'pay-uuid-1', { reason: '     ' } as any, 'usr-mgr', 'Manager'),
        BadRequestException,
      );
    });

    it('rejects reversal when reason is shorter than 5 characters (e.g. "void" or "err")', async () => {
      await assert.rejects(
        async () =>
          paymentsService.reversePayment('comp-aoa77', 'pay-uuid-1', { reason: 'void' } as any, 'usr-mgr', 'Manager'),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
          assert.match(err.message, /valid reversal reason of at least 5 characters/i);
          return true;
        },
      );
    });

    it('accepts valid detailed reason (>= 5 characters) and records audit trail', async () => {
      let auditRecorded = false;
      mockAuditService.logAction = async (payload: any) => {
        auditRecorded = true;
        assert.equal(payload.action, 'PAYMENT_REVERSED');
        assert.equal(payload.newValues.reason, 'Bank confirmed duplicate NIP transfer from client');
        return { id: 'audit-1' };
      };

      const result = await paymentsService.reversePayment(
        'comp-aoa77',
        'pay-uuid-1',
        { reason: 'Bank confirmed duplicate NIP transfer from client' },
        'usr-mgr',
        'Manager',
      );

      assert.ok(result.payment);
      assert.equal(result.payment.isReversed, true);
      assert.equal(auditRecorded, true);
    });
  });

  // =========================================================================
  // 5. MULTI-TENANT ISOLATION & IDOR PREVENTION
  // =========================================================================
  describe('5. Multi-Tenant Cross-Company Isolation', () => {
    it('CompanyScopeGuard blocks attempts to inject foreign companyId in route parameters', () => {
      const guard = new CompanyScopeGuard();

      const user = { id: 'usr-1', companyId: 'comp-alpha', role: 'Staff' };
      const { context } = createMockContext({
        user,
        params: { companyId: 'comp-beta' }, // Cross-tenant tampering attempt
      });

      assert.throws(
        () => guard.canActivate(context),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.match(err.message, /Cross-tenant data access violation/i);
          return true;
        },
      );
    });

    it('CompanyScopeGuard blocks attempts to inject foreign companyId via JSON request body', () => {
      const guard = new CompanyScopeGuard();

      const user = { id: 'usr-1', companyId: 'comp-alpha', role: 'Staff' };
      const { context } = createMockContext({
        user,
        body: { companyId: 'comp-charlie', title: 'Malicious Invoice' },
      });

      assert.throws(
        () => guard.canActivate(context),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.match(err.message, /Cross-tenant data access violation/i);
          return true;
        },
      );
    });

    it('PaymentsService strictly returns 404 NotFound when querying payment belonging to another company', async () => {
      const mockPrisma: any = {
        payment: {
          findFirst: async ({ where }: any) => {
            // Simulate DB where companyId must match caller company
            if (where.companyId === 'comp-alpha' && where.OR?.[0]?.id === 'pay-beta-1') {
              return null; // Not found in company alpha
            }
            return { id: 'pay-beta-1', companyId: 'comp-beta' };
          },
        },
      };

      const service = new PaymentsService(mockPrisma, {} as any, {} as any);

      // Company Alpha attempts to access Company Beta payment
      await assert.rejects(
        async () => service.findOne('comp-alpha', 'pay-beta-1'),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.match(err.message, /not found/i);
          return true;
        },
      );
    });
  });
});
