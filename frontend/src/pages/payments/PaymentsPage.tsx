import React from 'react';
import { CreditCard } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const PaymentsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Payments Ledger"
      subtitle="Financial settlement records, multi-method deposits, partial payments, and reversal audits"
      badge="Phase 8D"
      phase="Phase 8D: Payments Ledger & Settlements"
      icon={CreditCard}
    />
  );
};
