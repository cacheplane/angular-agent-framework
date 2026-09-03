# Hero Demo Route (`/hero`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/hero` route to the canonical demo (`examples/chat/angular`) that replays a recorded LangGraph run through the real `<chat>` components with a scripted cursor, and hands control to the live LangGraph agent when the visitor interacts.

**Architecture:** A top-level lazy route with its own `HeroMode` component. Two agents are provided at component level: a replay agent backed by `HeroReplayTransport` (plays `public/hero-replay.json`) and a live agent backed by the adapter's default `FetchStreamTransport`. A pure `HeroScriptRunner` drives the walkthrough through a host interface; a `HeroBridge` talks to the embedding website over `postMessage`. Recording uses `HeroRecordingTransport` (a wrapper around `FetchStreamTransport`) driven by a Playwright `.record.ts` script against the aimock-backed backend, so no API key is needed.

**Tech Stack:** Angular 20 (zoneless, signals, standalone), `@threadplane/chat`, `@threadplane/langgraph`, Vitest + Angular TestBed (`examples/chat/angular/vite.config.mts`), Playwright (`examples/chat/angular/e2e`), aimock replay.

**Spec:** `docs/superpowers/specs/2026-09-02-homepage-rebuild-design.md` §4.3.

**Branch:** work on `blove/homepage-rebuild-spec` (cut from `origin/main`) or a branch from it. Run `npm ci` once in a fresh worktree before anything else. In a worktree the demo has no `.env`; symlink the main checkout's `.env` before any live serve.

---

## File map

| Path | Responsibility |
|---|---|
| `examples/chat/angular/src/app/hero/hero-recording.types.ts` | `RecordedEvent`, `RecordedRun`, `HeroRecording` types + `validateHeroRecording()` |
| `examples/chat/angular/src/app/hero/hero-replay.transport.ts` | `HeroReplayTransport` (injectable `AgentTransport`, paces recorded runs) |
| `examples/chat/angular/src/app/hero/hero-recording.transport.ts` | `HeroRecordingTransport` (wraps `FetchStreamTransport`, captures runs) |
| `examples/chat/angular/src/app/hero/hero-script.ts` | `HeroScriptRunner`, `HeroScriptHost`, `HeroScriptState`, `HERO_PROMPTS` |
| `examples/chat/angular/src/app/hero/hero-bridge.ts` | `HeroBridge` postMessage helpers with origin allowlist |
| `examples/chat/angular/src/app/hero/hero-cursor.component.ts` | `<hero-cursor>` SVG cursor positioned by signals |
| `examples/chat/angular/src/app/hero/hero-agent-refs.ts` | `HERO_REPLAY_REF`, `HERO_LIVE_REF` |
| `examples/chat/angular/src/app/hero/hero-mode.component.ts` | `HeroMode` route component: agents, chat, interrupt panel, pills, takeover |
| `examples/chat/angular/src/app/app.routes.ts` | add the `hero` route |
| `examples/chat/angular/public/hero-replay.json` | committed recording (three runs) |
| `examples/chat/angular/e2e/record-hero.config.ts` | Playwright config for `*.record.ts` without video |
| `examples/chat/angular/e2e/record-hero-fixture.record.ts` | drives `/hero?record=1`, writes the fixture |
| `examples/chat/angular/e2e/hero.spec.ts` | e2e: replay reaches the interrupt, takeover goes live, replay restarts |
| `apps/website/public/screenshots/hero-walkthrough-poster.webp` | poster for the website (captured in Task 13) |

Every new `.ts` file starts with `// SPDX-License-Identifier: MIT` like its neighbors.

---

### Task 1: Recording types and validator

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-recording.types.ts`
- Test: `examples/chat/angular/src/app/hero/hero-recording.types.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { validateHeroRecording, type HeroRecording } from './hero-recording.types';

const good: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    { label: 'prompt', events: [{ tMs: 0, event: { type: 'messages', messages: [] } }] },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'interrupt' } }] },
    { label: 'genui', events: [{ tMs: 12, event: { type: 'values' } }] },
  ],
};

describe('validateHeroRecording', () => {
  it('accepts a three-run recording', () => {
    expect(validateHeroRecording(good)).toEqual(good);
  });

  it('rejects a recording with fewer than three runs', () => {
    expect(() => validateHeroRecording({ ...good, runs: good.runs.slice(0, 2) })).toThrow(/three runs/);
  });

  it('rejects an event without a numeric tMs', () => {
    const bad = { ...good, runs: [{ label: 'x', events: [{ event: { type: 'values' } }] }, good.runs[1], good.runs[2]] };
    expect(() => validateHeroRecording(bad)).toThrow(/tMs/);
  });

  it('rejects non-objects', () => {
    expect(() => validateHeroRecording(null)).toThrow(/object/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-recording.types.spec.ts`
Expected: FAIL, cannot resolve `./hero-recording.types`.

- [ ] **Step 3: Write the types and validator**

```ts
// SPDX-License-Identifier: MIT
import type { StreamEvent } from '@threadplane/langgraph';

/** One transport event with its offset from the start of its run. */
export interface RecordedEvent {
  readonly tMs: number;
  readonly event: StreamEvent;
}

/** One `AgentTransport.stream()` call, start to finish. */
export interface RecordedRun {
  readonly label: string;
  readonly events: readonly RecordedEvent[];
}

/** The committed hero walkthrough: prompt → interrupt, resume, generative UI. */
export interface HeroRecording {
  readonly version: 1;
  readonly recordedAt: string;
  readonly runs: readonly RecordedRun[];
}

export const HERO_RECORDING_RUN_COUNT = 3;

/** Throws a readable error when the fixture is not a usable recording. */
export function validateHeroRecording(input: unknown): HeroRecording {
  if (typeof input !== 'object' || input === null) throw new Error('hero recording must be an object');
  const rec = input as Partial<HeroRecording>;
  if (rec.version !== 1) throw new Error('hero recording version must be 1');
  if (!Array.isArray(rec.runs) || rec.runs.length < HERO_RECORDING_RUN_COUNT) {
    throw new Error(`hero recording needs at least three runs, got ${rec.runs?.length ?? 0}`);
  }
  rec.runs.forEach((run, i) => {
    if (typeof run.label !== 'string') throw new Error(`run ${i} has no label`);
    if (!Array.isArray(run.events)) throw new Error(`run ${i} has no events`);
    run.events.forEach((e, j) => {
      if (typeof e?.tMs !== 'number' || !Number.isFinite(e.tMs)) throw new Error(`run ${i} event ${j} has no numeric tMs`);
      if (typeof e.event !== 'object' || e.event === null) throw new Error(`run ${i} event ${j} has no event`);
    });
  });
  return rec as HeroRecording;
}
```

`StreamEvent` is exported from `@threadplane/langgraph` (`libs/langgraph/src/lib/agent.types.ts`). If the import fails, check `libs/langgraph/src/public-api.ts` for the export name and use it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-recording.types.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-recording.types.ts examples/chat/angular/src/app/hero/hero-recording.types.spec.ts
git commit -m "feat(examples/chat): hero recording types and validator"
```

---

### Task 2: HeroReplayTransport

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-replay.transport.ts`
- Test: `examples/chat/angular/src/app/hero/hero-replay.transport.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { HeroReplayTransport, type ReplayClock } from './hero-replay.transport';
import type { HeroRecording } from './hero-recording.types';

const recording: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    {
      label: 'prompt',
      events: [
        { tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'He' }] } },
        { tMs: 5, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Hello' }] } },
        { tMs: 2000, event: { type: 'interrupt' } },
      ],
    },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'values' } }] },
    { label: 'genui', events: [{ tMs: 0, event: { type: 'values' } }] },
  ],
};

function fakeClock(): ReplayClock & { waits: number[] } {
  const waits: number[] = [];
  return { waits, sleep: async (ms) => { waits.push(ms); } };
}

async function collect(it: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('HeroReplayTransport', () => {
  it('plays runs in order across successive stream() calls', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    const ctl = new AbortController();
    const first = await collect(t.stream('hero', null, {}, ctl.signal));
    const second = await collect(t.stream('hero', null, {}, ctl.signal));
    expect(first).toHaveLength(3);
    expect(second).toEqual([{ type: 'values' }]);
  });

  it('paces by recorded gaps clamped to [30, 600] ms', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    await collect(t.stream('hero', null, {}, new AbortController().signal));
    // gaps: 0 → 30 (floor), 5 → 30 (floor), 1995 → 600 (ceiling)
    expect(clock.waits).toEqual([30, 30, 600]);
  });

  it('stops when the signal aborts', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    const ctl = new AbortController();
    const out: unknown[] = [];
    for await (const e of t.stream('hero', null, {}, ctl.signal)) {
      out.push(e);
      ctl.abort();
    }
    expect(out).toHaveLength(1);
  });

  it('reset() rewinds to the first run', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    const sig = new AbortController().signal;
    await collect(t.stream('hero', null, {}, sig));
    t.reset();
    const again = await collect(t.stream('hero', null, {}, sig));
    expect(again).toHaveLength(3);
  });

  it('yields nothing once every run is consumed', async () => {
    const clock = fakeClock();
    const t = new HeroReplayTransport(clock, async () => recording);
    const sig = new AbortController().signal;
    for (let i = 0; i < 3; i++) await collect(t.stream('hero', null, {}, sig));
    expect(await collect(t.stream('hero', null, {}, sig))).toEqual([]);
  });

  it('loads the recording only once', async () => {
    const load = vi.fn(async () => recording);
    const t = new HeroReplayTransport(fakeClock(), load);
    const sig = new AbortController().signal;
    await collect(t.stream('hero', null, {}, sig));
    await collect(t.stream('hero', null, {}, sig));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-replay.transport.spec.ts`
Expected: FAIL, cannot resolve `./hero-replay.transport`.

- [ ] **Step 3: Write the transport**

```ts
// SPDX-License-Identifier: MIT
import { Injectable } from '@angular/core';
import type {
  AgentQueueEntry,
  AgentTransport,
  LangGraphSubmitOptions,
  StreamEvent,
} from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import { validateHeroRecording, type HeroRecording } from './hero-recording.types';

export interface ReplayClock {
  sleep(ms: number): Promise<void>;
}

/** Floor keeps tokens visibly streaming even when the recording was near-atomic
 *  (aimock replay is); ceiling keeps long model pauses from stalling the hero. */
export const REPLAY_MIN_GAP_MS = 30;
export const REPLAY_MAX_GAP_MS = 600;

export const HERO_RECORDING_URL = '/hero-replay.json';

const realClock: ReplayClock = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

async function fetchRecording(): Promise<HeroRecording> {
  const res = await fetch(HERO_RECORDING_URL);
  if (!res.ok) throw new Error(`hero recording fetch failed: ${res.status}`);
  return validateHeroRecording(await res.json());
}

/**
 * AgentTransport that answers each `stream()` call with the next recorded run.
 * Backs the hero's replay agent. No backend, no LLM. NOT for production apps.
 */
@Injectable()
export class HeroReplayTransport implements AgentTransport {
  private recording: Promise<HeroRecording> | null = null;
  private runIndex = 0;

  constructor(
    private readonly clock: ReplayClock = realClock,
    private readonly load: () => Promise<HeroRecording> = fetchRecording,
  ) {}

  /** Resolves once the fixture is loaded; the hero posts `ready` after this. */
  ready(): Promise<void> {
    return this.getRecording().then(() => undefined);
  }

  reset(): void {
    this.runIndex = 0;
  }

  async *stream(
    _assistantId: string,
    _threadId: string | null,
    _payload: unknown,
    signal: AbortSignal,
    _options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    const rec = await this.getRecording();
    const run = rec.runs[this.runIndex];
    if (!run) return;
    this.runIndex += 1;
    let last = 0;
    for (const { tMs, event } of run.events) {
      if (signal.aborted) return;
      const gap = Math.min(REPLAY_MAX_GAP_MS, Math.max(REPLAY_MIN_GAP_MS, tMs - last));
      last = tMs;
      await this.clock.sleep(gap);
      if (signal.aborted) return;
      yield event;
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
      id: 'hero-replay-queued-run',
      threadId,
      values: payload,
      options: { ...options, multitaskStrategy: 'enqueue' },
      createdAt: new Date(),
    };
  }

  async cancelRun(): Promise<void> {
    return;
  }

  async getHistory(): Promise<ThreadState[]> {
    return [];
  }

  async *joinStream(): AsyncIterable<StreamEvent> {
    yield* [];
  }

  private getRecording(): Promise<HeroRecording> {
    this.recording ??= this.load();
    return this.recording;
  }
}
```

If `AgentQueueEntry` or `LangGraphSubmitOptions` are not exported from the package root, copy the import lines from `libs/langgraph/src/lib/testing/fake-stream.transport.ts` and adjust to the public path used there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-replay.transport.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-replay.transport.ts examples/chat/angular/src/app/hero/hero-replay.transport.spec.ts
git commit -m "feat(examples/chat): HeroReplayTransport plays recorded runs with clamped pacing"
```

---

### Task 3: HeroRecordingTransport

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-recording.transport.ts`
- Test: `examples/chat/angular/src/app/hero/hero-recording.transport.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HeroRecordingTransport } from './hero-recording.transport';
import type { AgentTransport, StreamEvent } from '@threadplane/langgraph';

function innerWith(events: StreamEvent[]): AgentTransport {
  return {
    async *stream() {
      for (const e of events) yield e;
    },
  };
}

describe('HeroRecordingTransport', () => {
  it('passes events through and records them with offsets', async () => {
    let now = 1000;
    const t = new HeroRecordingTransport(innerWith([{ type: 'values' }, { type: 'messages' }]), () => (now += 40));
    const out: StreamEvent[] = [];
    for await (const e of t.stream('a', null, {}, new AbortController().signal)) out.push(e);
    expect(out).toEqual([{ type: 'values' }, { type: 'messages' }]);
    const rec = t.recording();
    expect(rec.runs).toHaveLength(1);
    expect(rec.runs[0].events.map((e) => e.tMs)).toEqual([40, 80]);
  });

  it('labels runs in order: prompt, resume, genui, then run-N', async () => {
    const t = new HeroRecordingTransport(innerWith([{ type: 'values' }]), () => 0);
    const sig = new AbortController().signal;
    for (let i = 0; i < 4; i++) for await (const _ of t.stream('a', null, {}, sig)) { /* drain */ }
    expect(t.recording().runs.map((r) => r.label)).toEqual(['prompt', 'resume', 'genui', 'run-4']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-recording.transport.spec.ts`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Write the recording wrapper**

```ts
// SPDX-License-Identifier: MIT
import type {
  AgentQueueEntry,
  AgentTransport,
  LangGraphSubmitOptions,
  StreamEvent,
} from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { HeroRecording, RecordedRun } from './hero-recording.types';

const RUN_LABELS = ['prompt', 'resume', 'genui'] as const;

declare global {
  interface Window {
    /** Set by HeroRecordingTransport in record mode; read by the record script. */
    __heroRecording?: HeroRecording;
  }
}

/**
 * Wraps the real transport, forwards everything, and keeps a copy of every
 * `stream()` call's events with millisecond offsets. Only wired when
 * `/hero?record=1` is opened in a non-production build.
 */
export class HeroRecordingTransport implements AgentTransport {
  private readonly runs: RecordedRun[] = [];

  constructor(
    private readonly inner: AgentTransport,
    private readonly now: () => number = () => performance.now(),
  ) {}

  recording(): HeroRecording {
    return { version: 1, recordedAt: new Date().toISOString(), runs: [...this.runs] };
  }

  async *stream(
    assistantId: string,
    threadId: string | null,
    payload: unknown,
    signal: AbortSignal,
    options?: LangGraphSubmitOptions,
  ): AsyncIterable<StreamEvent> {
    const start = this.now();
    const events: { tMs: number; event: StreamEvent }[] = [];
    const index = this.runs.length;
    const run: RecordedRun = { label: RUN_LABELS[index] ?? `run-${index + 1}`, events };
    this.runs.push(run);
    for await (const event of this.inner.stream(assistantId, threadId, payload, signal, options)) {
      events.push({ tMs: Math.round(this.now() - start), event });
      this.publish();
      yield event;
    }
    this.publish();
  }

  joinStream(threadId: string, runId: string, lastEventId: string | undefined, signal: AbortSignal): AsyncIterable<StreamEvent> {
    return this.inner.joinStream ? this.inner.joinStream(threadId, runId, lastEventId, signal) : (async function* () {})();
  }

  createQueuedRun(assistantId: string, threadId: string, payload: unknown, signal: AbortSignal, options?: LangGraphSubmitOptions): Promise<AgentQueueEntry> {
    if (!this.inner.createQueuedRun) throw new Error('inner transport cannot queue runs');
    return this.inner.createQueuedRun(assistantId, threadId, payload, signal, options);
  }

  cancelRun(threadId: string, runId: string, signal: AbortSignal): Promise<void> {
    return this.inner.cancelRun ? this.inner.cancelRun(threadId, runId, signal) : Promise.resolve();
  }

  getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
    return this.inner.getHistory ? this.inner.getHistory(threadId, signal) : Promise.resolve([]);
  }

  updateState(threadId: string, values: Record<string, unknown>, signal: AbortSignal, options?: { asNode?: string }): Promise<void> {
    return this.inner.updateState ? this.inner.updateState(threadId, values, signal, options) : Promise.resolve();
  }

  private publish(): void {
    if (typeof window !== 'undefined') window.__heroRecording = this.recording();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-recording.transport.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-recording.transport.ts examples/chat/angular/src/app/hero/hero-recording.transport.spec.ts
git commit -m "feat(examples/chat): HeroRecordingTransport captures live runs for the hero fixture"
```

---

### Task 4: HeroScriptRunner (pure, host-driven)

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-script.ts`
- Test: `examples/chat/angular/src/app/hero/hero-script.spec.ts`

The runner never touches the DOM. It calls a `HeroScriptHost`, which `HeroMode` implements in Task 8.

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HeroScriptRunner, HERO_PROMPTS, type HeroScriptHost } from './hero-script';

interface FakeHost extends HeroScriptHost {
  log: string[];
  interruptPresent: boolean;
  running: boolean;
}

function fakeHost(): FakeHost {
  const host: FakeHost = {
    log: [],
    interruptPresent: false,
    running: false,
    reducedMotion: false,
    typeInto: async (text) => { host.log.push(`type:${text}`); },
    send: async () => { host.log.push('send'); host.running = true; },
    acceptInterrupt: async () => { host.log.push('accept'); host.interruptPresent = false; host.running = true; },
    moveCursor: async (target) => { host.log.push(`cursor:${target}`); },
    hasInterrupt: () => host.interruptPresent,
    isRunning: () => host.running,
    restartReplay: async () => { host.log.push('restart'); },
  };
  return host;
}

/** Zero-delay clock that lets waits resolve when the predicate flips. */
const clock = { sleep: async () => {} };

describe('HeroScriptRunner', () => {
  it('waits for visibility before typing', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.start();
    await Promise.resolve();
    expect(host.log).toEqual([]);
    expect(r.state()).toBe('waiting');
  });

  it('runs prompt → send → accept → prompt 2 → send → done', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    // Let it type + send, then simulate the graph pausing.
    await until(() => host.log.includes('send'));
    host.running = false; host.interruptPresent = true;
    await until(() => host.log.includes('accept'));
    host.running = false;
    await until(() => host.log.filter((l) => l === 'send').length === 2);
    host.running = false;
    await done;
    expect(host.log).toEqual([
      'cursor:composer', `type:${HERO_PROMPTS[0]}`, 'cursor:send', 'send',
      'cursor:accept', 'accept',
      'cursor:composer', `type:${HERO_PROMPTS[1]}`, 'cursor:send', 'send',
    ]);
    expect(r.state()).toBe('done');
  });

  it('pauses when hidden and resumes where it stopped', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    r.setVisible(false);
    expect(r.state()).toBe('paused');
    host.running = false; host.interruptPresent = true;
    await Promise.resolve();
    expect(host.log).not.toContain('accept');
    r.setVisible(true);
    await until(() => host.log.includes('accept'));
    r.stop();
    await done;
  });

  it('stop() ends the run without further host calls', async () => {
    const host = fakeHost();
    const r = new HeroScriptRunner(host, clock);
    r.setVisible(true);
    const done = r.start();
    await until(() => host.log.includes('send'));
    r.stop();
    await done;
    expect(r.state()).toBe('stopped');
    const n = host.log.length;
    host.running = false; host.interruptPresent = true;
    await Promise.resolve();
    expect(host.log.length).toBe(n);
  });
});

async function until(pred: () => boolean, max = 200): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (pred()) return;
    await new Promise((res) => setTimeout(res, 0));
  }
  throw new Error('condition not met');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-script.spec.ts`
Expected: FAIL, cannot resolve `./hero-script`.

- [ ] **Step 3: Write the runner**

```ts
// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';

/**
 * The two prompts must stay VERBATIM: aimock fixtures match on the exact user
 * message (see e2e/fixtures/interrupt-approval.json and contact-form.json), so
 * rewording either one breaks recording.
 */
export const HERO_PROMPTS = [
  'I want to clean up old database backups older than 90 days. Walk me through ' +
    'what you would delete, and call request_approval before doing anything ' +
    'destructive so I can review your plan.',
  'Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button.',
] as const;

export type CursorTarget = 'composer' | 'send' | 'accept';

export interface HeroScriptHost {
  readonly reducedMotion: boolean;
  typeInto(text: string): Promise<void>;
  send(): Promise<void>;
  acceptInterrupt(): Promise<void>;
  moveCursor(target: CursorTarget): Promise<void>;
  hasInterrupt(): boolean;
  isRunning(): boolean;
  restartReplay(): Promise<void>;
}

export interface ScriptClock {
  sleep(ms: number): Promise<void>;
}

export type HeroScriptState = 'idle' | 'waiting' | 'running' | 'paused' | 'done' | 'stopped';

export const HOLD_AFTER_DONE_MS = 8000;
const POLL_MS = 50;
const SETTLE_MS = 400;

const realClock: ScriptClock = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export class HeroScriptRunner {
  readonly state = signal<HeroScriptState>('idle');
  private visible = false;
  private stopped = false;
  private wake: (() => void) | null = null;

  constructor(private readonly host: HeroScriptHost, private readonly clock: ScriptClock = realClock) {}

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      if (this.state() === 'paused') this.state.set('running');
      this.wake?.();
    } else if (this.state() === 'running') {
      this.state.set('paused');
    }
  }

  stop(): void {
    this.stopped = true;
    this.state.set('stopped');
    this.wake?.();
  }

  /** Runs one full walkthrough. Resolves when done or stopped. */
  async start(): Promise<void> {
    this.stopped = false;
    this.state.set('waiting');
    await this.gate();
    if (this.stopped) return;
    this.state.set('running');

    await this.step(() => this.host.moveCursor('composer'));
    await this.step(() => this.host.typeInto(HERO_PROMPTS[0]));
    await this.step(() => this.host.moveCursor('send'));
    await this.step(() => this.host.send());
    await this.waitFor(() => this.host.hasInterrupt());
    await this.step(() => this.host.moveCursor('accept'));
    await this.step(() => this.host.acceptInterrupt());
    await this.waitFor(() => !this.host.isRunning() && !this.host.hasInterrupt());
    await this.step(() => this.clock.sleep(SETTLE_MS));
    await this.step(() => this.host.moveCursor('composer'));
    await this.step(() => this.host.typeInto(HERO_PROMPTS[1]));
    await this.step(() => this.host.moveCursor('send'));
    await this.step(() => this.host.send());
    await this.waitFor(() => !this.host.isRunning());
    if (this.stopped) return;
    this.state.set('done');
  }

  /** Loops start() with a hold and a fresh replay between passes until stopped. */
  async loop(): Promise<void> {
    while (!this.stopped) {
      await this.start();
      if (this.stopped) return;
      await this.clock.sleep(HOLD_AFTER_DONE_MS);
      if (this.stopped) return;
      await this.host.restartReplay();
    }
  }

  private async step(fn: () => Promise<void>): Promise<void> {
    if (this.stopped) return;
    await this.gate();
    if (this.stopped) return;
    await fn();
  }

  private async waitFor(pred: () => boolean): Promise<void> {
    while (!this.stopped) {
      await this.gate();
      if (this.stopped) return;
      if (pred()) return;
      await this.clock.sleep(POLL_MS);
      // Yield to the macrotask queue even with a zero-delay clock.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Blocks while hidden. */
  private gate(): Promise<void> {
    if (this.visible || this.stopped) return Promise.resolve();
    return new Promise((resolve) => {
      this.wake = () => { this.wake = null; resolve(); };
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-script.spec.ts`
Expected: PASS (4 tests). If the "pauses when hidden" test is flaky, the `gate()` must be awaited before every host call (it is, via `step`); check that `waitFor` also gates.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-script.ts examples/chat/angular/src/app/hero/hero-script.spec.ts
git commit -m "feat(examples/chat): HeroScriptRunner drives the walkthrough through a host interface"
```

---

### Task 5: HeroBridge (postMessage with origin allowlist)

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-bridge.ts`
- Test: `examples/chat/angular/src/app/hero/hero-bridge.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { HERO_PARENT_ORIGINS, createHeroBridge } from './hero-bridge';

describe('createHeroBridge', () => {
  it('posts state to the parent when the referrer origin is allowlisted', () => {
    const post = vi.fn();
    const b = createHeroBridge({ referrer: 'https://threadplane.ai/', parent: { postMessage: post } as unknown as Window, self: {} as Window });
    b.postState('ready');
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', state: 'ready' }, 'https://threadplane.ai');
  });

  it('does not post when the referrer is not allowlisted', () => {
    const post = vi.fn();
    const b = createHeroBridge({ referrer: 'https://evil.example/', parent: { postMessage: post } as unknown as Window, self: {} as Window });
    b.postState('ready');
    expect(post).not.toHaveBeenCalled();
  });

  it('delivers visibility only from an allowlisted origin', () => {
    const listeners: ((e: MessageEvent) => void)[] = [];
    const self = { addEventListener: (_: string, l: (e: MessageEvent) => void) => listeners.push(l), removeEventListener: vi.fn() } as unknown as Window;
    const b = createHeroBridge({ referrer: '', parent: { postMessage: vi.fn() } as unknown as Window, self });
    const seen: boolean[] = [];
    b.onVisibility((v) => seen.push(v));
    listeners[0]({ origin: 'https://threadplane.ai', data: { type: 'tplane-hero', visible: true } } as MessageEvent);
    listeners[0]({ origin: 'https://evil.example', data: { type: 'tplane-hero', visible: false } } as MessageEvent);
    listeners[0]({ origin: 'http://localhost:3000', data: { type: 'other' } } as MessageEvent);
    expect(seen).toEqual([true]);
  });

  it('allowlist contains the production and local website origins', () => {
    expect(HERO_PARENT_ORIGINS).toEqual([
      'https://threadplane.ai',
      'https://www.threadplane.ai',
      'http://localhost:3000',
      'http://127.0.0.1:4308',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-bridge.spec.ts`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Write the bridge**

```ts
// SPDX-License-Identifier: MIT
export type HeroFrameState = 'ready' | 'scripted' | 'paused' | 'live' | 'replay';

export const HERO_MESSAGE_TYPE = 'tplane-hero';

/** Only these embedders receive frame state or can pause the script. */
export const HERO_PARENT_ORIGINS: readonly string[] = [
  'https://threadplane.ai',
  'https://www.threadplane.ai',
  'http://localhost:3000',
  'http://127.0.0.1:4308',
];

export interface HeroBridge {
  postState(state: HeroFrameState): void;
  onVisibility(cb: (visible: boolean) => void): () => void;
}

interface BridgeEnv {
  referrer: string;
  parent: Window;
  self: Window;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function createHeroBridge(env: BridgeEnv): HeroBridge {
  const parentOrigin = originOf(env.referrer);
  const allowed = parentOrigin !== null && HERO_PARENT_ORIGINS.includes(parentOrigin);
  return {
    postState(state) {
      if (!allowed || env.parent === env.self) return;
      env.parent.postMessage({ type: HERO_MESSAGE_TYPE, state }, parentOrigin as string);
    },
    onVisibility(cb) {
      const handler = (e: MessageEvent) => {
        if (!HERO_PARENT_ORIGINS.includes(e.origin)) return;
        const d = e.data as { type?: string; visible?: unknown } | null;
        if (!d || d.type !== HERO_MESSAGE_TYPE || typeof d.visible !== 'boolean') return;
        cb(d.visible);
      };
      env.self.addEventListener('message', handler);
      return () => env.self.removeEventListener('message', handler);
    },
  };
}

export function browserHeroBridge(): HeroBridge {
  return createHeroBridge({ referrer: document.referrer, parent: window.parent, self: window });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-bridge.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-bridge.ts examples/chat/angular/src/app/hero/hero-bridge.spec.ts
git commit -m "feat(examples/chat): hero postMessage bridge with parent-origin allowlist"
```

---

### Task 6: Cursor component

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-cursor.component.ts`
- Test: `examples/chat/angular/src/app/hero/hero-cursor.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HeroCursorComponent } from './hero-cursor.component';

describe('HeroCursorComponent', () => {
  it('is hidden until shown, then positions itself', () => {
    TestBed.configureTestingModule({ imports: [HeroCursorComponent] });
    const fx = TestBed.createComponent(HeroCursorComponent);
    fx.componentRef.setInput('x', 0);
    fx.componentRef.setInput('y', 0);
    fx.componentRef.setInput('visible', false);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.dataset['visible']).toBe('false');
    fx.componentRef.setInput('visible', true);
    fx.componentRef.setInput('x', 120);
    fx.componentRef.setInput('y', 48);
    fx.detectChanges();
    expect(el.dataset['visible']).toBe('true');
    expect(el.style.transform).toBe('translate(120px, 48px)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-cursor.component.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The scripted pointer. Purely decorative: aria-hidden, pointer-events none,
 * moved with a CSS transition on transform (disabled under reduced motion).
 */
@Component({
  selector: 'hero-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-visible]': 'visible()',
    '[attr.data-pressed]': 'pressed()',
    '[style.transform]': '"translate(" + x() + "px, " + y() + "px)"',
  },
  template: `
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M4 2l6 18 2.6-7.4L20 10z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `,
  styles: [`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 20;
      pointer-events: none;
      opacity: 0;
      transition: transform 600ms cubic-bezier(.2,.7,.2,1), opacity 200ms ease;
      will-change: transform;
    }
    :host([data-visible="true"]) { opacity: 1; }
    :host([data-pressed="true"]) svg { transform: scale(.85); }
    @media (prefers-reduced-motion: reduce) {
      :host { transition: opacity 200ms ease; }
    }
  `],
})
export class HeroCursorComponent {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly visible = input<boolean>(false);
  readonly pressed = input<boolean>(false);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-cursor.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-cursor.component.ts examples/chat/angular/src/app/hero/hero-cursor.component.spec.ts
git commit -m "feat(examples/chat): hero cursor component"
```

---

### Task 7: Agent refs and route registration

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-agent-refs.ts`
- Modify: `examples/chat/angular/src/app/app.routes.ts`
- Test: `examples/chat/angular/src/app/app.routes.spec.ts` (create if absent)

- [ ] **Step 1: Write the refs**

```ts
// SPDX-License-Identifier: MIT
import { createAgentRef } from '@threadplane/chat';

/** Replay agent: HeroReplayTransport, no backend. */
export const HERO_REPLAY_REF = createAgentRef<Record<string, unknown>>('hero-replay');
/** Live agent: the canonical demo's LangGraph backend, fresh thread. */
export const HERO_LIVE_REF = createAgentRef<Record<string, unknown>>('hero-live');
```

- [ ] **Step 2: Write the failing route test**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('routes', () => {
  it('registers /hero as a top-level lazy route before the shell', () => {
    const heroIndex = routes.findIndex((r) => r.path === 'hero');
    const shellIndex = routes.findIndex((r) => r.path === '' && Array.isArray(r.children));
    expect(heroIndex).toBeGreaterThan(-1);
    expect(heroIndex).toBeLessThan(shellIndex);
    expect(typeof routes[heroIndex].loadComponent).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/app.routes.spec.ts`
Expected: FAIL (`heroIndex` is -1).

- [ ] **Step 4: Register the route**

In `examples/chat/angular/src/app/app.routes.ts`, insert after the first redirect entry (`{ path: '', pathMatch: 'full', redirectTo: 'embed' }`):

```ts
  {
    path: 'hero',
    loadComponent: () => import('./hero/hero-mode.component').then((m) => m.HeroMode),
  },
```

The component file does not exist yet; the dynamic import is only resolved at runtime, so this test passes now and Task 8 supplies the module.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/app.routes.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-agent-refs.ts examples/chat/angular/src/app/app.routes.ts examples/chat/angular/src/app/app.routes.spec.ts
git commit -m "feat(examples/chat): register lazy /hero route and hero agent refs"
```

---

### Task 8: HeroMode component

**Files:**
- Create: `examples/chat/angular/src/app/hero/hero-mode.component.ts`
- Test: `examples/chat/angular/src/app/hero/hero-mode.component.spec.ts`

- [ ] **Step 1: Write the failing test**

The test provides a tiny in-memory recording through `HeroReplayTransport`'s constructor override, so nothing is fetched.

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HeroMode } from './hero-mode.component';
import { HeroReplayTransport } from './hero-replay.transport';
import type { HeroRecording } from './hero-recording.types';

const recording: HeroRecording = {
  version: 1,
  recordedAt: '2026-09-02T00:00:00.000Z',
  runs: [
    { label: 'prompt', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Plan…' }] } }] },
    { label: 'resume', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'a', type: 'ai', content: 'Plan… done.' }] } }] },
    { label: 'genui', events: [{ tMs: 0, event: { type: 'messages', messages: [{ id: 'b', type: 'ai', content: 'Form' }] } }] },
  ],
};

describe('HeroMode', () => {
  let fx: ComponentFixture<HeroMode>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [HeroMode] });
    TestBed.overrideComponent(HeroMode, {
      set: {
        providers: HeroMode.providersForTest(
          new HeroReplayTransport({ sleep: async () => {} }, async () => recording),
        ),
      },
    });
    fx = TestBed.createComponent(HeroMode);
    fx.detectChanges();
    await fx.whenStable();
  });

  it('starts in replay mode with the recorded pill and a Take control button', () => {
    const el = fx.nativeElement as HTMLElement;
    expect(fx.componentInstance.mode()).toBe('replay');
    expect(el.querySelector('[data-hero-pill]')?.textContent).toMatch(/recorded LangGraph run/i);
    expect(el.querySelector('button[data-hero-take-control]')).toBeTruthy();
    expect(el.querySelector('chat')).toBeTruthy();
  });

  it('pointerdown inside the surface takes over: live pill, banner, replay link', () => {
    const el = fx.nativeElement as HTMLElement;
    el.querySelector('[data-hero-surface]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('live');
    expect(el.querySelector('[data-hero-pill]')?.textContent).toMatch(/Live · LangGraph/);
    expect(el.querySelector('[data-hero-banner]')?.textContent).toMatch(/walkthrough was a recording/i);
    expect(el.querySelector('button[data-hero-replay]')).toBeTruthy();
    expect(el.querySelector('button[data-hero-take-control]')).toBeNull();
  });

  it('focusin inside the surface also takes over', () => {
    const el = fx.nativeElement as HTMLElement;
    el.querySelector('[data-hero-surface]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('live');
  });

  it('Replay walkthrough returns to replay mode', () => {
    const el = fx.nativeElement as HTMLElement;
    (el.querySelector('button[data-hero-take-control]') as HTMLButtonElement).click();
    fx.detectChanges();
    (el.querySelector('button[data-hero-replay]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.mode()).toBe('replay');
  });

  it('posts frame state through the bridge on mode changes', () => {
    const states: string[] = [];
    fx.componentInstance.bridge = { postState: (s) => states.push(s), onVisibility: () => () => {} };
    (fx.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[data-hero-take-control]')!.click();
    fx.detectChanges();
    expect(states).toContain('live');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-mode.component.spec.ts`
Expected: FAIL, cannot resolve `./hero-mode.component`.

- [ ] **Step 3: Write the component**

```ts
// SPDX-License-Identifier: MIT
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  type Provider,
} from '@angular/core';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  a2uiBasicCatalog,
  type Agent,
  type InterruptAction,
} from '@threadplane/chat';
import { FetchStreamTransport, injectAgent, provideAgent, type LangGraphAgent } from '@threadplane/langgraph';
import { environment } from '../../environments/environment';
import { WelcomeSuggestionsComponent } from '../modes/welcome-suggestions.component';
import { HERO_LIVE_REF, HERO_REPLAY_REF } from './hero-agent-refs';
import { browserHeroBridge, type HeroBridge } from './hero-bridge';
import { HeroCursorComponent } from './hero-cursor.component';
import { HeroRecordingTransport } from './hero-recording.transport';
import { HeroReplayTransport } from './hero-replay.transport';
import { HeroScriptRunner, type CursorTarget, type HeroScriptHost } from './hero-script';

export type HeroModeKind = 'replay' | 'live';

const TYPE_DELAY_MS = 40;
const liveThreadId = signal<string | null>(null);

function isRecordMode(): boolean {
  if (environment.production || typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('record') === '1';
}

function liveAgentProviders(): Provider[] {
  return provideAgent(HERO_LIVE_REF, () => ({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.assistantId,
    threadId: liveThreadId,
    onThreadId: (id: string) => liveThreadId.set(id),
    transport: isRecordMode()
      ? new HeroRecordingTransport(
          new FetchStreamTransport(environment.langGraphApiUrl, (id) => liveThreadId.set(id)),
        )
      : undefined,
  }));
}

@Component({
  selector: 'hero-mode',
  standalone: true,
  imports: [ChatComponent, ChatInterruptPanelComponent, WelcomeSuggestionsComponent, HeroCursorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: HeroMode.providersForTest(),
  template: `
    <div class="hero" [attr.data-mode]="mode()">
      <div class="hero__bar">
        <span class="hero__url">demo.threadplane.ai</span>
        <span class="hero__pill" data-hero-pill [attr.data-live]="mode() === 'live'">
          <span class="hero__dot" aria-hidden="true"></span>
          @if (mode() === 'live') { Live · LangGraph · new thread } @else { Replaying a recorded LangGraph run }
        </span>
      </div>

      <div class="hero__surface" data-hero-surface
           (pointerdown)="takeControl()" (focusin)="takeControl()">
        @if (mode() === 'live') {
          <p class="hero__banner" data-hero-banner role="status">
            You are live on a new LangGraph thread. The walkthrough was a recording.
            <button type="button" class="hero__link" data-hero-replay (click)="replay($event)">Replay walkthrough</button>
          </p>
        }
        @if (activeAgent().interrupt && activeAgent().interrupt!()) {
          <div class="hero__interrupt" role="region" aria-label="Approval required">
            <chat-interrupt-panel [agent]="activeAgent()" (action)="onInterruptAction($event)" />
          </div>
        }
        <chat [agent]="activeAgent()" [views]="catalog">
          @if (mode() === 'live') {
            <welcome-suggestions chatWelcomeSuggestions (selected)="sendLive($event)" />
          }
        </chat>
        <hero-cursor [x]="cursorX()" [y]="cursorY()" [visible]="cursorVisible()" [pressed]="cursorPressed()" />
      </div>

      @if (mode() === 'replay') {
        <button type="button" class="hero__take" data-hero-take-control (click)="takeControl()">
          Take control ↗
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .hero { position: relative; display: flex; flex-direction: column; height: 100%; }
    .hero__bar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 6px 12px; font: 12px/1.3 system-ui, sans-serif; border-bottom: 1px solid rgba(128,128,128,.25); }
    .hero__url { opacity: .6; }
    .hero__pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px;
      border: 1px solid #b5731a; color: #b5731a; }
    .hero__pill[data-live="true"] { border-color: #2f6f4f; color: #2f6f4f; }
    .hero__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .hero__surface { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .hero__surface > chat { flex: 1; min-height: 0; }
    .hero__interrupt { padding: 8px 12px 0; }
    .hero__banner { margin: 0; padding: 8px 12px; font: 13px/1.4 system-ui, sans-serif;
      background: rgba(47,111,79,.08); border-bottom: 1px solid rgba(47,111,79,.3); }
    .hero__link { margin-left: 8px; background: none; border: 0; padding: 0; color: inherit;
      text-decoration: underline; cursor: pointer; font: inherit; }
    .hero__take { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); z-index: 10;
      padding: 8px 14px; border-radius: 999px; border: 0; background: #111; color: #fff;
      font: 600 13px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
    .hero__take:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  `],
})
export class HeroMode implements HeroScriptHost {
  /**
   * Static so the spec can substitute a preloaded replay transport. The
   * decorator uses the no-arg form.
   */
  static providersForTest(replay: HeroReplayTransport = new HeroReplayTransport()): Provider[] {
    return [
      { provide: HeroReplayTransport, useValue: replay },
      ...provideAgent(HERO_REPLAY_REF, () => ({ assistantId: 'hero-replay', transport: inject(HeroReplayTransport) })),
      ...liveAgentProviders(),
    ];
  }

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replayTransport = inject(HeroReplayTransport);
  private readonly replayAgent = injectAgent(HERO_REPLAY_REF) as LangGraphAgent;
  private readonly liveAgent = injectAgent(HERO_LIVE_REF) as LangGraphAgent;

  readonly mode = signal<HeroModeKind>(isRecordMode() ? 'live' : 'replay');
  readonly activeAgent = computed<Agent>(() => (this.mode() === 'live' ? this.liveAgent : this.replayAgent));
  protected readonly catalog = a2uiBasicCatalog();

  readonly cursorX = signal(0);
  readonly cursorY = signal(0);
  readonly cursorVisible = signal(false);
  readonly cursorPressed = signal(false);

  /** Replaced by the spec; browser bridge by default. */
  bridge: HeroBridge = typeof window === 'undefined'
    ? { postState: () => undefined, onVisibility: () => () => undefined }
    : browserHeroBridge();

  readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private runner: HeroScriptRunner | null = null;
  private visible = false;

  constructor() {
    afterNextRender(() => void this.boot());
    this.destroyRef.onDestroy(() => this.runner?.stop());
  }

  private async boot(): Promise<void> {
    const off = this.bridge.onVisibility((v) => this.setVisible(v));
    this.destroyRef.onDestroy(off);
    const onDocVis = () => this.setVisible(this.visible && !document.hidden);
    document.addEventListener('visibilitychange', onDocVis);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onDocVis));

    try {
      await this.replayTransport.ready();
    } catch (err) {
      console.error('hero recording unavailable; staying live', err);
      this.mode.set('live');
      this.bridge.postState('ready');
      return;
    }
    this.bridge.postState('ready');
    // Not embedded (opened directly, or in record mode): run as if visible.
    if (window.parent === window) this.setVisible(true);
    this.startRunner();
  }

  private startRunner(): void {
    this.runner?.stop();
    this.runner = new HeroScriptRunner(this);
    this.runner.setVisible(this.visible);
    this.bridge.postState('scripted');
    void this.runner.loop();
  }

  private setVisible(v: boolean): void {
    this.visible = v;
    this.runner?.setVisible(v);
    if (this.mode() === 'replay' && this.runner) this.bridge.postState(v ? 'scripted' : 'paused');
  }

  // ── takeover / replay ─────────────────────────────────────────────────

  takeControl(): void {
    if (this.mode() === 'live') return;
    this.runner?.stop();
    this.runner = null;
    this.cursorVisible.set(false);
    this.mode.set('live');
    this.bridge.postState('live');
  }

  replay(event?: Event): void {
    event?.stopPropagation();
    this.mode.set('replay');
    this.bridge.postState('replay');
    void this.restartReplay().then(() => this.startRunner());
  }

  protected sendLive(text: string): void {
    void this.liveAgent.submit({ message: text });
  }

  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const agent = this.activeAgent();
    if (!agent.interrupt?.()) return;
    const resume = action === 'ignore' ? 'denied' : 'approved';
    await agent.submit(null as never, { command: { resume } } as never);
  }

  // ── HeroScriptHost ────────────────────────────────────────────────────

  async typeInto(text: string): Promise<void> {
    const ta = this.textarea();
    if (!ta) return;
    const set = (value: string) => {
      ta.value = value;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    if (this.reducedMotion) { set(text); return; }
    for (let i = 1; i <= text.length; i++) {
      set(text.slice(0, i));
      await sleep(TYPE_DELAY_MS);
    }
  }

  async send(): Promise<void> {
    await this.press(this.sendButton());
  }

  async acceptInterrupt(): Promise<void> {
    await this.press(this.acceptButton());
  }

  async moveCursor(target: CursorTarget): Promise<void> {
    const el = target === 'composer' ? this.textarea() : target === 'send' ? this.sendButton() : this.acceptButton();
    if (!el) return;
    const surface = this.surface().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    this.cursorX.set(Math.round(r.left - surface.left + Math.min(r.width / 2, 40)));
    this.cursorY.set(Math.round(r.top - surface.top + r.height / 2));
    this.cursorVisible.set(true);
    await sleep(this.reducedMotion ? 0 : 650);
  }

  hasInterrupt(): boolean {
    return !!this.activeAgent().interrupt?.();
  }

  isRunning(): boolean {
    return this.activeAgent().isLoading();
  }

  async restartReplay(): Promise<void> {
    this.replayTransport.reset();
    this.replayAgent.switchThread(null);
  }

  // ── DOM helpers (scoped to this component's own surface) ──────────────

  private surface(): HTMLElement {
    return this.host.nativeElement.querySelector('[data-hero-surface]') as HTMLElement;
  }
  private textarea(): HTMLTextAreaElement | null {
    return this.surface().querySelector('textarea[aria-label="Type a message"]');
  }
  private sendButton(): HTMLButtonElement | null {
    return this.surface().querySelector('button[aria-label="Send message"]');
  }
  private acceptButton(): HTMLButtonElement | null {
    const buttons = Array.from(this.surface().querySelectorAll<HTMLButtonElement>('chat-interrupt-panel button'));
    return buttons.find((b) => /accept/i.test(b.textContent ?? '')) ?? null;
  }
  private async press(el: HTMLButtonElement | null): Promise<void> {
    if (!el) return;
    this.cursorPressed.set(true);
    await sleep(this.reducedMotion ? 0 : 120);
    el.click();
    this.cursorPressed.set(false);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

Notes for the implementer:
- `FetchStreamTransport` must be exported from `@threadplane/langgraph`; check `libs/langgraph/src/public-api.ts`. If it is not, export it there (one line) and regenerate api docs (`npx nx run website:generate-api-docs` or the target named in `apps/website/project.json`; memory says new exports need it).
- `providers: HeroMode.providersForTest()` in a decorator referencing the class works because decorators evaluate after the class body; if the TS config complains, hoist the provider array into a module-level `function heroProviders(replay?)` and reference that from both places.
- `switchThread(null)` resets the adapter's derived state and manager thread. If, when testing manually in Task 10, messages from the previous pass are still visible after Replay, wrap the `<chat>` in `@if (generation(); as g)` keyed by a counter incremented in `restartReplay()` so the composition remounts.
- The `(pointerdown)` on the surface fires before the click; a click on Accept during replay therefore lands on the live surface, which is acceptable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-mode.component.spec.ts`
Expected: PASS (5 tests). If `afterNextRender` does not fire in TestBed, that is fine: the spec only exercises mode switching and the bridge.

- [ ] **Step 5: Run the whole demo unit suite and lint**

Run: `npx nx test examples-chat-angular && npx nx lint examples-chat-angular`
Expected: both green. Fix lint errors (not pre-existing warnings).

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/hero/hero-mode.component.ts examples/chat/angular/src/app/hero/hero-mode.component.spec.ts
git commit -m "feat(examples/chat): HeroMode route — replay agent, scripted cursor, takeover to live LangGraph"
```

---

### Task 9: Record the fixture with aimock (no API key)

**Files:**
- Create: `examples/chat/angular/e2e/record-hero.config.ts`
- Create: `examples/chat/angular/e2e/record-hero-fixture.record.ts`
- Create: `examples/chat/angular/public/hero-replay.json` (generated)
- Test: `examples/chat/angular/src/app/hero/hero-replay.fixture.spec.ts`

- [ ] **Step 1: Write the fixture spec (fails until the fixture exists)**

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateHeroRecording } from './hero-recording.types';

const FIXTURE = resolve(__dirname, '../../../public/hero-replay.json');

describe('hero-replay.json', () => {
  const rec = validateHeroRecording(JSON.parse(readFileSync(FIXTURE, 'utf8')));

  it('has the prompt, resume and genui runs in order', () => {
    expect(rec.runs.slice(0, 3).map((r) => r.label)).toEqual(['prompt', 'resume', 'genui']);
  });

  it('the prompt run pauses on an interrupt', () => {
    const types = rec.runs[0].events.map((e) => String(e.event.type));
    expect(types.some((t) => t === 'interrupt' || t === 'interrupts' || t.startsWith('values'))).toBe(true);
    expect(JSON.stringify(rec.runs[0].events)).toMatch(/approval_request/);
  });

  it('the genui run carries an A2UI payload', () => {
    expect(JSON.stringify(rec.runs[2].events)).toMatch(/a2ui/i);
  });

  it('never contains an API key or bearer token', () => {
    expect(JSON.stringify(rec)).not.toMatch(/sk-[A-Za-z0-9]{10,}|Bearer /);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-replay.fixture.spec.ts`
Expected: FAIL (ENOENT).

- [ ] **Step 3: Write the Playwright record config**

```ts
// SPDX-License-Identifier: MIT
/**
 * Records the hero walkthrough fixture from `/hero?record=1` against the
 * aimock-backed backend, so no API key is needed and the take is deterministic.
 * `testMatch` picks up only `*.record.ts`, so CI never runs this.
 *
 *   npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-fixture
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/record-hero-fixture.record.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 240_000,
  use: { baseURL: 'http://localhost:4200', viewport: { width: 1200, height: 720 } },
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  outputDir: './.record-output',
});
```

- [ ] **Step 4: Write the record script**

```ts
// SPDX-License-Identifier: MIT
/**
 * NOT a test. Drives /hero?record=1 (the scripted walkthrough runs against the
 * live agent wrapped in HeroRecordingTransport) and writes the captured runs
 * to public/hero-replay.json. Run through record-hero.config.ts.
 */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(__dirname, '../public/hero-replay.json');

test('record hero walkthrough fixture', async ({ page }) => {
  await page.goto('/hero?record=1');
  // The script types, sends, accepts, sends again. Wait for three finished runs.
  await expect
    .poll(async () => page.evaluate(() => window.__heroRecording?.runs.length ?? 0), { timeout: 200_000 })
    .toBe(3);
  // Let the last run drain.
  await expect
    .poll(async () => page.evaluate(() => {
      const runs = window.__heroRecording?.runs ?? [];
      const last = runs[runs.length - 1];
      return last?.events.length ?? 0;
    }), { timeout: 60_000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(3000);
  const rec = await page.evaluate(() => window.__heroRecording);
  expect(rec?.runs.map((r) => r.label)).toEqual(['prompt', 'resume', 'genui']);
  writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
});
```

Add the `Window.__heroRecording` type to the e2e tsconfig scope by importing the type: at the top add `import type {} from '../src/app/hero/hero-recording.transport';` (a side-effect-free type import that brings the `declare global` into scope). If the e2e tsconfig excludes `src`, instead declare locally:

```ts
declare global { interface Window { __heroRecording?: { runs: { label: string; events: unknown[] }[] } } }
```

- [ ] **Step 5: Record**

The aimock fixtures for both prompts already exist (`e2e/fixtures/interrupt-approval.json`, `e2e/fixtures/contact-form.json`) and the global setup loads every fixture in the directory. Free ports 2024 and 4200 first (memory: stale serves silently serve old bundles).

```bash
npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-fixture
```

Expected: `wrote …/public/hero-replay.json`. Inspect the file: three runs, the first ending near an `approval_request`, the third containing `a2ui`.

If the script never reaches three runs, open `http://localhost:4200/hero?record=1` in a browser while the global setup servers are running (run the command with `PWDEBUG=1`) and watch which step stalls; the usual causes are the Accept button text (Task 8 `acceptButton()`), or the prompt text drifting from the fixture.

- [ ] **Step 6: Run the fixture spec**

Run: `npx nx test examples-chat-angular -- src/app/hero/hero-replay.fixture.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add examples/chat/angular/e2e/record-hero.config.ts examples/chat/angular/e2e/record-hero-fixture.record.ts examples/chat/angular/public/hero-replay.json examples/chat/angular/src/app/hero/hero-replay.fixture.spec.ts
git commit -m "feat(examples/chat): record and commit the hero walkthrough fixture"
```

---

### Task 10: Manual check of the replay in a browser

- [ ] **Step 1: Serve the demo**

Use the Browser pane (`preview_start` with a `.claude/launch.json` entry `examples-chat-angular` running `npx nx serve examples-chat-angular`, port 4200) and open `http://localhost:4200/hero`.

- [ ] **Step 2: Verify, and fix anything that fails**

Check, in order:
1. The pill reads "Replaying a recorded LangGraph run" and a cursor appears at the composer.
2. The first prompt types in, Send is pressed, tokens stream, tool progress appears, then the interrupt panel renders.
3. The cursor moves to Accept, presses it, the run resumes and finishes.
4. The second prompt types, sends, and an A2UI contact form renders.
5. After the hold, the transcript clears and the walkthrough restarts. If old messages remain, apply the `@if (generation())` remount described in Task 8.
6. Clicking anywhere, or tabbing into the composer, flips the pill to "Live · LangGraph · new thread", shows the banner and suggestion chips, and the cursor disappears. Typing a message sends to the live backend (requires the local LangGraph server on 2024 with an API key, or accept an error here and verify live on the deployed preview in Task 13).
7. "Replay walkthrough" returns to replay and restarts.
8. With the OS reduced-motion setting on, typing is instant and the cursor jumps.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A examples/chat/angular/src/app/hero
git commit -m "fix(examples/chat): hero replay polish from manual check"
```

---

### Task 11: e2e for `/hero`

**Files:**
- Create: `examples/chat/angular/e2e/hero.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { attachBrowserHygiene } from './test-helpers';

test.describe('hero walkthrough', () => {
  test('replays to the interrupt, takes over to live, and can replay again', async ({ page }) => {
    attachBrowserHygiene(page);
    await page.goto('/hero');

    const pill = page.locator('[data-hero-pill]');
    await expect(pill).toContainText(/recorded LangGraph run/i);

    // The script types and sends; the replayed run pauses on the interrupt.
    await expect(page.locator('chat-interrupt-panel')).toBeAttached({ timeout: 60_000 });

    // Takeover via the pill.
    await page.getByRole('button', { name: /take control/i }).click();
    await expect(pill).toContainText(/Live · LangGraph/);
    await expect(page.locator('[data-hero-banner]')).toContainText(/walkthrough was a recording/i);
    await expect(page.locator('hero-cursor')).toHaveAttribute('data-visible', 'false');

    // Back to replay.
    await page.getByRole('button', { name: /replay walkthrough/i }).click();
    await expect(pill).toContainText(/recorded LangGraph run/i);
  });

  test('focusing the composer takes over', async ({ page }) => {
    attachBrowserHygiene(page);
    await page.goto('/hero');
    await page.locator('[data-hero-surface] textarea').focus();
    await expect(page.locator('[data-hero-pill]')).toContainText(/Live · LangGraph/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx nx e2e examples-chat-angular -- hero.spec.ts`
Expected: PASS (2 tests). The global setup still boots aimock and langgraph; the replay itself needs neither.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/e2e/hero.spec.ts
git commit -m "test(examples/chat): e2e for the hero walkthrough and takeover"
```

---

### Task 12: Production build and bundle budget

- [ ] **Step 1: Build**

Run: `npx nx build examples-chat-angular --configuration=production`
Expected: succeeds; the initial bundle stays under the 1.6 MB warning. `hero-mode.component` should appear as its own lazy chunk in the output listing. If the initial bundle grew, confirm nothing in `app.routes.ts` imports `./hero/*` eagerly.

- [ ] **Step 2: Confirm the fixture ships as a static asset**

Run: `ls dist/examples/chat/angular/browser/hero-replay.json`
Expected: the file exists (the `public/**` assets glob copies it).

- [ ] **Step 3: Commit nothing; note the chunk size in the PR description**

---

### Task 13: Poster capture and deployed check

**Files:**
- Create: `examples/chat/angular/e2e/record-hero-poster.record.ts`
- Create: `apps/website/public/screenshots/hero-walkthrough-poster.webp`

- [ ] **Step 1: Write the poster script**

```ts
// SPDX-License-Identifier: MIT
/**
 * NOT a test. Captures the hero's first replay frame as the website's
 * server-rendered poster (1200x720, webp). Run through record-hero.config.ts
 * with the file name as a filter.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve(__dirname, '../../../../apps/website/public/screenshots/hero-walkthrough-poster.webp');

test('capture hero poster', async ({ page }) => {
  await page.goto('/hero');
  // First frame: prompt typed, first tokens streaming.
  await page.waitForSelector('[data-hero-surface] .chat-message, [data-hero-surface] chat-message', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const png = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(png).webp({ quality: 82 }).toFile(OUT);
  console.log(`wrote ${OUT}`);
});
```

Widen `testMatch` in `record-hero.config.ts` to `'**/record-hero-*.record.ts'` so both record scripts share it. `sharp` is present in `node_modules` (Next depends on it); if the import fails under the e2e tsconfig, use `await import('sharp')`.

- [ ] **Step 2: Capture**

```bash
npx playwright test --config examples/chat/angular/e2e/record-hero.config.ts record-hero-poster
```

Expected: `apps/website/public/screenshots/hero-walkthrough-poster.webp` exists, 1200×720, under 150 KB. Open it and confirm it shows the pill, a user message, and streaming text.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/e2e/record-hero-poster.record.ts examples/chat/angular/e2e/record-hero.config.ts apps/website/public/screenshots/hero-walkthrough-poster.webp
git commit -m "feat(website): hero walkthrough poster captured from /hero"
```

- [ ] **Step 4: After merge to main, verify the deployed route**

The `demo-deploy` job in `.github/workflows/ci.yml` promotes `examples/chat` to demo.threadplane.ai on push to main. After it runs, open `https://demo.threadplane.ai/hero` and repeat Task 10 steps 1 to 7, including a real live message after takeover. Record the result in the PR that ships the website hero (Plan B, Task 14).

---

## Self-review against spec §4.3

- Top-level route, own agents via two refs: Tasks 7, 8.
- HeroReplayTransport with `/hero-replay.json`, clamped pacing, `reset()`, no-op extras: Task 2.
- Three-run recording via `HeroRecordingTransport` and a `.record.ts` script, fixture spec with interrupt and A2UI assertions: Tasks 3, 9.
- Script runner with host interface, clock, pause/resume, reduced motion: Tasks 4, 8.
- Status pill, takeover on pill / pointerdown / focusin, banner, suggestion chips, replay link: Task 8, verified in Tasks 10, 11.
- Bridge with allowlist: Task 5.
- Poster for the website: Task 13.

Not covered here by design: the website side (`HeroDemo`), which is Plan B.
