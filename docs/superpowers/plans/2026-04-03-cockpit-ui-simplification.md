# Cockpit UI Simplification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the cockpit UI down to essentials — Run mode is just the embedded app, Code mode shows source without chrome, no Docs mode, no verbose descriptions, minimal whitespace.

**Architecture:** Remove DocsMode entirely. Simplify RunMode to just the iframe (no headers, no context sidebar). Simplify CodeMode to just tabs + code. Remove verbose header text from CockpitShell. Keep sidebar with full navigation tree but remove the wordy header copy. Remove the prompt drawer trigger from the main header — access prompts through Code mode tabs instead.

**Tech Stack:** Same as current (Tailwind v4, shadcn/ui, Radix Tabs/Sheet)

---

## Design Changes Summary

| Area | Before | After |
|------|--------|-------|
| Modes | Run / Code / Docs | Run / Code |
| RunMode | Two-column: iframe + context sidebar, headers, descriptions | Full-bleed iframe only. Empty state when no URL. |
| CodeMode | Header with title + description, tabs, code | Tabs + code. File path shown as small monospace label. |
| DocsMode | Full article with sections | Removed |
| Shell header | Eyebrow + title + description + 2 action buttons | Eyebrow + title only. Prompt button moves to Code mode. |
| Shell mode surface | Wrapped in bordered card with padding | No wrapper — modes render edge-to-edge in workspace |
| Sidebar header | "Cockpit" eyebrow + "Explore the example surface" h1 + description paragraph | "Cockpit" label only |
| Prompt access | "Open prompt assets" button in header → Sheet | Tab in CodeMode alongside code files |

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Delete | `apps/cockpit/src/components/docs-mode/docs-mode.tsx` | Remove DocsMode component |
| Delete | `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx` | Remove DocsMode tests |
| Delete | `apps/cockpit/src/components/docs-pane/docs-pane.tsx` | Remove DocsPane wrapper |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Remove Docs mode, strip header, remove mode surface wrapper, integrate prompts into code tabs |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.tsx` | Just the iframe, nothing else |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.spec.tsx` | Update for simplified RunMode |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Add prompt files as tabs alongside code files |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.spec.tsx` | Update for prompt tabs |
| Modify | `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx` | Remove verbose header text |
| Modify | `apps/cockpit/src/components/pane-rendering.spec.tsx` | Update for removed Docs, simplified structure |
| Modify | `apps/cockpit/src/components/modes/mode-switcher.tsx` | No change needed (just receives fewer modes) |
| Delete | `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx` | Remove — prompts now inline in Code tabs |
| Delete | `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx` | Remove tests |
| Delete | `apps/cockpit/src/components/prompt-pane/prompt-pane.tsx` | Remove wrapper |

---

### Task 1: Remove DocsMode and PromptDrawer

**Files:**
- Delete: `apps/cockpit/src/components/docs-mode/docs-mode.tsx`
- Delete: `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx`
- Delete: `apps/cockpit/src/components/docs-pane/docs-pane.tsx`
- Delete: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx`
- Delete: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`
- Delete: `apps/cockpit/src/components/prompt-pane/prompt-pane.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm apps/cockpit/src/components/docs-mode/docs-mode.tsx
rm apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx
rm apps/cockpit/src/components/docs-pane/docs-pane.tsx
rm apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx
rm apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx
rm apps/cockpit/src/components/prompt-pane/prompt-pane.tsx
rmdir apps/cockpit/src/components/docs-mode
rmdir apps/cockpit/src/components/docs-pane
rmdir apps/cockpit/src/components/prompt-drawer
rmdir apps/cockpit/src/components/prompt-pane
```

- [ ] **Step 2: Commit**

```bash
git add -A apps/cockpit/src/components/docs-mode apps/cockpit/src/components/docs-pane apps/cockpit/src/components/prompt-drawer apps/cockpit/src/components/prompt-pane
git commit -m "refactor(cockpit): remove DocsMode and PromptDrawer components"
```

---

### Task 2: Simplify CockpitShell

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Strip CockpitShell to essentials**

Remove:
- DocsMode import and rendering
- PromptDrawer import and Sheet wrapper
- `isPromptDrawerOpen` state
- `docsSections` computation
- `promptAssetPaths` computation
- "Open prompt assets" and "Run example" action buttons
- Description paragraph in header ("Start in Run, then move into...")
- The bordered card wrapper around the mode surface (`grid gap-4 p-5 border...`)

Modes become `['Run', 'Code'] as const`.

Pass `promptFiles` from `contentBundle` to CodeMode so it can render prompt tabs.

The new shell should be:

```tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import type { ContentBundle } from '../lib/content-bundle';
import type { CapabilityPresentation, NavigationProduct } from '../lib/route-resolution';
import { CodeMode } from './code-mode/code-mode';
import { ModeSwitcher } from './modes/mode-switcher';
import { RunMode } from './run-mode/run-mode';
import { CockpitSidebar } from './sidebar/cockpit-sidebar';

const PRIMARY_MODES = ['Run', 'Code'] as const;
type PrimaryMode = (typeof PRIMARY_MODES)[number];

const DEFAULT_FRONTEND_ASSET_PATHS = [
  'apps/cockpit/src/app/page.tsx',
  'apps/cockpit/src/components/cockpit-shell.tsx',
] as const;

interface CockpitShellProps {
  navigationTree: NavigationProduct[];
  presentation: CapabilityPresentation;
  entryTitle: string;
  contentBundle: ContentBundle;
}

const toLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function CockpitShell({
  navigationTree,
  presentation,
  entryTitle,
  contentBundle,
}: CockpitShellProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeMode, setActiveMode] = useState<PrimaryMode>('Run');
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = useMemo(
    () =>
      isCapability
        ? Array.from(new Set([...DEFAULT_FRONTEND_ASSET_PATHS, ...presentation.codeAssetPaths]))
        : [...DEFAULT_FRONTEND_ASSET_PATHS],
    [isCapability, presentation]
  );
  const entry = presentation.entry;
  const contextLabel = `${toLabel(entry.product)} / ${toLabel(entry.section)} / ${entry.topic}`;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <main
      aria-label="Cockpit shell"
      className="grid grid-cols-[18rem_minmax(0,1fr)] min-h-screen"
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      <CockpitSidebar
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
      />

      <section className="grid grid-rows-[auto_auto_1fr] gap-2 p-4 bg-card/88 backdrop-blur-[14px]">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground font-mono text-xs">{contextLabel}</p>
            <span className="text-border">|</span>
            <h2 className="text-sm font-medium">{entryTitle}</h2>
          </div>
          <ModeSwitcher
            modes={PRIMARY_MODES}
            activeMode={activeMode}
            onChange={setActiveMode}
          />
        </header>

        <div className="min-h-0">
          {activeMode === 'Run' ? (
            <RunMode
              entryTitle={entryTitle}
              runtimeUrl={contentBundle.runtimeUrl}
            />
          ) : null}
          {activeMode === 'Code' ? (
            <CodeMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              codeFiles={contentBundle.codeFiles}
              promptFiles={contentBundle.promptFiles}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
```

Key changes:
- Header is a single compact line: breadcrumb + title + mode switcher (all inline)
- No description text, no action buttons
- Mode surface has no border/card wrapper — just renders directly
- `grid-rows-[auto_auto_1fr]` makes the content area fill remaining height
- `gap-2` and `p-4` instead of `gap-6` and `p-7` — tighter spacing
- Passes `promptFiles` to CodeMode

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "refactor(cockpit): simplify shell - remove Docs mode, strip header chrome"
```

---

### Task 3: Simplify RunMode to just the iframe

**Files:**
- Modify: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Modify: `apps/cockpit/src/components/run-mode/run-mode.spec.tsx`

- [ ] **Step 1: Replace RunMode with minimal iframe-only version**

```tsx
import React from 'react';

interface RunModeProps {
  entryTitle: string;
  runtimeUrl: string | null;
}

export function RunMode({ entryTitle, runtimeUrl }: RunModeProps) {
  if (!runtimeUrl) {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full text-muted-foreground text-sm">
        <p>No runtime available. Start the local dev server to preview.</p>
      </section>
    );
  }

  return (
    <section aria-label="Run mode" className="h-full">
      <iframe
        src={runtimeUrl}
        title={`${entryTitle} live example`}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full border-0 rounded"
      />
    </section>
  );
}
```

Props removed: `codeAssetPaths`, `docsPath` (no longer needed — no context sidebar).

- [ ] **Step 2: Update RunMode tests**

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunMode } from './run-mode';

describe('RunMode', () => {
  it('renders an iframe when runtimeUrl is provided', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl="http://localhost:4300" />
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('http://localhost:4300');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });

  it('renders a minimal empty state when runtimeUrl is null', () => {
    const html = renderToStaticMarkup(
      <RunMode entryTitle="LangGraph Streaming" runtimeUrl={null} />
    );
    expect(html).not.toContain('<iframe');
    expect(html).toContain('No runtime available');
  });
});
```

- [ ] **Step 3: Run RunMode tests**

Run: `npx nx test cockpit -- --run --testPathPattern=run-mode`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/run-mode/
git commit -m "refactor(cockpit): simplify RunMode to iframe-only"
```

---

### Task 4: Add prompt tabs to CodeMode

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

- [ ] **Step 1: Update CodeMode to accept and render prompt files as tabs**

```tsx
'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CodeModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
}

const getTabLabel = (path: string): string => path.split('/').pop() ?? path;

export function CodeMode({ entryTitle, codeAssetPaths, codeFiles, promptFiles }: CodeModeProps) {
  const promptPaths = Object.keys(promptFiles);
  const allPaths = [...codeAssetPaths, ...promptPaths];

  if (allPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="grid place-items-center h-full text-muted-foreground text-sm">
        <p>No files available for {entryTitle}.</p>
      </section>
    );
  }

  const defaultPath = codeAssetPaths[0] ?? promptPaths[0];

  return (
    <section aria-label="Code mode" className="h-full flex flex-col">
      <Tabs defaultValue={defaultPath} className="flex flex-col h-full">
        <TabsList className="shrink-0">
          {codeAssetPaths.map((path) => (
            <TabsTrigger key={path} value={path}>
              {getTabLabel(path)}
            </TabsTrigger>
          ))}
          {promptPaths.length > 0 ? (
            <>
              <span className="mx-2 text-border">|</span>
              {promptPaths.map((path) => (
                <TabsTrigger key={path} value={path} className="text-primary/70 data-[state=active]:text-primary">
                  {getTabLabel(path)}
                </TabsTrigger>
              ))}
            </>
          ) : null}
        </TabsList>

        {codeAssetPaths.map((path) => {
          const content = codeFiles[path];
          return (
            <TabsContent key={path} value={path} className="flex-1 overflow-auto mt-2">
              <p className="text-muted-foreground font-mono text-xs mb-2">{path}</p>
              {content ? (
                <div dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                <p className="text-sm text-muted-foreground">No source available for {getTabLabel(path)}</p>
              )}
            </TabsContent>
          );
        })}

        {promptPaths.map((path) => {
          const content = promptFiles[path];
          return (
            <TabsContent key={path} value={path} className="flex-1 overflow-auto mt-2">
              <p className="text-muted-foreground font-mono text-xs mb-2">{path}</p>
              {content ? (
                <pre className="font-mono text-sm whitespace-pre-wrap">{content}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">No content for {getTabLabel(path)}</p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
```

- [ ] **Step 2: Update CodeMode tests**

Update existing tests to pass `promptFiles` prop, add test for prompt tab rendering.

- [ ] **Step 3: Run CodeMode tests**

Run: `npx nx test cockpit -- --run --testPathPattern=code-mode`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/code-mode/
git commit -m "refactor(cockpit): integrate prompt files as tabs in CodeMode"
```

---

### Task 5: Simplify sidebar header

**Files:**
- Modify: `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`

- [ ] **Step 1: Remove verbose header text**

Read the current file and strip the header to just "Cockpit" label. Remove:
- The `<h1>Explore the example surface</h1>` heading
- The `<p>Switch language or jump between...</p>` description
- The trailing `<p>Run mode stays ready while you browse.</p>`

Keep:
- The "Cockpit" eyebrow text
- LanguagePicker
- NavigationGroups

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx
git commit -m "refactor(cockpit): simplify sidebar header"
```

---

### Task 6: Fix remaining tests and clean up

**Files:**
- Modify: `apps/cockpit/src/components/pane-rendering.spec.tsx`
- Modify: `apps/cockpit/src/components/code-pane/code-pane.tsx`
- Possibly remove: `apps/cockpit/src/components/ui/sheet.tsx` (no longer used)

- [ ] **Step 1: Update pane-rendering.spec.tsx**

Remove assertions about DocsMode, PromptDrawer, docs pane. Update CockpitShell assertions for the new simplified structure (no Docs mode, no prompt drawer button). Update `CodeMode` assertions to include `promptFiles` prop.

- [ ] **Step 2: Update code-pane.tsx**

Add `promptFiles={{}}` prop to CodeMode call.

- [ ] **Step 3: Consider removing unused Sheet component**

If `apps/cockpit/src/components/ui/sheet.tsx` is no longer imported anywhere, delete it.

- [ ] **Step 4: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for simplified UI"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Start dev server and verify at 1440x900**

Check:
- Run mode: Full-bleed iframe (or clean empty state)
- Code mode: Tabs with code files + prompt files, no chrome
- Sidebar: Compact "Cockpit" label, language picker, nav tree
- Header: Single compact line with breadcrumb, title, mode switcher
- No Docs tab in mode switcher
- No "Open prompt assets" button
- Minimal whitespace throughout

- [ ] **Step 2: Fix any visual issues**

- [ ] **Step 3: Commit any fixes**

```bash
git add apps/cockpit/src
git commit -m "fix(cockpit): visual polish after UI simplification"
```
