import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { PaymentRecord, DocumentRecord } from '../../types';
import { DEMO_PAYMENTS, DEMO_INVOICES } from '../../lib/mock-data';
import { formatCurrency } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { PaymentInspector } from '../../components/workspace/inspectors/PaymentInspector';
import { RecordPaymentModal } from '../../components/payments/RecordPaymentModal';
import {
  CreditCard,
  Plus,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Filter,
  Receipt,
  FileSpreadsheet,
  Building,
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // 1. Fetch Payments from Backend with Mock Fallback
  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery<{ items?: PaymentRecord[]; data?: PaymentRecord[] }>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await apiClient.get('/payments', { params: { limit: 100 } });
      return res.data;
    },
  });

  const allPayments: PaymentRecord[] =
    paymentsData?.items && paymentsData.items.length > 0
      ? paymentsData.items
      : paymentsData?.data && paymentsData.data.length > 0
      ? paymentsData.data
      : DEMO_PAYMENTS;

  // 2. Fetch Invoices for Payment Recording Dropdown
  const { data: invoicesData } = useQuery<{ items?: DocumentRecord[]; data?: DocumentRecord[] }>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/documents', { params: { documentType: 'INVOICE', limit: 100 } });
      return res.data;
    },
  });

  const allInvoices: DocumentRecord[] =
    invoicesData?.items && invoicesData.items.length > 0
      ? invoicesData.items
      : invoicesData?.data && invoicesData.data.length > 0
      ? invoicesData.data
      : DEMO_INVOICES;

  // 3. Filter Payments
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      // Tab filter
      if (activeTab === 'REVERSED') {
        if (!p.isReversed) return false;
      } else if (activeTab !== 'ALL') {
        if (p.isReversed || p.method !== activeTab) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = p.referenceNumber?.toLowerCase().includes(q);
        const matchesNum = p.paymentNumber?.toLowerCase().includes(q);
        const matchesClient = p.invoice?.document?.client?.name?.toLowerCase().includes(q);
        const matchesAmount = p.amount?.toString().includes(q);
        return matchesRef || matchesNum || matchesClient || matchesAmount;
      }

      return true;
    });
  }, [allPayments, activeTab, searchQuery]);

  // Set default selected payment
  React.useEffect(() => {
    if (filteredPayments.length > 0) {
      if (!selectedPayment || !filteredPayments.some((p) => p.id === selectedPayment.id)) {
        setSelectedPayment(filteredPayments[0]);
      }
    } else {
      setSelectedPayment(null);
    }
  }, [filteredPayments, selectedPayment]);

  // 4. Calculate KPI Metrics
  const activePayments = allPayments.filter((p) => !p.isReversed);
  const reversedPayments = allPayments.filter((p) => p.isReversed);

  const totalCollected = activePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalReversedAmount = reversedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalReceivables = allInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TIER 1: CONTEXT HEADER & PRIMARY ACTION
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              Settlements & Treasury
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Phase 8D Active</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Payments Ledger & Settlements
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Multi-currency deposits, automated balance deductions, partial receipts, and audited reversals
          </p>
        </div>

        <button
          onClick={() => setIsRecordModalOpen(true)}
          className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* =========================================================================
          TIER 2: 4 BENTO KPI CARDS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoKpiCard
          title="Total Collected"
          value={formatCurrency(totalCollected, 'NGN')}
          subtitle={`${activePayments.length} verified settlements`}
          icon={ArrowDownLeft}
          trendText="18.4% this month"
          trendType="up"
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
        />

        <BentoKpiCard
          title="Active Transactions"
          value={activePayments.length}
          subtitle="Audited ledger entries"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <BentoKpiCard
          title="Outstanding Invoices"
          value={formatCurrency(totalReceivables, 'NGN')}
          subtitle="Pending customer receivables"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />

        <BentoKpiCard
          title="Reversals / Voided"
          value={formatCurrency(totalReversedAmount, 'NGN')}
          subtitle={`${reversedPayments.length} voided payments`}
          icon={RotateCcw}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* =========================================================================
          TIER 3: PILL FILTER BAR & SEARCH
      ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Method Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Payments', count: allPayments.length },
            { id: 'BANK_TRANSFER', label: 'Bank Transfer', count: allPayments.filter((p) => p.method === 'BANK_TRANSFER' && !p.isReversed).length },
            { id: 'POS', label: 'POS Terminal', count: allPayments.filter((p) => p.method === 'POS' && !p.isReversed).length },
            { id: 'CHEQUE', label: 'Cheque', count: allPayments.filter((p) => p.method === 'CHEQUE' && !p.isReversed).length },
            { id: 'REVERSED', label: 'Reversed', count: reversedPayments.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[#16181F] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref #, client, amount..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
          />
        </div>
      </div>

      {/* =========================================================================
          TIER 4: DEEP OBSIDIAN MASTER-DETAIL SPLIT VIEW (40% / 60%)
      ========================================================================= */}
      <ObsidianMasterDetailShell
        leftPane={
          <div className="space-y-3">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No payment records found</p>
                <p className="text-[11px] text-slate-500 mt-1">Try adjusting your filters or record a new settlement.</p>
              </div>
            ) : (
              filteredPayments.map((p) => {
                const isSelected = selectedPayment?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPayment(p)}
                    className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#1D2029] border-[#5847F6] shadow-lg shadow-indigo-950/30'
                        : 'bg-[#191B22] hover:bg-[#1D2029] border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        {p.paymentNumber}
                      </span>
                      {p.isReversed ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                          REVERSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          SETTLED
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-black text-white tabular-nums tracking-tight">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {p.method.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[140px]">
                        {p.invoice?.document?.client?.name || 'Client Settlement'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {p.paymentDate}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        }
        rightPane={
          <PaymentInspector
            payment={selectedPayment}
            onPaymentReversed={() => {
              if (selectedPayment) {
                selectedPayment.isReversed = true;
                setSelectedPayment({ ...selectedPayment });
              }
            }}
          />
        }
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        invoices={allInvoices}
        onPaymentSuccess={(newPay) => {
          setSelectedPayment(newPay);
        }}
      />
    </div>
  );
};
