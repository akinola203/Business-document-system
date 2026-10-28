import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatDate, formatRelativeTime, formatCurrency } from '../../lib/utils';
import { DocumentRecord, InvoiceItem, WaybillItem } from '../../types';
import {
  X,
  History,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Calendar,
  User,
  CreditCard,
  Truck,
  Mail,
  FileCheck,
  Copy,
  Check,
  Package,
  Clock,
  Sparkles,
  Code,
  Building2,
  MapPin,
  Layers,
  ArrowRight,
  Lock,
  Receipt,
  Tag,
} from 'lucide-react';

interface VersionAndAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentNumber: string;
  document?: DocumentRecord | null;
}

export const VersionAndAuditDrawer: React.FC<VersionAndAuditDrawerProps> = ({
  isOpen,
  onClose,
  documentId,
  documentNumber,
  document,
}) => {
  const [activeTab, setActiveTab] = useState<'versions' | 'audit'>('versions');
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [showLiveDraftDetails, setShowLiveDraftDetails] = useState(false);
  const [showRawJsonMap, setShowRawJsonMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch version snapshots
  const { data: versionsData = [], isLoading: isLoadingVersions } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: async () => {
      const res = await apiClient.get(`/documents/${documentId}/versions`);
      return res.data;
    },
    enabled: isOpen && !!documentId,
  });

  const versions = Array.isArray(versionsData)
    ? versionsData
    : (versionsData?.data || versionsData?.items || []);

  // Fetch audit trail
  const { data: auditData = [], isLoading: isLoadingAudit } = useQuery({
    queryKey: ['document-audit', documentId],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/audit-logs/entity/Document/${documentId}`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: isOpen && activeTab === 'audit' && !!documentId,
  });

  const auditLogs = Array.isArray(auditData)
    ? auditData
    : (auditData?.data || auditData?.items || []);

  if (!isOpen) return null;

  const handleCopy = (id: string, obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRawJson = (id: string) => {
    setShowRawJsonMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper to extract items picked from snapshot
  const extractSnapshotItems = (snapshot: any): any[] => {
    if (!snapshot) return [];
    if (Array.isArray(snapshot.items)) return snapshot.items;
    if (Array.isArray(snapshot.specialized?.invoice?.items)) return snapshot.specialized.invoice.items;
    if (Array.isArray(snapshot.specialized?.waybill?.items)) return snapshot.specialized.waybill.items;
    if (Array.isArray(snapshot.invoice?.items)) return snapshot.invoice.items;
    if (Array.isArray(snapshot.waybill?.items)) return snapshot.waybill.items;
    return [];
  };

  // Helper to extract financial/doc metadata from snapshot
  const extractSnapshotMeta = (snapshot: any) => {
    const doc = snapshot?.document || snapshot || {};
    const client = snapshot?.client || doc.client || document?.client;
    const currency = doc.currency || document?.currency || 'NGN';
    const docType =
      doc.documentType ||
      (snapshot?.specialized?.invoice || snapshot?.invoice || snapshot?.items?.[0]?.unitPrice !== undefined
        ? 'INVOICE'
        : snapshot?.specialized?.waybill || snapshot?.waybill || snapshot?.originAddress || snapshot?.vehicleNumber
        ? 'WAYBILL'
        : snapshot?.specialized?.letter || snapshot?.letter || snapshot?.subject
        ? 'LETTER'
        : document?.documentType || 'INVOICE');

    const totalAmount = doc.totalAmount ?? document?.totalAmount ?? 0;
    const subtotal = doc.subtotal ?? doc.subtotalAmount ?? document?.subtotal ?? document?.subtotalAmount ?? 0;
    const taxAmount = doc.taxAmount ?? document?.taxAmount ?? 0;
    const discountAmount = doc.discountAmount ?? document?.discountAmount ?? 0;
    const balanceDue = doc.balanceDue ?? document?.balanceDue ?? 0;
    const poNumber =
      doc.poNumber ||
      snapshot?.poNumber ||
      snapshot?.specialized?.invoice?.poNumber ||
      snapshot?.invoice?.poNumber;
    const paymentTerms =
      doc.paymentTerms ||
      snapshot?.paymentTerms ||
      snapshot?.specialized?.invoice?.paymentTerms ||
      snapshot?.invoice?.paymentTerms;

    return {
      doc,
      docType,
      client,
      currency,
      totalAmount,
      subtotal,
      taxAmount,
      discountAmount,
      balanceDue,
      poNumber,
      paymentTerms,
    };
  };

  // Helper for waybill logistics
  const extractWaybillDetails = (snapshot: any) => {
    const wb = snapshot?.specialized?.waybill || snapshot?.waybill || snapshot || {};
    return {
      originAddress: wb.originAddress || document?.waybill?.originAddress || '—',
      destinationAddress: wb.destinationAddress || document?.waybill?.destinationAddress || '—',
      vehicleNumber: wb.vehicleNumber || document?.waybill?.vehicleNumber,
      driverName: wb.driverName || document?.waybill?.driverName,
      driverPhone: wb.driverPhone || document?.waybill?.driverPhone,
      trackingNumber: wb.trackingNumber || document?.waybill?.trackingNumber,
      deliveryStatus: wb.deliveryStatus || document?.waybill?.deliveryStatus || 'READY',
    };
  };

  // Helper for letter correspondence
  const extractLetterDetails = (snapshot: any) => {
    const lt = snapshot?.specialized?.letter || snapshot?.letter || snapshot || {};
    return {
      recipientName: lt.recipientName || document?.letter?.recipientName || 'Recipient',
      recipientTitle: lt.recipientTitle || document?.letter?.recipientTitle,
      recipientOrganization: lt.recipientOrganization || document?.letter?.recipientOrganization,
      recipientAddress: lt.recipientAddress || document?.letter?.recipientAddress,
      subject: lt.subject || document?.letter?.subject || 'Official Business Notice',
      bodyText: lt.bodyText || lt.bodyHtml || document?.letter?.bodyText || '',
      letterDate: lt.letterDate || document?.letter?.letterDate,
      signatoryName: lt.signatoryName || document?.letter?.signatoryName,
      signatoryTitle: lt.signatoryTitle || document?.letter?.signatoryTitle,
    };
  };

  // Working live items from document prop
  const liveItems = document?.invoice?.items || document?.waybill?.items || [];
  const isInvoice = document?.documentType === 'INVOICE' || (!document?.documentType && !!document?.invoice);
  const isWaybill = document?.documentType === 'WAYBILL' || !!document?.waybill;
  const isLetter = document?.documentType === 'LETTER' || !!document?.letter;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 md:pl-10">
        <div className="w-screen max-w-xl md:max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* 1. Drawer Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#F8F9FC]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#5847F6]/10 border border-[#5847F6]/20 flex items-center justify-center text-[#5847F6] shadow-sm">
                <History className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Document History & Audit
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    v{document?.version || versions.length || 1}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-[#5847F6] tabular-nums mt-0.5">
                  {documentNumber} {document?.title ? `• ${document.title}` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 transition-colors shadow-sm"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Tab Switcher */}
          <div className="px-6 py-3 border-b border-slate-100 flex gap-2 bg-white">
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'versions'
                  ? 'bg-[#5847F6] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Version Snapshots ({versions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'audit'
                  ? 'bg-[#5847F6] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audit Trail ({auditLogs.length})</span>
            </button>
          </div>

          {/* 3. Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 a4-scroll bg-[#FAFBFD]">
            {activeTab === 'versions' && (
              <div className="space-y-4">
                {/* 3A. Active Working Draft Card (Ensures picked items are immediately visible) */}
                {document && (
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm transition-all hover:border-slate-300">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                          Current Working State
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          {document.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Live OCC v{document.version || 1}
                      </span>
                    </div>

                    <div className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Client / Account
                        </span>
                        <span className="font-bold text-slate-800">
                          {document.client?.companyName || document.client?.name || 'Walk-in Customer'}
                        </span>
                      </div>

                      {isInvoice && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Live Payable Amount
                          </span>
                          <span className="font-extrabold text-slate-900 tabular-nums">
                            {formatCurrency(document.totalAmount, document.currency)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Toggle to inspect live items picked */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 flex items-center gap-1.5 text-[11px]">
                        <Package className="w-3.5 h-3.5 text-[#5847F6]" />
                        <span>{liveItems.length} line items currently in record</span>
                      </span>

                      <button
                        onClick={() => setShowLiveDraftDetails(!showLiveDraftDetails)}
                        className="text-[#5847F6] font-bold hover:underline flex items-center gap-1 text-[11px]"
                      >
                        {showLiveDraftDetails ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Hide Live Items</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Inspect Picked Items</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Live Picked Items Breakdown */}
                    {showLiveDraftDetails && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                        {liveItems.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                            No line items added to this draft yet.
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-3 w-8">#</th>
                                  <th className="py-2 px-3">Item Description</th>
                                  <th className="py-2 px-3 text-right">Qty</th>
                                  {isInvoice && <th className="py-2 px-3 text-right">Price</th>}
                                  {isInvoice && <th className="py-2 px-3 text-right">Total</th>}
                                  {isWaybill && <th className="py-2 px-3 text-right">Weight</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {liveItems.map((item: any, idx: number) => (
                                  <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                      {item.lineNumber || idx + 1}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                      {item.description || item.itemDescription}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                      {Number(item.quantity).toLocaleString()} {item.unit || ''}
                                    </td>
                                    {isInvoice && (
                                      <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                        {formatCurrency(item.unitPrice, document.currency)}
                                      </td>
                                    )}
                                    {isInvoice && (
                                      <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                        {formatCurrency(item.lineTotal || (Number(item.quantity) * Number(item.unitPrice)), document.currency)}
                                      </td>
                                    )}
                                    {isWaybill && (
                                      <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                        {item.weightKg ? `${item.weightKg} kg` : '—'}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Financial Ledger Mini Summary for Invoices */}
                        {isInvoice && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-medium">
                            <div className="flex justify-between text-slate-500">
                              <span>Subtotal:</span>
                              <span className="tabular-nums font-semibold text-slate-800">
                                {formatCurrency(document.subtotal ?? document.subtotalAmount, document.currency)}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>VAT (7.5%):</span>
                              <span className="tabular-nums font-semibold text-slate-800">
                                {formatCurrency(document.taxAmount, document.currency)}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-900 font-extrabold pt-1 border-t border-slate-200">
                              <span>Grand Total:</span>
                              <span className="tabular-nums text-[#5847F6]">
                                {formatCurrency(document.totalAmount, document.currency)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3B. Historical Locked Snapshots */}
                {isLoadingVersions ? (
                  <div className="space-y-3 py-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-28 bg-slate-200/60 animate-pulse rounded-2xl" />
                    ))}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-2xl bg-white border border-slate-200/80 text-slate-400">
                    <FileCheck className="w-10 h-10 mx-auto mb-2.5 text-slate-300" />
                    <h4 className="text-sm font-extrabold text-slate-700">No Immutable Snapshots Yet</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Official immutable version snapshots are permanently locked whenever a document is
                      issued or formally incremented.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      <span>Immutable Historical Snapshots</span>
                      <span>{versions.length} Version{versions.length > 1 ? 's' : ''}</span>
                    </div>

                    {versions.map((v: any) => {
                      const isExpanded = expandedVersionId === v.id;
                      const rawJsonOpen = Boolean(showRawJsonMap[v.id]);
                      const snapItems = extractSnapshotItems(v.snapshotData);
                      const meta = extractSnapshotMeta(v.snapshotData);
                      const waybillData = extractWaybillDetails(v.snapshotData);
                      const letterData = extractLetterDetails(v.snapshotData);

                      return (
                        <div
                          key={v.id}
                          className="rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
                        >
                          {/* Version Card Top Summary */}
                          <div className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs px-2.5 py-1 rounded-full bg-[#5847F6]/10 text-[#5847F6] border border-[#5847F6]/20">
                                  Version {v.versionNumber}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  LOCKED SNAPSHOT
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {formatRelativeTime(v.createdAt)}
                              </span>
                            </div>

                            {/* Change reason */}
                            <p className="text-xs font-semibold text-slate-700">
                              {v.changeReason || 'Official Revision Snapshot'}
                            </p>

                            {/* Author & Timestamp */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  Created by:{' '}
                                  <strong className="text-slate-700 font-semibold">
                                    {v.createdBy
                                      ? `${v.createdBy.firstName} ${v.createdBy.lastName}`
                                      : 'System Actor'}
                                  </strong>
                                </span>
                              </div>
                              <span>{formatDate(v.createdAt)}</span>
                            </div>

                            {/* Metrics Strip */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                                  <Package className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{snapItems.length} items recorded</span>
                                </span>

                                {meta.docType === 'INVOICE' && (
                                  <span className="font-extrabold text-slate-900 tabular-nums">
                                    {formatCurrency(meta.totalAmount, meta.currency)}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                                className="px-3 py-1.5 rounded-full bg-[#5847F6]/10 hover:bg-[#5847F6]/20 text-[#5847F6] font-extrabold text-[11px] flex items-center gap-1.5 transition-all"
                              >
                                {isExpanded ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Hide Snapshot</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Inspect Snapshot</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Rich Snapshot View */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-[#FAFBFD] space-y-3.5 animate-in fade-in duration-200">
                              {/* 1. Client / Billed Party Card */}
                              <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                    {meta.docType === 'WAYBILL' ? 'Consignee / Destination' : 'Billed Customer'}
                                  </span>
                                  <span className="font-bold text-slate-900 text-xs">
                                    {meta.client?.companyName || meta.client?.name || 'Walk-in Customer'}
                                  </span>
                                  {meta.client?.email && (
                                    <span className="text-slate-500 block text-[11px]">
                                      {meta.client.email}
                                    </span>
                                  )}
                                </div>

                                {meta.poNumber && (
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                      Purchase Order
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 text-xs">
                                      {meta.poNumber}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* 2. Visual Itemized Table (The items picked!) */}
                              <div>
                                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                                  <span>Picked Items in this Snapshot ({snapItems.length})</span>
                                  {meta.docType === 'INVOICE' && (
                                    <span className="text-slate-400 font-normal">Standard Financial Ledger</span>
                                  )}
                                </div>

                                {snapItems.length === 0 ? (
                                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-400">
                                    No item records found in this snapshot.
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-[#F8F9FC] text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <tr>
                                          <th className="py-2 px-3 w-8">#</th>
                                          <th className="py-2 px-3">Item Description</th>
                                          <th className="py-2 px-3 text-right">Qty</th>
                                          {meta.docType === 'INVOICE' && (
                                            <th className="py-2 px-3 text-right">Unit Price</th>
                                          )}
                                          {meta.docType === 'INVOICE' && (
                                            <th className="py-2 px-3 text-right">Line Total</th>
                                          )}
                                          {meta.docType === 'WAYBILL' && (
                                            <th className="py-2 px-3 text-right">Weight</th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {snapItems.map((item: any, idx: number) => (
                                          <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                              {item.lineNumber || idx + 1}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-800">
                                              {item.description || item.itemDescription}
                                            </td>
                                            <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                              {Number(item.quantity).toLocaleString()} {item.unit || ''}
                                            </td>
                                            {meta.docType === 'INVOICE' && (
                                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                                {formatCurrency(item.unitPrice, meta.currency)}
                                              </td>
                                            )}
                                            {meta.docType === 'INVOICE' && (
                                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                                {formatCurrency(
                                                  item.lineTotal || (Number(item.quantity) * Number(item.unitPrice)),
                                                  meta.currency,
                                                )}
                                              </td>
                                            )}
                                            {meta.docType === 'WAYBILL' && (
                                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                                                {item.weightKg ? `${item.weightKg} kg` : '—'}
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 3. Specialized Breakdown by Doc Type */}
                              {meta.docType === 'INVOICE' && (
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 font-medium shadow-xs">
                                  <div className="flex justify-between text-slate-500">
                                    <span>Subtotal:</span>
                                    <span className="tabular-nums font-semibold text-slate-800">
                                      {formatCurrency(meta.subtotal, meta.currency)}
                                    </span>
                                  </div>
                                  {Number(meta.discountAmount) > 0 && (
                                    <div className="flex justify-between text-emerald-600">
                                      <span>Discount:</span>
                                      <span className="tabular-nums font-semibold">
                                        -{formatCurrency(meta.discountAmount, meta.currency)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-slate-500">
                                    <span>Value Added Tax (VAT 7.5%):</span>
                                    <span className="tabular-nums font-semibold text-slate-800">
                                      {formatCurrency(meta.taxAmount, meta.currency)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200">
                                    <span>Frozen Grand Total:</span>
                                    <span className="tabular-nums text-sm text-[#5847F6]">
                                      {formatCurrency(meta.totalAmount, meta.currency)}
                                    </span>
                                  </div>
                                  {meta.paymentTerms && (
                                    <div className="text-[11px] text-slate-400 pt-1">
                                      Terms: {meta.paymentTerms}
                                    </div>
                                  )}
                                </div>
                              )}

                              {meta.docType === 'WAYBILL' && (
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Origin Location
                                      </span>
                                      <span className="font-semibold text-slate-800 block text-[11px]">
                                        {waybillData.originAddress}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Destination Address
                                      </span>
                                      <span className="font-semibold text-slate-800 block text-[11px]">
                                        {waybillData.destinationAddress}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                    <div>
                                      Vehicle: <strong>{waybillData.vehicleNumber || 'Unassigned'}</strong>
                                    </div>
                                    <div>
                                      Driver: <strong>{waybillData.driverName || 'Unassigned'}</strong>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {meta.docType === 'LETTER' && (
                                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                      Subject Line
                                    </span>
                                    <span className="font-bold text-slate-900">{letterData.subject}</span>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 font-serif text-[11px] leading-relaxed max-h-36 overflow-y-auto">
                                    {letterData.bodyText || 'No letter body recorded.'}
                                  </div>
                                  {letterData.signatoryName && (
                                    <div className="text-right text-[11px] text-slate-600">
                                      Signatory: <strong>{letterData.signatoryName}</strong>{' '}
                                      {letterData.signatoryTitle ? `(${letterData.signatoryTitle})` : ''}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 4. Technical Audit Raw JSON Payload Toggle */}
                              <div className="pt-2 flex items-center justify-between text-xs">
                                <button
                                  onClick={() => toggleRawJson(v.id)}
                                  className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 text-[11px]"
                                >
                                  <Code className="w-3.5 h-3.5" />
                                  <span>{rawJsonOpen ? 'Hide Raw JSON' : 'Inspect Technical JSON'}</span>
                                </button>

                                <button
                                  onClick={() => handleCopy(v.id, v.snapshotData)}
                                  className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 text-[11px]"
                                  title="Copy raw JSON payload"
                                >
                                  {copiedId === v.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-emerald-600">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {rawJsonOpen && (
                                <div className="p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800 animate-in fade-in duration-150">
                                  <pre>{JSON.stringify(v.snapshotData, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail Tab */}
            {activeTab === 'audit' && (
              <>
                {isLoadingAudit ? (
                  <div className="space-y-3 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-200/60 animate-pulse rounded-2xl" />
                    ))}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-2xl bg-white border border-slate-200 text-slate-400">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-600">No audit events recorded yet.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Actions like creation, approval, and issuance are audited automatically.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {auditLogs.map((log: any) => (
                      <div key={log.id} className="relative text-xs">
                        <div className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#5847F6] ring-4 ring-white" />
                        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-slate-900 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 my-1">
                            Actor: <strong>{log.actor?.fullName || log.actorId || 'System'}</strong>
                            {log.actor?.email && ` (${log.actor.email})`}
                          </div>

                          {log.newValues && (
                            <div className="mt-2 text-[10px] text-slate-600 font-mono bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 overflow-x-auto">
                              <pre>{JSON.stringify(log.newValues, null, 2)}</pre>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-400 text-right">
                            {formatDate(log.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
