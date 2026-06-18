// SPDX-License-Identifier: MIT
import { effect } from '@angular/core';
import { views, type ViewRegistry } from '@threadplane/render';
import type { RenderEvent, RenderViewEntry } from '@threadplane/render';
import type { Agent, ToolCall } from '../agent';
import type { ClientToolRegistry, ClientToolDef } from './tool-def';
import type { ClientToolSpec } from './to-json-schema';
import { deriveJsonSchema } from './to-json-schema';
import { startClientToolExecutor } from './client-tool-executor';

export interface ClientToolsCoordinator {
  /** Components for `view`/`ask` tools, keyed by tool name — merge into the chat `views`. */
  readonly viewRegistry: ViewRegistry;
  /** Wire the coordinator to an agent: ship the catalog, run function tools, auto-ack view tools.
   *  MUST be called inside an injection context (sets up effects). Safe no-op if the agent lacks
   *  the clientTools capability. */
  connect(agent: Agent): void;
  /** Handle a render event bubbled up from a mounted view/ask component (resolves `ask` results). */
  handleRenderEvent(agent: Agent, event: RenderEvent): void;
}

/** Build the catalog spec list shipped to the model. */
export function toClientToolSpecs(registry: ClientToolRegistry): ClientToolSpec[] {
  return Object.entries(registry).map(([name, def]) => ({
    name,
    description: def.description,
    parameters: deriveJsonSchema(name, def.schema),
  }));
}

/** Map each view/ask tool to a RenderViewEntry that carries its schema, so the
 *  render lib can gate the real component's mount on schema-readiness (showing
 *  the fallback skeleton while a streaming tool call's args are still
 *  incomplete) instead of mounting a required-input component too early. */
function viewComponents(registry: ClientToolRegistry): Record<string, RenderViewEntry> {
  const out: Record<string, RenderViewEntry> = {};
  for (const [name, def] of Object.entries(registry)) {
    if (def.kind === 'view' || def.kind === 'ask') {
      out[name] = { component: def.component, schema: def.schema };
    }
  }
  return out;
}

export function createClientToolsCoordinator(registry: ClientToolRegistry): ClientToolsCoordinator {
  const viewRegistry = views(viewComponents(registry));
  const ackedViews = new Set<string>();

  return {
    viewRegistry,
    connect(agent: Agent): void {
      const cap = agent.clientTools;
      if (!cap) return;
      cap.setCatalog(toClientToolSpecs(registry));
      startClientToolExecutor(agent, registry); // function tools
      // Auto-ack `view` tools: they render but produce no user value.
      effect(() => {
        for (const tc of cap.pending()) {
          const def: ClientToolDef | undefined = registry[tc.name];
          if (!def || def.kind !== 'view') continue;
          if (ackedViews.has(tc.id)) continue;
          ackedViews.add(tc.id);
          cap.resolve(tc.id, { ok: true, value: { shown: true } });
        }
      });
    },
    handleRenderEvent(agent: Agent, event: RenderEvent): void {
      if (event.type !== 'result') return;
      const cap = agent.clientTools;
      if (!cap) return;
      // elementKey is the tool NAME in the tool-view spec; resolve the pending `ask`
      // call for that name with the component's emitted value.
      const name = event.elementKey;
      const pending = cap.pending().find(
        (tc: ToolCall) => tc.name === name && registry[tc.name]?.kind === 'ask',
      );
      if (pending) cap.resolve(pending.id, { ok: true, value: event.value });
    },
  };
}
