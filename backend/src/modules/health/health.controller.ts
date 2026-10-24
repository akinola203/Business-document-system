import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'General application health check' })
  @ApiResponse({ status: 200, description: 'Application is running' })
  getHealth() {
    return {
      status: 'ok',
      service: 'business-doc-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
    };
  }

  @Public()
  @Get('database')
  @ApiOperation({ summary: 'PostgreSQL database connectivity check' })
  @ApiResponse({ status: 200, description: 'Database is reachable and responding' })
  async getDatabaseHealth() {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1 as ping`;
      const responseTimeMs = Date.now() - startTime;
      return {
        status: 'ok',
        database: 'postgresql',
        connected: true,
        responseTimeMs,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        status: 'error',
        database: 'postgresql',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Public()
  @Get('storage')
  @ApiOperation({ summary: 'Storage subsystem readiness check' })
  @ApiResponse({ status: 200, description: 'Storage directory or bucket is ready' })
  getStorageHealth() {
    const storageType = this.configService.get<string>('STORAGE_TYPE', 'local');
    const storageRoot = this.configService.get<string>('STORAGE_LOCAL_ROOT', './storage/secure-uploads');

    if (storageType === 'local') {
      try {
        const resolvedPath = path.resolve(storageRoot);
        if (!fs.existsSync(resolvedPath)) {
          fs.mkdirSync(resolvedPath, { recursive: true });
        }
        // Test write and delete
        const testFile = path.join(resolvedPath, `.health-check-${Date.now()}`);
        fs.writeFileSync(testFile, 'health-check');
        fs.unlinkSync(testFile);

        return {
          status: 'ok',
          storageType: 'local',
          storagePath: resolvedPath,
          writable: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        return {
          status: 'error',
          storageType: 'local',
          writable: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      status: 'ok',
      storageType,
      message: 'Cloud storage driver configured',
      timestamp: new Date().toISOString(),
    };
  }
}
