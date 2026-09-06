'use client';
import { useEffect, useState } from 'react';
import { StageStills } from './StageStills';
import { StageAct } from './StageAct';
import type { StageBeat } from '../../lib/stage-beats';

export const STAGE_MIN_WIDTH = 1024;
type Mode = 'stills' | 'act';

function actAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < STAGE_MIN_WIDTH) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  /** One proof line per beat (`STAGE_PROOF`): derived on the server, handed down as a plain object. */
  proof: Record<StageBeat, string>;
}

/**
 * Spec §8: the stills are the default (no JS, narrow, reduced motion, frame
 * failure); the pinned act is an upgrade decided after hydration so the server
 * and the first client render agree.
 *
 * The mode is decided once per page load and is not re-evaluated on resize
 * (§8 gates on the viewport at load). The stills → act upgrade changes the
 * page height by about five viewports (the act spans `STAGE_SPAN` × 100vh);
 * that is safe because it happens in a post-hydration effect, before the
 * visitor has scrolled far. `#stage-end` is the skip-link target rendered in
 * act mode only: the stills have no hidden focusables to skip.
 */
export function Stage({ proof }: Props) {
  const [mode, setMode] = useState<Mode>('stills');
  useEffect(() => {
    if (actAllowed()) setMode('act');
  }, []);
  if (mode === 'stills') return <StageStills />;
  return (
    <>
      <StageAct onFallback={() => setMode('stills')} proof={proof} />
      <span id="stage-end" tabIndex={-1} className="sr-only" />
    </>
  );
}
