import React from 'react';
import { Mail } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const LettersPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Business Letters"
      subtitle="Corporate correspondence, reference numbers, letterheads, and executive signatory blocks"
      badge="Phase 8B"
      phase="Phase 8B: Finnova Master-Detail Workspaces"
      icon={Mail}
    />
  );
};
