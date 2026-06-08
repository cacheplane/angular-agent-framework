// SPDX-License-Identifier: MIT
export default async function globalTeardown(): Promise<void> {
  const state = globalThis.__AIMOCK_E2E_STATE__;
  if (!state) return;
  state.angular.kill('SIGTERM');
  state.backend.kill('SIGTERM');
  await state.aimock.stop();
  globalThis.__AIMOCK_E2E_STATE__ = undefined;
}
