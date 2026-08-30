'use client';
import { useId, useRef, useState, Children, isValidElement } from 'react';

interface TabProps {
  label?: string;
  children: React.ReactNode;
}

/**
 * ARIA tabs pattern, mirroring ui/TabGroup: roles, roving tabindex, and
 * arrow-key selection. Selection follows focus (the WAI-ARIA "automatic
 * activation" flavor) because switching a docs tab is cheap.
 */
export function Tabs({ items, children }: { items?: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Extract labels: from items prop, from Tab label prop, or fallback
  const labels = items ?? tabs.map((child, i) => {
    if (isValidElement<TabProps>(child) && child.props.label) {
      return child.props.label;
    }
    return `Tab ${i + 1}`;
  });

  const select = (i: number) => {
    const next = (i + labels.length) % labels.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); select(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); select(active - 1); }
    if (e.key === 'Home') { e.preventDefault(); select(0); }
    if (e.key === 'End') { e.preventDefault(); select(labels.length - 1); }
  };

  return (
    <div className="mdx-tabs">
      {/* Tab bar */}
      <div className="mdx-tabs-bar" role="tablist" onKeyDown={onKeyDown}>
        {labels.map((label, i) => (
          <button
            key={label}
            ref={(el) => { tabRefs.current[i] = el; }}
            id={`${baseId}-tab-${i}`}
            role="tab"
            aria-selected={active === i}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className="mdx-tab-button"
            data-active={active === i ? '' : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Tab body — no wrapper border/background; the inner code block owns its surface */}
      <div id={`${baseId}-panel-${active}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${active}`}>
        {tabs[active]}
      </div>
    </div>
  );
}

export function Tab({ children }: TabProps) {
  return <div>{children}</div>;
}
