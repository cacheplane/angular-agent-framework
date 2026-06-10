# Homepage Demo Expand-to-Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "Launch live demo" on the homepage opens the live demo in a large, accessible modal/lightbox (near-viewport, 16:10) instead of swapping a cramped inline iframe.

**Architecture:** A new `DemoModal` client component owns the overlay (backdrop, browser-frame chrome, in-modal tabs, lazy iframe, sizing, a11y). `DemoShowcase` keeps the inline frame as a perpetual looping video and toggles a `modalOpen` boolean; the modal shares the section's `active` tab.

**Tech Stack:** Next.js + React (client components, inline styles + a scoped `<style>` block for responsive rules, `@threadplane/design-tokens`), Playwright e2e.

**Reference spec:** `docs/superpowers/specs/2026-06-07-demo-modal-design.md`

**Verification note:** The website has no component unit-test runner. Gate locally on `npx nx lint website` (CI runs the full build). Validate behavior with the dev server and the Task 3 Playwright spec. Commit after each task.

**Working dir:** worktree `.claude/worktrees/demo-modal` (branch `worktree-demo-modal`), off latest `main`.

---

## Task 1: `DemoModal` component

**Files:**
- Create: `apps/website/src/components/landing/DemoModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/website/src/components/landing/DemoModal.tsx
'use client';
import { useEffect, useRef } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { trackExternalLinkClick } from '../../lib/analytics/client';

type TabKey = 'langgraph' | 'ag-ui';

export interface DemoModalTab {
  key: TabKey;
  tabLabel: string;
  url: string;
  href: string;
}

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  tabs: DemoModalTab[];
  active: TabKey;
  onActive: (key: TabKey) => void;
}

export function DemoModal({ open, onClose, tabs, active, onActive }: DemoModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];

  // While open: Esc to close, focus trap, body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = frameRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live demo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(16,18,32,.55)',
        animation: 'demoModalBackdrop .16s ease-out',
      }}
    >
      <style>{`
        @keyframes demoModalBackdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes demoModalFrame { from { transform: scale(.96); opacity:.6 } to { transform: scale(1); opacity:1 } }
        .demo-modal__frame {
          width: min(96vw, calc(90vh * 16 / 10));
          background: ${tokens.surfaces.surface};
          border-radius: ${tokens.radius.lg};
          box-shadow: 0 24px 60px rgba(0,0,0,.45);
          overflow: hidden;
          display: flex; flex-direction: column;
          animation: demoModalFrame .16s ease-out;
        }
        .demo-modal__body { width: 100%; aspect-ratio: 16 / 10; background: #15161f; }
        @media (max-width: 640px) {
          .demo-modal__frame { width: 100vw; height: 100dvh; border-radius: 0; }
          .demo-modal__body { aspect-ratio: auto; flex: 1 1 auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"], .demo-modal__frame { animation: none !important; }
        }
      `}</style>

      <div ref={frameRef} className="demo-modal__frame">
        {/* header: window dots · tabs · faux url · close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: tokens.surfaces.surfaceTinted, borderBottom: `1px solid ${tokens.surfaces.border}` }}>
          <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#cdd2df' }} />)}
          </div>
          <div role="tablist" aria-label="Demo backend" style={{ display: 'flex', gap: 5 }}>
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => onActive(t.key)}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: on ? tokens.colors.accent : tokens.colors.accentSurface, color: on ? tokens.colors.textInverted : tokens.colors.textMuted }}>
                  {t.tabLabel}
                </button>
              );
            })}
          </div>
          <span style={{ flex: 1, textAlign: 'center', fontFamily: tokens.typography.fontMono, fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.url}</span>
          <button ref={closeBtnRef} onClick={onClose} aria-label="Close demo"
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', background: tokens.colors.accentSurface, color: tokens.colors.textSecondary, fontSize: 16, lineHeight: 1 }}>&#215;</button>
        </div>

        {/* body: lazy live iframe */}
        <div className="demo-modal__body">
          <iframe src={tab.href} title={`${tab.tabLabel} live demo`}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        </div>

        {/* footer: close hint · open full demo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: `1px solid ${tokens.surfaces.border}`, background: tokens.surfaces.surface }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: tokens.colors.textMuted }}>Esc or click outside to close &middot; MIT &middot; no signup</span>
          <a href={tab.href} target="_blank" rel="noopener noreferrer"
            onClick={() => trackExternalLinkClick(tab.href, { surface: 'home_demo', cta_id: `home_demo_full_${tab.key.replace(/-/g, '_')}`, cta_text: 'Open the full demo' })}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: tokens.colors.accent, textDecoration: 'none' }}>Open the full demo &#8599;</a>
        </div>
      </div>
    </div>
  );
}
```

> Verify these token names exist (used elsewhere): `tokens.surfaces.surface`, `tokens.surfaces.surfaceTinted` (used in the old `LiveDemoFrame`), `tokens.surfaces.border`, `tokens.radius.lg`, `tokens.colors.{accent,accentSurface,textInverted,textMuted,textSecondary}`, `tokens.typography.fontMono`. If any differ, substitute the name the codebase already uses. The analytics `cta_id` values match the existing `home_demo_${string}` pattern in `CtaId` (`apps/website/src/lib/analytics/events.ts`).

- [ ] **Step 2: Verify lint**

Run: `npx nx lint website`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/DemoModal.tsx
git commit -m "feat(website): DemoModal — lightbox for the homepage live demo"
```

---

## Task 2: Wire `DemoModal` into `DemoShowcase`

**Files:**
- Modify: `apps/website/src/components/landing/DemoShowcase.tsx`

Replace the inline iframe-swap (`launched`/`isLaunched`/`launch`) with a `modalOpen` boolean; the inline frame becomes a perpetual looping video; the launch overlay opens the modal.

- [ ] **Step 1: Update imports + state**

At the top of `DemoShowcase.tsx`, add imports:

```tsx
import { DemoModal } from './DemoModal';
import { trackCtaClick } from '../../lib/analytics/client';
```

Replace the state lines:

```tsx
const [active, setActive] = useState<TabKey>('langgraph');
const [launched, setLaunched] = useState<Set<TabKey>>(new Set());
const media = MEDIA.find((m) => m.key === active)!;
const isLaunched = launched.has(active);
const launch = () => setLaunched((prev) => new Set(prev).add(active));
```

with:

```tsx
const [active, setActive] = useState<TabKey>('langgraph');
const [modalOpen, setModalOpen] = useState(false);
const media = MEDIA.find((m) => m.key === active)!;
const launch = () => {
  trackCtaClick({ surface: 'home_demo', destination_url: media.href, cta_id: `home_demo_launch_${active.replace(/-/g, '_')}`, cta_text: 'Launch live demo' });
  setModalOpen(true);
};
```

- [ ] **Step 2: Make the inline frame always the looping video**

Replace the `<BrowserFrame ...>` block (the `{isLaunched ? (<iframe .../>) : (<>...</>)}` conditional) with the video + overlay only — no inline iframe branch:

```tsx
<BrowserFrame url={media.url} elevation="lg">
  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#15161f' }}>
    <video key={media.key} autoPlay muted loop playsInline poster={media.poster}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}>
      <source src={media.videoWebm} type="video/webm" />
      <source src={media.videoMp4} type="video/mp4" />
    </video>
    <button onClick={launch} aria-label={`Launch ${media.tabLabel} live demo`}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'linear-gradient(180deg, rgba(16,18,32,.15), rgba(16,18,32,.45))', border: 'none', cursor: 'pointer' }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15161f', fontSize: 22 }}>&#9654;</span>
      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '8px 14px', borderRadius: 8 }}>Launch live demo</span>
    </button>
  </div>
</BrowserFrame>
```

- [ ] **Step 3: Render the modal**

Just before the closing `</div>` of the component's root `<div style={{ maxWidth: 760, ... }}>`, add:

```tsx
<DemoModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  tabs={MEDIA}
  active={active}
  onActive={setActive}
/>
```

(`MEDIA` items carry `key`/`tabLabel`/`url`/`href` — structurally compatible with `DemoModalTab[]`.)

- [ ] **Step 4: Verify lint + scan for leftovers**

Run: `npx nx lint website`
Expected: PASS. Then confirm no stray references remain:

```bash
grep -n "isLaunched\|launched\|setLaunched" apps/website/src/components/landing/DemoShowcase.tsx
```
Expected: no matches.

- [ ] **Step 5: Visual check (dev server)**

Run the website dev server, open the homepage: click "Launch live demo" → a large centered modal opens with the live chat; tabs switch runtime; ×/Esc/backdrop-click close; focus returns to the launch button; the inline section still shows the looping video after closing.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/DemoShowcase.tsx
git commit -m "feat(website): open the live demo in a modal on launch"
```

---

## Task 3 (optional): Playwright e2e for the modal

**Files:**
- Create: `apps/website/e2e/demo-modal.spec.ts`

Add only if the website e2e harness covers the homepage `/`. First check the harness:

- [ ] **Step 1: Confirm the harness serves the homepage**

Read `apps/website/e2e/primitives.spec.ts` and the Playwright config (`apps/website/playwright.config.ts` or the project's e2e config) to learn the `baseURL` / `webServer` and the navigation pattern. If the homepage isn't reachable in the harness, STOP this task and note manual verification in the PR instead.

- [ ] **Step 2: Write the spec (match the harness's import + navigation style)**

```ts
// apps/website/e2e/demo-modal.spec.ts
import { test, expect } from '@playwright/test';

test('homepage demo: launch opens a modal, Esc closes it', async ({ page }) => {
  await page.goto('/');
  const launch = page.getByRole('button', { name: /launch .* live demo/i }).first();
  await launch.scrollIntoViewIfNeeded();
  await launch.click();

  const dialog = page.getByRole('dialog', { name: /live demo/i });
  await expect(dialog).toBeVisible();
  // live iframe present
  await expect(dialog.locator('iframe')).toBeVisible();

  // Esc closes and returns focus to the launch button
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launch).toBeFocused();
});

test('homepage demo: in-modal tabs switch the runtime', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /launch .* live demo/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /live demo/i });
  await dialog.getByRole('tab', { name: 'AG-UI' }).click();
  await expect(dialog.getByText('ag-ui.threadplane.ai')).toBeVisible();
});
```

- [ ] **Step 3: Run the spec**

Run: `npx nx e2e website` (or the project's e2e target), targeting `demo-modal.spec.ts`.
Expected: both tests PASS. (If the harness needs a running dev server/webServer config, follow the pattern from `primitives.spec.ts`.)

- [ ] **Step 4: Commit**

```bash
git add apps/website/e2e/demo-modal.spec.ts
git commit -m "test(website): e2e for the homepage demo modal"
```

---

## Final verification
- [ ] `npx nx lint website` — PASS.
- [ ] Manual: launch opens the modal at near-viewport 16:10; ×/Esc/backdrop close; focus returns; tab-switch swaps runtime; mobile (<640px) is a full-screen sheet; reduced-motion skips the scale.
- [ ] Finish via superpowers:finishing-a-development-branch (PR; the CI `website` job — lint + build + e2e — is the green gate).
