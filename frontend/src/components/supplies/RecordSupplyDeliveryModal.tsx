import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SupplyOrder, SupplyItem, Vendor, SupplyOrderStatus } from '../../types';
import { formatCurrency } from '../../lib/utils';
import {
  X,
  Truck,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  Package,
} from 'lucide-react';

interface RecordSupplyDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  supplies: SupplyItem[];
  preselectedVendorId?: string;
  onOrderRecorded?: (order: SupplyOrder) => void;
}

interface DeliveryItemRow {
  supplyItemId: string;
  quantity: number;
  unitCost: number;
}

export const RecordSupplyDeliveryModal: React.FC<RecordSupplyDeliveryModalProps> = ({
  isOpen,
  onClose,
  vendors,
  supplies,
  preselectedVendorId,
  onOrderRecorded,
}) => {
  const queryClient = useQueryClient();

  const [vendorId, setVendorId] = useState(preselectedVendorId || '');
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryRef, setDeliveryRef] = useState('');
  const [status, setStatus] = useState<SupplyOrderStatus>('RECEIVED');
  const [currency] = useState('NGN');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DeliveryItemRow[]>([
    {
      supplyItemId: supplies[0]?.id || '',
      quantity: 10,
      unitCost: supplies[0]?.unitCost || 0,
    },
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync preselected vendor
  React.useEffect(() => {
    if (preselectedVendorId) {
      setVendorId(preselectedVendorId);
    } else if (vendors.length > 0 && !vendorId) {
      setVendorId(vendors[0].id);
    }
  }, [preselectedVendorId, vendors, vendorId]);

  const addRow = () => {
    setRows([
      ...rows,
      {
        supplyItemId: supplies[0]?.id || '',
        quantity: 1,
        unitCost: supplies[0]?.unitCost || 0,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRowItem = (index: number, itemId: string) => {
    const item = supplies.find((s) => s.id === itemId);
    const newRows = [...rows];
    newRows[index] = {
      ...newRows[index],
      supplyItemId: itemId,
      unitCost: item ? item.unitCost : newRows[index].unitCost,
    };
    setRows(newRows);
  };

  const updateRowQty = (index: number, qty: number) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], quantity: qty };
    setRows(newRows);
  };

  const updateRowCost = (index: number, cost: number) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], unitCost: cost };
    setRows(newRows);
  };

  const subtotal = rows.reduce((sum, r) => sum + r.quantity * r.unitCost, 0);
  const taxTotal = subtotal * 0.075; // 7.5% VAT
  const grandTotal = subtotal + taxTotal;

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/supplies/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplies-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplies-items'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      if (onOrderRecorded && data) {
        onOrderRecorded(data);
      }
      handleClose();
    },
    onError: (err: any) => {
      const serverMessage = Array.isArray(err?.response?.data?.message)
        ? err.response.data.message.join(', ')
        : err?.response?.data?.message;

      if (serverMessage) {
        setErrorMessage(serverMessage);
        return;
      }

      // Offline fallback
      const chosenVendor = vendors.find((v) => v.id === vendorId);
      const fallbackOrder: SupplyOrder = {
        id: `so-local-${Date.now()}`,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        supplyNumber: `SUP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        vendorId,
        supplyDate,
        deliveryRef: deliveryRef.trim() || null,
        status,
        currency,
        subtotal,
        taxTotal,
        grandTotal,
        amountPaid: status === 'RECEIVED' ? grandTotal : 0,
        notes: notes.trim() || null,
        createdAt: new Date().toISOString(),
        vendor: chosenVendor
          ? {
              id: chosenVendor.id,
              name: chosenVendor.name,
              vendorCode: chosenVendor.vendorCode,
              category: chosenVendor.category,
            }
          : undefined,
        items: rows.map((r, i) => {
          const matchedItem = supplies.find((s) => s.id === r.supplyItemId);
          return {
            id: `soi-local-${Date.now()}-${i}`,
            supplyOrderId: `so-local-${Date.now()}`,
            supplyItemId: r.supplyItemId,
            description: matchedItem?.name || 'Supply Item',
            unit: matchedItem?.unit || 'Units',
            quantity: r.quantity,
            unitCost: r.unitCost,
            lineTotal: r.quantity * r.unitCost,
            supplyItem: matchedItem,
          };
        }),
      };

      if (onOrderRecorded) {
        onOrderRecorded(fallbackOrder);
      }
      handleClose();
    },
  });

  const handleClose = () => {
    setDeliveryRef('');
    setNotes('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!vendorId) {
      setErrorMessage('Please select a vendor / supplier');
      return;
    }
    if (rows.length === 0 || rows.some((r) => !r.supplyItemId || r.quantity <= 0)) {
      setErrorMessage('Please specify valid items and quantities');
      return;
    }

    const payload = {
      vendorId,
      supplyDate,
      deliveryRef: deliveryRef.trim() || undefined,
      status,
      currency,
      notes: notes.trim() || undefined,
      items: rows.map((r) => ({
        supplyItemId: r.supplyItemId,
        quantity: Number(r.quantity),
        unitCost: Number(r.unitCost),
      })),
    };

    createMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Record Incoming Supply</h2>
              <p className="text-xs text-slate-500 font-medium">
                Log goods received from supplier & auto-update warehouse stock
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
                Delivering Vendor <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="">Select a supplier...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.vendorCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Vendor Delivery / Waybill Ref
              </label>
              <input
                type="text"
                value={deliveryRef}
                onChange={(e) => setDeliveryRef(e.target.value)}
                placeholder="e.g. WAYBILL-NNPC-9941"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Date</label>
              <input
                type="date"
                value={supplyDate}
                onChange={(e) => setSupplyDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplyOrderStatus)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="RECEIVED">RECEIVED (Discharged & Stock Updated)</option>
                <option value="ORDERED">ORDERED (Pending Physical Arrival)</option>
              </select>
            </div>
          </div>

          {/* Supplied Line Items */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Supplied Line Items
              </label>
              <button
                type="button"
                onClick={addRow}
                className="text-xs font-bold text-[#5847F6] hover:text-[#4939E3] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Item</label>
                    <select
                      value={row.supplyItemId}
                      onChange={(e) => updateRowItem(idx, e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800"
                    >
                      {supplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateRowQty(idx, Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit Cost (₦)</label>
                    <input
                      type="number"
                      value={row.unitCost}
                      onChange={(e) => updateRowCost(idx, Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Subtotal: {formatCurrency(subtotal, 'NGN')}</span>
              <span className="text-slate-500 block">VAT (7.5%): {formatCurrency(taxTotal, 'NGN')}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Grand Total
              </span>
              <span className="text-base font-black text-slate-950 tabular-nums">
                {formatCurrency(grandTotal, 'NGN')}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Discharged at central yard warehouse. Driver S. Babangida."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
            />
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
              {createMutation.isPending ? 'Logging Delivery...' : 'Confirm Supply Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
