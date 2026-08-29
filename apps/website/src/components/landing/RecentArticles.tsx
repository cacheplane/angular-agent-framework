import Link from 'next/link';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { PostCard } from '../blog/PostCard';
import { getRecentPosts } from '../../lib/blog';

/**
 * Marketing-home strip showing the most recent posts (including any flagged
 * `featured`). Renders nothing when no posts exist, so the home page stays
 * clean while the blog catalog is small.
 */
export function RecentArticles() {
  const posts = getRecentPosts(3);
  if (posts.length === 0) return null;

  return (
    <Section surface="canvas" ariaLabelledBy="recent-articles-heading">
      <Container>
        <div className="recent-articles-header">
          <Eyebrow tone="accent" className="recent-articles-eyebrow">
            Blog
          </Eyebrow>
          <h2 id="recent-articles-heading" className="recent-articles-heading">
            Recent articles
          </h2>
        </div>

        <div className="recent-articles-grid">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>

        <div className="recent-articles-footer">
          <Link href="/blog" className="recent-articles-link">
            View all articles →
          </Link>
        </div>
      </Container>
    </Section>
  );
}
