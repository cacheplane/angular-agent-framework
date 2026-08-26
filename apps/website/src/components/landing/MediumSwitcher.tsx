// SPDX-License-Identifier: MIT
'use client';
import { useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { trackCtaClick } from '../../lib/analytics/client';

export interface MediumPane {
  key: 'video' | 'code' | 'live';
  label: string;
  /**
   * Pre-rendered content. Code panes are highlighted on the server and passed
   * in, because `HighlightedCode` is an async Server Component and a client
   * component cannot render one as a child.
   */
  content: ReactNode;
}

interface MediumSwitcherProps {
  /** Used for tab/panel ids and the analytics `cta_id`. */
  sectionId: string;
  panes: MediumPane[];
}

export function MediumSwitcher({ sectionId, panes }: MediumSwitcherProps) {
  const [active, setActive] = useState(0);

  // One medium needs no control surface; chrome around a single option is noise.
  if (panes.length <= 1) {
    return <>{panes[0]?.content ?? null}</>;
  }

  const tabId = (key: string) => `${sectionId}-tab-${key}`;
  const panelId = (key: string) => `${sectionId}-panel-${key}`;

  const select = (index: number) => {
    setActive(index);
    trackCtaClick({
      surface: 'home_medium_switcher',
      cta_id: `${sectionId}_${panes[index].key}`,
      cta_text: panes[index].label,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = (active + delta + panes.length) % panes.length;
    select(next);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose how to view this"
        onKeyDown={onKeyDown}
        style={{ display: 'flex', gap: 6, marginBottom: 12 }}
      >
        {panes.map((pane, index) => {
          const selected = index === active;
          return (
            <button
              key={pane.key}
              id={tabId(pane.key)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(pane.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: selected ? tokens.colors.accent : tokens.colors.accentSurface,
                color: selected ? tokens.colors.textInverted : tokens.colors.textMuted,
              }}
            >
              {pane.label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId(panes[active].key)}
        role="tabpanel"
        aria-labelledby={tabId(panes[active].key)}
      >
        {panes[active].content}
      </div>
    </div>
  );
}
