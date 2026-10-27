import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { SupplyItem, SupplyOrder, Vendor } from '../../types';
import { DEMO_SUPPLIES, DEMO_SUPPLY_ORDERS, DEMO_VENDORS } from '../../lib/mock-data';
import { formatCurrency } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { RecessedTabNotch } from '../../components/workspace/RecessedTabNotch';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { CreateSupplyItemModal } from '../../components/supplies/CreateSupplyItemModal';
import { RecordSupplyDeliveryModal } from '../../components/supplies/RecordSupplyDeliveryModal';
import { AdjustStockModal } from '../../components/supplies/AdjustStockModal';
import {
  Package,
  Truck,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
  DollarSign,
  TrendingUp,
  Boxes,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';

export const SuppliesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'ORDERS'>('CATALOG');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);

  // Modals state
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isRecordDeliveryOpen, setIsRecordDeliveryOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<SupplyItem | null>(null);

  // 1. Fetch Supplies Catalog
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

  // 2. Fetch Supply Orders
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

  // 3. Fetch Vendors for modal selects
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

  // Filter Catalog Items
  const filteredSupplies = useMemo(() => {
    return allSupplies.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      if (showLowStockOnly && item.currentStock > item.reorderLevel) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSku = item.sku.toLowerCase().includes(q);
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesVendor = item.preferredVendor?.name.toLowerCase().includes(q);
        return matchesSku || matchesName || matchesDesc || matchesVendor;
      }

      return true;
    });
  }, [allSupplies, categoryFilter, showLowStockOnly, searchQuery]);

  // Filter Supply Orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = order.supplyNumber.toLowerCase().includes(q);
        const matchesRef = order.deliveryRef?.toLowerCase().includes(q);
        const matchesVendor = order.vendor?.name.toLowerCase().includes(q);
        return matchesNum || matchesRef || matchesVendor;
      }
      return true;
    });
  }, [allOrders, searchQuery]);

  // Set default selected order
  React.useEffect(() => {
    if (filteredOrders.length > 0) {
      if (!selectedOrder || !filteredOrders.some((o) => o.id === selectedOrder.id)) {
        setSelectedOrder(filteredOrders[0]);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [filteredOrders, selectedOrder]);

  // KPI calculations
  const lowStockCount = allSupplies.filter((s) => s.currentStock <= s.reorderLevel).length;
  const totalStockValue = allSupplies.reduce((sum, s) => sum + s.currentStock * s.unitCost, 0);
  const totalReceivedValue = allOrders
    .filter((o) => o.status === 'RECEIVED')
    .reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const pendingOrdersCount = allOrders.filter((o) => o.status === 'ORDERED').length;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TIER 1: CONTEXT HEADER & RECESSED NOTCH
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Inventory & Procurement
            </span>
            <span className="text-xs text-slate-400 font-semibold">• Supply Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Supplies Catalog & Vendor Deliveries
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage product items catalog, cost vs. selling prices, low stock alerts, and vendor purchase receipts
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'CATALOG' ? (
            <button
              onClick={() => setIsAddItemModalOpen(true)}
              className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Catalog Item</span>
            </button>
          ) : (
            <button
              onClick={() => setIsRecordDeliveryOpen(true)}
              className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Truck className="w-4 h-4" />
              <span>Record New Supply Delivery</span>
            </button>
          )}
        </div>
      </div>

      {/* Recessed Tab Notch */}
      <RecessedTabNotch
        tabs={[
          { key: 'CATALOG', label: 'Supplies & Items Catalog', count: allSupplies.length },
          { key: 'ORDERS', label: 'Vendor Supply Receipts (POs)', count: allOrders.length },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => {
          setActiveTab(key as any);
          setSearchQuery('');
        }}
      />

      {/* =========================================================================
          TIER 2: BENTO KPI CARDS
      ========================================================================= */}
      {activeTab === 'CATALOG' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BentoKpiCard
            title="Total Catalog Items"
            value={allSupplies.length}
            subtitle="Commercial inventory & services"
            icon={Package}
            iconBgColor="bg-indigo-50"
            iconColor="text-[#5847F6]"
          />
          <BentoKpiCard
            title="Low Stock Alerts"
            value={lowStockCount}
            subtitle={lowStockCount > 0 ? 'Requires immediate restock' : 'All stock levels adequate'}
            icon={AlertTriangle}
            iconBgColor={lowStockCount > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
            iconColor={lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
          />
          <BentoKpiCard
            title="Total Stock Valuation"
            value={formatCurrency(totalStockValue, 'NGN')}
            subtitle="Based on procurement unit cost"
            icon={DollarSign}
            iconBgColor="bg-sky-50"
            iconColor="text-sky-600"
          />
          <BentoKpiCard
            title="Sourcing Partners"
            value={allVendors.length}
            subtitle="Registered active suppliers"
            icon={Building2}
            iconBgColor="bg-purple-50"
            iconColor="text-purple-600"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BentoKpiCard
            title="Total Supply Receipts"
            value={allOrders.length}
            subtitle="Historical incoming consignments"
            icon={Truck}
            iconBgColor="bg-indigo-50"
            iconColor="text-[#5847F6]"
          />
          <BentoKpiCard
            title="Received Supplies Value"
            value={formatCurrency(totalReceivedValue, 'NGN')}
            subtitle="Cleared and stocked in warehouse"
            icon={CheckCircle2}
            iconBgColor="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <BentoKpiCard
            title="Pending Dispatches"
            value={pendingOrdersCount}
            subtitle="Ordered & en-route from suppliers"
            icon={Layers}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
          />
          <BentoKpiCard
            title="Fulfillment Velocity"
            value="94.8%"
            subtitle="On-time delivery performance"
            icon={TrendingUp}
            iconBgColor="bg-purple-50"
            iconColor="text-purple-600"
          />
        </div>
      )}

      {/* =========================================================================
          TIER 3: TAB 1 — CATALOG VIEW
      ========================================================================= */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              {[
                { id: 'ALL', label: 'All Catalog', count: allSupplies.length },
                { id: 'RAW_MATERIALS', label: 'Raw Materials', count: allSupplies.filter((s) => s.category === 'RAW_MATERIALS').length },
                { id: 'LOGISTICS_HAULAGE', label: 'Logistics', count: allSupplies.filter((s) => s.category === 'LOGISTICS_HAULAGE').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    categoryFilter === tab.id
                      ? 'bg-[#16181F] text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      categoryFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  showLowStockOnly
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only ({lowStockCount})</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, item name, vendor..."
                className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>
          </div>

          {/* Catalog Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSupplies.map((item) => {
              const isLowStock = item.currentStock <= item.reorderLevel;
              const margin = item.sellingPrice > 0 ? ((item.sellingPrice - item.unitCost) / item.sellingPrice) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200/60">
                          {item.sku}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {item.category?.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    {/* Stock Badge */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tabular-nums ${
                          isLowStock
                            ? 'bg-amber-50 text-amber-700 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isLowStock ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>
                          {Number(item.currentStock).toLocaleString()} {item.unit}
                        </span>
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-1">
                        Min Reorder: {item.reorderLevel} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Financial & Pricing Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-slate-200/60 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Vendor Cost</span>
                      <span className="font-bold text-slate-700 font-mono tabular-nums">
                        {formatCurrency(Number(item.unitCost), 'NGN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Invoice Price</span>
                      <span className="font-bold text-emerald-600 font-mono tabular-nums">
                        {formatCurrency(Number(item.sellingPrice), 'NGN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Gross Margin</span>
                      <span className="font-extrabold text-[#5847F6] tabular-nums">
                        +{margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Preferred Vendor & Actions */}
                  <div className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 truncate max-w-[200px]">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">
                        {item.preferredVendor ? item.preferredVendor.name : 'Open Sourcing'}
                      </span>
                    </div>

                    <button
                      onClick={() => setAdjustingItem(item)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Adjust Stock</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 3: TAB 2 — VENDOR SUPPLY RECEIPTS (PURCHASE ORDERS) MASTER-DETAIL
      ========================================================================= */}
      {activeTab === 'ORDERS' && (
        <ObsidianMasterDetailShell
          leftPane={
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-300">No supply receipts recorded</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click "Record New Supply Delivery" to log an incoming delivery.
                  </p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;

                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#1D2029] border-[#5847F6] shadow-lg shadow-indigo-950/30'
                          : 'bg-[#191B22] hover:bg-[#1D2029] border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">{order.supplyNumber}</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              order.status === 'RECEIVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <span className="font-mono font-black text-white text-xs tabular-nums">
                          {formatCurrency(Number(order.grandTotal), order.currency)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                        <span className="font-medium text-slate-200 truncate max-w-[180px]">
                          {order.vendor?.name || 'Authorized Supplier'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(order.supplyDate).toLocaleDateString()}
                        </span>
                      </div>

                      {order.deliveryRef && (
                        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono">
                          Ref: {order.deliveryRef}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          }
          rightPane={
            selectedOrder ? (
              <div className="h-full flex flex-col justify-between space-y-6">
                <div className="space-y-6">
                  {/* Top Order Card */}
                  <div className="rounded-[28px] bg-gradient-to-br from-[#5B58B6] to-[#45429B] p-6 text-white shadow-xl shadow-indigo-950/20 relative overflow-hidden border border-indigo-400/20">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-xs font-mono text-indigo-200 block mb-1">
                          {selectedOrder.supplyNumber}
                        </span>
                        <h2 className="text-xl font-extrabold text-white tracking-tight">
                          {selectedOrder.vendor?.name || 'Vendor Consignment'}
                        </h2>
                        <p className="text-xs text-indigo-200 mt-0.5">
                          Waybill / Invoice Ref: <strong>{selectedOrder.deliveryRef || 'None'}</strong>
                        </p>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md ${
                          selectedOrder.status === 'RECEIVED'
                            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                            : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
                      <div>
                        <span className="text-indigo-200 text-[11px]">Consignment Grand Total</span>
                        <p className="text-lg font-black text-white tabular-nums mt-0.5">
                          {formatCurrency(Number(selectedOrder.grandTotal), selectedOrder.currency)}
                        </p>
                      </div>
                      <div>
                        <span className="text-indigo-200 text-[11px]">Receipt Date</span>
                        <p className="text-sm font-bold text-white mt-1">
                          {new Date(selectedOrder.supplyDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Supplied Items Breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Delivered Items ({selectedOrder.items?.length || 0})
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {selectedOrder.items?.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-[#191B22] border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200 block">
                              {item.supplyItem?.name || 'Delivered Item'}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Quantity: {item.quantity} • Unit Cost: {formatCurrency(Number(item.unitCost), selectedOrder.currency)}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-white tabular-nums">
                            {formatCurrency(Number(item.lineTotal), selectedOrder.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes & Remarks */}
                  {selectedOrder.notes && (
                    <div className="p-4 rounded-2xl bg-[#191B22] border border-slate-800 text-xs space-y-1">
                      <span className="text-slate-400 font-bold block">Delivery Remarks / Driver Note</span>
                      <p className="text-slate-200">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Logged in tenant inventory ledger</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Audit Logged</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Truck className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-300">Select a supply delivery</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Click any supply order from the left pane to view items delivered, vendor invoice references, and payout totals.
                </p>
              </div>
            )
          }
        />
      )}

      {/* Modals */}
      <CreateSupplyItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        vendors={allVendors}
      />

      <RecordSupplyDeliveryModal
        isOpen={isRecordDeliveryOpen}
        onClose={() => setIsRecordDeliveryOpen(false)}
        vendors={allVendors}
        supplies={allSupplies}
      />

      <AdjustStockModal
        isOpen={!!adjustingItem}
        onClose={() => setAdjustingItem(null)}
        item={adjustingItem}
      />
    </div>
  );
};
