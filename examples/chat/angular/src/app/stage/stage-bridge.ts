import { isAllowedParentOrigin } from '../hero/hero-bridge';
import type { StagePhase, TimelineBeat } from './stage-timeline';

export const STAGE_MESSAGE_TYPE = 'tplane-stage';

export interface StageReady {
  totalMs: number;
  beats: readonly TimelineBeat[];
  /** The authored hold at the interrupt (timeline ms). */
  hold: { readonly startMs: number; readonly endMs: number };
  /** End of the reload run (the persist beat's, in the authored recording), or null when the recording has none. */
  reloadEndMs: number | null;
}

export interface StageState {
  applied: number;
  phase: StagePhase;
  t: number;
}

export interface StageBridge {
  onSeek(cb: (t: number) => void): () => void;
  postReady(ready: StageReady): void;
  postState(state: StageState): void;
}

interface BridgeEnv {
  referrer: string;
  parent: Window;
  self: Window;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The parent page owns scroll and posts `{ type: 'tplane-stage', t }`; the
 * frame answers with `{ ready, totalMs, beats }` once and `{ applied, phase, t }`
 * whenever its applied state changes. Same origin allowlist as the hero.
 */
export function createStageBridge(env: BridgeEnv): StageBridge {
  const fromReferrer = originOf(env.referrer);
  let parentOrigin: string | null =
    fromReferrer !== null && isAllowedParentOrigin(fromReferrer) ? fromReferrer : null;
  const embedded = env.parent !== env.self;
  const post = (msg: Record<string, unknown>) => {
    if (!embedded || parentOrigin === null) return;
    env.parent.postMessage({ type: STAGE_MESSAGE_TYPE, ...msg }, parentOrigin);
  };
  return {
    onSeek(cb) {
      const handler = (e: MessageEvent) => {
        if (e.source !== env.parent) return;
        if (!isAllowedParentOrigin(e.origin)) return;
        const d = e.data as { type?: string; t?: unknown } | null;
        if (!d || d.type !== STAGE_MESSAGE_TYPE || typeof d.t !== 'number' || !Number.isFinite(d.t)) return;
        // Under a strict Referrer-Policy the referrer is empty, so the first
        // allowlisted message is how the frame learns where to answer.
        if (parentOrigin === null) parentOrigin = e.origin;
        cb(d.t);
      };
      env.self.addEventListener('message', handler);
      return () => env.self.removeEventListener('message', handler);
    },
    postReady(ready) {
      post({
        ready: true,
        totalMs: ready.totalMs,
        beats: ready.beats,
        hold: ready.hold,
        reloadEndMs: ready.reloadEndMs,
      });
    },
    postState(state) {
      post({ applied: state.applied, phase: state.phase, t: state.t });
    },
  };
}

export function browserStageBridge(): StageBridge {
  return createStageBridge({ referrer: document.referrer, parent: window.parent, self: window });
}
