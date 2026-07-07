// SPDX-License-Identifier: MIT
// Pure, DOM-free display helpers over Citation. Shared by the inline marker,
// the preview card, and the sources panel so provenance rendering stays DRY.
import type { Citation } from './citation';

/** Hostname of `url` with a leading `www.` removed; null if absent/malformed. */
export function deriveDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Explicit `sourceType`, else 'web' inferred from a url, else 'unknown'. */
export function deriveSourceType(c: Citation): string {
  if (c.sourceType) return c.sourceType;
  return c.url ? 'web' : 'unknown';
}

/** Uppercased first letter of the domain (or title) for the monogram chip. */
export function deriveMonogram(c: Citation): string {
  const seed = deriveDomain(c.url) ?? c.title ?? '';
  const ch = seed.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

/** Deterministic hue in [0,360) from a seed string (stable monogram color). */
export function monogramHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

/** Short freshness label (e.g. "Apr 2024"); null when absent or unparseable. */
export function formatPublished(value?: string | number | Date): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

/** Deterministic monogram-chip background color (stable per source). */
export function monogramColor(c: Citation): string {
  const seed = deriveDomain(c.url) ?? c.title ?? '?';
  return `hsl(${monogramHue(seed)} 60% 45%)`;
}

/** Human label for the source-type badge; null when type is 'unknown'. */
export function citationTypeLabel(c: Citation): string | null {
  const t = deriveSourceType(c);
  if (t === 'unknown') return null;
  return t === 'web' ? 'Web' : t.charAt(0).toUpperCase() + t.slice(1);
}
