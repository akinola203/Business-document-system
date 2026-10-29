import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentType } from '@prisma/client';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import {
  renderInvoiceHtml,
  InvoiceRenderContext,
  renderWaybillHtml,
  WaybillRenderContext,
  renderLetterHtml,
  LetterRenderContext,
} from './renderers';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves all templates for a tenant company, optionally filtered by document type.
   */
  async findAll(companyId: string, documentType?: DocumentType) {
    return this.prisma.template.findMany({
      where: {
        companyId,
        ...(documentType ? { documentType } : {}),
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieves single template and all its immutable historical versions.
   */
  async findOne(companyId: string, id: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, companyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID "${id}" not found.`);
    }

    return template;
  }

  /**
   * Creates a new template and its initial TemplateVersion (v1) in an atomic transaction.
   */
  async create(companyId: string, dto: CreateTemplateDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate code in company
      const existing = await tx.template.findUnique({
        where: { companyId_code: { companyId, code: dto.code } },
      });
      if (existing) {
        throw new BadRequestException(
          `Template code "${dto.code}" already exists for this company.`,
        );
      }

      // If set as default, clear default flag from other templates of this document type
      if (dto.isDefault) {
        await tx.template.updateMany({
          where: { companyId, documentType: dto.documentType, isDefault: true },
          data: { isDefault: false },
        });
      }

      const template = await tx.template.create({
        data: {
          companyId,
          documentType: dto.documentType,
          name: dto.name,
          code: dto.code,
          isDefault: dto.isDefault ?? false,
          isActive: true,
          versions: {
            create: {
              versionNumber: 1,
              layoutEngine: 'PUPPETEER_HTML',
              htmlStructure: dto.htmlStructure,
              cssStyles: dto.cssStyles,
              schemaConfig: dto.schemaConfig ?? {},
              createdById: actorId,
              isActive: true,
            },
          },
        },
        include: {
          versions: true,
        },
      });

      await this.auditService.logAction({
        companyId,
        actorId,
        action: 'TEMPLATE_CREATED',
        entityType: 'Template',
        entityId: template.id,
        newValues: {
          name: template.name,
          code: template.code,
          documentType: template.documentType,
          initialVersion: 1,
        },
      });

      this.logger.log(`Created template "${template.code}" (v1) for company "${companyId}".`);
      return template;
    });
  }

  /**
   * Updates template metadata and optionally publishes an immutable new TemplateVersion.
   */
  async update(companyId: string, id: string, dto: UpdateTemplateDto, actorId: string) {
    const existing = await this.prisma.template.findFirst({
      where: { id, companyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Template with ID "${id}" not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.template.updateMany({
          where: { companyId, documentType: existing.documentType, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const hasContentChange =
        dto.htmlStructure !== undefined ||
        dto.cssStyles !== undefined ||
        dto.schemaConfig !== undefined;

      let nextVersionNumber = (existing.versions[0]?.versionNumber ?? 0) + 1;

      const template = await tx.template.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
          ...(hasContentChange
            ? {
                versions: {
                  create: {
                    versionNumber: nextVersionNumber,
                    layoutEngine: 'PUPPETEER_HTML',
                    htmlStructure: dto.htmlStructure ?? existing.versions[0]?.htmlStructure ?? '',
                    cssStyles: dto.cssStyles ?? existing.versions[0]?.cssStyles ?? '',
                    schemaConfig: dto.schemaConfig ?? (existing.versions[0]?.schemaConfig as any) ?? {},
                    createdById: actorId,
                    isActive: true,
                  },
                },
              }
            : {}),
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      await this.auditService.logAction({
        companyId,
        actorId,
        action: 'TEMPLATE_UPDATED',
        entityType: 'Template',
        entityId: template.id,
        newValues: {
          name: template.name,
          isDefault: template.isDefault,
          isActive: template.isActive,
          newVersionPublished: hasContentChange ? nextVersionNumber : null,
        },
      });

      return template;
    });
  }

  /**
   * Renders the authoritative printable HTML representation of a document.
   * If a versionNumber is provided or the document is approved/issued with historical snapshots,
   * it guarantees the HTML reflects the exact frozen snapshot.
   */
  async renderDocumentHtml(
    companyId: string,
    documentId: string,
    versionNumber?: number,
  ): Promise<string> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: {
        company: {
          include: {
            settings: true,
          },
        },
        client: {
          include: {
            addresses: true,
          },
        },
        invoice: {
          include: {
            items: {
              orderBy: { lineNumber: 'asc' },
            },
          },
        },
        waybill: {
          include: {
            items: {
              orderBy: { lineNumber: 'asc' },
            },
          },
        },
        letter: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID "${documentId}" not found.`);
    }

    // Determine if we should render from a frozen snapshot
    let snapshot: any = null;

    if (versionNumber !== undefined) {
      const targetVersion = doc.versions.find((v) => v.versionNumber === versionNumber);
      if (!targetVersion) {
        throw new NotFoundException(
          `Document version ${versionNumber} does not exist for document "${documentId}".`,
        );
      }
      snapshot = targetVersion.snapshotData;
    } else if (
      (doc.status === 'APPROVED' || doc.status === 'ISSUED') &&
      doc.versions.length > 0
    ) {
      snapshot = doc.versions[0].snapshotData;
    }

    switch (doc.documentType) {
      case DocumentType.INVOICE:
        return this.buildInvoiceHtml(doc, snapshot);
      case DocumentType.WAYBILL:
        return this.buildWaybillHtml(doc, snapshot);
      case DocumentType.LETTER:
        return this.buildLetterHtml(doc, snapshot);
      default:
        throw new BadRequestException(`Unsupported document type: "${doc.documentType}".`);
    }
  }

  private buildInvoiceHtml(doc: any, snapshot: any): string {
    const comp = doc.company;
    const settings = comp?.settings;
    const inv = doc.invoice;
    const client = doc.client;

    const resolveClientAddress = (cl: any, addrId?: string) => {
      if (!cl) return null;
      if (cl.addresses && Array.isArray(cl.addresses) && cl.addresses.length > 0) {
        const match =
          (addrId ? cl.addresses.find((a: any) => a.id === addrId) : null) ||
          cl.addresses.find((a: any) => a.isDefault) ||
          cl.addresses[0];
        if (match) {
          return [
            match.addressLine1 || match.line1,
            match.addressLine2 || match.line2,
            match.city,
            match.state,
            match.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      }
      return cl.address || null;
    };

    if (snapshot) {
      const snapDoc = snapshot.document || doc;
      const snapComp = snapshot.company || comp;
      const snapSettings = snapComp.settings || settings;
      const snapInv = snapshot.invoice || inv;
      const snapClient = snapshot.client || client;
      const snapAddressId = (snapDoc.metadata as any)?.selectedAddressId || (doc.metadata as any)?.selectedAddressId;

      const ctx: InvoiceRenderContext = {
        company: {
          name: snapComp.name,
          legalName: snapComp.legalName,
          rcNumber: snapComp.rcNumber,
          tin: snapComp.tin,
          address: snapComp.address,
          email: snapComp.email,
          phone: snapComp.phone,
          settings: snapSettings,
        },
        documentNumber: snapDoc.documentNumber,
        title: snapDoc.title,
        issueDate: snapDoc.issueDate,
        status: snapDoc.status,
        paymentStatus: snapDoc.paymentStatus,
        currency: snapDoc.currency,
        subtotal: (snapDoc.subtotal ?? snapDoc.subtotalAmount ?? 0).toString(),
        taxAmount: (snapDoc.taxAmount ?? 0).toString(),
        discountAmount: (snapDoc.discountAmount ?? 0).toString(),
        totalAmount: (snapDoc.totalAmount ?? 0).toString(),
        balanceDue: (snapDoc.balanceDue ?? 0).toString(),
        client: {
          name: snapClient?.name || 'Walk-in Client',
          companyName: snapClient?.companyName,
          email: snapClient?.email,
          phone: snapClient?.phone,
          address: resolveClientAddress(snapClient, snapAddressId),
        },
        invoice: {
          poNumber: snapInv?.poNumber,
          paymentTerms: snapInv?.paymentTerms,
          dueDate: snapInv?.dueDate,
          notes: snapInv?.notes,
          items: (snapInv?.items || []).map((item: any, idx: number) => ({
            lineNumber: item.lineNumber || idx + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            lineGross: item.lineGross || Number(item.quantity) * Number(item.unitPrice),
            discountAmount: item.discountAmount || 0,
            taxAmount: item.taxAmount || 0,
            lineTotal: item.lineTotal,
          })),
        },
      };

      return renderInvoiceHtml(ctx);
    }

    // Live database render context
    const selectedAddressId = (doc.metadata as any)?.selectedAddressId;
    const ctx: InvoiceRenderContext = {
      company: {
        name: comp.name,
        legalName: comp.legalName,
        rcNumber: comp.rcNumber,
        tin: comp.tin,
        address: comp.address,
        email: comp.email,
        phone: comp.phone,
        settings,
      },
      documentNumber: doc.documentNumber,
      title: doc.title,
      issueDate: doc.issueDate,
      status: doc.status,
      paymentStatus: doc.paymentStatus,
      currency: doc.currency,
      subtotal: (doc.subtotal ?? doc.subtotalAmount ?? 0).toString(),
      taxAmount: (doc.taxAmount ?? 0).toString(),
      discountAmount: (doc.discountAmount ?? 0).toString(),
      totalAmount: (doc.totalAmount ?? 0).toString(),
      balanceDue: (doc.balanceDue ?? 0).toString(),
      client: {
        name: client?.name || 'Walk-in Client',
        companyName: client?.companyName,
        email: client?.email,
        phone: client?.phone,
        address: resolveClientAddress(client, selectedAddressId),
      },
      invoice: {
        poNumber: inv?.poNumber,
        paymentTerms: inv?.paymentTerms,
        dueDate: inv?.dueDate,
        notes: inv?.notes,
        items: (inv?.items || []).map((item: any) => ({
          lineNumber: item.lineNumber,
          description: item.description,
          quantity: (item.quantity ?? 0).toString(),
          unit: item.unit,
          unitPrice: (item.unitPrice ?? 0).toString(),
          lineGross: (Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2),
          discountAmount: item.discountPercent ? ((Number(item.unitPrice || 0) * Number(item.quantity || 0) * Number(item.discountPercent)) / 100).toFixed(2) : (item.discountAmount ? Number(item.discountAmount).toFixed(2) : '0.00'),
          taxAmount: (item.taxAmount ?? 0).toString(),
          lineTotal: (item.lineTotal ?? 0).toString(),
        })),
      },
    };

    return renderInvoiceHtml(ctx);
  }

  private buildWaybillHtml(doc: any, snapshot: any): string {
    const comp = doc.company;
    const wb = doc.waybill;
    const client = doc.client;

    if (snapshot) {
      const snapDoc = snapshot.document || doc;
      const snapComp = snapshot.company || comp;
      const snapWb = snapshot.waybill || wb;
      const snapClient = snapshot.client || client;

      const ctx: WaybillRenderContext = {
        company: {
          name: snapComp.name,
          legalName: snapComp.legalName,
          rcNumber: snapComp.rcNumber,
          tin: snapComp.tin,
          address: snapComp.address,
          email: snapComp.email,
          phone: snapComp.phone,
        },
        documentNumber: snapDoc.documentNumber,
        title: snapDoc.title,
        issueDate: snapDoc.issueDate,
        status: snapDoc.status,
        client: {
          name: snapClient?.name || 'Consignee',
          companyName: snapClient?.companyName,
          email: snapClient?.email,
          phone: snapClient?.phone,
          address: snapClient?.address,
        },
        waybill: {
          shipmentDate: snapWb?.shipmentDate,
          originAddress: snapWb?.originAddress || snapComp.address,
          destinationAddress: snapWb?.destinationAddress || snapClient?.address || '',
          vehicleNumber: snapWb?.vehicleNumber,
          driverName: snapWb?.driverName,
          driverPhone: snapWb?.driverPhone,
          trackingNumber: snapWb?.trackingNumber,
          deliveryStatus: snapWb?.deliveryStatus || 'PREPARING',
          receivedByName: snapWb?.receivedByName,
          receivedDate: snapWb?.receivedDate,
          items: (snapWb?.items || []).map((item: any, idx: number) => ({
            lineNumber: item.lineNumber || idx + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            weightKg: item.weightKg,
            packageCount: item.packageCount,
            packageType: item.packageType,
          })),
        },
      };

      return renderWaybillHtml(ctx);
    }

    const ctx: WaybillRenderContext = {
      company: {
        name: comp.name,
        legalName: comp.legalName,
        rcNumber: comp.rcNumber,
        tin: comp.tin,
        address: comp.address,
        email: comp.email,
        phone: comp.phone,
      },
      documentNumber: doc.documentNumber,
      title: doc.title,
      issueDate: doc.issueDate,
      status: doc.status,
      client: {
        name: client?.name || 'Consignee',
        companyName: client?.companyName,
        email: client?.email,
        phone: client?.phone,
        address: client?.address,
      },
      waybill: {
        shipmentDate: wb?.shipmentDate,
        originAddress: wb?.originAddress || comp.address,
        destinationAddress: wb?.destinationAddress || client?.address || '',
        vehicleNumber: wb?.vehicleNumber,
        driverName: wb?.driverName,
        driverPhone: wb?.driverPhone,
        trackingNumber: wb?.trackingNumber,
        deliveryStatus: wb?.deliveryStatus || 'PREPARING',
        receivedByName: wb?.receivedByName,
        receivedDate: wb?.receivedDate,
        items: (wb?.items || []).map((item: any) => ({
          lineNumber: item.lineNumber,
          description: item.description,
          quantity: (item.quantity ?? 0).toString(),
          unit: item.unit,
          weightKg: item.weightKg ? item.weightKg.toString() : null,
          packageCount: item.packageCount,
          packageType: item.packageType,
        })),
      },
    };

    return renderWaybillHtml(ctx);
  }

  private buildLetterHtml(doc: any, snapshot: any): string {
    const comp = doc.company;
    const letData = doc.letter;

    if (snapshot) {
      const snapDoc = snapshot.document || doc;
      const snapComp = snapshot.company || comp;
      const snapLet = snapshot.letter || letData;

      const ctx: LetterRenderContext = {
        company: {
          name: snapComp.name,
          legalName: snapComp.legalName,
          rcNumber: snapComp.rcNumber,
          tin: snapComp.tin,
          address: snapComp.address,
          email: snapComp.email,
          phone: snapComp.phone,
          website: snapComp.website,
        },
        documentNumber: snapDoc.documentNumber,
        title: snapDoc.title,
        issueDate: snapDoc.issueDate,
        status: snapDoc.status,
        letter: {
          letterDate: snapLet?.letterDate || snapDoc.issueDate,
          recipientName: snapLet?.recipientName || 'Recipient',
          recipientTitle: snapLet?.recipientTitle,
          recipientOrganization: snapLet?.recipientOrganization,
          recipientAddress: snapLet?.recipientAddress,
          subject: snapLet?.subject || snapDoc.title,
          bodyHtml: snapLet?.bodyHtml || snapLet?.bodyText || '',
          signatoryName: snapLet?.signatoryName || 'Authorized Signatory',
          signatoryTitle: snapLet?.signatoryTitle,
          signatoryDepartment: snapLet?.signatoryDepartment,
        },
      };

      return renderLetterHtml(ctx);
    }

    const ctx: LetterRenderContext = {
      company: {
        name: comp.name,
        legalName: comp.legalName,
        rcNumber: comp.rcNumber,
        tin: comp.tin,
        address: comp.address,
        email: comp.email,
        phone: comp.phone,
        website: comp.website,
      },
      documentNumber: doc.documentNumber,
      title: doc.title,
      issueDate: doc.issueDate,
      status: doc.status,
      letter: {
        letterDate: letData?.letterDate || doc.issueDate,
        recipientName: letData?.recipientName || 'Recipient',
        recipientTitle: letData?.recipientTitle,
        recipientOrganization: letData?.recipientOrganization,
        recipientAddress: letData?.recipientAddress,
        subject: letData?.subject || doc.title,
        bodyHtml: letData?.bodyHtml || letData?.bodyText || '',
        signatoryName: letData?.signatoryName || 'Authorized Signatory',
        signatoryTitle: letData?.signatoryTitle,
        signatoryDepartment: letData?.signatoryDepartment,
      },
    };

    return renderLetterHtml(ctx);
  }
}
