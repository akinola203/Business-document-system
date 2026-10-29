import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { TemplatesService } from '../templates/templates.service';
import { FileCategory } from '@prisma/client';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browserInstance: Browser | null = null;
  private isLaunching = false;
  private activePageCount = 0;
  private readonly maxConcurrentPages = 3;
  private readonly waitingQueue: Array<() => void> = [];
  private readonly generatingPdfs = new Map<
    string,
    Promise<{ fileId: string; filename: string; buffer?: Buffer; storageKey?: string }>
  >();

  private async acquirePageSlot(): Promise<void> {
    if (this.activePageCount < this.maxConcurrentPages) {
      this.activePageCount++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
    this.activePageCount++;
  }

  private releasePageSlot(): void {
    this.activePageCount--;
    const next = this.waitingQueue.shift();
    if (next) {
      next();
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
    private readonly templatesService: TemplatesService,
  ) {}

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  /**
   * Lazily initializes and reuses a shared Chromium browser instance with crash recovery.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browserInstance && this.browserInstance.connected) {
      return this.browserInstance;
    }

    if (this.isLaunching) {
      // Wait for launch if concurrent requests trigger initialization
      while (this.isLaunching) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (this.browserInstance && this.browserInstance.connected) {
        return this.browserInstance;
      }
    }

    this.isLaunching = true;
    try {
      this.logger.log('Initializing shared Puppeteer headless browser instance...');
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=medium',
      ];

      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

      this.browserInstance = await puppeteer.launch({
        headless: true,
        args,
        executablePath,
      });

      this.browserInstance.on('disconnected', () => {
        this.logger.warn('Puppeteer browser disconnected. Discarding cached instance.');
        this.browserInstance = null;
      });

      this.logger.log('Puppeteer headless browser successfully initialized.');
      return this.browserInstance;
    } catch (err: any) {
      this.logger.error(`Failed to launch Puppeteer browser: ${err.message}`, err.stack);
      throw new Error(`Puppeteer browser initialization failed: ${err.message}`);
    } finally {
      this.isLaunching = false;
    }
  }

  /**
   * Gracefully shuts down the browser process.
   */
  private async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      try {
        await this.browserInstance.close();
        this.logger.log('Puppeteer browser process gracefully closed.');
      } catch (err: any) {
        this.logger.error(`Error closing browser: ${err.message}`);
      } finally {
        this.browserInstance = null;
      }
    }
  }

  /**
   * Compiles sanitized HTML into a standard A4 PDF buffer using headless Chromium.
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    await this.acquirePageSlot();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const url = req.url();
          if (url.startsWith('data:') || url === 'about:blank') {
            req.continue();
          } else {
            req.abort();
          }
        });

        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
        await page.setContent(html, {
          waitUntil: ['load', 'domcontentloaded'],
          timeout: 30000,
        });

        const pdfUint8Array = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: {
            top: '0mm',
            bottom: '0mm',
            left: '0mm',
            right: '0mm',
          },
        });

        return Buffer.from(pdfUint8Array);
      } catch (err: any) {
        this.logger.error(`Puppeteer PDF compilation failed: ${err.message}`, err.stack);
        throw new BadRequestException(`Failed to compile document PDF: ${err.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    } finally {
      this.releasePageSlot();
    }
  }

  /**
   * Generates a preview PDF buffer for a draft document on-the-fly without database persistence.
   */
  async previewDocumentPdf(companyId: string, documentId: string): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID "${documentId}" not found.`);
    }

    const html = await this.templatesService.renderDocumentHtml(companyId, documentId);
    const buffer = await this.generatePdfFromHtml(html);
    const safeDocNum = doc.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');

    return {
      buffer,
      filename: `PREVIEW_${safeDocNum}.pdf`,
    };
  }

  /**
   * Generates or retrieves the immutable, version-associated PDF for a document.
   * If a PDF already exists for the targeted DocumentVersion, returns the cached file stream.
   * Otherwise, compiles the frozen version snapshot into PDF, stores in file storage,
   * associates it with DocumentVersion.pdfFileId, and records an audit log.
   */
  async getOrGenerateDocumentPdf(
    companyId: string,
    documentId: string,
    versionNumber?: number,
    actorId?: string,
  ): Promise<{ fileId: string; filename: string; buffer?: Buffer; storageKey?: string }> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID "${documentId}" not found.`);
    }

    // Resolve target version
    let targetVersion = versionNumber !== undefined
      ? doc.versions.find((v) => v.versionNumber === versionNumber)
      : doc.versions[0];

    // If document has no versions yet (e.g. draft), generate preview buffer
    if (!targetVersion) {
      const html = await this.templatesService.renderDocumentHtml(companyId, documentId);
      const buffer = await this.generatePdfFromHtml(html);
      const safeDocNum = doc.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      return {
        fileId: 'draft-preview',
        filename: `${safeDocNum}_draft.pdf`,
        buffer,
      };
    }

    // Check if target version already has an immutable PDF associated
    if (targetVersion.pdfFileId) {
      const existingFile = await this.prisma.file.findFirst({
        where: { id: targetVersion.pdfFileId, companyId },
      });

      if (existingFile) {
        this.logger.log(
          `Serving existing PDF file "${existingFile.originalFilename}" (${existingFile.id}) for document "${doc.documentNumber}" v${targetVersion.versionNumber}.`,
        );
        return {
          fileId: existingFile.id,
          filename: existingFile.originalFilename,
          storageKey: existingFile.storageKey,
        };
      }
    }

    // Guard against concurrent PDF generation for the same document version using in-memory mutex promise
    const generationKey = `${companyId}:${documentId}:${targetVersion.versionNumber}`;
    const inFlightGeneration = this.generatingPdfs.get(generationKey);
    if (inFlightGeneration) {
      this.logger.log(`Awaiting in-flight PDF generation for key ${generationKey}...`);
      return inFlightGeneration;
    }

    const generationTask = (async () => {
      // Generate PDF from the frozen version snapshot HTML
      this.logger.log(
        `Generating new immutable PDF for document "${doc.documentNumber}" v${targetVersion.versionNumber}...`,
      );
      const html = await this.templatesService.renderDocumentHtml(
        companyId,
        documentId,
        targetVersion.versionNumber,
      );
      const pdfBuffer = await this.generatePdfFromHtml(html);

      const safeDocNum = doc.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeDocNum}_v${targetVersion.versionNumber}.pdf`;

      // Persist binary payload into storage volume and register File
      const fileRecord = await this.filesService.saveBufferAsFile({
        companyId,
        documentId: doc.id,
        filename,
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
        fileCategory: FileCategory.GENERATED_PDF,
        actorId,
      });

      // Associate generated PDF file with the DocumentVersion
      await this.prisma.documentVersion.update({
        where: { id: targetVersion.id },
        data: { pdfFileId: fileRecord.id },
      });

      if (actorId) {
        await this.auditService.logAction({
          companyId,
          actorId,
          action: 'DOCUMENT_PDF_GENERATED',
          entityType: 'Document',
          entityId: doc.id,
          newValues: {
            documentNumber: doc.documentNumber,
            versionNumber: targetVersion.versionNumber,
            fileId: fileRecord.id,
            filename,
          },
        });
      }

      this.logger.log(
        `Generated and linked PDF "${filename}" (${fileRecord.id}) to Document "${doc.documentNumber}" v${targetVersion.versionNumber}.`,
      );

      return {
        fileId: fileRecord.id,
        filename: fileRecord.originalFilename,
        buffer: pdfBuffer,
        storageKey: fileRecord.storageKey,
      };
    })();

    this.generatingPdfs.set(generationKey, generationTask);
    try {
      return await generationTask;
    } finally {
      this.generatingPdfs.delete(generationKey);
    }
  }
}
