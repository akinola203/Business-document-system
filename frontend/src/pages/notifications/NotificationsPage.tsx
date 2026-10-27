import React from 'react';
import { Bell } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const NotificationsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Notifications Center"
      subtitle="Lifecycle status changes, approval requests, rejection reasons, and payment confirmations"
      badge="Phase 8A"
      phase="Phase 8A/8B: Notification Feed"
      icon={Bell}
    />
  );
};
