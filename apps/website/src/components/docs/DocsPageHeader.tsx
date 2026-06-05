import type { ReactNode } from 'react';
import { tokens } from '@threadplane/design-tokens';
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <LibraryMark library={library} size={34} />
        <span
          style={{
            fontFamily: tokens.typography.fontMono,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: tokens.colors.accent,
          }}
        >
          {libTitle} · {sectionTitle}
        </span>
      </div>
      {actions ? <div style={{ flex: '0 0 auto' }}>{actions}</div> : null}
    </div>
  );
}
