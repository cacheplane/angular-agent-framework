# Hand-rolled connected-overlay primitive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@threadplane/chat`'s `@angular/cdk` peer dependency with a small, public, zero-runtime-dep connected-overlay primitive (body portal + flip/clamp positioning + live reposition + a11y), with `chat-select` as the first consumer.

**Architecture:** A pure positioning function (`connected-position.ts`), a singleton body-portal container with self-injected structural CSS (`overlay-container.ts`), and a declarative directive pair (`[chatOverlayOrigin]` + `[chatConnectedOverlay]` on an `<ng-template>`) that portals template content to the container, positions it connected to the origin, repositions live on scroll/resize, and handles outside-click / focus-return / Tab-close. `chat-select` swaps its `cdk*` overlay attributes for the `chat*` equivalents.

**Tech Stack:** Angular 21 (standalone, signals, `effect`, `input`/`output`, `DestroyRef`), TypeScript, Vitest (unit), Playwright (e2e). DOM APIs only — no `@angular/cdk`.

**Working directory:** worktree `/Users/blove/repos/angular-agent-framework/.claude/worktrees/ag-ui-app-mode-mapfix`, branch `blove/ag-ui-app-mode-promo`. All paths below are repo-relative.

**Reference:** `~/repos/components/src/cdk/overlay` (CDK overlay source) for positioning/lifecycle/a11y semantics. Spec: `docs/superpowers/specs/2026-06-27-chat-overlay-primitive-design.md`.

---

## Task 1: Pure connected-position function

**Files:**
- Create: `libs/chat/src/lib/primitives/overlay/connected-position.ts`
- Test: `libs/chat/src/lib/primitives/overlay/connected-position.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/overlay/connected-position.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { computeConnectedPosition, narrowViewport, type ConnectedPosition } from './connected-position';

const ABOVE_RIGHT: ConnectedPosition = { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 };
const BELOW_RIGHT: ConnectedPosition = { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 };
const POSITIONS = [ABOVE_RIGHT, BELOW_RIGHT];

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe('computeConnectedPosition', () => {
  const viewport = narrowViewport({ innerWidth: 1000, innerHeight: 800 }, 8);

  it('uses the first position when it fully fits (above, right-aligned)', () => {
    const origin = rect(600, 400, 120, 32); // mid-screen trigger
    const r = computeConnectedPosition({ originRect: origin, overlaySize: { width: 200, height: 150 }, viewport, positions: POSITIONS });
    // above: overlay bottom sits 8px above origin top (400) → top = 400 - 8 - 150 = 242
    expect(r.top).toBe(242);
    // end-aligned: overlay right edge = origin right (720) → left = 720 - 200 = 520
    expect(r.left).toBe(520);
    expect(r.position).toBe(ABOVE_RIGHT);
  });

  it('flips to the second position when the first overflows the top edge', () => {
    const origin = rect(600, 20, 120, 32); // near top → no room above for a 150-tall menu
    const r = computeConnectedPosition({ originRect: origin, overlaySize: { width: 200, height: 150 }, viewport, positions: POSITIONS });
    // below: overlay top = origin bottom (52) + 8 = 60
    expect(r.top).toBe(60);
    expect(r.position).toBe(BELOW_RIGHT);
  });

  it('pushes onto screen when no position fully fits (clamps within viewport)', () => {
    const origin = rect(950, 400, 40, 32); // far right; 400-wide menu cannot fit either way
    const r = computeConnectedPosition({ originRect: origin, overlaySize: { width: 400, height: 150 }, viewport, positions: POSITIONS });
    // right edge clamped to viewport.right (992) → left = 992 - 400 = 592; never < margin
    expect(r.left).toBe(592);
    expect(r.left).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- connected-position`
Expected: FAIL — cannot resolve `./connected-position`.

- [ ] **Step 3: Write the implementation**

Create `libs/chat/src/lib/primitives/overlay/connected-position.ts`:

```ts
// libs/chat/src/lib/primitives/overlay/connected-position.ts
// SPDX-License-Identifier: MIT
//
// Minimal port of CDK's FlexibleConnectedPositionStrategy fit logic
// (~/repos/components/src/cdk/overlay/position/flexible-connected-position-strategy.ts):
// _getOriginPoint + _getOverlayPoint + _getOverlayFit + _pushOverlayOnScreen.
// Omits flexible-dimensions, grow-after-open, RTL, and virtual-keyboard handling.

export type HorizontalConnectionPos = 'start' | 'center' | 'end';
export type VerticalConnectionPos = 'top' | 'center' | 'bottom';

export interface ConnectedPosition {
  originX: HorizontalConnectionPos;
  originY: VerticalConnectionPos;
  overlayX: HorizontalConnectionPos;
  overlayY: VerticalConnectionPos;
  offsetX?: number;
  offsetY?: number;
}

export interface Size {
  width: number;
  height: number;
}
interface Point {
  x: number;
  y: number;
}
export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface OverlayPositionResult {
  top: number;
  left: number;
  position: ConnectedPosition;
}

export interface ComputeArgs {
  originRect: Rect;
  overlaySize: Size;
  /** Viewport rect, already narrowed by the desired margin. */
  viewport: Rect;
  positions: ConnectedPosition[];
}

function originPoint(origin: Rect, pos: ConnectedPosition): Point {
  const x = pos.originX === 'center' ? origin.left + origin.width / 2 : pos.originX === 'start' ? origin.left : origin.right;
  const y = pos.originY === 'center' ? origin.top + origin.height / 2 : pos.originY === 'top' ? origin.top : origin.bottom;
  return { x, y };
}

function overlayPoint(origin: Point, size: Size, pos: ConnectedPosition): Point {
  let x = origin.x;
  if (pos.overlayX === 'center') x -= size.width / 2;
  else if (pos.overlayX === 'end') x -= size.width;
  let y = origin.y;
  if (pos.overlayY === 'center') y -= size.height / 2;
  else if (pos.overlayY === 'bottom') y -= size.height;
  return { x: x + (pos.offsetX ?? 0), y: y + (pos.offsetY ?? 0) };
}

function fitArea(point: Point, size: Size, viewport: Rect): { area: number; fits: boolean } {
  const left = point.x;
  const right = point.x + size.width;
  const top = point.y;
  const bottom = point.y + size.height;
  const visibleW = Math.max(0, Math.min(right, viewport.right) - Math.max(left, viewport.left));
  const visibleH = Math.max(0, Math.min(bottom, viewport.bottom) - Math.max(top, viewport.top));
  const fits = left >= viewport.left && right <= viewport.right && top >= viewport.top && bottom <= viewport.bottom;
  return { area: visibleW * visibleH, fits };
}

function pushOnScreen(point: Point, size: Size, viewport: Rect): Point {
  const maxLeft = viewport.right - size.width;
  const maxTop = viewport.bottom - size.height;
  return {
    x: Math.max(viewport.left, Math.min(point.x, maxLeft)),
    y: Math.max(viewport.top, Math.min(point.y, maxTop)),
  };
}

export function computeConnectedPosition(args: ComputeArgs): OverlayPositionResult {
  const { originRect, overlaySize, viewport, positions } = args;
  let best: { point: Point; pos: ConnectedPosition; area: number } | null = null;

  for (const pos of positions) {
    const point = overlayPoint(originPoint(originRect, pos), overlaySize, pos);
    const { area, fits } = fitArea(point, overlaySize, viewport);
    if (fits) {
      return { top: point.y, left: point.x, position: pos };
    }
    if (!best || area > best.area) best = { point, pos, area };
  }

  const pushed = pushOnScreen(best!.point, overlaySize, viewport);
  return { top: pushed.y, left: pushed.x, position: best!.pos };
}

export function narrowViewport(win: { innerWidth: number; innerHeight: number }, margin: number): Rect {
  return {
    left: margin,
    top: margin,
    right: win.innerWidth - margin,
    bottom: win.innerHeight - margin,
    width: win.innerWidth - 2 * margin,
    height: win.innerHeight - 2 * margin,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- connected-position`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/overlay/connected-position.ts libs/chat/src/lib/primitives/overlay/connected-position.spec.ts
git commit -m "feat(chat): connected-position fit/flip/push function (overlay primitive)"
```

---

## Task 2: Body-portal container

**Files:**
- Create: `libs/chat/src/lib/primitives/overlay/overlay-container.ts`
- Test: `libs/chat/src/lib/primitives/overlay/overlay-container.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/overlay/overlay-container.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, afterEach } from 'vitest';
import { getOverlayContainer } from './overlay-container';

afterEach(() => {
  document.querySelector('.chat-overlay-container')?.remove();
  document.getElementById('chat-overlay-structure')?.remove();
});

describe('getOverlayContainer', () => {
  it('creates a single body-level container and injects structural CSS once', () => {
    const a = getOverlayContainer(document);
    const b = getOverlayContainer(document);
    expect(a).toBe(b); // singleton
    expect(a.parentElement).toBe(document.body);
    expect(document.querySelectorAll('.chat-overlay-container').length).toBe(1);
    expect(document.querySelectorAll('#chat-overlay-structure').length).toBe(1);
    expect(document.getElementById('chat-overlay-structure')!.textContent).toContain('position: fixed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- overlay-container`
Expected: FAIL — cannot resolve `./overlay-container`.

- [ ] **Step 3: Write the implementation**

Create `libs/chat/src/lib/primitives/overlay/overlay-container.ts`:

```ts
// libs/chat/src/lib/primitives/overlay/overlay-container.ts
// SPDX-License-Identifier: MIT

const CONTAINER_CLASS = 'chat-overlay-container';
const STYLE_ID = 'chat-overlay-structure';

// Structural CSS, injected once into <head> (same pattern as ROOT_TOKEN_STYLES
// in chat-tokens.ts) so consumers need not import any stylesheet.
const STRUCTURE_CSS = `
.${CONTAINER_CLASS} {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
}
.chat-overlay-pane {
  position: absolute;
  pointer-events: auto;
}
`;

/** Returns the single shared overlay container appended to <body>, creating it
 *  (and injecting structural CSS) on first call. */
export function getOverlayContainer(doc: Document): HTMLElement {
  const existing = doc.querySelector<HTMLElement>('.' + CONTAINER_CLASS);
  if (existing) return existing;

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STRUCTURE_CSS;
    doc.head.appendChild(style);
  }

  const container = doc.createElement('div');
  container.className = CONTAINER_CLASS;
  doc.body.appendChild(container);
  return container;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- overlay-container`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/overlay/overlay-container.ts libs/chat/src/lib/primitives/overlay/overlay-container.spec.ts
git commit -m "feat(chat): body-portal overlay container with self-injected structural CSS"
```

---

## Task 3: Connected-overlay directives

**Files:**
- Create: `libs/chat/src/lib/primitives/overlay/connected-overlay.directive.ts`
- Test: `libs/chat/src/lib/primitives/overlay/connected-overlay.directive.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/primitives/overlay/connected-overlay.directive.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConnectedOverlayDirective, ChatOverlayOriginDirective } from './connected-overlay.directive';
import type { ConnectedPosition } from './connected-position';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
];

@Component({
  standalone: true,
  imports: [ChatConnectedOverlayDirective, ChatOverlayOriginDirective],
  template: `
    <button chatOverlayOrigin #o="chatOverlayOrigin">trigger</button>
    <ng-template
      chatConnectedOverlay
      [chatOverlayOrigin]="o"
      [chatOverlayOpen]="open()"
      [chatOverlayPositions]="positions"
      [chatOverlayPanelClass]="'test-panel'"
      (chatOverlayOutsideClick)="open.set(false)">
      <div class="menu-content">hello</div>
    </ng-template>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly positions = POSITIONS;
}

describe('ChatConnectedOverlayDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelector('.chat-overlay-container')?.remove();
  });

  const pane = () => document.querySelector('.chat-overlay-container .chat-overlay-pane');

  it('portals content to the overlay container when open, with the panel class', () => {
    expect(pane()).toBeNull();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const p = pane();
    expect(p).not.toBeNull();
    expect(p!.classList.contains('test-panel')).toBe(true);
    expect(p!.querySelector('.menu-content')?.textContent).toContain('hello');
  });

  it('removes the pane when closed', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(pane()).toBeNull();
  });

  it('emits outsideClick on a document mousedown outside the pane and origin', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(pane()).toBeNull(); // host closed via (outsideClick)
  });

  it('tears down the pane when the host is destroyed', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.destroy();
    expect(pane()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test chat -- connected-overlay.directive`
Expected: FAIL — cannot resolve `./connected-overlay.directive`.

- [ ] **Step 3: Write the implementation**

Create `libs/chat/src/lib/primitives/overlay/connected-overlay.directive.ts`:

```ts
// libs/chat/src/lib/primitives/overlay/connected-overlay.directive.ts
// SPDX-License-Identifier: MIT
import {
  DestroyRef,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  DOCUMENT,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { getOverlayContainer } from './overlay-container';
import { computeConnectedPosition, narrowViewport, type ConnectedPosition } from './connected-position';

/** Marks the anchor element a connected overlay positions against. */
@Directive({
  selector: '[chatOverlayOrigin]',
  standalone: true,
  exportAs: 'chatOverlayOrigin',
})
export class ChatOverlayOriginDirective {
  readonly elementRef = inject(ElementRef) as ElementRef<HTMLElement>;
}

const VIEWPORT_MARGIN = 8;

/**
 * Applied to an `<ng-template>`. When `chatOverlayOpen` is true, the template
 * content is portaled into the shared body-level overlay container and
 * positioned connected to `chatOverlayOrigin`, repositioning live on
 * scroll/resize. Closes on outside mousedown (via the `chatOverlayOutsideClick`
 * output) and Tab; returns focus to the origin when focus was inside the pane.
 */
@Directive({
  selector: '[chatConnectedOverlay]',
  standalone: true,
})
export class ChatConnectedOverlayDirective {
  readonly origin = input.required<ChatOverlayOriginDirective>({ alias: 'chatOverlayOrigin' });
  readonly open = input<boolean>(false, { alias: 'chatOverlayOpen' });
  readonly positions = input<ConnectedPosition[]>([], { alias: 'chatOverlayPositions' });
  readonly panelClass = input<string | string[]>('', { alias: 'chatOverlayPanelClass' });

  /** Emits the pane element once attached (consumers focus content from it). */
  readonly attached = output<HTMLElement>({ alias: 'chatOverlayAttached' });
  readonly outsideClick = output<MouseEvent>({ alias: 'chatOverlayOutsideClick' });
  readonly detached = output<void>({ alias: 'chatOverlayDetach' });

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly document = inject(DOCUMENT);

  private pane: HTMLElement | null = null;
  private viewRef: EmbeddedViewRef<unknown> | null = null;
  private resizeObs: ResizeObserver | null = null;
  private rafId = 0;
  private previouslyFocused: HTMLElement | null = null;

  private readonly onScrollOrResize = () => this.scheduleReposition();
  private readonly onDocMouseDown = (e: MouseEvent) => {
    if (!this.pane) return;
    const path = e.composedPath();
    if (path.includes(this.pane) || path.includes(this.origin().elementRef.nativeElement)) return;
    this.outsideClick.emit(e);
  };
  private readonly onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !this.pane) return;
    const active = this.document.activeElement;
    if (this.pane.contains(active) || active === this.origin().elementRef.nativeElement) {
      this.detached.emit();
    }
  };

  constructor() {
    effect(() => {
      if (this.open()) this.attach();
      else this.dispose();
    });
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  private attach(): void {
    if (this.pane) return;
    const win = this.document.defaultView;
    if (!win) return; // SSR / detached document

    this.previouslyFocused = this.document.activeElement as HTMLElement | null;

    const pane = this.document.createElement('div');
    pane.className = 'chat-overlay-pane';
    for (const c of this.normalizePanelClass()) pane.classList.add(c);
    getOverlayContainer(this.document).appendChild(pane);

    this.viewRef = this.viewContainerRef.createEmbeddedView(this.templateRef);
    this.viewRef.detectChanges();
    for (const node of this.viewRef.rootNodes) pane.appendChild(node as Node);

    this.pane = pane;
    this.reposition();

    win.addEventListener('scroll', this.onScrollOrResize, { capture: true, passive: true });
    win.addEventListener('resize', this.onScrollOrResize, { passive: true });
    this.document.addEventListener('mousedown', this.onDocMouseDown, true);
    this.document.addEventListener('keydown', this.onKeydown, true);
    if (typeof win.ResizeObserver === 'function') {
      this.resizeObs = new win.ResizeObserver(() => this.scheduleReposition());
      this.resizeObs.observe(this.origin().elementRef.nativeElement);
      this.resizeObs.observe(pane);
    }

    this.attached.emit(pane);
  }

  private scheduleReposition(): void {
    const win = this.document.defaultView;
    if (!win || !this.pane) return;
    if (this.rafId) win.cancelAnimationFrame(this.rafId);
    this.rafId = win.requestAnimationFrame(() => this.reposition());
  }

  private reposition(): void {
    const win = this.document.defaultView;
    if (!win || !this.pane) return;
    const r = this.pane.getBoundingClientRect();
    const result = computeConnectedPosition({
      originRect: this.origin().elementRef.nativeElement.getBoundingClientRect(),
      overlaySize: { width: r.width, height: r.height },
      viewport: narrowViewport(win, VIEWPORT_MARGIN),
      positions: this.positions(),
    });
    this.pane.style.top = `${Math.round(result.top)}px`;
    this.pane.style.left = `${Math.round(result.left)}px`;
  }

  private dispose(): void {
    const win = this.document.defaultView;
    if (this.rafId && win) win.cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (win) {
      win.removeEventListener('scroll', this.onScrollOrResize, { capture: true } as EventListenerOptions);
      win.removeEventListener('resize', this.onScrollOrResize);
    }
    this.document.removeEventListener('mousedown', this.onDocMouseDown, true);
    this.document.removeEventListener('keydown', this.onKeydown, true);
    this.resizeObs?.disconnect();
    this.resizeObs = null;

    const focusWasInPane = !!this.pane && this.pane.contains(this.document.activeElement);
    this.viewRef?.destroy();
    this.viewRef = null;
    this.pane?.remove();
    this.pane = null;

    if (focusWasInPane && this.previouslyFocused) this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }

  private normalizePanelClass(): string[] {
    const pc = this.panelClass();
    return Array.isArray(pc) ? pc : pc ? [pc] : [];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat -- connected-overlay.directive`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/overlay/connected-overlay.directive.ts libs/chat/src/lib/primitives/overlay/connected-overlay.directive.spec.ts
git commit -m "feat(chat): ChatConnectedOverlay + ChatOverlayOrigin directives (body portal, live reposition)"
```

---

## Task 4: Export the primitive from the public API

**Files:**
- Modify: `libs/chat/src/public-api.ts` (after line 84, the `ChatSelectComponent` exports)

- [ ] **Step 1: Add the exports**

In `libs/chat/src/public-api.ts`, immediately after the `ChatSelectOption` export (line 84), add:

```ts
export { ChatOverlayOriginDirective, ChatConnectedOverlayDirective } from './lib/primitives/overlay/connected-overlay.directive';
export type { ConnectedPosition, OverlayPositionResult } from './lib/primitives/overlay/connected-position';
```

- [ ] **Step 2: Verify the lib still builds**

Run: `npx nx build chat`
Expected: build succeeds, no unresolved exports.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export connected-overlay primitive from public API"
```

---

## Task 5: Migrate chat-select to the new primitive + drop @angular/cdk

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts`
- Modify: `libs/chat/package.json` (remove `@angular/cdk` peer dep)

- [ ] **Step 1: Replace the component (CDK → chat overlay)**

Overwrite `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts` with:

```ts
// libs/chat/src/lib/primitives/chat-select/chat-select.component.ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
  DOCUMENT,
} from '@angular/core';
import { ChatConnectedOverlayDirective, ChatOverlayOriginDirective } from '../overlay/connected-overlay.directive';
import type { ConnectedPosition } from '../overlay/connected-position';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_SELECT_STYLES } from '../../styles/chat-select.styles';

export interface ChatSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

// Unique listbox id per instance, for aria-controls (multiple selects per page).
let nextChatSelectId = 0;

/**
 * Generic single-select dropdown. The menu renders through the chat
 * connected-overlay primitive (a body-level portal), so it is never clipped by
 * an ancestor's `overflow` and never trapped by an ancestor `transform`.
 *
 * Inputs: options (required), value (two-way), placeholder, disabled, menuLabel,
 * panelClass (extra class(es) on the overlay pane — the menu is portaled, so
 * `::ng-deep chat-select .chat-select__menu` no longer reaches it).
 */
@Component({
  selector: 'chat-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatConnectedOverlayDirective, ChatOverlayOriginDirective],
  styles: [CHAT_HOST_TOKENS, CHAT_SELECT_STYLES],
  template: `
    <button
      type="button"
      class="chat-select__trigger"
      chatOverlayOrigin
      #origin="chatOverlayOrigin"
      [class.is-open]="open()"
      [disabled]="disabled()"
      [attr.aria-haspopup]="'listbox'"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? menuId : null"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <span class="chat-select__label">{{ currentLabel() }}</span>
      <svg class="chat-select__chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <ng-template
      chatConnectedOverlay
      [chatOverlayOrigin]="origin"
      [chatOverlayOpen]="open()"
      [chatOverlayPositions]="overlayPositions"
      [chatOverlayPanelClass]="panelClasses()"
      (chatOverlayAttached)="onAttached($event)"
      (chatOverlayOutsideClick)="open.set(false)"
      (chatOverlayDetach)="open.set(false)"
    >
      <div
        class="chat-select__menu"
        role="listbox"
        tabindex="-1"
        [id]="menuId"
        [attr.aria-label]="menuLabel() ?? placeholder()"
        (keydown)="onMenuKeydown($event)"
      >
        @for (opt of options(); track opt.value) {
          <button
            type="button"
            class="chat-select__option"
            [class.is-active]="opt.value === value()"
            [disabled]="opt.disabled === true"
            role="option"
            [attr.aria-selected]="opt.value === value()"
            (click)="selectOption(opt)"
          >
            <span class="chat-select__option-label">{{ opt.label }}</span>
            @if (opt.description) {
              <span class="chat-select__option-desc">{{ opt.description }}</span>
            }
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ChatSelectComponent {
  readonly options = input.required<readonly ChatSelectOption[]>();
  readonly value = model<string>('');
  readonly placeholder = input<string>('Select');
  readonly disabled = input<boolean>(false);
  readonly menuLabel = input<string | undefined>(undefined);
  readonly panelClass = input<string | string[]>('');

  protected readonly open = signal(false);
  protected readonly menuId = `chat-select-menu-${nextChatSelectId++}`;

  // Above-right preferred (input pill sits at the bottom), then below, then the
  // left-aligned variants. The positioner flips/clamps to keep it in view.
  protected readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  ];

  protected readonly panelClasses = computed<string[]>(() => {
    const extra = this.panelClass();
    const list = Array.isArray(extra) ? extra : extra ? [extra] : [];
    return ['chat-select__overlay', ...list];
  });

  protected readonly currentLabel = computed(() => {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? this.placeholder();
  });

  private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;
  private readonly document = inject(DOCUMENT);
  // The overlay primitive emits the pane element on attach; options live there
  // (portaled out of the host), so option queries go through it.
  private menuPane: HTMLElement | null = null;

  protected onAttached(pane: HTMLElement): void {
    this.menuPane = pane;
    this.focusOption(0);
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  protected selectOption(opt: ChatSelectOption): void {
    if (opt.disabled) return;
    this.value.set(opt.value);
    this.open.set(false);
  }

  protected onTriggerKeydown(e: KeyboardEvent): void {
    if (this.disabled()) return;
    if (e.key === 'Escape' && this.open()) {
      e.preventDefault();
      this.open.set(false);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.open.set(true);
      // focus happens in onAttached once the pane is live
    }
  }

  protected onMenuKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.open.set(false);
      this.queryTrigger()?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.moveFocus(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const t = e.target as HTMLElement;
      if (t.classList.contains('chat-select__option')) {
        e.preventDefault();
        (t as HTMLButtonElement).click();
      }
    }
  }

  private focusOption(index: number): void {
    this.queryOptions()[index]?.focus();
  }

  private moveFocus(dir: 1 | -1): void {
    const opts = this.queryOptions().filter((b) => !b.disabled);
    if (!opts.length) return;
    const active = this.document.activeElement as HTMLElement | null;
    const idx = active ? opts.indexOf(active as HTMLButtonElement) : -1;
    opts[(idx + dir + opts.length) % opts.length]?.focus();
  }

  private queryOptions(): HTMLButtonElement[] {
    const root = this.menuPane;
    return root ? Array.from(root.querySelectorAll<HTMLButtonElement>('.chat-select__option')) : [];
  }

  private queryTrigger(): HTMLButtonElement | null {
    return this.hostEl.querySelector<HTMLButtonElement>('.chat-select__trigger');
  }
}
```

- [ ] **Step 2: Remove the @angular/cdk peer dependency**

In `libs/chat/package.json`, delete the line:

```json
    "@angular/cdk": "^20.0.0 || ^21.0.0",
```

(from the `peerDependencies` block — leave `@angular/core` etc. intact).

- [ ] **Step 3: Verify no remaining @angular/cdk usage in the lib**

Run: `grep -rn "@angular/cdk" libs/chat/src`
Expected: no matches (empty output).

- [ ] **Step 4: Build + lint the lib**

Run: `npx nx build chat && npx nx lint chat`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-select/chat-select.component.ts libs/chat/package.json
git commit -m "refactor(chat): chat-select uses the in-lib overlay primitive; drop @angular/cdk peer dep"
```

---

## Task 6: Update the chat-select unit spec for the renamed container

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-select/chat-select.component.spec.ts`

- [ ] **Step 1: Repoint the overlay queries**

The spec currently injects CDK's `OverlayContainer`. Replace that with direct DOM queries against `.chat-overlay-container`. Make these edits:

Remove the import line:
```ts
import { OverlayContainer } from '@angular/cdk/overlay';
```

Replace the `overlay` setup. Change:
```ts
  let overlay: HTMLElement;
```
to:
```ts
  const overlayRoot = () => document.querySelector('.chat-overlay-container') as HTMLElement | null;
```

In `beforeEach`, remove:
```ts
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
```

Update the helpers:
```ts
  const menu = () => overlayRoot()?.querySelector('.chat-select__menu') ?? null;
  const optionEls = () => overlayRoot()?.querySelectorAll<HTMLButtonElement>('.chat-select__option') ?? ([] as unknown as NodeListOf<HTMLButtonElement>);
```

In `afterEach`, after `fixture.destroy();` add:
```ts
    overlayRoot()?.remove();
```

- [ ] **Step 2: Run the spec**

Run: `npx nx test chat -- chat-select`
Expected: PASS (all chat-select tests).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-select/chat-select.component.spec.ts
git commit -m "test(chat): chat-select spec queries .chat-overlay-container"
```

---

## Task 7: Repoint consumer e2e selectors (chat example)

**Files:**
- Modify: `examples/chat/angular/e2e/test-helpers.ts`
- Modify: `examples/chat/angular/e2e/model-picker.spec.ts`

- [ ] **Step 1: Update the shared toolbar helper**

In `examples/chat/angular/e2e/test-helpers.ts`, inside `selectToolbarOption`, change:
```ts
  const menu = page.locator('.cdk-overlay-container .chat-select__menu');
```
to:
```ts
  const menu = page.locator('.chat-overlay-container .chat-select__menu');
```

- [ ] **Step 2: Update the model-picker spec**

In `examples/chat/angular/e2e/model-picker.spec.ts`, change:
```ts
  const modelMenu = page.locator('.cdk-overlay-container .chat-select__menu');
```
to:
```ts
  const modelMenu = page.locator('.chat-overlay-container .chat-select__menu');
```

- [ ] **Step 3: Confirm no other cdk-overlay-container references remain in examples**

Run: `grep -rn "cdk-overlay-container" examples`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/e2e/test-helpers.ts examples/chat/angular/e2e/model-picker.spec.ts
git commit -m "test(chat-e2e): query .chat-overlay-container for the portaled select menu"
```

---

## Task 8: Full verification + live Chrome + final commit

**Files:** none (verification only; commit any incidental fixes).

- [ ] **Step 1: Lint + unit across the lib and both examples**

Run:
```bash
npx nx run-many -t lint test -p chat examples-ag-ui-angular examples-chat-angular
```
Expected: all succeed.

- [ ] **Step 2: e2e — ag-ui then chat (free ports first)**

Run:
```bash
for p in 4201 4200 8000 2024; do lsof -ti:$p | xargs kill -9 2>/dev/null; done; sleep 2
npx nx e2e examples-ag-ui-angular
for p in 4201 4200 8000 2024; do lsof -ti:$p | xargs kill -9 2>/dev/null; done; sleep 2
npx nx e2e examples-chat-angular
```
Expected: ag-ui 28/28, chat 42/42. (If a chat spec times out on first run, re-run once — the aimock harness is occasionally flaky on cold start; a clean second run is authoritative.)

- [ ] **Step 3: Live Chrome smoke (ag-ui dev server)**

Start the ag-ui dev server with keys (Maps + OpenAI) per the repo runbook, then in Chrome verify:
1. `/sidebar` (App mode off) → open "More prompts": menu is in `.chat-overlay-container`, fully within the viewport, NOT clipped by the panel.
2. `/embed` → open the input-pill model picker: opens upward, within viewport.
3. Toolbar select (e.g. Effort): opens downward (flips), within viewport.
4. With the More-prompts menu open, scroll the page: the menu repositions to stay anchored (live reposition).
5. Keyboard: ArrowDown into options, Escape closes and returns focus to the trigger.

- [ ] **Step 4: Final commit (if any incidental fixes were needed)**

```bash
git add -A
git commit -m "test(chat): verify hand-rolled overlay across consumers (lint/unit/e2e/live)" || echo "nothing to commit"
git push origin blove/ag-ui-app-mode-promo
```

---

## Notes for the implementer

- Run unit tests with `npx nx test chat -- <pattern>` (vitest filter by filename).
- The embedded-view-then-move-nodes portal pattern (Task 3, `attach()`) is exactly how CDK's `DomPortalOutlet` works — the view stays registered with the host's change detection (so signals inside update), while its DOM nodes live in the pane.
- Do NOT reintroduce `@angular/cdk` anywhere in `libs/chat`. The whole point is zero peer deps.
- Theme tokens (`--ngaf-chat-*`) are on `:root`, so the portaled menu keeps its colors. Consumer width overrides ride on `panelClass` (`welcome-suggestions__menu-panel` in both example apps) — already in place from the prior CDK migration; do not change them.
