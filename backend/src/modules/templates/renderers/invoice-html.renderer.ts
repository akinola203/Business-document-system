export interface InvoiceRenderContext {
  company: {
    name: string;
    legalName?: string;
    rcNumber?: string | null;
    tin?: string | null;
    address: string;
    email?: string | null;
    phone?: string | null;
    settings?: {
      bankName?: string | null;
      bankAccountNumber?: string | null;
      bankAccountName?: string | null;
      bankSortCode?: string | null;
      showBankDetailsOnInvoice?: boolean;
    } | null;
  };
  documentNumber: string;
  title: string;
  issueDate?: string | Date;
  status: string;
  paymentStatus?: string;
  currency: string;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  balanceDue: string | number;
  client: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  invoice: {
    poNumber?: string | null;
    paymentTerms?: string | null;
    dueDate?: string | Date | null;
    notes?: string | null;
    items: Array<{
      lineNumber: number;
      description: string;
      quantity: number | string;
      unit: string;
      unitPrice: number | string;
      lineGross: number | string;
      discountAmount: number | string;
      taxAmount: number | string;
      lineTotal: number | string;
    }>;
  };
}

export function renderInvoiceHtml(ctx: InvoiceRenderContext): string {
  const comp = ctx.company;
  const settings = comp.settings;
  const inv = ctx.invoice;
  const client = ctx.client;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (val: string | number) => {
    const num = Number(val) || 0;
    return `${ctx.currency} ${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const itemsRows = (inv.items || [])
    .map(
      (item) => `
      <tr>
        <td class="text-center">${item.lineNumber}</td>
        <td><strong>${escapeHtml(item.description)}</strong></td>
        <td class="text-right">${Number(item.quantity).toLocaleString()} ${escapeHtml(item.unit || '')}</td>
        <td class="text-right">${formatCurrency(item.unitPrice)}</td>
        <td class="text-right">${Number(item.discountAmount) > 0 ? '-' + formatCurrency(item.discountAmount) : '—'}</td>
        <td class="text-right">${formatCurrency(item.taxAmount)}</td>
        <td class="text-right font-semibold">${formatCurrency(item.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const showBank = settings?.showBankDetailsOnInvoice && settings.bankAccountNumber;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${escapeHtml(ctx.documentNumber)}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
      padding: 10px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      margin-bottom: 25px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
    }
    .company-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .rc-number {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
    }
    .company-meta {
      font-size: 9pt;
      color: #64748b;
      margin-top: 6px;
      line-height: 1.35;
    }
    .doc-badge-container {
      text-align: right;
    }
    .doc-type-title {
      font-size: 24pt;
      font-weight: 900;
      color: #2563eb;
      letter-spacing: 1px;
    }
    .doc-number {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 2px;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      font-size: 8pt;
      font-weight: 700;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 6px;
    }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-unpaid { background: #fee2e2; color: #b91c1c; }
    .status-partial { background: #fef3c7; color: #b45309; }

    .details-grid {
      width: 100%;
      margin-bottom: 25px;
    }
    .details-grid td {
      vertical-align: top;
      width: 50%;
    }
    .section-label {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 5px;
    }
    .client-name {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
    }
    .client-info {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.4;
      margin-top: 3px;
    }

    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .meta-label { font-weight: 600; color: #64748b; }
    .meta-val { font-weight: 700; color: #0f172a; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      font-weight: 600;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; }

    .summary-container {
      width: 100%;
      margin-top: 15px;
    }
    .summary-container td {
      vertical-align: top;
    }
    .payment-instructions {
      width: 55%;
      padding-right: 20px;
    }
    .bank-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 9pt;
    }
    .bank-card-title {
      font-weight: 700;
      color: #166534;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }
    .bank-row {
      margin-bottom: 2px;
      color: #1e293b;
    }

    .totals-box {
      width: 45%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 9.5pt;
    }
    .grand-total {
      border-top: 2px solid #0f172a;
      padding-top: 6px;
      margin-top: 6px;
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
    }
    .balance-due {
      background: #fee2e2;
      color: #991b1b;
      font-weight: 800;
      padding: 6px 8px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .footer {
      margin-top: 35px;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>
<div class="invoice-container">
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <div class="company-title">${escapeHtml(comp.name)}</div>
        ${comp.rcNumber ? `<div class="rc-number">RC: ${escapeHtml(comp.rcNumber)}</div>` : ''}
        <div class="company-meta">
          ${escapeHtml(comp.address)}<br>
          ${comp.phone ? `Phone: ${escapeHtml(comp.phone)} | ` : ''}${comp.email ? `Email: ${escapeHtml(comp.email)}` : ''}<br>
          ${comp.tin ? `<strong>TIN:</strong> ${escapeHtml(comp.tin)}` : ''}
        </div>
      </td>
      <td class="doc-badge-container" style="vertical-align: top;">
        <div class="doc-type-title">INVOICE</div>
        <div class="doc-number">${escapeHtml(ctx.documentNumber)}</div>
        <div class="status-pill ${getStatusClass(ctx.paymentStatus || ctx.status)}">
          ${escapeHtml(ctx.paymentStatus || ctx.status)}
        </div>
      </td>
    </tr>
  </table>

  <table class="details-grid">
    <tr>
      <td>
        <div class="section-label">Billed To:</div>
        <div class="client-name">${escapeHtml(client.companyName || client.name)}</div>
        <div class="client-info">
          ${client.companyName ? `Attn: ${escapeHtml(client.name)}<br>` : ''}
          ${client.address ? `${escapeHtml(client.address)}<br>` : ''}
          ${client.phone ? `Tel: ${escapeHtml(client.phone)}<br>` : ''}
          ${client.email ? `Email: ${escapeHtml(client.email)}` : ''}
        </div>
      </td>
      <td>
        <div class="meta-box">
          <div class="meta-row"><span class="meta-label">Invoice Date:</span><span class="meta-val">${formatDate(ctx.issueDate)}</span></div>
          <div class="meta-row"><span class="meta-label">Payment Due:</span><span class="meta-val">${formatDate(inv.dueDate)}</span></div>
          ${inv.paymentTerms ? `<div class="meta-row"><span class="meta-label">Terms:</span><span class="meta-val">${escapeHtml(inv.paymentTerms)}</span></div>` : ''}
          ${inv.poNumber ? `<div class="meta-row"><span class="meta-label">P.O. Number:</span><span class="meta-val">${escapeHtml(inv.poNumber)}</span></div>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 40%;">Description</th>
        <th style="width: 12%; text-align: right;">Quantity</th>
        <th style="width: 13%; text-align: right;">Unit Price</th>
        <th style="width: 10%; text-align: right;">Discount</th>
        <th style="width: 10%; text-align: right;">VAT</th>
        <th style="width: 15%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows || '<tr><td colspan="7" class="text-center">No line items recorded.</td></tr>'}
    </tbody>
  </table>

  <table class="summary-container">
    <tr>
      <td class="payment-instructions">
        ${
          showBank
            ? `
        <div class="bank-card">
          <div class="bank-card-title">Banking & Settlement Details</div>
          <div class="bank-row"><strong>Bank:</strong> ${escapeHtml(settings.bankName || '')}</div>
          <div class="bank-row"><strong>Account Number:</strong> ${escapeHtml(settings.bankAccountNumber || '')}</div>
          ${settings.bankAccountName ? `<div class="bank-row"><strong>Account Name:</strong> ${escapeHtml(settings.bankAccountName)}</div>` : ''}
          ${settings.bankSortCode ? `<div class="bank-row"><strong>Sort Code:</strong> ${escapeHtml(settings.bankSortCode)}</div>` : ''}
        </div>`
            : ''
        }
        ${inv.notes ? `<div style="margin-top: 10px; font-size: 8.5pt; color: #64748b;"><strong>Notes:</strong> ${escapeHtml(inv.notes)}</div>` : ''}
      </td>
      <td style="width: 45%;">
        <div class="totals-box">
          <div class="total-line"><span>Subtotal:</span><span>${formatCurrency(ctx.subtotal)}</span></div>
          ${Number(ctx.discountAmount) > 0 ? `<div class="total-line"><span>Total Discount:</span><span>-${formatCurrency(ctx.discountAmount)}</span></div>` : ''}
          <div class="total-line"><span>Value Added Tax (VAT):</span><span>${formatCurrency(ctx.taxAmount)}</span></div>
          <div class="total-line grand-total"><span>Total Amount:</span><span>${formatCurrency(ctx.totalAmount)}</span></div>
          <div class="total-line balance-due"><span>Balance Due:</span><span>${formatCurrency(ctx.balanceDue)}</span></div>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer">
    Thank you for your business. Generated on ${new Date().toLocaleDateString('en-GB')} by ${escapeHtml(comp.name)}.
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'PAID') return 'status-paid';
  if (s === 'PARTIALLY_PAID') return 'status-partial';
  return 'status-unpaid';
}
