# Chat scroll and input polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish chat scroll behavior and input sizing — final post-stream scroll, embed gap token, viewport-responsive multiline cap, and a pin/unpin state machine with a centered-bottom bubble that re-engages the user with the stream.

**Architecture:** Two work streams. Stream A (Tasks 1–3) is three independent quick fixes in existing files. Stream B (Tasks 4–7) introduces a `pinned` signal on the chat composition, a new `chat-scroll-bubble` primitive anchored above the input via the footer slot, and gating of the inline typing indicator.

**Tech Stack:** Angular 19 (signals, control flow), TypeScript, plain CSS strings under `libs/chat/src/lib/styles/`. Tests use Vitest + Angular TestBed (project already configured).

**Spec:** [docs/superpowers/specs/2026-05-11-chat-scroll-and-input-polish-design.md](../specs/2026-05-11-chat-scroll-and-input-polish-design.md)

---

## File map

**Modify:**
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — pin signal, scroll handler, programmatic-scroll flag, post-stream final-scroll effect, bubble integration, typing-indicator gating, footer wrapper styling.
- `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts` — replace fixed 200px cap with viewport-responsive cap.
- `libs/chat/src/lib/styles/chat-tokens.ts` — add `--ngaf-chat-input-gap` token.
- `libs/chat/src/lib/styles/chat-window.styles.ts` — apply `--ngaf-chat-input-gap` between body and footer.
- `libs/chat/src/public-api.ts` — export new primitive.

**Create:**
- `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.ts`
- `libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts`
- `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.spec.ts`
- `libs/chat/src/lib/compositions/chat/pin-state.spec.ts` — unit tests for pin computation helper

---

# Stream A — Quick fixes

## Task 1: Post-stream final scroll

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (around the existing auto-scroll effect at line ~355)

The existing effect fires on `messageCount` and last-message content changes. It does NOT fire when `agent().isLoading()` flips back to `false`, so the final layout (with `chat-message-actions` revealed) can sit below the fold.

- [ ] **Step 1: Add a second effect that reacts to loading flip**

Just below the existing auto-scroll effect, add:

```typescript
// Final scroll when streaming completes. The content-mutation effect above
// fires on every token but stops when streaming ends; action buttons
// (reload, copy) render on idle and can land below the fold without this.
effect(() => {
  const loading = this.agent().isLoading();
  if (loading) {
    this.wasLoading = true;
    return;
  }
  if (!this.wasLoading) return;
  this.wasLoading = false;
  const el = this.scrollContainer()?.nativeElement;
  if (!el) return;
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  if (isNearBottom) {
    // Defer one frame so message-actions have rendered.
    requestAnimationFrame(() => {
      const el2 = this.scrollContainer()?.nativeElement;
      if (el2) el2.scrollTop = el2.scrollHeight;
    });
  }
});
```

And add the field next to `prevMessageCount`:

```typescript
private wasLoading = false;
```

- [ ] **Step 2: Run typecheck**

Run: `npx nx run chat:typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "fix(chat): final scroll when streaming completes so action buttons stay visible"
```

---

## Task 2: Embed gap token

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`
- Modify: `libs/chat/src/lib/styles/chat-window.styles.ts`

- [ ] **Step 1: Add the token**

Open `libs/chat/src/lib/styles/chat-tokens.ts`. Find the existing `:host` block where `--ngaf-chat-*` tokens are declared. Add this line within that block (placement near other spacing tokens):

```css
--ngaf-chat-input-gap: 0.75rem;
```

- [ ] **Step 2: Apply the gap in the window styles**

Open `libs/chat/src/lib/styles/chat-window.styles.ts`. Locate the `.chat-window__footer` rule (or add it if missing). Add `margin-top: var(--ngaf-chat-input-gap);` to it:

```css
.chat-window__footer {
  margin-top: var(--ngaf-chat-input-gap);
}
```

If the rule already exists, append the `margin-top` declaration to it. Do NOT add the gap inside the scroll container (it would scroll away with content).

- [ ] **Step 3: Run typecheck and visual smoke**

Run: `npx nx run chat:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts libs/chat/src/lib/styles/chat-window.styles.ts
git commit -m "feat(chat): --ngaf-chat-input-gap token between body and footer"
```

---

## Task 3: Viewport-responsive multiline cap

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts:120-141`

The existing implementation caps at `MAX_AUTO_HEIGHT_PX = 200`. Replace with a viewport-derived cap: `min(40vh, 320px)`.

- [ ] **Step 1: Replace the static cap with a computed cap**

In `chat-input.component.ts`, delete the line:

```typescript
private static readonly MAX_AUTO_HEIGHT_PX = 200;
```

Replace the existing auto-resize effect in the constructor with:

```typescript
effect(() => {
  const text = this.messageText();
  const el = this.textareaEl()?.nativeElement;
  if (!el) return;
  // Cap: min(40vh, 320px). Recomputed on each input so viewport resizes
  // between keystrokes are picked up without a dedicated resize listener.
  const viewportH = typeof window === 'undefined' ? 600 : window.innerHeight;
  const cap = Math.min(viewportH * 0.4, 320);
  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight, cap);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden';
  void text;
});
```

- [ ] **Step 2: Remove the conflicting CSS max-height**

Open `libs/chat/src/lib/styles/chat-input.styles.ts`. Find:

```css
.chat-input__textarea {
  ...
  max-height: 1.5em;
  ...
}
```

Delete the `max-height: 1.5em;` line. The JS effect drives the height; the stale `max-height` is overridden but confusing.

- [ ] **Step 3: Run typecheck**

Run: `npx nx run chat:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-input/chat-input.component.ts libs/chat/src/lib/styles/chat-input.styles.ts
git commit -m "feat(chat): viewport-responsive multiline cap (min(40vh, 320px))"
```

---

# Stream B — Pin / bubble system

## Task 4: Pin signal + scroll handler in chat composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

Add the pin state machine *before* wiring the bubble, so behavior can be verified in isolation. After this task, scrolling up still produces no UI change, but `pinned()` flips correctly.

- [ ] **Step 1: Add fields, signals, and scroll handler**

Near the top of the `ChatComponent` class (alongside existing private fields):

```typescript
readonly pinned = signal<boolean>(true);
private programmaticScroll = false;
private static readonly PIN_TOLERANCE_PX = 150;
```

Add an `onScroll` handler method on the class:

```typescript
protected onScroll(): void {
  if (this.programmaticScroll) return;
  const el = this.scrollContainer()?.nativeElement;
  if (!el) return;
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  const nextPinned = distance < ChatComponent.PIN_TOLERANCE_PX;
  if (nextPinned !== this.pinned()) this.pinned.set(nextPinned);
}
```

- [ ] **Step 2: Wire the handler in the template**

In the template (around line ~133), update the scroll-container div:

```html
<div chatBody class="chat-scroll" #scrollContainer (scroll)="onScroll()">
```

- [ ] **Step 3: Replace inline tolerance with `pinned()` in existing auto-scroll**

In the existing auto-scroll effect (line ~355), replace:

```typescript
const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
if (isNewMessage || isNearBottom) {
  el.scrollTop = el.scrollHeight;
}
```

with:

```typescript
if (isNewMessage || this.pinned()) {
  this.programmaticScroll = true;
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { this.programmaticScroll = false; });
  if (isNewMessage) this.pinned.set(true);
}
```

Also update the Task-1 final-scroll effect to use the same flag:

```typescript
if (this.pinned()) {
  requestAnimationFrame(() => {
    const el2 = this.scrollContainer()?.nativeElement;
    if (!el2) return;
    this.programmaticScroll = true;
    el2.scrollTop = el2.scrollHeight;
    requestAnimationFrame(() => { this.programmaticScroll = false; });
  });
}
```

(Replace the `isNearBottom` check in Task 1's snippet — the pin signal supersedes it.)

- [ ] **Step 4: Run typecheck**

Run: `npx nx run chat:typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): pin/unpin signal driving auto-scroll gate"
```

---

## Task 5: `chat-scroll-bubble` primitive

**Files:**
- Create: `libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts`
- Create: `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Write the failing component spec**

Create `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.spec.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.spec.ts
// SPDX-License-Identifier: MIT
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ChatScrollBubbleComponent } from './chat-scroll-bubble.component';

describe('ChatScrollBubbleComponent', () => {
  function render(mode: 'streaming' | 'idle') {
    const fixture = TestBed.createComponent(ChatScrollBubbleComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture;
  }

  it('renders three animated dots in streaming mode', () => {
    const fixture = render('streaming');
    const dots = fixture.nativeElement.querySelectorAll('.chat-scroll-bubble__dot');
    expect(dots.length).toBe(3);
    expect(fixture.nativeElement.querySelector('.chat-scroll-bubble__arrow')).toBeNull();
  });

  it('renders a down-arrow in idle mode', () => {
    const fixture = render('idle');
    expect(fixture.nativeElement.querySelector('.chat-scroll-bubble__arrow')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.chat-scroll-bubble__dot').length).toBe(0);
  });

  it('emits clicked when the button is clicked', () => {
    const fixture = render('idle');
    let clicks = 0;
    fixture.componentInstance.clicked.subscribe(() => clicks++);
    fixture.nativeElement.querySelector('button')!.click();
    expect(clicks).toBe(1);
  });

  it('uses a mode-specific aria-label', () => {
    expect(render('streaming').nativeElement.querySelector('button')!.getAttribute('aria-label'))
      .toBe('Latest activity');
    expect(render('idle').nativeElement.querySelector('button')!.getAttribute('aria-label'))
      .toBe('Scroll to latest');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx nx run chat:test --testPathPattern=chat-scroll-bubble`
Expected: FAIL — component module doesn't exist.

- [ ] **Step 3: Create the styles file**

Create `libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts`:

```typescript
// libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_SCROLL_BUBBLE_STYLES = `
  :host {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    z-index: 2;
    pointer-events: none;
  }
  .chat-scroll-bubble {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 12px;
    border-radius: 9999px;
    background: var(--ngaf-chat-surface);
    border: 1px solid var(--ngaf-chat-separator);
    color: var(--ngaf-chat-text);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }
  .chat-scroll-bubble:hover { transform: scale(1.05); }
  .chat-scroll-bubble__dots { display: inline-flex; gap: 4px; align-items: center; }
  .chat-scroll-bubble__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ngaf-chat-text-muted);
    animation: ngaf-chat-typing-dot 1.4s ease-in-out infinite both;
  }
  .chat-scroll-bubble__dot:nth-child(2) { animation-delay: 0.2s; }
  .chat-scroll-bubble__dot:nth-child(3) { animation-delay: 0.4s; }
  .chat-scroll-bubble__arrow {
    width: 16px;
    height: 16px;
    display: block;
  }
`;
```

The `ngaf-chat-typing-dot` keyframes are already defined in `chat-tokens.ts` (used by `chat-typing-indicator`); no need to redeclare.

- [ ] **Step 4: Create the component**

Create `libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.ts`:

```typescript
// libs/chat/src/lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SCROLL_BUBBLE_STYLES } from '../../styles/chat-scroll-bubble.styles';

export type ChatScrollBubbleMode = 'streaming' | 'idle';

@Component({
  selector: 'chat-scroll-bubble',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_SCROLL_BUBBLE_STYLES],
  template: `
    <button
      type="button"
      class="chat-scroll-bubble"
      [attr.aria-label]="ariaLabel()"
      (click)="clicked.emit()"
    >
      @if (mode() === 'streaming') {
        <span class="chat-scroll-bubble__dots" aria-hidden="true">
          <span class="chat-scroll-bubble__dot"></span>
          <span class="chat-scroll-bubble__dot"></span>
          <span class="chat-scroll-bubble__dot"></span>
        </span>
      } @else {
        <svg class="chat-scroll-bubble__arrow" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <polyline points="19 12 12 19 5 12"/>
        </svg>
      }
    </button>
  `,
})
export class ChatScrollBubbleComponent {
  readonly mode = input.required<ChatScrollBubbleMode>();
  readonly clicked = output<void>();
  protected readonly ariaLabel = computed(() =>
    this.mode() === 'streaming' ? 'Latest activity' : 'Scroll to latest',
  );
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx nx run chat:test --testPathPattern=chat-scroll-bubble`
Expected: PASS — all four tests.

- [ ] **Step 6: Export from the public API**

Open `libs/chat/src/public-api.ts`. Near the other primitive exports (e.g. next to `ChatTypingIndicatorComponent`), add:

```typescript
export { ChatScrollBubbleComponent } from './lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component';
export type { ChatScrollBubbleMode } from './lib/primitives/chat-scroll-bubble/chat-scroll-bubble.component';
```

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-scroll-bubble libs/chat/src/lib/styles/chat-scroll-bubble.styles.ts libs/chat/src/public-api.ts
git commit -m "feat(chat): chat-scroll-bubble primitive (streaming + idle modes)"
```

---

## Task 6: Integrate bubble into composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Import the primitive**

In the imports at the top:

```typescript
import { ChatScrollBubbleComponent } from '../../primitives/chat-scroll-bubble/chat-scroll-bubble.component';
```

Add `ChatScrollBubbleComponent` to the `@Component({ imports: [...] })` list.

- [ ] **Step 2: Update chatFooter to be a positioning context and render the bubble**

In the template, replace the `<div chatFooter>` block (around line ~225):

```html
<div chatFooter class="chat-footer-wrap">
  @if (!pinned()) {
    <chat-scroll-bubble
      [mode]="agent().isLoading() ? 'streaming' : 'idle'"
      (clicked)="onScrollBubbleClick()"
    />
  }
  <chat-error [agent]="agent()" />
  <chat-interrupt [agent]="agent()" />
  <chat-input ...>
    ...
  </chat-input>
</div>
```

(Preserve the inner `<chat-input>` and `<chat-select>` blocks exactly as they were — only the wrapper class and the new `@if (!pinned())` block are added.)

- [ ] **Step 3: Add the positioning context style**

In the same component's `styles: [...]`, add to the inline CSS string:

```css
.chat-footer-wrap { position: relative; }
```

(Add this rule near `[chatFooter] { padding-bottom: var(--ngaf-chat-edge-pad); }`.)

- [ ] **Step 4: Implement the click handler**

In the `ChatComponent` class:

```typescript
protected onScrollBubbleClick(): void {
  const el = this.scrollContainer()?.nativeElement;
  if (!el) return;
  this.programmaticScroll = true;
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => { this.programmaticScroll = false; });
  this.pinned.set(true);
}
```

- [ ] **Step 5: Force re-pin on user submit**

The existing template wires `(submitted)` on `<chat-input>` (or relies on agent events). Find the existing handler for user submit. If none exists explicitly, add to `<chat-input>`:

```html
<chat-input ... (submitted)="onUserSubmitted()">
```

And in the class:

```typescript
protected onUserSubmitted(): void {
  this.pinned.set(true);
  // The auto-scroll effect will pick up the new message and scroll.
}
```

Note: the auto-scroll effect already forces a scroll on new-message-count change, but it gates on `pinned()` for non-new updates. Setting `pinned = true` here ensures the post-submit stream stays pinned.

- [ ] **Step 6: Gate the inline typing indicator on `pinned()`**

Find the existing `<chat-typing-indicator [agent]="agent()" />` line in the template (inside the scroll container). Wrap it:

```html
@if (pinned()) {
  <chat-typing-indicator [agent]="agent()" />
}
```

- [ ] **Step 7: Run typecheck**

Run: `npx nx run chat:typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): wire chat-scroll-bubble into composition; gate typing indicator on pinned"
```

---

## Task 7: Pin-state unit test

**Files:**
- Create: `libs/chat/src/lib/compositions/chat/pin-state.spec.ts`

Cover the pin-tolerance boundary so future edits don't drift the 150px contract.

- [ ] **Step 1: Extract the tolerance check into a pure helper**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, just above the `@Component` decorator, add:

```typescript
/**
 * Returns true when the scroll position is within `tolerance` px of the bottom.
 * Pure helper extracted for unit testing.
 */
export function isPinned(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  tolerance = 150,
): boolean {
  return scrollHeight - scrollTop - clientHeight < tolerance;
}
```

Replace the inline computation in `onScroll`:

```typescript
protected onScroll(): void {
  if (this.programmaticScroll) return;
  const el = this.scrollContainer()?.nativeElement;
  if (!el) return;
  const nextPinned = isPinned(el.scrollHeight, el.scrollTop, el.clientHeight, ChatComponent.PIN_TOLERANCE_PX);
  if (nextPinned !== this.pinned()) this.pinned.set(nextPinned);
}
```

- [ ] **Step 2: Write the spec**

Create `libs/chat/src/lib/compositions/chat/pin-state.spec.ts`:

```typescript
// libs/chat/src/lib/compositions/chat/pin-state.spec.ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { isPinned } from './chat.component';

describe('isPinned', () => {
  // Container is 500px tall with 2000px of content. scrollTop=1500 => fully at bottom.
  const scrollHeight = 2000;
  const clientHeight = 500;

  it('is true when exactly at bottom', () => {
    expect(isPinned(scrollHeight, 1500, clientHeight)).toBe(true);
  });

  it('is true when within tolerance (149px above bottom)', () => {
    expect(isPinned(scrollHeight, 1500 - 149, clientHeight)).toBe(true);
  });

  it('is false when 150px above bottom (boundary is strict <)', () => {
    expect(isPinned(scrollHeight, 1500 - 150, clientHeight)).toBe(false);
  });

  it('is false when far from bottom', () => {
    expect(isPinned(scrollHeight, 0, clientHeight)).toBe(false);
  });

  it('respects a custom tolerance', () => {
    expect(isPinned(scrollHeight, 1500 - 49, clientHeight, 50)).toBe(true);
    expect(isPinned(scrollHeight, 1500 - 50, clientHeight, 50)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `npx nx run chat:test --testPathPattern=pin-state`
Expected: PASS — all five tests.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/pin-state.spec.ts libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "test(chat): isPinned tolerance boundary"
```

---

## Task 8: Manual browser verification (Chrome MCP)

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use `preview_start` against the examples-chat dev URL. (If unsure of the target: `npx nx serve examples-chat` and use the printed URL; otherwise reuse the project's existing preview script.)

- [ ] **Step 2: Verify each acceptance criterion**

For each item below, take a `preview_snapshot` (and `preview_screenshot` where layout matters) and confirm:

1. **Final scroll on stream end:** Send a long prompt; while assistant streams, do NOT scroll. After completion, the `chat-message-actions` row (reload/copy) is fully visible above the input.
2. **Embed gap visible:** In the embed-mode preview (look for the embed route in examples-chat), a visible gap exists between the messages container and the input pill.
3. **Multiline cap:** In the input, paste a 50-line block. Textarea grows then caps at ~40% of viewport height; internal scrollbar appears.
4. **Pin/unpin during stream:** Send a long prompt. While streaming, scroll up >150px. Auto-scroll stops. Streaming bubble (three dots) appears centered above the input. Click it — scrolls to bottom, bubble disappears, auto-scroll resumes.
5. **Idle bubble:** With completed conversation, scroll up >150px. Down-arrow bubble appears. Click — scrolls to bottom; bubble disappears.
6. **Re-pin via manual scroll:** While unpinned, scroll back to bottom manually. Bubble disappears (re-pinned).
7. **Force-pin on submit:** Scroll up to unpinned state. Send a new message. Composition re-pins automatically; scroll snaps to bottom.

- [ ] **Step 3: Capture proof screenshots**

Take screenshots for items 4 and 5 (the two bubble states). Stop the preview server.

- [ ] **Step 4: Commit if any tweaks were needed**

If verification surfaced styling or behavior issues, fix them, re-verify, and commit with a descriptive message.

---

## Self-Review

Spec coverage check:
- A1 final scroll → Task 1
- A2 embed gap → Task 2
- A3 multiline cap → Task 3
- Pin signal + scroll handler → Task 4
- Bubble primitive → Task 5
- Composition integration (bubble + typing indicator gate + force-pin on submit) → Task 6
- Pin-tolerance boundary tests → Task 7
- Manual verification → Task 8

Edge cases from spec:
- Programmatic vs. user scroll → Task 4 step 3 (`programmaticScroll` flag)
- First mount with prefilled history → covered by existing `isNewMessage` branch (pin defaults to true)
- Embed-mode height changes → bubble is `position: absolute; bottom: 100%;` of footer, so input-height changes don't require recomputation (Task 5 styles)
- Touch/momentum scroll → no special-casing; scroll handler is single-frame cheap (Task 4)

No placeholders. Names consistent across tasks (`pinned`, `programmaticScroll`, `PIN_TOLERANCE_PX`, `onScrollBubbleClick`, `isPinned`, `ChatScrollBubbleComponent`, `clicked` output).
