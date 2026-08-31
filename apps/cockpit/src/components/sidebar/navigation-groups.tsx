'use client';

import React, { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import { toCockpitPath } from '../../lib/route-resolution';
import { PRODUCT_LABELS, stripProductPrefix } from '../../lib/navigation-labels';
import { track } from '../../lib/analytics/client';

interface NavigationGroupsProps {
  tree: NavigationProduct[];
  currentEntry: CockpitManifestEntry;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (key: string, open: boolean) => void;
  onNavigate?: () => void;
}

function ProductGroup({
  product,
  currentEntry,
  open,
  onOpenChange,
  onNavigate,
}: {
  product: NavigationProduct;
  currentEntry: CockpitManifestEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
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
        <span className="cockpit-nav-group-label">
          {label}
        </span>
        <span
          className={`cockpit-nav-caret${open ? ' cockpit-nav-caret--open' : ''}`}
          aria-hidden="true"
        >
          <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id={contentId} style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          {product.sections.flatMap((section) =>
            section.entries
              .filter((entry) => entry.topic !== 'overview')
              .map((entry) => {
              const isActive =
                entry.product === currentEntry.product &&
                entry.section === currentEntry.section &&
                entry.topic === currentEntry.topic &&
                entry.page === currentEntry.page;

              return (
                <a
                  key={`${entry.product}-${entry.topic}`}
                  href={toCockpitPath(entry)}
                  data-capability-link
                  onClick={() => {
                    onNavigate?.();
                    track('cockpit:recipe_opened', {
                      capability: entry.topic,
                      category: entry.product,
                      from_capability: currentEntry.topic,
                    });
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className="cockpit-nav-item"
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
  expanded = {},
  onExpandedChange,
  onNavigate,
}: NavigationGroupsProps) {
  return (
    <nav aria-label="Cockpit navigation" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tree.map((product) => {
        const key = `Capability:${product.product}`;
        return (
          <ProductGroup
            key={product.product}
            product={product}
            currentEntry={currentEntry}
            open={expanded[key] ?? true}
            onOpenChange={(open) => onExpandedChange?.(key, open)}
            onNavigate={onNavigate}
          />
        );
      })}
    </nav>
  );
}
