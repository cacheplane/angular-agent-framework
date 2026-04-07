# Design Tokens Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `libs/design-tokens` — a framework-agnostic Nx library exporting the shared design system constants (colors, glass, gradients, glow, typography) used by both the website and cockpit.

**Architecture:** Pure TypeScript const exports with no framework dependencies. Follows the existing `libs/cockpit-registry` Nx library pattern (project.json, vite test config, barrel export). The website's inline CSS variables and style objects become imports from `@cacheplane/design-tokens`.

**Tech Stack:** TypeScript, Nx, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `libs/design-tokens/project.json` | Nx project config |
| Create | `libs/design-tokens/package.json` | Package metadata |
| Create | `libs/design-tokens/tsconfig.json` | TypeScript config |
| Create | `libs/design-tokens/tsconfig.lib.json` | Build config |
| Create | `libs/design-tokens/vite.config.mts` | Vitest config |
| Create | `libs/design-tokens/src/index.ts` | Barrel export |
| Create | `libs/design-tokens/src/lib/colors.ts` | Color palette |
| Create | `libs/design-tokens/src/lib/glass.ts` | Glassmorphism tokens |
| Create | `libs/design-tokens/src/lib/gradients.ts` | Gradient definitions |
| Create | `libs/design-tokens/src/lib/glow.ts` | Glow/shadow tokens |
| Create | `libs/design-tokens/src/lib/typography.ts` | Font definitions |
| Create | `libs/design-tokens/src/lib/tokens.spec.ts` | Tests verifying all exports |
| Modify | `tsconfig.base.json` | Add `@cacheplane/design-tokens` path |

---

### Task 1: Scaffold the Nx library

**Files:**
- Create: `libs/design-tokens/project.json`
- Create: `libs/design-tokens/package.json`
- Create: `libs/design-tokens/tsconfig.json`
- Create: `libs/design-tokens/tsconfig.lib.json`
- Create: `libs/design-tokens/vite.config.mts`
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Create project.json**

```json
{
  "name": "design-tokens",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/design-tokens/src",
  "projectType": "library",
  "tags": ["scope:shared", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/design-tokens"],
      "options": {
        "outputPath": "dist/libs/design-tokens",
        "main": "libs/design-tokens/src/index.ts",
        "tsConfig": "libs/design-tokens/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "@nx/vite:test",
      "options": {
        "configFile": "libs/design-tokens/vite.config.mts"
      }
    }
  }
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@cacheplane/design-tokens",
  "version": "0.0.1",
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [
    { "path": "./tsconfig.lib.json" }
  ]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create vite.config.mts**

```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 6: Add path alias to tsconfig.base.json**

Add to `compilerOptions.paths`:
```json
"@cacheplane/design-tokens": ["libs/design-tokens/src/index.ts"]
```

- [ ] **Step 7: Commit**

```bash
git add libs/design-tokens/project.json libs/design-tokens/package.json libs/design-tokens/tsconfig.json libs/design-tokens/tsconfig.lib.json libs/design-tokens/vite.config.mts tsconfig.base.json
git commit -m "chore: scaffold design-tokens Nx library"
```

---

### Task 2: Implement color tokens

**Files:**
- Create: `libs/design-tokens/src/lib/colors.ts`

- [ ] **Step 1: Create colors.ts**

```ts
// libs/design-tokens/src/lib/colors.ts

/**
 * Core color palette for the angular design system.
 *
 * Light theme with LangGraph blue accent and Angular red brand color.
 * Used across both the website and cockpit.
 */
export const colors = {
  /** Base background — light cream */
  bg: '#f8f9fc',
  /** Primary accent — LangGraph blue */
  accent: '#004090',
  /** Light accent — sky blue for secondary highlights */
  accentLight: '#64C3FD',
  /** Accent glow — used for shadows and ambient effects */
  accentGlow: 'rgba(0, 64, 144, 0.2)',
  /** Accent border — subtle blue for panel edges */
  accentBorder: 'rgba(0, 64, 144, 0.15)',
  /** Accent border hover — stronger blue on interaction */
  accentBorderHover: 'rgba(0, 64, 144, 0.3)',
  /** Accent surface — very light tint for selected/active states */
  accentSurface: 'rgba(0, 64, 144, 0.06)',
  /** Primary text — dark ink for headings and body */
  textPrimary: '#1a1a2e',
  /** Secondary text — warm gray for descriptions */
  textSecondary: '#555770',
  /** Muted text — light gray for labels and metadata */
  textMuted: '#8b8fa3',
  /** Angular brand red */
  angularRed: '#DD0031',
} as const;

export type Colors = typeof colors;
```

- [ ] **Step 2: Commit**

```bash
git add libs/design-tokens/src/lib/colors.ts
git commit -m "feat(design-tokens): add color palette"
```

---

### Task 3: Implement glass, gradient, glow, and typography tokens

**Files:**
- Create: `libs/design-tokens/src/lib/glass.ts`
- Create: `libs/design-tokens/src/lib/gradients.ts`
- Create: `libs/design-tokens/src/lib/glow.ts`
- Create: `libs/design-tokens/src/lib/typography.ts`

- [ ] **Step 1: Create glass.ts**

```ts
// libs/design-tokens/src/lib/glass.ts

/**
 * Glassmorphism tokens — frosted glass panel treatment.
 *
 * Apply as: background + backdrop-filter + border + box-shadow.
 */
export const glass = {
  /** Default panel fill — 45% white */
  bg: 'rgba(255, 255, 255, 0.45)',
  /** Hover/active panel fill — 55% white */
  bgHover: 'rgba(255, 255, 255, 0.55)',
  /** Backdrop blur amount */
  blur: '16px',
  /** Subtle white edge for glass panels */
  border: 'rgba(255, 255, 255, 0.6)',
  /** Soft diffuse shadow */
  shadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
} as const;

export type Glass = typeof glass;
```

- [ ] **Step 2: Create gradients.ts**

```ts
// libs/design-tokens/src/lib/gradients.ts

/**
 * Gradient tokens — ambient blobs and page backgrounds.
 *
 * The bgFlow gradient communicates the Angular→LangGraph bridge
 * by flowing from warm (red) to cool (blue).
 */
export const gradients = {
  /** Angular red ambient blob */
  warm: 'radial-gradient(circle, rgba(221, 0, 49, 0.18), transparent 70%)',
  /** LangGraph blue ambient blob */
  cool: 'radial-gradient(circle, rgba(0, 64, 144, 0.18), transparent 70%)',
  /** Light blue accent blob */
  coolLight: 'radial-gradient(circle, rgba(100, 195, 253, 0.15), transparent 70%)',
  /** Main page background — pink→lavender→blue flow */
  bgFlow: 'linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)',
} as const;

export type Gradients = typeof gradients;
```

- [ ] **Step 3: Create glow.ts**

```ts
// libs/design-tokens/src/lib/glow.ts

/**
 * Glow and shadow tokens for interactive elements.
 */
export const glow = {
  /** Large hero element glow */
  hero: '0 0 60px rgba(0, 64, 144, 0.15)',
  /** Demo/iframe container glow */
  demo: '0 0 30px rgba(0, 64, 144, 0.1)',
  /** Card hover glow */
  card: '0 0 24px rgba(0, 64, 144, 0.1)',
  /** Subtle border glow */
  border: '0 0 12px rgba(0, 64, 144, 0.08)',
  /** CTA button hover glow */
  button: '0 0 16px rgba(0, 64, 144, 0.15)',
} as const;

export type Glow = typeof glow;
```

- [ ] **Step 4: Create typography.ts**

```ts
// libs/design-tokens/src/lib/typography.ts

/**
 * Typography tokens — font families used across the design system.
 *
 * - Serif (EB Garamond): Headlines, elegant emphasis
 * - Sans (Inter): Body text, UI elements
 * - Mono (JetBrains Mono): Code, labels, metadata
 */
export const typography = {
  /** Serif font for headings */
  fontSerif: '"EB Garamond", Georgia, serif',
  /** Sans-serif font for body text */
  fontSans: 'Inter, system-ui, sans-serif',
  /** Monospace font for code and labels */
  fontMono: '"JetBrains Mono", monospace',
} as const;

export type Typography = typeof typography;
```

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/src/lib/glass.ts libs/design-tokens/src/lib/gradients.ts libs/design-tokens/src/lib/glow.ts libs/design-tokens/src/lib/typography.ts
git commit -m "feat(design-tokens): add glass, gradient, glow, and typography tokens"
```

---

### Task 4: Create barrel export and tests

**Files:**
- Create: `libs/design-tokens/src/index.ts`
- Create: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Create barrel export**

```ts
// libs/design-tokens/src/index.ts
export { colors, type Colors } from './lib/colors';
export { glass, type Glass } from './lib/glass';
export { gradients, type Gradients } from './lib/gradients';
export { glow, type Glow } from './lib/glow';
export { typography, type Typography } from './lib/typography';

/**
 * Combined tokens object for convenience.
 * Use individual exports for tree-shaking in production.
 */
export { tokens } from './lib/tokens';
```

- [ ] **Step 2: Create combined tokens object**

```ts
// libs/design-tokens/src/lib/tokens.ts
import { colors } from './colors';
import { glass } from './glass';
import { gradients } from './gradients';
import { glow } from './glow';
import { typography } from './typography';

/**
 * Combined design tokens object.
 * Useful for passing all tokens at once.
 * Prefer individual imports for tree-shaking.
 */
export const tokens = {
  colors,
  glass,
  gradients,
  glow,
  typography,
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 3: Write tests**

```ts
// libs/design-tokens/src/lib/tokens.spec.ts
import { describe, expect, it } from 'vitest';
import { colors, glass, gradients, glow, typography, tokens } from '../index';

describe('design-tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.bg).toBe('#f8f9fc');
    expect(colors.accent).toBe('#004090');
    expect(colors.textPrimary).toBe('#1a1a2e');
    expect(colors.angularRed).toBe('#DD0031');
  });

  it('exports glass tokens', () => {
    expect(glass.bg).toContain('rgba(255');
    expect(glass.blur).toBe('16px');
    expect(glass.border).toContain('rgba(255');
  });

  it('exports gradient tokens', () => {
    expect(gradients.bgFlow).toContain('linear-gradient');
    expect(gradients.warm).toContain('rgba(221');
    expect(gradients.cool).toContain('rgba(0, 64, 144');
  });

  it('exports glow tokens', () => {
    expect(glow.hero).toContain('60px');
    expect(glow.button).toContain('16px');
  });

  it('exports typography tokens', () => {
    expect(typography.fontSerif).toContain('EB Garamond');
    expect(typography.fontSans).toContain('Inter');
    expect(typography.fontMono).toContain('JetBrains Mono');
  });

  it('exports combined tokens object with all categories', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.glass).toBe(glass);
    expect(tokens.gradients).toBe(gradients);
    expect(tokens.glow).toBe(glow);
    expect(tokens.typography).toBe(typography);
  });

  it('all token objects are frozen (as const)', () => {
    expect(() => { (colors as any).bg = 'red'; }).toThrow();
    expect(() => { (glass as any).blur = '0px'; }).toThrow();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx nx test design-tokens -- --run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/src/
git commit -m "feat(design-tokens): add barrel export, combined tokens object, and tests"
```

---

### Task 5: Build and smoke test

- [ ] **Step 1: Build the library**

Run: `npx nx build design-tokens`
Expected: Builds successfully to `dist/libs/design-tokens/`

- [ ] **Step 2: Verify the build output**

Run: `ls dist/libs/design-tokens/src/lib/`
Expected: `colors.js`, `glass.js`, `gradients.js`, `glow.js`, `typography.js`, `tokens.js`

- [ ] **Step 3: Smoke test the import**

Run: `npx tsx -e "const { tokens } = require('./dist/libs/design-tokens/src/index.js'); console.log('bg:', tokens.colors.bg, 'accent:', tokens.colors.accent);"`
Expected: `bg: #f8f9fc accent: #004090`

- [ ] **Step 4: Commit and push**

```bash
git push
```
