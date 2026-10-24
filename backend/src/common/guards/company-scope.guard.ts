import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user || !user.companyId) {
      // If endpoint is not authenticated, let JwtAuthGuard handle it first
      return true;
    }

    // Check if path or query parameter contains a companyId attempting cross-tenant injection
    const targetCompanyId = request.params?.companyId || request.query?.companyId || request.body?.companyId;

    if (targetCompanyId && targetCompanyId !== user.companyId) {
      throw new ForbiddenException('Cross-tenant data access violation detected. Access blocked.');
    }

    return true;
  }
}
