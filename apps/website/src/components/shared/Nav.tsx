'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DOCS_INDEX_TITLE,
  findDocsPage,
  getLibraryConfig,
  specialDocsPages,
  type LibraryId,
} from '../../lib/docs-config';
import { trackCtaClick, trackExternalLinkClick } from '../../lib/analytics/client';
import type { AnalyticsLibrary } from '../../lib/analytics/events';
import { LogoMark } from '../ui/LogoMark';
import { Button } from '../ui/Button';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';
import { DocsContextContent } from '../docs/DocsControlPlane';

const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Pricing', href: '/pricing', external: false },
  { label: 'Examples', href: 'https://cockpit.threadplane.ai', external: true },
];

const toAnalyticsLibrary = (library: LibraryId | null): AnalyticsLibrary => {
  switch (library) {
    case 'langgraph':
    case 'render':
    case 'chat':
    case 'ag-ui':
      return library;
    default:
      return 'unknown';
  }
};

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function DemoDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="nav-demo-dropdown">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-mono transition-colors nav-demo-trigger"
        aria-haspopup="true" aria-expanded={open}
      >
        Demo <span className="nav-demo-caret" data-open={open || undefined}>&#9662;</span>
      </button>
      {open && (
        <div className="nav-demo-menu">
          {DEMOS.map((demo) => (
            <a key={demo.key} href={demo.href} target="_blank" rel="noopener noreferrer"
              onClick={() => { setOpen(false); trackExternalLinkClick(demo.href, { surface: 'nav', cta_id: `nav_demo_${demoCtaSuffix(demo.key)}`, cta_text: demo.label }); }}
              className="text-sm font-mono nav-demo-item">
              {demo.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDocsPage = pathname.startsWith('/docs');
  const pathParts = pathname.split('/').filter(Boolean);
  const activeLibrary = isDocsPage && pathParts.length >= 2 ? pathParts[1] : '';
  const activeSection = isDocsPage && pathParts.length >= 3 ? pathParts[2] : '';
  const activeSlug = isDocsPage && pathParts.length >= 4 ? pathParts[3] : '';
  // A docs URL without a library segment (e.g. /docs/choosing-an-adapter) is
  // library-neutral. Defaulting to a library here made the drawer claim the
  // reader was inside LangGraph's docs.
  const docsLibrary = (getLibraryConfig(activeLibrary)?.id ?? null) as LibraryId | null;
  const specialDocsPage = specialDocsPages.find((page) => page.path === pathname);
  const docsPageTitle =
    findDocsPage(activeLibrary, activeSection, activeSlug)?.title ??
    specialDocsPage?.title ??
    (pathname === '/docs' ? DOCS_INDEX_TITLE : 'Documentation');
  const navRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const restoreMobileFocusRef = useRef(false);
  const pendingMobileSearchRef = useRef(false);
  const cancelScheduledMobileRestoreRef = useRef<(() => void) | null>(null);
  const cancelScheduledMobileRestore = useCallback(() => {
    cancelScheduledMobileRestoreRef.current?.();
    cancelScheduledMobileRestoreRef.current = null;
  }, []);
  const closeMobileMenu = useCallback((openSearch = false) => {
    restoreMobileFocusRef.current = true;
    pendingMobileSearchRef.current = openSearch;
    setOpen(false);
  }, []);

  const [mobileTab, setMobileTab] = useState<'site' | 'docs'>(isDocsPage ? 'docs' : 'site');

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  useEffect(() => {
    const nav = navRef.current;
    const siteContent = document.getElementById('site-content');
    if (nav) nav.inert = open;
    if (siteContent) siteContent.inert = open;
    return () => {
      if (nav) nav.inert = false;
      if (siteContent) siteContent.inert = false;
    };
  }, [open]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeAtDesktop = ({ matches }: Pick<MediaQueryList, 'matches'>) => {
      if (!matches) return;
      restoreMobileFocusRef.current = false;
      pendingMobileSearchRef.current = false;
      cancelScheduledMobileRestore();
      setOpen(false);
    };
    const handleChange = (event: MediaQueryListEvent) => closeAtDesktop(event);
    desktop.addEventListener('change', handleChange);
    closeAtDesktop(desktop);
    return () => desktop.removeEventListener('change', handleChange);
  }, [cancelScheduledMobileRestore]);
  useEffect(() => {
    if (open || !restoreMobileFocusRef.current) return undefined;
    const restoreFocusAndSearch = () => {
      cancelScheduledMobileRestoreRef.current = null;
      if (!restoreMobileFocusRef.current) return;
      restoreMobileFocusRef.current = false;
      mobileTriggerRef.current?.focus();
      if (pendingMobileSearchRef.current) {
        pendingMobileSearchRef.current = false;
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
        );
      }
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(restoreFocusAndSearch);
      cancelScheduledMobileRestoreRef.current = () =>
        window.cancelAnimationFrame(frame);
    } else {
      const timer = window.setTimeout(restoreFocusAndSearch, 0);
      cancelScheduledMobileRestoreRef.current = () => window.clearTimeout(timer);
    }
    return cancelScheduledMobileRestore;
  }, [cancelScheduledMobileRestore, open]);
  useEffect(() => {
    if (!open) return undefined;
    const dialog = mobileDialogRef.current;
    const focusable = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeMobileMenu, open]);

  const trackNavLink = (label: string, href: string, external: boolean, surface: 'nav' | 'mobile_nav') => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const ctaId: `nav_${string}` | `mobile_nav_${string}` =
      surface === 'nav' ? `nav_${slug}` : `mobile_nav_${slug}`;
    if (external) {
      trackExternalLinkClick(href, { surface, cta_id: ctaId, cta_text: label });
      return;
    }
    trackCtaClick({ surface, destination_url: href, cta_id: ctaId, cta_text: label });
  };

  return (
    <>
    <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 nav-bar">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5">
        <Link href="/" className="nav-logo-link">
          <LogoMark size="md" />
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map((l) => l.external ? (
            <a key={l.href} href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackNavLink(l.label, l.href, true, 'nav')}
              className="text-sm font-mono transition-colors nav-link">
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href}
              onClick={() => trackNavLink(l.label, l.href, false, 'nav')}
              className="text-sm font-mono transition-colors nav-link">
              {l.label}
            </Link>
          ))}
          <DemoDropdown />
          <a href="https://github.com/cacheplane/angular-agent-framework"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackExternalLinkClick('https://github.com/cacheplane/angular-agent-framework', {
              surface: 'nav',
              cta_id: 'nav_github',
              cta_text: 'GitHub',
            })}
            className="transition-colors nav-link"
            aria-label="GitHub repository">
            <GitHubIcon />
          </a>
          <Button
            variant="primary"
            size="md"
            href="/contact"
            onClick={() => trackCtaClick({
              surface: 'nav',
              destination_url: '/contact',
              cta_id: 'nav_talk_to_us',
              cta_text: 'Talk to Us',
            })}
          >
            Talk to Us
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          ref={mobileTriggerRef}
          className="lg:hidden inline-flex items-center justify-center nav-hamburger"
          onClick={() => { setOpen(!open); if (!open) setMobileTab(isDocsPage ? 'docs' : 'site'); }}
          aria-expanded={open}
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : 0}
          aria-label="Open menu">
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

    </nav>

    {/* Mobile full-screen overlay — rendered outside nav to avoid stacking context issues */}
    {open && (
      <div
        ref={mobileDialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className="lg:hidden fixed left-0 right-0 bottom-0 nav-mobile-overlay"
      >
          <div className="nav-mobile-overlay-inner">
            <button
              type="button"
              className="nav-mobile-dialog-close"
              aria-label="Close menu"
              onClick={() => closeMobileMenu()}
            >
              <CloseIcon />
            </button>

            {/* Primary tabs — only on docs pages */}
            {isDocsPage && (
              <div className="nav-mtabs">
                <button onClick={() => setMobileTab('site')} className="nav-mtab" data-active={mobileTab === 'site' || undefined}>Site</button>
                <button onClick={() => setMobileTab('docs')} className="nav-mtab" data-active={mobileTab === 'docs' || undefined}>Docs</button>
              </div>
            )}

            {mobileTab === 'docs' && isDocsPage ? (
              <div
                onClickCapture={(event) => {
                  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
                    'a[data-docs-navlink]',
                  );
                  if (!link) return;
                  trackCtaClick({
                    surface: 'mobile_nav',
                    destination_url: link.getAttribute('href') ?? link.href,
                    cta_id: 'mobile_nav_docs_page',
                    cta_text: link.textContent?.trim() ?? 'Docs page',
                    library: toAnalyticsLibrary(docsLibrary),
                  });
                }}
              >
                <DocsContextContent
                  activeLibrary={docsLibrary}
                  activeSection={activeSection || 'getting-started'}
                  activeSlug={activeSlug || 'introduction'}
                  pageTitle={docsPageTitle}
                  mobile
                  onNavigate={() => closeMobileMenu()}
                  onSearchHandoff={() => closeMobileMenu(true)}
                />
              </div>
            ) : null}

            {/* Site content */}
            {(mobileTab === 'site' || !isDocsPage) && (
              <div className="nav-mobile-list">
                {links.map((l) => {
                  const LinkEl = l.external ? 'a' : Link;
                  const extraProps = l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
                  return (
                    <LinkEl key={l.href} href={l.href} {...extraProps}
                      onClick={() => {
                        trackNavLink(l.label, l.href, l.external, 'mobile_nav');
                        closeMobileMenu();
                      }}
                      className="nav-mobile-site-link"
                    >
                      {l.label}
                    </LinkEl>
                  );
                })}
                {DEMOS.map((demo) => (
                  <a key={demo.key} href={demo.href} target="_blank" rel="noopener noreferrer"
                    onClick={() => { trackExternalLinkClick(demo.href, { surface: 'mobile_nav', cta_id: `mobile_nav_demo_${demoCtaSuffix(demo.key)}`, cta_text: demo.label }); closeMobileMenu(); }}
                    className="nav-mobile-site-link">
                    {demo.label}
                  </a>
                ))}
                <a href="https://github.com/cacheplane/angular-agent-framework"
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => {
                    trackExternalLinkClick('https://github.com/cacheplane/angular-agent-framework', {
                      surface: 'mobile_nav',
                      cta_id: 'mobile_nav_github',
                      cta_text: 'GitHub',
                    });
                    closeMobileMenu();
                  }}
                  className="nav-mobile-github-link">
                  <GitHubIcon /> GitHub
                </a>
                <div className="nav-mobile-cta-wrap">
                  <Button
                    variant="primary"
                    size="lg"
                    href="/contact"
                    onClick={() => {
                      trackCtaClick({
                        surface: 'mobile_nav',
                        destination_url: '/contact',
                        cta_id: 'mobile_nav_talk_to_us',
                        cta_text: 'Talk to Us',
                      });
                      closeMobileMenu();
                    }}
                    className="nav-mobile-cta"
                  >
                    Talk to Us
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
    )}
    </>
  );
}
