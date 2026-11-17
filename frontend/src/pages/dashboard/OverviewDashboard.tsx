import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatCurrency, formatRelativeTime, extractArray } from '../../lib/utils';
import { DocumentRecord, PaymentRecord } from '../../types';
import {
  FileText,
  Truck,
  Mail,
  CreditCard,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ChevronRight,
  ArrowLeftRight,
  UserCheck,
  Settings,
} from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Fetch real documents from the database
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['overview-recent-documents'],
    queryFn: async () => {
      const res = await apiClient.get('/documents', {
        params: { page: 1, limit: 50 },
      });
      return res.data;
    },
  });

  // Fetch real payments from the database
  const { data: paymentsData } = useQuery({
    queryKey: ['overview-payments'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/payments', {
          params: { page: 1, limit: 100 },
        });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const allDocuments = useMemo(
    () => extractArray<DocumentRecord>(documentsData, []),
    [documentsData],
  );
  const recentDocuments = useMemo(() => allDocuments.slice(0, 6), [allDocuments]);
  const allPayments = useMemo(
    () => extractArray<PaymentRecord>(paymentsData, []),
    [paymentsData],
  );

  // Compute live database totals (starting at ₦0.00 and 0 documents)
  const kpiStats = useMemo(() => {
    const invoices = allDocuments.filter((d) => d.documentType === 'INVOICE');
    const waybills = allDocuments.filter((d) => d.documentType === 'WAYBILL');

    const unpaidInvoices = invoices.filter(
      (inv) =>
        inv.status === 'ISSUED' &&
        (inv.paymentStatus === 'UNPAID' ||
          inv.paymentStatus === 'PARTIALLY_PAID' ||
          Number(inv.balanceDue || 0) > 0),
    );
    const outstandingBalance = unpaidInvoices.reduce(
      (sum, inv) => sum + Number(inv.balanceDue || 0),
      0,
    );

    const draftsAndPending = allDocuments.filter(
      (d) => d.status === 'DRAFT' || d.status === 'PENDING_APPROVAL',
    );

    const activeWaybills = waybills.filter(
      (w) =>
        w.waybill?.deliveryStatus === 'IN_TRANSIT' ||
        w.waybill?.deliveryStatus === 'READY_FOR_DISPATCH' ||
        w.waybill?.deliveryStatus === 'PREPARING',
    );

    const activePayments = allPayments.filter((p) => !p.isReversed);
    const totalCollected = activePayments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    return {
      outstandingBalance,
      unpaidInvoiceCount: unpaidInvoices.length,
      draftsCount: draftsAndPending.length,
      activeWaybillsCount: activeWaybills.length,
      totalWaybillsCount: waybills.length,
      totalCollected,
      paymentCount: activePayments.length,
    };
  }, [allDocuments, allPayments]);

  const ownerFullName =
    user?.fullName && user.fullName.trim().length > 0
      ? user.fullName
      : 'Akindeji Akinlade';

  return (
    <div className="space-y-7 md:space-y-8 max-w-full overflow-hidden">
      {/* 1. Personalized Owner Greeting Header (Monochrome HorizonX Glassmorphism) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#0B132B] via-[#0F172A] to-[#1E293B] text-white border border-white/10 shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, Akindeji Akinlade
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white backdrop-blur-md border border-white/15">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              AOA 77 Supports &bull; Managing Director
            </span>
          </div>
          <p className="text-sm md:text-base text-slate-300 mt-1.5">
            Official business documents, dispatch waybills, and account balances for{' '}
            <strong className="text-white">{user?.companyName || 'AOA 77 Supports'}</strong>
          </p>
        </div>
      </div>

      {/* 2. One-Click Quick Actions Bar (Sleek Dark Glassmorphic Action Buttons with Safety Orange Accents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => navigate('/documents/invoices/new')}
          className="group flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-800/90 text-white shadow-sm transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-5 h-5 text-orange-500 stroke-[2.5] group-hover:scale-110 transition-transform shrink-0" />
          <span className="text-sm md:text-base font-bold text-white tracking-tight">Create New Invoice</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/documents/waybills/new')}
          className="group flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-800/90 text-white shadow-sm transition-all duration-200 cursor-pointer"
        >
          <Truck className="w-5 h-5 text-orange-500 stroke-[2.2] group-hover:scale-110 transition-transform shrink-0" />
          <span className="text-sm md:text-base font-bold text-white tracking-tight">Generate Waybill</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/payments')}
          className="group flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-800/90 text-white shadow-sm transition-all duration-200 cursor-pointer"
        >
          <CreditCard className="w-5 h-5 text-orange-500 stroke-[2.2] group-hover:scale-110 transition-transform shrink-0" />
          <span className="text-sm md:text-base font-bold text-white tracking-tight">Record Payment</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/documents/letters/new')}
          className="group flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-orange-500/50 hover:bg-neutral-800/90 text-white shadow-sm transition-all duration-200 cursor-pointer"
        >
          <Mail className="w-5 h-5 text-orange-500 stroke-[2.2] group-hover:scale-110 transition-transform shrink-0" />
          <span className="text-sm md:text-base font-bold text-white tracking-tight">Write Official Letter</span>
        </button>
      </div>

      {/* 3. Live Database Summary Cards (Strict Real Totals — Starts at ₦0.00 & 0 Documents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: Unpaid Invoices */}
        <div
          onClick={() => navigate('/documents/invoices')}
          className="bg-[#F8F9FC] dark:bg-[#1E2029] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Unpaid Invoice Balance
              </span>
              <span className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(kpiStats.outstandingBalance, 'NGN')}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold mt-1">
              {kpiStats.unpaidInvoiceCount} unpaid invoice(s)
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>View all client invoices</span>
            <span className="font-bold text-rose-700 dark:text-rose-400 group-hover:underline">
              Open Invoices &rarr;
            </span>
          </div>
        </div>

        {/* Card 2: Drafts & Pending Documents */}
        <div
          onClick={() => navigate('/documents/invoices?filter=draft')}
          className="bg-[#F8F9FC] dark:bg-[#1E2029] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-orange-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Drafts & Pending Sign-Off
              </span>
              <span className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500">
                <Clock className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {kpiStats.draftsCount} {kpiStats.draftsCount === 1 ? 'Document' : 'Documents'}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold mt-1">
              Ready to review and issue
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>Total documents: {allDocuments.length}</span>
            <span className="font-bold text-orange-500 group-hover:underline">
              Review Drafts &rarr;
            </span>
          </div>
        </div>

        {/* Card 3: Waybills & Dispatch */}
        <div
          onClick={() => navigate('/documents/waybills')}
          className="bg-[#F8F9FC] dark:bg-[#1E2029] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Waybills & Dispatch
              </span>
              <span className="p-2.5 rounded-2xl bg-sky-50 text-sky-600">
                <Truck className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {kpiStats.activeWaybillsCount} Active
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold mt-1">
              {kpiStats.totalWaybillsCount} total waybill(s) created
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>Track deliveries & drivers</span>
            <span className="font-bold text-sky-700 dark:text-sky-400 group-hover:underline">
              Open Waybills &rarr;
            </span>
          </div>
        </div>

        {/* Card 4: Account Balance & History (Payments Received) */}
        <div
          onClick={() => navigate('/payments')}
          className="bg-[#F8F9FC] dark:bg-[#1E2029] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Account Balance & History
              </span>
              <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(kpiStats.totalCollected, 'NGN')}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold mt-1">
              {kpiStats.paymentCount} recorded payment receipt(s)
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>Payments & receipts history</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">
              View History &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* 4. Main Dashboard Split: Recent Documents & Plain-English Business Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Pane (7 cols): Recent Documents */}
        <div className="lg:col-span-7 bg-[#F8F9FC] dark:bg-[#1E2029] rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Recent Business Documents
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your latest invoices, waybills, and official letters
              </p>
            </div>
            <button
              onClick={() => navigate('/documents/invoices')}
              className="text-sm font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-white/70 animate-pulse rounded-2xl border border-slate-200/60"
                />
              ))}
            </div>
          ) : recentDocuments.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white dark:bg-[#16181F] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
              <FileCheck2 className="w-12 h-12 text-orange-500 mx-auto mb-3" />
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                No documents created yet. Click below to create your first client invoice.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Your numbering counter is set to start cleanly at <strong>0001</strong> with{' '}
                <strong>Akindeji Akinlade</strong> pre-filled as Authorized Signatory.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/documents/invoices/new')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-extrabold shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/clients')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  <span>+ Add Client / Customer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDocuments.map((doc: any) => {
                const isInvoice = doc.documentType === 'INVOICE';
                const isWaybill = doc.documentType === 'WAYBILL';

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (isInvoice) navigate('/documents/invoices');
                      else if (isWaybill) navigate('/documents/waybills');
                      else navigate('/documents/letters');
                    }}
                    className="group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#16181F] hover:bg-slate-50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        {isInvoice && <FileText className="w-5 h-5" />}
                        {isWaybill && <Truck className="w-5 h-5" />}
                        {!isInvoice && !isWaybill && <Mail className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                            {doc.documentNumber}
                          </span>
                          <span
                            className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                              doc.status === 'ISSUED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.status === 'APPROVED'
                                  ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                          {doc.client?.companyName || doc.client?.name || doc.title} &bull;{' '}
                          {formatRelativeTime(doc.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      {isInvoice && (
                        <div>
                          <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(doc.totalAmount, doc.currency)}
                          </div>
                          <div className="text-xs font-semibold text-slate-500">
                            Bal: {formatCurrency(doc.balanceDue, doc.currency)}
                          </div>
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane (5 cols): Plain-English Business Settings & Signatory Summary */}
        <div className="lg:col-span-5 bg-[#0B132B] text-white rounded-3xl p-7 shadow-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-extrabold tracking-tight">
                  Company & Signatory Profile
                </h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Production Ready
              </span>
            </div>

            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Authorized Signatory / Issued By
                  </span>
                  <span className="text-base font-extrabold text-white">
                    Akindeji Akinlade (Managing Director)
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Auto-Filled
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Primary Currency & Exchange Rate
                  </span>
                  <span className="text-base font-bold text-white tabular-nums">
                    NGN (₦) + USD, GBP, EUR, JPY
                  </span>
                </div>
                <button
                  onClick={() => navigate('/settings/company')}
                  className="text-xs font-bold text-orange-400 hover:underline cursor-pointer"
                >
                  Settings
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Convert Invoice to Waybill
                  </span>
                  <span className="text-sm font-medium text-slate-300">
                    1-click conversion between invoices and delivery waybills
                  </span>
                </div>
                <ArrowLeftRight className="w-5 h-5 text-orange-400 shrink-0" />
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800 grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/settings/company')}
              className="py-3 px-4 rounded-xl bg-orange-500 text-white text-sm font-extrabold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Company Settings</span>
            </button>
            <button
              onClick={() => navigate('/settings/templates')}
              className="py-3 px-4 rounded-xl bg-[#0F172A] text-white text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              <span>PDF Styles</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
