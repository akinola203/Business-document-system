import { test } from 'node:test';
import * as assert from 'node:assert';
import { FilesService } from '../../src/modules/files/files.service';
import { LocalStorageService } from '../../src/modules/files/storage/local-storage.service';
import { FileCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

test('Files & Secure Storage Unit Tests', async (t) => {
  const testStorageDir = path.join(__dirname, '../../test-storage-temp');

  // Clean test storage directory
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }

  const localStorageService = new LocalStorageService();
  // Override private rootUploadDir for isolated testing
  (localStorageService as any).rootUploadDir = testStorageDir;
  (localStorageService as any).ensureDirectoryExists(testStorageDir);

  const filesStore: any[] = [];
  const auditLogsStore: any[] = [];

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'doc-valid' && where.companyId === 'comp-1') {
          return { id: 'doc-valid', companyId: 'comp-1' };
        }
        return null;
      },
    },
    file: {
      create: async ({ data }: any) => {
        const record = {
          id: `file-${filesStore.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        filesStore.push(record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        return filesStore.find(
          (f) => f.id === where.id && (!where.companyId || f.companyId === where.companyId),
        ) || null;
      },
      delete: async ({ where }: any) => {
        const idx = filesStore.findIndex((f) => f.id === where.id);
        if (idx !== -1) {
          return filesStore.splice(idx, 1)[0];
        }
        return null;
      },
    },
  };

  const mockAuditService: any = {
    logAction: async (entry: any) => {
      auditLogsStore.push(entry);
    },
  };

  const filesService = new FilesService(mockPrisma, localStorageService, mockAuditService);

  await t.test('1. Rejects upload when buffer is empty or missing', async () => {
    await assert.rejects(
      async () => {
        await filesService.uploadFile('comp-1', null as any, {}, 'user-1');
      },
      /No file content uploaded/,
    );
  });

  await t.test('2. Rejects file exceeding 15MB limit', async () => {
    const largeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    const mockFile: any = {
      buffer: largeBuffer,
      originalname: 'huge_document.pdf',
      mimetype: 'application/pdf',
    };

    await assert.rejects(
      async () => {
        await filesService.uploadFile('comp-1', mockFile, {}, 'user-1');
      },
      /File exceeds maximum permitted size/,
    );
  });

  await t.test('3. Rejects unsupported MIME type (e.g. application/x-msdownload)', async () => {
    const mockFile: any = {
      buffer: Buffer.from('binary-code'),
      originalname: 'virus.exe',
      mimetype: 'application/x-msdownload',
    };

    await assert.rejects(
      async () => {
        await filesService.uploadFile('comp-1', mockFile, {}, 'user-1');
      },
      /Unsupported file MIME type/,
    );
  });

  await t.test('4. Rejects MIME type and extension spoofing (e.g. .exe masquerading as .pdf)', async () => {
    const mockFile: any = {
      buffer: Buffer.from('payload'),
      originalname: 'script.exe',
      mimetype: 'application/pdf',
    };

    await assert.rejects(
      async () => {
        await filesService.uploadFile('comp-1', mockFile, {}, 'user-1');
      },
      /File extension ".exe" does not match reported MIME type/,
    );
  });

  await t.test('5. Sanitizes path traversal attempts in originalFilename', async () => {
    const fileContent = Buffer.from('%PDF-1.4 Legitimate PDF binary stream');
    const mockFile: any = {
      buffer: fileContent,
      originalname: '../../../../etc/shadow.pdf',
      mimetype: 'application/pdf',
    };

    const uploaded = await filesService.uploadFile('comp-1', mockFile, {}, 'user-1');
    assert.strictEqual(uploaded.originalFilename, 'shadow.pdf');
    assert.ok(uploaded.storageKey.startsWith('comp-1/'));
    assert.ok(uploaded.checksumSha256);
  });

  await t.test('6. Validates documentId company ownership when specified', async () => {
    const mockFile: any = {
      buffer: Buffer.from('Attachment text'),
      originalname: 'invoice-memo.txt',
      mimetype: 'text/plain',
    };

    // Fails for foreign document
    await assert.rejects(
      async () => {
        await filesService.uploadFile(
          'comp-1',
          mockFile,
          { documentId: 'foreign-doc-999' },
          'user-1',
        );
      },
      /Document with ID "foreign-doc-999" not found in company/,
    );

    // Succeeds for owned document
    const uploaded = await filesService.uploadFile(
      'comp-1',
      mockFile,
      { documentId: 'doc-valid', fileCategory: FileCategory.ATTACHMENT },
      'user-1',
    );
    assert.strictEqual(uploaded.documentId, 'doc-valid');
  });

  await t.test('7. Enforces tenant isolation on file stream retrieval', async () => {
    const mockFile: any = {
      buffer: Buffer.from('Confidential company 1 data'),
      originalname: 'secret.txt',
      mimetype: 'text/plain',
    };
    const file = await filesService.uploadFile('comp-1', mockFile, {}, 'user-1');

    // Tenant 2 attempts to download Tenant 1 file
    await assert.rejects(
      async () => {
        await filesService.getFileStream('comp-2', file.id);
      },
      /File with ID ".*" not found/,
    );

    // Tenant 1 downloads successfully
    const result = await filesService.getFileStream('comp-1', file.id);
    assert.strictEqual(result.file.id, file.id);
    assert.ok(result.stream);
  });

  await t.test('8. saveBufferAsFile stores internally generated PDF and audits', async () => {
    const pdfPayload = Buffer.from('%PDF-1.4 Mock Generated PDF Buffer');
    const saved = await filesService.saveBufferAsFile({
      companyId: 'comp-1',
      documentId: 'doc-valid',
      filename: 'INV-2026-000001_v1.pdf',
      buffer: pdfPayload,
      mimeType: 'application/pdf',
      fileCategory: FileCategory.GENERATED_PDF,
      actorId: 'admin-1',
    });

    assert.ok(saved.id);
    assert.strictEqual(saved.fileCategory, FileCategory.GENERATED_PDF);
    assert.strictEqual(saved.mimeType, 'application/pdf');
    assert.strictEqual(Number(saved.sizeBytes), pdfPayload.length);

    // Verify file content can be read back as buffer
    const retrieved = await filesService.getFileBuffer('comp-1', saved.id);
    assert.deepStrictEqual(retrieved.buffer, pdfPayload);

    // Verify audit log
    const audit = auditLogsStore.find((a) => a.action === 'FILE_GENERATED' && a.entityId === saved.id);
    assert.ok(audit, 'Audit log for FILE_GENERATED was recorded');
  });

  await t.test('9. LocalStorageService protects against path traversal storage keys', async () => {
    await assert.rejects(
      async () => {
        await localStorageService.putFile('../outside.txt', Buffer.from('hack'), 'text/plain');
      },
      /Invalid storage path traversal/,
    );
  });

  await t.test('10. Rejects file when binary signature does not match declared MIME type', async () => {
    const fakePdfFile: any = {
      buffer: Buffer.from('plain text pretending to be pdf'),
      originalname: 'fake.pdf',
      mimetype: 'application/pdf',
    };

    await assert.rejects(
      async () => {
        await filesService.uploadFile('comp-1', fakePdfFile, {}, 'user-1');
      },
      /File binary signature \(magic bytes\) does not match reported MIME type/,
    );
  });

  // Cleanup test directory
  if (fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});
