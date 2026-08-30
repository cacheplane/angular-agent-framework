'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { docsConfig, specialDocsPages, type LibraryId } from '../../lib/docs-config';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';

interface SearchablePage {
  title: string;
  description?: string;
  href: string;
  slug?: string;
  section?: string;
  library?: LibraryId;
  libraryTitle: string;
}

const SEARCH_STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

function searchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@.-]+/)
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token));
}

function searchableText(page: SearchablePage): string {
  return [page.title, page.description, page.slug, page.section, page.libraryTitle].filter(Boolean).join(' ');
}

function matchesQuery(page: SearchablePage, query: string): boolean {
  const queryTokens = searchTokens(query);
  if (queryTokens.length === 0) return false;

  const pageText = searchableText(page).toLowerCase();
  return queryTokens.every((token) => pageText.includes(token));
}

const allSearchablePages: SearchablePage[] = [
  ...specialDocsPages.map((page) => ({
    title: page.title,
    description: page.description,
    href: page.path,
    libraryTitle: 'Start here',
  })),
  ...docsConfig.flatMap((lib) =>
    lib.sections.flatMap((s) =>
      s.pages.map((p) => ({
        ...p,
        href: `/docs/${lib.id}/${p.section}/${p.slug}`,
        library: lib.id,
        libraryTitle: lib.title,
      }))
    )
  ),
];

export function DocsSearch({ library }: { library?: LibraryId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const listboxId = 'docs-search-listbox';
  const router = useRouter();

  const results = query.length > 0
    ? allSearchablePages.filter((p) => matchesQuery(p, query)).slice(0, 8)
    : allSearchablePages.filter((p) => !library || !p.library || p.library === library).slice(0, 6);

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
    if (!open) return undefined;
    // Dialog pattern: remember where focus came from, restore it on close.
    restoreRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => restoreRef.current?.focus();
  }, [open]);

  // Keep the keyboard-selected option in view (findings §7 — it scrolled
  // out of the 320px results box).
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, selected]);

  const navigate = (page: SearchablePage) => {
    track(analyticsEvents.docsSearchResultClick, {
      surface: 'docs',
      destination_url: page.href,
      library: page.library === 'langgraph' || page.library === 'render' || page.library === 'chat' ? page.library : 'unknown',
      query_length: query.length,
      result_count: results.length,
    });
    router.push(page.href);
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected]); }
    // Focus trap: the combobox input is the dialog's only tab stop (options
    // are reached with the arrow keys), so Tab must not escape to the page
    // behind the modal.
    if (e.key === 'Tab') e.preventDefault();
  };

  if (!open) return null;

  return (
    <div className="docs-search-overlay" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        onClick={(e) => e.stopPropagation()}
        className="docs-search-modal">
        <div className="docs-search-input-wrap">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              setSelected(0);
              if (nextQuery.length === 1) {
                track(analyticsEvents.docsSearchSubmit, {
                  surface: 'docs',
                  library: library === 'langgraph' || library === 'render' || library === 'chat' ? library : 'unknown',
                });
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search documentation..."
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={results[selected] ? `docs-search-opt-${selected}` : undefined}
            className="docs-search-input"
          />
        </div>
        <div className="docs-search-results" ref={listRef} id={listboxId} role="listbox" aria-label="Search results">
          {results.map((page, i) => (
            <button
              key={page.href}
              id={`docs-search-opt-${i}`}
              role="option"
              aria-selected={i === selected}
              tabIndex={-1}
              onClick={() => navigate(page)}
              className="w-full text-left docs-search-result"
              data-selected={i === selected || undefined}>
              <span className="docs-search-result-title">{page.title}</span>
              <span className="docs-search-result-lib">{page.libraryTitle}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="docs-search-empty">
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
