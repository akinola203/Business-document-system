import React from 'react';
import { BarChart3 } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const ReportsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Financial & Operational Reports"
      subtitle="VAT reconciliation, revenue by customer, aging receivable buckets, and dispatch turnaround"
      badge="Phase 8D"
      phase="Phase 8D: Analytics & Reports"
      icon={BarChart3}
    />
  );
};
