import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompanyUserStatus } from '@prisma/client';
import { CreateUserDto, createUserSchema } from './dto/create-user.dto';
import { UpdateUserRoleDto, updateUserRoleSchema } from './dto/update-user-role.dto';
import { UpdateUserStatusDto, updateUserStatusSchema } from './dto/update-user-status.dto';
import { ResetUserPasswordDto, resetUserPasswordSchema } from './dto/reset-user-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async assertCallerCanAssignRole(companyId: string, actorId: string, targetRoleId: string) {
    const actorMembership = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: actorId,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: true,
          },
        },
      },
    });

    if (!actorMembership) {
      throw new ForbiddenException('Actor does not belong to this company.');
    }

    const roleName = actorMembership.role.name.toLowerCase();
    if (roleName === 'admin' || roleName === 'administrator' || roleName === 'owner') {
      return;
    }

    const targetRolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: targetRoleId },
    });

    let actorRolePermissions = actorMembership.role.rolePermissions;
    if (!actorRolePermissions) {
      actorRolePermissions = await this.prisma.rolePermission.findMany({
        where: { roleId: actorMembership.roleId },
      });
    }

    const actorPermissionIds = new Set(
      (actorRolePermissions || []).map((rp: any) => rp.permissionId),
    );

    for (const rp of targetRolePermissions) {
      if (!actorPermissionIds.has(rp.permissionId)) {
        throw new ForbiddenException(
          'Privilege Escalation Guard: You cannot assign a role containing permissions you do not hold.',
        );
      }
    }
  }

  /**
   * Retrieves paginated, searchable list of users belonging to the company.
   */
  async findAll(companyId: string, query: QueryUsersDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.user = {
        OR: [
          { firstName: { contains: s, mode: 'insensitive' } },
          { lastName: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.companyUser.count({ where }),
      this.prisma.companyUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Creates or invites a user into the company with assigned role and department.
   */
  async create(companyId: string, dto: CreateUserDto, actorId: string) {
    createUserSchema.parse(dto);
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Verify role exists and is accessible by this company
    const role = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
        OR: [{ companyId }, { companyId: null }],
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${dto.roleId}" not found.`);
    }

    await this.assertCallerCanAssignRole(companyId, actorId, dto.roleId);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException(`A user with email "${normalizedEmail}" already exists.`);
    }

    // User is completely new: create User + CompanyUser
    const plainPassword = dto.password?.trim() || `${crypto.randomBytes(6).toString('hex')}A1!`;
    const passwordHash = await argon2.hash(plainPassword);

    const created = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim(),
          isActive: true,
        },
      });

      const companyUser = await tx.companyUser.create({
        data: {
          companyId,
          userId: newUser.id,
          roleId: dto.roleId,
          departmentId: dto.departmentId,
          branchId: dto.branchId,
          status: CompanyUserStatus.ACTIVE,
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true },
          },
          role: true,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'USER_CREATED',
          entityType: 'CompanyUser',
          entityId: companyUser.id,
          newValues: {
            userId: newUser.id,
            email: normalizedEmail,
            role: role.name,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
        tx,
      );

      return { companyUser, temporaryPassword: dto.password ? undefined : plainPassword };
    });

    this.logger.log(`New user "${normalizedEmail}" created for company "${companyId}" by "${actorId}".`);
    return created;
  }

  /**
   * Updates a user's role within the company.
   * Guardrail: Prevents demoting the last active Admin.
   */
  async updateRole(companyId: string, targetUserId: string, dto: UpdateUserRoleDto, actorId: string) {
    updateUserRoleSchema.parse(dto);

    const companyUser = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: targetUserId,
        },
      },
      include: { role: true },
    });

    if (!companyUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" not found in this company.`);
    }

    const newRole = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
        OR: [{ companyId }, { companyId: null }],
      },
    });

    if (!newRole) {
      throw new NotFoundException(`Role with ID "${dto.roleId}" not found.`);
    }

    await this.assertCallerCanAssignRole(companyId, actorId, dto.roleId);

    // Safety guardrail: Do not allow demoting the last active Admin
    if (companyUser.role.name.toLowerCase() === 'admin' && newRole.name.toLowerCase() !== 'admin') {
      const activeAdminCount = await this.prisma.companyUser.count({
        where: {
          companyId,
          role: { name: { equals: 'Admin', mode: 'insensitive' } },
          status: CompanyUserStatus.ACTIVE,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException('Safety Guardrail: Cannot demote the last active Admin of the company.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.companyUser.update({
        where: { id: companyUser.id },
        data: { roleId: dto.roleId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          role: true,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'USER_ROLE_UPDATED',
          entityType: 'CompanyUser',
          entityId: companyUser.id,
          oldValues: { roleId: companyUser.roleId, roleName: companyUser.role.name },
          newValues: { roleId: newRole.id, roleName: newRole.name },
        },
        tx,
      );

      return result;
    });

    this.logger.log(`User "${targetUserId}" role changed from "${companyUser.role.name}" to "${newRole.name}" by "${actorId}".`);
    return updated;
  }

  /**
   * Activates or deactivates / suspends a user within the company.
   * Guardrail 1: A user cannot deactivate themselves.
   * Guardrail 2: Prevents deactivating the last active Admin of the company.
   * Invalidation: Revokes all active refresh tokens on deactivation.
   */
  async updateStatus(companyId: string, targetUserId: string, dto: UpdateUserStatusDto, actorId: string) {
    updateUserStatusSchema.parse(dto);

    if (targetUserId === actorId && dto.status !== CompanyUserStatus.ACTIVE) {
      throw new BadRequestException('Safety Guardrail: You cannot deactivate or suspend your own account.');
    }

    const companyUser = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: targetUserId,
        },
      },
      include: { role: true },
    });

    if (!companyUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" not found in this company.`);
    }

    // Safety guardrail: Do not deactivate the last active Admin
    if (
      companyUser.role.name.toLowerCase() === 'admin' &&
      companyUser.status === CompanyUserStatus.ACTIVE &&
      dto.status !== CompanyUserStatus.ACTIVE
    ) {
      const activeAdminCount = await this.prisma.companyUser.count({
        where: {
          companyId,
          role: { name: { equals: 'Admin', mode: 'insensitive' } },
          status: CompanyUserStatus.ACTIVE,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException('Safety Guardrail: Cannot deactivate the last active Admin of the company.');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If deactivating or suspending, revoke all active refresh tokens immediately
      if (dto.status !== CompanyUserStatus.ACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      const result = await tx.companyUser.update({
        where: { id: companyUser.id },
        data: { status: dto.status },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          role: true,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'USER_STATUS_UPDATED',
          entityType: 'CompanyUser',
          entityId: companyUser.id,
          oldValues: { status: companyUser.status },
          newValues: { status: dto.status },
        },
        tx,
      );

      return result;
    });

    this.logger.log(`User "${targetUserId}" status transitioned to "${dto.status}" by "${actorId}".`);
    return updated;
  }

  /**
   * Resets a user's password and invalidates all existing sessions.
   */
  async resetPassword(companyId: string, targetUserId: string, dto: ResetUserPasswordDto, actorId: string) {
    resetUserPasswordSchema.parse(dto);

    const companyUser = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: targetUserId,
        },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!companyUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" not found in this company.`);
    }

    const membershipCount = await this.prisma.companyUser.count({
      where: { userId: targetUserId },
    });

    if (membershipCount > 1) {
      throw new ForbiddenException(
        'Password reset is forbidden because this user belongs to multiple organizations.',
      );
    }

    const plainPassword = dto.newPassword?.trim() || `${crypto.randomBytes(6).toString('hex')}A1!`;
    const passwordHash = await argon2.hash(plainPassword);

    await this.prisma.$transaction(async (tx) => {
      // Invalidate all active sessions immediately
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'USER_PASSWORD_RESET',
          entityType: 'User',
          entityId: targetUserId,
          newValues: { email: companyUser.user.email, passwordResetBy: actorId },
        },
        tx,
      );
    });

    this.logger.log(`Password reset for user "${targetUserId}" by admin "${actorId}".`);

    return {
      message: 'Password reset successfully. All active sessions have been revoked.',
      temporaryPassword: dto.newPassword ? undefined : plainPassword,
    };
  }
}
