import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';

/**
 * Tag pills on the article page. Each pill links to the blog landing page
 * filtered by that tag (`/blog?tag=<tag>`), matching the affordance offered
 * by the BlogTagFilter row on `/blog`.
 */
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
        <Link
          key={tag}
          href={`/blog?tag=${encodeURIComponent(tag)}`}
          style={{
            fontSize: 13,
            padding: '4px 10px',
            borderRadius: 999,
            background: tokens.colors.accentSurface,
            color: tokens.colors.accent,
            textDecoration: 'none',
            cursor: 'pointer',
            display: 'inline-block',
            lineHeight: 1.2,
          }}
        >
          {tag}
        </Link>
      ))}
    </div>
  );
}
