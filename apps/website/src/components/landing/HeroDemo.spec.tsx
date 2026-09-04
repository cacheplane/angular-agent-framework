// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));
vi.mock('../ui/BrowserFrame', () => ({
  BrowserFrame: ({ children }: { children: React.ReactNode }) => <div data-frame>{children}</div>,
}));

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let ioCallback: IOCallback | null = null;

function installEnv({ width = 1280, reduced = false }: { width?: number; reduced?: boolean } = {}) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  class IO {
    constructor(cb: IOCallback) {
      ioCallback = cb;
    }
    observe() {
      /* the test drives the callback directly */
    }
    unobserve() {
      /* no-op */
    }
    disconnect() {
      /* no-op */
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
}

function frameReady(origin = 'https://demo.threadplane.ai') {
  fireEvent(window, new MessageEvent('message', { origin, data: { type: 'tplane-hero', state: 'ready' } }));
}

/** Replace the jsdom iframe's `contentWindow` with a spy we can assert on. */
function stubContentWindow(iframe: HTMLIFrameElement) {
  const postMessage = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage }, configurable: true });
  return postMessage;
}

beforeEach(() => {
  vi.useFakeTimers();
  ioCallback = null;
  trackCtaClickMock.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('HeroDemo', () => {
  it('server-renders the poster eagerly with explicit dimensions and no iframe', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/screenshots/hero-walkthrough-poster.webp');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('720');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('alt')).toBe(
      'Threadplane chat replaying a recorded LangGraph run: a user prompt, a request_approval tool call, and the streamed three-step cleanup plan',
    );
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('mounts the iframe when visible on desktop and reveals it on ready from the demo origin', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('https://demo.threadplane.ai/hero');
    expect(iframe.getAttribute('title')).toBe('Threadplane live demo');
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('mounting');
    act(() => {
      frameReady();
    });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('ready');
  });

  it('posts visible: true to the demo origin when the iframe loads', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = stubContentWindow(iframe);
    act(() => {
      fireEvent.load(iframe);
    });
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', visible: true }, 'https://demo.threadplane.ai');
  });

  it('ignores ready from a foreign origin and falls back after the timeout', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    act(() => {
      frameReady('https://evil.example');
    });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('mounting');
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('fallback');
    expect(screen.getByRole('link', { name: /Open the live demo/ }).getAttribute('href')).toBe(
      'https://demo.threadplane.ai',
    );
  });

  it('keeps posting visibility to the frame after the ready timeout drops it into fallback', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = stubContentWindow(iframe);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('fallback');
    post.mockClear();
    act(() => {
      ioCallback?.([{ isIntersecting: false }]);
    });
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', visible: true }, 'https://demo.threadplane.ai');
  });

  it('shows Play walkthrough instead of mounting on narrow viewports, and mounts on click', async () => {
    installEnv({ width: 390 });
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    expect(container.querySelector('iframe')).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Play walkthrough' }));
    });
    expect(container.querySelector('iframe')).toBeTruthy();
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_play' }));
  });

  it('shows Play walkthrough under reduced motion', async () => {
    installEnv({ reduced: true });
    const { HeroDemo } = await import('./HeroDemo');
    render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    expect(screen.getByRole('button', { name: 'Play walkthrough' })).toBeTruthy();
  });

  it('tracks takeover and replay once per frame state message', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    act(() => {
      frameReady();
    });
    act(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          origin: 'https://demo.threadplane.ai',
          data: { type: 'tplane-hero', state: 'live' },
        }),
      );
    });
    act(() => {
      fireEvent(
        window,
        new MessageEvent('message', {
          origin: 'https://demo.threadplane.ai',
          data: { type: 'tplane-hero', state: 'replay' },
        }),
      );
    });
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_takeover' }));
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_replay' }));
  });

  it('forwards visibility to the frame with the demo origin', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => {
      ioCallback?.([{ isIntersecting: true }]);
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = stubContentWindow(iframe);
    act(() => {
      frameReady();
    });
    act(() => {
      ioCallback?.([{ isIntersecting: false }]);
    });
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', visible: false }, 'https://demo.threadplane.ai');
  });
});
