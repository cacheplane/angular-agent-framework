'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { HERO_ROUTES } from './nav-config';

export type NavSurface = 'transparent' | 'solid';

/**
 * Whether the bar renders over the page or on its own white ground.
 *
 * The trigger is an IntersectionObserver on a sentinel at the top of the
 * document rather than a scroll listener: it is cheaper, and the in-app
 * Browser pane suspends scroll events, so a listener-based version looks
 * broken during local verification when it is not. Either way this state has
 * to be confirmed in a real browser window.
 */
export function useNavSurface(pathname: string): {
  surface: NavSurface;
  sentinelRef: RefObject<HTMLDivElement | null>;
} {
  const isHeroRoute = HERO_ROUTES.includes(pathname);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Starts false so a hero route with no observer renders solid rather than
  // sitting transparent over scrolled content forever.
  const [atTop, setAtTop] = useState(false);

  useEffect(() => {
    if (!isHeroRoute) {
      setAtTop(false);
      return undefined;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver !== 'function') return undefined;

    // Seed synchronously from layout rather than waiting on the observer's
    // first (async) callback. An unconditional optimistic `true` was measured
    // in Chrome to apply `transparent` for a frame whenever a hero route mounts
    // already scrolled — a #hash deep link or back-navigation with scroll
    // restoration — and the rect, which is available immediately, is right in
    // both directions. It also costs a forced layout on mount only, in an
    // effect that already runs after paint.
    setAtTop(sentinel.getBoundingClientRect().bottom > 0);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setAtTop(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isHeroRoute, pathname]);

  return { surface: isHeroRoute && atTop ? 'transparent' : 'solid', sentinelRef };
}
