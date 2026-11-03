import {
  DEMO_CLIENTS,
  DEMO_INVOICES,
  DEMO_WAYBILLS,
  DEMO_LETTERS,
  DEMO_PAYMENTS,
  DEMO_COMPANY,
  DEMO_NUMBERING,
  DEMO_TEMPLATES,
  DEMO_ROLES,
  DEMO_USERS,
  DEMO_AUDIT_LOGS,
  DEMO_REPORTS_SUMMARY,
  DEMO_NOTIFICATIONS,
  DEMO_VENDORS,
  DEMO_SUPPLIES,
  DEMO_SUPPLY_ORDERS,
} from '../lib/mock-data';
import {
  DocumentRecord,
  Client,
  PaymentRecord,
  Company,
  DocumentTemplate,
  AuditLog,
  ReportsSummary,
  NotificationItem,
  Vendor,
  SupplyItem,
  SupplyOrder,
  Role,
  CompanyUser,
} from '../types';

export const STORAGE_KEYS = {
  INVOICES: 'aoa_portfolio_invoices_v1',
  WAYBILLS: 'aoa_portfolio_waybills_v1',
  LETTERS: 'aoa_portfolio_letters_v1',
  CLIENTS: 'aoa_portfolio_clients_v1',
  PAYMENTS: 'aoa_portfolio_payments_v1',
  COMPANY: 'aoa_portfolio_company_v1',
  TEMPLATES: 'aoa_portfolio_templates_v1',
  AUDIT_LOGS: 'aoa_portfolio_audit_logs_v1',
  REPORTS: 'aoa_portfolio_reports_v1',
  NOTIFICATIONS: 'aoa_portfolio_notifications_v1',
  VENDORS: 'aoa_portfolio_vendors_v1',
  SUPPLIES: 'aoa_portfolio_supplies_v1',
  SUPPLY_ORDERS: 'aoa_portfolio_supply_orders_v1',
  USERS: 'aoa_portfolio_users_v1',
  ROLES: 'aoa_portfolio_roles_v1',
};

function safeGetStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Portfolio Mock Store] Failed to parse key ${key}:`, err);
    return fallback;
  }
}

function safeSetStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Portfolio Mock Store] Failed to write key ${key}:`, err);
  }
}

export class PortfolioMockStore {
  // Invoices
  static getInvoices(): DocumentRecord[] {
    return safeGetStorage<DocumentRecord[]>(STORAGE_KEYS.INVOICES, DEMO_INVOICES);
  }

  static saveInvoices(invoices: DocumentRecord[]): void {
    safeSetStorage(STORAGE_KEYS.INVOICES, invoices);
  }

  static getInvoiceById(id: string): DocumentRecord | undefined {
    const list = this.getInvoices();
    return list.find((i) => i.id === id || i.documentNumber === id);
  }

  static addInvoice(doc: DocumentRecord): DocumentRecord {
    const list = this.getInvoices();
    const existingIndex = list.findIndex((i) => i.id === doc.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...doc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(doc);
    }
    this.saveInvoices(list);
    return doc;
  }

  // Waybills
  static getWaybills(): DocumentRecord[] {
    return safeGetStorage<DocumentRecord[]>(STORAGE_KEYS.WAYBILLS, DEMO_WAYBILLS);
  }

  static saveWaybills(waybills: DocumentRecord[]): void {
    safeSetStorage(STORAGE_KEYS.WAYBILLS, waybills);
  }

  static getWaybillById(id: string): DocumentRecord | undefined {
    const list = this.getWaybills();
    return list.find((w) => w.id === id || w.documentNumber === id);
  }

  static addWaybill(doc: DocumentRecord): DocumentRecord {
    const list = this.getWaybills();
    const existingIndex = list.findIndex((w) => w.id === doc.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...doc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(doc);
    }
    this.saveWaybills(list);
    return doc;
  }

  // Letters
  static getLetters(): DocumentRecord[] {
    return safeGetStorage<DocumentRecord[]>(STORAGE_KEYS.LETTERS, DEMO_LETTERS);
  }

  static saveLetters(letters: DocumentRecord[]): void {
    safeSetStorage(STORAGE_KEYS.LETTERS, letters);
  }

  static getLetterById(id: string): DocumentRecord | undefined {
    const list = this.getLetters();
    return list.find((l) => l.id === id || l.documentNumber === id);
  }

  static addLetter(doc: DocumentRecord): DocumentRecord {
    const list = this.getLetters();
    const existingIndex = list.findIndex((l) => l.id === doc.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...doc, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(doc);
    }
    this.saveLetters(list);
    return doc;
  }

  // Unified Document search
  static getAllDocuments(type?: string): DocumentRecord[] {
    const invoices = this.getInvoices();
    const waybills = this.getWaybills();
    const letters = this.getLetters();
    const all = [...invoices, ...waybills, ...letters];
    if (type) {
      return all.filter((d) => d.documentType === type.toUpperCase());
    }
    return all;
  }

  static getDocumentById(id: string): DocumentRecord | undefined {
    return (
      this.getInvoiceById(id) ||
      this.getWaybillById(id) ||
      this.getLetterById(id)
    );
  }

  static saveDocument(doc: DocumentRecord): DocumentRecord {
    if (doc.documentType === 'INVOICE') return this.addInvoice(doc);
    if (doc.documentType === 'WAYBILL') return this.addWaybill(doc);
    if (doc.documentType === 'LETTER') return this.addLetter(doc);
    return this.addInvoice(doc);
  }

  // Clients
  static getClients(): Client[] {
    return safeGetStorage<Client[]>(STORAGE_KEYS.CLIENTS, DEMO_CLIENTS);
  }

  static saveClients(clients: Client[]): void {
    safeSetStorage(STORAGE_KEYS.CLIENTS, clients);
  }

  static addClient(client: Client): Client {
    const list = this.getClients();
    list.unshift(client);
    this.saveClients(list);
    return client;
  }

  // Payments
  static getPayments(): PaymentRecord[] {
    return safeGetStorage<PaymentRecord[]>(STORAGE_KEYS.PAYMENTS, DEMO_PAYMENTS);
  }

  static savePayments(payments: PaymentRecord[]): void {
    safeSetStorage(STORAGE_KEYS.PAYMENTS, payments);
  }

  static recordPayment(payment: PaymentRecord): PaymentRecord {
    const list = this.getPayments();
    list.unshift(payment);
    this.savePayments(list);

    // Update corresponding invoice balance if linked
    const targetInvoiceId = payment.invoiceId || (payment as any).documentId;
    if (targetInvoiceId) {
      const invoices = this.getInvoices();
      const targetInv = invoices.find((i) => i.id === targetInvoiceId);
      if (targetInv) {
        const remaining = Math.max(0, Number(targetInv.balanceDue || 0) - Number(payment.amount || 0));
        targetInv.balanceDue = remaining;
        targetInv.paymentStatus = remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        this.saveInvoices(invoices);
      }
    }

    return payment;
  }

  static reversePayment(paymentId: string, reason = 'Administrative settlement reversal'): PaymentRecord | null {
    const list = this.getPayments();
    const target = list.find((p) => p.id === paymentId || p.paymentNumber === paymentId);
    if (!target) return null;

    target.isReversed = true;
    this.savePayments(list);

    // Restore invoice balance
    const targetInvoiceId = target.invoiceId || (target as any).documentId;
    if (targetInvoiceId) {
      const invoices = this.getInvoices();
      const targetInv = invoices.find((i) => i.id === targetInvoiceId);
      if (targetInv) {
        targetInv.balanceDue = Number(targetInv.balanceDue || 0) + Number(target.amount || 0);
        targetInv.paymentStatus =
          Number(targetInv.balanceDue) >= Number(targetInv.totalAmount) ? 'UNPAID' : 'PARTIALLY_PAID';
        this.saveInvoices(invoices);
      }
    }

    // Add audit log
    this.addAuditLog({
      id: `audit-${Date.now()}`,
      action: 'PAYMENT_REVERSED',
      entityType: 'Payment',
      entityId: target.id,
      description: `Payment ${target.paymentNumber} reversed. Reason: ${reason}`,
      createdAt: new Date().toISOString(),
      user: {
        id: 'usr-portfolio-admin',
        fullName: 'Executive Portfolio Admin',
        email: 'executive@aoa77.com',
      },
    });

    return target;
  }

  // Vendors
  static getVendors(): Vendor[] {
    return safeGetStorage<Vendor[]>(STORAGE_KEYS.VENDORS, DEMO_VENDORS);
  }

  static saveVendors(vendors: Vendor[]): void {
    safeSetStorage(STORAGE_KEYS.VENDORS, vendors);
  }

  static addVendor(vendor: Vendor): Vendor {
    const list = this.getVendors();
    const idx = list.findIndex((v) => v.id === vendor.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...vendor };
    } else {
      list.unshift(vendor);
    }
    this.saveVendors(list);
    return vendor;
  }

  // Supplies
  static getSupplies(): SupplyItem[] {
    return safeGetStorage<SupplyItem[]>(STORAGE_KEYS.SUPPLIES, DEMO_SUPPLIES);
  }

  static saveSupplies(supplies: SupplyItem[]): void {
    safeSetStorage(STORAGE_KEYS.SUPPLIES, supplies);
  }

  static addSupplyItem(item: SupplyItem): SupplyItem {
    const list = this.getSupplies();
    list.unshift(item);
    this.saveSupplies(list);
    return item;
  }

  static updateSupplyItem(id: string, partial: Partial<SupplyItem>): SupplyItem | null {
    const list = this.getSupplies();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...partial };
    this.saveSupplies(list);
    return list[idx];
  }

  // Supply Orders
  static getSupplyOrders(): SupplyOrder[] {
    return safeGetStorage<SupplyOrder[]>(STORAGE_KEYS.SUPPLY_ORDERS, DEMO_SUPPLY_ORDERS);
  }

  static saveSupplyOrders(orders: SupplyOrder[]): void {
    safeSetStorage(STORAGE_KEYS.SUPPLY_ORDERS, orders);
  }

  static addSupplyOrder(order: SupplyOrder): SupplyOrder {
    const list = this.getSupplyOrders();
    list.unshift(order);
    this.saveSupplyOrders(list);
    return order;
  }

  // Company Profile
  static getCompany(): Company {
    return safeGetStorage<Company>(STORAGE_KEYS.COMPANY, DEMO_COMPANY);
  }

  static saveCompany(company: Company): void {
    safeSetStorage(STORAGE_KEYS.COMPANY, company);
  }

  // Templates
  static getTemplates(documentType?: string): DocumentTemplate[] {
    const all = safeGetStorage<DocumentTemplate[]>(STORAGE_KEYS.TEMPLATES, DEMO_TEMPLATES);
    if (documentType) {
      return all.filter((t) => t.documentType === documentType.toUpperCase());
    }
    return all;
  }

  static saveTemplates(templates: DocumentTemplate[]): void {
    safeSetStorage(STORAGE_KEYS.TEMPLATES, templates);
  }

  static updateTemplate(id: string, config: any): DocumentTemplate | null {
    const list = this.getTemplates();
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], config: { ...list[idx].config, ...config } };
    this.saveTemplates(list);
    return list[idx];
  }

  // Audit Logs
  static getAuditLogs(): AuditLog[] {
    return safeGetStorage<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, DEMO_AUDIT_LOGS);
  }

  static addAuditLog(entry: any): void {
    const list = this.getAuditLogs();
    list.unshift(entry);
    safeSetStorage(STORAGE_KEYS.AUDIT_LOGS, list);
  }

  // Reports
  static getReportsSummary(): ReportsSummary {
    return safeGetStorage<ReportsSummary>(STORAGE_KEYS.REPORTS, DEMO_REPORTS_SUMMARY);
  }

  // Notifications
  static getNotifications(): NotificationItem[] {
    return safeGetStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, DEMO_NOTIFICATIONS);
  }

  static markNotificationRead(id?: string): void {
    const list = this.getNotifications();
    const updated = list.map((n) => (id && n.id !== id ? n : { ...n, isRead: true }));
    safeSetStorage(STORAGE_KEYS.NOTIFICATIONS, updated);
  }

  // Users & Roles
  static getUsers(): CompanyUser[] {
    return safeGetStorage<CompanyUser[]>(STORAGE_KEYS.USERS, DEMO_USERS);
  }

  static getRoles(): Role[] {
    return safeGetStorage<Role[]>(STORAGE_KEYS.ROLES, DEMO_ROLES);
  }

  static updateUser(userId: string, partial: any): CompanyUser | null {
    const list = this.getUsers();
    const idx = list.findIndex((u) => u.userId === userId || u.id === userId);
    if (idx < 0) return null;
    list[idx] = {
      ...list[idx],
      user: {
        ...list[idx].user,
        ...partial,
      },
    };
    safeSetStorage(STORAGE_KEYS.USERS, list);
    return list[idx];
  }

  // Full reset back to clean initial demo state
  static resetToDefault(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  }
}

// Re-export constants for easy access
export {
  DEMO_CLIENTS,
  DEMO_INVOICES,
  DEMO_WAYBILLS,
  DEMO_LETTERS,
  DEMO_PAYMENTS,
  DEMO_COMPANY,
  DEMO_NUMBERING,
  DEMO_TEMPLATES,
  DEMO_ROLES,
  DEMO_USERS,
  DEMO_AUDIT_LOGS,
  DEMO_REPORTS_SUMMARY,
  DEMO_NOTIFICATIONS,
  DEMO_VENDORS,
  DEMO_SUPPLIES,
  DEMO_SUPPLY_ORDERS,
};
