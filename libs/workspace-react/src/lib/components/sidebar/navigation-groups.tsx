'use client';

import { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import type { NavigationProduct } from '@threadplane/cockpit-shell';
import {
  PRODUCT_LABELS,
  stripProductPrefix,
} from '../../navigation-labels';
import type { TrackNavigation } from '../../host-services';
import type { WorkspaceHostServices } from '../../workspace-contracts';
import { handleWorkspaceNavigation } from '../../workspace-navigation';

interface NavigationGroupsProps {
  tree: NavigationProduct[];
  currentEntry: CockpitManifestEntry;
  hostServices: WorkspaceHostServices;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (key: string, open: boolean) => void;
  onNavigate?: () => void;
  trackNavigation?: TrackNavigation;
}

function ProductGroup({
  product,
  currentEntry,
  hostServices,
  open,
  onOpenChange,
  onNavigate,
  trackNavigation,
}: {
  product: NavigationProduct;
  currentEntry: CockpitManifestEntry;
  hostServices: WorkspaceHostServices;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
  trackNavigation?: TrackNavigation;
}) {
  const label = PRODUCT_LABELS[product.product] ?? product.product;
  const contentId = useId();

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span className="workspace-nav-group-label">{label}</span>
        <span
          className={`workspace-nav-caret${
            open ? ' workspace-nav-caret--open' : ''
          }`}
          aria-hidden="true"
        >
          <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div
          id={contentId}
          style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}
        >
          {product.sections.flatMap((section) =>
            section.entries
              .filter((entry) => entry.topic !== 'overview')
              .map((entry) => {
                const href = hostServices.resolveEntryHref(entry);
                const isActive =
                  entry.product === currentEntry.product &&
                  entry.section === currentEntry.section &&
                  entry.topic === currentEntry.topic &&
                  entry.page === currentEntry.page;

                return (
                  <a
                    key={`${entry.product}-${entry.topic}`}
                    href={href}
                    data-capability-link
                    data-workspace-navigation-link
                    onClick={(event) => {
                      trackNavigation?.({
                        capability: entry.topic,
                        category: entry.product,
                        fromCapability: currentEntry.topic,
                      });
                      handleWorkspaceNavigation({
                        event,
                        hostServices,
                        onNavigate,
                      });
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    className="workspace-nav-item"
                  >
                    {stripProductPrefix(entry.title)}
                  </a>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}

export function NavigationGroups({
  tree,
  currentEntry,
  hostServices,
  expanded = {},
  onExpandedChange,
  onNavigate,
  trackNavigation,
}: NavigationGroupsProps) {
  return (
    <nav
      aria-label="Documentation navigation"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      {tree.map((product) => {
        const key = `Capability:${product.product}`;
        return (
          <ProductGroup
            key={product.product}
            product={product}
            currentEntry={currentEntry}
            hostServices={hostServices}
            open={expanded[key] ?? true}
            onOpenChange={(open) => onExpandedChange?.(key, open)}
            onNavigate={onNavigate}
            trackNavigation={trackNavigation}
          />
        );
      })}
    </nav>
  );
}
