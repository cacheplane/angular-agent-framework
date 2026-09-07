/**
 * Font types and helpers shared by the `opengraph-image` routes.
 *
 * The faces themselves are bundled and read by `./card/fonts`, which is
 * colocated with the TTFs so Next's file tracer can resolve them. This module
 * keeps only the types, the Satori guard rails, and the optional Google Fonts
 * fetch for a face we do not bundle.
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
 * Loads the shared card font set: Garamond for display type, Inter for body,
 * and JetBrains Mono for the eyebrow and pills.
 *
 * All four are bundled (see `./card/fonts`). They used to be fetched from
 * Google Fonts on every render, which is a network round trip inside an image
 * render that fails silently: the card simply came out in whichever faces
 * happened to load. A card specified with a mono eyebrow rendered in serif
 * that way. `loadGoogleFont` is kept for callers that want a face we do not
 * bundle, but no card depends on it.
 *
 * Returns `undefined` (not `[]`) when nothing loaded — see `satoriFonts`.
 */
export async function loadCardFonts(options: { mono?: boolean } = {}): Promise<OgFont[] | undefined> {
  const { readGaramondBold, readInterRegular, readInterSemiBold, readMonoBold, toFont } = await import(
    './card/fonts'
  );
  const [garamond, interRegular, interSemiBold, mono] = await Promise.all([
    readGaramondBold(),
    readInterRegular(),
    readInterSemiBold(),
    options.mono ? readMonoBold() : Promise.resolve(null),
  ]);
  return satoriFonts([
    toFont('EB Garamond', 700, garamond),
    toFont('Inter', 400, interRegular),
    toFont('Inter', 600, interSemiBold),
    toFont('JetBrains Mono', 700, mono),
  ]);
}
