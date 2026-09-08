import { expect, test, vi } from 'vitest';
import { signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import type { AgentError } from './agent-error';
import type { AgentInterrupt } from './agent-interrupt';
import type { AgentSubmitInput } from './agent-submit';
import {
  INTERRUPT_CONFORMANCE_BATCH,
  interruptConformanceScenarios,
  type InterruptConformanceHarness,
} from '../../../testing/interrupt-conformance';

let harness: InterruptConformanceHarness;
const registrations = interruptConformanceScenarios(() => harness);

function referenceHarness(bug?: 'lost-resume' | 'lost-message' | 'duplicate-message' | 'lost-batch' | 'stale-callback') {
  const requests: InterruptConformanceHarness['requests'] = [];
  const interrupt = signal<AgentInterrupt | undefined>(undefined);
  const error = signal<AgentError | undefined>(undefined);
  let last: AgentSubmitInput = {};
  let fail = false;
  const dispatch = async (input: AgentSubmitInput) => {
    requests.push({
      resume: input.resume,
      state: input.state ?? {},
      messages: input.message && bug !== 'lost-message' ? [input.message as string] : [],
    });
    error.set(fail ? new Error('Known failure') as AgentError : undefined);
    fail = false;
  };
  let disposed = false;
  const state = signal<Record<string, unknown>>({});
  const cleanup = vi.fn(() => { disposed = true; });
  return {
    resume: { 'approval-a': { approved: true }, 'approval-b': { approved: true } },
    agent: {
      messages: signal([]), status: signal('idle' as const), isLoading: signal(false),
      error, toolCalls: signal([]), state, interrupt, events$: EMPTY,
      submit: async (input: AgentSubmitInput) => { last = input; await dispatch(input); },
      retry: async () => {
        await dispatch(bug === 'lost-resume' ? { ...last, resume: undefined } : last);
        if (bug === 'duplicate-message') requests.at(-1)!.messages.push(last.message as string);
      },
      stop: async () => undefined,
      regenerate: async () => undefined,
    },
    requests,
    pause: async () => interrupt.set({ id: 'approval-a', value: {}, resumable: true }),
    pendingBatch: () => bug === 'lost-batch' ? INTERRUPT_CONFORMANCE_BATCH.slice(0, 1) : INTERRUPT_CONFORMANCE_BATCH,
    failNextDispatch: () => { fail = true; },
    backendCancellationCount: () => 0,
    startLateDelivery: async () => undefined,
    deliverLateEvents: async () => {
      if (!disposed || bug === 'stale-callback') state.set({ late: true });
    },
    cleanup,
  } satisfies InterruptConformanceHarness;
}

test.each([...registrations.keys()])('accepts a conforming harness: %s', async label => {
  harness = referenceHarness();
  await registrations.get(label)!();
  expect(harness.cleanup).toHaveBeenCalledTimes(label === 'ignores captured delivery after disposal' ? 2 : 1);
});

test.each([
  ['lost-resume', 'intentionally retries a failed resume-only dispatch unchanged'],
  ['lost-message', 'forwards resume, state and message together'],
  ['duplicate-message', 'intentionally retries a failed combined dispatch unchanged'],
  ['lost-batch', 'exposes the complete paused batch while remaining idle'],
  ['stale-callback', 'ignores captured delivery after disposal'],
] as const)('detects %s and still cleans up the harness', async (bug, label) => {
  harness = referenceHarness(bug);
  await expect(registrations.get(label)!()).rejects.toThrow();
  expect(harness.cleanup).toHaveBeenCalledTimes(bug === 'stale-callback' ? 2 : 1);
});

test('restoration is only registered when explicitly enabled', () => {
  expect(registrations.has('restores the complete pause from backend history')).toBe(false);
  const restoring = interruptConformanceScenarios(() => harness, { restoration: true });
  expect(restoring.has('restores the complete pause from backend history')).toBe(true);
});
