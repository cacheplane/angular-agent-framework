import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from './theme-context';
import { ThemedFrame } from './themed-frame';

function makeIframeWithMockedContentWindow() {
  // jsdom doesn't give iframes a real contentWindow; stub it before render
  const postMessage = vi.fn();
  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreateElement(tag);
    if (tag === 'iframe') {
      Object.defineProperty(el, 'contentWindow', { value: { postMessage } });
    }
    return el;
  });
  return { postMessage };
}

describe('ThemedFrame', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the current theme to its iframe on mount', () => {
    const { postMessage } = makeIframeWithMockedContentWindow();
    render(
      <ThemeProvider theme="dark">
        <ThemedFrame src="about:blank" data-testid="frame" />
      </ThemeProvider>
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme', theme: 'dark' }, '*');
  });

  it('replies to ngaf:theme-request only when e.source matches its own contentWindow', () => {
    const { postMessage } = makeIframeWithMockedContentWindow();
    const { container } = render(
      <ThemeProvider theme="light">
        <ThemedFrame src="about:blank" />
      </ThemeProvider>
    );
    postMessage.mockClear();
    const iframe = container.querySelector('iframe')!;
    const ownWindow = iframe.contentWindow;

    // Matching source — should reply
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme-request' }, source: ownWindow as Window })
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'ngaf:theme', theme: 'light' }, '*');

    postMessage.mockClear();

    // Different source — should NOT reply
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'ngaf:theme-request' }, source: window })
    );
    expect(postMessage).not.toHaveBeenCalled();
  });
});
