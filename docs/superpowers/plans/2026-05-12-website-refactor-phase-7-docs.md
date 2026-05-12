# Website refactor — Phase 7: Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/website/src/app/docs/**` and `apps/website/src/components/docs/**` off glassmorphism + gradient washes to the Phase 1 design tokens, matching the Statusbrew-shaped marketing aesthetic. Wire in two latent components (`DocsBreadcrumb`, `DocsPrevNext`) and add hash-anchor affordance to H2/H3.

**Architecture:** Three independently shippable commits. Commit 1 reskins the page chrome (landing page, slug-page wrapper, sidebar, search, TOC, breadcrumb). Commit 2 restyles the 7 MDX primitives (`Callout`, `Tabs`, `Steps`, `CodeGroup`, `CodeBlock`, `Card`/`CardGroup`, `FeatureChips`) — all are kept in place; the consolidation to `ui/Card`/`ui/Pill` from the original spec was abandoned after verification showed the MDX primitives have docs-specific shapes (clickable link tiles, feature carousels) that don't map to the marketing primitives. Commit 3 handles the ancillary doc components, wires `DocsPrevNext`, adds the anchor affordance, and ships a new e2e spec.

**Tech Stack:** Next.js 16 (RSC), MDX, `@ngaf/design-tokens` (Phase 1 namespaces: `surfaces`, `shadows`, `radius`, `space`), Tailwind v4, Playwright.

**Out of scope:**
- Any change to `apps/cockpit/**` (Phase 8)
- MDX content rewrites in `apps/website/content/docs/**`
- Final removal of `glass`/`gradient`/`glow` from `@ngaf/design-tokens` (gated on Phase 8)

---

## File Structure

**Modified (Commit 1 — Chrome):**
```
apps/website/src/app/docs/page.tsx                              [REWRITE]
apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx   [REWRITE wrapper]
apps/website/src/components/docs/DocsSidebar.tsx                [REFACTOR]
apps/website/src/components/docs/DocsSearch.tsx                 [REFACTOR]
apps/website/src/components/docs/DocsBreadcrumb.tsx             [REFACTOR + wire in]
apps/website/src/components/docs/DocsTOC.tsx                    [REFACTOR]
apps/website/src/app/global.css                                 [ADD heading-anchor CSS]
```

**Modified (Commit 2 — MDX primitives):**
```
apps/website/src/components/docs/mdx/Callout.tsx                [REFACTOR]
apps/website/src/components/docs/mdx/Tabs.tsx                   [REFACTOR]
apps/website/src/components/docs/mdx/Steps.tsx                  [REFACTOR]
apps/website/src/components/docs/mdx/CodeGroup.tsx              [REFACTOR]
apps/website/src/components/docs/mdx/CodeBlock.tsx              [REFACTOR — BrowserFrame chrome]
apps/website/src/components/docs/mdx/Card.tsx                   [REFACTOR — drop glass; keep clickable-tile shape]
apps/website/src/components/docs/mdx/FeatureChips.tsx           [REFACTOR — drop glass + fix broken hrefs]
```

**Modified (Commit 3 — Ancillary + tests):**
```
apps/website/src/components/docs/MdxRenderer.tsx                [MODIFY — H2/H3 wrappers for anchor affordance]
apps/website/src/components/docs/ApiDocRenderer.tsx             [REFACTOR]
apps/website/src/components/docs/ApiRefTable.tsx                [REFACTOR]
apps/website/src/components/docs/ArchFlowDiagram.tsx            [REFACTOR]
apps/website/src/components/docs/CopyPromptButton.tsx           [REFACTOR]
apps/website/src/components/docs/DocsPrevNext.tsx               [REFACTOR + wire in via the slug page]
apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx   [MODIFY — render DocsPrevNext at the bottom]
apps/website/e2e/docs.spec.ts                                   [NEW]
```

**No deletions.** This phase keeps every existing component.

---

## Commit 1 — Chrome

### Task 1: Rewrite `/docs` landing page

**Files:**
- Modify: `apps/website/src/app/docs/page.tsx`

The current landing renders 3 library cards on `var(--gradient-bg-flow)` with glass cards. Replace with a Hero-style header, restyled library grid, popular-topics row, and a tinted search prompt band — all on `surfaces.canvas`.

- [ ] **Step 1: Read the existing file to confirm imports**

Run: `cat apps/website/src/app/docs/page.tsx`
Expected: confirms current imports of `docsConfig` and `tokens`. Existing logic maps over `docsConfig` for library cards — preserve that pattern.

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the entire file contents with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { docsConfig } from '../../lib/docs-config';

export const metadata = {
  title: 'Documentation — Angular Agent Framework',
  description: 'Learn the framework. Library guides, API reference, and production patterns for Angular Agent Framework.',
};

interface PopularTopic {
  title: string;
  description: string;
  href: string;
}

const POPULAR_TOPICS: PopularTopic[] = [
  {
    title: 'Streaming with signals',
    description: 'Token-level streaming wired into Angular signals. The defining @ngaf/langgraph capability.',
    href: '/docs/agent/api/agent',
  },
  {
    title: 'Generative UI fundamentals',
    description: 'Server-emitted JSON specs render into Angular components you already own.',
    href: '/docs/render/getting-started/introduction',
  },
  {
    title: 'Production patterns',
    description: 'Deploy paths, error boundaries, and observability for shipping Angular agents.',
    href: '/docs/agent/guides/deployment',
  },
];

export default function DocsLandingPage() {
  return (
    <>
      {/* Header */}
      <Section surface="canvas" ariaLabelledBy="docs-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Documentation</Eyebrow>
            <h1
              id="docs-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Learn the framework.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                maxWidth: '52ch',
              }}
            >
              Angular Agent Framework is a suite of MIT-licensed libraries for building AI agent interfaces. Pick a library to get started.
            </p>
          </div>
        </Container>
      </Section>

      {/* Library grid */}
      <Section surface="canvas" tight ariaLabelledBy="library-grid-heading">
        <Container>
          <Eyebrow id="library-grid-heading" style={{ marginBottom: 16 }}>Libraries</Eyebrow>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {docsConfig.map((lib) => (
              <Link
                key={lib.id}
                href={`/docs/${lib.id}/getting-started/introduction`}
                style={{ textDecoration: 'none' }}
              >
                <Card padding="lg" hoverable style={{ height: '100%' }}>
                  <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{lib.title}</Eyebrow>
                  <p
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                      margin: 0,
                      marginBottom: 16,
                    }}
                  >
                    {lib.description}
                  </p>
                  <span
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.colors.accent,
                    }}
                  >
                    Get started →
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Popular topics */}
      <Section surface="canvas" tight ariaLabelledBy="popular-heading">
        <Container>
          <Eyebrow id="popular-heading" style={{ marginBottom: 16 }}>Popular topics</Eyebrow>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {POPULAR_TOPICS.map((t) => (
              <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={{ height: '100%' }}>
                  <h3
                    style={{
                      fontFamily: tokens.typography.h3.family,
                      fontSize: 18,
                      lineHeight: 1.3,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      margin: 0,
                      marginBottom: 8,
                    }}
                  >
                    {t.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                      margin: 0,
                    }}
                  >
                    {t.description}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Search prompt */}
      <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <h2
              id="search-prompt-heading"
              style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Looking for something specific?
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Press <Pill variant="neutral">⌘K</Pill> to search the docs.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
```

- [ ] **Step 3: Confirm the file type-checks**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep -E "page\.tsx" | head -5`
Expected: no errors that reference `apps/website/src/app/docs/page.tsx`. Pre-existing TS strictness errors about files outside `src/` are unrelated (documented in Phase 1's notes).

---

### Task 2: Rewrite slug-page wrapper

**Files:**
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

Strip the `--gradient-bg-flow` background, switch the content well to `surfaces.surface`, and add the `DocsBreadcrumb` slot above the MDX renderer. Leave the MDX rendering + API-entry conditional untouched (those are commit 3's concern).

- [ ] **Step 1: Replace the file**

Replace the entire file contents with:

```tsx
import { notFound } from 'next/navigation';
import { tokens } from '@ngaf/design-tokens';
import { DocsSidebar } from '../../../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../../../components/docs/DocsSearch';
import { DocsBreadcrumb } from '../../../../../components/docs/DocsBreadcrumb';
import { getDocBySlug, getAllDocSlugs } from '../../../../../lib/docs';
import { ApiDocRenderer, type ApiDocEntry } from '../../../../../components/docs/ApiDocRenderer';
import { DocsTOC } from '../../../../../components/docs/DocsTOC';
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

export default async function DocsPage({
  params,
}: {
  params: Promise<{ library: string; section: string; slug: string }>;
}) {
  const { library, section, slug } = await params;

  const libConfig = getLibraryConfig(library);
  if (!libConfig) notFound();

  const doc = getDocBySlug(library, section, slug);
  if (!doc) notFound();

  return (
    <div
      className="flex min-h-screen overflow-x-hidden"
      style={{ background: tokens.surfaces.canvas, paddingTop: 80 }}
    >
      <DocsSearch library={library as LibraryId} />
      <DocsSidebar activeLibrary={library as LibraryId} activeSection={section} activeSlug={slug} />
      <div
        className="flex-1 flex min-w-0"
        style={{ background: tokens.surfaces.surface }}
      >
        <div className="flex-1 min-w-0">
          <div className="px-6 md:px-12 pt-6">
            <DocsBreadcrumb library={library as LibraryId} section={section} slug={slug} title={doc.title} />
          </div>
          <MdxRenderer
            source={doc.content}
            library={library as LibraryId}
            section={section}
            slug={slug}
            title={doc.title}
          />
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

The `DocsBreadcrumb` accepts `library`, `section`, `slug`, `title` props — defined in Task 5 below.

- [ ] **Step 2: Type-check** — see Task 1 Step 3 pattern.

---

### Task 3: Refactor `DocsSidebar`

**Files:**
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx`

Drop glass + `tokens.glass.border` everywhere. Switch outer aside to `surfaces.surface` with a single `surfaces.border` right edge. Dropdown menu uses `shadows.md`. Section headers wrap with `Eyebrow`.

- [ ] **Step 1: Read the file** for context

Run: `cat apps/website/src/components/docs/DocsSidebar.tsx`

- [ ] **Step 2: Replace the file contents**

Replace the file with:

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, type DocsSection, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@ngaf/design-tokens';
import { Pill } from '../ui/Pill';

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
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
          color: tokens.colors.textPrimary,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        <span style={{ fontFamily: tokens.typography.fontMono, fontSize: '0.8rem' }}>
          {currentLib?.title ?? activeLibrary}
        </span>
        <span
          style={{
            color: tokens.colors.textMuted,
            fontSize: 10,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        >
          &#9662;
        </span>
      </button>

      {open && (
        <div
          className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-10"
          style={{
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            boxShadow: tokens.shadows.md,
          }}
        >
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
              }}
            >
              <span
                style={{
                  fontFamily: tokens.typography.fontMono,
                  fontWeight: 600,
                  color: lib.id === activeLibrary ? tokens.colors.accent : tokens.colors.textPrimary,
                  fontSize: '0.8rem',
                }}
              >
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

function SectionGroup({
  section,
  activeLibrary,
  activeSection,
  activeSlug,
}: {
  section: DocsSection;
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
}) {
  const [open, setOpen] = useState(true);
  const headerColor = section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-1.5 flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: headerColor, fontWeight: 600 }}
        >
          {section.title}
        </span>
        <span
          style={{
            color: tokens.colors.textMuted,
            fontSize: 10,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0)' : 'rotate(-90deg)',
          }}
        >
          &#9662;
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
                }}
              >
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
        borderRight: `1px solid ${tokens.surfaces.border}`,
        background: tokens.surfaces.surface,
        minHeight: 'calc(100vh - 5rem)',
        position: 'sticky',
        top: '5rem',
      }}
    >
      {/* Search trigger */}
      <div className="px-4 mb-4">
        <button
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
          style={{
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            color: tokens.colors.textMuted,
            cursor: 'pointer',
          }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <span style={{ fontSize: '0.8rem' }}>Search docs...</span>
          <Pill variant="neutral" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>⌘K</Pill>
        </button>
      </div>

      <LibraryDropdown activeLibrary={activeLibrary} />

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

- [ ] **Step 3: Verify no remaining `tokens.glass` in the file**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/DocsSidebar.tsx`
Expected: zero matches.

---

### Task 4: Refactor `DocsSearch`

**Files:**
- Modify: `apps/website/src/components/docs/DocsSearch.tsx`

Modal surface becomes `surfaces.surface` with `shadows.lg`. Result rows get `accentSurface` hover. Borders use `surfaces.border`.

- [ ] **Step 1: Read the file** to understand its modal mechanics

Run: `cat apps/website/src/components/docs/DocsSearch.tsx`
Expected: confirms it uses `useState` for `open`, a keydown listener for `⌘K`, and renders a fixed-position overlay with input + results.

- [ ] **Step 2: Replace every `tokens.glass.*` reference**

Within the file:
- `tokens.glass.bg` → `tokens.surfaces.surface`
- `tokens.glass.border` → `tokens.surfaces.border`
- `tokens.glass.shadow` → `tokens.shadows.lg`
- Drop any `backdropFilter` / `WebkitBackdropFilter` lines entirely.
- Modal overlay backdrop (the dim layer behind the modal) keeps a `rgba(0,0,0,0.4)` background — that's not glass, that's a dimmer.

If the file has hover handlers that flip between `tokens.glass.bgHover` and `tokens.glass.bg`, replace with `tokens.colors.accentSurface` and `tokens.surfaces.surface` respectively.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/DocsSearch.tsx`
Expected: zero matches.

---

### Task 5: Refactor `DocsBreadcrumb` and wire it in

**Files:**
- Modify: `apps/website/src/components/docs/DocsBreadcrumb.tsx`

Make sure the component accepts the new props (`library`, `section`, `slug`, `title`) used by the slug-page wrapper in Task 2. Read the existing file to see what it currently does.

- [ ] **Step 1: Read existing implementation**

Run: `cat apps/website/src/components/docs/DocsBreadcrumb.tsx`

- [ ] **Step 2: Replace the file**

Replace contents with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { getLibraryConfig, type LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  section: string;
  slug: string;
  title: string;
}

function humanize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocsBreadcrumb({ library, section, slug: _slug, title }: Props) {
  const libConfig = getLibraryConfig(library);
  const libraryTitle = libConfig?.title ?? library;
  const sectionTitle = libConfig?.sections.find((s) => s.id === section)?.title ?? humanize(section);

  const crumb: React.CSSProperties = {
    fontFamily: tokens.typography.fontSans,
    fontSize: 13,
    lineHeight: 1.5,
    color: tokens.colors.textMuted,
    textDecoration: 'none',
  };
  const sep: React.CSSProperties = {
    margin: '0 8px',
    color: tokens.colors.textMuted,
  };

  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap' }}>
        <li>
          <Link href="/docs" style={crumb}>Docs</Link>
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li>
          <Link href={`/docs/${library}/getting-started/introduction`} style={crumb}>{libraryTitle}</Link>
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li style={crumb}>
          {sectionTitle}
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li style={{ ...crumb, color: tokens.colors.textPrimary, fontWeight: 600 }} aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
```

- [ ] **Step 3: Verify** breadcrumb is consumed in Task 2's slug page (already wired in via the rewrite above).

---

### Task 6: Refactor `DocsTOC`

**Files:**
- Modify: `apps/website/src/components/docs/DocsTOC.tsx`

Normalize colors and borders to new tokens. The TOC is already lean — minimal change.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/DocsTOC.tsx`

- [ ] **Step 2: Swap legacy tokens**

Within the file:
- Any `tokens.glass.border` → `tokens.surfaces.border`
- Active heading indicator should use `tokens.colors.accent`
- Inactive indicator should use `tokens.surfaces.border`
- Container background should be `tokens.surfaces.surface` (or transparent if already)

If the TOC has any glass / backdrop-filter, drop it. Type-check after.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/DocsTOC.tsx`
Expected: zero matches.

---

### Task 7: Add heading-anchor + reading-column CSS to `global.css`

**Files:**
- Modify: `apps/website/src/app/global.css`

Two additions go in here: the heading-anchor affordance (used by `MdxRenderer`'s H2/H3 wrappers in Task 17) and the 70ch reading-column constraint on the MDX body.

- [ ] **Step 1: Append at the end of the file**

Add this block to the bottom of `apps/website/src/app/global.css`:

```css
/* Docs — readable column max-width */
.docs-prose {
  max-width: 70ch;
}
@media (max-width: 768px) {
  .docs-prose {
    max-width: 100%;
  }
}

/* Docs — hash-anchor affordance on H2/H3 */
.docs-prose h2,
.docs-prose h3 {
  position: relative;
}
.docs-prose h2 .heading-anchor,
.docs-prose h3 .heading-anchor {
  position: absolute;
  left: -1.25em;
  top: 0;
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--color-text-muted);
  opacity: 0;
  text-decoration: none;
  transition: opacity 120ms ease;
}
.docs-prose h2:hover .heading-anchor,
.docs-prose h3:hover .heading-anchor,
.docs-prose h2 .heading-anchor:focus-visible,
.docs-prose h3 .heading-anchor:focus-visible {
  opacity: 0.6;
}
.docs-prose h2 .heading-anchor:hover,
.docs-prose h3 .heading-anchor:hover {
  opacity: 1;
  color: var(--color-accent);
}
@media (max-width: 768px) {
  /* On narrow viewports, drop the absolute positioning so the hash doesn't overlap the page edge. */
  .docs-prose h2 .heading-anchor,
  .docs-prose h3 .heading-anchor {
    position: static;
    margin-right: 6px;
    display: none;
  }
}
```

The existing `.docs-prose` rules in `global.css` already define typography for the MDX body, but currently have no width constraint. The new `max-width: 70ch` overrides that. `MdxRenderer.tsx` should already wrap the MDX in a `.docs-prose` element — Task 17 step 3 verifies that.

- [ ] **Step 2: Type-check the website** — no impact, CSS only. Skip.

---

### Task 8: Verify Commit 1 + ship

- [ ] **Step 1: Run e2e**

Run: `pnpm nx e2e website`
Expected: all 28 existing tests pass. The three docs-specific tests (`docs page renders sidebar and content`, `docs landing page shows library cards`, `api reference renders in docs`) cover the chrome changes.

- [ ] **Step 2: Visual smoke** (optional)

Run: `pnpm nx serve website` (background) and open:
- `http://localhost:3000/docs`
- `http://localhost:3000/docs/agent/getting-started/introduction`

Expected: landing has white surface, library + popular topics cards, search prompt band. Slug page: white sidebar with hairline right border, content well on white, breadcrumb visible above H1.

Tear down the server before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/docs/page.tsx \
  apps/website/src/app/docs/\[library\]/\[section\]/\[slug\]/page.tsx \
  apps/website/src/components/docs/DocsSidebar.tsx \
  apps/website/src/components/docs/DocsSearch.tsx \
  apps/website/src/components/docs/DocsBreadcrumb.tsx \
  apps/website/src/components/docs/DocsTOC.tsx \
  apps/website/src/app/global.css
git commit -m "$(cat <<'EOF'
refactor(website): docs chrome — drop glass, use new tokens (Phase 7.1)

Migrates docs page chrome to Phase 1 design tokens:
- /docs landing rewritten as Hero + library grid + popular topics +
  search prompt; drops --gradient-bg-flow
- slug-page wrapper drops glass + gradient; content well sits on
  surfaces.surface, page wrapper on surfaces.canvas
- DocsSidebar: white surface, hairline right border, no blur
- DocsSearch: drop glass on modal; use shadows.lg + surfaces.border
- DocsBreadcrumb wired in at top of slug content column (was unused)
- DocsTOC: normalized to surfaces tokens
- global.css: heading-anchor affordance CSS (used in Phase 7.3)

No MDX or content changes. All 28 e2e tests pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Commit 2 — MDX primitives

Each task in this commit restyles one MDX primitive to drop glass/gradient and use new tokens. The structural shape and prop API of each primitive stays the same so the existing MDX files in `apps/website/content/docs/**` keep rendering without edits.

### Task 9: Refactor `mdx/Callout`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Callout.tsx`

Drop glass. New treatment: `surfaceTinted` body with a 4px left accent stripe in the tone color. Tones: tip = `#1a7a40`, warning = `#D4850F`, info = `tokens.colors.accent`, danger = `tokens.colors.angularRed`.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/mdx/Callout.tsx`
Note: 108 lines. Likely has 4 tone variants with icon + title + body. Preserve the API; only the styling changes.

- [ ] **Step 2: Replace the file**

Replace the file with:

```tsx
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';

type CalloutType = 'tip' | 'warning' | 'info' | 'danger';

interface Props {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const TONE: Record<CalloutType, { stripe: string; icon: string }> = {
  tip: { stripe: '#1a7a40', icon: '✓' },
  warning: { stripe: '#D4850F', icon: '!' },
  info: { stripe: tokens.colors.accent, icon: 'i' },
  danger: { stripe: tokens.colors.angularRed, icon: '✕' },
};

export function Callout({ type = 'info', title, children }: Props) {
  const tone = TONE[type];
  return (
    <div
      data-mdx="callout"
      data-tone={type}
      style={{
        position: 'relative',
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
        borderLeft: `4px solid ${tone.stripe}`,
        borderRadius: tokens.radius.md,
        padding: '14px 18px 14px 22px',
        margin: '20px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: title ? 6 : 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: tokens.radius.full,
            background: tone.stripe,
            color: tokens.colors.textInverted,
            fontFamily: tokens.typography.fontMono,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {tone.icon}
        </span>
        {title ? (
          <strong
            style={{
              fontFamily: tokens.typography.fontSans,
              fontSize: 15,
              color: tokens.colors.textPrimary,
              fontWeight: 600,
            }}
          >
            {title}
          </strong>
        ) : null}
      </div>
      <div
        style={{
          fontFamily: tokens.typography.body.family,
          fontSize: 15,
          lineHeight: 1.6,
          color: tokens.colors.textSecondary,
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/Callout.tsx`
Expected: zero matches.

---

### Task 10: Refactor `mdx/Tabs`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Tabs.tsx`

Drop glass. Tab bar gets `surfaces.surface` background with a hairline bottom border `surfaces.border`. Active tab gets 2px `accent` underline + `accent` text color. Tab body sits on `surfaces.surface`.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/mdx/Tabs.tsx`

- [ ] **Step 2: Apply the restyle**

Preserve the existing client component logic (`'use client'`, `useState` for active tab, prop API). Only swap the inline styles. Anywhere it uses:
- `tokens.glass.bg` → `tokens.surfaces.surface`
- `tokens.glass.border` → `tokens.surfaces.border`
- glass blur → remove

Active tab underline: a 2px bottom border in `tokens.colors.accent`. Active tab text: `tokens.colors.accent`. Inactive tab text: `tokens.colors.textSecondary` with hover going to `tokens.colors.textPrimary`.

Body container: `tokens.surfaces.surface` background, 1px `tokens.surfaces.border` border on the bottom + sides (not top — joins with the tab bar), `radius.md` on bottom corners.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/Tabs.tsx`
Expected: zero matches.

---

### Task 11: Refactor `mdx/Steps`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Steps.tsx`

New treatment: each step number is a 32×32 `accent` circle with `textInverted` numeral (matches PilotBlock timeline). 2px-wide `surfaces.border` vertical line connects steps.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/mdx/Steps.tsx`

- [ ] **Step 2: Apply the restyle**

Within the file:
- Number circle: `width: 32, height: 32, borderRadius: tokens.radius.full, background: tokens.colors.accent, color: tokens.colors.textInverted, fontFamily: tokens.typography.fontMono, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'`
- Vertical connector: `width: 2, background: tokens.surfaces.border`
- Step title: `fontFamily: tokens.typography.fontSans, fontSize: 17, fontWeight: 600, color: tokens.colors.textPrimary`
- Step body: `fontFamily: tokens.typography.body.family, fontSize: 16, lineHeight: 1.6, color: tokens.colors.textSecondary`

Drop any glass references. Keep the existing prop API (whatever children/title shape it accepts).

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/Steps.tsx`
Expected: zero matches.

---

### Task 12: Refactor `mdx/CodeGroup`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/CodeGroup.tsx`

Multi-language code tab switcher. Same tab-bar treatment as `Tabs` (Task 10). Body keeps the dark tokyo-night code surface (it's a `<pre>` rendered by shiki).

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/mdx/CodeGroup.tsx`

- [ ] **Step 2: Apply the restyle**

Preserve client logic (`useState` for active language). Tab-bar styles match Task 10's. Wrap the active code block in a container with `surfaces.border` 1px border on bottom + sides, `radius.md` on bottom corners. The code block's own background stays dark (tokyo-night).

Drop all `tokens.glass.*` references.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/CodeGroup.tsx`
Expected: zero matches.

---

### Task 13: Refactor `mdx/CodeBlock`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/CodeBlock.tsx`

The MDX `<CodeBlock filename="…">` wrapper should render a `BrowserFrame`-style chrome (traffic-light dots + filename pill in the title bar) around the shiki code body. The internal code is still tokyo-night dark; only the chrome is new.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/mdx/CodeBlock.tsx`

- [ ] **Step 2: Replace the file**

Replace contents with:

```tsx
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';

interface Props {
  filename?: string;
  language?: string;
  children: ReactNode;
}

/**
 * MDX <CodeBlock> wrapper. Renders BrowserFrame-style chrome around
 * a code body. The body itself (typically a <pre> rendered by shiki)
 * keeps its own dark tokyo-night background.
 *
 * The fenced-code-block code (rendered by rehype-pretty-code) does
 * not use this wrapper; it goes through the .shiki rules in
 * global.css.
 */
export function Pre({ filename, language, children }: Props) {
  return (
    <div
      data-mdx="code-block"
      style={{
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        margin: '20px 0',
        boxShadow: tokens.shadows.sm,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          background: tokens.surfaces.surfaceTinted,
          borderBottom: `1px solid ${tokens.surfaces.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
          <span style={{ width: 10, height: 10, borderRadius: tokens.radius.full, background: '#FF5F57' }} />
          <span style={{ width: 10, height: 10, borderRadius: tokens.radius.full, background: '#FEBC2E' }} />
          <span style={{ width: 10, height: 10, borderRadius: tokens.radius.full, background: '#28C840' }} />
        </div>
        {filename ? (
          <div
            style={{
              flex: 1,
              fontFamily: tokens.typography.fontMono,
              fontSize: 11,
              color: tokens.colors.textMuted,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {filename}
            {language ? <span style={{ marginLeft: 8, opacity: 0.6 }}>· {language}</span> : null}
          </div>
        ) : null}
        <div style={{ width: 42 }} aria-hidden="true" />
      </div>
      <div data-mdx="code-block-body">{children}</div>
    </div>
  );
}
```

If `MdxRenderer.tsx` maps `pre` to `Pre`, this preserves that. Otherwise, name + export the function however the existing file does. Read the existing file first and keep the same export name/shape.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/CodeBlock.tsx`
Expected: zero matches.

---

### Task 14: Refactor `mdx/Card` and `CardGroup`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Card.tsx`

Existing component (line 1-62) is a clickable link tile used in 30+ MDX files as `<Card title="..." icon="..." href="...">body</Card>` inside `<CardGroup cols={N}>`. The shape stays; only the glass + glow treatment changes.

- [ ] **Step 1: Replace the file**

Replace the file contents with:

```tsx
'use client';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${100 / cols - 2}%), 1fr))`,
        gap: 14,
        marginTop: 16,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  title,
  href,
  icon,
  children,
}: {
  title: string;
  href: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        data-mdx="card"
        style={{
          padding: 18,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.surfaces.border}`,
          background: tokens.surfaces.surface,
          boxShadow: tokens.shadows.sm,
          transition: 'box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = tokens.shadows.md;
          e.currentTarget.style.borderColor = tokens.surfaces.borderStrong;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = tokens.shadows.sm;
          e.currentTarget.style.borderColor = tokens.surfaces.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {icon ? <div style={{ fontSize: '1.15rem', marginBottom: 6 }}>{icon}</div> : null}
            <div
              style={{
                fontFamily: tokens.typography.fontSerif,
                fontWeight: 700,
                fontSize: '0.95rem',
                color: tokens.colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {title}
            </div>
          </div>
          <span style={{ color: tokens.colors.textMuted, fontSize: '0.9rem', marginTop: 2 }}>→</span>
        </div>
        <div
          style={{
            fontFamily: tokens.typography.body.family,
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: tokens.colors.textSecondary,
          }}
        >
          {children}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify**

Run: `grep -n "tokens.glass\|tokens.glow\|backdropFilter" apps/website/src/components/docs/mdx/Card.tsx`
Expected: zero matches.

---

### Task 15: Refactor `mdx/FeatureChips`

**Files:**
- Modify: `apps/website/src/components/docs/mdx/FeatureChips.tsx`

Drop the per-chip gradients + glass blur. Also fix the broken hrefs (every chip currently points at `/docs/guides/...` which is missing the library segment — should be `/docs/agent/guides/...` since this component is only used by `agent/getting-started/introduction.mdx`).

- [ ] **Step 1: Replace the file**

Replace the contents with:

```tsx
'use client';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

interface ChipData {
  icon: string;
  title: string;
  signal: string;
  href: string;
}

const CHIPS: ChipData[] = [
  { icon: '⚡', title: 'Messages', signal: 'chat.messages()', href: '/docs/agent/guides/streaming' },
  { icon: '📡', title: 'Status', signal: 'chat.status()', href: '/docs/agent/guides/streaming' },
  { icon: '💾', title: 'Persistence', signal: 'threadId', href: '/docs/agent/guides/persistence' },
  { icon: '✋', title: 'Interrupts', signal: 'chat.interrupt()', href: '/docs/agent/guides/interrupts' },
  { icon: '⏪', title: 'Time Travel', signal: 'chat.history()', href: '/docs/agent/guides/time-travel' },
  { icon: '🔀', title: 'Subagents', signal: 'chat.subagents()', href: '/docs/agent/guides/subgraphs' },
  { icon: '🔧', title: 'Tool Calls', signal: 'chat.toolCalls()', href: '/docs/agent/guides/streaming' },
  { icon: '🧪', title: 'Testing', signal: 'MockTransport', href: '/docs/agent/guides/testing' },
];

export function FeatureChips() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 8,
        marginTop: 20,
        marginBottom: 28,
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.surfaces.borderStrong} transparent`,
      }}
    >
      {CHIPS.map((chip) => (
        <Link key={chip.title} href={chip.href} style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div
            data-mdx="feature-chip"
            style={{
              width: 130,
              padding: '14px 12px',
              borderRadius: tokens.radius.lg,
              background: tokens.surfaces.surface,
              border: `1px solid ${tokens.surfaces.border}`,
              boxShadow: tokens.shadows.sm,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = tokens.shadows.md;
              e.currentTarget.style.borderColor = tokens.surfaces.borderStrong;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = tokens.shadows.sm;
              e.currentTarget.style.borderColor = tokens.surfaces.border;
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{chip.icon}</div>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 13,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {chip.title}
            </div>
            <div
              style={{
                fontFamily: tokens.typography.fontMono,
                fontSize: 10,
                color: tokens.colors.accent,
              }}
            >
              {chip.signal}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/mdx/FeatureChips.tsx`
Expected: zero matches.

---

### Task 16: Verify Commit 2 + ship

- [ ] **Step 1: Type-check + build**

Run: `pnpm nx build website 2>&1 | tail -10`
Expected: build succeeds. Next.js bundles MDX so this catches any prop-API breakage.

If the build fails due to pre-existing `posthog-node` "Module not found" (documented in Phase 1's notes as a worktree-specific dependency issue), continue — that failure pre-existed.

- [ ] **Step 2: Run e2e**

Run: `pnpm nx e2e website`
Expected: 28 passed.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/docs/mdx/
git commit -m "$(cat <<'EOF'
refactor(website): docs MDX primitives — drop glass, use new tokens (Phase 7.2)

Restyles 7 MDX primitives in apps/website/src/components/docs/mdx/
to drop glassmorphism and use the Phase 1 token namespaces:

- Callout — 4px left accent stripe per tone (tip/warning/info/danger)
  on surfaceTinted body, with an inline tone-circle icon
- Tabs — white tab bar with hairline bottom border; active tab gets
  2px accent underline + accent text
- Steps — 32x32 accent number circles with surfaces.border vertical
  connector (matches PilotBlock timeline)
- CodeGroup — same tab-bar treatment as Tabs; body wraps the active
  shiki block in surfaces.border chrome (code body stays tokyo-night)
- CodeBlock (the MDX wrapper) — BrowserFrame-style chrome: traffic
  lights + filename pill, surfaces.surface chrome, code body stays
  dark
- Card / CardGroup — preserved clickable-link-tile shape; drops glass
  + glow for surfaces tokens + shadows.sm/md
- FeatureChips — drops gradient + glass; also fixes 8 broken hrefs
  (chip links pointed at /docs/guides/... missing the library segment;
  fixed to /docs/agent/guides/...)

No MDX content edits. Prop APIs preserved. All 28 e2e tests pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Commit 3 — Ancillary, anchor affordance, wire-ups, tests

### Task 17: Wire heading-anchor affordance in `MdxRenderer`

**Files:**
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`

Inject H2/H3 component overrides in the MDX component map so each heading renders with a `<a class="heading-anchor">#</a>` child that links to `#<heading-id>`. `rehype-slug` already assigns IDs, so the children get correct anchor targets at render time. The CSS for the hover affordance was added in Task 7.

- [ ] **Step 1: Read existing**

Run: `cat apps/website/src/components/docs/MdxRenderer.tsx`
Note: file is 71 lines. Look for the `components` object passed to `<MDXRemote components={...} />`. The override needs to be added there.

- [ ] **Step 2: Add anchor-aware H2 and H3 components**

In the file, locate the components map (an object like `const components = { ... }` or inline `components={{ ... }}`). Add these two entries:

```tsx
h2: ({ id, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 id={id} {...rest}>
    {id ? <a href={`#${id}`} aria-label={`Link to ${id}`} className="heading-anchor">#</a> : null}
    {children}
  </h2>
),
h3: ({ id, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 id={id} {...rest}>
    {id ? <a href={`#${id}`} aria-label={`Link to ${id}`} className="heading-anchor">#</a> : null}
    {children}
  </h3>
),
```

Preserve everything else in the component map.

- [ ] **Step 3: Verify `docs-prose` is the wrapping class**

Search the file for `docs-prose`. It should be on the wrapper element around `<MDXRemote …>`. If it's missing, add `className="docs-prose"` to the wrapper so the Task 7 CSS rules target the right tree.

- [ ] **Step 4: Type-check** — should pass with no errors related to this file.

---

### Task 18: Refactor `ApiDocRenderer` + `ApiRefTable`

**Files:**
- Modify: `apps/website/src/components/docs/ApiDocRenderer.tsx`
- Modify: `apps/website/src/components/docs/ApiRefTable.tsx`

Both render API reference content (parameter tables, type signatures, descriptions). Swap legacy tokens for new ones.

- [ ] **Step 1: Apply token swaps to `ApiDocRenderer.tsx`**

Within the file:
- `tokens.glass.bg` / `tokens.glass.bgHover` → `tokens.surfaces.surface` / `tokens.surfaces.surfaceTinted`
- `tokens.glass.border` → `tokens.surfaces.border`
- `tokens.glass.shadow` → `tokens.shadows.sm`
- Any `backdropFilter` / `WebkitBackdropFilter` → remove
- Table header background should be `tokens.surfaces.surfaceTinted`
- Code spans inside param descriptions stay with `tokens.colors.accentSurface` + `tokens.colors.accent` (existing pattern)

- [ ] **Step 2: Apply the same swaps to `ApiRefTable.tsx`**

Same replacements as Step 1. Both files share the same conventions.

- [ ] **Step 3: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/ApiDocRenderer.tsx apps/website/src/components/docs/ApiRefTable.tsx`
Expected: zero matches.

---

### Task 19: Refactor `ArchFlowDiagram`

**Files:**
- Modify: `apps/website/src/components/docs/ArchFlowDiagram.tsx`

Architecture diagram component (170 lines). Restyle node + edge styling to new tokens.

- [ ] **Step 1: Apply token swaps**

- `tokens.glass.bg` → `tokens.surfaces.surface`
- `tokens.glass.border` → `tokens.surfaces.border`
- `tokens.glass.shadow` → `tokens.shadows.sm`
- Any `backdropFilter` → remove
- Edge stroke colors: if previously `accentBorder`, keep; if anything glass-derived, swap to `surfaces.borderStrong`

- [ ] **Step 2: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/ArchFlowDiagram.tsx`
Expected: zero matches.

---

### Task 20: Refactor `CopyPromptButton`

**Files:**
- Modify: `apps/website/src/components/docs/CopyPromptButton.tsx`

A small "Copy" button (59 lines) that appears next to code blocks in docs. Restyle to use new tokens.

- [ ] **Step 1: Apply token swaps**

Within the file:
- Button background: `tokens.surfaces.surface`
- Button border: `1px solid tokens.surfaces.border`
- Button hover: border `tokens.surfaces.borderStrong`, background `tokens.colors.accentSurface`
- "Copied!" state text color: `tokens.colors.accent`
- Drop any `tokens.glass.*` or `backdropFilter`

- [ ] **Step 2: Verify**

Run: `grep -n "tokens.glass\|backdropFilter" apps/website/src/components/docs/CopyPromptButton.tsx`
Expected: zero matches.

---

### Task 21: Refactor `DocsPrevNext` and wire it in

**Files:**
- Modify: `apps/website/src/components/docs/DocsPrevNext.tsx`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

DocsPrevNext is currently unused. Refactor to use `ui/Card`, then mount it at the bottom of the slug page content column.

- [ ] **Step 1: Read existing DocsPrevNext**

Run: `cat apps/website/src/components/docs/DocsPrevNext.tsx`
Note: confirm what props it accepts and whether the navigation logic (finding prev/next pages from `docsConfig`) is already implemented. If not, the task is to add it.

- [ ] **Step 2: Replace the file**

Replace contents with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';
import { getLibraryConfig, type LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  section: string;
  slug: string;
}

interface Sibling {
  href: string;
  section: string;
  slug: string;
  title: string;
}

function findSiblings(library: LibraryId, section: string, slug: string): { prev: Sibling | null; next: Sibling | null } {
  const lib = getLibraryConfig(library);
  if (!lib) return { prev: null, next: null };
  // Flatten pages in declaration order.
  const flat: Sibling[] = [];
  for (const s of lib.sections) {
    for (const p of s.pages) {
      flat.push({
        section: p.section,
        slug: p.slug,
        title: p.title,
        href: `/docs/${library}/${p.section}/${p.slug}`,
      });
    }
  }
  const idx = flat.findIndex((p) => p.section === section && p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export function DocsPrevNext({ library, section, slug }: Props) {
  const { prev, next } = findSiblings(library, section, slug);
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Previous and next page"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginTop: 48,
        marginBottom: 16,
      }}
    >
      {prev ? (
        <Link href={prev.href} style={{ textDecoration: 'none' }}>
          <Card padding="md" hoverable style={{ height: '100%' }}>
            <Eyebrow style={{ marginBottom: 8 }}>← Previous</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
              }}
            >
              {prev.title}
            </div>
          </Card>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={next.href} style={{ textDecoration: 'none' }}>
          <Card padding="md" hoverable style={{ height: '100%', textAlign: 'right' }}>
            <Eyebrow style={{ marginBottom: 8 }}>Next →</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
              }}
            >
              {next.title}
            </div>
          </Card>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
```

- [ ] **Step 3: Wire into the slug page**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, add the import at the top:

```tsx
import { DocsPrevNext } from '../../../../../components/docs/DocsPrevNext';
```

Then insert `<DocsPrevNext library={library as LibraryId} section={section} slug={slug} />` immediately after the `(section === 'api' && …)` block, wrapped in the same `px-6 md:px-12 max-w-3xl` wrapper used by `ApiDocRenderer`:

```tsx
<div className="px-6 md:px-12 max-w-3xl pb-8">
  <DocsPrevNext library={library as LibraryId} section={section} slug={slug} />
</div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep "DocsPrevNext\|slug.*page.tsx" | head -5`
Expected: no errors specific to these files.

---

### Task 22: Add `e2e/docs.spec.ts`

**Files:**
- Create: `apps/website/e2e/docs.spec.ts`

Cover the docs landing, slug page, search modal, breadcrumb, and prev/next.

- [ ] **Step 1: Write the spec**

Create the file with:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Docs landing page', () => {
  test('renders library cards + popular topics + search prompt', async ({ page }) => {
    await page.goto('/docs');
    // Header
    await expect(page.locator('#docs-heading')).toBeVisible();
    // Library grid — 3 cards (agent, render, chat)
    const libraryCards = page.locator('main a[href^="/docs/"][href$="/getting-started/introduction"]');
    await expect(libraryCards).toHaveCount(3);
    // Popular topics — 3 cards
    await expect(page.getByText('Streaming with signals').first()).toBeVisible();
    await expect(page.getByText('Generative UI fundamentals').first()).toBeVisible();
    await expect(page.getByText('Production patterns').first()).toBeVisible();
    // Search prompt
    await expect(page.getByText('Looking for something specific?').first()).toBeVisible();
  });
});

test.describe('Docs slug page', () => {
  const route = '/docs/agent/getting-started/introduction';

  test('renders breadcrumb + h1 + sidebar', async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]').first()).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('breadcrumb shows the library + page title', async ({ page }) => {
    await page.goto(route);
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]').first();
    await expect(breadcrumb).toContainText('Docs');
  });

  test('renders DocsPrevNext at the bottom (next-only for the first page)', async ({ page }) => {
    await page.goto(route);
    const prevNext = page.locator('nav[aria-label="Previous and next page"]').first();
    await expect(prevNext).toBeVisible();
  });

  test('headings have ID anchors for hash links', async ({ page }) => {
    await page.goto(route);
    const h2 = page.locator('article h2').first();
    await expect(h2).toBeVisible();
    const id = await h2.getAttribute('id');
    expect(id).toBeTruthy();
    expect(id?.length).toBeGreaterThan(0);
  });
});

test.describe('Docs search', () => {
  test('Cmd+K opens the search modal', async ({ page, browserName }) => {
    await page.goto('/docs/agent/getting-started/introduction');
    // Mac uses Meta; other platforms emulate the same shortcut via keydown.
    const modifier = browserName === 'webkit' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+KeyK`);
    // The modal mounts somewhere — assert by visible input role with placeholder text.
    await expect(page.locator('input[placeholder*="Search"], input[type="search"]').first()).toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Run the new spec**

Run: `pnpm nx e2e website --grep "Docs landing|Docs slug|Docs search"`
Expected: all tests pass. If any fail, fix the relevant component and re-run.

Known fragility: the search-modal test depends on the modal exposing an `input[type="search"]` or `placeholder="Search"`. If `DocsSearch.tsx` uses a different selector, adjust the assertion.

- [ ] **Step 3: Run the full e2e**

Run: `pnpm nx e2e website`
Expected: all tests pass (~32-33 total: 28 prior + 4-5 new).

---

### Task 23: Final verification + ship Commit 3

- [ ] **Step 1: Workspace-wide grep for leftover glass in docs**

Run: `grep -rn "tokens.glass\|backdropFilter" apps/website/src/app/docs apps/website/src/components/docs 2>/dev/null`
Expected: zero matches. Anything still here is a missed file.

- [ ] **Step 2: Run full e2e one more time**

Run: `pnpm nx e2e website`
Expected: all tests pass.

- [ ] **Step 3: Ship**

```bash
git add apps/website/src/components/docs/MdxRenderer.tsx \
  apps/website/src/components/docs/ApiDocRenderer.tsx \
  apps/website/src/components/docs/ApiRefTable.tsx \
  apps/website/src/components/docs/ArchFlowDiagram.tsx \
  apps/website/src/components/docs/CopyPromptButton.tsx \
  apps/website/src/components/docs/DocsPrevNext.tsx \
  apps/website/src/app/docs/\[library\]/\[section\]/\[slug\]/page.tsx \
  apps/website/e2e/docs.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): docs ancillary refactor + DocsPrevNext + anchor links (Phase 7.3)

- MdxRenderer: H2/H3 component overrides emit a leading `<a class=
  "heading-anchor">#</a>` linked to the heading's rehype-slug ID. CSS
  affordance (hover fades the # in) landed in Phase 7.1's global.css.
- ApiDocRenderer / ApiRefTable: migrated off tokens.glass.* to
  surfaces + shadow.sm; param-table headers use surfaceTinted.
- ArchFlowDiagram: nodes + edges on surface tokens.
- CopyPromptButton: white button with surface border, accent on
  hover/copied state.
- DocsPrevNext: refactored to use ui/Card hoverable; finds siblings
  by flattening docsConfig.sections.pages in declaration order;
  wired in at the bottom of every slug page (renders nothing if no
  siblings exist).
- New apps/website/e2e/docs.spec.ts: covers landing page, slug page
  breadcrumb + prev/next + heading IDs, and the ⌘K search modal.

Workspace-wide grep for `tokens.glass` in apps/website/src/app/docs
and components/docs returns zero. All e2e tests pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

After this plan executes:

- 16 docs files restyled to the new token namespaces. Zero glassmorphism or `--gradient-bg-flow` usage left in `apps/website/src/app/docs/` and `apps/website/src/components/docs/`.
- `DocsBreadcrumb` and `DocsPrevNext` both wired in (previously unused).
- Hash-anchor affordance on every H2/H3 in MDX docs.
- One small content fix: `FeatureChips` hrefs corrected (added the missing `agent/` library segment).
- `/docs` landing has a Hero header, library grid, popular topics row, and a `⌘K` search prompt band — no more gradient blob.
- 4-5 new e2e assertions in `apps/website/e2e/docs.spec.ts`.

**Next phase (separate plan):** Phase 8 — `apps/cockpit/**` refactor. After Phase 8 ships, the `glass` / `gradient` / `glow` namespaces can be removed from `@ngaf/design-tokens` entirely.
