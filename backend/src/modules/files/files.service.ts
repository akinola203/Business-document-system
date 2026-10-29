import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LocalStorageService } from './storage/local-storage.service';
import { FileCategory } from '@prisma/client';
import { UploadFileDto } from './dto/upload-file.dto';

// Permitted MIME types and their canonical extensions
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Megabytes

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validates file binary signature (magic bytes) against declared MIME type.
   */
  private validateMagicBytes(buffer: Buffer, mime: string): boolean {
    if (!buffer || buffer.length === 0) return false;

    switch (mime) {
      case 'application/pdf':
        // %PDF (0x25 0x50 0x44 0x46)
        return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]));
      case 'image/png':
        // \x89PNG\r\n\x1a\n
        return (
          buffer.length >= 8 &&
          buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        );
      case 'image/jpeg':
        // \xff\xd8\xff
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case 'image/webp':
        // RIFF....WEBP
        return (
          buffer.length >= 12 &&
          buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buffer.subarray(8, 12).toString('ascii') === 'WEBP'
        );
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // PK\x03\x04 (ZIP container)
        return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      case 'application/msword':
      case 'application/vnd.ms-excel':
        // D0 CF 11 E0 (OLE) or PK\x03\x04
        return (
          buffer.length >= 4 &&
          (buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) ||
            buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
        );
      case 'text/plain':
      case 'text/csv':
      case 'image/svg+xml':
        // Text types: must not contain binary null bytes in first 512 bytes
        const sample = buffer.subarray(0, Math.min(buffer.length, 512));
        return !sample.includes(0x00);
      default:
        return true;
    }
  }

  /**
   * Sanitizes original filename to prevent directory traversal, control characters, or script injection.
   */
  private sanitizeFilename(name: string): string {
    const base = path.basename(name);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Uploads and stores a binary file asset linked to a company, computing SHA-256 checksum.
   */
  async uploadFile(
    companyId: string,
    file: Express.Multer.File,
    dto: UploadFileDto,
    actorId: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file content uploaded.');
    }

    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    const validExtensions = ALLOWED_MIME_TYPES[mime];

    if (!validExtensions) {
      throw new BadRequestException(`Unsupported file MIME type: "${file.mimetype}".`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!validExtensions.includes(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" does not match reported MIME type "${file.mimetype}".`,
      );
    }

    if (!this.validateMagicBytes(file.buffer, mime)) {
      throw new BadRequestException(
        `File binary signature (magic bytes) does not match reported MIME type "${file.mimetype}".`,
      );
    }

    const sanitizedName = this.sanitizeFilename(file.originalname);
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `${companyId}/${crypto.randomUUID()}${ext}`;

    // Verify documentId belongs to company if specified
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, companyId },
      });
      if (!doc) {
        throw new NotFoundException(`Document with ID "${dto.documentId}" not found in company.`);
      }
    }

    // Persist binary payload into storage volume
    await this.storage.putFile(storageKey, file.buffer, mime);

    // Record metadata in database
    const fileRecord = await this.prisma.file.create({
      data: {
        companyId,
        documentId: dto.documentId,
        originalFilename: sanitizedName,
        storageKey,
        mimeType: mime,
        sizeBytes: BigInt(file.buffer.length),
        fileCategory: dto.fileCategory || FileCategory.ATTACHMENT,
        checksumSha256,
        isPublic: false,
        createdById: actorId,
      },
    });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'FILE_UPLOADED',
      entityType: 'File',
      entityId: fileRecord.id,
      newValues: {
        originalFilename: sanitizedName,
        category: fileRecord.fileCategory,
        sizeBytes: fileRecord.sizeBytes.toString(),
        documentId: dto.documentId,
      },
    });

    this.logger.log(`File "${sanitizedName}" (${fileRecord.id}) stored for company "${companyId}" by "${actorId}".`);
    return fileRecord;
  }

  /**
   * Persists an internally generated binary buffer (e.g. Puppeteer PDF or export)
   * as a File record linked to a company and optional document.
   */
  async saveBufferAsFile(params: {
    companyId: string;
    documentId?: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    fileCategory: FileCategory;
    actorId?: string | null;
  }) {
    const { companyId, documentId, filename, buffer, mimeType, fileCategory, actorId } = params;
    const sanitizedName = this.sanitizeFilename(filename);
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(sanitizedName) || '.pdf';
    const storageKey = `${companyId}/${crypto.randomUUID()}${ext}`;

    await this.storage.putFile(storageKey, buffer, mimeType);

    const fileRecord = await this.prisma.file.create({
      data: {
        companyId,
        documentId,
        originalFilename: sanitizedName,
        storageKey,
        mimeType,
        sizeBytes: BigInt(buffer.length),
        fileCategory,
        checksumSha256,
        isPublic: false,
        createdById: actorId || 'SYSTEM',
      },
    });

    if (actorId) {
      await this.auditService.logAction({
        companyId,
        actorId,
        action: 'FILE_GENERATED',
        entityType: 'File',
        entityId: fileRecord.id,
        newValues: {
          originalFilename: sanitizedName,
          category: fileCategory,
          sizeBytes: buffer.length.toString(),
          documentId,
        },
      });
    }

    return fileRecord;
  }

  /**
   * Retrieves file record and verified readable stream with strict company isolation.
   */
  async getFileStream(companyId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, companyId },
    });

    if (!file) {
      throw new NotFoundException(`File with ID "${fileId}" not found.`);
    }

    const stream = await this.storage.getFileStream(file.storageKey);

    return {
      file,
      stream,
    };
  }

  /**
   * Retrieves raw buffer for internal rendering (e.g. embedding logos, stamps into PDF HTML).
   */
  async getFileBuffer(companyId: string, fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, companyId },
    });

    if (!file) {
      throw new NotFoundException(`File with ID "${fileId}" not found.`);
    }

    const buffer = await this.storage.getFileBuffer(file.storageKey);
    return { buffer, mimeType: file.mimeType };
  }

  /**
   * Deletes a file from storage and database.
   */
  async deleteFile(companyId: string, fileId: string, actorId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, companyId },
    });

    if (!file) {
      throw new NotFoundException(`File with ID "${fileId}" not found.`);
    }

    await this.storage.deleteFile(file.storageKey);
    await this.prisma.file.delete({ where: { id: fileId } });

    await this.auditService.logAction({
      companyId,
      actorId,
      action: 'FILE_DELETED',
      entityType: 'File',
      entityId: fileId,
      oldValues: {
        filename: file.originalFilename,
        category: file.fileCategory,
      },
    });

    this.logger.log(`File "${file.originalFilename}" (${fileId}) deleted by user "${actorId}".`);
    return { success: true, message: 'File deleted successfully.' };
  }
}
