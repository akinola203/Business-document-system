import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentRecord, DocumentType } from '../../types';
import { formatCurrency, formatRelativeTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { FileText, Truck, Mail, Inbox, Plus } from 'lucide-react';

interface SelectableDocumentFeedProps {
  documents: DocumentRecord[];
  selectedId: string | null;
  onSelect: (doc: DocumentRecord) => void;
  isLoading?: boolean;
  documentType: DocumentType;
  emptyMessage?: string;
}

export const SelectableDocumentFeed: React.FC<SelectableDocumentFeedProps> = ({
  documents,
  selectedId,
  onSelect,
  isLoading = false,
  documentType,
  emptyMessage,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-[#1E2029] border border-[#282B37] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    const emptyConfig =
      documentType === 'INVOICE'
        ? {
            prompt: 'No invoices created yet. Click below to create your first client invoice.',
            buttonLabel: '+ Create New Invoice',
            path: '/documents/invoices/new',
          }
        : documentType === 'WAYBILL'
          ? {
              prompt: 'No waybills created yet. Click below to generate your first delivery waybill.',
              buttonLabel: '+ Generate Waybill',
              path: '/documents/waybills/new',
            }
          : {
              prompt: 'No official letters created yet. Click below to write your first corporate letter.',
              buttonLabel: '+ Write Official Letter',
              path: '/documents/letters/new',
            };

    return (
      <div className="p-10 rounded-2xl bg-[#1E2029] border border-[#282B37] text-center flex flex-col items-center justify-center">
        <Inbox className="w-12 h-12 text-neutral-500 mb-3" />
        <p className="text-base font-extrabold text-white">
          {emptyMessage || emptyConfig.prompt}
        </p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
          Your numbering counter starts cleanly at <strong>0001</strong> with{' '}
          <strong>Akindeji Akinlade</strong> pre-filled as Authorized Signatory.
        </p>
        <button
          type="button"
          onClick={() => navigate(emptyConfig.path)}
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-extrabold shadow-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{emptyConfig.buttonLabel}</span>
        </button>
      </div>
    );
  }

  const safeDocuments = Array.isArray(documents) ? documents : [];

  return (
    <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-2 dark-scroll">
      {safeDocuments.map((doc) => {
        const isSelected = selectedId === doc.id;
        const clientName =
          doc.client?.companyName ||
          doc.client?.name ||
          doc.letter?.recipientName ||
          'Walk-in Client / Customer';

        const clientInitials = (clientName || 'WC')
          .split(' ')
          .map((n: string) => (n || '').charAt(0))
          .slice(0, 2)
          .join('')
          .toUpperCase();

        const isInvoice = doc.documentType === 'INVOICE';
        const isWaybill = doc.documentType === 'WAYBILL';
        const waybillItemsCount = doc.waybill?.items?.length || 0;

        return (
          <div
            key={doc.id}
            onClick={() => onSelect(doc)}
            className={cn(
              'group p-4 rounded-2xl cursor-pointer transition-all duration-200 border text-xs',
              isSelected
                ? 'bg-neutral-900 text-white border-neutral-500/50 shadow-lg shadow-black/20'
                : 'bg-[#1E2029] hover:bg-[#252834] text-slate-300 border-[#282B37]',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                {/* Client Avatar Pill */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[11px] shrink-0',
                    isSelected
                      ? 'bg-white text-neutral-500'
                      : 'bg-[#282B37] text-slate-300 group-hover:bg-slate-700',
                  )}
                >
                  {clientInitials || 'CL'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-black tabular-nums tracking-tight text-xs',
                        isSelected ? 'text-white' : 'text-white',
                      )}
                    >
                      {doc.documentNumber}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                        isSelected
                          ? 'bg-white/20 text-white'
                          : doc.status === 'ISSUED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : doc.status === 'APPROVED'
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          : doc.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-white/10 text-slate-400',
                      )}
                    >
                      {doc.status}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-[11px] truncate max-w-[170px] mt-0.5 font-medium',
                      isSelected ? 'text-white/80' : 'text-slate-400',
                    )}
                  >
                    {clientName}
                  </div>
                </div>
              </div>

              {/* Amount / Metric on Right */}
              <div className="text-right">
                {isInvoice && (
                  <>
                    <div
                      className={cn(
                        'font-black text-sm tabular-nums',
                        isSelected ? 'text-white' : 'text-white',
                      )}
                    >
                      {formatCurrency(doc.totalAmount, doc.currency)}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-medium mt-0.5',
                        isSelected ? 'text-white/70' : 'text-slate-500',
                      )}
                    >
                      {formatRelativeTime(doc.issueDate || doc.createdAt)}
                    </div>
                  </>
                )}

                {isWaybill && (
                  <>
                    <div
                      className={cn(
                        'font-bold text-xs',
                        isSelected ? 'text-white' : 'text-slate-200',
                      )}
                    >
                      {waybillItemsCount} Cargo Item{waybillItemsCount === 1 ? '' : 's'}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-medium mt-0.5',
                        isSelected ? 'text-white/70' : 'text-slate-500',
                      )}
                    >
                      {doc.waybill?.deliveryStatus?.replace(/_/g, ' ') || 'Preparing'}
                    </div>
                  </>
                )}

                {!isInvoice && !isWaybill && (
                  <div
                    className={cn(
                      'text-[10px] font-medium',
                      isSelected ? 'text-white/80' : 'text-slate-400',
                    )}
                  >
                    {formatRelativeTime(doc.issueDate || doc.createdAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
