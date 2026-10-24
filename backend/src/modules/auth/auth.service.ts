import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hashes a token string with SHA-256 for secure database storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a pair of access and refresh tokens with token family tracking.
   */
  private async generateTokens(
    userId: string,
    email: string,
    companyId: string,
    branchId: string | null | undefined,
    departmentId: string | null | undefined,
    role: string,
    permissions: string[],
    familyId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      companyId,
      branchId,
      departmentId,
      role,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev-jwt-access-secret-32-chars-minimum-key-aoa77-doc-app'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const assignedFamilyId = familyId || crypto.randomUUID();

    // 7 days expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: assignedFamilyId,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Authenticate user credentials, check lockout, and issue tokens.
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
      include: {
        companyUsers: {
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
            company: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account temporarily locked due to excessive failed attempts. Please retry in ${waitMinutes} minute(s).`,
      );
    }

    // Verify password with Argon2id
    const isPasswordValid = await argon2.verify(user.passwordHash, loginDto.password);

    if (!isPasswordValid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockoutUntil: Date | null = null;

      if (failedAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        this.logger.warn(`User ${user.email} locked out until ${lockoutUntil.toISOString()} after ${failedAttempts} failed attempts.`);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockoutUntil,
        },
      });

      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated. Please contact your company administrator.');
    }

    const membership = user.companyUsers[0];
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('No active organization membership found for this user account.');
    }

    // Reset failed login attempts and update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.slug);

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      membership.companyId,
      membership.branchId,
      membership.departmentId,
      membership.role.name,
      permissions,
      undefined,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: {
          id: membership.company.id,
          name: membership.company.name,
        },
        role: membership.role.name,
        permissions,
      },
      ...tokens,
    };
  }

  /**
   * Refresh tokens with rotation and token-family compromise detection.
   */
  async refreshTokens(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            companyUsers: {
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
        },
      },
    });

    if (!existingToken) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // Reuse detection: If token was already revoked, someone is attempting replay!
    // Revoke the ENTIRE token family immediately.
    if (existingToken.isRevoked) {
      this.logger.error(
        `SECURITY ALERT: Refresh token reuse detected for user ${existingToken.userId} on family ${existingToken.familyId}. Revoking family.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Security violation: token reuse detected. All active sessions invalidated.');
    }

    // Check expiration
    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired. Please login again.');
    }

    // Revoke current refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true },
    });

    const user = existingToken.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is no longer active.');
    }

    const membership = user.companyUsers[0];
    if (!membership || membership.status !== 'ACTIVE') {
      throw new UnauthorizedException('No active company membership.');
    }

    const permissions = membership.role.rolePermissions.map((rp) => rp.permission.slug);

    // Issue new pair continuing the token family
    return this.generateTokens(
      user.id,
      user.email,
      membership.companyId,
      membership.branchId,
      membership.departmentId,
      membership.role.name,
      permissions,
      existingToken.familyId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Logout user and revoke refresh token.
   */
  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }
    return { loggedOut: true };
  }
}
