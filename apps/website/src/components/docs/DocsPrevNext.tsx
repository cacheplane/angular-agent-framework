import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Card } from '../ui/Card';
import { Eyebrow } from '../ui/Eyebrow';
import { getLibraryConfig, type LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  section: string;
  slug: string;
}

interface Sibling {
  href: string;
  section: string;
  slug: string;
  title: string;
}

function findSiblings(library: LibraryId, section: string, slug: string): { prev: Sibling | null; next: Sibling | null } {
  const lib = getLibraryConfig(library);
  if (!lib) return { prev: null, next: null };
  // Flatten pages in declaration order.
  const flat: Sibling[] = [];
  for (const s of lib.sections) {
    for (const p of s.pages) {
      flat.push({
        section: p.section,
        slug: p.slug,
        title: p.title,
        href: `/docs/${library}/${p.section}/${p.slug}`,
      });
    }
  }
  const idx = flat.findIndex((p) => p.section === section && p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export function DocsPrevNext({ library, section, slug }: Props) {
  const { prev, next } = findSiblings(library, section, slug);
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Previous and next page"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginTop: 48,
        marginBottom: 16,
      }}
    >
      <style>{`
        [data-ui="docs-card"] { transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
        [data-ui="docs-card"]:hover { border-color: ${tokens.colors.accentBorderHover}; box-shadow: ${tokens.shadows.md}; transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { [data-ui="docs-card"]:hover { transform: none; } }
      `}</style>
      {prev ? (
        <Link href={prev.href} style={{ textDecoration: 'none' }}>
          <Card padding="md" data-ui="docs-card" style={{ height: '100%' }}>
            <Eyebrow style={{ marginBottom: 8 }}>← Previous</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.accent,
              }}
            >
              {prev.title}
            </div>
          </Card>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link href={next.href} style={{ textDecoration: 'none' }}>
          <Card padding="md" data-ui="docs-card" style={{ height: '100%', textAlign: 'right' }}>
            <Eyebrow style={{ marginBottom: 8 }}>Next →</Eyebrow>
            <div
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.colors.accent,
              }}
            >
              {next.title}
            </div>
          </Card>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
