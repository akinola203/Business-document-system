import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Client, Company, DocumentRecord, SupplyItem } from '../../../types';
import { StudioHeaderBar } from '../../../components/builder/StudioHeaderBar';
import { A4StageContainer } from '../../../components/builder/A4StageContainer';
import { LiveA4WaybillSheet } from '../../../components/builder/LiveA4WaybillSheet';
import { CatalogPickerModal } from '../../../components/supplies/CatalogPickerModal';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { DEMO_CLIENTS, DEMO_SUPPLIES } from '../../../lib/mock-data';
import {
  Truck,
  Plus,
  Trash2,
  Copy,
  Building2,
  Calendar,
  Package,
  MapPin,
  Phone,
  User,
} from 'lucide-react';

// Zod Validation Schema for Waybills
const waybillItemSchema = z.object({
  description: z.string().min(1, 'Cargo description is required'),
  quantity: z.coerce.number().min(0.0001, 'Quantity must be > 0'),
  unit: z.string().min(1, 'Unit is required'),
  weightKg: z.coerce.number().min(0).optional(),
  packageCount: z.coerce.number().min(1).optional(),
  packageType: z.string().optional(),
});

const waybillFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  clientId: z.string().optional(),
  shipmentDate: z.string().optional(),
  originAddress: z.string().min(3, 'Origin loading address is required'),
  destinationAddress: z.string().min(3, 'Destination address is required'),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  trackingNumber: z.string().optional(),
  templateId: z.string().optional(),
  selectedAddressId: z.string().optional(),
  items: z.array(waybillItemSchema).min(1, 'At least one cargo item is required'),
});

type WaybillFormValues = z.infer<typeof waybillFormSchema>;

export const WaybillBuilderPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = React.useState<'LIVE' | 'SERVER'>('LIVE');
  const [activeCatalogIndex, setActiveCatalogIndex] = React.useState<number | null>(null);

  // 1. Fetch Company Profile (for default origin address)
  const { data: companyData } = useQuery<{ data?: Company } | Company>({
    queryKey: ['company-current'],
    queryFn: async () => {
      const res = await apiClient.get('/companies/current');
      return res.data;
    },
  });
  const company: Company | null = (companyData as any)?.data || (companyData as any) || null;

  // 2. Fetch Clients Catalog
  const { data: clientsData } = useQuery<any>({
    queryKey: ['clients-catalog'],
    queryFn: async () => {
      const res = await apiClient.get('/clients', { params: { limit: 100 } });
      return res.data;
    },
  });
  const clients: Client[] = useMemo(() => {
    const raw = Array.isArray(clientsData)
      ? clientsData
      : (clientsData as any)?.data || (clientsData as any)?.items || clientsData;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return DEMO_CLIENTS;
  }, [clientsData]);

  // 3. Fetch Existing Document if in Edit Mode
  const { data: existingDoc, isLoading: isDocLoading } = useQuery<DocumentRecord>({
    queryKey: ['document', id],
    queryFn: async () => {
      if (!id) throw new Error('No document ID');
      const res = await apiClient.get(`/documents/${id}`);
      return res.data;
    },
    enabled: isEdit,
  });

  // 4. Fetch Supplies Catalog for Quick-Add
  const { data: suppliesData } = useQuery<any>({
    queryKey: ['supplies-items'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/supplies/items', { params: { limit: 100 } });
        return res.data;
      } catch {
        return { items: DEMO_SUPPLIES };
      }
    },
  });
  const catalogSupplies: SupplyItem[] = useMemo(() => {
    const raw = Array.isArray(suppliesData)
      ? suppliesData
      : (suppliesData as any)?.data || (suppliesData as any)?.items || suppliesData;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return DEMO_SUPPLIES;
  }, [suppliesData]);

  // 5. Fetch Templates for Waybills
  const { data: templatesData } = useQuery<any>({
    queryKey: ['templates-waybill'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/templates', { params: { documentType: 'WAYBILL' } });
        return res.data;
      } catch {
        return [];
      }
    },
  });
  const templates: any[] = useMemo(() => {
    const raw = Array.isArray(templatesData)
      ? templatesData
      : (templatesData as any)?.data || (templatesData as any)?.items || [];
    return Array.isArray(raw) ? raw : [];
  }, [templatesData]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Initialize React Hook Form
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<WaybillFormValues>({
    resolver: zodResolver(waybillFormSchema) as any,
    defaultValues: {
      title: 'Consignment Dispatch & Cargo Delivery Note',
      clientId: '',
      shipmentDate: todayStr,
      originAddress:
        company?.address || '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State',
      destinationAddress: '',
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      trackingNumber: `TRK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      selectedAddressId: '',
      items: [
        {
          description: 'Industrial Consignment Cargo',
          quantity: 100,
          unit: 'Units',
          packageCount: 10,
          packageType: 'Shrink-wrapped Pallet',
          weightKg: 2500,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const handleSelectCatalogItem = (item: SupplyItem) => {
    if (activeCatalogIndex !== null) {
      if (activeCatalogIndex >= fields.length) {
        append({
          description: item.name || item.sku || 'Cargo Item',
          quantity: 1,
          unit: item.unit || 'Units',
          packageCount: 1,
          packageType: 'Standard Cargo',
          weightKg: 0,
        });
      } else {
        setValue(`items.${activeCatalogIndex}.description`, item.name || item.sku || 'Cargo Item', { shouldValidate: true, shouldDirty: true });
        setValue(`items.${activeCatalogIndex}.unit`, item.unit || 'Units', { shouldValidate: true, shouldDirty: true });
      }
      setActiveCatalogIndex(null);
    }
  };

  // Populate form if editing
  useEffect(() => {
    if (existingDoc && isEdit) {
      const wb = existingDoc.waybill;
      reset({
        title: existingDoc.title,
        clientId: existingDoc.clientId || '',
        shipmentDate: wb?.shipmentDate ? wb.shipmentDate.split('T')[0] : todayStr,
        originAddress: wb?.originAddress || company?.address || '',
        destinationAddress: wb?.destinationAddress || '',
        vehicleNumber: wb?.vehicleNumber || '',
        driverName: wb?.driverName || '',
        driverPhone: wb?.driverPhone || '',
        trackingNumber: wb?.trackingNumber || '',
        templateId: existingDoc.templateId || undefined,
        items:
          wb?.items && wb.items.length > 0
            ? wb.items.map((it) => ({
              description: it.description,
              quantity: Number(it.quantity),
              unit: it.unit || 'Units',
              packageCount: it.packageCount ? Number(it.packageCount) : undefined,
              packageType: it.packageType || '',
              weightKg: it.weightKg ? Number(it.weightKg) : undefined,
            }))
            : [
              {
                description: 'Consignment Cargo Item',
                quantity: 1,
                unit: 'Units',
              },
            ],
      });
    }
  }, [existingDoc, isEdit, reset, company, todayStr]);

  // Set default origin address once company loads in create mode
  useEffect(() => {
    if (!isEdit && company?.address) {
      setValue('originAddress', company.address);
    }
  }, [company, isEdit, setValue]);

  // Watch form values for live 60fps A4 updates
  const formValues = watch();

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === formValues.clientId) || existingDoc?.client || null;
  }, [clients, formValues.clientId, existingDoc]);

  // Client Selection handler
  const handleClientChange = (clientId: string) => {
    setValue('clientId', clientId, { shouldValidate: true });
    const cl = clients.find((c) => c.id === clientId);
    if (cl) {
      const address =
        cl.addresses?.find((a) => a.isDefault)?.line1 ||
        cl.addresses?.[0]?.line1 ||
        cl.address ||
        '';
      if (address) {
        setValue('destinationAddress', address, { shouldValidate: true });
      }
    }
  };

  // Save Draft Mutation (POST /waybills or PATCH /waybills/:id)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: WaybillFormValues) => {
      const payload = {
        title: data.title,
        clientId: data.clientId || undefined,
        shipmentDate: data.shipmentDate ? new Date(data.shipmentDate).toISOString() : undefined,
        originAddress: data.originAddress,
        destinationAddress: data.destinationAddress,
        vehicleNumber: data.vehicleNumber || undefined,
        driverName: data.driverName || undefined,
        driverPhone: data.driverPhone || undefined,
        trackingNumber: data.trackingNumber || undefined,
        templateId: data.templateId || undefined,
        items: data.items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          packageCount: it.packageCount ? Number(it.packageCount) : undefined,
          packageType: it.packageType || undefined,
          weightKg: it.weightKg ? Number(it.weightKg) : undefined,
        })),
        ...(isEdit && existingDoc ? { expectedVersion: existingDoc.version } : {}),
      };

      if (isEdit && id) {
        const res = await apiClient.patch(`/waybills/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/waybills', payload);
        return res.data;
      }
    },
    onSuccess: (savedDoc) => {
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      if (!isEdit && savedDoc?.id) {
        navigate(`/documents/waybills/${savedDoc.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save waybill draft.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Save & Submit for Approval Mutation
  const saveAndSubmitMutation = useMutation({
    mutationFn: async (data: WaybillFormValues) => {
      let docId = id;
      if (!docId) {
        const draftRes = await saveDraftMutation.mutateAsync(data);
        docId = draftRes.id;
      } else {
        await saveDraftMutation.mutateAsync(data);
      }

      const submitRes = await apiClient.post(`/documents/${docId}/submit`, {
        notes: 'Submitted from Waybill Split-Screen Studio',
      });
      return submitRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      navigate('/documents/waybills');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Submission failed. Please check transition permissions.';
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
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Loading waybill studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Finnova Studio Header Bar */}
      <StudioHeaderBar
        documentType="WAYBILL"
        documentTitle={formValues?.title || 'New Waybill'}
        documentNumber={existingDoc?.documentNumber}
        isEdit={isEdit}
        version={existingDoc?.version || 1}
        status={existingDoc?.status || 'DRAFT'}
        backPath="/documents/waybills"
        previewMode={previewMode}
        onTogglePreviewMode={setPreviewMode}
        onSaveDraft={onSaveDraft}
        onSubmitForApproval={onSubmitForApproval}
        isSavingDraft={saveDraftMutation.isPending}
        isSubmitting={saveAndSubmitMutation.isPending}
        isDirty={isDirty}
      />

      {/* 2. Split-Screen Studio Layout */}
      <ErrorBoundary fallbackTitle="Waybill Studio Workspace Error">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Interactive Form Studio (45% -> 6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Consignee & Routing Bay */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Consignee & Loading Depot</h3>
                <p className="text-[11px] text-slate-500">Dispatch origin and recipient delivery destinations</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Consignee Client <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    {clients.length} Clients Available
                  </span>
                </div>
                {/* 1-Tap Consignee Quick-Fill Pills */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {(Array.isArray(clients) ? clients : []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientChange(c.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                        formValues?.clientId === c.id
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-500/20'
                          : 'bg-white hover:bg-sky-50 hover:border-sky-300 text-slate-700 border-slate-200'
                      }`}
                    >
                      ⚡ {(c.companyName || c.name || 'Client').split(' ')[0]}
                    </button>
                  ))}
                </div>
                <select
                  value={formValues?.clientId || ''}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="">Select a consignee client...</option>
                  {(Array.isArray(clients) ? clients : []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Client'} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Origin Loading Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  {...register('originAddress')}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {errors.originAddress && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.originAddress.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Delivery Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  {...register('destinationAddress')}
                  rows={2}
                  placeholder="Plot, street, city, state and consignee offloading point..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {errors.destinationAddress && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.destinationAddress.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Carrier Telemetry & Driver Credentials */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Carrier & Logistics Telemetry</h3>
                <p className="text-[11px] text-slate-500">Haulage vehicle, designated driver, and tracking number</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="e.g. Consignment Dispatch - Dangote Hub Ota"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Shipment Date</label>
                  <input
                    type="date"
                    {...register('shipmentDate')}
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tracking Number</label>
                  <input
                    type="text"
                    {...register('trackingNumber')}
                    className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Plate</label>
                  <input
                    type="text"
                    {...register('vehicleNumber')}
                    placeholder="e.g. OG-458-APP"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    {...register('driverName')}
                    placeholder="e.g. Sunday Babatunde"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Driver Phone</label>
                  <input
                    type="text"
                    {...register('driverPhone')}
                    placeholder="e.g. +234 803 555 6677"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Dynamic Cargo Consignment Items (useFieldArray) */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Cargo Items & Consignments</h3>
                  <p className="text-[11px] text-slate-500">Quantities, package packaging type, and gross weight</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  append({
                    description: '',
                    quantity: 1,
                    unit: 'Units',
                    packageCount: 1,
                    packageType: 'Standard Carton',
                    weightKg: 0,
                  })
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Cargo</span>
              </button>
            </div>

            {/* 1-Click Quick-Add from Supplies Catalog Pill Bar */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>📦 Quick-Add from Supplies Catalog</span>
                  <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                    {catalogSupplies.length} SKUs
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveCatalogIndex(fields.length)}
                  className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                >
                  Browse Full Catalog →
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(Array.isArray(catalogSupplies) ? catalogSupplies : []).slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      append({
                        description: item.name || item.sku || 'Cargo Item',
                        quantity: 1,
                        unit: item.unit || 'Units',
                        packageCount: 1,
                        packageType: 'Standard Cargo',
                        weightKg: 0,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-slate-700 border border-slate-200 text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="font-mono text-[10px] text-sky-600 font-bold">{item.sku}</span>
                    <span>{(item.name || item.sku || 'Item').split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cargo Items List */}
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 font-mono text-[11px] font-bold text-slate-600 flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveCatalogIndex(index)}
                        className="px-2.5 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold border border-sky-200 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>📦 Pick from Supplies Catalog</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const current = formValues?.items?.[index];
                          if (current) {
                            append({
                              ...current,
                              description: current.description ? `${current.description} (Copy)` : 'Cargo Item (Copy)',
                            });
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Duplicate cargo item"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      {...register(`items.${index}.description` as const)}
                      placeholder="Cargo description (e.g. Portland Composite Cement 50kg)..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-[10px] text-rose-500 mt-0.5">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
                      <input
                        type="number"
                        step="any"
                        {...register(`items.${index}.quantity` as const)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                      <input
                        type="text"
                        {...register(`items.${index}.unit` as const)}
                        placeholder="e.g. Bags"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Packages</label>
                      <input
                        type="number"
                        {...register(`items.${index}.packageCount` as const)}
                        placeholder="e.g. 50"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Package Type</label>
                      <input
                        type="text"
                        {...register(`items.${index}.packageType` as const)}
                        placeholder="e.g. Pallets"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Weight (kg)</label>
                      <input
                        type="number"
                        step="any"
                        {...register(`items.${index}.weightKg` as const)}
                        placeholder="e.g. 2500"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sticky Dark Obsidian A4 Stage (55% -> 6 cols) */}
        <div className="lg:col-span-6">
          <ErrorBoundary fallbackTitle="Live A4 Waybill Preview Error">
            <A4StageContainer
              previewMode={previewMode}
              documentId={existingDoc?.id}
              onSaveDraft={onSaveDraft}
            >
              <LiveA4WaybillSheet
                formValues={formValues}
                company={company}
                selectedClient={selectedClient}
                documentNumber={existingDoc?.documentNumber}
              />
            </A4StageContainer>
          </ErrorBoundary>
        </div>
      </div>
      </ErrorBoundary>

      {/* 1-Click Supplies Catalog Picker Modal */}
      <CatalogPickerModal
        isOpen={activeCatalogIndex !== null}
        onClose={() => setActiveCatalogIndex(null)}
        onSelectItem={handleSelectCatalogItem}
      />
    </div>
  );
};
