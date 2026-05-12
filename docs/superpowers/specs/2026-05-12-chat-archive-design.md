# Chat archive — Phase 3b design

**Date:** 2026-05-12
**Surface:** `@ngaf/chat` (`libs/chat/`) — extends `chat-thread-list` and `chat-sidenav`; bundles `@langchain/langgraph-sdk` migration in the example.
**Status:** Design approved; ready for implementation plan

## Summary

Add archive/unarchive support to the sidenav. Active threads remain in the "Recent" section; archived threads appear in a new collapsible "Archived" section below it. Both sections share the same `ThreadActionAdapter` — extended with `archive?` and `unarchive?` methods. The framework owns optimistic UI; no confirmation dialog (archive is reversible).

Bundles the `examples-chat-angular` `ThreadsService` migration from raw `fetch` to `@langchain/langgraph-sdk`'s `Client` for all thread CRUD operations.

## Goals

- Archive is reversible and non-destructive — no confirmation dialog.
- The framework stays dumb about thread lifecycle: consumers pre-filter into separate `threads` and `archivedThreads` inputs. The new `Thread.status?: 'active' | 'archived'` field is typed documentation, not framework-enforced.
- `chat-thread-list` gains a `mode: 'active' | 'archived'` input that drives per-section menu items (Rename/Archive/Delete vs. Unarchive/Delete).
- Archived management lives in the sidenav (collapsible section), not a separate route.
- Migrate the example's `ThreadsService` to `@langchain/langgraph-sdk` to eliminate raw-fetch debt while we're already in this surface.

## Non-goals

- Confirmation dialog for archive/unarchive (resolved: no confirm).
- Visual indication of archived state in the search palette (consumer can use `ThreadMatch.subtitle`; framework doesn't add a new field).
- Archive count badge on the heading.
- Persistence of expanded/collapsed state.
- Bulk archive.
- Search palette including archived results in this phase (consumer can extend `searchResults` themselves; a framework-level archived-search story is Phase 3c).
- Backwards compatibility — pre-1.0 (0.0.x), breaking changes ship in patch releases (e.g. renaming `pendingDeletes`).

## Public type changes

### `Thread` — additive

```ts
export type Thread = {
  id: string;
  title?: string;
  updatedAt?: number;
  /** Optional lifecycle status. Undefined treated as 'active'. The framework
   *  does NOT auto-filter by this field — consumers pre-filter into separate
   *  `threads` and `archivedThreads` inputs. */
  status?: 'active' | 'archived';
  [key: string]: unknown;
};
```

### `ThreadActionAdapter` — adds two optional methods

```ts
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

No new exported types or primitives.

## `chat-thread-list` extensions

### New input

```ts
readonly mode = input<'active' | 'archived'>('active');
```

Default `'active'` preserves existing call sites (passes implicitly through `chat-sidenav` for the Recent section). The `mode="archived"` instance is rendered by `chat-sidenav` for the Archived section.

### State rename

`pendingDeletes` → `pendingHidden`. Same `ReadonlySet<string>` shape; same filter usage in `visibleThreads`. Used for delete, archive, AND unarchive — all three actions hide the row from the current list pending the adapter promise. (Per "no backwards compat" rule, the rename is mechanical.)

### Menu-items derivation

`currentMenuItems` becomes:

```ts
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

### Action handlers

`onMenuAction` routes the new ids:

```ts
if (id === 'archive')   { this.performArchive(threadId); }
else if (id === 'unarchive') { this.performUnarchive(threadId); }
```

`performArchive` and `performUnarchive` follow the existing `performDelete` shape minus the confirm step:

```ts
protected async performArchive(threadId: string): Promise<void> {
  const a = this.actions();
  if (!a?.archive) return;
  this.pendingHidden.update((s) => new Set([...s, threadId]));
  try { await a.archive(threadId); } catch { /* rollback below */ }
  finally {
    this.pendingHidden.update((s) => { const n = new Set(s); n.delete(threadId); return n; });
  }
}

protected async performUnarchive(threadId: string): Promise<void> {
  /* identical, calls a.unarchive */
}
```

### Showing the kebab

`showKebab()` currently returns `true` when *any* adapter method exists. That breaks for archived mode: an adapter with `rename` + `archive` but no `unarchive` or `delete` would render an empty-menu kebab on archived rows. Updated check is mode-aware:

```ts
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  if (this.mode() === 'active') return Boolean(a.rename || a.archive || a.delete);
  return Boolean(a.unarchive || a.delete);
}
```

## `chat-sidenav` extensions

### New input

```ts
readonly archivedThreads = input<Thread[] | null>(null);
```

When `null` (default) → archived section not rendered. Existing consumers unchanged.

### New state

```ts
protected readonly archivedOpen = signal<boolean>(false);
```

Collapsed by default; no persistence in the framework.

### Template

Inserted after the existing `@if (threads() !== null)` Recent block, before the `[sidenavSections]` slot:

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

### Styles

Added to `chat-sidenav.styles.ts`:

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
}
:host .chat-sidenav__archived[data-open="true"] .chat-sidenav__archived-chevron {
  transform: rotate(90deg);
}
.chat-sidenav__archived-empty {
  padding: 8px 12px;
  color: var(--ngaf-chat-text-muted);
  font-size: var(--ngaf-chat-font-size-sm);
}
:host([data-mode="collapsed"]) .chat-sidenav__archived { display: none; }
```

The collapsed-rail mode hides the section entirely — there's no useful affordance for archive management in an icon rail.

## Example wiring (`examples-chat-angular`)

### `ThreadsService` — full rewrite using `@langchain/langgraph-sdk`

Replaces the existing raw-fetch implementation AND adds the new methods. The existing public signal `threads` and methods `refresh`, `create` keep the same signatures; only their implementations switch to SDK.

```ts
// examples/chat/angular/src/app/shell/threads.service.ts
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

  private toThread(t: SdkThread): Thread {
    const meta = t.metadata ?? {};
    const customTitle = (meta as { title?: string }).title;
    const archived = (meta as { archived?: boolean }).archived === true;
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

**Note on `toThread`:** the spread-style status assignment is awkward — the implementation can simplify to a single ternary on the `status` field. The shape that matters is that `status: 'archived'` is set when metadata says so, otherwise `'active'`.

If the existing `titleFor()` helper has additional logic (e.g., reading from `state.values.messages[0]`), preserve it; only the network/SDK layer changes.

### `demo-shell.component.ts` — extend `threadActions`

```ts
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

Active-thread cleanup mirrors the delete pattern — if you archive the currently-open thread, the shell drops the active id so the chat returns to the welcome state.

### `demo-shell.component.html` — bind the new input

Add `[archivedThreads]="threadsSvc.archivedThreads()"` to the existing `<chat-sidenav>` element. No other changes.

## Edge cases

1. **Adapter has `archive` but `mode='active'` has no other methods.** Menu renders just "Archive". Single-item menu is fine.
2. **Active thread is archived.** Shell-level concern, mirrors the delete pattern (clear `threadIdSignal`).
3. **Empty archived list.** Heading still rendered (consumer passed `archivedThreads=[]` indicating archive feature is enabled); expanded shows "No archived conversations." empty state.
4. **`archivedThreads=null` AND `actions.archive` defined.** Active rows still get an "Archive" menu item; the framework allows archiving but the consumer hasn't enabled the archived view. Acceptable — archived threads aren't visible but are reachable through the LangGraph thread metadata directly. Consumers wanting full UX pass both.
5. **`archivedThreads` provided but `actions.unarchive` not.** Archived rows have a kebab only if `delete` is provided; otherwise no kebab. The user can see archived threads but can't restore them through the UI. Acceptable — explicit consumer choice, framework respects what's wired.
6. **Optimistic archive race with optimistic delete.** Both add to the same `pendingHidden` set; both clear in `finally`. If a row is in two pending ops simultaneously (impossible through UI, but theoretically through programmatic clicks), the set is idempotent. Safe.

## Testing

### `chat-thread-list.component.spec.ts` additions

1. `mode='active' + actions={archive}` → menu includes "Archive".
2. `mode='archived' + actions={unarchive}` → menu includes "Unarchive" but NOT "Archive" or "Rename".
3. `mode='archived' + actions={unarchive, delete}` → menu items in order: Unarchive, Delete (destructive).
4. Click Archive → calls `actions.archive(threadId)`, row hidden via `pendingHidden`, no confirm dialog opens.
5. Click Unarchive → calls `actions.unarchive(threadId)`, row hidden from list.
6. Archive adapter rejects → row reappears.
7. Unarchive adapter rejects → row reappears.
8. `showKebab` returns false in `mode='archived'` when only `rename` and `archive` are provided (neither `unarchive` nor `delete`).

### `chat-sidenav.component.spec.ts` additions

1. `archivedThreads=null` → no archived heading rendered.
2. `archivedThreads=[]` → heading renders; click expands; "No archived conversations." shown.
3. `archivedThreads=[t1, t2]` → heading expands to render a `<chat-thread-list>` with `mode="archived"`.
4. Heading click toggles `aria-expanded` between "true" and "false".

### Build / lint

- `nx run chat:test` — passes (new + existing).
- `nx run chat:build` — clean.
- `nx lint chat` — clean.
- `nx run examples-chat-angular:build` — clean.

### Manual (Chrome MCP) verification

1. Initial: sidenav renders Recent + collapsed "Archived" heading.
2. Hover active row → kebab fades in. Click → menu: Rename, Archive, Delete.
3. Click Archive → row vanishes from Recent; no dialog; LangGraph `threads.update({metadata.archived:true})` succeeds.
4. Click "Archived" heading → expands; the archived thread appears.
5. Hover archived row → kebab fades in. Click → menu: Unarchive, Delete.
6. Click Unarchive → row vanishes from Archived; reappears in Recent after refresh.
7. Archive the *current* thread → row vanishes AND chat returns to welcome state.
8. Reload page → archived state persists (on LangGraph thread metadata).
9. Sidenav `mode='collapsed'` → archived section hidden entirely.

## Accessibility

- Archived heading is a `<button>` with `aria-expanded` reflecting state and `aria-controls` pointing at the list id.
- Chevron rotates via CSS transition; `aria-hidden="true"` on the SVG.
- Reduced motion: the chevron rotation is `150ms ease`. Framework doesn't currently honor `prefers-reduced-motion` globally (acknowledged out-of-scope across multiple specs).
- Menu items continue to use the existing `chat-overflow-menu` ARIA pattern.

## Performance

- One additional signal on the sidenav (`archivedOpen`).
- One additional `chat-thread-list` instance is mounted ONLY when the heading is expanded AND `archivedThreads.length > 0` (gated by template `@if`). When collapsed or empty, no list cost.
- `pendingHidden` rename is mechanical; no perf change vs. `pendingDeletes`.
- `ThreadsService` migration: same network call count (one `threads.search` per refresh), no additional round trips.

## Open questions / assumptions

- **Assumption:** LangGraph `client.threads.update(id, { metadata })` is a deep-merge or shallow-merge with existing metadata. We set `{ metadata: { archived: true } }` not `{ metadata: { archived: true, ...existing } }`. The SDK / LangGraph server merge behavior: standard LangGraph metadata-update is a shallow merge that PRESERVES existing keys not present in the update. Verify in Task 8 (the example wiring); if not, hand-merge before calling.
- **Assumption:** `titleFor()` logic in the current `ThreadsService` doesn't read anything beyond `metadata.title`. The plan's Task 8 will preserve any logic discovered in the existing helper.
- **Open:** Whether archived results should automatically be included in the Cmd+K palette search. Deferred — consumer can opt in by extending their `searchResults` computed. Phase 3c could promote this to a framework concern.
