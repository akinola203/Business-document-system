import React from 'react';
import { cn } from '../../lib/utils';

export interface BentoKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  iconColor?: string;
  trendText?: string;
  trendType?: 'up' | 'down' | 'neutral';
  children?: React.ReactNode;
  footerLabel?: string;
  footerAction?: string;
  onFooterClick?: () => void;
  className?: string;
}

export const BentoKpiCard: React.FC<BentoKpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-indigo-50',
  iconColor = 'text-[#5847F6]',
  trendText,
  trendType = 'neutral',
  children,
  footerLabel,
  footerAction,
  onFooterClick,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-[#F8F9FC] rounded-3xl p-6 border border-slate-200/70 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all duration-200',
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {Icon && (
            <span className={cn('p-2 rounded-2xl flex items-center justify-center', iconBgColor, iconColor)}>
              <Icon className="w-4 h-4" />
            </span>
          )}
        </div>

        <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
          {value}
        </div>

        {subtitle && (
          <p className="text-xs text-slate-500 font-medium mt-1">
            {subtitle}
          </p>
        )}

        {trendText && (
          <p
            className={cn(
              'text-xs font-semibold mt-1 flex items-center gap-1',
              trendType === 'up' && 'text-emerald-600',
              trendType === 'down' && 'text-rose-600',
              trendType === 'neutral' && 'text-slate-600',
            )}
          >
            {trendText}
          </p>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>

      {(footerLabel || footerAction) && (
        <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>{footerLabel}</span>
          {footerAction && (
            <button
              type="button"
              onClick={onFooterClick}
              className="font-bold text-[#5847F6] hover:text-[#4939E3] hover:underline transition-colors"
            >
              {footerAction} &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
};
