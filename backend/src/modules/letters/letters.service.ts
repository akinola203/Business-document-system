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

      await tx.letter.create({
        data: {
          documentId: document.id,
          letterDate: dto.letterDate ? new Date(dto.letterDate) : new Date(),
          recipientName: dto.recipientName.trim(),
          recipientTitle: dto.recipientTitle?.trim(),
          recipientOrganization: dto.recipientOrganization?.trim(),
          recipientAddress: dto.recipientAddress?.trim(),
          subject: dto.subject.trim(),
          bodyHtml: dto.bodyHtml.trim(),
          bodyText: dto.bodyText.trim(),
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

    if (document.status !== DocumentStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT letters can be edited. Current status is ${document.status}.`,
      );
    }

    // Optimistic Concurrency Control Check
    if (dto.expectedVersion !== undefined && document.versionCounter !== dto.expectedVersion) {
      throw new ConflictException(
        `Document has been modified by another user or session. Current version is ${document.versionCounter}. Please refresh and review latest changes before reapplying edits.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: document.id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          issueDate: dto.letterDate ? new Date(dto.letterDate) : undefined,
          versionCounter: { increment: 1 },
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
          bodyHtml: dto.bodyHtml !== undefined ? dto.bodyHtml.trim() : undefined,
          bodyText: dto.bodyText !== undefined ? dto.bodyText.trim() : undefined,
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

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          snapshotData: snapshot as unknown as Prisma.InputJsonValue,
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
          newValues: { versionNumber: 1, versionId: version.id },
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
