import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  InvoicePaymentStatus,
  Prisma,
  WaybillDeliveryStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { AuditService } from '../audit/audit.service';
import { FinancialMathUtil } from './utils/financial-math.util';

export interface ConvertInvoiceToWaybillOptions {
  originAddress?: string;
  destinationAddress?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
}

export interface ConvertWaybillToInvoiceOptions {
  defaultUnitPrice?: number;
  unitPricesByLine?: Record<number, number>;
  taxRate?: number;
  paymentTerms?: string;
  notes?: string;
}

@Injectable()
export class DocumentConversionService {
  private readonly logger = new Logger(DocumentConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly numberingService?: NumberingService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Generates a unique tracking number for converted waybills.
   */
  private generateTrackingCode(): string {
    const year = new Date().getUTCFullYear();
    const token = randomBytes(4).toString('hex').toUpperCase();
    return `TRK-${year}-${token}`;
  }

  /**
   * Allocates a document number using NumberingService when available, or deterministic fallback in standalone tests.
   */
  private async allocateDocumentNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    documentType: DocumentType,
  ): Promise<string> {
    if (this.numberingService) {
      return this.numberingService.getNextDocumentNumber(tx, companyId, documentType);
    }
    const year = new Date().getUTCFullYear();
    const prefix = documentType === DocumentType.WAYBILL ? 'WB' : 'INV';
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${year}-${suffix}`;
  }

  /**
   * Converts an existing Invoice into a linked Waybill inside an atomic database transaction.
   * - Creates a parent Document (type WAYBILL)
   * - Generates a unique tracking code
   * - Links the Waybill back to the Invoice via `invoiceId`
   * - Returns the populated Waybill record
   */
  async createWaybillFromInvoice(
    invoiceId: string,
    companyId: string,
    actorId = 'system',
    options: ConvertInvoiceToWaybillOptions = {},
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [{ id: invoiceId }, { documentId: invoiceId }],
        deletedAt: null,
        document: {
          companyId,
          deletedAt: null,
        },
      },
      include: {
        document: {
          include: {
            client: { include: { addresses: true } },
            company: true,
          },
        },
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });

    if (!invoice || !invoice.document || invoice.document.companyId !== companyId) {
      throw new NotFoundException(
        `Invoice with ID "${invoiceId}" not found or unauthorized for company "${companyId}".`,
      );
    }

    const invoiceDoc = invoice.document;
    const company = (invoiceDoc as any).company;
    const client = (invoiceDoc as any).client;
    const defaultClientAddress =
      client?.addresses?.find((a: any) => a.isDefault) || client?.addresses?.[0];

    const originAddress =
      options.originAddress?.trim() ||
      company?.address ||
      'Main Dispatch Warehouse, Lagos, Nigeria';
    const destinationAddress =
      options.destinationAddress?.trim() ||
      (defaultClientAddress
        ? `${defaultClientAddress.addressLine1}, ${defaultClientAddress.city}, ${defaultClientAddress.state}`
        : 'Client / Customer Registered Delivery Address');

    const consignorSnapshot = {
      name: company?.name || 'Company Consignor',
      legalName: company?.legalName || company?.name || 'Company Consignor',
      address: originAddress,
      phone: company?.phone || null,
      email: company?.email || null,
    };

    const consigneeSnapshot = {
      name: client?.name || 'Client / Customer Consignee',
      companyName: client?.companyName || null,
      address: destinationAddress,
      phone: client?.phone || null,
      email: client?.email || null,
    };

    const trackingNumber = options.trackingNumber?.trim() || this.generateTrackingCode();
    const effectiveActorId = actorId || invoiceDoc.createdById;

    const createdWaybill = await this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.allocateDocumentNumber(
        tx,
        companyId,
        DocumentType.WAYBILL,
      );

      const parentDocument = await tx.document.create({
        data: {
          companyId,
          clientId: invoiceDoc.clientId,
          branchId: invoiceDoc.branchId,
          departmentId: invoiceDoc.departmentId,
          documentType: DocumentType.WAYBILL,
          documentNumber,
          title: `Waybill for ${invoiceDoc.documentNumber}`,
          status: DocumentStatus.DRAFT,
          issueDate: new Date(),
          currency: invoice.currency || invoiceDoc.currency || 'NGN',
          exchangeRate: invoice.exchangeRate || invoiceDoc.exchangeRate || new Prisma.Decimal(1),
          createdById: effectiveActorId,
        },
      });

      const waybill = await tx.waybill.create({
        data: {
          companyId,
          documentId: parentDocument.id,
          invoiceId: invoice.id,
          currency: invoice.currency || invoiceDoc.currency || 'NGN',
          exchangeRate: invoice.exchangeRate || invoiceDoc.exchangeRate || new Prisma.Decimal(1),
          shipmentDate: new Date(),
          consignorSnapshot,
          consigneeSnapshot,
          originAddress,
          destinationAddress,
          vehicleNumber: options.vehicleNumber?.trim(),
          driverName: options.driverName?.trim(),
          driverPhone: options.driverPhone?.trim(),
          trackingNumber,
          deliveryStatus: WaybillDeliveryStatus.PREPARING,
          items: {
            create: (invoice.items || []).map((item: any, idx: number) => ({
              lineNumber: item.lineNumber ?? idx + 1,
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity.toString()),
              unit: item.unit || 'Unit',
            })),
          },
        },
        include: {
          document: true,
          items: true,
          invoice: true,
        },
      });

      if (this.auditService) {
        await this.auditService.logAction(
          {
            companyId,
            actorId: effectiveActorId,
            action: 'WAYBILL_CREATED_FROM_INVOICE',
            entityType: 'Document',
            entityId: parentDocument.id,
            newValues: {
              waybillId: waybill.id,
              waybillDocumentNumber: documentNumber,
              sourceInvoiceId: invoice.id,
              trackingNumber,
            },
          },
          tx,
        );
      }

      return waybill;
    });

    this.logger.log(
      `Converted invoice "${invoice.id}" to waybill "${createdWaybill.id}" (tracking: ${createdWaybill.trackingNumber}).`,
    );

    return createdWaybill;
  }

  /**
   * Converts an unbilled Waybill into a newly linked Invoice inside an atomic database transaction.
   * - Verifies the waybill exists, belongs to `companyId`, and is not already linked to an invoice
   * - Creates a parent Document (type INVOICE)
   * - Creates a new Invoice record with items derived from the waybill
   * - Updates the waybill's `invoiceId` foreign key to point to the newly created invoice
   * - Returns the newly linked Invoice record
   */
  async createInvoiceFromWaybill(
    waybillId: string,
    companyId: string,
    actorId = 'system',
    options: ConvertWaybillToInvoiceOptions = {},
  ) {
    const waybill = await this.prisma.waybill.findFirst({
      where: {
        OR: [{ id: waybillId }, { documentId: waybillId }],
        deletedAt: null,
        document: {
          companyId,
          deletedAt: null,
        },
      },
      include: {
        document: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });

    if (!waybill || !waybill.document || waybill.document.companyId !== companyId) {
      throw new NotFoundException(
        `Waybill with ID "${waybillId}" not found or unauthorized for company "${companyId}".`,
      );
    }

    if (waybill.invoiceId) {
      throw new BadRequestException(
        `Waybill "${waybill.id}" is already linked to invoice "${waybill.invoiceId}".`,
      );
    }

    const waybillDoc = waybill.document;
    const effectiveActorId = actorId || waybillDoc.createdById;
    const defaultUnitPrice = options.defaultUnitPrice ?? 0;
    const defaultTaxRate = options.taxRate ?? 7.5;

    const rawItems = (waybill.items || []).map((item: any, idx: number) => {
      const lineNum = item.lineNumber ?? idx + 1;
      const unitPrice = options.unitPricesByLine?.[lineNum] ?? defaultUnitPrice;
      return {
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit || 'Unit',
        unitPrice,
        discountPercent: 0,
        taxRate: defaultTaxRate,
      };
    });

    const mathSummary =
      rawItems.length > 0
        ? FinancialMathUtil.calculateDocumentTotals(rawItems)
        : {
            subtotal: new Prisma.Decimal(0),
            discountAmount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(0),
            balanceDue: new Prisma.Decimal(0),
            items: [],
          };

    const createdInvoice = await this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.allocateDocumentNumber(
        tx,
        companyId,
        DocumentType.INVOICE,
      );

      const currency = waybill.currency || waybillDoc.currency || 'NGN';
      const exchangeRate =
        waybill.exchangeRate || waybillDoc.exchangeRate || new Prisma.Decimal(1);

      const parentDocument = await tx.document.create({
        data: {
          companyId,
          clientId: waybillDoc.clientId,
          branchId: waybillDoc.branchId,
          departmentId: waybillDoc.departmentId,
          documentType: DocumentType.INVOICE,
          documentNumber,
          title: `Invoice for Waybill ${waybillDoc.documentNumber}`,
          status: DocumentStatus.DRAFT,
          issueDate: new Date(),
          currency,
          exchangeRate,
          subtotal: mathSummary.subtotal.toFixed(2),
          taxAmount: mathSummary.taxAmount.toFixed(2),
          discountAmount: mathSummary.discountAmount.toFixed(2),
          totalAmount: mathSummary.totalAmount.toFixed(2),
          balanceDue: mathSummary.balanceDue.toFixed(2),
          createdById: effectiveActorId,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          documentId: parentDocument.id,
          currency,
          exchangeRate,
          baseTotalAmount: mathSummary.totalAmount.toFixed(2),
          paymentTerms: options.paymentTerms || 'Net 30 Days',
          notes: options.notes?.trim(),
          paymentStatus: InvoicePaymentStatus.UNPAID,
          items: {
            create: mathSummary.items.map((item, idx) => ({
              lineNumber: idx + 1,
              description: rawItems[idx].description,
              quantity: item.quantity.toString(),
              unit: rawItems[idx].unit,
              unitPrice: item.unitPrice.toString(),
              discountPercent: item.discountPercent.toString(),
              taxRate: item.taxRate.toString(),
              taxAmount: item.taxAmount.toString(),
              lineTotal: item.lineTotal.toString(),
            })),
          },
        },
        include: {
          document: true,
          items: true,
        },
      });

      const updatedWaybill = await tx.waybill.update({
        where: { id: waybill.id },
        data: { invoiceId: invoice.id },
      });

      if (this.auditService) {
        await this.auditService.logAction(
          {
            companyId,
            actorId: effectiveActorId,
            action: 'INVOICE_CREATED_FROM_WAYBILL',
            entityType: 'Document',
            entityId: parentDocument.id,
            newValues: {
              invoiceId: invoice.id,
              invoiceDocumentNumber: documentNumber,
              sourceWaybillId: waybill.id,
            },
          },
          tx,
        );
      }

      return {
        ...invoice,
        waybillId: updatedWaybill.id,
      };
    });

    this.logger.log(
      `Converted waybill "${waybill.id}" to invoice "${createdInvoice.id}".`,
    );

    return createdInvoice;
  }
}

