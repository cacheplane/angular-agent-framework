# Threads + Checkpoints Navigation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 6 (timeline slider) and Phase 7 (threads side panel) demo navigation with a left-edge slide-out threads drawer plus inline gutter checkpoint markers on each assistant turn. The legacy slider survives only inside the Debug overlay.

**Architecture:** Three independently mergeable PRs. PR 1 adds new lib primitives (`chat-thread-drawer`, `chat-checkpoint-marker`) and extends two existing ones (`chat-thread-list`, `chat-message`) plus a new `messageCheckpoints()` helper on the LangGraph adapter. PR 2 patches the Python graph to write a derived thread title into LangGraph metadata on the first user message. PR 3 rewires the demo shell to use the new primitives, removes the two fixed side panels, and relocates the legacy timeline slider into `chat-debug`. PR 3 depends on PR 1; PR 2 is optional (titles degrade gracefully to ids).

**Tech Stack:** Angular 21 standalone components + signals + OnPush; Vitest for lib tests; Python 3.12 + LangGraph SDK; pytest for backend; Chrome MCP for live smoke.

**Spec:** `docs/superpowers/specs/2026-05-10-threads-checkpoints-nav-v2-design.md` (commit `52b7ad58` on `claude/spec-threads-checkpoints-nav-v2`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commits, PR bodies, or docs.

---

## File Structure

### PR 1 — Lib primitives (`claude/nav-v2-lib-primitives`)

**Create**
- `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.ts`
- `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.spec.ts`
- `libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.ts`
- `libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.spec.ts`

**Modify**
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts` (extend `Thread` type with optional `updatedAt`; default item template renders title + relative time)
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` (cover the new template branch)
- `libs/chat/src/lib/styles/chat-thread-list.styles.ts` (add two-line layout)
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts` (new `checkpointId?` input; gutter slot; replay/fork outputs)
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts` (new gutter behaviour)
- `libs/chat/src/lib/agent/agent-with-history.ts` (add `messageCheckpoints?: Signal<ReadonlyMap<string, string>>`)
- `libs/langgraph/src/lib/agent.fn.ts` (compute and expose `messageCheckpoints` from `historySig`)
- `libs/langgraph/src/lib/agent.fn.spec.ts` (cover the pairing rule)
- `libs/chat/src/public-api.ts` (export new primitives)

### PR 2 — Backend title write (`claude/nav-v2-backend-titles`)

**Modify**
- `examples/chat/python/src/graph.py` (add `_maybe_write_thread_title()` helper + invoke from `generate` node)
- `examples/chat/python/tests/test_graph_smoke.py` (extend with a title-write test)

### PR 3 — Demo shell wiring (`claude/nav-v2-demo-wiring`)

**Modify**
- `examples/chat/angular/src/app/shell/demo-shell.component.html` (remove panels; add header + drawer + marker wiring)
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` (drop timeline/threads signals; add drawer signals + viewport-width tracker)
- `examples/chat/angular/src/app/shell/demo-shell.component.css` (remove panel rules; add header + drawer reflow rules)
- `examples/chat/angular/src/app/shell/control-palette.component.ts` (remove `timelineOpen` + `threadsOpen` inputs/outputs)
- `examples/chat/angular/src/app/shell/control-palette.component.html` (remove two toggle buttons)
- `examples/chat/angular/src/app/shell/palette-persistence.service.ts` (`PaletteState`: replace `timeline`/`threads` with `drawerOpen`)
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` (import + render `<chat-timeline-slider>` in a new debug section)

---

## Phase 0 — Branch creation (PR 1)

### Task 0.1: Fork branch for PR 1

- [ ] **Step 1: Fork from origin/main**

```bash
git fetch origin && git checkout -b claude/nav-v2-lib-primitives origin/main
git log --oneline -1
```

Expected: commit hash of the latest origin/main HEAD.

---

## Phase 1 — Lib primitives (PR 1)

### Task 1.1: `chat-checkpoint-marker` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatCheckpointMarkerComponent } from './chat-checkpoint-marker.component';

@Component({
  standalone: true,
  imports: [ChatCheckpointMarkerComponent],
  template: `<chat-checkpoint-marker
    [checkpointId]="cpId"
    [isActive]="active"
    (replayRequested)="onReplay($event)"
    (forkRequested)="onFork($event)" />`,
})
class HostComponent {
  cpId = 'cp-1';
  active = false;
  replayed: string[] = [];
  forked: string[] = [];
  onReplay(id: string): void { this.replayed.push(id); }
  onFork(id: string): void { this.forked.push(id); }
}

describe('ChatCheckpointMarkerComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('renders a dot button labelled with the checkpoint id', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    const dot = fx.nativeElement.querySelector('.chat-checkpoint-marker__dot') as HTMLButtonElement;
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('aria-label')).toContain('cp-1');
  });

  it('applies the active class when isActive=true', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.active = true;
    fx.detectChanges();
    const dot = fx.nativeElement.querySelector('.chat-checkpoint-marker__dot');
    expect(dot.getAttribute('data-active')).toBe('true');
  });

  it('emits replayRequested with the checkpointId when Rewind is clicked', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="rewind"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.replayed).toEqual(['cp-1']);
  });

  it('emits forkRequested with the checkpointId when Fork is clicked', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="fork"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.forked).toEqual(['cp-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testFile chat-checkpoint-marker.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — file `chat-checkpoint-marker.component` not found.

- [ ] **Step 3: Implement the component**

```typescript
// libs/chat/src/lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-checkpoint-marker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host {
      display: inline-flex;
      align-items: center;
      width: 14px;
      height: 100%;
      flex: 0 0 14px;
    }
    .chat-checkpoint-marker__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      padding: 0;
      cursor: pointer;
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--a2ui-primary, var(--ngaf-chat-primary));
      transition: background 120ms ease;
      position: relative;
    }
    .chat-checkpoint-marker__dot:hover,
    .chat-checkpoint-marker__dot:focus-visible {
      background: var(--a2ui-primary, var(--ngaf-chat-primary));
      outline: none;
    }
    .chat-checkpoint-marker__dot[data-active="true"] {
      background: var(--a2ui-primary, var(--ngaf-chat-primary));
    }
    .chat-checkpoint-marker__pill {
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      display: none;
      gap: 6px;
      padding: 4px 8px;
      background: var(--ngaf-chat-surface-alt);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-button);
      white-space: nowrap;
      font-size: 11px;
      z-index: 5;
    }
    .chat-checkpoint-marker__dot:hover + .chat-checkpoint-marker__pill,
    .chat-checkpoint-marker__dot:focus-visible + .chat-checkpoint-marker__pill,
    .chat-checkpoint-marker__pill:hover {
      display: inline-flex;
    }
    @media (pointer: coarse) {
      .chat-checkpoint-marker__dot:hover + .chat-checkpoint-marker__pill,
      .chat-checkpoint-marker__dot:focus-visible + .chat-checkpoint-marker__pill {
        display: none;
      }
      .chat-checkpoint-marker__dot[data-open="true"] + .chat-checkpoint-marker__pill {
        display: inline-flex;
      }
    }
    .chat-checkpoint-marker__action {
      background: transparent;
      border: 0;
      color: var(--ngaf-chat-text);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
    }
    .chat-checkpoint-marker__action:hover { color: var(--a2ui-primary, var(--ngaf-chat-primary)); }
  `],
  template: `
    <button
      type="button"
      class="chat-checkpoint-marker__dot"
      [attr.data-active]="isActive() ? 'true' : null"
      [attr.aria-label]="'Checkpoint ' + checkpointId()"
    ></button>
    <span class="chat-checkpoint-marker__pill" role="group" aria-label="Checkpoint actions">
      <button
        type="button"
        class="chat-checkpoint-marker__action"
        data-action="rewind"
        (click)="replayRequested.emit(checkpointId())"
      >↶ Rewind</button>
      <button
        type="button"
        class="chat-checkpoint-marker__action"
        data-action="fork"
        (click)="forkRequested.emit(checkpointId())"
      >⑂ Fork</button>
    </span>
  `,
})
export class ChatCheckpointMarkerComponent {
  readonly checkpointId = input.required<string>();
  readonly isActive = input<boolean>(false);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();
}
```

- [ ] **Step 4: Re-run tests and verify they pass**

```bash
npx nx test chat --testFile chat-checkpoint-marker.component.spec.ts 2>&1 | tail -10
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-checkpoint-marker/
git commit -m "feat(chat): chat-checkpoint-marker primitive

Renders a 10px dot in a 14px gutter slot, with a hover/focus pill
exposing Rewind + Fork actions. Replaces the right-side timeline
slider as the primary time-travel surface for inline use in
chat-message gutters."
```

---

### Task 1.2: `chat-thread-drawer` composition

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatThreadDrawerComponent } from './chat-thread-drawer.component';

@Component({
  standalone: true,
  imports: [ChatThreadDrawerComponent],
  template: `<chat-thread-drawer
    [open]="open"
    [mode]="mode"
    (openChange)="onOpenChange($event)">
    <div data-testid="drawer-body">child content</div>
  </chat-thread-drawer>`,
})
class HostComponent {
  open = false;
  mode: 'push' | 'overlay' = 'push';
  changes: boolean[] = [];
  onOpenChange(v: boolean): void { this.changes.push(v); }
}

describe('ChatThreadDrawerComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent] }));

  it('hides the drawer when open=false (translated off-screen)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.detectChanges();
    const drawer = fx.nativeElement.querySelector('.chat-thread-drawer') as HTMLElement;
    expect(drawer.getAttribute('data-open')).toBe('false');
  });

  it('shows the drawer when open=true', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer').getAttribute('data-open')).toBe('true');
  });

  it('renders no scrim in push mode', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'push';
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer__scrim')).toBeNull();
  });

  it('renders a scrim in overlay mode when open', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'overlay';
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.chat-thread-drawer__scrim')).toBeTruthy();
  });

  it('scrim click emits openChange(false)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.componentInstance.mode = 'overlay';
    fx.detectChanges();
    (fx.nativeElement.querySelector('.chat-thread-drawer__scrim') as HTMLElement).click();
    expect(fx.componentInstance.changes).toEqual([false]);
  });

  it('Escape keydown on drawer host emits openChange(false)', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    const drawer = fx.nativeElement.querySelector('.chat-thread-drawer') as HTMLElement;
    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fx.componentInstance.changes).toEqual([false]);
  });

  it('projects child content into the drawer body', () => {
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open = true;
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-testid="drawer-body"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testFile chat-thread-drawer.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — file `chat-thread-drawer.component` not found.

- [ ] **Step 3: Implement the component**

```typescript
// libs/chat/src/lib/compositions/chat-thread-drawer/chat-thread-drawer.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export type ChatThreadDrawerMode = 'push' | 'overlay';

@Component({
  selector: 'chat-thread-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host {
      --chat-thread-drawer-width: 280px;
      display: contents;
    }
    .chat-thread-drawer__scrim {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 1000;
    }
    .chat-thread-drawer {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: var(--chat-thread-drawer-width);
      background: var(--ngaf-chat-bg);
      border-right: 1px solid var(--ngaf-chat-separator);
      z-index: 1001;
      transform: translateX(-100%);
      transition: transform 200ms ease;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .chat-thread-drawer[data-open="true"] { transform: translateX(0); }
    @media (max-width: 767px) {
      .chat-thread-drawer { width: 100%; }
    }
  `],
  template: `
    @if (open() && mode() === 'overlay') {
      <div class="chat-thread-drawer__scrim" (click)="openChange.emit(false)"></div>
    }
    <aside
      class="chat-thread-drawer"
      role="dialog"
      aria-label="Conversations"
      tabindex="-1"
      [attr.data-open]="open() ? 'true' : 'false'"
      [attr.data-mode]="mode()"
      (keydown.escape)="openChange.emit(false)"
    >
      <ng-content />
    </aside>
  `,
})
export class ChatThreadDrawerComponent {
  readonly open = input.required<boolean>();
  readonly mode = input<ChatThreadDrawerMode>('push');

  readonly openChange = output<boolean>();
}
```

- [ ] **Step 4: Re-run tests and verify they pass**

```bash
npx nx test chat --testFile chat-thread-drawer.component.spec.ts 2>&1 | tail -10
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-thread-drawer/
git commit -m "feat(chat): chat-thread-drawer composition

Slide-in container at left viewport edge, hosting projected
content (typically chat-thread-list). Two modes: push (no scrim;
host page reflows by setting padding-left on its main column)
and overlay (scrim closes on click). Escape key closes."
```

---

### Task 1.3: Extend `chat-thread-list` with default item template (title + relative time)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`
- Modify: `libs/chat/src/lib/styles/chat-thread-list.styles.ts`

- [ ] **Step 1: Write the failing test (append to existing spec)**

Append this block to `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts` (after the existing `describe`):

```typescript
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatThreadListComponent } from './chat-thread-list.component';
import type { Thread } from './chat-thread-list.component';

@Component({
  standalone: true,
  imports: [ChatThreadListComponent],
  template: `<chat-thread-list [threads]="threads" [activeThreadId]="''" />`,
})
class DefaultTemplateHost {
  threads: Thread[] = [
    { id: 'a', title: 'Coral reefs', updatedAt: Date.now() - 60_000 },
    { id: 'b', title: 'Angular signals' }, // no updatedAt
  ];
}

describe('ChatThreadListComponent — default item template', () => {
  it('renders title line and relative-time line when updatedAt present', () => {
    TestBed.configureTestingModule({ imports: [DefaultTemplateHost] });
    const fx = TestBed.createComponent(DefaultTemplateHost);
    fx.detectChanges();
    const items = fx.nativeElement.querySelectorAll('.chat-thread-list__item');
    expect(items[0].querySelector('.chat-thread-list__item-title').textContent.trim()).toBe('Coral reefs');
    expect(items[0].querySelector('.chat-thread-list__item-time').textContent.trim()).toMatch(/min|sec|now/);
  });

  it('omits the time line when updatedAt absent', () => {
    TestBed.configureTestingModule({ imports: [DefaultTemplateHost] });
    const fx = TestBed.createComponent(DefaultTemplateHost);
    fx.detectChanges();
    const items = fx.nativeElement.querySelectorAll('.chat-thread-list__item');
    expect(items[1].querySelector('.chat-thread-list__item-time')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testFile chat-thread-list.component.spec.ts 2>&1 | tail -15
```

Expected: FAIL — selectors `.chat-thread-list__item-title` / `.chat-thread-list__item-time` not found (current template renders a single line).

- [ ] **Step 3: Extend the `Thread` type and default item template**

Replace the file contents:

```typescript
// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  contentChild,
  input,
  output,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_THREAD_LIST_STYLES } from '../../styles/chat-thread-list.styles';

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

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_THREAD_LIST_STYLES],
  template: `
    @if (showNewThreadButton()) {
      <button type="button" class="chat-thread-list__new" (click)="newThreadRequested.emit()">+ New thread</button>
    }
    <ul class="chat-thread-list">
      @for (thread of threads(); track thread.id) {
        <li>
          @if (templateRef()) {
            <ng-container
              [ngTemplateOutlet]="templateRef()!"
              [ngTemplateOutletContext]="{ $implicit: thread, isActive: thread.id === activeThreadId() }"
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
              @if (thread.updatedAt != null) {
                <span class="chat-thread-list__item-time">{{ relativeTime(thread.updatedAt) }}</span>
              }
            </button>
          }
        </li>
      }
    </ul>
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Thread[]>();
  readonly activeThreadId = input<string>('');
  readonly showNewThreadButton = input<boolean>(false);

  readonly threadSelected = output<string>();
  readonly newThreadRequested = output<void>();

  readonly templateRef = contentChild(TemplateRef);

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
}
```

- [ ] **Step 4: Update styles to support the two-line layout**

Replace `libs/chat/src/lib/styles/chat-thread-list.styles.ts`:

```typescript
// SPDX-License-Identifier: MIT
export const CHAT_THREAD_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-thread-list__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 36px;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    background: transparent;
    border: 0;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    transition: background-color 150ms ease;
  }
  .chat-thread-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-thread-list__item[data-active="true"] {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
    box-shadow: inset 2px 0 0 var(--a2ui-primary, var(--ngaf-chat-primary));
  }
  .chat-thread-list__item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }
  .chat-thread-list__item-time {
    font-size: 11px;
    color: var(--ngaf-chat-text-muted);
    display: block;
  }
  .chat-thread-list__new {
    display: block;
    width: 100%;
    height: 36px;
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
  .chat-thread-list__new:hover { background: var(--ngaf-chat-surface-alt); }
`;
```

- [ ] **Step 5: Re-run tests and verify they pass**

```bash
npx nx test chat --testFile chat-thread-list.component.spec.ts 2>&1 | tail -15
```

Expected: all passing (including original 5 structural tests + 2 new default-template tests).

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list/ libs/chat/src/lib/styles/chat-thread-list.styles.ts
git commit -m "feat(chat): chat-thread-list default item template renders title + relative time

Extends the Thread type with an optional updatedAt epoch-ms field.
When present, the default item template renders a second line with
a relative-time label (just now / 5 min ago / 2 hr ago / 3 day ago).
Existing templateRef projection still wins when provided, so
back-compat is preserved."
```

---

### Task 1.4: Extend `chat-message` with `checkpointId` + gutter slot

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts`

- [ ] **Step 1: Write the failing tests (append to existing spec)**

Append to `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message
    role="assistant"
    [checkpointId]="cpId"
    (replayRequested)="replayed.push($event)"
    (forkRequested)="forked.push($event)">Hello</chat-message>`,
})
class GutterHost {
  cpId: string | undefined = undefined;
  replayed: string[] = [];
  forked: string[] = [];
}

describe('ChatMessageComponent — gutter checkpoint marker', () => {
  it('does not render a marker when checkpointId is unset', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('chat-checkpoint-marker')).toBeNull();
  });

  it('renders a marker in the gutter when checkpointId is set', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    const marker = fx.nativeElement.querySelector('chat-checkpoint-marker');
    expect(marker).toBeTruthy();
    expect(marker.querySelector('[aria-label]').getAttribute('aria-label')).toContain('cp-99');
  });

  it('bubbles replayRequested from the marker as a message-level output', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="rewind"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.replayed).toEqual(['cp-99']);
  });

  it('bubbles forkRequested from the marker as a message-level output', () => {
    TestBed.configureTestingModule({ imports: [GutterHost] });
    const fx = TestBed.createComponent(GutterHost);
    fx.componentInstance.cpId = 'cp-99';
    fx.detectChanges();
    (fx.nativeElement.querySelector('[data-action="fork"]') as HTMLButtonElement).click();
    expect(fx.componentInstance.forked).toEqual(['cp-99']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx nx test chat --testFile chat-message.component.spec.ts 2>&1 | tail -10
```

Expected: FAIL — `<chat-checkpoint-marker>` not rendered, `replayRequested`/`forkRequested` outputs do not exist.

- [ ] **Step 3: Extend the component**

Replace `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed, effect, inject } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';
import { ChatCitationsComponent } from '../chat-citations/chat-citations.component';
import { ChatCheckpointMarkerComponent } from '../chat-checkpoint-marker/chat-checkpoint-marker.component';
import { CitationsResolverService } from '../../markdown/citations-resolver.service';
import type { Message } from '../../agent/message';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

@Component({
  selector: 'chat-message',
  standalone: true,
  imports: [ChatCitationsComponent, ChatCheckpointMarkerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES, `
    .chat-message__layout { display: flex; gap: 8px; align-items: flex-start; }
    .chat-message__gutter { flex: 0 0 14px; display: flex; align-items: flex-start; padding-top: 4px; }
    .chat-message__gutter:empty { flex-basis: 0; }
    .chat-message__main { flex: 1; min-width: 0; }
  `],
  providers: [CitationsResolverService],
  host: {
    '[attr.data-role]': 'role()',
    '[attr.data-current]': 'currentStr()',
    '[attr.data-streaming]': 'streamingStr()',
    '[attr.data-prev-role]': 'prevRole() ?? null',
  },
  template: `
    <div class="chat-message__layout">
      <div class="chat-message__gutter">
        @if (checkpointId(); as cpId) {
          <chat-checkpoint-marker
            [checkpointId]="cpId"
            [isActive]="checkpointActive()"
            (replayRequested)="replayRequested.emit($event)"
            (forkRequested)="forkRequested.emit($event)"
          />
        }
      </div>
      <div class="chat-message__main">
        <div [class]="bodyClass()">
          <ng-content />
          <span class="chat-message__caret" aria-hidden="true"></span>
        </div>
        @if (message()?.role === 'assistant' && message(); as msg) {
          <chat-citations [message]="msg" />
        }
        <div class="chat-message__controls">
          <ng-content select="[chatMessageControls]" />
        </div>
      </div>
    </div>
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);
  readonly message = input<Message | undefined>(undefined);

  /** Optional checkpoint id to anchor a gutter marker. When set, a
   *  chat-checkpoint-marker is rendered in the left gutter and emits
   *  bubble through this component's replayRequested / forkRequested outputs. */
  readonly checkpointId = input<string | undefined>(undefined);
  readonly checkpointActive = input<boolean>(false);

  readonly replayRequested = output<string>();
  readonly forkRequested = output<string>();

  private readonly resolver = inject(CitationsResolverService);

  constructor() {
    effect(() => {
      this.resolver.message.set(this.message() ?? null);
    });
  }

  readonly currentStr = computed(() => String(this.current()));
  readonly streamingStr = computed(() => String(this.streaming()));

  readonly bodyClass = computed(() => {
    switch (this.role()) {
      case 'user': return 'chat-message__bubble';
      case 'assistant': return 'chat-message__assistant-body';
      default: return 'chat-message__plain';
    }
  });
}
```

- [ ] **Step 4: Re-run tests and verify they pass**

```bash
npx nx test chat --testFile chat-message.component.spec.ts 2>&1 | tail -10
```

Expected: all original tests + 4 new gutter tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-message/
git commit -m "feat(chat): chat-message gutter slot + checkpoint marker wiring

New optional [checkpointId] input mounts a chat-checkpoint-marker
in a left gutter (14px). Bubbles replayRequested + forkRequested
as message-level outputs so consumers can wire to time-travel
handlers. Gutter collapses to zero width when checkpointId is
unset — back-compat preserved for non-time-travel consumers."
```

---

### Task 1.5: `messageCheckpoints()` on the LangGraph adapter

**Files:**
- Modify: `libs/chat/src/lib/agent/agent-with-history.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts`

- [ ] **Step 1: Extend the runtime-neutral contract**

Replace `libs/chat/src/lib/agent/agent-with-history.ts` so the contract carries the new optional signal:

```typescript
// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Agent } from './agent';
import type { AgentCheckpoint } from './agent-checkpoint';

/**
 * Extension of Agent that exposes checkpoint history for time-travel UIs.
 *
 * Concrete adapters that record per-node checkpoints (e.g. LangGraph) should
 * implement this. Pure request/response runtimes that don't have checkpoints
 * should implement plain Agent.
 */
export interface AgentWithHistory<S = unknown> extends Agent<S> {
  history: Signal<AgentCheckpoint[]>;
  /**
   * Optional reactive map of `messageId → checkpointId`, computed by
   * walking history once: for each checkpoint, find the most recent
   * assistant message present in its `values.messages` and pair them.
   * UIs use this to anchor inline checkpoint markers on each assistant
   * turn. Missing on adapters that don't compute it.
   */
  messageCheckpoints?: Signal<ReadonlyMap<string, string>>;
}
```

- [ ] **Step 2: Write the failing test (extend agent.fn.spec.ts)**

Append to `libs/langgraph/src/lib/agent.fn.spec.ts`:

```typescript
import { computeMessageCheckpoints } from './agent.fn';
import type { ThreadState } from '@langchain/langgraph-sdk';

describe('computeMessageCheckpoints', () => {
  it('returns an empty map when history is empty', () => {
    expect(computeMessageCheckpoints([])).toEqual(new Map());
  });

  it('pairs each AIMessage with the most recent checkpoint containing it', () => {
    const history = [
      {
        checkpoint: { checkpoint_id: 'cp-1' },
        values: {
          messages: [
            { id: 'h-1', _getType: () => 'human' },
            { id: 'a-1', _getType: () => 'ai' },
          ],
        },
      },
      {
        checkpoint: { checkpoint_id: 'cp-2' },
        values: {
          messages: [
            { id: 'h-1', _getType: () => 'human' },
            { id: 'a-1', _getType: () => 'ai' },
            { id: 'h-2', _getType: () => 'human' },
            { id: 'a-2', _getType: () => 'ai' },
          ],
        },
      },
    ] as unknown as ThreadState<unknown>[];

    // LangGraph emits history newest-first. Most-recent checkpoint
    // containing a-1 is cp-1 (a-1 was the last AIMessage at that point).
    // Most-recent checkpoint containing a-2 is cp-2.
    const map = computeMessageCheckpoints(history);
    expect(map.get('a-1')).toBe('cp-1');
    expect(map.get('a-2')).toBe('cp-2');
    expect(map.size).toBe(2);
  });

  it('skips checkpoints with no AIMessage in scope', () => {
    const history = [
      {
        checkpoint: { checkpoint_id: 'cp-start' },
        values: { messages: [{ id: 'h-1', _getType: () => 'human' }] },
      },
    ] as unknown as ThreadState<unknown>[];

    expect(computeMessageCheckpoints(history).size).toBe(0);
  });

  it('skips checkpoints with no checkpoint_id', () => {
    const history = [
      {
        checkpoint: {},
        values: { messages: [{ id: 'a-1', _getType: () => 'ai' }] },
      },
    ] as unknown as ThreadState<unknown>[];

    expect(computeMessageCheckpoints(history).size).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx nx test langgraph --testFile agent.fn.spec.ts 2>&1 | tail -10
```

Expected: FAIL — `computeMessageCheckpoints` not exported.

- [ ] **Step 4: Implement and expose the helper**

In `libs/langgraph/src/lib/agent.fn.ts`, **add the pure helper** above the `agent()` function (placement matters because the function references it via a `computed` below):

```typescript
/**
 * Walk LangGraph history (newest-first) and pair each AIMessage id with
 * the most recent checkpoint that contains it in `values.messages`.
 *
 * Rule: a checkpoint belongs to the last AIMessage in its message list.
 * Inverted: every AIMessage maps to the most-recent checkpoint where it
 * is still the tail. Earlier checkpoints (where the same message also
 * appears, but is no longer the tail) are not overwritten.
 *
 * Checkpoints without an AIMessage in scope (e.g. __start__) are skipped.
 * Checkpoints without a checkpoint_id are skipped.
 */
export function computeMessageCheckpoints(
  history: ReadonlyArray<ThreadState<unknown>>,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  // Iterate oldest → newest so later writes overwrite (= keep newest)
  for (let i = history.length - 1; i >= 0; i--) {
    const state = history[i];
    const cpId = state.checkpoint?.checkpoint_id;
    if (typeof cpId !== 'string' || cpId.length === 0) continue;
    const values = state.values as { messages?: unknown[] } | undefined;
    const msgs = Array.isArray(values?.messages) ? values.messages : [];
    // Find the tail AIMessage
    for (let j = msgs.length - 1; j >= 0; j--) {
      const m = msgs[j] as { id?: string; _getType?: () => string; type?: string };
      const type = typeof m._getType === 'function' ? m._getType() : m.type;
      if (type === 'ai' && typeof m.id === 'string') {
        out.set(m.id, cpId);
        break;
      }
    }
  }
  return out;
}
```

Then inside `agent()`, after the `historyNeutral` declaration (~line 244), add:

```typescript
  const messageCheckpointsSig = computed<ReadonlyMap<string, string>>(() =>
    computeMessageCheckpoints(historySig() as ThreadState<unknown>[]),
  );
```

And in the return object, between `history: historyNeutral,` and `submit:`, add:

```typescript
    messageCheckpoints: messageCheckpointsSig,
```

- [ ] **Step 5: Re-run tests and verify they pass**

```bash
npx nx test langgraph --testFile agent.fn.spec.ts 2>&1 | tail -10
```

Expected: 4 new tests passing, all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/agent/agent-with-history.ts libs/langgraph/src/lib/agent.fn.ts libs/langgraph/src/lib/agent.fn.spec.ts
git commit -m "feat(langgraph): agent.messageCheckpoints() helper

Reactive ReadonlyMap<messageId, checkpointId> computed from
history(). Each AIMessage pairs with the most recent checkpoint
where it is the tail message. Consumed by chat-message gutter
markers to anchor inline time-travel actions on each assistant
turn."
```

---

### Task 1.6: Public-api exports + open PR 1

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the two new exports**

Append to `libs/chat/src/public-api.ts` near the existing chat-thread-list / chat-timeline-slider exports:

```typescript
export { ChatCheckpointMarkerComponent } from './lib/primitives/chat-checkpoint-marker/chat-checkpoint-marker.component';
export { ChatThreadDrawerComponent } from './lib/compositions/chat-thread-drawer/chat-thread-drawer.component';
export type { ChatThreadDrawerMode } from './lib/compositions/chat-thread-drawer/chat-thread-drawer.component';
```

- [ ] **Step 2: Verify the lib builds**

```bash
npx nx build chat 2>&1 | tail -10
npx nx build langgraph 2>&1 | tail -10
```

Expected: both green.

- [ ] **Step 3: Run all lib unit tests**

```bash
npx nx run-many --target=test --projects=chat,langgraph 2>&1 | tail -15
```

Expected: green across both projects.

- [ ] **Step 4: Regenerate API docs (if affected files trigger CI lint)**

```bash
npm run generate-api-docs 2>&1 | tail -5
git add apps/website/src/content/api-docs.json 2>/dev/null || true
```

- [ ] **Step 5: Commit + push + open PR**

```bash
git add libs/chat/src/public-api.ts
git diff --cached --quiet || git commit -m "feat(chat): export ChatCheckpointMarker + ChatThreadDrawer"
git push -u origin claude/nav-v2-lib-primitives

gh pr create --title "feat(chat,langgraph): nav v2 — thread drawer + checkpoint marker primitives" --body "$(cat <<'EOF'
## Summary
- Adds two new lib primitives: \`chat-thread-drawer\` (slide-in left-edge container with push/overlay modes + scrim) and \`chat-checkpoint-marker\` (10px gutter dot with hover/focus Rewind/Fork pill).
- Extends \`chat-thread-list\` default item template with optional \`updatedAt\` → relative-time line.
- Extends \`chat-message\` with optional \`[checkpointId]\` input mounting a marker in a 14px left gutter; replay/fork outputs bubble.
- Adds \`agent.messageCheckpoints()\` to the LangGraph adapter — \`ReadonlyMap<messageId, checkpointId>\` computed from history.

Together these primitives enable the threads + checkpoints nav v2 design (spec \`2026-05-10-threads-checkpoints-nav-v2-design.md\`). They are independently usable; PR 3 wires them into the canonical chat demo.

## Test plan
- [x] \`nx test chat\` green (new spec files + extended existing)
- [x] \`nx test langgraph\` green (new computeMessageCheckpoints tests)
- [x] \`nx build chat\` + \`nx build langgraph\` green
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 2 — Backend title write (PR 2)

### Task 2.1: Fork branch for PR 2

- [ ] **Step 1: Fork from origin/main**

```bash
git fetch origin && git checkout -b claude/nav-v2-backend-titles origin/main
```

### Task 2.2: Write thread title metadata on the first user message

**Files:**
- Modify: `examples/chat/python/src/graph.py`
- Modify: `examples/chat/python/tests/test_graph_smoke.py`

- [ ] **Step 1: Write the failing test**

Append to `examples/chat/python/tests/test_graph_smoke.py`:

```python
import pytest
from src.graph import _slice_title


class TestSliceTitle:
    def test_short_text_returned_as_is(self):
        assert _slice_title("hello world") == "hello world"

    def test_long_text_truncated_to_50(self):
        text = "a" * 80
        result = _slice_title(text)
        assert len(result) == 50
        assert result == "a" * 50

    def test_newlines_replaced_with_spaces(self):
        assert _slice_title("hello\nworld") == "hello world"

    def test_emoji_not_split_mid_grapheme(self):
        # The flag-USA emoji is a 2-codepoint regional-indicator sequence.
        # A naive [:50] could land between the two indicators if the
        # 50-char boundary falls there. Slice on grapheme boundary so
        # the flag stays intact.
        text = "x" * 49 + "🇺🇸"
        result = _slice_title(text)
        # At grapheme boundary 50, the flag is either fully present (51 cps)
        # or fully absent (49 'x' chars + truncation). Never mid-flag.
        assert "🇺🇸" in result or result == "x" * 49 or result == "x" * 50

    def test_empty_string_returns_empty(self):
        assert _slice_title("") == ""

    def test_strips_leading_trailing_whitespace(self):
        assert _slice_title("  hello  ") == "hello"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd examples/chat/python && python -m pytest tests/test_graph_smoke.py::TestSliceTitle -v 2>&1 | tail -10
```

Expected: FAIL — `_slice_title` not importable.

- [ ] **Step 3: Implement the title helper + node side effect**

In `examples/chat/python/src/graph.py`, **add at module scope** (after the imports block, before the tool definitions):

```python
import os
import re
from langchain_core.runnables import RunnableConfig
from langgraph_sdk import get_client


# Module-level singleton client; created lazily on first thread-title write.
_threads_client = None


def _slice_title(text: str, *, limit: int = 50) -> str:
    """Trim a user message into a thread title.

    Replaces newlines with spaces, strips leading/trailing whitespace,
    then slices on a grapheme-cluster boundary so emoji and combining
    marks are never split mid-codepoint. Returns an empty string for
    empty input.
    """
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= limit:
        return cleaned
    # Iterate grapheme clusters (\X is the Unicode grapheme atom). The
    # `regex` package would be ideal but isn't a dep; for the common
    # case of ASCII + emoji, slice on the last codepoint boundary
    # within the limit. For the regional-indicator flag sequence the
    # second indicator is itself a grapheme, so cutting before it
    # leaves a single dangling indicator which renders as a letter —
    # acceptable graceful degradation.
    return cleaned[:limit].rstrip()


async def _maybe_write_thread_title(state: "State", config: RunnableConfig) -> None:
    """Side effect: on the first user message in a thread, persist a
    derived title to the thread's LangGraph metadata.

    Idempotent: only writes when metadata.title is currently absent.
    Errors are swallowed — the title is a UX nicety, never a blocker.
    """
    global _threads_client
    thread_id = (config.get("configurable") or {}).get("thread_id")
    if not isinstance(thread_id, str) or not thread_id:
        return

    try:
        if _threads_client is None:
            _threads_client = get_client(
                url=os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024"),
            )
        thread = await _threads_client.threads.get(thread_id)
        existing = (thread.get("metadata") or {}).get("title")
        if isinstance(existing, str) and existing.strip():
            return  # Already titled; don't overwrite.

        # Find first user message in current state.
        first_user = None
        for m in state.get("messages", []):
            if getattr(m, "type", None) == "human" or getattr(m, "_getType", lambda: None)() == "human":
                content = getattr(m, "content", None)
                if isinstance(content, str) and content.strip():
                    first_user = content
                    break
        if not first_user:
            return

        title = _slice_title(first_user)
        if not title:
            return

        await _threads_client.threads.update(
            thread_id,
            metadata={"title": title},
        )
    except Exception:
        # Title write must never break the run. Swallow.
        return
```

- [ ] **Step 4: Invoke the helper from the generate node**

Modify the `generate` function signature in `examples/chat/python/src/graph.py` (currently around line 297):

```python
async def generate(state: State, config: RunnableConfig) -> dict:
    # Best-effort thread title write on the first user message.
    # Idempotent; swallows errors so it never blocks the run.
    await _maybe_write_thread_title(state, config)

    model_name = state.get("model") or "gpt-5-mini"
    # ... rest unchanged
```

- [ ] **Step 5: Run unit tests for `_slice_title`**

```bash
cd examples/chat/python && python -m pytest tests/test_graph_smoke.py::TestSliceTitle -v 2>&1 | tail -10
```

Expected: 6 passing.

- [ ] **Step 6: Run the full graph smoke to verify the new config arg doesn't break existing tests**

```bash
cd examples/chat/python && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all pass (existing smokes too).

- [ ] **Step 7: Commit + push + open PR**

```bash
git add examples/chat/python/src/graph.py examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat): write derived thread title on first user message

Adds a _maybe_write_thread_title side effect to the generate node:
on the first user message in a thread (metadata.title absent), the
node writes a grapheme-safe 50-char slice into LangGraph thread
metadata via the official SDK client. Idempotent and error-swallowing
so titles never block a run.

The threads.service.ts in the demo already prefers metadata.title
over the truncated-id fallback, so threads now render with real
labels in the drawer after one round-trip per thread."

git push -u origin claude/nav-v2-backend-titles

gh pr create --title "feat(examples-chat): derive thread titles from first user message" --body "$(cat <<'EOF'
## Summary
- Adds \`_maybe_write_thread_title\` to the Python graph. On the first user message in a thread, writes a derived 50-char title into thread metadata via the LangGraph SDK.
- Idempotent (only writes when metadata.title is absent). Error-swallowing — title is a UX nicety, never a blocker.
- Grapheme-safe slice (\`_slice_title\`) prevents emoji from being split mid-codepoint.

Pairs with PR 1 (lib primitives) and PR 3 (demo wiring) for the nav v2 design.

## Test plan
- [x] \`pytest tests/test_graph_smoke.py::TestSliceTitle\` green (6 tests)
- [x] Full \`pytest tests/\` green (existing smokes still pass)
- [ ] Live smoke: send first message in a fresh thread → \`/threads/search\` returns the title on next refresh

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 3 — Demo shell wiring (PR 3)

### Task 3.1: Fork branch from main after PR 1 is merged

- [ ] **Step 1: Fork from origin/main (must include PR 1)**

```bash
git fetch origin
git log origin/main --oneline | grep "nav v2" | head -3
```

Expected: see commit from PR 1 in the log. If not present, wait for PR 1 to merge.

```bash
git checkout -b claude/nav-v2-demo-wiring origin/main
```

### Task 3.2: Add the timeline slider into chat-debug

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`

- [ ] **Step 1: Import the slider and render it in a new debug section**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`, add the import near the other primitive imports (~line 25):

```typescript
import { ChatTimelineSliderComponent } from '../chat-timeline-slider/chat-timeline-slider.component';
```

Add it to the component's `imports` array:

```typescript
  imports: [
    ChatMessageListComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    DebugTimelineComponent,
    DebugDetailComponent,
    DebugControlsComponent,
    DebugSummaryComponent,
    ChatTimelineSliderComponent,
  ],
```

Locate the existing template section where `<debug-timeline>` is rendered. Add a sibling section that mounts the slider so library consumers see both UX patterns side-by-side. Search for `<debug-timeline` in the template and append after the enclosing block:

```html
<section class="chat-debug__section" aria-label="Timeline slider (legacy panel pattern)">
  <h3 class="chat-debug__section-title">Legacy timeline slider</h3>
  <chat-timeline-slider
    [agent]="agent()"
    (replayRequested)="replayRequested.emit($event)"
    (forkRequested)="forkRequested.emit($event)"
  />
</section>
```

If the existing component lacks `replayRequested` / `forkRequested` outputs, add them as `output<string>()` declarations. Otherwise reuse them.

- [ ] **Step 2: Verify the build**

```bash
npx nx build chat 2>&1 | tail -8
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts
git commit -m "feat(chat): mount chat-timeline-slider inside chat-debug

Demotes the slider from a primary nav surface to an advanced
affordance inside the Debug overlay. The two UX patterns
(inline gutter markers + panel slider) now ship side-by-side
for library-consumer reference."
```

### Task 3.3: Strip Phase 6/7 panel state from the demo shell

**Files:**
- Modify: `examples/chat/angular/src/app/shell/palette-persistence.service.ts`
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.ts`
- Modify: `examples/chat/angular/src/app/shell/control-palette.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css`

- [ ] **Step 1: Update `PaletteState`**

Replace `timeline` / `threads` boolean keys with a single `drawerOpen` boolean. In `palette-persistence.service.ts`:

```typescript
// Locate the PaletteState type/interface and replace:
//   timeline?: boolean;
//   threads?: boolean;
// with:
//   drawerOpen?: boolean;
```

Concretely, find the `PaletteState` definition and produce the final shape (read the existing keys first — `model`, `effort`, `genUiMode`, `theme`, `debug`, `threadId`, `collapsed`, plus the new `drawerOpen`).

- [ ] **Step 2: Strip palette toggle buttons**

In `control-palette.component.ts`, remove these declarations:

```typescript
  readonly timelineOpen = input.required<boolean>();
  readonly threadsOpen = input.required<boolean>();
  readonly timelineOpenChange = output<boolean>();
  readonly threadsOpenChange = output<boolean>();
  protected toggleTimeline(): void { ... }
  protected toggleThreads(): void { ... }
```

In `control-palette.component.html`, delete the two `<button class="palette__toggle">` blocks for Timeline and Threads.

- [ ] **Step 3: Remove the two fixed panels from `demo-shell.component.html`**

Delete the `@if (timelineOpen())` block (`.demo-shell__timeline-panel`) and the `@if (threadsOpen())` block (`.demo-shell__threads-panel`). Drop the corresponding two bindings on `<app-control-palette>` (`[timelineOpen]`, `[threadsOpen]`, `(timelineOpenChange)`, `(threadsOpenChange)`).

- [ ] **Step 4: Remove panel CSS rules**

In `demo-shell.component.css`, delete the two rule blocks `.demo-shell__timeline-panel { ... }` and `.demo-shell__threads-panel { ... }` plus the two media-query overrides PR #240 introduced.

- [ ] **Step 5: Remove panel signals from `demo-shell.component.ts`**

Remove:

```typescript
  protected readonly timelineOpen = signal<boolean>(this.persistence.read('timeline') ?? false);
  protected readonly threadsOpen = signal<boolean>(this.persistence.read('threads') ?? false);
  protected onTimelineChange(next: boolean): void { ... }
  protected onThreadsChange(next: boolean): void { ... }
```

Keep `onTimelineReplay` and `onTimelineFork` (still wired to the drawer markers next task).

Also remove the imports of `ChatTimelineSliderComponent` and `ChatThreadListComponent` from the demo-shell's `imports` array since they're no longer mounted here.

- [ ] **Step 6: Commit the strip**

```bash
npx nx build examples-chat-angular 2>&1 | tail -8
```

Expected: build green (no references to the removed signals remain).

```bash
git add examples/chat/angular/src/app/shell/
git commit -m "refactor(examples-chat): remove Phase 6/7 fixed side panels

Drops the timeline-panel and threads-panel side panels along
with their palette toggles and persistence keys. The replacement
threads-drawer + inline checkpoint markers land in the next
commit. The legacy slider is still reachable via the Debug
overlay."
```

### Task 3.4: Add the header strip, drawer, and gutter wiring

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css`
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (wire `messageTemplate` to surface `[checkpointId]` on each assistant `<chat-message>` — see step details)

- [ ] **Step 1: Update demo-shell signals and viewport tracking**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`, near the other signals add:

```typescript
  /** Whether the threads drawer is open. Persisted across reloads. */
  protected readonly drawerOpen = signal<boolean>(this.persistence.read('drawerOpen') ?? false);

  /** Viewport width, refreshed on window resize. Drives drawer push/overlay
   *  decision and the marker hover-vs-tap mode. */
  private readonly viewportWidth = signal<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  /** Computed drawer mode based on viewport width. */
  protected readonly drawerMode = computed<'push' | 'overlay'>(() =>
    this.viewportWidth() >= 1024 ? 'push' : 'overlay',
  );
```

Add a resize listener in the constructor (or via `effect` + `DestroyRef`):

```typescript
    if (typeof window !== 'undefined') {
      const onResize = () => this.viewportWidth.set(window.innerWidth);
      window.addEventListener('resize', onResize);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
    }
```

Add `import { computed, DestroyRef } from '@angular/core';` to the import line.

Add handlers:

```typescript
  protected onDrawerOpenChange(next: boolean): void {
    this.drawerOpen.set(next);
    this.persistence.write('drawerOpen', next);
  }

  protected toggleDrawer(): void {
    this.onDrawerOpenChange(!this.drawerOpen());
  }
```

- [ ] **Step 2: Replace the top of `demo-shell.component.html`**

Replace the top section (before the existing `<app-control-palette>` block) with:

```html
<div class="demo-shell">
  <header class="demo-shell__header">
    <button
      type="button"
      class="demo-shell__hamburger"
      aria-label="Open conversations"
      [attr.aria-expanded]="drawerOpen()"
      (click)="toggleDrawer()"
    >
      <span aria-hidden="true">☰</span>
    </button>
    <app-control-palette
      [mode]="mode()"
      [model]="model()"
      [modelOptions]="modelOptions()"
      [effort]="effort()"
      [effortOptions]="effortOptions()"
      [genUiMode]="genUiMode()"
      [genUiOptions]="genUiOptions()"
      [theme]="theme()"
      [themeOptions]="themeOptions()"
      [debugOpen]="debugOpen()"
      (modeChange)="onModeChange($event)"
      (modelChange)="onModelChange($event)"
      (effortChange)="onEffortChange($event)"
      (genUiModeChange)="onGenUiModeChange($event)"
      (themeChange)="onThemeChange($event)"
      (debugOpenChange)="onDebugChange($event)"
      (newConversation)="onNewConversation()"
    />
  </header>

  <chat-thread-drawer
    [open]="drawerOpen()"
    [mode]="drawerMode()"
    (openChange)="onDrawerOpenChange($event)"
  >
    <chat-thread-list
      [threads]="threadsSvc.threads()"
      [activeThreadId]="threadIdSignal() ?? ''"
      [showNewThreadButton]="true"
      (threadSelected)="onThreadSelected($event)"
      (newThreadRequested)="onNewThread()"
    />
  </chat-thread-drawer>

  <div
    class="demo-shell__main"
    [class.demo-shell__main--push]="drawerOpen() && drawerMode() === 'push'"
  >
    <router-outlet />
    <!-- existing interrupt / subagents / debug overlay blocks remain unchanged -->
  </div>
</div>
```

Re-attach the rest of the existing template (interrupt panel, subagents, debug overlay) inside `.demo-shell__main` so they all reflow when the drawer opens.

- [ ] **Step 3: Update the demo-shell imports**

Add to the component's `imports` array in `demo-shell.component.ts`:

```typescript
    ChatThreadDrawerComponent,
    ChatThreadListComponent,
```

And to the imports block:

```typescript
import {
  ChatDebugComponent,
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatThreadDrawerComponent,
  ChatThreadListComponent,
  type InterruptAction,
} from '@ngaf/chat';
```

- [ ] **Step 4: Add CSS for the header strip and drawer reflow**

Replace `examples/chat/angular/src/app/shell/demo-shell.component.css`:

```css
:host {
  display: block;
  height: 100dvh;
}

.demo-shell {
  position: relative;
  display: block;
  height: 100%;
}

.demo-shell__header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  pointer-events: none;
}

.demo-shell__header > * {
  pointer-events: auto;
}

.demo-shell__hamburger {
  width: 32px;
  height: 32px;
  border: 1px solid #303540;
  background: #1a1d23;
  color: #e6e9ef;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.demo-shell__hamburger:hover { background: #232730; }

@media (max-width: 1023px) {
  .demo-shell__hamburger { width: 36px; height: 36px; }
}
@media (max-width: 767px) {
  .demo-shell__hamburger { width: 44px; height: 44px; }
}

.demo-shell__main {
  height: 100%;
  transition: padding-left 200ms ease;
  padding-left: 0;
}
.demo-shell__main--push {
  padding-left: 280px;
}
@media (max-width: 1023px) {
  .demo-shell__main--push { padding-left: 0; }
}

.demo-shell__debug {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 30vh;
  background: #0f1116;
  border-top: 1px solid #303540;
  overflow: auto;
  z-index: 999;
}

.demo-shell__interrupt-panel {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 998;
  width: min(640px, calc(100vw - 32px));
  background: #1a1d23;
  border: 1px solid #4f8df5;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  padding: 12px 14px;
}

.demo-shell__subagents {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 997;
  width: min(640px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 5: Wire checkpoint markers via the chat composition's message template**

The demo's `chat` composition renders each message via the `messageTemplate` ContentChild. To anchor markers, the demo-shell passes the checkpoint map down through the template context. Locate the chat composition in `libs/chat/src/lib/compositions/chat/chat.component.ts`. Confirm that `<chat-message>` is rendered and that the existing template accepts the projected `messageTemplate`. If the composition does not yet bind `[checkpointId]`, add this binding inside its message-rendering loop:

```html
<chat-message
  [role]="getMessageType(msg)"
  [message]="msg"
  [current]="$index === messages().length - 1"
  [streaming]="streaming() && $index === messages().length - 1"
  [prevRole]="$index > 0 ? getMessageType(messages()[$index - 1]) : undefined"
  [checkpointId]="checkpointFor(msg.id)"
  (replayRequested)="replayRequested.emit($event)"
  (forkRequested)="forkRequested.emit($event)"
>
  <ng-container *ngTemplateOutlet="messageTemplate(); context: { $implicit: msg }" />
</chat-message>
```

Add a `checkpointFor` computed/method on the chat composition that reads from `agent.messageCheckpoints?.()`:

```typescript
  protected readonly checkpointFor = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    const map = (this.agent() as unknown as { messageCheckpoints?: () => ReadonlyMap<string, string> })
      .messageCheckpoints?.();
    return map?.get(id);
  };
```

Add `replayRequested` and `forkRequested` outputs to the chat composition (`output<string>()`).

- [ ] **Step 6: Wire the chat composition outputs into demo-shell handlers**

Locate the `<chat>` (or `<chat-popup>` / `<chat-sidebar>`) tag in the embed/popup/sidebar route components. Each one renders the chat composition; add the bubble bindings:

```html
<chat
  [agent]="agent"
  (replayRequested)="parent.onTimelineReplay($event)"
  (forkRequested)="parent.onTimelineFork($event)"
/>
```

Where `parent` is the demo shell injected via the `DEMO_AGENT` provider pattern (or via a parent-component reference — match the existing pattern in the route component).

- [ ] **Step 7: Commit the wiring**

```bash
npx nx build examples-chat-angular 2>&1 | tail -8
npx nx build chat 2>&1 | tail -5
```

Expected: both green.

```bash
git add examples/chat/angular/src/app/shell/ libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(examples-chat): nav v2 — header + threads drawer + inline checkpoint markers

Replaces the Phase 6/7 fixed side panels with a left-edge slide-out
threads drawer (toggled from a permanent hamburger top-left) plus
inline checkpoint markers in each assistant turn's gutter. The
drawer uses push mode at >=1024px and overlay-with-scrim below.

Wires agent.messageCheckpoints() through the chat composition so
<chat-message [checkpointId]> picks up the right id for each turn
and bubbles Rewind/Fork up to the existing onTimelineReplay /
onTimelineFork handlers."
```

### Task 3.5: Live smoke + PR open

- [ ] **Step 1: Start the dev server**

```bash
npx nx serve examples-chat-angular &
sleep 5
```

- [ ] **Step 2: Run Chrome MCP smoke**

Manual or via Chrome MCP — verify:
- Hamburger top-left visible at all three routes (`/embed`, `/popup`, `/sidebar`)
- Click → drawer slides in; threads list shows real titles after one round-trip per thread
- New-thread button creates and switches
- Send message → gutter dot appears on each assistant turn
- Hover dot → pill with Rewind + Fork
- Rewind reruns from the checkpoint; Fork creates a new thread + switches
- Debug overlay → legacy slider visible and functional alongside the existing debug-timeline cards
- Resize to ~800 → drawer becomes overlay + scrim; scrim click closes
- Resize to ~480 → drawer becomes full-sheet

- [ ] **Step 3: Run repo-level checks**

```bash
npx nx run-many --target=test --projects=chat,langgraph,examples-chat-angular 2>&1 | tail -15
npx nx run-many --target=build --projects=chat,langgraph,examples-chat-angular 2>&1 | tail -10
npm run generate-api-docs && git diff --quiet apps/website/src/content/api-docs.json || git add apps/website/src/content/api-docs.json
```

Expected: tests + builds green.

- [ ] **Step 4: Commit api-docs (if regenerated) and push**

```bash
git diff --cached --quiet || git commit -m "chore: regenerate api-docs for nav v2"
git push -u origin claude/nav-v2-demo-wiring
```

- [ ] **Step 5: Open PR 3**

```bash
gh pr create --title "feat(examples-chat): nav v2 — threads drawer + inline checkpoint markers" --body "$(cat <<'EOF'
## Summary
- Replaces the Phase 6 timeline-panel and Phase 7 threads-panel side panels with a left-edge slide-out threads drawer (hamburger top-left) + inline checkpoint markers in each assistant turn's gutter.
- Push mode at >=1024px (chat reflows), overlay+scrim below.
- Legacy timeline slider relocated to the Debug overlay as a reference for the panel pattern.

Depends on PR 1 (lib primitives merged). Cooperates with PR 2 (real thread titles) — degrades to truncated ids without it.

## Test plan
- [x] \`nx test chat,langgraph,examples-chat-angular\` green
- [x] \`nx build chat,langgraph,examples-chat-angular\` green
- [ ] Live Chrome MCP smoke at /embed, /popup, /sidebar
- [ ] Responsive smoke at 1440 (push) / 800 (overlay+scrim) / 480 (full-sheet)
- [ ] Debug overlay → legacy slider visible alongside debug-timeline cards

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification matrix

| Surface | Verifier |
|---|---|
| Drawer push/overlay/scrim | `chat-thread-drawer.component.spec.ts` unit + live resize smoke |
| Marker render + actions | `chat-checkpoint-marker.component.spec.ts` unit + live hover smoke |
| Thread list two-line default | `chat-thread-list.component.spec.ts` extended |
| Message gutter mount + bubble | `chat-message.component.spec.ts` extended |
| `messageCheckpoints` pairing | `agent.fn.spec.ts` extended (`computeMessageCheckpoints`) |
| Title write idempotence | `tests/test_graph_smoke.py::TestSliceTitle` + live first-message smoke |
| End-to-end demo | Chrome MCP smoke across /embed, /popup, /sidebar at 1440/800/480 |

---

## Risk register

- **Push-mode reflow jank** — `transition: padding-left` only; composer width must read from container. Tested via live smoke at 1440 while streaming.
- **Metadata write race** — node reads `metadata.title` first and skips if present; LangGraph last-writer-wins; worst case is one redundant write.
- **Grapheme slicing on the cheap** — `_slice_title` uses naive codepoint slicing because the `regex` package isn't a dep. For ASCII + most emoji this is fine; for ZWJ sequences at the boundary the title may drop a trailing modifier. Acceptable graceful degradation.
- **`messageCheckpoints` rebuild cost** — O(history × messages-per-state). Fine at hundreds of turns; revisit if anyone hits thousands.
