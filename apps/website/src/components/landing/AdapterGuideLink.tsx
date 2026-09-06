'use client';

import Link from 'next/link';
import { trackCtaClick } from '../../lib/analytics/client';

/**
 * Runtime parity's "Choose an adapter" link. Split out of RuntimeParity (a
 * server component) so the click can fire `home_adapter_guide` — a bare
 * `data-cta` attribute on a server-rendered `<Link>` has no handler wired to
 * it and never tracks.
 */
export function AdapterGuideLink({ className = 'parity-cta' }: { className?: string }) {
  return (
    <Link
      href="/docs/choosing-an-adapter"
      className={className}
      data-cta="home_adapter_guide"
      onClick={() =>
        trackCtaClick({
          cta_id: 'home_adapter_guide',
          track: 'developer',
          surface: 'home',
          destination_url: '/docs/choosing-an-adapter',
        })
      }
    >
      Choose an adapter →
    </Link>
  );
}
