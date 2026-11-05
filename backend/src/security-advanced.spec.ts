import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ValidationPipe,
  BadRequestException,
  UnauthorizedException,
  ExecutionContext,
  CallHandler,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { instanceToPlain } from 'class-transformer';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY, Public } from './common/decorators/public.decorator';
import { UserResponseDto } from './modules/iam/dto/user-response.dto';
import { DocumentResponseDto } from './modules/documents/dto/document-response.dto';
import { DocumentStatus, DocumentType } from '@prisma/client';

// Sample DTO simulating incoming user update or creation payload
class TestUpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;
}

describe('AOA 77 Document Management System - Advanced Security Hardening Suite', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  const createMockContext = (options: {
    user?: any;
    headers?: Record<string, string>;
    handler?: any;
    classRef?: any;
  }): ExecutionContext => {
    const req = {
      user: options.user,
      headers: options.headers || {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => options.handler || (() => {}),
      getClass: () => options.classRef || class TestController {},
    } as unknown as ExecutionContext;
  };

  // =========================================================================
  // 1. MASS-ASSIGNMENT REJECTION (ValidationPipe with forbidNonWhitelisted)
  // =========================================================================
  describe('1. Global Validation Whitelisting & Mass-Assignment Prevention', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });

    it('rejects unauthorized property injections with a 400 Bad Request', async () => {
      // Attacker attempts privilege escalation by injecting isAdmin and role into profile update
      const maliciousPayload = {
        firstName: 'Jane',
        lastName: 'Doe',
        isAdmin: true, // Non-whitelisted property
        role: 'SuperAdmin', // Non-whitelisted property
      };

      await assert.rejects(
        async () =>
          pipe.transform(maliciousPayload, {
            type: 'body',
            metatype: TestUpdateProfileDto,
          }),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          const response = err.getResponse() as any;
          assert.equal(err.getStatus(), 400);

          // Both non-whitelisted properties should be flagged
          const messages = Array.isArray(response.message)
            ? response.message.join(' ')
            : response.message;
          assert.match(messages, /property isAdmin should not exist/i);
          assert.match(messages, /property role should not exist/i);
          return true;
        },
      );
    });

    it('accepts legitimate whitelisted properties and transforms into DTO instance', async () => {
      const validPayload = {
        firstName: 'Chinedu',
        lastName: 'Okonkwo',
        receiveNotifications: true,
      };

      const result = await pipe.transform(validPayload, {
        type: 'body',
        metatype: TestUpdateProfileDto,
      });

      assert.ok(result instanceof TestUpdateProfileDto);
      assert.equal(result.firstName, 'Chinedu');
      assert.equal(result.lastName, 'Okonkwo');
      assert.equal(result.receiveNotifications, true);
    });
  });

  // =========================================================================
  // 2. DENY-BY-DEFAULT GLOBAL AUTH GUARD (JwtAuthGuard + @Public)
  // =========================================================================
  describe('2. Deny-by-Default Global Authentication Guard', () => {
    it('blocks unannotated / default endpoints with 401 Unauthorized when unauthenticated', () => {
      const guard = new JwtAuthGuard(reflector);

      // Default endpoint has no @Public() decorator
      reflector.getAllAndOverride = () => undefined;

      // Unauthenticated request (no JWT token or user provided)
      assert.throws(
        () => guard.handleRequest(null, null, { message: 'No bearer token' }),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), 401);
          assert.match(err.message, /Authentication required/i);
          return true;
        },
      );
    });

    it('allows unauthenticated access when handler is explicitly decorated with @Public()', () => {
      const guard = new JwtAuthGuard(reflector);

      class PublicController {
        @Public()
        publicEndpoint() {}
      }

      const handler = PublicController.prototype.publicEndpoint;
      reflector.getAllAndOverride = (key: string, targets: any[]) => {
        if (key === IS_PUBLIC_KEY) {
          // Check if metadata key is set on handler
          return Reflect.getMetadata(IS_PUBLIC_KEY, targets[0]) ?? true;
        }
        return undefined;
      };

      const context = createMockContext({ handler, classRef: PublicController });
      const allowed = guard.canActivate(context);
      assert.equal(allowed, true);
    });

    it('allows valid authenticated sessions through on protected endpoints', () => {
      const guard = new JwtAuthGuard(reflector);
      reflector.getAllAndOverride = () => false; // Not public

      const mockAuthenticatedUser = {
        id: 'usr-441',
        email: 'ops@aoa77.com',
        companyId: 'comp-100',
        role: 'Staff',
        permissions: ['invoice:view'],
      };

      const result = guard.handleRequest(null, mockAuthenticatedUser, null);
      assert.deepStrictEqual(result, mockAuthenticatedUser);
    });
  });

  // =========================================================================
  // 3. OUTPUT SERIALIZATION & ENTITY SCRUBBING (@Exclude / @Expose)
  // =========================================================================
  describe('3. Output Serialization & Entity Scrubbing', () => {
    it('strips passwordHash, lockout timestamps, and reset tokens from UserResponseDto', () => {
      const sensitiveUserEntity = new UserResponseDto({
        id: 'usr-999',
        email: 'director@aoa77.com',
        firstName: 'Babatunde',
        lastName: 'Fashola',
        phone: '+2348012345678',
        isActive: true,
        role: 'Director',
        permissions: ['invoice:*', 'waybill:*'],
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$super-sensitive-secret-hash',
        failedLoginAttempts: 3,
        lockoutUntil: new Date('2026-11-05T12:00:00Z'),
        lockedUntil: new Date('2026-11-05T12:00:00Z'),
        passwordResetToken: 'secret-reset-token-abc',
        passwordResetTokenHash: 'hashed-reset-token-xyz',
        passwordResetExpiresAt: new Date('2026-11-05T12:30:00Z'),
        internalRoleNotes: 'Super-privileged system user',
      });

      // Verify that plain JSON serialization removes all @Exclude() properties
      const plain = instanceToPlain(sensitiveUserEntity) as Record<string, any>;

      // Sensitive fields MUST NOT exist
      assert.strictEqual(plain.passwordHash, undefined);
      assert.strictEqual(plain.failedLoginAttempts, undefined);
      assert.strictEqual(plain.lockoutUntil, undefined);
      assert.strictEqual(plain.lockedUntil, undefined);
      assert.strictEqual(plain.passwordResetToken, undefined);
      assert.strictEqual(plain.passwordResetTokenHash, undefined);
      assert.strictEqual(plain.passwordResetExpiresAt, undefined);
      assert.strictEqual(plain.internalRoleNotes, undefined);

      // Safe public fields MUST remain
      assert.equal(plain.id, 'usr-999');
      assert.equal(plain.email, 'director@aoa77.com');
      assert.equal(plain.firstName, 'Babatunde');
      assert.equal(plain.lastName, 'Fashola');
      assert.equal(plain.fullName, 'Babatunde Fashola');
      assert.equal(plain.role, 'Director');
      assert.deepStrictEqual(plain.permissions, ['invoice:*', 'waybill:*']);
    });

    it('strips internal audit metadata, secrets, and deletedAt from DocumentResponseDto', () => {
      const documentEntity = new DocumentResponseDto({
        id: 'doc-inv-777',
        companyId: 'comp-aoa77',
        documentNumber: 'INV-2026-000777',
        documentType: DocumentType.INVOICE,
        title: 'Haulage Service Agreement Invoice',
        status: DocumentStatus.ISSUED,
        issueDate: new Date('2026-11-01'),
        currency: 'NGN',
        subtotal: '500000.00',
        taxAmount: '37500.00',
        discountAmount: '0.00',
        totalAmount: '537500.00',
        balanceDue: '537500.00',
        versionCounter: 2,
        createdAt: new Date('2026-11-01'),
        updatedAt: new Date('2026-11-02'),
        // Sensitive internal fields:
        deletedAt: new Date('2026-11-04'),
        internalAuditMetadata: { ip: '10.0.0.1', internalNode: 'worker-3' },
        internalSecret: 'signing-key-secret-123',
        internalNotes: 'Private dispute discussion notes',
      });

      const plain = instanceToPlain(documentEntity) as Record<string, any>;

      // Excluded sensitive fields MUST NOT be exposed
      assert.strictEqual(plain.internalAuditMetadata, undefined);
      assert.strictEqual(plain.internalSecret, undefined);
      assert.strictEqual(plain.internalNotes, undefined);
      assert.strictEqual(plain.deletedAt, undefined);

      // Public business fields MUST be preserved
      assert.equal(plain.id, 'doc-inv-777');
      assert.equal(plain.documentNumber, 'INV-2026-000777');
      assert.equal(plain.totalAmount, '537500.00');
      assert.equal(plain.status, DocumentStatus.ISSUED);
    });

    it('ClassSerializerInterceptor processes response stream and scrubs excluded fields', async () => {
      const interceptor = new ClassSerializerInterceptor(reflector);

      const userDto = new UserResponseDto({
        id: 'usr-12',
        email: 'finance@aoa77.com',
        firstName: 'Amaka',
        lastName: 'Eze',
        passwordHash: '$argon2id$v=19$should-be-stripped',
      });

      const context = createMockContext({});
      const callHandler: CallHandler = {
        handle: () => of(userDto),
      };

      const observable = interceptor.intercept(context, callHandler);
      const result = (await firstValueFrom(observable)) as Record<string, any>;

      assert.equal(result.id, 'usr-12');
      assert.equal(result.email, 'finance@aoa77.com');
      assert.strictEqual(result.passwordHash, undefined);
    });
  });
});

