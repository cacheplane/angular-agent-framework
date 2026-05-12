# Chat row actions — Phase 3a design (overflow menu + delete + rename)

**Date:** 2026-05-12
**Surface:** `@ngaf/chat` (`libs/chat/`) — two new primitives, one composition input added, one extended primitive, one example shell extension
**Status:** Design approved; ready for implementation plan

## Summary

Add per-thread-row contextual actions to the sidenav: a hover-revealed kebab opens an overflow menu with **Rename** and **Delete** items. Rename morphs the row title into an inline `<input>`. Delete opens a destructive-toned confirmation dialog. Both actions are adapter-driven (consumer provides `ThreadActionAdapter`), with the framework owning the optimistic UI (immediate row hide / title swap) and rollback on rejection.

This is **Phase 3a** of the larger row-actions decomposition. Out of scope here: archive (Phase 3b), share-link (Phase 3c, needs backend), pin/move (defer until Projects).

## Goals

- Add Delete + Rename via an adapter contract; no other actions in this phase.
- Build the overflow-menu and confirm-dialog as reusable primitives (not row-specific) so future destructive actions / contextual menus across `@ngaf/chat` can use them.
- Optimistic UI owned by `chat-thread-list`; consumer doesn't write rollback logic.
- Hover-revealed kebab; full keyboard accessibility via row focus.
- Inline rename UX (ChatGPT-style); modal confirmation for destructive delete.

## Non-goals

- Archive semantics (Phase 3b).
- Share-link flow.
- Pinned / moved threads.
- Bulk row actions.
- Long-press / right-click on mobile.
- Persisting partial rename input across closes.

## File map

**Create:**
- `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.ts`
- `libs/chat/src/lib/primitives/chat-overflow-menu/chat-overflow-menu.component.spec.ts`
- `libs/chat/src/lib/styles/chat-overflow-menu.styles.ts`
- `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.ts`
- `libs/chat/src/lib/primitives/chat-confirm-dialog/chat-confirm-dialog.component.spec.ts`
- `libs/chat/src/lib/styles/chat-confirm-dialog.styles.ts`

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — adds `actions` input, internal edit/menu/confirm state, optimistic rename + delete, kebab + inline edit template.
- `libs/chat/src/lib/styles/chat-thread-list.styles.ts` — adds kebab hover-reveal + inline-edit input styles.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — adds `actions` pass-through input forwarded to the inner `chat-thread-list`.
- `libs/chat/src/public-api.ts` — exports new primitives, `ThreadActionAdapter`, `OverflowMenuItem`.
- `examples/chat/angular/src/app/shell/threads.service.ts` — adds `delete()` and `rename()` methods that hit LangGraph.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — defines `threadActions: ThreadActionAdapter` and binds it on `<chat-sidenav>`.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — adds `[actions]="threadActions"` on `<chat-sidenav>`.
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated.

## New public types

```typescript
export interface ThreadActionAdapter {
  /** Delete the thread permanently. The framework calls this AFTER user
   *  confirms via the confirm dialog. The framework optimistically removes
   *  the row before awaiting; on rejection it puts the row back. */
  delete?(threadId: string): Promise<void>;

  /** Rename the thread's title. The framework optimistically swaps the
   *  rendered title before awaiting; on rejection it reverts. */
  rename?(threadId: string, newTitle: string): Promise<void>;
}

export interface OverflowMenuItem {
  /** Stable id emitted via (itemSelected). Used to route to the action handler. */
  id: string;
  label: string;
  /** Visual tone. 'destructive' applies a red label. Default 'normal'. */
  tone?: 'normal' | 'destructive';
  /** When true, the item is rendered grayed out and clicks/Enter are no-ops. */
  disabled?: boolean;
}
```

## `chat-overflow-menu` primitive

### API

```ts
@Component({ selector: 'chat-overflow-menu', standalone: true, changeDetection: OnPush })
export class ChatOverflowMenuComponent {
  readonly open = input<boolean>(false);
  readonly items = input<OverflowMenuItem[]>([]);
  /** Element the menu positions itself against. The menu pops out
   *  just below the anchor's bottom-right corner. If null, the menu
   *  is centered in the viewport. */
  readonly anchor = input<HTMLElement | null>(null);
  readonly itemSelected = output<string>();   // item.id
  readonly closed = output<void>();
}
```

Parent is the source of truth for `open`. The component never sets `open` itself — it only emits `closed` (or `itemSelected`, which the parent should treat as an implicit close).

### Behavior

- Renders nothing when `open=false`.
- Renders a scrim button + a `<ul role="menu">` when `open=true`.
- Position: computed from `anchor()?.getBoundingClientRect()` on render. Default rule: `top: rect.bottom + 4`, `left: rect.right - menuWidth`. `position: fixed` so it escapes scroll containers.
- Item click (enabled): emits `itemSelected(item.id)` then `closed`.
- Item click (disabled): no-op.
- Scrim click: emits `closed`.
- Esc: emits `closed`.
- ArrowDown / ArrowUp: move keyboard focus through enabled `<li>`s, clamps at ends.
- Enter/Space on focused item: same as click.
- On open: first enabled item receives focus.

### Styles (high level)

- `position: fixed`, `z-index: 60`, surface background, separator border, rounded corners, subtle shadow.
- `chat-overflow-menu__item--destructive` → red text color from existing `--ngaf-chat-error-text` token.
- `chat-overflow-menu__item--disabled` → muted color, `cursor: not-allowed`.
- `:focus-visible` outline using `--ngaf-chat-primary`.

### ARIA

- Scrim: `<button aria-label="Close menu">`.
- List: `<ul role="menu">`.
- Items: `<li role="menuitem" tabindex="0">` (or `tabindex="-1"` when disabled).
- `aria-disabled="true"` on disabled items.

## `chat-confirm-dialog` primitive

### API

```ts
@Component({ selector: 'chat-confirm-dialog', standalone: true, changeDetection: OnPush })
export class ChatConfirmDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Are you sure?');
  readonly body = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly tone = input<'destructive' | 'normal'>('normal');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
```

### Behavior

- Renders nothing when `open=false`.
- Renders scrim + dialog when `open=true`.
- **Initial focus:** the **cancel** button (deliberately, to make destructive confirm require explicit Tab → Enter — implements the PRD requirement "difficult to trigger accidentally").
- Esc: emits `cancelled`.
- Scrim click: emits `cancelled`.
- Cancel button: emits `cancelled`.
- Confirm button: emits `confirmed`.
- Tab cycles between Cancel and Confirm (focus trap inside dialog).
- `tone="destructive"` applies a red background on the confirm button.

### ARIA

- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`=title id, `aria-describedby`=body id when body non-empty.
- Title is `<h2>` with a deterministic id.
- Body (when present) is `<p>` with a deterministic id.

## `chat-thread-list` extensions

### New input

```ts
readonly actions = input<ThreadActionAdapter | null>(null);
```

When `null` or `undefined`, the kebab is not rendered and the existing behavior is unchanged.

### Internal state

```ts
protected readonly editingThreadId = signal<string | null>(null);
protected readonly editingValue = signal<string>('');
protected readonly menuOpenForId = signal<string | null>(null);
protected readonly menuAnchor = signal<HTMLElement | null>(null);
protected readonly confirmDeleteId = signal<string | null>(null);
private readonly pendingDeletes = signal<Set<string>>(new Set());
private readonly pendingRenames = signal<Map<string, string>>(new Map());

protected readonly visibleThreads = computed<Thread[]>(() => {
  const hidden = this.pendingDeletes();
  const renames = this.pendingRenames();
  return this.threads()
    .filter(t => !hidden.has(t.id))
    .map(t => renames.has(t.id) ? { ...t, title: renames.get(t.id) } : t);
});
```

The existing `@for (thread of threads(); ...)` loop is replaced with `@for (thread of visibleThreads(); ...)` so optimistic updates render.

### Menu items derivation

```ts
protected menuItemsFor(_thread: Thread): OverflowMenuItem[] {
  const a = this.actions();
  if (!a) return [];
  const items: OverflowMenuItem[] = [];
  if (a.rename) items.push({ id: 'rename', label: 'Rename' });
  if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
  return items;
}
```

If `actions={}` (object exists but no methods provided), no items, no kebab. The kebab is gated on `actions() && menuItemsFor(thread).length > 0`.

### Row template

Inside the existing `@for` loop, each `<li>` now wraps either the existing button (read mode) or an inline `<input>` (edit mode), plus the kebab (read mode only):

```html
@for (thread of visibleThreads(); track thread.id) {
  <li class="chat-thread-list__item-wrap">
    @if (editingThreadId() === thread.id) {
      <input
        #editInput
        class="chat-thread-list__edit"
        type="text"
        [value]="editingValue()"
        (input)="editingValue.set($any($event.target).value)"
        (keydown.enter)="commitRename(thread.id)"
        (keydown.escape)="cancelRename()"
        (blur)="cancelRename()"
      />
    } @else {
      <!-- existing button preserved -->
      <button type="button" class="chat-thread-list__item" ...>
        <span class="chat-thread-list__item-title">{{ threadLabel(thread) }}</span>
        @if (thread.updatedAt !== undefined) {
          <span class="chat-thread-list__item-time">{{ relativeTime(thread.updatedAt) }}</span>
        }
      </button>

      @if (actions() && menuItemsFor(thread).length > 0) {
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
```

After the `@for` loop, the menu + confirm dialog are rendered once each (state-driven by `menuOpenForId` and `confirmDeleteId`).

### Action handlers

```ts
protected openMenu(threadId: string, anchor: HTMLElement): void {
  this.menuAnchor.set(anchor);
  this.menuOpenForId.set(threadId);
}

protected onMenuAction(id: string): void {
  const threadId = this.menuOpenForId();
  this.menuOpenForId.set(null);
  if (!threadId) return;

  if (id === 'rename') {
    const t = this.threads().find(x => x.id === threadId);
    this.editingValue.set(t?.title ?? '');
    this.editingThreadId.set(threadId);
    queueMicrotask(() => this.editInputEl()?.nativeElement.focus());
  } else if (id === 'delete') {
    this.confirmDeleteId.set(threadId);
  }
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

  // optimistic
  this.pendingRenames.update(m => { const n = new Map(m); n.set(threadId, newTitle); return n; });
  try {
    await a.rename(threadId, newTitle);
  } catch {
    // rollback — pendingRenames clear below restores the original title
  } finally {
    this.pendingRenames.update(m => { const n = new Map(m); n.delete(threadId); return n; });
  }
}

protected async performDelete(): Promise<void> {
  const threadId = this.confirmDeleteId();
  this.confirmDeleteId.set(null);
  if (!threadId) return;
  const a = this.actions();
  if (!a?.delete) return;

  this.pendingDeletes.update(s => new Set(s).add(threadId));
  try {
    await a.delete(threadId);
    // Consumer is expected to refresh threads(); the row stays hidden via
    // pendingDeletes until the input list no longer contains it. Clear the
    // override regardless so a future thread with the same id (rare) renders.
  } catch {
    // rollback
  } finally {
    // After success, threads() input no longer contains the id; the filter
    // hides it naturally and the override becomes dead state. After failure
    // we must clear so the row reappears.
    this.pendingDeletes.update(s => { const n = new Set(s); n.delete(threadId); return n; });
  }
}
```

### Wiring the menu + dialog

```html
<chat-overflow-menu
  [open]="menuOpenForId() !== null"
  [items]="menuOpenForId() ? menuItemsFor(threadById(menuOpenForId()!)) : []"
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
```

### Style additions

In `chat-thread-list.styles.ts`:

```css
.chat-thread-list__item-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.chat-thread-list__item {
  flex: 1 1 auto;
  /* (existing rules preserved) */
}
.chat-thread-list__kebab {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  border: 0;
  background: transparent;
  color: var(--ngaf-chat-text-muted);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease;
}
.chat-thread-list__item-wrap:hover .chat-thread-list__kebab,
.chat-thread-list__item-wrap:focus-within .chat-thread-list__kebab {
  opacity: 1;
}
.chat-thread-list__kebab:hover { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text); }
.chat-thread-list__kebab:focus-visible {
  opacity: 1;
  outline: 2px solid var(--ngaf-chat-primary);
  outline-offset: 2px;
}
.chat-thread-list__edit {
  flex: 1 1 auto;
  border: 1px solid var(--ngaf-chat-primary);
  border-radius: 4px;
  background: var(--ngaf-chat-bg);
  color: var(--ngaf-chat-text);
  font: inherit;
  padding: 6px 8px;
}
```

## `chat-sidenav` extension

Pass-through input. No other changes.

```ts
readonly actions = input<ThreadActionAdapter | null>(null);
```

Template:

```html
<chat-thread-list
  [threads]="threads()!"
  [activeThreadId]="activeThreadId() ?? ''"
  [actions]="actions()"
  (threadSelected)="threadSelected.emit($event)"
/>
```

Consumers who don't pass `[actions]` get the unchanged read-only experience.

## Example wiring (`examples-chat-angular`)

In `threads.service.ts`:

```ts
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

In `demo-shell.component.ts`:

```ts
protected readonly threadActions: ThreadActionAdapter = {
  delete: (id) => this.threadsSvc.delete(id),
  rename: (id, title) => this.threadsSvc.rename(id, title),
};
```

If the deleted thread is the active thread, the shell should clear `threadIdSignal` so the chat returns to the welcome state. Add to the shell:

```ts
private deleteOriginal = this.threadsSvc.delete.bind(this.threadsSvc);

protected readonly threadActions: ThreadActionAdapter = {
  delete: async (id) => {
    await this.deleteOriginal(id);
    if (this.threadIdSignal() === id) {
      this.threadIdSignal.set(null);
      this.persistence.write('threadId', null);
    }
  },
  rename: (id, title) => this.threadsSvc.rename(id, title),
};
```

Template:

```html
<chat-sidenav
  [threads]="threadsSvc.threads()"
  [activeThreadId]="threadIdSignal() ?? ''"
  [actions]="threadActions"
  ...
/>
```

## Edge cases

1. **Active thread deleted.** Consumer-side concern (shell clears `threadIdSignal`). Framework just hides the row.
2. **Rename to empty / whitespace-only.** `commitRename` trims; empty → no-op cancel.
3. **Rename to same title.** Optimistic update is a no-op visually; the adapter is still called. If adapter no-ops too, fine. If it errors, the rollback is harmless.
4. **Delete while menu still open.** `onMenuAction` closes the menu before opening the dialog. No race.
5. **Optimistic delete success then quick refresh.** Consumer's `threads()` already excludes the deleted id when the override clears; row stays hidden.
6. **Two pending deletes for same id.** Set semantics; second add is idempotent.
7. **Adapter resolves but consumer never refreshes threads.** Rare, but the optimistic override clears in `finally`, so after `await` the row would re-appear (because it's still in `threads()`). The contract: consumers MUST refresh `threads()` on success. Documented on `ThreadActionAdapter`.
8. **Blur during rename click on Enter.** Blur fires AFTER keydown.enter on most browsers; commit fires first, blur becomes a no-op cancel of an already-committed state. Safe.
9. **Menu position when row is near viewport bottom.** Current rule places menu below the kebab. If `rect.bottom + menuHeight > window.innerHeight`, position above instead (`top: rect.top - menuHeight - 4`). Implement only if visible issue surfaces in browser verification.

## Testing

### Unit / component

`chat-overflow-menu.component.spec.ts` (8+ cases):
- Renders nothing when closed.
- Renders items when open.
- Item click emits id + closed.
- Disabled item click no-op.
- Scrim click emits closed.
- Esc emits closed.
- ArrowDown/Up moves focus.
- Destructive class applied.

`chat-confirm-dialog.component.spec.ts` (8+ cases):
- Renders nothing when closed.
- Renders title + body.
- Body omitted when empty.
- Confirm/Cancel buttons emit correct outputs.
- Scrim/Esc emit cancelled.
- Cancel button receives focus on open.
- Destructive class applied to confirm button when `tone="destructive"`.

`chat-thread-list.component.spec.ts` (additions, existing tests intact):
- Kebab not rendered when `actions=null`.
- Kebab not rendered when `actions={}`.
- Kebab rendered when adapter has methods.
- `menuItemsFor` reflects only provided actions.
- Rename: clicking item enters edit mode; Enter calls adapter; Esc cancels.
- Rename: blur cancels.
- Rename: adapter rejects → title reverts after promise settles.
- Delete: clicking item opens confirm dialog.
- Delete: confirm calls adapter; row optimistically hidden.
- Delete: cancel/Esc closes dialog without calling adapter.
- Delete: adapter rejects → row reappears.

### Manual (Chrome MCP)

1. Hover row → kebab fades in.
2. Click kebab → menu anchored just below it; Rename + Delete (destructive red).
3. Outside click → menu closes.
4. Esc with menu open → menu closes.
5. Click Rename → row morphs to input, focused, prefilled with title.
6. Enter → row reverts to button with new title; LangGraph PATCH succeeds.
7. Esc → row reverts to old title; no PATCH.
8. Click Delete → confirm dialog, focus on Cancel, destructive Delete styled red.
9. Esc → dialog closes; no DELETE.
10. Click Delete (in dialog) → row disappears immediately; LangGraph DELETE succeeds.
11. Simulate adapter rejection (temporarily throw) → row reappears.

## Accessibility

- All buttons are `type="button"` with `aria-label`.
- Kebab carries `aria-haspopup="menu"` and `aria-expanded`.
- Menu is `role="menu"` with `role="menuitem"` children.
- Confirm dialog is `role="dialog" aria-modal="true"` with `aria-labelledby` and conditional `aria-describedby`.
- Initial focus on cancel button in destructive dialogs (intentional).
- ArrowDown/Up nav inside menu.
- Esc closes menu, edit, and dialog.

## Performance

- Three new state signals on `chat-thread-list` (`editingThreadId`, `menuOpenForId`, `confirmDeleteId`) plus two override maps. All update via `signal.update`, OnPush-friendly.
- `visibleThreads` computed re-runs only when `threads`, `pendingDeletes`, or `pendingRenames` change. O(n) per re-run, fine for sidebar-sized lists.
- Menu and dialog primitives render nothing when closed — no DOM cost.

## Open questions / assumptions

- **Assumption:** LangGraph supports `DELETE /threads/{id}` and `PATCH /threads/{id}` with `metadata.title` updates. Implementer should verify against the running backend in Task 6 (example wiring) and adjust if either method differs.
- **Assumption:** No backend share-link infrastructure. Therefore no Share action surfaced — adapter contract leaves room to add it later.
- **Open:** Whether `chat-sidenav` should automatically pass through `(rowAction)` events or just `actions`. Spec: only `actions` is forwarded; if a consumer needs to inspect raw row events, they should embed `chat-thread-list` directly in `[sidenavSections]` slot.
- **Open:** Menu auto-position-above when near viewport bottom — deferred until browser verification surfaces an issue.
