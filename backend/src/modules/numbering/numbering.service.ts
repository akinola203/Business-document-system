import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, Prisma } from '@prisma/client';

@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Allocates the next transaction-safe, sequential document number within an active database transaction.
   * Row-level locking or atomic sequence increment ensures zero collisions under concurrent requests.
   */
  async getNextDocumentNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    documentType: DocumentType,
  ): Promise<string> {
    const currentYear = new Date().getFullYear();

    // 1. Find or initialize the sequence counter for this year
    let sequence = await tx.documentNumberSequence.findUnique({
      where: {
        companyId_documentType_resetYear: {
          companyId,
          documentType,
          resetYear: currentYear,
        },
      },
    });

    if (!sequence) {
      // Fallback defaults based on document type
      let defaultPrefix = 'DOC';
      let defaultPadding = 6;

      if (documentType === DocumentType.INVOICE) {
        defaultPrefix = 'INV';
        defaultPadding = 6;
      } else if (documentType === DocumentType.WAYBILL) {
        defaultPrefix = 'WB';
        defaultPadding = 6;
      } else if (documentType === DocumentType.LETTER) {
        defaultPrefix = 'AOA/LET';
        defaultPadding = 4;
      }

      const priorSequence = await tx.documentNumberSequence.findFirst({
        where: { companyId, documentType },
        orderBy: { resetYear: 'desc' },
        select: { prefix: true, padding: true },
      });

      const prefix = priorSequence?.prefix ?? defaultPrefix;
      const padding = priorSequence?.padding ?? defaultPadding;

      sequence = await tx.documentNumberSequence.upsert({
        where: {
          companyId_documentType_resetYear: {
            companyId,
            documentType,
            resetYear: currentYear,
          },
        },
        update: {},
        create: {
          companyId,
          documentType,
          prefix,
          currentNumber: 0,
          padding,
          resetYear: currentYear,
        },
      });
    }

    // 2. Atomically increment the sequence counter
    const updatedSequence = await tx.documentNumberSequence.update({
      where: { id: sequence.id },
      data: {
        currentNumber: { increment: 1 },
      },
    });

    const paddedNumber = String(updatedSequence.currentNumber).padStart(
      updatedSequence.padding,
      '0',
    );

    // 3. Format according to prefix conventions (slash vs dash)
    let formattedNumber: string;
    if (updatedSequence.prefix.includes('/')) {
      formattedNumber = `${updatedSequence.prefix}/${currentYear}/${paddedNumber}`;
    } else {
      formattedNumber = `${updatedSequence.prefix}-${currentYear}-${paddedNumber}`;
    }

    this.logger.debug(
      `Allocated document number "${formattedNumber}" for type ${documentType} (Company: ${companyId})`,
    );

    return formattedNumber;
  }
}
