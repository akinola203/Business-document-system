import { useAuthStore } from '../store/auth.store';
import { DocumentType } from '../types';

/**
 * Clean permission and role helper hook for UI components.
 * Exposes boolean flags for privileged actions (Approve, Reject, Issue, Delete, Admin, Settings).
 */
export function usePermissions() {
  const {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    hasPermission,
    hasAnyPermission,
    hasRole,
  } = useAuthStore();

  const canApprove = (docType?: DocumentType | string): boolean => {
    if (isAdmin) return true;
    if (!docType) {
      return hasAnyPermission(['invoice:approve', 'waybill:approve', 'letter:approve']);
    }
    const t = docType.toLowerCase();
    return hasPermission(`${t}:approve`);
  };

  const canReject = (docType?: DocumentType | string): boolean => {
    return canApprove(docType);
  };

  const canIssue = (docType?: DocumentType | string): boolean => {
    if (isAdmin) return true;
    if (!docType) {
      return hasAnyPermission(['invoice:issue', 'waybill:dispatch', 'letter:issue']);
    }
    const t = docType.toLowerCase();
    if (t === 'waybill') {
      return hasPermission('waybill:dispatch') || hasPermission('waybill:approve');
    }
    return hasPermission(`${t}:issue`);
  };

  const canCancel = (docType?: DocumentType | string): boolean => {
    if (isAdmin) return true;
    if (!docType) {
      return hasAnyPermission(['invoice:cancel', 'waybill:cancel']);
    }
    const t = docType.toLowerCase();
    return hasPermission(`${t}:cancel`);
  };

  const canDelete = isAdmin;

  const canManageSettings =
    isAdmin || hasPermission('settings:manage') || hasPermission('company:update');

  const canViewAuditLogs = isAdmin || hasPermission('audit:view');

  const canManageUsers =
    isAdmin || hasPermission('users:manage') || hasPermission('users:view');

  const canViewReports = isAdmin || hasPermission('reports:view');

  const canRecordPayment = isAdmin || hasPermission('payment:record');

  return {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    hasPermission,
    hasAnyPermission,
    hasRole,
    canApprove,
    canReject,
    canIssue,
    canCancel,
    canDelete,
    canManageSettings,
    canViewAuditLogs,
    canManageUsers,
    canViewReports,
    canRecordPayment,
  };
}
