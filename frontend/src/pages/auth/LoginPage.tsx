import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api-client';
import { Sparkles, ArrowRight, Lock, Mail, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/overview';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const { accessToken, refreshToken, user } = response.data;
      login({ accessToken, refreshToken }, user);
      navigate(from, { replace: true });
    } catch (err: any) {
      // If backend is offline or network error, seamlessly allow demo preview
      if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        const isManager = email.toLowerCase().includes('manager');
        login(
          { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' },
          {
            id: isManager ? 'usr-manager-1' : 'usr-admin-1',
            email: email.trim() || 'admin@aoa77.com',
            fullName: isManager ? 'Olumide Ogunlesi (Finance Manager)' : 'Alade Adebayo (Managing Director)',
            role: isManager ? 'Manager' : 'Admin',
            roleName: isManager ? 'Manager' : 'Admin',
            permissions: ['*'],
            companyId: 'c0000000-0000-0000-0000-000000000001',
            companyName: 'AOA 77 COMPANY LTD',
          }
        );
        navigate(from, { replace: true });
        return;
      }

      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Authentication failed. Please verify your email and password.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Demo credential autofill helper matching seed.ts
  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleInstantDemoLogin = (role: 'Admin' | 'Manager') => {
    const isManager = role === 'Manager';
    login(
      { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' },
      {
        id: isManager ? 'usr-manager-1' : 'usr-admin-1',
        email: isManager ? 'manager@aoa77.com' : 'admin@aoa77.com',
        fullName: isManager ? 'Olumide Ogunlesi (Finance Manager)' : 'Alade Adebayo (Managing Director)',
        role,
        roleName: role,
        permissions: ['*'],
        companyId: 'c0000000-0000-0000-0000-000000000001',
        companyName: 'AOA 77 COMPANY LTD',
      }
    );
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F4F5F9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-900/5 border border-slate-200/80">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#16181F] flex items-center justify-center text-white shadow-lg shadow-indigo-500/10 mb-4 border border-slate-800">
            <Sparkles className="w-7 h-7 text-[#5847F6]" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">AOA 77 System</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Enterprise Invoicing, Logistics Waybills & Payments
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Login Error:</strong> {errorMessage}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Access Pills */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
            Quick Fill Demo Accounts
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleDemoFill('admin@aoa77.com', 'Aoa77@Password2026!')}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-700 transition-colors text-center"
            >
              Fill Admin (MD)
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('manager@aoa77.com', 'Aoa77@Password2026!')}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-700 transition-colors text-center"
            >
              Fill Manager (Finance)
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleInstantDemoLogin('Admin')}
            className="w-full py-2.5 px-4 rounded-full bg-indigo-50 hover:bg-indigo-100 text-[#5847F6] border border-indigo-200/70 text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1-Click Instant Demo Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};
