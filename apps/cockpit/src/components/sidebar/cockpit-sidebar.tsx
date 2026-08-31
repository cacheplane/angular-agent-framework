import React from 'react';
import { Boxes, Code2, ExternalLink, Package } from 'lucide-react';
import {
  ControlPlaneActionBar,
  ControlPlaneEnvironmentList,
  ControlPlaneIconButton,
  ControlPlaneSection,
} from '@threadplane/ui-react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import { PRODUCT_LABELS, stripProductPrefix } from '../../lib/navigation-labels';
import { NavigationGroups } from './navigation-groups';

interface CockpitSidebarProps {
  navigationTree: NavigationProduct[];
  entry: CockpitManifestEntry;
  runtimeUrl: string | null;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (key: string, open: boolean) => void;
  onNavigate?: () => void;
}

export function CockpitSidebar({
  navigationTree,
  entry,
  runtimeUrl,
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
          <span>{entry.section.split('-').map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join(' ')}</span>
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

      <ControlPlaneSection
        title="Environment"
        open={expanded.Environment ?? true}
        onOpenChange={(open) => onExpandedChange?.('Environment', open)}
      >
        <ControlPlaneEnvironmentList rows={[
          { label: 'Product', value: product, icon: <Boxes size={15} aria-hidden="true" /> },
          { label: 'Language', value: entry.language === 'typescript' ? 'TypeScript' : 'Python', icon: <Code2 size={15} aria-hidden="true" /> },
          ...(runtimeUrl ? [{ label: 'Runtime', value: 'Available', icon: <Package size={15} aria-hidden="true" /> }] : []),
        ]} />
      </ControlPlaneSection>

      {runtimeUrl ? (
        <ControlPlaneSection title="Actions" collapsible={false}>
          <ControlPlaneActionBar label="Cockpit actions">
            <ControlPlaneIconButton
              label="Open runtime"
              icon={<ExternalLink size={16} aria-hidden="true" />}
              href={runtimeUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          </ControlPlaneActionBar>
        </ControlPlaneSection>
      ) : null}
    </div>
  );
}
