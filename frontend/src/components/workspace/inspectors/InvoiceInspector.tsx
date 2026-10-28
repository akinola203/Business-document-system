import React, { useState } from 'react';
import { DocumentRecord, InvoiceItem } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../store/auth.store';
import { apiClient } from '../../../lib/api-client';
import {
  FileText,
  Download,
  History,
  Copy,
  Ban,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  CreditCard,
  Printer,
  ChevronRight,
  Send,
  FileCheck,
} from 'lucide-react';

interface InvoiceInspectorProps {
  document: DocumentRecord;
  onActionClick: (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ISSUE' | 'CANCEL' | 'DUPLICATE') => void;
  onOpenHistory: () => void;
  onRecordPayment?: (document: DocumentRecord) => void;
  onEditDraft?: (documentId: string) => void;
}

export const InvoiceInspector: React.FC<InvoiceInspectorProps> = ({
  document,
  onActionClick,
  onOpenHistory,
  onRecordPayment,
  onEditDraft,
}) => {
  const { hasPermission } = useAuthStore();
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const inv = document.invoice;
  const items: InvoiceItem[] = inv?.items || [];
  const status = document.status;
  const paymentStatus = document.paymentStatus || 'UNPAID';

  // Securely download / preview PDF using authenticated apiClient
  const handlePdfDownload = async () => {
    setIsPdfLoading(true);
    try {
      const response = await apiClient.get(`/documents/${document.id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      alert('Unable to generate or download document PDF. Please verify permissions.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#5B58B6] rounded-[28px] p-6 text-white flex flex-col justify-between shadow-xl space-y-6">
      {/* 1. Header: Document Meta & Client Card */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm">
              <FileText className="w-6 h-6" />
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
                Issued: {formatDate(document.issueDate || document.createdAt)} &bull; {document.title}
              </p>
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase px-3 py-1 rounded-full shadow-sm ${
                status === 'ISSUED'
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : status === 'APPROVED'
                  ? 'bg-sky-300 text-slate-950 font-black'
                  : status === 'PENDING_APPROVAL'
                  ? 'bg-amber-300 text-slate-950 font-black'
                  : status === 'CANCELLED'
                  ? 'bg-rose-900/60 text-white'
                  : 'bg-white/20 text-white'
              }`}
            >
              {status}
            </span>

            {status === 'ISSUED' && (
              <span
                className={`text-xs font-bold uppercase px-3 py-1 rounded-full shadow-sm ${
                  paymentStatus === 'PAID'
                    ? 'bg-emerald-500 text-white'
                    : paymentStatus === 'PARTIALLY_PAID'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {paymentStatus}
              </span>
            )}
          </div>
        </div>

        {/* Customer Information Glass Strip */}
        <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
              Billed Customer
            </span>
            <span className="font-extrabold text-sm text-white">
              {document.client?.companyName || document.client?.name || 'Walk-in Customer'}
            </span>
            {document.client?.email && (
              <span className="text-white/70 block text-[11px] mt-0.5">
                {document.client.email}
              </span>
            )}
          </div>

          {inv?.poNumber && (
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
                Purchase Order
              </span>
              <span className="font-mono font-bold text-white text-xs">{inv.poNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle Bento Grid: Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">
            Invoice Line Items ({items.length})
          </span>
          {status === 'DRAFT' && onEditDraft && (
            <button
              onClick={() => onEditDraft(document.id)}
              className="text-xs font-bold text-white hover:text-white/80 flex items-center gap-1 underline"
            >
              <span>Edit Items</span>
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 dark-scroll">
          {items.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/10 text-center text-xs text-white/70 border border-white/10">
              No line items added to this invoice draft yet.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs hover:bg-white/20 transition-all shadow-sm"
              >
                <div>
                  <div className="font-bold text-white text-xs">{item.description}</div>
                  <div className="text-white/70 text-[11px] mt-0.5 tabular-nums">
                    {Number(item.quantity).toLocaleString()} {item.unit || 'units'} &times;{' '}
                    {formatCurrency(item.unitPrice, document.currency)}
                  </div>
                </div>
                <div className="text-right font-black text-sm tabular-nums text-white">
                  {formatCurrency(item.lineTotal, document.currency)}
                </div>
              </div>
            ))
          )}

          {/* Quick-add dashed card for drafts */}
          {status === 'DRAFT' && onEditDraft && (
            <button
              onClick={() => onEditDraft(document.id)}
              className="w-full py-3 rounded-2xl border border-dashed border-white/40 hover:border-white hover:bg-white/10 text-xs font-bold text-white/90 flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Modify Draft Line Items in Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Bottom: Totals & Smart Lifecycle Action Bar */}
      <div className="pt-4 border-t border-white/15 space-y-4">
        {/* Financial Breakdown Table */}
        <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 space-y-2 text-xs">
          <div className="flex justify-between text-white/80">
            <span>Subtotal:</span>
            <span className="font-bold tabular-nums">
              {formatCurrency(document.subtotal ?? document.subtotalAmount, document.currency)}
            </span>
          </div>
          {Number(document.discountAmount) > 0 && (
            <div className="flex justify-between text-emerald-300">
              <span>Total Discount:</span>
              <span className="font-bold tabular-nums">
                -{formatCurrency(document.discountAmount, document.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-white/80">
            <span>Value Added Tax (VAT 7.5%):</span>
            <span className="font-bold tabular-nums">
              {formatCurrency(document.taxAmount, document.currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-black pt-2 border-t border-white/10 text-white">
            <span>Total Payable:</span>
            <span className="tabular-nums">
              {formatCurrency(document.totalAmount, document.currency)}
            </span>
          </div>
          {status === 'ISSUED' && (
            <div className="flex justify-between text-xs font-extrabold pt-1 text-amber-200">
              <span>Balance Due:</span>
              <span className="tabular-nums">
                {formatCurrency(document.balanceDue, document.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Secondary Utility Icons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePdfDownload}
              disabled={isPdfLoading}
              title="Download Official PDF"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isPdfLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onOpenHistory}
              title="Audit & Version Snapshots"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <History className="w-4 h-4" />
            </button>

            <button
              onClick={() => onActionClick('DUPLICATE')}
              title="Duplicate into new draft"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 border border-white/20 flex items-center justify-center text-white transition-all shadow-sm"
            >
              <Copy className="w-4 h-4" />
            </button>

            {status !== 'CANCELLED' && (
              <button
                onClick={() => onActionClick('CANCEL')}
                title="Cancel document"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500/80 border border-white/10 flex items-center justify-center text-white transition-all shadow-sm"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Context-Aware Primary White Pill CTA */}
          <div>
            {status === 'DRAFT' && hasPermission('invoice:submit') && (
              <button
                onClick={() => onActionClick('SUBMIT')}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg shadow-black/15 flex items-center gap-2 transition-all"
              >
                <Send className="w-4 h-4 text-[#5847F6]" />
                <span>Submit for Approval</span>
              </button>
            )}

            {status === 'PENDING_APPROVAL' && (
              <div className="flex items-center gap-2">
                {hasPermission('invoice:approve') && (
                  <button
                    onClick={() => onActionClick('REJECT')}
                    className="px-4 py-2.5 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Reject
                  </button>
                )}
                {hasPermission('invoice:approve') && (
                  <button
                    onClick={() => onActionClick('APPROVE')}
                    className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Approve Invoice</span>
                  </button>
                )}
              </div>
            )}

            {status === 'APPROVED' && hasPermission('invoice:issue') && (
              <button
                onClick={() => onActionClick('ISSUE')}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
              >
                <FileCheck className="w-4 h-4 text-[#5847F6]" />
                <span>Issue & Freeze Snapshot</span>
              </button>
            )}

            {status === 'ISSUED' && onRecordPayment && hasPermission('payment:record') && (
              <button
                onClick={() => onRecordPayment(document)}
                className="px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
