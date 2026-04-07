'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

export function DocsMobileNav({ activeLibrary, activeSection, activeSlug }: { activeLibrary: LibraryId; activeSection: string; activeSlug: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const libConfig = getLibraryConfig(activeLibrary);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 mb-4 rounded-lg text-sm font-mono"
        style={{
          background: tokens.glass.bg,
          border: `1px solid ${tokens.glass.border}`,
          color: tokens.colors.textSecondary,
        }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
        {open ? 'Hide menu' : 'Docs menu'}
      </button>

      {open && (
        <nav className="mb-6 rounded-lg overflow-hidden"
          style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
          }}>
          {/* Library selector */}
          <div className="flex border-b" style={{ borderColor: tokens.glass.border }}>
            {docsConfig.map((lib) => (
              <button
                key={lib.id}
                onClick={() => {
                  if (lib.id !== activeLibrary) {
                    router.push(`/docs/${lib.id}/getting-started/introduction`);
                    setOpen(false);
                  }
                }}
                className="flex-1 py-2 text-xs font-mono text-center"
                style={{
                  background: lib.id === activeLibrary ? tokens.colors.accentSurface : 'transparent',
                  color: lib.id === activeLibrary ? tokens.colors.accent : tokens.colors.textMuted,
                  fontWeight: lib.id === activeLibrary ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer',
                }}>
                {lib.title}
              </button>
            ))}
          </div>

          {libConfig?.sections.map((section) => (
            <div key={section.id} className="py-2">
              <div className="px-4 py-1 font-mono text-xs uppercase tracking-wider"
                style={{ color: section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent, fontWeight: 600 }}>
                {section.title}
              </div>
              {section.pages.map((page) => {
                const isActive = page.section === activeSection && page.slug === activeSlug;
                return (
                  <Link
                    key={`${page.section}/${page.slug}`}
                    href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-1.5 text-sm"
                    style={{
                      color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                      background: isActive ? tokens.colors.accentSurface : 'transparent',
                    }}>
                    {page.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
