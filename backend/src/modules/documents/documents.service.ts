import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { CancelDocumentDto } from './dto/cancel-document.dto';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Retrieves paginated documents across all document types with search and filters.
   */
  async findAll(companyId: string, query: QueryDocumentsDto) {
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
      ...(documentType ? { documentType } : {}),
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
   * Retrieves a document by ID with its complete specialized extension and items.
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
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found.`);
    }

    return document;
  }

  /**
   * Cancels a document with mandatory justification. Document number is NEVER reused.
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
      const result = await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.CANCELLED,
          cancellationReason: dto.reason.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: `${document.documentType}_CANCELLED`,
          entityType: 'Document',
          entityId: document.id,
          oldValues: { status: document.status },
          newValues: { status: DocumentStatus.CANCELLED, reason: dto.reason.trim() },
        },
      });

      return result;
    });

    this.logger.log(`Document "${document.documentNumber}" cancelled by user "${actorId}".`);
    return updated;
  }

  /**
   * Duplicates an existing document into a new DRAFT with a newly allocated number.
   * Approvals and payment records are NOT copied.
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

      await tx.auditLog.create({
        data: {
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
      });

      return newDoc;
    });

    return this.findOne(companyId, duplicated.id);
  }
}
