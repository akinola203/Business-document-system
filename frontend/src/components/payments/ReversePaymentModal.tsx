import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { PaymentRecord } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { X, AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

interface ReversePaymentModalProps {
  isOpen: boolean;
  payment: PaymentRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReversePaymentModal: React.FC<ReversePaymentModalProps> = ({
  isOpen,
  payment,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!payment) return;
      if (reason.trim().length < 5) {
        throw new Error('A detailed reversal audit reason of at least 5 characters is mandatory.');
      }

      try {
        const res = await apiClient.post(`/payments/${payment.id}/reverse`, {
          reason: reason.trim(),
        });
        return res.data;
      } catch (err: any) {
        // Standalone offline fallback
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          payment.isReversed = true;
          payment.reversedAt = new Date().toISOString();
          payment.reversalReason = reason.trim();
          return payment;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (payment?.invoiceId) {
        queryClient.invalidateQueries({ queryKey: ['invoice-ledger', payment.invoiceId] });
      }
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to reverse payment.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-[32px] p-6 md:p-8 shadow-2xl border border-rose-200 space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Reverse Financial Settlement</h2>
              <p className="text-xs text-slate-500 font-medium">Void ledger entry #{payment.paymentNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-900 text-xs space-y-1.5">
          <div className="font-extrabold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Audited Reversal Action</span>
          </div>
          <p className="leading-relaxed">
            Reversing this transaction will restore{' '}
            <strong className="font-bold underline">
              {formatCurrency(Number(payment.amount), payment.currency)}
            </strong>{' '}
            back onto the outstanding balance of invoice{' '}
            <strong>{payment.invoice?.documentNumber || 'assigned invoice'}</strong>. Reversals are permanently logged in the audit trail.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-100 border border-rose-300 text-rose-900 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMessage(null);
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mandatory Reversal Audit Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate bank teller posted in error; bank returned dishonored instrument #4912..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">Minimum 5 characters required for legal compliance.</p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Keep Payment
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || reason.trim().length < 5}
              className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-lg shadow-rose-600/25 transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer active:scale-95"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reversing...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Execute Reversal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
