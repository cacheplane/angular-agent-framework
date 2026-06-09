# AG-UI Demo Discoverability + Docs Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AG-UI live demo (`ag-ui.threadplane.ai`) a first-class peer to the LangGraph demo across the marketing site, rebuild the homepage demo into a tabbed video-first showcase, and close the AG-UI docs API-reference + custom-events gaps.

**Architecture:** A single `DEMOS` source of truth feeds a reusable `DemoCtaPair` (two parallel buttons) used by FinalCTA + a new tabbed, video-first `DemoShowcase` homepage section; the global navbar's single "Demo" link becomes a dropdown; the docs config gains an optional per-library `demoUrl` rendered contextually in the AG-UI docs nav; and AG-UI gains 4 API-reference mdx pages + a custom-events guide.

**Tech Stack:** Next.js (App Router) + React (client components, inline styles + `@threadplane/design-tokens`), MDX docs (no frontmatter; `# H1` + `<Callout>`), Nx (`nx build website`, `nx lint website`, `nx e2e website-e2e`), Playwright e2e.

**Reference spec:** `docs/superpowers/specs/2026-06-07-ag-ui-docs-demo-link-design.md`

**Verification note:** The website has no component unit-test runner; verification per task is `nx lint website` + `nx build website` (both must pass), plus targeted Playwright/visual checks where called out. This is a presentational/docs effort — there is no red-green unit TDD. Commit after each task.

**Constraint:** New content authored in this effort must NOT introduce any CopilotKit mention/reference. (The pre-existing ecosystem mention in `introduction.mdx` is untouched.)

**Working dir:** worktree `.claude/worktrees/ag-ui-docs-demo-link` (branch `worktree-ag-ui-docs-demo-link`), off latest `main`.

---

## File structure

**New files:**
- `apps/website/src/lib/demos.ts` — `DemoTarget` type + `DEMOS` constant (source of truth).
- `apps/website/src/components/landing/DemoCtaPair.tsx` — two parallel demo buttons.
- `apps/website/src/components/landing/DemoShowcase.tsx` — tabbed, video-first homepage demo section.
- `apps/website/content/docs/ag-ui/api/{provide-agent,inject-agent,to-agent,fake-agent}.mdx` — API reference pages.
- `apps/website/content/docs/ag-ui/guides/custom-events.mdx` — custom-events guide.
- `apps/website/public/demo/` — video + poster assets (Task 11, follow-on).

**Modified files:**
- `apps/website/src/components/landing/FinalCTA.tsx`, `apps/website/src/components/shared/Footer.tsx`, `apps/website/src/components/shared/Nav.tsx`, `apps/website/src/app/page.tsx`, `apps/website/src/lib/docs-config.ts`, `apps/website/src/components/docs/DocsSidebar.tsx`, `apps/website/content/docs/ag-ui/getting-started/{introduction,quickstart}.mdx`, `apps/website/content/docs/ag-ui/guides/citations.mdx`.

**Removed:** `apps/website/src/components/landing/LiveDemoFrame.tsx` (Task 6, after confirming `page.tsx` is the sole importer).

**PR boundaries (recommended):** PR-1 = Tasks 1–6 (demo CTAs + homepage). PR-2 = Tasks 7–10 (AG-UI docs). PR-3 = Task 11 (video assets, follow-on; homepage already ships with posters).

---

## Task 1: `DEMOS` source of truth

**Files:**
- Create: `apps/website/src/lib/demos.ts`

- [ ] **Step 1: Create the constant**

```ts
// apps/website/src/lib/demos.ts
export interface DemoTarget {
  /** Stable key; analytics cta_id suffix uses this (hyphens → underscores). */
  key: 'langgraph' | 'ag-ui';
  /** Label without trailing arrow — callers add their own. */
  label: string;
  href: string;
}

export const DEMOS: readonly DemoTarget[] = [
  { key: 'langgraph', label: 'LangGraph demo', href: 'https://demo.threadplane.ai' },
  { key: 'ag-ui', label: 'AG-UI demo', href: 'https://ag-ui.threadplane.ai' },
];

/** `ag-ui` → `ag_ui` for analytics ids. */
export const demoCtaSuffix = (key: DemoTarget['key']): string => key.replace(/-/g, '_');
```

- [ ] **Step 2: Verify it compiles**

Run: `npx nx lint website`
Expected: PASS (no new lint errors).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/demos.ts
git commit -m "feat(website): add DEMOS source of truth for demo CTAs"
```

---

## Task 2: `DemoCtaPair` component

**Files:**
- Create: `apps/website/src/components/landing/DemoCtaPair.tsx`

Uses the existing `Button` (`variant: 'primary'|'secondary'|'ghost'`, `size: 'md'|'lg'`, `href`, anchor props) and the analytics client (`trackExternalLinkClick`).

- [ ] **Step 1: Create the component**

```tsx
// apps/website/src/components/landing/DemoCtaPair.tsx
'use client';
import { Button } from '../ui/Button';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';
import { trackExternalLinkClick } from '../../lib/analytics/client';

interface Props {
  /** Analytics surface prefix, e.g. 'final_cta', 'home_demo'. */
  surface: string;
  size?: 'md' | 'lg';
}

/** Renders the LangGraph + AG-UI demos as two parallel CTA buttons. */
export function DemoCtaPair({ surface, size = 'lg' }: Props) {
  return (
    <>
      {DEMOS.map((demo, i) => (
        <Button
          key={demo.key}
          variant={i === 0 ? 'primary' : 'secondary'}
          size={size}
          href={demo.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackExternalLinkClick(demo.href, {
              surface,
              cta_id: `${surface}_demo_${demoCtaSuffix(demo.key)}`,
              cta_text: demo.label,
            })
          }
        >
          {demo.label} →
        </Button>
      ))}
    </>
  );
}
```

> Note: confirm `trackExternalLinkClick`'s signature/import path against an existing caller (e.g. `Nav.tsx` imports it from `../../lib/analytics/client`). If its options type rejects a free-form `surface` string, pass the `surface` value the existing callers use and keep `cta_id`/`cta_text` identical to the pattern there.

- [ ] **Step 2: Verify**

Run: `npx nx lint website`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/DemoCtaPair.tsx
git commit -m "feat(website): DemoCtaPair — parallel LangGraph + AG-UI demo buttons"
```

---

## Task 3: FinalCTA uses the demo pair

**Files:**
- Modify: `apps/website/src/components/landing/FinalCTA.tsx`

Goal: default closer renders the two demo buttons via `DemoCtaPair` AND keeps the cockpit ghost secondary. Pages that pass explicit `primary` keep current behavior.

- [ ] **Step 1: Import the pair**

Add at top of `FinalCTA.tsx`:

```tsx
import { DemoCtaPair } from './DemoCtaPair';
```

- [ ] **Step 2: Replace the primary button render with the pair (default path)**

Change the props default so `primary` defaults to `null` (meaning "use the demo pair"), keeping the override path. Replace the button row (currently the `primary` `<Button>` + `secondary` `<Button>`) with:

```tsx
// props: change `primary = DEFAULT_PRIMARY` → `primary = null`
// and update the JSDoc for `primary` to: "Override CTA. When omitted, renders the LangGraph + AG-UI demo pair."
```

Button row becomes:

```tsx
<div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
  {primary ? (
    <Button
      variant="primary"
      size="lg"
      href={primary.href}
      {...((primary as { external?: boolean }).external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {primary.label}
    </Button>
  ) : (
    <DemoCtaPair surface="final_cta" size="lg" />
  )}
  {secondary ? (
    <Button
      variant="ghost"
      size="lg"
      href={secondary.href}
      {...(secondary.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {secondary.label}
    </Button>
  ) : null}
</div>
```

Delete the now-unused `DEFAULT_PRIMARY` const (keep `DEFAULT_SECONDARY`). Update the `primary` prop type/default to `{ label: string; href: string; external?: boolean } | null` defaulting to `null`.

- [ ] **Step 3: Verify lint + build**

Run: `npx nx lint website && npx nx build website`
Expected: PASS. (Build compiles all 9 pages using FinalCTA.)

- [ ] **Step 4: Check no page broke its FinalCTA contract**

Run: `grep -rn "FinalCTA" apps/website/src/app | grep -v "import"`
Expected: pages either use `<FinalCTA />` (now gets the pair) or pass explicit `primary`/`secondary`. Confirm none relied on the removed `DEFAULT_PRIMARY` by name.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/FinalCTA.tsx
git commit -m "feat(website): FinalCTA renders paired demo CTAs by default"
```

---

## Task 4: Footer — two demo links

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx` (the single `https://demo.threadplane.ai` anchor around line 180)

- [ ] **Step 1: Replace the single Demo link with two**

Import at top: `import { DEMOS, demoCtaSuffix } from '../../lib/demos';`

Replace the single `<a href="https://demo.threadplane.ai" … >Demo</a>` block with a map over `DEMOS`, preserving the existing anchor styling, hover handlers, and `trackExternalLinkClick`:

```tsx
{DEMOS.map((demo) => (
  <a key={demo.key} href={demo.href} className="transition-colors" style={{ color: tokens.colors.textSecondary }}
    onClick={() => trackExternalLinkClick(demo.href, {
      surface: 'footer',
      cta_id: `footer_demo_${demoCtaSuffix(demo.key)}`,
      cta_text: demo.label,
    })}
    onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
    onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
    {demo.label}
  </a>
))}
```

- [ ] **Step 2: Verify**

Run: `npx nx lint website`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): footer lists LangGraph + AG-UI demos"
```

---

## Task 5: Navbar — Demo dropdown (desktop) + two entries (mobile)

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`

The `links` array currently has `{ label: 'Demo', href: 'https://demo.threadplane.ai', external: true }`. Replace it with a dropdown on desktop and two list entries on mobile.

- [ ] **Step 1: Remove the single Demo entry from `links`**

Delete the `{ label: 'Demo', … }` object from the `links` array (line ~15). Add import: `import { DEMOS, demoCtaSuffix } from '../../lib/demos';`

- [ ] **Step 2: Add a `DemoDropdown` (desktop) sub-component**

Add inside `Nav.tsx` (above `export function Nav`), reusing the click-outside pattern from `DocsSidebar.tsx`'s `LibraryDropdown`:

```tsx
function DemoDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-mono transition-colors"
        style={{ color: tokens.colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
        onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}
        aria-haspopup="true" aria-expanded={open}
      >
        Demo <span style={{ fontSize: 10, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>&#9662;</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, minWidth: 180, background: tokens.surfaces.surface, border: `1px solid ${tokens.surfaces.border}`, borderRadius: 8, boxShadow: tokens.shadows.md, overflow: 'hidden', zIndex: 60 }}>
          {DEMOS.map((demo) => (
            <a key={demo.key} href={demo.href} target="_blank" rel="noopener noreferrer"
              onClick={() => { setOpen(false); trackExternalLinkClick(demo.href, { surface: 'nav', cta_id: `nav_demo_${demoCtaSuffix(demo.key)}`, cta_text: demo.label }); }}
              className="text-sm font-mono"
              style={{ display: 'block', padding: '10px 14px', color: tokens.colors.textSecondary, textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              {demo.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render `DemoDropdown` in the desktop links row**

In the desktop links `<div className="hidden lg:flex …">`, after the `links.map(...)` output and before the GitHub icon, insert `<DemoDropdown />`. (`useState`, `useRef`, `useEffect` are already imported in `Nav.tsx`.)

- [ ] **Step 4: Add the two demo rows to the mobile site-links list**

In the mobile "Site content" block (where `links.map(...)` renders rows), after that map insert:

```tsx
{DEMOS.map((demo) => (
  <a key={demo.key} href={demo.href} target="_blank" rel="noopener noreferrer"
    onClick={() => { trackExternalLinkClick(demo.href, { surface: 'mobile_nav', cta_id: `mobile_nav_demo_${demoCtaSuffix(demo.key)}`, cta_text: demo.label }); setOpen(false); }}
    style={{ display: 'block', padding: '14px 14px', borderRadius: 8, fontSize: 16, lineHeight: '24px', minHeight: 48, color: tokens.colors.textSecondary, textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
    {demo.label}
  </a>
))}
```

- [ ] **Step 5: Verify lint + build**

Run: `npx nx lint website && npx nx build website`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "feat(website): navbar Demo dropdown (LangGraph + AG-UI)"
```

---

## Task 6: Homepage `DemoShowcase` (tabbed, video-first)

**Files:**
- Create: `apps/website/src/components/landing/DemoShowcase.tsx`
- Modify: `apps/website/src/app/page.tsx` (swap `<LiveDemoFrame />` at line ~115)
- Remove: `apps/website/src/components/landing/LiveDemoFrame.tsx`

Approved composition: eyebrow "See it running", headline "One chat UI. Two runtimes. Same code.", parity subhead, tabs (LangGraph default), large video-first frame with "Launch live demo ▶" overlay → swaps to live iframe, paired CTAs + cockpit ghost, caption. Degrades to poster image when a video asset is absent.

- [ ] **Step 1: Create the component**

```tsx
// apps/website/src/components/landing/DemoShowcase.tsx
'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Button } from '../ui/Button';
import { DemoCtaPair } from './DemoCtaPair';
import { DEMOS } from '../../lib/demos';

type TabKey = (typeof DEMOS)[number]['key'];

interface DemoMedia {
  key: TabKey;
  tabLabel: string;
  /** Faux URL shown in the frame chrome. */
  url: string;
  /** Looping video sources (mp4 + webm). */
  videoMp4: string;
  videoWebm: string;
  poster: string;
  href: string;
}

const MEDIA: DemoMedia[] = [
  { key: 'langgraph', tabLabel: 'LangGraph', url: 'demo.threadplane.ai', videoMp4: '/demo/langgraph-demo.mp4', videoWebm: '/demo/langgraph-demo.webm', poster: '/demo/langgraph-demo-poster.webp', href: DEMOS[0].href },
  { key: 'ag-ui', tabLabel: 'AG-UI', url: 'ag-ui.threadplane.ai', videoMp4: '/demo/ag-ui-demo.mp4', videoWebm: '/demo/ag-ui-demo.webm', poster: '/demo/ag-ui-demo-poster.webp', href: DEMOS[1].href },
];

export function DemoShowcase() {
  const [active, setActive] = useState<TabKey>('langgraph');
  const [launched, setLaunched] = useState<Set<TabKey>>(new Set());
  const media = MEDIA.find((m) => m.key === active)!;
  const isLaunched = launched.has(active);
  const launch = () => setLaunched((prev) => new Set(prev).add(active));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontFamily: tokens.typography.fontMono, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.accent, margin: 0 }}>See it running</p>
      <h2 style={{ fontFamily: tokens.typography.h2.family, fontSize: tokens.typography.h2.size, lineHeight: tokens.typography.h2.line, fontWeight: 700, color: tokens.colors.textPrimary, margin: '10px 0 8px', letterSpacing: '-0.015em' }}>
        One chat UI. Two runtimes. Same code.
      </h2>
      <p style={{ fontFamily: tokens.typography.bodyLg.family, fontSize: tokens.typography.bodyLg.size, lineHeight: tokens.typography.bodyLg.line, color: tokens.colors.textSecondary, maxWidth: 560, margin: '0 auto 20px' }}>
        The identical Threadplane chat surface, running live against a LangGraph backend and an AG-UI backend. Switch tabs to compare — the front end never changes.
      </p>

      {/* Tabs */}
      <div role="tablist" aria-label="Demo backend" style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {MEDIA.map((m) => {
          const on = m.key === active;
          return (
            <button key={m.key} role="tab" aria-selected={on} onClick={() => setActive(m.key)}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: on ? tokens.colors.accent : tokens.colors.accentSurface, color: on ? tokens.colors.textInverted : tokens.colors.textMuted }}>
              {m.tabLabel}
            </button>
          );
        })}
      </div>

      {/* Frame */}
      <BrowserFrame url={media.url} elevation="lg">
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#15161f' }}>
          {isLaunched ? (
            <iframe src={media.href} title={`${media.tabLabel} live demo`} loading="lazy"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          ) : (
            <>
              <video key={media.key} autoPlay muted loop playsInline poster={media.poster}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}>
                <source src={media.videoWebm} type="video/webm" />
                <source src={media.videoMp4} type="video/mp4" />
              </video>
              <button onClick={launch} aria-label={`Launch ${media.tabLabel} live demo`}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'linear-gradient(180deg, rgba(16,18,32,.15), rgba(16,18,32,.45))', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15161f', fontSize: 22 }}>▶</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '8px 14px', borderRadius: 8 }}>Launch live demo</span>
              </button>
            </>
          )}
        </div>
      </BrowserFrame>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <DemoCtaPair surface="home_demo" size="lg" />
        <Button variant="ghost" size="lg" href="https://cockpit.threadplane.ai" target="_blank" rel="noopener noreferrer">
          See each feature in action →
        </Button>
      </div>
      <p style={{ fontFamily: tokens.typography.caption.family, fontSize: tokens.typography.caption.size, color: tokens.colors.textMuted, margin: '14px 0 0' }}>
        Video loops instantly · click Launch to open the live, interactive demo · MIT · no signup
      </p>
    </div>
  );
}
```

> The `<video>` falls back to its `poster` when no source loads, so the section renders before Task 11's assets exist. Confirm `tokens.typography.caption` / `tokens.colors.textInverted` / `tokens.colors.accentSurface` exist (they are used elsewhere in `FinalCTA.tsx` / `Nav.tsx`); if a token name differs, match the one those files use.

- [ ] **Step 2: Swap on the homepage**

In `apps/website/src/app/page.tsx`:

1. Replace the import `import { LiveDemoFrame } from '../components/landing/LiveDemoFrame';` with `import { DemoShowcase } from '../components/landing/DemoShowcase';`. Confirm `Section`, `Container`, and `BrowserFrame` are imported (add any missing — they are used elsewhere on the page / in components).

2. The demo currently lives as `visual={<LiveDemoFrame />}` on the "production patterns" `FeatureBlock` (eyebrow `Ship`, headline "Patterns built for production, not demos."). That block's copy must survive. Repoint **its** visual to the existing static canonical screenshot (already shipped, used in `Hero.tsx`) so the block stays intact without the live iframe:

```tsx
visual={
  <BrowserFrame url="demo.threadplane.ai" elevation="lg">
    <img
      src="/screenshots/canonical-demo-generative-ui.webp"
      alt="Threadplane chat rendering a live generative-UI dashboard"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      loading="lazy"
      decoding="async"
    />
  </BrowserFrame>
}
```

3. Add the interactive showcase as its **own full-width Section**, placed immediately after the hero block (before the first `FeatureBlock`):

```tsx
<Section surface="canvas">
  <Container>
    <DemoShowcase />
  </Container>
</Section>
```

`DemoShowcase` owns its own `<h2>` heading, so no `ariaLabelledBy` wiring is needed on this `Section`.

- [ ] **Step 3: Remove `LiveDemoFrame`**

Confirm sole importer, then delete:

```bash
grep -rn "LiveDemoFrame" apps/website/src
# expect: only the (now-removed) page.tsx import and the component file
git rm apps/website/src/components/landing/LiveDemoFrame.tsx
```

- [ ] **Step 4: Verify lint + build**

Run: `npx nx lint website && npx nx build website`
Expected: PASS. The homepage compiles; `DemoShowcase` renders with posters (videos 404 until Task 11 — acceptable, `<video>` shows poster).

- [ ] **Step 5: Visual check (dev server)**

Run: `npx nx serve website` (or the repo's dev command), open the homepage, confirm: tabs switch; the launch overlay appears; clicking Launch mounts the live iframe; CTAs link correctly. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/DemoShowcase.tsx apps/website/src/app/page.tsx
git rm apps/website/src/components/landing/LiveDemoFrame.tsx
git commit -m "feat(website): tabbed video-first DemoShowcase on homepage"
```

---

## Task 7: `DocsLibrary.demoUrl` + contextual docs demo link

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts` (interface + ag-ui entry)
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx` (desktop)
- Modify: `apps/website/src/components/shared/Nav.tsx` (mobile docs path)

- [ ] **Step 1: Extend the interface + set ag-ui `demoUrl`**

In `docs-config.ts`, add to `interface DocsLibrary` (after `description`):

```ts
  /** Optional external live-demo URL, surfaced contextually in docs nav. */
  demoUrl?: string;
  /** Optional label override for the demo link. Defaults to 'Live demo'. */
  demoLabel?: string;
```

On the `id: 'ag-ui'` library object, add: `demoUrl: 'https://ag-ui.threadplane.ai',` (e.g. right after its `description`).

- [ ] **Step 2: Render the link in the desktop sidebar**

In `DocsSidebar.tsx`, just below `<LibraryDropdown activeLibrary={activeLibrary} />`, add:

```tsx
{libConfig?.demoUrl && (
  <div className="px-4 mb-4">
    <a href={libConfig.demoUrl} target="_blank" rel="noopener noreferrer"
      className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
      style={{ background: tokens.colors.accentSurface, color: tokens.colors.accent, border: `1px solid ${tokens.surfaces.border}`, textDecoration: 'none', fontWeight: 600 }}>
      <span>{libConfig.demoLabel ?? 'Live demo'}</span>
      <span aria-hidden="true">↗</span>
    </a>
  </div>
)}
```

(`libConfig` is already in scope in `DocsSidebar`; `tokens` is imported.)

- [ ] **Step 3: Render the link in the mobile docs nav**

In `Nav.tsx`, inside the mobile docs block (`mobileTab === 'docs' && isDocsPage && currentLib`), above the `currentLib.sections.map(...)`, add:

```tsx
{currentLib.demoUrl && (
  <a href={currentLib.demoUrl} target="_blank" rel="noopener noreferrer"
    onClick={() => { trackExternalLinkClick(currentLib.demoUrl!, { surface: 'mobile_nav', cta_id: `mobile_nav_docs_demo_${currentLib.id}`, cta_text: currentLib.demoLabel ?? 'Live demo' }); setOpen(false); }}
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, minHeight: 44, color: tokens.colors.accent, background: tokens.colors.accentSurface, textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
    <span>{currentLib.demoLabel ?? 'Live demo'}</span><span aria-hidden="true">↗</span>
  </a>
)}
```

- [ ] **Step 4: Verify lint + build**

Run: `npx nx lint website && npx nx build website`
Expected: PASS.

- [ ] **Step 5: Visual check**

Dev server: AG-UI docs show "Live demo ↗" in the sidebar (desktop) and mobile docs tab; other libraries show none.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/docs-config.ts apps/website/src/components/docs/DocsSidebar.tsx apps/website/src/components/shared/Nav.tsx
git commit -m "feat(website): contextual AG-UI live-demo link in docs nav"
```

---

## Task 8: AG-UI content demo callouts

**Files:**
- Modify: `apps/website/content/docs/ag-ui/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/ag-ui/getting-started/quickstart.mdx`

Use the existing `<Callout type="tip" title="…">` mdx component (no import needed — provided by MdxRenderer). Do NOT add any CopilotKit reference.

- [ ] **Step 1: Add a demo callout to introduction.mdx**

After the existing intro `<Callout type="info" title="What is AG-UI?">…</Callout>` block (ends ~line 9), add:

```mdx
<Callout type="tip" title="See it live">
The [AG-UI demo](https://ag-ui.threadplane.ai) runs this exact chat surface against an AG-UI backend — streaming, tool calls, and generative UI included. Compare it side by side with the [LangGraph demo](https://demo.threadplane.ai).
</Callout>
```

- [ ] **Step 2: Add a demo callout to quickstart.mdx**

After the `<Callout type="info" title="Prerequisites">…</Callout>` block (~line 7), add:

```mdx
<Callout type="tip" title="Try it first">
Want to see the finished result before you build? Open the live [AG-UI demo](https://ag-ui.threadplane.ai).
</Callout>
```

- [ ] **Step 3: Verify build (mdx compiles, links resolve)**

Run: `npx nx build website`
Expected: PASS (no MDX parse errors, no broken-link failures).

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/ag-ui/getting-started/introduction.mdx apps/website/content/docs/ag-ui/getting-started/quickstart.mdx
git commit -m "docs(ag-ui): add live-demo callouts to introduction + quickstart"
```

---

## Task 9: AG-UI API reference pages + nav

**Files:**
- Create: `apps/website/content/docs/ag-ui/api/provide-agent.mdx`
- Create: `apps/website/content/docs/ag-ui/api/inject-agent.mdx`
- Create: `apps/website/content/docs/ag-ui/api/to-agent.mdx`
- Create: `apps/website/content/docs/ag-ui/api/fake-agent.mdx`
- Modify: `apps/website/src/lib/docs-config.ts` (add `API Reference` section to ag-ui)
- Modify: `apps/website/content/docs/ag-ui/guides/citations.mdx` (cross-link `bridgeCitationsState`)

Author prose mirroring `apps/website/content/docs/langgraph/api/*.mdx` voice (concise, `# symbolName()` H1, intro paragraph, a usage code block, sub-sections). Source the exact signatures from `libs/ag-ui/src/public-api.ts`. No CopilotKit references.

Required content per page (each begins with the H1 shown, then prose + a `ts` code block):

- [ ] **Step 1: `provide-agent.mdx`** — `# provideAgent()`. Cover: registers the singleton AG-UI agent config consumed by every `injectAgent()`; the `AgentConfig` fields (`url`, `agentId?`, `threadId?`, `headers?`, `telemetry?` — verify exact names against `public-api.ts`); accepts a config object or a factory `() => AgentConfig`; returns `Provider[]` for `ApplicationConfig.providers`. Include a `bootstrapApplication` usage snippet. Cross-link `injectAgent()`.

- [ ] **Step 2: `inject-agent.mdx`** — `# injectAgent()`. Cover: no-args; call in an injection context; returns the runtime-neutral `Agent` (note AG-UI returns an `AgUiAgent` which extends `Agent` with `customEvents: Signal<CustomStreamEvent[]>`); list the signal surface (`status`, `messages`, `toolCalls`, `state`, `interrupt`, `customEvents`, …) and actions (`submit`, `stop`, `regenerate`). Cross-link the [custom-events guide](/docs/ag-ui/guides/custom-events) and `provideAgent()`.

- [ ] **Step 3: `to-agent.mdx`** — `# toAgent()`. Cover: the lower-level adapter — `toAgent(source: AbstractAgent, options?: ToAgentOptions): AgUiAgent` — wraps a raw AG-UI `AbstractAgent` into the neutral contract; `ToAgentOptions` (`telemetry?`); document `CustomStreamEvent` (`{ name: string; data: unknown }`) here as the element type of `AgUiAgent.customEvents`. Note `provideAgent` is the DI-friendly wrapper most apps use; reach for `toAgent` when you construct the `AbstractAgent` yourself.

- [ ] **Step 4: `fake-agent.mdx`** — `# FakeAgent`. Cover: the in-process test double; `provideFakeAgent(config?: FakeAgentConfig)` provider + the `FakeAgent` class for direct use; the canned stream/config options (verify `FakeAgentConfig` fields incl. `reasoningTokens` against source). Cross-link the [Fake Agent guide](/docs/ag-ui/guides/fake-agent) and [Testing guide](/docs/ag-ui/guides/testing).

- [ ] **Step 5: Wire the nav section** — in `docs-config.ts`, in the `id: 'ag-ui'` library `sections`, after the `Reference` section add:

```ts
{
  title: 'API Reference',
  id: 'api',
  color: 'blue',
  pages: [
    { title: 'provideAgent()', slug: 'provide-agent', section: 'api' },
    { title: 'injectAgent()', slug: 'inject-agent', section: 'api' },
    { title: 'toAgent()', slug: 'to-agent', section: 'api' },
    { title: 'FakeAgent', slug: 'fake-agent', section: 'api' },
  ],
},
```

- [ ] **Step 6: Cross-link `bridgeCitationsState`** — in `guides/citations.mdx`, add a short note where citations state is discussed:

```mdx
The `bridgeCitationsState(thread, messages)` helper merges thread-level citation state onto the message list; import it from `@threadplane/ag-ui` when you assemble messages yourself.
```

- [ ] **Step 7: Verify build + nav**

Run: `npx nx build website`
Expected: PASS; the 4 pages compile and resolve at `/docs/ag-ui/api/<slug>`; sidebar shows the new `API Reference` section.

- [ ] **Step 8: Refresh generated API JSON (commit only if changed)**

Run: `npm run generate-api-docs`
Then: `git status --porcelain apps/website/content/docs/ag-ui/api/api-docs.json`
If changed, include it in the commit; otherwise leave it.

- [ ] **Step 9: Commit**

```bash
git add apps/website/content/docs/ag-ui/api apps/website/src/lib/docs-config.ts apps/website/content/docs/ag-ui/guides/citations.mdx
git commit -m "docs(ag-ui): API reference pages + nav section"
```

---

## Task 10: AG-UI custom-events guide

**Files:**
- Create: `apps/website/content/docs/ag-ui/guides/custom-events.mdx`
- Modify: `apps/website/src/lib/docs-config.ts` (add to ag-ui Guides section)

Author in AG-UI doc voice (no fabricated anecdotes, trimmed register, no CopilotKit reference).

- [ ] **Step 1: Write the guide**

`# Custom Events` H1. Required sections/content:
- Intro: AG-UI `CUSTOM` events (other than `on_interrupt`) accumulate into `AgUiAgent.customEvents` — a `Signal<CustomStreamEvent[]>` where `CustomStreamEvent = { name: string; data: unknown }`. The list resets on `RUN_STARTED`.
- "Where they come from": a LangGraph node calling `get_stream_writer()` and emitting with `stream_mode='custom'` becomes an AG-UI `CUSTOM` event becomes an entry in `customEvents()`. Include a small Python emit snippet and the matching wire shape.
- "Reading them in Angular": a worked snippet using `injectAgent()` and an `effect`/`computed` over `agent.customEvents()` to drive live/progressive a2ui surface updates during a run.
- "Relation to interrupts": `on_interrupt` is handled specially (surfaced via `agent.interrupt`), so it does NOT appear in `customEvents`. Cross-link the [Interrupts guide](/docs/ag-ui/guides/interrupts).
- Cross-links: [Architecture](/docs/ag-ui/concepts/architecture), [Event Mapping](/docs/ag-ui/reference/event-mapping) (the CUSTOM row), [injectAgent()](/docs/ag-ui/api/inject-agent).

- [ ] **Step 2: Add to nav**

In `docs-config.ts`, in the ag-ui `Guides` section `pages`, add after the `citations` entry:

```ts
{ title: 'Custom Events', slug: 'custom-events', section: 'guides' },
```

- [ ] **Step 3: Verify build**

Run: `npx nx build website`
Expected: PASS; guide resolves at `/docs/ag-ui/guides/custom-events`, cross-links valid, sidebar shows it.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/ag-ui/guides/custom-events.mdx apps/website/src/lib/docs-config.ts
git commit -m "docs(ag-ui): custom-events guide (live a2ui streaming)"
```

---

## Task 11: Demo video assets (follow-on)

**Files:**
- Create: `apps/website/public/demo/langgraph-demo.mp4`, `.webm`, `langgraph-demo-poster.webp`
- Create: `apps/website/public/demo/ag-ui-demo.mp4`, `.webm`, `ag-ui-demo-poster.webp`

This task produces the recorded clips `DemoShowcase` references. The homepage already ships (Task 6) with posters; this upgrades it. Can land as a separate PR.

- [ ] **Step 1: Record each demo** — capture a ~15–25s screen recording of a real run on each live demo (a representative prompt → streaming answer → an a2ui/generative-UI surface rendering). Use `demo.threadplane.ai` (LangGraph) and `ag-ui.threadplane.ai` (AG-UI). Trim to a clean loop.

- [ ] **Step 2: Encode small + extract poster** — produce H.264 mp4 + VP9 webm (target < 2–3 MB each, muted, ~1280×800), and a first-frame `.webp` poster. Example:

```bash
ffmpeg -i raw-langgraph.mov -vf "scale=1280:-2" -an -c:v libx264 -crf 30 -movflags +faststart apps/website/public/demo/langgraph-demo.mp4
ffmpeg -i raw-langgraph.mov -vf "scale=1280:-2" -an -c:v libvpx-vp9 -crf 36 -b:v 0 apps/website/public/demo/langgraph-demo.webm
ffmpeg -i raw-langgraph.mov -vframes 1 -vf "scale=1280:-2" apps/website/public/demo/langgraph-demo-poster.webp
# repeat for ag-ui-demo.*
```

- [ ] **Step 3: Verify** — filenames match the paths in `DemoShowcase.MEDIA`; `nx build website`; dev server confirms each tab plays its loop and the launch overlay still swaps to the live iframe.

- [ ] **Step 4: Commit**

```bash
git add apps/website/public/demo
git commit -m "feat(website): recorded demo videos for the homepage showcase"
```

---

## Final verification (after all tasks)

- [ ] `npx nx lint website` — PASS
- [ ] `npx nx build website` — PASS
- [ ] Manual: navbar Demo dropdown (desktop) + two mobile entries; footer two demo links; FinalCTA shows the pair + cockpit ghost on a sampled page; homepage `DemoShowcase` tabs/launch work; AG-UI docs sidebar shows the live-demo link + the new API Reference section + custom-events guide; other libraries unchanged.
- [ ] If a website e2e harness exists: add/confirm a Playwright assertion for (a) the navbar Demo dropdown and (b) the AG-UI sidebar demo link + API section. Otherwise note manual verification in the PR.
- [ ] Finish via superpowers:finishing-a-development-branch (PR split per the boundaries above).
