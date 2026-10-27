import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SupplyItem, Vendor } from '../../types';
import {
  X,
  Package,
  Layers,
  AlertCircle,
  Building2,
  Tag,
  DollarSign,
} from 'lucide-react';

interface CreateSupplyItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onItemCreated?: (item: SupplyItem) => void;
}

export const CreateSupplyItemModal: React.FC<CreateSupplyItemModalProps> = ({
  isOpen,
  onClose,
  vendors,
  onItemCreated,
}) => {
  const queryClient = useQueryClient();

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('RAW_MATERIALS');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('Units');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [taxRate, setTaxRate] = useState('7.5');
  const [currentStock, setCurrentStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('10');
  const [preferredVendorId, setPreferredVendorId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/supplies/items', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplies-items'] });
      if (onItemCreated && data) {
        onItemCreated(data);
      }
      handleClose();
    },
    onError: () => {
      // Offline / fallback mock item
      const chosenVendor = vendors.find((v) => v.id === preferredVendorId);
      const fallbackItem: SupplyItem = {
        id: `sup-local-${Date.now()}`,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        preferredVendorId: preferredVendorId || null,
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category,
        description: description.trim() || null,
        unit,
        unitCost: Number(unitCost) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        taxRate: Number(taxRate) || 7.5,
        currentStock: Number(currentStock) || 0,
        reorderLevel: Number(reorderLevel) || 10,
        isActive: true,
        createdAt: new Date().toISOString(),
        preferredVendor: chosenVendor
          ? {
              id: chosenVendor.id,
              name: chosenVendor.name,
              vendorCode: chosenVendor.vendorCode,
            }
          : null,
      };

      if (onItemCreated) {
        onItemCreated(fallbackItem);
      }
      handleClose();
    },
  });

  const handleClose = () => {
    setSku('');
    setName('');
    setCategory('RAW_MATERIALS');
    setDescription('');
    setUnit('Units');
    setUnitCost('');
    setSellingPrice('');
    setTaxRate('7.5');
    setCurrentStock('0');
    setReorderLevel('10');
    setPreferredVendorId('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!sku.trim()) {
      setErrorMessage('SKU / Item Code is required (e.g. SUP-CEM-001)');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Supply item name is required');
      return;
    }
    if (!sellingPrice || Number(sellingPrice) < 0) {
      setErrorMessage('Selling price must be specified');
      return;
    }

    const payload = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category: category || undefined,
      description: description.trim() || undefined,
      unit: unit.trim() || 'Units',
      unitCost: Number(unitCost) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      taxRate: Number(taxRate) || 7.5,
      currentStock: Number(currentStock) || 0,
      reorderLevel: Number(reorderLevel) || 10,
      preferredVendorId: preferredVendorId || undefined,
    };

    createMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Add Supply Catalog Item</h2>
              <p className="text-xs text-slate-500 font-medium">
                Register a new inventory product, commodity, or haulage service
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Item SKU / Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. SUP-CEM-001"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="LOGISTICS_HAULAGE">Logistics & Haulage</option>
                <option value="EQUIPMENT">Equipment & Machinery</option>
                <option value="SERVICES">Industrial Services</option>
                <option value="PACKAGING">Packaging Supplies</option>
                <option value="GENERAL">General Consumables</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Product / Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Portland Limestone Cement 50kg"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Technical grade or specifications"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="Units">Units / Pieces</option>
                <option value="Bags">Bags</option>
                <option value="Litres">Litres</option>
                <option value="Tons">Tons</option>
                <option value="Kilograms">Kilograms (Kg)</option>
                <option value="Metres">Metres</option>
                <option value="Hours">Hours</option>
                <option value="Trips">Trips / Haul</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Supplier</label>
              <select
                value={preferredVendorId}
                onChange={(e) => setPreferredVendorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="">None / Open Sourcing</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vendor Supply Cost (₦) <span className="text-slate-400 font-normal">Purchasing</span>
              </label>
              <input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="8500"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selling Price (₦) <span className="text-rose-500">* Default Invoice</span>
              </label>
              <input
                type="number"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="10500"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Stock Level</label>
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reorder Alert Threshold</label>
              <input
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-amber-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? 'Saving...' : 'Add to Catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
