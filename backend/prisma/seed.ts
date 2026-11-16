import {
  PrismaClient,
  DocumentType,
  CompanyUserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      'Refusing to run database seed in production without ALLOW_PRODUCTION_SEED=true.',
    );
  }
}

async function main() {
  assertSeedAllowed(process.env);
  console.log('--- STARTING PRODUCTION WORKSPACE SEEDING FOR AKINDEJI AKINLADE ---');

  // Preserve all data created from October 7th, 2026 onwards; only remove records older than Oct 7, 2026
  const cutoffDate = new Date('2026-10-07T00:00:00.000Z');
  console.log(`Preserving all records from ${cutoffDate.toISOString()} till now...`);

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.invoiceItem.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.waybillItem.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.waybill.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.masterWaybill.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.invoice.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.letter.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.documentApproval.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.documentVersion.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.document.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.supplyOrder.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.supplyItem.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.vendor.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.clientAddress.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.client.deleteMany({ where: { createdAt: { lt: cutoffDate } } }),
  ]);

  // 1. Create or Update Company Profile (AOA 77 COMPANY LTD)
  console.log('Seeding Company: AOA 77 COMPANY LTD...');
  const company = await prisma.company.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    update: {
      name: 'AOA 77 COMPANY LTD',
      legalName: 'AOA 77 COMPANY LTD',
      rcNumber: '9905345...',
      tin: '2622739227683',
      address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria',
      email: 'dejakinlade@gmail.com',
      phone: '+234 803 000 0000',
      website: 'https://aoa77.com',
      defaultCurrency: 'NGN',
    },
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'AOA 77 COMPANY LTD',
      legalName: 'AOA 77 COMPANY LTD',
      rcNumber: '9905345...',
      tin: '2622739227683',
      address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria',
      email: 'dejakinlade@gmail.com',
      phone: '+234 803 000 0000',
      website: 'https://aoa77.com',
      defaultCurrency: 'NGN',
    },
  });

  // 2. Company Settings & Bank Information
  console.log('Seeding Company Settings & Banking details...');
  await prisma.companySetting.upsert({
    where: { companyId: company.id },
    update: {
      bankName: 'Globus Bank',
      bankAccountNumber: '1000652112',
      bankAccountName: 'AOA 77 COMPANY LTD',
      bankSortCode: '103',
      showBankDetailsOnInvoice: true,
      showBankDetailsOnWaybill: false,
      showBankDetailsOnLetter: false,
      defaultVatRate: 7.5,
      defaultPaymentTermsDays: 30,
      allowSelfApproval: true,
    },
    create: {
      companyId: company.id,
      bankName: 'Globus Bank',
      bankAccountNumber: '1000652112',
      bankAccountName: 'AOA 77 COMPANY LTD',
      bankSortCode: '103',
      showBankDetailsOnInvoice: true,
      showBankDetailsOnWaybill: false,
      showBankDetailsOnLetter: false,
      defaultVatRate: 7.5,
      defaultPaymentTermsDays: 30,
      allowSelfApproval: true,
    },
  });

  // 3. Departments
  console.log('Seeding Departments...');
  const deptAccounts = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ACCT' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'ACCT',
      name: 'Finance & Accounts',
      description: 'Financial ledger, invoicing, and receivable collection',
    },
  });

  await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'OPS' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'OPS',
      name: 'Logistics & Operations',
      description: 'Waybill issuance, consignment shipping, and warehouse dispatch',
    },
  });

  // 4. Branches
  console.log('Seeding Branches...');
  const branchOta = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'OTA-HQ' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'OTA-HQ',
      name: 'Ota Headquarters',
      address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State',
      phone: '+234 803 000 0001',
      email: 'dejakinlade@gmail.com',
    },
  });

  await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'LAG-DEP' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'LAG-DEP',
      name: 'Lagos Logistics Depot',
      address: 'Plot 12 Industrial Avenue, Ikeja, Lagos State',
      phone: '+234 803 000 0002',
      email: 'lagos-depot@aoa77.com',
    },
  });

  // 5. Granular Permissions (32 Permissions)
  console.log('Seeding System Permissions...');
  const permissionsList = [
    { slug: 'company:view', name: 'View Company Profile', category: 'COMPANY' },
    { slug: 'company:update', name: 'Update Company Profile', category: 'COMPANY' },
    { slug: 'settings:manage', name: 'Manage System Settings', category: 'SETTINGS' },
    { slug: 'audit:view', name: 'View Audit Logs', category: 'AUDIT' },

    { slug: 'users:view', name: 'View Users', category: 'USERS' },
    { slug: 'users:manage', name: 'Create and Edit Users', category: 'USERS' },
    { slug: 'roles:manage', name: 'Manage Roles and Permissions', category: 'USERS' },

    { slug: 'clients:view', name: 'View Clients', category: 'CLIENTS' },
    { slug: 'clients:create', name: 'Create Clients', category: 'CLIENTS' },
    { slug: 'clients:update', name: 'Update Clients', category: 'CLIENTS' },
    { slug: 'clients:disable', name: 'Deactivate Clients', category: 'CLIENTS' },

    { slug: 'invoice:view', name: 'View Invoices', category: 'INVOICE' },
    { slug: 'invoice:create', name: 'Create Invoice Draft', category: 'INVOICE' },
    { slug: 'invoice:update', name: 'Edit Invoice Draft', category: 'INVOICE' },
    { slug: 'invoice:submit', name: 'Submit Invoice for Approval', category: 'INVOICE' },
    { slug: 'invoice:approve', name: 'Approve or Reject Invoices', category: 'INVOICE' },
    { slug: 'invoice:issue', name: 'Issue Invoice & Generate PDF', category: 'INVOICE' },
    { slug: 'invoice:cancel', name: 'Cancel Invoice', category: 'INVOICE' },
    { slug: 'invoice:archive', name: 'Archive Invoice', category: 'INVOICE' },

    { slug: 'payment:view', name: 'View Payments Ledger', category: 'PAYMENT' },
    { slug: 'payment:record', name: 'Record Invoice Payment', category: 'PAYMENT' },
    { slug: 'payment:reverse', name: 'Reverse Mistaken Payment', category: 'PAYMENT' },

    { slug: 'waybill:view', name: 'View Waybills', category: 'WAYBILL' },
    { slug: 'waybill:create', name: 'Create Waybill Draft', category: 'WAYBILL' },
    { slug: 'waybill:update', name: 'Edit Waybill Draft', category: 'WAYBILL' },
    { slug: 'waybill:approve', name: 'Approve Waybill', category: 'WAYBILL' },
    { slug: 'waybill:dispatch', name: 'Dispatch Waybill (In Transit)', category: 'WAYBILL' },
    { slug: 'waybill:complete', name: 'Complete Waybill Delivery', category: 'WAYBILL' },
    { slug: 'waybill:cancel', name: 'Cancel Waybill', category: 'WAYBILL' },

    { slug: 'letter:view', name: 'View Business Letters', category: 'LETTER' },
    { slug: 'letter:create', name: 'Create Letter Draft', category: 'LETTER' },
    { slug: 'letter:update', name: 'Edit Letter Draft', category: 'LETTER' },
    { slug: 'letter:approve', name: 'Approve Letter', category: 'LETTER' },
    { slug: 'letter:issue', name: 'Issue Letter & Generate PDF', category: 'LETTER' },
    { slug: 'letter:archive', name: 'Archive Letter', category: 'LETTER' },

    { slug: 'reports:view', name: 'View Financial & Operational Reports', category: 'REPORTS' },
    { slug: 'documents:export', name: 'Export Document Reports & CSVs', category: 'REPORTS' },

    { slug: 'vendors:view', name: 'View Vendor Profiles & Suppliers', category: 'VENDORS' },
    { slug: 'vendors:manage', name: 'Manage Vendors & Payout Accounts', category: 'VENDORS' },
    { slug: 'supplies:view', name: 'View Supplies & Items Catalog', category: 'SUPPLIES' },
    { slug: 'supplies:manage', name: 'Manage Supplies Catalog & Orders', category: 'SUPPLIES' },
  ];

  const dbPermissions: { [key: string]: string } = {};
  for (const perm of permissionsList) {
    const record = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: { name: perm.name, category: perm.category },
      create: perm,
    });
    dbPermissions[perm.slug] = record.id;
  }

  // 6. Roles & RolePermission Mappings
  console.log('Seeding Roles...');
  const roleManagingDirector = await prisma.role.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: 'Super Admin / Managing Director',
      },
    },
    update: {
      description: 'Company Owner & Managing Director with unrestricted administrative authority',
      isSystem: true,
    },
    create: {
      companyId: company.id,
      name: 'Super Admin / Managing Director',
      description: 'Company Owner & Managing Director with unrestricted administrative authority',
      isSystem: true,
    },
  });

  const roleAdmin = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Admin' } },
    update: { isSystem: true },
    create: {
      companyId: company.id,
      name: 'Admin',
      description: 'Full administrative access across all company operations',
      isSystem: true,
    },
  });

  const roleManager = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Manager' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Manager',
      description: 'Document approval, issuance, dispatch, and financial ledger review',
      isSystem: true,
    },
  });

  const roleStaff = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Staff' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Staff',
      description: 'Creation and draft editing of invoices, waybills, and letters',
      isSystem: true,
    },
  });

  const roleViewer = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Viewer' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Viewer',
      description: 'Read-only access to documents, clients, and authorized reports',
      isSystem: true,
    },
  });

  // Attach all 32 permissions to Super Admin / Managing Director and Admin
  for (const slug of Object.keys(dbPermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleManagingDirector.id,
          permissionId: dbPermissions[slug],
        },
      },
      update: {},
      create: {
        roleId: roleManagingDirector.id,
        permissionId: dbPermissions[slug],
      },
    });

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleAdmin.id,
          permissionId: dbPermissions[slug],
        },
      },
      update: {},
      create: {
        roleId: roleAdmin.id,
        permissionId: dbPermissions[slug],
      },
    });
  }

  // 7. Personalize Primary Owner Account for Akindeji Akinlade
  console.log('Seeding Primary Owner Account: Akindeji Akinlade (dejakinlade@gmail.com)...');
  const passwordHash = await argon2.hash('Aoa77@Password2026!');

  const ownerUser = await prisma.user.upsert({
    where: { email: 'dejakinlade@gmail.com' },
    update: {
      passwordHash,
      firstName: 'Akindeji',
      lastName: 'Akinlade',
      isActive: true,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lockedUntil: null,
    },
    create: {
      email: 'dejakinlade@gmail.com',
      passwordHash,
      firstName: 'Akindeji',
      lastName: 'Akinlade',
      phone: '+234 803 777 7777',
      isActive: true,
    },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: ownerUser.id } },
    update: {
      roleId: roleManagingDirector.id,
      branchId: branchOta.id,
      departmentId: deptAccounts.id,
      isOwner: true,
      status: CompanyUserStatus.ACTIVE,
    },
    create: {
      companyId: company.id,
      userId: ownerUser.id,
      roleId: roleManagingDirector.id,
      branchId: branchOta.id,
      departmentId: deptAccounts.id,
      isOwner: true,
      status: CompanyUserStatus.ACTIVE,
    },
  });

  // Also update any legacy owner email account (akinakinlade777@gmail.com) to Akindeji Akinlade / Managing Director role
  await prisma.user.updateMany({
    where: { email: 'akinakinlade777@gmail.com' },
    data: {
      firstName: 'Akindeji',
      lastName: 'Akinlade',
      passwordHash,
    },
  });

  // 8. Sync Document Number Sequences (Reset to 0 if no docs exist, or align with preserved Oct 7+ docs so next number never collides)
  console.log('Synchronizing sequential document numbering counters...');
  const currentYear = new Date().getFullYear();

  const extractMaxNumber = (docNumbers: string[]): number => {
    let max = 0;
    for (const numStr of docNumbers) {
      const match = numStr.match(/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > max) max = val;
      }
    }
    return max;
  };

  const [invDocs, wbDocs, letDocs, payRecords] = await Promise.all([
    prisma.document.findMany({
      where: { companyId: company.id, documentType: DocumentType.INVOICE },
      select: { documentNumber: true },
    }),
    prisma.document.findMany({
      where: { companyId: company.id, documentType: DocumentType.WAYBILL },
      select: { documentNumber: true },
    }),
    prisma.document.findMany({
      where: { companyId: company.id, documentType: DocumentType.LETTER },
      select: { documentNumber: true },
    }),
    prisma.payment.findMany({
      where: { companyId: company.id },
      select: { paymentNumber: true },
    }),
  ]);

  const maxInv = extractMaxNumber(invDocs.map((d) => d.documentNumber));
  const maxWb = extractMaxNumber(wbDocs.map((d) => d.documentNumber));
  const maxLet = extractMaxNumber(letDocs.map((d) => d.documentNumber));
  const maxPay = extractMaxNumber(payRecords.map((p) => p.paymentNumber));

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType_resetYear: {
        companyId: company.id,
        documentType: DocumentType.INVOICE,
        resetYear: currentYear,
      },
    },
    update: { currentNumber: maxInv, padding: 4 },
    create: {
      companyId: company.id,
      documentType: DocumentType.INVOICE,
      prefix: 'INV',
      currentNumber: maxInv,
      padding: 4,
      resetYear: currentYear,
    },
  });

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType_resetYear: {
        companyId: company.id,
        documentType: DocumentType.WAYBILL,
        resetYear: currentYear,
      },
    },
    update: { currentNumber: maxWb, padding: 4 },
    create: {
      companyId: company.id,
      documentType: DocumentType.WAYBILL,
      prefix: 'WB',
      currentNumber: maxWb,
      padding: 4,
      resetYear: currentYear,
    },
  });

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType_resetYear: {
        companyId: company.id,
        documentType: DocumentType.LETTER,
        resetYear: currentYear,
      },
    },
    update: { currentNumber: maxLet, padding: 4 },
    create: {
      companyId: company.id,
      documentType: DocumentType.LETTER,
      prefix: 'AOA/LET',
      currentNumber: maxLet,
      padding: 4,
      resetYear: currentYear,
    },
  });

  await prisma.paymentNumberSequence.upsert({
    where: {
      companyId_resetYear: {
        companyId: company.id,
        resetYear: currentYear,
      },
    },
    update: { currentNumber: maxPay, padding: 4 },
    create: {
      companyId: company.id,
      prefix: 'PAY',
      currentNumber: maxPay,
      padding: 4,
      resetYear: currentYear,
    },
  });

  // 9. Default Document Templates (Authored by Akindeji Akinlade)
  console.log('Seeding Standard Document Templates...');
  const invoiceTemplate = await prisma.template.upsert({
    where: { companyId_code: { companyId: company.id, code: 'INV-CORP-CLASSIC' } },
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.INVOICE,
      name: 'Corporate Classic Invoice',
      code: 'INV-CORP-CLASSIC',
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: { templateId_versionNumber: { templateId: invoiceTemplate.id, versionNumber: 1 } },
    update: { createdById: ownerUser.id },
    create: {
      templateId: invoiceTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="invoice-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 15mm; } .invoice-container { font-family: Inter, sans-serif; }',
      createdById: ownerUser.id,
      isActive: true,
    },
  });

  const waybillTemplate = await prisma.template.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WB-LOGISTICS-STD' } },
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.WAYBILL,
      name: 'Standard Logistics Waybill',
      code: 'WB-LOGISTICS-STD',
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: { templateId_versionNumber: { templateId: waybillTemplate.id, versionNumber: 1 } },
    update: { createdById: ownerUser.id },
    create: {
      templateId: waybillTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="waybill-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 15mm; } .waybill-container { font-family: Inter, sans-serif; }',
      createdById: ownerUser.id,
      isActive: true,
    },
  });

  const letterTemplate = await prisma.template.upsert({
    where: { companyId_code: { companyId: company.id, code: 'LET-EXECUTIVE-HEAD' } },
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.LETTER,
      name: 'Executive Corporate Letterhead',
      code: 'LET-EXECUTIVE-HEAD',
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: { templateId_versionNumber: { templateId: letterTemplate.id, versionNumber: 1 } },
    update: { createdById: ownerUser.id },
    create: {
      templateId: letterTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="letter-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 20mm; } .letter-container { font-family: Inter, serif; }',
      createdById: ownerUser.id,
      isActive: true,
    },
  });

  console.log('--- PRODUCTION WORKSPACE SEEDING COMPLETED SUCCESSFULLY ---');
  console.log(`Company: ${company.name} (${company.id})`);
  console.log(`Owner / Managing Director: Akindeji Akinlade <dejakinlade@gmail.com>`);
  console.log(`Role: Super Admin / Managing Director`);
  console.log(`Preserved Documents (Oct 7 till now): ${invDocs.length} Invoices, ${wbDocs.length} Waybills, ${letDocs.length} Letters, ${payRecords.length} Payments`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('Error during database seed execution:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
