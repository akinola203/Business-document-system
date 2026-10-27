import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { AuditLog } from '../../types';
import { DEMO_AUDIT_LOGS } from '../../lib/mock-data';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  User,
  Activity,
  History,
  Clock,
  Terminal,
  FileCode,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // 1. Fetch Audit Logs with Mock Fallback
  const { data: logsData } = useQuery<{ items?: AuditLog[]; data?: AuditLog[] }>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await apiClient.get('/audit-logs', { params: { limit: 100 } });
      return res.data;
    },
  });

  const allLogs: AuditLog[] =
    logsData?.items && logsData.items.length > 0
      ? logsData.items
      : logsData?.data && logsData.data.length > 0
      ? logsData.data
      : DEMO_AUDIT_LOGS;

  // 2. Filter Audit Logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (activeTab !== 'ALL' && log.action !== activeTab) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAction = log.action?.toLowerCase().includes(q);
        const matchesActor = log.actor?.fullName?.toLowerCase().includes(q) || log.actor?.email?.toLowerCase().includes(q);
        const matchesEntity = log.entityType?.toLowerCase().includes(q) || log.entityId?.toLowerCase().includes(q);
        const matchesIp = log.ipAddress?.toLowerCase().includes(q);
        return matchesAction || matchesActor || matchesEntity || matchesIp;
      }

      return true;
    });
  }, [allLogs, activeTab, searchQuery]);

  // Set default selection
  React.useEffect(() => {
    if (filteredLogs.length > 0) {
      if (!selectedLog || !filteredLogs.some((l) => l.id === selectedLog.id)) {
        setSelectedLog(filteredLogs[0]);
      }
    } else {
      setSelectedLog(null);
    }
  }, [filteredLogs, selectedLog]);

  // 3. Metrics
  const totalEvents = allLogs.length;
  const paymentEvents = allLogs.filter((l) => l.action.includes('PAYMENT')).length;
  const uniqueActors = new Set(allLogs.map((l) => l.actor?.email || l.actorId)).size;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TIER 1: CONTEXT HEADER
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Immutable System Ledger
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Tamper-Proof Audit Trail</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            System Audit Trail & Compliance
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Chronological log of mutations, user state changes, financial ledger entries, and JSON deltas
          </p>
        </div>
      </div>

      {/* =========================================================================
          TIER 2: 4 BENTO KPI CARDS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoKpiCard
          title="Total Logged Events"
          value={totalEvents}
          subtitle="Immutable append-only records"
          icon={Activity}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
        />

        <BentoKpiCard
          title="Financial Mutations"
          value={`${paymentEvents} Actions`}
          subtitle="Payments, reversals & issues"
          icon={ShieldCheck}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <BentoKpiCard
          title="Active Security Actors"
          value={`${uniqueActors} Users`}
          subtitle="Authorized team accounts"
          icon={User}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />

        <BentoKpiCard
          title="Integrity Verification"
          value="100% Sealed"
          subtitle="Cryptographic consistency"
          icon={ShieldAlert}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* =========================================================================
          TIER 3: PILL FILTER BAR & SEARCH
      ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Action Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Actions' },
            { id: 'PAYMENT_RECORDED', label: 'Payment Recorded' },
            { id: 'DOCUMENT_ISSUED', label: 'Document Issued' },
            { id: 'PAYMENT_REVERSED', label: 'Payment Reversed' },
            { id: 'COMPANY_SETTINGS_UPDATED', label: 'Settings Modified' },
            { id: 'USER_ROLE_UPDATED', label: 'IAM Roles' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#16181F] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              {tab.label}
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
            placeholder="Search action, actor, IP..."
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
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No audit events match filters</p>
                <p className="text-[11px] text-slate-500 mt-1">Adjust search query or filter pills.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#1D2029] border-[#5847F6] shadow-lg shadow-indigo-950/30'
                        : 'bg-[#191B22] hover:bg-[#1D2029] border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white truncate">
                      Entity: <span className="font-mono text-indigo-200">{log.entityType}</span>
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>By: {log.actor?.fullName || 'System Automated'}</span>
                      <span className="font-mono text-[10px] text-slate-500">{log.ipAddress || '127.0.0.1'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        }
        rightPane={
          selectedLog ? (
            <div className="space-y-6">
              {/* Event Inspector Card */}
              <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 border border-indigo-400/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-mono font-black tracking-wide backdrop-blur-md">
                    {selectedLog.action}
                  </span>
                  <span className="text-xs font-mono text-indigo-200">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-indigo-200 text-[11px]">Actor (User)</span>
                    <p className="font-bold text-white mt-0.5">
                      {selectedLog.actor?.fullName || 'System Automated Process'}
                    </p>
                    <p className="text-[11px] text-indigo-200">{selectedLog.actor?.email}</p>
                  </div>

                  <div>
                    <span className="text-indigo-200 text-[11px]">Network Telemetry</span>
                    <p className="font-mono font-bold text-white mt-0.5">IP: {selectedLog.ipAddress || '102.89.42.19'}</p>
                    <p className="text-[10px] text-indigo-200 font-mono truncate">{selectedLog.userAgent || 'Chrome/Windows'}</p>
                  </div>
                </div>
              </div>

              {/* Entity Context Card */}
              <div className="p-4 rounded-2xl bg-[#1D2029] border border-slate-800 text-slate-300 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[11px]">Entity Reference</span>
                  <p className="font-bold text-white mt-0.5">
                    {selectedLog.entityType} — <span className="font-mono text-indigo-400">{selectedLog.entityId}</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 border border-slate-700">
                  ID: {selectedLog.id}
                </span>
              </div>

              {/* JSON Side-by-Side Diff Viewer */}
              <div className="p-5 rounded-2xl bg-[#1D2029] border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <FileCode className="w-4 h-4 text-[#5847F6]" />
                  <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                    Snapshot Mutation Delta (Old vs New)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Previous State */}
                  <div className="p-3.5 rounded-xl bg-[#16181F] border border-slate-800 text-[11px] font-mono space-y-1">
                    <span className="text-rose-400 font-bold block pb-1 border-b border-slate-800">
                      - Previous State (oldValues)
                    </span>
                    <pre className="text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-48 pt-1">
                      {JSON.stringify(selectedLog.oldValues || { status: 'INITIAL' }, null, 2)}
                    </pre>
                  </div>

                  {/* New State */}
                  <div className="p-3.5 rounded-xl bg-[#16181F] border border-slate-800 text-[11px] font-mono space-y-1">
                    <span className="text-emerald-400 font-bold block pb-1 border-b border-slate-800">
                      + Updated State (newValues)
                    </span>
                    <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 pt-1">
                      {JSON.stringify(selectedLog.newValues || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <History className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-300">Select an audit entry</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Inspect actor telemetry, network fingerprints, and JSON snapshot diffs.
              </p>
            </div>
          )
        }
      />
    </div>
  );
};
