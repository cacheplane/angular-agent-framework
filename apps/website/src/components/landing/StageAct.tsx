'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Container } from '../ui/Container';
import {
  HERO_TRUST_LINE,
  STAGE_CLOSE,
  STAGE_HOLD_LINE,
  STAGE_RAIL,
} from '../../lib/positioning';
import {
  STAGE_BEATS,
  STAGE_SPAN,
  beatWindows,
  closeCue,
  cueFor,
  holdCue,
  type StageBeat,
} from '../../lib/stage-beats';
import { trackStageProgress } from '../../lib/analytics/client';
import {
  STAGE_DEMO_ORIGIN,
  STAGE_DEMO_URL,
  useStagePublisher,
  type StageMilestone,
} from './use-stage-publisher';

const READY_TIMEOUT_MS = 8000;
const POSTER = '/screenshots/stage-stream.webp';

/**
 * Where the engine mounts. `ScrollCraft.mount(root)` collects acts with
 * `root.querySelectorAll('[data-sc-act]')`, which matches descendants only —
 * mounting on the section itself (which IS the act) finds zero acts. So the
 * engine mounts on the act's parent; `document` when it has none.
 */
export const engineRoot = (act: HTMLElement): Element | Document =>
  act.parentElement ?? document;

/**
 * Roots the engine has already been mounted on. The engine has no unmount
 * API: once mounted, its rAF loop and scroll/resize listeners run for the
 * life of the page, even after `onFallback` swaps the section out for the
 * stills (they then tick against a detached act — benign, but every extra
 * mount adds another loop, unbounded). Today only one mount happens anyway:
 * StrictMode runs effect → cleanup → effect synchronously, and the `cancelled`
 * flag drops the first effect's import continuation before it reaches
 * `mount`. This WeakSet is the guard that does not depend on that ordering.
 */
const mountedRoots = new WeakSet<Element | Document>();

interface Props {
  onFallback: () => void;
  /** One proof line per beat, derived from the recording on the server. */
  proof: Record<StageBeat, string>;
}

/**
 * The pinned act (spec §4.1, §6, §7). The engine owns scroll and `--sc-p`;
 * the publisher turns it into `t`; the iframe is the real `/stage`. Nothing in
 * here sets React state per frame.
 */
export function StageAct({ onFallback, proof }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /**
   * True once the iframe's `load` event has fired, i.e. its window has
   * navigated to the demo origin. A fresh iframe's `contentWindow` is still
   * `about:blank`, and a post to it with the demo's target origin is dropped
   * with a console error per post, so the publisher gets null until then.
   * A ref, not state: nothing renders off it, and the publisher reads it on
   * every tick.
   */
  const frameLoadedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  // Mount the engine once the act is in the DOM. The engine is an IIFE that
  // touches window at load, so it is imported on the client only.
  useEffect(() => {
    let cancelled = false;
    void import('../../vendor/scrollcraft/scrollcraft.js').then(() => {
      if (cancelled || !sectionRef.current || !window.ScrollCraft) return;
      const root = engineRoot(sectionRef.current);
      if (mountedRoots.has(root)) return;
      mountedRoots.add(root);
      window.ScrollCraft.mount(root);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ready timeout → the stills. A `ready` message that fails the publisher's
  // shape check (an older `/stage` build without `hold`/`reloadEndMs`) is
  // ignored, so this timeout drops to the stills — the intended degradation
  // while the demo and the website deploy minutes apart.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => onFallbackRef.current(), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready]);

  const track = useCallback(
    (m: StageMilestone, beat?: StageBeat) => trackStageProgress(m, beat),
    []
  );
  const frameWindow = useCallback(
    () =>
      frameLoadedRef.current ? iframeRef.current?.contentWindow ?? null : null,
    []
  );
  const onReady = useCallback(() => setReady(true), []);
  useStagePublisher(sectionRef, true, { frameWindow, track, onReady });

  /**
   * A segment click scrolls to the start of that beat: the beat window's
   * share of the act's travel (its height minus one viewport, which is what
   * the pin scrubs across), nudged 2% in so the engine reports the beat and
   * not the boundary. The act is only reached without reduced motion, so the
   * smooth behaviour is unconditional.
   */
  const scrollToBeat = (beat: StageBeat) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const w = beatWindows()[STAGE_BEATS.indexOf(beat)];
    window.scrollTo({
      top: top + (el.offsetHeight - window.innerHeight) * (w.from + 0.02),
      behavior: 'smooth',
    });
  };

  return (
    <section
      ref={sectionRef}
      id="stage"
      className="stage-act"
      data-stage-act
      data-sc-act="pin"
      data-sc-span={STAGE_SPAN}
      data-state={ready ? 'ready' : 'mounting'}
      aria-labelledby="stage-heading"
    >
      {/* The rail cues are hidden by opacity only, so their CTAs are taken
          out of the tab order (below) and the pin is skippable as a whole. */}
      <a className="stage-skip" href="#stage-end">
        Skip the stage
      </a>
      <div className="stage-pin" data-sc-stage>
        <Container className="stage-pin-inner">
          <div className="stage-frame">
            <BrowserFrame url="demo.threadplane.ai/stage" elevation="lg">
              <div className="stage-frame-stage">
                <img
                  src={POSTER}
                  width={1200}
                  height={720}
                  alt=""
                  aria-hidden="true"
                  className="stage-frame-poster"
                  decoding="async"
                />
                <iframe
                  ref={iframeRef}
                  src={STAGE_DEMO_URL}
                  title="Threadplane stage: a recorded LangGraph run, scrubbed by scroll"
                  className="stage-frame-iframe"
                  tabIndex={-1}
                  onLoad={() => {
                    frameLoadedRef.current = true;
                  }}
                />
              </div>
            </BrowserFrame>
            <a
              className="stage-frame-open"
              href={STAGE_DEMO_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the live demo →
            </a>
          </div>
          {/* The rail (stage-rail spec §3): the segment bar, one beat block per
              beat stacked in a single cell so the cues crossfade in place, the
              hold line, and the closing ledger. Segment and check state is
              written by the publisher, not React. */}
          <div className="stage-rail">
            <h2 id="stage-heading" className="sr-only">
              One real run: tools, persist, approve, render
            </h2>
            <nav className="stage-segs" aria-label="Stage beats">
              {STAGE_RAIL.map((b) => (
                <a
                  key={b.beat}
                  href={`#stage-${b.beat}`}
                  className="stage-seg"
                  data-stage-segment={b.beat}
                  data-beat-state="todo"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToBeat(b.beat);
                  }}
                >
                  {b.label}
                </a>
              ))}
            </nav>
            {STAGE_RAIL.map((b) => (
              <div
                className="stage-rail-beat"
                data-testid="stage-rail-beat"
                data-beat={b.beat}
                data-sc-cue={cueFor(b.beat)}
                key={b.beat}
              >
                <span
                  className="stage-check"
                  data-stage-check={b.beat}
                  aria-hidden="true"
                />
                <div>
                  <p className="stage-claim">{b.claim}</p>
                  <Link href={b.docs.href} className="stage-doc" tabIndex={-1}>
                    {b.docs.label}
                  </Link>
                  <p className="stage-proof" data-stage-proof>
                    {proof[b.beat]}
                  </p>
                </div>
              </div>
            ))}
            <p
              className="stage-rail-hold"
              data-testid="stage-rail-hold"
              data-sc-cue={holdCue()}
            >
              {STAGE_HOLD_LINE}
            </p>
            <div
              className="stage-rail-close"
              data-testid="stage-rail-close"
              data-sc-cue={closeCue()}
            >
              <ul className="stage-ledger">
                {STAGE_RAIL.map((b) => (
                  <li key={b.beat}>
                    <span
                      className="stage-check"
                      data-stage-check={b.beat}
                      aria-hidden="true"
                    />
                    {b.claim}
                    <Link
                      href={b.docs.href}
                      className="stage-doc"
                      tabIndex={-1}
                    >
                      {b.docs.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="stage-claim">{STAGE_CLOSE.claim}</p>
              <div className="stage-install">
                <code>{STAGE_CLOSE.install}</code>
                <Link
                  href={STAGE_CLOSE.cta.href}
                  className="stage-install-cta"
                  tabIndex={-1}
                >
                  {STAGE_CLOSE.cta.label} →
                </Link>
              </div>
              <p className="stage-trust">
                {HERO_TRUST_LINE} · LangGraph and AG-UI
              </p>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
