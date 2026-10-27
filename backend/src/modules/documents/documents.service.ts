import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { CancelDocumentDto } from './dto/cancel-document.dto';
import { SubmitDocumentDto } from './dto/submit-document.dto';
import { ApproveDocumentDto } from './dto/approve-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { IssueDocumentDto } from './dto/issue-document.dto';
import {
  DocumentStatus,
  DocumentType,
  InvoicePaymentStatus,
  Prisma,
  WaybillDeliveryStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Retrieves paginated documents across all document types with search and filters.
   * @param allowedTypes When provided, restricts results to the document types the caller may view.
   */
  async findAll(companyId: string, query: QueryDocumentsDto, allowedTypes?: DocumentType[]) {
    const {
      page = 1,
      limit = 20,
      search,
      documentType,
      status,
      clientId,
      branchId,
      departmentId,
      startDate,
      endDate,
      isArchived = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      companyId,
      isArchived,
      ...(documentType
        ? { documentType }
        : allowedTypes
          ? { documentType: { in: allowedTypes } }
          : {}),
      ...(status ? { status } : {}),
      ...(clientId ? { clientId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(startDate || endDate
        ? {
            issueDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const allowedSortFields = ['createdAt', 'issueDate', 'documentNumber', 'totalAmount', 'title'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, companyName: true, clientNumber: true },
          },
          branch: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          invoice: { select: { id: true, paymentStatus: true, paymentTerms: true } },
          waybill: { select: { id: true, deliveryStatus: true, trackingNumber: true } },
          letter: { select: { id: true, subject: true, signatoryName: true } },
        },
        skip,
        take: limit,
        orderBy: { [safeSortField]: sortOrder },
      }),
      this.prisma.document.count({ where }),
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
   * Retrieves a document by ID with its complete specialized extension, items, approvals, and versions.
   */
  async findOne(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
      include: {
        client: {
          include: {
            addresses: true,
          },
        },
        company: {
          include: {
            settings: true,
          },
        },
        branch: true,
        department: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        template: true,
        templateVersion: true,
        invoice: {
          include: {
            items: { orderBy: { lineNumber: 'asc' } },
            payments: {
              where: { isReversed: false },
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
        waybill: {
          include: {
            items: { orderBy: { lineNumber: 'asc' } },
          },
        },
        letter: true,
        approvals: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { stepNumber: 'asc' },
        },
        versions: {
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    return document;
  }

  /**
   * Lightweight lookup used by the controller to authorize type-specific actions before executing them.
   */
  async getDocumentType(companyId: string, id: string): Promise<DocumentType> {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
      select: { documentType: true },
    });
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }
    return document.documentType;
  }

  /**
   * Cancels a document with mandatory justification. Document number is NEVER reused.
   * Invoices with active (non-reversed) payments cannot be cancelled; payments must be reversed first.
   */
  async cancel(
    companyId: string,
    id: string,
    dto: CancelDocumentDto,
    actorId: string,
  ) {
    const document = await this.findOne(companyId, id);

    if (document.status === DocumentStatus.CANCELLED) {
      throw new BadRequestException('Document is already cancelled.');
    }

    if (document.status === DocumentStatus.COMPLETED) {
      throw new BadRequestException('Completed documents cannot be cancelled directly.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (document.documentType === DocumentType.INVOICE && document.invoice) {
        // Serialize with PaymentsService (same lock) so a payment cannot land between check and cancel.
        await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${document.invoice.id} FOR UPDATE`;
        const activePayments = await tx.payment.count({
          where: { invoiceId: document.invoice.id, isReversed: false },
        });
        if (activePayments > 0) {
          throw new BadRequestException(
            `Invoice "${document.documentNumber}" has ${activePayments} active payment(s). Reverse them before cancelling the invoice.`,
          );
        }
      }

      const result = await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.CANCELLED,
          cancellationReason: dto.reason.trim(),
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: `${document.documentType}_CANCELLED`,
          entityType: 'Document',
          entityId: document.id,
          oldValues: { status: document.status },
          newValues: { status: DocumentStatus.CANCELLED, reason: dto.reason.trim() },
        },
        tx,
      );

      return result;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Document Cancelled: ${document.documentNumber}`,
      `Document "${document.documentNumber}" was cancelled. Reason: ${dto.reason.trim()}`,
      'DOCUMENT_CANCELLED',
      { documentId: document.id, documentNumber: document.documentNumber },
    );

    this.logger.log(`Document "${document.documentNumber}" cancelled by user "${actorId}".`);
    return updated;
  }

  /**
   * Duplicates an existing document into a new DRAFT with a newly allocated number.
   * Approvals, versions, and payment records are NOT copied.
   */
  async duplicate(companyId: string, id: string, actorId: string) {
    const source = await this.findOne(companyId, id);

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const nextNumber = await this.numberingService.getNextDocumentNumber(
        tx,
        companyId,
        source.documentType,
      );

      const newDoc = await tx.document.create({
        data: {
          companyId,
          branchId: source.branchId,
          departmentId: source.departmentId,
          clientId: source.clientId,
          documentType: source.documentType,
          documentNumber: nextNumber,
          title: `Copy of ${source.title}`,
          status: DocumentStatus.DRAFT,
          currency: source.currency,
          subtotal: source.subtotal,
          taxAmount: source.taxAmount,
          discountAmount: source.discountAmount,
          totalAmount: source.totalAmount,
          balanceDue: source.totalAmount, // Resets balance due
          createdById: actorId,
          templateId: source.templateId,
          templateVersionId: source.templateVersionId,
          metadata: {
            duplicatedFromId: source.id,
            duplicatedFromNumber: source.documentNumber,
          },
        },
      });

      // Duplicate specialized child entity
      if (source.documentType === DocumentType.INVOICE && source.invoice) {
        await tx.invoice.create({
          data: {
            documentId: newDoc.id,
            paymentTerms: source.invoice.paymentTerms,
            poNumber: source.invoice.poNumber,
            bankDetailsVisible: source.invoice.bankDetailsVisible,
            items: {
              create: source.invoice.items.map((item) => ({
                lineNumber: item.lineNumber,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                discountPercent: item.discountPercent,
                taxRate: item.taxRate,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              })),
            },
          },
        });
      } else if (source.documentType === DocumentType.WAYBILL && source.waybill) {
        await tx.waybill.create({
          data: {
            documentId: newDoc.id,
            consignorSnapshot: source.waybill.consignorSnapshot as Prisma.InputJsonValue,
            consigneeSnapshot: source.waybill.consigneeSnapshot as Prisma.InputJsonValue,
            originAddress: source.waybill.originAddress,
            destinationAddress: source.waybill.destinationAddress,
            vehicleNumber: source.waybill.vehicleNumber,
            driverName: source.waybill.driverName,
            driverPhone: source.waybill.driverPhone,
            items: {
              create: source.waybill.items.map((item) => ({
                lineNumber: item.lineNumber,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                weightKg: item.weightKg,
                packageCount: item.packageCount,
                packageType: item.packageType,
              })),
            },
          },
        });
      } else if (source.documentType === DocumentType.LETTER && source.letter) {
        await tx.letter.create({
          data: {
            documentId: newDoc.id,
            recipientName: source.letter.recipientName,
            recipientTitle: source.letter.recipientTitle,
            recipientOrganization: source.letter.recipientOrganization,
            recipientAddress: source.letter.recipientAddress,
            subject: source.letter.subject,
            bodyHtml: source.letter.bodyHtml,
            bodyText: source.letter.bodyText,
            signatoryName: source.letter.signatoryName,
            signatoryTitle: source.letter.signatoryTitle,
            signatoryDepartment: source.letter.signatoryDepartment,
          },
        });
      }

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: `${source.documentType}_DUPLICATED`,
          entityType: 'Document',
          entityId: newDoc.id,
          newValues: {
            originalDocumentId: source.id,
            originalDocumentNumber: source.documentNumber,
            newDocumentNumber: newDoc.documentNumber,
          },
        },
        tx,
      );

      return newDoc;
    });

    return this.findOne(companyId, duplicated.id);
  }

  // ---------------------------------------------------------------------------
  // APPROVALS WORKFLOW ENGINE
  // ---------------------------------------------------------------------------

  /**
   * Submits a document for approval. Transitions status to PENDING_APPROVAL and records an approval step.
   * Can be submitted from DRAFT or resubmitted from REJECTED.
   */
  async submitForApproval(
    companyId: string,
    id: string,
    dto: SubmitDocumentDto,
    actorId: string,
  ) {
    const document = await this.findOne(companyId, id);

    if (
      document.status !== DocumentStatus.DRAFT &&
      document.status !== DocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED documents can be submitted for approval. Current status is ${document.status}.`,
      );
    }

    // Validate items exist for specialized types
    if (document.documentType === DocumentType.INVOICE && (!document.invoice?.items || document.invoice.items.length === 0)) {
      throw new BadRequestException('Cannot submit an invoice with zero line items.');
    }
    if (document.documentType === DocumentType.WAYBILL && (!document.waybill?.items || document.waybill.items.length === 0)) {
      throw new BadRequestException('Cannot submit a waybill with zero cargo items.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const stepNumber = document.approvals.length + 1;

      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PENDING_APPROVAL },
      });

      await tx.documentApproval.create({
        data: {
          documentId: document.id,
          stepNumber,
          approverId: dto.approverId || actorId,
          status: 'PENDING',
          comment: dto.comment?.trim(),
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: `${document.documentType}_SUBMITTED_FOR_APPROVAL`,
          entityType: 'Document',
          entityId: document.id,
          newValues: { stepNumber, approverId: dto.approverId || null, comment: dto.comment },
        },
        tx,
      );

      return doc;
    });

    this.logger.log(`Document "${document.documentNumber}" submitted for approval by user "${actorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Approves a document. Enforces corporate prohibition on self-approval.
   */
  async approve(
    companyId: string,
    id: string,
    dto: ApproveDocumentDto,
    approverId: string,
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
      include: {
        company: { include: { settings: true } },
        approvals: { where: { status: 'PENDING' }, orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    if (document.status !== DocumentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Only documents in PENDING_APPROVAL can be approved. Current status is ${document.status}.`,
      );
    }

    // Corporate Security Rule: Prohibit self-approval unless explicitly permitted in CompanySetting
    const allowSelfApproval = document.company.settings?.allowSelfApproval ?? false;
    if (!allowSelfApproval && document.createdById === approverId) {
      throw new ForbiddenException(
        'Self-approval of documents is prohibited by corporate policy. An authorized manager must review and approve this document.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.APPROVED },
      });

      // Update pending approval step(s)
      await tx.documentApproval.updateMany({
        where: { documentId: document.id, status: 'PENDING' },
        data: {
          approverId,
          status: 'APPROVED',
          actionDate: new Date(),
          comment: dto.comment?.trim(),
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId: approverId,
          action: `${document.documentType}_APPROVED`,
          entityType: 'Document',
          entityId: document.id,
          newValues: { approverId, comment: dto.comment },
        },
        tx,
      );

      return doc;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Document Approved: ${document.documentNumber}`,
      `Your document "${document.documentNumber}" (${document.title}) has been approved.`,
      'DOCUMENT_APPROVED',
      { documentId: document.id, documentNumber: document.documentNumber },
    );

    this.logger.log(`Document "${document.documentNumber}" approved by user "${approverId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Rejects a document with a mandatory reason. Transitions status to REJECTED.
   */
  async reject(
    companyId: string,
    id: string,
    dto: RejectDocumentDto,
    rejectorId: string,
  ) {
    const document = await this.findOne(companyId, id);

    if (document.status !== DocumentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Only documents in PENDING_APPROVAL can be rejected. Current status is ${document.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.REJECTED },
      });

      // Update pending approval step
      await tx.documentApproval.updateMany({
        where: { documentId: document.id, status: 'PENDING' },
        data: {
          approverId: rejectorId,
          status: 'REJECTED',
          actionDate: new Date(),
          comment: dto.reason.trim(),
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId: rejectorId,
          action: `${document.documentType}_REJECTED`,
          entityType: 'Document',
          entityId: document.id,
          newValues: { rejectorId, reason: dto.reason.trim() },
        },
        tx,
      );

      return doc;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `Document Rejected: ${document.documentNumber}`,
      `Your document "${document.documentNumber}" was rejected. Reason: ${dto.reason.trim()}`,
      'DOCUMENT_REJECTED',
      { documentId: document.id, documentNumber: document.documentNumber, reason: dto.reason.trim() },
    );

    this.logger.log(`Document "${document.documentNumber}" rejected by user "${rejectorId}".`);
    return this.findOne(companyId, updated.id);
  }

  /**
   * Polymorphic issuance: transitions an APPROVED document to ISSUED status,
   * executes domain-specific validations and side effects in a single transaction,
   * creates an authoritative locked DocumentVersion snapshot, and dispatches audit + notification.
   */
  async issue(companyId: string, id: string, dto: IssueDocumentDto, actorId: string) {
    const document = await this.findOne(companyId, id);

    // Concurrency control: verify expectedVersion if provided
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document was modified concurrently. Expected version ${dto.expectedVersion}, but current version is ${document.versionCounter}.`,
      );
    }

    // Must be in APPROVED status (Financial & business rule policy)
    if (document.status !== DocumentStatus.APPROVED) {
      throw new BadRequestException(
        `Only APPROVED documents can be issued. Current status is ${document.status}.`,
      );
    }

    const issued = await this.prisma.$transaction(async (tx) => {
      let snapshotData: Record<string, any> = {};

      if (document.documentType === DocumentType.INVOICE) {
        if (!document.invoice || !document.invoice.items || document.invoice.items.length === 0) {
          throw new BadRequestException('Cannot issue an invoice without line items.');
        }

        await tx.invoice.update({
          where: { id: document.invoice.id },
          data: {
            paymentStatus: InvoicePaymentStatus.UNPAID,
          },
        });

        snapshotData = {
          documentNumber: document.documentNumber,
          title: document.title,
          currency: document.currency,
          subtotal: document.subtotal,
          taxAmount: document.taxAmount,
          discountAmount: document.discountAmount,
          totalAmount: document.totalAmount,
          balanceDue: document.balanceDue,
          paymentTerms: document.invoice.paymentTerms,
          poNumber: document.invoice.poNumber,
          client: document.client,
          items: document.invoice.items,
          company: document.company,
          issuedAt: new Date().toISOString(),
          frozenAt: new Date().toISOString(),
        };
      } else if (document.documentType === DocumentType.WAYBILL) {
        if (!document.waybill || !document.waybill.items || document.waybill.items.length === 0) {
          throw new BadRequestException('Cannot issue a waybill without cargo items.');
        }

        const hasDispatchDetails = Boolean(
          dto.vehicleNumber?.trim() || dto.driverName?.trim() || dto.driverPhone?.trim(),
        );
        const targetDeliveryStatus = hasDispatchDetails
          ? WaybillDeliveryStatus.IN_TRANSIT
          : document.waybill.deliveryStatus === WaybillDeliveryStatus.PREPARING
            ? WaybillDeliveryStatus.READY
            : document.waybill.deliveryStatus;

        await tx.waybill.update({
          where: { id: document.waybill.id },
          data: {
            deliveryStatus: targetDeliveryStatus,
            vehicleNumber: dto.vehicleNumber?.trim() || document.waybill.vehicleNumber,
            driverName: dto.driverName?.trim() || document.waybill.driverName,
            driverPhone: dto.driverPhone?.trim() || document.waybill.driverPhone,
            trackingNumber: dto.trackingNumber?.trim() || document.waybill.trackingNumber,
          },
        });

        snapshotData = {
          documentNumber: document.documentNumber,
          title: document.title,
          consignor: document.waybill.consignorSnapshot,
          consignee: document.waybill.consigneeSnapshot,
          originAddress: document.waybill.originAddress,
          destinationAddress: document.waybill.destinationAddress,
          vehicleNumber: dto.vehicleNumber?.trim() || document.waybill.vehicleNumber,
          driverName: dto.driverName?.trim() || document.waybill.driverName,
          driverPhone: dto.driverPhone?.trim() || document.waybill.driverPhone,
          trackingNumber: dto.trackingNumber?.trim() || document.waybill.trackingNumber,
          deliveryStatus: targetDeliveryStatus,
          items: document.waybill.items,
          issuedAt: new Date().toISOString(),
        };
      } else if (document.documentType === DocumentType.LETTER) {
        if (!document.letter) {
          throw new BadRequestException('Letter entity details missing.');
        }

        snapshotData = {
          documentNumber: document.documentNumber,
          title: document.title,
          letterDate: document.letter.letterDate,
          recipientName: document.letter.recipientName,
          recipientTitle: document.letter.recipientTitle,
          recipientOrganization: document.letter.recipientOrganization,
          recipientAddress: document.letter.recipientAddress,
          subject: document.letter.subject,
          bodyHtml: document.letter.bodyHtml,
          bodyText: document.letter.bodyText,
          signatoryName: document.letter.signatoryName,
          signatoryTitle: document.letter.signatoryTitle,
          signatoryDepartment: document.letter.signatoryDepartment,
          issuedAt: new Date().toISOString(),
        };
      }

      const latestVersion = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber,
          snapshotData: JSON.parse(JSON.stringify(snapshotData)) as Prisma.InputJsonValue,
          createdById: actorId,
          changeReason: dto.notes?.trim() || `Official ${document.documentType} Issuance`,
        },
      });

      const updatedDoc = await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ISSUED,
          currentVersionId: version.id,
          issueDate: document.issueDate ?? new Date(),
          versionCounter: { increment: 1 },
        },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: `${document.documentType}_ISSUED`,
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            documentNumber: document.documentNumber,
            versionNumber,
            versionId: version.id,
            status: DocumentStatus.ISSUED,
          },
        },
        tx,
      );

      return updatedDoc;
    });

    await this.notificationsService.createNotification(
      companyId,
      document.createdById,
      `${document.documentType} Issued: ${document.documentNumber}`,
      `Your ${document.documentType.toLowerCase()} "${document.documentNumber}" has been officially issued.`,
      'DOCUMENT_ISSUED',
      { documentId: document.id, documentNumber: document.documentNumber },
    );

    this.logger.log(`Document "${document.documentNumber}" issued by user "${actorId}".`);
    return this.findOne(companyId, issued.id);
  }

  /**
   * Retrieves full chronological approval history for a document.
   */
  async getApprovals(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
    });
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    return this.prisma.documentApproval.findMany({
      where: { documentId: id },
      include: {
        approver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { stepNumber: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // IMMUTABLE VERSION HISTORY & SNAPSHOTTING
  // ---------------------------------------------------------------------------

  /**
   * Captures an immutable version snapshot of the document, items, and branding.
   */
  async createVersionSnapshot(
    companyId: string,
    id: string,
    dto: CreateVersionDto,
    actorId: string,
    externalTx?: Prisma.TransactionClient,
  ) {
    const document = await this.findOne(companyId, id);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true },
    });

    const runner = async (tx: Prisma.TransactionClient) => {
      // Find latest version number
      const latest = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: 'desc' },
      });

      const nextVersionNumber = (latest?.versionNumber || 0) + 1;

      // Construct deep immutable snapshot
      const snapshotData = {
        versionNumber: nextVersionNumber,
        snapshotTimestamp: new Date().toISOString(),
        snapshotAuthorId: actorId,
        changeReason: dto.changeReason?.trim() || 'Official Revision Snapshot',
        document: {
          id: document.id,
          documentNumber: document.documentNumber,
          documentType: document.documentType,
          title: document.title,
          status: document.status,
          issueDate: document.issueDate,
          dueDate: document.dueDate,
          currency: document.currency,
          subtotal: document.subtotal.toString(),
          taxAmount: document.taxAmount.toString(),
          discountAmount: document.discountAmount.toString(),
          totalAmount: document.totalAmount.toString(),
          balanceDue: document.balanceDue.toString(),
        },
        client: document.client
          ? {
              id: document.client.id,
              clientNumber: document.client.clientNumber,
              name: document.client.name,
              companyName: document.client.companyName,
              email: document.client.email,
              phone: document.client.phone,
              addresses: document.client.addresses,
            }
          : null,
        branch: document.branch ? { id: document.branch.id, code: document.branch.code, name: document.branch.name } : null,
        department: document.department ? { id: document.department.id, code: document.department.code, name: document.department.name } : null,
        specialized: {
          invoice: document.invoice,
          waybill: document.waybill,
          letter: document.letter,
        },
        companyBranding: {
          name: company?.name,
          legalName: company?.legalName,
          rcNumber: company?.rcNumber,
          tin: company?.tin,
          address: company?.address,
          email: company?.email,
          phone: company?.phone,
          bankName: company?.settings?.bankName,
          bankAccountNumber: company?.settings?.bankAccountNumber,
          bankAccountName: company?.settings?.bankAccountName,
        },
      };

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: nextVersionNumber,
          snapshotData: JSON.parse(JSON.stringify(snapshotData)) as unknown as Prisma.InputJsonValue,
          createdById: actorId,
          changeReason: dto.changeReason?.trim() || 'Official Revision Snapshot',
        },
      });

      await tx.document.update({
        where: { id: document.id },
        data: { currentVersionId: version.id },
      });

      await this.auditService.logAction(
        {
          companyId,
          actorId,
          action: 'DOCUMENT_VERSION_CREATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            versionId: version.id,
            versionNumber: nextVersionNumber,
            changeReason: dto.changeReason,
          },
        },
        tx,
      );

      return version;
    };

    if (externalTx) {
      return runner(externalTx);
    }
    return this.prisma.$transaction(runner);
  }

  /**
   * Lists all version records for a document.
   */
  async getVersions(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
    });
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Retrieves a specific historical version snapshot.
   */
  async getVersion(companyId: string, id: string, versionNumber: number) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId },
    });
    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    const version = await this.prisma.documentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId: id,
          versionNumber,
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!version) {
      throw new NotFoundException(`Version ${versionNumber} for document "${document.documentNumber}" not found.`);
    }

    return version;
  }

  /**
   * Compares two document version snapshots and reports field & financial differences.
   */
  async compareVersions(companyId: string, id: string, fromVersion: number, toVersion: number) {
    const [vFrom, vTo] = await Promise.all([
      this.getVersion(companyId, id, fromVersion),
      this.getVersion(companyId, id, toVersion),
    ]);

    const dataFrom = vFrom.snapshotData as any;
    const dataTo = vTo.snapshotData as any;

    const fromDoc = dataFrom?.document || {};
    const toDoc = dataTo?.document || {};

    // Financial difference calculation
    const fromTotal = new Decimal(fromDoc.totalAmount || 0);
    const toTotal = new Decimal(toDoc.totalAmount || 0);
    const totalDiff = toTotal.minus(fromTotal);

    const fromSubtotal = new Decimal(fromDoc.subtotal || 0);
    const toSubtotal = new Decimal(toDoc.subtotal || 0);
    const subtotalDiff = toSubtotal.minus(fromSubtotal);

    // Field level changes
    const fieldChanges: Array<{ field: string; from: unknown; to: unknown }> = [];
    if (fromDoc.title !== toDoc.title) fieldChanges.push({ field: 'title', from: fromDoc.title, to: toDoc.title });
    if (fromDoc.status !== toDoc.status) fieldChanges.push({ field: 'status', from: fromDoc.status, to: toDoc.status });
    if (fromDoc.issueDate !== toDoc.issueDate) fieldChanges.push({ field: 'issueDate', from: fromDoc.issueDate, to: toDoc.issueDate });
    if (fromDoc.dueDate !== toDoc.dueDate) fieldChanges.push({ field: 'dueDate', from: fromDoc.dueDate, to: toDoc.dueDate });

    // Item differences (for invoice items or waybill items)
    const fromItems: any[] = dataFrom?.specialized?.invoice?.items || dataFrom?.specialized?.waybill?.items || [];
    const toItems: any[] = dataTo?.specialized?.invoice?.items || dataTo?.specialized?.waybill?.items || [];

    const itemChanges = {
      fromItemCount: fromItems.length,
      toItemCount: toItems.length,
      differenceCount: toItems.length - fromItems.length,
    };

    return {
      documentId: id,
      documentNumber: fromDoc.documentNumber,
      fromVersion: vFrom.versionNumber,
      toVersion: vTo.versionNumber,
      fromCreatedAt: vFrom.createdAt,
      toCreatedAt: vTo.createdAt,
      changeReason: vTo.changeReason,
      financialDiff: {
        subtotalDifference: subtotalDiff.toFixed(2),
        totalDifference: totalDiff.toFixed(2),
        fromTotalAmount: fromTotal.toFixed(2),
        toTotalAmount: toTotal.toFixed(2),
      },
      fieldChanges,
      itemChanges,
    };
  }

  /**
   * Toggles archival state for a document.
   */
  async setArchived(companyId: string, id: string, isArchived: boolean, actorId: string) {
    const document = await this.findOne(companyId, id);

    const updated = await this.prisma.document.update({
      where: { id: document.id },
      data: { isArchived },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: isArchived ? 'DOCUMENT_ARCHIVED' : 'DOCUMENT_UNARCHIVED',
      entityType: 'Document',
      entityId: document.id,
      newValues: { isArchived },
    });

    return updated;
  }
}
