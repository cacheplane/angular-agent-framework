import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installEmbeddedTheme } from './install-embedded-theme';

describe('installEmbeddedTheme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('applies the default theme immediately (dark)', () => {
    installEmbeddedTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    // Verify a representative --ds-* var got set to the dark value
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('rgb(17, 17, 17)');
  });

  it('accepts a non-default initial theme', () => {
    installEmbeddedTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('rgb(255, 255, 255)');
  });

  it('posts ngaf:theme-request to window.parent on call', () => {
    const spy = vi.spyOn(window.parent, 'postMessage');
    installEmbeddedTheme();
    expect(spy).toHaveBeenCalledWith({ type: 'ngaf:theme-request' }, '*');
  });

  it('updates theme on ngaf:theme message receipt', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'light' } })
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--ds-canvas').trim()).toBe('rgb(255, 255, 255)');
  });

  it('ignores malformed messages', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'banana' } })
    );
    expect(document.documentElement.dataset.theme).toBe('dark'); // unchanged
  });

  it('ignores unrelated message types', () => {
    installEmbeddedTheme();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'something-else', theme: 'light' } })
    );
    expect(document.documentElement.dataset.theme).toBe('dark'); // unchanged
  });
});
