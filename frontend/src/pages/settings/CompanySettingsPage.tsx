import React from 'react';
import { Settings } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const CompanySettingsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Company Profile & Banking Settings"
      subtitle="Corporate identity, RC Number, TIN, bank instructions, and asset uploads"
      badge="Phase 8D"
      phase="Phase 8D: Company Settings & Asset Manager"
      icon={Settings}
    />
  );
};
