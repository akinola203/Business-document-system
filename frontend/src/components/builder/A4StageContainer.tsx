import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Printer, Sparkles, Server, FileText, RefreshCw, AlertCircle, Download } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { downloadDocumentPdf } from '../../lib/pdf-download';

interface A4StageContainerProps {
  previewMode: 'LIVE' | 'SERVER';
  documentId?: string | null;
  onSaveDraft?: () => void;
  children: React.ReactNode;
}

export const A4StageContainer: React.FC<A4StageContainerProps> = ({
  previewMode,
  documentId,
  onSaveDraft,
  children,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.75, 1.0, or Fit (0.85)
  const [serverPreviewType, setServerPreviewType] = useState<'HTML' | 'PDF'>('HTML');
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch server preview when switching to SERVER mode if document has an ID
  const fetchServerPreview = async () => {
    if (!documentId) return;
    setIsServerLoading(true);
    setServerError(null);

    try {
      if (serverPreviewType === 'HTML') {
        const res = await apiClient.get(`/documents/${documentId}/preview`);
        setHtmlContent(res.data);
      } else {
        const res = await apiClient.get(`/documents/${documentId}/preview-pdf`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        setPdfBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Failed to generate server preview. Please ensure draft is saved.'
      );
    } finally {
      setIsServerLoading(false);
    }
  };

  React.useEffect(() => {
    if (previewMode === 'SERVER' && documentId) {
      fetchServerPreview();
    }
  }, [previewMode, documentId, serverPreviewType]);

  React.useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!documentId) {
      if (onSaveDraft) {
        onSaveDraft();
      } else {
        alert('Please save the draft document first to download the PDF.');
      }
      return;
    }

    setIsDownloadingPdf(true);
    try {
      await downloadDocumentPdf({
        documentId,
        isPreview: previewMode === 'LIVE',
      });
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      alert(err?.message || 'Unable to generate or download document PDF. Please check server logs.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="bg-[#16181F] rounded-[32px] p-4 md:p-6 shadow-2xl flex flex-col items-center min-h-[840px] sticky top-6 border border-white/10 text-white overflow-hidden">
      {/* 1. Stage Top Controls Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10 px-2">
        {/* Left Status Indicator */}
        <div className="flex items-center gap-2">
          {previewMode === 'LIVE' ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live 60fps Sync</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>Phase-7 Headless Renderer</span>
            </div>
          )}
        </div>

        {/* Center: Zoom Controls */}
        {previewMode === 'LIVE' && (
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel(0.75)}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                zoomLevel === 0.75 ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(0.9)}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                zoomLevel === 0.9 ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                zoomLevel === 1.0 ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              100%
            </button>
          </div>
        )}

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {previewMode === 'SERVER' && documentId && (
            <div className="flex items-center bg-white/5 border border-white/10 p-0.5 rounded-full text-xs">
              <button
                type="button"
                onClick={() => setServerPreviewType('HTML')}
                className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                  serverPreviewType === 'HTML' ? 'bg-[#5847F6] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setServerPreviewType('PDF')}
                className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                  serverPreviewType === 'PDF' ? 'bg-[#5847F6] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={fetchServerPreview}
                disabled={isServerLoading}
                className="p-1 rounded-full text-slate-400 hover:text-white ml-1"
                title="Refresh Server Render"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isServerLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            title="📥 Download PDF to Device"
          >
            {isDownloadingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Download PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* 2. Main Stage Stage Viewing Area */}
      <div className="w-full flex-1 flex justify-center items-start overflow-y-auto max-h-[calc(100vh-210px)] min-h-[640px] py-8 md:py-12 px-3 md:px-6 a4-scroll dark-scroll">
        {previewMode === 'LIVE' ? (
          <div
            className="w-full flex justify-center transition-transform duration-200 origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {children}
          </div>
        ) : (
          /* Server Preview Mode */
          <div className="w-full flex flex-col items-center justify-center min-h-[600px]">
            {!documentId ? (
              <div className="max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 text-center space-y-4 backdrop-blur-md">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Server className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Save Draft to Preview Server Render</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Phase-7 server-side preview compiles CSS templates and typography via Headless Chrome. Save your initial draft first to generate the render.
                  </p>
                </div>
                {onSaveDraft && (
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    className="px-5 py-2 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all inline-flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Save Draft Now</span>
                  </button>
                )}
              </div>
            ) : isServerLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-[#5847F6]" />
                <span className="text-xs font-semibold">Compiling Server-Side Document Layout...</span>
              </div>
            ) : serverError ? (
              <div className="max-w-md p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
                <h4 className="text-sm font-bold text-rose-300">Server Render Error</h4>
                <p className="text-xs text-rose-400/90">{serverError}</p>
                <button
                  type="button"
                  onClick={fetchServerPreview}
                  className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
                >
                  Retry Render
                </button>
              </div>
            ) : serverPreviewType === 'HTML' && htmlContent ? (
              <div className="w-full max-w-[700px] bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300">
                <iframe
                  title="Server HTML Preview"
                  srcDoc={htmlContent}
                  className="w-full h-[850px] border-none"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : serverPreviewType === 'PDF' && pdfBlobUrl ? (
              <div className="w-full max-w-[700px] h-[850px] bg-white rounded-lg shadow-2xl overflow-hidden">
                <iframe
                  title="Server PDF Preview"
                  src={pdfBlobUrl}
                  className="w-full h-full border-none"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-12">No preview content generated.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
