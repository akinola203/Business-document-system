import React from 'react';
import { Search, X, SlidersHorizontal, Calendar, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DocumentStatus } from '../../types';

export interface FilterState {
  search: string;
  status: string;
  clientId: string;
  startDate: string;
  endDate: string;
}

interface PillFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onClear: () => void;
  statusOptions?: Array<{ label: string; value: string }>;
  clientOptions?: Array<{ label: string; value: string }>;
  showClientFilter?: boolean;
}

const DEFAULT_STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Issued', value: 'ISSUED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export const PillFilterBar: React.FC<PillFilterBarProps> = ({
  filters,
  onFilterChange,
  onClear,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  clientOptions = [],
  showClientFilter = true,
}) => {
  // Count active filters
  const activeCount = [
    filters.search,
    filters.status,
    filters.clientId,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#F8F9FC] border border-slate-200/70">
      <div className="flex flex-wrap items-center gap-2">
        {/* Active Filters Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#5847F6]" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#5847F6] text-white text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </div>

        {/* Search Input Pill */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search # number, title..."
            className="pl-8 pr-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6] shadow-sm w-44 md:w-56"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status Pill Select */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value })}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] transition-colors cursor-pointer',
            filters.status
              ? 'bg-[#5847F6]/10 text-[#5847F6] border-[#5847F6]/30 font-semibold'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
          )}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Client / Customer Pill Select (optional) */}
        {showClientFilter && clientOptions.length > 0 && (
          <select
            value={filters.clientId}
            onChange={(e) => onFilterChange({ clientId: e.target.value })}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium border shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] transition-colors cursor-pointer max-w-[180px] truncate',
              filters.clientId
                ? 'bg-[#5847F6]/10 text-[#5847F6] border-[#5847F6]/30 font-semibold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
            )}
          >
            <option value="">All Customers</option>
            {clientOptions.map((cli) => (
              <option key={cli.value} value={cli.value}>
                {cli.label}
              </option>
            ))}
          </select>
        )}

        {/* Date Filter Range */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            className="bg-transparent text-[11px] focus:outline-none text-slate-700"
          />
          <span className="text-slate-300">&ndash;</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ endDate: e.target.value })}
            className="bg-transparent text-[11px] focus:outline-none text-slate-700"
          />
        </div>
      </div>

      {/* Clear Filters Button */}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
        >
          <X className="w-3 h-3" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
};
