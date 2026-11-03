import { PortfolioMockStore } from './portfolio-data';
import { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { DocumentRecord } from '../types';

export const DEMO_ADMIN_USER = {
  id: 'usr-portfolio-admin',
  email: 'executive@aoa77.com',
  fullName: 'Akinola Akinlade',
  role: 'ADMIN',
  roleName: 'Executive Director / Admin',
  permissions: ['*:*'],
  companyId: 'c0000000-0000-0000-0000-000000000001',
  companyName: 'AOA 77 COMPANY LTD',
};

function formatSuccessResponse(config: InternalAxiosRequestConfig | AxiosRequestConfig, data: any): AxiosResponse {
  return {
    data: {
      success: true,
      data,
      statusCode: 200,
      timestamp: new Date().toISOString(),
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: config as InternalAxiosRequestConfig,
  };
}

export async function handleMockApiRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const method = (config.method || 'get').toLowerCase();
  const rawUrl = (config.url || '').replace(/^https?:\/\/[^/]+/, '');
  const cleanUrl = rawUrl.replace(/^\/api\/v1/, '').split('?')[0];
  const params = config.params || {};
  let body = config.data;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Keep as string or formData
    }
  }

  // Small synthetic delay to simulate instant, silky-smooth native feel (15ms - 50ms)
  await new Promise((resolve) => setTimeout(resolve, 25));

  // ----------------------------------------------------
  // 1. AUTHENTICATION & SESSION
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/auth/login')) {
    return formatSuccessResponse(config, {
      user: DEMO_ADMIN_USER,
      accessToken: 'portfolio-demo-jwt-token-active',
      refreshToken: 'portfolio-demo-refresh-token',
    });
  }

  if (cleanUrl.startsWith('/auth/refresh')) {
    return formatSuccessResponse(config, {
      accessToken: 'portfolio-demo-jwt-token-refreshed',
      refreshToken: 'portfolio-demo-refresh-token',
    });
  }

  if (cleanUrl.startsWith('/auth/logout')) {
    return formatSuccessResponse(config, { loggedOut: true });
  }

  // ----------------------------------------------------
  // 2. DOCUMENTS (INVOICES, WAYBILLS, LETTERS)
  // ----------------------------------------------------
  if (cleanUrl === '/documents' || cleanUrl === '/invoices' || cleanUrl === '/waybills' || cleanUrl === '/letters') {
    if (method === 'get') {
      let docType = params.documentType;
      if (!docType && cleanUrl === '/invoices') docType = 'INVOICE';
      if (!docType && cleanUrl === '/waybills') docType = 'WAYBILL';
      if (!docType && cleanUrl === '/letters') docType = 'LETTER';

      let docs = PortfolioMockStore.getAllDocuments(docType);

      if (params.status) {
        docs = docs.filter((d) => d.status === params.status);
      }
      if (params.clientId) {
        docs = docs.filter((d) => d.clientId === params.clientId);
      }
      if (params.search) {
        const q = String(params.search).toLowerCase();
        docs = docs.filter(
          (d) =>
            d.documentNumber.toLowerCase().includes(q) ||
            d.title.toLowerCase().includes(q) ||
            d.client?.companyName?.toLowerCase().includes(q) ||
            d.client?.name?.toLowerCase().includes(q),
        );
      }

      return formatSuccessResponse(config, docs);
    }

    if (method === 'post') {
      const docType = body.documentType || (cleanUrl.includes('waybill') ? 'WAYBILL' : cleanUrl.includes('letter') ? 'LETTER' : 'INVOICE');
      const prefix = docType === 'INVOICE' ? 'INV' : docType === 'WAYBILL' ? 'WAY' : 'LET';
      const count = PortfolioMockStore.getAllDocuments(docType).length + 1;
      const numStr = String(count).padStart(4, '0');
      const docNumber = body.documentNumber || `${prefix}-2026-${numStr}`;

      const client = PortfolioMockStore.getClients().find((c) => c.id === body.clientId) || PortfolioMockStore.getClients()[0];

      const newDoc: DocumentRecord = {
        id: `doc-${Date.now()}`,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        documentNumber: docNumber,
        documentType: docType,
        title: body.title || `${docType} for ${client.companyName || client.name}`,
        status: body.status || 'DRAFT',
        currency: body.currency || 'NGN',
        subtotalAmount: body.subtotalAmount || body.totalAmount || 0,
        discountAmount: body.discountAmount || 0,
        taxAmount: body.taxAmount || 0,
        totalAmount: body.totalAmount || 0,
        balanceDue: body.balanceDue !== undefined ? body.balanceDue : (body.totalAmount || 0),
        paymentStatus: 'UNPAID',
        isOverdue: false,
        version: 1,
        isArchived: false,
        clientId: client.id,
        client,
        createdById: DEMO_ADMIN_USER.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...body,
      };

      PortfolioMockStore.saveDocument(newDoc);
      PortfolioMockStore.addAuditLog({
        id: `audit-${Date.now()}`,
        action: 'DOCUMENT_CREATED',
        entityType: 'Document',
        entityId: newDoc.id,
        description: `Created ${newDoc.documentType} ${newDoc.documentNumber}`,
        createdAt: new Date().toISOString(),
        user: DEMO_ADMIN_USER,
      });

      return formatSuccessResponse(config, newDoc);
    }
  }

  // Lifecycle actions (submit, approve, reject, issue, cancel, duplicate)
  const actionMatch = cleanUrl.match(/^\/documents\/([^/]+)\/(submit|approve|reject|issue|cancel|duplicate)$/);
  if (actionMatch && method === 'post') {
    const [, id, action] = actionMatch;
    const doc = PortfolioMockStore.getDocumentById(id);
    if (doc) {
      if (action === 'submit') doc.status = 'PENDING_APPROVAL';
      if (action === 'approve') doc.status = 'APPROVED';
      if (action === 'reject') doc.status = 'REJECTED';
      if (action === 'issue') doc.status = 'ISSUED';
      if (action === 'cancel') doc.status = 'CANCELLED';
      if (action === 'duplicate') {
        const copy: DocumentRecord = {
          ...doc,
          id: `doc-copy-${Date.now()}`,
          documentNumber: `${doc.documentNumber}-COPY`,
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        PortfolioMockStore.saveDocument(copy);
        return formatSuccessResponse(config, copy);
      }

      doc.updatedAt = new Date().toISOString();
      PortfolioMockStore.saveDocument(doc);
      PortfolioMockStore.addAuditLog({
        id: `audit-${Date.now()}`,
        action: `DOCUMENT_${action.toUpperCase()}`,
        entityType: 'Document',
        entityId: doc.id,
        description: `Updated status of ${doc.documentNumber} to ${doc.status}`,
        createdAt: new Date().toISOString(),
        user: DEMO_ADMIN_USER,
      });

      return formatSuccessResponse(config, doc);
    }
  }

  // Waybill dispatch lifecycle (/waybills/:id/ready, /dispatch, /complete, /fail)
  const waybillMatch = cleanUrl.match(/^\/waybills\/([^/]+)\/(ready|dispatch|complete|fail)$/);
  if (waybillMatch && method === 'post') {
    const [, id, action] = waybillMatch;
    const doc = PortfolioMockStore.getWaybillById(id);
    if (doc) {
      const wb = doc.waybill || {
        id: `wb-spec-${Date.now()}`,
        documentId: doc.id,
        shipmentDate: new Date().toISOString(),
        originAddress: 'Lagos Victoria Island Central Warehouse',
        destinationAddress: doc.client?.address || 'Client Industrial Depot',
        deliveryStatus: 'READY_FOR_DISPATCH',
        items: [],
      };
      if (action === 'ready') wb.deliveryStatus = 'READY_FOR_DISPATCH';
      if (action === 'dispatch') wb.deliveryStatus = 'IN_TRANSIT';
      if (action === 'complete') wb.deliveryStatus = 'DELIVERED';
      if (action === 'fail') wb.deliveryStatus = 'DELIVERY_FAILED';

      doc.waybill = wb;
      doc.updatedAt = new Date().toISOString();
      PortfolioMockStore.addWaybill(doc);
      return formatSuccessResponse(config, doc);
    }
  }

  // Single document retrieval / update
  const singleDocMatch = cleanUrl.match(/^\/(?:documents|invoices|waybills|letters)\/([^/]+)$/);
  if (singleDocMatch) {
    const id = singleDocMatch[1];
    if (method === 'get') {
      const doc = PortfolioMockStore.getDocumentById(id) || PortfolioMockStore.getInvoices()[0];
      return formatSuccessResponse(config, doc);
    }
    if (method === 'patch' || method === 'put') {
      const doc = PortfolioMockStore.getDocumentById(id);
      if (doc) {
        Object.assign(doc, body);
        doc.updatedAt = new Date().toISOString();
        PortfolioMockStore.saveDocument(doc);
        return formatSuccessResponse(config, doc);
      }
    }
  }

  // Document versions & audit logs
  if (cleanUrl.match(/^\/documents\/([^/]+)\/versions$/)) {
    return formatSuccessResponse(config, [
      {
        version: 1,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdByUser: DEMO_ADMIN_USER,
        changes: 'Original document authored in AOA 77 Workspace',
      },
    ]);
  }

  if (cleanUrl.match(/^\/audit-logs\/entity\//) || cleanUrl === '/audit-logs') {
    return formatSuccessResponse(config, PortfolioMockStore.getAuditLogs());
  }

  // Document previews
  if (cleanUrl.includes('/preview')) {
    return formatSuccessResponse(config, {
      html: '<div style="font-family: sans-serif; padding: 40px; text-align: center;"><h2>AOA 77 COMPANY LTD</h2><p>Official Document Preview Rendered in Portfolio Demo</p></div>',
    });
  }

  // ----------------------------------------------------
  // 3. CLIENTS
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/clients')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getClients());
    }
    if (method === 'post') {
      const client = {
        id: `cli-${Date.now()}`,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        clientNumber: `CLI-${String(PortfolioMockStore.getClients().length + 101).padStart(5, '0')}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...body,
      };
      PortfolioMockStore.addClient(client);
      return formatSuccessResponse(config, client);
    }
  }

  // ----------------------------------------------------
  // 4. PAYMENTS & SETTLEMENTS
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/payments') || cleanUrl.includes('/payments')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getPayments());
    }

    if (method === 'post') {
      // Reverse payment
      const revMatch = cleanUrl.match(/^\/payments\/([^/]+)\/reverse$/);
      if (revMatch) {
        const reversed = PortfolioMockStore.reversePayment(revMatch[1], body?.reason);
        return formatSuccessResponse(config, reversed);
      }

      // Record payment
      const paymentNumber = `PAY-2026-${String(PortfolioMockStore.getPayments().length + 1).padStart(4, '0')}`;
      const newPayment = {
        id: `pay-${Date.now()}`,
        paymentNumber,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        invoiceId: body.invoiceId || body.documentId || 'inv-demo-001',
        amount: Number(body.amount || 0),
        currency: body.currency || 'NGN',
        method: body.paymentMethod || body.method || 'BANK_TRANSFER',
        paymentDate: body.paymentDate || new Date().toISOString(),
        referenceNumber: body.referenceNumber || body.reference || `REF-TRF-${Date.now().toString().slice(-6)}`,
        notes: body.notes || 'Recorded via portfolio interactive demo',
        recordedById: DEMO_ADMIN_USER.id,
        recordedBy: {
          id: DEMO_ADMIN_USER.id,
          fullName: DEMO_ADMIN_USER.fullName,
        },
        isReversed: false,
        createdAt: new Date().toISOString(),
        ...body,
      };

      PortfolioMockStore.recordPayment(newPayment as any);
      return formatSuccessResponse(config, newPayment);
    }
  }

  // ----------------------------------------------------
  // 5. VENDORS & SUPPLIES
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/vendors')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getVendors());
    }
    if (method === 'post') {
      const vendor = {
        id: `vnd-${Date.now()}`,
        code: `VND-${String(PortfolioMockStore.getVendors().length + 1).padStart(4, '0')}`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        ...body,
      };
      PortfolioMockStore.addVendor(vendor);
      return formatSuccessResponse(config, vendor);
    }
    if (method === 'patch') {
      const id = cleanUrl.split('/').pop();
      const updated = PortfolioMockStore.addVendor({ id, ...body });
      return formatSuccessResponse(config, updated);
    }
  }

  if (cleanUrl.startsWith('/supplies/items') || cleanUrl === '/supplies') {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getSupplies());
    }
    if (method === 'post') {
      const item = {
        id: `sup-${Date.now()}`,
        sku: body.sku || `SKU-${Date.now().toString().slice(-5)}`,
        currentStock: Number(body.currentStock || 0),
        createdAt: new Date().toISOString(),
        ...body,
      };
      PortfolioMockStore.addSupplyItem(item);
      return formatSuccessResponse(config, item);
    }
    if (method === 'patch') {
      const id = cleanUrl.split('/').pop() || '';
      const updated = PortfolioMockStore.updateSupplyItem(id, body);
      return formatSuccessResponse(config, updated);
    }
  }

  if (cleanUrl.startsWith('/supplies/orders')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getSupplyOrders());
    }
    if (method === 'post') {
      const order = {
        id: `ord-${Date.now()}`,
        orderNumber: `SUP-2026-${String(PortfolioMockStore.getSupplyOrders().length + 1).padStart(4, '0')}`,
        status: body.status || 'ORDERED',
        createdAt: new Date().toISOString(),
        ...body,
      };
      PortfolioMockStore.addSupplyOrder(order);
      return formatSuccessResponse(config, order);
    }
  }

  // ----------------------------------------------------
  // 6. REPORTS & ANALYTICS
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/reports')) {
    return formatSuccessResponse(config, PortfolioMockStore.getReportsSummary());
  }

  // ----------------------------------------------------
  // 7. TEMPLATES
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/templates')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getTemplates(params.documentType));
    }
    if (method === 'patch') {
      const id = cleanUrl.split('/').pop() || '';
      const updated = PortfolioMockStore.updateTemplate(id, body?.config || body);
      return formatSuccessResponse(config, updated);
    }
  }

  // ----------------------------------------------------
  // 8. COMPANY & ORGANIZATION
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/companies') || cleanUrl.startsWith('/company')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getCompany());
    }
    if (method === 'patch' || method === 'put') {
      const current = PortfolioMockStore.getCompany();
      const updated = { ...current, ...body };
      PortfolioMockStore.saveCompany(updated);
      return formatSuccessResponse(config, updated);
    }
  }

  if (cleanUrl.startsWith('/organization/branches')) {
    return formatSuccessResponse(config, [
      { id: 'branch-hq', name: 'Lagos Headquarters (Victoria Island)' },
      { id: 'branch-ota', name: 'Ota Industrial Logistics Hub' },
      { id: 'branch-ph', name: 'Port Harcourt Regional Office' },
    ]);
  }

  if (cleanUrl.startsWith('/organization/departments')) {
    return formatSuccessResponse(config, [
      { id: 'dept-finance', name: 'Finance & Treasury' },
      { id: 'dept-logistics', name: 'Logistics & Haulage Operations' },
      { id: 'dept-procurement', name: 'Procurement & Supplies' },
      { id: 'dept-legal', name: 'Legal & Executive Board' },
    ]);
  }

  // ----------------------------------------------------
  // 9. USERS & ROLES
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/users')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getUsers());
    }
    if (method === 'patch') {
      const id = cleanUrl.split('/').pop() || '';
      const updated = PortfolioMockStore.updateUser(id, body);
      return formatSuccessResponse(config, updated);
    }
  }

  if (cleanUrl.startsWith('/roles')) {
    return formatSuccessResponse(config, PortfolioMockStore.getRoles());
  }

  // ----------------------------------------------------
  // 10. NOTIFICATIONS
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/notifications')) {
    if (method === 'get') {
      return formatSuccessResponse(config, PortfolioMockStore.getNotifications());
    }
    if (method === 'patch') {
      PortfolioMockStore.markNotificationRead();
      return formatSuccessResponse(config, { success: true });
    }
  }

  // ----------------------------------------------------
  // 11. FILE UPLOAD SIMULATION
  // ----------------------------------------------------
  if (cleanUrl.startsWith('/files/upload')) {
    return formatSuccessResponse(config, {
      fileId: `file-${Date.now()}`,
      url: '/logo-preview.png',
      name: 'company-brand-asset.png',
    });
  }

  // Fallback default response
  return formatSuccessResponse(config, { message: 'Demo response', timestamp: new Date().toISOString() });
}
