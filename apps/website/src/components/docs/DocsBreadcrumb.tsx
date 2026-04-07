import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { getDocsSection, getLibraryConfig, type LibraryId } from '../../lib/docs-config';

export function DocsBreadcrumb({ library, section, title }: { library: LibraryId; section: string; title: string }) {
  const libConfig = getLibraryConfig(library);
  const sectionData = getDocsSection(library, section);
  return (
    <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: tokens.colors.textMuted }}>
      <Link href="/docs" style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>Docs</Link>
      <span>&rsaquo;</span>
      <Link href={`/docs/${library}/getting-started/introduction`} style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>{libConfig?.title ?? library}</Link>
      <span>&rsaquo;</span>
      <span>{sectionData?.title ?? section}</span>
      <span>&rsaquo;</span>
      <span style={{ color: tokens.colors.textSecondary }}>{title}</span>
    </div>
  );
}
