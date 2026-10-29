import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { DocumentsService } from '../documents/documents.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWaybillDto } from './dto/create-waybill.dto';
import { UpdateWaybillDto } from './dto/update-waybill.dto';
import { DispatchWaybillDto, dispatchWaybillSchema } from './dto/dispatch-waybill.dto';
import { StageWaybillReadyDto, stageWaybillReadySchema } from './dto/stage-waybill-ready.dto';
import { FailWaybillDto, failWaybillSchema } from './dto/fail-waybill.dto';
import { CompleteWaybillDto } from './dto/complete-waybill.dto';
import {
  DocumentStatus,
  DocumentType,
  WaybillDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { validateTenantScope } from '../../common/utils/tenant-validation.util';

@Injectable()
export class WaybillsService {
  private readonly logger = new Logger(WaybillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly documentsService: DocumentsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
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

    await validateTenantScope(this.prisma, companyId, {
      clientId: targetClientId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      templateId: dto.templateId,
    });

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
          clientId: targetClientId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          documentType: DocumentType.WAYBILL,
          documentNumber,
          title: dto.title.trim(),
          status: DocumentStatus.DRAFT,
          issueDate: dto.shipmentDate ? new Date(dto.shipmentDate) : new Date(),
          createdById: actorId,
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
        },
      });

      const waybill = await tx.waybill.create({
        data: {
          documentId: document.id,
          invoiceId: linkedInvoiceId,
          shipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : new Date(),
          consignorSnapshot,
          consigneeSnapshot,
          originAddress: dto.originAddress.trim(),
          destinationAddress: dto.destinationAddress.trim(),
          vehicleNumber: dto.vehicleNumber?.trim(),
          driverName: dto.driverName?.trim(),
          driverPhone: dto.driverPhone?.trim(),
          trackingNumber: dto.trackingNumber?.trim(),
          deliveryStatus: WaybillDeliveryStatus.PREPARING,
          items: {
            create: dto.items.map((it, idx) => ({
              lineNumber: idx + 1,
              description: it.description.trim(),
              quantity: new Prisma.Decimal(it.quantity),
              unit: it.unit.trim(),
              weightKg: it.weightKg !== undefined ? new Prisma.Decimal(it.weightKg) : null,
              packageCount: it.packageCount,
              packageType: it.packageType?.trim(),
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
            itemCount: dto.items.length,
            deliveryStatus: WaybillDeliveryStatus.PREPARING,
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
    const document = await this.findOne(companyId, id);

    if (
      document.status !== DocumentStatus.DRAFT &&
      document.status !== DocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED waybills can be modified. Current status is ${document.status}.`,
      );
    }

    // Validate foreign keys belong to caller company if updated
    await validateTenantScope(this.prisma, companyId, {
      clientId: dto.clientId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
    });

    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Waybill was modified concurrently. Expected version ${dto.expectedVersion}, but current version is ${document.versionCounter}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.document.updateMany({
        where: {
          id: document.id,
          companyId,
          status: { in: [DocumentStatus.DRAFT, DocumentStatus.REJECTED] },
          ...(dto.expectedVersion !== undefined ? { versionCounter: dto.expectedVersion } : {}),
        },
        data: {
          versionCounter: { increment: 1 },
          status: DocumentStatus.DRAFT,
        },
      });

      if (claimResult.count !== 1) {
        throw new ConflictException(
          'Waybill was concurrently modified or is not in an editable status (DRAFT or REJECTED).',
        );
      }

      await tx.document.update({
        where: { id: document.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          clientId: dto.clientId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
        },
      });

      if (dto.items && dto.items.length > 0) {
        await tx.waybillItem.deleteMany({
          where: { waybillId: document.waybill!.id },
        });

        await tx.waybillItem.createMany({
          data: dto.items.map((it, idx) => ({
            waybillId: document.waybill!.id,
            lineNumber: idx + 1,
            description: it.description.trim(),
            quantity: new Prisma.Decimal(it.quantity),
            unit: it.unit.trim(),
            weightKg: it.weightKg !== undefined ? new Prisma.Decimal(it.weightKg) : null,
            packageCount: it.packageCount,
            packageType: it.packageType?.trim(),
          })),
        });
      }

      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          originAddress: dto.originAddress !== undefined ? dto.originAddress.trim() : undefined,
          destinationAddress:
            dto.destinationAddress !== undefined ? dto.destinationAddress.trim() : undefined,
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
   * Stages consignment as READY for haulage / carrier pickup.
   * Allowed from PREPARING (initial staging) or FAILED (re-staging after returned attempt).
   * Requires parent Document to be APPROVED or ISSUED.
   */
  async stageReady(companyId: string, id: string, dto: StageWaybillReadyDto, actorId: string) {
    stageWaybillReadySchema.parse(dto);
    const document = await this.findOne(companyId, id);

    if (
      document.status !== DocumentStatus.APPROVED &&
      document.status !== DocumentStatus.ISSUED
    ) {
      throw new BadRequestException(
        `Waybill cargo can only be staged READY when the parent document is APPROVED or ISSUED. Current status is ${document.status}.`,
      );
    }

    const currentDelivery = document.waybill?.deliveryStatus;
    if (
      currentDelivery !== WaybillDeliveryStatus.PREPARING &&
      currentDelivery !== WaybillDeliveryStatus.FAILED
    ) {
      throw new BadRequestException(
        `Only PREPARING or FAILED waybills can be staged to READY. Current delivery status is ${currentDelivery}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          deliveryStatus: WaybillDeliveryStatus.READY,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'WAYBILL_STAGED_READY',
          entityType: 'Document',
          entityId: document.id,
          oldValues: { deliveryStatus: currentDelivery },
          newValues: { deliveryStatus: WaybillDeliveryStatus.READY, ...dto },
        },
        tx,
      );

      return document;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Waybill Ready for Dispatch: ${document.documentNumber}`,
      `Waybill "${document.documentNumber}" cargo has been staged and is READY for carrier pickup.`,
      'WAYBILL_READY',
      { documentId: document.id, documentNumber: document.documentNumber },
    );

    this.logger.log(`Waybill "${document.documentNumber}" staged READY by user "${actorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Dispatches the consignment, transitioning deliveryStatus to IN_TRANSIT.
   * Can transition from either PREPARING or READY -> IN_TRANSIT.
   * If parent document is APPROVED, automatically invokes issuance logic to become ISSUED.
   */
  async dispatch(companyId: string, id: string, dto: DispatchWaybillDto, actorId: string) {
    dispatchWaybillSchema.parse(dto);
    const document = await this.findOne(companyId, id);

    if (
      document.status === DocumentStatus.CANCELLED ||
      document.status === DocumentStatus.COMPLETED
    ) {
      throw new BadRequestException(`Cannot dispatch a document in status ${document.status}.`);
    }

    const currentDelivery = document.waybill?.deliveryStatus;
    if (
      currentDelivery !== WaybillDeliveryStatus.PREPARING &&
      currentDelivery !== WaybillDeliveryStatus.READY
    ) {
      throw new BadRequestException(
        `Only PREPARING or READY waybills can be dispatched. Current delivery status is ${currentDelivery}.`,
      );
    }

    // If parent document is APPROVED, invoke unified issuance to lock version and set ISSUED
    if (document.status === DocumentStatus.APPROVED) {
      return this.documentsService.issue(
        companyId,
        id,
        {
          vehicleNumber: dto.vehicleNumber,
          driverName: dto.driverName,
          driverPhone: dto.driverPhone,
          trackingNumber: dto.trackingNumber,
          notes: 'Dispatched for transit',
        },
        actorId,
      );
    }

    // If document is already ISSUED (e.g. re-dispatching after a previous failure), update delivery status in tx
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT,
          vehicleNumber: dto.vehicleNumber.trim(),
          driverName: dto.driverName.trim(),
          driverPhone: dto.driverPhone.trim(),
          trackingNumber: dto.trackingNumber?.trim(),
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'WAYBILL_DISPATCHED',
          entityType: 'Document',
          entityId: document.id,
          oldValues: { deliveryStatus: currentDelivery },
          newValues: { deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT, ...dto },
        },
        tx,
      );

      return document;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Waybill Dispatched: ${document.documentNumber}`,
      `Consignment "${document.documentNumber}" is now IN_TRANSIT with driver ${dto.driverName} (${dto.vehicleNumber}).`,
      'WAYBILL_DISPATCHED',
      { documentId: document.id, documentNumber: document.documentNumber },
    );

    this.logger.log(`Waybill "${document.documentNumber}" dispatched by user "${actorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Records a failed delivery attempt, transitioning deliveryStatus from IN_TRANSIT to FAILED.
   * Parent Document remains ISSUED so it can be re-staged or cancelled.
   */
  async fail(companyId: string, id: string, dto: FailWaybillDto, actorId: string) {
    failWaybillSchema.parse(dto);
    const document = await this.findOne(companyId, id);

    if (document.waybill?.deliveryStatus !== WaybillDeliveryStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Only IN_TRANSIT waybills can be marked as FAILED. Current delivery status is ${document.waybill?.deliveryStatus}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.waybill.update({
        where: { id: document.waybill!.id },
        data: {
          deliveryStatus: WaybillDeliveryStatus.FAILED,
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'WAYBILL_DELIVERY_FAILED',
          entityType: 'Document',
          entityId: document.id,
          oldValues: { deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT },
          newValues: {
            deliveryStatus: WaybillDeliveryStatus.FAILED,
            failureReason: dto.failureReason.trim(),
            notes: dto.notes?.trim(),
          },
        },
        tx,
      );

      return document;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Waybill Delivery Failed: ${document.documentNumber}`,
      `Delivery attempt for "${document.documentNumber}" failed. Reason: ${dto.failureReason.trim()}`,
      'WAYBILL_FAILED',
      { documentId: document.id, documentNumber: document.documentNumber, failureReason: dto.failureReason },
    );

    this.logger.warn(
      `Waybill "${document.documentNumber}" marked FAILED by user "${actorId}". Reason: ${dto.failureReason}`,
    );
    return this.findOne(companyId, updated.id);
  }

  /**
   * Confirms delivery and marks the consignment DELIVERED / COMPLETED.
   */
  async complete(companyId: string, id: string, dto: CompleteWaybillDto, actorId: string) {
    const document = await this.findOne(companyId, id);

    if (document.waybill?.deliveryStatus !== WaybillDeliveryStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Only IN_TRANSIT waybills can be confirmed as DELIVERED. Current delivery status is ${document.waybill?.deliveryStatus}.`,
      );
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

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'WAYBILL_DELIVERED',
          entityType: 'Document',
          entityId: document.id,
          oldValues: { deliveryStatus: WaybillDeliveryStatus.IN_TRANSIT },
          newValues: {
            deliveryStatus: WaybillDeliveryStatus.DELIVERED,
            receivedByName: dto.receivedByName,
          },
        },
        tx,
      );

      return doc;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Waybill Delivered: ${document.documentNumber}`,
      `Consignment "${document.documentNumber}" was confirmed DELIVERED to ${dto.receivedByName}.`,
      'WAYBILL_DELIVERED',
      { documentId: document.id, documentNumber: document.documentNumber, receivedByName: dto.receivedByName },
    );

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
