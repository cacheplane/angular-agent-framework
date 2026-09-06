import { useEffect, useRef } from 'react';
import {
  beatAt,
  crossedThreshold,
  inHold,
  timeAt,
  type StageBeat,
  type StageReadyMessage,
} from '../../lib/stage-beats';

export const STAGE_DEMO_ORIGIN = 'https://demo.threadplane.ai';
export const STAGE_DEMO_URL = `${STAGE_DEMO_ORIGIN}/stage?t=0`;
export const STAGE_MESSAGE_TYPE = 'tplane-stage';

export type StageMilestone = 'enter' | 'beat' | 'threshold' | 'complete';

export interface StagePublisherDeps {
  section: HTMLElement;
  /** The iframe's window, or null while it is not mounted / not navigated. */
  frameWindow: () => Window | null;
  track: (milestone: StageMilestone, beat?: StageBeat) => void;
  /** Called with the frame's first `ready`; the act uses it to crossfade the poster. */
  onReady?: () => void;
}

export interface StagePublisher {
  /** One frame: read --sc-p, post t if it changed, update verify attributes and milestones. */
  tick(): void;
  dispose(): void;
}

function readProgress(el: HTMLElement): number {
  const v = parseFloat(el.style.getPropertyValue('--sc-p'));
  return Number.isFinite(v) ? v : 0;
}

export function createStagePublisher(deps: StagePublisherDeps): StagePublisher {
  let ready: StageReadyMessage | null = null;
  let lastT = -1;
  let lastP = -1;
  let hold = false;
  let entered = false;
  let completed = false;
  let thresholdSeen = false;
  const beatsSeen = new Set<StageBeat>();
  let disposed = false;

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== STAGE_DEMO_ORIGIN) return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || d['type'] !== STAGE_MESSAGE_TYPE) return;
    if (
      d['ready'] === true &&
      Array.isArray(d['beats']) &&
      typeof d['totalMs'] === 'number'
    ) {
      const first = ready === null;
      ready = d as unknown as StageReadyMessage;
      lastT = -1; // re-post the current t after a (re)ready
      if (first) deps.onReady?.();
      return;
    }
    if (typeof d['applied'] === 'number' && typeof d['phase'] === 'string') {
      deps.section.setAttribute(
        'data-sc-verify-state',
        `${d['phase']}:${d['applied']}`
      );
    }
  };
  window.addEventListener('message', onMessage);

  return {
    tick() {
      if (disposed) return;
      const p = readProgress(deps.section);
      // Verify hold, from scroll alone: the harness must see the authored hold even before the frame answers.
      const h = inHold(p);
      if (h !== hold) {
        hold = h;
        if (h) deps.section.setAttribute('data-sc-verify-hold', 'true');
        else deps.section.removeAttribute('data-sc-verify-hold');
      }
      // Milestones.
      if (!entered && p > 0) {
        entered = true;
        deps.track('enter');
      }
      const beat = beatAt(p);
      if (p > 0 && !beatsSeen.has(beat)) {
        beatsSeen.add(beat);
        deps.track('beat', beat);
      }
      if (lastP >= 0 && !thresholdSeen && crossedThreshold(lastP, p)) {
        thresholdSeen = true;
        deps.track('threshold');
      }
      if (!completed && p >= 0.999) {
        completed = true;
        deps.track('complete');
      }
      lastP = p;
      // Seek.
      if (!ready) return;
      const t = timeAt(p, ready);
      if (t === lastT) return;
      const w = deps.frameWindow();
      if (!w) return;
      w.postMessage({ type: STAGE_MESSAGE_TYPE, t }, STAGE_DEMO_ORIGIN);
      lastT = t;
    },
    dispose() {
      disposed = true;
      window.removeEventListener('message', onMessage);
    },
  };
}

/**
 * Runs the publisher on animation frames while `active`, and only while the
 * section intersects the viewport (a pinned act six viewports tall is on screen
 * for a while; nothing is posted before it arrives or after it leaves).
 *
 * The publisher is created once per (sectionRef, active) mount, but `deps`
 * are read through a ref on every tick, so a `frameWindow` that only starts
 * returning the iframe's window after its `load` event is seen by the running
 * loop without re-subscribing.
 */
export function useStagePublisher(
  sectionRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  deps: Omit<StagePublisherDeps, 'section'>
): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  useEffect(() => {
    const section = sectionRef.current;
    if (!active || !section) return;
    const pub = createStagePublisher({
      section,
      frameWindow: () => depsRef.current.frameWindow(),
      track: (m, b) => depsRef.current.track(m, b),
      onReady: () => depsRef.current.onReady?.(),
    });
    let onScreen = false;
    let frame = 0;
    const loop = () => {
      pub.tick();
      frame = onScreen ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen && frame === 0) frame = requestAnimationFrame(loop);
    });
    io.observe(section);
    return () => {
      io.disconnect();
      onScreen = false;
      if (frame) cancelAnimationFrame(frame);
      pub.dispose();
    };
  }, [sectionRef, active]);
}
