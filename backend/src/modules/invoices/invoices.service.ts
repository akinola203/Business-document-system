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
import { FinancialMathUtil } from '../documents/utils/financial-math.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Creates a new invoice in DRAFT status with transaction-safe sequential number and authoritative financial math.
   */
  async createDraft(companyId: string, dto: CreateInvoiceDto, actorId: string) {
    // 1. Verify client exists for company
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID "${dto.clientId}" not found in this company.`);
    }

    // 2. Authoritative Decimal Financial Calculations
    const mathSummary = FinancialMathUtil.calculateDocumentTotals(dto.items);

    // 3. Transaction-safe persistence and number allocation
    const result = await this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.numberingService.getNextDocumentNumber(
        tx,
        companyId,
        DocumentType.INVOICE,
      );

      const document = await tx.document.create({
        data: {
          companyId,
          clientId: dto.clientId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          documentType: DocumentType.INVOICE,
          documentNumber,
          title: dto.title.trim(),
          status: DocumentStatus.DRAFT,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          currency: dto.currency || 'NGN',
          subtotal: mathSummary.subtotal.toString(),
          taxAmount: mathSummary.taxAmount.toString(),
          discountAmount: mathSummary.discountAmount.toString(),
          totalAmount: mathSummary.totalAmount.toString(),
          balanceDue: mathSummary.balanceDue.toString(),
          createdById: actorId,
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
        },
      });

      await tx.invoice.create({
        data: {
          documentId: document.id,
          paymentTerms: dto.paymentTerms || 'Net 30 Days',
          poNumber: dto.poNumber?.trim(),
          bankDetailsVisible: dto.bankDetailsVisible ?? true,
          items: {
            create: mathSummary.items.map((item, index) => ({
              lineNumber: index + 1,
              description: dto.items[index].description.trim(),
              quantity: item.quantity.toString(),
              unit: dto.items[index].unit.trim(),
              unitPrice: item.unitPrice.toString(),
              discountPercent: item.discountPercent.toString(),
              taxRate: item.taxRate.toString(),
              taxAmount: item.taxAmount.toString(),
              lineTotal: item.lineTotal.toString(),
            })),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_CREATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            documentNumber: document.documentNumber,
            totalAmount: document.totalAmount.toString(),
            clientId: client.id,
            clientName: client.name,
          },
        },
      });

      return document;
    });

    this.logger.log(`Draft invoice "${result.documentNumber}" created by user "${actorId}".`);
    return this.findOne(companyId, result.id);
  }

  /**
   * Updates an existing draft invoice and recalculates financial summaries.
   */
  async updateDraft(companyId: string, id: string, dto: UpdateInvoiceDto, actorId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.INVOICE },
      include: { invoice: { include: { items: true } } },
    });

    if (!document || !document.invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found.`);
    }

    if (document.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT invoices can be edited. Current status is ${document.status}. Issued records are immutable.`,
      );
    }

    // Optimistic Concurrency Control Check
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document has been modified by another user or session. Current version is ${document.versionCounter}. Please refresh and review latest changes before reapplying edits.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let subtotal = document.subtotal;
      let taxAmount = document.taxAmount;
      let discountAmount = document.discountAmount;
      let totalAmount = document.totalAmount;
      let balanceDue = document.balanceDue;

      // If items were provided, replace them and recalculate
      if (dto.items && dto.items.length > 0) {
        const mathSummary = FinancialMathUtil.calculateDocumentTotals(dto.items);
        subtotal = new Prisma.Decimal(mathSummary.subtotal.toString());
        taxAmount = new Prisma.Decimal(mathSummary.taxAmount.toString());
        discountAmount = new Prisma.Decimal(mathSummary.discountAmount.toString());
        totalAmount = new Prisma.Decimal(mathSummary.totalAmount.toString());
        balanceDue = new Prisma.Decimal(mathSummary.balanceDue.toString());

        // Delete old line items and insert newly calculated ones
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: document.invoice!.id },
        });

        await tx.invoiceItem.createMany({
          data: mathSummary.items.map((item, index) => ({
            invoiceId: document.invoice!.id,
            lineNumber: index + 1,
            description: dto.items![index].description.trim(),
            quantity: item.quantity.toString(),
            unit: dto.items![index].unit.trim(),
            unitPrice: item.unitPrice.toString(),
            discountPercent: item.discountPercent.toString(),
            taxRate: item.taxRate.toString(),
            taxAmount: item.taxAmount.toString(),
            lineTotal: item.lineTotal.toString(),
          })),
        });
      }

      await tx.document.update({
        where: { id: document.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          clientId: dto.clientId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          currency: dto.currency,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          balanceDue,
          versionCounter: { increment: 1 },
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
        },
      });

      await tx.invoice.update({
        where: { id: document.invoice!.id },
        data: {
          paymentTerms: dto.paymentTerms,
          poNumber: dto.poNumber !== undefined ? dto.poNumber?.trim() : undefined,
          bankDetailsVisible: dto.bankDetailsVisible,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_UPDATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            title: dto.title,
            totalAmount: totalAmount.toString(),
          },
        },
      });

      return document;
    });

    return this.findOne(companyId, updated.id);
  }

  /**
   * Submits a draft invoice for approval.
   */
  async submitForApproval(companyId: string, id: string, actorId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.INVOICE },
      include: { invoice: { include: { items: true } } },
    });

    if (!document || !document.invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found.`);
    }

    if (document.status !== DocumentStatus.DRAFT && document.status !== DocumentStatus.REJECTED) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED invoices can be submitted for approval. Current status is ${document.status}.`,
      );
    }

    if (document.invoice.items.length === 0) {
      throw new BadRequestException('Cannot submit an invoice with zero line items.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.PENDING_APPROVAL },
      });

      await tx.documentApproval.create({
        data: {
          documentId: document.id,
          approverId: actorId, // Initial submitter reference
          status: 'PENDING',
          stepNumber: 1,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_SUBMITTED_FOR_APPROVAL',
          entityType: 'Document',
          entityId: document.id,
        },
      });

      return doc;
    });

    this.logger.log(`Invoice "${document.documentNumber}" submitted for approval by user "${actorId}".`);
    return updated;
  }

  /**
   * Approves an invoice. Enforces corporate prohibition on self-approval for financial records.
   */
  async approve(companyId: string, id: string, approverId: string, comment?: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.INVOICE },
      include: { company: { include: { settings: true } } },
    });

    if (!document) {
      throw new NotFoundException(`Invoice with ID "${id}" not found.`);
    }

    if (document.status !== DocumentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Only invoices in PENDING_APPROVAL can be approved. Current status is ${document.status}.`,
      );
    }

    // Corporate Security Rule: Prohibit self-approval unless explicitly permitted in CompanySetting
    const allowSelfApproval = document.company.settings?.allowSelfApproval ?? false;
    if (!allowSelfApproval && document.createdById === approverId) {
      throw new ForbiddenException(
        'Self-approval of financial documents is prohibited by corporate policy. An authorized manager must review and approve this invoice.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.APPROVED },
      });

      // Update pending approval record
      await tx.documentApproval.updateMany({
        where: { documentId: document.id, status: 'PENDING' },
        data: {
          approverId,
          status: 'APPROVED',
          actionDate: new Date(),
          comment: comment?.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId: approverId,
          action: 'INVOICE_APPROVED',
          entityType: 'Document',
          entityId: document.id,
          newValues: { approverId, comment },
        },
      });

      return doc;
    });

    this.logger.log(`Invoice "${document.documentNumber}" approved by user "${approverId}".`);
    return updated;
  }

  /**
   * Issues an approved invoice, freezing the official legal version and locking further edits.
   */
  async issue(companyId: string, id: string, actorId: string) {
    const document = await this.findOne(companyId, id);

    if (document.status !== DocumentStatus.APPROVED && document.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        `Only APPROVED invoices can be issued. Current status is ${document.status}.`,
      );
    }

    const issued = await this.prisma.$transaction(async (tx) => {
      // 1. Create immutable snapshot for DocumentVersion
      const snapshotData = {
        documentId: document.id,
        documentNumber: document.documentNumber,
        title: document.title,
        issueDate: document.issueDate,
        dueDate: document.dueDate,
        currency: document.currency,
        subtotal: document.subtotal.toString(),
        taxAmount: document.taxAmount.toString(),
        discountAmount: document.discountAmount.toString(),
        totalAmount: document.totalAmount.toString(),
        client: document.client,
        invoice: document.invoice,
        items: document.invoice?.items,
        frozenAt: new Date().toISOString(),
      };

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          snapshotData: snapshotData as unknown as Prisma.InputJsonValue,
          createdById: actorId,
          changeReason: 'Initial Official Issuance',
        },
      });

      const updated = await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.ISSUED,
          currentVersionId: version.id,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'INVOICE_ISSUED',
          entityType: 'Document',
          entityId: document.id,
          newValues: { versionNumber: 1, versionId: version.id },
        },
      });

      return updated;
    });

    this.logger.log(`Invoice "${document.documentNumber}" officially issued by user "${actorId}".`);
    return this.findOne(companyId, issued.id);
  }

  /**
   * Helper to retrieve full invoice record with related entities.
   */
  async findOne(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.INVOICE },
      include: {
        client: { include: { addresses: true } },
        branch: true,
        department: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        invoice: {
          include: {
            items: { orderBy: { lineNumber: 'asc' } },
            payments: { where: { isReversed: false }, orderBy: { paymentDate: 'desc' } },
          },
        },
        approvals: {
          include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { stepNumber: 'asc' },
        },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!document) {
      throw new NotFoundException(`Invoice with ID "${id}" not found.`);
    }

    return document;
  }
}
