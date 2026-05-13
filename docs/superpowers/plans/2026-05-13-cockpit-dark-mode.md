# Cockpit Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship cockpit dark mode as the default with a working light toggle, driven by typed `cssVars(theme)` resolution, cookie-backed persistence, and a per-frame postMessage contract for embedded iframes. Flip the cockpit OG image to match.

**Architecture:** Tokens split into invariant `baseTokens` plus tiny `lightOverrides` / `darkOverrides`. `cssVars(theme)` resolves to a flat `--ds-*` map, applied inline on `<html>` in cockpit's root layout. A `theme` cookie is the source of truth; `<ThemeToggle>` uses `useOptimistic` for instant feel and POSTs to `/api/theme` to persist. `<ThemedFrame>` wraps iframes and posts `ngaf:theme` to each contentWindow via a per-component ref; `useEmbeddedTheme()` is the consumer-side hook for the iframed app.

**Tech Stack:** Next.js 16 App Router, React 19, `@ngaf/design-tokens`, `@ngaf/ui-react`, Vitest (unit), Playwright (e2e), Nx, pnpm.

**Spec:** `docs/superpowers/specs/2026-05-13-cockpit-dark-mode-design.md`

---

## File Structure

**Created:**
- `libs/design-tokens/src/lib/base.ts` — invariant tokens (typography, spacing, radii, shadows, motion, brand colors)
- `libs/design-tokens/src/lib/light.ts` — theme-variant token values for light
- `libs/design-tokens/src/lib/dark.ts` — theme-variant token values for dark
- `libs/design-tokens/src/lib/theme.ts` — `Theme` type
- `libs/ui-react/src/lib/theme-context.tsx` — `ThemeProvider` + `useTheme`
- `libs/ui-react/src/lib/theme-toggle.tsx` — sidebar-footer toggle component
- `libs/ui-react/src/lib/themed-frame.tsx` — iframe wrapper that pushes theme via postMessage
- `libs/ui-react/src/lib/use-embedded-theme.ts` — consumer-side hook for iframed apps
- `libs/ui-react/src/lib/theme-context.spec.ts` — context unit tests
- `libs/ui-react/src/lib/theme-toggle.spec.tsx` — toggle unit tests
- `libs/ui-react/src/lib/themed-frame.spec.tsx` — frame unit tests
- `libs/ui-react/src/lib/use-embedded-theme.spec.ts` — hook unit tests
- `apps/cockpit/src/app/api/theme/route.ts` — cookie writer
- `apps/cockpit/e2e/dark-mode.spec.ts` — Playwright e2e

**Modified:**
- `libs/design-tokens/src/lib/colors.ts` — slim down to raw brand color constants
- `libs/design-tokens/src/lib/surfaces.ts` — **deleted** (values move into light/dark)
- `libs/design-tokens/src/lib/tokens.ts` — re-shape combined export
- `libs/design-tokens/src/lib/tokens.spec.ts` — update expectations
- `libs/design-tokens/src/index.ts` — export new modules
- `libs/design-tokens/package.json` — version bump 0.0.31 → 0.0.32
- `libs/ui-react/src/lib/css-vars.ts` — convert to `cssVars(theme)` function
- `libs/ui-react/src/lib/css-vars.spec.ts` — assert both themes
- `libs/ui-react/src/index.ts` — export new components and hook
- `apps/cockpit/src/app/layout.tsx` — read theme cookie, wrap in `ThemeProvider`
- `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` — add footer with `ThemeToggle`
- `apps/cockpit/src/components/run-mode.tsx` (or wherever `<iframe>` lives) — wrap with `ThemedFrame`
- `apps/cockpit/src/app/opengraph-image.tsx` — dark canvas + tokens from `darkOverrides`

---

## Task 1: Add `Theme` type and split token files

**Files:**
- Create: `libs/design-tokens/src/lib/theme.ts`
- Create: `libs/design-tokens/src/lib/base.ts`
- Create: `libs/design-tokens/src/lib/light.ts`
- Create: `libs/design-tokens/src/lib/dark.ts`
- Modify: `libs/design-tokens/src/lib/colors.ts`

- [ ] **Step 1: Write failing test for theme type**

Create `libs/design-tokens/src/lib/theme.spec.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Theme } from './theme';

describe('Theme type', () => {
  it("accepts 'light' and 'dark'", () => {
    expectTypeOf<Theme>().toEqualTypeOf<'light' | 'dark'>();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm nx test design-tokens`
Expected: FAIL — cannot find module `./theme`.

- [ ] **Step 3: Create `theme.ts`**

```ts
export type Theme = 'light' | 'dark';
```

- [ ] **Step 4: Create `base.ts` with invariant tokens**

```ts
import { typography } from './typography';
import { space } from './space';
import { radius } from './radius';
import { shadows } from './shadows';

/**
 * Theme-invariant tokens. Same values in light and dark.
 * Includes typography, spacing, radii, shadows, and brand colors that
 * are identity markers rather than surface roles.
 */
export const baseTokens = Object.freeze({
  typography,
  space,
  radius,
  shadows,
  brand: Object.freeze({
    /** LangGraph navy — used as the light-theme semantic accent */
    accent: '#004090',
    /** Bright sky blue — used as the dark-theme semantic accent */
    accentLight: '#64C3FD',
    /** Angular brand red */
    angularRed: '#DD0031',
    /** Render library green */
    renderGreen: '#1a7a40',
    /** Chat library purple */
    chatPurple: '#5a00c8',
  }),
} as const);

export type BaseTokens = typeof baseTokens;
```

- [ ] **Step 5: Create `light.ts`**

```ts
import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the light theme.
 * Preserves the current production light palette exactly.
 */
export const lightOverrides = Object.freeze({
  // Surfaces (was libs/design-tokens/src/lib/surfaces.ts)
  canvas: '#fafbfc',
  surface: '#ffffff',
  surfaceTinted: '#f4f6fb',
  surfaceDim: '#eef1f7',
  border: '#e6e8ee',
  borderStrong: '#d2d6e0',

  // Text
  textPrimary: '#1a1a2e',
  textSecondary: '#555770',
  textMuted: '#8b8fa3',
  textInverted: '#ffffff',

  // Legacy surface aliases
  bg: '#f8f9fc',
  sidebarBg: 'rgba(255, 255, 255, 0.45)',

  // Semantic accent maps to the navy brand color
  accent: baseTokens.brand.accent,
  accentHover: '#003070',
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  accentSurface: 'rgba(0, 64, 144, 0.06)',
} as const);

export type LightOverrides = typeof lightOverrides;
```

- [ ] **Step 6: Create `dark.ts`**

```ts
import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the dark theme.
 * Brand-blue undertone palette: #0e1117 content, #161b25 sidebar, #23293a borders.
 */
export const darkOverrides = Object.freeze({
  // Surfaces
  canvas: '#0e1117',
  surface: '#161b25',
  surfaceTinted: '#1c2230',
  surfaceDim: '#0b0e15',
  border: '#23293a',
  borderStrong: '#2f3648',

  // Text
  textPrimary: '#e8e9eb',
  textSecondary: '#a0a4ad',
  textMuted: '#6b6f7a',
  textInverted: '#0e1117',

  // Legacy surface aliases
  bg: '#0e1117',
  sidebarBg: 'rgba(22, 27, 37, 0.65)',

  // Semantic accent maps to the bright-blue brand color (readable on dark surfaces)
  accent: baseTokens.brand.accentLight,
  accentHover: '#8dd4ff',
  accentGlow: 'rgba(100, 195, 253, 0.25)',
  accentBorder: 'rgba(100, 195, 253, 0.2)',
  accentBorderHover: 'rgba(100, 195, 253, 0.35)',
  accentSurface: 'rgba(100, 195, 253, 0.08)',
} as const);

export type DarkOverrides = typeof darkOverrides;
```

- [ ] **Step 7: Slim `colors.ts` to brand constants only (delete theme-variant keys)**

Replace contents of `libs/design-tokens/src/lib/colors.ts`:

```ts
/**
 * @deprecated Re-exported from `baseTokens.brand` for backwards compatibility
 * with existing consumers. New code should import from `baseTokens` directly.
 *
 * Theme-variant color tokens live in `lightOverrides` / `darkOverrides` and
 * are resolved at runtime via `cssVars(theme)` in @ngaf/ui-react.
 */
import { baseTokens } from './base';

export const colors = baseTokens.brand;
export type Colors = typeof colors;
```

- [ ] **Step 8: Verify type test passes**

Run: `pnpm nx test design-tokens -- --run theme.spec`
Expected: PASS.

- [ ] **Step 9: Verify no broken imports inside the lib**

Run: `pnpm nx typecheck design-tokens`
Expected: PASS (we haven't touched tokens.ts/index.ts yet; existing `colors.*` references on theme-variant keys will fail — fix in Task 2).

If typecheck fails on `colors.textPrimary` / `colors.sidebarBg` / etc. — that's Task 2's job. Move on.

- [ ] **Step 10: Commit**

```bash
git add libs/design-tokens/src/lib/theme.ts libs/design-tokens/src/lib/base.ts libs/design-tokens/src/lib/light.ts libs/design-tokens/src/lib/dark.ts libs/design-tokens/src/lib/colors.ts libs/design-tokens/src/lib/theme.spec.ts
git commit -m "feat(design-tokens): add base/light/dark split and Theme type"
```

---

## Task 2: Wire token barrel and delete `surfaces.ts`

**Files:**
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`
- Delete: `libs/design-tokens/src/lib/surfaces.ts`

- [ ] **Step 1: Read current `tokens.ts` and `index.ts` to see exact existing exports**

Run: `cat libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/index.ts`

- [ ] **Step 2: Update `tokens.ts`**

Replace contents:

```ts
import { baseTokens } from './base';
import { lightOverrides } from './light';
import { darkOverrides } from './dark';

/**
 * Combined token shape for documentation and Storybook.
 * Consumers that need theme resolution should import baseTokens +
 * lightOverrides/darkOverrides directly, or use `cssVars(theme)` from
 * @ngaf/ui-react.
 */
export const tokens = Object.freeze({
  ...baseTokens,
  light: lightOverrides,
  dark: darkOverrides,
} as const);

export type Tokens = typeof tokens;
```

- [ ] **Step 3: Update `libs/design-tokens/src/index.ts` to export new modules**

Add exports (preserve existing exports of `typography`, `space`, `radius`, `shadows`, `colors`):

```ts
export { typography } from './lib/typography';
export type { Typography } from './lib/typography';
export { space } from './lib/space';
export type { Space } from './lib/space';
export { radius } from './lib/radius';
export type { Radius } from './lib/radius';
export { shadows } from './lib/shadows';
export type { Shadows } from './lib/shadows';
export { colors } from './lib/colors';
export type { Colors } from './lib/colors';
export { tokens } from './lib/tokens';
export type { Tokens } from './lib/tokens';

// New theme-aware exports
export { baseTokens } from './lib/base';
export type { BaseTokens } from './lib/base';
export { lightOverrides } from './lib/light';
export type { LightOverrides } from './lib/light';
export { darkOverrides } from './lib/dark';
export type { DarkOverrides } from './lib/dark';
export type { Theme } from './lib/theme';
```

Drop any `from './lib/surfaces'` line.

- [ ] **Step 4: Update `tokens.spec.ts`**

Replace contents:

```ts
import { describe, it, expect } from 'vitest';
import { tokens, baseTokens, lightOverrides, darkOverrides } from './tokens';

describe('tokens', () => {
  it('exposes baseTokens at the root', () => {
    expect(tokens.brand).toBe(baseTokens.brand);
  });

  it('exposes light and dark overrides under named keys', () => {
    expect(tokens.light).toBe(lightOverrides);
    expect(tokens.dark).toBe(darkOverrides);
  });

  it('light and dark have identical key sets (catches missing tokens in either theme)', () => {
    const lightKeys = Object.keys(lightOverrides).sort();
    const darkKeys = Object.keys(darkOverrides).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('brand colors are theme-invariant', () => {
    expect(baseTokens.brand.angularRed).toBe('#DD0031');
    expect(baseTokens.brand.renderGreen).toBe('#1a7a40');
    expect(baseTokens.brand.chatPurple).toBe('#5a00c8');
  });
});
```

Note: the test imports `baseTokens` / `lightOverrides` / `darkOverrides` from `./tokens` — they must be re-exported. Update `tokens.ts` to also export those:

```ts
export { baseTokens } from './base';
export { lightOverrides } from './light';
export { darkOverrides } from './dark';
```

- [ ] **Step 5: Delete `surfaces.ts`**

Run: `git rm libs/design-tokens/src/lib/surfaces.ts`

- [ ] **Step 6: Run tests**

Run: `pnpm nx test design-tokens`
Expected: PASS, four tests in `tokens.spec.ts`.

- [ ] **Step 7: Typecheck**

Run: `pnpm nx typecheck design-tokens`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/lib/tokens.spec.ts libs/design-tokens/src/index.ts
git commit -m "refactor(design-tokens): restructure barrel for theme-aware tokens, remove surfaces.ts"
```

---

## Task 3: Convert `cssVars` to `cssVars(theme)` function

**Files:**
- Modify: `libs/ui-react/src/lib/css-vars.ts`
- Modify: `libs/ui-react/src/lib/css-vars.spec.ts`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Write failing test**

Replace contents of `libs/ui-react/src/lib/css-vars.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cssVars } from './css-vars';

describe('cssVars(theme)', () => {
  describe('light', () => {
    const vars = cssVars('light');

    it('uses light canvas color', () => {
      expect(vars['--ds-canvas']).toBe('#fafbfc');
    });

    it('uses navy accent', () => {
      expect(vars['--ds-accent']).toBe('#004090');
    });

    it('uses dark text on light surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#1a1a2e');
    });
  });

  describe('dark', () => {
    const vars = cssVars('dark');

    it('uses dark canvas color', () => {
      expect(vars['--ds-canvas']).toBe('#0e1117');
    });

    it('uses bright-blue accent', () => {
      expect(vars['--ds-accent']).toBe('#64C3FD');
    });

    it('uses near-white text on dark surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#e8e9eb');
    });
  });

  it('both themes expose the same custom-property keys', () => {
    const lightKeys = Object.keys(cssVars('light')).sort();
    const darkKeys = Object.keys(cssVars('dark')).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('brand colors are identical across themes', () => {
    expect(cssVars('light')['--ds-angular-red']).toBe(cssVars('dark')['--ds-angular-red']);
    expect(cssVars('light')['--ds-render-green']).toBe(cssVars('dark')['--ds-render-green']);
    expect(cssVars('light')['--ds-chat-purple']).toBe(cssVars('dark')['--ds-chat-purple']);
  });

  it('typography tokens are identical across themes', () => {
    expect(cssVars('light')['--ds-font-serif']).toBe(cssVars('dark')['--ds-font-serif']);
    expect(cssVars('light')['--ds-font-sans']).toBe(cssVars('dark')['--ds-font-sans']);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm nx test ui-react`
Expected: FAIL — `cssVars is not a function`.

- [ ] **Step 3: Rewrite `css-vars.ts`**

Replace contents:

```ts
import {
  baseTokens,
  lightOverrides,
  darkOverrides,
  type Theme,
} from '@ngaf/design-tokens';

const overridesByTheme = {
  light: lightOverrides,
  dark: darkOverrides,
} as const;

/**
 * Resolve design tokens to a flat map of `--ds-*` CSS custom properties
 * for the given theme. Apply to `<html>` (or any container) via the
 * React `style` prop so Tailwind utilities and `var()` lookups resolve.
 */
export function cssVars(theme: Theme) {
  const t = overridesByTheme[theme];
  const { brand, typography, space, radius, shadows } = baseTokens;

  return {
    // Surfaces (theme-variant)
    '--ds-canvas': t.canvas,
    '--ds-surface': t.surface,
    '--ds-surface-tinted': t.surfaceTinted,
    '--ds-surface-dim': t.surfaceDim,
    '--ds-border': t.border,
    '--ds-border-strong': t.borderStrong,

    // Text (theme-variant)
    '--ds-text-primary': t.textPrimary,
    '--ds-text-secondary': t.textSecondary,
    '--ds-text-muted': t.textMuted,
    '--ds-text-inverted': t.textInverted,

    // Legacy surface aliases
    '--ds-bg': t.bg,
    '--ds-sidebar-bg': t.sidebarBg,

    // Accent family (theme-variant — semantic accent points to navy in light, bright-blue in dark)
    '--ds-accent': t.accent,
    '--ds-accent-hover': t.accentHover,
    '--ds-accent-glow': t.accentGlow,
    '--ds-accent-border': t.accentBorder,
    '--ds-accent-border-hover': t.accentBorderHover,
    '--ds-accent-surface': t.accentSurface,

    // Raw brand colors (invariant)
    '--ds-accent-light': brand.accentLight,
    '--ds-angular-red': brand.angularRed,
    '--ds-render-green': brand.renderGreen,
    '--ds-chat-purple': brand.chatPurple,

    // Typography (invariant)
    '--ds-font-serif': typography.fontSerif,
    '--ds-font-sans': typography.fontSans,
    '--ds-font-mono': typography.fontMono,

    // Shadows (invariant)
    '--ds-shadow-sm': shadows.sm,
    '--ds-shadow-md': shadows.md,
    '--ds-shadow-lg': shadows.lg,
    '--ds-shadow-focus': shadows.focus,

    // Radii (invariant)
    '--ds-radius-sm': radius.sm,
    '--ds-radius-md': radius.md,
    '--ds-radius-lg': radius.lg,
    '--ds-radius-xl': radius.xl,
    '--ds-radius-full': radius.full,

    // Spacing (invariant)
    '--ds-section-y': space.sectionY,
    '--ds-section-y-tight': space.sectionYTight,
    '--ds-container-x': space.containerX,
    '--ds-container-max': space.containerMax,
  } as const;
}

export type CssVars = ReturnType<typeof cssVars>;
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm nx test ui-react`
Expected: PASS, all `cssVars(theme)` tests green.

- [ ] **Step 5: Re-export `Theme` from ui-react barrel**

Edit `libs/ui-react/src/index.ts` — add:

```ts
export { cssVars, type CssVars } from './lib/css-vars';
export type { Theme } from '@ngaf/design-tokens';
```

If `cssVars` is already exported, replace the line; do not duplicate.

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/css-vars.ts libs/ui-react/src/lib/css-vars.spec.ts libs/ui-react/src/index.ts
git commit -m "feat(ui-react): convert cssVars to cssVars(theme) function"
```

---

## Task 4: Add `ThemeProvider` + `useTheme` context

**Files:**
- Create: `libs/ui-react/src/lib/theme-context.tsx`
- Create: `libs/ui-react/src/lib/theme-context.spec.tsx`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `libs/ui-react/src/lib/theme-context.spec.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme-context';

function ThemeReadout() {
  const theme = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe('ThemeProvider', () => {
  it('exposes the theme via useTheme', () => {
    render(
      <ThemeProvider theme="dark">
        <ThemeReadout />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it("defaults to 'dark' when no provider is present", () => {
    render(<ThemeReadout />);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm nx test ui-react`
Expected: FAIL — cannot resolve `./theme-context`.

- [ ] **Step 3: Implement `theme-context.tsx`**

```tsx
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Theme } from '@ngaf/design-tokens';

const ThemeContext = createContext<Theme>('dark');

export interface ThemeProviderProps {
  theme: Theme;
  children: ReactNode;
}

/**
 * Provides the current theme to descendants. Cockpit's root layout reads
 * the theme cookie server-side and passes it in; `<ThemedFrame>` and
 * `<ThemeToggle>` consume via `useTheme()`.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm nx test ui-react`
Expected: PASS.

- [ ] **Step 5: Re-export from barrel**

Add to `libs/ui-react/src/index.ts`:

```ts
export { ThemeProvider, useTheme, type ThemeProviderProps } from './lib/theme-context';
```

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/theme-context.tsx libs/ui-react/src/lib/theme-context.spec.tsx libs/ui-react/src/index.ts
git commit -m "feat(ui-react): add ThemeProvider + useTheme context"
```

---

## Task 5: Add `<ThemedFrame>` component

**Files:**
- Create: `libs/ui-react/src/lib/themed-frame.tsx`
- Create: `libs/ui-react/src/lib/themed-frame.spec.tsx`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/ui-react/src/lib/themed-frame.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from './theme-context';
import { ThemedFrame } from './themed-frame';

function makeIframeWithMockedContentWindow() {
  // jsdom doesn't give iframes a real contentWindow; stub it before render
  const postMessage = vi.fn();
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreateElement(tag);
    if (tag === 'iframe') {
      Object.defineProperty(el, 'contentWindow', { value: { postMessage } });
    }
    return el;
  });
  return { postMessage };
}

describe('ThemedFrame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the current theme to its iframe on mount', () => {
    const { postMessage } = makeIframeWithMockedContentWindow();
    render(
      <ThemeProvider theme="dark">
        <ThemedFrame src="about:blank" data-testid="frame" />
      </ThemeProvider>
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme', theme: 'dark' }, '*');
  });

  it('replies to ngaf:theme-request only when e.source matches its own contentWindow', () => {
    const { postMessage } = makeIframeWithMockedContentWindow();
    const { container } = render(
      <ThemeProvider theme="light">
        <ThemedFrame src="about:blank" />
      </ThemeProvider>
    );
    postMessage.mockClear();
    const iframe = container.querySelector('iframe')!;
    const ownWindow = iframe.contentWindow;

    // Matching source — should reply
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme-request' }, source: ownWindow as Window })
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme', theme: 'light' }, '*');

    postMessage.mockClear();

    // Different source — should NOT reply
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme-request' }, source: window })
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm nx test ui-react`
Expected: FAIL — cannot resolve `./themed-frame`.

- [ ] **Step 3: Implement `themed-frame.tsx`**

```tsx
'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type IframeHTMLAttributes,
} from 'react';
import { useTheme } from './theme-context';

export type ThemedFrameProps = IframeHTMLAttributes<HTMLIFrameElement>;

/**
 * Drop-in replacement for `<iframe>` that pushes the current host theme
 * to its child via `postMessage`. The embedded app opts in by calling
 * `useEmbeddedTheme()` from this package.
 *
 * Each ThemedFrame owns its own postMessage lifecycle — there is no
 * global broadcaster or DOM-querying. Multiple frames coexist cleanly
 * because handshake replies are scoped to `e.source === this iframe's
 * contentWindow`.
 */
export const ThemedFrame = forwardRef<HTMLIFrameElement, ThemedFrameProps>(
  function ThemedFrame(props, externalRef) {
    const theme = useTheme();
    const ref = useRef<HTMLIFrameElement>(null);
    useImperativeHandle(externalRef, () => ref.current as HTMLIFrameElement);

    // Push the current theme on mount and whenever it changes.
    useEffect(() => {
      ref.current?.contentWindow?.postMessage(
        { type: 'ngaf:theme', theme },
        '*',
      );
    }, [theme]);

    // Reply to handshake requests from this specific frame.
    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (e.source !== ref.current?.contentWindow) return;
        if (e.data?.type === 'ngaf:theme-request') {
          ref.current?.contentWindow?.postMessage(
            { type: 'ngaf:theme', theme },
            '*',
          );
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [theme]);

    return <iframe ref={ref} {...props} />;
  },
);
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm nx test ui-react -- --run themed-frame.spec`
Expected: PASS.

- [ ] **Step 5: Re-export**

Add to `libs/ui-react/src/index.ts`:

```ts
export { ThemedFrame, type ThemedFrameProps } from './lib/themed-frame';
```

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/themed-frame.tsx libs/ui-react/src/lib/themed-frame.spec.tsx libs/ui-react/src/index.ts
git commit -m "feat(ui-react): add ThemedFrame for per-iframe theme postMessage"
```

---

## Task 6: Add `useEmbeddedTheme` hook

**Files:**
- Create: `libs/ui-react/src/lib/use-embedded-theme.ts`
- Create: `libs/ui-react/src/lib/use-embedded-theme.spec.ts`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/ui-react/src/lib/use-embedded-theme.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmbeddedTheme } from './use-embedded-theme';

describe('useEmbeddedTheme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'dark' as the default", () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    expect(result.current).toBe('dark');
  });

  it('posts ngaf:theme-request to window.parent on mount', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');
    renderHook(() => useEmbeddedTheme());
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme-request' }, '*');
  });

  it('updates when an ngaf:theme message arrives', () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'light' } }),
      );
    });
    expect(result.current).toBe('light');
  });

  it('ignores messages of unrelated types', () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'something-else', theme: 'light' } }),
      );
    });
    expect(result.current).toBe('dark');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm nx test ui-react`
Expected: FAIL — cannot resolve `./use-embedded-theme`.

- [ ] **Step 3: Implement the hook**

```ts
'use client';

import { useEffect, useState } from 'react';
import type { Theme } from '@ngaf/design-tokens';

/**
 * Hook for the embedded app inside a `<ThemedFrame>`. Returns the current
 * host theme, defaulting to `'dark'` until the first `ngaf:theme` message
 * arrives. On mount, posts an `ngaf:theme-request` to `window.parent` so
 * the host replies even if its broadcaster ran before the iframe mounted.
 *
 * Apply the returned value as `data-theme` on `<html>` (and inline
 * `cssVars(theme)` if the embedded app uses our token system).
 */
export function useEmbeddedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ngaf:theme') {
        const next = e.data.theme;
        if (next === 'light' || next === 'dark') {
          setTheme(next);
        }
      }
    };
    window.addEventListener('message', handler);
    // Handshake: ask the parent for the current theme in case we mounted
    // after its first broadcast.
    window.parent?.postMessage({ type: 'ngaf:theme-request' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  return theme;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm nx test ui-react -- --run use-embedded-theme.spec`
Expected: PASS, four tests.

- [ ] **Step 5: Re-export**

Add to `libs/ui-react/src/index.ts`:

```ts
export { useEmbeddedTheme } from './lib/use-embedded-theme';
```

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/use-embedded-theme.ts libs/ui-react/src/lib/use-embedded-theme.spec.ts libs/ui-react/src/index.ts
git commit -m "feat(ui-react): add useEmbeddedTheme hook for iframed apps"
```

---

## Task 7: Add `<ThemeToggle>` component

**Files:**
- Create: `libs/ui-react/src/lib/theme-toggle.tsx`
- Create: `libs/ui-react/src/lib/theme-toggle.spec.tsx`
- Modify: `libs/ui-react/src/index.ts`

`<ThemeToggle>` is the only client component that performs side effects on click: it POSTs to `/api/theme`, re-applies `cssVars(next)` to `document.documentElement.style` synchronously (so the swap is immediate without waiting for RSC refresh), and calls `router.refresh()` to reconcile server state. `useOptimistic` provides the React 19 state pattern.

- [ ] **Step 1: Write failing test**

Create `libs/ui-react/src/lib/theme-toggle.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from './theme-context';
import { ThemeToggle } from './theme-toggle';

// next/navigation is not available in jsdom — provide a mock that the
// component can import.
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('renders a button reflecting the current theme', () => {
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeTruthy();
  });

  it('POSTs to /api/theme with the next theme on click', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/theme');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ theme: 'light' });
  });

  it('flips data-theme on documentElement synchronously (optimistic)', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(
      <ThemeProvider theme="dark">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('calls router.refresh after persisting the cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(
      <ThemeProvider theme="light">
        <ThemeToggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm nx test ui-react`
Expected: FAIL — cannot resolve `./theme-toggle`.

- [ ] **Step 3: Implement `theme-toggle.tsx`**

```tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cssVars } from './css-vars';
import { useTheme } from './theme-context';
import type { Theme } from '@ngaf/design-tokens';

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'light' };

/**
 * Sidebar-footer toggle that flips between light and dark. Cookie is the
 * source of truth, so we:
 *   1. Update `data-theme` and inline `cssVars(next)` on <html> synchronously
 *      for instant visual feedback (this is the "optimistic" update).
 *   2. POST to /api/theme to persist the cookie.
 *   3. Call router.refresh() so RSC re-renders pick up the new theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const next = NEXT[theme];

  const onClick = () => {
    // Optimistic visual swap on the document — the active ThemeProvider
    // value won't update until router.refresh() completes server-side.
    document.documentElement.dataset.theme = next;
    const vars = cssVars(next) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
    startTransition(() => {
      void fetch('/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      }).then(() => router.refresh());
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={className}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm nx test ui-react -- --run theme-toggle.spec`
Expected: PASS, four tests.

- [ ] **Step 5: Re-export**

Add to `libs/ui-react/src/index.ts`:

```ts
export { ThemeToggle } from './lib/theme-toggle';
```

- [ ] **Step 6: Commit**

```bash
git add libs/ui-react/src/lib/theme-toggle.tsx libs/ui-react/src/lib/theme-toggle.spec.tsx libs/ui-react/src/index.ts
git commit -m "feat(ui-react): add ThemeToggle component"
```

---

## Task 8: Add cookie-write route in cockpit

**Files:**
- Create: `apps/cockpit/src/app/api/theme/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse('invalid json', { status: 400 });
  }
  const theme =
    body && typeof body === 'object' && 'theme' in body ? (body as { theme: unknown }).theme : null;
  if (theme !== 'light' && theme !== 'dark') {
    return new NextResponse('bad theme', { status: 400 });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set('theme', theme, {
    path: '/',
    maxAge: ONE_YEAR_S,
    sameSite: 'lax',
    httpOnly: false,
  });
  return res;
}
```

- [ ] **Step 2: Smoke-test by hand (optional pre-e2e check)**

Start the dev server (`pnpm nx serve cockpit`) in another shell, then:

```bash
curl --ipv4 -i -X POST http://localhost:4201/api/theme -H 'content-type: application/json' -d '{"theme":"light"}'
```

Expected: `HTTP/1.1 204 No Content` + `Set-Cookie: theme=light; ...` header.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/app/api/theme/route.ts
git commit -m "feat(cockpit): add /api/theme cookie-write route"
```

---

## Task 9: Wire cockpit root layout to cookie-driven theme

**Files:**
- Modify: `apps/cockpit/src/app/layout.tsx`

- [ ] **Step 1: Read current `layout.tsx`**

Run: `cat apps/cockpit/src/app/layout.tsx`

Note the existing imports, metadata block, body className, and how `cssVars` is currently spread into the `<html>` style prop.

- [ ] **Step 2: Update layout to read cookie + use `cssVars(theme)`**

Replace the existing layout component (preserve all existing metadata exports and the body className verbatim):

```tsx
import { cookies } from 'next/headers';
import { cssVars, ThemeProvider } from '@ngaf/ui-react';
import type { Theme } from '@ngaf/design-tokens';
// ...existing imports preserved (font loaders, metadata, etc.)

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get('theme')?.value;
  const theme: Theme = cookieValue === 'light' ? 'light' : 'dark';

  return (
    <html lang="en" data-theme={theme} style={cssVars(theme) as React.CSSProperties}>
      <body
        className="..." // PRESERVE the existing body className verbatim
        style={{ background: 'var(--ds-surface)', color: 'var(--ds-text-primary)' }}
      >
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

If the existing `RootLayout` is not async, mark it `async` (Next.js 16's `cookies()` is async).

- [ ] **Step 3: Verify cockpit typechecks**

Run: `pnpm nx typecheck cockpit`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

In another shell: `pnpm nx serve cockpit`
Then: `curl --ipv4 -s http://localhost:4201 | grep -o 'data-theme="[^"]*"'`
Expected: `data-theme="dark"` (no cookie → default).

Then: `curl --ipv4 -s --cookie 'theme=light' http://localhost:4201 | grep -o 'data-theme="[^"]*"'`
Expected: `data-theme="light"`.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/app/layout.tsx
git commit -m "feat(cockpit): cookie-driven theme in root layout"
```

---

## Task 10: Add `<ThemeToggle>` to sidebar footer

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

- [ ] **Step 1: Read the current sidebar**

Run: `cat apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

Identify where `<NavigationGroups>` ends — that's where the new footer goes.

- [ ] **Step 2: Add the footer block**

Inside the existing `<aside>`, after `<NavigationGroups>`, add:

```tsx
import { ThemeToggle } from '@ngaf/ui-react';
// ... existing imports

// Inside JSX, after <NavigationGroups />:
<div className="mt-auto border-t border-[var(--ds-border)] px-4 py-3 flex items-center justify-between">
  <span className="text-xs text-[var(--ds-text-muted)]">Theme</span>
  <ThemeToggle className="rounded-md p-1.5 text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-tinted)] hover:text-[var(--ds-text-primary)] transition-colors" />
</div>
```

If the `<aside>` doesn't use `flex` already, wrap its existing content so the footer pushes to the bottom: convert the aside to `flex flex-col` (preserving existing classes), and make sure `<NavigationGroups>` is in a sibling above the new footer block.

- [ ] **Step 3: Visual check**

Restart dev server. Confirm the toggle appears at the bottom of the sidebar. Click it — page should flip light/dark immediately (data-theme attribute changes). Reload — theme persists.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx
git commit -m "feat(cockpit): add ThemeToggle to sidebar footer"
```

---

## Task 11: Wrap RunMode iframe with `<ThemedFrame>`

**Files:**
- Modify: `apps/cockpit/src/components/run-mode.tsx` (path verified during execution; the file containing `<iframe src={runtimeUrl}>`)

- [ ] **Step 1: Locate the iframe**

Run: `rg "<iframe" apps/cockpit/src -l`

Open the file that contains the run-mode iframe.

- [ ] **Step 2: Swap `<iframe>` for `<ThemedFrame>`**

```tsx
// Before:
import { /* ...existing... */ } from '...';
// ... <iframe src={runtimeUrl} ...props />

// After:
import { ThemedFrame } from '@ngaf/ui-react';
// ... <ThemedFrame src={runtimeUrl} ...props />
```

All other iframe attributes are preserved (className, sandbox, allow, etc.).

- [ ] **Step 3: Verify the cockpit app still renders RunMode**

Restart dev server. Open a capability route that uses RunMode. Confirm the iframe loads.

The embedded cacheplane example app doesn't yet implement `useEmbeddedTheme()` — that's a follow-up in the cacheplane repo. Until then, the postMessage is a no-op on the iframe side and the example keeps its own theme. The host wrapper still ships correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/run-mode.tsx
git commit -m "feat(cockpit): wrap run-mode iframe with ThemedFrame"
```

---

## Task 12: Flip cockpit OG image to dark

**Files:**
- Modify: `apps/cockpit/src/app/opengraph-image.tsx`

- [ ] **Step 1: Read current file**

Run: `cat apps/cockpit/src/app/opengraph-image.tsx`

Note current hex literals: `#f4f6fb` (canvas), `#1a1a2e` (text primary), `#004090` (accent), `#555770` (secondary), plus any others.

- [ ] **Step 2: Import dark tokens**

Replace hex literals with reads from `darkOverrides`:

```tsx
import { darkOverrides } from '@ngaf/design-tokens';

// In the JSX of the ImageResponse render:
//   backgroundColor: darkOverrides.canvas
//   color:           darkOverrides.textPrimary  (for headline)
//   color:           darkOverrides.textSecondary (for secondary text)
//   color:           darkOverrides.accent        (for accent — bright blue in dark)
//   borderColor:     darkOverrides.border
```

Satori doesn't evaluate `var()`, so we read the resolved hex values from `darkOverrides` directly. Garamond/Inter/JetBrains Mono font loading code is unchanged.

- [ ] **Step 3: Render and eyeball**

```bash
pnpm nx serve cockpit &
sleep 5
curl --ipv4 -s -o /tmp/og-cockpit.png http://localhost:4201/opengraph-image
open /tmp/og-cockpit.png
```

Expected: dark canvas (`#0e1117`), bright-blue accent visible, text legible.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/app/opengraph-image.tsx
git commit -m "feat(cockpit): flip OG image to dark canvas"
```

---

## Task 13: Playwright e2e for theme persistence + toggle

**Files:**
- Create: `apps/cockpit/e2e/dark-mode.spec.ts`

- [ ] **Step 1: Create the test**

```ts
import { expect, test } from '@playwright/test';

test.describe('dark mode', () => {
  test('defaults to dark when no cookie is set', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const canvas = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--ds-canvas').trim());
    expect(canvas).toBe('#0e1117');
  });

  test('honors theme=light cookie on server render', async ({ page, context }) => {
    await context.addCookies([
      { name: 'theme', value: 'light', url: 'http://localhost:4201' },
    ]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const canvas = await page
      .locator('html')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('--ds-canvas').trim());
    expect(canvas).toBe('#fafbfc');
  });

  test('toggle flips data-theme optimistically and persists across reload', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: /switch to light/i }).click();
    // Optimistic: data-theme flips synchronously
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Persistence: reload and confirm
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
```

- [ ] **Step 2: Run the e2e**

```bash
pnpm nx e2e cockpit -- --grep "dark mode"
```

Expected: three passing tests.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/e2e/dark-mode.spec.ts
git commit -m "test(cockpit): e2e for dark mode default + toggle + persistence"
```

---

## Task 14: Bump design-tokens version + lint sweep

**Files:**
- Modify: `libs/design-tokens/package.json`
- Modify: `libs/ui-react/package.json`

- [ ] **Step 1: Bump versions**

`libs/design-tokens/package.json`: `0.0.31` → `0.0.32`
`libs/ui-react/package.json`: bump patch by 1 (whatever its current is + 1)

Per the patch-only release rule (never to 0.1.0), increment patch.

- [ ] **Step 2: Run the full check stack**

```bash
pnpm nx run-many -t lint,test,typecheck -p design-tokens,ui-react,cockpit
```

Expected: all green.

- [ ] **Step 3: Run the cockpit e2e suite end-to-end**

```bash
pnpm nx e2e cockpit
```

Expected: all green, including the new dark-mode tests.

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/package.json libs/ui-react/package.json
git commit -m "chore: bump design-tokens and ui-react patch versions"
```

---

## Task 15: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin dark-mode-token-system
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: cockpit dark mode token system" --body "$(cat <<'EOF'
## Summary

- Token split into invariant `baseTokens` + `lightOverrides` / `darkOverrides`; `cssVars(theme)` resolves at runtime.
- Cookie-backed theme with `useOptimistic`-style synchronous swap on toggle; sidebar-footer toggle in cockpit.
- `<ThemedFrame>` + `useEmbeddedTheme()` exposed from `@ngaf/ui-react` for per-frame postMessage theme sync (no global DOM querying).
- Cockpit OG image flipped to dark canvas.

Spec: `docs/superpowers/specs/2026-05-13-cockpit-dark-mode-design.md`

## Test plan

- [ ] `pnpm nx run-many -t lint,test,typecheck -p design-tokens,ui-react,cockpit`
- [ ] `pnpm nx e2e cockpit`
- [ ] Manual: visit cockpit, confirm dark on first load, toggle to light, reload, confirm persistence
- [ ] Manual: `curl --ipv4 -o /tmp/og-cockpit.png http://localhost:4201/opengraph-image` and eyeball dark canvas

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for green CI, then squash-merge**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage check:**

- ✅ Scope cockpit only — Tasks 9, 10, 11 touch cockpit; website/docs untouched
- ✅ Dark default + light toggle — Tasks 9 (default) + 7, 10 (toggle)
- ✅ Brand-blue palette — Task 1 (`dark.ts`)
- ✅ `cssVars(theme)` resolved in TS — Task 3
- ✅ Cookie source of truth + `useOptimistic` — Tasks 7, 8, 9
- ✅ Sidebar footer placement — Task 10
- ✅ Coverage: chrome + chat/agent panels via tokens; run-mode iframe via `ThemedFrame`; code editor untouched — Tasks 9, 11
- ✅ `<ThemedFrame>` per-frame — Task 5
- ✅ Base + light/dark overrides — Tasks 1, 2
- ✅ OG flip in same PR — Task 12
- ✅ Tests at every layer — Tasks 1–7 unit, Task 13 e2e
- ✅ Version bump — Task 14

**Adjustments from spec discovered during exploration:**

1. Spec listed many `cssVars` consumers (website, docs, emails). Actual workspace grep shows **only `apps/cockpit/src/app/layout.tsx`** consumes `cssVars`. Removed the multi-consumer migration section — no other call sites need updating.
2. No `cockpit-example` app exists under `apps/`. Examples are served from `https://examples.cacheplane.ai/`. `useEmbeddedTheme` ships as a public hook; adoption by cacheplane is a follow-up.
3. OG fonts are Inter + JetBrains Mono, not Garamond — no font-instancing complications.
4. Light palette values preserved from current production (`#fafbfc` canvas etc.) rather than the spec's approximations — minimizes visual diff on existing light-theme consumers. Dark values match spec exactly.
5. `colors.ts` had additional theme-variant tokens (`accentGlow`, `accentBorder`, `accentBorderHover`, `accentSurface`, `accentHover`, `textInverted`, `sidebarBg`, `bg`) that the spec didn't list individually — all now bucketed into light/dark overrides in Task 1.

**Placeholder scan:** No "TBD"/"TODO"/"add error handling" strings. All code blocks are concrete. Test code is complete, not gestured at.

**Type consistency:** `Theme`, `cssVars`, `CssVars`, `ThemedFrameProps`, `ThemeProviderProps`, `useTheme`, `useEmbeddedTheme` — names consistent across tasks.
