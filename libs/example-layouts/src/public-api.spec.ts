import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('public-api auto-install side effect', () => {
  beforeEach(() => {
    // Reset module cache so the side effect re-runs on each test's import.
    vi.resetModules();
    // Clean slate on the DOM.
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('sets data-theme="dark" on document.documentElement when the barrel is imported', async () => {
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await import('./public-api');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies --ds-* CSS variables to documentElement on barrel import', async () => {
    await import('./public-api');
    const canvas = document.documentElement.style
      .getPropertyValue('--ds-canvas')
      .trim();
    // After PR #321 + #333: dark canvas is rgb(17, 17, 17)
    expect(canvas).toBe('rgb(17, 17, 17)');
  });
});
