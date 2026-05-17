# Chat sidenav polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the chat-sidenav so the minimized state is functionally useful (icon rail), add a footer with left + right slots, and promote "New chat" + "New project" buttons to match the chat-input pill family.

**Architecture:** All changes are within `libs/chat`'s `chat-sidenav` composition + `chat-project-list` primitive + the demo's `demo-shell.component`. The existing slot infrastructure (`[sidenavHeader]`, `[sidenavPrimary]`, `[sidenavSections]`, `[sidenavAccount]`) is extended with two new selectors: `[sidenavFooterLeft]` and `[sidenavFooterRight]`. The `[sidenavAccount]` slot is preserved for back-compat (deprecated but functional).

**Tech Stack:** Angular 20+ standalone components, signals, CSS custom properties, vitest.

**Spec:** `docs/superpowers/specs/2026-05-17-sidenav-polish-design.md`

**Branch:** `claude/sidenav-polish` (already checked out; spec committed at `b4f521e1`).

---

## File Structure

**Modify:**
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts` — template additions: new footer with `[sidenavFooterLeft]` + `[sidenavFooterRight]` slots; move collapse toggle out of `__topbar` into the footer; CSS class renames on the New chat button
- `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts` — new vitest cases for slot projection, collapse toggle relocation, button styling
- `libs/chat/src/lib/styles/chat-sidenav.styles.ts` — new classes for `.chat-sidenav__footer`, `.chat-sidenav__footer-left`, `.chat-sidenav__footer-right`, `.chat-sidenav__toggle`; new primary-pill style for `.chat-sidenav__action--new`; collapsed-mode rules
- `libs/chat/src/lib/styles/chat-project-list.styles.ts` — restyle the existing "+ New project" button to secondary pill
- `examples/chat/angular/src/app/shell/demo-shell.component.ts` — project a theme-switcher button into `[sidenavFooterRight]`

**Conventions used across tasks:**
- Slot selectors: `[sidenavFooterLeft]`, `[sidenavFooterRight]` (new); `[sidenavAccount]` (kept for back-compat)
- CSS classes: `chat-sidenav__footer`, `chat-sidenav__footer-left`, `chat-sidenav__footer-right`, `chat-sidenav__toggle`
- Existing class `chat-sidenav__action--new` keeps its name but the rendering style changes to primary pill
- Theme-switcher in demo: a 28×28 transparent icon button that toggles `data-color-scheme` and `data-ngaf-chat-theme` on `<html>`. Reuses existing `DemoShell.colorScheme()` + `onColorSchemeChange(next)`.

---

## Task 1: Add footer slots + move collapse toggle into footer

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`:

```ts
describe('ChatSidenavComponent — footer slots', () => {
  it('renders [sidenavFooterLeft] projected content in the left footer position', async () => {
    @Component({
      standalone: true,
      imports: [ChatSidenavComponent],
      template: `<chat-sidenav><span sidenavFooterLeft data-test="left-slot">L</span></chat-sidenav>`,
    })
    class HostLeft {}
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(HostLeft);
    fx.detectChanges();
    const leftContainer = fx.nativeElement.querySelector('.chat-sidenav__footer-left');
    expect(leftContainer).toBeTruthy();
    expect(leftContainer.querySelector('[data-test="left-slot"]')?.textContent).toBe('L');
  });

  it('renders [sidenavFooterRight] projected content in the right footer position', () => {
    @Component({
      standalone: true,
      imports: [ChatSidenavComponent],
      template: `<chat-sidenav><span sidenavFooterRight data-test="right-slot">R</span></chat-sidenav>`,
    })
    class HostRight {}
    TestBed.configureTestingModule({});
    const fx = TestBed.createComponent(HostRight);
    fx.detectChanges();
    const rightContainer = fx.nativeElement.querySelector('.chat-sidenav__footer-right');
    expect(rightContainer).toBeTruthy();
    expect(rightContainer.querySelector('[data-test="right-slot"]')?.textContent).toBe('R');
  });

  it('renders the collapse toggle as the last child of the right footer container', () => {
    TestBed.configureTestingModule({ imports: [ChatSidenavComponent] });
    const fx = TestBed.createComponent(ChatSidenavComponent);
    fx.detectChanges();
    const rightContainer = fx.nativeElement.querySelector('.chat-sidenav__footer-right');
    expect(rightContainer).toBeTruthy();
    const lastChild = rightContainer.children[rightContainer.children.length - 1];
    expect(lastChild?.classList?.contains('chat-sidenav__toggle')).toBe(true);
  });

  it('removes the legacy collapse button from the topbar', () => {
    TestBed.configureTestingModule({ imports: [ChatSidenavComponent] });
    const fx = TestBed.createComponent(ChatSidenavComponent);
    fx.detectChanges();
    const topbar = fx.nativeElement.querySelector('.chat-sidenav__topbar');
    expect(topbar?.querySelector('.chat-sidenav__action--collapse')).toBeFalsy();
  });

  it('clicking the new footer toggle emits modeChange', () => {
    TestBed.configureTestingModule({ imports: [ChatSidenavComponent] });
    const fx = TestBed.createComponent(ChatSidenavComponent);
    fx.detectChanges();
    let captured: string | null = null;
    fx.componentInstance.modeChange.subscribe((m) => (captured = m));
    const toggle = fx.nativeElement.querySelector('.chat-sidenav__toggle') as HTMLButtonElement;
    toggle.click();
    expect(captured).toBe('collapsed');
  });
});
```

Add the missing import at the top of the spec file if not already present:

```ts
import { Component } from '@angular/core';
```

- [ ] **Step 2: Run, confirm failures**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
```

Expected: 5 new failures all citing `.chat-sidenav__footer-left` / `.chat-sidenav__footer-right` / `.chat-sidenav__toggle` selectors not found.

- [ ] **Step 3: Update the chat-sidenav template**

In `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts`:

(a) Remove the collapse toggle from `__topbar` — delete lines 72–91 (the `@if (mode() !== 'drawer') { … }` block):

```ts
// BEFORE (lines 58-107)
<div class="chat-sidenav__topbar">
  <button … (click)="newChat.emit()" …> … </button>
  @if (mode() !== 'drawer') {
    <button … (click)="onCollapseToggle()" …> … </button>
  }
  @if (mode() === 'drawer') {
    <button … (click)="openChange.emit(false)" …>Close</button>
  }
</div>

// AFTER — keep New chat + (drawer-mode) Close; remove collapse toggle
<div class="chat-sidenav__topbar">
  <button
    type="button"
    class="chat-sidenav__action chat-sidenav__action--new"
    (click)="newChat.emit()"
    aria-label="New chat"
    title="New chat"
  >
    <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    <span class="chat-sidenav__action-label">New chat</span>
  </button>
  @if (mode() === 'drawer') {
    <button
      type="button"
      class="chat-sidenav__action chat-sidenav__action--close"
      (click)="openChange.emit(false)"
      aria-label="Close conversations"
      title="Close conversations"
    >
      <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span class="chat-sidenav__action-label">Close</span>
    </button>
  }
</div>
```

(b) Replace the `<div class="chat-sidenav__account">` block (lines 196–198) with the new footer:

```ts
// BEFORE
<div class="chat-sidenav__account">
  <ng-content select="[sidenavAccount]" />
</div>

// AFTER
<div class="chat-sidenav__footer">
  <div class="chat-sidenav__footer-left">
    <ng-content select="[sidenavFooterLeft]" />
  </div>
  <div class="chat-sidenav__footer-right">
    <ng-content select="[sidenavFooterRight]" />
    @if (mode() !== 'drawer') {
      <button
        type="button"
        class="chat-sidenav__toggle"
        (click)="onCollapseToggle()"
        [attr.aria-label]="mode() === 'collapsed' ? 'Expand sidenav' : 'Collapse sidenav'"
        [attr.title]="(mode() === 'collapsed' ? 'Expand sidenav' : 'Collapse sidenav') + ' (⌘B)'"
      >
        @if (mode() === 'collapsed') {
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        } @else {
          <svg class="chat-sidenav__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 6 9 12 15 18"/>
          </svg>
        }
      </button>
    }
  </div>
  <!-- Legacy slot kept for back-compat — see chat-sidenav.styles.ts for visibility rules -->
  <div class="chat-sidenav__account">
    <ng-content select="[sidenavAccount]" />
  </div>
</div>
```

- [ ] **Step 4: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
```

Expected: all 5 new tests pass; no existing tests break.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.ts \
        libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
git commit -m "feat(chat-sidenav): add footer with left/right slots; relocate collapse toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Footer + toggle CSS

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`

- [ ] **Step 1: Find the existing `__account` block and replace with new footer styles**

Open `libs/chat/src/lib/styles/chat-sidenav.styles.ts`. Find the `.chat-sidenav__account` block (currently exists near the bottom). Replace it with:

```css
  .chat-sidenav__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-top: 1px solid var(--ngaf-chat-separator);
    gap: 8px;
    flex-shrink: 0;
  }
  .chat-sidenav__footer-left {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
  }
  .chat-sidenav__footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chat-sidenav__toggle {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .chat-sidenav__toggle:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  /* Collapsed mode: footer becomes a vertical stack; left slot hides. */
  :host([data-mode="collapsed"]) .chat-sidenav__footer {
    flex-direction: column;
    align-items: center;
    padding: 10px 4px;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__footer-left {
    display: none;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__footer-right {
    flex-direction: column;
  }
  /* Legacy [sidenavAccount] slot: kept renderable but visually folded into
     the new footer. Existing consumers' content still projects; the slot
     just renders in the footer-right area visually. */
  .chat-sidenav__account {
    display: none;
  }
  .chat-sidenav__account:has(> *) {
    display: flex;
    align-items: center;
    gap: 4px;
  }
```

- [ ] **Step 2: Build the chat lib + confirm no CSS warnings**

```bash
npx nx build chat
```

Expected: succeeds. The CSS-in-TS string compiles into the bundle.

- [ ] **Step 3: Run all chat lib tests**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/styles/chat-sidenav.styles.ts
git commit -m "feat(chat-sidenav): footer + toggle CSS; collapsed-mode rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: New chat → primary CTA pill

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`
- Modify: `libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts`

- [ ] **Step 1: Write the failing test for visual treatment**

Append to `chat-sidenav.component.spec.ts`:

```ts
describe('ChatSidenavComponent — New chat primary CTA', () => {
  it('renders the new-chat button with a primary-pill styling token', () => {
    // Styles array is the second member of @Component decorator metadata.
    const styles = (ChatSidenavComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    // Primary pill family: matches chat-input send button.
    expect(styles).toMatch(/\.chat-sidenav__action--new[^{]*\{[^}]*background:\s*var\(--ngaf-chat-primary/);
    expect(styles).toMatch(/\.chat-sidenav__action--new[^{]*\{[^}]*border-radius:\s*9999px/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
```

Expected: 1 new failure on the regex.

- [ ] **Step 3: Replace the existing `.chat-sidenav__action--new` rule in chat-sidenav.styles.ts**

Find the existing `.chat-sidenav__action--new` block in `libs/chat/src/lib/styles/chat-sidenav.styles.ts` (search for the class). Replace with:

```css
  .chat-sidenav__action--new {
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    border: 0;
    padding: 10px 16px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-sidenav__action--new:hover {
    filter: brightness(1.1);
  }
  .chat-sidenav__action--new:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  /* Collapsed mode: shrink to 32×32 icon-only square. */
  :host([data-mode="collapsed"]) .chat-sidenav__action--new {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 10px;
    justify-content: center;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action--new .chat-sidenav__action-label {
    display: none;
  }
```

- [ ] **Step 4: Run, confirm pass**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/styles/chat-sidenav.styles.ts \
        libs/chat/src/lib/compositions/chat-sidenav/chat-sidenav.component.spec.ts
git commit -m "feat(chat-sidenav): New chat as primary CTA pill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: New project → secondary pill

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-project-list.styles.ts`
- Modify: `libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.spec.ts` (verify the spec file exists; if not, create a minimal one and add the test there)

- [ ] **Step 1: Locate the current "+ New project" button class**

```bash
grep -n "new-project\|New project\|projectButton" libs/chat/src/lib/primitives/chat-project-list/chat-project-list.component.ts | head -10
```

The button renders inside `chat-project-list`. Find its class name (e.g. `.chat-project-list__new`, `.chat-project-list__create`, etc.).

- [ ] **Step 2: Find current styles for that class**

```bash
grep -n "new\|create\|button" libs/chat/src/lib/styles/chat-project-list.styles.ts | head -20
```

- [ ] **Step 3: Write the failing test**

If a spec exists for chat-project-list, append a test asserting the new pill style. If not, create a minimal one. The exact class name comes from Step 1 — substitute below as `chat-project-list__new`:

```ts
import { describe, it, expect } from 'vitest';
import { ChatProjectListComponent } from './chat-project-list.component';

describe('ChatProjectListComponent — New project secondary pill', () => {
  it('renders the new-project button with secondary-pill styling', () => {
    const styles = (ChatProjectListComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.chat-project-list__new[^{]*\{[^}]*background:\s*var\(--ngaf-chat-surface/);
    expect(styles).toMatch(/\.chat-project-list__new[^{]*\{[^}]*border-radius:\s*9999px/);
    expect(styles).toMatch(/\.chat-project-list__new[^{]*\{[^}]*border:\s*1px solid var\(--ngaf-chat-separator/);
  });
});
```

- [ ] **Step 4: Run, confirm failure**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/primitives/chat-project-list/
```

Expected: 1 new failure.

- [ ] **Step 5: Update the class in chat-project-list.styles.ts**

Replace the current styling for the "+ New project" button (class name from Step 1) with:

```css
  .chat-project-list__new {
    background: var(--ngaf-chat-surface);
    color: var(--ngaf-chat-text-muted);
    border: 1px solid var(--ngaf-chat-separator);
    padding: 8px 14px;
    border-radius: 9999px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
  }
  .chat-project-list__new:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  /* Collapsed-mode shrink applied via the sidenav host attribute; the
     chat-project-list component sees the host data-mode through CSS
     custom property cascade, but its own host attribute also receives
     a data-collapsed signal when relevant. For now, the sidenav handles
     the icon-only state by wrapping this primitive in a container that
     applies width override. */
```

> **Note:** if the chat-project-list doesn't know it's collapsed (i.e. the sidenav's `data-mode="collapsed"` doesn't cascade because the primitive uses Angular view encapsulation), you may need to add a `chatProjectListCompact` host attribute via the sidenav template. Check this in Step 6 and adapt if needed.

- [ ] **Step 6: Run, confirm pass + visual verification**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run src/lib/primitives/chat-project-list/
```

Expected: test passes. Then verify visually in the running dev stack (http://localhost:4200/embed):
- Expanded mode: "+ New project" is a muted dark pill with 1px border, smaller than New chat
- Collapsed mode: pill should shrink (may need follow-up if cascade doesn't reach the primitive)

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/styles/chat-project-list.styles.ts \
        libs/chat/src/lib/primitives/chat-project-list/
git commit -m "feat(chat-project-list): New project as secondary pill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Demo wires theme switcher into sidenavFooterRight

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Locate where the demo-shell renders `<chat-sidenav>`**

```bash
grep -n "chat-sidenav\|<chat-sidenav" examples/chat/angular/src/app/shell/demo-shell.component.ts | head -5
```

- [ ] **Step 2: Add a theme-switcher button projected into the right slot**

Find the `<chat-sidenav>` opening tag in the template. Add a child element with the `sidenavFooterRight` attribute selector:

```html
<chat-sidenav ...existing inputs...>
  <button
    sidenavFooterRight
    type="button"
    class="demo-shell__theme-toggle"
    [attr.aria-label]="colorScheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    (click)="onColorSchemeChange(colorScheme() === 'dark' ? 'light' : 'dark')"
  >
    @if (colorScheme() === 'dark') {
      <!-- Sun icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    } @else {
      <!-- Moon icon -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    }
  </button>
  ...existing slot projections...
</chat-sidenav>
```

- [ ] **Step 3: Add the button's CSS to the same component's styles array**

Find the `styles: [`...`]` block on `DemoShell`. Add:

```css
.demo-shell__theme-toggle {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--ngaf-chat-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.demo-shell__theme-toggle:hover {
  background: var(--ngaf-chat-surface-alt);
  color: var(--ngaf-chat-text);
}
```

- [ ] **Step 4: Verify in the running dev stack**

Open http://localhost:4200/embed. The footer of the sidenav should now show: empty left side, theme button + collapse toggle on the right. Click the theme button — page flips light/dark. Collapse the sidenav — theme button + toggle should stack vertically.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts
git commit -m "feat(examples-chat): demo wires theme switcher into sidenav footer-right

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Collapsed-mode polish — search button icon-only

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-sidenav.styles.ts`

- [ ] **Step 1: Add collapsed rules for the Search button**

Append to `libs/chat/src/lib/styles/chat-sidenav.styles.ts` (near the bottom, after existing collapsed-mode rules):

```css
  :host([data-mode="collapsed"]) .chat-sidenav__action--search {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 10px;
    justify-content: center;
    background: transparent;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action--search .chat-sidenav__action-label {
    display: none;
  }
  /* Collapsed: thread list, project list, archived block, sections — all hidden. */
  :host([data-mode="collapsed"]) .chat-sidenav__threads,
  :host([data-mode="collapsed"]) .chat-sidenav__projects,
  :host([data-mode="collapsed"]) .chat-sidenav__archived,
  :host([data-mode="collapsed"]) .chat-sidenav__sections,
  :host([data-mode="collapsed"]) .chat-sidenav__primary {
    display: none;
  }
  /* Collapsed: reduce horizontal padding so 32×32 buttons sit centered. */
  :host([data-mode="collapsed"]) .chat-sidenav__topbar,
  :host([data-mode="collapsed"]) .chat-sidenav__actions {
    padding: 8px 4px;
    align-items: center;
    justify-content: center;
  }
```

- [ ] **Step 2: Verify visually**

Open http://localhost:4200/embed. Click the collapse toggle in the footer. The sidenav should now show:
- Icon-only New chat (primary accent, 32×32 rounded square)
- Icon-only New project (gray, 32×32 rounded square)
- Icon-only Search (transparent, 32×32 rounded square)
- (no threads / projects / archived visible)
- Footer (vertical stack): theme button + collapse toggle

Click the toggle again — sidenav expands back, all content returns.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-sidenav.styles.ts
git commit -m "feat(chat-sidenav): collapsed-mode polish — hide threads/projects, icon-only buttons

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Build verify, lint, push, open PR

**Files:** none — gate task.

- [ ] **Step 1: Full build for chat lib + demo**

```bash
npx nx run-many -t build -p chat,examples-chat-angular
```

Expected: both succeed.

- [ ] **Step 2: Lint both projects**

```bash
npx nx run-many -t lint -p chat,examples-chat-angular
```

Expected: both pass.

- [ ] **Step 3: Full vitest run for chat lib**

```bash
cd libs/chat && ../../node_modules/.bin/vitest run
```

Expected: all chat lib tests pass. Should be ~744+ (5 new in this PR).

- [ ] **Step 4: API docs regen (defense against the drift class we hit twice this session)**

```bash
npm run generate-api-docs
git status --short
```

If there are any modified api-docs JSON files, stage and amend the previous commit OR add a separate "chore(docs): regenerate api-docs" commit per local convention. Look at recent git history (`git log --oneline -5`) for the naming pattern.

- [ ] **Step 5: Sanity grep**

```bash
grep -rn "sidenavFooterLeft\|sidenavFooterRight" libs/chat/src/ examples/chat/angular/src/
```

Expected: matches in chat-sidenav.component.ts (declarations) AND demo-shell.component.ts (consumer).

```bash
grep -rn "chat-sidenav__toggle\b" libs/chat/src/
```

Expected: matches in chat-sidenav.styles.ts (CSS) AND chat-sidenav.component.ts (template).

- [ ] **Step 6: Push**

```bash
git push -u origin claude/sidenav-polish
```

- [ ] **Step 7: Open PR**

```bash
gh pr create --head claude/sidenav-polish --title "feat(chat-sidenav): polish — icon rail collapsed, footer slots, primary/secondary pills" --body "$(cat <<'EOF'
## Summary

Sub-project A of a two-part demo UX polish pass.

- **Minimized sidenav** becomes an icon rail (actions-only — no threads). New chat / New project / Search render as 32×32 icon-only rounded squares; threads/projects/archived hide. Tooltips on hover via native \`title\` attribute.
- **Footer** gets two new ng-content slots: \`[sidenavFooterLeft]\` + \`[sidenavFooterRight]\`. Theme switcher lives in the right slot (consumer-provided by the canonical demo). Expand/collapse toggle moves from the topbar into the right slot's last child (lib-rendered).
- **New chat** = primary CTA pill (filled accent fill, biggest button in sidenav, matches chat-input send button family).
- **New project** = secondary pill (muted dark fill, 1px border, smaller text).
- Legacy \`[sidenavAccount]\` slot kept for back-compat (visually folded into footer-right).

## Why
User reviewed production demo and flagged the minimized sidenav as "not usable" (3 icons with no path to start a new chat or see threads), the New chat affordance as missing/invisible at the top level, and the New project styling as not aligned with the chat-input pill family.

## Behavior
| State | What's visible |
|---|---|
| Expanded | New chat (primary pill) → New project (secondary pill) → Search → RECENT list → footer (left empty, right: theme + expand toggle) |
| Collapsed | Icon-only buttons stacked: New chat (accent) → New project (gray) → Search → empty → footer (vertical: theme + expand). Threads/projects hidden. |
| Drawer (mobile) | Same as expanded; no minimize toggle |

## Test plan
- [x] 5 new chat-sidenav.component.spec.ts cases: footer slots project content; collapse toggle moved to right slot; topbar collapse button removed; toggle click emits modeChange; New chat primary-pill CSS asserted
- [x] 1 new chat-project-list.component.spec.ts case: New project secondary-pill CSS asserted
- [x] \`npx nx build chat\` succeeds
- [x] \`npx nx build examples-chat-angular\` succeeds
- [x] \`npx nx lint chat\` + lint examples-chat-angular pass
- [x] Manual visual: expanded + collapsed modes match the brainstorm mockup
- [x] Theme switcher in footer-right toggles light/dark
- [ ] CI green

## Out of scope (sub-project B — separate PR)
- More prompts dropdown width / visuals
- Scroll fade above chat input
- Message-actions-bar padding

Spec: \`docs/superpowers/specs/2026-05-17-sidenav-polish-design.md\`
Plan: \`docs/superpowers/plans/2026-05-17-sidenav-polish.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Watch CI; merge on green**

```bash
gh pr checks <PR_NUMBER>
gh pr merge <PR_NUMBER> --squash --delete-branch
```

After merge, the diff touches `libs/chat/` → `demo_changed=true` on main's CI → demo.cacheplane.ai redeploys automatically.

---

## Notes for the executing engineer

- **Slot projection requires the directive selector to be an attribute on a child element of `<chat-sidenav>`.** Example: `<button sidenavFooterRight>...</button>` — NOT a self-closing element selector.
- **The `[sidenavAccount]` slot is preserved.** Any existing consumer projecting into it still renders; its container is folded into the footer-right area via CSS (`display: flex` when it has children, `display: none` otherwise via `:has()`). Don't delete the slot — just adapt its CSS.
- **The expand toggle is lib-rendered, not consumer-projected.** It always appears as the last child of `.chat-sidenav__footer-right`, after any consumer-provided buttons. This is intentional so the toggle is always present in the right place.
- **Cmd/Ctrl+B keyboard shortcut** for collapse-toggle is preserved (existing logic in the constructor); no changes needed.
- **API docs drift** has hit this repo twice in recent sessions. The plan's Task 7 Step 4 includes a regen check as defense.
