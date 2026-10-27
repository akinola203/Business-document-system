import React from 'react';
import { Company } from '../../types';
import { formatDate } from '../../lib/utils';

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
  // Convert newlines in plain text to paragraphs
  const paragraphs = (formValues.bodyText || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="aspect-[1/1.414] w-full max-w-[680px] bg-white text-slate-900 shadow-2xl rounded-sm p-10 md:p-12 overflow-hidden text-left relative flex flex-col justify-between border border-slate-200">
      {/* 1. Official Corporate Letterhead */}
      <div>
        {/* Decorative Top Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-[#5847F6] to-indigo-600 rounded-full mb-6" />

        <div className="flex justify-between items-start pb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {company?.name || 'AOA 77 COMPANY LTD'}
            </h2>
            {company?.rcNumber && (
              <p className="text-[11px] font-mono text-slate-500 font-bold mt-0.5">
                RC: {company.rcNumber}
              </p>
            )}
            <p className="text-[11px] text-slate-600 max-w-sm mt-1 leading-relaxed">
              {company?.address || '1 Alade Ibukun Close, Ayo Irewolede CDA, Ewupe, Ota, Ogun State, Nigeria'}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mt-1">
              {company?.email && <span>Email: {company.email}</span>}
              {company?.phone && <span>Tel: {company.phone}</span>}
              {company?.tin && <span>TIN: {company.tin}</span>}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
              Reference Number
            </span>
            <p className="text-xs font-mono font-bold text-[#5847F6] mt-0.5">
              {documentNumber ? `#${documentNumber}` : 'AUTO-GENERATED ON SAVE'}
            </p>
            <div className="mt-3 text-[11px] text-slate-600">
              <span className="text-slate-400">Date: </span>
              <span className="font-semibold">{formatDate(formValues.letterDate || new Date().toISOString())}</span>
            </div>
          </div>
        </div>

        {/* 2. Recipient Address Block */}
        <div className="my-6 text-xs text-slate-700 leading-relaxed max-w-sm">
          <div className="font-extrabold text-slate-900 text-sm">
            {formValues.recipientName || 'Recipient Full Name'}
          </div>
          {formValues.recipientTitle && (
            <div className="font-medium text-slate-800">{formValues.recipientTitle}</div>
          )}
          {formValues.recipientOrganization && (
            <div className="font-semibold text-slate-800">{formValues.recipientOrganization}</div>
          )}
          {formValues.recipientAddress && (
            <div className="text-slate-600 mt-1 whitespace-pre-line text-[11px]">
              {formValues.recipientAddress}
            </div>
          )}
        </div>

        {/* 3. Formal Salutation & Subject Line */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-bold text-slate-800">
            Dear {formValues.recipientName ? `${formValues.recipientName},` : 'Sir/Madam,'}
          </div>

          {formValues.subject && (
            <div className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight border-b-2 border-slate-900 pb-1 inline-block">
              RE: {formValues.subject}
            </div>
          )}
        </div>

        {/* 4. Letter Body Content */}
        <div className="space-y-3.5 text-xs text-slate-700 leading-relaxed text-justify">
          {paragraphs.length === 0 ? (
            <p className="text-slate-400 italic">
              Draft your corporate correspondence in the editor on the left to see live typeset rendering.
            </p>
          ) : (
            paragraphs.map((para, i) => <p key={i}>{para}</p>)
          )}
        </div>
      </div>

      {/* 5. Sign-Off & Corporate Signatory Block */}
      <div className="pt-6 mt-8 border-t border-slate-200">
        <div className="text-xs font-medium text-slate-800 mb-6">
          Yours faithfully,
          <div className="text-[11px] text-slate-500 font-bold uppercase mt-0.5">
            For: {company?.name || 'AOA 77 COMPANY LTD'}
          </div>
        </div>

        <div className="space-y-1">
          {/* Simulated Signature Line */}
          <div className="w-44 border-b border-slate-400 mb-2" />
          <div className="font-extrabold text-slate-900 text-xs">
            {formValues.signatoryName || 'Authorized Signatory'}
          </div>
          {formValues.signatoryTitle && (
            <div className="text-[11px] text-slate-600 font-medium">
              {formValues.signatoryTitle}
            </div>
          )}
          {formValues.signatoryDepartment && (
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {formValues.signatoryDepartment}
            </div>
          )}
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
          <span>Confidential Corporate Communication</span>
          <span>Official Corporate Letterhead System</span>
        </div>
      </div>
    </div>
  );
};
