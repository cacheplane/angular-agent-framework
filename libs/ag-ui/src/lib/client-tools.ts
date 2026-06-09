// SPDX-License-Identifier: MIT
import { computed, signal } from '@angular/core';
import type { AbstractAgent } from '@ag-ui/client';
import type { Tool, Message } from '@ag-ui/core';
import type { ClientToolsCapability, ClientToolResult, ClientToolSpec } from '@threadplane/chat';
import type { ReducerStore } from './reducer';

/**
 * Minimal subset of AbstractAgent used by createClientToolsCapability.
 * Typed narrowly so the factory is easy to fake in tests.
 */
export interface ClientToolsSource {
  addMessage(message: Parameters<AbstractAgent['addMessage']>[0]): void;
  runAgent(parameters?: { tools?: Tool[] }): Promise<unknown>;
}

/** Convert a ClientToolSpec to the AG-UI Tool wire shape. */
function toAgUiTool(spec: ClientToolSpec): Tool {
  return { name: spec.name, description: spec.description, parameters: spec.parameters };
}

/** Serialize a tool result value to a string for the ToolMessage content. */
function safeStringify(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

/**
 * Creates a ClientToolsCapability backed by an AG-UI source agent and a
 * ReducerStore. Extracted into a factory so it can be unit-tested in isolation
 * without standing up a full Angular DI environment.
 *
 * The capability:
 *  - Maintains a catalog of client tool specs (setCatalog).
 *  - Exposes a `pending` computed signal: tool calls whose name is in the catalog,
 *    have no backend result, and haven't been resolved client-side yet — but ONLY
 *    when the run is not in progress (isLoading===false). The backend ends the run
 *    without emitting TOOL_CALL_RESULT for client tools, so result stays undefined.
 *  - resolve(id, result): marks the call as resolved, adds a ToolMessage via
 *    source.addMessage, then re-runs the agent with the catalog tools attached.
 *
 * Call catalogAsAgUiTools() to get the current catalog as AG-UI Tool[] for
 * threading into runAgent().
 */
export function createClientToolsCapability(
  source: ClientToolsSource,
  store: ReducerStore,
): ClientToolsCapability & { catalogAsAgUiTools(): Tool[] } {
  const catalog = signal<readonly ClientToolSpec[]>([]);
  const resolvedIds = signal<ReadonlySet<string>>(new Set());

  function catalogAsAgUiTools(): Tool[] {
    return catalog().map(toAgUiTool);
  }

  const clientTools: ClientToolsCapability & { catalogAsAgUiTools(): Tool[] } = {
    setCatalog(specs: readonly ClientToolSpec[]): void {
      catalog.set([...specs]);
    },

    pending: computed(() => {
      // Client tools are only actionable after the run ends (backend signals it
      // by ending the run WITHOUT emitting TOOL_CALL_RESULT for client tools).
      if (store.isLoading()) return [];
      const names = new Set(catalog().map((s) => s.name));
      const done = resolvedIds();
      return store.toolCalls().filter(
        (tc) => names.has(tc.name) && tc.result === undefined && !done.has(tc.id),
      );
    }),

    resolve(id: string, result: ClientToolResult): void {
      // Mark as resolved first so pending() drops it immediately.
      resolvedIds.update((s) => new Set(s).add(id));

      const content = result.ok
        ? safeStringify(result.value)
        : `Error: ${result.error}`;

      source.addMessage({
        id: `tool-${id}`,
        role: 'tool',
        toolCallId: id,
        content,
      } as Message);

      void source.runAgent({ tools: catalogAsAgUiTools() });
    },

    catalogAsAgUiTools,
  };

  return clientTools;
}
