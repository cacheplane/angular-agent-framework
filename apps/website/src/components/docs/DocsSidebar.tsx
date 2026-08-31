'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Blocks,
  BookOpen,
  Boxes,
  Braces,
  ChevronDown,
  Circle,
  FileCode2,
  Lightbulb,
  Rocket,
} from 'lucide-react';
import {
  docsConfig,
  getLibraryConfig,
  specialDocsPages,
  type DocsSection,
  type LibraryId,
} from '../../lib/docs-config';
import { LibraryMark } from './LibraryMark';

export interface DocsNavigationProps {
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
  expanded?: Record<string, boolean>;
  onExpandedChange?: (key: string, open: boolean) => void;
  onNavigate?: () => void;
}

function LibraryDropdown({
  activeLibrary,
  onNavigate,
}: {
  activeLibrary: LibraryId;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef(0);
  const menuId = useId();
  const router = useRouter();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[initialFocusRef.current]?.focus();
  }, [open]);

  const openMenu = (initialIndex: number) => {
    initialFocusRef.current = initialIndex;
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : event.key === 'ArrowUp'
              ? (current - 1 + items.length) % items.length
              : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      items[nextIndex]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  };

  const currentLibrary = getLibraryConfig(activeLibrary);

  return (
    <div ref={ref} className="docs-sidebar-library">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) closeMenu(true);
          else openMenu(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowDown' ? 0 : docsConfig.length - 1);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="docs-sidebar-lib-trigger"
      >
        <span className="docs-sidebar-lib-trigger-inner">
          <LibraryMark library={activeLibrary} size={20} />
          <span className="docs-sidebar-lib-trigger-label">
            {currentLibrary?.title ?? activeLibrary}
          </span>
        </span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" data-open={open || undefined} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="docs-sidebar-lib-menu"
          onKeyDown={onMenuKeyDown}
        >
          {docsConfig.map((library) => (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              key={library.id}
              onClick={() => {
                closeMenu();
                onNavigate?.();
                router.push(`/docs/${library.id}/getting-started/introduction`);
              }}
              className="docs-sidebar-lib-item"
              data-active={library.id === activeLibrary || undefined}
            >
              <span className="docs-sidebar-lib-item-icon">
                <LibraryMark library={library.id} size={20} />
              </span>
              <span className="docs-sidebar-lib-item-text">
                <span
                  className="docs-sidebar-lib-item-title"
                  data-active={library.id === activeLibrary || undefined}
                >
                  {library.title}
                </span>
                <span className="docs-sidebar-lib-item-desc">{library.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const SECTION_ICONS: Record<string, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  'getting-started': Rocket,
  guides: BookOpen,
  concepts: Lightbulb,
  components: Boxes,
  a2ui: Blocks,
  api: Braces,
  reference: FileCode2,
};

function SectionGroup({
  section,
  activeLibrary,
  activeSection,
  activeSlug,
  open,
  onOpenChange,
  onNavigate,
}: {
  section: DocsSection;
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const SectionIcon = SECTION_ICONS[section.id] ?? Circle;
  const contentId = useId();

  return (
    <div className="docs-sidebar-section">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="docs-sidebar-section-toggle"
      >
        <span className="docs-sidebar-section-labelrow">
          <SectionIcon size={16} aria-hidden={true} />
          <span className="docs-sidebar-section-label">{section.title}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="docs-sidebar-section-caret"
          data-open={open || undefined}
        />
      </button>

      {open ? (
        <nav
          id={contentId}
          aria-label={`${section.title} pages`}
          className="docs-sidebar-section-links"
        >
          {section.pages.map((page) => {
            const isActive = page.section === activeSection && page.slug === activeSlug;
            return (
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${activeLibrary}/${page.section}/${page.slug}`}
                onClick={onNavigate}
                data-docs-navlink
                data-active={isActive || undefined}
                aria-current={isActive ? 'page' : undefined}
                className="docs-sidebar-section-link"
              >
                {page.title}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

export function DocsNavigation({
  activeLibrary,
  activeSection,
  activeSlug,
  expanded = {},
  onExpandedChange,
  onNavigate,
}: DocsNavigationProps) {
  const library = getLibraryConfig(activeLibrary);
  const pathname = usePathname();

  return (
    <div data-docs-navigation>
      <nav aria-label="Featured documentation" className="docs-sidebar-top-links">
        {specialDocsPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            onClick={onNavigate}
            data-docs-navlink
            data-active={pathname === page.path || undefined}
            aria-current={pathname === page.path ? 'page' : undefined}
            className="docs-sidebar-top-link"
          >
            {page.title}
          </Link>
        ))}
      </nav>

      <LibraryDropdown activeLibrary={activeLibrary} onNavigate={onNavigate} />

      {library?.sections.map((section) => {
        const key = `Learn:${activeLibrary}:${section.id}`;
        return (
          <SectionGroup
            key={section.id}
            section={section}
            activeLibrary={activeLibrary}
            activeSection={activeSection}
            activeSlug={activeSlug}
            open={expanded[key] ?? true}
            onOpenChange={(open) => onExpandedChange?.(key, open)}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
}

export function DocsSidebar(props: DocsNavigationProps) {
  return (
    <aside className="docs-sidebar">
      <DocsNavigation {...props} />
    </aside>
  );
}
