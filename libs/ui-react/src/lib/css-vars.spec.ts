import { describe, expect, it } from 'vitest';
import { cssVars } from './css-vars';

describe('cssVars', () => {
  describe('Phase 1 token namespaces', () => {
    it('exposes surfaces', () => {
      expect(cssVars['--ds-canvas']).toBe('#fafbfc');
      expect(cssVars['--ds-surface']).toBe('#ffffff');
      expect(cssVars['--ds-surface-tinted']).toBe('#f4f6fb');
      expect(cssVars['--ds-surface-dim']).toBe('#eef1f7');
      expect(cssVars['--ds-border']).toBe('#e6e8ee');
      expect(cssVars['--ds-border-strong']).toBe('#d2d6e0');
    });

    it('exposes shadows', () => {
      expect(cssVars['--ds-shadow-sm']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-md']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-lg']).toContain('rgba(15, 23, 41');
      expect(cssVars['--ds-shadow-focus']).toContain('rgba(0, 64, 144');
    });

    it('exposes radii', () => {
      expect(cssVars['--ds-radius-sm']).toBe('6px');
      expect(cssVars['--ds-radius-md']).toBe('10px');
      expect(cssVars['--ds-radius-lg']).toBe('14px');
      expect(cssVars['--ds-radius-xl']).toBe('20px');
      expect(cssVars['--ds-radius-full']).toBe('999px');
    });

    it('exposes space', () => {
      expect(cssVars['--ds-section-y']).toBe('clamp(64px, 8vw, 120px)');
      expect(cssVars['--ds-section-y-tight']).toBe('clamp(48px, 6vw, 80px)');
      expect(cssVars['--ds-container-x']).toBe('clamp(20px, 4vw, 40px)');
      expect(cssVars['--ds-container-max']).toBe('1200px');
    });

    it('exposes extended colors', () => {
      expect(cssVars['--ds-accent-hover']).toBe('#003070');
      expect(cssVars['--ds-text-inverted']).toBe('#ffffff');
    });
  });

  describe('Pre-Phase-1 token namespaces (still present until Phase 8.3 purge)', () => {
    it('exposes core colors', () => {
      expect(cssVars['--ds-bg']).toBe('#f8f9fc');
      expect(cssVars['--ds-accent']).toBe('#004090');
      expect(cssVars['--ds-text-primary']).toBe('#1a1a2e');
    });

    it('exposes glass tokens (legacy)', () => {
      expect(cssVars['--ds-glass-bg']).toContain('rgba(255');
      expect(cssVars['--ds-glass-blur']).toBe('16px');
    });

    it('exposes gradient tokens (legacy)', () => {
      expect(cssVars['--ds-gradient-bg-flow']).toContain('linear-gradient');
    });

    it('exposes glow tokens (legacy)', () => {
      expect(cssVars['--ds-glow-card']).toContain('rgba(0, 64, 144');
    });

    it('exposes typography', () => {
      expect(cssVars['--ds-font-serif']).toContain('EB Garamond');
      expect(cssVars['--ds-font-sans']).toContain('Inter');
      expect(cssVars['--ds-font-mono']).toContain('JetBrains Mono');
    });
  });
});
