// SPDX-License-Identifier: MIT
'use client';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { trackCtaClick } from '../../lib/analytics/client';

export interface MediumPane {
  /** Unique within a switcher — used for React keys and DOM ids. */
  id: string;
  /** Which medium this is; drives analytics, not identity. */
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
  // Call sites pass a static `panes` array, so the index cannot go stale. If a
  // caller ever makes a medium conditional, this needs a clamp.
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // One medium needs no control surface; chrome around a single option is noise.
  if (panes.length <= 1) {
    return <>{panes[0]?.content ?? null}</>;
  }

  const tabId = (id: string) => `${sectionId}-tab-${id}`;
  const panelId = (id: string) => `${sectionId}-panel-${id}`;

  const select = (index: number) => {
    setActive(index);
    trackCtaClick({
      surface: 'home_medium_switcher',
      cta_id: `medium_${sectionId}_${panes[index].key}`,
      cta_text: panes[index].label,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const last = panes.length - 1;
    let next: number;
    if (event.key === 'ArrowRight') next = (active + 1) % panes.length;
    else if (event.key === 'ArrowLeft') next = (active - 1 + panes.length) % panes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;

    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={`Choose how to view the ${sectionId} section`}
        onKeyDown={onKeyDown}
        style={{ display: 'flex', gap: 6, marginBottom: 12 }}
      >
        {panes.map((pane, index) => {
          const selected = index === active;
          return (
            <button
              key={pane.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={tabId(pane.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(pane.id)}
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
        id={panelId(panes[active].id)}
        role="tabpanel"
        aria-labelledby={tabId(panes[active].id)}
      >
        {panes[active].content}
      </div>
    </div>
  );
}
