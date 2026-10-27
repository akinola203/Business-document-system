import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { DocumentRecord } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { PillFilterBar, FilterState } from '../../components/common/PillFilterBar';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { InvoiceInspector } from '../../components/workspace/inspectors/InvoiceInspector';
import {
  LifecycleActionModal,
  LifecycleActionType,
} from '../../components/workspace/LifecycleActionModal';
import { VersionAndAuditDrawer } from '../../components/workspace/VersionAndAuditDrawer';
import {
  ArrowLeft,
  Plus,
  AlertCircle,
  Clock,
  TrendingUp,
  CheckCircle2,
  FileText,
} from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    clientId: '',
    startDate: '',
    endDate: '',
  });

  // Top tab notch state ('ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED' | 'OVERDUE')
  const [activeTab, setActiveTab] = useState('ALL');

  // Currently selected document for the right-hand inspector
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);

  // Modals state
  const [activeActionModal, setActiveActionModal] = useState<LifecycleActionType | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Query invoices from backend
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      const res = await apiClient.get('/documents', {
        params: {
          documentType: 'INVOICE',
          search: filters.search || undefined,
          status: filters.status || undefined,
          clientId: filters.clientId || undefined,
          page: 1,
          limit: 100,
        },
      });
      return res.data;
    },
  });

  const allInvoices: DocumentRecord[] = invoicesData?.items || invoicesData?.data || [];

  // Tab filtering on client for instant responsiveness
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'OVERDUE') {
        return inv.isOverdue || inv.paymentStatus === 'UNPAID';
      }
      return inv.status === activeTab;
    });
  }, [allInvoices, activeTab]);

  // Auto-select first document on load or filter change
  useEffect(() => {
    if (filteredInvoices.length > 0) {
      if (!selectedDocument || !filteredInvoices.some((d) => d.id === selectedDocument.id)) {
        setSelectedDocument(filteredInvoices[0]);
      }
    } else {
      setSelectedDocument(null);
    }
  }, [filteredInvoices, selectedDocument]);

  // Derived KPI metrics
  const overdueTotal = useMemo(() => {
    return allInvoices
      .filter((inv) => inv.status === 'ISSUED' && Number(inv.balanceDue) > 0)
      .reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0);
  }, [allInvoices]);

  const pendingCount = useMemo(() => {
    return allInvoices.filter((inv) => inv.status === 'PENDING_APPROVAL').length;
  }, [allInvoices]);

  const settledTotal = useMemo(() => {
    return allInvoices
      .filter((inv) => inv.status === 'ISSUED')
      .reduce((sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.balanceDue || 0)), 0);
  }, [allInvoices]);

  // Tab items with dynamic counts
  const tabItems = [
    { key: 'ALL', label: 'All Invoices', count: allInvoices.length },
    { key: 'DRAFT', label: 'Draft', count: allInvoices.filter((d) => d.status === 'DRAFT').length },
    {
      key: 'PENDING_APPROVAL',
      label: 'Pending Approval',
      count: allInvoices.filter((d) => d.status === 'PENDING_APPROVAL').length,
    },
    {
      key: 'APPROVED',
      label: 'Approved',
      count: allInvoices.filter((d) => d.status === 'APPROVED').length,
    },
    {
      key: 'ISSUED',
      label: 'Issued',
      count: allInvoices.filter((d) => d.status === 'ISSUED').length,
    },
  ];

  // Lifecycle Mutations
  const lifecycleMutation = useMutation({
    mutationFn: async ({
      action,
      payload,
    }: {
      action: LifecycleActionType;
      payload?: any;
    }) => {
      if (!selectedDocument) return;
      const id = selectedDocument.id;

      switch (action) {
        case 'SUBMIT':
          return apiClient.post(`/documents/${id}/submit`, payload || {});
        case 'APPROVE':
          return apiClient.post(`/documents/${id}/approve`, payload || {});
        case 'REJECT':
          return apiClient.post(`/documents/${id}/reject`, payload || {});
        case 'ISSUE':
          return apiClient.post(`/documents/${id}/issue`, payload || {});
        case 'CANCEL':
          return apiClient.post(`/documents/${id}/cancel`, payload || {});
        case 'DUPLICATE':
          return apiClient.post(`/documents/${id}/duplicate`);
      }
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      setActiveActionModal(null);

      // If duplicated, select the cloned draft
      if (variables.action === 'DUPLICATE' && response?.data) {
        setSelectedDocument(response.data);
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Action failed. Please verify conditions and permissions.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  return (
    <div className="space-y-6">
      {/* 1. Tier 1: Context Header & Primary CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/overview')}
            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Invoices</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
                Accounts Receivable
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Corporate billing, VAT calculations, manager approvals, and settlement balances
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/documents/invoices/new')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create an invoice</span>
        </button>
      </div>

      {/* 2. Tier 2: 4-Column Bento KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <BentoKpiCard
          title="Overdue / Outstanding"
          value={formatCurrency(overdueTotal)}
          subtitle="Open balance across issued invoices"
          icon={AlertCircle}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
          trendText="Action required on settlement"
          trendType="down"
          footerLabel="Automatic payment derivation"
          footerAction="Filter Unpaid"
          onFooterClick={() => setActiveTab('OVERDUE')}
        />

        <BentoKpiCard
          title="Pending Approval"
          value={`${pendingCount} Drafts`}
          subtitle="Invoices awaiting manager review"
          icon={Clock}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
          footerLabel="Anti-self-approval rule active"
          footerAction="Review Drafts"
          onFooterClick={() => setActiveTab('PENDING_APPROVAL')}
        >
          <div className="flex items-end gap-1.5 h-8 mt-2">
            <div className="w-2.5 bg-indigo-200 rounded-t h-3" />
            <div className="w-2.5 bg-indigo-300 rounded-t h-5" />
            <div className="w-2.5 bg-indigo-400 rounded-t h-4" />
            <div className="w-2.5 bg-indigo-500 rounded-t h-7" />
            <div className="w-2.5 bg-[#5847F6] rounded-t h-8" />
          </div>
        </BentoKpiCard>

        <BentoKpiCard
          title="Turnaround Time"
          value="16 days"
          subtitle="Average creation to settlement"
          icon={TrendingUp}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
          trendText="4.2 days faster than last month"
          trendType="up"
          footerLabel="Standard Net-30 credit policy"
        >
          <div className="my-1">
            <svg className="w-full h-6 stroke-[#5847F6] fill-none" viewBox="0 0 100 25">
              <path d="M0 20 Q 25 5, 50 14 T 100 6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </BentoKpiCard>

        <BentoKpiCard
          title="Settled Volume"
          value={formatCurrency(settledTotal)}
          subtitle="Collected payments this fiscal cycle"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          footerLabel="Reconciled against bank statements"
          footerAction="Payments Ledger"
          onFooterClick={() => navigate('/payments')}
        >
          <div className="flex items-center gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
              NGN
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
              USD
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
              GBP
            </span>
          </div>
        </BentoKpiCard>
      </div>

      {/* 3. Tier 3: Horizontal Pill Filter Bar */}
      <PillFilterBar
        filters={filters}
        onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
        onClear={() =>
          setFilters({
            search: '',
            status: '',
            clientId: '',
            startDate: '',
            endDate: '',
          })
        }
      />

      {/* 4. Tier 4: Dark Obsidian Master-Detail Split Workspace */}
      <ObsidianMasterDetailShell
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        documents={filteredInvoices}
        selectedDocument={selectedDocument}
        onSelectDocument={setSelectedDocument}
        isLoading={isLoading}
        documentType="INVOICE"
        emptyFeedMessage="No invoices found matching current filter tabs."
        inspector={
          selectedDocument && (
            <InvoiceInspector
              document={selectedDocument}
              onActionClick={(action) => setActiveActionModal(action)}
              onOpenHistory={() => setIsHistoryDrawerOpen(true)}
              onRecordPayment={() => navigate('/payments')}
              onEditDraft={(id) => navigate(`/documents/invoices/${id}/edit`)}
            />
          )
        }
      />

      {/* Lifecycle Action Modal */}
      {activeActionModal && selectedDocument && (
        <LifecycleActionModal
          isOpen={!!activeActionModal}
          onClose={() => setActiveActionModal(null)}
          actionType={activeActionModal}
          documentNumber={selectedDocument.documentNumber}
          documentTitle={selectedDocument.title}
          isLoading={lifecycleMutation.isPending}
          onConfirm={async (payload) => {
            await lifecycleMutation.mutateAsync({
              action: activeActionModal,
              payload,
            });
          }}
        />
      )}

      {/* Slide-over Version & Audit Drawer */}
      {selectedDocument && (
        <VersionAndAuditDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          documentId={selectedDocument.id}
          documentNumber={selectedDocument.documentNumber}
        />
      )}
    </div>
  );
};
