# Examples Theme Sync Stage 2 — PR-0 Implementation Plan (Library + Pilot Cleanup)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the library plumbing for Stage 2 (auto-install theme-sync side effect in `@ngaf/example-layouts`) and clean up the Stage 1 chat-timeline pilot so its source matches the convention all Stage 2 apps will follow.

**Architecture:** `@ngaf/example-layouts/src/public-api.ts` gains a module-level side effect that calls `installEmbeddedTheme()` on first import. Apps that import any layout component (or `installEmbeddedTheme` itself) trigger theme sync automatically — no explicit call required in `main.ts`. The pilot's explicit call is removed; its template `--ds-*` var references are migrated to `--ngaf-chat-*` to match the Q2=B convention for Stage 2.

**Tech Stack:** TypeScript, Vitest, Angular 21, Nx.

**Spec:** `docs/superpowers/specs/2026-05-15-examples-theme-sync-stage-2-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `libs/example-layouts/src/public-api.ts` | Add module-level auto-install side effect |
| Create | `libs/example-layouts/src/public-api.spec.ts` | Test that auto-install runs on module evaluation |
| Modify | `cockpit/chat/timeline/angular/src/main.ts` | Drop the explicit `installEmbeddedTheme()` import + call |
| Modify | `cockpit/chat/timeline/angular/src/app/timeline.component.ts` | Migrate template `--ds-*` refs to `--ngaf-chat-*` |
| Modify | `libs/example-layouts/package.json` | Patch bump |

---

## Task 1: Add module-level auto-install side effect

**Files:**
- Modify: `libs/example-layouts/src/public-api.ts`

The current barrel re-exports `installEmbeddedTheme` but never calls it. Adding a side effect that runs once on module evaluation means apps get theme sync just by importing any export (e.g., a layout component).

- [ ] **Step 1: Read current file**

```bash
cat libs/example-layouts/src/public-api.ts
```

Expected (3 lines):

```ts
export { ExampleChatLayoutComponent } from './lib/example-chat-layout.component';
export { ExampleSplitLayoutComponent } from './lib/example-split-layout.component';
export { installEmbeddedTheme } from './lib/install-embedded-theme';
```

- [ ] **Step 2: Rewrite with auto-install side effect**

Replace contents with:

```ts
import { installEmbeddedTheme } from './lib/install-embedded-theme';

export { ExampleChatLayoutComponent } from './lib/example-chat-layout.component';
export { ExampleSplitLayoutComponent } from './lib/example-split-layout.component';
export { installEmbeddedTheme } from './lib/install-embedded-theme';

/*
 * Auto-install theme sync on module evaluation.
 *
 * Every cockpit example app imports at least one symbol from this
 * library (a layout component, typically). The act of importing
 * evaluates this module and triggers the side effect below — so apps'
 * `main.ts` files stay free of cockpit-specific boilerplate.
 *
 * `installEmbeddedTheme()` is benign when not iframed: it sets
 * `data-theme="dark"` + applies cssVars on `<html>`, posts to
 * `window.parent` (which equals `window` standalone, so the message
 * goes to self), and listens for `ngaf:theme` events that don't
 * arrive unless a host (cockpit's `<ThemedFrame>`) is broadcasting.
 *
 * Guarded on `typeof document` so SSR doesn't crash.
 */
if (typeof document !== 'undefined') {
  installEmbeddedTheme();
}
```

The `import { installEmbeddedTheme }` line at the top imports it for the side effect; the `export { installEmbeddedTheme }` line re-exports it for callers who want to invoke it manually (kept for backwards compat, even though the side effect makes it redundant in practice).

- [ ] **Step 3: Verify existing tests still pass**

```bash
pnpm nx test example-layouts
```

Expected: green. `install-embedded-theme.spec.ts` tests the function directly; the auto-install in `public-api.ts` doesn't affect those tests (they import the function, not the barrel).

- [ ] **Step 4: Commit**

```bash
git add libs/example-layouts/src/public-api.ts
git commit -m "feat(example-layouts): auto-install theme sync on module load"
```

---

## Task 2: Add test for auto-install side effect

**Files:**
- Create: `libs/example-layouts/src/public-api.spec.ts`

Verifies that importing the barrel triggers `installEmbeddedTheme()` (observable via `data-theme` attribute on `<html>`).

- [ ] **Step 1: Write the test**

Create `libs/example-layouts/src/public-api.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('public-api auto-install side effect', () => {
  beforeEach(() => {
    // Reset module cache so the side effect re-runs on each test's import.
    vi.resetModules();
    // Clean slate on the DOM.
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('sets data-theme="dark" on document.documentElement when the barrel is imported', async () => {
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await import('./public-api');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies --ds-* CSS variables to documentElement on barrel import', async () => {
    await import('./public-api');
    const canvas = document.documentElement.style
      .getPropertyValue('--ds-canvas')
      .trim();
    // After PR #321 + #333: dark canvas is rgb(17, 17, 17)
    expect(canvas).toBe('rgb(17, 17, 17)');
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm nx test example-layouts -- --run public-api.spec
```

Expected: 2 tests passing.

If the second test fails because `--ds-canvas` returns a different value, that means PR #333's dark palette didn't fully land or the file has been re-edited. Verify by reading `libs/design-tokens/src/lib/dark.ts` and confirm `canvas: 'rgb(17, 17, 17)'`.

- [ ] **Step 3: Commit**

```bash
git add libs/example-layouts/src/public-api.spec.ts
git commit -m "test(example-layouts): verify auto-install side effect"
```

---

## Task 3: Pilot main.ts cleanup

**Files:**
- Modify: `cockpit/chat/timeline/angular/src/main.ts`

After Task 1's auto-install, the pilot's explicit `installEmbeddedTheme()` call is redundant. Remove it so the pilot's `main.ts` matches the clean form every Stage 2 app will use.

- [ ] **Step 1: Read current file**

```bash
cat cockpit/chat/timeline/angular/src/main.ts
```

Expected:

```ts
// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { installEmbeddedTheme } from '@ngaf/example-layouts';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

installEmbeddedTheme();

bootstrapApplication(TimelineComponent, appConfig).catch(console.error);
```

- [ ] **Step 2: Remove the explicit installEmbeddedTheme**

Replace contents with:

```ts
// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { TimelineComponent } from './app/timeline.component';

bootstrapApplication(TimelineComponent, appConfig).catch(console.error);
```

Two deletions:
- `import { installEmbeddedTheme } from '@ngaf/example-layouts';` — the import line
- `installEmbeddedTheme();` — the call line
- Plus the blank line between the call and `bootstrapApplication` (cosmetic, drop it)

The auto-install side effect activates because `TimelineComponent` (imported below) transitively imports `ExampleChatLayoutComponent` from `@ngaf/example-layouts`.

- [ ] **Step 3: Build the pilot to confirm**

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: clean build. The auto-install side effect runs at app boot via the transitive import.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/timeline/angular/src/main.ts
git commit -m "refactor(examples): pilot main.ts clean — drop explicit installEmbeddedTheme"
```

---

## Task 4: Pilot template var migration

**Files:**
- Modify: `cockpit/chat/timeline/angular/src/app/timeline.component.ts`

PR #301's pilot used `--ds-*` template refs. Stage 2 standardizes on `--ngaf-chat-*` (Q2=B from brainstorming). Migrate the pilot to match.

- [ ] **Step 1: Read the relevant template section**

```bash
grep -B 1 -A 2 "var(--ds-" cockpit/chat/timeline/angular/src/app/timeline.component.ts
```

Expected to find inline `style="..."` attributes referencing `--ds-canvas`, `--ds-text-primary`, `--ds-text-muted`.

- [ ] **Step 2: Apply the find/replace**

Replace these inline style strings throughout the file (use Edit tool's `replace_all` if the strings are unique enough):

| From | To |
|---|---|
| `var(--ds-canvas)` | `var(--ngaf-chat-bg)` |
| `var(--ds-text-primary)` | `var(--ngaf-chat-text)` |
| `var(--ds-text-muted)` | `var(--ngaf-chat-text-muted)` |

The replacements only affect inline `style="..."` attributes. No other code references these in this file.

- [ ] **Step 3: Verify no `--ds-*` refs remain in the file**

```bash
grep "var(--ds-" cockpit/chat/timeline/angular/src/app/timeline.component.ts
```

Expected: no matches.

- [ ] **Step 4: Build to confirm**

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/timeline/angular/src/app/timeline.component.ts
git commit -m "refactor(examples): pilot template uses --ngaf-chat-* (Stage 2 convention)"
```

---

## Task 5: Version bump + full check stack

**Files:**
- Modify: `libs/example-layouts/package.json`

- [ ] **Step 1: Read current version**

```bash
grep '"version"' libs/example-layouts/package.json
```

- [ ] **Step 2: Bump patch**

Increment the last digit. Patch-only rule — never bump to 0.1.x.

- [ ] **Step 3: Run the full check stack**

```bash
pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit
```

Expected: all green.

```bash
pnpm nx e2e cockpit
```

Expected: all green. (Local may be blocked by `.next/dev/lock` if a dev server is running; CI runs e2e on the PR.)

```bash
pnpm nx build website
```

Expected: green.

```bash
pnpm nx build cockpit-chat-timeline-angular
```

Expected: green.

If anything fails:
- **`example-layouts:test` — public-api.spec.ts fails on canvas value:** PR #333's dark palette changes may not be on this branch yet. Verify `libs/design-tokens/src/lib/dark.ts` has `canvas: 'rgb(17, 17, 17)'`.
- **Pilot build fails on missing `--ds-*` token:** verify Task 4's migration covered the full file. The chat lib's `--ngaf-chat-*` vars are auto-injected, so no setup needed.

- [ ] **Step 4: Commit**

```bash
git add libs/example-layouts/package.json
git commit -m "chore: bump example-layouts patch version"
```

---

## Task 6: Open PR + merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin examples-theme-sync-stage-2
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(example-layouts): PR-0 auto-install side effect + pilot cleanup" --body "$(cat <<'EOF'
## Summary

PR-0 of Stage 2 (spec: \`docs/superpowers/specs/2026-05-15-examples-theme-sync-stage-2-design.md\`, plan: \`docs/superpowers/plans/2026-05-15-examples-theme-sync-stage-2-pr-0.md\`).

- **\`@ngaf/example-layouts\` auto-install:** new module-level side effect in \`src/public-api.ts\` calls \`installEmbeddedTheme()\` once on module load. Any app importing a layout component (or the function itself) triggers theme sync automatically — Stage 2 apps' \`main.ts\` files no longer need cockpit-specific boilerplate. Side effect is guarded on \`typeof document\` for SSR safety; benign when not iframed (postMessage to self, no listener).
- **Pilot cleanup:** \`cockpit/chat/timeline/angular\` (the Stage 1 pilot) had an explicit \`installEmbeddedTheme()\` import and call in \`main.ts\`. Removed — the auto-install handles it via the transitive \`ExampleChatLayoutComponent\` import. The pilot's component template also migrated from \`--ds-*\` to \`--ngaf-chat-*\` to match the Stage 2 convention (Q2=B from brainstorming).
- **New test:** \`public-api.spec.ts\` verifies the auto-install side effect — imports the barrel, asserts \`data-theme\` and \`--ds-canvas\` are set on \`<html>\`.

After this PR lands, Stage 2 wave PRs (PR-1 chat, PR-2 langgraph, PR-3 deep-agents, PR-4 render+ag-ui) migrate the remaining 31 apps following the same clean pattern.

## Test plan

- [x] \`pnpm nx run-many -t lint,test -p design-tokens,ui-react,example-layouts,chat,cockpit\` — green
- [x] \`pnpm nx e2e cockpit\` — green
- [x] \`pnpm nx build website\` — green
- [x] \`pnpm nx build cockpit-chat-timeline-angular\` — green
- [ ] Manual chrome MCP smoke: chat-timeline capability in cockpit, light + dark, verify pilot still works after pilot-cleanup changes

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
- ✅ Decision 1 (auto-install in `public-api.ts`) → Task 1
- ✅ "Pilot cleanup" section (drop explicit call, migrate template refs) → Tasks 3, 4
- ✅ Auto-install behavior tests → Task 2
- ✅ Manual smoke deferred to post-merge (visual eyeball of the pilot still working)

**Adjustments from spec during plan-prep:**
1. **SSR guard placement.** The spec says "no-op outside iframes" but `installEmbeddedTheme()` itself reads `document.documentElement` immediately, which would crash in SSR. Added the `typeof document !== 'undefined'` guard at the side effect call site in `public-api.ts` (Task 1 Step 2). Function itself unchanged.
2. **Test verifies observable state**, not function-spy. `vi.resetModules()` + dynamic import + DOM assertion. Cleaner than trying to spy on the imported function before module load.
3. **Backwards-compat re-export of `installEmbeddedTheme`** — keeping the named export even though the side effect makes it redundant. External consumers who imported it directly continue to work; no API surface removed.

**Placeholder scan:** No "TBD" / "TODO". All commit messages spelled out. Test code complete; production code complete.

**Type consistency:** `installEmbeddedTheme`, `Theme`, `--ngaf-chat-*` token names consistent across all tasks.
