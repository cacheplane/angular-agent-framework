# Cockpit Examples Theme Sync — Stage 1 Plan (Library + Pilot)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the library plumbing for cockpit example theme sync and migrate one pilot app (`cockpit/chat/timeline/angular`) end-to-end to validate the pattern. After approval, a separate Stage 2 plan migrates the remaining 31 apps in waves.

**Architecture:** `cssVars(theme)` moves from `@ngaf/ui-react` → `@ngaf/design-tokens` (pure TS, framework-agnostic). `@ngaf/example-layouts` gains `installEmbeddedTheme()` + a centralized `theme.css` (Tailwind v4 entry + dark variant + `--ngaf-chat-*` → `--ds-*` namespace bridge). The pilot app drops the v3 CDN, swaps `bg-gray-950 text-gray-100` for CSS-variable utilities, and calls `installEmbeddedTheme()` from `main.ts`.

**Tech Stack:** Tailwind v4, `@tailwindcss/postcss`, Angular 21, `@angular/build:application`, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-05-13-cockpit-examples-theme-sync-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `libs/design-tokens/src/lib/css-vars.ts` | `cssVars(theme)` resolution (moved from ui-react) |
| Create | `libs/design-tokens/src/lib/css-vars.spec.ts` | Theme resolution tests (moved from ui-react) |
| Modify | `libs/design-tokens/src/index.ts` | Export `cssVars`, `CssVars` |
| Modify | `libs/design-tokens/package.json` | 0.0.32 → 0.0.33 |
| Delete | `libs/ui-react/src/lib/css-vars.ts` | Moved to design-tokens |
| Delete | `libs/ui-react/src/lib/css-vars.spec.ts` | Moved to design-tokens |
| Modify | `libs/ui-react/src/index.ts` | Re-export `cssVars` from `@ngaf/design-tokens` |
| Modify | `libs/ui-react/package.json` | 0.0.30 → 0.0.31 |
| Modify | `apps/cockpit/src/app/layout.tsx` | Import `cssVars` from `@ngaf/ui-react` still works via re-export — verify no change needed |
| Create | `libs/example-layouts/src/theme.css` | Tailwind v4 entry + dark variant + namespace bridge |
| Create | `libs/example-layouts/src/lib/install-embedded-theme.ts` | postMessage listener + cssVars applier |
| Create | `libs/example-layouts/src/lib/install-embedded-theme.spec.ts` | Unit tests |
| Modify | `libs/example-layouts/src/public-api.ts` | Export `installEmbeddedTheme` |
| Modify | `libs/example-layouts/package.json` | Add `exports` entry for `./theme.css`; patch bump; add `tailwindcss` peerDependency |
| Create | `postcss.config.mjs` (workspace root) OR per-app | Tailwind v4 PostCSS plugin wiring |
| Modify | `cockpit/chat/timeline/angular/src/index.html` | Drop v3 CDN, remove body classes |
| Modify | `cockpit/chat/timeline/angular/src/styles.css` | Replace with `@import "@ngaf/example-layouts/theme.css";` |
| Modify | `cockpit/chat/timeline/angular/src/main.ts` | Call `installEmbeddedTheme()` before bootstrap |
| Modify | `cockpit/chat/timeline/angular/src/app/timeline.component.ts` | Migrate template Tailwind utilities + inline styles to CSS-variable utilities |
| Modify | `cockpit/chat/timeline/angular/project.json` | Verify build target picks up the new styles correctly |

---

## Task 1: Move `cssVars` to `@ngaf/design-tokens`

**Files:**
- Create: `libs/design-tokens/src/lib/css-vars.ts`
- Create: `libs/design-tokens/src/lib/css-vars.spec.ts`
- Modify: `libs/design-tokens/src/index.ts`
- Delete: `libs/ui-react/src/lib/css-vars.ts`
- Delete: `libs/ui-react/src/lib/css-vars.spec.ts`
- Modify: `libs/ui-react/src/index.ts`

- [ ] **Step 1: Copy `css-vars.ts` from ui-react to design-tokens**

Read `libs/ui-react/src/lib/css-vars.ts`. Copy it to `libs/design-tokens/src/lib/css-vars.ts`, changing the imports from `'@ngaf/design-tokens'` to relative paths within the same lib:

```ts
import { baseTokens } from './base';
import { lightOverrides } from './light';
import { darkOverrides } from './dark';
import type { Theme } from './theme';

const overridesByTheme = {
  light: lightOverrides,
  dark: darkOverrides,
} as const;

/**
 * Resolve design tokens to a flat map of `--ds-*` CSS custom properties
 * for the given theme. Apply to `<html>` (or any container) via inline
 * style or by iterating the entries and calling
 * `element.style.setProperty(key, value)`.
 */
export function cssVars(theme: Theme) {
  const t = overridesByTheme[theme];
  const { brand, typography, space, radius, shadows } = baseTokens;
  return {
    // [exact body copied from libs/ui-react/src/lib/css-vars.ts]
    // including all --ds-* keys for surfaces, text, accent family,
    // brand colors, typography, shadows, radii, spacing
  } as const;
}

export type CssVars = ReturnType<typeof cssVars>;
```

Read the existing file first; preserve its exact body verbatim — only the imports change.

- [ ] **Step 2: Copy the spec file**

Copy `libs/ui-react/src/lib/css-vars.spec.ts` to `libs/design-tokens/src/lib/css-vars.spec.ts`. No content changes — same 9 test cases (light values, dark values, key parity, brand invariance, typography invariance).

- [ ] **Step 3: Add export to design-tokens barrel**

Edit `libs/design-tokens/src/index.ts` — add:

```ts
export { cssVars } from './lib/css-vars';
export type { CssVars } from './lib/css-vars';
```

- [ ] **Step 4: Delete the ui-react versions**

```bash
rm libs/ui-react/src/lib/css-vars.ts
rm libs/ui-react/src/lib/css-vars.spec.ts
```

- [ ] **Step 5: Update ui-react barrel to re-export from design-tokens**

Edit `libs/ui-react/src/index.ts`. Find the line:

```ts
export { cssVars, type CssVars } from './lib/css-vars';
```

Replace with:

```ts
export { cssVars, type CssVars } from '@ngaf/design-tokens';
```

`Theme` is already re-exported from the same module — leave that line alone.

- [ ] **Step 6: Run tests**

```bash
pnpm nx test design-tokens
pnpm nx test ui-react
```

Expected: design-tokens picks up 9 new tests (now 14 total in that project); ui-react loses 9 css-vars tests (12 → 3). All passing.

- [ ] **Step 7: Typecheck cockpit (the only `cssVars` consumer)**

```bash
cd apps/cockpit && npx tsc --noEmit
```

Expected: no new errors. `cssVars` is still imported from `@ngaf/ui-react` in `layout.tsx` and resolves via the re-export.

- [ ] **Step 8: Commit**

```bash
git add libs/design-tokens/src/lib/css-vars.ts libs/design-tokens/src/lib/css-vars.spec.ts libs/design-tokens/src/index.ts libs/ui-react/src/lib/css-vars.ts libs/ui-react/src/lib/css-vars.spec.ts libs/ui-react/src/index.ts
git commit -m "refactor: move cssVars from @ngaf/ui-react to @ngaf/design-tokens"
```

(`git rm` on the deleted files happens automatically when you `git add` after deletion. Verify via `git status` before committing.)

---

## Task 2: Add `installEmbeddedTheme` to `@ngaf/example-layouts`

**Files:**
- Create: `libs/example-layouts/src/lib/install-embedded-theme.ts`
- Create: `libs/example-layouts/src/lib/install-embedded-theme.spec.ts`
- Modify: `libs/example-layouts/src/public-api.ts`

- [ ] **Step 1: Write the failing tests first**

Create `libs/example-layouts/src/lib/install-embedded-theme.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installEmbeddedTheme } from './install-embedded-theme';

describe('installEmbeddedTheme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('applies the default theme immediately (dark)', () => {
    installEmbeddedTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Verify a representative --ds-* var got set to the dark value
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('#0e1117');
  });

  it('accepts a non-default initial theme', () => {
    installEmbeddedTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('#fafbfc');
  });

  it('posts ngaf:theme-request to window.parent on call', () => {
    const spy = vi.spyOn(window.parent, 'postMessage');
    installEmbeddedTheme();
    expect(spy).toHaveBeenCalledWith({ type: 'ngaf:theme-request' }, '*');
  });

  it('updates theme on ngaf:theme message receipt', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'light' } })
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('#fafbfc');
  });

  it('ignores malformed messages', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'banana' } })
    );
    expect(document.documentElement.dataset.theme).toBe('dark'); // unchanged
  });

  it('ignores unrelated message types', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'something-else', theme: 'light' } })
    );
    expect(document.documentElement.dataset.theme).toBe('dark'); // unchanged
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
pnpm nx test example-layouts
```

Expected: FAIL — `install-embedded-theme` module not found.

- [ ] **Step 3: Implement the helper**

Create `libs/example-layouts/src/lib/install-embedded-theme.ts`:

```ts
import { cssVars, type Theme } from '@ngaf/design-tokens';

/**
 * Bootstraps an embedded example app's theme. Call once before the
 * framework (Angular, Vue, etc.) bootstraps.
 *
 * Behavior:
 *   1. Applies the default theme synchronously (sets `data-theme` and
 *      every `--ds-*` CSS variable on `document.documentElement`).
 *   2. Posts `{ type: 'ngaf:theme-request' }` to `window.parent` so the
 *      host (cockpit's `<ThemedFrame>`) replies with the current theme
 *      even if its broadcast ran before this iframe mounted.
 *   3. Listens for `ngaf:theme` messages and re-applies on receipt.
 *
 * Idempotent: subsequent identical messages are no-ops visually.
 */
export function installEmbeddedTheme(defaultTheme: Theme = 'dark'): void {
  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    const vars = cssVars(theme) as Record<string, string>;
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
  };

  apply(defaultTheme);

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      typeof data === 'object' &&
      data.type === 'ngaf:theme' &&
      (data.theme === 'light' || data.theme === 'dark')
    ) {
      apply(data.theme);
    }
  });

  window.parent?.postMessage({ type: 'ngaf:theme-request' }, '*');
}
```

- [ ] **Step 4: Re-export from public API**

Edit `libs/example-layouts/src/public-api.ts` (or `src/index.ts` — read it first to confirm the barrel filename). Add:

```ts
export { installEmbeddedTheme } from './lib/install-embedded-theme';
```

- [ ] **Step 5: Verify tests pass**

```bash
pnpm nx test example-layouts
```

Expected: PASS, six tests in `install-embedded-theme.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add libs/example-layouts/src/lib/install-embedded-theme.ts libs/example-layouts/src/lib/install-embedded-theme.spec.ts libs/example-layouts/src/public-api.ts
git commit -m "feat(example-layouts): add installEmbeddedTheme for iframed apps"
```

---

## Task 3: Add `theme.css` to `@ngaf/example-layouts`

**Files:**
- Create: `libs/example-layouts/src/theme.css`
- Modify: `libs/example-layouts/package.json`

- [ ] **Step 1: Create the CSS entry**

Create `libs/example-layouts/src/theme.css`:

```css
/*
 * @ngaf/example-layouts/theme.css
 *
 * Tailwind v4 entry point for embedded example apps. The host (cockpit)
 * applies `--ds-*` variables to `<html>` via `installEmbeddedTheme()`;
 * this file provides:
 *
 *   1. Tailwind v4 import — utility class generation.
 *   2. `dark:` variant rule — `dark:bg-foo` lights up when
 *      `<html data-theme="dark">`.
 *   3. Namespace bridge — chat library and other internal namespaces
 *      can be wired to the design-tokens palette here, in one place.
 */
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"] *));

/*
 * Namespace bridge: legacy `--ngaf-chat-*` variables (used inside the
 * chat library and existing example components) inherit from the
 * design-tokens palette. Removing this bridge requires migrating the
 * chat library internals to read `--ds-*` directly — out of scope.
 */
:root {
  --ngaf-chat-bg: var(--ds-canvas);
  --ngaf-chat-text: var(--ds-text-primary);
  --ngaf-chat-text-muted: var(--ds-text-muted);
  --ngaf-chat-surface-alt: var(--ds-surface-tinted);
  --ngaf-chat-separator: var(--ds-border);
  --ngaf-chat-font-family: var(--ds-font-sans);
}
```

- [ ] **Step 2: Update `package.json` to export the CSS**

Read `libs/example-layouts/package.json`. Add a `tailwindcss` peerDependency (or devDependency — the consuming apps need v4, so peerDependency is the honest signal) and an `exports` entry for the CSS:

```jsonc
{
  "name": "@ngaf/example-layouts",
  "version": "0.0.X",  // bump patch
  "peerDependencies": {
    "tailwindcss": "^4.0.0"
    // ... preserve existing peerDeps
  },
  "exports": {
    ".": "./src/public-api.ts",  // or whatever the existing barrel entry is
    "./theme.css": "./src/theme.css"
  }
}
```

Preserve all existing fields. Only add `peerDependencies.tailwindcss` and the `exports."./theme.css"` line.

- [ ] **Step 3: Commit**

```bash
git add libs/example-layouts/src/theme.css libs/example-layouts/package.json
git commit -m "feat(example-layouts): add theme.css (Tailwind v4 + dark variant + namespace bridge)"
```

---

## Task 4: Workspace-level Tailwind v4 PostCSS config

**Files:**
- Create: `postcss.config.mjs` (workspace root) **or** `cockpit/chat/timeline/angular/postcss.config.mjs`
- Modify: workspace `package.json` to add `@tailwindcss/postcss` + `tailwindcss` to devDeps

The Angular builder (`@angular/build:application`) reads PostCSS config from the workspace root or app root. Workspace-root config is simpler — one file applies to every Angular app that picks up Tailwind through its `styles.css`.

- [ ] **Step 1: Add dependencies**

This repo uses `npm` at the root (per memory). Run:

```bash
npm install --save-dev tailwindcss@^4 @tailwindcss/postcss@^4
```

Expected: `package.json` devDeps gain both packages; `package-lock.json` updates. **Critical:** do NOT regenerate the lockfile from scratch (drops Linux `@next/swc-*` bindings); only let npm add the new entries.

- [ ] **Step 2: Verify the lockfile preserves Linux SWC bindings**

```bash
rg '"@next/swc-linux' package-lock.json
```

Expected: 1+ matches (the Linux-x64 SWC binaries). If gone, abort — the lockfile shouldn't have been regenerated.

- [ ] **Step 3: Create the PostCSS config at workspace root**

Create `/Users/blove/repos/angular-agent-framework/postcss.config.mjs`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

Mirror exactly what `apps/website/postcss.config.mjs` looks like (read it first to confirm).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs
git commit -m "chore: add Tailwind v4 + @tailwindcss/postcss to workspace devDeps"
```

---

## Task 5: Migrate the pilot — `cockpit/chat/timeline/angular`

**Files:**
- Modify: `cockpit/chat/timeline/angular/src/index.html`
- Modify: `cockpit/chat/timeline/angular/src/styles.css`
- Modify: `cockpit/chat/timeline/angular/src/main.ts`
- Modify: `cockpit/chat/timeline/angular/src/app/timeline.component.ts`

- [ ] **Step 1: Update `index.html`**

Read the current file. Replace contents:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chat Timeline — Angular</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <app-timeline></app-timeline>
</body>
</html>
```

Changes from baseline: drop `<script src="https://cdn.tailwindcss.com">`, drop `class="bg-gray-950 text-gray-100 h-screen"` from `<body>`. The body's appearance now flows from `--ds-*` vars set on `<html>` by `installEmbeddedTheme()`.

- [ ] **Step 2: Update `styles.css`**

Replace contents:

```css
@import "@ngaf/example-layouts/theme.css";

/* App-specific globals (none for now; add below this line if needed). */
html, body {
  height: 100%;
  margin: 0;
  background: var(--ds-canvas);
  color: var(--ds-text-primary);
  font-family: var(--ds-font-sans);
}
```

- [ ] **Step 3: Update `main.ts`**

Read the current file. Insert the theme install before the bootstrap call:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { installEmbeddedTheme } from '@ngaf/example-layouts';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

installEmbeddedTheme();

bootstrapApplication(TimelineComponent, appConfig).catch((err) =>
  console.error(err),
);
```

Preserve any existing imports and bootstrap chaining; only add the `installEmbeddedTheme` import + call.

- [ ] **Step 4: Migrate the component template**

Read `cockpit/chat/timeline/angular/src/app/timeline.component.ts`. In the `template:` block, apply the following replacements:

| From | To |
|---|---|
| `style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);"` | `style="background: var(--ds-canvas); color: var(--ds-text-primary);"` |
| `style="color: var(--chat-text-muted, #777);"` | `style="color: var(--ds-text-muted);"` |
| `bg-gray-950` | `bg-[var(--ds-canvas)]` |
| `bg-gray-900` | `bg-[var(--ds-surface)]` |
| `text-gray-100` | `text-[var(--ds-text-primary)]` |
| `text-gray-200` | `text-[var(--ds-text-secondary)]` |
| `text-gray-300` | `text-[var(--ds-text-secondary)]` |
| `text-gray-400` | `text-[var(--ds-text-muted)]` |
| `text-gray-500` | `text-[var(--ds-text-muted)]` |
| `border-gray-800` | `border-[var(--ds-border)]` |
| `border-gray-700` | `border-[var(--ds-border-strong)]` |

The actual file content currently uses inline `style="background: var(--chat-bg, #171717); color: var(--chat-text, #e0e0e0);"` patterns — verify exact strings before editing and adjust the mapping if other classes appear.

- [ ] **Step 5: Build the pilot**

```bash
pnpm nx build chat-timeline-angular
```

Expected: clean build, no errors, no unresolved CSS imports. The build output should include Tailwind-generated utility classes for `bg-[var(--ds-canvas)]` etc.

If the project ID isn't `chat-timeline-angular`, find the correct one:

```bash
pnpm nx show projects | rg 'chat.*timeline'
```

- [ ] **Step 6: Commit**

```bash
git add cockpit/chat/timeline/angular/src/index.html cockpit/chat/timeline/angular/src/styles.css cockpit/chat/timeline/angular/src/main.ts cockpit/chat/timeline/angular/src/app/timeline.component.ts
git commit -m "feat(examples): migrate chat-timeline to Tailwind v4 + theme sync"
```

---

## Task 6: Version bumps + full check stack

**Files:**
- Modify: `libs/design-tokens/package.json` (0.0.32 → 0.0.33)
- Modify: `libs/ui-react/package.json` (0.0.30 → 0.0.31)
- Modify: `libs/example-layouts/package.json` (patch bump from current)

- [ ] **Step 1: Read current versions**

```bash
rg '"version"' libs/design-tokens/package.json libs/ui-react/package.json libs/example-layouts/package.json
```

- [ ] **Step 2: Bump versions (patch only — never 0.1.x)**

Edit each file, increment the last digit of the version.

- [ ] **Step 3: Full check stack**

```bash
pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,cockpit
pnpm nx e2e cockpit
pnpm nx build website
pnpm nx build chat-timeline-angular
```

All five must pass green. If any fails, investigate and fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add libs/design-tokens/package.json libs/ui-react/package.json libs/example-layouts/package.json
git commit -m "chore: bump design-tokens, ui-react, example-layouts patch versions"
```

---

## Task 7: Manual chrome MCP smoke (pilot validation)

This task is human-driven (or chrome-MCP-driven). The plan documents it so the executor knows what "done" looks like.

- [ ] **Step 1: Start the dev servers**

Two terminals. Terminal 1:

```bash
pnpm nx serve cockpit
```

Wait for "Ready on http://localhost:4201".

Terminal 2:

```bash
pnpm nx serve chat-timeline-angular
```

Note the dev port it picks (e.g. `http://localhost:4202`).

- [ ] **Step 2: Open chrome to the pilot capability**

URL: `http://127.0.0.1:4201/chat/core-capabilities/timeline/overview/angular`

Verify the page loads, the embedded iframe (visible in "Run" mode) renders the chat-timeline app.

- [ ] **Step 3: Capture dark mode**

The cockpit app is dark by default. Confirm:
- The embedded iframe shows the chat-timeline app on a dark canvas (matches cockpit's `#0e1117`)
- The sidebar inside the embedded iframe is the dark surface color (matches `#161b25`)
- Text is legible (light foreground on dark background)
- No bleed-through from old hardcoded `#171717` or `#e0e0e0`

Save a screenshot to `/tmp/pilot-dark.png` (via chrome MCP screenshot or manual).

- [ ] **Step 4: Toggle to light**

Click the sun/moon icon in cockpit's sidebar footer. Confirm:
- Cockpit chrome flips to light immediately (`#fafbfc` canvas)
- Embedded iframe flips to light within ~50–200ms (postMessage round-trip)
- All chat-timeline surfaces are now light; text is dark and legible
- No bleed-through; no flash of dark content

Save a screenshot to `/tmp/pilot-light.png`.

- [ ] **Step 5: Toggle back to dark**

Click the toggle again. Confirm flip-back works symmetrically.

- [ ] **Step 6: Hand off for user review**

Send the two screenshots and the manual confirmation. If approved, the pilot is done and Stage 2 (waves of remaining 31 apps) can begin via a separate plan.

If anything looks wrong, the pilot has done its job — identify the root cause (Tailwind config? missing variable? layout-component fallback color?), fix it, and re-screenshot before proceeding.

---

## Task 8: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin examples-theme-sync
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: cockpit examples theme sync — stage 1 (library + pilot)" --body "$(cat <<'EOF'
## Summary

Stage 1 of cockpit example theme sync (spec: `docs/superpowers/specs/2026-05-13-cockpit-examples-theme-sync-design.md`).

- Move `cssVars(theme)` from `@ngaf/ui-react` to `@ngaf/design-tokens` (pure TS, framework-agnostic). `@ngaf/ui-react` re-exports for React consumers — cockpit import paths unchanged.
- Add `installEmbeddedTheme()` to `@ngaf/example-layouts` — vanilla TS, framework-agnostic helper that applies the `cssVars(theme)` palette to `<html>` and listens for `ngaf:theme` postMessage from the cockpit host.
- Add `@ngaf/example-layouts/theme.css` — Tailwind v4 entry, `dark` variant tied to `[data-theme="dark"]`, namespace bridge from legacy `--ngaf-chat-*` to `--ds-*`.
- Add workspace-level Tailwind v4 PostCSS config.
- Pilot migration: `cockpit/chat/timeline/angular` — drops v3 CDN, swaps hardcoded dark utilities for `bg-[var(--ds-canvas)]` etc., calls `installEmbeddedTheme()` from `main.ts`.

Stage 2 (remaining 31 example apps in waves) ships in a separate PR after this pilot is approved.

## Test plan

- [x] `pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,cockpit`
- [x] `pnpm nx e2e cockpit`
- [x] `pnpm nx build website`
- [x] `pnpm nx build chat-timeline-angular`
- [ ] Manual chrome MCP smoke: cockpit `chat/timeline` capability light + dark — screenshots attached

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

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
- ✅ `cssVars` move to design-tokens — Task 1
- ✅ `installEmbeddedTheme` in example-layouts — Task 2
- ✅ Centralized `theme.css` with dark variant + namespace bridge — Task 3
- ✅ Tailwind v4 workspace config — Task 4
- ✅ Pilot app migration (chat-timeline) — Task 5
- ✅ Version bumps — Task 6
- ✅ Chrome MCP smoke validation — Task 7
- ✅ PR ship — Task 8

**Placeholder scan:** No "TBD" / "TODO". One conditional path ("if the project ID isn't `chat-timeline-angular`") with the exact command to find the correct ID — that's a runtime check, not a placeholder.

**Type consistency:** `Theme`, `cssVars`, `CssVars`, `installEmbeddedTheme` — names consistent across tasks.

**Adjustments from spec during plan-prep exploration:**
1. The existing `@ngaf/example-layouts` components already use CSS variables (with light defaults) — the namespace bridge in `theme.css` handles the chat-namespace mapping without touching the layout components themselves.
2. No existing PostCSS config in any app — clean slate for v4 setup; workspace-level config is the simplest reach.
3. Manifest mapping for the pilot: `chat-timeline-angular` is at route `/chat/core-capabilities/timeline/overview/angular`.

## Stage 2 preview (not in this plan)

After pilot approval, a separate plan ships the remaining 31 apps in 4 waves grouped by library:
- Wave 1: chat (11 apps, minus timeline which is the pilot)
- Wave 2: langgraph (8 apps)
- Wave 3: deep-agents (6 apps)
- Wave 4: render + ag-ui (7 apps) + a2ui direct-import handler

Each app follows the same five-step migration from Task 5. Highly batchable for subagent dispatch.
