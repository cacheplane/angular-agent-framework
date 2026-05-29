/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './logo';

describe('Logo', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    act(() => { root?.unmount(); });
    container?.remove();
  });

  it('renders the Threadplane wordmark and the cockpit qualifier', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<Logo />); });

    expect(container.textContent).toContain('Threadplane');
    expect(container.textContent).toContain('cockpit');
  });
});
