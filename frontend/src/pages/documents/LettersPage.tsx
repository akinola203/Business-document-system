import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { DocumentRecord } from '../../types';
import { DEMO_LETTERS } from '../../lib/mock-data';
import { formatCurrency, extractArray } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { PillFilterBar, FilterState } from '../../components/common/PillFilterBar';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { LetterInspector } from '../../components/workspace/inspectors/LetterInspector';
import {
  LifecycleActionModal,
  LifecycleActionType,
} from '../../components/workspace/LifecycleActionModal';
import { VersionAndAuditDrawer } from '../../components/workspace/VersionAndAuditDrawer';
import {
  ArrowLeft,
  Plus,
  Mail,
  Clock,
  TrendingUp,
  FileCheck,
  Palette,
} from 'lucide-react';

export const LettersPage: React.FC = () => {
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
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Query letters from backend
  const { data: lettersData, isLoading } = useQuery({
    queryKey: ['letters', filters],
    queryFn: async () => {
      const res = await apiClient.get('/documents', {
        params: {
          documentType: 'LETTER',
          search: filters.search || undefined,
          status: filters.status || undefined,
          page: 1,
          limit: 100,
        },
      });
      return res.data;
    },
  });

  const allLetters: DocumentRecord[] = useMemo(() => {
    return extractArray<DocumentRecord>(lettersData, DEMO_LETTERS);
  }, [lettersData]);

  const filteredLetters = useMemo(() => {
    return allLetters.filter((letDoc) => {
      if (activeTab === 'ALL') return true;
      return letDoc.status === activeTab;
    });
  }, [allLetters, activeTab]);

  useEffect(() => {
    if (filteredLetters.length > 0) {
      if (!selectedDocument || !filteredLetters.some((d) => d.id === selectedDocument.id)) {
        setSelectedDocument(filteredLetters[0]);
      }
    } else {
      setSelectedDocument(null);
    }
  }, [filteredLetters, selectedDocument]);

  // Fetch full document details (guaranteeing fresh letter text, signatory, approvals)
  const { data: docDetailData } = useQuery({
    queryKey: ['document-detail', selectedDocument?.id],
    queryFn: async () => {
      if (!selectedDocument?.id) return null;
      const res = await apiClient.get(`/documents/${selectedDocument.id}`);
      return res.data?.data || res.data;
    },
    enabled: Boolean(selectedDocument?.id),
    staleTime: 5000,
  });

  const activeDocument: DocumentRecord | null = useMemo(() => {
    if (docDetailData && docDetailData.id === selectedDocument?.id) {
      return docDetailData;
    }
    return selectedDocument;
  }, [docDetailData, selectedDocument]);

  // Derived KPIs
  const issuedCount = useMemo(() => {
    return allLetters.filter((l) => l.status === 'ISSUED').length;
  }, [allLetters]);

  const pendingCount = useMemo(() => {
    return allLetters.filter((l) => l.status === 'PENDING_APPROVAL').length;
  }, [allLetters]);

  const draftsCount = useMemo(() => {
    return allLetters.filter((l) => l.status === 'DRAFT').length;
  }, [allLetters]);

  const tabItems = [
    { key: 'ALL', label: 'All Correspondence', count: allLetters.length },
    { key: 'DRAFT', label: 'Drafts', count: draftsCount },
    { key: 'PENDING_APPROVAL', label: 'Pending Approval', count: pendingCount },
    { key: 'APPROVED', label: 'Approved', count: allLetters.filter((d) => d.status === 'APPROVED').length },
    { key: 'ISSUED', label: 'Issued Official', count: issuedCount },
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
      queryClient.invalidateQueries({ queryKey: ['letters'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      setActiveActionModal(null);
      if (variables.action === 'DUPLICATE' && response?.data) {
        setSelectedDocument(response.data);
      }
    },
    onError: (err: any) => {
      console.warn('Letter lifecycle action failed:', err?.response?.data?.message || err?.message);
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
                Business Letters
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
                Executive Correspondence
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official corporate notices, proposals, reference numbers, and executive signatory blocks
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/documents/letters/new')}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Draft letter</span>
        </button>
      </div>

      {/* 2. 4-Column Bento KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <BentoKpiCard
          title="Issued Letters"
          value={`${issuedCount} Official`}
          subtitle="Signed and dispatched correspondence"
          icon={FileCheck}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          footerLabel="Official letterhead applied"
          footerAction="View Issued"
          onFooterClick={() => setActiveTab('ISSUED')}
        />

        <BentoKpiCard
          title="Pending Approval"
          value={`${pendingCount} Letters`}
          subtitle="Awaiting executive sign-off"
          icon={Clock}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
          footerLabel="Director approval workflow"
          footerAction="Review"
          onFooterClick={() => setActiveTab('PENDING_APPROVAL')}
        >
          <div className="flex items-end gap-1.5 h-8 mt-2">
            <div className="w-2.5 bg-indigo-200 rounded-t h-4" />
            <div className="w-2.5 bg-indigo-300 rounded-t h-3" />
            <div className="w-2.5 bg-indigo-400 rounded-t h-6" />
            <div className="w-2.5 bg-indigo-500 rounded-t h-5" />
            <div className="w-2.5 bg-[#5847F6] rounded-t h-8" />
          </div>
        </BentoKpiCard>

        <BentoKpiCard
          title="Avg Sign-Off Speed"
          value="4 hours"
          subtitle="Review and issuance turnaround"
          icon={TrendingUp}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
          trendText="Faster digital approval"
          trendType="up"
          footerLabel="Same-day dispatch target"
        >
          <div className="my-1">
            <svg className="w-full h-6 stroke-[#5847F6] fill-none" viewBox="0 0 100 25">
              <path d="M0 16 Q 35 2, 70 10 T 100 4" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </BentoKpiCard>

        <BentoKpiCard
          title="Brand Templates"
          value="Corporate Executive"
          subtitle="Standard letterhead layout"
          icon={Palette}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          footerLabel="AOA 77 Registered Letterhead"
          footerAction="Templates"
          onFooterClick={() => navigate('/settings/templates')}
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
        showClientFilter={false}
      />

      {/* 4. Dark Obsidian Master-Detail Split Workspace */}
      <ObsidianMasterDetailShell
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        documents={filteredLetters}
        selectedDocument={activeDocument}
        onSelectDocument={setSelectedDocument}
        isLoading={isLoading}
        documentType="LETTER"
        emptyFeedMessage="No business letters found matching current filter tabs."
        inspector={
          activeDocument && (
            <LetterInspector
              document={activeDocument}
              onActionClick={(action) => setActiveActionModal(action)}
              onOpenHistory={() => setIsHistoryDrawerOpen(true)}
              onEditDraft={(id) => navigate(`/documents/letters/${id}/edit`)}
            />
          )
        }
      />

      {/* Lifecycle Action Modal */}
      {activeActionModal && activeDocument && (
        <LifecycleActionModal
          isOpen={!!activeActionModal}
          onClose={() => setActiveActionModal(null)}
          actionType={activeActionModal}
          documentNumber={activeDocument.documentNumber}
          documentTitle={activeDocument.title}
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
      {activeDocument && (
        <VersionAndAuditDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          documentId={activeDocument.id}
          documentNumber={activeDocument.documentNumber}
        />
      )}
    </div>
  );
};
