'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M0 0v16h16V0H0zm13 13H8V5h2.5v5.5H13V5h-1V3H3v10h10V0H0v16h16V0H0z" opacity="0" />
      <path d="M0 0v16h16V0H0zm13 13h-2.5V5.5H8V13H3V3h10v10z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="px-6 md:px-8 py-16 mt-24"
      style={{
        borderTop: `1px solid ${tokens.glass.border}`,
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}>
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}>

        {/* Top section: brand + columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <p className="font-garamond text-xl font-bold mb-2" style={{ color: tokens.colors.textPrimary }}>Angular Stream Resource</p>
            <p className="text-sm mb-4" style={{ color: tokens.colors.textMuted, maxWidth: '36ch', lineHeight: 1.6 }}>
              The enterprise streaming resource for LangChain and Angular. Signal-native streaming built for production Angular 20+.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-4">
              <a href="https://github.com/cacheplane/stream-resource"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: tokens.colors.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}
                aria-label="GitHub">
                <GitHubIcon />
              </a>
              <a href="https://www.npmjs.com/package/@cacheplane/stream-resource"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: tokens.colors.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}
                aria-label="npm">
                <NpmIcon />
              </a>
            </div>
          </div>

          {/* Product column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: tokens.colors.accent }}>Product</span>
            <Link href="/docs" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Documentation
            </Link>
            <Link href="/docs/api/stream-resource" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              API Reference
            </Link>
            <a href="https://cockpit.stream-resource.dev" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Examples
            </a>
            <Link href="/pricing" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Pricing
            </Link>
            <a href="https://github.com/cacheplane/stream-resource"
              target="_blank" rel="noopener noreferrer"
              className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              GitHub
            </a>
          </div>

          {/* Resources column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: tokens.colors.accent }}>Resources</span>
            <Link href="/docs" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Getting Started
            </Link>
            <a href="https://www.npmjs.com/package/@cacheplane/stream-resource"
              target="_blank" rel="noopener noreferrer"
              className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              npm Package
            </a>
            <Link href="/pricing" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Commercial License
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
          style={{ borderTop: `1px solid ${tokens.glass.border}`, color: tokens.colors.textMuted }}>
          <span>&copy; {new Date().getFullYear()} Angular Stream Resource. All rights reserved.</span>
          <span>PolyForm Noncommercial 1.0.0 &middot; <Link href="/pricing" className="transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}>Commercial License</Link></span>
        </div>
      </motion.div>
    </footer>
  );
}
