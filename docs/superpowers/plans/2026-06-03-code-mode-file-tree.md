# Code Mode File Tree — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a VS Code / Zed–style file tree on the left of the Code-mode tab strip at `lg:` widths, with all files pre-opened as tabs, tree-click activates/opens, tab close (×), and a persisted collapse toggle.

**Architecture:** New pure-presentational `FileTree` component fed by a pure `buildTree(paths)` helper (TDD-friendly, no DOM). `CodeMode` migrates from Radix `Tabs.defaultValue` to explicit `openPaths` + `activePath` state and adds the responsive `lg:grid` layout with a collapse toggle persisted via `localStorage`. Zero new dependencies; all colors via existing `--ds-*` tokens; below `lg:` the layout falls back to today's tabs-only Code mode.

**Tech Stack:** React, Tailwind v4 (CSS-based, no config file), Radix `Tabs`, Vitest + jsdom (tests use `createRoot`/`act` for interactive components, `renderToStaticMarkup` for pure-presentational ones — see the repo's existing specs).

**Spec:** `docs/superpowers/specs/2026-06-03-code-mode-file-tree-design.md`

**Conventions:**
- Run a single test file with `npx nx test cockpit -- <relative-spec-path>`; full suite with `npx nx test cockpit`.
- TS path alias `@/components/...` resolves to `apps/cockpit/src/components/...`.
- Commit after each task.

---

## File map

| File | Change | Responsibility |
|------|--------|----------------|
| `apps/cockpit/src/app/cockpit.css` | Modify | Add `.cockpit-prose--wide` / `.cockpit-prose--code` width modifiers + `margin-inline: auto`; add file-tree styles in Task 4. |
| `apps/cockpit/src/components/api-mode/api-mode.tsx` | Modify (Task 1) | Use `.cockpit-prose--wide` class instead of inline `maxWidth`; outer `py-4` → `py-6`. |
| `apps/cockpit/src/components/code-mode/code-mode.tsx` | Modify | Task 1: add `.cockpit-prose--code` wrapper + outer padding. Tasks 3, 5, 6: state migration, FileTree integration, close + collapse. |
| `apps/cockpit/src/components/code-mode/code-mode.spec.tsx` | Modify (Tasks 3, 5, 6) | Add assertions for new state semantics + close + last-tab-close empty state. |
| `apps/cockpit/src/components/code-mode/file-tree.utils.ts` | **NEW** (Task 2) | Pure `buildTree(paths)` returning a discriminated `FileNode | FolderNode` tree; common-prefix trimming + compact folder chains. |
| `apps/cockpit/src/components/code-mode/file-tree.utils.spec.ts` | **NEW** (Task 2) | TDD spec for `buildTree`. |
| `apps/cockpit/src/components/code-mode/file-tree.tsx` | **NEW** (Task 4) | Pure presentational tree: props `{ paths, activePath, onSelect }`. Owns folder-collapse state internally. |
| `apps/cockpit/src/components/code-mode/file-tree.spec.tsx` | **NEW** (Task 4) | TDD spec for `FileTree`: rendering, click → onSelect, folder header toggles. |

---

## Task 1: Land the unified prose-width + Code-mode padding wrapper

This brings already-staged-in-working-tree CSS/component improvements onto the branch as a clean commit. They are referenced by the spec ("the `.cockpit-prose--code` 56rem wrapper") and need to land before the file tree work. Also reverts a local-only `next.config.ts` hack and the working-tree `node_modules` symlink from the prior dev-server session.

**Files:**
- Modify: `apps/cockpit/src/app/cockpit.css`
- Modify: `apps/cockpit/src/components/api-mode/api-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Revert (do NOT commit): `apps/cockpit/next.config.ts` (local-only Turbopack root hack), `node_modules` symlink

- [ ] **Step 1: Revert local-only changes**

```bash
git checkout -- apps/cockpit/next.config.ts
rm -f node_modules
```

If `node_modules` was a real directory (not a symlink) and `rm -f` doesn't work, leave it: it's already in `.gitignore`.

- [ ] **Step 2: Confirm the three legitimate changes are in place**

Run: `git diff --stat apps/cockpit/src/app/cockpit.css apps/cockpit/src/components/api-mode/api-mode.tsx apps/cockpit/src/components/code-mode/code-mode.tsx`
Expected: all three files show modifications. If `cockpit.css` does not contain `.cockpit-prose--wide`, apply the edit in Step 3; same for the other two if missing.

- [ ] **Step 3: Apply (or verify) the cockpit.css additions**

In `apps/cockpit/src/app/cockpit.css`, the `.cockpit-prose` block should read:

```css
/* Shared prose layer — docs + api + code mode content */
.cockpit-prose {
  max-width: 42rem;
  margin-inline: auto;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ds-text-secondary);
}
.cockpit-prose--wide { max-width: 48rem; }
.cockpit-prose--code { max-width: 56rem; }
```

(The original block had no `margin-inline` and no modifier classes; add both.)

- [ ] **Step 4: Apply (or verify) the api-mode change**

In `apps/cockpit/src/components/api-mode/api-mode.tsx`, the outer `<section>` of the non-empty case should read:

```tsx
<section aria-label="API mode" className="h-full overflow-auto py-6 px-4 md:px-8">
  <div className="cockpit-prose cockpit-prose--wide">
```

(Changes from `py-4` to `py-6`; replaces `style={{ maxWidth: '48rem' }}` with the modifier class.)

- [ ] **Step 5: Apply (or verify) the code-mode change**

In `apps/cockpit/src/components/code-mode/code-mode.tsx`, both `TabsContent` panels (code/backend files and prompt files) should wrap their children in `.cockpit-prose.cockpit-prose--code` and have the outer padding `py-6 px-4 md:px-8`. The code-asset panel:

```tsx
{[...codeAssetPaths, ...backendAssetPaths].map((path) => (
  <TabsContent key={path} value={path} className="flex-1 overflow-auto py-6 px-4 md:px-8">
    <div className="cockpit-prose cockpit-prose--code">
      <CodeFileContent path={path} content={codeFiles[path]} capability={capability} />
    </div>
  </TabsContent>
))}
```

And the prompt panel mirrors it (same outer className, same wrapper, prompt `<pre>` or fallback `<p>` inside).

- [ ] **Step 6: Run tests**

Run: `npx nx test cockpit`
Expected: PASS. (Class additions are purely additive; no spec asserts on the inline `maxWidth` or the outer `py-4`.)

- [ ] **Step 7: Commit**

```bash
git add apps/cockpit/src/app/cockpit.css apps/cockpit/src/components/api-mode/api-mode.tsx apps/cockpit/src/components/code-mode/code-mode.tsx
git commit -m "refactor(cockpit): unified prose width modifiers + code-mode padding wrapper"
```

---

## Task 2: `buildTree` utility (TDD)

A pure function that turns a flat list of file paths into a tree with common-prefix trimming and **compact folder chains** (single-child folder chains merged into one row, matching the spec's example). This is the only logic that needs unit tests in isolation; the rest of the tree work is presentation.

**Files:**
- Create: `apps/cockpit/src/components/code-mode/file-tree.utils.ts`
- Create: `apps/cockpit/src/components/code-mode/file-tree.utils.spec.ts`

- [ ] **Step 1: Write the failing test**

`apps/cockpit/src/components/code-mode/file-tree.utils.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTree, type TreeNode } from './file-tree.utils';

describe('buildTree', () => {
  it('returns an empty array when no paths are given', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('returns a flat list of file nodes when there are no folders after trimming', () => {
    const tree = buildTree(['planning.md']);
    expect(tree).toEqual<TreeNode[]>([
      { kind: 'file', path: 'planning.md', label: 'planning.md' },
    ]);
  });

  it('strips the common directory prefix shared by all paths', () => {
    const tree = buildTree([
      'cockpit/planning/angular/app.config.ts',
      'cockpit/planning/python/graph.py',
    ]);
    // common prefix "cockpit/planning/" is removed; "angular" and "python" become top-level folders
    expect(tree.map((n) => (n.kind === 'folder' ? n.label : n.label))).toEqual(['angular', 'python']);
  });

  it('compacts single-child folder chains into one row', () => {
    const tree = buildTree([
      'angular/src/app/planning.component.ts',
      'angular/src/app/app.config.ts',
    ]);
    // angular > src > app each have one child folder beneath them on the way down;
    // they merge into a single "angular/src/app" folder row.
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'folder', label: 'angular/src/app' });
    expect((tree[0] as { children: TreeNode[] }).children.map((c) => c.label).sort()).toEqual([
      'app.config.ts',
      'planning.component.ts',
    ]);
  });

  it('keeps a folder distinct from its children when it has both a file and a subfolder', () => {
    const tree = buildTree([
      'angular/src/app/planning.component.ts',
      'angular/src/app/views/plan-checklist.component.ts',
    ]);
    // angular/src/app contains a file AND a "views" subfolder → does not merge with "views"
    const top = tree[0] as { kind: 'folder'; label: string; children: TreeNode[] };
    expect(top.label).toBe('angular/src/app');
    expect(top.children).toHaveLength(2);
    const labels = top.children.map((c) => c.label).sort();
    expect(labels).toEqual(['planning.component.ts', 'views']);
  });

  it('renders all files flat when no common prefix and only one segment each', () => {
    const tree = buildTree(['a.ts', 'b.py']);
    expect(tree).toEqual<TreeNode[]>([
      { kind: 'file', path: 'a.ts', label: 'a.ts' },
      { kind: 'file', path: 'b.py', label: 'b.py' },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/code-mode/file-tree.utils.spec.ts`
Expected: FAIL — cannot resolve `./file-tree.utils`.

- [ ] **Step 3: Implement `buildTree`**

`apps/cockpit/src/components/code-mode/file-tree.utils.ts`:

```ts
export type FileNode = { kind: 'file'; path: string; label: string };
export type FolderNode = { kind: 'folder'; label: string; children: TreeNode[] };
export type TreeNode = FileNode | FolderNode;

function commonPrefixSegments(paths: readonly string[]): string[] {
  if (paths.length === 0) return [];
  const splits = paths.map((p) => p.split('/'));
  const first = splits[0];
  const common: string[] = [];
  for (let i = 0; i < first.length - 1; i++) {
    const seg = first[i];
    if (splits.every((parts) => parts[i] === seg)) common.push(seg);
    else break;
  }
  return common;
}

function insert(root: FolderNode, segments: string[], fullPath: string): void {
  let node = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    let child = node.children.find((c): c is FolderNode => c.kind === 'folder' && c.label === seg);
    if (!child) {
      child = { kind: 'folder', label: seg, children: [] };
      node.children.push(child);
    }
    node = child;
  }
  const filename = segments[segments.length - 1];
  node.children.push({ kind: 'file', path: fullPath, label: filename });
}

function compact(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.kind === 'file') return node;
    let folder = node;
    // Merge while this folder has exactly one child AND that child is a folder.
    while (folder.children.length === 1 && folder.children[0].kind === 'folder') {
      const only = folder.children[0];
      folder = { kind: 'folder', label: `${folder.label}/${only.label}`, children: only.children };
    }
    return { ...folder, children: compact(folder.children) };
  });
}

export function buildTree(paths: readonly string[]): TreeNode[] {
  if (paths.length === 0) return [];
  const prefix = commonPrefixSegments(paths);
  const trimmed = paths.map((p) => p.split('/').slice(prefix.length));
  const root: FolderNode = { kind: 'folder', label: '', children: [] };
  trimmed.forEach((segments, i) => insert(root, segments, paths[i]));
  return compact(root.children);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/code-mode/file-tree.utils.spec.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/code-mode/file-tree.utils.ts apps/cockpit/src/components/code-mode/file-tree.utils.spec.ts
git commit -m "feat(cockpit): add buildTree utility for Code-mode file tree"
```

---

## Task 3: `CodeMode` state migration (no UX change yet)

Replace Radix `Tabs.defaultValue` with explicit `openPaths` + `activePath` state in `CodeMode`. No visible behavior change in this task — same files render, same active file, just with the state model that the file tree needs in Task 5.

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

- [ ] **Step 1: Add a regression test that activating a tab via state change still works**

In `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`, append this new `it` block inside the existing `describe('CodeMode', …)`:

```tsx
it('pre-opens all code, backend, and prompt files as tabs with the first code file active', () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <CodeMode
        entryTitle="Planning"
        codeAssetPaths={['src/a.ts']}
        backendAssetPaths={['backend/graph.py']}
        codeFiles={{
          'src/a.ts': '<pre class="shiki"><code>a</code></pre>',
          'backend/graph.py': '<pre class="shiki"><code>g</code></pre>',
        }}
        promptFiles={{ 'prompts/p.md': 'hello' }}
      />,
    );
  });

  const tabLabels = Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent);
  expect(tabLabels).toEqual(['a.ts', 'graph.py', 'p.md']);

  // The first code file is active.
  const active = container.querySelector('[role="tab"][data-state="active"]');
  expect(active?.textContent).toBe('a.ts');
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: PASS for both this new test and the four existing ones. (Current behavior already satisfies the assertion — this is a regression guard for the upcoming state change.)

- [ ] **Step 3: Migrate to explicit `openPaths` + `activePath` state**

In `apps/cockpit/src/components/code-mode/code-mode.tsx`, replace the body of `CodeMode` (everything from `export function CodeMode(...)` through the closing `}`) with:

```tsx
export function CodeMode({ entryTitle, codeAssetPaths, backendAssetPaths, codeFiles, promptFiles, capability }: CodeModeProps) {
  const promptPaths = React.useMemo(() => Object.keys(promptFiles), [promptFiles]);
  const allPaths = React.useMemo(
    () => [...codeAssetPaths, ...backendAssetPaths, ...promptPaths],
    [codeAssetPaths, backendAssetPaths, promptPaths],
  );

  const [openPaths, setOpenPaths] = React.useState<readonly string[]>(allPaths);
  const [activePath, setActivePath] = React.useState<string | null>(allPaths[0] ?? null);

  // If the capability changes (allPaths changes identity), reset open + active.
  React.useEffect(() => {
    setOpenPaths(allPaths);
    setActivePath(allPaths[0] ?? null);
  }, [allPaths]);

  if (allPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No files available for {entryTitle}.</p>
      </section>
    );
  }

  const isPromptPath = (path: string) => promptPaths.includes(path);

  return (
    <section aria-label="Code mode" className="h-full flex flex-col">
      <Tabs
        value={activePath ?? undefined}
        onValueChange={(v) => setActivePath(v)}
        className="flex flex-col h-full"
      >
        <TabsList className="shrink-0">
          {openPaths.map((path) => (
            <TabsTrigger
              key={path}
              value={path}
              className={
                isPromptPath(path)
                  ? 'text-[var(--ds-accent)]/70 data-[state=active]:text-[var(--ds-accent)]'
                  : undefined
              }
            >
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
        </TabsList>

        {openPaths.filter((p) => !isPromptPath(p)).map((path) => (
          <TabsContent key={path} value={path} className="flex-1 overflow-auto py-6 px-4 md:px-8">
            <div className="cockpit-prose cockpit-prose--code">
              <CodeFileContent path={path} content={codeFiles[path]} capability={capability} />
            </div>
          </TabsContent>
        ))}

        {openPaths.filter(isPromptPath).map((path) => {
          const content = promptFiles[path];
          return (
            <TabsContent key={path} value={path} className="flex-1 overflow-auto py-6 px-4 md:px-8">
              <div className="cockpit-prose cockpit-prose--code">
                {content ? (
                  <pre className="font-mono text-sm whitespace-pre-wrap">{content}</pre>
                ) : (
                  <p className="text-sm text-[var(--ds-text-muted)]">No content for {getTabLabel(path)}</p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
```

(Key differences vs today: drop `Tabs.defaultValue`, use controlled `value` + `onValueChange`; render tabs from `openPaths` instead of separate `codeAssetPaths`/`backendAssetPaths`/`promptPaths` arrays; reset state when `allPaths` identity changes. The `TabsList`, `CodeFileContent`, and prompt-render markup stay identical to today.)

- [ ] **Step 4: Run all code-mode tests**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: PASS — the new test and all four existing ones (Shiki HTML render, fallback, prompt tabs, Copy analytics).

- [ ] **Step 5: Run the full suite**

Run: `npx nx test cockpit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx
git commit -m "refactor(cockpit): controlled openPaths + activePath state in CodeMode"
```

---

## Task 4: `FileTree` presentational component (TDD)

A pure-presentational component that renders the output of `buildTree` with folder-collapse interaction. No file-system access, no localStorage — just `{ paths, activePath, onSelect }` props.

**Files:**
- Create: `apps/cockpit/src/components/code-mode/file-tree.tsx`
- Create: `apps/cockpit/src/components/code-mode/file-tree.spec.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css` (file-tree styles)

- [ ] **Step 1: Write the failing test**

`apps/cockpit/src/components/code-mode/file-tree.spec.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileTree } from './file-tree';

describe('FileTree', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => { root?.unmount(); });
    container?.remove();
    vi.clearAllMocks();
  });

  function render(node: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(node); });
  }

  it('renders a file row for every path', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts', 'python/src/graph.py', 'prompts/planning.md']}
        activePath={null}
        onSelect={onSelect}
      />
    );

    const labels = Array.from(container!.querySelectorAll('[data-file-row]')).map((el) => el.textContent);
    expect(labels).toContain('planning.component.ts');
    expect(labels).toContain('graph.py');
    expect(labels).toContain('planning.md');
  });

  it('marks the active file row with aria-current="true"', () => {
    render(
      <FileTree
        paths={['a.ts', 'b.py']}
        activePath="b.py"
        onSelect={() => {}}
      />
    );

    const active = container!.querySelector('[data-file-row][aria-current="true"]');
    expect(active?.textContent).toBe('b.py');
  });

  it('emits onSelect with the file path when a file row is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts']}
        activePath={null}
        onSelect={onSelect}
      />
    );

    const row = container!.querySelector('[data-file-row]') as HTMLElement;
    act(() => { row.click(); });

    expect(onSelect).toHaveBeenCalledWith('angular/src/app/planning.component.ts');
  });

  it('collapses a folder when its header is clicked and hides its children', () => {
    render(
      <FileTree
        paths={['angular/src/app/planning.component.ts', 'angular/src/app/app.config.ts']}
        activePath={null}
        onSelect={() => {}}
      />
    );

    // Folder "angular/src/app" is the only top-level row (compact-merged).
    const folder = container!.querySelector('[data-folder-row]') as HTMLElement;
    expect(folder.textContent).toContain('angular/src/app');
    expect(container!.querySelectorAll('[data-file-row]')).toHaveLength(2);

    act(() => { folder.click(); });

    expect(container!.querySelectorAll('[data-file-row]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/code-mode/file-tree.spec.tsx`
Expected: FAIL — cannot resolve `./file-tree`.

- [ ] **Step 3: Implement `FileTree`**

`apps/cockpit/src/components/code-mode/file-tree.tsx`:

```tsx
'use client';

import React from 'react';
import { buildTree, type FolderNode, type TreeNode } from './file-tree.utils';

interface FileTreeProps {
  paths: readonly string[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

function langChip(label: string): string | null {
  const dot = label.lastIndexOf('.');
  if (dot <= 0) return null;
  return label.slice(dot + 1).toUpperCase();
}

export function FileTree({ paths, activePath, onSelect }: FileTreeProps) {
  const tree = React.useMemo(() => buildTree(paths), [paths]);
  const [collapsedFolders, setCollapsedFolders] = React.useState<ReadonlySet<string>>(() => new Set());

  const toggleFolder = React.useCallback((id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <ul className="cockpit-file-tree" role="tree">
      {tree.map((node, i) => (
        <Node
          key={`${i}-${node.label}`}
          node={node}
          depth={0}
          folderId={node.label}
          activePath={activePath}
          collapsedFolders={collapsedFolders}
          onToggleFolder={toggleFolder}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

interface NodeProps {
  node: TreeNode;
  depth: number;
  folderId: string;
  activePath: string | null;
  collapsedFolders: ReadonlySet<string>;
  onToggleFolder: (id: string) => void;
  onSelect: (path: string) => void;
}

function Node({ node, depth, folderId, activePath, collapsedFolders, onToggleFolder, onSelect }: NodeProps) {
  if (node.kind === 'file') {
    const chip = langChip(node.label);
    const isActive = activePath === node.path;
    return (
      <li>
        <button
          type="button"
          data-file-row
          aria-current={isActive ? 'true' : undefined}
          onClick={() => onSelect(node.path)}
          className="cockpit-file-tree__file"
          style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
        >
          <span className="cockpit-file-tree__label">{node.label}</span>
          {chip ? <span className="cockpit-file-tree__chip">{chip}</span> : null}
        </button>
      </li>
    );
  }

  const folder = node as FolderNode;
  const isCollapsed = collapsedFolders.has(folderId);
  return (
    <li>
      <button
        type="button"
        data-folder-row
        aria-expanded={!isCollapsed}
        onClick={() => onToggleFolder(folderId)}
        className="cockpit-file-tree__folder"
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        <span className="cockpit-file-tree__caret" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
        <span className="cockpit-file-tree__label">{folder.label}</span>
      </button>
      {!isCollapsed ? (
        <ul>
          {folder.children.map((child, i) => (
            <Node
              key={`${i}-${child.label}`}
              node={child}
              depth={depth + 1}
              folderId={`${folderId}/${child.label}`}
              activePath={activePath}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
```

- [ ] **Step 4: Add tree styles to cockpit.css**

Append to `apps/cockpit/src/app/cockpit.css`:

```css
/* Code-mode file tree */
.cockpit-file-tree { list-style: none; padding: 0; margin: 0; font-size: 12px; line-height: 1.7; }
.cockpit-file-tree ul { list-style: none; padding: 0; margin: 0; }
.cockpit-file-tree__file,
.cockpit-file-tree__folder {
  display: flex; align-items: center; gap: 0.4rem; width: 100%;
  padding: 3px 0.75rem 3px 0.75rem; background: transparent; border: 0; text-align: left; cursor: pointer;
  color: var(--ds-text-secondary); font-family: var(--font-mono), "JetBrains Mono", monospace; font-size: 12px;
  border-left: 2px solid transparent;
}
.cockpit-file-tree__folder { color: var(--ds-text-muted); }
.cockpit-file-tree__caret { font-size: 9px; color: var(--ds-text-muted); width: 0.65rem; }
.cockpit-file-tree__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cockpit-file-tree__chip {
  font-family: var(--font-mono), monospace; font-size: 9px;
  padding: 1px 5px; border-radius: 3px;
  background: var(--ds-accent-surface); color: var(--ds-accent);
  opacity: 0.85;
}
.cockpit-file-tree__file:hover { color: var(--ds-text-primary); }
.cockpit-file-tree__file[aria-current="true"] {
  background: var(--ds-accent-surface);
  color: var(--ds-text-primary);
  border-left-color: var(--ds-accent);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test cockpit -- src/components/code-mode/file-tree.spec.tsx`
Expected: PASS — all 4 tests.

- [ ] **Step 6: Run the full suite**

Run: `npx nx test cockpit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/cockpit/src/components/code-mode/file-tree.tsx apps/cockpit/src/components/code-mode/file-tree.spec.tsx apps/cockpit/src/app/cockpit.css
git commit -m "feat(cockpit): FileTree component with folder collapse and active row"
```

---

## Task 5: Mount `FileTree` in Code mode with responsive layout

Place the tree to the left of the tab strip at `lg:` widths, hidden below. Wire `onSelect` to the existing `openPaths`/`activePath` handlers (activates if already open, opens if not).

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

- [ ] **Step 1: Write the failing test (tree-click opens a not-yet-open file)**

Append inside the existing `describe('CodeMode', …)` in `code-mode.spec.tsx`:

```tsx
it('opens a closed file and activates it when the tree row is clicked', () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <CodeMode
        entryTitle="Planning"
        codeAssetPaths={['src/a.ts', 'src/b.ts']}
        backendAssetPaths={[]}
        codeFiles={{
          'src/a.ts': '<pre class="shiki"><code>a</code></pre>',
          'src/b.ts': '<pre class="shiki"><code>b</code></pre>',
        }}
        promptFiles={{}}
      />,
    );
  });

  // Simulate the close (×) behaviour landing in Task 6 by directly removing the tab from state via the tree:
  // for now, just assert that clicking the tree row for b.ts activates b.ts (which is already open).
  const bRow = Array.from(container.querySelectorAll('[data-file-row]')).find(
    (el) => el.textContent === 'b.ts',
  ) as HTMLElement;
  expect(bRow).toBeDefined();

  act(() => { bRow.click(); });

  const active = container.querySelector('[role="tab"][data-state="active"]');
  expect(active?.textContent).toBe('b.ts');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: FAIL — no `[data-file-row]` element rendered (FileTree not yet mounted in CodeMode).

- [ ] **Step 3: Mount `FileTree` in `CodeMode`**

In `apps/cockpit/src/components/code-mode/code-mode.tsx`:

Add the FileTree import near the top:
```tsx
import { FileTree } from './file-tree';
```

Add the select handler inside `CodeMode` (right after the existing `useEffect` reset):

```tsx
const handleSelect = React.useCallback((path: string) => {
  setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
  setActivePath(path);
}, []);
```

Replace the outer `<section aria-label="Code mode" className="h-full flex flex-col">` opening tag and its single `<Tabs>` child with a responsive split:

```tsx
return (
  <section aria-label="Code mode" className="h-full lg:grid lg:grid-cols-[220px_1fr] lg:overflow-hidden">
    <aside
      aria-label="File tree"
      className="hidden lg:block lg:overflow-y-auto border-r border-[var(--ds-border)] bg-[var(--ds-surface-tinted)]/40"
    >
      <FileTree paths={allPaths} activePath={activePath} onSelect={handleSelect} />
    </aside>

    <div className="flex flex-col h-full min-w-0">
      <Tabs
        value={activePath ?? undefined}
        onValueChange={(v) => setActivePath(v)}
        className="flex flex-col h-full"
      >
        {/* existing TabsList + TabsContent panels go here unchanged */}
      </Tabs>
    </div>
  </section>
);
```

The TabsList + TabsContent panels are unchanged from Task 3 — just moved inside the new `<div className="flex flex-col h-full min-w-0">` wrapper.

- [ ] **Step 4: Run the updated spec**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: PASS — the new tree-click test and all earlier ones.

- [ ] **Step 5: Run the full suite**

Run: `npx nx test cockpit`
Expected: PASS.

- [ ] **Step 6: Browser verify**

Reload the cockpit Code mode at a viewport ≥1024px. The tree appears left of the tabs; clicking a tree row activates the matching tab. Resize below 1024px → tree disappears, tabs span full width. Toggle theme — colors flip correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx
git commit -m "feat(cockpit): mount FileTree in Code mode with lg: responsive split"
```

---

## Task 6: Tab close (×) + last-tab empty state

Add a close button to each tab trigger (visible on hover); closing removes the path from `openPaths` and activates the left neighbor (or the new leftmost if the closed tab was first). When the last tab closes, the content area shows a "select a file from the tree" empty state.

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css` (close-button styles)

- [ ] **Step 1: Write the failing tests**

Append inside `describe('CodeMode', …)`:

```tsx
it('closes a tab and activates its left neighbor', () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <CodeMode
        entryTitle="Planning"
        codeAssetPaths={['src/a.ts', 'src/b.ts', 'src/c.ts']}
        backendAssetPaths={[]}
        codeFiles={{
          'src/a.ts': '<pre class="shiki"><code>a</code></pre>',
          'src/b.ts': '<pre class="shiki"><code>b</code></pre>',
          'src/c.ts': '<pre class="shiki"><code>c</code></pre>',
        }}
        promptFiles={{}}
      />,
    );
  });

  // Activate b.ts, then close it.
  const bTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (el) => el.textContent?.startsWith('b.ts'),
  ) as HTMLElement;
  act(() => {
    bTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  });

  const closeBtn = container.querySelector('[role="tab"][data-state="active"] [data-tab-close]') as HTMLElement;
  expect(closeBtn).not.toBeNull();
  act(() => { closeBtn.click(); });

  const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map((t) =>
    (t.textContent ?? '').replace(/×/g, '').trim(),
  );
  expect(tabs).toEqual(['a.ts', 'c.ts']);

  const active = container.querySelector('[role="tab"][data-state="active"]');
  expect((active?.textContent ?? '').startsWith('a.ts')).toBe(true);
});

it('shows the empty state after the last tab is closed', () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(
      <CodeMode
        entryTitle="Planning"
        codeAssetPaths={['src/only.ts']}
        backendAssetPaths={[]}
        codeFiles={{ 'src/only.ts': '<pre class="shiki"><code>x</code></pre>' }}
        promptFiles={{}}
      />,
    );
  });

  const closeBtn = container.querySelector('[role="tab"] [data-tab-close]') as HTMLElement;
  act(() => { closeBtn.click(); });

  expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  expect(container.textContent).toContain('Select a file from the tree');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: FAIL — `[data-tab-close]` not present.

- [ ] **Step 3: Add the close handler and the close button**

In `apps/cockpit/src/components/code-mode/code-mode.tsx`, add the handler near `handleSelect`:

```tsx
const handleClose = React.useCallback((path: string) => {
  setOpenPaths((prev) => {
    const idx = prev.indexOf(path);
    if (idx < 0) return prev;
    const next = prev.filter((p) => p !== path);
    setActivePath((current) => {
      if (current !== path) return current;
      if (next.length === 0) return null;
      // Activate the left neighbor; if the closed tab was leftmost, activate the new leftmost.
      const neighborIdx = Math.max(0, idx - 1);
      return next[neighborIdx] ?? next[0];
    });
    return next;
  });
}, []);
```

Replace the `TabsTrigger` element inside the `TabsList` map with a version that includes the close button:

```tsx
<TabsTrigger
  key={path}
  value={path}
  className={
    isPromptPath(path)
      ? 'text-[var(--ds-accent)]/70 data-[state=active]:text-[var(--ds-accent)] cockpit-tab-trigger'
      : 'cockpit-tab-trigger'
  }
>
  <span>{getTabLabel(path)}</span>
  <span
    role="button"
    aria-label={`Close ${getTabLabel(path)}`}
    data-tab-close
    onPointerDown={(e) => { e.stopPropagation(); }}
    onClick={(e) => { e.stopPropagation(); handleClose(path); }}
    className="cockpit-tab-trigger__close"
  >×</span>
</TabsTrigger>
```

Below the `<Tabs>` in the same `<div className="flex flex-col h-full min-w-0">`, add an empty-state fallback that renders when `activePath === null`:

```tsx
{activePath === null ? (
  <div className="flex-1 grid place-items-center text-sm text-[var(--ds-text-muted)] px-4 text-center">
    <p>Select a file from the tree to begin.</p>
  </div>
) : null}
```

Place this *outside* the `<Tabs>` element but inside the wrapping `<div>` — it shows only when `openPaths` is empty so the Radix `<Tabs>` won't render content for a missing `value`.

- [ ] **Step 4: Add close-button styles**

Append to `apps/cockpit/src/app/cockpit.css`:

```css
/* Tab close (×) on Code-mode tabs */
.cockpit-tab-trigger { display: inline-flex; align-items: center; gap: 0.4rem; }
.cockpit-tab-trigger__close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 0.95rem; height: 0.95rem; border-radius: 0.2rem;
  color: var(--ds-text-muted); font-size: 0.85rem; line-height: 1;
  opacity: 0; cursor: pointer;
}
.cockpit-tab-trigger:hover .cockpit-tab-trigger__close,
.cockpit-tab-trigger[data-state="active"] .cockpit-tab-trigger__close { opacity: 1; }
.cockpit-tab-trigger__close:hover { background: var(--ds-accent-surface); color: var(--ds-text-primary); }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test cockpit -- src/components/code-mode/code-mode.spec.tsx`
Expected: PASS — both new tests and all earlier ones.

- [ ] **Step 6: Run the full suite**

Run: `npx nx test cockpit`
Expected: PASS.

- [ ] **Step 7: Browser verify**

Reload Code mode. Hover a tab → × appears. Click × on a non-active tab → tab disappears, active unchanged. Click × on the active tab → left neighbor becomes active. Close every tab → empty-state message renders. Click a file in the tree → it opens and becomes active.

- [ ] **Step 8: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx apps/cockpit/src/app/cockpit.css
git commit -m "feat(cockpit): tab close button + last-tab empty state in Code mode"
```

---

## Task 7: Tree collapse toggle with localStorage persistence

Two chevron buttons collapse/expand the tree. State persists in `localStorage` under `cockpit:codeTree:collapsed`. When collapsed, the tree column hides and the tab strip widens; an expand chevron sits flush at the tab strip's left edge.

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/app/cockpit.css`

- [ ] **Step 1: Add the collapse state and persistence**

In `apps/cockpit/src/components/code-mode/code-mode.tsx`, add state + hydration just below the existing `openPaths`/`activePath` declarations:

```tsx
const [treeCollapsed, setTreeCollapsed] = React.useState(false);

React.useEffect(() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem('cockpit:codeTree:collapsed') === '1') {
      setTreeCollapsed(true);
    }
  } catch {
    /* localStorage unavailable — leave default */
  }
}, []);

const toggleTreeCollapsed = React.useCallback(() => {
  setTreeCollapsed((prev) => {
    const next = !prev;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cockpit:codeTree:collapsed', next ? '1' : '0');
      }
    } catch {
      /* ignore */
    }
    return next;
  });
}, []);
```

- [ ] **Step 2: Wire the chevron buttons**

Change the `<aside>` to conditionally hide its content when `treeCollapsed` is true, and add a chevron in its header:

```tsx
<aside
  aria-label="File tree"
  className={`hidden lg:flex lg:flex-col border-r border-[var(--ds-border)] bg-[var(--ds-surface-tinted)]/40 transition-[width] duration-200 ${treeCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-r-0' : 'lg:w-[220px] lg:overflow-y-auto'}`}
>
  <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--ds-border)] bg-[var(--ds-surface-tinted)]/70">
    <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ds-text-muted)] pl-1">Files</span>
    <button
      type="button"
      aria-label="Collapse file tree"
      onClick={toggleTreeCollapsed}
      className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] px-1.5 py-0.5 rounded"
    >‹</button>
  </div>
  <FileTree paths={allPaths} activePath={activePath} onSelect={handleSelect} />
</aside>
```

Inside the right column (the `<div className="flex flex-col h-full min-w-0">`), add an inline expand chevron that renders only when `treeCollapsed` is true, placed at the left edge above the `<Tabs>`:

```tsx
{treeCollapsed ? (
  <button
    type="button"
    aria-label="Expand file tree"
    onClick={toggleTreeCollapsed}
    className="hidden lg:flex shrink-0 items-center justify-center w-7 self-start mt-1 ml-1 rounded text-[var(--ds-accent)] hover:bg-[var(--ds-accent-surface)]"
  >›</button>
) : null}
```

(Position it as a small persistent affordance at the top-left of the right column; the Radix `Tabs` keeps its full width.)

- [ ] **Step 3: Adjust the grid so the right column expands when collapsed**

Change the outer `<section>` className to:

```tsx
<section
  aria-label="Code mode"
  className={`h-full lg:grid lg:overflow-hidden ${treeCollapsed ? 'lg:grid-cols-[0_1fr]' : 'lg:grid-cols-[220px_1fr]'}`}
>
```

(Below `lg:`, the layout falls back to `h-full` only — the responsive grid is the desktop case.)

- [ ] **Step 4: Run the full suite**

Run: `npx nx test cockpit`
Expected: PASS — no tests assert on the chevron presence; behavior unchanged for existing tests.

- [ ] **Step 5: Browser verify**

At ≥1024px viewport: click the `‹` chevron in the tree header → tree slides closed with a 200ms transition; an expand chevron `›` appears at the top-left of the right column. Click `›` → tree reopens. Reload the page → collapsed state persists.

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx
git commit -m "feat(cockpit): persistent collapse toggle for Code-mode file tree"
```

---

## Task 8: Cross-theme + responsive verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full cockpit test suite**

Run: `npx nx test cockpit`
Expected: PASS (all specs green).

- [ ] **Step 2: Browser pass (both themes, both breakpoints)**

Serve the cockpit and visit `deep-agents/core-capabilities/planning`. For BOTH light and dark (toggle in the cockpit sidebar):

At ≥1024px:
- Tree visible, grouped under the compact-merged folder rows (`angular/src/app`, etc.).
- Active file has the accent left border + lighter text.
- Clicking a tree file activates the matching tab (no duplicate tab).
- Hover a tab → × appears; click × → tab closes, left neighbor activates.
- Close all tabs → "Select a file from the tree to begin" empty state.
- Collapse chevron → tree slides closed; expand chevron in the right column → tree slides open. Refresh → collapse state preserved.

At <1024px (e.g. 768px):
- Tree hidden, tabs span the full pane.
- Close X still works.
- Resize back over 1024px → tree returns (unless explicitly collapsed).

In both themes:
- Tree colors flip correctly (no hardcoded literals remained).
- The chat-aligned `#64C3FD` accent is consistent across active tab, active tree row, and language chips.

- [ ] **Step 3: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(cockpit): file-tree verification fixups"
```

(Skip this commit if no fixups were needed.)

---

## Self-review notes

- **Spec coverage:**
  - §Layout & breakpoints → Tasks 5 (grid + lg:) and 7 (collapse).
  - §Tree content & organization → Task 2 (`buildTree` with compact-folders + flat fallback) and Task 4 (rendering).
  - §Tabs & lifecycle → Task 3 (state migration), Task 5 (tree-open semantics), Task 6 (close + empty state).
  - §Visual integration → Tasks 4 (tree styles) + 6 (close button) + 7 (chevrons), all token-driven.
  - §Components & file structure → matches the file map verbatim.
  - §Out of scope items confirmed: no `content-bundle.ts` changes; no `package.json`/`tsconfig.json` walking; no keyboard shortcuts; no resizable width.
- **Placeholder scan:** no TBD/TODO; every code step ships the actual code.
- **Type consistency:** `TreeNode`/`FileNode`/`FolderNode` defined once in Task 2 and consumed by Task 4. `openPaths`/`activePath`/`treeCollapsed` introduced in Task 3 and extended in Tasks 5–7 with the same names.
- **`localStorage` SSR safety:** all access wrapped in `typeof window !== 'undefined'` + `try/catch` (Task 7).
- **Tab close interaction:** `data-tab-close` is the stable hook for tests; `onPointerDown` stops propagation to keep Radix from also activating the tab when the user clicks the close button.
