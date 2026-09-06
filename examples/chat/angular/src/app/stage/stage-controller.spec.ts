import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { createAgentRef } from '@threadplane/chat';
import { provideAgent, type LangGraphAgent } from '@threadplane/langgraph';
import { StageReplayTransport } from './stage-replay.transport';
import { StageController } from './stage-controller';
import { buildTimeline } from './stage-timeline';
import type { StageRecording } from './stage-recording.types';

const human = (id: string, content: string) => ({ id, type: 'human', content });
const ai = (id: string, content: string) => ({ id, type: 'ai', content });
const values = (tMs: number, messages: unknown[], extra: Record<string, unknown> = {}) =>
  ({ tMs, event: { type: 'values', messages, ...extra } as never });

/** A recording whose events are `values` snapshots, which the bridge applies directly. */
const REC: StageRecording = {
  version: 2, recordedAt: '2026-09-06T00:00:00.000Z', threadId: 'thread-1',
  runs: [
    { beat: 'stream', action: { kind: 'submit', message: 'Q1' }, events: [values(0, [human('h1', 'Q1')]), values(100, [human('h1', 'Q1'), ai('a1', 'A1')])] },
    { beat: 'persist', action: { kind: 'reload' }, events: [] },
    { beat: 'persist', action: { kind: 'submit', message: 'Q2' }, events: [values(0, [human('h1', 'Q1'), ai('a1', 'A1'), human('h2', 'Q2'), ai('a2', 'A2')])] },
    { beat: 'persist', action: { kind: 'submit', message: 'Q3', checkpointIndex: 0 }, events: [values(0, [human('h1', 'Q1'), ai('a1', 'A1'), human('h3', 'Q3'), ai('a3', 'A3')])] },
    { beat: 'approve', action: { kind: 'submit', message: 'Clean up' }, events: [values(0, [human('h4', 'Clean up')]), values(200, [human('h4', 'Clean up')], { __interrupt__: [{ value: { type: 'approval_request', reason: 'Delete 3' } }] })] },
    { beat: 'approve', action: { kind: 'resume', value: 'approved' }, events: [values(0, [human('h4', 'Clean up'), ai('a4', 'Deleted 3')])] },
    { beat: 'render', action: { kind: 'submit', message: 'Form' }, events: [values(0, [human('h4', 'Clean up'), ai('a4', 'Deleted 3'), human('h5', 'Form'), ai('a5', '---a2ui_JSON---')])] },
  ],
  histories: [{ afterRun: 1, states: [{ values: { messages: [human('h1', 'Q1'), ai('a1', 'A1')] }, checkpoint: { checkpoint_id: 'cp-1' } } as never] }],
};

const REF = createAgentRef<Record<string, unknown>>('stage-test');

function until(pred: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => { if (pred()) return resolve(); if (Date.now() - start > ms) return reject(new Error('timeout')); setTimeout(tick, 5); };
    tick();
  });
}
const text = (m: unknown) => String((m as { content?: unknown }).content ?? '');

describe('StageController against the real LangGraph agent', () => {
  let transport: StageReplayTransport;
  let agent: LangGraphAgent;
  let controller: StageController;
  const tl = buildTimeline(REC);

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    transport = new StageReplayTransport(async () => REC);
    const injector = createEnvironmentInjector(
      provideAgent(REF, { assistantId: 'stage', transport, threadId: signal<string | null>(null), transcriptNodeNames: ['generate'] }),
      TestBed.inject(EnvironmentInjector),
    );
    agent = injector.get(REF.token) as LangGraphAgent;
    controller = new StageController(agent, transport, await transport.ready(), REC);
  });

  it('seeking forward performs each run\'s action and applies events up to t', async () => {
    await controller.seek(0);
    await until(() => agent.messages().length === 1);
    expect(controller.phase()).toBe('stream');
    await controller.seek(tl.runs[0].endMs);
    await until(() => agent.messages().length === 2);
    expect(controller.applied()).toBe(2);
  });

  it('the reload run blanks and restores the transcript from recorded history', async () => {
    await controller.seek(tl.runs[1].startMs);
    await until(() => agent.messages().length === 2 && agent.history().length === 1);
    expect(agent.history()[0]?.id).toBe('cp-1');
  });

  it('holds at the interrupt: seeking inside the hold does not resume', async () => {
    await controller.seek(tl.hold.startMs + 1);
    await until(() => !!agent.interrupt?.());
    expect(controller.phase()).toBe('pause');
    const before = agent.messages().length;
    await controller.seek(tl.hold.endMs - 1);
    await new Promise((r) => setTimeout(r, 30));
    expect(agent.messages().length).toBe(before);
    expect(agent.interrupt?.()).toBeTruthy();
  });

  it('crossing the hold resumes and the audit lands', async () => {
    await controller.seek(tl.runs[5].endMs);
    await until(() => agent.messages().some((m) => text(m).includes('Deleted 3')));
    expect(agent.interrupt?.()).toBeFalsy();
    expect(controller.phase()).toBe('resume');
  });

  it('rewinding resets and fast-forwards to an earlier point', async () => {
    await controller.seek(tl.totalMs);
    await until(() => agent.messages().some((m) => text(m).includes('a2ui')));
    await controller.seek(tl.runs[0].endMs);
    await until(() => agent.messages().length === 2 && !agent.messages().some((m) => text(m).includes('a2ui')));
    expect(controller.phase()).toBe('stream');
  });

  it('coalesces bursts: many seeks in one frame perform each action once', async () => {
    const submits: unknown[] = [];
    const original = agent.submit.bind(agent);
    (agent as { submit: LangGraphAgent['submit'] }).submit = ((input, opts) => { submits.push(input); return original(input, opts); }) as LangGraphAgent['submit'];
    await Promise.all([controller.seek(10), controller.seek(20), controller.seek(tl.runs[0].endMs)]);
    await until(() => agent.messages().length === 2);
    expect(submits.length).toBe(1);
  });
});
