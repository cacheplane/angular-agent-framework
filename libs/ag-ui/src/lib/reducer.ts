// SPDX-License-Identifier: MIT
// @ag-ui/client@0.0.52 — EventType is a string enum with uppercase values.
// Discriminator strings (e.g. 'RUN_STARTED') match EventType enum members
// verbatim; the switch cases below use the string literals directly so this
// file has no runtime dependency on the EventType enum import.
import { signal, type WritableSignal } from '@angular/core';
import type { Subject } from 'rxjs';
import {
  completeDelivery,
  staticDelivery,
  streamingDelivery,
  toAgentError,
  type AgentError,
  type CompleteOutcome,
} from '@threadplane/chat';
import type {
  Message, AgentStatus, ToolCall, AgentEvent, AgentInterrupt,
} from '@threadplane/chat';
import type { BaseEvent } from '@ag-ui/client';
import { applyPatch, type JsonPatchOp } from './internal/apply-patch';
import { bridgeCitationsState } from './bridge-citations-state';

/**
 * AG-UI AssistantMessage shape as it arrives on the wire in a MESSAGES_SNAPSHOT.
 * The `toolCalls` field carries full ToolCall objects (id + function { name, arguments }).
 * This is distinct from the chat lib's `Message.toolCallIds` which is a plain string[].
 */
interface AgUiSnapshotToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface AgUiSnapshotMessage {
  id: string;
  role: string;
  content?: string;
  toolCalls?: AgUiSnapshotToolCall[];
  [key: string]: unknown;
}

/**
 * A custom event surfaced to consumers via the agent's `customEvents` signal.
 * Mirrors the LangGraph adapter's CustomStreamEvent shape so the chat
 * a2ui partial-args bridge consumes both transports identically.
 */
export interface CustomStreamEvent {
  /** Event name set by the backend (e.g. 'a2ui-partial', 'state_update'). */
  name: string;
  /** Arbitrary payload from the backend (JSON-string values are parsed). */
  data: unknown;
}

/** A native AG-UI ACTIVITY (typed, identified, incrementally-streamed sub-process).
 *  Generic — keyed by messageId, grouped by activityType. toAgent projects
 *  activityType==='subagent' to the neutral Subagent contract. */
export interface ActivityEntry {
  messageId: string;
  activityType: string;
  generation: string;
  content: WritableSignal<Record<string, unknown>>;
}

export interface ReducerDeliveryRun {
  generation: string;
  baselineMessageIds: Set<string>;
  ownedMessageIds: Set<string>;
  snapshotReplacementIds: Set<string>;
  eligibleBaselineAssistantId?: string;
  currentAssistantMessageId?: string;
  protocolRunId?: string;
  outcome?: CompleteOutcome;
}

export interface ReducerStore {
  messages:     WritableSignal<Message[]>;
  status:       WritableSignal<AgentStatus>;
  isLoading:    WritableSignal<boolean>;
  error:        WritableSignal<AgentError | undefined>;
  toolCalls:    WritableSignal<ToolCall[]>;
  state:        WritableSignal<Record<string, unknown>>;
  interrupt:    WritableSignal<AgentInterrupt | undefined>;
  events$:      Subject<AgentEvent>;
  customEvents: WritableSignal<CustomStreamEvent[]>;
  activities: WritableSignal<Map<string, ActivityEntry>>;
  deliveryRun: ReducerDeliveryRun | null;
  allocateDeliveryGeneration(scope: string): string;
  /** Accumulated raw TOOL_CALL_ARGS text per toolCallId. A live model streams
   *  args as many partial-JSON fragments, so each delta must be appended here
   *  and the ACCUMULATED buffer parsed — parsing a lone delta only succeeds
   *  when the whole payload happens to arrive in one chunk (e.g. test
   *  fixtures). Lazily created by the reducer; entries dropped on
   *  TOOL_CALL_END. */
  argsBuffers?: Map<string, string>;
}

/** Finalize one run without touching messages owned by another generation. */
export function finalizeDeliveryRun(
  store: ReducerStore,
  run: ReducerDeliveryRun,
  outcome: CompleteOutcome,
): boolean {
  if (run.outcome !== undefined) return false;
  run.outcome = outcome;
  store.messages.update(messages => messages.map(message =>
    message.delivery.generation === run.generation
      ? { ...message, delivery: completeDelivery(run.generation, outcome) }
      : message,
  ));
  return true;
}

/**
 * Per-message reasoning timing. Populated by REASONING_MESSAGE_START /
 * REASONING_MESSAGE_END handlers. The map lives on the module — same
 * scope as the reducer function. ReducerStore stays free of timing
 * state; consumers read it via `Message.reasoningDurationMs` on
 * messages that completed reasoning.
 *
 * Keyed by messageId. We do not need cross-thread isolation here:
 * AG-UI's source agent recreates the reducer pipeline per session, and
 * messageIds are unique within a session.
 */
const reasoningTimingMap = new Map<string, { startedAt: number; endedAt?: number }>();

function resolveReasoningDurationMs(messageId: string): number | undefined {
  const entry = reasoningTimingMap.get(messageId);
  if (!entry || entry.endedAt === undefined) return undefined;
  return entry.endedAt - entry.startedAt;
}

/**
 * Pure function: applies a single AG-UI BaseEvent to the store. Caller
 * subscribes to source.agent() and forwards each event here. Designed
 * for testability — no side effects beyond the supplied store.
 */
export function reduceEvent(event: BaseEvent, store: ReducerStore): void {
  switch (event.type) {
    case 'RUN_STARTED': {
      const run = store.deliveryRun;
      if (!run || run.outcome !== undefined || !bindRunId(event, run)) return;
      store.status.set('running');
      store.isLoading.set(true);
      store.error.set(undefined);
      store.interrupt.set(undefined);
      store.customEvents.set([]);
      store.activities.set(new Map());
      return;
    }
    case 'RUN_FINISHED': {
      const run = currentRunForEvent(event, store);
      if (!run || !finalizeDeliveryRun(store, run, 'success')) return;
      store.status.set('idle');
      store.isLoading.set(false);
      return;
    }
    case 'RUN_ERROR': {
      const run = currentRunForEvent(event, store);
      if (!run || !finalizeDeliveryRun(store, run, 'error')) return;
      store.status.set('error');
      store.isLoading.set(false);
      const runErrorMsg = (event as { message?: unknown }).message;
      store.error.set(toAgentError(
        typeof runErrorMsg === 'string' ? new Error(runErrorMsg) : (runErrorMsg ?? event),
      ));
      return;
    }
    case 'TEXT_MESSAGE_START': {
      const id = messageIdFrom(event);
      const delivery = ownAssistantMessage(store, id);
      if (!delivery) return;
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id ? { ...m, content: m.content ?? '', delivery } : m)
          : [...prev, { id, role: 'assistant', content: '', delivery }],
      );
      return;
    }
    case 'REASONING_MESSAGE_START': {
      const id = messageIdFrom(event);
      const delivery = ownAssistantMessage(store, id);
      if (!delivery) return;
      reasoningTimingMap.set(id, { startedAt: Date.now() });
      // Initialize an assistant slot with empty reasoning if it doesn't already exist.
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id
              ? { ...m, reasoning: m.reasoning ?? '', delivery }
              : m)
          : [...prev, { id, role: 'assistant', content: '', reasoning: '', delivery }],
      );
      return;
    }
    case 'REASONING_MESSAGE_CONTENT':
    case 'REASONING_MESSAGE_CHUNK': {
      const id = messageIdFrom(event);
      const delivery = ownAssistantMessage(store, id);
      if (!delivery) return;
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id
          ? { ...m, reasoning: (m.reasoning ?? '') + delta, delivery }
          : m),
      );
      return;
    }
    case 'REASONING_MESSAGE_END': {
      const id = messageIdFrom(event);
      const entry = reasoningTimingMap.get(id);
      if (entry) {
        entry.endedAt = Date.now();
        reasoningTimingMap.set(id, entry);
        const duration = resolveReasoningDurationMs(id);
        if (duration !== undefined) {
          store.messages.update((prev) =>
            prev.map((m) => m.id === id ? { ...m, reasoningDurationMs: duration } : m),
          );
        }
      }
      return;
    }
    case 'TEXT_MESSAGE_CONTENT': {
      const id = messageIdFrom(event);
      const delivery = ownAssistantMessage(store, id);
      if (!delivery) return;
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id ? { ...m, content: m.content + delta, delivery } : m),
      );
      return;
    }
    case 'TEXT_MESSAGE_END': {
      // No-op — message is finalized by virtue of TEXT_MESSAGE_CONTENT
      // having been applied. Reserved for future hooks.
      return;
    }
    case 'TOOL_CALL_START': {
      const e = event as unknown as { toolCallId: string; toolCallName: string; parentMessageId?: string };
      store.toolCalls.update((prev) => [
        ...prev,
        { id: e.toolCallId, name: e.toolCallName, args: {}, status: 'running' },
      ]);
      // Link the tool call to its parent assistant message so the chat lib's
      // per-message tool-call resolution (chat-tool-calls / chat-tool-views)
      // can scope it. ag-ui-langgraph emits parentMessageId for every tool
      // call. If the parent assistant message hasn't been created yet (a
      // tool-call-only turn emits no TEXT_MESSAGE_START), create a slot.
      const parentId = e.parentMessageId;
      if (parentId) {
        const delivery = ownAssistantMessage(store, parentId);
        if (!delivery) return;
        store.messages.update((prev) => {
          const existing = prev.find((m) => m.id === parentId);
          if (existing) {
            return prev.map((m) =>
              m.id === parentId
                ? { ...m, toolCallIds: [...(m.toolCallIds ?? []), e.toolCallId], delivery }
                : m,
            );
          }
          return [...prev, { id: parentId, role: 'assistant', content: '', toolCallIds: [e.toolCallId], delivery }];
        });
      }
      return;
    }
    case 'TOOL_CALL_ARGS': {
      const e = event as unknown as { toolCallId: string; delta: string };
      // Deltas are FRAGMENTS of a JSON document, not standalone JSON: a live
      // model streams args token-by-token (`{"loca`, `tion":"Pa`, …), so we
      // accumulate the raw text and parse the accumulated buffer. Until the
      // buffer parses, keep the last-good args (initially {}).
      const buffers = (store.argsBuffers ??= new Map<string, string>());
      const buffer = (buffers.get(e.toolCallId) ?? '') + e.delta;
      buffers.set(e.toolCallId, buffer);
      const args = tryParseArgs(buffer);
      if (args !== undefined) {
        store.toolCalls.update((prev) =>
          prev.map((t) => t.id === e.toolCallId ? { ...t, args } : t),
        );
      }
      return;
    }
    case 'TOOL_CALL_END': {
      const e = event as unknown as { toolCallId: string };
      // Belt and braces: apply the final accumulated args (in case the last
      // ARGS delta arrived but an intermediate state was left unparsed), then
      // drop the buffer.
      const finalBuffer = store.argsBuffers?.get(e.toolCallId);
      store.argsBuffers?.delete(e.toolCallId);
      const finalArgs = finalBuffer !== undefined ? tryParseArgs(finalBuffer) : undefined;
      store.toolCalls.update((prev) =>
        prev.map((t) =>
          t.id === e.toolCallId
            ? { ...t, status: 'complete', ...(finalArgs !== undefined ? { args: finalArgs } : {}) }
            : t,
        ),
      );
      return;
    }
    case 'TOOL_CALL_RESULT': {
      const e = event as unknown as { toolCallId: string; content: unknown };
      // ag_ui_langgraph serialises tool results via normalize_tool_content()
      // which always returns a string. Parse it so downstream consumers
      // (chat-tool-views / toToolViewSpec) can spread the object into props.
      const result = typeof e.content === 'string' ? safeParseJson(e.content) : e.content;
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, result } : t),
      );
      return;
    }
    case 'STATE_SNAPSHOT': {
      const e = event as unknown as { snapshot: Record<string, unknown> };
      const snapshot = e.snapshot ?? {};
      store.state.set(snapshot);
      store.messages.update(msgs => bridgeCitationsState({ state: snapshot }, msgs));
      return;
    }
    case 'STATE_DELTA': {
      const e = event as unknown as { delta: JsonPatchOp[] };
      const next = applyPatch(deepClone(store.state()), e.delta);
      store.state.set(next);
      store.messages.update(msgs => bridgeCitationsState({ state: next }, msgs));
      return;
    }
    case 'MESSAGES_SNAPSHOT': {
      const e = event as unknown as { messages: AgUiSnapshotMessage[] };
      const raw = e.messages ?? [];
      const run = store.deliveryRun?.outcome === undefined ? store.deliveryRun : null;
      const canonicalAssistantId = resolveCanonicalAssistantId(raw, run);
      const activeCanonicalAssistantId = canonicalAssistantId
        && ownAssistantMessage(store, canonicalAssistantId)
        ? canonicalAssistantId
        : undefined;
      const previousById = new Map(store.messages().map(message => [message.id, message]));
      // AG-UI AssistantMessage carries `toolCalls` (ToolCall objects) on the
      // snapshot wire. Bridge them to `toolCallIds` so that the chat lib's
      // per-message tool-call resolution (resolveMessageToolCalls) can scope
      // correctly. Also merge any snapshot-only tool calls into store.toolCalls
      // so the data is visible to <chat-tool-views>.
      const snapshotToolCalls: ToolCall[] = [];
      const messages: Message[] = raw.map((m) => {
        const previous = previousById.get(m.id);
        const completedMessage = m.id !== activeCanonicalAssistantId
          && previous?.delivery.phase === 'complete'
          && (
            !run
            || run.ownedMessageIds.has(m.id)
            || run.snapshotReplacementIds.has(m.id)
          )
          ? previous
          : undefined;
        let delivery = previous?.delivery ?? staticDelivery(m.id);
        let snapshotMessage: Omit<Message, 'delivery'>;
        if (m.role !== 'assistant' || !m.toolCalls || m.toolCalls.length === 0) {
          snapshotMessage = m as unknown as Omit<Message, 'delivery'>;
        } else {
          const ids: string[] = [];
          for (const tc of m.toolCalls) {
            ids.push(tc.id);
            snapshotToolCalls.push({
              id: tc.id,
              name: tc.function.name,
              args: safeParseArgs(tc.function.arguments),
              status: 'complete',
            });
          }
          const { toolCalls: _dropped, ...rest } = m;
          snapshotMessage = { ...rest, toolCallIds: ids } as unknown as Omit<Message, 'delivery'>;
        }
        if (completedMessage) {
          const snapshotChanged = completedMessage.content !== snapshotMessage.content
            || !sameStringArray(completedMessage.toolCallIds, snapshotMessage.toolCallIds);
          if (!snapshotChanged) return completedMessage;

          run?.snapshotReplacementIds.add(m.id);
          return {
            ...completedMessage,
            ...snapshotMessage,
            delivery: completeDelivery(
              store.allocateDeliveryGeneration(`snapshot:${m.id}`),
              'success',
            ),
          } as Message;
        }
        if (run && (run.ownedMessageIds.has(m.id) || m.id === canonicalAssistantId)) {
          delivery = delivery.generation === run.generation && delivery.phase === 'complete'
            ? delivery
            : streamingDelivery(run.generation);
          run.ownedMessageIds.add(m.id);
          if (m.id === activeCanonicalAssistantId) run.currentAssistantMessageId = m.id;
        }
        return { ...snapshotMessage, delivery } as Message;
      });
      const currentAssistant = run?.currentAssistantMessageId
        ? previousById.get(run.currentAssistantMessageId)
        : undefined;
      if (
        run
        && currentAssistant?.delivery.generation === run.generation
        && currentAssistant.delivery.phase === 'streaming'
        && !messages.some(message => message.id === currentAssistant.id)
      ) {
        messages.push(currentAssistant);
      }
      // Re-apply per-message citations from the already-received STATE. A
      // MESSAGES_SNAPSHOT replaces the streamed messages wholesale — and the
      // final snapshot message id (str(AIMessage.id), e.g. "resp-…") differs
      // from the streaming chunk id the earlier STATE_SNAPSHOT bridged against,
      // so without re-bridging here the citations (keyed by the final id) would
      // be dropped on the message swap.
      store.messages.set(bridgeCitationsState({ state: store.state() }, messages));
      if (snapshotToolCalls.length > 0) {
        store.toolCalls.update((prev) => {
          // Merge: keep existing entries (they may carry richer state from
          // streaming) and only insert entries not already present by id.
          const existingIds = new Set(prev.map((tc) => tc.id));
          const toAdd = snapshotToolCalls.filter((tc) => !existingIds.has(tc.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }
      return;
    }
    case 'CUSTOM': {
      const e = event as unknown as { name: string; value: unknown };
      // ag_ui_langgraph serializes interrupt payloads as JSON strings.
      // Parse the value if it arrives as a string so downstream consumers
      // (e.g. ChatApprovalCardComponent) receive a plain object, not a string.
      const parsedValue = typeof e.value === 'string' ? safeParseJson(e.value) : e.value;
      if (e.name === 'on_interrupt') {
        const run = currentRunForEvent(event, store);
        if (store.deliveryRun && !run) return;
        store.interrupt.set({ id: randomId(), value: parsedValue, resumable: true });
        if (run && finalizeDeliveryRun(store, run, 'paused')) {
          store.status.set('idle');
          store.isLoading.set(false);
        }
        return;
      }
      // Surface every other custom event on the customEvents signal so the
      // chat a2ui partial-args bridge (which reads agent.customEvents()) lights
      // up live/progressive a2ui rendering — parity with the LangGraph adapter.
      store.customEvents.update((prev) => [...prev, { name: e.name, data: parsedValue }]);
      if (e.name === 'state_update' && isRecord(parsedValue)) {
        store.events$.next({ type: 'state_update', data: parsedValue });
      } else {
        store.events$.next({ type: 'custom', name: e.name, data: parsedValue });
      }
      return;
    }
    case 'ACTIVITY_SNAPSHOT': {
      const e = event as unknown as {
        messageId: string; activityType: string;
        content: Record<string, unknown>; replace?: boolean;
      };
      const map = new Map(store.activities());
      const existing = map.get(e.messageId);
      if (existing && existing.activityType === e.activityType) {
        if (e.replace) existing.content.set(e.content ?? {});
        else existing.content.update((c) => ({ ...c, ...e.content }));
      } else {
        map.set(e.messageId, {
          messageId: e.messageId,
          activityType: e.activityType,
          generation: store.allocateDeliveryGeneration(`activity:${e.messageId}`),
          content: signal<Record<string, unknown>>(e.content ?? {}),
        });
      }
      store.activities.set(map);   // new ref → projection picks up membership change
      return;
    }
    case 'ACTIVITY_DELTA': {
      const e = event as unknown as {
        messageId: string; patch: readonly JsonPatchOp[];
      };
      const entry = store.activities().get(e.messageId);
      if (!entry) return;          // unknown activity — ignore
      entry.content.update((c) => {
        try {
          return applyPatch(c, e.patch);
        } catch (err) {
          // A malformed/out-of-order ACTIVITY_DELTA must not break the stream — drop it.
          if (typeof console !== 'undefined') console.warn('[ag-ui] dropping malformed ACTIVITY_DELTA patch', err);
          return c;
        }
      });  // inner signal → live, no map churn
      return;
    }
    default: {
      // Unknown event types are ignored; AG-UI may add new ones in
      // future protocol versions. We surface them as no-ops rather
      // than throwing, so a partial-version mismatch doesn't crash.
      return;
    }
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

function eventRunId(event: BaseEvent): string | undefined {
  const runId = (event as { runId?: unknown }).runId;
  return typeof runId === 'string' ? runId : undefined;
}

function bindRunId(event: BaseEvent, run: ReducerDeliveryRun): boolean {
  const runId = eventRunId(event);
  if (!runId) return true;
  if (run.protocolRunId && run.protocolRunId !== runId) return false;
  run.protocolRunId = runId;
  return true;
}

function currentRunForEvent(event: BaseEvent, store: ReducerStore): ReducerDeliveryRun | null {
  const run = store.deliveryRun;
  if (!run || !bindRunId(event, run)) return null;
  return run;
}

function ownAssistantMessage(store: ReducerStore, id: string) {
  const run = store.deliveryRun;
  if (!run || run.outcome !== undefined) return undefined;
  const currentId = run.currentAssistantMessageId;
  if (currentId && currentId !== id) {
    if (run.ownedMessageIds.has(id)) return undefined;
    store.messages.update(messages => messages.map(message =>
      message.id === currentId
        && message.delivery.generation === run.generation
        && message.delivery.phase === 'streaming'
        ? { ...message, delivery: completeDelivery(run.generation, 'success') }
        : message,
    ));
  }
  run.ownedMessageIds.add(id);
  run.currentAssistantMessageId = id;
  return streamingDelivery(run.generation);
}

function sameStringArray(left?: string[], right?: string[]): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function resolveCanonicalAssistantId(
  messages: readonly AgUiSnapshotMessage[],
  run: ReducerDeliveryRun | null,
): string | undefined {
  if (!run) return undefined;
  if (
    run.currentAssistantMessageId
    && messages.some(message => message.id === run.currentAssistantMessageId)
  ) {
    return run.currentAssistantMessageId;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && !run.baselineMessageIds.has(message.id)) {
      return message.id;
    }
  }
  return run.eligibleBaselineAssistantId
    && messages.some(message =>
      message.role === 'assistant' && message.id === run.eligibleBaselineAssistantId
    )
      ? run.eligibleBaselineAssistantId
      : undefined;
}

function messageIdFrom(event: BaseEvent): string {
  return (event as { messageId?: string }).messageId ?? 'unknown';
}

function safeParseArgs(delta: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(delta);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Parse an (accumulated) args buffer; `undefined` when it isn't valid JSON
 *  yet — callers keep the previous args rather than clobbering them with {}. */
function tryParseArgs(buffer: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(buffer);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Parse a JSON string to its value; return the original string on failure. */
function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
