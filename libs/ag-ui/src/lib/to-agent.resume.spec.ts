// SPDX-License-Identifier: MIT
//
// Transcript-driven resume-payload tests.
//
// The fixtures under libs/ag-ui/fixtures/runtime-transcripts/ are REAL
// captures from the 2026-08-31 runtime-portability spikes. Each test replays
// a captured inbound interrupt through the adapter, submits a resume, and
// asserts the outgoing forwardedProps against the request shape MEASURED to
// work for that runtime (also committed as fixtures). Payloads are verbatim
// from the wire — do not edit them.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AbstractAgent, BaseEvent } from '@ag-ui/client';
import { toAgent, type AgUiAgent } from './to-agent';

const FIXTURES_DIR = join(__dirname, '../../fixtures/runtime-transcripts');

/** Parse an SSE capture into its event objects (one per `data:` line). */
function readSseFixture(name: string): BaseEvent[] {
  const raw = readFileSync(join(FIXTURES_DIR, name), 'utf8');
  return raw
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice('data:'.length)) as BaseEvent);
}

/** Read a fixture's captured request JSON (a `.request.json` file, or the
 *  `__request__` first line of a captured SSE response). */
function readCapturedRequest(name: string): Record<string, unknown> {
  const raw = readFileSync(join(FIXTURES_DIR, name), 'utf8');
  if (name.endsWith('.request.json')) return JSON.parse(raw) as Record<string, unknown>;
  const firstLine = raw.split('\n', 1)[0];
  return (JSON.parse(firstLine) as { __request__: Record<string, unknown> }).__request__;
}

/** Minimal AbstractAgent stand-in (mirrors to-agent.spec.ts's StubAgent). */
class StubAgent {
  state: Record<string, unknown> = {};
  private readonly subscribers: Array<{
    onEvent?: (p: { event: BaseEvent; input: { runId?: string } }) => void;
  }> = [];
  subscribe(sub: { onEvent?: (p: { event: BaseEvent; input: { runId?: string } }) => void }) {
    this.subscribers.push(sub);
    return { unsubscribe: () => undefined };
  }
  emit(event: BaseEvent, callbackRunId?: string): void {
    for (const sub of this.subscribers) sub.onEvent?.({ event, input: { runId: callbackRunId } });
  }
  runAgent = vi.fn(async () => ({ result: undefined, newMessages: [] }));
  abortRun = vi.fn();
  addMessage = vi.fn();
  setMessages = vi.fn();
}

/** Drive a full submit through the adapter while replaying a captured
 *  transcript, so the interrupt is stored exactly as production stores it. */
async function replayInterruptRun(
  stub: StubAgent,
  agent: AgUiAgent,
  fixture: string,
  callbackRunId: string,
): Promise<void> {
  let finishRun!: () => void;
  stub.runAgent.mockImplementationOnce(() => new Promise((resolve) => {
    finishRun = () => resolve({ result: undefined, newMessages: [] });
  }));
  const submitted = agent.submit({ message: 'trigger the interrupt' });
  for (const event of readSseFixture(fixture)) stub.emit(event, callbackRunId);
  finishRun();
  await submitted;
  expect(agent.interrupt!()).toBeDefined();
}

function lastRunAgentArg(stub: StubAgent): {
  forwardedProps?: Record<string, unknown>;
  resume?: Array<Record<string, unknown>>;
} {
  const calls = stub.runAgent.mock.calls as unknown as ReadonlyArray<ReadonlyArray<unknown>>;
  return calls[calls.length - 1][0] as {
    forwardedProps?: Record<string, unknown>;
    resume?: Array<Record<string, unknown>>;
  };
}

describe('submit({ resume }) — LangGraph wire shape is unchanged', () => {
  it('sends exactly { command: { resume } } when no interrupt is pending', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await agent.submit({ resume: { approved: true } });
    expect(stub.runAgent).toHaveBeenCalledWith({
      forwardedProps: { command: { resume: { approved: true } } },
    });
  });

  it('sends exactly { command: { resume } } for an on_interrupt payload without identifying fields', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    // The LangGraph bridge's on_interrupt carries an opaque app payload —
    // no toolCallId / runId / interrupt entries.
    stub.emit({
      type: 'CUSTOM', name: 'on_interrupt', value: { kind: 'refund_approval', amount: 42 },
    } as unknown as BaseEvent);
    expect(agent.interrupt!()).toBeDefined();

    await agent.submit({ resume: { approved: true } });

    expect(lastRunAgentArg(stub)).toEqual({
      forwardedProps: { command: { resume: { approved: true } } },
    });
    expect(agent.interrupt!()).toBeUndefined();
  });
});

describe('submit({ resume }) — Mastra transcript round-trip', () => {
  // Inbound: spike-mastra/transcripts/05b-resume-ourstyle.sse — the run in
  // which Mastra RE-interrupted after receiving our historical bare
  // command.resume shape (measured proof the old shape does not resume), and
  // whose CUSTOM on_interrupt carries toolCallId + runId. Expected outbound:
  // the measured request that DID resume this exact interrupt,
  // spike-mastra/transcripts/input-05c-resume-correct.json — command.resume
  // plus command.interruptEvent{toolCallId,runId}.
  it('reproduces the measured command.resume + command.interruptEvent shape', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await replayInterruptRun(stub, agent, 'mastra-reinterrupt.sse', 'run-hitl-2');

    await agent.submit({ resume: { chosen_time: '2026-09-01T10:00' } });

    const measured = readCapturedRequest('mastra-resume-correct.request.json');
    expect(lastRunAgentArg(stub).forwardedProps).toEqual(measured['forwardedProps']);
    expect(lastRunAgentArg(stub).forwardedProps).toEqual({
      command: {
        resume: { chosen_time: '2026-09-01T10:00' },
        interruptEvent: { toolCallId: 'call_MYPy83hJNJl68Qe2HuX24UqT', runId: 'run-hitl-2' },
      },
    });
  });
});

describe('submit({ resume }) — Microsoft Agent Framework transcript round-trip', () => {
  // Inbound: spike-maf/transcripts/06-hitl-interrupt.sse (RUN_FINISHED
  // interrupt outcome). Outbound since @ag-ui/client@0.0.59: the
  // protocol-standard TOP-LEVEL resume array. The measured working request
  // (maf-hitl-resume.sse __request__ line) carried the same entries under the
  // pre-standard forwardedProps.command.resume location keyed `id`; the
  // Microsoft bridge reads the top-level field FIRST (_extract_resume_payload
  // checks input.resume before forwardedProps.command.resume) and accepts
  // `interruptId` keys, so identity/status/payload are asserted against the
  // measured entries with only the documented id → interruptId key rename.
  it('addresses the measured pending interrupt via top-level resume entries', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await replayInterruptRun(
      stub, agent, 'maf-hitl-interrupt.sse', '83caa76f-b177-4c68-9b2b-ad1be07589e5',
    );

    await agent.submit({ resume: { approved: true } });

    const measured = readCapturedRequest('maf-hitl-resume.sse');
    const measuredEntries = (
      (measured['forwardedProps'] as { command: { resume: Array<Record<string, unknown>> } })
    ).command.resume;
    const sent = lastRunAgentArg(stub);
    expect(sent.resume).toEqual(
      measuredEntries.map(({ id, ...rest }) => ({ interruptId: id, ...rest })),
    );
    expect(sent.resume).toEqual([{
      interruptId: 'call_VlNsrwdW5hhp2G8Ufp6i8ueQ',
      status: 'resolved',
      payload: { approved: true },
    }]);
    // The legacy forwardedProps location is NOT double-sent.
    expect(sent.forwardedProps).toBeUndefined();
  });
});

describe('submit({ resume }) — AWS Strands interrupt outcome', () => {
  // Inbound: spike-strands/transcripts/interrupt_phase1.sse. Outbound: the
  // protocol-standard TOP-LEVEL resume array — byte-for-byte the `resume`
  // field of the measured working request (strands-resume.request.json,
  // captured as interrupt_phase2_resume in the spike). Strands reads ONLY
  // this location (it received forwardedProps as {} in every capture), which
  // is why 0.0.52 — whose prepareRunAgentInput dropped top-level resume at
  // assembly — could not resume Strands at all.
  it('sends the measured top-level resume array', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await replayInterruptRun(stub, agent, 'strands-interrupt.sse', 'run-1');

    await agent.submit({ resume: { chosen_label: 'Tuesday 10:00' } });

    const measured = readCapturedRequest('strands-resume.request.json');
    const sent = lastRunAgentArg(stub);
    expect(sent.resume).toEqual(measured['resume']);
    expect(sent.resume).toEqual([{
      interruptId: 'v1:tool_call:call_A9ckGX1LrvO82OhqZinzDsom:340a4daa-b874-5aad-8309-a63b92d507dd',
      status: 'resolved',
      payload: { chosen_label: 'Tuesday 10:00' },
    }]);
    expect(sent.forwardedProps).toBeUndefined();
  });

  // SYNTHETIC: no transcript covers a caller that authors its own structured
  // entries; those ride the top-level resume array normalized to the
  // protocol's ResumeEntry shape (interruptId-keyed entries are unchanged).
  it('passes caller-authored interruptId-keyed entries through unchanged', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await replayInterruptRun(stub, agent, 'strands-interrupt.sse', 'run-1');

    const structured = [{
      interruptId: 'v1:tool_call:call_A9ckGX1LrvO82OhqZinzDsom:340a4daa-b874-5aad-8309-a63b92d507dd',
      status: 'resolved',
      payload: { chosen_label: 'Tuesday 10:00' },
    }];
    await agent.submit({ resume: structured });

    expect(lastRunAgentArg(stub)).toEqual({ resume: structured });
  });

  // SYNTHETIC: entries authored with the pre-standard `id` key are renamed to
  // the protocol's `interruptId`; other fields ride along unchanged.
  it('normalizes caller-authored id-keyed entries to ResumeEntry', async () => {
    const stub = new StubAgent();
    const agent = toAgent(stub as unknown as AbstractAgent);
    await replayInterruptRun(stub, agent, 'strands-interrupt.sse', 'run-1');

    await agent.submit({
      resume: [{ id: 'interrupt-1', payload: { ok: true }, metadata: { via: 'test' } }],
    });

    expect(lastRunAgentArg(stub)).toEqual({
      resume: [{
        interruptId: 'interrupt-1',
        status: 'resolved',
        payload: { ok: true },
        metadata: { via: 'test' },
      }],
    });
  });
});
