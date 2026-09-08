import { describe, it, expect } from 'vitest';
import { cssVars } from './css-vars';
import { baseTokens } from './base';

describe('cssVars(theme)', () => {
  describe('light', () => {
    const vars = cssVars('light');

    it('uses light canvas color', () => {
      expect(vars['--ds-canvas']).toBe('rgb(255, 255, 255)');
    });

    it('uses scope-navy accent as the interactive ink', () => {
      expect(vars['--ds-accent']).toBe('#15253E');
    });

    it('uses near-black text on light surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#0A0A0A');
    });

    it('exposes aviation yellow as a fill-only signal, not as the ink', () => {
      expect(vars['--ds-accent-light']).toBe('#FFAF00');
      expect(vars['--ds-accent']).not.toBe(baseTokens.brand.accentLight);
    });
  });

  describe('dark', () => {
    const vars = cssVars('dark');

    it('uses dark canvas color', () => {
      expect(vars['--ds-canvas']).toBe('rgb(17, 17, 17)');
    });

    it('uses aviation yellow as the dark-theme accent', () => {
      expect(vars['--ds-accent']).toBe('#FFAF00');
    });

    it('uses near-white text on dark surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('rgb(245, 245, 245)');
    });

    it('derives every accent tint from the accent hue', () => {
      const hex = baseTokens.brand.accentLight.replace('#', '');
      const triple = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
      for (const key of [
        '--ds-accent-glow',
        '--ds-accent-border',
        '--ds-accent-border-hover',
        '--ds-accent-surface',
      ] as const) {
        expect(vars[key]).toContain(triple);
      }
    });
  });

  it('both themes expose the same custom-property keys', () => {
    const lightKeys = Object.keys(cssVars('light')).sort();
    const darkKeys = Object.keys(cssVars('dark')).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('brand colors are identical across themes', () => {
    expect(cssVars('light')['--ds-angular-red']).toBe(cssVars('dark')['--ds-angular-red']);
    expect(cssVars('light')['--ds-render-green']).toBe(cssVars('dark')['--ds-render-green']);
    expect(cssVars('light')['--ds-chat-purple']).toBe(cssVars('dark')['--ds-chat-purple']);
  });

  it('typography tokens are identical across themes', () => {
    expect(cssVars('light')['--ds-font-serif']).toBe(cssVars('dark')['--ds-font-serif']);
    expect(cssVars('light')['--ds-font-sans']).toBe(cssVars('dark')['--ds-font-sans']);
  });
});
