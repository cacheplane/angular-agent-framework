'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const links = [
  { label: 'Docs', href: '/docs' },
  { label: 'API', href: '/api-reference' },
  { label: 'Pricing', href: '/pricing' },
];

export function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
      style={{
        borderBottom: '1px solid var(--color-accent-border)',
        background: 'rgba(8,11,20,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Link
        href="/"
        className="font-bold text-xl"
        style={{ fontFamily: 'var(--font-garamond)', color: 'var(--color-text-primary)' }}
      >
        StreamResource
      </Link>
      <div className="flex items-center gap-8">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-mono transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {l.label}
          </Link>
        ))}
        <Button asChild size="default">
          <Link href="/pricing">Get Started</Link>
        </Button>
      </div>
    </nav>
  );
}
