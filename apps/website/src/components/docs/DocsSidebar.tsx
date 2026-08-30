'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, specialDocsPages, type DocsSection, type LibraryId } from '../../lib/docs-config';
import { LibraryMark } from './LibraryMark';

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
        className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between docs-sidebar-lib-trigger"
      >
        <span className="docs-sidebar-lib-trigger-inner">
          <LibraryMark library={activeLibrary} size={20} />
          <span className="docs-sidebar-lib-trigger-label">
            {currentLib?.title ?? activeLibrary}
          </span>
        </span>
        <span className="docs-sidebar-lib-caret" data-open={open ? '' : undefined}>
          &#9662;
        </span>
      </button>

      {open && (
        <div className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-10 docs-sidebar-lib-menu">
          {docsConfig.map((lib) => (
            <button
              key={lib.id}
              onClick={() => {
                setOpen(false);
                router.push(`/docs/${lib.id}/getting-started/introduction`);
              }}
              className="w-full text-left px-3 py-2.5 text-sm flex items-start gap-2.5 docs-sidebar-lib-item"
              data-active={lib.id === activeLibrary || undefined}
            >
              <span className="docs-sidebar-lib-item-icon">
                <LibraryMark library={lib.id} size={20} />
              </span>
              <span className="flex flex-col docs-sidebar-lib-item-text">
                <span
                  className="docs-sidebar-lib-item-title"
                  data-active={lib.id === activeLibrary || undefined}
                >
                  {lib.title}
                </span>
                <span className="docs-sidebar-lib-item-desc">
                  {lib.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small consistent-stroke glyphs keyed by section id (premium-polish pass). */
function SectionGlyph({ id }: { id: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'getting-started':
      return (
        <svg {...common}><path d="M3 13c0-3 1-6.5 5-10 4 3.5 5 7 5 10l-2.5-2h-5L3 13Z" /><circle cx="8" cy="7" r="1.4" /></svg>
      );
    case 'guides':
      return (
        <svg {...common}><path d="M2.5 3.5A1.5 1.5 0 014 2h4v11H4a1.5 1.5 0 00-1.5 1.5V3.5Z" /><path d="M13.5 3.5A1.5 1.5 0 0012 2H8v11h4a1.5 1.5 0 011.5 1.5V3.5Z" /></svg>
      );
    case 'concepts':
      return (
        <svg {...common}><path d="M8 2a4.5 4.5 0 00-2.5 8.2c.6.5 1 1.1 1 1.8h3c0-.7.4-1.3 1-1.8A4.5 4.5 0 008 2Z" /><path d="M6.5 14h3" /></svg>
      );
    case 'components':
      return (
        <svg {...common}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
      );
    case 'a2ui':
      return (
        <svg {...common}><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M4.5 5.5h7" /><path d="M4.5 8h4" /><path d="M4.5 10.5h5.5" /></svg>
      );
    case 'api':
    case 'reference':
      return (
        <svg {...common}><path d="M5.5 3.5 2 8l3.5 4.5" /><path d="M10.5 3.5 14 8l-3.5 4.5" /></svg>
      );
    default:
      return (
        <svg {...common}><circle cx="8" cy="8" r="2" /></svg>
      );
  }
}

function SectionGroup({
  section,
  activeLibrary,
  activeSection,
  activeSlug,
}: {
  section: DocsSection;
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="docs-sidebar-section">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-1.5 flex items-center justify-between docs-sidebar-section-toggle"
      >
        <span className="docs-sidebar-section-labelrow">
          <span className="docs-sidebar-section-glyph"><SectionGlyph id={section.id} /></span>
          <span
            className="font-mono text-xs uppercase tracking-wider docs-sidebar-section-label"
            data-tone={section.color}
          >
            {section.title}
          </span>
        </span>
        <span className="docs-sidebar-section-caret" data-open={open ? '' : undefined}>
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
                data-docs-navlink
                data-active={isActive || undefined}
                className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all docs-sidebar-section-link"
              >
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
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 py-6 overflow-y-auto hidden lg:block docs-sidebar">
      {/* Search trigger */}
      <div className="px-4 mb-4">
        <button
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between docs-sidebar-search-trigger"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <span className="docs-sidebar-search-inner">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <span className="docs-sidebar-search-label">Search docs...</span>
          </span>
          <kbd className="docs-sidebar-search-kbd">⌘K</kbd>
        </button>
      </div>

      <nav className="flex flex-col mb-4">
        {specialDocsPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            data-docs-navlink
            data-active={pathname === page.path || undefined}
            className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all docs-sidebar-top-link"
          >
            {page.title}
          </Link>
        ))}
      </nav>

      <LibraryDropdown activeLibrary={activeLibrary} />

      {libConfig?.demoUrl && (
        <div className="px-4 mb-4">
          <a href={libConfig.demoUrl} target="_blank" rel="noopener noreferrer"
            className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between docs-sidebar-demo-link">
            <span>{libConfig.demoLabel ?? 'Live demo'}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

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
