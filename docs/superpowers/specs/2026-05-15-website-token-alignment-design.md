# Website Token Alignment + Design-Tokens Light Palette Refresh — Design

**Date:** 2026-05-15
**Status:** Spec — pending implementation plan
**Spec series:** Third (final) in the cockpit dark mode + style alignment series

## Goal

Close the visual-consistency gap between cockpit and the marketing website. Two coupled changes:

1. **Refresh `@ngaf/design-tokens` light palette** to absorb the chat lib's polished consumer aesthetic — pure-white surfaces, near-black text, neutral grays. Chat lib's tokens stay independent; its values become the canonical light palette by being copied into design-tokens. Embedded chat surfaces in cockpit automatically visually unify with cockpit chrome because both now resolve to the same colors.
2. **Migrate the marketing website (`apps/website`)** from its hand-maintained `@theme` block (duplicate hex values) to consume `@ngaf/design-tokens` values at build time via a generated CSS file. Single source of truth; no drift.

Out of scope:
- Chat lib palette unification or coupling (chat lib stays independent — decision C from brainstorming)
- Renaming the `--ds-*` prefix (deferred; rationale documented in this spec)
- Doc h1/h2/h3 size tokenization — narrative-docs in cockpit doesn't use explicit sizes; website docs use prose styling; no concrete need surfaced
- `--ds-*` dark palette changes (chat lib's dark theme is chat-specific; design-tokens dark stays as it shipped in #298)
- Brand accent colors (`--ds-accent`, `--ds-accent-light`, brand reds/greens/purples) — these are cockpit identity, not part of chat lib's aesthetic
- Removing the namespace bridge in `@ngaf/example-layouts/theme.css` (now redundant but harmless; track as follow-up)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Visual unification direction | Update `@ngaf/design-tokens` light values to match chat lib aesthetic; chat lib palette stays independent |
| 2 | Website consumption of design-tokens | Build-time CSS generation — `@ngaf/design-tokens` ships a `theme.css` file generated from TS constants; website imports it; existing `@theme` block deleted |
| 3 | `--ds-*` prefix | Keep. Renaming is a cross-cutting sweep that doesn't pay for itself in this PR |
| 4 | Cockpit changes | None to source code. Cockpit consumes `cssVars(theme)` which picks up the new values automatically |
| 5 | OG image regeneration | Re-render website + cockpit OG images so social previews use the new palette |

## Architecture

**Token flow (after this PR):**

1. **Source of truth**: TS constants in `libs/design-tokens/src/lib/{base,light,dark}.ts`
2. **Cockpit (light + dark)**: `cssVars(theme)` resolves tokens at runtime; applied inline on `<html>` in `apps/cockpit/src/app/layout.tsx`. Unchanged behavior; new values automatic.
3. **Website (light only)**: at design-tokens BUILD time, a small script reads `lightOverrides` + `baseTokens` and emits `libs/design-tokens/src/lib/theme.css` containing a `@theme { … }` block matching Tailwind v4's expectations. Website's `apps/website/src/app/global.css` becomes `@import "@ngaf/design-tokens/theme.css";` plus any website-specific overrides.
4. **Chat lib**: continues to declare its own `--ngaf-chat-*` tokens independently. Values happen to match `--ds-*` for the cleanly-mappable subset because we copied them from chat lib. Future divergence is possible but discouraged.

**Build-time CSS generation:**

A new file `libs/design-tokens/scripts/generate-theme-css.ts` reads the TypeScript constants and emits `libs/design-tokens/src/lib/theme.css`. Run via:

- An Nx target `pnpm nx run design-tokens:generate-theme-css` (declared in `libs/design-tokens/project.json`)
- A `prebuild` hook on the design-tokens project — emit the CSS before the lib's main build
- A guard test that re-runs the generator and diffs against the committed file (CI fails if `theme.css` is stale)

The emitted `theme.css` is committed to the repo (not in `.gitignore`) so consumers can import it without running the generator themselves.

## Concrete palette changes

**`lightOverrides`** in `libs/design-tokens/src/lib/light.ts`:

| Token | Before | After (chat lib value) |
|---|---|---|
| `canvas` | `#fafbfc` | `rgb(255, 255, 255)` |
| `surface` | `#ffffff` | `rgb(255, 255, 255)` (unchanged in effect) |
| `surfaceTinted` | `#f4f6fb` | `rgb(251, 251, 251)` |
| `surfaceDim` | `#eef1f7` | `rgb(245, 245, 245)` (interpolated; chat lib has no direct equivalent — picked a value slightly darker than `surfaceTinted`) |
| `border` | `#e6e8ee` | `rgb(229, 229, 229)` |
| `borderStrong` | `#d2d6e0` | `rgb(200, 200, 200)` |
| `textPrimary` | `#1a1a2e` | `rgb(28, 28, 28)` |
| `textSecondary` | `#555770` | `rgb(70, 70, 70)` (interpolated; chat lib has no direct equivalent — picked between primary and muted) |
| `textMuted` | `#8b8fa3` | `rgb(115, 115, 115)` |
| `textInverted` | `#ffffff` | `rgb(255, 255, 255)` (unchanged in effect) |
| `bg` (legacy alias) | `#f8f9fc` | `rgb(255, 255, 255)` (matches new canvas) |
| `sidebarBg` | `rgba(255, 255, 255, 0.45)` | `rgba(255, 255, 255, 0.45)` (unchanged — glass effect) |

Accent family (`accent`, `accentHover`, `accentGlow`, `accentBorder`, `accentBorderHover`, `accentSurface`) — **unchanged**. Cockpit/website brand identity; chat lib doesn't define these.

**`baseTokens.shadows`** in `libs/design-tokens/src/lib/base.ts`:

| Token | Before | After |
|---|---|---|
| `sm` | `0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)` | `0 1px 2px rgba(0, 0, 0, 0.05)` (chat lib shadow-sm) |
| `md` | `0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)` | `0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -1px rgba(0, 0, 0, 0.06)` (chat lib shadow-md) |
| `lg` | `0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)` | `0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` (chat lib shadow-lg) |
| `focus` | `0 0 0 3px rgba(0, 64, 144, 0.25)` | unchanged (accent-family) |

`baseTokens.radius`, `baseTokens.space`, `baseTokens.typography`: **unchanged**. Chat lib's specific radii (bubble 15px, input 20px) are chat-domain and stay in chat lib's own tokens.

**`darkOverrides`** in `libs/design-tokens/src/lib/dark.ts`: **unchanged**. Chat lib's dark theme is chat-specific; design-tokens dark stays as shipped in #298 (the cockpit dark mode brand-blue undertone palette).

## Website migration

**Before** (`apps/website/src/app/global.css`):

```css
@import "tailwindcss";

@theme {
  --color-canvas: #fafbfc;
  --color-surface: #ffffff;
  --color-accent: #004090;
  /* ...30+ more lines of hardcoded hex... */
}

:root {
  /* mirror of @theme tokens for SSR fallback */
}
```

**After**:

```css
@import "tailwindcss";
@import "@ngaf/design-tokens/theme.css";

/* Website-specific overrides if any */
```

The generated `@ngaf/design-tokens/theme.css` contains:

```css
@theme {
  --color-canvas: rgb(255, 255, 255);
  --color-surface: rgb(255, 255, 255);
  --color-accent: #004090;
  /* ...generated from light.ts + base.ts at build time... */
}
```

Note the Tailwind v4 convention `--color-*` (not `--ds-*`). The generator maps each design-token name into the `--color-*` / `--font-*` / `--radius-*` / `--shadow-*` / `--spacing-*` categories that Tailwind v4 expects. Tailwind utilities like `bg-canvas`, `text-accent` keep working — they're auto-generated from `@theme`.

The 48 utility usages in website TSX (`bg-bg`, `text-accent`, etc.) — **no changes needed**. Tailwind v4 reads `--color-*` from `@theme`; the generated file provides them.

## `@ngaf/design-tokens` package changes

- **Create**: `libs/design-tokens/scripts/generate-theme-css.ts` — TS script that imports `baseTokens`, `lightOverrides` and emits `theme.css`
- **Create**: `libs/design-tokens/src/lib/theme.css` — generated artifact (committed)
- **Modify**: `libs/design-tokens/package.json` — add `exports."./theme.css"`, add `generate-theme-css` script
- **Modify**: `libs/design-tokens/project.json` — add `generate-theme-css` Nx target; add `prebuild` dependency
- **Modify**: `libs/design-tokens/src/lib/light.ts` — palette values per table above
- **Modify**: `libs/design-tokens/src/lib/base.ts` — shadow values per table above
- **Create**: `libs/design-tokens/src/lib/generate-theme-css.spec.ts` — guard test that re-runs the generator and diffs against committed `theme.css`
- **Modify**: `libs/design-tokens/package.json` — patch bump 0.0.33 → 0.0.34

## `apps/website` changes

- **Modify**: `apps/website/src/app/global.css` — drop `@theme { … }` and `:root { mirror }` blocks; add `@import "@ngaf/design-tokens/theme.css";`
- **Modify**: `apps/website/postcss.config.mjs` — confirm Tailwind v4 still picks up the imported `@theme` block; no changes expected (Tailwind v4's PostCSS plugin scans imported CSS)

## Cockpit changes

**None to source code.** `cssVars(theme)` resolves the new `lightOverrides` values automatically. `apps/cockpit/src/app/layout.tsx` already passes `theme` from the cookie. In dark mode (cockpit's default), nothing visually changes. In light mode (after toggle), surfaces are now pure-white instead of cool off-white; text is near-black instead of `#1a1a2e`.

## OG image regeneration

`apps/website/src/app/opengraph-image.tsx` reads design-tokens at runtime via Satori. After the value updates, the next render automatically reflects the new palette. CDN cache invalidation happens on deploy.

`apps/cockpit/src/app/opengraph-image.tsx` reads `darkOverrides` (cockpit OG is canonical dark). No change since dark palette is unchanged.

## Tailwind v4 naming convention note

Tailwind v4 auto-generates utility classes from `@theme` tokens matched to its category namespaces:
- `--color-*` → `bg-*`, `text-*`, `border-*` etc.
- `--font-*` → `font-*`
- `--radius-*` → `rounded-*`
- `--shadow-*` → `shadow-*`
- `--spacing-*` → `p-*`, `m-*`, `gap-*` etc.

The generator emits tokens under the right Tailwind categories so utilities work without per-token mapping. Cockpit uses `bg-[var(--ds-canvas)]` (arbitrary value form) because its tokens are runtime-injected — Tailwind can't see `--ds-canvas` at build time. Website's tokens are at build time, so utilities like `bg-canvas` resolve naturally.

This means **the two apps DO have a slight naming difference at call sites**:
- Cockpit: `bg-[var(--ds-canvas)]`
- Website: `bg-canvas`

The values resolve identically. The notational difference is forced by Tailwind v4's build-time vs cockpit's runtime-injection architectural choice. Acceptable. Documented for future contributors.

## Testing

**Unit:**
- `libs/design-tokens/src/lib/generate-theme-css.spec.ts` — new test that calls the generator and asserts output matches committed `theme.css` (CI guard against drift)
- Existing `libs/design-tokens/src/lib/light.spec.ts` (or equivalent) — update expected values to match the new palette

**Build verification:**
- `pnpm nx run design-tokens:generate-theme-css` — emits `theme.css`; output matches committed file
- `pnpm nx build website` — clean; `@theme` block resolved from generated file
- `pnpm nx build cockpit` — clean; no source changes needed
- `pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit,website` — green

**Visual smoke (chrome MCP):**
- Cockpit on 3000, timeline pilot on 4507
- Cockpit dark mode: unchanged (verify no regression)
- Toggle cockpit to light: surfaces should be pure white (no cool gray cast); text should be near-black; embedded chat should match cockpit chrome exactly (no visible seam where iframe meets shell)
- Website at `localhost:4174` (or wherever it runs): surfaces should be pure white; component-level visual diff is negligible since `--color-canvas` already had `#fafbfc` close to white

## Risks and mitigations

- **Visual regression in cockpit light mode.** The change is small (`#fafbfc` → `rgb(255,255,255)`, etc.) but visible. Mitigated by visual smoke and a brief eyeball pass on every cockpit capability route in light mode.
- **Snapshot tests asserting specific hex values.** Cockpit e2e tests in `apps/cockpit/e2e/dark-mode.spec.ts` assert `--ds-canvas` is `#0e1117` in dark and `#fafbfc` in light. The light assertion needs to update to `rgb(255, 255, 255)`. Caught by CI; fix in the same PR.
- **Generator drift.** The `theme.css` committed file could drift from the TS constants. Mitigated by the generate-theme-css.spec.ts guard test.
- **Tailwind v4 doesn't pick up the imported `@theme` block.** Risk if the website's PostCSS config processes the import in the wrong order. Verified by running `pnpm nx build website` after the change.
- **Website's `@theme` block had website-specific tokens** not in design-tokens (e.g., `--font-garamond`, `--font-inter`, `--font-mono`). The generator must emit these too — they're sourced from `baseTokens.typography`. Verify all 30+ keys round-trip.

## Out-of-scope follow-ups (track but defer)

- Removing the now-redundant namespace bridge in `@ngaf/example-layouts/theme.css` (the bridge mapped `--ngaf-chat-*` to `--ds-*`; with values matching, the bridge is a no-op but not harmful)
- Renaming `--ds-*` prefix (cross-cutting sweep; do separately if/when needed)
- Doc h1/h2/h3 size tokenization (no concrete need surfaced)
- Chat lib palette unification with `--ds-*` references (decision C from brainstorming — chat lib stays independent)
