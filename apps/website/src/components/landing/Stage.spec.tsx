// @vitest-environment jsdom
import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage } from './Stage';
import { engineRoot } from './StageAct';

// The engine is an IIFE that reads matchMedia at load and measures layout on
// mount; neither is meaningful in jsdom. The act only needs the global.
vi.mock('../../vendor/scrollcraft/scrollcraft.js', () => ({}));
vi.mock('../../lib/analytics/client', () => ({
  trackStageProgress: vi.fn(),
  track: vi.fn(),
}));
vi.mock('../ui/BrowserFrame', () => ({
  BrowserFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-frame>{children}</div>
  ),
}));

function mockViewport(width: number, reducedMotion: boolean) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('reduce') ? reducedMotion : false,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Let the mode-switch effect and the engine's dynamic import settle. */
const flush = () => act(() => Promise.resolve());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.ScrollCraft;
});

describe('engineRoot', () => {
  it('returns a root whose querySelectorAll finds the act', () => {
    const parent = document.createElement('div');
    const act = document.createElement('section');
    act.setAttribute('data-sc-act', 'pin');
    parent.appendChild(act);
    const root = engineRoot(act);
    expect(root).not.toBe(act);
    expect(Array.from(root.querySelectorAll('[data-sc-act]'))).toContain(act);
  });

  it('falls back to document for a detached act', () => {
    const act = document.createElement('section');
    expect(engineRoot(act)).toBe(document);
  });
});

describe('Stage', () => {
  it('renders the stills on the server and keeps them on a narrow viewport', async () => {
    mockViewport(390, false);
    render(<Stage />);
    await flush();
    expect(screen.getAllByTestId('stage-still-beat')).toHaveLength(4);
    expect(document.querySelector('[data-stage-act]')).toBeNull();
  });

  it('keeps the stills under reduced motion on a wide viewport', async () => {
    mockViewport(1440, true);
    render(<Stage />);
    await flush();
    expect(screen.getAllByTestId('stage-still-beat')).toHaveLength(4);
    expect(document.querySelector('[data-stage-act]')).toBeNull();
  });

  it('upgrades to the pinned act on a wide, motion-tolerant viewport and mounts the engine on it', async () => {
    mockViewport(1440, false);
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {
          /* no-op */
        }
        disconnect() {
          /* no-op */
        }
      }
    );
    const mount = vi.fn();
    window.ScrollCraft = { mount, reduce: false, instances: [] } as never;
    render(<Stage />);
    await flush();
    const actEl = document.querySelector('[data-stage-act]');
    expect(actEl).not.toBeNull();
    expect(actEl?.getAttribute('data-sc-act')).toBe('pin');
    expect(actEl?.getAttribute('data-sc-span')).toBe('6');
    expect(actEl?.getAttribute('data-state')).toBe('mounting');
    expect(actEl?.querySelector('[data-sc-stage]')).not.toBeNull();
    // 4 beats + 3 hold lines
    expect(
      actEl?.querySelectorAll('[data-sc-cue]').length
    ).toBeGreaterThanOrEqual(7);
    expect(actEl?.querySelectorAll('.stage-rail-beat')).toHaveLength(4);
    expect(screen.queryAllByTestId('stage-still-beat')).toHaveLength(0);
    // The engine collects acts with root.querySelectorAll('[data-sc-act]'),
    // which matches descendants only — so the mount root must contain the act
    // rather than be it.
    expect(mount).toHaveBeenCalledTimes(1);
    const root = mount.mock.calls[0][0] as Element | Document;
    expect(root).not.toBe(actEl);
    expect(root === document || root.contains(actEl)).toBe(true);
    expect(root.querySelectorAll('[data-sc-act]')).toContain(actEl);
    // Keyboard path: the pin is skippable, and the opacity-hidden rail CTAs
    // are out of the tab order.
    const skip = actEl?.querySelector('a.stage-skip');
    expect(skip?.getAttribute('href')).toBe('#stage-end');
    expect(document.getElementById('stage-end')).not.toBeNull();
    const ctas = actEl?.querySelectorAll('.stage-rail-beat .feature-block-cta');
    expect(ctas).toHaveLength(4);
    ctas?.forEach((a) => expect(a.getAttribute('tabindex')).toBe('-1'));
    const iframe = actEl?.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe(
      'https://demo.threadplane.ai/stage?t=0'
    );
    expect(iframe?.getAttribute('tabindex')).toBe('-1');
  });
});
