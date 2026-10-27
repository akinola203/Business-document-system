import React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface RecessedTabNotchProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export const RecessedTabNotch: React.FC<RecessedTabNotchProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="w-full flex justify-center mb-6">
      <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full bg-[#1E2029] border border-[#282B37] shadow-inner max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap',
                isActive
                  ? 'bg-white text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums',
                    isActive
                      ? 'bg-[#5847F6] text-white'
                      : 'bg-white/10 text-slate-400',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
