'use client';

import React, { useEffect, useState } from 'react';
import type { CockpitManifestEntry } from '@cacheplane/cockpit-registry';
import type { NavigationProduct } from '../lib/route-resolution';
import { toCockpitPath } from '../lib/route-resolution';
import { PRODUCT_LABELS, stripProductPrefix } from '../lib/navigation-labels';
import { LanguagePicker } from './sidebar/language-picker';

function CloseIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

interface MobileNavOverlayProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavOverlay({
  navigationTree,
  manifest,
  entry,
  isOpen,
  onClose,
}: MobileNavOverlayProps) {
  const [state, setState] = useState<'closed' | 'open' | 'closing'>(
    isOpen ? 'open' : 'closed'
  );

  useEffect(() => {
    if (isOpen) {
      setState('open');
    } else if (state === 'open') {
      setState('closing');
    }
  }, [isOpen]);

  useEffect(() => {
    if (state !== 'closing') return;
    const timer = setTimeout(() => setState('closed'), 150);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state !== 'open') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, onClose]);

  if (state === 'closed') return null;

  return (
    <div
      data-state={state}
      className="fixed inset-0 z-50 md:hidden flex flex-col"
      style={{
        background: 'var(--ds-glass-bg)',
        backdropFilter: 'blur(var(--ds-glass-blur))',
        WebkitBackdropFilter: 'blur(var(--ds-glass-blur))',
        opacity: state === 'open' ? 1 : 0,
        transform: state === 'open' ? 'translateY(0)' : 'translateY(8px)',
        transition: state === 'open'
          ? 'opacity 200ms ease-out, transform 200ms ease-out'
          : 'opacity 150ms ease-in, transform 150ms ease-in',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ds-glass-border)' }}
      >
        <p
          className="font-mono text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--ds-text-muted)' }}
        >
          Cockpit
        </p>
        <div className="flex items-center gap-3">
          <LanguagePicker manifest={manifest} entry={entry} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="p-2 -m-2"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ds-text-muted)',
            }}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {/* Scrollable product cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {navigationTree.map((product) => {
          const label = PRODUCT_LABELS[product.product] ?? product.product;
          const topics = product.sections.flatMap((section) =>
            section.entries.filter((e) => e.topic !== 'overview')
          );

          if (topics.length === 0) return null;

          return (
            <div
              key={product.product}
              style={{
                background: 'var(--ds-glass-bg)',
                border: '1px solid var(--ds-glass-border)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--ds-font-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--ds-accent)',
                  marginBottom: 8,
                }}
              >
                {label}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {topics.map((topicEntry) => {
                  const isActive =
                    topicEntry.product === entry.product &&
                    topicEntry.section === entry.section &&
                    topicEntry.topic === entry.topic &&
                    topicEntry.page === entry.page;

                  return (
                    <a
                      key={`${topicEntry.product}-${topicEntry.topic}`}
                      href={toCockpitPath(topicEntry)}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        background: isActive ? 'var(--ds-accent-surface)' : 'rgba(0, 0, 0, 0.04)',
                        color: isActive ? 'var(--ds-accent)' : 'var(--ds-text-secondary)',
                        border: isActive ? '1px solid var(--ds-accent-border)' : '1px solid transparent',
                      }}
                    >
                      {stripProductPrefix(topicEntry.title)}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
