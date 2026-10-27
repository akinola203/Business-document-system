import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SupplyItem } from '../../types';
import { X, Layers, AlertCircle, Check } from 'lucide-react';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SupplyItem | null;
  onStockAdjusted?: (updatedItem: SupplyItem) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  item,
  onStockAdjusted,
}) => {
  const queryClient = useQueryClient();
  const [newStock, setNewStock] = useState<string>(item ? String(item.currentStock) : '0');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (item) {
      setNewStock(String(item.currentStock));
    }
  }, [item]);

  const adjustMutation = useMutation({
    mutationFn: async (stock: number) => {
      if (!item) return;
      const res = await apiClient.patch(`/supplies/items/${item.id}`, { currentStock: stock });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplies-items'] });
      if (onStockAdjusted && data) {
        onStockAdjusted(data);
      }
      onClose();
    },
    onError: () => {
      if (item && onStockAdjusted) {
        onStockAdjusted({
          ...item,
          currentStock: Number(newStock) || 0,
        });
      }
      onClose();
    },
  });

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(Number(newStock)) || Number(newStock) < 0) {
      setErrorMessage('Please enter a valid non-negative stock quantity');
      return;
    }
    adjustMutation.mutate(Number(newStock));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Adjust Inventory Stock</h2>
              <p className="text-[11px] text-slate-500 font-medium">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-slate-500">Current Logged Stock:</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {item.currentStock} {item.unit}
              </span>
            </div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Verified Physical Stock ({item.unit})
            </label>
            <input
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjustMutation.isPending}
              className="px-5 py-2 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-md shadow-indigo-500/25 flex items-center gap-1.5"
            >
              {adjustMutation.isPending ? 'Updating...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
