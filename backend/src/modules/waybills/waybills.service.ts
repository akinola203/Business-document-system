import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { CreateWaybillDto } from './dto/create-waybill.dto';
import { UpdateWaybillDto } from './dto/update-waybill.dto';
import { DispatchWaybillDto } from './dto/dispatch-waybill.dto';
import { CompleteWaybillDto } from './dto/complete-waybill.dto';
import {
  DocumentStatus,
  DocumentType,
  WaybillDeliveryStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class WaybillsService {
  private readonly logger = new Logger(WaybillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Creates a new waybill / delivery note in DRAFT status.
   * Can link to an invoice and snapshot customer/item records.
   */
  async createDraft(companyId: string, dto: CreateWaybillDto, actorId: string) {
    let targetClientId = dto.clientId;
    let linkedInvoiceId: string | null = null;

    // Load company for sender consignor snapshot
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    if (dto.invoiceId) {
      const invoiceDoc = await this.prisma.document.findFirst({
        where: { id: dto.invoiceId, companyId, documentType: DocumentType.INVOICE },
        include: { invoice: true },
      });
      if (!invoiceDoc || !invoiceDoc.invoice) {
        throw new NotFoundException(`Linked invoice with ID "${dto.invoiceId}" not found.`);
      }
      linkedInvoiceId = invoiceDoc.invoice.id;
      if (!targetClientId && invoiceDoc.clientId) {
        targetClientId = invoiceDoc.clientId;
      }
    }

    if (!targetClientId) {
      throw new BadRequestException('A recipient client must be specified for the waybill.');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: targetClientId, companyId },
      include: { addresses: true },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID "${targetClientId}" not found.`);
    }

    // Prepare immutable snapshots of sender and receiver
    const consignorSnapshot = {
      name: company.name,
      legalName: company.legalName,
      address: company.address,
      phone: company.phone,
      email: company.email,
    };

    const defaultAddress = client.addresses.find((a) => a.isDefault) || client.addresses[0];
    const consigneeSnapshot = {
      name: client.name,
      companyName: client.companyName,
      phone: client.phone,
      email: client.email,
      address: defaultAddress
        ? `${defaultAddress.addressLine1}, ${defaultAddress.city}, ${defaultAddress.state}`
        : dto.destinationAddress,
    };

    const created = await this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.numberingService.getNextDocumentNumber(
        tx,
        companyId,
        DocumentType.WAYBILL,
      );

      const document = await tx.document.create({
        data: {
          companyId,
          clientId: client.id,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          documentType: DocumentType.WAYBILL,
          documentNumber,
          title: dto.title.trim(),
          status: DocumentStatus.DRAFT,
          issueDate: dto.shipmentDate ? new Date(dto.shipmentDate) : new Date(),
          createdById: actorId,
        },
      });

      await tx.waybill.create({
        data: {
          documentId: document.id,
          invoiceId: linkedInvoiceId,
          shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : new Date(),
          consignorSnapshot: consignorSnapshot as Prisma.InputJsonValue,
          consigneeSnapshot: consigneeSnapshot as Prisma.InputJsonValue,
          originAddress: dto.originAddress.trim(),
          destinationAddress: dto.destinationAddress.trim(),
          vehicleNumber: dto.vehicleNumber?.trim(),
          driverName: dto.driverName?.trim(),
          driverPhone: dto.driverPhone?.trim(),
          trackingNumber: dto.trackingNumber?.trim(),
          deliveryStatus: WaybillDeliveryStatus.PREPARING,
          items: {
            create: dto.items.map((item, index) => ({
              lineNumber: index + 1,
              description: item.description.trim(),
              quantity: item.quantity.toString(),
              unit: item.unit.trim(),
              weightKg: item.weightKg !== undefined ? item.weightKg.toString() : null,
              packageCount: item.packageCount,
              packageType: item.packageType?.trim(),
            })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'WAYBILL_CREATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            documentNumber: document.documentNumber,
            clientName: client.name,
            origin: dto.originAddress,
            destination: dto.destinationAddress,
          },
        },
      });

      return document;
    });

    this.logger.log(`Draft waybill "${created.documentNumber}" created by user "${actorId}".`);
    return this.findOne(companyId, created.id);
  }

  /**
   * Updates an editable draft waybill.
   */
  async updateDraft(companyId: string, id: string, dto: UpdateWaybillDto, actorId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.WAYBILL },
      include: { waybill: { include: { items: true } } },
    });

    if (!document || !document.waybill) {
      throw new NotFoundException(`Waybill with ID "${id}" not found.`);
    }

    if (document.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT waybills can be modified. Current status is ${document.status}.`,
      );
    }

    // Optimistic Concurrency Control Check
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document has been modified by another user or session. Current version is ${document.versionCounter}. Please refresh and review latest changes before reapplying edits.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items && dto.items.length > 0) {
        await tx.waybillItem.deleteMany({
          where: { waybillId: document.waybill!.id },
        });

        await tx.waybillItem.createMany({
          data: dto.items.map((item, index) => ({
            waybillId: document.waybill!.id,
            lineNumber: index + 1,
            description: item.description.trim(),
            quantity: item.quantity.toString(),
            unit: item.unit.trim(),
            weightKg: item.weightKg !== undefined ? item.weightKg.toString() : null,
            packageCount: item.packageCount,
            packageType: item.packageType?.trim(),
          })),
        });
      }

      await tx.document.update({
        where: { id: document.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          issueDate: dto.shipmentDate ? new Date(dto.shipmentDate) : undefined,
          versionCounter: { increment: 1 },
        },
      });

      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : undefined,
          originAddress: dto.originAddress !== undefined ? dto.originAddress.trim() : undefined,
          destinationAddress: dto.destinationAddress !== undefined ? dto.destinationAddress.trim() : undefined,
          vehicleNumber: dto.vehicleNumber !== undefined ? dto.vehicleNumber?.trim() : undefined,
          driverName: dto.driverName !== undefined ? dto.driverName?.trim() : undefined,
          driverPhone: dto.driverPhone !== undefined ? dto.driverPhone?.trim() : undefined,
          trackingNumber: dto.trackingNumber !== undefined ? dto.trackingNumber?.trim() : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'WAYBILL_UPDATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: dto as any,
        },
      });

      return document;
    });

    return this.findOne(companyId, updated.id);
  }

  /**
   * Dispatches the consignment, transitioning status to IN_TRANSIT / ISSUED.
   */
  async dispatch(companyId: string, id: string, dto: DispatchWaybillDto, actorId: string) {
    const document = await this.findOne(companyId, id);

    if (document.status === DocumentStatus.CANCELLED || document.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException(`Cannot dispatch a document in status ${document.status}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Create frozen snapshot
      const snapshot = {
        documentNumber: document.documentNumber,
        consignor: document.waybill?.consignorSnapshot,
        consignee: document.waybill?.consigneeSnapshot,
        originAddress: document.waybill?.originAddress,
        destinationAddress: document.waybill?.destinationAddress,
        vehicleNumber: dto.vehicleNumber || document.waybill?.vehicleNumber,
        driverName: dto.driverName || document.waybill?.driverName,
        driverPhone: dto.driverPhone || document.waybill?.driverPhone,
        trackingNumber: dto.trackingNumber || document.waybill?.trackingNumber,
        items: document.waybill?.items,
        dispatchedAt: new Date().toISOString(),
      };

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          snapshotData: snapshot as unknown as Prisma.InputJsonValue,
          createdById: actorId,
          changeReason: 'Waybill Consignment Dispatched',
        },
      });

      const doc = await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ISSUED,
          currentVersionId: version.id,
        },
      });

      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT,
          vehicleNumber: dto.vehicleNumber !== undefined ? dto.vehicleNumber.trim() : undefined,
          driverName: dto.driverName !== undefined ? dto.driverName.trim() : undefined,
          driverPhone: dto.driverPhone !== undefined ? dto.driverPhone.trim() : undefined,
          trackingNumber: dto.trackingNumber !== undefined ? dto.trackingNumber.trim() : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'WAYBILL_DISPATCHED',
          entityType: 'Document',
          entityId: document.id,
          newValues: { deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT, ...dto },
        },
      });

      return doc;
    });

    this.logger.log(`Waybill "${document.documentNumber}" dispatched by user "${actorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Confirms delivery and marks the consignment DELIVERED / COMPLETED.
   */
  async complete(companyId: string, id: string, dto: CompleteWaybillDto, actorId: string) {
    const document = await this.findOne(companyId, id);

    if (document.waybill?.deliveryStatus === WaybillDeliveryStatus.DELIVERED) {
      throw new BadRequestException('Waybill delivery is already confirmed.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.COMPLETED },
      });

      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          deliveryStatus: WaybillDeliveryStatus.DELIVERED,
          receivedByName: dto.receivedByName.trim(),
          receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
          receiverSignatureFileId: dto.receiverSignatureFileId,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'WAYBILL_DELIVERED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            deliveryStatus: WaybillDeliveryStatus.DELIVERED,
            receivedByName: dto.receivedByName,
          },
        },
      });

      return doc;
    });

    this.logger.log(`Waybill "${document.documentNumber}" delivery confirmed by user "${actorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Helper to retrieve full waybill record with items and linked invoice.
   */
  async findOne(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.WAYBILL },
      include: {
        client: { include: { addresses: true } },
        branch: true,
        department: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        waybill: {
          include: {
            items: { orderBy: { lineNumber: 'asc' } },
            invoice: {
              include: {
                document: { select: { id: true, documentNumber: true, title: true } },
              },
            },
          },
        },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!document) {
      throw new NotFoundException(`Waybill with ID "${id}" not found.`);
    }

    return document;
  }
}
