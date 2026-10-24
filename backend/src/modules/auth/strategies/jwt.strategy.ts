import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  role: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'dev-jwt-access-secret-32-chars-minimum-key-aoa77-doc-app'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        companyUsers: {
          where: { companyId: payload.companyId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is deactivated or no longer exists.');
    }

    const membership = user.companyUsers[0];
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not an active member of this organization.');
    }

    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.slug);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: membership.companyId,
      branchId: membership.branchId,
      departmentId: membership.departmentId,
      role: membership.role.name,
      permissions,
    };
  }
}
