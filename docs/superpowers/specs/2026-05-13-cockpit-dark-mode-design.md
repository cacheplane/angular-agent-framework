# Cockpit Dark Mode Token System — Design

**Date:** 2026-05-13
**Scope:** Cockpit app only (marketing site, docs, emails stay light)
**Status:** Spec — pending implementation plan

## Goal

Give cockpit a dark default with a light toggle, driven by typed tokens that flow through the existing `cssVars` bridge. Keep the embedded cockpit-example iframe visually consistent with its host by syncing theme across the frame boundary. Flip the cockpit OG image to match the new default.

Non-goals:
- Dark mode for marketing site, docs, or email renderings
- A re-themed code editor (tokyo-night dark stays in both themes by design)
- Theming run-mode iframes (user's own app preview — out of scope)
- A `⌘K` command palette entry for theme (no command palette in cockpit yet)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | Cockpit only |
| 2 | Mechanism | Dark by default, light toggle (devtools convention) |
| 3 | Palette family | Brand-blue undertone (`#0e1117`/`#161b25`/`#23293a`) |
| 4 | Token architecture | Themes resolved in TypeScript via `cssVars(theme)`, not CSS cascade |
| 5 | Persistence | `theme` cookie source of truth + `useOptimistic` for instant client feel |
| 6 | Toggle placement | Sidebar footer in `cockpit-shell.tsx` |
| 7 | Coverage | Chrome + chat/agent panels; run-mode iframes untouched; code editor stays tokyo-night |
| 8 | Iframe sync | `<ThemedFrame>` component owns its iframe + postMessage lifecycle (per-frame, not global) |
| 9 | Token diff | Shared `baseTokens` + small `lightOverrides` / `darkOverrides` |
| 10 | OG image | Flip cockpit OG to dark in the same PR |

## Architecture

**Cookie is the source of truth.** Cockpit's root layout reads `theme` cookie server-side via `next/headers`. The layout passes the resolved theme into `cssVars(theme)`, which produces a CSS-variable object inlined onto `<html>` via the `style` prop. This means:

- First paint ships with the correct variables — no FOUC, no blocking pre-hydration script
- Satori OG renderers (server-side) read from `cssVars('dark')` and stay consistent with the live app
- Toggle flow: `useOptimistic` flips client state instantly → POST to `/api/theme` writes cookie → `router.refresh()` reconciles server

**`useOptimistic` for toggle feel.** Server round-trip on toggle would feel laggy in a devtool. The toggle component flips `<html data-theme>` and re-applies `cssVars(next)` to `document.documentElement.style` synchronously, then writes the cookie and refreshes RSC in the background. The optimistic state and refreshed state converge to the same value.

**Iframe sync via per-frame component, not global broadcast.** A `<ThemedFrame>` component in `@ngaf/ui-react` wraps `<iframe>` and uses a `ThemeContext` to push the current theme via `postMessage` to its own contentWindow. The embedded app calls `useEmbeddedTheme()` which listens for `ngaf:theme` messages and emits `ngaf:theme-request` on mount to handshake any iframes that mounted after the parent's first broadcast. Per-frame scoping (via `e.source` check) means request/reply doesn't leak across multiple themed frames.

## Token shape

**File layout in `libs/design-tokens/src/lib/`:**

```
colors.ts          → raw brand color constants (angularRed, renderGreen, chatPurple, accent, accentLight) — unchanged values, source of truth
base.ts            → baseTokens: typography, spacing, radii, shadows, motion, and the brand colors imported from colors.ts (theme-invariant)
light.ts           → lightOverrides: surfaces + text + the semantic `accent` token (→ colors.accent, the navy)
dark.ts            → darkOverrides: surfaces + text + the semantic `accent` token (→ colors.accentLight, the bright blue)
surfaces.ts        → DELETED (split into light/dark overrides)
index.ts           → exports { baseTokens, lightOverrides, darkOverrides, type Theme }
```

The semantic `accent` is theme-variant — it maps to the navy `#004090` in light and the bright blue `#64C3FD` in dark. Both underlying brand colors stay constant; only which one the semantic role points to changes.

`@ngaf/ui-react`'s `cssVars`:

```ts
export type Theme = 'light' | 'dark';
export function cssVars(theme: Theme): CssVars {
  const overrides = theme === 'dark' ? darkOverrides : lightOverrides;
  return flattenToCustomProps({ ...baseTokens, ...overrides });
}
```

No backwards-compat shim. Every consumer updates in the same PR to pass an explicit theme.

**Palette values:**

| Token | Light | Dark |
|---|---|---|
| `canvas` | `#f4f6fb` | `#0e1117` |
| `surface` | `#ffffff` | `#161b25` |
| `surfaceTinted` | `#f9fafe` | `#1c2230` |
| `surfaceDim` | `#eef0f7` | `#0b0e15` |
| `border` | `#e4e7ef` | `#23293a` |
| `borderStrong` | `#d3d7e3` | `#2f3648` |
| `textPrimary` | `#1a1a2e` | `#e8e9eb` |
| `textSecondary` | `#555770` | `#a0a4ad` |
| `textMuted` | `#8b8fa3` | `#6b6f7a` |
| `accent` | `#004090` | `#64C3FD` |

Brand colors (`angularRed #DD0031`, `renderGreen #1a7a40`, `chatPurple #5a00c8`) live in `baseTokens` and are identical across themes — they're identity markers, not surface roles.

Version bump: `@ngaf/design-tokens` `0.0.31` → `0.0.32` (patch, per the patch-only release rule even though the API changes).

## Public surface

`@ngaf/design-tokens` new exports:

```ts
export { baseTokens } from './lib/base';
export { lightOverrides } from './lib/light';
export { darkOverrides } from './lib/dark';
export type Theme = 'light' | 'dark';
```

`@ngaf/ui-react` new exports:

```ts
export { cssVars, type CssVars, type Theme } from './lib/css-vars';
export { ThemeProvider, useTheme } from './lib/theme-context';
export { ThemeToggle } from './lib/theme-toggle';
export { ThemedFrame } from './lib/themed-frame';
export { useEmbeddedTheme } from './lib/use-embedded-theme';
```

## Component-level changes

**`apps/cockpit/src/app/layout.tsx`:**

```tsx
import { cookies } from 'next/headers';
import { cssVars, ThemeProvider, type Theme } from '@ngaf/ui-react';

export default async function RootLayout({ children }) {
  const cookie = (await cookies()).get('theme')?.value;
  const theme: Theme = cookie === 'light' ? 'light' : 'dark';
  return (
    <html lang="en" data-theme={theme} style={cssVars(theme)}>
      <body>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

**`apps/cockpit/src/app/api/theme/route.ts` (new):**

```ts
export async function POST(req: Request) {
  const { theme } = await req.json();
  if (theme !== 'light' && theme !== 'dark') return new Response('bad theme', { status: 400 });
  const res = new Response(null, { status: 204 });
  res.headers.set('Set-Cookie', `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`);
  return res;
}
```

**`apps/cockpit/src/components/cockpit-shell.tsx`:** add `<ThemeToggle />` to the sidebar footer block. Replace the embedded-example `<iframe>` (path confirmed at plan time) with `<ThemedFrame>`.

**`@ngaf/ui-react` new modules:**

- `theme-context.tsx` — `ThemeContext`, `<ThemeProvider>`, `useTheme()`
- `theme-toggle.tsx` — client component using `useOptimistic`; POSTs to `/api/theme`, calls `router.refresh()`, re-applies `cssVars(next)` to `document.documentElement.style` synchronously for instant feel; sidebar-footer styling
- `themed-frame.tsx` — wraps `<iframe>`, uses `useTheme()`, posts `ngaf:theme` on mount + on theme change, replies to `ngaf:theme-request` scoped to its own contentWindow via `e.source` check
- `use-embedded-theme.ts` — returns current theme; on mount, subscribes to `message` events and posts `ngaf:theme-request` to `window.parent`

**Embedded cockpit-example root layout:**

```tsx
'use client';
import { useEmbeddedTheme, cssVars } from '@ngaf/ui-react';

export default function EmbeddedRootLayout({ children }) {
  const theme = useEmbeddedTheme();
  return (
    <html data-theme={theme} style={cssVars(theme)}>
      <body>{children}</body>
    </html>
  );
}
```

If the embedded app's layout is RSC, split the `useEmbeddedTheme` call into a small client child that sets `data-theme` and re-applies `cssVars` to `document.documentElement` via effect.

## Consumer migration (no backwards compat)

Every existing `cssVars()` call site must pass a theme. Workspace grep at plan time; expected sites:

- `apps/cockpit/src/app/layout.tsx` → `cssVars(theme)` (cookie-driven)
- `apps/cockpit/src/app/opengraph-image.tsx` → `cssVars('dark')`
- `apps/website/src/app/layout.tsx` → `cssVars('light')`
- `apps/website/src/app/opengraph-image.tsx` → `cssVars('light')`
- `apps/website/emails/email-wrapper.ts` → `cssVars('light')`
- `apps/docs/*` (any layout/OG/embed sites) → `cssVars('light')`
- Storybook / test fixtures → `cssVars('light')` unless specifically testing dark

Compiler flags any miss because the signature becomes `(theme: Theme)`.

## OG image flip

`apps/cockpit/src/app/opengraph-image.tsx`:

- Background: `#f4f6fb` → `#0e1117`
- Card surface (if present): white → `#161b25`
- Headline text: `#1a1a2e` → `#e8e9eb`
- Accent: `#004090` → `#64C3FD`
- Border: `#e4e7ef` → `#23293a`

Implementation: import `darkOverrides` (and `baseTokens` for typography) directly from `@ngaf/design-tokens` and read the resolved hex values inline — Satori doesn't evaluate `var()` so `cssVars` output isn't useful here; the underlying token objects are. Garamond TTF loading code unchanged (typography is theme-invariant). Verify via `curl --ipv4 -o /tmp/og-cockpit.png http://localhost:4201/opengraph-image` after change.

## Testing

**Unit (`@ngaf/design-tokens`):**

- `cssVars('light')` returns expected hex values for canvas/surface/text/accent
- `cssVars('dark')` returns expected hex values
- Both shapes have identical key sets (invariant tokens present in both)
- Brand colors (angularRed/renderGreen/chatPurple) identical across themes

**Unit (`@ngaf/ui-react`):**

- `ThemeProvider` exposes theme via `useTheme`
- `ThemedFrame` posts `ngaf:theme` on mount and on theme change
- `ThemedFrame` replies to `ngaf:theme-request` only when `e.source` matches its own contentWindow
- `useEmbeddedTheme()` defaults to `'dark'`, updates on `ngaf:theme`, posts `ngaf:theme-request` to parent on mount
- `ThemeToggle` writes cookie via fetch + calls `router.refresh()`; optimistic state flips first

**Cockpit e2e (Playwright):**

- No cookie → server renders `data-theme="dark"`, `--ds-canvas` is `#0e1117`
- Cookie `light` → server renders `data-theme="light"`, `--ds-canvas` is `#f4f6fb`
- Click toggle → `data-theme` flips within 50ms, cookie present in subsequent requests
- Reload after toggle → server-rendered theme matches toggled value
- Embedded iframe: toggle host, assert iframe `document.documentElement.dataset.theme` matches host within 200ms

**OG render check:**

- `pnpm nx serve cockpit` + `curl --ipv4 -o /tmp/og-cockpit.png http://localhost:4201/opengraph-image` produces dark canvas

**Visual smoke (manual, documented for reviewer):**

- Fresh boot → dark, no flash of light
- Toggle to light → no flash, embedded iframe follows
- Reload light → still light, no flash
- Toggle back to dark → embedded iframe follows
- Code mode → editor tokyo-night unchanged; surrounding chrome flips
- Chat/agent panels legible in both themes

## Risks and mitigations

- **FOUC on initial paint** — mitigated by server-side cookie read + inline `style={cssVars(theme)}`; no client script needed before paint
- **Iframe mount-order race** — mitigated by `ngaf:theme-request` handshake from embedded app
- **Late-mounted `ThemedFrame`** — handled naturally; each frame runs its own first-paint `useEffect` and posts the current theme from context
- **Multiple `ThemedFrame`s on one page** — `e.source` check scopes request/reply per frame
- **Code editor contrast in light mode** — accepted; tokyo-night stays in both themes (deliberate, matches VS Code/GitHub convention)
- **Stale Satori OG renders cached by CDN** — flip happens in same PR as the toggle; CDN cache TTL is bounded; users will see the new card within hours

## Out of scope (follow-ups, if needed)

- Light theme for the code editor
- Dark theme for marketing site / docs
- `⌘K` command palette entry for theme switching
- Per-section theme overrides within cockpit (single global theme for now)
- Dark email templates
