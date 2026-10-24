import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyScopeGuard } from '../../src/common/guards/company-scope.guard';

describe('CompanyScopeGuard', () => {
  let guard: CompanyScopeGuard;

  beforeEach(() => {
    guard = new CompanyScopeGuard();
  });

  const createMockContext = (user: any, params: any = {}, query: any = {}, body: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params, query, body }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access when target companyId matches user companyId', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      { companyId: 'company-uuid-1' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user attempts to access another companyId in params', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      { companyId: 'company-uuid-2' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when cross-tenant companyId is injected via request body', () => {
    const context = createMockContext(
      { companyId: 'company-uuid-1' },
      {},
      {},
      { companyId: 'injected-attacker-company-id' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
