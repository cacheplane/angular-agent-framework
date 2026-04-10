# Cockpit Mobile Menu Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cockpit's narrow w-64 mobile drawer with a full-screen overlay using product cards and topic chips.

**Architecture:** A new `MobileNavOverlay` client component renders a `fixed inset-0` overlay on mobile with product groups as glass cards and topics as pill-shaped `<a>` links. It reuses the `LanguagePicker` component and `toCockpitPath` helper. The existing `CockpitSidebar` is untouched (desktop only). The `cockpit-shell.tsx` swaps the old mobile overlay JSX for the new component.

**Tech Stack:** React 19, Next.js 15, Tailwind CSS v4, CSS custom properties (`--ds-*` design tokens), Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-cockpit-mobile-menu-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/cockpit/src/components/mobile-nav-overlay.tsx` | Create | Full-screen mobile nav overlay with product cards + topic chips |
| `apps/cockpit/src/components/mobile-nav-overlay.spec.tsx` | Create | Tests for the overlay component |
| `apps/cockpit/src/components/cockpit-shell.tsx` | Modify (lines 73-95) | Replace old mobile drawer with `MobileNavOverlay` |

---

### Task 1: Create MobileNavOverlay component with tests

**Files:**
- Create: `apps/cockpit/src/components/mobile-nav-overlay.spec.tsx`
- Create: `apps/cockpit/src/components/mobile-nav-overlay.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/cockpit/src/components/mobile-nav-overlay.spec.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cockpitManifest } from '@cacheplane/cockpit-registry';
import { buildNavigationTree } from '../lib/route-resolution';
import { MobileNavOverlay } from './mobile-nav-overlay';

const tree = buildNavigationTree(cockpitManifest);
const entry = cockpitManifest.find(
  (e) =>
    e.product === 'render' &&
    e.section === 'core-capabilities' &&
    e.topic === 'spec-rendering' &&
    e.language === 'python'
)!;

describe('MobileNavOverlay', () => {
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders all four product groups when open', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('LangGraph');
    expect(html).toContain('Render');
    expect(html).toContain('Chat');
    expect(html).toContain('Deep Agents');
  });

  it('renders topic chips as links', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Streaming');
    expect(html).toContain('Persistence');
    expect(html).toContain('Messages');
    expect(html).toContain('href="/');
  });

  it('highlights the active entry chip', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('aria-current="page"');
  });

  it('strips product prefix from topic titles', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    // "Render Spec Rendering" should become "Spec Rendering"
    // Should NOT contain the double-prefixed form
    expect(html).toContain('Spec Rendering');
    expect(html).not.toContain('>Render Spec Rendering<');
  });

  it('filters out overview topics', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    // overview entries should be excluded
    const overviewLinkCount = (html.match(/\/overview\//g) || []).length;
    // Only the path segments that are part of other routes, not standalone overview chips
    expect(html).not.toMatch(/data-topic="overview"/);
  });

  it('includes the language picker', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('Python');
  });

  it('includes a close button', () => {
    const html = renderToStaticMarkup(
      <MobileNavOverlay
        navigationTree={tree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(html).toContain('aria-label="Close navigation"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test cockpit -- --run --reporter=verbose apps/cockpit/src/components/mobile-nav-overlay.spec.tsx`

Expected: FAIL — `MobileNavOverlay` does not exist yet.

- [ ] **Step 3: Implement MobileNavOverlay**

Create `apps/cockpit/src/components/mobile-nav-overlay.tsx`:

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CockpitManifestEntry } from '@cacheplane/cockpit-registry';
import type { NavigationProduct } from '../lib/route-resolution';
import { toCockpitPath } from '../lib/route-resolution';
import { LanguagePicker } from './sidebar/language-picker';

const PRODUCT_LABELS: Record<string, string> = {
  'deep-agents': 'Deep Agents',
  'langgraph': 'LangGraph',
  'render': 'Render',
  'chat': 'Chat',
};

function stripProductPrefix(title: string): string {
  const prefixes = ['Deep Agents ', 'LangGraph ', 'Render ', 'Chat '];
  for (const p of prefixes) {
    if (title.startsWith(p)) return title.slice(p.length);
  }
  return title;
}

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'closed' | 'open' | 'closing'>('closed');

  useEffect(() => {
    if (isOpen) {
      setState('open');
    } else if (state === 'open') {
      setState('closing');
    }
  }, [isOpen]);

  useEffect(() => {
    if (state === 'closing') {
      const timer = setTimeout(() => setState('closed'), 150);
      return () => clearTimeout(timer);
    }
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
      ref={overlayRef}
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test cockpit -- --run --reporter=verbose apps/cockpit/src/components/mobile-nav-overlay.spec.tsx`

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/mobile-nav-overlay.tsx apps/cockpit/src/components/mobile-nav-overlay.spec.tsx
git commit -m "feat(cockpit): add full-screen mobile nav overlay component"
```

---

### Task 2: Integrate MobileNavOverlay into cockpit-shell.tsx

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx:1-148`

- [ ] **Step 1: Add the import**

At the top of `cockpit-shell.tsx`, add the import after line 12 (`import { CockpitSidebar }...`):

```tsx
import { MobileNavOverlay } from './mobile-nav-overlay';
```

- [ ] **Step 2: Replace the mobile sidebar overlay**

Remove lines 73-95 (the `{isSidebarOpen && (<>...</>)}` block) and replace with:

```tsx
      {/* Mobile full-screen nav overlay */}
      <MobileNavOverlay
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
```

Everything else in the file stays the same — the `isSidebarOpen` state, the hamburger button, the desktop sidebar, the header, and the content area are all unchanged.

- [ ] **Step 3: Run the full cockpit test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`

Expected: All existing tests PASS (sidebar, language-picker, mode-switcher, run-mode, etc.) plus the new mobile-nav-overlay tests.

- [ ] **Step 4: Verify locally in the browser**

Run: `npx nx serve cockpit --port 4201`

Open `http://localhost:4201/render/core-capabilities/spec-rendering/overview/python` in a mobile viewport (Chrome DevTools device toolbar, ~375px wide):
- Tap the hamburger menu icon
- Overlay should appear full-screen with animated fade-in
- All 4 product cards visible with topic chips
- "Spec Rendering" chip should be highlighted
- Tap X to close — should fade out
- Tap a different chip — should navigate to that page

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat(cockpit): integrate full-screen mobile nav overlay in shell"
```
