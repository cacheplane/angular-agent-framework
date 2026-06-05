'use client';

import React, { useState } from 'react';
import type { CockpitManifestEntry } from '@threadplane/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import { toCockpitPath } from '../../lib/route-resolution';
import { PRODUCT_LABELS, stripProductPrefix } from '../../lib/navigation-labels';
import { track } from '../../lib/analytics/client';

interface NavigationGroupsProps {
  tree: NavigationProduct[];
  currentEntry: CockpitManifestEntry;
}

function ProductGroup({
  product,
  currentEntry,
}: {
  product: NavigationProduct;
  currentEntry: CockpitManifestEntry;
}) {
  const [open, setOpen] = useState(true);
  const label = PRODUCT_LABELS[product.product] ?? product.product;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
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
        <span style={{
          fontFamily: 'var(--ds-font-mono)',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ds-accent)',
        }}>
          {label}
        </span>
        <span
          className={`cockpit-nav-caret${open ? ' cockpit-nav-caret--open' : ''}`}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 2.5 6.5 5 3.5 7.5" />
          </svg>
        </span>
      </button>

      {open && (
        <nav style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
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
        </nav>
      )}
    </div>
  );
}

export function NavigationGroups({ tree, currentEntry }: NavigationGroupsProps) {
  return (
    <nav aria-label="Cockpit navigation" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tree.map((product) => (
        <ProductGroup key={product.product} product={product} currentEntry={currentEntry} />
      ))}
    </nav>
  );
}
