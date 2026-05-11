# Chat Debug Devtools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose `<chat-debug>` into a floating devtools launcher with a built-in Timeline + State inspector and a slot-based extension API (`chatDebugControls`, `chatDebugInspector`). Migrate the smoke app's `ControlPalette` to live inside `chat-debug` via the new API.

**Architecture:** Single launcher component owning open/close + dock state, persisted via a typed localStorage wrapper. Built-in inspectors are repositories that re-use existing checkpoint-card / state-diff / state-inspector pieces. Public slots are structural directives on `<ng-template>` queried via `contentChild` / `contentChildren`. Blessed primitive components (`<chat-debug-section>`, `<chat-debug-segmented>`, `<chat-debug-select>`, `<chat-debug-toggle>`, `<chat-debug-action>`) give host apps a styled vocabulary for the controls slot.

**Tech Stack:** Angular 20 (signals, standalone, `input.required`, `contentChild(ren)`), vitest + jsdom for tests, Nx monorepo, `@ngaf/chat` package surface, `--ngaf-chat-*` design tokens.

**Spec:** [docs/superpowers/specs/2026-05-11-chat-debug-devtools-design.md](../specs/2026-05-11-chat-debug-devtools-design.md)

---

## File map

**New files** (all under `libs/chat/src/lib/compositions/chat-debug/`):

- `persistence.ts` — typed localStorage wrapper.
- `persistence.spec.ts` — unit tests for persistence.
- `chat-debug-controls.directive.ts` — `[chatDebugControls]` structural marker.
- `chat-debug-inspector.directive.ts` — `[chatDebugInspector]` with `label` input.
- `primitives/chat-debug-section.component.ts`
- `primitives/chat-debug-segmented.component.ts`
- `primitives/chat-debug-select.component.ts`
- `primitives/chat-debug-toggle.component.ts`
- `primitives/chat-debug-action.component.ts`
- `primitives/primitives.spec.ts` — defined-as-class smoke tests for all five primitives.
- `inspectors/timeline-inspector.component.ts` — vertical list, keyboard nav, inline expand.
- `inspectors/timeline-inspector.spec.ts` — keyboard nav pure-function tests.
- `inspectors/state-inspector.component.ts` — wraps existing `debug-state-inspector` for the tab.

**Files modified:**

- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` — full rewrite (launcher + dock chrome).
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts` — replace stale entries, add new defined-as-class checks.
- `libs/chat/src/public-api.ts:75` — replace single export with new public surface.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — replace `<app-control-palette>` block + `.demo-shell__debug` block with `<chat-debug>` + projected `chatDebugControls`.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — drop palette imports/wiring, import chat-debug primitives.
- `examples/chat/angular/src/app/shell/demo-shell.component.css` — delete `.demo-shell__debug` rule and any palette-only CSS.

**Files deleted:**

- `libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts`
- `libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts`
- `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts`
- `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts` (replaced by `inspectors/timeline-inspector.component.ts`)
- `examples/chat/angular/src/app/shell/control-palette.component.ts`
- `examples/chat/angular/src/app/shell/control-palette.component.html`
- `examples/chat/angular/src/app/shell/control-palette.component.css`
- `examples/chat/angular/src/app/shell/control-palette.component.spec.ts`
- `examples/chat/angular/src/app/shell/palette-persistence.service.ts`
- `examples/chat/angular/src/app/shell/palette-persistence.service.spec.ts`

---

## Task 1: Persistence wrapper

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/persistence.ts`
- Test: `libs/chat/src/lib/compositions/chat-debug/persistence.spec.ts`

- [ ] **Step 1: Write the failing test**

`libs/chat/src/lib/compositions/chat-debug/persistence.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { createPersistence } from './persistence';

describe('createPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads undefined when no key set', () => {
    const p = createPersistence('test');
    expect(p.read('dock')).toBeUndefined();
  });

  it('round-trips a string value under the namespaced key', () => {
    const p = createPersistence('test');
    p.write('dock', 'bottom');
    expect(p.read('dock')).toBe('bottom');
    expect(localStorage.getItem('test:dock')).toBe('"bottom"');
  });

  it('round-trips a number value', () => {
    const p = createPersistence('test');
    p.write('size', 480);
    expect(p.read('size')).toBe(480);
  });

  it('round-trips a boolean value', () => {
    const p = createPersistence('test');
    p.write('open', true);
    expect(p.read('open')).toBe(true);
  });

  it('returns undefined when stored JSON is malformed', () => {
    localStorage.setItem('test:dock', '{not-json');
    const p = createPersistence('test');
    expect(p.read('dock')).toBeUndefined();
  });

  it('isolates by prefix', () => {
    const a = createPersistence('a');
    const b = createPersistence('b');
    a.write('open', true);
    expect(b.read('open')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- persistence.spec`
Expected: FAIL with module-not-found / `createPersistence is not a function`.

- [ ] **Step 3: Write the implementation**

`libs/chat/src/lib/compositions/chat-debug/persistence.ts`:

```ts
// SPDX-License-Identifier: MIT
export interface Persistence {
  read<T = unknown>(key: string): T | undefined;
  write<T = unknown>(key: string, value: T): void;
}

/**
 * Tiny typed localStorage wrapper namespaced under `{prefix}:`. SSR-safe:
 * when `localStorage` is undefined (server build), read returns undefined
 * and write is a no-op.
 */
export function createPersistence(prefix: string): Persistence {
  const fullKey = (k: string) => `${prefix}:${k}`;
  return {
    read<T = unknown>(key: string): T | undefined {
      if (typeof localStorage === 'undefined') return undefined;
      const raw = localStorage.getItem(fullKey(key));
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    write<T = unknown>(key: string, value: T): void {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(fullKey(key), JSON.stringify(value));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat -- persistence.spec`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/persistence.ts libs/chat/src/lib/compositions/chat-debug/persistence.spec.ts
git commit -m "feat(chat): chat-debug persistence wrapper"
```

---

## Task 2: Slot directives

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/chat-debug-controls.directive.ts`
- Create: `libs/chat/src/lib/compositions/chat-debug/chat-debug-inspector.directive.ts`

These are pure marker directives queried by `contentChild` / `contentChildren`. No behavior on their own — they expose `TemplateRef` + a `label` input (inspector only).

- [ ] **Step 1: Create controls directive**

`libs/chat/src/lib/compositions/chat-debug/chat-debug-controls.directive.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Marks an `<ng-template>` as the controls slot of `<chat-debug>`. Rendered
 * pinned at the top of the docked panel. Host apps put their app-specific
 * controls (mode picker, model select, etc.) inside this template.
 */
@Directive({
  selector: 'ng-template[chatDebugControls]',
  standalone: true,
})
export class ChatDebugControlsDirective {
  readonly templateRef = inject(TemplateRef);
}
```

- [ ] **Step 2: Create inspector directive**

`libs/chat/src/lib/compositions/chat-debug/chat-debug-inspector.directive.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Marks an `<ng-template>` as a host-registered inspector tab. Each instance
 * adds a tab in the docked panel's tab strip, appended after the built-in
 * Timeline and State tabs.
 */
@Directive({
  selector: 'ng-template[chatDebugInspector]',
  standalone: true,
})
export class ChatDebugInspectorDirective {
  readonly label = input.required<string>({ alias: 'chatDebugInspectorLabel' });
  readonly templateRef = inject(TemplateRef);
}
```

Note: the alias makes the usage read `<ng-template chatDebugInspector chatDebugInspectorLabel="Network">` to avoid binding both `chatDebugInspector` and `label` separately. If a simpler `label` binding is preferred, drop the alias.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug-controls.directive.ts libs/chat/src/lib/compositions/chat-debug/chat-debug-inspector.directive.ts
git commit -m "feat(chat): chat-debug slot directives (controls + inspector)"
```

---

## Task 3: `<chat-debug-section>` primitive

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-section.component.ts`

Visual container with an optional label and consistent vertical spacing for stacked controls.

- [ ] **Step 1: Write the implementation**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host {
      display: block;
      padding: var(--ngaf-chat-space-3) var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    :host:last-child { border-bottom: 0; }
    .section__label {
      font-size: var(--ngaf-chat-font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ngaf-chat-text-muted);
      margin: 0 0 var(--ngaf-chat-space-2);
    }
    .section__body { display: flex; flex-direction: column; gap: var(--ngaf-chat-space-2); }
    `,
  ],
  template: `
    @if (label()) {
      <h4 class="section__label">{{ label() }}</h4>
    }
    <div class="section__body"><ng-content /></div>
  `,
})
export class ChatDebugSectionComponent {
  readonly label = input<string>('');
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-section.component.ts
git commit -m "feat(chat): chat-debug-section primitive"
```

---

## Task 4: `<chat-debug-segmented>` primitive

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-segmented.component.ts`

Tab-style segmented choice — visual equivalent of the smoke app's mode tabs (Embed / Popup / Sidebar).

- [ ] **Step 1: Write the implementation**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    .segmented {
      display: inline-flex;
      gap: 0;
      padding: 2px;
      background: var(--ngaf-chat-surface-alt);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
    }
    .segmented__btn {
      appearance: none;
      border: 0;
      background: transparent;
      padding: 4px 10px;
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
      border-radius: calc(var(--ngaf-chat-radius-button) - 2px);
    }
    .segmented__btn.is-active {
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      box-shadow: var(--ngaf-chat-shadow-sm);
    }
    `,
  ],
  template: `
    <div class="segmented" role="tablist">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          class="segmented__btn"
          [class.is-active]="opt.value === value()"
          [attr.aria-selected]="opt.value === value()"
          (click)="valueChange.emit(opt.value)"
        >{{ opt.label }}</button>
      }
    </div>
  `,
})
export class ChatDebugSegmentedComponent {
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-segmented.component.ts
git commit -m "feat(chat): chat-debug-segmented primitive"
```

---

## Task 5: `<chat-debug-select>` primitive

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts`

Labeled dropdown for Model / Effort / GenUI / Theme.

- [ ] **Step 1: Write the implementation**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ngaf-chat-space-3);
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text);
    }
    select {
      appearance: none;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 4px 8px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
    }
    `,
  ],
  template: `
    <label>
      <span>{{ label() }}</span>
      <select
        [value]="value()"
        (change)="onChange($event)"
        [attr.aria-label]="label()"
      >
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
        }
      </select>
    </label>
  `,
})
export class ChatDebugSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts
git commit -m "feat(chat): chat-debug-select primitive"
```

---

## Task 6: `<chat-debug-toggle>` primitive

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts`

On/off switch, future-proofing the API.

- [ ] **Step 1: Write the implementation**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--ngaf-chat-space-2);
      appearance: none;
      background: transparent;
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 4px 10px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text);
      cursor: pointer;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ngaf-chat-muted);
    }
    button.is-on .dot { background: var(--ngaf-chat-success); }
    `,
  ],
  template: `
    <button
      type="button"
      [class.is-on]="value()"
      [attr.aria-pressed]="value()"
      (click)="valueChange.emit(!value())"
    >
      <span class="dot"></span>
      <span>{{ label() }}</span>
    </button>
  `,
})
export class ChatDebugToggleComponent {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts
git commit -m "feat(chat): chat-debug-toggle primitive"
```

---

## Task 7: `<chat-debug-action>` primitive + primitives spec

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts`

Simple button (e.g., "New conversation").

- [ ] **Step 1: Write the action component**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';

@Component({
  selector: 'chat-debug-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: block; }
    button {
      appearance: none;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 6px 12px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      cursor: pointer;
      width: 100%;
      text-align: left;
    }
    button:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, var(--ngaf-chat-surface-alt)); }
    `,
  ],
  template: `
    <button type="button" (click)="clicked.emit()">{{ label() }}</button>
  `,
})
export class ChatDebugActionComponent {
  readonly label = input.required<string>();
  readonly clicked = output<void>();
}
```

- [ ] **Step 2: Write the primitives smoke spec**

`libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { ChatDebugSectionComponent } from './chat-debug-section.component';
import { ChatDebugSegmentedComponent } from './chat-debug-segmented.component';
import { ChatDebugSelectComponent } from './chat-debug-select.component';
import { ChatDebugToggleComponent } from './chat-debug-toggle.component';
import { ChatDebugActionComponent } from './chat-debug-action.component';

describe('chat-debug primitives are defined', () => {
  it('section', () => { expect(typeof ChatDebugSectionComponent).toBe('function'); });
  it('segmented', () => { expect(typeof ChatDebugSegmentedComponent).toBe('function'); });
  it('select', () => { expect(typeof ChatDebugSelectComponent).toBe('function'); });
  it('toggle', () => { expect(typeof ChatDebugToggleComponent).toBe('function'); });
  it('action', () => { expect(typeof ChatDebugActionComponent).toBe('function'); });
});
```

- [ ] **Step 3: Run primitives spec**

Run: `npx nx test chat -- primitives.spec`
Expected: PASS, 5 tests.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts
git commit -m "feat(chat): chat-debug-action primitive + primitives smoke spec"
```

---

## Task 8: Timeline inspector

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.spec.ts`

Vertical list of checkpoints with inline expansion. Re-uses existing `DebugCheckpointCardComponent` for each row and `chat-debug-state-diff` inside the expanded row.

- [ ] **Step 1: Write the failing nav-logic spec**

`libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { stepSelection, type Direction } from './timeline-inspector.component';

describe('stepSelection', () => {
  it('moves down when not at end', () => {
    expect(stepSelection('down', 0, 3)).toBe(1);
  });

  it('does not move past last index', () => {
    expect(stepSelection('down', 2, 3)).toBe(2);
  });

  it('moves up when not at start', () => {
    expect(stepSelection('up', 2, 3)).toBe(1);
  });

  it('does not move below 0', () => {
    expect(stepSelection('up', 0, 3)).toBe(0);
  });

  it('jumps to start', () => {
    expect(stepSelection('home', 5, 10)).toBe(0);
  });

  it('jumps to end', () => {
    expect(stepSelection('end', 0, 4)).toBe(3);
  });

  it('returns -1 when count is 0', () => {
    expect(stepSelection('down', -1, 0)).toBe(-1);
    expect(stepSelection('end', -1, 0)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat -- timeline-inspector.spec`
Expected: FAIL with `stepSelection is not a function`.

- [ ] **Step 3: Write the component file**

`libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  HostListener,
} from '@angular/core';
import type { AgentWithHistory } from '../../../agent';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';
import { DebugCheckpointCardComponent, type DebugCheckpoint } from '../debug-checkpoint-card.component';
import { DebugStateDiffComponent } from '../debug-state-diff.component';
import { toDebugCheckpoint, extractStateValues } from '../debug-utils';

export type Direction = 'up' | 'down' | 'home' | 'end';

/**
 * Pure selection-step function. Exported for unit testing — the component's
 * keyboard handler delegates to it.
 */
export function stepSelection(dir: Direction, current: number, count: number): number {
  if (count === 0) return -1;
  switch (dir) {
    case 'down': return Math.min(current + 1, count - 1);
    case 'up':   return Math.max(current - 1, 0);
    case 'home': return 0;
    case 'end':  return count - 1;
  }
}

@Component({
  selector: 'chat-debug-timeline-inspector',
  standalone: true,
  imports: [DebugCheckpointCardComponent, DebugStateDiffComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: flex; flex-direction: column; height: 100%; outline: none; }
    .timeline__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
    }
    .timeline__clear {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      font-size: var(--ngaf-chat-font-size-xs);
    }
    .timeline__clear:disabled { opacity: 0.5; cursor: default; }
    .timeline__list {
      flex: 1;
      overflow-y: auto;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--ngaf-chat-space-2);
    }
    .timeline__row { display: flex; flex-direction: column; gap: var(--ngaf-chat-space-2); }
    .timeline__row-actions {
      display: none;
      gap: var(--ngaf-chat-space-2);
      padding-left: var(--ngaf-chat-space-3);
    }
    .timeline__row:hover .timeline__row-actions { display: flex; }
    .timeline__row button.row-action {
      background: transparent;
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 2px 8px;
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
    }
    .timeline__row button.row-action:hover { color: var(--ngaf-chat-text); }
    .timeline__diff {
      padding: var(--ngaf-chat-space-2);
      background: var(--ngaf-chat-surface-alt);
      border-radius: var(--ngaf-chat-radius-card);
    }
    `,
  ],
  template: `
    <div class="timeline__header">
      <span>{{ checkpoints().length }} checkpoints</span>
      <button
        type="button"
        class="timeline__clear"
        [disabled]="selectedIndex() < 0"
        (click)="selectedIndex.set(-1)"
      >Clear selection</button>
    </div>
    <div
      class="timeline__list"
      tabindex="0"
      role="listbox"
      aria-label="Checkpoint timeline"
    >
      @for (cp of checkpoints(); let i = $index; track cp.checkpointId ?? i) {
        <div class="timeline__row">
          <chat-debug-checkpoint-card
            [checkpoint]="cp"
            [isSelected]="i === selectedIndex()"
            (selected)="selectedIndex.set(i)"
          />
          @if (i === selectedIndex() && cp.checkpointId) {
            <div class="timeline__row-actions">
              <button class="row-action" type="button" (click)="replayRequested.emit(cp.checkpointId!)">Replay</button>
              <button class="row-action" type="button" (click)="forkRequested.emit(cp.checkpointId!)">Fork</button>
            </div>
          }
          @if (i === selectedIndex()) {
            <div class="timeline__diff">
              <chat-debug-state-diff
                [before]="previousStateAt(i)"
                [after]="currentStateAt(i)"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimelineInspectorComponent {
  readonly agent = input.required<AgentWithHistory>();
  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  readonly selectedIndex = signal<number>(-1);

  readonly checkpoints = computed((): DebugCheckpoint[] =>
    this.agent().history().map((cp, i) => toDebugCheckpoint(cp, i)),
  );

  currentStateAt(i: number): Record<string, unknown> {
    return extractStateValues(this.agent().history()[i]);
  }

  previousStateAt(i: number): Record<string, unknown> {
    if (i <= 0) return {};
    return extractStateValues(this.agent().history()[i - 1]);
  }

  @HostListener('keydown', ['$event'])
  protected onKey(ev: KeyboardEvent): void {
    const map: Record<string, Direction | undefined> = {
      ArrowDown: 'down',
      ArrowUp: 'up',
      Home: 'home',
      End: 'end',
    };
    const dir = map[ev.key];
    if (!dir) return;
    ev.preventDefault();
    this.selectedIndex.set(stepSelection(dir, this.selectedIndex(), this.checkpoints().length));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat -- timeline-inspector.spec`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/inspectors/
git commit -m "feat(chat): timeline inspector with keyboard nav + inline diff"
```

---

## Task 9: State inspector wrapper

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts`

Thin wrapper around the existing `DebugStateInspectorComponent` for the State tab. Existing component already renders the JSON tree; this component just feeds it `agent.state()` and adds a copy button.

- [ ] **Step 1: Write the implementation**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { AgentWithHistory } from '../../../agent';
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';
import { DebugStateInspectorComponent } from '../debug-state-inspector.component';
import { extractStateValues } from '../debug-utils';

@Component({
  selector: 'chat-debug-state-tab',
  standalone: true,
  imports: [DebugStateInspectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: flex; flex-direction: column; height: 100%; }
    .state__header {
      display: flex;
      justify-content: flex-end;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .state__copy {
      background: transparent;
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      padding: 2px 8px;
      font: inherit;
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
    }
    .state__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
    }
    `,
  ],
  template: `
    <div class="state__header">
      <button type="button" class="state__copy" (click)="copy()">Copy</button>
    </div>
    <div class="state__body">
      <chat-debug-state-inspector [state]="state()" />
    </div>
  `,
})
export class StateInspectorComponent {
  readonly agent = input.required<AgentWithHistory>();

  readonly state = computed((): Record<string, unknown> => {
    const history = this.agent().history();
    const last = history[history.length - 1];
    return extractStateValues(last);
  });

  copy(): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(JSON.stringify(this.state(), null, 2));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts
git commit -m "feat(chat): state inspector tab wrapper"
```

---

## Task 10: Rewrite `<chat-debug>` — launcher + dock chrome

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` (full rewrite)

The new `ChatDebugComponent` is a launcher that:
- shows a 40px floating button when closed,
- when open, renders a fixed docked panel with header (dock toggle + close), optional projected controls, tab strip, and active inspector,
- persists `open`, `dock`, `size`, `tab` via the persistence wrapper,
- queries `ChatDebugControlsDirective` (single) via `contentChild`,
- queries `ChatDebugInspectorDirective[]` (repeatable) via `contentChildren`,
- forwards `replayRequested` / `forkRequested` from the timeline.

- [ ] **Step 1: Replace `chat-debug.component.ts` entirely**

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  contentChild,
  contentChildren,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentWithHistory } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { ChatDebugControlsDirective } from './chat-debug-controls.directive';
import { ChatDebugInspectorDirective } from './chat-debug-inspector.directive';
import { TimelineInspectorComponent } from './inspectors/timeline-inspector.component';
import { StateInspectorComponent } from './inspectors/state-inspector.component';
import { createPersistence } from './persistence';

export type DockPosition = 'right' | 'bottom' | 'left';

interface TabEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: 'builtin-timeline' | 'builtin-state' | 'host';
  readonly hostIndex?: number;
}

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TimelineInspectorComponent,
    StateInspectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: contents; }

    /* Floating launcher */
    .launcher {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: var(--ngaf-chat-radius-launcher);
      background: var(--ngaf-chat-primary);
      color: var(--ngaf-chat-on-primary);
      border: 0;
      cursor: pointer;
      z-index: 990;
      box-shadow: var(--ngaf-chat-shadow-md);
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Docked panel */
    .panel {
      position: fixed;
      background: var(--ngaf-chat-bg);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      z-index: 991;
      display: flex;
      flex-direction: column;
      box-shadow: var(--ngaf-chat-shadow-lg);
    }
    .panel--right  { top: 0; right: 0; bottom: 0; width: var(--panel-size, 420px); border-right: 0; }
    .panel--left   { top: 0; left: 0;  bottom: 0; width: var(--panel-size, 420px); border-left: 0; }
    .panel--bottom { left: 0; right: 0; bottom: 0; height: var(--panel-size, 40vh); border-bottom: 0; }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-4);
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .panel__title {
      margin: 0;
      font-size: var(--ngaf-chat-font-size-sm);
      font-weight: 600;
    }
    .panel__actions { display: flex; align-items: center; gap: var(--ngaf-chat-space-1); }
    .panel__actions button {
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--ngaf-chat-radius-button);
      padding: 2px 6px;
      color: var(--ngaf-chat-text-muted);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      cursor: pointer;
    }
    .panel__actions button:hover { color: var(--ngaf-chat-text); border-color: var(--ngaf-chat-separator); }
    .panel__actions button.is-active { color: var(--ngaf-chat-text); }

    .panel__controls {
      border-bottom: 1px solid var(--ngaf-chat-separator);
      overflow-y: auto;
      max-height: 40%;
    }
    .panel__controls:empty { display: none; }

    .panel__tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--ngaf-chat-separator);
      padding: 0 var(--ngaf-chat-space-2);
    }
    .panel__tab {
      appearance: none;
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-3);
      font: inherit;
      font-size: var(--ngaf-chat-font-size-sm);
      color: var(--ngaf-chat-text-muted);
      cursor: pointer;
    }
    .panel__tab.is-active {
      color: var(--ngaf-chat-text);
      border-bottom-color: var(--ngaf-chat-primary);
    }

    .panel__body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
    `,
  ],
  template: `
    @if (!open()) {
      <button
        type="button"
        class="launcher"
        title="Open chat debug"
        aria-label="Open chat debug"
        (click)="setOpen(true)"
      >⚙</button>
    } @else {
      <div
        class="panel"
        [class.panel--right]="dockState() === 'right'"
        [class.panel--bottom]="dockState() === 'bottom'"
        [class.panel--left]="dockState() === 'left'"
        role="region"
        aria-label="Chat debug"
      >
        <div class="panel__header">
          <h3 class="panel__title">Chat Debug</h3>
          <div class="panel__actions">
            <button type="button" [class.is-active]="dockState() === 'left'"   (click)="setDock('left')"   aria-label="Dock left">◧</button>
            <button type="button" [class.is-active]="dockState() === 'bottom'" (click)="setDock('bottom')" aria-label="Dock bottom">▭</button>
            <button type="button" [class.is-active]="dockState() === 'right'"  (click)="setDock('right')"  aria-label="Dock right">◨</button>
            <button type="button" (click)="setOpen(false)" aria-label="Close">×</button>
          </div>
        </div>

        @if (controls()) {
          <div class="panel__controls">
            <ng-container [ngTemplateOutlet]="controls()!.templateRef" />
          </div>
        }

        @if (tabs().length > 1) {
          <div class="panel__tabs" role="tablist">
            @for (tab of tabs(); track tab.id) {
              <button
                type="button"
                role="tab"
                class="panel__tab"
                [class.is-active]="tab.id === activeTabId()"
                [attr.aria-selected]="tab.id === activeTabId()"
                (click)="setActiveTab(tab.id)"
              >{{ tab.label }}</button>
            }
          </div>
        }

        <div class="panel__body">
          @switch (activeTab()?.kind) {
            @case ('builtin-timeline') {
              <chat-debug-timeline-inspector
                [agent]="agent()"
                (replayRequested)="replayRequested.emit($event)"
                (forkRequested)="forkRequested.emit($event)"
              />
            }
            @case ('builtin-state') {
              <chat-debug-state-tab [agent]="agent()" />
            }
            @case ('host') {
              @if (activeHostInspector(); as host) {
                <ng-container [ngTemplateOutlet]="host.templateRef" />
              }
            }
          }
        </div>
      </div>
    }
  `,
})
export class ChatDebugComponent {
  readonly agent = input.required<AgentWithHistory>();
  readonly dock = input<DockPosition>('right');
  readonly defaultOpen = input<boolean>(false);
  readonly storageKey = input<string>('chat-debug');

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();
  readonly openChange = output<boolean>();
  readonly dockChange = output<DockPosition>();

  protected readonly controls = contentChild(ChatDebugControlsDirective);
  protected readonly hostInspectors = contentChildren(ChatDebugInspectorDirective);

  protected readonly open = signal<boolean>(false);
  // Internal dock state — initialised in the persistence effect below from
  // persisted value or the `dock` input.
  protected readonly dockState = signal<DockPosition>('right');
  protected readonly activeTabId = signal<string>('timeline');

  protected readonly tabs = computed((): TabEntry[] => {
    const host = this.hostInspectors().map((d, i): TabEntry => ({
      id: `host-${i}`,
      label: d.label(),
      kind: 'host',
      hostIndex: i,
    }));
    return [
      { id: 'timeline', label: 'Timeline', kind: 'builtin-timeline' },
      { id: 'state', label: 'State', kind: 'builtin-state' },
      ...host,
    ];
  });

  protected readonly activeTab = computed(() =>
    this.tabs().find((t) => t.id === this.activeTabId()),
  );

  protected readonly activeHostInspector = computed(() => {
    const t = this.activeTab();
    if (!t || t.kind !== 'host' || t.hostIndex === undefined) return undefined;
    return this.hostInspectors()[t.hostIndex];
  });

  private restored = false;

  constructor() {
    // First read of inputs/storage on view init seeds the writable signals,
    // then write-through on every change. Untracked reads of the writable
    // signals avoid feedback loops.
    effect(() => {
      const p = createPersistence(this.storageKey());
      if (!this.restored) {
        const persistedOpen = p.read<boolean>('open');
        this.open.set(persistedOpen ?? this.defaultOpen());
        const persistedDock = p.read<DockPosition>('dock');
        this.dockState.set(persistedDock ?? this.dock());
        const persistedTab = p.read<string>('tab');
        if (persistedTab) this.activeTabId.set(persistedTab);
        this.restored = true;
        return;
      }
      p.write('open', this.open());
      p.write('dock', this.dockState());
      p.write('tab', this.activeTabId());
    });
  }

  setOpen(value: boolean): void {
    this.open.set(value);
    this.openChange.emit(value);
  }

  setDock(next: DockPosition): void {
    this.dockState.set(next);
    this.dockChange.emit(next);
  }

  setActiveTab(id: string): void {
    this.activeTabId.set(id);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEsc(_ev: KeyboardEvent): void {
    if (this.open()) {
      this.setOpen(false);
    }
  }
}
```

- [ ] **Step 2: Replace the obsolete chat-debug spec body**

Replace `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { computeStateDiff } from './state-diff';
import type { DiffEntry } from './state-diff';
import { toDebugCheckpoint, extractStateValues } from './debug-utils';
import type { AgentCheckpoint } from '../../agent';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';
import { ChatDebugComponent } from './chat-debug.component';

// ── computeStateDiff (unchanged from previous spec) ────────────────────────

describe('computeStateDiff', () => {
  it('detects added keys', () => {
    const result = computeStateDiff({}, { name: 'Alice' });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'name', type: 'added', after: 'Alice' },
    ]);
  });
  it('detects removed keys', () => {
    const result = computeStateDiff({ name: 'Alice' }, {});
    expect(result).toEqual<DiffEntry[]>([
      { path: 'name', type: 'removed', before: 'Alice' },
    ]);
  });
  it('detects changed keys', () => {
    const result = computeStateDiff({ count: 1 }, { count: 2 });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'count', type: 'changed', before: 1, after: 2 },
    ]);
  });
  it('returns empty array when states are identical', () => {
    expect(computeStateDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it('recurses into nested objects', () => {
    const result = computeStateDiff(
      { config: { theme: 'light' } },
      { config: { theme: 'dark' } },
    );
    expect(result).toEqual<DiffEntry[]>([
      { path: 'config.theme', type: 'changed', before: 'light', after: 'dark' },
    ]);
  });
  it('treats array changes as a single changed entry', () => {
    const result = computeStateDiff({ items: [1] }, { items: [1, 2] });
    expect(result).toEqual<DiffEntry[]>([
      { path: 'items', type: 'changed', before: [1], after: [1, 2] },
    ]);
  });
});

// ── toDebugCheckpoint ──────────────────────────────────────────────────────

describe('toDebugCheckpoint', () => {
  it('uses label as node name when available', () => {
    const cp: AgentCheckpoint = { id: 'cp1', label: 'agent', values: {} };
    const result = toDebugCheckpoint(cp, 0);
    expect(result.node).toBe('agent');
    expect(result.checkpointId).toBe('cp1');
  });
  it('falls back to Step N when label is absent', () => {
    const cp: AgentCheckpoint = { values: {} };
    expect(toDebugCheckpoint(cp, 2).node).toBe('Step 3');
  });
});

// ── extractStateValues ─────────────────────────────────────────────────────

describe('extractStateValues', () => {
  it('returns empty object for undefined checkpoint', () => {
    expect(extractStateValues(undefined)).toEqual({});
  });
  it('extracts values from a AgentCheckpoint', () => {
    const cp: AgentCheckpoint = { values: { messages: [], count: 5 } };
    expect(extractStateValues(cp)).toEqual({ messages: [], count: 5 });
  });
});

// ── Defined-as-class smoke tests ──────────────────────────────────────────

describe('ChatDebugComponent', () => {
  it('is defined as a class', () => {
    expect(typeof ChatDebugComponent).toBe('function');
  });
});

describe('DebugCheckpointCardComponent', () => {
  it('is defined as a class', () => {
    expect(typeof DebugCheckpointCardComponent).toBe('function');
  });
});
```

- [ ] **Step 3: Run the lib's tests**

Run: `npx nx test chat`
Expected: All tests pass (existing + new).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts
git commit -m "feat(chat): rewrite chat-debug as floating devtools launcher"
```

---

## Task 11: Delete obsolete files + wire public-api exports

**Files:**
- Delete: `libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts`
- Delete: `libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts`
- Delete: `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts`
- Delete: `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts`
- Modify: `libs/chat/src/public-api.ts:75`

- [ ] **Step 1: Delete obsolete components**

```bash
git rm libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts \
       libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts \
       libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts \
       libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts
```

- [ ] **Step 2: Update public-api.ts**

Locate line 75 (`export { ChatDebugComponent } ...`) and replace with:

```ts
// chat-debug devtools
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export type { DockPosition } from './lib/compositions/chat-debug/chat-debug.component';
export { ChatDebugControlsDirective } from './lib/compositions/chat-debug/chat-debug-controls.directive';
export { ChatDebugInspectorDirective } from './lib/compositions/chat-debug/chat-debug-inspector.directive';
export { ChatDebugSectionComponent } from './lib/compositions/chat-debug/primitives/chat-debug-section.component';
export { ChatDebugSegmentedComponent } from './lib/compositions/chat-debug/primitives/chat-debug-segmented.component';
export type { SegmentedOption } from './lib/compositions/chat-debug/primitives/chat-debug-segmented.component';
export { ChatDebugSelectComponent } from './lib/compositions/chat-debug/primitives/chat-debug-select.component';
export type { SelectOption } from './lib/compositions/chat-debug/primitives/chat-debug-select.component';
export { ChatDebugToggleComponent } from './lib/compositions/chat-debug/primitives/chat-debug-toggle.component';
export { ChatDebugActionComponent } from './lib/compositions/chat-debug/primitives/chat-debug-action.component';
```

- [ ] **Step 3: Build the lib to catch any reference leaks**

Run: `npx nx build chat`
Expected: build succeeds.

If anything still imports the deleted files (e.g., `chat-timeline-slider`), grep and decide: if the importer is also part of the rewrite scope, remove that import. If unrelated, restore the file. Today's grep should only show the now-deleted `chat-debug.component.ts` consumers, which we just rewrote.

```bash
git grep -n 'debug-controls\|debug-summary\|debug-detail\|debug-timeline\.component' libs/chat/src
```

Expected: no matches.

- [ ] **Step 4: Run all chat lib tests**

Run: `npx nx test chat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): public-api exports for chat-debug devtools surface"
```

---

## Task 12: Smoke app migration — wire chat-debug, delete control-palette

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css`
- Delete: `examples/chat/angular/src/app/shell/control-palette.component.{ts,html,css,spec.ts}`
- Delete: `examples/chat/angular/src/app/shell/palette-persistence.service.{ts,spec.ts}`

- [ ] **Step 1: Update `demo-shell.component.ts` imports**

Find the imports array of `DemoShell`. Replace `ControlPalette` import with the chat-debug surface:

```ts
import {
  ChatDebugComponent,
  ChatDebugControlsDirective,
  ChatDebugSectionComponent,
  ChatDebugSegmentedComponent,
  ChatDebugSelectComponent,
  ChatDebugActionComponent,
} from '@ngaf/chat';
```

In the component's `imports: [...]` array, **remove** `ControlPalette` and **add**:

```ts
ChatDebugComponent,
ChatDebugControlsDirective,
ChatDebugSectionComponent,
ChatDebugSegmentedComponent,
ChatDebugSelectComponent,
ChatDebugActionComponent,
```

Also remove the `PalettePersistence` provider/usage if any exists in `DemoShell` (search for `PalettePersistence`). The component no longer needs `debugOpen` signal/state — `chat-debug` owns its own open state. Remove `debugOpen`, `onDebugChange`, and any related plumbing.

- [ ] **Step 2: Replace `<app-control-palette>` and `.demo-shell__debug` block in `demo-shell.component.html`**

Open `examples/chat/angular/src/app/shell/demo-shell.component.html`. Replace the entire `<app-control-palette ... />` block with the chat-debug usage. Also remove the `@if (debugOpen()) { <div class="demo-shell__debug"> ... </div> }` block at the bottom.

Final desired structure:

```html
<div class="demo-shell">
  <button
    type="button"
    class="demo-shell__hamburger"
    aria-label="Open conversations"
    [attr.aria-expanded]="drawerOpen()"
    (click)="toggleDrawer()"
  >☰</button>

  <chat-thread-drawer
    [open]="drawerOpen()"
    [mode]="drawerMode()"
    (openChange)="onDrawerOpenChange($event)"
  >
    <chat-thread-list
      [threads]="threadsSvc.threads()"
      [activeThreadId]="threadIdSignal() ?? ''"
      [showNewThreadButton]="true"
      (threadSelected)="onThreadSelected($event)"
      (newThreadRequested)="onNewThread()"
    />
  </chat-thread-drawer>

  <div
    class="demo-shell__main"
    [class.demo-shell__main--push]="drawerOpen() && drawerMode() === 'push'"
  >
    <router-outlet />
    @if (agent.interrupt && agent.interrupt()) {
      <div class="demo-shell__interrupt-panel" role="region" aria-label="Approval required">
        <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
      </div>
    }
    @if (agent.subagents && agent.subagents().size > 0) {
      <div class="demo-shell__subagents" role="region" aria-label="Active subagents">
        <chat-subagents [agent]="agent" />
      </div>
    }
  </div>

  <chat-debug
    [agent]="agent"
    dock="right"
    (replayRequested)="onTimelineReplay($event)"
    (forkRequested)="onTimelineFork($event)"
  >
    <ng-template chatDebugControls>
      <chat-debug-section label="Mode">
        <chat-debug-segmented
          [options]="modeOptions"
          [value]="mode()"
          (valueChange)="onModeChange($event)"
        />
      </chat-debug-section>
      <chat-debug-section label="Agent">
        <chat-debug-select
          label="Model"
          [options]="modelOptions()"
          [value]="model()"
          (valueChange)="onModelChange($event)"
        />
        <chat-debug-select
          label="Effort"
          [options]="effortOptions()"
          [value]="effort()"
          (valueChange)="onEffortChange($event)"
        />
        <chat-debug-select
          label="Gen UI"
          [options]="genUiOptions()"
          [value]="genUiMode()"
          (valueChange)="onGenUiModeChange($event)"
        />
      </chat-debug-section>
      <chat-debug-section label="Appearance">
        <chat-debug-select
          label="Theme"
          [options]="themeOptions()"
          [value]="theme()"
          (valueChange)="onThemeChange($event)"
        />
      </chat-debug-section>
      <chat-debug-section>
        <chat-debug-action label="New conversation" (clicked)="onNewConversation()" />
      </chat-debug-section>
    </ng-template>
  </chat-debug>
</div>
```

`modeOptions` is the array of `{value, label}` used by the segmented control. It currently lives in the control palette's HTML as inline `Embed/Popup/Sidebar` buttons. Move it to `DemoShell`:

```ts
protected readonly modeOptions = [
  { value: 'embed', label: 'Embed' },
  { value: 'popup', label: 'Popup' },
  { value: 'sidebar', label: 'Sidebar' },
] as const;
```

- [ ] **Step 3: Update `demo-shell.component.css`**

Remove the `.demo-shell__debug` rule block (lines that style the old bottom overlay). Leave the rest of the file unchanged.

- [ ] **Step 4: Delete obsolete control-palette + palette-persistence files**

```bash
git rm examples/chat/angular/src/app/shell/control-palette.component.ts \
       examples/chat/angular/src/app/shell/control-palette.component.html \
       examples/chat/angular/src/app/shell/control-palette.component.css \
       examples/chat/angular/src/app/shell/control-palette.component.spec.ts \
       examples/chat/angular/src/app/shell/palette-persistence.service.ts \
       examples/chat/angular/src/app/shell/palette-persistence.service.spec.ts
```

- [ ] **Step 5: Build the example app**

Run: `npx nx build examples-chat`
Expected: build succeeds. If TS complains about unused imports or missing `modeOptions`, fix the references in `demo-shell.component.ts`.

- [ ] **Step 6: Run example app tests**

Run: `npx nx test examples-chat`
Expected: PASS. If a spec referenced `ControlPalette` or `PalettePersistence`, remove the reference and let the spec exercise the new wiring (or drop the spec if it only existed to test the deleted unit).

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): migrate control palette into chat-debug devtools"
```

---

## Task 13: End-to-end smoke verification

**Files:** none (verification only)

- [ ] **Step 1: Run the example app locally**

Run: `npx nx serve examples-chat`
Expected: dev server starts on port 4200.

- [ ] **Step 2: Manually verify in the browser**

Open `http://localhost:4200/`. Confirm:

1. No legacy "Control Palette" floating widget in the top-right.
2. A small gear-icon launcher in the bottom-right corner.
3. Clicking the launcher opens a right-docked panel labelled "Chat Debug".
4. Inside, top to bottom: header with dock toggles + close, controls section (Mode / Agent / Appearance / New conversation), tab strip (Timeline / State), Timeline tab content.
5. Toggling Mode tabs (Embed / Popup / Sidebar) routes correctly.
6. Changing Model / Effort / Gen UI / Theme behaves as before.
7. "New conversation" starts a fresh thread.
8. Clicking the bottom dock icon (▭) moves the panel to a bottom dock. Refresh the page — it stays bottom. Click right dock (◨) to restore.
9. Press Escape inside the panel — it closes. Click the launcher again — it reopens, same tab, same dock.
10. Send a message, wait for streaming to complete. Switch to the **Timeline** tab — checkpoints appear. Click one — state diff appears inline. Press ↓/↑ — selection moves. Hover a selected row — Replay / Fork buttons appear.
11. Switch to **State** tab — JSON tree of the current agent state. Click Copy — clipboard receives the JSON.
12. The embed/popup/sidebar chat itself renders normally. No duplicate chat surface anywhere.

- [ ] **Step 3: Rebuild the smoke generator and run it**

In a separate terminal:

```bash
npx nx run examples-chat-smoke:run
```

Follow the prompts to create a fresh consumer in `~/tmp/ngaf-debug-smoke`, accept the latest `@ngaf/chat` version (or the locally linked version per the smoke flow), let it `npm install`, and start it. Confirm the same in-browser checks pass against the published-package consumer path.

- [ ] **Step 4: Done — no commit needed**

If everything passes, the implementation is complete.

---

## Out of scope (deferred)

- Drag-to-resize handles on the panel edges. Initial size is fixed (420px right/left, 40vh bottom); persistence wrapper already supports a future `size` key.
- Search filter inside the State tab.
- Detach-to-popup-window.
- Tests that mount Angular components against `TestBed` — the repo's existing chat-debug specs use vitest + pure-function tests because the library tests don't have a JIT compiler configured. New specs follow the same convention.
