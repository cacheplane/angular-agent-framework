# Website refactor — Phase 8: Cockpit + final token purge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/cockpit/**` off glassmorphism to a Linear-style light app shell using the Phase 1 design tokens, then delete the legacy `glass`/`gradient`/`glow` namespaces from `@ngaf/design-tokens` and the orphaned glass-using components from `@ngaf/ui-react`.

**Architecture:** Three independently shippable commits. **Commit 8.1** extends `libs/ui-react/src/lib/css-vars.ts` with the Phase 1 token namespaces (prerequisite for cockpit to use them). **Commit 8.2** refactors cockpit's 7 glass-using files plus 2 token-tightening files. **Commit 8.3** deletes the legacy `glass.ts`/`gradients.ts`/`glow.ts` files in `@ngaf/design-tokens`, 9 orphaned `@ngaf/ui-react` components, and all remaining `glass`/`gradient`/`glow` references workspace-wide. After Phase 8 ships, every surface uses only Phase 1 token namespaces.

**Tech Stack:** TypeScript, React 19, Next.js 16 (cockpit), Tailwind v4, `@ngaf/design-tokens`, `@ngaf/ui-react`, vitest, Playwright.

**Out of scope:**
- Cockpit IA / feature changes
- Dark-mode token system
- Cockpit's `production-smoke.spec.ts` (gated; requires deployed environment)

---

## File Structure

**Modified (Commit 8.1):**
```
libs/ui-react/src/lib/css-vars.ts                                  [EXTEND with new namespaces]
libs/ui-react/src/lib/css-vars.spec.ts                             [NEW — assert new vars present]
```

**Modified (Commit 8.2):**
```
apps/cockpit/src/app/layout.tsx                                    [drop gradient body bg]
apps/cockpit/src/components/cockpit-shell.tsx                      [drop glass on content section]
apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx            [surface-tinted bg + border-strong divider]
apps/cockpit/src/components/sidebar/navigation-groups.tsx          [add active-rail affordance]
apps/cockpit/src/components/sidebar/language-picker.tsx            [drop glass on trigger + dropdown]
apps/cockpit/src/components/mobile-nav-overlay.tsx                 [drop glass; mirror desktop sidebar]
apps/cockpit/src/components/modes/mode-switcher.tsx                [flat pill, no glass shell]
apps/cockpit/src/components/code-mode/code-mode.tsx                [surface chrome on file container]
apps/cockpit/src/components/ui/tabs.tsx                            [swap accent-border → border for tab hairline]
```

**Deleted + Modified (Commit 8.3):**

Deletions:
```
libs/design-tokens/src/lib/glass.ts                                [DELETE]
libs/design-tokens/src/lib/gradients.ts                            [DELETE]
libs/design-tokens/src/lib/glow.ts                                 [DELETE]
libs/ui-react/src/lib/glass-panel.tsx                              [DELETE — orphan]
libs/ui-react/src/lib/glass-button.tsx                             [DELETE — orphan]
libs/ui-react/src/lib/card.tsx                                     [DELETE — orphan]
libs/ui-react/src/lib/code-group.tsx                               [DELETE — orphan]
libs/ui-react/src/lib/callout.tsx                                  [DELETE — orphan]
libs/ui-react/src/lib/steps.tsx                                    [DELETE — orphan]
libs/ui-react/src/lib/tabs.tsx                                     [DELETE — orphan]
libs/ui-react/src/lib/nav-link.tsx                                 [DELETE — orphan]
libs/ui-react/src/lib/components.spec.tsx                          [DELETE — tests deleted components]
```

Modifications:
```
libs/design-tokens/src/lib/tokens.ts                               [drop legacy imports/aggregator]
libs/design-tokens/src/lib/tokens.css                              [drop legacy CSS vars]
libs/design-tokens/src/lib/tokens.spec.ts                          [drop legacy assertions]
libs/design-tokens/src/index.ts                                    [drop legacy exports]
libs/design-tokens/package.json                                    [version 0.0.30 → 0.0.31]
libs/ui-react/src/lib/css-vars.ts                                  [drop legacy CSS vars]
libs/ui-react/src/lib/css-vars.spec.ts                             [drop legacy assertions]
libs/ui-react/src/index.ts                                         [trim to {cssVars, type CssVars, cn}]
apps/website/lib/design-tokens.ts                                  [drop legacy re-exports]
apps/website/src/app/global.css                                    [drop legacy :root vars]
```

---

## Commit 8.1 — `cssVars` prereq

### Task 1: Extend `cssVars` with Phase 1 token namespaces

**Files:**
- Modify: `libs/ui-react/src/lib/css-vars.ts`

The file currently imports `colors, glass, gradient, glow, typography` from `@ngaf/design-tokens` and turns them into a `--ds-*` CSS-var map. Phase 1 added new namespaces — `surfaces`, `shadows`, `radius`, `space` — plus extended `colors` (`accentHover`, `textInverted`) and the typography type scale. Extend `cssVars` to expose these. Do NOT remove existing legacy entries (that's commit 8.3).

- [ ] **Step 1: Read the existing file**

Run: `cat libs/ui-react/src/lib/css-vars.ts`
Expected: confirms current exports include only `colors/glass/gradient/glow/typography`.

- [ ] **Step 2: Replace the file**

Replace `libs/ui-react/src/lib/css-vars.ts` with:

```typescript
import {
  colors,
  glass,
  gradient,
  glow,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@ngaf/design-tokens';

/**
 * CSS custom properties derived from design tokens.
 * Apply to :root or a container element so Tailwind can reference them.
 */
export const cssVars = {
  // Colors
  '--ds-bg': colors.bg,
  '--ds-accent': colors.accent,
  '--ds-accent-hover': colors.accentHover,
  '--ds-accent-light': colors.accentLight,
  '--ds-accent-glow': colors.accentGlow,
  '--ds-accent-border': colors.accentBorder,
  '--ds-accent-border-hover': colors.accentBorderHover,
  '--ds-accent-surface': colors.accentSurface,
  '--ds-text-primary': colors.textPrimary,
  '--ds-text-secondary': colors.textSecondary,
  '--ds-text-muted': colors.textMuted,
  '--ds-text-inverted': colors.textInverted,
  '--ds-sidebar-bg': colors.sidebarBg,
  '--ds-angular-red': colors.angularRed,

  // Glass (legacy — removed in Phase 8.3)
  '--ds-glass-bg': glass.bg,
  '--ds-glass-bg-hover': glass.bgHover,
  '--ds-glass-blur': glass.blur,
  '--ds-glass-border': glass.border,
  '--ds-glass-shadow': glass.shadow,

  // Gradients (legacy — removed in Phase 8.3)
  '--ds-gradient-warm': gradient.warm,
  '--ds-gradient-cool': gradient.cool,
  '--ds-gradient-cool-light': gradient.coolLight,
  '--ds-gradient-bg-flow': gradient.bgFlow,

  // Glow (legacy — removed in Phase 8.3)
  '--ds-glow-hero': glow.hero,
  '--ds-glow-demo': glow.demo,
  '--ds-glow-card': glow.card,
  '--ds-glow-border': glow.border,
  '--ds-glow-button': glow.button,

  // Typography
  '--ds-font-serif': typography.fontSerif,
  '--ds-font-sans': typography.fontSans,
  '--ds-font-mono': typography.fontMono,

  // Surfaces (Phase 1)
  '--ds-canvas': surfaces.canvas,
  '--ds-surface': surfaces.surface,
  '--ds-surface-tinted': surfaces.surfaceTinted,
  '--ds-surface-dim': surfaces.surfaceDim,
  '--ds-border': surfaces.border,
  '--ds-border-strong': surfaces.borderStrong,

  // Shadows (Phase 1)
  '--ds-shadow-sm': shadows.sm,
  '--ds-shadow-md': shadows.md,
  '--ds-shadow-lg': shadows.lg,
  '--ds-shadow-focus': shadows.focus,

  // Radii (Phase 1)
  '--ds-radius-sm': radius.sm,
  '--ds-radius-md': radius.md,
  '--ds-radius-lg': radius.lg,
  '--ds-radius-xl': radius.xl,
  '--ds-radius-full': radius.full,

  // Space (Phase 1)
  '--ds-section-y': space.sectionY,
  '--ds-section-y-tight': space.sectionYTight,
  '--ds-container-x': space.containerX,
  '--ds-container-max': space.containerMax,
} as const;

export type CssVars = typeof cssVars;
```

- [ ] **Step 3: Build ui-react**

Run: `pnpm nx build ui-react`
Expected: build succeeds; no TypeScript errors. If any of `surfaces`, `shadows`, `radius`, `space` doesn't resolve from `@ngaf/design-tokens`, that's a real failure — escalate (Phase 1 should have exported them).

---

### Task 2: Add `css-vars.spec.ts`

**Files:**
- Create: `libs/ui-react/src/lib/css-vars.spec.ts`

Add a unit test that locks down which CSS vars `cssVars` produces. Commit 8.3 will delete the glass/gradient/glow assertions; the surface/shadow/radius/space assertions stay forever.

- [ ] **Step 1: Create the spec**

Create `libs/ui-react/src/lib/css-vars.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { cssVars } from './css-vars';

describe('cssVars', () => {
  describe('Phase 1 token namespaces', () => {
    it('exposes surfaces', () => {
      expect(cssVars['--ds-canvas']).toBe('#fafbfc');
      expect(cssVars['--ds-surface']).toBe('#ffffff');
      expect(cssVars['--ds-surface-tinted']).toBe('#f4f6fb');
      expect(cssVars['--ds-surface-dim']).toBe('#eef1f7');
      expect(cssVars['--ds-border']).toBe('#e6e8ee');
      expect(cssVars['--ds-border-strong']).toBe('#d2d6e0');
    });

    it('exposes shadows', () => {
      expect(cssVars['--ds-shadow-sm']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-md']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-lg']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-focus']).toContain('rgba(0, 64, 144');
    });

    it('exposes radii', () => {
      expect(cssVars['--ds-radius-sm']).toBe('6px');
      expect(cssVars['--ds-radius-md']).toBe('10px');
      expect(cssVars['--ds-radius-lg']).toBe('14px');
      expect(cssVars['--ds-radius-xl']).toBe('20px');
      expect(cssVars['--ds-radius-full']).toBe('999px');
    });

    it('exposes space', () => {
      expect(cssVars['--ds-section-y']).toBe('clamp(64px, 8vw, 120px)');
      expect(cssVars['--ds-section-y-tight']).toBe('clamp(48px, 6vw, 80px)');
      expect(cssVars['--ds-container-x']).toBe('clamp(20px, 4vw, 40px)');
      expect(cssVars['--ds-container-max']).toBe('1200px');
    });

    it('exposes extended colors', () => {
      expect(cssVars['--ds-accent-hover']).toBe('#003070');
      expect(cssVars['--ds-text-inverted']).toBe('#ffffff');
    });
  });

  describe('Pre-Phase-1 token namespaces (still present until Phase 8.3 purge)', () => {
    it('exposes core colors', () => {
      expect(cssVars['--ds-bg']).toBe('#f8f9fc');
      expect(cssVars['--ds-accent']).toBe('#004090');
      expect(cssVars['--ds-text-primary']).toBe('#1a1a2e');
    });

    it('exposes glass tokens (legacy)', () => {
      expect(cssVars['--ds-glass-bg']).toContain('rgba(255');
      expect(cssVars['--ds-glass-blur']).toBe('16px');
    });

    it('exposes gradient tokens (legacy)', () => {
      expect(cssVars['--ds-gradient-bg-flow']).toContain('linear-gradient');
    });

    it('exposes glow tokens (legacy)', () => {
      expect(cssVars['--ds-glow-card']).toContain('rgba(0, 64, 144');
    });

    it('exposes typography', () => {
      expect(cssVars['--ds-font-serif']).toContain('EB Garamond');
      expect(cssVars['--ds-font-sans']).toContain('Inter');
      expect(cssVars['--ds-font-mono']).toContain('JetBrains Mono');
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm nx test ui-react`
Expected: new spec passes. The existing `components.spec.tsx` may already pass too — verify it does (or note that it was passing pre-change; it should remain unchanged in this commit).

---

### Task 3: Verify + ship Commit 8.1

- [ ] **Step 1: Workspace check**

The css-vars change is purely additive — no existing consumer should regress. Run:

- `pnpm nx test ui-react` — Expected: all green
- `pnpm nx test design-tokens` — Expected: all green (unaffected)
- `pnpm nx e2e website` — Expected: 35 tests pass (unaffected — website doesn't consume cssVars directly)

Skip cockpit e2e for this commit (cockpit changes start in 8.2).

- [ ] **Step 2: Commit**

```bash
git add libs/ui-react/src/lib/css-vars.ts libs/ui-react/src/lib/css-vars.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui-react): extend cssVars with Phase 1 token namespaces (Phase 8.1)

Adds surfaces / shadows / radius / space CSS vars to the @ngaf/ui-react
cssVars map plus extended colors (accentHover, textInverted). Legacy
glass / gradient / glow vars stay until Phase 8.3 purge.

New libs/ui-react/src/lib/css-vars.spec.ts locks down which vars are
exposed; the legacy-namespace assertions will be removed alongside
the legacy tokens in Phase 8.3.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Commit 8.2 — Cockpit refactor

### Task 4: `layout.tsx`

**Files:**
- Modify: `apps/cockpit/src/app/layout.tsx`

Drop `var(--ds-gradient-bg-flow)` body background. Replace with `var(--ds-surface)` (white).

- [ ] **Step 1: Replace the file**

Replace `apps/cockpit/src/app/layout.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { cssVars } from '@ngaf/ui-react';
import './cockpit.css';

export const metadata = {
  title: 'Cockpit',
  description: 'Integrated cockpit for manifest-driven developer reference demos.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" style={cssVars as React.CSSProperties}>
      <body
        className="min-h-screen font-sans antialiased"
        style={{
          background: 'var(--ds-surface)',
          color: 'var(--ds-text-primary)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify**

Run: `grep -n "gradient\|glass\|backdropFilter" apps/cockpit/src/app/layout.tsx`
Expected: zero matches.

---

### Task 5: `cockpit-shell.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

The content `<section>` currently uses `bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)]`. Drop both. Add a hairline `border-b` on the inner header so the content body separates visually from the header bar.

- [ ] **Step 1: Read the file**

Run: `cat apps/cockpit/src/components/cockpit-shell.tsx`
Note the existing section's className on what's currently around line 82.

- [ ] **Step 2: Edit the content `<section>` className + add header border**

Replace the `<section>` opening tag near line 82:

From:
```tsx
<section className="grid grid-rows-[auto_1fr] gap-2 p-4 overflow-hidden bg-[var(--ds-glass-bg)] backdrop-blur-[var(--ds-glass-blur)]">
```

To:
```tsx
<section className="grid grid-rows-[auto_1fr] gap-2 p-4 overflow-hidden bg-[var(--ds-surface)]">
```

Then update the `<header>` element directly below to add a hairline bottom border. From:

```tsx
<header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
```

To:

```tsx
<header
  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-3"
  style={{ borderBottom: '1px solid var(--ds-border)' }}
>
```

Leave the rest of the file unchanged.

- [ ] **Step 3: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/cockpit-shell.tsx`
Expected: zero matches.

---

### Task 6: `cockpit-sidebar.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

Sidebar background switches to `surface-tinted` and its right border becomes `border-strong`. No `backdrop-blur`.

- [ ] **Step 1: Replace the file**

Replace `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` with:

```tsx
import React from 'react';
import type {
  CockpitManifestEntry,
} from '@ngaf/cockpit-registry';
import type { NavigationProduct } from '../../lib/route-resolution';
import { LanguagePicker } from './language-picker';
import { NavigationGroups } from './navigation-groups';

interface CockpitSidebarProps {
  navigationTree: NavigationProduct[];
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
}

export function CockpitSidebar({
  navigationTree,
  manifest,
  entry,
}: CockpitSidebarProps) {
  return (
    <aside
      aria-label="Cockpit sidebar"
      className="grid gap-4 py-6 px-0 border-r bg-[var(--ds-surface-tinted)] content-start overflow-y-auto"
      style={{
        position: 'sticky',
        top: 0,
        minHeight: '100vh',
        borderRightColor: 'var(--ds-border-strong)',
      }}
    >
      <header className="flex items-center justify-between px-4">
        <p className="text-[var(--ds-text-muted)] font-mono text-xs font-medium tracking-wide uppercase">Cockpit</p>
        <LanguagePicker manifest={manifest} entry={entry} />
      </header>
      <NavigationGroups tree={navigationTree} currentEntry={entry} />
    </aside>
  );
}
```

- [ ] **Step 2: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
Expected: zero matches.

---

### Task 7: `navigation-groups.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`

This file has no glass references currently. The token-pass tightens active-state affordance: 2px accent rail on the active link.

- [ ] **Step 1: Read the file**

Run: `cat apps/cockpit/src/components/sidebar/navigation-groups.tsx`
Note where active-link styling is applied (likely a conditional `className` or inline `style`).

- [ ] **Step 2: Apply active-rail styling**

Find the rendered `<Link>` or `<a>` element for each nav item. Locate where the "is this the active item?" branch sets background or color. Replace that branch's styles with:

For **active link**, the element gets:
- `background: var(--ds-accent-surface)`
- `color: var(--ds-accent)`
- A 2px accent left border (inline `style={{ borderLeft: '2px solid var(--ds-accent)' }}`) OR `border-l-2 border-l-[var(--ds-accent)]` className
- Adjust the horizontal padding so active and inactive items align (e.g. `pl-3` on inactive, `pl-[10px]` on active to compensate for the 2px border) — pick what looks right

For **inactive link**:
- `color: var(--ds-text-secondary)`
- Hover → `color: var(--ds-text-primary)`
- No left border

If the file uses Tailwind utility classes throughout, prefer adding the active-state via `aria-current` selector or a conditional `className`. If it uses inline styles, the conditional inline-style approach above works.

Preserve all existing routing logic (`href`, link text, sibling structure). Only the styling changes.

- [ ] **Step 3: Verify**

Run: `pnpm nx test cockpit -- --run navigation-groups 2>&1 | tail -5`
Expected: any existing nav-group tests still pass (they likely don't assert specific colors). If the test runner can't find a test for navigation-groups, that's fine — there's no spec for this file.

---

### Task 8: `language-picker.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/language-picker.tsx`

Drop glass from the trigger button and the dropdown panel. Use `surface` + `border` for the trigger; `surface` + `shadows.md` for the dropdown.

- [ ] **Step 1: Read the file**

Run: `cat apps/cockpit/src/components/sidebar/language-picker.tsx`

- [ ] **Step 2: Apply token swaps**

In the file, replace every occurrence of legacy tokens with new ones:

- `background: 'var(--ds-glass-bg)'` → `background: 'var(--ds-surface)'`
- `border: '1px solid var(--ds-glass-border)'` → `border: '1px solid var(--ds-border)'`
- `boxShadow: 'var(--ds-glass-shadow)'` → `boxShadow: 'var(--ds-shadow-md)'`
- `backdropFilter: 'blur(var(--ds-glass-blur))'` → remove the property entirely
- `WebkitBackdropFilter: 'blur(var(--ds-glass-blur))'` → remove the property entirely

Preserve all other behavior (Radix or custom dropdown logic, open/close state, callbacks).

- [ ] **Step 3: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/sidebar/language-picker.tsx`
Expected: zero matches.

---

### Task 9: `mobile-nav-overlay.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/mobile-nav-overlay.tsx`

Drop glass from the panel and its inner header border. Panel uses `surface` + `shadows.lg`; the header border uses `--ds-border`.

- [ ] **Step 1: Read the file**

Run: `cat apps/cockpit/src/components/mobile-nav-overlay.tsx`
Note the panel container's inline styles (around line 67) and the header element (around line 80).

- [ ] **Step 2: Apply token swaps**

In the file:

- Panel container — replace `background: 'var(--ds-glass-bg)'` with `background: 'var(--ds-surface)'`
- Panel container — replace `backdropFilter: 'blur(var(--ds-glass-blur))'` and `WebkitBackdropFilter: 'blur(var(--ds-glass-blur))'` — remove both
- Panel container — add `boxShadow: 'var(--ds-shadow-lg)'`
- Header element — replace `borderBottom: '1px solid var(--ds-glass-border)'` with `borderBottom: '1px solid var(--ds-border)'`
- Any inner sub-section that has `background: 'var(--ds-glass-bg)'` or `border: '1px solid var(--ds-glass-border)'` (e.g. line 121-122) — replace with `background: 'var(--ds-surface-tinted)'` and `border: '1px solid var(--ds-border)'` respectively

Preserve all open/close logic, focus management, and link rendering.

- [ ] **Step 3: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/mobile-nav-overlay.tsx`
Expected: zero matches.

---

### Task 10: `mode-switcher.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/modes/mode-switcher.tsx`

The mode-switcher's outer pill track currently uses glass. Replace with `surface-tinted` background + `border` hairline outline. Drop the shadow. The sliding indicator keeps `var(--ds-accent)` (it's the highlight).

- [ ] **Step 1: Replace the file**

Replace `apps/cockpit/src/components/modes/mode-switcher.tsx` with:

```tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';

interface ModeSwitcherProps<T extends string> {
  modes: readonly T[];
  activeMode: T;
  onChange: (mode: T) => void;
}

export function ModeSwitcher<T extends string>({
  modes,
  activeMode,
  onChange,
}: ModeSwitcherProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeIndex = modes.indexOf(activeMode);
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-mode-btn]');
    const btn = buttons[activeIndex];
    if (btn) {
      setIndicatorStyle({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [activeMode, modes]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        padding: 3,
        borderRadius: 999,
        background: 'var(--ds-surface-tinted)',
        border: '1px solid var(--ds-border)',
      }}
    >
      {/* Sliding indicator */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: indicatorStyle.left ?? 0,
          width: indicatorStyle.width ?? 0,
          borderRadius: 999,
          background: 'var(--ds-accent)',
          transition: 'left 0.25s ease, width 0.25s ease',
          zIndex: 0,
        }}
      />

      {modes.map((mode) => {
        const isActive = mode === activeMode;
        return (
          <button
            key={mode}
            data-mode-btn
            type="button"
            onClick={() => onChange(mode)}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--ds-text-inverted)' : 'var(--ds-text-secondary)',
              fontFamily: 'var(--ds-font-mono)',
              fontSize: '0.8rem',
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
```

The substantive changes from the prior version: `glass.bg` → `surface-tinted`, `glass.border` → `border`, `glass.shadow` removed, `'#fff'` → `var(--ds-text-inverted)`.

- [ ] **Step 2: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/modes/mode-switcher.tsx`
Expected: zero matches.

---

### Task 11: `code-mode.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`

Only the outer `CodeFileContent` container uses legacy tokens. The dark code-body header inside (`background: 'rgba(26, 27, 38, 0.95)'`, etc.) stays — those are intentional light-on-dark contrast colors, not glass.

- [ ] **Step 1: Apply token swaps**

Within `apps/cockpit/src/components/code-mode/code-mode.tsx`, in the `CodeFileContent` component's outer `<div className="code-mode-block">` style block:

From:
```tsx
style={{
  borderRadius: 8,
  border: '1px solid var(--ds-glass-border)',
  boxShadow: 'var(--ds-glass-shadow)',
  overflow: 'hidden',
}}
```

To:
```tsx
style={{
  borderRadius: 'var(--ds-radius-md)',
  border: '1px solid var(--ds-border)',
  boxShadow: 'var(--ds-shadow-sm)',
  overflow: 'hidden',
}}
```

Leave everything else (the dark inner header, Copy button styling, code body) untouched.

- [ ] **Step 2: Verify**

Run: `grep -n "glass\|gradient\|backdrop" apps/cockpit/src/components/code-mode/code-mode.tsx`
Expected: zero matches.

---

### Task 12: `ui/tabs.tsx`

**Files:**
- Modify: `apps/cockpit/src/components/ui/tabs.tsx`

This file is glass-free already. The minor swap: the tab-list bottom hairline currently uses `--ds-accent-border` (a tinted-blue line). The spec calls for a neutral `--ds-border` to match the new convention.

- [ ] **Step 1: Apply the swap**

In `apps/cockpit/src/components/ui/tabs.tsx`, on the line that reads:

```tsx
'inline-flex items-center gap-0 border-b border-[var(--ds-accent-border)]',
```

Change `border-[var(--ds-accent-border)]` to `border-[var(--ds-border)]`. The TabsTrigger's active underline (`data-[state=active]:border-b-[var(--ds-accent)]`) stays — that's the active affordance, which should remain `accent`-colored.

- [ ] **Step 2: Verify**

Run: `grep -n "ds-accent-border" apps/cockpit/src/components/ui/tabs.tsx`
Expected: zero matches (we only used it for the bottom hairline).

---

### Task 13: Verify + ship Commit 8.2

- [ ] **Step 1: Workspace grep — cockpit clean**

Run: `grep -rln "glass\|gradient\|--gradient-bg-flow\|backdropFilter" apps/cockpit/src 2>/dev/null`
Expected: zero matches.

- [ ] **Step 2: Cockpit tests**

Run: `pnpm nx test cockpit`
Expected: all green.

Run: `pnpm nx e2e cockpit`
Expected: all green. Note: this brings up a Next.js dev server on port 4201 — make sure the port is free.

If any test fails, fix the offending component and re-run. Pre-existing module-not-found issues like the website's `posthog-node` shouldn't apply to cockpit; if cockpit has its own pre-existing issue, document it and escalate.

- [ ] **Step 3: Website e2e for regression check**

Run: `pnpm nx e2e website`
Expected: 35 tests pass. (Website doesn't consume cockpit's components, but it does consume `@ngaf/design-tokens` and `@ngaf/ui-react`'s `cn`/`cssVars` — make sure nothing regressed.)

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/
git commit -m "$(cat <<'EOF'
refactor(cockpit): migrate to Linear-style light app shell (Phase 8.2)

Drops glassmorphism and the --ds-gradient-bg-flow body background
across the cockpit app. Replaces with the Phase 1 token namespaces:

- layout.tsx: body uses --ds-surface
- cockpit-shell.tsx: content section --ds-surface, no backdrop-blur;
  header gets a hairline --ds-border bottom edge
- cockpit-sidebar.tsx: --ds-surface-tinted background, --ds-border-strong
  right edge, no blur
- navigation-groups.tsx: active link gets a 2px --ds-accent left rail
  (devtools convention — Linear, VS Code Explorer)
- language-picker.tsx: trigger + dropdown drop glass; dropdown uses
  --ds-shadow-md
- mobile-nav-overlay.tsx: panel uses --ds-surface + --ds-shadow-lg,
  no blur; inner sub-section borders use --ds-border
- mode-switcher.tsx: flat pill (--ds-surface-tinted track + --ds-border
  outline); sliding indicator keeps --ds-accent
- code-mode.tsx: CodeFileContent outer container uses --ds-border +
  --ds-shadow-sm + --ds-radius-md; dark tokyo-night code header stays
- ui/tabs.tsx: tab-list bottom hairline switches to --ds-border;
  active tab underline stays --ds-accent

apps/cockpit grep for glass/gradient/backdrop returns zero. All
cockpit tests + cockpit e2e + website e2e green.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Commit 8.3 — Legacy token purge + orphan deletion

### Task 14: Delete orphaned `@ngaf/ui-react` components

**Files:**
- Delete: `libs/ui-react/src/lib/glass-panel.tsx`
- Delete: `libs/ui-react/src/lib/glass-button.tsx`
- Delete: `libs/ui-react/src/lib/card.tsx`
- Delete: `libs/ui-react/src/lib/code-group.tsx`
- Delete: `libs/ui-react/src/lib/callout.tsx`
- Delete: `libs/ui-react/src/lib/steps.tsx`
- Delete: `libs/ui-react/src/lib/tabs.tsx`
- Delete: `libs/ui-react/src/lib/nav-link.tsx`
- Delete: `libs/ui-react/src/lib/components.spec.tsx`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Confirm no consumers**

Run: `grep -rln "GlassPanel\|GlassButton\|glassButtonVariants\|from '@ngaf/ui-react'" apps libs --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "libs/ui-react/"`
Expected: only consumers are the ones that use `cssVars` and `cn` (apps/cockpit/src/app/layout.tsx and apps/cockpit/src/lib/utils.ts). If anything else imports from `@ngaf/ui-react`, escalate.

Also check direct named imports of the orphaned components:
Run: `grep -rln "import.*\{\s*\(Callout\|Steps\|Step\|Tabs\|Tab\|Card\|CardGroup\|CodeGroup\|NavLink\|GlassPanel\|GlassButton\)" apps libs --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "libs/ui-react/"`
Expected: zero matches.

- [ ] **Step 2: Delete the files**

Run:
```bash
rm libs/ui-react/src/lib/glass-panel.tsx
rm libs/ui-react/src/lib/glass-button.tsx
rm libs/ui-react/src/lib/card.tsx
rm libs/ui-react/src/lib/code-group.tsx
rm libs/ui-react/src/lib/callout.tsx
rm libs/ui-react/src/lib/steps.tsx
rm libs/ui-react/src/lib/tabs.tsx
rm libs/ui-react/src/lib/nav-link.tsx
rm libs/ui-react/src/lib/components.spec.tsx
```

- [ ] **Step 3: Trim `libs/ui-react/src/index.ts`**

Replace the entire file with:

```typescript
export { cn } from './lib/utils';
export { cssVars, type CssVars } from './lib/css-vars';
```

- [ ] **Step 4: Verify the lib still builds + tests pass**

Run: `pnpm nx build ui-react`
Expected: build succeeds.

Run: `pnpm nx test ui-react`
Expected: only `css-vars.spec.ts` tests run; all pass.

If the build fails because something the deleted components imported is now unused — that's fine; the dead-code path is gone with them.

---

### Task 15: Delete `glass.ts` / `gradients.ts` / `glow.ts` from `@ngaf/design-tokens`

**Files:**
- Delete: `libs/design-tokens/src/lib/glass.ts`
- Delete: `libs/design-tokens/src/lib/gradients.ts`
- Delete: `libs/design-tokens/src/lib/glow.ts`

- [ ] **Step 1: Confirm no consumers outside `libs/design-tokens`**

After Task 14, the only file that still imports these is `libs/ui-react/src/lib/css-vars.ts`. Task 17 below handles that. Other suspects: `apps/website/lib/design-tokens.ts` (re-exports them — handled in Task 18).

Run: `grep -rln "from '@ngaf/design-tokens'.*\(glass\|gradient\|glow\)\|import.*\{[^}]*\(glass\|gradient\|glow\)[^}]*\}.*from '@ngaf/design-tokens'" apps libs --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v "libs/design-tokens/"`
Expected: `libs/ui-react/src/lib/css-vars.ts` and `apps/website/lib/design-tokens.ts`. Anything else: escalate.

- [ ] **Step 2: Delete the files**

Run:
```bash
rm libs/design-tokens/src/lib/glass.ts
rm libs/design-tokens/src/lib/gradients.ts
rm libs/design-tokens/src/lib/glow.ts
```

- [ ] **Step 3: Don't run tests yet** — tasks 16-18 below remove the references that would currently fail to compile.

---

### Task 16: Clean up `@ngaf/design-tokens` aggregator + CSS + spec + index

**Files:**
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/lib/tokens.css`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`
- Modify: `libs/design-tokens/src/index.ts`

- [ ] **Step 1: `libs/design-tokens/src/lib/tokens.ts`**

Replace the entire file with:

```typescript
import { colors } from './colors';
import { typography } from './typography';
import { surfaces } from './surfaces';
import { shadows } from './shadows';
import { radius } from './radius';
import { space } from './space';

/**
 * Combined design tokens object.
 * Useful for passing all tokens at once.
 * Prefer individual imports for tree-shaking.
 */
export const tokens = {
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 2: `libs/design-tokens/src/lib/tokens.css`**

Read the existing file. Inside the `:root` block, delete every line that starts with:
- `--ds-glass-` (5 lines: bg, bg-hover, blur, border, shadow)
- `--ds-gradient-` (4 lines: warm, cool, cool-light, bg-flow)
- `--ds-glow-` (5 lines: hero, demo, card, border, button)

Also delete the comment headers `/* Glass */`, `/* Gradients */`, `/* Glow */` that precede them. Leave everything else (colors, typography, surfaces, shadows, radius, space, type scale) intact.

- [ ] **Step 3: `libs/design-tokens/src/lib/tokens.spec.ts`**

Read the existing file. Remove:

1. From the imports at the top, drop `glass`, `gradient`, `glow` from the destructured list.
2. Delete the `describe('exports glass tokens', …)` block (around lines 14-18).
3. Delete the `describe('exports gradient tokens', …)` block (around lines 20-24).
4. Delete the `describe('exports glow tokens', …)` block (around lines 26-29).
5. From the `'exports combined tokens object with all categories'` test (around line 37), remove the three lines that assert `tokens.glass`/`tokens.gradient`/`tokens.glow`.
6. From the `'all token objects are frozen'` test (around line 45), remove the `expect(() => { (glass as any).blur = '0px'; }).toThrow();` assertion. Leave the `colors` assertion.
7. From the `'tokens.css'` describe block, delete the `it('defines glass tokens', …)`, `it('defines gradient tokens', …)`, and `it('defines glow tokens', …)` tests.

Preserve every other test (Phase 1 surface/shadow/radius/space/colors-extensions/typography-scale describe blocks added previously).

- [ ] **Step 4: `libs/design-tokens/src/index.ts`**

Replace the file with:

```typescript
export { colors, type Colors } from './lib/colors';
export { typography, type Typography } from './lib/typography';
export { surfaces, type Surfaces } from './lib/surfaces';
export { shadows, type Shadows } from './lib/shadows';
export { radius, type Radius } from './lib/radius';
export { space, type Space } from './lib/space';
export { tokens, type Tokens } from './lib/tokens';
```

- [ ] **Step 5: Verify**

Run: `pnpm nx test design-tokens`
Expected: green. All remaining tests pass.

Run: `pnpm nx build design-tokens`
Expected: build succeeds.

---

### Task 17: Clean up `libs/ui-react/src/lib/css-vars.ts` + spec

**Files:**
- Modify: `libs/ui-react/src/lib/css-vars.ts`
- Modify: `libs/ui-react/src/lib/css-vars.spec.ts`

- [ ] **Step 1: Replace `css-vars.ts`**

Replace the file with:

```typescript
import {
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@ngaf/design-tokens';

/**
 * CSS custom properties derived from design tokens.
 * Apply to :root or a container element so Tailwind can reference them.
 */
export const cssVars = {
  // Colors
  '--ds-bg': colors.bg,
  '--ds-accent': colors.accent,
  '--ds-accent-hover': colors.accentHover,
  '--ds-accent-light': colors.accentLight,
  '--ds-accent-glow': colors.accentGlow,
  '--ds-accent-border': colors.accentBorder,
  '--ds-accent-border-hover': colors.accentBorderHover,
  '--ds-accent-surface': colors.accentSurface,
  '--ds-text-primary': colors.textPrimary,
  '--ds-text-secondary': colors.textSecondary,
  '--ds-text-muted': colors.textMuted,
  '--ds-text-inverted': colors.textInverted,
  '--ds-sidebar-bg': colors.sidebarBg,
  '--ds-angular-red': colors.angularRed,

  // Typography
  '--ds-font-serif': typography.fontSerif,
  '--ds-font-sans': typography.fontSans,
  '--ds-font-mono': typography.fontMono,

  // Surfaces
  '--ds-canvas': surfaces.canvas,
  '--ds-surface': surfaces.surface,
  '--ds-surface-tinted': surfaces.surfaceTinted,
  '--ds-surface-dim': surfaces.surfaceDim,
  '--ds-border': surfaces.border,
  '--ds-border-strong': surfaces.borderStrong,

  // Shadows
  '--ds-shadow-sm': shadows.sm,
  '--ds-shadow-md': shadows.md,
  '--ds-shadow-lg': shadows.lg,
  '--ds-shadow-focus': shadows.focus,

  // Radii
  '--ds-radius-sm': radius.sm,
  '--ds-radius-md': radius.md,
  '--ds-radius-lg': radius.lg,
  '--ds-radius-xl': radius.xl,
  '--ds-radius-full': radius.full,

  // Space
  '--ds-section-y': space.sectionY,
  '--ds-section-y-tight': space.sectionYTight,
  '--ds-container-x': space.containerX,
  '--ds-container-max': space.containerMax,
} as const;

export type CssVars = typeof cssVars;
```

- [ ] **Step 2: Modify `css-vars.spec.ts`**

Remove the entire `describe('Pre-Phase-1 token namespaces (still present until Phase 8.3 purge)', …)` block (the three `it()` clauses for glass tokens, gradient tokens, and glow tokens).

**Keep** the `it('exposes core colors')` and `it('exposes typography')` assertions — but move them up into the `describe('Phase 1 token namespaces', …)` block, since they're no longer "pre-Phase-1" — they're now permanent.

After the edit, the file's outer structure should be just one `describe('cssVars', () => { describe('Phase 1 token namespaces', () => { … all the surface/shadow/radius/space/colors/typography assertions … }); });` — a single nested describe.

Alternatively: just rename the inner describe to `'token namespaces'` and have all assertions live in one block. Easier to read.

- [ ] **Step 3: Verify**

Run: `pnpm nx test ui-react`
Expected: green.

Run: `pnpm nx build ui-react`
Expected: build succeeds.

---

### Task 18: Clean up website-side legacy references

**Files:**
- Modify: `apps/website/lib/design-tokens.ts`
- Modify: `apps/website/src/app/global.css`

The website previously re-exported `glass`, `gradient`, `glow` from `@ngaf/design-tokens` through a local barrel. The website itself no longer consumes them (verified by Phase 7's final grep). Now we can trim.

- [ ] **Step 1: Replace `apps/website/lib/design-tokens.ts`**

Replace the file with:

```typescript
/**
 * Website-local re-export of the shared design tokens.
 *
 * Kept as a barrel so existing imports of the form
 * `import { tokens } from '../../lib/design-tokens'` keep working.
 * New code should import directly from `@ngaf/design-tokens`.
 */
export {
  tokens,
  type Tokens,
  colors,
  typography,
  surfaces,
  shadows,
  radius,
  space,
} from '@ngaf/design-tokens';
```

- [ ] **Step 2: Modify `apps/website/src/app/global.css`**

Inside the `:root { ... }` block (around lines 45-66), delete:
- The `--glass-bg`, `--glass-bg-hover`, `--glass-blur`, `--glass-border`, `--glass-shadow` lines
- The `--gradient-bg-flow` line

Also delete the `/* Glass */`-style comment block and `/* Gradients */`-style comment block if present, and the surrounding blank lines.

Leave everything else in `:root` intact (the color tokens and `--font-*` variables).

- [ ] **Step 3: Verify**

Run: `grep -n "glass\|gradient" apps/website/lib/design-tokens.ts apps/website/src/app/global.css`
Expected: zero matches.

Run: `pnpm nx e2e website`
Expected: 35 tests pass.

---

### Task 19: Bump `@ngaf/design-tokens` patch version

**Files:**
- Modify: `libs/design-tokens/package.json`

- [ ] **Step 1: Bump version**

In `libs/design-tokens/package.json`, change `"version": "0.0.30"` to `"version": "0.0.31"`.

- [ ] **Step 2: Build to confirm**

Run: `pnpm nx build design-tokens`
Expected: build succeeds.

---

### Task 20: Workspace verification + ship Commit 8.3

- [ ] **Step 1: Workspace-wide grep**

Run: `grep -rln "tokens\.glass\|tokens\.gradient\|tokens\.glow\|--ds-glass\|--ds-gradient\|--ds-glow\|--glass-\|--gradient-bg-flow" apps libs --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "dist/"`
Expected: zero matches.

If any matches surface, fix them — they were missed in one of the earlier tasks.

- [ ] **Step 2: Run all tests**

Sequentially run:
- `pnpm nx test design-tokens` → green
- `pnpm nx test ui-react` → green
- `pnpm nx test cockpit` → green
- `pnpm nx e2e cockpit` → green
- `pnpm nx e2e website` → 35 passed

If any fail, fix and re-run.

- [ ] **Step 3: Commit**

```bash
git add -A libs/design-tokens libs/ui-react apps/website/lib/design-tokens.ts apps/website/src/app/global.css
git commit -m "$(cat <<'EOF'
chore: purge legacy glass/gradient/glow tokens + orphaned ui-react components (Phase 8.3)

Final cleanup of the multi-phase Statusbrew-inspired refactor.

@ngaf/design-tokens (bumped 0.0.30 → 0.0.31):
- Deleted libs/design-tokens/src/lib/glass.ts
- Deleted libs/design-tokens/src/lib/gradients.ts
- Deleted libs/design-tokens/src/lib/glow.ts
- tokens.ts aggregator drops glass/gradient/glow
- tokens.css drops --ds-glass-*, --ds-gradient-*, --ds-glow-*
- tokens.spec.ts drops the corresponding test blocks
- index.ts trimmed

@ngaf/ui-react becomes a thin {cssVars, cn} utility lib:
- Deleted 8 orphaned glass-using components (GlassPanel, GlassButton,
  Card, CardGroup, CodeGroup, Callout, Steps, Tabs, NavLink) — none
  were consumed outside libs/ui-react itself
- Deleted components.spec.tsx (tested the deleted components)
- index.ts trimmed to {cssVars, cn}
- css-vars.ts no longer exposes legacy --ds-glass-*/--ds-gradient-*/
  --ds-glow-* vars
- css-vars.spec.ts assertions consolidated

Website-side cleanup:
- apps/website/lib/design-tokens.ts: drop glass/gradient/glow re-exports
- apps/website/src/app/global.css: drop legacy :root vars

Workspace-wide grep for tokens.glass / tokens.gradient / tokens.glow /
--ds-glass / --ds-gradient / --ds-glow / --glass- / --gradient-bg-flow
returns zero. All tests green: design-tokens, ui-react, cockpit,
website (e2e + unit).

Multi-phase Statusbrew refactor complete.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

After this plan executes:

- Cockpit is on the new design system: light app shell with `surface-tinted` sidebar, flat mode-switcher, hairline-bordered code frames, 2px accent rail on active sidebar nav.
- `libs/ui-react/src/lib/css-vars.ts` exposes every Phase 1 namespace and no legacy ones.
- `@ngaf/design-tokens` is at 0.0.31 with `glass`/`gradient`/`glow` permanently removed.
- `@ngaf/ui-react` is a thin `{cssVars, cn}` utility lib — 8 orphaned components deleted.
- Workspace-wide grep for legacy token usage returns zero.
- All tests green: cockpit e2e + unit, website e2e (35), design-tokens unit, ui-react unit.

This completes the multi-phase Statusbrew-inspired refactor.
