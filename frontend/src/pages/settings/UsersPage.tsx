import React from 'react';
import { Users } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const UsersPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Users & Access Control (IAM)"
      subtitle="Team member provisioning, password resets, role-permission matrices, and session revocation"
      badge="Phase 8D"
      phase="Phase 8D: Administrative IAM"
      icon={Users}
    />
  );
};
