# examples/ag-ui Canonical Toolbar Parity — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AG-UI example's static header with the canonical demo toolbar (Embed/Popup/Sidebar modes, Model/Effort/Gen-UI/Theme selects, dark/light toggle, URL+localStorage persistence), powered by a new `input.state` forwarding feature in the `@threadplane/ag-ui` adapter.

**Architecture:** One small adapter feature (`submit()` forwards `AgentSubmitInput.state` onto the AG-UI run input) + a fresh ~300-line `AgUiShell` component in the example that reuses the canonical toolbar markup/CSS and provides the agent via an injection token to verbatim-copied mode components. Examples stay standalone — copy, never import across examples.

**Tech Stack:** Angular 20 (signals, standalone components, router), `@threadplane/chat` (ChatComponent/ChatPopup/ChatSidebar, ChatSelect, ChatInterruptPanel), `@threadplane/ag-ui`, Playwright + aimock e2e, vitest (`nx test ag-ui`).

**Reference spec:** `docs/superpowers/specs/2026-06-11-ag-ui-demo-toolbar-design.md` (Phase 1 of the campaign; the capability audit is Phase 2, executed after this plan's PR merges).

**Working dir:** worktree `.claude/worktrees/ag-ui-demo-toolbar` (branch `worktree-ag-ui-demo-toolbar`).

**Verification gates:** `npx nx lint ag-ui && npx nx test ag-ui` for the adapter; `npx nx lint examples-ag-ui-angular && npx nx build examples-ag-ui-angular` for the example (generate the license key first if builds fail on `license-public-key.generated`: `node libs/licensing/scripts/generate-public-key.mjs`); `npx nx e2e examples-ag-ui-angular --skip-nx-cache` for e2e (kill stale :8000/:4201 listeners first; use `NX_DAEMON=false` if "another nx process" appears). Commit after each task.

---

## Task 1: Spike — confirm `RunAgentInput.state` reaches the graph

No code changes. Determines whether Task 2's mechanism works end-to-end.

- [ ] **Step 1: Start the real backend**

```bash
cd examples/ag-ui/python
OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' ../../../.env | cut -d= -f2- | tr -d '"') \
  uv run uvicorn src.server:app --port 8000 &
sleep 5 && curl -s http://localhost:8000/ok   # {"ok":true}
```

- [ ] **Step 2: Send a run whose `state` flips the gen-UI tool**

The graph picks `render_a2ui_surface` when `state.gen_ui_mode` is `a2ui` (default) and `generate_json_render_spec` when it is `json-render`. Send the same prompt with `state: {"gen_ui_mode": "json-render"}`:

```bash
curl -sN -X POST http://localhost:8000/agent -H 'Content-Type: application/json' -d '{
  "threadId": "spike-1", "runId": "spike-run-1",
  "state": {"gen_ui_mode": "json-render"},
  "messages": [{"id": "u1", "role": "user", "content": "Build me an interactive feedback form with a name field and a Submit button."}],
  "tools": [], "context": [], "forwardedProps": {}
}' | grep -o 'generate_json_render_spec\|render_a2ui_surface' | sort -u
```

Expected: `generate_json_render_spec` appears (state honored). If instead `render_a2ui_surface` appears, client state is NOT applied → **fallback**: in Task 2 ALSO send the patch as `forwardedProps.state`, and add a server-side merge in `examples/ag-ui/python/src/server.py` (read `forwarded_props["state"]` and merge into the run input). Record the outcome in the commit message of Task 2.

- [ ] **Step 3: Stop the backend** (`kill %1` or kill the :8000 listener).

---

## Task 2: Adapter — forward `input.state` (`libs/ag-ui`)

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts` (the `submit` implementation)
- Test: `libs/ag-ui/src/lib/to-agent.spec.ts` (add cases beside existing ones; match the existing mock-source pattern in that file)

- [ ] **Step 1: Add a state-merge helper + call it on both submit paths**

In `to-agent.ts`, inside `toAgent(...)` (above the returned object), add:

```ts
  /** Forward a neutral-contract state patch onto the AG-UI run input.
   *  Mirrors the canonical demo's `input.state` mechanism: the patch is
   *  merged into the source agent's client state (carried on
   *  RunAgentInput.state) and reflected optimistically in the local
   *  state signal — the server's next STATE_SNAPSHOT stays authoritative. */
  const applyStatePatch = (patch: Record<string, unknown> | undefined): void => {
    if (!patch || Object.keys(patch).length === 0) return;
    source.state = { ...((source.state as Record<string, unknown>) ?? {}), ...patch };
    store.state.update((prev) => ({ ...prev, ...patch }));
  };
```

In `submit`, FIRST line of the resume branch (before `store.interrupt.set(undefined)`), add `applyStatePatch(input.state);`. In the normal path, add `applyStatePatch(input.state);` immediately before the optimistic user-message append. (If Task 1 chose the fallback, additionally include `...(input.state ? { state: input.state } : {})` inside the `forwardedProps` object on both `runAgent` calls, and implement the `server.py` merge.)

- [ ] **Step 2: Add unit tests**

In `to-agent.spec.ts`, following the file's existing mock-source conventions, add a `describe('input.state forwarding', ...)` with four cases:

```ts
it('merges input.state into the source agent state before running', async () => {
  // arrange mock source with state = { a: 1 }
  await agent.submit({ message: 'hi', state: { gen_ui_mode: 'json-render' } });
  expect(source.state).toEqual({ a: 1, gen_ui_mode: 'json-render' });
});

it('reflects the patch in the local state() signal optimistically', async () => {
  await agent.submit({ message: 'hi', state: { model: 'gpt-5-nano' } });
  expect(agent.state()['model']).toBe('gpt-5-nano');
});

it('forwards state on the resume path too', async () => {
  // arrange an active interrupt on the store first (per existing interrupt tests)
  await agent.submit({ resume: 'approved', state: { reasoning_effort: 'high' } });
  expect(source.state).toMatchObject({ reasoning_effort: 'high' });
});

it('leaves source state untouched when input.state is absent', async () => {
  await agent.submit({ message: 'hi' });
  expect(source.state).toEqual({ a: 1 });
});
```

Adapt arrangement code to the spec file's existing helpers — assertions stay as written.

- [ ] **Step 3: Verify**

Run: `npx nx lint ag-ui && npx nx test ag-ui --skip-nx-cache`
Expected: PASS (new tests green, existing green).

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts
git commit -m "feat(ag-ui): submit() forwards input.state onto the run input"
```

---

## Task 3: Example scaffold — token, persistence, routes, modes

**Files:**
- Create: `examples/ag-ui/angular/src/app/shell/palette-persistence.service.ts`
- Create: `examples/ag-ui/angular/src/app/app.routes.ts`
- Create (copies): `examples/ag-ui/angular/src/app/modes/{embed-mode,popup-mode,sidebar-mode,welcome-suggestions}.component.ts`, `examples/ag-ui/angular/src/app/modes/welcome-suggestions.ts`
- Modify: `examples/ag-ui/angular/src/app/app.config.ts` (add router)

**Agent-sharing decision (differs from canonical):** the canonical demo hands modes the agent via a `DEMO_AGENT` injection token. This example skips the token — mode components read the shell's wrapped agent directly via `inject(AgUiShell).agent` (the routed components live inside the shell's injector, and `AgUiShell` is the component class, injectable like any ancestor). No `shell-tokens.ts` is created.

- [ ] **Step 1: palette-persistence.service.ts**

Copy `examples/chat/angular/src/app/shell/palette-persistence.service.ts` verbatim, then: change the storage key to `'threadplane-ag-ui-demo:palette'` and trim the `PaletteState` interface to exactly:

```ts
interface PaletteState {
  model: string;
  effort: string;
  genUiMode: string;
  theme: string;
  colorScheme: string;
}
```

(Delete thread/project/sidenav keys; keep the class/read/write logic unchanged.)

- [ ] **Step 3: app.routes.ts**

```ts
// SPDX-License-Identifier: MIT
import { Routes } from '@angular/router';
import { EmbedMode } from './modes/embed-mode.component';
import { PopupMode } from './modes/popup-mode.component';
import { SidebarMode } from './modes/sidebar-mode.component';

export const routes: Routes = [
  { path: 'embed', component: EmbedMode },
  { path: 'popup', component: PopupMode },
  { path: 'sidebar', component: SidebarMode },
  { path: '', pathMatch: 'full', redirectTo: 'embed' },
  { path: '**', redirectTo: 'embed' },
];
```

(No thread-id URL matcher — this example has no threads.)

- [ ] **Step 4: copy mode components + suggestions**

```bash
cp examples/chat/angular/src/app/modes/embed-mode.component.ts \
   examples/chat/angular/src/app/modes/popup-mode.component.ts \
   examples/chat/angular/src/app/modes/sidebar-mode.component.ts \
   examples/chat/angular/src/app/modes/welcome-suggestions.component.ts \
   examples/chat/angular/src/app/modes/welcome-suggestions.ts \
   examples/ag-ui/angular/src/app/modes/
```

Then in each of the three mode components apply exactly these edits:
- `import { DemoShell } from '../shell/demo-shell.component';` → `import { AgUiShell } from '../shell/ag-ui-shell.component';`
- Remove the `DEMO_AGENT` import (`../shell/shell-tokens`).
- `inject(DemoShell)` → `inject(AgUiShell)` (field stays named `shell`).
- `protected readonly agent = inject(DEMO_AGENT);` → `protected readonly agent = inject(AgUiShell).agent;`
- Any `[selectedModel]`/`[modelOptions]`/`(selectedModelChange)` bindings remain — `AgUiShell` exposes the same members (Task 4).
- If a mode component references threads/popup launcher props that don't exist over AG-UI, leave the chat-composition bindings that compile and delete only bindings referencing shell members Task 4 doesn't define (`currentThreadTitle`, thread handlers). Report any such deletion in the task summary.

`welcome-suggestions.component.ts` / `welcome-suggestions.ts` need no edits (they only emit prompt strings).

- [ ] **Step 5: app.config.ts — add the router**

Add to the providers in `examples/ag-ui/angular/src/app/app.config.ts`:

```ts
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
// in providers array:
provideRouter(routes),
```

(Keep the existing `provideAgent({...})` and other providers unchanged.)

- [ ] **Step 6: Verify compile** (the app still renders the OLD header until Task 4 swaps it; modes aren't routed-to yet from the template, so build only):

Run: `npx nx lint examples-ag-ui-angular`
Expected: PASS apart from temporarily-unused imports — if lint flags unused, it is acceptable to wire Task 4 first and lint then; in that case note it and defer this step's lint to Task 4 Step 5.

- [ ] **Step 7: Commit**

```bash
git add examples/ag-ui/angular/src/app
git commit -m "feat(examples/ag-ui): scaffold router, modes, suggestions, persistence"
```

---

## Task 4: `AgUiShell` — toolbar, submit wrapper, persistence, theme

**Files:**
- Create: `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.ts`
- Create: `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.html`
- Create (copy): `examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.css`
- Modify: `examples/ag-ui/angular/src/app/app.ts`, `app.html`

- [ ] **Step 1: CSS**

Copy `examples/chat/angular/src/app/shell/demo-shell.component.css` to `ag-ui-shell.component.css` unchanged, then rename the root class prefix `demo-shell` → `ag-ui-shell` throughout (`sed -i '' 's/demo-shell/ag-ui-shell/g'`). Unused sidenav/palette selectors are harmless; do not hand-prune.

- [ ] **Step 2: Template (`ag-ui-shell.component.html`)**

```html
<div class="ag-ui-shell">
  <div class="ag-ui-shell__toolbar" role="toolbar" aria-label="Demo controls">
    <div class="ag-ui-shell__segmented" aria-label="Mode">
      @for (option of modeOptions; track option.value) {
        <button
          type="button"
          class="ag-ui-shell__segmented-button"
          [class.is-active]="mode() === option.value"
          [attr.aria-pressed]="mode() === option.value"
          (click)="onModeChange(option.value)"
        >{{ option.label }}</button>
      }
    </div>

    <div class="ag-ui-shell__field ag-ui-shell__field--first" data-field="model">
      <chat-select [options]="modelOptions()" [value]="model()" menuLabel="Model" (valueChange)="onModelChange($event)" />
    </div>
    <div class="ag-ui-shell__field" data-field="effort">
      <chat-select [options]="effortOptions()" [value]="effort()" menuLabel="Effort" (valueChange)="onEffortChange($event)" />
    </div>
    <div class="ag-ui-shell__field" data-field="genui">
      <chat-select [options]="genUiOptions()" [value]="genUiMode()" menuLabel="Gen UI" (valueChange)="onGenUiModeChange($event)" />
    </div>
    <div class="ag-ui-shell__field" data-field="theme">
      <chat-select [options]="themeOptions()" [value]="theme()" menuLabel="Theme" (valueChange)="onThemeChange($event)" />
    </div>

    <button
      type="button"
      class="ag-ui-shell__theme-toggle ag-ui-shell__theme-toggle--toolbar"
      [attr.aria-label]="colorScheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      (click)="onColorSchemeChange(colorScheme() === 'dark' ? 'light' : 'dark')"
    >
      @if (colorScheme() === 'dark') {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      } @else {
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  </div>

  <div class="ag-ui-shell__main">
    <router-outlet />
    @if (agent.interrupt && agent.interrupt()) {
      <div class="ag-ui-shell__interrupt-panel" role="region" aria-label="Approval required">
        <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
      </div>
    }
  </div>
</div>
```

Add a small rule to the CSS for the relocated toggle (append at end of file):

```css
.ag-ui-shell__theme-toggle--toolbar { margin-left: auto; }
```

- [ ] **Step 3: Component (`ag-ui-shell.component.ts`) — full code**

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { injectAgent } from '@threadplane/ag-ui';
import {
  ChatInterruptPanelComponent,
  ChatSelectComponent,
  type InterruptAction,
} from '@threadplane/chat';
import { PalettePersistence } from './palette-persistence.service';

export type DemoMode = 'embed' | 'popup' | 'sidebar';
const MODES: readonly DemoMode[] = ['embed', 'popup', 'sidebar'] as const;

/** Default knob values — omitted from the URL when active. */
const DEFAULTS = {
  model: 'gpt-5-mini',
  effort: 'minimal',
  genui: 'a2ui',
  theme: 'default-dark',
  scheme: 'dark',
} as const;

@Component({
  selector: 'ag-ui-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ChatSelectComponent, ChatInterruptPanelComponent],
  templateUrl: './ag-ui-shell.component.html',
  styleUrl: './ag-ui-shell.component.css',
  providers: [PalettePersistence],
})
export class AgUiShell {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  protected readonly persistence = inject(PalettePersistence);

  // ── Knob signals: URL > localStorage > default ───────────────────────────
  private urlKnob(name: string): string | null {
    const v = this.route.snapshot.queryParamMap.get(name);
    return v && v.length > 0 ? v : null;
  }

  readonly model = signal<string>(this.urlKnob('model') ?? this.persistence.read('model') ?? DEFAULTS.model);
  readonly effort = signal<string>(this.urlKnob('effort') ?? this.persistence.read('effort') ?? DEFAULTS.effort);
  readonly genUiMode = signal<string>(this.urlKnob('genui') ?? this.persistence.read('genUiMode') ?? DEFAULTS.genui);
  readonly theme = signal<string>(this.urlKnob('theme') ?? this.persistence.read('theme') ?? DEFAULTS.theme);
  readonly colorScheme = signal<'light' | 'dark'>(
    ((this.urlKnob('scheme') ?? this.persistence.read('colorScheme')) as 'light' | 'dark' | null) ?? DEFAULTS.scheme,
  );

  // ── Mode from the active route ───────────────────────────────────────────
  readonly mode = signal<DemoMode>(this.parseMode(this.router.url));
  protected readonly modeOptions: readonly { value: DemoMode; label: string }[] = [
    { value: 'embed', label: 'Embed' },
    { value: 'popup', label: 'Popup' },
    { value: 'sidebar', label: 'Sidebar' },
  ];

  private parseMode(url: string): DemoMode {
    const seg = url.split('?')[0].split('/').filter(Boolean)[0];
    return (MODES as readonly string[]).includes(seg) ? (seg as DemoMode) : 'embed';
  }

  // ── Select options (canonical lists) ─────────────────────────────────────
  protected readonly modelOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'gpt-5-nano', label: 'gpt-5-nano' },
  ]);
  protected readonly effortOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'minimal', label: 'minimal (fast)' },
    { value: 'low', label: 'low' },
    { value: 'medium', label: 'medium' },
    { value: 'high', label: 'high (visible reasoning)' },
  ]);
  protected readonly genUiOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'a2ui', label: 'A2UI' },
    { value: 'json-render', label: 'json-render' },
  ]);
  protected readonly themeOptions = signal<readonly { value: string; label: string }[]>([
    { value: 'default-dark', label: 'Default dark' },
    { value: 'default-light', label: 'Default light' },
    { value: 'material-dark', label: 'Material dark' },
    { value: 'material-light', label: 'Material light' },
  ]);

  // ── Shared agent: submit wrapper merges the knobs into input.state ──────
  readonly agent = (() => {
    const a = injectAgent();
    const orig = a.submit.bind(a);
    (a as { submit: typeof a.submit }).submit = (async (
      input: Parameters<typeof a.submit>[0],
      opts?: Parameters<typeof a.submit>[1],
    ) => {
      return orig(
        {
          ...(input ?? {}),
          state: {
            ...((input as { state?: Record<string, unknown> })?.state ?? {}),
            model: this.model(),
            reasoning_effort: this.effort(),
            gen_ui_mode: this.genUiMode(),
          },
        },
        opts,
      );
    }) as typeof a.submit;
    return a;
  })();

  constructor() {
    // Routed mode components read the shared wrapped agent via
    // `inject(AgUiShell).agent` — no token needed (see Task 3 note).
    // Keep mode() in sync with navigation.
    this.router.events.subscribe(() => {
      const m = this.parseMode(this.router.url);
      if (m !== this.mode()) this.mode.set(m);
    });

    // Reflect theme + scheme onto <html> exactly like the canonical shell.
    effect(() => {
      const html = this.document.documentElement;
      html.setAttribute('data-theme', this.theme());
      const scheme = this.colorScheme();
      html.setAttribute('data-threadplane-chat-theme', scheme);
      const t = this.theme();
      if (t === 'default-dark' || t === 'default-light') {
        const next = scheme === 'light' ? 'default-light' : 'default-dark';
        if (next !== t) this.theme.set(next);
      }
    });

    // Persist + sync knobs to the URL (defaults omitted).
    effect(() => {
      const q: Record<string, string | null> = {
        model: this.model() === DEFAULTS.model ? null : this.model(),
        effort: this.effort() === DEFAULTS.effort ? null : this.effort(),
        genui: this.genUiMode() === DEFAULTS.genui ? null : this.genUiMode(),
        theme: this.theme() === DEFAULTS.theme ? null : this.theme(),
        scheme: this.colorScheme() === DEFAULTS.scheme ? null : this.colorScheme(),
      };
      void this.router.navigate([], { queryParams: q, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  protected onModeChange(next: DemoMode | string): void {
    if (!(MODES as readonly string[]).includes(next as string)) return;
    void this.router.navigate(['/', next], { queryParamsHandling: 'preserve' });
  }
  protected onModelChange(v: string): void { this.model.set(v); this.persistence.write('model', v); }
  protected onEffortChange(v: string): void { this.effort.set(v); this.persistence.write('effort', v); }
  protected onGenUiModeChange(v: string): void { this.genUiMode.set(v); this.persistence.write('genUiMode', v); }
  protected onThemeChange(v: string): void { this.theme.set(v); this.persistence.write('theme', v); }
  protected onColorSchemeChange(v: 'light' | 'dark' | string): void {
    if (v !== 'light' && v !== 'dark') return;
    this.colorScheme.set(v);
    this.persistence.write('colorScheme', v);
  }

  /** Same four-action vocabulary as the canonical shell; resumes via
   *  AG-UI's submit({ resume }) path (forwardedProps.command.resume). */
  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const interrupt = this.agent.interrupt?.();
    if (!interrupt) return;
    let resume: unknown;
    switch (action) {
      case 'accept': resume = 'approved'; break;
      case 'edit': {
        const reason = (interrupt.value as { reason?: string })?.reason ?? '';
        const edited = window.prompt(`Edit your response (current proposal: "${reason}"):`, 'approved');
        if (edited == null) return;
        resume = edited; break;
      }
      case 'respond': {
        const text = window.prompt('Respond to the agent:', '');
        if (text == null) return;
        resume = text; break;
      }
      case 'ignore': resume = 'denied'; break;
    }
    await this.agent.submit({ resume });
  }
}
```

- [ ] **Step 4: Host the shell**

`app.html` becomes:

```html
<ag-ui-shell />
```

`app.ts` becomes:

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgUiShell } from './shell/ag-ui-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgUiShell],
  templateUrl: './app.html',
})
export class App {}
```

(The old header, interrupt block, and `onInterruptAction` move into the shell; `styles.css`'s `.ag-ui-demo__*` rules can stay — they're inert — but delete the `.ag-ui-demo__interrupt` rule if it conflicts.)

- [ ] **Step 5: Verify**

Run: `npx nx lint examples-ag-ui-angular && npx nx build examples-ag-ui-angular --skip-nx-cache`
Expected: PASS. Then serve locally (backend + `nx serve examples-ag-ui-angular --port 4201`) and confirm: toolbar renders; mode buttons navigate; selects change + persist across reload; URL knobs appear for non-defaults; dark/light toggles; sending still streams.

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular/src
git commit -m "feat(examples/ag-ui): canonical demo toolbar (modes, knobs, theme) via AgUiShell"
```

---

## Task 5: E2E — keep 10 green, add 3 toolbar specs

**Files:**
- Create: `examples/ag-ui/angular/e2e/toolbar.spec.ts`
- Existing specs must pass unchanged (the `/`→`/embed` redirect preserves `openDemo(page, '/')`).

- [ ] **Step 1: Write `toolbar.spec.ts`**

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { openDemo } from './test-helpers';

test('modes: segmented control switches embed → popup → sidebar compositions', async ({ page }) => {
  await openDemo(page);
  await expect(page).toHaveURL(/\/embed/);

  await page.getByRole('button', { name: 'Popup' }).click();
  await expect(page).toHaveURL(/\/popup/);

  await page.getByRole('button', { name: 'Sidebar' }).click();
  await expect(page).toHaveURL(/\/sidebar/);

  await page.getByRole('button', { name: 'Embed' }).click();
  await expect(page).toHaveURL(/\/embed/);
  await expect(page.getByRole('textbox', { name: /message|prompt/i })).toBeVisible();
});

test('knobs: effort select reflects ?effort=high and persists a change', async ({ page }) => {
  await openDemo(page, '/embed?effort=high');
  const effortField = page.locator('[data-field="effort"]');
  await expect(effortField).toContainText(/high/i);
});

test('toolbar submit still streams (state merge does not break runs)', async ({ page }) => {
  await openDemo(page);
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('hi');
  await page.getByRole('button', { name: /send/i }).click();
  const assistant = page.locator('chat-message').filter({ hasText: /./ }).last();
  await expect(assistant).toBeVisible({ timeout: 30_000 });
});
```

Adjust locators to match the actual DOM if `chat-select`'s trigger renders differently (use the pattern from `examples/chat`'s `toolbarSelect()` helper in its `test-helpers.ts` if needed — copy that helper into this example's `test-helpers.ts` rather than importing across examples).

- [ ] **Step 2: Run the suite**

Clean stale listeners first, then:

```bash
NX_DAEMON=false npx nx e2e examples-ag-ui-angular --skip-nx-cache
```

Expected: 13/13 (10 existing + 3 new). The aimock fixture replay is prompt-matched, so the added `state` keys must not break matching — if a fixture mismatch appears, check whether aimock matches on messages only (expected) and report otherwise.

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/angular/e2e
git commit -m "test(examples/ag-ui): toolbar e2e — modes, URL knobs, state-merge smoke"
```

---

## Task 6: Local verification + PR

- [ ] **Step 1: Full local gates**

```bash
npx nx lint ag-ui && npx nx test ag-ui --skip-nx-cache
npx nx lint examples-ag-ui-angular && npx nx build examples-ag-ui-angular --skip-nx-cache
NX_DAEMON=false npx nx e2e examples-ag-ui-angular --skip-nx-cache
```

All green.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin worktree-ag-ui-demo-toolbar
gh pr create --base main --title "feat(examples/ag-ui): canonical demo toolbar parity (modes + knobs over input.state)" --body "<summary: adapter input.state forwarding (+4 unit tests); AgUiShell toolbar (modes/model/effort/genui/theme + dark-light + URL/localStorage persistence); 13/13 e2e. Phase 1 of the toolbar-parity + AG-UI capability-audit campaign (spec 2026-06-11). Phase 2 (Chrome MCP capability audit) follows merge.>"
```

Auto-merge on green (`gh pr merge --auto --squash`; if GraphQL 401s, use the REST endpoint). Post-merge, confirm the `examples/ag-ui — e2e` and `ag-ui demo → Vercel` CI jobs are green.

**Phase 2 (not in this plan):** Chrome MCP capability audit per the spec's Part-4 matrix against local servers, findings report committed, gap-closure phases planned with the user.

---

## Final self-check against the spec
- Adapter `input.state` on both paths + optimistic local state ✓ (Task 2)
- Spike with explicit fallback path ✓ (Task 1)
- Toolbar: modes, 4 selects, dark/light in toolbar ✓ (Task 4)
- Routing with `/`→`/embed` ✓ (Task 3)
- Welcome suggestions ported ✓ (Task 3)
- Persistence URL > stored > default; defaults omitted from URL ✓ (Task 4)
- Trimmed: sidenav/palette/projects/subagents/debug ✓ (absent by construction)
- E2E: 10 green + 3 new ✓ (Task 5)
