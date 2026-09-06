# Stage Route Implementation Plan (live-stage plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/stage` route in the demo app that renders the real `<chat>` beside the real `<chat-debug>` devtools and replays one committed live recording of four beats (Stream, Persist, Approve, Render) to any point in recorded time on demand, driven by a `?t=` query parameter or a parent window's `postMessage`, with a record mode that produces the recording and a recorder that produces the stills the website will use as fallbacks.

**Architecture:** A `StageReplayTransport` implements the LangGraph `AgentTransport` with a gate: it yields a run's recorded events only up to the current target time `t` and waits otherwise. A framework-free `StageController` owns the timeline (runs laid end to end with an authored hold at the interrupt), performs each run's recorded action on the agent (submit, resume, reload, fork) as `t` crosses the run's start, and rewinds by resetting the agent and fast-forwarding. `StageMode` is the route component: it wires the controller to `?t=` and to the `tplane-stage` message protocol, and in `?record=1` mode swaps in a `StageRecordingTransport` around the real transport and runs the four-beat script against the live backend. Nothing in `libs/` changes.

**Tech Stack:** Angular 20 signals, `@threadplane/langgraph` (`provideAgent`, `injectAgent`, `AgentTransport`), `@threadplane/chat` (`ChatComponent`, `ChatInterruptPanelComponent`), `@threadplane/chat/debug` (`ChatDebugComponent`), vitest + TestBed, Playwright recorders.

**Spec:** `docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §4.2–4.5, §5, §6, §8 (stills), §13 plan 2.

---

## Conventions

- Work in `examples/chat/angular`; unit tests: `cd examples/chat/angular && npx vitest run <path>`; Nx: `npx nx test examples-chat-angular`. Lint: `npx nx lint examples-chat-angular 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "` (zero errors).
- Never use `git stash`; the stash stack is shared with other sessions.
- Live recording needs the backend with the real key (`export OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2-)`; note the `.env` lives in the primary checkout, not the worktree) and the dev server on 4200; never run the aimock e2e while those hold the ports.
- Two hero traps that apply here (from memory): every stage agent config MUST set `transcriptNodeNames: ['generate']`, or the thread title's tokens land on a finished answer and trip the streaming-markdown contract; and the replay gap floor is 0 so a real stream plays at its own pace.
- Commit after every task, ending `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Branch: `git fetch && git checkout -b blove/stage-route origin/main`.

## File structure

All new files live in `examples/chat/angular/src/app/stage/` unless stated.

| File | Responsibility |
|---|---|
| `stage-recording.types.ts` (+spec) | The v2 recording shape: runs with beats and actions, history snapshots, thread id; `validateStageRecording`. |
| `stage-timeline.ts` (+spec) | Pure functions: lay runs end to end with the authored hold, `phaseAt(t)`, `runsToStartBy(t)`, beat boundaries for plan 3. |
| `stage-replay.transport.ts` (+spec) | Gated replay: `seek(t)` releases events with absolute time ≤ t; `getHistory` serves recorded snapshots by run index; `reset()`. |
| `stage-controller.ts` (+spec) | Drives the agent through recorded actions as t advances; rewinds by reset + fast-forward; reports `applied` and `phase`. |
| `stage-recording.transport.ts` (+spec) | Record mode: wraps the real transport, captures runs with their actions, history responses, and the thread id; publishes `window.__stageRecording`. |
| `stage-script.ts` (+spec) | Record mode: the four-beat script that drives the live agent and tells the recording transport which action each run is. |
| `stage-bridge.ts` (+spec) | The `tplane-stage` postMessage protocol, reusing the hero's origin allowlist. |
| `stage-mode.component.ts` (+spec) | The route component. |
| `src/app/app.routes.ts` (modify) | `stage` route. |
| `public/stage-replay.json` | The committed recording. `stage-replay.fixture.spec.ts` pins its shape. |
| `e2e/record-stage-fixture.record.ts`, `e2e/record-stage-live.config.ts` | Live recorder. |
| `e2e/record-stage-stills.record.ts`, `e2e/record-stage.config.ts` | Still recorder (aimock-backed boot, replay needs no model) writing `apps/website/public/screenshots/stage-*.webp`. |
| `e2e/stage.spec.ts` | Replay e2e on the committed recording. |

---

### Task 1: Recording types

**Files:** create `stage-recording.types.ts`, `stage-recording.types.spec.ts`.

- [ ] **Step 1: Failing spec**

```ts
// examples/chat/angular/src/app/stage/stage-recording.types.spec.ts
import { describe, expect, it } from 'vitest';
import { validateStageRecording, type StageRecording } from './stage-recording.types';

const ev = (tMs: number) => ({ tMs, event: { type: 'values', messages: [] } as never });

export const MINIMAL: StageRecording = {
  version: 2,
  recordedAt: '2026-09-06T00:00:00.000Z',
  threadId: 'thread-1',
  runs: [
    { beat: 'stream', action: { kind: 'submit', message: 'Tell me about signals' }, events: [ev(0), ev(50)] },
    { beat: 'persist', action: { kind: 'reload' }, events: [] },
    { beat: 'persist', action: { kind: 'submit', message: 'Shorter, please.' }, events: [ev(0)] },
    { beat: 'persist', action: { kind: 'submit', message: 'As a haiku.', checkpointIndex: 1 }, events: [ev(0)] },
    { beat: 'approve', action: { kind: 'submit', message: 'Clean up backups.' }, events: [ev(0), ev(900)] },
    { beat: 'approve', action: { kind: 'resume', value: 'approved' }, events: [ev(0)] },
    { beat: 'render', action: { kind: 'submit', message: 'Show me a form.' }, events: [ev(0), ev(2000)] },
  ],
  histories: [{ afterRun: 1, states: [] }],
};

describe('validateStageRecording', () => {
  it('accepts a well-formed recording', () => {
    expect(validateStageRecording(MINIMAL)).toBe(MINIMAL);
  });
  it('requires version 2, a thread id, and all four beats in order', () => {
    expect(() => validateStageRecording({ ...MINIMAL, version: 1 })).toThrow(/version/);
    expect(() => validateStageRecording({ ...MINIMAL, threadId: '' })).toThrow(/threadId/);
    const noRender = { ...MINIMAL, runs: MINIMAL.runs.filter((r) => r.beat !== 'render') };
    expect(() => validateStageRecording(noRender)).toThrow(/beats/);
    const swapped = { ...MINIMAL, runs: [MINIMAL.runs[4], ...MINIMAL.runs.slice(0, 4), ...MINIMAL.runs.slice(5)] };
    expect(() => validateStageRecording(swapped)).toThrow(/order/);
  });
  it('lets only a reload run have no events', () => {
    const bad = { ...MINIMAL, runs: MINIMAL.runs.map((r, i) => (i === 0 ? { ...r, events: [] } : r)) };
    expect(() => validateStageRecording(bad)).toThrow(/run 0 has no events/);
  });
  it('requires a resume run to follow the approve submit', () => {
    const bad = { ...MINIMAL, runs: MINIMAL.runs.filter((r) => r.action.kind !== 'resume') };
    expect(() => validateStageRecording(bad)).toThrow(/resume/);
  });
});
```

- [ ] **Step 2: Run to fail** — `cd examples/chat/angular && npx vitest run src/app/stage/stage-recording.types` → cannot resolve.

- [ ] **Step 3: Implement**

```ts
// examples/chat/angular/src/app/stage/stage-recording.types.ts
import type { StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';

/** One transport event with its offset from the start of its run. */
export interface RecordedEvent { readonly tMs: number; readonly event: StreamEvent; }

export const STAGE_BEATS = ['stream', 'persist', 'approve', 'render'] as const;
export type StageBeat = (typeof STAGE_BEATS)[number];

/**
 * What the script did to the agent to produce a run. Replayed verbatim by the
 * controller, so the replay performs the same calls the recording did.
 */
export type StageAction =
  | { readonly kind: 'submit'; readonly message: string; /** Fork: index into the agent's history() at that moment. */ readonly checkpointIndex?: number }
  | { readonly kind: 'resume'; readonly value: string }
  /** Simulated page reload: reset, then re-adopt the thread so history restores it. Has no stream. */
  | { readonly kind: 'reload' };

export interface StageRun {
  readonly beat: StageBeat;
  readonly action: StageAction;
  readonly events: readonly RecordedEvent[];
}

/** A `getHistory` response, keyed by how many runs had been recorded when it was answered. */
export interface StageHistorySnapshot { readonly afterRun: number; readonly states: readonly ThreadState[]; }

export interface StageRecording {
  readonly version: 2;
  readonly recordedAt: string;
  readonly threadId: string;
  readonly runs: readonly StageRun[];
  readonly histories: readonly StageHistorySnapshot[];
}

const KINDS = new Set(['submit', 'resume', 'reload']);

/** Throws a readable error when the fixture is not a usable recording. */
export function validateStageRecording(input: unknown): StageRecording {
  if (typeof input !== 'object' || input === null) throw new Error('stage recording must be an object');
  const rec = input as Partial<StageRecording>;
  if (rec.version !== 2) throw new Error('stage recording version must be 2');
  if (typeof rec.threadId !== 'string' || !rec.threadId) throw new Error('stage recording needs a threadId');
  if (!Array.isArray(rec.runs) || rec.runs.length === 0) throw new Error('stage recording needs runs');
  if (!Array.isArray(rec.histories)) throw new Error('stage recording needs histories');
  const beatsSeen: StageBeat[] = [];
  rec.runs.forEach((run: Partial<StageRun>, i) => {
    if (!run.beat || !STAGE_BEATS.includes(run.beat)) throw new Error(`run ${i} has no beat`);
    if (!run.action || !KINDS.has(run.action.kind)) throw new Error(`run ${i} has no action`);
    if (!Array.isArray(run.events)) throw new Error(`run ${i} has no events`);
    if (run.events.length === 0 && run.action.kind !== 'reload') throw new Error(`run ${i} has no events`);
    (run.events as readonly Partial<RecordedEvent>[]).forEach((e, j) => {
      if (typeof e?.tMs !== 'number' || !Number.isFinite(e.tMs)) throw new Error(`run ${i} event ${j} has no numeric tMs`);
      if (typeof e.event !== 'object' || e.event === null) throw new Error(`run ${i} event ${j} has no event`);
    });
    if (beatsSeen[beatsSeen.length - 1] !== run.beat) beatsSeen.push(run.beat);
  });
  if (beatsSeen.length !== STAGE_BEATS.length || beatsSeen.some((b, i) => b !== STAGE_BEATS[i])) {
    const missing = STAGE_BEATS.filter((b) => !beatsSeen.includes(b));
    throw new Error(missing.length ? `stage recording is missing beats: ${missing.join(', ')}` : `stage recording beats are out of order: ${beatsSeen.join(' → ')}`);
  }
  const approveSubmit = rec.runs.findIndex((r: StageRun) => r.beat === 'approve' && r.action.kind === 'submit');
  const resume = rec.runs[approveSubmit + 1] as StageRun | undefined;
  if (approveSubmit < 0 || resume?.action.kind !== 'resume') throw new Error('the approve beat needs a submit run followed by a resume run');
  return rec as StageRecording;
}
```

- [ ] **Step 4: Run to pass**, then commit `feat(examples/chat): stage recording types with beat, action and history validation`.

---

### Task 2: Timeline

**Files:** create `stage-timeline.ts`, `stage-timeline.spec.ts`.

- [ ] **Step 1: Failing spec**

```ts
// examples/chat/angular/src/app/stage/stage-timeline.spec.ts
import { describe, expect, it } from 'vitest';
import { MINIMAL } from './stage-recording.types.spec';
import { HOLD_MS, RELOAD_MS, buildTimeline, phaseAt, runsStartedBy } from './stage-timeline';

describe('buildTimeline', () => {
  const tl = buildTimeline(MINIMAL);
  it('lays runs end to end, gives a reload a fixed beat, and holds before the resume', () => {
    // run0 spans 0..50, run1 (reload) 50..50+RELOAD_MS, run2 and run3 each 1ms (single event at 0 → duration max(last tMs,1))
    expect(tl.runs[0]).toMatchObject({ index: 0, startMs: 0, endMs: 50 });
    expect(tl.runs[1]).toMatchObject({ index: 1, startMs: 50, endMs: 50 + RELOAD_MS });
    const approve = tl.runs[4];
    const resume = tl.runs[5];
    expect(resume.startMs).toBe(approve.endMs + HOLD_MS);
    expect(tl.hold).toEqual({ startMs: approve.endMs, endMs: resume.startMs });
    expect(tl.totalMs).toBe(tl.runs[6].endMs);
  });
  it('derives beat boundaries from the runs', () => {
    expect(tl.beats.map((b) => b.beat)).toEqual(['stream', 'persist', 'approve', 'render']);
    expect(tl.beats[0]).toMatchObject({ startMs: 0, endMs: tl.runs[0].endMs });
    expect(tl.beats[2].endMs).toBe(tl.runs[5].endMs);
    expect(tl.beats[3].endMs).toBe(tl.totalMs);
  });
});

describe('phaseAt', () => {
  const tl = buildTimeline(MINIMAL);
  it('names stream, persist, pause, resume, render', () => {
    expect(phaseAt(tl, 0)).toBe('stream');
    expect(phaseAt(tl, tl.runs[1].startMs)).toBe('persist');
    expect(phaseAt(tl, tl.hold.startMs + 1)).toBe('pause');
    expect(phaseAt(tl, tl.runs[5].startMs)).toBe('resume');
    expect(phaseAt(tl, tl.totalMs)).toBe('render');
  });
});

describe('runsStartedBy', () => {
  const tl = buildTimeline(MINIMAL);
  it('lists every run whose start is at or before t', () => {
    expect(runsStartedBy(tl, 0).map((r) => r.index)).toEqual([0]);
    expect(runsStartedBy(tl, tl.hold.startMs + 1).map((r) => r.index)).toEqual([0, 1, 2, 3, 4]);
    expect(runsStartedBy(tl, tl.totalMs).length).toBe(7);
  });
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement**

```ts
// examples/chat/angular/src/app/stage/stage-timeline.ts
import type { StageBeat, StageRecording, StageRun } from './stage-recording.types';

/** Recorded-time room given to a reload run, which streams nothing: enough for the transcript to visibly blank and restore. */
export const RELOAD_MS = 600;
/**
 * The authored hold at the interrupt, in recorded milliseconds. Between the
 * approve run's last event and the resume run's first, nothing advances; the
 * parent maps a large share of scroll to this window (spec §6).
 */
export const HOLD_MS = 3000;

export type StagePhase = 'stream' | 'persist' | 'pause' | 'resume' | 'render';

export interface TimelineRun { readonly index: number; readonly run: StageRun; readonly startMs: number; readonly endMs: number; }
export interface TimelineBeat { readonly beat: StageBeat; readonly startMs: number; readonly endMs: number; }
export interface StageTimeline {
  readonly runs: readonly TimelineRun[];
  readonly beats: readonly TimelineBeat[];
  readonly hold: { readonly startMs: number; readonly endMs: number };
  readonly totalMs: number;
}

function durationOf(run: StageRun): number {
  if (run.action.kind === 'reload') return RELOAD_MS;
  const last = run.events[run.events.length - 1]?.tMs ?? 0;
  return Math.max(last, 1);
}

export function buildTimeline(rec: StageRecording): StageTimeline {
  const runs: TimelineRun[] = [];
  let cursor = 0;
  let hold = { startMs: 0, endMs: 0 };
  rec.runs.forEach((run, index) => {
    if (run.action.kind === 'resume') {
      hold = { startMs: cursor, endMs: cursor + HOLD_MS };
      cursor += HOLD_MS;
    }
    const startMs = cursor;
    const endMs = startMs + durationOf(run);
    runs.push({ index, run, startMs, endMs });
    cursor = endMs;
  });
  const beats: TimelineBeat[] = [];
  for (const r of runs) {
    const last = beats[beats.length - 1];
    if (last && last.beat === r.run.beat) beats[beats.length - 1] = { ...last, endMs: r.endMs };
    else beats.push({ beat: r.run.beat, startMs: r.startMs, endMs: r.endMs });
  }
  return { runs, beats, hold, totalMs: cursor };
}

export function phaseAt(tl: StageTimeline, t: number): StagePhase {
  if (t >= tl.hold.startMs && t < tl.hold.endMs) return 'pause';
  const current = [...tl.runs].reverse().find((r) => r.startMs <= t) ?? tl.runs[0];
  if (current.run.action.kind === 'resume') return 'resume';
  return current.run.beat;
}

/** Every run whose start is at or before t, in order. */
export function runsStartedBy(tl: StageTimeline, t: number): readonly TimelineRun[] {
  return tl.runs.filter((r) => r.startMs <= t);
}
```

- [ ] **Step 4: Run to pass**, commit `feat(examples/chat): stage timeline lays recorded runs end to end with an authored hold`.

---

### Task 3: Seekable replay transport

**Files:** create `stage-replay.transport.ts`, `stage-replay.transport.spec.ts`.

- [ ] **Step 1: Failing spec**

```ts
// examples/chat/angular/src/app/stage/stage-replay.transport.spec.ts
import { describe, expect, it } from 'vitest';
import type { StreamEvent } from '@threadplane/langgraph';
import { MINIMAL } from './stage-recording.types.spec';
import { buildTimeline } from './stage-timeline';
import { StageReplayTransport } from './stage-replay.transport';

async function take(iter: AsyncIterable<StreamEvent>, n: number): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of iter) { out.push(e); if (out.length === n) break; }
  return out;
}
function settle(): Promise<void> { return new Promise((r) => setTimeout(r, 0)); }

describe('StageReplayTransport', () => {
  it('yields a run\'s events only up to the target time and waits for the rest', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const iter = t.stream('chat', 'thread-1', {}, new AbortController().signal)[Symbol.asyncIterator]();
    expect((await iter.next()).value).toEqual(MINIMAL.runs[0].events[0].event);
    let second: unknown = 'pending';
    void iter.next().then((r) => (second = r.value));
    await settle();
    expect(second).toBe('pending');
    t.seek(50);
    await settle();
    expect(second).toEqual(MINIMAL.runs[0].events[1].event);
    expect((await iter.next()).done).toBe(true);
  });
  it('advances through runs in order and skips reload runs (they have no stream)', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    const tl = buildTimeline(MINIMAL);
    t.seek(tl.totalMs);
    const sig = new AbortController().signal;
    expect(await take(t.stream('chat', 'thread-1', {}, sig), 9)).toHaveLength(2); // run 0
    expect(await take(t.stream('chat', 'thread-1', {}, sig), 9)).toHaveLength(1); // run 2 (run 1 is the reload)
    expect(t.runIndex).toBe(3);
  });
  it('reports applied count and the run start it is on', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 1);
    expect(t.applied()).toBe(1);
  });
  it('serves the latest history snapshot recorded at or before the current run', async () => {
    const withHistory = { ...MINIMAL, histories: [{ afterRun: 1, states: [{ values: { messages: [] } } as never] }] };
    const t = new StageReplayTransport(async () => withHistory);
    await t.ready();
    expect(await t.getHistory('thread-1', new AbortController().signal)).toEqual([]);
    t.seek(buildTimeline(withHistory).totalMs);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 9); // run 0 done → next stream is run 2, runIndex passes 1
    await take(t.stream('chat', 'thread-1', {}, sig), 9);
    expect(await t.getHistory('thread-1', sig)).toHaveLength(1);
  });
  it('reset() rewinds to the first run and clears applied', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(50);
    const sig = new AbortController().signal;
    await take(t.stream('chat', 'thread-1', {}, sig), 9);
    t.reset();
    expect(t.runIndex).toBe(0);
    expect(t.applied()).toBe(0);
  });
  it('stops when the signal aborts', async () => {
    const t = new StageReplayTransport(async () => MINIMAL);
    await t.ready();
    t.seek(0);
    const ctl = new AbortController();
    const iter = t.stream('chat', 'thread-1', {}, ctl.signal)[Symbol.asyncIterator]();
    await iter.next();
    const pending = iter.next();
    ctl.abort();
    expect((await pending).done).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement**

```ts
// examples/chat/angular/src/app/stage/stage-replay.transport.ts
import { signal } from '@angular/core';
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import { validateStageRecording, type StageRecording } from './stage-recording.types';
import { buildTimeline, type StageTimeline } from './stage-timeline';

export const STAGE_RECORDING_URL = '/stage-replay.json';

async function fetchRecording(): Promise<StageRecording> {
  const res = await fetch(STAGE_RECORDING_URL);
  if (!res.ok) throw new Error(`stage recording fetch failed: ${res.status}`);
  return validateStageRecording(await res.json());
}

/**
 * AgentTransport that replays the committed stage recording under a gate:
 * each `stream()` call answers the next non-reload run, yielding events whose
 * ABSOLUTE recorded time (run start + tMs) is at or before the current target
 * `t`, and waiting for `seek()` to move `t` before yielding the rest. There is
 * no clock: the parent's scroll is the clock. Backward seeks are the
 * controller's job (reset + fast-forward); this transport only ever moves
 * forward within a run.
 */
export class StageReplayTransport implements AgentTransport {
  private recording: Promise<StageRecording> | null = null;
  private timeline: StageTimeline | null = null;
  private t = 0;
  private wakers = new Set<() => void>();
  /** Index of the next run `stream()` will answer. Reload runs are skipped. */
  runIndex = 0;
  private readonly appliedCount = signal(0);

  constructor(private readonly load: () => Promise<StageRecording> = fetchRecording) {}

  async ready(): Promise<StageTimeline> {
    const rec = await this.getRecording();
    this.timeline ??= buildTimeline(rec);
    return this.timeline;
  }
  /** Events yielded so far across all runs since the last reset. */
  applied(): number { return this.appliedCount(); }
  readonly appliedSignal = this.appliedCount.asReadonly();

  seek(t: number): void {
    this.t = t;
    for (const w of [...this.wakers]) w();
  }
  reset(): void {
    this.runIndex = 0;
    this.appliedCount.set(0);
    for (const w of [...this.wakers]) w();
  }

  async *stream(_a: string, _thread: string | null, _payload: unknown, signal: AbortSignal, _o?: LangGraphSubmitOptions): AsyncIterable<StreamEvent> {
    const tl = await this.ready();
    while (tl.runs[this.runIndex]?.run.action.kind === 'reload') this.runIndex += 1;
    const entry = tl.runs[this.runIndex];
    if (!entry) return;
    this.runIndex += 1;
    const generation = this.runIndex;
    for (const { tMs, event } of entry.run.events) {
      while (entry.startMs + tMs > this.t) {
        if (signal.aborted || this.runIndex !== generation) return;
        await this.wait(signal);
      }
      if (signal.aborted || this.runIndex !== generation) return;
      this.appliedCount.update((n) => n + 1);
      yield event;
    }
  }

  private wait(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => { this.wakers.delete(wake); signal.removeEventListener('abort', wake); resolve(); };
      this.wakers.add(wake);
      signal.addEventListener('abort', wake, { once: true });
    });
  }

  async getHistory(_thread: string, _signal: AbortSignal): Promise<ThreadState[]> {
    const rec = await this.getRecording();
    // "Recorded at or before the run we are on": afterRun counts runs already recorded, runIndex counts runs already started.
    const snapshot = [...rec.histories].filter((h) => h.afterRun <= this.runIndex).pop();
    return (snapshot?.states ?? []) as ThreadState[];
  }
  async createQueuedRun(_a: string, threadId: string, payload: unknown, _s: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    return { id: 'stage-replay-queued-run', threadId, values: payload, options: { ...options, multitaskStrategy: 'enqueue' }, createdAt: new Date() };
  }
  async cancelRun(): Promise<void> { return; }
  async *joinStream(): AsyncIterable<StreamEvent> { yield* []; }

  private getRecording(): Promise<StageRecording> {
    this.recording ??= this.load().catch((err) => { this.recording = null; throw err; });
    return this.recording;
  }
}
```

If the `runIndex` bookkeeping in the history test does not match (the history snapshot's `afterRun` semantics are "number of runs recorded so far when getHistory was answered"; on replay, after run 0 finishes and run 2's stream begins, `runIndex` is 3), adjust the test's expectation to the implemented rule and document the rule in the doc comment. The rule that matters: a snapshot recorded after k runs is visible once at least k runs have been started on replay.

- [ ] **Step 4: Run to pass**, commit `feat(examples/chat): StageReplayTransport gates recorded events behind a seekable target time`.

---

### Task 4: Controller (integration with the real LangGraph agent)

**Files:** create `stage-controller.ts`, `stage-controller.spec.ts`.

- [ ] **Step 1: Failing spec**

```ts
// examples/chat/angular/src/app/stage/stage-controller.spec.ts
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
    await until(() => agent.messages().some((m) => String((m as { content?: unknown }).content).includes('Deleted 3')));
    expect(agent.interrupt?.()).toBeFalsy();
    expect(controller.phase()).toBe('resume');
  });

  it('rewinding resets and fast-forwards to an earlier point', async () => {
    await controller.seek(tl.totalMs);
    await until(() => agent.messages().some((m) => String((m as { content?: unknown }).content).includes('a2ui')));
    await controller.seek(tl.runs[0].endMs);
    await until(() => agent.messages().length === 2 && !agent.messages().some((m) => String((m as { content?: unknown }).content).includes('a2ui')));
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
```

- [ ] **Step 2: Run to fail** — `npx vitest run src/app/stage/stage-controller` → cannot resolve.

- [ ] **Step 3: Implement**

```ts
// examples/chat/angular/src/app/stage/stage-controller.ts
import { computed, signal } from '@angular/core';
import type { LangGraphAgent } from '@threadplane/langgraph';
import type { StageRecording, StageRun } from './stage-recording.types';
import { phaseAt, runsStartedBy, type StagePhase, type StageTimeline } from './stage-timeline';
import type { StageReplayTransport } from './stage-replay.transport';

/**
 * Drives the replay agent to any recorded time.
 *
 * Forward: for each run whose start has been crossed and not yet performed,
 * perform its recorded action (submit / resume / reload), then open the
 * transport's gate to `t`. Backward: reset the agent and the transport, then
 * fast-forward. Seeks are coalesced so a burst inside one frame performs each
 * action once, and a seek that arrives while one is in flight is applied after
 * it, never concurrently — the agent's submit path is not re-entrant.
 */
export class StageController {
  private performed = -1;
  private target = 0;
  private inFlight: Promise<void> | null = null;
  private pending: number | null = null;
  private readonly tSig = signal(0);
  readonly phase = computed<StagePhase>(() => phaseAt(this.timeline, this.tSig()));
  readonly applied = this.transport.appliedSignal;
  readonly t = this.tSig.asReadonly();

  constructor(
    private readonly agent: LangGraphAgent,
    private readonly transport: StageReplayTransport,
    private readonly timeline: StageTimeline,
    private readonly recording: StageRecording,
  ) {}

  seek(t: number): Promise<void> {
    const clamped = Math.max(0, Math.min(this.timeline.totalMs, t));
    if (this.inFlight) { this.pending = clamped; return this.inFlight; }
    this.inFlight = this.run(clamped).finally(() => {
      this.inFlight = null;
      if (this.pending !== null) { const next = this.pending; this.pending = null; void this.seek(next); }
    });
    return this.inFlight;
  }

  private async run(t: number): Promise<void> {
    if (t < this.target) await this.reset();
    this.target = t;
    this.tSig.set(t);
    if (this.performed < 0) this.agent.switchThread(this.recording.threadId);
    for (const entry of runsStartedBy(this.timeline, t)) {
      if (entry.index <= this.performed) continue;
      this.performed = entry.index;
      // Open the gate BEFORE the action so the first events flow as soon as the stream opens.
      this.transport.seek(t);
      await this.perform(entry.run);
    }
    this.transport.seek(t);
  }

  private async reset(): Promise<void> {
    this.performed = -1;
    this.agent.switchThread(null);
    this.transport.reset();
  }

  private async perform(run: StageRun): Promise<void> {
    const a = run.action;
    switch (a.kind) {
      case 'submit': {
        const cp = a.checkpointIndex !== undefined ? this.agent.history()[a.checkpointIndex]?.id : undefined;
        void this.agent.submit({ message: a.message }, cp ? ({ checkpointId: cp } as never) : undefined);
        return;
      }
      case 'resume':
        void this.agent.submit(null, { command: { resume: a.value } } as never);
        return;
      case 'reload':
        // A page reload: the agent is rebuilt from the thread's history.
        this.agent.switchThread(null);
        this.agent.switchThread(this.recording.threadId);
        return;
    }
  }
}
```

Notes for the implementer: `agent.submit` returns a promise that resolves when the run completes, which under the gate may be far in the future; never `await` it. `agent.switchThread(id)` triggers the bridge's `refreshHistory`, which calls `transport.getHistory` and projects the latest snapshot into messages when messages are empty (the reload beat depends on this). If the bridge rejects a submit while a previous run is still open (the gate holds run N open when t sits mid-run and the next run's start is crossed only after N's end, so this should not happen; if it does, the fix is to advance `this.transport.seek(entry.startMs)` before performing so N drains first). If `LangGraphAgent` does not expose `history()` directly, use `agent.langGraphHistory()` and map `.checkpoint.checkpoint_id`.

- [ ] **Step 4: Run to pass**, commit `feat(examples/chat): StageController drives the agent to any recorded time, with hold and rewind`.

---

### Task 5: Recording transport and the record script

**Files:** create `stage-recording.transport.ts` (+spec), `stage-script.ts` (+spec).

- [ ] **Step 1: Failing specs**

```ts
// examples/chat/angular/src/app/stage/stage-recording.transport.spec.ts
import { describe, expect, it } from 'vitest';
import type { AgentTransport, StreamEvent } from '@threadplane/langgraph';
import { StageRecordingTransport } from './stage-recording.transport';

function inner(events: StreamEvent[]): AgentTransport {
  return {
    async *stream() { for (const e of events) yield e; },
    async getHistory() { return [{ values: {} } as never]; },
  };
}
async function drain(iter: AsyncIterable<StreamEvent>): Promise<void> { for await (const _ of iter) { /* drain */ } }

describe('StageRecordingTransport', () => {
  it('records each stream as a run tagged with the action the script announced', async () => {
    let now = 0;
    const t = new StageRecordingTransport(inner([{ type: 'values' } as never, { type: 'values' } as never]), () => (now += 10));
    t.beginRun('stream', { kind: 'submit', message: 'Q1' });
    await drain(t.stream('chat', 'thread-1', {}, new AbortController().signal));
    const rec = t.recording();
    expect(rec.runs).toHaveLength(1);
    expect(rec.runs[0]).toMatchObject({ beat: 'stream', action: { kind: 'submit', message: 'Q1' } });
    expect(rec.runs[0].events.map((e) => e.tMs)).toEqual([10, 20]);
  });
  it('records a reload as a run with no events, and history responses with the run count', async () => {
    const t = new StageRecordingTransport(inner([]));
    t.beginRun('stream', { kind: 'submit', message: 'Q1' });
    await drain(t.stream('chat', 'thread-1', {}, new AbortController().signal));
    t.beginRun('persist', { kind: 'reload' });
    t.markReload();
    await t.getHistory('thread-1', new AbortController().signal);
    const rec = t.recording();
    expect(rec.runs[1]).toMatchObject({ beat: 'persist', action: { kind: 'reload' }, events: [] });
    expect(rec.histories).toEqual([{ afterRun: 2, states: [{ values: {} }] }]);
  });
  it('captures the thread id the inner transport reports', () => {
    const t = new StageRecordingTransport(inner([]));
    t.onThreadId('thread-9');
    expect(t.recording().threadId).toBe('thread-9');
  });
});
```

```ts
// examples/chat/angular/src/app/stage/stage-script.spec.ts
import { describe, expect, it } from 'vitest';
import { StageScript, STAGE_PROMPTS, type StageScriptHost } from './stage-script';

describe('StageScript', () => {
  it('walks the four beats in order, announcing each run\'s action before performing it', async () => {
    const log: string[] = [];
    let interrupt = false;
    let loading = false;
    const host: StageScriptHost = {
      beginRun: (beat, action) => log.push(`begin:${beat}:${action.kind}`),
      submit: async (message, checkpointIndex) => { log.push(`submit:${message}${checkpointIndex !== undefined ? `@${checkpointIndex}` : ''}`); loading = true; setTimeout(() => { loading = false; interrupt = message === STAGE_PROMPTS.approve; }, 1); },
      resume: async (value) => { log.push(`resume:${value}`); interrupt = false; },
      reload: async () => { log.push('reload'); },
      isRunning: () => loading,
      hasInterrupt: () => interrupt,
      forkIndex: () => 0,
      sleep: () => Promise.resolve(),
    };
    await new StageScript(host).run();
    expect(log).toEqual([
      'begin:stream:submit', `submit:${STAGE_PROMPTS.stream}`,
      'begin:persist:reload', 'reload',
      'begin:persist:submit', `submit:${STAGE_PROMPTS.shorter}`,
      'begin:persist:submit', `submit:${STAGE_PROMPTS.fork}@0`,
      'begin:approve:submit', `submit:${STAGE_PROMPTS.approve}`,
      'begin:approve:resume', 'resume:approved',
      'begin:render:submit', `submit:${STAGE_PROMPTS.render}`,
    ]);
  });
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement the recording transport**

```ts
// examples/chat/angular/src/app/stage/stage-recording.transport.ts
import type { AgentQueueEntry, AgentTransport, LangGraphSubmitOptions, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { RecordedEvent, StageAction, StageBeat, StageHistorySnapshot, StageRecording, StageRun } from './stage-recording.types';

declare global {
  interface Window {
    /** Set by StageRecordingTransport in record mode; read by the record script. */
    __stageRecording?: StageRecording;
  }
}

/**
 * Wraps the real transport in record mode. The script announces each run's
 * action with `beginRun()` before performing it; the next `stream()` call
 * becomes that run. A reload has no stream, so the script calls `markReload()`
 * to close it as an empty run. Every `getHistory()` answer is kept with the
 * number of runs recorded so far, which is what the replay keys on.
 */
export class StageRecordingTransport implements AgentTransport {
  private runs: StageRun[] = [];
  private histories: StageHistorySnapshot[] = [];
  private pending: { beat: StageBeat; action: StageAction } | null = null;
  private threadId = '';
  private readonly recordedAt = new Date().toISOString();

  constructor(private readonly inner: AgentTransport, private readonly now: () => number = () => performance.now()) {}

  beginRun(beat: StageBeat, action: StageAction): void { this.pending = { beat, action }; }
  markReload(): void {
    const p = this.pending; this.pending = null;
    if (!p || p.action.kind !== 'reload') throw new Error('markReload() needs a pending reload action');
    this.runs.push({ beat: p.beat, action: p.action, events: [] });
    this.publish();
  }
  onThreadId(id: string): void { this.threadId = id; this.publish(); }
  recording(): StageRecording {
    return { version: 2, recordedAt: this.recordedAt, threadId: this.threadId, runs: [...this.runs], histories: [...this.histories] };
  }

  async *stream(assistantId: string, threadId: string | null, payload: unknown, signal: AbortSignal, options?: LangGraphSubmitOptions): AsyncIterable<StreamEvent> {
    const p = this.pending; this.pending = null;
    if (!p) throw new Error('stream() without beginRun(): the script must announce the action first');
    const events: RecordedEvent[] = [];
    const run: StageRun = { beat: p.beat, action: p.action, events };
    this.runs.push(run);
    const start = this.now();
    for await (const event of this.inner.stream(assistantId, threadId, payload, signal, options)) {
      events.push({ tMs: Math.round(this.now() - start), event });
      this.publish();
      yield event;
    }
    this.publish();
  }
  async getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
    const states = this.inner.getHistory ? await this.inner.getHistory(threadId, signal) : [];
    this.histories.push({ afterRun: this.runs.length, states });
    this.publish();
    return states;
  }
  joinStream(threadId: string, runId: string, last: string | undefined, signal: AbortSignal): AsyncIterable<StreamEvent> {
    return this.inner.joinStream ? this.inner.joinStream(threadId, runId, last, signal) : (async function* () { yield* []; })();
  }
  createQueuedRun(a: string, threadId: string, payload: unknown, signal: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    if (!this.inner.createQueuedRun) throw new Error('inner transport cannot queue runs');
    return this.inner.createQueuedRun(a, threadId, payload, signal, options);
  }
  cancelRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
    return this.inner.cancelRun ? this.inner.cancelRun(threadId, runId, signal) : Promise.resolve();
  }
  updateState(threadId: string, values: Record<string, unknown>, signal: AbortSignal, options?: { asNode?: string }): Promise<void> {
    return this.inner.updateState ? this.inner.updateState(threadId, values, signal, options) : Promise.resolve();
  }
  private publish(): void { if (typeof window !== 'undefined') window.__stageRecording = this.recording(); }
}
```

- [ ] **Step 4: Implement the script**

```ts
// examples/chat/angular/src/app/stage/stage-script.ts
import type { StageAction, StageBeat } from './stage-recording.types';

/**
 * The four beats, verbatim. The approve and render prompts are the hero's, so
 * the stage shows the same run the hero teases; the stream prompt is the demo's
 * search-and-cite chip; the persist prompts are short on purpose.
 */
export const STAGE_PROMPTS = {
  stream: 'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite each source inline as [^doc-id] using the document `id` field returned by the tool.',
  shorter: 'Shorter, please.',
  fork: 'Make it a haiku instead.',
  approve: 'Clean up our old database backups, anything older than 90 days.',
  render: 'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
} as const;

export interface StageScriptHost {
  beginRun(beat: StageBeat, action: StageAction): void;
  submit(message: string, checkpointIndex?: number): Promise<void>;
  resume(value: string): Promise<void>;
  reload(): Promise<void>;
  isRunning(): boolean;
  hasInterrupt(): boolean;
  /** Index into history() of the checkpoint to fork from: the first answer's. */
  forkIndex(): number;
  sleep(ms: number): Promise<void>;
}

export const SCRIPT_WAIT_TIMEOUT_MS = 120_000;
const POLL_MS = 50;

/** Record-mode driver: performs the beats against the live agent, announcing each run first. */
export class StageScript {
  constructor(private readonly host: StageScriptHost) {}

  async run(): Promise<void> {
    await this.turn('stream', STAGE_PROMPTS.stream);
    this.host.beginRun('persist', { kind: 'reload' });
    await this.host.reload();
    await this.turn('persist', STAGE_PROMPTS.shorter);
    const fork = this.host.forkIndex();
    await this.turn('persist', STAGE_PROMPTS.fork, fork);
    this.host.beginRun('approve', { kind: 'submit', message: STAGE_PROMPTS.approve });
    await this.host.submit(STAGE_PROMPTS.approve);
    await this.waitFor(() => this.host.hasInterrupt());
    this.host.beginRun('approve', { kind: 'resume', value: 'approved' });
    await this.host.resume('approved');
    await this.waitFor(() => !this.host.isRunning() && !this.host.hasInterrupt());
    await this.turn('render', STAGE_PROMPTS.render);
  }

  private async turn(beat: StageBeat, message: string, checkpointIndex?: number): Promise<void> {
    this.host.beginRun(beat, checkpointIndex !== undefined ? { kind: 'submit', message, checkpointIndex } : { kind: 'submit', message });
    await this.host.submit(message, checkpointIndex);
    await this.waitFor(() => !this.host.isRunning());
  }

  private async waitFor(pred: () => boolean): Promise<void> {
    let elapsed = 0;
    while (!pred()) {
      if (elapsed >= SCRIPT_WAIT_TIMEOUT_MS) throw new Error('stage script timed out waiting for the agent');
      await this.host.sleep(POLL_MS);
      elapsed += POLL_MS;
    }
  }
}
```

The `isRunning()` in the spec host flips false on a timer, so `waitFor` must poll through `sleep`, which the spec resolves immediately; the `until`-style loop above handles that because `elapsed` only counts polls.

- [ ] **Step 5: Run both specs to pass**, commit `feat(examples/chat): stage record-mode transport and the four-beat script`.

---

### Task 6: Bridge, route component, route

**Files:** create `stage-bridge.ts` (+spec), `stage-mode.component.ts` (+spec); modify `src/app/app.routes.ts`.

- [ ] **Step 1: Failing specs**

```ts
// examples/chat/angular/src/app/stage/stage-bridge.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { createStageBridge, STAGE_MESSAGE_TYPE } from './stage-bridge';

function env(referrer = 'https://threadplane.ai/') {
  const listeners: ((e: MessageEvent) => void)[] = [];
  const parent = { postMessage: vi.fn() } as unknown as Window;
  const self = {
    addEventListener: (_: string, cb: (e: MessageEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  } as unknown as Window;
  return { referrer, parent, self, fire: (data: unknown, origin = 'https://threadplane.ai', source: unknown = parent) => listeners.forEach((l) => l({ data, origin, source } as MessageEvent)) };
}

describe('createStageBridge', () => {
  it('delivers seek targets from an allowlisted parent and ignores others', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: e.referrer, parent: e.parent, self: e.self });
    const seen: number[] = [];
    bridge.onSeek((t) => seen.push(t));
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 1200 });
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 5 }, 'https://evil.example');
    e.fire({ type: 'other', t: 7 });
    e.fire({ type: STAGE_MESSAGE_TYPE, t: 'nope' });
    expect(seen).toEqual([1200]);
  });
  it('posts ready and applied state to the parent only', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: e.referrer, parent: e.parent, self: e.self });
    bridge.postReady({ totalMs: 9000, beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }] });
    bridge.postState({ applied: 3, phase: 'stream', t: 120 });
    expect((e.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
      { type: STAGE_MESSAGE_TYPE, ready: true, totalMs: 9000, beats: [{ beat: 'stream', startMs: 0, endMs: 1000 }] },
      { type: STAGE_MESSAGE_TYPE, applied: 3, phase: 'stream', t: 120 },
    ]);
  });
  it('posts nothing when not embedded', () => {
    const e = env();
    const bridge = createStageBridge({ referrer: '', parent: e.self, self: e.self });
    bridge.postState({ applied: 1, phase: 'stream', t: 0 });
    expect(e.parent.postMessage).not.toHaveBeenCalled();
  });
});
```

```ts
// examples/chat/angular/src/app/stage/stage-mode.component.spec.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StageMode } from './stage-mode.component';
import { StageReplayTransport } from './stage-replay.transport';
import { MINIMAL } from './stage-recording.types.spec';

describe('StageMode', () => {
  let fx: ComponentFixture<StageMode>;
  beforeEach(async () => {
    StageMode.disableAutoBootForTests();
    TestBed.configureTestingModule({ imports: [StageMode], providers: [provideRouter([])] });
    TestBed.overrideComponent(StageMode, { set: { providers: StageMode.providersForTest(new StageReplayTransport(async () => MINIMAL)) } });
    fx = TestBed.createComponent(StageMode);
    fx.detectChanges();
    await fx.whenStable();
  });
  it('renders the chat, the devtools region, and an inert interrupt panel host', () => {
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('chat')).toBeTruthy();
    expect(el.querySelector('chat-debug')).toBeTruthy();
    expect(el.querySelector('[data-stage-interrupt]')).toBeTruthy();
    expect(el.querySelector('[data-stage-pill]')?.textContent).toMatch(/recorded LangGraph run/i);
  });
  it('exposes the timeline for recorders and seeks to ?t= on boot', async () => {
    await fx.componentInstance.boot(new URLSearchParams('t=25'));
    expect(fx.componentInstance.timeline()?.totalMs).toBeGreaterThan(0);
    expect(fx.componentInstance.controller()?.t()).toBe(25);
  });
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement the bridge**

```ts
// examples/chat/angular/src/app/stage/stage-bridge.ts
import { isAllowedParentOrigin } from '../hero/hero-bridge';
import type { StagePhase, TimelineBeat } from './stage-timeline';

export const STAGE_MESSAGE_TYPE = 'tplane-stage';

export interface StageReady { totalMs: number; beats: readonly TimelineBeat[]; }
export interface StageState { applied: number; phase: StagePhase; t: number; }

export interface StageBridge {
  onSeek(cb: (t: number) => void): () => void;
  postReady(ready: StageReady): void;
  postState(state: StageState): void;
}

interface BridgeEnv { referrer: string; parent: Window; self: Window; }

function originOf(url: string): string | null { try { return new URL(url).origin; } catch { return null; } }

/**
 * The parent page owns scroll and posts `{ type: 'tplane-stage', t }`; the
 * frame answers with `{ ready, totalMs, beats }` once and `{ applied, phase, t }`
 * whenever its applied state changes. Same origin allowlist as the hero.
 */
export function createStageBridge(env: BridgeEnv): StageBridge {
  const fromReferrer = originOf(env.referrer);
  let parentOrigin: string | null = fromReferrer !== null && isAllowedParentOrigin(fromReferrer) ? fromReferrer : null;
  const embedded = env.parent !== env.self;
  const post = (msg: Record<string, unknown>) => {
    if (!embedded || parentOrigin === null) return;
    env.parent.postMessage({ type: STAGE_MESSAGE_TYPE, ...msg }, parentOrigin);
  };
  return {
    onSeek(cb) {
      const handler = (e: MessageEvent) => {
        if (e.source !== env.parent) return;
        if (!isAllowedParentOrigin(e.origin)) return;
        const d = e.data as { type?: string; t?: unknown } | null;
        if (!d || d.type !== STAGE_MESSAGE_TYPE || typeof d.t !== 'number' || !Number.isFinite(d.t)) return;
        if (parentOrigin === null) parentOrigin = e.origin;
        cb(d.t);
      };
      env.self.addEventListener('message', handler);
      return () => env.self.removeEventListener('message', handler);
    },
    postReady(ready) { post({ ready: true, totalMs: ready.totalMs, beats: ready.beats }); },
    postState(state) { post({ applied: state.applied, phase: state.phase, t: state.t }); },
  };
}

export function browserStageBridge(): StageBridge {
  return createStageBridge({ referrer: document.referrer, parent: window.parent, self: window });
}
```

`isAllowedParentOrigin` is already exported from `../hero/hero-bridge.ts`.

- [ ] **Step 4: Implement the component**

```ts
// examples/chat/angular/src/app/stage/stage-mode.component.ts
import {
  ChangeDetectionStrategy, Component, DestroyRef, EnvironmentInjector, InjectionToken,
  afterNextRender, createEnvironmentInjector, effect, inject, signal, type Provider, type WritableSignal,
} from '@angular/core';
import { ChatComponent, ChatInterruptPanelComponent, createAgentRef, type AgentRef } from '@threadplane/chat';
import { ChatDebugComponent } from '@threadplane/chat/debug';
import { FetchStreamTransport, injectAgent, provideAgent, type AgentConfig, type LangGraphAgent } from '@threadplane/langgraph';
import { environment } from '../../environments/environment';
import { demoViews } from '../demo-views';
import { StageController } from './stage-controller';
import { browserStageBridge, type StageBridge } from './stage-bridge';
import { StageRecordingTransport } from './stage-recording.transport';
import { StageReplayTransport } from './stage-replay.transport';
import { StageScript } from './stage-script';
import type { StageTimeline } from './stage-timeline';

export const STAGE_REF = createAgentRef<Record<string, unknown>>('stage');
const STAGE_THREAD_ID = new InjectionToken<WritableSignal<string | null>>('STAGE_THREAD_ID');
const STAGE_RECORDING = new InjectionToken<StageRecordingTransport | null>('STAGE_RECORDING');

/** Same filter the demo shell and the hero apply: only generate's tokens are transcript. */
const TRANSCRIPT_NODE_NAMES = ['generate'];

function isRecordMode(): boolean {
  if (environment.production || typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('record') === '1';
}

function scopedAgent(ref: AgentRef<Record<string, unknown>>, config: AgentConfig): LangGraphAgent {
  const injector = createEnvironmentInjector(provideAgent(ref, config), inject(EnvironmentInjector));
  inject(DestroyRef).onDestroy(() => injector.destroy());
  return injector.get(ref.token) as LangGraphAgent;
}

function stageProviders(replay?: StageReplayTransport): Provider[] {
  return [
    { provide: StageReplayTransport, useFactory: () => replay ?? new StageReplayTransport() },
    { provide: STAGE_THREAD_ID, useFactory: () => signal<string | null>(null) },
    {
      provide: STAGE_RECORDING,
      useFactory: () => {
        if (!isRecordMode()) return null;
        const threadId = inject(STAGE_THREAD_ID);
        const rec = new StageRecordingTransport(new FetchStreamTransport(environment.langGraphApiUrl, (id) => { threadId.set(id); rec.onThreadId(id); }));
        return rec;
      },
    },
    {
      provide: STAGE_REF.token,
      useFactory: () => {
        const recording = inject(STAGE_RECORDING);
        const threadId = inject(STAGE_THREAD_ID);
        return recording
          ? scopedAgent(STAGE_REF, { apiUrl: environment.langGraphApiUrl, assistantId: environment.assistantId, threadId, onThreadId: (id) => threadId.set(id), transport: recording, transcriptNodeNames: TRANSCRIPT_NODE_NAMES })
          : scopedAgent(STAGE_REF, { assistantId: 'stage-replay', threadId, transport: inject(StageReplayTransport), transcriptNodeNames: TRANSCRIPT_NODE_NAMES });
      },
    },
  ];
}

declare global { interface Window { __stageTimeline?: StageTimeline; } }

/**
 * The stage (live-stage spec §4): the real chat beside the real devtools,
 * replaying one recorded run to whatever time the embedder asks for. No live
 * mode, no takeover; `?record=1` (non-production) runs the four-beat script
 * against the live backend instead and publishes the recording on `window`.
 */
@Component({
  selector: 'stage-mode',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, ChatDebugComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: stageProviders(),
  template: `
    <div class="stage" [attr.data-phase]="controller()?.phase()">
      <div class="stage__bar">
        <span class="stage__url">demo.threadplane.ai</span>
        <span class="stage__pill" data-stage-pill>
          @if (recording) { Recording a live LangGraph run } @else { Replaying a recorded LangGraph run }
        </span>
        <a class="stage__link" href="/embed" target="_top">Open the live demo</a>
      </div>
      <div class="stage__surface">
        <div class="stage__chat">
          <div class="stage__interrupt" data-stage-interrupt [attr.data-inert]="!recording">
            @if (agent.interrupt?.()) {
              <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
            }
          </div>
          <chat [agent]="agent" [views]="catalog" />
        </div>
        <chat-debug [agent]="agent" dock="right" [defaultOpen]="true" launcher="none" storageKey="stage-debug" />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .stage { display: flex; flex-direction: column; height: 100%; }
    .stage__bar { display: flex; align-items: center; gap: 12px; padding: 6px 12px; font: 12px/1.3 system-ui, sans-serif; border-bottom: 1px solid rgba(128,128,128,.25); }
    .stage__url { opacity: .6; }
    .stage__pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; border: 1px solid #b5731a; color: #b5731a; }
    .stage__link { margin-left: auto; color: inherit; font: inherit; }
    /* The devtools panel is position: fixed and docks to the frame's right edge;
       the chat column leaves it that room. --stage-devtools-width is measured
       in Task 6 Step 6 against the panel's real width and set once here. */
    .stage__surface { position: relative; flex: 1; min-height: 0; display: flex; }
    .stage__chat { flex: 1; min-width: 0; display: flex; flex-direction: column; padding-right: var(--stage-devtools-width, 420px); }
    .stage__chat > chat { flex: 1; min-height: 0; }
    .stage__interrupt { padding: 8px 12px 0; }
    /* Replay: the panel is a picture of a decision, not a control. Record mode keeps it live. */
    .stage__interrupt[data-inert="true"] { pointer-events: none; }
  `],
})
export class StageMode {
  static providersForTest(replay?: StageReplayTransport): Provider[] { return stageProviders(replay); }
  static autoBoot = true;
  static disableAutoBootForTests(): void { StageMode.autoBoot = false; }
  static enableAutoBoot(): void { StageMode.autoBoot = true; }

  private readonly destroyRef = inject(DestroyRef);
  private readonly replayTransport = inject(StageReplayTransport);
  protected readonly recording = inject(STAGE_RECORDING);
  protected readonly agent = injectAgent(STAGE_REF) as LangGraphAgent;
  protected readonly catalog = demoViews();
  readonly timeline = signal<StageTimeline | null>(null);
  readonly controller = signal<StageController | null>(null);
  /** TEST SEAM: replaced by the spec; browser bridge by default. */
  bridge: StageBridge = typeof window === 'undefined' ? { onSeek: () => () => undefined, postReady: () => undefined, postState: () => undefined } : browserStageBridge();
  private frame: number | null = null;
  private pendingT: number | null = null;

  constructor() {
    afterNextRender(() => { if (StageMode.autoBoot) void this.boot(new URLSearchParams(location.search)); });
    effect(() => {
      const c = this.controller();
      if (!c) return;
      this.bridge.postState({ applied: c.applied(), phase: c.phase(), t: c.t() });
    });
  }

  async boot(params: URLSearchParams): Promise<void> {
    if (this.recording) { await this.record(); return; }
    const tl = await this.replayTransport.ready();
    this.timeline.set(tl);
    if (typeof window !== 'undefined') window.__stageTimeline = tl;
    const controller = new StageController(this.agent, this.replayTransport, tl, await this.replayTransport['getRecording']());
    this.controller.set(controller);
    this.bridge.postReady({ totalMs: tl.totalMs, beats: tl.beats });
    const off = this.bridge.onSeek((t) => this.requestSeek(t));
    this.destroyRef.onDestroy(off);
    const t = Number(params.get('t'));
    await controller.seek(Number.isFinite(t) ? t : 0);
  }

  /** One seek per animation frame; the last target wins. */
  private requestSeek(t: number): void {
    this.pendingT = t;
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const target = this.pendingT; this.pendingT = null;
      if (target !== null) void this.controller()?.seek(target);
    });
  }

  protected async onInterruptAction(action: 'accept' | 'edit' | 'respond' | 'ignore'): Promise<void> {
    if (!this.recording) return;
    await this.agent.submit(null, { command: { resume: action === 'accept' ? 'approved' : 'denied' } } as never);
  }

  private async record(): Promise<void> {
    const rec = this.recording!;
    const agent = this.agent;
    const script = new StageScript({
      beginRun: (beat, action) => rec.beginRun(beat, action),
      submit: async (message, checkpointIndex) => {
        const cp = checkpointIndex !== undefined ? agent.history()[checkpointIndex]?.id : undefined;
        void agent.submit({ message }, cp ? ({ checkpointId: cp } as never) : undefined);
      },
      resume: async (value) => { void agent.submit(null, { command: { resume: value } } as never); },
      reload: async () => {
        const id = rec.recording().threadId;
        agent.switchThread(null);
        agent.switchThread(id);
        await new Promise<void>((resolve) => { const tick = () => (agent.messages().length > 0 && !agent.isThreadLoading() ? resolve() : setTimeout(tick, 50)); tick(); });
        rec.markReload();
      },
      isRunning: () => agent.isLoading(),
      hasInterrupt: () => !!agent.interrupt?.(),
      forkIndex: () => {
        // The first answer's checkpoint: history() is newest-first, so the one whose values hold exactly two messages.
        const idx = agent.history().findIndex((cp) => (((cp as { values?: { messages?: unknown[] } }).values?.messages?.length) ?? 0) === 2);
        return idx < 0 ? agent.history().length - 1 : idx;
      },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    await script.run();
  }
}
```

Replace `await this.replayTransport['getRecording']()` with a public `recording()` accessor on `StageReplayTransport` (add `async recordingData(): Promise<StageRecording> { return this.getRecording(); }` in Task 3's file) — the bracket access is a placeholder for that method; do not ship it.

Add the route in `app.routes.ts` after `hero`:

```ts
  {
    path: 'stage',
    pathMatch: 'full',
    loadComponent: () => import('./stage/stage-mode.component').then((m) => m.StageMode),
  },
```

- [ ] **Step 5: Run the specs to pass**; `npx nx lint examples-chat-angular` zero errors; `npx nx build examples-chat-angular --configuration=production` succeeds (the debug entry point adds to the bundle; note the initial-bundle warning delta versus main and report it).

- [ ] **Step 6: Measure the devtools width**

Start the dev server (`npx nx serve examples-chat-angular --port 4200`), open `http://localhost:4200/stage?t=0` (replay needs no backend, but the recording does not exist until Task 7 — for this measurement, temporarily copy `hero-replay.json` is NOT valid; instead open `/stage?record=1` is also wrong without a backend. So: measure on `/embed` with the devtools opened from the sidebar launcher, or read the panel's width from `libs/chat/debug/.../chat-debug.component.ts` styles (`.panel--right { width: … }`).) Set `--stage-devtools-width` in the component to that width plus 16px and record the number in the comment. Stop the server.

- [ ] **Step 7: Commit** `feat(examples/chat): /stage route — real chat beside real devtools, seekable by ?t= and by postMessage`.

---

### Task 7: Record the fixture live; pin it

**Files:** create `e2e/record-stage-fixture.record.ts`, `e2e/record-stage-live.config.ts`; produce `public/stage-replay.json`; create `src/app/stage/stage-replay.fixture.spec.ts`.

- [ ] **Step 1: The fixture spec (fails until the recording exists)**

```ts
// examples/chat/angular/src/app/stage/stage-replay.fixture.spec.ts
/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateStageRecording } from './stage-recording.types';
import { buildTimeline } from './stage-timeline';

const FIXTURE = resolve(__dirname, '../../../public/stage-replay.json');

describe('stage-replay.json', () => {
  const rec = validateStageRecording(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  const tl = buildTimeline(rec);
  const json = (i: number) => JSON.stringify(rec.runs[i].events);
  const run = (beat: string, kind: string) => rec.runs.findIndex((r) => r.beat === beat && r.action.kind === kind);

  it('walks stream, persist, approve, render', () => {
    expect(tl.beats.map((b) => b.beat)).toEqual(['stream', 'persist', 'approve', 'render']);
  });
  it('the stream beat calls search_documents and attaches citations', () => {
    expect(json(run('stream', 'submit'))).toMatch(/"name":\s*"search_documents"/);
    expect(json(run('stream', 'submit'))).toMatch(/citations/);
  });
  it('the persist beat has a reload with a recorded history and a fork', () => {
    expect(rec.histories.length).toBeGreaterThan(0);
    expect(rec.runs.some((r) => r.action.kind === 'submit' && r.action.checkpointIndex !== undefined)).toBe(true);
  });
  it('the approve beat lists, pauses inside delete_backups, and resumes with an audit', () => {
    const a = json(run('approve', 'submit'));
    expect(a).toMatch(/"name":\s*"list_backups"/);
    expect(a).toMatch(/"name":\s*"delete_backups"/);
    expect(a).not.toMatch(/"name":\s*"request_approval"/);
    expect(a).toMatch(/approval_request/);
    expect(json(run('approve', 'resume'))).toMatch(/deleted\\":\s*\[/);
  });
  it('the render beat carries an A2UI payload', () => {
    expect(json(run('render', 'submit'))).toMatch(/a2ui_JSON/);
  });
  it('never contains an API key or bearer token', () => {
    expect(JSON.stringify(rec)).not.toMatch(/sk-[A-Za-z0-9]{10,}|Bearer /);
  });
});
```

The resume-audit regex targets the escaped JSON string inside the stringified events (`\"deleted\": [`); if it does not match, parse the ToolMessage content as the hero fixture spec does and assert `deleted` is a non-empty array.

- [ ] **Step 2: Recorder and config**

```ts
// examples/chat/angular/e2e/record-stage-fixture.record.ts
/**
 * NOT a test. Drives /stage?record=1 (the four-beat script against the live
 * agent, wrapped in StageRecordingTransport) and writes public/stage-replay.json.
 * Run through record-stage-live.config.ts with the backend and the dev server up.
 */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(__dirname, '../public/stage-replay.json');
/* eslint-disable @typescript-eslint/no-explicit-any */

test('record stage fixture', async ({ page }) => {
  page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
  await page.goto('/stage?record=1');
  await expect.poll(async () => page.evaluate(() => (window as any).__stageRecording?.runs.length ?? 0), { timeout: 400_000 }).toBe(7);
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = await page.evaluate(() => (window as any).__stageRecording?.runs.at(-1)?.events.length ?? 0);
    if (n > 0 && n === last) break;
    last = n;
    await page.waitForTimeout(3000);
  }
  const rec = await page.evaluate(() => (window as any).__stageRecording);
  expect(rec.runs.map((r: any) => `${r.beat}:${r.action.kind}`)).toEqual([
    'stream:submit', 'persist:reload', 'persist:submit', 'persist:submit', 'approve:submit', 'approve:resume', 'render:submit',
  ]);
  writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
});
```

`e2e/record-stage-live.config.ts`: copy `record-hero-live.config.ts`, change `testMatch` to `'**/record-stage-fixture.record.ts'` and the header comment's commands to this file's name. It starts nothing.

- [ ] **Step 3: Record**

```bash
cd examples/chat/python && export OPENAI_API_KEY=$(grep -E '^OPENAI_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2-) && uv run langgraph dev --port 2024 --no-browser
```
```bash
npx nx serve examples-chat-angular --port 4200
```
```bash
npx playwright test -c examples/chat/angular/e2e/record-stage-live.config.ts record-stage-fixture
```

Take several takes; keep one where the fixture spec passes AND the approve run has exactly one `delete_backups` call (no refused first attempt) AND the resume answer is under 1,400 characters. Never edit the prose. Then `cd examples/chat/angular && npx vitest run src/app/stage/stage-replay.fixture` → PASS. Stop both servers before any e2e.

- [ ] **Step 4: Commit** `feat(examples/chat): record the four-beat stage fixture live` (the JSON, the recorder, the config, the fixture spec).

---

### Task 8: Stills recorder and the replay e2e

**Files:** create `e2e/record-stage.config.ts`, `e2e/record-stage-stills.record.ts`, `e2e/stage.spec.ts`.

- [ ] **Step 1: e2e on the committed replay**

```ts
// examples/chat/angular/e2e/stage.spec.ts
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene } from './test-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function timeline(page: import('@playwright/test').Page) {
  await page.goto('/stage?t=0');
  await expect.poll(() => page.evaluate(() => !!(window as any).__stageTimeline), { timeout: 30_000 }).toBe(true);
  return page.evaluate(() => (window as any).__stageTimeline);
}

test.describe('stage replay', () => {
  test.describe.configure({ timeout: 120_000 });

  test('renders the chat beside the devtools and seeks to the approve hold', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toBeVisible();
    await page.goto(`/stage?t=${tl.hold.startMs + 1}`);
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });
    await expect(page.locator('app-backup-table [data-state="rows"]')).toBeAttached();
    expect(await page.locator('[data-stage-interrupt]').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(hygiene.consoleErrors).toEqual([]);
  });

  test('the end of the recording mounts the generated form and the devtools shows the thread', async ({ page }) => {
    const hygiene = attachBrowserHygiene(page);
    const tl = await timeline(page);
    await page.goto(`/stage?t=${tl.totalMs}`);
    await expect(page.locator('a2ui-surface').first()).toBeAttached({ timeout: 90_000 });
    await expect(page.locator('chat-interrupt-panel')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('region', { name: 'Chat devtools' })).toContainText(/checkpoint/i);
    expect(hygiene.consoleErrors).toEqual([]);
  });
});
```

Run: `npx playwright test -c examples/chat/angular/e2e/playwright.config.ts stage.spec.ts hero.spec.ts` (aimock-backed servers; replay needs no model). Expected: pass. Fix whatever fails in the component (not the recording).

- [ ] **Step 2: Stills**

`e2e/record-stage.config.ts`: copy `record-hero.config.ts` (aimock-backed global setup), `testMatch: '**/record-stage-stills.record.ts'`, header comment explaining it produces the website's fallback stills.

```ts
// examples/chat/angular/e2e/record-stage-stills.record.ts
/**
 * NOT a test. Captures one still per beat from the committed stage replay, at
 * desktop and phone widths, for the website's non-pinned fallback (spec §8).
 *   npx playwright test --config examples/chat/angular/e2e/record-stage.config.ts record-stage-stills
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import sharp from 'sharp';

/* eslint-disable @typescript-eslint/no-explicit-any */
const OUT_DIR = resolve(__dirname, '../../../../apps/website/public/screenshots');
const SIZES = [{ suffix: '', width: 1200, height: 720, ship: 1200 }, { suffix: '-mobile', width: 390, height: 650, ship: 585 }];

test('capture stage stills', async ({ page }) => {
  await page.goto('/stage?t=0');
  await page.waitForFunction(() => !!(window as any).__stageTimeline);
  const tl = await page.evaluate(() => (window as any).__stageTimeline);
  const settle: Record<string, number> = {
    stream: tl.beats[0].endMs,
    persist: tl.beats[1].endMs,
    approve: tl.hold.startMs + Math.round((tl.hold.endMs - tl.hold.startMs) / 2),
    render: tl.totalMs,
  };
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const [beat, t] of Object.entries(settle)) {
      await page.goto(`/stage?t=${t}`);
      await page.waitForFunction((target) => (window as any).__stageApplied?.t === target, t, { timeout: 60_000 });
      await page.waitForTimeout(400);
      const png = await page.screenshot({ type: 'png', fullPage: false });
      await sharp(png).resize({ width: size.ship }).webp({ quality: 60, effort: 6 }).toFile(resolve(OUT_DIR, `stage-${beat}${size.suffix}.webp`));
    }
  }
});
```

For the `__stageApplied` wait, have `StageMode` also set `window.__stageApplied = { applied, phase, t }` in the same effect that posts state (add it in Task 6 if you are reading ahead; otherwise add it now with a one-line spec assertion).

Run the recorder; open each of the eight files and check: the approve still shows the panel and the table; the render still shows the form; nothing is sliced. Each file must be under 120 KB; if not, lower quality to 50.

- [ ] **Step 3: Commit** `feat(examples/chat): stage replay e2e and the still recorder for the website fallback` (include the eight webp files under `apps/website/public/screenshots/`).

---

### Task 9: Verification and PR

- [ ] **Step 1: Everything**

```bash
cd examples/chat/angular && npx vitest run
npx nx lint examples-chat-angular 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "
npx nx build examples-chat-angular --configuration=production 2>&1 | grep -E "Initial total|exceeded|Successfully"
npx playwright test -c examples/chat/angular/e2e/playwright.config.ts stage.spec.ts hero.spec.ts interrupt-approval.spec.ts
cd apps/website && npx vitest run src/lib/section-media.spec.ts
```

All green. Report the production bundle delta (the `@threadplane/chat/debug` entry is lazy through the route, so the initial bundle should not grow; if it does, say by how much).

- [ ] **Step 2: PR**

```bash
git push -u origin blove/stage-route
gh pr create --title "feat(examples/chat): /stage — the real chat beside the real devtools, seekable to any recorded time (live-stage plan 2 of 3)" --body-file - <<'EOF'
## Why

Plan 2 of the homepage live stage (`docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §4–6): the website will scrub one real run with scroll. This PR builds the thing it scrubs, in the demo app, verifiable on its own.

## What

- `/stage`: real `<chat>` beside real `<chat-debug>`, replaying `public/stage-replay.json` (a live capture of four beats: stream with citations, reload + fork, the backup cleanup with its interrupt, the generated form) to any recorded time via `?t=` or the `tplane-stage` postMessage protocol.
- `StageReplayTransport` gates recorded events behind a target time; `StageController` performs each run's recorded action as time crosses it, holds at the interrupt for an authored window, and rewinds by reset + fast-forward.
- `?record=1` runs the four-beat script against the live backend through `StageRecordingTransport`, which captures runs with their actions, history responses, and the thread id.
- Still recorder writes eight `apps/website/public/screenshots/stage-*.webp` for the website's non-pinned fallback.

## Tests

Types, timeline, transport gate, controller against the real LangGraph agent (forward, reload restore, hold, resume, rewind, coalescing), recording transport, script order, bridge, component; fixture spec pins the four beats and the guardrail; e2e on the committed replay.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

---

## Self-review

**Spec coverage:** §4.2 route (Task 6), §4.3 protocol (Task 6 bridge: `t` in; `ready`/`applied`/`phase` out — the spec's `data-sc-verify-state` write is the parent's job in plan 3), §4.4 seekable replay (Tasks 3–4; the spec's "snapshot ring every 200 events" is deferred: rewinds reset and fast-forward through the gate, and Task 4's rewind test is the budget check — if it is slow, add snapshots then), §4.5 devtools untouched (Task 6 uses the component as is), §5.1 script and fixture spec (Tasks 5, 7), §5.2's beat boundaries exported for plan 3 (`timeline.beats`, posted in `ready`), §6 hold (Task 2 `HOLD_MS`, Task 4 tests), §8 stills (Task 8), §13 plan 2's `?t=` verification (Tasks 6, 8).

**Deviations stated:** the spec §5.1 says "forks from the previous checkpoint through the agent's branch API"; this plan forks by submitting with `checkpointId` of the first answer's checkpoint, which is the LangGraph branch primitive. The spec §4.4 batching claim is realised by the async gate rather than a synchronous apply; the controller test asserts outcomes, not frame timing.

**Placeholders:** Task 6's `this.replayTransport['getRecording']()` is called out as not-to-ship with the replacement named. Task 6 Step 6's devtools width is a measured value the step tells you how to obtain.

**Type consistency:** `StageAction`/`StageBeat`/`StageRun`/`StageRecording` (Task 1) are used by Tasks 2–7 with the same field names; `buildTimeline` returns `{ runs, beats, hold, totalMs }` consumed by Tasks 3, 4, 6, 8; `StageReplayTransport` exposes `seek`, `reset`, `ready`, `applied`, `appliedSignal`, `runIndex`, `getHistory` used by Tasks 4 and 6; `StageController` exposes `seek`, `phase`, `applied`, `t` used by Task 6; `StageScriptHost` (Task 5) is implemented in Task 6's `record()`; the bridge messages in Task 6 match the spec §4.3 shape.
