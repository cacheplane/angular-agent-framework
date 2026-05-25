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
