# Chat pinned-thread reorder — design

**Date:** 2026-05-12
**Surface:** `@ngaf/chat` — extends `chat-thread-list` and `ThreadActionAdapter`. No new primitives.
**Status:** Design approved; ready for implementation plan

## Summary

Add drag-to-reorder for **pinned** threads. Desktop: a hover-revealed grip handle initiates native HTML5 drag-and-drop. Mobile (and as a discoverable fallback on desktop): "Move up" / "Move down" entries in the row's existing overflow menu. Both code paths converge on `ThreadActionAdapter.reorderPinned?(threadId, beforeId | null)` — framework owns optimistic visual reorder + rollback on rejection.

Out of scope: reordering unpinned threads (recency stays the sort key); full manual ordering of all threads; touch-drag gestures (replaced by the menu items for mobile).

## Goals

- Scope drag/reorder to pinned threads only.
- Reuse existing primitives (overflow menu) — no new components.
- Adapter-driven, consistent with rename/archive/delete/pin/moveToProject.
- Anchor-based event shape (`beforeId | null`) — stable across concurrent state mutation.
- Discoverable on mobile without touch-drag complexity.

## Non-goals

- Reordering unpinned threads.
- Custom ordering per-project (project filter applies independently of reorder).
- Touch-drag long-press gesture (resolved during scoping; mobile users use Move-up/Move-down menu items).
- Adding `@angular/cdk` as a dep for CDK DragDrop (~150KB gzipped; rejected to keep the framework slim).
- Drag-handle keyboard alternative (the menu items cover this; keyboard users select via Tab to kebab → arrow keys).

## Public type addition

```ts
export interface ThreadActionAdapter {
  // ... existing
  /** Reorder a pinned thread. `beforeId` is the id of the pinned thread it
   *  should be placed before, or null to move to the end of the pinned list.
   *  Framework optimistically reorders the visible list and awaits this
   *  method; rejection rolls back. */
  reorderPinned?(threadId: string, beforeId: string | null): Promise<void>;
}
```

No change to the `Thread` type. The framework does not require a `pinnedOrder` field on `Thread`; consumers pre-sort pinned threads however they like. The example happens to use `metadata.pinnedOrder` in LangGraph, but other consumers could use array index, lexicographic keys, or anything else.

## `chat-thread-list` extensions

### New input

None — `projects` and `actions` already cover everything needed.

### New internal state

```ts
private readonly pendingOrder = signal<ReadonlyMap<string, string | null>>(new Map());
protected readonly draggingThreadId = signal<string | null>(null);
protected readonly dropTarget = signal<{ threadId: string; position: 'before' | 'after' } | null>(null);
```

`pendingOrder` is an override map: each entry says "move thread X to before thread Y" (or `null` for end-of-pinned-list). Multiple entries compose by insertion order.

### Updated `visibleThreads` computed

```ts
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

### Grip handle in the row template

A `<button>` (semantically correct vs. `<div>` since it has interactive behavior) rendered conditionally:

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

The `draggable="false"` on the button is intentional — the `<li>` is the actual drag source so the button can be hit-tested separately for things like keyboard focus and the menu it triggers (none for now; the grip is just a visual affordance).

### Row drag mechanics

The `<li>` gets `draggable` based on pinned + adapter availability:

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

Handler logic (concrete code in the plan; sketches here):

- `onDragStart(e, threadId)`:
  - Set `draggingThreadId.set(threadId)`.
  - `e.dataTransfer.setData('text/plain', threadId)`; `e.dataTransfer.effectAllowed = 'move'`.
- `onDragOver(e, threadId)`:
  - If `draggingThreadId() === threadId` (dragging over self) → do nothing.
  - If target thread is NOT pinned → do nothing (drop disallowed; cursor will show no-drop).
  - Else `e.preventDefault()` (allow drop); compute position from `e.offsetY` vs. row midpoint; set `dropTarget`.
- `onDragLeave(e, threadId)`:
  - Clear `dropTarget` only if `dropTarget()?.threadId === threadId`.
- `onDrop(e, threadId)`:
  - `e.preventDefault()`.
  - Read `dragId = e.dataTransfer.getData('text/plain')` (or use `draggingThreadId()`).
  - Compute `beforeId`: if position='before', `threadId`; if position='after', the next pinned thread's id (or `null` if this was the last pinned).
  - Call `performReorderPinned(dragId, beforeId)`.
- `onDragEnd()`:
  - Clear `draggingThreadId` and `dropTarget`.

Helper `dropPositionFor(threadId)`:
```ts
protected dropPositionFor(threadId: string): 'before' | 'after' | null {
  const t = this.dropTarget();
  return t?.threadId === threadId ? t.position : null;
}
```

### Menu items: Move up / Move down

`currentMenuItems` (active mode) gets two new conditional entries between Pin/Unpin and the existing items. Only show when:
- `thread.pinned === true`
- `actions().reorderPinned` exists
- The thread has at least one pinned sibling that direction

Implementation: derive the pinned-index when computing the menu items.

```ts
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
}
```

### `onMenuAction` routing

Add two new branches:

```ts
} else if (id === 'move-up') {
  void this.performMoveUp(threadId);
} else if (id === 'move-down') {
  void this.performMoveDown(threadId);
}
```

### `performMoveUp` / `performMoveDown`

```ts
protected async performMoveUp(threadId: string): Promise<void> {
  const pinned = this.threads().filter((t) => t.pinned === true);
  const idx = pinned.findIndex((t) => t.id === threadId);
  if (idx <= 0) return;
  // Move before the previous pinned thread.
  const beforeId = pinned[idx - 1].id;
  return this.performReorderPinned(threadId, beforeId);
}

protected async performMoveDown(threadId: string): Promise<void> {
  const pinned = this.threads().filter((t) => t.pinned === true);
  const idx = pinned.findIndex((t) => t.id === threadId);
  if (idx < 0 || idx >= pinned.length - 1) return;
  // Move before the thread that is currently two positions ahead, or null if that's past the end.
  const beforeId = idx + 2 < pinned.length ? pinned[idx + 2].id : null;
  return this.performReorderPinned(threadId, beforeId);
}

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

### Update `showKebab`

The existing kebab logic already returns true for pinned threads when actions has pin/unpin. Add `reorderPinned` to the active-mode check:

```ts
if (this.mode() === 'active') {
  return Boolean(
    a.rename || a.pin || a.unpin || a.archive || a.delete ||
    a.reorderPinned ||
    (a.moveToProject && this.projects() !== null)
  );
}
```

### Styles

In `chat-thread-list.styles.ts`:

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

(Note: the existing `.chat-thread-list__item-wrap` already has `position: relative` for the kebab — verify this is true in the current source; if not, add it.)

## Example wiring

### `ThreadsService.reorderPinned`

LangGraph has no native ordering for threads. We store `metadata.pinnedOrder: number` and re-sequence the affected pinned threads to integers 0..N-1 each time the order changes.

```ts
async reorderPinned(threadId: string, beforeId: string | null): Promise<void> {
  // Pull the current pinned set (read-only; pending optimistic moves
  // are in the framework, not visible here).
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

  // `next` is the desired pinned order. Stamp metadata.pinnedOrder = 0,1,2,...
  await Promise.all(next.map((t, idx) =>
    this.client.threads.update(t.id, { metadata: { pinnedOrder: idx } })
  ));
  await this.refresh();
}
```

### `toThread` reads `metadata.pinnedOrder`

```ts
const pinnedOrder = typeof meta.pinnedOrder === 'number' ? meta.pinnedOrder : undefined;
return {
  id: t.thread_id,
  title: ...,
  status: ...,
  projectId: ...,
  pinned: ...,
  pinnedOrder,
};
```

(`pinnedOrder` lives in the open `[key: string]: unknown` shape of Thread — no public type change needed.)

### `refresh` sorts pinned threads by `pinnedOrder`

The existing sort puts pinned threads first. Refine: pinned threads sorted by `pinnedOrder ascending` (treating undefined as `Infinity` so legacy un-numbered pins sink to the bottom of the pinned section), then unpinned threads in their existing recency order.

```ts
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
      return 0; // existing recency order between unpinned threads preserved
    })
);
```

### Demo shell

Add to existing `threadActions`:

```ts
reorderPinned: (id, beforeId) => this.threadsSvc.reorderPinned(id, beforeId),
```

No template changes — the new behavior is fully internal to `chat-thread-list`.

## Edge cases

1. **Drop on self.** `dragover` short-circuits; the drop indicator never shows for the source row. Safe.
2. **Drag onto unpinned row.** `dragover` short-circuits (no `preventDefault`); the browser shows "no-drop" cursor. Drop never fires.
3. **`pinnedOrder` not present on some pinned threads.** Legacy/unpinned-via-different-path. Treated as `Infinity` → sinks to bottom of pinned section. First reorder re-sequences and fixes it.
4. **Concurrent drag-and-menu use.** Both code paths converge on `performReorderPinned`. Pending overrides compose by insertion order in the map. If a user clicks "Move up" while a drag is mid-flight, the drag's pending entry remains until its adapter promise settles; the click's entry is added on top. Practically rare.
5. **`reorderPinned` adapter rejects.** Pending entry cleared in `finally`; visible order falls back to `threads()` input (the unchanged consumer state). User sees the row snap back.
6. **Two pinned threads.** "Move up" on the second moves it to first (`beforeId` = first thread's id). "Move down" on the first moves to last (`beforeId = null`). Edge case but correct.
7. **Browser drag-cancellation (Esc during drag).** `dragend` fires without a preceding `drop`. State clears; no adapter call. Correct.

## Testing

### Unit tests (~10 new it cases)

In `chat-thread-list.component.spec.ts`, inside the `describe('with adapter', ...)` block:

1. `actions.reorderPinned` + pinned row → grip handle renders (`.chat-thread-list__grip` selector).
2. `actions.reorderPinned` + unpinned row → grip handle does NOT render.
3. `actions.reorderPinned` not provided → grip handle does NOT render on pinned rows.
4. Pinned thread that is NOT first → menu includes "Move up".
5. Pinned thread that is NOT last → menu includes "Move down".
6. First pinned thread → menu does NOT include "Move up" (but DOES include "Move down" if not also last).
7. Last pinned thread → menu does NOT include "Move down" (but DOES include "Move up" if not also first).
8. Only pinned thread (singleton) → menu has NEITHER "Move up" nor "Move down".
9. Click "Move up" → calls `actions.reorderPinned(threadId, previousPinned.id)`.
10. Click "Move down" on last → calls `actions.reorderPinned(threadId, null)`.
11. Click "Move down" on second-of-three → calls `actions.reorderPinned(threadId, thirdPinned.id)`.
12. Reorder adapter rejects → row falls back to original position in visibleThreads.

### Manual (Chrome MCP)

1. Pin two threads (use existing Pin menu action twice on different threads).
2. Hover the second pinned row → grip handle (⋮⋮) fades in on the left.
3. Drag the grip onto the first pinned row's TOP half → drop indicator line appears above the first row.
4. Release → row order swaps; LangGraph metadata persisted (each pinned thread's `metadata.pinnedOrder` re-stamped).
5. Open kebab on the (now-first) pinned row → menu shows "Move down" but NOT "Move up".
6. Click Move down → row swaps back via menu path.
7. Reload page → pinned order persists (read from `metadata.pinnedOrder`).

### Build / lint

- `nx run chat:test` — passes (existing + ~12 new).
- `nx run chat:build && nx lint chat` — clean.
- `nx run examples-chat-angular:build` — clean.

## Accessibility

- Grip button has `aria-label="Drag to reorder"`. It is focusable and renders only on hover/focus-within of the row, so keyboard users see it when they Tab to it.
- Menu items "Move up" / "Move down" are accessible via the existing overflow-menu pattern (`role="menuitem"`, ArrowUp/Down nav).
- Drop indicator is purely visual; not announced. Users on screen readers should use the menu items.
- Drag operations are not announced by default (HTML5 drag-drop is not screen-reader-friendly). The menu items are the screen-reader-accessible path.
- `prefers-reduced-motion`: the row opacity transition during drag is 100ms; light enough that reduced-motion doesn't materially benefit from gating. The drop-indicator pseudo-elements have no transition. The next phase (prefers-reduced-motion audit) can revisit if needed.

## Performance

- One new state signal (`pendingOrder`); two transient ones (`draggingThreadId`, `dropTarget`).
- `visibleThreads` computed cost grows from O(n) to O(n + k·m) where k = pendingOrder.size and m = pinned threads. Realistic n is small (~50); k is 1-2; m is ~5. Trivial.
- Native HTML5 drag-drop has no library overhead.
- Drop indicator via `::before`/`::after` pseudo-elements; no extra DOM nodes.

## Open questions / assumptions

- **Assumption:** Consumers who don't provide `reorderPinned` get no grip handle and no Move-up/down menu items — the feature is fully opt-in.
- **Assumption:** The LangGraph example's `Promise.all(next.map(...))` for re-stamping `pinnedOrder` is acceptable. A real production backend would do this in a single transaction; for the demo, N parallel PATCHes is fine (typically N ≤ 10).
- **Open:** Whether to add keyboard reordering (Ctrl+ArrowUp/Down while a row is focused). Deferred — Move-up/Move-down menu items cover keyboard users; adding bare-key shortcuts is a nice-to-have.
- **Open:** Whether the grip should be on the LEFT (current spec) or RIGHT (next to the kebab). LEFT matches Slack/ChatGPT; RIGHT is more visually balanced with the kebab. Current spec says LEFT.
