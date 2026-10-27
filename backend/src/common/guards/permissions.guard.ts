import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Access denied. No permissions found on active session.');
    }

    // Admin has superuser override or permissions check
    if (user.role === 'Admin') {
      return true;
    }

    const hasPermission = requiredPermissions.every((perm) => {
      if (user.permissions.includes(perm)) return true;
      const [domain] = perm.split(':');
      if (user.permissions.includes(`${domain}:manage`)) return true;
      if (user.permissions.includes('*')) return true;
      return false;
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. You lack the required permission(s): [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
