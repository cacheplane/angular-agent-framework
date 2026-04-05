import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { getDocsSection } from '../../lib/docs-config';

export function DocsBreadcrumb({ section, title }: { section: string; title: string }) {
  const sectionData = getDocsSection(section);
  return (
    <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: tokens.colors.textMuted }}>
      <Link href="/docs/getting-started/introduction" style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>Docs</Link>
      <span>›</span>
      <span>{sectionData?.title ?? section}</span>
      <span>›</span>
      <span style={{ color: tokens.colors.textSecondary }}>{title}</span>
    </div>
  );
}
