import React, { useState } from 'react';
import api from '../services/api';

interface BatchWaybillModalProps {
  selectedInvoiceIds: string[];
  onSuccess: (manifest: any) => void;
  onClose: () => void;
}

export const BatchWaybillModal: React.FC<BatchWaybillModalProps> = ({
  selectedInvoiceIds,
  onSuccess,
  onClose,
}) => {
  const [deliveryZone, setDeliveryZone] = useState('LAGOS-EPE-ZONE-A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/waybills/batch', {
        invoiceIds: selectedInvoiceIds,
        deliveryZone,
      });
      onSuccess(response.data?.data ?? response.data);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to generate batch waybill manifest.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Generate Master Waybill Manifest</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Consolidating {selectedInvoiceIds.length} selected invoice(s) into a bulk delivery
          manifest.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Delivery Zone / Route
          </label>
          <select
            value={deliveryZone}
            onChange={(e) => setDeliveryZone(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-emerald-500 outline-none"
          >
            <option value="LAGOS-EPE-ZONE-A">Epe Commercial District (Zone A)</option>
            <option value="LAGOS-LEKKI-ZONE-B">Lekki Expressway Corridor (Zone B)</option>
            <option value="LAGOS-IKEJA-ZONE-C">Ikeja Industrial Hub (Zone C)</option>
          </select>
        </div>

        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateManifest}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Confirm & Dispatch Manifest'}
          </button>
        </div>
      </div>
    </div>
  );
};

