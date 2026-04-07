# Cockpit UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved cockpit UI refresh so the shell becomes a full-height, website-aligned product surface with `Run`, `Code`, and `Docs` modes, a grouped left rail, a custom language picker, an IDE-like code tab strip, and a prompt slide-over.

**Architecture:** Keep the existing manifest-driven route-resolution and presentation model. Refactor the shell into a layout-oriented React composition where the left rail stays stable and the main workspace swaps between mode-specific views. Prompt assets should move out of the main pane composition into a slide-over interaction owned by the shell.

**Tech Stack:** Next.js app router, React, existing cockpit shell components, Nx, Vitest, Playwright, existing cockpit registry/docs metadata.

---

### Task 1: Lock The Shell Composition Contract

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/lib/cockpit-page.ts`
- Test: `apps/cockpit/src/components/pane-rendering.spec.tsx`

- [ ] **Step 1: Write failing tests for the new top-level shell structure**

Add or update tests to assert:
- left rail renders once and remains present across mode changes
- primary modes are exactly `Run`, `Code`, and `Docs`
- `Run` is active by default
- prompt assets are not rendered as a primary pane in the default shell body

- [ ] **Step 2: Run the targeted shell test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/pane-rendering.spec.tsx`

Expected: fail because the current shell still renders docs/code/prompt panes inline and does not expose the new mode model.

- [ ] **Step 3: Refactor `cockpit-shell.tsx` into stable rail + mode workspace composition**

Implement:
- stable left rail region
- top workspace header
- primary mode switch
- mode-specific body composition

- [ ] **Step 4: Re-run the shell test**

Run: `npx vitest run apps/cockpit/src/components/pane-rendering.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/lib/cockpit-page.ts apps/cockpit/src/components/pane-rendering.spec.tsx
git commit -m "feat: restructure cockpit shell layout"
```

### Task 2: Build The Stable Left Rail

**Files:**
- Create: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- Create: `apps/cockpit/src/components/sidebar/cockpit-sidebar.spec.tsx`
- Create: `apps/cockpit/src/components/sidebar/language-picker.tsx`
- Create: `apps/cockpit/src/components/sidebar/language-picker.spec.tsx`
- Create: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`
- Modify: `apps/cockpit/src/components/navigation/navigation-tree.tsx`

- [ ] **Step 1: Write failing component tests for grouped navigation and custom language picker**

Cover:
- grouped section headers render (`Deep Agents`, `LangGraph`)
- current entry is highlighted
- language picker opens a custom menu instead of rendering a native select
- current language is reflected in the trigger

- [ ] **Step 2: Run the sidebar tests to verify they fail**

Run: `npx vitest run apps/cockpit/src/components/sidebar/cockpit-sidebar.spec.tsx apps/cockpit/src/components/sidebar/language-picker.spec.tsx`

Expected: fail because these components do not exist yet.

- [ ] **Step 3: Implement the left rail components**

Use:
- grouped navigation
- custom popover/dropdown language picker
- minimal supporting copy

- [ ] **Step 4: Re-run the sidebar tests**

Run: `npx vitest run apps/cockpit/src/components/sidebar/cockpit-sidebar.spec.tsx apps/cockpit/src/components/sidebar/language-picker.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/sidebar apps/cockpit/src/components/navigation/navigation-tree.tsx
git commit -m "feat: add cockpit sidebar navigation and language picker"
```

### Task 3: Implement The Primary Mode Switch

**Files:**
- Create: `apps/cockpit/src/components/modes/mode-switcher.tsx`
- Create: `apps/cockpit/src/components/modes/mode-switcher.spec.tsx`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Write the failing test for mode switching**

Cover:
- only `Run`, `Code`, and `Docs` are shown
- `Run` is active by default
- clicking another mode updates visible content

- [ ] **Step 2: Run the mode switcher test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/modes/mode-switcher.spec.tsx`

Expected: fail because the component does not exist yet.

- [ ] **Step 3: Implement the mode switcher and integrate it into the shell**

- [ ] **Step 4: Re-run the mode switcher test**

Run: `npx vitest run apps/cockpit/src/components/modes/mode-switcher.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/modes apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat: add cockpit primary mode switching"
```

### Task 4: Rebuild Run Mode As The Default Live Surface

**Files:**
- Create: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Create: `apps/cockpit/src/components/run-mode/run-mode.spec.tsx`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Write a failing test for run-mode default rendering**

Cover:
- run surface renders by default
- compact supporting context renders beside or below the surface
- docs/code body is not shown until mode changes

- [ ] **Step 2: Run the run-mode test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/run-mode/run-mode.spec.tsx`

Expected: fail because the run mode component does not exist yet.

- [ ] **Step 3: Implement run mode**

Keep it simple:
- dominant live surface
- minimal supporting context
- no extra nested card stacks

- [ ] **Step 4: Re-run the run-mode test**

Run: `npx vitest run apps/cockpit/src/components/run-mode/run-mode.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/run-mode apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat: add default cockpit run mode"
```

### Task 5: Rebuild Code Mode As A Tabbed IDE Surface

**Files:**
- Create: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Create: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`
- Modify: `apps/cockpit/src/components/code-pane/code-pane.tsx`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Write failing tests for the approved code-mode behavior**

Cover:
- relevant files render as tabs across the top of the editor
- there is only one active file open at a time
- no left-side file column is rendered in code mode
- switching tabs updates the visible file content

- [ ] **Step 2: Run the code-mode test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

Expected: fail because current code mode does not exist.

- [ ] **Step 3: Implement the code-mode component**

Use:
- manifest-provided relevant files
- top tab strip
- single active file model
- editor header with full file path

- [ ] **Step 4: Re-run the code-mode test**

Run: `npx vitest run apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/code-mode apps/cockpit/src/components/code-pane/code-pane.tsx apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat: implement cockpit code mode"
```

### Task 6: Rebuild Docs Mode As A Clean Implementation Guide

**Files:**
- Create: `apps/cockpit/src/components/docs-mode/docs-mode.tsx`
- Create: `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx`
- Modify: `apps/cockpit/src/components/docs-pane/docs-pane.tsx`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Write failing tests for docs-mode rendering**

Cover:
- docs mode reads as a document page, not a dashboard of panes
- explanation content renders with a strong title and body
- inline code snippets and prompt copy affordances can appear

- [ ] **Step 2: Run the docs-mode test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx`

Expected: fail because the new docs mode component does not exist.

- [ ] **Step 3: Implement docs mode**

Keep it simple:
- document-like layout
- explanation first
- inline code and copy affordances where useful

- [ ] **Step 4: Re-run the docs-mode test**

Run: `npx vitest run apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/docs-mode apps/cockpit/src/components/docs-pane/docs-pane.tsx apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat: implement cockpit docs mode"
```

### Task 7: Move Prompt Assets Into A Responsive Slide-Over

**Files:**
- Create: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx`
- Create: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`
- Modify: `apps/cockpit/src/components/prompt-pane/prompt-pane.tsx`
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Write failing tests for prompt drawer behavior**

Cover:
- clicking `Open prompt assets` opens the drawer
- prompt assets can switch within the drawer
- drawer closes without destroying main mode state
- drawer remains secondary to the main shell

- [ ] **Step 2: Run the prompt-drawer test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`

Expected: fail because the drawer component does not exist.

- [ ] **Step 3: Implement prompt drawer**

Use:
- header CTA trigger
- responsive slide-over positioning
- copy-oriented actions
- prompt asset switching

- [ ] **Step 4: Re-run the prompt-drawer test**

Run: `npx vitest run apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/prompt-drawer apps/cockpit/src/components/prompt-pane/prompt-pane.tsx apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat: add cockpit prompt drawer"
```

### Task 8: Align Styling With The Website Design System

**Files:**
- Modify: `apps/cockpit/src/app/layout.tsx`
- Modify: `apps/cockpit/src/app/page.tsx`
- Modify: `apps/cockpit/src/app/[...slug]/page.tsx`
- Create: `apps/cockpit/src/app/cockpit.css` or equivalent local style module if needed

- [ ] **Step 1: Write a lightweight rendering test for key shell class names or structure**

Cover:
- full-height shell layout
- stable left rail
- top tab strip in code mode
- slide-over prompt container exists

- [ ] **Step 2: Run the styling-oriented rendering test to verify it fails**

Run: `npx vitest run apps/cockpit/src/components/pane-rendering.spec.tsx`

Expected: fail until the new structure is fully reflected.

- [ ] **Step 3: Implement the final shell styling**

Keep to the approved direction:
- full-height application shell
- fewer nested rounded boxes
- stronger typography
- flatter surfaces
- website-aligned dark palette

- [ ] **Step 4: Re-run the rendering test**

Run: `npx vitest run apps/cockpit/src/components/pane-rendering.spec.tsx`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/app apps/cockpit/src/components
git commit -m "feat: style refreshed cockpit shell"
```

### Task 9: Verify The Refreshed Cockpit End To End

**Files:**
- Verify only

- [ ] **Step 1: Run the targeted cockpit component tests**

Run:
`npx vitest run apps/cockpit/src/components/pane-rendering.spec.tsx apps/cockpit/src/components/sidebar/cockpit-sidebar.spec.tsx apps/cockpit/src/components/sidebar/language-picker.spec.tsx apps/cockpit/src/components/modes/mode-switcher.spec.tsx apps/cockpit/src/components/run-mode/run-mode.spec.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`

Expected: all pass

- [ ] **Step 2: Run cockpit test target**

Run: `npx nx test cockpit --skip-nx-cache`

Expected: pass

- [ ] **Step 3: Run cockpit build**

Run: `npx nx build cockpit --skip-nx-cache`

Expected: pass

- [ ] **Step 4: Run cockpit e2e**

Run: `npx nx e2e cockpit --skip-nx-cache`

Expected: pass

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify refreshed cockpit ui"
```
