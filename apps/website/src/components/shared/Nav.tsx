'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { tokens } from '@cacheplane/design-tokens';
import { docsConfig } from '../../lib/docs-config';

const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
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

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDocsPage = pathname.startsWith('/docs');
  const pathParts = pathname.split('/').filter(Boolean);
  const activeLibrary = isDocsPage && pathParts.length >= 2 ? pathParts[1] : '';
  const activeSection = isDocsPage && pathParts.length >= 3 ? pathParts[2] : '';
  const activeSlug = isDocsPage && pathParts.length >= 4 ? pathParts[3] : '';

  const [mobileTab, setMobileTab] = useState<'site' | 'docs'>(isDocsPage ? 'docs' : 'site');
  const [mobileLibrary, setMobileLibrary] = useState(activeLibrary || 'agent');
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(activeSection ? [activeSection] : []));

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '10px 0',
    fontSize: 15, fontWeight: 500, fontFamily: 'Inter, sans-serif',
    background: active ? tokens.colors.accentSurface : 'transparent',
    color: active ? tokens.colors.accent : tokens.colors.textMuted,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    minHeight: 44,
  });

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '8px 0',
    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
    fontSize: '0.75rem', fontWeight: 600,
    background: active ? tokens.colors.accentSurface : 'transparent',
    color: active ? tokens.colors.accent : tokens.colors.textMuted,
    border: 'none', borderRadius: 6, cursor: 'pointer',
    minHeight: 36,
  });

  const currentLib = docsConfig.find(lib => lib.id === mobileLibrary);

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{
        borderBottom: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        boxShadow: tokens.glass.shadow,
      }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5">
        <Link href="/" className="font-garamond text-xl font-bold" style={{ color: tokens.colors.textPrimary }}>
          Angular Agent Framework
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => l.external ? (
            <a key={l.href} href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono transition-colors"
              style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href}
              className="text-sm font-mono transition-colors"
              style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              {l.label}
            </Link>
          ))}
          <a href="https://github.com/cacheplane/angular"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: tokens.colors.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}
            aria-label="GitHub repository">
            <GitHubIcon />
          </a>
          <Link href="/pilot-to-prod#whitepaper-gate"
            className="px-4 py-2 text-sm font-mono rounded transition-all"
            style={{ background: tokens.colors.accent, color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => { setOpen(!open); if (!open) setMobileTab(isDocsPage ? 'docs' : 'site'); }}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{ color: tokens.colors.textPrimary }}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

    </nav>

    {/* Mobile full-screen overlay — rendered outside nav to avoid stacking context issues */}
    {open && (
      <div className="md:hidden fixed left-0 right-0 bottom-0"
        style={{
          top: 65,
          zIndex: 9999,
          background: 'rgba(255,255,255,0.98)',
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>

            {/* Primary tabs — only on docs pages */}
            {isDocsPage && (
              <div style={{ display: 'flex', gap: 6, padding: '4px', background: 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
                <button onClick={() => setMobileTab('site')} style={tabStyle(mobileTab === 'site')}>Site</button>
                <button onClick={() => setMobileTab('docs')} style={tabStyle(mobileTab === 'docs')}>Docs</button>
              </div>
            )}

            {/* Library sub-tabs — only when Docs tab active */}
            {isDocsPage && mobileTab === 'docs' && (
              <div style={{ display: 'flex', gap: 4, padding: '3px', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                {docsConfig.map(lib => (
                  <button key={lib.id} onClick={() => setMobileLibrary(lib.id)} style={subTabStyle(mobileLibrary === lib.id)}>
                    {lib.title}
                  </button>
                ))}
              </div>
            )}

            {/* Docs content */}
            {(mobileTab === 'docs' && isDocsPage && currentLib) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {currentLib.sections.map((section) => {
                  const headerColor = section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent;
                  return (
                    <div key={section.id}>
                      <button
                        onClick={() => toggleSection(section.id)}
                        style={{
                          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 4px', minHeight: 44,
                        }}
                      >
                        <span style={{
                          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: headerColor,
                        }}>
                          {section.title}
                        </span>
                        <span style={{
                          color: tokens.colors.textMuted, fontSize: 10,
                          transition: 'transform 0.2s',
                          transform: openSections.has(section.id) ? 'rotate(0)' : 'rotate(-90deg)',
                        }}>
                          &#9662;
                        </span>
                      </button>
                      {openSections.has(section.id) && (
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {section.pages.map((page) => {
                            const isActive = page.section === activeSection && page.slug === activeSlug && mobileLibrary === activeLibrary;
                            return (
                              <Link
                                key={`${currentLib.id}/${page.section}/${page.slug}`}
                                href={`/docs/${currentLib.id}/${page.section}/${page.slug}`}
                                onClick={() => setOpen(false)}
                                style={{
                                  display: 'block', padding: '12px 14px', borderRadius: 8,
                                  fontSize: 16, lineHeight: '24px', minHeight: 44,
                                  color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                                  background: isActive ? tokens.colors.accentSurface : 'transparent',
                                  textDecoration: 'none', fontFamily: 'Inter, sans-serif',
                                }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {links.map((l) => {
                  const LinkEl = l.external ? 'a' : Link;
                  const extraProps = l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
                  return (
                    <LinkEl key={l.href} href={l.href} {...extraProps}
                      onClick={() => setOpen(false)}
                      style={{
                        display: 'block', padding: '14px 14px', borderRadius: 8,
                        fontSize: 16, lineHeight: '24px', minHeight: 48,
                        color: tokens.colors.textSecondary, textDecoration: 'none',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {l.label}
                    </LinkEl>
                  );
                })}
                <a href="https://github.com/cacheplane/angular"
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 14px', borderRadius: 8, minHeight: 48,
                    color: tokens.colors.textSecondary, textDecoration: 'none',
                    fontFamily: 'Inter, sans-serif', fontSize: 16,
                  }}>
                  <GitHubIcon /> GitHub
                </a>
                <div style={{ marginTop: 8 }}>
                  <Link href="/pilot-to-prod#whitepaper-gate"
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'block', textAlign: 'center',
                      padding: '14px 24px', borderRadius: 8,
                      background: tokens.colors.accent, color: '#fff',
                      fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600,
                      textDecoration: 'none', minHeight: 48,
                    }}>
                    Get Started
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
    )}
    </>
  );
}
