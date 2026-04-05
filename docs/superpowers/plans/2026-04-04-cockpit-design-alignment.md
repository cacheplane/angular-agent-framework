# Cockpit Design Alignment + Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the cockpit sidebar with the website's docs sidebar design (collapsible color-coded sections), add mobile responsive layout, and do a full design polish pass.

**Architecture:** Replace the flat `NavigationGroups` component with a collapsible `SidebarNav` matching the website's `DocsSidebarNew` pattern. Add a mobile hamburger menu that reveals the sidebar as a slide-out drawer. Polish the header, mode switcher, and content surfaces to match the website's Mintlify-aligned design.

**Tech Stack:** React, Tailwind, `@cacheplane/design-tokens`

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Redesign with collapsible sections |
| Rewrite | `apps/cockpit/src/components/sidebar/navigation-groups.tsx` | Collapsible section groups with color-coded headers |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Mobile responsive layout, hamburger toggle |
| Modify | `apps/cockpit/src/app/cockpit.css` | Mobile breakpoints, sidebar drawer |
| Modify | Various test files | Update for new structure |

---

### Task 1: Rewrite NavigationGroups with collapsible sections

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/navigation-groups.tsx`

- [ ] **Step 1: Rewrite with collapsible section groups**

Read the current file. Replace with a design matching the website's `DocsSidebarNew`:

- Each product (Deep Agents, LangGraph) becomes a top-level section group
- Within each product, "Getting started" and "Core capabilities" become collapsible sub-sections
- Section headers are monospace, uppercase, color-coded:
  - Deep Agents sections: `var(--ds-angular-red)` (red — Angular-focused)
  - LangGraph sections: `var(--ds-accent)` (blue — LangGraph-focused)
- Collapse arrow (▾) that rotates on toggle
- Active link: `var(--ds-accent)` text + `var(--ds-accent-surface)` background
- Inactive links: `var(--ds-text-secondary)`, hover `var(--ds-text-primary)`
- Default state: all sections open

The component keeps its existing props (`tree: NavigationProduct[]`, `currentEntry: CockpitManifestEntry`).

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/sidebar/navigation-groups.tsx
git commit -m "feat(cockpit): redesign sidebar with collapsible color-coded sections"
```

---

### Task 2: Update CockpitSidebar layout

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

- [ ] **Step 1: Update sidebar to match website docs sidebar layout**

Changes:
- Add `overflow-y-auto` for scroll when nav is long
- Make sticky positioning work: `style={{ position: 'sticky', top: 0, minHeight: '100vh' }}`
- Remove the `content-start` class (was pushing everything to top)
- Add proper padding and spacing matching the website (py-6, px-0 for sections to go edge-to-edge)
- Keep "COCKPIT" label and LanguagePicker in header

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx
git commit -m "feat(cockpit): update sidebar layout with sticky scroll"
```

---

### Task 3: Add mobile responsive layout

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css`

- [ ] **Step 1: Add mobile hamburger + sidebar drawer to CockpitShell**

The shell currently uses `grid grid-cols-[18rem_minmax(0,1fr)]` which breaks on mobile. Changes:

- Add `isSidebarOpen` state
- On mobile (<768px): hide sidebar, show hamburger button in header
- Hamburger click toggles a fixed overlay sidebar drawer
- On desktop (>=768px): show sidebar normally, hide hamburger
- The grid becomes responsive: `grid md:grid-cols-[18rem_minmax(0,1fr)]`

Add a hamburger button component inline (SVG icon, no new file needed).

- [ ] **Step 2: Add mobile CSS**

In `cockpit.css`, add responsive styles:

```css
/* Mobile sidebar overlay */
@media (max-width: 767px) {
  .cockpit-sidebar-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
  }

  .cockpit-sidebar-drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 18rem;
    z-index: 50;
    overflow-y: auto;
    background: var(--ds-glass-bg);
    backdrop-filter: blur(var(--ds-glass-blur));
    border-right: 1px solid var(--ds-glass-border);
    box-shadow: var(--ds-glass-shadow);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/app/cockpit.css
git commit -m "feat(cockpit): add mobile responsive layout with sidebar drawer"
```

---

### Task 4: Design polish pass

**Files:**
- Modify: Various components for visual refinements

- [ ] **Step 1: Polish header**

In `cockpit-shell.tsx`, update the header:
- Add a subtle bottom border: `border-b border-[var(--ds-glass-border)]`
- Make the breadcrumb/title area use serif font for the title
- Add padding bottom for separation

- [ ] **Step 2: Polish mode switcher for mobile**

The mode switcher pills may overflow on small screens. Make them scrollable:
- Wrap in a container with `overflow-x-auto` on mobile

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/
git commit -m "feat(cockpit): design polish pass for header and mobile"
```

---

### Task 5: Fix tests and verify

- [ ] **Step 1: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`

- [ ] **Step 2: Fix failures from sidebar restructure**

The sidebar tests may reference old element structures. Update for collapsible sections.

- [ ] **Step 3: Visual verification at multiple viewports**

Check at:
- 1440x900 (desktop)
- 768x1024 (tablet)
- 375x812 (mobile)

- [ ] **Step 4: Push**

```bash
git push
```
