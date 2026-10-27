import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Client, ClientType, AddressType } from '../../types';
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  FileText,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated?: (client: Client) => void;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState<ClientType>('COMPANY');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [rcNumber, setRcNumber] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [addresses, setAddresses] = useState<Array<{
    type: AddressType;
    line1: string;
    city: string;
    state: string;
    country: string;
    isDefault: boolean;
  }>>([
    {
      type: 'BILLING',
      line1: '',
      city: 'Lagos',
      state: 'Lagos State',
      country: 'Nigeria',
      isDefault: true,
    },
  ]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addAddressField = () => {
    setAddresses([
      ...addresses,
      {
        type: 'SHIPPING',
        line1: '',
        city: 'Lagos',
        state: 'Lagos State',
        country: 'Nigeria',
        isDefault: false,
      },
    ]);
  };

  const removeAddressField = (index: number) => {
    if (addresses.length <= 1) return;
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const updateAddressField = (index: number, key: string, value: any) => {
    const updated = [...addresses];
    updated[index] = { ...updated[index], [key]: value };
    setAddresses(updated);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Contact Person / Primary Name is required.');

      const payload = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        type,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
        rcNumber: rcNumber.trim() || undefined,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        paymentTermsDays: paymentTermsDays ? parseInt(paymentTermsDays, 10) : 30,
        addresses: addresses
          .filter((a) => a.line1.trim().length > 0)
          .map((a, i) => ({
            type: a.type,
            line1: a.line1.trim(),
            city: a.city.trim() || 'Lagos',
            state: a.state.trim() || 'Lagos State',
            country: a.country.trim() || 'Nigeria',
            isDefault: i === 0 || a.isDefault,
          })),
      };

      try {
        const res = await apiClient.post('/clients', payload);
        return res.data;
      } catch (err: any) {
        // Offline demo fallback
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          const fakeClient: Client = {
            id: `cli-local-${Date.now()}`,
            companyId: 'c0000000-0000-0000-0000-000000000001',
            clientNumber: `CLI-${Math.floor(10000 + Math.random() * 90000)}`,
            type,
            name: name.trim(),
            companyName: companyName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            taxNumber: taxNumber.trim() || null,
            rcNumber: rcNumber.trim() || null,
            creditLimit: creditLimit ? parseFloat(creditLimit) : null,
            paymentTermsDays: paymentTermsDays ? parseInt(paymentTermsDays, 10) : 30,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            addresses: addresses.map((a, i) => ({
              id: `addr-local-${i}-${Date.now()}`,
              clientId: `cli-local-${Date.now()}`,
              type: a.type,
              line1: a.line1.trim() || 'Head Office Address',
              city: a.city || 'Lagos',
              state: a.state || 'Lagos State',
              country: a.country || 'Nigeria',
              isDefault: i === 0 || a.isDefault,
            })),
          };
          return fakeClient;
        }
        throw err;
      }
    },
    onSuccess: (savedClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-catalog'] });
      if (onClientCreated) onClientCreated(savedClient);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to register client.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-[32px] p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Register New Corporate Client</h2>
              <p className="text-xs text-slate-500 font-medium">Add corporate debtor, TIN/RC credentials, and billing/shipping sites</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Client Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMessage(null);
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Client Type & Contact Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Client Entity Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ClientType)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="COMPANY">Registered Corporate (LLC / Plc)</option>
                <option value="INDIVIDUAL">Sole Trader / Individual</option>
                <option value="GOVERNMENT">Government Agency / Parastatal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Primary Contact Person <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Babatunde Raji"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>
          </div>

          {/* Company Legal Name & RC Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Company / Organization Legal Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Dangote Industries Limited"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                CAC RC Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                placeholder="e.g. RC-124901"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>
          </div>

          {/* TIN, Email, Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                FIRS Tax Number (TIN)
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="e.g. 10023456-0001"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Corporate Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="procurement@client.com"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 803 555 1001"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>
          </div>

          {/* Credit Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Credit Limit (NGN) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="e.g. 50000000.00"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Standard Settlement Terms
              </label>
              <select
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
              >
                <option value="0">Due on Receipt (Immediate)</option>
                <option value="15">Net 15 Days</option>
                <option value="30">Net 30 Days (Standard)</option>
                <option value="60">Net 60 Days</option>
                <option value="90">Net 90 Days</option>
              </select>
            </div>
          </div>

          {/* Multi-Address Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#5847F6]" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Registered Addresses & Offloading Sites ({addresses.length})
                </span>
              </div>
              <button
                type="button"
                onClick={addAddressField}
                className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#5847F6] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Site</span>
              </button>
            </div>

            {addresses.map((addr, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 space-y-2.5 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">
                    Address Site #{idx + 1} {addr.isDefault && '(Default)'}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={addr.type}
                      onChange={(e) => updateAddressField(idx, 'type', e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800"
                    >
                      <option value="BILLING">Billing Address</option>
                      <option value="SHIPPING">Shipping Depot / Offloading Hub</option>
                      <option value="REGISTERED">Registered Head Office</option>
                      <option value="OPERATIONAL">Warehouse / Plant</option>
                    </select>
                    {addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddressField(idx)}
                        className="w-7 h-7 rounded-lg hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={addr.line1}
                  onChange={(e) => updateAddressField(idx, 'line1', e.target.value)}
                  placeholder="Plot number, street address, industrial estate..."
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={addr.city}
                    onChange={(e) => updateAddressField(idx, 'city', e.target.value)}
                    placeholder="City (e.g. Ikeja)"
                    className="w-full px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={addr.state}
                    onChange={(e) => updateAddressField(idx, 'state', e.target.value)}
                    placeholder="State (e.g. Lagos State)"
                    className="w-full px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    value={addr.country}
                    onChange={(e) => updateAddressField(idx, 'country', e.target.value)}
                    placeholder="Country"
                    className="w-full px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer active:scale-95"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Client Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
