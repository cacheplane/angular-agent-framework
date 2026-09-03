import type { ReactNode } from 'react';
import { LibraryMark } from './LibraryMark';
import type { LibraryId } from '../../lib/docs-config';

interface Props {
  library: LibraryId;
  /** Right-aligned slot for per-page actions (Spec 2). Optional. */
  actions?: ReactNode;
}

/**
 * The mark-and-actions row above an article.
 *
 * It used to also print "<library> · <section>", which the shell header's
 * breadcrumb trail now states. Two renditions of the same location, stacked,
 * is what made the page look like it had duplicate breadcrumbs.
 */
export function DocsPageHeader({ library, actions }: Props) {
  return (
    <div className="docs-page-header">
      <div className="docs-page-header-lib">
        <LibraryMark library={library} size={34} />
      </div>
      {actions ? <div className="docs-page-header-actions">{actions}</div> : null}
    </div>
  );
}
