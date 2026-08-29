'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { docsConfig, getLibraryConfig, specialDocsPages, type DocsSection, type LibraryId } from '../../lib/docs-config';
import { Pill } from '../ui/Pill';
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
        <span
          className="font-mono text-xs uppercase tracking-wider docs-sidebar-section-label"
          data-tone={section.color}
        >
          {section.title}
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
          <span className="docs-sidebar-search-label">Search docs...</span>
          <Pill variant="neutral" className="docs-sidebar-search-kbd">⌘K</Pill>
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
