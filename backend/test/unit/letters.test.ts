import { test } from 'node:test';
import * as assert from 'node:assert';
import { LettersService } from '../../src/modules/letters/letters.service';
import { DocumentStatus } from '@prisma/client';

test('LettersService Unit Tests', async (t) => {
  let documentsDb: any[] = [];
  let lettersDb: any[] = [];
  let versionsDb: any[] = [];
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    document: {
      findFirst: async ({ where }: any) => {
        const doc = documentsDb.find((d) => d.id === where.id && d.companyId === where.companyId);
        if (!doc) return null;
        const letRecord = lettersDb.find((l) => l.documentId === doc.id);
        return {
          ...doc,
          letter: letRecord,
          versions: versionsDb.filter((v) => v.documentId === doc.id),
        };
      },
      create: async ({ data }: any) => {
        const item = { id: `doc-${documentsDb.length + 1}`, ...data };
        documentsDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = documentsDb.findIndex((d) => d.id === where.id);
        documentsDb[idx] = { ...documentsDb[idx], ...data };
        return documentsDb[idx];
      },
    },
    letter: {
      create: async ({ data }: any) => {
        const item = { id: `let-${lettersDb.length + 1}`, ...data };
        lettersDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = lettersDb.findIndex((l) => l.id === where.id);
        lettersDb[idx] = { ...lettersDb[idx], ...data };
        return lettersDb[idx];
      },
    },
    documentVersion: {
      findFirst: async ({ where }: any) => {
        const list = versionsDb
          .filter((v) => v.documentId === where.documentId)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return list[0] ?? null;
      },
      create: async ({ data }: any) => {
        const item = { id: `ver-${versionsDb.length + 1}`, ...data };
        versionsDb.push(item);
        return item;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: 'audit-1', ...data };
      },
    },
    client: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1' && where.id === 'client-1') return { id: 'client-1' };
        return null;
      },
    },
    branch: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1' && where.id === 'branch-1') return { id: 'branch-1' };
        return null;
      },
    },
    department: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1' && where.id === 'dept-1') return { id: 'dept-1' };
        return null;
      },
    },
    template: {
      findFirst: async ({ where }: any) => {
        if (where.companyId === 'comp-1' && where.id === 'tmpl-1') return { id: 'tmpl-1' };
        return null;
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const mockNumberingService: any = {
    getNextDocumentNumber: async () => 'AOA/LET/2026/0001',
  };

  const service = new LettersService(mockPrisma, mockNumberingService);

  await t.test('createDraft creates letter with sequential reference AOA/LET/2026/0001 and sanitizes bodyHtml', async () => {
    documentsDb = [];
    lettersDb = [];

    const letter = await service.createDraft(
      'comp-1',
      {
        title: 'Commercial Proposal',
        recipientName: 'Dr. Babatunde Raji',
        subject: 'Formal Supply Quotation',
        bodyHtml: '<p>Dear Dr. Raji...</p><script>alert("xss")</script><a href="javascript:attack()">Click</a>',
        bodyText: 'Dear Dr. Raji...',
        signatoryName: 'Alade Adebayo',
      },
      'usr-1',
    );

    assert.equal(letter.documentNumber, 'AOA/LET/2026/0001');
    assert.equal(letter.status, DocumentStatus.DRAFT);
    assert.equal(letter.letter?.recipientName, 'Dr. Babatunde Raji');
    // Script tag and javascript link must be stripped
    assert.ok(!letter.letter?.bodyHtml.includes('<script>'));
    assert.ok(!letter.letter?.bodyHtml.includes('javascript:'));
  });

  await t.test('createDraft rejects cross-tenant foreign key', async () => {
    await assert.rejects(
      async () => {
        await service.createDraft(
          'comp-1',
          {
            title: 'Foreign Client Letter',
            recipientName: 'Dr. Raji',
            subject: 'Proposal',
            bodyHtml: '<p>Hello</p>',
            bodyText: 'Hello',
            signatoryName: 'Alade Adebayo',
            clientId: 'client-from-other-company',
          },
          'usr-1',
        );
      },
      /not found in this company/i,
    );
  });

  await t.test('issue freezes official letterhead version and transitions to ISSUED', async () => {
    const docId = documentsDb[0].id;
    const issued = await service.issue('comp-1', docId, 'usr-1');
    assert.equal(issued.status, DocumentStatus.ISSUED);
    assert.equal(versionsDb.length, 1);
  });
});
