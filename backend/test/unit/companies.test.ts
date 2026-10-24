import { test } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../../src/modules/companies/companies.service';

test('CompaniesService Unit Tests', async (t) => {
  let mockCompanyDb: any = null;
  let mockSettingsDb: any = null;
  let auditLogs: any[] = [];

  const mockPrisma: any = {
    company: {
      findUnique: async ({ where }: any) => {
        if (mockCompanyDb && mockCompanyDb.id === where.id) {
          return { ...mockCompanyDb, settings: mockSettingsDb };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        mockCompanyDb = { ...mockCompanyDb, ...data };
        return { ...mockCompanyDb, settings: mockSettingsDb };
      },
    },
    companySetting: {
      findUnique: async () => mockSettingsDb,
      upsert: async ({ update, create }: any) => {
        mockSettingsDb = { ...mockSettingsDb, ...(update || create) };
        return mockSettingsDb;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: 'audit-1', ...data };
      },
    },
    $transaction: async (cb: any) => cb(mockPrisma),
  };

  const service = new CompaniesService(mockPrisma);

  await t.test('getCurrentCompany returns company with settings', async () => {
    mockCompanyDb = {
      id: 'comp-1',
      name: 'AOA 77 COMPANY LTD',
      legalName: 'AOA 77 COMPANY LTD',
      rcNumber: '9905345...',
      tin: '2622739227683',
      address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria',
    };
    mockSettingsDb = {
      bankName: 'Globus Bank',
      bankAccountNumber: '1000652112',
      showBankDetailsOnInvoice: true,
      defaultVatRate: 7.5,
    };

    const result = await service.getCurrentCompany('comp-1');
    assert.equal(result.name, 'AOA 77 COMPANY LTD');
    assert.equal(result.settings?.bankName, 'Globus Bank');
    assert.equal(result.rcNumber, '9905345...');
  });

  await t.test('getCurrentCompany throws NotFoundException if company does not exist', async () => {
    mockCompanyDb = null;
    await assert.rejects(
      async () => {
        await service.getCurrentCompany('non-existent');
      },
      NotFoundException,
    );
  });

  await t.test('updateCompany updates details and logs an audit record', async () => {
    auditLogs = [];
    mockCompanyDb = {
      id: 'comp-1',
      name: 'AOA 77 COMPANY LTD',
      legalName: 'AOA 77 COMPANY LTD',
      phone: '+234 803 000 0000',
    };

    const updateData = { phone: '+234 803 999 8888', website: 'https://aoa77.com' };
    const updated = await service.updateCompany('comp-1', updateData, 'usr-admin-1');

    assert.equal(updated.phone, '+234 803 999 8888');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'COMPANY_PROFILE_UPDATED');
    assert.equal(auditLogs[0].actorId, 'usr-admin-1');
  });

  await t.test('updateCompanySettings updates banking and tax policies', async () => {
    auditLogs = [];
    mockCompanyDb = { id: 'comp-1', name: 'AOA 77 COMPANY LTD' };
    mockSettingsDb = {
      id: 'sett-1',
      companyId: 'comp-1',
      bankName: 'Globus Bank',
      bankAccountNumber: '1000652112',
      defaultVatRate: 7.5,
    };

    const updatedSettings = await service.updateCompanySettings(
      'comp-1',
      {
        bankAccountName: 'AOA 77 COMPANY LTD - OPERATIONAL',
        defaultVatRate: 7.5,
        defaultPaymentTermsDays: 45,
      },
      'usr-admin-1',
    );

    assert.equal(updatedSettings.bankAccountName, 'AOA 77 COMPANY LTD - OPERATIONAL');
    assert.equal(updatedSettings.defaultPaymentTermsDays, 45);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'COMPANY_SETTINGS_UPDATED');
  });
});
