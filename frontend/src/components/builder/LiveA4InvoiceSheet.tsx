import React from 'react';
import { Company, Client, ClientAddress } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Landmark, ShieldCheck, CreditCard } from 'lucide-react';

export interface InvoiceLiveFormValues {
  title: string;
  clientId: string;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  paymentTerms?: string;
  poNumber?: string;
  notes?: string;
  bankDetailsVisible?: boolean;
  selectedAddressId?: string;
  customBillingAddress?: string;
  items: Array<{
    description: string;
    quantity: number | string;
    unit: string;
    unitPrice: number | string;
    discountPercent?: number | string;
    taxRate?: number | string;
  }>;
}

interface LiveA4InvoiceSheetProps {
  formValues: InvoiceLiveFormValues;
  company?: Company | null;
  selectedClient?: Client | null;
  selectedAddress?: ClientAddress | null;
  documentNumber?: string | null;
}

export const LiveA4InvoiceSheet: React.FC<LiveA4InvoiceSheetProps> = ({
  formValues,
  company,
  selectedClient,
  selectedAddress,
  documentNumber,
}) => {
  const currency = formValues?.currency || 'NGN';

  // Calculate precision line items and totals
  const calculatedItems = (formValues?.items || []).map((item, index) => {
    if (!item) {
      return {
        lineNumber: index + 1,
        description: 'Item description',
        quantity: 1,
        unit: 'Units',
        unitPrice: 0,
        discountPercent: 0,
        taxRate: 7.5,
        lineTotal: 0,
        baseAmount: 0,
        discountAmount: 0,
        taxAmount: 0,
      };
    }

    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discPercent = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
    const taxRate = item.taxRate !== undefined && item.taxRate !== '' ? Math.max(0, Number(item.taxRate)) : 7.5;

    const baseAmount = Math.round((qty * price + Number.EPSILON) * 100) / 100;
    const discountAmount = Math.round((baseAmount * (discPercent / 100) + Number.EPSILON) * 100) / 100;
    const taxableAmount = Math.max(0, Math.round((baseAmount - discountAmount + Number.EPSILON) * 100) / 100);
    const taxAmount = Math.round((taxableAmount * (taxRate / 100) + Number.EPSILON) * 100) / 100;
    const lineTotal = Math.round((taxableAmount + taxAmount + Number.EPSILON) * 100) / 100;

    return {
      lineNumber: index + 1,
      description: item.description || 'Item description',
      quantity: qty,
      unit: item.unit || 'Units',
      unitPrice: price,
      discountPercent: discPercent,
      taxRate,
      lineTotal,
      baseAmount,
      discountAmount,
      taxAmount,
    };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + (it.baseAmount || 0), 0);
  const discountTotal = calculatedItems.reduce((acc, it) => acc + (it.discountAmount || 0), 0);
  const taxTotal = calculatedItems.reduce((acc, it) => acc + (it.taxAmount || 0), 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);

  // Address resolution
  const formattedAddress =
    formValues?.customBillingAddress ||
    (selectedAddress
      ? `${selectedAddress.line1 || ''}${selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, ${selectedAddress.city || ''}, ${selectedAddress.state || ''}, ${selectedAddress.country || ''}`
      : selectedClient?.address || selectedClient?.addresses?.[0]?.line1 || 'No billing address specified');

  const showBank = formValues?.bankDetailsVisible ?? company?.settings?.showBankDetailsOnInvoice ?? true;

  return (
    <div className="aspect-[1/1.414] w-full max-w-[680px] shrink-0 bg-white text-slate-900 shadow-2xl rounded-sm p-8 md:p-10 overflow-hidden text-left relative flex flex-col justify-between border border-slate-300 my-auto">
      {/* 1. Header & Financial Ledger Brand Identity */}
      <div>
        {/* Ledger Top Bar */}
        <div className="flex items-center justify-between pb-2 mb-4 border-b-2 border-slate-900">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
              COMMERCIAL TAX INVOICE
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Financial Accounts Ledger
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>FIRS TIN: {company?.tin || '24891044-0001'}</span>
          </div>
        </div>

        <div className="flex justify-between items-start pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs tracking-tighter">
                AOA
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">
                  {company?.name || 'AOA 77 COMPANY LTD'}
                </h2>
                {company?.rcNumber && (
                  <p className="text-[10px] font-mono text-slate-500 font-bold">
                    CAC RC: {company.rcNumber}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-600 max-w-xs mt-1.5 leading-snug">
              {company?.address || '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria'}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
              <span>Email: {company?.email || 'billing@aoa77.com'}</span>
              <span>Tel: {company?.phone || '+234 803 000 0001'}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
              INVOICE NUMBER
            </div>
            <div className="text-xl md:text-2xl font-black text-[#5847F6] font-mono tracking-tight mt-0.5">
              {documentNumber ? `#${documentNumber}` : 'AUTO-ALLOCATED'}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400 font-medium">Issue Date: </span>
                <span className="font-bold text-slate-800">{formatDate(formValues?.issueDate || new Date().toISOString())}</span>
              </div>
              {formValues?.dueDate && (
                <div>
                  <span className="text-slate-400 font-medium">Payment Due: </span>
                  <span className="font-bold text-rose-600">{formatDate(formValues.dueDate)}</span>
                </div>
              )}
              {formValues?.poNumber && (
                <div>
                  <span className="text-slate-400 font-medium">Customer PO: </span>
                  <span className="font-bold font-mono text-slate-900">{formValues.poNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Bill To (Client Ledger) & Settlement Terms Grid */}
        <div className="grid grid-cols-2 gap-4 my-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200/80">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                Bill To (Customer Account)
              </span>
              {selectedClient?.taxNumber && (
                <span className="text-[9px] font-mono font-bold text-slate-600">
                  TIN: {selectedClient.taxNumber}
                </span>
              )}
            </div>
            <div className="font-extrabold text-slate-900 text-sm">
              {selectedClient?.companyName || selectedClient?.name || 'Walk-in / Valued Customer'}
            </div>
            {selectedClient?.name && selectedClient?.companyName && (
              <div className="text-slate-600 font-semibold text-[11px] mt-0.5">
                Attn: {selectedClient.name}
              </div>
            )}
            <div className="text-slate-600 mt-1 text-[11px] leading-relaxed">
              {formattedAddress}
            </div>
            {selectedClient?.phone && (
              <div className="text-[10px] text-slate-500 mt-1">
                Tel: {selectedClient.phone}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1 pb-1 border-b border-slate-200/80">
                Payment & Credit Terms
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Terms of Settlement:</span>
                <span className="font-bold text-slate-900">{formValues.paymentTerms || 'Net 30 Days'}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Base Currency:</span>
                <span className="font-bold font-mono text-slate-900">{currency}</span>
              </div>
            </div>
            {formValues.title && (
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 truncate mt-1">
                <span className="font-semibold text-slate-700">Order Description:</span> {formValues.title}
              </div>
            )}
          </div>
        </div>

        {/* 3. Line Items Table (Financial Ledger Layout) */}
        <div className="overflow-hidden border border-slate-300 rounded-lg">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[9px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price ({currency})</th>
                <th className="py-2.5 px-3 text-right">Disc</th>
                <th className="py-2.5 px-3 text-right">VAT (7.5%)</th>
                <th className="py-2.5 px-3 text-right">Line Total ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {calculatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                    No items added. Add products or services in the invoice studio.
                  </td>
                </tr>
              ) : (
                calculatedItems.map((item) => (
                  <tr key={item.lineNumber} className="hover:bg-slate-50/70 even:bg-slate-50/40">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {item.lineNumber}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 max-w-[200px] break-words">
                      {item.description}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-700 whitespace-nowrap">
                      {Number(item.quantity || 0).toLocaleString()} {item.unit || 'Units'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap font-mono">
                      {formatCurrency(item.unitPrice, currency)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-600 whitespace-nowrap font-medium">
                      {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap font-mono">
                      {item.taxRate > 0 ? formatCurrency(item.taxAmount, currency) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap font-mono">
                      {formatCurrency(item.lineTotal, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bottom Section: Official Banking Settlement & Ledger Summary */}
      <div className="pt-4 mt-4 border-t-2 border-slate-900">
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left: Official Banking Settlement Account Details */}
          <div className="col-span-7 space-y-2.5 text-[10px]">
            {showBank && company?.settings?.bankName && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px]">
                    Official Banking Payout Account
                  </span>
                </div>
                <div className="text-slate-700 space-y-0.5 font-medium leading-relaxed">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bank Name:</span>
                    <span className="font-bold text-slate-900">{company.settings.bankName}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-500">Account Number:</span>
                    <span className="font-bold font-mono text-slate-900 text-xs tracking-wider">
                      {company.settings.bankAccountNumber || '1000652112'}
                    </span>
                  </div>
                  {company.settings.bankAccountName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Name:</span>
                      <span className="font-bold text-slate-800">{company.settings.bankAccountName}</span>
                    </div>
                  )}
                  {company.settings.bankSortCode && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sort Code / CBN:</span>
                      <span className="font-mono text-slate-800">{company.settings.bankSortCode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formValues.notes && (
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-[10px] leading-relaxed">
                <span className="font-bold uppercase tracking-wider block text-[9px] mb-0.5">
                  Payment Instructions & Notes:
                </span>
                {formValues.notes}
              </div>
            )}
          </div>

          {/* Right: Subtotal, VAT (7.5%), & Grand Total Ledger */}
          <div className="col-span-5 space-y-1.5 text-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Gross Subtotal:</span>
              <span className="font-bold tabular-nums text-slate-800 font-mono">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 text-[11px]">
                <span>Trade Discount:</span>
                <span className="font-bold tabular-nums font-mono">
                  -{formatCurrency(discountTotal, currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 text-[11px] pb-1.5 border-b border-slate-200">
              <span>Standard VAT (7.5%):</span>
              <span className="font-bold tabular-nums text-slate-800 font-mono">
                {formatCurrency(taxTotal, currency)}
              </span>
            </div>

            <div className="pt-1.5 flex justify-between items-baseline">
              <span className="font-black text-slate-900 text-xs uppercase tracking-tight">
                Grand Total:
              </span>
              <span className="font-black text-slate-950 text-base md:text-lg tabular-nums font-mono">
                {formatCurrency(grandTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Authorised Signature & Financial Verification Footer */}
        <div className="flex justify-between items-end pt-5 mt-3 border-t border-slate-200 text-[9px] text-slate-400">
          <div>
            <span>Corporate Electronic Invoice &bull; Generated by </span>
            <span className="font-bold text-slate-700">{company?.name || 'AOA 77 COMPANY LTD'}</span>
          </div>
          <div className="text-right">
            <div className="w-36 border-b border-slate-400 mb-1" />
            <span className="font-semibold text-slate-600 uppercase tracking-wider">
              Authorized Financial Signatory & Stamp
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
