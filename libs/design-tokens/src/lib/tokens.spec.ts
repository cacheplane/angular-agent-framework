import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { colors, glass, gradient, glow, typography, tokens } from '../index';

describe('design-tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.bg).toBe('#f8f9fc');
    expect(colors.accent).toBe('#004090');
    expect(colors.textPrimary).toBe('#1a1a2e');
    expect(colors.angularRed).toBe('#DD0031');
  });

  it('exports glass tokens', () => {
    expect(glass.bg).toContain('rgba(255');
    expect(glass.blur).toBe('16px');
    expect(glass.border).toContain('rgba(255');
  });

  it('exports gradient tokens', () => {
    expect(gradient.bgFlow).toContain('linear-gradient');
    expect(gradient.warm).toContain('rgba(221');
    expect(gradient.cool).toContain('rgba(0, 64, 144');
  });

  it('exports glow tokens', () => {
    expect(glow.hero).toContain('60px');
    expect(glow.button).toContain('16px');
  });

  it('exports typography tokens', () => {
    expect(typography.fontSerif).toContain('EB Garamond');
    expect(typography.fontSans).toContain('Inter');
    expect(typography.fontMono).toContain('JetBrains Mono');
  });

  it('exports combined tokens object with all categories', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.glass).toBe(glass);
    expect(tokens.gradient).toBe(gradient);
    expect(tokens.glow).toBe(glow);
    expect(tokens.typography).toBe(typography);
  });

  it('all token objects are frozen (as const)', () => {
    expect(() => { (colors as any).bg = 'red'; }).toThrow();
    expect(() => { (glass as any).blur = '0px'; }).toThrow();
  });

  describe('tokens.css', () => {
    const css = readFileSync(
      resolve(__dirname, 'tokens.css'),
      'utf-8',
    );

    it('defines all color tokens as CSS custom properties', () => {
      expect(css).toContain('--ds-bg:');
      expect(css).toContain('--ds-accent:');
      expect(css).toContain('--ds-text-primary:');
      expect(css).toContain('--ds-text-secondary:');
      expect(css).toContain('--ds-text-muted:');
      expect(css).toContain('--ds-accent-surface:');
    });

    it('defines glass tokens', () => {
      expect(css).toContain('--ds-glass-bg:');
      expect(css).toContain('--ds-glass-blur:');
      expect(css).toContain('--ds-glass-border:');
      expect(css).toContain('--ds-glass-shadow:');
    });

    it('defines gradient tokens', () => {
      expect(css).toContain('--ds-gradient-bg-flow:');
    });

    it('defines typography tokens', () => {
      expect(css).toContain('--ds-font-serif:');
      expect(css).toContain('--ds-font-sans:');
      expect(css).toContain('--ds-font-mono:');
    });

    it('defines glow tokens', () => {
      expect(css).toContain('--ds-glow-hero:');
      expect(css).toContain('--ds-glow-card:');
    });

    it('uses :root selector', () => {
      expect(css).toContain(':root');
    });
  });
});
