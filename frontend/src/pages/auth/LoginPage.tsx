import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api-client';
import { Sparkles, ArrowRight, Lock, Mail, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const from = location.state?.from?.pathname || '/overview';
  const successMessage = location.state?.successMessage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const payload = response.data?.data || response.data;
      const accessToken = payload.accessToken;
      const refreshToken = payload.refreshToken;
      const rawUser = payload.user;

      const normalizedUser = {
        id: rawUser.id,
        email: rawUser.email,
        fullName: rawUser.fullName || `${rawUser.firstName || ''} ${rawUser.lastName || ''}`.trim() || 'Workspace User',
        role: rawUser.role,
        roleName: rawUser.role,
        permissions: rawUser.permissions || ['*'],
        companyId: rawUser.company?.id || rawUser.companyId || 'c0000000-0000-0000-0000-000000000001',
        companyName: rawUser.company?.name || rawUser.companyName || 'AOA 77 COMPANY LTD',
      };

      login({ accessToken, refreshToken }, normalizedUser);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Authentication failed. Please verify your email and password.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
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

        {/* Success Alert (e.g. following password reset) */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Success:</strong> {successMessage}
            </div>
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-xs font-semibold text-[#5847F6] hover:text-[#4939E3] hover:underline transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
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

        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={isForgotModalOpen}
          onClose={() => setIsForgotModalOpen(false)}
          initialEmail={email}
        />
      </div>
    </div>
  );
};
