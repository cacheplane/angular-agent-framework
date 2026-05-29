// SPDX-License-Identifier: MIT
import type {
  AgentQueueEntry,
  AgentTransport,
  LangGraphSubmitOptions,
  StreamEvent,
} from '../agent.types';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { FakeAgentConfig } from '@threadplane/chat/testing';

const DEFAULT_TOKENS = ['Hello', ' from', ' the', ' fake', ' LangGraph', ' agent.'];

/**
 * In-process AgentTransport that auto-streams a canned assistant reply.
 *
 * Backs `provideFakeAgent()`. Unlike `MockAgentTransport` (passive, driven
 * manually from specs), this transport emits its tokens automatically on
 * `stream()`, then completes — suitable for offline demos and integration tests.
 *
 * NOT for production use.
 */
export class FakeStreamTransport implements AgentTransport {
  private readonly tokens: string[];
  private readonly reasoningTokens: string[];
  private readonly delayMs: number;

  constructor(config: FakeAgentConfig = {}) {
    this.tokens = config.tokens ?? DEFAULT_TOKENS;
    this.reasoningTokens = config.reasoningTokens ?? [];
    this.delayMs = config.delayMs ?? 0;
  }

  async *stream(
    _assistantId: string,
    _threadId: string | null,
    _payload: unknown,
    signal: AbortSignal,
    _options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    const id = 'fake-ai-1';

    let reasoning = '';
    for (const chunk of this.reasoningTokens) {
      if (signal.aborted) return;
      reasoning += chunk;
      yield {
        type: 'messages',
        messages: [
          { id, type: 'ai', content: '', additional_kwargs: { reasoning_content: reasoning } },
        ],
      } as unknown as StreamEvent;
      if (this.delayMs > 0) await delay(this.delayMs);
    }

    let content = '';
    for (const tok of this.tokens) {
      if (signal.aborted) return;
      content += tok;
      yield {
        type: 'messages',
        messages: [{ id, type: 'ai', content }],
      } as unknown as StreamEvent;
      if (this.delayMs > 0) await delay(this.delayMs);
    }
  }

  async createQueuedRun(
    _assistantId: string,
    threadId: string,
    payload: unknown,
    _signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): Promise<AgentQueueEntry> {
    return {
      id: 'fake-queued-run',
      threadId,
      values: payload,
      options: { ...options, multitaskStrategy: 'enqueue' },
      createdAt: new Date(),
    };
  }

  async cancelRun(_threadId: string, _runId: string, _signal: AbortSignal): Promise<void> {
    // No-op: the fake has no real runs to cancel.
    return;
  }

  async getHistory(_threadId: string, _signal: AbortSignal): Promise<ThreadState[]> {
    return [];
  }

  async *joinStream(): AsyncIterable<StreamEvent> {
    // No queued-run replay in the fake; yields nothing.
    yield* [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
