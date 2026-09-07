/**
 * Reads the bundled card fonts off disk.
 *
 * This module lives in the same directory as the TTFs on purpose. Next's file
 * tracer (`@vercel/nft`) statically evaluates
 * `join(dirname(fileURLToPath(import.meta.url)), 'Name.ttf')` and adds the
 * file to the traced bundle of every route that reaches this code. It does
 * *not* resolve a parent-traversal form, and it cannot resolve a name built
 * from a variable — which is why each face below is read by its own function
 * with a literal filename rather than through a loop over a list.
 *
 * The files are produced by `scripts/build-card-fonts.py`: instanced to a
 * single weight, stripped of variable tables Satori cannot parse, and subset
 * to Latin plus the punctuation the site uses.
 */
import type { OgFont, OgFontWeight } from '../../og-font';

async function readSibling(name: string): Promise<ArrayBuffer | null> {
  try {
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const buf = await readFile(join(dirname(fileURLToPath(import.meta.url)), name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err) {
    console.warn(`card/fonts: failed to load ${name}`, err);
    return null;
  }
}

/* Each call passes a literal, so the tracer sees four concrete filenames. */
export const readGaramondBold = () => readSibling('EBGaramond-Bold.ttf');
export const readInterRegular = () => readSibling('Inter-Regular.ttf');
export const readInterSemiBold = () => readSibling('Inter-SemiBold.ttf');
export const readMonoBold = () => readSibling('JetBrainsMono-Bold.ttf');

export function toFont(
  name: string,
  weight: OgFontWeight,
  data: ArrayBuffer | null,
): OgFont | null {
  return data ? { name, data, weight, style: 'normal' } : null;
}
