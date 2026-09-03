import type { ReactNode } from 'react';

interface Props {
  /** Right-aligned slot for per-page actions (Spec 2). Optional. */
  actions?: ReactNode;
}

/**
 * The row above an article that carries the page actions.
 *
 * It used to also render the library mark and print "<library> · <section>".
 * Both have moved into the shell header's breadcrumb trail, which already
 * names the library and section — restating either here was a second
 * rendition of the same location. This row now exists only to host
 * `actions`.
 */
export function DocsPageHeader({ actions }: Props) {
  return (
    <div className="docs-page-header">
      {actions ? <div className="docs-page-header-actions">{actions}</div> : null}
    </div>
  );
}
