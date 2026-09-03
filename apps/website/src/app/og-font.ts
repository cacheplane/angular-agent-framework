/**
 * Shared font loading for the `opengraph-image` routes.
 *
 * This module lives next to `EBGaramond-Bold.ttf` on purpose. Next's file
 * tracer (`@vercel/nft`) statically evaluates `join(dirname(fileURLToPath(
 * import.meta.url)), 'EBGaramond-Bold.ttf')` and adds the TTF to the traced
 * bundle of every route that reaches this code. It does *not* resolve a
 * parent-traversal form like `join(here, '../../EBGaramond-Bold.ttf')`, which
 * is how `blog/[slug]/opengraph-image.tsx` used to read the font: locally the
 * source tree is on disk so it worked, but the deployed serverless function
 * never received the file. Keeping the read in one colocated module means the
 * traversal never has to be written again.
 *
 * EB Garamond is bundled as a static-weight TTF rather than fetched because:
 * 1. Google Fonts only serves Garamond as woff2 — Satori can't decode woff2.
 * 2. The variable-weight TTF in Google's fonts repo trips Satori's TTF parser
 *    ("Cannot read properties of undefined (reading '256')") on variable-font
 *    tables (fvar/STAT/MVAR/HVAR).
 *
 * The committed TTF was produced by instancing the upstream variable font to
 * wght=700 and stripping the now-unused variable tables — see
 * apps/website/scripts/instance-garamond.py. The file is ~500KB, served only
 * from this server-side render path (never downloaded by browsers).
 */

/** The CSS weight domain Satori accepts — wider than the weights we ship. */
export type OgFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  /** Satori matches the closest available weight. */
  weight: OgFontWeight;
  style: 'normal';
}

/**
 * Reads the bundled Garamond TTF. Returns null (never throws) if the file is
 * missing so a card without the serif headline still renders.
 */
export async function loadLocalGaramond(): Promise<ArrayBuffer | null> {
  try {
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    // Keep this a bare sibling filename — see the module comment above.
    const buf = await readFile(join(here, 'EBGaramond-Bold.ttf'));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err) {
    console.warn('og-font: failed to load bundled Garamond TTF', err);
    return null;
  }
}

/**
 * Best-effort Google Fonts fetch. Purely decorative: every caller must stay
 * renderable when this returns null, because nothing guarantees the render
 * environment can reach fonts.googleapis.com.
 */
export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } },
    ).then((res) => res.text());
    // Grab any url(...) src — the first one is the woff2 the modern UA gets.
    const match = css.match(/src:\s*url\((https?:\/\/[^)]+)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Drops the fonts that failed to load.
 *
 * Returns `undefined` — not `[]` — when nothing loaded. Satori throws on an
 * empty font list (a 500 for the whole route); omitting the option entirely
 * makes `next/og` fall back to its own bundled Noto Sans, so the card is ugly
 * but still a valid PNG.
 */
export function satoriFonts(candidates: (OgFont | null)[]): OgFont[] | undefined {
  const fonts = candidates.filter((f): f is OgFont => f !== null);
  return fonts.length > 0 ? fonts : undefined;
}

/**
 * Loads the shared card font set: bundled Garamond for headlines, Inter for
 * body copy, and optionally JetBrains Mono for the eyebrow/pill lettering.
 *
 * Every load is best-effort, so this returns `undefined` (not `[]`) when the
 * TTF is missing *and* Google Fonts is unreachable — see `satoriFonts`.
 */
export async function loadCardFonts(options: { mono?: boolean } = {}): Promise<OgFont[] | undefined> {
  const [garamondBold, interRegular, interBold, monoBold] = await Promise.all([
    loadLocalGaramond(),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
    options.mono ? loadGoogleFont('JetBrains+Mono', 700) : Promise.resolve(null),
  ]);
  return satoriFonts([
    garamondBold && { name: 'EB Garamond', data: garamondBold, weight: 700, style: 'normal' },
    interRegular && { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
    interBold && { name: 'Inter', data: interBold, weight: 600, style: 'normal' },
    monoBold && { name: 'JetBrains Mono', data: monoBold, weight: 700, style: 'normal' },
  ]);
}
