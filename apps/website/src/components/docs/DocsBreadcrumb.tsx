import Link from 'next/link';
import { getLibraryConfig, libraryIntroPath, type LibraryId } from '../../lib/docs-config';

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

  return (
    <nav aria-label="Breadcrumb" className="docs-crumb-nav">
      <ol className="docs-crumb-list">
        <li>
          <Link href="/docs" className="docs-crumb-link">Docs</Link>
          <span className="docs-crumb-sep" aria-hidden="true">/</span>
        </li>
        <li>
          <Link href={libraryIntroPath(library)} className="docs-crumb-link">{libraryTitle}</Link>
          <span className="docs-crumb-sep" aria-hidden="true">/</span>
        </li>
        <li className="docs-crumb-link">
          {sectionTitle}
          <span className="docs-crumb-sep" aria-hidden="true">/</span>
        </li>
        <li className="docs-crumb-current" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}
