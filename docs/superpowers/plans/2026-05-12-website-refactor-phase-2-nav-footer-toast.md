# Website refactor — Phase 2: Nav + Footer + AnnouncementToast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the three site-wide shared components (`Nav`, `Footer`, `AnnouncementToast`) to the new Statusbrew-inspired aesthetic — white surfaces, clean borders, real shadows — using the Phase 1 primitives and tokens. Remove glassmorphism and `framer-motion` from this layer.

**Architecture:**
- Drop `backdrop-filter` glass treatment site-wide on the shell. Switch to opaque/white backgrounds, hairline borders, and the new `shadow.*` tokens.
- Replace `framer-motion` imports in Footer + AnnouncementToast with native CSS transitions / `IntersectionObserver`. (framer-motion stays in landing-page components for now — Phase 4 deals with those.)
- Reuse Phase 1 primitives: `Container`, `LogoMark`, `Button`, `Eyebrow`, `Pill`.
- The Nav has a deep mobile menu with docs library/section navigation — preserve all that functionality exactly. Only restyle.
- Sticky nav gains a `border-bottom` on scroll instead of glass blur.

**Tech Stack:** TypeScript, Next.js 16, React 19, `@ngaf/design-tokens` (Phase 1 additions), `apps/website/src/components/ui/*` primitives.

**Out of scope:**
- Any change to landing-page components (HeroTwoCol, PositioningStrip, etc.)
- Docs page layout
- Removing the old `glass` / `gradient` / `glow` tokens (Phase 6)

---

## File Structure

**Modified:**
```
apps/website/src/components/shared/
├── Nav.tsx                  (refactor — drop glass, use new primitives)
├── Footer.tsx               (refactor — drop glass + framer-motion)
└── AnnouncementToast.tsx    (refactor — drop glass + framer-motion)
```

**No new files.**

---

## Task 1: Refactor `Nav`

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`

### Goals

- Remove the glass shell (`tokens.glass.*`, `backdropFilter`).
- White background, becomes sticky with `shadow-sm` + `border-bottom` after page scrolls past ~8px.
- Use `LogoMark` for the brand mark.
- Desktop "Get Started" CTA becomes a `Button variant="primary"`.
- Mobile overlay drops glass — solid white with `shadow-lg`.
- Preserve all existing analytics tracking calls verbatim.
- Preserve mobile docs library/section accordion behavior.
- Keep the existing `'use client'` directive (uses `useState`/`useEffect`/`usePathname`).

### Steps

- [ ] **Step 1: Read the current Nav.tsx** to confirm current behavior

Run: `cat apps/website/src/components/shared/Nav.tsx | wc -l`
Expected: ~347 lines. This is a complex client component — read it carefully before editing.

- [ ] **Step 2: Replace imports and top-of-file boilerplate**

Change the imports block at the top of `Nav.tsx`:

```typescript
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tokens } from '@ngaf/design-tokens';
import { docsConfig } from '../../lib/docs-config';
import { trackCtaClick, trackExternalLinkClick } from '../../lib/analytics/client';
import { LogoMark } from '../ui/LogoMark';
import { Button } from '../ui/Button';
```

Keep `GitHubIcon`, `MenuIcon`, `CloseIcon` helper functions unchanged.

- [ ] **Step 3: Replace the desktop nav shell**

Replace the outer `<nav>` element style (currently the glass block at lines ~102-179). The new shell:

```tsx
<nav
  className="fixed top-0 left-0 right-0 z-50"
  style={{
    background: tokens.surfaces.surface,
    borderBottom: `1px solid ${tokens.surfaces.border}`,
    boxShadow: tokens.shadows.sm,
  }}
>
```

Drop all `backdrop-filter`, `WebkitBackdropFilter`, `tokens.glass.*` references in this element.

- [ ] **Step 4: Replace the brand link with `LogoMark`**

In the top bar, replace the `<Link href="/" …>Angular Agent Framework</Link>` brand with:

```tsx
<Link href="/" style={{ textDecoration: 'none' }}>
  <LogoMark size="md" />
</Link>
```

- [ ] **Step 5: Restyle desktop link hover with token-based color**

Each desktop link's inline `style` should switch from `tokens.colors.textSecondary`/`tokens.colors.accent` hover (which is already token-based — keep it). Just remove any references to glass values. The hover handlers stay as-is.

- [ ] **Step 6: Replace the "Get Started" Link with `Button`**

The current "Get Started" link uses an inline button-ish style with `tokens.colors.accent`/`tokens.glow.button`. Replace with:

```tsx
<Button
  variant="primary"
  size="md"
  href="/pilot-to-prod#whitepaper-gate"
  onClick={() => trackCtaClick({
    surface: 'nav',
    destination_url: '/pilot-to-prod#whitepaper-gate',
    cta_id: 'nav_get_started',
    cta_text: 'Get Started',
  })}
>
  Get Started
</Button>
```

Note: `Button` renders as `<a>` when `href` is provided. Drop the `tokens.glow.button` hover (it was a Phase 6 token).

- [ ] **Step 7: Refactor the mobile overlay shell**

The mobile overlay (`<div className="md:hidden fixed left-0 right-0 bottom-0"…>`) currently uses `rgba(255,255,255,0.98)` + `backdropFilter` glass. Replace its `style` with:

```tsx
style={{
  top: 57,
  zIndex: 9999,
  background: tokens.surfaces.surface,
  borderTop: `1px solid ${tokens.surfaces.border}`,
  boxShadow: tokens.shadows.lg,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}}
```

- [ ] **Step 8: Restyle mobile "Get Started" button**

The mobile menu's "Get Started" link at the bottom (the green-styled inline `<Link>` with `tokens.colors.accent` background) should also become a `Button`:

```tsx
<Button
  variant="primary"
  size="lg"
  href="/pilot-to-prod#whitepaper-gate"
  onClick={() => {
    trackCtaClick({
      surface: 'mobile_nav',
      destination_url: '/pilot-to-prod#whitepaper-gate',
      cta_id: 'mobile_nav_get_started',
      cta_text: 'Get Started',
    });
    setOpen(false);
  }}
  style={{ width: '100%', justifyContent: 'center' }}
>
  Get Started
</Button>
```

- [ ] **Step 9: Verify no remaining `tokens.glass.*` or `tokens.glow.*` references**

Run: `grep -n "tokens.glass\|tokens.glow" apps/website/src/components/shared/Nav.tsx`
Expected: zero matches. If any remain, replace with `tokens.surfaces.*` or `tokens.shadows.*` equivalents.

- [ ] **Step 10: Smoke-test in the dev server**

Run: `pnpm nx serve website` in background (or `npx nx run website:serve` — check `apps/website/project.json` for exact target).
Open: `http://localhost:3000/`
Expected: nav renders as a white bar with subtle bottom border. Logo + links + "Get Started" button visible. Hover changes link color to accent blue. Open mobile menu (resize to ≤768px) — overlay slides down, all links work, "Get Started" button at bottom.

Tear the server down after.

- [ ] **Step 11: Run e2e**

Run: `pnpm nx e2e website`
Expected: all 23 tests pass (10 primitives + 13 site). The existing nav tests (`nav has pricing link`, `mobile viewport renders nav`) still cover this refactor's surface.

- [ ] **Step 12: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "refactor(website): Nav uses new primitives, drops glassmorphism"
```

---

## Task 2: Refactor `Footer`

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

### Goals

- Drop `tokens.glass.*` shell, drop `framer-motion` import + animations.
- White background, top hairline border, no backdrop-filter.
- Use `LogoMark` for the brand mark.
- Newsletter subscribe button becomes a `Button variant="primary" size="md"`.
- Column heading labels use the `Eyebrow` primitive.
- Keep all link tracking, the newsletter form's API call, and the column structure.
- Replace the in-view fade animation with a simple opacity transition triggered by `IntersectionObserver` (or just drop the animation — footer is below the fold and the entrance flourish isn't load-bearing).

### Steps

- [ ] **Step 1: Read the current Footer.tsx**

Run: `cat apps/website/src/components/shared/Footer.tsx | wc -l`
Expected: ~309 lines.

- [ ] **Step 2: Replace imports — drop framer-motion**

New imports at top:

```typescript
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackCtaClick, trackExternalLinkClick } from '../../lib/analytics/client';
import { LogoMark } from '../ui/LogoMark';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';
```

The `<motion.div initial whileInView … >` wrapper becomes a plain `<div className="max-w-6xl mx-auto">`. Remove `framer-motion` from this file entirely.

- [ ] **Step 3: Refactor the footer shell**

Replace the `<footer …>` element's style:

```tsx
<footer
  className="px-6 md:px-8 py-16 mt-24"
  style={{
    background: tokens.surfaces.surface,
    borderTop: `1px solid ${tokens.surfaces.border}`,
  }}
>
```

Drop all `tokens.glass.*` references in the outer element.

- [ ] **Step 4: Replace brand block with `LogoMark`**

The brand line currently uses an inline `<p>` for the wordmark. Replace with:

```tsx
<div className="mb-2">
  <LogoMark size="md" />
</div>
<p className="text-sm mb-4" style={{ color: tokens.colors.textMuted, maxWidth: '36ch', lineHeight: 1.6 }}>
  The enterprise Angular agent framework for LangChain. Signal-native streaming built for production Angular 20+.
</p>
```

- [ ] **Step 5: Refactor the newsletter form input + button**

The input's inline style currently uses `tokens.glass.border` and `rgba(255,255,255,0.7)`. Replace with token-based surface styling:

```tsx
<input
  id="footer-email"
  type="email"
  placeholder="Email address"
  value={email}
  onChange={e => setEmail(e.target.value)}
  required
  disabled={state === 'submitting'}
  className="text-sm rounded-lg px-3 py-2 flex-1"
  style={{
    background: tokens.surfaces.surface,
    border: `1px solid ${tokens.surfaces.border}`,
    color: tokens.colors.textPrimary,
    outline: 'none',
  }}
/>
```

Replace the Subscribe `<button>` with `<Button>`:

```tsx
<Button
  type="submit"
  variant="primary"
  size="md"
  disabled={state === 'submitting' || !email}
>
  {state === 'submitting' ? '...' : 'Subscribe'}
</Button>
```

Note: `Button` accepts native button attributes when `href` is omitted (the discriminated union routes correctly).

- [ ] **Step 6: Replace column heading `<span>`s with `Eyebrow`**

Each column has a heading line like:

```tsx
<span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: tokens.colors.accent }}>Product</span>
```

Replace each with:

```tsx
<Eyebrow tone="accent" style={{ marginBottom: 4 }}>Product</Eyebrow>
```

(Apply to all four columns: Product, Libraries, Solutions, Resources.)

- [ ] **Step 7: Fix the bottom-bar border**

The bottom-bar `<div>` currently has `borderTop: 1px solid ${tokens.glass.border}`. Replace with `tokens.surfaces.border`.

- [ ] **Step 8: Verify no remaining `tokens.glass.*` or framer-motion references**

Run: `grep -n "tokens.glass\|framer-motion\|motion\\." apps/website/src/components/shared/Footer.tsx`
Expected: zero matches.

- [ ] **Step 9: Run e2e**

Run: `pnpm nx e2e website`
Expected: 23 tests pass. (Existing tests don't directly assert the footer, but they would catch render-blowups.)

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "refactor(website): Footer uses new primitives, drops glass + framer-motion"
```

---

## Task 3: Refactor `AnnouncementToast`

**Files:**
- Modify: `apps/website/src/components/shared/AnnouncementToast.tsx`

### Goals

- Drop `tokens.glass.*` shell, drop `framer-motion` import + `AnimatePresence`/`motion.div` wrapper.
- White surface with `shadow.lg` for the toast card.
- Replace spring-in animation with a simple CSS opacity + translate transition (controlled via a `mounted` state).
- "Get the Guide" + "Send me the guide" buttons become `Button variant="primary"`.
- "Not now" / "or download directly" / dismiss `×` keep their inline-text styling but switch any `tokens.glass.border` to `tokens.surfaces.border`.
- Preserve all analytics tracking calls.

### Steps

- [ ] **Step 1: Read current AnnouncementToast.tsx**

Run: `cat apps/website/src/components/shared/AnnouncementToast.tsx | wc -l`
Expected: ~301 lines.

- [ ] **Step 2: Replace imports — drop framer-motion**

New imports at top:

```typescript
'use client';
import { useState, useEffect } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';
import { Button } from '../ui/Button';
```

- [ ] **Step 3: Replace `AnimatePresence` + `motion.div` with a CSS transition wrapper**

Inside the component, add a `useEffect` that flips a `mounted` ref shortly after `visible` becomes true so the entrance animation runs.

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  if (visible) {
    // next-tick to allow the element to mount in its initial state, then animate
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }
  setMounted(false);
  return undefined;
}, [visible]);
```

The render becomes:

```tsx
if (!visible) return null;
return (
  <div
    role="alert"
    aria-live="polite"
    style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 100,
      maxWidth: 360,
      width: 'calc(100vw - 48px)',
      background: tokens.surfaces.surface,
      border: `1px solid ${tokens.surfaces.border}`,
      boxShadow: tokens.shadows.lg,
      borderRadius: tokens.radius.lg,
      padding: '20px 24px',
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 200ms ease, transform 240ms ease',
    }}
  >
    {/* …existing children unchanged… */}
  </div>
);
```

Remove the outer `<AnimatePresence>…</AnimatePresence>` and `<motion.div>` wrappers entirely.

Add a `@media (prefers-reduced-motion: reduce)` clause if needed — but since we apply transition inline and use `transform/opacity`, the browser respects the reduced-motion preference automatically when the user opts out (it'll still snap to mounted=true).

- [ ] **Step 4: Replace the two CTA `<button>`s with `Button`**

The "↓ Get the Guide" button (step `'cta'`) becomes:

```tsx
<Button
  variant="primary"
  size="md"
  onClick={() => {
    track(analyticsEvents.marketingCtaClick, {
      surface: 'toast',
      source_section: 'announcement-toast',
      cta_id: 'toast_get_guide',
    });
    setStep('form');
  }}
>
  ↓ Get the Guide
</Button>
```

The "↓ Send me the guide" submit button (step `'form'`) becomes:

```tsx
<Button
  type="submit"
  variant="primary"
  size="md"
  disabled={submitting || !email}
>
  {submitting ? 'Sending...' : '↓ Send me the guide'}
</Button>
```

Drop the inline mono-uppercase styling on these — `Button` styles them appropriately for the new design system.

- [ ] **Step 5: Restyle the email input**

The input currently uses `tokens.glass.border`. Replace:

```tsx
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: tokens.surfaces.surface,
  border: `1px solid ${tokens.surfaces.border}`,
  borderRadius: tokens.radius.md,
  padding: '8px 12px',
  fontSize: '0.82rem',
  color: tokens.colors.textPrimary,
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
};
```

Update the input's focus/blur handlers to switch to/from `tokens.colors.accent` border (which they already do). Replace `tokens.glass.border` with `tokens.surfaces.border` in the blur handler.

- [ ] **Step 6: Verify no remaining `tokens.glass.*`, framer-motion, or `AnimatePresence` references**

Run: `grep -n "tokens.glass\|framer-motion\|AnimatePresence\|motion\\." apps/website/src/components/shared/AnnouncementToast.tsx`
Expected: zero matches.

- [ ] **Step 7: Smoke-test the toast**

In the dev server, open the homepage. The toast appears after 30 seconds (unless dismissed). For testing speed, in browser devtools console run:

```js
localStorage.removeItem('dismissed-announcement-2026-04-07');
```

Then reload. After 30 seconds, the toast should slide in (opacity 0→1, translateY 12px→0px). Click "Not now" → dismisses. Click "Get the Guide" → form appears. Submit → "Check your inbox…" success message.

- [ ] **Step 8: Run e2e**

Run: `pnpm nx e2e website`
Expected: 23 tests pass. The toast isn't directly asserted, but render-time regressions would surface.

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/components/shared/AnnouncementToast.tsx
git commit -m "refactor(website): AnnouncementToast uses new primitives, drops glass + framer-motion"
```

---

## Task 4: Final verification

**Files:** none

- [ ] **Step 1: Grep for residual glass usage in shared components**

Run:
```bash
grep -rn "tokens.glass\|backdropFilter\|backdrop-filter\|framer-motion" apps/website/src/components/shared/
```

Expected: zero matches. If any remain, fix and re-commit. (Acceptable: `--ds-glass-*` CSS custom properties in `tokens.css` of the design-tokens lib are NOT in shared/ — those stay until Phase 6.)

- [ ] **Step 2: Full e2e**

Run: `pnpm nx e2e website`
Expected: all 23 tests pass.

- [ ] **Step 3: Manual visual smoke** (optional but recommended)

Start the dev server. Walk through `/`, `/docs/agent/getting-started/introduction`, `/pricing`, `/pilot-to-prod`. Confirm:
- Nav is white with subtle bottom border, no glass blur
- Footer is white with top hairline, no glass blur
- Toast slides in cleanly without framer-motion
- All links work
- Mobile menu opens/closes correctly with the new white sheet

If anything looks broken, fix it before declaring the phase done.

---

## Summary

After this plan executes:
- 3 commits modifying the 3 site-wide shared components.
- All glass treatment removed from the site shell.
- `framer-motion` no longer imported by Footer or AnnouncementToast (it still lives in `package.json` because landing-page components still use it — final removal is Phase 6).
- All 23 e2e tests still passing.
- Visible site-wide change: cleaner, modern Statusbrew-shaped chrome around every page.

Next phase (separate plan): Phase 3 — capture screenshots for the homepage refactor (parallelizable with Phase 4).
