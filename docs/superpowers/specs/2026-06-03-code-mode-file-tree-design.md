# Code Mode File Tree — Design Spec

**Date:** 2026-06-03
**Status:** Design — pending review
**Scope:** `apps/cockpit` Code-mode UI only. No changes to `libs/*`, `content-bundle.ts`, or `cockpit-registry`.

## Goal

Give Code mode a VS Code / Zed–style **file tree on the left of the tab strip** at desktop widths, so multi-file capabilities (Angular + Python + prompt) are oriented at a glance, while preserving the current tab interaction for fast file switching. Below the responsive breakpoint the tree auto-hides and Code mode falls back to today's tabs-only layout. The user can also collapse the tree explicitly at any width.

This is purely a layout enrichment of an existing mode — no new data model, no new content bundle, no new dependencies.

## Direction (validated via mockups)

Chosen option: **B — tree opens tabs (VS Code / Zed style)**, refined with:

- **All files from the content bundle pre-opened as tabs on first load.** Matches today's behavior ("everything is visible") and adds open/close semantics only as a *capability*, not a forced workflow. The first `codeAssetPath` is the initial active tab.
- **No persistence.** Each capability navigation resets to all-tabs-open. Closed-tab state is not stored in `localStorage` or cookies. (Collapse state of the tree itself *is* persisted — see §4.)
- **Tree on the LEFT of the tabs**, full-height for the Code-mode pane. Tabs and code area both sit right of the tree.

## Layout & breakpoints

```
┌─────────────────────────────────────────────────────────┐
│ Tree header                  │ Tab strip                │
│ (collapse chevron, label)    │ (file tabs, optional × ) │
├──────────────────────────────┼──────────────────────────┤
│ file-tree rows               │ Code block (active tab)  │
│ folders + files              │                          │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

- **`lg:` (≥1024px):** tree visible by default at `width: 220px`, sharing the Code-mode pane's full height. The tree's right border meets the tab-strip's bottom border so the two read as one IDE-like surface.
- **<`lg:`:** tree auto-hidden. Tab strip + code area take the full pane width — i.e. today's layout. No mobile overlay (the cockpit shell's main sidebar already handles narrow-viewport navigation; adding a second overlay would be noisy).
- **Explicit collapse toggle:** chevron buttons on the tree header *and* on the tab-strip's left edge (visible only when the tree is expanded vs. collapsed respectively). State stored in `localStorage` under `cockpit:codeTree:collapsed`. The Tailwind `lg:` media query and the explicit toggle compose: a user can collapse at any width, and the tree only auto-shows at `lg:` when not explicitly collapsed.
- **Transition:** 200ms CSS width transition on the tree, so the collapse/expand isn't a layout jump.

## Tree content & organization

The tree shows only files the content bundle already provides — `codeAssetPaths` + `backendAssetPaths` + `promptFiles`. No new file-system walking; no `package.json`/`tsconfig.json` noise.

Each path is **trimmed of the capability's common prefix** (e.g. `cockpit/deep-agents/planning/`), then organized as folder/file rows grouped under their language root:

```
▾ angular/src/app
    planning.component.ts        TS
    app.config.ts                TS
  ▾ views
      plan-checklist.component.ts  TS
▾ python/src
    graph.py                     PY
▾ prompts
    planning.md                  MD
```

Rules:

- **Folder rows are click-collapsible.** Default expanded. Collapse state is per-folder in component state (not persisted).
- **File rows render the existing language chip** (`TS` / `PY` / `MD` / fallback) in `.doc-codeblock__lang` style, right-aligned in the row.
- **Active file** gets a 2px `--ds-accent` left border, `--ds-text-primary` text, and a subtle accent-surface row background.
- **Common-prefix trimming** is per-capability: the longest path segment shared by all paths in the bundle. If trimming leaves the tree with only loose leaves (e.g. just `planning.md` and `graph.py`), display them as a flat list under a `files` group header rather than synthesizing folders.

## Tabs & lifecycle

The Code-mode component owns explicit `openPaths` + `activePath` state (replacing today's `Tabs.defaultValue` usage). Radix `Tabs` continues to provide the tab strip itself.

- **Initial state:** on capability load, `openPaths = [...codeAssetPaths, ...backendAssetPaths, ...promptPaths]` (preserving today's order) and `activePath = openPaths[0]`.
- **Click a tree row:**
  - If `path` is already in `openPaths` → set `activePath = path` (just activate).
  - If not → push to `openPaths` and set `activePath = path`.
- **Tab close (×) button:** appears on hover. Clicking removes the path from `openPaths`. If the closed tab was active, activate its left neighbor; if it was the leftmost, activate the new leftmost.
- **Closing the last tab:** code area shows an empty state ("Select a file from the tree to begin") with a faint chevron pointing left toward the tree. The tab strip becomes empty (just the collapse chevron).
- **No keyboard shortcuts** in this iteration. (Cmd/Ctrl+W to close, etc., can land in a follow-up.)

## Visual integration

Tree and tab strip share the cockpit's chat-aligned dark palette and existing tokens. No new colors:

- Tree background: `var(--ds-surface)` with the same right border (`var(--ds-border)`) the sidebar uses.
- Tree header (where the collapse chevron lives): same height as the tab strip (~34px), `var(--ds-surface-tinted)` background, `border-bottom: 1px solid var(--ds-border)`.
- File rows: mono font for the filename (`var(--font-mono)`), 12px size, line-height 1.7 — same scale as Docs prose code chips.
- Lang chip on rows: reuses `.doc-codeblock__lang` styling.
- Active tree row: `border-left: 2px solid var(--ds-accent)`; row background `var(--ds-accent-surface)`; text `var(--ds-text-primary)`.
- Hover tree row: text `var(--ds-text-primary)`, no background change (subtle).
- Folder chevron: a 9px caret in `var(--ds-text-muted)`, rotates 90° when collapsed.
- Tab strip and code block keep the styles from the merged redesign (`.doc-codeblock`, the `.cockpit-prose--code` 56rem wrapper for the code body, etc.) — *only* the surrounding tree is new.

When the tree is collapsed, an expand chevron sits flush at the left edge of the tab strip in the same color treatment as the active-tab accent, so it reads as a discoverable toggle rather than dead space.

## Components & file structure

| File | Change | Responsibility |
|------|--------|----------------|
| `apps/cockpit/src/components/code-mode/file-tree.tsx` | **NEW** | Pure presentational tree. Takes `paths`, `activePath`, emits `onSelect(path)`. Owns folder-collapse state internally. |
| `apps/cockpit/src/components/code-mode/file-tree.spec.tsx` | **NEW** | Renders the tree from a known path list; click → emits `onSelect` with the right path; folder header click toggles its children's visibility. |
| `apps/cockpit/src/components/code-mode/code-mode.tsx` | Modify | Adds `openPaths` + `activePath` state, renders the `<FileTree>` inside a responsive `lg:grid-cols-[220px_1fr]` wrapper, threads `onSelect` from tree to state, adds the collapse-chevron buttons, hooks `localStorage` for tree-collapsed. The existing `CodeFileContent` and Radix `Tabs` structure stays. |
| `apps/cockpit/src/components/code-mode/code-mode.spec.tsx` | Modify | Adds assertions for (a) all-files-pre-opened initial state, (b) closing a tab removes it from the strip and selects the neighbor, (c) tree click activates an existing tab without duplicating, (d) closing the last tab renders the empty state. |

Internal helper to keep `file-tree.tsx` small: a pure `buildTree(paths: string[])` function (also in `file-tree.tsx` or in a `file-tree.utils.ts` sibling if it grows >30 lines) that returns a discriminated `Folder | File` node array used by the renderer. This makes the prefix-trimming and folder-grouping testable in isolation.

## Out of scope

- File-system walking to surface package.json / tsconfig.json / additional adjacent files.
- Drag-to-reorder tabs.
- Keyboard shortcuts (Cmd+W close, Cmd+P quick-open, etc.).
- Cross-capability persistence of which tabs were closed.
- Resizable tree width (drag-to-resize). Fixed 220px.
- Mobile / overlay tree on `<lg:` viewports.
- Changes to `content-bundle.ts`, the registry, or the markdown renderer.

## Risks & notes

- **`localStorage` is client-only**, but Code mode is already a `'use client'` component so this is fine. Read on mount; SSR sees the default (tree expanded at `lg:`).
- **Initial-render flash:** Code mode is `'use client'`, so on first paint the tree renders in its default (expanded at `lg:`) before the `localStorage` value is read. A one-frame flash is acceptable for a dev-tool surface; no cookie-based SSR hydration is added in this iteration.
- **Common-prefix trimming** edge case: paths with no common prefix (rare, but possible if a capability mixes paths) render as a flat list under a `files` header — see §3.
- **No new dependencies.** Tailwind `lg:` plus React state is sufficient; no `react-resizable-panels`, no `allotment`.
- **Light-mode preserved.** All colors via tokens; verify both themes.

## Verification

Manual:
- Serve cockpit, visit `deep-agents/core-capabilities/planning`, switch to **Code** mode.
- At ≥1024px: tree shows; clicking a tree row activates the matching tab; closing a tab removes it; tree row stays in tree; re-click in tree re-activates. Toggle the chevron — tree collapses with a 200ms transition; tab strip widens. Refresh — collapse state restored.
- At <1024px: tree hidden, current layout intact. Resize: tree appears/disappears smoothly at the breakpoint *unless* the user explicitly collapsed it (in which case it stays collapsed regardless).
- Toggle the cockpit theme — tree colors flip correctly.

Tests (`vitest` + jsdom, established `createRoot/act` style):
- `file-tree.spec.tsx`: 4–6 focused tests on tree rendering and onSelect emission.
- `code-mode.spec.tsx`: extend with the 4 assertions above. Existing assertions (Shiki render, file label, Copy analytics) continue to pass.
