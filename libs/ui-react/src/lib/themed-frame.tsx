'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type IframeHTMLAttributes,
} from 'react';
import { useTheme } from './theme-context';

export type ThemedFrameProps = IframeHTMLAttributes<HTMLIFrameElement>;

/**
 * Drop-in replacement for `<iframe>` that pushes the current host theme
 * to its child via `postMessage`. The embedded app opts in by calling
 * `useEmbeddedTheme()` from this package.
 *
 * Each ThemedFrame owns its own postMessage lifecycle — there is no
 * global broadcaster or DOM-querying. Multiple frames coexist cleanly
 * because handshake replies are scoped to `e.source === this iframe's
 * contentWindow`.
 */
export const ThemedFrame = forwardRef<HTMLIFrameElement, ThemedFrameProps>(
  function ThemedFrame(props, externalRef) {
    const theme = useTheme();
    const ref = useRef<HTMLIFrameElement>(null);
    useImperativeHandle(externalRef, () => ref.current as HTMLIFrameElement);

    // Push the current theme on mount and whenever it changes.
    useEffect(() => {
      ref.current?.contentWindow?.postMessage(
        { type: 'ngaf:theme', theme },
        '*',
      );
    }, [theme]);

    // Reply to handshake requests from this specific frame.
    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (e.source !== ref.current?.contentWindow) return;
        if (e.data?.type === 'ngaf:theme-request') {
          ref.current?.contentWindow?.postMessage(
            { type: 'ngaf:theme', theme },
            '*',
          );
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [theme]);

    return <iframe ref={ref} {...props} />;
  },
);
