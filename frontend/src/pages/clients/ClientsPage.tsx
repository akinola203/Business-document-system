import React from 'react';
import { Users } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const ClientsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Client Directory"
      subtitle="Corporate accounts, delivery addresses, credit limits, and historical ledgers"
      badge="Phase 8D"
      phase="Phase 8D: Clients Directory & Profiles"
      icon={Users}
    />
  );
};
