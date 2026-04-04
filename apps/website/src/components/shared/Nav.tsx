'use client';
import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';

const links = [
  { label: 'Docs', href: '/docs' },
  { label: 'API', href: '/api-reference' },
  { label: 'Pricing', href: '/pricing' },
];

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
      style={{
        borderBottom: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        boxShadow: tokens.glass.shadow,
      }}>
      <Link href="/" className="font-garamond text-xl font-bold" style={{ color: tokens.colors.textPrimary }}>
        StreamResource
      </Link>
      <div className="flex items-center gap-8">
        {links.map((l) => (
          <Link key={l.href} href={l.href}
            className="text-sm font-mono transition-colors"
            style={{ color: tokens.colors.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
            {l.label}
          </Link>
        ))}
        <Link href="/pricing"
          className="px-4 py-2 text-sm font-mono rounded transition-all"
          style={{ background: tokens.colors.accent, color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
          Get Started
        </Link>
      </div>
    </nav>
  );
}
