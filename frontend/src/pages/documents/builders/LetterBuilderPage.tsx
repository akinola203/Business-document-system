import React, { useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Client, Company, DocumentRecord } from '../../../types';
import { LETTER_DEMO_PRESETS } from '../../../lib/demo-presets';
import { useAuthStore } from '../../../store/auth.store';
import { StudioHeaderBar } from '../../../components/builder/StudioHeaderBar';
import { A4StageContainer } from '../../../components/builder/A4StageContainer';
import { LiveA4LetterSheet } from '../../../components/builder/LiveA4LetterSheet';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { extractArray } from '../../../lib/utils';
import {
  Mail,
  User,
  Building,
  Calendar,
  FileText,
  PenTool,
  CheckCircle2,
} from 'lucide-react';

// Zod Validation Schema for Letters
const letterFormSchema = z.object({
  title: z.string().min(3, 'Internal title must be at least 3 characters'),
  clientId: z.string().optional(),
  letterDate: z.string().optional(),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientTitle: z.string().optional(),
  recipientOrganization: z.string().optional(),
  recipientAddress: z.string().optional(),
  subject: z.string().min(3, 'Subject line is required'),
  bodyText: z.string().min(10, 'Letter body must be at least 10 characters'),
  signatoryName: z.string().min(1, 'Signatory name is required'),
  signatoryTitle: z.string().optional(),
  signatoryDepartment: z.string().optional(),
  templateId: z.string().optional(),
});

type LetterFormValues = z.infer<typeof letterFormSchema>;

export const LetterBuilderPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [previewMode, setPreviewMode] = React.useState<'LIVE' | 'SERVER'>('LIVE');

  // 1. Fetch Company Profile
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
    return extractArray<Client>(clientsData);
  }, [clientsData]);

  // Fetch Templates for Letters
  const { data: templatesData } = useQuery<any>({
    queryKey: ['templates-letter'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/templates', { params: { documentType: 'LETTER' } });
        return res.data;
      } catch {
        return [];
      }
    },
  });
  const templates: any[] = useMemo(() => {
    return extractArray<any>(templatesData);
  }, [templatesData]);

  // 3. Fetch Existing Document if in Edit Mode
  const { data: existingDoc, isLoading: isDocLoading } = useQuery<DocumentRecord>({
    queryKey: ['document', id],
    queryFn: async () => {
      if (!id) throw new Error('No document ID');
      const res = await apiClient.get(`/documents/${id}`);
      return res.data?.data ?? res.data;
    },
    enabled: isEdit,
    refetchOnWindowFocus: false,
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Initialize React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<LetterFormValues>({
    resolver: zodResolver(letterFormSchema) as any,
    defaultValues: {
      title: 'Official Executive Correspondence',
      clientId: '',
      letterDate: todayStr,
      recipientName: 'Dr. Babatunde Raji',
      recipientTitle: 'Director of Procurement',
      recipientOrganization: 'Dangote Industries Limited',
      recipientAddress: 'Plot 12 Commercial Way, Ikeja, Lagos State, Nigeria',
      subject: 'Formal Quotation & Delivery Framework for Bulk Industrial Materials',
      bodyText:
        'We have the pleasure of submitting our corporate proposal for the supply of certified high-grade industrial materials for your upcoming infrastructure projects.\n\nOur manufacturing and logistics facilities ensure guaranteed continuous supply lines, verified quality certification, and rapid haulage turnarounds across all geopolitical zones.\n\nWe remain at your disposal to discuss commercial terms, customized schedules, and dedicated account management.',
      signatoryName: user?.fullName || 'Alade Adebayo',
      signatoryTitle: 'Managing Director',
      signatoryDepartment: 'Executive Management',
    },
  });

  const lastLoadedVersionRef = useRef<number | null>(null);

  // Populate form if editing
  useEffect(() => {
    if (existingDoc && isEdit) {
      if (lastLoadedVersionRef.current === existingDoc.versionCounter && isDirty) {
        return;
      }
      lastLoadedVersionRef.current = existingDoc.versionCounter ?? null;
      const letData = existingDoc.letter;
      reset({
        title: existingDoc.title,
        clientId: existingDoc.clientId || '',
        letterDate: letData?.letterDate ? letData.letterDate.split('T')[0] : todayStr,
        recipientName: letData?.recipientName || '',
        recipientTitle: letData?.recipientTitle || '',
        recipientOrganization: letData?.recipientOrganization || '',
        recipientAddress: letData?.recipientAddress || '',
        subject: letData?.subject || '',
        bodyText: letData?.bodyText || '',
        signatoryName: letData?.signatoryName || user?.fullName || '',
        signatoryTitle: letData?.signatoryTitle || '',
        signatoryDepartment: letData?.signatoryDepartment || '',
        templateId: existingDoc.templateId || undefined,
      });
    }
  }, [existingDoc, isEdit, reset, todayStr, user, isDirty]);

  const formValues = watch();

  // Quick autofill when client is selected
  const handleClientChange = (clientId: string) => {
    setValue('clientId', clientId, { shouldDirty: true });
    if (!clientId) return;

    const cl = clients.find((c) => c.id === clientId);
    if (cl) {
      if (cl.name) setValue('recipientName', cl.name, { shouldDirty: true });
      if (cl.companyName) setValue('recipientOrganization', cl.companyName, { shouldDirty: true });
      const addr = cl.addresses?.find((a) => a.isDefault)?.line1 || cl.addresses?.[0]?.line1 || cl.address;
      if (addr) setValue('recipientAddress', addr, { shouldDirty: true });
    }
  };

  useEffect(() => {
    if (!isEdit && clients.length > 0) {
      const currentId = formValues?.clientId;
      const isCurrentValid = clients.some((c) => c?.id === currentId);
      if (!currentId || !isCurrentValid) {
        handleClientChange(clients[0].id);
      }
    }
  }, [clients, isEdit, formValues?.clientId]);

  const [searchParams] = useSearchParams();
  const hasPresetLoadedRef = useRef(false);

  const handleLoadDemoPreset = (presetKey: string = 'tender') => {
    const preset = LETTER_DEMO_PRESETS[presetKey] || LETTER_DEMO_PRESETS.tender;
    const matchingClient = clients.find((c) =>
      c.name?.toLowerCase().includes('dangote') || (c.companyName || '').toLowerCase().includes('dangote')
    ) || clients[0];

    reset({
      title: preset.title,
      clientId: matchingClient ? matchingClient.id : formValues.clientId || '',
      letterDate: new Date().toISOString().split('T')[0],
      recipientName: preset.recipientName,
      recipientTitle: preset.recipientTitle,
      recipientOrganization: preset.recipientCompany,
      recipientAddress: preset.recipientAddress,
      subject: preset.subject,
      bodyText: preset.bodyParagraphs.join('\n\n'),
      signatoryName: preset.signatoryName,
      signatoryTitle: preset.signatoryTitle,
      signatoryDepartment: preset.signatoryDepartment,
    });
  };

  useEffect(() => {
    const presetParam = searchParams.get('preset');
    if (presetParam && !isEdit && !hasPresetLoadedRef.current && LETTER_DEMO_PRESETS[presetParam]) {
      hasPresetLoadedRef.current = true;
      handleLoadDemoPreset(presetParam);
    }
  }, [searchParams, clients, isEdit]);

  // Save Draft Mutation (POST /letters or PATCH /letters/:id)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: LetterFormValues) => {
      // Generate clean paragraph HTML from bodyText
      const bodyHtml = data.bodyText
        .split('\n\n')
        .map((p) => `<p>${p.trim()}</p>`)
        .join('');

      const payload = {
        title: data.title,
        clientId: data.clientId || undefined,
        letterDate: data.letterDate ? new Date(data.letterDate).toISOString() : undefined,
        recipientName: data.recipientName,
        recipientTitle: data.recipientTitle || undefined,
        recipientOrganization: data.recipientOrganization || undefined,
        recipientAddress: data.recipientAddress || undefined,
        subject: data.subject,
        bodyText: data.bodyText,
        bodyHtml,
        signatoryName: data.signatoryName,
        signatoryTitle: data.signatoryTitle || undefined,
        signatoryDepartment: data.signatoryDepartment || undefined,
        templateId: data.templateId || undefined,
        ...(isEdit && existingDoc ? { expectedVersion: existingDoc.versionCounter } : {}),
      };

      if (isEdit && id) {
        const res = await apiClient.patch(`/letters/${id}`, payload);
        return res.data?.data || res.data;
      } else {
        const res = await apiClient.post('/letters', payload);
        return res.data?.data || res.data;
      }
    },
    onSuccess: (savedDoc) => {
      const realDoc = savedDoc?.data || savedDoc;
      queryClient.invalidateQueries({ queryKey: ['letters'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['document', id] });
      } else if (realDoc?.id) {
        queryClient.invalidateQueries({ queryKey: ['document', realDoc.id] });
      }
      if (!isEdit && realDoc?.id) {
        navigate(`/documents/letters/${realDoc.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save letter draft.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Save & Submit for Approval Mutation
  const saveAndSubmitMutation = useMutation({
    mutationFn: async (data: LetterFormValues) => {
      let docId = id;
      if (!docId) {
        const draftRes = await saveDraftMutation.mutateAsync(data);
        docId = draftRes?.data?.id || draftRes?.id;
      } else {
        await saveDraftMutation.mutateAsync(data);
      }

      if (!docId) {
        throw new Error('Unable to resolve created letter ID for submission.');
      }

      const submitRes = await apiClient.post(`/documents/${docId}/submit`, {
        notes: 'Submitted directly from Letter Split-Screen Studio',
      });
      return submitRes.data?.data || submitRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letters'] });
      queryClient.invalidateQueries({ queryKey: ['overview-recent-documents'] });
      navigate('/documents/letters');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Submission failed. Please check sign-off permissions.';
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
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Loading letter studio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Finnova Studio Header Bar */}
      <StudioHeaderBar
        documentType="LETTER"
        documentTitle={formValues?.title || 'New Letter'}
        documentNumber={existingDoc?.documentNumber}
        isEdit={isEdit}
        version={existingDoc?.versionCounter || existingDoc?.version || 1}
        status={existingDoc?.status || 'DRAFT'}
        backPath="/documents/letters"
        previewMode={previewMode}
        onTogglePreviewMode={setPreviewMode}
        onSaveDraft={onSaveDraft}
        onSubmitForApproval={onSubmitForApproval}
        isSavingDraft={saveDraftMutation.isPending}
        isSubmitting={saveAndSubmitMutation.isPending}
        isDirty={isDirty}
        onQuickFillDemo={() => handleLoadDemoPreset('tender')}
      />

      {/* 2. Split-Screen Studio Layout */}
      <ErrorBoundary fallbackTitle="Letter Studio Workspace Error">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Interactive Form Studio (45% -> 6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Recipient Corporate Addressee */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Recipient & Corporate Addressee</h3>
                <p className="text-[11px] text-slate-500">Target individual, corporate title, and delivery address</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Quick-Fill from Clients Directory <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {clients.length} Clients Available
                  </span>
                </div>
                {/* 1-Tap Quick-Fill Pill Buttons & Demo Presets */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <button
                    type="button"
                    onClick={() => handleLoadDemoPreset('tender')}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    ⚡ Tender Letter Demo
                  </button>
                  {(Array.isArray(clients) ? clients : []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClientChange(c.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                        formValues?.clientId === c.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                          : 'bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 border-slate-200'
                      }`}
                    >
                      ⚡ {(c.companyName || c.name || 'Client').split(' ')[0]}
                    </button>
                  ))}
                </div>
                <select
                  value={formValues?.clientId || ''}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Select a client to auto-fill addressee...</option>
                  {(Array.isArray(clients) ? clients : []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Client'} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recipient Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('recipientName')}
                    placeholder="e.g. Dr. Babatunde Raji"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {errors.recipientName && (
                    <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.recipientName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Title / Designation</label>
                  <input
                    type="text"
                    {...register('recipientTitle')}
                    placeholder="e.g. Director of Procurement"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization / Corporate Entity</label>
                <input
                  type="text"
                  {...register('recipientOrganization')}
                  placeholder="e.g. Dangote Industries Limited"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Address</label>
                <textarea
                  {...register('recipientAddress')}
                  rows={2}
                  placeholder="Plot number, street, city, state and postal designation..."
                  className="w-full px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Letter Context & Subject Line */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Document Context & Subject</h3>
                <p className="text-[11px] text-slate-500">Official letter date and primary subject matter</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Internal Title</label>
                  <input
                    type="text"
                    {...register('title')}
                    placeholder="e.g. Supply Framework Notice"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Letter Date</label>
                  <input
                    type="date"
                    {...register('letterDate')}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Subject Line (RE:) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('subject')}
                  placeholder="e.g. Formal Quotation & Delivery Framework for Bulk Industrial Materials"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {errors.subject && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.subject.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Executive Letter Body Editor */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Letter Body Editor</h3>
                <p className="text-[11px] text-slate-500">Separate paragraphs with double newlines for live typesetting</p>
              </div>
            </div>

            <div>
              <textarea
                {...register('bodyText')}
                rows={9}
                placeholder="Write the official business correspondence here. Each paragraph separated by an empty line will format cleanly on the A4 letterhead..."
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
              {errors.bodyText && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.bodyText.message}</p>
              )}
            </div>
          </div>

          {/* Card 4: Corporate Signatory & Authorization */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Corporate Signatory</h3>
                <p className="text-[11px] text-slate-500">Authorized corporate executive appending official sign-off</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Signatory Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('signatoryName')}
                  placeholder="e.g. Alade Adebayo"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Signatory Title</label>
                <input
                  type="text"
                  {...register('signatoryTitle')}
                  placeholder="e.g. Managing Director"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  {...register('signatoryDepartment')}
                  placeholder="e.g. Executive Management"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Dark Obsidian A4 Stage (55% -> 6 cols) */}
        <div className="lg:col-span-6">
          <ErrorBoundary fallbackTitle="Live A4 Letter Preview Error">
            <A4StageContainer
              previewMode={previewMode}
              documentId={existingDoc?.id}
              onSaveDraft={onSaveDraft}
            >
              <LiveA4LetterSheet
                formValues={formValues}
                company={company}
                documentNumber={existingDoc?.documentNumber}
              />
            </A4StageContainer>
          </ErrorBoundary>
        </div>
      </div>
      </ErrorBoundary>
    </div>
  );
};
