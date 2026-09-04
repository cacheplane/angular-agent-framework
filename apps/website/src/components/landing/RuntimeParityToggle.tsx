'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { trackCtaClick } from '../../lib/analytics/client';

type Adapter = 'langgraph' | 'ag_ui';

const ADAPTERS: { key: Adapter; label: string }[] = [
  { key: 'langgraph', label: 'LangGraph' },
  { key: 'ag_ui', label: 'AG-UI' },
];

interface RuntimeParityToggleProps {
  /**
   * Both panes are highlighted on the server and handed down as elements, so
   * switching never round-trips or re-highlights. Only the selected one is
   * mounted — `hidden` would keep the inactive copy in the accessibility tree
   * for `getByText`/screen readers, which is the wrong reading of "what
   * changes".
   */
  configPanes: Record<Adapter, ReactNode>;
  componentPane: ReactNode;
}

/**
 * Runtime parity toggle (spec §6): the left pane swaps with the adapter, the
 * right pane is pinned to make the point that the component tree does not.
 */
export function RuntimeParityToggle({ configPanes, componentPane }: RuntimeParityToggleProps) {
  const [adapter, setAdapter] = useState<Adapter>('langgraph');
  const radioRefs = useRef<Record<Adapter, HTMLButtonElement | null>>({ langgraph: null, ag_ui: null });

  const select = (key: Adapter) => {
    if (key === adapter) return;
    setAdapter(key);
    trackCtaClick({
      cta_id: 'home_runtime_parity_toggle',
      adapter: key,
      track: 'developer',
      surface: 'home',
    });
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = adapter === 'langgraph' ? 'ag_ui' : 'langgraph';
    select(next);
    // APG roving radiogroup: DOM focus follows the newly checked radio.
    radioRefs.current[next]?.focus();
  };

  return (
    <div className="parity">
      <div role="radiogroup" aria-label="Runtime adapter" className="parity-toggle">
        {ADAPTERS.map((a) => (
          <button
            key={a.key}
            ref={(el) => {
              radioRefs.current[a.key] = el;
            }}
            type="button"
            role="radio"
            aria-checked={a.key === adapter}
            tabIndex={a.key === adapter ? 0 : -1}
            className="parity-toggle-btn"
            onClick={() => select(a.key)}
            onKeyDown={onKey}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="parity-panes">
        <div className="parity-pane">
          <p className="parity-pane-label">
            What changes <span className="parity-pane-file">app.config.ts</span>
          </p>
          {configPanes[adapter]}
        </div>
        <div className="parity-pane" data-pinned>
          <p className="parity-pane-label">
            What does not <span className="parity-pane-badge">same in both</span>
          </p>
          {componentPane}
        </div>
      </div>
    </div>
  );
}
