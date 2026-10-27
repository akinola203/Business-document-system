import {
  PrismaClient,
  DocumentType,
  ClientType,
  AddressType,
  CompanyUserStatus,
  VendorCategory,
  VendorStatus,
  SupplyOrderStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING DATABASE SEEDING ---');

  // 1. Create or Update Company Profile (AOA 77 COMPANY LTD)
  console.log('Seeding Company: AOA 77 COMPANY LTD...');
  const company = await prisma.company.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    update: {
      name: 'AOA 77 COMPANY LTD',
      legalName: 'AOA 77 COMPANY LTD',
      rcNumber: '9905345...', // Preserved placeholder per instructions
      tin: '2622739227683',
      address: '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria',
      email: 'contact@aoa77.com',
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
      email: 'contact@aoa77.com',
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
      defaultVatRate: 7.50,
      defaultPaymentTermsDays: 30,
      allowSelfApproval: false,
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
      defaultVatRate: 7.50,
      defaultPaymentTermsDays: 30,
      allowSelfApproval: false,
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

  const deptOps = await prisma.department.upsert({
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
      email: 'ota-hq@aoa77.com',
    },
  });

  const branchLagos = await prisma.branch.upsert({
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
    // Company & Organization
    { slug: 'company:view', name: 'View Company Profile', category: 'COMPANY' },
    { slug: 'company:update', name: 'Update Company Profile', category: 'COMPANY' },
    { slug: 'settings:manage', name: 'Manage System Settings', category: 'SETTINGS' },
    { slug: 'audit:view', name: 'View Audit Logs', category: 'AUDIT' },

    // Users & Roles
    { slug: 'users:view', name: 'View Users', category: 'USERS' },
    { slug: 'users:manage', name: 'Create and Edit Users', category: 'USERS' },
    { slug: 'roles:manage', name: 'Manage Roles and Permissions', category: 'USERS' },

    // Clients
    { slug: 'clients:view', name: 'View Clients', category: 'CLIENTS' },
    { slug: 'clients:create', name: 'Create Clients', category: 'CLIENTS' },
    { slug: 'clients:update', name: 'Update Clients', category: 'CLIENTS' },
    { slug: 'clients:disable', name: 'Deactivate Clients', category: 'CLIENTS' },

    // Invoices
    { slug: 'invoice:view', name: 'View Invoices', category: 'INVOICE' },
    { slug: 'invoice:create', name: 'Create Invoice Draft', category: 'INVOICE' },
    { slug: 'invoice:update', name: 'Edit Invoice Draft', category: 'INVOICE' },
    { slug: 'invoice:submit', name: 'Submit Invoice for Approval', category: 'INVOICE' },
    { slug: 'invoice:approve', name: 'Approve or Reject Invoices', category: 'INVOICE' },
    { slug: 'invoice:issue', name: 'Issue Invoice & Generate PDF', category: 'INVOICE' },
    { slug: 'invoice:cancel', name: 'Cancel Invoice', category: 'INVOICE' },
    { slug: 'invoice:archive', name: 'Archive Invoice', category: 'INVOICE' },

    // Payments
    { slug: 'payment:view', name: 'View Payments Ledger', category: 'PAYMENT' },
    { slug: 'payment:record', name: 'Record Invoice Payment', category: 'PAYMENT' },
    { slug: 'payment:reverse', name: 'Reverse Mistaken Payment', category: 'PAYMENT' },

    // Waybills
    { slug: 'waybill:view', name: 'View Waybills', category: 'WAYBILL' },
    { slug: 'waybill:create', name: 'Create Waybill Draft', category: 'WAYBILL' },
    { slug: 'waybill:update', name: 'Edit Waybill Draft', category: 'WAYBILL' },
    { slug: 'waybill:approve', name: 'Approve Waybill', category: 'WAYBILL' },
    { slug: 'waybill:dispatch', name: 'Dispatch Waybill (In Transit)', category: 'WAYBILL' },
    { slug: 'waybill:complete', name: 'Complete Waybill Delivery', category: 'WAYBILL' },
    { slug: 'waybill:cancel', name: 'Cancel Waybill', category: 'WAYBILL' },

    // Letters
    { slug: 'letter:view', name: 'View Business Letters', category: 'LETTER' },
    { slug: 'letter:create', name: 'Create Letter Draft', category: 'LETTER' },
    { slug: 'letter:update', name: 'Edit Letter Draft', category: 'LETTER' },
    { slug: 'letter:approve', name: 'Approve Letter', category: 'LETTER' },
    { slug: 'letter:issue', name: 'Issue Letter & Generate PDF', category: 'LETTER' },
    { slug: 'letter:archive', name: 'Archive Letter', category: 'LETTER' },

    // Reports & Exports
    { slug: 'reports:view', name: 'View Financial & Operational Reports', category: 'REPORTS' },
    { slug: 'documents:export', name: 'Export Document Reports & CSVs', category: 'REPORTS' },

    // Vendors & Supplies
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
  console.log('Seeding Standard Roles...');
  const roleAdmin = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Admin' } },
    update: {},
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

  // Attach Permissions to Roles
  console.log('Mapping Permissions to Roles...');
  // Admin gets all permissions
  for (const slug of Object.keys(dbPermissions)) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleAdmin.id, permissionId: dbPermissions[slug] } },
      update: {},
      create: { roleId: roleAdmin.id, permissionId: dbPermissions[slug] },
    });
  }

  // Manager permissions
  const managerSlugs = [
    'company:view', 'clients:view', 'clients:create', 'clients:update',
    'invoice:view', 'invoice:create', 'invoice:update', 'invoice:submit', 'invoice:approve', 'invoice:issue', 'invoice:cancel',
    'payment:view', 'payment:record', 'payment:reverse',
    'waybill:view', 'waybill:create', 'waybill:update', 'waybill:approve', 'waybill:dispatch', 'waybill:complete', 'waybill:cancel',
    'letter:view', 'letter:create', 'letter:update', 'letter:approve', 'letter:issue',
    'reports:view', 'documents:export',
    'vendors:view', 'vendors:manage', 'supplies:view', 'supplies:manage',
  ];
  for (const slug of managerSlugs) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleManager.id, permissionId: dbPermissions[slug] } },
      update: {},
      create: { roleId: roleManager.id, permissionId: dbPermissions[slug] },
    });
  }

  // Staff permissions
  const staffSlugs = [
    'company:view', 'clients:view', 'clients:create',
    'invoice:view', 'invoice:create', 'invoice:update', 'invoice:submit',
    'payment:view',
    'waybill:view', 'waybill:create', 'waybill:update',
    'letter:view', 'letter:create', 'letter:update',
    'vendors:view', 'supplies:view', 'supplies:manage',
  ];
  for (const slug of staffSlugs) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleStaff.id, permissionId: dbPermissions[slug] } },
      update: {},
      create: { roleId: roleStaff.id, permissionId: dbPermissions[slug] },
    });
  }

  // Viewer permissions
  const viewerSlugs = [
    'company:view', 'clients:view', 'invoice:view', 'waybill:view', 'letter:view', 'reports:view',
    'vendors:view', 'supplies:view',
  ];
  for (const slug of viewerSlugs) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleViewer.id, permissionId: dbPermissions[slug] } },
      update: {},
      create: { roleId: roleViewer.id, permissionId: dbPermissions[slug] },
    });
  }

  // 7. Seed Initial Development Users
  console.log('Seeding Initial Users...');
  const passwordHash = await argon2.hash('Aoa77@Password2026!'); // Standard dev seed password

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aoa77.com' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'admin@aoa77.com',
      passwordHash,
      firstName: 'Alade',
      lastName: 'Adebayo',
      phone: '+234 803 111 2222',
      isActive: true,
    },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: adminUser.id } },
    update: { roleId: roleAdmin.id, branchId: branchOta.id, departmentId: deptAccounts.id },
    create: {
      companyId: company.id,
      userId: adminUser.id,
      roleId: roleAdmin.id,
      branchId: branchOta.id,
      departmentId: deptAccounts.id,
      isOwner: true,
      status: CompanyUserStatus.ACTIVE,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@aoa77.com' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'manager@aoa77.com',
      passwordHash,
      firstName: 'Olumide',
      lastName: 'Ogunlesi',
      phone: '+234 803 333 4444',
      isActive: true,
    },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: managerUser.id } },
    update: { roleId: roleManager.id, branchId: branchOta.id, departmentId: deptAccounts.id },
    create: {
      companyId: company.id,
      userId: managerUser.id,
      roleId: roleManager.id,
      branchId: branchOta.id,
      departmentId: deptAccounts.id,
      isOwner: false,
      status: CompanyUserStatus.ACTIVE,
    },
  });

  // 8. Document Number Sequences (Atomic Counters)
  console.log('Seeding Document Number Sequences...');
  const currentYear = new Date().getFullYear();

  await prisma.documentNumberSequence.upsert({
    where: {
      companyId_documentType_resetYear: {
        companyId: company.id,
        documentType: DocumentType.INVOICE,
        resetYear: currentYear,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.INVOICE,
      prefix: 'INV',
      currentNumber: 0,
      padding: 6,
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
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.WAYBILL,
      prefix: 'WB',
      currentNumber: 0,
      padding: 6,
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
    update: {},
    create: {
      companyId: company.id,
      documentType: DocumentType.LETTER,
      prefix: 'AOA/LET',
      currentNumber: 0,
      padding: 4,
      resetYear: currentYear,
    },
  });

  // 9. Default Document Templates
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
    update: {},
    create: {
      templateId: invoiceTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="invoice-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 15mm; } .invoice-container { font-family: Inter, sans-serif; }',
      createdById: adminUser.id,
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
    update: {},
    create: {
      templateId: waybillTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="waybill-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 15mm; } .waybill-container { font-family: Inter, sans-serif; }',
      createdById: adminUser.id,
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
    update: {},
    create: {
      templateId: letterTemplate.id,
      versionNumber: 1,
      layoutEngine: 'PUPPETEER_HTML',
      htmlStructure: '<div class="letter-container">{{content}}</div>',
      cssStyles: '@page { size: A4; margin: 20mm; } .letter-container { font-family: Inter, serif; }',
      createdById: adminUser.id,
      isActive: true,
    },
  });

  // 10. Demo Clients (Realistic Nigerian Corporate Accounts for Testing)
  console.log('Seeding Demo Clients...');
  const client1 = await prisma.client.upsert({
    where: { companyId_clientNumber: { companyId: company.id, clientNumber: 'CLI-00001' } },
    update: {},
    create: {
      companyId: company.id,
      clientNumber: 'CLI-00001',
      type: ClientType.COMPANY,
      name: 'Dangote Cement Plc',
      companyName: 'Dangote Cement Plc (Ibese Plant)',
      email: 'procurement.ibese@dangote.com',
      phone: '+234 1 448 0815',
      tin: '001239485761',
      notes: 'Key industrial manufacturing client in Ogun corridor.',
      status: 'ACTIVE',
      balance: 0.00,
      creditLimit: 50000000.00,
    },
  });

  await prisma.clientAddress.create({
    data: {
      clientId: client1.id,
      type: AddressType.BILLING,
      addressLine1: 'Marble House, 1 Alfred Rewane Road',
      city: 'Ikoyi',
      state: 'Lagos',
      country: 'Nigeria',
      isDefault: true,
    },
  });

  await prisma.clientAddress.create({
    data: {
      clientId: client1.id,
      type: AddressType.SHIPPING,
      addressLine1: 'Dangote Cement Works, Ibese Works Complex',
      city: 'Ibese, Yewa North',
      state: 'Ogun State',
      country: 'Nigeria',
      isDefault: false,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { companyId_clientNumber: { companyId: company.id, clientNumber: 'CLI-00002' } },
    update: {},
    create: {
      companyId: company.id,
      clientNumber: 'CLI-00002',
      type: ClientType.COMPANY,
      name: 'Flour Mills of Nigeria Plc',
      companyName: 'Flour Mills of Nigeria (Agbara Industrial Plant)',
      email: 'purchasing@fmnplc.com',
      phone: '+234 1 270 0410',
      tin: '009876543210',
      notes: 'Agbara Industrial Zone manufacturing partner.',
      status: 'ACTIVE',
      balance: 0.00,
      creditLimit: 25000000.00,
    },
  });

  await prisma.clientAddress.create({
    data: {
      clientId: client2.id,
      type: AddressType.BILLING,
      addressLine1: 'Plot 2, Agbara Industrial Estate',
      city: 'Agbara',
      state: 'Ogun State',
      country: 'Nigeria',
      isDefault: true,
    },
  });

  // 12. Seed Corporate Vendors
  console.log('Seeding Corporate Vendors...');
  const vendor1 = await prisma.vendor.upsert({
    where: { companyId_vendorCode: { companyId: company.id, vendorCode: 'VND-0001' } },
    update: {},
    create: {
      companyId: company.id,
      vendorCode: 'VND-0001',
      name: 'NNPC Retail Logistics & Fuels',
      category: VendorCategory.LOGISTICS_HAULAGE,
      contactPerson: 'Engr. Farouk Ahmed',
      email: 'logistics@nnpcretail.com',
      phone: '+234 803 111 2233',
      taxId: '24891044-0001',
      registrationNumber: 'RC-184920',
      address: 'Plot 7 NNPC Towers, Herbert Macaulay Way, CBD',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      bankName: 'Globus Bank Plc',
      bankAccountName: 'NNPC Retail Logistics Ltd',
      bankAccountNumber: '1000652199',
      paymentTerms: 'Net 30 Days',
      totalSuppliedAmount: 24500000.0,
      outstandingPayable: 4200000.0,
      status: VendorStatus.ACTIVE,
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { companyId_vendorCode: { companyId: company.id, vendorCode: 'VND-0002' } },
    update: {},
    create: {
      companyId: company.id,
      vendorCode: 'VND-0002',
      name: 'Julius Berger Plant & Fleet Services',
      category: VendorCategory.SERVICES,
      contactPerson: 'Klaus Reinhardt',
      email: 'fleet@julius-berger.com',
      phone: '+234 802 222 3344',
      taxId: '10023456-0002',
      registrationNumber: 'RC-112349',
      address: '10 Shettima A. Munguno Crescent, Utako',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      bankName: 'Zenith Bank Plc',
      bankAccountName: 'Julius Berger Plant Services',
      bankAccountNumber: '2004567890',
      paymentTerms: 'Net 15 Days',
      totalSuppliedAmount: 18400000.0,
      outstandingPayable: 0.0,
      status: VendorStatus.ACTIVE,
    },
  });

  const vendor3 = await prisma.vendor.upsert({
    where: { companyId_vendorCode: { companyId: company.id, vendorCode: 'VND-0003' } },
    update: {},
    create: {
      companyId: company.id,
      vendorCode: 'VND-0003',
      name: 'WAPC Packaging & Building Materials',
      category: VendorCategory.RAW_MATERIALS,
      contactPerson: 'Chief Tunde Balogun',
      email: 'orders@wapc-packaging.ng',
      phone: '+234 805 333 4455',
      taxId: '19482011-0003',
      registrationNumber: 'RC-294810',
      address: 'Km 38 Abeokuta Express Road, Ewekoro',
      city: 'Ewekoro',
      state: 'Ogun State',
      country: 'Nigeria',
      bankName: 'First Bank of Nigeria',
      bankAccountName: 'WAPC Packaging Solutions',
      bankAccountNumber: '3001234567',
      paymentTerms: 'Immediate',
      totalSuppliedAmount: 34500000.0,
      outstandingPayable: 2500000.0,
      status: VendorStatus.ACTIVE,
    },
  });

  const vendor4 = await prisma.vendor.upsert({
    where: { companyId_vendorCode: { companyId: company.id, vendorCode: 'VND-0004' } },
    update: {},
    create: {
      companyId: company.id,
      vendorCode: 'VND-0004',
      name: 'TotalEnergies Industrial Solutions',
      category: VendorCategory.EQUIPMENT,
      contactPerson: 'Mme. Claire Dubois',
      email: 'industrial@totalenergies.ng',
      phone: '+234 809 444 5566',
      taxId: '30192844-0004',
      registrationNumber: 'RC-394812',
      address: 'Plot 24 Karimu Kotun Street, Victoria Island',
      city: 'Lagos',
      state: 'Lagos State',
      country: 'Nigeria',
      bankName: 'Access Bank Plc',
      bankAccountName: 'TotalEnergies Industrial Ltd',
      bankAccountNumber: '0019283746',
      paymentTerms: 'Net 45 Days',
      totalSuppliedAmount: 12000000.0,
      outstandingPayable: 0.0,
      status: VendorStatus.ACTIVE,
    },
  });

  // 13. Seed Supply Catalog Items
  console.log('Seeding Supply Items Catalog...');
  const item1 = await prisma.supplyItem.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'SUP-CEM-001' } },
    update: {},
    create: {
      companyId: company.id,
      preferredVendorId: vendor3.id,
      sku: 'SUP-CEM-001',
      name: 'Portland Limestone Cement 50kg',
      category: 'RAW_MATERIALS',
      description: 'High-performance grade 42.5N building cement for heavy engineering construction.',
      unit: 'Bags',
      unitCost: 6800.0,
      sellingPrice: 8500.0,
      taxRate: 7.5,
      currentStock: 1250.0,
      reorderLevel: 200.0,
      isActive: true,
    },
  });

  await prisma.supplyItem.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'SUP-AGO-002' } },
    update: {},
    create: {
      companyId: company.id,
      preferredVendorId: vendor1.id,
      sku: 'SUP-AGO-002',
      name: 'AGO Automotive Gas Oil (Diesel)',
      category: 'FUEL',
      description: 'Refined low-sulfur diesel fuel for heavy generator sets and transport fleet.',
      unit: 'Litres',
      unitCost: 1150.0,
      sellingPrice: 1420.0,
      taxRate: 7.5,
      currentStock: 18000.0,
      reorderLevel: 5000.0,
      isActive: true,
    },
  });

  await prisma.supplyItem.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'SUP-FLAT-003' } },
    update: {},
    create: {
      companyId: company.id,
      preferredVendorId: vendor2.id,
      sku: 'SUP-FLAT-003',
      name: 'Heavy Duty Flatbed Haulage (30-Ton)',
      category: 'LOGISTICS_HAULAGE',
      description: 'Interstate haulage service with dedicated GPS tracking and logistics escort.',
      unit: 'Trips',
      unitCost: 320000.0,
      sellingPrice: 450000.0,
      taxRate: 7.5,
      currentStock: 25.0,
      reorderLevel: 5.0,
      isActive: true,
    },
  });

  await prisma.supplyItem.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'SUP-GRN-004' } },
    update: {},
    create: {
      companyId: company.id,
      preferredVendorId: vendor4.id,
      sku: 'SUP-GRN-004',
      name: 'Industrial Aggregate Granite (3/4 Inch)',
      category: 'RAW_MATERIALS',
      description: 'Clean crushed quarry granite stone for reinforced concrete casting.',
      unit: 'Tons',
      unitCost: 12500.0,
      sellingPrice: 16000.0,
      taxRate: 7.5,
      currentStock: 480.0,
      reorderLevel: 100.0,
      isActive: true,
    },
  });

  // 14. Seed Sample Supply Order
  console.log('Seeding Supply Orders...');
  await prisma.supplyOrder.upsert({
    where: { companyId_supplyNumber: { companyId: company.id, supplyNumber: 'SUP-2026-0001' } },
    update: {},
    create: {
      companyId: company.id,
      vendorId: vendor3.id,
      supplyNumber: 'SUP-2026-0001',
      supplyDate: new Date('2026-06-01T10:00:00Z'),
      deliveryRef: 'WAPC/DEL/2026/8941',
      status: SupplyOrderStatus.RECEIVED,
      currency: 'NGN',
      subtotal: 3400000.0,
      taxTotal: 255000.0,
      grandTotal: 3655000.0,
      amountPaid: 3655000.0,
      notes: 'Initial warehouse replenishment batch - 500 bags delivered to Ota Terminal.',
      receivedAt: new Date('2026-06-02T14:30:00Z'),
      items: {
        create: [
          {
            supplyItemId: item1.id,
            description: 'Portland Limestone Cement 50kg (Batch EWE-01)',
            unit: 'Bags',
            quantity: 500,
            unitCost: 6800.0,
            lineTotal: 3400000.0,
          },
        ],
      },
    },
  });

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
  console.log(`Company ID: ${company.id}`);
  console.log(`Admin User: admin@aoa77.com (Password: Aoa77@Password2026!)`);
  console.log(`Manager User: manager@aoa77.com (Password: Aoa77@Password2026!)`);
}

main()
  .catch((e) => {
    console.error('Error during database seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
