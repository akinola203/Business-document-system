import { test } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../src/modules/iam/users.service';
import { RolesService } from '../../src/modules/iam/roles.service';
import { CompanyUserStatus } from '@prisma/client';

test('Administrative IAM (Users & Roles) Unit Tests', async (t) => {
  let usersDb: any[] = [];
  let companyUsersDb: any[] = [];
  let rolesDb: any[] = [];
  let permissionsDb: any[] = [];
  let rolePermissionsDb: any[] = [];
  let refreshTokensDb: any[] = [];
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    user: {
      findUnique: async ({ where }: any) => {
        return usersDb.find((u) => u.email === where.email || u.id === where.id) || null;
      },
      create: async ({ data }: any) => {
        const item = { id: `usr-${usersDb.length + 1}`, ...data };
        usersDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = usersDb.findIndex((u) => u.id === where.id);
        usersDb[idx] = { ...usersDb[idx], ...data };
        return usersDb[idx];
      },
    },
    companyUser: {
      count: async ({ where }: any) => {
        let list = companyUsersDb;
        if (where.companyId) list = list.filter((cu) => cu.companyId === where.companyId);
        if (where.userId) list = list.filter((cu) => cu.userId === where.userId);
        if (where.status) list = list.filter((cu) => cu.status === where.status);
        if (where.role?.name?.equals) {
          const roleName = where.role.name.equals.toLowerCase();
          list = list.filter((cu) => {
            const r = rolesDb.find((role) => role.id === cu.roleId);
            return r && r.name.toLowerCase() === roleName;
          });
        }
        if (where.user?.OR) {
          const search = where.user.OR[0].firstName.contains.toLowerCase();
          list = list.filter((cu) => {
            const u = usersDb.find((user) => user.id === cu.userId);
            return (
              u &&
              (u.firstName.toLowerCase().includes(search) ||
                u.lastName.toLowerCase().includes(search) ||
                u.email.toLowerCase().includes(search))
            );
          });
        }
        return list.length;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        let list = companyUsersDb.filter((cu) => cu.companyId === where.companyId);
        if (where.status) list = list.filter((cu) => cu.status === where.status);
        if (where.roleId) list = list.filter((cu) => cu.roleId === where.roleId);
        if (where.user?.OR) {
          const search = where.user.OR[0].firstName.contains.toLowerCase();
          list = list.filter((cu) => {
            const u = usersDb.find((user) => user.id === cu.userId);
            return (
              u &&
              (u.firstName.toLowerCase().includes(search) ||
                u.lastName.toLowerCase().includes(search) ||
                u.email.toLowerCase().includes(search))
            );
          });
        }
        return list.slice(skip, skip + take).map((cu) => ({
          ...cu,
          user: usersDb.find((u) => u.id === cu.userId),
          role: rolesDb.find((r) => r.id === cu.roleId),
        }));
      },
      findUnique: async ({ where }: any) => {
        const cu = companyUsersDb.find(
          (c) => c.companyId === where.companyId_userId?.companyId && c.userId === where.companyId_userId?.userId,
        );
        if (!cu) return null;
        const role = rolesDb.find((r) => r.id === cu.roleId);
        return {
          ...cu,
          user: usersDb.find((u) => u.id === cu.userId),
          role: role
            ? {
                ...role,
                rolePermissions: rolePermissionsDb
                  .filter((rp) => rp.roleId === role.id)
                  .map((rp) => ({
                    ...rp,
                    permission: permissionsDb.find((p) => p.id === rp.permissionId),
                  })),
              }
            : null,
        };
      },
      create: async ({ data }: any) => {
        const item = { id: `cu-${companyUsersDb.length + 1}`, ...data };
        companyUsersDb.push(item);
        return {
          ...item,
          user: usersDb.find((u) => u.id === item.userId),
          role: rolesDb.find((r) => r.id === item.roleId),
        };
      },
      update: async ({ where, data }: any) => {
        const idx = companyUsersDb.findIndex((cu) => cu.id === where.id);
        companyUsersDb[idx] = { ...companyUsersDb[idx], ...data };
        return {
          ...companyUsersDb[idx],
          user: usersDb.find((u) => u.id === companyUsersDb[idx].userId),
          role: rolesDb.find((r) => r.id === companyUsersDb[idx].roleId),
        };
      },
    },
    role: {
      findFirst: async ({ where }: any) => {
        const role = rolesDb.find((r) => {
          const idMatches = where.id ? r.id === where.id : true;
          const nameMatches = where.name?.equals
            ? r.name.toLowerCase() === where.name.equals.toLowerCase()
            : true;
          const companyMatches = where.OR
            ? where.OR.some((cond: any) => cond.companyId === undefined || cond.companyId === null ? r.companyId === null : r.companyId === cond.companyId)
            : where.companyId !== undefined
              ? r.companyId === where.companyId
              : true;
          return idMatches && nameMatches && companyMatches;
        });
        if (!role) return null;
        const rps = rolePermissionsDb
          .filter((rp) => rp.roleId === role.id)
          .map((rp) => ({
            ...rp,
            permission: permissionsDb.find((p) => p.id === rp.permissionId),
          }));
        return { ...role, rolePermissions: rps };
      },
      findUnique: async ({ where }: any) => {
        const role = rolesDb.find((r) => r.id === where.id);
        if (!role) return null;
        const rps = rolePermissionsDb
          .filter((rp) => rp.roleId === role.id)
          .map((rp) => ({
            ...rp,
            permission: permissionsDb.find((p) => p.id === rp.permissionId),
          }));
        return { ...role, rolePermissions: rps };
      },
      findMany: async ({ where }: any) => {
        return rolesDb.filter((r) => r.companyId === where.companyId || r.companyId === null).map((role) => ({
          ...role,
          rolePermissions: rolePermissionsDb
            .filter((rp) => rp.roleId === role.id)
            .map((rp) => ({
              ...rp,
              permission: permissionsDb.find((p) => p.id === rp.permissionId),
            })),
          _count: {
            companyUsers: companyUsersDb.filter((cu) => cu.roleId === role.id).length,
          },
        }));
      },
      create: async ({ data }: any) => {
        const item = { id: `role-${rolesDb.length + 1}`, ...data };
        rolesDb.push(item);
        if (data.rolePermissions?.createMany?.data) {
          data.rolePermissions.createMany.data.forEach((rp: any) => {
            rolePermissionsDb.push({ id: `rp-${rolePermissionsDb.length + 1}`, roleId: item.id, ...rp });
          });
        }
        return {
          ...item,
          rolePermissions: rolePermissionsDb
            .filter((rp) => rp.roleId === item.id)
            .map((rp) => ({
              ...rp,
              permission: permissionsDb.find((p) => p.id === rp.permissionId),
            })),
        };
      },
    },
    permission: {
      findMany: async ({ where }: any) => {
        if (where?.id?.in) {
          return permissionsDb.filter((p) => where.id.in.includes(p.id));
        }
        return permissionsDb;
      },
    },
    rolePermission: {
      findMany: async ({ where }: any) => {
        if (where?.roleId) {
          return rolePermissionsDb.filter((rp) => rp.roleId === where.roleId);
        }
        return rolePermissionsDb;
      },
      deleteMany: async ({ where }: any) => {
        rolePermissionsDb = rolePermissionsDb.filter((rp) => rp.roleId !== where.roleId);
        return { count: 1 };
      },
      createMany: async ({ data }: any) => {
        data.forEach((d: any) => {
          rolePermissionsDb.push({ id: `rp-${rolePermissionsDb.length + 1}`, ...d });
        });
        return { count: data.length };
      },
    },
    refreshToken: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        refreshTokensDb.forEach((rt) => {
          if (rt.userId === where.userId && (where.isRevoked === undefined || rt.isRevoked === where.isRevoked)) {
            Object.assign(rt, data);
            count++;
          }
        });
        return { count };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: `audit-${auditLogs.length}`, ...data };
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogs.push(entry);
    },
  };

  const usersService = new UsersService(mockPrisma, mockAuditService);
  const rolesService = new RolesService(mockPrisma, mockAuditService);

  // Setup seed data
  const seedData = () => {
    usersDb = [
      {
        id: 'usr-admin-1',
        email: 'admin@aoa77.com',
        firstName: 'Alade',
        lastName: 'Adebayo',
        isActive: true,
        passwordHash: 'argon2-hash-1',
      },
      {
        id: 'usr-staff-1',
        email: 'staff@aoa77.com',
        firstName: 'Bolaji',
        lastName: 'Adeyemi',
        isActive: true,
        passwordHash: 'argon2-hash-2',
      },
    ];

    rolesDb = [
      { id: 'role-admin', companyId: null, name: 'Admin', isSystem: true },
      { id: 'role-manager', companyId: null, name: 'Manager', isSystem: true },
      { id: 'role-staff', companyId: null, name: 'Staff', isSystem: true },
    ];

    companyUsersDb = [
      {
        id: 'cu-1',
        companyId: 'comp-1',
        userId: 'usr-admin-1',
        roleId: 'role-admin',
        status: CompanyUserStatus.ACTIVE,
      },
      {
        id: 'cu-2',
        companyId: 'comp-1',
        userId: 'usr-staff-1',
        roleId: 'role-staff',
        status: CompanyUserStatus.ACTIVE,
      },
    ];

    permissionsDb = [
      { id: 'p-users-view', slug: 'users:view', name: 'View Users', category: 'USERS' },
      { id: 'p-users-manage', slug: 'users:manage', name: 'Manage Users', category: 'USERS' },
      { id: 'p-roles-manage', slug: 'roles:manage', name: 'Manage Roles', category: 'USERS' },
      { id: 'p-company-view', slug: 'company:view', name: 'View Company', category: 'COMPANY' },
      { id: 'p-company-update', slug: 'company:update', name: 'Update Company', category: 'COMPANY' },
      { id: 'p-settings-manage', slug: 'settings:manage', name: 'Manage Settings', category: 'SETTINGS' },
      { id: 'p-invoice-view', slug: 'invoice:view', name: 'View Invoice', category: 'INVOICE' },
    ];

    rolePermissionsDb = permissionsDb.map((p, idx) => ({
      id: `rp-${idx + 1}`,
      roleId: 'role-admin',
      permissionId: p.id,
    }));

    refreshTokensDb = [
      { id: 'rt-1', userId: 'usr-staff-1', isRevoked: false },
      { id: 'rt-2', userId: 'usr-staff-1', isRevoked: false },
    ];

    auditLogs = [];
  };

  seedData();

  // 1. UsersService.findAll
  await t.test('UsersService.findAll returns paginated list filtered by company and search', async () => {
    const res = await usersService.findAll('comp-1', { search: 'adeyemi' });
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].user.email, 'staff@aoa77.com');
    assert.equal(res.meta.total, 1);
  });

  // 2. UsersService.create
  await t.test('UsersService.create hashes password and assigns new user to company', async () => {
    const res = await usersService.create(
      'comp-1',
      {
        email: 'new.officer@aoa77.com',
        firstName: 'Sunday',
        lastName: 'Babatunde',
        roleId: 'role-manager',
      },
      'usr-admin-1',
    );

    assert.ok(res.companyUser);
    assert.equal(res.companyUser.user.email, 'new.officer@aoa77.com');
    assert.equal(res.companyUser.role.name, 'Manager');
    assert.ok(res.temporaryPassword);
    assert.ok(auditLogs.some((a) => a.action === 'USER_CREATED'));
  });

  await t.test('UsersService.create rejects duplicate member in company', async () => {
    await assert.rejects(
      async () => {
        await usersService.create(
          'comp-1',
          {
            email: 'staff@aoa77.com',
            firstName: 'Bolaji',
            lastName: 'Adeyemi',
            roleId: 'role-staff',
          },
          'usr-admin-1',
        );
      },
      ConflictException,
    );
  });

  // 3. UsersService.updateRole
  await t.test('UsersService.updateRole updates user role and logs audit trail', async () => {
    const updated = await usersService.updateRole('comp-1', 'usr-staff-1', { roleId: 'role-manager' }, 'usr-admin-1');
    assert.equal(updated.role.name, 'Manager');
    assert.ok(auditLogs.some((a) => a.action === 'USER_ROLE_UPDATED'));
  });

  await t.test('UsersService.updateRole prevents demoting the last active Admin of company', async () => {
    await assert.rejects(
      async () => {
        await usersService.updateRole('comp-1', 'usr-admin-1', { roleId: 'role-staff' }, 'usr-admin-1');
      },
      BadRequestException,
    );
  });

  // 4. UsersService.updateStatus
  await t.test('UsersService.updateStatus prevents self-deactivation', async () => {
    await assert.rejects(
      async () => {
        await usersService.updateStatus(
          'comp-1',
          'usr-admin-1',
          { status: CompanyUserStatus.SUSPENDED },
          'usr-admin-1',
        );
      },
      BadRequestException,
    );
  });

  await t.test('UsersService.updateStatus prevents deactivating the last active Admin', async () => {
    await assert.rejects(
      async () => {
        // Someone else attempting to deactivate the only Admin
        await usersService.updateStatus(
          'comp-1',
          'usr-admin-1',
          { status: CompanyUserStatus.SUSPENDED },
          'usr-staff-1',
        );
      },
      BadRequestException,
    );
  });

  await t.test('UsersService.updateStatus deactivates user and revokes active refresh tokens', async () => {
    const updated = await usersService.updateStatus(
      'comp-1',
      'usr-staff-1',
      { status: CompanyUserStatus.SUSPENDED },
      'usr-admin-1',
    );
    assert.equal(updated.status, CompanyUserStatus.SUSPENDED);

    // Verify refresh tokens were revoked
    const activeTokens = refreshTokensDb.filter((rt) => rt.userId === 'usr-staff-1' && !rt.isRevoked);
    assert.equal(activeTokens.length, 0);
    assert.ok(auditLogs.some((a) => a.action === 'USER_STATUS_UPDATED'));
  });

  // 5. UsersService.resetPassword
  await t.test('UsersService.resetPassword updates hash and invalidates active sessions', async () => {
    refreshTokensDb.push({ id: 'rt-new', userId: 'usr-staff-1', isRevoked: false });
    const res = await usersService.resetPassword('comp-1', 'usr-staff-1', {}, 'usr-admin-1');
    assert.ok(res.temporaryPassword);

    const activeTokens = refreshTokensDb.filter((rt) => rt.userId === 'usr-staff-1' && !rt.isRevoked);
    assert.equal(activeTokens.length, 0);
    assert.ok(auditLogs.some((a) => a.action === 'USER_PASSWORD_RESET'));
  });

  await t.test('UsersService.resetPassword throws ForbiddenException if user belongs to multiple companies', async () => {
    companyUsersDb.push({
      id: 'cu-extra',
      companyId: 'comp-2',
      userId: 'usr-staff-1',
      roleId: 'role-staff',
      status: CompanyUserStatus.ACTIVE,
    });

    await assert.rejects(
      async () => {
        await usersService.resetPassword('comp-1', 'usr-staff-1', {}, 'usr-admin-1');
      },
      ForbiddenException,
    );

    // Clean up
    companyUsersDb = companyUsersDb.filter((cu) => cu.id !== 'cu-extra');
  });

  // 6. RolesService.findAllRoles & findAllPermissions
  await t.test('RolesService.findAllRoles retrieves company and system roles', async () => {
    const roles = await rolesService.findAllRoles('comp-1');
    assert.ok(roles.length >= 3);
  });

  await t.test('RolesService.findAllPermissions retrieves master permissions catalog', async () => {
    const perms = await rolesService.findAllPermissions();
    assert.equal(perms.length, permissionsDb.length);
  });

  // 7. RolesService.createRole
  await t.test('RolesService.createRole rejects reserved names (admin, administrator, owner)', async () => {
    for (const reserved of ['admin', 'Administrator', 'OWNER']) {
      await assert.rejects(
        async () => {
          await rolesService.createRole(
            'comp-1',
            { name: reserved, permissionIds: ['p-invoice-view'] },
            'usr-admin-1',
          );
        },
        BadRequestException,
      );
    }
  });

  await t.test('RolesService.createRole creates custom role scoped to company', async () => {
    const role = await rolesService.createRole(
      'comp-1',
      {
        name: 'Logistics Supervisor',
        description: 'Supervises depot dispatches',
        permissionIds: ['p-invoice-view'],
      },
      'usr-admin-1',
    );

    assert.equal(role.name, 'Logistics Supervisor');
    assert.equal(role.companyId, 'comp-1');
    assert.equal(role.rolePermissions.length, 1);
    assert.ok(auditLogs.some((a) => a.action === 'ROLE_CREATED'));
  });

  await t.test('RolesService.createRole rejects duplicate role name in company', async () => {
    await assert.rejects(
      async () => {
        await rolesService.createRole(
          'comp-1',
          {
            name: 'Logistics Supervisor',
            permissionIds: ['p-invoice-view'],
          },
          'usr-admin-1',
        );
      },
      ConflictException,
    );
  });

  await t.test('RolesService.createRole prevents privilege escalation by non-admin caller', async () => {
    // usr-staff-1 only has role-staff which does not have p-roles-manage
    await assert.rejects(
      async () => {
        await rolesService.createRole(
          'comp-1',
          {
            name: 'Attempted Escalation Role',
            permissionIds: ['p-roles-manage'],
          },
          'usr-staff-1',
        );
      },
      ForbiddenException,
    );
  });

  // 8. RolesService.updateRolePermissions
  await t.test('RolesService.updateRolePermissions rejects editing global system roles (companyId: null)', async () => {
    await assert.rejects(
      async () => {
        // Attempt to edit global system role role-admin
        await rolesService.updateRolePermissions(
          'comp-1',
          'role-admin',
          { permissionIds: ['p-invoice-view'] },
          'usr-admin-1',
        );
      },
      NotFoundException,
    );
  });

  await t.test('RolesService.updateRolePermissions allows updating custom role permissions', async () => {
    const customRole = rolesDb.find((r) => r.name === 'Logistics Supervisor');
    const updated = await rolesService.updateRolePermissions(
      'comp-1',
      customRole.id,
      { permissionIds: ['p-invoice-view', 'p-company-view'] },
      'usr-admin-1',
    );

    assert.ok(updated);
    assert.equal(updated.rolePermissions.length, 2);
    assert.ok(auditLogs.some((a) => a.action === 'ROLE_PERMISSIONS_UPDATED'));
  });
});
