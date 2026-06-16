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

import type { BaseMessage } from './types';

interface ToolCallLike {
  name?: string;
  function?: { name?: string };
}

function toolCalls(message: unknown): ToolCallLike[] {
  const tc = (message as { tool_calls?: unknown } | null)?.tool_calls;
  return Array.isArray(tc) ? (tc as ToolCallLike[]) : [];
}

function callName(call: ToolCallLike): string | undefined {
  return call.name ?? call.function?.name;
}

/** The last message from state.messages, or undefined. */
export function lastMessage(state: ClientToolsState): BaseMessage | undefined {
  const msgs = state.messages ?? [];
  return msgs.length ? msgs[msgs.length - 1] : undefined;
}

/** True if the last message calls at least one client tool. */
export function hasClientToolCall(state: ClientToolsState): boolean {
  const names = clientToolNames(state);
  return toolCalls(lastMessage(state)).some((c) => {
    const n = callName(c);
    return n !== undefined && names.has(n);
  });
}

/**
 * True if the last message calls at least one server (non-client) tool.
 * A call is server-side when its name is in serverToolNames OR is not a known
 * client tool (unknown tools are assumed server-side).
 */
export function hasServerToolCall(state: ClientToolsState, serverToolNames: Iterable<string>): boolean {
  const server = new Set(serverToolNames);
  const client = clientToolNames(state);
  return toolCalls(lastMessage(state)).some((c) => {
    const n = callName(c);
    return n !== undefined && (server.has(n) || !client.has(n));
  });
}
