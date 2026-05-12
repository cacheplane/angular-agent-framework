# Chat row actions — Phase 3a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-thread-row Rename + Delete actions in `@ngaf/chat` — hover-revealed kebab opens an overflow menu, Rename morphs the row into an inline input, Delete opens a destructive-toned confirm dialog. Adapter-driven (consumer-provided `ThreadActionAdapter`), framework owns optimistic UI + rollback.

**Architecture:** Two reusable primitives (`chat-overflow-menu`, `chat-confirm-dialog`) plus extended `chat-thread-list`. Adapter shape is a single object input with optional `delete?` and `rename?` async methods. Menu items derive from which adapter methods are provided — no method = no menu item = no kebab.

**Tech Stack:** Angular 21 standalone components, signal inputs/outputs, plain CSS strings under `libs/chat/src/lib/styles/`, Vitest + Angular TestBed.

**Spec:** [docs/superpowers/specs/2026-05-12-chat-row-actions-design.md](../specs/2026-05-12-chat-row-actions-design.md)

---

## File map

**Create:**
- `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.ts`
- `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.spec.ts`
- `libs/chat/src/lib/styles/chat-overflow-menu.styles.ts`
- `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.ts`
- `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.spec.ts`
- `libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts`

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — types + adapter input + state + optimistic flows
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` — additions (keep existing tests intact)
- `libs/chat/src/lib/styles/chat-thread-list.styles.ts` — kebab + edit-input styles
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — pass-through `actions` input
- `libs/chat/src/public-api.ts` — export new primitives + types
- `examples/chat/angular/src/app/shell/threads.service.ts` — adds `delete()` + `rename()`
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — defines `threadActions`
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — adds `[actions]="threadActions"`
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated

---

## Task 1: `chat-overflow-menu` styles

**Files:**
- Create: `libs/chat/src/lib/styles/chat-overflow-menu.styles.ts`

- [ ] **Step 1: Create the styles file**

Create `libs/chat/src/lib/styles/chat-overflow-menu.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-overflow-menu.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_OVERFLOW_MENU_STYLES = `
  :host { display: contents; }
  .chat-overflow-menu__scrim {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 59;
    border: 0;
    padding: 0;
    cursor: default;
  }
  .chat-overflow-menu {
    position: fixed;
    z-index: 60;
    min-width: 160px;
    padding: 4px;
    margin: 0;
    list-style: none;
    background: var(--ngaf-chat-bg);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
  .chat-overflow-menu__item {
    display: block;
    padding: 8px 12px;
    border-radius: 4px;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
    user-select: none;
  }
  .chat-overflow-menu__item:hover {
    background: var(--ngaf-chat-surface-alt);
  }
  .chat-overflow-menu__item:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: -2px;
  }
  .chat-overflow-menu__item--destructive {
    color: var(--ngaf-chat-error-text);
  }
  .chat-overflow-menu__item--disabled {
    color: var(--ngaf-chat-text-muted);
    cursor: not-allowed;
    pointer-events: none;
  }
`;
```

- [ ] **Step 2: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-overflow-menu.styles.ts
git commit -m "feat(chat): chat-overflow-menu styles"
```

---

## Task 2: `chat-overflow-menu` component (TDD)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.ts`

- [ ] **Step 1: Write the failing spec**

Create `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatOverflowMenuComponent, type OverflowMenuItem } from './chat-overflow-menu.component';

function render(opts: { open?: boolean; items?: OverflowMenuItem[] } = {}) {
  const fixture = TestBed.createComponent(ChatOverflowMenuComponent);
  fixture.componentRef.setInput('open', opts.open ?? true);
  if (opts.items !== undefined) fixture.componentRef.setInput('items', opts.items);
  fixture.detectChanges();
  return fixture;
}

describe('ChatOverflowMenuComponent', () => {
  it('renders nothing when open is false', () => {
    const fixture = render({ open: false, items: [{ id: 'a', label: 'A' }] });
    expect(fixture.nativeElement.querySelector('.chat-overflow-menu')).toBeNull();
  });

  it('renders items list when open is true', () => {
    const fixture = render({
      items: [
        { id: 'rename', label: 'Rename' },
        { id: 'delete', label: 'Delete', tone: 'destructive' },
      ],
    });
    const items = fixture.nativeElement.querySelectorAll('.chat-overflow-menu__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent.trim()).toBe('Rename');
    expect(items[1].textContent.trim()).toBe('Delete');
  });

  it('applies destructive class to destructive-tone items', () => {
    const fixture = render({ items: [{ id: 'd', label: 'D', tone: 'destructive' }] });
    const item = fixture.nativeElement.querySelector('.chat-overflow-menu__item');
    expect(item.classList.contains('chat-overflow-menu__item--destructive')).toBe(true);
  });

  it('applies disabled class and aria-disabled to disabled items', () => {
    const fixture = render({ items: [{ id: 'x', label: 'X', disabled: true }] });
    const item = fixture.nativeElement.querySelector('.chat-overflow-menu__item');
    expect(item.classList.contains('chat-overflow-menu__item--disabled')).toBe(true);
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });

  it('item click emits itemSelected and closed', () => {
    const fixture = render({ items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    let selected: string | undefined;
    let closes = 0;
    fixture.componentInstance.itemSelected.subscribe((id: string) => { selected = id; });
    fixture.componentInstance.closed.subscribe(() => { closes++; });
    const items = fixture.nativeElement.querySelectorAll('.chat-overflow-menu__item');
    (items[1] as HTMLElement).click();
    expect(selected).toBe('b');
    expect(closes).toBe(1);
  });

  it('disabled item click is a no-op', () => {
    const fixture = render({ items: [{ id: 'x', label: 'X', disabled: true }] });
    let emits = 0;
    fixture.componentInstance.itemSelected.subscribe(() => { emits++; });
    fixture.componentInstance.closed.subscribe(() => { emits++; });
    (fixture.nativeElement.querySelector('.chat-overflow-menu__item') as HTMLElement).click();
    expect(emits).toBe(0);
  });

  it('scrim click emits closed', () => {
    const fixture = render({ items: [{ id: 'a', label: 'A' }] });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => { closes++; });
    (fixture.nativeElement.querySelector('.chat-overflow-menu__scrim') as HTMLElement).click();
    expect(closes).toBe(1);
  });

  it('Esc on the menu emits closed', () => {
    const fixture = render({ items: [{ id: 'a', label: 'A' }] });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => { closes++; });
    const menu = fixture.nativeElement.querySelector('.chat-overflow-menu');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closes).toBe(1);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx nx run chat:test 2>&1 | grep -E "chat-overflow-menu|FAIL" | head -5`
Expected: FAIL (component does not exist yet).

- [ ] **Step 3: Create the component**

Create `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_OVERFLOW_MENU_STYLES } from '../../styles/chat-overflow-menu.styles';

export interface OverflowMenuItem {
  /** Stable id emitted via (itemSelected). */
  id: string;
  label: string;
  /** 'destructive' renders the label in red. Default 'normal'. */
  tone?: 'normal' | 'destructive';
  /** Disabled items render muted and ignore clicks/keypresses. */
  disabled?: boolean;
}

@Component({
  selector: 'chat-overflow-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_OVERFLOW_MENU_STYLES],
  template: `
    @if (open()) {
      <button
        type="button"
        class="chat-overflow-menu__scrim"
        aria-label="Close menu"
        (click)="closed.emit()"
      ></button>
      <ul
        class="chat-overflow-menu"
        role="menu"
        [style.top.px]="position().top"
        [style.left.px]="position().left"
        (keydown)="onMenuKeydown($event)"
      >
        @for (item of items(); track item.id) {
          <li
            role="menuitem"
            class="chat-overflow-menu__item"
            [class.chat-overflow-menu__item--destructive]="item.tone === 'destructive'"
            [class.chat-overflow-menu__item--disabled]="item.disabled"
            [attr.aria-disabled]="item.disabled ? 'true' : null"
            [attr.tabindex]="item.disabled ? -1 : 0"
            (click)="onItemClick(item)"
            (keydown.enter)="onItemClick(item)"
            (keydown.space)="onItemClick(item)"
          >
            {{ item.label }}
          </li>
        }
      </ul>
    }
  `,
})
export class ChatOverflowMenuComponent {
  readonly open = input<boolean>(false);
  readonly items = input<OverflowMenuItem[]>([]);
  /** Element the menu anchors against (positions just below its bottom-right corner). */
  readonly anchor = input<HTMLElement | null>(null);
  readonly itemSelected = output<string>();
  readonly closed = output<void>();

  protected readonly position = computed<{ top: number; left: number }>(() => {
    if (!this.open()) return { top: 0, left: 0 };
    const el = this.anchor();
    if (!el) {
      // Center fallback when no anchor.
      const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
      const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
      return { top: Math.max(vh / 3, 0), left: Math.max(vw / 2 - 80, 0) };
    }
    const rect = el.getBoundingClientRect();
    // Position just below the anchor's bottom-right, with menu width 160.
    return { top: rect.bottom + 4, left: Math.max(rect.right - 160, 8) };
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      // Focus the first enabled item on open.
      queueMicrotask(() => {
        const root = document.querySelector('.chat-overflow-menu');
        const first = root?.querySelector<HTMLElement>('.chat-overflow-menu__item:not(.chat-overflow-menu__item--disabled)');
        first?.focus();
      });
    });
  }

  protected onItemClick(item: OverflowMenuItem): void {
    if (item.disabled) return;
    this.itemSelected.emit(item.id);
    this.closed.emit();
  }

  protected onMenuKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closed.emit();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const root = (e.currentTarget as HTMLElement);
      const items = Array.from(root.querySelectorAll<HTMLElement>('.chat-overflow-menu__item:not(.chat-overflow-menu__item--disabled)'));
      if (items.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const idx = current ? items.indexOf(current) : -1;
      const next = e.key === 'ArrowDown'
        ? Math.min((idx < 0 ? 0 : idx + 1), items.length - 1)
        : Math.max(idx - 1, 0);
      items[next]?.focus();
    }
  }
}
```

- [ ] **Step 4: Run, confirm PASS**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: PASS (existing + 8 new).

- [ ] **Step 5: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -5`
Expected: build PASS, lint with no errors.

If lint flags `interactive-supports-focus` on the `<li role="menuitem">`, the `[attr.tabindex]` binding makes it focusable — that should satisfy. If lint still complains, add a static `tabindex="0"` attribute on the element (it'll be overridden by the binding when item.disabled is true).

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-overflow-menu
git commit -m "feat(chat): chat-overflow-menu primitive"
```

---

## Task 3: `chat-confirm-dialog` styles

**Files:**
- Create: `libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts`

- [ ] **Step 1: Create the styles file**

Create `libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_CONFIRM_DIALOG_STYLES = `
  :host { display: contents; }
  .chat-confirm-dialog__scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 70;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .chat-confirm-dialog {
    position: fixed;
    top: 30vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 90vw);
    z-index: 71;
    padding: 20px;
    background: var(--ngaf-chat-bg);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  }
  .chat-confirm-dialog__title {
    margin: 0 0 8px 0;
    color: var(--ngaf-chat-text);
    font-size: 1.125rem;
    font-weight: 600;
  }
  .chat-confirm-dialog__body {
    margin: 0 0 16px 0;
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-sm);
    line-height: 1.5;
  }
  .chat-confirm-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .chat-confirm-dialog__cancel,
  .chat-confirm-dialog__confirm {
    padding: 8px 16px;
    border-radius: 6px;
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    cursor: pointer;
    border: 1px solid var(--ngaf-chat-separator);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
  }
  .chat-confirm-dialog__cancel:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-confirm-dialog__confirm {
    background: var(--ngaf-chat-text);
    color: var(--ngaf-chat-bg);
    border-color: transparent;
  }
  .chat-confirm-dialog__confirm--destructive {
    background: var(--ngaf-chat-error-text);
    color: #fff;
  }
  .chat-confirm-dialog__cancel:focus-visible,
  .chat-confirm-dialog__confirm:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
`;
```

- [ ] **Step 2: Build + commit**

```bash
npx nx run chat:build && git add libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts && git commit -m "feat(chat): chat-confirm-dialog styles"
```

---

## Task 4: `chat-confirm-dialog` component (TDD)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.ts`

- [ ] **Step 1: Write the failing spec**

Create `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatConfirmDialogComponent } from './chat-confirm-dialog.component';

function render(opts: {
  open?: boolean;
  title?: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'destructive' | 'normal';
} = {}) {
  const fixture = TestBed.createComponent(ChatConfirmDialogComponent);
  fixture.componentRef.setInput('open', opts.open ?? true);
  if (opts.title !== undefined) fixture.componentRef.setInput('title', opts.title);
  if (opts.body !== undefined) fixture.componentRef.setInput('body', opts.body);
  if (opts.confirmLabel !== undefined) fixture.componentRef.setInput('confirmLabel', opts.confirmLabel);
  if (opts.cancelLabel !== undefined) fixture.componentRef.setInput('cancelLabel', opts.cancelLabel);
  if (opts.tone !== undefined) fixture.componentRef.setInput('tone', opts.tone);
  fixture.detectChanges();
  return fixture;
}

describe('ChatConfirmDialogComponent', () => {
  it('renders nothing when open is false', () => {
    const fixture = render({ open: false });
    expect(fixture.nativeElement.querySelector('.chat-confirm-dialog')).toBeNull();
  });

  it('renders title and body when provided', () => {
    const fixture = render({ title: 'Delete?', body: 'This cannot be undone.' });
    expect(fixture.nativeElement.querySelector('.chat-confirm-dialog__title').textContent.trim()).toBe('Delete?');
    expect(fixture.nativeElement.querySelector('.chat-confirm-dialog__body').textContent.trim()).toBe('This cannot be undone.');
  });

  it('omits body element when body is empty', () => {
    const fixture = render({ title: 'T', body: '' });
    expect(fixture.nativeElement.querySelector('.chat-confirm-dialog__body')).toBeNull();
    const dialog = fixture.nativeElement.querySelector('.chat-confirm-dialog');
    expect(dialog.getAttribute('aria-describedby')).toBeNull();
  });

  it('aria-labelledby points at the title element id', () => {
    const fixture = render({ title: 'T' });
    const dialog = fixture.nativeElement.querySelector('.chat-confirm-dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(fixture.nativeElement.querySelector(`#${labelId}`).textContent.trim()).toBe('T');
  });

  it('confirm button click emits confirmed', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.confirmed.subscribe(() => { emits++; });
    (fixture.nativeElement.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
    expect(emits).toBe(1);
  });

  it('cancel button click emits cancelled', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.cancelled.subscribe(() => { emits++; });
    (fixture.nativeElement.querySelector('.chat-confirm-dialog__cancel') as HTMLElement).click();
    expect(emits).toBe(1);
  });

  it('scrim click emits cancelled', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.cancelled.subscribe(() => { emits++; });
    (fixture.nativeElement.querySelector('.chat-confirm-dialog__scrim') as HTMLElement).click();
    expect(emits).toBe(1);
  });

  it('Esc on the dialog emits cancelled', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.cancelled.subscribe(() => { emits++; });
    const dialog = fixture.nativeElement.querySelector('.chat-confirm-dialog');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(emits).toBe(1);
  });

  it('destructive tone applies destructive class to confirm button', () => {
    const fixture = render({ tone: 'destructive' });
    const confirm = fixture.nativeElement.querySelector('.chat-confirm-dialog__confirm');
    expect(confirm.classList.contains('chat-confirm-dialog__confirm--destructive')).toBe(true);
  });

  it('confirm button has labelled text from confirmLabel input', () => {
    const fixture = render({ confirmLabel: 'Yes do it' });
    const confirm = fixture.nativeElement.querySelector('.chat-confirm-dialog__confirm');
    expect(confirm.textContent.trim()).toBe('Yes do it');
  });
});
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx nx run chat:test 2>&1 | grep -E "chat-confirm-dialog|FAIL" | head -5`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Create the component**

Create `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_CONFIRM_DIALOG_STYLES } from '../../styles/chat-confirm-dialog.styles';

let confirmDialogInstanceCounter = 0;

@Component({
  selector: 'chat-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_CONFIRM_DIALOG_STYLES],
  template: `
    @if (open()) {
      <button
        type="button"
        class="chat-confirm-dialog__scrim"
        aria-label="Cancel"
        (click)="cancelled.emit()"
      ></button>
      <div
        class="chat-confirm-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="body() ? bodyId : null"
        (keydown)="onDialogKeydown($event)"
      >
        <h2 [id]="titleId" class="chat-confirm-dialog__title">{{ title() }}</h2>
        @if (body()) {
          <p [id]="bodyId" class="chat-confirm-dialog__body">{{ body() }}</p>
        }
        <div class="chat-confirm-dialog__actions">
          <button
            #cancelBtn
            type="button"
            class="chat-confirm-dialog__cancel"
            (click)="cancelled.emit()"
          >{{ cancelLabel() }}</button>
          <button
            type="button"
            class="chat-confirm-dialog__confirm"
            [class.chat-confirm-dialog__confirm--destructive]="tone() === 'destructive'"
            (click)="confirmed.emit()"
          >{{ confirmLabel() }}</button>
        </div>
      </div>
    }
  `,
})
export class ChatConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Are you sure?');
  readonly body = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly tone = input<'destructive' | 'normal'>('normal');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly instanceId = ++confirmDialogInstanceCounter;
  protected readonly titleId = `chat-confirm-dialog__title-${this.instanceId}`;
  protected readonly bodyId = `chat-confirm-dialog__body-${this.instanceId}`;

  private readonly cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      // Focus cancel on open (deliberately, so destructive confirm requires
      // an explicit Tab + Enter — never a single key from "nothing focused").
      queueMicrotask(() => this.cancelBtn()?.nativeElement.focus());
    });
  }

  protected onDialogKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelled.emit();
    }
  }
}
```

- [ ] **Step 4: Run, confirm PASS**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 5: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -3`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-confirm-dialog
git commit -m "feat(chat): chat-confirm-dialog primitive"
```

---

## Task 5: `chat-thread-list` extensions

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` (or modify if exists)
- Modify: `libs/chat/src/lib/styles/chat-thread-list.styles.ts`

This is the biggest task. Done in three sub-steps: types + state, template + handlers, styles.

- [ ] **Step 1: Add the styles for kebab + edit input**

In `libs/chat/src/lib/styles/chat-thread-list.styles.ts`, append these rules INSIDE the existing template-literal (before the closing backtick):

```css
  .chat-thread-list__item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chat-thread-list__item-wrap .chat-thread-list__item {
    flex: 1 1 auto;
    min-width: 0;
  }
  .chat-thread-list__kebab {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 100ms ease;
    padding: 0;
    line-height: 1;
    font-size: 18px;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__kebab,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__kebab {
    opacity: 1;
  }
  .chat-thread-list__kebab:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  .chat-thread-list__kebab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-thread-list__edit {
    flex: 1 1 auto;
    border: 1px solid var(--ngaf-chat-primary);
    border-radius: var(--ngaf-chat-radius-button);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    padding: 6px 10px;
    min-height: 36px;
    outline: none;
    box-sizing: border-box;
  }
```

- [ ] **Step 2: Replace the component with extended version**

Replace the ENTIRE contents of `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` with:

```typescript
// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  contentChild,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_THREAD_LIST_STYLES } from '../../styles/chat-thread-list.styles';
import {
  ChatOverflowMenuComponent,
  type OverflowMenuItem,
} from '../chat-overflow-menu/chat-overflow-menu.component';
import { ChatConfirmDialogComponent } from '../chat-confirm-dialog/chat-confirm-dialog.component';

export type Thread = {
  id: string;
  /** Optional human-friendly label. Falls back to a slice of the id. */
  title?: string;
  /** Optional epoch-ms timestamp used by the default item template to
   *  render a relative-time line ("just now" / "5 min ago"). When absent
   *  the default template omits the second line. */
  updatedAt?: number;
  [key: string]: unknown;
};

/**
 * Per-thread row-action adapter. Consumer-provided. The framework calls
 * these methods after user confirmation (delete) or commit (rename) and
 * manages optimistic UI + rollback on rejection.
 *
 * Consumers MUST refresh their `threads` signal on success — the framework
 * clears optimistic overrides in a `finally` block, so a successful adapter
 * call that leaves the input list unchanged would re-render the row.
 */
export interface ThreadActionAdapter {
  delete?(threadId: string): Promise<void>;
  rename?(threadId: string, newTitle: string): Promise<void>;
}

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet, ChatOverflowMenuComponent, ChatConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_THREAD_LIST_STYLES],
  template: `
    @if (showNewThreadButton()) {
      <button type="button" class="chat-thread-list__new" (click)="newThreadRequested.emit()">+ New thread</button>
    }
    <ul class="chat-thread-list">
      @for (thread of visibleThreads(); track thread.id) {
        <li class="chat-thread-list__item-wrap">
          @if (templateRef()) {
            <ng-container
              [ngTemplateOutlet]="templateRef()!"
              [ngTemplateOutletContext]="{ $implicit: thread, isActive: thread.id === activeThreadId() }"
            />
          } @else if (editingThreadId() === thread.id) {
            <input
              #editInput
              class="chat-thread-list__edit"
              type="text"
              [value]="editingValue()"
              (input)="onEditInput($event)"
              (keydown.enter)="commitRename(thread.id)"
              (keydown.escape)="cancelRename()"
              (blur)="cancelRename()"
              aria-label="Rename conversation"
            />
          } @else {
            <button
              type="button"
              class="chat-thread-list__item"
              [attr.data-active]="thread.id === activeThreadId() ? 'true' : null"
              [attr.aria-current]="thread.id === activeThreadId() ? 'true' : null"
              (click)="selectThread(thread.id)"
            >
              <span class="chat-thread-list__item-title">{{ threadLabel(thread) }}</span>
              @if (thread.updatedAt !== undefined) {
                <span class="chat-thread-list__item-time">{{ relativeTime(thread.updatedAt) }}</span>
              }
            </button>

            @if (showKebabFor(thread)) {
              <button
                #kebab
                type="button"
                class="chat-thread-list__kebab"
                aria-label="More actions"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuOpenForId() === thread.id ? 'true' : 'false'"
                (click)="openMenu(thread.id, kebab)"
              >⋯</button>
            }
          }
        </li>
      }
    </ul>

    <chat-overflow-menu
      [open]="menuOpenForId() !== null"
      [items]="currentMenuItems()"
      [anchor]="menuAnchor()"
      (itemSelected)="onMenuAction($event)"
      (closed)="menuOpenForId.set(null)"
    />

    <chat-confirm-dialog
      [open]="confirmDeleteId() !== null"
      title="Delete conversation?"
      body="This conversation will be permanently deleted."
      confirmLabel="Delete"
      tone="destructive"
      (confirmed)="performDelete()"
      (cancelled)="confirmDeleteId.set(null)"
    />
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Thread[]>();
  readonly activeThreadId = input<string>('');
  readonly showNewThreadButton = input<boolean>(false);
  readonly actions = input<ThreadActionAdapter | null>(null);

  readonly threadSelected = output<string>();
  readonly newThreadRequested = output<void>();

  readonly templateRef = contentChild(TemplateRef);

  protected readonly editingThreadId = signal<string | null>(null);
  protected readonly editingValue = signal<string>('');
  protected readonly menuOpenForId = signal<string | null>(null);
  protected readonly menuAnchor = signal<HTMLElement | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);

  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private readonly pendingRenames = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly visibleThreads = computed<Thread[]>(() => {
    const hidden = this.pendingDeletes();
    const renames = this.pendingRenames();
    return this.threads()
      .filter((t) => !hidden.has(t.id))
      .map((t) => (renames.has(t.id) ? ({ ...t, title: renames.get(t.id) }) : t));
  });

  protected readonly currentMenuItems = computed<OverflowMenuItem[]>(() => {
    const id = this.menuOpenForId();
    if (!id) return [];
    const a = this.actions();
    if (!a) return [];
    const items: OverflowMenuItem[] = [];
    if (a.rename) items.push({ id: 'rename', label: 'Rename' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
    return items;
  });

  private readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  selectThread(threadId: string): void {
    this.threadSelected.emit(threadId);
  }

  protected threadLabel(thread: Thread): string {
    const title = thread['title'];
    if (typeof title === 'string' && title.length > 0) return title;
    return thread.id;
  }

  protected relativeTime(epochMs: number): string {
    const delta = Date.now() - epochMs;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} hr ago`;
    return `${Math.floor(delta / 86_400_000)} day ago`;
  }

  protected showKebabFor(_thread: Thread): boolean {
    const a = this.actions();
    if (!a) return false;
    return Boolean(a.rename || a.delete);
  }

  protected openMenu(threadId: string, anchor: HTMLElement): void {
    this.menuAnchor.set(anchor);
    this.menuOpenForId.set(threadId);
  }

  protected onMenuAction(id: string): void {
    const threadId = this.menuOpenForId();
    this.menuOpenForId.set(null);
    if (!threadId) return;

    if (id === 'rename') {
      const t = this.threads().find((x) => x.id === threadId);
      this.editingValue.set(typeof t?.title === 'string' ? t.title : '');
      this.editingThreadId.set(threadId);
      queueMicrotask(() => this.editInput()?.nativeElement.focus());
    } else if (id === 'delete') {
      this.confirmDeleteId.set(threadId);
    }
  }

  protected onEditInput(e: Event): void {
    this.editingValue.set((e.target as HTMLInputElement).value);
  }

  protected cancelRename(): void {
    this.editingThreadId.set(null);
  }

  protected async commitRename(threadId: string): Promise<void> {
    const newTitle = this.editingValue().trim();
    this.editingThreadId.set(null);
    if (!newTitle) return;
    const a = this.actions();
    if (!a?.rename) return;

    this.pendingRenames.update((m) => {
      const n = new Map(m);
      n.set(threadId, newTitle);
      return n;
    });
    try {
      await a.rename(threadId, newTitle);
    } catch {
      // Rollback happens via the finally clear below — pending override is removed,
      // and threads() input still contains the original title.
    } finally {
      this.pendingRenames.update((m) => {
        const n = new Map(m);
        n.delete(threadId);
        return n;
      });
    }
  }

  protected async performDelete(): Promise<void> {
    const threadId = this.confirmDeleteId();
    this.confirmDeleteId.set(null);
    if (!threadId) return;
    const a = this.actions();
    if (!a?.delete) return;

    this.pendingDeletes.update((s) => new Set([...s, threadId]));
    try {
      await a.delete(threadId);
    } catch {
      // Rollback: clear override so the row reappears.
    } finally {
      this.pendingDeletes.update((s) => {
        const n = new Set(s);
        n.delete(threadId);
        return n;
      });
    }
  }
}
```

- [ ] **Step 3: Write the spec (or extend if existing)**

Create (or modify if exists) `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatThreadListComponent,
  type Thread,
  type ThreadActionAdapter,
} from './chat-thread-list.component';

function render(opts: { threads?: Thread[]; actions?: ThreadActionAdapter | null; activeThreadId?: string } = {}) {
  const fixture = TestBed.createComponent(ChatThreadListComponent);
  fixture.componentRef.setInput('threads', opts.threads ?? [{ id: 't1', title: 'First' }, { id: 't2', title: 'Second' }]);
  if (opts.actions !== undefined) fixture.componentRef.setInput('actions', opts.actions);
  if (opts.activeThreadId !== undefined) fixture.componentRef.setInput('activeThreadId', opts.activeThreadId);
  fixture.detectChanges();
  return fixture;
}

describe('ChatThreadListComponent', () => {
  describe('without adapter', () => {
    it('renders the thread rows', () => {
      const fixture = render();
      const items = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(items.length).toBe(2);
    });

    it('clicking a row emits threadSelected', () => {
      const fixture = render();
      let received: string | undefined;
      fixture.componentInstance.threadSelected.subscribe((id: string) => { received = id; });
      const items = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      (items[1] as HTMLElement).click();
      expect(received).toBe('t2');
    });

    it('renders no kebab when actions is null', () => {
      const fixture = render({ actions: null });
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });

    it('renders no kebab when actions is empty object', () => {
      const fixture = render({ actions: {} });
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });
  });

  describe('with adapter', () => {
    it('renders a kebab per row when adapter has methods', () => {
      const fixture = render({ actions: { delete: async () => {}, rename: async () => {} } });
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      expect(kebabs.length).toBe(2);
    });

    it('clicking kebab opens menu with both items when both methods provided', () => {
      const fixture = render({ actions: { delete: async () => {}, rename: async () => {} } });
      const kebab = fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement;
      kebab.click();
      fixture.detectChanges();
      const items = document.querySelectorAll('.chat-overflow-menu__item');
      const labels = Array.from(items).map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Rename');
      expect(labels).toContain('Delete');
    });

    it('clicking Rename enters edit mode and focuses the input', async () => {
      const fixture = render({ actions: { rename: async () => {} } });
      const kebab = fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement;
      kebab.click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      expect(input!.value).toBe('First');
    });

    it('Enter on rename input calls adapter.rename and shows new title optimistically', async () => {
      const renameSpy = vi.fn(async () => {});
      const fixture = render({ actions: { rename: renameSpy } });
      // Open menu, click Rename.
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      await new Promise((r) => queueMicrotask(() => r(undefined)));
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      input.value = 'Renamed';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      expect(renameSpy).toHaveBeenCalledWith('t1', 'Renamed');
    });

    it('Esc cancels rename without calling adapter', () => {
      const renameSpy = vi.fn(async () => {});
      const fixture = render({ actions: { rename: renameSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const renameItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
      renameItem.click();
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.chat-thread-list__edit') as HTMLInputElement;
      input.value = 'X';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(renameSpy).not.toHaveBeenCalled();
    });

    it('Delete menu item opens the confirm dialog', () => {
      const fixture = render({ actions: { delete: async () => {} } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      expect(document.querySelector('.chat-confirm-dialog')).not.toBeNull();
    });

    it('Confirming delete calls adapter and hides the row optimistically', async () => {
      let resolveDelete!: () => void;
      const deleteSpy = vi.fn(() => new Promise<void>((r) => { resolveDelete = r; }));
      const fixture = render({ actions: { delete: deleteSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      (document.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
      fixture.detectChanges();
      // Row should be hidden while the promise is pending.
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1); // 't1' optimistically hidden, only 't2' remains
      expect(deleteSpy).toHaveBeenCalledWith('t1');
      resolveDelete();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Cancelling the confirm dialog does not call adapter', () => {
      const deleteSpy = vi.fn(async () => {});
      const fixture = render({ actions: { delete: deleteSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const delItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item')).find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
      delItem.click();
      fixture.detectChanges();
      (document.querySelector('.chat-confirm-dialog__cancel') as HTMLElement).click();
      fixture.detectChanges();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npx nx run chat:test 2>&1 | tail -10`

Note: tests may interact with `document` (because `chat-overflow-menu` is `position: fixed` and rendered via the component's template, so it lives in the test's DOM). Vitest+TestBed setup in this repo supports that.

- [ ] **Step 5: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -5`
Expected: both pass.

If lint flags `interactive-supports-focus` on the `<input class="chat-thread-list__edit">` (inputs are focusable by default, but the rule may insist on a tabindex), add `tabindex="0"` to the input — does no harm.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list libs/chat/src/lib/styles/chat-thread-list.styles.ts
git commit -m "feat(chat): chat-thread-list row actions (rename + delete) with optimistic UI"
```

---

## Task 6: `chat-sidenav` pass-through `actions` input

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`

- [ ] **Step 1: Add the input and forward it**

In the component imports block, add `ThreadActionAdapter` to the existing chat-thread-list import:

```typescript
import {
  ChatThreadListComponent,
  type Thread,
  type ThreadActionAdapter,
} from '../../primitives/chat-thread-list/chat-thread-list.component';
```

In the class body, add the input next to the other inputs (after `activeThreadId`):

```typescript
readonly actions = input<ThreadActionAdapter | null>(null);
```

In the template, locate the `<chat-thread-list>` element inside the `@if (threads() !== null)` block. Add the `[actions]` binding:

```html
<chat-thread-list
  [threads]="threads()!"
  [activeThreadId]="activeThreadId() ?? ''"
  [actions]="actions()"
  (threadSelected)="threadSelected.emit($event)"
/>
```

- [ ] **Step 2: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -3`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts
git commit -m "feat(chat): chat-sidenav forwards actions input to thread list"
```

---

## Task 7: Public API exports

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the new exports**

Search `public-api.ts` for the line that exports `ChatThreadListComponent`:

```typescript
export { ChatThreadListComponent } from './lib/primitives/chat-thread-list/chat-thread-list.component';
```

Below it, add the `ThreadActionAdapter` type export:

```typescript
export type { ThreadActionAdapter } from './lib/primitives/chat-thread-list/chat-thread-list.component';
```

Near the other primitive exports (e.g. after `ChatHistorySearchPaletteComponent`), add:

```typescript
export { ChatOverflowMenuComponent } from './lib/primitives/chat-overflow-menu/chat-overflow-menu.component';
export type { OverflowMenuItem } from './lib/primitives/chat-overflow-menu/chat-overflow-menu.component';
export { ChatConfirmDialogComponent } from './lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component';
```

- [ ] **Step 2: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export overflow menu, confirm dialog, and ThreadActionAdapter"
```

---

## Task 8: Example shell — `ThreadsService` extensions

**Files:**
- Modify: `examples/chat/angular/src/app/shell/threads.service.ts`

- [ ] **Step 1: Add delete + rename methods**

Open `examples/chat/angular/src/app/shell/threads.service.ts`. Inside the `ThreadsService` class, append two new methods (after the existing `create()` method):

```typescript
async delete(threadId: string): Promise<void> {
  const res = await fetch(`${API_URL}/threads/${threadId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${threadId} failed: ${res.status}`);
  await this.refresh();
}

async rename(threadId: string, newTitle: string): Promise<void> {
  const res = await fetch(`${API_URL}/threads/${threadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: { title: newTitle } }),
  });
  if (!res.ok) throw new Error(`rename ${threadId} failed: ${res.status}`);
  await this.refresh();
}
```

- [ ] **Step 2: Verify**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/threads.service.ts
git commit -m "feat(examples-chat): threads.service.ts gains delete + rename"
```

---

## Task 9: Example shell — wire `threadActions`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Add the import and threadActions property**

In `demo-shell.component.ts`, expand the existing `@ngaf/chat` import to include `type ThreadActionAdapter`:

```typescript
import {
  // ... existing imports preserved
  type ChatSidenavMode,
  ChatHistorySearchPaletteComponent,
  type ThreadMatch,
  type ThreadActionAdapter,
} from '@ngaf/chat';
```

(Preserve every other identifier currently in that import block.)

In the class body, add the `threadActions` adapter. The delete method also clears the active thread id when the deleted thread is the active one. Place it near the existing `threadIdSignal`:

```typescript
protected readonly threadActions: ThreadActionAdapter = {
  delete: async (id) => {
    await this.threadsSvc.delete(id);
    if (this.threadIdSignal() === id) {
      this.threadIdSignal.set(null);
      this.persistence.write('threadId', null);
    }
  },
  rename: (id, title) => this.threadsSvc.rename(id, title),
};
```

- [ ] **Step 2: Bind in the template**

In `demo-shell.component.html`, find the `<chat-sidenav>` element and add the `[actions]` binding (the rest of the bindings remain unchanged):

```html
<chat-sidenav
  [threads]="threadsSvc.threads()"
  [activeThreadId]="threadIdSignal() ?? ''"
  [mode]="sidenavMode()"
  [(open)]="drawerOpen"
  [actions]="threadActions"
  (newChat)="onNewThread()"
  (threadSelected)="onThreadSelected($event)"
  (searchOpened)="paletteOpen.set(true)"
  (openChange)="onSidenavOpenChange($event)"
/>
```

- [ ] **Step 3: Build**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -5`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): wire threadActions adapter on chat-sidenav"
```

---

## Task 10: Regenerate API docs

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [ ] **Step 1: Regenerate**

Run from the repo root:

```bash
npx tsx apps/website/scripts/generate-api-docs.ts
```

Expected output includes `✓ chat/api/api-docs.json (N entries)` with N reflecting the new `ChatOverflowMenuComponent`, `OverflowMenuItem`, `ChatConfirmDialogComponent`, `ThreadActionAdapter` entries.

- [ ] **Step 2: Stage + verify the diff is reasonable**

Run: `git diff --stat apps/website/content/docs/chat/api/api-docs.json`
Expected: changes only to that one file, net positive lines.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/api/api-docs.json
git commit -m "docs(chat): regenerate API docs for row actions"
```

---

## Task 11: Manual browser verification

**Files:** none — verification only.

This task is the controller's job; subagents should stop after Task 10 and report.

The controller will:

1. Start the dev server (`examples-chat` from `.claude/launch.json`, port 4400). Must be run from a worktree at origin/main+impl-branch so libraries resolve to the new code.
2. Click a populated thread that has content.
3. Verify each behavior:
   - Hover row → kebab fades in.
   - Click kebab → menu pops anchored near it; Rename + Delete (destructive red).
   - Click outside menu → menu closes.
   - Esc with menu open → menu closes.
   - Click Rename → row morphs into input prefilled with the title; input focused.
   - Type something + Enter → row reverts to button with the new title; LangGraph PATCH succeeded.
   - Click Rename again, type something, then Esc → row reverts to old title; no PATCH.
   - Click Rename again, type something, blur (click elsewhere) → row reverts; no PATCH.
   - Click Delete → confirm dialog appears; focus on Cancel; destructive red Delete button.
   - Esc → dialog closes; no DELETE.
   - Click Delete (in dialog) → row vanishes immediately; LangGraph DELETE succeeded.
4. Screenshots for: menu open with both items, confirm dialog open, row in edit mode.
5. Stop the preview server.

If any visual / behavioral issue surfaces, fix it, re-verify, commit. (E.g., the menu auto-position-above-when-near-bottom note in the spec — implement only if it visibly bites.)

---

## Self-Review

**Spec coverage:**
- `ThreadActionAdapter` type → Task 5 (defined + exported in Task 7).
- `OverflowMenuItem` type → Task 2 (defined + exported in Task 7).
- `chat-overflow-menu` primitive → Tasks 1 + 2 (styles + component + spec).
- `chat-confirm-dialog` primitive → Tasks 3 + 4 (styles + component + spec).
- `chat-thread-list` actions input + state + optimistic flows → Task 5.
- Hover-revealed kebab → Task 5 (CSS) + Task 5 (template).
- Inline rename UX → Task 5 template.
- Destructive confirm dialog initial-focus-cancel → Task 4 component.
- `chat-sidenav` pass-through → Task 6.
- `examples-chat` wiring → Tasks 8 + 9.
- Active-thread-cleared-on-delete (consumer responsibility) → Task 9.
- API docs regen → Task 10.
- Manual verification → Task 11.

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `Thread` is unchanged from existing definition (re-exported by Task 5).
- `ThreadActionAdapter` is defined once in `chat-thread-list.component.ts`; consumed in `chat-sidenav.component.ts` (Task 6) and `examples-chat-angular/demo-shell` (Task 9).
- `OverflowMenuItem` defined in `chat-overflow-menu.component.ts` (Task 2), consumed in `chat-thread-list.component.ts` (Task 5).
- Output names consistent: `itemSelected`, `closed`, `confirmed`, `cancelled`. All wired in `chat-thread-list` template (Task 5).
- Method names consistent: `openMenu`, `onMenuAction`, `commitRename`, `cancelRename`, `performDelete`, `onEditInput`, `showKebabFor`.
