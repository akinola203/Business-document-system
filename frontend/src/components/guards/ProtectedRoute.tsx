import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
}) => {
  const location = useLocation();
  const { isAuthenticated, isAdmin, hasPermission, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !isAdmin && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Your active account does not have the required permission (<code>{requiredPermission}</code>)
          to view this workspace section. Please contact your company administrator.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded-full bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          Return to previous page
        </button>
      </div>
    );
  }

  if (requiredRole && !isAdmin && !hasRole(requiredRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4 shadow-sm border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Role Authorization Required</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          This area is restricted to members with the <strong>{requiredRole}</strong> role.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded-full bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
