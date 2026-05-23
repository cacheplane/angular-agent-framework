import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

interface BlogTagFilterProps {
  /** Currently active tag from ?tag=. Undefined when on /blog. */
  activeTag?: string;
  /** All known tags (already sorted by caller, or sort here). */
  tags: string[];
}

const PILL_BASE: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  lineHeight: 1.2,
};

const ACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  background: tokens.colors.accent,
  color: '#ffffff',
};

const INACTIVE: React.CSSProperties = {
  ...PILL_BASE,
  background: tokens.colors.accentSurface,
  color: tokens.colors.accent,
};

export function BlogTagFilter({ activeTag, tags }: BlogTagFilterProps) {
  const sorted = [...tags].sort((a, b) => a.localeCompare(b));
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 32,
      }}
    >
      {/* "All" pill */}
      {activeTag ? (
        <Link href="/blog" style={INACTIVE}>
          All
        </Link>
      ) : (
        <span style={ACTIVE} aria-current="page">
          All
        </span>
      )}

      {sorted.map((tag) => {
        const isActive = tag === activeTag;
        // Clicking the active tag toggles back to /blog.
        const href = isActive ? '/blog' : `/blog?tag=${encodeURIComponent(tag)}`;
        return isActive ? (
          <Link
            key={tag}
            href={href}
            style={ACTIVE}
            aria-current="page"
          >
            {tag}
          </Link>
        ) : (
          <Link key={tag} href={href} style={INACTIVE}>
            {tag}
          </Link>
        );
      })}
    </div>
  );
}
