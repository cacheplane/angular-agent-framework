# Website Token Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `@ngaf/design-tokens` light palette to chat-lib aesthetic (pure-white surfaces, near-black text, neutral grays), then migrate `apps/website` from its hand-maintained `@theme` block to a build-time-generated CSS file sourced from the TS token constants.

**Architecture:** `lightOverrides` in `libs/design-tokens/src/lib/light.ts` and `shadows` in `libs/design-tokens/src/lib/shadows.ts` get new values aligned with chat lib. A new generator script (`libs/design-tokens/scripts/generate-theme-css.ts`) reads `baseTokens` + `lightOverrides` and emits `libs/design-tokens/src/lib/theme.css`. The website's `global.css` imports the generated file instead of redeclaring tokens locally. A drift-guard test re-runs the generator and asserts it matches the committed file.

**Tech Stack:** TypeScript, Vitest, Tailwind v4, Nx.

**Spec:** `docs/superpowers/specs/2026-05-15-website-token-alignment-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `libs/design-tokens/src/lib/light.ts` | Palette values flip to chat-lib aesthetic |
| Modify | `libs/design-tokens/src/lib/shadows.ts` | Shadows shift from `rgba(15, 23, 41, *)` to `rgba(0, 0, 0, *)` |
| Modify | `libs/design-tokens/src/lib/css-vars.spec.ts` | Update expected hex values to match new palette |
| Modify | `apps/cockpit/e2e/dark-mode.spec.ts` | Update light-mode canvas assertion |
| Create | `libs/design-tokens/scripts/generate-theme-css.ts` | TS script that emits `theme.css` from TS constants |
| Create | `libs/design-tokens/src/lib/theme.css` | Generated artifact (committed to repo) |
| Create | `libs/design-tokens/src/lib/generate-theme-css.spec.ts` | Drift-guard test |
| Modify | `libs/design-tokens/package.json` | Add `exports."./theme.css"`, patch bump |
| Modify | `libs/design-tokens/project.json` | Add `generate-theme-css` Nx target |
| Modify | `apps/website/src/app/global.css` | Drop `@theme`/`:root` blocks, import generated CSS |

---

## Task 1: Update `lightOverrides` palette values

**Files:**
- Modify: `libs/design-tokens/src/lib/light.ts`

- [ ] **Step 1: Read current file**

```bash
cat libs/design-tokens/src/lib/light.ts
```

- [ ] **Step 2: Rewrite `lightOverrides` with chat-lib aesthetic values**

Replace the body of `lightOverrides` with:

```ts
import { baseTokens } from './base';

/**
 * Theme-variant tokens resolved for the light theme.
 * Aligned with @ngaf/chat library's polished consumer aesthetic
 * (pure-white surfaces, near-black text, neutral grays) so embedded
 * chat surfaces visually unify with cockpit chrome and the marketing
 * website.
 */
export const lightOverrides = Object.freeze({
  // Surfaces
  canvas: 'rgb(255, 255, 255)',
  surface: 'rgb(255, 255, 255)',
  surfaceTinted: 'rgb(251, 251, 251)',
  surfaceDim: 'rgb(245, 245, 245)',
  border: 'rgb(229, 229, 229)',
  borderStrong: 'rgb(200, 200, 200)',

  // Text
  textPrimary: 'rgb(28, 28, 28)',
  textSecondary: 'rgb(70, 70, 70)',
  textMuted: 'rgb(115, 115, 115)',
  textInverted: 'rgb(255, 255, 255)',

  // Legacy surface aliases
  bg: 'rgb(255, 255, 255)',
  sidebarBg: 'rgba(255, 255, 255, 0.45)',

  // Semantic accent maps to the navy brand color (unchanged — cockpit identity)
  accent: baseTokens.brand.accent,
  accentHover: '#003070',
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  accentSurface: 'rgba(0, 64, 144, 0.06)',
} as const);

export type LightOverrides = typeof lightOverrides;
```

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/src/lib/light.ts
git commit -m "refactor(design-tokens): align lightOverrides with chat lib aesthetic"
```

---

## Task 2: Update shadows to neutral-black

**Files:**
- Modify: `libs/design-tokens/src/lib/shadows.ts`

- [ ] **Step 1: Read current file**

```bash
cat libs/design-tokens/src/lib/shadows.ts
```

- [ ] **Step 2: Rewrite with chat-lib shadow values**

Replace `sm`, `md`, `lg` (`focus` unchanged):

```ts
export const shadows = Object.freeze({
  /** Subtle — default card */
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  /** Moderate — hovered card, dropdown */
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  /** Strong — floating elements, hero collage */
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.10), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  /** Keyboard focus ring (accent-tinted; unchanged) */
  focus: '0 0 0 3px rgba(0, 64, 144, 0.25)',
} as const);

export type Shadows = typeof shadows;
```

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/src/lib/shadows.ts
git commit -m "refactor(design-tokens): shift shadows to neutral rgba(0,0,0,*) (chat lib aesthetic)"
```

---

## Task 3: Update existing token tests to match new palette

**Files:**
- Modify: `libs/design-tokens/src/lib/css-vars.spec.ts`

The existing `css-vars.spec.ts` asserts specific hex values for the light theme that will change. Update them.

- [ ] **Step 1: Read the test file**

```bash
cat libs/design-tokens/src/lib/css-vars.spec.ts
```

- [ ] **Step 2: Update light-theme assertions**

Find the `describe('light', ...)` block. Change `toBe` values:

| Variable | Old expected | New expected |
|---|---|---|
| `--ds-canvas` | `'#fafbfc'` | `'rgb(255, 255, 255)'` |
| `--ds-text-primary` | `'#1a1a2e'` | `'rgb(28, 28, 28)'` |
| `--ds-accent` | `'#004090'` | `'#004090'` (unchanged) |

Update only the changed values; leave dark-theme assertions, brand-color assertions, and typography assertions as-is.

- [ ] **Step 3: Run tests to verify they pass with the new palette**

```bash
pnpm nx test design-tokens
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/src/lib/css-vars.spec.ts
git commit -m "test(design-tokens): update css-vars expectations to chat lib palette"
```

---

## Task 4: Update cockpit e2e light-mode canvas assertion

**Files:**
- Modify: `apps/cockpit/e2e/dark-mode.spec.ts`

The cockpit dark-mode e2e suite asserts `--ds-canvas` is `#fafbfc` when the user has the `theme=light` cookie. After Task 1 this becomes `rgb(255, 255, 255)`.

- [ ] **Step 1: Read the failing assertion**

```bash
grep -B 5 -A 2 "fafbfc" apps/cockpit/e2e/dark-mode.spec.ts
```

- [ ] **Step 2: Update the light-mode canvas assertion**

Find the line:

```ts
expect(canvas).toBe('#fafbfc');
```

Replace with:

```ts
expect(canvas).toBe('rgb(255, 255, 255)');
```

The dark-mode assertion (`'#0e1117'`) stays unchanged.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/e2e/dark-mode.spec.ts
git commit -m "test(cockpit): update light-mode canvas assertion to rgb(255,255,255)"
```

---

## Task 5: Generator script + emitted `theme.css`

**Files:**
- Create: `libs/design-tokens/scripts/generate-theme-css.ts`
- Create: `libs/design-tokens/src/lib/theme.css`

The generator reads `baseTokens` and `lightOverrides`, emits a Tailwind v4 `@theme { … }` block to `libs/design-tokens/src/lib/theme.css`. Tailwind v4 maps `--color-*` to color utilities, `--font-*` to font, `--radius-*` to rounded, `--shadow-*` to shadow, `--spacing-*` to spacing. The generator uses these category prefixes.

- [ ] **Step 1: Create the generator**

Create `libs/design-tokens/scripts/generate-theme-css.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Generates libs/design-tokens/src/lib/theme.css from the TypeScript
 * token sources. Tailwind v4 reads `@theme { --color-*, --font-*, ... }`
 * to generate utility classes; this script emits those tokens with the
 * values pulled from `lightOverrides` + `baseTokens`.
 *
 * The output is committed to the repo (not gitignored) so consumers
 * can import it directly. A drift-guard test re-runs this generator
 * and diffs against the committed file to catch stale output.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseTokens } from '../src/lib/base';
import { lightOverrides } from '../src/lib/light';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_PATH = resolve(HERE, '..', 'src', 'lib', 'theme.css');

const HEADER = `/*
 * @ngaf/design-tokens/theme.css
 *
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   pnpm nx run design-tokens:generate-theme-css
 *
 * Source of truth:
 *   - libs/design-tokens/src/lib/light.ts
 *   - libs/design-tokens/src/lib/base.ts
 *
 * Drift between this file and the TS sources is caught by
 * generate-theme-css.spec.ts at test time.
 */
`;

function buildThemeBlock(): string {
  const { typography, radius, shadows, brand } = baseTokens;

  const lines: string[] = ['@theme {'];

  // Colors — surface family
  lines.push('  /* Surfaces */');
  lines.push(`  --color-canvas: ${lightOverrides.canvas};`);
  lines.push(`  --color-surface: ${lightOverrides.surface};`);
  lines.push(`  --color-surface-tinted: ${lightOverrides.surfaceTinted};`);
  lines.push(`  --color-surface-dim: ${lightOverrides.surfaceDim};`);
  lines.push(`  --color-border: ${lightOverrides.border};`);
  lines.push(`  --color-border-strong: ${lightOverrides.borderStrong};`);

  // Colors — text
  lines.push('');
  lines.push('  /* Text */');
  lines.push(`  --color-text-primary: ${lightOverrides.textPrimary};`);
  lines.push(`  --color-text-secondary: ${lightOverrides.textSecondary};`);
  lines.push(`  --color-text-muted: ${lightOverrides.textMuted};`);
  lines.push(`  --color-text-inverted: ${lightOverrides.textInverted};`);

  // Colors — legacy aliases
  lines.push('');
  lines.push('  /* Legacy surface aliases */');
  lines.push(`  --color-bg: ${lightOverrides.bg};`);
  lines.push(`  --color-sidebar-bg: ${lightOverrides.sidebarBg};`);

  // Colors — accent family
  lines.push('');
  lines.push('  /* Accent family */');
  lines.push(`  --color-accent: ${lightOverrides.accent};`);
  lines.push(`  --color-accent-hover: ${lightOverrides.accentHover};`);
  lines.push(`  --color-accent-glow: ${lightOverrides.accentGlow};`);
  lines.push(`  --color-accent-border: ${lightOverrides.accentBorder};`);
  lines.push(`  --color-accent-border-hover: ${lightOverrides.accentBorderHover};`);
  lines.push(`  --color-accent-surface: ${lightOverrides.accentSurface};`);

  // Colors — brand
  lines.push('');
  lines.push('  /* Brand */');
  lines.push(`  --color-accent-light: ${brand.accentLight};`);
  lines.push(`  --color-angular-red: ${brand.angularRed};`);
  lines.push(`  --color-render-green: ${brand.renderGreen};`);
  lines.push(`  --color-chat-purple: ${brand.chatPurple};`);

  // Fonts
  lines.push('');
  lines.push('  /* Fonts */');
  lines.push(`  --font-garamond: ${typography.fontSerif};`);
  lines.push(`  --font-inter: ${typography.fontSans};`);
  lines.push(`  --font-mono: ${typography.fontMono};`);

  // Radii
  lines.push('');
  lines.push('  /* Radii */');
  lines.push(`  --radius-sm: ${radius.sm};`);
  lines.push(`  --radius-md: ${radius.md};`);
  lines.push(`  --radius-lg: ${radius.lg};`);
  lines.push(`  --radius-xl: ${radius.xl};`);
  lines.push(`  --radius-full: ${radius.full};`);

  // Shadows
  lines.push('');
  lines.push('  /* Shadows */');
  lines.push(`  --shadow-sm: ${shadows.sm};`);
  lines.push(`  --shadow-md: ${shadows.md};`);
  lines.push(`  --shadow-lg: ${shadows.lg};`);
  lines.push(`  --shadow-focus: ${shadows.focus};`);

  lines.push('}');
  return lines.join('\n') + '\n';
}

export function generateThemeCss(): string {
  return HEADER + buildThemeBlock();
}

function main() {
  const content = generateThemeCss();
  writeFileSync(OUTPUT_PATH, content);
  // eslint-disable-next-line no-console
  console.log(`wrote ${OUTPUT_PATH}`);
}

// Only run main when invoked directly (not when imported by tests)
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  main();
}
```

- [ ] **Step 2: Run the generator**

```bash
npx tsx libs/design-tokens/scripts/generate-theme-css.ts
```

Expected output: `wrote /Users/.../libs/design-tokens/src/lib/theme.css`.

- [ ] **Step 3: Inspect the generated file**

```bash
cat libs/design-tokens/src/lib/theme.css | head -30
```

Expected: `@theme { --color-canvas: rgb(255, 255, 255); ... }` block with all categories.

- [ ] **Step 4: Commit (generator + generated file)**

```bash
git add libs/design-tokens/scripts/generate-theme-css.ts libs/design-tokens/src/lib/theme.css
git commit -m "feat(design-tokens): generate theme.css from TS sources"
```

---

## Task 6: Drift-guard test for the generator

**Files:**
- Create: `libs/design-tokens/src/lib/generate-theme-css.spec.ts`

- [ ] **Step 1: Write the drift-guard test**

Create `libs/design-tokens/src/lib/generate-theme-css.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { generateThemeCss } from '../../scripts/generate-theme-css';

const COMMITTED_PATH = resolve(__dirname, 'theme.css');

describe('generate-theme-css', () => {
  it('produces output that matches the committed theme.css', () => {
    const expected = readFileSync(COMMITTED_PATH, 'utf-8');
    const actual = generateThemeCss();
    expect(actual).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm nx test design-tokens -- --run generate-theme-css.spec
```

Expected: 1 test passing. If it fails, the generator output doesn't match the committed file — re-run `npx tsx libs/design-tokens/scripts/generate-theme-css.ts` to update.

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/src/lib/generate-theme-css.spec.ts
git commit -m "test(design-tokens): drift-guard for generated theme.css"
```

---

## Task 7: Wire Nx target + package exports

**Files:**
- Modify: `libs/design-tokens/project.json`
- Modify: `libs/design-tokens/package.json`

- [ ] **Step 1: Add the `generate-theme-css` Nx target**

Edit `libs/design-tokens/project.json`. Inside the `targets` object, add:

```json
"generate-theme-css": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx tsx libs/design-tokens/scripts/generate-theme-css.ts",
    "cwd": "{workspaceRoot}"
  }
}
```

Place it after the existing `test` target. Make sure JSON commas are correct.

- [ ] **Step 2: Add the CSS export to `package.json`**

Edit `libs/design-tokens/package.json`. Add an `exports` field (preserve the existing fields):

```json
{
  "name": "@ngaf/design-tokens",
  "version": "0.0.33",
  "license": "MIT",
  "exports": {
    "./theme.css": "./src/lib/theme.css"
  },
  ...
}
```

If `exports` already exists from prior work, add the `./theme.css` entry to it.

- [ ] **Step 3: Test the Nx target runs**

```bash
pnpm nx run design-tokens:generate-theme-css
```

Expected: writes `theme.css` (idempotent — output unchanged from prior run).

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/project.json libs/design-tokens/package.json
git commit -m "build(design-tokens): wire generate-theme-css Nx target + package export"
```

---

## Task 8: Migrate `apps/website/src/app/global.css`

**Files:**
- Modify: `apps/website/src/app/global.css`

- [ ] **Step 1: Read current file**

```bash
cat apps/website/src/app/global.css
```

Note the line counts: `@theme {…}` block (lines 3-44), `:root {…}` block (lines 46-58), `body` block + further styles starting around line 60.

- [ ] **Step 2: Replace `@theme` block + `:root` mirror with the generated import**

Replace the top section (everything before `* { box-sizing: border-box; }`) with:

```css
@import "tailwindcss";
@import "@ngaf/design-tokens/theme.css";
```

The body styles, scroll keyframes, animation rules, and everything else BELOW the `:root` block stays unchanged.

- [ ] **Step 3: Build the website**

```bash
pnpm nx build website
```

Expected: clean build. Tailwind v4 should pick up `@theme` from the imported file and generate utility classes (`bg-canvas`, `text-accent`, etc.) the same way as before.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "refactor(website): import design-tokens generated theme.css"
```

---

## Task 9: Version bump + full check stack

**Files:**
- Modify: `libs/design-tokens/package.json`

- [ ] **Step 1: Bump patch version**

Edit `libs/design-tokens/package.json`. Increment `"version"` from `0.0.33` to `0.0.34`. Patch-only rule — never bump to `0.1.x`.

- [ ] **Step 2: Run the full check stack**

```bash
pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit,website
```

Expected: all green.

```bash
pnpm nx e2e cockpit
```

Expected: all green. The light-mode canvas assertion (Task 4) was updated.

```bash
pnpm nx build website
```

Expected: green.

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: green.

If anything fails:
- **css-vars.spec.ts** — verify the Task 3 updates landed (`rgb(255, 255, 255)` etc.)
- **dark-mode.spec.ts e2e** — Task 4 update needed
- **Website build** — confirm `@ngaf/design-tokens/theme.css` resolves via npm-workspaces symlink (`ls -la node_modules/@ngaf/design-tokens`)
- **Drift test** — re-run `pnpm nx run design-tokens:generate-theme-css` if the file is stale

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/package.json
git commit -m "chore: bump design-tokens patch version"
```

---

## Task 10: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin website-token-alignment
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "refactor: website token alignment + design-tokens light palette refresh" --body "$(cat <<'EOF'
## Summary

Third (final) PR in the cockpit dark mode + style alignment series (spec: \`docs/superpowers/specs/2026-05-15-website-token-alignment-design.md\`, plan: \`docs/superpowers/plans/2026-05-15-website-token-alignment.md\`).

- **Refresh \`@ngaf/design-tokens\` light palette** to absorb \`@ngaf/chat\` library's polished consumer aesthetic. Surfaces flip from cool off-white (\`#fafbfc\`) to pure white (\`rgb(255, 255, 255)\`); text primary from blue-tinted (\`#1a1a2e\`) to near-black (\`rgb(28, 28, 28)\`); borders to neutral grays. Shadows shift from cool \`rgba(15, 23, 41, *)\` to neutral \`rgba(0, 0, 0, *)\`. Chat lib's own tokens stay independent; embedded chat in cockpit visually unifies because design-tokens absorbed chat lib's values.
- **Website migration**: drop the hand-maintained \`@theme\` block in \`global.css\`. New build-time generator (\`libs/design-tokens/scripts/generate-theme-css.ts\`) reads TS constants and emits \`libs/design-tokens/src/lib/theme.css\`. Website imports the generated file via \`@import \"@ngaf/design-tokens/theme.css\"\`. Single source of truth; no drift. A drift-guard Vitest test re-runs the generator and asserts the committed file matches.
- **Cockpit**: no source changes. \`cssVars(theme)\` picks up the new light values automatically. Dark palette unchanged.

PR 1 (cockpit polish, #307) and PR 2 (chat lib polish, #313) shipped earlier in the sequence. This closes the visual-consistency gap.

## Test plan

- [x] \`pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit,website\` — green
- [x] \`pnpm nx e2e cockpit\` — green (updated light-mode canvas assertion to \`rgb(255, 255, 255)\`)
- [x] \`pnpm nx build website\` — green
- [x] \`pnpm nx build cockpit-chat-timeline-angular\` — green
- [ ] Manual chrome MCP smoke: cockpit light mode + website light mode — surfaces are pure-white; embedded chat matches cockpit chrome with no visible seam

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for green CI**

```bash
gh pr checks --watch
```

- [ ] **Step 4: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ Decision 1 (visual unification direction — update design-tokens to chat-lib aesthetic) → Tasks 1, 2
- ✅ Decision 2 (build-time CSS generation) → Tasks 5, 6, 7
- ✅ Decision 3 (keep `--ds-*` prefix) → no rename task; cockpit consumes `--ds-*` unchanged
- ✅ Decision 4 (cockpit no source changes) → not a task; cockpit picks up new values via `cssVars(theme)` automatically; the only cockpit touch is Task 4's e2e assertion update
- ✅ Decision 5 (OG image regen) → not a task; Satori re-renders at request time after deploy. No manual regen needed.

**Adjustments from spec during plan-prep exploration:**
1. **Shadows are in a separate file** (`shadows.ts`), not inline in `base.ts`. Task 2 modifies `shadows.ts` directly. Spec implied `base.ts` shadow modification; plan corrects to actual file.
2. **`css-vars.spec.ts` asserts specific hex values for light** that change with the palette refresh. Task 3 added to update assertions. Spec called out this risk; plan implements it.
3. **No `light.spec.ts` exists** (spec mentioned one); the relevant assertions live in `css-vars.spec.ts` and `tokens.spec.ts`. Task 3 covers `css-vars.spec.ts`; `tokens.spec.ts` only asserts key-set parity, not values, so unaffected.

**Placeholder scan:** No "TBD" / "TODO" / "fill in details". Generator code is complete; test code is complete; commit messages are spelled out.

**Type consistency:** `lightOverrides`, `baseTokens`, `Shadows`, `LightOverrides` — consistent. Function name `generateThemeCss` used identically in Tasks 5 and 6. File path `libs/design-tokens/src/lib/theme.css` consistent across tasks.
