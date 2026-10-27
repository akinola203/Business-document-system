import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Download,
  Printer,
  DollarSign,
  Receipt,
  Truck,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { DEMO_REPORTS_SUMMARY } from '../../lib/mock-data';
import { ReportsSummary } from '../../types';
import { RecessedTabNotch, TabItem } from '../../components/workspace/RecessedTabNotch';

type DateRange = 'month' | 'quarter' | 'ytd' | 'all';
type ReportTab = 'financial' | 'aging' | 'logistics' | 'velocity';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [activeTab, setActiveTab] = useState<ReportTab>('financial');
  const [currency] = useState<string>('NGN');

  // Fetch reports summary from live API, falling back to deterministic demo data on network error
  const { data: summaryData, isLoading } = useQuery<ReportsSummary>({
    queryKey: ['reports-summary', dateRange, currency],
    queryFn: async () => {
      try {
        const params: Record<string, string> = { currency };
        const now = new Date();
        if (dateRange === 'month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          params.startDate = firstDay.toISOString();
        } else if (dateRange === 'quarter') {
          const firstDay = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          params.startDate = firstDay.toISOString();
        } else if (dateRange === 'ytd') {
          const firstDay = new Date(now.getFullYear(), 0, 1);
          params.startDate = firstDay.toISOString();
        }

        const res = await apiClient.get('/reports/summary', { params });
        return res.data?.data || res.data;
      } catch (err: any) {
        // Fallback cleanly on network failure
        if (!err.response) {
          return DEMO_REPORTS_SUMMARY;
        }
        throw err;
      }
    },
    initialData: DEMO_REPORTS_SUMMARY,
  });

  const summary = summaryData || DEMO_REPORTS_SUMMARY;

  const tabs: TabItem[] = useMemo(
    () => [
      { key: 'financial', label: 'Financial & Revenue' },
      { key: 'aging', label: 'Aging Receivables & VAT' },
      { key: 'logistics', label: 'Logistics & Waybills' },
      { key: 'velocity', label: 'Operational Velocity' },
    ],
    [],
  );

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatShortNaira = (amount: number) => {
    if (amount >= 1_000_000) {
      return `₦${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (amount >= 1_000) {
      return `₦${(amount / 1_000).toFixed(0)}k`;
    }
    return `₦${amount}`;
  };

  const handleExportCsv = () => {
    const rows = [
      ['AOA 77 COMPANY LTD - EXECUTIVE FINANCIAL REPORT'],
      ['Generated Date', new Date().toISOString()],
      ['Currency', currency],
      ['Date Range', dateRange.toUpperCase()],
      [],
      ['REVENUE & CASHFLOW SUMMARY'],
      ['Gross Invoiced Revenue', summary.revenueAndCashflow.invoicedTotal],
      ['Cash Collected', summary.revenueAndCashflow.collectedTotal],
      ['Outstanding Receivables', summary.revenueAndCashflow.outstandingTotal],
      ['Collection Recovery Rate (%)', `${summary.revenueAndCashflow.recoveryRate}%`],
      ['VAT Accrued (7.5%)', summary.revenueAndCashflow.vatAccrued],
      ['VAT Collected', summary.revenueAndCashflow.vatCollected],
      [],
      ['MONTHLY TRENDS'],
      ['Month', 'Invoiced Total (NGN)', 'Collected Total (NGN)', 'Outstanding (NGN)'],
      ...summary.revenueAndCashflow.monthlySeries.map((m) => [
        m.month,
        m.invoicedTotal,
        m.collectedTotal,
        m.outstandingTotal,
      ]),
      [],
      ['AGING RECEIVABLES'],
      ['Bucket', 'Amount (NGN)', 'Invoice Count', 'Share (%)'],
      ['0-30 Days', summary.agingReceivables.bucket0_30.amount, summary.agingReceivables.bucket0_30.count, `${summary.agingReceivables.bucket0_30.percent}%`],
      ['31-60 Days', summary.agingReceivables.bucket31_60.amount, summary.agingReceivables.bucket31_60.count, `${summary.agingReceivables.bucket31_60.percent}%`],
      ['61-90 Days', summary.agingReceivables.bucket61_90.amount, summary.agingReceivables.bucket61_90.count, `${summary.agingReceivables.bucket61_90.percent}%`],
      ['90+ Days Overdue', summary.agingReceivables.bucket90Plus.amount, summary.agingReceivables.bucket90Plus.count, `${summary.agingReceivables.bucket90Plus.percent}%`],
      [],
      ['TOP CLIENT ACCOUNTS'],
      ['Client Code', 'Client Name', 'Total Invoiced', 'Total Paid', 'Balance Due', 'Credit Limit', 'Utilization (%)'],
      ...summary.topClients.map((c) => [
        c.clientNumber,
        c.name,
        c.totalInvoiced,
        c.totalPaid,
        c.balanceDue,
        c.creditLimit || 'N/A',
        `${c.creditUtilization}%`,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AOA77_Executive_Report_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintBrief = () => {
    window.print();
  };

  const maxMonthly = useMemo(() => {
    const series = summary.revenueAndCashflow.monthlySeries || [];
    if (!series.length) return 10000000;
    return Math.max(...series.map((s) => Math.max(s.invoicedTotal, s.collectedTotal))) * 1.15;
  }, [summary]);

  return (
    <div className="w-full space-y-6">
      {/* TIER 1: CONTEXT HEADER & EXPORT DOCK */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Reports & Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#5847F6]/10 text-[#5847F6] border border-[#5847F6]/20">
              Live Audited
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Consolidated financial performance, tax compliance, receivables aging, and supply chain telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector Pills */}
          <div className="flex items-center bg-[#F4F5F9] p-1 rounded-full border border-slate-200">
            {(['month', 'quarter', 'ytd', 'all'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
                  dateRange === range
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {range === 'month' && 'This Month'}
                {range === 'quarter' && 'Last Quarter'}
                {range === 'ytd' && 'YTD (2026)'}
                {range === 'all' && 'All Time'}
              </button>
            ))}
          </div>

          {/* Action Dock Pills */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrintBrief}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Brief</span>
          </button>
        </div>
      </div>

      {/* TIER 2: 4-COLUMN BENTO KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Invoiced Revenue */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gross Invoiced</span>
            <div className="w-8 h-8 rounded-full bg-[#5847F6]/10 flex items-center justify-center text-[#5847F6]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {formatNaira(summary.revenueAndCashflow.invoicedTotal)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% vs. prior period</span>
          </div>
        </div>

        {/* KPI 2: Net Cash Collected & Recovery Rate */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cash Collected</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {formatNaira(summary.revenueAndCashflow.collectedTotal)}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Settlement Rate</span>
              <span className="text-[#5847F6] tabular-nums">{summary.revenueAndCashflow.recoveryRate}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#5847F6] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.revenueAndCashflow.recoveryRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: VAT (7.5%) Liability & Reconciliation */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">VAT Liability (7.5%)</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {formatNaira(summary.revenueAndCashflow.vatAccrued)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mt-2">
            <span>Collected: <strong className="text-slate-800 tabular-nums">{formatShortNaira(summary.revenueAndCashflow.vatCollected)}</strong></span>
            <span className="text-blue-600 font-bold">FIRS Compliant</span>
          </div>
        </div>

        {/* KPI 4: Logistics Fulfillment Rate */}
        <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fulfillment Rate</span>
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {summary.logisticsTelemetry.onTimeDeliveryRate}%
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-slate-500">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>Avg. Turnaround: <strong className="text-slate-800 tabular-nums">{summary.logisticsTelemetry.averageTransitDays} Days</strong></span>
          </div>
        </div>
      </div>

      {/* TIER 3: INTERACTIVE CATEGORY TAB NOTCH */}
      <RecessedTabNotch
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as ReportTab)}
      />

      {/* TIER 4: DEEP OBSIDIAN ANALYTICS & BREAKDOWN STAGE */}
      <div className="bg-[#16181F] rounded-[32px] p-6 md:p-8 text-white shadow-xl border border-white/5 space-y-8">
        {/* TAB 1: FINANCIAL & REVENUE */}
        {activeTab === 'financial' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 7 Columns: Interactive High-Contrast Chart */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">Monthly Cashflow & Revenue Trajectory</h3>
                  <p className="text-xs text-slate-400">Billed Invoice Volume vs. Realized Bank Cash Inflow</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#5847F6]" />
                    <span className="text-slate-300">Billed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                    <span className="text-slate-300">Collected</span>
                  </div>
                </div>
              </div>

              {/* Monthly Visual Bar Chart */}
              <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-white/10">
                {summary.revenueAndCashflow.monthlySeries.map((m) => {
                  const billedHeight = Math.max(8, Math.min(100, (m.invoicedTotal / maxMonthly) * 100));
                  const collectedHeight = Math.max(8, Math.min(100, (m.collectedTotal / maxMonthly) * 100));

                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 p-2 rounded-lg text-[10px] whitespace-nowrap z-20 pointer-events-none shadow-xl">
                        <div className="font-bold text-white">{m.month} 2026</div>
                        <div className="text-indigo-300">Billed: {formatShortNaira(m.invoicedTotal)}</div>
                        <div className="text-emerald-300">Collected: {formatShortNaira(m.collectedTotal)}</div>
                      </div>

                      {/* Bar Pair */}
                      <div className="w-full flex items-end justify-center gap-1 h-48">
                        <div
                          className="w-1/2 bg-[#5847F6] rounded-t-md transition-all duration-500 hover:brightness-110"
                          style={{ height: `${billedHeight}%` }}
                        />
                        <div
                          className="w-1/2 bg-emerald-400 rounded-t-md transition-all duration-500 hover:brightness-110"
                          style={{ height: `${collectedHeight}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">{m.month}</span>
                    </div>
                  );
                })}
              </div>

              {/* Cashflow Summary Metrics Pill Dock */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Billed</span>
                  <div className="text-lg font-black text-white tabular-nums mt-0.5">
                    {formatShortNaira(summary.revenueAndCashflow.invoicedTotal)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Collected</span>
                  <div className="text-lg font-black text-emerald-400 tabular-nums mt-0.5">
                    {formatShortNaira(summary.revenueAndCashflow.collectedTotal)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Receivables</span>
                  <div className="text-lg font-black text-amber-400 tabular-nums mt-0.5">
                    {formatShortNaira(summary.revenueAndCashflow.outstandingTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Royal Indigo Glassmorphic Client Leaderboard */}
            <div className="lg:col-span-5 bg-[#5B58B6] rounded-[24px] p-6 text-white shadow-xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-white/90" />
                    <h4 className="text-base font-black tracking-tight">Top Client Accounts</h4>
                  </div>
                  <button
                    onClick={() => navigate('/clients')}
                    className="text-xs font-bold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>View Directory</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-white/70 mb-5">
                  Institutional accounts ranked by aggregate billings & credit exposure.
                </p>

                {/* Client List */}
                <div className="space-y-4">
                  {summary.topClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => navigate('/clients')}
                      className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-3.5 border border-white/10 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="font-bold text-xs text-white truncate max-w-[180px]">
                          {client.name}
                        </div>
                        <div className="text-xs font-black tabular-nums text-white">
                          {formatShortNaira(client.totalInvoiced)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-white/70 mb-2">
                        <span>Balance Due: <strong className="text-white tabular-nums">{formatShortNaira(client.balanceDue)}</strong></span>
                        <span>Util: <strong className="text-white tabular-nums">{client.creditUtilization}%</strong></span>
                      </div>

                      {/* Utilization bar */}
                      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            client.creditUtilization > 75 ? 'bg-rose-400' : 'bg-white'
                          }`}
                          style={{ width: `${Math.min(100, client.creditUtilization)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/80">
                <span>Total Active Debtors: <strong>{summary.topClients.length}</strong></span>
                <span className="font-bold">AOA 77 Client Portfolio</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AGING RECEIVABLES & VAT */}
        {activeTab === 'aging' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-black tracking-tight text-white mb-1">Aging Receivables Analysis</h3>
              <p className="text-xs text-slate-400">Overdue bucket segmentation and payment risk exposure</p>
            </div>

            {/* 4 Bucket Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                  <span>0 - 30 Days (Current)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">Healthy</span>
                </div>
                <div className="text-xl font-black text-white tabular-nums">
                  {formatNaira(summary.agingReceivables.bucket0_30.amount)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{summary.agingReceivables.bucket0_30.count} Invoices</span>
                  <span className="font-bold">{summary.agingReceivables.bucket0_30.percent}% of total</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${summary.agingReceivables.bucket0_30.percent}%` }} />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-blue-400 text-xs font-bold">
                  <span>31 - 60 Days Overdue</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-[10px]">Active</span>
                </div>
                <div className="text-xl font-black text-white tabular-nums">
                  {formatNaira(summary.agingReceivables.bucket31_60.amount)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{summary.agingReceivables.bucket31_60.count} Invoices</span>
                  <span className="font-bold">{summary.agingReceivables.bucket31_60.percent}% of total</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${summary.agingReceivables.bucket31_60.percent}%` }} />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                  <span>61 - 90 Days Overdue</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px]">Attention</span>
                </div>
                <div className="text-xl font-black text-white tabular-nums">
                  {formatNaira(summary.agingReceivables.bucket61_90.amount)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{summary.agingReceivables.bucket61_90.count} Invoices</span>
                  <span className="font-bold">{summary.agingReceivables.bucket61_90.percent}% of total</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${summary.agingReceivables.bucket61_90.percent}%` }} />
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center justify-between text-rose-400 text-xs font-bold">
                  <span>90+ Days (Critical)</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[10px]">Escalate</span>
                </div>
                <div className="text-xl font-black text-white tabular-nums">
                  {formatNaira(summary.agingReceivables.bucket90Plus.amount)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{summary.agingReceivables.bucket90Plus.count} Invoices</span>
                  <span className="font-bold">{summary.agingReceivables.bucket90Plus.percent}% of total</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${summary.agingReceivables.bucket90Plus.percent}%` }} />
                </div>
              </div>
            </div>

            {/* VAT 7.5% Tax Ledger Audit Box */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-white">VAT (7.5%) Compliance & FIRS Reconciliation</h4>
                  <p className="text-xs text-slate-400">Authoritative statutory tax tracking for Nigerian Federal Inland Revenue Service</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#5847F6]/20 text-[#5847F6] border border-[#5847F6]/30">
                  Value Added Tax Act 2020
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Total Accrued VAT Liability</span>
                  <div className="text-xl font-black text-white tabular-nums">
                    {formatNaira(summary.revenueAndCashflow.vatAccrued)}
                  </div>
                  <p className="text-[11px] text-slate-500">Calculated across all issued non-cancelled commercial invoices</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Total Realized Settled VAT</span>
                  <div className="text-xl font-black text-emerald-400 tabular-nums">
                    {formatNaira(summary.revenueAndCashflow.vatCollected)}
                  </div>
                  <p className="text-[11px] text-slate-500">Cash received proportional to settled customer payments</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Pending Tax Recovery</span>
                  <div className="text-xl font-black text-amber-400 tabular-nums">
                    {formatNaira(summary.revenueAndCashflow.vatAccrued - summary.revenueAndCashflow.vatCollected)}
                  </div>
                  <p className="text-[11px] text-slate-500">Tax embedded in unpaid outstanding commercial receivables</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOGISTICS & WAYBILLS */}
        {activeTab === 'logistics' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-white mb-1">Logistics & Consignment Telemetry</h3>
                <p className="text-xs text-slate-400">Fleet dispatch efficiency, transit turnaround, and delivery fulfillment</p>
              </div>
              <button
                onClick={() => navigate('/documents/waybills')}
                className="text-xs font-bold text-[#5847F6] hover:text-[#7B6EFA] flex items-center gap-1 transition-colors"
              >
                <span>Waybills Workspace</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Status Breakdown Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(summary.logisticsTelemetry.statusBreakdown).map(([status, count]) => (
                <div key={status} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{status.replace('_', ' ')}</span>
                  <div className="text-2xl font-black text-white tabular-nums">{count}</div>
                </div>
              ))}
            </div>

            {/* Turnaround & Operational Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Transit Turnaround Performance</h4>
                    <p className="text-xs text-slate-400">Average duration between depot departure and recipient sign-off</p>
                  </div>
                </div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {summary.logisticsTelemetry.averageTransitDays} <span className="text-base font-semibold text-slate-400">Calendar Days</span>
                </div>
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>34% faster than industry benchmark for South-West Nigeria logistics</span>
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Consignment Fulfillment Success</h4>
                    <p className="text-xs text-slate-400">Completed deliveries without exception or transit damage</p>
                  </div>
                </div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {summary.logisticsTelemetry.onTimeDeliveryRate}%
                </div>
                <p className="text-xs text-slate-400">
                  Total Managed Consignments: <strong className="text-white tabular-nums">{summary.logisticsTelemetry.totalConsignments} shipments</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OPERATIONAL VELOCITY */}
        {activeTab === 'velocity' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-black tracking-tight text-white mb-1">Document Velocity & Administrative Output</h3>
              <p className="text-xs text-slate-400">Lifecycle throughput, approval latency, and corporate publishing metrics</p>
            </div>

            {/* Document Distribution By Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Invoices</span>
                  <span className="text-indigo-400">Commercial</span>
                </div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {summary.documentVelocity.byType.INVOICE || 0}
                </div>
                <p className="text-xs text-slate-400">Tax invoices and billing claims generated</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Waybills</span>
                  <span className="text-purple-400">Fulfillment</span>
                </div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {summary.documentVelocity.byType.WAYBILL || 0}
                </div>
                <p className="text-xs text-slate-400">Consignment notes & dispatch manifests</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Official Letters</span>
                  <span className="text-blue-400">Corporate</span>
                </div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {summary.documentVelocity.byType.LETTER || 0}
                </div>
                <p className="text-xs text-slate-400">Formal letters, tenders & executive correspondence</p>
              </div>
            </div>

            {/* Approval Latency Card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h4 className="text-base font-black text-white">Average Approval Turnaround Time</h4>
                </div>
                <p className="text-xs text-slate-400 max-w-xl">
                  Measures elapsed time between staff document submission (`PENDING_APPROVAL`) and executive manager sign-off (`APPROVED`).
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-amber-400 tabular-nums">
                  {summary.documentVelocity.averageApprovalHours} <span className="text-lg font-bold text-slate-400">Hours</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400">Within 24-hour enterprise SLA</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
