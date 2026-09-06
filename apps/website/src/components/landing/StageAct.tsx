'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { STAGE_HOLD_LINES, STAGE_RAIL } from '../../lib/positioning';
import {
  STAGE_SPAN,
  cueFor,
  holdLineCues,
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
}

/**
 * The pinned act (spec §4.1, §6, §7). The engine owns scroll and `--sc-p`;
 * the publisher turns it into `t`; the iframe is the real `/stage`. Nothing in
 * here sets React state per frame.
 */
export function StageAct({ onFallback }: Props) {
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

  const holdCues = holdLineCues(STAGE_HOLD_LINES.length);

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
          <div className="stage-rail">
            <h2 id="stage-heading" className="sr-only">
              One real run: stream, persist, approve, render
            </h2>
            {STAGE_RAIL.map((b) => (
              <div
                className="stage-rail-beat"
                data-testid="stage-rail-beat"
                data-beat={b.beat}
                data-sc-cue={cueFor(b.beat)}
                key={b.beat}
              >
                <div className="feature-block-rail">
                  <Eyebrow tone="accent" className="feature-block-eyebrow">
                    {b.eyebrow}
                  </Eyebrow>
                  <span
                    className="feature-block-rail-line"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="feature-block-heading">{b.headline}</h3>
                <p className="feature-block-body">{b.body}</p>
                <div className="feature-block-rows">
                  {b.rows.map((row) => (
                    <div className="feature-block-row" key={row.claim}>
                      <span className="feature-block-row-claim">
                        {row.claim}
                      </span>
                      <span className="feature-block-row-api">{row.api}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={b.cta.href}
                  className="feature-block-cta"
                  tabIndex={-1}
                >
                  {b.cta.label} →
                </Link>
              </div>
            ))}
            {STAGE_HOLD_LINES.map((line, i) => (
              <p
                className="stage-rail-hold"
                data-testid="stage-rail-hold"
                data-sc-cue={holdCues[i]}
                key={line}
              >
                {line}
              </p>
            ))}
          </div>
        </Container>
      </div>
    </section>
  );
}
