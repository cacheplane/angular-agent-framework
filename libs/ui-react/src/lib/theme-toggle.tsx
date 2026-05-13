'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cssVars, type Theme } from '@ngaf/design-tokens';
import { useTheme } from './theme-context';

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'light' };

/**
 * Sidebar-footer toggle that flips between light and dark. Cookie is the
 * source of truth, so we:
 *   1. Update `data-theme` and inline `cssVars(next)` on <html> synchronously
 *      for instant visual feedback (this is the "optimistic" update).
 *   2. POST to /api/theme to persist the cookie.
 *   3. Call router.refresh() so RSC re-renders pick up the new theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const next = NEXT[theme];

  const onClick = () => {
    // Optimistic visual swap on the document — the active ThemeProvider
    // value won't update until router.refresh() completes server-side.
    document.documentElement.dataset.theme = next;
    const vars = cssVars(next) as Record<string, string>;
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
    startTransition(() => {
      void fetch('/api/theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      }).then(() => router.refresh());
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={className}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
