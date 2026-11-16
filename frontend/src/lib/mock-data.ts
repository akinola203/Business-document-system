import {
  Client,
  DocumentRecord,
  PaymentRecord,
  Company,
  Role,
  CompanyUser,
  DocumentTemplate,
  AuditLog,
  DocumentNumberingConfig,
  ReportsSummary,
  NotificationItem,
  Vendor,
  SupplyItem,
  SupplyOrder,
} from '../types';

// Clean production workspace: zero hardcoded demo records or fake financial metrics.
export const DEMO_CLIENTS: Client[] = [];
export const DEMO_INVOICES: DocumentRecord[] = [];
export const DEMO_WAYBILLS: DocumentRecord[] = [];
export const DEMO_LETTERS: DocumentRecord[] = [];
export const DEMO_PAYMENTS: PaymentRecord[] = [];
export const DEMO_AUDIT_LOGS: AuditLog[] = [];
export const DEMO_NOTIFICATIONS: NotificationItem[] = [];
export const DEMO_VENDORS: Vendor[] = [];
export const DEMO_SUPPLIES: SupplyItem[] = [];
export const DEMO_SUPPLY_ITEMS: SupplyItem[] = [];
export const DEMO_SUPPLY_ORDERS: SupplyOrder[] = [];

export const DEMO_COMPANY: Company = {
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
  settings: {
    bankName: 'Globus Bank',
    bankAccountName: 'AOA 77 COMPANY LTD',
    bankAccountNumber: '1000652112',
    bankSortCode: '103',
    showBankDetailsOnInvoice: true,
    showBankDetailsOnWaybill: false,
    showBankDetailsOnLetter: false,
    defaultVatRate: 7.5,
    defaultPaymentTermsDays: 30,
    allowSelfApproval: true,
  },
};

export const DEMO_NUMBERING: DocumentNumberingConfig[] = [
  {
    id: 'num-inv-01',
    documentType: 'INVOICE',
    prefix: 'INV-',
    suffix: null,
    nextNumber: 1,
    padding: 4,
    resetPeriod: 'YEARLY',
    pattern: '{PREFIX}{YEAR}-{NUMBER}',
  },
  {
    id: 'num-wb-01',
    documentType: 'WAYBILL',
    prefix: 'WB-',
    suffix: null,
    nextNumber: 1,
    padding: 4,
    resetPeriod: 'YEARLY',
    pattern: '{PREFIX}{YEAR}-{NUMBER}',
  },
  {
    id: 'num-ltr-01',
    documentType: 'LETTER',
    prefix: 'AOA/LET/',
    suffix: null,
    nextNumber: 1,
    padding: 4,
    resetPeriod: 'YEARLY',
    pattern: '{PREFIX}{YEAR}/{NUMBER}',
  },
];

export const DEMO_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl-inv-finnova',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    code: 'INV-CORP-CLASSIC',
    name: 'Corporate Classic Invoice',
    documentType: 'INVOICE',
    description: 'Corporate high-contrast invoice layout with Akindeji Akinlade signatory block and bank settlement strip',
    isDefault: true,
    config: {
      primaryColor: '#5847F6',
      accentColor: '#4939E3',
      fontFamily: 'Inter',
      logoPosition: 'left',
      showBankDetails: true,
      showStamp: true,
      showSignature: true,
      showQrCode: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-wb-logistics',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    code: 'WB-LOGISTICS-STD',
    name: 'Standard Logistics Waybill',
    documentType: 'WAYBILL',
    description: 'Dispatch and delivery receipt layout with vehicle details and cargo table',
    isDefault: true,
    config: {
      primaryColor: '#0284C7',
      accentColor: '#0369A1',
      fontFamily: 'Inter',
      logoPosition: 'left',
      showBankDetails: false,
      showStamp: true,
      showSignature: true,
      showQrCode: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-ltr-executive',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    code: 'LET-EXECUTIVE-HEAD',
    name: 'Executive Corporate Letterhead',
    documentType: 'LETTER',
    description: 'Formal corporate letterhead with Managing Director sign-off',
    isDefault: true,
    config: {
      primaryColor: '#059669',
      accentColor: '#047857',
      fontFamily: 'Plus Jakarta Sans',
      logoPosition: 'center',
      showBankDetails: false,
      showStamp: true,
      showSignature: true,
      showQrCode: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEMO_ROLES: Role[] = [
  {
    id: 'role-md',
    name: 'Super Admin / Managing Director',
    description: 'Company Owner & Managing Director with unrestricted authority across all operations',
    isSystem: true,
    rolePermissions: [
      { permission: { id: 'p1', slug: '*:*', name: 'Global Administrator', category: 'SYSTEM' } },
    ],
  },
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full administrative access across all company operations',
    isSystem: true,
    rolePermissions: [
      { permission: { id: 'p1', slug: '*:*', name: 'Global Administrator', category: 'SYSTEM' } },
    ],
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Document approval, issuance, dispatch, and account balance review',
    isSystem: true,
    rolePermissions: [
      { permission: { id: 'p2', slug: 'invoice:*', name: 'Manage Invoices', category: 'INVOICES' } },
      { permission: { id: 'p3', slug: 'waybill:*', name: 'Manage Waybills', category: 'WAYBILLS' } },
      { permission: { id: 'p4', slug: 'letter:*', name: 'Manage Letters', category: 'LETTERS' } },
      { permission: { id: 'p5', slug: 'payment:*', name: 'Manage Payments', category: 'PAYMENTS' } },
      { permission: { id: 'p6', slug: 'clients:*', name: 'Manage Clients', category: 'CLIENTS' } },
    ],
  },
  {
    id: 'role-staff',
    name: 'Staff',
    description: 'Creates draft invoices, waybills, and letters; records dispatches; views client profiles',
    isSystem: true,
    rolePermissions: [
      { permission: { id: 'p7', slug: 'invoice:create', name: 'Create Invoices', category: 'INVOICES' } },
      { permission: { id: 'p8', slug: 'waybill:create', name: 'Create Waybills', category: 'WAYBILLS' } },
      { permission: { id: 'p9', slug: 'letter:create', name: 'Create Letters', category: 'LETTERS' } },
      { permission: { id: 'p10', slug: 'clients:view', name: 'View Clients', category: 'CLIENTS' } },
    ],
  },
];

export const DEMO_USERS: CompanyUser[] = [
  {
    id: 'c-usr-owner',
    userId: 'usr-owner-akindeji',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    roleId: 'role-md',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    user: {
      id: 'usr-owner-akindeji',
      email: 'dejakinlade@gmail.com',
      fullName: 'Akindeji Akinlade',
      phone: '+234 803 777 7777',
    },
    role: DEMO_ROLES[0],
  },
];

export const DEMO_REPORTS_SUMMARY: ReportsSummary = {
  revenueAndCashflow: {
    invoicedTotal: 0,
    collectedTotal: 0,
    outstandingTotal: 0,
    recoveryRate: 0,
    vatAccrued: 0,
    vatCollected: 0,
    monthlySeries: [],
  },
  agingReceivables: {
    bucket0_30: { amount: 0, count: 0, percent: 0 },
    bucket31_60: { amount: 0, count: 0, percent: 0 },
    bucket61_90: { amount: 0, count: 0, percent: 0 },
    bucket90Plus: { amount: 0, count: 0, percent: 0 },
    totalOverdue: 0,
  },
  topClients: [],
  logisticsTelemetry: {
    totalConsignments: 0,
    statusBreakdown: {
      PREPARING: 0,
      READY_FOR_DISPATCH: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      DELIVERY_FAILED: 0,
      CANCELLED: 0,
    },
    onTimeDeliveryRate: 0,
    averageTransitDays: 0,
  },
  documentVelocity: {
    totalDocuments: 0,
    byType: {
      INVOICE: 0,
      WAYBILL: 0,
      LETTER: 0,
    },
    byStatus: {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      ISSUED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    },
    averageApprovalHours: 0,
  },
};
