# Docs LLM Markdown Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mintlify-style per-page LLM export — a raw-markdown route and a `PageActions` dropdown (Copy page as Markdown, Open in ChatGPT, Edit on GitHub) that mounts into the docs page-header actions slot reserved by Spec 1.

**Architecture:** A new Next.js route handler serves each doc's raw `.mdx` verbatim as `text/markdown` (reusing the existing `getDocBySlug` for lookup + validation). A new `'use client'` `PageActions` dropdown calls that route for copy and links out to ChatGPT/GitHub; it's passed into the existing `DocsPageHeader` `actions` prop. No new dependencies or analytics events.

**Tech Stack:** Next.js (App Router route handlers), React client component, TypeScript, `@threadplane/design-tokens`, Vitest + Testing Library, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-06-04-docs-llm-export-design.md`

---

## File Structure

- **Create:** `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.ts` — GET returns raw `.mdx` as `text/markdown` (404 for unknown slugs); `generateStaticParams` from `getAllDocSlugs()`.
- **Create:** `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts` — route test (node env).
- **Create:** `apps/website/src/components/docs/PageActions.tsx` — client dropdown.
- **Create:** `apps/website/src/components/docs/PageActions.spec.tsx` — component test (jsdom).
- **Modify:** `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` — pass `<PageActions>` as the header `actions`.
- **Modify:** `apps/website/e2e/docs.spec.ts` — assert the actions trigger renders.

---

## Task 1: Raw-markdown route (TDD)

**Files:**
- Create: `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts`
- Create: `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from './route';

function ctx(params: { library: string; section: string; slug: string }) {
  return { params: Promise.resolve(params) };
}

describe('GET /api/markdown/[library]/[section]/[slug]', () => {
  it('returns the raw mdx for a known page as text/markdown', async () => {
    const res = await GET(
      new Request('http://localhost/api/markdown/langgraph/getting-started/introduction'),
      ctx({ library: 'langgraph', section: 'getting-started', slug: 'introduction' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const body = await res.text();
    expect(body).toContain('# Introduction');
  });

  it('404s for an unknown page', async () => {
    const res = await GET(
      new Request('http://localhost/api/markdown/langgraph/getting-started/does-not-exist'),
      ctx({ library: 'langgraph', section: 'getting-started', slug: 'does-not-exist' }),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx vitest run "src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts"
```
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the route handler**

Create `apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getDocBySlug, getAllDocSlugs } from '../../../../../../lib/docs';

export function generateStaticParams() {
  return getAllDocSlugs();
}

interface RouteContext {
  params: Promise<{ library: string; section: string; slug: string }>;
}

export async function GET(_req: Request, context: RouteContext): Promise<Response> {
  const { library, section, slug } = await context.params;
  const doc = getDocBySlug(library, section, slug);

  if (!doc) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse(doc.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
```

**Import-path note:** the relative path from this route file to `apps/website/src/lib/docs.ts` is six levels up to `src` (`../../../../../../lib/docs`). If `tsc`/the test reports the import can't be resolved, count the directory depth and adjust the number of `../` segments — do not change the design.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/website && npx vitest run "src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts"
```
Expected: PASS (2 passed). The test reads real files via `getDocBySlug` (cwd = `apps/website`).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint "apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.ts" "apps/website/src/app/api/markdown/[library]/[section]/[slug]/route.spec.ts"
git add "apps/website/src/app/api/markdown"
git commit -m "feat(website): raw-markdown route for docs pages"
```
Expected: eslint exit 0. (Do NOT run `nx lint website`.) If `next-env.d.ts`/`tsconfig.tsbuildinfo` show modified, do not stage them.

---

## Task 2: PageActions dropdown (TDD)

**Files:**
- Create: `apps/website/src/components/docs/PageActions.spec.tsx`
- Create: `apps/website/src/components/docs/PageActions.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/docs/PageActions.spec.tsx`:

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve('# Streaming\n\nbody') });
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  Object.assign(globalThis, { fetch: fetchMock });
});

async function open() {
  const { PageActions } = await import('./PageActions');
  render(<PageActions library="langgraph" section="guides" slug="streaming" />);
  fireEvent.click(screen.getByRole('button', { name: /page actions/i }));
}

describe('PageActions', () => {
  it('copies the raw markdown from the route and fires analytics', async () => {
    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: /copy page as markdown/i }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith('# Streaming\n\nbody'));
    expect(fetchMock).toHaveBeenCalledWith('/api/markdown/langgraph/guides/streaming');
    expect(trackMock).toHaveBeenCalledWith(
      'docs:copy_code_click',
      expect.objectContaining({ surface: 'docs', cta_id: 'copy_page_markdown' }),
    );
  });

  it('links to ChatGPT with the page URL and to GitHub edit', async () => {
    await open();
    const chatgpt = screen.getByRole('menuitem', { name: /open in chatgpt/i }) as HTMLAnchorElement;
    expect(chatgpt.getAttribute('href')).toContain('https://chatgpt.com/?hints=search&q=');
    expect(chatgpt.getAttribute('href')).toContain(encodeURIComponent('https://threadplane.ai/docs/langgraph/guides/streaming'));
    const github = screen.getByRole('menuitem', { name: /edit on github/i }) as HTMLAnchorElement;
    expect(github.getAttribute('href')).toBe('https://github.com/cacheplane/angular-agent-framework/edit/main/apps/website/content/docs/langgraph/guides/streaming.mdx');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/PageActions.spec.tsx
```
Expected: FAIL — cannot resolve `./PageActions`.

- [ ] **Step 3: Write the component**

Create `apps/website/src/components/docs/PageActions.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';
import { SITE_ORIGIN } from '../../lib/site-metadata';

const GITHUB_EDIT_BASE =
  'https://github.com/cacheplane/angular-agent-framework/edit/main/apps/website/content/docs';

interface Props {
  library: string;
  section: string;
  slug: string;
}

export function PageActions({ library, section, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const path = `${library}/${section}/${slug}`;
  const pageUrl = `${SITE_ORIGIN}/docs/${path}`;
  const chatgptUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(
    `Read this Threadplane docs page and help me apply it to my project: ${pageUrl}`,
  )}`;
  const githubUrl = `${GITHUB_EDIT_BASE}/${path}.mdx`;

  const copyMarkdown = async () => {
    try {
      const res = await fetch(`/api/markdown/${path}`);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      track(analyticsEvents.docsCopyCodeClick, { surface: 'docs', cta_id: 'copy_page_markdown' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // network/clipboard failure — silently ignore
    }
    setOpen(false);
  };

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    fontFamily: tokens.typography.fontSans,
    fontSize: 13,
    color: tokens.colors.textPrimary,
    background: 'transparent',
    border: 'none',
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Page actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          padding: 0,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: tokens.radius.md,
          background: tokens.surfaces.surface,
          color: tokens.colors.textSecondary,
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadows.md,
            padding: 4,
            zIndex: 20,
          }}
        >
          <button type="button" role="menuitem" onClick={copyMarkdown} style={itemStyle}>
            {copied ? 'Copied' : 'Copy page as Markdown'}
          </button>
          <a
            role="menuitem"
            href={chatgptUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={itemStyle}
          >
            Open in ChatGPT
          </a>
          <a
            role="menuitem"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={itemStyle}
          >
            Edit on GitHub
          </a>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/PageActions.spec.tsx
```
Expected: PASS (2 passed).

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint apps/website/src/components/docs/PageActions.tsx apps/website/src/components/docs/PageActions.spec.tsx
git add apps/website/src/components/docs/PageActions.tsx apps/website/src/components/docs/PageActions.spec.tsx
git commit -m "feat(website): PageActions dropdown (copy markdown, ChatGPT, GitHub)"
```
Expected: eslint exit 0.

---

## Task 3: Mount in the route + e2e + verify

**Files:**
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`
- Modify: `apps/website/e2e/docs.spec.ts`

- [ ] **Step 1: Pass PageActions into the header slot**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, add the import after the existing `DocsPageHeader` import:
```tsx
import { PageActions } from '../../../../../components/docs/PageActions';
```

Then replace:
```tsx
            <DocsPageHeader library={library as LibraryId} section={section} />
```
with:
```tsx
            <DocsPageHeader
              library={library as LibraryId}
              section={section}
              actions={<PageActions library={library} section={section} slug={slug} />}
            />
```

- [ ] **Step 2: Add the e2e assertion**

In `apps/website/e2e/docs.spec.ts`, in the `Docs slug page` block, extend the `'renders the branded chrome ...'` test by adding this line before its closing `});`:
```ts
    // Per-page LLM actions trigger
    await expect(page.locator('main button[aria-label="Page actions"]').first()).toBeVisible();
```

- [ ] **Step 3: Lint + typecheck**

```bash
cd /Users/blove/repos/angular-agent-framework
npx eslint "apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx"
npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep -E "PageActions|api/markdown|\[slug\]/page.tsx" || echo "no new type errors in changed files"
```
Expected: eslint exit 0; `no new type errors in changed files`.

- [ ] **Step 4: Run the full docs e2e**

```bash
cd apps/website && npx playwright test e2e/docs.spec.ts
```
Expected: PASS (all blocks). The actions trigger now renders in the page header.

- [ ] **Step 5: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add "apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx" apps/website/e2e/docs.spec.ts
git commit -m "feat(website): mount PageActions in the docs page header"
```

---

## Manual verification (browser)

After e2e passes, open `/docs/langgraph/guides/streaming` on the dev server and confirm:

- [ ] A kebab (⋯) button sits at the right of the `LANGGRAPH · GUIDES` page header.
- [ ] Clicking it opens a menu with "Copy page as Markdown", "Open in ChatGPT", "Edit on GitHub"; clicking outside or pressing Escape closes it.
- [ ] "Copy page as Markdown" copies (the menu item briefly shows "Copied"); pasting yields the raw MDX.
- [ ] Visiting `/api/markdown/langgraph/guides/streaming` directly shows the raw `.mdx` as plain text.
- [ ] "Open in ChatGPT" / "Edit on GitHub" open the expected URLs in a new tab.
- [ ] No console errors.

---

## Self-Review (completed during planning)

- **Spec coverage:** Raw-markdown route serving verbatim `.mdx` via `getDocBySlug`, 404 for unknown, `generateStaticParams` ✓ (Task 1). `PageActions` client dropdown with the three dawn items, copy-from-route + `docs:copy_code_click`/`cta_id: copy_page_markdown`, ChatGPT page-URL link, GitHub edit link, outside-click/Escape close ✓ (Task 2). Mounted via the existing `actions` slot ✓ (Task 3). Tests: route test, component test, e2e trigger assertion ✓. No `llms.txt` change, no Claude, no View-as-Markdown ✓.
- **Placeholder scan:** No TBD/TODO; every code step is complete; commands have expected output.
- **Type consistency:** `PageActions` props `{ library, section, slug }` (all `string`) match the call site in the route page. Route `GET(_req, { params: Promise<{library,section,slug}> })` matches the test's `ctx()`. `getDocBySlug`/`getAllDocSlugs` are existing `lib/docs` exports. Analytics event `docsCopyCodeClick` + `cta_id: 'copy_page_markdown'` consistent between component and test. The `/api/markdown/${path}` URL in the component matches the route folder structure and the test's `fetch` assertion.
```
