import { test } from 'node:test';
import * as assert from 'node:assert';
import { PdfService } from '../../src/modules/pdf/pdf.service';
import { FileCategory, DocumentType } from '@prisma/client';

test('PDF Engine & Version-Linked Storage Unit Tests', async (t) => {
  const filesStore: any[] = [];
  const versionsStore: any[] = [
    {
      id: 'ver-101',
      versionNumber: 1,
      pdfFileId: null,
      snapshotData: {
        document: {
          documentNumber: 'INV-2026-000001',
          title: 'Supply Invoice v1',
          currency: 'NGN',
          subtotalAmount: '100000.00',
          taxAmount: '7500.00',
          discountAmount: '0.00',
          totalAmount: '107500.00',
          balanceDue: '107500.00',
        },
        company: {
          name: 'AOA 77 COMPANY LTD',
          rcNumber: '9905345...',
          tin: '2622739227683',
          address: 'Ota, Ogun State',
        },
        client: {
          name: 'Ikeja Depot',
        },
        invoice: {
          items: [{ lineNumber: 1, description: 'Test Item', quantity: 10, unit: 'Bags', unitPrice: 10000, lineTotal: 100000 }],
        },
      },
    },
  ];
  const auditLogsStore: any[] = [];

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'doc-inv-1' && where.companyId === 'comp-1') {
          return {
            id: 'doc-inv-1',
            companyId: 'comp-1',
            documentNumber: 'INV-2026-000001',
            documentType: DocumentType.INVOICE,
            title: 'Supply Invoice v1',
            versions: versionsStore,
          };
        }
        if (where.id === 'doc-draft-1' && where.companyId === 'comp-1') {
          return {
            id: 'doc-draft-1',
            companyId: 'comp-1',
            documentNumber: 'INV-2026-DRAFT',
            documentType: DocumentType.INVOICE,
            title: 'Draft Invoice',
            versions: [],
          };
        }
        return null;
      },
    },
    documentVersion: {
      update: async ({ where, data }: any) => {
        const ver = versionsStore.find((v) => v.id === where.id);
        if (ver) {
          Object.assign(ver, data);
        }
        return ver;
      },
    },
    file: {
      findFirst: async ({ where }: any) => {
        return filesStore.find(
          (f) => f.id === where.id && (!where.companyId || f.companyId === where.companyId),
        ) || null;
      },
    },
  };

  const mockFilesService: any = {
    saveBufferAsFile: async (params: any) => {
      const fileRecord = {
        id: `file-pdf-${filesStore.length + 1}`,
        companyId: params.companyId,
        documentId: params.documentId,
        originalFilename: params.filename,
        storageKey: `${params.companyId}/uuid-${params.filename}`,
        mimeType: params.mimeType,
        sizeBytes: BigInt(params.buffer.length),
        fileCategory: params.fileCategory,
      };
      filesStore.push(fileRecord);
      return fileRecord;
    },
  };

  const mockTemplatesService: any = {
    renderDocumentHtml: async () => {
      return '<!DOCTYPE html><html><body><h1>Printable Invoice</h1></body></html>';
    },
  };

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogsStore.push(entry);
    },
  };

  const pdfService = new PdfService(
    mockPrisma,
    mockAuditService,
    mockFilesService,
    mockTemplatesService,
  );

  // Stub generatePdfFromHtml to return synthetic PDF buffer without spawning Chromium in every unit test
  const syntheticPdfBuffer = Buffer.from('%PDF-1.4 Mock Binary Header and Body %%EOF');
  pdfService.generatePdfFromHtml = async () => syntheticPdfBuffer;

  await t.test('1. previewDocumentPdf generates on-the-fly PDF without persisting in File registry', async () => {
    const beforeCount = filesStore.length;
    const preview = await pdfService.previewDocumentPdf('comp-1', 'doc-inv-1');

    assert.ok(preview.buffer);
    assert.strictEqual(preview.filename, 'PREVIEW_INV-2026-000001.pdf');
    assert.strictEqual(filesStore.length, beforeCount, 'No permanent File record was created for preview');
  });

  await t.test('2. getOrGenerateDocumentPdf compiles, saves File, links DocumentVersion.pdfFileId and audits', async () => {
    const result = await pdfService.getOrGenerateDocumentPdf(
      'comp-1',
      'doc-inv-1',
      1,
      'admin-1',
    );

    assert.ok(result.fileId);
    assert.strictEqual(result.filename, 'INV-2026-000001_v1.pdf');

    // DocumentVersion should have pdfFileId linked
    const ver = versionsStore.find((v) => v.versionNumber === 1);
    assert.strictEqual(ver.pdfFileId, result.fileId);

    // Audit log should be recorded
    const audit = auditLogsStore.find((a) => a.action === 'DOCUMENT_PDF_GENERATED');
    assert.ok(audit, 'Audit log recorded for DOCUMENT_PDF_GENERATED');
  });

  await t.test('3. Subsequent requests for same version serve existing cached File without re-compiling', async () => {
    let recompiled = false;
    const originalGenerator = pdfService.generatePdfFromHtml;
    pdfService.generatePdfFromHtml = async () => {
      recompiled = true;
      return syntheticPdfBuffer;
    };

    const cached = await pdfService.getOrGenerateDocumentPdf('comp-1', 'doc-inv-1', 1);

    assert.strictEqual(recompiled, false, 'Did not recompile PDF when cached File exists');
    assert.strictEqual(cached.filename, 'INV-2026-000001_v1.pdf');

    pdfService.generatePdfFromHtml = originalGenerator;
  });

  await t.test('4. Cross-tenant isolation protects documents and PDFs', async () => {
    await assert.rejects(
      async () => {
        // Tenant 2 attempts to generate or fetch Tenant 1's document PDF
        await pdfService.getOrGenerateDocumentPdf('comp-2', 'doc-inv-1');
      },
      /Document with ID "doc-inv-1" not found/,
    );
  });

  await t.test('5. Concurrent calls for uncompiled document version share single generation promise', async () => {
    const ver = versionsStore[0];
    ver.pdfFileId = null;
    let generateCount = 0;

    pdfService.generatePdfFromHtml = async () => {
      generateCount++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return syntheticPdfBuffer;
    };

    const [res1, res2, res3] = await Promise.all([
      pdfService.getOrGenerateDocumentPdf('comp-1', 'doc-inv-1', 1),
      pdfService.getOrGenerateDocumentPdf('comp-1', 'doc-inv-1', 1),
      pdfService.getOrGenerateDocumentPdf('comp-1', 'doc-inv-1', 1),
    ]);

    assert.strictEqual(generateCount, 1, 'generatePdfFromHtml was only executed once across concurrent calls');
    assert.strictEqual(res1.fileId, res2.fileId);
    assert.strictEqual(res2.fileId, res3.fileId);
  });
});
