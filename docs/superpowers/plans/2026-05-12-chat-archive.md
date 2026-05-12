# Chat archive — Phase 3b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add archive/unarchive support to the sidenav: a collapsible "Archived" section, two new optional adapter methods (`archive` + `unarchive`), and a mode-aware menu on `chat-thread-list` (Rename/Archive/Delete in active mode; Unarchive/Delete in archived). Bundles a `ThreadsService` migration from raw `fetch` to `@langchain/langgraph-sdk` for all thread CRUD.

**Architecture:** Adapter-driven, like Phase 3a. The framework stays dumb about lifecycle: consumers pre-filter into `threads` (active) and `archivedThreads` (archived) inputs on `chat-sidenav`. A new `mode` input on `chat-thread-list` drives per-section menu items. Archive/unarchive reuse the existing optimistic-hide mechanism (renamed `pendingDeletes` → `pendingHidden`). No confirmation dialog — archive is reversible.

**Tech Stack:** Angular 21 standalone components, signal inputs/outputs, plain CSS strings, Vitest + Angular TestBed, `@langchain/langgraph-sdk` (already a transitive dep).

**Spec:** [docs/superpowers/specs/2026-05-12-chat-archive-design.md](../specs/2026-05-12-chat-archive-design.md)

---

## File map

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — type extensions + `mode` input + `pendingHidden` rename + menu-items rework + `performArchive`/`performUnarchive` + `showKebab` update.
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` — new mode/archive/unarchive tests.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — `archivedThreads` input + collapsible section.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts` — new archived-section tests.
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — collapsible heading + chevron + empty-state styles.
- `examples/chat/angular/src/app/shell/threads.service.ts` — full rewrite using `@langchain/langgraph-sdk`'s `Client`, plus new methods.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — extend `threadActions` with archive/unarchive.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — bind `[archivedThreads]`.
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated.

**No new files.** Phase 3b extends what Phase 3a delivered.

---

## Task 1: Type extensions

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Read the current file**

Read `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` to confirm where `Thread` and `ThreadActionAdapter` are declared.

- [ ] **Step 2: Extend `Thread`**

Find the `Thread` type definition:

```typescript
export type Thread = {
  id: string;
  /** Optional human-friendly label. Falls back to a slice of the id. */
  title?: string;
  /** Optional epoch-ms timestamp ... */
  updatedAt?: number;
  [key: string]: unknown;
};
```

Insert a new `status` field BEFORE the `[key: string]: unknown` line:

```typescript
export type Thread = {
  id: string;
  /** Optional human-friendly label. Falls back to a slice of the id. */
  title?: string;
  /** Optional epoch-ms timestamp ... */
  updatedAt?: number;
  /** Optional lifecycle status. Undefined treated as 'active'. The framework
   *  does NOT auto-filter by this field — consumers pre-filter into separate
   *  `threads` and `archivedThreads` inputs on chat-sidenav. The field is
   *  typed documentation of intent. */
  status?: 'active' | 'archived';
  [key: string]: unknown;
};
```

- [ ] **Step 3: Extend `ThreadActionAdapter`**

Find the `ThreadActionAdapter` interface:

```typescript
export interface ThreadActionAdapter {
  delete?(threadId: string): Promise<void>;
  rename?(threadId: string, newTitle: string): Promise<void>;
}
```

Add `archive?` and `unarchive?` methods at the end:

```typescript
export interface ThreadActionAdapter {
  delete?(threadId: string): Promise<void>;
  rename?(threadId: string, newTitle: string): Promise<void>;
  /** Archive a thread (reversible). No confirmation dialog — framework calls
   *  this immediately on click. */
  archive?(threadId: string): Promise<void>;
  /** Restore an archived thread to the active list. */
  unarchive?(threadId: string): Promise<void>;
}
```

- [ ] **Step 4: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): extend Thread + ThreadActionAdapter with archive lifecycle"
```

---

## Task 2: `chat-thread-list` mode + archive/unarchive handlers

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

This is the biggest task. Component is fully replaced.

- [ ] **Step 1: Add the `mode` input**

In the class body, near the other inputs (`threads`, `activeThreadId`, `showNewThreadButton`, `actions`), add:

```typescript
readonly mode = input<'active' | 'archived'>('active');
```

- [ ] **Step 2: Rename `pendingDeletes` to `pendingHidden`**

Find:

```typescript
private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
```

Replace with:

```typescript
/** Ids hidden from the rendered list during pending delete, archive, or
 *  unarchive. The framework doesn't distinguish — all three actions hide
 *  the row from the current list until the adapter promise settles. */
private readonly pendingHidden = signal<ReadonlySet<string>>(new Set());
```

In `visibleThreads`, replace the reference to `pendingDeletes()` with `pendingHidden()`:

```typescript
protected readonly visibleThreads = computed<Thread[]>(() => {
  const hidden = this.pendingHidden();
  const renames = this.pendingRenames();
  return this.threads()
    .filter((t) => !hidden.has(t.id))
    .map((t) => (renames.has(t.id) ? ({ ...t, title: renames.get(t.id) }) : t));
});
```

In `performDelete`, replace both `pendingDeletes.update(...)` calls with `pendingHidden.update(...)` — same set semantics, just renamed.

- [ ] **Step 3: Update `currentMenuItems` to be mode-aware**

Replace the existing `currentMenuItems` computed:

```typescript
protected readonly currentMenuItems = computed<OverflowMenuItem[]>(() => {
  const id = this.menuOpenForId();
  if (!id) return [];
  const a = this.actions();
  if (!a) return [];
  const items: OverflowMenuItem[] = [];
  if (this.mode() === 'active') {
    if (a.rename) items.push({ id: 'rename', label: 'Rename' });
    if (a.archive) items.push({ id: 'archive', label: 'Archive' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
  } else {
    if (a.unarchive) items.push({ id: 'unarchive', label: 'Unarchive' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
  }
  return items;
});
```

- [ ] **Step 4: Update `showKebab` to be mode-aware**

Replace:

```typescript
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  return Boolean(a.rename || a.delete);
}
```

With:

```typescript
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  if (this.mode() === 'active') return Boolean(a.rename || a.archive || a.delete);
  return Boolean(a.unarchive || a.delete);
}
```

- [ ] **Step 5: Add archive/unarchive routing in `onMenuAction`**

Find the existing `onMenuAction`. Add two new branches:

```typescript
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
  } else if (id === 'archive') {
    void this.performArchive(threadId);
  } else if (id === 'unarchive') {
    void this.performUnarchive(threadId);
  }
}
```

- [ ] **Step 6: Add `performArchive` and `performUnarchive` methods**

Below the existing `performDelete` method, add:

```typescript
protected async performArchive(threadId: string): Promise<void> {
  const a = this.actions();
  if (!a?.archive) return;
  this.pendingHidden.update((s) => new Set([...s, threadId]));
  try {
    await a.archive(threadId);
  } catch {
    // Rollback: clear override below so the row reappears.
  } finally {
    this.pendingHidden.update((s) => {
      const n = new Set(s);
      n.delete(threadId);
      return n;
    });
  }
}

protected async performUnarchive(threadId: string): Promise<void> {
  const a = this.actions();
  if (!a?.unarchive) return;
  this.pendingHidden.update((s) => new Set([...s, threadId]));
  try {
    await a.unarchive(threadId);
  } catch {
    // Rollback: clear override below so the row reappears.
  } finally {
    this.pendingHidden.update((s) => {
      const n = new Set(s);
      n.delete(threadId);
      return n;
    });
  }
}
```

- [ ] **Step 7: Verify**

Run:
```bash
npx nx run chat:test 2>&1 | tail -5
npx nx run chat:build 2>&1 | tail -3
npx nx lint chat 2>&1 | tail -3
```

All three must pass. Existing 14 tests in the chat-thread-list spec should still pass (no behavioral change to delete/rename flows; only the underlying set name changed and a few new code paths were added).

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): chat-thread-list mode-aware menu + archive/unarchive handlers"
```

---

## Task 3: `chat-thread-list` archive tests

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`

Add new test cases. Existing tests remain unchanged.

- [ ] **Step 1: Add 8 new test cases at the end of the `describe('with adapter', ...)` block**

Inside the `describe('with adapter', ...)` block, BEFORE its closing brace, add:

```typescript
    it('mode="active" with archive action shows Archive in menu', () => {
      const fixture = render({ actions: { archive: vi.fn().mockResolvedValue(undefined) } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Archive');
      expect(labels).not.toContain('Unarchive');
    });

    it('mode="archived" with unarchive action shows Unarchive (and not Rename or Archive)', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { unarchive: vi.fn().mockResolvedValue(undefined), rename: vi.fn().mockResolvedValue(undefined), archive: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toEqual(['Unarchive']);
    });

    it('mode="archived" with unarchive + delete shows Unarchive, Delete in that order', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { unarchive: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const items = document.querySelectorAll('.chat-overflow-menu__item');
      expect(items.length).toBe(2);
      expect((items[0] as HTMLElement).textContent?.trim()).toBe('Unarchive');
      expect((items[1] as HTMLElement).textContent?.trim()).toBe('Delete');
      expect(items[1].classList.contains('chat-overflow-menu__item--destructive')).toBe(true);
    });

    it('Click Archive calls adapter.archive, hides row optimistically, no confirm dialog opens', async () => {
      let resolveArchive!: () => void;
      const archiveSpy = vi.fn(() => new Promise<void>((r) => { resolveArchive = r; }));
      const fixture = render({ actions: { archive: archiveSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Archive') as HTMLElement;
      item.click();
      fixture.detectChanges();
      expect(archiveSpy).toHaveBeenCalledWith('t1');
      // Confirm dialog must NOT appear for archive.
      expect(document.querySelector('.chat-confirm-dialog')).toBeNull();
      // Row hidden optimistically (only 't2' remains).
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
      resolveArchive();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Click Unarchive calls adapter.unarchive and hides row optimistically', async () => {
      let resolveUnarchive!: () => void;
      const unarchiveSpy = vi.fn(() => new Promise<void>((r) => { resolveUnarchive = r; }));
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 't1', title: 'First', status: 'archived' as const },
        { id: 't2', title: 'Second', status: 'archived' as const },
      ]);
      fixture.componentRef.setInput('actions', { unarchive: unarchiveSpy });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Unarchive') as HTMLElement;
      item.click();
      fixture.detectChanges();
      expect(unarchiveSpy).toHaveBeenCalledWith('t1');
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
      resolveUnarchive();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('Archive: when adapter rejects, the hidden row reappears', async () => {
      const archiveSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = render({ actions: { archive: archiveSpy } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Archive') as HTMLElement;
      item.click();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(2);
    });

    it('Unarchive: when adapter rejects, the hidden row reappears', async () => {
      const unarchiveSpy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 't1', title: 'First', status: 'archived' as const },
        { id: 't2', title: 'Second', status: 'archived' as const },
      ]);
      fixture.componentRef.setInput('actions', { unarchive: unarchiveSpy });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Unarchive') as HTMLElement;
      item.click();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(2);
    });

    it('mode="archived" with only rename+archive (no unarchive/delete) hides the kebab', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'A', status: 'archived' as const }]);
      fixture.componentRef.setInput('actions', { rename: vi.fn().mockResolvedValue(undefined), archive: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('mode', 'archived');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.chat-thread-list__kebab')).toBeNull();
    });
```

- [ ] **Step 2: Run tests**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: PASS (existing + 8 new).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
git commit -m "test(chat): chat-thread-list mode + archive/unarchive coverage"
```

---

## Task 4: `chat-sidenav` archived section

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`

- [ ] **Step 1: Update the styles file**

Open `libs/chat/src/lib/styles/chat-sidenav.styles.ts`. Append these rules INSIDE the template literal (before the closing backtick):

```css
  .chat-sidenav__archived { flex-shrink: 0; }
  .chat-sidenav__archived-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px 4px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    cursor: pointer;
  }
  .chat-sidenav__archived-heading:hover { color: var(--ngaf-chat-text); }
  .chat-sidenav__archived-heading:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-sidenav__archived-chevron {
    width: 12px;
    height: 12px;
    transition: transform 150ms ease;
    flex-shrink: 0;
  }
  .chat-sidenav__archived[data-open="true"] .chat-sidenav__archived-chevron {
    transform: rotate(90deg);
  }
  .chat-sidenav__archived-empty {
    padding: 8px 12px;
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-sm);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__archived { display: none; }
```

- [ ] **Step 2: Add `archivedThreads` input + `archivedOpen` signal**

Open `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`.

Near the top, expand the existing Angular imports to include `signal`:

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
```

(If `signal` is already imported, this is a no-op.)

In the class body, after the existing `activeThreadId` input, add:

```typescript
readonly archivedThreads = input<Thread[] | null>(null);
```

Then add the protected state signal near where other protected fields live (or just after the inputs):

```typescript
protected readonly archivedOpen = signal<boolean>(false);
```

- [ ] **Step 3: Add the archived section to the template**

Find the existing `@if (threads() !== null)` block in the template — the one wrapping the Recent `<chat-thread-list>`. AFTER that block's closing brace, insert the archived section:

```html
@if (archivedThreads() !== null) {
  <div
    class="chat-sidenav__archived"
    [attr.data-open]="archivedOpen() ? 'true' : 'false'"
  >
    <button
      type="button"
      class="chat-sidenav__archived-heading"
      [attr.aria-expanded]="archivedOpen() ? 'true' : 'false'"
      aria-controls="chat-sidenav__archived-list"
      (click)="archivedOpen.set(!archivedOpen())"
    >
      <svg class="chat-sidenav__archived-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 6 15 12 9 18"/>
      </svg>
      <span>Archived</span>
    </button>
    @if (archivedOpen()) {
      <div id="chat-sidenav__archived-list">
        @if (archivedThreads()!.length === 0) {
          <div class="chat-sidenav__archived-empty">No archived conversations.</div>
        } @else {
          <chat-thread-list
            mode="archived"
            [threads]="archivedThreads()!"
            [activeThreadId]="activeThreadId() ?? ''"
            [actions]="actions()"
            (threadSelected)="threadSelected.emit($event)"
          />
        }
      </div>
    }
  </div>
}
```

Place this BEFORE the existing `<div class="chat-sidenav__sections">` (the `[sidenavSections]` slot wrapper).

- [ ] **Step 4: Verify**

Run:
```bash
npx nx run chat:test 2>&1 | tail -5
npx nx run chat:build 2>&1 | tail -3
npx nx lint chat 2>&1 | tail -3
```

If lint flags the new `<button class="chat-sidenav__archived-heading">` for `interactive-supports-focus`, the button is natively focusable so the rule should be satisfied. If it isn't, double-check no `tabindex="-1"` snuck in.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts libs/chat/src/lib/styles/chat-sidenav.styles.ts
git commit -m "feat(chat): chat-sidenav archived collapsible section"
```

---

## Task 5: `chat-sidenav` archived-section tests

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`

Add new test cases. Existing tests remain unchanged.

- [ ] **Step 1: Add four new test cases at the end of the existing describe block**

Find the closing of the `describe('ChatSidenavComponent', ...)` block. BEFORE the closing brace, add:

```typescript
  it('archivedThreads=null renders no archived heading', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__archived')).toBeNull();
  });

  it('archivedThreads=[] renders the heading; clicking expands to show empty state', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', []);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    expect(heading).not.toBeNull();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.chat-sidenav__archived-empty')).not.toBeNull();
  });

  it('archivedThreads=[t1,t2] renders the heading; expanding shows a chat-thread-list with mode="archived"', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', [{ id: 'a1', title: 'A1' }, { id: 'a2', title: 'A2' }]);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    heading.click();
    fixture.detectChanges();
    const lists = fixture.nativeElement.querySelectorAll('chat-thread-list');
    // The first is the Recent list; the second is the archived list.
    expect(lists.length).toBe(2);
    expect(lists[1].getAttribute('mode')).toBe('archived');
  });

  it('clicking the archived heading toggles aria-expanded', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('archivedThreads', []);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.chat-sidenav__archived-heading') as HTMLButtonElement;
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    heading.click();
    fixture.detectChanges();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
  });
```

The existing `render()` helper in the spec already takes a `threads` option. If it doesn't take `archivedThreads` directly, the tests above use `fixture.componentRef.setInput('archivedThreads', ...)` to set it after-the-fact, which is fine.

- [ ] **Step 2: Run tests**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: PASS (existing + 4 new).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
git commit -m "test(chat): chat-sidenav archived section coverage"
```

---

## Task 6: Migrate `ThreadsService` to `@langchain/langgraph-sdk`

**Files:**
- Modify: `examples/chat/angular/src/app/shell/threads.service.ts`

This is a full rewrite. The existing class becomes shorter by switching to SDK client methods, while gaining four new methods (`delete` and `rename` already existed in Phase 3a but now go through the SDK; `archive` and `unarchive` are new) and one new signal (`archivedThreads`).

- [ ] **Step 1: Replace the entire file**

Replace the contents of `examples/chat/angular/src/app/shell/threads.service.ts` with:

```typescript
// SPDX-License-Identifier: MIT
import { Injectable, signal } from '@angular/core';
import { Client, type Thread as SdkThread } from '@langchain/langgraph-sdk';
import type { Thread } from '@ngaf/chat';

const API_URL = 'http://localhost:2024';

@Injectable({ providedIn: 'root' })
export class ThreadsService {
  private readonly client = new Client({ apiUrl: API_URL });

  readonly threads = signal<Thread[]>([]);
  readonly archivedThreads = signal<Thread[]>([]);

  async refresh(): Promise<void> {
    try {
      const list = await this.client.threads.search({ limit: 50 });
      const mapped = list.map((t) => this.toThread(t));
      this.threads.set(mapped.filter((t) => t.status !== 'archived'));
      this.archivedThreads.set(mapped.filter((t) => t.status === 'archived'));
    } catch {
      // Backend may be down; leave signals as-is.
    }
  }

  async create(): Promise<string | null> {
    try {
      const t = await this.client.threads.create({ metadata: {} });
      await this.refresh();
      return t.thread_id;
    } catch {
      return null;
    }
  }

  async delete(threadId: string): Promise<void> {
    await this.client.threads.delete(threadId);
    await this.refresh();
  }

  async rename(threadId: string, newTitle: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { title: newTitle } });
    await this.refresh();
  }

  async archive(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { archived: true } });
    await this.refresh();
  }

  async unarchive(threadId: string): Promise<void> {
    await this.client.threads.update(threadId, { metadata: { archived: false } });
    await this.refresh();
  }

  /** Best-effort title from thread metadata; falls back to a truncated id. */
  private toThread(t: SdkThread): Thread {
    const meta = (t.metadata ?? {}) as { title?: unknown; archived?: unknown };
    const customTitle = meta.title;
    const archived = meta.archived === true;
    return {
      id: t.thread_id,
      title: typeof customTitle === 'string' && customTitle.length > 0
        ? customTitle
        : `Thread ${t.thread_id.slice(0, 8)}`,
      status: archived ? 'archived' : 'active',
    };
  }
}
```

- [ ] **Step 2: Build the example**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -5`
Expected: PASS.

If the build complains that `@langchain/langgraph-sdk` is not a direct dependency of `examples-chat-angular`, the package is already a transitive dep via `@ngaf/langgraph` and resolves through tsconfig paths. If TypeScript still errors on the import, check `tsconfig.base.json` for an alias or ensure `paths` resolution covers it.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/threads.service.ts
git commit -m "refactor(examples-chat): migrate ThreadsService to @langchain/langgraph-sdk; add archive/unarchive"
```

---

## Task 7: Wire archive in the shell

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Extend `threadActions` in the TS**

Open `examples/chat/angular/src/app/shell/demo-shell.component.ts`. Find the existing `threadActions: ThreadActionAdapter` declaration. Replace its full body with:

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
  archive: async (id) => {
    await this.threadsSvc.archive(id);
    if (this.threadIdSignal() === id) {
      this.threadIdSignal.set(null);
      this.persistence.write('threadId', null);
    }
  },
  unarchive: (id) => this.threadsSvc.unarchive(id),
};
```

- [ ] **Step 2: Bind `archivedThreads` in the template**

Open `examples/chat/angular/src/app/shell/demo-shell.component.html`. Find the existing `<chat-sidenav>` element. Add `[archivedThreads]="threadsSvc.archivedThreads()"` to its attribute list (preserve all existing bindings):

```html
<chat-sidenav
  [threads]="threadsSvc.threads()"
  [archivedThreads]="threadsSvc.archivedThreads()"
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

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "feat(examples-chat): wire archive/unarchive + archivedThreads on chat-sidenav"
```

---

## Task 8: Regenerate API docs

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [ ] **Step 1: Regenerate**

Run from the worktree:

```bash
npx tsx apps/website/scripts/generate-api-docs.ts 2>&1 | tail -5
```

Expected: `✓ chat/api/api-docs.json (N entries)` with N reflecting the new `Thread.status` field documentation and the new `archive`/`unarchive` methods on `ThreadActionAdapter`.

- [ ] **Step 2: Stage + verify**

Run: `git diff --stat apps/website/content/docs/chat/api/api-docs.json`
Expected: changes only to that file.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/api/api-docs.json
git commit -m "docs(chat): regenerate API docs for archive lifecycle"
```

---

## Task 9: Manual browser verification

**Files:** none — verification only.

This is the controller's job; subagents should stop after Task 8 and report.

The controller will:

1. Start the dev server from a worktree where `node_modules` exists and the impl branch is checked out. Note: previous tasks revealed that nx serve can pick up stale `dist/libs/chat` if not cleared after a build. The controller should `rm -rf dist/libs/chat dist/libs/render` before `nx serve`.
2. Resize to desktop preset.
3. Click into a thread with content.
4. Verify each behavior:
   - Sidenav renders Recent + collapsed **"Archived"** heading at the bottom of the threads area.
   - Hover an active row → kebab fades in. Click kebab → menu lists: **Rename, Archive, Delete** (Delete styled red).
   - Click **Archive** → row vanishes from Recent immediately; no dialog; LangGraph PATCH succeeds with `metadata.archived: true`.
   - Click the **Archived** heading → section expands; the previously-active-now-archived thread appears.
   - Hover an archived row → kebab fades in. Click kebab → menu lists: **Unarchive, Delete**.
   - Click **Unarchive** → row vanishes from Archived; reappears in Recent after refresh.
   - Archive the *currently open* thread → row vanishes AND chat returns to welcome state (shell cleanup).
   - Reload page → archived state persists on LangGraph thread metadata.
   - Resize to mobile → sidenav switches to drawer mode; archived section still visible inside the drawer.
5. Capture screenshots: archived heading collapsed, archived heading expanded with rows, archived-row menu open with Unarchive + Delete.
6. Stop preview.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `Thread.status?` optional field | Task 1 |
| `ThreadActionAdapter.archive?` + `unarchive?` | Task 1 |
| `chat-thread-list.mode` input | Task 2 |
| `pendingDeletes` → `pendingHidden` rename | Task 2 |
| Mode-aware `currentMenuItems` | Task 2 |
| Mode-aware `showKebab` | Task 2 |
| `performArchive` / `performUnarchive` with rollback | Task 2 |
| Archive/unarchive routing in `onMenuAction` | Task 2 |
| No confirm dialog for archive/unarchive | Task 2 (verified in Task 3 test) |
| `chat-thread-list` tests (8 new) | Task 3 |
| `chat-sidenav.archivedThreads` input | Task 4 |
| Collapsible heading with chevron | Task 4 (template + styles) |
| Empty-state inside archived section | Task 4 |
| `mode="archived"` collapsed-rail hides section | Task 4 (style) |
| `chat-sidenav` tests (4 new) | Task 5 |
| `ThreadsService` SDK migration | Task 6 |
| `archive`/`unarchive` methods on service | Task 6 |
| Shell `threadActions` with archive | Task 7 |
| Active-thread cleanup on archive | Task 7 |
| `[archivedThreads]` binding | Task 7 |
| API docs regen | Task 8 |
| Manual verification | Task 9 |

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `Thread.status` field used in Task 6 (`toThread` returns `status: 'archived' | 'active'`) matches Task 1's `Thread` type definition.
- `ThreadActionAdapter.archive`/`unarchive` referenced in Task 2 (`performArchive`/`performUnarchive`) and Task 7 (shell wiring) matches Task 1's adapter shape.
- `mode: 'active' | 'archived'` used in Task 2 (input), Task 4 (template `mode="archived"`), and Task 3/5 (tests) — consistent literal union.
- All method names consistent: `performArchive`, `performUnarchive`, `archive`, `unarchive`.
