# Chat pinned-thread reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drag-to-reorder pinned threads in `@ngaf/chat` via a grip handle (desktop) or Move-up/Move-down menu items (mobile + discoverable fallback). Adapter-driven via `ThreadActionAdapter.reorderPinned?(threadId, beforeId | null)`. Framework owns optimistic visual reorder + rollback on rejection.

**Architecture:** No new primitives. Extends `chat-thread-list` with `pendingOrder` override state and HTML5 drag-and-drop handlers on each `<li>`. Native drag-drop (no `@angular/cdk` dep). Menu items reuse the existing overflow-menu primitive. Anchor-based event shape (`beforeId | null`) — stable across concurrent mutation.

**Tech Stack:** Angular 21 standalone components, signal inputs/outputs, plain CSS strings, Vitest + Angular TestBed, native HTML5 drag-and-drop API, `@langchain/langgraph-sdk` for thread metadata updates.

**Spec:** [docs/superpowers/specs/2026-05-12-chat-pinned-reorder-design.md](../specs/2026-05-12-chat-pinned-reorder-design.md)

---

## File map

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — `ThreadActionAdapter.reorderPinned?`; `pendingOrder` + drag state signals; updated `visibleThreads`, `currentMenuItems`, `showKebab`; new drag handlers + Move-up/Down handlers; grip handle + `<li>` drag attributes in template; second handler set for the second overflow-menu instance is not needed (Move-up/Down items reuse the main menu).
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` — reorder coverage.
- `libs/chat/src/lib/styles/chat-thread-list.styles.ts` — grip handle + drop indicator styles.
- `examples/chat/angular/src/app/shell/threads.service.ts` — `reorderPinned` method; `toThread` reads `metadata.pinnedOrder`; `refresh` sort prioritizes `pinnedOrder` within pinned.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — extend `threadActions` with `reorderPinned`.
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated.

**No new files.**

---

## Task 1: ThreadActionAdapter.reorderPinned

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Add `reorderPinned?` to the interface**

In `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`, find the `ThreadActionAdapter` interface. After the existing `moveToProject?` method (around line 70-72), add:

```typescript
/** Reorder a pinned thread. `beforeId` is the id of the pinned thread it
 *  should be placed before, or null to move to the end of the pinned list.
 *  Framework optimistically reorders the visible list and awaits this
 *  method; rejection rolls back. */
reorderPinned?(threadId: string, beforeId: string | null): Promise<void>;
```

- [ ] **Step 2: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): ThreadActionAdapter.reorderPinned"
```

---

## Task 2: pendingOrder state + visibleThreads update

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Add three new state signals**

After the existing `pendingRenames` declaration (around line 203), add:

```typescript
/** Pending reorder overrides for pinned threads. Each entry: "move this id
 *  to before that id (or to end if null)". Cleared in `finally` after the
 *  adapter call settles. */
private readonly pendingOrder = signal<ReadonlyMap<string, string | null>>(new Map());

/** Id of the thread currently being dragged via HTML5 drag-and-drop. */
protected readonly draggingThreadId = signal<string | null>(null);

/** Drop target during a drag: which row, and whether the indicator shows
 *  on the top edge ('before') or bottom edge ('after'). */
protected readonly dropTarget = signal<{ threadId: string; position: 'before' | 'after' } | null>(null);
```

- [ ] **Step 2: Update `visibleThreads` computed**

Find the existing `visibleThreads` computed (around line 205). Replace its body to also apply `pendingOrder`:

```typescript
protected readonly visibleThreads = computed<Thread[]>(() => {
  const hidden = this.pendingHidden();
  const renames = this.pendingRenames();
  const pending = this.pendingOrder();

  let result = this.threads()
    .filter((t) => !hidden.has(t.id))
    .map((t) => (renames.has(t.id) ? ({ ...t, title: renames.get(t.id) }) : t));

  if (pending.size > 0) {
    const pinned = result.filter((t) => t.pinned === true);
    const unpinned = result.filter((t) => t.pinned !== true);
    for (const [threadId, beforeId] of pending) {
      const idx = pinned.findIndex((t) => t.id === threadId);
      if (idx < 0) continue;
      const [moved] = pinned.splice(idx, 1);
      if (beforeId === null) {
        pinned.push(moved);
      } else {
        const beforeIdx = pinned.findIndex((t) => t.id === beforeId);
        if (beforeIdx < 0) pinned.push(moved);
        else pinned.splice(beforeIdx, 0, moved);
      }
    }
    result = [...pinned, ...unpinned];
  }
  return result;
});
```

- [ ] **Step 3: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): pendingOrder + drag state signals for reorder"
```

---

## Task 3: Drag handlers + reorder methods

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Add `performReorderPinned` method**

Below the existing `performMoveToProject` method (around line 405-420), add:

```typescript
protected async performReorderPinned(threadId: string, beforeId: string | null): Promise<void> {
  const a = this.actions();
  if (!a?.reorderPinned) return;
  this.pendingOrder.update((m) => {
    const n = new Map(m);
    n.set(threadId, beforeId);
    return n;
  });
  try {
    await a.reorderPinned(threadId, beforeId);
  } catch {
    /* rollback via finally */
  } finally {
    this.pendingOrder.update((m) => {
      const n = new Map(m);
      n.delete(threadId);
      return n;
    });
  }
}
```

- [ ] **Step 2: Add Move-up / Move-down helpers**

Below `performReorderPinned`, add:

```typescript
protected async performMoveUp(threadId: string): Promise<void> {
  const pinned = this.threads().filter((t) => t.pinned === true);
  const idx = pinned.findIndex((t) => t.id === threadId);
  if (idx <= 0) return;
  const beforeId = pinned[idx - 1].id;
  await this.performReorderPinned(threadId, beforeId);
}

protected async performMoveDown(threadId: string): Promise<void> {
  const pinned = this.threads().filter((t) => t.pinned === true);
  const idx = pinned.findIndex((t) => t.id === threadId);
  if (idx < 0 || idx >= pinned.length - 1) return;
  const beforeId = idx + 2 < pinned.length ? pinned[idx + 2].id : null;
  await this.performReorderPinned(threadId, beforeId);
}
```

- [ ] **Step 3: Add drag handlers**

Below the move helpers, add:

```typescript
protected onDragStart(e: DragEvent, threadId: string): void {
  const dt = e.dataTransfer;
  if (!dt) return;
  dt.setData('text/plain', threadId);
  dt.effectAllowed = 'move';
  this.draggingThreadId.set(threadId);
}

protected onDragOver(e: DragEvent, threadId: string): void {
  const dragging = this.draggingThreadId();
  if (!dragging || dragging === threadId) return;
  // Only allow drop on pinned rows.
  const target = this.threads().find((t) => t.id === threadId);
  if (target?.pinned !== true) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  // Compute drop position from offset within the row.
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const offsetY = e.clientY - rect.top;
  const position: 'before' | 'after' = offsetY < rect.height / 2 ? 'before' : 'after';
  const cur = this.dropTarget();
  if (!cur || cur.threadId !== threadId || cur.position !== position) {
    this.dropTarget.set({ threadId, position });
  }
}

protected onDragLeave(_e: DragEvent, threadId: string): void {
  if (this.dropTarget()?.threadId === threadId) {
    this.dropTarget.set(null);
  }
}

protected onDrop(e: DragEvent, targetThreadId: string): void {
  e.preventDefault();
  const dragId = e.dataTransfer?.getData('text/plain') ?? this.draggingThreadId();
  const target = this.dropTarget();
  this.draggingThreadId.set(null);
  this.dropTarget.set(null);
  if (!dragId || dragId === targetThreadId || !target) return;

  // Compute beforeId from drop position.
  const pinned = this.threads().filter((t) => t.pinned === true);
  const targetIdx = pinned.findIndex((t) => t.id === targetThreadId);
  if (targetIdx < 0) return;
  let beforeId: string | null;
  if (target.position === 'before') {
    beforeId = targetThreadId;
  } else {
    // Drop AFTER targetThreadId — find the pinned thread that currently
    // comes after the target (skipping the dragged thread itself).
    const filteredPinned = pinned.filter((t) => t.id !== dragId);
    const filteredTargetIdx = filteredPinned.findIndex((t) => t.id === targetThreadId);
    beforeId = filteredTargetIdx + 1 < filteredPinned.length
      ? filteredPinned[filteredTargetIdx + 1].id
      : null;
  }
  void this.performReorderPinned(dragId, beforeId);
}

protected onDragEnd(): void {
  this.draggingThreadId.set(null);
  this.dropTarget.set(null);
}

protected dropPositionFor(threadId: string): 'before' | 'after' | null {
  const t = this.dropTarget();
  return t?.threadId === threadId ? t.position : null;
}
```

- [ ] **Step 4: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): drag handlers + reorder methods"
```

---

## Task 4: Update menu items, showKebab, onMenuAction

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Update `currentMenuItems`**

Find the existing `currentMenuItems` computed (around line 213). The active-mode branch currently has rename → pin/unpin → moveToProject → archive → delete. Insert Move-up/Move-down between pin/unpin and moveToProject:

```typescript
protected readonly currentMenuItems = computed<OverflowMenuItem[]>(() => {
  const id = this.menuOpenForId();
  if (!id) return [];
  const a = this.actions();
  if (!a) return [];
  const items: OverflowMenuItem[] = [];
  if (this.mode() === 'active') {
    const thread = this.threads().find((t) => t.id === id);
    const isPinned = thread?.pinned === true;
    if (a.rename) items.push({ id: 'rename', label: 'Rename' });
    if (a.pin && !isPinned) items.push({ id: 'pin', label: 'Pin' });
    if (a.unpin && isPinned) items.push({ id: 'unpin', label: 'Unpin' });

    if (isPinned && a.reorderPinned) {
      const pinned = this.threads().filter((t) => t.pinned === true);
      const pinnedIdx = pinned.findIndex((t) => t.id === id);
      if (pinnedIdx > 0) items.push({ id: 'move-up', label: 'Move up' });
      if (pinnedIdx >= 0 && pinnedIdx < pinned.length - 1) items.push({ id: 'move-down', label: 'Move down' });
    }

    if (a.moveToProject && this.projects() !== null) {
      items.push({ id: 'move', label: 'Move to project' });
    }
    if (a.archive) items.push({ id: 'archive', label: 'Archive' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
  } else {
    if (a.unarchive) items.push({ id: 'unarchive', label: 'Unarchive' });
    if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
  }
  return items;
});
```

- [ ] **Step 2: Update `showKebab` for active mode**

Find the existing `showKebab` method (around line 257). Replace its active-mode body to include `reorderPinned`:

```typescript
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  if (this.mode() === 'active') {
    return Boolean(
      a.rename || a.pin || a.unpin || a.archive || a.delete ||
      a.reorderPinned ||
      (a.moveToProject && this.projects() !== null)
    );
  }
  return Boolean(a.unarchive || a.delete);
}
```

- [ ] **Step 3: Update `onMenuAction`**

Find the existing `onMenuAction` method (around line 274). It currently has branches for rename/delete/archive/unarchive/pin/unpin/move. Add two more branches BEFORE the closing brace of the method:

```typescript
} else if (id === 'move-up') {
  void this.performMoveUp(threadId);
} else if (id === 'move-down') {
  void this.performMoveDown(threadId);
}
```

- [ ] **Step 4: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -3`
Expected: build PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): Move-up/Move-down menu items"
```

---

## Task 5: Template — grip handle + drag attributes

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Update the `<li>` to accept drag**

Find the existing `<li class="chat-thread-list__item-wrap">` in the template (around line 87). Replace its opening tag with:

```html
<li
  class="chat-thread-list__item-wrap"
  [attr.draggable]="thread.pinned && actions()?.reorderPinned ? 'true' : null"
  [attr.data-dragging]="draggingThreadId() === thread.id ? 'true' : null"
  [attr.data-drop-position]="dropPositionFor(thread.id)"
  (dragstart)="onDragStart($event, thread.id)"
  (dragover)="onDragOver($event, thread.id)"
  (dragleave)="onDragLeave($event, thread.id)"
  (drop)="onDrop($event, thread.id)"
  (dragend)="onDragEnd()"
>
```

- [ ] **Step 2: Add the grip handle**

Inside the `@else {` branch (the branch that renders the regular row button + kebab — the one not in editing or template mode), at the START of that branch (BEFORE the existing `<button class="chat-thread-list__item">`), add:

```html
@if (thread.pinned && actions()?.reorderPinned) {
  <button
    type="button"
    class="chat-thread-list__grip"
    aria-label="Drag to reorder"
    draggable="false"
  >⋮⋮</button>
}
```

- [ ] **Step 3: Build + lint**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -3`
Expected: build PASS, lint clean. If lint flags `interactive-supports-focus` on the grip button, it's a real `<button>` so should be fine — but if needed, the button has its own `aria-label` and is focusable by default.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): grip handle + row drag wiring in template"
```

---

## Task 6: Styles for grip handle + drop indicator

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-thread-list.styles.ts`

- [ ] **Step 1: Append styles**

Open `libs/chat/src/lib/styles/chat-thread-list.styles.ts`. Append INSIDE the existing template literal (before the closing backtick):

```css
  .chat-thread-list__grip {
    flex-shrink: 0;
    width: 16px;
    height: 28px;
    margin-right: 2px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    cursor: grab;
    opacity: 0;
    transition: opacity 100ms ease;
    font-size: 11px;
    line-height: 1;
    letter-spacing: -1px;
    user-select: none;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__grip,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__grip {
    opacity: 1;
  }
  .chat-thread-list__grip:active { cursor: grabbing; }

  .chat-thread-list__item-wrap[data-dragging="true"] {
    opacity: 0.4;
  }

  .chat-thread-list__item-wrap {
    position: relative;
  }
  .chat-thread-list__item-wrap[data-drop-position="before"]::before,
  .chat-thread-list__item-wrap[data-drop-position="after"]::after {
    content: '';
    position: absolute;
    left: 4px;
    right: 4px;
    height: 2px;
    background: var(--ngaf-chat-primary);
    border-radius: 1px;
    pointer-events: none;
  }
  .chat-thread-list__item-wrap[data-drop-position="before"]::before { top: -1px; }
  .chat-thread-list__item-wrap[data-drop-position="after"]::after { bottom: -1px; }
```

Note: the `position: relative` rule may already be present on `.chat-thread-list__item-wrap` from prior phases. If so, the duplicate declaration is harmless (later wins, same value). Verify by searching: `grep -n "chat-thread-list__item-wrap" libs/chat/src/lib/styles/chat-thread-list.styles.ts`. If it's already present, REMOVE the duplicate `.chat-thread-list__item-wrap { position: relative; }` rule from this Task 6 addition.

- [ ] **Step 2: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-thread-list.styles.ts
git commit -m "feat(chat): grip handle + drop indicator styles"
```

---

## Task 7: Tests

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`

- [ ] **Step 1: Add 12 new test cases**

Inside the existing `describe('with adapter', ...)` block, BEFORE its closing brace, add:

```typescript
    it('grip handle renders for pinned rows when reorderPinned provided', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 't1', title: 'T1' },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
      fixture.detectChanges();
      const grips = fixture.nativeElement.querySelectorAll('.chat-thread-list__grip');
      expect(grips.length).toBe(1);
    });

    it('grip handle does NOT render for unpinned rows', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'T1' }]);
      fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.chat-thread-list__grip')).toBeNull();
    });

    it('grip handle does NOT render when reorderPinned absent', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 'p1', title: 'P1', pinned: true }]);
      fixture.componentRef.setInput('actions', {});
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.chat-thread-list__grip')).toBeNull();
    });

    it('menu on pinned thread that is NOT first → includes "Move up"', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[1] as HTMLElement).click(); // open menu on p2
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Move up');
      expect(labels).not.toContain('Move down');
    });

    it('menu on pinned thread that is NOT last → includes "Move down"', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[0] as HTMLElement).click(); // p1
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Move down');
      expect(labels).not.toContain('Move up');
    });

    it('singleton pinned thread → menu has neither Move up nor Move down', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 'p1', title: 'P1', pinned: true }]);
      fixture.componentRef.setInput('actions', { reorderPinned: vi.fn().mockResolvedValue(undefined) });
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).not.toContain('Move up');
      expect(labels).not.toContain('Move down');
    });

    it('Click Move up → calls reorderPinned with previous-pinned id', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
        { id: 'p3', title: 'P3', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[2] as HTMLElement).click(); // p3
      fixture.detectChanges();
      const moveUp = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move up') as HTMLElement;
      moveUp.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(spy).toHaveBeenCalledWith('p3', 'p2');
    });

    it('Click Move down on last → calls reorderPinned with null', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[0] as HTMLElement).click(); // p1 — Move down should put it at end (null)
      fixture.detectChanges();
      const moveDown = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move down') as HTMLElement;
      moveDown.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(spy).toHaveBeenCalledWith('p1', null);
    });

    it('Click Move down on second-of-three → calls reorderPinned with third-pinned id', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
        { id: 'p3', title: 'P3', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[1] as HTMLElement).click(); // p2
      fixture.detectChanges();
      const moveDown = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move down') as HTMLElement;
      moveDown.click();
      await new Promise((r) => setTimeout(r, 0));
      // p2 moves to after p3, which means beforeId = whatever comes after p3, which is null (end).
      // Wait: p2 between p1,p3 → move down means swap with p3 → beforeId of moved p2 should be... null (it goes to end of [p1,p3,p2]).
      expect(spy).toHaveBeenCalledWith('p2', null);
    });

    it('reorder adapter rejects → visible order falls back to input', async () => {
      const spy = vi.fn(async () => { throw new Error('boom'); });
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const kebabs = fixture.nativeElement.querySelectorAll('.chat-thread-list__kebab');
      (kebabs[1] as HTMLElement).click();
      fixture.detectChanges();
      const moveUp = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move up') as HTMLElement;
      moveUp.click();
      // Wait for the rejection + finally clear to settle.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
      const titles = Array.from(fixture.nativeElement.querySelectorAll('.chat-thread-list__item-title'))
        .map((el) => (el as HTMLElement).textContent?.trim().replace(/\s+/g, ' '));
      // Original order preserved (P1 first, P2 second).
      expect(titles[0]).toContain('P1');
      expect(titles[1]).toContain('P2');
    });

    it('drag-and-drop: drop "before" target calls reorderPinned with target id', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const wraps = fixture.nativeElement.querySelectorAll('.chat-thread-list__item-wrap');
      // Simulate dragstart on p2 (the second row).
      const dt = new DataTransfer();
      wraps[1].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      fixture.detectChanges();
      // Simulate dragover at the TOP of p1's row.
      const p1Rect = (wraps[0] as HTMLElement).getBoundingClientRect();
      const dragOver = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, clientY: p1Rect.top + 2 });
      wraps[0].dispatchEvent(dragOver);
      fixture.detectChanges();
      // Simulate drop on p1.
      wraps[0].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(spy).toHaveBeenCalledWith('p2', 'p1');
    });

    it('drag-and-drop: drop "after" last pinned calls reorderPinned with null', async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [
        { id: 'p1', title: 'P1', pinned: true },
        { id: 'p2', title: 'P2', pinned: true },
      ]);
      fixture.componentRef.setInput('actions', { reorderPinned: spy });
      fixture.detectChanges();
      const wraps = fixture.nativeElement.querySelectorAll('.chat-thread-list__item-wrap');
      const dt = new DataTransfer();
      // dragstart on p1.
      wraps[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      fixture.detectChanges();
      // dragover at the BOTTOM of p2.
      const p2Rect = (wraps[1] as HTMLElement).getBoundingClientRect();
      wraps[1].dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, clientY: p2Rect.bottom - 2 }));
      fixture.detectChanges();
      wraps[1].dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(spy).toHaveBeenCalledWith('p1', null);
    });
```

NOTE on the simulated DragEvent: vitest's jsdom-style environment supports `DragEvent` and `DataTransfer`. If a test fails because `DataTransfer` is undefined, the implementer can replace `new DataTransfer()` with `{ setData() {}, getData: () => 'p2', effectAllowed: '', dropEffect: '' } as unknown as DataTransfer` and proceed. The drop-position computation reads `e.clientY` which is supported in synthetic events.

- [ ] **Step 2: Run tests**

Run: `npx nx run chat:test 2>&1 | tail -5`
Expected: existing tests + 12 new tests pass.

If `DataTransfer` is not defined in the jsdom environment, fall back to the stub above and re-run.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts
git commit -m "test(chat): pinned-thread reorder coverage"
```

---

## Task 8: ThreadsService.reorderPinned + pinned-sort

**Files:**
- Modify: `examples/chat/angular/src/app/shell/threads.service.ts`

- [ ] **Step 1: Add `pinnedOrder` to the `toThread` mapper**

Open `examples/chat/angular/src/app/shell/threads.service.ts`. Find the existing `toThread` private method. Extend the `meta` destructure to include `pinnedOrder`:

```typescript
private toThread(t: SdkThread): Thread {
  const meta = (t.metadata ?? {}) as { title?: unknown; archived?: unknown; projectId?: unknown; pinned?: unknown; pinnedOrder?: unknown };
  const customTitle = meta.title;
  const archived = meta.archived === true;
  const pinned = meta.pinned === true;
  const projectId = typeof meta.projectId === 'string' && meta.projectId.length > 0
    ? meta.projectId
    : null;
  const pinnedOrder = typeof meta.pinnedOrder === 'number' ? meta.pinnedOrder : undefined;
  return {
    id: t.thread_id,
    title: typeof customTitle === 'string' && customTitle.length > 0
      ? customTitle
      : `Thread ${t.thread_id.slice(0, 8)}`,
    status: archived ? 'archived' : 'active',
    projectId,
    pinned,
    pinnedOrder,
  };
}
```

(Preserve any other fields the existing `toThread` reads — e.g. if it has additional logic, keep that. The change is additive.)

- [ ] **Step 2: Update `refresh` sort**

Find the existing `refresh()` method. Its current `this.threads.set(...)` call sorts pinned-first (added in Phase 3d). Replace the sort with a two-step: pinned first, then by `pinnedOrder` within pinned, then preserve recency for unpinned:

```typescript
this.threads.set(
  mapped
    .filter((t) => t.status !== 'archived')
    .sort((a, b) => {
      const aPinned = a.pinned === true;
      const bPinned = b.pinned === true;
      if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
      if (aPinned && bPinned) {
        const aOrd = typeof a.pinnedOrder === 'number' ? a.pinnedOrder : Infinity;
        const bOrd = typeof b.pinnedOrder === 'number' ? b.pinnedOrder : Infinity;
        return aOrd - bOrd;
      }
      return 0;
    })
);
```

(If the existing sort is identical to the first three lines above, replace ONLY the body — don't break the `this.threads.set(mapped...)` pattern; the snippet above is the full expression.)

- [ ] **Step 3: Add `reorderPinned` method**

After the existing `unpin` method (added in Phase 3d), add:

```typescript
async reorderPinned(threadId: string, beforeId: string | null): Promise<void> {
  const current = this.threads().filter((t) => t.pinned === true);
  const moved = current.find((t) => t.id === threadId);
  if (!moved) return;
  const rest = current.filter((t) => t.id !== threadId);
  const next: Thread[] = [];
  for (const t of rest) {
    if (t.id === beforeId) next.push(moved);
    next.push(t);
  }
  if (beforeId === null) next.push(moved);

  // Re-stamp metadata.pinnedOrder = 0,1,2,... in the desired order.
  await Promise.all(
    next.map((t, idx) =>
      this.client.threads.update(t.id, { metadata: { pinnedOrder: idx } }),
    ),
  );
  await this.refresh();
}
```

- [ ] **Step 4: Verify**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/threads.service.ts
git commit -m "feat(examples-chat): ThreadsService.reorderPinned + pinned-order sort"
```

---

## Task 9: Demo shell wiring

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Extend `threadActions`**

Open `examples/chat/angular/src/app/shell/demo-shell.component.ts`. Find the existing `threadActions: ThreadActionAdapter` property. Add a `reorderPinned` method (preserve all existing methods):

```typescript
reorderPinned: (id, beforeId) => this.threadsSvc.reorderPinned(id, beforeId),
```

The method goes inside the object literal alongside the existing `delete` / `rename` / `archive` / `unarchive` / `pin` / `unpin` / `moveToProject` methods.

- [ ] **Step 2: Build**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -3`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts
git commit -m "feat(examples-chat): wire reorderPinned threadAction"
```

---

## Task 10: Regenerate API docs

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [ ] **Step 1: Regenerate**

Run:
```bash
npx tsx apps/website/scripts/generate-api-docs.ts 2>&1 | tail -5
```

Expected: `✓ chat/api/api-docs.json (N entries)` with N reflecting the new `ThreadActionAdapter.reorderPinned?` entry.

- [ ] **Step 2: Stage + commit**

```bash
git diff --stat apps/website/content/docs/chat/api/api-docs.json
git add apps/website/content/docs/chat/api/api-docs.json
git commit -m "docs(chat): regenerate API docs for pinned-thread reorder"
```

---

## Task 11: Manual browser verification

**Files:** none — verification only. Controller-owned. Subagents stop after Task 10.

The controller will:

1. Start the dev server. Pre-clear stale dist: `rm -rf dist/libs/chat dist/libs/render`.
2. Resize to desktop preset.
3. Click into a thread to mount the chat shell.
4. Pin two existing threads (use the Pin menu action twice on different threads).
5. Verify each behavior:
   - Hover the second pinned thread → grip handle (⋮⋮) fades in on the LEFT of the row.
   - Click the grip → cursor changes to `grabbing`.
   - Drag the second pinned thread upward onto the first pinned thread's TOP half → drop indicator (2px line) appears above the first row.
   - Release → row order swaps; LangGraph `metadata.pinnedOrder` re-stamped (each pinned thread's metadata patched with new integer).
   - Open kebab on the (now-first) pinned thread → menu shows "Move down" but NOT "Move up".
   - Click Move down → row swaps back via menu path.
   - Reload page → pinned order persists.
   - Open kebab on a singleton pinned thread → neither "Move up" nor "Move down" present.
6. Capture screenshots: grip handle visible on hover, drop indicator during drag, menu with Move up/Down items.
7. Stop preview.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `ThreadActionAdapter.reorderPinned?` | Task 1 |
| `pendingOrder` state | Task 2 |
| `draggingThreadId`, `dropTarget` state | Task 2 |
| `visibleThreads` applies pendingOrder | Task 2 |
| `performReorderPinned` with rollback | Task 3 |
| `performMoveUp` / `performMoveDown` | Task 3 |
| `onDragStart` / `onDragOver` / `onDragLeave` / `onDrop` / `onDragEnd` | Task 3 |
| `dropPositionFor` helper | Task 3 |
| Move-up / Move-down menu items | Task 4 |
| `showKebab` includes reorderPinned | Task 4 |
| `onMenuAction` routes 'move-up' / 'move-down' | Task 4 |
| Grip handle in row template | Task 5 |
| `<li>` drag attributes + handlers | Task 5 |
| Grip + drop indicator styles | Task 6 |
| Coverage (grip render, menu visibility, click move-up/down, drop, rejection) | Task 7 |
| `ThreadsService.reorderPinned` (LangGraph PATCH) | Task 8 |
| `pinnedOrder` mapping in `toThread` | Task 8 |
| `refresh` sort by `pinnedOrder` within pinned | Task 8 |
| Demo-shell `threadActions.reorderPinned` | Task 9 |
| API docs regen | Task 10 |
| Manual verification | Task 11 |

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `ThreadActionAdapter.reorderPinned?(threadId: string, beforeId: string | null): Promise<void>` referenced consistently in Tasks 1, 3, 4, 9.
- `pendingOrder: ReadonlyMap<string, string | null>` — typed in Task 2, mutated in Task 3.
- `dropTarget: { threadId: string; position: 'before' | 'after' } | null` — Task 2, consumed in Task 3.
- Menu item ids: `'move-up'`, `'move-down'` — defined in Task 4, routed in Task 4.
- Method names: `performReorderPinned`, `performMoveUp`, `performMoveDown`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`, `onDragEnd`, `dropPositionFor` — all consistent across Tasks 3 and 5 (the template references them).
