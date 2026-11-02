import React from 'react';
import { Company, Client, TemplateLayoutConfig } from '../../types';
import { formatDate } from '../../lib/utils';
import { Truck, MapPin, Package, ShieldCheck, CheckCircle2, QrCode } from 'lucide-react';

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
  templateConfig?: Partial<TemplateLayoutConfig>;
}

export const LiveA4WaybillSheet: React.FC<LiveA4WaybillSheetProps> = ({
  formValues,
  company,
  selectedClient,
  documentNumber,
  templateConfig,
}) => {
  const primaryColor = templateConfig?.primaryColor || '#0284c7';
  const accentColor = templateConfig?.accentColor || '#0F172A';
  const logoPosition = templateConfig?.logoPosition || 'left';
  const showStamp = templateConfig?.showStamp ?? true;
  const showQrCode = templateConfig?.showQrCode ?? true;
  const showSignature = templateConfig?.showSignature ?? true;
  const items = Array.isArray(formValues?.items) ? formValues.items : [];

  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const totalPackages = items.reduce((acc, it) => acc + (Number(it.packageCount) || 0), 0);
  const totalWeight = items.reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);

  return (
    <div className="w-[794px] min-h-[1123px] shrink-0 bg-white text-slate-900 shadow-2xl rounded-sm p-8 text-left relative flex flex-col justify-between border border-slate-300">
      {/* 1. Header & Logistics Brand Identity */}
      <div>
        {/* Logistics Industrial Banner */}
        <div
          className="flex items-center justify-between pb-2 mb-4 border-b-2"
          style={{ borderColor: accentColor }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>GOODS WAYBILL & CONSIGNMENT NOTE</span>
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Freight Dispatch Manifest
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-600">
            <span className="text-slate-400">MANIFEST:</span>
            <span>{documentNumber ? `#${documentNumber}` : 'AUTO-ALLOCATED'}</span>
          </div>
        </div>

        <div
          className={`flex pb-4 border-b border-slate-200 transition-all ${
            logoPosition === 'center'
              ? 'flex-col items-center text-center gap-3'
              : logoPosition === 'right'
              ? 'flex-row-reverse justify-between items-start'
              : 'justify-between items-start'
          }`}
        >
          <div className={logoPosition === 'center' ? 'flex flex-col items-center' : ''}>
            <div className={`flex items-center gap-2.5 ${logoPosition === 'center' ? 'justify-center' : ''}`}>
              <div
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-black text-xs tracking-tighter transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                OPS
              </div>
              <div className={logoPosition === 'center' ? 'text-center' : ''}>
                <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">
                  {company?.name || 'AOA 77 COMPANY LTD'}
                </h2>
                <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
                  Logistics & Operations Division
                </p>
              </div>
            </div>
            {company?.address && (
              <p className={`text-[11px] text-slate-600 max-w-xs mt-1.5 leading-snug ${logoPosition === 'center' ? 'mx-auto text-center' : ''}`}>
                {company.address}
              </p>
            )}
            <div className={`flex items-center gap-3 text-[10px] text-slate-500 mt-1 ${logoPosition === 'center' ? 'justify-center' : ''}`}>
              {company?.phone && <span>Tel: {company.phone}</span>}
              {company?.rcNumber && <span>RC: {company.rcNumber}</span>}
            </div>
          </div>

          <div className="text-right">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 inline-block text-right">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Simulated Barcode Tracking
              </div>
              <div className="font-mono text-base tracking-widest text-slate-800 select-none font-bold py-0.5">
                ||| | |||| | ||| |||| | ||
              </div>
              <div className="text-[10px] font-mono font-bold text-slate-600">
                REF: {formValues.trackingNumber || documentNumber || 'TRK-2026-0001'}
              </div>
            </div>
            <div className="mt-2 text-[11px] text-slate-600">
              <span className="text-slate-400 font-medium">Shipment Date: </span>
              <span className="font-bold text-slate-900">
                {formatDate(formValues.shipmentDate || new Date().toISOString())}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Dispatch Routing & Carrier Telemetry Grid */}
        <div className="grid grid-cols-2 gap-4 my-4 text-xs">
          {/* Origin / Consignor Bay */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-sky-800 tracking-wider mb-1 pb-1 border-b border-slate-200">
              <MapPin className="w-3 h-3 text-sky-600" />
              <span>Consignor (Origin Loading Depot)</span>
            </div>
            <div className="font-extrabold text-slate-900 text-xs">
              {company?.name || 'AOA 77 Logistics Depot'}
            </div>
            <div className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
              {formValues.originAddress || company?.address || 'Main Warehouse Depot, Ota, Ogun State'}
            </div>
          </div>

          {/* Destination / Consignee Site */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-sky-800 tracking-wider mb-1 pb-1 border-b border-slate-200">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>Consignee (Destination Delivery Site)</span>
            </div>
            <div className="font-extrabold text-slate-900 text-xs">
              {selectedClient?.companyName || selectedClient?.name || 'Authorized Consignee / Delivery Site'}
            </div>
            <div className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
              {formValues.destinationAddress || 'Specified Customer Receiving Location'}
            </div>
          </div>
        </div>

        {/* Carrier Telemetry Bar */}
        <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 flex flex-wrap items-center justify-between text-xs mb-4">
          <div>
            <span className="text-sky-700 text-[9px] font-bold uppercase tracking-wider block">
              Vehicle Plate Reg #
            </span>
            <span className="font-mono font-bold text-slate-900 text-xs">
              {formValues.vehicleNumber || 'Customer Self-Pickup / Courier'}
            </span>
          </div>

          <div>
            <span className="text-sky-700 text-[9px] font-bold uppercase tracking-wider block">
              Driver Full Name
            </span>
            <span className="font-bold text-slate-900 text-xs">
              {formValues.driverName || 'Designated Haulier Driver'}
            </span>
          </div>

          <div>
            <span className="text-sky-700 text-[9px] font-bold uppercase tracking-wider block">
              Driver Mobile Phone
            </span>
            <span className="font-mono font-semibold text-slate-900 text-xs">
              {formValues.driverPhone || '—'}
            </span>
          </div>

          <div>
            <span className="text-sky-700 text-[9px] font-bold uppercase tracking-wider block">
              Manifest Scope
            </span>
            <span className="font-bold text-slate-900 text-xs">
              {formValues.title || 'General Cargo'}
            </span>
          </div>
        </div>

        {/* 3. Cargo Consignment Items Table */}
        <div className="overflow-hidden border border-slate-300 rounded-lg">
          <table className="w-full table-fixed text-left text-[11px]">
            <colgroup>
              <col className="w-9" />
              <col className="w-auto" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[110px]" />
              <col className="w-[134px]" />
            </colgroup>
            <thead
              className="text-white font-bold uppercase text-[9px] tracking-wider transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">Cargo Description & Specs</th>
                <th className="py-2.5 px-3 text-right">Shipped Qty</th>
                <th className="py-2.5 px-3 text-right">Packages</th>
                <th className="py-2.5 px-3 text-right">Package Type</th>
                <th className="py-2.5 px-3 text-right">Gross Wt (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                    No cargo consignment items entered.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 even:bg-slate-50/40">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 max-w-[220px] break-words">
                      {item.description || 'Cargo item'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {Number(item.quantity || 0).toLocaleString()} {item.unit || 'units'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {item.packageCount ? Number(item.packageCount).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap font-medium">
                      {item.packageType || 'Standard'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-800 whitespace-nowrap font-mono font-medium">
                      {item.weightKg ? Number(item.weightKg).toLocaleString(undefined, { minimumFractionDigits: 1 }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-[10px]">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider text-slate-700">
                    Cargo Manifest Totals:
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-sky-900 font-black">
                    {totalQuantity.toLocaleString()} Units
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {totalPackages > 0 ? `${totalPackages.toLocaleString()} Pkgs` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-mono font-black">
                    {totalWeight > 0 ? `${totalWeight.toLocaleString()} kg` : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. Proof of Delivery & Formal Triplicate Signatures */}
      <div
        className="pt-4 mt-4 border-t-2"
        style={{ borderColor: accentColor }}
      >
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 mb-4 italic leading-relaxed flex items-center justify-between">
          <span>
            <strong className="text-slate-800 not-italic uppercase font-bold">Delivery Clause:</strong> The receiver hereby confirms having checked and received the above cargo in sound, undamaged condition and in the specified quantities.
          </span>
          {showStamp && (
            <div className="shrink-0 border-2 border-dashed border-rose-600/80 rounded-full w-14 h-14 p-1 flex flex-col items-center justify-center text-center text-rose-700 -rotate-12 bg-rose-50/50 select-none shadow-sm ml-2">
              <ShieldCheck className="w-3 h-3 text-rose-600" />
              <span className="text-[6px] font-black uppercase tracking-wider leading-none">HAULAGE SEAL</span>
              <span className="text-[5px] font-mono text-rose-500">DISPATCHED</span>
            </div>
          )}
        </div>

        {showSignature && (
          <div className="grid grid-cols-3 gap-3 text-[10px]">
            {/* 1. Dispatching Officer */}
            <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[9px] pb-1 border-b border-slate-200">
                1. Dispatched By (Warehouse)
              </span>
              <div className="space-y-1 text-slate-600 text-[10px]">
                <div>
                  <span className="text-slate-400">Officer: </span>
                  <span className="font-semibold text-slate-800">Loading Bay Lead</span>
                </div>
                <div className="pt-2">
                  <div className="w-full border-b border-dashed border-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400">Signature & Date</span>
                </div>
              </div>
            </div>

            {/* 2. Transport Haulier */}
            <div className="p-3 rounded-xl border border-slate-300 bg-white space-y-2">
              <span className="font-extrabold text-slate-900 uppercase tracking-wider block text-[9px] pb-1 border-b border-slate-200">
                2. Haulier Acceptance
              </span>
              <div className="space-y-1 text-slate-600 text-[10px]">
                <div>
                  <span className="text-slate-400">Driver: </span>
                  <span className="font-semibold text-slate-800">{formValues.driverName || 'Designated Driver'}</span>
                </div>
                <div className="pt-2">
                  <div className="w-full border-b border-dashed border-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400">Driver Signature</span>
                </div>
              </div>
            </div>

            {/* 3. Consignee Receiver & Stamp */}
            <div className="p-3 rounded-xl border-2 border-sky-800 bg-sky-50/40 space-y-2">
              <span className="font-extrabold text-sky-900 uppercase tracking-wider block text-[9px] pb-1 border-b border-sky-200">
                3. Receiver Confirmation & Stamp
              </span>
              <div className="space-y-1 text-slate-600 text-[10px]">
                <div>
                  <span className="text-slate-400">Receiver Name: </span>
                  <span className="font-semibold text-slate-800">_________________</span>
                </div>
                <div className="pt-1">
                  <div className="h-10 border border-dashed border-sky-300 rounded flex items-center justify-center text-[9px] text-sky-600 font-semibold bg-white">
                    Receiver Official Stamp
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Official Logistics Delivery Note &bull; {company?.name || 'AOA 77 COMPANY LTD'}</span>
            {showQrCode && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-700">
                <QrCode className="w-3 h-3" />
                <span className="font-mono text-[7.5px] font-bold">TRACK & TRACE VERIFIED</span>
              </div>
            )}
          </div>
          <span>Security Validated Consignment Manifest</span>
        </div>
      </div>
    </div>
  );
};
