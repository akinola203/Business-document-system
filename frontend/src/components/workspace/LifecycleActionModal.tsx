import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, ShieldAlert, Send, FileCheck, Copy, Ban } from 'lucide-react';
import { cn } from '../../lib/utils';

export type LifecycleActionType =
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'ISSUE'
  | 'CANCEL'
  | 'DUPLICATE';

interface LifecycleActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: LifecycleActionType;
  documentNumber: string;
  documentTitle?: string;
  onConfirm: (payload?: any) => Promise<void>;
  isLoading?: boolean;
}

export const LifecycleActionModal: React.FC<LifecycleActionModalProps> = ({
  isOpen,
  onClose,
  actionType,
  documentNumber,
  documentTitle,
  onConfirm,
  isLoading = false,
}) => {
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (actionType === 'REJECT' && !reason.trim()) {
      setValidationError('Please provide a mandatory reason for rejecting this document.');
      return;
    }

    if (actionType === 'CANCEL' && !reason.trim()) {
      setValidationError('Please provide a mandatory reason for cancelling this document.');
      return;
    }

    let payload: any = undefined;
    if (actionType === 'APPROVE') {
      payload = { comment: comment.trim() || undefined };
    } else if (actionType === 'REJECT') {
      payload = { rejectionReason: reason.trim() };
    } else if (actionType === 'CANCEL') {
      payload = { cancellationReason: reason.trim() };
    }

    try {
      await onConfirm(payload);
      setComment('');
      setReason('');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Action failed. Please verify conditions and permissions.';
      setValidationError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const getActionConfig = () => {
    switch (actionType) {
      case 'SUBMIT':
        return {
          title: 'Submit Document for Approval',
          subtitle: `Are you sure you want to submit ${documentNumber} to company managers for formal approval?`,
          icon: Send,
          iconColor: 'text-[#5847F6]',
          iconBg: 'bg-indigo-50',
          confirmBtnText: 'Submit for Approval',
          confirmBtnColor: 'bg-[#5847F6] hover:bg-[#4939E3] text-white',
        };
      case 'APPROVE':
        return {
          title: 'Approve Document',
          subtitle: `You are authorizing ${documentNumber}. An approval step record will be permanently logged.`,
          icon: CheckCircle2,
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
          confirmBtnText: 'Confirm Approval',
          confirmBtnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case 'REJECT':
        return {
          title: 'Reject Document',
          subtitle: `Return ${documentNumber} to the author for revision. A clear explanation is required.`,
          icon: AlertCircle,
          iconColor: 'text-rose-600',
          iconBg: 'bg-rose-50',
          confirmBtnText: 'Reject Document',
          confirmBtnColor: 'bg-rose-600 hover:bg-rose-700 text-white',
        };
      case 'ISSUE':
        return {
          title: 'Issue Official Document',
          subtitle: `Issuing ${documentNumber} permanently freezes an official legal snapshot (Version 1). Once issued, financial ledger balances and delivery notes take legal effect.`,
          icon: FileCheck,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-50',
          confirmBtnText: 'Issue & Lock Snapshot',
          confirmBtnColor: 'bg-[#5847F6] hover:bg-[#4939E3] text-white',
        };
      case 'CANCEL':
        return {
          title: 'Cancel Document',
          subtitle: `Cancelling ${documentNumber} voids this record. Cancelled documents cannot be re-opened.`,
          icon: Ban,
          iconColor: 'text-slate-600',
          iconBg: 'bg-slate-100',
          confirmBtnText: 'Confirm Cancellation',
          confirmBtnColor: 'bg-slate-900 hover:bg-slate-800 text-white',
        };
      case 'DUPLICATE':
        return {
          title: 'Duplicate Document',
          subtitle: `Clone ${documentNumber} and all its line items into a new DRAFT with a newly allocated number.`,
          icon: Copy,
          iconColor: 'text-[#5847F6]',
          iconBg: 'bg-indigo-50',
          confirmBtnText: 'Duplicate into Draft',
          confirmBtnColor: 'bg-[#5847F6] hover:bg-[#4939E3] text-white',
        };
    }
  };

  const config = getActionConfig();
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-[32px] p-7 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', config.iconBg, config.iconColor)}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{config.title}</h3>
              <p className="text-xs font-mono font-bold text-slate-500 tabular-nums">
                {documentNumber} {documentTitle ? `— ${documentTitle}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-5">{config.subtitle}</p>

        {validationError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            {validationError.toLowerCase().includes('self-approval') && (
              <p className="text-[11px] text-rose-600 pl-6 leading-relaxed">
                Tip: Your organization has strict segregation of duties enabled. To allow document authors or administrators to approve their own drafts, an Admin can enable <strong>"Allow Document Self-Approval"</strong> in <strong>Company Settings &gt; Corporate Governance</strong>, or switch to an authorized Manager (e.g. <code>manager@aoa77.com</code>) to approve.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {actionType === 'APPROVE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Approval Comment (Optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Terms verified against PO #1029. Approved for dispatch."
                rows={3}
                className="w-full p-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          )}

          {(actionType === 'REJECT' || actionType === 'CANCEL') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mandatory Justification / Reason *
              </label>
              <textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this document is being rejected or cancelled..."
                rows={3}
                className="w-full p-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'px-6 py-2.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50',
                config.confirmBtnColor,
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{config.confirmBtnText}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
