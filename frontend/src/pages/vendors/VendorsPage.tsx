import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Vendor, SupplyItem, SupplyOrder, VendorCategory } from '../../types';
import { DEMO_VENDORS, DEMO_SUPPLIES, DEMO_SUPPLY_ORDERS } from '../../lib/mock-data';
import { formatCurrency } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { VendorDetailInspector } from '../../components/workspace/inspectors/VendorDetailInspector';
import { CreateVendorModal } from '../../components/vendors/CreateVendorModal';
import {
  Building2,
  Plus,
  Briefcase,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  ShieldCheck,
  Package,
  Layers,
  Truck,
  ArrowUpRight,
} from 'lucide-react';

export const VendorsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 1. Fetch Vendors from Backend with Mock Fallback
  const { data: vendorsData } = useQuery<{ items?: Vendor[]; data?: Vendor[] }>({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/vendors', { params: { limit: 100 } });
        return res.data;
      } catch {
        return { items: DEMO_VENDORS };
      }
    },
  });

  const allVendors: Vendor[] =
    vendorsData?.items && vendorsData.items.length > 0
      ? vendorsData.items
      : vendorsData?.data && vendorsData.data.length > 0
      ? vendorsData.data
      : DEMO_VENDORS;

  // 2. Fetch Catalog Items & Orders for 360° inspector
  const { data: suppliesData } = useQuery<{ items?: SupplyItem[]; data?: SupplyItem[] }>({
    queryKey: ['supplies-items'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/supplies/items', { params: { limit: 100 } });
        return res.data;
      } catch {
        return { items: DEMO_SUPPLIES };
      }
    },
  });

  const allSupplies: SupplyItem[] =
    suppliesData?.items && suppliesData.items.length > 0
      ? suppliesData.items
      : suppliesData?.data && suppliesData.data.length > 0
      ? suppliesData.data
      : DEMO_SUPPLIES;

  const { data: ordersData } = useQuery<{ items?: SupplyOrder[]; data?: SupplyOrder[] }>({
    queryKey: ['supplies-orders'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/supplies/orders', { params: { limit: 100 } });
        return res.data;
      } catch {
        return { items: DEMO_SUPPLY_ORDERS };
      }
    },
  });

  const allOrders: SupplyOrder[] =
    ordersData?.items && ordersData.items.length > 0
      ? ordersData.items
      : ordersData?.data && ordersData.data.length > 0
      ? ordersData.data
      : DEMO_SUPPLY_ORDERS;

  // 3. Filter Vendors
  const filteredVendors = useMemo(() => {
    return allVendors.filter((v) => {
      if (activeCategory !== 'ALL' && v.category !== activeCategory) {
        return false;
      }

      if (statusFilter !== 'ALL' && v.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = v.name?.toLowerCase().includes(q);
        const matchesCode = v.vendorCode?.toLowerCase().includes(q);
        const matchesTin = v.taxId?.toLowerCase().includes(q);
        const matchesRc = v.registrationNumber?.toLowerCase().includes(q);
        const matchesContact = v.contactPerson?.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesTin || matchesRc || matchesContact;
      }

      return true;
    });
  }, [allVendors, activeCategory, statusFilter, searchQuery]);

  // Set default selected vendor
  React.useEffect(() => {
    if (filteredVendors.length > 0) {
      if (!selectedVendor || !filteredVendors.some((v) => v.id === selectedVendor.id)) {
        setSelectedVendor(filteredVendors[0]);
      }
    } else {
      setSelectedVendor(null);
    }
  }, [filteredVendors, selectedVendor]);

  // 4. Calculate KPI Metrics
  const activeVendorsCount = allVendors.filter((v) => v.status === 'ACTIVE').length;
  const totalSuppliesValue = allVendors.reduce((sum, v) => sum + (Number(v.totalSuppliedAmount) || 0), 0);
  const totalOutstandingPayable = allVendors.reduce((sum, v) => sum + (Number(v.outstandingPayable) || 0), 0);
  const categoriesCount = new Set(allVendors.map((v) => v.category)).size;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TIER 1: CONTEXT HEADER & PRIMARY ACTION
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Procurement & Supply Chain
            </span>
            <span className="text-xs text-slate-400 font-semibold">• 360° Supplier Profiles</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Vendors & Suppliers Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage authorized suppliers, haulage contractors, payout bank accounts, and purchasing history
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Vendor Profile</span>
        </button>
      </div>

      {/* =========================================================================
          TIER 2: 4 BENTO KPI CARDS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoKpiCard
          title="Active Suppliers"
          value={activeVendorsCount}
          subtitle={`${allVendors.length} registered suppliers`}
          icon={Building2}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
        />

        <BentoKpiCard
          title="Total Supplies Volume"
          value={formatCurrency(totalSuppliesValue, 'NGN')}
          subtitle="Cumulative historical delivery total"
          icon={Truck}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />

        <BentoKpiCard
          title="Outstanding Payables"
          value={formatCurrency(totalOutstandingPayable, 'NGN')}
          subtitle="Pending vendor disbursements"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />

        <BentoKpiCard
          title="Linked Catalog SKUs"
          value={`${allSupplies.length} SKUs`}
          subtitle={`${categoriesCount} Supply categories cataloged`}
          icon={Package}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* =========================================================================
          TIER 3: PILL FILTER BAR & SEARCH
      ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Suppliers', count: allVendors.length },
            { id: 'RAW_MATERIALS', label: 'Raw Materials', count: allVendors.filter((v) => v.category === 'RAW_MATERIALS').length },
            { id: 'LOGISTICS_HAULAGE', label: 'Logistics', count: allVendors.filter((v) => v.category === 'LOGISTICS_HAULAGE').length },
            { id: 'EQUIPMENT', label: 'Equipment', count: allVendors.filter((v) => v.category === 'EQUIPMENT').length },
            { id: 'PACKAGING', label: 'Packaging', count: allVendors.filter((v) => v.category === 'PACKAGING').length },
            { id: 'SERVICES', label: 'Services', count: allVendors.filter((v) => v.category === 'SERVICES').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeCategory === tab.id
                  ? 'bg-[#16181F] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendor, code, TIN, RC..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
          />
        </div>
      </div>

      {/* =========================================================================
          TIER 4: DEEP OBSIDIAN MASTER-DETAIL SPLIT VIEW (40% / 60%)
      ========================================================================= */}
      <ObsidianMasterDetailShell
        leftPane={
          <div className="space-y-3">
            {filteredVendors.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No vendor records found</p>
                <p className="text-[11px] text-slate-500 mt-1">Register a new vendor or adjust filters.</p>
              </div>
            ) : (
              filteredVendors.map((v) => {
                const isSelected = selectedVendor?.id === v.id;
                const initials = v.name
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v)}
                    className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#1D2029] border-[#5847F6] shadow-lg shadow-indigo-950/30'
                        : 'bg-[#191B22] hover:bg-[#1D2029] border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-xs flex items-center justify-center">
                          {initials}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-white truncate max-w-[150px]">
                            {v.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{v.vendorCode}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                        {v.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate max-w-[140px]">
                        Supplied: {formatCurrency(Number(v.totalSuppliedAmount) || 0, v.currency || 'NGN')}
                      </span>
                      {Number(v.outstandingPayable) > 0 ? (
                        <span className="font-bold text-amber-300 tabular-nums">
                          Payable: {formatCurrency(Number(v.outstandingPayable), v.currency || 'NGN')}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cleared</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        }
        rightPane={
          <VendorDetailInspector
            vendor={selectedVendor}
            items={allSupplies}
            orders={allOrders}
          />
        }
      />

      {/* Add New Vendor Modal */}
      <CreateVendorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onVendorCreated={(newVendor) => {
          setSelectedVendor(newVendor);
        }}
      />
    </div>
  );
};
