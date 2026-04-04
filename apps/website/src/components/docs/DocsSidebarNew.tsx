'use client';
import { useState } from 'react';
import Link from 'next/link';
import { docsConfig, type DocsSection } from '../../lib/docs-config';
import { tokens } from '../../../lib/design-tokens';

interface Props {
  activeSection: string;
  activeSlug: string;
}

function SectionGroup({ section, activeSection, activeSlug }: { section: DocsSection; activeSection: string; activeSlug: string }) {
  const hasActive = section.pages.some((p) => p.section === activeSection && p.slug === activeSlug);
  const [open, setOpen] = useState(hasActive || true);
  const headerColor = section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-1.5 flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: headerColor, fontWeight: 600 }}>
          {section.title}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          ▾
        </span>
      </button>

      {open && (
        <nav className="flex flex-col mt-1">
          {section.pages.map((page) => {
            const isActive = page.section === activeSection && page.slug === activeSlug;
            return (
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${page.section}/${page.slug}`}
                className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all"
                style={{
                  color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                  background: isActive ? tokens.colors.accentSurface : 'transparent',
                  fontSize: '0.825rem',
                }}>
                {page.title}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function DocsSidebarNew({ activeSection, activeSlug }: Props) {
  return (
    <aside
      className="w-64 shrink-0 py-6 overflow-y-auto hidden md:block"
      style={{
        borderRight: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        minHeight: 'calc(100vh - 4rem)',
        position: 'sticky',
        top: '4rem',
      }}>
      {/* Search trigger */}
      <div className="px-4 mb-6">
        <button
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: `1px solid ${tokens.glass.border}`,
            color: tokens.colors.textMuted,
            cursor: 'pointer',
          }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <span style={{ fontSize: '0.8rem' }}>Search docs...</span>
          <span style={{
            background: tokens.colors.accentSurface,
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: tokens.colors.accent,
          }}>⌘K</span>
        </button>
      </div>

      {docsConfig.map((section) => (
        <SectionGroup
          key={section.id}
          section={section}
          activeSection={activeSection}
          activeSlug={activeSlug}
        />
      ))}
    </aside>
  );
}
