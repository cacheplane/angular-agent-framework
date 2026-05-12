# Chat per-row pin (Phase 3d) — design

**Goal:** Add per-thread pin/unpin to `@ngaf/chat` with a small archived-search example tweak.

## Design principles

- Framework stays dumb about ordering. Consumers pre-sort threads pinned-first.
- No optimistic icon flip — pin icon updates after the consumer refreshes.
- Active mode only — archived threads aren't pinnable.

## Surface additions to `@ngaf/chat`

### `Thread.pinned?: boolean`
Typed documentation field. Framework renders a pin icon when true.

### `ThreadActionAdapter.pin?` / `.unpin?`
```ts
pin?(threadId: string): Promise<void>;
unpin?(threadId: string): Promise<void>;
```

### Menu behavior
- Active mode only.
- Pin shown when adapter has `pin` AND row is not pinned.
- Unpin shown when adapter has `unpin` AND row IS pinned.
- Pinned-state lookup goes against original `threads()` (NOT `visibleThreads()`).

### Pin icon
Small SVG prepended inside `chat-thread-list__item-title` when `thread.pinned === true`.

## Example consumer wiring

- `ThreadsService.pin/unpin`: PATCH `metadata.pinned`, then refresh.
- `toThread`: read `meta.pinned`.
- `refresh()` sorts active threads pinned-first.
- `demo-shell.threadActions`: add `pin` and `unpin`.

## Archived-search freebie (bundled)

`demo-shell.searchResults` extends to include archived matches with `subtitle: 'Archived'`.

## Out of scope

- Drag-to-reorder pinned threads.
- Pin from archived view.
- Per-pin timestamp / pin-order.
- Optimistic pin icon flip.
