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
import { agent } from './agent.fn';
import {
  INTERRUPT_CONFORMANCE_BATCH,
  runInterruptConformance,
  type InterruptConformanceRequest,
} from '@threadplane/chat/testing';

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

runInterruptConformance('agent (LangGraph)', () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const requests: InterruptConformanceRequest[] = [];
  const transport = new MockAgentTransport();
  let pause = false;
  let fail = false;
  let lateGate: Promise<void> | undefined;
  let releaseLate: (() => void) | undefined;
  let startedLate: (() => void) | undefined;
  let lateRun: Promise<void> | undefined;
  transport.stream = async function* (_assistant, _thread, payload, _signal, options) {
    const command = options?.command;
    const update = (command?.update ?? payload ?? {}) as Record<string, unknown>;
    const { messages, ...state } = update;
    requests.push({
      resume: command?.resume,
      state,
      messages: ((messages ?? []) as Array<{ content: string }>).map(message => message.content),
    });
    if (fail) { fail = false; throw new Error('Known failure before dispatch'); }
    if (lateGate) {
      startedLate?.();
      await lateGate;
      // Deliberately ignores the abort signal, modeling an already queued event.
      yield { type: 'values', values: {
        late: true,
        messages: [{ id: 'late-message', type: 'ai', content: 'Late response' }],
        __interrupt__: [{ id: 'late-interrupt', value: { question: 'Too late?' } }],
      } };
      return;
    }
    if (pause) {
      pause = false;
      yield { type: 'values', values: { __interrupt__: INTERRUPT_CONFORMANCE_BATCH } };
    } else {
      yield { type: 'values', values: {} };
    }
  };
  const ref = TestBed.runInInjectionContext(() => agent({
    apiUrl: '', assistantId: 'test', threadId: 'thread-1', transport, throttle: false,
  }));
  return {
    agent: ref,
    resume: { 'approval-a': { approved: true }, 'approval-b': { approved: true } },
    requests,
    pause: async () => { pause = true; await ref.submit({}); },
    pendingBatch: () => ref.langGraphInterrupts().map(entry => ({ id: entry.id!, value: entry.value })),
    failNextDispatch: () => { fail = true; },
    backendCancellationCount: () => transport.cancelledRuns.length,
    startLateDelivery: async () => {
      lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
      const started = new Promise<void>(resolve => { startedLate = resolve; });
      lateRun = ref.submit({});
      await started;
    },
    deliverLateEvents: async () => { releaseLate?.(); await lateRun; },
    restore: async () => {
      transport.history = [{
        values: { messages: [], reviewer: 'Ada' },
        next: ['approval'],
        checkpoint: { thread_id: 'restored-thread', checkpoint_ns: '', checkpoint_id: 'paused', checkpoint_map: null },
        metadata: null,
        created_at: '2026-09-08T00:00:00.000Z',
        parent_checkpoint: null,
        tasks: INTERRUPT_CONFORMANCE_BATCH.map((interrupt, index) => ({
          id: `task-${index}`, name: 'approval', interrupts: [interrupt],
        })),
      }];
      ref.switchThread('restored-thread');
      await expect.poll(() => ref.isThreadLoading()).toBe(false);
      expect(transport.historyCalls).toContain('restored-thread');
      expect(requests).toHaveLength(0);
    },
    cleanup: () => { TestBed.resetTestingModule(); },
  };
}, { restoration: true });
