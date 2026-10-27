import React from 'react';
import { FileText } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const InvoicesPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Invoices"
      subtitle="Manage corporate billing, VAT calculations, approvals, and settlement balances"
      badge="Phase 8B"
      phase="Phase 8B: Finnova Master-Detail Workspaces"
      icon={FileText}
    />
  );
};
