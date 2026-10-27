import React from 'react';
import { Palette } from 'lucide-react';
import { PlaceholderWorkspace } from '../../components/common/PlaceholderWorkspace';

export const TemplatesPage: React.FC = () => {
  return (
    <PlaceholderWorkspace
      title="Document Layout Templates"
      subtitle="Versioned corporate styling templates with HTML structures and CSS print stylesheets"
      badge="Phase 8D"
      phase="Phase 8D: Template Customizer"
      icon={Palette}
    />
  );
};
