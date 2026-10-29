import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly mailService?: MailService,
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
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
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
          orderBy: { createdAt: 'asc' },
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
      // Timing attack mitigation: run dummy verify so response time does not reveal email existence
      await argon2.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$dHVtbXlzYWx0MTIzNDU2Nw$dHVtbXloYXNoMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=',
        loginDto.password,
      ).catch(() => false);
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
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
        },
        select: { id: true, email: true, failedLoginAttempts: true },
      });

      if (updatedUser.failedLoginAttempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        this.logger.warn(`User ${user.email} locked out until ${lockoutUntil.toISOString()} after 5 failed attempts.`);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lockoutUntil,
            failedLoginAttempts: 0,
          },
        });
      }

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
              orderBy: { createdAt: 'asc' },
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

    // Atomic claim of the refresh token
    const claim = await this.prisma.refreshToken.updateMany({
      where: { id: existingToken.id, isRevoked: false },
      data: { isRevoked: true },
    });

    if (claim.count === 0) {
      // Token was already revoked. Only treat as reuse (revoke the family) if revoked > ~10s ago
      const tokenRecord = existingToken as any;
      const revokedTimestamp = tokenRecord.updatedAt || tokenRecord.revokedAt || tokenRecord.createdAt;
      const isOldRevocation =
        revokedTimestamp &&
        Date.now() - new Date(revokedTimestamp).getTime() > 10000;

      if (isOldRevocation) {
        this.logger.error(
          `SECURITY ALERT: Refresh token reuse detected for user ${existingToken.userId} on family ${existingToken.familyId}. Revoking family.`,
        );
        await this.prisma.refreshToken.updateMany({
          where: { familyId: existingToken.familyId },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException(
          'Security violation: token reuse detected. All active sessions invalidated.',
        );
      } else {
        throw new UnauthorizedException(
          'Refresh token was recently rotated. Please retry with the latest token.',
        );
      }
    }

    // Check expiration
    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired. Please login again.');
    }

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

  /**
   * Generates a 20-minute secure crypto reset token, persists it on the user record,
   * and simulates/dispatches a password reset email link.
   * Supports either ForgotPasswordDto or raw email string.
   */
  async forgotPassword(input: ForgotPasswordDto | { email: string } | string) {
    const rawEmail = typeof input === 'string' ? input : input?.email;
    const email = (rawEmail || '').toLowerCase().trim();

    if (!email) {
      throw new BadRequestException('A valid email address is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Anti-enumeration: Return generic success response even if account does not exist
    if (!user || !user.isActive) {
      this.logger.warn(
        `[AuthService] Password reset requested for non-existent or inactive email: "${email}". No email will be sent. (If this is your personal account, ensure the user record exists in the database!)`,
      );
      return {
        message: 'If an account exists with this email address, a password reset link has been sent.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes expiration

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';
    const cleanFrontendUrl = frontendUrl.replace(/\/+$/, '');
    const resetLink = `${cleanFrontendUrl}/reset-password?token=${resetToken}`;

    if (this.mailService) {
      await this.mailService.sendPasswordResetEmail(user.email, resetLink, user.firstName);
    } else {
      this.logger.log(
        `\n======================================================\n` +
        `[PASSWORD RESET EMAIL DISPATCH SIMULATION]\n` +
        `To: ${user.email} (${user.firstName} ${user.lastName})\n` +
        `Reset URL: ${resetLink}\n` +
        `Expires At: ${expiresAt.toISOString()} (20 minutes)\n` +
        `======================================================\n`,
      );
    }

    return {
      message: 'If an account exists with this email address, a password reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' ? { debugResetLink: resetLink, token: resetToken } : {}),
    };
  }

  /**
   * Verifies the crypto reset token is valid and unexpired, hashes the new password with Argon2id,
   * clears the token, and resets any failed lockout state.
   * Supports either ResetPasswordDto or (token: string, newPassword: string).
   */
  async resetPassword(
    input: ResetPasswordDto | { token: string; newPassword: string } | string,
    newPasswordArg?: string,
  ) {
    let rawToken: string;
    let newPasswordVal: string;

    if (typeof input === 'string') {
      rawToken = input?.trim();
      newPasswordVal = newPasswordArg || '';
    } else {
      rawToken = input?.token?.trim();
      newPasswordVal = input?.newPassword || '';
    }

    if (!rawToken) {
      throw new BadRequestException('Invalid or missing password reset token.');
    }

    if (!newPasswordVal || newPasswordVal.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: rawToken,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      // Invalidate expired token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      throw new BadRequestException('Password reset token has expired. Please request a new link.');
    }

    const passwordHash = await argon2.hash(newPasswordVal, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Invalidate existing refresh tokens for security
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    this.logger.log(`Password reset successfully completed for user: ${user.email} (${user.id})`);

    return {
      message: 'Password has been successfully reset. You may now log in with your new password.',
    };
  }
}
