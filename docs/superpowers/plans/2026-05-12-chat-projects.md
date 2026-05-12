# Chat projects — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Projects as a first-class navigation surface in `@ngaf/chat`: a Projects section in the sidenav with CRUD actions, project-thread association via `Thread.projectId`, and a "Move to project" thread row action implemented via a second overflow-menu submenu.

**Architecture:** Adapter-driven — `ProjectActionAdapter` mirrors `ThreadActionAdapter`. New `chat-project-list` primitive (sibling of `chat-thread-list`) renders project rows with inline create/rename + destructive-confirm delete, reusing the existing `chat-overflow-menu` + `chat-confirm-dialog` primitives. `chat-thread-list` gains a `projects` input and renders a second overflow menu when the user clicks "Move to project." Example uses localStorage to persist projects since LangGraph has no native projects API.

**Tech Stack:** Angular 21 standalone components, signal inputs/outputs, plain CSS strings under `libs/chat/src/lib/styles/`, Vitest + Angular TestBed, `@langchain/langgraph-sdk` (for the thread-side `moveToProject` PATCH).

**Spec:** [docs/superpowers/specs/2026-05-12-chat-projects-design.md](../specs/2026-05-12-chat-projects-design.md)

> **Important — pin landed first (PR #267).** The chat-thread-list active-mode menu already includes `pin`/`unpin` items and a `pinned?` field on Thread. This plan inserts "Move to project" alongside the existing pin/unpin entries, NOT in place of them. Tasks 1 and 6 use code blocks that reflect the post-pin baseline. The implementer should `git log --oneline -3` first to confirm pin's commit (`3d56792c`) is in the branch history.

---

## File map

**Create:**
- `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts`
- `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts`
- `libs/chat/src/lib/styles/chat-project-list.styles.ts`
- `examples/chat/angular/src/app/shell/projects.service.ts`

**Modify:**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` — `Thread.projectId?`, `ThreadActionAdapter.moveToProject?`, `projects` input, move submenu state + handlers.
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` — Move-to-project tests.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — Projects section + new inputs/outputs.
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts` — Projects section tests.
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — Projects wrapper styles.
- `libs/chat/src/public-api.ts` — exports for `Project`, `ProjectActionAdapter`, `ChatProjectListComponent`.
- `examples/chat/angular/src/app/shell/threads.service.ts` — `toThread` reads `metadata.projectId`; `create` accepts optional `projectId`; new `moveToProject` method.
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — `projectActions`, `selectedProjectId` signal, `visibleThreads` computed, extend `threadActions` with `moveToProject`, new `onProjectSelected` / `onNewProjectClicked` handlers.
- `examples/chat/angular/src/app/shell/demo-shell.component.html` — bind new sidenav inputs/outputs.
- `apps/website/content/docs/chat/api/api-docs.json` — regenerated.

---

## Task 1: Type extensions

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`

- [ ] **Step 1: Add `projectId?` to Thread**

Find the `Thread` type (around line 24). Insert a `projectId` field BEFORE the `[key: string]: unknown` line:

```typescript
/** Optional project association. Consumers pre-filter threads by project
 *  before passing to the sidenav. Null/undefined means no project. */
projectId?: string | null;
```

- [ ] **Step 2: Add `moveToProject?` to ThreadActionAdapter**

Find the `ThreadActionAdapter` interface (around line 49). Add a new method at the end:

```typescript
/** Move thread to a project (or pass null to remove from any project).
 *  Optimistically hides the row from the current project's visible list;
 *  consumer is expected to refresh the threads input. */
moveToProject?(threadId: string, projectId: string | null): Promise<void>;
```

- [ ] **Step 3: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
git commit -m "feat(chat): Thread.projectId + ThreadActionAdapter.moveToProject"
```

---

## Task 2: `Project` + `ProjectActionAdapter` types

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts` (initial skeleton; expanded in Task 4)

This task creates the file with ONLY the type exports, so other files can reference them before the component is built.

- [ ] **Step 1: Create the skeleton file**

Create `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts` with:

```typescript
// libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

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

@Component({
  selector: 'chat-project-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS],
  template: ``,
})
export class ChatProjectListComponent {
  readonly projects = input.required<Project[]>();
  readonly activeProjectId = input<string | null>(null);
  readonly showNewProjectButton = input<boolean>(false);
  readonly actions = input<ProjectActionAdapter | null>(null);
  readonly projectSelected = output<string>();
  readonly newProjectRequested = output<void>();
}
```

Task 4 will replace the empty template + add internal state + the full implementation.

- [ ] **Step 2: Build**

Run: `npx nx run chat:build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts
git commit -m "feat(chat): Project + ProjectActionAdapter types; chat-project-list skeleton"
```

---

## Task 3: `chat-project-list` styles

**Files:**
- Create: `libs/chat/src/lib/styles/chat-project-list.styles.ts`

- [ ] **Step 1: Create the styles file**

Create `libs/chat/src/lib/styles/chat-project-list.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-project-list.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_PROJECT_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-project-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-project-list__item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chat-project-list__item {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 32px;
    padding: 6px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    background: transparent;
    border: 0;
    text-align: left;
    box-sizing: border-box;
    transition: background-color 150ms ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat-project-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-project-list__item[data-active="true"] {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
    box-shadow: inset 2px 0 0 var(--a2ui-primary, var(--ngaf-chat-primary));
  }
  .chat-project-list__kebab {
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
  .chat-project-list__item-wrap:hover .chat-project-list__kebab,
  .chat-project-list__item-wrap:focus-within .chat-project-list__kebab {
    opacity: 1;
  }
  .chat-project-list__kebab:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  .chat-project-list__kebab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-project-list__edit {
    flex: 1 1 auto;
    border: 1px solid var(--ngaf-chat-primary);
    border-radius: var(--ngaf-chat-radius-button);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    padding: 6px 10px;
    min-height: 32px;
    outline: none;
    box-sizing: border-box;
  }
  .chat-project-list__new {
    display: block;
    width: 100%;
    height: 32px;
    margin-bottom: var(--ngaf-chat-space-2);
    border: 1px dashed var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-button);
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    font-size: var(--ngaf-chat-font-size-sm);
    box-sizing: border-box;
    transition: background 150ms ease;
  }
  .chat-project-list__new:hover { background: var(--ngaf-chat-surface-alt); }
`;
```

- [ ] **Step 2: Build + commit**

```bash
npx nx run chat:build 2>&1 | tail -3
git add libs/chat/src/lib/styles/chat-project-list.styles.ts
git commit -m "feat(chat): chat-project-list styles"
```

---

## Task 4: `chat-project-list` component (full implementation)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts`

Replace the entire file contents (preserve the type exports added in Task 2):

- [ ] **Step 1: Full file replacement**

Replace `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts` with:

```typescript
// libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_PROJECT_LIST_STYLES } from '../../styles/chat-project-list.styles';
import {
  ChatOverflowMenuComponent,
  type OverflowMenuItem,
} from '../chat-overflow-menu/chat-overflow-menu.component';
import { ChatConfirmDialogComponent } from '../chat-confirm-dialog/chat-confirm-dialog.component';

export type Project = {
  id: string;
  name: string;
  /** Open shape — consumers may add icon, color, createdAt, etc. */
  [key: string]: unknown;
};

/**
 * Consumer-provided adapter for project lifecycle actions. The framework calls
 * these methods after user confirmation (delete) or commit (create/rename) and
 * manages optimistic UI + rollback on rejection.
 */
export interface ProjectActionAdapter {
  /** Create a new project. Returns the new project id; consumer is expected
   *  to also refresh its projects signal. */
  create?(name: string): Promise<{ id: string }>;
  rename?(projectId: string, newName: string): Promise<void>;
  /** Permanently delete the project. The framework calls this AFTER user
   *  confirms via the confirm dialog. */
  delete?(projectId: string): Promise<void>;
}

@Component({
  selector: 'chat-project-list',
  standalone: true,
  imports: [ChatOverflowMenuComponent, ChatConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_PROJECT_LIST_STYLES],
  template: `
    @if (showNewProjectButton()) {
      <button type="button" class="chat-project-list__new" (click)="onNewProjectClicked()">+ New project</button>
    }
    <ul class="chat-project-list">
      @if (creatingProject()) {
        <li class="chat-project-list__item-wrap">
          <input
            #createInput
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
            <input
              #editInput
              class="chat-project-list__edit"
              type="text"
              [value]="editingValue()"
              (input)="onEditInput($event)"
              (keydown.enter)="commitRename(project.id)"
              (keydown.escape)="cancelRename()"
              (blur)="cancelRename()"
              aria-label="Rename project"
            />
          } @else {
            <button
              type="button"
              class="chat-project-list__item"
              [attr.data-active]="project.id === activeProjectId() ? 'true' : null"
              [attr.aria-current]="project.id === activeProjectId() ? 'true' : null"
              (click)="selectProject(project.id)"
            >{{ project.name }}</button>

            @if (showKebab()) {
              <button
                #kebab
                type="button"
                class="chat-project-list__kebab"
                aria-label="More actions"
                aria-haspopup="menu"
                [attr.aria-expanded]="menuOpenForId() === project.id ? 'true' : 'false'"
                (click)="openMenu(project.id, kebab)"
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
      title="Delete project?"
      body="The project will be deleted. Threads in this project will remain but become unassigned."
      confirmLabel="Delete"
      tone="destructive"
      (confirmed)="performDelete()"
      (cancelled)="confirmDeleteId.set(null)"
    />
  `,
})
export class ChatProjectListComponent {
  readonly projects = input.required<Project[]>();
  readonly activeProjectId = input<string | null>(null);
  readonly showNewProjectButton = input<boolean>(false);
  readonly actions = input<ProjectActionAdapter | null>(null);

  readonly projectSelected = output<string>();
  readonly newProjectRequested = output<void>();

  protected readonly creatingProject = signal<boolean>(false);
  protected readonly creatingValue = signal<string>('');
  protected readonly editingProjectId = signal<string | null>(null);
  protected readonly editingValue = signal<string>('');
  protected readonly menuOpenForId = signal<string | null>(null);
  protected readonly menuAnchor = signal<HTMLElement | null>(null);
  protected readonly confirmDeleteId = signal<string | null>(null);

  private readonly pendingHidden = signal<ReadonlySet<string>>(new Set());
  private readonly pendingRenames = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly visibleProjects = computed<Project[]>(() => {
    const hidden = this.pendingHidden();
    const renames = this.pendingRenames();
    return this.projects()
      .filter((p) => !hidden.has(p.id))
      .map((p) => (renames.has(p.id) ? ({ ...p, name: renames.get(p.id)! }) : p));
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

  private readonly createInput = viewChild<ElementRef<HTMLInputElement>>('createInput');
  private readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');

  constructor() {
    effect(() => {
      if (this.creatingProject()) {
        queueMicrotask(() => this.createInput()?.nativeElement.focus());
      }
    });
  }

  protected selectProject(projectId: string): void {
    this.projectSelected.emit(projectId);
  }

  protected showKebab(): boolean {
    const a = this.actions();
    if (!a) return false;
    return Boolean(a.rename || a.delete);
  }

  protected openMenu(projectId: string, anchor: HTMLElement): void {
    this.menuAnchor.set(anchor);
    this.menuOpenForId.set(projectId);
  }

  protected onMenuAction(id: string): void {
    const projectId = this.menuOpenForId();
    this.menuOpenForId.set(null);
    if (!projectId) return;

    if (id === 'rename') {
      const p = this.projects().find((x) => x.id === projectId);
      this.editingValue.set(p?.name ?? '');
      this.editingProjectId.set(projectId);
      queueMicrotask(() => this.editInput()?.nativeElement.focus());
    } else if (id === 'delete') {
      this.confirmDeleteId.set(projectId);
    }
  }

  protected onNewProjectClicked(): void {
    this.creatingValue.set('');
    this.creatingProject.set(true);
    this.newProjectRequested.emit();
  }

  protected onCreateInput(e: Event): void {
    this.creatingValue.set((e.target as HTMLInputElement).value);
  }

  protected cancelCreate(): void {
    this.creatingProject.set(false);
    this.creatingValue.set('');
  }

  protected async commitCreate(): Promise<void> {
    const name = this.creatingValue().trim();
    this.creatingProject.set(false);
    this.creatingValue.set('');
    if (!name) return;
    const a = this.actions();
    if (!a?.create) return;
    try { await a.create(name); } catch { /* swallow; consumer's refresh won't show the row */ }
  }

  protected onEditInput(e: Event): void {
    this.editingValue.set((e.target as HTMLInputElement).value);
  }

  protected cancelRename(): void {
    this.editingProjectId.set(null);
  }

  protected async commitRename(projectId: string): Promise<void> {
    const newName = this.editingValue().trim();
    this.editingProjectId.set(null);
    if (!newName) return;
    const a = this.actions();
    if (!a?.rename) return;

    this.pendingRenames.update((m) => {
      const n = new Map(m);
      n.set(projectId, newName);
      return n;
    });
    try {
      await a.rename(projectId, newName);
    } catch {
      /* rollback via finally */
    } finally {
      this.pendingRenames.update((m) => {
        const n = new Map(m);
        n.delete(projectId);
        return n;
      });
    }
  }

  protected async performDelete(): Promise<void> {
    const projectId = this.confirmDeleteId();
    this.confirmDeleteId.set(null);
    if (!projectId) return;
    const a = this.actions();
    if (!a?.delete) return;

    this.pendingHidden.update((s) => new Set([...s, projectId]));
    try {
      await a.delete(projectId);
    } catch {
      /* rollback */
    } finally {
      this.pendingHidden.update((s) => {
        const n = new Set(s);
        n.delete(projectId);
        return n;
      });
    }
  }
}
```

- [ ] **Step 2: Build**

Run: `npx nx run chat:build && npx nx lint chat 2>&1 | tail -5`
Expected: build PASS, lint clean.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts
git commit -m "feat(chat): chat-project-list component"
```

---

## Task 5: `chat-project-list` spec

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts`

- [ ] **Step 1: Write the spec**

Create `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatProjectListComponent,
  type Project,
  type ProjectActionAdapter,
} from './chat-project-list.component';

function render(opts: {
  projects?: Project[];
  actions?: ProjectActionAdapter | null;
  activeProjectId?: string | null;
  showNewProjectButton?: boolean;
} = {}) {
  const fixture = TestBed.createComponent(ChatProjectListComponent);
  fixture.componentRef.setInput('projects', opts.projects ?? [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
  if (opts.actions !== undefined) fixture.componentRef.setInput('actions', opts.actions);
  if (opts.activeProjectId !== undefined) fixture.componentRef.setInput('activeProjectId', opts.activeProjectId);
  if (opts.showNewProjectButton !== undefined) fixture.componentRef.setInput('showNewProjectButton', opts.showNewProjectButton);
  fixture.detectChanges();
  return fixture;
}

describe('ChatProjectListComponent', () => {
  it('renders the project rows', () => {
    const fixture = render();
    const items = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(items.length).toBe(2);
    expect((items[0] as HTMLElement).textContent?.trim()).toBe('Work');
  });

  it('clicking a row emits projectSelected', () => {
    const fixture = render();
    let received: string | undefined;
    fixture.componentInstance.projectSelected.subscribe((id: string) => { received = id; });
    const items = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    (items[1] as HTMLElement).click();
    expect(received).toBe('p2');
  });

  it('activeProjectId match adds data-active', () => {
    const fixture = render({ activeProjectId: 'p1' });
    const items = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect((items[0] as HTMLElement).getAttribute('data-active')).toBe('true');
    expect((items[1] as HTMLElement).getAttribute('data-active')).toBeNull();
  });

  it('showNewProjectButton=false hides + New project', () => {
    const fixture = render({ showNewProjectButton: false });
    expect(fixture.nativeElement.querySelector('.chat-project-list__new')).toBeNull();
  });

  it('clicking + New project emits newProjectRequested and shows inline input', async () => {
    const fixture = render({
      showNewProjectButton: true,
      actions: { create: vi.fn().mockResolvedValue({ id: 'new' }) },
    });
    let emits = 0;
    fixture.componentInstance.newProjectRequested.subscribe(() => { emits++; });
    (fixture.nativeElement.querySelector('.chat-project-list__new') as HTMLElement).click();
    fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    fixture.detectChanges();
    expect(emits).toBe(1);
    const input = fixture.nativeElement.querySelector('.chat-project-list__edit') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('placeholder')).toBe('New project name');
  });

  it('Enter on new-project input calls adapter.create', async () => {
    const createSpy = vi.fn().mockResolvedValue({ id: 'new' });
    const fixture = render({ showNewProjectButton: true, actions: { create: createSpy } });
    (fixture.nativeElement.querySelector('.chat-project-list__new') as HTMLElement).click();
    fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.chat-project-list__edit') as HTMLInputElement;
    input.value = 'Hobbies';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(createSpy).toHaveBeenCalledWith('Hobbies');
  });

  it('Esc on new-project input cancels without calling adapter', async () => {
    const createSpy = vi.fn().mockResolvedValue({ id: 'new' });
    const fixture = render({ showNewProjectButton: true, actions: { create: createSpy } });
    (fixture.nativeElement.querySelector('.chat-project-list__new') as HTMLElement).click();
    fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.chat-project-list__edit') as HTMLInputElement;
    input.value = 'X';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(createSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.chat-project-list__edit')).toBeNull();
  });

  it('Rename via kebab opens edit mode with prefilled name', async () => {
    const fixture = render({ actions: { rename: vi.fn().mockResolvedValue(undefined) } });
    (fixture.nativeElement.querySelector('.chat-project-list__kebab') as HTMLElement).click();
    fixture.detectChanges();
    const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
      .find((el) => (el as HTMLElement).textContent?.trim() === 'Rename') as HTMLElement;
    item.click();
    fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.chat-project-list__edit') as HTMLInputElement;
    expect(input.value).toBe('Work');
  });

  it('Delete via kebab opens confirm dialog (destructive); confirm calls adapter', async () => {
    let resolveDelete!: () => void;
    const deleteSpy = vi.fn(() => new Promise<void>((r) => { resolveDelete = r; }));
    const fixture = render({ actions: { delete: deleteSpy } });
    (fixture.nativeElement.querySelector('.chat-project-list__kebab') as HTMLElement).click();
    fixture.detectChanges();
    const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
      .find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
    item.click();
    fixture.detectChanges();
    expect(document.querySelector('.chat-confirm-dialog')).not.toBeNull();
    (document.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
    fixture.detectChanges();
    expect(deleteSpy).toHaveBeenCalledWith('p1');
    const remaining = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(remaining.length).toBe(1);
    resolveDelete();
    await new Promise((r) => setTimeout(r, 0));
  });

  it('Delete adapter rejects → row reappears', async () => {
    const deleteSpy = vi.fn(async () => { throw new Error('boom'); });
    const fixture = render({ actions: { delete: deleteSpy } });
    (fixture.nativeElement.querySelector('.chat-project-list__kebab') as HTMLElement).click();
    fixture.detectChanges();
    const item = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
      .find((el) => (el as HTMLElement).textContent?.trim() === 'Delete') as HTMLElement;
    item.click();
    fixture.detectChanges();
    (document.querySelector('.chat-confirm-dialog__confirm') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const remaining = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(remaining.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npx nx run chat:test 2>&1 | tail -5
git add libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts
git commit -m "test(chat): chat-project-list coverage"
```

---

## Task 6: `chat-thread-list` Move-to-project wiring

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`

- [ ] **Step 1: Add `projects` input**

In the class body, after the existing `mode` input (line 143), add:

```typescript
import type { Project } from '../chat-project-list/chat-project-list.component';
```

Add the import alongside the existing imports. Then in the class:

```typescript
readonly projects = input<Project[] | null>(null);
```

- [ ] **Step 2: Add move-submenu state + computed**

Below the existing `confirmDeleteId` signal, add:

```typescript
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

- [ ] **Step 3: Add "Move to project" to active-mode `currentMenuItems`**

Find the existing `currentMenuItems` computed (around line 185). The post-pin baseline looks like:

```typescript
if (this.mode() === 'active') {
  const thread = this.threads().find((t) => t.id === id);
  const isPinned = thread?.pinned === true;
  if (a.rename) items.push({ id: 'rename', label: 'Rename' });
  if (a.pin && !isPinned) items.push({ id: 'pin', label: 'Pin' });
  if (a.unpin && isPinned) items.push({ id: 'unpin', label: 'Unpin' });
  if (a.archive) items.push({ id: 'archive', label: 'Archive' });
  if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
}
```

Insert ONE new line for "Move to project" between the `unpin` line and the `archive` line. The active-mode branch should become:

```typescript
if (this.mode() === 'active') {
  const thread = this.threads().find((t) => t.id === id);
  const isPinned = thread?.pinned === true;
  if (a.rename) items.push({ id: 'rename', label: 'Rename' });
  if (a.pin && !isPinned) items.push({ id: 'pin', label: 'Pin' });
  if (a.unpin && isPinned) items.push({ id: 'unpin', label: 'Unpin' });
  if (a.moveToProject && this.projects() !== null) {
    items.push({ id: 'move', label: 'Move to project' });
  }
  if (a.archive) items.push({ id: 'archive', label: 'Archive' });
  if (a.delete) items.push({ id: 'delete', label: 'Delete', tone: 'destructive' });
}
```

(The archived-mode branch is unchanged.)

- [ ] **Step 4: Update `showKebab`**

The post-pin baseline reads:

```typescript
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  if (this.mode() === 'active') return Boolean(a.rename || a.pin || a.unpin || a.archive || a.delete);
  return Boolean(a.unarchive || a.delete);
}
```

Extend the active-mode condition to also consider `moveToProject` (when `projects` is provided):

```typescript
protected showKebab(): boolean {
  const a = this.actions();
  if (!a) return false;
  if (this.mode() === 'active') {
    return Boolean(
      a.rename || a.pin || a.unpin || a.archive || a.delete ||
      (a.moveToProject && this.projects() !== null)
    );
  }
  return Boolean(a.unarchive || a.delete);
}
```

- [ ] **Step 5: Route the 'move' menu id**

The post-pin `onMenuAction` chain has branches for: `rename`, `delete`, `archive`, `unarchive`, `pin`, `unpin`. Add a new branch for `'move'` at the END of the chain (just before the closing brace of the method):

```typescript
} else if (id === 'move') {
  this.moveMenuOpenForId.set(threadId);
}
```

The full chain should then end with `... pin → unpin → move` (in that order or interleaved; order within the if/else-if doesn't affect behavior since each branch is mutually exclusive).

- [ ] **Step 6: Add `onMoveMenuAction` + `performMoveToProject`**

Below the existing `performDelete` method, add:

```typescript
protected onMoveMenuAction(itemId: string): void {
  const threadId = this.moveMenuOpenForId();
  this.moveMenuOpenForId.set(null);
  if (!threadId) return;
  const projectId = itemId === '__none__' ? null : itemId;
  void this.performMoveToProject(threadId, projectId);
}

protected async performMoveToProject(threadId: string, projectId: string | null): Promise<void> {
  const a = this.actions();
  if (!a?.moveToProject) return;
  this.pendingHidden.update((s) => new Set([...s, threadId]));
  try {
    await a.moveToProject(threadId, projectId);
  } catch {
    /* rollback via finally */
  } finally {
    this.pendingHidden.update((s) => {
      const n = new Set(s);
      n.delete(threadId);
      return n;
    });
  }
}
```

- [ ] **Step 7: Add the second `<chat-overflow-menu>` to the template**

In the template, immediately AFTER the existing `<chat-overflow-menu>` (the one bound to `menuOpenForId`/`currentMenuItems`), add:

```html
<chat-overflow-menu
  [open]="moveMenuOpenForId() !== null"
  [items]="moveMenuItems()"
  [anchor]="menuAnchor()"
  (itemSelected)="onMoveMenuAction($event)"
  (closed)="moveMenuOpenForId.set(null)"
/>
```

- [ ] **Step 8: Add spec coverage**

Open `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`. Inside the existing `describe('with adapter', ...)` block, BEFORE its closing brace, add these test cases:

```typescript
    it('moveToProject + projects=null → menu does NOT include "Move to project"', () => {
      const fixture = render({ actions: { moveToProject: vi.fn().mockResolvedValue(undefined) } });
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).not.toContain('Move to project');
    });

    it('moveToProject + projects=[] → menu includes "Move to project"', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First' }]);
      fixture.componentRef.setInput('actions', { moveToProject: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('projects', []);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toContain('Move to project');
    });

    it('Click "Move to project" closes the main menu and opens the move submenu', () => {
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First' }]);
      fixture.componentRef.setInput('actions', { moveToProject: vi.fn().mockResolvedValue(undefined) });
      fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      const moveItem = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move to project') as HTMLElement;
      moveItem.click();
      fixture.detectChanges();
      const labels = Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .map((el) => (el as HTMLElement).textContent?.trim());
      expect(labels).toEqual(['No project', 'Work', 'Personal']);
    });

    it('Clicking a project in the move submenu calls moveToProject with that id', async () => {
      const moveSpy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First' }, { id: 't2', title: 'Second' }]);
      fixture.componentRef.setInput('actions', { moveToProject: moveSpy });
      fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }]);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      (Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move to project') as HTMLElement).click();
      fixture.detectChanges();
      (Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Work') as HTMLElement).click();
      fixture.detectChanges();
      expect(moveSpy).toHaveBeenCalledWith('t1', 'p1');
      const remaining = fixture.nativeElement.querySelectorAll('.chat-thread-list__item');
      expect(remaining.length).toBe(1);
    });

    it('Clicking "No project" in the move submenu calls moveToProject(id, null)', () => {
      const moveSpy = vi.fn().mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(ChatThreadListComponent);
      fixture.componentRef.setInput('threads', [{ id: 't1', title: 'First' }]);
      fixture.componentRef.setInput('actions', { moveToProject: moveSpy });
      fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }]);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.chat-thread-list__kebab') as HTMLElement).click();
      fixture.detectChanges();
      (Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'Move to project') as HTMLElement).click();
      fixture.detectChanges();
      (Array.from(document.querySelectorAll('.chat-overflow-menu__item'))
        .find((el) => (el as HTMLElement).textContent?.trim() === 'No project') as HTMLElement).click();
      fixture.detectChanges();
      expect(moveSpy).toHaveBeenCalledWith('t1', null);
    });
```

- [ ] **Step 9: Run tests + commit**

Run:
```bash
npx nx run chat:test 2>&1 | tail -5
npx nx run chat:build 2>&1 | tail -3
npx nx lint chat 2>&1 | tail -3
```
Expected: all pass.

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/
git commit -m "feat(chat): chat-thread-list Move-to-project submenu"
```

---

## Task 7: `chat-sidenav` Projects section

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`

- [ ] **Step 1: Add styles**

Append to the template literal in `libs/chat/src/lib/styles/chat-sidenav.styles.ts`:

```css
  .chat-sidenav__projects { flex-shrink: 0; }
  :host([data-mode="collapsed"]) .chat-sidenav__projects { display: none; }
```

- [ ] **Step 2: Extend imports**

At the top of `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`, add to the existing `@ngaf/chat`-internal import block:

```typescript
import {
  ChatProjectListComponent,
  type Project,
  type ProjectActionAdapter,
} from '../../primitives/chat-project-list/chat-project-list.component';
```

Add `ChatProjectListComponent` to the `@Component({ imports: [...] })` array.

- [ ] **Step 3: Add inputs/outputs**

In the class body, after the existing `archivedThreads` input, add:

```typescript
readonly projects = input<Project[] | null>(null);
readonly selectedProjectId = input<string | null>(null);
readonly projectActions = input<ProjectActionAdapter | null>(null);
```

After the existing outputs (e.g. `searchOpened`, `openChange`), add:

```typescript
readonly projectSelected = output<string>();
readonly newProjectRequested = output<void>();
```

- [ ] **Step 4: Add the Projects section to the template**

In the template, find the `<div class="chat-sidenav__primary">...</div>` block (the existing primary slot). IMMEDIATELY AFTER its closing tag, BEFORE the existing `@if (threads() !== null)` block, insert:

```html
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
```

- [ ] **Step 5: Forward `projects` to the inner thread list**

Find the existing `<chat-thread-list>` element inside the `@if (threads() !== null)` block. Add `[projects]="projects()"` to its bindings (preserve all existing bindings):

```html
<chat-thread-list
  [threads]="threads()!"
  [activeThreadId]="activeThreadId() ?? ''"
  [actions]="actions()"
  [projects]="projects()"
  (threadSelected)="threadSelected.emit($event)"
/>
```

(There's also a SECOND `<chat-thread-list>` inside the archived section. Forward `projects` to that one too — though archived mode doesn't show the move-to-project entry, the input shouldn't differ between the two instances.)

- [ ] **Step 6: Verify**

Run:
```bash
npx nx run chat:test 2>&1 | tail -5
npx nx run chat:build 2>&1 | tail -3
npx nx lint chat 2>&1 | tail -3
```

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts libs/chat/src/lib/styles/chat-sidenav.styles.ts
git commit -m "feat(chat): chat-sidenav Projects section + forwards projects to thread list"
```

---

## Task 8: `chat-sidenav` Projects section tests

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`

- [ ] **Step 1: Add four new test cases**

Find the closing brace of the outer `describe('ChatSidenavComponent', ...)` block. BEFORE that closing brace, add:

```typescript
  it('projects=null renders no Projects section', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    expect(fixture.nativeElement.querySelector('.chat-sidenav__projects')).toBeNull();
  });

  it('projects=[p1,p2] renders the Projects section with two rows', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-sidenav__projects')).not.toBeNull();
    const rows = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(rows.length).toBe(2);
  });

  it('selectedProjectId highlights the matching project row', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', [{ id: 'p1', name: 'Work' }, { id: 'p2', name: 'Personal' }]);
    fixture.componentRef.setInput('selectedProjectId', 'p2');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.chat-project-list__item');
    expect(rows[0].getAttribute('data-active')).toBeNull();
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('projectActions.create shows "+ New project" and emits newProjectRequested on click', () => {
    const fixture = render({ threads: [{ id: 't1' }] });
    fixture.componentRef.setInput('projects', []);
    fixture.componentRef.setInput('projectActions', { create: async () => ({ id: 'x' }) });
    fixture.detectChanges();
    let emits = 0;
    fixture.componentInstance.newProjectRequested.subscribe(() => { emits++; });
    const btn = fixture.nativeElement.querySelector('.chat-project-list__new') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    fixture.detectChanges();
    expect(emits).toBe(1);
  });
```

- [ ] **Step 2: Run + commit**

```bash
npx nx run chat:test 2>&1 | tail -5
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
git commit -m "test(chat): chat-sidenav Projects section coverage"
```

---

## Task 9: Public API exports

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add exports**

In `libs/chat/src/public-api.ts`, near the existing `ChatThreadListComponent` and `ThreadActionAdapter` exports, add:

```typescript
export { ChatProjectListComponent } from './lib/primitives/chat-project-list/chat-project-list.component';
export type { Project, ProjectActionAdapter } from './lib/primitives/chat-project-list/chat-project-list.component';
```

- [ ] **Step 2: Build + commit**

```bash
npx nx run chat:build 2>&1 | tail -3
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export chat-project-list + Project + ProjectActionAdapter"
```

---

## Task 10: `ProjectsService` (localStorage-backed)

**Files:**
- Create: `examples/chat/angular/src/app/shell/projects.service.ts`

- [ ] **Step 1: Create the service**

Create `examples/chat/angular/src/app/shell/projects.service.ts`:

```typescript
// SPDX-License-Identifier: MIT
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

- [ ] **Step 2: Build + commit**

```bash
npx nx run examples-chat-angular:build 2>&1 | tail -3
git add examples/chat/angular/src/app/shell/projects.service.ts
git commit -m "feat(examples-chat): ProjectsService (localStorage-backed)"
```

---

## Task 11: `ThreadsService` `moveToProject` + projectId mapping

**Files:**
- Modify: `examples/chat/angular/src/app/shell/threads.service.ts`

- [ ] **Step 1: Add `moveToProject` method**

In the existing `ThreadsService`, AFTER the existing `unarchive` method, add:

```typescript
async moveToProject(threadId: string, projectId: string | null): Promise<void> {
  await this.client.threads.update(threadId, { metadata: { projectId } });
  await this.refresh();
}
```

- [ ] **Step 2: Extend `create` to accept optional projectId**

Find the existing `create()` method. Replace its signature + body with:

```typescript
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

- [ ] **Step 3: Update `toThread` to read `projectId`**

Find the existing private `toThread` method. Extend the `meta` destructure + return:

```typescript
private toThread(t: SdkThread): Thread {
  const meta = (t.metadata ?? {}) as { title?: unknown; archived?: unknown; projectId?: unknown };
  const customTitle = meta.title;
  const archived = meta.archived === true;
  const projectId = typeof meta.projectId === 'string' && meta.projectId.length > 0
    ? meta.projectId
    : null;
  return {
    id: t.thread_id,
    title: typeof customTitle === 'string' && customTitle.length > 0
      ? customTitle
      : `Thread ${t.thread_id.slice(0, 8)}`,
    status: archived ? 'archived' : 'active',
    projectId,
  };
}
```

- [ ] **Step 4: Build + commit**

```bash
npx nx run examples-chat-angular:build 2>&1 | tail -3
git add examples/chat/angular/src/app/shell/threads.service.ts
git commit -m "feat(examples-chat): ThreadsService projectId mapping + moveToProject"
```

---

## Task 12: Demo shell wiring

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`

- [ ] **Step 1: Extend the `@ngaf/chat` imports**

Open `examples/chat/angular/src/app/shell/demo-shell.component.ts`. Extend the existing `@ngaf/chat` import block to include `type Project` and `type ProjectActionAdapter`:

```typescript
import {
  ChatDebugComponent,
  // ... existing
  ChatSidenavComponent,
  type ChatSidenavMode,
  ChatHistorySearchPaletteComponent,
  type ThreadMatch,
  type ThreadActionAdapter,
  type Project,
  type ProjectActionAdapter,
} from '@ngaf/chat';
```

(Do not remove or reorder existing identifiers; just add the two new types.)

- [ ] **Step 2: Import `ProjectsService`**

Add an import at the top of the file:

```typescript
import { ProjectsService } from './projects.service';
```

And inject it as a protected field near the existing `threadsSvc`:

```typescript
protected readonly projectsSvc = inject(ProjectsService);
```

- [ ] **Step 3: Add `selectedProjectId` signal**

Near the existing `threadIdSignal` declaration, add:

```typescript
protected readonly selectedProjectId = signal<string | null>(
  this.persistence.read('selectedProjectId') ?? null,
);
```

- [ ] **Step 4: Add `visibleThreads` computed**

Near the existing `searchResults` computed (or anywhere in the protected-fields area), add:

```typescript
/** Active threads filtered by the selected project (or all, when none selected). */
protected readonly visibleThreads = computed<Thread[]>(() => {
  const sel = this.selectedProjectId();
  const all = this.threadsSvc.threads();
  return sel === null ? all : all.filter((t) => t.projectId === sel);
});
```

You'll also need to import `type Thread` from `@ngaf/chat` if it's not already there. Add to the existing import block alongside `ThreadActionAdapter`.

- [ ] **Step 5: Define `projectActions`**

Near the existing `threadActions` property, add:

```typescript
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
```

- [ ] **Step 6: Extend `threadActions` with `moveToProject`**

Find the existing `threadActions: ThreadActionAdapter` declaration. Add the new method (preserve all existing ones):

```typescript
moveToProject: async (id, projectId) => {
  await this.threadsSvc.moveToProject(id, projectId);
  // If we moved the active thread out of the currently-selected project,
  // the chat view will switch to welcome via the visibleThreads filter.
},
```

- [ ] **Step 7: Add `onProjectSelected` + `onNewProjectClicked` handlers**

Near the existing `onThreadSelected` method, add:

```typescript
protected onProjectSelected(projectId: string): void {
  this.selectedProjectId.set(projectId);
  this.persistence.write('selectedProjectId', projectId);
}

protected onNewProjectClicked(): void {
  // Framework's chat-project-list owns the inline-create flow; this is an
  // informational event for the consumer.
}
```

- [ ] **Step 8: Update `onNewThread` to start in the selected project**

Find the existing `onNewThread` method. Update its body to pass the selected project id:

```typescript
protected async onNewThread(): Promise<void> {
  const sel = this.selectedProjectId();
  const id = await this.threadsSvc.create(sel ?? undefined);
  if (id) {
    this.threadIdSignal.set(id);
    this.persistence.write('threadId', id);
  }
}
```

(If the existing implementation has additional logic, preserve it; only the call to `create` changes.)

- [ ] **Step 9: Update the template**

Open `examples/chat/angular/src/app/shell/demo-shell.component.html`. Update the existing `<chat-sidenav>` element to:

```html
<chat-sidenav
  [threads]="visibleThreads()"
  [archivedThreads]="threadsSvc.archivedThreads()"
  [projects]="projectsSvc.projects()"
  [selectedProjectId]="selectedProjectId()"
  [projectActions]="projectActions"
  [activeThreadId]="threadIdSignal() ?? ''"
  [mode]="sidenavMode()"
  [(open)]="drawerOpen"
  [actions]="threadActions"
  (newChat)="onNewThread()"
  (threadSelected)="onThreadSelected($event)"
  (projectSelected)="onProjectSelected($event)"
  (newProjectRequested)="onNewProjectClicked()"
  (searchOpened)="paletteOpen.set(true)"
  (openChange)="onSidenavOpenChange($event)"
/>
```

The key changes: `[threads]` now uses `visibleThreads()` (filtered by project); three new project-related bindings; two new project-related outputs.

- [ ] **Step 10: Build**

```bash
npx nx run examples-chat-angular:build 2>&1 | tail -5
```

- [ ] **Step 11: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.html
git commit -m "feat(examples-chat): wire projects + project filtering + move-to-project"
```

---

## Task 13: Regenerate API docs

**Files:**
- Modify: `apps/website/content/docs/chat/api/api-docs.json`

- [ ] **Step 1: Regenerate**

```bash
npx tsx apps/website/scripts/generate-api-docs.ts 2>&1 | tail -5
```

Expected: `✓ chat/api/api-docs.json (N entries)` with N including new `ChatProjectListComponent`, `Project`, `ProjectActionAdapter`, and updated `ThreadActionAdapter.moveToProject` entries.

- [ ] **Step 2: Stage + commit**

```bash
git diff --stat apps/website/content/docs/chat/api/api-docs.json
git add apps/website/content/docs/chat/api/api-docs.json
git commit -m "docs(chat): regenerate API docs for Projects"
```

---

## Task 14: Manual browser verification

**Files:** none — verification only.

Controller-owned. Subagents should stop after Task 13.

The controller will:

1. Start the dev server. Note: previous tasks revealed nx serve picks up stale `dist/libs/chat`; pre-clear with `rm -rf dist/libs/chat dist/libs/render`.
2. Resize to desktop preset.
3. Verify each behavior:
   - Sidenav renders empty Projects section heading on first load (no projects yet), with **"+ New project"** button visible.
   - Click "+ New project" → inline input appears, focused, with placeholder "New project name".
   - Type "Work" + Enter → row appears with name "Work", auto-selected (highlighted).
   - Click "+ New chat" while Work is selected → new thread created with `metadata.projectId='Work-id'`. Thread visible in Recent.
   - Hover the new thread → kebab fades in. Menu includes "Move to project".
   - Click "Move to project" → main menu closes, move submenu opens with "No project" + "Work".
   - Click "No project" → thread vanishes from Recent (no longer matches the project filter).
   - Click Projects heading area to deselect → all threads visible; the moved thread appears.
   - Rename "Work" → "Personal" via kebab → row updates.
   - Delete "Personal" via kebab → destructive confirm dialog → confirm → row gone. Threads previously associated remain in LangGraph but have orphan `projectId`.
   - Reload page → projects persist via localStorage; selected-project persists via `PalettePersistence`.
4. Screenshot: Projects section with rows, move submenu open with project options, confirm dialog for delete.
5. Stop preview.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `Project` type | Task 2 (initial) + Task 4 (full) |
| `ProjectActionAdapter` interface | Task 2 + Task 4 |
| `Thread.projectId?` | Task 1 |
| `ThreadActionAdapter.moveToProject?` | Task 1 |
| `chat-project-list` styles | Task 3 |
| `chat-project-list` component (inputs, state, template, handlers) | Task 4 |
| `chat-project-list` tests | Task 5 |
| `chat-thread-list` `projects` input | Task 6 |
| `chat-thread-list` move submenu state + items computed | Task 6 |
| `chat-thread-list` "Move to project" menu entry | Task 6 |
| `chat-thread-list` `performMoveToProject` | Task 6 |
| `chat-thread-list` second `<chat-overflow-menu>` instance | Task 6 |
| `chat-thread-list` move-to-project tests | Task 6 |
| `chat-sidenav.projects` / `selectedProjectId` / `projectActions` inputs | Task 7 |
| `chat-sidenav` `(projectSelected)` / `(newProjectRequested)` outputs | Task 7 |
| `chat-sidenav` template Projects section | Task 7 |
| `chat-sidenav` forwards `projects` to thread-list | Task 7 |
| `chat-sidenav` Projects section tests | Task 8 |
| Public-api exports | Task 9 |
| `ProjectsService` (localStorage) | Task 10 |
| `ThreadsService.moveToProject` + `projectId` mapping + create-with-projectId | Task 11 |
| Demo-shell wiring | Task 12 |
| API docs regen | Task 13 |
| Manual verification | Task 14 |

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `Project` shape (`id`, `name`, open) defined in Task 2/4, consumed in Tasks 6, 7, 10, 12.
- `ProjectActionAdapter` (`create`/`rename`/`delete`) consistent across Tasks 2/4, 7, 10, 12.
- `Thread.projectId` (`string | null`) defined in Task 1, consumed in Tasks 6, 11, 12.
- `ThreadActionAdapter.moveToProject` (`(id, projectId | null) => Promise<void>`) defined in Task 1, consumed in Tasks 6, 11, 12.
- Output names consistent: `projectSelected`, `newProjectRequested`. Method names consistent: `commitCreate`, `cancelCreate`, `onCreateInput`, `performDelete`, `performMoveToProject`, `onMoveMenuAction`.
- The internal "No project" sentinel uses the literal `'__none__'` consistently across the template, computed, and handler.
