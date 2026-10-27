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
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/overview';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

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
  const handleDemoFill = (role: 'Admin' | 'Manager') => {
    if (role === 'Admin') {
      setEmail('admin@aoa77.com');
      setPassword('Aoa77@Password2026!');
      setFeedbackMessage('Admin (MD) credentials populated into form.');
    } else {
      setEmail('manager@aoa77.com');
      setPassword('Aoa77@Password2026!');
      setFeedbackMessage('Manager (Finance) credentials populated into form.');
    }
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

        {/* Feedback Alert */}
        {feedbackMessage && !errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackMessage}</span>
          </div>
        )}

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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFeedbackMessage(null);
                }}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFeedbackMessage(null);
                }}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
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
        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Quick-Fill Demo Credentials
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Fills inputs
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="quick-fill-admin-btn"
                type="button"
                onClick={() => handleDemoFill('Admin')}
                className="px-3 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-[11px] font-bold text-[#5847F6] transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick-Fill: Admin</span>
              </button>
              <button
                id="quick-fill-manager-btn"
                type="button"
                onClick={() => handleDemoFill('Manager')}
                className="px-3 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-[11px] font-bold text-slate-700 transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <span>Quick-Fill: Manager</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1-Click Instant Demo Login
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Direct access
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="instant-login-admin-btn"
                type="button"
                onClick={() => handleInstantDemoLogin('Admin')}
                className="w-full py-2.5 px-3 rounded-2xl bg-[#16181F] hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm border border-slate-700 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Enter as Admin</span>
              </button>
              <button
                id="instant-login-manager-btn"
                type="button"
                onClick={() => handleInstantDemoLogin('Manager')}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm border border-slate-600 cursor-pointer active:scale-95"
              >
                <span>Enter as Manager</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
