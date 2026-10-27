import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Client, Company, DocumentRecord } from '../../../types';
import { StudioHeaderBar } from '../../../components/builder/StudioHeaderBar';
import { A4StageContainer } from '../../../components/builder/A4StageContainer';
import { LiveA4InvoiceSheet } from '../../../components/builder/LiveA4InvoiceSheet';
import { DEMO_CLIENTS } from '../../../lib/mock-data';
import {
  Plus,
  Trash2,
  Copy,
  Building2,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';

// Zod Validation Schema for Invoices
const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(0.0001, 'Quantity must be > 0'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.coerce.number().min(0, 'Price must be >= 0'),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(7.5),
});

type InvoiceItemValues = z.infer<typeof invoiceItemSchema>;

const invoiceFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  clientId: z.string().min(1, 'Please select a recipient client'),
  currency: z.string().length(3).default('NGN'),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().default('Net 30 Days'),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  bankDetailsVisible: z.boolean().default(true),
  templateId: z.string().optional(),
  selectedAddressId: z.string().optional(),
  customBillingAddress: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const InvoiceBuilderPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [previewMode, setPreviewMode] = React.useState<'LIVE' | 'SERVER'>('LIVE');

  // 1. Fetch Company Profile (for VAT rate, default currency, bank settings)
  const { data: companyData } = useQuery<{ data?: Company } | Company>({
    queryKey: ['company-current'],
    queryFn: async () => {
      const res = await apiClient.get('/companies/current');
      return res.data;
    },
  });
  const company: Company | null = (companyData as any)?.data || (companyData as any) || null;

  // 2. Fetch Clients Catalog
  const { data: clientsData } = useQuery<{ items: Client[] }>({
    queryKey: ['clients-catalog'],
    queryFn: async () => {
      const res = await apiClient.get('/clients', { params: { limit: 100 } });
      return res.data;
    },
  });
  const clients: Client[] =
    clientsData?.items && clientsData.items.length > 0 ? clientsData.items : DEMO_CLIENTS;

  // 3. Fetch Templates for Invoices
  const { data: templatesData } = useQuery<any[]>({
    queryKey: ['templates-invoice'],
    queryFn: async () => {
      const res = await apiClient.get('/templates', { params: { documentType: 'INVOICE' } });
      return res.data;
    },
  });
  const templates = templatesData || [];

  // 4. Fetch Existing Document if in Edit Mode
  const { data: existingDoc, isLoading: isDocLoading } = useQuery<DocumentRecord>({
    queryKey: ['document', id],
    queryFn: async () => {
      if (!id) throw new Error('No document ID');
      const res = await apiClient.get(`/documents/${id}`);
      return res.data;
    },
    enabled: isEdit,
  });

  // Calculate default dates
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Initialize React Hook Form
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues: {
      title: 'Commercial Supply of Goods & Services',
      clientId: '',
      currency: 'NGN',
      issueDate: todayStr,
      dueDate: defaultDueDate,
      paymentTerms: 'Net 30 Days',
      poNumber: '',
      notes: 'Payment is due within stated terms. Please include invoice number on all remittances.',
      bankDetailsVisible: true,
      selectedAddressId: '',
      customBillingAddress: '',
      items: [
        {
          description: 'Industrial Materials / Professional Services',
          quantity: 1,
          unit: 'Units',
          unitPrice: 50000,
          discountPercent: 0,
          taxRate: 7.5,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Populate form with existing document if editing
  useEffect(() => {
    if (existingDoc && isEdit) {
      const inv = existingDoc.invoice;
      reset({
        title: existingDoc.title,
        clientId: existingDoc.clientId || '',
        currency: existingDoc.currency || 'NGN',
        issueDate: existingDoc.issueDate ? existingDoc.issueDate.split('T')[0] : todayStr,
        dueDate: inv?.dueDate ? inv.dueDate.split('T')[0] : defaultDueDate,
        paymentTerms: inv?.paymentTerms || 'Net 30 Days',
        poNumber: inv?.poNumber || '',
        notes: inv?.notes || '',
        bankDetailsVisible: existingDoc.bankDetailsVisible ?? true,
        templateId: existingDoc.templateId || undefined,
        customBillingAddress: '',
        items:
          inv?.items && inv.items.length > 0
            ? inv.items.map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unit: it.unit || 'Units',
                unitPrice: Number(it.unitPrice),
                discountPercent: Number(it.discountPercent || 0),
                taxRate: Number(it.taxRate ?? 7.5),
              }))
            : [
                {
                  description: 'General Supply Item',
                  quantity: 1,
                  unit: 'Units',
                  unitPrice: 0,
                  discountPercent: 0,
                  taxRate: 7.5,
                },
              ],
      });
    }
  }, [existingDoc, isEdit, reset, todayStr, defaultDueDate]);

  // Watch entire form for 60fps live A4 preview
  const formValues = watch();

  // Find currently selected client and address
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === formValues.clientId) || existingDoc?.client || null;
  }, [clients, formValues.clientId, existingDoc]);

  // Handle client selection change: automatically update address
  const handleClientChange = (clientId: string) => {
    setValue('clientId', clientId, { shouldValidate: true });
    const cl = clients.find((c) => c.id === clientId);
    if (cl && cl.addresses && cl.addresses.length > 0) {
      const def = cl.addresses.find((a) => a.isDefault) || cl.addresses[0];
      setValue('selectedAddressId', def.id);
    } else {
      setValue('selectedAddressId', '');
    }
  };

  const selectedAddress = useMemo(() => {
    if (!selectedClient?.addresses) return null;
    return (
      selectedClient.addresses.find((a) => a.id === formValues.selectedAddressId) ||
      selectedClient.addresses[0] ||
      null
    );
  }, [selectedClient, formValues.selectedAddressId]);

  // Live Math calculations
  const summaryCalculations = useMemo(() => {
    const items = formValues.items || [];
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    for (const item of items) {
      const q = Math.max(0, Number(item.quantity) || 0);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      const dPercent = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
      const tRate = Math.max(0, Number(item.taxRate) || 0);

      const base = Math.round((q * p + Number.EPSILON) * 100) / 100;
      const dVal = Math.round((base * (dPercent / 100) + Number.EPSILON) * 100) / 100;
      const taxable = Math.max(0, Math.round((base - dVal + Number.EPSILON) * 100) / 100);
      const tVal = Math.round((taxable * (tRate / 100) + Number.EPSILON) * 100) / 100;

      subtotal += base;
      discount += dVal;
      tax += tVal;
    }

    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }, [formValues.items]);

  // Save Draft Mutation (POST /invoices or PATCH /invoices/:id)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      const payload = {
        title: data.title,
        clientId: data.clientId,
        currency: data.currency,
        issueDate: data.issueDate ? new Date(data.issueDate).toISOString() : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        paymentTerms: data.paymentTerms,
        poNumber: data.poNumber || undefined,
        bankDetailsVisible: data.bankDetailsVisible,
        templateId: data.templateId || undefined,
        items: data.items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: Number(it.unitPrice),
          discountPercent: Number(it.discountPercent || 0),
          taxRate: Number(it.taxRate ?? 7.5),
        })),
        ...(isEdit && existingDoc ? { expectedVersion: existingDoc.version } : {}),
      };

      if (isEdit && id) {
        const res = await apiClient.patch(`/invoices/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/invoices', payload);
        return res.data;
      }
    },
    onSuccess: (savedDoc) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      if (!isEdit && savedDoc?.id) {
        navigate(`/documents/invoices/${savedDoc.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save invoice draft.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Save & Submit for Approval Mutation
  const saveAndSubmitMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      // 1. First save changes
      let docId = id;
      if (!docId) {
        const draftRes = await saveDraftMutation.mutateAsync(data);
        docId = draftRes.id;
      } else {
        await saveDraftMutation.mutateAsync(data);
      }

      // 2. Submit for approval
      const submitRes = await apiClient.post(`/documents/${docId}/submit`, {
        notes: 'Submitted directly from Invoice Split-Screen Studio',
      });
      return submitRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      navigate('/documents/invoices');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Submission failed. Please verify approval requirements.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const onSaveDraft = () => {
    handleSubmit((data) => saveDraftMutation.mutate(data))();
  };

  const onSubmitForApproval = () => {
    handleSubmit((data) => saveAndSubmitMutation.mutate(data))();
  };

  if (isEdit && isDocLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-[#5847F6] rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Loading invoice studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Finnova Studio Header Bar */}
      <StudioHeaderBar
        documentType="INVOICE"
        documentTitle={formValues.title}
        documentNumber={existingDoc?.documentNumber}
        isEdit={isEdit}
        version={existingDoc?.version || 1}
        status={existingDoc?.status || 'DRAFT'}
        backPath="/documents/invoices"
        previewMode={previewMode}
        onTogglePreviewMode={setPreviewMode}
        onSaveDraft={onSaveDraft}
        onSubmitForApproval={onSubmitForApproval}
        isSavingDraft={saveDraftMutation.isPending}
        isSubmitting={saveAndSubmitMutation.isPending}
        isDirty={isDirty}
      />

      {/* 2. Split-Screen Studio Layout: Left 45% Form / Right 55% A4 Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Interactive Form Studio (45% -> 5.5 cols / 6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Client & Recipient Information */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Client & Billing Address</h3>
                <p className="text-[11px] text-slate-500">Select corporate debtor to auto-fill registered billing address</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Recipient Client <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {clients.length} Clients Available
                  </span>
                </div>
                {/* 1-Tap Client Quick-Fill Pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientChange(c.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                        formValues.clientId === c.id
                          ? 'bg-[#5847F6] text-white border-[#5847F6] shadow-sm shadow-indigo-500/20'
                          : 'bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 border-slate-200'
                      }`}
                    >
                      ⚡ {c.companyName?.split(' ')[0] || c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <select
                  value={formValues.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6] cursor-pointer"
                >
                  <option value="">Select a client from directory...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} — {c.clientNumber}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.clientId.message}</p>
                )}
              </div>

              {/* 1:N Address Selector if Client has multiple registered addresses */}
              {selectedClient?.addresses && selectedClient.addresses.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Billing Address ({selectedClient.addresses.length} on file)
                  </label>
                  <select
                    {...register('selectedAddressId')}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    {selectedClient.addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        [{addr.type}] {addr.line1}, {addr.city}, {addr.state} {addr.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual Override / Custom Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custom Address Override <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  {...register('customBillingAddress')}
                  rows={2}
                  placeholder="Leave empty to use client's standard address..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Document Context & Settlement Terms */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Document Meta & Terms</h3>
                <p className="text-[11px] text-slate-500">Order reference, currencies, and settlement duration</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="e.g. Commercial Supply of Portland Cement"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
                {errors.title && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    {...register('currency')}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    <option value="NGN">NGN (Nigerian Naira - ₦)</option>
                    <option value="USD">USD (US Dollar - $)</option>
                    <option value="GBP">GBP (British Pound - £)</option>
                    <option value="EUR">EUR (Euro - €)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    {...register('paymentTerms')}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="50% Advance, 50% on Delivery">50% Advance, 50% Delivery</option>
                    <option value="Net 60 Days">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Issue Date</label>
                  <input
                    type="date"
                    {...register('issueDate')}
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    {...register('dueDate')}
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client PO Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    {...register('poNumber')}
                    placeholder="e.g. PO-DANGOTE-2026-901"
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Print Template</label>
                  <select
                    {...register('templateId')}
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    <option value="">Default Clean Corporate</option>
                    {templates.map((tpl: any) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Settlement Bank Details Visibility Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('bankDetailsVisible')}
                    className="w-4 h-4 rounded text-[#5847F6] focus:ring-[#5847F6] border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Include Company Bank Settlement Instructions on Invoice
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Dynamic Line Items (useFieldArray) */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Line Items & Financial Breakdown</h3>
                  <p className="text-[11px] text-slate-500">VAT (7.5%), line item discounts, and unit pricing</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  append({
                    description: '',
                    quantity: 1,
                    unit: 'Units',
                    unitPrice: 0,
                    discountPercent: 0,
                    taxRate: 7.5,
                  })
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Line Items List */}
            <div className="space-y-4">
              {fields.map((field, index) => {
                const itemValues = formValues.items?.[index] as Partial<InvoiceItemValues> | undefined;
                const q = Number(itemValues?.quantity) || 0;
                const p = Number(itemValues?.unitPrice) || 0;
                const d = Number(itemValues?.discountPercent) || 0;
                const t = Number(itemValues?.taxRate) || 0;
                const base = q * p;
                const discAmt = base * (d / 100);
                const taxable = Math.max(0, base - discAmt);
                const rowTotal = taxable + taxable * (t / 100);

                return (
                  <div
                    key={field.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 font-mono text-[11px] font-bold text-slate-600 flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">Item Position</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                          {formatCurrency(rowTotal, formValues.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = formValues.items[index];
                            append({
                              ...current,
                              description: current.description ? `${current.description} (Copy)` : '',
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Duplicate line item"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"
                          title="Delete line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        {...register(`items.${index}.description` as const)}
                        placeholder="Item description (e.g. Industrial Portland Cement 50kg)..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                      />
                      {errors.items?.[index]?.description && (
                        <p className="text-[10px] text-rose-500 mt-0.5">
                          {errors.items[index]?.description?.message}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
                        <input
                          type="number"
                          step="any"
                          {...register(`items.${index}.quantity` as const)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                        <input
                          type="text"
                          {...register(`items.${index}.unit` as const)}
                          placeholder="e.g. Bags"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit Price</label>
                        <input
                          type="number"
                          step="any"
                          {...register(`items.${index}.unitPrice` as const)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">VAT %</label>
                        <input
                          type="number"
                          step="any"
                          {...register(`items.${index}.taxRate` as const)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Live Totals Badge inside Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Calculated Subtotal:</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatCurrency(summaryCalculations.subtotal, formValues.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Value Added Tax (VAT 7.5%):</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatCurrency(summaryCalculations.tax, formValues.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-100 text-[#5847F6]">
                <span>Grand Total:</span>
                <span className="tabular-nums">
                  {formatCurrency(summaryCalculations.total, formValues.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Notes & Remittance Advice */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Notes & Payment Instructions</h3>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Add payment terms, banking notes, or project milestones..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
            />
          </div>
        </div>

        {/* Right Sticky Dark Obsidian A4 Stage (55% -> 6 cols) */}
        <div className="lg:col-span-6">
          <A4StageContainer
            previewMode={previewMode}
            documentId={existingDoc?.id}
            onSaveDraft={onSaveDraft}
          >
            <LiveA4InvoiceSheet
              formValues={formValues}
              company={company}
              selectedClient={selectedClient}
              selectedAddress={selectedAddress}
              documentNumber={existingDoc?.documentNumber}
            />
          </A4StageContainer>
        </div>
      </div>
    </div>
  );
};
