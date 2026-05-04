// SPDX-License-Identifier: MIT
import { Observable } from 'rxjs';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';
import { runAgentConformance } from '@ngaf/chat/testing';
import { toAgent } from './to-agent';

/**
 * Minimal stub that satisfies the AbstractAgent shape for conformance testing.
 * Implements all methods that toAgent() calls: subscribe(), runAgent(),
 * abortRun(), addMessage(), and the abstract run() method.
 */
class StubAgent {
  private readonly _subscribers: Array<{
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }> = [];

  subscribe(sub: {
    onEvent?: (p: { event: BaseEvent }) => void;
    onRunFailed?: (p: { error: Error }) => void;
  }) {
    this._subscribers.push(sub);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { unsubscribe: () => {} };
  }

  async runAgent() {
    return { result: undefined, newMessages: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  abortRun() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  addMessage(_msg: unknown) {}

  run(_input: RunAgentInput): Observable<BaseEvent> {
    return new Observable();
  }
}

runAgentConformance('toAgent (AG-UI adapter)', () => {
  return toAgent(new StubAgent() as unknown as AbstractAgent);
});

import {
  REASONING_FIXTURE_EVENTS,
  REASONING_FIXTURE_MESSAGE_ID,
  assertReasoningFixtureMessages,
  type AbstractEvent,
} from '@ngaf/chat/testing';
import { reduceEvent } from './reducer';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import type { Message, AgentStatus, ToolCall, AgentEvent } from '@ngaf/chat';

function abstractToAgUi(event: AbstractEvent, messageId: string): any {
  switch (event.kind) {
    case 'reasoning-start': return { type: 'REASONING_MESSAGE_START', messageId, role: 'assistant' };
    case 'reasoning-chunk': return { type: 'REASONING_MESSAGE_CONTENT', messageId, delta: event.delta };
    case 'reasoning-end':   return { type: 'REASONING_MESSAGE_END', messageId };
    case 'text-start':      return { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' };
    case 'text-chunk':      return { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: event.delta };
    case 'text-end':        return { type: 'TEXT_MESSAGE_END', messageId };
  }
}

describe('AG-UI reducer — reasoning-fixture conformance', () => {
  it('produces the expected Message[] from the fixture sequence', () => {
    const store = {
      messages:  signal<Message[]>([]),
      status:    signal<AgentStatus>('idle'),
      isLoading: signal<boolean>(false),
      error:     signal<unknown>(null),
      toolCalls: signal<ToolCall[]>([]),
      state:     signal<Record<string, unknown>>({}),
      events$:   new Subject<AgentEvent>(),
    };
    for (const evt of REASONING_FIXTURE_EVENTS) {
      reduceEvent(abstractToAgUi(evt, REASONING_FIXTURE_MESSAGE_ID), store);
    }
    assertReasoningFixtureMessages(store.messages());
  });
});
