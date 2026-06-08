# Docs Chrome Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the branded landing visual language into the docs reading chrome — a shared `LibraryMark`, sidebar switcher marks + nav hover cleanup, a branded page header (with a reserved actions slot), and hover-lift prev/next cards.

**Architecture:** A new server-safe `LibraryMark` component centralizes the per-library mark/glyph (same assets as the landing) and feeds both the sidebar (a client component) and a new `DocsPageHeader` (server component, rendered by the doc route). `DocsPrevNext` upgrades to the landing's hover-lift card treatment. No new dependencies or asset files.

**Tech Stack:** Next.js (App Router), React server + client components, TypeScript, `@threadplane/design-tokens`, Vitest + Testing Library, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-06-04-docs-chrome-polish-design.md`

---

## File Structure

- **Create:** `apps/website/src/components/docs/LibraryMark.tsx` — maps each of the 7 libraries to its logo chip or glyph chip. One responsibility; single source of truth for the marks in the docs chrome.
- **Create:** `apps/website/src/components/docs/LibraryMark.spec.tsx` — unit test.
- **Create:** `apps/website/src/components/docs/DocsPageHeader.tsx` — the branded header (mark + `LIBRARY · SECTION` eyebrow + reserved actions slot).
- **Modify:** `apps/website/src/components/docs/DocsSidebar.tsx` — marks in the switcher + dropdown; hover background on section links.
- **Modify:** `apps/website/src/components/docs/DocsPrevNext.tsx` — hover-lift cards.
- **Modify:** `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` — render `DocsPageHeader`.
- **Modify:** `apps/website/e2e/docs.spec.ts` — assert the new chrome.

---

## Task 1: `LibraryMark` component (TDD)

**Files:**
- Create: `apps/website/src/components/docs/LibraryMark.spec.tsx`
- Create: `apps/website/src/components/docs/LibraryMark.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/docs/LibraryMark.spec.tsx`:

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LibraryMark } from './LibraryMark';

describe('LibraryMark', () => {
  it('renders a logo image for a logo-backed library', () => {
    const { container } = render(<LibraryMark library="langgraph" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/logos/langgraph.svg');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders an inline glyph (svg, no img) for an in-house library', () => {
    const { container } = render(<LibraryMark library="chat" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('maps ag-ui and a2ui to their vendor logos', () => {
    const { container: a } = render(<LibraryMark library="ag-ui" />);
    expect(a.querySelector('img')?.getAttribute('src')).toBe('/logos/runtimes/copilotkit.svg');
    const { container: b } = render(<LibraryMark library="a2ui" />);
    expect(b.querySelector('img')?.getAttribute('src')).toBe('/logos/providers/google.svg');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/LibraryMark.spec.tsx
```
Expected: FAIL — cannot resolve `./LibraryMark`.

- [ ] **Step 3: Write the implementation**

Create `apps/website/src/components/docs/LibraryMark.tsx`:

```tsx
import { tokens } from '@threadplane/design-tokens';
import type { LibraryId } from '../../lib/docs-config';

type GlyphKey = 'chat' | 'key' | 'pulse';

type MarkEntry =
  | { kind: 'logo'; src: string }
  | { kind: 'glyph'; glyph: GlyphKey };

const MARKS: Record<LibraryId, MarkEntry> = {
  langgraph: { kind: 'logo', src: '/logos/langgraph.svg' },
  'ag-ui': { kind: 'logo', src: '/logos/runtimes/copilotkit.svg' },
  a2ui: { kind: 'logo', src: '/logos/providers/google.svg' },
  render: { kind: 'logo', src: '/logos/surface/vercel.svg' },
  chat: { kind: 'glyph', glyph: 'chat' },
  licensing: { kind: 'glyph', glyph: 'key' },
  telemetry: { kind: 'glyph', glyph: 'pulse' },
};

function ChatGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

function KeyGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="12" r="3" />
      <path d="M11 12h9M17 12v4" />
    </svg>
  );
}

function PulseGlyph({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

const GLYPHS: Record<GlyphKey, (props: { s: number }) => React.JSX.Element> = {
  chat: ChatGlyph,
  key: KeyGlyph,
  pulse: PulseGlyph,
};

interface Props {
  library: LibraryId;
  /** Outer chip size in px. Default 24. */
  size?: number;
}

export function LibraryMark({ library, size = 24 }: Props) {
  const mark = MARKS[library];
  const base = {
    width: size,
    height: size,
    borderRadius: tokens.radius.md,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  } as const;

  if (mark.kind === 'logo') {
    const inner = Math.round(size * 0.6);
    return (
      <span
        style={{
          ...base,
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
        }}
      >
        <img
          src={mark.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ width: inner, height: inner, objectFit: 'contain' }}
        />
      </span>
    );
  }

  const Glyph = GLYPHS[mark.glyph];
  return (
    <span
      style={{
        ...base,
        background: tokens.colors.accentSurface,
        border: `1px solid ${tokens.colors.accentBorder}`,
        color: tokens.colors.accent,
      }}
    >
      <Glyph s={Math.round(size * 0.55)} />
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/LibraryMark.spec.tsx
```
Expected: PASS (3 passed).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/components/docs/LibraryMark.tsx apps/website/src/components/docs/LibraryMark.spec.tsx
git add apps/website/src/components/docs/LibraryMark.tsx apps/website/src/components/docs/LibraryMark.spec.tsx
git commit -m "feat(website): add LibraryMark component for docs chrome"
```
Expected: eslint exit 0. (Do NOT run `nx lint website` — it fails on the git-ignored `apps/website/public/demo/main.js`.) If `next-env.d.ts`/`tsconfig.tsbuildinfo` show as modified, do not stage them.

---

## Task 2: `DocsPageHeader` + wire into the doc route

**Files:**
- Create: `apps/website/src/components/docs/DocsPageHeader.tsx`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

- [ ] **Step 1: Write the component**

Create `apps/website/src/components/docs/DocsPageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { LibraryMark } from './LibraryMark';
import { getLibraryConfig, getDocsSection, type LibraryId } from '../../lib/docs-config';

function humanize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  library: LibraryId;
  section: string;
  /** Right-aligned slot for per-page actions (Spec 2). Optional. */
  actions?: ReactNode;
}

export function DocsPageHeader({ library, section, actions }: Props) {
  const libTitle = getLibraryConfig(library)?.title ?? library;
  const sectionTitle = getDocsSection(library, section)?.title ?? humanize(section);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <LibraryMark library={library} size={34} />
        <span
          style={{
            fontFamily: tokens.typography.fontMono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: tokens.colors.accent,
          }}
        >
          {libTitle} · {sectionTitle}
        </span>
      </div>
      {actions ? <div style={{ flex: '0 0 auto' }}>{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 2: Render it in the doc route**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`:

Add the import near the other docs-component imports (after the `DocsBreadcrumb` import line):
```tsx
import { DocsPageHeader } from '../../../../../components/docs/DocsPageHeader';
```

Then replace this block:
```tsx
          <div className="px-6 md:px-12 pt-6">
            <DocsBreadcrumb library={library as LibraryId} section={section} slug={slug} title={doc.title} />
          </div>
```
with:
```tsx
          <div className="px-6 md:px-12 pt-6">
            <DocsBreadcrumb library={library as LibraryId} section={section} slug={slug} title={doc.title} />
            <DocsPageHeader library={library as LibraryId} section={section} />
          </div>
```

- [ ] **Step 3: Lint + typecheck**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/components/docs/DocsPageHeader.tsx "apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx"
npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep -E "DocsPageHeader|\[slug\]/page.tsx" || echo "no new type errors in changed files"
```
Expected: eslint exit 0; `no new type errors in changed files`.

- [ ] **Step 4: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/src/components/docs/DocsPageHeader.tsx "apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx"
git commit -m "feat(website): branded docs page header with reserved actions slot"
```

---

## Task 3: Sidebar marks + nav hover cleanup

**Files:**
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx`

Context: `DocsSidebar.tsx` is a `'use client'` component. Active section links already use a background-only active state (`tokens.colors.accentSurface`) with no left bar — keep that. This task adds (a) a `LibraryMark` to the current-library button and each dropdown option, and (b) a hover background on inactive section links via a scoped `<style>` block (inline styles can't express `:hover`).

- [ ] **Step 1: Import LibraryMark**

Add to the imports at the top of `DocsSidebar.tsx` (after the `Pill` import):
```tsx
import { LibraryMark } from './LibraryMark';
```

- [ ] **Step 2: Add a mark to the current-library button**

In `LibraryDropdown`, replace the button's inner content. Replace this:
```tsx
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
```
with:
```tsx
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <LibraryMark library={activeLibrary} size={20} />
          <span style={{ fontFamily: tokens.typography.fontMono, fontSize: '0.8rem' }}>
            {currentLib?.title ?? activeLibrary}
          </span>
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
```

- [ ] **Step 3: Add a mark to each dropdown option**

In `LibraryDropdown`, replace the dropdown option button's body. Replace this:
```tsx
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
```
with:
```tsx
            <button
              key={lib.id}
              onClick={() => {
                setOpen(false);
                router.push(`/docs/${lib.id}/getting-started/introduction`);
              }}
              className="w-full text-left px-3 py-2.5 text-sm flex items-start gap-2.5"
              style={{
                background: lib.id === activeLibrary ? tokens.colors.accentSurface : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ marginTop: 1 }}>
                <LibraryMark library={lib.id} size={20} />
              </span>
              <span className="flex flex-col" style={{ minWidth: 0 }}>
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
              </span>
            </button>
```

- [ ] **Step 4: Add a hover background to inactive section links**

In `SectionGroup`, the page `Link` currently has `className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all"`. Add a `data-active` marker and a `data-docs-navlink` hook so a scoped stylesheet can style hover. Replace the `Link` opening tag:
```tsx
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
```
with:
```tsx
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
                data-docs-navlink
                data-active={isActive || undefined}
                className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all"
                style={{
                  color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                  background: isActive ? tokens.colors.accentSurface : 'transparent',
                  fontSize: '0.825rem',
                }}
              >
```

- [ ] **Step 5: Add the scoped hover stylesheet to the sidebar**

In `DocsSidebar` (the exported `aside`), add a `<style>` block as the first child inside the `<aside>` (before the search trigger `<div>`):
```tsx
      <style>{`
        [data-docs-navlink]:not([data-active]):hover {
          background: ${tokens.surfaces.surfaceDim};
          color: ${tokens.colors.textPrimary};
        }
      `}</style>
```

- [ ] **Step 6: Lint + commit**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/components/docs/DocsSidebar.tsx
git add apps/website/src/components/docs/DocsSidebar.tsx
git commit -m "feat(website): docs sidebar library marks + nav hover state"
```
Expected: eslint exit 0.

---

## Task 4: Prev/Next hover-lift cards

**Files:**
- Modify: `apps/website/src/components/docs/DocsPrevNext.tsx`

Context: the component already renders `Card` + `Eyebrow` direction labels. This task swaps the generic `hoverable` for the landing's `data-ui="docs-card"` lift (border → `accentBorderHover`, shadow → `md`, `translateY(-1px)`, reduced-motion guarded) and makes the page titles accent-colored so the cards read as links.

- [ ] **Step 1: Replace the component body**

Replace the entire `return (...)` of `DocsPrevNext` (the `<nav>...</nav>` block, lines 47-97) with:

```tsx
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
      <style>{`
        [data-ui="docs-card"] { transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
        [data-ui="docs-card"]:hover { border-color: ${tokens.colors.accentBorderHover}; box-shadow: ${tokens.shadows.md}; transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { [data-ui="docs-card"]:hover { transform: none; } }
      `}</style>
      {prev ? (
        <Link href={prev.href} style={{ textDecoration: 'none' }}>
          <Card padding="md" data-ui="docs-card" style={{ height: '100%' }}>
            <Eyebrow style={{ marginBottom: 8 }}>← Previous</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.accent,
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
          <Card padding="md" data-ui="docs-card" style={{ height: '100%', textAlign: 'right' }}>
            <Eyebrow style={{ marginBottom: 8 }}>Next →</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.accent,
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
```

- [ ] **Step 2: Lint + commit**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/components/docs/DocsPrevNext.tsx
git add apps/website/src/components/docs/DocsPrevNext.tsx
git commit -m "feat(website): docs prev/next hover-lift cards"
```
Expected: eslint exit 0.

---

## Task 5: e2e assertions + verify

**Files:**
- Modify: `apps/website/e2e/docs.spec.ts`

- [ ] **Step 1: Add chrome assertions to the slug-page test**

In `apps/website/e2e/docs.spec.ts`, find the test `'renders breadcrumb + h1 + sidebar'` inside the `Docs slug page` describe block. Replace that single test with:

```ts
  test('renders breadcrumb + h1 + sidebar', async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Breadcrumb"]').first()).toBeVisible();
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('renders the branded chrome (sidebar mark, page-header eyebrow, prev/next direction)', async ({ page }) => {
    await page.goto(route);
    // Sidebar shows the active library's logo mark
    await expect(page.locator('aside img[src="/logos/langgraph.svg"]').first()).toBeVisible();
    // Branded page header eyebrow
    await expect(page.getByText(/LangGraph\s+·\s+Getting Started/i).first()).toBeVisible();
    // Prev/Next: introduction is the first page, so a "Next →" card is present
    await expect(page.getByText('Next →').first()).toBeVisible();
  });
```

(`route` is the existing `const route = '/docs/langgraph/getting-started/introduction';` already declared in that describe block.)

- [ ] **Step 2: Run the docs e2e file**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts
```
Expected: PASS — all blocks (landing, slug page incl. the two tests above, search). The dev server auto-starts via `playwright.config.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/e2e/docs.spec.ts
git commit -m "test(website): assert branded docs chrome (mark, header eyebrow, prev/next)"
```

---

## Manual verification (browser)

After e2e passes, open `/docs/langgraph/guides/streaming` on the dev server and confirm:

- [ ] Sidebar library switcher shows the LangGraph mark; opening the dropdown shows a mark beside each library.
- [ ] Active section link has an accent background (no left bar); hovering an inactive link shows a subtle background.
- [ ] The page header shows the mark + `LANGGRAPH · GUIDES` eyebrow above the article title (the MDX `# Streaming` h1 is not duplicated).
- [ ] Prev/Next render as cards that lift on hover, with `← PREVIOUS` / `NEXT →` labels.
- [ ] No console errors; switch a couple of libraries (e.g. `/docs/chat/...`, `/docs/telemetry/...`) and confirm glyph chips render for the in-house libraries.

---

## Self-Review (completed during planning)

- **Spec coverage:** `LibraryMark` with all 7 mappings + glyphs ✓ (Task 1). Sidebar switcher marks ✓ (Task 3 steps 2-3). Nav cleanup — background-only active (already true, preserved) + hover background ✓ (Task 3 steps 4-5). Branded page header with mark + `LIBRARY · SECTION` eyebrow + reserved `actions` slot, MDX h1 preserved ✓ (Task 2). Prev/Next hover-lift cards with direction labels ✓ (Task 4). Tests: `LibraryMark.spec.tsx` ✓, e2e chrome assertions ✓ (Task 5). Actions slot reserved but unused (Spec 2) ✓. No spec requirement unimplemented.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.
- **Type consistency:** `LibraryMark` props `{ library, size }` used identically in sidebar (size 20) and header (size 34). `MARKS` is `Record<LibraryId, MarkEntry>` (compiler enforces all 7 keys). `DocsPageHeader` props `{ library, section, actions }` match the route call (no `actions` passed). `getDocsSection`/`getLibraryConfig` are existing exports of `docs-config`. `GlyphKey` union (`chat`/`key`/`pulse`) matches the `GLYPHS` record and the `glyph` fields in `MARKS`.
```
