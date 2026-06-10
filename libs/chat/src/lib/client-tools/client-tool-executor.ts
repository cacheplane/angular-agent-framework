// SPDX-License-Identifier: MIT
import { effect } from '@angular/core';
import type { Agent } from '../agent';
import type { ClientToolRegistry } from './tool-def';
import { executeFunctionTool } from './execute';

/**
 * Watches the agent's pending client tool calls and auto-runs FUNCTION tools,
 * resolving each with its result. View/ask (component) tools are handled by the
 * rendering layer, not here. No-op if the agent lacks the clientTools
 * capability. MUST be called in an injection context (sets up an effect).
 */
export function startClientToolExecutor(agent: Agent, registry: ClientToolRegistry): void {
  const cap = agent.clientTools;
  if (!cap) return;
  const inFlight = new Set<string>();
  effect(() => {
    for (const tc of cap.pending()) {
      const def = registry[tc.name];
      if (!def || def.kind !== 'function') continue; // non-function handled elsewhere
      // NB: do NOT skip on `tc.status === 'complete'`. A client tool call is
      // marked 'complete' once its args finish streaming, yet it still has no
      // result and needs the browser to execute it. `pending` already excludes
      // calls that have a result or were resolved; `inFlight` prevents a
      // double-dispatch within a render cycle.
      if (inFlight.has(tc.id)) continue;
      inFlight.add(tc.id);
      void executeFunctionTool(def, tc.args).then((result) => {
        cap.resolve(tc.id, result);
        inFlight.delete(tc.id);
      });
    }
  });
}
