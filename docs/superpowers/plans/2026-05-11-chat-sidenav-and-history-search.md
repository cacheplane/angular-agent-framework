# Chat sidenav + history search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a `chat-sidenav` composition (three responsive modes + named slots) and a `chat-history-search-palette` primitive (Cmd+K modal) in `@ngaf/chat`, hard-replacing `chat-thread-drawer`. Migrate `examples-chat-angular` to use them.

**Architecture:** New composition consolidates drawer mechanics with always-visible expanded/collapsed modes and a built-in threads section. New primitive is a dumb modal palette with model-bound `open`/`query`/`results`; the sidenav emits `(searchOpened)` from a global Cmd/Ctrl+K listener; the consumer renders the palette and wires the search results.

**Tech Stack:** Angular 21 standalone components, signal inputs/outputs/models, Vitest + Angular TestBed, plain CSS strings under `libs/chat/src/lib/styles/`.

**Spec:** [docs/superpowers/specs/2026-05-11-chat-sidenav-and-history-search-design.md](../specs/2026-05-11-chat-sidenav-and-history-search-design.md)

---

## File map

**Create:**
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts`
- `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.ts`
- `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.spec.ts`
- `libs/chat/src/lib/styles/chat-history-search-palette.styles.ts`

**Delete:**
- `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.ts`
- `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.spec.ts` (if exists)

**Modify:**
- `libs/chat/src/public-api.ts`
- `libs/chat/src/lib/styles/chat-tokens.ts`
- `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- `examples/chat/angular/src/app/shell/demo-shell.component.html`
- `examples/chat/angular/src/app/shell/demo-shell.component.css` (likely; verify)
- `apps/website/content/docs/chat/api/api-docs.json` (regenerated)

---

## Task 1: CSS width tokens + Thread type export

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add sidenav width tokens to `SPACING_TOKENS`**

In `chat-tokens.ts`, find the `const SPACING_TOKENS = \`` block and append three lines just before the closing backtick:

```
--ngaf-chat-sidenav-width-expanded: 280px;
--ngaf-chat-sidenav-width-collapsed: 56px;
--ngaf-chat-sidenav-width-drawer: 280px;
```

The block should end like:

```
  --ngaf-chat-edge-pad: 16px;
  --ngaf-chat-input-gap: 0.75rem;
  --ngaf-chat-sidenav-width-expanded: 280px;
  --ngaf-chat-sidenav-width-collapsed: 56px;
  --ngaf-chat-sidenav-width-drawer: 280px;
`;
```

- [ ] **Step 2: Export `Thread` from public-api.ts**

In `public-api.ts`, find the line:

```typescript
export { ChatMessageListComponent, getMessageType } from './lib/primitives/chat-message-list/chat-message-list.component';
```

The `ChatThreadListComponent` is exported elsewhere in the file (search for `ChatThreadListComponent` — likely around line 80+). Locate that line and add a sibling type export immediately after it:

```typescript
export type { Thread } from './lib/primitives/chat-thread-list/chat-thread-list.component';
```

- [ ] **Step 3: Verify build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): sidenav width tokens; export Thread type"
```

---

## Task 2: Create `chat-sidenav` styles file

**Files:**
- Create: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`

- [ ] **Step 1: Write the styles constant**

Create `libs/chat/src/lib/styles/chat-sidenav.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-sidenav.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_SIDENAV_STYLES = `
  :host {
    display: block;
    height: 100%;
  }
  :host([data-mode="expanded"]) .chat-sidenav {
    width: var(--ngaf-chat-sidenav-width-expanded);
  }
  :host([data-mode="collapsed"]) .chat-sidenav {
    width: var(--ngaf-chat-sidenav-width-collapsed);
  }
  :host([data-mode="drawer"]) {
    position: relative;
  }
  .chat-sidenav {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--ngaf-chat-bg);
    border-right: 1px solid var(--ngaf-chat-separator);
    box-sizing: border-box;
    overflow: hidden;
  }
  .chat-sidenav__scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1000;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  :host([data-mode="drawer"]) .chat-sidenav {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--ngaf-chat-sidenav-width-drawer);
    z-index: 1001;
    transition: transform 200ms ease;
    transform: translateX(-100%);
  }
  :host([data-mode="drawer"][data-open="true"]) .chat-sidenav {
    transform: translateX(0);
  }
  @media (max-width: 767px) {
    :host([data-mode="drawer"]) .chat-sidenav {
      width: 100%;
    }
  }
  .chat-sidenav__header {
    flex-shrink: 0;
    padding: var(--ngaf-chat-space-3);
    border-bottom: 1px solid var(--ngaf-chat-separator);
  }
  .chat-sidenav__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--ngaf-chat-space-3);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__actions {
    align-items: center;
    padding: var(--ngaf-chat-space-2);
  }
  .chat-sidenav__action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text);
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .chat-sidenav__action:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-sidenav__action:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action {
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action-label {
    display: none;
  }
  .chat-sidenav__action-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .chat-sidenav__primary,
  .chat-sidenav__sections {
    flex-shrink: 0;
  }
  .chat-sidenav__threads {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .chat-sidenav__threads-heading {
    padding: 8px 12px 4px;
    font-size: var(--ngaf-chat-font-size-xs);
    color: var(--ngaf-chat-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__threads-heading {
    display: none;
  }
  .chat-sidenav__account {
    flex-shrink: 0;
    border-top: 1px solid var(--ngaf-chat-separator);
    padding: var(--ngaf-chat-space-3);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__account {
    padding: var(--ngaf-chat-space-2);
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/styles/chat-sidenav.styles.ts
git commit -m "feat(chat): chat-sidenav styles"
```

---

## Task 3: `chat-sidenav` component (TDD)

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`
- Create: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`

- [ ] **Step 1: Write the failing spec**

Create `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`:

```typescript
// libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { Agent } from '../../agent';
import { ChatSidenavComponent } from './chat-sidenav.component';

function fakeAgent(): Agent {
  return {
    messages: () => [],
    isLoading: () => false,
    status: () => 'idle',
    submit: async () => undefined,
    events$: { subscribe: () => ({ unsubscribe: () => {} }) },
  } as unknown as Agent;
}

function render(opts: { mode?: 'expanded' | 'collapsed' | 'drawer'; open?: boolean; threads?: unknown[] | null } = {}) {
  const fixture = TestBed.createComponent(ChatSidenavComponent);
  fixture.componentRef.setInput('agent', fakeAgent());
  if (opts.mode) fixture.componentRef.setInput('mode', opts.mode);
  if (opts.open !== undefined) fixture.componentRef.setInput('open', opts.open);
  if (opts.threads !== undefined) fixture.componentRef.setInput('threads', opts.threads);
  fixture.detectChanges();
  return fixture;
}

describe('ChatSidenavComponent', () => {
  it('reflects mode via data-mode attribute', () => {
    expect(render({ mode: 'expanded' }).nativeElement.getAttribute('data-mode')).toBe('expanded');
    expect(render({ mode: 'collapsed' }).nativeElement.getAttribute('data-mode')).toBe('collapsed');
    expect(render({ mode: 'drawer' }).nativeElement.getAttribute('data-mode')).toBe('drawer');
  });

  it('emits newChat when new-chat button clicked', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.newChat.subscribe(() => emits++);
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--new') as HTMLButtonElement;
    btn.click();
    expect(emits).toBe(1);
  });

  it('emits searchOpened when search button clicked', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    const btn = fixture.nativeElement.querySelector('.chat-sidenav__action--search') as HTMLButtonElement;
    btn.click();
    expect(emits).toBe(1);
  });

  it('emits searchOpened on Cmd+K', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(emits).toBe(1);
  });

  it('emits searchOpened on Ctrl+K', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(emits).toBe(1);
  });

  it('does not emit searchOpened on Cmd+K when focus is in an input', () => {
    const fixture = render();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    let emits = 0;
    fixture.componentInstance.searchOpened.subscribe(() => emits++);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    expect(emits).toBe(0);
    document.body.removeChild(input);
  });

  it('renders threads section when threads input is non-null', () => {
    const fixture = render({ threads: [{ id: 't1', title: 'First' }] });
    expect(fixture.nativeElement.querySelector('chat-thread-list')).not.toBeNull();
  });

  it('suppresses threads section when threads input is null', () => {
    const fixture = render({ threads: null });
    expect(fixture.nativeElement.querySelector('chat-thread-list')).toBeNull();
  });

  it('drawer mode: scrim click emits openChange(false)', () => {
    const fixture = render({ mode: 'drawer', open: true });
    let lastOpen: boolean | undefined;
    fixture.componentInstance.openChange.subscribe((v: boolean) => { lastOpen = v; });
    const scrim = fixture.nativeElement.querySelector('.chat-sidenav__scrim') as HTMLButtonElement;
    scrim.click();
    expect(lastOpen).toBe(false);
  });

  it('drawer mode: scrim NOT rendered when open is false', () => {
    const fixture = render({ mode: 'drawer', open: false });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__scrim')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx nx run chat:test 2>&1 | grep -E "chat-sidenav|FAIL"`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Create the component**

Create `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`:

```typescript
// libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SIDENAV_STYLES } from '../../styles/chat-sidenav.styles';
import { ChatThreadListComponent, type Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';

export type ChatSidenavMode = 'expanded' | 'collapsed' | 'drawer';

@Component({
  selector: 'chat-sidenav',
  standalone: true,
  imports: [ChatThreadListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-mode]': 'mode()',
    '[attr.data-open]': 'open() ? "true" : "false"',
  },
  styles: [CHAT_HOST_TOKENS, CHAT_SIDENAV_STYLES],
  template: `
    @if (mode() === 'drawer' && open()) {
      <button
        type="button"
        class="chat-sidenav__scrim"
        aria-label="Close conversations"
        (click)="openChange.emit(false)"
      ></button>
    }
    <aside
      class="chat-sidenav"
      role="navigation"
      aria-label="Sidebar navigation"
      (keydown.escape)="onEscape()"
    >
      <div class="chat-sidenav__header">
        <ng-content select="[sidenavHeader]" />
      </div>

      <div class="chat-sidenav__actions">
        <button
          type="button"
          class="chat-sidenav__action chat-sidenav__action--new"
          (click)="newChat.emit()"
          aria-label="New chat"
          title="New chat"
        >
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span class="chat-sidenav__action-label">New chat</span>
        </button>
        <button
          type="button"
          class="chat-sidenav__action chat-sidenav__action--search"
          (click)="searchOpened.emit()"
          aria-label="Search conversations"
          title="Search conversations (⌘K)"
        >
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span class="chat-sidenav__action-label">Search</span>
        </button>
      </div>

      <div class="chat-sidenav__primary">
        <ng-content select="[sidenavPrimary]" />
      </div>

      @if (threads() !== null) {
        <div class="chat-sidenav__threads">
          <div class="chat-sidenav__threads-heading">Recent</div>
          <chat-thread-list
            [threads]="threads()!"
            [activeThreadId]="activeThreadId() ?? ''"
            (threadSelected)="threadSelected.emit($event)"
          />
        </div>
      }

      <div class="chat-sidenav__sections">
        <ng-content select="[sidenavSections]" />
      </div>

      <div class="chat-sidenav__account">
        <ng-content select="[sidenavAccount]" />
      </div>
    </aside>
  `,
})
export class ChatSidenavComponent {
  readonly agent = input.required<Agent>();
  readonly mode = input<ChatSidenavMode>('expanded');
  readonly open = model<boolean>(false);
  readonly threads = input<Thread[] | null>(null);
  readonly activeThreadId = input<string | null>(null);

  readonly newChat = output<void>();
  readonly threadSelected = output<string>();
  readonly searchOpened = output<void>();
  readonly openChange = output<boolean>();

  private readonly destroyRef = inject(DestroyRef);
  private invokerOnOpen: Element | null = null;

  constructor() {
    fromEvent<KeyboardEvent>(window, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
        const t = e.target as HTMLElement | null;
        if (t) {
          const tag = t.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
        }
        e.preventDefault();
        this.searchOpened.emit();
      });
  }

  protected onEscape(): void {
    if (this.mode() === 'drawer' && this.open()) {
      this.openChange.emit(false);
    }
  }
}
```

- [ ] **Step 4: Run the spec — must pass**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: PASS (all chat-sidenav tests).

- [ ] **Step 5: Run build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npx nx lint chat 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/
git commit -m "feat(chat): chat-sidenav composition with three responsive modes"
```

---

## Task 4: Hard-replace `chat-thread-drawer`

**Files:**
- Delete: `libs/chat/src/lib/compositions/chat-thread-drawer/`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Delete the drawer directory**

Run:

```bash
rm -rf libs/chat/src/lib/compositions/chat-thread-drawer/
```

- [ ] **Step 2: Remove drawer exports from public-api.ts**

Open `libs/chat/src/public-api.ts`. Find the two lines:

```typescript
export { ChatThreadDrawerComponent } from './lib/compositions/chat-thread-drawer/chat-thread-drawer.component';
export type { ChatThreadDrawerMode } from './lib/compositions/chat-thread-drawer/chat-thread-drawer.component';
```

Delete both lines.

- [ ] **Step 3: Add `ChatSidenavComponent` and `ChatSidenavMode` exports**

In `public-api.ts`, immediately after the existing chat composition exports (search for `ChatComponent` exports near the top of the compositions section — `export { ChatComponent } from './lib/compositions/chat/chat.component';`), add:

```typescript
export { ChatSidenavComponent } from './lib/compositions/chat-sidenav/chat-sidenav.component';
export type { ChatSidenavMode } from './lib/compositions/chat-sidenav/chat-sidenav.component';
```

- [ ] **Step 4: Verify no remaining references to the drawer in the lib**

Run: `grep -rn "ChatThreadDrawer\|chat-thread-drawer" libs/chat/src/`
Expected: no output.

- [ ] **Step 5: Build (lib only — examples will be broken until Task 5)**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-thread-drawer libs/chat/src/public-api.ts
git commit -m "feat(chat)!: remove chat-thread-drawer; replaced by chat-sidenav"
```

---

## Task 5: Migrate `examples-chat-angular` to `chat-sidenav`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

The shell currently uses `chat-thread-drawer` with `chat-thread-list` projected inside. After migration, the sidenav itself renders the thread list (via its built-in section).

- [ ] **Step 1: Update the TypeScript shell**

Open `examples/chat/angular/src/app/shell/demo-shell.component.ts`.

Replace the import block that names the drawer:

```typescript
ChatThreadDrawerComponent,
ChatThreadListComponent,
```

with:

```typescript
ChatSidenavComponent,
type ChatSidenavMode,
```

(Remove `ChatThreadListComponent` — the sidenav now wraps it internally.)

In the `@Component({ imports: [...] })` array, replace:

```typescript
ChatThreadDrawerComponent,
ChatThreadListComponent,
```

with:

```typescript
ChatSidenavComponent,
```

Replace the `drawerMode` computed (search for `drawerMode = computed`):

```typescript
protected readonly drawerMode = computed<'push' | 'overlay'>(() =>
  this.viewportWidth() >= 1024 ? 'push' : 'overlay',
);
```

with:

```typescript
protected readonly sidenavMode = computed<ChatSidenavMode>(() =>
  this.viewportWidth() >= 1024 ? 'expanded' : 'drawer',
);
```

(The persisted `drawerOpen` signal still drives the drawer in narrow viewports; on desktop the sidenav is always rendered expanded so `drawerOpen` is ignored.)

Rename `onDrawerOpenChange` to `onSidenavOpenChange` (find+replace within the file — there are two call sites: the method definition and `toggleDrawer`).

- [ ] **Step 2: Update the template**

Open `examples/chat/angular/src/app/shell/demo-shell.component.html`.

Replace the `<chat-thread-drawer>` block (lines around 10-22) with:

```html
<chat-sidenav
  [agent]="agent"
  [threads]="threadsSvc.threads()"
  [activeThreadId]="threadIdSignal() ?? ''"
  [mode]="sidenavMode()"
  [(open)]="drawerOpen"
  (newChat)="onNewThread()"
  (threadSelected)="onThreadSelected($event)"
  (openChange)="onSidenavOpenChange($event)"
/>
```

Note: `[(open)]` two-way binds AND `(openChange)` listener fires for persistence. Angular dispatches both — the `open` signal updates via `model`, and `onSidenavOpenChange` writes to persistence.

Update the hamburger button's behavior — it should toggle the sidenav open state on narrow viewports only (on desktop the sidenav is permanent). The existing logic already toggles via `toggleDrawer()` which calls `onDrawerOpenChange(!drawerOpen())`. Rename the method call:

```html
<button
  type="button"
  class="demo-shell__hamburger"
  aria-label="Open conversations"
  [attr.aria-expanded]="drawerOpen()"
  (click)="toggleSidenav()"
>☰</button>
```

In the TS file, rename `toggleDrawer()` to `toggleSidenav()`.

- [ ] **Step 3: Verify there are no stale references**

Run from repo root: `grep -rn "ChatThreadDrawer\|chat-thread-drawer\|ChatThreadListComponent" examples/chat/angular/src/`
Expected: no output (or only references to `chat-thread-list` *element* inside docs/comments which is unrelated).

- [ ] **Step 4: Build the example**

Run: `npx nx run examples-chat-angular:build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "refactor(examples-chat): migrate from chat-thread-drawer to chat-sidenav"
```

---

## Task 6: Create `chat-history-search-palette` styles

**Files:**
- Create: `libs/chat/src/lib/styles/chat-history-search-palette.styles.ts`

- [ ] **Step 1: Write the styles constant**

Create `libs/chat/src/lib/styles/chat-history-search-palette.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-history-search-palette.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_HISTORY_SEARCH_PALETTE_STYLES = `
  :host { display: contents; }
  .chat-history-search-palette__scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 50;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .chat-history-search-palette {
    position: fixed;
    top: 15vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, 90vw);
    max-height: 70vh;
    background: var(--ngaf-chat-bg);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
    z-index: 51;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .chat-history-search-palette__input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ngaf-chat-separator);
  }
  .chat-history-search-palette__icon {
    width: 18px;
    height: 18px;
    color: var(--ngaf-chat-text-muted);
    flex-shrink: 0;
  }
  .chat-history-search-palette__input {
    flex: 1 1 auto;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: 1rem;
  }
  .chat-history-search-palette__input::placeholder {
    color: var(--ngaf-chat-text-muted);
  }
  .chat-history-search-palette__close {
    background: transparent;
    border: 0;
    padding: 4px;
    color: var(--ngaf-chat-text-muted);
    cursor: pointer;
    border-radius: 4px;
  }
  .chat-history-search-palette__close:hover { color: var(--ngaf-chat-text); }
  .chat-history-search-palette__list {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 4px;
    margin: 0;
    list-style: none;
  }
  .chat-history-search-palette__row {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
  }
  .chat-history-search-palette__row[aria-selected="true"] {
    background: var(--ngaf-chat-surface-alt);
  }
  .chat-history-search-palette__row-title {
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size);
  }
  .chat-history-search-palette__row-subtitle {
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-sm);
    margin-top: 2px;
  }
  .chat-history-search-palette__empty,
  .chat-history-search-palette__hint {
    padding: 24px 16px;
    color: var(--ngaf-chat-text-muted);
    text-align: center;
    font-size: var(--ngaf-chat-font-size-sm);
  }
  .chat-history-search-palette__skeleton {
    padding: 8px 4px;
  }
  .chat-history-search-palette__skeleton-row {
    height: 36px;
    margin: 4px 0;
    background: var(--ngaf-chat-surface-alt);
    border-radius: 8px;
    animation: ngaf-chat-pulse 1.4s ease-in-out infinite;
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/styles/chat-history-search-palette.styles.ts
git commit -m "feat(chat): chat-history-search-palette styles"
```

---

## Task 7: `chat-history-search-palette` component (TDD)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.ts`

- [ ] **Step 1: Write the failing spec**

Create `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatHistorySearchPaletteComponent, type ThreadMatch } from './chat-history-search-palette.component';

function render(opts: { open?: boolean; query?: string; results?: ThreadMatch[]; loading?: boolean } = {}) {
  const fixture = TestBed.createComponent(ChatHistorySearchPaletteComponent);
  fixture.componentRef.setInput('open', opts.open ?? true);
  if (opts.query !== undefined) fixture.componentRef.setInput('query', opts.query);
  if (opts.results !== undefined) fixture.componentRef.setInput('results', opts.results);
  if (opts.loading !== undefined) fixture.componentRef.setInput('loading', opts.loading);
  fixture.detectChanges();
  return fixture;
}

describe('ChatHistorySearchPaletteComponent', () => {
  it('renders nothing when open is false', () => {
    const fixture = render({ open: false });
    expect(fixture.nativeElement.querySelector('.chat-history-search-palette')).toBeNull();
  });

  it('renders hint when query is empty and not loading', () => {
    const fixture = render({ query: '', loading: false });
    expect(fixture.nativeElement.querySelector('.chat-history-search-palette__hint')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-history-search-palette__empty')).toBeNull();
  });

  it('renders empty state when query is non-empty and results empty', () => {
    const fixture = render({ query: 'xyz', results: [], loading: false });
    expect(fixture.nativeElement.querySelector('.chat-history-search-palette__empty')).not.toBeNull();
  });

  it('renders skeleton when loading and results empty', () => {
    const fixture = render({ loading: true, results: [] });
    expect(fixture.nativeElement.querySelector('.chat-history-search-palette__skeleton')).not.toBeNull();
  });

  it('renders result rows when results provided', () => {
    const fixture = render({
      query: 'foo',
      results: [
        { id: '1', title: 'First' },
        { id: '2', title: 'Second', subtitle: 'sub' },
      ],
    });
    const rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Second');
    expect(rows[1].textContent).toContain('sub');
  });

  it('marks active row with aria-selected', () => {
    const fixture = render({
      query: 'foo',
      results: [{ id: '1', title: 'First' }, { id: '2', title: 'Second' }],
    });
    const rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
    expect(rows[1].getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowDown advances active index, clamps at end', () => {
    const fixture = render({
      query: 'foo',
      results: [{ id: '1', title: 'A' }, { id: '2', title: 'B' }],
    });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    let rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    expect(rows[1].getAttribute('aria-selected')).toBe('true');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    expect(rows[1].getAttribute('aria-selected')).toBe('true'); // clamped
  });

  it('ArrowUp moves active index back, clamps at 0', () => {
    const fixture = render({
      query: 'foo',
      results: [{ id: '1', title: 'A' }, { id: '2', title: 'B' }],
    });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    expect(rows[0].getAttribute('aria-selected')).toBe('true');
  });

  it('Enter emits threadSelected with active row id', () => {
    const fixture = render({
      query: 'foo',
      results: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    });
    let received: string | undefined;
    fixture.componentInstance.threadSelected.subscribe((id: string) => { received = id; });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(received).toBe('b');
  });

  it('Enter with no results is a no-op', () => {
    const fixture = render({ query: 'x', results: [] });
    let emits = 0;
    fixture.componentInstance.threadSelected.subscribe(() => emits++);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(emits).toBe(0);
  });

  it('Esc emits close', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.close.subscribe(() => emits++);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(emits).toBe(1);
  });

  it('Scrim click emits close', () => {
    const fixture = render();
    let emits = 0;
    fixture.componentInstance.close.subscribe(() => emits++);
    const scrim = fixture.nativeElement.querySelector('.chat-history-search-palette__scrim') as HTMLButtonElement;
    scrim.click();
    expect(emits).toBe(1);
  });

  it('Row click emits threadSelected', () => {
    const fixture = render({
      query: 'x',
      results: [{ id: 'r1', title: 'R1' }, { id: 'r2', title: 'R2' }],
    });
    let received: string | undefined;
    fixture.componentInstance.threadSelected.subscribe((id: string) => { received = id; });
    const rows = fixture.nativeElement.querySelectorAll('.chat-history-search-palette__row');
    (rows[1] as HTMLElement).click();
    expect(received).toBe('r2');
  });

  it('input has correct ARIA attributes', () => {
    const fixture = render({
      query: 'x',
      results: [{ id: '1', title: 'A' }],
    });
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBeTruthy();
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the spec — must fail**

Run: `npx nx run chat:test 2>&1 | grep -E "chat-history-search-palette|FAIL"`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Create the component**

Create `libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-history-search-palette/chat-history-search-palette.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_HISTORY_SEARCH_PALETTE_STYLES } from '../../styles/chat-history-search-palette.styles';

export interface ThreadMatch {
  id: string;
  title: string;
  /** Optional secondary line, rendered muted under the title. */
  subtitle?: string;
}

let paletteInstanceCounter = 0;

@Component({
  selector: 'chat-history-search-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_HISTORY_SEARCH_PALETTE_STYLES],
  template: `
    @if (open()) {
      <button
        type="button"
        class="chat-history-search-palette__scrim"
        aria-label="Close search"
        (click)="close.emit()"
      ></button>
      <div
        class="chat-history-search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
      >
        <div class="chat-history-search-palette__input-row">
          <svg class="chat-history-search-palette__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            #inputEl
            class="chat-history-search-palette__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            [attr.aria-controls]="listId"
            [attr.aria-activedescendant]="activeRowId()"
            [placeholder]="placeholder()"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onInputKeydown($event)"
          />
          <button
            type="button"
            class="chat-history-search-palette__close"
            aria-label="Close"
            (click)="close.emit()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        @if (loading() && results().length === 0) {
          <div class="chat-history-search-palette__skeleton" aria-hidden="true">
            <div class="chat-history-search-palette__skeleton-row"></div>
            <div class="chat-history-search-palette__skeleton-row"></div>
            <div class="chat-history-search-palette__skeleton-row"></div>
          </div>
        } @else if (results().length === 0 && query().length === 0) {
          <div class="chat-history-search-palette__hint">Type to search your conversations.</div>
        } @else if (results().length === 0) {
          <div class="chat-history-search-palette__empty">No conversations match.</div>
        } @else {
          <ul class="chat-history-search-palette__list" role="listbox" [id]="listId">
            @for (row of results(); let i = $index; track row.id) {
              <li
                class="chat-history-search-palette__row"
                role="option"
                [id]="rowId(i)"
                [attr.aria-selected]="i === activeIndex() ? 'true' : 'false'"
                (click)="onRowClick(row.id)"
              >
                <span class="chat-history-search-palette__row-title">{{ row.title }}</span>
                @if (row.subtitle) {
                  <span class="chat-history-search-palette__row-subtitle">{{ row.subtitle }}</span>
                }
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class ChatHistorySearchPaletteComponent {
  readonly open = model<boolean>(false);
  readonly query = model<string>('');
  readonly results = input<ThreadMatch[]>([]);
  readonly loading = input<boolean>(false);
  readonly placeholder = input<string>('Search conversations');

  readonly threadSelected = output<string>();
  readonly close = output<void>();

  protected readonly activeIndex = signal<number>(0);
  protected readonly listId = `chat-history-search-palette__results-${++paletteInstanceCounter}`;

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    // On open → focus input, reset active index. Reset of activeIndex also
    // covers the case where results shrink and the previous index is stale.
    effect(() => {
      if (this.open()) {
        this.activeIndex.set(0);
        queueMicrotask(() => this.inputEl()?.nativeElement.focus());
      }
    });
    // Clamp activeIndex when results shrink while open.
    effect(() => {
      const max = this.results().length - 1;
      if (max >= 0 && this.activeIndex() > max) {
        this.activeIndex.set(max);
      }
    });
  }

  protected rowId(index: number): string {
    return `${this.listId}__row-${index}`;
  }

  protected activeRowId(): string | null {
    return this.results().length > 0 ? this.rowId(this.activeIndex()) : null;
  }

  protected onInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.query.set(value);
  }

  protected onInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close.emit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = this.results().length - 1;
      if (max < 0) return;
      this.activeIndex.set(Math.min(this.activeIndex() + 1, max));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const rows = this.results();
      if (rows.length === 0) return;
      const row = rows[this.activeIndex()];
      this.threadSelected.emit(row.id);
      return;
    }
  }

  protected onRowClick(id: string): void {
    this.threadSelected.emit(id);
  }
}
```

- [ ] **Step 4: Run the spec — must pass**

Run: `npx nx run chat:test 2>&1 | tail -10`
Expected: PASS (all chat-history-search-palette tests).

- [ ] **Step 5: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -5`
Expected: both PASS.

- [ ] **Step 6: Export from public-api.ts**

In `libs/chat/src/public-api.ts`, near the `ChatTypingIndicatorComponent` export, add:

```typescript
export { ChatHistorySearchPaletteComponent } from './lib/primitives/chat-history-search-palette/chat-history-search-palette.component';
export type { ThreadMatch } from './lib/primitives/chat-history-search-palette/chat-history-search-palette.component';
```

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-history-search-palette libs/chat/src/public-api.ts
git commit -m "feat(chat): chat-history-search-palette primitive (Cmd+K modal)"
```

---

## Task 8: Wire the search palette in `examples-chat-angular`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Add palette state and computed results to the shell**

In `demo-shell.component.ts`, add `ChatHistorySearchPaletteComponent` to the imports list (next to `ChatSidenavComponent`):

```typescript
import {
  ChatDebugComponent,
  // ... existing
  ChatSidenavComponent,
  type ChatSidenavMode,
  ChatHistorySearchPaletteComponent,
  type ThreadMatch,
} from '@ngaf/chat';
```

Add to the `imports: [...]` array in the `@Component` decorator: `ChatHistorySearchPaletteComponent`.

Add to the class body (near the existing `drawerOpen` signal):

```typescript
/** Whether the Cmd+K search palette is open. */
protected readonly paletteOpen = signal<boolean>(false);

/** Current palette query. Two-way bound. */
protected readonly searchQuery = signal<string>('');

/** Debounced query — applied 150ms after the last keystroke. */
private readonly searchQueryDebounced = signal<string>('');

private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

constructor() {
  // ... existing constructor body ...
  effect(() => {
    const q = this.searchQuery();
    if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.searchQueryDebounced.set(q);
    }, 150);
  });
}

/** Client-side title filter over the loaded threads. */
protected readonly searchResults = computed<ThreadMatch[]>(() => {
  const q = this.searchQueryDebounced().toLowerCase().trim();
  if (!q) return [];
  const seen = this.threadsSvc.threads();
  return seen
    .filter((t) => (t.title ?? '').toLowerCase().includes(q))
    .slice(0, 50)
    .map((t) => ({ id: t.id, title: t.title ?? t.id }));
});

protected onSearchSelect(threadId: string): void {
  this.onThreadSelected(threadId);
  this.paletteOpen.set(false);
  this.searchQuery.set('');
}
```

(Note: the constructor edit appends to the existing constructor body — keep the existing `effect`/`addEventListener` blocks intact.)

- [ ] **Step 2: Bind the palette and the sidenav's searchOpened event in the template**

In `demo-shell.component.html`, update the `<chat-sidenav>` element to wire `(searchOpened)`:

```html
<chat-sidenav
  [agent]="agent"
  [threads]="threadsSvc.threads()"
  [activeThreadId]="threadIdSignal() ?? ''"
  [mode]="sidenavMode()"
  [(open)]="drawerOpen"
  (newChat)="onNewThread()"
  (threadSelected)="onThreadSelected($event)"
  (searchOpened)="paletteOpen.set(true)"
  (openChange)="onSidenavOpenChange($event)"
/>
```

Add the palette as a sibling, anywhere in the template (above `<chat-debug>` is fine):

```html
<chat-history-search-palette
  [(open)]="paletteOpen"
  [(query)]="searchQuery"
  [results]="searchResults()"
  (threadSelected)="onSearchSelect($event)"
  (close)="paletteOpen.set(false)"
/>
```

- [ ] **Step 3: Build the example**

Run: `npx nx run examples-chat-angular:build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): wire Cmd+K palette with default client-side title filter"
```

---

## Task 9: Regenerate website API docs

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [ ] **Step 1: Regenerate**

Run:

```bash
npx tsx apps/website/scripts/generate-api-docs.ts
```

Expected output includes `✓ chat/api/api-docs.json (N entries)` with N reflecting the added `ChatSidenavComponent`, `ChatSidenavMode`, `ChatHistorySearchPaletteComponent`, `ThreadMatch`, `Thread` and removed `ChatThreadDrawerComponent`, `ChatThreadDrawerMode` entries.

- [ ] **Step 2: Verify diff is reasonable**

Run: `git diff --stat apps/website/content/docs/chat/api/api-docs.json`
Expected: changes only to that one file; net positive lines (more new exports than removed).

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/api/api-docs.json
git commit -m "docs(chat): regenerate chat API docs for sidenav + search palette"
```

---

## Task 10: Manual browser verification (Chrome MCP)

**Files:** none (verification only)

This task is the controller's job; subagents should not run it. Implementer agents should stop after Task 9 and report.

The controller will:

1. Add an `examples-chat` launcher entry in `.claude/launch.json` if not already present (port 4400, name `examples-chat`).
2. `preview_start` the example.
3. Click into a thread that has content (the example seeds threads on a running LangGraph backend).
4. Verify:
   - **Desktop layout (viewport ≥ 1024px)**: sidenav renders as a permanent left rail (`data-mode="expanded"`), threads list visible, new-chat and search buttons visible with labels.
   - **Narrow layout (viewport < 1024px)**: sidenav renders as a drawer; hamburger button opens it; scrim + Esc close it; focus trap works.
   - **New chat button**: click → starts a new thread (existing `onNewThread` flow).
   - **Search button**: click → palette opens, focus moves to input.
   - **Cmd+K (mac) / Ctrl+K (linux)**: opens the palette globally.
   - **Type a query**: after ~150ms, filtered results appear.
   - **ArrowDown / ArrowUp / Enter**: navigates and selects.
   - **Esc**: closes the palette.
   - **Scrim click**: closes the palette.
   - **Suppression**: Cmd+K while typing inside the main composer (the chat input textarea) does NOT open the palette.
5. `preview_screenshot` for at least: sidenav expanded, palette open with results, palette empty-state.
6. Stop the preview server.

If any issue is found, fix it, re-verify, commit.

---

## Self-Review

**Spec coverage:**
- Sidenav composition with three modes → Task 3 (component) + Task 2 (styles)
- Hard-replace `chat-thread-drawer` → Task 4
- Built-in new-chat, threads, search-trigger buttons → Task 3
- Named projection slots (`[sidenavHeader]`, `[sidenavPrimary]`, `[sidenavSections]`, `[sidenavAccount]`) → Task 3 template
- CSS width tokens → Task 1
- Cmd/Ctrl+K shortcut on sidenav, suppressed when in input → Task 3 component constructor + spec
- Drawer-mode scrim/focus-trap/Esc → Task 3 (scrim + keydown.escape) + Task 2 (CSS)
- Search palette with required states (loading/empty/hint/results) → Task 7 component + spec
- Palette keyboard (ArrowUp/Down/Enter/Esc) → Task 7 onInputKeydown
- Palette ARIA (combobox, listbox, activedescendant) → Task 7 template
- Palette is dumb / consumer-wired → Task 7 + Task 8 example wiring
- Examples migration → Task 5 + Task 8
- API doc regeneration → Task 9
- Public-api.ts adjustments → Tasks 1, 4, 7
- Manual verification → Task 10

**Placeholder scan:** None. All steps contain concrete code or commands.

**Type consistency:**
- `Thread` is reused from `chat-thread-list.component.ts` (Task 1 export) and consumed in `chat-sidenav.component.ts` (Task 3) and `examples-chat-angular` (Task 5 / Task 8).
- `ChatSidenavMode` defined in Task 3, consumed in Task 5.
- `ThreadMatch` defined in Task 7, consumed in Task 8.
- All output names consistent: `newChat`, `threadSelected`, `searchOpened`, `openChange` on sidenav; `threadSelected`, `close` on palette.
- All input/model names consistent: `agent`, `mode`, `open`, `threads`, `activeThreadId` on sidenav; `open`, `query`, `results`, `loading`, `placeholder` on palette.
