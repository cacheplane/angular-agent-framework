# Dark Palette Alignment — Design

**Date:** 2026-05-15
**Status:** Spec — pending implementation plan
**Context:** Sibling of #321 (light palette refresh). Prerequisite for Stage 2 of examples theme sync.

## Goal

Refresh `@ngaf/design-tokens` **dark** palette to absorb `@ngaf/chat` library's neutral-dark aesthetic (matches what we did for light in PR #321). Cockpit dark mode flips from the original brand-blue undertone (`#0e1117` / `#161b25` / `#23293a`) to neutral dark (`rgb(17, 17, 17)` / `rgb(28, 28, 28)` / `rgb(45, 45, 45)`). This reverses decision D from the original cockpit dark mode brainstorming (where brand-blue undertone was preferred over neutral grays), in favor of cohesion with the chat lib's dark palette.

Embedded chat surfaces in cockpit dark mode now visually unify with cockpit chrome — no longer have the slight color seam at the iframe boundary.

Out of scope:
- Light palette (already aligned in #321)
- Accent family (`accent`, `accentLight`, `accentHover`, `accentGlow`, `accentBorder`, `accentBorderHover`, `accentSurface`) — brand-blue identity preserved
- Shadow scale (already neutral `rgba(0, 0, 0, *)` from #321)
- Brand colors (Angular red, render green, chat purple) — unchanged

## Decision

| # | Decision | Choice |
|---|---|---|
| 1 | Reverse #298's decision D (brand-blue undertone) | Yes — align dark to chat lib's neutral palette |
| 2 | Accent family in dark | Unchanged — brand identity stays |
| 3 | Generator pipeline | Same as #321 — values flow from `darkOverrides` to the design-tokens TS sources to the website's generated `theme.css` |
| 4 | Cockpit changes | None to source. `cssVars('dark')` picks up new values automatically |

## Concrete palette changes — `darkOverrides`

In `libs/design-tokens/src/lib/dark.ts`:

| Token | Before | After |
|---|---|---|
| `canvas` | `#0e1117` | `rgb(17, 17, 17)` |
| `surface` | `#161b25` | `rgb(28, 28, 28)` |
| `surfaceTinted` | `#1c2230` | `rgb(44, 44, 44)` |
| `surfaceDim` | `#0b0e15` | `rgb(10, 10, 10)` (interpolated; chat lib has no direct equivalent — darker than canvas, matching the light pattern where dim < canvas) |
| `border` | `#23293a` | `rgb(45, 45, 45)` |
| `borderStrong` | `#2f3648` | `rgb(60, 60, 60)` (chat lib's `--ngaf-chat-muted`) |
| `textPrimary` | `#e8e9eb` | `rgb(245, 245, 245)` |
| `textSecondary` | `#a0a4ad` | `rgb(200, 200, 200)` (interpolated between primary and muted; chat lib has no direct equivalent) |
| `textMuted` | `#6b6f7a` | `rgb(160, 160, 160)` |
| `textInverted` | `#0e1117` | `rgb(17, 17, 17)` (matches canvas) |
| `bg` (legacy alias) | `#0e1117` | `rgb(17, 17, 17)` |
| `sidebarBg` | `rgba(22, 27, 37, 0.65)` | `rgba(28, 28, 28, 0.65)` (matches new surface translucency) |
| `accent` (semantic) | `baseTokens.brand.accentLight` (`#64C3FD`) | unchanged |
| `accentHover` | `#8dd4ff` | unchanged |
| `accentGlow` | `rgba(100, 195, 253, 0.25)` | unchanged |
| `accentBorder` | `rgba(100, 195, 253, 0.2)` | unchanged |
| `accentBorderHover` | `rgba(100, 195, 253, 0.35)` | unchanged |
| `accentSurface` | `rgba(100, 195, 253, 0.08)` | unchanged |

## File changes

- **Modify**: `libs/design-tokens/src/lib/dark.ts` — palette values per table above
- **Modify**: `libs/design-tokens/src/lib/css-vars.spec.ts` — update dark-theme `toBe` expectations
- **Modify**: `apps/cockpit/e2e/dark-mode.spec.ts` — update `'#0e1117'` assertion to `'rgb(17, 17, 17)'`
- **Modify**: `libs/design-tokens/src/lib/theme.css` — re-run generator; verify diff is unchanged (the generator emits LIGHT values to `@theme`, so this file is unaffected by the dark change — confirm via drift-guard)
- **Modify**: `libs/design-tokens/package.json` — patch bump
- **No source changes** in `apps/cockpit`, `apps/website`, `libs/chat`, or `libs/example-layouts` — `cssVars(theme)` picks up new dark values automatically

## Testing

**Unit:**
- `pnpm nx test design-tokens` — `css-vars.spec.ts` assertions updated, all green
- Drift-guard test (`generate-theme-css.spec.ts`) — passes since theme.css doesn't contain dark values

**E2e:**
- `pnpm nx e2e cockpit` — `dark-mode.spec.ts` assertion updated, all green

**Visual smoke (chrome MCP):**
- Cockpit on 3000, timeline pilot on 4507
- Default dark: surfaces are neutral dark (not blue-tinted); chat iframe's dark palette matches cockpit dark perfectly — no visible seam
- Toggle to light: unchanged (PR #321 values still apply)
- Toggle back to dark: matches new palette

## Risks and mitigations

- **Loss of brand-blue undertone in cockpit dark mode.** This was a deliberate aesthetic choice in #298. Mitigated by user-confirmed reversal during PR 3 brainstorming.
- **Cockpit OG image (dark canvas).** `apps/cockpit/src/app/opengraph-image.tsx` reads `darkOverrides` directly at request time via Satori. After this change, the OG image renders with new dark canvas. CDN cache invalidates on deploy. Brief visual diff in social previews acceptable.
- **e2e test assertion drift.** Mitigated by Task to update the specific assertion in this PR.

## Out-of-scope follow-ups (track but defer)

- Stage 2 of examples theme sync (auto-install side effect + 31-app fan-out) — separate PR
- Removing the `@ngaf/example-layouts/theme.css` namespace bridge — now near-redundant in both light and dark (values match closely). Tracked.
