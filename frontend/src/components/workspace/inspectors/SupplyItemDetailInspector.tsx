import React from 'react';
import { SupplyItem } from '../../../types';
import { formatCurrency } from '../../../lib/utils';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Building2,
  TrendingUp,
  DollarSign,
  Layers,
  SlidersHorizontal,
  ShieldCheck,
  Tag,
} from 'lucide-react';

interface SupplyItemDetailInspectorProps {
  item: SupplyItem | null;
  onAdjustStock?: (item: SupplyItem) => void;
}

export const SupplyItemDetailInspector: React.FC<SupplyItemDetailInspectorProps> = ({
  item,
  onAdjustStock,
}) => {
  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Package className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
        <p className="text-sm font-semibold text-slate-300">Select a catalog item</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Click any product or material from the directory to inspect margin analysis, inventory thresholds, and sourcing partners.
        </p>
      </div>
    );
  }

  const isLowStock = Number(item.currentStock) <= Number(item.reorderLevel);
  const cost = Number(item.unitCost) || 0;
  const price = Number(item.sellingPrice) || 0;
  const unitProfit = Math.max(0, price - cost);
  const marginPercent = price > 0 ? ((price - cost) / price) * 100 : 0;
  const totalValuation = Number(item.currentStock) * cost;

  // Stock health ratio
  const stockRatio = item.reorderLevel > 0 
    ? Math.min(100, Math.round((Number(item.currentStock) / (Number(item.reorderLevel) * 3)) * 100))
    : 100;

  return (
    <div className="h-full flex flex-col justify-between space-y-6">
      <div className="space-y-6">
        {/* =====================================================================
            TOP HEADER: ROYAL INDIGO GLASSMORPHIC ITEM INSPECTOR (#5B58B6)
        ===================================================================== */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden border border-indigo-400/20">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-black text-indigo-100 bg-white/20 px-2.5 py-0.5 rounded-lg border border-white/20 backdrop-blur-md">
                  {item.sku}
                </span>
                <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
                  {item.category?.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                {item.name}
              </h1>
              {item.description && (
                <p className="text-xs text-indigo-200 mt-1 max-w-sm line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5 ${
                isLowStock
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
              }`}
            >
              {isLowStock ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{isLowStock ? 'Low Stock Alert' : 'Stock Adequate'}</span>
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-indigo-200 text-[11px]">Warehouse Stock</span>
              <p className="text-xl font-black text-white tabular-nums mt-0.5">
                {Number(item.currentStock).toLocaleString()} <span className="text-xs font-normal text-indigo-200">{item.unit}</span>
              </p>
            </div>
            <div>
              <span className="text-indigo-200 text-[11px]">Default Invoice Price</span>
              <p className="text-xl font-black text-emerald-300 tabular-nums mt-0.5">
                {formatCurrency(price, 'NGN')}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            FINANCIAL MARGIN & PRICING ANALYSIS
        ===================================================================== */}
        <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white tracking-tight">
                Commercial Margin & Unit Economics
              </h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              +{marginPercent.toFixed(1)}% Gross Margin
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Vendor Supply Cost</span>
              <p className="font-mono font-bold text-slate-300 mt-0.5 tabular-nums">
                {formatCurrency(cost, 'NGN')}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Customer Selling Price</span>
              <p className="font-mono font-bold text-emerald-400 mt-0.5 tabular-nums">
                {formatCurrency(price, 'NGN')}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Unit Gross Profit</span>
              <p className="font-mono font-black text-white mt-0.5 tabular-nums">
                +{formatCurrency(unitProfit, 'NGN')}
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================================
            INVENTORY TELEMETRY & REORDER THRESHOLD
        ===================================================================== */}
        <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-white tracking-tight">
                Inventory Stock Telemetry
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Min Threshold: {item.reorderLevel} {item.unit}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Stock Buffer</span>
              <span className="font-bold text-white tabular-nums">
                {Number(item.currentStock).toLocaleString()} / {item.reorderLevel * 2} {item.unit}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(5, stockRatio)}%` }}
              />
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Inventory Value:</span>
              <span className="font-mono font-bold text-white tabular-nums">
                {formatCurrency(totalValuation, 'NGN')}
              </span>
            </div>
          </div>
        </div>

        {/* =====================================================================
            PREFERRED SOURCING VENDOR
        ===================================================================== */}
        <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Building2 className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-bold text-white tracking-tight">
              Preferred Sourcing Supplier
            </h2>
          </div>

          {item.preferredVendor ? (
            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <span className="font-bold text-white block">{item.preferredVendor.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Code: {item.preferredVendor.vendorCode}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[10px] font-bold border border-purple-500/20">
                Primary Contractor
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-1">
              No designated primary vendor assigned (Open Sourcing).
            </p>
          )}
        </div>
      </div>

      {/* =====================================================================
          BOTTOM ACTION PILL
      ===================================================================== */}
      {onAdjustStock && (
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => onAdjustStock(item)}
            className="w-full py-2.5 px-4 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Adjust Inventory Stock</span>
          </button>
        </div>
      )}
    </div>
  );
};
