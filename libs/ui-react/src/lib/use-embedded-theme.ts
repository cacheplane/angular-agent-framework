'use client';

import { useEffect, useState } from 'react';
import type { Theme } from '@ngaf/design-tokens';

/**
 * Hook for the embedded app inside a `<ThemedFrame>`. Returns the current
 * host theme, defaulting to `'dark'` until the first `ngaf:theme` message
 * arrives. On mount, posts an `ngaf:theme-request` to `window.parent` so
 * the host replies even if its broadcaster ran before the iframe mounted.
 *
 * Apply the returned value as `data-theme` on `<html>` (and inline
 * `cssVars(theme)` if the embedded app uses our token system).
 */
export function useEmbeddedTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ngaf:theme') {
        const next = e.data.theme;
        if (next === 'light' || next === 'dark') {
          setTheme(next);
        }
      }
    };
    window.addEventListener('message', handler);
    // Handshake: ask the parent for the current theme in case we mounted
    // after its first broadcast.
    window.parent?.postMessage({ type: 'ngaf:theme-request' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  return theme;
}
