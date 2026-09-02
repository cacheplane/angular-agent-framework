// SPDX-License-Identifier: MIT
import { dirname, join } from 'node:path';
import type { AimockStartOptions } from './aimock-runner';

export interface AimockLaunch {
  startOptions: AimockStartOptions;
  /** Value for the spawned backend's OPENAI_API_KEY. Record mode proxies
   * upstream, so the auth header must be real; replay never leaves the mock. */
  openaiApiKey: string;
}

/**
 * Resolve replay-vs-record from the environment, the same contract the
 * examples/chat harness established: AIMOCK_MODE=record flips the proxy on,
 * AIMOCK_RECORD_DIR overrides the capture location (default: a sibling
 * `.aimock-recordings/` next to the fixtures dir).
 */
export function resolveAimockLaunch(fixturesDir: string): AimockLaunch {
  const mode = process.env['AIMOCK_MODE'];
  if (mode !== undefined && mode !== 'record' && mode !== 'replay') {
    // A typo (`Record`, `recording`, ...) would otherwise silently replay
    // against stale fixtures while the operator believes they are recording.
    console.warn(`[aimock-harness] unrecognized AIMOCK_MODE="${mode}" — falling back to replay`);
  }
  if (mode === 'record') {
    if (!process.env['OPENAI_API_KEY']) {
      throw new Error(
        '[aimock-harness] AIMOCK_MODE=record requires OPENAI_API_KEY — the record proxy forwards requests to the live provider.',
      );
    }
    return {
      startOptions: {
        mode: 'record',
        recordDir: process.env['AIMOCK_RECORD_DIR'] ?? join(dirname(fixturesDir), '.aimock-recordings'),
      },
      openaiApiKey: process.env['OPENAI_API_KEY'],
    };
  }
  return {
    startOptions: { mode: 'replay', fixturePath: fixturesDir },
    openaiApiKey: 'test-not-used',
  };
}
