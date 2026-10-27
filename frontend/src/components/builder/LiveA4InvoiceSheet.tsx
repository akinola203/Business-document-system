import React from 'react';
import { Company, Client, ClientAddress } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

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
  const currency = formValues.currency || 'NGN';

  // Calculate precision line items and totals
  const calculatedItems = (formValues.items || []).map((item, index) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discPercent = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
    const taxRate = Math.max(0, Number(item.taxRate) || 0);

    const baseAmount = Math.round((qty * price + Number.EPSILON) * 100) / 100;
    const discountAmount = Math.round((baseAmount * (discPercent / 100) + Number.EPSILON) * 100) / 100;
    const taxableAmount = Math.max(0, Math.round((baseAmount - discountAmount + Number.EPSILON) * 100) / 100);
    const taxAmount = Math.round((taxableAmount * (taxRate / 100) + Number.EPSILON) * 100) / 100;
    const lineTotal = Math.round((taxableAmount + taxAmount + Number.EPSILON) * 100) / 100;

    return {
      lineNumber: index + 1,
      description: item.description || 'Item description',
      quantity: qty,
      unit: item.unit || 'units',
      unitPrice: price,
      discountPercent: discPercent,
      taxRate,
      lineTotal,
      baseAmount,
      discountAmount,
      taxAmount,
    };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + it.baseAmount, 0);
  const discountTotal = calculatedItems.reduce((acc, it) => acc + it.discountAmount, 0);
  const taxTotal = calculatedItems.reduce((acc, it) => acc + it.taxAmount, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);

  // Address resolution
  const formattedAddress =
    formValues.customBillingAddress ||
    (selectedAddress
      ? `${selectedAddress.line1}${selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.country}`
      : selectedClient?.address || selectedClient?.addresses?.[0]?.line1 || 'No billing address specified');

  const showBank = formValues.bankDetailsVisible ?? company?.settings?.showBankDetailsOnInvoice ?? true;

  return (
    <div className="aspect-[1/1.414] w-full max-w-[680px] bg-white text-slate-900 shadow-2xl rounded-sm p-8 md:p-10 overflow-hidden text-left relative flex flex-col justify-between border border-slate-200">
      {/* 1. Header & Brand Identity */}
      <div>
        <div className="flex justify-between items-start pb-6 border-b border-slate-200">
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
            {company?.tin && (
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                TIN: <span className="font-semibold">{company.tin}</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <h1 className="text-2xl md:text-3xl font-black text-[#5847F6] tracking-tighter uppercase">
              INVOICE
            </h1>
            <p className="text-xs font-mono font-bold text-slate-700 mt-1">
              {documentNumber ? `#${documentNumber}` : 'AUTO-GENERATED ON SAVE'}
            </p>
            <div className="mt-2 space-y-0.5 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400">Date: </span>
                <span className="font-semibold">{formatDate(formValues.issueDate || new Date().toISOString())}</span>
              </div>
              {formValues.dueDate && (
                <div>
                  <span className="text-slate-400">Due Date: </span>
                  <span className="font-semibold text-rose-600">{formatDate(formValues.dueDate)}</span>
                </div>
              )}
              {formValues.poNumber && (
                <div>
                  <span className="text-slate-400">PO Ref: </span>
                  <span className="font-semibold font-mono">{formValues.poNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Bill To & Payment Terms Strip */}
        <div className="grid grid-cols-2 gap-6 my-6 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Billed To
            </span>
            <div className="font-extrabold text-slate-900 text-sm">
              {selectedClient?.companyName || selectedClient?.name || 'Client Name / Entity'}
            </div>
            {selectedClient?.name && selectedClient?.companyName && (
              <div className="text-slate-600 font-medium text-[11px]">Attn: {selectedClient.name}</div>
            )}
            <div className="text-slate-600 mt-1 text-[11px] leading-relaxed">
              {formattedAddress}
            </div>
            {selectedClient?.taxNumber && (
              <div className="text-[10px] font-mono text-slate-500 mt-1">
                Client TIN: {selectedClient.taxNumber}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Settlement Terms
              </span>
              <div className="font-bold text-slate-800 text-xs">
                {formValues.paymentTerms || 'Net 30 Days'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Currency: <span className="font-bold text-slate-700">{currency}</span>
              </div>
            </div>
            {formValues.title && (
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 truncate">
                <span className="font-semibold text-slate-700">Project / Order:</span> {formValues.title}
              </div>
            )}
          </div>
        </div>

        {/* 3. Line Items Table */}
        <div className="overflow-hidden border border-slate-200 rounded-lg">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Disc</th>
                <th className="py-2.5 px-3 text-right">VAT</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                    No line items added. Add items in the form studio.
                  </td>
                </tr>
              ) : (
                calculatedItems.map((item) => (
                  <tr key={item.lineNumber} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                      {item.lineNumber}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-[200px] break-words">
                      {item.description}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                      {item.quantity.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {formatCurrency(item.unitPrice, currency)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-600 whitespace-nowrap">
                      {item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-500 whitespace-nowrap">
                      {item.taxRate > 0 ? `${item.taxRate}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.lineTotal, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bottom Section: Bank Settlement & Precision Financial Calculation */}
      <div className="pt-4 mt-6 border-t border-slate-200">
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Left: Settlement Instructions & Notes */}
          <div className="col-span-7 space-y-3 text-[10px]">
            {showBank && company?.settings?.bankName && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider block mb-1">
                  Bank Settlement Details
                </span>
                <div className="text-slate-600 space-y-0.5 font-medium">
                  <div>
                    Bank: <span className="font-bold text-slate-900">{company.settings.bankName}</span>
                  </div>
                  <div>
                    Account Number:{' '}
                    <span className="font-bold font-mono text-slate-900">
                      {company.settings.bankAccountNumber || '1000652112'}
                    </span>
                  </div>
                  {company.settings.bankAccountName && (
                    <div>
                      Account Name: <span className="font-semibold text-slate-800">{company.settings.bankAccountName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formValues.notes && (
              <div className="text-slate-500 italic leading-relaxed">
                <span className="font-semibold text-slate-700 not-italic">Notes / Terms:</span> {formValues.notes}
              </div>
            )}
          </div>

          {/* Right: Subtotal, VAT & Grand Total Breakdown */}
          <div className="col-span-5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Subtotal:</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 text-[11px]">
                <span>Total Discount:</span>
                <span className="font-semibold tabular-nums">
                  -{formatCurrency(discountTotal, currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Value Added Tax (VAT 7.5%):</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(taxTotal, currency)}
              </span>
            </div>

            <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="font-black text-slate-900 text-sm uppercase">Total Payable:</span>
              <span className="font-black text-slate-900 text-base md:text-lg tabular-nums">
                {formatCurrency(grandTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Document Signatory & Stamp Footer */}
        <div className="flex justify-between items-end pt-6 mt-4 border-t border-slate-100 text-[9px] text-slate-400">
          <div>
            <span>Computer generated invoice by </span>
            <span className="font-semibold text-slate-600">{company?.name || 'AOA 77 COMPANY LTD'}</span>
          </div>
          <div className="text-right">
            <div className="w-32 border-b border-slate-300 mb-1" />
            <span>Authorized Signature & Stamp</span>
          </div>
        </div>
      </div>
    </div>
  );
};
