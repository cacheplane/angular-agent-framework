# Chat Debug Shadcn Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin `<chat-debug>` to match the palette v2 design language: persistent dark shadcn-zinc surface, status-pill launcher with reactive streaming dot, mount animation, click-outside dismiss, sliding switch primitive, custom select trigger.

**Architecture:** Introduce a `--ngaf-chat-debug-*` token namespace (host-overridable, seeded with zinc-900 defaults) so the devtools chrome is theme-stable independent of the chat library's tokens. Swap every chat-debug component's token references in place. Replace the gear-icon launcher with a status pill that reads `agent.status()`. Replace `<chat-debug-toggle>` with `<chat-debug-switch>`.

**Tech Stack:** Angular 20 (signals, standalone, HostListener, OnPush), vitest + jsdom, `--ngaf-chat-*` token pattern (same idea, new namespace).

**Spec:** [docs/superpowers/specs/2026-05-11-chat-debug-shadcn-polish-design.md](../specs/2026-05-11-chat-debug-shadcn-polish-design.md)

**Working directory:** `/Users/blove/repos/angular-agent-framework/.claude/worktrees/determined-liskov-a706d3`

**To run tests:** `cd libs/chat && npx vitest run <pattern>` (the Nx wrapper `npx nx test chat` is misconfigured in this repo and gives misleading output).

---

## File map

**New**

- `libs/chat/src/lib/compositions/chat-debug/chat-debug-tokens.ts` — exports `CHAT_DEBUG_TOKENS` string for components to splice into their `styles` array.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-switch.component.ts` — sliding switch primitive.

**Modified**

- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` — token swap, status-pill launcher, mount animation, click-outside dismiss, drop the header green dot.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-section.component.ts` — token swap + label refinements.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-segmented.component.ts` — token swap + visual refresh.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts` — custom trigger redesign with invisible-overlay native select.
- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts` — token swap + visual refresh.
- `libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts` — drop toggle test, add switch test.
- `libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts` — token swap.
- `libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts` — token swap.
- `libs/chat/src/public-api.ts` — drop `ChatDebugToggleComponent`, add `ChatDebugSwitchComponent`.

**Deleted**

- `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts`

---

## Task 1: Define the `--ngaf-chat-debug-*` token namespace

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/chat-debug-tokens.ts`

- [ ] **Step 1: Create the tokens file**

```ts
// SPDX-License-Identifier: MIT

/**
 * Component-scoped CSS variables for the chat-debug devtools chrome.
 *
 * Imported into every chat-debug component / primitive's `styles` array
 * so the defaults are set on each `:host` element. Hosts override by
 * setting any token on `chat-debug` or any ancestor.
 *
 * Independent from `--ngaf-chat-*` (the chat library's theme tokens).
 * Devtools chrome stays dark regardless of host theme by default —
 * matches Chrome DevTools / React DevTools / Redux DevTools convention.
 *
 * Palette anchor: shadcn zinc-900 + accent blue.
 */
export const CHAT_DEBUG_TOKENS = `
  :host {
    --ngaf-chat-debug-bg: #18181b;
    --ngaf-chat-debug-bg-deep: #09090b;
    --ngaf-chat-debug-surface: #1f1f23;
    --ngaf-chat-debug-border: #27272a;
    --ngaf-chat-debug-border-strong: #3f3f46;
    --ngaf-chat-debug-text: #fafafa;
    --ngaf-chat-debug-text-muted: #a1a1aa;
    --ngaf-chat-debug-text-subtle: #71717a;
    --ngaf-chat-debug-accent: #4f8df5;
    --ngaf-chat-debug-success: #4ade80;
    --ngaf-chat-debug-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.5);
    --ngaf-chat-debug-shadow-pill: 0 6px 18px rgba(0, 0, 0, 0.4);
    --ngaf-chat-debug-radius-panel: 12px;
    --ngaf-chat-debug-radius-input: 8px;
    --ngaf-chat-debug-radius-pill: 999px;
    --ngaf-chat-debug-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --ngaf-chat-debug-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-family: var(--ngaf-chat-debug-font-sans);
    color: var(--ngaf-chat-debug-text);

    /*
     * Cascade shim: rewire the chat library's color tokens to debug
     * equivalents so embedded components that consume \`--ngaf-chat-*\`
     * (debug-checkpoint-card, debug-state-diff, debug-state-inspector,
     * any host-projected slot content) pick up the dark devtools surface
     * without each one needing its own re-skin. Geometry / font tokens
     * are left alone — they're neutral.
     */
    --ngaf-chat-bg: var(--ngaf-chat-debug-bg);
    --ngaf-chat-text: var(--ngaf-chat-debug-text);
    --ngaf-chat-text-muted: var(--ngaf-chat-debug-text-muted);
    --ngaf-chat-separator: var(--ngaf-chat-debug-border);
    --ngaf-chat-surface-alt: var(--ngaf-chat-debug-bg-deep);
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug-tokens.ts
git commit -m "feat(chat): chat-debug devtools token namespace"
```

---

## Task 2: `<chat-debug-switch>` primitive (replaces toggle)

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-switch.component.ts`

- [ ] **Step 1: Create the switch file**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ngaf-chat-space-3, 12px);
      font-size: 13px;
      color: var(--ngaf-chat-debug-text);
    }
    .switch {
      position: relative;
      width: 36px;
      height: 20px;
      background: var(--ngaf-chat-debug-border);
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      padding: 0;
      transition: background 150ms ease;
      flex-shrink: 0;
    }
    .switch.is-on { background: var(--ngaf-chat-debug-accent); }
    .switch__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: var(--ngaf-chat-debug-text);
      border-radius: 50%;
      transition: transform 150ms ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .switch.is-on .switch__thumb { transform: translateX(16px); }
    `,
  ],
  template: `
    <div class="row">
      <span>{{ label() }}</span>
      <button
        type="button"
        role="switch"
        class="switch"
        [class.is-on]="value()"
        [attr.aria-checked]="value()"
        [attr.aria-label]="label()"
        (click)="valueChange.emit(!value())"
      >
        <span class="switch__thumb"></span>
      </button>
    </div>
  `,
})
export class ChatDebugSwitchComponent {
  readonly label = input.required<string>();
  readonly value = input.required<boolean>();
  readonly valueChange = output<boolean>();
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-switch.component.ts
git commit -m "feat(chat): chat-debug-switch primitive (sliding shadcn switch)"
```

---

## Task 3: Remove `<chat-debug-toggle>` + update public-api + primitives spec

**Files:**
- Delete: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts`
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts`

- [ ] **Step 1: Delete the toggle file**

```bash
git rm libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts
```

- [ ] **Step 2: Update public-api.ts**

Open `libs/chat/src/public-api.ts`. Find the line:

```ts
export { ChatDebugToggleComponent } from './lib/compositions/chat-debug/primitives/chat-debug-toggle.component';
```

Replace it with:

```ts
export { ChatDebugSwitchComponent } from './lib/compositions/chat-debug/primitives/chat-debug-switch.component';
```

- [ ] **Step 3: Update primitives.spec.ts**

Open `libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts`. Replace the entire file contents with:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { ChatDebugSectionComponent } from './chat-debug-section.component';
import { ChatDebugSegmentedComponent } from './chat-debug-segmented.component';
import { ChatDebugSelectComponent } from './chat-debug-select.component';
import { ChatDebugSwitchComponent } from './chat-debug-switch.component';
import { ChatDebugActionComponent } from './chat-debug-action.component';

describe('chat-debug primitives are defined', () => {
  it('section', () => { expect(typeof ChatDebugSectionComponent).toBe('function'); });
  it('segmented', () => { expect(typeof ChatDebugSegmentedComponent).toBe('function'); });
  it('select', () => { expect(typeof ChatDebugSelectComponent).toBe('function'); });
  it('switch', () => { expect(typeof ChatDebugSwitchComponent).toBe('function'); });
  it('action', () => { expect(typeof ChatDebugActionComponent).toBe('function'); });
});
```

- [ ] **Step 4: Run primitives spec**

```bash
cd libs/chat && npx vitest run primitives.spec
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/public-api.ts libs/chat/src/lib/compositions/chat-debug/primitives/primitives.spec.ts libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-toggle.component.ts
git commit -m "feat(chat): swap chat-debug-toggle for chat-debug-switch in public surface"
```

---

## Task 4: Re-skin `<chat-debug-section>` to debug tokens

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-section.component.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host {
      display: block;
      padding: 14px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
    }
    :host:last-child { border-bottom: 0; }
    .section__label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ngaf-chat-debug-text-subtle);
      margin: 0 0 10px;
    }
    .section__body { display: flex; flex-direction: column; gap: 10px; }
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
git commit -m "feat(chat): re-skin chat-debug-section to debug tokens"
```

---

## Task 5: Re-skin `<chat-debug-segmented>` to debug tokens

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-segmented.component.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    .segmented {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: var(--ngaf-chat-debug-radius-input);
      padding: 3px;
      gap: 0;
    }
    .segmented__btn {
      flex: 1;
      appearance: none;
      background: transparent;
      border: 0;
      color: var(--ngaf-chat-debug-text-muted);
      padding: 6px 8px;
      border-radius: 5px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .segmented__btn:hover:not(.is-active) {
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
    }
    .segmented__btn.is-active {
      background: var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
      font-weight: 500;
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
git commit -m "feat(chat): re-skin chat-debug-segmented to debug tokens"
```

---

## Task 6: Re-skin `<chat-debug-select>` with custom trigger

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts`

The native chevron is replaced with palette v2's trigger pattern: a visible styled face + an invisible native `<select>` overlay that captures clicks and keyboard input.

- [ ] **Step 1: Replace the file contents**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'chat-debug-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      color: var(--ngaf-chat-debug-text);
    }
    .select {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 140px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: var(--ngaf-chat-debug-text);
      cursor: pointer;
    }
    .select:hover { background: #0f0f12; }
    .select:focus-within {
      border-color: var(--ngaf-chat-debug-accent);
      outline: 2px solid color-mix(in srgb, var(--ngaf-chat-debug-accent) 30%, transparent);
      outline-offset: 1px;
    }
    .select__value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .select__caret {
      color: var(--ngaf-chat-debug-text-subtle);
      font-size: 10px;
      line-height: 1;
    }
    .select select {
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
    `,
  ],
  template: `
    <label class="row">
      <span>{{ label() }}</span>
      <span class="select">
        <span class="select__value">{{ currentLabel() }}</span>
        <span class="select__caret" aria-hidden="true">▾</span>
        <select
          [value]="value()"
          (change)="onChange($event)"
          [attr.aria-label]="label()"
        >
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
          }
        </select>
      </span>
    </label>
  `,
})
export class ChatDebugSelectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  protected readonly currentLabel = computed((): string => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? v;
  });

  protected onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-select.component.ts
git commit -m "feat(chat): re-skin chat-debug-select with custom trigger + overlay native select"
```

---

## Task 7: Re-skin `<chat-debug-action>` to debug tokens

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';

@Component({
  selector: 'chat-debug-action',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: block; }
    button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
      border: 1px solid var(--ngaf-chat-debug-border-strong);
      border-radius: var(--ngaf-chat-debug-radius-input);
      padding: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease, transform 80ms ease;
    }
    button:hover { background: var(--ngaf-chat-debug-surface); }
    button:active { transform: translateY(1px); }
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

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/primitives/chat-debug-action.component.ts
git commit -m "feat(chat): re-skin chat-debug-action to debug tokens"
```

---

## Task 8: Re-skin Timeline inspector to debug tokens

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts`

This task only changes the `styles` block and adds the tokens import; the template, class, and `stepSelection` function are unchanged.

- [ ] **Step 1: Read the current file**

```bash
head -1 libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts
```

This task assumes the file currently imports `CHAT_HOST_TOKENS` from `'../../../styles/chat-tokens'`. If it does not, look at the actual import and adjust the Edit accordingly.

- [ ] **Step 2: Edit the import line**

Change:
```ts
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';
```

To:
```ts
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';
```

- [ ] **Step 3: Edit the styles array — replace the `styles: [...]` block in full**

```ts
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: flex; flex-direction: column; height: 100%; outline: none; }
    .timeline__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ngaf-chat-debug-text-subtle);
      background: var(--ngaf-chat-debug-bg);
    }
    .timeline__count { display: inline-flex; align-items: center; gap: 6px; }
    .timeline__count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9px;
      background: var(--ngaf-chat-debug-surface);
      border: 1px solid var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      font-variant-numeric: tabular-nums;
    }
    .timeline__clear {
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--ngaf-chat-debug-text-subtle);
      font: inherit;
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
      padding: 2px 6px;
      border-radius: 6px;
      transition: color 120ms ease, background 120ms ease;
    }
    .timeline__clear:hover:not(:disabled) {
      color: var(--ngaf-chat-debug-text);
      background: var(--ngaf-chat-debug-surface);
    }
    .timeline__clear:disabled { opacity: 0.4; cursor: default; }
    .timeline__list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--ngaf-chat-debug-bg);
    }
    .timeline__empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--ngaf-chat-debug-text-subtle);
      font-size: 13px;
    }
    .timeline__row { display: flex; flex-direction: column; gap: 8px; }
    .timeline__row-actions {
      display: none;
      gap: 8px;
      padding-left: 12px;
    }
    .timeline__row:hover .timeline__row-actions { display: flex; }
    .timeline__row button.row-action {
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
      padding: 3px 8px;
      font: inherit;
      font-size: 11px;
      color: var(--ngaf-chat-debug-text-muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
    }
    .timeline__row button.row-action:hover {
      color: var(--ngaf-chat-debug-text);
      border-color: var(--ngaf-chat-debug-border-strong);
    }
    .timeline__diff {
      padding: 12px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: var(--ngaf-chat-debug-radius-input);
      color: var(--ngaf-chat-debug-text);
    }
    `,
  ],
```

- [ ] **Step 4: Run the timeline spec**

```bash
cd libs/chat && npx vitest run timeline-inspector.spec
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/inspectors/timeline-inspector.component.ts
git commit -m "feat(chat): re-skin timeline inspector to debug tokens"
```

---

## Task 9: Re-skin State inspector to debug tokens

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts`

- [ ] **Step 1: Edit the import**

Change:
```ts
import { CHAT_HOST_TOKENS } from '../../../styles/chat-tokens';
```

To:
```ts
import { CHAT_DEBUG_TOKENS } from '../chat-debug-tokens';
```

- [ ] **Step 2: Replace the styles array**

```ts
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: flex; flex-direction: column; height: 100%; background: var(--ngaf-chat-debug-bg); }
    .state__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      background: var(--ngaf-chat-debug-bg);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ngaf-chat-debug-text-subtle);
    }
    .state__copy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
      padding: 3px 8px;
      font: inherit;
      font-size: 11px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--ngaf-chat-debug-text-muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
    }
    .state__copy:hover {
      color: var(--ngaf-chat-debug-text);
      border-color: var(--ngaf-chat-debug-border-strong);
    }
    .state__copy.is-copied {
      color: var(--ngaf-chat-debug-success);
      border-color: var(--ngaf-chat-debug-success);
    }
    .state__copy svg { display: block; }
    .state__body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      color: var(--ngaf-chat-debug-text);
    }
    `,
  ],
```

The template (header label, Copy button with copy/check icon swap, body with the existing `<chat-debug-state-inspector>` projection) and class are unchanged.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/inspectors/state-inspector.component.ts
git commit -m "feat(chat): re-skin state inspector to debug tokens"
```

---

## Task 10: Rewrite `<chat-debug>` chrome — pill launcher + dark panel + mount animation + click-outside

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`

This is the largest task. It does three things at once:
1. Token swap (all `--ngaf-chat-*` → `--ngaf-chat-debug-*`).
2. Replaces the gear-icon launcher with a status pill driven by `agent.status()`.
3. Adds mount animation (`@keyframes`) and click-outside dismiss (new `HostListener`).

The existing imports of `ICON_TOOL`, `DomSanitizer`, and `SafeHtml` become unused — remove them.

- [ ] **Step 1: Replace the imports block at the top of the file**

Find the existing imports (lines 1-25 or so). Replace **just the import block** with:

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  contentChild,
  contentChildren,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentWithHistory } from '../../agent';
import { CHAT_DEBUG_TOKENS } from './chat-debug-tokens';
import { ChatDebugControlsDirective } from './chat-debug-controls.directive';
import { ChatDebugInspectorDirective } from './chat-debug-inspector.directive';
import { TimelineInspectorComponent } from './inspectors/timeline-inspector.component';
import { StateInspectorComponent } from './inspectors/state-inspector.component';
import { createPersistence } from './persistence';
```

(`DomSanitizer`, `SafeHtml`, `ICON_TOOL`, and `CHAT_HOST_TOKENS` are deleted.)

- [ ] **Step 2: Replace the `styles: [...]` array in full**

The entire `styles: [CHAT_HOST_TOKENS, \`...\`]` block goes away. Replace with:

```ts
  styles: [
    CHAT_DEBUG_TOKENS,
    `
    :host { display: contents; }

    /* ── Status pill launcher ─────────────────────────────────────── */
    .launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--ngaf-chat-debug-radius-pill);
      background: var(--ngaf-chat-debug-bg);
      border: 1px solid var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
      cursor: pointer;
      z-index: 990;
      box-shadow: var(--ngaf-chat-debug-shadow-pill);
      transition: background 120ms ease, border-color 120ms ease;
      padding: 0;
    }
    .launcher:hover {
      background: var(--ngaf-chat-debug-surface);
      border-color: var(--ngaf-chat-debug-border-strong);
    }
    .launcher__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ngaf-chat-debug-success);
      box-shadow: 0 0 8px color-mix(in srgb, var(--ngaf-chat-debug-success) 60%, transparent);
    }
    .launcher__dot--streaming {
      background: var(--ngaf-chat-debug-accent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--ngaf-chat-debug-accent) 70%, transparent);
      animation: chat-debug-pill-pulse 1.2s ease-in-out infinite;
    }
    @keyframes chat-debug-pill-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.6; transform: scale(0.85); }
    }

    /* ── Docked panel ─────────────────────────────────────────────── */
    .panel {
      position: fixed;
      background: var(--ngaf-chat-debug-bg);
      color: var(--ngaf-chat-debug-text);
      border: 1px solid var(--ngaf-chat-debug-border);
      z-index: 991;
      display: flex;
      flex-direction: column;
      box-shadow: var(--ngaf-chat-debug-shadow-panel);
      animation: chat-debug-panel-enter 120ms ease;
    }
    .panel--right {
      top: 0; right: 0; bottom: 0;
      width: var(--panel-size, 420px);
      border-right: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-bottom-left-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
    }
    .panel--left {
      top: 0; left: 0; bottom: 0;
      width: var(--panel-size, 420px);
      border-left: 0;
      border-top-right-radius: var(--ngaf-chat-debug-radius-panel);
      border-bottom-right-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom left;
    }
    .panel--bottom {
      left: 0; right: 0; bottom: 0;
      height: var(--panel-size, 40vh);
      border-bottom: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-top-right-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
    }
    @keyframes chat-debug-panel-enter {
      from { opacity: 0; transform: scale(0.96); }
      to   { opacity: 1; transform: scale(1); }
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      min-height: 44px;
      box-sizing: border-box;
    }
    .panel__title {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--ngaf-chat-debug-text);
    }
    .panel__actions { display: flex; align-items: center; gap: 4px; }

    .panel__dock-group {
      display: inline-flex;
      gap: 0;
      padding: 2px;
      background: var(--ngaf-chat-debug-bg-deep);
      border: 1px solid var(--ngaf-chat-debug-border);
      border-radius: 6px;
    }
    .panel__dock-btn {
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 4px;
      width: 24px;
      height: 22px;
      padding: 0;
      color: var(--ngaf-chat-debug-text-subtle);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .panel__dock-btn:hover { color: var(--ngaf-chat-debug-text); }
    .panel__dock-btn.is-active {
      background: var(--ngaf-chat-debug-border);
      color: var(--ngaf-chat-debug-text);
    }
    .panel__dock-btn svg { display: block; }

    .panel__close {
      appearance: none;
      background: transparent;
      border: 0;
      border-radius: 6px;
      width: 26px;
      height: 26px;
      margin-left: 4px;
      color: var(--ngaf-chat-debug-text-subtle);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .panel__close:hover {
      background: var(--ngaf-chat-debug-surface);
      color: var(--ngaf-chat-debug-text);
    }

    .panel__controls {
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      overflow-y: auto;
      max-height: 50%;
      background: var(--ngaf-chat-debug-bg);
    }
    .panel__controls:empty { display: none; }

    .panel__tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--ngaf-chat-debug-border);
      padding: 0 12px;
      background: var(--ngaf-chat-debug-bg);
    }
    .panel__tab {
      appearance: none;
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: 10px 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      color: var(--ngaf-chat-debug-text-muted);
      cursor: pointer;
      transition: color 120ms ease, border-color 120ms ease;
      margin-bottom: -1px;
    }
    .panel__tab:hover { color: var(--ngaf-chat-debug-text); }
    .panel__tab.is-active {
      color: var(--ngaf-chat-debug-text);
      border-bottom-color: var(--ngaf-chat-debug-accent);
    }

    .panel__body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--ngaf-chat-debug-bg); }
    `,
  ],
```

- [ ] **Step 3: Replace the `template: \`...\`` block in full**

```ts
  template: `
    @if (!open()) {
      <button
        type="button"
        #launcherEl
        class="launcher"
        title="Open chat debug"
        aria-label="Open chat debug"
        [attr.aria-pressed]="false"
        (click)="setOpen(true)"
      >
        <span
          class="launcher__dot"
          [class.launcher__dot--streaming]="isStreaming()"
          aria-hidden="true"
        ></span>
      </button>
    } @else {
      <div
        #panelEl
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
            <div class="panel__dock-group" role="group" aria-label="Dock position">
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'left'"
                (click)="setDock('left')"
                aria-label="Dock left">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="5.5" y1="2.5" x2="5.5" y2="11.5"/></svg>
              </button>
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'bottom'"
                (click)="setDock('bottom')"
                aria-label="Dock bottom">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="1.5" y1="8.5" x2="12.5" y2="8.5"/></svg>
              </button>
              <button type="button" class="panel__dock-btn"
                [class.is-active]="dockState() === 'right'"
                (click)="setDock('right')"
                aria-label="Dock right">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="11" height="9" rx="1.2"/><line x1="8.5" y1="2.5" x2="8.5" y2="11.5"/></svg>
              </button>
            </div>
            <button type="button" class="panel__close" (click)="setOpen(false)" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>
            </button>
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
```

- [ ] **Step 4: Replace the class body**

Find the existing `export class ChatDebugComponent { ... }` block. The fields and methods stay mostly the same; what changes is:
- Drop the `sanitizer` / `launcherIcon` fields (gear icon is gone).
- Add `isStreaming` computed.
- Replace the `@HostListener('document:keydown.escape', ...)` block with a combined handler that also catches outside clicks.
- Add `viewChild` refs for the launcher and panel elements so the click-outside check can match against them.

Replace the entire class body (between `export class ChatDebugComponent {` and the final `}`) with:

```ts
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
  protected readonly dockState = signal<DockPosition>('right');
  protected readonly activeTabId = signal<string>('timeline');

  /** Reads `agent.status()` reactively for the launcher dot. */
  protected readonly isStreaming = computed(() => {
    const status = this.agent().status?.();
    return status === 'running';
  });

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

  private readonly hostEl: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    // Restore once from storage on construction; inputs seed the fallback.
    // `storageKey` is read-once: rebinding it at runtime is not supported.
    const restore = createPersistence(this.storageKey());
    const persistedOpen = restore.read<boolean>('open');
    this.open.set(persistedOpen ?? this.defaultOpen());
    const persistedDock = restore.read<DockPosition>('dock');
    this.dockState.set(persistedDock ?? this.dock());
    const persistedTab = restore.read<string>('tab');
    if (persistedTab) this.activeTabId.set(persistedTab);

    // Write-through effect — reads each writable signal so subsequent
    // changes trigger a fresh run that writes them all to storage.
    effect(() => {
      const p = createPersistence(this.storageKey());
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

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.setOpen(false);
  }

  /**
   * Click-outside dismiss. When the panel is open, any click whose
   * composed path doesn't include our host element closes the panel.
   * Capture phase so we react before host handlers swallow the event.
   */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const path = event.composedPath();
    if (path.includes(this.hostEl.nativeElement)) return;
    this.setOpen(false);
  }
```

- [ ] **Step 5: Run all chat-debug tests**

```bash
cd libs/chat && npx vitest run chat-debug
```
Expected: PASS, 30+ tests (chat-debug.component.spec, persistence.spec, primitives.spec, timeline-inspector.spec).

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts
git commit -m "feat(chat): chat-debug shadcn chrome — pill launcher + dark panel + mount + click-outside"
```

---

## Task 11: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Build the chat lib**

```bash
npx nx build chat
```
Expected: succeeds.

- [ ] **Step 2: Build the example app**

```bash
npx nx build examples-chat-angular
```
Expected: succeeds.

- [ ] **Step 3: Run lint on chat**

```bash
npx nx lint chat --skip-nx-cache
```
Expected: "Successfully ran target lint for project chat" (warnings are OK; no errors).

- [ ] **Step 4: Regenerate website API docs** (the new switch primitive changes the surface)

```bash
npm run generate-api-docs
```

If `apps/website/content/docs/chat/api/api-docs.json` is now different from HEAD, stage it. If unchanged, skip the commit.

- [ ] **Step 5: Commit (only if api-docs.json changed)**

```bash
git diff --quiet apps/website/content/docs/chat/api/api-docs.json || {
  git add apps/website/content/docs/chat/api/api-docs.json
  git commit -m "docs(website): regen api-docs for chat-debug switch primitive"
}
```

---

## Task 12: End-to-end browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server on port 4201**

```bash
npx nx serve examples-chat-angular --port=4201
```

(Run in a separate terminal or background. Wait for "Application bundle generation complete".)

- [ ] **Step 2: Open and verify in the browser**

Navigate to `http://localhost:4201/embed`. Confirm:

1. Bottom-right shows a small dark zinc-900 pill with a green dot — not the old gear circle.
2. Hover the pill: background lifts to a slightly lighter zinc.
3. Click the pill: dark panel appears with a brief scale+fade mount animation, docked on the right.
4. Panel background is `#18181b` (zinc-900), borders are `#27272a`, title is `Chat Debug` in white.
5. Header dock toggles render as a sunken segmented group in `#09090b`; active dock toggle is lifted to `#27272a`.
6. Controls zone has Mode segmented / Agent + Appearance selects (custom trigger, not native chevron) / New conversation action button.
7. Selects: clicking opens the native OS dropdown overlay; selecting an option updates the visible trigger label.
8. Tab strip: Timeline / State, blue (`#4f8df5`) underline on active.
9. Click anywhere outside the panel → it closes.
10. Click the pill again → it reopens, same dock + tab from persistence.
11. Esc closes the panel.
12. Send a chat message. While the agent is streaming, the pill's dot turns blue and pulses. When idle, it's back to green.
13. State tab Copy button uses the new dark chrome; the success state shows the green check + "Copied" with a green border.

- [ ] **Step 3: Stop the dev server** (Ctrl-C the foreground process or send SIGTERM to the background one).

- [ ] **Step 4: Done — no commit needed**

If everything passes, the implementation is complete.

---

## Out of scope (deferred)

- Model / mode text content in the launcher pill. The pill currently shows just the dot. Adding text content requires host-supplied data; defer until the use case is concrete.
- A documented page for `--ngaf-chat-debug-*` tokens on the website. Inline comment in `chat-debug-tokens.ts` is sufficient.
- TestBed-mounted specs for the new chrome. The existing chat-debug specs are pure-function + defined-as-class — matching the lib's convention.
- Resize handles on the panel edges. Persistence wrapper supports a size key; UI not implemented.
