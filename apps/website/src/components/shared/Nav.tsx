'use client';
import { useState } from 'react';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

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

  return (
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
          🛩️ Angular Agent Framework
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
          <a href="https://github.com/cacheplane/stream-resource"
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
          className="flex md:hidden items-center justify-center"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{ color: tokens.colors.textPrimary, minWidth: 44, minHeight: 44 }}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-6 pb-5 flex flex-col gap-4"
          style={{ borderTop: `1px solid ${tokens.glass.border}` }}>
          {links.map((l) => l.external ? (
            <a key={l.href} href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="text-sm font-mono py-1"
              style={{ color: tokens.colors.textSecondary }}>
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-mono py-1"
              style={{ color: tokens.colors.textSecondary }}>
              {l.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-2">
            <a href="https://github.com/cacheplane/stream-resource"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: tokens.colors.textSecondary }}
              aria-label="GitHub repository">
              <GitHubIcon />
            </a>
            <Link href="/pilot-to-prod#whitepaper-gate"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-mono rounded"
              style={{ background: tokens.colors.accent, color: '#fff' }}>
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
