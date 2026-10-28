import React, { useRef, useState } from 'react';
import { PaymentRecord, DocumentRecord } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  X,
  Printer,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Building2,
  FileText,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
  Download,
} from 'lucide-react';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  invoice?: DocumentRecord | null;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  invoice,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !payment) return null;

  const isReversed = payment.isReversed;
  const currency = payment.currency || invoice?.currency || 'NGN';
  const clientName =
    invoice?.client?.companyName ||
    invoice?.client?.name ||
    payment.invoice?.document?.client?.name ||
    'Commercial Client';

  const docNumber =
    invoice?.documentNumber ||
    payment.invoice?.documentNumber ||
    payment.invoice?.document?.documentNumber ||
    'INV-RECORD';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReceipt = () => {
    const text = `AOA 77 COMPANY LTD - PAYMENT RECEIPT\nReceipt #: ${payment.paymentNumber}\nDate: ${payment.paymentDate}\nInvoice: ${docNumber}\nClient: ${clientName}\nAmount Paid: ${formatCurrency(payment.amount, currency)}\nMethod: ${payment.method}\nReference: ${payment.referenceNumber}\nStatus: ${isReversed ? 'REVERSED' : 'SETTLED'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="no-print p-4 md:px-6 bg-[#16181F] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#5847F6]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
              Official Payment Voucher & Receipt
            </span>
            <span className="font-mono text-xs text-indigo-300 font-bold">
              {payment.paymentNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReceipt}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copy receipt details"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="print-receipt-sheet p-8 md:p-10 bg-white text-slate-900 space-y-6 relative select-text">
          {/* Reversal Void Watermark */}
          {isReversed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-15">
              <span className="text-8xl md:text-9xl font-black text-rose-600 uppercase tracking-widest -rotate-45 select-none border-8 border-rose-600 px-8 py-4 rounded-3xl">
                VOIDED
              </span>
            </div>
          )}

          {/* 1. Corporate Letterhead Top */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black text-base shadow-sm">
                  77
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-950 tracking-tight leading-none uppercase">
                    AOA 77 COMPANY LTD
                  </h1>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Smart Documents &bull; Better Business
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-600 mt-2.5 leading-relaxed font-medium">
                Plot 12 Commercial Way, Ikeja Industrial Estate, Lagos State, Nigeria<br />
                RC: <strong>RC-1849204</strong> &bull; Tax ID (TIN): <strong>23901928-0001</strong><br />
                Email: accounts@aoa77.com &bull; Phone: +234 803 555 1001
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-900 font-extrabold text-xs uppercase tracking-wider mb-2">
                Official Receipt
              </div>
              <div className="text-2xl font-black font-mono text-slate-950 tabular-nums">
                {payment.paymentNumber}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Date: <strong>{formatDate(payment.paymentDate)}</strong>
              </p>
            </div>
          </div>

          {/* 2. Status & Key Figure Hero Pill */}
          <div className="p-6 rounded-2xl bg-[#F8F9FC] border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Settlement Amount Received
                </span>
                {isReversed ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                    REVERSED / VOID
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>SETTLED</span>
                  </span>
                )}
              </div>
              <div className="text-3xl md:text-4xl font-black text-slate-950 tabular-nums tracking-tight">
                {formatCurrency(payment.amount, currency)}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Settlement Channel
              </span>
              <span className="text-sm font-extrabold text-slate-800 uppercase">
                {payment.method.replace('_', ' ')}
              </span>
              <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                Ref: {payment.referenceNumber}
              </span>
            </div>
          </div>

          {/* 3. Payer & Linked Document Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Received From (Payer)
              </span>
              <p className="text-sm font-extrabold text-slate-900">{clientName}</p>
              {invoice?.client?.email && (
                <p className="text-slate-500">{invoice.client.email}</p>
              )}
              {invoice?.client?.address && (
                <p className="text-slate-500 leading-snug">{invoice.client.address}</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Applied Against Document
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold font-mono text-indigo-700">
                  {docNumber}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                  Commercial Invoice
                </span>
              </div>
              {invoice?.totalAmount && (
                <div className="pt-1.5 flex justify-between text-slate-600 border-t border-slate-100">
                  <span>Total Invoiced:</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(invoice.totalAmount, currency)}
                  </span>
                </div>
              )}
              {invoice?.balanceDue !== undefined && (
                <div className="flex justify-between text-slate-900 font-extrabold">
                  <span>Current Balance Due:</span>
                  <span className="tabular-nums text-[#5847F6]">
                    {formatCurrency(invoice.balanceDue, currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Notes / Internal Audit Remarks */}
          {payment.notes && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Payment Memo / Notes
              </span>
              <p className="text-slate-700 font-medium italic">"{payment.notes}"</p>
            </div>
          )}

          {/* 5. Authorization & Verification Footer */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-6 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Authorized By (Accounts / Cashier)
              </span>
              <div className="h-10 border-b border-dashed border-slate-300 mt-2 flex items-end pb-1 font-serif text-slate-700">
                {payment.recordedBy?.fullName || 'Financial Officer'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Authorized Signature & Seal</p>
            </div>

            <div className="text-right flex flex-col justify-end">
              <div className="flex items-center justify-end gap-1.5 text-slate-600 font-semibold text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified System Transaction</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                Audit Token: {payment.id.slice(0, 18)}...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
