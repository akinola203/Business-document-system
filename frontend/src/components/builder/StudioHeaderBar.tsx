import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Send, Eye, Server, RefreshCw } from 'lucide-react';
import { DocumentType, DocumentStatus } from '../../types';

interface StudioHeaderBarProps {
  documentType: DocumentType;
  documentTitle: string;
  documentNumber?: string | null;
  isEdit: boolean;
  version?: number;
  status?: DocumentStatus;
  backPath: string;
  previewMode: 'LIVE' | 'SERVER';
  onTogglePreviewMode: (mode: 'LIVE' | 'SERVER') => void;
  onSaveDraft: () => void;
  onSubmitForApproval: () => void;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  isDirty?: boolean;
}

export const StudioHeaderBar: React.FC<StudioHeaderBarProps> = ({
  documentType,
  documentTitle,
  documentNumber,
  isEdit,
  version = 1,
  status = 'DRAFT',
  backPath,
  previewMode,
  onTogglePreviewMode,
  onSaveDraft,
  onSubmitForApproval,
  isSavingDraft,
  isSubmitting,
  isDirty = false,
}) => {
  const navigate = useNavigate();

  const typeConfig: Record<DocumentType, { label: string; badgeBg: string; badgeText: string }> = {
    INVOICE: {
      label: 'Invoice Studio',
      badgeBg: 'bg-indigo-50 border-indigo-200/80',
      badgeText: 'text-[#5847F6]',
    },
    WAYBILL: {
      label: 'Waybill Studio',
      badgeBg: 'bg-sky-50 border-sky-200/80',
      badgeText: 'text-sky-700',
    },
    LETTER: {
      label: 'Letterhead Studio',
      badgeBg: 'bg-emerald-50 border-emerald-200/80',
      badgeText: 'text-emerald-700',
    },
  };

  const currentType = typeConfig[documentType];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
      {/* Left: Navigation, Title & Status Badges */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 transition-colors shadow-sm shrink-0"
          title="Return to Workspace"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${currentType.badgeBg} ${currentType.badgeText} tracking-wider`}
            >
              {currentType.label}
            </span>

            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              {isEdit ? (
                <>
                  <span>Editing</span>
                  <span className="text-[#5847F6] font-mono font-bold text-lg md:text-xl">
                    #{documentNumber || 'DRAFT'}
                  </span>
                </>
              ) : (
                <span>New {documentType === 'INVOICE' ? 'Invoice' : documentType === 'WAYBILL' ? 'Waybill' : 'Letter'}</span>
              )}
            </h1>

            {/* Status Pill */}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
              {status}
            </span>

            {/* Version Counter */}
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              v{version}
            </span>

            {isDirty && (
              <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved edits
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md md:max-w-xl">
            {documentTitle || 'Drafting corporate document with real-time financial accuracy and print rendering'}
          </p>
        </div>
      </div>

      {/* Right Action Dock */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Preview Mode Toggle Pill */}
        <div className="flex items-center bg-[#F1F3F9] p-1 rounded-full border border-slate-200/70 shadow-inner">
          <button
            type="button"
            onClick={() => onTogglePreviewMode('LIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              previewMode === 'LIVE'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-[#5847F6]" />
            <span>Instant A4</span>
          </button>
          <button
            type="button"
            onClick={() => onTogglePreviewMode('SERVER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              previewMode === 'SERVER'
                ? 'bg-[#16181F] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Server Preview</span>
          </button>
        </div>

        {/* Save Draft Secondary Pill */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSavingDraft || isSubmitting}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs md:text-sm font-bold shadow-sm transition-all disabled:opacity-50"
        >
          {isSavingDraft ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
          ) : (
            <Check className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>{isSavingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
        </button>

        {/* Save & Submit for Approval Primary CTA */}
        <button
          type="button"
          onClick={onSubmitForApproval}
          disabled={isSavingDraft || isSubmitting}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isSubmitting ? 'Submitting...' : 'Save & Submit'}</span>
        </button>
      </div>
    </div>
  );
};
