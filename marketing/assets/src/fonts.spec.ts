import { describe, expect, it } from 'vitest';
import { loadFonts } from './fonts';

describe('loadFonts', () => {
  it('returns three font entries with expected names + weights', async () => {
    const fonts = await loadFonts();
    expect(fonts).toHaveLength(3);
    const byName = fonts.map((f) => `${f.name}:${f.weight}`);
    expect(byName).toContain('EB Garamond:700');
    expect(byName).toContain('Inter:400');
    expect(byName).toContain('Inter:600');
    for (const f of fonts) {
      expect(f.data.byteLength).toBeGreaterThan(1000);
      expect(f.style).toBe('normal');
    }
  });

  it('memoizes — second call returns the same array reference', async () => {
    const a = await loadFonts();
    const b = await loadFonts();
    expect(a).toBe(b);
  });
});
