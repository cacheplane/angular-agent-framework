'use client';
import { usePathname } from 'next/navigation';
import { Footer } from './Footer';

/**
 * Route gate for the marketing footer.
 *
 * The footer is mounted once in the root layout, so every route gets it unless
 * something opts out here. The docs tree opts out: every /docs route renders
 * the sidebar control plane and ends at its own prev/next rail, and a marketing
 * footer bolted under that column breaks the single-pane reading experience.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === '/docs' || pathname?.startsWith('/docs/')) return null;
  return <Footer />;
}
