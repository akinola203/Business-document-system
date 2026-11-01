import type ExcelJS from 'exceljs';
import { DocumentRecord, PaymentRecord, ReportsSummary } from '../types';

/**
 * Dynamically loads ExcelJS on demand to keep it out of the main initial JavaScript bundle.
 */
async function loadExcelJS() {
  const mod = await import('exceljs');
  return mod.default || mod;
}

/**
 * Enterprise Design Tokens for Excel Styling
 */
const STYLES = {
  headerFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF0F172A' }, // Slate 900 / Dark Navy
  },
  headerFont: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' }, // Pure White
  },
  titleFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FF1E293B' }, // Slate 800
  },
  titleFont: {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  },
  subHeaderFont: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FF334155' }, // Slate 700
  },
  subHeaderFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF1F5F9' }, // Slate 100
  },
  dataFont: {
    name: 'Calibri',
    size: 10,
    color: { argb: 'FF1E293B' },
  },
  totalFont: {
    name: 'Calibri',
    size: 10.5,
    bold: true,
    color: { argb: 'FF0F172A' },
  },
  totalFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFF8FAFC' },
  },
  borderSubtle: {
    top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  },
  totalBorder: {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'double' as const, color: { argb: 'FF0F172A' } }, // Double underline for accounting totals
    left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  },
  currencyNumFmt: '"₦"#,##0.00',
  percentNumFmt: '0.0%',
  integerNumFmt: '#,##0',
  alignLeft: { vertical: 'middle' as const, horizontal: 'left' as const },
  alignRight: { vertical: 'middle' as const, horizontal: 'right' as const },
  alignCenter: { vertical: 'middle' as const, horizontal: 'center' as const },
};

/**
 * Dynamically computes and sets auto-fitted column widths
 * ensuring cells never display `###` errors or clipped strings.
 */
function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 13, padding = 4) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      let cellLen = 0;
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'result' in cell.value) {
          cellLen = String(cell.value.result ?? '').length;
        } else if (typeof cell.value === 'number') {
          // If it's a number formatted as currency, reserve extra space for ₦ and commas
          cellLen = cell.value.toLocaleString('en-NG', { minimumFractionDigits: 2 }).length + 4;
        } else {
          cellLen = String(cell.value).length;
        }
      }
      if (cellLen > maxLen) {
        maxLen = cellLen;
      }
    });

    column.width = Math.max(minWidth, Math.min(65, maxLen + padding));
  });
}

/**
 * Triggers the browser file download from a workbook buffer.
 */
async function saveWorkbookAs(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 1. Executive Reports Export (.xlsx)
// ============================================================================
export async function exportExecutiveReportToExcel(
  summary: ReportsSummary,
  dateRange: string,
  currency = 'NGN',
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AOA 77 Company Ltd';
  wb.lastModifiedBy = 'Finnova Business Document System';
  wb.created = new Date();
  wb.modified = new Date();

  const formattedDate = new Date().toISOString().slice(0, 10);
  const dateRangeLabel =
    dateRange === 'month'
      ? 'This Month'
      : dateRange === 'quarter'
      ? 'Last Quarter'
      : dateRange === 'ytd'
      ? 'Year to Date (2026)'
      : 'All Time';

  // --------------------------------------------------------------------------
  // SHEET 1: Executive Overview
  // --------------------------------------------------------------------------
  const wsOverview = wb.addWorksheet('Executive Overview', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  wsOverview.mergeCells('A1:D1');
  const titleCell = wsOverview.getCell('A1');
  titleCell.value = 'AOA 77 COMPANY LTD — EXECUTIVE FINANCIAL REPORT';
  titleCell.font = STYLES.titleFont;
  titleCell.fill = STYLES.titleFill;
  titleCell.alignment = STYLES.alignLeft;
  wsOverview.getRow(1).height = 32;

  // Metadata block
  wsOverview.addRow(['Reporting Period', dateRangeLabel, 'Base Currency', currency]);
  wsOverview.addRow(['Generated Date', new Date().toLocaleString(), 'Audit Status', 'Verified Live Database']);
  wsOverview.getRow(2).font = { ...STYLES.dataFont, bold: true };
  wsOverview.getRow(3).font = STYLES.dataFont;
  wsOverview.addRow([]); // Blank spacer

  // Section 1 Header: Revenue & Cashflow
  const r1HeaderRow = wsOverview.addRow(['REVENUE & CASHFLOW METRIC', 'VALUE (NGN)', 'RATE / RATIO', 'BENCHMARK / STATUS']);
  r1HeaderRow.height = 25;
  r1HeaderRow.eachCell((cell) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = STYLES.alignLeft;
  });

  const revRows = [
    ['Gross Invoiced Revenue', Number(summary.revenueAndCashflow.invoicedTotal) || 0, '—', 'Contract Total'],
    ['Cash Collected', Number(summary.revenueAndCashflow.collectedTotal) || 0, '—', 'Realized Inflow'],
    ['Outstanding Receivables', Number(summary.revenueAndCashflow.outstandingTotal) || 0, '—', 'Uncollected Balance'],
    ['Collection Recovery Rate', (Number(summary.revenueAndCashflow.recoveryRate) || 0) / 100, `${summary.revenueAndCashflow.recoveryRate}%`, 'Target: >= 85%'],
    ['VAT Accrued (7.5%)', Number(summary.revenueAndCashflow.vatAccrued) || 0, '7.5%', 'FIRS Statutory Output VAT'],
    ['VAT Collected', Number(summary.revenueAndCashflow.vatCollected) || 0, '—', 'Remittable Tax Share'],
  ];

  revRows.forEach((r, idx) => {
    const row = wsOverview.addRow(r);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 2) {
        if (idx === 3) {
          cell.numFmt = STYLES.percentNumFmt;
          cell.alignment = STYLES.alignRight;
        } else {
          cell.numFmt = STYLES.currencyNumFmt;
          cell.alignment = STYLES.alignRight;
        }
      } else if (colNumber === 3) {
        cell.alignment = STYLES.alignCenter;
      } else {
        cell.alignment = STYLES.alignLeft;
      }
    });
  });

  wsOverview.addRow([]); // Blank spacer

  // Section 2 Header: Logistics & Velocity
  const r2HeaderRow = wsOverview.addRow(['OPERATIONAL VELOCITY METRIC', 'COUNT / DURATION', 'EFFICIENCY RATE', 'OPERATIONAL STATUS']);
  r2HeaderRow.height = 25;
  r2HeaderRow.eachCell((cell) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = STYLES.alignLeft;
  });

  const opsRows = [
    ['Total Documents Issued', summary.documentVelocity?.totalDocuments ?? 0, '—', 'Active Volume'],
    ['Average Approval Duration (Hours)', summary.documentVelocity?.averageApprovalHours ?? 0, `${summary.documentVelocity?.averageApprovalHours ?? 0} Hours`, 'Management Review'],
    ['Total Waybill Cargo Shipments', summary.logisticsTelemetry?.totalConsignments ?? 0, '—', 'Logistics Operations'],
    ['Average Transit Duration (Days)', summary.logisticsTelemetry?.averageTransitDays ?? 0, `${summary.logisticsTelemetry?.averageTransitDays ?? 0} Days`, 'Haulage Velocity'],
    ['On-Time Delivery Success Rate', (Number(summary.logisticsTelemetry?.onTimeDeliveryRate) || 0) / 100, `${summary.logisticsTelemetry?.onTimeDeliveryRate ?? 0}%`, 'SLA Benchmark: >= 90%'],
  ];

  opsRows.forEach((r, idx) => {
    const row = wsOverview.addRow(r);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 2) {
        if (idx === 4) {
          cell.numFmt = STYLES.percentNumFmt;
        } else {
          cell.numFmt = STYLES.integerNumFmt;
        }
        cell.alignment = STYLES.alignRight;
      } else if (colNumber === 3) {
        cell.alignment = STYLES.alignCenter;
      } else {
        cell.alignment = STYLES.alignLeft;
      }
    });
  });

  autoFitColumns(wsOverview, 18);

  // --------------------------------------------------------------------------
  // SHEET 2: Monthly Trends
  // --------------------------------------------------------------------------
  const wsMonthly = wb.addWorksheet('Monthly Trends', {
    views: [{ showGridLines: true }],
  });

  const mHeader = wsMonthly.addRow([
    'Month',
    'Invoiced Revenue (NGN)',
    'Cash Collected (NGN)',
    'Outstanding Balance (NGN)',
    'Collection Ratio',
  ]);
  mHeader.height = 26;
  mHeader.eachCell((cell, colNumber) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = colNumber === 1 ? STYLES.alignLeft : STYLES.alignRight;
  });

  let sumInvoiced = 0;
  let sumCollected = 0;
  let sumOutstanding = 0;

  summary.revenueAndCashflow.monthlySeries.forEach((m) => {
    const inv = Number(m.invoicedTotal) || 0;
    const col = Number(m.collectedTotal) || 0;
    const out = Number(m.outstandingTotal) || 0;
    const ratio = inv > 0 ? col / inv : 0;

    sumInvoiced += inv;
    sumCollected += col;
    sumOutstanding += out;

    const row = wsMonthly.addRow([m.month, inv, col, out, ratio]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 1) {
        cell.alignment = STYLES.alignLeft;
      } else if (colNumber === 5) {
        cell.numFmt = STYLES.percentNumFmt;
        cell.alignment = STYLES.alignRight;
      } else {
        cell.numFmt = STYLES.currencyNumFmt;
        cell.alignment = STYLES.alignRight;
      }
    });
  });

  // Total Summary Row
  const totalRatio = sumInvoiced > 0 ? sumCollected / sumInvoiced : 0;
  const mTotalRow = wsMonthly.addRow(['TOTAL AGGREGATE', sumInvoiced, sumCollected, sumOutstanding, totalRatio]);
  mTotalRow.height = 24;
  mTotalRow.eachCell((cell, colNumber) => {
    cell.font = STYLES.totalFont;
    cell.fill = STYLES.totalFill;
    cell.border = STYLES.totalBorder;
    if (colNumber === 1) {
      cell.alignment = STYLES.alignLeft;
    } else if (colNumber === 5) {
      cell.numFmt = STYLES.percentNumFmt;
      cell.alignment = STYLES.alignRight;
    } else {
      cell.numFmt = STYLES.currencyNumFmt;
      cell.alignment = STYLES.alignRight;
    }
  });

  autoFitColumns(wsMonthly, 16);

  // --------------------------------------------------------------------------
  // SHEET 3: Aging Receivables
  // --------------------------------------------------------------------------
  const wsAging = wb.addWorksheet('Aging Receivables & VAT', {
    views: [{ showGridLines: true }],
  });

  const agingHeader = wsAging.addRow([
    'Aging Schedule Bucket',
    'Outstanding Balance (NGN)',
    'Invoice Count',
    'Share of Total Overdue',
    'Risk Category',
  ]);
  agingHeader.height = 26;
  agingHeader.eachCell((cell, colNumber) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = colNumber === 1 ? STYLES.alignLeft : STYLES.alignRight;
  });

  const agingData = [
    { label: 'Current (0-30 Days)', ...summary.agingReceivables.bucket0_30, risk: 'Low Risk (Healthy)' },
    { label: 'Past Due (31-60 Days)', ...summary.agingReceivables.bucket31_60, risk: 'Moderate Attention' },
    { label: 'Delinquent (61-90 Days)', ...summary.agingReceivables.bucket61_90, risk: 'High Warning' },
    { label: 'Severely Overdue (90+ Days)', ...summary.agingReceivables.bucket90Plus, risk: 'Critical Recovery / Default Risk' },
  ];

  let totalAgingAmt = 0;
  let totalAgingCount = 0;

  agingData.forEach((b) => {
    const amt = Number(b.amount) || 0;
    const cnt = Number(b.count) || 0;
    const pct = (Number(b.percent) || 0) / 100;

    totalAgingAmt += amt;
    totalAgingCount += cnt;

    const row = wsAging.addRow([b.label, amt, cnt, pct, b.risk]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 1 || colNumber === 5) {
        cell.alignment = STYLES.alignLeft;
      } else if (colNumber === 2) {
        cell.numFmt = STYLES.currencyNumFmt;
        cell.alignment = STYLES.alignRight;
      } else if (colNumber === 3) {
        cell.numFmt = STYLES.integerNumFmt;
        cell.alignment = STYLES.alignRight;
      } else if (colNumber === 4) {
        cell.numFmt = STYLES.percentNumFmt;
        cell.alignment = STYLES.alignRight;
      }
    });
  });

  // Total Aging Row
  const agingTotalRow = wsAging.addRow(['TOTAL RECEIVABLES SCHEDULE', totalAgingAmt, totalAgingCount, 1.0, '—']);
  agingTotalRow.height = 24;
  agingTotalRow.eachCell((cell, colNumber) => {
    cell.font = STYLES.totalFont;
    cell.fill = STYLES.totalFill;
    cell.border = STYLES.totalBorder;
    if (colNumber === 1 || colNumber === 5) {
      cell.alignment = STYLES.alignLeft;
    } else if (colNumber === 2) {
      cell.numFmt = STYLES.currencyNumFmt;
      cell.alignment = STYLES.alignRight;
    } else if (colNumber === 3) {
      cell.numFmt = STYLES.integerNumFmt;
      cell.alignment = STYLES.alignRight;
    } else if (colNumber === 4) {
      cell.numFmt = STYLES.percentNumFmt;
      cell.alignment = STYLES.alignRight;
    }
  });

  autoFitColumns(wsAging, 18);

  // --------------------------------------------------------------------------
  // SHEET 4: Client Accounts Ledger
  // --------------------------------------------------------------------------
  const wsClients = wb.addWorksheet('Client Accounts Ledger', {
    views: [{ showGridLines: true }],
  });

  const clientHeader = wsClients.addRow([
    'Client Code',
    'Client Corporate Legal Name',
    'Total Invoiced (NGN)',
    'Total Paid (NGN)',
    'Balance Due (NGN)',
    'Credit Limit (NGN)',
    'Credit Utilization',
  ]);
  clientHeader.height = 26;
  clientHeader.eachCell((cell, colNumber) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = colNumber <= 2 ? STYLES.alignLeft : STYLES.alignRight;
  });

  let clientSumInvoiced = 0;
  let clientSumPaid = 0;
  let clientSumDue = 0;

  summary.topClients.forEach((c) => {
    const inv = Number(c.totalInvoiced) || 0;
    const paid = Number(c.totalPaid) || 0;
    const due = Number(c.balanceDue) || 0;
    const limit = c.creditLimit !== undefined && c.creditLimit !== null ? Number(c.creditLimit) : null;
    const util = (Number(c.creditUtilization) || 0) / 100;

    clientSumInvoiced += inv;
    clientSumPaid += paid;
    clientSumDue += due;

    const row = wsClients.addRow([
      c.clientNumber || '—',
      c.name,
      inv,
      paid,
      due,
      limit !== null ? limit : 'N/A',
      util,
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 1) {
        cell.alignment = STYLES.alignCenter;
      } else if (colNumber === 2) {
        cell.alignment = STYLES.alignLeft;
      } else if (colNumber >= 3 && colNumber <= 5) {
        cell.numFmt = STYLES.currencyNumFmt;
        cell.alignment = STYLES.alignRight;
      } else if (colNumber === 6) {
        if (typeof cell.value === 'number') {
          cell.numFmt = STYLES.currencyNumFmt;
        }
        cell.alignment = STYLES.alignRight;
      } else if (colNumber === 7) {
        cell.numFmt = STYLES.percentNumFmt;
        cell.alignment = STYLES.alignRight;
      }
    });
  });

  // Total Client Row
  const clientTotalRow = wsClients.addRow([
    'TOTAL',
    `${summary.topClients.length} Corporate Accounts`,
    clientSumInvoiced,
    clientSumPaid,
    clientSumDue,
    '—',
    '—',
  ]);
  clientTotalRow.height = 24;
  clientTotalRow.eachCell((cell, colNumber) => {
    cell.font = STYLES.totalFont;
    cell.fill = STYLES.totalFill;
    cell.border = STYLES.totalBorder;
    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = STYLES.alignLeft;
    } else if (colNumber >= 3 && colNumber <= 5) {
      cell.numFmt = STYLES.currencyNumFmt;
      cell.alignment = STYLES.alignRight;
    } else {
      cell.alignment = STYLES.alignCenter;
    }
  });

  autoFitColumns(wsClients, 16);

  // Trigger file download
  const filename = `AOA77_Executive_Report_${dateRange}_${formattedDate}.xlsx`;
  await saveWorkbookAs(wb, filename);
}

// ============================================================================
// 2. Invoices Ledger Export (.xlsx)
// ============================================================================
export async function exportInvoicesToExcel(
  invoices: DocumentRecord[],
  currency = 'NGN',
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AOA 77 Company Ltd';
  wb.lastModifiedBy = 'Finnova Business Document System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Invoices Ledger', {
    views: [{ showGridLines: true }],
  });

  // Header row
  const header = ws.addRow([
    'Invoice #',
    'Client Name',
    'Issue Date',
    'Due Date',
    'Lifecycle Status',
    'Payment Status',
    `Subtotal (${currency})`,
    `VAT 7.5% (${currency})`,
    `Total Amount (${currency})`,
    `Balance Due (${currency})`,
  ]);
  header.height = 26;
  header.eachCell((cell, colNumber) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = colNumber >= 7 ? STYLES.alignRight : colNumber <= 2 ? STYLES.alignLeft : STYLES.alignCenter;
  });

  let sumSubtotal = 0;
  let sumTax = 0;
  let sumTotal = 0;
  let sumBalance = 0;

  invoices.forEach((inv) => {
    const subtotal = Number(inv.subtotal) || 0;
    const tax = Number(inv.taxAmount) || 0;
    const total = Number(inv.totalAmount) || 0;
    const balance = Number(inv.balanceDue) || 0;

    sumSubtotal += subtotal;
    sumTax += tax;
    sumTotal += total;
    sumBalance += balance;

    const issueDateStr = inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : '—';
    const dueDateStr = inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '—';

    const row = ws.addRow([
      inv.documentNumber,
      inv.client?.name || inv.metadata?.clientName || 'Unspecified Client',
      issueDateStr,
      dueDateStr,
      inv.status,
      inv.paymentStatus || 'UNPAID',
      subtotal,
      tax,
      total,
      balance,
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 6) {
        cell.alignment = STYLES.alignCenter;
      } else if (colNumber === 2) {
        cell.alignment = STYLES.alignLeft;
      } else {
        cell.numFmt = STYLES.currencyNumFmt;
        cell.alignment = STYLES.alignRight;
      }
    });
  });

  // Total Row
  const totalRow = ws.addRow([
    'TOTAL',
    `${invoices.length} Invoices`,
    '—',
    '—',
    '—',
    '—',
    sumSubtotal,
    sumTax,
    sumTotal,
    sumBalance,
  ]);
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = STYLES.totalFont;
    cell.fill = STYLES.totalFill;
    cell.border = STYLES.totalBorder;
    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = STYLES.alignLeft;
    } else if (colNumber >= 7) {
      cell.numFmt = STYLES.currencyNumFmt;
      cell.alignment = STYLES.alignRight;
    } else {
      cell.alignment = STYLES.alignCenter;
    }
  });

  autoFitColumns(ws, 15);

  const formattedDate = new Date().toISOString().slice(0, 10);
  await saveWorkbookAs(wb, `AOA77_Invoices_Ledger_${formattedDate}.xlsx`);
}

// ============================================================================
// 3. Payments Settlements Ledger Export (.xlsx)
// ============================================================================
export async function exportPaymentsToExcel(
  payments: PaymentRecord[],
  currency = 'NGN',
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AOA 77 Company Ltd';
  wb.lastModifiedBy = 'Finnova Business Document System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Settlements Ledger', {
    views: [{ showGridLines: true }],
  });

  // Header row
  const header = ws.addRow([
    'Payment #',
    'Reference / Cheque #',
    'Client Name',
    'Target Invoice #',
    'Payment Date',
    'Payment Method',
    `Amount Settled (${currency})`,
    'Ledger Status',
    'Notes / Purpose',
  ]);
  header.height = 26;
  header.eachCell((cell, colNumber) => {
    cell.fill = STYLES.headerFill;
    cell.font = STYLES.headerFont;
    cell.alignment = colNumber === 7 ? STYLES.alignRight : colNumber === 2 || colNumber === 3 || colNumber === 9 ? STYLES.alignLeft : STYLES.alignCenter;
  });

  let sumAmount = 0;

  payments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (!p.isReversed) {
      sumAmount += amt;
    }

    const payDateStr = p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : '—';
    const clientName = p.invoice?.document?.client?.name || (p as any).metadata?.clientName || '—';
    const invoiceNum = p.invoice?.document?.documentNumber || '—';
    const statusStr = p.isReversed ? 'REVERSED' : 'SETTLED';

    const row = ws.addRow([
      p.paymentNumber,
      p.referenceNumber || '—',
      clientName,
      invoiceNum,
      payDateStr,
      p.method || 'BANK_TRANSFER',
      amt,
      statusStr,
      p.notes || '—',
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.border = STYLES.borderSubtle;
      cell.font = STYLES.dataFont;
      if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 6 || colNumber === 8) {
        cell.alignment = STYLES.alignCenter;
      } else if (colNumber === 7) {
        cell.numFmt = STYLES.currencyNumFmt;
        cell.alignment = STYLES.alignRight;
      } else {
        cell.alignment = STYLES.alignLeft;
      }
    });
  });

  // Total Row
  const totalRow = ws.addRow([
    'TOTAL NET SETTLED',
    `${payments.filter((p) => !p.isReversed).length} Active Settlements`,
    '—',
    '—',
    '—',
    '—',
    sumAmount,
    '—',
    '—',
  ]);
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = STYLES.totalFont;
    cell.fill = STYLES.totalFill;
    cell.border = STYLES.totalBorder;
    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = STYLES.alignLeft;
    } else if (colNumber === 7) {
      cell.numFmt = STYLES.currencyNumFmt;
      cell.alignment = STYLES.alignRight;
    } else {
      cell.alignment = STYLES.alignCenter;
    }
  });

  autoFitColumns(ws, 15);

  const formattedDate = new Date().toISOString().slice(0, 10);
  await saveWorkbookAs(wb, `AOA77_Payments_Settlements_${formattedDate}.xlsx`);
}
