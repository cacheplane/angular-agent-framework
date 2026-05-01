import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { getPrevNextPages, type LibraryId } from '../../lib/docs-config';

export function DocsPrevNext({ library, section, slug }: { library: LibraryId; section: string; slug: string }) {
  const { prev, next } = getPrevNextPages(library, section, slug);

  return (
    <div className="flex justify-between gap-4 mt-12 pt-8" style={{ borderTop: `1px solid ${tokens.glass.border}` }}>
      {prev ? (
        <Link href={`/docs/${library}/${prev.section}/${prev.slug}`} style={{ textDecoration: 'none', flex: 1 }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>&larr; Previous</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{prev.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
      {next ? (
        <Link href={`/docs/${library}/${next.section}/${next.slug}`} style={{ textDecoration: 'none', flex: 1, textAlign: 'right' }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>Next &rarr;</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{next.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );
}
