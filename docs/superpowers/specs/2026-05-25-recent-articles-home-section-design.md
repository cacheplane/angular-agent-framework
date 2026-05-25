# Recent Articles — Home Page Section

**Status:** Design approved · ready for implementation plan
**Owner:** Brian Love
**Date:** 2026-05-25

## Goal

Add a "Recent articles" section to the marketing home page that surfaces the latest blog content without redundantly repeating the featured post. Improves blog discoverability for visitors who land on `/` and never click into the nav.

## Placement

In `apps/website/src/app/page.tsx`, insert the new section **between `<FinalCTA />` and the end of the page fragment**. The layout's `<footer>` renders outside the page tree, so this becomes the last visual block above the global footer.

Resulting section rhythm:

```
… HomeFAQ          (canvas)
   FinalCTA        (tinted)   ← marketing climax stays the high-contrast block
   RecentArticles  (canvas)   ← new
   <footer>        (separate, global)
```

## Header

Left-aligned, follows the existing brand pattern from other home blocks:

- `<Eyebrow tone="accent">BLOG</Eyebrow>` — mono, uppercase, 12px, accent color
- `<h2>` in Garamond, copy: **"Recent articles"** — tokens.typography.h2
- No subhead — the cards carry the content.

## Grid

Re-uses the existing `<PostCard>` component verbatim:

```ts
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  }}
>
  {posts.map((p) => <PostCard key={p.slug} post={p} />)}
</div>
```

This is the same grid signature used on `/blog`, so brand parity (eyebrow date row, h3 title, tag chips, hover) is free.

## Data

Add one helper to `apps/website/src/lib/blog.ts`:

```ts
/**
 * Recent posts excluding the featured one shown at the top of /blog.
 * Used by the home page "Recent articles" section.
 */
export function getRecentNonFeatured(limit = 3): Post[] {
  const featured = getFeaturedPost();
  return getAllPosts()
    .filter((p) => p.slug !== featured?.slug)
    .slice(0, limit);
}
```

`getAllPosts()` already sorts newest-first and excludes drafts, so this is a thin filter on top.

## Component

New file: `apps/website/src/components/landing/RecentArticles.tsx`.

- Server component, no props, no client-state.
- Calls `getRecentNonFeatured(3)` synchronously (same pattern as the rest of the home page server components).
- Wrapped in `<Section surface="canvas" ariaLabelledBy="recent-articles-heading">` + `<Container>` for surface + max-width consistency.
- Renders `null` early if the helper returns zero posts — keeps the home page clean while the blog catalog is still small.

Skeleton structure:

```tsx
export function RecentArticles() {
  const posts = getRecentNonFeatured(3);
  if (posts.length === 0) return null;
  return (
    <Section surface="canvas" ariaLabelledBy="recent-articles-heading">
      <Container>
        <Eyebrow tone="accent" style={{ marginBottom: 16 }}>BLOG</Eyebrow>
        <h2 id="recent-articles-heading" style={{ /* h2 tokens */ }}>
          Recent articles
        </h2>
        <div style={{ /* grid styles */ }}>
          {posts.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/blog" style={{ color: tokens.colors.accent, fontWeight: 500 }}>
            View all articles →
          </Link>
        </div>
      </Container>
    </Section>
  );
}
```

Exact token values come from `@ngaf/design-tokens` (h2 family/size/line) — kept inline to match the rest of the home page.

## Wiring

```tsx
// apps/website/src/app/page.tsx
import { RecentArticles } from '../components/landing/RecentArticles';

…
      <HomeFAQ />
      <FinalCTA />
      <RecentArticles />
    </>
```

## Empty / partial states

- **0 posts after filter:** section renders nothing. No "no posts yet" placeholder on the home page.
- **1 or 2 posts:** grid renders them. The `auto-fill, minmax(300px, 1fr)` keeps each card a reasonable width when fewer than three slots are filled.
- **3+ posts:** capped at 3 by the `limit` arg.

Current repo state: both existing posts are marked `featured: true`. `getFeaturedPost()` returns the newest of them (AG-UI). The filter leaves the older streaming-chat post, so the section will render 1 card on first ship. That's intentional — the design accommodates growth as new posts land.

## Tail CTA

Below the grid, centered, 32px top margin:

> **View all articles →**

Plain `<Link href="/blog">` in `tokens.colors.accent`, weight 500, no button chrome. Matches the inline-link affordance used elsewhere on the home page (e.g., feature-block `cta` link).

## Out of scope (explicit non-goals)

- No tag-filter UI on the home page (lives only at `/blog`).
- No "Featured" callout on the home page — the featured post lives at the top of `/blog`.
- No skeleton/loading state. Server component, no async data.
- No PostCard variant. Reuse the existing component as-is.
- No client-side interactivity. Pure server render.

## Testing

- One Playwright spec in `apps/website/e2e/home.spec.ts` (extending whatever already exists, or new file) that asserts:
  - The "Recent articles" H2 is visible on `/`.
  - At least one card with `href^="/blog/"` is visible.
  - The "View all articles" link points to `/blog`.
- One unit test for `getRecentNonFeatured`:
  - Returns at most `limit` posts.
  - Never includes the post returned by `getFeaturedPost()`.
  - Returns `[]` when only the featured post exists.

## Files touched

- New: `apps/website/src/components/landing/RecentArticles.tsx`
- Modified: `apps/website/src/lib/blog.ts` (add `getRecentNonFeatured`)
- Modified: `apps/website/src/app/page.tsx` (import + render `<RecentArticles />`)
- New: `apps/website/src/lib/blog.spec.ts` (or extend existing) — `getRecentNonFeatured` tests
- New or extended: `apps/website/e2e/home.spec.ts` — visibility assertions

## Definition of done

- `nx lint website` clean.
- `nx test website` green including new unit tests.
- `nx e2e website` green including new home-page assertions.
- Manual smoke at desktop + mobile: header renders, grid lays out correctly, "View all articles" link navigates to `/blog`.
- When zero non-featured posts exist, the section is absent from the rendered HTML.
