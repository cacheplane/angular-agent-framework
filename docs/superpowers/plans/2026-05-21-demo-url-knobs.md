# Demo URL knob round-trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round-trip the demo's agent knobs (model, effort, genui, theme, color, project) through the URL with ephemeral hydration semantics, on top of the URL-as-truth thread-id work already on main.

**Architecture:** Add three private methods to `DemoShell` — `hydrateFromQuery()` (URL→signal bridge, called via a NavigationEnd-driven effect; never writes localStorage), `writeKnobsToUrl()` (signal→URL bridge, called by each knob handler), and `buildQueryParams()` (defaults→null mapping that drops default values from the URL). Update `onModeChange` + the existing signal→URL thread-switch effect to pass `queryParamsHandling: 'preserve'`. No app.routes.ts changes — UrlMatcher already handles the path shape.

**Tech Stack:** Angular 22, Angular Router (`Router`, `ActivatedRoute`), Angular signals (`signal`, `effect`, `untracked`), `@nx/vitest:test` for unit tests, `@nx/playwright:playwright` for e2e, `mcp__Claude_in_Chrome__*` for local browser verification.

---

### Task 1: URL → signal hydration (`hydrateFromQuery`)

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts:125-134` (add new effect alongside the URL→threadId effect) and add a new private method
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` (add 2 tests at end of `DemoShell — URL thread sync` block or in a new `DemoShell — URL knob hydration` block)

- [ ] **Step 1: Write the failing test — knob hydration from query params**

Append to `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`:

```ts
describe('DemoShell — URL knob hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        threadsAdapterProvider,
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('hydrates knob signals from URL query params', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano&effort=high&theme=material-dark');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      model: () => string;
      effort: () => string;
      theme: () => string;
    };
    expect(cmp.model()).toBe('gpt-5-nano');
    expect(cmp.effort()).toBe('high');
    expect(cmp.theme()).toBe('material-dark');
  });

  it('does NOT write to localStorage when hydrating from URL (ephemeral semantics)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?theme=material-dark');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    const stored = raw ? JSON.parse(raw) : {};
    expect(stored.theme).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, verify both fail**

Run: `npx nx test examples-chat-angular`

Expected: 2 new failures in `DemoShell — URL knob hydration` block — `cmp.model()` returns `'gpt-5-mini'` (default), `theme()` returns `'default-dark'` (default). The other 25 tests still pass.

- [ ] **Step 3: Implement `hydrateFromQuery()`**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`, add a new private method (anywhere after the constructor block; the existing `validateUrlThreadId` method at ~line 436 is a good neighbor):

```ts
/** URL → signal bridge for agent knobs. Fires on every NavigationEnd
 *  via the constructor effect. Sets each knob signal to its URL value
 *  iff present and different. NEVER writes to persistence — that's
 *  the "ephemeral hydration" contract: shared links override signals
 *  but don't clobber a recipient's localStorage. Explicit user
 *  actions (onModelChange etc.) still persist via persistence.write.
 *
 *  Explicit per-knob blocks (not a typed loop) because `colorScheme`
 *  is constrained to `'light' | 'dark'` — a generic loop would need
 *  ugly casts or runtime any. */
private hydrateFromQuery(): void {
  const params = new URL(this.router.url, 'http://x').searchParams;

  const model = params.get('model');
  if (model !== null && model !== this.model()) this.model.set(model);

  const effort = params.get('effort');
  if (effort !== null && effort !== this.effort()) this.effort.set(effort);

  const genui = params.get('genui');
  if (genui !== null && genui !== this.genUiMode()) this.genUiMode.set(genui);

  const theme = params.get('theme');
  if (theme !== null && theme !== this.theme()) this.theme.set(theme);

  const color = params.get('color');
  if ((color === 'light' || color === 'dark') && color !== this.colorScheme()) {
    this.colorScheme.set(color);
  }

  const project = params.get('project');
  if (project !== null && project !== this.selectedProjectId()) {
    this.selectedProjectId.set(project);
  }
}
```

- [ ] **Step 4: Wire the hydration effect**

In the constructor, immediately after the existing URL→threadId effect (the one at ~line 130-134 that ends with `this.threadIdSignal.set(urlId);`), add:

```ts
// URL → knob signals. Tracks urlState() so it re-fires on every
// NavigationEnd (mode changes, query-param-only navigations both
// emit). hydrateFromQuery is untracked-called because it reads
// every knob signal and we don't want this effect to retrigger
// itself when it writes them.
effect(() => {
  void this.urlState();
  untracked(() => this.hydrateFromQuery());
});
```

- [ ] **Step 5: Run tests, verify both pass**

Run: `npx nx test examples-chat-angular`

Expected: 27/27 passing. If "hydrates knob signals from URL query params" still fails, double-check that `hydrateFromQuery()` is being called — add a `console.log` temporarily to confirm. If "does NOT write to localStorage" fails, check that no `persistence.write(...)` was added inside `hydrateFromQuery`.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(examples-chat): hydrate knob signals from URL query params

Adds hydrateFromQuery() private method on DemoShell, wired via a
NavigationEnd-driven effect. Six knobs (model, effort, genui, theme,
color, project) are read from query params and set on their signals
when present.

Ephemeral semantics: URL hydration does NOT write to localStorage.
A recipient of a shared link gets the URL-specified state but their
own persisted preferences remain untouched. Explicit user actions
(via onModelChange etc.) continue to persist."
```

---

### Task 2: Signal → URL writes (`writeKnobsToUrl`, `buildQueryParams`, knob handler wiring)

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts` — add 2 private methods + update 6 knob handlers
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` — 3 new tests

- [ ] **Step 1: Write the failing tests — defaults dropped, non-default written, user action persists**

Append to the `DemoShell — URL knob hydration` describe block in `demo-shell.component.spec.ts`:

```ts
  it('drops default knob values from URL on change-to-default', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModelChange(v: string): void;
    };
    cmp.onModelChange('gpt-5-mini'); // default
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).not.toContain('model=');
  });

  it('writes non-default knob values to URL on change', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModelChange(v: string): void;
    };
    cmp.onModelChange('gpt-5-nano');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('model=gpt-5-nano');
  });

  it('user knob action persists to localStorage (regression guard)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onThemeChange(v: string): void;
    };
    cmp.onThemeChange('material-dark');
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    const stored = raw ? JSON.parse(raw) : {};
    expect(stored.theme).toBe('material-dark');
  });
```

- [ ] **Step 2: Run tests, verify the 3 new ones fail**

Run: `npx nx test examples-chat-angular`

Expected: "drops default knob values…" fails (URL still contains `model=` because we never wrote to it from the existing onModelChange), "writes non-default knob values…" fails (same reason), "user knob action persists…" passes already (existing behavior). The 2 hydration tests from Task 1 still pass.

- [ ] **Step 3: Implement `buildQueryParams()` + `writeKnobsToUrl()`**

Add to `demo-shell.component.ts` near `hydrateFromQuery`:

```ts
/** Build the full knob → URL-value mapping. Default values become
 *  null so Angular's router drops them from the resulting URL when
 *  used with queryParamsHandling: 'merge'. */
private buildQueryParams(): Record<string, string | null> {
  return {
    model:   this.model()             === 'gpt-5-mini'    ? null : this.model(),
    effort:  this.effort()            === 'minimal'       ? null : this.effort(),
    genui:   this.genUiMode()         === 'a2ui'          ? null : this.genUiMode(),
    theme:   this.theme()             === 'default-dark'  ? null : this.theme(),
    color:   this.colorScheme()       === 'dark'          ? null : this.colorScheme(),
    project: this.selectedProjectId() ?? null,
  };
}

/** Signal → URL bridge for agent knobs. Called by each knob handler
 *  after it sets its signal + persistence. Uses queryParamsHandling:
 *  'merge' + replaceUrl so dropdown clicks don't pollute history. */
private writeKnobsToUrl(): void {
  void this.router.navigate([], {
    queryParams: this.buildQueryParams(),
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
```

- [ ] **Step 4: Wire all 6 knob handlers**

Update each handler to add a final `this.writeKnobsToUrl()` call:

```ts
onModelChange(next: string): void {
  this.model.set(next);
  this.persistence.write('model', next);
  this.writeKnobsToUrl();
}

protected onEffortChange(next: string): void {
  this.effort.set(next);
  this.persistence.write('effort', next);
  this.writeKnobsToUrl();
}

protected onGenUiModeChange(next: string): void {
  this.genUiMode.set(next);
  this.persistence.write('genUiMode', next);
  this.writeKnobsToUrl();
}

protected onThemeChange(next: string): void {
  this.theme.set(next);
  this.persistence.write('theme', next);
  this.writeKnobsToUrl();
}

protected onColorSchemeChange(next: 'light' | 'dark' | string): void {
  if (next !== 'light' && next !== 'dark') return;
  this.colorScheme.set(next);
  this.persistence.write('colorScheme', next);
  this.writeKnobsToUrl();
}

protected onProjectSelected(projectId: string): void {
  this.selectedProjectId.set(projectId);
  this.persistence.write('selectedProjectId', projectId);
  this.writeKnobsToUrl();
}
```

Note: `onProjectSelected` previously did not persist. Restore the existing behavior intact — only ADD the `writeKnobsToUrl()` call. Re-read the file at line 491 to confirm the original body and don't drop other lines.

- [ ] **Step 5: Re-read `onProjectSelected` to verify nothing was clobbered**

Run: `sed -n '491,500p' examples/chat/angular/src/app/shell/demo-shell.component.ts`

Expected: the body matches the file before your edit, plus the new `writeKnobsToUrl()` line. If `persistence.write('selectedProjectId', projectId)` did NOT exist before, do NOT add it — the call to `writeKnobsToUrl()` is enough to round-trip the project through the URL. Confirm against the live file.

- [ ] **Step 6: Run tests, verify all pass**

Run: `npx nx test examples-chat-angular`

Expected: 30/30 passing (25 prior + 5 from Tasks 1–2).

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(examples-chat): write knob signal changes to URL query params

Adds buildQueryParams() + writeKnobsToUrl() private methods.
Each of the six knob handlers (onModelChange, onEffortChange,
onGenUiModeChange, onThemeChange, onColorSchemeChange,
onProjectSelected) now calls writeKnobsToUrl() after persisting.

Default values are mapped to null in buildQueryParams() so the
Angular router drops them from the URL with queryParamsHandling:
'merge'. replaceUrl: true so dropdown clicks don't pollute the
browser history."
```

---

### Task 3: Preserve query params on mode change + thread switch

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts` — update `onModeChange` (line ~424) and the signal→URL effect (line ~152-159)
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` — 2 new tests

- [ ] **Step 1: Write the failing tests — mode and thread preserve query params**

Append to the `DemoShell — URL knob hydration` describe block:

```ts
  it('preserves query params on mode change', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      onModeChange(next: string): void;
    };
    cmp.onModeChange('popup');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('model=gpt-5-nano');
  });

  it('preserves query params on thread switch (signal→URL effect)', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();

    const cmp = fx.componentInstance as unknown as {
      threadIdSignal: { set(v: string | null): void };
    };
    cmp.threadIdSignal.set('xyz123');
    fx.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(router.url).toContain('/embed/xyz123');
    expect(router.url).toContain('model=gpt-5-nano');
  });
```

- [ ] **Step 2: Run tests, verify both fail**

Run: `npx nx test examples-chat-angular`

Expected: both fail because `onModeChange` and the signal→URL effect both call `router.navigate(...)` without `queryParamsHandling`, which DROPS query params. The URL becomes `/popup` (no model=) and `/embed/xyz123` (no model=).

- [ ] **Step 3: Update `onModeChange`**

In `demo-shell.component.ts`, change `onModeChange` (around line 424) to:

```ts
protected onModeChange(next: DemoMode | string): void {
  // Preserve the active thread across mode switches: /embed/abc →
  // /popup/abc keeps the conversation visible in the new chrome.
  // Preserve query params so knob state survives the mode hop.
  const id = this.threadIdSignal();
  void this.router.navigate(
    id ? ['/', next, id] : ['/', next],
    { queryParamsHandling: 'preserve' },
  );
}
```

- [ ] **Step 4: Update the signal → URL effect**

In `demo-shell.component.ts`, change the signal→URL effect (around lines 152-159) to:

```ts
// signal → URL. When the agent auto-creates a thread, the sidenav
// switches threads, or onNewThread fires, push the new id into the
// URL. Skips when the URL already matches (also breaks the loop).
// Preserves query params so knob state survives the thread hop.
effect(() => {
  const sigId = this.threadIdSignal();
  const { mode, threadId: urlId } = this.urlState();
  if (sigId === urlId) return;
  const cmds: unknown[] = sigId ? ['/', mode, sigId] : ['/', mode];
  void this.router.navigate(cmds as string[], { queryParamsHandling: 'preserve' });
});
```

- [ ] **Step 5: Run tests, verify all pass**

Run: `npx nx test examples-chat-angular`

Expected: 32/32 passing.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(examples-chat): preserve query params on mode and thread switch

Two navigations were dropping knob query params silently:
- onModeChange (e.g. clicking 'Popup' in the segmented control)
- the signal→URL effect that pushes agent-allocated thread ids

Both now use queryParamsHandling: 'preserve' so the URL's full state
(thread + knobs) survives mode hops and thread switches."
```

---

### Task 4: Deep-link e2e (`url-routing.spec.ts`)

**Files:**
- Create: `examples/chat/angular/e2e/url-routing.spec.ts`

- [ ] **Step 1: Confirm aimock fixtures have a usable seeded thread**

Run: `ls examples/chat/angular/e2e/fixtures/`

Expected: includes `hi.json` (the canonical "say hi briefly" fixture used by `sendPromptAndWait`). The e2e cannot pin a specific thread id from a fixture file — fixtures replay LLM responses, not LangGraph thread state. Strategy: first test creates a thread via the chat flow, captures its id, then navigates to `/embed/<id>` to verify deep-link rendering.

- [ ] **Step 2: Write the e2e spec**

Create `examples/chat/angular/e2e/url-routing.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import {
  activeThreadIdFromUrl,
  messageInput,
  openDemo,
  sendButton,
  waitForFinalAssistant,
} from './test-helpers';

test('url routing: deep-link with thread id loads that thread', async ({ page }) => {
  // Bootstrap: create a thread by sending one message.
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);

  await expect(page).toHaveURL(/\/embed\/[A-Za-z0-9-]+$/);
  const threadId = await activeThreadIdFromUrl(page);
  expect(threadId).toBeTruthy();

  // Reload via direct navigation to /embed/<id> — assert the existing
  // assistant message renders without resending the prompt.
  await page.goto(`/embed/${threadId}`);
  await expect(page.locator('chat-message[data-role="assistant"]')).toContainText(/hi/i, {
    timeout: 30_000,
  });
});

test('url routing: deep-link with knob param sets the picker', async ({ page }) => {
  await openDemo(page, '/embed?model=gpt-5-nano');

  // The model toolbar trigger surfaces the current model. Confirm the URL
  // value won, not the default.
  const modelTrigger = page.locator('.demo-shell__field[data-field="model"] .chat-select__trigger');
  await expect(modelTrigger).toContainText('gpt-5-nano');
});

test('url routing: mode switch preserves thread + knob params', async ({ page }) => {
  // Bootstrap: thread + non-default knob.
  await openDemo(page, '/embed');
  await messageInput(page).fill('say hi briefly');
  await sendButton(page).click();
  await waitForFinalAssistant(page);
  const threadId = await activeThreadIdFromUrl(page);
  expect(threadId).toBeTruthy();

  // Set a non-default model via the toolbar.
  const modelTrigger = page.locator('.demo-shell__field[data-field="model"] .chat-select__trigger');
  await modelTrigger.click();
  await page.locator('.chat-select__option', { hasText: 'gpt-5-nano' }).first().click();
  await expect(page).toHaveURL(/[?&]model=gpt-5-nano/);

  // Click Popup mode in the segmented control.
  await page.locator('.demo-shell__segmented-button', { hasText: 'Popup' }).click();

  // URL holds both thread + knob param.
  await expect(page).toHaveURL(new RegExp(`/popup/${threadId}(\\?|\\?.*&)model=gpt-5-nano`));
});

test('url routing: ephemeral hydration does not write to localStorage', async ({ page }) => {
  // Visit with a non-default theme in the URL.
  await openDemo(page, '/embed?theme=material-dark');

  // openDemo clears localStorage before the test starts; assert it's
  // still clean (no `theme: 'material-dark'` written by hydration).
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('ngaf-chat-demo:palette');
    return raw ? (JSON.parse(raw) as { theme?: string }).theme : null;
  });
  expect(stored).toBeNull();
});
```

- [ ] **Step 3: Run the new e2e suite locally (optional fast check)**

If you have `nx serve examples-chat-angular` infra ready locally, run:

```bash
npx nx e2e examples-chat-angular -- examples/chat/angular/e2e/url-routing.spec.ts
```

Expected: all 4 tests pass in ~30-60s. If a test fails and the failure is about the toolbar selector (`.demo-shell__field[data-field="model"]`), grep the codebase for the actual selector — it may have drifted:

```bash
grep -rn 'data-field=' examples/chat/angular/src/ | head -5
```

If the selector differs, update the spec to match the codebase. Don't change the codebase to match the spec.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/e2e/url-routing.spec.ts
git commit -m "test(examples-chat): add url-routing e2e for knob query params

Four scenarios:
1. Deep-link /embed/<thread-id> loads the thread without resending.
2. /embed?model=gpt-5-nano sets the model picker via URL hydration.
3. Mode switch preserves both /embed/<id> path and ?model= query.
4. Ephemeral hydration: /embed?theme=material-dark does NOT write
   theme to localStorage (URL hydrates signal but not storage)."
```

---

### Task 5: Local Chrome MCP verification

**Files:**
- None modified; this is a verification gate, not a code task.

**Purpose:** Drive the running dev server with `mcp__Claude_in_Chrome__*` tools to catch regressions that pure-Playwright + aimock can miss (real localStorage write ordering, real router history stacks, real theme repaints).

- [ ] **Step 1: Boot the dev server in the background**

In a separate shell (or via `run_in_background: true` on a Bash call):

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx serve examples-chat-angular
```

Wait until the console reports `➜  Local:   http://localhost:4200/`. This may take 30-60s.

- [ ] **Step 2: Default URL stays clean**

Use `mcp__Claude_in_Chrome__navigate` to open `http://localhost:4200/embed`, then `mcp__Claude_in_Chrome__javascript_tool` to evaluate:

```js
window.location.search
```

Expected: `""` (empty). If a query string appears on a clean default load, `writeKnobsToUrl` is being called when it shouldn't be (e.g. on initial hydration).

- [ ] **Step 3: Knob change writes to URL; default drops the param**

Use `mcp__Claude_in_Chrome__find` to locate the Model dropdown, click it via `mcp__Claude_in_Chrome__left_click` (or whichever click tool is available), select `gpt-5-nano`.

Then `javascript_tool`:
```js
window.location.search
```
Expected: contains `model=gpt-5-nano`.

Then change back to `gpt-5-mini` (the default) and re-evaluate:
```js
window.location.search.includes('model=')
```
Expected: `false`.

- [ ] **Step 4: Deep-link sets the picker**

Navigate to `http://localhost:4200/embed?model=gpt-5-nano&theme=material-dark`.

`javascript_tool`:
```js
({
  model: document.querySelector('.demo-shell__field[data-field="model"] .chat-select__trigger')?.textContent?.trim(),
  theme: document.documentElement.getAttribute('data-theme'),
})
```
Expected: `{ model: 'gpt-5-nano', theme: 'material-dark' }`.

- [ ] **Step 5: Ephemeral hydration**

`javascript_tool`:
```js
localStorage.clear();
```

Navigate to `/embed?theme=material-dark`.

`javascript_tool`:
```js
const raw = localStorage.getItem('ngaf-chat-demo:palette');
raw ? JSON.parse(raw).theme : null
```
Expected: `null` (URL hydrated the signal but did NOT write to storage).

- [ ] **Step 6: User action persists**

With localStorage still clear, click the Theme dropdown in the toolbar and select `material-dark` via the UI.

`javascript_tool`:
```js
JSON.parse(localStorage.getItem('ngaf-chat-demo:palette')).theme
```
Expected: `"material-dark"`.

- [ ] **Step 7: Mode + knob preservation**

Send a message via the chat input to allocate a thread (or pick a known seeded one from a previous step). Capture the resulting URL — should look like `/embed/<id>?theme=material-dark`.

Click the Popup mode segmented control.

`javascript_tool`:
```js
window.location.pathname + window.location.search
```
Expected: `/popup/<same-id>?theme=material-dark`.

Then `mcp__Claude_in_Chrome__javascript_tool`:
```js
window.history.back()
```

Re-evaluate:
```js
window.location.pathname + window.location.search
```
Expected: `/embed/<same-id>?theme=material-dark`.

- [ ] **Step 8: Stop the dev server**

If launched in the background, stop it now (Ctrl-C in the launching terminal, or kill the background bash).

- [ ] **Step 9: Record verification outcome**

Add a brief note in the PR description after pushing (Task 6) summarizing the Chrome MCP verification:

```
## Chrome MCP verification (local, against `nx serve` + shared-dev LangGraph)

- ✅ Default URL stays clean (no spurious query params)
- ✅ Knob change writes URL; reset to default drops the param
- ✅ Deep-link sets the model picker + theme attribute
- ✅ URL hydration does NOT write to localStorage
- ✅ User UI action DOES persist to localStorage
- ✅ Mode switch preserves thread + knob, browser back restores
```

If any step fails, do NOT proceed to Task 6. Return to the failing implementation, fix it, re-run all relevant unit/e2e tests + Chrome MCP steps.

---

### Task 6: Push, open PR, monitor CI

**Files:**
- None modified.

- [ ] **Step 1: Push the branch**

Run: `git push -u origin claude/demo-url-knobs`

Expected: push succeeds, branch tracked.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(examples-chat): round-trip agent knobs through URL query params" --body "$(cat <<'EOF'
## Summary

Round-trips the demo's six agent knobs (model, effort, genui, theme, color, project) through the URL with ephemeral hydration semantics, on top of the URL-as-truth thread-id work already on main.

URL shape:
\`\`\`
/<mode>[/<thread-id>][?model=&effort=&genui=&theme=&color=&project=]
\`\`\`

Default values are omitted; non-default values appear; the URL is the share surface.

Builds on PR #500 + PR #504 + PR #518 — preserves UrlMatcher, getThread() validator, and URL-as-truth threadId semantics.

## Files changed

- \`examples/chat/angular/src/app/shell/demo-shell.component.ts\` — 3 new private methods (hydrateFromQuery, writeKnobsToUrl, buildQueryParams) + 6 knob handlers wired to writeKnobsToUrl + onModeChange/signal→URL effect both preserve query params.
- \`examples/chat/angular/src/app/shell/demo-shell.component.spec.ts\` — 7 new unit tests.
- \`examples/chat/angular/e2e/url-routing.spec.ts\` — NEW Playwright spec: 4 deep-link assertions.

## Test plan

- [x] Unit: 32/32 passing in \`examples-chat-angular\`
- [ ] e2e matrix: all 4 \`examples/chat — e2e (N/4)\` shards green
- [x] Chrome MCP verification: all 6 manual steps pass (see comment below for outcome)

Spec: \`docs/superpowers/specs/2026-05-21-demo-url-knobs-design.md\`
Plan: \`docs/superpowers/plans/2026-05-21-demo-url-knobs.md\`

Supersedes the now-closed PR #494, focused down to just the still-needed bits.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: a URL to the new PR is printed.

- [ ] **Step 3: Append the Chrome MCP verification note as a PR comment**

Use the verification outcome captured in Task 5 Step 9. Paste it as a comment on the PR via:

```bash
PR=$(gh pr view --json number --jq .number)
gh pr comment $PR --body "$(cat <<'EOF'
## Chrome MCP verification (local, against `nx serve` + shared-dev LangGraph)

- ✅ Default URL stays clean
- ✅ Knob change writes URL; reset to default drops the param
- ✅ Deep-link sets the model picker + theme attribute
- ✅ URL hydration does NOT write to localStorage
- ✅ User UI action DOES persist to localStorage
- ✅ Mode switch preserves thread + knob, browser back restores
EOF
)"
```

- [ ] **Step 4: Monitor the first CI run**

Wait ~1-2 minutes after push, then:

```bash
gh pr checks $(gh pr view --json number --jq .number)
```

Expected: all 4 \`examples/chat — e2e (N/4)\` shards run, plus \`examples/chat — e2e\` summary. If a shard fails, pull the failed test names:

```bash
RUN=$(gh run list --branch claude/demo-url-knobs --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $RUN --json jobs --jq '.jobs[] | select(.conclusion=="failure") | .name'
```

- [ ] **Step 5: Hand off to user for merge decision**

The plan ends here. The user decides when to admin-merge.

---

## Verification checklist (entire plan)

After all tasks, verify against `docs/superpowers/specs/2026-05-21-demo-url-knobs-design.md`:

- ✅ `hydrateFromQuery` reads 6 knobs from URL via `URL(router.url).searchParams`
- ✅ Hydration NEVER writes to localStorage (regression-tested)
- ✅ `buildQueryParams` maps defaults to null; non-defaults to current value
- ✅ `writeKnobsToUrl` uses `queryParamsHandling: 'merge'` + `replaceUrl: true`
- ✅ All 6 knob handlers call `writeKnobsToUrl` after `persistence.write`
- ✅ `onModeChange` uses `queryParamsHandling: 'preserve'`
- ✅ signal→URL thread-switch effect uses `queryParamsHandling: 'preserve'`
- ✅ `app.routes.ts` unchanged (UrlMatcher preserved)
- ✅ `getThread()` 404 validator unchanged
- ✅ `palette-persistence.service.ts` unchanged
- ✅ Unit tests: hydration, ephemeral, default-dropped, non-default-written, mode-preserves, thread-preserves, user-action-persists
- ✅ E2e tests: deep-link thread, deep-link knob, mode-switch preservation, ephemeral hydration
- ✅ Chrome MCP verification: 6 manual steps pass against live `nx serve`

If any item is unchecked, return to the task that owns it before requesting review.
