# Chat UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign @cacheplane/chat compositions with Apple-clean aesthetics, neutral gray palette, CSS custom property theming, light/dark mode support, and responsive layout.

**Architecture:** New `chat-theme.css` defines all CSS custom properties with dark defaults and light mode overrides via `prefers-color-scheme`. All compositions reference theme vars instead of hardcoded Tailwind colors. The `<chat>` selector replaces `chat-ui`. Template override mechanism lets developers project `chatMessageTemplate` directives to replace defaults.

**Tech Stack:** Angular 21, Tailwind CSS (utility classes referencing CSS vars), CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-05-chat-ui-redesign.md`

---

## File Structure

```
libs/chat/src/lib/
  styles/
    chat-theme.css                              # NEW — CSS custom properties + dark/light
  compositions/
    chat/chat.component.ts                      # REWRITE — new template, selector chat → chat
    chat-interrupt-panel/...component.ts         # RESTYLE — theme vars
    chat-tool-call-card/...component.ts          # RESTYLE — theme vars
    chat-subagent-card/...component.ts           # RESTYLE — theme vars
    chat-debug/chat-debug.component.ts           # RESTYLE — theme vars
  primitives/
    chat-input/chat-input.component.ts           # RESTYLE — pill input
    chat-typing-indicator/...component.ts        # RESTYLE — dot animation
    chat-error/...component.ts                   # RESTYLE — themed banner
cockpit/langgraph/streaming/angular/
  src/app/streaming.component.ts                 # UPDATE — chat-ui → chat
```

---

### Task 1: Create Theme CSS File

**Files:**
- Create: `libs/chat/src/lib/styles/chat-theme.css`

- [ ] **Step 1: Create the theme CSS file**

Create `libs/chat/src/lib/styles/chat-theme.css`:

```css
/* SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 */

/*
 * @cacheplane/chat theme system
 *
 * All visual properties are exposed as CSS custom properties.
 * Override any property at your app level to customize.
 *
 * Dark mode is the default. Light mode activates via:
 *   - prefers-color-scheme: light (automatic)
 *   - [data-chat-theme="light"] attribute (manual)
 */

:host {
  /* Surfaces */
  --chat-bg: #171717;
  --chat-bg-alt: #222222;
  --chat-bg-hover: #2a2a2a;

  /* Text */
  --chat-text: #e0e0e0;
  --chat-text-muted: #777777;
  --chat-text-placeholder: #666666;

  /* Borders */
  --chat-border: #333333;
  --chat-border-light: #2a2a2a;

  /* User messages */
  --chat-user-bg: #2a2a2a;
  --chat-user-text: #f5f5f5;
  --chat-user-border: #333333;

  /* Avatar */
  --chat-avatar-bg: #333333;
  --chat-avatar-text: #aaaaaa;

  /* Input */
  --chat-input-bg: #222222;
  --chat-input-border: #333333;
  --chat-input-focus-border: #555555;
  --chat-send-bg: #444444;
  --chat-send-text: #aaaaaa;

  /* Status */
  --chat-error-bg: #2d1515;
  --chat-error-text: #f87171;
  --chat-warning-bg: #2d2315;
  --chat-warning-text: #fbbf24;
  --chat-success: #4ade80;

  /* Geometry */
  --chat-radius-message: 20px;
  --chat-radius-input: 24px;
  --chat-radius-card: 12px;
  --chat-radius-avatar: 8px;
  --chat-max-width: 720px;

  /* Typography */
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --chat-font-size: 15px;
  --chat-line-height: 1.6;

  font-family: var(--chat-font-family);
  font-size: var(--chat-font-size);
  line-height: var(--chat-line-height);
  color: var(--chat-text);
  background: var(--chat-bg);
}

/* Light mode — automatic via system preference */
@media (prefers-color-scheme: light) {
  :host:not([data-chat-theme="dark"]) {
    --chat-bg: #ffffff;
    --chat-bg-alt: #f5f5f5;
    --chat-bg-hover: #ebebeb;

    --chat-text: #1a1a1a;
    --chat-text-muted: #999999;
    --chat-text-placeholder: #999999;

    --chat-border: #e5e5e5;
    --chat-border-light: #f0f0f0;

    --chat-user-bg: #f0f0f0;
    --chat-user-text: #1a1a1a;
    --chat-user-border: transparent;

    --chat-avatar-bg: #f0f0f0;
    --chat-avatar-text: #666666;

    --chat-input-bg: #f5f5f5;
    --chat-input-border: #e5e5e5;
    --chat-input-focus-border: #cccccc;
    --chat-send-bg: #e5e5e5;
    --chat-send-text: #999999;

    --chat-error-bg: #fef2f2;
    --chat-error-text: #dc2626;
    --chat-warning-bg: #fffbeb;
    --chat-warning-text: #d97706;
    --chat-success: #16a34a;
  }
}

/* Light mode — manual override */
:host([data-chat-theme="light"]) {
  --chat-bg: #ffffff;
  --chat-bg-alt: #f5f5f5;
  --chat-bg-hover: #ebebeb;

  --chat-text: #1a1a1a;
  --chat-text-muted: #999999;
  --chat-text-placeholder: #999999;

  --chat-border: #e5e5e5;
  --chat-border-light: #f0f0f0;

  --chat-user-bg: #f0f0f0;
  --chat-user-text: #1a1a1a;
  --chat-user-border: transparent;

  --chat-avatar-bg: #f0f0f0;
  --chat-avatar-text: #666666;

  --chat-input-bg: #f5f5f5;
  --chat-input-border: #e5e5e5;
  --chat-input-focus-border: #cccccc;
  --chat-send-bg: #e5e5e5;
  --chat-send-text: #999999;

  --chat-error-bg: #fef2f2;
  --chat-error-text: #dc2626;
  --chat-warning-bg: #fffbeb;
  --chat-warning-text: #d97706;
  --chat-success: #16a34a;
}

/* Typing indicator animation */
@keyframes chat-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/styles/chat-theme.css
git commit -m "feat(chat): add CSS custom property theme system with dark/light modes"
```

---

### Task 2: Redesign `<chat>` Composition (selector `chat-ui` → `chat`)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `libs/chat/src/lib/compositions/chat/chat.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  contentChildren,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentRef } from '@cacheplane/angular';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { messageContent } from '../shared/message-utils';

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
    ChatThreadListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../../styles/chat-theme.css'],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
  `],
  template: `
    <div class="flex flex-1 min-h-0">
      <!-- Thread sidebar (optional) -->
      @if (threads().length > 0) {
        <div
          class="w-64 shrink-0 overflow-y-auto border-r"
          style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
        >
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border);">
            <h2
              class="text-xs font-semibold uppercase tracking-wide"
              style="color: var(--chat-text-muted);"
            >Threads</h2>
          </div>
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          >
            <ng-template let-thread let-isActive="isActive">
              <button
                class="w-full text-left px-3 py-2 text-sm transition-colors"
                [style.background]="isActive ? 'var(--chat-bg-hover)' : 'transparent'"
                [style.color]="isActive ? 'var(--chat-text)' : 'var(--chat-text-muted)'"
                [style.font-weight]="isActive ? '500' : '400'"
                (click)="threadSelected.emit(thread.id)"
              >
                {{ thread.id }}
              </button>
            </ng-template>
          </chat-thread-list>
        </div>
      }

      <!-- Chat area -->
      <div class="flex flex-col flex-1 min-w-0">
        <!-- Messages (scrollable, centered column) -->
        <div class="flex-1 overflow-y-auto">
          <div
            class="mx-auto w-full px-5 py-6"
            style="max-width: var(--chat-max-width);"
          >
            <div class="space-y-5">
              <chat-messages [ref]="ref()">
                <!-- Human message: subtle surface bubble, right-aligned -->
                <ng-template chatMessageTemplate="human" let-message>
                  <div class="flex justify-end">
                    <div
                      class="px-[18px] py-3"
                      style="
                        max-width: 75%;
                        background: var(--chat-user-bg);
                        color: var(--chat-user-text);
                        border: 1px solid var(--chat-user-border);
                        border-radius: var(--chat-radius-message) var(--chat-radius-message) 6px var(--chat-radius-message);
                        line-height: var(--chat-line-height);
                        letter-spacing: -0.01em;
                      "
                    >{{ messageContent(message) }}</div>
                  </div>
                </ng-template>

                <!-- AI message: no bubble, plain text with avatar -->
                <ng-template chatMessageTemplate="ai" let-message>
                  <div class="flex justify-start px-1">
                    <div style="max-width: 85%;">
                      <div class="flex items-center gap-2 mb-2">
                        <div
                          class="flex items-center justify-center font-semibold"
                          style="
                            width: 24px; height: 24px;
                            border-radius: var(--chat-radius-avatar);
                            background: var(--chat-avatar-bg);
                            color: var(--chat-avatar-text);
                            font-size: 11px;
                          "
                        >A</div>
                        <span
                          class="text-xs font-medium"
                          style="color: var(--chat-text-muted);"
                        >Assistant</span>
                      </div>
                      <div
                        style="
                          color: var(--chat-text);
                          line-height: var(--chat-line-height);
                          letter-spacing: -0.01em;
                        "
                      >{{ messageContent(message) }}</div>
                    </div>
                  </div>
                </ng-template>

                <!-- Tool message: monospace, subtle card -->
                <ng-template chatMessageTemplate="tool" let-message>
                  <div class="flex justify-start px-1">
                    <div
                      class="text-sm font-mono px-3 py-2"
                      style="
                        max-width: 75%;
                        background: var(--chat-bg-alt);
                        color: var(--chat-text-muted);
                        border: 1px solid var(--chat-border);
                        border-radius: var(--chat-radius-card);
                      "
                    >{{ messageContent(message) }}</div>
                  </div>
                </ng-template>

                <!-- System message: centered, muted -->
                <ng-template chatMessageTemplate="system" let-message>
                  <div class="flex justify-center">
                    <div
                      class="text-xs italic"
                      style="color: var(--chat-text-muted);"
                    >{{ messageContent(message) }}</div>
                  </div>
                </ng-template>
              </chat-messages>

              <!-- Typing indicator -->
              <chat-typing-indicator [ref]="ref()" />
            </div>
          </div>
        </div>

        <!-- Interrupt banner -->
        <chat-interrupt [ref]="ref()">
          <ng-template let-interrupt>
            <div
              class="px-4 py-3 border-t"
              style="
                background: var(--chat-warning-bg);
                border-color: var(--chat-border);
                color: var(--chat-warning-text);
              "
            >
              <p class="text-sm">Agent paused: {{ interrupt.value }}</p>
            </div>
          </ng-template>
        </chat-interrupt>

        <!-- Error banner -->
        <chat-error [ref]="ref()" />

        <!-- Input area (centered column) -->
        <div
          class="border-t"
          style="border-color: var(--chat-border);"
        >
          <div
            class="mx-auto w-full px-5 py-4"
            style="max-width: var(--chat-max-width);"
          >
            <chat-input
              [ref]="ref()"
              [submitOnEnter]="true"
              placeholder="Message..."
            />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ChatComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();

  // Message templates are intentionally co-located (shadcn copy-paste model)
  readonly messageContent = messageContent;
}
```

- [ ] **Step 2: Run tests**

Run: `npx nx test chat`

Expected: All tests pass (no logic changes, only template/style changes).

- [ ] **Step 3: Run build**

Run: `npx nx build chat`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): redesign <chat> composition — Apple-clean aesthetic with theme vars"
```

---

### Task 3: Restyle ChatInput Primitive (Pill Input)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`

- [ ] **Step 1: Update the template**

Replace the template in `chat-input.component.ts` with the pill-shaped input design. Keep all logic (`onSubmit`, `onKeydown`, signals) unchanged — only modify the `template` string:

```typescript
  template: `
    <form
      (submit)="onSubmit(); $event.preventDefault()"
      class="flex items-center gap-2.5"
      style="
        background: var(--chat-input-bg, #222);
        border: 1px solid var(--chat-input-border, #333);
        border-radius: var(--chat-radius-input, 24px);
        padding: 10px 14px 10px 18px;
        transition: border-color 0.2s;
      "
    >
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        (keydown.enter)="onKeydown($any($event))"
        (focus)="focused = true"
        (blur)="focused = false"
        rows="1"
        class="flex-1 bg-transparent border-none outline-none resize-none"
        style="
          color: var(--chat-text, #e0e0e0);
          font-family: var(--chat-font-family, inherit);
          font-size: var(--chat-font-size, 15px);
          line-height: 1.5;
          max-height: 120px;
        "
      ></textarea>
      <button
        type="submit"
        [disabled]="isDisabled()"
        class="flex items-center justify-center shrink-0 transition-colors"
        style="
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--chat-send-bg, #444);
          color: var(--chat-send-text, #aaa);
          border: none;
          cursor: pointer;
        "
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </form>
  `,
```

Also add a `focused` field to the class:

```typescript
  focused = false;
```

- [ ] **Step 2: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-input/chat-input.component.ts
git commit -m "feat(chat): restyle ChatInput as pill-shaped with theme vars"
```

---

### Task 4: Restyle ChatTypingIndicator (Dot Animation)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`

- [ ] **Step 1: Update the template and add styles**

Replace the template with the themed dot animation. Add `styleUrls` pointing to the theme CSS and inline the animation. Keep all logic unchanged.

```typescript
  template: `
    @if (visible()) {
      <div class="flex justify-start px-1" role="status" aria-label="Agent is typing">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div
              class="flex items-center justify-center font-semibold"
              style="
                width: 24px; height: 24px;
                border-radius: var(--chat-radius-avatar, 8px);
                background: var(--chat-avatar-bg, #333);
                color: var(--chat-avatar-text, #aaa);
                font-size: 11px;
              "
            >A</div>
            <span
              class="text-xs font-medium"
              style="color: var(--chat-text-muted, #777);"
            >Assistant</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="chat-dot" style="animation-delay: 0s;"></span>
            <span class="chat-dot" style="animation-delay: 0.2s;"></span>
            <span class="chat-dot" style="animation-delay: 0.4s;"></span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .chat-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--chat-text-muted, #777);
      animation: chat-dot-pulse 1.4s ease-in-out infinite;
    }
    @keyframes chat-dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
  `],
```

- [ ] **Step 2: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts
git commit -m "feat(chat): restyle ChatTypingIndicator with dot animation and theme vars"
```

---

### Task 5: Restyle ChatError (Themed Banner)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`

- [ ] **Step 1: Update the template**

```typescript
  template: `
    @if (errorMessage(); as msg) {
      <div
        class="px-4 py-3 text-sm"
        style="
          background: var(--chat-error-bg, #2d1515);
          color: var(--chat-error-text, #f87171);
          border-radius: var(--chat-radius-card, 12px);
        "
        role="alert"
      >{{ msg }}</div>
    }
  `,
```

- [ ] **Step 2: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-error/chat-error.component.ts
git commit -m "feat(chat): restyle ChatError with theme vars"
```

---

### Task 6: Restyle ChatInterruptPanel

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`

- [ ] **Step 1: Replace the template with themed version**

Replace the template. All logic (`interrupt`, `interruptPayload`, `action` output) stays unchanged.

```typescript
  template: `
    @if (interrupt()) {
      <div
        class="p-4 space-y-3"
        style="
          background: var(--chat-warning-bg, #2d2315);
          border: 1px solid var(--chat-border, #333);
          border-radius: var(--chat-radius-card, 12px);
        "
      >
        <div class="flex items-start gap-2">
          <span style="color: var(--chat-warning-text, #fbbf24);">⚠</span>
          <div class="flex-1">
            <h3 class="text-sm font-semibold" style="color: var(--chat-warning-text, #fbbf24);">Agent Interrupt</h3>
            <p class="text-sm mt-1" style="color: var(--chat-text-muted, #777);">{{ interruptPayload() }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 text-sm font-medium transition-colors"
            style="border-radius: var(--chat-radius-card, 12px); background: var(--chat-bg-alt, #222); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
            (click)="action.emit('accept')"
          >Accept</button>
          <button
            class="px-3 py-1.5 text-sm font-medium transition-colors"
            style="border-radius: var(--chat-radius-card, 12px); background: var(--chat-bg-alt, #222); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
            (click)="action.emit('edit')"
          >Edit</button>
          <button
            class="px-3 py-1.5 text-sm font-medium transition-colors"
            style="border-radius: var(--chat-radius-card, 12px); background: var(--chat-bg-alt, #222); color: var(--chat-text, #e0e0e0); border: 1px solid var(--chat-border, #333);"
            (click)="action.emit('respond')"
          >Respond</button>
          <button
            class="px-3 py-1.5 text-sm font-medium transition-colors"
            style="border-radius: var(--chat-radius-card, 12px); background: transparent; color: var(--chat-text-muted, #777); border: 1px solid var(--chat-border, #333);"
            (click)="action.emit('ignore')"
          >Ignore</button>
        </div>
      </div>
    }
  `,
```

- [ ] **Step 2: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts
git commit -m "feat(chat): restyle ChatInterruptPanel with neutral theme vars"
```

---

### Task 7: Restyle ChatToolCallCard and ChatSubagentCard

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`

- [ ] **Step 1: Update ChatToolCallCard template**

Replace all hardcoded Tailwind color classes with theme var equivalents. Key changes:
- `border-gray-200 bg-gray-50` → `style="border: 1px solid var(--chat-border); background: var(--chat-bg-alt); border-radius: var(--chat-radius-card);"`
- `text-gray-700` → `style="color: var(--chat-text);"`
- `text-gray-400` → `style="color: var(--chat-text-muted);"`
- `text-gray-500` → `style="color: var(--chat-text-muted);"`
- `hover:bg-gray-100` → `onmouseover` or CSS `:hover` with var
- `text-green-600` → `style="color: var(--chat-success);"`

- [ ] **Step 2: Update ChatSubagentCard template**

Same pattern. Replace all hardcoded colors with theme vars. Status badge colors:
- pending: `background: var(--chat-bg-alt); color: var(--chat-text-muted);`
- running: `background: var(--chat-warning-bg); color: var(--chat-warning-text);`
- complete: `background: transparent; color: var(--chat-success);`
- error: `background: var(--chat-error-bg); color: var(--chat-error-text);`

- [ ] **Step 3: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-tool-call-card/ libs/chat/src/lib/compositions/chat-subagent-card/
git commit -m "feat(chat): restyle ToolCallCard and SubagentCard with theme vars"
```

---

### Task 8: Restyle ChatDebug Composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`

- [ ] **Step 1: Update the template**

Apply the same patterns as `<chat>`: centered column for messages, theme vars for all colors, avatar + label for AI messages, pill input. The debug panel sidebar also uses theme vars:

Key changes:
- Message templates: identical to `<chat>` (asymmetric bubble for human, plain text + avatar for AI)
- Debug panel: `background: var(--chat-bg); border-color: var(--chat-border);`
- Headers, labels: `color: var(--chat-text-muted);`
- Cards, sections: `border-color: var(--chat-border); background: var(--chat-bg-alt);`
- Add `styleUrls: ['../../styles/chat-theme.css']`

- [ ] **Step 2: Run tests and build**

Run: `npx nx test chat && npx nx build chat`

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts
git commit -m "feat(chat): restyle ChatDebug with theme vars"
```

---

### Task 9: Update Streaming Example Selector

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`

- [ ] **Step 1: Update selector from `chat-ui` to `chat`**

Change:
```typescript
  template: `<chat-ui [ref]="stream" class="block h-screen" />`,
```
To:
```typescript
  template: `<chat [ref]="stream" class="block h-screen" />`,
```

Also update the JSDoc comment to reference `<chat>` instead of `<chat-ui>`.

- [ ] **Step 2: Build the streaming example**

Run: `npx nx build cockpit-langgraph-streaming-angular`

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/angular/src/app/streaming.component.ts
git commit -m "fix(cockpit): update streaming example selector chat-ui → chat"
```

---

### Task 10: Full Verification

- [ ] **Step 1: Run all library tests**

Run: `npx nx test render && npx nx test chat && npx nx test angular`

Expected: All pass.

- [ ] **Step 2: Run lint**

Run: `npx nx lint chat`

Expected: Clean (or only pre-existing warnings).

- [ ] **Step 3: Build both libraries**

Run: `npx nx build render && npx nx build chat`

Expected: Both succeed.

- [ ] **Step 4: Build streaming example**

Run: `npx nx build cockpit-langgraph-streaming-angular`

Expected: Succeeds.

- [ ] **Step 5: Serve and visually verify**

Run: `npx nx serve cockpit-langgraph-streaming-angular`

Open in browser. Verify:
- Dark mode renders (dark bg, neutral gray messages, pill input)
- Toggle system preference to light → light mode renders
- Messages use asymmetric border-radius for human, no bubble for AI
- Input is pill-shaped with circular send button
- Content column is centered at 720px max-width
- Mobile: resize browser narrow — full-bleed, larger message width %

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Theme CSS file | 1 new file |
| 2 | Redesign `<chat>` composition | 1 file rewrite |
| 3 | Pill-shaped ChatInput | 1 file template update |
| 4 | Dot animation ChatTypingIndicator | 1 file template + styles |
| 5 | Themed ChatError | 1 file template update |
| 6 | Themed ChatInterruptPanel | 1 file template update |
| 7 | Themed ToolCallCard + SubagentCard | 2 files template update |
| 8 | Themed ChatDebug | 1 file template update |
| 9 | Streaming example selector fix | 1 file |
| 10 | Full verification | Tests + build + visual |
