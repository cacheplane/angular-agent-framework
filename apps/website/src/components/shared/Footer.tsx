import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';

export function Footer() {
  return (
    <footer className="px-6 md:px-8 py-12 mt-24"
      style={{
        borderTop: `1px solid ${tokens.glass.border}`,
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
        <div>
          <p className="font-garamond text-lg font-bold" style={{ color: tokens.colors.textPrimary }}>StreamResource</p>
          <p className="text-sm mt-1" style={{ color: tokens.colors.textMuted }}>The Enterprise Streaming Resource for LangChain and Angular</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase" style={{ color: tokens.colors.accent }}>Product</span>
            <Link href="/docs" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>Docs</Link>
            <Link href="/api-reference" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>API Reference</Link>
            <Link href="/pricing" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>Pricing</Link>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
        style={{ borderTop: `1px solid ${tokens.glass.border}`, color: tokens.colors.textMuted }}>
        <span>&copy; {new Date().getFullYear()} StreamResource. All rights reserved.</span>
        <span>PolyForm Noncommercial 1.0.0 &middot; <Link href="/pricing" className="transition-colors">Commercial License</Link></span>
      </div>
    </footer>
  );
}
