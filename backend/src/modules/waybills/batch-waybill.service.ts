import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import {
  DocumentStatus,
  DocumentType,
  Prisma,
  WaybillDeliveryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';

@Injectable()
export class BatchWaybillService {
  private readonly logger = new Logger(BatchWaybillService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly numberingService?: NumberingService,
  ) {}

  /**
   * Consolidates multiple tenant-scoped invoices into a single MasterWaybill manifest
   * and atomically generates individual child Waybills for each invoice.
   */
  async createBatchWaybill(
    companyId: string,
    invoiceIds: string[],
    deliveryZone: string,
    userId: string,
  ) {
    if (!invoiceIds || invoiceIds.length === 0) {
      throw new BadRequestException(
        'At least one invoice ID is required for batch waybill generation.',
      );
    }

    const uniqueIds = Array.from(new Set(invoiceIds));

    // Verify all invoices belong to the company (supports matching either Invoice.id or Document.id)
    const invoices = await this.prisma.invoice.findMany({
      where: {
        OR: [{ id: { in: uniqueIds } }, { documentId: { in: uniqueIds } }],
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

    if (invoices.length !== uniqueIds.length) {
      throw new NotFoundException('One or more invoices were not found or unauthorized.');
    }

    const year = new Date().getFullYear();
    const manifestCode = `MWB-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Master Manifest Record
      const masterWaybill = await tx.masterWaybill.create({
        data: {
          companyId,
          manifestCode,
          deliveryZone: deliveryZone.trim(),
          status: 'DISPATCH_READY',
          createdBy: userId,
        },
      });

      // 2. Generate individual Waybills for each invoice and link to Master Manifest
      const createdWaybills = [];
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        const invoiceDoc = invoice.document;
        const trackingCode = `WB-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}-${i + 1}`;

        const documentNumber = this.numberingService
          ? await this.numberingService.getNextDocumentNumber(
              tx,
              companyId,
              DocumentType.WAYBILL,
            )
          : `WB-${year}-${Math.floor(100000 + Math.random() * 900000)}-${i + 1}`;

        const company = (invoiceDoc as any)?.company;
        const client = (invoiceDoc as any)?.client;
        const defaultAddress =
          client?.addresses?.find((a: any) => a.isDefault) || client?.addresses?.[0];

        const originAddress =
          company?.address || 'Main Dispatch Warehouse, Lagos, Nigeria';
        const destinationAddress = defaultAddress
          ? `${defaultAddress.addressLine1}, ${defaultAddress.city}, ${defaultAddress.state}`
          : `Delivery Zone: ${deliveryZone}`;

        const parentDoc = await tx.document.create({
          data: {
            companyId,
            clientId: invoiceDoc?.clientId || null,
            branchId: invoiceDoc?.branchId || null,
            departmentId: invoiceDoc?.departmentId || null,
            documentType: DocumentType.WAYBILL,
            documentNumber,
            title: `Batch Waybill (${manifestCode}) for ${invoiceDoc?.documentNumber || invoice.id}`,
            status: DocumentStatus.ISSUED,
            currency: invoice.currency || invoiceDoc?.currency || 'NGN',
            exchangeRate:
              invoice.exchangeRate || invoiceDoc?.exchangeRate || new Prisma.Decimal(1),
            createdById: userId,
          },
        });

        const waybill = await tx.waybill.create({
          data: {
            companyId,
            documentId: parentDoc.id,
            invoiceId: invoice.id,
            masterWaybillId: masterWaybill.id,
            currency: invoice.currency || invoiceDoc?.currency || 'NGN',
            exchangeRate:
              invoice.exchangeRate || invoiceDoc?.exchangeRate || new Prisma.Decimal(1),
            trackingCode,
            trackingNumber: trackingCode,
            deliveryStatus: WaybillDeliveryStatus.PREPARING,
            originAddress,
            destinationAddress,
            consignorSnapshot: {
              name: company?.name || 'AOA 77 Logistics',
              address: originAddress,
            },
            consigneeSnapshot: {
              name: client?.name || 'Client / Customer',
              address: destinationAddress,
              deliveryZone,
            },
            ...(invoice.items && invoice.items.length > 0
              ? {
                  items: {
                    create: invoice.items.map((item: any, idx: number) => ({
                      lineNumber: item.lineNumber ?? idx + 1,
                      description: item.description,
                      quantity: new Prisma.Decimal(item.quantity.toString()),
                      unit: item.unit || 'Unit',
                    })),
                  },
                }
              : {}),
          },
          include: { document: true, invoice: true, items: true },
        });

        createdWaybills.push(waybill);
      }

      this.logger.log(
        `Created MasterWaybill manifest "${manifestCode}" (${deliveryZone}) with ${createdWaybills.length} waybills.`,
      );

      return {
        masterWaybill,
        totalWaybillsGenerated: createdWaybills.length,
        waybills: createdWaybills,
      };
    });
  }
}

