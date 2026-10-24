import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, isActive?: boolean) {
    return this.prisma.branch.findMany({
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
    const branch = await this.prisma.branch.findFirst({
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

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${id}" not found.`);
    }

    return branch;
  }

  async create(companyId: string, dto: CreateBranchDto, actorId: string) {
    const existing = await this.prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Branch with code "${dto.code.trim().toUpperCase()}" already exists in this company.`,
      );
    }

    const created = await this.prisma.branch.create({
      data: {
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        address: dto.address?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'BRANCH_CREATED',
        entityType: 'Branch',
        entityId: created.id,
        newValues: dto as any,
      },
    });

    this.logger.log(`Branch "${created.code}" created by user "${actorId}".`);
    return created;
  }

  async update(companyId: string, id: string, dto: UpdateBranchDto, actorId: string) {
    const branch = await this.findOne(companyId, id);

    const updated = await this.prisma.branch.update({
      where: { id: branch.id },
      data: {
        name: dto.name?.trim(),
        address: dto.address !== undefined ? dto.address?.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
        email: dto.email !== undefined ? dto.email?.trim() : undefined,
        isActive: dto.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'BRANCH_UPDATED',
        entityType: 'Branch',
        entityId: id,
        oldValues: {
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          email: branch.email,
          isActive: branch.isActive,
        },
        newValues: dto as any,
      },
    });

    return updated;
  }

  async remove(companyId: string, id: string, actorId: string) {
    const branch = await this.findOne(companyId, id);

    // Soft-deactivate to protect relational references
    const deactivated = await this.prisma.branch.update({
      where: { id: branch.id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: 'BRANCH_DEACTIVATED',
        entityType: 'Branch',
        entityId: id,
      },
    });

    this.logger.log(`Branch "${branch.code}" deactivated by user "${actorId}".`);
    return deactivated;
  }
}
