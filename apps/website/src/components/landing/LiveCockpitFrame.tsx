'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';

export function LiveCockpitFrame() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!ref.current || shouldLoad) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={ref}>
      <BrowserFrame url="cockpit.cacheplane.ai" elevation="lg">
        {shouldLoad ? (
          <iframe
            src="https://cockpit.cacheplane.ai"
            title="Cockpit — Angular Agent Framework reference app"
            loading="lazy"
            style={{
              width: '100%',
              height: 480,
              border: 'none',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              height: 480,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tokens.surfaces.surfaceTinted,
              color: tokens.colors.textMuted,
              fontFamily: tokens.typography.fontMono,
              fontSize: 13,
            }}
          >
            Loading live demo…
          </div>
        )}
      </BrowserFrame>
    </div>
  );
}
