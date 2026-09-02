// SPDX-License-Identifier: MIT
// SUBAGENT_* injection for Mastra delegation tool calls.
//
// Mastra surfaces a registered sub-agent as an ordinary backend tool named
// `agent-<childKey>`. On the wire the upstream @ag-ui/mastra bridge buffers
// that tool call and flushes TOOL_CALL_START → ARGS → END only when the
// TOOL_CALL_RESULT arrives (content = JSON `{text, subAgentThreadId, ...}`),
// and it DROPS the in-process child deltas (`case "tool-output": break`) —
// measured in cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md.
//
// This module is a pure per-run transform with TWO inputs:
//
// - `chunk(c)`: raw Mastra `fullStream` chunks, observed through the stream
//   tee (streaming-tee.mjs) BEFORE the bridge processes each one. This is
//   where the child text actually streams, so it is the primary emitter:
//   - `tool-call` named `agent-*` → synthesized EAGER TOOL_CALL_START/ARGS/END
//     (args are complete in the chunk; parentMessageId = the last
//     `start`/`step-start` chunk's messageId, the same id the bridge would
//     stamp) + SUBAGENT_STARTED {subagentRunId: `<tid>-sub`, name,
//     parentToolCallId}. The card needs the parent tool call present to mount,
//     so synthesis is required rather than optional.
//   - `tool-output` for a tracked id: inner `text-start` → attributed
//     TEXT_MESSAGE_START (opened lazily on the first delta if absent),
//     `text-delta` → TEXT_MESSAGE_CONTENT, `text-end` → TEXT_MESSAGE_END.
//     Inner tool chunks are ignored (out of scope).
//   - `tool-result` / `tool-error` → close any open message, then
//     SUBAGENT_FINISHED {success} or SUBAGENT_ERROR (result says
//     success:false / finishReason:'error', or the tool errored). When NO
//     delta was observed the old single-chunk TEXT_MESSAGE_* synthesis from
//     `result.text` fires as the fallback.
//   - `tool-call-suspended` → close any open message, SUBAGENT_FINISHED
//     {outcome:{type:'suspended'}}. The eager START has already been painted
//     (the bridge would have retracted it) — accepted caveat; the demo's
//     delegation never suspends.
//
// - `eventsFor(event)`: the bridge's outbound AG-UI events. For an id that
//   was synthesized above, the bridge's later buffered TOOL_CALL_START/ARGS/
//   END copies are DROPPED (its TOOL_CALL_RESULT passes through untouched).
//   For an id the chunk path never saw (tee not wired), the original
//   event-keyed behavior stays: SUBAGENT_STARTED after TOOL_CALL_START and the
//   single-chunk text + SUBAGENT_FINISHED/ERROR before TOOL_CALL_RESULT.
//   Terminal cleanup: RUN_ERROR / RUN_FINISHED with delegations still pending
//   closes open child messages and emits SUBAGENT_ERROR per pending id,
//   exactly once, before the terminal frame.

const AGENT_TOOL_PREFIX = 'agent-';

/**
 * @typedef {object} Entry
 * @property {string} subagentRunId
 * @property {string} name
 * @property {boolean} synthesized  TOOL_CALL_* were emitted from the chunk path
 * @property {boolean} deltasSeen   at least one child text delta was forwarded
 * @property {boolean} messageOpen
 * @property {string|undefined} messageId
 * @property {number} messageCount
 */

/** Result-shape failure check shared by both inputs. */
function parseResult(raw) {
  if (raw !== null && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isFailure(parsed) {
  return (
    parsed !== undefined &&
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed.success === false || parsed.finishReason === 'error')
  );
}

function failureMessage(parsed) {
  return String(parsed.error ?? parsed.text ?? 'sub-agent delegation failed');
}

/**
 * Create a per-run injector.
 *
 * @returns {{ chunk(chunk: object): object[], eventsFor(event: object): object[] }}
 *   `chunk` returns the AG-UI events to write for a raw Mastra chunk (usually
 *   none); `eventsFor` returns, for each outbound bridge event, the ordered
 *   list of frames to write (injections plus, unless deduped, the event).
 */
export function createSubagentInjector() {
  /** @type {Map<string, Entry>} pending delegations by toolCallId */
  const pending = new Map();
  /** Ids whose TOOL_CALL_START/ARGS/END were synthesized — bridge copies drop. */
  const synthesized = new Set();
  /** The bridge's current parent message id (last start/step-start chunk). */
  let parentMessageId;

  function newEntry(toolCallId, toolName, isSynthesized) {
    const entry = {
      subagentRunId: `${toolCallId}-sub`,
      name: toolName.slice(AGENT_TOOL_PREFIX.length),
      synthesized: isSynthesized,
      deltasSeen: false,
      messageOpen: false,
      messageId: undefined,
      messageCount: 0,
    };
    pending.set(toolCallId, entry);
    return entry;
  }

  function openMessage(toolCallId, entry) {
    entry.messageCount += 1;
    entry.messageId = `${toolCallId}-sub-m${entry.messageCount}`;
    entry.messageOpen = true;
    return {
      type: 'TEXT_MESSAGE_START',
      messageId: entry.messageId,
      role: 'assistant',
      subagentRunId: entry.subagentRunId,
    };
  }

  function closeMessage(entry) {
    if (!entry.messageOpen) return [];
    entry.messageOpen = false;
    return [{ type: 'TEXT_MESSAGE_END', messageId: entry.messageId, subagentRunId: entry.subagentRunId }];
  }

  /** Close + FINISHED/ERROR for a result; falls back to single-chunk text when no deltas streamed. */
  function finalize(toolCallId, entry, rawResult) {
    pending.delete(toolCallId);
    const { subagentRunId } = entry;
    const parsed = parseResult(rawResult);
    if (isFailure(parsed)) {
      return [...closeMessage(entry), { type: 'SUBAGENT_ERROR', subagentRunId, message: failureMessage(parsed) }];
    }
    const out = closeMessage(entry);
    if (!entry.deltasSeen) {
      const raw = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
      const text = typeof parsed?.text === 'string' ? parsed.text : raw;
      out.push(openMessage(toolCallId, entry));
      out.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: entry.messageId, delta: text, subagentRunId });
      out.push(...closeMessage(entry));
    }
    out.push({ type: 'SUBAGENT_FINISHED', subagentRunId, outcome: { type: 'success' } });
    return out;
  }

  function fail(toolCallId, entry, message) {
    pending.delete(toolCallId);
    return [...closeMessage(entry), { type: 'SUBAGENT_ERROR', subagentRunId: entry.subagentRunId, message }];
  }

  return {
    chunk(chunk) {
      const payload = chunk?.payload ?? {};
      switch (chunk?.type) {
        case 'start':
        case 'step-start': {
          if (payload.messageId) parentMessageId = payload.messageId;
          return [];
        }

        case 'tool-call': {
          const { toolCallId, toolName = '' } = payload;
          if (!toolCallId || !toolName.startsWith(AGENT_TOOL_PREFIX)) return [];
          const entry = newEntry(toolCallId, toolName, true);
          synthesized.add(toolCallId);
          return [
            {
              type: 'TOOL_CALL_START',
              ...(parentMessageId !== undefined ? { parentMessageId } : {}),
              toolCallId,
              toolCallName: toolName,
            },
            { type: 'TOOL_CALL_ARGS', toolCallId, delta: JSON.stringify(payload.args ?? {}) },
            { type: 'TOOL_CALL_END', toolCallId },
            {
              type: 'SUBAGENT_STARTED',
              subagentRunId: entry.subagentRunId,
              name: entry.name,
              parentToolCallId: toolCallId,
            },
          ];
        }

        case 'tool-output': {
          const entry = pending.get(payload.toolCallId);
          const inner = payload.output;
          if (!entry || !inner) return [];
          switch (inner.type) {
            case 'text-start':
              return [...closeMessage(entry), openMessage(payload.toolCallId, entry)];
            case 'text-delta': {
              const text = inner.payload?.text;
              if (typeof text !== 'string' || text.length === 0) return [];
              const out = entry.messageOpen ? [] : [openMessage(payload.toolCallId, entry)];
              entry.deltasSeen = true;
              out.push({
                type: 'TEXT_MESSAGE_CONTENT',
                messageId: entry.messageId,
                delta: text,
                subagentRunId: entry.subagentRunId,
              });
              return out;
            }
            case 'text-end':
              return closeMessage(entry);
            default:
              return []; // inner tool chunks etc. — out of scope
          }
        }

        case 'tool-result': {
          const entry = pending.get(payload.toolCallId);
          if (!entry) return [];
          return finalize(payload.toolCallId, entry, payload.result);
        }

        case 'tool-error': {
          const entry = pending.get(payload.toolCallId);
          if (!entry) return [];
          const err = payload.error;
          return fail(payload.toolCallId, entry, String(err?.message ?? err ?? 'sub-agent delegation failed'));
        }

        case 'tool-call-suspended': {
          const entry = pending.get(payload.toolCallId);
          if (!entry) return [];
          pending.delete(payload.toolCallId);
          return [
            ...closeMessage(entry),
            { type: 'SUBAGENT_FINISHED', subagentRunId: entry.subagentRunId, outcome: { type: 'suspended' } },
          ];
        }

        default:
          return [];
      }
    },

    eventsFor(event) {
      switch (event.type) {
        case 'TOOL_CALL_START': {
          if (synthesized.has(event.toolCallId)) return []; // eager copy already on the wire
          const name = event.toolCallName ?? '';
          if (!name.startsWith(AGENT_TOOL_PREFIX)) return [event];
          const entry = newEntry(event.toolCallId, name, false);
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

        case 'TOOL_CALL_ARGS':
        case 'TOOL_CALL_END':
          return synthesized.has(event.toolCallId) ? [] : [event];

        case 'TOOL_CALL_RESULT': {
          const entry = pending.get(event.toolCallId);
          if (!entry) return [event]; // not a delegation, already finalized by the chunk path, or unmatched
          return [...finalize(event.toolCallId, entry, event.content), event];
        }

        case 'RUN_ERROR':
        case 'RUN_FINISHED': {
          if (pending.size === 0) return [event];
          const cleanup = [...pending.entries()].flatMap(([toolCallId, entry]) =>
            fail(toolCallId, entry, 'delegation did not complete before the run terminated'),
          );
          pending.clear();
          return [...cleanup, event];
        }

        default:
          return [event];
      }
    },
  };
}
