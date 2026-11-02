import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { buildAllowedCorsOrigins, isOriginAllowed } from './common/utils/cors.util';

// Safe BigInt JSON serialization for Prisma BigInt fields (e.g. File.sizeBytes)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = parseInt(String(configService.get<string | number>('PORT', 3000)), 10) || 3000;
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:5173');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  // Trust reverse proxy for client IP resolution and rate limiters
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);

  // Security Middleware: Helmet with cross-origin resource support for native app and web previews
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie Parser for secure httpOnly refresh tokens
  app.use(cookieParser());

  // Strict CORS Allowlist Configuration (no wildcards or open reflection)
  const frontendUrlEnv = configService.get<string>('FRONTEND_URL');
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN');
  const allowedOrigins = buildAllowedCorsOrigins({
    corsOrigin: corsOriginEnv,
    frontendUrl: frontendUrlEnv,
    appUrl,
    nodeEnv,
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins, isProduction)) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS request from unauthorized origin: ${origin}`);
      return callback(new ForbiddenException(`Origin "${origin}" is not permitted by CORS policy.`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key', 'Idempotency-Key'],
  });

  // Global API Prefix (/api/v1) with exclusion for uptime health checks
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'health/(.*)', 'api/health', 'api/health/(.*)', 'api/v1/health', 'api/v1/health/(.*)'],
  });

  // Global Input Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI / Swagger Documentation (Restricted to non-production environments)
  if (!isProduction || configService.get<boolean>('ENABLE_SWAGGER_IN_PROD', false)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Business Document Management API')
      .setDescription(
        'Enterprise REST API for Business Document Management (Invoices, Waybills, Letters, Approvals, and Payments Ledger). ' +
        'Initial Organization Profile: AOA 77 COMPANY LTD.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter your JWT access token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: 'AOA 77 Document API Docs',
    });
  }

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`========================================================`);
  logger.log(`🚀 Business Document Management API is running!`);
  logger.log(`📡 Base API URL: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger OpenAPI Docs: http://localhost:${port}/api/docs`);
  logger.log(`🏢 Organization: AOA 77 COMPANY LTD`);
  logger.log(`========================================================`);
}

bootstrap();
