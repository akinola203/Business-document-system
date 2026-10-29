import React, { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { X, Mail, KeyRound, ArrowRight, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [debugLink, setDebugLink] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setIsSuccess(false);
      setErrorMessage(null);
      setDebugLink(null);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      const data = response.data?.data || response.data;
      setIsSuccess(true);
      if (data?.debugResetLink) {
        setDebugLink(data.debugResetLink);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to process reset request. Please check your network and try again.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-[28px] p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {!isSuccess ? (
          <div>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5847F6] mb-3 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Reset Your Password
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Enter your registered corporate email. If an active account matches, we'll send a secure 20-minute reset link.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@aoa77.com"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-5 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Success Screen */
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Reset Link Dispatched</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              If an account is associated with <span className="font-semibold text-slate-800">{email}</span>, a secure password reset link has been dispatched.
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              Please check your inbox and spam folder. The link is valid for 20 minutes.
            </p>

            {/* Local / Development Quick-Access Callout */}
            {debugLink && (
              <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-left">
                <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                  <span>⚡ Development Reset Link</span>
                </div>
                <p className="text-[11px] text-indigo-700 mb-2">
                  In local testing mode, you can open the reset page directly:
                </p>
                <a
                  href={debugLink}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5847F6] hover:underline break-all"
                  onClick={onClose}
                >
                  <span>Open Password Reset View</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-6 py-3 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
