---
workstream: content-pillar-pages
status: approved
owner: brian
phase: 2
spec: docs/superpowers/specs/gtm/2026-05-17-content-pillar-pages-design.md
plan: docs/superpowers/plans/gtm/2026-05-17-content-pillar-pages.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Spec 5 — Content Pillar Pages (Design)

> Phase 2 ecosystem deliverable. Stand up `/blog` on cacheplane.ai as a long-form SEO surface — flat URLs, MDX-driven, RSS-fed, OG-imaged, analytics-instrumented. Ship one seed pillar post written in Brian Love's existing blog voice. Remaining pillar posts land as follow-up commits against the same infra.

## 1. Goal

Two outcomes:

1. **A production-grade blog infrastructure** on `cacheplane.ai/blog` that reuses the existing MDX renderer + design system + analytics pipeline. Frontmatter-driven, flat URLs, RSS feed, per-post OG image, sitemap inclusion, dedicated `blog:*` analytics namespace.
2. **The first pillar post — "Build a streaming chat UI in Angular with LangGraph"** — drafted in Brian Love's existing voice (sourced from `~/repos/brianflove/src/content/posts/2026-*.md`). The seed post is the highest-leverage SEO target for the developer-track funnel.

Phase 2 exit criterion (per `gtm.md`) is "6 pillar pages indexed, organic traffic baseline captured." Spec 5 satisfies the infrastructure half plus 1 of the 6 posts. The remaining 5 land as follow-up content commits against the same infra — each a focused review.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §6 (Phase 2: Ecosystem path).
- Reference layout: `~/repos/dawn/apps/web/{app/blog,content/blog}` — date-prefixed MDX filenames, flat URLs, RSS, tags. Adopted wholesale.
- Voice reference: `~/repos/brianflove/src/content/posts/2026-*.md` — Brian's existing blog. The seed post must match this voice.
- Reused infra already in the cacheplane website:
  - `next-mdx-remote/rsc` MDX pipeline with custom components (`Callout`, `Steps`, `Tabs`, `Card`, `CodeGroup`, `Pre`).
  - `rehype-pretty-code` (tokyo-night), `rehype-slug`, `remark-gfm`.
  - `createPageMetadata()` for OG + canonical.
  - `getSitemapRoutes()` for sitemap.
  - Default `opengraph-image.tsx` at the route level via `next/og` `ImageResponse`.
- `docs:*` analytics namespace is the established pattern; `blog:*` is the parallel namespace this spec introduces.

## 3. Scope

**In scope:**

- **Routes:**
  - `/blog` — index page (date-sorted, featured post on top, post grid below, tag chips).
  - `/blog/[slug]` — dynamic post route reusing `<MdxRenderer>`. Renders title, date, author byline, body, tags, "more posts" links at bottom.
  - `/blog/[slug]/opengraph-image.tsx` — per-post 1200×630 OG card with post title + author. Falls back to the default site OG card if the post can't be resolved.
  - `/blog/rss.xml` — RSS 2.0 feed, `Content-Type: application/rss+xml`.
- **Content:** `apps/website/content/blog/YYYY-MM-DD-<slug>.mdx`. Date-prefixed filenames so the directory listing matches publish order. Slug derived from filename minus the date prefix.
- **Frontmatter shape** (required keys bolded):
  - **`title`** — string, 60-80 chars
  - **`description`** — string, 130-180 chars (used in `<meta>`, RSS `<description>`, social previews)
  - **`date`** — ISO `YYYY-MM-DD`
  - `tags` — `string[]`, lowercase kebab-case
  - **`author`** — registry key (`brian` in v1)
  - `featured` — boolean, optional. The first `featured: true` post in date-desc order becomes the featured slot on `/blog`. If none, the most recent post is featured.
  - `draft` — boolean, optional. When true, the post is skipped by `getAllPosts()` in production builds and from RSS + sitemap. (Internal preview path TBD; out of scope here. Drafts simply don't appear in listings; a direct URL still works for review.)
- **Author registry** at `apps/website/src/lib/blog-authors.ts` with one entry (`brian`) — name, role, optional `bio`, optional `twitter`, optional `github`, optional `avatar` path. The byline renders gracefully without avatar/twitter/github fields.
- **Analytics:** add two new event names to `events.ts` and `taxonomy.md`:
  - `blog:cta_click` — tracked CTAs inside post bodies (e.g., links to `/pricing`, `/contact`). Properties: `surface: 'blog'`, `cta_id?: CtaId`, `destination_url?: string`.
  - `blog:copy_code_click` — copy-button click on a code block. Properties: `surface: 'blog'`, `code_lang?: string`.
  - Add `'blog'` to the `AnalyticsSurface` union.
- **Nav:** add a `Blog` link to the site nav. Position between `Pricing` and the `GitHub` icon (or wherever the navbar's existing convention puts secondary links).
- **Sitemap:** `getSitemapRoutes()` includes `/blog` plus every published `/blog/[slug]`. Sorted desc by date. `changeFrequency: 'weekly'` for the index, `'monthly'` for individual posts. Priority 0.7 for both.
- **Seed pillar post** at `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx`. ~2,500 words. Written in Brian Love's voice (see §6 for voice rules and outline).
- **Unit tests:**
  - `apps/website/src/lib/blog.spec.ts` — `getAllPosts()` returns posts sorted desc; `getPostBySlug()` returns a known seed post; frontmatter parsing populates required fields; missing-required-field frontmatter throws a helpful error.
  - `apps/website/src/components/blog/PostCard.spec.tsx` — renders title, date, and tag chips for a given post.
- **Verification:** `nx run website:build` green; manual smoke at `localhost:3000/blog` and `/blog/[seed-slug]`; RSS feed validates as XML.

**Out of scope (deferred to follow-ups):**

- Posts 2-6 of the 6-post pillar set. Each lands as a separate commit/PR against this infra.
- `/blog/tags/[tag]` per-tag pages. v1 has tag chips on the index that filter client-side (or just link nowhere). Per-tag pages are a follow-up.
- A draft preview workflow (e.g., `?preview=token` to render `draft: true` posts on production).
- Blog-specific MDX components (e.g., `<Tweet>`, `<Aside>`). v1 reuses the docs-flavor MDX components. Add post-specific ones in follow-ups if a post requires them.
- A blog-specific design refresh. v1 reuses the existing tokens + section styling.
- Comment threads, claps, reactions. Out for v1.
- A newsletter-on-publish hook (e.g., Loops trigger). Out for v1.

**Success criteria:**

- `/blog` renders with the seed post visible.
- `/blog/[seed-slug]` renders the full post with author byline, syntax-highlighted code, and OG-image-driven `<meta>` tags.
- `/blog/rss.xml` returns a valid RSS 2.0 XML document containing the seed post.
- Sitemap includes the new routes.
- `nx run website:build` green; `nx run website:test` (via `npx vitest run` from `apps/website/`) green for the new tests.
- The seed post passes a manual content review by Brian (post-merge content edits are expected and welcome).

## 4. Architecture

```
content/blog/YYYY-MM-DD-<slug>.mdx       (date-prefixed filenames, source of truth)
   │
   ▼ getAllPosts() / getPostBySlug()  ──── frontmatter parse + body
   │
   ├──▶ /blog               (index page)
   │       Featured: most recent `featured: true` post (or latest)
   │       Grid:     all other published posts, date-desc
   │
   ├──▶ /blog/[slug]        (dynamic route, MdxRenderer)
   │       Title + AuthorByline + date + body + tags
   │
   ├──▶ /blog/[slug]/opengraph-image.tsx    (per-post OG card)
   │       1200×630 PNG via `next/og` ImageResponse, reads frontmatter
   │
   ├──▶ /blog/rss.xml       (RSS 2.0 feed)
   │       sorted desc by date, all published posts
   │
   └──▶ sitemap.ts          (every published /blog/[slug] + /blog)
```

Posts NEVER trigger lifecycle signals or cockpit telemetry. They emit only `$pageview` + the two new `blog:*` events.

## 5. Components

### 5.1 `apps/website/src/lib/blog.ts` (new)

Server-only utility module. Reads MDX files synchronously at request time (build-time on static routes).

```typescript
// SPDX-License-Identifier: MIT
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'apps/website/content/blog');
// Fallback path for when CWD is the website app itself (during dev/test).
const BLOG_DIR_FALLBACK = path.join(process.cwd(), 'content/blog');

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string;            // ISO YYYY-MM-DD
  tags?: string[];
  author: string;          // key into blog-authors.ts
  featured?: boolean;
  draft?: boolean;
}

export interface Post {
  slug: string;            // filename without date prefix and .mdx
  date: string;
  frontmatter: PostFrontmatter;
  content: string;         // raw MDX body
  filename: string;
}

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/;

function resolveBlogDir(): string {
  if (fs.existsSync(BLOG_DIR)) return BLOG_DIR;
  if (fs.existsSync(BLOG_DIR_FALLBACK)) return BLOG_DIR_FALLBACK;
  return BLOG_DIR; // best effort; downstream readdir will throw helpfully
}

function readPost(filename: string): Post | null {
  const match = filename.match(FILENAME_RE);
  if (!match) return null;
  const [_, date, slug] = match;
  const full = path.join(resolveBlogDir(), filename);
  const { data, content } = matter(fs.readFileSync(full, 'utf8'));
  const fm = data as Partial<PostFrontmatter>;
  if (!fm.title || !fm.description || !fm.date || !fm.author) {
    throw new Error(`Blog post ${filename} missing required frontmatter (title, description, date, author).`);
  }
  return {
    slug,
    date,
    frontmatter: fm as PostFrontmatter,
    content,
    filename,
  };
}

export function getAllPosts(opts: { includeDrafts?: boolean } = {}): Post[] {
  const dir = resolveBlogDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'));
  const posts: Post[] = [];
  for (const f of files) {
    const post = readPost(f);
    if (!post) continue;
    if (post.frontmatter.draft && !opts.includeDrafts) continue;
    posts.push(post);
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts({ includeDrafts: true }).find((p) => p.slug === slug) ?? null;
}

export function getFeaturedPost(): Post | null {
  const posts = getAllPosts();
  return posts.find((p) => p.frontmatter.featured) ?? posts[0] ?? null;
}

export function getAllTags(): { tag: string; count: number }[] {
  const tags = new Map<string, number>();
  for (const p of getAllPosts()) {
    for (const t of p.frontmatter.tags ?? []) {
      tags.set(t, (tags.get(t) ?? 0) + 1);
    }
  }
  return [...tags.entries()].map(([tag, count]) => ({ tag, count }));
}
```

### 5.2 `apps/website/src/lib/blog-authors.ts` (new)

```typescript
// SPDX-License-Identifier: MIT
export interface Author {
  name: string;
  role?: string;
  bio?: string;
  twitter?: string;       // handle without @
  github?: string;        // handle without @
  avatar?: string;        // path under /public, e.g. '/authors/brian.jpg'
}

export const blogAuthors: Record<string, Author> = {
  brian: {
    name: 'Brian Love',
    role: 'Founder, Cacheplane',
    bio: 'Angular consultant and open-source maintainer. Building agent UI for Angular teams.',
    github: 'blove',
  },
} as const;

export function getAuthor(key: string): Author {
  return blogAuthors[key] ?? { name: key };
}
```

### 5.3 `apps/website/src/app/blog/page.tsx` (new)

Server component. Composition:

```tsx
import { Container, Section, Eyebrow } from '@/components/ui/*';
import { FeaturedPostCard } from '@/components/blog/FeaturedPostCard';
import { PostCard } from '@/components/blog/PostCard';
import { TagChips } from '@/components/blog/TagChips';
import { getAllPosts, getFeaturedPost, getAllTags } from '@/lib/blog';
import { createPageMetadata } from '@/lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Blog — Cacheplane',
  description: 'Long-form writing on agent UI for Angular: streaming, generative UI, threads, interrupts, production patterns.',
  pathname: '/blog',
  type: 'website',
});

export default function BlogIndex() {
  const all = getAllPosts();
  const featured = getFeaturedPost();
  const rest = featured ? all.filter((p) => p.slug !== featured.slug) : all;
  const tags = getAllTags();
  return (
    <Section surface="canvas">
      <Container>
        <Eyebrow>Blog</Eyebrow>
        <h1>Notes from Cacheplane</h1>
        <p>Writing on agent UI for Angular — production patterns, design choices, and what we're shipping.</p>
        <TagChips tags={tags.map(t => t.tag)} />
        {featured && <FeaturedPostCard post={featured} />}
        <div /* grid */>
          {rest.map((p) => <PostCard key={p.slug} post={p} />)}
        </div>
      </Container>
    </Section>
  );
}
```

(Markup, styles, and exact composition follow existing cacheplane site patterns. The implementer adapts spacing/tokens to match the existing landing/pricing aesthetic.)

### 5.4 `apps/website/src/app/blog/[slug]/page.tsx` (new)

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MdxRenderer } from '@/components/docs/MdxRenderer';
import { AuthorByline } from '@/components/blog/AuthorByline';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { getAuthor } from '@/lib/blog-authors';
import { createPageMetadata } from '@/lib/site-metadata';

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found — Cacheplane' };
  return createPageMetadata({
    title: `${post.frontmatter.title} — Cacheplane`,
    description: post.frontmatter.description,
    pathname: `/blog/${post.slug}`,
    type: 'article',
  });
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) notFound();
  const author = getAuthor(post.frontmatter.author);
  return (
    <article>
      <header>
        <time dateTime={post.frontmatter.date}>{post.frontmatter.date}</time>
        <h1>{post.frontmatter.title}</h1>
        <AuthorByline author={author} />
      </header>
      <MdxRenderer source={post.content} library="agent" section="" />
      {/* tag chips + share + related-posts strip below */}
    </article>
  );
}
```

`<MdxRenderer>` already exists; it accepts `library` and `section` for in-doc anchor patterns. The blog passes nominal values — these don't matter for MDX rendering but satisfy the existing prop contract. (Implementer may extract a smaller `<BlogMdxRenderer>` if the docs prop contract becomes awkward, but reuse is preferred.)

### 5.5 `apps/website/src/components/blog/AuthorByline.tsx` (new)

```tsx
import type { Author } from '@/lib/blog-authors';
export function AuthorByline({ author }: { author: Author }) {
  return (
    <div className="blog-author">
      {author.avatar && <img src={author.avatar} alt={`${author.name} avatar`} width={32} height={32} />}
      <div>
        <span className="blog-author__name">{author.name}</span>
        {author.role && <span className="blog-author__role"> · {author.role}</span>}
      </div>
    </div>
  );
}
```

### 5.6 `apps/website/src/components/blog/{PostCard,FeaturedPostCard,TagChips}.tsx` (new)

Three small presentational components — implementer composes from existing `@/components/ui/{Card, Pill, Eyebrow}`. PostCard shows: title, description, date, tags, author. FeaturedPostCard is a larger variant. TagChips renders `<Pill>` rows from a string array; click is a no-op in v1 (per-tag pages are a follow-up).

### 5.7 `apps/website/src/app/blog/[slug]/opengraph-image.tsx` (new)

```tsx
import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';
import { getAuthor } from '@/lib/blog-authors';

export const runtime = 'nodejs';
export const alt = 'Cacheplane blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function og({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) {
    return new ImageResponse(<div /* default fallback */>Cacheplane</div>, size);
  }
  const author = getAuthor(post.frontmatter.author);
  return new ImageResponse(
    (
      <div /* JSX layout: post title big + author small bottom */>
        <h1>{post.frontmatter.title}</h1>
        <div>{author.name} · {post.frontmatter.date}</div>
      </div>
    ),
    { ...size, fonts: [/* reuse the Garamond font loaded in the site-default OG route */] },
  );
}
```

### 5.8 `apps/website/src/app/blog/rss.xml/route.ts` (new)

```typescript
import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/blog';
import { SITE_ORIGIN } from '@/lib/site-metadata';

export async function GET() {
  const posts = getAllPosts();
  const items = posts.map((p) => `
    <item>
      <title><![CDATA[${p.frontmatter.title}]]></title>
      <link>${SITE_ORIGIN}/blog/${p.slug}</link>
      <guid>${SITE_ORIGIN}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.frontmatter.date).toUTCString()}</pubDate>
      <description><![CDATA[${p.frontmatter.description}]]></description>
    </item>
  `).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Cacheplane Blog</title>
    <link>${SITE_ORIGIN}/blog</link>
    <description>Writing on agent UI for Angular.</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
```

### 5.9 `apps/website/src/lib/site-metadata.ts` (modified)

Extend `getSitemapRoutes()`:

```typescript
import { getAllPosts } from './blog';

export function getSitemapRoutes(): string[] {
  const staticRoutes = ['/', '/angular', '/render', '/chat', '/pricing', '/solutions', '/pilot-to-prod', '/docs', '/blog'];
  const solutionRoutes = getAllSolutionSlugs().map((slug) => `/solutions/${slug}`);
  const docsRoutes = docsConfig.flatMap(/* unchanged */);
  const blogRoutes = getAllPosts().map((p) => `/blog/${p.slug}`);
  return [...staticRoutes, ...solutionRoutes, ...docsRoutes, ...blogRoutes];
}
```

### 5.10 `apps/website/src/lib/analytics/events.ts` (modified)

Add to `analyticsEvents`:

```typescript
blogCtaClick: 'blog:cta_click',
blogCopyCodeClick: 'blog:copy_code_click',
```

Add `'blog'` to `AnalyticsSurface` union. The existing `cta_id` and `code_lang` properties already have homes in `AnalyticsProperties`.

### 5.11 `docs/gtm/taxonomy.md` (modified)

Add two rows under "Marketing (website)" (or in a new "Blog (website)" subsection — implementer's call which reads cleaner):

| Event                       | When                                           |
|-----------------------------|------------------------------------------------|
| `blog:cta_click`            | A tracked CTA inside a blog post body          |
| `blog:copy_code_click`      | Copy-button click on a code block in a post    |

Append to the version log:

```
| 2026-05-17 | Add blog:cta_click + blog:copy_code_click events (Spec 5). |
```

### 5.12 `apps/website/src/components/shared/Nav.tsx` (or wherever) (modified)

Insert a `Blog` link in the appropriate spot in the existing nav. Existing CTA tracking on nav links (per Spec 2) flows through `cta_id` — add `nav_blog` to the `CtaId` template-literal union if the implementer needs it (it's already covered by the existing `nav_${string}` pattern).

## 6. Seed post — voice, structure, content

### Voice (study these before drafting)

The seed post matches Brian Love's existing blog voice. Read these three posts FIRST and match the patterns:

- `~/repos/brianflove/src/content/posts/2026-02-21-the-frontend-reward-loop-for-agentic-software.md`
- `~/repos/brianflove/src/content/posts/2026-03-18-agentic-memory-and-what-it-means-for-web-apps.md`
- `~/repos/brianflove/src/content/posts/2026-02-20-the-landscape-of-generative-ui-in-2026.md`

Observed patterns to replicate:

- **Open with a blunt thesis.** No "introduction" header. Just the claim, stated in 1-2 lines.
- **One thought per line.** Frequent paragraph breaks. Paragraphs of 1-3 short sentences.
- **`## tl;dr` section early.** Bullet list, 4-6 items, each 1 line.
- **Numbered frameworks.** "1. X / 2. Y / 3. Z" — short, declarative, often with subheads under each number.
- **Contrast moves.** "Not because X. And not because Y. It matters because Z."
- **Pragmatic second person.** "If you are building...", "Most teams...", "If I were starting today...".
- **Heuristic + buckets.** When introducing a framework, name 3-5 buckets and unpack each.
- **No marketing voice.** No "industry-leading", no "powerful", no superlatives. Direct claims about what works.
- **Hyphens are em-dashes.** Brian uses `—` and `:` heavily for structural breaks.
- **No emoji.** No 🚀.

### Structure of the seed post (~2,500 words)

**Title:** `Build a streaming chat UI in Angular with LangGraph`
**Description:** `Step-by-step tutorial for shipping a production streaming chat in Angular — signal-native, design-system-friendly, and wired to a LangGraph backend.`
**Tags:** `[tutorial, streaming, langgraph, angular]`
**Date:** `2026-05-17`
**Author:** `brian`
**Featured:** `true`

Sections:

1. **Opening thesis** (~150 words). Why streaming is the production-vs-demo line for chat UIs. State the claim: in Angular, Signals make streaming feel native if you wire it right.
2. **tl;dr** (~80 words, bullets).
   - Streaming chat is a signal problem, not a streaming problem.
   - `@ngaf/chat` gives you the composition. `@ngaf/langgraph` gives you the wire.
   - The agent contract is a small, signal-shaped interface.
   - Production patterns: errors, retries, threads, interrupts, fallbacks.
   - One install. Standalone components. No React rewrite.
3. **Why streaming is the production-vs-demo line** (~200 words). Latency perception, abandonment, the value of seeing partial responses.
4. **Architecture in three boxes** (~250 words). LangGraph backend → `@ngaf/langgraph` adapter → `@ngaf/chat` UI. Each box has one job. Use `ArchFlowDiagram` MDX component.
5. **Scaffold** (~300 words). `npm install @ngaf/chat @ngaf/langgraph`. `app.config.ts` with `provideAgent({ apiUrl })`. Component-level `agent()` factory. Code blocks in `typescript`.
6. **Render the chat** (~300 words). `<chat [agent]="agent">`. Welcome state. Suggestions. Code block + screenshot reference.
7. **What's happening under the hood** (~300 words). The agent contract. `events$`. State signals. Why this maps cleanly to Angular templates.
8. **Production patterns** (~400 words). Three buckets: errors + retries, threads + persistence, generative UI fallbacks. Light on detail per bucket — link out to docs for depth.
9. **Where to go from here** (~150 words). Links: cockpit streaming recipe, persistence post (when it ships), interrupts post, comparison pages (when they ship). End with `<Callout type="info">` directing enterprise readers to `/contact` for engineering support.
10. **Closing line.** One sentence. No "TL;DR repeat", no marketing close.

### Required MDX components in the seed post

- `<Callout type="info">` for the enterprise-track CTA at the end.
- `<Steps>` for the scaffold section (so each step gets a numbered indicator).
- `<Tabs>` if multiple package managers are shown (npm/pnpm/yarn) — optional.
- `<ArchFlowDiagram>` for the architecture diagram (if it accepts a custom set of nodes; otherwise use a mermaid block or skip in v1).
- Inline `<a href="/contact?source=blog_streaming_pillar&track=enterprise">` for tracked CTAs.

## 7. Data flow

For a developer landing on `cacheplane.ai/blog/build-a-streaming-chat-ui-in-angular-with-langgraph`:

1. `BlogPostPage` resolves the slug via `getPostBySlug()`.
2. `MdxRenderer` renders the MDX body with code-highlighted blocks and our docs MDX components.
3. The route's `opengraph-image.tsx` generates a 1200×630 PNG with the post title.
4. `$pageview` fires with `source_page: '/blog/<slug>'`.
5. If the reader clicks a tracked CTA (e.g., `/pricing` link in the production-patterns section), `blog:cta_click` fires with `surface: 'blog'`, `destination_url`, and optional `cta_id`.
6. If they hit copy on a code block, `blog:copy_code_click` fires with `surface: 'blog'` and `code_lang`.

For the RSS subscriber:

1. RSS reader fetches `/blog/rss.xml`.
2. Server reads all posts, emits RSS 2.0.
3. Reader displays the latest entries.

## 8. Error handling

- **Missing required frontmatter** in any blog post → `getAllPosts()` throws with a clear filename + missing-field message. The throw fails the build, which is what we want (forces fix at PR time).
- **Slug collision** (same slug across two different filenames) → undefined behavior (last-write wins). Acceptable for v1; revisit if it ever bites.
- **Bad date** in frontmatter → date used as-is for sort + display. `new Date(badDate).toUTCString()` becomes "Invalid Date" in RSS. Catch in implementation via a small validation step in `readPost`.
- **Per-post OG image generation failure** → the route falls back to the default site OG card. The post page itself still renders.

## 9. Testing

- **`apps/website/src/lib/blog.spec.ts`:**
  - `getAllPosts()` returns sorted desc by date.
  - `getPostBySlug()` returns a known seed.
  - Frontmatter parsing populates required fields.
  - Missing required field throws.
  - Draft posts excluded by default; included when `includeDrafts: true`.
- **`apps/website/src/components/blog/PostCard.spec.tsx`:**
  - Renders title, date, tag chips.
- **Per-route smoke** (manual, post-merge): visit `/blog`, `/blog/[seed-slug]`, `/blog/rss.xml`, check OG card via `view-source` and a Twitter/OpenGraph debugger.
- **Pre-existing `apps/website` vitest tests + build** remain green.

## 10. Risks

- **Reading MDX in a server route every request** is wasteful in dev. Next.js's static-param caching covers prod; for dev, it's a few-ms per request. Acceptable.
- **`<MdxRenderer>` doc-prop contract** (`library`, `section`) may feel awkward when reused for blog posts. If awkward in practice, extract a smaller `<BlogMdxRenderer>` that wraps the same `MDXRemote` + components but drops the doc-only props. Implementer decides.
- **Seed-post content quality** is the highest variance item. The plan instructs the implementer to study Brian's voice samples first. If the draft falls short, you (Brian) review and revise post-merge.
- **OG image route reading `[slug]` params:** Next.js's docs claim per-route `opengraph-image.tsx` can access `params`. If it can't (test in implementation), the fallback is a `/blog/og/[slug]/route.tsx` dynamic OG endpoint, with `<head>` updated to reference it. Implementer chooses the working path.
- **Per-tag pages absent in v1.** Tag chips on the index don't navigate anywhere; they may confuse users. Mitigated by either (a) making them visual-only (no click), or (b) shipping a tiny `/blog/tags/[tag]` page in the same spec. Implementer should pick (a) for v1 scope and the user can revisit in a follow-up.

## 11. Phases

1. **Phase 0 — `blog.ts` + `blog-authors.ts` + spec (TDD).** Post parser, author registry. ~2 commits.
2. **Phase 1 — Analytics events + taxonomy + Nav.** Add `blog:*` events to `events.ts`, `taxonomy.md`, and a `Blog` link in the navbar. ~1 commit.
3. **Phase 2 — Blog index page + `PostCard` + `FeaturedPostCard` + `TagChips`.** ~2 commits.
4. **Phase 3 — Dynamic `[slug]` route + `AuthorByline`.** Reuses `<MdxRenderer>`. ~2 commits.
5. **Phase 4 — Per-post OG image route.** ~1 commit.
6. **Phase 5 — RSS feed.** ~1 commit.
7. **Phase 6 — Sitemap integration.** ~1 commit.
8. **Phase 7 — Seed pillar post MDX.** ~1 commit (likely the largest commit in the spec — the post body itself).
9. **Phase 8 — Verification + Chrome MCP smoke.** No commit.

Total: ~11-12 commits.

## 12. Deliverables

- ☐ `apps/website/src/lib/blog.ts` + spec
- ☐ `apps/website/src/lib/blog-authors.ts`
- ☐ `apps/website/src/app/blog/page.tsx`
- ☐ `apps/website/src/app/blog/[slug]/page.tsx`
- ☐ `apps/website/src/app/blog/[slug]/opengraph-image.tsx`
- ☐ `apps/website/src/app/blog/rss.xml/route.ts`
- ☐ `apps/website/src/components/blog/{PostCard,FeaturedPostCard,TagChips,AuthorByline}.tsx`
- ☐ `apps/website/src/components/blog/PostCard.spec.tsx`
- ☐ `apps/website/src/lib/site-metadata.ts` updated
- ☐ `apps/website/src/lib/analytics/events.ts` adds `blog:cta_click` + `blog:copy_code_click` + `'blog'` surface
- ☐ `docs/gtm/taxonomy.md` adds the two events + changelog row
- ☐ `apps/website/src/components/shared/Nav.tsx` (or wherever) adds `Blog` link
- ☐ `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx` — seed post written in Brian's voice
- ☐ `nx run website:build` green
- ☐ `cd apps/website && npx vitest run src/lib/blog.spec.ts src/components/blog` green
- ☐ Manual smoke: `/blog`, `/blog/[seed-slug]`, `/blog/rss.xml`, OG card preview
