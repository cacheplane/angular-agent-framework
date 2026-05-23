import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import type { Post } from '../../lib/blog';
import { formatPostDate, readingTimeMin } from '../../lib/blog';
import { getAuthor } from '../../lib/blog-authors';
import { AuthorByline } from './AuthorByline';
import { Eyebrow } from '../ui/Eyebrow';

export function FeaturedPostCard({ post }: { post: Post }) {
  const { slug, frontmatter, content } = post;
  const author = getAuthor(frontmatter.author);
  const minutes = readingTimeMin(content);

  return (
    <Link
      href={`/blog/${slug}`}
      data-ui="card"
      data-hoverable
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 32,
        borderRadius: 16,
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.colors.accent}`,
        color: tokens.colors.textPrimary,
        textDecoration: 'none',
        marginBottom: 32,
      }}
    >
      <Eyebrow tone="accent">Featured</Eyebrow>
      <h2
        style={{
          fontFamily: tokens.typography.h2.family,
          fontSize: tokens.typography.h2.size,
          lineHeight: tokens.typography.h2.line,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        {frontmatter.title}
      </h2>
      <p
        style={{
          fontFamily: tokens.typography.bodyLg.family,
          fontSize: tokens.typography.bodyLg.size,
          lineHeight: tokens.typography.bodyLg.line,
          color: tokens.colors.textSecondary,
          margin: 0,
        }}
      >
        {frontmatter.description}
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginTop: 8,
          flexWrap: 'wrap',
        }}
      >
        <AuthorByline author={author} />
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
          {formatPostDate(frontmatter.date)} · {minutes} min read
        </span>
      </div>
    </Link>
  );
}
