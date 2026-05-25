# Recent Articles Home Page Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-rendered "Recent articles" section to the marketing home page (`/`) between `<FinalCTA />` and the footer, reusing the existing `<PostCard>`.

**Architecture:** New `RecentArticles` server component reads from a thin new lib helper (`getRecentNonFeatured`) that filters the featured post out of `getAllPosts()`. No client state, no async data, no new dependencies. Reuses `<Section>`, `<Container>`, `<Eyebrow>`, `<PostCard>` exactly as they exist today.

**Tech Stack:** Next.js 16 (app router, RSC), `@ngaf/design-tokens`, Vitest (unit), Playwright (e2e). No new packages.

**Spec:** [docs/superpowers/specs/2026-05-25-recent-articles-home-section-design.md](docs/superpowers/specs/2026-05-25-recent-articles-home-section-design.md)

---

## File map

- Modify: `apps/website/src/lib/blog.ts` — add `getRecentNonFeatured`.
- Modify: `apps/website/src/lib/blog.spec.ts` — add unit tests for `getRecentNonFeatured`.
- Create: `apps/website/src/components/landing/RecentArticles.tsx` — section component.
- Modify: `apps/website/src/app/page.tsx` — import + render `<RecentArticles />` after `<FinalCTA />`.
- Create: `apps/website/e2e/recent-articles.spec.ts` — e2e visibility + link.

---

## Task 1: Unit-test `getRecentNonFeatured`

TDD — write the failing test first, then implement.

**Files:**
- Modify: `apps/website/src/lib/blog.spec.ts`

- [ ] **Step 1: Add the failing test**

Append three `it()` blocks at the end of the existing `describe('blog.ts', ...)` block (before its closing `})`). The fixtures `post1` and `post2` are already declared at the top of the file:

```ts
  it('getRecentNonFeatured excludes the featured post', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-10-second-post.mdx': post2,
    });
    const { getRecentNonFeatured } = await import('./blog');
    // post2 is featured (see fixture at top of file). Expect only post1.
    expect(getRecentNonFeatured().map((p) => p.slug)).toEqual(['first-post']);
  });

  it('getRecentNonFeatured caps at the limit', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-05-extra-a.mdx': post1.replace('First Post', 'Extra A'),
      '2026-05-06-extra-b.mdx': post1.replace('First Post', 'Extra B'),
      '2026-05-07-extra-c.mdx': post1.replace('First Post', 'Extra C'),
      '2026-05-10-second-post.mdx': post2,
    });
    const { getRecentNonFeatured } = await import('./blog');
    // post2 is featured and filtered out; remaining 4 should be capped to 3.
    const result = getRecentNonFeatured(3);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.slug)).not.toContain('second-post');
  });

  it('getRecentNonFeatured returns [] when only the featured post exists', async () => {
    setupFs({
      '2026-05-10-second-post.mdx': post2,
    });
    const { getRecentNonFeatured } = await import('./blog');
    expect(getRecentNonFeatured()).toEqual([]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run from the repo root:

```bash
npx nx test website --testFile=src/lib/blog.spec.ts
```

Expected: the three new `getRecentNonFeatured` tests FAIL with `TypeError: ... is not a function` (function doesn't exist yet). Existing tests stay green.

- [ ] **Step 3: Implement the helper**

In [apps/website/src/lib/blog.ts](apps/website/src/lib/blog.ts), append this export at the end of the file (after `readingTimeMin`):

```ts
/**
 * Recent posts excluding the one currently surfaced as featured on /blog.
 *
 * Used by the home page "Recent articles" section so visitors don't see the
 * same headline post twice (once in the featured slot at /blog and again on
 * the home page). `getAllPosts()` already sorts newest-first and excludes
 * drafts, so this is a thin filter on top.
 *
 * @param limit Maximum number of posts to return. Defaults to 3.
 */
export function getRecentNonFeatured(limit = 3): Post[] {
  const featured = getFeaturedPost();
  return getAllPosts()
    .filter((p) => p.slug !== featured?.slug)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the tests again — all green**

```bash
npx nx test website --testFile=src/lib/blog.spec.ts
```

Expected: ALL tests pass (including the three new ones and the existing blog.ts suite).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/blog.ts apps/website/src/lib/blog.spec.ts
git commit -m "feat(blog): add getRecentNonFeatured helper for home page strip"
```

---

## Task 2: Build the `RecentArticles` component

New server component that renders the section. Mirrors the visual structure of `HomeFAQ` (Section → Container → centered header → content) but left-aligns the header to match the article-grid posture used elsewhere on the page.

**Files:**
- Create: `apps/website/src/components/landing/RecentArticles.tsx`

- [ ] **Step 1: Create the component**

Write [apps/website/src/components/landing/RecentArticles.tsx](apps/website/src/components/landing/RecentArticles.tsx):

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { PostCard } from '../blog/PostCard';
import { getRecentNonFeatured } from '../../lib/blog';

/**
 * Marketing-home strip showing the three most recent non-featured posts.
 * Renders nothing when no eligible posts exist, so the home page stays clean
 * while the blog catalog is small.
 */
export function RecentArticles() {
  const posts = getRecentNonFeatured(3);
  if (posts.length === 0) return null;

  return (
    <Section surface="canvas" ariaLabelledBy="recent-articles-heading">
      <Container>
        <div style={{ marginBottom: 32 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
            Blog
          </Eyebrow>
          <h2
            id="recent-articles-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              color: tokens.colors.textPrimary,
              margin: 0,
            }}
          >
            Recent articles
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link
            href="/blog"
            style={{
              color: tokens.colors.accent,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            View all articles →
          </Link>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p apps/website/tsconfig.json
```

Expected: PASS with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/RecentArticles.tsx
git commit -m "feat(website): add RecentArticles home page section component"
```

---

## Task 3: Wire `RecentArticles` into the home page

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Add the import**

In [apps/website/src/app/page.tsx](apps/website/src/app/page.tsx), find the existing landing imports near the top of the file:

```ts
import { FinalCTA } from '../components/landing/FinalCTA';
```

Immediately after that line, add:

```ts
import { RecentArticles } from '../components/landing/RecentArticles';
```

- [ ] **Step 2: Render the section**

Find the closing of the JSX fragment that contains `<FinalCTA />`:

```tsx
      <HomeFAQ />
      <FinalCTA />
    </>
```

Insert `<RecentArticles />` between `<FinalCTA />` and the closing `</>`:

```tsx
      <HomeFAQ />
      <FinalCTA />
      <RecentArticles />
    </>
```

- [ ] **Step 3: Smoke-test in the running dev server**

Confirm the dev server is up:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200`.

Then check the new section renders:

```bash
curl -s http://localhost:3000/ | grep -oE 'id="recent-articles-heading"' | head -1
curl -s http://localhost:3000/ | grep -oE 'View all articles' | head -1
```

Expected output:
```
id="recent-articles-heading"
View all articles
```

Also confirm the section sits below the final-CTA heading in the rendered HTML:

```bash
python3 -c "
t = open('/dev/stdin').read()
i_cta = t.find('final-cta-heading')
i_rec = t.find('recent-articles-heading')
print('cta idx:', i_cta, 'rec idx:', i_rec, 'ordered:', i_cta != -1 and i_rec != -1 and i_cta < i_rec)
" < <(curl -s http://localhost:3000/)
```

Expected: `ordered: True`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat(website): render RecentArticles after FinalCTA on home page"
```

---

## Task 4: E2E test

Three Playwright assertions that lock in the new section's behavior on `/`.

**Files:**
- Create: `apps/website/e2e/recent-articles.spec.ts`

- [ ] **Step 1: Write the e2e tests**

Write [apps/website/e2e/recent-articles.spec.ts](apps/website/e2e/recent-articles.spec.ts):

```ts
import { test, expect } from '@playwright/test';

test.describe('Home page — Recent articles', () => {
  test('renders the section header on /', async ({ page }) => {
    await page.goto('/');
    // Stable id, not copy — copy changes more often than structure.
    await expect(page.locator('#recent-articles-heading')).toBeVisible();
    await expect(page.locator('#recent-articles-heading')).toHaveText(/Recent articles/i);
  });

  test('shows at least one post card linking to /blog/<slug>', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section[aria-labelledby="recent-articles-heading"]');
    await expect(section).toBeVisible();
    // At least one card with a blog post link inside the section.
    const firstCard = section.locator('a[href^="/blog/"]').first();
    await expect(firstCard).toBeVisible();
  });

  test('"View all articles" link points to /blog', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section[aria-labelledby="recent-articles-heading"]');
    const viewAll = section.getByRole('link', { name: /View all articles/i });
    await expect(viewAll).toBeVisible();
    await expect(viewAll).toHaveAttribute('href', '/blog');
  });
});
```

- [ ] **Step 2: Run the new tests**

```bash
npx nx e2e website --skip-nx-cache -- --grep "Recent articles"
```

Expected: all three tests PASS.

- [ ] **Step 3: Run the whole website e2e suite to confirm no regressions**

```bash
npx nx e2e website --skip-nx-cache
```

Expected: every test passes, including the existing landing-page, docs, and blog suites.

- [ ] **Step 4: Commit**

```bash
git add apps/website/e2e/recent-articles.spec.ts
git commit -m "test(website): e2e for Recent articles home section"
```

---

## Task 5: Manual verification

Visual confirmation in the running dev server. No code, no commit.

**Files:** none — observation only.

- [ ] **Step 1: Desktop check**

Open `http://localhost:3000/` in a browser at desktop width (≥1280px). Scroll to the bottom of the page.

Confirm in order from bottom up (above the global footer):
- **Recent articles section** with eyebrow "BLOG" (accent blue, uppercase mono) + H2 "Recent articles" (Garamond, large).
- A grid of `<PostCard>`s below the header (currently 1 card given the repo state; more as posts land).
- A centered "View all articles →" link below the grid in accent color.
- **Above it**, the tinted `<FinalCTA>` section ("Stop stalling on agentic Angular.") still renders unchanged.

- [ ] **Step 2: Mobile check**

Resize to a 375px viewport (Chrome DevTools mobile preset). Confirm:
- Section header stacks left-aligned.
- Card grid collapses to a single column.
- Tail "View all articles →" link is still centered.
- No horizontal overflow.

- [ ] **Step 3: Empty-state check (defensive)**

Temporarily flip `featured: false` on the older `2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx` to verify behavior at the boundary: with that change, `getFeaturedPost()` still picks the AG-UI post but now the streaming post is no longer featured, so it appears in the grid. Confirm:
- Grid shows the streaming-chat card.
- Header + tail link still render.

Then **revert the frontmatter change** — this is a verification-only edit, do not commit it.

```bash
git checkout apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx
```

- [ ] **Step 4: Zero-eligible check (visual)**

Temporarily edit `apps/website/src/components/landing/RecentArticles.tsx` to force `posts = []`:

```tsx
const posts = getRecentNonFeatured(3).slice(0, 0); // TEMP — verifies null branch
```

Reload `/`. Confirm the section is **completely absent** from the rendered HTML (the FinalCTA is now the last block before the footer, with no gap). Then **revert**:

```bash
git checkout apps/website/src/components/landing/RecentArticles.tsx
```

- [ ] **Step 5: No commit needed**

If everything looks right, this task closes. If anything is off, file a follow-up and report back.

---

## Definition of done

- All five tasks committed (Tasks 1–4 produce commits; Task 5 is verification only).
- `npx nx lint website` clean.
- `npx nx test website` green including the three new `getRecentNonFeatured` unit tests.
- `npx nx e2e website` green including the three new Recent-articles e2e tests.
- Manual smoke at desktop + mobile confirms the section renders below `<FinalCTA />` and the "View all articles →" link navigates to `/blog`.
- When zero eligible posts exist, the section is absent from the rendered HTML.

## Out of scope / follow-ups

These are explicit non-goals from the spec, captured here so they don't get smuggled in:

- No tag filter on the home page (lives only at `/blog`).
- No "Featured" callout on the home page — the featured post already lives at the top of `/blog`.
- No skeleton/loading state — server component reads from disk synchronously.
- No PostCard variant — reuse the existing component as-is.
- No client-side interactivity in this section.
