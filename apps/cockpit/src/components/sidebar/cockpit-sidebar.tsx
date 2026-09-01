import React from 'react';
import { ControlPlaneSection } from '@threadplane/ui-react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import {
  PRODUCT_LABELS,
  stripProductPrefix,
} from '../../lib/navigation-labels';
import { NavigationGroups } from './navigation-groups';

interface CockpitSidebarProps {
  navigationTree: NavigationProduct[];
  entry: CockpitManifestEntry;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (key: string, open: boolean) => void;
  onNavigate?: () => void;
}

export function CockpitSidebar({
  navigationTree,
  entry,
  expanded = {},
  onExpandedChange,
  onNavigate,
}: CockpitSidebarProps) {
  const product = PRODUCT_LABELS[entry.product] ?? entry.product;

  return (
    <div data-cockpit-context-content>
      <ControlPlaneSection title="Scope" collapsible={false}>
        <div className="cockpit-control-plane-scope">
          <span>{product}</span>
          <span>
            {entry.section
              .split('-')
              .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
              .join(' ')}
          </span>
          <strong>{stripProductPrefix(entry.title)}</strong>
        </div>
      </ControlPlaneSection>

      <ControlPlaneSection
        title="Capability"
        open={expanded.Capability ?? true}
        onOpenChange={(open) => onExpandedChange?.('Capability', open)}
      >
        <NavigationGroups
          tree={navigationTree}
          currentEntry={entry}
          expanded={expanded}
          onExpandedChange={onExpandedChange}
          onNavigate={onNavigate}
        />
      </ControlPlaneSection>
    </div>
  );
}
