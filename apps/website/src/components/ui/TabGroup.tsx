'use client';
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

export interface TabPane {
  /** Unique within a group — used for React keys and DOM ids. */
  id: string;
  label: string;
  content: ReactNode;
}

interface TabGroupProps {
  /** Namespaces the tab/panel ids so two groups on one page cannot collide. */
  groupId: string;
  /** Names this group for screen-reader users jumping by role. */
  label: string;
  panes: TabPane[];
  /**
   * Called when the reader picks a tab — NOT on first render, since arriving at
   * a default is not a choice. Analytics belongs to the caller: this primitive
   * has no opinion about what a tab means.
   */
  onSelect?: (pane: TabPane, index: number) => void;
}

/**
 * The ARIA tabs pattern, done once.
 *
 * Extracted because the homepage grew two tab widgets and only one implemented
 * the pattern properly. `DemoShowcase` announced `role="tablist"` with no
 * `aria-controls`, no roving tabindex, and no keyboard handling — which is
 * worse than plain buttons, because the roles promise assistive technology a
 * widget that then does not respond to arrow keys.
 *
 * Two properties are easy to get wrong and are pinned by tests:
 *
 * - **Only the active pane is mounted.** Inactive panes are absent from the
 *   DOM, not hidden with CSS. Callers put videos and iframes in panes, so a
 *   CSS-toggled implementation would fetch every one of them on page load.
 * - **Focus follows selection.** Arrow keys move DOM focus along with
 *   `aria-selected`. Without that the newly-inactive tab keeps focus while
 *   holding `tabIndex={-1}`, so the next Tab press skips the whole tablist.
 */
export function TabGroup({ groupId, label, panes, onSelect }: TabGroupProps) {
  // Call sites pass a static `panes` array, so the index cannot go stale. If a
  // caller ever makes a pane conditional, this needs a clamp.
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // One pane needs no control surface; chrome around a single option is noise.
  if (panes.length <= 1) {
    return <>{panes[0]?.content ?? null}</>;
  }

  const tabId = (id: string) => `${groupId}-tab-${id}`;
  const panelId = (id: string) => `${groupId}-panel-${id}`;

  const select = (index: number) => {
    setActive(index);
    onSelect?.(panes[index], index);
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
    <div data-ui="tab-group">
      <div data-ui="tab-group-list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {panes.map((pane, index) => {
          const selected = index === active;
          return (
            <button
              key={pane.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={tabId(pane.id)}
              data-ui="tab-group-tab"
              data-active={selected || undefined}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId(pane.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
            >
              {pane.label}
            </button>
          );
        })}
      </div>

      <div id={panelId(panes[active].id)} role="tabpanel" aria-labelledby={tabId(panes[active].id)}>
        {panes[active].content}
      </div>
    </div>
  );
}
