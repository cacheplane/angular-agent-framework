'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tokens } from '@threadplane/design-tokens';
import { docsConfig, specialDocsPages } from '../../lib/docs-config';
import { trackCtaClick, trackExternalLinkClick } from '../../lib/analytics/client';
import { LogoMark } from '../ui/LogoMark';
import { Button } from '../ui/Button';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';

const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Pricing', href: '/pricing', external: false },
  { label: 'Examples', href: 'https://cockpit.threadplane.ai', external: true },
];

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
  const initialMobileLibrary = docsConfig.find((lib) => lib.id === activeLibrary)?.id ?? 'langgraph';

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
  const [mobileLibrary, setMobileLibrary] = useState(initialMobileLibrary);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(activeSection ? [activeSection] : []));

  useEffect(() => {
    const nextLibrary = docsConfig.find((lib) => lib.id === activeLibrary)?.id;
    if (nextLibrary) setMobileLibrary(nextLibrary);
  }, [activeLibrary]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const currentLib = docsConfig.find(lib => lib.id === mobileLibrary);
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
    <nav className="fixed top-0 left-0 right-0 z-50 nav-bar">
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
          className="lg:hidden inline-flex items-center justify-center nav-hamburger"
          onClick={() => { setOpen(!open); if (!open) setMobileTab(isDocsPage ? 'docs' : 'site'); }}
          aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

    </nav>

    {/* Mobile full-screen overlay — rendered outside nav to avoid stacking context issues */}
    {open && (
      <div className="lg:hidden fixed left-0 right-0 bottom-0 nav-mobile-overlay">
          <div className="nav-mobile-overlay-inner">

            {/* Primary tabs — only on docs pages */}
            {isDocsPage && (
              <div className="nav-mtabs">
                <button onClick={() => setMobileTab('site')} className="nav-mtab" data-active={mobileTab === 'site' || undefined}>Site</button>
                <button onClick={() => setMobileTab('docs')} className="nav-mtab" data-active={mobileTab === 'docs' || undefined}>Docs</button>
              </div>
            )}

            {/* Library sub-tabs — only when Docs tab active */}
            {isDocsPage && mobileTab === 'docs' && (
              <div className="nav-msubtabs-wrap">
                <div className="nav-mobile-list">
                  {specialDocsPages.map((page) => {
                    const isActive = pathname === page.path;
                    return (
                      <Link
                        key={page.path}
                        href={page.path}
                        onClick={() => {
                          trackCtaClick({
                            surface: 'mobile_nav',
                            destination_url: page.path,
                            cta_id: 'mobile_nav_docs_page',
                            cta_text: page.title,
                            library: 'unknown',
                          });
                          setOpen(false);
                        }}
                        className="nav-mobile-item nav-mobile-item--strong"
                        data-active={isActive || undefined}
                      >
                        {page.title}
                      </Link>
                    );
                  })}
                </div>
                <div className="nav-msubtabs">
                  {docsConfig.map(lib => (
                    <button key={lib.id} onClick={() => setMobileLibrary(lib.id)} className="nav-msubtab" data-active={mobileLibrary === lib.id || undefined}>
                      {lib.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Docs content */}
            {(mobileTab === 'docs' && isDocsPage && currentLib) && (
              <div className="nav-mobile-content-list">
                {currentLib.demoUrl && (
                  <a href={currentLib.demoUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => {
                      const demoUrl = currentLib.demoUrl;
                      if (!demoUrl) return;
                      trackExternalLinkClick(demoUrl, { surface: 'mobile_nav', cta_id: `mobile_nav_docs_demo_${currentLib.id}`, cta_text: currentLib.demoLabel ?? 'Live demo' });
                      setOpen(false);
                    }}
                    className="nav-mobile-demo-link">
                    <span>{currentLib.demoLabel ?? 'Live demo'}</span><span aria-hidden="true">↗</span>
                  </a>
                )}
                {currentLib.sections.map((section) => {
                  return (
                    <div key={section.id}>
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="nav-mobile-section-toggle"
                      >
                        {section.title}
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={tokens.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="nav-mobile-chevron" data-open={openSections.has(section.id) || undefined}>
                          <path d="M5 7.5l5 5 5-5" />
                        </svg>
                      </button>
                      {openSections.has(section.id) && (
                        <nav className="nav-mobile-list">
                          {section.pages.map((page) => {
                            const isActive = page.section === activeSection && page.slug === activeSlug && mobileLibrary === activeLibrary;
                            return (
                              <Link
                                key={`${currentLib.id}/${page.section}/${page.slug}`}
                                href={`/docs/${currentLib.id}/${page.section}/${page.slug}`}
                                onClick={() => {
                                  trackCtaClick({
                                    surface: 'mobile_nav',
                                    destination_url: `/docs/${currentLib.id}/${page.section}/${page.slug}`,
                                    cta_id: 'mobile_nav_docs_page',
                                    cta_text: page.title,
                                    library: currentLib.id === 'langgraph' || currentLib.id === 'render' || currentLib.id === 'chat' || currentLib.id === 'ag-ui' ? currentLib.id : 'unknown',
                                  });
                                  setOpen(false);
                                }}
                                className="nav-mobile-item"
                                data-active={isActive || undefined}
                              >
                                {page.title}
                              </Link>
                            );
                          })}
                        </nav>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

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
                        setOpen(false);
                      }}
                      className="nav-mobile-site-link"
                    >
                      {l.label}
                    </LinkEl>
                  );
                })}
                {DEMOS.map((demo) => (
                  <a key={demo.key} href={demo.href} target="_blank" rel="noopener noreferrer"
                    onClick={() => { trackExternalLinkClick(demo.href, { surface: 'mobile_nav', cta_id: `mobile_nav_demo_${demoCtaSuffix(demo.key)}`, cta_text: demo.label }); setOpen(false); }}
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
                    setOpen(false);
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
                      setOpen(false);
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
