# Inline-Style Substrate Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all static presentation in `apps/website` out of inline `style` props and embedded `<style>` tags into stylesheet rules, with zero visual change, so Project 3's polish fixes become expressible.

**Architecture:** Extend the `data-ui`/`data-mdx` hook pattern that already ships in 21 places. `global.css` becomes an index importing six scope files under `src/styles/`; each migration batch maps 1:1 to one CSS file and one PR, so a bad batch reverts by reverting one file plus its components. All migrated rules are **unlayered** (like the existing `global.css` rules) so they keep beating Tailwind's layered utilities exactly as inline styles did. Ends with an ESLint guard so new code cannot regress.

**Tech Stack:** Next.js 16, Tailwind CSS v4, plain CSS custom properties from `@threadplane/design-tokens/theme.css` (completed in #845), ESLint flat config, `tsx` for the checker script.

**Spec:** `docs/superpowers/specs/2026-08-29-inline-style-substrate-migration-design.md`
**Prerequisite:** Project 1 merged (#845). Every `tokens.*` leaf now has a CSS var or a documented exclusion, machine-checked by `token-css-parity.spec.ts`.

---

## Context an engineer needs before starting

### Scope corrections measured on 2026-08-29

- **908 style-prop sites**, not 802: 802 literal `style={{…}}` plus 106
  `style={namedVariable}` sites (a `CSSProperties` object built in a variable —
  `Button.tsx`, `app/docs/page.tsx`, `app/docs/licensing/page.tsx`,
  `app/about/page.tsx` are the main holders).
- **A third substrate exists:** 12 components embed a `<style>{`…`}</style>`
  tag whose CSS interpolates `${tokens.*}` values. These render one `<style>`
  element per component instance. They migrate too (Batches 3–4).
- **Exclusions — do not touch:**
  - `src/app/opengraph-image.tsx` and `src/app/blog/[slug]/opengraph-image.tsx`
    (14 sites): rendered by Satori via `next/og` `ImageResponse`. Satori has no
    stylesheet; inline styles are the only mechanism. Migrating them breaks OG
    images.
  - `src/app/dev/primitives/page.tsx` (17 sites): dev-only route, documented
    in-file as slated for deletion.
  - `apps/website/emails/**`: email clients cannot use custom properties.
  - `*.spec.tsx` files.

In-scope: **~877 style-prop sites + 12 embedded `<style>` tags across 88 files.**

### The cascade decision (and why the spec's first guess was wrong)

Tailwind v4 emits `@layer theme, base, components, utilities` — everything
layered. The existing `global.css` rules (including all `[data-ui]` rules) are
**unlayered**, and unlayered author CSS beats *all* layered CSS regardless of
specificity or order.

Inline styles beat utilities today. A migrated rule must keep beating them, or
any element carrying both a utility and a formerly-inline value for the same
property changes appearance. Therefore: **all migrated rules are unlayered**,
in the six `src/styles/*.css` files, imported by `global.css` exactly like the
current rules. Do NOT wrap them in `@layer components` — that inverts the
winner. (The spec's risk section originally suggested `@layer components`;
it has been corrected.)

Within unlayered CSS, conflicts resolve by specificity then source order.
Keep selectors flat — one attribute or one class, max one descendant level —
and this never bites.

### Commands

- Dev server: Browser pane `preview_start` with the `website-dev` launch entry.
  Never `npm run dev` via Bash.
- Website tests: `npx nx test website` — **SUPERSEDED mid-arc (2026-08-29):
  #851 gave the suite an nx target and repaired the three rotted spec files.**
  The "5 pre-existing failures" baseline that batches 1-4 asserted against is
  retired; the suite is fully green (347+ tests) and every remaining batch
  must keep it that way. Any failure is yours. (The direct
  `cd apps/website && npx vitest run --config vite.config.mts` still works.)
- Lint errors (CI fails on errors, tolerates warnings; strip ANSI first):
  `npx nx lint website 2>&1 | sed -r 's/\x1b\[[0-9;]*m//g' | grep -cE '  error  '`
- Prod build gate before every PR: `npx nx build website --configuration=production`
- Migration checker: `npx tsx apps/website/scripts/check-style-migration.mts [base-ref]`

### Conventions (locked here; every batch follows them)

1. **Hook naming.** Reusable primitives keep/extend `data-ui="<name>"`.
   Single-use components get semantic class names prefixed by component:
   `.nav-…`, `.footer-…`, `.docs-sidebar-…`, `.pricing-compare-…`. Precedent:
   `.why-row`, `.wp-grid`, `.hero-grid` already exist in landing components.
2. **What stays inline** (a reviewer rejects a batch that moves these):
   - values computed from unbounded props/state (`width: `${pct}%``);
   - third-party requirements (Satori — excluded files);
   - CSS custom properties used to parameterise a rule:
     `style={{ '--rows': n } as React.CSSProperties}` is the escape hatch
     when a value is dynamic but its use is presentational.
3. **Bounded variants become `data-*` modifiers**, not inline branches:
   `data-variant="primary" data-size="lg"`, one CSS rule per value.
4. **JS hover/focus handlers whose only job is presentation**
   (`onMouseEnter={e => e.currentTarget.style.color = …}`) are replaced by
   `:hover` / `:focus-visible` rules and the handlers deleted. 33 such
   handlers exist (23 in `Footer`, 5 in `Nav`, 5 in docs components).
5. **Embedded `<style>` tags**: move the CSS text verbatim into the batch file,
   replacing every `${tokens.X.Y}` interpolation with its `var(--…)` per the
   parity map in `token-css-parity.spec.ts`, then delete the tag.
6. **React numeric values**: React serialises `fontSize: 14` as `14px` (except
   unitless properties: `lineHeight`, `fontWeight`, `opacity`, `zIndex`,
   `flex`, `order`, `flexGrow`, `flexShrink`). Write the unit explicitly in
   CSS. Getting this wrong is the #1 mechanical error; the checker normalises
   for it.
7. **Token → var mapping** is exactly `CSS_VAR_BY_PATH` in
   `libs/design-tokens/src/lib/token-css-parity.spec.ts`. `tokens.typography.h2.size`
   → `var(--text-h2)`, `tokens.space.sectionY` → `var(--spacing-section-y)`,
   `tokens.colors.accent` → `var(--color-accent)`, etc. `.family` values are
   already `var(--font-*)` strings — copy them through.

   **⚠ EXCEPTION — the three font vars (found the hard way in Batch 1).**
   `layout.tsx` loads fonts via next/font, which SHADOWS `--font-inter`,
   `--font-mono`, and `--font-garamond` on `<html>` with its own stacks. So
   `var(--font-inter)` resolves to next/font's value at runtime, NOT
   `tokens.typography.fontSans` — migrating Button onto the var changed its
   rendered font and shifted widths ~2.5px. Rule: a site whose inline value
   was the **raw stack** (`fontSans`/`fontMono`/`fontSerif`) keeps that stack
   as a **verbatim literal** in CSS; only sites already using a `.family`
   value (which IS `'var(--font-*)'`) use the var. The rationale comment
   lives at the top of `ui.css` — reference it, don't re-derive it.
8. **Zero visual change.** Restyling urges get logged in the findings audit,
   not taken.

### The four shape archetypes (worked examples referenced by every batch)

**Shape A — static literal → rule.** `Card.tsx` today:

```tsx
<div data-ui="card" style={{ borderRadius: tokens.radius.lg, padding: PAD[padding] }} …>
```

becomes

```tsx
<div data-ui="card" data-padding={padding} …>
```

```css
[data-ui="card"] { border-radius: var(--radius-lg); }
[data-ui="card"][data-padding="sm"] { padding: 16px; }
[data-ui="card"][data-padding="md"] { padding: 24px; }
[data-ui="card"][data-padding="lg"] { padding: 32px; }
```

**Shape B — variant maps → data-modifiers.** `Button.tsx` builds
`VARIANT_STYLES`/`SIZE_STYLES` records and passes `style={combinedStyle}`. The
records become CSS; the component emits `data-ui="button" data-variant={variant}
data-size={size}` and keeps only the caller-supplied `style` passthrough:

```css
[data-ui="button"] {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; border-radius: var(--radius-md); font-weight: 600;
  text-decoration: none; cursor: pointer; border: 1px solid transparent;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}
[data-ui="button"][data-variant="primary"] {
  background: var(--color-accent); color: var(--color-text-inverted);
  border-color: var(--color-accent);
}
[data-ui="button"][data-variant="secondary"] {
  background: var(--color-surface); color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}
[data-ui="button"][data-variant="ghost"] {
  background: transparent; color: var(--color-accent); border-color: transparent;
}
[data-ui="button"][data-size="md"] { height: 40px; padding: 0 16px; font-size: 14px; }
[data-ui="button"][data-size="lg"] { height: 48px; padding: 0 22px; font-size: 16px; }
```

(Transcribe the actual current values from the component when implementing —
the component file is the source of truth, not this excerpt.)

**Shape C — hover handlers → `:hover`.** `Footer.tsx` today, 23 times:

```tsx
<Link href={l.href} style={linkStyle}
  onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
  onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
```

becomes

```tsx
<Link href={l.href} className="footer-link">
```

```css
.footer-link { color: var(--color-text-secondary); text-decoration: none; /* + rest of linkStyle */ }
.footer-link:hover { color: var(--color-accent); }
```

Delete both handlers. If the component then has no other client-side behaviour,
remove `'use client'` only when nothing else in the file needs it.

**Shape D — reused style variable → one rule.** `app/docs/licensing/page.tsx`
defines `const cellStyle: CSSProperties = {…}` used 9×. It becomes one class
used 9×. This is why the 106 variable-shaped sites are cheap: one rule, not N.

### Per-batch verification ritual (identical for every batch)

1. `npx tsx apps/website/scripts/check-style-migration.mts` — the value-equality
   report must show **0 mismatches / 0 unaccounted removals** (or each flagged
   line explained in the PR body — the tool is advisory and has known blind
   spots listed in its header).
2. Website vitest: exactly the 5 pre-existing failures.
3. Lint errors: 0.
4. Prod build: green.
5. **Manual spot check** on the batch's representative page: paste
   `apps/website/scripts/computed-style-snapshot.js` into the browser console
   on `main`'s dev server, save the JSON; check out the branch, repeat, diff
   the two JSONs. Any property delta on a migrated element is a defect.
   (~10 min; this is the only defence against cascade/specificity mistakes —
   the accepted-risk decision means there is no automated net behind it.)
6. Commit per file-group as specified; one PR per batch; arm auto-merge only
   after reading the AI review comments (CONTRIBUTING #728).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/styles/ui.css` | Batch 1 — `data-ui` primitives |
| `src/styles/chrome.css` | Batch 2 — Nav, Footer, AnnouncementToast |
| `src/styles/docs.css` | Batch 3 — docs chrome + mdx components + the `.docs-prose`/docs rules moved out of `global.css` |
| `src/styles/landing.css` | Batch 4 — landing blocks (incl. hoisted `<style>` tags) |
| `src/styles/marketing.css` | Batch 5 — pricing, blog, contact, solutions |
| `src/styles/pages.css` | Batch 6 — `app/**` route-level styling |
| `src/app/global.css` | Becomes index: imports + preflight/base element rules only |
| `src/app/page.module.css` | **Deleted** (empty, unused) |
| `apps/website/scripts/check-style-migration.mts` | Advisory value-equality checker |
| `apps/website/scripts/computed-style-snapshot.js` | Browser-console snapshot snippet for spot checks |
| `eslint.config.mjs` (repo root) | Final task — the guard rule |

---

## Task 0: Infrastructure (lands with Batch 1's PR)

**Files:**
- Create: `apps/website/src/styles/{ui,chrome,docs,landing,marketing,pages}.css`
- Modify: `apps/website/src/app/global.css` (add imports)
- Delete: `apps/website/src/app/page.module.css`
- Create: `apps/website/scripts/check-style-migration.mts`
- Create: `apps/website/scripts/computed-style-snapshot.js`

- [ ] **Step 1: Create the six scope files**, each with only a header:

```css
/*
 * <name>.css — presentation for <scope>, migrated from inline style props.
 *
 * Rules here are deliberately UNLAYERED: Tailwind v4 puts utilities in
 * @layer utilities, and unlayered author CSS beats all layers — which is
 * exactly the precedence the inline styles being replaced had. Wrapping
 * these in @layer would let utilities win and change rendering.
 *
 * Migration: docs/superpowers/plans/2026-08-29-inline-style-substrate-migration.md
 */
```

- [ ] **Step 2: Wire imports.** ~~after the `:root` block~~ **CORRECTED IN
BATCH 2: the imports MUST sit at the very top, directly after the two existing
`@import` lines.** Late `@import` is invalid CSS; the production pipeline
(Lightning CSS) forgives it by hoisting, but **turbopack dev silently DROPS
the imported files** — no error, the rules just never load, intermittently
across recompiles. It poisoned a verification baseline before being caught
(the nav logo measured Inter 400 where ui.css says Garamond 700). Add:

```css
@import "../styles/ui.css";
@import "../styles/chrome.css";
@import "../styles/docs.css";
@import "../styles/landing.css";
@import "../styles/marketing.css";
@import "../styles/pages.css";
```

- [ ] **Step 3: Delete the stub.** `git rm apps/website/src/app/page.module.css`
(verified: zero importers).

- [ ] **Step 4: Write the checker.** Create
`apps/website/scripts/check-style-migration.mts`:

```ts
#!/usr/bin/env tsx
/**
 * Advisory value-equality check for the inline-style migration.
 *
 * Diffs the working tree (or HEAD) against a base ref, extracts
 * `property: value` pairs REMOVED from .tsx style objects and pairs ADDED to
 * the migration CSS files, normalises both sides (camelCase→kebab, React
 * numeric px, tokens.* → resolved value, var(--x) → resolved value), and
 * reports removals with no matching addition plus per-property value changes.
 *
 * KNOWN BLIND SPOTS (by design — this is a text tool, not a harness):
 *   - cascade/specificity: a correct value can still lose to another rule;
 *   - shorthand vs longhand (`padding: '0 16px'` vs padding-top…);
 *   - selectors: it compares property/value multisets, not which element
 *     they apply to.
 * Treat every flagged line as a question to answer in the PR body, not
 * necessarily a bug.
 *
 * Usage: npx tsx apps/website/scripts/check-style-migration.mts [baseRef=origin/main]
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '../../../libs/design-tokens/src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'origin/main';

// --- resolve var(--x) via the committed theme.css + website-local :root vars
const themeCss = readFileSync(
  resolve(REPO, 'libs/design-tokens/src/lib/theme.css'), 'utf8');
const globalCss = readFileSync(
  resolve(REPO, 'apps/website/src/app/global.css'), 'utf8');
const cssVars = new Map<string, string>();
for (const m of (themeCss + globalCss).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g))
  cssVars.set(m[1], m[2].trim());

// --- resolve tokens.a.b.c to its value
function tokenValue(path: string): string | undefined {
  let cur: unknown = tokens;
  for (const k of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur == null || typeof cur === 'object' ? undefined : String(cur);
}

const UNITLESS = new Set(['line-height','font-weight','opacity','z-index',
  'flex','flex-grow','flex-shrink','order']);

function normProp(p: string): string {
  return p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}
function normValue(prop: string, raw: string): string {
  let v = raw.trim().replace(/^['"`]|['"`]$/g, '');
  const tok = v.match(/^tokens\.([a-zA-Z.]+)$/);
  if (tok) v = tokenValue(tok[1]) ?? v;
  v = v.replace(/var\((--[a-z0-9-]+)\)/g, (_, name) => cssVars.get(name) ?? _);
  if (/^-?\d+(\.\d+)?$/.test(v) && !UNITLESS.has(prop)) v = `${v}px`;
  return v.replace(/\s+/g, ' ').toLowerCase();
}

function diffLines(pathspec: string, sign: '+' | '-'): string[] {
  const out = execSync(
    `git diff -U0 ${BASE} -- ${pathspec}`, { cwd: REPO, encoding: 'utf8' });
  return out.split('\n')
    .filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3)))
    .map((l) => l.slice(1));
}

// pairs removed from TSX (style-object members: `foo: bar,`)
const removed = new Map<string, number>();
for (const line of diffLines("'apps/website/src/**/*.tsx'", '-')) {
  const m = line.match(/^\s*([a-zA-Z]+):\s*(.+?),?\s*$/);
  if (!m) continue;
  const prop = normProp(m[1]);
  if (!/^[a-z-]+$/.test(prop)) continue;
  const key = `${prop} :: ${normValue(prop, m[2])}`;
  removed.set(key, (removed.get(key) ?? 0) + 1);
}
// pairs added to migration CSS
const added = new Map<string, number>();
for (const line of diffLines(
  "'apps/website/src/styles/*.css' 'apps/website/src/app/global.css'", '+')) {
  for (const m of line.matchAll(/([a-z-]+):\s*([^;{}]+);/g)) {
    const key = `${m[1]} :: ${normValue(m[1], m[2])}`;
    added.set(key, (added.get(key) ?? 0) + 1);
  }
}

let flagged = 0;
for (const [key, n] of [...removed.entries()].sort()) {
  if (!added.has(key)) {
    console.log(`REMOVED, NO MATCHING CSS  (${n}x)  ${key}`);
    flagged++;
  }
}
console.log(`\n${removed.size} distinct pairs removed, ${added.size} added, ${flagged} unaccounted.`);
if (flagged > 0 && process.argv.includes('--strict')) process.exit(1);
```

- [ ] **Step 5: Write the snapshot snippet.** Create
`apps/website/scripts/computed-style-snapshot.js`:

```js
/**
 * Paste into the browser console on a page BEFORE and AFTER a migration
 * batch (on main's dev server, then the branch's), then diff the two JSONs.
 * Serialises computed styles for every element carrying a migration hook.
 */
(() => {
  const PROPS = ['color','background-color','border-color','border-radius',
    'font-size','font-family','font-weight','line-height','letter-spacing',
    'padding','margin','gap','height','width','max-width','box-shadow',
    'display','align-items','justify-content','text-transform','opacity'];
  const hooks = document.querySelectorAll(
    '[data-ui],[data-mdx],[data-docs-navlink],[class]');
  const out = {};
  hooks.forEach((el, i) => {
    const key = `${el.tagName}#${el.id || i}.${el.getAttribute('data-ui')
      || el.getAttribute('data-mdx') || String(el.className).slice(0, 40)}`;
    const cs = getComputedStyle(el);
    out[key] = Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)]));
  });
  copy(JSON.stringify(out, null, 1));
  return `snapshot of ${hooks.length} elements copied to clipboard`;
})();
```

- [ ] **Step 6: Smoke the checker on a no-op tree.** Run
`npx tsx apps/website/scripts/check-style-migration.mts HEAD` — expected:
`0 distinct pairs removed, 0 added, 0 unaccounted.` Then mutation-test it:
temporarily delete one `style={{…}}` line from any component, rerun against
`HEAD`, confirm it reports the removed pairs; revert.

- [ ] **Step 7: Verify the empty imports build.** Prod build + dev server
renders the homepage unchanged.

- [ ] **Step 8: Commit** —
`feat(website): scaffold the style-migration file layout and checker`

---

## Task 1 / Batch 1: `components/ui` → `ui.css` (25 sites, 11 files) — PR 1

The pattern-setter. 9 of 11 files already emit a `data-ui` hook.

**Inventory and shapes:**

| file | sites | shape / gotcha |
|---|---:|---|
| `BrowserFrame.tsx` | 9 | A; hooks `browser-frame`/`browser-frame-body` exist |
| `FAQ.tsx` | 5 | A; `faq-item`/`faq-chevron` rules already in global.css — extend them |
| `ClipPlayer.tsx` | 2 | A; **add** `data-ui="clip-player"` |
| `LogoMark.tsx` | 2 | A + size prop → `data-size` |
| `TabGroup.tsx` | 2 | A; **add** `data-ui="tab-group"`; active-tab state → `data-active` |
| `Button.tsx` | 2 (var) | **B — the worked example above.** Keep caller `style` passthrough |
| `Card.tsx` | 1 | A — worked example; `PAD` map → `data-padding` |
| `Container.tsx` / `Eyebrow.tsx` / `Pill.tsx` / `Section.tsx` | 1 each | A; Pill/Eyebrow variants → `data-variant` |

- [ ] Step 1: migrate `Card`, `Container`, `Eyebrow`, `Pill`, `Section` (the
  five one-siters). Run checker + vitest. Commit:
  `refactor(website): move ui primitive resting styles to ui.css (1/3)`
- [ ] Step 2: migrate `Button` (shape B) + `FAQ` + `LogoMark`. Note `Button`
  merges caller `style` last — that passthrough **stays**. Commit (2/3).
- [ ] Step 3: migrate `BrowserFrame`, `ClipPlayer`, `TabGroup` (add their
  hooks). Commit (3/3).
- [ ] Step 4: full verification ritual. Spot-check page: `/` (homepage uses
  every primitive). Also move the existing `[data-ui="card"]`, `faq`, and
  `heading-anchor`-adjacent primitive rules from `global.css` into `ui.css`
  (pure cut-paste — they are already CSS).
- [ ] Step 5: PR — `refactor(website): batch 1 — ui primitives off inline styles`.
  Body includes checker output and the spot-check verdict. Auto-merge on green
  after reading AI review.

---

## Task 2 / Batch 2: `components/shared` → `chrome.css` (76 sites, 3 files) — PR 2

| file | sites | shape / gotcha |
|---|---:|---|
| `Nav.tsx` | 33 | A + C (5 hover handlers) + two dropdowns; `tabStyle`/`subTabStyle` functions → `data-active` modifier rules (shape B). Keep: `top: 57` overlay offset stays until Project 3's `--nav-h` work — migrate it verbatim as a literal. |
| `Footer.tsx` | 30 | **C ×23** — the hover-handler motherlode. One `.footer-link` class + `:hover` rule replaces 46 handler props. |
| `AnnouncementToast.tsx` | 13 | A; keep the entrance-animation state inline if it interpolates, else migrate. |

- [ ] Step 1: `Footer.tsx` alone (biggest single-file win). Commit.
- [ ] Step 2: `Nav.tsx`. Desktop links, dropdowns, mobile overlay each get
  `.nav-*` classes. Commit.
- [ ] Step 3: `AnnouncementToast.tsx`. Commit.
- [ ] Step 4: ritual. Spot-check pages: `/` **and** `/docs/chat/components/chat`
  (nav renders docs-mode UI), both desktop and 375px (mobile overlay).
  Extra check: hamburger, both dropdowns, and the mobile docs tree still
  open/close — `Nav` keeps `'use client'` (it has real state).
- [ ] Step 5: PR — auto-merge on green.

---

## Task 3 / Batch 3: `components/docs` → `docs.css` (~180 sites, 22 files) — PR 3

Unblocks Project 3. Also: move every existing docs rule out of `global.css`
into `docs.css` (`.docs-prose`, `.docs-table-scroll`, code-figure rules, the
`--docs-*` local constants block, heading anchors) — pure cut-paste, zero edits.

| file | sites | gotcha |
|---|---:|---|
| `ApiDocRenderer.tsx` | 29 | A throughout; tables get `.api-doc-*` classes |
| `ArchFlowDiagram.tsx` | 23 + `<style>` tag | hoist tag per convention 5 |
| `DocsSidebar.tsx` | 21 + `<style>` tag | the tag interpolates `${tokens.*}` → `var(--*)`; `[data-docs-navlink]` rules move here |
| `ApiRefTable.tsx` | 11 | A |
| `AgUiArchDiagram.tsx` | 10 | `.ag-ui-arch-grid` rules already in global.css — reunite them here |
| `DocsSearch.tsx` | 9 | A; overlay/positioning static → migrate; keyboard-selected row → `data-selected` |
| `DocsPrevNext.tsx` | 9 | A |
| `DocsBreadcrumb.tsx` | 9 | A; migrate **verbatim** — do NOT fix the alignment bug here (that is Project 3; a fix mixed into a migration diff is unreviewable) |
| `mdx/Steps.tsx`, `mdx/Card.tsx` | 8 each | A; Steps' connector stays per-step for now (Project 3 adds `:last-child`) |
| `PageActions.tsx`, `mdx/FeatureChips.tsx` | 6 each | C ×1 in FeatureChips |
| `mdx/Callout.tsx` | 5 | tone map → `data-tone` (attribute already emitted!) |
| `CodeGroup`, `DocsPageHeader` | 4 each | C ×1 in CodeGroup |
| `Tabs`, `CodeBlock`, `LibraryMark`, `DocsTOC` | 3 each | C ×1 in Tabs; TOC active state → `data-active` |
| `MdxRenderer`, `CopyPromptButton`, `CopyButton` | 1 each | MdxRenderer's `--tw-prose-*` custom-prop object is **already the escape hatch** — stays |

- [ ] Step 1: cut-paste the existing docs rules from `global.css` → `docs.css`.
  Prod build + spot check must show **zero** change. Commit.
- [ ] Step 2: mdx components (9 files). Commit.
- [ ] Step 3: sidebar + search + TOC + breadcrumb + header + actions. Commit.
- [ ] Step 4: API renderers + diagrams (hoisting both `<style>` tags). Commit.
- [ ] Step 5: ritual. Spot-check: `/docs/chat/components/chat` (densest page)
  at 1280 and 375. PR; auto-merge on green.

---

## Task 4 / Batch 4: `components/landing` → `landing.css` (~166 sites + 10 `<style>` tags, 17 files) — PR 4

Every file listed hoists its `<style>` tag (10 of 17 have one) and migrates its
style props. Files: `WhitePaperBlock` 20, `Differentiator` 15, `PilotBlock` 13,
`Hero` 13, `FeatureBlock` 13, `EcosystemStrip` 13, `DemoModal` 12,
`DemoShowcase` 9, three `*CodeShowcase` 8 each, `Promises` 7, `RecentArticles` 6,
`FinalCTA` 5, `BackendsGrid` 4, `HomeFAQ` 4, `HighlightedCode` 1.

Gotchas: the `<style>` tags already use semantic classes (`.why-row`,
`.wp-grid`, `.hero-grid`) — keep those names. `DemoModal` iframe sizing that
depends on runtime measurement stays inline. `ClipPlayer` consumers must not
re-declare what Batch 1 already put in `ui.css`.

- [ ] Step 1: `Hero`, `FeatureBlock`, `Differentiator`, `WhitePaperBlock`. Commit.
- [ ] Step 2: `PilotBlock`, `EcosystemStrip`, `Promises`, `RecentArticles`,
  `FinalCTA`, `HomeFAQ`, `BackendsGrid`. Commit.
- [ ] Step 3: `DemoModal`, `DemoShowcase`, the three code showcases,
  `HighlightedCode`. Commit.
- [ ] Step 4: ritual. Spot-check: `/` at 1280 / 768 / 375 — this batch owns the
  page with the known 320px overflow bugs; they must be **unchanged, not fixed**.
  PR; auto-merge on green.

---

## Task 5 / Batch 5: pricing + blog + contact + solutions → `marketing.css` (~112 sites, 15 files) — PR 5

Files: `CompareTable` 31, `LeadForm` 29, `ContactForm` 14, `CompatibilityMatrix` 7,
`AltChannelRow` 6, `PostCard` 6, `SolutionDemoBlock` 6, `SolutionCodeBlock` 6,
`FeaturedPostCard` 5, `BlogTagFilter` 5, `PricingFAQ` 4, `AuthorByline` 4,
`SlaCard` 2, `TagChips` 2, `GitHubStarsPill` 1.

Gotchas: `LeadForm`/`ContactForm` have focus/validation states — those become
`:focus-visible` and `data-invalid` rules (shape B/C), and the forms keep
`'use client'`. `CompareTable`'s repeated cell styles are shape D — a handful
of classes replace 31 sites.

- [ ] Step 1: pricing (4 files). Commit. Step 2: blog (6 files). Commit.
  Step 3: contact + solutions (5 files). Commit.
- [ ] Step 4: ritual. Spot-check: `/pricing`, `/blog`, `/contact` at 1280/375.
  **Note:** `PostCard.spec.tsx` and `Differentiator.spec.tsx` are two of the 5
  pre-existing failures — they must fail in exactly the same way after
  migration (content assertions, not style). PR; auto-merge on green.

---

## Task 6 / Batch 6: `app/**` routes → `pages.css` — TWO PRs

**6a — docs-adjacent pages (~115 sites): PR 6.**
`app/docs/licensing/page.tsx` 61 (30 shape-D variables), `app/docs/page.tsx` 50
(33 shape-D), `app/docs/choosing-an-adapter/page.tsx` 2,
`app/docs/[library]/[section]/[slug]/page.tsx` 2.

The shape-D density makes this cheap: `bodyStyle`, `cellStyle`, `headingStyle`
etc. each become one class. The docs shell's `overflow-x-hidden` + `paddingTop: 80`
migrate **verbatim** — Project 3 changes them, not this.

- [ ] Migrate, one commit per page file. Ritual; spot-check `/docs` and
  `/docs/licensing`. PR; auto-merge on green.

**6b — remaining routes (~192 sites): PR 7.**
`solutions/[slug]` 28, `pilot-to-prod` 28, `about` 23, `solutions` 15,
`render` 12, `chat` 11, `ag-ui` 11, `blog` 10, `langgraph` 9, `blog/[slug]` 8,
`thanks` 7, `error` 7, `pricing` 6, `page` 6, `contact` 6, `not-found` 5.
(Excluded, restated: both `opengraph-image.tsx`, `dev/primitives`.)

- [ ] Migrate in three commits (solutions+pilot+about / library landing pages /
  the rest). Ritual; spot-check `/about`, `/pilot-to-prod`, `/langgraph`.
  PR; auto-merge on green.

---

## Task 7: The ESLint guard — PR 8

Only after Batch 6b merges (landing it earlier means hundreds of suppressions).

**Files:** Modify `eslint.config.mjs` (repo root).

- [ ] **Step 1:** Read the existing flat config; append a block **preserving its
  structure**:

```js
// Inline-style guard — apps/website migrated off static inline styles
// (docs/superpowers/specs/2026-08-29-inline-style-substrate-migration-design.md).
// Flags identifier-keyed members of a style object literal. The escape hatch
// for dynamic values — style={{ '--x': value }} — uses string-literal keys and
// passes. Genuinely dynamic identifier-keyed values (rare) get a targeted
// eslint-disable-next-line with a reason.
{
  files: ['apps/website/src/**/*.tsx'],
  ignores: [
    'apps/website/src/app/opengraph-image.tsx',
    'apps/website/src/app/blog/[slug]/opengraph-image.tsx', // Satori: inline-only
    'apps/website/src/**/*.spec.tsx',
  ],
  rules: {
    'no-restricted-syntax': ['warn', {
      selector:
        'JSXAttribute[name.name="style"] > JSXExpressionContainer > ObjectExpression > Property[key.type="Identifier"]',
      message:
        'Static presentation belongs in src/styles/*.css (see the substrate-migration spec). For dynamic values, set a CSS custom property: style={{ \'--x\': value }}.',
    }],
  },
},
```

- [ ] **Step 2: Prove it fires and doesn't over-fire.** Add a scratch
`style={{ color: 'red' }}` to any component → lint reports it. Change to
`style={{ '--x': v }}` → silent. Revert. Confirm repo-wide warn count is small
(only the deliberate dynamic stragglers) and **error count is 0** — CI fails on
errors only.
- [ ] **Step 3:** Escalate `'warn'` → `'error'` in a follow-up one release later
(note it in the PR body as a deliberate two-step).
- [ ] **Step 4:** PR — `chore(website): lint guard against new static inline styles`.

---

## Completion definition

- `grep -rc 'style={{' apps/website/src` counts only: the two Satori files,
  `dev/primitives`, custom-property escape hatches, and documented dynamic
  values.
- Zero embedded `<style>` tags outside `*.spec.tsx`.
- `global.css` contains only imports, preflight, base element rules, and the
  `--docs-*` constants (or those moved to `docs.css` — either, but one place).
- Website vitest: same 5 pre-existing failures, no more.
- The ESLint guard is live at `warn`.
- Project 3 can begin: every selector it needs (`:hover`, `:focus-visible`,
  `:last-child`, media queries) now has a stylesheet to live in.
