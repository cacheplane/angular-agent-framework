import Link from 'next/link';
import { createPageMetadata } from '../../lib/site-metadata';
import { getAllPosts, getFeaturedPost, getAllTags } from '../../lib/blog';
import { FeaturedPostCard } from '../../components/blog/FeaturedPostCard';
import { PostCard } from '../../components/blog/PostCard';
import { BlogTagFilter } from '../../components/blog/BlogTagFilter';
import { Eyebrow } from '../../components/ui/Eyebrow';

export const metadata = createPageMetadata({
  title: 'Blog — Threadplane',
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
    <div className="blog-index-page">
      <div className="blog-index-inner">
        <header className="blog-index-header">
          <Eyebrow tone="accent" className="blog-index-eyebrow-spaced">
            Blog
          </Eyebrow>
          <h1 className="blog-index-h1">
            Articles from Threadplane
          </h1>
          <p className="blog-index-subtitle">
            Writing on agent UI for Angular &mdash; production patterns, design
            choices, and what we&apos;re shipping.
          </p>
        </header>

        <BlogTagFilter activeTag={activeTag} tags={tags} />

        {featured ? <FeaturedPostCard post={featured} /> : null}

        {grid.length === 0 ? (
          <div className="blog-index-empty">
            <p className="blog-index-empty-text">
              No posts tagged <em>{activeTag}</em> yet.
            </p>
            <Link href="/blog" className="blog-index-empty-link">
              View all posts
            </Link>
          </div>
        ) : (
          <div className="blog-index-grid">
            {grid.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
