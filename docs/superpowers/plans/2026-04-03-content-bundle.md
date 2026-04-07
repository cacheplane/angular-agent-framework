# Content Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder text in RunMode, CodeMode, and PromptDrawer with real content — Shiki-highlighted code, raw prompt markdown, and iframe-embedded runtime URLs — resolved server-side and passed through a ContentBundle.

**Architecture:** A new `getContentBundle()` async function reads code/prompt files from disk at build time, highlights code via Shiki, and resolves runtime URLs from env vars or devPort fallback. The page component (`[...slug]/page.tsx`) calls it and passes the bundle to `CockpitShell`, which distributes content to its child components. Components receive pre-rendered HTML strings instead of file paths.

**Tech Stack:** Next.js 16 (App Router, async server components), Shiki 4 (server-only syntax highlighting), Vitest (unit tests), Nx monorepo

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/cockpit/src/lib/content-bundle.ts` | `ContentBundle` type, `getContentBundle()`, `resolveRuntimeUrl()` |
| Create | `apps/cockpit/src/lib/content-bundle.spec.ts` | Unit tests for getContentBundle and resolveRuntimeUrl |
| Modify | `cockpit/langgraph/streaming/python/src/index.ts` | Add `runtimeUrl` and `devPort` fields to capability module |
| Modify | `apps/cockpit/src/lib/route-resolution.ts` | Extend `CapabilityPresentation` with `runtimeUrl` and `devPort` |
| Modify | `apps/cockpit/src/app/[...slug]/page.tsx` | Call `getContentBundle()`, add `generateStaticParams()`, pass bundle to shell |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Accept `ContentBundle` prop, distribute to child components |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.tsx` | Render iframe from `runtimeUrl` or empty state |
| Modify | `apps/cockpit/src/components/run-mode/run-mode.spec.tsx` | Test iframe rendering and empty state |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Render Shiki HTML via `dangerouslySetInnerHTML` |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.spec.tsx` | Test highlighted HTML rendering |
| Modify | `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx` | Render raw prompt content as `<pre>` |
| Modify | `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx` | Test prompt content rendering |

---

### Task 1: ContentBundle type and resolveRuntimeUrl

**Files:**
- Create: `apps/cockpit/src/lib/content-bundle.ts`
- Create: `apps/cockpit/src/lib/content-bundle.spec.ts`

- [ ] **Step 1: Write failing tests for resolveRuntimeUrl**

```ts
// apps/cockpit/src/lib/content-bundle.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRuntimeUrl } from './content-bundle';

describe('resolveRuntimeUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', 'https://examples.cacheplane.ai');
    expect(
      resolveRuntimeUrl({ runtimeUrl: 'langgraph/streaming', devPort: 4300 })
    ).toBe('https://examples.cacheplane.ai/langgraph/streaming');
  });

  it('falls back to localhost with devPort when no env var is set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    expect(
      resolveRuntimeUrl({ runtimeUrl: 'langgraph/streaming', devPort: 4300 })
    ).toBe('http://localhost:4300');
  });

  it('returns null when neither env var nor devPort is available', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    expect(
      resolveRuntimeUrl({ runtimeUrl: undefined, devPort: undefined })
    ).toBeNull();
  });

  it('returns null when runtimeUrl is undefined even with env var set', () => {
    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', 'https://examples.cacheplane.ai');
    expect(
      resolveRuntimeUrl({ runtimeUrl: undefined, devPort: undefined })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=content-bundle`
Expected: FAIL — `resolveRuntimeUrl` not found

- [ ] **Step 3: Implement ContentBundle type and resolveRuntimeUrl**

```ts
// apps/cockpit/src/lib/content-bundle.ts
export interface ContentBundle {
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
  runtimeUrl: string | null;
}

export function resolveRuntimeUrl(options: {
  runtimeUrl?: string;
  devPort?: number;
}): string | null {
  const { runtimeUrl, devPort } = options;

  if (!runtimeUrl && !devPort) {
    return null;
  }

  const baseUrl = process.env['NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL'];

  if (baseUrl && runtimeUrl) {
    return `${baseUrl}/${runtimeUrl}`;
  }

  if (devPort) {
    return `http://localhost:${devPort}`;
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=content-bundle`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/lib/content-bundle.ts apps/cockpit/src/lib/content-bundle.spec.ts
git commit -m "feat(cockpit): add ContentBundle type and resolveRuntimeUrl"
```

---

### Task 2: getContentBundle implementation

**Files:**
- Modify: `apps/cockpit/src/lib/content-bundle.spec.ts`
- Modify: `apps/cockpit/src/lib/content-bundle.ts`

- [ ] **Step 1: Write failing tests for getContentBundle**

Append to `apps/cockpit/src/lib/content-bundle.spec.ts`:

```ts
import { getContentBundle } from './content-bundle';
import type { CapabilityPresentation } from './route-resolution';

// Mock fs at the top of the file
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock shiki at the top of the file
vi.mock('shiki', () => ({
  codeToHtml: vi.fn(),
}));

describe('getContentBundle', () => {
  it('returns highlighted code and raw prompt content for a capability presentation', async () => {
    const { readFileSync } = await import('node:fs');
    const { codeToHtml } = await import('shiki');

    vi.mocked(readFileSync).mockImplementation((filePath) => {
      if (String(filePath).includes('index.ts')) return 'const x = 1;';
      if (String(filePath).includes('streaming.md')) return '# Streaming prompt';
      throw new Error(`ENOENT: ${filePath}`);
    });
    vi.mocked(codeToHtml).mockResolvedValue('<pre class="shiki"><code>const x = 1;</code></pre>');

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
      codeAssetPaths: ['cockpit/langgraph/streaming/python/src/index.ts'],
      runtimeUrl: 'langgraph/streaming',
      devPort: 4300,
    };

    vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles).toEqual({
      'cockpit/langgraph/streaming/python/src/index.ts':
        '<pre class="shiki"><code>const x = 1;</code></pre>',
    });
    expect(bundle.promptFiles).toEqual({
      'cockpit/langgraph/streaming/python/prompts/streaming.md': '# Streaming prompt',
    });
    expect(bundle.runtimeUrl).toBe('http://localhost:4300');
  });

  it('returns a placeholder string when a code file is missing', async () => {
    const { readFileSync } = await import('node:fs');
    const { codeToHtml } = await import('shiki');

    vi.mocked(readFileSync).mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
    vi.mocked(codeToHtml).mockResolvedValue('');

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: [],
      codeAssetPaths: ['missing/file.ts'],
      runtimeUrl: undefined,
      devPort: undefined,
    };

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles['missing/file.ts']).toBe('File not found: missing/file.ts');
    expect(bundle.runtimeUrl).toBeNull();
  });

  it('falls back to unhighlighted code when Shiki fails', async () => {
    const { readFileSync } = await import('node:fs');
    const { codeToHtml } = await import('shiki');

    vi.mocked(readFileSync).mockReturnValue('const y = 2;');
    vi.mocked(codeToHtml).mockRejectedValue(new Error('Shiki error'));

    const presentation: CapabilityPresentation = {
      kind: 'capability',
      entry: {} as any,
      docsPath: '/docs/test',
      promptAssetPaths: [],
      codeAssetPaths: ['some/file.ts'],
      runtimeUrl: undefined,
      devPort: undefined,
    };

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles['some/file.ts']).toBe(
      '<pre><code>const y = 2;</code></pre>'
    );
  });

  it('returns empty maps for a docs-only presentation', async () => {
    const presentation: CapabilityPresentation = {
      kind: 'docs-only',
      entry: {} as any,
      docsPath: '/docs/test',
    };

    const bundle = await getContentBundle(presentation);

    expect(bundle.codeFiles).toEqual({});
    expect(bundle.promptFiles).toEqual({});
    expect(bundle.runtimeUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=content-bundle`
Expected: FAIL — `getContentBundle` not exported

- [ ] **Step 3: Implement getContentBundle**

Add to `apps/cockpit/src/lib/content-bundle.ts`:

```ts
import { readFileSync } from 'node:fs';
import { codeToHtml } from 'shiki';
import type { CapabilityPresentation } from './route-resolution';

// ... existing ContentBundle interface and resolveRuntimeUrl ...

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  css: 'css',
  html: 'html',
};

function detectLang(filePath: string): string {
  const ext = filePath.split('.').pop() ?? '';
  return LANG_MAP[ext] ?? 'text';
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function highlightCode(
  source: string,
  filePath: string
): Promise<string> {
  try {
    return await codeToHtml(source, {
      lang: detectLang(filePath),
      theme: 'github-dark',
    });
  } catch {
    return `<pre><code>${source}</code></pre>`;
  }
}

export async function getContentBundle(
  presentation: CapabilityPresentation
): Promise<ContentBundle> {
  if (presentation.kind === 'docs-only') {
    return { codeFiles: {}, promptFiles: {}, runtimeUrl: null };
  }

  const codeFiles: Record<string, string> = {};
  for (const path of presentation.codeAssetPaths) {
    const source = readFileSafe(path);
    if (source === null) {
      codeFiles[path] = `File not found: ${path}`;
    } else {
      codeFiles[path] = await highlightCode(source, path);
    }
  }

  const promptFiles: Record<string, string> = {};
  for (const path of presentation.promptAssetPaths) {
    const source = readFileSafe(path);
    promptFiles[path] = source ?? `File not found: ${path}`;
  }

  const runtimeUrl = resolveRuntimeUrl({
    runtimeUrl: presentation.runtimeUrl,
    devPort: presentation.devPort,
  });

  return { codeFiles, promptFiles, runtimeUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=content-bundle`
Expected: All 8 tests PASS (4 from Task 1 + 4 new)

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/lib/content-bundle.ts apps/cockpit/src/lib/content-bundle.spec.ts
git commit -m "feat(cockpit): implement getContentBundle with Shiki highlighting"
```

---

### Task 3: Extend CapabilityPresentation and capability module with runtime fields

**Files:**
- Modify: `apps/cockpit/src/lib/route-resolution.ts:27-39` (CapabilityPresentation type)
- Modify: `apps/cockpit/src/lib/route-resolution.ts:152-159` (getCapabilityPresentation return)
- Modify: `cockpit/langgraph/streaming/python/src/index.ts:1-14` (CockpitCapabilityModule interface)
- Modify: `cockpit/langgraph/streaming/python/src/index.ts:16-29` (module instance)

- [ ] **Step 1: Write failing test for runtimeUrl and devPort in CapabilityPresentation**

Add a new test to `apps/cockpit/src/lib/route-resolution.spec.ts`:

```ts
it('includes runtimeUrl and devPort from the capability module', () => {
  const entry = resolveCockpitEntry({
    manifest: cockpitManifest,
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  });
  const presentation = getCapabilityPresentation(entry);

  expect(presentation).toMatchObject({
    kind: 'capability',
    runtimeUrl: 'langgraph/streaming',
    devPort: 4300,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=route-resolution`
Expected: FAIL — `runtimeUrl` not present on presentation object

- [ ] **Step 3: Add runtimeUrl and devPort to CockpitCapabilityModule**

In `cockpit/langgraph/streaming/python/src/index.ts`, update the interface and module:

```ts
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'streaming';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const langgraphStreamingPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-streaming-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Streaming (Python)',
  docsPath: '/docs/langgraph/core-capabilities/streaming/overview/python',
  promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
  codeAssetPaths: ['cockpit/langgraph/streaming/python/src/index.ts'],
  runtimeUrl: 'langgraph/streaming',
  devPort: 4300,
};
```

- [ ] **Step 4: Extend CapabilityPresentation and getCapabilityPresentation**

In `apps/cockpit/src/lib/route-resolution.ts`, update the capability variant of the union type:

```ts
export type CapabilityPresentation =
  | {
      kind: 'docs-only';
      entry: CockpitManifestEntry;
      docsPath: string;
    }
  | {
      kind: 'capability';
      entry: CockpitManifestEntry;
      docsPath: string;
      promptAssetPaths: string[];
      codeAssetPaths: string[];
      runtimeUrl?: string;
      devPort?: number;
    };
```

Update the return in `getCapabilityPresentation` (line ~153):

```ts
return {
  kind: 'capability',
  entry,
  docsPath: module?.docsPath ?? entry.docsPath,
  promptAssetPaths: module?.promptAssetPaths ?? entry.promptAssetPaths,
  codeAssetPaths: module?.codeAssetPaths ?? entry.codeAssetPaths,
  runtimeUrl: module?.runtimeUrl,
  devPort: module?.devPort,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=route-resolution`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/index.ts apps/cockpit/src/lib/route-resolution.ts apps/cockpit/src/lib/route-resolution.spec.ts
git commit -m "feat(cockpit): add runtimeUrl and devPort to capability module and presentation"
```

---

### Task 4: Wire page.tsx to getContentBundle and add generateStaticParams

**Files:**
- Modify: `apps/cockpit/src/app/[...slug]/page.tsx`

- [ ] **Step 1: Update page.tsx to call getContentBundle and add generateStaticParams**

```tsx
// apps/cockpit/src/app/[...slug]/page.tsx
import { redirect } from 'next/navigation';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import { CockpitShell } from '../../components/cockpit-shell';
import { getContentBundle } from '../../lib/content-bundle';
import { getCockpitPageModel } from '../../lib/cockpit-page';

export async function generateStaticParams() {
  return cockpitManifest.map((entry) => ({
    slug: [entry.product, entry.section, entry.topic, entry.page, entry.language],
  }));
}

export default async function CockpitRoutePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const { entry, presentation, navigationTree, canonicalPath } =
    getCockpitPageModel(slug);
  const requestedPath = `/${slug.join('/')}`;

  if (slug.length > 0 && requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  const contentBundle = await getContentBundle(presentation);

  return (
    <CockpitShell
      navigationTree={navigationTree}
      presentation={presentation}
      entryTitle={entry.title}
      contentBundle={contentBundle}
    />
  );
}
```

- [ ] **Step 2: Run existing tests to verify nothing is broken**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All existing tests still PASS (CockpitShell will accept the extra prop without breaking since we haven't enforced it in types yet — that's Task 5)

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/app/[...slug]/page.tsx
git commit -m "feat(cockpit): wire getContentBundle into page route with generateStaticParams"
```

---

### Task 5: Update CockpitShell to accept and distribute ContentBundle

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Update CockpitShellProps and pass content to child components**

```tsx
// apps/cockpit/src/components/cockpit-shell.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { cockpitManifest } from '../../../../libs/cockpit-registry/src/index';
import type { ContentBundle } from '../lib/content-bundle';
import type { CapabilityPresentation, NavigationProduct } from '../lib/route-resolution';
import { CodeMode } from './code-mode/code-mode';
import { DocsMode } from './docs-mode/docs-mode';
import { ModeSwitcher } from './modes/mode-switcher';
import { PromptDrawer } from './prompt-drawer/prompt-drawer';
import { RunMode } from './run-mode/run-mode';
import { CockpitSidebar } from './sidebar/cockpit-sidebar';

const PRIMARY_MODES = ['Run', 'Code', 'Docs'] as const;
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
  const [isPromptDrawerOpen, setIsPromptDrawerOpen] = useState(false);
  const isCapability = presentation.kind === 'capability';
  const codeAssetPaths = useMemo(
    () =>
      isCapability
        ? Array.from(new Set([...DEFAULT_FRONTEND_ASSET_PATHS, ...presentation.codeAssetPaths]))
        : [...DEFAULT_FRONTEND_ASSET_PATHS],
    [isCapability, presentation]
  );
  const promptAssetPaths = isCapability ? presentation.promptAssetPaths : [];
  const entry = presentation.entry;
  const contextLabel = `${toLabel(entry.product)} / ${toLabel(entry.section)} / ${entry.topic}`;
  const docsSections = [
    {
      title: 'Start from the runnable surface',
      body: `Run ${entryTitle} first, then switch to Code to inspect the frontend shell and capability module paths that power it.`,
      code: codeAssetPaths[0] ?? presentation.docsPath,
    },
    {
      title: 'Keep prompts close',
      body:
        promptAssetPaths.length > 0
          ? 'Use the prompt drawer when you want the prompt path without losing the current workspace mode.'
          : 'Prompt assets are not available for this entry, so the guide stays focused on the runnable surface and implementation files.',
      code: promptAssetPaths[0],
    },
  ].filter((section) => Boolean(section.code || section.body));

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <main
      aria-label="Cockpit shell"
      className="cockpit-shell"
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      <CockpitSidebar
        navigationTree={navigationTree}
        manifest={cockpitManifest}
        entry={entry}
      />

      <section className="cockpit-shell__workspace">
        <header className="cockpit-shell__header">
          <div>
            <p className="cockpit-eyebrow">{contextLabel}</p>
            <h2>{entryTitle}</h2>
            <p>
              Start in Run, then move into the implementation files or guided docs as
              needed.
            </p>
          </div>

          <div className="cockpit-shell__actions">
            <button type="button" onClick={() => setIsPromptDrawerOpen(true)}>
              Open prompt assets
            </button>
            {isCapability ? <button type="button">Run example</button> : null}
          </div>
        </header>

        <ModeSwitcher
          modes={PRIMARY_MODES}
          activeMode={activeMode}
          onChange={setActiveMode}
        />

        <div className="cockpit-shell__mode-surface">
          {activeMode === 'Run' ? (
            <RunMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              docsPath={presentation.docsPath}
              runtimeUrl={contentBundle.runtimeUrl}
            />
          ) : null}
          {activeMode === 'Code' ? (
            <CodeMode
              entryTitle={entryTitle}
              codeAssetPaths={codeAssetPaths}
              codeFiles={contentBundle.codeFiles}
            />
          ) : null}
          {activeMode === 'Docs' ? (
            <DocsMode
              entryTitle={entryTitle}
              docsPath={presentation.docsPath}
              summary={`Follow the live example, inspect the relevant implementation files, and keep prompt assets within reach for ${entryTitle}.`}
              sections={docsSections}
              promptCopy="Open prompt assets"
            />
          ) : null}
        </div>
      </section>

      <PromptDrawer
        isOpen={isPromptDrawerOpen}
        entryTitle={entryTitle}
        paths={promptAssetPaths}
        promptFiles={contentBundle.promptFiles}
        onClose={() => setIsPromptDrawerOpen(false)}
      />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat(cockpit): wire ContentBundle through CockpitShell to child components"
```

---

### Task 6: Update RunMode to render iframe or empty state

**Files:**
- Modify: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Modify: `apps/cockpit/src/components/run-mode/run-mode.spec.tsx`

- [ ] **Step 1: Write failing tests for RunMode with runtimeUrl**

Replace `apps/cockpit/src/components/run-mode/run-mode.spec.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunMode } from './run-mode';

describe('RunMode', () => {
  it('renders an iframe when runtimeUrl is provided', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        docsPath="/docs/langgraph/core-capabilities/streaming/overview/python"
        codeAssetPaths={['apps/cockpit/src/app/page.tsx']}
        runtimeUrl="http://localhost:4300"
      />
    );

    expect(html).toContain('<iframe');
    expect(html).toContain('http://localhost:4300');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });

  it('renders a polished empty state when runtimeUrl is null', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        docsPath="/docs/langgraph/core-capabilities/streaming/overview/python"
        codeAssetPaths={['apps/cockpit/src/app/page.tsx']}
        runtimeUrl={null}
      />
    );

    expect(html).not.toContain('<iframe');
    expect(html).toContain('No runtime available');
  });

  it('still renders implementation context alongside the iframe', () => {
    const html = renderToStaticMarkup(
      <RunMode
        entryTitle="LangGraph Streaming"
        docsPath="/docs/langgraph/core-capabilities/streaming/overview/python"
        codeAssetPaths={[
          'apps/cockpit/src/app/page.tsx',
          'cockpit/langgraph/streaming/python/src/index.ts',
        ]}
        runtimeUrl="http://localhost:4300"
      />
    );

    expect(html).toContain('Implementation context');
    expect(html).toContain('apps/cockpit/src/app/page.tsx');
    expect(html).toContain('cockpit/langgraph/streaming/python/src/index.ts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=run-mode`
Expected: FAIL — RunMode doesn't accept `runtimeUrl` prop yet

- [ ] **Step 3: Update RunMode component**

```tsx
// apps/cockpit/src/components/run-mode/run-mode.tsx
import React from 'react';

interface RunModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  docsPath: string;
  runtimeUrl: string | null;
}

export function RunMode({ entryTitle, codeAssetPaths, docsPath, runtimeUrl }: RunModeProps) {
  return (
    <section aria-label="Run mode" className="cockpit-run-mode">
      <div className="cockpit-run-mode__surface">
        <p className="cockpit-eyebrow">Run</p>
        <h2>Interactive example</h2>
        <p>Open the working surface first, then move into code or docs as you need detail.</p>
        <div className="cockpit-run-mode__viewport" aria-label="Live example surface">
          {runtimeUrl ? (
            <iframe
              src={runtimeUrl}
              title={`${entryTitle} live example`}
              sandbox="allow-scripts allow-same-origin"
              className="cockpit-run-mode__iframe"
            />
          ) : (
            <div className="cockpit-run-mode__empty-state">
              <p>No runtime available</p>
              <p>Start the local service to see the live example here.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="cockpit-run-mode__context" aria-label="Run mode context">
        <h3>Implementation context</h3>
        <p className="cockpit-code-path">{docsPath}</p>
        <ul>
          {codeAssetPaths.map((path) => (
            <li key={path}>{path}</li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=run-mode`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/run-mode/run-mode.tsx apps/cockpit/src/components/run-mode/run-mode.spec.tsx
git commit -m "feat(cockpit): render iframe or empty state in RunMode"
```

---

### Task 7: Update CodeMode to render Shiki-highlighted HTML

**Files:**
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`

- [ ] **Step 1: Write failing tests for CodeMode with codeFiles**

Replace `apps/cockpit/src/components/code-mode/code-mode.spec.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeMode } from './code-mode';

describe('CodeMode', () => {
  afterEach(() => {
    globalThis.document?.body.replaceChildren();
  });

  it('renders Shiki-highlighted HTML for the active file', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = dom;

    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MouseEvent = window.MouseEvent;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const codeFiles: Record<string, string> = {
      'apps/cockpit/src/app/page.tsx': '<pre class="shiki"><code>export default function Page() {}</code></pre>',
      'cockpit/langgraph/streaming/python/src/index.ts': '<pre class="shiki"><code>const x = 1;</code></pre>',
    };

    act(() => {
      root.render(
        <CodeMode
          entryTitle="LangGraph Streaming"
          codeAssetPaths={[
            'apps/cockpit/src/app/page.tsx',
            'cockpit/langgraph/streaming/python/src/index.ts',
          ]}
          codeFiles={codeFiles}
        />
      );
    });

    expect(container.querySelector('.shiki')).not.toBeNull();
    expect(container.textContent).toContain('export default function Page() {}');

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(['page.tsx', 'index.ts']);

    act(() => {
      (tabs[1] as HTMLElement).click();
    });

    expect(container.textContent).toContain('const x = 1;');

    act(() => {
      root.unmount();
    });
  });

  it('renders a fallback message when codeFiles has no entry for a path', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const { window } = dom;

    globalThis.window = window as unknown as Window & typeof globalThis;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MouseEvent = window.MouseEvent;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <CodeMode
          entryTitle="Test"
          codeAssetPaths={['missing/file.ts']}
          codeFiles={{}}
        />
      );
    });

    expect(container.textContent).toContain('No source available');

    act(() => {
      root.unmount();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=code-mode`
Expected: FAIL — CodeMode doesn't accept `codeFiles` prop

- [ ] **Step 3: Update CodeMode component**

```tsx
// apps/cockpit/src/components/code-mode/code-mode.tsx
import React, { useEffect, useState } from 'react';

interface CodeModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  codeFiles: Record<string, string>;
}

const getTabLabel = (path: string): string => path.split('/').pop() ?? path;

export function CodeMode({ entryTitle, codeAssetPaths, codeFiles }: CodeModeProps) {
  const [activePath, setActivePath] = useState(codeAssetPaths[0] ?? '');

  useEffect(() => {
    if (!codeAssetPaths.includes(activePath)) {
      setActivePath(codeAssetPaths[0] ?? '');
    }
  }, [activePath, codeAssetPaths]);

  if (codeAssetPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="cockpit-code-mode">
        <h2>Code</h2>
        <p>No code files are available for {entryTitle}.</p>
      </section>
    );
  }

  const activeIndex = codeAssetPaths.indexOf(activePath);
  const resolvedActivePath = activeIndex >= 0 ? activePath : codeAssetPaths[0];
  const activeContent = codeFiles[resolvedActivePath];

  return (
    <section aria-label="Code mode" className="cockpit-code-mode">
      <header aria-label="Editor header" className="cockpit-code-mode__header">
        <h2>Code</h2>
        <p>{entryTitle}</p>
        <p className="cockpit-code-path">{resolvedActivePath}</p>
      </header>

      <div
        role="tablist"
        aria-label="Code files"
        className="cockpit-code-mode__tabs"
      >
        {codeAssetPaths.map((path) => {
          const isActive = path === resolvedActivePath;

          return (
            <button
              key={path}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePath(path)}
            >
              {getTabLabel(path)}
            </button>
          );
        })}
      </div>

      <article aria-label="Active file editor" className="cockpit-code-mode__editor">
        {activeContent ? (
          <div dangerouslySetInnerHTML={{ __html: activeContent }} />
        ) : (
          <p className="cockpit-code-mode__empty">No source available for {getTabLabel(resolvedActivePath)}</p>
        )}
      </article>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=code-mode`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/code-mode/code-mode.tsx apps/cockpit/src/components/code-mode/code-mode.spec.tsx
git commit -m "feat(cockpit): render Shiki-highlighted HTML in CodeMode"
```

---

### Task 8: Update PromptDrawer to render raw prompt content

**Files:**
- Modify: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx`
- Modify: `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`

- [ ] **Step 1: Write failing tests for PromptDrawer with promptFiles**

Replace `apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx`:

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CockpitShell } from '../cockpit-shell';
import { getCockpitPageModel } from '../../lib/cockpit-page';
import type { ContentBundle } from '../../lib/content-bundle';

describe('prompt drawer shell behavior', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  it('opens prompt assets in a secondary slide-over and renders raw prompt content', () => {
    const model = getCockpitPageModel();
    const contentBundle: ContentBundle = {
      codeFiles: {},
      promptFiles: {
        'cockpit/langgraph/streaming/python/prompts/streaming.md': '# Streaming\n\nUse streaming to get real-time output.',
      },
      runtimeUrl: null,
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <CockpitShell
          navigationTree={model.navigationTree}
          presentation={model.presentation}
          entryTitle={model.entry.title}
          contentBundle={contentBundle}
        />
      );
    });

    const openPromptButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Open prompt assets'
    );

    act(() => {
      openPromptButton?.click();
    });

    expect(container.querySelector('[aria-label="Prompt drawer"]')).not.toBeNull();
    expect(container.textContent).toContain('# Streaming');
    expect(container.textContent).toContain('Use streaming to get real-time output.');

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Close'
    );

    act(() => {
      closeButton?.click();
    });

    expect(container.querySelector('[aria-label="Prompt drawer"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=prompt-drawer`
Expected: FAIL — PromptDrawer doesn't accept `promptFiles` prop

- [ ] **Step 3: Update PromptDrawer component**

```tsx
// apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface PromptDrawerProps {
  isOpen: boolean;
  entryTitle: string;
  paths: readonly string[];
  promptFiles: Record<string, string>;
  onClose: () => void;
}

const getPromptLabel = (path: string): string => path.split('/').pop() ?? path;

export function PromptDrawer({
  isOpen,
  entryTitle,
  paths,
  promptFiles,
  onClose,
}: PromptDrawerProps) {
  const [activePath, setActivePath] = useState(paths[0] ?? '');

  useEffect(() => {
    if (!paths.includes(activePath)) {
      setActivePath(paths[0] ?? '');
    }
  }, [activePath, paths]);

  if (!isOpen) {
    return null;
  }

  const resolvedActivePath = paths.includes(activePath) ? activePath : (paths[0] ?? '');
  const activeContent = promptFiles[resolvedActivePath];

  return (
    <aside aria-label="Prompt drawer" className="cockpit-prompt-drawer">
      <header className="cockpit-prompt-drawer__header">
        <div>
          <p className="cockpit-eyebrow">Prompt assets</p>
          <h2>{entryTitle}</h2>
          <p>Keep the runnable surface in view while you inspect or copy the prompt path.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>

      {paths.length === 0 ? (
        <p>No prompt assets are available for this example.</p>
      ) : (
        <>
          <div className="cockpit-prompt-drawer__tabs" role="tablist" aria-label="Prompt assets">
            {paths.map((path) => {
              const isActive = path === resolvedActivePath;

              return (
                <button
                  key={path}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActivePath(path)}
                >
                  {getPromptLabel(path)}
                </button>
              );
            })}
          </div>

          <section aria-label="Prompt asset content" className="cockpit-prompt-drawer__body">
            <p className="cockpit-code-path">{resolvedActivePath}</p>
            {activeContent ? (
              <pre className="cockpit-prompt-drawer__content">{activeContent}</pre>
            ) : (
              <p>No content available for {getPromptLabel(resolvedActivePath)}</p>
            )}
            <button type="button">Copy prompt path</button>
          </section>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --reporter=verbose --testPathPattern=prompt-drawer`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/prompt-drawer/prompt-drawer.tsx apps/cockpit/src/components/prompt-drawer/prompt-drawer.spec.tsx
git commit -m "feat(cockpit): render raw prompt content in PromptDrawer"
```

---

### Task 9: Run full test suite and fix any breakage

**Files:**
- Possibly modify: any test file that references old prop shapes

- [ ] **Step 1: Run the full cockpit test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All tests PASS. If any test fails due to the new required `contentBundle` or `codeFiles`/`promptFiles`/`runtimeUrl` props, update those tests to provide the new props.

- [ ] **Step 2: If `pane-rendering.spec.tsx` or other integration tests fail, update them**

Any test that renders `CockpitShell` now needs a `contentBundle` prop:

```ts
const contentBundle: ContentBundle = {
  codeFiles: {},
  promptFiles: {},
  runtimeUrl: null,
};
```

Any test that renders `CodeMode` directly now needs a `codeFiles` prop:

```ts
<CodeMode entryTitle="Test" codeAssetPaths={paths} codeFiles={{}} />
```

Any test that renders `RunMode` directly now needs a `runtimeUrl` prop:

```ts
<RunMode entryTitle="Test" codeAssetPaths={paths} docsPath="/docs" runtimeUrl={null} />
```

Any test that renders `PromptDrawer` directly now needs a `promptFiles` prop:

```ts
<PromptDrawer isOpen={true} entryTitle="Test" paths={paths} promptFiles={{}} onClose={onClose} />
```

- [ ] **Step 3: Run the full test suite again to confirm**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit any test fixes**

```bash
git add -A apps/cockpit/src
git commit -m "test(cockpit): update tests for ContentBundle prop requirements"
```
