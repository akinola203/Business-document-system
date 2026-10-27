import React, { useState } from 'react';
import { Vendor, SupplyItem, SupplyOrder } from '../../../types';
import { formatCurrency } from '../../../lib/utils';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Package,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Truck,
} from 'lucide-react';

interface VendorDetailInspectorProps {
  vendor: Vendor | null;
  items?: SupplyItem[];
  orders?: SupplyOrder[];
  onRecordSupply?: (vendor: Vendor) => void;
  onEditVendor?: (vendor: Vendor) => void;
}

export const VendorDetailInspector: React.FC<VendorDetailInspectorProps> = ({
  vendor,
  items = [],
  orders = [],
  onRecordSupply,
  onEditVendor,
}) => {
  const [copiedAccount, setCopiedAccount] = useState(false);

  if (!vendor) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Building2 className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
        <p className="text-sm font-semibold text-slate-300">Select a vendor profile</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Click any vendor or supplier from the directory to inspect corporate registration, bank settlement details, catalog items, and supply orders.
        </p>
      </div>
    );
  }

  // Filter vendor-linked items and orders
  const vendorItems = items.filter(
    (it) => it.preferredVendorId === vendor.id || (vendor.items && vendor.items.some((vi) => vi.id === it.id))
  );

  const vendorOrders = orders.filter(
    (o) => o.vendorId === vendor.id || (vendor.orders && vendor.orders.some((vo) => vo.id === o.id))
  );

  const initials = vendor.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const handleCopyAccount = () => {
    if (vendor.bankAccountNumber) {
      navigator.clipboard.writeText(vendor.bankAccountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between space-y-6">
      <div className="space-y-6">
        {/* =====================================================================
            TOP HEADER: ROYAL INDIGO GLASSMORPHIC INSPECTOR CARD (#5B58B6)
        ===================================================================== */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden border border-indigo-400/20">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-white font-black text-base shadow-inner">
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  {vendor.name}
                </h1>
                <p className="text-xs text-indigo-200 mt-0.5 font-medium flex items-center gap-2">
                  <span>Contact: <strong className="text-white">{vendor.contactPerson || 'General Procurement'}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md ${
                vendor.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
              }`}>
                {vendor.status}
              </span>
              <span className="text-xs font-mono text-indigo-200">{vendor.vendorCode}</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-indigo-200 text-[11px]">Total Supplied Value</span>
              <p className="text-lg font-black text-white tabular-nums mt-0.5">
                {formatCurrency(Number(vendor.totalSuppliedAmount) || 0, vendor.currency || 'NGN')}
              </p>
            </div>
            <div>
              <span className="text-indigo-200 text-[11px]">Outstanding Payable</span>
              <p className="text-lg font-black text-amber-300 tabular-nums mt-0.5">
                {formatCurrency(Number(vendor.outstandingPayable) || 0, vendor.currency || 'NGN')}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            PAYOUT BANK DETAILS & SETTLEMENT
        ===================================================================== */}
        <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-white tracking-tight">
                Payout Bank Settlement Details
              </h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {vendor.paymentTerms || 'NET 30'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400">Beneficiary Bank</span>
              <p className="font-semibold text-slate-200 mt-0.5 truncate">
                {vendor.bankName || 'Not Set'}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Account Name</span>
              <p className="font-semibold text-slate-200 mt-0.5 truncate">
                {vendor.bankAccountName || vendor.name}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Account Number</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {vendor.bankAccountNumber || '—'}
                </span>
                {vendor.bankAccountNumber && (
                  <button
                    onClick={handleCopyAccount}
                    title="Copy Account Number"
                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedAccount ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Settlement Currency</span>
              <p className="font-semibold text-slate-200 mt-0.5">
                {vendor.currency || 'NGN'}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            COMMERCIAL CREDENTIALS & LOCATION
        ===================================================================== */}
        <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white tracking-tight">
              Corporate & Tax Registration
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400">RC / Registration</span>
              <p className="font-mono font-bold text-slate-200 mt-0.5">{vendor.registrationNumber || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">TIN (Tax ID)</span>
              <p className="font-mono font-bold text-slate-200 mt-0.5">{vendor.taxId || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Category</span>
              <p className="font-bold text-indigo-400 mt-0.5">{vendor.category.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
            {vendor.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{vendor.phone}</span>
              </div>
            )}
            {vendor.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{vendor.email}</span>
              </div>
            )}
            {vendor.address && (
              <div className="flex items-center gap-2 col-span-2">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{vendor.address}, {vendor.city || ''} {vendor.state || ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            ASSIGNED CATALOG ITEMS
        ===================================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-white">
                Catalog Items Supplied ({vendorItems.length})
              </h2>
            </div>
          </div>

          {vendorItems.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#191B22] border border-slate-800 text-center text-xs text-slate-500">
              No catalog items linked to this supplier yet.
            </div>
          ) : (
            <div className="space-y-2">
              {vendorItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#191B22] border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        {item.sku}
                      </span>
                      <span className="font-bold text-slate-200">{item.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Supply Cost: {formatCurrency(Number(item.unitCost), 'NGN')} / {item.unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Stock Level</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {Number(item.currentStock).toLocaleString()} {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =====================================================================
            SUPPLY HISTORY / RECENT ORDERS
        ===================================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-white">
                Recent Supply Deliveries ({vendorOrders.length})
              </h2>
            </div>
          </div>

          {vendorOrders.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#191B22] border border-slate-800 text-center text-xs text-slate-500">
              No purchase receipts or delivery records logged.
            </div>
          ) : (
            <div className="space-y-2">
              {vendorOrders.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl bg-[#191B22] border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">{order.supplyNumber}</span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        order.status === 'RECEIVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Ref: {order.deliveryRef || 'None'} • {new Date(order.supplyDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white tabular-nums">
                      {formatCurrency(Number(order.grandTotal), order.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          BOTTOM ACTION PILLS
      ===================================================================== */}
      <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
        {onRecordSupply && (
          <button
            onClick={() => onRecordSupply(vendor)}
            className="flex-1 py-2.5 px-4 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Incoming Supply</span>
          </button>
        )}
        {onEditVendor && (
          <button
            onClick={() => onEditVendor(vendor)}
            className="py-2.5 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            Edit Profile
          </button>
        )}
      </div>
    </div>
  );
};
