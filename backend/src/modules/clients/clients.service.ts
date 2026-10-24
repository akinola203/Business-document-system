import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ClientStatus, Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a deterministic, sequential client number (e.g. "CLI-00001") for a company.
   */
  async generateNextClientNumber(companyId: string): Promise<string> {
    const count = await this.prisma.client.count({
      where: { companyId },
    });

    let nextIndex = count + 1;
    let candidate = `CLI-${String(nextIndex).padStart(5, '0')}`;

    // Protect against gaps or collisions
    while (await this.prisma.client.findUnique({
      where: { companyId_clientNumber: { companyId, clientNumber: candidate } },
    })) {
      nextIndex += 1;
      candidate = `CLI-${String(nextIndex).padStart(5, '0')}`;
    }

    return candidate;
  }

  /**
   * Retrieves paginated clients with full-text search, status filtering, and sorting.
   */
  async findAll(companyId: string, query: QueryClientsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      type,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      companyId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { clientNumber: { contains: search, mode: 'insensitive' } },
              { tin: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const allowedSortFields = ['createdAt', 'name', 'balance', 'clientNumber'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: {
          addresses: {
            where: { isDefault: true },
          },
          _count: {
            select: {
              documents: true,
              addresses: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [safeSortField]: sortOrder },
      }),
      this.prisma.client.count({ where }),
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

  /**
   * Retrieves a client by ID with all registered addresses and document stats.
   */
  async findOne(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID "${id}" not found.`);
    }

    return client;
  }

  /**
   * Creates a new client profile with optional initial billing/shipping addresses.
   */
  async create(companyId: string, dto: CreateClientDto, actorId: string) {
    const clientNumber = dto.clientNumber?.trim() || (await this.generateNextClientNumber(companyId));

    // Verify uniqueness of clientNumber
    const existing = await this.prisma.client.findUnique({
      where: {
        companyId_clientNumber: {
          companyId,
          clientNumber,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Client with number "${clientNumber}" already exists in this company.`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          companyId,
          clientNumber,
          type: dto.type,
          name: dto.name.trim(),
          companyName: dto.companyName?.trim(),
          email: dto.email?.trim().toLowerCase(),
          phone: dto.phone?.trim(),
          tin: dto.tin?.trim(),
          notes: dto.notes?.trim(),
          creditLimit:
            dto.creditLimit !== undefined ? new Prisma.Decimal(dto.creditLimit) : null,
          addresses: dto.addresses && dto.addresses.length > 0
            ? {
                create: dto.addresses.map((addr) => ({
                  type: addr.type,
                  addressLine1: addr.addressLine1.trim(),
                  addressLine2: addr.addressLine2?.trim(),
                  city: addr.city.trim(),
                  state: addr.state.trim(),
                  country: addr.country?.trim() || 'Nigeria',
                  postalCode: addr.postalCode?.trim(),
                  isDefault: addr.isDefault ?? false,
                })),
              }
            : undefined,
        },
        include: {
          addresses: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CLIENT_CREATED',
          entityType: 'Client',
          entityId: client.id,
          newValues: {
            clientNumber: client.clientNumber,
            name: client.name,
            companyName: client.companyName,
            email: client.email,
            type: client.type,
          },
        },
      });

      return client;
    });

    this.logger.log(`Client "${created.clientNumber}" created by user "${actorId}".`);
    return created;
  }

  /**
   * Updates an existing client profile.
   */
  async update(companyId: string, id: string, dto: UpdateClientDto, actorId: string) {
    const client = await this.findOne(companyId, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.client.update({
        where: { id: client.id },
        data: {
          type: dto.type,
          name: dto.name?.trim(),
          companyName: dto.companyName !== undefined ? dto.companyName?.trim() : undefined,
          email: dto.email !== undefined ? dto.email?.trim().toLowerCase() : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
          tin: dto.tin !== undefined ? dto.tin?.trim() : undefined,
          notes: dto.notes !== undefined ? dto.notes?.trim() : undefined,
          creditLimit:
            dto.creditLimit !== undefined
              ? new Prisma.Decimal(dto.creditLimit)
              : undefined,
        },
        include: {
          addresses: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CLIENT_UPDATED',
          entityType: 'Client',
          entityId: client.id,
          oldValues: {
            name: client.name,
            companyName: client.companyName,
            email: client.email,
            phone: client.phone,
            tin: client.tin,
            creditLimit: client.creditLimit ? client.creditLimit.toString() : null,
          },
          newValues: dto as any,
        },
      });

      return result;
    });

    return updated;
  }

  /**
   * Updates the lifecycle status of a client (ACTIVE / INACTIVE).
   */
  async updateStatus(
    companyId: string,
    id: string,
    status: ClientStatus,
    actorId: string,
  ) {
    const client = await this.findOne(companyId, id);

    const updated = await this.prisma.client.update({
      where: { id: client.id },
      data: { status },
      include: { addresses: true },
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action: status === ClientStatus.ACTIVE ? 'CLIENT_ACTIVATED' : 'CLIENT_DEACTIVATED',
        entityType: 'Client',
        entityId: client.id,
        oldValues: { status: client.status },
        newValues: { status },
      },
    });

    this.logger.log(`Client "${client.clientNumber}" status changed to ${status} by user "${actorId}".`);
    return updated;
  }

  /**
   * Adds an address to a client.
   */
  async addAddress(
    companyId: string,
    clientId: string,
    dto: CreateAddressDto,
    actorId: string,
  ) {
    const client = await this.findOne(companyId, clientId);

    const address = await this.prisma.$transaction(async (tx) => {
      // If marked default, unset existing defaults of this address type
      if (dto.isDefault) {
        await tx.clientAddress.updateMany({
          where: { clientId: client.id, type: dto.type },
          data: { isDefault: false },
        });
      }

      const created = await tx.clientAddress.create({
        data: {
          clientId: client.id,
          type: dto.type,
          addressLine1: dto.addressLine1.trim(),
          addressLine2: dto.addressLine2?.trim(),
          city: dto.city.trim(),
          state: dto.state.trim(),
          country: dto.country?.trim() || 'Nigeria',
          postalCode: dto.postalCode?.trim(),
          isDefault: dto.isDefault ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CLIENT_ADDRESS_ADDED',
          entityType: 'ClientAddress',
          entityId: created.id,
          newValues: dto as any,
        },
      });

      return created;
    });

    return address;
  }

  /**
   * Updates an existing address for a client.
   */
  async updateAddress(
    companyId: string,
    clientId: string,
    addressId: string,
    dto: UpdateAddressDto,
    actorId: string,
  ) {
    await this.findOne(companyId, clientId);

    const existingAddress = await this.prisma.clientAddress.findFirst({
      where: { id: addressId, clientId },
    });

    if (!existingAddress) {
      throw new NotFoundException(`Address with ID "${addressId}" not found for this client.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const targetType = dto.type || existingAddress.type;

      if (dto.isDefault) {
        await tx.clientAddress.updateMany({
          where: { clientId, type: targetType, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const res = await tx.clientAddress.update({
        where: { id: addressId },
        data: {
          type: dto.type,
          addressLine1: dto.addressLine1?.trim(),
          addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2?.trim() : undefined,
          city: dto.city?.trim(),
          state: dto.state?.trim(),
          country: dto.country?.trim(),
          postalCode: dto.postalCode !== undefined ? dto.postalCode?.trim() : undefined,
          isDefault: dto.isDefault,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CLIENT_ADDRESS_UPDATED',
          entityType: 'ClientAddress',
          entityId: addressId,
          newValues: dto as any,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * Removes an address from a client.
   */
  async deleteAddress(
    companyId: string,
    clientId: string,
    addressId: string,
    actorId: string,
  ) {
    await this.findOne(companyId, clientId);

    const existingAddress = await this.prisma.clientAddress.findFirst({
      where: { id: addressId, clientId },
    });

    if (!existingAddress) {
      throw new NotFoundException(`Address with ID "${addressId}" not found for this client.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clientAddress.delete({
        where: { id: addressId },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'CLIENT_ADDRESS_DELETED',
          entityType: 'ClientAddress',
          entityId: addressId,
        },
      });
    });

    return { message: 'Address successfully deleted.' };
  }
}
