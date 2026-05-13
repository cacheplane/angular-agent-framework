import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmbeddedTheme } from './use-embedded-theme';

describe('useEmbeddedTheme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'dark' as the default", () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    expect(result.current).toBe('dark');
  });

  it('posts ngaf:theme-request to window.parent on mount', () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage');
    renderHook(() => useEmbeddedTheme());
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme-request' }, '*');
  });

  it('updates when an ngaf:theme message arrives', () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'ngaf:theme', theme: 'light' } }),
      );
    });
    expect(result.current).toBe('light');
  });

  it('ignores messages of unrelated types', () => {
    const { result } = renderHook(() => useEmbeddedTheme());
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'something-else', theme: 'light' } }),
      );
    });
    expect(result.current).toBe('dark');
  });
});
