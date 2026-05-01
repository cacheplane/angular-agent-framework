// SPDX-License-Identifier: MIT
// Conformance suite: verifies LangGraphAgent satisfies the runtime-neutral
// Agent contract defined in @ngaf/chat.
//
// NOTE: We use runAgentConformance (base) rather than runAgentWithHistoryConformance
// because the seeded-checkpoint branch of the history conformance is incompatible
// with agent(): there is no public API to pre-seed ThreadState[] checkpoints at
// construction time (they arrive via the stream transport). The history signal
// is exercised in agent.fn.spec.ts instead.
import { TestBed } from '@angular/core/testing';
import { runAgentConformance } from '@ngaf/chat/testing';
import { agent } from './agent.fn';
import { MockAgentTransport } from './transport/mock-stream.transport';

runAgentConformance('agent (LangGraph)', () => {
  let result!: ReturnType<typeof agent>;
  TestBed.runInInjectionContext(() => {
    result = agent({
      apiUrl: '',
      assistantId: 'test',
      transport: new MockAgentTransport(),
    });
  });
  return result;
});
