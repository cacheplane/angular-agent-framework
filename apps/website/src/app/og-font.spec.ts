import { describe, expect, it } from 'vitest';
import { satoriFonts, type OgFont } from './og-font';

const FONT: OgFont = {
  name: 'Archivo Black',
  data: new ArrayBuffer(8),
  weight: 400,
  style: 'normal',
};

describe('satoriFonts', () => {
  it('drops the fonts that failed to load', () => {
    expect(satoriFonts([FONT, null, { ...FONT, name: 'JetBrains Mono', weight: 700 }])).toEqual([
      FONT,
      { ...FONT, name: 'JetBrains Mono', weight: 700 },
    ]);
  });

  it('returns undefined rather than an empty list when every font fails', () => {
    // Satori throws on `fonts: []`, which would 500 the whole route. Omitting
    // the option lets next/og fall back to its bundled Noto Sans, so a card
    // still renders when the TTF is missing and Google Fonts is unreachable.
    expect(satoriFonts([])).toBeUndefined();
    expect(satoriFonts([null, null])).toBeUndefined();
  });
});
