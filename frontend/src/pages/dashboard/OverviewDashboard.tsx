import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatCurrency, formatDate, formatRelativeTime } from '../../lib/utils';
import { DEMO_INVOICES } from '../../lib/mock-data';
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
  TrendingUp,
  FileCheck2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Fetch recent documents for the overview feed
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ['overview-recent-documents'],
    queryFn: async () => {
      const res = await apiClient.get('/documents', {
        params: { page: 1, limit: 6 },
      });
      return res.data;
    },
  });

  const documents =
    documentsData?.items && documentsData.items.length > 0
      ? documentsData.items
      : documentsData?.data && documentsData.data.length > 0
      ? documentsData.data
      : DEMO_INVOICES.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* 1. Header & Primary Quick Action Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Workspace
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Financial & logistics document operations for <strong>{user?.companyName}</strong>
          </p>
        </div>

        {/* Floating Quick Action Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/documents/invoices/new')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs md:text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>

          <button
            onClick={() => navigate('/documents/waybills/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F8F9FC] hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs md:text-sm font-semibold transition-all shadow-sm"
          >
            <Truck className="w-4 h-4 text-[#5847F6]" />
            <span>New Waybill</span>
          </button>

          <button
            onClick={() => navigate('/documents/letters/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F8F9FC] hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs md:text-sm font-semibold transition-all shadow-sm"
          >
            <Mail className="w-4 h-4 text-[#5847F6]" />
            <span>Draft Letter</span>
          </button>

          <button
            onClick={() => navigate('/payments')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#16181F] hover:bg-slate-900 text-white text-xs md:text-sm font-semibold transition-all shadow-md"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Column Bento KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Overdue & Action Required */}
        <div
          onClick={() => navigate('/documents/invoices?filter=overdue')}
          className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col justify-between hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Action Required
              </span>
              <span className="p-2 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
                <AlertCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {formatCurrency(1450000)}
            </div>
            <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              3 invoices past due date
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Requires settlement notice</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/documents/invoices?filter=overdue');
              }}
              className="font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 transition-colors cursor-pointer group-hover:underline"
            >
              <span>Follow up</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
          </div>
        </div>

        {/* KPI 2: Pending Approval with Mini-Chart */}
        <div
          onClick={() => navigate('/documents/invoices?filter=pending_approval')}
          className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pending Approval
              </span>
              <span className="p-2 rounded-2xl bg-indigo-50 text-[#5847F6] group-hover:scale-105 transition-transform">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-black text-slate-900 tabular-nums">5 Drafts</div>
                <p className="text-xs text-slate-500 mt-1">Awaiting manager sign-off</p>
              </div>

              {/* 6-Bar Vertical Indigo Gradient Mini-Chart */}
              <div className="flex items-end gap-1.5 h-10 pb-1">
                <div className="w-2 bg-indigo-200 rounded-t h-4" />
                <div className="w-2 bg-indigo-300 rounded-t h-6" />
                <div className="w-2 bg-indigo-400 rounded-t h-5" />
                <div className="w-2 bg-indigo-500 rounded-t h-8" />
                <div className="w-2 bg-[#5847F6] rounded-t h-10 shadow-sm" />
                <div className="w-2 bg-indigo-300 rounded-t h-7" />
              </div>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Oldest: 2 days in queue</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/documents/invoices?filter=pending_approval');
              }}
              className="font-bold text-[#5847F6] hover:text-[#4939E3] flex items-center gap-1 transition-colors cursor-pointer group-hover:underline"
            >
              <span>Review Queue</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
          </div>
        </div>

        {/* KPI 3: Logistics In-Transit Turnaround */}
        <div
          onClick={() => navigate('/documents/waybills?filter=in_transit')}
          className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col justify-between hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Logistics Dispatch
              </span>
              <span className="p-2 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                <Truck className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">8 Active</div>
            <p className="text-xs text-slate-500 mt-1">Consignments currently in transit</p>
          </div>

          {/* Smooth SVG Sparkline */}
          <div className="my-2">
            <svg className="w-full h-7 stroke-[#5847F6] fill-none" viewBox="0 0 100 25">
              <path
                d="M0 20 Q 25 5, 50 15 T 100 8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Avg delivery: 24h</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/documents/waybills?filter=in_transit');
              }}
              className="font-bold text-slate-700 hover:text-[#5847F6] flex items-center gap-1 transition-colors cursor-pointer group-hover:underline"
            >
              <span>Track All</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
          </div>
        </div>

        {/* KPI 4: Settled Volume & Multi-Currency */}
        <div
          onClick={() => navigate('/payments')}
          className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col justify-between hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Settled
              </span>
              <span className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {formatCurrency(8450000)}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                NGN 92%
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                USD $5,200
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                GBP £1,100
              </span>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>0 unallocated deposits</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/payments');
              }}
              className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors cursor-pointer group-hover:underline"
            >
              <span>Ledger</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Split: Recent Activity Feed & Deep Obsidian Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Pane (7 cols): Recent Document Activity */}
        <div className="lg:col-span-7 bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Recent Documents</h2>
              <p className="text-xs text-slate-500">Latest business documents issued across branches</p>
            </div>
            <button
              onClick={() => navigate('/documents/invoices')}
              className="text-xs font-bold text-[#5847F6] hover:text-[#4939E3] flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white/70 animate-pulse rounded-2xl border border-slate-200/60" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No documents issued yet</p>
              <p className="text-xs text-slate-400 mt-1">Get started by creating your first invoice or waybill.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc: any) => {
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
                    className="group flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/60 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#F8F9FC] border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-[#5847F6] group-hover:text-white transition-colors">
                        {isInvoice && <FileText className="w-5 h-5" />}
                        {isWaybill && <Truck className="w-5 h-5" />}
                        {!isInvoice && !isWaybill && <Mail className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 tabular-nums">
                            {doc.documentNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              doc.status === 'ISSUED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.status === 'APPROVED'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          {doc.client?.companyName || doc.client?.name || doc.title} &bull;{' '}
                          {formatRelativeTime(doc.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      {isInvoice && (
                        <div>
                          <div className="text-xs font-black text-slate-900 tabular-nums">
                            {formatCurrency(doc.totalAmount, doc.currency)}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">
                            Bal: {formatCurrency(doc.balanceDue, doc.currency)}
                          </div>
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane (5 cols): Deep Obsidian Control Capsule */}
        <div className="lg:col-span-5 bg-[#16181F] text-white rounded-3xl p-7 shadow-xl shadow-slate-950/20 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#5847F6]" />
                <h3 className="text-base font-extrabold tracking-tight">Finnova Engine</h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-slate-300 border border-white/10">
                v1.0 Ready
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Full enterprise document lifecycle with Optimistic Concurrency Control, frozen version snapshots,
              and headless Puppeteer A4 PDF compilation.
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#1E2029] border border-[#282B37] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Default Currency
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    NGN (Nigerian Naira ₦)
                  </span>
                </div>
                <button
                  onClick={() => navigate('/settings/company')}
                  className="text-xs font-bold text-[#5847F6] hover:underline"
                >
                  Edit
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#1E2029] border border-[#282B37] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Tax / VAT Rate
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">7.50% (Standard)</span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800">
            <button
              onClick={() => navigate('/settings/templates')}
              className="w-full py-3 px-5 rounded-full bg-white text-[#16181F] text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Explore Corporate PDF Templates</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
