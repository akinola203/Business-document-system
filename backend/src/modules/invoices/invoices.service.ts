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
import { validateTenantScope } from '../../common/utils/tenant-validation.util';

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
    // 1. Verify foreign keys belong to caller company
    const { client } = await validateTenantScope(this.prisma, companyId, {
      clientId: dto.clientId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      templateId: dto.templateId,
    });

    // 2. Authoritative Decimal Financial Calculations
    const mathSummary = FinancialMathUtil.calculateDocumentTotals(dto.items);

    if (dto.selectedAddressId) {
      const address = await this.prisma.clientAddress.findFirst({
        where: { id: dto.selectedAddressId, clientId: dto.clientId },
      });
      if (!address) {
        throw new BadRequestException(
          `Selected address ID "${dto.selectedAddressId}" does not belong to client "${dto.clientId}".`,
        );
      }
    }

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
          metadata: {
            ...(dto.notes ? { notes: dto.notes.trim() } : {}),
            ...(dto.selectedAddressId ? { selectedAddressId: dto.selectedAddressId } : {}),
          },
        },
      });

      await tx.invoice.create({
        data: {
          documentId: document.id,
          paymentTerms: dto.paymentTerms || 'Net 30 Days',
          poNumber: dto.poNumber?.trim(),
          notes: dto.notes?.trim(),
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
            clientId: client?.id || dto.clientId,
            clientName: client?.name || 'N/A',
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

    if (
      document.status !== DocumentStatus.DRAFT &&
      document.status !== DocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED invoices can be edited. Current status is ${document.status}. Issued records are immutable.`,
      );
    }

    // Validate foreign keys belong to caller company if updated
    await validateTenantScope(this.prisma, companyId, {
      clientId: dto.clientId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      templateId: dto.templateId,
    });

    const targetClientId = dto.clientId || document.clientId;
    if (dto.selectedAddressId && targetClientId) {
      const address = await this.prisma.clientAddress.findFirst({
        where: { id: dto.selectedAddressId, clientId: targetClientId },
      });
      if (!address) {
        throw new BadRequestException(
          `Selected address ID "${dto.selectedAddressId}" does not belong to client "${targetClientId}".`,
        );
      }
    }

    // Optimistic Concurrency Control Check
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document has been modified by another user or session. Current version is ${document.versionCounter}. Please refresh and review latest changes before reapplying edits.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Claim row atomically with OCC and status check
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
          'Invoice was concurrently modified or is not in an editable status (DRAFT or REJECTED).',
        );
      }

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
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
          metadata: {
            ...(typeof document.metadata === 'object' && document.metadata ? (document.metadata as any) : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes ? dto.notes.trim() : null } : {}),
            ...(dto.selectedAddressId !== undefined ? { selectedAddressId: dto.selectedAddressId } : {}),
          },
        },
      });

      await tx.invoice.update({
        where: { id: document.invoice!.id },
        data: {
          paymentTerms: dto.paymentTerms,
          poNumber: dto.poNumber !== undefined ? dto.poNumber?.trim() : undefined,
          notes: dto.notes !== undefined ? dto.notes?.trim() : undefined,
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
