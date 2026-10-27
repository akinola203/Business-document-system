import React, { useState } from 'react';
import { X, Truck, CheckCircle2, AlertOctagon, PackageCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

export type WaybillModalAction = 'READY' | 'DISPATCH' | 'COMPLETE' | 'FAIL';

interface WaybillStateModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: WaybillModalAction;
  waybillNumber: string;
  onConfirm: (payload: any) => Promise<void>;
  isLoading?: boolean;
}

export const WaybillStateModal: React.FC<WaybillStateModalProps> = ({
  isOpen,
  onClose,
  action,
  waybillNumber,
  onConfirm,
  isLoading = false,
}) => {
  // Dispatch form fields
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Complete form fields
  const [receivedByName, setReceivedByName] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);

  // Stage ready & Fail fields
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let payload: any = {};
    if (action === 'READY') {
      payload = { notes: notes.trim() || undefined };
    } else if (action === 'DISPATCH') {
      if (!driverName.trim() || !vehicleNumber.trim()) {
        setErrorMsg('Carrier vehicle registration and driver name are required to dispatch.');
        return;
      }
      payload = {
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim() || undefined,
        vehicleNumber: vehicleNumber.trim(),
      };
    } else if (action === 'COMPLETE') {
      if (!receivedByName.trim()) {
        setErrorMsg('Please specify the recipient name confirming cargo receipt.');
        return;
      }
      payload = {
        receivedByName: receivedByName.trim(),
        receivedDate: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
      };
    } else if (action === 'FAIL') {
      if (!failureReason.trim()) {
        setErrorMsg('A mandatory explanation for the failed delivery attempt is required.');
        return;
      }
      payload = { failureReason: failureReason.trim() };
    }

    await onConfirm(payload);
  };

  const getConfig = () => {
    switch (action) {
      case 'READY':
        return {
          title: 'Stage Consignment as Ready for Pickup',
          subtitle: `Flag ${waybillNumber} as packaged, verified in warehouse, and staged for carrier loading.`,
          icon: PackageCheck,
          btnColor: 'bg-[#5847F6] text-white',
          btnText: 'Stage as Ready',
        };
      case 'DISPATCH':
        return {
          title: 'Dispatch Cargo (In Transit)',
          subtitle: `Hand over ${waybillNumber} to the carrier driver. The consignment will transition to IN_TRANSIT.`,
          icon: Truck,
          btnColor: 'bg-[#5847F6] text-white',
          btnText: 'Confirm Dispatch',
        };
      case 'COMPLETE':
        return {
          title: 'Confirm Consignment Delivery',
          subtitle: `Record proof of delivery for ${waybillNumber} signed by the client or site receiver.`,
          icon: CheckCircle2,
          btnColor: 'bg-emerald-600 text-white',
          btnText: 'Complete Delivery',
        };
      case 'FAIL':
        return {
          title: 'Record Delivery Failure',
          subtitle: `Log delivery exception for ${waybillNumber}. Consignment will be marked FAILED and can be re-staged.`,
          icon: AlertOctagon,
          btnColor: 'bg-rose-600 text-white',
          btnText: 'Record Failure',
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-[32px] p-7 md:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#5847F6] flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{config.title}</h3>
              <p className="text-xs font-mono font-bold text-slate-500 tabular-nums">{waybillNumber}</p>
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

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {action === 'READY' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Staging Location / Warehouse Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Staged at Bay 4, wrapped on 2 wooden pallets ready for pickup."
                rows={3}
                className="w-full p-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] transition-all"
              />
            </div>
          )}

          {action === 'DISPATCH' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. AAA-123-XY or KJA-994-LG"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Driver / Haulage Carrier Name *
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Ibrahim Musa"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Driver Telephone Contact
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="e.g. +234 803 000 0000"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>
            </div>
          )}

          {action === 'COMPLETE' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Received By (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={receivedByName}
                  onChange={(e) => setReceivedByName(e.target.value)}
                  placeholder="e.g. Chinedu Okafor (Site Supervisor)"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Delivery Receipt Date
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>
            </div>
          )}

          {action === 'FAIL' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Mandatory Failure Reason / Incident Report *
              </label>
              <textarea
                required
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g. Consignee warehouse closed on arrival, or access road flooded."
                rows={3}
                className="w-full p-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
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
                config.btnColor,
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>{config.btnText}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
