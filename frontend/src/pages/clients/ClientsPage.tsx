import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Client, DocumentRecord } from '../../types';
import { DEMO_CLIENTS, DEMO_INVOICES } from '../../lib/mock-data';
import { formatCurrency, extractArray } from '../../lib/utils';
import { BentoKpiCard } from '../../components/common/BentoKpiCard';
import { ObsidianMasterDetailShell } from '../../components/workspace/ObsidianMasterDetailShell';
import { ClientDetailInspector } from '../../components/workspace/inspectors/ClientDetailInspector';
import { CreateClientModal } from '../../components/clients/CreateClientModal';
import { ClientStatementModal } from '../../components/clients/ClientStatementModal';
import {
  Building2,
  Plus,
  Users,
  Briefcase,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementClient, setStatementClient] = useState<Client | null>(null);

  // 1. Fetch Clients from Backend with Mock Fallback
  const { data: clientsData } = useQuery<{ items?: Client[]; data?: Client[] }>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiClient.get('/clients', { params: { limit: 100 } });
      return res.data;
    },
  });

  const allClients: Client[] = useMemo(() => {
    return extractArray<Client>(clientsData, DEMO_CLIENTS);
  }, [clientsData]);

  // 2. Fetch Invoices for Client Ledger Balances
  const { data: invoicesData } = useQuery<any>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/documents', { params: { documentType: 'INVOICE', limit: 100 } });
      return res.data;
    },
  });

  const allInvoices: DocumentRecord[] = useMemo(() => {
    return extractArray<DocumentRecord>(invoicesData, DEMO_INVOICES);
  }, [invoicesData]);

  // 3. Filter Clients
  const filteredClients = useMemo(() => {
    return allClients.filter((c) => {
      if (activeTab !== 'ALL' && c.type !== activeTab) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesCompany = c.companyName?.toLowerCase().includes(q);
        const matchesNum = c.clientNumber?.toLowerCase().includes(q);
        const matchesRc = c.rcNumber?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        return matchesName || matchesCompany || matchesNum || matchesRc || matchesEmail;
      }

      return true;
    });
  }, [allClients, activeTab, searchQuery]);

  // Set default selected client
  React.useEffect(() => {
    if (filteredClients.length > 0) {
      if (!selectedClient || !filteredClients.some((c) => c.id === selectedClient.id)) {
        setSelectedClient(filteredClients[0]);
      }
    } else {
      setSelectedClient(null);
    }
  }, [filteredClients, selectedClient]);

  // 4. Calculate KPI Metrics
  const totalReceivables = allInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const corporateCount = allClients.filter((c) => c.type === 'COMPANY').length;
  const individualCount = allClients.filter((c) => c.type === 'INDIVIDUAL').length;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TIER 1: CONTEXT HEADER & PRIMARY ACTION
      ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Customer Directory
            </span>
            <span className="text-xs text-slate-400 font-semibold">• 360° Profiles</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Clients & Accounts Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Corporate debtors, CAC credentials, registered billing/shipping depots, and customer ledgers
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedClient && (
            <button
              onClick={() => {
                setStatementClient(selectedClient);
                setIsStatementModalOpen(true);
              }}
              className="px-4 py-3 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#5847F6]" />
              <span>Statement of Account</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Client</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TIER 2: 4 BENTO KPI CARDS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoKpiCard
          title="Total Active Clients"
          value={allClients.length}
          subtitle="Verified commercial entities"
          icon={Building2}
          iconBgColor="bg-indigo-50"
          iconColor="text-[#5847F6]"
        />

        <BentoKpiCard
          title="Corporate Accounts"
          value={`${corporateCount} Corporate`}
          subtitle={`${individualCount} Individual accounts`}
          icon={Briefcase}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />

        <BentoKpiCard
          title="Total Receivables"
          value={formatCurrency(totalReceivables, 'NGN')}
          subtitle="Pending settlement balances"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />

        <BentoKpiCard
          title="Available Credits"
          value={formatCurrency(0, 'NGN')}
          subtitle="Customer credit notes on file"
          icon={Sparkles}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* =========================================================================
          TIER 3: PILL FILTER BAR & SEARCH
      ========================================================================= */}
      <div className="p-4 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Accounts', count: allClients.length },
            { id: 'COMPANY', label: 'Corporate LLC/Plc', count: allClients.filter((c) => c.type === 'COMPANY').length },
            { id: 'INDIVIDUAL', label: 'Individual', count: allClients.filter((c) => c.type === 'INDIVIDUAL').length },
            { id: 'GOVERNMENT', label: 'Government', count: allClients.filter((c) => c.type === 'GOVERNMENT').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[#16181F] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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
            placeholder="Search company, RC, TIN, email..."
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
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No client records found</p>
                <p className="text-[11px] text-slate-500 mt-1">Register a new client or adjust your search.</p>
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = selectedClient?.id === c.id;
                const initials = (c.companyName || c.name)
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase();

                // Compute client's balance
                const clientInvoices = allInvoices.filter((inv) => inv.clientId === c.id);
                const clientDue = clientInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
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
                            {c.companyName || c.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">{c.clientNumber}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                        {c.type}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 truncate max-w-[140px]">
                        Contact: {c.name}
                      </span>
                      {clientDue > 0 ? (
                        <span className="font-bold text-amber-300 tabular-nums">
                          Due: {formatCurrency(clientDue, 'NGN')}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Settled</span>
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
          <ClientDetailInspector
            client={selectedClient}
            documents={allInvoices}
            onOpenStatement={(client) => {
              setStatementClient(client);
              setIsStatementModalOpen(true);
            }}
          />
        }
      />

      {/* Add New Client Modal */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onClientCreated={(newClient) => {
          setSelectedClient(newClient);
        }}
      />

      {/* Official Customer Statement of Account Modal */}
      <ClientStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => {
          setIsStatementModalOpen(false);
          setStatementClient(null);
        }}
        client={statementClient || selectedClient}
      />
    </div>
  );
};
