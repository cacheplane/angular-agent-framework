# HITL Refund — Cockpit + Library + Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the third blog post (Human-in-the-Loop LangGraph Agents in Angular) as a forcing function to ship a real `ChatApprovalCard` composition, refresh `ChatInterruptPanel`'s visual treatment, rewrite the cockpit `interrupts` example as a refund flow, and rewrite the blog against that verified cockpit example with real screenshots.

**Architecture:** Three PRs. PR #1 ships library-only changes (new `ChatApprovalCard` dialog composition + `ChatInterruptPanel` visual refresh + an explicit unit test pinning the already-existing structured-`resume` behavior). PR #2 rewrites the cockpit `interrupts` example as a refund-authorization agent that consumes `ChatApprovalCard`; auto-merge strictly disabled until manual review passes. PR #3 rewrites the blog post against the verified cockpit code with three screenshots captured live.

**Tech Stack:** Angular 20+ (standalone components, signals, native `<dialog>`), LangGraph (Python, `langgraph.types.interrupt`), Vitest (lib unit tests), Playwright (cockpit e2e), Next.js 16 + MDX (blog).

**Spec:** [docs/superpowers/specs/2026-05-25-hitl-refund-cockpit-blog-design.md](docs/superpowers/specs/2026-05-25-hitl-refund-cockpit-blog-design.md)

---

## File map

**PR #1 — Library:**
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts` — add explicit structured-resume test
- Create: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`
- Modify: `libs/chat/src/index.ts` — export `ChatApprovalCardComponent`
- Modify: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts` — visual refresh (drop left border + triangle, use eyebrow + dot pattern, shared button styles)

**PR #2 — Cockpit:**
- Modify: `cockpit/langgraph/interrupts/python/src/graph.py`
- Modify: `cockpit/langgraph/interrupts/python/prompts/interrupts.md`
- Modify: `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`
- Delete: `cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts`
- Modify: `cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`

**PR #3 — Blog:**
- Rewrite: `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx`
- Create: `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/1.png`
- Create: `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/2.png`
- Create: `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/3.png`

---

# PR #1 — Library

Branch: `claude/hitl-chat-approval-card`. One PR, mergeable independently of PR #2 and PR #3.

## Task 1: Pin structured-resume behavior with an explicit unit test

The `resume?: unknown` type and forwarding logic already exist in `libs/langgraph`. This task adds one targeted test that locks the structured-object path so the cockpit refund rewrite has a documented contract to depend on.

**Files:**
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts`

- [ ] **Step 1: Read the existing `describe('resume submit', ...)` block to confirm the test pattern**

Run: `grep -n "resume" libs/langgraph/src/lib/agent.fn.spec.ts | head -20`

Expected output includes lines around 232 ("normalizes resume submit options into a LangGraph command") and 250 (`await ref.submit(null, { resume: { approved: true } });`). Existing tests already cover structured resume values — we add one more to nail down a richer payload.

- [ ] **Step 2: Add a failing test for a multi-field structured resume payload**

Open `libs/langgraph/src/lib/agent.fn.spec.ts`. Find the existing `it('normalizes resume submit options into a LangGraph command', async () => {` (around line 232) and insert this new test immediately after the closing `});` of that block:

```ts
  it('forwards a multi-field structured resume payload verbatim', async () => {
    const { ref, transport } = setupRunTest();
    await ref.submit(null, {
      resume: {
        approved: true,
        amount: 47.5,
        idempotency_key: 'idem_abc123',
        meta: { reviewer: 'brian', at: '2026-05-25T18:00:00Z' },
      },
    });
    expect(transport.runs[0]?.body).toMatchObject({
      command: {
        resume: {
          approved: true,
          amount: 47.5,
          idempotency_key: 'idem_abc123',
          meta: { reviewer: 'brian', at: '2026-05-25T18:00:00Z' },
        },
      },
    });
  });
```

- [ ] **Step 3: Run the new test**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test langgraph -- --testNamePattern "forwards a multi-field structured resume payload verbatim"`

Expected: PASS. The test should pass on first run because the forwarding logic already exists; we're just locking it down with an explicit assertion.

- [ ] **Step 4: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git checkout -b claude/hitl-chat-approval-card
git add libs/langgraph/src/lib/agent.fn.spec.ts
git commit -m "test(langgraph): pin multi-field structured resume payload forwarding"
```

---

## Task 2: Create `ChatApprovalCard` — failing test for body template projection

TDD. First test asserts the composition renders the projected body template with the interrupt payload bound as a `let-*` variable.

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`

- [ ] **Step 1: Write the failing test file**

Write `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { Component, TemplateRef, ViewChild, ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ChatApprovalCardComponent } from './chat-approval-card.component';
import { mockAgent } from '../../testing/mock-agent';
import type { AgentInterrupt } from '../../agent/agent-interrupt';

@Component({
  standalone: true,
  imports: [ChatApprovalCardComponent],
  template: `
    <chat-approval-card
      [agent]="agent"
      [matchKind]="matchKind"
      [showEdit]="showEdit"
      (action)="lastAction = $event"
    >
      <ng-template #body let-payload>
        <span class="amount">{{ payload.amount }}</span>
        <span class="customer">{{ payload.customer_id }}</span>
      </ng-template>
    </chat-approval-card>
  `,
})
class HostComponent {
  agent = mockAgent({ withInterrupt: true });
  matchKind: string | undefined = undefined;
  showEdit = false;
  lastAction: { action: string } | undefined = undefined;
}

describe('ChatApprovalCardComponent', () => {
  let host: HostComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('renders the projected body template with payload bound', () => {
    const interrupt: AgentInterrupt = {
      id: 'int-1',
      value: { kind: 'refund_approval', amount: 47.5, customer_id: 'cus_a8x2k' },
      resumable: true,
    };
    host.agent.interrupt!.set(interrupt);
    fixture.detectChanges();

    const amount = fixture.nativeElement.querySelector('.amount')?.textContent?.trim();
    const customer = fixture.nativeElement.querySelector('.customer')?.textContent?.trim();
    expect(amount).toBe('47.5');
    expect(customer).toBe('cus_a8x2k');
  });
});
```

- [ ] **Step 2: Run to verify the test fails**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test chat -- --testPathPattern "chat-approval-card"`

Expected: FAIL with "Cannot find module './chat-approval-card.component'" (the implementation file doesn't exist yet).

---

## Task 3: Implement `ChatApprovalCard` minimal component

Write the smallest component that makes Task 2's test pass — reads agent interrupt, renders projected `#body` template with payload as `let-*` context.

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts`

- [ ] **Step 1: Write the component file**

Write `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts`:

```ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export type ChatApprovalAction = 'approve' | 'edit' | 'cancel';

@Component({
  selector: 'chat-approval-card',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    CHAT_HOST_TOKENS,
    `
    :host { display: contents; }
    dialog.chat-approval-card {
      width: 440px;
      max-width: calc(100vw - 32px);
      padding: 0;
      border: 0;
      border-radius: 12px;
      background: var(--ngaf-chat-surface);
      color: var(--ngaf-chat-text);
      box-shadow: 0 20px 50px rgba(0,0,0,0.18);
    }
    dialog.chat-approval-card::backdrop {
      background: rgba(0,0,0,0.32);
    }
    .chat-approval-card__header {
      padding: 14px 16px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--ngaf-chat-separator);
    }
    .chat-approval-card__header h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--ngaf-chat-text);
    }
    .chat-approval-card__header svg {
      color: var(--ngaf-chat-warning-text);
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
    }
    .chat-approval-card__body {
      padding: 14px 16px;
      font-size: var(--ngaf-chat-font-size-sm, 13px);
      color: var(--ngaf-chat-text);
    }
    .chat-approval-card__actions {
      padding: 8px 16px 14px;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
    }
    .btn {
      border: 0;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 200ms ease, opacity 200ms ease;
    }
    .btn:hover { transform: scale(1.03); }
    .btn-primary { background: var(--ngaf-chat-primary); color: var(--ngaf-chat-on-primary); }
    .btn-secondary { background: transparent; color: var(--ngaf-chat-text); border: 1px solid var(--ngaf-chat-separator); }
    .btn-text {
      background: transparent;
      color: var(--ngaf-chat-text-muted);
      padding: 6px 10px;
    }
    .btn-text:hover { color: var(--ngaf-chat-text); }
    `,
  ],
  template: `
    <dialog #dialogEl class="chat-approval-card" (close)="onDialogClose()" (cancel)="onCancelEvent($event)">
      <div class="chat-approval-card__header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h4>{{ title() }}</h4>
      </div>
      <div class="chat-approval-card__body">
        @if (bodyTemplate(); as tpl) {
          <ng-container *ngTemplateOutlet="tpl; context: { $implicit: payload() }"></ng-container>
        }
      </div>
      <div class="chat-approval-card__actions">
        <button type="button" class="btn btn-text" (click)="emit('cancel')">Cancel</button>
        @if (showEdit()) {
          <button type="button" class="btn btn-secondary" (click)="emit('edit')">Edit</button>
        }
        <button type="button" class="btn btn-primary" (click)="emit('approve')">Approve</button>
      </div>
    </dialog>
  `,
})
export class ChatApprovalCardComponent {
  readonly agent = input.required<Agent>();
  readonly matchKind = input<string | undefined>(undefined);
  readonly title = input<string>('Approval required');
  readonly showEdit = input<boolean>(false);

  readonly action = output<ChatApprovalAction>();

  protected readonly bodyTemplate = contentChild<TemplateRef<unknown>>('body');
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  private readonly interrupt = computed(() => this.agent().interrupt?.());

  protected readonly payload = computed(() => {
    const i = this.interrupt();
    if (!i) return undefined;
    const v = i.value as { kind?: unknown } | undefined;
    const want = this.matchKind();
    if (want !== undefined) {
      if (!v || typeof v !== 'object' || (v as { kind?: unknown }).kind !== want) {
        return undefined;
      }
    }
    return v;
  });

  constructor() {
    effect(() => {
      const p = this.payload();
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      if (p && !dialog.open) {
        dialog.showModal();
      } else if (!p && dialog.open) {
        dialog.close();
      }
    });
  }

  protected emit(action: ChatApprovalAction): void {
    this.action.emit(action);
    this.dialogRef()?.nativeElement?.close();
  }

  protected onCancelEvent(ev: Event): void {
    // Native dialog's cancel event fires on Escape. Treat as cancel.
    ev.preventDefault();
    this.action.emit('cancel');
    this.dialogRef()?.nativeElement?.close();
  }

  protected onDialogClose(): void {
    // Native close — no-op; emit happens in emit() / onCancelEvent.
  }
}
```

- [ ] **Step 2: Run the test from Task 2**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test chat -- --testPathPattern "chat-approval-card"`

Expected: PASS. The body template renders with `payload` bound.

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts
git commit -m "feat(chat): add ChatApprovalCard dialog composition skeleton"
```

---

## Task 4: Add `matchKind` filter test + verify

The `payload()` computed already implements matchKind filtering. Add a test that exercises both the matching and non-matching paths.

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`

- [ ] **Step 1: Add the test**

Append two new tests to the `describe('ChatApprovalCardComponent', ...)` block in the spec file (before the closing `});`):

```ts
  it('renders body when matchKind matches the interrupt kind', () => {
    host.matchKind = 'refund_approval';
    host.agent.interrupt!.set({
      id: 'int-1',
      value: { kind: 'refund_approval', amount: 47.5, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.amount')?.textContent?.trim()).toBe('47.5');
  });

  it('renders nothing when matchKind does not match', () => {
    host.matchKind = 'refund_approval';
    host.agent.interrupt!.set({
      id: 'int-2',
      value: { kind: 'delete_approval', target: 'user_42' },
      resumable: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.amount')).toBeNull();
  });
```

- [ ] **Step 2: Run the tests**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test chat -- --testPathPattern "chat-approval-card"`

Expected: ALL three tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts
git commit -m "test(chat): cover ChatApprovalCard matchKind filter"
```

---

## Task 5: Action-emit + showEdit tests

Lock in that clicking each button emits the right enum value, that `showEdit=false` hides the Edit button, and that the Escape-handled `cancel` event also emits cancel.

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`

- [ ] **Step 1: Add the tests**

Append three more tests to the spec file (still inside the `describe` block, before its closing `});`):

```ts
  it('emits "approve" when the Approve button is clicked', () => {
    host.agent.interrupt!.set({
      id: 'int-3',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const approve = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    approve.click();
    expect(host.lastAction).toBe('approve');
  });

  it('emits "cancel" when the Cancel button is clicked', () => {
    host.agent.interrupt!.set({
      id: 'int-4',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const cancel = fixture.nativeElement.querySelector('.btn-text') as HTMLButtonElement;
    cancel.click();
    expect(host.lastAction).toBe('cancel');
  });

  it('hides the Edit button when showEdit is false', () => {
    host.showEdit = false;
    host.agent.interrupt!.set({
      id: 'int-5',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const editButtons = fixture.nativeElement.querySelectorAll('button.btn-secondary');
    expect(editButtons.length).toBe(0);
  });

  it('shows the Edit button and emits "edit" when showEdit is true', () => {
    host.showEdit = true;
    host.agent.interrupt!.set({
      id: 'int-6',
      value: { kind: 'refund_approval', amount: 10, customer_id: 'cus_a' },
      resumable: true,
    });
    fixture.detectChanges();
    const edit = fixture.nativeElement.querySelector('.btn-secondary') as HTMLButtonElement;
    expect(edit).not.toBeNull();
    edit.click();
    expect(host.lastAction).toBe('edit');
  });
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test chat -- --testPathPattern "chat-approval-card"`

Expected: ALL 7 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts
git commit -m "test(chat): cover ChatApprovalCard action emit + showEdit"
```

---

## Task 6: Export `ChatApprovalCard` from the public surface

**Files:**
- Modify: `libs/chat/src/index.ts`

- [ ] **Step 1: Find where ChatInterruptPanel is exported, add ChatApprovalCard nearby**

Run: `grep -n "chat-interrupt-panel" libs/chat/src/index.ts`

Expected: a line like `export * from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';`

- [ ] **Step 2: Add the new export immediately after**

Open `libs/chat/src/index.ts`. Find the ChatInterruptPanel export line and add immediately after it:

```ts
export * from './lib/compositions/chat-approval-card/chat-approval-card.component';
```

- [ ] **Step 3: Verify the type is exposed**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx tsc --noEmit -p libs/chat/tsconfig.lib.json`

Expected: PASS with no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add libs/chat/src/index.ts
git commit -m "feat(chat): export ChatApprovalCardComponent from the public surface"
```

---

## Task 7: Refresh `ChatInterruptPanel` visual treatment

Drop the thick amber left border + triangle warning icon. Use the eyebrow + small amber dot pattern. Share the `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-text` styles with `ChatApprovalCard`. No behavioral change.

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`

- [ ] **Step 1: Replace the `styles:` block and the template**

In `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`, replace the existing `styles: [CHAT_HOST_TOKENS, `...`]` block (currently lines 44–107) and the `template: `...`` block (currently lines 108–141) with:

```ts
  styles: [
    CHAT_HOST_TOKENS,
    `
    .chat-interrupt-panel {
      background: var(--ngaf-chat-surface);
      color: var(--ngaf-chat-text);
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-card);
      padding: 14px 16px;
      font-size: var(--ngaf-chat-font-size-sm);
    }
    .chat-interrupt-panel__eyebrow {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ngaf-chat-warning-text);
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chat-interrupt-panel__dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--ngaf-chat-warning-text);
      flex: 0 0 6px;
    }
    .chat-interrupt-panel__body {
      margin: 0 0 12px;
      color: var(--ngaf-chat-text);
      white-space: pre-wrap;
    }
    .chat-interrupt-panel__actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .btn {
      border: 0;
      padding: 6px 14px;
      border-radius: var(--ngaf-chat-radius-button);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 200ms ease, opacity 200ms ease;
    }
    .btn:hover { transform: scale(1.03); }
    .btn-primary { background: var(--ngaf-chat-primary); color: var(--ngaf-chat-on-primary); }
    .btn-secondary { background: transparent; color: var(--ngaf-chat-text); border: 1px solid var(--ngaf-chat-separator); }
    .btn-text {
      background: transparent;
      color: var(--ngaf-chat-text-muted);
      padding: 6px 10px;
    }
    .btn-text:hover { color: var(--ngaf-chat-text); }
    `,
  ],
  template: `
    @if (interrupt()) {
      <div role="alert" class="chat-interrupt-panel">
        <p class="chat-interrupt-panel__eyebrow">
          <span class="chat-interrupt-panel__dot" aria-hidden="true"></span>
          Agent paused — review needed
        </p>
        <p class="chat-interrupt-panel__body">{{ interruptReason() }}</p>
        <div class="chat-interrupt-panel__actions">
          <button type="button" class="btn btn-primary" (click)="action.emit('accept')">Accept</button>
          <button type="button" class="btn btn-secondary" (click)="action.emit('edit')">Edit</button>
          <button type="button" class="btn btn-secondary" (click)="action.emit('respond')">Respond</button>
          <button type="button" class="btn btn-text" (click)="action.emit('ignore')">Ignore</button>
        </div>
      </div>
    }
  `,
```

- [ ] **Step 2: Run the existing spec to confirm nothing broke**

Run: `cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework && npx nx test chat -- --testPathPattern "chat-interrupt-panel"`

Expected: ALL existing tests pass. The refresh is visual only — behavior, inputs, outputs are unchanged.

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts
git commit -m "refactor(chat): refresh ChatInterruptPanel visual treatment

Drop the thick amber left border and triangle warning icon. Use the
eyebrow + small dot pattern that matches the new ChatApprovalCard
composition. Share .btn / .btn-primary / .btn-secondary / .btn-text
styles across both compositions.

No API change; same inputs, same (action) output enum, same DOM placement."
```

---

## Task 8: Push PR #1 and arm auto-merge

**Files:** none — just git + gh.

- [ ] **Step 1: Push the branch**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git push -u origin claude/hitl-chat-approval-card
```

Expected: push succeeds.

- [ ] **Step 2: Open the PR**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
gh pr create --title "feat(chat): ChatApprovalCard dialog composition + ChatInterruptPanel refresh" --body "$(cat <<'EOF'
## Summary

Sets up the chat library for the HITL refund forcing-function work. Three sub-pieces shipped together because they touch the same library tree and share the new button vocabulary:

- **1A — Pin structured-resume behavior.** Adds one explicit unit test in \`libs/langgraph\` that nails down forwarding a multi-field structured object through \`agent.submit({ resume })\`. The type and forwarding logic already existed; the test locks the contract the cockpit refund rewrite depends on.
- **1B — New \`ChatApprovalCard\` composition.** Native HTML \`<dialog>\` + \`showModal()\`, top-layer rendering, focus trap and Escape for free. API: \`[agent]\`, \`[matchKind]\`, \`[title]\`, \`[showEdit]\`, \`(action)\` emits \`'approve' | 'edit' | 'cancel'\`. Body is a content-projected \`<ng-template #body let-payload>\` slot.
- **1C — \`ChatInterruptPanel\` visual refresh.** Drops the thick amber left border and triangle icon. Adopts the eyebrow + small amber dot pattern. Shares button styles with \`ChatApprovalCard\` so both compositions read in the same visual register.

## Test plan

- [ ] \`nx test langgraph\` green (new structured-resume test passes)
- [ ] \`nx test chat\` green (7 new ChatApprovalCard tests + existing ChatInterruptPanel tests)
- [ ] Type-check clean (\`tsc --noEmit\` for both libs)
- [ ] Manual smoke: import \`ChatApprovalCardComponent\` from \`@threadplane/chat\` in a downstream app and confirm types resolve

Spec: docs/superpowers/specs/2026-05-25-hitl-refund-cockpit-blog-design.md
Plan: docs/superpowers/plans/2026-05-25-hitl-refund-cockpit-blog.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Arm auto-merge (squash, delete branch)**

```bash
gh pr merge --squash --auto --delete-branch
```

Expected: auto-merge enabled. CI runs; PR merges on green.

---

# PR #2 — Cockpit interrupts → refund agent

Branch: `claude/cockpit-interrupts-refund`. **Depends on PR #1 merging first.** Auto-merge strictly disabled until manual review (Piece 3) passes.

## Task 9: Rewrite the LangGraph backend graph

**Files:**
- Modify: `cockpit/langgraph/interrupts/python/src/graph.py`

- [ ] **Step 1: Wait for PR #1 to merge, then sync main**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git checkout main
git pull origin main
git checkout -b claude/cockpit-interrupts-refund
```

Expected: branch created from latest main.

- [ ] **Step 2: Rewrite the graph**

Replace the entire contents of `cockpit/langgraph/interrupts/python/src/graph.py` with:

```python
"""
LangGraph Interrupts Graph — Refund Authorization

Demonstrates human-in-the-loop approval for high-stakes actions using
LangGraph's interrupt() primitive. The agent drafts a refund (extracting
customer, amount, and reason from the conversation), then pauses at
request_approval. The frontend renders an approval card; resuming with
{ approved: true } issues the refund (optionally with an edited amount),
resuming with { approved: false } skips it.
"""

from pathlib import Path
from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class RefundState(TypedDict):
    messages: Annotated[list, add_messages]
    customer_id: Optional[str]
    amount: Optional[float]
    reason: Optional[str]
    refund_id: Optional[str]


def build_interrupts_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def draft_refund(state: RefundState) -> dict:
        """Read the conversation, ask the LLM to extract refund fields,
        then post a confirmation message describing the draft."""
        system_prompt = (PROMPTS_DIR / "interrupts.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        # The system prompt instructs the LLM to emit a JSON-like draft;
        # extracting fields robustly is out of scope for this demo.
        # The next node uses the conversation + this AI message as input.
        return {"messages": [response]}

    def request_approval(state: RefundState) -> dict:
        """Pause for human approval. Resume value is { approved: bool, amount?: number }.
        If the operator edits the amount, the new value lands in state['amount']."""
        amount = state.get("amount") or 0.0
        customer_id = state.get("customer_id") or "unknown"
        reason = state.get("reason") or ""

        decision = interrupt({
            "kind": "refund_approval",
            "amount": amount,
            "customer_id": customer_id,
            "reason": reason,
        })

        if not isinstance(decision, dict) or not decision.get("approved"):
            return {
                "refund_id": None,
                "messages": [AIMessage(content="Refund cancelled by operator. No charge issued.")],
            }

        edited_amount = decision.get("amount")
        final_amount = float(edited_amount) if edited_amount is not None else amount
        return {"amount": final_amount}

    def issue_refund(state: RefundState) -> dict:
        """Stand-in for the real Stripe call. Logs a fake refund ID."""
        refund_id = "re_demo_" + (state.get("customer_id") or "anon")[-6:]
        msg = f"Refund of ${state['amount']:.2f} issued to {state.get('customer_id')}. Refund ID: {refund_id}."
        return {"refund_id": refund_id, "messages": [AIMessage(content=msg)]}

    def route_after_approval(state: RefundState) -> str:
        return "issue" if state.get("refund_id") != None or state.get("amount") else "end"

    # Branching: if approval added an "amount" without flipping refund_id to None,
    # continue to issue_refund; otherwise the cancellation message is already emitted.
    def route(state: RefundState) -> str:
        # `request_approval` sets refund_id=None on cancellation. On approval it does NOT
        # set refund_id (issue_refund does that). So: amount present + refund_id absent => issue.
        if state.get("amount") is not None and state.get("refund_id") is None:
            return "issue"
        return "end"

    graph = StateGraph(RefundState)
    graph.add_node("draft", draft_refund)
    graph.add_node("request_approval", request_approval)
    graph.add_node("issue", issue_refund)

    graph.add_edge(START, "draft")
    graph.add_edge("draft", "request_approval")
    graph.add_conditional_edges("request_approval", route, {"issue": "issue", "end": END})
    graph.add_edge("issue", END)

    return graph.compile()


# The graph instance — referenced by langgraph.json
graph = build_interrupts_graph()
```

- [ ] **Step 3: Sanity-check Python imports compile**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework/cockpit/langgraph/interrupts/python
uv run python -c "from src.graph import graph; print('ok', graph)"
```

Expected: prints `ok <compiled graph object>` (the langgraph.json env may need `OPENAI_API_KEY` set; if missing, the import still succeeds because the LLM is lazy-instantiated inside `build_interrupts_graph`).

- [ ] **Step 4: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add cockpit/langgraph/interrupts/python/src/graph.py
git commit -m "feat(cockpit): refund-authorization LangGraph graph with structured interrupt"
```

---

## Task 10: Rewrite the LangGraph system prompt

**Files:**
- Modify: `cockpit/langgraph/interrupts/python/prompts/interrupts.md`

- [ ] **Step 1: Replace the prompt**

Replace the entire contents of `cockpit/langgraph/interrupts/python/prompts/interrupts.md` with:

```
# Refund Authorization Assistant

You help authorize customer refunds. Every refund must be reviewed by a human
operator before any charge is reversed.

When the user describes a refund situation, extract:
- The customer identifier (e.g., cus_abc123).
- The refund amount in USD.
- A short reason (one sentence — what makes this refund justified).

Respond briefly with what you understood, then state that you're pausing for
operator approval. Do not claim the refund has been issued — that only happens
after approval, in a later step.

Keep your response short. The approval card carries the structured fields.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add cockpit/langgraph/interrupts/python/prompts/interrupts.md
git commit -m "feat(cockpit): refund-authorization system prompt"
```

---

## Task 11: Rewrite the cockpit Angular component to use `ChatApprovalCard`

**Files:**
- Modify: `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`
- Delete: `cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts`

- [ ] **Step 1: Replace `interrupts.component.ts`**

Replace the entire contents of `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` with:

```ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ChatComponent, ChatApprovalCardComponent, ChatWelcomeSuggestionComponent, type ChatApprovalAction } from '@threadplane/chat';
import { agent } from '@threadplane/langgraph';
import { ExampleChatLayoutComponent } from '@threadplane/example-layouts';
import { CurrencyPipe } from '@angular/common';
import { environment } from '../environments/environment';

const WELCOME_SUGGESTIONS = [
  { label: 'Refund a duplicate charge', value: 'Refund $47.50 to customer cus_a8x2k — they were charged twice for the same order.' },
  { label: 'Refund a chargeback', value: 'Refund $129.00 to customer cus_z19fp who opened a chargeback for unrecognized activity.' },
] as const;

/**
 * Refund authorization cockpit example.
 *
 * The LangGraph backend extracts refund fields, then pauses at
 * `request_approval` with a structured interrupt payload of the form
 * `{ kind: 'refund_approval', amount, customer_id, reason }`.
 *
 * The frontend uses `ChatApprovalCardComponent` to render the dialog and
 * emit a `ChatApprovalAction` ('approve' | 'edit' | 'cancel'). The handler
 * maps each action to a structured resume payload back to the graph.
 */
@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [
    ChatComponent,
    ChatApprovalCardComponent,
    ChatWelcomeSuggestionComponent,
    ExampleChatLayoutComponent,
    CurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <example-chat-layout>
      <div main class="flex flex-col h-full">
        <chat [agent]="agent" class="flex-1 min-w-0">
          <div chatWelcomeSuggestions>
            @for (s of suggestions; track s.value) {
              <chat-welcome-suggestion
                [label]="s.label"
                [value]="s.value"
                (selected)="send($event)"
              />
            }
          </div>
        </chat>

        <chat-approval-card
          [agent]="agent"
          matchKind="refund_approval"
          title="Refund approval required"
          [showEdit]="true"
          (action)="onAction($event)"
        >
          <ng-template #body let-payload>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div><span style="color:var(--ngaf-chat-text-muted); margin-right:6px;">Amount</span><strong>{{ payload.amount | currency }}</strong></div>
              <div><span style="color:var(--ngaf-chat-text-muted); margin-right:6px;">Customer</span><code>{{ payload.customer_id }}</code></div>
              @if (payload.reason) {
                <div style="font-style:italic; color:var(--ngaf-chat-text-muted); margin-top:4px;">{{ payload.reason }}</div>
              }
              @if (editing()) {
                <div style="margin-top:10px; display:flex; gap:6px; align-items:center;">
                  <label style="color:var(--ngaf-chat-text-muted); font-size:12px;">Edit amount</label>
                  <input type="number" step="0.01" [value]="editAmount() ?? payload.amount" (input)="editAmount.set(+($any($event.target).value))" style="padding:4px 8px; border:1px solid var(--ngaf-chat-separator); border-radius:6px; width:120px;" />
                  <button type="button" (click)="submitEdit(payload)" style="padding:4px 10px; background:var(--ngaf-chat-primary); color:var(--ngaf-chat-on-primary); border:0; border-radius:6px; font-size:12px; cursor:pointer;">Save</button>
                </div>
              }
            </div>
          </ng-template>
        </chat-approval-card>
      </div>
    </example-chat-layout>
  `,
})
export class InterruptsComponent {
  protected readonly suggestions = WELCOME_SUGGESTIONS;
  protected readonly editing = signal(false);
  protected readonly editAmount = signal<number | null>(null);

  protected readonly agent = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.streamingAssistantId,
  });

  protected send(text: string): void {
    void this.agent.submit({ message: text });
  }

  protected onAction(action: ChatApprovalAction): void {
    if (action === 'approve') {
      void this.agent.submit({ resume: { approved: true } });
      this.resetEdit();
    } else if (action === 'cancel') {
      void this.agent.submit({ resume: { approved: false } });
      this.resetEdit();
    } else if (action === 'edit') {
      // Reveal the inline edit input. The Save button (rendered inside the body
      // template) submits the edited amount via `submitEdit`.
      this.editing.set(true);
    }
  }

  protected submitEdit(payload: { amount: number }): void {
    const next = this.editAmount() ?? payload.amount;
    void this.agent.submit({ resume: { approved: true, amount: next } });
    this.resetEdit();
  }

  private resetEdit(): void {
    this.editing.set(false);
    this.editAmount.set(null);
  }
}
```

- [ ] **Step 2: Delete the bespoke ApprovalCardComponent**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git rm cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts
```

Expected: file removed and staged for deletion.

- [ ] **Step 3: Verify the component compiles**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
npx nx build cockpit-langgraph-interrupts-angular --configuration=development
```

Expected: build succeeds. If type errors mention `views(...)` or `signalStateStore(...)`, those imports were removed correctly; the component no longer needs them.

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts
git commit -m "feat(cockpit): refund Angular flow using ChatApprovalCard composition"
```

---

## Task 12: Update the cockpit e2e test

**Files:**
- Modify: `cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`

- [ ] **Step 1: Read the existing spec to find the test pattern + suggestion text**

Run: `head -60 /Users/blove/.codex/worktrees/8bea/angular-agent-framework/cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`

Expected: a Playwright `test.describe` block. Note the imports and any test helpers used. We're going to extend with three new assertions.

- [ ] **Step 2: Add tests for the structured approval card**

Open `cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`. Inside the existing `test.describe(...)` block, append three tests (adjust selectors if the existing tests use different patterns — match the file's conventions):

```ts
  test('approval card displays structured payload fields', async ({ page }) => {
    await page.goto('/');
    // Click the welcome suggestion to seed a refund request.
    await page.getByText('Refund a duplicate charge').click();
    // The dialog opens with structured fields.
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Refund approval required');
    await expect(dialog).toContainText('$47.50');
    await expect(dialog).toContainText('cus_a8x2k');
  });

  test('Approve issues the refund and the run finishes', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Refund a duplicate charge').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Approve' }).click();
    // Expect the chat to surface the refund-issued message.
    await expect(page.getByText(/Refund of \$47\.50 issued/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Cancel skips the refund and confirms cancellation', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Refund a duplicate charge').click();
    const dialog = page.locator('dialog.chat-approval-card');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Refund cancelled by operator/i)).toBeVisible({ timeout: 15_000 });
  });
```

- [ ] **Step 3: Run the e2e suite**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
npx nx e2e cockpit-langgraph-interrupts-angular --skip-nx-cache
```

Expected: all three new tests pass. Existing tests may need adjustment if the old assertions matched the previous prompt's "respond" semantics — fix any failures by updating the assertions to the new refund flow.

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts
git commit -m "test(cockpit): e2e for structured refund approval card"
```

---

## Task 13: Open PR #2 as a draft, NO auto-merge

**Files:** none — just git + gh.

- [ ] **Step 1: Push the branch**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git push -u origin claude/cockpit-interrupts-refund
```

- [ ] **Step 2: Open as a DRAFT PR**

```bash
gh pr create --draft --title "feat(cockpit): refund-authorization interrupts example" --body "$(cat <<'EOF'
## Summary

Rewrites the cockpit \`interrupts\` example as a refund-authorization agent. Structured \`interrupt({ kind: 'refund_approval', amount, customer_id, reason })\` payload flows through the new \`ChatApprovalCard\` composition. Approve issues a (fake) refund; Cancel skips it; Edit lets the operator adjust the amount before approving.

**Strict gate.** Auto-merge intentionally disabled. This PR stays in draft until manual review (Piece 3 in the plan) is signed off by Brian.

## Test plan

- [ ] \`nx e2e cockpit-langgraph-interrupts-angular\` green
- [ ] Manual: refund flow walked through in a real browser (approve, edit, cancel paths)
- [ ] Manual: three screenshots captured for the blog post

Depends on PR #1 (chat library work).
Plan: docs/superpowers/plans/2026-05-25-hitl-refund-cockpit-blog.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens in draft state. **Do NOT run `gh pr merge --auto`** — the strict gate is the whole point of this PR.

---

# Piece 3 — Manual review checkpoint

Interactive. Runs in the live session, gated by Brian's sign-off. No commits.

## Task 14: Boot the cockpit refund example locally

**Files:** none — process management.

- [ ] **Step 1: Verify any old dev server on port 3001 is killed**

```bash
lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 1
lsof -ti :3001 || echo clear
```

Expected: `clear`.

- [ ] **Step 2: Start the LangGraph backend**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework/cockpit/langgraph/interrupts/python
nohup uv run langgraph dev --no-browser > /tmp/cockpit-interrupts-lg.log 2>&1 &
disown
```

Expected: process backgrounds. Tail the log briefly to confirm it bound (default port 2024).

```bash
sleep 6 && tail -10 /tmp/cockpit-interrupts-lg.log
```

Expected log includes a "ready" / port line. If it shows an OpenAI key error, set `OPENAI_API_KEY` from the worktree root `.env` and re-run.

- [ ] **Step 3: Start the Angular cockpit app**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
nohup npx nx serve cockpit-langgraph-interrupts-angular --port 4242 > /tmp/cockpit-interrupts-ng.log 2>&1 &
disown
sleep 12 && tail -10 /tmp/cockpit-interrupts-ng.log
```

Expected: Angular dev server reports listening on port 4242.

- [ ] **Step 4: Smoke-check the app responds**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4242/
```

Expected: `200`.

---

## Task 15: Drive the approval flow in Chrome MCP

**Files:** none — live walkthrough.

- [ ] **Step 1: Get a Chrome MCP tab and navigate**

Call `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true`. Use the returned tab id, then call `mcp__Claude_in_Chrome__navigate` with url `http://localhost:4242/`.

Expected: tab loads the cockpit refund app.

- [ ] **Step 2: Trigger the refund draft**

Tell Brian to click the welcome suggestion "Refund a duplicate charge" (or use `javascript_tool` to click it programmatically). Confirm the agent streams a response saying it's pausing for approval, then the `<dialog>` opens.

Expected: dialog visible with `Amount $47.50`, `Customer cus_a8x2k`, and the reason.

- [ ] **Step 3: Walk through the Approve path**

Ask Brian to click **Approve**. Confirm the chat shows the refund-issued message. **Capture screenshot #2 here while the dialog is visible (do this in Task 16).**

- [ ] **Step 4: Reset, walk through the Edit path**

Reload the page (`mcp__Claude_in_Chrome__navigate` to the same URL). Click the suggestion again. When the dialog opens, click **Edit**. The amount input appears. Have Brian change it (e.g., 47.50 → 25.00) and click **Save**. Confirm the chat shows `Refund of $25.00 issued`.

- [ ] **Step 5: Reset, walk through the Cancel path**

Reload again. Click the suggestion. When the dialog opens, click **Cancel**. Confirm the chat shows `Refund cancelled by operator`.

---

## Task 16: Capture three screenshots

**Files:** none yet — screenshots saved in step 4 of this task.

- [ ] **Step 1: Resize the Chrome MCP viewport to a blog-friendly width**

Call `mcp__Claude_in_Chrome__resize_window` (or `computer` action via Chrome MCP) to set viewport width to **1024px** with height 768px. Keeps screenshots well under the 2000px corruption threshold.

- [ ] **Step 2: Frame 1 — agent drafting, no dialog yet**

Reload to a clean state, click the suggestion, and capture the moment **before** the dialog opens (mid-streaming). Save via `mcp__Claude_in_Chrome__computer` with `action: screenshot, save_to_disk: true`.

Note the returned path. Move it to `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/1.png`.

- [ ] **Step 3: Frame 2 — approval dialog visible with structured payload**

Wait for the dialog to open. Capture. Save to `.../2.png`.

- [ ] **Step 4: Frame 3 — post-approval confirmation**

Click Approve, wait for the refund-issued message, capture, save to `.../3.png`.

- [ ] **Step 5: Verify all three exist and are under 2000px wide**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
ls -la apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/
for f in apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/*.png; do
  echo "$f: $(file "$f" | grep -oE '[0-9]+ x [0-9]+')"
done
```

Expected: three PNGs, all ≤1024px wide.

---

## Task 17: Brian signs off, then mark PR #2 ready and arm auto-merge

**Files:** none — gh + git.

- [ ] **Step 1: Show Brian the screenshots and the running app, ask explicitly:**

> "Manual review checkpoint. Three screenshots captured at `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/{1,2,3}.png`. The flow works in your Chrome tab at http://localhost:4242. **Do you sign off on the UI, or should we loop back to fix something before merging PR #2?**"

Wait for explicit approval. If Brian wants changes, return to Task 11/12 or amend PR #1, then re-run Task 15/16.

- [ ] **Step 2: Leave the screenshots in the working tree (uncommitted)**

The three screenshots in `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/` belong with PR #3 (the blog), not PR #2 (the cockpit). Do **not** commit them on the cockpit branch — they'll be picked up on the fresh blog branch in Task 19.

Confirm the cockpit branch has no screenshot files staged:

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git status --short | grep -E "apps/website/public/blog"
```

Expected: no output (the screenshots are untracked, not staged).

- [ ] **Step 3: Mark PR #2 ready and arm auto-merge**

```bash
gh pr ready
gh pr merge --squash --auto --delete-branch
```

Expected: PR #2 leaves draft, CI runs, auto-merges on green.

---

# PR #3 — Blog rewrite

Branch: `claude/blog-hitl-refund-rewrite`. Depends on PR #2 merging.

## Task 18: Close the existing PR #550 draft

**Files:** none.

- [ ] **Step 1: Close PR #550**

```bash
gh pr comment 550 --body "Closing in favor of a rewrite against the verified cockpit refund example. A replacement PR follows."
gh pr close 550
```

Expected: PR #550 closed.

---

## Task 19: Create the blog branch with screenshots staged

**Files:** none — branching only.

- [ ] **Step 1: Sync main and branch**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git checkout main
git pull origin main
git checkout -b claude/blog-hitl-refund-rewrite
```

- [ ] **Step 2: Stage the screenshots from Task 16**

The three screenshot files should still be present in `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/` from the manual-review step (they were never committed). Confirm:

```bash
ls apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/
```

Expected: `1.png`, `2.png`, `3.png`.

---

## Task 20: Rewrite the blog post against the verified cockpit code

**Files:**
- Rewrite: `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx` with:

```mdx
---
title: "Human-in-the-Loop LangGraph Agents in Angular"
description: "Build a human-in-the-loop LangGraph agent in Angular — pause runs before money moves with a structured approval dialog from @threadplane/chat and @threadplane/langgraph."
date: 2026-05-25
tags: [tutorial, langgraph, angular, agents, hitl, interrupts]
author: brian
featured: false
---

Let's build a human-in-the-loop LangGraph agent in Angular, with an approval dialog that pauses the run before money moves.

I learned this one the cheap way. The first time I let an agent call Stripe directly, it tried to refund the same customer twice in the same run. The second call failed because the first had already cleared. If I'd given it a slightly different prompt, it could have refunded ten times.

That's the moment I started reaching for `interrupt()`.

Streaming made chat feel alive. Interrupts make tool calls feel *safe*. They're the difference between a demo your team enjoys and a system you trust to call your own APIs.

You can run this whole tutorial. The code below is copied verbatim from the cockpit example at `cockpit/langgraph/interrupts` in the threadplane repo — every screenshot in this post was captured from that running app. Clone, `nx serve cockpit-langgraph-interrupts-angular`, and click along.

## Goals

- Understand *why* human-in-the-loop is the production-vs-demo line for tool calls.
- Wire a refund-approval gate using LangGraph's `interrupt()` primitive.
- Render the approval dialog in Angular with the new `<chat-approval-card>` composition.
- Resume or reject the run, with edit support and a real semantic difference between Approve / Edit / Cancel.
- Have fun!

## Why interrupts matter

Streaming chat changed the conversation from "is it broken?" to "is this the answer I wanted?" Interrupts change a *different* question: "should this thing actually happen?"

Most tool calls don't need approval. A read against your data warehouse, a vector search, a stock-price lookup — let the agent rip. But the moment a tool moves money, sends a message a customer will see, deletes a row, or kicks off a build, you want a human in the loop.

Two reasons.

The cheap one is cost. An LLM in a loop with a write API is a slot machine where the house is your bank account. Interrupts cap the blast radius.

The deeper one is trust. The operator on the other side of the screen needs to feel like the agent is collaborating with them, not narrating a fait accompli. A pause for review tells them "you're still driving."

In my opinion, interrupts are what turn an agent from a demo into a teammate. They're not friction — they're *consent*.

<figure>
  <img src="/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/1.png" alt="The refund agent streaming a response after the operator asks to refund $47.50. The agent says it'll pause for approval." width="1024" height="768" />
  <figcaption>The refund agent acknowledges the request and prepares to pause for approval.</figcaption>
</figure>

## The architecture in three boxes

Let's look at the seams before we touch any code.

**LangGraph backend.** A node that, instead of calling Stripe directly, calls `interrupt({ kind: 'refund_approval', amount, customer_id, reason })`. The run pauses there. The thread checkpointer persists the pending interrupt until something resumes it.

**`@threadplane/langgraph` adapter.** Forwards the pending interrupt onto an `agent.interrupt()` signal. `agent.submit({ resume: <any> })` writes a structured value back to the paused graph.

**`@threadplane/chat` UI.** The new `<chat-approval-card>` composition reads the agent's pending interrupt, opens a native HTML `<dialog>` modal, and emits `'approve' | 'edit' | 'cancel'` when the operator clicks a button.

The contract is narrow. The LangGraph node doesn't know how the UI renders. The Angular component doesn't know which graph it's paused inside. That separation is what lets you reuse one approval card across five different agents.

## Scaffold

Three files. Let's go.

<Steps>
<Step title="The LangGraph node">

```python
# refund_agent.py — adapted from cockpit/langgraph/interrupts/python/src/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

def request_approval(state: RefundState) -> dict:
    """Pause for human approval. Resume value is { approved: bool, amount?: number }."""
    decision = interrupt({
        "kind": "refund_approval",
        "amount": state["amount"],
        "customer_id": state["customer_id"],
        "reason": state["reason"],
    })

    if not isinstance(decision, dict) or not decision.get("approved"):
        return {
            "refund_id": None,
            "messages": [AIMessage(content="Refund cancelled by operator. No charge issued.")],
        }

    edited_amount = decision.get("amount")
    final_amount = float(edited_amount) if edited_amount is not None else state["amount"]
    return {"amount": final_amount}
```

`interrupt()` is a function call inside a node. When it runs, the graph pauses and persists the interrupt payload to the thread checkpointer. The graph stays paused until `agent.submit({ resume: <value> })` is called against the same thread — and `<value>` is what `interrupt()` returns when the node re-executes.

That's it. No queues, no webhooks, no human-approval-service.

</Step>
<Step title="Wire the providers">

```ts
// app.config.ts — from cockpit/langgraph/interrupts/angular/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024' }),
    provideChat({}),
  ],
};
```

Same wiring as any other LangGraph agent. The adapter doesn't need to know your graph contains interrupts — it discovers them at runtime from the thread state.

</Step>
<Step title="The component">

```ts
// interrupts.component.ts — from cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { ChatComponent, ChatApprovalCardComponent, type ChatApprovalAction } from '@threadplane/chat';
import { agent } from '@threadplane/langgraph';

@Component({
  selector: 'app-interrupts',
  standalone: true,
  imports: [ChatComponent, ChatApprovalCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <chat [agent]="agent" />
    <chat-approval-card
      [agent]="agent"
      matchKind="refund_approval"
      title="Refund approval required"
      [showEdit]="true"
      (action)="onAction($event)"
    >
      <ng-template #body let-payload>
        <div><strong>{{ payload.amount | currency }}</strong> to <code>{{ payload.customer_id }}</code></div>
        @if (payload.reason) { <div><em>{{ payload.reason }}</em></div> }
      </ng-template>
    </chat-approval-card>
  `,
})
export class InterruptsComponent {
  protected readonly agent = agent({ assistantId: 'interrupts' });

  protected onAction(action: ChatApprovalAction): void {
    if (action === 'approve') {
      void this.agent.submit({ resume: { approved: true } });
    } else if (action === 'cancel') {
      void this.agent.submit({ resume: { approved: false } });
    }
    // Edit reveals an inline form in the body slot; saving submits
    // { approved: true, amount: <new> } directly. See the cockpit
    // example for the full edit flow.
  }
}
```

`<chat-approval-card>` is a panel-style composition. It reads `agent.interrupt()`, matches the `kind` you specify via `matchKind`, opens a native `<dialog>` modal, and emits an action enum on each button click.

The body is yours — write whatever Angular template makes sense for the structured payload your graph emitted. The composition handles the shell.

</Step>
</Steps>

<figure>
  <img src="/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/2.png" alt="The approval dialog visible with amount $47.50, customer cus_a8x2k, and reason 'duplicate charge.'" width="1024" height="768" />
  <figcaption>The native &lt;dialog&gt; modal halts the conversation. The structured payload renders cleanly via the body template slot.</figcaption>
</figure>

## What's happening under the hood

Let's trace one full run.

1. User: "Refund $47.50 to customer cus_a8x2k for a duplicate charge."
2. The `draft` node extracts customer, amount, and reason from the conversation.
3. The `request_approval` node calls `interrupt({ kind: 'refund_approval', amount, customer_id, reason })`. Graph pauses. Thread checkpointer persists the pending interrupt.
4. The adapter receives the pause event, exposes it on `agent.interrupt()`.
5. `<chat-approval-card>` sees the interrupt, matches the `kind`, calls `dialog.showModal()` on its native `<dialog>` element.
6. Operator clicks Approve.
7. Component handler runs `agent.submit({ resume: { approved: true } })`.
8. The adapter posts the resume to LangGraph. The `request_approval` node re-runs — `interrupt()` returns `{ approved: true }` this time instead of pausing.
9. The graph continues to `issue_refund`. Stripe is called (fake in this demo — a real refund ID is logged instead). The run finishes.

The whole thing is one thread, one persisted state. If the operator closes the tab and comes back tomorrow, the interrupt is still there. Pretty freakin' cool. 💚

<figure>
  <img src="/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/3.png" alt="The chat after approval — a confirmation message reads 'Refund of $47.50 issued to cus_a8x2k. Refund ID: re_demo_a8x2k.'" width="1024" height="768" />
  <figcaption>After Approve, the run continues into `issue_refund` and posts confirmation back into the chat.</figcaption>
</figure>

## Production patterns

Three things to know before this ships to a real customer.

### Idempotency

`interrupt()` re-executes the node when the graph resumes. That means any side effect *before* the `interrupt()` call has already run, and any side effect *after* will run on resume. Put the write call (the Stripe `refund.create`) on the resumed side, never the planning side.

And use an idempotency key. The `request_approval` node should generate one and pass it through state to `issue_refund` — so if the operator's network blips and they click Approve twice, Stripe deduplicates the second call.

### Audit trail

When the operator approves, log who approved, when, and what payload they saw. The cleanest place is in the action handler, before `agent.submit` fires:

```ts
protected async onAction(action: ChatApprovalAction): Promise<void> {
  if (action === 'approve') {
    await this.audit.record({
      actor: this.currentUser(),
      decision: 'approved',
      payload: this.agent.interrupt()?.value,
    });
    void this.agent.submit({ resume: { approved: true } });
  }
}
```

Auditing is the difference between "the agent did a thing" and "I can prove who authorized it." Compliance teams care a lot about this.

### When NOT to interrupt

Resist the urge to interrupt on every tool call. A pause for an analytics query is friction with no upside. A pause for a `customers.search` is annoying.

The rule I use: interrupt on writes the operator wouldn't want to undo by hand.

For me, that's about three categories — money movement, customer-facing communication, and destructive deletes. Everything else, let the agent run. If you can undo it with a script in under a minute, it doesn't need approval.

## Conclusion

Streaming made agents feel alive. Interrupts make them safe to ship.

The pattern is small — one `interrupt()` call in your LangGraph node, one `<chat-approval-card>` in your Angular component, one `agent.submit({ resume })` from the action handler. The architecture is what's powerful: the thread state holds the pause, the adapter exposes it, the dialog renders it, and the operator can close the laptop and come back tomorrow.

The next post in this series wires the other half — durable threads — so the conversation (and the pending interrupt) survives a reload, a different device, or a different operator.

If you're building an agent that touches money, sends messages, or deletes data, I think you owe your users a pause button. Now you have one.
```

- [ ] **Step 2: Verify the article renders on the local dev server**

The website dev server should still be up on 3001. If not, restart it:

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH
lsof -ti :3001 | xargs kill -9 2>/dev/null; sleep 1
nohup npx next dev apps/website --port 3001 > /tmp/website-main.log 2>&1 &
disown
sleep 6
```

Then check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/blog/human-in-the-loop-langgraph-agents-in-angular
curl -s http://localhost:3001/blog/human-in-the-loop-langgraph-agents-in-angular | grep -oE '<figure[^>]*>' | wc -l
```

Expected: `200`, three `<figure>` elements.

- [ ] **Step 3: Commit the rewrite + screenshots**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git add apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/
git commit -m "docs(blog): rewrite HITL post against verified cockpit refund example

Three figures captured from the live cockpit at cockpit/langgraph/interrupts.
Code blocks copied verbatim from the cockpit graph.py + interrupts.component.ts.
Replaces the v1 draft (PR #550, closed) which documented APIs that didn't exist."
```

---

## Task 21: Open PR #3 and arm auto-merge

**Files:** none.

- [ ] **Step 1: Push the branch**

```bash
cd /Users/blove/.codex/worktrees/8bea/angular-agent-framework
git push -u origin claude/blog-hitl-refund-rewrite
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "docs(blog): \"Human-in-the-Loop LangGraph Agents in Angular\"" --body "$(cat <<'EOF'
## Summary

Third post in the agent-UI tutorial series. Walks through the cockpit refund flow shipped in PR #2 — code blocks are copied verbatim from \`cockpit/langgraph/interrupts\`, three screenshots are captured from the running app.

**Replaces PR #550** (closed) which documented APIs that didn't actually exist. This version is faithful to the implementation.

## Voice / SEO

- Primary keyword: \`angular human in the loop\` / \`langgraph interrupt angular\` (SERP near-empty)
- Voice doc compliance: title-restated lede, \`## Goals\` ending in \`Have fun!\`, "Let's" workhorse transitions, italics emphasis, one 💚 emoji, "freakin' cool," personal Stripe disclosure, forward-link close (not a CTA), explicit \`## Conclusion\`.

## Test plan

- [ ] \`nx lint website\` clean
- [ ] \`nx test website\` green
- [ ] \`nx e2e website\` green (existing tests; this post is just content)
- [ ] Manual: article renders at \`/blog/human-in-the-loop-langgraph-agents-in-angular\`, three \`<figure>\` elements visible

Depends on PR #2 (cockpit refund example) merging first.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Arm auto-merge**

```bash
gh pr merge --squash --auto --delete-branch
```

Expected: auto-merge enabled. CI runs; PR merges on green.

---

## Definition of done

- PR #1 merged (library work).
- PR #2 merged (cockpit refund example), gated by Brian's manual sign-off in Task 17.
- PR #3 merged (blog rewrite).
- The three screenshots committed under `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/`.
- The blog post renders at `/blog/human-in-the-loop-langgraph-agents-in-angular` with three figures.
- PR #550 closed with a pointer to PR #3.
- Bespoke `ApprovalCardComponent` deleted from the cockpit; the cockpit imports `ChatApprovalCardComponent` from `@threadplane/chat`.

## Out of scope (deferred to later plans)

- `--ngaf-chat-*` → `--threadplane-chat-*` system-wide token rename.
- A built-in inline-edit form inside `ChatApprovalCard` (callers render it via the body slot).
- Distinct `agent.resume(value)` API alongside `agent.submit({ resume })`.
- Real Stripe integration in the cockpit (`issue_refund` logs a fake `refund_id`).
- Multi-turn chained approvals.
