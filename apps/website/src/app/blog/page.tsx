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
