import type { ReactNode } from 'react';
import { LibraryMark } from './LibraryMark';
import { getLibraryConfig, getDocsSection, type LibraryId } from '../../lib/docs-config';

function humanize(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  library: LibraryId;
  section: string;
  /** Right-aligned slot for per-page actions (Spec 2). Optional. */
  actions?: ReactNode;
}

export function DocsPageHeader({ library, section, actions }: Props) {
  const libTitle = getLibraryConfig(library)?.title ?? library;
  const sectionTitle = getDocsSection(library, section)?.title ?? humanize(section);

  return (
    <div className="docs-page-header">
      <div className="docs-page-header-lib">
        <LibraryMark library={library} size={34} />
        <span className="docs-page-header-label">
          {libTitle} · {sectionTitle}
        </span>
      </div>
      {actions ? <div className="docs-page-header-actions">{actions}</div> : null}
    </div>
  );
}
