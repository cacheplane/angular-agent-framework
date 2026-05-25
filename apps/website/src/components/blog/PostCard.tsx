import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import type { Post } from '../../lib/blog';
import { formatCardDate, readingTimeMin } from '../../lib/blog';

export function PostCard({ post }: { post: Post }) {
  const { slug, frontmatter, content } = post;
  const minutes = readingTimeMin(content);

  return (
    <Link
      href={`/blog/${slug}`}
      data-ui="card"
      data-hoverable
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 24,
        borderRadius: 12,
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: tokens.typography.eyebrow.family,
          fontSize: tokens.typography.eyebrow.size,
          fontWeight: tokens.typography.eyebrow.weight,
          letterSpacing: tokens.typography.eyebrow.letterSpacing,
          textTransform: tokens.typography.eyebrow.transform,
          color: tokens.colors.textMuted,
        }}
      >
        {formatCardDate(frontmatter.date)} · {minutes} min read
      </span>
      <h3
        style={{
          fontFamily: tokens.typography.h3.family,
          fontSize: tokens.typography.h3.size,
          lineHeight: tokens.typography.h3.line,
          fontWeight: tokens.typography.h3.weight,
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        {frontmatter.title}
      </h3>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: tokens.colors.textSecondary,
          margin: 0,
        }}
      >
        {frontmatter.description}
      </p>
      {frontmatter.tags && frontmatter.tags.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
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
