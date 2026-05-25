import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
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
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
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
