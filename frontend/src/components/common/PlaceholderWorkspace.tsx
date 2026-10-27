import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlaceholderWorkspaceProps {
  title: string;
  subtitle: string;
  badge: string;
  phase: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PlaceholderWorkspace: React.FC<PlaceholderWorkspaceProps> = ({
  title,
  subtitle,
  badge,
  phase,
  icon: Icon,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Context Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/overview')}
            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
                {badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Finnova Placeholder Bento Card */}
      <div className="bg-[#16181F] text-white rounded-[32px] p-10 md:p-14 text-center shadow-xl border border-slate-800 flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-16 h-16 rounded-3xl bg-[#1E2029] border border-[#282B37] flex items-center justify-center text-[#5847F6] shadow-lg shadow-indigo-500/10 mb-5">
          <Icon className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5847F6]/15 border border-[#5847F6]/30 text-[#5847F6] text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Scheduled for {phase}</span>
        </div>
        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-2">
          {title} Workspace Ready for Implementation
        </h2>
        <p className="text-xs md:text-sm text-slate-400 max-w-md leading-relaxed mb-6">
          Phase 8A foundation shell is active. This workspace will feature the 4-tier Finnova Bento
          KPI grid, Dark Obsidian Master-Detail Split View, and Royal Indigo Inspector.
        </p>
        <button
          onClick={() => navigate('/overview')}
          className="px-6 py-2.5 rounded-full bg-white text-[#16181F] text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm"
        >
          Return to Overview
        </button>
      </div>
    </div>
  );
};
