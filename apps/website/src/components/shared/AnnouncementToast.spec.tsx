import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnnouncementToast } from './AnnouncementToast';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

function setScroll(fraction: number) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  // The threshold denominator is the SCROLLABLE range (scrollHeight - innerHeight),
  // not raw scrollHeight.
  window.scrollY = fraction * (5000 - 1000);
  fireEvent.scroll(window);
}

describe('AnnouncementToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays hidden after the timer if the reader has not scrolled 40%', () => {
    render(<AnnouncementToast />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.1));
    expect(document.querySelector('.toast-root')).toBeNull();
  });

  it('appears once BOTH the timer and the 40% scroll threshold are met', () => {
    render(<AnnouncementToast />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.45));
    expect(document.querySelector('.toast-root')).toBeTruthy();
  });

  it('stays dismissed: never reappears once the storage key is set', () => {
    // STORAGE_KEY is not exported from the component; mirrored here from its
    // literal construction: `dismissed-announcement-${ANNOUNCEMENT_DATE}`
    // with ANNOUNCEMENT_DATE = '2026-04-07'.
    localStorage.setItem('dismissed-announcement-2026-04-07', 'true');
    render(<AnnouncementToast />);
    act(() => vi.advanceTimersByTime(31_000));
    act(() => setScroll(0.45));
    expect(document.querySelector('.toast-root')).toBeNull();
  });
});
