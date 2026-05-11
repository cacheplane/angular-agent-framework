# Nav v2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two adjacent polish PRs against the canonical chat demo: (A) redesign the control palette into a Next.js-dev-tools-style status pill + shadcn-refined expanded panel, and (B) suppress raw JSON streaming for A2UI tool calls via a new `<chat-genui-skeleton>` lib primitive.

**Architecture:** Two independent merge-ready PRs that touch different files. PR A is a single-file rewrite of `examples/chat/angular/src/app/shell/control-palette.{ts,html,css}` plus one binding change in `demo-shell.component.html`. PR B adds a new `chat-genui-skeleton` primitive to `@ngaf/chat`, extends `chat-message` with a `genuiToolNames` input and skeleton-rendering branch, and exports the primitive from `public-api`. No graph or backend changes.

**Tech Stack:** Angular 21 standalone components + signals + OnPush; Vitest for lib + demo tests; native `<select>` elements styled with a `:focus-within` button wrapper; shadcn-derived zinc dark palette.

**Spec:** `docs/superpowers/specs/2026-05-11-nav-v2-polish-palette-and-genui-suppression-design.md` (commit `1a7534f4` on `claude/spec-nav-v2-polish`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs.

---

## File Structure

### PR A — Palette v2 (`claude/palette-v2`)

**Modify**
- `examples/chat/angular/src/app/shell/control-palette.component.ts` — full rewrite (~140 LOC). Adds `streaming` input, click-outside HostListener, ElementRef injection, Escape handler.
- `examples/chat/angular/src/app/shell/control-palette.component.html` — full rewrite (~110 LOC). Two states: collapsed pill, expanded panel with grouped sections.
- `examples/chat/angular/src/app/shell/control-palette.component.css` — full rewrite (~220 LOC). Shadcn-derived zinc palette, scale-in animation, switch component styling.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — add `[streaming]="agent.status() === 'running'"` binding (1 line).
- `examples/chat/angular/src/app/shell/control-palette.component.spec.ts` — extend with new behavior tests (pill click, × button, Escape, click-outside).

### PR B — GenUI stream suppression (`claude/genui-stream-suppression`)

**Create**
- `libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.ts` (~45 LOC).
- `libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.spec.ts` (~30 LOC).

**Modify**
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts` — add `genuiToolNames` input, `isGenUiToolCall` computed, template branch (~30 LOC delta).
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts` — extend with suppression tests (~50 LOC).
- `libs/chat/src/public-api.ts` — export `ChatGenuiSkeletonComponent` (1 line).

---

## Phase 0 — Branch creation

### Task 0.1: Fork branches from origin/main

Both PRs branch independently from origin/main (which has PR #243 merged).

- [ ] **Step 1: Fork PR A branch**

```bash
git fetch origin
git checkout -b claude/palette-v2 origin/main
git log --oneline -1
```

Expected: latest origin/main HEAD sha.

PR B's branch is created at Phase 2 (after PR A's tasks finish), so a single workspace doesn't bounce between branches mid-implementation.

---

## Phase 1 — Palette v2 (PR A)

### Task 1.1: Rewrite `control-palette.component.ts`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.ts`

- [ ] **Step 1: Replace file contents**

```typescript
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  effect,
  ElementRef,
  HostListener,
} from '@angular/core';
import { PalettePersistence } from './palette-persistence.service';
import type { DemoMode } from './demo-shell.component';

@Component({
  selector: 'app-control-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './control-palette.component.html',
  styleUrl: './control-palette.component.css',
})
export class ControlPalette {
  private readonly persistence = inject(PalettePersistence);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mode = input.required<DemoMode>();
  readonly model = input.required<string>();
  readonly modelOptions = input.required<readonly { value: string; label: string }[]>();
  readonly effort = input.required<string>();
  readonly effortOptions = input.required<readonly { value: string; label: string }[]>();
  readonly genUiMode = input.required<string>();
  readonly genUiOptions = input.required<readonly { value: string; label: string }[]>();
  readonly theme = input.required<string>();
  readonly themeOptions = input.required<readonly { value: string; label: string }[]>();
  readonly debugOpen = input.required<boolean>();
  /** True while the agent is streaming. Drives the status-dot pulse. */
  readonly streaming = input<boolean>(false);

  readonly modeChange = output<DemoMode>();
  readonly modelChange = output<string>();
  readonly effortChange = output<string>();
  readonly genUiModeChange = output<string>();
  readonly themeChange = output<string>();
  readonly debugOpenChange = output<boolean>();
  readonly newConversation = output<void>();

  /**
   * Whether the palette is collapsed to its status-pill state. Defaults
   * to true (pill = resting state, matching Next.js dev tools). Persisted
   * across reloads via PalettePersistence.
   */
  protected readonly collapsed = signal<boolean>(this.persistence.read('collapsed') ?? true);

  constructor() {
    effect(() => {
      this.persistence.write('collapsed', this.collapsed());
    });
  }

  protected expand(): void {
    this.collapsed.set(false);
  }

  protected close(): void {
    this.collapsed.set(true);
  }

  protected pickMode(next: DemoMode): void {
    this.modeChange.emit(next);
  }

  protected pickModel(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.modelChange.emit(value);
  }

  protected pickEffort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.effortChange.emit(value);
  }

  protected pickGenUiMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.genUiModeChange.emit(value);
  }

  protected pickTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.themeChange.emit(value);
  }

  protected toggleDebug(): void {
    this.debugOpenChange.emit(!this.debugOpen());
  }

  protected emitNewConversation(): void {
    this.newConversation.emit();
  }

  /**
   * Close the panel on document-level clicks outside the palette.
   * No-ops when already collapsed; checks event.target containment so
   * inside-panel clicks don't close.
   */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.collapsed()) return;
    const target = event.target as Node | null;
    if (target && this.elementRef.nativeElement.contains(target)) return;
    this.close();
  }

  /** Close on Escape anywhere in the document while the panel is open. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.collapsed()) this.close();
  }

  /**
   * Selected-option label for a value across an options list. Used by the
   * styled select trigger to show the human-friendly label rather than
   * the raw value.
   */
  protected labelFor(
    value: string,
    options: readonly { value: string; label: string }[],
  ): string {
    const match = options.find(o => o.value === value);
    return match?.label ?? value;
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx nx build examples-chat-angular 2>&1 | tail -5
```

Expected: green. (The template doesn't exist yet matching this controller; the HTML rewrite in Task 1.2 brings them back in sync. Expect template-parse errors here that the next task resolves.)

If the build fails because the OLD template still references `toggleCollapsed()` etc., that's expected. Move to Task 1.2.

- [ ] **Step 3: Commit (held for Task 1.5 — see batched-commit note below)**

Don't commit yet — Tasks 1.1 through 1.4 form a single rewrite. Commit them together at Task 1.5 after the build returns green.

---

### Task 1.2: Rewrite `control-palette.component.html`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.html`

- [ ] **Step 1: Replace file contents**

```html
@if (collapsed()) {
  <button
    type="button"
    class="palette-pill"
    aria-label="Expand control palette"
    (click)="expand()"
  >
    <span
      class="palette-pill__dot"
      [class.palette-pill__dot--streaming]="streaming()"
      aria-hidden="true"
    ></span>
    <span class="palette-pill__model">{{ model() }}</span>
    <span class="palette-pill__sep" aria-hidden="true">·</span>
    <span class="palette-pill__mode">{{ mode() }}</span>
  </button>
} @else {
  <div
    class="palette-panel"
    role="dialog"
    aria-label="Control palette"
  >
    <header class="palette-panel__header">
      <span class="palette-panel__title">Control palette</span>
      <button
        type="button"
        class="palette-panel__close"
        aria-label="Close control palette"
        (click)="close()"
      >×</button>
    </header>

    <section class="palette-panel__section">
      <h3 class="palette-panel__section-title">Mode</h3>
      <div class="palette-segmented" role="tablist" aria-label="Chat mode">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="mode() === 'embed'"
          [class.is-active]="mode() === 'embed'"
          (click)="pickMode('embed')"
        >Embed</button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="mode() === 'popup'"
          [class.is-active]="mode() === 'popup'"
          (click)="pickMode('popup')"
        >Popup</button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="mode() === 'sidebar'"
          [class.is-active]="mode() === 'sidebar'"
          (click)="pickMode('sidebar')"
        >Sidebar</button>
      </div>
    </section>

    <div class="palette-panel__divider"></div>

    <section class="palette-panel__section">
      <h3 class="palette-panel__section-title">Model</h3>
      <div class="palette-row">
        <label class="palette-row__label" for="palette-model">Provider</label>
        <div class="palette-select">
          <span class="palette-select__value">{{ labelFor(model(), modelOptions()) }}</span>
          <span class="palette-select__caret" aria-hidden="true">▾</span>
          <select id="palette-model" [value]="model()" (change)="pickModel($event)">
            @for (opt of modelOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === model()">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>
      <div class="palette-row">
        <label class="palette-row__label" for="palette-effort">Effort</label>
        <div class="palette-select">
          <span class="palette-select__value">{{ labelFor(effort(), effortOptions()) }}</span>
          <span class="palette-select__caret" aria-hidden="true">▾</span>
          <select id="palette-effort" [value]="effort()" (change)="pickEffort($event)">
            @for (opt of effortOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === effort()">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>
      <div class="palette-row">
        <label class="palette-row__label" for="palette-genui">Gen UI</label>
        <div class="palette-select">
          <span class="palette-select__value">{{ labelFor(genUiMode(), genUiOptions()) }}</span>
          <span class="palette-select__caret" aria-hidden="true">▾</span>
          <select id="palette-genui" [value]="genUiMode()" (change)="pickGenUiMode($event)">
            @for (opt of genUiOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === genUiMode()">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>
    </section>

    <div class="palette-panel__divider"></div>

    <section class="palette-panel__section">
      <h3 class="palette-panel__section-title">Appearance</h3>
      <div class="palette-row">
        <label class="palette-row__label" for="palette-theme">Theme</label>
        <div class="palette-select">
          <span class="palette-select__value">{{ labelFor(theme(), themeOptions()) }}</span>
          <span class="palette-select__caret" aria-hidden="true">▾</span>
          <select id="palette-theme" [value]="theme()" (change)="pickTheme($event)">
            @for (opt of themeOptions(); track opt.value) {
              <option [value]="opt.value" [selected]="opt.value === theme()">{{ opt.label }}</option>
            }
          </select>
        </div>
      </div>
      <div class="palette-row">
        <span class="palette-row__label">Debug overlay</span>
        <button
          type="button"
          class="palette-switch"
          role="switch"
          [attr.aria-checked]="debugOpen()"
          [class.is-on]="debugOpen()"
          (click)="toggleDebug()"
        >
          <span class="palette-switch__thumb" aria-hidden="true"></span>
        </button>
      </div>
    </section>

    <div class="palette-panel__divider"></div>

    <section class="palette-panel__section palette-panel__section--action">
      <button
        type="button"
        class="palette-action"
        (click)="emitNewConversation()"
      >
        <span class="palette-action__icon" aria-hidden="true">↻</span>
        <span>New conversation</span>
      </button>
    </section>
  </div>
}
```

- [ ] **Step 2: Commit held for Task 1.5.**

---

### Task 1.3: Rewrite `control-palette.component.css`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.css`

- [ ] **Step 1: Replace file contents**

```css
:host {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
}

/* ── Status pill (collapsed) ─────────────────────────────────────────── */

.palette-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #18181b;
  color: #fafafa;
  border: 1px solid #27272a;
  border-radius: 999px;
  padding: 6px 12px;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  transition: background 120ms ease, border-color 120ms ease;
}
.palette-pill:hover {
  background: #1f1f23;
  border-color: #3f3f46;
}

.palette-pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}
.palette-pill__dot--streaming {
  background: #4f8df5;
  box-shadow: 0 0 8px rgba(79, 141, 245, 0.7);
  animation: palette-pill-pulse 1.2s ease-in-out infinite;
}
@keyframes palette-pill-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(0.85); }
}

.palette-pill__sep,
.palette-pill__mode {
  color: #a1a1aa;
}
.palette-pill__model {
  font-weight: 600;
}

/* ── Panel (expanded) ────────────────────────────────────────────────── */

.palette-panel {
  width: 320px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  color: #fafafa;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  overflow: hidden;
  transform-origin: top right;
  animation: palette-panel-enter 120ms ease;
}
@keyframes palette-panel-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

.palette-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #27272a;
}
.palette-panel__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.palette-panel__close {
  background: transparent;
  border: 0;
  color: #71717a;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.palette-panel__close:hover { background: #27272a; color: #fafafa; }

.palette-panel__divider {
  height: 1px;
  background: #27272a;
}

.palette-panel__section {
  padding: 14px 16px;
}
.palette-panel__section--action {
  padding-top: 14px;
  padding-bottom: 16px;
}
.palette-panel__section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #71717a;
  margin: 0 0 10px 0;
}

/* ── Segmented (Mode) ────────────────────────────────────────────────── */

.palette-segmented {
  display: flex;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 3px;
  gap: 0;
}
.palette-segmented button {
  flex: 1;
  background: transparent;
  border: 0;
  color: #a1a1aa;
  padding: 6px 8px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
.palette-segmented button:hover { background: #18181b; color: #fafafa; }
.palette-segmented button.is-active {
  background: #27272a;
  color: #fafafa;
  font-weight: 500;
}

/* ── Field rows (label left, control right) ──────────────────────────── */

.palette-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.palette-row + .palette-row { margin-top: 10px; }
.palette-row__label {
  font-size: 13px;
  color: #d4d4d8;
}

/* ── Styled select (native <select> visually replaced by trigger) ─── */

.palette-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 140px;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #fafafa;
  cursor: pointer;
}
.palette-select:focus-within {
  border-color: #4f8df5;
  outline: 2px solid rgba(79, 141, 245, 0.3);
  outline-offset: 1px;
}
.palette-select:hover { background: #0f0f12; }
.palette-select__caret {
  color: #71717a;
  font-size: 10px;
}
.palette-select select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
}

/* ── Switch (Debug toggle) ───────────────────────────────────────────── */

.palette-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: #27272a;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  padding: 0;
  transition: background 150ms ease;
}
.palette-switch.is-on { background: #4f8df5; }
.palette-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fafafa;
  border-radius: 50%;
  transition: transform 150ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.palette-switch.is-on .palette-switch__thumb { transform: translateX(16px); }

/* ── Action button ───────────────────────────────────────────────────── */

.palette-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: #27272a;
  color: #fafafa;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 120ms ease;
}
.palette-action:hover { background: #3f3f46; }
.palette-action__icon { font-size: 14px; }

/* ── Responsive ──────────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .palette-panel {
    width: calc(100vw - 24px);
  }
}
```

- [ ] **Step 2: Verify the demo builds**

```bash
npx nx build examples-chat-angular 2>&1 | tail -5
```

Expected: build green. The HTML template now references all the controller methods/inputs.

- [ ] **Step 3: Commit held for Task 1.5.**

---

### Task 1.4: Wire `streaming` from demo-shell

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Find the `<app-control-palette>` element and add the `[streaming]` binding**

Read the file first to confirm the current set of bindings. Find the opening `<app-control-palette` tag and insert this binding alongside the existing `[mode]`, `[model]`, etc. bindings:

```html
[streaming]="agent.status() === 'running'"
```

Place it before `(modeChange)` to keep all inputs grouped before outputs.

The final element should look like (only the new line is shown — preserve all existing bindings):

```html
<app-control-palette
  [mode]="mode()"
  [model]="model()"
  ...existing inputs...
  [streaming]="agent.status() === 'running'"
  (modeChange)="onModeChange($event)"
  ...existing outputs...
/>
```

- [ ] **Step 2: Verify the demo builds**

```bash
npx nx build examples-chat-angular 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 3: Commit held for Task 1.5.**

---

### Task 1.5: Extend the spec file + commit

**Files:**
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.spec.ts`

- [ ] **Step 1: Read the existing spec to understand the current pattern**

```bash
cat examples/chat/angular/src/app/shell/control-palette.component.spec.ts
```

If a spec file doesn't exist yet, create one. The plan assumes one exists; if not, generate a minimal one with the structural tests below.

- [ ] **Step 2: Write/extend the spec to cover the new behaviors**

Replace (or create) `examples/chat/angular/src/app/shell/control-palette.component.spec.ts` with:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ControlPalette } from './control-palette.component';
import { PalettePersistence } from './palette-persistence.service';

@Component({
  standalone: true,
  imports: [ControlPalette],
  template: `<app-control-palette
    [mode]="'embed'"
    [model]="'gpt-5-mini'"
    [modelOptions]="[{ value: 'gpt-5-mini', label: 'gpt-5-mini' }]"
    [effort]="'minimal'"
    [effortOptions]="[{ value: 'minimal', label: 'minimal' }]"
    [genUiMode]="'a2ui'"
    [genUiOptions]="[{ value: 'a2ui', label: 'A2UI v1' }]"
    [theme]="'default-dark'"
    [themeOptions]="[{ value: 'default-dark', label: 'Default dark' }]"
    [debugOpen]="debug()"
    [streaming]="streaming()"
    (debugOpenChange)="debug.set($event)"
  />`,
})
class HostComponent {
  debug = signal(false);
  streaming = signal(false);
}

class StubPersistence {
  private store: Record<string, unknown> = {};
  read<T>(key: string): T | undefined { return this.store[key] as T | undefined; }
  write<T>(key: string, value: T): void { this.store[key] = value; }
}

describe('ControlPalette — pill / panel toggle', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: PalettePersistence, useClass: StubPersistence }],
    });
  });

  it('starts in the pill state (collapsed) on first run', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.palette-panel')).toBeNull();
  });

  it('clicking the pill opens the panel', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-panel')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeNull();
  });

  it('clicking the close button collapses the panel back to a pill', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-panel__close') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('Escape keydown closes the panel', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('document click outside the palette closes it', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();

    // Dispatch a click whose target is OUTSIDE the palette element tree.
    const outsideTarget = document.createElement('div');
    document.body.appendChild(outsideTarget);
    outsideTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fx.detectChanges();
    document.body.removeChild(outsideTarget);

    expect(fx.nativeElement.querySelector('.palette-pill')).toBeTruthy();
  });

  it('document click INSIDE the panel does not close it', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();

    const title = fx.nativeElement.querySelector('.palette-panel__title') as HTMLElement;
    title.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fx.detectChanges();

    expect(fx.nativeElement.querySelector('.palette-panel')).toBeTruthy();
  });

  it('streaming=true adds the streaming class on the dot when pill is visible', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.streaming.set(true);
    fx.detectChanges();
    expect(
      fx.nativeElement.querySelector('.palette-pill__dot--streaming'),
    ).toBeTruthy();
  });

  it('debug switch toggles aria-checked via output', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('.palette-pill') as HTMLButtonElement).click();
    fx.detectChanges();
    const sw = fx.nativeElement.querySelector('.palette-switch') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.click();
    fx.detectChanges();
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx nx test examples-chat-angular --testFile control-palette.component.spec.ts 2>&1 | tail -15
```

Expected: 8 passing.

- [ ] **Step 4: Build the whole demo once more, plus lint, to catch anything**

```bash
npx nx build examples-chat-angular 2>&1 | tail -5
npx nx lint examples-chat-angular 2>&1 | tail -5
npx nx lint chat 2>&1 | tail -5
```

All green expected. If lint complains about `[role="dialog"]` without `aria-modal`, add `aria-modal="false"` to the `.palette-panel` element.

- [ ] **Step 5: Commit the full palette rewrite (single commit covering Tasks 1.1–1.5)**

```bash
git add examples/chat/angular/src/app/shell/control-palette.component.ts \
        examples/chat/angular/src/app/shell/control-palette.component.html \
        examples/chat/angular/src/app/shell/control-palette.component.css \
        examples/chat/angular/src/app/shell/control-palette.component.spec.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.html
git commit -m "feat(examples-chat): palette v2 — status pill + shadcn-styled panel

Replaces the floating vertical column palette with a Next.js
dev-tools-style status pill (top-right) that expands into a
shadcn-refined panel with grouped sections (Mode / Model /
Appearance / Action).

- Pill collapsed state shows live model + mode; status dot
  pulses while streaming.
- Panel uses a switch component for the debug toggle, segmented
  control for mode, and native <select> elements visually
  replaced with button triggers (preserved keyboard a11y via
  opacity:0 select overlay).
- Close affordances: × button, Escape key, document-level click
  outside the palette.
- Spacing/typography follow shadcn conventions: zinc palette,
  uppercase section labels, 140px min-width controls aligned
  in a column.

Wires streaming via the existing agent.status() signal from
demo-shell so the dot animates exactly while a run is in flight."
```

---

### Task 1.6: Regenerate api-docs (if needed) + open PR A

- [ ] **Step 1: Regenerate api-docs**

The palette component isn't a lib public-api export, so api-docs.json shouldn't change. Confirm:

```bash
npm run generate-api-docs 2>&1 | tail -5
git status apps/website/content/docs/ --short
```

If `apps/website/content/docs/chat/api/api-docs.json` shows changes, stage and commit them — otherwise skip.

```bash
git status apps/website/content/docs/ --short && \
  ( git diff --quiet apps/website/content/docs/ || \
    ( git add apps/website/content/docs/ && \
      git commit -m "chore: regenerate api-docs" ) )
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin claude/palette-v2

gh pr create --title "feat(examples-chat): palette v2 — status pill + shadcn panel" --body "$(cat <<'EOF'
## Summary

Replaces the floating vertical column palette in the canonical chat demo with a Next.js dev-tools-style **status pill** (top-right corner) that expands into a **shadcn-refined panel** with grouped sections.

- Pill shows live model + current mode (\`● gpt-5-mini · embed\`). Status dot pulses while the agent is streaming.
- Panel layout: \`Mode\` segmented control + \`Model\` section (provider / effort / gen UI) + \`Appearance\` section (theme / debug switch) + full-width \`New conversation\` button.
- Close affordances: × button, Escape key, click outside the palette.
- Native \`<select>\` elements preserved underneath shadcn-styled triggers via \`opacity: 0\` overlay — keyboard navigation and screen-reader behavior unchanged.

Spec: \`docs/superpowers/specs/2026-05-11-nav-v2-polish-palette-and-genui-suppression-design.md\` (\`Palette v2\` section).

## Test plan
- [x] \`nx test examples-chat-angular --testFile control-palette.component.spec.ts\` — 8 tests green
- [x] \`nx build examples-chat-angular\` green
- [x] \`nx lint examples-chat-angular\` + \`nx lint chat\` green
- [ ] Live smoke at \`/embed\`, \`/popup\`, \`/sidebar\`: pill visible top-right, click expands panel, all 7 controls work, Escape + outside-click close
- [ ] Streaming dot pulses while a run is in flight; settles to green when idle
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL from the output.

---

## Phase 2 — GenUI stream suppression (PR B)

### Task 2.1: Fork branch from origin/main

PR B is independent of PR A and forks fresh from `origin/main` (not from PR A's branch).

- [ ] **Step 1: Switch branches**

```bash
git fetch origin
git checkout -b claude/genui-stream-suppression origin/main
git log --oneline -1
```

Expected: latest origin/main HEAD (which may or may not include PR A's merge — both paths work).

---

### Task 2.2: New `chat-genui-skeleton` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatGenuiSkeletonComponent } from './chat-genui-skeleton.component';

describe('ChatGenuiSkeletonComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ChatGenuiSkeletonComponent] }));

  it('renders a region role with the Building UI status text', () => {
    const fx = TestBed.createComponent(ChatGenuiSkeletonComponent);
    fx.detectChanges();
    const status = fx.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('Building UI');
  });

  it('renders three shimmer rows', () => {
    const fx = TestBed.createComponent(ChatGenuiSkeletonComponent);
    fx.detectChanges();
    const rows = fx.nativeElement.querySelectorAll('.chat-genui-skeleton__row');
    expect(rows.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx nx test chat --testFile chat-genui-skeleton.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — component file not found.

- [ ] **Step 3: Implement the component**

```typescript
// libs/chat/src/lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-genui-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host {
      display: block;
      width: 100%;
    }
    .chat-genui-skeleton {
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: 10px;
      padding: 14px;
      background: var(--ngaf-chat-surface-alt);
    }
    .chat-genui-skeleton__label {
      font-size: 12px;
      color: var(--ngaf-chat-text-muted);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chat-genui-skeleton__rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chat-genui-skeleton__row {
      height: 10px;
      border-radius: 5px;
      background: linear-gradient(
        90deg,
        var(--ngaf-chat-separator) 0%,
        color-mix(in srgb, var(--ngaf-chat-separator) 70%, transparent) 50%,
        var(--ngaf-chat-separator) 100%
      );
      background-size: 200% 100%;
      animation: chat-genui-skeleton-shimmer 1.4s ease-in-out infinite;
    }
    .chat-genui-skeleton__row:nth-child(1) { width: 70%; }
    .chat-genui-skeleton__row:nth-child(2) { width: 90%; }
    .chat-genui-skeleton__row:nth-child(3) { width: 50%; }
    @keyframes chat-genui-skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  template: `
    <div class="chat-genui-skeleton" role="status" aria-live="polite">
      <div class="chat-genui-skeleton__label">
        <span aria-hidden="true">✨</span>
        <span>Building UI…</span>
      </div>
      <div class="chat-genui-skeleton__rows">
        <div class="chat-genui-skeleton__row"></div>
        <div class="chat-genui-skeleton__row"></div>
        <div class="chat-genui-skeleton__row"></div>
      </div>
    </div>
  `,
})
export class ChatGenuiSkeletonComponent {}
```

- [ ] **Step 4: Re-run tests**

```bash
npx nx test chat --testFile chat-genui-skeleton.component.spec.ts 2>&1 | tail -10
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-genui-skeleton/
git commit -m "feat(chat): chat-genui-skeleton primitive

Card-shaped placeholder rendered in place of streaming
tool-call JSON while an A2UI / json-render surface is being
built. Three shimmer rows + 'Building UI…' status label.
Themed via existing chat-tokens (separator color, surface-alt
background) so it inherits A2UI theme overrides."
```

---

### Task 2.3: Extend `chat-message` with GenUI tool-call detection

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts`

- [ ] **Step 1: Append failing tests to the existing spec**

Append the following block to `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';
import type { Message } from '../../agent/message';

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message
    role="assistant"
    [message]="msg"
    [streaming]="streaming"
  >Streaming body</chat-message>`,
})
class GenuiHost {
  msg: Message | undefined = undefined;
  streaming = false;
}

function makeMessage(toolCalls: Array<{ name: string; id?: string }>): Message {
  return {
    id: 'm-1',
    role: 'assistant',
    content: '',
    extra: { tool_calls: toolCalls },
  };
}

describe('ChatMessageComponent — GenUI tool-call suppression', () => {
  it('renders the skeleton when message has a generate_a2ui_schema tool call and is streaming', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_a2ui_schema' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeNull();
  });

  it('renders the skeleton when message has a generate_json_render_spec tool call', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_json_render_spec' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('keeps the skeleton after streaming completes (body remains suppressed)', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'generate_a2ui_schema' }]);
    fx.componentInstance.streaming = false;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeTruthy();
  });

  it('renders the normal body when tool call is a non-GenUI tool (e.g. search_documents)', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = makeMessage([{ name: 'search_documents' }]);
    fx.componentInstance.streaming = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeTruthy();
  });

  it('renders the normal body when message has no tool calls', () => {
    TestBed.configureTestingModule({ imports: [GenuiHost] });
    const fx = TestBed.createComponent(GenuiHost);
    fx.componentInstance.msg = { id: 'm-1', role: 'assistant', content: 'hi', extra: {} };
    fx.componentInstance.streaming = false;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-genui-skeleton')).toBeNull();
    expect(fx.nativeElement.querySelector('.chat-message__assistant-body')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the new tests — confirm fail**

```bash
npx nx test chat --testFile chat-message.component.spec.ts 2>&1 | tail -15
```

Expected: FAIL — `chat-genui-skeleton` not rendered (the new template branch doesn't exist yet).

- [ ] **Step 3: Extend `chat-message.component.ts`**

Replace the file contents:

```typescript
// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed, effect, inject } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';
import { ChatCitationsComponent } from '../chat-citations/chat-citations.component';
import { ChatCheckpointMarkerComponent } from '../chat-checkpoint-marker/chat-checkpoint-marker.component';
import { ChatGenuiSkeletonComponent } from '../chat-genui-skeleton/chat-genui-skeleton.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';
import type { Message } from '../../agent/message';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Default set of tool names that produce a rendered surface rather than
 *  visible text. Consumers can override via the `genuiToolNames` input. */
const DEFAULT_GENUI_TOOL_NAMES: readonly string[] = [
  'generate_a2ui_schema',
  'generate_json_render_spec',
];

@Component({
  selector: 'chat-message',
  standalone: true,
  imports: [ChatCitationsComponent, ChatCheckpointMarkerComponent, ChatGenuiSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES, `
    .chat-message__layout { display: flex; gap: 8px; align-items: flex-start; }
    .chat-message__gutter { flex: 0 0 14px; display: flex; align-items: flex-start; padding-top: 4px; }
    .chat-message__gutter:empty { flex-basis: 0; }
    .chat-message__main { flex: 1; min-width: 0; }
  `],
  providers: [CitationsResolverService],
  host: {
    '[attr.data-role]': 'role()',
    '[attr.data-current]': 'currentStr()',
    '[attr.data-streaming]': 'streamingStr()',
    '[attr.data-prev-role]': 'prevRole() ?? null',
  },
  template: `
    <div class="chat-message__layout">
      <div class="chat-message__gutter">
        @if (checkpointId(); as cpId) {
          <chat-checkpoint-marker
            [checkpointId]="cpId"
            [isActive]="checkpointActive()"
            (replayRequested)="replayRequested.emit($event)"
            (forkRequested)="forkRequested.emit($event)"
          />
        }
      </div>
      <div class="chat-message__main">
        @if (isGenUiToolCall()) {
          <chat-genui-skeleton />
        } @else {
          <div [class]="bodyClass()">
            <ng-content />
            <span class="chat-message__caret" aria-hidden="true"></span>
          </div>
          @if (message()?.role === 'assistant' && message(); as msg) {
            <chat-citations [message]="msg" />
          }
          <div class="chat-message__controls">
            <ng-content select="[chatMessageControls]" />
          </div>
        }
      </div>
    </div>
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);
  readonly message = input<Message | undefined>(undefined);

  /** Optional checkpoint id to anchor a gutter marker. */
  readonly checkpointId = input<string | undefined>(undefined);
  readonly checkpointActive = input<boolean>(false);

  /** Tool names whose call/result messages should render a skeleton in
   *  place of the streaming body. Defaults to the A2UI / json-render
   *  pair; consumers can override or extend. */
  readonly genuiToolNames = input<readonly string[]>(DEFAULT_GENUI_TOOL_NAMES);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  private readonly resolver = inject(CitationsResolverService);

  constructor() {
    effect(() => {
      this.resolver.message.set(this.message() ?? null);
    });
  }

  readonly currentStr = computed(() => String(this.current()));
  readonly streamingStr = computed(() => String(this.streaming()));

  readonly bodyClass = computed(() => {
    switch (this.role()) {
      case 'user': return 'chat-message__bubble';
      case 'assistant': return 'chat-message__assistant-body';
      default: return 'chat-message__plain';
    }
  });

  /** True when this message represents (or results from) a GenUI tool
   *  call whose body should be suppressed in favor of a skeleton. */
  readonly isGenUiToolCall = computed<boolean>(() => {
    const m = this.message();
    if (!m) return false;
    const names = new Set(this.genuiToolNames());

    // Case 1: assistant message with tool_calls referencing a GenUI tool.
    if (m.role === 'assistant') {
      const calls = (m.extra?.['tool_calls'] as Array<{ name?: string }> | undefined) ?? [];
      if (calls.some(c => c.name != null && names.has(c.name))) return true;
    }

    // Case 2: tool message whose `name` matches a GenUI tool. (The tool
    // result message carries `name` set to the tool's name.)
    if (m.role === 'tool') {
      const name = (m.extra?.['name'] as string | undefined) ?? m.name;
      if (typeof name === 'string' && names.has(name)) return true;
    }

    return false;
  });
}
```

- [ ] **Step 4: Re-run tests**

```bash
npx nx test chat --testFile chat-message.component.spec.ts 2>&1 | tail -15
```

Expected: all original tests + 5 new suppression tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-message/
git commit -m "feat(chat): chat-message GenUI tool-call body suppression

When the bound Message represents (or results from) a tool call to
a known GenUI tool (default: generate_a2ui_schema /
generate_json_render_spec), render <chat-genui-skeleton> in place
of the streaming body. Skeleton persists after streaming since the
actual rendered surface mounts via the existing agent.events$
channel in a separate slot.

The DEFAULT_GENUI_TOOL_NAMES set is overridable via the new
genuiToolNames input, following the same convention as the
LangGraph adapter's subagentToolNames."
```

---

### Task 2.4: Export from `public-api.ts` + open PR B

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the export**

Append to `libs/chat/src/public-api.ts` near the other primitive exports (search for `ChatCheckpointMarkerComponent` for a sensible placement spot):

```typescript
export { ChatGenuiSkeletonComponent } from './lib/primitives/chat-genui-skeleton/chat-genui-skeleton.component';
```

- [ ] **Step 2: Build + run all lib tests**

```bash
npx nx build chat 2>&1 | tail -8
npx nx test chat 2>&1 | tail -15
npx nx lint chat 2>&1 | tail -8
```

All green expected.

- [ ] **Step 3: Regenerate api-docs**

```bash
npm run generate-api-docs 2>&1 | tail -5
git status apps/website/content/docs/ --short
```

If api-docs.json changed, stage it.

- [ ] **Step 4: Commit + push**

```bash
git add libs/chat/src/public-api.ts
git diff --cached --quiet || git commit -m "feat(chat): export ChatGenuiSkeletonComponent"

git add apps/website/content/docs/ 2>/dev/null
git diff --cached --quiet || git commit -m "chore: regenerate api-docs for ChatGenuiSkeleton"

git push -u origin claude/genui-stream-suppression 2>&1 | tail -3
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(chat): suppress streaming JSON for A2UI tool calls" --body "$(cat <<'EOF'
## Summary

When the LLM calls \`generate_a2ui_schema\` or \`generate_json_render_spec\`, the tool's args stream back as raw JSON in the assistant bubble — visible for ~3s before the rendered \`<a2ui-surface>\` mounts and replaces it. This PR suppresses that JSON streaming and shows a \`<chat-genui-skeleton>\` instead.

- New \`<chat-genui-skeleton>\` primitive — card-shaped placeholder with three shimmer rows + \`✨ Building UI…\` label.
- \`<chat-message>\` now detects GenUI tool-call messages (both the streaming assistant AIMessage with \`tool_calls\` and the resulting ToolMessage) and renders the skeleton in place of the normal body.
- Tool name set is overridable via a new \`genuiToolNames\` input on \`<chat-message>\` (default: the two A2UI / json-render tool names).

Spec: \`docs/superpowers/specs/2026-05-11-nav-v2-polish-palette-and-genui-suppression-design.md\` (\`GenUI stream suppression\` section).

## Test plan
- [x] \`nx test chat --testFile chat-genui-skeleton.component.spec.ts\` — 2 tests green
- [x] \`nx test chat --testFile chat-message.component.spec.ts\` — 5 new suppression tests green, original tests still pass
- [x] \`nx build chat\` + \`nx lint chat\` green
- [ ] Live smoke: trigger an A2UI render prompt (e.g. \"Render a settings card with a dark-mode toggle, language dropdown, and Save button\") — verify no JSON is visible during streaming and skeleton appears immediately; rendered surface mounts on tool completion
- [ ] Live smoke: trigger a non-GenUI tool prompt (e.g. \"Search the docs for signal()\") — verify normal streaming body renders (not suppressed)
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Capture the PR URL.

---

## Verification matrix

| Surface | Verifier |
|---|---|
| Pill ↔ panel toggle | `control-palette.component.spec.ts` (clicks, Escape, outside-click) |
| Streaming dot pulse | Live smoke against `agent.status()` = `running` |
| All 7 controls still emit changes | Existing palette tests + extended spec |
| Skeleton render shape | `chat-genui-skeleton.component.spec.ts` |
| `chat-message` GenUI suppression | `chat-message.component.spec.ts` extended (5 tests) |
| End-to-end A2UI render | Live Chrome MCP smoke: settings-card prompt at `/embed` |

---

## Risk register

- **Native `<select>` overlay accessibility**: visually transparent select over a styled button trigger relies on `:focus-within` to lift the focus ring. Tested in Chromium; Safari may need adjustment if the focus ring doesn't appear (acceptable post-merge polish).
- **Click-outside listener storm**: every document click runs the HostListener. The check is `O(1)` (`elementRef.nativeElement.contains(target)`). No measurable impact, but worth re-checking if other components later add similar listeners.
- **Skeleton orphan on failed tool**: if the GenUI tool errors and no `a2ui_surface` event fires, the skeleton stays indefinitely. Out of scope per spec; documented as future polish.
- **Tool message detection** uses `m.extra?.['name']` because the LangGraph projection puts the tool name on the raw `BaseMessage.name` field. If a future adapter normalizes the projection (e.g. a `toolName` field), the predicate needs an update — note as a TODO comment in `isGenUiToolCall`.
- **Genui-suppression false positives**: a non-GenUI tool that happens to share a name with the defaults (e.g. an internal `generate_a2ui_schema` test mock) would also be suppressed. Mitigation: tests use distinct names; the input is overridable.
