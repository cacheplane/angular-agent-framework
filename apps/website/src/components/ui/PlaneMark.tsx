import type { SVGProps } from 'react';

/**
 * The Threadplane glyph: a paper plane, drawn once and shared.
 *
 * It replaces the 🛩️ emoji the wordmark used to render. An emoji is a
 * different picture on every platform — Apple's is a shaded propeller plane,
 * Google's a blue jet — so the brand had no stable mark at all, and the social
 * card, the nav and the favicon each showed whatever the viewer's font
 * happened to hold. This ships as a path so all three agree.
 *
 * Filled with `currentColor`, so it takes the wordmark's own color and needs
 * no dark-mode variant. The square app-icon form (navy field, knocked-out
 * glyph) lives in `src/app/icon.svg`, which browsers request as the favicon.
 */
export function PlaneMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M4 34.5 58 6 40 58l-11.5-16.5L36 22 20 37.5z" fill="currentColor" />
    </svg>
  );
}
