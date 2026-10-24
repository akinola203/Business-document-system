import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: 'Staff', permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should grant access to Admin role regardless of permissions array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['invoice:approve']);
    const context = createMockContext({ role: 'Admin', permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has all required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['invoice:create', 'invoice:view']);
    const context = createMockContext({
      role: 'Staff',
      permissions: ['invoice:create', 'invoice:view', 'client:view'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user lacks any required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['invoice:approve']);
    const context = createMockContext({
      role: 'Staff',
      permissions: ['invoice:create', 'invoice:view'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
