# Multi-Library Documentation Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the docs website to support agent, render, and chat libraries with independent sections, a shared landing page, dropdown library selector, and full zero-shot content for all three libraries.

**Architecture:** Config-driven multi-library approach. Extend `docs-config.ts` with a `DocsLibrary` type keyed by library ID. Dynamic route changes from `[[...slug]]` to `[library]/[section]/[slug]`. Content moves from `content/docs-v2/` to `content/docs/<library>/`. Sidebar gains a dropdown library selector.

**Tech Stack:** Next.js App Router, MDX (next-mdx-remote), TypeScript, Tailwind CSS, @cacheplane/design-tokens

---

### Task 1: Move content directory and rename files

**Files:**
- Move: `apps/website/content/docs-v2/*` → `apps/website/content/docs/agent/*`
- Rename: `apps/website/src/lib/docs-new.ts` → `apps/website/src/lib/docs.ts`
- Modify: all imports referencing `docs-new`

- [ ] **Step 1: Move content directory**

```bash
cd apps/website/content
mkdir -p docs/agent
cp -r docs-v2/* docs/agent/
rm -rf docs-v2
```

- [ ] **Step 2: Rename docs-new.ts to docs.ts**

```bash
cd apps/website/src/lib
mv docs-new.ts docs.ts
```

- [ ] **Step 3: Update imports referencing docs-new**

In `apps/website/src/app/docs/[[...slug]]/page.tsx`, change:
```ts
// Before
import { getDocBySlug, getAllDocSlugs } from '../../../lib/docs-new';
// After
import { getDocBySlug, getAllDocSlugs } from '../../../../lib/docs';
```

Note: This import path will change again in Task 3 when we restructure the route, but we fix it now so the build stays green.

- [ ] **Step 4: Rename DocsSidebarNew to DocsSidebar**

Rename `apps/website/src/components/docs/DocsSidebarNew.tsx` to `DocsSidebar.tsx`. Update the export name inside the file from `DocsSidebarNew` to `DocsSidebar`. Update the import in `apps/website/src/app/docs/[[...slug]]/page.tsx`.

- [ ] **Step 5: Rename MdxRendererNew to MdxRenderer**

In `apps/website/src/components/docs/MdxRenderer.tsx`, rename the exported function from `MdxRendererNew` to `MdxRenderer`. Update its interface from `NewProps` to `MdxRendererProps`. Update the import in `apps/website/src/app/docs/[[...slug]]/page.tsx`.

- [ ] **Step 6: Update docs.ts content directory path**

In `apps/website/src/lib/docs.ts`, update `resolveContentDir`:
```ts
const resolveContentDir = (): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs');
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs');
};
```

Note: This still returns the `content/docs` directory (not library-scoped yet). Task 2 will add the library parameter.

- [ ] **Step 7: Verify build passes**

```bash
npx nx build website
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move docs-v2 to docs/agent, rename docs-new and component suffixes"
```

---

### Task 2: Refactor docs-config.ts with multi-library types

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts`
- Modify: `apps/website/src/lib/docs.ts`

- [ ] **Step 1: Rewrite docs-config.ts**

Replace the entire file with:

```ts
export type LibraryId = 'agent' | 'render' | 'chat';

export interface DocsPage {
  title: string;
  slug: string;
  section: string;
}

export interface DocsSection {
  title: string;
  id: string;
  color: 'blue' | 'red';
  pages: DocsPage[];
}

export interface DocsLibrary {
  id: LibraryId;
  title: string;
  description: string;
  sections: DocsSection[];
}

export const docsConfig: DocsLibrary[] = [
  {
    id: 'agent',
    title: 'Agent',
    description: 'Streaming state management for LangGraph agents',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
          { title: 'Installation', slug: 'installation', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Streaming', slug: 'streaming', section: 'guides' },
          { title: 'Persistence', slug: 'persistence', section: 'guides' },
          { title: 'Interrupts', slug: 'interrupts', section: 'guides' },
          { title: 'Memory', slug: 'memory', section: 'guides' },
          { title: 'Time Travel', slug: 'time-travel', section: 'guides' },
          { title: 'Subgraphs', slug: 'subgraphs', section: 'guides' },
          { title: 'Testing', slug: 'testing', section: 'guides' },
          { title: 'Deployment', slug: 'deployment', section: 'guides' },
        ],
      },
      {
        title: 'Concepts',
        id: 'concepts',
        color: 'red',
        pages: [
          { title: 'Angular Signals', slug: 'angular-signals', section: 'concepts' },
          { title: 'LangGraph Basics', slug: 'langgraph-basics', section: 'concepts' },
          { title: 'Agent Architecture', slug: 'agent-architecture', section: 'concepts' },
          { title: 'State Management', slug: 'state-management', section: 'concepts' },
        ],
      },
      {
        title: 'API Reference',
        id: 'api',
        color: 'blue',
        pages: [
          { title: 'agent()', slug: 'agent', section: 'api' },
          { title: 'provideAgent()', slug: 'provide-agent', section: 'api' },
          { title: 'FetchStreamTransport', slug: 'fetch-stream-transport', section: 'api' },
          { title: 'MockAgentTransport', slug: 'mock-stream-transport', section: 'api' },
        ],
      },
    ],
  },
  {
    id: 'render',
    title: 'Render',
    description: 'Declarative UI rendering from JSON specifications',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
          { title: 'Installation', slug: 'installation', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Component Registry', slug: 'registry', section: 'guides' },
          { title: 'State Store', slug: 'state-store', section: 'guides' },
          { title: 'Specs & Elements', slug: 'specs', section: 'guides' },
          { title: 'Events & Handlers', slug: 'events', section: 'guides' },
        ],
      },
      {
        title: 'API Reference',
        id: 'api',
        color: 'blue',
        pages: [
          { title: 'RenderSpecComponent', slug: 'render-spec-component', section: 'api' },
          { title: 'defineAngularRegistry()', slug: 'define-angular-registry', section: 'api' },
          { title: 'signalStateStore()', slug: 'signal-state-store', section: 'api' },
          { title: 'provideRender()', slug: 'provide-render', section: 'api' },
        ],
      },
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    description: 'Pre-built chat UI components for agent interfaces',
    sections: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        color: 'blue',
        pages: [
          { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
          { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
          { title: 'Installation', slug: 'installation', section: 'getting-started' },
        ],
      },
      {
        title: 'Guides',
        id: 'guides',
        color: 'blue',
        pages: [
          { title: 'Theming', slug: 'theming', section: 'guides' },
          { title: 'Markdown Rendering', slug: 'markdown', section: 'guides' },
          { title: 'Generative UI', slug: 'generative-ui', section: 'guides' },
          { title: 'Configuration', slug: 'configuration', section: 'guides' },
        ],
      },
      {
        title: 'Components',
        id: 'components',
        color: 'red',
        pages: [
          { title: 'ChatComponent', slug: 'chat', section: 'components' },
          { title: 'ChatMessages', slug: 'chat-messages', section: 'components' },
          { title: 'ChatInput', slug: 'chat-input', section: 'components' },
          { title: 'ChatInterruptPanel', slug: 'chat-interrupt-panel', section: 'components' },
          { title: 'ChatToolCallCard', slug: 'chat-tool-call-card', section: 'components' },
          { title: 'ChatSubagentCard', slug: 'chat-subagent-card', section: 'components' },
          { title: 'ChatDebug', slug: 'chat-debug', section: 'components' },
        ],
      },
      {
        title: 'API Reference',
        id: 'api',
        color: 'blue',
        pages: [
          { title: 'provideChat()', slug: 'provide-chat', section: 'api' },
          { title: 'ChatConfig', slug: 'chat-config', section: 'api' },
          { title: 'createMockAgentRef()', slug: 'create-mock-agent-ref', section: 'api' },
        ],
      },
    ],
  },
];

export function getLibraryConfig(libraryId: string): DocsLibrary | undefined {
  return docsConfig.find((l) => l.id === libraryId);
}

export function getLibraryPages(libraryId: string): DocsPage[] {
  const lib = getLibraryConfig(libraryId);
  if (!lib) return [];
  return lib.sections.flatMap((s) => s.pages);
}

export const allDocsPages: DocsPage[] = docsConfig.flatMap((l) => l.sections.flatMap((s) => s.pages));

export function findDocsPage(library: string, section: string, slug: string): DocsPage | undefined {
  return getLibraryPages(library).find((p) => p.section === section && p.slug === slug);
}

export function getPrevNextPages(library: string, section: string, slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const pages = getLibraryPages(library);
  const idx = pages.findIndex((p) => p.section === section && p.slug === slug);
  return {
    prev: idx > 0 ? pages[idx - 1] : null,
    next: idx < pages.length - 1 ? pages[idx + 1] : null,
  };
}

export function getDocsSection(library: string, sectionId: string): DocsSection | undefined {
  const lib = getLibraryConfig(library);
  return lib?.sections.find((s) => s.id === sectionId);
}
```

- [ ] **Step 2: Update docs.ts to accept library parameter**

Replace `apps/website/src/lib/docs.ts` with:

```ts
import fs from 'fs';
import path from 'path';
import { type DocsPage, getLibraryPages } from './docs-config';

const resolveContentDir = (library: string): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library);
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs', library);
};

export interface ResolvedDoc {
  page: DocsPage;
  content: string;
  title: string;
}

export function getDocBySlug(library: string, section: string, slug: string): ResolvedDoc | null {
  const pages = getLibraryPages(library);
  const page = pages.find((p) => p.section === section && p.slug === slug);
  if (!page) return null;

  const dir = resolveContentDir(library);
  const filePath = path.join(dir, section, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    page,
    content,
    title: titleMatch?.[1] ?? page.title,
  };
}

export function getAllDocSlugs(): { library: string; section: string; slug: string }[] {
  const { docsConfig } = require('./docs-config');
  return docsConfig.flatMap((lib: any) =>
    lib.sections.flatMap((s: any) =>
      s.pages.map((p: any) => ({ library: lib.id, section: p.section, slug: p.slug }))
    )
  );
}
```

Wait — avoid `require`. Use the proper import approach:

```ts
import fs from 'fs';
import path from 'path';
import { docsConfig, type DocsPage, getLibraryPages } from './docs-config';

const resolveContentDir = (library: string): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library);
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs', library);
};

export interface ResolvedDoc {
  page: DocsPage;
  content: string;
  title: string;
}

export function getDocBySlug(library: string, section: string, slug: string): ResolvedDoc | null {
  const pages = getLibraryPages(library);
  const page = pages.find((p) => p.section === section && p.slug === slug);
  if (!page) return null;

  const dir = resolveContentDir(library);
  const filePath = path.join(dir, section, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    page,
    content,
    title: titleMatch?.[1] ?? page.title,
  };
}

export function getAllDocSlugs(): { library: string; section: string; slug: string }[] {
  return docsConfig.flatMap((lib) =>
    lib.sections.flatMap((s) =>
      s.pages.map((p) => ({ library: lib.id, section: p.section, slug: p.slug }))
    )
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add multi-library types to docs-config, library-scoped docs.ts"
```

---

### Task 3: Restructure routing

**Files:**
- Delete: `apps/website/src/app/docs/[[...slug]]/page.tsx`
- Create: `apps/website/src/app/docs/page.tsx` (landing page — placeholder for now)
- Create: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

- [ ] **Step 1: Delete old catch-all route**

```bash
rm -rf apps/website/src/app/docs/\[\[...slug\]\]
```

- [ ] **Step 2: Create docs landing page placeholder**

Create `apps/website/src/app/docs/page.tsx`:

```tsx
import Link from 'next/link';
import { docsConfig } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

export default function DocsLandingPage() {
  return (
    <div className="min-h-screen pt-24 px-6 md:px-12" style={{ background: 'var(--gradient-bg-flow)' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="font-garamond text-4xl md:text-5xl font-bold mb-4" style={{ color: tokens.colors.textPrimary }}>
          Documentation
        </h1>
        <p className="text-lg mb-12" style={{ color: tokens.colors.textSecondary }}>
          Angular Stream Resource is a suite of libraries for building AI agent interfaces.
          Choose a library to get started.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          {docsConfig.map((lib) => (
            <Link
              key={lib.id}
              href={`/docs/${lib.id}/getting-started/introduction`}
              className="block p-6 rounded-xl transition-all"
              style={{
                background: tokens.glass.bg,
                backdropFilter: `blur(${tokens.glass.blur})`,
                WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                border: `1px solid ${tokens.glass.border}`,
              }}
            >
              <h2 className="font-mono text-lg font-semibold mb-2" style={{ color: tokens.colors.accent }}>
                {lib.title}
              </h2>
              <p className="text-sm" style={{ color: tokens.colors.textSecondary }}>
                {lib.description}
              </p>
              <div className="mt-4 text-sm font-mono" style={{ color: tokens.colors.accent }}>
                Get started →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create new dynamic route page**

Create `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { DocsSidebar } from '../../../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../../../components/docs/DocsSearch';
import { getDocBySlug, getAllDocSlugs } from '../../../../../lib/docs';
import { ApiDocRenderer, type ApiDocEntry } from '../../../../../components/docs/ApiDocRenderer';
import { DocsTOC } from '../../../../../components/docs/DocsTOC';
import { DocsMobileNav } from '../../../../../components/docs/DocsMobileNav';
import { extractHeadings } from '../../../../../lib/extract-headings';
import { getLibraryConfig, type LibraryId } from '../../../../../lib/docs-config';
import fs from 'fs';
import path from 'path';

function loadApiDocs(library: string): ApiDocEntry[] {
  const candidates = [
    path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library, 'api', 'api-docs.json'),
    path.join(process.cwd(), 'content', 'docs', library, 'api', 'api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return [];
}

const API_NAME_MAP: Record<string, Record<string, string>> = {
  agent: {
    'agent': 'agent',
    'provide-agent': 'provideAgent',
    'fetch-stream-transport': 'FetchStreamTransport',
    'mock-stream-transport': 'MockAgentTransport',
  },
};

export function generateStaticParams() {
  return getAllDocSlugs().map(({ library, section, slug }) => ({ library, section, slug }));
}

export default async function DocsPage({ params }: { params: Promise<{ library: string; section: string; slug: string }> }) {
  const { library, section, slug } = await params;

  const libConfig = getLibraryConfig(library);
  if (!libConfig) notFound();

  const doc = getDocBySlug(library, section, slug);
  if (!doc) notFound();

  return (
    <div className="flex min-h-screen pt-16 overflow-x-hidden" style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSearch library={library as LibraryId} />
      <DocsSidebar activeLibrary={library as LibraryId} activeSection={section} activeSlug={slug} />
      <div className="flex-1 flex min-w-0" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
        <div className="flex-1 min-w-0">
          <div className="px-4 pt-4 sm:hidden">
            <DocsMobileNav activeLibrary={library as LibraryId} activeSection={section} activeSlug={slug} />
          </div>
          <MdxRenderer source={doc.content} library={library as LibraryId} section={section} slug={slug} title={doc.title} />
          {section === 'api' && (() => {
            const entries = loadApiDocs(library);
            const nameMap = API_NAME_MAP[library] ?? {};
            const target = nameMap[slug];
            const apiEntry = target ? entries.find((e: ApiDocEntry) => e.name === target) : null;
            return apiEntry ? (
              <div className="px-6 md:px-12 max-w-3xl pb-8">
                <ApiDocRenderer entry={apiEntry} />
              </div>
            ) : null;
          })()}
        </div>
        <DocsTOC headings={extractHeadings(doc.content)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: restructure routing to /docs/[library]/[section]/[slug]"
```

---

### Task 4: Update sidebar, mobile nav, breadcrumb, prev/next, and search components

**Files:**
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx`
- Modify: `apps/website/src/components/docs/DocsMobileNav.tsx`
- Modify: `apps/website/src/components/docs/DocsBreadcrumb.tsx`
- Modify: `apps/website/src/components/docs/DocsPrevNext.tsx`
- Modify: `apps/website/src/components/docs/DocsSearch.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`

- [ ] **Step 1: Rewrite DocsSidebar.tsx with dropdown selector**

Replace `apps/website/src/components/docs/DocsSidebar.tsx` with:

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, type DocsSection, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

interface Props {
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
}

function LibraryDropdown({ activeLibrary }: { activeLibrary: LibraryId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLib = getLibraryConfig(activeLibrary);

  return (
    <div ref={ref} className="relative px-4 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.5)',
          border: `1px solid ${tokens.glass.border}`,
          color: tokens.colors.textPrimary,
          cursor: 'pointer',
          fontWeight: 600,
        }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{currentLib?.title ?? activeLibrary}</span>
        <span style={{ color: tokens.colors.textMuted, fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
      </button>

      {open && (
        <div className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-10"
          style={{
            background: 'rgba(255,255,255,0.98)',
            border: `1px solid ${tokens.glass.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
          {docsConfig.map((lib) => (
            <button
              key={lib.id}
              onClick={() => {
                setOpen(false);
                router.push(`/docs/${lib.id}/getting-started/introduction`);
              }}
              className="w-full text-left px-3 py-2.5 text-sm flex flex-col"
              style={{
                background: lib.id === activeLibrary ? tokens.colors.accentSurface : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: lib.id === activeLibrary ? tokens.colors.accent : tokens.colors.textPrimary, fontSize: '0.8rem' }}>
                {lib.title}
              </span>
              <span style={{ fontSize: '0.7rem', color: tokens.colors.textMuted, marginTop: 2 }}>
                {lib.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionGroup({ section, activeLibrary, activeSection, activeSlug }: { section: DocsSection; activeLibrary: LibraryId; activeSection: string; activeSlug: string }) {
  const [open, setOpen] = useState(true);
  const headerColor = section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-1.5 flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: headerColor, fontWeight: 600 }}>
          {section.title}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          ▾
        </span>
      </button>

      {open && (
        <nav className="flex flex-col mt-1">
          {section.pages.map((page) => {
            const isActive = page.section === activeSection && page.slug === activeSlug;
            return (
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
                className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all"
                style={{
                  color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                  background: isActive ? tokens.colors.accentSurface : 'transparent',
                  fontSize: '0.825rem',
                }}>
                {page.title}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function DocsSidebar({ activeLibrary, activeSection, activeSlug }: Props) {
  const libConfig = getLibraryConfig(activeLibrary);

  return (
    <aside
      className="w-64 shrink-0 py-6 overflow-y-auto hidden md:block"
      style={{
        borderRight: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        minHeight: 'calc(100vh - 4rem)',
        position: 'sticky',
        top: '4rem',
      }}>
      {/* Search trigger */}
      <div className="px-4 mb-4">
        <button
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: `1px solid ${tokens.glass.border}`,
            color: tokens.colors.textMuted,
            cursor: 'pointer',
          }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <span style={{ fontSize: '0.8rem' }}>Search docs...</span>
          <span style={{
            background: tokens.colors.accentSurface,
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: tokens.colors.accent,
          }}>⌘K</span>
        </button>
      </div>

      {/* Library dropdown */}
      <LibraryDropdown activeLibrary={activeLibrary} />

      {/* Section groups */}
      {libConfig?.sections.map((section) => (
        <SectionGroup
          key={section.id}
          section={section}
          activeLibrary={activeLibrary}
          activeSection={activeSection}
          activeSlug={activeSlug}
        />
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: Update DocsMobileNav.tsx**

Replace `apps/website/src/components/docs/DocsMobileNav.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

export function DocsMobileNav({ activeLibrary, activeSection, activeSlug }: { activeLibrary: LibraryId; activeSection: string; activeSlug: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const libConfig = getLibraryConfig(activeLibrary);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 mb-4 rounded-lg text-sm font-mono"
        style={{
          background: tokens.glass.bg,
          border: `1px solid ${tokens.glass.border}`,
          color: tokens.colors.textSecondary,
        }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
        {open ? 'Hide menu' : 'Docs menu'}
      </button>

      {open && (
        <nav className="mb-6 rounded-lg overflow-hidden"
          style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
          }}>
          {/* Library selector */}
          <div className="flex border-b" style={{ borderColor: tokens.glass.border }}>
            {docsConfig.map((lib) => (
              <button
                key={lib.id}
                onClick={() => {
                  if (lib.id !== activeLibrary) {
                    router.push(`/docs/${lib.id}/getting-started/introduction`);
                    setOpen(false);
                  }
                }}
                className="flex-1 py-2 text-xs font-mono text-center"
                style={{
                  background: lib.id === activeLibrary ? tokens.colors.accentSurface : 'transparent',
                  color: lib.id === activeLibrary ? tokens.colors.accent : tokens.colors.textMuted,
                  fontWeight: lib.id === activeLibrary ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                }}>
                {lib.title}
              </button>
            ))}
          </div>

          {libConfig?.sections.map((section) => (
            <div key={section.id} className="py-2">
              <div className="px-4 py-1 font-mono text-xs uppercase tracking-wider"
                style={{ color: section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent, fontWeight: 600 }}>
                {section.title}
              </div>
              {section.pages.map((page) => {
                const isActive = page.section === activeSection && page.slug === activeSlug;
                return (
                  <Link
                    key={`${page.section}/${page.slug}`}
                    href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-1.5 text-sm"
                    style={{
                      color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                      background: isActive ? tokens.colors.accentSurface : 'transparent',
                    }}>
                    {page.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update DocsBreadcrumb.tsx**

Replace `apps/website/src/components/docs/DocsBreadcrumb.tsx` with:

```tsx
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { getDocsSection, getLibraryConfig, type LibraryId } from '../../lib/docs-config';

export function DocsBreadcrumb({ library, section, title }: { library: LibraryId; section: string; title: string }) {
  const libConfig = getLibraryConfig(library);
  const sectionData = getDocsSection(library, section);
  return (
    <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: tokens.colors.textMuted }}>
      <Link href="/docs" style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>Docs</Link>
      <span>›</span>
      <Link href={`/docs/${library}/getting-started/introduction`} style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>{libConfig?.title ?? library}</Link>
      <span>›</span>
      <span>{sectionData?.title ?? section}</span>
      <span>›</span>
      <span style={{ color: tokens.colors.textSecondary }}>{title}</span>
    </div>
  );
}
```

- [ ] **Step 4: Update DocsPrevNext.tsx**

Replace `apps/website/src/components/docs/DocsPrevNext.tsx` with:

```tsx
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { getPrevNextPages, type LibraryId } from '../../lib/docs-config';

export function DocsPrevNext({ library, section, slug }: { library: LibraryId; section: string; slug: string }) {
  const { prev, next } = getPrevNextPages(library, section, slug);

  return (
    <div className="flex justify-between gap-4 mt-12 pt-8" style={{ borderTop: `1px solid ${tokens.glass.border}` }}>
      {prev ? (
        <Link href={`/docs/${library}/${prev.section}/${prev.slug}`} style={{ textDecoration: 'none', flex: 1 }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>← Previous</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{prev.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
      {next ? (
        <Link href={`/docs/${library}/${next.section}/${next.slug}`} style={{ textDecoration: 'none', flex: 1, textAlign: 'right' }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>Next →</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{next.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );
}
```

- [ ] **Step 5: Update DocsSearch.tsx**

Replace `apps/website/src/components/docs/DocsSearch.tsx` with:

```tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { docsConfig, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

interface SearchablePage {
  title: string;
  slug: string;
  section: string;
  library: LibraryId;
  libraryTitle: string;
}

const allSearchablePages: SearchablePage[] = docsConfig.flatMap((lib) =>
  lib.sections.flatMap((s) =>
    s.pages.map((p) => ({
      ...p,
      library: lib.id,
      libraryTitle: lib.title,
    }))
  )
);

export function DocsSearch({ library }: { library?: LibraryId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = query.length > 0
    ? allSearchablePages.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.slug.toLowerCase().includes(query.toLowerCase()) ||
        p.section.toLowerCase().includes(query.toLowerCase()) ||
        p.libraryTitle.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : allSearchablePages.filter((p) => !library || p.library === library).slice(0, 6);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = (page: SearchablePage) => {
    router.push(`/docs/${page.library}/${page.section}/${page.slug}`);
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected]); }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '20vh',
    }} onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          borderRadius: 12,
          boxShadow: '0 16px 64px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.glass.border}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search documentation..."
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontFamily: 'var(--font-inter)', fontSize: '0.95rem',
              color: tokens.colors.textPrimary, background: 'transparent',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {results.map((page, i) => (
            <button
              key={`${page.library}/${page.section}/${page.slug}`}
              onClick={() => navigate(page)}
              className="w-full text-left"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8,
                background: i === selected ? tokens.colors.accentSurface : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%',
              }}>
              <span style={{ fontSize: '0.875rem', color: tokens.colors.textPrimary }}>{page.title}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: tokens.colors.textMuted, background: 'rgba(0,0,0,0.04)',
                padding: '2px 6px', borderRadius: 4,
              }}>{page.libraryTitle}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: tokens.colors.textMuted, fontSize: '0.85rem' }}>
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update MdxRenderer.tsx**

In `apps/website/src/components/docs/MdxRenderer.tsx`:

- Add `library` to the props interface
- Pass `library` to `DocsBreadcrumb` and `DocsPrevNext`
- Rename the interface from `NewProps` to `MdxRendererProps`
- Rename the function from `MdxRendererNew` to `MdxRenderer`

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { tokens } from '../../../lib/design-tokens';
import { Callout } from './mdx/Callout';
import { Steps, Step } from './mdx/Steps';
import { Tabs, Tab } from './mdx/Tabs';
import { Card, CardGroup } from './mdx/Card';
import { CodeGroup } from './mdx/CodeGroup';
import { Pre } from './mdx/CodeBlock';
import { FeatureChips } from './mdx/FeatureChips';
import { ArchFlowDiagram } from './ArchFlowDiagram';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocsPrevNext } from './DocsPrevNext';
import { type LibraryId } from '../../lib/docs-config';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';

const mdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  CardGroup,
  CodeGroup,
  ArchFlowDiagram,
  FeatureChips,
  pre: Pre,
};

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

interface MdxRendererProps {
  source: string;
  library: LibraryId;
  section: string;
  slug: string;
  title: string;
}

export function MdxRenderer({ source, library, section, slug, title }: MdxRendererProps) {
  return (
    <div className="flex-1 py-8 px-4 sm:px-6 md:px-12 md:max-w-3xl overflow-x-hidden">
      <DocsBreadcrumb library={library} section={section} title={title} />
      <article className="docs-prose prose prose-slate max-w-none"
        style={{
          '--tw-prose-body': tokens.colors.textSecondary,
          '--tw-prose-headings': tokens.colors.textPrimary,
          '--tw-prose-code': tokens.colors.accent,
          '--tw-prose-links': tokens.colors.accent,
        } as React.CSSProperties}>
        <MDXRemote
          source={source}
          components={mdxComponents}
          options={{
            mdxOptions: {
              rehypePlugins: [rehypeSlug, [rehypePrettyCode, rehypeOptions] as any],
            },
          }}
        />
      </article>
      <DocsPrevNext library={library} section={section} slug={slug} />
    </div>
  );
}
```

- [ ] **Step 7: Update Nav.tsx API link**

In `apps/website/src/components/shared/Nav.tsx`, update the API link:

```ts
// Before
{ label: 'API', href: '/docs/api/agent', external: false },
// After
{ label: 'API', href: '/docs/agent/api/agent', external: false },
```

- [ ] **Step 8: Verify build passes**

```bash
npx nx build website
```

Expected: Build succeeds. Only agent pages will render (render/chat content doesn't exist yet).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add library dropdown selector, update all docs components for multi-lib"
```

---

### Task 5: Author render library docs content

**Files:**
- Create: `apps/website/content/docs/render/getting-started/introduction.mdx`
- Create: `apps/website/content/docs/render/getting-started/quickstart.mdx`
- Create: `apps/website/content/docs/render/getting-started/installation.mdx`
- Create: `apps/website/content/docs/render/guides/registry.mdx`
- Create: `apps/website/content/docs/render/guides/state-store.mdx`
- Create: `apps/website/content/docs/render/guides/specs.mdx`
- Create: `apps/website/content/docs/render/guides/events.mdx`
- Create: `apps/website/content/docs/render/api/render-spec-component.mdx`
- Create: `apps/website/content/docs/render/api/define-angular-registry.mdx`
- Create: `apps/website/content/docs/render/api/signal-state-store.mdx`
- Create: `apps/website/content/docs/render/api/provide-render.mdx`

Write all render library MDX content. Each file should:
- Start with an H1 title
- Use existing MDX components (Callout, Steps, Tabs, CodeGroup) where appropriate
- Include real code examples derived from the library's actual API
- Reference the `@cacheplane/render` package and `@json-render/core` dependency

**Key source context for content authoring:**

The render library exports: `RenderSpecComponent` (selector: `render-spec`), `RenderElementComponent` (selector: `render-element`, internal), `defineAngularRegistry(componentMap)`, `signalStateStore(initialState)`, `provideRender(config)`, `RENDER_CONTEXT`, `REPEAT_SCOPE`, `RENDER_CONFIG`.

Types: `AngularRegistry` (get/names methods), `AngularComponentRenderer` (Type<unknown>), `AngularComponentInputs` (bindings, emit, loading, childKeys, spec), `RenderConfig` (registry, store, functions, handlers), `RenderContext`, `RepeatScope` (item, index, basePath).

The spec format comes from `@json-render/core`: `Spec` has `root` (key), `elements` (record of UIElement), `state` (initial state model). `UIElement` has `type` (component name), `props`, `children`, `visible`, `repeat` (statePath), `on` (event handlers).

Peer deps: `@angular/core ^20`, `@angular/common ^20`, `@json-render/core ^0.16.0`.

- [ ] **Step 1: Create all render docs content files**

Create each file with full MDX content. The subagent should read the render library source at `libs/render/src/` to write accurate docs with real code examples.

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/render/
git commit -m "docs: author render library documentation"
```

---

### Task 6: Author chat library docs content

**Files:**
- Create: `apps/website/content/docs/chat/getting-started/introduction.mdx`
- Create: `apps/website/content/docs/chat/getting-started/quickstart.mdx`
- Create: `apps/website/content/docs/chat/getting-started/installation.mdx`
- Create: `apps/website/content/docs/chat/guides/theming.mdx`
- Create: `apps/website/content/docs/chat/guides/markdown.mdx`
- Create: `apps/website/content/docs/chat/guides/generative-ui.mdx`
- Create: `apps/website/content/docs/chat/guides/configuration.mdx`
- Create: `apps/website/content/docs/chat/components/chat.mdx`
- Create: `apps/website/content/docs/chat/components/chat-messages.mdx`
- Create: `apps/website/content/docs/chat/components/chat-input.mdx`
- Create: `apps/website/content/docs/chat/components/chat-interrupt-panel.mdx`
- Create: `apps/website/content/docs/chat/components/chat-tool-call-card.mdx`
- Create: `apps/website/content/docs/chat/components/chat-subagent-card.mdx`
- Create: `apps/website/content/docs/chat/components/chat-debug.mdx`
- Create: `apps/website/content/docs/chat/api/provide-chat.mdx`
- Create: `apps/website/content/docs/chat/api/chat-config.mdx`
- Create: `apps/website/content/docs/chat/api/create-mock-agent-ref.mdx`

Write all chat library MDX content. Each file should:
- Start with an H1 title
- Use existing MDX components (Callout, Steps, Tabs, CodeGroup) where appropriate
- Include real code examples derived from the library's actual API
- Reference the `@cacheplane/chat` package

**Key source context for content authoring:**

Chat has two tiers: **Primitives** (single-responsibility) and **Compositions** (feature-complete).

Primitives: `ChatMessagesComponent` (selector: `chat-messages`, inputs: messages, ref, config), `MessageTemplateDirective`, `ChatInputComponent` (selector: `chat-input`), `ChatTypingIndicatorComponent`, `ChatErrorComponent`, `ChatInterruptComponent`, `ChatToolCallsComponent`, `ChatSubagentsComponent`, `ChatThreadListComponent`, `ChatTimelineComponent`, `ChatGenerativeUiComponent`.

Compositions: `ChatComponent` (selector: `chat-root`, inputs: ref), `ChatInterruptPanelComponent`, `ChatToolCallCardComponent`, `ChatSubagentCardComponent`, `ChatTimelineSliderComponent`, `ChatDebugComponent`.

Provider: `provideChat(config: ChatConfig)` with `CHAT_CONFIG` injection token. `ChatConfig` has: `renderRegistry?: AngularRegistry`, `avatarLabel?: string`, `assistantName?: string`.

Testing: `createMockAgentRef()` returns a mock `AgentRef` (previously `StreamResourceRef`) with writable signals for all properties.

Styles: `CHAT_THEME_STYLES` (CSS variables), `CHAT_MARKDOWN_STYLES`, `renderMarkdown(md)`.

Deps: `@angular/core`, `@angular/common`, `@angular/forms`, `@cacheplane/agent`, `@cacheplane/render`, `@langchain/core`, `@langchain/langgraph-sdk`, `marked`.

- [ ] **Step 1: Create all chat docs content files**

Create each file with full MDX content. The subagent should read the chat library source at `libs/chat/src/` to write accurate docs with real code examples.

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/
git commit -m "docs: author chat library documentation"
```

---

### Task 7: Update any remaining references and final build verification

**Files:**
- Modify: `apps/website/src/app/llms.txt/route.ts` (if it references old doc paths)
- Modify: `apps/website/src/app/llms-full.txt/route.ts` (if it references old doc paths)
- Check: any other files referencing `docs-v2`, `docs-new`, `DocsSidebarNew`, or `MdxRendererNew`

- [ ] **Step 1: Search for stale references**

```bash
grep -r "docs-v2\|docs-new\|DocsSidebarNew\|MdxRendererNew\|NewProps" apps/website/src/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining references found.

- [ ] **Step 2: Search for old URL patterns in content**

```bash
grep -r "href=\"/docs/[a-z]" apps/website/src/ --include="*.ts" --include="*.tsx" | grep -v "/docs/agent\|/docs/render\|/docs/chat\|/docs\""
```

Fix any old `/docs/section/slug` links that should now be `/docs/library/section/slug`.

- [ ] **Step 3: Full build verification**

```bash
npx nx build website
```

Expected: Clean build with all pages generated for all three libraries.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: clean up stale references to old docs structure"
```
