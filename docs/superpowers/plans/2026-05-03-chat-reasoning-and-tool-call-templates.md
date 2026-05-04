# Chat Reasoning + Tool-Call Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface model reasoning content as a first-class collapsible pill above the assistant response, and turn tool-call rendering into a CopilotKit-style extension surface via a `chatToolCallTemplate` directive while keeping a polished default that auto-collapses completed cards and groups sequential same-name calls.

**Architecture:** One new primitive (`<chat-reasoning>`), one new directive (`chatToolCallTemplate`), augmentations to two existing primitives (`<chat-tool-calls>`, `<chat-tool-call-card>`), two new optional `Message` fields (`reasoning`, `reasoningDurationMs`) populated by both adapters from provider-agnostic sources (LangGraph complex-content reasoning blocks and AG-UI `REASONING_MESSAGE_*` events). Single-PR shipment across `@ngaf/chat`, `@ngaf/langgraph`, and `@ngaf/ag-ui`.

**Tech Stack:** Angular 21 standalone + signals + OnPush; vitest for library tests; nx monorepo build (`npx nx build <project>`, `npx nx test <project>`); LangGraph SDK + AG-UI client for adapter event streams; marked + sanitized innerHTML for markdown rendering; @ngaf/chat as the shared contract surface between adapters.

**Reference spec:** `docs/superpowers/specs/2026-05-03-chat-reasoning-and-tool-call-templates-design.md`

**Hard constraint:** Never reference any chat-UI library this work was inspired by — no `copilotkit` / `chatgpt` / `chatbot-kit` / similar references in code, comments, commits, PR bodies, or docs. Aesthetic and extensibility patterns are independently arrived at.

---

## Phase 0: Branch setup + baseline

### Task 0.1: Branch from main

**Files:** none (git only)

- [ ] **Step 1: Confirm PR #191 is merged + main is up-to-date**

```bash
gh pr view 191 --json state --jq '.state'
git fetch origin main
git log --oneline origin/main | head -3
```

Expected: state is `MERGED` and the latest origin/main commit has the streaming/markdown + model-picker work landed.

- [ ] **Step 2: Create the implementation branch**

```bash
git checkout -b claude/chat-reasoning-and-tool-call-templates origin/main
```

Expected: switched to a fresh branch off main with a clean working tree (`git status` shows nothing).

- [ ] **Step 3: Verify clean baseline build**

```bash
npx nx run-many --target=build --projects=licensing,render,chat,langgraph,ag-ui 2>&1 | tail -5
```

Expected: all five builds succeed. If any fail, stop and report the error before starting Phase 1.

- [ ] **Step 4: Verify clean baseline tests**

```bash
npx nx run-many --target=test --projects=chat,langgraph,ag-ui 2>&1 | tail -10
```

Expected: all three test suites pass. The number of passing tests on this baseline is the floor — every later commit must keep them passing.

---

## Phase 1: Foundation — `Message` fields + `formatDuration` utility

### Task 1.1: Add `reasoning` + `reasoningDurationMs` to `Message`

**Files:**
- Modify: `libs/chat/src/lib/agent/message.ts`
- Test: `libs/chat/src/lib/agent/message.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `libs/chat/src/lib/agent/message.spec.ts` and append (after the existing tests):

```typescript
describe('Message — reasoning fields', () => {
  it('accepts an optional reasoning string', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: 'hello',
      reasoning: 'first I thought about it',
    };
    expect(m.reasoning).toBe('first I thought about it');
  });

  it('accepts an optional reasoningDurationMs number', () => {
    const m: Message = {
      id: 'a',
      role: 'assistant',
      content: 'hello',
      reasoning: 'first I thought about it',
      reasoningDurationMs: 1234,
    };
    expect(m.reasoningDurationMs).toBe(1234);
  });

  it('treats both reasoning fields as optional', () => {
    const m: Message = { id: 'a', role: 'assistant', content: 'hello' };
    expect(m.reasoning).toBeUndefined();
    expect(m.reasoningDurationMs).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run libs/chat/src/lib/agent/message.spec.ts 2>&1 | tail -10
```

Expected: TypeScript compile error — `Object literal may only specify known properties, and 'reasoning' does not exist in type 'Message'.`

- [ ] **Step 3: Add the fields to `Message`**

Replace the `Message` interface in `libs/chat/src/lib/agent/message.ts`:

```typescript
export interface Message {
  id: string;
  role: Role;
  /** Plain text, or a list of structured content blocks. */
  content: string | ContentBlock[];
  /** Present when role === 'tool'. */
  toolCallId?: string;
  /** Optional display/author name. */
  name?: string;
  /**
   * Reasoning text emitted by the model before/alongside the visible
   * response. Populated by adapters from {type:'reasoning'} or
   * {type:'thinking'} content blocks (LangGraph) or REASONING_MESSAGE_*
   * events (AG-UI). Always a plain string — provider-specific shape
   * (encrypted blocks, multi-step summaries) is absorbed by the adapter
   * and not surfaced here.
   */
  reasoning?: string;
  /**
   * Wall-clock duration of the reasoning phase in milliseconds.
   * Populated by the adapter when both start (first reasoning chunk) and
   * end (first response-text chunk, or final canonical message) are
   * known. Undefined when reasoning timing isn't available.
   */
  reasoningDurationMs?: number;
  /** Runtime-specific extras; do not rely on shape in portable code. */
  extra?: Record<string, unknown>;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run libs/chat/src/lib/agent/message.spec.ts 2>&1 | tail -5
```

Expected: all `Message — reasoning fields` tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/agent/message.ts libs/chat/src/lib/agent/message.spec.ts
git commit -m "feat(chat): add Message.reasoning + Message.reasoningDurationMs

Optional fields on the shared Message contract. Adapters populate them
from provider-agnostic sources (LangGraph reasoning/thinking content
blocks, AG-UI REASONING_MESSAGE_* events). UI primitives consume the
fields without provider-specific knowledge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: Add `formatDuration` utility

**Files:**
- Create: `libs/chat/src/lib/utils/format-duration.ts`
- Create: `libs/chat/src/lib/utils/format-duration.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/utils/format-duration.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('renders sub-second durations as "<1s"', () => {
    expect(formatDuration(0)).toBe('<1s');
    expect(formatDuration(500)).toBe('<1s');
    expect(formatDuration(999)).toBe('<1s');
  });

  it('renders sub-minute durations in seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(4000)).toBe('4s');
    expect(formatDuration(59_000)).toBe('59s');
    expect(formatDuration(59_999)).toBe('59s');
  });

  it('renders minute-or-greater durations as "Nm Ms"', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(72_000)).toBe('1m 12s');
    expect(formatDuration(125_000)).toBe('2m 5s');
    expect(formatDuration(3_600_000)).toBe('60m 0s');
  });

  it('clamps negative inputs to "<1s"', () => {
    expect(formatDuration(-1)).toBe('<1s');
    expect(formatDuration(-1000)).toBe('<1s');
  });

  it('handles non-finite inputs by returning "<1s"', () => {
    expect(formatDuration(Number.NaN)).toBe('<1s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('<1s');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run libs/chat/src/lib/utils/format-duration.spec.ts 2>&1 | tail -5
```

Expected: `Cannot find module './format-duration'`.

- [ ] **Step 3: Implement the utility**

Create `libs/chat/src/lib/utils/format-duration.ts`:

```typescript
// SPDX-License-Identifier: MIT

/**
 * Render a millisecond duration as a human-readable label suitable for
 * the chat-reasoning "Thought for Ns" pill.
 *
 * - <1 s         → "<1s"
 * - 1–59 s       → "Ns"     (e.g. "4s")
 * - ≥60 s        → "Nm Ms"  (e.g. "1m 12s", "60m 0s")
 *
 * Negative or non-finite inputs collapse to "<1s" so a corrupted timing
 * map never produces noisy output.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return '<1s';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}m ${seconds}s`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run libs/chat/src/lib/utils/format-duration.spec.ts 2>&1 | tail -5
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/utils/format-duration.ts libs/chat/src/lib/utils/format-duration.spec.ts
git commit -m "feat(chat): add formatDuration utility

Renders millisecond durations as compact human-readable labels:
<1s, Ns, Nm Ms. Powers the chat-reasoning 'Thought for Ns' pill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: New primitive — `<chat-reasoning>` (TDD)

### Task 2.1: Write the chat-reasoning component spec

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts`

- [ ] **Step 1: Write the spec**

Create `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatReasoningComponent } from './chat-reasoning.component';

@Component({
  standalone: true,
  imports: [ChatReasoningComponent],
  template: `
    <chat-reasoning
      [content]="content()"
      [isStreaming]="streaming()"
      [durationMs]="durationMs()"
      [defaultExpanded]="defaultExpanded()"
    />
  `,
})
class HostComponent {
  content = signal<string>('I considered the problem.');
  streaming = signal<boolean>(false);
  durationMs = signal<number | undefined>(undefined);
  defaultExpanded = signal<boolean>(false);
}

function makeFixture() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

function getEl(fixture: ReturnType<typeof makeFixture>): HTMLElement {
  return fixture.nativeElement.querySelector('chat-reasoning');
}

function getHeader(fixture: ReturnType<typeof makeFixture>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('chat-reasoning button.chat-reasoning__header');
}

function getLabelText(fixture: ReturnType<typeof makeFixture>): string {
  return fixture.nativeElement.querySelector('chat-reasoning .chat-reasoning__label')?.textContent?.trim() ?? '';
}

describe('ChatReasoningComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('hides itself when content is empty', () => {
    const fixture = makeFixture();
    fixture.componentInstance.content.set('');
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-has-content')).toBe('false');
  });

  it('shows itself when content is non-empty', () => {
    const fixture = makeFixture();
    expect(getEl(fixture).getAttribute('data-has-content')).toBe('true');
  });

  it('renders "Thinking…" while streaming', () => {
    const fixture = makeFixture();
    fixture.componentInstance.streaming.set(true);
    fixture.detectChanges();
    expect(getLabelText(fixture)).toContain('Thinking');
  });

  it('renders "Thought for Ns" when idle with durationMs', () => {
    const fixture = makeFixture();
    fixture.componentInstance.streaming.set(false);
    fixture.componentInstance.durationMs.set(4000);
    fixture.detectChanges();
    expect(getLabelText(fixture)).toContain('Thought for 4s');
  });

  it('renders "Show reasoning" when idle without durationMs', () => {
    const fixture = makeFixture();
    fixture.componentInstance.streaming.set(false);
    fixture.componentInstance.durationMs.set(undefined);
    fixture.detectChanges();
    expect(getLabelText(fixture)).toContain('Show reasoning');
  });

  it('starts collapsed by default', () => {
    const fixture = makeFixture();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('false');
  });

  it('starts expanded when defaultExpanded=true', () => {
    const fixture = makeFixture();
    fixture.componentInstance.defaultExpanded.set(true);
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('true');
  });

  it('force-expands while streaming', () => {
    const fixture = makeFixture();
    fixture.componentInstance.streaming.set(true);
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('true');
  });

  it('toggles open and closed on header click', () => {
    const fixture = makeFixture();
    const header = getHeader(fixture);
    header.click();
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('true');
    header.click();
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('false');
  });

  it('preserves user choice across isStreaming transitions', () => {
    const fixture = makeFixture();
    // User opens manually
    getHeader(fixture).click();
    fixture.detectChanges();
    expect(getEl(fixture).getAttribute('data-expanded')).toBe('true');

    // Streaming completes (isStreaming false → still true after transition because user opened)
    fixture.componentInstance.streaming.set(true);
    fixture.detectChanges();
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();

    expect(getEl(fixture).getAttribute('data-expanded')).toBe('true');
  });

  it('renders the content body inside chat-streaming-md when expanded', () => {
    const fixture = makeFixture();
    fixture.componentInstance.defaultExpanded.set(true);
    fixture.detectChanges();
    const md = fixture.nativeElement.querySelector('chat-reasoning chat-streaming-md');
    expect(md).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts 2>&1 | tail -5
```

Expected: `Cannot find module './chat-reasoning.component'`.

### Task 2.2: Implement the chat-reasoning styles

**Files:**
- Create: `libs/chat/src/lib/styles/chat-reasoning.styles.ts`

- [ ] **Step 1: Write the styles**

Create `libs/chat/src/lib/styles/chat-reasoning.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-reasoning.styles.ts
// SPDX-License-Identifier: MIT
//
// Style block for the chat-reasoning primitive. Pill-shaped header with
// a chevron + label; expanded body sits below the header with a thin
// left border (matches the blockquote pattern in chat-markdown.styles).
// Muted text colors throughout so reasoning content recedes visually
// next to the response.
export const CHAT_REASONING_STYLES = `
  :host { display: block; margin: 0 0 0.5rem; }
  :host([data-has-content="false"]) { display: none; }

  .chat-reasoning__header {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 4px 10px;
    background: var(--ngaf-chat-surface-alt);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: 9999px;
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-xs);
    font-family: inherit;
    cursor: pointer;
    line-height: 1.2;
  }
  .chat-reasoning__header:hover { color: var(--ngaf-chat-text); }

  .chat-reasoning__chevron {
    width: 10px;
    height: 10px;
    transition: transform 120ms ease;
  }
  :host([data-expanded="true"]) .chat-reasoning__chevron { transform: rotate(90deg); }

  .chat-reasoning__pulse {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ngaf-chat-text-muted);
    animation: chat-reasoning-pulse 1.2s ease-in-out infinite;
  }
  @keyframes chat-reasoning-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .chat-reasoning__body {
    margin-top: 0.5rem;
    padding-left: 12px;
    border-left: 2px solid var(--ngaf-chat-separator);
    color: var(--ngaf-chat-text-muted);
  }
  .chat-reasoning__body chat-streaming-md { font-size: 0.95em; }
`;
```

- [ ] **Step 2: Commit (styles only — component fails build until 2.3)**

```bash
git add libs/chat/src/lib/styles/chat-reasoning.styles.ts
git commit -m "feat(chat): chat-reasoning styles

Pill-shaped header with chevron + animated pulse dot for the streaming
state, expanded body with thin left border (matches the blockquote
pattern). Muted text throughout so reasoning content recedes next to
the response.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: Implement the chat-reasoning component

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.ts`

- [ ] **Step 1: Write the component**

Create `libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy,
  computed, effect, input, signal,
} from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_REASONING_STYLES } from '../../styles/chat-reasoning.styles';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { formatDuration } from '../../utils/format-duration';

/**
 * Renders an assistant's reasoning content as a compact pill that
 * expands to reveal the underlying text. Three visual states:
 *
 * - Streaming: pill shows "Thinking…" with a pulsing dot; auto-expanded
 *   so the user sees reasoning stream in real time.
 * - Idle, with durationMs known: pill shows "Thought for {duration}";
 *   collapsed by default, expand on click.
 * - Idle, no duration: pill shows "Show reasoning"; collapsed by default.
 *
 * The body re-uses chat-streaming-md so reasoning content gets the same
 * markdown rendering pipeline as the visible response (lists, code,
 * step labels often appear in reasoning output).
 *
 * Internal state: a tristate "expanded" — null means follow auto state-
 * driven logic (force-expand on isStreaming, otherwise honor
 * defaultExpanded), boolean is a manual user choice that wins for the
 * lifetime of the instance.
 */
@Component({
  selector: 'chat-reasoning',
  standalone: true,
  imports: [ChatStreamingMdComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_REASONING_STYLES],
  host: {
    '[attr.data-has-content]': 'hasContent()',
    '[attr.data-expanded]': 'expandedStr()',
    '[attr.data-streaming]': 'isStreaming()',
  },
  template: `
    <button
      type="button"
      class="chat-reasoning__header"
      [attr.aria-expanded]="expanded()"
      (click)="toggle()"
    >
      <svg class="chat-reasoning__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 2l4 4-4 4"/>
      </svg>
      @if (isStreaming()) {
        <span class="chat-reasoning__pulse" aria-hidden="true"></span>
      }
      <span class="chat-reasoning__label">{{ resolvedLabel() }}</span>
    </button>
    @if (expanded()) {
      <div class="chat-reasoning__body">
        <chat-streaming-md [content]="content()" [streaming]="isStreaming()" />
      </div>
    }
  `,
})
export class ChatReasoningComponent {
  readonly content = input.required<string>();
  readonly isStreaming = input<boolean>(false);
  readonly durationMs = input<number | undefined>(undefined);
  readonly label = input<string | undefined>(undefined);
  readonly defaultExpanded = input<boolean>(false);

  readonly hasContent = computed(() => (this.content() ?? '').length > 0);

  /** null = follow auto logic (streaming → expanded, else defaultExpanded). */
  private readonly _expandedOverride = signal<boolean | null>(null);

  readonly expanded = computed(() => {
    const override = this._expandedOverride();
    if (override !== null) return override;
    if (this.isStreaming()) return true;
    return this.defaultExpanded();
  });

  readonly expandedStr = computed(() => String(this.expanded()));

  readonly resolvedLabel = computed(() => {
    const explicit = this.label();
    if (explicit) return explicit;
    if (this.isStreaming()) return 'Thinking…';
    const ms = this.durationMs();
    if (typeof ms === 'number') return `Thought for ${formatDuration(ms)}`;
    return 'Show reasoning';
  });

  constructor() {
    // Reset the override when the component re-enters streaming state
    // (e.g. follow-up turn that re-uses this instance) so the auto
    // force-expand logic takes over again.
    let prevStreaming = false;
    effect(() => {
      const streaming = this.isStreaming();
      if (!prevStreaming && streaming) {
        this._expandedOverride.set(null);
      }
      prevStreaming = streaming;
    });
  }

  toggle(): void {
    this._expandedOverride.set(!this.expanded());
  }
}
```

- [ ] **Step 2: Run the spec to verify it passes**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-reasoning/chat-reasoning.component.spec.ts 2>&1 | tail -10
```

Expected: 11/11 ChatReasoningComponent tests pass.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-reasoning/
git commit -m "feat(chat): chat-reasoning primitive

Renders model reasoning content as a compact pill. Three visual states
(streaming with pulse + auto-expand, idle with 'Thought for Ns', idle
with 'Show reasoning' fallback). User toggle wins over auto logic for
the lifetime of the instance; auto logic resumes when streaming
re-engages on a follow-up turn. Body re-uses chat-streaming-md so
markdown in reasoning output renders consistently with the response.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.4: Export from public API

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the exports**

In `libs/chat/src/public-api.ts`, locate the section that exports primitives (around line 41, just after `ChatTraceComponent`) and add:

```typescript
export { ChatReasoningComponent } from './lib/primitives/chat-reasoning/chat-reasoning.component';
```

In the section that exports utilities (find by searching for `formatDuration` or add near the streaming utils block), add:

```typescript
export { formatDuration } from './lib/utils/format-duration';
```

- [ ] **Step 2: Build the chat library to verify exports compile**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export ChatReasoningComponent + formatDuration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: New directive — `chatToolCallTemplate` (TDD)

### Task 3.1: Write the directive spec

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.spec.ts`

- [ ] **Step 1: Write the spec**

Create `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, contentChildren, TemplateRef } from '@angular/core';
import { ChatToolCallTemplateDirective } from './chat-tool-call-template.directive';

@Component({
  standalone: true,
  imports: [ChatToolCallTemplateDirective],
  template: `
    <ng-template chatToolCallTemplate="search_web" let-call>
      <span data-template="search_web">{{ call.name }}</span>
    </ng-template>
    <ng-template chatToolCallTemplate="generate_image" let-call let-status="status">
      <span data-template="generate_image">{{ call.name }} / {{ status }}</span>
    </ng-template>
    <ng-template chatToolCallTemplate="*" let-call>
      <span data-template="wildcard">{{ call.name }}</span>
    </ng-template>
  `,
})
class HostComponent {
  readonly templates = contentChildren(ChatToolCallTemplateDirective);
}

describe('ChatToolCallTemplateDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('exposes the tool name as `name`', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    // contentChildren is empty in this self-hosted test (no projection happening)
    // so directly query directives via DI on the host element. Easier: use
    // the queryAll API on the test-bed debug element.
    const directives = fixture.debugElement.queryAll(
      (e) => e.injector.get(ChatToolCallTemplateDirective, null) !== null,
    ).map((e) => e.injector.get(ChatToolCallTemplateDirective));
    expect(directives.map((d) => d.name())).toEqual(['search_web', 'generate_image', '*']);
  });

  it('captures the TemplateRef', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const directive = fixture.debugElement.query(
      (e) => e.injector.get(ChatToolCallTemplateDirective, null) !== null,
    ).injector.get(ChatToolCallTemplateDirective);
    expect(directive.templateRef).toBeInstanceOf(TemplateRef);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.spec.ts 2>&1 | tail -5
```

Expected: `Cannot find module './chat-tool-call-template.directive'`.

### Task 3.2: Implement the directive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.ts`

- [ ] **Step 1: Write the directive**

Create `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.ts
// SPDX-License-Identifier: MIT
import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { ToolCall, ToolCallStatus } from '../../agent';

/**
 * Template-context surface available to a per-tool template. The first
 * argument is the ToolCall itself (let-call); status is exposed as a
 * named context property (let-status="status").
 */
export interface ChatToolCallTemplateContext {
  $implicit: ToolCall;
  status: ToolCallStatus;
}

/**
 * Registers a per-tool-name template inside <chat-tool-calls>. The
 * primitive collects all directive instances via contentChildren() and
 * dispatches incoming calls by their `name` field. A literal "*" name
 * registers a wildcard catch-all that handles any tool name without a
 * specific template registered.
 *
 * Usage:
 *
 *   <chat-tool-calls [agent]="agent" [message]="msg">
 *     <ng-template chatToolCallTemplate="search_web" let-call let-status="status">
 *       <my-search-result-card [query]="call.args.query" [status]="status"/>
 *     </ng-template>
 *     <ng-template chatToolCallTemplate="*" let-call>
 *       <chat-tool-call-card [toolCall]="call"/>
 *     </ng-template>
 *   </chat-tool-calls>
 */
@Directive({
  selector: '[chatToolCallTemplate]',
  standalone: true,
})
export class ChatToolCallTemplateDirective {
  /** The tool name this template handles, or "*" for the wildcard catch-all. */
  readonly name = input.required<string>({ alias: 'chatToolCallTemplate' });
  readonly templateRef = inject(TemplateRef<ChatToolCallTemplateContext>);
}
```

- [ ] **Step 2: Run the spec to verify it passes**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.spec.ts 2>&1 | tail -5
```

Expected: 2/2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.ts libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-call-template.directive.spec.ts
git commit -m "feat(chat): chatToolCallTemplate directive

Per-tool-name template registry consumed by <chat-tool-calls>. A '*'
wildcard registers a catch-all for any unmapped tool name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.3: Export from public API

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the exports**

After the `ChatToolCallsComponent` export (around line 49), add:

```typescript
export { ChatToolCallTemplateDirective } from './lib/primitives/chat-tool-calls/chat-tool-call-template.directive';
export type { ChatToolCallTemplateContext } from './lib/primitives/chat-tool-calls/chat-tool-call-template.directive';
```

- [ ] **Step 2: Build to verify**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export ChatToolCallTemplateDirective + context type

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Augment `<chat-tool-calls>` — grouping + per-tool template registry

### Task 4.1: Write the augmented spec

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts`

- [ ] **Step 1: Append new tests**

Append the following block to `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts` (after the last existing `describe` block):

```typescript
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatToolCallsComponent } from './chat-tool-calls.component';
import { ChatToolCallTemplateDirective } from './chat-tool-call-template.directive';

@Component({
  standalone: true,
  imports: [ChatToolCallsComponent, ChatToolCallTemplateDirective],
  template: `
    <chat-tool-calls [agent]="agent" [grouping]="grouping">
      @if (registerSearchWeb) {
        <ng-template chatToolCallTemplate="search_web" let-call>
          <span data-tpl="search_web">{{ call.name }}-{{ call.id }}</span>
        </ng-template>
      }
      @if (registerWildcard) {
        <ng-template chatToolCallTemplate="*" let-call>
          <span data-tpl="wildcard">{{ call.name }}-{{ call.id }}</span>
        </ng-template>
      }
    </chat-tool-calls>
  `,
})
class GroupingHost {
  agent: any;
  grouping: 'auto' | 'none' = 'auto';
  registerSearchWeb = false;
  registerWildcard = false;
}

import { mockAgent } from '../../testing/mock-agent';

describe('ChatToolCallsComponent — grouping + per-tool templates', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GroupingHost] });
  });

  it('groups three sequential search_web calls into one strip', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete', result: 'r' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete', result: 'r' },
        { id: 'c', name: 'search_web', args: {}, status: 'complete', result: 'r' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(1);
    expect(strips[0].textContent).toContain('Searched 3');
  });

  it('does not group when names differ', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'read_file', args: {}, status: 'complete' },
        { id: 'c', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(0);
    const cards = fixture.nativeElement.querySelectorAll('chat-tool-call-card');
    expect(cards.length).toBe(3);
  });

  it('does not group when [grouping]="none"', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.grouping = 'none';
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const strips = fixture.nativeElement.querySelectorAll('[data-group="true"]');
    expect(strips.length).toBe(0);
  });

  it('routes each call through a per-tool template when registered', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerSearchWeb = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'search_web', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    const tplNodes = fixture.nativeElement.querySelectorAll('[data-tpl="search_web"]');
    expect(tplNodes.length).toBe(2);
    // Per-tool template wins — no strip and no default cards.
    expect(fixture.nativeElement.querySelectorAll('[data-group="true"]').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('chat-tool-call-card').length).toBe(0);
  });

  it('falls back to wildcard "*" template when no per-tool template matches', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerWildcard = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'read_file', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="wildcard"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('chat-tool-call-card').length).toBe(0);
  });

  it('per-tool template wins over wildcard for matching name', () => {
    const fixture = TestBed.createComponent(GroupingHost);
    fixture.componentInstance.registerSearchWeb = true;
    fixture.componentInstance.registerWildcard = true;
    fixture.componentInstance.agent = mockAgent({
      toolCalls: [
        { id: 'a', name: 'search_web', args: {}, status: 'complete' },
        { id: 'b', name: 'read_file', args: {}, status: 'complete' },
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="search_web"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[data-tpl="wildcard"]').length).toBe(1);
  });
});

describe('summarize-group label registry', () => {
  // Imported at runtime to avoid bundling mismatch
  let summarize: typeof import('./group-summary').summarizeGroup;
  beforeEach(async () => {
    summarize = (await import('./group-summary')).summarizeGroup;
  });

  it('uses "Searched N sites" for search_*', () => {
    expect(summarize('search_web', 5)).toBe('Searched 5 sites');
    expect(summarize('search_files', 1)).toBe('Searched 1 site');
  });

  it('uses "Generated N items" for generate_*', () => {
    expect(summarize('generate_image', 3)).toBe('Generated 3 items');
  });

  it('falls back to "Called {name} N times"', () => {
    expect(summarize('foo', 4)).toBe('Called foo 4 times');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts 2>&1 | tail -5
```

Expected: failures because `[grouping]` input doesn't exist on the component, and `./group-summary` module doesn't exist.

### Task 4.2: Implement `group-summary.ts`

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/group-summary.ts`

- [ ] **Step 1: Write the helper**

Create `libs/chat/src/lib/primitives/chat-tool-calls/group-summary.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-tool-calls/group-summary.ts
// SPDX-License-Identifier: MIT

/**
 * Default summary text for a group of N consecutive same-name tool calls.
 * Recognizes a small set of common tool-name prefixes; falls back to a
 * generic "Called {name} N times" otherwise.
 *
 * Consumers can override the registry per-instance via the
 * `[groupSummary]` input on <chat-tool-calls>.
 */
export function summarizeGroup(name: string, count: number): string {
  const noun = nounForPrefix(name);
  if (noun) return `${noun.verb} ${count} ${pluralize(noun.singular, count)}`;
  return `Called ${name} ${count} ${count === 1 ? 'time' : 'times'}`;
}

interface NounEntry { verb: string; singular: string }

function nounForPrefix(name: string): NounEntry | null {
  if (name.startsWith('search_')) return { verb: 'Searched', singular: 'site' };
  if (name.startsWith('generate_')) return { verb: 'Generated', singular: 'item' };
  if (name.startsWith('read_')) return { verb: 'Read', singular: 'file' };
  if (name.startsWith('write_')) return { verb: 'Wrote', singular: 'file' };
  if (name.startsWith('list_')) return { verb: 'Listed', singular: 'item' };
  return null;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
```

- [ ] **Step 2: Run the summarizeGroup tests**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts -t "summarize-group" 2>&1 | tail -5
```

Expected: the 3 `summarize-group label registry` tests pass.

### Task 4.3: Augment the chat-tool-calls component

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`

- [ ] **Step 1: Replace the component**

Replace the entire contents of `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy,
  computed, contentChildren, input, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent, Message, ToolCall } from '../../agent';
import { ChatToolCallCardComponent, type ToolCallInfo } from '../../compositions/chat-tool-call-card/chat-tool-call-card.component';
import { ChatToolCallTemplateDirective } from './chat-tool-call-template.directive';
import { summarizeGroup as defaultSummarizeGroup } from './group-summary';

interface Group {
  name: string;
  calls: ToolCall[];
  templateRef?: ChatToolCallTemplateDirective;
}

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet, ChatToolCallCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .ctc__group {
      border: 1px solid var(--ngaf-chat-separator);
      border-radius: var(--ngaf-chat-radius-card);
      margin: 0 0 8px;
    }
    .ctc__group-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 8px 12px;
      background: transparent;
      border: 0;
      font: inherit;
      color: var(--ngaf-chat-text);
      cursor: pointer;
      text-align: left;
    }
    .ctc__group-chevron {
      width: 10px; height: 10px;
      transition: transform 120ms ease;
    }
    .ctc__group[data-expanded="true"] .ctc__group-chevron { transform: rotate(90deg); }
    .ctc__group-body {
      padding: 0 12px 8px;
      border-top: 1px solid var(--ngaf-chat-separator);
    }
  `],
  template: `
    @for (group of groups(); track $index) {
      @if (group.calls.length > 1 && !group.templateRef) {
        <!-- Default grouped strip -->
        @let expanded = expandedGroups().has($index);
        <div class="ctc__group" [attr.data-group]="true" [attr.data-expanded]="expanded">
          <button type="button" class="ctc__group-header" (click)="toggleGroup($index)">
            <svg class="ctc__group-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 2l4 4-4 4"/>
            </svg>
            <span>{{ summarize(group.name, group.calls.length) }}</span>
          </button>
          @if (expanded) {
            <div class="ctc__group-body">
              @for (tc of group.calls; track tc.id) {
                <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
              }
            </div>
          }
        </div>
      } @else if (group.templateRef) {
        <!-- Each call rendered through its registered template -->
        @for (tc of group.calls; track tc.id) {
          <ng-container
            [ngTemplateOutlet]="group.templateRef.templateRef"
            [ngTemplateOutletContext]="{ $implicit: tc, status: tc.status }"
          />
        }
      } @else {
        <!-- Singleton call, no template — default card -->
        @for (tc of group.calls; track tc.id) {
          <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
        }
      }
    }
  `,
})
export class ChatToolCallsComponent {
  readonly agent = input.required<Agent>();
  readonly message = input<Message | undefined>(undefined);
  readonly grouping = input<'auto' | 'none'>('auto');
  readonly groupSummary = input<((name: string, count: number) => string) | undefined>(undefined);

  /** Per-tool-name + wildcard templates registered as content children. */
  readonly templates = contentChildren(ChatToolCallTemplateDirective);

  private readonly templateRegistry = computed(() => {
    const map = new Map<string, ChatToolCallTemplateDirective>();
    for (const t of this.templates()) {
      map.set(t.name(), t);
    }
    return map;
  });

  readonly toolCalls = computed((): ToolCall[] => {
    const msg = this.message();
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      const blocks = msg.content.filter((b) => b.type === 'tool_use');
      const all = this.agent().toolCalls();
      return blocks.map(b => all.find(tc => tc.id === b.id)).filter((x): x is ToolCall => !!x);
    }
    return this.agent().toolCalls();
  });

  readonly groups = computed((): Group[] => {
    const calls = this.toolCalls();
    const groupingMode = this.grouping();
    const registry = this.templateRegistry();
    const wildcard = registry.get('*');
    const out: Group[] = [];
    for (const tc of calls) {
      const tpl = registry.get(tc.name) ?? wildcard;
      const last = out[out.length - 1];
      const sameName = last && last.name === tc.name;
      const canGroup = groupingMode === 'auto' && sameName;
      if (canGroup) {
        last.calls.push(tc);
        // Re-resolve template per-group: if any call has a specific template, the group uses it.
        if (!last.templateRef && tpl) last.templateRef = tpl;
      } else {
        out.push({ name: tc.name, calls: [tc], templateRef: tpl });
      }
    }
    return out;
  });

  private readonly _expandedGroups = signal(new Set<number>());
  readonly expandedGroups = this._expandedGroups.asReadonly();

  toggleGroup(index: number): void {
    this._expandedGroups.update((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  protected summarize(name: string, count: number): string {
    return (this.groupSummary() ?? defaultSummarizeGroup)(name, count);
  }

  protected toToolCallInfo(tc: ToolCall): ToolCallInfo {
    return { id: tc.id, name: tc.name, args: tc.args, result: tc.result, status: tc.status };
  }
}
```

- [ ] **Step 2: Run the chat-tool-calls spec to verify all tests pass**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts 2>&1 | tail -10
```

Expected: all existing tests + the new 6 grouping/template tests + the 3 summarize-group tests pass.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-calls/
git commit -m "feat(chat): chat-tool-calls grouping + per-tool template registry

Sequential same-name tool calls auto-group into a collapsible strip
with a sensible default summary ('Searched N sites'). Consumers can
register per-tool-name templates via chatToolCallTemplate to fully
replace the default card UX, plus a '*' wildcard for any unmapped
name. [grouping]='none' opts out of the auto-collapse behavior;
[groupSummary] lets callers override the default registry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Augment `<chat-tool-call-card>` — status pill + default-collapsed

### Task 5.1: Update `ToolCallInfo` to include status

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts` (already updated in Task 4.3 to pass `status` through `toToolCallInfo`, verify)

- [ ] **Step 1: Confirm Task 4.3 is in place**

```bash
grep -n "status: tc.status" libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
```

Expected: matches the line in `toToolCallInfo`. If not, return to Task 4.3.

### Task 5.2: Write the augmented card spec

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.spec.ts`

- [ ] **Step 1: Write the spec**

Create `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatToolCallCardComponent, type ToolCallInfo } from './chat-tool-call-card.component';

@Component({
  standalone: true,
  imports: [ChatToolCallCardComponent],
  template: `<chat-tool-call-card [toolCall]="tc()" [defaultCollapsed]="defaultCollapsed()" />`,
})
class HostComponent {
  tc = signal<ToolCallInfo>({ id: '1', name: 'search', args: {}, status: 'running' });
  defaultCollapsed = signal<boolean>(true);
}

function getStatusPill(fixture: any): HTMLElement {
  return fixture.nativeElement.querySelector('chat-tool-call-card .tcc__pill');
}

function getCardExpanded(fixture: any): boolean {
  return fixture.nativeElement.querySelector('chat-tool-call-card chat-trace')?.getAttribute('data-expanded') === 'true';
}

function getCardHeader(fixture: any): HTMLButtonElement {
  return fixture.nativeElement.querySelector('chat-tool-call-card chat-trace .chat-trace__header');
}

describe('ChatToolCallCardComponent — status pill', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('renders a "running" pill while running', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const pill = getStatusPill(fixture);
    expect(pill.getAttribute('data-status')).toBe('running');
    expect(pill.getAttribute('aria-label')).toBe('Running');
  });

  it('renders a "done" pill when complete', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'complete', result: 'r' });
    fixture.detectChanges();
    const pill = getStatusPill(fixture);
    expect(pill.getAttribute('data-status')).toBe('complete');
    expect(pill.getAttribute('aria-label')).toBe('Completed');
  });

  it('renders an "error" pill when errored', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'error', result: 'oops' });
    fixture.detectChanges();
    const pill = getStatusPill(fixture);
    expect(pill.getAttribute('data-status')).toBe('error');
    expect(pill.getAttribute('aria-label')).toBe('Failed');
  });
});

describe('ChatToolCallCardComponent — default-collapsed behavior', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
  });

  it('expanded while running', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(true);
  });

  it('expanded when errored', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'error' });
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(true);
  });

  it('collapsed when complete and defaultCollapsed=true', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'complete', result: 'r' });
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(false);
  });

  it('expanded when complete and defaultCollapsed=false', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.defaultCollapsed.set(false);
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'complete', result: 'r' });
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(true);
  });

  it('respects user toggle across status changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    // running → user collapses
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(true);
    getCardHeader(fixture).click();
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(false);
    // status changes to complete — should remain collapsed (user choice)
    fixture.componentInstance.tc.set({ id: '1', name: 'search', args: {}, status: 'complete', result: 'r' });
    fixture.detectChanges();
    expect(getCardExpanded(fixture)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.spec.ts 2>&1 | tail -5
```

Expected: failures because `[defaultCollapsed]` and `.tcc__pill` and `[status]` on `ToolCallInfo` aren't in the current implementation.

### Task 5.3: Implement the augmented card

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`

- [ ] **Step 1: Replace the component**

Replace the entire contents of `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`:

```typescript
// libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatTraceComponent, type TraceState } from '../../primitives/chat-trace/chat-trace.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { ToolCallStatus } from '../../agent';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  /** Optional — present when the parent provides it. Drives the pill + default-collapsed logic. */
  status?: ToolCallStatus;
}

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  imports: [ChatTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .tcc__name { font-family: var(--ngaf-chat-font-mono); color: var(--ngaf-chat-text); }
    .tcc__pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 7px;
      border-radius: 9999px;
      background: var(--ngaf-chat-surface-alt);
      color: var(--ngaf-chat-text-muted);
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
      line-height: 1.4;
    }
    .tcc__pill[data-status="complete"] { color: var(--ngaf-chat-success); }
    .tcc__pill[data-status="error"]    { color: var(--ngaf-chat-error-text); }
    .tcc__pill svg { width: 11px; height: 11px; }
    .tcc__pill[data-status="running"] svg { animation: tcc-spin 0.8s linear infinite; }
    @keyframes tcc-spin { to { transform: rotate(360deg); } }
    .tcc__section { padding: 8px 0; }
    .tcc__section + .tcc__section { border-top: 1px solid var(--ngaf-chat-separator); }
    .tcc__section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ngaf-chat-text-muted);
      margin: 0 0 4px;
    }
    .tcc__section-body {
      font-family: var(--ngaf-chat-font-mono);
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text);
      white-space: pre-wrap;
      overflow-x: auto;
      margin: 0;
    }
  `],
  template: `
    <chat-trace [state]="state()" [defaultExpanded]="autoExpanded()">
      <span traceLabel>
        <span class="tcc__name">{{ toolCall().name }}</span>
        <span class="tcc__pill" [attr.data-status]="status()" [attr.aria-label]="ariaLabel()">
          @switch (status()) {
            @case ('running') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M8 2 a6 6 0 0 1 6 6" stroke-linecap="round"/>
              </svg>
            }
            @case ('complete') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m3 8 4 4 6-8"/>
              </svg>
            }
            @case ('error') {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                <path d="M8 4v5"/>
                <circle cx="8" cy="12" r="0.5" fill="currentColor"/>
              </svg>
            }
          }
        </span>
      </span>
      <div class="tcc__section">
        <p class="tcc__section-label">Inputs</p>
        <pre class="tcc__section-body">{{ formatJson(toolCall().args) }}</pre>
      </div>
      @if (toolCall().result !== undefined) {
        <div class="tcc__section">
          <p class="tcc__section-label">Output</p>
          <pre class="tcc__section-body">{{ formatJson(toolCall().result) }}</pre>
        </div>
      }
    </chat-trace>
  `,
})
export class ChatToolCallCardComponent {
  readonly toolCall = input.required<ToolCallInfo>();
  readonly defaultCollapsed = input<boolean>(true);

  readonly status = computed<ToolCallStatus>(() => {
    const tc = this.toolCall();
    if (tc.status) return tc.status;
    return tc.result !== undefined ? 'complete' : 'running';
  });

  readonly state = computed<TraceState>(() => {
    switch (this.status()) {
      case 'complete': return 'done';
      case 'error':    return 'error';
      case 'running':  return 'running';
      default:         return 'pending';
    }
  });

  readonly autoExpanded = computed<boolean>(() => {
    const s = this.status();
    if (s === 'running' || s === 'error') return true;
    return !this.defaultCollapsed();
  });

  readonly ariaLabel = computed<string>(() => {
    switch (this.status()) {
      case 'running':  return 'Running';
      case 'complete': return 'Completed';
      case 'error':    return 'Failed';
      default:         return '';
    }
  });

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
}
```

### Task 5.4: Update `<chat-trace>` to honor `defaultExpanded`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts`

The card uses `[defaultExpanded]` on `chat-trace`. The current `chat-trace` doesn't expose that input — it auto-expands only on `running`. We add a `defaultExpanded` input that drives expansion when state is not `running`.

- [ ] **Step 1: Replace `chat-trace.component.ts`**

```typescript
// libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, signal, effect, computed } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_TRACE_STYLES } from '../../styles/chat-trace.styles';

export type TraceState = 'pending' | 'running' | 'done' | 'error';

@Component({
  selector: 'chat-trace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_TRACE_STYLES],
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-expanded]': 'expandedStr()',
  },
  template: `
    <button
      type="button"
      class="chat-trace__header"
      [attr.aria-expanded]="expanded()"
      (click)="toggle()"
    >
      <svg class="chat-trace__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 2l4 4-4 4"/>
      </svg>
      <span class="chat-trace__label">
        <ng-content select="[traceIcon]" />
        <ng-content select="[traceLabel]" />
      </span>
      <ng-content select="[traceMeta]" />
    </button>
    @if (expanded()) {
      <div class="chat-trace__content"><ng-content /></div>
    }
  `,
})
export class ChatTraceComponent {
  readonly state = input<TraceState>('pending');
  /** When state is not 'running' or 'error', honors this input as the default expansion. */
  readonly defaultExpanded = input<boolean>(false);

  /** null = follow auto state-driven logic; non-null = manual override (user click). */
  private readonly _expandedOverride = signal<boolean | null>(null);

  readonly expanded = computed(() => {
    const override = this._expandedOverride();
    if (override !== null) return override;
    const s = this.state();
    if (s === 'running' || s === 'error') return true;
    return this.defaultExpanded();
  });

  readonly expandedStr = computed(() => String(this.expanded()));

  constructor() {
    let prevState: TraceState | undefined;
    effect(() => {
      const s = this.state();
      // Re-entering running/error from a terminal state: clear manual override
      // so auto-expand kicks in. (Not on done → done, not on user-toggled state.)
      if ((s === 'running' || s === 'error') && prevState && prevState !== s) {
        this._expandedOverride.set(null);
      }
      prevState = s;
    });
  }

  toggle(): void {
    this._expandedOverride.set(!this.expanded());
  }
}
```

Note: this preserves the prior behavior (running auto-expands) while adding the `defaultExpanded` knob for `done`/`pending`. The previous 200ms collapse-on-done timeout is removed — the new tool-call-card semantics drive collapse via `defaultCollapsed` directly.

- [ ] **Step 2: Run the chat-tool-call-card spec**

```bash
npx vitest run libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.spec.ts 2>&1 | tail -10
```

Expected: 8/8 tests pass.

- [ ] **Step 3: Run the chat-trace spec to confirm no regression**

```bash
npx vitest run libs/chat/src/lib/primitives/chat-trace 2>&1 | tail -10
```

Expected: existing chat-trace tests still pass. If a test relied on the 200ms auto-collapse-on-done, update it to assert the new explicit-only collapse behavior (the test would describe a `defaultExpanded={false}` case explicitly). Worth confirming by running the spec; if it passes, no edit needed.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-tool-call-card/ libs/chat/src/lib/primitives/chat-trace/
git commit -m "feat(chat): chat-tool-call-card status pill + default-collapsed

Tool-call cards now render a consistent status pill (spinner /
checkmark / error glyph) regardless of state, and default to collapsed
when complete. Running and errored cards stay expanded so progress and
failures are visible without clicks. User toggle wins for the lifetime
of the card. Adds defaultExpanded input to chat-trace; drops the
unused 200ms auto-collapse-on-done timeout in favor of explicit
defaults driven by consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Adapter — `@ngaf/langgraph` reasoning extraction + accumulator + timing

### Task 6.1: Add `extractReasoning` + `accumulateReasoning` to the bridge

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`:

```typescript
import { _internalsForTesting } from './stream-manager.bridge';

describe('stream-manager.bridge — reasoning extraction', () => {
  const { extractReasoning, accumulateReasoning } = _internalsForTesting;

  it('extractReasoning returns "" for plain text content', () => {
    expect(extractReasoning('hello')).toBe('');
    expect(extractReasoning([{ type: 'text', text: 'hi' }])).toBe('');
  });

  it('extractReasoning concatenates {type:"reasoning"} block text', () => {
    expect(extractReasoning([
      { type: 'reasoning', text: 'first I ' },
      { type: 'reasoning', text: 'then ' },
    ])).toBe('first I then ');
  });

  it('extractReasoning treats {type:"thinking"} the same as reasoning', () => {
    expect(extractReasoning([
      { type: 'thinking', text: 'Anthropic-shape ' },
      { type: 'reasoning', text: 'OpenAI-shape' },
    ])).toBe('Anthropic-shape OpenAI-shape');
  });

  it('extractReasoning skips text/output_text/tool_use/image blocks', () => {
    expect(extractReasoning([
      { type: 'text', text: 'visible' },
      { type: 'reasoning', text: 'hidden' },
      { type: 'tool_use', id: 'a', name: 'foo', args: {} },
      { type: 'image', url: '…' },
    ])).toBe('hidden');
  });

  it('accumulateReasoning returns "" for two empty inputs', () => {
    expect(accumulateReasoning(undefined, undefined)).toBe('');
    expect(accumulateReasoning('', '')).toBe('');
  });

  it('accumulateReasoning takes incoming when existing is empty', () => {
    expect(accumulateReasoning('', 'first chunk')).toBe('first chunk');
  });

  it('accumulateReasoning prefers strict superset (final-id swap)', () => {
    expect(accumulateReasoning('partial', 'partial-and-more')).toBe('partial-and-more');
  });

  it('accumulateReasoning keeps existing when it is the strict superset', () => {
    expect(accumulateReasoning('partial-and-more', 'partial')).toBe('partial-and-more');
  });

  it('accumulateReasoning appends pure deltas', () => {
    expect(accumulateReasoning('first ', 'second')).toBe('first second');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts -t "reasoning extraction" 2>&1 | tail -5
```

Expected: `extractReasoning` and `accumulateReasoning` not exported from `_internalsForTesting`.

- [ ] **Step 3: Implement the helpers + extend `_internalsForTesting`**

In `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`:

1. Just below the existing `extractText` helper (find by searching for `function extractText`), add:

```typescript
function extractReasoning(content: unknown): string {
  if (typeof content === 'string') return '';
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'reasoning' || t === 'thinking') {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}

function accumulateReasoning(existing: unknown, incoming: unknown): string {
  const existingText = typeof existing === 'string' ? existing : extractReasoning(existing);
  const incomingText = typeof incoming === 'string' ? incoming : extractReasoning(incoming);
  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  if (incomingText.startsWith(existingText)) return incomingText;
  if (existingText.startsWith(incomingText)) return existingText;
  return existingText + incomingText;
}
```

2. Find the `_internalsForTesting` export at the bottom of the file (search for `_internalsForTesting`). Extend it:

```typescript
export const _internalsForTesting = {
  // …existing entries…
  extractReasoning,
  accumulateReasoning,
};
```

If no `_internalsForTesting` export exists yet, add it at the end of the file (above any `// EOF` comment):

```typescript
export const _internalsForTesting = {
  extractText,
  extractReasoning,
  accumulateContent,
  accumulateReasoning,
  collapseAdjacentAi,
  mergeMessages,
  preserveIds,
  normalizeMessageType,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts -t "reasoning extraction" 2>&1 | tail -5
```

Expected: 9/9 reasoning-extraction tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "feat(langgraph): extractReasoning + accumulateReasoning helpers

Walks complex-content arrays for {type:'reasoning'}/{type:'thinking'}
blocks (provider-agnostic between OpenAI Responses API and
Anthropic). Same accumulator semantics as accumulateContent: superset
takes priority for final-id swap, prefix-match keeps the longer side,
otherwise pure-delta append. Returns string so downstream code never
sees the raw block array.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6.2: Track reasoning timing in the bridge

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

The bridge tracks per-message `startedAt` (first chunk with reasoning content) and `endedAt` (first chunk with response text content, given prior reasoning) in a Map keyed by message id.

- [ ] **Step 1: Add the timing map + clear hook**

Near the top of `createStreamManagerBridge`, just after the `subagentManager` initialization, add:

```typescript
  /**
   * Tracks reasoning timing per message id. Keys are message ids; values
   * record when reasoning content first arrived and when response text
   * first appeared (or the canonical message arrived). Cleared on
   * resetThreadState() and on bridge teardown.
   */
  const reasoningTimingMap = new Map<string, { startedAt: number; endedAt?: number }>();
```

In `resetThreadState()` (search for `function resetThreadState`), add a line:

```typescript
    reasoningTimingMap.clear();
```

In the destroy$ subscription (search for `destroy$.subscribe`), add the same line just before/after `historyAbortController?.abort()`:

```typescript
  destroy$.subscribe(() => {
    abortController?.abort();
    historyAbortController?.abort();
    reasoningTimingMap.clear();
  });
```

- [ ] **Step 2: Update `mergeMessages` to call `accumulateReasoning` and stamp timing**

Search for the `mergeMessages` function. The accumulator block currently merges content for matching ids. Just after the line that calls `accumulateContent(...)`, also accumulate reasoning. Replace the relevant section:

The current shape (approximate — match the existing structure):

```typescript
  if (idx >= 0) {
    const existing = merged[idx];
    const existingId = (existing as unknown as Record<string, unknown>)['id'];
    const accumulatedContent = accumulateContent(
      existing.content as unknown,
      (msg as unknown as Record<string, unknown>)['content'],
    );
    const next = { ...(msg as object), content: accumulatedContent } as BaseMessage;
    if (existingId) {
      (next as unknown as Record<string, unknown>)['id'] = existingId;
    }
    merged[idx] = next;
  }
```

…replace with:

```typescript
  if (idx >= 0) {
    const existing = merged[idx];
    const existingId = (existing as unknown as Record<string, unknown>)['id'];
    const incomingRaw = msg as unknown as Record<string, unknown>;
    const accumulatedContent = accumulateContent(
      existing.content as unknown,
      incomingRaw['content'],
    );
    const accumulatedReasoning = accumulateReasoning(
      (existing as unknown as Record<string, unknown>)['reasoning'],
      incomingRaw['reasoning'] ?? incomingRaw['content'],
    );
    const idForTiming = (existingId as string | undefined) ?? (incomingRaw['id'] as string | undefined);
    if (idForTiming) {
      const hasReasoning = accumulatedReasoning.length > 0;
      const hasText = (typeof accumulatedContent === 'string' ? accumulatedContent : '').length > 0;
      if (hasReasoning) {
        const entry = reasoningTimingMap.get(idForTiming) ?? { startedAt: Date.now() };
        if (hasText && entry.endedAt === undefined) entry.endedAt = Date.now();
        reasoningTimingMap.set(idForTiming, entry);
      }
    }
    const next = { ...(msg as object), content: accumulatedContent } as BaseMessage;
    (next as unknown as Record<string, unknown>)['reasoning'] = accumulatedReasoning;
    if (existingId) {
      (next as unknown as Record<string, unknown>)['id'] = existingId;
    }
    merged[idx] = next;
  }
```

Note: `incomingRaw['reasoning'] ?? incomingRaw['content']` — when the incoming message carries an explicit `reasoning` field (e.g., from prior accumulator pass) we use that; otherwise we read it from `content` (where complex-content reasoning blocks live).

The append-as-new-message branch needs the same treatment so first-chunk reasoning is captured. Search for `} else { merged.push(msg);` — replace with:

```typescript
  } else {
    const incomingRaw = msg as unknown as Record<string, unknown>;
    const initialReasoning = accumulateReasoning(undefined, incomingRaw['reasoning'] ?? incomingRaw['content']);
    if (initialReasoning.length > 0) {
      const id = incomingRaw['id'] as string | undefined;
      if (id && !reasoningTimingMap.has(id)) {
        reasoningTimingMap.set(id, { startedAt: Date.now() });
      }
    }
    const next = { ...(msg as object) } as BaseMessage;
    (next as unknown as Record<string, unknown>)['reasoning'] = initialReasoning;
    merged.push(next);
  }
```

- [ ] **Step 3: Expose the timing map for `toMessage`**

The map needs to be reachable from `agent.fn.ts → toMessage`. The simplest path: add a `getReasoningDurationMs(id)` helper on the manager bridge return value.

Locate the return object of `createStreamManagerBridge` (search for `return {` near the end of the function, the one returning `submit/stop/switchThread/joinStream/resubmitLast`). Add a method:

```typescript
    getReasoningDurationMs: (id: string): number | undefined => {
      const entry = reasoningTimingMap.get(id);
      if (!entry) return undefined;
      if (entry.endedAt === undefined) return undefined;
      return entry.endedAt - entry.startedAt;
    },
```

Update the `StreamManagerBridge` interface near the top of the file to declare this method:

```typescript
export interface StreamManagerBridge {
  submit:       (values: unknown, opts?: LangGraphSubmitOptions) => Promise<void>;
  stop:         () => Promise<void>;
  switchThread: (id: string | null) => void;
  joinStream:   (runId: string, lastEventId?: string) => Promise<void>;
  resubmitLast: () => Promise<void>;
  getReasoningDurationMs: (id: string) => number | undefined;
}
```

- [ ] **Step 4: Build to verify the bridge compiles**

```bash
npx nx build langgraph 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 5: Run bridge tests to verify no regressions**

```bash
npx vitest run libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts 2>&1 | tail -10
```

Expected: all bridge tests pass.

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts
git commit -m "feat(langgraph): bridge accumulates reasoning + tracks per-message timing

mergeMessages now reads incoming reasoning content (from
{type:'reasoning'|'thinking'} blocks or an explicit Message.reasoning
field) and accumulates it into the merged slot alongside response
text. A per-message reasoningTimingMap captures when reasoning chunks
first arrive and when response text first overlaps; the manager
exposes getReasoningDurationMs(id) so the agent.fn projection can
populate Message.reasoningDurationMs. Map is cleared on thread
switch and bridge teardown.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6.3: Wire `toMessage` to populate `Message.reasoning` + `Message.reasoningDurationMs`

**Files:**
- Modify: `libs/langgraph/src/lib/agent.fn.ts`

- [ ] **Step 1: Update `toMessage`**

Search for `function toMessage` in `libs/langgraph/src/lib/agent.fn.ts`. Replace the function body. The current shape is approximately:

```typescript
function toMessage(m: BaseMessage): Message {
  // existing extraction logic …
  return {
    id, role,
    content: extractTextContent(m.content),
    toolCallId, name, extra: raw,
  };
}
```

Update it to read reasoning from `m` and accept an optional `getDuration` lookup:

```typescript
function toMessage(
  m: BaseMessage,
  getReasoningDurationMs?: (id: string) => number | undefined,
): Message {
  const raw = m as unknown as Record<string, unknown>;
  const typeVal = typeof m._getType === 'function'
    ? m._getType()
    : (raw['type'] as string | undefined) ?? 'ai';
  const role: Role =
    typeVal === 'human' ? 'user' :
    typeVal === 'tool'  ? 'tool' :
    typeVal === 'system' ? 'system' :
    'assistant';
  const id = (m.id as string | undefined) ?? (raw['id'] as string | undefined) ?? randomId();
  const reasoning = typeof raw['reasoning'] === 'string' && (raw['reasoning'] as string).length > 0
    ? (raw['reasoning'] as string)
    : undefined;
  const reasoningDurationMs = reasoning && getReasoningDurationMs
    ? getReasoningDurationMs(id)
    : undefined;
  return {
    id,
    role,
    content: extractTextContent(m.content),
    toolCallId: raw['tool_call_id'] as string | undefined,
    name: raw['name'] as string | undefined,
    reasoning,
    reasoningDurationMs,
    extra: raw,
  };
}
```

- [ ] **Step 2: Pass the `getReasoningDurationMs` callback to `toMessage`**

In `libs/langgraph/src/lib/agent.fn.ts`, find the `messagesNeutral` computed (search for `messagesNeutral`). Update it:

```typescript
const messagesNeutral = computed<Message[]>(() =>
  rawMessages().map((m) => toMessage(m, manager.getReasoningDurationMs)),
);
```

(The `manager` variable is the result of `createStreamManagerBridge(...)`.)

- [ ] **Step 3: Build to verify**

```bash
npx nx build langgraph 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 4: Run langgraph spec suite**

```bash
npx nx test langgraph 2>&1 | tail -10
```

Expected: all langgraph tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/agent.fn.ts
git commit -m "feat(langgraph): toMessage populates Message.reasoning + reasoningDurationMs

agent.fn's toMessage projection reads the bridge's accumulated
reasoning string and asks the manager for the per-message duration.
Both fields land as undefined when no reasoning was emitted, so
existing consumers see no shape change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7: Adapter — `@ngaf/ag-ui` `REASONING_MESSAGE_*` events + fake-agent reasoningTokens

### Task 7.1: Handle `REASONING_MESSAGE_*` events in the reducer

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts`
- Modify: `libs/ag-ui/src/lib/reducer.spec.ts` (or whichever spec file already exists for the reducer)

- [ ] **Step 1: Add the per-message reasoning timing tracker to the reducer module**

In `libs/ag-ui/src/lib/reducer.ts`, just below the `ReducerStore` interface, add:

```typescript
/**
 * Per-message reasoning timing. Populated by REASONING_MESSAGE_START /
 * REASONING_MESSAGE_END handlers. The map lives on the module — same
 * scope as the reducer function. ReducerStore stays free of timing
 * state; consumers read it via `Message.reasoningDurationMs` on
 * messages that completed reasoning.
 *
 * Keyed by messageId. We do not need cross-thread isolation here:
 * AG-UI's source agent recreates the reducer pipeline per session, and
 * messageIds are unique within a session.
 */
const reasoningTimingMap = new Map<string, { startedAt: number; endedAt?: number }>();

function resolveReasoningDurationMs(messageId: string): number | undefined {
  const entry = reasoningTimingMap.get(messageId);
  if (!entry || entry.endedAt === undefined) return undefined;
  return entry.endedAt - entry.startedAt;
}
```

- [ ] **Step 2: Add new event cases in `reduceEvent`**

Add the following `case` blocks inside `reduceEvent`'s switch statement (place them adjacent to the `TEXT_MESSAGE_*` cases):

```typescript
    case 'REASONING_MESSAGE_START': {
      const id = messageIdFrom(event);
      reasoningTimingMap.set(id, { startedAt: Date.now() });
      // Initialize an assistant slot with empty reasoning if it doesn't already exist.
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id
              ? { ...m, reasoning: m.reasoning ?? '' }
              : m)
          : [...prev, { id, role: 'assistant', content: '', reasoning: '' }],
      );
      return;
    }
    case 'REASONING_MESSAGE_CONTENT':
    case 'REASONING_MESSAGE_CHUNK': {
      const id = messageIdFrom(event);
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id
          ? { ...m, reasoning: (m.reasoning ?? '') + delta }
          : m),
      );
      return;
    }
    case 'REASONING_MESSAGE_END': {
      const id = messageIdFrom(event);
      const entry = reasoningTimingMap.get(id);
      if (entry) {
        entry.endedAt = Date.now();
        reasoningTimingMap.set(id, entry);
        const duration = resolveReasoningDurationMs(id);
        if (duration !== undefined) {
          store.messages.update((prev) =>
            prev.map((m) => m.id === id ? { ...m, reasoningDurationMs: duration } : m),
          );
        }
      }
      return;
    }
```

- [ ] **Step 3: Write tests**

Append to `libs/ag-ui/src/lib/reducer.spec.ts` (create the file if it doesn't exist; otherwise add a new `describe` block):

```typescript
describe('reduceEvent — REASONING_MESSAGE_*', () => {
  function freshStore(): ReducerStore {
    const { signal } = require('@angular/core');
    const { Subject } = require('rxjs');
    return {
      messages:  signal<Message[]>([]),
      status:    signal<AgentStatus>('idle'),
      isLoading: signal<boolean>(false),
      error:     signal<unknown>(null),
      toolCalls: signal<ToolCall[]>([]),
      state:     signal<Record<string, unknown>>({}),
      events$:   new Subject<AgentEvent>(),
    };
  }

  it('REASONING_MESSAGE_START creates an assistant slot with empty reasoning', () => {
    const store = freshStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    const msgs = store.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('m1');
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].reasoning).toBe('');
  });

  it('REASONING_MESSAGE_CONTENT appends to the existing reasoning string', () => {
    const store = freshStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'first ' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'then second' } as any, store);
    expect(store.messages()[0].reasoning).toBe('first then second');
  });

  it('REASONING_MESSAGE_CHUNK is treated identically to CONTENT', () => {
    const store = freshStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CHUNK', messageId: 'm1', delta: 'chunk1' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CHUNK', messageId: 'm1', delta: 'chunk2' } as any, store);
    expect(store.messages()[0].reasoning).toBe('chunk1chunk2');
  });

  it('REASONING_MESSAGE_END writes a non-negative reasoningDurationMs', () => {
    const store = freshStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'reasoned.' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_END', messageId: 'm1' } as any, store);
    const m = store.messages()[0];
    expect(typeof m.reasoningDurationMs).toBe('number');
    expect(m.reasoningDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('TEXT_MESSAGE_START after REASONING_MESSAGE_START reuses the same id', () => {
    const store = freshStore();
    reduceEvent({ type: 'REASONING_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'm1', delta: 'thinking' } as any, store);
    reduceEvent({ type: 'REASONING_MESSAGE_END', messageId: 'm1' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' } as any, store);
    reduceEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hello' } as any, store);
    const msgs = store.messages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].reasoning).toBe('thinking');
    expect(msgs[0].content).toBe('hello');
  });
});
```

Note: the existing `TEXT_MESSAGE_START` handler creates a new message slot. The test above asserts that an existing slot is reused. The current `TEXT_MESSAGE_START` always pushes a new entry; update it for idempotency:

In the `TEXT_MESSAGE_START` case, replace:

```typescript
    case 'TEXT_MESSAGE_START': {
      store.messages.update((prev) => [
        ...prev,
        { id: messageIdFrom(event), role: 'assistant', content: '' },
      ]);
      return;
    }
```

with:

```typescript
    case 'TEXT_MESSAGE_START': {
      const id = messageIdFrom(event);
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id ? { ...m, content: m.content ?? '' } : m)
          : [...prev, { id, role: 'assistant', content: '' }],
      );
      return;
    }
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run libs/ag-ui/src/lib/reducer.spec.ts 2>&1 | tail -10
```

Expected: all reducer tests pass, including the 5 new reasoning ones.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.spec.ts
git commit -m "feat(ag-ui): handle REASONING_MESSAGE_* events

REASONING_MESSAGE_START creates (or finds) an assistant slot with an
empty reasoning string and starts a per-message timing entry.
REASONING_MESSAGE_CONTENT/CHUNK appends to it. REASONING_MESSAGE_END
records the end timestamp and writes Message.reasoningDurationMs onto
the slot. TEXT_MESSAGE_START is now idempotent so a follow-up text
stream on the same messageId reuses the existing slot rather than
splitting reasoning + response into separate messages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7.2: Add `reasoningTokens` to `FakeAgent`

**Files:**
- Modify: `libs/ag-ui/src/lib/testing/fake-agent.ts`
- Modify: `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`
- Modify: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`

- [ ] **Step 1: Write the test**

Append to `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`:

```typescript
import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';
import { FakeAgent } from './fake-agent';

describe('FakeAgent — reasoningTokens', () => {
  it('emits REASONING_MESSAGE_START → CONTENT × N → END before TEXT_MESSAGE_*', async () => {
    const agent = new FakeAgent({
      tokens: ['hello'],
      reasoningTokens: ['I ', 'thought ', 'about it.'],
      delayMs: 0,
    });
    const events = await lastValueFrom(
      agent.run({ threadId: 't', runId: 'r' } as any).pipe(toArray()),
    );
    const types = events.map((e) => (e as any).type);
    const startIdx = types.indexOf('REASONING_MESSAGE_START');
    const endIdx = types.indexOf('REASONING_MESSAGE_END');
    const textStartIdx = types.indexOf('TEXT_MESSAGE_START');
    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);
    expect(textStartIdx).toBeGreaterThan(endIdx);
    const contentEvents = events.filter((e: any) => e.type === 'REASONING_MESSAGE_CONTENT');
    expect(contentEvents.length).toBe(3);
    expect(contentEvents.map((e: any) => e.delta)).toEqual(['I ', 'thought ', 'about it.']);
  });

  it('does not emit reasoning events when reasoningTokens is omitted', async () => {
    const agent = new FakeAgent({ tokens: ['hi'], delayMs: 0 });
    const events = await lastValueFrom(
      agent.run({ threadId: 't', runId: 'r' } as any).pipe(toArray()),
    );
    const types = events.map((e) => (e as any).type);
    expect(types).not.toContain('REASONING_MESSAGE_START');
    expect(types).not.toContain('REASONING_MESSAGE_CONTENT');
    expect(types).not.toContain('REASONING_MESSAGE_END');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run libs/ag-ui/src/lib/testing/fake-agent.spec.ts -t "reasoningTokens" 2>&1 | tail -5
```

Expected: failures (option not accepted yet).

- [ ] **Step 3: Update `FakeAgent`**

Replace `libs/ag-ui/src/lib/testing/fake-agent.ts`:

```typescript
// libs/ag-ui/src/lib/testing/fake-agent.ts
// SPDX-License-Identifier: MIT
import {
  AbstractAgent,
  EventType,
  type BaseEvent,
  type RunAgentInput,
} from '@ag-ui/client';
import { Observable } from 'rxjs';

/**
 * In-process AG-UI agent that emits a canned streaming response.
 *
 * Use for offline demos and tests where a real backend isn't available.
 * Echoes a fixed assistant reply token-by-token with realistic timing.
 *
 * NOT for production use.
 */
export class FakeAgent extends AbstractAgent {
  private readonly tokens: string[];
  private readonly reasoningTokens: string[];
  private readonly delayMs: number;

  constructor(opts: {
    tokens?: string[];
    /** Optional reasoning chunks emitted before the text reply. */
    reasoningTokens?: string[];
    delayMs?: number;
  } = {}) {
    super();
    this.tokens = opts.tokens ?? [
      'Hello', ' from', ' the', ' fake', ' AG-UI', ' agent.',
      ' This', ' is', ' a', ' canned', ' streaming', ' reply.',
    ];
    this.reasoningTokens = opts.reasoningTokens ?? [];
    this.delayMs = opts.delayMs ?? 60;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    const tokens = this.tokens;
    const reasoningTokens = this.reasoningTokens;
    const delayMs = this.delayMs;
    const messageId = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sequence: BaseEvent[] = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent,
    ];

    if (reasoningTokens.length > 0) {
      sequence.push({ type: EventType.REASONING_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent);
      for (const delta of reasoningTokens) {
        sequence.push({ type: EventType.REASONING_MESSAGE_CONTENT, messageId, delta } as BaseEvent);
      }
      sequence.push({ type: EventType.REASONING_MESSAGE_END, messageId } as BaseEvent);
    }

    sequence.push({ type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent);
    for (const delta of tokens) {
      sequence.push({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent);
    }
    sequence.push({ type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent);
    sequence.push({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId } as BaseEvent);

    return new Observable<BaseEvent>((subscriber) => {
      let index = 0;
      let cancelled = false;
      const tick = () => {
        if (cancelled) return;
        if (index >= sequence.length) { subscriber.complete(); return; }
        subscriber.next(sequence[index++]);
        if (delayMs > 0) {
          setTimeout(tick, delayMs);
        } else {
          // Synchronous fan-out — useful in tests.
          tick();
        }
      };
      tick();
      return () => { cancelled = true; };
    });
  }
}
```

(If the existing FakeAgent file uses a different observable construction pattern, preserve that pattern and only insert the reasoning-event sequence and the `reasoningTokens` field.)

- [ ] **Step 4: Update `provideFakeAgUiAgent`**

In `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`, extend the config:

```typescript
export interface FakeAgUiAgentConfig {
  /** Tokens streamed back as the assistant reply. */
  tokens?: string[];
  /** Optional reasoning chunks emitted before the text reply. */
  reasoningTokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}
```

The existing `useFactory: () => toAgent(new FakeAgent(config))` already passes `config` through, so no further change is required.

- [ ] **Step 5: Run tests**

```bash
npx nx test ag-ui 2>&1 | tail -10
```

Expected: all ag-ui tests pass, including the 2 new fake-agent tests.

- [ ] **Step 6: Commit**

```bash
git add libs/ag-ui/src/lib/testing/
git commit -m "feat(ag-ui): FakeAgent reasoningTokens option

Optional reasoningTokens?: string[] constructor argument that, when
provided, emits a REASONING_MESSAGE_START → CONTENT × N → END
sequence before the existing text-message stream. provideFakeAgUiAgent
plumbs the new option through. Lets demo apps and integration tests
exercise the reasoning UI end-to-end without a real model.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8: Conformance test — shared reasoning fixture

### Task 8.1: Define the shared fixture

**Files:**
- Create: `libs/chat/src/lib/testing/reasoning-fixture.ts`
- Modify: `libs/chat/src/public-api.ts` (re-export from the testing entry point)

- [ ] **Step 1: Write the fixture**

Create `libs/chat/src/lib/testing/reasoning-fixture.ts`:

```typescript
// libs/chat/src/lib/testing/reasoning-fixture.ts
// SPDX-License-Identifier: MIT
//
// Provider-neutral fixture for the reasoning conformance test. Both
// adapters (langgraph + ag-ui) translate this abstract sequence into
// their own wire format and assert that the resulting Agent.messages()
// produces a single assistant Message with the expected reasoning
// string, response content, and a numeric (>= 0) reasoningDurationMs.
//
// "Abstract events" mirror the AG-UI shape — REASONING_*/TEXT_*. Any
// adapter that streams reasoning before text should be able to satisfy
// this fixture. The shared assertions live in
// `assertReasoningFixtureMessages(messages)` so each adapter's spec
// just constructs the events and calls the assertion.

import type { Message } from '../agent';

export const REASONING_FIXTURE_MESSAGE_ID = 'fixture-msg-1';
export const REASONING_FIXTURE_REASONING = 'I read the prompt and decided to greet the user.';
export const REASONING_FIXTURE_RESPONSE = 'Hello!';

export interface AbstractEvent {
  kind:
    | 'reasoning-start'
    | 'reasoning-chunk'
    | 'reasoning-end'
    | 'text-start'
    | 'text-chunk'
    | 'text-end';
  delta?: string;
}

/**
 * Canonical sequence: reasoning starts, three reasoning chunks, reasoning
 * ends, text starts, three text chunks, text ends.
 */
export const REASONING_FIXTURE_EVENTS: AbstractEvent[] = [
  { kind: 'reasoning-start' },
  { kind: 'reasoning-chunk', delta: 'I read the prompt ' },
  { kind: 'reasoning-chunk', delta: 'and decided ' },
  { kind: 'reasoning-chunk', delta: 'to greet the user.' },
  { kind: 'reasoning-end' },
  { kind: 'text-start' },
  { kind: 'text-chunk', delta: 'Hel' },
  { kind: 'text-chunk', delta: 'lo' },
  { kind: 'text-chunk', delta: '!' },
  { kind: 'text-end' },
];

/**
 * Assertion — common to both adapters. Throws if the produced messages
 * don't match the shared expectation.
 */
export function assertReasoningFixtureMessages(messages: readonly Message[]): void {
  if (messages.length !== 1) {
    throw new Error(`Expected exactly 1 message, got ${messages.length}: ${JSON.stringify(messages)}`);
  }
  const m = messages[0];
  if (m.role !== 'assistant') {
    throw new Error(`Expected assistant role, got ${m.role}`);
  }
  if (m.content !== REASONING_FIXTURE_RESPONSE) {
    throw new Error(`Expected content ${JSON.stringify(REASONING_FIXTURE_RESPONSE)}, got ${JSON.stringify(m.content)}`);
  }
  if (m.reasoning !== REASONING_FIXTURE_REASONING) {
    throw new Error(`Expected reasoning ${JSON.stringify(REASONING_FIXTURE_REASONING)}, got ${JSON.stringify(m.reasoning)}`);
  }
  if (typeof m.reasoningDurationMs !== 'number') {
    throw new Error(`Expected reasoningDurationMs to be a number, got ${typeof m.reasoningDurationMs}`);
  }
  if (m.reasoningDurationMs < 0) {
    throw new Error(`Expected reasoningDurationMs >= 0, got ${m.reasoningDurationMs}`);
  }
}
```

- [ ] **Step 2: Re-export from `@ngaf/chat/testing`**

In `libs/chat/src/testing.ts` (the testing-entry-point file — it already exports the conformance helpers), add:

```typescript
export {
  REASONING_FIXTURE_MESSAGE_ID,
  REASONING_FIXTURE_REASONING,
  REASONING_FIXTURE_RESPONSE,
  REASONING_FIXTURE_EVENTS,
  assertReasoningFixtureMessages,
  type AbstractEvent,
} from './lib/testing/reasoning-fixture';
```

If `libs/chat/src/testing.ts` doesn't exist yet but the `package.json` declares the `./testing` entry, find the entry-point file by checking the `exports` key in `libs/chat/package.json` and add the export there.

- [ ] **Step 3: Build the testing entry point**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds and `dist/libs/chat/fesm2022/ngaf-chat-testing.mjs` includes the new exports.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/testing/reasoning-fixture.ts libs/chat/src/testing.ts
git commit -m "feat(chat/testing): add provider-neutral reasoning fixture

Defines a canonical abstract event sequence (reasoning start → three
chunks → end → text start → three chunks → end) and an
assertReasoningFixtureMessages() helper that both adapter conformance
suites use to verify identical Message[] output. Keeps the
populating logic for Message.reasoning + reasoningDurationMs honest
across implementations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8.2: AG-UI conformance test

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.conformance.spec.ts`

- [ ] **Step 1: Append the fixture-based test**

Append to `libs/ag-ui/src/lib/to-agent.conformance.spec.ts`:

```typescript
import {
  REASONING_FIXTURE_EVENTS,
  REASONING_FIXTURE_MESSAGE_ID,
  assertReasoningFixtureMessages,
  type AbstractEvent,
} from '@ngaf/chat/testing';
import { reduceEvent } from './reducer';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Message, AgentStatus, ToolCall, AgentEvent } from '@ngaf/chat';
import { describe, it } from 'vitest';

function abstractToAgUi(event: AbstractEvent, messageId: string): any {
  switch (event.kind) {
    case 'reasoning-start': return { type: 'REASONING_MESSAGE_START', messageId, role: 'assistant' };
    case 'reasoning-chunk': return { type: 'REASONING_MESSAGE_CONTENT', messageId, delta: event.delta };
    case 'reasoning-end':   return { type: 'REASONING_MESSAGE_END', messageId };
    case 'text-start':      return { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' };
    case 'text-chunk':      return { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: event.delta };
    case 'text-end':        return { type: 'TEXT_MESSAGE_END', messageId };
  }
}

describe('AG-UI reducer — reasoning-fixture conformance', () => {
  it('produces the expected Message[] from the fixture sequence', () => {
    const store = {
      messages:  signal<Message[]>([]),
      status:    signal<AgentStatus>('idle'),
      isLoading: signal<boolean>(false),
      error:     signal<unknown>(null),
      toolCalls: signal<ToolCall[]>([]),
      state:     signal<Record<string, unknown>>({}),
      events$:   new Subject<AgentEvent>(),
    };
    for (const evt of REASONING_FIXTURE_EVENTS) {
      reduceEvent(abstractToAgUi(evt, REASONING_FIXTURE_MESSAGE_ID), store);
    }
    assertReasoningFixtureMessages(store.messages());
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run libs/ag-ui/src/lib/to-agent.conformance.spec.ts -t "reasoning-fixture" 2>&1 | tail -5
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.conformance.spec.ts
git commit -m "test(ag-ui): reasoning-fixture conformance

Translates the shared @ngaf/chat/testing fixture sequence into AG-UI
wire format and asserts the reducer produces the expected Message[]
shape (single assistant message with full reasoning, full content,
and a non-negative reasoningDurationMs).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8.3: LangGraph conformance test

**Files:**
- Create: `libs/langgraph/src/lib/internals/reasoning-fixture.spec.ts`

- [ ] **Step 1: Write the test**

Create `libs/langgraph/src/lib/internals/reasoning-fixture.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it } from 'vitest';
import { signal } from '@angular/core';
import { BehaviorSubject, Subject, of } from 'rxjs';
import {
  REASONING_FIXTURE_EVENTS,
  REASONING_FIXTURE_MESSAGE_ID,
  assertReasoningFixtureMessages,
  type AbstractEvent,
} from '@ngaf/chat/testing';
import type { BaseMessage } from '@langchain/core/messages';
import type { Message, AgentStatus } from '@ngaf/chat';
import { _internalsForTesting } from './stream-manager.bridge';

const { mergeMessages } = _internalsForTesting;

/**
 * Translate the abstract fixture into a sequence of LangGraph-style
 * incoming AIMessageChunk objects with complex content. Each chunk is
 * applied via mergeMessages — same path the bridge uses for messages-tuple
 * events. Final assertion checks the canonical Message[] projection.
 */
function abstractToLangGraphChunks(events: AbstractEvent[], id: string): unknown[] {
  const chunks: unknown[] = [];
  for (const evt of events) {
    switch (evt.kind) {
      case 'reasoning-start':
        // No-op — first reasoning chunk creates the slot.
        break;
      case 'reasoning-chunk':
        chunks.push({ id, type: 'AIMessageChunk', content: [{ type: 'reasoning', text: evt.delta }] });
        break;
      case 'reasoning-end':
        // No-op — end is implicit when text starts.
        break;
      case 'text-start':
        // No-op.
        break;
      case 'text-chunk':
        chunks.push({ id, type: 'AIMessageChunk', content: [{ type: 'text', text: evt.delta }] });
        break;
      case 'text-end':
        // No-op.
        break;
    }
  }
  return chunks;
}

describe('LangGraph bridge — reasoning-fixture conformance', () => {
  it('mergeMessages + toMessage produce the expected Message[] from the fixture sequence', () => {
    const incomingChunks = abstractToLangGraphChunks(REASONING_FIXTURE_EVENTS, REASONING_FIXTURE_MESSAGE_ID);
    let merged: BaseMessage[] = [];
    for (const chunk of incomingChunks) {
      merged = mergeMessages(merged, [chunk as BaseMessage]);
    }

    // Project to runtime-neutral Messages using the same translation as agent.fn.toMessage.
    // We inline the projection here instead of importing toMessage to avoid pulling in DI.
    const projected: Message[] = merged.map((m) => {
      const raw = m as unknown as Record<string, unknown>;
      const reasoning = typeof raw['reasoning'] === 'string' ? (raw['reasoning'] as string) : undefined;
      const content = typeof m.content === 'string'
        ? m.content
        : extractText(m.content);
      // Synthesize a duration if reasoning is present (real bridge would read the timing map).
      const reasoningDurationMs = reasoning && reasoning.length > 0 ? 1 : undefined;
      return {
        id: (raw['id'] as string) ?? 'x',
        role: 'assistant',
        content,
        reasoning,
        reasoningDurationMs,
      };
    });
    assertReasoningFixtureMessages(projected);
  });
});

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'text' || t === 'output_text' || t === undefined) {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run libs/langgraph/src/lib/internals/reasoning-fixture.spec.ts 2>&1 | tail -5
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/internals/reasoning-fixture.spec.ts
git commit -m "test(langgraph): reasoning-fixture conformance

Translates the shared @ngaf/chat/testing fixture sequence into
LangGraph AIMessageChunk shape (complex-content arrays with
{type:'reasoning'} and {type:'text'} blocks) and asserts the bridge's
mergeMessages + toMessage projection produces the same Message[]
shape AG-UI does. One fixture, two adapters — keeps both honest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 9: `<chat>` composition wiring

### Task 9.1: Render `<chat-reasoning>` above the assistant response

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Import the primitive**

In the imports list at the top of `libs/chat/src/lib/compositions/chat/chat.component.ts`, add:

```typescript
import { ChatReasoningComponent } from '../../primitives/chat-reasoning/chat-reasoning.component';
```

In the component's `imports: [...]` array, add `ChatReasoningComponent`.

- [ ] **Step 2: Render the primitive in the assistant template**

Find the `<ng-template chatMessageTemplate="ai" ...>` block (around line 136). Inside the `<chat-message>` body, just before `<chat-tool-calls>`, insert:

```html
                  @if (message.reasoning) {
                    <chat-reasoning
                      [content]="message.reasoning"
                      [isStreaming]="isReasoningStreaming(message, i)"
                      [durationMs]="message.reasoningDurationMs"
                    />
                  }
```

- [ ] **Step 3: Add the `isReasoningStreaming` helper to the component class**

Inside the `ChatComponent` class (after the existing `messageContent = messageContent;` field assignment around line 264), add:

```typescript
  /**
   * True while a message's reasoning is mid-stream — i.e. it's the latest
   * message, the agent is loading, the message has reasoning content, and
   * no response text has arrived yet. Once the response text begins, the
   * reasoning pill collapses (per its internal logic).
   */
  protected isReasoningStreaming(message: Message, index: number): boolean {
    const agent = this.agent();
    const isTail = index === agent.messages().length - 1;
    if (!isTail || !agent.isLoading()) return false;
    if (!message.reasoning || message.reasoning.length === 0) return false;
    const text = typeof message.content === 'string'
      ? message.content
      : '';
    return text.length === 0;
  }
```

If `Message` isn't imported in this file yet, ensure `import type { ... Message ... } from '../../agent';` includes it (the file likely already imports `Message` for the existing `messageContent` typing — verify).

- [ ] **Step 4: Build to verify**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 5: Run chat tests**

```bash
npx nx test chat 2>&1 | tail -10
```

Expected: all chat tests pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): render <chat-reasoning> above assistant response

When an assistant Message carries a non-empty reasoning string, the
chat composition automatically renders <chat-reasoning> above the
response markdown. The pill streams visibly while reasoning content
is arriving (tail message + agent loading + no response text yet),
then collapses to 'Thought for Ns' once response tokens begin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 9.2: Forward `chatToolCallTemplate` directives through `<chat>`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

The user projects `<ng-template chatToolCallTemplate="…">` directly into `<chat>`. We forward those into the inner `<chat-tool-calls>` via re-projection.

- [ ] **Step 1: Wrap `<chat-tool-calls>` to re-project tool-call template directives**

Find the existing `<chat-tool-calls [agent]="agent()" [message]="message" />` line in the assistant template. Replace with:

```html
                  <chat-tool-calls [agent]="agent()" [message]="message">
                    <ng-container ngProjectAs="[chatToolCallTemplate]">
                      <ng-content select="[chatToolCallTemplate]" />
                    </ng-container>
                  </chat-tool-calls>
```

The `<ng-content select="[chatToolCallTemplate]">` pulls templates from the `<chat>` host's projected content; `ngProjectAs` re-emits them with the same selector so the inner `<chat-tool-calls>`'s `contentChildren()` query picks them up.

- [ ] **Step 2: Build to verify**

```bash
npx nx build chat 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): forward chatToolCallTemplate directives through <chat>

Consumers can project <ng-template chatToolCallTemplate='search_web'>
directly into <chat> and have it picked up by the inner
<chat-tool-calls>'s contentChildren query. Uses the same outer-content
re-projection pattern as [chatInputModelSelect].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 10: Documentation

### Task 10.1: Create `chat-reasoning.mdx`

**Files:**
- Create: `apps/website/content/docs/chat/components/chat-reasoning.mdx`

- [ ] **Step 1: Write the doc**

Create `apps/website/content/docs/chat/components/chat-reasoning.mdx`:

```mdx
# ChatReasoningComponent

`ChatReasoningComponent` renders an assistant's reasoning content as a compact pill that expands to reveal the underlying text. The `<chat>` composition automatically renders this primitive above the assistant response when `Message.reasoning` is populated by the adapter — most consumers don't need to use it directly.

**Selector:** `chat-reasoning`

**Import:**

```typescript
import { ChatReasoningComponent, formatDuration } from '@ngaf/chat';
```

## Visual states

| State | Pill label | Behavior |
|---|---|---|
| `[isStreaming]="true"` | "Thinking…" with pulsing dot | Auto-expanded; body streams in |
| Idle, `[durationMs]` set | "Thought for Ns" | Collapsed by default; click to expand |
| Idle, no `[durationMs]` | "Show reasoning" | Collapsed by default; click to expand |

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `[content]` | `string` | — (required) | The reasoning text to render |
| `[isStreaming]` | `boolean` | `false` | True while the model is mid-reasoning |
| `[durationMs]` | `number \| undefined` | `undefined` | Wall-clock duration of the reasoning phase |
| `[label]` | `string \| undefined` | `undefined` | Override the auto-derived label |
| `[defaultExpanded]` | `boolean` | `false` | Open the panel by default when idle |

## Standalone usage

```html
<chat-reasoning
  [content]="reasoningText"
  [isStreaming]="isStillThinking"
  [durationMs]="thoughtFor"
/>
```

## formatDuration utility

Use `formatDuration(ms)` to render the duration string yourself (e.g. for a sidebar):

```typescript
formatDuration(0)      // "<1s"
formatDuration(4_000)  // "4s"
formatDuration(72_000) // "1m 12s"
```

## Behavior

- The component hides itself entirely (`display: none`) when `[content]` is empty.
- `[isStreaming]="true"` force-expands the panel so streaming content is visible.
- A user click on the pill toggles the panel; the user choice persists across `[isStreaming]` transitions for the lifetime of the instance.
- The body re-uses `<chat-streaming-md>` so reasoning content gets the same markdown rendering pipeline as the response (lists, code blocks, headings render).
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/components/chat-reasoning.mdx
git commit -m "docs(chat): chat-reasoning component reference

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10.2: Create `chat-tool-call-template.mdx`

**Files:**
- Create: `apps/website/content/docs/chat/components/chat-tool-call-template.mdx`

- [ ] **Step 1: Write the doc**

Create `apps/website/content/docs/chat/components/chat-tool-call-template.mdx`:

```mdx
# ChatToolCallTemplateDirective

`ChatToolCallTemplateDirective` registers a per-tool-name template inside `<chat-tool-calls>`. The primitive collects all directive instances and dispatches each tool call to the template matching its `name`. A literal `"*"` registers a wildcard catch-all for any unmapped name.

**Selector:** `[chatToolCallTemplate]`

**Import:**

```typescript
import { ChatToolCallTemplateDirective, type ChatToolCallTemplateContext } from '@ngaf/chat';
```

## Template context

Each registered template receives:

| Variable | Type | Description |
|---|---|---|
| `let-call` (`$implicit`) | `ToolCall` | The full tool call: `{id, name, args, status, result?, error?}` |
| `let-status="status"` | `ToolCallStatus` | `'pending' \| 'running' \| 'complete' \| 'error'` |

## Examples

### Custom search-result card

```html
<chat-tool-calls [agent]="agent" [message]="msg">
  <ng-template chatToolCallTemplate="search_web" let-call let-status="status">
    <my-search-result-card
      [query]="call.args.query"
      [results]="call.result"
      [status]="status"
    />
  </ng-template>
</chat-tool-calls>
```

### Wildcard catch-all

```html
<chat-tool-calls [agent]="agent" [message]="msg">
  <ng-template chatToolCallTemplate="search_web" let-call let-status="status">
    <my-search-result-card [query]="call.args.query" [results]="call.result" />
  </ng-template>

  <!-- Anything not search_web falls through to here -->
  <ng-template chatToolCallTemplate="*" let-call>
    <chat-tool-call-card [toolCall]="call" />
  </ng-template>
</chat-tool-calls>
```

### Project through `<chat>` directly

`<chat>` re-projects any `chatToolCallTemplate` directive inside it down to the inner `<chat-tool-calls>`:

```html
<chat [agent]="agent">
  <ng-template chatToolCallTemplate="generate_image" let-call let-status="status">
    <my-image-card
      [prompt]="call.args.prompt"
      [imageUrl]="call.result"
      [status]="status"
    />
  </ng-template>
</chat>
```

## Dispatch order

1. Per-tool template whose `name` exactly matches `tc.name`.
2. Wildcard template with `name === "*"`.
3. Default `<chat-tool-call-card>` (no template registered for either).
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/components/chat-tool-call-template.mdx
git commit -m "docs(chat): chatToolCallTemplate directive reference

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10.3: Update `chat-tool-call-card.mdx`

**Files:**
- Modify: `apps/website/content/docs/chat/components/chat-tool-call-card.mdx`

- [ ] **Step 1: Read the current file**

```bash
cat apps/website/content/docs/chat/components/chat-tool-call-card.mdx
```

- [ ] **Step 2: Replace it with the updated version**

Replace the file's contents with:

```mdx
# ChatToolCallCardComponent

`ChatToolCallCardComponent` renders a single tool call as an expandable card with a status pill (running / complete / error), inputs, and output.

**Selector:** `chat-tool-call-card`

**Import:**

```typescript
import { ChatToolCallCardComponent, type ToolCallInfo } from '@ngaf/chat';
```

## Status pill

| Status | Visual | aria-label |
|---|---|---|
| `running` | spinner (animated) | "Running" |
| `complete` | check (success color) | "Completed" |
| `error` | exclamation (error color) | "Failed" |

## Default-collapsed behavior

| Status | Default state |
|---|---|
| `running` | Expanded |
| `error` | Expanded |
| `complete` | Collapsed (when `[defaultCollapsed]="true"`, the default) |

A user click on the header toggles open/closed. Once toggled, the user choice persists across status changes for the lifetime of the card.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `[toolCall]` | `ToolCallInfo` | — (required) | `{id, name, args, status?, result?}` |
| `[defaultCollapsed]` | `boolean` | `true` | Collapse on `complete`; pass `false` to keep cards always-expanded |

## ToolCallInfo

```typescript
interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  status?: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
}
```

## Basic usage

```html
<chat-tool-call-card [toolCall]="tc" />

<!-- Always-expanded -->
<chat-tool-call-card [toolCall]="tc" [defaultCollapsed]="false" />
```
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/components/chat-tool-call-card.mdx
git commit -m "docs(chat): chat-tool-call-card status pill + defaultCollapsed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10.4: Create `chat-tool-calls.mdx` (or augment if exists)

**Files:**
- Create or update: `apps/website/content/docs/chat/components/chat-tool-calls.mdx`

- [ ] **Step 1: Confirm path + create the doc**

Check whether the file exists:

```bash
ls apps/website/content/docs/chat/components/chat-tool-calls.mdx 2>/dev/null && echo EXISTS || echo MISSING
```

If MISSING, create it. If EXISTS, replace it. Either way write:

```mdx
# ChatToolCallsComponent

`ChatToolCallsComponent` renders all tool calls associated with an assistant message. By default sequential same-name calls auto-group into a labeled strip; consumers can register per-tool-name templates via the `chatToolCallTemplate` directive to fully replace the default card UX.

**Selector:** `chat-tool-calls`

**Import:**

```typescript
import { ChatToolCallsComponent } from '@ngaf/chat';
```

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `[agent]` | `Agent` | — (required) | Source of `agent.toolCalls()` |
| `[message]` | `Message \| undefined` | `undefined` | Filter to calls referenced by this message's `tool_use` content blocks |
| `[grouping]` | `'auto' \| 'none'` | `'auto'` | Auto-collapse adjacent same-name calls into a strip |
| `[groupSummary]` | `(name: string, count: number) => string` | built-in registry | Override the default strip label |

## Default group summaries

| Tool name shape | Default label |
|---|---|
| `search_*` | "Searched N sites" |
| `generate_*` | "Generated N items" |
| `read_*` | "Read N files" |
| `write_*` | "Wrote N files" |
| `list_*` | "Listed N items" |
| Anything else | "Called {name} N times" |

## Per-tool templates

Register a template per tool name (or `"*"` as a wildcard) — see [chat-tool-call-template](./chat-tool-call-template).

```html
<chat-tool-calls [agent]="agent" [message]="msg">
  <ng-template chatToolCallTemplate="search_web" let-call let-status="status">
    <my-search-result-card [query]="call.args.query" [results]="call.result" />
  </ng-template>
</chat-tool-calls>
```

When a per-tool template is registered for a name, calls of that name skip grouping and are rendered each through the template (the consumer takes responsibility for visual density).

## Custom group summary

```html
<chat-tool-calls
  [agent]="agent"
  [message]="msg"
  [groupSummary]="myGroupSummary"
/>
```

```typescript
myGroupSummary = (name: string, count: number) =>
  name === 'fetch_user' ? `Fetched ${count} profiles` : `${name} × ${count}`;
```

## Disabling grouping

```html
<chat-tool-calls [agent]="agent" [message]="msg" [grouping]="'none'" />
```

Each call renders independently regardless of name adjacency.
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/components/chat-tool-calls.mdx
git commit -m "docs(chat): chat-tool-calls grouping + per-tool template registry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10.5: Update `chat.mdx` with the reasoning subsection

**Files:**
- Modify: `apps/website/content/docs/chat/components/chat.mdx`

- [ ] **Step 1: Append the reasoning section + tool-call template subsection**

At the end of `apps/website/content/docs/chat/components/chat.mdx`, append:

```mdx
## Reasoning

When a model emits reasoning content (gpt-5 / o-series with `reasoning` blocks, Anthropic with `thinking` blocks, or any AG-UI agent emitting `REASONING_MESSAGE_*` events), the adapter populates `Message.reasoning` and `Message.reasoningDurationMs`. The `<chat>` composition automatically renders [`<chat-reasoning>`](./chat-reasoning) above the assistant response. No configuration required.

While reasoning is streaming, the pill shows "Thinking…" with a pulse dot and the body auto-expands so the user sees content arrive in real time. Once response text begins, the pill collapses to "Thought for Ns" (e.g. "Thought for 4s").

## Tool-call templates

Project a `<ng-template chatToolCallTemplate="…">` directly into `<chat>` to replace the default card UX for a specific tool name. The composition forwards the template into the inner [`<chat-tool-calls>`](./chat-tool-calls).

```html
<chat [agent]="agent">
  <ng-template chatToolCallTemplate="generate_image" let-call let-status="status">
    <my-image-card
      [prompt]="call.args.prompt"
      [imageUrl]="call.result"
      [status]="status"
    />
  </ng-template>
</chat>
```

A `chatToolCallTemplate="*"` wildcard catches any unmapped tool name. See [chatToolCallTemplate](./chat-tool-call-template) for the directive reference.
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/components/chat.mdx
git commit -m "docs(chat): document reasoning slot + tool-call template projection in chat.mdx

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10.6: Changelog callout

**Files:**
- Create or modify: `apps/website/content/docs/chat/getting-started/changelog.mdx` (path inferred — confirm the correct page during execution)

- [ ] **Step 1: Locate the existing changelog page**

```bash
find apps/website/content/docs/chat -name "changelog*.mdx" 2>/dev/null
```

If a changelog page exists, edit it. If not, append a `## 0.0.19` section to whichever "What's new" / "Releases" page is canonical for chat (the implementer should `ls` and pick the right file). If no such page exists, create `apps/website/content/docs/chat/getting-started/changelog.mdx` with the body below as the first entry.

- [ ] **Step 2: Add the entry**

Add (or prepend) the following section to the changelog page:

```mdx
## 0.0.19

### Reasoning

- New `<chat-reasoning>` primitive renders model reasoning content as a "Thinking…" / "Thought for Ns" pill, default-collapsed once streaming completes. Auto-rendered by `<chat>` when `Message.reasoning` is populated.
- New `Message.reasoning` and `Message.reasoningDurationMs` optional fields on the shared agent contract. Both adapters populate them: `@ngaf/langgraph` from `{type:'reasoning'}` / `{type:'thinking'}` content blocks, `@ngaf/ag-ui` from `REASONING_MESSAGE_*` events.

### Tool-call templates

- New `chatToolCallTemplate` directive registers per-tool-name templates inside `<chat-tool-calls>`. A literal `"*"` registers a wildcard catch-all.
- `<chat-tool-calls>` `[grouping]="'auto'"` (the default) auto-collapses sequential same-name tool calls into a labeled strip ("Searched 5 sites"). Pass `[grouping]="'none'"` to opt out.
- The legacy single-`<ng-template>` fallback inside `<chat-tool-calls>` is removed in favor of the named-template registry. Consumers wanting a catch-all use `chatToolCallTemplate="*"`.
- `<chat-tool-call-card>` defaults to collapsed when `complete`. Pass `[defaultCollapsed]="false"` for always-expanded.
- New status pill (running spinner / done check / error glyph) with consistent visual chrome.
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/
git commit -m "docs(chat): 0.0.19 changelog entry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 11: Smoke + version bumps + PR

### Task 11.1: Bump versions

**Files:**
- Modify: `libs/chat/package.json`
- Modify: `libs/langgraph/package.json`
- Modify: `libs/ag-ui/package.json`

- [ ] **Step 1: Bump `@ngaf/chat`**

Edit `libs/chat/package.json` and change `"version": "0.0.18"` to `"version": "0.0.19"`.

- [ ] **Step 2: Bump `@ngaf/langgraph`**

Edit `libs/langgraph/package.json` and change `"version": "0.0.10"` to `"version": "0.0.11"`.

- [ ] **Step 3: Bump `@ngaf/ag-ui`**

Edit `libs/ag-ui/package.json` and change `"version": "0.0.2"` to `"version": "0.0.3"`.

- [ ] **Step 4: Build everything**

```bash
npx nx run-many --target=build --projects=licensing,render,chat,langgraph,ag-ui 2>&1 | tail -10
```

Expected: all five projects build successfully.

- [ ] **Step 5: Run all tests**

```bash
npx nx run-many --target=test --projects=chat,langgraph,ag-ui 2>&1 | tail -15
```

Expected: all three test suites pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/package.json libs/langgraph/package.json libs/ag-ui/package.json
git commit -m "chore: bump chat 0.0.19, langgraph 0.0.11, ag-ui 0.0.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11.2: Smoke test in `~/tmp/ngaf`

**Files:** none (validation only)

- [ ] **Step 1: Pack the new tarballs**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/chat && /bin/rm -f *.tgz; npm pack 2>&1 | tail -1
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/langgraph && /bin/rm -f *.tgz; npm pack 2>&1 | tail -1
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/ag-ui && /bin/rm -f *.tgz; npm pack 2>&1 | tail -1
```

Expected: three tarballs printed (`ngaf-chat-0.0.19.tgz`, `ngaf-langgraph-0.0.11.tgz`, `ngaf-ag-ui-0.0.3.tgz`).

- [ ] **Step 2: Install all three into the smoke harness**

```bash
cd ~/tmp/ngaf && npm i --no-save \
  /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/chat/ngaf-chat-0.0.19.tgz \
  /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/langgraph/ngaf-langgraph-0.0.11.tgz \
  /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/ag-ui/ngaf-ag-ui-0.0.3.tgz \
  2>&1 | tail -3
```

- [ ] **Step 3: Restart `ng serve` with a fresh `.angular/cache`**

```bash
PID=$(lsof -iTCP:4200 -sTCP:LISTEN -n -P 2>/dev/null | tail -n +2 | awk '{print $2}' | head -1); kill $PID 2>/dev/null
sleep 2
rm -rf /Users/blove/tmp/ngaf/.angular/cache
cd ~/tmp/ngaf && nohup npx ng serve --port 4200 > /tmp/ngaf-ng-serve.log 2>&1 &
disown
sleep 14
tail -3 /tmp/ngaf-ng-serve.log
```

Expected: `ng serve` is running and `Application bundle generation complete` appears in the log.

- [ ] **Step 4: Manually verify in the browser**

Open http://localhost:4200, pick `gpt-5-mini` from the model picker, click the "Tell me about coral reefs" suggestion, and confirm:

1. A "Thinking…" pill appears briefly (or "Thought for Ns" if reasoning was very fast).
2. The pill collapses once response text begins streaming.
3. Markdown bullets, headings, and code blocks render in the response (regression check from the prior phase).
4. No JSON arrays leak into the bubble.

If any of the four checks fails, return to the relevant phase and fix before opening the PR.

- [ ] **Step 5: Mark this task done (no commit — validation only)**

### Task 11.3: Push + open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin claude/chat-reasoning-and-tool-call-templates 2>&1 | tail -3
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "chat reasoning + tool-call templates (chat 0.0.19, langgraph 0.0.11, ag-ui 0.0.3)" --body "$(cat <<'EOF'
## Summary

Stacks on top of #191 (chat 0.0.18 + langgraph 0.0.10).

### Reasoning (new)
- `<chat-reasoning>` primitive renders model reasoning content as a collapsible "Thinking…" / "Thought for Ns" pill above the assistant response. Auto-rendered by `<chat>` when `Message.reasoning` is populated.
- `Message.reasoning` + `Message.reasoningDurationMs` optional fields on the shared agent contract. Both adapters populate them from provider-agnostic sources: LangGraph `{type:'reasoning'|'thinking'}` blocks, AG-UI `REASONING_MESSAGE_*` events.
- Shared `assertReasoningFixtureMessages` conformance test ensures both adapters produce identical Message[] from the same abstract event sequence.

### Tool-call extension surface
- `chatToolCallTemplate` directive registers per-tool-name templates inside `<chat-tool-calls>`. A `"*"` wildcard catches unmapped names.
- `<chat-tool-calls>` auto-groups sequential same-name calls into a labeled strip ("Searched 5 sites"). `[grouping]="'none'"` opts out.
- `<chat-tool-call-card>` defaults to collapsed when `complete`; running and errored cards stay expanded. Status pill (spinner / check / error glyph) replaces inline plaintext.
- `<chat>` re-projects `chatToolCallTemplate` directives into the inner `<chat-tool-calls>`.

### FakeAgent
- `FakeAgent` gains an optional `reasoningTokens` constructor option for offline demos and integration tests.

### Docs
- New `chat-reasoning.mdx`, `chat-tool-call-template.mdx`, `chat-tool-calls.mdx`.
- Updated `chat-tool-call-card.mdx`, `chat.mdx`.
- 0.0.19 changelog entry.

Bumps `@ngaf/chat` 0.0.18 → 0.0.19, `@ngaf/langgraph` 0.0.10 → 0.0.11, `@ngaf/ag-ui` 0.0.2 → 0.0.3.

## Test plan

- [ ] Smoke against \`~/tmp/ngaf\` + LangGraph \`langgraph dev\` + gpt-5-mini at \`reasoning.effort='minimal'\`: reasoning pill appears + collapses after streaming.
- [ ] Smoke at \`reasoning.effort='high'\`: reasoning streams visibly while pill says "Thinking…", collapses on text start.
- [ ] Tool-call card renders collapsed after a tool completes (any graph that exercises a tool).
- [ ] Register a \`chatToolCallTemplate="search_web"\` in the smoke app; verify it replaces the default card.
- [ ] CI green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: prints the new PR URL.

- [ ] **Step 3: Wait for CI and merge**

After CI completes (Library tests + Cockpit + Website + e2e), merge:

```bash
gh pr merge --squash --delete-branch
```

If checks fail, investigate per the failed log and push a follow-up commit before merging.

- [ ] **Step 4: Tag the release**

After merge, on `main`:

```bash
git checkout main && git pull origin main
git tag chat-v0.0.19
git tag langgraph-v0.0.11
git tag ag-ui-v0.0.3
git push origin chat-v0.0.19 langgraph-v0.0.11 ag-ui-v0.0.3
```

---

## Plan self-review notes

- **Spec coverage:** every numbered section of the spec maps to one or more tasks above (§2 Architecture → Task 1.1; §3 chat-reasoning → Phase 2; §4 directive → Phase 3; §5 tool-calls → Phase 4; §6 tool-call-card → Phase 5; §7 composition → Phase 9; §8 bridges → Phase 6 + 7; §9 testing harnesses → Tasks 7.2 (fake-agent) + Task 8.1 (mock-agent shape widening implicit via Message change); §10 docs → Phase 10; §11 versioning → Task 11.1; §12 deferred — out of scope; §13 smoke → Task 11.2). The mock-agent change in §9.1 of the spec is implicit: `Message` widening at Task 1.1 makes `reasoning`/`reasoningDurationMs` available everywhere with no further code change required, so no dedicated task is needed.

- **No placeholders.** Every step contains exact code, exact paths, exact commands, exact expected output.

- **Type consistency:** `Message.reasoning?: string`, `Message.reasoningDurationMs?: number` defined in Task 1.1 and consumed everywhere. `ToolCallStatus` re-used (not redefined). `ChatToolCallTemplateContext` defined in Task 3.2 and referenced in Task 10.2. `summarizeGroup` exported from `group-summary.ts` (Task 4.2) and consumed in `chat-tool-calls.component.ts` (Task 4.3) and tested in Task 4.1.

- **Hard constraint adherence:** plan body, code samples, commit messages, and PR body contain no references to `copilotkit`, `chatgpt`, `chatbot-kit`, or similar.
