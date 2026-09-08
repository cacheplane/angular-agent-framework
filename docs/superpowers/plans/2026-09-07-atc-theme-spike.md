# ATC Theme Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Threadplane website to the ATC app's visual language — aviation yellow `#FFAF00`, scope navy `#15253E`, Archivo Black display type — by rethemeing `libs/design-tokens` and hand-tuning the nav, homepage hero and docs shell.

**Architecture:** The retheme happens in the token library, which is the source of truth; `apps/website` inherits it. The accent role splits: `--color-accent` becomes scope navy (the interactive ink) and `--color-accent-light` becomes the yellow (fill only), because `#FFAF00` on white is 1.84:1 and cannot be a text colour. The yellow hero is a new `Section surface="signal"` variant that re-scopes `--color-*` for its block — the same mechanism the existing `data-surface="dark"` band already uses. Diagrams are deliberately carved out onto a new `--font-diagram` token that keeps Inter, because their geometry is pinned to Inter's metrics by an e2e.

**Tech Stack:** Nx monorepo, TypeScript token sources compiled to CSS by a generator script, Next.js 15 App Router with `next/font/google`, Tailwind v4 `@theme`, Vitest for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-09-07-atc-theme-spike-design.md`

---

## Background an engineer needs before starting

**The token files are generated.** `libs/design-tokens/src/lib/tokens.css`, `tokens-dark.css` and `theme.css` all begin with "GENERATED FILE — DO NOT EDIT BY HAND". They are produced by `libs/design-tokens/scripts/generate-theme-css.ts` from the TypeScript sources (`base.ts`, `light.ts`, `dark.ts`, `typography.ts`, `shadows.ts`). Every colour change in this plan edits a `.ts` source and then runs the generator. If you edit a `.css` file directly, `ds-var-sources-agree.spec.ts` will fail and you will have wasted the time.

**Two naming conventions, one source.** The generator emits each token twice: `--color-*` / `--font-*` (Tailwind v4 `@theme`, consumed by `apps/website`) and `--ds-*` (plain custom properties, consumed by the Angular cockpit and example apps). `token-css-parity.spec.ts` asserts the first set matches the TS sources; `ds-var-sources-agree.spec.ts` asserts the `--ds-*` set agrees between `cssVars()` and `tokens.css`; `ds-var-contract.spec.ts` asserts no `--ds-*` name silently disappears.

**Three specs pin values this plan deliberately changes.** They are updated as part of the work, test-first: `css-vars.spec.ts`, `ds-var-contract.spec.ts`, `token-css-parity.spec.ts`. `tokens.spec.ts`, `theme.spec.ts`, `ds-var-sources-agree.spec.ts` and `generate-theme-css.spec.ts` were checked and hardcode none of the changed values — they should pass untouched, and if one fails you have broken something structural rather than merely changed a colour.

**Two e2e specs are load-bearing and are the reason several steps exist:**
- `apps/website/e2e/home-architecture.spec.ts` waits for `document.fonts.ready` then measures every text run in the homepage architecture diagram against its card. It is the gate proving the `--font-diagram` carve-out held. If it goes red, restore `--font-diagram` on the three declarations in Task 5 — **do not** adjust the diagram geometry.
- `apps/website/e2e/home-hero.spec.ts` exercises the hero demo iframe, which only loads when `HeroDemo.tsx:69`'s `IntersectionObserver` at `threshold: 0.25` fires. Adding vertical padding to the hero pushes that stage down the page. If it goes red, scroll the stage into view in the test — do not shrink the hero copy.

**`nx test website` does NOT type-check.** Vitest transpiles without checking
types, and React forwards an unknown prop string to the DOM happily — so a
test asserting a new union member passes BEFORE the union is extended. Any
step in this plan that says "watch it fail" on a type-level change is wrong as
written: get the real failure from `npx tsc --noEmit -p apps/website/tsconfig.json`
(add `--ignoreDeprecations 6.0`; that config has pre-existing unrelated errors,
so filter to the file you are working on), or from `npx nx build website`,
which type-checks because `next.config` sets no `ignoreBuildErrors`. Treat the
build as the real gate for anything type-level.

**Commands** (run from the worktree root, never `cd` elsewhere):
- Regenerate CSS: `npx nx run design-tokens:generate-theme-css`
- Token tests: `npx nx test design-tokens`
- Website unit tests: `npx nx test website`
- Website e2e: `npx nx e2e website`

---

## File Structure

**Token library — `libs/design-tokens/`**

| File | Responsibility | Change |
| --- | --- | --- |
| `src/lib/base.ts` | Theme-invariant brand identity | Add 5 ATC brand tokens; repoint `accent` / `accentLight` |
| `src/lib/light.ts` | Light-theme resolved roles | Accent family → navy ink + yellow tints; `textPrimary` → `#0A0A0A` |
| `src/lib/dark.ts` | Dark-theme resolved roles | Lines 29–33 only: blue tints → yellow |
| `src/lib/typography.ts` | Font families + type scale | `fontSerif`→`fontDisplay` (Archivo Black); `fontSans`→Archivo; add `fontDiagram` |
| `src/lib/shadows.ts` | Elevation + focus ring | `focus` → scope-navy tint |
| `src/lib/css-vars.ts` | `--ds-*` emitter (runtime fn) | Rename serif var; add the 5 brand vars + `--ds-font-diagram` |
| `scripts/generate-theme-css.ts` | Emits all three CSS files | Rename font vars; emit the 5 brand vars + diagram font |
| `src/lib/*.spec.ts` | The three value-pinning specs | Updated test-first |

**Website — `apps/website/`**

| File | Responsibility | Change |
| --- | --- | --- |
| `src/app/layout.tsx` | Loads fonts via `next/font` | Archivo Black + Archivo + Inter + JetBrains Mono; EB Garamond removed |
| `src/components/ui/Section.tsx` | Section surface variants | Add `'signal'` to the `Surface` union |
| `src/styles/ui.css` | UI primitives + surface scopes | Add `[data-surface="signal"]` scope; retint the dark scope |
| `src/styles/landing.css` | Hero + landing + arch diagram | Hero on the signal block; `marker-highlight` navy→yellow; `--font-diagram` carve-out |
| `src/styles/docs.css` | Docs shell + diagram kit | Active-item rule, callout rule, `--font-diagram` carve-out |
| `src/styles/chrome.css` | Nav | Yellow logo mark, yellow CTA |
| `src/components/landing/Hero.tsx` | Homepage hero | `surface="signal"` + trust strip |

---

## Task 1: Clear the stale build output

**Files:**
- Delete: `apps/website/.next/`

This worktree carries a 347 MB `.next` directory from earlier dev use. Turbopack panics on a stale root when a production build runs after a worktree has been used for dev, and the failure message points at the wrong thing entirely.

- [ ] **Step 1: Remove it**

```bash
rm -rf apps/website/.next
```

- [ ] **Step 2: Confirm it is gone**

```bash
test -d apps/website/.next && echo "STILL THERE" || echo "clean"
```

Expected: `clean`

No commit — `.next` is gitignored.

---

## Task 2: Brand and light-theme colour values

**Files:**
- Modify: `libs/design-tokens/src/lib/base.ts`
- Modify: `libs/design-tokens/src/lib/light.ts`
- Modify: `libs/design-tokens/src/lib/dark.ts:27-33`
- Modify: `libs/design-tokens/src/lib/shadows.ts`
- Test: `libs/design-tokens/src/lib/css-vars.spec.ts:12-14,16-18`

- [ ] **Step 1: Update the failing assertions in `css-vars.spec.ts`**

Replace the two `it` blocks inside `describe('light')`:

```typescript
    it('uses scope-navy accent as the interactive ink', () => {
      expect(vars['--ds-accent']).toBe('#15253E');
    });

    it('uses near-black text on light surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#0A0A0A');
    });
```

And add a new one directly after them, still inside `describe('light')`:

```typescript
    it('exposes aviation yellow as a fill-only signal, not as the ink', () => {
      expect(vars['--ds-accent-light']).toBe('#FFAF00');
      expect(vars['--ds-accent']).not.toBe(vars['--ds-accent-light']);
    });
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx nx test design-tokens
```

Expected: FAIL — `expected '#004090' to be '#15253E'`.

- [ ] **Step 3: Add the ATC brand tokens to `base.ts`**

Replace the `brand` block:

```typescript
  brand: Object.freeze({
    /** Scope navy — the ATC radar panel. The light-theme interactive ink. */
    accent: '#15253E',
    /**
     * Aviation yellow. Fill only: 1.84:1 on white, so it is never a text or
     * icon colour on a light surface. Doubles as the dark-theme accent, where
     * it reaches 8.33:1 — dark.ts derives its accent from this name.
     */
    accentLight: '#FFAF00',
    /** Aviation yellow, by its intended name. Same value as accentLight. */
    signal: '#FFAF00',
    /** Frequency-strip amber. Full-bleed data strips only. */
    signalStrong: '#FFB700',
    /** Scope navy — dark grounds and data strips. */
    scope: '#15253E',
    /** LIVE red-orange. 3.68:1, so status fills and large bold text only. */
    alert: '#FF3200',
    /** Near-black. Text on yellow, and the light-theme text primary. */
    ink: '#0A0A0A',
    /** Angular brand red — trademark colour, not ours to retheme */
    angularRed: '#DD0031',
    /** Render library green */
    renderGreen: '#1a7a40',
    /** Chat library purple */
    chatPurple: '#5a00c8',
  }),
```

- [ ] **Step 4: Update the accent family and text primary in `light.ts`**

Replace the `// Text` block's first line and the `// Semantic accent` block:

```typescript
  // Text
  textPrimary: '#0A0A0A',
```

```typescript
  // Semantic accent is the interactive INK (links, focus, borders) and stays
  // dark: aviation yellow is 1.84:1 on white and cannot carry text. The tints
  // below are backgrounds, so they carry the yellow instead — which is how
  // [data-ui="pill"][data-variant="accent"] already composes: yellow surface,
  // navy ink on top.
  accent: baseTokens.brand.accent,
  accentHover: '#0E1B2E',
  accentGlow: 'rgba(255, 175, 0, 0.28)',
  accentBorder: 'rgba(255, 175, 0, 0.35)',
  accentBorderHover: 'rgba(255, 175, 0, 0.55)',
  accentSurface: 'rgba(255, 175, 0, 0.10)',
```

- [ ] **Step 5: Repoint the focus ring in `shadows.ts`**

```typescript
  /**
   * Keyboard focus ring. Deliberately scope navy and NOT the signal yellow:
   * a yellow ring on a white page is 1.84:1 and effectively invisible.
   */
  focus: '0 0 0 3px rgba(21, 37, 62, 0.30)',
```

- [ ] **Step 6: Re-derive the dark theme's accent tints**

This is the likeliest silent bug in the whole change. `dark.ts:28` derives
`accent` as `baseTokens.brand.accentLight`, so it flips to yellow on its own
from Step 3 — but lines 29–33 hardcode the old blue. Left alone, the dark
accent turns yellow while its own hover and border tints stay blue, and
nothing fails.

In `libs/design-tokens/src/lib/dark.ts`, replace the accent block:

```typescript
  // Semantic accent maps to aviation yellow (8.33:1 on the dark ground).
  // `accent` derives from the brand token; the tints below must be re-derived
  // with it or they silently stay blue.
  accent: baseTokens.brand.accentLight,
  accentHover: '#ffc233',
  accentGlow: 'rgba(255, 175, 0, 0.25)',
  accentBorder: 'rgba(255, 175, 0, 0.22)',
  accentBorderHover: 'rgba(255, 175, 0, 0.4)',
  accentSurface: 'rgba(255, 175, 0, 0.1)',
```

Leave the surface and text values above it untouched: that file states they are
deliberately aligned to `@threadplane/chat` so embedded chat has no colour
seam, and the cockpit consumes them.

- [ ] **Step 7: Confirm no blue survives in the token sources**

```bash
grep -rn "64C3FD\|64c3fd\|8dd4ff\|100, 195, 253\|004090" libs/design-tokens/src/lib/*.ts || echo "clean"
```

Expected: `clean`

- [ ] **Step 8: Regenerate the CSS**

```bash
npx nx run design-tokens:generate-theme-css
```

- [ ] **Step 9: Run the tests**

```bash
npx nx test design-tokens
```

Expected: PASS. If `token-css-parity.spec.ts` fails complaining about `brand.signal` and friends having no CSS var, that is expected — Task 3 adds them. Note which names it lists and continue.

- [ ] **Step 10: Commit**

```bash
git add libs/design-tokens/src/lib/base.ts libs/design-tokens/src/lib/light.ts libs/design-tokens/src/lib/dark.ts libs/design-tokens/src/lib/shadows.ts libs/design-tokens/src/lib/css-vars.spec.ts libs/design-tokens/src/lib/tokens.css libs/design-tokens/src/lib/tokens-dark.css libs/design-tokens/src/lib/theme.css
git commit -m "feat(design-tokens): ATC palette — the accent role splits into navy ink and yellow signal"
```

---

## Task 3: Emit the new brand tokens through the generator

The five new brand entries exist in TypeScript but reach no stylesheet yet.

**Files:**
- Modify: `libs/design-tokens/scripts/generate-theme-css.ts` (the `/* Brand */` block near line 80, and the `--ds-*` brand lines near line 205)
- Modify: `libs/design-tokens/src/lib/css-vars.ts:49-52`
- Test: `libs/design-tokens/src/lib/token-css-parity.spec.ts:19-23`
- Test: `libs/design-tokens/src/lib/ds-var-contract.spec.ts`

- [ ] **Step 1: Add the parity-map entries**

In `token-css-parity.spec.ts`, extend the Brand block:

```typescript
  // Brand (theme-invariant)
  'brand.accent': '--color-accent',
  'brand.accentLight': '--color-accent-light',
  'brand.signal': '--color-signal',
  'brand.signalStrong': '--color-signal-strong',
  'brand.scope': '--color-scope',
  'brand.alert': '--color-alert',
  'brand.ink': '--color-ink',
  'brand.angularRed': '--color-angular-red',
```

- [ ] **Step 2: Add the contract entries**

In `ds-var-contract.spec.ts`, add to the name list, keeping it alphabetical alongside the existing `--ds-accent*` entries:

```typescript
  '--ds-alert',
  '--ds-ink',
  '--ds-scope',
  '--ds-signal',
  '--ds-signal-strong',
```

- [ ] **Step 3: Run and watch both fail**

```bash
npx nx test design-tokens
```

Expected: FAIL — parity reports the new `brand.*` leaves have no CSS var, and the contract reports the five `--ds-*` names are missing from `tokens.css`.

- [ ] **Step 4: Emit the Tailwind names**

In `generate-theme-css.ts`, extend the `/* Brand */` block:

```typescript
  lines.push(`  --color-accent-light: ${brand.accentLight};`);
  lines.push(`  --color-signal: ${brand.signal};`);
  lines.push(`  --color-signal-strong: ${brand.signalStrong};`);
  lines.push(`  --color-scope: ${brand.scope};`);
  lines.push(`  --color-alert: ${brand.alert};`);
  lines.push(`  --color-ink: ${brand.ink};`);
  lines.push(`  --color-angular-red: ${brand.angularRed};`);
```

- [ ] **Step 5: Emit the `--ds-*` names**

In the same file, extend the brand lines in the `--ds-*` section:

```typescript
  lines.push(`  --ds-signal: ${brand.signal};`);
  lines.push(`  --ds-signal-strong: ${brand.signalStrong};`);
  lines.push(`  --ds-scope: ${brand.scope};`);
  lines.push(`  --ds-alert: ${brand.alert};`);
  lines.push(`  --ds-ink: ${brand.ink};`);
  lines.push(`  --ds-angular-red: ${brand.angularRed};`);
```

- [ ] **Step 6: Add them to the runtime emitter**

In `css-vars.ts`, extend the "Raw brand colors (invariant)" block:

```typescript
    '--ds-accent-light': brand.accentLight,
    '--ds-signal': brand.signal,
    '--ds-signal-strong': brand.signalStrong,
    '--ds-scope': brand.scope,
    '--ds-alert': brand.alert,
    '--ds-ink': brand.ink,
    '--ds-angular-red': brand.angularRed,
```

- [ ] **Step 7: Regenerate and test**

```bash
npx nx run design-tokens:generate-theme-css && npx nx test design-tokens
```

Expected: PASS, all suites.

- [ ] **Step 8: Commit**

```bash
git add libs/design-tokens/
git commit -m "feat(design-tokens): emit signal, signal-strong, scope, alert and ink"
```

---

## Task 4: Typography values

**Files:**
- Modify: `libs/design-tokens/src/lib/typography.ts`
- Test: `libs/design-tokens/src/lib/css-vars.spec.ts` (the typography block at the end)

- [ ] **Step 1: Update the typography assertion**

Replace the final `it` block in `css-vars.spec.ts`:

```typescript
  it('typography tokens are identical across themes', () => {
    expect(cssVars('light')['--ds-font-display']).toBe(cssVars('dark')['--ds-font-display']);
    expect(cssVars('light')['--ds-font-sans']).toBe(cssVars('dark')['--ds-font-sans']);
    expect(cssVars('light')['--ds-font-diagram']).toBe(cssVars('dark')['--ds-font-diagram']);
  });

  it('keeps diagrams off the brand face', () => {
    // Diagram geometry is pinned to Inter's metrics by
    // apps/website/e2e/home-architecture.spec.ts. Archivo would change every
    // glyph width and silently overflow the cards.
    expect(cssVars('light')['--ds-font-diagram']).toContain('Inter');
    expect(cssVars('light')['--ds-font-sans']).not.toContain('Inter');
  });
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test design-tokens
```

Expected: FAIL — `--ds-font-display` and `--ds-font-diagram` are `undefined`.

- [ ] **Step 3: Update `typography.ts`**

Replace the doc comment's first three bullets and the three family constants:

```typescript
/**
 * - Display (Archivo Black): headlines and the wordmark. Single weight.
 * - Sans (Archivo): body text, UI elements
 * - Diagram (Inter): diagram text ONLY — see fontDiagram
 * - Mono (JetBrains Mono): code, labels, metadata
 */
```

```typescript
  /** Display face for headlines. Archivo Black ships one weight (400). */
  fontDisplay: '"Archivo Black", system-ui, sans-serif',
  /** Text and UI face. */
  fontSans: 'Archivo, system-ui, sans-serif',
  /**
   * Diagram text, deliberately NOT the brand face.
   *
   * Diagrams are information, not brand surface, and their geometry is tuned
   * to Inter's metrics: EnterpriseArchitecture.tsx pins every rectangle to an
   * 8px grid and home-architecture.spec.ts measures each rendered text run
   * against its card. Retyping diagrams would force a geometry rework larger
   * than the retheme itself.
   */
  fontDiagram: 'Inter, system-ui, sans-serif',
```

Then update `h1.family` and `h2.family` to `'var(--font-display)'`, and `h3` / `bodyLg` / `body` / `caption` `.family` to `'var(--font-sans)'`.

- [ ] **Step 4: Update the emitters**

In `css-vars.ts`, replace the Typography block:

```typescript
    // Typography (invariant)
    '--ds-font-display': typography.fontDisplay,
    '--ds-font-sans': typography.fontSans,
    '--ds-font-diagram': typography.fontDiagram,
    '--ds-font-mono': typography.fontMono,
```

In `generate-theme-css.ts`, replace the `/* Fonts */` block:

```typescript
  lines.push(`  --font-display: ${typography.fontDisplay};`);
  lines.push(`  --font-sans: ${typography.fontSans};`);
  lines.push(`  --font-diagram: ${typography.fontDiagram};`);
  lines.push(`  --font-mono: ${typography.fontMono};`);
```

and the `--ds-*` typography block:

```typescript
  lines.push(`  --ds-font-display: ${typography.fontDisplay};`);
  lines.push(`  --ds-font-sans: ${typography.fontSans};`);
  lines.push(`  --ds-font-diagram: ${typography.fontDiagram};`);
  lines.push(`  --ds-font-mono: ${typography.fontMono};`);
```

- [ ] **Step 5: Update the two remaining specs**

In `token-css-parity.spec.ts`, replace the Font families block:

```typescript
  // Font families
  'typography.fontDisplay': '--font-display',
  'typography.fontSans': '--font-sans',
  'typography.fontDiagram': '--font-diagram',
  'typography.fontMono': '--font-mono',
```

In `ds-var-contract.spec.ts`, replace `'--ds-font-serif',` with:

```typescript
  '--ds-font-diagram',
  '--ds-font-display',
```

- [ ] **Step 6: Regenerate and test**

```bash
npx nx run design-tokens:generate-theme-css && npx nx test design-tokens
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/design-tokens/
git commit -m "feat(design-tokens): Archivo display and text faces, Inter retained for diagrams"
```

---

## Task 5: Rename the font vars in consumers, with the diagram carve-out

The generator now emits `--font-display` / `--font-sans` / `--font-diagram`, but `apps/website` and `workspace-react` still reference `--font-garamond` and `--font-inter`, which no longer exist. **The site is visually broken between Task 4 and this task** — that is expected; do not stop to investigate it.

The carve-out and the rename land in **one commit**. A blind replacement sends the diagram rules to Archivo and breaks the overflow e2e, possibly only at 390px.

**Files:**
- Modify: `libs/workspace-react/src/styles/workspace.css:26`
- Modify: `apps/website/src/styles/*.css` (55 `--font-garamond`, 128 `--font-inter`)
- Modify (carve-out): `apps/website/src/styles/landing.css` `.arch-figure text`
- Modify (carve-out): `apps/website/src/styles/docs.css` `.tp-diagram-node[data-title="sans"] .tp-diagram-title` and `.tp-diagram-meta`

- [ ] **Step 1: Do the mechanical rename**

```bash
grep -rl -e '--font-garamond' -e '--font-inter' apps/website/src libs/workspace-react/src \
  | xargs sed -i '' -e 's/--font-garamond/--font-display/g' -e 's/--font-inter/--font-sans/g'
```

- [ ] **Step 2: Confirm no references survive**

```bash
grep -rn -e '--font-garamond' -e '--font-inter' apps/website/src libs/workspace-react/src || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Apply the diagram carve-out**

In `apps/website/src/styles/landing.css`, find `.arch-figure text` (a single blanket rule covering every text node in the architecture figure) and set:

```css
.arch-figure text {
  font-family: var(--font-diagram);
}
```

In `apps/website/src/styles/docs.css`, set both diagram-kit sans rules:

```css
.tp-diagram-node[data-title="sans"] .tp-diagram-title {
  font-family: var(--font-diagram);
}
```

```css
.tp-diagram-meta {
  font-family: var(--font-diagram);
}
```

Leave every diagram rule already on `var(--font-mono)` alone — mono was never Inter.

- [ ] **Step 3b: Record the next/font constraint in `ui.css`**

`ui.css`'s FONTS note explains that website font vars are supplied by
`next/font` on `<html>`, that those `<html>`-level values WIN over `theme.css`,
and that raw literals like `Inter, system-ui` never match because next/font
registers its family under a hashed name.

That makes `--font-diagram` fragile in a way nothing else records: the value
`theme.css` emits for it IS a raw `Inter, system-ui, sans-serif` stack, so if
`layout.tsx` ever stops defining `--font-diagram` via `next/font`, the
diagrams silently fall back to `system-ui`, every glyph width changes, and the
geometry this token exists to protect breaks. Between this task and Task 6
that is exactly the state the site is in.

Append to the FONTS comment block in `apps/website/src/styles/ui.css`:

```
 * --font-diagram is diagram-only and MUST keep being supplied by next/font in
 * layout.tsx. theme.css emits it as a raw `Inter, ...` stack, which next/font's
 * hashed family never matches — so if the loader is removed, diagrams silently
 * fall back to system-ui, every glyph width shifts, and
 * e2e/home-architecture.spec.ts (which measures text runs against their cards)
 * is the only thing that will notice.
```

- [ ] **Step 4: Verify the carve-out is exactly three declarations**

```bash
grep -rn "var(--font-diagram)" apps/website/src/styles/
```

Expected: exactly 3 lines — one in `landing.css`, two in `docs.css`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/styles libs/workspace-react/src/styles
git commit -m "refactor(website): --font-display/--font-sans, with diagrams carved out onto --font-diagram"
```

---

## Task 6: Load the new fonts

**Files:**
- Modify: `apps/website/src/app/layout.tsx:2,23-37,69`

- [ ] **Step 1: Replace the font imports and declarations**

```typescript
import { Archivo, Archivo_Black, Inter, JetBrains_Mono } from 'next/font/google';
```

```typescript
const display = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
});

const sans = Archivo({
  subsets: ['latin'],
  variable: '--font-sans',
});

/**
 * Inter is retained for diagrams only. Their geometry is pinned to Inter's
 * metrics by apps/website/e2e/home-architecture.spec.ts — see the token
 * comment on typography.fontDiagram.
 */
const diagram = Inter({
  subsets: ['latin'],
  variable: '--font-diagram',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});
```

- [ ] **Step 2: Update the `<html>` class list**

```tsx
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${diagram.variable} ${mono.variable}`}
    >
```

- [ ] **Step 3: Confirm EB Garamond is gone from the app**

```bash
grep -rn "Garamond" apps/website/src/app/layout.tsx || echo "clean"
```

Expected: `clean`. (`Garamond` still appears under `src/app/card/` and `scripts/generate-whitepaper.ts` — those are out of scope by design, see spec §7.)

- [ ] **Step 4: Run the website unit tests**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/layout.tsx
git commit -m "feat(website): load Archivo Black and Archivo, drop EB Garamond"
```

---

## Task 7: The signal surface variant

**Files:**
- Modify: `apps/website/src/components/ui/Section.tsx:4`
- Modify: `apps/website/src/styles/ui.css` (after the `[data-surface="dark"]` scope)
- Test: `apps/website/src/components/ui/Section.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add to `Section.spec.tsx`:

```tsx
  it('renders data-surface="signal" when asked', () => {
    const { container } = render(<Section surface="signal">x</Section>);
    const el = container.querySelector('[data-ui="section"]');
    expect(el?.getAttribute('data-surface')).toBe('signal');
  });
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — TypeScript rejects `"signal"` as not assignable to `Surface`.

- [ ] **Step 3: Extend the union**

In `Section.tsx`:

```typescript
type Surface = 'canvas' | 'tinted' | 'white' | 'dark' | 'signal';
```

- [ ] **Step 4: Add the CSS scope**

In `ui.css`, directly after the `[data-surface="dark"]` rule and its `::before` seam:

```css
/* Signal section scope (the ATC hero block).
 * Aviation yellow is a FILL: this scope flips the ink to near-black rather
 * than tinting the yellow, because #FFAF00 carries text at 1.84:1 on white
 * and 10.73:1 under #0A0A0A. Same re-scoping mechanism as the dark surface
 * above. */
[data-ui="section"][data-surface="signal"] {
  --color-canvas: var(--color-signal);
  --color-surface: var(--color-signal);
  --color-surface-tinted: var(--color-signal-strong);
  --color-border: rgba(10, 10, 10, 0.18);
  --color-border-strong: rgba(10, 10, 10, 0.32);
  --color-text-primary: var(--color-ink);
  --color-text-secondary: rgba(10, 10, 10, 0.78);
  --color-text-muted: rgba(10, 10, 10, 0.6);
  --color-text-inverted: var(--color-signal);
  --color-accent: var(--color-ink);
  --color-accent-hover: #000000;
  --color-accent-surface: rgba(10, 10, 10, 0.08);
  --color-accent-border: rgba(10, 10, 10, 0.25);
  --shadow-focus: 0 0 0 3px rgba(10, 10, 10, 0.45);

  background: var(--color-signal);
  color: var(--color-text-primary);
}
```

- [ ] **Step 5: Run the test**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/ui/Section.tsx apps/website/src/components/ui/Section.spec.tsx apps/website/src/styles/ui.css
git commit -m "feat(website): signal surface scope for the ATC hero block"
```

---

## Task 8: The yellow hero and its data strip

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx:31,63`
- Modify: `apps/website/src/styles/landing.css` (`.hero-heading`, `.marker-highlight`, `.hero-trust`)

- [ ] **Step 1: Put the hero on the signal surface**

In `Hero.tsx`, change the opening `Section`:

```tsx
    <Section surface="signal" ariaLabelledBy="hero-heading">
```

- [ ] **Step 2: Turn the trust line into the frequency strip**

Replace the `<p className="hero-trust">` line:

```tsx
          <p className="hero-trust hero-strip">{HERO_TRUST_LINE}</p>
```

- [ ] **Step 3: Restyle the heading for the display face**

In `landing.css`, replace the `.hero-heading` rule's family, weight and tracking:

```css
.hero-heading {
  font-family: var(--font-display);
  font-size: var(--text-h1);
  line-height: var(--text-h1--line-height);
  font-weight: 400; /* Archivo Black ships a single weight */
  color: var(--color-text-primary);
  margin: 0;
  margin-bottom: 24px;
  letter-spacing: -0.032em;
}
```

- [ ] **Step 4: Move the marker highlight off hardcoded navy**

`.marker-highlight` hardcodes `rgba(0, 64, 144, …)`, which no token change reaches. On the yellow block a yellow highlight is invisible, so it becomes a solid ink underline:

```css
.marker-highlight {
  color: var(--color-text-primary);
  font-weight: 700;
  background: none;
  box-shadow: inset 0 -3px 0 var(--color-accent);
  border-radius: 0;
  padding: 1px 2px 3px;
  margin: -1px -2px -3px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
```

- [ ] **Step 5: Style the strip**

Append to `landing.css`:

```css
/* The frequency strip — the ATC player's bottom bar. Full-bleed scope navy
 * closing the yellow block, set in mono because the instrument-panel cue is
 * doing as much work here as the colour is. */
.hero-strip {
  margin: 32px calc(50% - 50vw) 0;
  width: 100vw;
  padding: 10px var(--spacing-container-x);
  background: var(--color-scope);
  color: #ffffff;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
}
```

- [ ] **Step 6: Run the unit tests**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): yellow hero block closed by the scope-navy frequency strip"
```

---

## Task 9: Nav and the dark band

**Files:**
- Modify: `apps/website/src/styles/chrome.css` (logo mark, nav CTA)
- Modify: `apps/website/src/styles/ui.css` (`[data-surface="dark"]` scope)

- [ ] **Step 1: Retint the dark band onto scope navy**

In `ui.css`, inside `[data-ui="section"][data-surface="dark"]`, replace the six accent lines and the `background`:

```css
  --color-accent: var(--color-signal);
  --color-accent-hover: #ffc233;
  --color-accent-glow: rgba(255, 175, 0, 0.25);
  --color-accent-border: rgba(255, 175, 0, 0.22);
  --color-accent-border-hover: rgba(255, 175, 0, 0.4);
  --color-accent-surface: rgba(255, 175, 0, 0.1);

  background: linear-gradient(180deg, #1b2e4d 0%, #15253e 100%);
```

Then change the `::before` seam gradient from `rgba(100, 195, 253, 0.55)` to `rgba(255, 175, 0, 0.55)` at both stops.

- [ ] **Step 1b: Correct the comment above that rule**

The rule's existing comment says its values mirror `dark.ts` and to update it
when `dark.ts` changes. That is now only half true — the accents still mirror,
but the surfaces deliberately do not. Leaving the comment would send the next
person to make the library dark theme navy, which would put a colour seam in
embedded chat. Replace it:

```css
/* Dark section scope (homepage proof band + FinalCTA dark variant).
 * The ACCENTS mirror libs/design-tokens/src/lib/dark.ts. The SURFACES
 * deliberately do not: this band is website-only and takes the ATC scope
 * navy, while dark.ts stays neutral because @threadplane/chat and the cockpit
 * consume it and a navy ground there would seam against embedded chat.
 * Treatment B (spec): vertical gradient canvas, 1px accent seam at the
 * light→dark boundary. */

- [ ] **Step 2: Give the nav its yellow mark**

The nav keeps a white ground — yellow reads as a band, not as chrome.

`PlaneMark` is an inline SVG whose path is `fill="currentColor"`, and
`ui.css:328` currently sets `[data-ui="logo-mark-icon"] { color: inherit; }`.
So the mark takes the signal through `color`, not `background` or `fill`.
Replace that rule in `apps/website/src/styles/ui.css`:

```css
[data-ui="logo-mark-icon"] {
  display: block;
  flex: none;
  /* PlaneMark's path is fill="currentColor", so the signal arrives via color.
     The wordmark beside it keeps --color-text-primary. */
  color: var(--color-signal);
}
```

On the yellow hero block that would be yellow-on-yellow, so pin it back inside
the signal scope. Append to the `[data-ui="section"][data-surface="signal"]`
rule added in Task 7:

```css
[data-ui="section"][data-surface="signal"] [data-ui="logo-mark-icon"] {
  color: var(--color-ink);
}
```

- [ ] **Step 3: Run the unit tests**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/chrome.css apps/website/src/styles/ui.css
git commit -m "feat(website): yellow nav mark and a scope-navy dark band"
```

---

## Task 10: Docs shell

Yellow is reduced to rules. Docs stay a document.

**Files:**
- Modify: `apps/website/src/styles/docs.css` (the hardcoded `#004090` at ~line 1697, the active sidebar item, the callout rule)

- [ ] **Step 1: Find the hardcoded navy**

```bash
grep -n "004090" apps/website/src/styles/docs.css
```

- [ ] **Step 2: Replace it with the token**

Change `color: #004090;` to:

```css
  color: var(--color-accent);
```

- [ ] **Step 3: Turn the active-item fill into a signal rule**

The active rule already exists at `docs.css:917` as
`[data-docs-navlink][data-active]` — every sidebar link carries both
attributes. It currently fills with `--color-accent-surface`, which is now a
yellow tint; a rule reads better than a wash and matches the surface
discipline in spec §6. Replace it:

```css
[data-docs-navlink][data-active] {
  color: var(--color-text-primary);
  background: none;
  border-left: 3px solid var(--color-signal);
  padding-left: 9px;
  margin-left: -12px;
  font-weight: 700;
}
```

- [ ] **Step 4: Run the unit tests**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/styles/docs.css
git commit -m "feat(website): docs shell takes the signal as a rule, not a fill"
```

---

## Task 11: Sweep the remaining hardcoded brand colours

Added after Task 2's review found that the plan named only 3 of the 24
hardcoded old-brand sites in `apps/website/src`. The rest would have survived
the retheme as blue islands.

**Files:**
- Modify: `apps/website/src/styles/landing.css` (lines ~631, 945, 1027, 1046)
- Modify: `apps/website/src/styles/docs.css` (lines ~334, 1623, 1696)
- Modify: `apps/website/src/styles/ui.css` (comments at ~252, 258)
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx:25`
- Modify: `apps/website/src/styles/style-contracts.spec.ts:239` (comment prose only)

- [ ] **Step 1: List what is left**

```bash
grep -rn "004090\|0, 64, 144\|64c3fd\|64C3FD\|100, 195, 253" apps/website/src --include="*.css" --include="*.tsx" --include="*.ts"
```

Tasks 8, 9 and 10 should already have cleared `landing.css:49-50`,
`ui.css:176-199` and `docs.css:1697`. Everything still listed is this task.

- [ ] **Step 2: Replace the light-surface tints**

These are all backgrounds, so they take the yellow. Replace the colour only,
keeping each rule's existing alpha:

- `docs.css` `--callout-tone-surface: rgba(0, 64, 144, 0.06)` → `rgba(255, 175, 0, 0.10)`
- `docs.css` `background: rgba(0, 64, 144, 0.1)` → `rgba(255, 175, 0, 0.14)`
- `docs.css` `background: rgba(0, 64, 144, 0.08)` → `rgba(255, 175, 0, 0.12)`
- `landing.css` `background: rgba(0, 64, 144, 0.04)` → `rgba(255, 175, 0, 0.08)`

The yellow alphas are raised slightly because `#FFAF00` is a much lighter
colour than `#004090`; at the original alpha the tint is invisible on white.

- [ ] **Step 3: Replace the dark-surface gradients**

`landing.css` lines ~631, ~1027 and ~1046 are decorative gradients sitting on
dark surfaces, currently `rgba(100, 195, 253, …)`. Swap the triple to
`255, 175, 0`, keeping every alpha exactly as-is.

- [ ] **Step 4: The one that must NOT become yellow**

`ChatLandingCodeShowcase.tsx:25` is `--chat-user-bg: #004090`, and line 26 is
`--chat-user-color: #ffffff`. White on aviation yellow is **1.84:1**. This one
takes the scope navy so the pairing keeps working:

```
  --chat-user-bg: #15253E;
```

(It is a string inside a displayed code snippet, so it teaches the palette to
readers rather than styling anything — which is exactly why it should not
teach an inaccessible pairing.)

- [ ] **Step 5: Correct the two comments that now describe the old palette**

`ui.css` ~252 and ~258 explain the focus ring in terms of `#004090` and
`#64c3fd`. Rewrite them for the current palette: the primary button's fill is
now the signal yellow, the ring is scope navy on light, and the dark scope
re-points the accent to yellow. `style-contracts.spec.ts:239`'s `why:` string
makes the same stale claim — update the prose. Do not change the assertion.

- [ ] **Step 6: Confirm the sweep is complete**

```bash
grep -rn "004090\|0, 64, 144\|64c3fd\|64C3FD\|100, 195, 253" apps/website/src --include="*.css" --include="*.tsx" --include="*.ts"
```

Expected: no results. `apps/website/src/app/icon.svg` still contains `#004090`
and that is correct — the favicon is out of scope per spec §7.

- [ ] **Step 7: Test and commit**

```bash
npx nx test website
```

Expected: PASS.

```bash
git add apps/website/src
git commit -m "fix(website): sweep the last hardcoded navy out of the light and dark surfaces"
```

---

## Task 12: Verification

No code. This is where the two load-bearing e2e specs get their say.

- [ ] **Step 1: Full unit suites**

```bash
npx nx test design-tokens && npx nx test website
```

Expected: PASS both.

- [ ] **Step 2: The diagram carve-out gate**

```bash
npx nx e2e website -- --grep "architecture"
```

Expected: PASS **unchanged**. If it fails, the rename swept the diagram rules into Archivo — restore `var(--font-diagram)` on the three declarations from Task 5. Do **not** adjust the diagram geometry; that bakes Archivo's metrics into the data module and makes the problem permanent.

- [ ] **Step 3: The hero demo gate**

```bash
npx nx e2e website -- --grep "hero"
```

Expected: PASS. If the demo iframe never loads, the yellow block's padding pushed the stage past `HeroDemo.tsx:69`'s `threshold: 0.25`. Fix by scrolling the stage into view in the test — not by shrinking the hero copy.

- [ ] **Step 4: Full e2e**

```bash
npx nx e2e website
```

Expected: PASS.

- [ ] **Step 5: Look at it**

Start the dev server through the Browser pane preview tools (never `npm run dev` via Bash), then check `/` and a docs page at desktop width and at 390px. Confirm by reading the rendered page, not by assuming:
- the hero yellow ends at the strip and does not bleed into the section below
- the nav CTA is black-on-yellow, not white-on-yellow
- docs body text is Archivo and diagram text is still Inter
- the focus ring is visible when tabbing to the hero's primary button

- [ ] **Step 6: Contrast check from the rendered page**

In the Browser pane console, sample the computed values rather than trusting the plan's table:

```javascript
const el = document.querySelector('.hero-heading');
getComputedStyle(el).color + ' on ' + getComputedStyle(el.closest('[data-surface]')).backgroundColor
```

Expected: `rgb(10, 10, 10)` on `rgb(255, 175, 0)`.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): ATC theme verification pass"
```

---

## Out of scope — do not fix these

Per spec §7, these keep navy and EB Garamond and **will visibly diverge**. Leaving them is the plan working correctly:

- `apps/website/src/app/card/` **fonts only** — the bundled `EBGaramond-Bold.ttf` that `card.spec.ts` asserts by filename. The card's *colours* are NOT out of scope: `card.spec.ts` compares `card/tokens.ts` against `theme.css` at test time, so they move with the retheme (handled in Task 2)
- `apps/website/src/app/opengraph-image.tsx` and `blog/[slug]/opengraph-image.tsx`
- `apps/website/scripts/generate-whitepaper.ts`
- `apps/website/src/app/icon.svg` — the favicon stays navy
- The cockpit and example apps — they inherit the new `--ds-*` values but are not visually reviewed here
- Marketing pages other than home — they inherit tokens and fonts automatically; they get a look during Task 11 Step 5 but no hand-tuning
