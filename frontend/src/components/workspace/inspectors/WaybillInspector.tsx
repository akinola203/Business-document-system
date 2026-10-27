import React, { useState } from 'react';
import { DocumentRecord, WaybillItem, WaybillDeliveryStatus } from '../../../types';
import { formatDate } from '../../../lib/utils';
import { useAuthStore } from '../../../store/auth.store';
import { apiClient } from '../../../lib/api-client';
import {
  Truck,
  Download,
  History,
  Copy,
  Ban,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  FileCheck,
  MapPin,
  Phone,
  PackageCheck,
  AlertOctagon,
} from 'lucide-react';

interface WaybillInspectorProps {
  document: DocumentRecord;
  onActionClick: (action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ISSUE' | 'CANCEL' | 'DUPLICATE') => void;
  onOpenHistory: () => void;
  onWaybillStateTransition: (action: 'READY' | 'DISPATCH' | 'COMPLETE' | 'FAIL') => void;
  onEditDraft?: (documentId: string) => void;
}

export const WaybillInspector: React.FC<WaybillInspectorProps> = ({
  document,
  onActionClick,
  onOpenHistory,
  onWaybillStateTransition,
  onEditDraft,
}) => {
  const { hasPermission } = useAuthStore();
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const wb = document.waybill;
  const items: WaybillItem[] = wb?.items || [];
  const status = document.status;
  const deliveryStatus = wb?.deliveryStatus || 'PREPARING';

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
      console.error('Failed to download Waybill PDF:', err);
      alert('Unable to generate or download Waybill PDF.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const getDeliveryStatusBadge = (dStatus: WaybillDeliveryStatus) => {
    switch (dStatus) {
      case 'DELIVERED':
        return 'bg-emerald-400 text-slate-950 font-black';
      case 'IN_TRANSIT':
        return 'bg-amber-300 text-slate-950 font-black';
      case 'READY_FOR_DISPATCH':
        return 'bg-sky-300 text-slate-950 font-black';
      case 'DELIVERY_FAILED':
        return 'bg-rose-500 text-white font-black';
      default:
        return 'bg-white/20 text-white';
    }
  };

  return (
    <div className="w-full bg-[#5B58B6] rounded-[28px] p-6 text-white flex flex-col justify-between shadow-xl space-y-6">
      {/* 1. Header: Document Meta & Consignee */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm">
              <Truck className="w-6 h-6" />
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
                Shipment Date: {formatDate(wb?.shipmentDate || document.issueDate || document.createdAt)}
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-white/20 text-white shadow-sm">
              {status}
            </span>
            <span
              className={`text-xs font-bold uppercase px-3 py-1 rounded-full shadow-sm ${getDeliveryStatusBadge(
                deliveryStatus,
              )}`}
            >
              {deliveryStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Logistics Route Telemetry Strip */}
        <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Origin (Dispatch From)
              </span>
              <span className="font-semibold text-white block mt-0.5">
                {wb?.originAddress || 'Central Warehouse'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Destination (Deliver To)
              </span>
              <span className="font-semibold text-white block mt-0.5">
                {wb?.destinationAddress || document.client?.addresses?.[0]?.line1 || 'Client Site'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] gap-2">
            <div>
              <span className="text-white/70">Vehicle:</span>{' '}
              <strong className="text-white">{wb?.vehicleNumber || 'Unassigned'}</strong>
            </div>
            <div>
              <span className="text-white/70">Driver:</span>{' '}
              <strong className="text-white">{wb?.driverName || 'Unassigned'}</strong>
              {wb?.driverPhone && (
                <span className="text-white/70 ml-1">({wb.driverPhone})</span>
              )}
            </div>
            {wb?.trackingNumber && (
              <div>
                <span className="text-white/70">Tracking:</span>{' '}
                <strong className="font-mono text-white">{wb.trackingNumber}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle Bento Grid: Consignment Cargo Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">
            Consignment Items ({items.length})
          </span>
          {status === 'DRAFT' && onEditDraft && (
            <button
              onClick={() => onEditDraft(document.id)}
              className="text-xs font-bold text-white hover:text-white/80 underline"
            >
              Edit Items
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1 dark-scroll">
          {items.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/10 text-center text-xs text-white/70 border border-white/10">
              No cargo items attached to this waybill draft.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-between text-xs hover:bg-white/20 transition-all shadow-sm"
              >
                <div>
                  <div className="font-bold text-white text-xs">{item.description}</div>
                  <div className="text-white/70 text-[11px] mt-0.5">
                    {item.packageCount ? `${item.packageCount} ${item.packageType || 'pkgs'} &bull; ` : ''}
                    {item.weightKg ? `${item.weightKg} kg` : ''}
                  </div>
                </div>
                <div className="text-right font-black text-sm tabular-nums text-white">
                  {Number(item.quantity).toLocaleString()} {item.unit || 'units'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. Bottom: Proof of Delivery & Logistics Action Bar */}
      <div className="pt-4 border-t border-white/15 space-y-4">
        {/* Delivery Confirmation Banner (if confirmed) */}
        {wb?.receivedByName && (
          <div className="p-3.5 rounded-2xl bg-emerald-400/20 border border-emerald-300/30 flex items-center justify-between text-xs text-white">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>
                Received by <strong>{wb.receivedByName}</strong> on{' '}
                {formatDate(wb.receivedDate)}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950">
              Confirmed
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePdfDownload}
              disabled={isPdfLoading}
              title="Download Official Waybill PDF"
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
              title="Audit & Version History"
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
                title="Cancel waybill"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500/80 border border-white/10 flex items-center justify-center text-white transition-all shadow-sm"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Context-Aware Primary White Pill CTA */}
          <div className="flex items-center gap-2">
            {/* Draft Stage */}
            {status === 'DRAFT' && hasPermission('waybill:submit') && (
              <button
                onClick={() => onActionClick('SUBMIT')}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
              >
                <Send className="w-4 h-4 text-[#5847F6]" />
                <span>Submit for Approval</span>
              </button>
            )}

            {/* Pending Approval Stage */}
            {status === 'PENDING_APPROVAL' && (
              <>
                {hasPermission('waybill:approve') && (
                  <button
                    onClick={() => onActionClick('REJECT')}
                    className="px-4 py-2.5 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Reject
                  </button>
                )}
                {hasPermission('waybill:approve') && (
                  <button
                    onClick={() => onActionClick('APPROVE')}
                    className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Approve Waybill</span>
                  </button>
                )}
              </>
            )}

            {/* Approved Stage -> Issue */}
            {status === 'APPROVED' && hasPermission('waybill:dispatch') && (
              <button
                onClick={() => onActionClick('ISSUE')}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-2 transition-all"
              >
                <FileCheck className="w-4 h-4 text-[#5847F6]" />
                <span>Issue Waybill</span>
              </button>
            )}

            {/* Issued Stage -> Logistics State Machine Transitions */}
            {status === 'ISSUED' && hasPermission('waybill:dispatch') && (
              <>
                {(deliveryStatus === 'PREPARING' || deliveryStatus === 'DELIVERY_FAILED') && (
                  <button
                    onClick={() => onWaybillStateTransition('READY')}
                    className="px-5 py-2.5 rounded-full bg-sky-300 hover:bg-sky-200 text-slate-950 text-xs font-black shadow-lg flex items-center gap-1.5 transition-all"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Stage Ready</span>
                  </button>
                )}

                {(deliveryStatus === 'READY_FOR_DISPATCH' || deliveryStatus === 'PREPARING') && (
                  <button
                    onClick={() => onWaybillStateTransition('DISPATCH')}
                    className="px-5 py-2.5 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black shadow-lg flex items-center gap-1.5 transition-all"
                  >
                    <Truck className="w-4 h-4 text-[#5847F6]" />
                    <span>Dispatch Consignment</span>
                  </button>
                )}

                {deliveryStatus === 'IN_TRANSIT' && (
                  <>
                    <button
                      onClick={() => onWaybillStateTransition('FAIL')}
                      className="px-3.5 py-2.5 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      <AlertOctagon className="w-4 h-4" />
                    </button>
                    {hasPermission('waybill:complete') && (
                      <button
                        onClick={() => onWaybillStateTransition('COMPLETE')}
                        className="px-5 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black shadow-lg flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Delivery</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
