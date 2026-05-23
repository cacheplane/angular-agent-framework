# Blog landing page polish + filterable tags

> Brings `/blog` to the same brand standard as the article page (shipped in PR #528) and adds a server-rendered query-param tag filter.

## Goals

- Match the visual treatment of the homepage and article page (`/blog/[slug]`) on the blog landing page (`/blog`).
- Make tag chips functional filters via shareable URLs (`/blog?tag=tutorial`).
- Extract reusable date + reading-time utilities so the slug page and landing page share one source.
- No regressions to existing functionality (RSS, sitemap, featured-post surfacing).

## Non-goals

- Multi-tag filtering (`?tag=foo&tag=bar`). Single-tag covers current need; can extend later.
- Static per-tag routes (`/blog/tag/[tag]`). Query param suffices at this volume.
- Card-chip click-to-filter. Top filter row is the canonical filter affordance to avoid nested-anchor HTML.
- Above-the-fold redesign (alternate hero shapes, horizontal scrollers, category bands). Deferred.

## Architecture

```
apps/website/src/app/blog/
├── page.tsx                        # MODIFIED: outer shell, header, filter, featured/grid
└── [slug]/page.tsx                 # MODIFIED: import shared utilities

apps/website/src/components/blog/
├── FeaturedPostCard.tsx            # MODIFIED: Garamond title, formatted date, reading time
├── PostCard.tsx                    # MODIFIED: Garamond title, formatted date, reading time
└── BlogTagFilter.tsx               # NEW: server-rendered filter chip row with active/all states

apps/website/src/lib/
└── blog.ts                         # MODIFIED: add formatPostDate + readingTimeMin exports
```

## Components

### `blog/page.tsx` (modified)

- Reads `searchParams.tag` (optional string) on the server.
- Outer wrapper: `<div style={{ paddingTop: 80, background: tokens.surfaces.canvas, minHeight: '100vh' }}>` — clears the fixed nav.
- Inner container: `<div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px' }}>`.
- Header section:
  - `<Eyebrow tone="accent">Blog</Eyebrow>`
  - `<h1>` with `tokens.typography.h1.{family,size,line}`, `letterSpacing: -0.02em`, `color: tokens.colors.textPrimary`.
  - Subhead `<p>` with `tokens.typography.bodyLg.{family,size,line}`, `color: tokens.colors.textSecondary`, `maxWidth: '60ch'`.
- `<BlogTagFilter activeTag={tag} tags={allTags} />`.
- Featured-post block: shown **only when no filter active**.
- Grid: same `repeat(auto-fill, minmax(300px, 1fr))` layout for non-featured posts (filtered or full set).
- Empty state: if `?tag=…` matches zero posts, render a centered message ("No posts tagged *X* yet.") + a `<Link href="/blog">View all posts</Link>`.

### `BlogTagFilter` (new)

Props:
```ts
interface BlogTagFilterProps {
  activeTag?: string;       // current ?tag value, undefined when on /blog
  tags: string[];           // all known tags
}
```

Renders a horizontal flex row of chips:
- **"All"** chip — active when `activeTag` is undefined. `href="/blog"` when inactive; non-link `<span>` when active.
- One chip per tag (sorted alphabetically) — active when `tag === activeTag`. `href="/blog?tag={tag}"` when inactive; clicking the currently active tag links back to `/blog` (toggle off).
- Active styling: `background: tokens.colors.accent, color: white`.
- Inactive styling: matches existing `TagChips` — `background: tokens.colors.accentSurface, color: tokens.colors.accent`.
- All chips: `padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, textDecoration: 'none'`.
- Container: `display: flex, gap: 8, flexWrap: wrap, marginBottom: 32`.

`BlogTagFilter` replaces the existing `<TagChips tags={tags} />` in `blog/page.tsx`. The existing `TagChips` component is **kept** for use inside `PostCard` (visual-only chips on cards).

### `FeaturedPostCard` (modified)

Same accent-bordered link card, but:
- `<h2>` now uses `tokens.typography.h2.{family,size,line}` if those tokens exist, else falls back to `fontFamily: tokens.typography.h1.family, fontSize: '2rem', lineHeight: 1.15`. (Determine during implementation by inspecting `@ngaf/design-tokens`.)
- Description renders via `bodyLg` tokens.
- Bottom row keeps `<AuthorByline>` on the left, but the right side becomes a small uppercase mono eyebrow: `{formatPostDate(frontmatter.date)} · {readingTimeMin(content)} min read`.
- Use `Eyebrow` component for the FEATURED kicker (consistency with header).

### `PostCard` (modified)

- Top meta row replaces the bare `<time>`: a small uppercase mono eyebrow row showing `{formatPostDate(frontmatter.date)} · {readingTimeMin(content)} min read`. Uses the `Eyebrow` component or matches its styling inline.
- `<h3>` switches to `fontFamily: tokens.typography.h1.family` (Garamond) with a reduced size (~1.25rem) and tight leading.
- Description retains existing styling.
- Tag chips at the bottom: **visual-only**, same styling as today (kept inside the `<Link>` card so the whole card remains clickable).
- Card hover: piggyback on the existing `[data-ui="card"][data-hoverable]:hover` rule in `global.css` by adding `data-ui="card" data-hoverable` to the `<Link>` root. Verifies brand-consistent hover (1px lift + shadow).

### `lib/blog.ts` (modified)

Add two exports:

```ts
export function formatPostDate(iso: string): string {
  // Parse YYYY-MM-DD as UTC midnight and format in UTC so '2026-05-21' never
  // renders as 'May 20' west of UTC. Existing copy in blog/[slug]/page.tsx.
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export function readingTimeMin(markdown: string): number {
  // 220 wpm, code fences stripped (not real reading time). Existing copy in
  // blog/[slug]/page.tsx.
  const words = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
```

`blog/[slug]/page.tsx` imports these instead of defining them locally — single source of truth.

## Data flow

1. `BlogIndexPage` is an async server component receiving `{ searchParams }: { searchParams: Promise<{ tag?: string }> }` (Next.js 16 async-searchParams convention).
2. Reads `tag` from `await searchParams`.
3. `getAllPosts()` → full list. Filter to `posts.filter(p => p.frontmatter.tags?.includes(tag))` when `tag` set.
4. `getFeaturedPost()` only used when `tag` not set.
5. `getAllTags()` returns the full deduped tag list (existing helper) for the filter row.
6. Renders header, filter, featured (conditional), grid (filtered or full set minus featured), empty state if grid is empty.

## Accessibility

- Filter chips: each is a `<Link>` with descriptive text content. Active chip uses `aria-current="page"` per the Next.js convention for link state.
- "All" chip: same — `aria-current="page"` when no `tag` query.
- Card root: existing `<Link>` semantics preserved. Title is the accessible name (first text inside).
- Card chips: now visual-only — wrapped in `<span aria-hidden="false">` or omitted from AT names if necessary. Since they convey topic information, keep them readable to screen readers.

## SEO / metadata

- `generateMetadata` (currently only `metadata` static export) stays the static export — the filter view doesn't need separate titles. (Could be added later as a follow-up if filtered pages need crawlable titles.)

## Testing

- **Existing e2e (`apps/website/e2e/`):** add three new tests in a new `blog.spec.ts` (or extend existing `website.spec.ts`):
  1. `/blog` renders the brand eyebrow, Garamond H1, and at least one post card.
  2. Clicking a tag chip navigates to `/blog?tag=…` and shows only matching posts.
  3. `/blog?tag=__nonexistent__` shows the empty state with a "View all posts" link.
- **No new unit tests** required. Pure rendering + server-side filter logic is exercised by e2e.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Filter chip looks too prominent when many tags exist | Wrap with `flexWrap` and cap visible tags via `getAllTags()`'s natural ordering. If volume grows, add a `+N more` overflow in a follow-up. |
| Garamond on small headings (`PostCard h3`) reads weird at small sizes | Test at the implementation step; fall back to sans-serif heading family if Garamond at 1.25rem feels off. |
| Existing `TagChips` is reused for both filter row and card chips and they diverge | Split: keep `TagChips` for visual-only card chips; new `BlogTagFilter` for the filter row. Clean separation. |
| `searchParams` async typing differs across Next.js versions | Pin to the Next.js 16 pattern matching `app/blog/[slug]/page.tsx`'s existing handling. |

## Migration / rollout

- Single PR. No data migration, no feature flag, no deprecations. Old `/blog` URL stays valid; query param is additive.
- Existing RSS, sitemap, OG image generation all continue to work (they read frontmatter, not the rendered HTML).

## Done when

- `/blog` renders with brand eyebrow, Garamond H1, bodyLg subhead, paddingTop nav offset.
- Tag chips at the top filter the list via `?tag=`. Active chip uses accent fill, inactive uses accent-tint.
- `FeaturedPostCard` + `PostCard` use Garamond titles, formatted dates, and reading time.
- `formatPostDate` and `readingTimeMin` live in `lib/blog.ts`; the slug page imports them.
- Empty filter state renders a message + back link.
- `nx lint website` + `nx e2e website` green locally and in CI.
- Manually verified at 1440px desktop and 375px mobile in Chrome.
