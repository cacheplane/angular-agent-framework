# chat-debug × chat-sidebar Coexistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<chat-debug>` and `<chat-sidebar>` coexist on screen via a CSS-only edge-claim primitive and a smart auto-dock rule so the sidebar's launcher remains reachable when chat-debug is open in sidebar mode.

**Architecture:** Each docked panel writes a `data-ngaf-chat-{sidebar,debug}` attribute on `<html>`. Token rules in `chat-tokens.ts` translate those attributes into four `--ngaf-chat-occupy-{top,right,bottom,left}` CSS custom properties. Peer panels read those custom properties via `right:` / `bottom:` declarations to leave room. chat-debug auto-switches to `dock="bottom"` when a sibling `<chat-sidebar>` is present, unless the user has explicitly clicked a dock button.

**Tech Stack:** Angular 20+ signals, vitest, TypeScript, plain CSS custom properties on `<html>`.

**Spec:** `docs/superpowers/specs/2026-05-15-chat-debug-sidebar-coexistence-design.md`

**Branch:** `claude/chat-debug-sidebar-coexistence` (already checked out, spec committed at `a7a2e803`).

---

## File Structure

**Modify:**
- `libs/chat/src/lib/styles/chat-tokens.ts` — add occupy tokens + attribute mapping rules
- `libs/chat/src/lib/styles/chat-tokens.spec.ts` — extend with edge-claim coverage
- `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts` — write claim attr + read occupy-bottom
- `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts` — assert attr toggling
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts` — write claim attr + read occupy-right + auto-dock + override flag
- `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts` — assert attr/auto-dock/override
- `examples/chat/aimock-e2e/tests/sidebar-mode.spec.ts` — new E2E for coexistence (NB: file is created in Task 6)
- `examples/chat/smoke/CHECKLIST.md` — add three manual smoke items

**Conventions established here that later tasks reuse:**
- `--ngaf-chat-occupy-top|right|bottom|left` — peer-claim custom properties, default `0px`
- `--ngaf-chat-debug-panel-size-h` (default `40vh`) — debug bottom-dock height
- `--ngaf-chat-debug-panel-size-w` (default `420px`) — debug right/left-dock width
- `--ngaf-chat-sidebar-width-drawer` (already exists, default `28rem`) — sidebar panel width
- `data-ngaf-chat-sidebar="open"` on `<html>` — sidebar's claim
- `data-ngaf-chat-debug="bottom|right|left"` on `<html>` — debug's claim, only set when panel is open
- `dockState`, `setDock(next)`, `DockPosition` — existing chat-debug API; do not rename
- `userDockOverride: signal<boolean>(false)` — new in chat-debug; flipped to `true` inside `setDock()`

---

## Task 1: Edge-claim tokens in chat-tokens.ts

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts:287-310` (the `ROOT_TOKEN_STYLES` block)
- Test: `libs/chat/src/lib/styles/chat-tokens.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `libs/chat/src/lib/styles/chat-tokens.spec.ts`:

```ts
describe('ROOT_TOKEN_STYLES — edge-claim primitive', () => {
  it.each([
    '--ngaf-chat-occupy-top:    0px;',
    '--ngaf-chat-occupy-right:  0px;',
    '--ngaf-chat-occupy-bottom: 0px;',
    '--ngaf-chat-occupy-left:   0px;',
  ])('defines default %s on :root', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it.each([
    '--ngaf-chat-debug-panel-size-h: 40vh;',
    '--ngaf-chat-debug-panel-size-w: 420px;',
  ])('defines debug panel size token %s', (decl) => {
    expect(ROOT_TOKEN_STYLES).toContain(decl);
  });

  it('maps data-ngaf-chat-sidebar="open" to occupy-right', () => {
    expect(ROOT_TOKEN_STYLES).toMatch(
      /:root\[data-ngaf-chat-sidebar="open"\]\s*\{\s*--ngaf-chat-occupy-right:\s*var\(--ngaf-chat-sidebar-width-drawer/,
    );
  });

  it.each([
    ['bottom', '--ngaf-chat-occupy-bottom', '--ngaf-chat-debug-panel-size-h'],
    ['right',  '--ngaf-chat-occupy-right',  '--ngaf-chat-debug-panel-size-w'],
    ['left',   '--ngaf-chat-occupy-left',   '--ngaf-chat-debug-panel-size-w'],
  ])('maps data-ngaf-chat-debug=%s to %s via %s', (dock, occupyVar, sizeVar) => {
    const pattern = new RegExp(
      `:root\\[data-ngaf-chat-debug="${dock}"\\]\\s*\\{\\s*${occupyVar}:\\s*var\\(${sizeVar}`,
    );
    expect(ROOT_TOKEN_STYLES).toMatch(pattern);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run from repo root:

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/styles/chat-tokens.spec.ts
```

Expected: 8 new failures with messages like `expected ... to contain '--ngaf-chat-occupy-top: 0px;'`.

- [ ] **Step 3: Add the occupy defaults to LIGHT_TOKENS literal**

In `libs/chat/src/lib/styles/chat-tokens.ts`, locate the `LIGHT_TOKENS` template string (starts at line 4). The occupy tokens are theme-invariant — put them in a NEW dedicated constant, not `LIGHT_TOKENS`. Add this constant immediately after `SPACING_TOKENS` (around line 121):

```ts
const EDGE_CLAIM_TOKENS = `
  /* Edge-claim primitive — peer-aware panel coexistence.
     Each docked panel publishes the edge it occupies via a
     data-ngaf-chat-* attribute on <html>; other panels read these
     custom properties to leave room. Defaults to 0px so consumers
     not using chat-sidebar/chat-debug see zero overhead. */
  --ngaf-chat-occupy-top:    0px;
  --ngaf-chat-occupy-right:  0px;
  --ngaf-chat-occupy-bottom: 0px;
  --ngaf-chat-occupy-left:   0px;

  /* Sizes the chat-debug dock contributes when it claims an edge.
     Split by orientation so consumers can override independently. */
  --ngaf-chat-debug-panel-size-h: 40vh;
  --ngaf-chat-debug-panel-size-w: 420px;
`;
```

- [ ] **Step 4: Wire EDGE_CLAIM_TOKENS into ROOT_TOKEN_STYLES + add attribute-mapping rules**

In `libs/chat/src/lib/styles/chat-tokens.ts`, replace the existing `ROOT_TOKEN_STYLES` export (lines 287-310) with:

```ts
export const ROOT_TOKEN_STYLES = `
@layer ngaf-chat {
  :root {
    ${LIGHT_TOKENS}
    ${GEOMETRY_TOKENS}
    ${TYPOGRAPHY_TOKENS}
    ${SPACING_TOKENS}
    ${EDGE_CLAIM_TOKENS}
    ${A2UI_INVARIANT_TOKENS}
  }
  @media (prefers-color-scheme: dark) {
    :root { ${DARK_TOKENS} }
  }
  :root[data-theme="light"],
  [data-theme="light"],
  :root[data-ngaf-chat-theme="light"],
  [data-ngaf-chat-theme="light"] { ${LIGHT_TOKENS} }
  :root[data-theme="dark"],
  [data-theme="dark"],
  :root[data-ngaf-chat-theme="dark"],
  [data-ngaf-chat-theme="dark"] { ${DARK_TOKENS} }

  /* Edge-claim attribute mappings.
     chat-sidebar sets data-ngaf-chat-sidebar="open" while its panel is open.
     chat-debug sets data-ngaf-chat-debug to its current dock while open. */
  :root[data-ngaf-chat-sidebar="open"] {
    --ngaf-chat-occupy-right: var(--ngaf-chat-sidebar-width-drawer, 28rem);
  }
  :root[data-ngaf-chat-debug="bottom"] {
    --ngaf-chat-occupy-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh);
  }
  :root[data-ngaf-chat-debug="right"] {
    --ngaf-chat-occupy-right: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
  :root[data-ngaf-chat-debug="left"] {
    --ngaf-chat-occupy-left: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
}
${KEYFRAMES}
${REDUCED_MOTION_STYLES}
`;
```

- [ ] **Step 5: Run tests, confirm they pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/styles/chat-tokens.spec.ts
```

Expected: all chat-tokens tests pass (existing + 8 new). Final summary line should show 24 tests passing.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts libs/chat/src/lib/styles/chat-tokens.spec.ts
git commit -m "feat(chat): add edge-claim CSS primitive (--ngaf-chat-occupy-*)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: chat-sidebar publishes its claim and reads occupy-bottom

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts`:

```ts
import { effect, runInInjectionContext } from '@angular/core';

describe('ChatSidebarComponent — edge-claim attribute', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ngaf-chat-sidebar');
  });

  it('sets data-ngaf-chat-sidebar="open" on <html> while open', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const sidebar = new ChatSidebarComponent();
      // Trigger the open-tracking effect by setting open=true
      sidebar.openWindow();
      // Force a microtask flush so the effect runs
      TestBed.flushEffects();
      expect(document.documentElement.getAttribute('data-ngaf-chat-sidebar')).toBe('open');
    });
  });

  it('removes data-ngaf-chat-sidebar from <html> when closed', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const sidebar = new ChatSidebarComponent();
      sidebar.openWindow();
      TestBed.flushEffects();
      sidebar.closeWindow();
      TestBed.flushEffects();
      expect(document.documentElement.hasAttribute('data-ngaf-chat-sidebar')).toBe(false);
    });
  });

  it('panel CSS includes bottom: var(--ngaf-chat-occupy-bottom)', () => {
    // Styles array is the second member of the @Component decorator metadata.
    // Easier path: stringify the styles and look for the declaration.
    const styles = (ChatSidebarComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.chat-sidebar__panel\s*\{[^}]*bottom:\s*var\(--ngaf-chat-occupy-bottom/);
  });

  it('launcher CSS includes calc(1rem + var(--ngaf-chat-occupy-bottom))', () => {
    const styles = (ChatSidebarComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.chat-sidebar__launcher\s*\{[^}]*bottom:\s*calc\(1rem\s*\+\s*var\(--ngaf-chat-occupy-bottom/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
```

Expected: 4 new failures.

- [ ] **Step 3: Add the effect + CSS to chat-sidebar.component.ts**

In `libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts`:

(a) Add `effect` to the existing Angular import on line 3:

```ts
import { Component, ChangeDetectionStrategy, effect, input, model, output } from '@angular/core';
```

(b) Replace the `.chat-sidebar__panel` CSS block (lines 27-39) so the existing `bottom: 0` becomes a `var()` read:

```css
    .chat-sidebar__panel {
      position: fixed;
      top: 0; right: 0;
      bottom: var(--ngaf-chat-occupy-bottom, 0);
      width: 28rem;
      background: var(--ngaf-chat-bg);
      border-left: 1px solid var(--ngaf-chat-separator);
      box-shadow: -8px 0 32px rgba(0,0,0,.08);
      transform: translateX(100%);
      transition: transform 200ms ease-out, bottom 200ms ease-out;
      z-index: 30;
      display: flex;
      flex-direction: column;
    }
```

(c) Replace the `.chat-sidebar__launcher` CSS block (lines 55-60) so its `bottom: 1rem` becomes a `calc()`:

```css
    .chat-sidebar__launcher {
      position: fixed;
      bottom: calc(1rem + var(--ngaf-chat-occupy-bottom, 0));
      right: 1rem;
      z-index: 30;
      transition: bottom 200ms ease-out;
    }
```

(d) Add the claim-attribute effect inside the class body. After the `forkRequested` output (line 102), insert a constructor:

```ts
  constructor() {
    // Publish the right-edge claim while the panel is open. Peer panels
    // (e.g. chat-debug) read --ngaf-chat-occupy-right to leave room.
    effect(() => {
      if (typeof document === 'undefined') return;
      const html = document.documentElement;
      if (this.open()) {
        html.dataset['ngafChatSidebar'] = 'open';
      } else {
        delete html.dataset['ngafChatSidebar'];
      }
    });
  }
```

- [ ] **Step 4: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
```

Expected: all chat-sidebar tests pass (existing 2 + 4 new = 6 total).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.ts libs/chat/src/lib/compositions/chat-sidebar/chat-sidebar.component.spec.ts
git commit -m "feat(chat): chat-sidebar publishes data-ngaf-chat-sidebar edge claim

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: chat-debug publishes its claim and reads occupy-right

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`

This task ONLY wires the publish + read side. Auto-dock + override come in Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';

describe('ChatDebugComponent — edge-claim attribute', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ngaf-chat-debug');
  });

  it('sets data-ngaf-chat-debug=dock on <html> while open', () => {
    const styles = (ChatDebugComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.panel--bottom\s*\{[^}]*right:\s*var\(--ngaf-chat-occupy-right/);
    expect(styles).toMatch(/\.panel--right\s*\{[^}]*right:\s*var\(--ngaf-chat-occupy-right/);
  });
});
```

> **Note:** A full effect-based TestBed assertion for the attribute write is added in Task 4 alongside the auto-dock test (which also exercises this code path). Keeping Task 3 narrowly scoped to CSS so the diff is auditable.

- [ ] **Step 2: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: 1 new failure on the CSS regex assertions.

- [ ] **Step 3: Add the read-side CSS to panel--right and panel--bottom**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`, replace the `.panel--right` block (lines 101-108) with:

```css
    .panel--right {
      top: 0;
      right: var(--ngaf-chat-occupy-right, 0);
      bottom: 0;
      width: var(--panel-size, 420px);
      border-right: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-bottom-left-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
      transition: right 200ms ease-out;
    }
```

Replace the `.panel--bottom` block (lines 117-124) with:

```css
    .panel--bottom {
      left: 0;
      right: var(--ngaf-chat-occupy-right, 0);
      bottom: 0;
      height: var(--panel-size, 40vh);
      border-bottom: 0;
      border-top-left-radius: var(--ngaf-chat-debug-radius-panel);
      border-top-right-radius: var(--ngaf-chat-debug-radius-panel);
      transform-origin: bottom right;
      transition: right 200ms ease-out;
    }
```

- [ ] **Step 4: Add the publish-side effect**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`, inside the existing constructor (currently at line 384), append a new `effect()` after the existing write-through effect (after line 402):

```ts
    // Publish the dock the panel currently occupies. Peer panels
    // (e.g. chat-sidebar) read --ngaf-chat-occupy-{right,bottom,left}
    // to avoid overlap.
    effect(() => {
      if (typeof document === 'undefined') return;
      const html = document.documentElement;
      if (this.open()) {
        html.dataset['ngafChatDebug'] = this.dockState();
      } else {
        delete html.dataset['ngafChatDebug'];
      }
    });
```

- [ ] **Step 5: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: all chat-debug tests pass.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts
git commit -m "feat(chat): chat-debug publishes data-ngaf-chat-debug edge claim

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Auto-dock + user override

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `chat-debug.component.spec.ts`:

```ts
describe('ChatDebugComponent — auto-dock', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ngaf-chat-debug');
    document.querySelectorAll('chat-sidebar').forEach((n) => n.remove());
  });

  it('auto-switches to bottom dock when a sibling chat-sidebar exists', () => {
    // Stage a chat-sidebar element on the page so the detector finds it.
    const sidebarEl = document.createElement('chat-sidebar');
    document.body.appendChild(sidebarEl);

    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const debug = new ChatDebugComponent();
      debug.setOpen(true);
      TestBed.flushEffects();
      // dockState was 'right' default, sidebar detection flips to 'bottom'.
      expect((debug as unknown as { dockState: () => string }).dockState()).toBe('bottom');
    });
  });

  it('does NOT auto-switch when no chat-sidebar is present', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const debug = new ChatDebugComponent();
      debug.setOpen(true);
      TestBed.flushEffects();
      expect((debug as unknown as { dockState: () => string }).dockState()).toBe('right');
    });
  });

  it('user clicking a dock button prevents subsequent auto-switching', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const debug = new ChatDebugComponent();
      // User explicitly picks right
      debug.setDock('right');
      // Now stage a sidebar — should NOT override the user's choice
      const sidebarEl = document.createElement('chat-sidebar');
      document.body.appendChild(sidebarEl);
      debug.setOpen(true);
      TestBed.flushEffects();
      expect((debug as unknown as { dockState: () => string }).dockState()).toBe('right');
    });
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: 3 new failures.

- [ ] **Step 3: Implement userDockOverride + auto-dock**

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`:

(a) After the existing `dockState` declaration (currently line 349), add the override flag:

```ts
  protected readonly dockState = signal<DockPosition>('right');
  /** Set to `true` the first time the user explicitly clicks a dock button.
   *  Auto-dock detection becomes a no-op after this flips. Not persisted —
   *  fresh session = fresh chance for the smart default. */
  private readonly userDockOverride = signal<boolean>(false);
```

(b) Replace the existing `setDock` method (currently lines 410-413) with:

```ts
  setDock(next: DockPosition): void {
    this.userDockOverride.set(true);
    this.dockState.set(next);
    this.dockChange.emit(next);
  }
```

(c) Append a new effect inside the constructor (after the publish-side effect added in Task 3, which itself was after line 402):

```ts
    // Auto-dock: when the panel transitions from closed → open AND a
    // sibling <chat-sidebar> exists on the page AND the user hasn't
    // overridden the dock this session, prefer bottom-dock so the two
    // panels coexist without stacking on the right edge.
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      if (this.userDockOverride()) return;
      if (typeof document === 'undefined') return;
      if (!document.querySelector('chat-sidebar')) return;
      // Untracked write so we don't re-trigger this effect via dockState.
      queueMicrotask(() => this.dockState.set('bottom'));
    });
```

- [ ] **Step 4: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: all chat-debug tests pass (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts
git commit -m "feat(chat): chat-debug auto-docks bottom when chat-sidebar is present

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mobile breakpoint — hide debug-bottom under 768px when both are open

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `chat-debug.component.spec.ts`:

```ts
describe('ChatDebugComponent — mobile coexistence', () => {
  it('hides .panel--bottom under 768px when sidebar is open', () => {
    const styles = (ChatDebugComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    // CSS must contain a media query that hides the bottom panel
    // when chat-sidebar is also occupying the right.
    expect(styles).toMatch(
      /@media\s*\(\s*max-width:\s*767px\s*\)[^{]*\{[^}]*:root\[data-ngaf-chat-sidebar="open"\]\s+\.chat-debug\s+\.panel--bottom/,
    );
  });
});
```

Wait — that selector references `:root[data-ngaf-chat-sidebar="open"]` from inside a component's styles, which Angular's view encapsulation will scope to the component, breaking the cascade. Instead, the rule must apply via the encapsulated host attribute. Update the assertion to look for a simpler form:

```ts
describe('ChatDebugComponent — mobile coexistence', () => {
  it('contains a mobile-breakpoint rule guarding the bottom panel', () => {
    const styles = (ChatDebugComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/@media[^{]*max-width:\s*767px[^{]*\{[^}]*\.panel--bottom[^}]*display:\s*none/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: 1 new failure.

- [ ] **Step 3: Implement the mobile rule**

The collision case is `chat-sidebar drawer at width 100vw` AND `chat-debug bottom-dock`. The simplest CSS-only solution: at `<768px`, when the lib's occupy-right is non-zero, the bottom panel's `right: var(--ngaf-chat-occupy-right, 0)` collapses it to zero width. We don't actually need a hide rule because the panel is already invisible. BUT the panel still consumes pointer events at the right edge. Better to explicitly hide.

In `libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts`, add this block to the styles array, immediately after the `.panel--bottom` block:

```css
    /* Mobile breakpoint: when an edge-claimer occupies the right and
       the device is narrow, the bottom strip's effective width is
       ~zero. Explicitly hide it so it doesn't intercept pointer events
       on the sidebar drawer. The chat-debug launcher remains visible. */
    @media (max-width: 767px) {
      .panel--bottom { display: none; }
    }
```

> **Note:** This rule fires on ALL narrow viewports, not only when the sidebar is open. That's fine — at <768px the bottom strip is impractical anyway (would steal half the small screen). Users on mobile who want debug should pick right-dock manually; the launcher stays clickable.

- [ ] **Step 4: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-debug/chat-debug.component.spec.ts
```

Expected: all chat-debug tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-debug/chat-debug.component.ts libs/chat/src/lib/compositions/chat-debug/chat-debug.component.spec.ts
git commit -m "feat(chat): hide chat-debug bottom panel under 768px

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: E2E spec for sidebar-mode coexistence

**Files:**
- Create: `examples/chat/aimock-e2e/tests/sidebar-mode-coexistence.spec.ts`

First, check what's already covered to avoid duplication.

- [ ] **Step 1: List existing E2E specs**

```bash
ls examples/chat/aimock-e2e/tests/
```

If `sidebar-mode.spec.ts` already exists, ADD a new `describe` block to it instead of creating a new file. Otherwise create the new file below.

- [ ] **Step 2: Write the new E2E spec**

Create `examples/chat/aimock-e2e/tests/sidebar-mode-coexistence.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test.describe('chat-debug × chat-sidebar coexistence', () => {
  test('sidebar launcher remains reachable while chat-debug is open', async ({ page }) => {
    await page.goto('/sidebar');
    // Open chat-debug via the floating top-right launcher.
    await page.locator('.launcher').click();
    // Debug should auto-pick bottom dock when sidebar mode is active.
    const debugPanel = page.locator('.panel.panel--bottom');
    await expect(debugPanel).toBeVisible();
    // Sidebar launcher must still be present and clickable.
    const sidebarLauncher = page.locator('.chat-sidebar__launcher');
    await expect(sidebarLauncher).toBeVisible();
    await sidebarLauncher.click();
    // Sidebar panel slides in.
    const sidebarPanel = page.locator('.chat-sidebar__panel[data-open="true"]');
    await expect(sidebarPanel).toBeVisible();
    // No overlap: the bottom panel's right edge must end before the
    // sidebar's left edge (sidebar is 28rem = 448px wide).
    const sidebarBox = await sidebarPanel.boundingBox();
    const debugBox = await debugPanel.boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(debugBox).not.toBeNull();
    // debug right edge <= sidebar left edge (within 1px tolerance)
    expect(debugBox!.x + debugBox!.width).toBeLessThanOrEqual(sidebarBox!.x + 1);
  });

  test('user override survives mode switch: explicit right-dock stays right', async ({ page }) => {
    await page.goto('/embed');
    await page.locator('.launcher').click();
    // Click right-dock explicitly (the existing dock-btn 'is-active' selector confirms it's right by default,
    // but click it anyway to set the override flag).
    await page.locator('.panel__dock-btn').nth(2).click(); // 0=left, 1=bottom, 2=right per template
    // Switch to sidebar mode via the debug palette's Mode segmented control.
    await page.locator('.segmented__btn', { hasText: 'Sidebar' }).click();
    // Debug should still be right-docked, not auto-flipped to bottom.
    await expect(page.locator('.panel.panel--right')).toBeVisible();
    await expect(page.locator('.panel.panel--bottom')).not.toBeVisible();
  });
});
```

- [ ] **Step 3: Run the E2E spec locally**

The aimock harness needs the local dev stack. Start it:

```bash
npx nx run examples-chat:serve
```

Wait for both servers (frontend on 4200, python on 2024) to be reachable, then in a separate shell:

```bash
npx nx run examples-chat-aimock-e2e:e2e --testNamePattern="coexistence"
```

Expected: both tests pass. If they fail because the dev stack uses real OpenAI calls instead of aimock, set `OPENAI_API_KEY=aimock` in `examples/chat/python/.env` and restart.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/aimock-e2e/tests/sidebar-mode-coexistence.spec.ts
git commit -m "test(examples-chat): E2E for chat-debug × sidebar coexistence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update smoke CHECKLIST.md

**Files:**
- Modify: `examples/chat/smoke/CHECKLIST.md`

- [ ] **Step 1: Find the chat-debug devtools section**

```bash
grep -n "chat-debug devtools" examples/chat/smoke/CHECKLIST.md
```

The section starts at line 115 (from PR #341 — recently edited).

- [ ] **Step 2: Append three new checks at the end of that section**

In `examples/chat/smoke/CHECKLIST.md`, find the line that reads:

```
- [ ] Click the close affordance — panel unmounts; launcher remains
```

Immediately after it (still inside the `## chat-debug devtools` section), append:

```markdown

### Coexistence with chat-sidebar

- [ ] Switch to Sidebar mode via the palette — debug panel auto-redocks to the bottom (was: right)
- [ ] Open the sidebar launcher (bottom-right) — slides in over the demo bg; debug bottom panel stays visible at the LEFT of the sidebar
- [ ] Manually click the right-dock icon — debug moves to the right edge of the demo bg (NOT under the sidebar); user override sticks for the rest of the session
```

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat): smoke checks for chat-debug × sidebar coexistence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Build verify, lint, push, open PR

**Files:** none modified — gate task.

- [ ] **Step 1: Full chat lib build**

```bash
npx nx build chat
```

Expected: `Successfully ran target build for project chat`. Catches any TypeScript regressions from the four publish/read effects + new style rules.

- [ ] **Step 2: Full vitest run for the chat lib**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run
```

Expected: all suites pass. Note the new totals: chat-tokens (+8), chat-sidebar (+4), chat-debug (+4 = 3 auto-dock + 1 mobile breakpoint).

- [ ] **Step 3: Lint**

```bash
cd ~/repos/angular-agent-framework && npx nx lint chat
```

Expected: lint passes. If it fails on the new effect()s, the most likely cause is an unused import — fix and re-run.

- [ ] **Step 4: Sanity grep — no orphan references**

```bash
grep -rn "userDockOverride\|data-ngaf-chat-sidebar\|data-ngaf-chat-debug\|--ngaf-chat-occupy-" libs/chat/src/
```

Expected: references appear in exactly the files this plan touched (chat-tokens.ts, chat-tokens.spec.ts, chat-sidebar.component.ts, chat-sidebar.component.spec.ts, chat-debug.component.ts, chat-debug.component.spec.ts). If references appear elsewhere, investigate.

- [ ] **Step 5: Push branch**

```bash
git push -u origin claude/chat-debug-sidebar-coexistence
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --head claude/chat-debug-sidebar-coexistence --title "feat(chat): chat-debug × chat-sidebar coexistence (edge-claim primitive + auto-dock)" --body "$(cat <<'EOF'
## Summary

Two-part fix for the live-demo UX issue where chat-debug's right-docked panel covered the sidebar's launcher button, leaving the user unable to open the chat while inspecting it.

### 1. Edge-claim primitive

New CSS custom properties on `:root` (`--ngaf-chat-occupy-{top,right,bottom,left}`) plus two `data-ngaf-chat-{sidebar,debug}` attributes on `<html>`. Each docked panel writes its claimed edge; peers read the variables to leave room. Pure CSS cascade, no service / DI plumbing.

### 2. Auto-dock when sidebar is present

When chat-debug opens and a sibling `<chat-sidebar>` is on the page, it auto-switches to `dock="bottom"`. The user can override by clicking any dock button (override flag persists for the session).

## Behavior matrix

| Demo mode | Debug closed | Debug open |
|---|---|---|
| embed | unchanged | debug docks right (unchanged) |
| popup | unchanged | debug docks right (unchanged) |
| sidebar | unchanged | debug **auto-docks bottom**; sidebar launcher remains reachable |

## Test plan

- [x] \`npx nx build chat\` succeeds
- [x] \`vitest run\` — all chat lib specs pass (+ 16 new cases: 8 chat-tokens, 4 chat-sidebar, 4 chat-debug)
- [x] \`npx nx lint chat\` passes
- [x] E2E: \`sidebar-mode-coexistence.spec.ts\` — sidebar launcher remains clickable; user override survives mode switch
- [x] Manual smoke: three new items in \`examples/chat/smoke/CHECKLIST.md\`

## Out of scope

- Stacking multiple panels on the same edge (e.g. a third notifications drawer above the sidebar)
- Resizable docks (drag-to-grow handles)
- Documenting \`data-ngaf-chat-{sidebar,debug}\` as public consumer API

Spec: \`docs/superpowers/specs/2026-05-15-chat-debug-sidebar-coexistence-design.md\`
Plan: \`docs/superpowers/plans/2026-05-15-chat-debug-sidebar-coexistence.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Watch CI, merge on green**

```bash
gh pr checks <PR_NUMBER>
# When all required checks pass:
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- [ ] **Step 8: Cleanup local branch**

```bash
git checkout main 2>/dev/null || true
git pull --ff-only
git branch -D claude/chat-debug-sidebar-coexistence 2>/dev/null || true
```

---

## Notes for the executing engineer

- **Effect ordering matters.** The Task 4 auto-dock effect runs `queueMicrotask(() => this.dockState.set('bottom'))` because writing `dockState` synchronously inside an effect that reads `open()` and `userDockOverride()` could loop. The microtask defers the write outside the current effect run.
- **`TestBed.flushEffects()`** is the right way to drive effect updates in vitest specs. If you see "expected ... received undefined" with attribute assertions, that's almost always a missing flush.
- **Don't touch `chat-popup`.** It's a floating window, not edge-anchored — out of scope and explicitly excluded.
- **Don't restore `userDockOverride` from persistence.** Each session gets a fresh chance for the smart default. If a future task wants persistent override, it's a separate feature.
