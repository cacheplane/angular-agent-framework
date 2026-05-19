# Mobile Sidenav Scrim + Responsive Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the chat-sidenav drawer scrim into its own primitive (so it escapes the host's stacking context and stops intercepting drawer interaction), add a right-edge drawer shadow, move the demo's hamburger into the toolbar's flex row, and promote z-index hardcodes to documented CSS variables.

**Architecture:** New `<chat-sidenav-scrim>` primitive in `@ngaf/chat` is rendered as a sibling of `<chat-sidenav>` by the consumer (demo wires it). `chat-sidenav` stops rendering its internal scrim. Three z-index layer tokens land in chat-tokens.ts and replace the hardcodes across the lib.

**Tech Stack:** Angular 20+ standalone components, vitest, TypeScript-template-literal CSS, no new dependencies (no CDK).

**Branch:** `claude/mobile-sidenav-scrim` (off `origin/main`; spec committed at `8177da3d`).

**Spec:** `docs/superpowers/specs/2026-05-19-mobile-sidenav-scrim-design.md`

---

## File map

| File | Change |
|---|---|
| `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts` | **Create** — new component |
| `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts` | **Create** — unit tests |
| `libs/chat/src/public-api.ts` | Add export |
| `libs/chat/src/lib/styles/chat-tokens.ts` | Add `LAYER_TOKENS` block with 3 z-index vars; concat into `CHAT_HOST_TOKENS` |
| `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` | Drop the scrim template block |
| `libs/chat/src/lib/styles/chat-sidenav.styles.ts` | Drop `.chat-sidenav__scrim` rule; add drawer box-shadow; use z-index token |
| `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts` | Update — no scrim assertion; new layer-token + shadow assertion |
| `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts` | Replace `z-index: 30` with `var(--ngaf-chat-z-overlay-content, 30)` (2 places) |
| `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts` | Replace `z-index: 30` with the same var |
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | Import `ChatSidenavScrimComponent` |
| `examples/chat/angular/src/app/shell/demo-shell.component.html` | Render `<chat-sidenav-scrim>` sibling; move hamburger INTO `.demo-shell__toolbar` |
| `examples/chat/angular/src/app/shell/demo-shell.component.css` | Replace fixed-position hamburger styles with flex-child styles |
| `libs/{a2ui,ag-ui,chat,langgraph,licensing,render,telemetry}/package.json` | 0.0.43 → 0.0.44 |

---

## Task 1: Add `LAYER_TOKENS` z-index CSS variables in chat-tokens.ts

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`

- [ ] **Step 1: Add a new LAYER_TOKENS block**

In `libs/chat/src/lib/styles/chat-tokens.ts`, find the existing `SPACING_TOKENS` constant (around line 108). Add a new constant immediately after it, BEFORE `EDGE_CLAIM_TOKENS`:

```ts
const LAYER_TOKENS = `
  /* Z-index layers — documented for consumers + future primitives.
   * Default values listed; overridable per-app via :root or :host. */
  --ngaf-chat-z-overlay-content: 30;   /* chat-sidebar panel, chat-popup window */
  --ngaf-chat-z-drawer-scrim: 1000;    /* chat-sidenav-scrim backdrop */
  --ngaf-chat-z-drawer: 1001;          /* chat-sidenav drawer mode host */
`;
```

- [ ] **Step 2: Include LAYER_TOKENS in `ROOT_TOKEN_STYLES`**

In the same file, find the `ROOT_TOKEN_STYLES` export (around line 319). The current `:root` block concatenates color/geometry/typography/spacing/edge-claim tokens:

```ts
export const ROOT_TOKEN_STYLES = `
  ...
  :root {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    ${EDGE_CLAIM_TOKENS}
  }
```

Add `${LAYER_TOKENS}` to that same `:root` block, placed alphabetically/logically between `${SPACING_TOKENS}` and `${EDGE_CLAIM_TOKENS}`:

```ts
  :root {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    ${LAYER_TOKENS}
    ${EDGE_CLAIM_TOKENS}
  }
```

- [ ] **Step 3: Run the chat lib tests**

Run: `pnpm nx test chat`
Expected: green (no behavior change yet).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts
git commit -m "feat(chat): add z-index layer tokens (overlay-content, drawer-scrim, drawer)"
```

---

## Task 2: Create the `chat-sidenav-scrim` primitive

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts`
- Create: `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts`

- [ ] **Step 1: Write the failing tests first**

Create `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSidenavScrimComponent } from './chat-sidenav-scrim.component';

describe('ChatSidenavScrimComponent', () => {
  let fx: ComponentFixture<ChatSidenavScrimComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChatSidenavScrimComponent] });
    fx = TestBed.createComponent(ChatSidenavScrimComponent);
  });

  it('renders nothing when [open] is false (default)', () => {
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the scrim button when [open] is true', () => {
    fx.componentRef.setInput('open', true);
    fx.detectChanges();
    const btn = fx.nativeElement.querySelector('button.chat-sidenav-scrim__button') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Close conversations');
  });

  it('emits (close) on click', () => {
    fx.componentRef.setInput('open', true);
    fx.detectChanges();
    let closed = false;
    fx.componentInstance.close.subscribe(() => { closed = true; });
    const btn = fx.nativeElement.querySelector('button.chat-sidenav-scrim__button') as HTMLButtonElement;
    btn.click();
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create the component**

Create `libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts`:

```ts
// libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Backdrop scrim for chat-sidenav's drawer mode, rendered as a sibling of
 * <chat-sidenav> so its z-index sits cleanly between the page content
 * and the drawer host (escapes the drawer host's stacking context).
 *
 * Usage:
 *   <chat-sidenav-scrim [open]="drawerOpen()" (close)="drawerOpen.set(false)" />
 *   <chat-sidenav [(open)]="drawerOpen" ...></chat-sidenav>
 */
@Component({
  selector: 'chat-sidenav-scrim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <button
        type="button"
        class="chat-sidenav-scrim__button"
        aria-label="Close conversations"
        (click)="close.emit()"
      ></button>
    }
  `,
  styles: [
    `
      :host { display: contents; }
      .chat-sidenav-scrim__button {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: var(--ngaf-chat-z-drawer-scrim, 1000);
        border: 0;
        padding: 0;
        cursor: pointer;
      }
    `,
  ],
})
export class ChatSidenavScrimComponent {
  /** When true, render the backdrop button covering the viewport. */
  readonly open = input<boolean>(false);
  /** Fires when the user clicks the backdrop. */
  readonly close = output<void>();
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.ts libs/chat/src/lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component.spec.ts
git commit -m "feat(chat): add chat-sidenav-scrim primitive"
```

---

## Task 3: Export the new primitive from the public API

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add the export**

In `libs/chat/src/public-api.ts`, find the existing exports for other chat-sidenav-related symbols (e.g. `ChatSidenavComponent`). Add a sibling export:

```ts
export { ChatSidenavScrimComponent } from './lib/primitives/chat-sidenav-scrim/chat-sidenav-scrim.component';
```

Place it alphabetically near `ChatSidenavComponent`.

- [ ] **Step 2: Run tests**

Run: `pnpm nx test chat`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export ChatSidenavScrimComponent from public API"
```

---

## Task 4: Drop the internal scrim from `chat-sidenav` + add drawer shadow + use z-index token

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`

- [ ] **Step 1: Write the failing spec assertions**

In `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`, find any existing test that asserts the `.chat-sidenav__scrim` element renders (search for `chat-sidenav__scrim`). REPLACE that test with one that asserts the scrim is GONE:

```ts
it('does NOT render an internal .chat-sidenav__scrim — scrim is owned by chat-sidenav-scrim primitive', () => {
  const fx = TestBed.createComponent(ChatSidenavComponent);
  fx.componentRef.setInput('mode', 'drawer');
  fx.componentRef.setInput('open', true);
  fx.detectChanges();
  expect(fx.nativeElement.querySelector('.chat-sidenav__scrim')).toBeNull();
});
```

Add a styles-string assertion to the spec (or to `chat-sidenav.styles.spec.ts` if that file exists in the project). Pattern from prior PRs:

```ts
import { CHAT_SIDENAV_STYLES } from '../../styles/chat-sidenav.styles';

describe('CHAT_SIDENAV_STYLES — drawer elevation + z-index token', () => {
  const normalized = CHAT_SIDENAV_STYLES.replace(/\s+/g, ' ');
  it('uses the --ngaf-chat-z-drawer token for the drawer host z-index', () => {
    expect(normalized).toMatch(
      /:host\(\[data-mode="drawer"\]\)\s*\{[^}]*z-index:\s*var\(--ngaf-chat-z-drawer,\s*1001\)\s*;/,
    );
  });
  it('applies a right-edge box-shadow when the drawer is open', () => {
    expect(normalized).toMatch(
      /:host\(\[data-mode="drawer"\]\[data-open="true"\]\)\s*\{[^}]*box-shadow:\s*8px\s+0\s+32px\s+rgba\(0,\s*0,\s*0,\s*0\.18\)\s*;/,
    );
  });
  it('no longer declares the .chat-sidenav__scrim selector', () => {
    expect(normalized).not.toMatch(/\.chat-sidenav__scrim\s*\{/);
  });
});
```

(If `chat-sidenav.styles.spec.ts` doesn't exist, create it with the imports above + this describe block.)

- [ ] **Step 2: Run specs to see the failures**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`
Expected: FAIL on the "no internal scrim" test.

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts` (if you created it)
Expected: FAIL on the three new assertions.

- [ ] **Step 3: Update the chat-sidenav template — drop the scrim**

In `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`, find the template block (around line 60). Locate:

```html
@if (mode() === 'drawer' && open()) {
<button
  type="button"
  class="chat-sidenav__scrim"
  aria-label="Close conversations"
  (click)="openChange.emit(false)"
></button>
}
<nav
  class="chat-sidenav"
  ...
```

Delete the entire `@if` block + button. The template now starts with the `<nav>` element.

- [ ] **Step 4: Update chat-sidenav.styles.ts — drop scrim, add shadow, use z-index token**

In `libs/chat/src/lib/styles/chat-sidenav.styles.ts`:

a. Find the existing drawer host rule and replace its `z-index: 1001` line with the token reference. Old:
```css
:host([data-mode="drawer"]) {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--ngaf-chat-sidenav-width-drawer);
  z-index: 1001;
}
```
New:
```css
:host([data-mode="drawer"]) {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--ngaf-chat-sidenav-width-drawer);
  z-index: var(--ngaf-chat-z-drawer, 1001);
}
:host([data-mode="drawer"][data-open="true"]) {
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.18);
}
```

b. Delete the entire `.chat-sidenav__scrim` rule block. It's the block defining `position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1000; border: 0; padding: 0; cursor: pointer;`. Remove all of it.

- [ ] **Step 5: Run tests — all PASS**

Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`
Run: `pnpm nx test chat -- --runTestsByPath libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts`
Expected: all PASS.

- [ ] **Step 6: Run the full chat lib suite**

Run: `pnpm nx test chat`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts libs/chat/src/lib/styles/chat-sidenav.styles.ts libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts libs/chat/src/lib/styles/chat-sidenav.styles.spec.ts
git commit -m "feat(chat): chat-sidenav drops internal scrim, adds drawer shadow + z-index token"
```

---

## Task 5: Use the new layer token in chat-sidebar + chat-popup

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts`

- [ ] **Step 1: Replace z-index 30 in chat-sidebar.component.ts**

The file has two `z-index: 30` occurrences (lines ~45 and ~88 — one on the panel rule, one on the launcher rule). Replace both with `z-index: var(--ngaf-chat-z-overlay-content, 30);`.

Example before/after for the panel rule:
```css
.chat-sidebar__panel {
  position: fixed;
  ...
  z-index: 30;
}
```
becomes:
```css
.chat-sidebar__panel {
  position: fixed;
  ...
  z-index: var(--ngaf-chat-z-overlay-content, 30);
}
```

Same change for the launcher rule.

- [ ] **Step 2: Replace z-index 30 in chat-popup.component.ts**

The file has one occurrence at line 17 — the host `:host` rule. Replace:
```css
:host { position: fixed; bottom: 1rem; right: 1rem; z-index: 30; }
```
with:
```css
:host { position: fixed; bottom: 1rem; right: 1rem; z-index: var(--ngaf-chat-z-overlay-content, 30); }
```

- [ ] **Step 3: Run tests**

Run: `pnpm nx test chat`
Expected: green (token has a fallback so behavior is unchanged).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts libs/chat/src/lib/compositions/chat-popup/chat-popup.component.ts
git commit -m "feat(chat): use --ngaf-chat-z-overlay-content token for sidebar + popup z-index"
```

---

## Task 6: Wire the scrim + move the hamburger in the demo

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.html`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.css`

- [ ] **Step 1: Import ChatSidenavScrimComponent in demo-shell.component.ts**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`, find the `@ngaf/chat` import block (it currently includes `ChatSidenavComponent`, etc.). Add `ChatSidenavScrimComponent` to the named imports:

```ts
import {
  ChatInterruptPanelComponent,
  ChatSubagentsComponent,
  ChatSidenavComponent,
  ChatSidenavScrimComponent,
  ChatHistorySearchPaletteComponent,
  ChatSelectComponent,
  type ChatSidenavMode,
  ...
} from '@ngaf/chat';
```

Then add `ChatSidenavScrimComponent` to the component's `imports: [...]` array.

- [ ] **Step 2: Update demo-shell.component.html — add the scrim sibling**

Find the existing `<chat-sidenav>` element. Immediately ABOVE it, insert:

```html
<chat-sidenav-scrim
  [open]="sidenavMode() === 'drawer' && drawerOpen()"
  (close)="drawerOpen.set(false)"
/>
```

- [ ] **Step 3: Move the hamburger inside the toolbar**

In the same file, find:

```html
@if (sidenavMode() === 'drawer' && !drawerOpen()) {
  <button
    type="button"
    class="demo-shell__hamburger"
    aria-label="Open conversations"
    [attr.aria-expanded]="drawerOpen()"
    (click)="toggleSidenav()"
  >☰</button>
}
```

DELETE that block from its current location (it's a top-level child of `.demo-shell`).

Then find the `<div class="demo-shell__toolbar" role="toolbar" ...>` opening tag. Immediately AFTER the opening tag (i.e. as the FIRST child of the toolbar), paste the hamburger block:

```html
<div class="demo-shell__toolbar" role="toolbar" aria-label="Demo controls">
  @if (sidenavMode() === 'drawer' && !drawerOpen()) {
    <button
      type="button"
      class="demo-shell__hamburger"
      aria-label="Open conversations"
      [attr.aria-expanded]="drawerOpen()"
      (click)="toggleSidenav()"
    >☰</button>
  }
  <div class="demo-shell__segmented" aria-label="Mode">...</div>
  ...
</div>
```

- [ ] **Step 4: Update demo-shell.component.css — hamburger as flex child**

Find the existing `.demo-shell__hamburger` block in `demo-shell.component.css` (around line 16-38). The rule currently uses fixed positioning:

```css
.demo-shell__hamburger {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1100;
  width: 36px;
  height: 36px;
  border: 1px solid #303540;
  background: #1a1d23;
  color: #e6e9ef;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}
.demo-shell__hamburger:hover { background: #232730; }

@media (max-width: 767px) {
  .demo-shell__hamburger { width: 44px; height: 44px; }
}
```

Replace the entire `.demo-shell__hamburger` block (and its hover + media query) with:

```css
.demo-shell__hamburger {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--ngaf-chat-text);
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.demo-shell__hamburger:hover {
  background: var(--ngaf-chat-surface-alt);
}
```

(Drops `position: fixed`, `top/left/z-index`, hardcoded colors + box-shadow, and the mobile-bump-to-44 media query — flex-child sizing is consistent across viewports now.)

- [ ] **Step 5: Run the demo test suite**

Run: `pnpm nx test examples-chat-angular`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts examples/chat/angular/src/app/shell/demo-shell.component.html examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(demo): wire chat-sidenav-scrim + move hamburger into toolbar"
```

---

## Task 7: Bump publishable libs to 0.0.44

**Files:**
- Modify: `libs/{a2ui,ag-ui,chat,langgraph,licensing,render,telemetry}/package.json`

- [ ] **Step 1: Bump all 7 publishable libs**

Edit each of `libs/a2ui/package.json`, `libs/ag-ui/package.json`, `libs/chat/package.json`, `libs/langgraph/package.json`, `libs/licensing/package.json`, `libs/render/package.json`, `libs/telemetry/package.json` — change `"version": "0.0.43"` → `"version": "0.0.44"`.

- [ ] **Step 2: Verify uniform versions**

Run: `grep '"version"' libs/a2ui/package.json libs/ag-ui/package.json libs/chat/package.json libs/langgraph/package.json libs/licensing/package.json libs/render/package.json libs/telemetry/package.json`
Expected: all 7 read `"version": "0.0.44"`.

- [ ] **Step 3: Run the chat lib + demo suites**

Run: `pnpm nx test chat`
Run: `pnpm nx test examples-chat-angular`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add libs/a2ui/package.json libs/ag-ui/package.json libs/chat/package.json libs/langgraph/package.json libs/licensing/package.json libs/render/package.json libs/telemetry/package.json
git commit -m "chore(release): bump publishable libs to 0.0.44"
```
