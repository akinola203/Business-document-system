import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { buildAllowedCorsOrigins, isOriginAllowed } from '../../common/utils/cors.util';

const REFRESH_COOKIE_NAME = 'refresh_token';
const LOGIN_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 100 : 5;

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getRefreshCookieOptions(rememberMe = false) {
    const isProd = process.env.NODE_ENV === 'production';
    const apiPrefix = process.env.API_PREFIX || 'api/v1';
    const cleanPrefix = apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
    const cookiePath = process.env.REFRESH_COOKIE_PATH || `${cleanPrefix}/auth`;
    const rawSameSite = (
      process.env.COOKIE_SAMESITE ||
      process.env.REFRESH_COOKIE_SAME_SITE ||
      'lax'
    ).toLowerCase();
    const sameSiteConfig = (
      ['strict', 'lax', 'none'].includes(rawSameSite) ? rawSameSite : 'lax'
    ) as 'strict' | 'lax' | 'none';

    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days for Remember Me session
      : 7 * 24 * 60 * 60 * 1000; // 7 days standard session

    return {
      httpOnly: true,
      secure: isProd || sameSiteConfig === 'none',
      sameSite: sameSiteConfig,
      maxAge,
      path: cookiePath,
    };
  }

  /**
   * CSRF protection for cookie-bearing POST endpoints (/auth/refresh and /auth/logout).
   * Blocks cross-site POSTs that lack a valid allowlisted Origin (or Referer origin).
   */
  private assertTrustedOrigin(req: Request): void {
    const isProd = process.env.NODE_ENV === 'production';
    const allowedOrigins = buildAllowedCorsOrigins({
      corsOrigin: process.env.CORS_ORIGIN,
      frontendUrl: process.env.FRONTEND_URL,
      appUrl: process.env.APP_URL || 'http://localhost:5173',
      nodeEnv: process.env.NODE_ENV || 'development',
    });

    const rawOrigin = (req.headers?.origin as string | undefined) || req.get?.('origin');
    const rawReferer = (req.headers?.referer as string | undefined) || req.get?.('referer');

    let candidateOrigin = rawOrigin?.trim();
    if (!candidateOrigin && rawReferer) {
      try {
        candidateOrigin = new URL(rawReferer).origin;
      } catch {
        candidateOrigin = undefined;
      }
    }

    if (!candidateOrigin || !isOriginAllowed(candidateOrigin, allowedOrigins, isProd)) {
      throw new ForbiddenException(
        'Cross-site POST blocked: missing or untrusted Origin header.',
      );
    }
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: LOGIN_RATE_LIMIT, ttl: 60 })
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user credentials and receive JWT access token' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 403, description: 'Account locked due to excessive failed attempts' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    // Set refresh token in secure httpOnly cookie (extended maxAge if rememberMe)
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      this.getRefreshCookieOptions(Boolean(result.rememberMe ?? loginDto.rememberMe)),
    );

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.FORBIDDEN)
  @ApiOperation({ summary: 'Public self-registration endpoint (Strictly rate-limited)' })
  @ApiResponse({ status: 403, description: 'Public self-registration is disabled for enterprise tenant security' })
  async register() {
    return {
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Self-registration is disabled. Please contact your company administrator to receive an onboarding invitation.',
    };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttl: 60 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue fresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedOrigin(req);
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await this.authService.refreshTokens(rawRefreshToken, ipAddress, userAgent);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      this.getRefreshCookieOptions(Boolean(result.rememberMe)),
    );

    return {
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke active refresh token and clear session cookies' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertTrustedOrigin(req);
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    await this.authService.logout(rawRefreshToken);

    const cookieOpts = this.getRefreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
    });

    return { message: 'Logged out successfully' };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttl: 60 })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email link' })
  @ApiResponse({ status: 200, description: 'Reset email dispatched if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, ttl: 60 })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using valid reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve currently authenticated user profile and permissions' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
