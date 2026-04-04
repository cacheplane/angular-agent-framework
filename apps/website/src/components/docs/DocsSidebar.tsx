import Link from 'next/link';
import { getAllDocsMeta } from '../../lib/docs';
import { tokens } from '../../../lib/design-tokens';

export function DocsSidebar({ activeSlug }: { activeSlug: string }) {
  const docs = getAllDocsMeta();
  return (
    <aside
      className="w-56 shrink-0 py-8"
      style={{
        borderRight: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        minHeight: 'calc(100vh - 4rem)',
        position: 'sticky',
        top: '4rem',
      }}>
      <p
        className="font-mono text-xs uppercase tracking-widest mb-6 px-4"
        style={{ color: tokens.colors.textMuted }}>
        Documentation
      </p>
      <nav className="flex flex-col">
        {docs.map((doc) => {
          const slug = doc.slug.join('/');
          const isActive = slug === activeSlug;
          return (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              className="px-4 py-2 text-sm mx-2 rounded-md transition-all"
              style={{
                color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                background: isActive ? tokens.colors.accentSurface : 'transparent',
              }}>
              {doc.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
