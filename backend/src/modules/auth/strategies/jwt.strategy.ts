import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

const WEAK_JWT_SECRET_PATTERNS = [
  /^secret$/i,
  /^default/i,
  /^changeme/i,
  /^change-me/i,
  /^dev[-_]/i,
  /^jwt[-_]?secret/i,
  /change-in-production/i,
  /placeholder/i,
];

export function assertStrongJwtSecretInProduction(
  secret: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv !== 'production') {
    return;
  }
  const trimmed = (secret || '').trim();
  if (
    trimmed.length < 32 ||
    WEAK_JWT_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed))
  ) {
    throw new Error(
      'SECURITY ERROR: Refusing to start in production with a weak or default JWT_ACCESS_SECRET. Configure a strong secret of at least 32 characters.',
    );
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const nodeEnv = configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    assertStrongJwtSecretInProduction(secret, nodeEnv);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.companyId) {
      throw new UnauthorizedException('Invalid access token claims.');
    }

    // Verify user and company membership remain active
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
      throw new UnauthorizedException('User account is inactive or does not exist.');
    }

    const membership = user.companyUsers[0];
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('User membership in the selected company is no longer active.');
    }

    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.slug);
    const isSystemAdmin =
      membership.role.name === 'Admin' ||
      Boolean((membership.role as any).isSystem && membership.role.name.toLowerCase() === 'admin');

    return {
      id: user.id,
      email: user.email,
      companyId: membership.companyId,
      branchId: membership.branchId,
      departmentId: membership.departmentId,
      role: membership.role.name,
      isSystemAdmin,
      permissions,
    };
  }
}
