// SPDX-License-Identifier: MIT
// SUBAGENT_* injection for Mastra delegation tool calls.
//
// Mastra surfaces a registered sub-agent as an ordinary backend tool named
// `agent-<childKey>`: TOOL_CALL_START → TOOL_CALL_ARGS → TOOL_CALL_END →
// TOOL_CALL_RESULT whose `content` is JSON `{text, subAgentThreadId, ...}`
// (measured: cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md).
// The upstream @ag-ui/mastra bridge drops the in-process child deltas
// (`case "tool-output": break`), so the honest wire contract here is a
// single final text chunk per delegation.
//
// This module is a pure transform over the outbound AG-UI event stream —
// keyed off the events themselves, NOT the Mastra delegation hooks, which
// fire in a different async context with no ordering guarantee relative to
// the Observable frames.
//
// Injected sequence per delegation tool call <tid> (child key = tool name
// minus the `agent-` prefix, subagentRunId = `<tid>-sub`):
// - AFTER TOOL_CALL_START:  SUBAGENT_STARTED {subagentRunId, name,
//   parentToolCallId}
// - BEFORE TOOL_CALL_RESULT (success): TEXT_MESSAGE_START/CONTENT/END
//   carrying the child's final text under the subagent identity, then
//   SUBAGENT_FINISHED {outcome:{type:'success'}}
// - BEFORE TOOL_CALL_RESULT (failure — parsed content says success:false
//   or finishReason:'error'): SUBAGENT_ERROR {subagentRunId, message}
// - Terminal cleanup: a RUN_ERROR or RUN_FINISHED arriving while
//   delegations are still pending (no TOOL_CALL_RESULT seen — e.g. the
//   Observable errored mid-delegation) closes each pending card with
//   SUBAGENT_ERROR before the terminal frame, so no card is left spinning.
//   In the measured captures the RESULT always precedes the terminal frame,
//   so this path is defensive only.

const AGENT_TOOL_PREFIX = 'agent-';

/**
 * Create a per-run injector.
 *
 * @returns {{ eventsFor(event: object): object[] }} — for each outbound
 *   AG-UI event, the ordered list of frames to write (injections plus the
 *   original event). Non-delegation events pass through as `[event]`.
 */
export function createSubagentInjector() {
  /** @type {Map<string, {subagentRunId: string, name: string}>} pending delegations by toolCallId */
  const pending = new Map();

  return {
    eventsFor(event) {
      switch (event.type) {
        case 'TOOL_CALL_START': {
          const name = event.toolCallName ?? '';
          if (!name.startsWith(AGENT_TOOL_PREFIX)) return [event];
          const entry = {
            subagentRunId: `${event.toolCallId}-sub`,
            name: name.slice(AGENT_TOOL_PREFIX.length),
          };
          pending.set(event.toolCallId, entry);
          return [
            event,
            {
              type: 'SUBAGENT_STARTED',
              subagentRunId: entry.subagentRunId,
              name: entry.name,
              parentToolCallId: event.toolCallId,
            },
          ];
        }

        case 'TOOL_CALL_RESULT': {
          const entry = pending.get(event.toolCallId);
          if (!entry) return [event]; // not a delegation (or unmatched) — pass through
          pending.delete(event.toolCallId);
          const { subagentRunId } = entry;

          const raw = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = undefined;
          }
          const failed =
            parsed !== undefined &&
            typeof parsed === 'object' &&
            parsed !== null &&
            (parsed.success === false || parsed.finishReason === 'error');
          if (failed) {
            return [
              {
                type: 'SUBAGENT_ERROR',
                subagentRunId,
                message: String(parsed.error ?? parsed.text ?? 'sub-agent delegation failed'),
              },
              event,
            ];
          }

          const text = typeof parsed?.text === 'string' ? parsed.text : raw;
          const messageId = `${event.toolCallId}-sub-m1`;
          return [
            { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', subagentRunId },
            { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: text, subagentRunId },
            { type: 'TEXT_MESSAGE_END', messageId, subagentRunId },
            { type: 'SUBAGENT_FINISHED', subagentRunId, outcome: { type: 'success' } },
            event,
          ];
        }

        case 'RUN_ERROR':
        case 'RUN_FINISHED': {
          if (pending.size === 0) return [event];
          const cleanup = [...pending.values()].map(({ subagentRunId }) => ({
            type: 'SUBAGENT_ERROR',
            subagentRunId,
            message: 'delegation did not complete before the run terminated',
          }));
          pending.clear();
          return [...cleanup, event];
        }

        default:
          return [event];
      }
    },
  };
}
