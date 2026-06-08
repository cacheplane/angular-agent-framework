// SPDX-License-Identifier: MIT
// Conformance suite: verifies LangGraphAgent satisfies the runtime-neutral
// Agent contract defined in @threadplane/chat.
//
// NOTE: We use runAgentConformance (base) rather than runAgentWithHistoryConformance
// because the seeded-checkpoint branch of the history conformance is incompatible
// with the langgraph agent: there is no public API to pre-seed ThreadState[]
// checkpoints at construction time (they arrive via the stream transport). The
// history signal is exercised in agent.fn.spec.ts instead.
import { TestBed } from '@angular/core/testing';
import { runAgentConformance } from '@threadplane/chat/testing';
import { provideAgent } from './agent.provider';
import { injectAgent } from './inject-agent';
import { MockAgentTransport } from './transport/mock-stream.transport';

runAgentConformance('agent (LangGraph)', () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideAgent({
        apiUrl: '',
        assistantId: 'test',
        transport: new MockAgentTransport(),
      }),
    ],
  });
  return TestBed.runInInjectionContext(() => injectAgent());
});
