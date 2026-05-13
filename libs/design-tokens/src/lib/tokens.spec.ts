import { describe, it, expect } from 'vitest';
import { tokens, baseTokens, lightOverrides, darkOverrides } from './tokens';

describe('tokens', () => {
  it('exposes baseTokens at the root', () => {
    expect(tokens.brand).toBe(baseTokens.brand);
  });

  it('exposes light and dark overrides under named keys', () => {
    expect(tokens.light).toBe(lightOverrides);
    expect(tokens.dark).toBe(darkOverrides);
  });

  it('light and dark have identical key sets (catches missing tokens in either theme)', () => {
    const lightKeys = Object.keys(lightOverrides).sort();
    const darkKeys = Object.keys(darkOverrides).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('brand colors are theme-invariant', () => {
    expect(baseTokens.brand.angularRed).toBe('#DD0031');
    expect(baseTokens.brand.renderGreen).toBe('#1a7a40');
    expect(baseTokens.brand.chatPurple).toBe('#5a00c8');
  });

  it('exposes backwards-compat colors and surfaces aliases for light-only consumers', () => {
    expect(tokens.colors.textPrimary).toBe(lightOverrides.textPrimary);
    expect(tokens.colors.bg).toBe(lightOverrides.bg);
    expect(tokens.colors.angularRed).toBe(baseTokens.brand.angularRed);
    expect(tokens.surfaces.canvas).toBe(lightOverrides.canvas);
    expect(tokens.surfaces.border).toBe(lightOverrides.border);
  });
});
