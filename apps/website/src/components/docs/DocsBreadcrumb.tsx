import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { getLibraryConfig, type LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  section: string;
  slug?: string;
  title: string;
}

function humanize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DocsBreadcrumb({ library, section, slug: _slug, title }: Props) {
  const libConfig = getLibraryConfig(library);
  const libraryTitle = libConfig?.title ?? library;
  const sectionTitle = libConfig?.sections.find((s) => s.id === section)?.title ?? humanize(section);

  const crumb: React.CSSProperties = {
    fontFamily: tokens.typography.fontSans,
    fontSize: 13,
    lineHeight: 1.5,
    color: tokens.colors.textMuted,
    textDecoration: 'none',
  };
  const sep: React.CSSProperties = {
    margin: '0 8px',
    color: tokens.colors.textMuted,
  };

  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap' }}>
        <li>
          <Link href="/docs" style={crumb}>Docs</Link>
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li>
          <Link href={`/docs/${library}/getting-started/introduction`} style={crumb}>{libraryTitle}</Link>
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li style={crumb}>
          {sectionTitle}
          <span style={sep} aria-hidden="true">/</span>
        </li>
        <li style={{ ...crumb, color: tokens.colors.textPrimary, fontWeight: 600 }} aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
