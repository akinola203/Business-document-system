import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupplyItemDto } from './dto/create-supply-item.dto';
import { UpdateSupplyItemDto } from './dto/update-supply-item.dto';
import { QuerySupplyItemsDto } from './dto/query-supply-items.dto';
import { CreateSupplyOrderDto } from './dto/create-supply-order.dto';
import { UpdateSupplyOrderStatusDto } from './dto/update-supply-order-status.dto';
import { QuerySupplyOrdersDto } from './dto/query-supply-orders.dto';
import { Prisma, SupplyOrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ===========================================================================
  // 1. SUPPLIES & ITEMS CATALOG
  // ===========================================================================

  async findAllItems(companyId: string, query: QuerySupplyItemsDto) {
    const { page = 1, limit = 50, search, category, preferredVendorId, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplyItemWhereInput = {
      companyId,
      ...(category ? { category } : {}),
      ...(preferredVendorId ? { preferredVendorId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rawItems, total] = await Promise.all([
      this.prisma.supplyItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          preferredVendor: {
            select: { id: true, name: true, vendorCode: true },
          },
        },
      }),
      this.prisma.supplyItem.count({ where }),
    ]);

    // Apply lowStockOnly in-memory or where clause
    const items = lowStockOnly
      ? rawItems.filter((i) => new Decimal(i.currentStock.toString()).lessThanOrEqualTo(new Decimal(i.reorderLevel.toString())))
      : rawItems;

    return {
      items,
      meta: {
        total: lowStockOnly ? items.length : total,
        page,
        limit,
        totalPages: Math.ceil((lowStockOnly ? items.length : total) / limit),
      },
    };
  }

  async createItem(companyId: string, dto: CreateSupplyItemDto, actorId: string) {
    const sku = dto.sku.trim().toUpperCase();

    const existing = await this.prisma.supplyItem.findFirst({
      where: { companyId, sku },
    });
    if (existing) {
      throw new ConflictException(`Supply item with SKU "${sku}" already exists.`);
    }

    if (dto.preferredVendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.preferredVendorId, companyId },
      });
      if (!vendor) {
        throw new NotFoundException(`Preferred vendor "${dto.preferredVendorId}" not found.`);
      }
    }

    const item = await this.prisma.supplyItem.create({
      data: {
        companyId,
        sku,
        name: dto.name.trim(),
        category: dto.category.trim(),
        description: dto.description?.trim(),
        unit: dto.unit.trim(),
        unitCost: dto.unitCost,
        sellingPrice: dto.sellingPrice,
        taxRate: dto.taxRate ?? 7.5,
        currentStock: dto.currentStock ?? 0,
        reorderLevel: dto.reorderLevel ?? 0,
        preferredVendorId: dto.preferredVendorId || null,
        isActive: dto.isActive ?? true,
      },
      include: {
        preferredVendor: true,
      },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'SUPPLY_ITEM_CREATED',
      entityType: 'SupplyItem',
      entityId: item.id,
      oldValues: null,
      newValues: { sku: item.sku, name: item.name, sellingPrice: item.sellingPrice },
    });

    this.logger.log(`Supply Item "${item.name}" (${item.sku}) created by user "${actorId}".`);
    return item;
  }

  async updateItem(companyId: string, id: string, dto: UpdateSupplyItemDto, actorId: string) {
    const existing = await this.prisma.supplyItem.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException(`Supply item with ID "${id}" not found.`);
    }

    if (dto.sku && dto.sku.trim().toUpperCase() !== existing.sku) {
      const skuCheck = await this.prisma.supplyItem.findFirst({
        where: { companyId, sku: dto.sku.trim().toUpperCase() },
      });
      if (skuCheck) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use.`);
      }
    }

    const updated = await this.prisma.supplyItem.update({
      where: { id },
      data: {
        ...(dto.sku ? { sku: dto.sku.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.category ? { category: dto.category.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.unit ? { unit: dto.unit.trim() } : {}),
        ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost } : {}),
        ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice } : {}),
        ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
        ...(dto.currentStock !== undefined ? { currentStock: dto.currentStock } : {}),
        ...(dto.reorderLevel !== undefined ? { reorderLevel: dto.reorderLevel } : {}),
        ...(dto.preferredVendorId !== undefined ? { preferredVendorId: dto.preferredVendorId || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        preferredVendor: true,
      },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'SUPPLY_ITEM_UPDATED',
      entityType: 'SupplyItem',
      entityId: id,
      oldValues: { currentStock: existing.currentStock, sellingPrice: existing.sellingPrice },
      newValues: { currentStock: updated.currentStock, sellingPrice: updated.sellingPrice },
    });

    return updated;
  }

  // ===========================================================================
  // 2. VENDOR SUPPLY ORDERS (PURCHASE RECEIPTS)
  // ===========================================================================

  private async generateNextSupplyNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.supplyOrder.count({ where: { companyId } });
    return `SUP-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAllOrders(companyId: string, query: QuerySupplyOrdersDto) {
    const { page = 1, limit = 20, search, vendorId, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplyOrderWhereInput = {
      companyId,
      ...(vendorId ? { vendorId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            supplyDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { supplyNumber: { contains: search, mode: 'insensitive' } },
              { deliveryRef: { contains: search, mode: 'insensitive' } },
              { vendor: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplyOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { supplyDate: 'desc' },
        include: {
          vendor: {
            select: { id: true, name: true, vendorCode: true, category: true },
          },
          items: {
            include: {
              supplyItem: true,
            },
          },
        },
      }),
      this.prisma.supplyOrder.count({ where }),
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

  async findOneOrder(companyId: string, id: string) {
    const order = await this.prisma.supplyOrder.findFirst({
      where: { id, companyId },
      include: {
        vendor: true,
        items: {
          include: {
            supplyItem: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Supply order with ID "${id}" not found.`);
    }

    return order;
  }

  async createOrder(companyId: string, dto: CreateSupplyOrderDto, actorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, companyId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${dto.vendorId}" not found.`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one supply order line item is required.');
    }

    const supplyNumber = dto.supplyNumber?.trim() || (await this.generateNextSupplyNumber(companyId));

    // Calculate authoritative totals
    let subtotalDec = new Decimal(0);
    const lineItemsData = dto.items.map((item) => {
      const qty = new Decimal(item.quantity);
      const cost = new Decimal(item.unitCost);
      const lineTotal = qty.times(cost);
      subtotalDec = subtotalDec.plus(lineTotal);

      return {
        supplyItemId: item.supplyItemId || null,
        description: item.description.trim(),
        unit: item.unit.trim(),
        quantity: qty.toNumber(),
        unitCost: cost.toNumber(),
        lineTotal: lineTotal.toNumber(),
      };
    });

    const taxTotalDec = subtotalDec.times(0.075); // 7.5% standard VAT
    const grandTotalDec = subtotalDec.plus(taxTotalDec);
    const amountPaidDec = new Decimal(dto.amountPaid || 0);

    const isReceived = dto.status === SupplyOrderStatus.RECEIVED;

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.supplyOrder.create({
        data: {
          companyId,
          vendorId: dto.vendorId,
          supplyNumber,
          supplyDate: dto.supplyDate ? new Date(dto.supplyDate) : new Date(),
          deliveryRef: dto.deliveryRef?.trim(),
          status: dto.status || SupplyOrderStatus.ORDERED,
          currency: dto.currency || 'NGN',
          subtotal: subtotalDec.toNumber(),
          taxTotal: taxTotalDec.toNumber(),
          grandTotal: grandTotalDec.toNumber(),
          amountPaid: amountPaidDec.toNumber(),
          notes: dto.notes?.trim(),
          receivedAt: isReceived ? new Date() : null,
          receivedById: isReceived ? actorId : null,
          items: {
            create: lineItemsData,
          },
        },
        include: {
          vendor: true,
          items: {
            include: {
              supplyItem: true,
            },
          },
        },
      });

      // If already marked RECEIVED upon entry, automatically increment currentStock & vendor totals
      if (isReceived) {
        for (const line of lineItemsData) {
          if (line.supplyItemId) {
            await tx.supplyItem.update({
              where: { id: line.supplyItemId },
              data: {
                currentStock: { increment: line.quantity },
              },
            });
          }
        }

        const netPayable = grandTotalDec.minus(amountPaidDec);
        await tx.vendor.update({
          where: { id: dto.vendorId },
          data: {
            totalSuppliedAmount: { increment: grandTotalDec.toNumber() },
            outstandingPayable: { increment: netPayable.toNumber() },
          },
        });
      }

      return createdOrder;
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'SUPPLY_ORDER_CREATED',
      entityType: 'SupplyOrder',
      entityId: order.id,
      oldValues: null,
      newValues: { supplyNumber: order.supplyNumber, grandTotal: order.grandTotal, status: order.status },
    });

    this.logger.log(`Supply Order "${order.supplyNumber}" created by user "${actorId}".`);
    return order;
  }

  async updateOrderStatus(
    companyId: string,
    id: string,
    dto: UpdateSupplyOrderStatusDto,
    actorId: string,
  ) {
    const order = await this.findOneOrder(companyId, id);

    if (order.status === dto.status) {
      return order;
    }

    const previousStatus = order.status;
    const targetStatus = dto.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.supplyOrder.update({
        where: { id },
        data: {
          status: targetStatus,
          notes: dto.notes ? `${order.notes || ''}\n[Status update]: ${dto.notes}`.trim() : order.notes,
          receivedAt: targetStatus === SupplyOrderStatus.RECEIVED ? new Date() : order.receivedAt,
          receivedById: targetStatus === SupplyOrderStatus.RECEIVED ? actorId : order.receivedById,
        },
        include: {
          vendor: true,
          items: {
            include: {
              supplyItem: true,
            },
          },
        },
      });

      // Stock adjustment logic
      if (targetStatus === SupplyOrderStatus.RECEIVED && previousStatus !== SupplyOrderStatus.RECEIVED) {
        // Increment stock
        for (const item of order.items) {
          if (item.supplyItemId) {
            await tx.supplyItem.update({
              where: { id: item.supplyItemId },
              data: {
                currentStock: { increment: item.quantity },
              },
            });
          }
        }

        const grandTotalDec = new Decimal(order.grandTotal.toString());
        const amountPaidDec = new Decimal(order.amountPaid.toString());
        const netPayable = grandTotalDec.minus(amountPaidDec);

        await tx.vendor.update({
          where: { id: order.vendorId },
          data: {
            totalSuppliedAmount: { increment: grandTotalDec.toNumber() },
            outstandingPayable: { increment: netPayable.toNumber() },
          },
        });
      } else if (
        targetStatus === SupplyOrderStatus.CANCELLED &&
        previousStatus === SupplyOrderStatus.RECEIVED
      ) {
        // Revert stock increment if previously received order is cancelled
        for (const item of order.items) {
          if (item.supplyItemId) {
            await tx.supplyItem.update({
              where: { id: item.supplyItemId },
              data: {
                currentStock: { decrement: item.quantity },
              },
            });
          }
        }

        const grandTotalDec = new Decimal(order.grandTotal.toString());
        const amountPaidDec = new Decimal(order.amountPaid.toString());
        const netPayable = grandTotalDec.minus(amountPaidDec);

        await tx.vendor.update({
          where: { id: order.vendorId },
          data: {
            totalSuppliedAmount: { decrement: grandTotalDec.toNumber() },
            outstandingPayable: { decrement: netPayable.toNumber() },
          },
        });
      }

      return updatedOrder;
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'SUPPLY_ORDER_STATUS_CHANGED',
      entityType: 'SupplyOrder',
      entityId: id,
      oldValues: { status: previousStatus },
      newValues: { status: targetStatus },
    });

    this.logger.log(`Supply Order "${order.supplyNumber}" transitioned from ${previousStatus} to ${targetStatus} by "${actorId}".`);
    return updated;
  }
}
