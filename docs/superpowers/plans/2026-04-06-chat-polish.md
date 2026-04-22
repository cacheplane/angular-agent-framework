# Chat Library Ship-Readiness Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 19 audit issues in `@cacheplane/chat` — convert all components to Tailwind, consolidate duplicated theme CSS, add auto-scroll, textarea auto-expand, markdown rendering, empty state, responsive sidebar, SVG icons, ARIA, and clean up the public API. The library must build and ship correctly via ng-packagr.

**Architecture:** All components use Tailwind utility classes with `[var(--chat-*)]` arbitrary values for theme-aware styling. CSS custom properties are defined once in a shared TypeScript constant and imported by composition components. ng-packagr preserves Tailwind class names in compiled templates; the consuming app's Tailwind build generates the CSS. `marked` is added as a peer dep for markdown rendering.

**Tech Stack:** Angular 20+, Tailwind CSS v4, `marked` (markdown), ng-packagr, Vitest

**Parallelism:** Tasks 2–5 are independent and can be dispatched as parallel subagents after Task 1 completes. Task 6 depends on Tasks 2+3. Task 7 is final.

---

## File Structure

### New files
- `libs/chat/src/lib/styles/chat-theme.ts` — Shared CSS custom property definitions (replaces `chat-theme.css`)
- `libs/chat/src/lib/styles/chat-icons.ts` — SVG icon constants (replaces emoji)
- `libs/chat/src/lib/styles/chat-markdown.ts` — Markdown rendering utility + prose styles

### Modified files
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — Tailwind + auto-scroll + empty state + responsive sidebar
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` — Tailwind + auto-scroll + shared theme
- `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-state-diff.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-state-inspector.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-checkpoint-card.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts` — Theme-aware colors
- `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts` — Tailwind + SVG icons
- `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts` — Tailwind + SVG icons
- `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts` — Tailwind + SVG icons
- `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts` — Theme-aware colors
- `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts` — Tailwind + auto-expand + focused signal
- `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts` — Tailwind
- `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts` — CSS var colors
- `libs/chat/src/lib/provide-chat.ts` — Typed ChatConfig
- `libs/chat/src/public-api.ts` — Remove legacy, add new exports
- `libs/chat/package.json` — Add marked peer dep
- `cockpit/*/angular/src/styles.css` (14 files) — Add @source for chat library

### Deleted files
- `libs/chat/src/lib/styles/chat-theme.css` — Replaced by `chat-theme.ts`
- `libs/chat/src/lib/chat.component.ts` — Legacy `cp-chat` component
- `libs/chat/src/lib/chat-input.component.ts` — Legacy input component
- `libs/chat/src/lib/chat-message.component.ts` — Legacy message component

---

## Task 1: Theme System Consolidation

**Fixes:** Blocker #3 (theme CSS triplicated 6x), Medium #11 (CSS var fallback inconsistency)

**Files:**
- Create: `libs/chat/src/lib/styles/chat-theme.ts`
- Create: `libs/chat/src/lib/styles/chat-icons.ts`
- Create: `libs/chat/src/lib/styles/chat-markdown.ts`
- Delete: `libs/chat/src/lib/styles/chat-theme.css`

- [ ] **Step 1: Create `chat-theme.ts` with shared CSS custom property definitions**

```typescript
// libs/chat/src/lib/styles/chat-theme.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

const DARK = `
  --chat-bg: #171717;
  --chat-bg-alt: #222222;
  --chat-bg-hover: #2a2a2a;
  --chat-text: #e0e0e0;
  --chat-text-muted: #777777;
  --chat-text-placeholder: #666666;
  --chat-border: #333333;
  --chat-border-light: #2a2a2a;
  --chat-user-bg: #2a2a2a;
  --chat-user-text: #f5f5f5;
  --chat-user-border: #333333;
  --chat-avatar-bg: #333333;
  --chat-avatar-text: #aaaaaa;
  --chat-input-bg: #222222;
  --chat-input-border: #333333;
  --chat-input-focus-border: #555555;
  --chat-send-bg: #444444;
  --chat-send-text: #aaaaaa;
  --chat-error-bg: #2d1515;
  --chat-error-text: #f87171;
  --chat-warning-bg: #2d2315;
  --chat-warning-text: #fbbf24;
  --chat-success: #4ade80;
  --chat-radius-message: 20px;
  --chat-radius-input: 24px;
  --chat-radius-card: 12px;
  --chat-radius-avatar: 8px;
  --chat-max-width: 720px;
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --chat-font-size: 15px;
  --chat-line-height: 1.6;
`;

const LIGHT = `
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
`;

/**
 * Shared theme styles for chat composition components.
 * Defines CSS custom properties on :host for dark/light mode.
 * Import into any composition's `styles` array.
 */
export const CHAT_THEME_STYLES = `
  :host {
    ${DARK}
    font-family: var(--chat-font-family);
    font-size: var(--chat-font-size);
    line-height: var(--chat-line-height);
    color: var(--chat-text);
    background: var(--chat-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  @media (prefers-color-scheme: light) {
    :host:not([data-chat-theme="dark"]) { ${LIGHT} }
  }
  :host([data-chat-theme="light"]) { ${LIGHT} }
`;
```

- [ ] **Step 2: Create `chat-icons.ts` with SVG icon constants**

Replaces emoji characters (⚙ ⚠ 🤖 ▲ ▼ ✓) with inline SVG strings for consistent cross-platform rendering.

```typescript
// libs/chat/src/lib/styles/chat-icons.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** Chevron down (▼ replacement). 12x12, stroke-based. */
export const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5L6 7.5L9 4.5"/></svg>`;

/** Chevron up (▲ replacement). 12x12, stroke-based. */
export const ICON_CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5L6 4.5L9 7.5"/></svg>`;

/** Gear icon (⚙ replacement). 14x14. */
export const ICON_TOOL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;

/** Warning triangle (⚠ replacement). 18x18. */
export const ICON_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

/** Robot/agent icon (🤖 replacement). 14x14. */
export const ICON_AGENT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`;

/** Check mark (✓ replacement). 12x12. */
export const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6L5 8.5L9.5 3.5"/></svg>`;

/** Send arrow (for chat input). 16x16. */
export const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V4M8 4L4 8M8 4L12 8"/></svg>`;
```

- [ ] **Step 3: Create `chat-markdown.ts` with markdown rendering utility**

```typescript
// libs/chat/src/lib/styles/chat-markdown.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { SecurityContext } from '@angular/core';
import type { DomSanitizer, SafeHtml } from '@angular/platform-browser';

let markedParse: ((src: string) => string) | null = null;
let markedLoaded = false;

function loadMarked(): void {
  if (markedLoaded) return;
  markedLoaded = true;
  try {
    // Dynamic require — marked is an optional peer dep
    const m = require('marked');
    markedParse = (src: string) => m.marked.parse(src, { async: false }) as string;
  } catch {
    markedParse = null;
  }
}

/**
 * Renders markdown content to sanitized HTML.
 * Falls back to plain text with newline→br conversion if `marked` is not installed.
 */
export function renderMarkdown(content: string, sanitizer: DomSanitizer): SafeHtml {
  loadMarked();
  if (markedParse) {
    const html = markedParse(content);
    return sanitizer.bypassSecurityTrustHtml(
      sanitizer.sanitize(SecurityContext.HTML, html) ?? ''
    );
  }
  // Fallback: escape HTML and convert newlines to <br>
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return sanitizer.bypassSecurityTrustHtml(escaped);
}

/**
 * CSS for styling rendered markdown HTML.
 * Uses .chat-md class prefix to avoid global conflicts.
 * Must be included in a component with ViewEncapsulation.None or via ::ng-deep.
 */
export const CHAT_MARKDOWN_STYLES = `
  .chat-md p { margin: 0 0 0.75em; }
  .chat-md p:last-child { margin-bottom: 0; }
  .chat-md code {
    background: var(--chat-bg-alt);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.875em;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  .chat-md pre {
    background: var(--chat-bg-alt);
    padding: 12px 16px;
    border-radius: var(--chat-radius-card);
    overflow-x: auto;
    margin: 0.75em 0;
  }
  .chat-md pre code { background: none; padding: 0; }
  .chat-md ul, .chat-md ol { margin: 0.5em 0; padding-left: 1.5em; }
  .chat-md li { margin: 0.25em 0; }
  .chat-md a { color: var(--chat-text); text-decoration: underline; }
  .chat-md strong { font-weight: 600; }
  .chat-md blockquote {
    border-left: 3px solid var(--chat-border);
    padding-left: 12px;
    margin: 0.75em 0;
    color: var(--chat-text-muted);
  }
  .chat-md h1, .chat-md h2, .chat-md h3, .chat-md h4 { margin: 1em 0 0.5em; font-weight: 600; }
  .chat-md h1 { font-size: 1.25em; }
  .chat-md h2 { font-size: 1.125em; }
  .chat-md h3 { font-size: 1em; }
  .chat-md table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
  .chat-md th, .chat-md td { border: 1px solid var(--chat-border); padding: 6px 12px; text-align: left; }
  .chat-md th { background: var(--chat-bg-alt); font-weight: 600; font-size: 0.875em; }
`;
```

- [ ] **Step 4: Delete `chat-theme.css`**

```bash
rm libs/chat/src/lib/styles/chat-theme.css
```

- [ ] **Step 5: Run tests to verify no regressions**

```bash
npx nx test chat
```

Expected: All 112 tests still pass (no component imports chat-theme.css directly).

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/styles/
git commit -m "feat(chat): consolidate theme into shared TS module, add icons + markdown utils"
```

---

## Task 2: ChatComponent Overhaul

**Fixes:** Blocker #4 (auto-scroll), High #9 (empty state), High #10 (responsive sidebar), Medium #14 (ARIA)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Test: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`

**Depends on:** Task 1

- [ ] **Step 1: Rewrite ChatComponent with Tailwind, auto-scroll, empty state, responsive sidebar, ARIA, and markdown**

Replace the entire file:

```typescript
// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { AgentRef } from '@cacheplane/langgraph';
import { ChatMessagesComponent } from '../../primitives/chat-messages/chat-messages.component';
import { MessageTemplateDirective } from '../../primitives/chat-messages/message-template.directive';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { messageContent } from '../shared/message-utils';
import { CHAT_THEME_STYLES } from '../../styles/chat-theme';
import { CHAT_MARKDOWN_STYLES, renderMarkdown } from '../../styles/chat-markdown';

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
  encapsulation: ViewEncapsulation.None,
  styles: [CHAT_THEME_STYLES, CHAT_MARKDOWN_STYLES],
  template: `
    <div class="flex h-full overflow-hidden">
      <!-- Thread sidebar (optional, hidden on mobile) -->
      @if (threads().length > 0) {
        <div
          class="hidden md:flex w-64 flex-col flex-shrink-0 border-r overflow-y-auto"
          [class]="sidebarOpen() ? '!flex' : ''"
          style="border-color: var(--chat-border); background: var(--chat-bg-alt);"
          role="navigation"
          aria-label="Thread list"
        >
          <div class="px-3 py-2 border-b" style="border-color: var(--chat-border);">
            <h2 class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--chat-text-muted);">Threads</h2>
          </div>
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          >
            <ng-template let-thread let-isActive="isActive">
              <button
                class="w-full text-left px-3 py-2 text-sm border-0 cursor-pointer transition-colors duration-150"
                [style.background]="isActive ? 'var(--chat-bg-hover)' : 'transparent'"
                [style.fontWeight]="isActive ? '500' : '400'"
                [style.color]="'var(--chat-text)'"
                [attr.aria-current]="isActive ? 'true' : null"
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
        <!-- Messages area (scrollable) -->
        <div
          #scrollContainer
          class="flex-1 overflow-y-auto px-5 py-6"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <div class="max-w-[var(--chat-max-width)] mx-auto flex flex-col gap-5">
            @if (ref().messages().length === 0 && !ref().isLoading()) {
              <!-- Empty state -->
              <div class="flex flex-col items-center justify-center py-20 gap-3" role="status">
                <div
                  class="w-10 h-10 flex items-center justify-center text-sm font-semibold"
                  style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                >A</div>
                <p class="text-sm" style="color: var(--chat-text-muted);">Send a message to start a conversation.</p>
              </div>
            }

            <chat-messages [ref]="ref()">
              <!-- Human messages: right-aligned bubble -->
              <ng-template chatMessageTemplate="human" let-message>
                <div class="flex justify-end">
                  <div
                    class="max-w-[75%] px-4 py-2.5 text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)] break-words border"
                    style="background: var(--chat-user-bg); color: var(--chat-user-text); border-color: var(--chat-user-border); border-radius: var(--chat-radius-message) var(--chat-radius-message) 6px var(--chat-radius-message);"
                  >{{ messageContent(message) }}</div>
                </div>
              </ng-template>

              <!-- AI messages: no bubble, avatar + markdown -->
              <ng-template chatMessageTemplate="ai" let-message>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0"
                      style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
                    >A</div>
                    <span class="text-xs font-medium" style="color: var(--chat-text-muted);">Assistant</span>
                  </div>
                  <div
                    class="chat-md pl-8 break-words text-[length:var(--chat-font-size)] leading-[var(--chat-line-height)]"
                    style="color: var(--chat-text);"
                    [innerHTML]="renderMd(messageContent(message))"
                  ></div>
                </div>
              </ng-template>

              <!-- Tool messages: monospace card -->
              <ng-template chatMessageTemplate="tool" let-message>
                <div
                  class="px-3.5 py-2.5 font-mono text-[13px] break-words whitespace-pre-wrap border"
                  style="background: var(--chat-bg-alt); color: var(--chat-text); border-color: var(--chat-border); border-radius: var(--chat-radius-card);"
                >{{ messageContent(message) }}</div>
              </ng-template>

              <!-- System messages: centered italic -->
              <ng-template chatMessageTemplate="system" let-message>
                <div class="flex justify-center" role="status">
                  <span class="text-xs italic" style="color: var(--chat-text-muted);">
                    {{ messageContent(message) }}
                  </span>
                </div>
              </ng-template>
            </chat-messages>

            <chat-typing-indicator [ref]="ref()" />
          </div>
        </div>

        <!-- Interrupt banner -->
        <chat-interrupt [ref]="ref()">
          <ng-template let-interrupt>
            <div class="px-5 py-3 border-t" style="background: var(--chat-warning-bg); border-color: var(--chat-border);">
              <p class="text-sm m-0" style="color: var(--chat-warning-text);">Agent paused: {{ interrupt.value }}</p>
            </div>
          </ng-template>
        </chat-interrupt>

        <!-- Error banner -->
        <div class="px-5 pb-2">
          <chat-error [ref]="ref()" />
        </div>

        <!-- Input area -->
        <div class="border-t px-5 py-4" style="border-color: var(--chat-border);">
          <div class="max-w-[var(--chat-max-width)] mx-auto">
            <chat-input
              [ref]="ref()"
              [submitOnEnter]="true"
              placeholder="Type a message..."
            />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ChatComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly ref = input.required<AgentRef<any, any>>();
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();
  readonly sidebarOpen = signal(false);

  readonly messageContent = messageContent;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  /** Track message count to trigger auto-scroll */
  private readonly messageCount = computed(() => this.ref().messages().length);

  constructor() {
    // Auto-scroll to bottom when new messages arrive or loading state changes
    effect(() => {
      this.messageCount(); // track
      this.ref().isLoading(); // track
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        // Use setTimeout to run after render
        setTimeout(() => el.scrollTop = el.scrollHeight, 0);
      }
    });
  }

  renderMd(content: string) {
    return renderMarkdown(content, this.sanitizer);
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx nx test chat
```

Expected: All tests pass. The spec tests use `createMockAgentRef()` which doesn't depend on template rendering.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): convert ChatComponent to Tailwind, add auto-scroll + empty state + responsive sidebar"
```

---

## Task 3: ChatDebugComponent Overhaul

**Fixes:** Blocker #4 (auto-scroll), High #7 (duplicated templates), and theme-awareness for all debug sub-components

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-state-diff.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-state-inspector.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-checkpoint-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts`

**Depends on:** Task 1

- [ ] **Step 1: Rewrite ChatDebugComponent with shared theme + Tailwind + auto-scroll + markdown**

Same pattern as ChatComponent (Task 2) but with the debug panel. Key changes:
- Import `CHAT_THEME_STYLES` from shared module (eliminating the copy-pasted CSS vars)
- Import `CHAT_MARKDOWN_STYLES` and `renderMarkdown`
- Add `ViewEncapsulation.None` for markdown styles
- Add auto-scroll via `viewChild` + `effect()`
- Use Tailwind classes for all layout
- Use `[var(--chat-*)]` arbitrary values for theme colors
- Add `role="log"` and `aria-live="polite"` to messages area

The message templates should be identical to ChatComponent's templates (same 4 ng-template blocks). This is intentional — compositions co-locate their templates (shadcn model). The template code is the same as Task 2 Step 1.

- [ ] **Step 2: Convert debug-timeline.component.ts to use theme vars**

Replace hardcoded Tailwind colors with theme-var-based arbitrary values:
- `bg-blue-500` → `bg-[var(--chat-success)]` (selected indicator)
- `border-blue-500` → `border-[var(--chat-success)]`
- `bg-white` → `bg-[var(--chat-bg)]`
- `border-gray-300` → `border-[var(--chat-border)]`
- `bg-gray-200` → `bg-[var(--chat-border)]` (rail)
- Keep layout Tailwind classes (`relative`, `space-y-1`, `absolute`, etc.)

- [ ] **Step 3: Convert debug-checkpoint-card.component.ts to use theme vars**

Replace hardcoded colors:
- `border-blue-400 bg-blue-50` → `border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]`
- `border-gray-200 bg-white hover:bg-gray-50` → `border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]`
- `text-gray-700` → `text-[var(--chat-text)]`
- `bg-gray-100 text-gray-500` → `bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]`

- [ ] **Step 4: Convert debug-state-diff.component.ts to use theme vars**

Replace hardcoded colors:
- `bg-green-50 text-green-700` → `bg-[var(--chat-bg-alt)] text-[var(--chat-success)]`
- `bg-red-50 text-red-700` → `bg-[var(--chat-error-bg)] text-[var(--chat-error-text)]`
- `bg-amber-50 text-amber-700` → `bg-[var(--chat-warning-bg)] text-[var(--chat-warning-text)]`
- `text-gray-400` → `text-[var(--chat-text-muted)]`
- `text-gray-500` → `text-[var(--chat-text-muted)]`

- [ ] **Step 5: Convert debug-detail.component.ts to use theme vars**

Replace:
- `text-gray-500` → `text-[var(--chat-text-muted)]`

- [ ] **Step 6: Convert debug-state-inspector.component.ts to use theme vars**

Replace:
- `text-gray-700` → `text-[var(--chat-text)]`

- [ ] **Step 7: Convert debug-controls.component.ts to use theme vars**

Replace:
- `bg-gray-100 hover:bg-gray-200` → `bg-[var(--chat-bg-alt)] hover:bg-[var(--chat-bg-hover)]`
- `text-gray-500` → `text-[var(--chat-text-muted)]`

- [ ] **Step 8: Convert debug-summary.component.ts to use theme vars**

Replace:
- `text-gray-500` → `text-[var(--chat-text-muted)]`

- [ ] **Step 9: Run tests**

```bash
npx nx test chat
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/
git commit -m "feat(chat): convert ChatDebug + sub-components to theme-aware Tailwind"
```

---

## Task 4: Primitives Overhaul

**Fixes:** Blocker #1 (ChatError Tailwind), High #5 (textarea auto-expand), High #8 (focused signal)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`

**Depends on:** Task 1

- [ ] **Step 1: Rewrite ChatInputComponent with Tailwind, auto-expand textarea, and focused signal**

```typescript
// libs/chat/src/lib/primitives/chat-input/chat-input.component.ts
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
import type { AgentRef } from '@cacheplane/langgraph';
import { ICON_SEND } from '../../styles/chat-icons';

export function submitMessage(
  ref: AgentRef<any, any>,
  text: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  ref.submit({ messages: [{ role: 'human', content: trimmed }] });
  return trimmed;
}

@Component({
  selector: 'chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    textarea {
      field-sizing: content;
    }
  `],
  template: `
    <form
      (submit)="onSubmit(); $event.preventDefault()"
      class="flex items-end gap-2 px-4 py-2.5 pl-[18px] border transition-colors duration-150"
      [style.background]="'var(--chat-input-bg)'"
      [style.borderColor]="focused() ? 'var(--chat-input-focus-border)' : 'var(--chat-input-border)'"
      [style.borderRadius]="'var(--chat-radius-input)'"
      role="search"
      aria-label="Message input"
    >
      <textarea
        [(ngModel)]="messageText"
        name="messageText"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        (keydown.enter)="onKeydown($any($event))"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        rows="1"
        class="flex-1 bg-transparent border-0 outline-none resize-none max-h-[120px] overflow-y-auto"
        [style.color]="'var(--chat-text)'"
        [style.fontFamily]="'var(--chat-font-family)'"
        style="font-size: 15px; line-height: 1.6;"
        aria-label="Type a message"
      ></textarea>
      <button
        type="submit"
        [disabled]="isDisabled()"
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-0 cursor-pointer transition-colors duration-150 disabled:opacity-50"
        [style.background]="'var(--chat-send-bg)'"
        [style.color]="'var(--chat-send-text)'"
        aria-label="Send message"
        [innerHTML]="sendIcon"
      >
      </button>
    </form>
  `,
})
export class ChatInputComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly submitOnEnter = input<boolean>(true);
  readonly placeholder = input<string>('');
  readonly submitted = output<string>();
  readonly messageText = signal<string>('');
  readonly isDisabled = computed(() => this.ref().isLoading());
  readonly focused = signal(false);
  readonly sendIcon = ICON_SEND;

  onSubmit(): void {
    const submitted = submitMessage(this.ref(), this.messageText());
    if (submitted !== null) {
      this.submitted.emit(submitted);
      this.messageText.set('');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.submitOnEnter() && !event.shiftKey) {
      event.preventDefault();
      this.onSubmit();
    }
  }
}
```

Key changes:
- `focused` is now a `signal(false)` (fixes OnPush change detection)
- Textarea uses `field-sizing: content` CSS for auto-expand (modern browsers)
- All inline styles replaced with Tailwind classes + CSS var bindings
- ARIA labels added
- SVG icon replaces inline SVG string

- [ ] **Step 2: Rewrite ChatTypingIndicatorComponent with Tailwind**

```typescript
// libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentRef } from '@cacheplane/langgraph';

export function isTyping(ref: AgentRef<any, any>): boolean {
  return ref.isLoading();
}

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .chat-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--chat-text-muted);
      animation: chat-dot-pulse 1.4s ease-in-out infinite;
    }
    .chat-dot:nth-child(2) { animation-delay: 0.2s; }
    .chat-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes chat-dot-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
  `],
  template: `
    @if (visible()) {
      <div role="status" aria-label="Agent is typing" class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 flex items-center justify-center text-[11px] font-semibold shrink-0"
            style="background: var(--chat-avatar-bg); color: var(--chat-avatar-text); border-radius: var(--chat-radius-avatar);"
          >A</div>
          <span class="text-xs font-medium" style="color: var(--chat-text-muted);">Assistant</span>
          <div class="flex items-center gap-1 pl-1">
            <span class="chat-dot"></span>
            <span class="chat-dot"></span>
            <span class="chat-dot"></span>
          </div>
        </div>
      </div>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly visible = computed(() => this.ref().isLoading());
}
```

- [ ] **Step 3: Rewrite ChatErrorComponent — remove Tailwind classes, use CSS vars**

```typescript
// libs/chat/src/lib/primitives/chat-error/chat-error.component.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { AgentRef } from '@cacheplane/langgraph';

export function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

@Component({
  selector: 'chat-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errorMessage(); as msg) {
      <div
        class="px-4 py-3 text-sm"
        style="background: var(--chat-error-bg); color: var(--chat-error-text); border-radius: var(--chat-radius-card);"
        role="alert"
      >{{ msg }}</div>
    }
  `,
})
export class ChatErrorComponent {
  readonly ref = input.required<AgentRef<any, any>>();
  readonly errorMessage = computed(() => extractErrorMessage(this.ref().error()));
}
```

Note: `px-4 py-3 text-sm` are standard Tailwind layout classes that work with the consuming app's Tailwind build. The color/bg/radius use CSS vars via inline style. This is the correct hybrid approach.

- [ ] **Step 4: Run tests**

```bash
npx nx test chat
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/
git commit -m "feat(chat): convert primitives to Tailwind, add textarea auto-expand + focused signal"
```

---

## Task 5: Compositions Overhaul

**Fixes:** Blocker #2 (TimelineSlider unstyled without Tailwind), Medium #12 (emoji icons)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts`

**Depends on:** Task 1

- [ ] **Step 1: Rewrite ChatInterruptPanelComponent with Tailwind + SVG icon**

Replace `⚠` emoji with `ICON_WARNING` from chat-icons.ts. Convert inline styles to Tailwind + CSS var bindings. Add ARIA roles.

```typescript
// Key changes in template:
// - Replace <span style="...">⚠</span> with:
//   <span style="color: var(--chat-warning-text);" [innerHTML]="warningIcon"></span>
// - Convert all style="" attributes to Tailwind classes
// - Add role="alert" to the container
// In class:
//   readonly warningIcon = ICON_WARNING;
```

- [ ] **Step 2: Rewrite ChatToolCallCardComponent with Tailwind + SVG icons**

Replace `⚙` with `ICON_TOOL`, `✓` with `ICON_CHECK`, `▲`/`▼` with `ICON_CHEVRON_UP`/`ICON_CHEVRON_DOWN`. Convert inline styles to Tailwind + CSS var bindings.

```typescript
// Key changes:
// - Import ICON_TOOL, ICON_CHECK, ICON_CHEVRON_UP, ICON_CHEVRON_DOWN
// - Replace emoji spans with [innerHTML]="icon" spans
// - Convert all style="" to Tailwind classes
// - Add aria-expanded to button (already exists)
// - Add aria-label="Toggle tool call details" to button
```

- [ ] **Step 3: Rewrite ChatSubagentCardComponent with Tailwind + SVG icon**

Replace `🤖` with `ICON_AGENT`. Convert inline styles to Tailwind + CSS var bindings.

- [ ] **Step 4: Rewrite ChatTimelineSliderComponent with theme vars**

This component already uses Tailwind but with hardcoded colors. Convert to theme-var-based:
- `border-blue-300 bg-blue-50` → `border-[var(--chat-input-focus-border)] bg-[var(--chat-bg-hover)]`
- `border-gray-200 bg-white hover:bg-gray-50` → `border-[var(--chat-border)] bg-[var(--chat-bg)] hover:bg-[var(--chat-bg-hover)]`
- `bg-blue-600 text-white` → `bg-[var(--chat-send-bg)] text-[var(--chat-send-text)]` (selected indicator)
- `bg-gray-200 text-gray-500` → `bg-[var(--chat-bg-alt)] text-[var(--chat-text-muted)]` (unselected)
- `text-gray-500` → `text-[var(--chat-text-muted)]`
- `text-gray-400` → `text-[var(--chat-text-muted)]`
- `text-gray-700` → `text-[var(--chat-text)]`
- `bg-blue-100 text-blue-700 hover:bg-blue-200` → `bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)]`
- `bg-purple-100 text-purple-700 hover:bg-purple-200` → `bg-[var(--chat-bg-alt)] text-[var(--chat-text)] hover:bg-[var(--chat-bg-hover)]`

- [ ] **Step 5: Run tests**

```bash
npx nx test chat
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-interrupt-panel/ libs/chat/src/lib/compositions/chat-tool-call-card/ libs/chat/src/lib/compositions/chat-subagent-card/ libs/chat/src/lib/compositions/chat-timeline-slider/
git commit -m "feat(chat): convert remaining compositions to Tailwind with SVG icons + theme vars"
```

---

## Task 6: API Cleanup + Build Verification

**Fixes:** Medium #13 (selector prefix), Medium #15 (legacy export), Medium #16 (provideChat no-op), Low #19 (getMessageType fallthrough)

**Files:**
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/lib/provide-chat.ts`
- Modify: `libs/chat/src/lib/chat.types.ts`
- Modify: `libs/chat/package.json`
- Delete: `libs/chat/src/lib/chat.component.ts` (legacy cp-chat)
- Delete: `libs/chat/src/lib/chat-input.component.ts` (legacy)
- Delete: `libs/chat/src/lib/chat-message.component.ts` (legacy)

**Depends on:** Tasks 2–5

- [ ] **Step 1: Remove legacy component exports from public-api.ts**

Remove this line from `libs/chat/src/public-api.ts`:
```typescript
// DELETE: export { ChatComponent as LegacyChatComponent } from './lib/chat.component';
```

Add new exports:
```typescript
export { CHAT_THEME_STYLES } from './lib/styles/chat-theme';
export { CHAT_MARKDOWN_STYLES, renderMarkdown } from './lib/styles/chat-markdown';
export {
  ICON_CHEVRON_DOWN, ICON_CHEVRON_UP, ICON_TOOL,
  ICON_WARNING, ICON_AGENT, ICON_CHECK, ICON_SEND,
} from './lib/styles/chat-icons';
```

- [ ] **Step 2: Delete legacy component files**

```bash
rm libs/chat/src/lib/chat.component.ts
rm libs/chat/src/lib/chat-input.component.ts
rm libs/chat/src/lib/chat-message.component.ts
```

- [ ] **Step 3: Update ChatConfig in provide-chat.ts**

```typescript
// libs/chat/src/lib/provide-chat.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import type { AngularRegistry } from '@cacheplane/render';

export interface ChatConfig {
  /** Default render registry for generative UI components. */
  renderRegistry?: AngularRegistry;
  /** Override the default AI avatar label (default: "A"). */
  avatarLabel?: string;
  /** Override the default assistant display name (default: "Assistant"). */
  assistantName?: string;
}

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG');

export function provideChat(config: ChatConfig) {
  return makeEnvironmentProviders([
    { provide: CHAT_CONFIG, useValue: config },
  ]);
}
```

- [ ] **Step 4: Add `marked` as optional peer dep in package.json**

Edit `libs/chat/package.json` — add to peerDependencies and peerDependenciesMeta:

```json
{
  "peerDependencies": {
    "marked": "^15.0.0 || ^16.0.0"
  },
  "peerDependenciesMeta": {
    "marked": { "optional": true }
  }
}
```

- [ ] **Step 5: Update cockpit example styles.css to add @source for chat library**

In each cockpit Angular example's `src/styles.css`, add after the `@import "tailwindcss"` line:

```css
@source "../../../../../libs/chat/src/";
```

This tells Tailwind v4 to scan the chat library source for utility classes. Run this for all 14 examples:

```bash
for dir in cockpit/langgraph/*/angular/src cockpit/deep-agents/*/angular/src; do
  if [ -f "$dir/styles.css" ]; then
    # Add @source line after @import "tailwindcss" if not already present
    grep -q '@source.*libs/chat' "$dir/styles.css" || \
      sed -i '' 's|@import "tailwindcss";|@import "tailwindcss";\n@source "../../../../../libs/chat/src/";|' "$dir/styles.css"
  fi
done
```

- [ ] **Step 6: Run full test suite**

```bash
npx nx test chat
npx nx test render
npx nx test angular
```

Expected: All tests pass across all three libraries.

- [ ] **Step 7: Build the library**

```bash
npx nx build chat
```

Expected: Build succeeds. Check `dist/libs/chat/` for compiled output. Verify the package.json in the dist includes `marked` in peerDependencies.

- [ ] **Step 8: Build all cockpit examples**

```bash
npx nx run-many -t build --projects='cockpit-*-angular'
```

Expected: All 14 examples build successfully.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(chat): clean up public API, add marked peer dep, verify build"
```

---

## Summary of Issues Fixed

| # | Severity | Issue | Fixed In |
|---|----------|-------|----------|
| 1 | BLOCKER | ChatTimelineSlider unstyled without Tailwind | Task 5 Step 4 |
| 2 | BLOCKER | ChatError mixed Tailwind/inline | Task 4 Step 3 |
| 3 | BLOCKER | Theme CSS triplicated 6x | Task 1 |
| 4 | BLOCKER | No auto-scroll | Tasks 2, 3 |
| 5 | HIGH | No textarea auto-expand | Task 4 Step 1 |
| 6 | HIGH | No markdown rendering | Tasks 1, 2, 3 |
| 7 | HIGH | Message templates duplicated | Accepted (shadcn model) |
| 8 | HIGH | focused plain boolean with OnPush | Task 4 Step 1 |
| 9 | HIGH | No empty/welcome state | Task 2 |
| 10 | HIGH | Thread sidebar not responsive | Task 2 |
| 11 | MEDIUM | CSS var fallback inconsistency | Task 1 |
| 12 | MEDIUM | Emoji icons | Tasks 4, 5 |
| 13 | MEDIUM | No selector prefix | Accepted (design decision) |
| 14 | MEDIUM | Missing ARIA | Tasks 2, 3, 4 |
| 15 | MEDIUM | Legacy export | Task 6 |
| 16 | MEDIUM | provideChat no-op | Task 6 |
| 17 | LOW | Missing debug components | Out of scope (Tier 2) |
| 18 | LOW | No keyboard navigation | Out of scope (v2) |
| 19 | LOW | getMessageType fallthrough | Accepted (safe default) |

**Notes on accepted items:**
- **#7 (template duplication):** The shadcn model intentionally co-locates templates. Extracting them into a shared component would add coupling and make copy-paste customization harder. This is a design choice, not a bug.
- **#13 (selector prefix):** `chat` was an explicit design decision. Changing it is a breaking change.
- **#19 (getMessageType fallthrough):** Defaulting unknown types to 'ai' rendering is the safest UX choice — an unrecognized message type still renders rather than disappearing.
