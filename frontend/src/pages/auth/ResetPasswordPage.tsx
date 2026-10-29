import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import {
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validation criteria
  const isLengthValid = newPassword.length >= 8;
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = isLengthValid && isMatchValid && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMessage('Reset token is missing from the URL. Please use the link provided in your email.');
      return;
    }

    if (!isLengthValid) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!isMatchValid) {
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await apiClient.post('/auth/reset-password', {
        token: token.trim(),
        newPassword,
      });

      setIsSuccess(true);

      // Redirect after brief delay so user perceives the positive feedback
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            successMessage:
              'Your password has been successfully reset! You can now log in with your new password.',
          },
        });
      }, 2000);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Password reset failed. The reset token may be invalid or expired.';
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Set New Password</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Choose a strong password for your AOA 77 account
          </p>
        </div>

        {/* Missing Token Warning */}
        {!token && (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
            <p className="font-semibold">Missing or Invalid Password Reset Link</p>
            <p className="text-amber-700">
              No reset token was found in the URL. Please click the full link in your email or request a new reset link.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5847F6] hover:underline pt-2"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Reset Failed:</strong> {errorMessage}
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Password Updated Successfully!</h2>
            <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
              Your new password is now active. You are being redirected to the sign-in screen...
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 py-2.5 px-5 rounded-full bg-[#5847F6] text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-[#4939E3] transition-all"
              >
                <span>Sign In Immediately</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          token && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    className="w-full pl-11 pr-11 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new secure password"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#5847F6] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Password Requirements:</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className={`flex items-center gap-2 ${isLengthValid ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isLengthValid ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>At least 8 characters long</span>
                  </div>
                  <div className={`flex items-center gap-2 ${isMatchValid ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isMatchValid ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
};
