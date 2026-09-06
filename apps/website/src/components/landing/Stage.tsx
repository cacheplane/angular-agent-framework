'use client';
import { useEffect, useState } from 'react';
import { StageStills } from './StageStills';
import { StageAct } from './StageAct';

export const STAGE_MIN_WIDTH = 1024;
type Mode = 'stills' | 'act';

function actAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < STAGE_MIN_WIDTH) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Spec §8: the stills are the default (no JS, narrow, reduced motion, frame
 * failure); the pinned act is an upgrade decided after hydration so the server
 * and the first client render agree.
 */
export function Stage() {
  const [mode, setMode] = useState<Mode>('stills');
  useEffect(() => {
    if (actAllowed()) setMode('act');
  }, []);
  if (mode === 'stills') return <StageStills />;
  return <StageAct onFallback={() => setMode('stills')} />;
}
