import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
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
        background: tokens.surfaces.surface,
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
