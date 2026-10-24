import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, isActive?: boolean) {
    return this.prisma.department.findMany({
      where: {
        companyId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        _count: {
          select: {
            companyUsers: true,
            documents: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: {
            companyUsers: true,
            documents: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found.`);
    }

    return department;
  }

  async create(companyId: string, dto: CreateDepartmentDto, actorId: string) {
    const existing = await this.prisma.department.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Department with code "${dto.code.trim().toUpperCase()}" already exists in this company.`,
      );
    }

    const created = await this.prisma.department.create({
      data: {
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: created.id,
        newValues: dto as any,
      },
    });

    this.logger.log(`Department "${created.code}" created by user "${actorId}".`);
    return created;
  }

  async update(companyId: string, id: string, dto: UpdateDepartmentDto, actorId: string) {
    const department = await this.findOne(companyId, id);

    const updated = await this.prisma.department.update({
      where: { id: department.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() : undefined,
        isActive: dto.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: id,
        oldValues: {
          name: department.name,
          description: department.description,
          isActive: department.isActive,
        },
        newValues: dto as any,
      },
    });

    return updated;
  }

  async remove(companyId: string, id: string, actorId: string) {
    const department = await this.findOne(companyId, id);

    // Deactivate rather than delete to preserve historical document and user assignments
    const deactivated = await this.prisma.department.update({
      where: { id: department.id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'DEPARTMENT_DEACTIVATED',
        entityType: 'Department',
        entityId: id,
      },
    });

    this.logger.log(`Department "${department.code}" deactivated by user "${actorId}".`);
    return deactivated;
  }
}
