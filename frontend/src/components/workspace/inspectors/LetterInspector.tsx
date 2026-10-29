import React, { useState } from 'react';
import { DocumentRecord, LetterSpecialization } from '../../../types';
import { formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../store/auth.store';
import { apiClient } from '../../../lib/api-client';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  Mail,
  Download,
  History,
  Copy,
  Ban,
  CheckCircle2,
  Clock,
  Send,
  FileCheck,
  User,
  Building,
  FileText,
  Lock,
  Printer,
} from 'lucide-react';
import { downloadDocumentPdf, printDocumentPdf } from '../../../lib/pdf-download';

interface LetterInspectorProps {
  document: DocumentRecord;
  onActionClick: (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ISSUE' | 'CANCEL' | 'DUPLICATE') => void;
  onOpenHistory: () => void;
  onEditDraft?: (documentId: string) => void;
}

export const LetterInspector: React.FC<LetterInspectorProps> = ({
  document,
  onActionClick,
  onOpenHistory,
  onEditDraft,
}) => {
  const { isAdmin, canApprove, canIssue, canCancel, hasPermission } = usePermissions();
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [isPdfPrinting, setIsPdfPrinting] = useState(false);

  const letData: LetterSpecialization | null | undefined = document.letter;
  const status = document.status;

  const handlePdfDownload = async () => {
    setIsPdfDownloading(true);
    try {
      await downloadDocumentPdf({
        documentId: document.id,
        documentNumber: document.documentNumber,
        documentType: 'Letter',
      });
    } catch (err: any) {
      console.error('Failed to download Letter PDF:', err);
      alert(err?.message || 'Unable to download Letter PDF. Please verify permissions.');
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const handlePdfPrint = async () => {
    setIsPdfPrinting(true);
    try {
      await printDocumentPdf(document.id);
    } catch (err: any) {
      console.error('Failed to print Letter PDF:', err);
      alert(err?.message || 'Unable to load Letter PDF for printing. Please verify permissions.');
    } finally {
      setIsPdfPrinting(false);
    }
  };

  return (
    <div className="w-full bg-[#5B58B6] rounded-[28px] p-6 text-white flex flex-col justify-between shadow-xl space-y-6">
      {/* 1. Header: Document Meta & Recipient Details */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold tracking-tight tabular-nums">
                  {document.documentNumber}
                </h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/20 border border-white/20">
                  v{document.version || 1}
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium">
                Letter Date: {formatDate(letData?.letterDate || document.issueDate || document.createdAt)}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`text-xs font-bold uppercase px-3 py-1 rounded-full shadow-sm ${
              status === 'ISSUED'
                ? 'bg-emerald-400 text-slate-950 font-black'
                : status === 'APPROVED'
                ? 'bg-sky-300 text-slate-950 font-black'
                : status === 'PENDING_APPROVAL'
                ? 'bg-amber-300 text-slate-950 font-black'
                : 'bg-white/20 text-white'
            }`}
          >
            {status}
          </span>
        </div>

        {/* Recipient Glass Card */}
        <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
              Recipient
            </span>
            <span className="font-extrabold text-sm text-white">
              {letData?.recipientName || 'Recipient'}
            </span>
            {letData?.recipientTitle && (
              <span className="text-white/80 block text-[11px] mt-0.5">
                {letData.recipientTitle}{' '}
                {letData.recipientOrganization ? `&bull; ${letData.recipientOrganization}` : ''}
              </span>
            )}
            {letData?.recipientAddress && (
              <span className="text-white/60 block text-[10px] mt-1 whitespace-pre-line">
                {letData.recipientAddress}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle Bento Grid: Subject & Formatted Body Preview */}
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
              Subject
            </span>
            <div className="text-sm font-extrabold text-white mt-0.5 uppercase tracking-wide">
              {letData?.subject || document.title}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block mb-1">
              Body Excerpt
            </span>
            <div className="text-xs text-white/90 leading-relaxed max-h-36 overflow-y-auto pr-1 dark-scroll">
              {letData?.bodyText ? (
                <p className="whitespace-pre-line">{letData.bodyText}</p>
              ) : letData?.bodyHtml ? (
                <div dangerouslySetInnerHTML={{ __html: letData.bodyHtml }} />
              ) : (
                <p className="text-white/50 italic">No letter body draft content yet.</p>
              )}
            </div>
          </div>

          {/* Signatory details */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/80">
            <span>
              Signatory: <strong>{letData?.signatoryName || 'Authorized Signer'}</strong>
              {letData?.signatoryTitle ? ` (${letData.signatoryTitle})` : ''}
            </span>
            {letData?.signatoryDepartment && (
              <span className="text-white/60">{letData.signatoryDepartment}</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom: Actions */}
      <div className="pt-4 border-t border-white/15 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePdfDownload}
              disabled={isPdfDownloading}
              title="📥 Download Letter PDF to Device"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isPdfDownloading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={handlePdfPrint}
              disabled={isPdfPrinting}
              title="🖨️ Print / Open Letter PDF"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isPdfPrinting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onOpenHistory}
              title="Audit & Version History"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <History className="w-4 h-4" />
            </button>

            <button
              onClick={() => onActionClick('DUPLICATE')}
              title="Duplicate letter"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <Copy className="w-4 h-4" />
            </button>

            {status !== 'CANCELLED' && canCancel('LETTER') && (
              <button
                onClick={() => onActionClick('CANCEL')}
                title="Cancel letter"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500/80 border border-white/10 flex items-center justify-center text-white transition-all shadow-sm"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Context-Aware Primary White Pill CTA */}
          <div>
            {status === 'DRAFT' && (isAdmin || hasPermission('letter:submit') || hasPermission('letter:create')) && (
              <button
                onClick={() => onActionClick('SUBMIT')}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
              >
                <Send className="w-4 h-4 text-[#5847F6]" />
                <span>Submit for Approval</span>
              </button>
            )}

            {status === 'PENDING_APPROVAL' && (
              canApprove('LETTER') ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onActionClick('REJECT')}
                    className="px-4 py-2.5 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => onActionClick('APPROVE')}
                    className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Approve Letter</span>
                  </button>
                </div>
              ) : (
                <div
                  title="Requires Admin / Manager approval rights"
                  className="px-5 py-2.5 rounded-full bg-white/10 text-white/50 text-xs font-semibold cursor-not-allowed flex items-center gap-2 border border-white/10 select-none"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Requires Admin / Manager approval rights</span>
                </div>
              )
            )}

            {status === 'APPROVED' && (
              canIssue('LETTER') ? (
                <button
                  onClick={() => onActionClick('ISSUE')}
                  className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
                >
                  <FileCheck className="w-4 h-4 text-[#5847F6]" />
                  <span>Issue & Freeze Snapshot</span>
                </button>
              ) : (
                <div
                  title="Requires Admin / Manager issuance rights"
                  className="px-5 py-2.5 rounded-full bg-white/10 text-white/50 text-xs font-semibold cursor-not-allowed flex items-center gap-2 border border-white/10 select-none"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Requires Admin / Manager issuance rights</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
