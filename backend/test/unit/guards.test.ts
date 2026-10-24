import { test } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { CompanyScopeGuard } from '../../src/common/guards/company-scope.guard';

test('PermissionsGuard Tests', async (t) => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  await t.test('allows access if no permissions are required', () => {
    reflector.getAllAndOverride = () => undefined;
    const context = createMockContext({ role: 'Staff', permissions: [] });
    assert.equal(guard.canActivate(context), true);
  });

  await t.test('grants access to Admin role regardless of permissions array', () => {
    reflector.getAllAndOverride = () => ['invoice:approve'];
    const context = createMockContext({ role: 'Admin', permissions: [] });
    assert.equal(guard.canActivate(context), true);
  });

  await t.test('allows access if user has all required permissions', () => {
    reflector.getAllAndOverride = () => ['invoice:create', 'invoice:view'];
    const context = createMockContext({
      role: 'Staff',
      permissions: ['invoice:create', 'invoice:view', 'client:view'],
    });
    assert.equal(guard.canActivate(context), true);
  });

  await t.test('throws ForbiddenException if user lacks any required permission', () => {
    reflector.getAllAndOverride = () => ['invoice:approve'];
    const context = createMockContext({
      role: 'Staff',
      permissions: ['invoice:create', 'invoice:view'],
    });
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});

test('CompanyScopeGuard Multi-Tenant Isolation Tests', async (t) => {
  const guard = new CompanyScopeGuard();

  const createMockContext = (user: any, params: any = {}, query: any = {}, body: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params, query, body }),
      }),
    } as unknown as ExecutionContext;
  };

  await t.test('allows access when target companyId matches user companyId', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      { companyId: 'company-uuid-1' },
    );
    assert.equal(guard.canActivate(context), true);
  });

  await t.test('throws ForbiddenException when user attempts to access another companyId in params', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      { companyId: 'company-uuid-2' },
    );
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });

  await t.test('throws ForbiddenException when cross-tenant companyId is injected via request body', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      {},
      {},
      { companyId: 'injected-attacker-company-id' },
    );
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});
