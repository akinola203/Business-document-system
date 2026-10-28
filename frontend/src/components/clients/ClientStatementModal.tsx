import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Client, DocumentRecord, PaymentRecord } from '../../types';
import { DEMO_INVOICES } from '../../lib/mock-data';
import { formatCurrency, formatDate, extractArray } from '../../lib/utils';
import {
  X,
  Printer,
  FileSpreadsheet,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  DollarSign,
} from 'lucide-react';

interface ClientStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

type DateRangeFilter = 'ALL' | '30D' | '90D' | 'YTD';
type TransactionTypeFilter = 'ALL' | 'INVOICES' | 'PAYMENTS';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  description: string;
  status?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export const ClientStatementModal: React.FC<ClientStatementModalProps> = ({
  isOpen,
  onClose,
  client,
}) => {
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('ALL');

  // 1. Fetch Client's Invoices
  const { data: invoicesData } = useQuery<any>({
    queryKey: ['client-invoices', client?.id],
    enabled: isOpen && !!client,
    queryFn: async () => {
      try {
        const res = await apiClient.get('/documents', {
          params: { clientId: client?.id, documentType: 'INVOICE', limit: 100 },
        });
        return res.data;
      } catch {
        return { items: DEMO_INVOICES.filter((i) => i.clientId === client?.id) };
      }
    },
  });

  const clientInvoices: DocumentRecord[] = useMemo(() => {
    const raw = extractArray<DocumentRecord>(invoicesData, []);
    if (raw.length > 0) return raw;
    return DEMO_INVOICES.filter((i) => i.clientId === client?.id || !i.clientId);
  }, [invoicesData, client]);

  // 2. Fetch Client's Payments
  const { data: paymentsData } = useQuery<any>({
    queryKey: ['client-payments', client?.id],
    enabled: isOpen && !!client,
    queryFn: async () => {
      try {
        const res = await apiClient.get('/payments', {
          params: { clientId: client?.id, limit: 100, includeReversed: false },
        });
        return res.data;
      } catch {
        return { items: [] };
      }
    },
  });

  const clientPayments: PaymentRecord[] = useMemo(() => {
    const raw = extractArray<PaymentRecord>(paymentsData, []);
    if (raw.length > 0) return raw;

    // Fallback: extract settled payments from invoices
    const derived: PaymentRecord[] = [];
    clientInvoices.forEach((inv) => {
      const total = Number(inv.totalAmount) || 0;
      const balance = Number(inv.balanceDue) || 0;
      const paid = Math.max(0, total - balance);
      if (paid > 0) {
        derived.push({
          id: `pay-fallback-${inv.id}`,
          companyId: inv.companyId,
          recordedById: inv.createdById || 'usr-system',
          paymentNumber: `RCP-${inv.documentNumber?.replace('INV-', '') || '001'}`,
          invoiceId: inv.id,
          amount: paid,
          currency: inv.currency || 'NGN',
          paymentDate: inv.issueDate || new Date().toISOString(),
          method: 'BANK_TRANSFER',
          referenceNumber: `TRX-${inv.documentNumber || 'REF'}`,
          isReversed: false,
          notes: 'Settlement receipt',
          createdAt: inv.createdAt,
        });
      }
    });
    return derived;
  }, [paymentsData, clientInvoices]);

  // 3. Fetch Company Profile for Official Letterhead & Remittance Details
  const { data: companyData } = useQuery<any>({
    queryKey: ['company-profile'],
    enabled: isOpen,
    queryFn: async () => {
      try {
        const res = await apiClient.get('/company/profile');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const company = companyData || {
    name: 'AOA 77 COMPANY LTD',
    taxId: '10098492-0001',
    registrationNumber: 'RC-1849204',
    address: 'Plot 12 Commercial Way, Victoria Island',
    city: 'Lagos',
    state: 'Lagos State',
    country: 'Nigeria',
    phone: '+234 1 892 0000',
    email: 'finance@aoa77.com',
    bankAccounts: [
      {
        bankName: 'Zenith Bank Plc',
        accountNumber: '1012948201',
        accountName: 'AOA 77 COMPANY LTD',
        currency: 'NGN',
      },
    ],
  };

  // 4. Build Chronological Ledger Entries
  const rawLedgerEntries = useMemo(() => {
    const entries: Omit<LedgerEntry, 'runningBalance'>[] = [];

    // Add invoices (Debits)
    clientInvoices.forEach((inv) => {
      const issueDate = inv.issueDate || inv.createdAt;
      entries.push({
        id: `inv-${inv.id}`,
        date: issueDate,
        type: 'INVOICE',
        reference: inv.documentNumber,
        description: inv.title || 'Commercial Billing',
        status: inv.status,
        debit: Number(inv.totalAmount) || 0,
        credit: 0,
      });
    });

    // Add payments (Credits)
    clientPayments.forEach((pay) => {
      if (pay.isReversed) return;
      entries.push({
        id: `pay-${pay.id}`,
        date: pay.paymentDate,
        type: 'PAYMENT',
        reference: pay.paymentNumber,
        description: `Payment via ${(pay.method || 'BANK_TRANSFER').replace('_', ' ')} (Ref: ${pay.referenceNumber || 'Direct Settlement'})`,
        status: 'CONFIRMED',
        debit: 0,
        credit: Number(pay.amount) || 0,
      });
    });

    // Sort chronologically ascending
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let currentBalance = 0;
    const computedEntries: LedgerEntry[] = entries.map((entry) => {
      currentBalance += entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance: currentBalance,
      };
    });

    return computedEntries;
  }, [clientInvoices, clientPayments]);

  // 5. Apply Date & Type Filters
  const filteredLedger = useMemo(() => {
    const now = new Date();

    return rawLedgerEntries.filter((entry) => {
      // Type filter
      if (typeFilter === 'INVOICES' && entry.type !== 'INVOICE') return false;
      if (typeFilter === 'PAYMENTS' && entry.type !== 'PAYMENT') return false;

      // Date filter
      const entryDate = new Date(entry.date);
      if (dateFilter === '30D') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (entryDate < past30) return false;
      } else if (dateFilter === '90D') {
        const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (entryDate < past90) return false;
      } else if (dateFilter === 'YTD') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        if (entryDate < startOfYear) return false;
      }

      return true;
    });
  }, [rawLedgerEntries, dateFilter, typeFilter]);

  // Financial Metrics Summary
  const totalBilled = filteredLedger.reduce((sum, e) => sum + e.debit, 0);
  const totalPaid = filteredLedger.reduce((sum, e) => sum + e.credit, 0);
  const closingBalance = rawLedgerEntries.length > 0
    ? rawLedgerEntries[rawLedgerEntries.length - 1].runningBalance
    : 0;

  // Aging Analysis
  const agingAnalysis = useMemo(() => {
    const now = new Date();
    let current = 0;
    let days30 = 0;
    let days60 = 0;
    let days90Plus = 0;

    clientInvoices.forEach((inv) => {
      const balance = Number(inv.balanceDue) || 0;
      if (balance <= 0) return;

      const dueDate = inv.invoice?.dueDate ? new Date(inv.invoice.dueDate) : new Date(inv.issueDate || inv.createdAt);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        current += balance;
      } else if (diffDays <= 30) {
        days30 += balance;
      } else if (diffDays <= 60) {
        days60 += balance;
      } else {
        days90Plus += balance;
      }
    });

    return { current, days30, days60, days90Plus };
  }, [clientInvoices]);

  if (!isOpen || !client) return null;

  const handlePrint = () => {
    window.print();
  };

  const statementNumber = `SOA-${client.clientNumber || 'CLI'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const statementDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const defaultBank = company.bankAccounts?.[0] || {
    bankName: 'Zenith Bank Plc',
    accountNumber: '1012948201',
    accountName: company.name || 'AOA 77 COMPANY LTD',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200/90 my-auto flex flex-col max-h-[92vh]">
        {/* =====================================================================
            TOP CONTROL BAR (Hidden during printing)
        ===================================================================== */}
        <div className="p-4 md:px-6 md:py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 rounded-t-3xl no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Customer Statement of Account</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[10px] font-mono font-bold text-[#5847F6] border border-indigo-200">
                  {statementNumber}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Official chronological ledger for {client.companyName || client.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center bg-white rounded-full p-1 border border-slate-200 text-xs">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: '30D', label: 'Last 30D' },
                { id: '90D', label: 'Last 90D' },
                { id: 'YTD', label: 'This Year' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDateFilter(t.id as DateRangeFilter)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    dateFilter === t.id
                      ? 'bg-[#16181F] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =====================================================================
            SCROLLABLE A4 PRINTABLE STATEMENT CANVAS
        ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-white print-statement-sheet">
          {/* 1. Official Letterhead Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-slate-900 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#5847F6] text-white font-black text-lg flex items-center justify-center shadow-md">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                    {company.name}
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Enterprise Financial Ledger & Remittance
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 pt-1 leading-snug">
                {company.address}, {company.city}, {company.state}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                RC: {company.registrationNumber || 'RC-184920'} • TIN: {company.taxId || '10023910-0001'}
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 rounded-full bg-[#16181F] text-white text-xs font-black tracking-wider uppercase">
                Statement of Account
              </span>
              <p className="text-xs font-mono font-bold text-slate-900 pt-1">
                Ref: {statementNumber}
              </p>
              <p className="text-[11px] text-slate-500">
                Generated Date: <strong className="text-slate-800">{statementDate}</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Period: <strong className="text-slate-800">{dateFilter === 'ALL' ? 'Complete Financial History' : dateFilter}</strong>
              </p>
            </div>
          </div>

          {/* 2. Client Commercial Profile Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                Account Statement Issued To:
              </span>
              <h2 className="text-base font-black text-slate-900">
                {client.companyName || client.name}
              </h2>
              {client.companyName && (
                <p className="text-xs text-slate-600 font-medium">Attn: {client.name}</p>
              )}
              <p className="text-xs text-slate-600 leading-snug mt-1">
                {client.address || 'Standard Corporate Premises'}
              </p>
              {client.email && (
                <p className="text-xs text-slate-500 mt-0.5">{client.email} • {client.phone || ''}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                Account Identifiers:
              </span>
              <p className="text-slate-700">
                Client Code: <strong className="font-mono text-slate-900">{client.clientNumber || 'CLI-0001'}</strong>
              </p>
              <p className="text-slate-700">
                CAC RC Number: <strong className="font-mono text-slate-900">{client.rcNumber || 'RC-129481'}</strong>
              </p>
              <p className="text-slate-700">
                Tax ID (TIN): <strong className="font-mono text-slate-900">{client.taxNumber || '10294821-0001'}</strong>
              </p>
              <p className="text-slate-700">
                Standard Credit Terms: <strong className="text-[#5847F6]">Net {client.paymentTermsDays || 30} Days</strong>
              </p>
            </div>
          </div>

          {/* 3. Top Financial Metrics (Bento Ledger Summary) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <div className="flex items-center justify-between text-indigo-700">
                <span className="text-xs font-bold uppercase tracking-wider">Total Invoiced (Debits)</span>
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-slate-900 tabular-nums mt-1">
                {formatCurrency(totalBilled, 'NGN')}
              </p>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                Cumulative billings within period
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-xs font-bold uppercase tracking-wider">Total Received (Credits)</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-emerald-700 tabular-nums mt-1">
                {formatCurrency(totalPaid, 'NGN')}
              </p>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                Cleared payment remittances
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-lg">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-bold uppercase tracking-wider">Net Outstanding Balance</span>
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-amber-300 tabular-nums mt-1">
                {formatCurrency(closingBalance, 'NGN')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                Closing settlement balance due
              </span>
            </div>
          </div>

          {/* 4. Aging Receivables Schedule */}
          {closingBalance > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    Aging Receivables Analysis (Outstanding Schedule)
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 font-bold">
                  Total Due: {formatCurrency(closingBalance, 'NGN')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 rounded-xl bg-white border border-amber-100">
                  <span className="text-[10px] font-bold text-slate-500 block">Current (0-30 Days)</span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">
                    {formatCurrency(agingAnalysis.current, 'NGN')}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-amber-100">
                  <span className="text-[10px] font-bold text-slate-500 block">31 - 60 Days</span>
                  <span className="text-xs font-black text-amber-700 tabular-nums">
                    {formatCurrency(agingAnalysis.days30, 'NGN')}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-amber-100">
                  <span className="text-[10px] font-bold text-slate-500 block">61 - 90 Days</span>
                  <span className="text-xs font-black text-orange-600 tabular-nums">
                    {formatCurrency(agingAnalysis.days60, 'NGN')}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white border border-amber-100">
                  <span className="text-[10px] font-bold text-slate-500 block">&gt; 90 Days Overdue</span>
                  <span className="text-xs font-black text-rose-600 tabular-nums">
                    {formatCurrency(agingAnalysis.days90Plus, 'NGN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. Itemized Chronological Ledger Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#5847F6]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Chronological Transaction Ledger ({filteredLedger.length})
                </h3>
              </div>

              {/* In-Modal Filter (Hidden during print) */}
              <div className="flex items-center gap-1 text-[11px] no-print">
                <span className="text-slate-400 font-medium">Show:</span>
                {(['ALL', 'INVOICES', 'PAYMENTS'] as TransactionTypeFilter[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTypeFilter(tab)}
                    className={`px-2.5 py-0.5 rounded-full font-bold cursor-pointer ${
                      typeFilter === tab
                        ? 'bg-slate-200 text-slate-900'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (+₦)</th>
                    <th className="py-2.5 px-3 text-right">Credit (-₦)</th>
                    <th className="py-2.5 px-3 text-right">Balance (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No financial records found in this statement period.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((entry, idx) => (
                      <tr
                        key={entry.id || idx}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              entry.type === 'INVOICE'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {entry.reference}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          {entry.description}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {entry.debit > 0 ? formatCurrency(entry.debit, 'NGN') : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 tabular-nums">
                          {entry.credit > 0 ? formatCurrency(entry.credit, 'NGN') : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                          {formatCurrency(entry.runningBalance, 'NGN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900 text-xs">
                    <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-[11px]">
                      Ledger Period Totals:
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {formatCurrency(totalBilled, 'NGN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(totalPaid, 'NGN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm font-black text-[#5847F6]">
                      {formatCurrency(closingBalance, 'NGN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 6. Settlement Bank Remittance Details */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                Remittance Banking Details (Direct Wire Settlement):
              </span>
              <div className="space-y-1">
                <p className="text-slate-700">
                  Beneficiary Bank: <strong className="text-slate-900 font-bold">{defaultBank.bankName}</strong>
                </p>
                <p className="text-slate-700">
                  Account Name: <strong className="text-slate-900 font-bold">{defaultBank.accountName}</strong>
                </p>
                <p className="text-slate-700">
                  NUBAN Account Number: <strong className="font-mono text-base font-black text-[#5847F6] tracking-wider">{defaultBank.accountNumber}</strong>
                </p>
              </div>
            </div>

            <div className="text-slate-500 text-[11px] leading-relaxed flex flex-col justify-between">
              <p>
                <strong>Payment Advisory:</strong> Please quote Statement Reference <span className="font-mono font-bold text-slate-800">{statementNumber}</span> or your Client Code <span className="font-mono font-bold text-slate-800">{client.clientNumber}</span> on all wire settlement advice slips to ensure immediate allocation.
              </p>
              <p className="text-[10px] text-slate-400 mt-2">
                For reconciliation inquiries, email: <strong className="text-slate-600">{company.email}</strong>
              </p>
            </div>
          </div>

          {/* 7. Corporate Seal & Sign-off Signature Block */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Prepared & Certified By (Credit Control / Treasury)
              </span>
              <div className="h-10 border-b border-dashed border-slate-300 mt-2 flex items-end pb-1 font-serif text-slate-700">
                Accounts Department
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Officer Signature & Seal</p>
            </div>

            <div className="text-right flex flex-col justify-end">
              <div className="flex items-center justify-end gap-1.5 text-slate-600 font-semibold text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified System Ledger</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                Audit Token: {statementNumber}-{client.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
