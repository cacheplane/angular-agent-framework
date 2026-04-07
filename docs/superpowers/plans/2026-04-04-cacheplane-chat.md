# @cacheplane/chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Angular chat component library with headless primitives and prebuilt Tailwind compositions for LangGraph, LangChain, and Deep Agent UIs.

**Architecture:** Two-layer design — headless primitives (unstyled, logic-only, composable via `ng-template`) and prebuilt compositions (Tailwind + shadcn model). All components accept a `AgentRef` from `@cacheplane/angular`. Generative UI hosted via `@cacheplane/render`. Debug component provides agent execution inspection.

**Tech Stack:** Angular 21+, `@cacheplane/angular`, `@cacheplane/render`, Tailwind CSS, Nx 22, ng-packagr, Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-chat-component-library-design.md` — Deliverable 2

**Depends on:** `@cacheplane/render` must be built first (Plan: `2026-04-04-cacheplane-render.md`)

---

## File Structure

```
libs/chat/
├── src/
│   ├── lib/
│   │   ├── chat.types.ts                          # Shared types (MessageContext, ChatConfig)
│   │   ├── provide-chat.ts                         # provideChat() DI provider
│   │   ├── provide-chat.spec.ts
│   │   ├── primitives/
│   │   │   ├── chat-messages/
│   │   │   │   ├── chat-messages.component.ts
│   │   │   │   ├── chat-messages.component.spec.ts
│   │   │   │   └── message-template.directive.ts
│   │   │   ├── chat-input/
│   │   │   │   ├── chat-input.component.ts
│   │   │   │   └── chat-input.component.spec.ts
│   │   │   ├── chat-interrupt/
│   │   │   │   ├── chat-interrupt.component.ts
│   │   │   │   └── chat-interrupt.component.spec.ts
│   │   │   ├── chat-tool-calls/
│   │   │   │   ├── chat-tool-calls.component.ts
│   │   │   │   └── chat-tool-calls.component.spec.ts
│   │   │   ├── chat-subagents/
│   │   │   │   ├── chat-subagents.component.ts
│   │   │   │   └── chat-subagents.component.spec.ts
│   │   │   ├── chat-timeline/
│   │   │   │   ├── chat-timeline.component.ts
│   │   │   │   └── chat-timeline.component.spec.ts
│   │   │   ├── chat-generative-ui/
│   │   │   │   ├── chat-generative-ui.component.ts
│   │   │   │   └── chat-generative-ui.component.spec.ts
│   │   │   ├── chat-typing-indicator/
│   │   │   │   ├── chat-typing-indicator.component.ts
│   │   │   │   └── chat-typing-indicator.component.spec.ts
│   │   │   └── chat-error/
│   │   │       ├── chat-error.component.ts
│   │   │       └── chat-error.component.spec.ts
│   │   ├── compositions/
│   │   │   ├── chat/
│   │   │   │   ├── chat.component.ts
│   │   │   │   └── chat.component.spec.ts
│   │   │   ├── chat-debug/
│   │   │   │   ├── chat-debug.component.ts
│   │   │   │   ├── chat-debug.component.spec.ts
│   │   │   │   ├── debug-timeline.component.ts
│   │   │   │   ├── debug-checkpoint-card.component.ts
│   │   │   │   ├── debug-detail.component.ts
│   │   │   │   ├── debug-state-inspector.component.ts
│   │   │   │   ├── debug-state-diff.component.ts
│   │   │   │   ├── debug-tool-call-detail.component.ts
│   │   │   │   ├── debug-latency-bar.component.ts
│   │   │   │   ├── debug-controls.component.ts
│   │   │   │   └── debug-summary.component.ts
│   │   │   ├── chat-interrupt-panel/
│   │   │   │   ├── chat-interrupt-panel.component.ts
│   │   │   │   └── chat-interrupt-panel.component.spec.ts
│   │   │   ├── chat-tool-call-card/
│   │   │   │   ├── chat-tool-call-card.component.ts
│   │   │   │   └── chat-tool-call-card.component.spec.ts
│   │   │   ├── chat-subagent-card/
│   │   │   │   ├── chat-subagent-card.component.ts
│   │   │   │   └── chat-subagent-card.component.spec.ts
│   │   │   └── chat-timeline-slider/
│   │   │       ├── chat-timeline-slider.component.ts
│   │   │       └── chat-timeline-slider.component.spec.ts
│   │   └── testing/
│   │       └── mock-angular-ref.ts         # Test utility for creating mock refs
│   ├── public-api.ts
│   └── test-setup.ts
├── project.json
├── package.json
├── ng-package.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.lib.prod.json
├── vite.config.mts
├── eslint.config.mjs
└── tailwind.config.ts
```

---

### Task 1: Scaffold the Nx Library

**Files:**
- Create: `libs/chat/project.json`
- Create: `libs/chat/package.json`
- Create: All config files (same pattern as render)
- Modify: `tsconfig.base.json` (add path alias)

- [ ] **Step 1: Generate the library with Nx**

Run:
```bash
npx nx generate @nx/angular:library chat --directory=libs/chat --publishable --importPath=@cacheplane/chat --prefix=chat --standalone --skipModule --no-interactive
```

- [ ] **Step 2: Update `libs/chat/package.json`**

```json
{
  "name": "@cacheplane/chat",
  "version": "0.0.1",
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0",
    "@angular/common": "^20.0.0 || ^21.0.0",
    "@cacheplane/render": "^0.0.1",
    "@cacheplane/angular": "^0.0.1",
    "@langchain/core": "^1.1.33"
  },
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

- [ ] **Step 3: Update project.json with Vitest**

Same pattern as render library — `@nx/vite:test` executor.

- [ ] **Step 4: Create vite.config.mts, test-setup.ts, eslint.config.mjs**

Same pattern as render library.

- [ ] **Step 5: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chat: {
          primary: 'var(--chat-primary, #6366f1)',
          surface: 'var(--chat-surface, #ffffff)',
          'surface-alt': 'var(--chat-surface-alt, #f9fafb)',
          border: 'var(--chat-border, #e5e7eb)',
          text: 'var(--chat-text, #111827)',
          'text-muted': 'var(--chat-text-muted, #6b7280)',
          accent: 'var(--chat-accent, #8b5cf6)',
          error: 'var(--chat-error, #ef4444)',
          warning: 'var(--chat-warning, #f59e0b)',
          success: 'var(--chat-success, #10b981)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Verify path alias in tsconfig.base.json**

```json
"@cacheplane/chat": ["libs/chat/src/public-api.ts"]
```

- [ ] **Step 7: Verify build and test**

Run:
```bash
npx nx build chat && npx nx test chat
```

- [ ] **Step 8: Commit**

```bash
git add libs/chat/ tsconfig.base.json
git commit -m "chore: scaffold @cacheplane/chat library"
```

---

### Task 2: Shared Types and Test Utilities

**Files:**
- Create: `libs/chat/src/lib/chat.types.ts`
- Create: `libs/chat/src/lib/testing/mock-angular-ref.ts`

- [ ] **Step 1: Create chat types**

Create `libs/chat/src/lib/chat.types.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Signal } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';
import type { AngularRegistry } from '@cacheplane/render';
import type { BaseMessage } from '@langchain/core/messages';

/** Configuration for provideChat(). */
export interface ChatConfig {
  /** Default registry for generative UI rendering */
  registry?: AngularRegistry;
}

/** Context available in message templates via let- bindings */
export interface MessageContext {
  /** The message object */
  message: BaseMessage;
  /** Index in the messages array */
  index: number;
  /** Whether this is the last message */
  isLast: boolean;
}

/** Supported message template types */
export type MessageTemplateType = 'human' | 'ai' | 'tool' | 'system' | 'function';
```

- [ ] **Step 2: Create mock AgentRef test utility**

Create `libs/chat/src/lib/testing/mock-angular-ref.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { signal, computed } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';
import { ResourceStatus } from '@cacheplane/angular';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * Create a mock AgentRef for testing chat components.
 * All signals are writable for easy test setup.
 */
export function createMockAgentRef(
  overrides: Partial<{
    messages: BaseMessage[];
    status: ResourceStatus;
    error: unknown;
    interrupt: unknown;
    isLoading: boolean;
  }> = {},
): AgentRef<any> {
  const messages = signal<BaseMessage[]>(overrides.messages ?? []);
  const status = signal(overrides.status ?? ResourceStatus.Idle);
  const error = signal<unknown>(overrides.error ?? undefined);
  const interrupt = signal<unknown>(overrides.interrupt ?? undefined);
  const interrupts = signal<unknown[]>([]);
  const toolProgress = signal<unknown[]>([]);
  const toolCalls = signal<unknown[]>([]);
  const branch = signal<string>('');
  const history = signal<unknown[]>([]);
  const isThreadLoading = signal(false);
  const subagents = signal(new Map());
  const value = signal<any>({});
  const hasValue = signal(messages().length > 0);
  const isLoading = computed(() => overrides.isLoading ?? status() === ResourceStatus.Loading);
  const activeSubagents = computed(() => []);

  return {
    value: value.asReadonly(),
    messages: messages.asReadonly(),
    status: status.asReadonly(),
    isLoading,
    error: error.asReadonly(),
    hasValue: hasValue.asReadonly(),
    interrupt: interrupt.asReadonly(),
    interrupts: interrupts.asReadonly(),
    toolProgress: toolProgress.asReadonly(),
    toolCalls: toolCalls.asReadonly(),
    branch: branch.asReadonly(),
    history: history.asReadonly(),
    isThreadLoading: isThreadLoading.asReadonly(),
    subagents: subagents.asReadonly(),
    activeSubagents,
    submit: async () => {},
    stop: async () => {},
    switchThread: () => {},
    joinStream: async () => {},
    reload: () => {},
    setBranch: () => {},
    getMessagesMetadata: () => undefined,
    getToolCalls: () => [],
  } as unknown as AgentRef<any>;
}
```

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add shared types and mock test utilities"
```

---

### Task 3: MessageTemplate Directive + ChatMessages Primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-messages/message-template.directive.ts`
- Create: `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessagesComponent } from './chat-messages.component';
import { MessageTemplateDirective } from './message-template.directive';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

@Component({
  standalone: true,
  imports: [ChatMessagesComponent, MessageTemplateDirective],
  template: `
    <chat-messages [ref]="chatRef">
      <ng-template messageTemplate="human" let-message>
        <div class="human">{{ message.content }}</div>
      </ng-template>
      <ng-template messageTemplate="ai" let-message>
        <div class="ai">{{ message.content }}</div>
      </ng-template>
    </chat-messages>
  `,
})
class TestHostComponent {
  chatRef = createMockAgentRef({
    messages: [
      new HumanMessage('Hello'),
      new AIMessage('Hi there!'),
    ],
  });
}

describe('ChatMessagesComponent', () => {
  it('should render messages using matching templates', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hello');
    expect(fixture.nativeElement.textContent).toContain('Hi there!');
    expect(fixture.nativeElement.querySelector('.human')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.ai')).toBeTruthy();
  });

  it('should render empty when no messages', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.chatRef = createMockAgentRef({ messages: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

Expected: FAIL.

- [ ] **Step 3: Implement MessageTemplateDirective**

Create `libs/chat/src/lib/primitives/chat-messages/message-template.directive.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Directive, input, TemplateRef, inject } from '@angular/core';
import type { MessageTemplateType } from '../../chat.types';

@Directive({
  selector: 'ng-template[messageTemplate]',
  standalone: true,
})
export class MessageTemplateDirective {
  readonly messageTemplate = input.required<MessageTemplateType>();
  readonly templateRef = inject(TemplateRef);
}
```

- [ ] **Step 4: Implement ChatMessagesComponent**

Create `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChildren,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef } from '@cacheplane/angular';
import type { BaseMessage } from '@langchain/core/messages';
import { MessageTemplateDirective } from './message-template.directive';
import type { MessageTemplateType } from '../../chat.types';

@Component({
  selector: 'chat-messages',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (message of messages(); track $index) {
      @if (getTemplate(message); as tpl) {
        <ng-container
          *ngTemplateOutlet="tpl; context: { $implicit: message, index: $index, isLast: $index === messages().length - 1 }"
        />
      }
    }
  `,
})
export class ChatMessagesComponent {
  readonly ref = input.required<AgentRef<any>>();

  private readonly templates = contentChildren(MessageTemplateDirective);

  protected readonly messages = computed(() => this.ref().messages());

  protected getTemplate(message: BaseMessage) {
    const type = this.getMessageType(message);
    const match = this.templates().find(t => t.messageTemplate() === type);
    return match?.templateRef ?? null;
  }

  private getMessageType(message: BaseMessage): MessageTemplateType {
    const msgType = message._getType();
    if (msgType === 'human') return 'human';
    if (msgType === 'ai') return 'ai';
    if (msgType === 'tool') return 'tool';
    if (msgType === 'system') return 'system';
    return 'function';
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test chat`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatMessages primitive with messageTemplate directive"
```

---

### Task 4: ChatInput Primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatInputComponent } from './chat-input.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

describe('ChatInputComponent', () => {
  it('should render a text input and submit button', () => {
    TestBed.configureTestingModule({ imports: [ChatInputComponent] });
    const fixture = TestBed.createComponent(ChatInputComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef());
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('textarea, input')).toBeTruthy();
  });

  it('should call ref.submit when form is submitted', async () => {
    const ref = createMockAgentRef();
    const submitSpy = vi.spyOn(ref, 'submit').mockResolvedValue(undefined);

    TestBed.configureTestingModule({ imports: [ChatInputComponent] });
    const fixture = TestBed.createComponent(ChatInputComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    (component as any).message.set('Hello world');
    (component as any).onSubmit();
    fixture.detectChanges();

    expect(submitSpy).toHaveBeenCalled();
  });

  it('should not submit empty messages', () => {
    const ref = createMockAgentRef();
    const submitSpy = vi.spyOn(ref, 'submit');

    TestBed.configureTestingModule({ imports: [ChatInputComponent] });
    const fixture = TestBed.createComponent(ChatInputComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    (fixture.componentInstance as any).onSubmit();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('should disable input when loading', () => {
    TestBed.configureTestingModule({ imports: [ChatInputComponent] });
    const fixture = TestBed.createComponent(ChatInputComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef({ isLoading: true }));
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea, input');
    expect(textarea.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatInputComponent**

Create `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AgentRef } from '@cacheplane/angular';
import { HumanMessage } from '@langchain/core/messages';

@Component({
  selector: 'chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="onSubmit()" role="form">
      <textarea
        [(ngModel)]="messageText"
        name="message"
        [disabled]="isDisabled()"
        [placeholder]="placeholder()"
        (keydown.enter)="onKeydown($event)"
        rows="1"
      ></textarea>
      <button type="submit" [disabled]="isDisabled() || !messageText()">
        <ng-content select="[chatSubmitButton]">Send</ng-content>
      </button>
    </form>
  `,
})
export class ChatInputComponent {
  readonly ref = input.required<AgentRef<any>>();
  readonly submitOnEnter = input<boolean>(true);
  readonly placeholder = input<string>('Type a message...');

  /** Emitted after successful submit with the message text */
  readonly submitted = output<string>();

  protected readonly messageText = signal('');

  protected readonly isDisabled = computed(() => this.ref().isLoading());

  protected readonly message = this.messageText;

  protected onSubmit(): void {
    const text = this.messageText().trim();
    if (!text) return;

    this.ref().submit({
      messages: [new HumanMessage(text)],
    });

    this.messageText.set('');
    this.submitted.emit(text);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.submitOnEnter() && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatInput primitive"
```

---

### Task 5: ChatTypingIndicator and ChatError Primitives

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-error/chat-error.component.spec.ts`

- [ ] **Step 1: Write failing tests for both**

Create `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatTypingIndicatorComponent } from './chat-typing-indicator.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';
import { ResourceStatus } from '@cacheplane/angular';

describe('ChatTypingIndicatorComponent', () => {
  it('should render when loading', () => {
    TestBed.configureTestingModule({ imports: [ChatTypingIndicatorComponent] });
    const fixture = TestBed.createComponent(ChatTypingIndicatorComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef({ isLoading: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).not.toBe('');
  });

  it('should be empty when not loading', () => {
    TestBed.configureTestingModule({ imports: [ChatTypingIndicatorComponent] });
    const fixture = TestBed.createComponent(ChatTypingIndicatorComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef({ isLoading: false }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

Create `libs/chat/src/lib/primitives/chat-error/chat-error.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatErrorComponent } from './chat-error.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

describe('ChatErrorComponent', () => {
  it('should render error message when error exists', () => {
    TestBed.configureTestingModule({ imports: [ChatErrorComponent] });
    const fixture = TestBed.createComponent(ChatErrorComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef({ error: new Error('Connection failed') }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Connection failed');
  });

  it('should be empty when no error', () => {
    TestBed.configureTestingModule({ imports: [ChatErrorComponent] });
    const fixture = TestBed.createComponent(ChatErrorComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat`

- [ ] **Step 3: Implement both components**

Create `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ref().isLoading()) {
      <ng-content>
        <div role="status" aria-label="Agent is typing">
          <span>...</span>
        </div>
      </ng-content>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly ref = input.required<AgentRef<any>>();
}
```

Create `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errorMessage(); as msg) {
      <ng-content>
        <div role="alert">{{ msg }}</div>
      </ng-content>
    }
  `,
})
export class ChatErrorComponent {
  readonly ref = input.required<AgentRef<any>>();

  protected readonly errorMessage = computed(() => {
    const err = this.ref().error();
    if (!err) return null;
    if (err instanceof Error) return err.message;
    return String(err);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatTypingIndicator and ChatError primitives"
```

---

### Task 6: ChatInterrupt Primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatInterruptComponent } from './chat-interrupt.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

@Component({
  standalone: true,
  imports: [ChatInterruptComponent],
  template: `
    <chat-interrupt [ref]="chatRef">
      <ng-template let-interrupt>
        <div class="interrupt-content">{{ interrupt | json }}</div>
      </ng-template>
    </chat-interrupt>
  `,
})
class TestHostComponent {
  chatRef = createMockAgentRef({
    interrupt: { kind: 'approval', message: 'Approve this action?' },
  });
}

describe('ChatInterruptComponent', () => {
  it('should render template when interrupt is active', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.interrupt-content')).toBeTruthy();
  });

  it('should not render when no interrupt', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.chatRef = createMockAgentRef();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.interrupt-content')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatInterruptComponent**

Create `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-interrupt',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (interrupt(); as int) {
      @if (template(); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: { $implicit: int, ref: ref() }" />
      }
    }
  `,
})
export class ChatInterruptComponent {
  readonly ref = input.required<AgentRef<any>>();

  protected readonly template = contentChild(TemplateRef);
  protected readonly interrupt = computed(() => this.ref().interrupt());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatInterrupt primitive"
```

---

### Task 7: ChatToolCalls and ChatSubagents Primitives

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, TemplateRef } from '@angular/core';
import { ChatToolCallsComponent } from './chat-tool-calls.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

@Component({
  standalone: true,
  imports: [ChatToolCallsComponent],
  template: `
    <chat-tool-calls [ref]="chatRef">
      <ng-template let-toolCall>
        <div class="tool-call">{{ toolCall.name }}</div>
      </ng-template>
    </chat-tool-calls>
  `,
})
class TestHostComponent {
  chatRef = createMockAgentRef();
}

describe('ChatToolCallsComponent', () => {
  it('should render', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    expect(fixture).toBeTruthy();
  });
});
```

Create `libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatSubagentsComponent } from './chat-subagents.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

describe('ChatSubagentsComponent', () => {
  it('should render', () => {
    TestBed.configureTestingModule({ imports: [ChatSubagentsComponent] });
    const fixture = TestBed.createComponent(ChatSubagentsComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef());
    fixture.detectChanges();
    expect(fixture).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatToolCallsComponent**

Create `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef } from '@cacheplane/angular';
import type { BaseMessage } from '@langchain/core/messages';

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toolCall of toolCalls(); track toolCall.id ?? $index) {
      @if (template(); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: { $implicit: toolCall, index: $index }" />
      }
    }
  `,
})
export class ChatToolCallsComponent {
  readonly ref = input.required<AgentRef<any>>();

  protected readonly template = contentChild(TemplateRef);
  /** Optional: filter tool calls to a specific message */
  readonly message = input<BaseMessage>();

  protected readonly toolCalls = computed(() => {
    const msg = this.message();
    if (msg && 'tool_calls' in msg && Array.isArray((msg as any).tool_calls)) {
      return (msg as any).tool_calls;
    }
    return this.ref().toolCalls();
  });
}
```

- [ ] **Step 4: Implement ChatSubagentsComponent**

Create `libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-subagents',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (subagent of activeSubagents(); track subagent.toolCallId) {
      @if (template(); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: { $implicit: subagent }" />
      }
    }
  `,
})
export class ChatSubagentsComponent {
  readonly ref = input.required<AgentRef<any>>();

  protected readonly template = contentChild(TemplateRef);
  protected readonly activeSubagents = computed(() => this.ref().activeSubagents());
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatToolCalls and ChatSubagents primitives"
```

---

### Task 8: ChatThreadList Primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatThreadListComponent } from './chat-thread-list.component';

@Component({
  standalone: true,
  imports: [ChatThreadListComponent],
  template: `
    <chat-thread-list [threads]="threads()" [activeThreadId]="activeId()">
      <ng-template let-thread>
        <div class="thread-item">{{ thread.id }}</div>
      </ng-template>
    </chat-thread-list>
  `,
})
class TestHostComponent {
  threads = signal([
    { id: 'thread-1', metadata: {} },
    { id: 'thread-2', metadata: {} },
  ]);
  activeId = signal('thread-1');
}

describe('ChatThreadListComponent', () => {
  it('should render thread items using template', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.thread-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('thread-1');
  });

  it('should render empty when no threads', () => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.threads.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.thread-item').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatThreadListComponent**

Create `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  contentChild,
  input,
  output,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'chat-thread-list',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (thread of threads(); track thread.id) {
      @if (template(); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: {
          $implicit: thread,
          isActive: thread.id === activeThreadId()
        }" />
      }
    }
  `,
})
export class ChatThreadListComponent {
  readonly threads = input.required<Array<{ id: string; [key: string]: unknown }>>();
  readonly activeThreadId = input<string>();
  readonly threadSelected = output<string>();

  protected readonly template = contentChild(TemplateRef);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatThreadList primitive"
```

---

### Task 9: ChatTimeline and ChatGenerativeUi Primitives

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatTimelineComponent } from './chat-timeline.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

describe('ChatTimelineComponent', () => {
  it('should render', () => {
    TestBed.configureTestingModule({ imports: [ChatTimelineComponent] });
    const fixture = TestBed.createComponent(ChatTimelineComponent);
    fixture.componentRef.setInput('ref', createMockAgentRef());
    fixture.detectChanges();
    expect(fixture).toBeTruthy();
  });
});
```

Create `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatGenerativeUiComponent } from './chat-generative-ui.component';

describe('ChatGenerativeUiComponent', () => {
  it('should render empty when no spec', () => {
    TestBed.configureTestingModule({ imports: [ChatGenerativeUiComponent] });
    const fixture = TestBed.createComponent(ChatGenerativeUiComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatTimelineComponent**

Create `libs/chat/src/lib/primitives/chat-timeline/chat-timeline.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  contentChild,
  input,
  output,
  TemplateRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { AgentRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-timeline',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (state of history(); track $index) {
      @if (template(); as tpl) {
        <ng-container *ngTemplateOutlet="tpl; context: {
          $implicit: state,
          index: $index,
          isActive: $index === activeIndex()
        }" />
      }
    }
  `,
})
export class ChatTimelineComponent {
  readonly ref = input.required<AgentRef<any>>();

  readonly checkpointSelected = output<{ checkpointId: string; index: number }>();

  protected readonly template = contentChild(TemplateRef);
  protected readonly history = computed(() => this.ref().history());
  protected readonly activeIndex = computed(() => this.history().length - 1);
}
```

- [ ] **Step 4: Implement ChatGenerativeUiComponent**

Create `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { RenderSpecComponent } from '@cacheplane/render';
import type { AngularRegistry } from '@cacheplane/render';
import type { Spec, StateStore } from '@json-render/core';

@Component({
  selector: 'chat-generative-ui',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec()) {
      <render-spec
        [spec]="spec()"
        [registry]="registry()"
        [store]="store()"
        [loading]="loading()"
      />
    }
  `,
})
export class ChatGenerativeUiComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry>();
  readonly store = input<StateStore>();
  readonly loading = input<boolean>(false);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatTimeline and ChatGenerativeUi primitives"
```

---

### Task 9: provideChat DI Provider

**Files:**
- Create: `libs/chat/src/lib/provide-chat.ts`
- Create: `libs/chat/src/lib/provide-chat.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/provide-chat.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideChat, CHAT_CONFIG } from './provide-chat';

describe('provideChat', () => {
  it('should provide ChatConfig via injection token', () => {
    TestBed.configureTestingModule({
      providers: [provideChat({})],
    });

    const config = TestBed.inject(CHAT_CONFIG);
    expect(config).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

- [ ] **Step 3: Implement provideChat**

Create `libs/chat/src/lib/provide-chat.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { ChatConfig } from './chat.types';

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add provideChat DI provider"
```

---

### Task 10: `<chat>` Composition (Main Prebuilt Layout)

**Files:**
- Create: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Create: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`

- [ ] **Step 1: Write failing test**

Create `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatComponent } from './chat.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';

describe('ChatComponent', () => {
  it('should render messages, input, and typing indicator', () => {
    const ref = createMockAgentRef({
      messages: [new HumanMessage('Hello'), new AIMessage('Hi!')],
    });

    TestBed.configureTestingModule({ imports: [ChatComponent] });
    const fixture = TestBed.createComponent(ChatComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hello');
    expect(fixture.nativeElement.textContent).toContain('Hi!');
  });

  it('should render error when present', () => {
    const ref = createMockAgentRef({
      error: new Error('Stream failed'),
    });

    TestBed.configureTestingModule({ imports: [ChatComponent] });
    const fixture = TestBed.createComponent(ChatComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Stream failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat`

- [ ] **Step 3: Implement ChatComponent**

Create `libs/chat/src/lib/compositions/chat/chat.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';

@Component({
  selector: 'chat',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    ChatInterruptComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <chat-messages [ref]="ref()">
          <ng-template messageTemplate="human" let-message>
            <div class="flex justify-end">
              <div class="bg-chat-primary text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                {{ message.content }}
              </div>
            </div>
          </ng-template>
          <ng-template messageTemplate="ai" let-message>
            <div class="flex justify-start">
              <div class="bg-chat-surface-alt text-chat-text rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                {{ message.content }}
              </div>
            </div>
          </ng-template>
        </chat-messages>

        <chat-typing-indicator [ref]="ref()">
          <div class="flex justify-start">
            <div class="bg-chat-surface-alt text-chat-text-muted rounded-2xl px-4 py-2">
              <span class="animate-pulse">Thinking...</span>
            </div>
          </div>
        </chat-typing-indicator>
      </div>

      <chat-error [ref]="ref()">
        <div class="px-4 py-2 bg-chat-error/10 text-chat-error text-sm border-t border-chat-error/20">
          {{ ref().error() }}
        </div>
      </chat-error>

      <div class="border-t border-chat-border p-4">
        <chat-input [ref]="ref()" />
      </div>
    </div>
  `,
})
export class ChatComponent {
  readonly ref = input.required<AgentRef<any>>();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat`

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add <chat> prebuilt composition"
```

---

### Task 11: ChatInterruptPanel, ChatToolCallCard, ChatSubagentCard Compositions

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- Create: spec files for each

These are standalone styled compositions. Each follows the same TDD pattern.

- [ ] **Step 1: Implement ChatInterruptPanel**

Create `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';

export type InterruptAction = 'accept' | 'edit' | 'respond' | 'ignore';

@Component({
  selector: 'chat-interrupt-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ref().interrupt(); as interrupt) {
      <div class="bg-chat-warning/10 border border-chat-warning/30 rounded-xl p-4 space-y-3">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-chat-warning animate-pulse"></span>
          <span class="text-sm font-medium text-chat-warning">Human input required</span>
        </div>
        <div class="text-sm text-chat-text">
          {{ interrupt | json }}
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 text-sm rounded-lg bg-chat-success text-white hover:bg-chat-success/90"
            (click)="action.emit('accept')"
          >Accept</button>
          <button
            class="px-3 py-1.5 text-sm rounded-lg bg-chat-primary text-white hover:bg-chat-primary/90"
            (click)="action.emit('edit')"
          >Edit</button>
          <button
            class="px-3 py-1.5 text-sm rounded-lg bg-chat-surface-alt text-chat-text border border-chat-border hover:bg-chat-border/50"
            (click)="action.emit('respond')"
          >Respond</button>
          <button
            class="px-3 py-1.5 text-sm rounded-lg text-chat-text-muted hover:bg-chat-surface-alt"
            (click)="action.emit('ignore')"
          >Ignore</button>
        </div>
      </div>
    }
  `,
})
export class ChatInterruptPanelComponent {
  readonly ref = input.required<AgentRef<any>>();
  readonly action = output<InterruptAction>();
}
```

- [ ] **Step 2: Implement ChatToolCallCard**

Create `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border border-chat-border rounded-lg overflow-hidden">
      <button
        class="w-full flex items-center justify-between px-3 py-2 text-sm bg-chat-surface-alt hover:bg-chat-border/30"
        (click)="expanded.set(!expanded())"
      >
        <span class="font-mono text-chat-text">{{ toolCall().name }}</span>
        <span class="text-chat-text-muted text-xs">{{ expanded() ? '▼' : '▶' }}</span>
      </button>
      @if (expanded()) {
        <div class="px-3 py-2 text-xs space-y-2 border-t border-chat-border">
          <div>
            <span class="text-chat-text-muted">Input:</span>
            <pre class="mt-1 text-chat-text overflow-x-auto">{{ toolCall().args | json }}</pre>
          </div>
          @if (toolCall().result !== undefined) {
            <div>
              <span class="text-chat-text-muted">Output:</span>
              <pre class="mt-1 text-chat-success overflow-x-auto">{{ toolCall().result | json }}</pre>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatToolCallCardComponent {
  readonly toolCall = input.required<{ name: string; args: unknown; result?: unknown; id?: string }>();
  protected readonly expanded = signal(false);
}
```

- [ ] **Step 3: Implement ChatSubagentCard**

Create `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, signal, ChangeDetectionStrategy } from '@angular/core';
import type { SubagentStreamRef } from '@cacheplane/angular';

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border border-chat-border rounded-lg overflow-hidden">
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-sm bg-chat-surface-alt hover:bg-chat-border/30"
        (click)="expanded.set(!expanded())"
      >
        <span class="w-2 h-2 rounded-full" [class]="statusColor()"></span>
        <span class="font-mono text-chat-text">{{ subagent().toolCallId }}</span>
        <span class="text-chat-text-muted text-xs ml-auto">{{ expanded() ? '▼' : '▶' }}</span>
      </button>
      @if (expanded()) {
        <div class="px-3 py-2 text-xs border-t border-chat-border space-y-1">
          @for (msg of subagent().messages(); track $index) {
            <div class="text-chat-text">{{ msg.content }}</div>
          }
        </div>
      }
    </div>
  `,
})
export class ChatSubagentCardComponent {
  readonly subagent = input.required<SubagentStreamRef>();
  protected readonly expanded = signal(false);

  protected readonly statusColor = computed(() => {
    const status = this.subagent().status();
    switch (status) {
      case 'running': return 'bg-chat-warning animate-pulse';
      case 'complete': return 'bg-chat-success';
      case 'error': return 'bg-chat-error';
      default: return 'bg-chat-text-muted';
    }
  });
}
```

- [ ] **Step 4: Write basic spec files for each**

Each spec file follows the same minimal pattern: import the component, render it with test inputs, assert it exists.

- [ ] **Step 5: Run all tests**

Run: `npx nx test chat`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add InterruptPanel, ToolCallCard, SubagentCard compositions"
```

---

### Task 12: ChatDebug Composition (Tier 1 MVP)

**Files:**
- Create: All files in `libs/chat/src/lib/compositions/chat-debug/`

This is the largest single task. Implements Tier 1 features only: timeline, state inspector, state diff, tool call detail, collapsible panel.

- [ ] **Step 1: Create DebugCheckpointCard**

Create `libs/chat/src/lib/compositions/chat-debug/debug-checkpoint-card.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'debug-checkpoint-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="w-full text-left px-3 py-2 rounded-lg border transition-colors"
      [class]="isSelected()
        ? 'border-chat-primary bg-chat-primary/10'
        : 'border-chat-border hover:bg-chat-surface-alt'"
      (click)="selected.emit()"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-mono text-chat-text">{{ checkpoint().node ?? 'unknown' }}</span>
        <span class="text-xs text-chat-text-muted">{{ checkpoint().duration ?? 0 }}ms</span>
      </div>
      @if (checkpoint().tokenCount) {
        <div class="text-xs text-chat-text-muted mt-0.5">
          {{ checkpoint().tokenCount }} tokens
        </div>
      }
    </button>
  `,
})
export class DebugCheckpointCardComponent {
  readonly checkpoint = input.required<{
    node?: string;
    duration?: number;
    tokenCount?: number;
    checkpointId?: string;
  }>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<void>();
}
```

- [ ] **Step 2: Create DebugStateInspector**

Create `libs/chat/src/lib/compositions/chat-debug/debug-state-inspector.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'debug-state-inspector',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-xs">
      <div class="text-chat-text-muted font-medium mb-1 uppercase tracking-wider">State</div>
      <pre class="bg-black/20 rounded-lg p-3 overflow-x-auto text-chat-text whitespace-pre-wrap">{{ state() | json }}</pre>
    </div>
  `,
})
export class DebugStateInspectorComponent {
  readonly state = input.required<Record<string, unknown>>();
}
```

- [ ] **Step 3: Create DebugStateDiff**

Create `libs/chat/src/lib/compositions/chat-debug/debug-state-diff.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';

interface DiffEntry {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
}

@Component({
  selector: 'debug-state-diff',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-xs">
      <div class="text-chat-text-muted font-medium mb-1 uppercase tracking-wider">Diff</div>
      @if (diff().length === 0) {
        <div class="text-chat-text-muted italic">No changes</div>
      } @else {
        <div class="space-y-0.5 font-mono">
          @for (entry of diff(); track entry.path) {
            <div [class]="entryColor(entry)">
              {{ entryPrefix(entry) }} {{ entry.path }}: {{ formatValue(entry) }}
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DebugStateDiffComponent {
  readonly before = input.required<Record<string, unknown>>();
  readonly after = input.required<Record<string, unknown>>();

  protected readonly diff = computed(() => {
    return this.computeDiff(this.before(), this.after());
  });

  protected entryColor(entry: DiffEntry): string {
    switch (entry.type) {
      case 'added': return 'text-chat-success';
      case 'removed': return 'text-chat-error';
      case 'changed': return 'text-chat-warning';
    }
  }

  protected entryPrefix(entry: DiffEntry): string {
    switch (entry.type) {
      case 'added': return '+';
      case 'removed': return '-';
      case 'changed': return '~';
    }
  }

  protected formatValue(entry: DiffEntry): string {
    if (entry.type === 'removed') return JSON.stringify(entry.oldValue);
    return JSON.stringify(entry.newValue);
  }

  private computeDiff(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ''): DiffEntry[] {
    const entries: DiffEntry[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const inBefore = key in before;
      const inAfter = key in after;

      if (!inBefore && inAfter) {
        entries.push({ path, type: 'added', newValue: after[key] });
      } else if (inBefore && !inAfter) {
        entries.push({ path, type: 'removed', oldValue: before[key] });
      } else if (before[key] !== after[key]) {
        if (typeof before[key] === 'object' && typeof after[key] === 'object' && before[key] && after[key]) {
          entries.push(...this.computeDiff(
            before[key] as Record<string, unknown>,
            after[key] as Record<string, unknown>,
            path,
          ));
        } else {
          entries.push({ path, type: 'changed', oldValue: before[key], newValue: after[key] });
        }
      }
    }
    return entries;
  }
}
```

- [ ] **Step 4: Create DebugTimeline**

Create `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { DebugCheckpointCardComponent } from './debug-checkpoint-card.component';

@Component({
  selector: 'debug-timeline',
  standalone: true,
  imports: [DebugCheckpointCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1">
      <div class="text-xs text-chat-text-muted font-medium uppercase tracking-wider mb-2">Checkpoints</div>
      @for (cp of checkpoints(); track $index) {
        <div class="flex gap-2">
          <div class="w-0.5 bg-chat-border ml-2 shrink-0"></div>
          <debug-checkpoint-card
            class="flex-1"
            [checkpoint]="cp"
            [isSelected]="selectedIndex() === $index"
            (selected)="onSelect($index)"
          />
        </div>
      }
    </div>
  `,
})
export class DebugTimelineComponent {
  readonly checkpoints = input.required<Record<string, unknown>[]>();
  readonly selectedIndex = input<number>(-1);
  readonly checkpointSelected = output<number>();

  protected onSelect(index: number): void {
    this.checkpointSelected.emit(index);
  }
}
```

- [ ] **Step 5: Create DebugDetail**

Create `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { DebugStateInspectorComponent } from './debug-state-inspector.component';
import { DebugStateDiffComponent } from './debug-state-diff.component';

@Component({
  selector: 'debug-detail',
  standalone: true,
  imports: [DebugStateInspectorComponent, DebugStateDiffComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      @if (previousState() && currentState()) {
        <debug-state-diff [before]="previousState()!" [after]="currentState()!" />
      }
      @if (currentState()) {
        <debug-state-inspector [state]="currentState()!" />
      }
    </div>
  `,
})
export class DebugDetailComponent {
  readonly currentState = input<Record<string, unknown>>();
  readonly previousState = input<Record<string, unknown>>();
}
```

- [ ] **Step 6: Create ChatDebug top-level composition**

Create `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, computed, input, signal, ChangeDetectionStrategy } from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { DebugTimelineComponent } from './debug-timeline.component';
import { DebugDetailComponent } from './debug-detail.component';

@Component({
  selector: 'chat-debug',
  standalone: true,
  imports: [
    ChatMessagesComponent,
    MessageTemplateDirective,
    ChatInputComponent,
    ChatTypingIndicatorComponent,
    ChatErrorComponent,
    DebugTimelineComponent,
    DebugDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full">
      <!-- Chat area -->
      <div class="flex-1 flex flex-col min-w-0">
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <chat-messages [ref]="ref()">
            <ng-template messageTemplate="human" let-message>
              <div class="flex justify-end">
                <div class="bg-chat-primary text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                  {{ message.content }}
                </div>
              </div>
            </ng-template>
            <ng-template messageTemplate="ai" let-message>
              <div class="flex justify-start">
                <div class="bg-chat-surface-alt text-chat-text rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                  {{ message.content }}
                </div>
              </div>
            </ng-template>
          </chat-messages>
          <chat-typing-indicator [ref]="ref()" />
        </div>
        <chat-error [ref]="ref()" />
        <div class="border-t border-chat-border p-4">
          <chat-input [ref]="ref()" />
        </div>
      </div>

      <!-- Debug panel -->
      @if (debugOpen()) {
        <div class="w-80 border-l border-chat-border flex flex-col bg-chat-surface overflow-y-auto">
          <div class="flex items-center justify-between px-3 py-2 border-b border-chat-border">
            <span class="text-xs font-bold text-chat-error uppercase">Debug</span>
            <button class="text-xs text-chat-text-muted" (click)="debugOpen.set(false)">Close</button>
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-4">
            <debug-timeline
              [checkpoints]="checkpoints()"
              [selectedIndex]="selectedCheckpointIndex()"
              (checkpointSelected)="selectedCheckpointIndex.set($event)"
            />
            <debug-detail
              [currentState]="selectedState()"
              [previousState]="previousState()"
            />
          </div>
        </div>
      } @else {
        <button
          class="absolute top-2 right-2 px-2 py-1 text-xs bg-chat-error/10 text-chat-error rounded"
          (click)="debugOpen.set(true)"
        >Debug</button>
      }
    </div>
  `,
  styles: [`:host { display: block; position: relative; height: 100%; }`],
})
export class ChatDebugComponent {
  readonly ref = input.required<AgentRef<any>>();

  protected readonly debugOpen = signal(true);
  protected readonly selectedCheckpointIndex = signal(-1);

  protected readonly checkpoints = computed(() => {
    return this.ref().history() as Record<string, unknown>[];
  });

  protected readonly selectedState = computed(() => {
    const idx = this.selectedCheckpointIndex();
    const cps = this.checkpoints();
    if (idx < 0 || idx >= cps.length) return undefined;
    return (cps[idx] as any)?.values ?? cps[idx];
  });

  protected readonly previousState = computed(() => {
    const idx = this.selectedCheckpointIndex();
    const cps = this.checkpoints();
    if (idx <= 0 || idx >= cps.length) return undefined;
    return (cps[idx - 1] as any)?.values ?? cps[idx - 1];
  });
}
```

- [ ] **Step 7: Write test for ChatDebug**

Create `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChatDebugComponent } from './chat-debug.component';
import { createMockAgentRef } from '../../testing/mock-angular-ref';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('ChatDebugComponent', () => {
  it('should render chat area and debug panel', () => {
    const ref = createMockAgentRef({
      messages: [new HumanMessage('test')],
    });

    TestBed.configureTestingModule({ imports: [ChatDebugComponent] });
    const fixture = TestBed.createComponent(ChatDebugComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('test');
    expect(fixture.nativeElement.textContent).toContain('Debug');
  });
});
```

- [ ] **Step 8: Run all tests**

Run: `npx nx test chat`

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add libs/chat/src/
git commit -m "feat(chat): add ChatDebug composition with timeline, state inspector, and diff"
```

---

### Task 13: Public API and Final Build Verification

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Finalize public-api.ts**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Types
export type { ChatConfig, MessageContext, MessageTemplateType } from './lib/chat.types';

// Provider
export { provideChat, CHAT_CONFIG } from './lib/provide-chat';

// Primitives
export { ChatMessagesComponent } from './lib/primitives/chat-messages/chat-messages.component';
export { MessageTemplateDirective } from './lib/primitives/chat-messages/message-template.directive';
export { ChatInputComponent } from './lib/primitives/chat-input/chat-input.component';
export { ChatInterruptComponent } from './lib/primitives/chat-interrupt/chat-interrupt.component';
export { ChatToolCallsComponent } from './lib/primitives/chat-tool-calls/chat-tool-calls.component';
export { ChatSubagentsComponent } from './lib/primitives/chat-subagents/chat-subagents.component';
export { ChatThreadListComponent } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';
export { ChatGenerativeUiComponent } from './lib/primitives/chat-generative-ui/chat-generative-ui.component';
export { ChatTypingIndicatorComponent } from './lib/primitives/chat-typing-indicator/chat-typing-indicator.component';
export { ChatErrorComponent } from './lib/primitives/chat-error/chat-error.component';

// Compositions
export { ChatComponent } from './lib/compositions/chat/chat.component';
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export { ChatInterruptPanelComponent } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export { ChatToolCallCardComponent } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export { ChatSubagentCardComponent } from './lib/compositions/chat-subagent-card/chat-subagent-card.component';

// Debug sub-components (for custom debug layouts)
export { DebugTimelineComponent } from './lib/compositions/chat-debug/debug-timeline.component';
export { DebugCheckpointCardComponent } from './lib/compositions/chat-debug/debug-checkpoint-card.component';
export { DebugDetailComponent } from './lib/compositions/chat-debug/debug-detail.component';
export { DebugStateInspectorComponent } from './lib/compositions/chat-debug/debug-state-inspector.component';
export { DebugStateDiffComponent } from './lib/compositions/chat-debug/debug-state-diff.component';

// Debug Tier 2 (deferred — implement after MVP):
// DebugToolCallDetail, DebugLatencyBar, DebugControls, DebugSummary

// Test utilities
export { createMockAgentRef } from './lib/testing/mock-angular-ref';
```

- [ ] **Step 2: Run all tests**

Run: `npx nx test chat`

- [ ] **Step 3: Run lint**

Run: `npx nx lint chat`

- [ ] **Step 4: Run build**

Run: `npx nx build chat`

- [ ] **Step 5: Commit**

```bash
git add libs/chat/
git commit -m "feat(chat): finalize public API and verify build"
```

---

## Summary

| Task | Description | Components |
|------|-------------|------------|
| 1 | Scaffold Nx library | Config files |
| 2 | Types + test utilities | chat.types, mock ref |
| 3 | ChatMessages + messageTemplate | 2 primitives |
| 4 | ChatInput | 1 primitive |
| 5 | ChatTypingIndicator + ChatError | 2 primitives |
| 6 | ChatInterrupt | 1 primitive |
| 7 | ChatToolCalls + ChatSubagents | 2 primitives |
| 8 | ChatThreadList | 1 primitive |
| 9 | ChatTimeline + ChatGenerativeUi | 2 primitives |
| 10 | provideChat | 1 provider |
| 11 | `<chat>` composition | 1 composition |
| 12 | InterruptPanel + ToolCallCard + SubagentCard | 3 compositions |
| 13 | `<chat-debug>` (Tier 1 MVP) | 6 debug components |
| 14 | Public API + build | Final verification |
