// SPDX-License-Identifier: MIT
import type { ClientToolSpec, ClientToolsState, OpenAIFunctionTool } from './types';

/** Read the catalog from state.tools, falling back to state.client_tools; drop nameless. */
function catalog(state: ClientToolsState): ClientToolSpec[] {
  const raw = state.tools && state.tools.length > 0 ? state.tools : state.client_tools;
  return (raw ?? []).filter((t): t is ClientToolSpec => !!t && typeof t === 'object' && !!t.name);
}

/** The client catalog as OpenAI function-tool dicts for `model.bindTools`. */
export function clientToolSpecs(state: ClientToolsState): OpenAIFunctionTool[] {
  return catalog(state).map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description ?? '', parameters: t.parameters ?? {} },
  }));
}

/** The set of tool names declared by the client in this run. */
export function clientToolNames(state: ClientToolsState): Set<string> {
  return new Set(catalog(state).map((t) => t.name));
}
