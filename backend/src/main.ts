import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// Safe BigInt JSON serialization for Prisma BigInt fields (e.g. File.sizeBytes)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:5173');

  // Security Middleware: Helmet
  app.use(helmet());

  // Cookie Parser for secure httpOnly refresh tokens
  app.use(cookieParser());

  // CORS Configuration
  app.enableCors({
    origin: [appUrl, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key', 'Idempotency-Key'],
  });

  // Global API Prefix (/api/v1)
  app.setGlobalPrefix(apiPrefix);

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

  // OpenAPI / Swagger Documentation
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

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`========================================================`);
  logger.log(`🚀 Business Document Management API is running!`);
  logger.log(`📡 Base API URL: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger OpenAPI Docs: http://localhost:${port}/api/docs`);
  logger.log(`🏢 Organization: AOA 77 COMPANY LTD`);
  logger.log(`========================================================`);
}

bootstrap();
