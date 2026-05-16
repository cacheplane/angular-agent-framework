// SPDX-License-Identifier: MIT
import type { ChildProcess } from 'node:child_process';
import type { AimockHandle } from './aimock-runner';

interface SharedState {
  aimock: AimockHandle;
  langgraph: ChildProcess;
  angular: ChildProcess;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_HARNESS_STATE__: Map<string, SharedState> | undefined;
}

/**
 * Default Playwright globalTeardown. Walks every state slot the factory
 * registered (one per Angular project), kills processes in reverse order
 * (Angular → langgraph → aimock), awaits aimock stop. Idempotent.
 */
export default async function globalTeardown(): Promise<void> {
  const states = globalThis.__AIMOCK_HARNESS_STATE__;
  if (!states) return;
  for (const state of states.values()) {
    state.angular.kill('SIGTERM');
    state.langgraph.kill('SIGTERM');
    await state.aimock.stop();
  }
  globalThis.__AIMOCK_HARNESS_STATE__ = undefined;
}
