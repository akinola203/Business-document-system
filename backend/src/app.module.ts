import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ClientsModule } from './modules/clients/clients.module';
import { NumberingModule } from './modules/numbering/numbering.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { WaybillsModule } from './modules/waybills/waybills.module';
import { LettersModule } from './modules/letters/letters.module';
import { AuditModule } from './modules/audit/audit.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { IamModule } from './modules/iam/iam.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompanyScopeGuard } from './common/guards/company-scope.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    AuditModule,
    IdempotencyModule,
    NotificationsModule,
    AuthModule,
    HealthModule,
    CompaniesModule,
    OrganizationModule,
    ClientsModule,
    NumberingModule,
    DocumentsModule,
    InvoicesModule,
    WaybillsModule,
    LettersModule,
    PaymentsModule,
    IamModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CompanyScopeGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
