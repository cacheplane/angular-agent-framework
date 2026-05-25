# Blog Landing Page Polish + Filterable Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/blog` to the same brand standard as the article page (PR #528) and add a server-rendered `?tag=` filter, with shared date/reading-time utilities and brand-aligned card components.

**Architecture:** Pure refactor of existing components plus one new `<BlogTagFilter>`. All filtering is server-side via Next.js `searchParams` — no client state. Date formatting and reading-time calculation move from `app/blog/[slug]/page.tsx` into `lib/blog.ts` so both pages share one source. Card hover reuses the existing `[data-ui="card"][data-hoverable]` CSS hook from `global.css`.

**Tech Stack:** Next.js 16 (app router, async server components, async searchParams), `@ngaf/design-tokens`, Playwright e2e, existing `<Eyebrow>` + `<TagChips>` primitives, no new deps.

**Spec:** [docs/superpowers/specs/2026-05-23-blog-landing-polish-design.md](docs/superpowers/specs/2026-05-23-blog-landing-polish-design.md)

---

## Token reference (used throughout)

The design tokens defined in [libs/design-tokens/src/lib/typography.ts](libs/design-tokens/src/lib/typography.ts):

- `tokens.typography.h1`: Garamond, `clamp(48px, 6vw, 72px)`, line `1.08`
- `tokens.typography.h2`: Garamond, `clamp(36px, 4.5vw, 56px)`, line `1.12`
- `tokens.typography.h3`: **Inter** (not Garamond), `28px`, line `1.25`, weight `600`
- `tokens.typography.eyebrow`: Mono, `12px`, weight `700`, letter-spacing `0.12em`, uppercase
- `tokens.typography.bodyLg`: Inter, `20px`, line `1.6`
- `tokens.colors.accent` / `accentSurface` / `textPrimary` / `textSecondary` / `textMuted`
- `tokens.surfaces.canvas` / `surface` / `surfaceTinted` / `border`

> **Note:** The spec said "Garamond on card titles" but the design system's `h3` token is intentionally Inter. Follow the tokens — Garamond on small headings (28px) reads worse than Inter, and the brand pop already lives in the page H1 + Featured H2. Featured uses h2 (Garamond), regular cards use h3 (Inter).

---

## Task 1: Extract `formatPostDate` and `readingTimeMin` into `lib/blog.ts`

Refactor — no behavior change. Two pages will import the same utilities.

**Files:**
- Modify: `apps/website/src/lib/blog.ts`
- Modify: `apps/website/src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Add the two functions to `lib/blog.ts`**

Append to [apps/website/src/lib/blog.ts](apps/website/src/lib/blog.ts) (after `getAllSlugs`):

```ts
/**
 * Format an ISO date string (YYYY-MM-DD from frontmatter) as a human date.
 *
 * Parses as UTC midnight and formats with timeZone: 'UTC' so a date like
 * '2026-05-21' never renders as 'May 20' for readers west of UTC.
 */
export function formatPostDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Estimate reading time in minutes from a markdown source.
 *
 * Strips fenced code blocks (not real reading), normalizes markdown
 * punctuation, counts whitespace-separated tokens, and divides by 220 wpm.
 * Returns at least 1.
 */
export function readingTimeMin(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
```

- [ ] **Step 2: Replace local copies in `[slug]/page.tsx` with the imports**

In [apps/website/src/app/blog/[slug]/page.tsx](apps/website/src/app/blog/[slug]/page.tsx):

Find this import line:

```ts
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
```

Replace with:

```ts
import { getAllPosts, getPostBySlug, formatPostDate, readingTimeMin } from '../../../lib/blog';
```

Then delete the two local function definitions (`function formatDate(...)` and `function readingTimeMin(...)`) — they live in `lib/blog.ts` now.

Update the one call site inside `BlogPostPage`:

```ts
const minutes = readingTimeMin(post.content);
const primaryTag = ...
```

(`readingTimeMin` keeps the same name. `formatDate` was renamed to `formatPostDate` to be unambiguous — update the call below too.)

Find:

```tsx
{primaryTag} · {formatDate(post.frontmatter.date)} · {minutes} min read
```

Replace with:

```tsx
{primaryTag} · {formatPostDate(post.frontmatter.date)} · {minutes} min read
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json` (or `pnpm exec nx typecheck website` if available)
Expected: PASS with no new errors.

- [ ] **Step 4: Smoke-test the article page in the running dev server**

Open `http://localhost:3000/blog/build-fullstack-agentic-angular-apps-using-ag-ui` and confirm the eyebrow still reads `TUTORIAL · MAY 21, 2026 · 11 MIN READ` (or whatever the post's primary tag and length are). No visual regression.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/blog.ts apps/website/src/app/blog/\[slug\]/page.tsx
git commit -m "refactor(blog): extract formatPostDate + readingTimeMin to lib"
```

---

## Task 2: Create `BlogTagFilter` component

New component — the filter chip row.

**Files:**
- Create: `apps/website/src/components/blog/BlogTagFilter.tsx`

- [ ] **Step 1: Create the component file**

Write [apps/website/src/components/blog/BlogTagFilter.tsx](apps/website/src/components/blog/BlogTagFilter.tsx):

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

interface BlogTagFilterProps {
  /** Currently active tag from ?tag=. Undefined when on /blog. */
  activeTag?: string;
  /** All known tags (already sorted by caller, or sort here). */
  tags: string[];
}

const PILL_BASE: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  lineHeight: 1.2,
};

const ACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  background: tokens.colors.accent,
  color: '#ffffff',
};

const INACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  background: tokens.colors.accentSurface,
  color: tokens.colors.accent,
};

export function BlogTagFilter({ activeTag, tags }: BlogTagFilterProps) {
  const sorted = [...tags].sort((a, b) => a.localeCompare(b));
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 32,
      }}
    >
      {/* "All" pill */}
      {activeTag ? (
        <Link href="/blog" style={INACTIVE}>
          All
        </Link>
      ) : (
        <span style={ACTIVE} aria-current="page">
          All
        </span>
      )}

      {sorted.map((tag) => {
        const isActive = tag === activeTag;
        // Clicking the active tag toggles back to /blog.
        const href = isActive ? '/blog' : `/blog?tag=${encodeURIComponent(tag)}`;
        return isActive ? (
          <Link
            key={tag}
            href={href}
            style={ACTIVE}
            aria-current="page"
          >
            {tag}
          </Link>
        ) : (
          <Link key={tag} href={href} style={INACTIVE}>
            {tag}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json`
Expected: PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blog/BlogTagFilter.tsx
git commit -m "feat(blog): add BlogTagFilter component for tag-based filtering"
```

---

## Task 3: Refactor `FeaturedPostCard`

Match the article page brand: Eyebrow component, Garamond h2 via tokens, formatted date + reading time row.

**Files:**
- Modify: `apps/website/src/components/blog/FeaturedPostCard.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of [apps/website/src/components/blog/FeaturedPostCard.tsx](apps/website/src/components/blog/FeaturedPostCard.tsx) with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import type { Post } from '../../lib/blog';
import { formatPostDate, readingTimeMin } from '../../lib/blog';
import { getAuthor } from '../../lib/blog-authors';
import { AuthorByline } from './AuthorByline';
import { Eyebrow } from '../ui/Eyebrow';

export function FeaturedPostCard({ post }: { post: Post }) {
  const { slug, frontmatter, content } = post;
  const author = getAuthor(frontmatter.author);
  const minutes = readingTimeMin(content);

  return (
    <Link
      href={`/blog/${slug}`}
      data-ui="card"
      data-hoverable
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 32,
        borderRadius: 16,
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.colors.accent}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
        marginBottom: 32,
      }}
    >
      <Eyebrow tone="accent">Featured</Eyebrow>
      <h2
        style={{
          fontFamily: tokens.typography.h2.family,
          fontSize: tokens.typography.h2.size,
          lineHeight: tokens.typography.h2.line,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {frontmatter.title}
      </h2>
      <p
        style={{
          fontFamily: tokens.typography.bodyLg.family,
          fontSize: tokens.typography.bodyLg.size,
          lineHeight: tokens.typography.bodyLg.line,
          color: tokens.colors.textSecondary,
          margin: 0,
        }}
      >
        {frontmatter.description}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        <AuthorByline author={author} />
        <span
          style={{
            fontFamily: tokens.typography.eyebrow.family,
            fontSize: tokens.typography.eyebrow.size,
            fontWeight: tokens.typography.eyebrow.weight,
            letterSpacing: tokens.typography.eyebrow.letterSpacing,
            textTransform: tokens.typography.eyebrow.transform,
            color: tokens.colors.textMuted,
          }}
        >
          {formatPostDate(frontmatter.date)} · {minutes} min read
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Smoke-test in the dev server**

Reload `http://localhost:3000/blog` (or whatever the running dev server port is — `preview_list` if unsure).

Expected:
- "FEATURED" reads as accent-blue uppercase mono.
- "Build Fullstack Agentic Angular Apps Using AG-UI" renders in Garamond, large.
- Byline "Brian Love · Founder, ThreadPlane" on the left.
- "MAY 21, 2026 · 11 MIN READ" on the right in small uppercase mono.
- Hover: subtle 1px lift + shadow (from existing global `[data-ui="card"][data-hoverable]:hover`).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blog/FeaturedPostCard.tsx
git commit -m "feat(blog): brand-polish FeaturedPostCard (Eyebrow, Garamond h2, reading time)"
```

---

## Task 4: Refactor `PostCard`

Match the article page brand: top eyebrow row with formatted date + reading time, h3 via tokens (Inter, 28px, 600), brand card hover.

**Files:**
- Modify: `apps/website/src/components/blog/PostCard.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of [apps/website/src/components/blog/PostCard.tsx](apps/website/src/components/blog/PostCard.tsx) with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import type { Post } from '../../lib/blog';
import { formatPostDate, readingTimeMin } from '../../lib/blog';

export function PostCard({ post }: { post: Post }) {
  const { slug, frontmatter, content } = post;
  const minutes = readingTimeMin(content);

  return (
    <Link
      href={`/blog/${slug}`}
      data-ui="card"
      data-hoverable
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        borderRadius: 12,
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          fontFamily: tokens.typography.eyebrow.family,
          fontSize: tokens.typography.eyebrow.size,
          fontWeight: tokens.typography.eyebrow.weight,
          letterSpacing: tokens.typography.eyebrow.letterSpacing,
          textTransform: tokens.typography.eyebrow.transform,
          color: tokens.colors.textMuted,
        }}
      >
        {formatPostDate(frontmatter.date)} · {minutes} min read
      </span>
      <h3
        style={{
          fontFamily: tokens.typography.h3.family,
          fontSize: tokens.typography.h3.size,
          lineHeight: tokens.typography.h3.line,
          fontWeight: tokens.typography.h3.weight,
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        {frontmatter.title}
      </h3>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: tokens.colors.textSecondary,
          margin: 0,
        }}
      >
        {frontmatter.description}
      </p>
      {frontmatter.tags && frontmatter.tags.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {frontmatter.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 999,
                background: tokens.colors.accentSurface,
                color: tokens.colors.accent,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 2: Smoke-test in the dev server**

Reload `/blog`. Confirm:
- Top of card: "MAY 17, 2026 · X MIN READ" (uppercase mono, muted).
- Title in Inter 28px 600 (heavier than today).
- Description in textSecondary.
- Tag chips at the bottom: visual only (NOT clickable — clicking opens the post).
- Card hover: same brand lift + shadow as FeaturedPostCard.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blog/PostCard.tsx
git commit -m "feat(blog): brand-polish PostCard (eyebrow row, token h3, reading time)"
```

---

## Task 5: Refactor `blog/page.tsx` — shell, header, filter, empty state

This is the biggest task. Outer shell, brand header, server-side filter via `searchParams`, featured-when-no-filter, empty state.

**Files:**
- Modify: `apps/website/src/app/blog/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of [apps/website/src/app/blog/page.tsx](apps/website/src/app/blog/page.tsx) with:

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { createPageMetadata } from '../../lib/site-metadata';
import { getAllPosts, getFeaturedPost, getAllTags } from '../../lib/blog';
import { FeaturedPostCard } from '../../components/blog/FeaturedPostCard';
import { PostCard } from '../../components/blog/PostCard';
import { BlogTagFilter } from '../../components/blog/BlogTagFilter';
import { Eyebrow } from '../../components/ui/Eyebrow';

export const metadata = createPageMetadata({
  title: 'Blog — ThreadPlane',
  description:
    'Long-form writing on agent UI for Angular: streaming, generative UI, threads, interrupts, production patterns.',
  pathname: '/blog',
  type: 'website',
});

interface Props {
  searchParams: Promise<{ tag?: string }>;
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const { tag: activeTag } = await searchParams;

  const all = getAllPosts();
  const tags = getAllTags().map((t) => t.tag);

  const filtered = activeTag
    ? all.filter((p) => p.frontmatter.tags?.includes(activeTag))
    : all;

  // Featured only when no filter is active — feels like a clean list otherwise.
  const featured = activeTag ? null : getFeaturedPost();
  const grid = featured ? filtered.filter((p) => p.slug !== featured.slug) : filtered;

  return (
    <div style={{ paddingTop: 80, background: tokens.surfaces.canvas, minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px' }}>
        <header style={{ marginBottom: 32 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
            Blog
          </Eyebrow>
          <h1
            style={{
              fontFamily: tokens.typography.h1.family,
              fontSize: tokens.typography.h1.size,
              lineHeight: tokens.typography.h1.line,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: tokens.colors.textPrimary,
              margin: '0 0 16px',
            }}
          >
            Notes from ThreadPlane
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              maxWidth: '60ch',
            }}
          >
            Writing on agent UI for Angular &mdash; production patterns, design
            choices, and what we&apos;re shipping.
          </p>
        </header>

        <BlogTagFilter activeTag={activeTag} tags={tags} />

        {featured ? <FeaturedPostCard post={featured} /> : null}

        {grid.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              background: tokens.surfaces.surfaceTinted,
              border: `1px solid ${tokens.surfaces.border}`,
              borderRadius: 12,
            }}
          >
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: '0 0 16px',
              }}
            >
              No posts tagged <em>{activeTag}</em> yet.
            </p>
            <Link
              href="/blog"
              style={{
                color: tokens.colors.accent,
                textDecoration: 'underline',
                fontWeight: 500,
              }}
            >
              View all posts
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {grid.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test the unfiltered view**

Reload `http://localhost:3000/blog`. Confirm:
- Page has the same top offset as `/blog/[slug]` — date eyebrow no longer cut off (no header element to clip here, but the `Blog` eyebrow should sit comfortably below the nav with breathing room).
- "BLOG" eyebrow in accent blue.
- "Notes from ThreadPlane" in Garamond, large.
- Subhead in muted gray bodyLg.
- Tag filter row: "All" pill is active (accent fill, white text); tag pills are inactive (accent tint).
- Featured card renders (AG-UI post), already brand-polished from Tasks 3/4.
- Grid below: at least the streaming-chat post renders with the new PostCard treatment.

- [ ] **Step 3: Smoke-test the filtered view**

Click any tag pill (e.g., `tutorial`). URL becomes `/blog?tag=tutorial`. Confirm:
- The clicked pill is now in active (accent-fill) state, "All" is inactive.
- The featured card is hidden.
- The grid shows only posts that include `tutorial` in their tags.

Click the active pill again. URL goes back to `/blog`. State resets.

- [ ] **Step 4: Smoke-test the empty state**

Navigate to `http://localhost:3000/blog?tag=__nonexistent__`. Confirm:
- Empty state card renders: "No posts tagged *__nonexistent__* yet."
- "View all posts" link returns to `/blog`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/blog/page.tsx
git commit -m "feat(blog): brand-polish landing page + server-side ?tag= filter"
```

---

## Task 6: E2E tests for the filtered landing page

Three tests that lock in the new behavior.

**Files:**
- Create: `apps/website/e2e/blog.spec.ts`

- [ ] **Step 1: Write the e2e tests**

Create [apps/website/e2e/blog.spec.ts](apps/website/e2e/blog.spec.ts):

```ts
import { test, expect } from '@playwright/test';

test.describe('Blog landing page', () => {
  test('renders brand header + tag filter + at least one post card', async ({ page }) => {
    await page.goto('/blog');

    // Brand eyebrow + H1
    await expect(page.getByText('Blog', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Notes from ThreadPlane/i })).toBeVisible();

    // Filter row contains the "All" chip in active state
    await expect(page.getByText('All', { exact: true })).toBeVisible();

    // At least one post link rendered
    await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
  });

  test('clicking a tag chip filters the list via ?tag=', async ({ page }) => {
    await page.goto('/blog');

    // Click the "tutorial" chip — assumes at least one post is tagged tutorial.
    await page.getByRole('link', { name: 'tutorial', exact: true }).first().click();

    // URL reflects the filter
    await expect(page).toHaveURL(/[?&]tag=tutorial(&|$)/);

    // The active chip uses aria-current=page
    await expect(page.locator('[aria-current="page"]').filter({ hasText: 'tutorial' })).toBeVisible();
  });

  test('unknown tag renders empty state with a view-all link', async ({ page }) => {
    await page.goto('/blog?tag=__no_such_tag__');

    await expect(page.getByText(/No posts tagged/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all posts' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx nx e2e website --skip-nx-cache -- --grep "Blog landing page"`
Expected: all three tests PASS.

- [ ] **Step 3: Run the whole website e2e suite**

Run: `npx nx e2e website --skip-nx-cache`
Expected: every test passes, including the existing docs and blog slug tests (no regressions from the lib refactor).

- [ ] **Step 4: Commit**

```bash
git add apps/website/e2e/blog.spec.ts
git commit -m "test(blog): e2e for landing page header, tag filter, and empty state"
```

---

## Task 7: Manual verification at desktop + mobile

Visual confirmation in Chrome via the preview MCP.

**Files:** none — observation only.

- [ ] **Step 1: Verify desktop layout (1440×900)**

Resize the preview to `width: 1440, height: 900`. Navigate to `/blog`. Screenshot. Confirm visually:

- Title and eyebrow aligned at the same left edge.
- Featured card has accent border, Garamond title, byline + date row.
- Post grid shows at least one card with the new top eyebrow row.
- No layout overflow on the right.

- [ ] **Step 2: Verify mobile layout (375×812)**

Resize to mobile preset. Navigate to `/blog`. Screenshot. Confirm:

- Hamburger nav present.
- Header eyebrow + H1 + subhead stack cleanly.
- Filter pills wrap to multiple lines.
- Featured card adapts width.
- Post grid collapses to single column.

- [ ] **Step 3: Verify filter persistence on a real click flow**

Back at desktop. Navigate `/blog` → click `tutorial` chip → confirm URL changes and grid filters → click the now-active `tutorial` chip → confirm URL resets to `/blog` and "All" becomes active again.

- [ ] **Step 4: Confirm article page still renders (regression check on Task 1's refactor)**

Open `/blog/build-fullstack-agentic-angular-apps-using-ag-ui`. Confirm the eyebrow still reads `TUTORIAL · MAY 21, 2026 · 11 MIN READ` and the body renders normally.

- [ ] **Step 5: No commit needed; verification only**

If anything looks off, capture the screenshot, file the fix as a new task, and report back. Otherwise, this task closes.

---

## Definition of done

- All seven tasks committed.
- `nx lint website` clean.
- `nx e2e website` green (including the three new tests).
- Manual verification at desktop + mobile confirms brand parity.
- Empty filter state renders correctly.
- Article page (`/blog/[slug]`) shows no regression from the utility extraction.

## Out of scope / follow-ups

These are explicit non-goals from the spec, captured here so they don't get smuggled into this plan:

- Multi-tag filtering (`?tag=a&tag=b`).
- Per-tag pre-rendered routes (`/blog/tag/[tag]/page.tsx`).
- Card chip click-to-filter (top filter row is the canonical affordance).
- Above-the-fold redesign (alternate hero shapes, horizontal scrollers, etc.).
