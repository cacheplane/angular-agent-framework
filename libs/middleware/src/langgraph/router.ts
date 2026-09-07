import { routeAfterAgent } from './middleware.js';
import type { ClientToolsState } from './types.js';

/**
 * A prebuilt conditional-edge callback. serverToolNames is bound once at construction;
 * the returned function takes only state.
 *
 *   graph.addConditionalEdges('agent', clientToolsRouter(names), ['server_tools', END]);
 *
 * `opts.toolsNode` defaults to `'server_tools'`; a graph carrying the client-tool
 * channels cannot name a node `tools`, because {@link clientToolsChannel} already
 * claims that name as a state channel.
 */
export function clientToolsRouter(
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): (state: ClientToolsState) => string {
  const names = [...serverToolNames];
  return (state: ClientToolsState) => routeAfterAgent(state, names, opts);
}
