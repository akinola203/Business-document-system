import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto, createRoleSchema } from './dto/create-role.dto';
import { UpdateRolePermissionsDto, updateRolePermissionsSchema } from './dto/update-role-permissions.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  // Core administrative permissions that must never be stripped from the Admin role to prevent tenant lockout
  private static readonly CORE_ADMIN_PERMISSIONS = [
    'users:view',
    'users:manage',
    'roles:manage',
    'company:view',
    'company:update',
    'settings:manage',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves all roles available to the company (both standard system roles and company custom roles).
   */
  async findAllRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            companyUsers: {
              where: { companyId },
            },
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Retrieves master catalog of all system permissions, grouped by domain category.
   */
  async findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { slug: 'asc' }],
    });
  }

  /**
   * Creates a custom role scoped strictly to the calling company.
   */
  async createRole(companyId: string, dto: CreateRoleDto, actorId: string) {
    createRoleSchema.parse(dto);
    const trimmedName = dto.name.trim();

    const existingRole = await this.prisma.role.findFirst({
      where: {
        companyId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existingRole) {
      throw new ConflictException(`Role with name "${trimmedName}" already exists in your company.`);
    }

    // Verify all requested permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permission IDs provided are invalid.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          companyId,
          name: trimmedName,
          description: dto.description?.trim(),
          isSystem: false,
          rolePermissions: {
            createMany: {
              data: dto.permissionIds.map((permissionId) => ({ permissionId })),
            },
          },
        },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'ROLE_CREATED',
          entityType: 'Role',
          entityId: role.id,
          newValues: {
            name: role.name,
            description: role.description,
            permissions: permissions.map((p) => p.slug),
          },
        },
        tx,
      );

      return role;
    });

    this.logger.log(`Custom role "${trimmedName}" created for company "${companyId}" by "${actorId}".`);
    return created;
  }

  /**
   * Updates permission set assigned to a role.
   * Guardrail: Protects the Admin role from having core governance permissions stripped.
   */
  async updateRolePermissions(
    companyId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
    actorId: string,
  ) {
    updateRolePermissionsSchema.parse(dto);

    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ companyId }, { companyId: null }],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${roleId}" not found.`);
    }

    // Load full permission details
    const targetPermissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (targetPermissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permission IDs provided are invalid.');
    }

    // Safety guardrail: Do not strip core admin permissions from the Admin role
    if (role.name.toLowerCase() === 'admin') {
      const targetSlugs = new Set(targetPermissions.map((p) => p.slug));
      const missingCorePerms = RolesService.CORE_ADMIN_PERMISSIONS.filter(
        (perm) => !targetSlugs.has(perm),
      );

      if (missingCorePerms.length > 0) {
        throw new BadRequestException(
          `Safety Guardrail: Cannot strip core administrative permissions [${missingCorePerms.join(', ')}] from the Admin role to prevent company lockout.`,
        );
      }
    }

    const previousSlugs = (role.rolePermissions ?? []).map((rp) => rp.permission?.slug ?? '');

    const updated = await this.prisma.$transaction(async (tx) => {
      // Clear existing permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Insert new permission bindings
      await tx.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'ROLE_PERMISSIONS_UPDATED',
          entityType: 'Role',
          entityId: role.id,
          oldValues: { roleName: role.name, permissions: previousSlugs },
          newValues: { roleName: role.name, permissions: targetPermissions.map((p) => p.slug) },
        },
        tx,
      );

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });

    this.logger.log(`Permissions updated for role "${role.name}" (${roleId}) by user "${actorId}".`);
    return updated;
  }
}
