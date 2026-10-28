// =============================================================================
// BACKEND-ALIGNED DOMAIN ENUMS
// =============================================================================

export type DocumentType = 'INVOICE' | 'WAYBILL' | 'LETTER';

export type DocumentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ISSUED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type WaybillDeliveryStatus =
  | 'PREPARING'
  | 'READY_FOR_DISPATCH'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID';

export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CHEQUE'
  | 'POS'
  | 'ONLINE_GATEWAY'
  | 'OTHER';

export type ClientType = 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT';

export type AddressType = 'BILLING' | 'SHIPPING' | 'REGISTERED' | 'OPERATIONAL';

export type CompanyUserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';

export type FileCategory =
  | 'ATTACHMENT'
  | 'GENERATED_PDF'
  | 'LOGO'
  | 'SIGNATURE'
  | 'STAMP';

// =============================================================================
// AUTH & IAM INTERFACES
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleName?: string;
  permissions: string[];
  companyId: string;
  companyName: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Permission {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface Role {
  id: string;
  companyId?: string | null;
  name: string;
  description?: string | null;
  isSystem: boolean;
  rolePermissions: Array<{
    permission: Permission;
  }>;
}

export interface CompanyUser {
  id: string;
  userId: string;
  companyId: string;
  roleId: string;
  status: CompanyUserStatus;
  user: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };
  role: Role;
  createdAt: string;
}

// =============================================================================
// COMPANY & SETTINGS
// =============================================================================

export interface CompanySetting {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankSortCode?: string | null;
  showBankDetailsOnInvoice: boolean;
  showBankDetailsOnWaybill: boolean;
  showBankDetailsOnLetter: boolean;
  defaultVatRate: number;
  defaultPaymentTermsDays: number;
  allowSelfApproval: boolean;
}

export interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  rcNumber?: string | null;
  tin?: string | null;
  address: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoFileId?: string | null;
  defaultCurrency: string;
  settings?: CompanySetting | null;
}

// =============================================================================
// CLIENTS & ADDRESSES
// =============================================================================

export interface ClientAddress {
  id: string;
  clientId: string;
  type: AddressType;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

export interface Client {
  id: string;
  companyId: string;
  clientNumber: string;
  type: ClientType;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  rcNumber?: string | null;
  notes?: string | null;
  creditLimit?: number | string | null;
  paymentTermsDays?: number | null;
  isActive: boolean;
  address?: string | null;
  addresses?: ClientAddress[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// DOCUMENTS & SPECIALIZATIONS
// =============================================================================

export interface InvoiceItem {
  id?: string;
  lineNumber: number;
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
  discountPercent?: number | string;
  taxRate?: number | string;
  taxAmount?: number | string;
  lineTotal: number | string;
}

export interface InvoiceSpecialization {
  id: string;
  documentId: string;
  poNumber?: string | null;
  paymentTerms?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  items: InvoiceItem[];
}

export interface WaybillItem {
  id?: string;
  lineNumber: number;
  description: string;
  quantity: number | string;
  unit: string;
  weightKg?: number | string | null;
  packageCount?: number | null;
  packageType?: string | null;
}

export interface WaybillSpecialization {
  id: string;
  documentId: string;
  invoiceId?: string | null;
  shipmentDate: string;
  originAddress: string;
  destinationAddress: string;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  trackingNumber?: string | null;
  deliveryStatus: WaybillDeliveryStatus;
  receivedByName?: string | null;
  receivedDate?: string | null;
  items: WaybillItem[];
}

export interface LetterSpecialization {
  id: string;
  documentId: string;
  letterDate: string;
  recipientName: string;
  recipientTitle?: string | null;
  recipientOrganization?: string | null;
  recipientAddress?: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  signatoryName: string;
  signatoryTitle?: string | null;
  signatoryDepartment?: string | null;
}

export interface DocumentApproval {
  id: string;
  stepNumber: number;
  approverId: string;
  approver: {
    id: string;
    fullName: string;
    email: string;
  };
  status: ApprovalStatus;
  comment?: string | null;
  actionDate?: string | null;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  snapshotData: Record<string, any>;
  pdfFileId?: string | null;
  createdById: string;
  changeReason?: string | null;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  companyId: string;
  documentNumber: string;
  documentType: DocumentType;
  title: string;
  status: DocumentStatus;
  issueDate?: string | null;
  currency: string;
  subtotal?: number | string;
  subtotalAmount?: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  balanceDue: number | string;
  paymentStatus?: PaymentStatus;
  isOverdue?: boolean;
  version: number; // For Optimistic Concurrency Control (OCC)
  isArchived: boolean;
  clientId?: string | null;
  client?: Client | null;
  branchId?: string | null;
  departmentId?: string | null;
  createdById: string;
  templateId?: string | null;
  bankDetailsVisible?: boolean | null;
  createdAt: string;
  updatedAt: string;

  // Polymorphic specializations
  invoice?: InvoiceSpecialization | null;
  waybill?: WaybillSpecialization | null;
  letter?: LetterSpecialization | null;

  approvals?: DocumentApproval[];
  versions?: DocumentVersion[];
}

// =============================================================================
// PAYMENTS & SETTLEMENTS
// =============================================================================

export interface PaymentRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  paymentNumber: string;
  amount: number | string;
  currency: string;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber: string;
  notes?: string | null;
  recordedById: string;
  recordedBy?: {
    id: string;
    fullName: string;
  };
  isReversed: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
  createdAt: string;
  invoice?: {
    id: string;
    documentNumber?: string;
    document?: {
      documentNumber: string;
      title: string;
      client?: {
        name: string;
      };
    };
  };
}

export interface InvoiceLedgerSummary {
  invoiceId: string;
  documentNumber: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  overpaymentAmount: string;
  currency: string;
  paymentStatus: PaymentStatus;
  isOverdue: boolean;
  payments: PaymentRecord[];
}

// =============================================================================
// PAGINATION & API RESPONSES
// =============================================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// TEMPLATES & BRANDING LAYOUTS
// =============================================================================

export interface TemplateLayoutConfig {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoPosition: 'left' | 'center' | 'right';
  showBankDetails: boolean;
  showStamp: boolean;
  showSignature: boolean;
  showQrCode: boolean;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  config: TemplateLayoutConfig;
  isActive: boolean;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  companyId: string;
  code: string;
  name: string;
  documentType: DocumentType;
  description?: string | null;
  isDefault: boolean;
  config: TemplateLayoutConfig;
  versions?: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// AUDIT LOGS
// =============================================================================

export interface AuditLog {
  id: string;
  companyId: string;
  actorId?: string | null;
  actor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// =============================================================================
// NUMBERING CONFIG
// =============================================================================

export interface DocumentNumberingConfig {
  id: string;
  documentType: DocumentType;
  prefix: string;
  suffix?: string | null;
  nextNumber: number;
  padding: number;
  resetPeriod: 'NONE' | 'YEARLY' | 'MONTHLY';
  pattern: string;
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export interface NotificationItem {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: {
    documentId?: string;
    documentNumber?: string;
    documentType?: DocumentType;
    actorName?: string;
    amount?: number | string;
    clientName?: string;
    route?: string;
    [key: string]: any;
  } | null;
  createdAt: string;
}

// =============================================================================
// FINANCIAL & OPERATIONAL REPORTS
// =============================================================================

export interface ReportsSummary {
  revenueAndCashflow: {
    invoicedTotal: number;
    collectedTotal: number;
    outstandingTotal: number;
    recoveryRate: number;
    vatAccrued: number;
    vatCollected: number;
    monthlySeries: Array<{
      month: string;
      invoicedTotal: number;
      collectedTotal: number;
      outstandingTotal: number;
    }>;
  };
  agingReceivables: {
    bucket0_30: { amount: number; count: number; percent: number };
    bucket31_60: { amount: number; count: number; percent: number };
    bucket61_90: { amount: number; count: number; percent: number };
    bucket90Plus: { amount: number; count: number; percent: number };
    totalOverdue: number;
  };
  topClients: Array<{
    id: string;
    name: string;
    clientNumber: string;
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
    creditLimit: number | null;
    creditUtilization: number;
  }>;
  logisticsTelemetry: {
    totalConsignments: number;
    statusBreakdown: Record<string, number>;
    onTimeDeliveryRate: number;
    averageTransitDays: number;
  };
  documentVelocity: {
    totalDocuments: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    averageApprovalHours: number;
  };
}

// =============================================================================
// VENDORS & SUPPLIERS
// =============================================================================

export type VendorCategory = 
  | 'RAW_MATERIALS' 
  | 'LOGISTICS_HAULAGE' 
  | 'EQUIPMENT' 
  | 'PACKAGING' 
  | 'SERVICES' 
  | 'GENERAL';

export type VendorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Vendor {
  id: string;
  companyId: string;
  vendorCode: string;
  name: string;
  category: VendorCategory;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  paymentTerms?: string | null;
  currency: string;
  status: VendorStatus;
  notes?: string | null;
  totalSuppliedAmount: number;
  outstandingPayable: number;
  createdAt?: string;
  updatedAt?: string;
  items?: SupplyItem[];
  orders?: SupplyOrder[];
  _count?: {
    items?: number;
    orders?: number;
  };
}

// =============================================================================
// SUPPLIES & ITEMS CATALOG
// =============================================================================

export interface SupplyItem {
  id: string;
  companyId: string;
  preferredVendorId?: string | null;
  sku: string;
  name: string;
  category?: string | null;
  description?: string | null;
  unit: string;
  unitCost: number;
  sellingPrice: number;
  taxRate: number;
  currentStock: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  preferredVendor?: {
    id: string;
    name: string;
    vendorCode: string;
  } | null;
}

// =============================================================================
// SUPPLY ORDERS & PURCHASE RECEIPTS
// =============================================================================

export type SupplyOrderStatus = 
  | 'ORDERED' 
  | 'RECEIVED' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'CANCELLED';

export interface SupplyOrderItem {
  id: string;
  supplyOrderId: string;
  supplyItemId?: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  supplyItem?: SupplyItem;
}

export interface SupplyOrder {
  id: string;
  companyId: string;
  supplyNumber: string;
  vendorId: string;
  supplyDate: string;
  deliveryRef?: string | null;
  status: SupplyOrderStatus;
  currency: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vendor?: {
    id: string;
    name: string;
    vendorCode: string;
    category?: string;
  };
  items?: SupplyOrderItem[];
}

