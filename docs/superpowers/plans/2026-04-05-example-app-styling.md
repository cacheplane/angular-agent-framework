# Example App Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align all 14 Angular example apps with the website's light glassmorphism theme by adding a shared `tokens.css` to `@cacheplane/design-tokens` and Tailwind v4 to each app, plus fix cockpit sidebar and code overflow issues.

**Architecture:** A new `tokens.css` file in the design-tokens library defines all design tokens as `--ds-*` CSS custom properties. Each Angular app imports this file plus Tailwind v4 in its `styles.css`, replacing the hardcoded dark body styles. The cockpit sidebar filters out "overview" entries, and code blocks get proper overflow handling.

**Tech Stack:** CSS custom properties, Tailwind v4, Angular, Nx, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `libs/design-tokens/src/lib/tokens.css` | CSS custom properties for all design tokens |
| Modify | `libs/design-tokens/src/lib/tokens.spec.ts` | Add test verifying tokens.css exists and contains expected vars |
| Modify | `cockpit/langgraph/streaming/angular/src/styles.css` | Replace dark theme with tokens + Tailwind v4 |
| Modify | `cockpit/langgraph/persistence/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/interrupts/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/memory/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/durable-execution/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/subgraphs/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/time-travel/angular/src/styles.css` | Same |
| Modify | `cockpit/langgraph/deployment-runtime/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/planning/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/filesystem/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/subagents/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/memory/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/skills/angular/src/styles.css` | Same |
| Modify | `cockpit/deep-agents/sandboxes/angular/src/styles.css` | Same |
| Modify | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Filter out overview entries |
| Modify | `apps/cockpit/src/app/cockpit.css` | Fix code block overflow |

---

### Task 1: Create tokens.css in design-tokens library

**Files:**
- Create: `libs/design-tokens/src/lib/tokens.css`
- Modify: `libs/design-tokens/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the test**

Add a test to the existing spec file that verifies `tokens.css` exists and contains the expected custom properties. Open `libs/design-tokens/src/lib/tokens.spec.ts` and add this test block at the end of the file, inside the existing outer `describe`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('tokens.css', () => {
  const css = readFileSync(
    resolve(__dirname, 'tokens.css'),
    'utf-8',
  );

  it('defines all color tokens as CSS custom properties', () => {
    expect(css).toContain('--ds-bg:');
    expect(css).toContain('--ds-accent:');
    expect(css).toContain('--ds-text-primary:');
    expect(css).toContain('--ds-text-secondary:');
    expect(css).toContain('--ds-text-muted:');
    expect(css).toContain('--ds-accent-surface:');
  });

  it('defines glass tokens', () => {
    expect(css).toContain('--ds-glass-bg:');
    expect(css).toContain('--ds-glass-blur:');
    expect(css).toContain('--ds-glass-border:');
    expect(css).toContain('--ds-glass-shadow:');
  });

  it('defines gradient tokens', () => {
    expect(css).toContain('--ds-gradient-bg-flow:');
  });

  it('defines typography tokens', () => {
    expect(css).toContain('--ds-font-serif:');
    expect(css).toContain('--ds-font-sans:');
    expect(css).toContain('--ds-font-mono:');
  });

  it('defines glow tokens', () => {
    expect(css).toContain('--ds-glow-hero:');
    expect(css).toContain('--ds-glow-card:');
  });

  it('uses :root selector', () => {
    expect(css).toContain(':root');
  });
});
```

Note: the `readFileSync` and `resolve` imports should be added at the top of the file alongside the existing imports.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test design-tokens -- --run
```

Expected: FAIL — `tokens.css` does not exist yet.

- [ ] **Step 3: Create tokens.css**

Create `libs/design-tokens/src/lib/tokens.css` with all design tokens as CSS custom properties. The variable names match the `--ds-*` prefix used by `libs/ui-react/src/lib/css-vars.ts`:

```css
/**
 * Design Tokens — CSS Custom Properties
 *
 * Single source of truth for the @cacheplane design system.
 * Import this file in any app to get all tokens as CSS vars.
 *
 * Variable naming: --ds-{category}-{name}
 * Matches the TS token objects in this library.
 */
:root {
  /* Colors */
  --ds-bg: #f8f9fc;
  --ds-accent: #004090;
  --ds-accent-light: #64C3FD;
  --ds-accent-glow: rgba(0, 64, 144, 0.2);
  --ds-accent-border: rgba(0, 64, 144, 0.15);
  --ds-accent-border-hover: rgba(0, 64, 144, 0.3);
  --ds-accent-surface: rgba(0, 64, 144, 0.06);
  --ds-text-primary: #1a1a2e;
  --ds-text-secondary: #555770;
  --ds-text-muted: #8b8fa3;
  --ds-sidebar-bg: rgba(255, 255, 255, 0.45);
  --ds-angular-red: #DD0031;

  /* Glass */
  --ds-glass-bg: rgba(255, 255, 255, 0.45);
  --ds-glass-bg-hover: rgba(255, 255, 255, 0.55);
  --ds-glass-blur: 16px;
  --ds-glass-border: rgba(255, 255, 255, 0.6);
  --ds-glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);

  /* Gradients */
  --ds-gradient-warm: radial-gradient(circle, rgba(221, 0, 49, 0.18), transparent 70%);
  --ds-gradient-cool: radial-gradient(circle, rgba(0, 64, 144, 0.18), transparent 70%);
  --ds-gradient-cool-light: radial-gradient(circle, rgba(100, 195, 253, 0.15), transparent 70%);
  --ds-gradient-bg-flow: linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%);

  /* Glow */
  --ds-glow-hero: 0 0 60px rgba(0, 64, 144, 0.15);
  --ds-glow-demo: 0 0 30px rgba(0, 64, 144, 0.1);
  --ds-glow-card: 0 0 24px rgba(0, 64, 144, 0.1);
  --ds-glow-border: 0 0 12px rgba(0, 64, 144, 0.08);
  --ds-glow-button: 0 0 16px rgba(0, 64, 144, 0.15);

  /* Typography */
  --ds-font-serif: 'EB Garamond', Georgia, serif;
  --ds-font-sans: Inter, system-ui, sans-serif;
  --ds-font-mono: 'JetBrains Mono', monospace;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx nx test design-tokens -- --run
```

Expected: all tests PASS including the new `tokens.css` describe block.

- [ ] **Step 5: Commit**

```bash
git add libs/design-tokens/src/lib/tokens.css libs/design-tokens/src/lib/tokens.spec.ts
git commit -m "feat(design-tokens): add tokens.css with all design tokens as CSS custom properties"
```

---

### Task 2: Update all 14 Angular app styles to light theme with Tailwind v4

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/styles.css`
- Modify: `cockpit/langgraph/persistence/angular/src/styles.css`
- Modify: `cockpit/langgraph/interrupts/angular/src/styles.css`
- Modify: `cockpit/langgraph/memory/angular/src/styles.css`
- Modify: `cockpit/langgraph/durable-execution/angular/src/styles.css`
- Modify: `cockpit/langgraph/subgraphs/angular/src/styles.css`
- Modify: `cockpit/langgraph/time-travel/angular/src/styles.css`
- Modify: `cockpit/langgraph/deployment-runtime/angular/src/styles.css`
- Modify: `cockpit/deep-agents/planning/angular/src/styles.css`
- Modify: `cockpit/deep-agents/filesystem/angular/src/styles.css`
- Modify: `cockpit/deep-agents/subagents/angular/src/styles.css`
- Modify: `cockpit/deep-agents/memory/angular/src/styles.css`
- Modify: `cockpit/deep-agents/skills/angular/src/styles.css`
- Modify: `cockpit/deep-agents/sandboxes/angular/src/styles.css`

- [ ] **Step 1: Replace all 14 styles.css files**

Every Angular app has an identical `styles.css`. Replace the content of all 14 files with:

```css
@import "../../../../libs/design-tokens/src/lib/tokens.css";
@import "tailwindcss";

@theme {
  --color-bg: var(--ds-bg);
  --color-surface: #ffffff;
  --color-accent: var(--ds-accent);
  --color-accent-light: var(--ds-accent-light);
  --color-text-primary: var(--ds-text-primary);
  --color-text-secondary: var(--ds-text-secondary);
  --color-text-muted: var(--ds-text-muted);
  --color-border: var(--ds-accent-border);
  --color-error: #ef4444;
  --color-success: #22c55e;
  --font-sans: var(--ds-font-sans);
  --font-serif: var(--ds-font-serif);
  --font-mono: var(--ds-font-mono);
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--ds-font-sans);
  background: var(--ds-bg);
  color: var(--ds-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

The 8 LangGraph apps are at `cockpit/langgraph/*/angular/src/styles.css`.
The 6 Deep Agents apps are at `cockpit/deep-agents/*/angular/src/styles.css`.

Note on the import path: the Angular apps are at depth `cockpit/{product}/{topic}/angular/src/styles.css`. A relative path `../../../../libs/design-tokens/src/lib/tokens.css` resolves from `cockpit/{product}/{topic}/angular/` up to the workspace root, then into the lib. This avoids needing a package.json exports field or Nx build pipeline for a plain CSS file.

If the Angular build's CSS pipeline does not resolve relative paths correctly (it may resolve from `src/` not `angular/`), adjust to `../../../../../libs/design-tokens/src/lib/tokens.css` (one more level up from the `src/` directory).

- [ ] **Step 2: Build one Angular app to verify**

```bash
npx nx build cockpit-langgraph-streaming-angular --skip-nx-cache
```

Expected: build succeeds with no CSS errors. If the `@import` path fails, adjust the relative path depth as noted above.

- [ ] **Step 3: Build a Deep Agents app to verify**

```bash
npx nx build cockpit-deep-agents-planning-angular --skip-nx-cache
```

Expected: build succeeds. The deep-agents apps are at the same directory depth as LangGraph apps, so the same relative path should work.

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/*/angular/src/styles.css cockpit/deep-agents/*/angular/src/styles.css
git commit -m "feat(cockpit): replace dark theme with design-token-based light theme and Tailwind v4"
```

---

### Task 3: Remove overview entries from cockpit sidebar

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`

- [ ] **Step 1: Add filter to exclude overview entries**

In `apps/cockpit/src/components/sidebar/navigation-groups.tsx`, find the `ProductGroup` component. Inside the `{open && (...)}` block, the nav currently renders:

```tsx
{product.sections.flatMap((section) =>
  section.entries.map((entry) => {
```

Change it to filter out entries where `topic` is `'overview'`:

```tsx
{product.sections.flatMap((section) =>
  section.entries
    .filter((entry) => entry.topic !== 'overview')
    .map((entry) => {
```

This is a one-line addition (`.filter(...)`) inserted between `.entries` and `.map(...)`.

- [ ] **Step 2: Build cockpit to verify**

```bash
npx nx build cockpit --skip-nx-cache
```

Expected: build succeeds. The sidebar should no longer show "Overview" links.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/components/sidebar/navigation-groups.tsx
git commit -m "fix(cockpit): remove overview entries from sidebar navigation"
```

---

### Task 4: Fix code block overflow in cockpit docs

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`

- [ ] **Step 1: Fix the overflow CSS**

In `apps/cockpit/src/app/cockpit.css`, find the `.doc-codeblock` rule (around line 129):

```css
.doc-codeblock {
  border: 1px solid rgba(0, 64, 144, 0.12);
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 0.75rem 0;
}
```

Change `overflow: hidden` to `overflow: hidden` only on the border-radius clipping, and add a max-width constraint:

```css
.doc-codeblock {
  border: 1px solid rgba(0, 64, 144, 0.12);
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 0.75rem 0;
  max-width: 100%;
}
```

Then find `.doc-codeblock pre.shiki` (around line 163):

```css
.doc-codeblock pre.shiki { margin: 0; border-radius: 0; border: none; }
```

Add `overflow-x: auto` to it:

```css
.doc-codeblock pre.shiki { margin: 0; border-radius: 0; border: none; overflow-x: auto; }
```

Also find `.code-mode-block pre.shiki` on the same line/next line:

```css
.code-mode-block pre.shiki { margin: 0; border-radius: 0; border: none; }
```

Add the same fix:

```css
.code-mode-block pre.shiki { margin: 0; border-radius: 0; border: none; overflow-x: auto; }
```

- [ ] **Step 2: Build cockpit to verify**

```bash
npx nx build cockpit --skip-nx-cache
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css
git commit -m "fix(cockpit): add overflow-x scrolling to code blocks in docs mode"
```

---

### Task 5: Verify everything works end-to-end

- [ ] **Step 1: Run design-tokens tests**

```bash
npx nx test design-tokens -- --run
```

Expected: all tests pass.

- [ ] **Step 2: Run cockpit tests**

```bash
npx nx test cockpit -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Build cockpit**

```bash
npx nx build cockpit --skip-nx-cache
```

Expected: build succeeds.

- [ ] **Step 4: Build all Angular examples**

```bash
npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache
```

Expected: all 14 Angular apps build successfully.

- [ ] **Step 5: Run smoke test (if servers are running)**

```bash
npx playwright test apps/cockpit/e2e/all-examples-smoke.spec.ts --grep "renders chat UI"
```

Expected: 14/14 pass. The Angular apps should now render with a light background instead of dark navy.
