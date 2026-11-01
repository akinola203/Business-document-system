import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { DocumentType, TemplateLayoutConfig } from '../../types';

interface LiveA4LayoutCanvasProps {
  documentType: DocumentType;
  fontFamily: string;
  templateConfig: Partial<TemplateLayoutConfig>;
  children: React.ReactNode;
}

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PADDING = 20;

export const LiveA4LayoutCanvas: React.FC<LiveA4LayoutCanvasProps> = ({
  documentType,
  fontFamily,
  templateConfig,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoomMode, setZoomMode] = useState<'fit' | 'fit-width' | number>('fit');

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      if (el) {
        setContainerSize({
          width: el.clientWidth,
          height: el.clientHeight,
        });
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width || (entry.target as HTMLElement).clientWidth;
          const height = entry.contentRect.height || (entry.target as HTMLElement).clientHeight;
          if (width > 0 && height > 0) {
            setContainerSize({ width, height });
          }
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  // Compute scale based on zoom mode and available container dimensions
  const currentScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return 0.55;

    const availW = Math.max(160, containerSize.width - PADDING * 2);
    const availH = Math.max(200, containerSize.height - PADDING * 2);

    if (zoomMode === 'fit-width') {
      return Math.min(1.2, Math.max(0.3, availW / A4_WIDTH));
    }

    if (zoomMode === 'fit') {
      const scaleW = availW / A4_WIDTH;
      const scaleH = availH / A4_HEIGHT;
      // Fit both dimensions inside viewport so sheet is 100% visible without clipping
      return Math.min(1.0, Math.max(0.3, Math.min(scaleW, scaleH)));
    }

    return typeof zoomMode === 'number' ? zoomMode : 1.0;
  }, [containerSize, zoomMode]);

  const handleZoomIn = () => {
    setZoomMode((prev) => {
      const base = typeof prev === 'number' ? prev : currentScale;
      return Math.min(1.5, Math.round((base + 0.1) * 10) / 10);
    });
  };

  const handleZoomOut = () => {
    setZoomMode((prev) => {
      const base = typeof prev === 'number' ? prev : currentScale;
      return Math.max(0.3, Math.round((base - 0.1) * 10) / 10);
    });
  };

  const formattedScalePct = Math.round(currentScale * 100);

  return (
    <div className="bg-[#16181F] rounded-[32px] p-5 shadow-2xl border border-slate-800 space-y-3.5 flex flex-col">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Live A4 Layout Canvas</span>
              <span className="text-[#5847F6] font-mono">•</span>
              <span className="text-slate-300 font-bold">{documentType}</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              ISO 216 Standard (210 × 297 mm &bull; 794 × 1123 px)
            </p>
          </div>
        </div>

        {/* Viewport Zoom & Scaling Controls */}
        <div className="flex items-center gap-1.5 bg-[#0B0D13] p-1 rounded-full border border-slate-800">
          <button
            type="button"
            onClick={() => setZoomMode('fit')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
              zoomMode === 'fit'
                ? 'bg-[#5847F6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Auto-Fit Page (Full A4 Visible at Once)"
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('fit-width')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
              zoomMode === 'fit-width'
                ? 'bg-[#5847F6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Fit Width (Maximize Horizontal Reading)"
          >
            Fit Width
          </button>
          <button
            type="button"
            onClick={() => setZoomMode(1.0)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
              zoomMode === 1.0
                ? 'bg-[#5847F6] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="100% Full Print Scale"
          >
            100%
          </button>

          <div className="w-px h-3.5 bg-slate-800 mx-0.5" />

          {/* Step Zoom */}
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-300 w-9 text-center tabular-nums">
            {formattedScalePct}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Scaled A4 Dark Stage Viewing Area */}
      <div
        ref={containerRef}
        className={`w-full bg-[#0A0C10] rounded-2xl border border-slate-800/80 relative flex ${
          zoomMode === 'fit' ? 'items-center justify-center overflow-hidden' : 'items-start justify-center overflow-auto'
        } min-h-[580px] h-[calc(100vh-230px)] max-h-[860px] a4-scroll dark-scroll p-4 md:p-6 transition-all duration-300`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(88, 71, 246, 0.05) 0%, transparent 60%)',
        }}
      >
        {/* Scaled A4 Boundary Box */}
        <div
          className="relative shrink-0 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-200 ease-out"
          style={{
            width: `${A4_WIDTH * currentScale}px`,
            height: `${A4_HEIGHT * currentScale}px`,
          }}
        >
          {/* Unscaled 794x1123 Container with Transform Scale from Top-Left */}
          <div
            className="origin-top-left transition-transform duration-200 ease-out"
            style={{
              width: `${A4_WIDTH}px`,
              minHeight: `${A4_HEIGHT}px`,
              transform: `scale(${currentScale})`,
              transformOrigin: 'top left',
              fontFamily: fontFamily || 'inherit',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
