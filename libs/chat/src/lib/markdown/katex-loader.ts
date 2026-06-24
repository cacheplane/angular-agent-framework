// libs/chat/src/lib/markdown/katex-loader.ts
// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';

/**
 * Lazy KaTeX integration for the markdown math view. Mirrors the lazy `marked`
 * loader in ../streaming/markdown-render.ts: `katex` is an optional peer
 * dependency, dynamically imported on module load, so chats that never contain
 * math pay zero base-bundle cost. `renderMath` returns the KaTeX HTML string,
 * or null when KaTeX is unavailable or the LaTeX is invalid — the view then
 * renders the raw `$…$` source instead.
 *
 * CSS: the KaTeX stylesheet (and its woff2 fonts) is the CONSUMER's
 * responsibility — this lib injects nothing at runtime (no third-party CDN
 * fetch). Apps import `katex/dist/katex.min.css` themselves; math still renders
 * without it, just unstyled.
 */

let katexRender: ((latex: string, displayMode: boolean) => string) | null = null;

/**
 * Flips to true once KaTeX has loaded. The math view reads it as a signal
 * dependency so any math that fell back to raw source while KaTeX was still
 * loading re-renders once it becomes available.
 */
export const katexReady = signal(false);

/** Resolves once the KaTeX import has settled (success or failure). Tests await this. */
export const katexLoaded: Promise<void> = import('katex')
  .then((m) => {
    const katex = ((m as { default?: unknown }).default ?? m) as {
      renderToString: (latex: string, options: object) => string;
    };
    katexRender = (latex, displayMode) =>
      // throwOnError:true so invalid LaTeX throws → we catch → raw-source
      // fallback, instead of KaTeX emitting its own red error markup.
      katex.renderToString(latex, { displayMode, throwOnError: true });
    katexReady.set(true);
  })
  .catch(() => {
    katexRender = null;
  });

/**
 * Render LaTeX to a KaTeX HTML string, or null if KaTeX is unavailable or the
 * input throws (invalid LaTeX) — the caller then renders the raw `$…$` source.
 */
export function renderMath(latex: string, displayMode: boolean): string | null {
  if (!katexRender) return null;
  try {
    return katexRender(latex, displayMode);
  } catch {
    return null;
  }
}
