import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { getPrevNextPages } from '../../lib/docs-config';

export function DocsPrevNext({ section, slug }: { section: string; slug: string }) {
  const { prev, next } = getPrevNextPages(section, slug);

  return (
    <div className="flex justify-between gap-4 mt-12 pt-8" style={{ borderTop: `1px solid ${tokens.glass.border}` }}>
      {prev ? (
        <Link href={`/docs/${prev.section}/${prev.slug}`} style={{ textDecoration: 'none', flex: 1 }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>← Previous</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{prev.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
      {next ? (
        <Link href={`/docs/${next.section}/${next.slug}`} style={{ textDecoration: 'none', flex: 1, textAlign: 'right' }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>Next →</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{next.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );
}
