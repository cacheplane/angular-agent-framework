'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { docsConfig, type LibraryId } from '../../lib/docs-config';
import { tokens } from '@ngaf/design-tokens';

interface SearchablePage {
  title: string;
  slug: string;
  section: string;
  library: LibraryId;
  libraryTitle: string;
}

const allSearchablePages: SearchablePage[] = docsConfig.flatMap((lib) =>
  lib.sections.flatMap((s) =>
    s.pages.map((p) => ({
      ...p,
      library: lib.id,
      libraryTitle: lib.title,
    }))
  )
);

export function DocsSearch({ library }: { library?: LibraryId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = query.length > 0
    ? allSearchablePages.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.slug.toLowerCase().includes(query.toLowerCase()) ||
        p.section.toLowerCase().includes(query.toLowerCase()) ||
        p.libraryTitle.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : allSearchablePages.filter((p) => !library || p.library === library).slice(0, 6);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = (page: SearchablePage) => {
    router.push(`/docs/${page.library}/${page.section}/${page.slug}`);
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected]); }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '20vh',
    }} onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          borderRadius: 12,
          boxShadow: '0 16px 64px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.glass.border}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search documentation..."
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontFamily: 'var(--font-inter)', fontSize: '0.95rem',
              color: tokens.colors.textPrimary, background: 'transparent',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {results.map((page, i) => (
            <button
              key={`${page.library}/${page.section}/${page.slug}`}
              onClick={() => navigate(page)}
              className="w-full text-left"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8,
                background: i === selected ? tokens.colors.accentSurface : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%',
              }}>
              <span style={{ fontSize: '0.875rem', color: tokens.colors.textPrimary }}>{page.title}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: tokens.colors.textMuted, background: 'rgba(0,0,0,0.04)',
                padding: '2px 6px', borderRadius: 4,
              }}>{page.libraryTitle}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: tokens.colors.textMuted, fontSize: '0.85rem' }}>
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
