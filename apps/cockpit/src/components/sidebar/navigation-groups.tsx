'use client';

import React, { useState } from 'react';
import type { CockpitManifestEntry } from '@cacheplane/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import { toCockpitPath } from '../../lib/route-resolution';

const PRODUCT_LABELS: Record<string, string> = {
  'deep-agents': 'Deep Agents',
  'langgraph': 'LangGraph',
};


function stripProductPrefix(title: string): string {
  const prefixes = ['Deep Agents ', 'LangGraph '];
  for (const p of prefixes) {
    if (title.startsWith(p)) return title.slice(p.length);
  }
  return title;
}

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
        <span style={{
          color: 'var(--ds-text-muted)',
          fontSize: 10,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(0)' : 'rotate(-90deg)',
        }}>
          ▾
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
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'block',
                    padding: '5px 16px',
                    margin: '0 8px',
                    borderRadius: 6,
                    fontSize: '0.825rem',
                    color: isActive ? 'var(--ds-accent)' : 'var(--ds-text-secondary)',
                    background: isActive ? 'var(--ds-accent-surface)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
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
