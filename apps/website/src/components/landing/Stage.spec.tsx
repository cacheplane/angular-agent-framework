// @vitest-environment jsdom
import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage } from './Stage';
import { engineRoot } from './StageAct';
import {
  STAGE_BEATS,
  beatWindows,
  type StageBeat,
} from '../../lib/stage-beats';

/** Stands in for `STAGE_PROOF`: the page derives these from the recording. */
const PROOF: Record<StageBeat, string> = {
  stream: '312 events · 1 tool call · 3 sources',
  persist: 'reloaded · 10 checkpoints · forked at step 1',
  approve: '1 interrupt pending · checkpoint 10 of 10',
  render: '1 surface · 6 components · no generated code ran',
};

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
    render(<Stage proof={PROOF} />);
    await flush();
    expect(screen.getAllByTestId('stage-still-beat')).toHaveLength(4);
    expect(document.querySelector('[data-stage-act]')).toBeNull();
    // The real stills, carrying the same proof and the ledger ending.
    expect(
      document.querySelector(
        '[data-testid="stage-still-beat"][data-beat="stream"] [data-stage-proof]'
      )!.textContent
    ).toBe(PROOF.stream);
    expect(screen.getByTestId('stage-stills-close')).toBeTruthy();
  });

  it('keeps the stills under reduced motion on a wide viewport', async () => {
    mockViewport(1440, true);
    render(<Stage proof={PROOF} />);
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
    render(<Stage proof={PROOF} />);
    await flush();
    const actEl = document.querySelector('[data-stage-act]');
    expect(actEl).not.toBeNull();
    expect(actEl?.getAttribute('data-sc-act')).toBe('pin');
    expect(actEl?.getAttribute('data-sc-span')).toBe('6');
    expect(actEl?.getAttribute('data-state')).toBe('mounting');
    expect(actEl?.querySelector('[data-sc-stage]')).not.toBeNull();
    // The rail: the segment bar, four beat blocks stacked in one cell, one
    // hold line, and the closing ledger.
    const act = actEl!;
    expect(act.querySelectorAll('[data-stage-segment]')).toHaveLength(4);
    expect(
      [...act.querySelectorAll('[data-stage-segment]')].map(
        (s) => s.textContent
      )
    ).toEqual(['Tools', 'Persist', 'Approve', 'Render']);
    expect(
      act.querySelectorAll('[data-testid="stage-rail-beat"]')
    ).toHaveLength(4);
    // One check per beat block, four in the ledger.
    expect(act.querySelectorAll('[data-stage-check]')).toHaveLength(4 + 4);
    expect(
      act.querySelector('[data-testid="stage-rail-hold"]')!.textContent
    ).toBe('Keep scrolling to approve.');
    expect(
      act.querySelector('[data-testid="stage-rail-close"]')
    ).not.toBeNull();
    expect(
      act.querySelector('[data-testid="stage-rail-close"]')!.textContent
    ).toContain('Feature complete for the final mile.');
    expect(
      act.querySelector(
        '[data-testid="stage-rail-beat"][data-beat="stream"] [data-stage-proof]'
      )!.textContent
    ).toBe(PROOF.stream);
    expect(screen.queryAllByTestId('stage-still-beat')).toHaveLength(0);
    // The engine collects acts with root.querySelectorAll('[data-sc-act]'),
    // which matches descendants only — so the mount root must contain the act
    // rather than be it.
    expect(mount).toHaveBeenCalledTimes(1);
    const root = mount.mock.calls[0][0] as Element | Document;
    expect(root).not.toBe(actEl);
    expect(root === document || root.contains(actEl)).toBe(true);
    expect(root.querySelectorAll('[data-sc-act]')).toContain(actEl);
    // Keyboard path: the pin is skippable, the segment bar stays in the tab
    // order (it is always visible), and the opacity-hidden cue CTAs are out.
    const skip = actEl?.querySelector('a.stage-skip');
    expect(skip?.getAttribute('href')).toBe('#stage-end');
    expect(document.getElementById('stage-end')).not.toBeNull();
    const segments = actEl!.querySelectorAll('a.stage-seg');
    expect(segments).toHaveLength(4);
    segments.forEach((a) => expect(a.hasAttribute('tabindex')).toBe(false));
    const cueLinks = actEl!.querySelectorAll(
      '.stage-rail-beat a, .stage-rail-close a'
    );
    expect(cueLinks).toHaveLength(4 + 4 + 1);
    cueLinks.forEach((a) => expect(a.getAttribute('tabindex')).toBe('-1'));
    // Each segment's href resolves to its beat block, so the anchor works
    // even when the click handler does not run.
    for (const b of STAGE_BEATS) {
      const seg = actEl!.querySelector(`[data-stage-segment="${b}"]`);
      expect(seg?.getAttribute('href')).toBe(`#stage-${b}`);
      const block = document.getElementById(`stage-${b}`);
      expect(block?.getAttribute('data-stage-beat')).toBe(b);
    }
    expect(
      actEl!
        .querySelector('[data-testid="stage-rail-close"]')!
        .hasAttribute('data-stage-close')
    ).toBe(true);
    const iframe = actEl?.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe(
      'https://demo.threadplane.ai/stage?t=0'
    );
    expect(iframe?.getAttribute('tabindex')).toBe('-1');
  });

  it('a segment click scrolls the page to the start of that beat', async () => {
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
    window.ScrollCraft = {
      mount: vi.fn(),
      reduce: false,
      instances: [],
    } as never;
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    });
    render(<Stage proof={PROOF} />);
    await flush();
    const section = document.querySelector('[data-stage-act]') as HTMLElement;
    // The engine sets the act's height to STAGE_SPAN viewports; jsdom does
    // not lay out, so the travel is given here.
    Object.defineProperty(section, 'offsetHeight', {
      configurable: true,
      value: 6000,
    });
    const travel = 6000 - 900;
    const persist = section.querySelector(
      '[data-stage-segment="persist"]'
    ) as HTMLAnchorElement;
    persist.click();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const arg = scrollTo.mock.calls[0][0] as ScrollToOptions;
    expect(arg.behavior).toBe('smooth');
    const w = beatWindows()[STAGE_BEATS.indexOf('persist')];
    expect(arg.top).toBeGreaterThanOrEqual(travel * w.from);
    expect(arg.top).toBeLessThan(travel * w.to);
  });
});
