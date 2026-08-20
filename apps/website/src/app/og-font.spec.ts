// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { satoriFonts, type OgFont } from './og-font';

const FONT: OgFont = {
  name: 'EB Garamond',
  data: new ArrayBuffer(8),
  weight: 700,
  style: 'normal',
};

describe('satoriFonts', () => {
  it('drops the fonts that failed to load', () => {
    expect(satoriFonts([FONT, null, { ...FONT, name: 'Inter', weight: 400 }])).toEqual([
      FONT,
      { ...FONT, name: 'Inter', weight: 400 },
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
