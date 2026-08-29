# Design Token CSS-Var Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every design token the website consumes reachable from CSS at a value identical to its JS counterpart, verified by a test rather than assumed.

**Architecture:** `libs/design-tokens` generates `theme.css` from TypeScript token sources via a committed generator with a drift guard. That generator currently emits only colors, fonts, radii, and shadows. We extend it to also emit the type scale (as Tailwind v4 composite `--text-*` tokens) and the space scale, bring the orphaned `tokens.css` under the same generator so it can no longer drift, and add a parity spec that walks the token tree and fails if any leaf lacks a CSS counterpart or is not explicitly excluded. Finally we replace the hardcoded color literals in the website's `global.css`.

**Tech Stack:** TypeScript, Node `tsx` scripts, Vitest, Nx, Tailwind CSS v4 (`@theme`), Next.js 16.

**Spec:** `docs/superpowers/specs/2026-08-29-design-token-css-var-completion-design.md`
**Findings this unblocks:** `docs/superpowers/audits/2026-08-29-docs-visual-review-findings.md`

---

## Context an engineer needs before starting

**This library has an unusual guard you must not fight.** `theme.css` is a
*generated, committed* file. `generate-theme-css.spec.ts` re-runs the generator
in-process and asserts the output is byte-identical to the committed file. So
the loop for any generator change is always:

1. Edit `scripts/generate-theme-css.ts`.
2. Run `npx nx run design-tokens:generate-theme-css` to rewrite the committed CSS.
3. Run the tests.

If you hand-edit `theme.css`, the drift guard goes red and the fix is to
regenerate, never to edit the guard.

**Commands.** Run everything from the workspace root.

- Library tests: `npx nx test design-tokens`
- A single spec: `cd libs/design-tokens && npx vitest run src/lib/<name>.spec.ts --config vite.config.mts`
  — **must run from the library directory.** The config's `include` is
  `src/**/*.spec.ts`, resolved against the config's own root, so invoking it
  from the workspace root reports "No test files found" and exits 1, which
  reads like a broken spec but is a wrong cwd.
- Regenerate CSS: `npx nx run design-tokens:generate-theme-css`
- Website tests: `cd apps/website && npx vitest run --config vite.config.mts`
  — **the website has no `nx test` target**; `nx test website` fails, and 20+
  specs silently stopped running once because of it. Never use it.
- Website dev server: use the Browser pane / `preview_start` with the
  `website-dev` entry in `.claude/launch.json`. Never `npm run dev` in Bash.

**Values you will need.** These are the current TS sources; the generator reads
them, you should not retype them into CSS by hand.

```ts
// libs/design-tokens/src/lib/typography.ts (excerpt)
h1:      { size: 'clamp(48px, 6vw, 72px)',  line: 1.08, family: 'var(--font-garamond)' }
h2:      { size: 'clamp(36px, 4.5vw, 56px)', line: 1.12, family: 'var(--font-garamond)' }
h3:      { size: '28px', line: 1.25, family: 'var(--font-inter)', weight: 600 }
eyebrow: { size: '12px', line: 1.4, family: 'var(--font-mono)', weight: 700,
           letterSpacing: '0.12em', transform: 'uppercase' }
bodyLg:  { size: '20px', line: 1.6, family: 'var(--font-inter)' }
body:    { size: '16px', line: 1.6, family: 'var(--font-inter)' }
caption: { size: '14px', line: 1.5, family: 'var(--font-inter)' }

// libs/design-tokens/src/lib/space.ts
sectionY: 'clamp(64px, 8vw, 120px)'   sectionYTight: 'clamp(48px, 6vw, 80px)'
containerX: 'clamp(20px, 4vw, 40px)'  containerMax: '1200px'
```

---

## File Structure

| File | Responsibility |
|---|---|
| `libs/design-tokens/scripts/generate-theme-css.ts` | Modify. Owns *both* generated stylesheets. The type and space scales are appended inside the existing `buildThemeBlock()`; `tokens.css` gets its own `buildTokensBlock()` + exported `generateTokensCss()`. |
| `libs/design-tokens/src/lib/theme.css` | Regenerated. Tailwind `@theme` block. |
| `libs/design-tokens/src/lib/tokens.css` | Regenerated. Plain `:root { --ds-* }` for non-Tailwind consumers. |
| `libs/design-tokens/src/lib/generate-theme-css.spec.ts` | Modify. Drift guard — extended to cover `tokens.css`. |
| `libs/design-tokens/src/lib/ds-var-contract.spec.ts` | Create. Asserts the `--ds-*` names consumers reference never disappear. |
| `libs/design-tokens/src/lib/token-css-parity.spec.ts` | Create. The load-bearing guard: every token leaf has a CSS var of identical value, or is explicitly excluded. |
| `libs/design-tokens/package.json` | Modify. Export `./tokens.css`. |
| `libs/design-tokens/project.json` | Modify. Copy `tokens.css` in the build `assets`. |
| `apps/website/src/app/global.css` | Modify. Replace 18 hardcoded literals across three categories. |

The two new specs are separate files on purpose: they guard different
contracts (JS↔CSS value parity vs. consumer-facing var-name stability) and
should be able to fail independently with a clear message.

---

## Task 1: Parity spec — the guard that makes Project 2 safe

This is the load-bearing deliverable. Write it first, watch it go red for the
right reason, then make it green in Tasks 2 and 3.

**Files:**
- Create: `libs/design-tokens/src/lib/token-css-parity.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/design-tokens/src/lib/token-css-parity.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { tokens } from './tokens';

const THEME_CSS = resolve(__dirname, 'theme.css');

/**
 * Every leaf in the `tokens` tree must either map to a CSS custom property in
 * theme.css (holding an identical value) or appear in EXCLUDED with a reason.
 *
 * This is the premise the inline-style migration rests on: `tokens.X.Y` and
 * `var(--z)` are interchangeable. Do not weaken this test to make a new token
 * pass — add the token to the generator, or exclude it here with a comment
 * saying why it can never have a var.
 */
const CSS_VAR_BY_PATH: Record<string, string> = {
  // Brand (theme-invariant)
  'brand.accent': '--color-accent',
  'brand.accentLight': '--color-accent-light',
  'brand.angularRed': '--color-angular-red',
  'brand.renderGreen': '--color-render-green',
  'brand.chatPurple': '--color-chat-purple',

  // Font families
  'typography.fontSerif': '--font-garamond',
  'typography.fontSans': '--font-inter',
  'typography.fontMono': '--font-mono',

  // Type scale — size
  'typography.h1.size': '--text-h1',
  'typography.h2.size': '--text-h2',
  'typography.h3.size': '--text-h3',
  'typography.eyebrow.size': '--text-eyebrow',
  'typography.bodyLg.size': '--text-body-lg',
  'typography.body.size': '--text-body',
  'typography.caption.size': '--text-caption',

  // Type scale — line height
  'typography.h1.line': '--text-h1--line-height',
  'typography.h2.line': '--text-h2--line-height',
  'typography.h3.line': '--text-h3--line-height',
  'typography.eyebrow.line': '--text-eyebrow--line-height',
  'typography.bodyLg.line': '--text-body-lg--line-height',
  'typography.body.line': '--text-body--line-height',
  'typography.caption.line': '--text-caption--line-height',

  // Type scale — weight / tracking
  'typography.h3.weight': '--text-h3--font-weight',
  'typography.eyebrow.weight': '--text-eyebrow--font-weight',
  'typography.eyebrow.letterSpacing': '--text-eyebrow--letter-spacing',

  // Space scale
  'space.sectionY': '--spacing-section-y',
  'space.sectionYTight': '--spacing-section-y-tight',
  'space.containerX': '--spacing-container-x',
  'space.containerMax': '--container-page',

  // Radii
  'radius.sm': '--radius-sm',
  'radius.md': '--radius-md',
  'radius.lg': '--radius-lg',
  'radius.xl': '--radius-xl',
  'radius.full': '--radius-full',

  // Shadows
  'shadows.sm': '--shadow-sm',
  'shadows.md': '--shadow-md',
  'shadows.lg': '--shadow-lg',
  'shadows.focus': '--shadow-focus',

  // Light-resolved colour aliases (what the website actually imports)
  'colors.accent': '--color-accent',
  'colors.accentLight': '--color-accent-light',
  'colors.angularRed': '--color-angular-red',
  'colors.renderGreen': '--color-render-green',
  'colors.chatPurple': '--color-chat-purple',
  'colors.bg': '--color-bg',
  'colors.accentHover': '--color-accent-hover',
  'colors.accentGlow': '--color-accent-glow',
  'colors.accentBorder': '--color-accent-border',
  'colors.accentBorderHover': '--color-accent-border-hover',
  'colors.accentSurface': '--color-accent-surface',
  'colors.textInverted': '--color-text-inverted',
  'colors.textPrimary': '--color-text-primary',
  'colors.textSecondary': '--color-text-secondary',
  'colors.textMuted': '--color-text-muted',
  'colors.sidebarBg': '--color-sidebar-bg',

  // Light-resolved surface aliases
  'surfaces.canvas': '--color-canvas',
  'surfaces.surface': '--color-surface',
  'surfaces.surfaceTinted': '--color-surface-tinted',
  'surfaces.surfaceDim': '--color-surface-dim',
  'surfaces.border': '--color-border',
  'surfaces.borderStrong': '--color-border-strong',
};

/** Leaves that intentionally have no CSS var, with the reason. */
const EXCLUDED: ReadonlyArray<{ prefix: string; why: string }> = [
  {
    prefix: 'typography.h1.family',
    why: 'value is already `var(--font-garamond)` — a var about a var buys nothing',
  },
  { prefix: 'typography.h2.family', why: 'see h1.family' },
  { prefix: 'typography.h3.family', why: 'see h1.family' },
  { prefix: 'typography.eyebrow.family', why: 'see h1.family' },
  { prefix: 'typography.bodyLg.family', why: 'see h1.family' },
  { prefix: 'typography.body.family', why: 'see h1.family' },
  { prefix: 'typography.caption.family', why: 'see h1.family' },
  {
    prefix: 'typography.eyebrow.transform',
    why: 'plain `text-transform: uppercase` keyword; Tailwind --text-* has no transform sub-key',
  },
  {
    prefix: 'light.',
    why: 'theme-resolution source; consumed via the colors/surfaces aliases which are mapped',
  },
  { prefix: 'dark.', why: 'dark theme is not emitted — the website is light-only' },
];

function parseCssVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** Flatten the frozen token tree to `dotted.path -> primitive value`. */
function flatten(node: unknown, prefix = ''): Array<[string, string]> {
  if (node === null || typeof node !== 'object') {
    return [[prefix, String(node)]];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

const leaves = flatten(tokens);
const cssVars = parseCssVars(readFileSync(THEME_CSS, 'utf-8'));
const isExcluded = (path: string) =>
  EXCLUDED.some((e) => path === e.prefix || path.startsWith(e.prefix));

describe('token ↔ CSS var parity', () => {
  it('finds a non-trivial number of token leaves (guards against a walker that visits nothing)', () => {
    expect(leaves.length).toBeGreaterThan(60);
  });

  it('parses a non-trivial number of vars from theme.css', () => {
    expect(Object.keys(cssVars).length).toBeGreaterThan(30);
  });

  it('maps or explicitly excludes every token leaf', () => {
    const unaccounted = leaves
      .map(([path]) => path)
      .filter((path) => !CSS_VAR_BY_PATH[path] && !isExcluded(path));
    expect(unaccounted).toEqual([]);
  });

  it.each(Object.entries(CSS_VAR_BY_PATH))(
    '%s has an identical value in theme.css as %s',
    (path, varName) => {
      const leaf = leaves.find(([p]) => p === path);
      if (!leaf) throw new Error(`token path ${path} does not exist`);
      expect(cssVars[varName], `${varName} missing from theme.css`).toBeDefined();
      expect(cssVars[varName]).toBe(leaf[1]);
    },
  );
});
```

- [ ] **Step 2: Run the test and verify it fails for the right reason**

Run:

```bash
cd libs/design-tokens && npx vitest run src/lib/token-css-parity.spec.ts --config vite.config.mts; cd -
```

Expected: FAIL. Specifically the `--text-*`, `--spacing-*`, and `--container-page`
cases fail with `... missing from theme.css`, and the "maps or explicitly
excludes" case passes (every leaf is accounted for in the map, the vars just do
not exist yet).

If instead you see failures on `--color-*` or `--radius-*` cases, stop — that
means the existing generator disagrees with the TS sources and you have found a
pre-existing bug that must be understood before continuing.

- [ ] **Step 3: Commit the red test**

```bash
git add libs/design-tokens/src/lib/token-css-parity.spec.ts
git commit -m "test(design-tokens): assert token↔CSS-var parity (red — type and space scales unemitted)"
```

---

## Task 2: Emit the type scale

**Files:**
- Modify: `libs/design-tokens/scripts/generate-theme-css.ts`
- Regenerate: `libs/design-tokens/src/lib/theme.css`

- [ ] **Step 1: Add the type-scale block to the generator**

In `buildThemeBlock()`, immediately after the `/* Fonts */` block (the three
`--font-*` lines) and before `/* Radii */`, insert:

```ts
  // Type scale — Tailwind v4 composite text tokens.
  //
  // `--text-{name}` plus the optional `--line-height` / `--font-weight` /
  // `--letter-spacing` sub-keys collapse a whole type step into a single
  // `text-{name}` utility, which is an exact structural match for the
  // composite objects in typography.ts.
  //
  // `family` is deliberately not emitted: those values are already
  // `var(--font-garamond)` and friends, and Tailwind's --text-* bundle has no
  // font-family sub-key. `eyebrow.transform` is likewise a plain
  // `text-transform` keyword, not a token. Both are excluded in
  // token-css-parity.spec.ts with that reasoning.
  lines.push('');
  lines.push('  /* Type scale */');
  const typeSteps = [
    ['h1', typography.h1],
    ['h2', typography.h2],
    ['h3', typography.h3],
    ['eyebrow', typography.eyebrow],
    ['body-lg', typography.bodyLg],
    ['body', typography.body],
    ['caption', typography.caption],
  ] as const;
  for (const [name, step] of typeSteps) {
    lines.push(`  --text-${name}: ${step.size};`);
    lines.push(`  --text-${name}--line-height: ${step.line};`);
    if ('weight' in step) {
      lines.push(`  --text-${name}--font-weight: ${step.weight};`);
    }
    if ('letterSpacing' in step) {
      lines.push(`  --text-${name}--letter-spacing: ${step.letterSpacing};`);
    }
  }
```

`typography` is already destructured from `baseTokens` at the top of
`buildThemeBlock()` — no import change needed.

- [ ] **Step 2: Regenerate theme.css**

```bash
npx nx run design-tokens:generate-theme-css
```

Expected output: `wrote /…/libs/design-tokens/src/lib/theme.css`

- [ ] **Step 3: Eyeball the generated block**

```bash
sed -n '/Type scale/,/Radii/p' libs/design-tokens/src/lib/theme.css
```

Expected to include exactly these, among others:

```css
  --text-h1: clamp(48px, 6vw, 72px);
  --text-h1--line-height: 1.08;
  --text-h3--font-weight: 600;
  --text-eyebrow--letter-spacing: 0.12em;
  --text-body-lg: 20px;
```

No `--text-*--font-family` and no `--text-eyebrow--text-transform` lines. If
either is present, remove the code that emitted it.

- [ ] **Step 4: Run the parity spec**

```bash
cd libs/design-tokens && npx vitest run src/lib/token-css-parity.spec.ts --config vite.config.mts; cd -
```

Expected: all `--text-*` cases now PASS. The four space-scale cases
(`--spacing-section-y`, `--spacing-section-y-tight`, `--spacing-container-x`,
`--container-page`) still FAIL — that is Task 3.

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/scripts/generate-theme-css.ts libs/design-tokens/src/lib/theme.css
git commit -m "feat(design-tokens): emit the type scale as Tailwind v4 composite text tokens"
```

---

## Task 3: Emit the space scale

**Files:**
- Modify: `libs/design-tokens/scripts/generate-theme-css.ts`
- Regenerate: `libs/design-tokens/src/lib/theme.css`

- [ ] **Step 1: Destructure `space` from baseTokens**

At the top of `buildThemeBlock()`, change:

```ts
  const { typography, radius, shadows, brand } = baseTokens;
```

to:

```ts
  const { typography, space, radius, shadows, brand } = baseTokens;
```

- [ ] **Step 2: Add the space-scale block**

After the `/* Shadows */` block and before the closing `lines.push('}')`,
insert:

```ts
  // Space scale.
  //
  // `containerMax` goes to the --container-* namespace, not --spacing-*,
  // because it is a max-width rather than a spacing step.
  //
  // Tailwind strips the namespace prefix when naming the utility, so
  // `--container-page` generates `max-w-page` (NOT `max-w-container-page`).
  // Verified in a browser: `max-w-page` computes to 1200px. `--spacing-*`
  // behaves the same way — `--spacing-section-y` gives `p-section-y`.
  lines.push('');
  lines.push('  /* Space scale */');
  lines.push(`  --spacing-section-y: ${space.sectionY};`);
  lines.push(`  --spacing-section-y-tight: ${space.sectionYTight};`);
  lines.push(`  --spacing-container-x: ${space.containerX};`);
  lines.push(`  --container-page: ${space.containerMax};`);
```

- [ ] **Step 3: Regenerate and run the full library suite**

```bash
npx nx run design-tokens:generate-theme-css && npx nx test design-tokens
```

Expected: PASS, including `generate-theme-css` (the drift guard, because you
regenerated) and every case in `token-css-parity`.

- [ ] **Step 4: Mutation-test the parity guard**

The parity spec fails silently if written wrong, so prove it bites. Temporarily
break one value:

```bash
sed -i '' "s/sectionY: 'clamp(64px, 8vw, 120px)'/sectionY: 'clamp(64px, 8vw, 999px)'/" libs/design-tokens/src/lib/space.ts
cd libs/design-tokens && npx vitest run src/lib/token-css-parity.spec.ts --config vite.config.mts; cd -
```

Expected: FAIL on `space.sectionY has an identical value in theme.css as
--spacing-section-y`. If it PASSES, the guard is vacuous — fix it before going
further.

Revert:

```bash
git checkout -- libs/design-tokens/src/lib/space.ts
npx nx test design-tokens
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/scripts/generate-theme-css.ts libs/design-tokens/src/lib/theme.css
git commit -m "feat(design-tokens): emit the space scale; token↔CSS parity now green"
```

---

## Task 4: Lock the `--ds-*` consumer contract

`tokens.css` is orphaned — zero importers, not in the package `exports` map —
but 45 cockpit and example files reference `--ds-*` properties, always with a
fallback (`var(--ds-canvas, #111)`), so they render on fallbacks today. Before
regenerating that file we pin the names those consumers use, so regeneration
cannot silently drop one.

**Files:**
- Create: `libs/design-tokens/src/lib/ds-var-contract.spec.ts`

- [ ] **Step 1: Write the test**

Create `libs/design-tokens/src/lib/ds-var-contract.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const TOKENS_CSS = resolve(__dirname, 'tokens.css');

/**
 * The `--ds-*` names that cockpit and example apps actually reference today.
 *
 * They all reference them with fallbacks and nothing imports tokens.css yet,
 * so dropping a name causes no immediate breakage — it would just silently
 * pin those apps to their fallback colours forever. Hence this list.
 *
 * Derived from:
 *   grep -rhoE -- "--ds-[a-z0-9-]+" cockpit examples apps | sort -u
 * intersected with the names tokens.css defined before it came under the
 * generator. Add to this list when a consumer starts using a new name.
 */
const CONSUMER_REFERENCED = [
  '--ds-accent',
  '--ds-accent-border',
  '--ds-accent-glow',
  '--ds-accent-hover',
  '--ds-accent-surface',
  '--ds-border',
  '--ds-border-strong',
  '--ds-canvas',
  '--ds-font-mono',
  '--ds-font-sans',
  '--ds-font-serif',
  '--ds-radius-lg',
  '--ds-radius-md',
  '--ds-radius-sm',
  '--ds-radius-xl',
  '--ds-shadow-lg',
  '--ds-shadow-md',
  '--ds-surface',
  '--ds-surface-dim',
  '--ds-surface-tinted',
  '--ds-text-inverted',
  '--ds-text-muted',
  '--ds-text-primary',
  '--ds-text-secondary',
] as const;

function definedNames(css: string): Set<string> {
  return new Set([...css.matchAll(/^\s*(--ds-[a-z0-9-]+):/gm)].map((m) => m[1]));
}

describe('--ds-* consumer contract', () => {
  const defined = definedNames(readFileSync(TOKENS_CSS, 'utf-8'));

  it('parses a non-trivial number of names (guards a regex that matches nothing)', () => {
    expect(defined.size).toBeGreaterThan(20);
  });

  it('defines every --ds-* name a cockpit or example app references', () => {
    const missing = CONSUMER_REFERENCED.filter((n) => !defined.has(n));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it against the current hand-written tokens.css**

```bash
cd libs/design-tokens && npx vitest run src/lib/ds-var-contract.spec.ts --config vite.config.mts; cd -
```

Expected: PASS. This is the baseline — it documents what regeneration must
preserve. A red result here means the contract list is wrong; recompute it with
the `grep` in the docblock before proceeding.

- [ ] **Step 3: Mutation-test it**

```bash
sed -i '' 's/^  --ds-canvas:/  --ds-canvas-XX:/' libs/design-tokens/src/lib/tokens.css
cd libs/design-tokens && npx vitest run src/lib/ds-var-contract.spec.ts --config vite.config.mts; cd -
```

Expected: FAIL listing `--ds-canvas` as missing. Then revert:

```bash
git checkout -- libs/design-tokens/src/lib/tokens.css
```

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/src/lib/ds-var-contract.spec.ts
git commit -m "test(design-tokens): pin the --ds-* names cockpit and example apps reference"
```

---

## Task 5: Bring `tokens.css` under the generator

`tokens.css` is hand-written and has drifted from `light.ts` —
`--ds-text-secondary: #555770` against the live `rgb(70, 70, 70)`. It is also
incomplete: it omits `--ds-render-green` and the `bodyLg` / `body` / `caption`
line-heights. Generating it from the same source removes the third disagreeing
surface.

**Files:**
- Modify: `libs/design-tokens/scripts/generate-theme-css.ts`
- Regenerate: `libs/design-tokens/src/lib/tokens.css`
- Modify: `libs/design-tokens/src/lib/generate-theme-css.spec.ts`

- [ ] **Step 1: Add the tokens.css generator**

In `scripts/generate-theme-css.ts`, add next to `OUTPUT_PATH`:

```ts
const TOKENS_OUTPUT_PATH = resolve(HERE, '..', 'src', 'lib', 'tokens.css');
```

Then add these two functions above `generateThemeCss()`:

```ts
const TOKENS_HEADER = `/*
 * @threadplane/design-tokens/tokens.css
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Plain \`:root { --ds-* }\` custom properties for consumers that do not run
 * Tailwind (the Angular cockpit and example apps). Same values as theme.css,
 * different naming convention and no \`@theme\` wrapper.
 *
 * Regenerate with:
 *   npx nx run design-tokens:generate-theme-css
 *
 * Source of truth:
 *   - libs/design-tokens/src/lib/light.ts
 *   - libs/design-tokens/src/lib/base.ts
 *
 * The names here are a consumer contract — cockpit and example apps reference
 * them. ds-var-contract.spec.ts fails if one disappears.
 */
`;

function buildTokensBlock(): string {
  const { typography, space, radius, shadows, brand } = baseTokens;
  const lines: string[] = [':root {'];

  lines.push('  /* Colors */');
  lines.push(`  --ds-bg: ${lightOverrides.bg};`);
  lines.push(`  --ds-accent: ${lightOverrides.accent};`);
  lines.push(`  --ds-accent-hover: ${lightOverrides.accentHover};`);
  lines.push(`  --ds-accent-light: ${brand.accentLight};`);
  lines.push(`  --ds-accent-glow: ${lightOverrides.accentGlow};`);
  lines.push(`  --ds-accent-border: ${lightOverrides.accentBorder};`);
  lines.push(`  --ds-accent-border-hover: ${lightOverrides.accentBorderHover};`);
  lines.push(`  --ds-accent-surface: ${lightOverrides.accentSurface};`);
  lines.push(`  --ds-text-primary: ${lightOverrides.textPrimary};`);
  lines.push(`  --ds-text-secondary: ${lightOverrides.textSecondary};`);
  lines.push(`  --ds-text-muted: ${lightOverrides.textMuted};`);
  lines.push(`  --ds-text-inverted: ${lightOverrides.textInverted};`);
  lines.push(`  --ds-sidebar-bg: ${lightOverrides.sidebarBg};`);
  lines.push(`  --ds-angular-red: ${brand.angularRed};`);
  lines.push(`  --ds-render-green: ${brand.renderGreen};`);
  lines.push(`  --ds-chat-purple: ${brand.chatPurple};`);

  lines.push('');
  lines.push('  /* Surfaces */');
  lines.push(`  --ds-canvas: ${lightOverrides.canvas};`);
  lines.push(`  --ds-surface: ${lightOverrides.surface};`);
  lines.push(`  --ds-surface-tinted: ${lightOverrides.surfaceTinted};`);
  lines.push(`  --ds-surface-dim: ${lightOverrides.surfaceDim};`);
  lines.push(`  --ds-border: ${lightOverrides.border};`);
  lines.push(`  --ds-border-strong: ${lightOverrides.borderStrong};`);

  lines.push('');
  lines.push('  /* Typography */');
  lines.push(`  --ds-font-serif: ${typography.fontSerif};`);
  lines.push(`  --ds-font-sans: ${typography.fontSans};`);
  lines.push(`  --ds-font-mono: ${typography.fontMono};`);

  lines.push('');
  lines.push('  /* Typography — type scale */');
  // `-spacing` (not `-letter-spacing`) preserves the pre-existing name.
  const dsSteps = [
    ['h1', typography.h1],
    ['h2', typography.h2],
    ['h3', typography.h3],
    ['eyebrow', typography.eyebrow],
    ['body-lg', typography.bodyLg],
    ['body', typography.body],
    ['caption', typography.caption],
  ] as const;
  for (const [name, step] of dsSteps) {
    lines.push(`  --ds-${name}-size: ${step.size};`);
    lines.push(`  --ds-${name}-line: ${step.line};`);
    if ('weight' in step) lines.push(`  --ds-${name}-weight: ${step.weight};`);
    if ('letterSpacing' in step) {
      lines.push(`  --ds-${name}-spacing: ${step.letterSpacing};`);
    }
  }

  lines.push('');
  lines.push('  /* Shadows */');
  lines.push(`  --ds-shadow-sm: ${shadows.sm};`);
  lines.push(`  --ds-shadow-md: ${shadows.md};`);
  lines.push(`  --ds-shadow-lg: ${shadows.lg};`);
  lines.push(`  --ds-shadow-focus: ${shadows.focus};`);

  lines.push('');
  lines.push('  /* Radius */');
  lines.push(`  --ds-radius-sm: ${radius.sm};`);
  lines.push(`  --ds-radius-md: ${radius.md};`);
  lines.push(`  --ds-radius-lg: ${radius.lg};`);
  lines.push(`  --ds-radius-xl: ${radius.xl};`);
  lines.push(`  --ds-radius-full: ${radius.full};`);

  lines.push('');
  lines.push('  /* Space */');
  lines.push(`  --ds-section-y: ${space.sectionY};`);
  lines.push(`  --ds-section-y-tight: ${space.sectionYTight};`);
  lines.push(`  --ds-container-x: ${space.containerX};`);
  lines.push(`  --ds-container-max: ${space.containerMax};`);

  lines.push('}');
  return lines.join('\n') + '\n';
}

export function generateTokensCss(): string {
  return TOKENS_HEADER + buildTokensBlock();
}
```

- [ ] **Step 2: Write both files from `main()`**

Replace the body of `main()` with:

```ts
function main() {
  writeFileSync(OUTPUT_PATH, generateThemeCss());
  writeFileSync(TOKENS_OUTPUT_PATH, generateTokensCss());
  // eslint-disable-next-line no-console
  console.log(`wrote ${OUTPUT_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`wrote ${TOKENS_OUTPUT_PATH}`);
}
```

- [ ] **Step 3: Extend the drift guard**

In `libs/design-tokens/src/lib/generate-theme-css.spec.ts`, change the import
line to pull in both generators and add a second case:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateThemeCss, generateTokensCss } from '../../scripts/generate-theme-css';

const COMMITTED_PATH = resolve(__dirname, 'theme.css');
const COMMITTED_TOKENS_PATH = resolve(__dirname, 'tokens.css');

describe('generate-theme-css', () => {
  it('produces output that matches the committed theme.css', () => {
    const expected = readFileSync(COMMITTED_PATH, 'utf-8');
    const actual = generateThemeCss();
    expect(actual).toBe(expected);
  });

  it('produces output that matches the committed tokens.css', () => {
    const expected = readFileSync(COMMITTED_TOKENS_PATH, 'utf-8');
    const actual = generateTokensCss();
    expect(actual).toBe(expected);
  });
});
```

- [ ] **Step 4: Regenerate and run the suite**

```bash
npx nx run design-tokens:generate-theme-css && npx nx test design-tokens
```

Expected: PASS on all four specs — `tokens`, `generate-theme-css` (both cases),
`ds-var-contract`, and `token-css-parity`.

`ds-var-contract` passing is the important one: it proves regeneration kept
every name the cockpit apps reference.

- [ ] **Step 5: Confirm the drift is actually gone**

```bash
grep -nE "555770|8b8fa3|1a1a2e|f8f9fc" libs/design-tokens/src/lib/tokens.css
```

Expected: **no output**. Those were the stale hand-written values; they are now
sourced from `light.ts`.

- [ ] **Step 6: Commit**

```bash
git add libs/design-tokens/scripts/generate-theme-css.ts \
        libs/design-tokens/src/lib/tokens.css \
        libs/design-tokens/src/lib/generate-theme-css.spec.ts
git commit -m "refactor(design-tokens): generate tokens.css from light.ts so --ds-* can no longer drift"
```

---

## Task 6: Make `tokens.css` importable

It is generated and correct now, but still unreachable — not in `exports`, not
copied by the build.

**Files:**
- Modify: `libs/design-tokens/package.json`
- Modify: `libs/design-tokens/project.json`

- [ ] **Step 1: Add the export**

In `libs/design-tokens/package.json`, the `exports` map currently reads:

```json
"exports": {
  ".": { "types": "./src/index.d.ts", "default": "./src/index.js" },
  "./theme.css": "./src/lib/theme.css"
}
```

Add the third entry:

```json
"exports": {
  ".": { "types": "./src/index.d.ts", "default": "./src/index.js" },
  "./theme.css": "./src/lib/theme.css",
  "./tokens.css": "./src/lib/tokens.css"
}
```

- [ ] **Step 2: Copy it in the build**

In `libs/design-tokens/project.json`, the `build.options.assets` array has one
entry globbing `theme.css`. Change that glob to cover both files:

```json
"assets": [
  {
    "input": "libs/design-tokens/src/lib",
    "glob": "*.css",
    "output": "src/lib"
  }
]
```

- [ ] **Step 3: Build and verify both files land**

```bash
npx nx build design-tokens && ls dist/libs/design-tokens/src/lib/*.css
```

Expected: both `theme.css` and `tokens.css` listed.

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/package.json libs/design-tokens/project.json
git commit -m "build(design-tokens): export and ship tokens.css alongside theme.css"
```

---

## Task 7: `global.css` — swaps with no visual change

Three literals in the website's `global.css` already hold exactly the token
value. Swapping them must produce a byte-identical render.

**Files:**
- Modify: `apps/website/src/app/global.css:114-115`, `:195`

- [ ] **Step 1: Make the three swaps**

In `.docs-prose :not(pre) > code` (around line 111), change:

```css
  background: rgba(0, 64, 144, 0.06);
  color: #004090;
```

to:

```css
  background: var(--color-accent-surface);
  color: var(--color-accent);
```

In `.docs-prose th` (line 195), change `border-bottom: 1px solid rgba(0, 64, 144, 0.15);`
to `border-bottom: 1px solid var(--color-accent-border);`. Leave the `color`
on that line alone — it is Task 8.

- [ ] **Step 2: Verify the values really are identical**

```bash
grep -E "accent-surface|--color-accent:|accent-border:" libs/design-tokens/src/lib/theme.css
```

Expected:

```
  --color-accent: #004090;
  --color-accent-border: rgba(0, 64, 144, 0.15);
  --color-accent-surface: rgba(0, 64, 144, 0.06);
```

If any differs from the literal you replaced, that swap belongs in Task 8
instead — it is a visual change, not a rename.

- [ ] **Step 3: Confirm visually**

Start the dev server via `preview_start` with the `website-dev` config, open
`/docs/chat/components/chat`, and screenshot at 1280 wide. Compare against a
screenshot taken before the edit. Expected: **no difference at all.** Inline
code chips keep their pale blue background and navy text.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "refactor(website): use accent tokens for docs code chips and table rule"
```

---

## Task 8: `global.css` — adopt the live tokens (visible change)

This is the one reviewable design decision in the project. Three rules render a
blue-grey (`#555770`, `#8b8fa3`) from the old drifted token surface that no
current token produces.

Note that two *other* uses of `#555770` — `li::marker` (line 139) and
`figcaption` (line 170) — are already written as
`var(--color-text-muted, #555770)`. The var is defined, so the fallback is dead
text and removing it changes nothing. Do not count those as visual changes.

**Files:**
- Modify: `apps/website/src/app/global.css:100`, `:139`, `:170`, `:195-196`

- [ ] **Step 1: Capture the "before" screenshots**

With the dev server running, screenshot `/docs/chat/components/chat` at 1280
wide, scrolled to the "Inputs" props table, and a second shot of any page with
a titled code block. Keep them for the PR description.

- [ ] **Step 2: Adopt the tokens in the three live rules**

Line 100, inside `[data-rehype-pretty-code-title]`:

```css
  color: var(--color-text-muted);
```

Line 195, inside `.docs-prose th` — `th` is an uppercase mono label, so it takes
the muted token:

```css
  color: var(--color-text-muted);
```

Line 196, inside `.docs-prose td` — `td` is body content and should match
`--tw-prose-body`, which `MdxRenderer` sets to `colors.textSecondary`:

```css
  color: var(--color-text-secondary);
```

- [ ] **Step 3: Drop the two dead fallbacks**

Line 139: `.docs-prose li::marker { color: var(--color-text-muted, #555770); }`
becomes `.docs-prose li::marker { color: var(--color-text-muted); }`

Line 170, inside the `figcaption` rule: `color: var(--color-text-muted, #555770);`
becomes `color: var(--color-text-muted);`

- [ ] **Step 4: Verify no stale literal survives**

```bash
grep -nE "555770|8b8fa3" apps/website/src/app/global.css
```

Expected: **no output.**

- [ ] **Step 5: Capture "after" screenshots and confirm the change is bounded**

Re-screenshot the same two views. Expected differences, and *only* these:

- props-table header text: blue-grey → `rgb(115, 115, 115)`
- props-table body text: blue-grey → `rgb(70, 70, 70)`
- code-block title text: blue-grey → `rgb(115, 115, 115)`

List markers and figure captions must look **identical** — if they changed, the
fallback was live and something else is wrong.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "fix(website): docs tables and code titles use the live text tokens

The literals #555770 and #8b8fa3 came from the old --ds-* surface and no
longer match any token. Visible change, bounded to table header text, table
body text, and code-block titles."
```

---

## Task 9: `global.css` — name the literals that are not tokens

Eight remaining literals do not belong to the design system and must not be
promoted into it. They become local, named, commented vars.

**Files:**
- Modify: `apps/website/src/app/global.css`

- [ ] **Step 1: Declare the local vars**

Immediately after the two `@import` lines at the top of `global.css`, insert:

```css
/*
 * Local, non-token constants.
 *
 * These are deliberately NOT design tokens. Promoting them to
 * @threadplane/design-tokens would imply the design system owns the syntax
 * theme and the docs figure treatment. It does not.
 *
 * The --docs-code-* group is coupled to `rehypeOptions.theme` ('tokyo-night')
 * in components/docs/MdxRenderer.tsx. Change the shiki theme and these must
 * change with it.
 */
:root {
  --docs-code-bg: #1a1b26;
  --docs-code-border: rgba(0, 0, 0, 0.1);
  --docs-code-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  --docs-code-title-rule: rgba(255, 255, 255, 0.06);
  --docs-figure-shadow: 0 4px 16px rgba(0, 32, 72, 0.1);
  --docs-figure-shadow-bare: 0 4px 16px rgba(0, 32, 72, 0.08);
  /* Accent tints between --color-accent-surface (6%) and --color-accent-border
   * (15%). Derived rather than hardcoded so they track the accent. */
  --docs-accent-tint-faint: color-mix(in srgb, var(--color-accent) 3.5%, transparent);
  --docs-accent-tint-soft: color-mix(in srgb, var(--color-accent) 8%, transparent);
  --docs-accent-tint-line: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
```

- [ ] **Step 2: Point the rules at them**

| line | rule | replace | with |
|---|---|---|---|
| 58 | `.shiki` | `background: #1a1b26 !important;` | `background: var(--docs-code-bg) !important;` |
| 77 | figure `pre` | `border: 1px solid rgba(0, 0, 0, 0.1);` | `border: 1px solid var(--docs-code-border);` |
| 78 | figure `pre` | `box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);` | `box-shadow: var(--docs-code-shadow);` |
| 102 | code title | `background: #1a1b26;` | `background: var(--docs-code-bg);` |
| 103 | code title | `border-bottom: 1px solid rgba(255, 255, 255, 0.06);` | `border-bottom: 1px solid var(--docs-code-title-rule);` |
| 154 | `figure:has(> img)` | `background: rgba(0, 64, 144, 0.035);` | `background: var(--docs-accent-tint-faint);` |
| 155 | `figure:has(> img)` | `border: 1px solid rgba(0, 64, 144, 0.1);` | `border: 1px solid var(--docs-accent-tint-line);` |
| 163 | figure `img` | `box-shadow: 0 4px 16px rgba(0, 32, 72, 0.1);` | `box-shadow: var(--docs-figure-shadow);` |
| 182 | bare `img` | `box-shadow: 0 4px 16px rgba(0, 32, 72, 0.08);` | `box-shadow: var(--docs-figure-shadow-bare);` |
| 196 | `.docs-prose td` | `border-bottom: 1px solid rgba(0, 64, 144, 0.08);` | `border-bottom: 1px solid var(--docs-accent-tint-soft);` |

- [ ] **Step 3: Verify no bare literal remains outside the `:root` block**

```bash
awk '/^:root \{/,/^\}/ { next } { print FILENAME":"NR": "$0 }' apps/website/src/app/global.css \
  | grep -E "#[0-9a-fA-F]{3,8}|rgba?\("
```

Expected: **no output.** Every colour literal now lives in the `:root` block or
comes from a token.

- [ ] **Step 4: Verify `color-mix` renders**

Reload `/docs/langgraph/concepts/threads-and-runs` (a page with a figure) and
run in the browser console via `javascript_tool`:

```js
getComputedStyle(document.querySelector('.docs-prose figure:has(> img)')).backgroundColor
```

Expected: a resolved `rgba(...)` / `color(...)` value, **not** the literal
string `color-mix(...)` and not `rgba(0, 0, 0, 0)`. If it does not resolve,
replace the three `--docs-accent-tint-*` definitions with the literal values
they replaced and note it in the PR — the spec flags this as an open question.

- [ ] **Step 5: Screenshot to confirm nothing moved**

Re-screenshot `/docs/chat/components/chat` and a figure-bearing page. Expected:
identical to the end of Task 8. This task is a pure rename.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "refactor(website): name the docs-local constants that are not design tokens"
```

---

## Task 10: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Library suite**

```bash
npx nx test design-tokens
```

Expected: PASS — `tokens`, `generate-theme-css` (×2), `ds-var-contract`,
`token-css-parity`.

- [ ] **Step 2: Website suite**

```bash
cd apps/website && npx vitest run --config vite.config.mts
```

Use this exact command — `nx test website` does not exist.

**The website suite is NOT green, and was not green before this project started.**
Because there is no `nx test` target, these specs never ran in CI and drifted
red. Measured baseline at `959c6db0` (the commit this branch started from):

```
Test Files  3 failed | 33 passed (36)
     Tests  5 failed | 341 passed (346)
```

The five are content assertions with no relationship to CSS custom properties:

| spec | assertion that drifted |
|---|---|
| `blog/PostCard.spec.tsx` | expects the text `2026-05-17` |
| `landing/Differentiator.spec.tsx` | expects the text `MIT + self-hosted` |
| `app/thanks/page.spec.tsx` (×3) | heading, `provideChat()` mention, docs links |

**Expected here: exactly those same 5 failures and no others.** A sixth failure,
or a different one, is caused by this project and must be fixed. Do not "fix"
the five — they are pre-existing drift and belong to their own cleanup.

- [ ] **Step 3: Lint**

```bash
npx nx lint design-tokens && npx nx lint website
```

CI tolerates warnings but fails on errors. To count errors, strip ANSI first —
`grep -cE ' error '` on raw output silently returns 0:

```bash
npx nx lint website 2>&1 | sed -r 's/\x1b\[[0-9;]*m//g' | grep -cE '  error  '
```

Expected: `0`.

- [ ] **Step 4: Production build**

```bash
npx nx build website --configuration=production
```

Expected: success. The prod config has a bundle budget that dev does not; a dev
build passing proves nothing about deploy.

- [ ] **Step 5: Confirm the generated CSS is committed and clean**

```bash
git status --short
```

Expected: **empty.** A dirty `theme.css` or `tokens.css` means you edited a
generated file without regenerating, and the drift guard will fail in CI.

- [ ] **Step 6: Sanity-check the new utilities exist**

The `@theme` additions generate Tailwind utilities. Confirm the type scale is
live by adding `class="text-h2"` to any element in a dev page, checking the
computed `font-size` is `clamp(36px, 4.5vw, 56px)`, then removing it. This
verifies `@theme` picked the tokens up rather than silently ignoring them.

- [ ] **Step 7: Final commit if anything changed**

```bash
git status --short
```

If empty, nothing to do — the work is already committed task by task.

---

## What this deliberately does not do

Restating so a reviewer does not ask for it:

- **No component is touched.** Zero `style={{}}` objects change. That is
  Project 2, and it is what these vars exist to enable.
- **No fix from the findings audit lands.** The dead sticky rails, the crushed
  mobile tables, and the anchors behind the nav all stay broken through
  Projects 1 and 2. That was accepted when the arc was ordered this way.
- **The cockpit apps are not wired to `tokens.css`.** They still render on
  their `var(--ds-*, fallback)` fallbacks. Importing the now-correct file would
  flip nine example apps from dark fallbacks to light token values — a real
  visual change that wants its own ticket.
- **No dark theme.** `darkOverrides` exists and `cssVars('dark')` resolves it,
  but nothing emits it and the site stays light-only.
