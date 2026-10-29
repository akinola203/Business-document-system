import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { CreateLetterDto } from './dto/create-letter.dto';
import { UpdateLetterDto } from './dto/update-letter.dto';
import { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { sanitizeRichHtml } from '../templates/renderers/letter-html.renderer';
import { validateTenantScope } from '../../common/utils/tenant-validation.util';

@Injectable()
export class LettersService {
  private readonly logger = new Logger(LettersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Creates a new business letter / letterhead in DRAFT status with sequential reference code.
   */
  async createDraft(companyId: string, dto: CreateLetterDto, actorId: string) {
    await validateTenantScope(this.prisma, companyId, {
      clientId: dto.clientId,
      branchId: dto.branchId,
      departmentId: dto.departmentId,
      templateId: dto.templateId,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const documentNumber = await this.numberingService.getNextDocumentNumber(
        tx,
        companyId,
        DocumentType.LETTER,
      );

      const document = await tx.document.create({
        data: {
          companyId,
          clientId: dto.clientId,
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          documentType: DocumentType.LETTER,
          documentNumber,
          title: dto.title.trim(),
          status: DocumentStatus.DRAFT,
          issueDate: dto.letterDate ? new Date(dto.letterDate) : new Date(),
          createdById: actorId,
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
        },
      });

      const bodyText = dto.bodyText?.trim() || dto.bodyHtml?.replace(/<[^>]+>/g, ' ').trim() || '';
      const bodyHtml = dto.bodyHtml ? sanitizeRichHtml(dto.bodyHtml.trim()) : `<p>${bodyText}</p>`;

      await tx.letter.create({
        data: {
          documentId: document.id,
          letterDate: dto.letterDate ? new Date(dto.letterDate) : new Date(),
          recipientName: dto.recipientName.trim(),
          recipientTitle: dto.recipientTitle?.trim(),
          recipientOrganization: dto.recipientOrganization?.trim(),
          recipientAddress: dto.recipientAddress?.trim(),
          subject: dto.subject.trim(),
          bodyHtml,
          bodyText,
          signatoryName: dto.signatoryName.trim(),
          signatoryTitle: dto.signatoryTitle?.trim(),
          signatoryDepartment: dto.signatoryDepartment?.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'LETTER_CREATED',
          entityType: 'Document',
          entityId: document.id,
          newValues: {
            documentNumber: document.documentNumber,
            recipientName: dto.recipientName,
            subject: dto.subject,
          },
        },
      });

      return document;
    });

    this.logger.log(`Draft letter "${created.documentNumber}" created by user "${actorId}".`);
    return this.findOne(companyId, created.id);
  }

  /**
   * Updates an editable draft letter.
   */
  async updateDraft(companyId: string, id: string, dto: UpdateLetterDto, actorId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.LETTER },
      include: { letter: true },
    });

    if (!document || !document.letter) {
      throw new NotFoundException(`Letter with ID "${id}" not found.`);
    }

    if (
      document.status !== DocumentStatus.DRAFT &&
      document.status !== DocumentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Only DRAFT or REJECTED letters can be edited. Current status is ${document.status}.`,
      );
    }

    // Validate foreign keys belong to caller company if updated
    await validateTenantScope(this.prisma, companyId, {
      templateId: dto.templateId,
    });

    // Optimistic Concurrency Control Check
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document has been modified by another user or session. Current version is ${document.versionCounter}. Please refresh and review latest changes before reapplying edits.`,
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
          'Letter was concurrently modified or is not in an editable status (DRAFT or REJECTED).',
        );
      }

      await tx.document.update({
        where: { id: document.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          issueDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
          templateId: dto.templateId,
          templateVersionId: dto.templateVersionId,
        },
      });

      await tx.letter.update({
        where: { id: document.letter!.id },
        data: {
          letterDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
          recipientName: dto.recipientName !== undefined ? dto.recipientName.trim() : undefined,
          recipientTitle: dto.recipientTitle !== undefined ? dto.recipientTitle?.trim() : undefined,
          recipientOrganization: dto.recipientOrganization !== undefined ? dto.recipientOrganization?.trim() : undefined,
          recipientAddress: dto.recipientAddress !== undefined ? dto.recipientAddress?.trim() : undefined,
          subject: dto.subject !== undefined ? dto.subject.trim() : undefined,
          bodyHtml: dto.bodyHtml !== undefined
            ? sanitizeRichHtml(dto.bodyHtml.trim())
            : dto.bodyText !== undefined
              ? `<p>${dto.bodyText.trim()}</p>`
              : undefined,
          bodyText: dto.bodyText !== undefined
            ? dto.bodyText.trim()
            : dto.bodyHtml !== undefined
              ? dto.bodyHtml.replace(/<[^>]+>/g, ' ').trim()
              : undefined,
          signatoryName: dto.signatoryName !== undefined ? dto.signatoryName.trim() : undefined,
          signatoryTitle: dto.signatoryTitle !== undefined ? dto.signatoryTitle?.trim() : undefined,
          signatoryDepartment: dto.signatoryDepartment !== undefined ? dto.signatoryDepartment?.trim() : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          actorId,
          action: 'LETTER_UPDATED',
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
   * Issues a letter, creating an immutable frozen snapshot.
   */
  async issue(companyId: string, id: string, actorId: string) {
    const document = await this.findOne(companyId, id);

    if (document.status === DocumentStatus.ISSUED || document.status === DocumentStatus.CANCELLED) {
      throw new BadRequestException(`Cannot issue a letter in status ${document.status}.`);
    }

    const issued = await this.prisma.$transaction(async (tx) => {
      const snapshot = {
        documentNumber: document.documentNumber,
        title: document.title,
        letterDate: document.letter?.letterDate,
        recipientName: document.letter?.recipientName,
        recipientTitle: document.letter?.recipientTitle,
        recipientOrganization: document.letter?.recipientOrganization,
        recipientAddress: document.letter?.recipientAddress,
        subject: document.letter?.subject,
        bodyHtml: document.letter?.bodyHtml,
        bodyText: document.letter?.bodyText,
        signatoryName: document.letter?.signatoryName,
        signatoryTitle: document.letter?.signatoryTitle,
        signatoryDepartment: document.letter?.signatoryDepartment,
        issuedAt: new Date().toISOString(),
      };

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
          snapshotData: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
          createdById: actorId,
          changeReason: 'Letter Official Issuance',
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
          action: 'LETTER_ISSUED',
          entityType: 'Document',
          entityId: document.id,
          newValues: { versionNumber, versionId: version.id },
        },
      });

      return updated;
    });

    this.logger.log(`Letter "${document.documentNumber}" issued by user "${actorId}".`);
    return this.findOne(companyId, issued.id);
  }

  /**
   * Helper to retrieve full letter record.
   */
  async findOne(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, documentType: DocumentType.LETTER },
      include: {
        client: true,
        branch: true,
        department: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        letter: true,
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    if (!document) {
      throw new NotFoundException(`Letter with ID "${id}" not found.`);
    }

    return document;
  }
}
