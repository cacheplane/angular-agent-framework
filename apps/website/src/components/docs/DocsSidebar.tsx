'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, type DocsSection, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@cacheplane/design-tokens';

interface Props {
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
}

function LibraryDropdown({ activeLibrary }: { activeLibrary: LibraryId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLib = getLibraryConfig(activeLibrary);

  return (
    <div ref={ref} className="relative px-4 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.5)',
          border: `1px solid ${tokens.glass.border}`,
          color: tokens.colors.textPrimary,
          cursor: 'pointer',
          fontWeight: 600,
        }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{currentLib?.title ?? activeLibrary}</span>
        <span style={{ color: tokens.colors.textMuted, fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>&#9662;</span>
      </button>

      {open && (
        <div className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-10"
          style={{
            background: 'rgba(255,255,255,0.98)',
            border: `1px solid ${tokens.glass.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
          {docsConfig.map((lib) => (
            <button
              key={lib.id}
              onClick={() => {
                setOpen(false);
                router.push(`/docs/${lib.id}/getting-started/introduction`);
              }}
              className="w-full text-left px-3 py-2.5 text-sm flex flex-col"
              style={{
                background: lib.id === activeLibrary ? tokens.colors.accentSurface : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: lib.id === activeLibrary ? tokens.colors.accent : tokens.colors.textPrimary, fontSize: '0.8rem' }}>
                {lib.title}
              </span>
              <span style={{ fontSize: '0.7rem', color: tokens.colors.textMuted, marginTop: 2 }}>
                {lib.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionGroup({ section, activeLibrary, activeSection, activeSlug }: { section: DocsSection; activeLibrary: LibraryId; activeSection: string; activeSlug: string }) {
  const [open, setOpen] = useState(true);
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
          &#9662;
        </span>
      </button>

      {open && (
        <nav className="flex flex-col mt-1">
          {section.pages.map((page) => {
            const isActive = page.section === activeSection && page.slug === activeSlug;
            return (
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
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

export function DocsSidebar({ activeLibrary, activeSection, activeSlug }: Props) {
  const libConfig = getLibraryConfig(activeLibrary);

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
      <div className="px-4 mb-4">
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
          }}>&#8984;K</span>
        </button>
      </div>

      {/* Library dropdown */}
      <LibraryDropdown activeLibrary={activeLibrary} />

      {/* Section groups */}
      {libConfig?.sections.map((section) => (
        <SectionGroup
          key={section.id}
          section={section}
          activeLibrary={activeLibrary}
          activeSection={activeSection}
          activeSlug={activeSlug}
        />
      ))}
    </aside>
  );
}
