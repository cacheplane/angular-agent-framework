'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';

export function LiveDemoFrame() {
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
      <BrowserFrame url="demo.threadplane.ai" elevation="lg">
        {shouldLoad ? (
          <iframe
            src="https://demo.threadplane.ai"
            title="Canonical demo — @ngaf/chat running against the shared LangGraph backend"
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
            Loading demo…
          </div>
        )}
      </BrowserFrame>
    </div>
  );
}
