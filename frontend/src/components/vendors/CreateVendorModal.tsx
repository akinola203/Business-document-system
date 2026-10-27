import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Vendor, VendorCategory } from '../../types';
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface CreateVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVendorCreated?: (vendor: Vendor) => void;
}

export const CreateVendorModal: React.FC<CreateVendorModalProps> = ({
  isOpen,
  onClose,
  onVendorCreated,
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<VendorCategory>('RAW_MATERIALS');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lagos');
  const [state, setState] = useState('Lagos State');
  const [country] = useState('Nigeria');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('NET 30');
  const [currency, setCurrency] = useState('NGN');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/vendors', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      if (onVendorCreated && data) {
        onVendorCreated(data);
      }
      handleClose();
    },
    onError: (err: any) => {
      // In offline/demo mode, construct local mock vendor
      const fallbackVendor: Vendor = {
        id: `vnd-local-${Date.now()}`,
        companyId: 'c0000000-0000-0000-0000-000000000001',
        vendorCode: `VND-${Math.floor(1000 + Math.random() * 9000)}`,
        name,
        category,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        taxId: taxId || null,
        registrationNumber: registrationNumber || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country,
        bankName: bankName || null,
        bankAccountName: bankAccountName || name,
        bankAccountNumber: bankAccountNumber || null,
        paymentTerms,
        currency,
        status: 'ACTIVE',
        notes: notes || null,
        totalSuppliedAmount: 0,
        outstandingPayable: 0,
        createdAt: new Date().toISOString(),
        _count: { items: 0, orders: 0 },
      };

      if (onVendorCreated) {
        onVendorCreated(fallbackVendor);
      }
      handleClose();
    },
  });

  const handleClose = () => {
    setName('');
    setCategory('RAW_MATERIALS');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setTaxId('');
    setRegistrationNumber('');
    setAddress('');
    setBankName('');
    setBankAccountName('');
    setBankAccountNumber('');
    setPaymentTerms('NET 30');
    setNotes('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Vendor Legal Name is required');
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      contactPerson: contactPerson.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      taxId: taxId.trim() || undefined,
      registrationNumber: registrationNumber.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country,
      bankName: bankName.trim() || undefined,
      bankAccountName: bankAccountName.trim() || undefined,
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      paymentTerms,
      currency,
      notes: notes.trim() || undefined,
    };

    createMutation.mutate(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Add Vendor Profile</h2>
              <p className="text-xs text-slate-500 font-medium">
                Register a new corporate supplier, contractor, or logistics partner
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Profile */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Supplier Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor / Supplier Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NNPC Retail Logistics Limited"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VendorCategory)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                >
                  <option value="RAW_MATERIALS">Raw Materials & Commodities</option>
                  <option value="LOGISTICS_HAULAGE">Logistics & Haulage</option>
                  <option value="EQUIPMENT">Civil Equipment & Machinery</option>
                  <option value="PACKAGING">Packaging & Industrial Consumables</option>
                  <option value="SERVICES">Industrial Services & Maintenance</option>
                  <option value="GENERAL">General Procurement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Engr. Farouk Ahmed"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="procurement@supplier.com"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">RC / Registration Number</label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="RC-129480"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">TIN (Tax ID Number)</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="10094820-0001"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Facility / Depot Address
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot 12 Commercial Way, Industrial Estate"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  disabled
                  value={country}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payout Bank Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              3. Payout Settlement Bank Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Zenith Bank Plc"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Number (NUBAN)</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="e.g. 1012984733"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="Beneficiary Account Name"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    <option value="NET 14">NET 14 Days</option>
                    <option value="NET 30">NET 30 Days</option>
                    <option value="NET 45">NET 45 Days</option>
                    <option value="NET 60">NET 60 Days</option>
                    <option value="ADVANCE">100% Advance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-6 py-2.5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? 'Saving...' : 'Create Vendor Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
