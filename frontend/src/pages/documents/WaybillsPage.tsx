import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { DocumentRecord } from '../../types';
import { DEMO_WAYBILLS } from '../../lib/mock-data';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { PillFilterBar, FilterState } from '../../components/common/PillFilterBar';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { WaybillInspector } from '../../components/workspace/inspectors/WaybillInspector';
import {
  LifecycleActionModal,
  LifecycleActionType,
} from '../../components/workspace/LifecycleActionModal';
import {
  WaybillStateModal,
  WaybillModalAction,
} from '../../components/workspace/WaybillStateModal';
import { VersionAndAuditDrawer } from '../../components/workspace/VersionAndAuditDrawer';
import {
  ArrowLeft,
  Plus,
  Truck,
  Clock,
  TrendingUp,
  CheckCircle2,
  PackageCheck,
  AlertOctagon,
} from 'lucide-react';

export const WaybillsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    clientId: '',
    startDate: '',
    endDate: '',
  });

  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);

  const [activeActionModal, setActiveActionModal] = useState<LifecycleActionType | null>(null);
  const [activeStateModal, setActiveStateModal] = useState<WaybillModalAction | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Query waybills from backend
  const { data: waybillsData, isLoading } = useQuery({
    queryKey: ['waybills', filters],
    queryFn: async () => {
      const res = await apiClient.get('/documents', {
        params: {
          documentType: 'WAYBILL',
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

  const allWaybills: DocumentRecord[] =
    waybillsData?.items && waybillsData.items.length > 0
      ? waybillsData.items
      : waybillsData?.data && waybillsData.data.length > 0
      ? waybillsData.data
      : DEMO_WAYBILLS;

  // Tab filtering based on deliveryStatus or document status
  const filteredWaybills = useMemo(() => {
    return allWaybills.filter((wb) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'IN_TRANSIT') return wb.waybill?.deliveryStatus === 'IN_TRANSIT';
      if (activeTab === 'READY') return wb.waybill?.deliveryStatus === 'READY_FOR_DISPATCH';
      if (activeTab === 'DELIVERED') return wb.waybill?.deliveryStatus === 'DELIVERED';
      if (activeTab === 'FAILED') return wb.waybill?.deliveryStatus === 'DELIVERY_FAILED';
      return wb.status === activeTab;
    });
  }, [allWaybills, activeTab]);

  useEffect(() => {
    if (filteredWaybills.length > 0) {
      if (!selectedDocument || !filteredWaybills.some((d) => d.id === selectedDocument.id)) {
        setSelectedDocument(filteredWaybills[0]);
      }
    } else {
      setSelectedDocument(null);
    }
  }, [filteredWaybills, selectedDocument]);

  // Derived KPIs
  const inTransitCount = useMemo(() => {
    return allWaybills.filter((wb) => wb.waybill?.deliveryStatus === 'IN_TRANSIT').length;
  }, [allWaybills]);

  const pendingApprovalsCount = useMemo(() => {
    return allWaybills.filter((wb) => wb.status === 'PENDING_APPROVAL').length;
  }, [allWaybills]);

  const readyForPickupCount = useMemo(() => {
    return allWaybills.filter((wb) => wb.waybill?.deliveryStatus === 'READY_FOR_DISPATCH').length;
  }, [allWaybills]);

  const deliveredCount = useMemo(() => {
    return allWaybills.filter((wb) => wb.waybill?.deliveryStatus === 'DELIVERED').length;
  }, [allWaybills]);

  // Tabs for the recessed notch
  const tabItems = [
    { key: 'ALL', label: 'All Waybills', count: allWaybills.length },
    {
      key: 'READY',
      label: 'Ready for Pickup',
      count: readyForPickupCount,
    },
    {
      key: 'IN_TRANSIT',
      label: 'In Transit',
      count: inTransitCount,
    },
    {
      key: 'DELIVERED',
      label: 'Delivered',
      count: deliveredCount,
    },
    {
      key: 'DRAFT',
      label: 'Drafts',
      count: allWaybills.filter((d) => d.status === 'DRAFT').length,
    },
  ];

  // Document Lifecycle Mutations
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
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      setActiveActionModal(null);
      if (variables.action === 'DUPLICATE' && response?.data) {
        setSelectedDocument(response.data);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Action failed.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Waybill State Machine Transitions Mutation
  const stateTransitionMutation = useMutation({
    mutationFn: async ({
      action,
      payload,
    }: {
      action: WaybillModalAction;
      payload: any;
    }) => {
      if (!selectedDocument || !selectedDocument.waybill) return;
      const waybillId = selectedDocument.waybill.id;

      switch (action) {
        case 'READY':
          return apiClient.post(`/waybills/${waybillId}/ready`, payload);
        case 'DISPATCH':
          return apiClient.post(`/waybills/${waybillId}/dispatch`, payload);
        case 'COMPLETE':
          return apiClient.post(`/waybills/${waybillId}/complete`, payload);
        case 'FAIL':
          return apiClient.post(`/waybills/${waybillId}/fail`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      setActiveStateModal(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Transition failed.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  return (
    <div className="space-y-6">
      {/* 1. Context Header & Primary CTA */}
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
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Waybills & Delivery Notes
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
                Logistics Dispatch
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consignment manifests, carrier dispatch tracking, and proof-of-delivery receipts
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/documents/waybills/new')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create waybill</span>
        </button>
      </div>

      {/* 2. 4-Column Bento KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <BentoKpiCard
          title="In Transit"
          value={`${inTransitCount} Shipments`}
          subtitle="Consignments en route to consignees"
          icon={Truck}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          trendText="Vehicles tracked on dispatch"
          trendType="neutral"
          footerLabel="Real-time driver manifests"
          footerAction="Filter In Transit"
          onFooterClick={() => setActiveTab('IN_TRANSIT')}
        />

        <BentoKpiCard
          title="Staged in Warehouse"
          value={`${readyForPickupCount} Orders`}
          subtitle="Packaged and staged for loading"
          icon={PackageCheck}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
          footerLabel="Staging Bay verified"
          footerAction="View Staged"
          onFooterClick={() => setActiveTab('READY')}
        />

        <BentoKpiCard
          title="Delivery Speed"
          value="24 hours"
          subtitle="Average dispatch to receipt"
          icon={TrendingUp}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
          trendText="98.2% on-time delivery rate"
          trendType="up"
          footerLabel="Direct haulage routes"
        >
          <div className="my-1">
            <svg className="w-full h-6 stroke-[#5847F6] fill-none" viewBox="0 0 100 25">
              <path d="M0 18 Q 30 2, 60 12 T 100 4" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </BentoKpiCard>

        <BentoKpiCard
          title="Confirmed Delivered"
          value={`${deliveredCount} Completed`}
          subtitle="Full delivery receipts archived"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          footerLabel="Receiver signatures captured"
          footerAction="Delivered Archive"
          onFooterClick={() => setActiveTab('DELIVERED')}
        />
      </div>

      {/* 3. Horizontal Pill Filter Bar */}
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

      {/* 4. Dark Obsidian Master-Detail Split Workspace */}
      <ObsidianMasterDetailShell
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        documents={filteredWaybills}
        selectedDocument={selectedDocument}
        onSelectDocument={setSelectedDocument}
        isLoading={isLoading}
        documentType="WAYBILL"
        emptyFeedMessage="No waybills found matching current filter tabs."
        inspector={
          selectedDocument && (
            <WaybillInspector
              document={selectedDocument}
              onActionClick={(action) => setActiveActionModal(action)}
              onOpenHistory={() => setIsHistoryDrawerOpen(true)}
              onWaybillStateTransition={(action) => setActiveStateModal(action)}
              onEditDraft={(id) => navigate(`/documents/waybills/${id}/edit`)}
            />
          )
        }
      />

      {/* Document Lifecycle Modal (Submit / Approve / Reject / Issue / Duplicate / Cancel) */}
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

      {/* Waybill Logistics State Machine Modal (Ready / Dispatch / Complete / Fail) */}
      {activeStateModal && selectedDocument && (
        <WaybillStateModal
          isOpen={!!activeStateModal}
          onClose={() => setActiveStateModal(null)}
          action={activeStateModal}
          waybillNumber={selectedDocument.documentNumber}
          isLoading={stateTransitionMutation.isPending}
          onConfirm={async (payload) => {
            await stateTransitionMutation.mutateAsync({
              action: activeStateModal,
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
