import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import { X, History, ShieldCheck, FileText, ChevronRight, Eye, Calendar, User } from 'lucide-react';

interface VersionAndAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentNumber: string;
}

export const VersionAndAuditDrawer: React.FC<VersionAndAuditDrawerProps> = ({
  isOpen,
  onClose,
  documentId,
  documentNumber,
}) => {
  const [activeTab, setActiveTab] = useState<'versions' | 'audit'>('versions');
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);

  // Fetch version snapshots
  const { data: versions = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: async () => {
      const res = await apiClient.get(`/documents/${documentId}/versions`);
      return res.data;
    },
    enabled: isOpen && !!documentId,
  });

  // Fetch audit trail
  const { data: auditLogs = [], isLoading: isLoadingAudit } = useQuery({
    queryKey: ['document-audit', documentId],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/audit-logs/entity/Document/${documentId}`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: isOpen && activeTab === 'audit' && !!documentId,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#F8F9FC]">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#5847F6]" />
                <h3 className="text-base font-extrabold text-slate-900">Document History</h3>
              </div>
              <p className="text-xs font-mono font-bold text-slate-500 tabular-nums mt-0.5">
                {documentNumber}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 transition-colors shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="p-4 border-b border-slate-100 flex gap-2">
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'versions'
                  ? 'bg-[#5847F6] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Versions ({versions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'audit'
                  ? 'bg-[#5847F6] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit Trail</span>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeTab === 'versions' && (
              <>
                {isLoadingVersions ? (
                  <div className="space-y-3 py-6">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
                    ))}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No version snapshots yet.</p>
                    <p className="text-[11px] mt-1">Official snapshots are locked upon issuance.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v: any) => (
                      <div
                        key={v.id}
                        className="p-4 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 hover:border-slate-300 transition-all text-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-900 px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
                            Version {v.versionNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatRelativeTime(v.createdAt)}
                          </span>
                        </div>

                        {v.changeReason && (
                          <p className="text-slate-600 my-1 font-medium">{v.changeReason}</p>
                        )}

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                          <span>{formatDate(v.createdAt)}</span>
                          <button
                            onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                            className="text-[#5847F6] font-bold hover:underline flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{selectedVersion?.id === v.id ? 'Hide' : 'Inspect Snapshot'}</span>
                          </button>
                        </div>

                        {selectedVersion?.id === v.id && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800">
                            <pre>{JSON.stringify(v.snapshotData, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'audit' && (
              <>
                {isLoadingAudit ? (
                  <div className="space-y-3 py-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl" />
                    ))}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">No audit events recorded yet.</p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="relative text-xs">
                        <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-[#5847F6] ring-4 ring-white" />
                        <div className="p-3 rounded-2xl bg-[#F8F9FC] border border-slate-200/70">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            By: <strong>{log.actor?.fullName || log.actorId}</strong>
                          </div>
                          {log.newValues && (
                            <div className="mt-2 text-[10px] text-slate-500 font-mono bg-white p-2 rounded-lg border border-slate-200/60 overflow-x-auto">
                              {JSON.stringify(log.newValues)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
