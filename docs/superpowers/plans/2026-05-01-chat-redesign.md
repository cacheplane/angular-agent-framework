# Chat Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@ngaf/chat`'s visual surface with a production-grade Tailwind-free design — asymmetric message pattern, three layout modes, shared trace primitive — and propagate the change through every cockpit demo, the example-layouts library, and the website docs. Ship as `0.0.3`.

**Architecture:** Component-encapsulated styles import a single `CHAT_HOST_TOKENS` string into every chat component's `styles` array, so CSS custom properties resolve on `:host` with no consumer setup. An optional `@ngaf/chat/chat.css` exposes the same tokens at `:root` plus parallel global classes for deep override. All Tailwind utility classes are removed from chat library output and from `libs/example-layouts`. Cockpit demos consume the new surface unchanged-ish (rename `<chat-messages>` → `<chat-message-list>`; drop manual Tailwind classes around `<chat>`).

**Tech Stack:** Angular 21, standalone components with `ChangeDetectionStrategy.OnPush`, signals, content projection via `<ng-template>` directives, plain CSS in component `styles` arrays (no Tailwind), Vitest for tests.

**Spec:** [docs/superpowers/specs/2026-05-01-chat-redesign-design.md](../specs/2026-05-01-chat-redesign-design.md)

---

## File Structure

**New files (libs/chat):**
- `libs/chat/src/lib/styles/chat-tokens.ts` — `CHAT_HOST_TOKENS` constant + keyframes
- `libs/chat/src/lib/styles/chat.css` — Layer-3 global stylesheet
- `libs/chat/src/lib/styles/chat-markdown.styles.ts` — markdown rules (replaces `chat-markdown.ts`)
- `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts` + spec
- `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts` + spec
- `libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts` + spec
- `libs/chat/src/lib/primitives/chat-launcher-button/chat-launcher-button.component.ts` + spec
- `libs/chat/src/lib/primitives/chat-suggestions/chat-suggestions.component.ts` + spec
- `libs/chat/src/lib/primitives/chat-message-list/chat-message-list.component.ts` (renamed from `chat-messages`) + spec + `message-template.directive.ts`
- `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts` + spec
- `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts` + spec

**Rewritten in place:**
- `libs/chat/src/lib/compositions/chat/chat.component.ts`
- `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`
- `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`
- `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts`
- `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`
- `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`
- `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts`
- `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`
- `libs/chat/src/lib/compositions/chat-debug/*.component.ts` (8 files)
- `libs/chat/src/public-api.ts`
- `libs/chat/package.json` (version + exports map)
- `libs/example-layouts/src/lib/example-chat-layout.component.ts`
- `libs/example-layouts/src/lib/example-split-layout.component.ts`

**Deleted:**
- `libs/chat/src/lib/styles/chat-theme.ts`
- `libs/chat/src/lib/styles/chat-markdown.ts`
- `libs/chat/src/lib/primitives/chat-messages/` directory (replaced by `chat-message-list/`)

**Cockpit demos updated (19):**
- `cockpit/chat/{messages,input,threads,tool-calls,subagents,timeline,interrupts,theming,debug,generative-ui,a2ui}/angular`
- `cockpit/langgraph/{streaming,persistence,memory,interrupts,durable-execution,time-travel,subgraphs,deployment-runtime}/angular`

**Website docs updated:**
- `apps/website/content/docs/chat/getting-started/installation.mdx`
- `apps/website/content/docs/chat/getting-started/quickstart.mdx`
- `apps/website/content/docs/chat/guides/theming.mdx`
- `apps/website/content/docs/chat/components/chat-popup.mdx` (NEW)
- `apps/website/content/docs/chat/components/chat-sidebar.mdx` (NEW)
- `apps/website/content/docs/chat/components/chat-trace.mdx` (NEW)
- `apps/website/content/docs/chat/guides/layout-modes.mdx` (NEW)

---

## Phase 1 — Design tokens & global stylesheet

### Task 1: Create `chat-tokens.ts`

**Files:**
- Create: `libs/chat/src/lib/styles/chat-tokens.ts`

- [ ] **Step 1: Write the file**

```ts
// libs/chat/src/lib/styles/chat-tokens.ts
// SPDX-License-Identifier: MIT

const LIGHT_TOKENS = `
  --ngaf-chat-bg: rgb(255, 255, 255);
  --ngaf-chat-surface: rgb(255, 255, 255);
  --ngaf-chat-surface-alt: rgb(251, 251, 251);
  --ngaf-chat-primary: rgb(28, 28, 28);
  --ngaf-chat-on-primary: rgb(255, 255, 255);
  --ngaf-chat-text: rgb(28, 28, 28);
  --ngaf-chat-text-muted: rgb(115, 115, 115);
  --ngaf-chat-separator: rgb(229, 229, 229);
  --ngaf-chat-muted: rgb(200, 200, 200);
  --ngaf-chat-error-bg: #fef2f2;
  --ngaf-chat-error-border: #fecaca;
  --ngaf-chat-error-text: #dc2626;
  --ngaf-chat-warning-bg: #fffbeb;
  --ngaf-chat-warning-text: #b45309;
  --ngaf-chat-success: #16a34a;
  --ngaf-chat-shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --ngaf-chat-shadow-md: 0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06);
  --ngaf-chat-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05);
`;

const DARK_TOKENS = `
  --ngaf-chat-bg: rgb(17, 17, 17);
  --ngaf-chat-surface: rgb(28, 28, 28);
  --ngaf-chat-surface-alt: rgb(44, 44, 44);
  --ngaf-chat-primary: rgb(255, 255, 255);
  --ngaf-chat-on-primary: rgb(28, 28, 28);
  --ngaf-chat-text: rgb(245, 245, 245);
  --ngaf-chat-text-muted: rgb(160, 160, 160);
  --ngaf-chat-separator: rgb(45, 45, 45);
  --ngaf-chat-muted: rgb(60, 60, 60);
  --ngaf-chat-error-bg: rgb(45, 21, 21);
  --ngaf-chat-error-border: #dc2626;
  --ngaf-chat-error-text: #fca5a5;
  --ngaf-chat-warning-bg: rgb(45, 35, 21);
  --ngaf-chat-warning-text: #fbbf24;
  --ngaf-chat-success: #4ade80;
`;

const GEOMETRY_TOKENS = `
  --ngaf-chat-radius-bubble: 15px;
  --ngaf-chat-radius-input: 20px;
  --ngaf-chat-radius-card: 8px;
  --ngaf-chat-radius-button: 8px;
  --ngaf-chat-radius-launcher: 9999px;
  --ngaf-chat-max-width: 48rem;
`;

const TYPOGRAPHY_TOKENS = `
  --ngaf-chat-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --ngaf-chat-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --ngaf-chat-font-size: 1rem;
  --ngaf-chat-font-size-sm: 0.875rem;
  --ngaf-chat-font-size-xs: 0.75rem;
  --ngaf-chat-line-height: 1.6;
  --ngaf-chat-line-height-tight: 1.5;
`;

const SPACING_TOKENS = `
  --ngaf-chat-space-1: 4px;
  --ngaf-chat-space-2: 8px;
  --ngaf-chat-space-3: 12px;
  --ngaf-chat-space-4: 16px;
  --ngaf-chat-space-5: 20px;
  --ngaf-chat-space-6: 24px;
  --ngaf-chat-space-8: 32px;
`;

const KEYFRAMES = `
  @keyframes ngaf-chat-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes ngaf-chat-typing-dot {
    0%, 80%, 100% { transform: scale(0.5); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes ngaf-chat-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes ngaf-chat-caret-blink {
    0%, 50% { opacity: 1; }
    50.01%, 100% { opacity: 0; }
  }
`;

/**
 * Component-host design tokens. Import into every chat component's `styles`
 * array so CSS custom properties resolve on `:host` without consumer setup.
 * Light tokens are default; dark applies via prefers-color-scheme OR via the
 * `[data-ngaf-chat-theme="dark"]` attribute on the host. Consumers can force
 * light by setting `[data-ngaf-chat-theme="light"]`.
 */
export const CHAT_HOST_TOKENS = `
  :host {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    font-family: var(--ngaf-chat-font-family);
    color: var(--ngaf-chat-text);
  }
  @media (prefers-color-scheme: dark) {
    :host:not([data-ngaf-chat-theme="light"]) { ${DARK_TOKENS} }
  }
  :host([data-ngaf-chat-theme="dark"]) { ${DARK_TOKENS} }
  ${KEYFRAMES}
`;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx nx build chat --configuration=development 2>&1 | tail -20`
Expected: build succeeds (constant is unused so far, that's fine).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts
git commit -m "feat(chat): add CHAT_HOST_TOKENS design-token constant"
```

---

### Task 2: Create `chat.css` Layer-3 global stylesheet

**Files:**
- Create: `libs/chat/src/lib/styles/chat.css`

- [ ] **Step 1: Write the file**

```css
/* libs/chat/src/lib/styles/chat.css */
/* SPDX-License-Identifier: MIT */

/*
 * Optional global stylesheet for @ngaf/chat. Import once in your global
 * styles to:
 *   1. Override design tokens at :root (instead of per :host).
 *   2. Reach into chat components with parallel global selectors.
 *
 * Usage:
 *   /* in src/styles.css *​/
 *   @import '@ngaf/chat/chat.css';
 *
 *   :root { --ngaf-chat-primary: oklch(0.55 0.22 264); }
 */

:root {
  --ngaf-chat-bg: rgb(255, 255, 255);
  --ngaf-chat-surface: rgb(255, 255, 255);
  --ngaf-chat-surface-alt: rgb(251, 251, 251);
  --ngaf-chat-primary: rgb(28, 28, 28);
  --ngaf-chat-on-primary: rgb(255, 255, 255);
  --ngaf-chat-text: rgb(28, 28, 28);
  --ngaf-chat-text-muted: rgb(115, 115, 115);
  --ngaf-chat-separator: rgb(229, 229, 229);
  --ngaf-chat-muted: rgb(200, 200, 200);
  --ngaf-chat-error-bg: #fef2f2;
  --ngaf-chat-error-border: #fecaca;
  --ngaf-chat-error-text: #dc2626;
  --ngaf-chat-warning-bg: #fffbeb;
  --ngaf-chat-warning-text: #b45309;
  --ngaf-chat-success: #16a34a;
  --ngaf-chat-shadow-sm: 0 1px 2px rgba(0,0,0,.05);
  --ngaf-chat-shadow-md: 0 4px 6px -1px rgba(0,0,0,.10), 0 2px 4px -1px rgba(0,0,0,.06);
  --ngaf-chat-shadow-lg: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -2px rgba(0,0,0,.05);
  --ngaf-chat-radius-bubble: 15px;
  --ngaf-chat-radius-input: 20px;
  --ngaf-chat-radius-card: 8px;
  --ngaf-chat-radius-button: 8px;
  --ngaf-chat-radius-launcher: 9999px;
  --ngaf-chat-max-width: 48rem;
  --ngaf-chat-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --ngaf-chat-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --ngaf-chat-font-size: 1rem;
  --ngaf-chat-font-size-sm: 0.875rem;
  --ngaf-chat-font-size-xs: 0.75rem;
  --ngaf-chat-line-height: 1.6;
  --ngaf-chat-line-height-tight: 1.5;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-ngaf-chat-theme="light"]) {
    --ngaf-chat-bg: rgb(17, 17, 17);
    --ngaf-chat-surface: rgb(28, 28, 28);
    --ngaf-chat-surface-alt: rgb(44, 44, 44);
    --ngaf-chat-primary: rgb(255, 255, 255);
    --ngaf-chat-on-primary: rgb(28, 28, 28);
    --ngaf-chat-text: rgb(245, 245, 245);
    --ngaf-chat-text-muted: rgb(160, 160, 160);
    --ngaf-chat-separator: rgb(45, 45, 45);
    --ngaf-chat-muted: rgb(60, 60, 60);
    --ngaf-chat-error-bg: rgb(45, 21, 21);
    --ngaf-chat-error-border: #dc2626;
    --ngaf-chat-error-text: #fca5a5;
    --ngaf-chat-warning-bg: rgb(45, 35, 21);
    --ngaf-chat-warning-text: #fbbf24;
    --ngaf-chat-success: #4ade80;
  }
}

[data-ngaf-chat-theme="dark"] {
  --ngaf-chat-bg: rgb(17, 17, 17);
  --ngaf-chat-surface: rgb(28, 28, 28);
  --ngaf-chat-surface-alt: rgb(44, 44, 44);
  --ngaf-chat-primary: rgb(255, 255, 255);
  --ngaf-chat-on-primary: rgb(28, 28, 28);
  --ngaf-chat-text: rgb(245, 245, 245);
  --ngaf-chat-text-muted: rgb(160, 160, 160);
  --ngaf-chat-separator: rgb(45, 45, 45);
  --ngaf-chat-muted: rgb(60, 60, 60);
  --ngaf-chat-error-bg: rgb(45, 21, 21);
  --ngaf-chat-error-border: #dc2626;
  --ngaf-chat-error-text: #fca5a5;
  --ngaf-chat-warning-bg: rgb(45, 35, 21);
  --ngaf-chat-warning-text: #fbbf24;
  --ngaf-chat-success: #4ade80;
}
```

- [ ] **Step 2: Wire export in package.json**

Update `libs/chat/package.json`:

```jsonc
{
  "name": "@ngaf/chat",
  "version": "0.0.2",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "default": "./fesm2022/ngaf-chat.mjs"
    },
    "./testing": {
      "types": "./testing.d.ts",
      "default": "./fesm2022/ngaf-chat-testing.mjs"
    },
    "./chat.css": "./chat.css"
  },
  "peerDependencies": { /* unchanged */ }
}
```

(Note: leave version at 0.0.2 here — the bump to 0.0.3 lands in Task 35.)

- [ ] **Step 3: Wire ng-package.json to copy chat.css to dist**

Read `libs/chat/ng-package.json`. Add an `assets` array if not present:

```jsonc
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/libs/chat",
  "lib": { "entryFile": "src/public-api.ts" },
  "allowedNonPeerDependencies": [],
  "assets": [
    { "input": "src/lib/styles", "glob": "chat.css", "output": "." }
  ]
}
```

- [ ] **Step 4: Build to verify chat.css ships to dist**

Run: `npx nx build chat 2>&1 | tail -10 && ls dist/libs/chat/chat.css 2>&1`
Expected: build succeeds, file `dist/libs/chat/chat.css` exists.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat.css libs/chat/package.json libs/chat/ng-package.json
git commit -m "feat(chat): ship optional chat.css global stylesheet"
```

---

## Phase 2 — New primitive components

### Task 3: `<chat-trace>` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-trace/chat-trace.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-trace.styles.ts`

- [ ] **Step 1: Write styles**

```ts
// libs/chat/src/lib/styles/chat-trace.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_TRACE_STYLES = `
  :host { display: block; font-size: var(--ngaf-chat-font-size-sm); }
  .chat-trace__header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    user-select: none;
    color: var(--ngaf-chat-text-muted);
    background: transparent;
    border: 0;
    padding: 0;
    width: 100%;
    text-align: left;
    font: inherit;
  }
  .chat-trace__chevron {
    width: 12px;
    height: 12px;
    transition: transform 200ms ease;
    flex-shrink: 0;
  }
  :host([data-expanded="true"]) .chat-trace__chevron { transform: rotate(90deg); }
  .chat-trace__label { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
  :host([data-state="running"]) .chat-trace__label { animation: ngaf-chat-pulse 1.5s ease-in-out infinite; }
  :host([data-state="error"]) .chat-trace__label { color: var(--ngaf-chat-error-text); }
  .chat-trace__content {
    padding-left: 1rem;
    padding-top: 0.375rem;
    margin-left: 0.375rem;
    border-left: 1px solid var(--ngaf-chat-separator);
    max-height: 250px;
    overflow: auto;
  }
`;
```

- [ ] **Step 2: Write the failing test**

```ts
// libs/chat/src/lib/primitives/chat-trace/chat-trace.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatTraceComponent } from './chat-trace.component';

@Component({
  standalone: true,
  imports: [ChatTraceComponent],
  template: `<chat-trace [state]="'running'"><span traceLabel>Working</span><div>body</div></chat-trace>`,
})
class Host {}

describe('ChatTraceComponent', () => {
  it('toggles expanded on header click', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const trace: HTMLElement = fx.nativeElement.querySelector('chat-trace');
    expect(trace.getAttribute('data-expanded')).toBe('true'); // running auto-expands
    const header = trace.querySelector<HTMLButtonElement>('.chat-trace__header')!;
    header.click();
    fx.detectChanges();
    expect(trace.getAttribute('data-expanded')).toBe('false');
  });

  it('renders label and content via projection', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const trace: HTMLElement = fx.nativeElement.querySelector('chat-trace');
    expect(trace.querySelector('[traceLabel]')!.textContent).toBe('Working');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx test chat -- --run chat-trace.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the component**

```ts
// libs/chat/src/lib/primitives/chat-trace/chat-trace.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, signal, effect, HostBinding } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_TRACE_STYLES } from '../../styles/chat-trace.styles';

export type TraceState = 'pending' | 'running' | 'done' | 'error';

@Component({
  selector: 'chat-trace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_TRACE_STYLES],
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

  readonly expanded = signal(false);

  @HostBinding('attr.data-state') get stateAttr() { return this.state(); }
  @HostBinding('attr.data-expanded') get expandedAttr() { return String(this.expanded()); }

  constructor() {
    effect(() => {
      const s = this.state();
      if (s === 'running') {
        this.expanded.set(true);
      } else if (s === 'done') {
        // collapse 200ms after done
        setTimeout(() => this.expanded.set(false), 200);
      }
    });
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test chat -- --run chat-trace.component.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-trace libs/chat/src/lib/styles/chat-trace.styles.ts
git commit -m "feat(chat): add chat-trace primitive"
```

---

### Task 4: `<chat-window>` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-window/chat-window.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-window.styles.ts`

- [ ] **Step 1: Write styles**

```ts
// libs/chat/src/lib/styles/chat-window.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_WINDOW_STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
  }
  .chat-window__header {
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--ngaf-chat-space-6);
    border-bottom: 1px solid var(--ngaf-chat-separator);
    font-weight: 500;
    color: var(--ngaf-chat-primary);
  }
  .chat-window__header:empty { display: none; }
  .chat-window__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .chat-window__footer {
    flex-shrink: 0;
  }
  .chat-window__footer:empty { display: none; }
`;
```

- [ ] **Step 2: Write failing test**

```ts
// libs/chat/src/lib/primitives/chat-window/chat-window.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatWindowComponent } from './chat-window.component';

@Component({
  standalone: true,
  imports: [ChatWindowComponent],
  template: `
    <chat-window>
      <span chatHeader>My Chat</span>
      <div chatBody>messages here</div>
      <div chatFooter>input here</div>
    </chat-window>
  `,
})
class Host {}

describe('ChatWindowComponent', () => {
  it('projects header / body / footer slots', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const win = fx.nativeElement.querySelector('chat-window');
    expect(win.querySelector('.chat-window__header')!.textContent).toContain('My Chat');
    expect(win.querySelector('.chat-window__body')!.textContent).toContain('messages here');
    expect(win.querySelector('.chat-window__footer')!.textContent).toContain('input here');
  });
});
```

- [ ] **Step 3: Run test, verify FAIL**

Run: `npx nx test chat -- --run chat-window.component.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// libs/chat/src/lib/primitives/chat-window/chat-window.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_WINDOW_STYLES } from '../../styles/chat-window.styles';

@Component({
  selector: 'chat-window',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_WINDOW_STYLES],
  template: `
    <div class="chat-window__header"><ng-content select="[chatHeader]" /></div>
    <div class="chat-window__body"><ng-content select="[chatBody]" /></div>
    <div class="chat-window__footer"><ng-content select="[chatFooter]" /></div>
  `,
})
export class ChatWindowComponent {}
```

- [ ] **Step 5: Run test, verify PASS**

Run: `npx nx test chat -- --run chat-window.component.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-window libs/chat/src/lib/styles/chat-window.styles.ts
git commit -m "feat(chat): add chat-window primitive"
```

---

### Task 5: `<chat-launcher-button>` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-launcher-button/chat-launcher-button.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-launcher-button/chat-launcher-button.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-launcher-button.styles.ts`

- [ ] **Step 1: Write styles**

```ts
// libs/chat/src/lib/styles/chat-launcher-button.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_LAUNCHER_BUTTON_STYLES = `
  :host { display: inline-block; }
  .chat-launcher-button {
    width: 56px;
    height: 56px;
    border-radius: var(--ngaf-chat-radius-launcher);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--ngaf-chat-shadow-md);
    transition: transform 200ms ease;
  }
  .chat-launcher-button:hover { transform: scale(1.05); }
  .chat-launcher-button svg { width: 24px; height: 24px; }
`;
```

- [ ] **Step 2: Write failing test**

```ts
// libs/chat/src/lib/primitives/chat-launcher-button/chat-launcher-button.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatLauncherButtonComponent } from './chat-launcher-button.component';

@Component({
  standalone: true,
  imports: [ChatLauncherButtonComponent],
  template: `<chat-launcher-button (click)="clicked = true" />`,
})
class Host { clicked = false; }

describe('ChatLauncherButtonComponent', () => {
  it('emits click', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('.chat-launcher-button');
    btn.click();
    expect(fx.componentInstance.clicked).toBe(true);
  });
});
```

- [ ] **Step 3: Run test, FAIL**

Run: `npx nx test chat -- --run chat-launcher-button.component.spec`

- [ ] **Step 4: Implement**

```ts
// libs/chat/src/lib/primitives/chat-launcher-button/chat-launcher-button.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_LAUNCHER_BUTTON_STYLES } from '../../styles/chat-launcher-button.styles';

@Component({
  selector: 'chat-launcher-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_LAUNCHER_BUTTON_STYLES],
  template: `
    <button type="button" class="chat-launcher-button" aria-label="Open chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  `,
})
export class ChatLauncherButtonComponent {}
```

- [ ] **Step 5: Run test, PASS**

Run: `npx nx test chat -- --run chat-launcher-button.component.spec`

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-launcher-button libs/chat/src/lib/styles/chat-launcher-button.styles.ts
git commit -m "feat(chat): add chat-launcher-button primitive"
```

---

### Task 6: `<chat-suggestions>` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-suggestions/chat-suggestions.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-suggestions/chat-suggestions.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-suggestions.styles.ts`

- [ ] **Step 1: Styles**

```ts
// libs/chat/src/lib/styles/chat-suggestions.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_SUGGESTIONS_STYLES = `
  :host { display: block; }
  .chat-suggestions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .chat-suggestion {
    padding: 6px 10px;
    font-size: var(--ngaf-chat-font-size-xs);
    border-radius: var(--ngaf-chat-radius-bubble);
    border: 1px solid var(--ngaf-chat-muted);
    background: transparent;
    color: var(--ngaf-chat-text);
    cursor: pointer;
    transition: transform 200ms ease;
  }
  .chat-suggestion:hover { transform: scale(1.03); }
  .chat-suggestion:disabled { cursor: wait; opacity: 0.6; }
`;
```

- [ ] **Step 2: Failing test**

```ts
// libs/chat/src/lib/primitives/chat-suggestions/chat-suggestions.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatSuggestionsComponent } from './chat-suggestions.component';

@Component({
  standalone: true,
  imports: [ChatSuggestionsComponent],
  template: `<chat-suggestions [suggestions]="['One','Two']" (selected)="picked = $event" />`,
})
class Host { picked = ''; }

describe('ChatSuggestionsComponent', () => {
  it('renders one button per suggestion and emits on click', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const buttons = fx.nativeElement.querySelectorAll('.chat-suggestion');
    expect(buttons.length).toBe(2);
    (buttons[1] as HTMLButtonElement).click();
    expect(fx.componentInstance.picked).toBe('Two');
  });
});
```

- [ ] **Step 3: Run, FAIL.** `npx nx test chat -- --run chat-suggestions.component.spec`

- [ ] **Step 4: Implement**

```ts
// libs/chat/src/lib/primitives/chat-suggestions/chat-suggestions.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SUGGESTIONS_STYLES } from '../../styles/chat-suggestions.styles';

@Component({
  selector: 'chat-suggestions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_SUGGESTIONS_STYLES],
  template: `
    <div class="chat-suggestions">
      @for (s of suggestions(); track s) {
        <button type="button" class="chat-suggestion" (click)="selected.emit(s)">{{ s }}</button>
      }
    </div>
  `,
})
export class ChatSuggestionsComponent {
  readonly suggestions = input<string[]>([]);
  readonly selected = output<string>();
}
```

- [ ] **Step 5: Run, PASS.**

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-suggestions libs/chat/src/lib/styles/chat-suggestions.styles.ts
git commit -m "feat(chat): add chat-suggestions primitive"
```

---

### Task 7: `<chat-message>` primitive (asymmetric variants)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-message.styles.ts`

- [ ] **Step 1: Styles** — covers user-bubble + assistant-inline + hover controls + caret.

```ts
// libs/chat/src/lib/styles/chat-message.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_MESSAGE_STYLES = `
  :host { display: block; }
  :host([data-role="user"]) {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
  :host([data-role="user"][data-prev-role="assistant"]) { margin-top: 1.5rem; }
  :host([data-role="assistant"]) {
    display: block;
    position: relative;
    margin-top: 1.5rem;
    color: var(--ngaf-chat-text);
    line-height: var(--ngaf-chat-line-height);
    font-size: var(--ngaf-chat-font-size);
    max-width: 100%;
  }
  :host([data-role="assistant"]):first-child { margin-top: 0; }

  .chat-message__bubble {
    max-width: 80%;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-bubble);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    white-space: pre-wrap;
    line-height: var(--ngaf-chat-line-height-tight);
    font-size: var(--ngaf-chat-font-size);
    overflow-wrap: break-word;
  }

  .chat-message__assistant-body {
    overflow-wrap: break-word;
  }

  .chat-message__caret {
    display: inline-block;
    margin-left: 2px;
    width: 0.6ch;
    color: var(--ngaf-chat-text-muted);
    animation: ngaf-chat-caret-blink 1.2s step-end infinite;
  }

  .chat-message__controls {
    position: absolute;
    left: 0;
    bottom: -28px;
    display: flex;
    gap: 1rem;
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  :host([data-role="assistant"]:hover) .chat-message__controls,
  :host([data-role="assistant"]:focus-within) .chat-message__controls,
  :host([data-current="true"]) .chat-message__controls {
    opacity: 1;
    pointer-events: auto;
  }
  @media (max-width: 768px) {
    :host([data-role="assistant"]) .chat-message__controls { opacity: 1; pointer-events: auto; }
  }
  .chat-message__control-btn {
    width: 20px;
    height: 20px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    padding: 0;
    transition: transform 200ms ease;
  }
  .chat-message__control-btn:hover { transform: scale(1.05); }
  .chat-message__control-btn svg { width: 16px; height: 16px; pointer-events: none; }
`;
```

- [ ] **Step 2: Failing test**

```ts
// libs/chat/src/lib/primitives/chat-message/chat-message.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ChatMessageComponent } from './chat-message.component';

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message [role]="'user'">hello</chat-message>`,
})
class UserHost {}

@Component({
  standalone: true,
  imports: [ChatMessageComponent],
  template: `<chat-message [role]="'assistant'" [streaming]="true" [current]="true">body</chat-message>`,
})
class AssistantHost {}

describe('ChatMessageComponent', () => {
  it('renders user bubble', () => {
    const fx = TestBed.createComponent(UserHost);
    fx.detectChanges();
    const el = fx.nativeElement.querySelector('chat-message');
    expect(el.getAttribute('data-role')).toBe('user');
    expect(el.querySelector('.chat-message__bubble')).toBeTruthy();
  });

  it('renders assistant inline with caret while streaming and current', () => {
    const fx = TestBed.createComponent(AssistantHost);
    fx.detectChanges();
    const el = fx.nativeElement.querySelector('chat-message');
    expect(el.getAttribute('data-role')).toBe('assistant');
    expect(el.getAttribute('data-current')).toBe('true');
    expect(el.querySelector('.chat-message__caret')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run, FAIL.**

- [ ] **Step 4: Implement**

```ts
// libs/chat/src/lib/primitives/chat-message/chat-message.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, HostBinding } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_MESSAGE_STYLES } from '../../styles/chat-message.styles';

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

@Component({
  selector: 'chat-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_STYLES],
  template: `
    @switch (role()) {
      @case ('user') {
        <div class="chat-message__bubble"><ng-content /></div>
      }
      @case ('assistant') {
        <div class="chat-message__assistant-body">
          <ng-content />
          @if (streaming() && current()) {
            <span class="chat-message__caret" aria-hidden="true">▍</span>
          }
        </div>
        <div class="chat-message__controls">
          <ng-content select="[chatMessageControls]" />
        </div>
      }
      @default {
        <div><ng-content /></div>
      }
    }
  `,
})
export class ChatMessageComponent {
  readonly role = input.required<ChatMessageRole>();
  readonly current = input(false);
  readonly streaming = input(false);
  readonly prevRole = input<ChatMessageRole | undefined>(undefined);

  @HostBinding('attr.data-role') get roleAttr() { return this.role(); }
  @HostBinding('attr.data-current') get currentAttr() { return String(this.current()); }
  @HostBinding('attr.data-prev-role') get prevRoleAttr() { return this.prevRole() ?? null; }
}
```

- [ ] **Step 5: Run, PASS.**

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-message libs/chat/src/lib/styles/chat-message.styles.ts
git commit -m "feat(chat): add chat-message primitive (asymmetric user/assistant)"
```

---

## Phase 3 — Rewrite existing primitives

### Task 8: Rename `chat-messages` → `chat-message-list`

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-message-list/chat-message-list.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-message-list/chat-message-list.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-message-list/message-template.directive.ts`
- Delete: `libs/chat/src/lib/primitives/chat-messages/`

- [ ] **Step 1: Read existing chat-messages**

Read `libs/chat/src/lib/primitives/chat-messages/chat-messages.component.ts` and `message-template.directive.ts` to capture the existing API (selectors, inputs, content projection contract).

- [ ] **Step 2: Copy + rename file content**

```bash
mkdir -p libs/chat/src/lib/primitives/chat-message-list
cp libs/chat/src/lib/primitives/chat-messages/message-template.directive.ts libs/chat/src/lib/primitives/chat-message-list/message-template.directive.ts
```

Then create `chat-message-list.component.ts` based on the existing `chat-messages.component.ts`, applying:
1. Selector `chat-messages` → `chat-message-list`
2. Class `ChatMessagesComponent` → `ChatMessageListComponent`
3. Function `getMessageType` stays (still exported)
4. Add `styles: [CHAT_HOST_TOKENS, CHAT_MESSAGE_LIST_STYLES]` (next step adds the styles file)
5. Wrap each message in `<chat-message [role]="..." [prevRole]="prevRole(i)" [current]="i === messages.length - 1" [streaming]="agent().isLoading()">` and project the existing template content inside.

- [ ] **Step 3: Add styles**

```ts
// libs/chat/src/lib/styles/chat-message-list.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_MESSAGE_LIST_STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: var(--ngaf-chat-space-4) var(--ngaf-chat-space-6);
    max-width: var(--ngaf-chat-max-width);
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
`;
```

- [ ] **Step 4: Update message-template.directive.ts to use new selector**

```ts
// libs/chat/src/lib/primitives/chat-message-list/message-template.directive.ts
// SPDX-License-Identifier: MIT
import { Directive, input, TemplateRef, inject } from '@angular/core';
import type { MessageTemplateType } from '../../chat.types';

@Directive({
  selector: '[chatMessageTemplate]',
  standalone: true,
})
export class MessageTemplateDirective {
  readonly chatMessageTemplate = input.required<MessageTemplateType>();
  readonly templateRef = inject(TemplateRef);
}
```

- [ ] **Step 5: Move + adapt the existing spec to new path**

```bash
git mv libs/chat/src/lib/primitives/chat-messages/chat-messages.component.spec.ts \
       libs/chat/src/lib/primitives/chat-message-list/chat-message-list.component.spec.ts
```

Update the moved spec: replace `chat-messages` selector with `chat-message-list`, replace `ChatMessagesComponent` import/class with `ChatMessageListComponent`. Update assertions for `chat-message` wrapper presence (each message is now wrapped in `<chat-message>`).

- [ ] **Step 6: Delete old directory**

```bash
git rm -r libs/chat/src/lib/primitives/chat-messages/
```

- [ ] **Step 7: Run tests**

Run: `npx nx test chat -- --run chat-message-list`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-message-list libs/chat/src/lib/styles/chat-message-list.styles.ts
git commit -m "refactor(chat): rename chat-messages -> chat-message-list with chat-message wrapper"
```

---

### Task 9: Rewrite `<chat-input>` (pill design)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-input/chat-input.component.spec.ts`
- Create: `libs/chat/src/lib/styles/chat-input.styles.ts`

- [ ] **Step 1: Add styles**

```ts
// libs/chat/src/lib/styles/chat-input.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_INPUT_STYLES = `
  :host { display: block; background: var(--ngaf-chat-bg); }
  .chat-input__container { padding: 0 0 15px 0; background: var(--ngaf-chat-bg); }
  .chat-input__pill {
    cursor: text;
    position: relative;
    background: var(--ngaf-chat-surface-alt);
    border: 1px solid var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-input);
    padding: 12px 14px;
    padding-right: 56px;
    min-height: 75px;
    margin: 0 auto;
    width: 95%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    transition: border-color 200ms ease;
  }
  .chat-input__pill:focus-within { border-color: var(--ngaf-chat-text-muted); }
  .chat-input__textarea {
    flex: 1;
    outline: 0;
    border: 0;
    resize: none;
    background: transparent;
    color: var(--ngaf-chat-text);
    font-family: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    line-height: 1.5rem;
    width: 100%;
    margin: 0;
    padding: 0;
    field-sizing: content;
    min-height: 1.5rem;
    max-height: 9rem;
    overflow-y: auto;
  }
  .chat-input__textarea::placeholder { color: var(--ngaf-chat-text-muted); opacity: 1; }
  .chat-input__textarea::-webkit-scrollbar { width: 6px; }
  .chat-input__textarea::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 10px; }
  .chat-input__controls {
    position: absolute;
    right: 14px;
    bottom: 12px;
    display: flex;
    gap: 3px;
  }
  .chat-input__send {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    transition: transform 200ms ease, background 200ms ease;
  }
  .chat-input__send:hover:not(:disabled) { transform: scale(1.05); }
  .chat-input__send:disabled { background: var(--ngaf-chat-muted); color: var(--ngaf-chat-on-primary); cursor: not-allowed; }
  .chat-input__send svg { width: 16px; height: 16px; }
`;
```

- [ ] **Step 2: Read current `chat-input.component.ts`** to capture `submitMessage` helper export, current input/output API (`agent`, `submitOnEnter`, `placeholder`), and any directives consumed.

- [ ] **Step 3: Rewrite component**

```ts
// libs/chat/src/lib/primitives/chat-input/chat-input.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output, signal, viewChild,
  ElementRef, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_INPUT_STYLES } from '../../styles/chat-input.styles';

export async function submitMessage(agent: Agent, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await agent.submit({ message: trimmed });
}

@Component({
  selector: 'chat-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_INPUT_STYLES],
  template: `
    <div class="chat-input__container">
      <ng-content select="[chatInputBanner]" />
      <ng-content select="[chatInputAttachments]" />
      <div class="chat-input__pill" (click)="focusTextarea()">
        <ng-content select="[chatInputLeading]" />
        <textarea
          #textarea
          class="chat-input__textarea"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [(ngModel)]="value"
          (keydown)="onKeydown($event)"
          rows="1"
        ></textarea>
        <div class="chat-input__controls">
          <ng-content select="[chatInputTrailing]" />
          <button
            type="button"
            class="chat-input__send"
            [disabled]="!canSubmit()"
            (click)="onSubmit()"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
      <ng-content select="[chatInputFooter]" />
    </div>
  `,
})
export class ChatInputComponent {
  readonly agent = input<Agent | undefined>(undefined);
  readonly submitOnEnter = input(true);
  readonly placeholder = input('Type a message...');
  readonly disabled = input(false);

  readonly submitted = output<string>();

  protected readonly value = signal('');
  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly canSubmit = computed(() => {
    if (this.disabled()) return false;
    const a = this.agent();
    if (a?.isLoading()) return false;
    return this.value().trim().length > 0;
  });

  focusTextarea(): void {
    this.textareaRef()?.nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.submitOnEnter() && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.onSubmit();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    const text = this.value();
    this.value.set('');
    this.submitted.emit(text);
    const a = this.agent();
    if (a) await submitMessage(a, text);
  }
}
```

- [ ] **Step 4: Update existing spec**

Read `chat-input.component.spec.ts`. Replace any references to old class names / templates / Tailwind. Add a new test asserting:
- `data-* attributes`: textarea has `placeholder="Type a message..."`.
- Send button is disabled when value is empty.
- Pressing Enter (no shift) calls `submit` on bound mock agent.

(Adapt existing tests; do not delete unless they assert removed behavior.)

- [ ] **Step 5: Run tests**

Run: `npx nx test chat -- --run chat-input.component.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-input libs/chat/src/lib/styles/chat-input.styles.ts
git commit -m "refactor(chat): rewrite chat-input with new pill design"
```

---

### Task 10: Restyle `<chat-typing-indicator>` (3-dot)

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts`
- Create: `libs/chat/src/lib/styles/chat-typing-indicator.styles.ts`

- [ ] **Step 1: Styles**

```ts
// libs/chat/src/lib/styles/chat-typing-indicator.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_TYPING_INDICATOR_STYLES = `
  :host { display: block; padding: 0 var(--ngaf-chat-space-6) var(--ngaf-chat-space-3); }
  .chat-typing__dots { display: inline-flex; gap: 4px; align-items: center; }
  .chat-typing__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ngaf-chat-text-muted);
    animation: ngaf-chat-typing-dot 1.4s ease-in-out infinite both;
  }
  .chat-typing__dot:nth-child(2) { animation-delay: 0.2s; }
  .chat-typing__dot:nth-child(3) { animation-delay: 0.4s; }
`;
```

- [ ] **Step 2: Update component template + spec**

```ts
// libs/chat/src/lib/primitives/chat-typing-indicator/chat-typing-indicator.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_TYPING_INDICATOR_STYLES } from '../../styles/chat-typing-indicator.styles';

export function isTyping(agent: Agent): boolean {
  if (!agent.isLoading()) return false;
  const messages = agent.messages();
  const last = messages[messages.length - 1];
  if (!last) return true;
  return last.role !== 'assistant' || (typeof last.content === 'string' && last.content.length === 0);
}

@Component({
  selector: 'chat-typing-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_TYPING_INDICATOR_STYLES],
  template: `
    @if (typing()) {
      <div class="chat-typing__dots" role="status" aria-label="Assistant is typing">
        <span class="chat-typing__dot"></span>
        <span class="chat-typing__dot"></span>
        <span class="chat-typing__dot"></span>
      </div>
    }
  `,
})
export class ChatTypingIndicatorComponent {
  readonly agent = input.required<Agent>();
  readonly typing = computed(() => isTyping(this.agent()));
}
```

- [ ] **Step 3: Run existing spec**

Run: `npx nx test chat -- --run chat-typing-indicator.component.spec`
If it fails on Tailwind class assertions, update spec assertions to check `.chat-typing__dot` count instead.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-typing-indicator libs/chat/src/lib/styles/chat-typing-indicator.styles.ts
git commit -m "refactor(chat): restyle chat-typing-indicator as 3-dot animation"
```

---

### Task 11: Restyle `<chat-error>`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`
- Create: `libs/chat/src/lib/styles/chat-error.styles.ts`

- [ ] **Step 1: Styles**

```ts
// libs/chat/src/lib/styles/chat-error.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_ERROR_STYLES = `
  :host { display: block; }
  .chat-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    background: var(--ngaf-chat-error-bg);
    border: 1px solid var(--ngaf-chat-error-border);
    color: var(--ngaf-chat-error-text);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 8px 12px;
    font-size: var(--ngaf-chat-font-size-sm);
    margin: 0 var(--ngaf-chat-space-6) var(--ngaf-chat-space-2);
  }
  .chat-error__icon { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; }
  .chat-error__msg { flex: 1; min-width: 0; word-break: break-word; }
  .chat-error__dismiss {
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    padding: 0;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;
```

- [ ] **Step 2: Read current component, then rewrite template**

```ts
// libs/chat/src/lib/primitives/chat-error/chat-error.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import type { Agent } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_ERROR_STYLES } from '../../styles/chat-error.styles';

export function extractErrorMessage(agent: Agent): string | null {
  const err = agent.error?.();
  if (!err) return null;
  return err instanceof Error ? err.message : String(err);
}

@Component({
  selector: 'chat-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_ERROR_STYLES],
  template: `
    @if (message(); as msg) {
      <div class="chat-error" role="alert">
        <svg class="chat-error__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="chat-error__msg">{{ msg }}</span>
        @if (dismissible()) {
          <button type="button" class="chat-error__dismiss" (click)="dismissed.emit()" aria-label="Dismiss error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        }
      </div>
    }
  `,
})
export class ChatErrorComponent {
  readonly agent = input.required<Agent>();
  readonly dismissible = input(false);
  readonly dismissed = output<void>();
  readonly message = computed(() => extractErrorMessage(this.agent()));
}
```

- [ ] **Step 3: Update spec**

Update existing `chat-error.component.spec.ts` to check `.chat-error` class presence instead of any Tailwind classes; the API is unchanged.

- [ ] **Step 4: Run, PASS**, **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-error libs/chat/src/lib/styles/chat-error.styles.ts
git commit -m "refactor(chat): restyle chat-error"
```

---

### Task 12: Restyle `<chat-interrupt>`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts`
- Create: `libs/chat/src/lib/styles/chat-interrupt.styles.ts`

Same pattern as chat-error but warning-colored, with content-projection slot for action buttons.

- [ ] **Step 1: Styles**

```ts
// libs/chat/src/lib/styles/chat-interrupt.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_INTERRUPT_STYLES = `
  :host { display: block; }
  .chat-interrupt {
    background: var(--ngaf-chat-warning-bg);
    color: var(--ngaf-chat-warning-text);
    border-left: 3px solid var(--ngaf-chat-warning-text);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 12px 16px;
    margin: 0 var(--ngaf-chat-space-6) var(--ngaf-chat-space-2);
    font-size: var(--ngaf-chat-font-size-sm);
  }
  .chat-interrupt__title { font-weight: 600; margin: 0 0 4px; display: flex; align-items: center; gap: 6px; }
  .chat-interrupt__body { margin: 0 0 8px; opacity: 0.95; }
  .chat-interrupt__actions { display: flex; gap: 8px; flex-wrap: wrap; }
`;
```

- [ ] **Step 2: Read current chat-interrupt.component.ts** to capture `getInterrupt()` helper and its content-projection contract (`<ng-template>` with `$implicit` interrupt value).

- [ ] **Step 3: Rewrite component**

```ts
// libs/chat/src/lib/primitives/chat-interrupt/chat-interrupt.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, contentChild, TemplateRef, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent, AgentInterrupt } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_INTERRUPT_STYLES } from '../../styles/chat-interrupt.styles';

export function getInterrupt(agent: Agent): AgentInterrupt | null {
  return agent.interrupt?.() ?? null;
}

@Component({
  selector: 'chat-interrupt',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_INTERRUPT_STYLES],
  template: `
    @if (interrupt(); as i) {
      <div class="chat-interrupt" role="status">
        <div class="chat-interrupt__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
          Agent paused
        </div>
        @if (templateRef()) {
          <ng-container [ngTemplateOutlet]="templateRef()!" [ngTemplateOutletContext]="{ $implicit: i }" />
        } @else {
          <p class="chat-interrupt__body">{{ defaultText(i) }}</p>
        }
      </div>
    }
  `,
})
export class ChatInterruptComponent {
  readonly agent = input.required<Agent>();
  readonly templateRef = contentChild(TemplateRef);
  readonly interrupt = computed(() => getInterrupt(this.agent()));

  defaultText(i: AgentInterrupt): string {
    const v = (i as { value?: unknown }).value;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }
}
```

- [ ] **Step 4: Update spec, run, PASS, commit**

```bash
git add libs/chat/src/lib/primitives/chat-interrupt libs/chat/src/lib/styles/chat-interrupt.styles.ts
git commit -m "refactor(chat): restyle chat-interrupt"
```

---

### Task 13: Restyle `<chat-thread-list>`

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts`
- Create: `libs/chat/src/lib/styles/chat-thread-list.styles.ts`

- [ ] **Step 1: Styles**

```ts
// libs/chat/src/lib/styles/chat-thread-list.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_THREAD_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-thread-list__item {
    height: 36px;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: transparent;
    border: 0;
    text-align: left;
    width: 100%;
    transition: background-color 150ms ease;
  }
  .chat-thread-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-thread-list__item[data-active="true"] { background: var(--ngaf-chat-surface-alt); font-weight: 500; }
  .chat-thread-list__new {
    width: 100%;
    height: 36px;
    margin-bottom: var(--ngaf-chat-space-2);
    border: 1px dashed var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-button);
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    font-size: var(--ngaf-chat-font-size-sm);
    transition: background 150ms ease;
  }
  .chat-thread-list__new:hover { background: var(--ngaf-chat-surface-alt); }
`;
```

- [ ] **Step 2: Read current component to capture API (Thread type, threads/activeThreadId inputs, threadSelected output, content-projected template).**

- [ ] **Step 3: Rewrite template** — keep all inputs/outputs identical; replace inner Tailwind classes with the new `.chat-thread-list*` classes; add `+ New thread` button gated on a new optional `(newThreadRequested)` output that, if subscribed, makes the button render.

```ts
// libs/chat/src/lib/primitives/chat-thread-list/chat-thread-list.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output, contentChild, TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_THREAD_LIST_STYLES } from '../../styles/chat-thread-list.styles';

export interface Thread {
  id: string;
  title?: string;
}

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
      @for (t of threads(); track t.id) {
        <li>
          @if (templateRef()) {
            <ng-container [ngTemplateOutlet]="templateRef()!" [ngTemplateOutletContext]="{ $implicit: t, isActive: t.id === activeThreadId() }" />
          } @else {
            <button
              type="button"
              class="chat-thread-list__item"
              [attr.data-active]="t.id === activeThreadId() ? 'true' : null"
              [attr.aria-current]="t.id === activeThreadId() ? 'true' : null"
              (click)="threadSelected.emit(t.id)"
            >{{ t.title || t.id }}</button>
          }
        </li>
      }
    </ul>
  `,
})
export class ChatThreadListComponent {
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly showNewThreadButton = input(false);
  readonly threadSelected = output<string>();
  readonly newThreadRequested = output<void>();
  readonly templateRef = contentChild(TemplateRef);
}
```

- [ ] **Step 4: Update spec assertions to check the new `.chat-thread-list__item` selectors and `data-active` attribute, then run + commit.**

```bash
git add libs/chat/src/lib/primitives/chat-thread-list libs/chat/src/lib/styles/chat-thread-list.styles.ts
git commit -m "refactor(chat): restyle chat-thread-list"
```

---

### Task 14: Restyle `<chat-generative-ui>` wrapper

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`
- Create: `libs/chat/src/lib/styles/chat-generative-ui.styles.ts`

- [ ] **Step 1: Read current component** — preserve API exactly. The change is purely a visual wrapper: drop Tailwind, add CSS, add token-driven host styles for the rendered registry surface.

- [ ] **Step 2: Add styles**

```ts
// libs/chat/src/lib/styles/chat-generative-ui.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_GENERATIVE_UI_STYLES = `
  :host {
    display: block;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size);
    line-height: var(--ngaf-chat-line-height);
  }
  .chat-generative-ui__error {
    color: var(--ngaf-chat-error-text);
    background: var(--ngaf-chat-error-bg);
    border: 1px solid var(--ngaf-chat-error-border);
    border-radius: var(--ngaf-chat-radius-card);
    padding: 8px 12px;
    font-size: var(--ngaf-chat-font-size-sm);
  }
`;
```

- [ ] **Step 3: Update component to import and apply styles array; replace inner Tailwind classes with the new selectors. Run spec, commit.**

```bash
git add libs/chat/src/lib/primitives/chat-generative-ui libs/chat/src/lib/styles/chat-generative-ui.styles.ts
git commit -m "refactor(chat): restyle chat-generative-ui wrapper"
```

---

## Phase 4 — Trace-based card rewrites

### Task 15: Rewrite `<chat-tool-call-card>` to use `<chat-trace>`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts`

- [ ] **Step 1: Replace template + styles**

```ts
// libs/chat/src/lib/compositions/chat-tool-call-card/chat-tool-call-card.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatTraceComponent, type TraceState } from '../../primitives/chat-trace/chat-trace.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
}

@Component({
  selector: 'chat-tool-call-card',
  standalone: true,
  imports: [ChatTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .tcc__name { font-family: var(--ngaf-chat-font-mono); color: var(--ngaf-chat-text); }
    .tcc__status { font-size: var(--ngaf-chat-font-size-xs); }
    .tcc__status[data-state="done"] { color: var(--ngaf-chat-success); }
    .tcc__status[data-state="error"] { color: var(--ngaf-chat-error-text); }
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
    <chat-trace [state]="state()">
      <span traceLabel>
        <span class="tcc__name">{{ toolCall().name }}</span>
        @if (state() === 'done') {
          <span class="tcc__status" [attr.data-state]="state()">done</span>
        } @else if (state() === 'error') {
          <span class="tcc__status" [attr.data-state]="state()">error</span>
        } @else if (state() === 'running') {
          <span class="tcc__status">running…</span>
        }
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

  readonly state = computed<TraceState>(() => {
    const tc = this.toolCall();
    if (tc.result !== undefined) return 'done';
    return 'running';
  });

  formatJson(value: unknown): string {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
}
```

- [ ] **Step 2: Update existing spec** to assert `.tcc__name` text and `chat-trace` host present; remove Tailwind class assertions.

- [ ] **Step 3: Run, commit**

```bash
git add libs/chat/src/lib/compositions/chat-tool-call-card
git commit -m "refactor(chat): rewrite chat-tool-call-card on chat-trace"
```

---

### Task 16: Rewrite `<chat-subagent-card>` to use `<chat-trace>`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`

- [ ] **Step 1: Rewrite component (parallel to tool-call-card)**

```ts
// libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatTraceComponent, type TraceState } from '../../primitives/chat-trace/chat-trace.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { Subagent, SubagentStatus } from '../../agent/subagent';

function statusToTraceState(s: SubagentStatus): TraceState {
  switch (s) {
    case 'pending':  return 'pending';
    case 'running':  return 'running';
    case 'complete': return 'done';
    case 'error':    return 'error';
  }
}

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  imports: [ChatTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .sac__name { color: var(--ngaf-chat-text); font-weight: 500; font-size: var(--ngaf-chat-font-size-sm); }
    .sac__id { font-family: var(--ngaf-chat-font-mono); font-size: var(--ngaf-chat-font-size-xs); color: var(--ngaf-chat-text-muted); margin-left: 4px; }
    .sac__pill {
      padding: 1px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 4px;
    }
    .sac__pill[data-status="pending"] { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text-muted); }
    .sac__pill[data-status="running"] { background: var(--ngaf-chat-warning-bg); color: var(--ngaf-chat-warning-text); }
    .sac__pill[data-status="complete"] { color: var(--ngaf-chat-success); }
    .sac__pill[data-status="error"] { background: var(--ngaf-chat-error-bg); color: var(--ngaf-chat-error-text); }
    .sac__count { font-size: var(--ngaf-chat-font-size-xs); color: var(--ngaf-chat-text-muted); }
    .sac__latest-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ngaf-chat-text-muted); margin: 8px 0 4px; }
    .sac__latest {
      font-family: var(--ngaf-chat-font-mono);
      font-size: var(--ngaf-chat-font-size-xs);
      color: var(--ngaf-chat-text);
      white-space: pre-wrap;
      overflow-x: auto;
      margin: 0;
    }
  `],
  template: `
    <chat-trace [state]="state()">
      <span traceLabel>
        <span class="sac__name">Subagent</span>
        <span class="sac__id">{{ subagent().toolCallId }}</span>
        <span class="sac__pill" [attr.data-status]="subagent().status()">{{ subagent().status() }}</span>
      </span>
      <div class="sac__count">{{ subagent().messages().length }} message(s)</div>
      @if (subagent().messages().length > 0) {
        <p class="sac__latest-label">Latest message</p>
        <pre class="sac__latest">{{ latestMessageContent() }}</pre>
      }
    </chat-trace>
  `,
})
export class ChatSubagentCardComponent {
  readonly subagent = input.required<Subagent>();
  readonly state = computed<TraceState>(() => statusToTraceState(this.subagent().status()));

  readonly latestMessageContent = computed(() => {
    const messages = this.subagent().messages();
    if (messages.length === 0) return '';
    const last = messages[messages.length - 1];
    const c = last.content;
    return typeof c === 'string' ? c : JSON.stringify(c);
  });
}
```

- [ ] **Step 2: Update spec, run, commit**

```bash
git add libs/chat/src/lib/compositions/chat-subagent-card
git commit -m "refactor(chat): rewrite chat-subagent-card on chat-trace"
```

---

### Task 17: Rewrite `<chat-timeline-slider>` as vertical history walk

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts`

- [ ] **Step 1: Read current component** to capture inputs/outputs (`agent`, `checkpointSelected`).

- [ ] **Step 2: Rewrite as vertical list**

```ts
// libs/chat/src/lib/compositions/chat-timeline-slider/chat-timeline-slider.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output, computed, signal,
} from '@angular/core';
import type { AgentWithHistory, AgentCheckpoint } from '../../agent';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-timeline-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; padding: var(--ngaf-chat-space-2); }
    .timeline { list-style: none; padding-left: 12px; margin: 0; border-left: 1px solid var(--ngaf-chat-separator); }
    .timeline__entry {
      display: block;
      width: 100%;
      text-align: left;
      padding: 4px 8px;
      margin: 0 0 0 -1px;
      background: transparent;
      border: 0;
      border-left: 2px solid transparent;
      cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      font-size: var(--ngaf-chat-font-size-sm);
      transition: background 150ms ease;
    }
    .timeline__entry:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
    .timeline__entry[data-active="true"] {
      border-left-color: var(--ngaf-chat-primary);
      color: var(--ngaf-chat-text);
      font-weight: 500;
    }
    .timeline__index { font-family: var(--ngaf-chat-font-mono); font-size: var(--ngaf-chat-font-size-xs); color: var(--ngaf-chat-text-muted); margin-right: 6px; }
    .timeline__footer { display: flex; gap: 8px; margin-top: 8px; }
    .timeline__btn {
      background: transparent;
      border: 0;
      color: var(--ngaf-chat-primary);
      cursor: pointer;
      font-size: var(--ngaf-chat-font-size-sm);
      padding: 4px 6px;
    }
    .timeline__btn:hover { text-decoration: underline; }
  `],
  template: `
    <ul class="timeline">
      @for (cp of history(); track $index) {
        <li>
          <button
            type="button"
            class="timeline__entry"
            [attr.data-active]="$index === activeIndex() ? 'true' : null"
            (click)="select(cp, $index)"
          >
            <span class="timeline__index">#{{ $index }}</span>{{ summarize(cp) }}
          </button>
        </li>
      }
    </ul>
    @if (history().length > 0) {
      <div class="timeline__footer">
        <button type="button" class="timeline__btn" (click)="jumpToLatest()">Latest</button>
      </div>
    }
  `,
})
export class ChatTimelineSliderComponent {
  readonly agent = input.required<AgentWithHistory>();
  readonly checkpointSelected = output<AgentCheckpoint>();

  readonly history = computed<AgentCheckpoint[]>(() => this.agent().history());
  readonly activeIndex = signal<number | null>(null);

  select(cp: AgentCheckpoint, index: number): void {
    this.activeIndex.set(index);
    this.checkpointSelected.emit(cp);
  }

  jumpToLatest(): void {
    const list = this.history();
    if (list.length === 0) return;
    this.select(list[list.length - 1], list.length - 1);
  }

  summarize(cp: AgentCheckpoint): string {
    const id = (cp as { id?: string }).id ?? '';
    return id.length > 28 ? id.slice(0, 28) + '…' : id;
  }
}
```

- [ ] **Step 3: Delete any horizontal-slider-specific spec assertions; rewrite spec to test vertical list rendering, active-state attribute, footer button.**

- [ ] **Step 4: Run, commit**

```bash
git add libs/chat/src/lib/compositions/chat-timeline-slider
git commit -m "refactor(chat): rewrite chat-timeline-slider as vertical history walk"
```

---

### Task 18: Update `<chat-tool-calls>` and `<chat-subagents>` default templates

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.ts`

- [ ] **Step 1: For each, change template** so that when no `templateRef` is content-projected, render the new card composition by default. Currently they only render when a template is projected; change to fall back to the card.

For chat-tool-calls:

```ts
// libs/chat/src/lib/primitives/chat-tool-calls/chat-tool-calls.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, computed, contentChild, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent, Message, ToolCall } from '../../agent';
import { ChatToolCallCardComponent } from '../../compositions/chat-tool-call-card/chat-tool-call-card.component';

@Component({
  selector: 'chat-tool-calls',
  standalone: true,
  imports: [NgTemplateOutlet, ChatToolCallCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toolCall of toolCalls(); track toolCall.id) {
      @if (templateRef()) {
        <ng-container [ngTemplateOutlet]="templateRef()!" [ngTemplateOutletContext]="{ $implicit: toolCall }" />
      } @else {
        <chat-tool-call-card [toolCall]="toolCall" />
      }
    }
  `,
})
export class ChatToolCallsComponent {
  readonly agent = input.required<Agent>();
  readonly message = input<Message | undefined>(undefined);
  readonly templateRef = contentChild(TemplateRef);

  readonly toolCalls = computed((): ToolCall[] => {
    const msg = this.message();
    if (msg && msg.role === 'assistant' && Array.isArray(msg.content)) {
      const blocks = msg.content.filter((b) => b.type === 'tool_use');
      const all = this.agent().toolCalls();
      return blocks.map(b => all.find(tc => tc.id === b.id)).filter((x): x is ToolCall => !!x);
    }
    return this.agent().toolCalls();
  });
}
```

(Note: `ToolCall` from agent contract may or may not match `ToolCallInfo` shape exactly. If shapes differ, add a small mapper at the call site or extend `ToolCallInfo` to accept agent's shape. Verify by reading `libs/chat/src/lib/agent/index.ts`.)

For chat-subagents:

```ts
// libs/chat/src/lib/primitives/chat-subagents/chat-subagents.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, computed, contentChild, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Agent } from '../../agent';
import type { Subagent } from '../../agent/subagent';
import { ChatSubagentCardComponent } from '../../compositions/chat-subagent-card/chat-subagent-card.component';

export function activeSubagentsFromAgent(agent: Agent): Subagent[] {
  const map = agent.subagents?.();
  if (!map) return [];
  const out: Subagent[] = [];
  map.forEach((sa) => {
    const s = sa.status();
    if (s !== 'complete' && s !== 'error') out.push(sa);
  });
  return out;
}

@Component({
  selector: 'chat-subagents',
  standalone: true,
  imports: [NgTemplateOutlet, ChatSubagentCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (subagent of activeSubagents(); track subagent.toolCallId) {
      @if (templateRef()) {
        <ng-container [ngTemplateOutlet]="templateRef()!" [ngTemplateOutletContext]="{ $implicit: subagent }" />
      } @else {
        <chat-subagent-card [subagent]="subagent" />
      }
    }
  `,
})
export class ChatSubagentsComponent {
  readonly agent = input.required<Agent>();
  readonly templateRef = contentChild(TemplateRef);
  readonly activeSubagents = computed(() => activeSubagentsFromAgent(this.agent()));
}
```

- [ ] **Step 2: Run existing specs**, update to handle new default rendering path.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-tool-calls libs/chat/src/lib/primitives/chat-subagents
git commit -m "refactor(chat): default-render trace-based cards for tool-calls/subagents"
```

---

## Phase 5 — Top-level compositions

### Task 19: Rewrite `<chat>` (embedded mode)

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Read current chat.component.ts** in full to map current props/outputs/contracts. Preserve the public API: inputs `agent`, `views`, `store`, `handlers`, `threads`, `activeThreadId`, output `threadSelected`, output `renderEvent`. Remove the old internal Tailwind structure.

- [ ] **Step 2: Rewrite component**

```ts
// libs/chat/src/lib/compositions/chat/chat.component.ts
// SPDX-License-Identifier: MIT
import {
  Component, ChangeDetectionStrategy, input, output, computed, effect, viewChild, ElementRef,
  DestroyRef, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KeyValuePipe } from '@angular/common';
import type { Agent } from '../../agent';
import type { ViewRegistry, RenderEvent } from '@ngaf/render';
import type { A2uiActionMessage } from '@ngaf/a2ui';
import type { StateStore } from '@json-render/core';
import { toRenderRegistry, signalStateStore } from '@ngaf/render';
import { ChatWindowComponent } from '../../primitives/chat-window/chat-window.component';
import { ChatMessageListComponent } from '../../primitives/chat-message-list/chat-message-list.component';
import { MessageTemplateDirective } from '../../primitives/chat-message-list/message-template.directive';
import { ChatMessageComponent } from '../../primitives/chat-message/chat-message.component';
import { ChatInputComponent } from '../../primitives/chat-input/chat-input.component';
import { ChatTypingIndicatorComponent } from '../../primitives/chat-typing-indicator/chat-typing-indicator.component';
import { ChatErrorComponent } from '../../primitives/chat-error/chat-error.component';
import { ChatInterruptComponent } from '../../primitives/chat-interrupt/chat-interrupt.component';
import { ChatThreadListComponent, type Thread } from '../../primitives/chat-thread-list/chat-thread-list.component';
import { ChatGenerativeUiComponent } from '../../primitives/chat-generative-ui/chat-generative-ui.component';
import { ChatSuggestionsComponent } from '../../primitives/chat-suggestions/chat-suggestions.component';
import { ChatStreamingMdComponent } from '../../streaming/streaming-markdown.component';
import { ChatToolCallsComponent } from '../../primitives/chat-tool-calls/chat-tool-calls.component';
import { ChatSubagentsComponent } from '../../primitives/chat-subagents/chat-subagents.component';
import { A2uiSurfaceComponent } from '../../a2ui/surface.component';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';
import { messageContent } from '../shared/message-utils';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import type { ChatRenderEvent } from './chat-render-event';

@Component({
  selector: 'chat',
  standalone: true,
  imports: [
    KeyValuePipe,
    ChatWindowComponent, ChatMessageListComponent, MessageTemplateDirective, ChatMessageComponent,
    ChatInputComponent, ChatTypingIndicatorComponent, ChatErrorComponent, ChatInterruptComponent,
    ChatThreadListComponent, ChatGenerativeUiComponent, ChatSuggestionsComponent,
    ChatStreamingMdComponent, ChatToolCallsComponent, ChatSubagentsComponent, A2uiSurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--ngaf-chat-bg); }
    .chat-shell { display: flex; flex: 1; min-height: 0; }
    .chat-shell__sidebar {
      width: 240px;
      flex-shrink: 0;
      border-right: 1px solid var(--ngaf-chat-separator);
      background: var(--ngaf-chat-surface-alt);
      overflow-y: auto;
      display: none;
    }
    @media (min-width: 768px) { .chat-shell__sidebar { display: block; } }
    .chat-shell__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px 20px;
      color: var(--ngaf-chat-text-muted);
      text-align: center;
    }
    .chat-empty__title { font-size: 1.125rem; font-weight: 500; color: var(--ngaf-chat-text); margin: 0; }
    .chat-empty__sub { margin: 0; font-size: var(--ngaf-chat-font-size-sm); }
    .chat-scroll { flex: 1; min-height: 0; overflow-y: auto; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 10px; }
  `],
  template: `
    <div class="chat-shell">
      @if (threads().length > 0) {
        <aside class="chat-shell__sidebar">
          <chat-thread-list
            [threads]="threads()"
            [activeThreadId]="activeThreadId()"
            (threadSelected)="threadSelected.emit($event)"
          />
        </aside>
      }
      <div class="chat-shell__main">
        <chat-window>
          <ng-content select="[chatHeader]" chatHeader />
          <div chatBody class="chat-scroll" #scrollContainer>
            @if (agent().messages().length === 0 && !agent().isLoading()) {
              <div class="chat-empty">
                <ng-content select="[chatEmptyState]" />
                <ng-template #defaultEmpty>
                  <p class="chat-empty__title">How can I help?</p>
                  <p class="chat-empty__sub">Ask anything to get started.</p>
                </ng-template>
              </div>
            }

            <chat-message-list [agent]="agent()">
              <ng-template chatMessageTemplate="human" let-message let-i="index">
                <chat-message [role]="'user'" [prevRole]="prevRole(i)">{{ messageContent(message) }}</chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="ai" let-message let-i="index">
                @let content = messageContent(message);
                @let classified = classifyMessage(content, i);
                <chat-message
                  [role]="'assistant'"
                  [prevRole]="prevRole(i)"
                  [streaming]="agent().isLoading()"
                  [current]="i === agent().messages().length - 1"
                >
                  <chat-tool-calls [agent]="agent()" [message]="message" />
                  <chat-subagents [agent]="agent()" />
                  @if (classified.markdown(); as md) {
                    <chat-streaming-md [content]="md" [streaming]="agent().isLoading() && i === agent().messages().length - 1" />
                  }
                  @if (classified.spec(); as spec) {
                    <chat-generative-ui
                      [spec]="spec"
                      [registry]="renderRegistry()"
                      [store]="resolvedStore()"
                      [handlers]="handlers()"
                      [loading]="agent().isLoading()"
                      (events)="onSpecEvent($event, i)"
                    />
                  }
                  @if (classified.type() === 'a2ui' && views(); as catalog) {
                    @for (entry of classified.a2uiSurfaces() | keyvalue; track entry.key) {
                      <a2ui-surface
                        [surface]="entry.value"
                        [catalog]="catalog"
                        [handlers]="handlers()"
                        (action)="onA2uiAction($event)"
                        (events)="onA2uiEvent($event, i, entry.key)"
                      />
                    }
                  }
                </chat-message>
              </ng-template>

              <ng-template chatMessageTemplate="tool" let-message>
                <!-- Tool messages route through chat-trace; hidden from main flow -->
              </ng-template>

              <ng-template chatMessageTemplate="system" let-message>
                <chat-message [role]="'system'">{{ messageContent(message) }}</chat-message>
              </ng-template>
            </chat-message-list>

            <chat-typing-indicator [agent]="agent()" />
          </div>
          <div chatFooter>
            <chat-error [agent]="agent()" />
            <chat-interrupt [agent]="agent()" />
            <chat-input [agent]="agent()" [submitOnEnter]="true" placeholder="Type a message..." />
          </div>
        </chat-window>
      </div>
    </div>
  `,
})
export class ChatComponent {
  readonly agent = input.required<Agent>();
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly threads = input<Thread[]>([]);
  readonly activeThreadId = input<string>('');
  readonly threadSelected = output<string>();
  readonly renderEvent = output<ChatRenderEvent>();

  private readonly _internalStore = signalStateStore({});
  readonly resolvedStore = computed(() => {
    const explicit = this.store();
    if (explicit) return explicit;
    if (this.views()) return this._internalStore;
    return undefined;
  });

  readonly renderRegistry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  readonly messageContent = messageContent;
  private readonly classifiers = new Map<number, ContentClassifier>();
  private readonly destroyRef = inject(DestroyRef);
  private eventsSubscribed = false;

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly messageCount = computed(() => this.agent().messages().length);
  private prevMessageCount = 0;

  constructor() {
    effect(() => {
      if (this.eventsSubscribed) return;
      let agent: ReturnType<typeof this.agent>;
      try { agent = this.agent(); } catch { return; }
      this.eventsSubscribed = true;
      agent.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.type !== 'state_update') return;
        const store = this.resolvedStore();
        if (!store) return;
        store.update(event.data);
      });
    });

    effect(() => {
      let count: number;
      let msgs: ReturnType<ReturnType<typeof this.agent>['messages']>;
      try { count = this.messageCount(); msgs = this.agent().messages(); } catch { return; }
      const lastContent = msgs.length > 0 ? (msgs[msgs.length - 1] as unknown as Record<string, unknown>)['content'] : undefined;
      void lastContent;
      const el = this.scrollContainer()?.nativeElement;
      if (!el) return;
      const isNewMessage = count !== this.prevMessageCount;
      this.prevMessageCount = count;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNewMessage || isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'instant' : 'smooth' });
        });
      }
    });
  }

  prevRole(index: number): 'user' | 'assistant' | 'system' | 'tool' | undefined {
    if (index === 0) return undefined;
    const prev = this.agent().messages()[index - 1];
    if (!prev) return undefined;
    const role = (prev as unknown as { role?: string }).role;
    return role === 'human' ? 'user' : role === 'ai' ? 'assistant' : (role as 'user' | 'assistant' | 'system' | 'tool');
  }

  classifyMessage(content: string, index: number): ContentClassifier {
    let c = this.classifiers.get(index);
    if (!c) { c = createContentClassifier(); this.classifiers.set(index, c); }
    c.update(content);
    return c;
  }

  onSpecEvent(event: RenderEvent, messageIndex: number): void {
    this.renderEvent.emit({ messageIndex, event });
  }

  onA2uiAction(message: A2uiActionMessage): void {
    void this.agent().submit({ message: JSON.stringify(message) });
  }

  onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
    this.renderEvent.emit({ messageIndex, surfaceId, event });
  }
}
```

- [ ] **Step 3: Update existing chat.component.spec.ts** to:
  - Drop assertions about avatar div presence
  - Drop assertions about Tailwind classes on inner elements
  - Add assertion that user messages render inside `chat-message[data-role="user"]` and assistant messages inside `chat-message[data-role="assistant"]`
  - Keep behavior tests (auto-scroll on new message, handlers wiring, generative-ui projection)

- [ ] **Step 4: Run, commit**

```bash
git add libs/chat/src/lib/compositions/chat
git commit -m "refactor(chat): rewrite <chat> composition for new visual design"
```

---

### Task 20: Build `<chat-popup>` composition

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// libs/chat/src/lib/compositions/chat-popup/chat-popup.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatPopupComponent } from './chat-popup.component';
import { mockAgent } from '../../testing/mock-agent';

@Component({
  standalone: true,
  imports: [ChatPopupComponent],
  template: `<chat-popup [agent]="agent" [(open)]="isOpen" />`,
})
class Host {
  agent = mockAgent();
  isOpen = signal(false);
}

describe('ChatPopupComponent', () => {
  it('renders launcher button when closed and toggles open via click', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    const launcher = fx.nativeElement.querySelector('chat-launcher-button button');
    expect(launcher).toBeTruthy();
    expect(fx.nativeElement.querySelector('.chat-popup__window[data-open="true"]')).toBeNull();
    launcher.click();
    fx.detectChanges();
    expect(fx.componentInstance.isOpen()).toBe(true);
    expect(fx.nativeElement.querySelector('.chat-popup__window[data-open="true"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, output, model } from '@angular/core';
import type { Agent } from '../../agent';
import { ChatComponent } from '../chat/chat.component';
import { ChatLauncherButtonComponent } from '../../primitives/chat-launcher-button/chat-launcher-button.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-popup',
  standalone: true,
  imports: [ChatComponent, ChatLauncherButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { position: fixed; bottom: 1rem; right: 1rem; z-index: 30; }
    .chat-popup__launcher { position: relative; }
    .chat-popup__window {
      position: fixed;
      bottom: 5rem;
      right: 1rem;
      width: 24rem;
      height: 600px;
      max-height: calc(100vh - 6rem);
      background: var(--ngaf-chat-bg);
      border-radius: 0.75rem;
      box-shadow: 0 5px 40px rgba(0,0,0,.16);
      transform-origin: bottom right;
      transform: scale(0.95) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: transform 200ms ease-out, opacity 100ms ease-out;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .chat-popup__window[data-open="true"] {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    @media (max-width: 640px) {
      .chat-popup__window { inset: 0; width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; bottom: auto; right: auto; }
    }
    .chat-popup__close {
      position: absolute; top: 8px; right: 8px;
      width: 32px; height: 32px;
      background: transparent; border: 0; cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      border-radius: 50%;
    }
    .chat-popup__close:hover { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text); }
  `],
  template: `
    <div class="chat-popup__launcher">
      <chat-launcher-button (click)="toggle()" />
    </div>
    <div class="chat-popup__window" [attr.data-open]="open() ? 'true' : 'false'" role="dialog" aria-modal="false">
      <button type="button" class="chat-popup__close" (click)="closeWindow()" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <chat [agent]="agent()">
        <ng-content select="[chatHeader]" chatHeader />
      </chat>
    </div>
  `,
})
export class ChatPopupComponent {
  readonly agent = input.required<Agent>();
  readonly open = model(false);

  toggle(): void { this.open.update((v) => !v); }
  openWindow(): void { this.open.set(true); }
  closeWindow(): void { this.open.set(false); }
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-popup
git commit -m "feat(chat): add chat-popup floating composition"
```

---

### Task 21: Build `<chat-sidebar>` composition

**Files:**
- Create: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`
- Create: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts`

- [ ] **Step 1: Failing test**

```ts
// libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatSidebarComponent } from './chat-sidebar.component';
import { mockAgent } from '../../testing/mock-agent';

@Component({
  standalone: true,
  imports: [ChatSidebarComponent],
  template: `<chat-sidebar [agent]="agent" [(open)]="isOpen" [pushContent]="true"><div id="content">app</div></chat-sidebar>`,
})
class Host { agent = mockAgent(); isOpen = signal(false); }

describe('ChatSidebarComponent', () => {
  it('renders projected content and toggles open attribute', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('#content')).toBeTruthy();
    const panel = fx.nativeElement.querySelector('.chat-sidebar__panel');
    expect(panel.getAttribute('data-open')).toBe('false');
    fx.componentInstance.isOpen.set(true);
    fx.detectChanges();
    expect(panel.getAttribute('data-open')).toBe('true');
  });
});
```

- [ ] **Step 2: Run, FAIL.**

- [ ] **Step 3: Implement**

```ts
// libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import type { Agent } from '../../agent';
import { ChatComponent } from '../chat/chat.component';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';

@Component({
  selector: 'chat-sidebar',
  standalone: true,
  imports: [ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, `
    :host { display: block; }
    .chat-sidebar__content { transition: margin-right 300ms ease; min-height: 100vh; }
    :host([data-push="true"][data-open="true"]) .chat-sidebar__content { margin-right: 28rem; }
    @media (max-width: 640px) {
      :host([data-push="true"][data-open="true"]) .chat-sidebar__content { margin-right: 0; }
    }
    .chat-sidebar__panel {
      position: fixed;
      top: 0; right: 0; bottom: 0;
      width: 28rem;
      background: var(--ngaf-chat-bg);
      box-shadow: -8px 0 32px rgba(0,0,0,.12);
      transform: translateX(100%);
      transition: transform 200ms ease-out;
      z-index: 30;
      display: flex;
      flex-direction: column;
    }
    .chat-sidebar__panel[data-open="true"] { transform: translateX(0); }
    @media (max-width: 640px) {
      .chat-sidebar__panel { width: 100vw; }
    }
    .chat-sidebar__close {
      position: absolute; top: 8px; right: 8px;
      width: 32px; height: 32px;
      background: transparent; border: 0; cursor: pointer;
      color: var(--ngaf-chat-text-muted);
      border-radius: 50%; z-index: 1;
    }
    .chat-sidebar__close:hover { background: var(--ngaf-chat-surface-alt); color: var(--ngaf-chat-text); }
  `],
  host: {
    '[attr.data-push]': 'pushContent() ? "true" : "false"',
    '[attr.data-open]': 'open() ? "true" : "false"',
  },
  template: `
    <div class="chat-sidebar__content"><ng-content /></div>
    <aside class="chat-sidebar__panel" [attr.data-open]="open() ? 'true' : 'false'" role="complementary" aria-hidden="{{ open() ? 'false' : 'true' }}">
      <button type="button" class="chat-sidebar__close" (click)="closeWindow()" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <chat [agent]="agent()">
        <ng-content select="[chatHeader]" chatHeader />
      </chat>
    </aside>
  `,
})
export class ChatSidebarComponent {
  readonly agent = input.required<Agent>();
  readonly open = model(false);
  readonly pushContent = input(false);

  toggle(): void { this.open.update((v) => !v); }
  openWindow(): void { this.open.set(true); }
  closeWindow(): void { this.open.set(false); }
}
```

- [ ] **Step 4: Run, PASS.**

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidebar
git commit -m "feat(chat): add chat-sidebar slide-in composition"
```

---

## Phase 6 — Restyle remaining compositions

### Task 22: Rewrite `<chat-interrupt-panel>`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component.ts`

- [ ] **Step 1: Read current component** (101 lines) to capture API. Replace inner Tailwind with new styles using `chat-interrupt`-style card pattern + content-projected action buttons.

- [ ] **Step 2: Rewrite** — apply same warning-card pattern as `chat-interrupt` primitive but with content-projection slots `[chatInterruptActions]`. Replace Tailwind classes with hand-written CSS using `--ngaf-chat-warning-*` tokens. Add `styles: [CHAT_HOST_TOKENS, ...]`.

- [ ] **Step 3: Update spec, run, commit**

```bash
git add libs/chat/src/lib/compositions/chat-interrupt-panel
git commit -m "refactor(chat): restyle chat-interrupt-panel"
```

---

### Task 23: Rewrite `<chat-debug>` and helpers

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-checkpoint-card.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-controls.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-detail.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-state-diff.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-state-inspector.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-summary.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-debug/debug-timeline.component.ts`

For each helper component:

- [ ] **Step 1: Read the current file**, identify Tailwind classes and CSS-property style attributes (`var(--chat-*)`).
- [ ] **Step 2: Replace** Tailwind classes with hand-written CSS in `styles: [CHAT_HOST_TOKENS, '...']`. Replace `--chat-*` token names with `--ngaf-chat-*`. Where a card or trace pattern fits (debug-checkpoint-card, debug-timeline), use `<chat-trace>`.
- [ ] **Step 3: Update specs to match new selectors / classes.**
- [ ] **Step 4: Run debug specs**

Run: `npx nx test chat -- --run chat-debug`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug
git commit -m "refactor(chat): restyle chat-debug + helpers (no Tailwind, new tokens)"
```

---

## Phase 7 — Cleanup chat library

### Task 24: Delete obsolete style files

**Files:**
- Delete: `libs/chat/src/lib/styles/chat-theme.ts`
- Delete: `libs/chat/src/lib/styles/chat-markdown.ts`
- Verify: no remaining imports of `CHAT_THEME_STYLES` or `CHAT_MARKDOWN_STYLES`

- [ ] **Step 1: Search for references**

Run: `grep -rn "CHAT_THEME_STYLES\|CHAT_MARKDOWN_STYLES\|chat-theme\|chat-markdown'" libs/chat/src cockpit apps`
Expected: zero hits in `libs/chat`. Hits in cockpit demos/website docs are fine (next phase will update them, but the old import paths will break — expected).

- [ ] **Step 2: Verify markdown rendering still works**

The old `chat-markdown.ts` exported `renderMarkdown` and `CHAT_MARKDOWN_STYLES`. The new design moves markdown styling into `chat-streaming-md`'s component-encapsulated styles + the host markdown rules. Read current `streaming/streaming-markdown.component.ts`. If it references the old file, update its imports to the new `styles/chat-markdown.styles.ts` constant (create if not done in Task 14).

Create `libs/chat/src/lib/styles/chat-markdown.styles.ts`:

```ts
// SPDX-License-Identifier: MIT
export const CHAT_MARKDOWN_STYLES = `
  :host { display: block; color: var(--ngaf-chat-text); line-height: var(--ngaf-chat-line-height); }
  :host h1, :host h2, :host h3, :host h4, :host h5, :host h6 { font-weight: bold; line-height: 1.2; margin: 0 0 1rem; }
  :host h1 { font-size: 1.5em; }
  :host h2 { font-size: 1.25em; font-weight: 600; }
  :host h3 { font-size: 1.1em; }
  :host h4 { font-size: 1em; }
  :host p { margin: 0 0 1rem; line-height: 1.75; font-size: var(--ngaf-chat-font-size); }
  :host p:last-child { margin-bottom: 0; }
  :host a { color: var(--ngaf-chat-primary); text-decoration: underline; }
  :host ul, :host ol { margin: 0 0 1rem; padding-left: 1.25rem; }
  :host code {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 1px 4px;
    border-radius: 4px;
    font-family: var(--ngaf-chat-font-mono);
    font-size: 0.9em;
  }
  :host pre {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 12px;
    border-radius: var(--ngaf-chat-radius-card);
    overflow-x: auto;
    font-family: var(--ngaf-chat-font-mono);
    font-size: var(--ngaf-chat-font-size-sm);
    margin: 0 0 1rem;
  }
  :host pre code { background: transparent; padding: 0; border-radius: 0; }
  :host blockquote {
    border-left: 3px solid var(--ngaf-chat-separator);
    padding-left: 12px;
    margin: 0 0 1rem;
    color: var(--ngaf-chat-text-muted);
  }
`;
```

Update `streaming/streaming-markdown.component.ts` to import from `../styles/chat-markdown.styles` and apply `CHAT_HOST_TOKENS` + `CHAT_MARKDOWN_STYLES` in its styles array.

- [ ] **Step 3: Delete files**

```bash
git rm libs/chat/src/lib/styles/chat-theme.ts libs/chat/src/lib/styles/chat-markdown.ts
```

- [ ] **Step 4: Build to verify nothing left dangling**

Run: `npx nx build chat 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-markdown.styles.ts libs/chat/src/lib/streaming/streaming-markdown.component.ts
git commit -m "refactor(chat): drop legacy chat-theme/chat-markdown style modules"
```

---

### Task 25: Update `public-api.ts`

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Apply edits**

```ts
// libs/chat/src/public-api.ts
// SPDX-License-Identifier: MIT

// Shared types
export type { ChatConfig } from './lib/provide-chat';
export type { MessageTemplateType } from './lib/chat.types';

// Agent contract (runtime-neutral)
export type {
  Agent, AgentWithHistory, Message, Role, ContentBlock, ToolCall, ToolCallStatus,
  AgentStatus, AgentInterrupt, Subagent, SubagentStatus, AgentSubmitInput,
  AgentSubmitOptions, AgentEvent, AgentStateUpdateEvent, AgentCustomEvent, AgentCheckpoint,
} from './lib/agent';
export { isUserMessage, isAssistantMessage, isToolMessage, isSystemMessage } from './lib/agent';

// Primitives
export { ChatMessageListComponent, getMessageType } from './lib/primitives/chat-message-list/chat-message-list.component';
export { MessageTemplateDirective } from './lib/primitives/chat-message-list/message-template.directive';
export { ChatMessageComponent } from './lib/primitives/chat-message/chat-message.component';
export type { ChatMessageRole } from './lib/primitives/chat-message/chat-message.component';
export { ChatWindowComponent } from './lib/primitives/chat-window/chat-window.component';
export { ChatTraceComponent } from './lib/primitives/chat-trace/chat-trace.component';
export type { TraceState } from './lib/primitives/chat-trace/chat-trace.component';
export { ChatLauncherButtonComponent } from './lib/primitives/chat-launcher-button/chat-launcher-button.component';
export { ChatSuggestionsComponent } from './lib/primitives/chat-suggestions/chat-suggestions.component';
export { ChatInputComponent, submitMessage } from './lib/primitives/chat-input/chat-input.component';
export { ChatTypingIndicatorComponent, isTyping } from './lib/primitives/chat-typing-indicator/chat-typing-indicator.component';
export { ChatErrorComponent, extractErrorMessage } from './lib/primitives/chat-error/chat-error.component';
export { ChatInterruptComponent, getInterrupt } from './lib/primitives/chat-interrupt/chat-interrupt.component';
export { ChatToolCallsComponent } from './lib/primitives/chat-tool-calls/chat-tool-calls.component';
export { ChatSubagentsComponent } from './lib/primitives/chat-subagents/chat-subagents.component';
export { ChatThreadListComponent } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export type { Thread } from './lib/primitives/chat-thread-list/chat-thread-list.component';
export { ChatTimelineComponent } from './lib/primitives/chat-timeline/chat-timeline.component';

// Compositions
export { ChatComponent } from './lib/compositions/chat/chat.component';
export { ChatPopupComponent } from './lib/compositions/chat-popup/chat-popup.component';
export { ChatSidebarComponent } from './lib/compositions/chat-sidebar/chat-sidebar.component';
export { ChatDebugComponent } from './lib/compositions/chat-debug/chat-debug.component';
export { ChatTimelineSliderComponent } from './lib/compositions/chat-timeline-slider/chat-timeline-slider.component';
export { ChatInterruptPanelComponent } from './lib/compositions/chat-interrupt-panel/chat-interrupt-panel.component';
export { ChatToolCallCardComponent } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export type { ToolCallInfo } from './lib/compositions/chat-tool-call-card/chat-tool-call-card.component';
export { ChatSubagentCardComponent } from './lib/compositions/chat-subagent-card/chat-subagent-card.component';

// Streaming
export { ChatStreamingMdComponent } from './lib/streaming/streaming-markdown.component';

// DI
export { provideChat, CHAT_CONFIG } from './lib/provide-chat';

// A2UI catalog (existing exports — KEEP all of them, abbreviated here for brevity in the plan)
// (Re-paste lines 60-90 of the previous public-api.ts verbatim — A2UI catalog + a2ui types + mockAgent.)
```

**IMPORTANT** when applying this edit: the section labeled "A2UI catalog" plus type re-exports plus `mockAgent` exports must be preserved exactly from the existing file. The plan abbreviates them — the engineer must paste from the existing file's lines 53-96.

- [ ] **Step 2: Verify nothing references removed exports**

Run: `grep -rn "CHAT_THEME_STYLES\|CHAT_MARKDOWN_STYLES\|ChatMessagesComponent" libs/chat/src apps cockpit | grep -v "node_modules\|dist\|\.spec\."`
Expected: only references in cockpit demos and website docs (those updated in Phase 8/9).

- [ ] **Step 3: Build**

Run: `npx nx build chat 2>&1 | tail -10`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "refactor(chat): update public-api for new components"
```

---

### Task 26: Bump @ngaf/chat to 0.0.3

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Bump**

Edit `libs/chat/package.json` field `"version": "0.0.2"` → `"version": "0.0.3"`.

- [ ] **Step 2: Commit (no other libs change unless their source changed — leave their versions alone)**

```bash
git add libs/chat/package.json
git commit -m "chore(release): bump @ngaf/chat to 0.0.3"
```

---

## Phase 8 — example-layouts rewrite

### Task 27: Rewrite `example-chat-layout` (no Tailwind)

**Files:**
- Modify: `libs/example-layouts/src/lib/example-chat-layout.component.ts`

- [ ] **Step 1: Replace component**

```ts
// libs/example-layouts/src/lib/example-chat-layout.component.ts
// SPDX-License-Identifier: MIT
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'example-chat-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: var(--ngaf-chat-bg, #fff);
      color: var(--ngaf-chat-text, #1a1a1a);
      font-family: var(--ngaf-chat-font-family, system-ui, sans-serif);
    }
    .layout {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .layout__main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
    .layout__sidebar {
      width: 100%;
      flex-shrink: 0;
      border-top: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      overflow-y: auto;
    }
    .layout__sidebar:empty { display: none; }
    @media (min-width: 768px) {
      .layout { flex-direction: row; }
      .layout--sidebar-left { flex-direction: row-reverse; }
      .layout__sidebar {
        width: var(--example-layout-sidebar-width, 18rem);
        border-top: 0;
        border-left: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      }
      .layout--sidebar-left .layout__sidebar {
        border-left: 0;
        border-right: 1px solid var(--ngaf-chat-separator, #e5e5e5);
      }
    }
  `,
  template: `
    <div [class]="'layout layout--sidebar-' + sidebarPosition()" [style.--example-layout-sidebar-width]="sidebarWidth()">
      <div class="layout__main"><ng-content select="[main]" /></div>
      <aside class="layout__sidebar"><ng-content select="[sidebar]" /></aside>
    </div>
  `,
})
export class ExampleChatLayoutComponent {
  readonly sidebarPosition = input<'left' | 'right'>('right');
  readonly sidebarWidth = input('18rem');
}
```

- [ ] **Step 2: Update spec** — assertion should check `.layout__sidebar:empty` collapse, sidebar position class, projected content; remove any Tailwind class assertions.

- [ ] **Step 3: Run, commit**

```bash
git add libs/example-layouts/src/lib/example-chat-layout.component.ts
git commit -m "refactor(example-layouts): rewrite example-chat-layout without Tailwind"
```

---

### Task 28: Rewrite `example-split-layout` (no Tailwind)

**Files:**
- Modify: `libs/example-layouts/src/lib/example-split-layout.component.ts`

- [ ] **Step 1: Read current component** to capture inputs/outputs.

- [ ] **Step 2: Rewrite** — replace Tailwind classes with hand-written CSS using `--ngaf-chat-*` token fallbacks (same pattern as chat-layout). Two named slots remain. Run spec, commit.

```bash
git add libs/example-layouts/src/lib/example-split-layout.component.ts
git commit -m "refactor(example-layouts): rewrite example-split-layout without Tailwind"
```

---

## Phase 9 — Cockpit demo updates

### Task 29: Map all chat-touching demo files

- [ ] **Step 1: Capture file list**

Run:
```bash
grep -rln "@ngaf/chat\|<chat\|chat-messages\|CHAT_THEME_STYLES\|CHAT_MARKDOWN_STYLES\|chat-input\|chat-thread-list" cockpit/chat cockpit/langgraph 2>/dev/null
```

Save the output list to `/tmp/demo-file-list.txt` (used as a checklist for subsequent tasks).

- [ ] **Step 2: For each file, identify what to change.** Most demos will need:
  - `<chat-messages>` → `<chat-message-list>` (selector + class import rename).
  - Drop `provideFakeAgUiAgent`-style Tailwind wrapper classes from local templates.
  - Drop any direct imports of `CHAT_THEME_STYLES` / `CHAT_MARKDOWN_STYLES` from `@ngaf/chat`.
  - Update consuming components' `styles` arrays to use `--ngaf-chat-*` tokens directly (no Tailwind utility classes).

### Task 30: Update `cockpit/chat/messages/angular`

**Files:**
- Modify: `cockpit/chat/messages/angular/src/app/app.ts`
- Modify: `cockpit/chat/messages/angular/src/app/app.html` (if used)

- [ ] **Step 1: Read `app.ts`**, replace `<chat-messages>` with `<chat-message-list>` and update import. Drop any local Tailwind classes.

- [ ] **Step 2: Run demo build**

Run: `npx nx build cockpit-chat-messages-angular --configuration=development 2>&1 | tail -10`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/messages
git commit -m "chore(cockpit): update chat/messages demo for chat 0.0.3"
```

### Task 31-47: Update remaining 18 demos

For each of the demos below, repeat the pattern from Task 30 (read, update imports/templates, build to verify, commit). Each is its own task with these steps:

- [ ] **Task 31:** `cockpit/chat/input/angular`
- [ ] **Task 32:** `cockpit/chat/threads/angular`
- [ ] **Task 33:** `cockpit/chat/tool-calls/angular`
- [ ] **Task 34:** `cockpit/chat/subagents/angular`
- [ ] **Task 35:** `cockpit/chat/timeline/angular`
- [ ] **Task 36:** `cockpit/chat/interrupts/angular`
- [ ] **Task 37:** `cockpit/chat/theming/angular` — special: this demo specifically tests theming. Add an example showing CSS-custom-property override at app level: `chat { --ngaf-chat-primary: oklch(0.55 0.22 264); }`.
- [ ] **Task 38:** `cockpit/chat/debug/angular`
- [ ] **Task 39:** `cockpit/chat/generative-ui/angular`
- [ ] **Task 40:** `cockpit/chat/a2ui/angular`
- [ ] **Task 41:** `cockpit/langgraph/streaming/angular`
- [ ] **Task 42:** `cockpit/langgraph/persistence/angular`
- [ ] **Task 43:** `cockpit/langgraph/memory/angular`
- [ ] **Task 44:** `cockpit/langgraph/interrupts/angular`
- [ ] **Task 45:** `cockpit/langgraph/durable-execution/angular`
- [ ] **Task 46:** `cockpit/langgraph/time-travel/angular`
- [ ] **Task 47:** `cockpit/langgraph/subgraphs/angular`
- [ ] **Task 48:** `cockpit/langgraph/deployment-runtime/angular`

**For each task above, the steps are:**
- [ ] Read `app.ts` (and `app.html` if used) and any feature components.
- [ ] Apply renames: `<chat-messages>` → `<chat-message-list>`; `ChatMessagesComponent` → `ChatMessageListComponent`.
- [ ] Drop direct imports of `CHAT_THEME_STYLES` / `CHAT_MARKDOWN_STYLES` if present; remove any consumer-side `styles: [CHAT_THEME_STYLES]` reference (the chat library now ships its own styles).
- [ ] Replace any Tailwind utility classes wrapping `<chat>` with hand-written CSS using the new tokens.
- [ ] Run: `npx nx build <project-name> --configuration=development 2>&1 | tail -10` to verify.
- [ ] Commit: `git commit -m "chore(cockpit): update <demo-path> for chat 0.0.3"`.

### Task 49: Update cockpit footprint + matrix specs

**Files:**
- Modify: `cockpit/chat/footprint.spec.ts`
- Modify: `cockpit/chat/matrix.spec.ts`

- [ ] **Step 1: Read both specs.** They likely assert package surface and demo presence.

- [ ] **Step 2: Update assertions** — add `ChatPopupComponent`, `ChatSidebarComponent`, `ChatTraceComponent`, `ChatWindowComponent`, `ChatLauncherButtonComponent`, `ChatSuggestionsComponent`, `ChatMessageComponent` to the expected exports list. Rename `ChatMessagesComponent` → `ChatMessageListComponent`. Drop `CHAT_THEME_STYLES` / `CHAT_MARKDOWN_STYLES`.

- [ ] **Step 3: Run**

Run: `npx nx test cockpit-chat -- --run footprint matrix 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/footprint.spec.ts cockpit/chat/matrix.spec.ts
git commit -m "test(cockpit): update chat footprint + matrix for 0.0.3 surface"
```

---

## Phase 10 — Website docs

### Task 50: Revert PR #157 Tailwind docs and rewrite installation/quickstart

**Files:**
- Modify: `apps/website/content/docs/chat/getting-started/installation.mdx`
- Modify: `apps/website/content/docs/chat/getting-started/quickstart.mdx`

- [ ] **Step 1: Rewrite installation.mdx**

```mdx
# Installation

Detailed setup guide for `@ngaf/chat`.

## Requirements

<Steps>
<Step title="Angular 20+">
`@ngaf/chat` uses Angular Signals, the `input()` function, and `contentChildren()`. Angular 20 or later is required.
</Step>
<Step title="Node.js 18+">
Required for the build toolchain and package installation.
</Step>
</Steps>

## Install the package

```bash
npm install @ngaf/chat
```

That's it. The chat components ship with their own design tokens and component-encapsulated styles. No PostCSS config, no global stylesheet import, no Tailwind required.

## Peer Dependencies

`@ngaf/chat` declares the following peer dependencies:

| Package | Version | Required |
|---------|---------|----------|
| `@angular/core` | `^20.0.0 \|\| ^21.0.0` | Yes |
| `@angular/common` | `^20.0.0 \|\| ^21.0.0` | Yes |
| `@angular/forms` | `^20.0.0 \|\| ^21.0.0` | Yes |
| `@ngaf/render` | `^0.0.1` | Yes |
| `@ngaf/a2ui` | `^0.0.1` | Yes |
| `@ngaf/partial-json` | `^0.0.1` | Yes |
| `@json-render/core` | `^0.16.0` | Yes |
| `@langchain/core` | `^1.1.33` | Yes |
| `marked` | `^15.0.0 \|\| ^16.0.0` | Optional |

## Configure provideChat()

Add `provideChat()` alongside your agent provider. This registers `CHAT_CONFIG` for global chat configuration (assistant name, avatar label, render registry).

```ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@ngaf/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideChat({ assistantName: 'Assistant' }),
  ],
};
```

`provideChat()` is optional — the chat components fall back to sensible defaults.

## Theming

The chat ships with a complete light/dark token system. Three ways to customize:

### 1. Override a single token

```css
/* src/styles.css */
:root {
  --ngaf-chat-primary: oklch(0.55 0.22 264);
}
```

### 2. Force a theme

```html
<chat data-ngaf-chat-theme="dark" [agent]="agent" />
```

### 3. Deep override via the optional global stylesheet

```css
/* src/styles.css */
@import '@ngaf/chat/chat.css';

:root { --ngaf-chat-primary: oklch(0.55 0.22 264); }
```

See [Theming](/docs/chat/guides/theming) for the full token reference.
```

- [ ] **Step 2: Rewrite quickstart.mdx** — replace existing content with the install step + provider step + minimal usage step. No Tailwind step.

```mdx
# Quick Start

Build a streaming chat UI with `@ngaf/chat` in 5 minutes.

<Callout type="info" title="Prerequisites">
Angular 20+ project with an agent provider configured. See [Agent Installation](/docs/agent/getting-started/installation) if you need help.
</Callout>

<Steps>
<Step title="Install the package">

```bash
npm install @ngaf/chat
```

</Step>
<Step title="Configure providers">

```ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@ngaf/langgraph';
import { provideChat } from '@ngaf/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024' }),
    provideChat({ assistantName: 'Assistant' }),
  ],
};
```

</Step>
<Step title="Render the chat">

```ts
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { agent } from '@ngaf/langgraph';
import { ChatComponent } from '@ngaf/chat';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div style="height: 100vh"><chat [agent]="chatAgent" /></div>`,
})
export class ChatPageComponent {
  protected readonly chatAgent = agent({
    assistantId: 'chat_agent',
    threadId: signal(null),
  });
}
```

</Step>
</Steps>

That's it — no Tailwind setup, no PostCSS config, no global stylesheet import. The chat ships with its own design tokens and component-scoped styles.

## What's Next

- [Layout Modes](/docs/chat/guides/layout-modes) — embedded, popup, or sidebar?
- [Theming](/docs/chat/guides/theming) — customize colors, fonts, and shapes.
- [Components](/docs/chat/components) — full primitive and composition reference.
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/getting-started/installation.mdx apps/website/content/docs/chat/getting-started/quickstart.mdx
git commit -m "docs(chat): rewrite install + quickstart for 0.0.3 (no Tailwind)"
```

---

### Task 51: Rewrite `guides/theming.mdx`

**Files:**
- Modify: `apps/website/content/docs/chat/guides/theming.mdx`

- [ ] **Step 1: Read existing file** to gauge what stays.

- [ ] **Step 2: Rewrite** with the full `--ngaf-chat-*` token reference table, light/dark explanation, three override paths (per-token at `:root`, attribute, optional global stylesheet), examples.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/guides/theming.mdx
git commit -m "docs(chat): rewrite theming guide for new token surface"
```

---

### Task 52: Add new component reference pages

**Files:**
- Create: `apps/website/content/docs/chat/components/chat-popup.mdx`
- Create: `apps/website/content/docs/chat/components/chat-sidebar.mdx`
- Create: `apps/website/content/docs/chat/components/chat-trace.mdx`
- Create: `apps/website/content/docs/chat/guides/layout-modes.mdx`

For each:

- [ ] **Step 1: Match the existing reference page format** — read any existing `apps/website/content/docs/chat/components/*.mdx` to crib the frontmatter + section structure (Inputs / Outputs / Slots / Examples).

- [ ] **Step 2: Write the page** with:
  - One-line summary.
  - Inputs table (name / type / default / description).
  - Outputs table.
  - Content-projection slots table.
  - Minimal example.
  - "When to use" pointer to the Layout Modes guide.

- [ ] **Step 3: Update `apps/website/content/docs/chat/components/_meta.json`** (or whatever the docs index file is named — match repo convention) to surface the new pages in the sidebar.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat/components/chat-popup.mdx \
        apps/website/content/docs/chat/components/chat-sidebar.mdx \
        apps/website/content/docs/chat/components/chat-trace.mdx \
        apps/website/content/docs/chat/guides/layout-modes.mdx \
        apps/website/content/docs/chat/components/_meta.json
git commit -m "docs(chat): add reference pages for chat-popup, chat-sidebar, chat-trace + layout-modes guide"
```

---

### Task 53: Update existing component reference pages for renames

**Files:**
- Modify: `apps/website/content/docs/chat/components/*.mdx` (all existing pages)

- [ ] **Step 1: Search**

Run: `grep -ln "chat-messages\|ChatMessagesComponent\|CHAT_THEME_STYLES\|CHAT_MARKDOWN_STYLES" apps/website/content/docs/chat`

- [ ] **Step 2: For each match, replace** old names with new ones; remove any `CHAT_THEME_STYLES`/`CHAT_MARKDOWN_STYLES` references; add note about removed avatar slot.

- [ ] **Step 3: Build website to verify MDX still parses**

Run: `npx nx build website 2>&1 | tail -20`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat
git commit -m "docs(chat): update existing component pages for 0.0.3 renames"
```

---

## Phase 11 — Verification

### Task 54: Full test + build sweep

- [ ] **Step 1: Build the chat library**

Run: `npx nx build chat 2>&1 | tail -10`
Expected: succeeds, `dist/libs/chat/chat.css` present.

- [ ] **Step 2: Run all chat tests**

Run: `npx nx test chat 2>&1 | tail -30`
Expected: all PASS.

- [ ] **Step 3: Run all example-layouts tests**

Run: `npx nx test example-layouts 2>&1 | tail -10`
Expected: all PASS.

- [ ] **Step 4: Build all cockpit demos**

Run: `npx nx run-many -t build -p $(grep -lE "@ngaf/chat" cockpit/chat/*/angular/package.json cockpit/langgraph/*/angular/package.json | xargs -I{} dirname {} | xargs -I{} basename {} | tr '\n' ',' | sed 's/,$//') --configuration=development 2>&1 | tail -30`
Expected: all build.

- [ ] **Step 5: Run cockpit chat footprint + matrix tests**

Run: `npx nx test cockpit-chat 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Run conformance tests against the published surface**

Run: `npx nx test chat -- --run conformance 2>&1 | tail -10`
Expected: PASS.

If anything fails, fix in place (do not skip), commit fix per failure with descriptive message, then continue.

---

### Task 55: Manual smoke test against the smoke app

**Files:**
- (External) `~/tmp/ngaf/`

- [ ] **Step 1: Build chat lib**

Run: `npx nx build chat 2>&1 | tail -5`

- [ ] **Step 2: Pack and install into smoke app**

```bash
cd dist/libs/chat && npm pack && cd -
cd ~/tmp/ngaf && npm install /Users/blove/repos/angular-agent-framework/dist/libs/chat/ngaf-chat-0.0.3.tgz
```

- [ ] **Step 3: Remove Tailwind setup from smoke app (it's no longer needed)**

```bash
cd ~/tmp/ngaf
npm uninstall tailwindcss @tailwindcss/postcss
rm -f .postcssrc.json
cat > src/styles.css <<EOF
/* You can add global styles to this file, and also import other style files */
EOF
```

- [ ] **Step 4: Start dev server**

(Use preview_start with the existing "smoke" launch entry.)

- [ ] **Step 5: Take screenshots and verify** — empty state shows centered "How can I help?" empty card; user message renders as a dark right-aligned bubble; assistant streaming reply renders as bare inline text with blinking caret; tool-call traces appear above any markdown body when triggered; theme switches when you set `data-ngaf-chat-theme="dark"` on host.

- [ ] **Step 6: Document outcome** — if the smoke app renders correctly, no further action; if anything looks off, file as a follow-up before opening the PR.

---

### Task 56: Final release notes + PR

**Files:**
- Create: `CHANGELOG.md` entry or follow repo convention (check `git log` for recent release-commit format).

- [ ] **Step 1: Read recent release commits**

Run: `git log --oneline -20 | grep -i "release\|chore.*publish"`
Then read those commits' message bodies to match the project's release-note style.

- [ ] **Step 2: Write release notes** matching the project's convention. Cover:
  - New: `<chat-popup>`, `<chat-sidebar>`, `<chat-trace>`, `<chat-window>`, `<chat-launcher-button>`, `<chat-suggestions>`, `<chat-message>`.
  - Renamed: `<chat-messages>` → `<chat-message-list>`.
  - Removed: `CHAT_THEME_STYLES`, `CHAT_MARKDOWN_STYLES`, `chat-timeline-slider` horizontal-slider variant, all Tailwind utility-class usage.
  - Migration: drop Tailwind setup; override `--ngaf-chat-*` tokens or import `@ngaf/chat/chat.css`.

- [ ] **Step 3: Open PR**

```bash
git push -u origin claude/dazzling-dewdney-887eac
gh pr create --title "feat(chat): production-ready visual redesign (0.0.3)" --body "$(cat <<'EOF'
## Summary

Coordinated rewrite of @ngaf/chat for production-grade visual quality. Three new layout modes (embedded/popup/sidebar), asymmetric message pattern (user bubble + assistant inline), shared chat-trace primitive driving tool calls/subagents/timeline, complete Tailwind removal in favor of component-encapsulated styles + optional @ngaf/chat/chat.css.

Closes the v0.0.2 publish friction (PR #157): consumers no longer need any Tailwind setup. `npm install @ngaf/chat` + drop `<chat>` in a template = working chat.

## Changes

- New: `<chat>` rewritten, `<chat-popup>`, `<chat-sidebar>`, `<chat-trace>`, `<chat-window>`, `<chat-launcher-button>`, `<chat-suggestions>`, `<chat-message>`.
- Restyled: `<chat-input>` (pill design), `<chat-typing-indicator>` (3-dot), `<chat-error>`, `<chat-interrupt>`, `<chat-thread-list>`, `<chat-tool-call-card>`, `<chat-subagent-card>`, `<chat-timeline-slider>` (vertical), `<chat-interrupt-panel>`, `<chat-debug>` + helpers, `<chat-generative-ui>`.
- Renamed: `<chat-messages>` → `<chat-message-list>` (`ChatMessagesComponent` → `ChatMessageListComponent`).
- Removed: `CHAT_THEME_STYLES`, `CHAT_MARKDOWN_STYLES`, horizontal-slider timeline variant, all Tailwind utility classes.
- Updated: 19 cockpit demos, libs/example-layouts, website docs.
- Reverts the docs added in #157 (Tailwind setup is no longer required).

## Migration

```css
/* Before (0.0.2) — required */
@import "tailwindcss";
@source "../node_modules/@ngaf/chat";

/* After (0.0.3) — optional */
@import '@ngaf/chat/chat.css';  /* only if you want global token / class overrides */
```

Spec: docs/superpowers/specs/2026-05-01-chat-redesign-design.md
Plan: docs/superpowers/plans/2026-05-01-chat-redesign.md

## Test plan

- [x] All chat unit + conformance tests pass.
- [x] All cockpit chat + langgraph demos build cleanly.
- [x] Cockpit footprint + matrix specs assert new exports.
- [x] Smoke app renders correctly with no Tailwind setup.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm PR URL** is returned and reachable.

---

## Verification Checklist (run mentally before claiming done)

- [ ] Every task in this plan checked off.
- [ ] No `CHAT_THEME_STYLES` / `CHAT_MARKDOWN_STYLES` references in libs/chat or apps or cockpit.
- [ ] No Tailwind utility classes in `libs/chat/src/lib/**`.
- [ ] No Tailwind utility classes in `libs/example-layouts/src/lib/**`.
- [ ] Every chat component imports `CHAT_HOST_TOKENS` in its styles array.
- [ ] `<chat-messages>` selector returns 0 results in `grep -r '<chat-messages\b'`.
- [ ] `dist/libs/chat/chat.css` ships in build output.
- [ ] `@ngaf/chat` package.json version is `0.0.3`.
- [ ] All 19 cockpit demos build cleanly.
- [ ] All chat tests pass.
- [ ] PR opened, URL captured.
