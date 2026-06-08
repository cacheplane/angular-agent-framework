import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
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
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '35px 24px 64px' }}>
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
            Articles from ThreadPlane
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
