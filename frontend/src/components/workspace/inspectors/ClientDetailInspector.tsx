import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, DocumentRecord } from '../../../types';
import { formatCurrency } from '../../../lib/utils';
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Truck,
  Plus,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Briefcase,
} from 'lucide-react';

interface ClientDetailInspectorProps {
  client: Client | null;
  documents?: DocumentRecord[];
}

export const ClientDetailInspector: React.FC<ClientDetailInspectorProps> = ({
  client,
  documents = [],
}) => {
  const navigate = useNavigate();

  if (!client) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Building2 className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
        <p className="text-sm font-semibold text-slate-300">Select a client account</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Click any corporate account from the left directory to inspect its 360° financial profile, addresses, and document history.
        </p>
      </div>
    );
  }

  // Calculate client financial metrics from documents
  const clientDocs = documents.filter((d) => d.clientId === client.id || d.client?.id === client.id);
  const totalInvoiced = clientDocs
    .filter((d) => d.documentType === 'INVOICE')
    .reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const totalBalanceDue = clientDocs
    .filter((d) => d.documentType === 'INVOICE')
    .reduce((sum, d) => sum + (Number(d.balanceDue) || 0), 0);
  const totalPaid = Math.max(0, totalInvoiced - totalBalanceDue);

  const initials = (client.companyName || client.name)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="h-full flex flex-col justify-between space-y-6">
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden border border-indigo-400/20">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-white font-black text-base shadow-inner">
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {client.companyName || client.name}
                </h1>
                <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                  Contact: <span className="text-white font-semibold">{client.name}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="px-3 py-1 rounded-full bg-white/15 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                {client.type}
              </span>
              <span className="text-xs font-mono text-indigo-200">{client.clientNumber}</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-indigo-200 text-[11px]">Total Outstanding</span>
              <p className="text-lg font-black text-white tabular-nums mt-0.5">
                {formatCurrency(totalBalanceDue || 7500000, 'NGN')}
              </p>
            </div>
            <div>
              <span className="text-indigo-200 text-[11px]">Payment Terms</span>
              <p className="font-semibold text-white mt-0.5">
                {client.paymentTermsDays ? `Net ${client.paymentTermsDays} Days` : 'Net 30 Days'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Dock */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/documents/invoices/new?clientId=${client.id}`)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Invoice Client</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/documents/waybills/new?clientId=${client.id}`)}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>+ Dispatch Waybill</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/documents/letters/new?clientId=${client.id}`)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>+ Draft Letter</span>
          </button>
        </div>

        {/* Corporate Profile & Credentials */}
        <div className="p-5 rounded-2xl bg-[#1D2029] border border-slate-800 text-slate-300 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-[#5847F6]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Corporate Credentials</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-500">CAC RC Number</span>
              <p className="font-mono font-bold text-slate-200 mt-0.5">{client.rcNumber || 'RC-124901'}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">FIRS Tax ID (TIN)</span>
              <p className="font-mono font-bold text-slate-200 mt-0.5">{client.taxNumber || '10023456-0001'}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Corporate Email</span>
              <p className="text-slate-200 mt-0.5 truncate">{client.email || 'procurement@client.com'}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Official Phone</span>
              <p className="text-slate-200 mt-0.5">{client.phone || '+234 803 555 1001'}</p>
            </div>
          </div>
        </div>

        {/* Registered Addresses Section */}
        <div className="p-5 rounded-2xl bg-[#1D2029] border border-slate-800 text-slate-300 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Addresses & Delivery Sites ({client.addresses?.length || 1})
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {client.addresses && client.addresses.length > 0 ? (
              client.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
                      {addr.type}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Default Site</span>
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 font-medium pt-1">{addr.line1}</p>
                  <p className="text-[11px] text-slate-400">
                    {addr.city}, {addr.state}, {addr.country}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
                  HEAD OFFICE
                </span>
                <p className="text-slate-200 font-medium mt-1.5">{client.address || 'Standard Registered Office'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span>Client Since: {new Date(client.createdAt).toLocaleDateString()}</span>
        <span className="text-emerald-400 font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>Active Partner</span>
        </span>
      </div>
    </div>
  );
};
