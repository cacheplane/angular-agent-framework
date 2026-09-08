// @vitest-environment jsdom
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavSurface } from './useNavSurface';

let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();
const observe = vi.fn();

function Probe({ pathname }: { pathname: string }) {
  const { surface, sentinelRef } = useNavSurface(pathname);
  return (
    <>
      <div ref={sentinelRef} data-testid="sentinel" />
      <span data-testid="surface">{surface}</span>
    </>
  );
}

describe('useNavSurface', () => {
  beforeEach(() => {
    observerCallback = null;
    disconnect.mockClear();
    observe.mockClear();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          observerCallback = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is transparent at rest on a hero route', () => {
    render(<Probe pathname="/" />);
    expect(screen.getByTestId('surface').textContent).toBe('transparent');
  });

  it('observes the sentinel element it handed back', () => {
    render(<Probe pathname="/" />);
    const sentinel = screen.getByTestId('sentinel');
    expect(observe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(sentinel);
  });

  it('is solid on a route with no hero, and observes nothing there', () => {
    render(<Probe pathname="/docs/langgraph/getting-started/introduction" />);
    expect(screen.getByTestId('surface').textContent).toBe('solid');
    expect(observerCallback).toBeNull();
  });

  it('solidifies once the sentinel scrolls out of view', () => {
    render(<Probe pathname="/" />);
    act(() => observerCallback?.([{ isIntersecting: false }]));
    expect(screen.getByTestId('surface').textContent).toBe('solid');
  });

  it('goes transparent again when the sentinel returns', () => {
    render(<Probe pathname="/" />);
    act(() => observerCallback?.([{ isIntersecting: false }]));
    act(() => observerCallback?.([{ isIntersecting: true }]));
    expect(screen.getByTestId('surface').textContent).toBe('transparent');
  });

  it('stays solid without an IntersectionObserver rather than flashing transparent', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe pathname="/" />);
    // Server render and very old browsers land here. A hero route with no way
    // to detect scrolling must not sit transparent forever once scrolled.
    expect(screen.getByTestId('surface').textContent).toBe('solid');
  });

  it('disconnects on unmount', () => {
    const view = render(<Probe pathname="/" />);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
