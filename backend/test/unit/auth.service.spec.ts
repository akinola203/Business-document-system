import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: Partial<PrismaService>;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as any,
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      } as any,
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-signed-jwt-token'),
    };

    configService = {
      get: jest.fn((key: string, defaultVal: any) => defaultVal),
    };

    service = new AuthService(
      prisma as PrismaService,
      jwtService as JwtService,
      configService as ConfigService,
    );
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist', async () => {
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({ email: 'nonexistent@aoa77.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is locked out', async () => {
      const futureLockout = new Date(Date.now() + 10 * 60 * 1000);
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'locked@aoa77.com',
        lockoutUntil: futureLockout,
      });

      await expect(
        service.login({ email: 'locked@aoa77.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should track failed attempts and lock out after 5 failures', async () => {
      const mockPasswordHash = await argon2.hash('correctPassword');
      (prisma.user!.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'user@aoa77.com',
        passwordHash: mockPasswordHash,
        failedLoginAttempts: 4,
        lockoutUntil: null,
      });

      await expect(
        service.login({ email: 'user@aoa77.com', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockoutUntil: expect.any(Date),
          }),
        }),
      );
    });
  });
});
