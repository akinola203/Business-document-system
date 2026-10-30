export interface WaybillRenderContext {
  company: {
    name: string;
    legalName?: string;
    rcNumber?: string | null;
    tin?: string | null;
    address: string;
    email?: string | null;
    phone?: string | null;
  };
  documentNumber: string;
  title: string;
  issueDate?: string | Date;
  status: string;
  client: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  waybill: {
    shipmentDate?: string | Date | null;
    originAddress: string;
    destinationAddress: string;
    vehicleNumber?: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
    trackingNumber?: string | null;
    deliveryStatus: string;
    receivedByName?: string | null;
    receivedDate?: string | Date | null;
    items: Array<{
      lineNumber: number;
      description: string;
      quantity: number | string;
      unit: string;
      weightKg?: number | string | null;
      packageCount?: number | null;
      packageType?: string | null;
    }>;
  };
}

export function renderWaybillHtml(ctx: WaybillRenderContext): string {
  const comp = ctx.company;
  const wb = ctx.waybill;
  const client = ctx.client;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const items = wb.items || [];
  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const totalPackages = items.reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
  const totalWeight = items.reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);

  const itemsRows = items
    .map(
      (item) => `
      <tr>
        <td class="text-center">${item.lineNumber}</td>
        <td><strong>${escapeHtml(item.description)}</strong></td>
        <td class="text-right font-semibold">${Number(item.quantity).toLocaleString()} ${escapeHtml(item.unit || '')}</td>
        <td class="text-right">${item.packageCount ? `${item.packageCount} ${escapeHtml(item.packageType || 'pkgs')}` : '—'}</td>
        <td class="text-right">${item.weightKg ? `${Number(item.weightKg).toLocaleString()} kg` : '—'}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Waybill - ${escapeHtml(ctx.documentNumber)}</title>
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
    }
    .container {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .header-table td {
      vertical-align: top;
    }
    .brand-name {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 3px;
    }
    .company-meta {
      font-size: 8pt;
      color: #64748b;
      line-height: 1.35;
    }
    .doc-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0369a1;
      text-align: right;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .doc-meta {
      font-size: 8.5pt;
      text-align: right;
      color: #475569;
    }
    .doc-meta strong {
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .status-badge {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .meta-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .meta-grid td {
      padding: 10px 14px;
      vertical-align: top;
      width: 50%;
    }
    .meta-grid td:first-child {
      border-right: 1px solid #e2e8f0;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .party-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }
    .logistics-banner {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      border-radius: 4px;
    }
    .logistics-banner td {
      padding: 8px 12px;
      font-size: 8.5pt;
      vertical-align: middle;
    }
    .logistics-label {
      color: #64748b;
      font-size: 7.5pt;
      text-transform: uppercase;
      display: block;
      margin-bottom: 2px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border: 1px solid #0f172a;
    }
    .items-table td {
      padding: 7px 8px;
      font-size: 8.5pt;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
    }
    .items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; }

    .totals-box {
      width: 100%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      box-sizing: border-box;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table tr td {
      padding: 4px 0;
      vertical-align: middle;
    }
    .totals-label {
      font-size: 8.5pt;
      font-weight: 600;
      color: #64748b;
      text-align: left;
      white-space: nowrap;
      padding-right: 12px;
    }
    .totals-value {
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      text-align: right;
      white-space: nowrap;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace, sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .grand-total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      padding: 6px 0 !important;
    }
    .totals-label-grand {
      font-size: 9pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      white-space: nowrap;
      padding-right: 12px;
    }
    .totals-value-grand {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      text-align: right;
      white-space: nowrap;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace, sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 8.5pt;
      width: 100%;
    }
    .total-line > span:first-child {
      text-align: left;
      color: #64748b;
      font-weight: 600;
      padding-right: 12px;
      white-space: nowrap;
    }
    .total-line > span:last-child {
      text-align: right;
      color: #0f172a;
      font-weight: 700;
      white-space: nowrap;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace, sans-serif;
    }

    .sign-section {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      page-break-inside: avoid;
    }
    .sign-box {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 10px;
      height: 95px;
      vertical-align: top;
      font-size: 8pt;
      color: #475569;
    }
    .sign-box-title {
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 4px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 2px;
    }
    .signature-line {
      margin-top: 35px;
      border-top: 1px dashed #94a3b8;
      padding-top: 3px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
    }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5pt;
      color: #94a3b8;
      text-align: center;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
<div class="container">
  <table class="header-table">
    <tr>
      <td style="width: 55%;">
        <div class="brand-name">${escapeHtml(comp.legalName || comp.name)}</div>
        <div class="company-meta">
          ${comp.rcNumber ? `<span>RC: ${escapeHtml(comp.rcNumber)}</span> &bull; ` : ''}
          ${comp.tin ? `<span>TIN: ${escapeHtml(comp.tin)}</span><br>` : ''}
          ${escapeHtml(comp.address)}<br>
          ${comp.email ? `Email: ${escapeHtml(comp.email)} ` : ''}
          ${comp.phone ? `&bull; Tel: ${escapeHtml(comp.phone)}` : ''}
        </div>
      </td>
      <td style="width: 45%;">
        <div class="doc-title">WAYBILL / DELIVERY NOTE</div>
        <div class="doc-meta">
          <div><strong>Waybill No:</strong> ${escapeHtml(ctx.documentNumber)}</div>
          <div><strong>Date:</strong> ${formatDate(ctx.issueDate || wb.shipmentDate)}</div>
          ${wb.trackingNumber ? `<div><strong>Tracking Ref:</strong> ${escapeHtml(wb.trackingNumber)}</div>` : ''}
          <div><span class="badge status-badge">${escapeHtml(wb.deliveryStatus || ctx.status)}</span></div>
        </div>
      </td>
    </tr>
  </table>

  <table class="meta-grid">
    <tr>
      <td>
        <div class="section-title">Consignor (Dispatch From)</div>
        <div class="party-name">${escapeHtml(comp.name)}</div>
        <div class="company-meta">
          <strong>Origin:</strong> ${escapeHtml(wb.originAddress || comp.address)}<br>
          ${comp.phone ? `Tel: ${escapeHtml(comp.phone)}` : ''}
        </div>
      </td>
      <td>
        <div class="section-title">Consignee (Deliver To)</div>
        <div class="party-name">${escapeHtml(client.companyName || client.name)}</div>
        <div class="company-meta">
          ${client.companyName && client.name ? `Attn: ${escapeHtml(client.name)}<br>` : ''}
          <strong>Destination:</strong> ${escapeHtml(wb.destinationAddress || client.address || '—')}<br>
          ${client.phone ? `Tel: ${escapeHtml(client.phone)}<br>` : ''}
          ${client.email ? `Email: ${escapeHtml(client.email)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <table class="logistics-banner">
    <tr>
      <td style="width: 33%;">
        <span class="logistics-label">Vehicle Registration</span>
        <strong>${escapeHtml(wb.vehicleNumber || '—')}</strong>
      </td>
      <td style="width: 34%;">
        <span class="logistics-label">Driver / Carrier Name</span>
        <strong>${escapeHtml(wb.driverName || '—')}</strong>
      </td>
      <td style="width: 33%;">
        <span class="logistics-label">Driver Contact</span>
        <strong>${escapeHtml(wb.driverPhone || '—')}</strong>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 6%;" class="text-center">#</th>
        <th style="width: 46%;">Consignment Description</th>
        <th style="width: 18%;" class="text-right">Quantity</th>
        <th style="width: 15%;" class="text-right">Packages</th>
        <th style="width: 15%;" class="text-right">Weight (KG)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows || '<tr><td colspan="5" class="text-center" style="padding: 20px;">No items listed on this consignment.</td></tr>'}
    </tbody>
    ${
      items.length > 0
        ? `
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #0f172a;">
        <td colspan="2" style="padding: 7px 8px; text-transform: uppercase; font-size: 8pt; color: #475569; letter-spacing: 0.5px;">Consignment Totals:</td>
        <td class="text-right" style="padding: 7px 8px; font-weight: 800; color: #0f172a;">${totalQuantity.toLocaleString()}</td>
        <td class="text-right" style="padding: 7px 8px; color: #334155;">${totalPackages > 0 ? totalPackages.toLocaleString() : '—'}</td>
        <td class="text-right" style="padding: 7px 8px; font-weight: 800; color: #0f172a;">${totalWeight > 0 ? totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' kg' : '—'}</td>
      </tr>
    </tfoot>`
        : ''
    }
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid;">
    <tr>
      <td style="width: 52%; vertical-align: top; padding-right: 20px;">
        <div style="font-size: 8pt; color: #64748b; line-height: 1.45; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <strong style="color: #334155; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Delivery Endorsement:</strong>
          The receiver confirms receipt of all packages listed above in undamaged condition. Any shortage, seal tampering, or transit damage must be noted prior to signing.
        </div>
      </td>
      <td style="width: 48%; vertical-align: top;">
        <div class="totals-box">
          <table class="totals-table">
            <tbody>
              <tr>
                <td class="totals-label">Total Cargo Units:</td>
                <td class="totals-value text-right">${totalQuantity.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="totals-label">Total Packages:</td>
                <td class="totals-value text-right">${totalPackages > 0 ? totalPackages.toLocaleString() : '—'}</td>
              </tr>
              <tr class="grand-total-row">
                <td class="totals-label-grand">Gross Weight:</td>
                <td class="totals-value-grand text-right">${totalWeight > 0 ? totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' KG' : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <table class="sign-section">
    <tr>
      <td class="sign-box" style="width: 33.3%;">
        <div class="sign-box-title">1. Dispatched By</div>
        <div>Goods released in good order and condition.</div>
        <div class="signature-line">
          <span>Sign / Stamp</span>
          <span>Date</span>
        </div>
      </td>
      <td class="sign-box" style="width: 33.3%; border-left: none; border-right: none;">
        <div class="sign-box-title">2. Carrier Acknowledgement</div>
        <div>Received for transit as described above.</div>
        <div class="signature-line">
          <span>Driver Sign</span>
          <span>Date</span>
        </div>
      </td>
      <td class="sign-box" style="width: 33.3%;">
        <div class="sign-box-title">3. Consignee Delivery Receipt</div>
        <div>
          ${wb.receivedByName ? `<strong>Received By:</strong> ${escapeHtml(wb.receivedByName)}<br>` : ''}
          ${wb.receivedDate ? `<strong>Date:</strong> ${formatDate(wb.receivedDate)}<br>` : 'Received in full & good order.'}
        </div>
        <div class="signature-line">
          <span>Receiver Sign / Stamp</span>
          <span>Date</span>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer">
    Official logistics dispatch record generated by ${escapeHtml(comp.name)} on ${new Date().toLocaleDateString('en-GB')}. All goods received remain subject to standard terms of carriage.
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
