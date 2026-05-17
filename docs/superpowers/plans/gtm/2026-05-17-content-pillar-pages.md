# Content Pillar Pages (Blog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-grade `/blog` on cacheplane.ai (flat MDX, RSS, OG, sitemap, `blog:*` analytics) plus one seed pillar post written in Brian Love's voice — "Build a streaming chat UI in Angular with LangGraph."

**Architecture:** Date-prefixed MDX files in `apps/website/content/blog/` parsed at request/build time by `lib/blog.ts` (gray-matter). Index + dynamic slug routes reuse the existing `<MdxRenderer>`. Per-post OG via `next/og` ImageResponse. RSS 2.0 XML route. Sitemap auto-includes published posts. New `blog:*` analytics namespace.

**Tech Stack:** Next.js 16 App Router, `next-mdx-remote/rsc@6`, `gray-matter@4` (new), `rehype-pretty-code` (tokyo-night), `rehype-slug`, `remark-gfm`, Vitest + jsdom for unit tests, PostHog client wrapper.

**Spec reference:** `docs/superpowers/specs/gtm/2026-05-17-content-pillar-pages-design.md`. Branch: `gtm-spec-5-content-pillar-blog` (already created in worktree).

---

## File Structure

**New:**

- `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx` — seed post (Phase 7).
- `apps/website/src/lib/blog.ts` — MDX parser + listing utilities.
- `apps/website/src/lib/blog.spec.ts` — unit tests for blog.ts.
- `apps/website/src/lib/blog-authors.ts` — author registry.
- `apps/website/src/app/blog/page.tsx` — index page (Server Component).
- `apps/website/src/app/blog/[slug]/page.tsx` — dynamic post route.
- `apps/website/src/app/blog/[slug]/opengraph-image.tsx` — per-post OG card.
- `apps/website/src/app/blog/rss.xml/route.ts` — RSS 2.0 endpoint.
- `apps/website/src/components/blog/PostCard.tsx`
- `apps/website/src/components/blog/PostCard.spec.tsx`
- `apps/website/src/components/blog/FeaturedPostCard.tsx`
- `apps/website/src/components/blog/TagChips.tsx`
- `apps/website/src/components/blog/AuthorByline.tsx`
- `apps/website/content/blog/.gitkeep` — only if Phase 7 isn't ordered before tests (Phase 7 will exist before tests are run in `nx build`, so the .gitkeep isn't required; created defensively in Phase 0 so dev work can run).

**Modified:**

- `apps/website/src/lib/site-metadata.ts` — add `/blog` static route + blog routes to `getSitemapRoutes()`.
- `apps/website/src/lib/analytics/events.ts` — add `blogCtaClick`, `blogCopyCodeClick`, add `'blog'` to `AnalyticsSurface`.
- `apps/website/src/components/shared/Nav.tsx` — add `Blog` link.
- `docs/gtm/taxonomy.md` — document new events + changelog row.
- `package.json` (root) — add `gray-matter@^4.0.3` to `dependencies`.

---

## Task 1: Add `gray-matter` dependency

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Add gray-matter to root package.json dependencies**

Edit root `package.json` to add `"gray-matter": "^4.0.3"` to the `dependencies` block (alphabetical with surrounding entries).

- [ ] **Step 2: Install without regenerating lockfile shape**

Run: `npm install gray-matter@^4.0.3 --save --package-lock-only`
Then: `npm install --no-audit --no-fund`
Expected: gray-matter present in `node_modules/gray-matter`; package-lock.json updated minimally. Do NOT regenerate the full lockfile (per project memory: never run a full `npm install` on macOS that touches `@next/swc-*` bindings).

- [ ] **Step 3: Verify import works**

Run: `node -e "console.log(require('gray-matter')('---\ntitle: t\n---\nbody').data)"`
Expected: `{ title: 't' }`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(website): add gray-matter for blog frontmatter parsing"
```

---

## Task 2: Create blog content directory + seed fixture file for tests

**Files:**

- Create: `apps/website/content/blog/.gitkeep`
- Create: `apps/website/content/blog/__fixtures__/2026-01-01-fixture-post.mdx` (test fixture; under `__fixtures__/` so the parser's date-regex filter ignores it via subdir filtering — see Task 3 implementation)

- [ ] **Step 1: Create the directory and .gitkeep**

```bash
mkdir -p apps/website/content/blog
touch apps/website/content/blog/.gitkeep
```

- [ ] **Step 2: Skip creating __fixtures__ here** — the unit tests in Task 3 will use `fs` mocking instead of on-disk fixtures, so we don't need a fixture file. Remove the __fixtures__ line above conceptually; only `.gitkeep` is created.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/blog/.gitkeep
git commit -m "feat(website): scaffold blog content directory"
```

---

## Task 3: `lib/blog.ts` — frontmatter parser + listing utilities (TDD)

**Files:**

- Create: `apps/website/src/lib/blog.ts`
- Create: `apps/website/src/lib/blog.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/website/src/lib/blog.spec.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');
const mockedFs = vi.mocked(fs);

const post1 = `---
title: "First Post"
description: "First description"
date: 2026-05-01
author: brian
tags: [tutorial, streaming]
---
Body one.`;

const post2 = `---
title: "Second Post"
description: "Second description"
date: 2026-05-10
author: brian
featured: true
---
Body two.`;

const draft = `---
title: "Draft Post"
description: "Draft description"
date: 2026-05-20
author: brian
draft: true
---
Body draft.`;

const missingFields = `---
title: "Missing"
date: 2026-05-15
---
Body missing.`;

function setupFs(files: Record<string, string>) {
  mockedFs.existsSync.mockImplementation((p) => {
    const str = String(p);
    return str.endsWith('/content/blog') || str in files;
  });
  mockedFs.readdirSync.mockReturnValue(Object.keys(files).map((k) => k.split('/').pop()!) as never);
  mockedFs.readFileSync.mockImplementation((p) => {
    const name = String(p).split('/').pop()!;
    const match = Object.entries(files).find(([k]) => k.endsWith(name));
    if (!match) throw new Error(`no fixture for ${p}`);
    return match[1];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('blog.ts', () => {
  it('getAllPosts returns posts sorted desc by date', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-10-second-post.mdx': post2,
    });
    const { getAllPosts } = await import('./blog');
    const posts = getAllPosts();
    expect(posts.map((p) => p.slug)).toEqual(['second-post', 'first-post']);
  });

  it('getPostBySlug returns a known post', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-10-second-post.mdx': post2,
    });
    const { getPostBySlug } = await import('./blog');
    const post = getPostBySlug('second-post');
    expect(post?.frontmatter.title).toBe('Second Post');
    expect(post?.date).toBe('2026-05-10');
  });

  it('getPostBySlug returns null for unknown slug', async () => {
    setupFs({ '2026-05-01-first-post.mdx': post1 });
    const { getPostBySlug } = await import('./blog');
    expect(getPostBySlug('nope')).toBeNull();
  });

  it('throws when required frontmatter is missing', async () => {
    setupFs({ '2026-05-15-missing.mdx': missingFields });
    const { getAllPosts } = await import('./blog');
    expect(() => getAllPosts()).toThrow(/missing required frontmatter/i);
  });

  it('drafts excluded by default, included with includeDrafts', async () => {
    setupFs({
      '2026-05-10-second-post.mdx': post2,
      '2026-05-20-draft-post.mdx': draft,
    });
    const { getAllPosts } = await import('./blog');
    expect(getAllPosts().map((p) => p.slug)).toEqual(['second-post']);
    expect(getAllPosts({ includeDrafts: true }).map((p) => p.slug)).toEqual([
      'draft-post',
      'second-post',
    ]);
  });

  it('getFeaturedPost returns the first featured post', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-10-second-post.mdx': post2,
    });
    const { getFeaturedPost } = await import('./blog');
    expect(getFeaturedPost()?.slug).toBe('second-post');
  });

  it('getFeaturedPost falls back to latest when none featured', async () => {
    setupFs({ '2026-05-01-first-post.mdx': post1 });
    const { getFeaturedPost } = await import('./blog');
    expect(getFeaturedPost()?.slug).toBe('first-post');
  });

  it('getAllTags counts tags across posts', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      '2026-05-10-second-post.mdx': post2,
    });
    const { getAllTags } = await import('./blog');
    const tags = getAllTags();
    expect(tags.find((t) => t.tag === 'tutorial')?.count).toBe(1);
    expect(tags.find((t) => t.tag === 'streaming')?.count).toBe(1);
  });

  it('ignores files that do not match the date-prefix regex', async () => {
    setupFs({
      '2026-05-01-first-post.mdx': post1,
      'not-a-post.mdx': post1,
      'README.md': 'readme',
    });
    const { getAllPosts } = await import('./blog');
    expect(getAllPosts().map((p) => p.slug)).toEqual(['first-post']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/website && npx vitest run src/lib/blog.spec.ts`
Expected: FAIL with "Cannot find module './blog'" or similar.

- [ ] **Step 3: Implement `blog.ts`**

Create `apps/website/src/lib/blog.ts`:

```typescript
// SPDX-License-Identifier: MIT
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR_WORKSPACE = path.join(process.cwd(), 'apps', 'website', 'content', 'blog');
const BLOG_DIR_LOCAL = path.join(process.cwd(), 'content', 'blog');

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
  tags?: string[];
  author: string;
  featured?: boolean;
  draft?: boolean;
}

export interface Post {
  slug: string;
  date: string;
  frontmatter: PostFrontmatter;
  content: string;
  filename: string;
}

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.mdx$/;

function resolveBlogDir(): string {
  if (fs.existsSync(BLOG_DIR_WORKSPACE)) return BLOG_DIR_WORKSPACE;
  if (fs.existsSync(BLOG_DIR_LOCAL)) return BLOG_DIR_LOCAL;
  return BLOG_DIR_WORKSPACE;
}

function readPost(dir: string, filename: string): Post | null {
  const match = filename.match(FILENAME_RE);
  if (!match) return null;
  const [, date, slug] = match;
  const full = path.join(dir, filename);
  const raw = fs.readFileSync(full, 'utf8');
  const { data, content } = matter(typeof raw === 'string' ? raw : raw.toString());
  const fm = data as Partial<PostFrontmatter>;
  if (!fm.title || !fm.description || !fm.date || !fm.author) {
    throw new Error(
      `Blog post ${filename} missing required frontmatter (title, description, date, author).`,
    );
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
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => typeof f === 'string' && f.endsWith('.mdx'));
  const posts: Post[] = [];
  for (const f of files) {
    const post = readPost(dir, f as string);
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

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/website && npx vitest run src/lib/blog.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/blog.ts apps/website/src/lib/blog.spec.ts
git commit -m "feat(website): add blog frontmatter parser + listing utilities"
```

---

## Task 4: `lib/blog-authors.ts` — author registry

**Files:**

- Create: `apps/website/src/lib/blog-authors.ts`

- [ ] **Step 1: Create the file**

```typescript
// SPDX-License-Identifier: MIT
export interface Author {
  name: string;
  role?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  avatar?: string;
}

export const blogAuthors: Record<string, Author> = {
  brian: {
    name: 'Brian Love',
    role: 'Founder, Cacheplane',
    bio: 'Angular consultant and open-source maintainer. Building agent UI for Angular teams.',
    github: 'blove',
  },
};

export function getAuthor(key: string): Author {
  return blogAuthors[key] ?? { name: key };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/lib/blog-authors.ts
git commit -m "feat(website): add blog author registry"
```

---

## Task 5: Analytics events + AnalyticsSurface

**Files:**

- Modify: `apps/website/src/lib/analytics/events.ts`

- [ ] **Step 1: Add events**

Edit `apps/website/src/lib/analytics/events.ts`. Inside the `analyticsEvents` `const` object, after `docsSidebarSectionToggle: 'docs:sidebar_section_toggle',` add:

```typescript
  blogCtaClick: 'blog:cta_click',
  blogCopyCodeClick: 'blog:copy_code_click',
```

In the `AnalyticsSurface` union, add `'blog'` after `'docs'`:

```typescript
export type AnalyticsSurface =
  | 'nav'
  | 'mobile_nav'
  | 'footer'
  | 'home'
  | 'home_whitepaper'
  | 'pricing'
  | 'docs'
  | 'blog'
  | 'library_landing'
  | 'solution'
  | 'toast'
  | 'contact';
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/website && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors related to events.ts.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts
git commit -m "feat(website): add blog:* analytics events + blog surface"
```

---

## Task 6: Update `taxonomy.md`

**Files:**

- Modify: `docs/gtm/taxonomy.md`

- [ ] **Step 1: Locate the marketing/website events table and the changelog**

Run: `grep -n "docs:copy_code_click\|Version log\|## Version" docs/gtm/taxonomy.md | head -20`

- [ ] **Step 2: Append two rows under the website events table**

After the row for `docs:copy_code_click`, insert:

```
| `blog:cta_click`              | Tracked CTA inside a blog post body. Props: `surface: 'blog'`, `cta_id?`, `destination_url?`.   |
| `blog:copy_code_click`        | Copy-button click on a code block inside a blog post. Props: `surface: 'blog'`, `code_lang?`.    |
```

(If the table column widths differ in the existing doc, match those — the implementer keeps consistent column alignment.)

- [ ] **Step 3: Append a changelog row**

Append to the bottom of the version log table:

```
| 2026-05-17 | Add `blog:cta_click` + `blog:copy_code_click` events; add `'blog'` to `AnalyticsSurface` (Spec 5). |
```

- [ ] **Step 4: Commit**

```bash
git add docs/gtm/taxonomy.md
git commit -m "docs(gtm): document blog:* events in taxonomy"
```

---

## Task 7: `AuthorByline` component

**Files:**

- Create: `apps/website/src/components/blog/AuthorByline.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { Author } from '../../lib/blog-authors';

export function AuthorByline({ author }: { author: Author }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        opacity: 0.8,
      }}
    >
      {author.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.avatar}
          alt={`${author.name} avatar`}
          width={32}
          height={32}
          style={{ borderRadius: '50%' }}
        />
      ) : null}
      <div>
        <span style={{ fontWeight: 600 }}>{author.name}</span>
        {author.role ? (
          <span style={{ opacity: 0.7 }}> · {author.role}</span>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/blog/AuthorByline.tsx
git commit -m "feat(website): add AuthorByline component"
```

---

## Task 8: `PostCard` component (TDD)

**Files:**

- Create: `apps/website/src/components/blog/PostCard.tsx`
- Create: `apps/website/src/components/blog/PostCard.spec.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostCard } from './PostCard';
import type { Post } from '../../lib/blog';

const post: Post = {
  slug: 'streaming-chat',
  date: '2026-05-17',
  filename: '2026-05-17-streaming-chat.mdx',
  content: '',
  frontmatter: {
    title: 'Build a streaming chat UI',
    description: 'A tutorial.',
    date: '2026-05-17',
    author: 'brian',
    tags: ['tutorial', 'streaming'],
  },
};

describe('PostCard', () => {
  it('renders title, date, and tag chips', () => {
    render(<PostCard post={post} />);
    expect(screen.getByText('Build a streaming chat UI')).toBeTruthy();
    expect(screen.getByText('2026-05-17')).toBeTruthy();
    expect(screen.getByText('tutorial')).toBeTruthy();
    expect(screen.getByText('streaming')).toBeTruthy();
  });

  it('links to /blog/[slug]', () => {
    const { container } = render(<PostCard post={post} />);
    const link = container.querySelector('a[href="/blog/streaming-chat"]');
    expect(link).toBeTruthy();
  });
});
```

- [ ] **Step 2: Check `@testing-library/react` availability**

Run: `node -e "require.resolve('@testing-library/react')"` from project root.
If it errors: install with `npm install @testing-library/react@^16 --save-dev --package-lock-only && npm install --no-audit --no-fund`. Otherwise skip.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/website && npx vitest run src/components/blog/PostCard.spec.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `PostCard.tsx`**

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import type { Post } from '../../lib/blog';

export function PostCard({ post }: { post: Post }) {
  const { slug, frontmatter } = post;
  return (
    <Link
      href={`/blog/${slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 20,
        borderRadius: 12,
        background: tokens.colors.surfaceMuted,
        border: `1px solid ${tokens.colors.border}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
      }}
    >
      <time
        dateTime={frontmatter.date}
        style={{ fontSize: 13, color: tokens.colors.textMuted }}
      >
        {frontmatter.date}
      </time>
      <h3 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
        {frontmatter.title}
      </h3>
      <p style={{ fontSize: 14, color: tokens.colors.textSecondary, margin: 0 }}>
        {frontmatter.description}
      </p>
      {frontmatter.tags && frontmatter.tags.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/website && npx vitest run src/components/blog/PostCard.spec.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/blog/PostCard.tsx apps/website/src/components/blog/PostCard.spec.tsx
git commit -m "feat(website): add PostCard component with tests"
```

---

## Task 9: `FeaturedPostCard` + `TagChips` components

**Files:**

- Create: `apps/website/src/components/blog/FeaturedPostCard.tsx`
- Create: `apps/website/src/components/blog/TagChips.tsx`

- [ ] **Step 1: Create FeaturedPostCard**

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import type { Post } from '../../lib/blog';
import { getAuthor } from '../../lib/blog-authors';
import { AuthorByline } from './AuthorByline';

export function FeaturedPostCard({ post }: { post: Post }) {
  const { slug, frontmatter } = post;
  const author = getAuthor(frontmatter.author);
  return (
    <Link
      href={`/blog/${slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 32,
        borderRadius: 16,
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.accent}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
        marginBottom: 32,
      }}
    >
      <span
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: tokens.colors.accent,
        }}
      >
        Featured
      </span>
      <h2 style={{ fontSize: 32, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
        {frontmatter.title}
      </h2>
      <p style={{ fontSize: 16, color: tokens.colors.textSecondary, margin: 0 }}>
        {frontmatter.description}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        <AuthorByline author={author} />
        <time
          dateTime={frontmatter.date}
          style={{ fontSize: 13, color: tokens.colors.textMuted }}
        >
          {frontmatter.date}
        </time>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create TagChips**

```tsx
import { tokens } from '@ngaf/design-tokens';

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontSize: 13,
            padding: '4px 10px',
            borderRadius: 999,
            background: tokens.colors.accentSurface,
            color: tokens.colors.accent,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blog/FeaturedPostCard.tsx apps/website/src/components/blog/TagChips.tsx
git commit -m "feat(website): add FeaturedPostCard + TagChips components"
```

---

## Task 10: Add `Blog` to Nav

**Files:**

- Modify: `apps/website/src/components/shared/Nav.tsx`

- [ ] **Step 1: Add Blog link to the `links` array**

Edit the `links` array near the top of `Nav.tsx`. Insert `{ label: 'Blog', href: '/blog', external: false },` between the `Pricing` entry and the closing `];`. Final array:

```typescript
const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Solutions', href: '/solutions', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Demo', href: 'https://demo.cacheplane.ai', external: true },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
  { label: 'Blog', href: '/blog', external: false },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "feat(website): add Blog link to nav"
```

---

## Task 11: `/blog` index route

**Files:**

- Create: `apps/website/src/app/blog/page.tsx`

- [ ] **Step 1: Create the index page**

```tsx
import { createPageMetadata } from '../../lib/site-metadata';
import { getAllPosts, getFeaturedPost, getAllTags } from '../../lib/blog';
import { FeaturedPostCard } from '../../components/blog/FeaturedPostCard';
import { PostCard } from '../../components/blog/PostCard';
import { TagChips } from '../../components/blog/TagChips';

export const metadata = createPageMetadata({
  title: 'Blog — Cacheplane',
  description:
    'Long-form writing on agent UI for Angular: streaming, generative UI, threads, interrupts, production patterns.',
  pathname: '/blog',
  type: 'website',
});

export default function BlogIndexPage() {
  const all = getAllPosts();
  const featured = getFeaturedPost();
  const rest = featured ? all.filter((p) => p.slug !== featured.slug) : all;
  const tags = getAllTags().map((t) => t.tag);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px' }}>
      <p
        style={{
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 8,
          opacity: 0.7,
        }}
      >
        Blog
      </p>
      <h1
        style={{
          fontSize: 48,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          marginBottom: 12,
        }}
      >
        Notes from Cacheplane
      </h1>
      <p style={{ fontSize: 18, opacity: 0.8, marginBottom: 32, maxWidth: '60ch' }}>
        Writing on agent UI for Angular — production patterns, design choices,
        and what we&apos;re shipping.
      </p>
      <TagChips tags={tags} />
      {featured ? <FeaturedPostCard post={featured} /> : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {rest.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the route builds**

Run: `cd apps/website && npx next build` (will run after Task 14 and 15 also exist; if this step is run in isolation and the route compiles, ✅).
Or run a faster typecheck: `cd apps/website && npx tsc --noEmit -p tsconfig.json`
Expected: no errors related to `app/blog/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/blog/page.tsx
git commit -m "feat(website): add /blog index page"
```

---

## Task 12: `/blog/[slug]` route

**Files:**

- Create: `apps/website/src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Create the dynamic post page**

`<MdxRenderer>` from `apps/website/src/components/docs/MdxRenderer.tsx` requires props `{ source, library, section, slug, title }`. We pass nominal values for `library` and `section` and the post's own `slug`/`title`.

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { AuthorByline } from '../../../components/blog/AuthorByline';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';
import { createPageMetadata } from '../../../lib/site-metadata';

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post || post.frontmatter.draft) {
    return { title: 'Post not found — Cacheplane' };
  }
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
    <article style={{ maxWidth: 768, margin: '0 auto', padding: '64px 24px' }}>
      <header style={{ marginBottom: 32 }}>
        <time
          dateTime={post.frontmatter.date}
          style={{ fontSize: 14, opacity: 0.7 }}
        >
          {post.frontmatter.date}
        </time>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '12px 0 16px',
            lineHeight: 1.15,
          }}
        >
          {post.frontmatter.title}
        </h1>
        <AuthorByline author={author} />
      </header>
      <MdxRenderer
        source={post.content}
        library="agent"
        section="blog"
        slug={post.slug}
        title={post.frontmatter.title}
      />
    </article>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/website && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/blog/[slug]/page.tsx
git commit -m "feat(website): add /blog/[slug] dynamic post route"
```

---

## Task 13: Per-post OG image route

**Files:**

- Create: `apps/website/src/app/blog/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Inspect the existing default OG route for the font-loading pattern**

Run: `cat apps/website/src/app/opengraph-image.tsx | head -80`
The blog OG route reuses the same font (EBGaramond) loading pattern. If the existing route imports the font from `apps/website/src/app/EBGaramond-Bold.ttf` (verified to exist), mirror that import.

- [ ] **Step 2: Create the per-post OG route**

```tsx
import { ImageResponse } from 'next/og';
import { getPostBySlug } from '../../../lib/blog';
import { getAuthor } from '../../../lib/blog-authors';

export const runtime = 'nodejs';
export const alt = 'Cacheplane blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function og({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post || post.frontmatter.draft) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0b0d12',
            color: '#ffffff',
            fontSize: 64,
          }}
        >
          Cacheplane
        </div>
      ),
      size,
    );
  }

  const author = getAuthor(post.frontmatter.author);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: '#0b0d12',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            fontSize: 24,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            opacity: 0.6,
          }}
        >
          Cacheplane Blog
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: '90%',
          }}
        >
          {post.frontmatter.title}
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>
          {author.name} · {post.frontmatter.date}
        </div>
      </div>
    ),
    size,
  );
}
```

(If the per-route `params` API turns out unsupported in the project's Next 16 version — fallback per spec §10: convert to a dynamic route under `apps/website/src/app/blog/og/[slug]/route.tsx` returning `new ImageResponse(...)`, and update `generateMetadata` in Task 12 to set `openGraph.images: [\`/blog/og/${slug}\`]`. Implementer chooses the working path during local verification.)

- [ ] **Step 3: Verify build**

Run: `cd apps/website && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/blog/[slug]/opengraph-image.tsx
git commit -m "feat(website): add per-post OG image route"
```

---

## Task 14: RSS feed

**Files:**

- Create: `apps/website/src/app/blog/rss.xml/route.ts`

- [ ] **Step 1: Create the RSS route**

```typescript
import { NextResponse } from 'next/server';
import { getAllPosts } from '../../../lib/blog';
import { SITE_ORIGIN } from '../../../lib/site-metadata';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function GET() {
  const posts = getAllPosts();
  const items = posts
    .map((p) => {
      const url = `${SITE_ORIGIN}/blog/${p.slug}`;
      const pubDate = (() => {
        const d = new Date(p.frontmatter.date);
        return Number.isNaN(d.getTime()) ? '' : d.toUTCString();
      })();
      return `    <item>
      <title><![CDATA[${p.frontmatter.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${p.frontmatter.description}]]></description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml('Cacheplane Blog')}</title>
    <link>${SITE_ORIGIN}/blog</link>
    <atom:link href="${SITE_ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml('Writing on agent UI for Angular.')}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/website && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/blog/rss.xml/route.ts
git commit -m "feat(website): add /blog/rss.xml RSS 2.0 feed"
```

---

## Task 15: Sitemap integration

**Files:**

- Modify: `apps/website/src/lib/site-metadata.ts`

- [ ] **Step 1: Extend `getSitemapRoutes()` to include blog routes**

Edit `getSitemapRoutes()`. Replace the existing function body so it imports + appends blog routes:

```typescript
import { getAllPosts } from './blog';

export function getSitemapRoutes(): string[] {
  const staticRoutes = ['/', '/angular', '/render', '/chat', '/pricing', '/solutions', '/pilot-to-prod', '/docs', '/blog'];
  const solutionRoutes = getAllSolutionSlugs().map((slug) => `/solutions/${slug}`);
  const docsRoutes = docsConfig.flatMap((library) =>
    library.sections.flatMap((section) =>
      section.pages.map((page) => `/docs/${library.id}/${page.section}/${page.slug}`),
    ),
  );
  const blogRoutes = getAllPosts().map((p) => `/blog/${p.slug}`);

  return [...staticRoutes, ...solutionRoutes, ...docsRoutes, ...blogRoutes];
}
```

(Place the `import { getAllPosts } from './blog';` at the top of the file with other imports.)

- [ ] **Step 2: Verify typecheck + existing tests still pass**

Run: `cd apps/website && npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib`
Expected: no type errors; existing `docs.spec.ts` continues to pass.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/site-metadata.ts
git commit -m "feat(website): include /blog routes in sitemap"
```

---

## Task 16: Seed pillar post MDX (Brian's voice)

**Files:**

- Create: `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx`

- [ ] **Step 1: Study Brian's voice (REQUIRED before drafting)**

Read in full:

- `~/repos/brianflove/src/content/posts/2026-02-21-the-frontend-reward-loop-for-agentic-software.md`
- `~/repos/brianflove/src/content/posts/2026-03-18-agentic-memory-and-what-it-means-for-web-apps.md`
- `~/repos/brianflove/src/content/posts/2026-02-20-the-landscape-of-generative-ui-in-2026.md`

Voice rules to replicate:

1. Open with a blunt thesis. No "Introduction" header.
2. One thought per line. 1-3 sentences per paragraph.
3. `## tl;dr` early, bullet list of 4-6 lines.
4. Numbered frameworks with short subheads.
5. Contrast moves: "Not because X. And not because Y. It matters because Z."
6. Pragmatic second person: "If you are building...", "Most teams...".
7. Em-dashes (`—`) heavy. No emoji. No superlatives.

- [ ] **Step 2: Draft the post**

Create the file with this exact frontmatter (then add ~2,500-word body matching the structure in Section 6 of the spec):

```mdx
---
title: "Build a Streaming Chat UI in Angular with LangGraph"
description: "Step-by-step tutorial for shipping a production streaming chat in Angular — signal-native, design-system-friendly, and wired to a LangGraph backend."
date: 2026-05-17
tags: [tutorial, streaming, langgraph, angular]
author: brian
featured: true
---

Streaming is the line between a chat demo and a chat product.

A chat that returns a full reply after three seconds feels broken.
A chat that streams the first token in 200ms feels alive.

That single change in latency perception is the difference between a UI users tolerate and a UI they trust.

In Angular, streaming chat used to mean wiring `RxJS` to fetch, parsing SSE by hand, and hoping zone.js cooperated.

That is no longer the shape of the problem.

With Signals and a properly designed agent contract, streaming chat is a small composition exercise. The hard part stopped being the wire. The hard part is the product around it — error recovery, threads, interrupts, generative UI.

This post walks through shipping a streaming chat UI in Angular against a LangGraph backend, end to end, with `@ngaf/chat` and `@ngaf/langgraph`.

## tl;dr

- Streaming chat is a signal problem, not a streaming problem.
- `@ngaf/chat` gives you the composition. `@ngaf/langgraph` gives you the wire.
- The agent contract is a small, signal-shaped interface.
- Production patterns matter more than the streaming itself: errors, retries, threads, interrupts, fallbacks.
- One install. Standalone components. No React rewrite.

## Why streaming is the production-vs-demo line

Most chat demos work fine when you measure them by output quality.

They fail when you measure them by feel.

A non-streaming chat hides three things from the user:

1. Whether the system is alive.
2. Whether the model is on the right track.
3. Whether the user should wait or cancel.

Streaming exposes all three.

That is why every production chat in 2026 streams. Not because the tokens arrive faster — they do not — but because the user gets to make a decision earlier.

## Architecture in three boxes

You only need to keep three boxes in your head.

<ArchFlowDiagram
  nodes={[
    { id: 'lg', label: 'LangGraph backend' },
    { id: 'adapter', label: '@ngaf/langgraph adapter' },
    { id: 'ui', label: '@ngaf/chat UI' },
  ]}
  edges={[
    { from: 'lg', to: 'adapter', label: 'AG-UI events' },
    { from: 'adapter', to: 'ui', label: 'signals' },
  ]}
/>

Each box has one job.

1. **LangGraph backend.** Runs the graph. Emits AG-UI events.
2. **`@ngaf/langgraph` adapter.** Translates events into signals.
3. **`@ngaf/chat` UI.** Renders the conversation.

You replace any of the three without touching the others.

## Scaffold

If you have an existing Angular 18+ app, the install is one command.

<Steps>
<Step title="Install the packages">

```bash
npm install @ngaf/chat @ngaf/langgraph
```

</Step>
<Step title="Provide the agent at app config">

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@ngaf/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'https://your-backend.example.com' }),
  ],
};
```

</Step>
<Step title="Create the agent factory in a component">

```typescript
import { Component, inject } from '@angular/core';
import { agent } from '@ngaf/langgraph';
import { ChatComponent } from '@ngaf/chat';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class AppChatComponent {
  agent = agent({ assistantId: 'streaming-assistant' });
}
```

</Step>
</Steps>

That is the whole scaffold.

## Render the chat

The `<chat>` component handles three states out of the box.

1. **Welcome state.** No messages yet. Optional suggestion chips.
2. **Streaming state.** Tokens arrive, animate, and append to the latest message.
3. **Idle state.** Final reply is in. Input is enabled.

You do not have to think about any of that. You just hand `<chat>` the agent.

If you want suggestions:

```html
<chat
  [agent]="agent"
  [suggestions]="['Show me the architecture', 'How do interrupts work?']"
/>
```

If you want to customize the welcome panel, slot it:

```html
<chat [agent]="agent">
  <welcome>
    <h2>Ask me anything about your codebase.</h2>
  </welcome>
</chat>
```

## What is happening under the hood

The agent contract is small.

```typescript
interface Agent {
  messages: Signal<Message[]>;
  status: Signal<'idle' | 'streaming' | 'error'>;
  send(input: string): void;
  stop(): void;
}
```

`@ngaf/langgraph` produces an `Agent` whose `messages` signal updates with every streamed chunk. Angular's change detection reads the signal, re-renders the message bubble, and you get streaming for free.

There is no `RxJS` to debug.
There is no SSE parser to maintain.
There is no zone.js dance.

It is a signal you read in a template.

## Production patterns

Streaming is the easy part. The hard parts are the ones a tutorial usually skips. Here are the three that matter for production.

### 1. Errors and retries

If the connection drops mid-stream, the user should know — and have a one-click retry.

`<chat>` exposes an `(error)` output and the agent has a `retry()` method.

```html
<chat
  [agent]="agent"
  (error)="onError($event)"
/>
```

```typescript
onError(error: AgentError) {
  this.toast.show({
    message: 'Connection lost. Retry?',
    action: () => this.agent.retry(),
  });
}
```

### 2. Threads and persistence

A streaming chat without persistent threads is a toy.

`@ngaf/langgraph` integrates with LangGraph's thread API. You pass a `threadId` to the agent factory, and the conversation history loads on mount.

```typescript
agent = agent({ assistantId: 'streaming-assistant', threadId: 'thread-123' });
```

When the user starts a new conversation, you call `agent.newThread()` and the backend mints a fresh thread id.

### 3. Generative UI fallbacks

Not every reply is a string.

Some replies are forms, lists, structured outputs.

The chat composition handles structured outputs through `@ngaf/render` — give it a JSON schema and a payload, and it renders an Angular component. No iframes. No HTML strings. No XSS surface.

This is out of scope for this post. The next pillar will cover generative UI in depth.

## Where to go from here

The fastest way to feel the streaming pattern is the cockpit reference app.

- [Streaming recipe in the cockpit](https://cockpit.cacheplane.ai/recipes/streaming) — runnable example with the exact wiring above.
- [Persistence + threads](/docs/chat/recipes/persistence) — when you outgrow a single conversation.
- [Interrupts and human-in-the-loop](/docs/chat/recipes/interrupts) — when the agent needs approval mid-step.

<Callout type="info">
  Need engineering support for a production deployment? [Talk to engineers](/contact?source=blog_streaming_pillar&track=enterprise) — we work directly with teams shipping Angular agent UIs.
</Callout>

Streaming is the entry. The product is what you build around it.
```

(The exact prose above is the seed draft. The implementer reviews against Brian's voice samples and tightens sentences that drift toward marketing tone. Word count target ~2,500 — if shorter is tighter, that is acceptable.)

- [ ] **Step 3: Verify the post is picked up by the parser**

Run: `cd apps/website && npx vitest run src/lib/blog.spec.ts`
(Existing tests should pass; this post is not asserted against.)

Then verify in dev:

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation
npx nx serve website &
sleep 8
curl -s http://localhost:3000/blog | grep -q "Build a Streaming Chat UI" && echo "✓ seed post on index"
curl -s http://localhost:3000/blog/build-a-streaming-chat-ui-in-angular-with-langgraph | grep -q "streaming chat UI" && echo "✓ seed post page renders"
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx
git commit -m "feat(website): seed pillar post on streaming chat in Angular"
```

---

## Task 17: Build + RSS verification

**Files:** none (verification only)

- [ ] **Step 1: Full website build**

Run: `cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation && npx nx run website:build`
Expected: build succeeds, `/blog`, `/blog/[slug]`, `/blog/rss.xml` all listed in the route summary.

- [ ] **Step 2: Run all website unit tests**

Run: `cd apps/website && npx vitest run`
Expected: all green, including the new `blog.spec.ts` and `PostCard.spec.tsx`.

- [ ] **Step 3: Smoke check RSS in dev**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation
npx nx serve website &
SERVE_PID=$!
sleep 10
curl -s -i http://localhost:3000/blog/rss.xml | head -5
curl -s http://localhost:3000/blog/rss.xml | xmllint --noout - && echo "✓ RSS is valid XML"
curl -s http://localhost:3000/sitemap.xml | grep -q "/blog/build-a-streaming-chat-ui-in-angular-with-langgraph" && echo "✓ sitemap includes seed post"
kill $SERVE_PID
```

Expected: `Content-Type: application/rss+xml`, XML validates, sitemap includes seed.

- [ ] **Step 4: Chrome MCP smoke (manual)**

Use the Chrome MCP to visit (in order):

1. `http://localhost:3000/blog` — featured card + index visible.
2. `http://localhost:3000/blog/build-a-streaming-chat-ui-in-angular-with-langgraph` — full post renders with syntax highlighting.
3. `view-source:http://localhost:3000/blog/build-a-streaming-chat-ui-in-angular-with-langgraph` — `<meta property="og:image">` references `/opengraph-image` for the post.

- [ ] **Step 5: No commit** — verification only.

---

## Task 18: Open PR

**Files:** none (PR creation)

- [ ] **Step 1: Push the branch**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation
git push -u origin gtm-spec-5-content-pillar-blog
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "feat(website): /blog infrastructure + streaming-chat pillar post (Spec 5)" --body "$(cat <<'EOF'
## Summary
- Adds `/blog` index, `/blog/[slug]`, per-post OG, `/blog/rss.xml`, sitemap inclusion
- Seed pillar post: "Build a Streaming Chat UI in Angular with LangGraph" written in Brian's voice
- New `blog:*` analytics namespace (`blog:cta_click`, `blog:copy_code_click`) + `'blog'` `AnalyticsSurface`

Spec: `docs/superpowers/specs/gtm/2026-05-17-content-pillar-pages-design.md`
Plan: `docs/superpowers/plans/gtm/2026-05-17-content-pillar-pages.md`

## Test plan
- [ ] `nx run website:build` green
- [ ] `cd apps/website && npx vitest run` green
- [ ] `/blog` renders with seed post visible
- [ ] `/blog/build-a-streaming-chat-ui-in-angular-with-langgraph` renders with highlighted code
- [ ] `/blog/rss.xml` returns valid RSS 2.0
- [ ] sitemap includes new blog routes
- [ ] per-post OG card renders

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Enable auto-merge on green**

```bash
gh pr merge --auto --squash
```

Expected: PR opens, CI runs, auto-merges on green.

---

## Self-review

Spec coverage check (against §3 of the spec):

- ✅ `/blog` route — Task 11
- ✅ `/blog/[slug]` — Task 12
- ✅ `/blog/[slug]/opengraph-image.tsx` — Task 13
- ✅ `/blog/rss.xml` — Task 14
- ✅ Date-prefixed MDX filenames + frontmatter parser — Tasks 2, 3
- ✅ Author registry — Task 4
- ✅ `blog:*` analytics events + `'blog'` surface — Task 5
- ✅ `taxonomy.md` update — Task 6
- ✅ Nav `Blog` link — Task 10
- ✅ Sitemap inclusion — Task 15
- ✅ Seed pillar post — Task 16
- ✅ Unit tests for `blog.ts` and `PostCard` — Tasks 3, 8
- ✅ `nx run website:build` verification — Task 17

Placeholder scan: no "TBD"/"implement later" in steps. Code blocks are concrete. Test code is provided in full. The optional fallback OG path in Task 13 has explicit fallback instructions, not a TBD.

Type consistency: `Post`, `PostFrontmatter`, `Author` are defined once in Tasks 3, 4 and consumed unchanged in Tasks 7, 8, 9, 11, 12, 13, 14. `getAllPosts`/`getPostBySlug`/`getFeaturedPost`/`getAllTags` signatures match between Task 3 (definition) and consumers.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/gtm/2026-05-17-content-pillar-pages.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
