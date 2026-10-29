import React from 'react';
import { Company } from '../../types';
import { formatDate } from '../../lib/utils';
import { Shield, Award, CheckCircle } from 'lucide-react';

export interface LetterLiveFormValues {
  title: string;
  clientId?: string;
  letterDate?: string;
  recipientName: string;
  recipientTitle?: string;
  recipientOrganization?: string;
  recipientAddress?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  signatoryName: string;
  signatoryTitle?: string;
  signatoryDepartment?: string;
}

interface LiveA4LetterSheetProps {
  formValues: LetterLiveFormValues;
  company?: Company | null;
  documentNumber?: string | null;
}

export const LiveA4LetterSheet: React.FC<LiveA4LetterSheetProps> = ({
  formValues,
  company,
  documentNumber,
}) => {
  // Convert newlines in plain text to clean paragraphs
  const paragraphs = (formValues.bodyText || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="aspect-[1/1.414] w-full max-w-[680px] shrink-0 bg-white text-slate-900 shadow-2xl rounded-sm p-10 md:p-14 overflow-hidden text-left relative flex flex-col justify-between border border-slate-300 my-auto">
      {/* 1. Official Corporate Letterhead */}
      <div>
        {/* Executive Letterhead Crest & Branding */}
        <div className="text-center pb-5 border-b-2 border-slate-900">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 text-white font-black text-sm tracking-wider mb-2 shadow-sm">
            AOA
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
            {company?.legalName || company?.name || 'AOA 77 COMPANY LIMITED'}
          </h1>
          <div className="flex items-center justify-center gap-3 text-[10px] font-mono font-bold text-slate-600 mt-0.5">
            {company?.rcNumber && <span>CAC RC: {company.rcNumber}</span>}
            <span>&bull;</span>
            <span>FIRS TIN: {company?.tin || '24891044-0001'}</span>
          </div>
          {company?.address && (
            <p className="text-[11px] text-slate-600 max-w-lg mx-auto mt-1 leading-snug">
              {company.address}
            </p>
          )}
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 mt-1">
            <span>Email: {company?.email || 'contact@aoa77.com'}</span>
            <span>Tel: {company?.phone || '+234 803 000 0001'}</span>
            {company?.website && <span>Web: {company.website}</span>}
          </div>
        </div>

        {/* Double Gold/Slate Accent Rule */}
        <div className="h-0.5 w-full bg-gradient-to-r from-slate-900 via-amber-600 to-slate-900 mt-0.5 mb-6" />

        {/* 2. Reference Number & Formal Date Bar */}
        <div className="flex justify-between items-baseline text-xs mb-6 pb-2 border-b border-slate-100">
          <div className="font-mono text-slate-700">
            <span className="font-bold text-slate-400 uppercase text-[10px] block">Our Reference:</span>
            <span className="font-extrabold text-slate-900">
              {documentNumber ? `REF: #${documentNumber}` : 'REF: AOA/CORP/2026/001'}
            </span>
          </div>
          <div className="text-right">
            <span className="font-bold text-slate-400 uppercase text-[10px] block">Date of Letter:</span>
            <span className="font-bold text-slate-900">
              {formatDate(formValues.letterDate || new Date().toISOString())}
            </span>
          </div>
        </div>

        {/* 3. Formal Recipient Block */}
        <div className="mb-6 text-xs text-slate-700 leading-relaxed max-w-md">
          <div className="font-extrabold text-slate-950 text-sm">
            {formValues.recipientName || 'Recipient Full Name'}
          </div>
          {formValues.recipientTitle && (
            <div className="font-semibold text-slate-800">{formValues.recipientTitle}</div>
          )}
          {formValues.recipientOrganization && (
            <div className="font-bold text-slate-900">{formValues.recipientOrganization}</div>
          )}
          {formValues.recipientAddress && (
            <div className="text-slate-600 mt-1 whitespace-pre-line text-[11px] leading-relaxed">
              {formValues.recipientAddress}
            </div>
          )}
        </div>

        {/* 4. Formal Salutation & Subject Line */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-bold text-slate-800">
            Dear {formValues.recipientName ? `${formValues.recipientName},` : 'Sir/Madam,'}
          </div>

          {formValues.subject && (
            <div className="py-1">
              <span className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight border-b-2 border-slate-900 pb-0.5 inline-block">
                RE: {formValues.subject}
              </span>
            </div>
          )}
        </div>

        {/* 5. Letter Body Content */}
        <div className="space-y-3.5 text-xs text-slate-800 leading-relaxed text-justify">
          {paragraphs.length === 0 ? (
            <p className="text-slate-400 italic">
              Draft your corporate correspondence in the editor on the left to see live typeset rendering.
            </p>
          ) : (
            paragraphs.map((para, i) => (
              <p key={i} className="leading-relaxed">
                {para}
              </p>
            ))
          )}
        </div>
      </div>

      {/* 6. Executive Sign-Off & Corporate Signatory Block */}
      <div className="pt-6 mt-8 border-t border-slate-200">
        <div className="text-xs font-medium text-slate-800 mb-6">
          Yours faithfully,
          <div className="text-[11px] text-slate-900 font-extrabold uppercase tracking-wider mt-0.5">
            For: {company?.legalName || company?.name || 'AOA 77 COMPANY LIMITED'}
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            {/* Executive Signature Line */}
            <div className="w-48 border-b-2 border-slate-800 mb-2" />
            <div className="font-black text-slate-900 text-xs">
              {formValues.signatoryName || 'Chief Executive / Managing Director'}
            </div>
            {formValues.signatoryTitle && (
              <div className="text-[11px] text-slate-700 font-bold">
                {formValues.signatoryTitle}
              </div>
            )}
            {formValues.signatoryDepartment && (
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {formValues.signatoryDepartment}
              </div>
            )}
          </div>

          {/* Official Seal / Stamp Placeholder */}
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-[9px] text-slate-400 font-bold uppercase text-center p-2 select-none">
            <span>Official</span>
            <span>Corporate</span>
            <span>Seal</span>
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-200 flex justify-between text-[9px] text-slate-400">
          <span>Official Corporate Correspondence &bull; Confidential &bull; {company?.name || 'AOA 77 COMPANY LIMITED'}</span>
          <span>CAC Registered Enterprise</span>
        </div>
      </div>
    </div>
  );
};
