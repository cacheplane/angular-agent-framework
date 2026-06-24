// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeAll } from 'vitest';
import { renderMath, katexLoaded } from './katex-loader';

describe('katex-loader', () => {
  beforeAll(async () => {
    await katexLoaded;
  });

  it('renders inline LaTeX to KaTeX HTML', () => {
    const html = renderMath('x^2 + y^2', false);
    expect(html).toBeTypeOf('string');
    expect(html).toContain('katex');
  });

  it('renders display LaTeX with displayMode markup', () => {
    const html = renderMath('\\sum_{i=0}^n i', true);
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });

  it('returns null (raw-fallback signal) for invalid LaTeX, no throw', () => {
    expect(() => renderMath('\\frac{', false)).not.toThrow();
    expect(renderMath('\\frac{', false)).toBeNull();
  });
});
