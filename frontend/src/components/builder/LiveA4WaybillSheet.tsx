import React from 'react';
import { Company, Client } from '../../types';
import { formatDate } from '../../lib/utils';

export interface WaybillLiveFormValues {
  title: string;
  clientId?: string;
  shipmentDate?: string;
  originAddress: string;
  destinationAddress: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  trackingNumber?: string;
  selectedAddressId?: string;
  items: Array<{
    description: string;
    quantity: number | string;
    unit: string;
    weightKg?: number | string;
    packageCount?: number | string;
    packageType?: string;
  }>;
}

interface LiveA4WaybillSheetProps {
  formValues: WaybillLiveFormValues;
  company?: Company | null;
  selectedClient?: Client | null;
  documentNumber?: string | null;
}

export const LiveA4WaybillSheet: React.FC<LiveA4WaybillSheetProps> = ({
  formValues,
  company,
  selectedClient,
  documentNumber,
}) => {
  const items = formValues.items || [];

  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const totalPackages = items.reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
  const totalWeight = items.reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);

  return (
    <div className="aspect-[1/1.414] w-full max-w-[680px] bg-white text-slate-900 shadow-2xl rounded-sm p-8 md:p-10 overflow-hidden text-left relative flex flex-col justify-between border border-slate-200">
      {/* 1. Header & Identity */}
      <div>
        <div className="flex justify-between items-start pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {company?.name || 'AOA 77 COMPANY LTD'}
            </h2>
            {company?.rcNumber && (
              <p className="text-[11px] font-mono text-slate-500 font-semibold mt-0.5">
                RC: {company.rcNumber}
              </p>
            )}
            <p className="text-[11px] text-slate-600 max-w-xs mt-1 leading-snug">
              {company?.address || '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria'}
            </p>
            {company?.phone && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Tel: <span className="font-semibold">{company.phone}</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <h1 className="text-xl md:text-2xl font-black text-sky-700 tracking-tight uppercase">
              WAYBILL / DELIVERY NOTE
            </h1>
            <p className="text-xs font-mono font-bold text-slate-700 mt-1">
              {documentNumber ? `#${documentNumber}` : 'AUTO-GENERATED ON SAVE'}
            </p>
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400">Shipment Date: </span>
                <span className="font-semibold">{formatDate(formValues.shipmentDate || new Date().toISOString())}</span>
              </div>
              {formValues.trackingNumber && (
                <div>
                  <span className="text-slate-400">Tracking Ref: </span>
                  <span className="font-mono font-bold text-slate-800">{formValues.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Dispatch Routing & Logistics Carrier Strip */}
        <div className="grid grid-cols-2 gap-4 my-5 text-xs">
          {/* Origin / Consignor */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Origin (Consignor Loading Bay)
            </span>
            <div className="font-bold text-slate-800 text-[11px]">
              {company?.name || 'AOA 77 COMPANY LTD'}
            </div>
            <div className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
              {formValues.originAddress || company?.address || 'Warehouse Loading Depot, Ota'}
            </div>
          </div>

          {/* Destination / Consignee */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Destination (Consignee Delivery Site)
            </span>
            <div className="font-bold text-slate-800 text-[11px]">
              {selectedClient?.companyName || selectedClient?.name || 'Consignee Entity'}
            </div>
            <div className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
              {formValues.destinationAddress || 'Client Site / Destination Address'}
            </div>
          </div>
        </div>

        {/* Carrier Telemetry Bar */}
        <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100 flex flex-wrap items-center justify-between text-xs mb-5">
          <div>
            <span className="text-sky-600 text-[10px] font-bold uppercase tracking-wider block">
              Haulage Vehicle
            </span>
            <span className="font-mono font-bold text-slate-900 text-[11px]">
              {formValues.vehicleNumber || 'Unassigned / Customer Pickup'}
            </span>
          </div>

          <div>
            <span className="text-sky-600 text-[10px] font-bold uppercase tracking-wider block">
              Driver Full Name
            </span>
            <span className="font-semibold text-slate-900 text-[11px]">
              {formValues.driverName || 'Designated Courier'}
            </span>
          </div>

          <div>
            <span className="text-sky-600 text-[10px] font-bold uppercase tracking-wider block">
              Driver Phone
            </span>
            <span className="font-mono text-slate-800 text-[11px]">
              {formValues.driverPhone || '—'}
            </span>
          </div>
        </div>

        {/* 3. Cargo Consignment Items Table */}
        <div className="overflow-hidden border border-slate-200 rounded-lg">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">Cargo Description</th>
                <th className="py-2.5 px-3 text-right">Shipped Qty</th>
                <th className="py-2.5 px-3 text-right">Packages</th>
                <th className="py-2.5 px-3 text-right">Package Type</th>
                <th className="py-2.5 px-3 text-right">Gross Wt (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                    No cargo consignment items entered.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-[220px] break-words">
                      {item.description || 'Cargo item'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                      {Number(item.quantity || 0).toLocaleString()} {item.unit || 'units'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {item.packageCount ? Number(item.packageCount).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                      {item.packageType || 'Standard'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap font-medium">
                      {item.weightKg ? Number(item.weightKg).toLocaleString(undefined, { minimumFractionDigits: 1 }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-800 text-[10px]">
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-slate-600 uppercase">
                    Cargo Manifest Totals:
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-sky-800">
                    {totalQuantity.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {totalPackages > 0 ? totalPackages.toLocaleString() : '—'}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400">—</td>
                  <td className="py-2 px-3 text-right tabular-nums font-mono">
                    {totalWeight > 0 ? `${totalWeight.toLocaleString()} kg` : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. Proof of Delivery & Formal Dispatch Signatures */}
      <div className="pt-4 mt-6 border-t border-slate-200">
        <div className="text-[10px] text-slate-500 mb-6 italic leading-relaxed">
          Goods received in sound, undamaged condition and in the specified quantities. Any damage or discrepancy must be endorsed on this document upon handover.
        </div>

        <div className="grid grid-cols-2 gap-8 text-[10px]">
          {/* Driver / Dispatched By */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider block">
              1. Dispatched By (Haulier / Driver)
            </span>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span>Driver Name:</span>
                <span className="font-semibold text-slate-800">{formValues.driverName || '__________________'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span>Signature:</span>
                <span>__________________</span>
              </div>
              <div className="flex justify-between">
                <span>Dispatch Date & Time:</span>
                <span>{formatDate(formValues.shipmentDate || new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          {/* Consignee / Received In Good Order By */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider block">
              2. Received In Good Condition (Consignee)
            </span>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span>Receiver Name:</span>
                <span>__________________</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1">
                <span>Receiver Sign & Stamp:</span>
                <span>__________________</span>
              </div>
              <div className="flex justify-between">
                <span>Handover Date & Time:</span>
                <span>____ / ____ / 2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
          <span>Official Logistics Note — {company?.name || 'AOA 77 COMPANY LTD'}</span>
          <span>Security Validated Manifest</span>
        </div>
      </div>
    </div>
  );
};
