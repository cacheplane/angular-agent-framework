// SPDX-License-Identifier: MIT
export default async function globalTeardown(): Promise<void> {
  const state = globalThis.__COCKPIT_AIMOCK_E2E_STATE__;
  if (!state) return;
  state.angular.kill('SIGTERM');
  state.langgraph.kill('SIGTERM');
  await state.aimock.stop();
  globalThis.__COCKPIT_AIMOCK_E2E_STATE__ = undefined;
}
