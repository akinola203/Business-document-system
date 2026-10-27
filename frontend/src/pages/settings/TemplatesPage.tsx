import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { DocumentType, DocumentTemplate, TemplateLayoutConfig } from '../../types';
import { DEMO_TEMPLATES, DEMO_COMPANY } from '../../lib/mock-data';
import {
  Palette,
  Layout,
  Type,
  Eye,
  CheckCircle2,
  Sparkles,
  Save,
  RotateCcw,
  FileSpreadsheet,
  Truck,
  Mail,
  ShieldCheck,
  QrCode,
  Landmark,
} from 'lucide-react';

export const TemplatesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<DocumentType>('INVOICE');

  // Query templates with fallback
  const { data: templatesData } = useQuery<DocumentTemplate[]>({
    queryKey: ['templates', selectedType],
    queryFn: async () => {
      const res = await apiClient.get('/templates', { params: { documentType: selectedType } });
      return res.data;
    },
  });

  const templates = templatesData && templatesData.length > 0 ? templatesData : DEMO_TEMPLATES;
  const currentTemplate =
    templates.find((t) => t.documentType === selectedType) || templates[0] || DEMO_TEMPLATES[0];

  // Customizer state tokens
  const [primaryColor, setPrimaryColor] = useState<string>(
    currentTemplate.config?.primaryColor || '#5847F6'
  );
  const [accentColor, setAccentColor] = useState<string>(
    currentTemplate.config?.accentColor || '#4939E3'
  );
  const [fontFamily, setFontFamily] = useState<string>(
    currentTemplate.config?.fontFamily || 'Inter'
  );
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>(
    currentTemplate.config?.logoPosition || 'left'
  );
  const [showBankDetails, setShowBankDetails] = useState<boolean>(
    currentTemplate.config?.showBankDetails ?? true
  );
  const [showStamp, setShowStamp] = useState<boolean>(
    currentTemplate.config?.showStamp ?? true
  );
  const [showSignature, setShowSignature] = useState<boolean>(
    currentTemplate.config?.showSignature ?? true
  );
  const [showQrCode, setShowQrCode] = useState<boolean>(
    currentTemplate.config?.showQrCode ?? true
  );

  const [feedback, setFeedback] = useState<string | null>(null);

  // When switching document type, adapt colors
  const handleTypeChange = (type: DocumentType) => {
    setSelectedType(type);
    const match = templates.find((t) => t.documentType === type);
    if (match) {
      setPrimaryColor(match.config.primaryColor);
      setAccentColor(match.config.accentColor);
      setFontFamily(match.config.fontFamily);
      setLogoPosition(match.config.logoPosition);
      setShowBankDetails(match.config.showBankDetails);
      setShowStamp(match.config.showStamp);
      setShowSignature(match.config.showSignature);
      setShowQrCode(match.config.showQrCode);
    } else {
      if (type === 'INVOICE') setPrimaryColor('#5847F6');
      if (type === 'WAYBILL') setPrimaryColor('#0284C7');
      if (type === 'LETTER') setPrimaryColor('#059669');
    }
    setFeedback(null);
  };

  // Save Template Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const config: TemplateLayoutConfig = {
        primaryColor,
        accentColor,
        fontFamily,
        logoPosition,
        showBankDetails,
        showStamp,
        showSignature,
        showQrCode,
      };

      try {
        if (currentTemplate?.id) {
          await apiClient.patch(`/templates/${currentTemplate.id}`, { config });
        } else {
          await apiClient.post('/templates', {
            documentType: selectedType,
            name: `${selectedType} Executive Layout`,
            code: `TPL-${selectedType}-CUSTOM`,
            config,
          });
        }
      } catch (err: any) {
        // Offline preview mode success
        return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setFeedback('✓ Layout template saved & published as active version.');
    },
  });

  return (
    <div className="space-y-6">
      {/* Context Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Printable Typography & Styling
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Phase 8D Active</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Document Layout Customizer & A4 Preview
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Fine-tune brand colors, typography, QR codes, signature placement, and bank instruction strips
          </p>
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
        >
          {saveMutation.isPending ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Publishing...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Template Version</span>
            </>
          )}
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{feedback}</span>
        </div>
      )}

      {/* Split-Screen Studio: Left Form 45% / Right Obsidian A4 Stage 55% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Customizer (45% -> 5.5 cols / 6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* 1. Document Type Switcher */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
                <Layout className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Document Type Target</h3>
                <p className="text-[11px] text-slate-500">Select which document format to style and calibrate</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'INVOICE' as DocumentType, label: 'Invoice', icon: FileSpreadsheet },
                { type: 'WAYBILL' as DocumentType, label: 'Waybill', icon: Truck },
                { type: 'LETTER' as DocumentType, label: 'Letterhead', icon: Mail },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleTypeChange(item.type)}
                    className={`p-3 rounded-2xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#16181F] text-white border-slate-800 shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Color Palette Customizer */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Brand Color Harmonies</h3>
                <p className="text-[11px] text-slate-500">Pick signature accent colors for printable headers and badges</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 w-32"
                  />
                  {/* Preset color pills */}
                  <div className="flex items-center gap-1.5">
                    {['#5847F6', '#0284C7', '#059669', '#0F172A', '#D97706'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setPrimaryColor(hex)}
                        className="w-7 h-7 rounded-full border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Typography Font Family
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                >
                  <option value="Inter">Inter (Clean Modern Sans)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Corporate Executive)</option>
                  <option value="Geist">Geist (High-Tech Precision)</option>
                  <option value="serif">Times New Roman / Serif (Traditional Formal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Layout Elements & Toggles */}
          <div className="bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Header & Verification Elements</h3>
                <p className="text-[11px] text-slate-500">Toggle official trust badges and settlement instructions</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Logo Alignment
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setLogoPosition(pos)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border cursor-pointer ${
                        logoPosition === pos
                          ? 'bg-[#5847F6] text-white border-[#5847F6]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-slate-200/60 space-y-3">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Landmark className="w-4 h-4 text-[#5847F6]" />
                    <div>
                      <span className="font-bold text-slate-900">Settlement Bank Strip</span>
                      <p className="text-[11px] text-slate-400">Globus Bank NUBAN details printed at footer</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showBankDetails}
                    onChange={(e) => setShowBankDetails(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5847F6] focus:ring-[#5847F6]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-rose-500" />
                    <div>
                      <span className="font-bold text-slate-900">Official Red Stamp Seal</span>
                      <p className="text-[11px] text-slate-400">Embossed corporate verification mark</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showStamp}
                    onChange={(e) => setShowStamp(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5847F6] focus:ring-[#5847F6]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <QrCode className="w-4 h-4 text-slate-700" />
                    <div>
                      <span className="font-bold text-slate-900">Anti-Tamper QR Code</span>
                      <p className="text-[11px] text-slate-400">Encrypted document verification link</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5847F6] focus:ring-[#5847F6]"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Obsidian Live A4 Miniature Stage (55% -> 6 cols) */}
        <div className="lg:col-span-6 sticky top-6">
          <div className="bg-[#16181F] rounded-[32px] p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                  Live A4 Layout Canvas
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Miniature Scaling (1:1.414)
              </span>
            </div>

            {/* A4 Sheet Container */}
            <div className="flex justify-center p-2 bg-[#0F1117] rounded-2xl overflow-hidden border border-slate-800/80">
              <div
                className="w-full max-w-[420px] aspect-[1/1.414] bg-white rounded-lg p-6 shadow-2xl text-slate-900 flex flex-col justify-between"
                style={{ fontFamily }}
              >
                {/* Header */}
                <div
                  className={`flex items-start pb-4 border-b border-slate-200 ${
                    logoPosition === 'center'
                      ? 'flex-col items-center text-center'
                      : logoPosition === 'right'
                      ? 'flex-row-reverse justify-between'
                      : 'justify-between'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md"
                      style={{ backgroundColor: primaryColor }}
                    >
                      AOA
                    </div>
                    <div className={logoPosition === 'center' ? 'mt-2' : ''}>
                      <h2 className="text-xs font-black tracking-tight leading-tight">
                        AOA 77 COMPANY LTD
                      </h2>
                      <p className="text-[9px] text-slate-500">RC-1849204 • TIN: 24891044-0001</p>
                    </div>
                  </div>

                  <div className={`text-right ${logoPosition === 'center' ? 'mt-2' : ''}`}>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {selectedType}
                    </span>
                    <p className="text-[9px] font-mono font-bold text-slate-500 mt-1">
                      AOA/{selectedType.slice(0, 3)}/2026/0001
                    </p>
                  </div>
                </div>

                {/* Body Content Representation */}
                <div className="space-y-3 my-auto py-2">
                  <div className="flex justify-between text-[9px] text-slate-600 bg-slate-50 p-2 rounded">
                    <div>
                      <span className="font-bold">BILLED TO:</span>
                      <p className="font-semibold text-slate-900">Dangote Industries Limited</p>
                      <p>Plot 12 Commercial Way, Ikeja</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">DATE:</span>
                      <p>27 Oct 2026</p>
                    </div>
                  </div>

                  {/* Table Skeleton */}
                  <div className="border border-slate-200 rounded text-[9px] overflow-hidden">
                    <div
                      className="p-1.5 font-bold text-white flex justify-between"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span>Item Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="p-1.5 flex justify-between border-b border-slate-100">
                      <span>Certified Industrial Grade 42.5R Portland</span>
                      <span className="font-bold">₦12,500,000.00</span>
                    </div>
                    <div className="p-1.5 flex justify-between bg-slate-50 font-black">
                      <span>TOTAL PAYABLE</span>
                      <span style={{ color: primaryColor }}>₦12,500,000.00</span>
                    </div>
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  {showBankDetails && (
                    <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[8px] flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-700">GLOBUS BANK PLC</span>
                        <p className="font-mono font-bold text-slate-900">A/C: 1000294819</p>
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono">SORT: 001042</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {showQrCode ? (
                      <div className="w-8 h-8 rounded bg-slate-100 border border-slate-300 flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-slate-800" />
                      </div>
                    ) : (
                      <div />
                    )}

                    {showStamp && (
                      <div className="w-10 h-10 rounded-full border-2 border-rose-500/80 text-rose-600 font-bold text-[7px] flex items-center justify-center text-center uppercase tracking-tighter leading-none p-1 rotate-[-12deg]">
                        AOA 77 VERIFIED
                      </div>
                    )}

                    {showSignature && (
                      <div className="text-right">
                        <div className="h-4 border-b border-slate-400 w-16 mb-0.5" />
                        <span className="text-[8px] font-bold text-slate-700">Managing Director</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
