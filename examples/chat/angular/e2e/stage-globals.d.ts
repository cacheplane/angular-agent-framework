import type { StageState } from '../src/app/stage/stage-bridge';
import type { StageTimeline } from '../src/app/stage/stage-timeline';

// Mirrors the augmentation in stage-mode.component.ts: the e2e tsconfig does
// not compile src/, so the stage specs and the still recorder share this copy.
declare global {
  interface Window {
    __stageTimeline?: StageTimeline;
    __stageApplied?: StageState;
  }
}
