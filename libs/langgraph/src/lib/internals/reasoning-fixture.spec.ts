// SPDX-License-Identifier: MIT
import { describe, it } from 'vitest';
import {
  REASONING_FIXTURE_EVENTS,
  REASONING_FIXTURE_MESSAGE_ID,
  assertReasoningFixtureMessages,
  type AbstractEvent,
} from '@ngaf/chat/testing';
import type { BaseMessage } from '@langchain/core/messages';
import type { Message } from '@ngaf/chat';
import { _internalsForTesting } from './stream-manager.bridge';

const { mergeMessages } = _internalsForTesting;

/**
 * Translate the abstract fixture into a sequence of LangGraph-style
 * incoming AIMessageChunk objects with complex content. Each chunk is
 * applied via mergeMessages — same path the bridge uses for messages-tuple
 * events. Final assertion checks the canonical Message[] projection.
 */
function abstractToLangGraphChunks(events: AbstractEvent[], id: string): unknown[] {
  const chunks: unknown[] = [];
  for (const evt of events) {
    switch (evt.kind) {
      case 'reasoning-start':
      case 'reasoning-end':
      case 'text-start':
      case 'text-end':
        // No-op — start/end are implicit in LangGraph's chunk-based stream.
        break;
      case 'reasoning-chunk':
        chunks.push({ id, type: 'AIMessageChunk', content: [{ type: 'reasoning', text: evt.delta }] });
        break;
      case 'text-chunk':
        chunks.push({ id, type: 'AIMessageChunk', content: [{ type: 'text', text: evt.delta }] });
        break;
    }
  }
  return chunks;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'text' || t === 'output_text' || t === undefined) {
      const text = rec['text'];
      if (typeof text === 'string') out += text;
    }
  }
  return out;
}

describe('LangGraph bridge — reasoning-fixture conformance', () => {
  it('mergeMessages + toMessage produce the expected Message[] from the fixture sequence', () => {
    const incomingChunks = abstractToLangGraphChunks(REASONING_FIXTURE_EVENTS, REASONING_FIXTURE_MESSAGE_ID);
    let merged: BaseMessage[] = [];
    for (const chunk of incomingChunks) {
      merged = mergeMessages(merged, [chunk as BaseMessage]);
    }

    // Project to runtime-neutral Messages using the same translation logic as
    // agent.fn.toMessage. Inlined here to avoid pulling in DI.
    const projected: Message[] = merged.map((m) => {
      const raw = m as unknown as Record<string, unknown>;
      const reasoning = typeof raw['reasoning'] === 'string' && (raw['reasoning'] as string).length > 0
        ? (raw['reasoning'] as string)
        : undefined;
      const content = typeof m.content === 'string' ? m.content : extractText(m.content);
      // Synthesize a duration when reasoning is present (real bridge reads its timing map).
      const reasoningDurationMs = reasoning ? 1 : undefined;
      return {
        id: (raw['id'] as string) ?? 'x',
        role: 'assistant',
        content,
        reasoning,
        reasoningDurationMs,
      };
    });
    assertReasoningFixtureMessages(projected);
  });
});
