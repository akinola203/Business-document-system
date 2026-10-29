import { NotFoundException } from '@nestjs/common';

export interface TenantScopeCheckParams {
  clientId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  templateId?: string | null;
}

export interface ValidatedTenantRecords {
  client?: { id: string; name: string } | null;
  branch?: { id: string } | null;
  department?: { id: string } | null;
  template?: { id: string } | null;
}

/**
 * Validates cross-tenant foreign keys ensuring that clientId, branchId,
 * departmentId, and templateId belong strictly to the caller's companyId.
 */
export async function validateTenantScope(
  prisma: {
    client: { findFirst: (args: any) => Promise<any> };
    branch: { findFirst: (args: any) => Promise<any> };
    department: { findFirst: (args: any) => Promise<any> };
    template: { findFirst: (args: any) => Promise<any> };
  },
  companyId: string,
  params: TenantScopeCheckParams,
): Promise<ValidatedTenantRecords> {
  const records: ValidatedTenantRecords = {};

  if (params.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: params.clientId, companyId },
      select: { id: true, name: true },
    });
    if (!client) {
      throw new NotFoundException(
        `Client with ID "${params.clientId}" not found in this company.`,
      );
    }
    records.client = client;
  }

  if (params.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: params.branchId, companyId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${params.branchId}" not found in this company.`,
      );
    }
    records.branch = branch;
  }

  if (params.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: params.departmentId, companyId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with ID "${params.departmentId}" not found in this company.`,
      );
    }
    records.department = department;
  }

  if (params.templateId) {
    const template = await prisma.template.findFirst({
      where: { id: params.templateId, companyId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(
        `Template with ID "${params.templateId}" not found in this company.`,
      );
    }
    records.template = template;
  }

  return records;
}
