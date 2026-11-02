import {
  Controller,
  Get,
  Req,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@ApiTags('Health & Diagnostics')
@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  private hasValidInternalToken(req?: Request): boolean {
    const expectedToken = process.env.HEALTH_CHECK_TOKEN?.trim();
    if (!expectedToken || !req?.headers) {
      return false;
    }
    const headerVal = req.headers['x-health-token'];
    const rawHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!rawHeader || typeof rawHeader !== 'string') {
      return false;
    }
    const a = Buffer.from(rawHeader.trim());
    const b = Buffer.from(expectedToken);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  private assertAuthorizedHealthAccess(req?: Request, user?: AuthenticatedUser): void {
    if (this.hasValidInternalToken(req)) {
      return;
    }
    if (!user) {
      throw new UnauthorizedException('Authentication or internal health token required.');
    }
    const isAllowed =
      user.role === 'Admin' ||
      user.permissions?.includes('*') ||
      user.permissions?.includes('*:*') ||
      user.permissions?.includes('audit:view');

    if (!isAllowed) {
      throw new ForbiddenException('Access denied. Requires audit:view permission or internal health token.');
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API service liveness and uptime' })
  @ApiResponse({ status: 200, description: 'API is healthy and running' })
  checkHealth() {
    return {
      status: 'ok',
      service: 'business-doc-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('audit:view')
  @Get('database')
  @ApiOperation({ summary: 'Check PostgreSQL database connection via Prisma' })
  @ApiResponse({ status: 200, description: 'Database connection is active' })
  @ApiResponse({ status: 503, description: 'Database connection failed' })
  async checkDatabase(
    @Req() req?: Request,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    this.assertAuthorizedHealthAccess(req, user);
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new HttpException(
        {
          status: 'error',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('audit:view')
  @Get('storage')
  @ApiOperation({ summary: 'Check local volume write/read health for document storage' })
  @ApiResponse({ status: 200, description: 'Storage volume is mounted and writable' })
  @ApiResponse({ status: 503, description: 'Storage volume is inaccessible or read-only' })
  async checkStorage(
    @Req() req?: Request,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    this.assertAuthorizedHealthAccess(req, user);
    const rawStorageDir = process.env.STORAGE_LOCAL_DIR || './storage/secure-uploads';
    const storagePath = path.isAbsolute(rawStorageDir)
      ? rawStorageDir
      : path.resolve(process.cwd(), rawStorageDir);

    const probeFile = path.join(storagePath, `.health-probe-${Date.now()}.tmp`);

    try {
      await fs.promises.mkdir(storagePath, { recursive: true });
      await fs.promises.writeFile(probeFile, 'ok', 'utf-8');
      await fs.promises.unlink(probeFile);

      return {
        status: 'ok',
        storage: 'writable',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new HttpException(
        {
          status: 'error',
          storage: 'unwritable',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
