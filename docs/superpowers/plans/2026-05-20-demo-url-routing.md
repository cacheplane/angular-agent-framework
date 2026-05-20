# Demo URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shareable thing about the canonical demo round-trip through the URL — active thread id as a path segment, agent knobs (model, effort, genui, theme, color, project) as query params omitted at defaults — so visitors can share their session as a link.

**Architecture:** Add `:threadId` sibling routes for each mode. Hydrate signals from URL on every `NavigationEnd` (ephemeral — does NOT write localStorage). On user actions, both write localStorage AND navigate the router with `replaceUrl: true` for knobs and a push for thread/mode changes. Drop `threadId` from localStorage entirely.

**Tech Stack:** Angular 20 (standalone, signals), `@angular/router`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-20-demo-url-routing-design.md`

---

## File Structure

| File | Role |
|---|---|
| `examples/chat/angular/src/app/app.routes.ts` | Add 3 sibling `:threadId` routes |
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | URL hydration (`readUrlState`), URL writes (`buildQueryParams`, knob/mode/thread nav), drop `threadId` persistence |
| `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts` | Unit coverage for hydration + navigation + ephemeral semantics |
| `examples/chat/angular/e2e/url-routing.spec.ts` | New: Playwright deep-link smoke |

---

## Task 1: Add sibling `:threadId` routes

**Files:**
- Modify: `examples/chat/angular/src/app/app.routes.ts`

- [ ] **Step 1: Update routes**

Replace the 3 child routes with 6 sibling routes (each mode plus a `:threadId` variant), all loading the same mode component.

```ts
// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  {
    path: '',
    loadComponent: () =>
      import('./shell/demo-shell.component').then((m) => m.DemoShell),
    children: [
      {
        path: 'embed',
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        path: 'embed/:threadId',
        loadComponent: () =>
          import('./modes/embed-mode.component').then((m) => m.EmbedMode),
      },
      {
        path: 'popup',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'popup/:threadId',
        loadComponent: () =>
          import('./modes/popup-mode.component').then((m) => m.PopupMode),
      },
      {
        path: 'sidebar',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
      {
        path: 'sidebar/:threadId',
        loadComponent: () =>
          import('./modes/sidebar-mode.component').then((m) => m.SidebarMode),
      },
    ],
  },
  { path: '**', redirectTo: 'embed' },
];
```

- [ ] **Step 2: Smoke-test the build**

Run: `npx nx build chat-angular-example --skip-nx-cache=false` (or the project's standard build command).
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/app.routes.ts
git commit -m "feat(demo-routes): add :threadId sibling routes for each mode"
```

---

## Task 2: Make `threadIdSignal` URL-driven; drop its persistence

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write a failing test for URL → threadId hydration**

Append to `demo-shell.component.spec.ts`:

```ts
describe('DemoShell — threadId hydration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('hydrates threadIdSignal from /embed/:threadId', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/abc123');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { threadIdSignal: () => string | null };
    expect(cmp.threadIdSignal()).toBe('abc123');
  });

  it('leaves threadIdSignal null when route has no :threadId', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { threadIdSignal: () => string | null };
    expect(cmp.threadIdSignal()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat-angular-example -- --testNamePattern="threadId hydration"`
Expected: FAIL — hydration doesn't yet read from the route.

- [ ] **Step 3: Change `threadIdSignal` init**

In `demo-shell.component.ts`, replace:

```ts
protected readonly threadIdSignal = signal<string | null>(this.persistence.read('threadId') ?? null);
```

with:

```ts
protected readonly threadIdSignal = signal<string | null>(null);
```

- [ ] **Step 4: Add `readUrlState()` hydration**

In the constructor of `DemoShell`, add (after the existing effects):

```ts
this.readUrlState();
this.router.events
  .pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    takeUntilDestroyed(),
  )
  .subscribe(() => this.readUrlState());
```

Add the method on `DemoShell`:

```ts
private readUrlState(): void {
  let route = this.router.routerState.root;
  while (route.firstChild) route = route.firstChild;
  const threadId = route.snapshot.paramMap.get('threadId');
  this.threadIdSignal.set(threadId);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx nx test chat-angular-example -- --testNamePattern="threadId hydration"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo-shell): hydrate threadIdSignal from route param"
```

---

## Task 3: Route thread switches/creates through the router

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write a failing test for `onThreadSelected` navigating the URL**

Append:

```ts
describe('DemoShell — thread switch navigates URL', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('navigates to /embed/<id> when onThreadSelected fires', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as {
      onThreadSelected: (id: string) => void;
    };
    cmp.onThreadSelected('xyz');
    await fx.whenStable();
    expect(router.url).toBe('/embed/xyz');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test chat-angular-example -- --testNamePattern="thread switch navigates URL"`
Expected: FAIL — `onThreadSelected` still writes the signal directly, not the router.

- [ ] **Step 3: Update `onThreadSelected`, `onNewThread`, `threadActions`, and agent's `onThreadId` callback**

Replace the methods + actions in `demo-shell.component.ts`:

```ts
protected onThreadSelected(threadId: string): void {
  void this.router.navigate(['/' + this.mode(), threadId], { queryParamsHandling: 'preserve' });
}

protected async onNewThread(): Promise<void> {
  const sel = this.selectedProjectId();
  const id = await this.threadsSvc.create(sel ? { projectId: sel } : {});
  if (id) {
    void this.router.navigate(['/' + this.mode(), id], { queryParamsHandling: 'preserve' });
  }
}
```

Update `threadActions.delete` and `threadActions.archive` to clear via URL (no persistence write):

```ts
protected readonly threadActions: ThreadActionAdapter = {
  delete: async (id) => {
    await this.threadsSvc.delete(id);
    if (this.threadIdSignal() === id) {
      void this.router.navigate(['/' + this.mode()], { queryParamsHandling: 'preserve' });
    }
  },
  rename: (id, title) => this.threadsSvc.rename(id, title),
  archive: async (id) => {
    await this.threadsSvc.archive(id);
    if (this.threadIdSignal() === id) {
      void this.router.navigate(['/' + this.mode()], { queryParamsHandling: 'preserve' });
    }
  },
  unarchive: (id) => this.threadsSvc.unarchive(id),
  pin: (id) => this.threadsSvc.pin(id),
  unpin: (id) => this.threadsSvc.unpin(id),
  moveToProject: async (id, projectId) => {
    await this.threadsSvc.moveToProject(id, projectId);
  },
  reorderPinned: (id, beforeId) => this.threadsSvc.reorderPinned(id, beforeId),
};
```

Update the agent's `onThreadId` callback (remove the persistence write — `readUrlState()` will pick it up from the URL once the SDK callback triggers a navigation):

```ts
onThreadId: (id: string) => {
  void this.router.navigate(['/' + this.mode(), id], {
    queryParamsHandling: 'preserve',
    replaceUrl: true,
  });
},
```

Note: `replaceUrl: true` on the SDK-driven thread-id callback prevents an extra history entry when the backend allocates the id at submit time. The user's explicit thread-pick (`onThreadSelected`) still pushes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat-angular-example -- --testNamePattern="thread switch navigates URL"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo-shell): route thread switches/creates through the router"
```

---

## Task 4: Preserve thread + query params on mode change

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write a failing test**

Append:

```ts
describe('DemoShell — mode change preserves thread + query', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: 'popup', component: DemoShell },
          { path: 'popup/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('preserves :threadId and ?model when switching mode', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/abc?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { onModeChange: (m: string) => void };
    cmp.onModeChange('popup');
    await fx.whenStable();
    expect(router.url).toBe('/popup/abc?model=gpt-5-nano');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test chat-angular-example -- --testNamePattern="mode change preserves"`
Expected: FAIL — current `onModeChange` drops the thread id and query.

- [ ] **Step 3: Update `onModeChange`**

```ts
protected onModeChange(next: DemoMode | string): void {
  const id = this.threadIdSignal();
  const segments = id ? ['/' + next, id] : ['/' + next];
  void this.router.navigate(segments, { queryParamsHandling: 'preserve' });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx test chat-angular-example -- --testNamePattern="mode change preserves"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo-shell): preserve thread + query params on mode change"
```

---

## Task 5: Knob query-param writes via `buildQueryParams()`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write a failing test — non-default value lands in URL**

Append:

```ts
describe('DemoShell — knob URL writes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('writes ?model=gpt-5-nano when model changes off default', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { onModelChange: (m: string) => void };
    cmp.onModelChange('gpt-5-nano');
    await fx.whenStable();
    expect(router.url).toBe('/embed?model=gpt-5-nano');
  });

  it('omits ?model when changing back to the default', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { onModelChange: (m: string) => void };
    cmp.onModelChange('gpt-5-mini');
    await fx.whenStable();
    expect(router.url).toBe('/embed');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test chat-angular-example -- --testNamePattern="knob URL writes"`
Expected: FAIL — knob handlers don't yet navigate.

- [ ] **Step 3: Add a `DEFAULTS` table and `buildQueryParams()` helper**

Near the top of `demo-shell.component.ts`, add:

```ts
const KNOB_DEFAULTS = {
  model: 'gpt-5-mini',
  effort: 'minimal',
  genui: 'a2ui',
  theme: 'default-dark',
  color: 'dark',
  project: null as string | null,
} as const;
```

Add a method on `DemoShell`:

```ts
private buildQueryParams(overrides: Partial<Record<keyof typeof KNOB_DEFAULTS, string | null>> = {}):
  Record<string, string | null> {
  const current: Record<keyof typeof KNOB_DEFAULTS, string | null> = {
    model: this.model(),
    effort: this.effort(),
    genui: this.genUiMode(),
    theme: this.theme(),
    color: this.colorScheme(),
    project: this.selectedProjectId(),
  };
  const merged = { ...current, ...overrides };
  const params: Record<string, string | null> = {};
  for (const key of Object.keys(KNOB_DEFAULTS) as (keyof typeof KNOB_DEFAULTS)[]) {
    const value = merged[key];
    params[key] = value !== null && value !== KNOB_DEFAULTS[key] ? value : null;
  }
  return params;
}

private writeKnobsToUrl(overrides: Partial<Record<keyof typeof KNOB_DEFAULTS, string | null>> = {}): void {
  void this.router.navigate([], {
    queryParams: this.buildQueryParams(overrides),
    replaceUrl: true,
  });
}
```

- [ ] **Step 4: Wire each knob handler to also write the URL**

Append `this.writeKnobsToUrl({ <key>: next })` to each handler. Example:

```ts
onModelChange(next: string): void {
  this.model.set(next);
  this.persistence.write('model', next);
  this.writeKnobsToUrl({ model: next });
}

protected onEffortChange(next: string): void {
  this.effort.set(next);
  this.persistence.write('effort', next);
  this.writeKnobsToUrl({ effort: next });
}

protected onGenUiModeChange(next: string): void {
  this.genUiMode.set(next);
  this.persistence.write('genUiMode', next);
  this.writeKnobsToUrl({ genui: next });
}

protected onThemeChange(next: string): void {
  this.theme.set(next);
  this.persistence.write('theme', next);
  this.writeKnobsToUrl({ theme: next });
}

protected onColorSchemeChange(next: 'light' | 'dark' | string): void {
  if (next !== 'light' && next !== 'dark') return;
  this.colorScheme.set(next);
  this.persistence.write('colorScheme', next);
  this.writeKnobsToUrl({ color: next });
}

protected onProjectSelected(projectId: string): void {
  this.selectedProjectId.set(projectId);
  this.persistence.write('selectedProjectId', projectId);
  this.writeKnobsToUrl({ project: projectId });
}
```

(Note: the auto-sync inside the color-scheme effect that sets `this.theme.set(next)` should also push the URL change. After setting + persisting, add `this.writeKnobsToUrl({ theme: next });` inside that effect branch.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx nx test chat-angular-example -- --testNamePattern="knob URL writes"`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo-shell): write knob state to URL (defaults omitted)"
```

---

## Task 6: Hydrate knob signals from URL on `NavigationEnd`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Test: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write a failing test for knob hydration**

Append:

```ts
describe('DemoShell — knob hydration from URL', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
      ],
    });
  });

  it('hydrates model + effort from query params on mount', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed?model=gpt-5-nano&effort=high');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as {
      model: () => string;
      effort: () => string;
    };
    expect(cmp.model()).toBe('gpt-5-nano');
    expect(cmp.effort()).toBe('high');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test chat-angular-example -- --testNamePattern="knob hydration"`
Expected: FAIL — `readUrlState()` doesn't yet touch knob signals.

- [ ] **Step 3: Extend `readUrlState()`**

```ts
private readUrlState(): void {
  let route = this.router.routerState.root;
  while (route.firstChild) route = route.firstChild;
  const threadId = route.snapshot.paramMap.get('threadId');
  this.threadIdSignal.set(threadId);

  const q = route.snapshot.queryParamMap;
  const model = q.get('model');
  if (model !== null) this.model.set(model);
  const effort = q.get('effort');
  if (effort !== null) this.effort.set(effort);
  const genui = q.get('genui');
  if (genui !== null) this.genUiMode.set(genui);
  const theme = q.get('theme');
  if (theme !== null) this.theme.set(theme);
  const color = q.get('color');
  if (color === 'light' || color === 'dark') this.colorScheme.set(color);
  const project = q.get('project');
  if (project !== null) this.selectedProjectId.set(project);
}
```

**Do NOT call `this.persistence.write(...)` here.** Hydration is ephemeral by design.

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx test chat-angular-example -- --testNamePattern="knob hydration"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "feat(demo-shell): hydrate knob signals from query params"
```

---

## Task 7: Lock down ephemeral semantics

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.spec.ts`

- [ ] **Step 1: Write tests asserting URL hydration does NOT write localStorage**

Append:

```ts
import { PalettePersistence } from './palette-persistence.service';

describe('DemoShell — ephemeral hydration', () => {
  let writes: Array<[string, unknown]>;

  beforeEach(() => {
    writes = [];
    const fake = {
      read: (_key: string) => null,
      write: (key: string, value: unknown) => { writes.push([key, value]); },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'embed', component: DemoShell },
          { path: 'embed/:threadId', component: DemoShell },
          { path: '', pathMatch: 'full', redirectTo: 'embed' },
          { path: '**', redirectTo: 'embed' },
        ]),
        { provide: PalettePersistence, useValue: fake },
      ],
    });
  });

  it('does NOT write to persistence when knobs hydrate from URL', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed/abc?model=gpt-5-nano&theme=material-dark');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    expect(writes.find(([k]) => k === 'model')).toBeUndefined();
    expect(writes.find(([k]) => k === 'theme')).toBeUndefined();
    expect(writes.find(([k]) => k === 'threadId')).toBeUndefined();
  });

  it('DOES write to persistence on explicit user action', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/embed');
    const fx = TestBed.createComponent(DemoShell);
    fx.detectChanges();
    const cmp = fx.componentInstance as unknown as { onThemeChange: (t: string) => void };
    cmp.onThemeChange('material-dark');
    expect(writes.find(([k, v]) => k === 'theme' && v === 'material-dark')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx nx test chat-angular-example -- --testNamePattern="ephemeral hydration"`
Expected: PASS (the implementation from Tasks 2 + 6 already enforces this — these tests pin the contract).

- [ ] **Step 3: Audit for stray `persistence.write('threadId', ...)` calls**

Run: `git grep -n "persistence.write\\('threadId'" examples/chat/angular/`
Expected: zero matches. If any remain, remove them.

Also run: `git grep -n "persistence.read\\('threadId'" examples/chat/angular/`
Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.spec.ts
git commit -m "test(demo-shell): pin ephemeral URL → signal hydration contract"
```

---

## Task 8: E2E deep-link smoke

**Files:**
- Create: `examples/chat/angular/e2e/url-routing.spec.ts`

- [ ] **Step 1: Check existing e2e setup**

Run: `ls examples/chat/angular/e2e/`
Expected: One or more existing `.spec.ts` files — pattern-match the import + base-URL setup from one of them.

- [ ] **Step 2: Write the deep-link spec**

Create `examples/chat/angular/e2e/url-routing.spec.ts` (adapt imports to match the existing e2e harness):

```ts
import { test, expect } from '@playwright/test';

test('deep link /embed?model=gpt-5-nano selects gpt-5-nano in the model picker', async ({ page }) => {
  await page.goto('/embed?model=gpt-5-nano');
  const modelField = page.locator('[data-field="model"]');
  await expect(modelField).toContainText('gpt-5-nano');
});

test('switching mode preserves :threadId and ?model', async ({ page }) => {
  await page.goto('/embed?model=gpt-5-nano');
  // Click the "Popup" segmented button.
  await page.getByRole('button', { name: 'Popup' }).click();
  await expect(page).toHaveURL(/\/popup(\/[^?]+)?\?model=gpt-5-nano/);
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npx nx e2e chat-angular-example` (or the project's standard e2e command).
Expected: PASS — both specs.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/e2e/url-routing.spec.ts
git commit -m "test(demo-e2e): deep-link + mode-switch URL preservation"
```

---

## Task 9: Manual verification + cleanup

- [ ] **Step 1: Start the dev server**

Run: `npx nx serve chat-angular-example`

- [ ] **Step 2: Smoke-test the full matrix in the browser**

For each, watch the URL and visible state:
1. Visit `/embed` → URL stays bare; defaults visible.
2. Pick `gpt-5-nano` from the model dropdown → URL becomes `/embed?model=gpt-5-nano`.
3. Pick `gpt-5-mini` (default) again → URL drops `?model=`.
4. Send a message → URL becomes `/embed/<id>?model=...` (push, not replace).
5. Click the "Popup" segmented button → URL becomes `/popup/<id>?model=...`.
6. Open in a fresh incognito tab and paste `/embed/<id>?theme=material-dark&color=light` → loads that thread + theme without writing localStorage. Refresh and confirm localStorage still has the visitor's prior theme (or no theme), NOT the shared one.
7. Use browser back/forward → state round-trips.

- [ ] **Step 3: Final build + lint**

Run: `npx nx lint chat-angular-example && npx nx test chat-angular-example && npx nx build chat-angular-example`
Expected: All green.

- [ ] **Step 4: Open a PR**

```bash
gh pr create --title "feat(demo): URL routing for shareable demo state" --body "$(cat <<'EOF'
## Summary
- Thread id moves to a `:threadId` path segment per mode; knobs round-trip via query params (defaults omitted).
- URL hydration is ephemeral — overrides signals on visit but does NOT write to a recipient's localStorage.
- Drops `threadId` from localStorage entirely.

Spec: `docs/superpowers/specs/2026-05-20-demo-url-routing-design.md`

## Test plan
- [ ] Unit tests pass (`nx test chat-angular-example`)
- [ ] E2E deep-link + mode-switch passes (`nx e2e chat-angular-example`)
- [ ] Manual: copy `/embed/<id>?theme=material-dark` to incognito tab → loads correctly, localStorage untouched
- [ ] Manual: switch mode preserves thread + knobs
- [ ] Manual: change knob to default → param drops from URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
