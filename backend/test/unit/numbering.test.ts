import { test } from 'node:test';
import * as assert from 'node:assert';
import { NumberingService } from '../../src/modules/numbering/numbering.service';
import { DocumentType } from '@prisma/client';

test('NumberingService Unit Tests', async (t) => {
  let sequencesDb: any[] = [];

  const mockTx: any = {
    documentNumberSequence: {
      findUnique: async ({ where }: any) => {
        return sequencesDb.find(
          (s) =>
            s.companyId === where.companyId_documentType_resetYear.companyId &&
            s.documentType === where.companyId_documentType_resetYear.documentType &&
            s.resetYear === where.companyId_documentType_resetYear.resetYear,
        );
      },
      upsert: async ({ create }: any) => {
        const item = { id: `seq-${sequencesDb.length + 1}`, ...create };
        sequencesDb.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = sequencesDb.findIndex((s) => s.id === where.id);
        sequencesDb[idx].currentNumber += data.currentNumber.increment;
        return sequencesDb[idx];
      },
    },
  };

  const service = new NumberingService({} as any);
  const currentYear = new Date().getFullYear();

  await t.test('allocates sequential invoice numbers with INV prefix and zero padding', async () => {
    sequencesDb = [];
    const num1 = await service.getNextDocumentNumber(mockTx, 'comp-1', DocumentType.INVOICE);
    assert.equal(num1, `INV-${currentYear}-000001`);

    const num2 = await service.getNextDocumentNumber(mockTx, 'comp-1', DocumentType.INVOICE);
    assert.equal(num2, `INV-${currentYear}-000002`);
  });

  await t.test('allocates sequential waybill numbers with WB prefix', async () => {
    const num1 = await service.getNextDocumentNumber(mockTx, 'comp-1', DocumentType.WAYBILL);
    assert.equal(num1, `WB-${currentYear}-000001`);
  });

  await t.test('allocates sequential letter numbers with slash delimiter pattern', async () => {
    const num1 = await service.getNextDocumentNumber(mockTx, 'comp-1', DocumentType.LETTER);
    assert.equal(num1, `AOA/LET/${currentYear}/0001`);
  });
});
