import { useEffect, useRef } from 'react';
import {
  beatAt,
  crossedThreshold,
  inHold,
  navigationProgress,
  isChecked,
  segmentState,
  STAGE_BEATS,
  timeAt,
  type StageBeat,
  type StageMilestone,
  type StageReadyMessage,
} from '../../lib/stage-beats';

export type { StageMilestone } from '../../lib/stage-beats';

export const STAGE_DEMO_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_STAGE_DEMO_ORIGIN || 'https://demo.threadplane.ai'
).origin;
export const STAGE_DEMO_URL = `${STAGE_DEMO_ORIGIN}/stage?t=0`;
export const STAGE_MESSAGE_TYPE = 'tplane-stage';

/** How often the publisher says hello to a frame that has not answered yet. */
export const STAGE_HELLO_INTERVAL_MS = 500;
export const STAGE_INTERACTION_IDLE_MS = 250;

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

const isStageBeat = (v: string | null): v is StageBeat =>
  (STAGE_BEATS as readonly string[]).includes(v ?? '');

/**
 * Rail elements keyed by a known beat, read once at construction. An element
 * whose beat attribute is not one of `STAGE_BEATS` is skipped rather than
 * fed to the beat math (which would index it as -1).
 */
function railElements(
  section: HTMLElement,
  attr: 'data-stage-segment' | 'data-stage-beat' | 'data-stage-check'
): { el: Element; beat: StageBeat }[] {
  const out: { el: Element; beat: StageBeat }[] = [];
  for (const el of section.querySelectorAll(`[${attr}]`)) {
    const beat = el.getAttribute(attr);
    if (isStageBeat(beat)) out.push({ el, beat });
  }
  return out;
}

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isRange = (v: unknown): v is { startMs: number; endMs: number } =>
  typeof v === 'object' &&
  v !== null &&
  isFiniteNumber((v as Record<string, unknown>)['startMs']) &&
  isFiniteNumber((v as Record<string, unknown>)['endMs']);

/**
 * A `ready` message the seek math can trust. `timeAt` reads `hold.startMs`
 * and each beat's times unguarded, and a non-numeric time yields `t = NaN`,
 * which never equals `lastT`, so a malformed message would make the
 * publisher post every frame. Anything failing this guard is ignored.
 */
function isReady(
  d: Record<string, unknown>
): d is Record<string, unknown> & StageReadyMessage & { ready: true } {
  if (d['ready'] !== true) return false;
  if (!isFiniteNumber(d['totalMs'])) return false;
  const beats = d['beats'];
  if (!Array.isArray(beats) || beats.length !== STAGE_BEATS.length)
    return false;
  if (
    !beats.every(
      (b: unknown, i: number) =>
        isRange(b) && (b as Record<string, unknown>)['beat'] === STAGE_BEATS[i]
    )
  )
    return false;
  if (!isRange(d['hold'])) return false;
  const reloadEndMs = d['reloadEndMs'];
  return reloadEndMs === null || isFiniteNumber(reloadEndMs);
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
  let lastHello = -Infinity;
  let lastMovement = performance.now();
  let appliedT = -1;
  const iframe = deps.section.querySelector<HTMLIFrameElement>('.stage-frame-iframe');
  const exploreButton = deps.section.querySelector<HTMLButtonElement>('[data-stage-explore]');
  let exploring = false;
  const setExploring = (value: boolean) => {
    if (exploring === value) return;
    exploring = value;
    deps.section.toggleAttribute('data-exploring', value);
    if (exploreButton) {
      exploreButton.textContent = value ? 'Resume walkthrough' : 'Explore chat';
      exploreButton.setAttribute('aria-pressed', String(value));
    }
    deps.frameWindow()?.postMessage({ type: STAGE_MESSAGE_TYPE, explore: value }, STAGE_DEMO_ORIGIN);
  };
  const toggleExploring = () => {
    if (deps.section.hasAttribute('data-interactive')) setExploring(!exploring);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && exploring) {
      setExploring(false);
      exploreButton?.focus({ preventScroll: true });
    }
  };
  exploreButton?.addEventListener('click', toggleExploring);
  window.addEventListener('keydown', onKey);
  const setInteractive = (enabled: boolean) => {
    deps.section.toggleAttribute('data-interactive', enabled);
    if (exploreButton) exploreButton.disabled = !enabled;
    if (iframe) {
      iframe.toggleAttribute('inert', !enabled);
      iframe.tabIndex = enabled ? 0 : -1;
    }
  };
  const onScroll = () => {
    setExploring(false);
    lastMovement = performance.now();
    setInteractive(false);
  };
  setInteractive(false);
  window.addEventListener('scroll', onScroll, { passive: true });
  // The segment bar and the beat blocks both take `data-beat-state`: the bar
  // lights, and the block whose beat is `now` gets the pointer back (every
  // block shares one cell and is hidden by opacity alone).
  const segments = [
    ...railElements(deps.section, 'data-stage-segment'),
    ...railElements(deps.section, 'data-stage-beat'),
  ];
  const checks = railElements(deps.section, 'data-stage-check');
  // The closing ledger is on top of that cell; it owns the pointer only once
  // render has settled and the cue has faded it in.
  const closes = [...deps.section.querySelectorAll('[data-stage-close]')];

  const onMessage = (e: MessageEvent) => {
    if (
      e.origin !== STAGE_DEMO_ORIGIN ||
      !e.source ||
      e.source !== deps.frameWindow()
    )
      return;
    const d = e.data as Record<string, unknown> | null;
    if (!d || typeof d !== 'object' || d['type'] !== STAGE_MESSAGE_TYPE) return;
    if (d['explore'] === false) {
      setExploring(false);
      exploreButton?.focus({ preventScroll: true });
      return;
    }
    const wheel = d['wheel'] as { deltaX?: unknown; deltaY?: unknown } | undefined;
    if (ready && !exploring && wheel && isFiniteNumber(wheel.deltaX) && isFiniteNumber(wheel.deltaY)) {
      onScroll();
      const limit = window.innerHeight * 2;
      window.scrollBy({
        left: Math.max(-limit, Math.min(limit, wheel.deltaX)),
        top: Math.max(-limit, Math.min(limit, wheel.deltaY)),
        behavior: 'instant',
      });
      return;
    }
    if (d['ready'] === true) {
      if (!isReady(d)) return;
      const first = ready === null;
      ready = d;
      appliedT = -1;
      onScroll();
      for (const { el, beat } of segments) {
        el.setAttribute('data-stage-target', String(navigationProgress(beat, ready)));
      }
      lastT = -1; // re-post the current t after a (re)ready
      if (first) deps.onReady?.();
      return;
    }
    if (typeof d['applied'] === 'number' && typeof d['phase'] === 'string') {
      if (d['settled'] === true && isFiniteNumber(d['t'])) appliedT = d['t'];
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
      if (p !== lastP) onScroll();
      // Verify hold, from scroll alone: the harness must see the authored hold even before the frame answers.
      const h = inHold(p);
      if (h !== hold) {
        hold = h;
        if (h) deps.section.setAttribute('data-sc-verify-hold', 'true');
        else deps.section.removeAttribute('data-sc-verify-hold');
      }
      // Rail: segment states and check fills, written only on change so the
      // harness signature and the browser's style recalc see nothing idle.
      for (const { el, beat } of segments) {
        const s = segmentState(beat, p);
        if (el.getAttribute('data-beat-state') !== s)
          el.setAttribute('data-beat-state', s);
      }
      for (const { el, beat } of checks) {
        const on = isChecked(beat, p);
        if (on !== el.hasAttribute('data-checked')) {
          if (on) el.setAttribute('data-checked', '');
          else el.removeAttribute('data-checked');
        }
      }
      const closeOn = isChecked('render', p);
      for (const el of closes) {
        if (closeOn !== el.hasAttribute('data-active')) {
          if (closeOn) el.setAttribute('data-active', '');
          else el.removeAttribute('data-active');
        }
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
      // Hello. Under a strict Referrer-Policy the frame arrives with no
      // referrer and posts nothing (it has nowhere to answer) until it hears
      // from an allowlisted parent; the frame learns the origin from this
      // message and answers with `ready`. Throttled so a scroll that idles
      // before the frame boots does not flood it.
      if (!ready) {
        const now = performance.now();
        if (now - lastHello < STAGE_HELLO_INTERVAL_MS) return;
        const w = deps.frameWindow();
        if (!w) return;
        w.postMessage({ type: STAGE_MESSAGE_TYPE, t: 0 }, STAGE_DEMO_ORIGIN);
        lastHello = now;
        return;
      }
      // Seek.
      const t = timeAt(p, ready);
      setInteractive(t === appliedT && performance.now() - lastMovement >= STAGE_INTERACTION_IDLE_MS);
      if (t === lastT) return;
      const w = deps.frameWindow();
      if (!w) return;
      appliedT = -1;
      w.postMessage({ type: STAGE_MESSAGE_TYPE, t }, STAGE_DEMO_ORIGIN);
      lastT = t;
    },
    dispose() {
      disposed = true;
      setExploring(false);
      exploreButton?.removeEventListener('click', toggleExploring);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('scroll', onScroll);
      setInteractive(false);
    },
  };
}

/**
 * Runs the publisher on animation frames while `active`, and only while the
 * section intersects the viewport (a pinned act six viewports tall is on screen
 * for a while; nothing is posted before it arrives or after it leaves).
 *
 * The publisher is created once per (sectionRef, active) mount. `deps` are
 * kept in a ref that is refreshed on every render and read on every tick, so
 * the act may pass unstable callbacks (a `frameWindow` that only starts
 * returning the iframe's window after its `load` event, an inline `track`)
 * without the loop re-subscribing or seeing stale closures.
 *
 * A throw inside a tick is logged and swallowed so the loop always re-arms;
 * one bad frame must not silence the stage for the rest of the scroll.
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
    const logged = new Set<string>();
    const loop = () => {
      try {
        pub.tick();
      } catch (err) {
        const key = err instanceof Error ? err.message : String(err);
        if (!logged.has(key)) {
          logged.add(key);
          console.error('[stage] tick failed', err);
        }
      }
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
