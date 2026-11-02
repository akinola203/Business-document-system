import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentStatus, DocumentType, FileCategory } from '@prisma/client';
import { FilesService } from '../../src/modules/files/files.service';
import { FilesController } from '../../src/modules/files/files.controller';
import { LocalStorageService } from '../../src/modules/files/storage/local-storage.service';
import { TemplatesService } from '../../src/modules/templates/templates.service';
import { TemplatesController } from '../../src/modules/templates/templates.controller';
import { PdfService } from '../../src/modules/pdf/pdf.service';
import { PdfController } from '../../src/modules/pdf/pdf.controller';
import { DocumentsService } from '../../src/modules/documents/documents.service';
import { CompanyScopeGuard } from '../../src/common/guards/company-scope.guard';

/**
 * Cross-tenant isolation suite.
 *
 * Wires the real services and controllers (Files, Templates, PDF, Documents) against an
 * in-memory Prisma double that enforces `companyId` filtering exactly like the database would.
 * The attacker is a fully privileged Admin of Company A, so every rejection proves that
 * tenant scoping (not RBAC) is what blocks access to Company B's resources.
 */

const COMPANY_A = 'comp-a';
const COMPANY_B = 'comp-b';

const isForbiddenOrNotFound = (err: unknown) =>
  err instanceof ForbiddenException || err instanceof NotFoundException;

test('Cross-Tenant Isolation Integration Tests', async (t) => {
  const storageDir = path.join(__dirname, '../../test-storage-cross-tenant');
  if (fs.existsSync(storageDir)) {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }

  const storage = new LocalStorageService();
  (storage as any).rootUploadDir = storageDir;
  (storage as any).ensureDirectoryExists(storageDir);

  // ---------------------------------------------------------------------------
  // In-memory tenant-aware data store
  // ---------------------------------------------------------------------------
  const documents: any[] = [
    {
      id: 'doc-b-invoice',
      companyId: COMPANY_B,
      documentType: DocumentType.INVOICE,
      documentNumber: 'INV-B-000001',
      title: 'Company B Confidential Invoice',
      status: DocumentStatus.DRAFT,
      deletedAt: null,
      versions: [],
      invoice: null,
      waybill: null,
      letter: null,
    },
    {
      id: 'doc-b-letter',
      companyId: COMPANY_B,
      documentType: DocumentType.LETTER,
      documentNumber: 'AOA/LET/B/0001',
      title: 'Company B Board Letter',
      status: DocumentStatus.ISSUED,
      deletedAt: null,
      versions: [{ id: 'ver-b-1', versionNumber: 1, pdfFileId: null, snapshotData: {} }],
      invoice: null,
      waybill: null,
      letter: null,
    },
  ];
  const files: any[] = [];
  const templates: any[] = [
    {
      id: 'tmpl-b-1',
      companyId: COMPANY_B,
      documentType: DocumentType.INVOICE,
      name: 'Company B Private Invoice Layout',
      code: 'INV-B-PRIVATE',
      isDefault: true,
      isActive: true,
      versions: [{ id: 'tv-b-1', versionNumber: 1 }],
    },
  ];
  const auditLogs: any[] = [];
  const mutations: string[] = [];

  const matchesScope = (record: any, where: any = {}) => {
    if (where.id !== undefined && record.id !== where.id) return false;
    if (where.companyId !== undefined && record.companyId !== where.companyId) return false;
    if (where.documentType !== undefined && record.documentType !== where.documentType) return false;
    if (where.deletedAt === null && record.deletedAt) return false;
    return true;
  };

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => documents.find((d) => matchesScope(d, where)) ?? null,
      updateMany: async ({ where }: any) => {
        mutations.push(`document.updateMany:${where?.id}`);
        return { count: documents.filter((d) => matchesScope(d, where)).length };
      },
    },
    file: {
      create: async ({ data }: any) => {
        const record = { id: `file-${files.length + 1}`, createdAt: new Date(), ...data };
        files.push(record);
        return record;
      },
      findFirst: async ({ where }: any) => files.find((f) => matchesScope(f, where)) ?? null,
      delete: async ({ where }: any) => {
        mutations.push(`file.delete:${where?.id}`);
        const idx = files.findIndex((f) => matchesScope(f, where));
        return idx === -1 ? null : files.splice(idx, 1)[0];
      },
    },
    template: {
      findFirst: async ({ where }: any) => templates.find((tpl) => matchesScope(tpl, where)) ?? null,
      findMany: async ({ where }: any) => templates.filter((tpl) => matchesScope(tpl, where)),
      update: async ({ where }: any) => {
        mutations.push(`template.update:${where?.id}`);
        return null;
      },
    },
    documentVersion: {
      update: async ({ where }: any) => {
        mutations.push(`documentVersion.update:${where?.id}`);
        return null;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const mockAudit: any = { logAction: async (entry: any) => auditLogs.push(entry) };
  const mockNumbering: any = { getNextDocumentNumber: async () => 'UNUSED-000001' };
  const mockNotifications: any = { createNotification: async () => undefined };

  const filesService = new FilesService(mockPrisma, storage, mockAudit);
  const templatesService = new TemplatesService(mockPrisma, mockAudit);
  const pdfService = new PdfService(mockPrisma, mockAudit, filesService, templatesService);
  const documentsService = new DocumentsService(mockPrisma, mockNumbering, mockAudit, mockNotifications);

  // Never spawn Chromium in tests; any call reaching this would itself indicate a leak.
  let pdfRenderCalls = 0;
  pdfService.generatePdfFromHtml = async () => {
    pdfRenderCalls++;
    return Buffer.from('%PDF-1.4 leaked %%EOF');
  };

  const filesController = new FilesController(filesService);
  const templatesController = new TemplatesController(templatesService);
  const pdfController = new PdfController(pdfService, filesService, templatesService);

  // Attacker: fully privileged Admin of Company A.
  const companyAAdmin: any = {
    id: 'usr-a-admin',
    companyId: COMPANY_A,
    role: 'Admin',
    isSystemAdmin: true,
    permissions: ['*'],
  };

  // Legitimate owner: Admin of Company B (positive controls).
  const companyBAdmin: any = {
    id: 'usr-b-admin',
    companyId: COMPANY_B,
    role: 'Admin',
    isSystemAdmin: true,
    permissions: ['*'],
  };

  // Seed Company B files through the real upload path.
  const companyBStandaloneFile = await filesService.uploadFile(
    COMPANY_B,
    { buffer: Buffer.from('Company B payroll ledger'), originalname: 'payroll.txt', mimetype: 'text/plain' } as any,
    {},
    companyBAdmin.id,
  );
  const companyBInvoiceAttachment = await filesService.uploadFile(
    COMPANY_B,
    { buffer: Buffer.from('%PDF-1.4 Company B signed contract'), originalname: 'contract.pdf', mimetype: 'application/pdf' } as any,
    { documentId: 'doc-b-invoice', fileCategory: FileCategory.ATTACHMENT },
    companyBAdmin.id,
  );

  const fakeRes: any = {
    setHeader: () => {
      throw new Error('Response headers must never be written for a cross-tenant request');
    },
    send: () => {
      throw new Error('Response body must never be sent for a cross-tenant request');
    },
  };

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------
  await t.test('Documents: Company A cannot read Company B document details or type', async () => {
    await assert.rejects(() => documentsService.findOne(COMPANY_A, 'doc-b-invoice'), isForbiddenOrNotFound);
    await assert.rejects(() => documentsService.getDocumentType(COMPANY_A, 'doc-b-invoice'), isForbiddenOrNotFound);

    // Positive control: owner can read it.
    const own = await documentsService.findOne(COMPANY_B, 'doc-b-invoice');
    assert.strictEqual(own.id, 'doc-b-invoice');
  });

  await t.test('Documents: Company A cannot cancel Company B document', async () => {
    mutations.length = 0;
    await assert.rejects(
      () =>
        documentsService.cancel(
          COMPANY_A,
          'doc-b-invoice',
          { cancellationReason: 'Hostile cancellation attempt' } as any,
          companyAAdmin.id,
        ),
      isForbiddenOrNotFound,
    );
    assert.deepStrictEqual(mutations, [], 'No document mutation may be issued for a cross-tenant cancel');
    assert.strictEqual(documents[0].status, DocumentStatus.DRAFT);
  });

  // ---------------------------------------------------------------------------
  // Rendering & PDFs
  // ---------------------------------------------------------------------------
  await t.test('Rendering: Company A cannot render Company B HTML preview (PdfController + TemplatesController)', async () => {
    await assert.rejects(() => pdfController.previewDocumentHtml(companyAAdmin, 'doc-b-invoice'), isForbiddenOrNotFound);
    await assert.rejects(() => pdfController.previewDocumentHtml(companyAAdmin, 'doc-b-letter', '1'), isForbiddenOrNotFound);
    await assert.rejects(() => templatesController.renderDocumentHtml(companyAAdmin, 'doc-b-invoice'), isForbiddenOrNotFound);
    await assert.rejects(() => templatesService.renderDocumentHtml(COMPANY_A, 'doc-b-letter', 1), isForbiddenOrNotFound);
  });

  await t.test('PDFs: Company A cannot generate, preview, or download Company B PDFs', async () => {
    pdfRenderCalls = 0;
    mutations.length = 0;

    await assert.rejects(() => pdfController.getDocumentPdf(companyAAdmin, 'doc-b-invoice', undefined, fakeRes), isForbiddenOrNotFound);
    await assert.rejects(() => pdfController.postDocumentPdf(companyAAdmin, 'doc-b-invoice', 'true', fakeRes), isForbiddenOrNotFound);
    await assert.rejects(() => pdfController.getDocumentVersionPdf(companyAAdmin, 'doc-b-letter', '1', fakeRes), isForbiddenOrNotFound);
    await assert.rejects(() => pdfController.previewDocumentPdf(companyAAdmin, 'doc-b-invoice', fakeRes), isForbiddenOrNotFound);

    // Service layer must also refuse even if a controller check were bypassed.
    await assert.rejects(() => pdfService.getOrGenerateDocumentPdf(COMPANY_A, 'doc-b-letter', 1, companyAAdmin.id), isForbiddenOrNotFound);
    await assert.rejects(() => pdfService.previewDocumentPdf(COMPANY_A, 'doc-b-invoice'), isForbiddenOrNotFound);

    assert.strictEqual(pdfRenderCalls, 0, 'Chromium rendering must never start for a cross-tenant document');
    assert.deepStrictEqual(mutations, [], 'No DocumentVersion.pdfFileId may be linked for a cross-tenant request');
  });

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------
  await t.test('Files: Company A cannot download Company B standalone files or document attachments', async () => {
    for (const fileId of [companyBStandaloneFile.id, companyBInvoiceAttachment.id]) {
      await assert.rejects(() => filesController.downloadFile(companyAAdmin, fileId, fakeRes), isForbiddenOrNotFound);
      await assert.rejects(() => filesService.getFileStream(COMPANY_A, fileId), isForbiddenOrNotFound);
      await assert.rejects(() => filesService.getFileBuffer(COMPANY_A, fileId), isForbiddenOrNotFound);
      await assert.rejects(() => filesService.getFileAuthorizationMeta(COMPANY_A, fileId), isForbiddenOrNotFound);
    }

    // Positive control: owner can stream it.
    const own = await filesService.getFileBuffer(COMPANY_B, companyBStandaloneFile.id);
    assert.strictEqual(own.buffer.toString(), 'Company B payroll ledger');
  });

  await t.test('Files: Company A cannot delete Company B files', async () => {
    mutations.length = 0;
    for (const fileId of [companyBStandaloneFile.id, companyBInvoiceAttachment.id]) {
      await assert.rejects(() => filesController.deleteFile(companyAAdmin, fileId), isForbiddenOrNotFound);
      await assert.rejects(() => filesService.deleteFile(COMPANY_A, fileId, companyAAdmin.id), isForbiddenOrNotFound);
    }

    assert.deepStrictEqual(mutations, [], 'No file.delete may be issued for a cross-tenant request');
    assert.strictEqual(files.length, 2, 'Company B files must remain registered');

    // Underlying storage objects must still exist and be readable by the owner.
    const stillThere = await filesService.getFileBuffer(COMPANY_B, companyBInvoiceAttachment.id);
    assert.ok(stillThere.buffer.length > 0);
  });

  await t.test('Files: Company A cannot attach uploads to Company B documents', async () => {
    const before = files.length;
    await assert.rejects(
      () =>
        filesController.uploadFile(
          companyAAdmin,
          { buffer: Buffer.from('%PDF-1.4 injected'), originalname: 'inject.pdf', mimetype: 'application/pdf' } as any,
          { documentId: 'doc-b-invoice' } as any,
        ),
      isForbiddenOrNotFound,
    );
    assert.strictEqual(files.length, before, 'No file may be registered against a foreign document');
  });

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------
  await t.test('Templates: Company A cannot read, list, or update Company B templates', async () => {
    mutations.length = 0;
    await assert.rejects(() => templatesController.findOne(companyAAdmin, 'tmpl-b-1'), isForbiddenOrNotFound);
    await assert.rejects(() => templatesService.findOne(COMPANY_A, 'tmpl-b-1'), isForbiddenOrNotFound);
    await assert.rejects(
      () => templatesController.update(companyAAdmin, 'tmpl-b-1', { name: 'Hijacked' } as any),
      isForbiddenOrNotFound,
    );
    assert.deepStrictEqual(mutations, [], 'No template mutation may be issued for a cross-tenant update');

    const listed = await templatesController.findAll(companyAAdmin);
    assert.strictEqual(listed.length, 0, 'Company A template listing must not include Company B templates');

    // Positive control: owner sees its template.
    const own = await templatesController.findOne(companyBAdmin, 'tmpl-b-1');
    assert.strictEqual(own.id, 'tmpl-b-1');
  });

  // ---------------------------------------------------------------------------
  // Request-level companyId injection
  // ---------------------------------------------------------------------------
  await t.test('CompanyScopeGuard: blocks Company B companyId injected via params, query, or body', () => {
    const guard = new CompanyScopeGuard();
    const ctx = (req: any): ExecutionContext =>
      ({ switchToHttp: () => ({ getRequest: () => ({ user: companyAAdmin, params: {}, query: {}, body: {}, ...req }) }) }) as any;

    assert.throws(() => guard.canActivate(ctx({ params: { companyId: COMPANY_B } })), ForbiddenException);
    assert.throws(() => guard.canActivate(ctx({ query: { companyId: COMPANY_B } })), ForbiddenException);
    assert.throws(() => guard.canActivate(ctx({ body: { companyId: COMPANY_B } })), ForbiddenException);
    assert.strictEqual(guard.canActivate(ctx({ params: { companyId: COMPANY_A } })), true);
  });

  if (fs.existsSync(storageDir)) {
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
});

