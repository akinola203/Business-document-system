import React from 'react';
import { RecessedTabNotch, TabItem } from './RecessedTabNotch';
import { SelectableDocumentFeed } from './SelectableDocumentFeed';
import { DocumentRecord, DocumentType } from '../../types';

interface ObsidianMasterDetailShellProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  documents: DocumentRecord[];
  selectedDocument: DocumentRecord | null;
  onSelectDocument: (doc: DocumentRecord) => void;
  isLoading?: boolean;
  documentType: DocumentType;
  inspector: React.ReactNode;
  emptyFeedMessage?: string;
}

export const ObsidianMasterDetailShell: React.FC<ObsidianMasterDetailShellProps> = ({
  tabs,
  activeTab,
  onTabChange,
  documents,
  selectedDocument,
  onSelectDocument,
  isLoading = false,
  documentType,
  inspector,
  emptyFeedMessage,
}) => {
  return (
    <div className="w-full bg-[#16181F] text-white rounded-[32px] p-6 md:p-8 shadow-2xl border border-slate-800">
      {/* 1. Top Center Recessed Tab Notch */}
      <RecessedTabNotch
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      {/* 2. 40% / 60% Split Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane (40% width / 5 cols) */}
        <div className="lg:col-span-5">
          <SelectableDocumentFeed
            documents={documents}
            selectedId={selectedDocument?.id || null}
            onSelect={onSelectDocument}
            isLoading={isLoading}
            documentType={documentType}
            emptyMessage={emptyFeedMessage}
          />
        </div>

        {/* Right Pane (60% width / 7 cols) */}
        <div className="lg:col-span-7">
          {selectedDocument ? (
            inspector
          ) : (
            <div className="w-full h-80 rounded-[28px] bg-[#1E2029] border border-[#282B37] flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <p className="text-sm font-semibold text-slate-300">No document selected</p>
              <p className="text-xs text-slate-500 mt-1">
                Select a document from the left list to inspect line items, download PDFs, and
                trigger approvals.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
