import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SupplyItem } from '../../types';
import { DEMO_SUPPLIES } from '../../lib/mock-data';
import { formatCurrency } from '../../lib/utils';
import {
  X,
  Package,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface CatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: SupplyItem) => void;
}

export const CatalogPickerModal: React.FC<CatalogPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const { data: suppliesData } = useQuery<{ items?: SupplyItem[]; data?: SupplyItem[] }>({
    queryKey: ['supplies-items'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/supplies/items', { params: { limit: 100 } });
        return res.data;
      } catch {
        return { items: DEMO_SUPPLIES };
      }
    },
  });

  const allSupplies: SupplyItem[] =
    suppliesData?.items && suppliesData.items.length > 0
      ? suppliesData.items
      : suppliesData?.data && suppliesData.data.length > 0
      ? suppliesData.data
      : DEMO_SUPPLIES;

  const filteredItems = useMemo(() => {
    return allSupplies.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        return matchesSku || matchesName || matchesDesc;
      }

      return true;
    });
  }, [allSupplies, categoryFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/80 max-h-[85vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                📦 Pick from Supplies Catalog
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                1-Click auto-fill line item description, unit price, measurement unit & VAT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU code (e.g. SUP-CEM-001) or item name..."
              className="w-full pl-9 pr-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['ALL', 'RAW_MATERIALS', 'LOGISTICS_HAULAGE', 'EQUIPMENT', 'SERVICES'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#16181F] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Items Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No matching catalog items found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try another search keyword.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isLow = item.currentStock <= item.reorderLevel;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item);
                    onClose();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs">
                        {item.sku}
                      </span>
                      <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-[#5847F6] transition-colors">
                        {item.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Unit: <strong className="text-slate-700">{item.unit}</strong></span>
                      <span>•</span>
                      <span>
                        Stock: <strong className={isLow ? 'text-amber-600' : 'text-emerald-600'}>
                          {item.currentStock} {item.unit}
                        </strong>
                      </span>
                      {item.preferredVendor && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[150px]">{item.preferredVendor.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold">Selling Price</span>
                      <span className="text-xs font-black text-slate-950 font-mono tabular-nums">
                        {formatCurrency(Number(item.sellingPrice), 'NGN')}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white group-hover:bg-[#5847F6] group-hover:text-white border border-slate-200 group-hover:border-[#5847F6] flex items-center justify-center text-slate-400 transition-all shadow-sm">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>{filteredItems.length} items cataloged</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
