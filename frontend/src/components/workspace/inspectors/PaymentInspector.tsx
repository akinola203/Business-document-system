import React, { useState } from 'react';
import { PaymentRecord } from '../../../types';
import { formatCurrency } from '../../../lib/utils';
import {
  CreditCard,
  Building,
  Calendar,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Printer,
  Hash,
  User,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReversePaymentModal } from '../../payments/ReversePaymentModal';
import { PaymentReceiptModal } from '../../payments/PaymentReceiptModal';

interface PaymentInspectorProps {
  payment: PaymentRecord | null;
  onPaymentReversed?: () => void;
}

export const PaymentInspector: React.FC<PaymentInspectorProps> = ({
  payment,
  onPaymentReversed,
}) => {
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  if (!payment) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Receipt className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
        <p className="text-sm font-semibold text-slate-300">Select a payment transaction</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Click any transaction from the payments ledger on the left to inspect its settlement breakdown, invoice linkage, and audit trail.
        </p>
      </div>
    );
  }

  const isReversed = payment.isReversed;

  return (
    <div className="h-full flex flex-col justify-between space-y-6">
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden border border-indigo-400/20">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold tracking-wider backdrop-blur-md">
                {payment.method.replace('_', ' ')}
              </span>
              {isReversed ? (
                <span className="px-3 py-1 rounded-full bg-rose-500/80 text-[11px] font-extrabold tracking-wide flex items-center gap-1 backdrop-blur-md text-white">
                  <RotateCcw className="w-3 h-3" />
                  <span>REVERSED</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-[11px] font-bold tracking-wide flex items-center gap-1 backdrop-blur-md border border-emerald-400/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>SETTLED</span>
                </span>
              )}
            </div>

            <span className="text-xs font-mono text-indigo-200">
              {payment.paymentNumber}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
              Settlement Amount
            </span>
            <h1 className="text-3xl font-black tracking-tight tabular-nums">
              {formatCurrency(Number(payment.amount), payment.currency)}
            </h1>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-indigo-200 text-[11px]">Date Received</span>
              <p className="font-semibold text-white mt-0.5">{payment.paymentDate}</p>
            </div>
            <div>
              <span className="text-indigo-200 text-[11px]">Bank Ref / Teller</span>
              <p className="font-mono font-bold text-white mt-0.5 truncate">{payment.referenceNumber}</p>
            </div>
          </div>
        </div>

        {/* Reversal Alert Banner (If reversed) */}
        {isReversed && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Voided Settlement Audit</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              <strong>Reason:</strong> {payment.reversalReason || 'Transaction reversed by authorized administrator.'}
            </p>
            {payment.reversedAt && (
              <p className="text-[10px] text-slate-400 font-mono">
                Reversed on: {new Date(payment.reversedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Linked Invoice Card */}
        <div className="p-5 rounded-2xl bg-[#1D2029] border border-slate-800 text-slate-300 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#5847F6]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Linked Invoice</span>
            </div>
            {payment.invoiceId && (
              <Link
                to={`/documents/invoices`}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>View Workspace</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[11px] text-slate-400">Document Reference</span>
              <p className="text-sm font-extrabold text-white">
                {payment.invoice?.documentNumber || 'AOA/INV/2026/0001'}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400">Corporate Customer</span>
              <p className="text-xs font-semibold text-slate-200">
                {payment.invoice?.document?.client?.name || 'Commercial Client'}
              </p>
            </div>

            {payment.notes && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400">Internal Audit Memo</span>
                <p className="text-xs text-slate-300 italic mt-0.5 leading-relaxed">
                  "{payment.notes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="p-4 rounded-2xl bg-[#1D2029] border border-slate-800 text-slate-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <span>Recorded By: <strong className="text-slate-200">{payment.recordedBy?.fullName || 'Finance Officer'}</strong></span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {new Date(payment.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Action Dock */}
      <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsReceiptModalOpen(true)}
          className="flex-1 py-3 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-slate-700"
        >
          <Printer className="w-4 h-4 text-slate-400" />
          <span>Official Receipt</span>
        </button>

        {!isReversed && (
          <button
            type="button"
            onClick={() => setIsReverseModalOpen(true)}
            className="flex-1 py-3 px-4 rounded-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span>Reverse Payment</span>
          </button>
        )}
      </div>

      {/* Official Printable Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={isReceiptModalOpen}
        payment={payment}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* Reversal Confirmation Modal */}
      <ReversePaymentModal
        isOpen={isReverseModalOpen}
        payment={payment}
        onClose={() => setIsReverseModalOpen(false)}
        onSuccess={() => {
          if (onPaymentReversed) onPaymentReversed();
        }}
      />
    </div>
  );
};
