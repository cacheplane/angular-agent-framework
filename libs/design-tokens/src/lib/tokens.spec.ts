import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  colors,
  typography,
  tokens,
  surfaces,
  shadows,
  radius,
  space,
} from '../index';

describe('design-tokens', () => {
  it('exports all color tokens', () => {
    expect(colors.bg).toBe('#f8f9fc');
    expect(colors.accent).toBe('#004090');
    expect(colors.textPrimary).toBe('#1a1a2e');
    expect(colors.angularRed).toBe('#DD0031');
  });

  it('exports typography tokens', () => {
    expect(typography.fontSerif).toContain('EB Garamond');
    expect(typography.fontSans).toContain('Inter');
    expect(typography.fontMono).toContain('JetBrains Mono');
  });

  it('exports combined tokens object with all categories', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.typography).toBe(typography);
  });

  it('all token objects are frozen (as const)', () => {
    expect(() => { (colors as any).bg = 'red'; }).toThrow();
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

    it('defines typography tokens', () => {
      expect(css).toContain('--ds-font-serif:');
      expect(css).toContain('--ds-font-sans:');
      expect(css).toContain('--ds-font-mono:');
    });

    it('uses :root selector', () => {
      expect(css).toContain(':root');
    });

    it('defines surfaces tokens', () => {
      expect(css).toContain('--ds-canvas:');
      expect(css).toContain('--ds-surface:');
      expect(css).toContain('--ds-surface-tinted:');
      expect(css).toContain('--ds-border:');
      expect(css).toContain('--ds-border-strong:');
    });

    it('defines shadow tokens', () => {
      expect(css).toContain('--ds-shadow-sm:');
      expect(css).toContain('--ds-shadow-md:');
      expect(css).toContain('--ds-shadow-lg:');
      expect(css).toContain('--ds-shadow-focus:');
    });

    it('defines radius tokens', () => {
      expect(css).toContain('--ds-radius-sm:');
      expect(css).toContain('--ds-radius-md:');
      expect(css).toContain('--ds-radius-lg:');
      expect(css).toContain('--ds-radius-full:');
    });

    it('defines space tokens', () => {
      expect(css).toContain('--ds-section-y:');
      expect(css).toContain('--ds-container-x:');
      expect(css).toContain('--ds-container-max:');
    });

    it('defines extended color tokens', () => {
      expect(css).toContain('--ds-accent-hover:');
      expect(css).toContain('--ds-text-inverted:');
    });

    it('defines type-scale tokens', () => {
      expect(css).toContain('--ds-h1-size:');
      expect(css).toContain('--ds-h2-size:');
      expect(css).toContain('--ds-h3-size:');
      expect(css).toContain('--ds-eyebrow-size:');
    });
  });

  describe('surfaces tokens', () => {
    it('exposes canvas, surface, surfaceTinted, surfaceDim, border, borderStrong', () => {
      expect(surfaces.canvas).toBe('#fafbfc');
      expect(surfaces.surface).toBe('#ffffff');
      expect(surfaces.surfaceTinted).toBe('#f4f6fb');
      expect(surfaces.surfaceDim).toBe('#eef1f7');
      expect(surfaces.border).toBe('#e6e8ee');
      expect(surfaces.borderStrong).toBe('#d2d6e0');
    });
  });

  describe('shadows tokens', () => {
    it('exposes sm, md, lg, focus', () => {
      expect(shadows.sm).toBe('0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)');
      expect(shadows.md).toBe('0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)');
      expect(shadows.lg).toBe('0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)');
      expect(shadows.focus).toBe('0 0 0 3px rgba(0, 64, 144, 0.25)');
    });
  });

  describe('radius tokens', () => {
    it('exposes sm, md, lg, xl, full', () => {
      expect(radius.sm).toBe('6px');
      expect(radius.md).toBe('10px');
      expect(radius.lg).toBe('14px');
      expect(radius.xl).toBe('20px');
      expect(radius.full).toBe('999px');
    });
  });

  describe('space tokens', () => {
    it('exposes section + container scale', () => {
      expect(space.sectionY).toBe('clamp(64px, 8vw, 120px)');
      expect(space.sectionYTight).toBe('clamp(48px, 6vw, 80px)');
      expect(space.containerX).toBe('clamp(20px, 4vw, 40px)');
      expect(space.containerMax).toBe('1200px');
    });
  });

  describe('colors tokens — extensions', () => {
    it('exposes accentHover and textInverted', () => {
      expect(colors.accentHover).toBe('#003070');
      expect(colors.textInverted).toBe('#ffffff');
    });

    it('keeps existing tokens unchanged (no breaking change)', () => {
      expect(colors.accent).toBe('#004090');
      expect(colors.angularRed).toBe('#DD0031');
      expect(colors.textPrimary).toBe('#1a1a2e');
    });
  });

  describe('typography tokens — type scale', () => {
    it('exposes h1/h2/h3/eyebrow/bodyLg/body/caption scale', () => {
      expect(typography.h1.size).toBe('clamp(48px, 6vw, 72px)');
      expect(typography.h1.family).toBe('var(--font-garamond)');
      expect(typography.h2.size).toBe('clamp(36px, 4.5vw, 56px)');
      expect(typography.h3.size).toBe('28px');
      expect(typography.h3.weight).toBe(600);
      expect(typography.eyebrow.size).toBe('12px');
      expect(typography.eyebrow.transform).toBe('uppercase');
      expect(typography.bodyLg.size).toBe('20px');
      expect(typography.body.size).toBe('16px');
      expect(typography.caption.size).toBe('14px');
    });

    it('keeps existing font-family tokens unchanged', () => {
      expect(typography.fontSerif).toBe('"EB Garamond", Georgia, serif');
      expect(typography.fontSans).toBe('Inter, system-ui, sans-serif');
      expect(typography.fontMono).toBe('"JetBrains Mono", monospace');
    });
  });

  describe('combined tokens — new namespaces', () => {
    it('aggregator includes all new namespaces', () => {
      expect(tokens.surfaces).toBe(surfaces);
      expect(tokens.shadows).toBe(shadows);
      expect(tokens.radius).toBe(radius);
      expect(tokens.space).toBe(space);
    });
  });
});
