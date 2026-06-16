// SPDX-License-Identifier: MIT
import { routeAfterAgent } from './middleware.js';
import type { ClientToolsState } from './types.js';

/**
 * A prebuilt conditional-edge callback. serverToolNames is bound once at construction;
 * the returned function takes only state.
 *
 *   graph.addConditionalEdges('agent', clientToolsRouter([]), ['tools', END]);
 */
export function clientToolsRouter(
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): (state: ClientToolsState) => string {
  const names = [...serverToolNames];
  return (state: ClientToolsState) => routeAfterAgent(state, names, opts);
}
