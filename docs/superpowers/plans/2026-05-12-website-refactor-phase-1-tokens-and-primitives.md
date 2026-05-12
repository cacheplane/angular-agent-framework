# Website refactor — Phase 1: Tokens + UI primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the foundational design tokens and UI primitives needed to refactor `apps/website` to the new Statusbrew-inspired SaaS aesthetic — without yet changing any visible page.

**Architecture:**
- **Tokens** are added *additively* to the existing `@ngaf/design-tokens` library (`libs/design-tokens`). Old `glass`, `gradient`, and `glow` namespaces remain untouched so existing components keep working. New `surfaces`, `shadow`, `radius`, `space` namespaces are introduced; `colors` and `typography` get new properties.
- **CSS custom properties** mirror the new tokens. Tailwind v4 `@theme` block in `apps/website/src/app/global.css` gets new variables (existing ones stay).
- **UI primitives** live under `apps/website/src/components/ui/`. Each is a focused presentational component (server-rendered unless interactive). They are styled via inline `style={}` props using the new tokens (matching the existing codebase pattern) plus a `cn()` helper for any class composition.
- **Verification** is via a temporary `/_dev/primitives` route that renders one of each primitive, asserted by Playwright. No visible site changes — this route is dev-only and will be deleted in a later phase.

**Tech Stack:** TypeScript, Next.js 16 (React 19, RSC), Tailwind v4, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, Playwright.

**Out of scope for this phase:**
- Any change to user-facing pages (homepage, marketing routes)
- Removal of old `glass` / `gradient` / `glow` tokens (Phase 6)
- Refactor of `Nav`/`Footer`/`AnnouncementToast` (Phase 2)
- Screenshot capture (Phase 3)

---

## File Structure

**Created:**
```
libs/design-tokens/src/lib/
├── surfaces.ts              (new — page/card backgrounds + borders)
├── shadows.ts               (new — elevation + focus ring)
├── radius.ts                (new — corner radii)
└── space.ts                 (new — section/container spacing scale)

apps/website/src/lib/
└── cn.ts                    (new — clsx + tailwind-merge helper)

apps/website/src/components/ui/
├── Container.tsx
├── Section.tsx
├── Eyebrow.tsx
├── Pill.tsx
├── Button.tsx
├── Card.tsx
├── BrowserFrame.tsx
├── LogoMark.tsx
└── FAQ.tsx                  (client component)

apps/website/src/app/_dev/primitives/
└── page.tsx                 (dev-only showcase route)

apps/website/e2e/
└── primitives.spec.ts       (Playwright assertions for each primitive)
```

**Modified:**
```
libs/design-tokens/src/lib/colors.ts          (add new color tokens)
libs/design-tokens/src/lib/typography.ts      (add type-scale tokens)
libs/design-tokens/src/lib/tokens.ts          (re-export new namespaces)
libs/design-tokens/src/lib/tokens.css         (mirror new tokens as CSS vars)
libs/design-tokens/src/lib/tokens.spec.ts     (assertions for new tokens)
libs/design-tokens/src/index.ts               (export new namespaces)
libs/design-tokens/package.json               (version bump 0.0.29 → 0.0.30)
apps/website/lib/design-tokens.ts             (re-export from @ngaf/design-tokens)
apps/website/src/app/global.css               (additive @theme variables)
```

---

## Task 1: Add `surfaces` token namespace to `@ngaf/design-tokens`

**Files:**
- Create: `libs/design-tokens/src/lib/surfaces.ts`
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

In `libs/design-tokens/src/lib/tokens.spec.ts`, add at the end of the file:

```typescript
import { surfaces } from './surfaces';

describe('surfaces tokens', () => {
  it('exposes canvas, surface, surfaceTinted, surfaceDim, border, borderStrong', () => {
    expect(surfaces.canvas).toBe('#fafbfc');
    expect(surfaces.surface).toBe('#ffffff');
    expect(surfaces.surfaceTinted).toBe('#f4f6fb');
    expect(surfaces.surfaceDim).toBe('#eef1f7');
    expect(surfaces.border).toBe('#e6e8ee');
    expect(surfaces.borderStrong).toBe('#d2d6e0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens` (or whatever Nx runner is configured — check `libs/design-tokens/project.json` for the exact target name; could be `pnpm nx run design-tokens:test` or `npx nx test design-tokens`)
Expected: FAIL — "Cannot find module './surfaces'"

- [ ] **Step 3: Create the surfaces file**

Create `libs/design-tokens/src/lib/surfaces.ts`:

```typescript
/**
 * Surface tokens — backgrounds and borders for the marketing site.
 *
 * Replaces the older `bg`/`sidebarBg`/`glass` surfaces. Use these for any
 * new component; legacy components may still consume `colors.bg` until
 * the Phase 6 cleanup.
 */
export const surfaces = Object.freeze({
  /** Page background — near-white */
  canvas: '#fafbfc',
  /** Pure white — cards, frames, nav */
  surface: '#ffffff',
  /** Alternating section tint — slightly cool */
  surfaceTinted: '#f4f6fb',
  /** Stronger tint — pricing-card highlight, callouts */
  surfaceDim: '#eef1f7',
  /** Default 1px hairline */
  border: '#e6e8ee',
  /** Emphasized border — focused inputs, hovered cards */
  borderStrong: '#d2d6e0',
} as const);

export type Surfaces = typeof surfaces;
```

- [ ] **Step 4: Wire it into the aggregator and index**

In `libs/design-tokens/src/lib/tokens.ts`, add the import and include `surfaces` in the `tokens` object:

```typescript
import { colors } from './colors';
import { glass } from './glass';
import { gradient } from './gradients';
import { glow } from './glow';
import { typography } from './typography';
import { surfaces } from './surfaces';

export const tokens = {
  colors,
  glass,
  gradient,
  glow,
  typography,
  surfaces,
} as const;

export type Tokens = typeof tokens;
```

In `libs/design-tokens/src/index.ts`, add the line:

```typescript
export { surfaces, type Surfaces } from './lib/surfaces';
```

(Place it after the other `export { …, type … }` lines.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test design-tokens` (or the equivalent runner discovered in Step 2)
Expected: PASS — all `surfaces tokens` cases green; no regressions in existing tests.

- [ ] **Step 6: Commit**

```bash
git add libs/design-tokens/src/lib/surfaces.ts libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/index.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add surfaces namespace"
```

---

## Task 2: Add `shadows` token namespace

**Files:**
- Create: `libs/design-tokens/src/lib/shadows.ts`
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/design-tokens/src/lib/tokens.spec.ts`:

```typescript
import { shadows } from './shadows';

describe('shadows tokens', () => {
  it('exposes sm, md, lg, focus', () => {
    expect(shadows.sm).toBe('0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)');
    expect(shadows.md).toBe('0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)');
    expect(shadows.lg).toBe('0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)');
    expect(shadows.focus).toBe('0 0 0 3px rgba(0, 64, 144, 0.25)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens`
Expected: FAIL — "Cannot find module './shadows'"

- [ ] **Step 3: Create the shadows file**

Create `libs/design-tokens/src/lib/shadows.ts`:

```typescript
/**
 * Elevation shadows for the marketing surface.
 *
 * `sm`/`md`/`lg` form a three-step elevation scale. `focus` is the
 * keyboard focus ring used on interactive primitives.
 */
export const shadows = Object.freeze({
  /** Subtle — default card */
  sm: '0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)',
  /** Moderate — hovered card, dropdown */
  md: '0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)',
  /** Strong — floating elements, hero collage */
  lg: '0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)',
  /** Keyboard focus ring */
  focus: '0 0 0 3px rgba(0, 64, 144, 0.25)',
} as const);

export type Shadows = typeof shadows;
```

- [ ] **Step 4: Wire it into the aggregator and index**

In `libs/design-tokens/src/lib/tokens.ts`, add `import { shadows } from './shadows';` and include `shadows` in the `tokens` object.

In `libs/design-tokens/src/index.ts`, add:

```typescript
export { shadows, type Shadows } from './lib/shadows';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test design-tokens`
Expected: PASS — all `shadows tokens` cases green.

- [ ] **Step 6: Commit**

```bash
git add libs/design-tokens/src/lib/shadows.ts libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/index.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add shadows namespace"
```

---

## Task 3: Add `radius` token namespace

**Files:**
- Create: `libs/design-tokens/src/lib/radius.ts`
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { radius } from './radius';

describe('radius tokens', () => {
  it('exposes sm, md, lg, xl, full', () => {
    expect(radius.sm).toBe('6px');
    expect(radius.md).toBe('10px');
    expect(radius.lg).toBe('14px');
    expect(radius.xl).toBe('20px');
    expect(radius.full).toBe('999px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens`
Expected: FAIL — "Cannot find module './radius'"

- [ ] **Step 3: Create the radius file**

Create `libs/design-tokens/src/lib/radius.ts`:

```typescript
/**
 * Border radius scale.
 *
 * `sm` for compact controls (pills, small buttons), `md` for standard
 * cards/buttons, `lg` for hero cards and frames, `xl` for prominent
 * containers. `full` is for fully-rounded shapes (avatars, status dots).
 */
export const radius = Object.freeze({
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '999px',
} as const);

export type Radius = typeof radius;
```

- [ ] **Step 4: Wire it in**

`libs/design-tokens/src/lib/tokens.ts`: add `import { radius } from './radius';` and `radius` in the `tokens` object.

`libs/design-tokens/src/index.ts`: add `export { radius, type Radius } from './lib/radius';`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test design-tokens`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/design-tokens/src/lib/radius.ts libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/index.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add radius namespace"
```

---

## Task 4: Add `space` token namespace

**Files:**
- Create: `libs/design-tokens/src/lib/space.ts`
- Modify: `libs/design-tokens/src/lib/tokens.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { space } from './space';

describe('space tokens', () => {
  it('exposes section + container scale', () => {
    expect(space.sectionY).toBe('clamp(64px, 8vw, 120px)');
    expect(space.sectionYTight).toBe('clamp(48px, 6vw, 80px)');
    expect(space.containerX).toBe('clamp(20px, 4vw, 40px)');
    expect(space.containerMax).toBe('1200px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens`
Expected: FAIL — "Cannot find module './space'"

- [ ] **Step 3: Create the space file**

Create `libs/design-tokens/src/lib/space.ts`:

```typescript
/**
 * Section and container spacing scale.
 *
 * `sectionY` is the standard vertical breathing room around each
 * marketing section (clamps between 64px mobile and 120px desktop).
 * `sectionYTight` is for compact sections (proof strip, final CTA).
 * `containerX` is the horizontal page padding. `containerMax` is the
 * max content width before the page gutters take over.
 */
export const space = Object.freeze({
  sectionY: 'clamp(64px, 8vw, 120px)',
  sectionYTight: 'clamp(48px, 6vw, 80px)',
  containerX: 'clamp(20px, 4vw, 40px)',
  containerMax: '1200px',
} as const);

export type Space = typeof space;
```

- [ ] **Step 4: Wire it in**

`libs/design-tokens/src/lib/tokens.ts`: add `import { space } from './space';` and `space` in the `tokens` object.

`libs/design-tokens/src/index.ts`: add `export { space, type Space } from './lib/space';`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test design-tokens`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/design-tokens/src/lib/space.ts libs/design-tokens/src/lib/tokens.ts libs/design-tokens/src/index.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add space namespace"
```

---

## Task 5: Extend `colors` with new accents and text-inverted

**Files:**
- Modify: `libs/design-tokens/src/lib/colors.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `libs/design-tokens/src/lib/tokens.spec.ts`:

```typescript
import { colors as colorsForExtension } from './colors';

describe('colors tokens — extensions', () => {
  it('exposes accentHover and textInverted', () => {
    expect(colorsForExtension.accentHover).toBe('#003070');
    expect(colorsForExtension.textInverted).toBe('#ffffff');
  });

  it('keeps existing tokens unchanged (no breaking change)', () => {
    expect(colorsForExtension.accent).toBe('#004090');
    expect(colorsForExtension.angularRed).toBe('#DD0031');
    expect(colorsForExtension.textPrimary).toBe('#1a1a2e');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens`
Expected: FAIL — `accentHover` and `textInverted` are undefined.

- [ ] **Step 3: Add the new color properties**

In `libs/design-tokens/src/lib/colors.ts`, add to the `colors` object (preserve all existing properties — these are additive):

```typescript
  /** Hovered state of the primary accent */
  accentHover: '#003070',
  /** Inverted text — for use on dark/accent backgrounds */
  textInverted: '#ffffff',
```

Place them immediately after the existing `accentSurface` property to keep accent-related tokens grouped. Do not remove or change any existing property.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test design-tokens`
Expected: PASS — both new keys present, all existing assertions still green.

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/src/lib/colors.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add accentHover and textInverted colors"
```

---

## Task 6: Extend `typography` with a type-scale

**Files:**
- Modify: `libs/design-tokens/src/lib/typography.ts`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { typography as typographyForExtension } from './typography';

describe('typography tokens — type scale', () => {
  it('exposes h1/h2/h3/eyebrow/bodyLg/body/caption scale', () => {
    expect(typographyForExtension.h1.size).toBe('clamp(48px, 6vw, 72px)');
    expect(typographyForExtension.h1.family).toBe('var(--font-garamond)');
    expect(typographyForExtension.h2.size).toBe('clamp(36px, 4.5vw, 56px)');
    expect(typographyForExtension.h3.size).toBe('28px');
    expect(typographyForExtension.h3.weight).toBe(600);
    expect(typographyForExtension.eyebrow.size).toBe('12px');
    expect(typographyForExtension.eyebrow.transform).toBe('uppercase');
    expect(typographyForExtension.bodyLg.size).toBe('20px');
    expect(typographyForExtension.body.size).toBe('16px');
    expect(typographyForExtension.caption.size).toBe('14px');
  });

  it('keeps existing font-family tokens unchanged', () => {
    expect(typographyForExtension.fontSerif).toBe('"EB Garamond", Georgia, serif');
    expect(typographyForExtension.fontSans).toBe('Inter, system-ui, sans-serif');
    expect(typographyForExtension.fontMono).toBe('"JetBrains Mono", monospace');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test design-tokens`
Expected: FAIL — `h1`, `h2`, etc. are undefined.

- [ ] **Step 3: Add the type-scale**

Rewrite `libs/design-tokens/src/lib/typography.ts` to keep existing fields and add the scale:

```typescript
/**
 * Typography tokens — font families and type scale used across the design system.
 *
 * - Serif (EB Garamond): Headlines, elegant emphasis
 * - Sans (Inter): Body text, UI elements
 * - Mono (JetBrains Mono): Code, labels, metadata
 *
 * The h1/h2/h3/eyebrow/bodyLg/body/caption objects are the type scale
 * used by the marketing-site UI primitives. Each entry includes
 * `size`, `line`, `family`, and (where relevant) `weight`,
 * `letterSpacing`, `transform`.
 */
export const typography = {
  /** Serif font for headings */
  fontSerif: '"EB Garamond", Georgia, serif',
  /** Sans-serif font for body text */
  fontSans: 'Inter, system-ui, sans-serif',
  /** Monospace font for code and labels */
  fontMono: '"JetBrains Mono", monospace',

  h1: {
    size: 'clamp(48px, 6vw, 72px)',
    line: 1.08,
    family: 'var(--font-garamond)',
  },
  h2: {
    size: 'clamp(36px, 4.5vw, 56px)',
    line: 1.12,
    family: 'var(--font-garamond)',
  },
  h3: {
    size: '28px',
    line: 1.25,
    family: 'var(--font-inter)',
    weight: 600,
  },
  eyebrow: {
    size: '12px',
    line: 1.4,
    family: 'var(--font-mono)',
    weight: 700,
    letterSpacing: '0.12em',
    transform: 'uppercase' as const,
  },
  bodyLg: {
    size: '20px',
    line: 1.6,
    family: 'var(--font-inter)',
  },
  body: {
    size: '16px',
    line: 1.6,
    family: 'var(--font-inter)',
  },
  caption: {
    size: '14px',
    line: 1.5,
    family: 'var(--font-inter)',
  },
} as const;

export type Typography = typeof typography;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test design-tokens`
Expected: PASS — type scale present, existing `fontSerif`/`fontSans`/`fontMono` unchanged.

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/src/lib/typography.ts libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add type scale to typography"
```

---

## Task 7: Mirror new tokens as CSS custom properties

**Files:**
- Modify: `libs/design-tokens/src/lib/tokens.css`

- [ ] **Step 1: Open the file**

Read `libs/design-tokens/src/lib/tokens.css` to understand the existing structure. Tokens use the `--ds-{category}-{name}` prefix and are grouped by section.

- [ ] **Step 2: Append new sections at the bottom of `:root`**

Add these blocks to the end of the `:root` block (just before the closing `}`):

```css
  /* Surfaces */
  --ds-canvas: #fafbfc;
  --ds-surface: #ffffff;
  --ds-surface-tinted: #f4f6fb;
  --ds-surface-dim: #eef1f7;
  --ds-border: #e6e8ee;
  --ds-border-strong: #d2d6e0;

  /* Shadows */
  --ds-shadow-sm: 0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03);
  --ds-shadow-md: 0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04);
  --ds-shadow-lg: 0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05);
  --ds-shadow-focus: 0 0 0 3px rgba(0, 64, 144, 0.25);

  /* Radius */
  --ds-radius-sm: 6px;
  --ds-radius-md: 10px;
  --ds-radius-lg: 14px;
  --ds-radius-xl: 20px;
  --ds-radius-full: 999px;

  /* Space */
  --ds-section-y: clamp(64px, 8vw, 120px);
  --ds-section-y-tight: clamp(48px, 6vw, 80px);
  --ds-container-x: clamp(20px, 4vw, 40px);
  --ds-container-max: 1200px;

  /* Colors — extensions */
  --ds-accent-hover: #003070;
  --ds-text-inverted: #ffffff;

  /* Typography — type scale */
  --ds-h1-size: clamp(48px, 6vw, 72px);
  --ds-h1-line: 1.08;
  --ds-h2-size: clamp(36px, 4.5vw, 56px);
  --ds-h2-line: 1.12;
  --ds-h3-size: 28px;
  --ds-h3-line: 1.25;
  --ds-h3-weight: 600;
  --ds-eyebrow-size: 12px;
  --ds-eyebrow-line: 1.4;
  --ds-eyebrow-weight: 700;
  --ds-eyebrow-spacing: 0.12em;
  --ds-body-lg-size: 20px;
  --ds-body-size: 16px;
  --ds-caption-size: 14px;
```

Do not touch any of the existing variable declarations.

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/src/lib/tokens.css
git commit -m "feat(design-tokens): mirror new tokens as CSS custom properties"
```

---

## Task 8: Bump `@ngaf/design-tokens` patch version

**Files:**
- Modify: `libs/design-tokens/package.json`

Per the repo's release policy (memory: "Patch-only releases at 0.0.x — always increment patch even for breaking changes"), bump the patch only.

- [ ] **Step 1: Update version**

In `libs/design-tokens/package.json`, change:

```diff
-  "version": "0.0.29",
+  "version": "0.0.30",
```

- [ ] **Step 2: Build the package**

Run: `pnpm nx build design-tokens` (or the equivalent — check `libs/design-tokens/project.json` if the target name differs).
Expected: build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add libs/design-tokens/package.json
git commit -m "chore(design-tokens): bump to 0.0.30"
```

---

## Task 9: Reconcile the website's local `design-tokens.ts`

**Files:**
- Modify: `apps/website/lib/design-tokens.ts`

The local file is a stale partial duplicate of the lib. Replace it with a re-export from `@ngaf/design-tokens` so the website has exactly one source of truth.

- [ ] **Step 1: Confirm import shape**

Run: `grep -rn "from '../../lib/design-tokens'\\|from '../../../lib/design-tokens'" apps/website/src 2>/dev/null | head -10`

Note all callers that import from the local path. They should still get a `tokens` object with the same shape after our change.

- [ ] **Step 2: Replace file contents**

Overwrite `apps/website/lib/design-tokens.ts` with:

```typescript
/**
 * Website-local re-export of the shared design tokens.
 *
 * Kept as a barrel so existing imports of the form
 * `import { tokens } from '../../lib/design-tokens'` keep working.
 * New code should import directly from `@ngaf/design-tokens`.
 */
export { tokens, type Tokens } from '@ngaf/design-tokens';
export {
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
```

- [ ] **Step 3: Type-check the website**

Run: `pnpm nx typecheck website` (or `pnpm nx run website:typecheck` — check `apps/website/project.json` for the exact target).
Expected: no errors. All existing `tokens.colors.*`, `tokens.glass.*`, `tokens.gradient.*` usages still resolve because the aggregator still includes those namespaces.

- [ ] **Step 4: Commit**

```bash
git add apps/website/lib/design-tokens.ts
git commit -m "refactor(website): re-export design tokens from @ngaf/design-tokens"
```

---

## Task 10: Add new tokens to website's Tailwind `@theme` block

**Files:**
- Modify: `apps/website/src/app/global.css`

Tailwind v4 reads tokens from the `@theme` block. We need the new colors, radii, and shadows available as Tailwind utilities (`bg-canvas`, `rounded-lg`, `shadow-md`, etc.).

- [ ] **Step 1: Read the existing `@theme` block**

Read `apps/website/src/app/global.css` lines 1-30 to confirm the current structure (it uses Tailwind v4 `@theme {}` with `--color-*` and `--font-*` prefixes — different from the lib's `--ds-*` prefix).

- [ ] **Step 2: Append additive variables inside `@theme`**

Inside the existing `@theme {}` block, after the `--font-mono` line, add (do not remove or modify existing variables):

```css
  /* New surfaces — Phase 1 of Statusbrew refactor */
  --color-canvas: #fafbfc;
  --color-surface: #ffffff;
  --color-surface-tinted: #f4f6fb;
  --color-surface-dim: #eef1f7;
  --color-border: #e6e8ee;
  --color-border-strong: #d2d6e0;
  --color-text-inverted: #ffffff;
  --color-accent-hover: #003070;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03);
  --shadow-md: 0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04);
  --shadow-lg: 0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05);
  --shadow-focus: 0 0 0 3px rgba(0, 64, 144, 0.25);
```

- [ ] **Step 3: Build the website to confirm Tailwind picks them up**

Run: `pnpm nx build website` (or the equivalent target).
Expected: build succeeds. `tailwindcss` should now emit classes like `bg-canvas`, `rounded-lg`, `shadow-md` if requested.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "feat(website): wire new surfaces/radii/shadows into Tailwind theme"
```

---

## Task 11: Add `cn()` helper

**Files:**
- Create: `apps/website/src/lib/cn.ts`

A small composition helper used by primitives that want to merge default classes with caller-provided `className`.

- [ ] **Step 1: Create the file**

Create `apps/website/src/lib/cn.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with intelligent Tailwind conflict resolution.
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-accent', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/cn.ts
git commit -m "feat(website): add cn() class-merge helper"
```

---

## Task 12: Add `Container` primitive

**Files:**
- Create: `apps/website/src/components/ui/Container.tsx`

Max-width wrapper with responsive horizontal padding. Server component.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Container.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Wider variant for full-width hero collages */
  size?: 'default' | 'wide';
}

export function Container({ children, size = 'default', className, style, ...rest }: ContainerProps) {
  const maxWidth = size === 'wide' ? '1320px' : tokens.space.containerMax;
  return (
    <div
      data-ui="container"
      data-size={size}
      className={cn(className)}
      style={{
        width: '100%',
        maxWidth,
        margin: '0 auto',
        paddingLeft: tokens.space.containerX,
        paddingRight: tokens.space.containerX,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/Container.tsx
git commit -m "feat(website): add Container primitive"
```

---

## Task 13: Add `Section` primitive

**Files:**
- Create: `apps/website/src/components/ui/Section.tsx`

Vertical section wrapper with optional surface variant.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Section.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Surface = 'canvas' | 'tinted' | 'white';

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
  children: ReactNode;
  /** Background surface for this section. Defaults to canvas (page bg). */
  surface?: Surface;
  /** Use the tighter vertical rhythm (proof strip, final CTA). */
  tight?: boolean;
  /** HTML element ID — useful for in-page anchors. */
  id?: string;
  /** Optional aria-labelledby pointing at a heading inside the section. */
  ariaLabelledBy?: string;
}

const SURFACE_BG: Record<Surface, string> = {
  canvas: tokens.surfaces.canvas,
  tinted: tokens.surfaces.surfaceTinted,
  white: tokens.surfaces.surface,
};

export function Section({
  children,
  surface = 'canvas',
  tight = false,
  id,
  ariaLabelledBy,
  className,
  style,
  ...rest
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      data-ui="section"
      data-surface={surface}
      className={cn(className)}
      style={{
        background: SURFACE_BG[surface],
        paddingTop: tight ? tokens.space.sectionYTight : tokens.space.sectionY,
        paddingBottom: tight ? tokens.space.sectionYTight : tokens.space.sectionY,
        ...style,
      }}
      {...rest}
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/Section.tsx
git commit -m "feat(website): add Section primitive"
```

---

## Task 14: Add `Eyebrow` primitive

**Files:**
- Create: `apps/website/src/components/ui/Eyebrow.tsx`

Mono uppercase label used above headlines.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Eyebrow.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  /** Optional color override. Defaults to muted neutral. */
  tone?: 'muted' | 'accent' | 'angular';
}

const TONE_COLOR: Record<NonNullable<EyebrowProps['tone']>, string> = {
  muted: tokens.colors.textMuted,
  accent: tokens.colors.accent,
  angular: tokens.colors.angularRed,
};

export function Eyebrow({ children, tone = 'muted', className, style, ...rest }: EyebrowProps) {
  return (
    <p
      data-ui="eyebrow"
      data-tone={tone}
      className={cn(className)}
      style={{
        fontFamily: tokens.typography.eyebrow.family,
        fontSize: tokens.typography.eyebrow.size,
        fontWeight: tokens.typography.eyebrow.weight,
        letterSpacing: tokens.typography.eyebrow.letterSpacing,
        textTransform: tokens.typography.eyebrow.transform,
        lineHeight: tokens.typography.eyebrow.line,
        color: TONE_COLOR[tone],
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/Eyebrow.tsx
git commit -m "feat(website): add Eyebrow primitive"
```

---

## Task 15: Add `Pill` primitive

**Files:**
- Create: `apps/website/src/components/ui/Pill.tsx`

Small rounded label/tag with brand-color variants.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Pill.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type PillVariant = 'neutral' | 'accent' | 'angular';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: PillVariant;
}

interface VariantStyle {
  bg: string;
  border: string;
  color: string;
}

const VARIANT_STYLES: Record<PillVariant, VariantStyle> = {
  neutral: {
    bg: tokens.surfaces.surface,
    border: tokens.surfaces.border,
    color: tokens.colors.textSecondary,
  },
  accent: {
    bg: tokens.colors.accentSurface,
    border: tokens.colors.accentBorder,
    color: tokens.colors.accent,
  },
  angular: {
    bg: 'rgba(221, 0, 49, 0.06)',
    border: 'rgba(221, 0, 49, 0.18)',
    color: tokens.colors.angularRed,
  },
};

export function Pill({ children, variant = 'neutral', className, style, ...rest }: PillProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <span
      data-ui="pill"
      data-variant={variant}
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: tokens.typography.fontMono,
        fontSize: 11,
        fontWeight: 500,
        padding: '4px 10px',
        borderRadius: tokens.radius.full,
        background: v.bg,
        border: `1px solid ${v.border}`,
        color: v.color,
        lineHeight: 1.4,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/Pill.tsx
git commit -m "feat(website): add Pill primitive"
```

---

## Task 16: Add `Button` primitive

**Files:**
- Create: `apps/website/src/components/ui/Button.tsx`

Primary / secondary / ghost variants. Renders as `<a>` when `href` is given, `<button>` otherwise. Uses `class-variance-authority` for variant typing but inline-style for actual rendering (matches codebase pattern).

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Button.tsx`:

```tsx
import type { ReactNode, AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface CommonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** Optional right-side icon — typically an arrow for ghost links. */
  trailingIcon?: ReactNode;
}

type ButtonProps =
  | (CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>)
  | (CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>);

interface VariantStyle {
  bg: string;
  color: string;
  border: string;
}

const VARIANT_STYLES: Record<Variant, VariantStyle> = {
  primary: {
    bg: tokens.colors.accent,
    color: tokens.colors.textInverted,
    border: tokens.colors.accent,
  },
  secondary: {
    bg: tokens.surfaces.surface,
    color: tokens.colors.textPrimary,
    border: tokens.surfaces.borderStrong,
  },
  ghost: {
    bg: 'transparent',
    color: tokens.colors.accent,
    border: 'transparent',
  },
};

const SIZE_STYLES: Record<Size, { padding: string; fontSize: number; height: number }> = {
  md: { padding: '0 16px', fontSize: 14, height: 40 },
  lg: { padding: '0 22px', fontSize: 16, height: 48 },
};

export function Button(props: ButtonProps) {
  const { children, variant = 'primary', size = 'md', trailingIcon, className, style, ...rest } = props;
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  const combinedStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: s.height,
    padding: s.padding,
    fontFamily: tokens.typography.fontSans,
    fontSize: s.fontSize,
    fontWeight: 600,
    lineHeight: 1,
    background: v.bg,
    color: v.color,
    border: `1px solid ${v.border}`,
    borderRadius: tokens.radius.md,
    boxShadow: variant === 'primary' ? tokens.shadows.sm : 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
    whiteSpace: 'nowrap',
    ...style,
  };

  const content = (
    <>
      <span>{children}</span>
      {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </>
  );

  if ('href' in rest && typeof rest.href === 'string') {
    return (
      <a
        data-ui="button"
        data-variant={variant}
        data-size={size}
        className={cn(className)}
        style={combinedStyle}
        {...rest}
      >
        {content}
      </a>
    );
  }

  const { href: _ignored, ...buttonRest } = rest as { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      data-ui="button"
      data-variant={variant}
      data-size={size}
      className={cn(className)}
      style={combinedStyle}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors. Discriminated union on `href` should type-check cleanly.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/Button.tsx
git commit -m "feat(website): add Button primitive with primary/secondary/ghost variants"
```

---

## Task 17: Add `Card` primitive

**Files:**
- Create: `apps/website/src/components/ui/Card.tsx`

White card with border, rounded corners, subtle shadow.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/Card.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** If true, applies a subtle hover lift via CSS. */
  hoverable?: boolean;
  /** Internal padding tier. */
  padding?: 'md' | 'lg';
  /** Override the surface color. */
  surface?: 'white' | 'tinted' | 'dim';
}

const SURFACE: Record<NonNullable<CardProps['surface']>, string> = {
  white: tokens.surfaces.surface,
  tinted: tokens.surfaces.surfaceTinted,
  dim: tokens.surfaces.surfaceDim,
};

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  md: '20px',
  lg: '28px',
};

export function Card({
  children,
  hoverable = false,
  padding = 'md',
  surface = 'white',
  className,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      data-ui="card"
      data-hoverable={hoverable || undefined}
      className={cn('card-primitive', className)}
      style={{
        background: SURFACE[surface],
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadows.sm,
        padding: PADDING[padding],
        transition: 'box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add the hover styles to global.css**

Append to `apps/website/src/app/global.css` (at the bottom, after existing rules):

```css
/* UI primitive — Card hover */
[data-ui="card"][data-hoverable] {
  cursor: default;
}
[data-ui="card"][data-hoverable]:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}
@media (prefers-reduced-motion: reduce) {
  [data-ui="card"][data-hoverable]:hover {
    transform: none;
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/ui/Card.tsx apps/website/src/app/global.css
git commit -m "feat(website): add Card primitive with hover variant"
```

---

## Task 18: Add `BrowserFrame` primitive

**Files:**
- Create: `apps/website/src/components/ui/BrowserFrame.tsx`

Mac-style window chrome around screenshots/iframes for the layered hero collage.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/BrowserFrame.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

interface BrowserFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Faux URL shown in the address bar. */
  url?: string;
  /** Degrees of rotation for collage stacking. */
  rotate?: number;
  /** Elevation tier — defaults to `md`. */
  elevation?: 'sm' | 'md' | 'lg';
  /** Optional max-width override. */
  maxWidth?: number | string;
}

const ELEVATION: Record<NonNullable<BrowserFrameProps['elevation']>, string> = {
  sm: tokens.shadows.sm,
  md: tokens.shadows.md,
  lg: tokens.shadows.lg,
};

export function BrowserFrame({
  children,
  url,
  rotate = 0,
  elevation = 'md',
  maxWidth,
  className,
  style,
  ...rest
}: BrowserFrameProps) {
  return (
    <div
      data-ui="browser-frame"
      className={cn(className)}
      style={{
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        boxShadow: ELEVATION[elevation],
        overflow: 'hidden',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        maxWidth,
        ...style,
      }}
      {...rest}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: tokens.surfaces.surfaceTinted,
          borderBottom: `1px solid ${tokens.surfaces.border}`,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#FF5F57' }} />
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#FEBC2E' }} />
          <span style={{ width: 12, height: 12, borderRadius: tokens.radius.full, background: '#28C840' }} />
        </div>
        {/* URL pill */}
        {url ? (
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: tokens.typography.fontMono,
              fontSize: 11,
              color: tokens.colors.textMuted,
              background: tokens.surfaces.surface,
              border: `1px solid ${tokens.surfaces.border}`,
              borderRadius: tokens.radius.sm,
              padding: '4px 10px',
              maxWidth: 360,
              margin: '0 auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {url}
          </div>
        ) : null}
        {/* Right spacer to balance traffic lights */}
        <div style={{ width: 54 }} aria-hidden="true" />
      </div>

      {/* Frame body */}
      <div data-ui="browser-frame-body" style={{ position: 'relative', background: tokens.surfaces.surface }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/BrowserFrame.tsx
git commit -m "feat(website): add BrowserFrame primitive"
```

---

## Task 19: Add `LogoMark` primitive

**Files:**
- Create: `apps/website/src/components/ui/LogoMark.tsx`

The 🛩️ + "Angular Agent Framework" wordmark. Replaces ad-hoc logo treatments in `Nav`/`Footer` later.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/LogoMark.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

interface LogoMarkProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
  /** Hide the wordmark, show only the icon. */
  iconOnly?: boolean;
}

const SIZE: Record<NonNullable<LogoMarkProps['size']>, { icon: number; label: number }> = {
  sm: { icon: 18, label: 14 },
  md: { icon: 22, label: 16 },
};

export function LogoMark({ size = 'md', iconOnly = false, className, style, ...rest }: LogoMarkProps) {
  const s = SIZE[size];
  return (
    <span
      data-ui="logo-mark"
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: tokens.typography.fontSerif,
        fontSize: s.label,
        fontWeight: 700,
        color: tokens.colors.textPrimary,
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      <span aria-hidden="true" style={{ fontSize: s.icon, lineHeight: 1 }}>🛩️</span>
      {iconOnly ? null : <span>Angular Agent Framework</span>}
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/ui/LogoMark.tsx
git commit -m "feat(website): add LogoMark primitive"
```

---

## Task 20: Add `FAQ` primitive

**Files:**
- Create: `apps/website/src/components/ui/FAQ.tsx`

Native `<details>`-based accordion. Keyboard accessible by default. Animated open/close via CSS.

- [ ] **Step 1: Create the file**

Create `apps/website/src/components/ui/FAQ.tsx`:

```tsx
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { cn } from '../../lib/cn';

export interface FAQItem {
  q: string;
  a: ReactNode;
}

interface FAQProps {
  items: FAQItem[];
  className?: string;
}

/**
 * Native-details FAQ accordion. Keyboard accessible out of the box.
 * Each item can be opened independently; no shared exclusivity.
 */
export function FAQ({ items, className }: FAQProps) {
  return (
    <div
      data-ui="faq"
      className={cn(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {items.map((item, i) => (
        <details
          key={i}
          data-ui="faq-item"
          style={{
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadows.sm,
            padding: '0 20px',
          }}
        >
          <summary
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 0',
              cursor: 'pointer',
              fontFamily: tokens.typography.fontSans,
              fontSize: 17,
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              listStyle: 'none',
            }}
          >
            <span>{item.q}</span>
            <span aria-hidden="true" data-ui="faq-chevron" style={{
              transition: 'transform 200ms ease',
              fontSize: 14,
              color: tokens.colors.textSecondary,
            }}>▼</span>
          </summary>
          <div style={{
            paddingBottom: 20,
            fontFamily: tokens.typography.fontSans,
            fontSize: 16,
            lineHeight: 1.6,
            color: tokens.colors.textSecondary,
          }}>
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add chevron rotation + summary marker-removal CSS**

Append to `apps/website/src/app/global.css`:

```css
/* UI primitive — FAQ */
[data-ui="faq-item"] > summary::-webkit-details-marker {
  display: none;
}
[data-ui="faq-item"][open] [data-ui="faq-chevron"] {
  transform: rotate(180deg);
}
[data-ui="faq-item"] > summary:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm nx typecheck website`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/ui/FAQ.tsx apps/website/src/app/global.css
git commit -m "feat(website): add FAQ accordion primitive"
```

---

## Task 21: Create `_dev/primitives` showcase route

**Files:**
- Create: `apps/website/src/app/_dev/primitives/page.tsx`

A dev-only route that renders one of each primitive so we can both eyeball them in dev and assert them in Playwright. Will be deleted in a later phase.

- [ ] **Step 1: Create the page**

Create `apps/website/src/app/_dev/primitives/page.tsx`:

```tsx
import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Pill } from '../../../components/ui/Pill';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { BrowserFrame } from '../../../components/ui/BrowserFrame';
import { LogoMark } from '../../../components/ui/LogoMark';
import { FAQ, type FAQItem } from '../../../components/ui/FAQ';

export const metadata = { title: 'UI primitives — dev only' };

const FAQ_ITEMS: FAQItem[] = [
  { q: 'Is this real?', a: 'Yes — this page is for verifying the primitives during refactor Phase 1.' },
  { q: 'Will it stay forever?', a: 'No, this route gets deleted once the marketing pages have migrated.' },
];

export default function PrimitivesDevPage() {
  return (
    <>
      <Section surface="canvas">
        <Container>
          <h1 data-testid="primitives-page-title" style={{ fontFamily: 'var(--font-garamond)', fontSize: 48, marginBottom: 24 }}>
            UI primitives
          </h1>

          <h2 style={{ marginTop: 32 }}>LogoMark</h2>
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <LogoMark size="sm" />
            <LogoMark size="md" />
            <LogoMark size="md" iconOnly />
          </div>

          <h2 style={{ marginTop: 32 }}>Eyebrow</h2>
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <Eyebrow>Default muted</Eyebrow>
            <Eyebrow tone="accent">Accent</Eyebrow>
            <Eyebrow tone="angular">Angular</Eyebrow>
          </div>

          <h2 style={{ marginTop: 32 }}>Pill</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <Pill variant="neutral">MIT</Pill>
            <Pill variant="accent">LangGraph</Pill>
            <Pill variant="angular">Angular 20+</Pill>
          </div>

          <h2 style={{ marginTop: 32 }}>Button</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost →</Button>
            <Button variant="primary" size="lg" href="/docs">Large link</Button>
          </div>

          <h2 style={{ marginTop: 32 }}>Card</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 12 }}>
            <Card>
              <Eyebrow>Standard</Eyebrow>
              <p style={{ marginTop: 8 }}>A basic card with default padding.</p>
            </Card>
            <Card hoverable>
              <Eyebrow>Hoverable</Eyebrow>
              <p style={{ marginTop: 8 }}>Hover me — gentle lift + stronger shadow.</p>
            </Card>
            <Card surface="tinted" padding="lg">
              <Eyebrow>Tinted, lg padding</Eyebrow>
              <p style={{ marginTop: 8 }}>Used for emphasized callouts.</p>
            </Card>
          </div>

          <h2 style={{ marginTop: 32 }}>BrowserFrame</h2>
          <div style={{ marginTop: 12, maxWidth: 600 }}>
            <BrowserFrame url="cockpit.cacheplane.ai" elevation="md">
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Placeholder content
              </div>
            </BrowserFrame>
          </div>
        </Container>
      </Section>

      <Section surface="tinted" tight>
        <Container>
          <h2>Section surface = tinted</h2>
          <p>This section uses the tinted surface variant.</p>
        </Container>
      </Section>

      <Section surface="white">
        <Container>
          <h2>FAQ</h2>
          <FAQ items={FAQ_ITEMS} />
        </Container>
      </Section>
    </>
  );
}
```

- [ ] **Step 2: Start the dev server and eyeball the page**

Run: `pnpm nx dev website` (or `pnpm nx run website:dev` — check `apps/website/project.json` for the exact target).
Open: `http://localhost:<port>/_dev/primitives`
Expected: each primitive renders without console errors. Note: the existing `Nav` and `Footer` still wrap the page since they're in the root layout; that's fine — Phase 2 will replace them.

If anything looks broken, fix the relevant primitive before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/_dev/primitives/page.tsx
git commit -m "feat(website): add _dev/primitives showcase route"
```

---

## Task 22: Add Playwright assertions for primitives

**Files:**
- Create: `apps/website/e2e/primitives.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/e2e/primitives.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('UI primitives showcase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/_dev/primitives');
  });

  test('renders the page heading', async ({ page }) => {
    await expect(page.locator('[data-testid="primitives-page-title"]')).toBeVisible();
  });

  test('renders LogoMark', async ({ page }) => {
    const logos = page.locator('[data-ui="logo-mark"]');
    await expect(logos).toHaveCount(3);
  });

  test('renders Eyebrow in all tones', async ({ page }) => {
    await expect(page.locator('[data-ui="eyebrow"][data-tone="muted"]')).toBeVisible();
    await expect(page.locator('[data-ui="eyebrow"][data-tone="accent"]')).toBeVisible();
    await expect(page.locator('[data-ui="eyebrow"][data-tone="angular"]')).toBeVisible();
  });

  test('renders Pill in all variants', async ({ page }) => {
    await expect(page.locator('[data-ui="pill"][data-variant="neutral"]')).toBeVisible();
    await expect(page.locator('[data-ui="pill"][data-variant="accent"]')).toBeVisible();
    await expect(page.locator('[data-ui="pill"][data-variant="angular"]')).toBeVisible();
  });

  test('renders Button variants', async ({ page }) => {
    await expect(page.locator('[data-ui="button"][data-variant="primary"]').first()).toBeVisible();
    await expect(page.locator('[data-ui="button"][data-variant="secondary"]')).toBeVisible();
    await expect(page.locator('[data-ui="button"][data-variant="ghost"]')).toBeVisible();
    // Large primary renders as an <a> with href
    const linkButton = page.locator('a[data-ui="button"][data-size="lg"]');
    await expect(linkButton).toHaveAttribute('href', '/docs');
  });

  test('renders Card variants including hoverable', async ({ page }) => {
    const cards = page.locator('[data-ui="card"]');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('[data-ui="card"][data-hoverable]')).toHaveCount(1);
  });

  test('renders BrowserFrame with URL pill', async ({ page }) => {
    const frame = page.locator('[data-ui="browser-frame"]');
    await expect(frame).toBeVisible();
    await expect(frame).toContainText('cockpit.cacheplane.ai');
  });

  test('renders Section with tinted surface variant', async ({ page }) => {
    await expect(page.locator('[data-ui="section"][data-surface="tinted"]')).toBeVisible();
  });

  test('FAQ items toggle open and closed', async ({ page }) => {
    const firstItem = page.locator('[data-ui="faq-item"]').first();
    await expect(firstItem).not.toHaveAttribute('open', '');
    await firstItem.locator('summary').click();
    await expect(firstItem).toHaveAttribute('open', '');
    await firstItem.locator('summary').click();
    await expect(firstItem).not.toHaveAttribute('open', '');
  });

  test('FAQ summary is keyboard-focusable', async ({ page }) => {
    const summary = page.locator('[data-ui="faq-item"]').first().locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `pnpm nx e2e website --grep "UI primitives showcase"` (or equivalent — check `apps/website/project.json` for the e2e target).

Expected: all 9 tests in the suite pass. Existing `website.spec.ts` tests continue to pass — Phase 1 hasn't touched any visible content.

If any primitive test fails, fix the primitive's `data-ui`/`data-variant` attributes to match the test selectors, then re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/website/e2e/primitives.spec.ts
git commit -m "test(website): add Playwright coverage for UI primitives"
```

---

## Task 23: Final verification — build + typecheck the workspace

**Files:** none

- [ ] **Step 1: Workspace build**

Run: `pnpm nx run-many -t build -p design-tokens,website`
Expected: both projects build successfully.

- [ ] **Step 2: Workspace typecheck**

Run: `pnpm nx run-many -t typecheck -p design-tokens,website` (skip if typecheck is not a separate target — `nx build` covers it for these projects).
Expected: zero type errors.

- [ ] **Step 3: Run all existing e2e tests to confirm nothing regressed**

Run: `pnpm nx e2e website`
Expected: every existing test plus the new primitives suite passes. If any existing test fails, investigate — Phase 1 should not touch user-visible content, so a failure indicates a side-effect to fix before declaring the phase done.

- [ ] **Step 4: Confirm bundle did not regress catastrophically**

Run: `pnpm nx build website` and review the build output for the homepage route. Note the size; record it in the commit message for the closing commit so we have a baseline for Phase 6 deletion. (No specific size threshold — just a record.)

- [ ] **Step 5: Closing commit**

If no changes were needed in Step 4 (most likely), simply skip the commit; the verification step is a check, not a change. Otherwise:

```bash
git add -A
git commit -m "chore(website): Phase 1 verification — tokens + primitives green"
```

---

## Summary

After this plan executes:
- `@ngaf/design-tokens` exposes new `surfaces`, `shadows`, `radius`, `space` namespaces and an extended `colors` + `typography` (version bumped to 0.0.30). All existing tokens are untouched.
- The website has 9 new UI primitives under `src/components/ui/`, a `cn()` helper, and new Tailwind theme variables. None of them are wired into any production page yet.
- A `/_dev/primitives` route exists for inspection, with Playwright assertions guarding it.
- Total commits: ~22. No production-page behavior changes.

Next phase (separate plan): Phase 2 — refactor `Nav`, `Footer`, and `AnnouncementToast` to use the new primitives and tokens.
