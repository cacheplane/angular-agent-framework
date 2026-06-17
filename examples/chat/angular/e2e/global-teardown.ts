// SPDX-License-Identifier: MIT
import { freePort, killTree } from './process-utils';

const LANGGRAPH_PORT = 2024;
const ANGULAR_PORT = 4200;

export default async function globalTeardown(): Promise<void> {
  const state = globalThis.__AIMOCK_E2E_STATE__;
  if (!state) return;
  // Reap the process GROUPS — `nx serve` / `langgraph dev` spawn child
  // processes that hold the actual sockets, so SIGTERM-ing the parent alone
  // leaves them orphaned on :4200 / :2024.
  await Promise.all([killTree(state.angular), killTree(state.langgraph)]);
  await state.aimock.stop();
  // Backstop: free the ports in case a child slipped the group reap.
  freePort(ANGULAR_PORT);
  freePort(LANGGRAPH_PORT);
  globalThis.__AIMOCK_E2E_STATE__ = undefined;
}
