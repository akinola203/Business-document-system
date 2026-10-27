import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates next sequential vendor code (e.g. VND-0001) for tenant
   */
  private async generateNextVendorCode(companyId: string): Promise<string> {
    const count = await this.prisma.vendor.count({ where: { companyId } });
    return `VND-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(companyId: string, query: QueryVendorsDto) {
    const { page = 1, limit = 20, search, category, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = {
      companyId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { vendorCode: { contains: search, mode: 'insensitive' } },
              { contactPerson: { contains: search, mode: 'insensitive' } },
              { taxId: { contains: search, mode: 'insensitive' } },
              { registrationNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              supplyItems: true,
              supplyOrders: true,
            },
          },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(companyId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, companyId },
      include: {
        supplyItems: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        supplyOrders: {
          orderBy: { supplyDate: 'desc' },
          take: 20,
          include: {
            items: {
              include: {
                supplyItem: true,
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found.`);
    }

    return vendor;
  }

  async create(companyId: string, dto: CreateVendorDto, actorId: string) {
    const vendorCode = dto.vendorCode?.trim() || (await this.generateNextVendorCode(companyId));

    // Check unique vendorCode
    const existing = await this.prisma.vendor.findFirst({
      where: { companyId, vendorCode },
    });
    if (existing) {
      throw new ConflictException(`Vendor code "${vendorCode}" is already in use.`);
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        companyId,
        vendorCode,
        name: dto.name.trim(),
        category: dto.category,
        contactPerson: dto.contactPerson?.trim(),
        email: dto.email?.trim(),
        phone: dto.phone?.trim(),
        taxId: dto.taxId?.trim(),
        registrationNumber: dto.registrationNumber?.trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        state: dto.state?.trim(),
        country: dto.country?.trim() || 'Nigeria',
        bankName: dto.bankName?.trim(),
        bankAccountName: dto.bankAccountName?.trim(),
        bankAccountNumber: dto.bankAccountNumber?.trim(),
        paymentTerms: dto.paymentTerms?.trim() || 'Net 30 Days',
        currency: dto.currency?.trim() || 'NGN',
        notes: dto.notes?.trim(),
      },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'VENDOR_CREATED',
      entityType: 'Vendor',
      entityId: vendor.id,
      oldValues: null,
      newValues: { vendorCode: vendor.vendorCode, name: vendor.name },
    });

    this.logger.log(`Vendor "${vendor.name}" (${vendor.vendorCode}) created by user "${actorId}".`);
    return vendor;
  }

  async update(companyId: string, id: string, dto: UpdateVendorDto, actorId: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Vendor with ID "${id}" not found.`);
    }

    if (dto.vendorCode && dto.vendorCode !== existing.vendorCode) {
      const codeCheck = await this.prisma.vendor.findFirst({
        where: { companyId, vendorCode: dto.vendorCode },
      });
      if (codeCheck) {
        throw new ConflictException(`Vendor code "${dto.vendorCode}" is already in use.`);
      }
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.vendorCode ? { vendorCode: dto.vendorCode.trim() } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId?.trim() || null } : {}),
        ...(dto.registrationNumber !== undefined ? { registrationNumber: dto.registrationNumber?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.state !== undefined ? { state: dto.state?.trim() || null } : {}),
        ...(dto.country !== undefined ? { country: dto.country?.trim() || 'Nigeria' } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName?.trim() || null } : {}),
        ...(dto.bankAccountName !== undefined ? { bankAccountName: dto.bankAccountName?.trim() || null } : {}),
        ...(dto.bankAccountNumber !== undefined ? { bankAccountNumber: dto.bankAccountNumber?.trim() || null } : {}),
        ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'VENDOR_UPDATED',
      entityType: 'Vendor',
      entityId: id,
      oldValues: { name: existing.name, status: existing.status },
      newValues: { name: updated.name, status: updated.status },
    });

    this.logger.log(`Vendor "${updated.name}" (${updated.vendorCode}) updated by user "${actorId}".`);
    return updated;
  }
}
