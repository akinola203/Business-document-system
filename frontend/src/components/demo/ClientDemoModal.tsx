import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  FileText,
  Truck,
  Mail,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Receipt,
  ExternalLink,
} from 'lucide-react';

interface ClientDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDemoModal: React.FC<ClientDemoModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLaunchPreset = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto a4-scroll animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#16181F] border border-slate-800 flex items-center justify-center text-white shadow-xl shadow-indigo-500/10 shrink-0">
            <Sparkles className="w-7 h-7 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                ⚡ Showcase Demo
              </span>
              <span className="text-[10px] font-bold text-slate-400">Phase-7 B2B Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              1-Click Client Showcase Mode
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Demonstrate AOA 77 with realistic enterprise corporate clients, line items, and instant A4 print outputs.
            </p>
          </div>
        </div>

        {/* Section 1: 1-Click Builder Presets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5847F6]" />
              <span>Instant Document Studios (Pre-Filled Nigerian B2B Samples)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Invoice Preset Card */}
            <div
              onClick={() => handleLaunchPreset('/documents/invoices/new?preset=diesel')}
              className="group p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-white border border-indigo-100 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-[#5847F6] text-white flex items-center justify-center mb-3 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#5847F6] transition-colors leading-tight">
                  AGO Diesel Bulk Supply
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  45,000L Industrial Diesel, Tanker Haulage, Globus Bank NUBAN, 7.5% VAT.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-indigo-100/60 flex items-center justify-between text-xs font-bold text-[#5847F6]">
                <span>Load Invoice Preset</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Waybill Preset Card */}
            <div
              onClick={() => handleLaunchPreset('/documents/waybills/new?preset=cement')}
              className="group p-4 rounded-2xl bg-gradient-to-br from-sky-50/70 to-white border border-sky-100 hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/10 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-3 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                  <Truck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-tight">
                  Cement & Rebar Haulage
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  600 Bags Elephant Cement, GPS Mack 40-Tonne tractor, 3 signature blocks.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-sky-100/60 flex items-center justify-between text-xs font-bold text-sky-700">
                <span>Load Waybill Preset</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Letter Preset Card */}
            <div
              onClick={() => handleLaunchPreset('/documents/letters/new?preset=tender')}
              className="group p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-100 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                  Tender Commitment Letter
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Formal Board letterhead to Flour Mills / Dangote Procurement Directorate.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-100/60 flex items-center justify-between text-xs font-bold text-emerald-700">
                <span>Load Letter Preset</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Corporate Client Showcase & Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Sample Clients */}
          <div className="p-4 rounded-2xl bg-[#F8F9FC] border border-slate-200/80">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Sample Corporate Clients</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Dangote Industries Limited</div>
                  <div className="text-[10px] text-slate-500">TIN: 10023456-0001 &bull; RC-124901</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchPreset('/clients')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                >
                  View Client
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Flour Mills of Nigeria Plc</div>
                  <div className="text-[10px] text-slate-500">Apapa Wharf Terminal &bull; Active Partner</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchPreset('/clients')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                >
                  View Client
                </button>
              </div>
            </div>
          </div>

          {/* Instant Metrics Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#16181F] to-slate-900 text-white flex flex-col justify-between border border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Executive Telemetry
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synced
                </span>
              </div>
              <div className="text-2xl font-black tracking-tight text-white tabular-nums">
                ₦8,450,000.00
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total Settled Collections &bull; 94.2% Cash Recovery Rate
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-white/70">
                Action Required: <strong>2 Invoices</strong> &bull; <strong>1 Waybill</strong>
              </span>
              <button
                type="button"
                onClick={() => handleLaunchPreset('/overview')}
                className="px-3 py-1.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-[11px] font-bold shadow-md shadow-indigo-500/25 flex items-center gap-1"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Phase-7 Production Integrity Verified</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
