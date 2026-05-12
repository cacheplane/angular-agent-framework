# Website refactor — Phase 8: Cockpit + final token purge

## Summary

Migrate `apps/cockpit/**` off glassmorphism and the `--ds-gradient-bg-flow` background to a Linear-style light app shell with devtools restraint, using the design tokens established in Phase 1. After cockpit lands clean, delete the legacy `glass`/`gradient`/`glow` namespaces from `@ngaf/design-tokens` and bump the patch version.

This is the final phase of the multi-phase Statusbrew-inspired refactor. After Phase 8 ships, every surface in the workspace consumes only the new token namespaces.

## Goals

1. Cockpit reads as a Linear-style devtools UI: light neutral chrome, dense typography, restrained accent, no glass, no blur, no gradient washes.
2. `@ngaf/ui-react`'s `cssVars` exposes every Phase 1 token namespace so cockpit (and any other React consumer) can use `var(--ds-surface)`, `var(--ds-shadow-md)`, etc.
3. The legacy `glass`/`gradient`/`glow` namespaces are deleted from `@ngaf/design-tokens` and its supporting files (`tokens.ts`, `tokens.css`, `index.ts`, `tokens.spec.ts`, `cssVars`).
4. All existing tests pass: cockpit e2e (`pnpm nx e2e cockpit`), cockpit unit (`pnpm nx test cockpit`), design-tokens unit (`pnpm nx test design-tokens`), website e2e (`pnpm nx e2e website`).

## Non-goals

- Cockpit IA changes (sidebar grouping, mode set, route shape stay as-is).
- New cockpit features (no new modes, no new sidebar widgets).
- Dark mode for cockpit (future).
- Refactoring `@ngaf/cockpit-registry`, `@ngaf/cockpit-shell`, or any other cockpit-adjacent lib — only the cockpit Next.js app and the `@ngaf/ui-react` css-vars file.

## Audience

Developers using cockpit to poke at agent runtimes. The audience is the same as the docs but the surface is denser and more app-like.

## Design

### Aesthetic — "Linear-style light app shell with devtools restraint"

- White content well (`var(--ds-surface)`)
- Slightly cooler sidebar (`var(--ds-surface-tinted)`) with a stronger hairline divider (`var(--ds-border-strong)`) — gives visual chrome/content separation without going dark
- Dense typography: 13–14px body, 11–12px nav labels in mono uppercase, no marketing-style section padding
- Restrained accent: only on active state, sliding indicator on the mode switcher, code-tab affordances
- No backdrop-filter anywhere
- No shadows on the shell itself; `shadow.sm` reserved for individual cards (code-file frames)
- 2px accent rail on the active sidebar item (devtools convention — Linear, VS Code Explorer)

### Prerequisite — `libs/ui-react/src/lib/css-vars.ts`

The bridge file that converts `@ngaf/design-tokens` TypeScript exports into the `--ds-*` CSS variables consumed by cockpit. Currently exposes only `colors`, `glass`, `gradient`, `glow`, `typography`. Extend with the Phase 1 additions before any cockpit changes:

- Surfaces: `--ds-canvas`, `--ds-surface`, `--ds-surface-tinted`, `--ds-surface-dim`, `--ds-border`, `--ds-border-strong`, `--ds-text-inverted`, `--ds-accent-hover`
- Shadows: `--ds-shadow-sm`, `--ds-shadow-md`, `--ds-shadow-lg`, `--ds-shadow-focus`
- Radii: `--ds-radius-sm`, `--ds-radius-md`, `--ds-radius-lg`, `--ds-radius-xl`, `--ds-radius-full`
- Space: `--ds-section-y`, `--ds-section-y-tight`, `--ds-container-x`, `--ds-container-max`

Cockpit won't use the space tokens (full-bleed), but exporting them completes the API for any future consumer.

This is a 1-file additive change. Website continues to function — it does not consume css-vars directly, but the lib build is shared and a green lib build matters.

### `layout.tsx`

Drop `var(--ds-gradient-bg-flow)` body background → `var(--ds-surface)` (white). Keep `<html style={cssVars}>`. Body's text color stays `var(--ds-text-primary)`.

### `cockpit-shell.tsx`

2-pane grid layout stays. Drop glass from the content `<section>`:

- Background: `var(--ds-surface)` (matches body)
- Drop the `backdrop-blur-[var(--ds-glass-blur)]` Tailwind class
- The inner header bar gets a hairline `border-bottom` `var(--ds-border)` for visual separation from the content body
- Padding stays `p-4`

The shell header structure (context label · entry title · ModeSwitcher) is unchanged structurally; only the surrounding shell drops glass.

### `cockpit-sidebar.tsx`

- Background: `var(--ds-surface-tinted)`
- Right border: `1px solid var(--ds-border-strong)`
- No `backdrop-blur`, no shadow
- Sticky positioning stays
- Header label "Cockpit" stays mono-uppercase 12px in `text-muted`

### `navigation-groups.tsx`

Sidebar inner nav. The component currently has no glass references — only color tokens — but a token-pass tightens the affordances:

- Group headers: mono uppercase 11px in `text-muted`
- Inactive link: 13px Inter, `text-secondary`, hover → `text-primary`
- Active link: `accent-surface` background + `accent` color + a 2px-wide `accent` rail on the left edge (CSS pseudo-element or inline left-border)
- Link padding: 6px vertical, 16px horizontal — denser than the website docs sidebar

### `language-picker.tsx`

- Trigger button: `surface` background, `1px solid var(--ds-border)`, hover → `border-strong`, 11px mono
- Dropdown panel: `surface` background, `shadows.md`, no glass, no `backdrop-blur`
- Option hover: `accent-surface` background
- Selected option: `accent` text + `accent-surface` background

### `mode-switcher.tsx`

The sliding-indicator pill toggle. Drop glass:

- Outer track: `surface-tinted` background, `1px solid var(--ds-border)` outline, no shadow
- Sliding indicator: keeps `accent` solid background — the highlight is the whole visual point
- Active label: `text-inverted` (already correct)
- Inactive label: `text-secondary`, hover → `text-primary`
- Inactive label hover doesn't move the indicator — just colors the text

### `mobile-nav-overlay.tsx`

- Dimmer behind the panel: `rgba(0,0,0,0.4)` (kept — it's a dimmer, not glass)
- Panel: `var(--ds-surface)` background, `shadows.lg`, no `backdrop-blur`
- Top header inside the panel: hairline bottom border `var(--ds-border)` to mirror the desktop sidebar header
- Close button: same as the desktop sidebar's nav-link hover pattern (`surface` background → `accent-surface` on hover)
- Active link in the mobile nav: same affordance as desktop (`accent-surface` + 2px `accent` rail)
- Drop all `var(--ds-glass-*)` references

### Per-mode chrome

**Run mode** (`run-mode.tsx`, 27 lines, no glass) — likely a thin iframe wrapper. Verify it has no glass; if any rounded-border styling exists, update to `var(--ds-border)` + `var(--ds-radius-md)`.

**Code mode** (`code-mode.tsx`, 115 lines) — `CodeFileContent` wraps a dark tokyo-night code block. Restyle the outer container:

- `border: 1px solid var(--ds-border)`
- `box-shadow: var(--ds-shadow-sm)`
- `border-radius: var(--ds-radius-md)`
- Drop `var(--ds-glass-border)` and `var(--ds-glass-shadow)`

The dark code-body header stays dark (raw rgba is correct — those are light-on-dark contrast colors for the syntax-highlighted code background). The Copy button inside the dark header stays as-is.

**Docs mode** (`narrative-docs.tsx`, 69 lines, no glass) — verify with grep; restyle only if anything surfaces.

**API mode** (`api-mode.tsx`, 161 lines) — likely needs the same treatment as `ApiDocRenderer` from the website docs. Restyle any `var(--ds-glass-*)` → `var(--ds-surface)` / `var(--ds-border)` / `var(--ds-shadow-sm)`.

**`components/ui/tabs.tsx`** (55 lines) — cockpit's tabs primitive used by CodeMode. Update tab bar to `surface-tinted` background with `border` bottom hairline; active tab uses 2px `accent` underline + `accent` text.

### Legacy token purge + orphan deletion (final commit of Phase 8)

After cockpit and css-vars are clean and all tests pass, delete the legacy token files, the orphaned `@ngaf/ui-react` components that consumed them, and all remaining references.

**Orphaned `@ngaf/ui-react` components to delete.** Workspace grep confirmed none of these are consumed outside `libs/ui-react` itself — only `cssVars` and `cn` from the lib are actually used (by cockpit). Per YAGNI, delete:

- `libs/ui-react/src/lib/glass-panel.tsx` — `GlassPanel` (explicit glass)
- `libs/ui-react/src/lib/glass-button.tsx` — `GlassButton` + `glassButtonVariants` (uses glow tokens)
- `libs/ui-react/src/lib/card.tsx` — `Card` + `CardGroup` (uses glass + glow)
- `libs/ui-react/src/lib/code-group.tsx` — `CodeGroup` (uses glass)
- `libs/ui-react/src/lib/callout.tsx` — `Callout` (verify glass usage during impl)
- `libs/ui-react/src/lib/steps.tsx` — `Steps`, `Step` (verify glass usage during impl)
- `libs/ui-react/src/lib/tabs.tsx` — `Tabs`, `Tab` (verify glass usage during impl)
- `libs/ui-react/src/lib/nav-link.tsx` — `NavLink` (verify glass usage during impl)
- `libs/ui-react/src/lib/components.spec.tsx` — test file for the deleted components

After deletion `@ngaf/ui-react` is a thin utility lib exporting only `cssVars`, `type CssVars`, and `cn`. `libs/ui-react/src/index.ts` is trimmed to those three exports.

**Token files to delete:**
- `libs/design-tokens/src/lib/glass.ts`
- `libs/design-tokens/src/lib/gradients.ts`
- `libs/design-tokens/src/lib/glow.ts`

**Files to modify (remove glass/gradient/glow references):**
- `libs/design-tokens/src/index.ts` — drop `glass`/`gradient`/`glow` exports
- `libs/design-tokens/src/lib/tokens.ts` — drop them from imports + aggregator
- `libs/design-tokens/src/lib/tokens.css` — drop `--ds-glass-*`, `--ds-gradient-*`, `--ds-glow-*` declarations
- `libs/design-tokens/src/lib/tokens.spec.ts` — drop the `glass`/`gradient`/`glow` test blocks + remove their imports
- `libs/ui-react/src/lib/css-vars.ts` — drop the same CSS-var exports
- `apps/website/lib/design-tokens.ts` — drop the `glass`/`gradient`/`glow` re-exports
- `apps/website/src/app/global.css` — drop the `:root` block's `--glass-*` and `--gradient-bg-flow` declarations (no longer consumed)

**Bump version:** `libs/design-tokens/package.json` `0.0.30` → `0.0.31` per the repo's patch-only policy.

**Workspace verification:** `grep -rln "glass\|gradient\|glow" apps libs --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null | grep -v node_modules | grep -v ".next"` should return zero matches *anywhere*.

## File-level change map

```
libs/ui-react/src/lib/css-vars.ts                                  [PREREQ — extend with new namespaces; then Final — drop glass/gradient/glow]

libs/design-tokens/src/lib/glass.ts                                [DELETE in final commit]
libs/design-tokens/src/lib/gradients.ts                            [DELETE in final commit]
libs/design-tokens/src/lib/glow.ts                                 [DELETE in final commit]
libs/design-tokens/src/lib/tokens.ts                               [MODIFY in final commit — drop legacy refs]
libs/design-tokens/src/lib/tokens.css                              [MODIFY in final commit — drop legacy vars]
libs/design-tokens/src/lib/tokens.spec.ts                          [MODIFY in final commit — drop legacy assertions]
libs/design-tokens/src/index.ts                                    [MODIFY in final commit — drop legacy exports]
libs/design-tokens/package.json                                    [BUMP version in final commit]

apps/cockpit/src/app/layout.tsx                                    [REFACTOR — drop gradient body bg]
apps/cockpit/src/components/cockpit-shell.tsx                      [REFACTOR — drop glass on content section]
apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx            [REFACTOR — surface-tinted bg + border-strong divider]
apps/cockpit/src/components/sidebar/navigation-groups.tsx          [REFACTOR — active-state rail + hover normalization]
apps/cockpit/src/components/sidebar/language-picker.tsx            [REFACTOR — drop glass on trigger + dropdown]
apps/cockpit/src/components/mobile-nav-overlay.tsx                 [REFACTOR — drop glass; mirror desktop sidebar treatment]
apps/cockpit/src/components/modes/mode-switcher.tsx                [REFACTOR — flat pill, no glass]
apps/cockpit/src/components/code-mode/code-mode.tsx                [REFACTOR — outer container uses surface + shadow.sm; dark code body stays]
apps/cockpit/src/components/api-mode/api-mode.tsx                  [REFACTOR — same treatment as website's ApiDocRenderer if glass present]
apps/cockpit/src/components/narrative-docs/narrative-docs.tsx      [VERIFY — restyle only if glass present]
apps/cockpit/src/components/run-mode/run-mode.tsx                  [VERIFY — restyle only if glass present]
apps/cockpit/src/components/ui/tabs.tsx                            [REFACTOR — tab bar + active underline]
apps/cockpit/src/app/cockpit.css                                   [VERIFY — token-var refs only; no explicit glass selectors to delete]

apps/website/lib/design-tokens.ts                                  [MODIFY in final commit — drop legacy re-exports]
apps/website/src/app/global.css                                    [MODIFY in final commit — drop legacy :root vars]

libs/ui-react/src/lib/glass-panel.tsx                              [DELETE in final commit — orphaned]
libs/ui-react/src/lib/glass-button.tsx                             [DELETE in final commit — orphaned]
libs/ui-react/src/lib/card.tsx                                     [DELETE in final commit — orphaned]
libs/ui-react/src/lib/code-group.tsx                               [DELETE in final commit — orphaned]
libs/ui-react/src/lib/callout.tsx                                  [DELETE in final commit — orphaned]
libs/ui-react/src/lib/steps.tsx                                    [DELETE in final commit — orphaned]
libs/ui-react/src/lib/tabs.tsx                                     [DELETE in final commit — orphaned]
libs/ui-react/src/lib/nav-link.tsx                                 [DELETE in final commit — orphaned]
libs/ui-react/src/lib/components.spec.tsx                          [DELETE in final commit — tests deleted components]
libs/ui-react/src/index.ts                                         [MODIFY in final commit — trim to cssVars + cn]
```

## Phasing

Three commits, each independently shippable:

| # | Scope | Verification |
|---|---|---|
| 8.1 | Extend `libs/ui-react/src/lib/css-vars.ts` with the Phase 1 token namespaces. No cockpit changes yet. | `pnpm nx test design-tokens` + `pnpm nx build ui-react` (or equivalent) + website e2e green. |
| 8.2 | Cockpit refactor: all 10+ component files + `layout.tsx` + `cockpit.css` verification. Active rail on sidebar nav, mode-switcher flat pill, code-mode container restyle. | `pnpm nx e2e cockpit` + `pnpm nx test cockpit` + website e2e all green. |
| 8.3 | Legacy token purge + orphan deletion: delete 9 orphaned files from `libs/ui-react`, trim its `index.ts` to `{cssVars, cn}`. Delete `libs/design-tokens` glass/gradients/glow files. Clean up tokens.ts, tokens.css, tokens.spec.ts, index.ts, cssVars, website re-export, website global.css. Bump @ngaf/design-tokens to 0.0.31. | Workspace-wide grep returns zero. All tests still green: `pnpm nx test design-tokens`, `pnpm nx test ui-react`, `pnpm nx e2e cockpit`, `pnpm nx e2e website`, `pnpm nx test cockpit`. |

## Verification

Each commit must pass before moving to the next. Combined acceptance at the end of Phase 8:

- `pnpm nx test design-tokens` — green (with the legacy-token assertions removed)
- `pnpm nx e2e cockpit` — green
- `pnpm nx test cockpit` — green
- `pnpm nx e2e website` — green (35 tests from Phase 7)
- Workspace grep: `grep -rln "tokens\.glass\|tokens\.gradient\|tokens\.glow\|--ds-glass\|--ds-gradient\|--ds-glow\|--glass-\|--gradient-bg-flow" apps libs --include="*.ts" --include="*.tsx" --include="*.css" 2>/dev/null | grep -v node_modules | grep -v ".next"` returns zero matches

Cockpit's `production-smoke.spec.ts` is intentionally skipped (it's in the `testIgnore` list and requires a deployed environment). Don't try to run it.

## Items requiring verification before implementation

- **`api-mode.tsx`** — verify glass usage during implementation; restyle only what's there. The grep at the start of Phase 8 will show any.
- **`narrative-docs.tsx` + `run-mode.tsx`** — verified clean in survey, but re-run grep during implementation to make sure.
- **`cockpit.css`** — survey showed no explicit glass selectors, only `var(--ds-*)` color refs. Re-verify; if any glass selectors exist, refactor.
- **`@ngaf/ui-react` `components.spec.tsx`** — confirmed to exist and asserts the deleted components render with `--ds-glass` classes. Delete entirely in commit 8.3 alongside the components.
- **Other unverified `@ngaf/ui-react` files** — `callout.tsx`, `steps.tsx`, `tabs.tsx`, `nav-link.tsx` are slated for deletion in commit 8.3 without verifying their glass usage individually (they're orphaned regardless). If by chance any of them turns out to be consumed by something the grep missed, the type-check will catch it and the implementer should escalate rather than guess.

## Open items (out of scope)

- Dark mode for cockpit — future.
- Cockpit IA changes (mode reordering, sidebar grouping rework) — future.
- Cockpit's `production-smoke.spec.ts` — already gated; no action.

## Post-Phase-8

After this phase ships, the multi-phase Statusbrew-inspired refactor is complete. Every surface — marketing pages, solutions, docs, cockpit — uses only the Phase 1 token namespaces. The `@ngaf/design-tokens` library is at 0.0.31 with a tighter, smaller surface.

Next areas to consider in future phases (not part of this work):
- Capture real product screenshots (currently placeholder content in marketing hero/feature blocks)
- Refactor the docs landing's "popular topics" to be data-driven rather than hand-curated
- Dark mode token system
- Real customer testimonials on `/pilot-to-prod`
