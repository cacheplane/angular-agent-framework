# Chat projects — Phase 4 design

**Date:** 2026-05-12
**Surface:** `@ngaf/chat` — new `chat-project-list` primitive; extends `chat-thread-list`, `chat-sidenav`; example wiring with localStorage-backed `ProjectsService`.
**Status:** Design approved; ready for implementation plan

## Summary

Introduce Projects as a first-class navigation surface in `@ngaf/chat`. The sidenav gains a Projects section between the primary slot and the Recent thread list. Projects can be created (inline), renamed (inline), and deleted (with confirmation). Threads can be associated with a project at creation time AND moved between projects via a per-row submenu. Selecting a project filters the visible threads to that project.

Out of scope for this phase: per-project instructions / per-project files / project sharing / membership states.

## Goals

- `Project` model + `ProjectActionAdapter` mirror Thread/Adapter patterns (consumer-controlled persistence; framework stays dumb about storage).
- Sidenav exposes Projects above Recent with a "+ New project" affordance, click-to-select navigation, and hover-revealed kebab for Rename/Delete.
- Threads get an optional `projectId` field and a "Move to project" menu item that opens a second overflow menu listing projects + "No project" choice.
- Example uses localStorage to persist projects; LangGraph has no native projects API and a real backend is out of scope for this PR.
- All UX patterns reuse existing primitives (`chat-overflow-menu`, `chat-confirm-dialog`, inline-rename).

## Non-goals

- Per-project system prompt / instructions.
- Per-project attached files.
- Project sharing / membership / roles.
- Project icon / color customization (Project shape is open; consumers can add fields but framework doesn't render them).
- Server-side projects backend (the example uses localStorage; consumers with backends bring their own adapter).
- Drag-to-reorder projects or threads within a project.
- "Move multiple threads" bulk action.

## Decomposition note

The user explicitly approved scope **C** (full Projects sans instructions/files), then expanded scope back to include **Move-to-project** after recognizing the foundation gap. This spec covers the full landing: Project CRUD + sidenav section + thread filtering + thread move-to-project.

## File map

**Create:**
- `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts`
- `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts`
- `libs/chat/src/lib/styles/chat-project-list.styles.ts`
- `examples/chat/angular/src/app/shell/projects.service.ts`

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — `Thread.projectId?`, `ThreadActionAdapter.moveToProject?`, `projects` input, `moveMenuOpenForId` state, `moveMenuItems` computed, `performMoveToProject` handler, second `<chat-overflow-menu>` instance for the move submenu, "Move to project" entry in the main menu.
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` — coverage for the move-to-project flow.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — `projects`, `selectedProjectId`, `projectActions` inputs; `(projectSelected)`, `(newProjectRequested)` outputs; Projects section in template; forwards `projects` to inner `chat-thread-list` so the move submenu can list them.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts` — Projects section tests.
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — Projects heading styles (matches Archived heading pattern).
- `libs/chat/src/public-api.ts` — export `Project`, `ProjectActionAdapter`, `ChatProjectListComponent`.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — define `projectActions`, `selectedProjectId` signal, partition threads by project for the threads input, wire bindings.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — bind new sidenav inputs/outputs.
- `examples/chat/angular/src/app/shell/threads.service.ts` — `toThread()` reads `metadata.projectId` to populate `Thread.projectId`; new `moveToProject(threadId, projectId | null)` method patches metadata.
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated.

## Public types

### Additions

```ts
export type Project = {
  id: string;
  name: string;
  /** Open shape — consumers may add icon, color, createdAt, etc. */
  [key: string]: unknown;
};

export interface ProjectActionAdapter {
  /** Create a new project. Returns the new project id; consumer is expected
   *  to also refresh its projects signal. */
  create?(name: string): Promise<{ id: string }>;
  rename?(projectId: string, newName: string): Promise<void>;
  /** Permanently delete the project. The framework calls this AFTER user
   *  confirms via the confirm dialog. */
  delete?(projectId: string): Promise<void>;
}
```

### Extensions

```ts
export type Thread = {
  // ... existing fields
  /** Optional project association. Consumers pre-filter threads by project
   *  before passing to the sidenav. */
  projectId?: string | null;
  // [key: string]: unknown stays last
};

export interface ThreadActionAdapter {
  // ... existing
  /** Move the thread to a project, or pass null to remove from any project. */
  moveToProject?(threadId: string, projectId: string | null): Promise<void>;
}
```

## `chat-project-list` primitive

Sibling of `chat-thread-list`. Simpler row content (no time, no streaming indicators), reuses the same overflow-menu + confirm-dialog primitives, mirrors the inline-rename pattern.

### API

```ts
@Component({ selector: 'chat-project-list', standalone: true })
export class ChatProjectListComponent {
  readonly projects = input.required<Project[]>();
  readonly activeProjectId = input<string | null>(null);
  readonly showNewProjectButton = input<boolean>(false);
  readonly actions = input<ProjectActionAdapter | null>(null);

  readonly projectSelected = output<string>();
  readonly newProjectRequested = output<void>();
}
```

### Template (sketch)

```html
@if (showNewProjectButton()) {
  <button type="button" class="chat-project-list__new" (click)="onNewProjectClicked()">+ New project</button>
}
<ul class="chat-project-list">
  @if (creatingProject()) {
    <li class="chat-project-list__item-wrap">
      <input
        #newInput
        class="chat-project-list__edit"
        type="text"
        placeholder="New project name"
        [value]="creatingValue()"
        (input)="onCreateInput($event)"
        (keydown.enter)="commitCreate()"
        (keydown.escape)="cancelCreate()"
        (blur)="cancelCreate()"
        aria-label="New project name"
      />
    </li>
  }
  @for (project of visibleProjects(); track project.id) {
    <li class="chat-project-list__item-wrap">
      @if (editingProjectId() === project.id) {
        <input #editInput class="chat-project-list__edit" ... />
      } @else {
        <button
          type="button"
          class="chat-project-list__item"
          [attr.data-active]="project.id === activeProjectId() ? 'true' : null"
          (click)="selectProject(project.id)"
        >
          {{ project.name }}
        </button>
        @if (showKebab()) {
          <button #kebab type="button" class="chat-project-list__kebab" ...>⋯</button>
        }
      }
    </li>
  }
</ul>

<chat-overflow-menu [open]="..." [items]="currentMenuItems()" ... />
<chat-confirm-dialog [open]="..." title="Delete project?" ... />
```

### State (internal)

- `creatingProject: signal<boolean>(false)` — shows the inline-create input row at the top of the list.
- `creatingValue: signal<string>('')`
- `editingProjectId`, `editingValue`, `menuOpenForId`, `menuAnchor`, `confirmDeleteId` — analogous to chat-thread-list.
- `pendingHidden: signal<ReadonlySet<string>>`, `pendingRenames: signal<ReadonlyMap<string, string>>` — same pattern.
- `visibleProjects = computed<Project[]>(() => ...)` — applies pending hidden + renames over `projects()`.

### Menu items

```ts
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
```

(No "Leave" action this phase; defer with project membership.)

### Behavior

- `+ New project` → `onNewProjectClicked` sets `creatingProject = true`, emits `newProjectRequested`. Then focuses the new-input.
- `commitCreate()` → if `actions.create` exists, await it; the consumer is expected to refresh its `projects` signal after success. Framework exits `creatingProject` mode regardless. (Optimistic insert is NOT done because we need the server-assigned id; the visible row appears once the consumer's signal refreshes — typically <50ms with the in-process localStorage example.)
- `cancelCreate()` → exits creating mode. No-op if `creatingValue.length === 0`.
- `commitRename()`, `performDelete()` — analogous to chat-thread-list (optimistic + rollback).
- `selectProject(id)` → emits `projectSelected(id)`. Visual highlight via `[data-active]`.
- `showKebab()` returns `Boolean(actions().rename || actions().delete)`.

### Styles

Mirrors `chat-thread-list.styles.ts`. Row class names: `chat-project-list__item`, `chat-project-list__item-wrap`, `chat-project-list__kebab`, `chat-project-list__edit`, `chat-project-list__new`. Same hover-reveal-kebab pattern. Active row gets the same left-border accent as active thread rows.

### Tests (~10 it() cases)

- Renders rows from `projects` input.
- Click row emits `projectSelected`.
- `activeProjectId` match → `data-active="true"` attribute.
- `showNewProjectButton=false` → no + New project button.
- `showNewProjectButton=true` + click → emits `newProjectRequested` + enters creating mode (input appears).
- Type + Enter → calls `actions.create(name)`.
- Type + Esc / blur → exits creating mode, no call.
- Rename via kebab → inline editable input prefilled with current name; Enter calls adapter; Esc reverts.
- Delete via kebab → opens confirm dialog (destructive); confirm calls adapter + optimistic hide; cancel no-op.
- Delete adapter rejects → row reappears.

## `chat-thread-list` extensions

### Adapter + Type

`Thread.projectId?: string | null` and `ThreadActionAdapter.moveToProject?` per Public Types above.

### New input

```ts
readonly projects = input<Project[] | null>(null);
```

When non-null AND `actions.moveToProject` is provided, the row's main overflow menu gains a "Move to project" entry. When clicked, it opens a second overflow menu (the move submenu).

### Menu wiring

Update `currentMenuItems` to include "Move to project" entry in active mode:

```ts
if (this.mode() === 'active') {
  if (a.rename) items.push({ id: 'rename', label: 'Rename' });
  if (a.pin && !isPinned) items.push({ id: 'pin', label: 'Pin' });        // from Phase 3d (spawned)
  if (a.unpin && isPinned) items.push({ id: 'unpin', label: 'Unpin' });    // from Phase 3d
  if (a.moveToProject && this.projects() !== null) {
    items.push({ id: 'move', label: 'Move to project' });
  }
  if (a.archive) items.push({ id: 'archive', label: 'Archive' });
  if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
}
```

The "Move to project" item only appears when BOTH the adapter method is provided AND a project list is supplied. Without a project list there's nothing to move to.

### Move submenu

Second overflow menu instance, separate state:

```ts
protected readonly moveMenuOpenForId = signal<string | null>(null);

protected readonly moveMenuItems = computed<OverflowMenuItem[]>(() => {
  if (!this.moveMenuOpenForId()) return [];
  const list: OverflowMenuItem[] = [{ id: '__none__', label: 'No project' }];
  for (const p of this.projects() ?? []) {
    list.push({ id: p.id, label: p.name });
  }
  return list;
});
```

In `onMenuAction('move')`:

```ts
this.menuOpenForId.set(null);
this.moveMenuOpenForId.set(threadId);
```

In a new `onMoveMenuAction`:

```ts
protected onMoveMenuAction(itemId: string): void {
  const threadId = this.moveMenuOpenForId();
  this.moveMenuOpenForId.set(null);
  if (!threadId) return;
  const projectId = itemId === '__none__' ? null : itemId;
  void this.performMoveToProject(threadId, projectId);
}
```

`performMoveToProject` mirrors `performArchive` — optimistic hide via `pendingHidden` (the row leaves the current project's visible list because the consumer's threads input re-partitions on refresh).

Template renders TWO `<chat-overflow-menu>` elements:

```html
<!-- existing main menu -->
<chat-overflow-menu
  [open]="menuOpenForId() !== null"
  [items]="currentMenuItems()"
  [anchor]="menuAnchor()"
  (itemSelected)="onMenuAction($event)"
  (closed)="menuOpenForId.set(null)"
/>

<!-- new move submenu -->
<chat-overflow-menu
  [open]="moveMenuOpenForId() !== null"
  [items]="moveMenuItems()"
  [anchor]="menuAnchor()"
  (itemSelected)="onMoveMenuAction($event)"
  (closed)="moveMenuOpenForId.set(null)"
/>
```

The two menus never appear simultaneously (clicking "Move" closes the first, opens the second). Same anchor for both, so the second menu pops at the same screen position. Acceptable visual continuity.

### showKebab update

Add `a.moveToProject && this.projects() !== null` as a contributor in active mode:

```ts
if (this.mode() === 'active') {
  return Boolean(
    a.rename || a.pin || a.unpin || a.archive || a.delete ||
    (a.moveToProject && this.projects() !== null)
  );
}
```

### New tests (~4 it() cases)

- `actions.moveToProject` provided + `projects=[]` (empty array, non-null) → menu includes "Move to project"; submenu has only "No project".
- `actions.moveToProject` provided + `projects=null` → menu does NOT include "Move to project".
- Click "Move to project" → main menu closes, move submenu opens with project items.
- Click a project in the move submenu → calls `actions.moveToProject(threadId, projectId)`, row hidden optimistically.
- Click "No project" in the move submenu → calls `actions.moveToProject(threadId, null)`.

## `chat-sidenav` extensions

### New inputs / outputs

```ts
readonly projects = input<Project[] | null>(null);
readonly selectedProjectId = input<string | null>(null);
readonly projectActions = input<ProjectActionAdapter | null>(null);

readonly projectSelected = output<string>();
readonly newProjectRequested = output<void>();
```

### Template

Insert Projects section between `[sidenavPrimary]` slot and the Recent block:

```html
<div class="chat-sidenav__primary">
  <ng-content select="[sidenavPrimary]" />
</div>

@if (projects() !== null) {
  <div class="chat-sidenav__projects">
    <div class="chat-sidenav__threads-heading">Projects</div>
    <chat-project-list
      [projects]="projects()!"
      [activeProjectId]="selectedProjectId()"
      [showNewProjectButton]="!!projectActions()?.create"
      [actions]="projectActions()"
      (projectSelected)="projectSelected.emit($event)"
      (newProjectRequested)="newProjectRequested.emit()"
    />
  </div>
}

@if (threads() !== null) {
  <div class="chat-sidenav__threads">
    <!-- existing Recent rendering, NOW forwarding `projects` so the move submenu works -->
    <chat-thread-list
      [threads]="threads()!"
      [activeThreadId]="activeThreadId() ?? ''"
      [actions]="actions()"
      [projects]="projects()"
      (threadSelected)="threadSelected.emit($event)"
    />
    ...
```

The same `projects` input is forwarded to BOTH the project list (for navigation/CRUD) AND the thread list (for the move submenu).

### Styles

Reuse the existing `.chat-sidenav__threads-heading` style for the "Projects" label. Add a wrapper:

```css
.chat-sidenav__projects { flex-shrink: 0; }
:host([data-mode="collapsed"]) .chat-sidenav__projects { display: none; }
```

### Tests (~4 it() cases)

- `projects=null` → no Projects heading.
- `projects=[p1,p2]` → heading renders + `<chat-project-list>` with 2 rows.
- `selectedProjectId='p1'` → that row carries `data-active="true"`.
- `projectActions.create` set → "+ New project" button shows; click emits `newProjectRequested`.

## Example wiring

### `ProjectsService` (NEW — localStorage-backed)

```ts
// examples/chat/angular/src/app/shell/projects.service.ts
import { Injectable, signal } from '@angular/core';
import type { Project } from '@ngaf/chat';

const STORAGE_KEY = 'ngaf-example-projects-v1';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  readonly projects = signal<Project[]>(this.load());

  async create(name: string): Promise<{ id: string }> {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.projects.update((p) => [{ id, name }, ...p]);
    this.save(this.projects());
    return { id };
  }

  async rename(id: string, name: string): Promise<void> {
    this.projects.update((p) => p.map((x) => x.id === id ? { ...x, name } : x));
    this.save(this.projects());
  }

  async delete(id: string): Promise<void> {
    this.projects.update((p) => p.filter((x) => x.id !== id));
    this.save(this.projects());
    // Threads associated with this project become "orphaned" (their projectId
    // still points at a deleted project). Acceptable for the demo; a real
    // backend would either cascade-clear or block deletion.
  }

  private load(): Project[] {
    if (typeof localStorage === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
  }
  private save(p: Project[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }
}
```

### `ThreadsService` — read + write `projectId`

`toThread()` extends to read `meta.projectId`:

```ts
const projectId = typeof meta.projectId === 'string' && meta.projectId.length > 0
  ? meta.projectId
  : null;
return { id: t.thread_id, title: ..., status: ..., projectId };
```

New method on `ThreadsService`:

```ts
async moveToProject(threadId: string, projectId: string | null): Promise<void> {
  await this.client.threads.update(threadId, { metadata: { projectId } });
  await this.refresh();
}
```

### `demo-shell.component.ts`

```ts
protected readonly selectedProjectId = signal<string | null>(this.persistence.read('selectedProjectId'));

protected readonly visibleThreads = computed<Thread[]>(() => {
  const sel = this.selectedProjectId();
  const all = this.threadsSvc.threads();
  return sel === null ? all : all.filter((t) => t.projectId === sel);
});

protected readonly projectActions: ProjectActionAdapter = {
  create: async (name) => {
    const r = await this.projectsSvc.create(name);
    this.selectedProjectId.set(r.id);
    this.persistence.write('selectedProjectId', r.id);
    return r;
  },
  rename: (id, name) => this.projectsSvc.rename(id, name),
  delete: async (id) => {
    await this.projectsSvc.delete(id);
    if (this.selectedProjectId() === id) {
      this.selectedProjectId.set(null);
      this.persistence.write('selectedProjectId', null);
    }
  },
};

// Extend threadActions with moveToProject
protected readonly threadActions: ThreadActionAdapter = {
  // ... existing delete/rename/archive/unarchive (+ pin/unpin if Phase 3d landed)
  moveToProject: (id, projectId) => this.threadsSvc.moveToProject(id, projectId),
};

protected onProjectSelected(projectId: string): void {
  this.selectedProjectId.set(projectId);
  this.persistence.write('selectedProjectId', projectId);
}

// Update onNewThread to start the new thread in the selected project
protected async onNewThread(): Promise<void> {
  const sel = this.selectedProjectId();
  // ThreadsService.create() will need an optional projectId param;
  // if so, pass it. Otherwise the metadata can be set in a follow-up update.
  await this.threadsSvc.create(sel ?? undefined);
}
```

`ThreadsService.create()` accepts an optional `projectId` and stamps it in metadata:

```ts
async create(projectId?: string): Promise<string | null> {
  try {
    const t = await this.client.threads.create({
      metadata: projectId !== undefined ? { projectId } : {},
    });
    await this.refresh();
    return t.thread_id;
  } catch {
    return null;
  }
}
```

### `demo-shell.component.html`

```html
<chat-sidenav
  [threads]="visibleThreads()"
  [archivedThreads]="threadsSvc.archivedThreads()"
  [projects]="projectsSvc.projects()"
  [selectedProjectId]="selectedProjectId()"
  [projectActions]="projectActions"
  [actions]="threadActions"
  [activeThreadId]="threadIdSignal() ?? ''"
  [mode]="sidenavMode()"
  [(open)]="drawerOpen"
  (newChat)="onNewThread()"
  (threadSelected)="onThreadSelected($event)"
  (projectSelected)="onProjectSelected($event)"
  (newProjectRequested)="onNewProjectClicked()"
  (searchOpened)="paletteOpen.set(true)"
  (openChange)="onSidenavOpenChange($event)"
/>
```

(`onNewProjectClicked` can be a no-op stub if the project list owns the inline-create flow; the event is mostly informational for the consumer to know a create was triggered.)

## Edge cases

1. **Deleting a project with associated threads.** Threads keep their stale `projectId` after the project is gone. Visible-threads computed (filtering by `selectedProjectId === t.projectId`) returns no rows for the deleted project's id. Threads become "orphaned" but reachable via the unfiltered "no project selected" view. Acceptable for demo; real backend should cascade.
2. **Selecting a project that no longer exists** (race: another tab deleted it). The visible-threads computed returns `[]`; the sidenav shows an empty Recent list. Consumer can detect (`selectedProjectId() && !projects().some(p => p.id === sel)`) and reset, but framework doesn't.
3. **Creating a project mid-rename.** The `creatingProject` and `editingProjectId` signals are independent; both can be set simultaneously. UX-wise, mid-rename + click-new should commit/cancel the rename first. The framework does NOT enforce this; consumers / future polish can.
4. **Move-to-project on a thread that's already in that project.** Adapter call is a no-op move (same projectId). Server still receives the PATCH; thread stays in the list. Acceptable.
5. **Move-to-project on a thread when `projects=[]` (empty array, not null).** Submenu shows only "No project". Move to "No project" works (clears the projectId). No infinite-loop bug since the framework doesn't re-trigger menus.
6. **Active thread is moved out of the currently-selected project.** Visible-threads filter immediately excludes it; the chat view should switch to welcome state. Consumer's `onMoveProject` handler is responsible for that side-effect (or the existing reactive-thread-id flow handles it).
7. **`crypto.randomUUID()` unavailable** (older browsers, SSR). Fallback in `ProjectsService.create()` uses timestamp + random suffix. Documented.

## Testing

### Unit tests

- `chat-project-list.component.spec.ts`: ~10 cases per the primitive section.
- `chat-thread-list.component.spec.ts` (additions): ~4 cases for the move-to-project flow.
- `chat-sidenav.component.spec.ts` (additions): ~4 cases for the Projects section.

### Manual (Chrome MCP)

1. Initial: sidenav renders empty Projects section heading (no projects yet) + "+ New project" button if adapter has create.
2. Click "+ New project" → inline input appears at top of the projects area, focused.
3. Type "Work" + Enter → row appears with name "Work"; `selectedProjectId` set to the new project.
4. Click "Work" → project row gets active-highlight.
5. With "Work" selected, click "+ New chat" → creates a thread with `metadata.projectId='Work-id'`. Thread appears in the Recent list (visible because filter matches).
6. Hover the new thread → kebab fades in. Click kebab → menu includes "Move to project".
7. Click "Move to project" → main menu closes, move submenu opens with "No project" + "Work".
8. Click "No project" → thread vanishes from Recent (no longer matches the filter). Click the Projects heading area to switch to "no project selected" view → thread visible.
9. Rename "Work" → "Personal". Row updates. Selected project's name updates everywhere.
10. Delete "Work" via the kebab → confirm dialog appears (destructive). Confirm → project gone. Threads previously in "Work" are orphaned (still in LangGraph but their `metadata.projectId` references the deleted id).
11. Reload page → projects persist via localStorage. Selected project persists via the existing `PalettePersistence`.

### Build / lint

- `nx run chat:test` — passes (existing + ~18 new).
- `nx run chat:build && nx lint chat` — clean.
- `nx run examples-chat-angular:build` — clean.
- `nx run examples-chat-angular` (dev server) — clean compile, no console errors.

## Accessibility

- Project rows are `<button>` with click + visible focus ring via `:focus-visible`.
- "+ New project" is a `<button>`.
- Inline create + rename inputs have `aria-label` describing their purpose.
- Move submenu reuses `chat-overflow-menu` ARIA (menu/menuitem, ArrowUp/Down nav, Esc close).
- Active project entry carries `[data-active="true"]` and an accent border; not color-alone. Consider `aria-current="page"` on the active project button (matches the thread-list pattern).

## Performance

- localStorage in `ProjectsService` is synchronous and tiny (~10 projects worth of JSON). No perf concern.
- The `visibleThreads` computed in the demo shell is O(threads) per recompute — small N.
- Two overflow-menu instances in `chat-thread-list` is unchanged DOM cost when both are closed; only one is open at a time.

## Open questions / assumptions

- **Assumption:** Consumers who want server-side projects (vs localStorage) implement the `ProjectActionAdapter` against their own backend. The framework is storage-agnostic.
- **Assumption:** "Leave project" (vs "Delete project") is a multi-user concept not in scope. Future Phase: project membership.
- **Open:** Whether the Projects section should auto-hide when `projects.length === 0` AND `actions.create` is not provided. Current rule renders the heading whenever `projects !== null` (including empty). Consumers who want zero-state suppression can pass `null`. Acceptable.
- **Open:** Whether `selectedProjectId` should affect the threads input automatically (framework filters) or stay a pure highlight signal (consumer filters). Current rule: consumer filters. Matches archive's pattern.
- **Open:** Whether `chat-thread-list`'s second overflow menu should re-anchor when the first menu closed and the kebab has shifted (e.g. because the row was deleted between the two menus). Current rule: same `menuAnchor` signal is reused; if the row is gone the anchor element is detached and `getBoundingClientRect()` returns zeroes. Edge case; menu would render at viewport top-left briefly before being dismissed. Worth catching in browser verification but not pre-emptively fixing.
