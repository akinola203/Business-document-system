import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const AuditLogsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Audit Trail & Security Logs"
      subtitle="Immutable event logs recording all document creation, edits, approvals, payments, and role changes"
      badge="Phase 8D"
      phase="Phase 8D: Audit Log Viewer"
      icon={ShieldCheck}
    />
  );
};
