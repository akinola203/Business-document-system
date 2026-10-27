import React from 'react';
import { Truck } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const WaybillsPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Waybills & Delivery Notes"
      subtitle="Logistics dispatch tracking, vehicle manifests, and multi-stage delivery confirmation"
      badge="Phase 8B"
      phase="Phase 8B: Finnova Master-Detail Workspaces"
      icon={Truck}
    />
  );
};
