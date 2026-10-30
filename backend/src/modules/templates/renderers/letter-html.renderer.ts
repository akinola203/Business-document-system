import * as sanitizeHtml from 'sanitize-html';

export interface LetterRenderContext {
  company: {
    name: string;
    legalName?: string;
    rcNumber?: string | null;
    tin?: string | null;
    address: string;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
  };
  documentNumber: string;
  title: string;
  issueDate?: string | Date;
  status: string;
  letter: {
    letterDate?: string | Date | null;
    recipientName: string;
    recipientTitle?: string | null;
    recipientOrganization?: string | null;
    recipientAddress?: string | null;
    subject: string;
    bodyHtml: string;
    signatoryName: string;
    signatoryTitle?: string | null;
    signatoryDepartment?: string | null;
  };
}

export function renderLetterHtml(ctx: LetterRenderContext): string {
  const comp = ctx.company;
  const letData = ctx.letter;

  const formatDate = (d?: string | Date | null) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const cleanBodyHtml = sanitizeRichHtml(letData.bodyHtml || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(ctx.documentNumber)} - ${escapeHtml(letData.subject)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 20mm 20mm 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
    }
    .letterhead-container {
      width: 100%;
      margin-bottom: 25px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
    }
    .company-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .company-details {
      font-size: 8pt;
      color: #475569;
      line-height: 1.4;
    }
    .ref-date-bar {
      width: 100%;
      margin-bottom: 25px;
      font-size: 9pt;
      color: #334155;
    }
    .ref-date-bar table {
      width: 100%;
      border-collapse: collapse;
    }
    .ref-date-bar td {
      vertical-align: top;
    }
    .recipient-box {
      margin-bottom: 25px;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #0f172a;
    }
    .recipient-name {
      font-weight: 700;
    }
    .salutation {
      margin-bottom: 16px;
      font-size: 10pt;
      font-weight: 600;
      color: #0f172a;
    }
    .subject-line {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 20px;
      padding-bottom: 4px;
      border-bottom: 1px solid #94a3b8;
      letter-spacing: 0.3px;
    }
    .letter-body {
      font-size: 10pt;
      line-height: 1.65;
      color: #1e293b;
      margin-bottom: 30px;
      text-align: justify;
    }
    .letter-body p {
      margin-bottom: 14px;
    }
    .letter-body ul, .letter-body ol {
      margin: 10px 0 14px 25px;
    }
    .letter-body li {
      margin-bottom: 4px;
    }
    .sign-off-block {
      page-break-inside: avoid;
      margin-top: 25px;
      font-size: 9.5pt;
    }
    .sign-closing {
      margin-bottom: 50px;
      font-weight: 600;
      color: #334155;
    }
    .signatory-name {
      font-weight: 800;
      font-size: 10pt;
      color: #0f172a;
    }
    .signatory-title {
      font-size: 9pt;
      color: #475569;
    }
    .signatory-company {
      font-size: 8.5pt;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }
    .totals-box {
      width: 100%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      box-sizing: border-box;
      margin-top: 14px;
      margin-bottom: 14px;
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
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      font-size: 7.5pt;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="letterhead-container">
    <div class="company-title">${escapeHtml(comp.legalName || comp.name)}</div>
    <div class="company-details">
      ${comp.rcNumber ? `<span>RC: ${escapeHtml(comp.rcNumber)}</span> &bull; ` : ''}
      ${comp.tin ? `<span>TIN: ${escapeHtml(comp.tin)}</span><br>` : ''}
      ${escapeHtml(comp.address)}<br>
      ${comp.email ? `Email: ${escapeHtml(comp.email)} ` : ''}
      ${comp.phone ? `&bull; Phone: ${escapeHtml(comp.phone)} ` : ''}
      ${comp.website ? `&bull; Web: ${escapeHtml(comp.website)}` : ''}
    </div>
  </div>

  <div class="ref-date-bar">
    <table>
      <tr>
        <td style="text-align: left;">
          <strong>Our Ref:</strong> ${escapeHtml(ctx.documentNumber)}
        </td>
        <td style="text-align: right;">
          <strong>Date:</strong> ${formatDate(letData.letterDate || ctx.issueDate)}
        </td>
      </tr>
    </table>
  </div>

  <div class="recipient-box">
    <div class="recipient-name">${escapeHtml(letData.recipientName)}</div>
    ${letData.recipientTitle ? `<div>${escapeHtml(letData.recipientTitle)}</div>` : ''}
    ${letData.recipientOrganization ? `<div><strong>${escapeHtml(letData.recipientOrganization)}</strong></div>` : ''}
    ${letData.recipientAddress ? `<div>${escapeHtml(letData.recipientAddress).replace(/\n/g, '<br>')}</div>` : ''}
  </div>

  <div class="salutation">
    Dear ${escapeHtml(letData.recipientName || 'Sir/Madam')},
  </div>

  <div class="subject-line">
    ${escapeHtml(letData.subject)}
  </div>

  <div class="letter-body">
    ${cleanBodyHtml}
  </div>

  <div class="sign-off-block">
    <div class="sign-closing">Yours faithfully,</div>
    <div class="signatory-name">${escapeHtml(letData.signatoryName)}</div>
    ${letData.signatoryTitle ? `<div class="signatory-title">${escapeHtml(letData.signatoryTitle)}${letData.signatoryDepartment ? `, ${escapeHtml(letData.signatoryDepartment)}` : ''}</div>` : ''}
    <div class="signatory-company">For: ${escapeHtml(comp.legalName || comp.name)}</div>
  </div>

  <div class="footer">
    This official correspondence was generated on ${new Date().toLocaleDateString('en-GB')} by ${escapeHtml(comp.name)}.
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

/**
 * HTML sanitizer using sanitize-html with strict allowlist and zero attributes.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  // If plain text with line breaks, format as paragraphs
  if (!html.includes('<') && !html.includes('>')) {
    return html
      .split('\n\n')
      .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {},
  });
}
