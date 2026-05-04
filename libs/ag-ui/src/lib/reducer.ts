// SPDX-License-Identifier: MIT
// @ag-ui/client@0.0.52 — EventType is a string enum with uppercase values.
// Discriminator strings (e.g. 'RUN_STARTED') match EventType enum members
// verbatim; the switch cases below use the string literals directly so this
// file has no runtime dependency on the EventType enum import.
import type { WritableSignal } from '@angular/core';
import type { Subject } from 'rxjs';
import type {
  Message, AgentStatus, ToolCall, AgentEvent,
} from '@ngaf/chat';
import type { BaseEvent } from '@ag-ui/client';
import { applyPatch, type Operation } from 'fast-json-patch';
import { bridgeCitationsState } from './bridge-citations-state';

export interface ReducerStore {
  messages:  WritableSignal<Message[]>;
  status:    WritableSignal<AgentStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  events$:   Subject<AgentEvent>;
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
      store.status.set('running');
      store.isLoading.set(true);
      store.error.set(null);
      return;
    }
    case 'RUN_FINISHED': {
      store.status.set('idle');
      store.isLoading.set(false);
      return;
    }
    case 'RUN_ERROR': {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set((event as { message?: unknown }).message ?? event);
      return;
    }
    case 'TEXT_MESSAGE_START': {
      const id = messageIdFrom(event);
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id ? { ...m, content: m.content ?? '' } : m)
          : [...prev, { id, role: 'assistant', content: '' }],
      );
      return;
    }
    case 'REASONING_MESSAGE_START': {
      const id = messageIdFrom(event);
      reasoningTimingMap.set(id, { startedAt: Date.now() });
      // Initialize an assistant slot with empty reasoning if it doesn't already exist.
      store.messages.update((prev) =>
        prev.some((m) => m.id === id)
          ? prev.map((m) => m.id === id
              ? { ...m, reasoning: m.reasoning ?? '' }
              : m)
          : [...prev, { id, role: 'assistant', content: '', reasoning: '' }],
      );
      return;
    }
    case 'REASONING_MESSAGE_CONTENT':
    case 'REASONING_MESSAGE_CHUNK': {
      const id = messageIdFrom(event);
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id
          ? { ...m, reasoning: (m.reasoning ?? '') + delta }
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
      const delta = (event as { delta?: string }).delta ?? '';
      store.messages.update((prev) =>
        prev.map((m) => m.id === id ? { ...m, content: m.content + delta } : m),
      );
      return;
    }
    case 'TEXT_MESSAGE_END': {
      // No-op — message is finalized by virtue of TEXT_MESSAGE_CONTENT
      // having been applied. Reserved for future hooks.
      return;
    }
    case 'TOOL_CALL_START': {
      const e = event as unknown as { toolCallId: string; toolCallName: string };
      store.toolCalls.update((prev) => [
        ...prev,
        { id: e.toolCallId, name: e.toolCallName, args: {}, status: 'running' },
      ]);
      return;
    }
    case 'TOOL_CALL_ARGS': {
      const e = event as unknown as { toolCallId: string; delta: string };
      const args = safeParseArgs(e.delta);
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, args } : t),
      );
      return;
    }
    case 'TOOL_CALL_END': {
      const e = event as unknown as { toolCallId: string };
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, status: 'complete' } : t),
      );
      return;
    }
    case 'TOOL_CALL_RESULT': {
      const e = event as unknown as { toolCallId: string; content: unknown };
      store.toolCalls.update((prev) =>
        prev.map((t) => t.id === e.toolCallId ? { ...t, result: e.content } : t),
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
      const e = event as unknown as { delta: Operation[] };
      const next = applyPatch(deepClone(store.state()), e.delta).newDocument;
      store.state.set(next);
      store.messages.update(msgs => bridgeCitationsState({ state: next }, msgs));
      return;
    }
    case 'MESSAGES_SNAPSHOT': {
      const e = event as unknown as { messages: Message[] };
      store.messages.set(e.messages ?? []);
      return;
    }
    case 'CUSTOM': {
      const e = event as unknown as { name: string; value: unknown };
      if (e.name === 'state_update' && isRecord(e.value)) {
        store.events$.next({ type: 'state_update', data: e.value });
      } else {
        store.events$.next({ type: 'custom', name: e.name, data: e.value });
      }
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
