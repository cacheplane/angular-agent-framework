import { describe, it, expect } from 'vitest';
import { cssVars } from './css-vars';

describe('cssVars(theme)', () => {
  describe('light', () => {
    const vars = cssVars('light');

    it('uses light canvas color', () => {
      expect(vars['--ds-canvas']).toBe('#fafbfc');
    });

    it('uses navy accent', () => {
      expect(vars['--ds-accent']).toBe('#004090');
    });

    it('uses dark text on light surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#1a1a2e');
    });
  });

  describe('dark', () => {
    const vars = cssVars('dark');

    it('uses dark canvas color', () => {
      expect(vars['--ds-canvas']).toBe('#0e1117');
    });

    it('uses bright-blue accent', () => {
      expect(vars['--ds-accent']).toBe('#64C3FD');
    });

    it('uses near-white text on dark surfaces', () => {
      expect(vars['--ds-text-primary']).toBe('#e8e9eb');
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
