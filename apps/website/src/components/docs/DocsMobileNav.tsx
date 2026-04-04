'use client';
import { useState } from 'react';
import Link from 'next/link';
import { docsConfig } from '../../lib/docs-config';
import { tokens } from '../../../lib/design-tokens';

export function DocsMobileNav({ activeSection, activeSlug }: { activeSection: string; activeSlug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Toggle button */}
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

      {/* Drawer */}
      {open && (
        <nav className="mb-6 rounded-lg overflow-hidden"
          style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
          }}>
          {docsConfig.map((section) => (
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
                    href={`/docs/${page.section}/${page.slug}`}
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
