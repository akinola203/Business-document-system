import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Calendar,
  Building2,
  Briefcase,
  Tag,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { cn, extractArray } from '../../lib/utils';
import { Client } from '../../types';

export interface FilterState {
  search: string;
  status: string;
  clientId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  departmentId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tag?: string;
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

const QUICK_TAGS = ['Cement', 'Haulage', 'Rebar', 'Tender', 'Net 30', 'Urgent'];

export const PillFilterBar: React.FC<PillFilterBarProps> = ({
  filters,
  onFilterChange,
  onClear,
  statusOptions = DEFAULT_STATUS_OPTIONS,
  clientOptions = [],
  showClientFilter = true,
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Fetch clients if not explicitly passed
  const { data: clientsData } = useQuery<any>({
    queryKey: ['clients-catalog'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/clients', { params: { limit: 100 } });
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: showClientFilter && clientOptions.length === 0,
    staleTime: 60000,
  });

  // Fetch organization branches & departments for advanced filter drawer
  const { data: branchesData } = useQuery<any>({
    queryKey: ['organization-branches'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/organization/branches');
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: showAdvancedFilters,
    staleTime: 60000,
  });

  const { data: departmentsData } = useQuery<any>({
    queryKey: ['organization-departments'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/organization/departments');
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: showAdvancedFilters,
    staleTime: 60000,
  });

  const resolvedClientOptions = useMemo(() => {
    if (clientOptions.length > 0) return clientOptions;
    const list = extractArray<Client>(clientsData);
    return list.map((c) => ({
      label: c.companyName || c.name || 'Client',
      value: c.id,
    }));
  }, [clientOptions, clientsData]);

  const branchList = useMemo(() => {
    const raw = extractArray<any>(branchesData);
    if (raw.length > 0) return raw;
    return [
      { id: 'HQ', name: 'Lagos Corporate HQ', code: 'LOS-HQ' },
      { id: 'OTA', name: 'Ota Industrial Depot', code: 'OGN-OTA' },
      { id: 'ABJ', name: 'Abuja Regional Office', code: 'ABJ-REG' },
    ];
  }, [branchesData]);

  const departmentList = useMemo(() => {
    const raw = extractArray<any>(departmentsData);
    if (raw.length > 0) return raw;
    return [
      { id: 'FIN', name: 'Finance & Accounts', code: 'FIN' },
      { id: 'LOG', name: 'Logistics & Haulage', code: 'LOG' },
      { id: 'DIR', name: 'Executive Directorate', code: 'DIR' },
      { id: 'PRC', name: 'Procurement & Supply', code: 'PRC' },
    ];
  }, [departmentsData]);

  // Count active filters
  const activeCount = [
    filters.search,
    filters.status,
    filters.clientId,
    filters.startDate,
    filters.endDate,
    filters.branchId,
    filters.departmentId,
    filters.tag,
    filters.sortBy && filters.sortBy !== 'createdAt' ? filters.sortBy : '',
  ].filter(Boolean).length;

  const applyDatePreset = (days: number | 'YTD' | 'CLEAR') => {
    if (days === 'CLEAR') {
      onFilterChange({ startDate: '', endDate: '' });
      return;
    }
    const end = new Date();
    const endStr = end.toISOString().slice(0, 10);
    if (days === 'YTD') {
      const startStr = `${end.getFullYear()}-01-01`;
      onFilterChange({ startDate: startStr, endDate: endStr });
    } else {
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      const startStr = start.toISOString().slice(0, 10);
      onFilterChange({ startDate: startStr, endDate: endStr });
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Primary Horizontal Pill Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#F8F9FC] border border-slate-200/70">
        <div className="flex flex-wrap items-center gap-2">
          {/* Interactive Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-sm transition-all cursor-pointer select-none',
              showAdvancedFilters || activeCount > 0
                ? 'bg-[#5847F6] text-white border-[#5847F6] shadow-indigo-500/20'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200',
            )}
          >
            <SlidersHorizontal
              className={cn(
                'w-3.5 h-3.5',
                showAdvancedFilters || activeCount > 0 ? 'text-white' : 'text-[#5847F6]',
              )}
            />
            <span>Filters</span>
            {activeCount > 0 && (
              <span
                className={cn(
                  'w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-extrabold',
                  showAdvancedFilters || activeCount > 0
                    ? 'bg-white text-[#5847F6]'
                    : 'bg-[#5847F6] text-white',
                )}
              >
                {activeCount}
              </span>
            )}
            {showAdvancedFilters ? (
              <ChevronUp className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            )}
          </button>

          {/* Search Input Pill */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              placeholder="Search # number, title..."
              className="pl-8 pr-7 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6] shadow-sm w-44 md:w-56"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
          {showClientFilter && resolvedClientOptions.length > 0 && (
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
              {resolvedClientOptions.map((cli) => (
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
              title="Start Date"
            />
            <span className="text-slate-300">&ndash;</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              className="bg-transparent text-[11px] focus:outline-none text-slate-700"
              title="End Date"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Reset ({activeCount})</span>
          </button>
        )}
      </div>

      {/* Collapsible Advanced Filter Drawer */}
      {showAdvancedFilters && (
        <div className="w-full p-4 rounded-2xl bg-white border border-slate-200/90 shadow-md space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#5847F6]" />
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Advanced Filter &amp; Sort Controls
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Collapse Filters"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            {/* 1. Branch Filter */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-[#5847F6]" />
                <span>Branch / Location</span>
              </label>
              <select
                value={filters.branchId || ''}
                onChange={(e) => onFilterChange({ branchId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] cursor-pointer"
              >
                <option value="">All Company Branches</option>
                {branchList.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Department Filter */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <Briefcase className="w-3.5 h-3.5 text-[#5847F6]" />
                <span>Department / Unit</span>
              </label>
              <select
                value={filters.departmentId || ''}
                onChange={(e) => onFilterChange({ departmentId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] cursor-pointer"
              >
                <option value="">All Departments</option>
                {departmentList.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Customer / Client Filter */}
            {showClientFilter ? (
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <Users className="w-3.5 h-3.5 text-[#5847F6]" />
                  <span>Client Account</span>
                </label>
                <select
                  value={filters.clientId || ''}
                  onChange={(e) => onFilterChange({ clientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] cursor-pointer"
                >
                  <option value="">All Clients</option>
                  {resolvedClientOptions.map((cli) => (
                    <option key={cli.value} value={cli.value}>
                      {cli.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <Tag className="w-3.5 h-3.5 text-[#5847F6]" />
                  <span>Correspondence Keyword / Tag</span>
                </label>
                <input
                  type="text"
                  value={filters.tag || ''}
                  onChange={(e) => onFilterChange({ tag: e.target.value })}
                  placeholder="e.g. Executive, Proposal, Notice..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>
            )}

            {/* 4. Sort By & Order */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#5847F6]" />
                <span>Sort Order</span>
              </label>
              <select
                value={`${filters.sortBy || 'createdAt'}:${filters.sortOrder || 'desc'}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split(':');
                  onFilterChange({
                    sortBy,
                    sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5847F6] cursor-pointer"
              >
                <option value="createdAt:desc">Newest First (Created Date)</option>
                <option value="createdAt:asc">Oldest First (Created Date)</option>
                <option value="totalAmount:desc">Highest Value First</option>
                <option value="totalAmount:asc">Lowest Value First</option>
                <option value="documentNumber:asc">Document Number (A–Z)</option>
                <option value="documentNumber:desc">Document Number (Z–A)</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: Quick Date Range Presets & Custom Tag Pills */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Date Presets:</span>
              {[
                { label: 'Today', action: () => applyDatePreset(0) },
                { label: 'Last 7 Days', action: () => applyDatePreset(7) },
                { label: 'Last 30 Days', action: () => applyDatePreset(30) },
                { label: 'Last 90 Days', action: () => applyDatePreset(90) },
                { label: 'Year to Date', action: () => applyDatePreset('YTD') },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={preset.action}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-[#5847F6] text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              {(filters.startDate || filters.endDate) && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('CLEAR')}
                  className="px-2 py-1 rounded-full text-[11px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  Clear Dates
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Tag className="w-3 h-3 text-[#5847F6]" />
                <span>Quick Tags:</span>
              </span>
              {QUICK_TAGS.map((tag) => {
                const isSelected = filters.tag === tag || filters.search === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      onFilterChange({
                        tag: isSelected ? '' : tag,
                      })
                    }
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-[#5847F6] text-white border-[#5847F6]'
                        : 'bg-slate-50 hover:bg-indigo-50 text-slate-600 border-slate-200',
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
