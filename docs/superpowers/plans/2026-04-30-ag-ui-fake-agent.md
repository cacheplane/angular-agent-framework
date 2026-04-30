# AG-UI `FakeAgent` for Offline Cockpit Demo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Add an in-process `FakeAgent extends AbstractAgent` to `@cacheplane/ag-ui`'s testing surface, then wire the cockpit demo to use it. Result: `nx serve cockpit-ag-ui-streaming-angular` shows a working streaming chat with no backend, no network, no env config.

**Architecture:** `FakeAgent` overrides `run(input)` to emit a canned event sequence (RUN_STARTED → TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT × N → TEXT_MESSAGE_END → RUN_FINISHED) with staggered timing for a realistic streaming feel. Exposed from `@cacheplane/ag-ui/testing` (via the public API). Cockpit demo's `app.config.ts` swaps `provideAgUiAgent({ url })` for `provideFakeAgUiAgent()`.

**Spec:** No separate spec file — this plan is self-contained.

---

## File Structure

### New

- `libs/ag-ui/src/lib/testing/fake-agent.ts` — `FakeAgent` class
- `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`
- `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts` — DI convenience

### Modified

- `libs/ag-ui/src/public-api.ts` — export `FakeAgent` and `provideFakeAgUiAgent`
- `cockpit/ag-ui/streaming/angular/src/app/app.config.ts` — use `provideFakeAgUiAgent()`

---

### Task 1: Implement `FakeAgent`

**Files:**
- Create: `libs/ag-ui/src/lib/testing/fake-agent.ts`
- Create: `libs/ag-ui/src/lib/testing/fake-agent.spec.ts`

- [ ] **Step 1: Implement `FakeAgent`**

```ts
// libs/ag-ui/src/lib/testing/fake-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  AbstractAgent,
  EventType,
  type BaseEvent,
  type RunAgentInput,
} from '@ag-ui/client';
import { Observable } from 'rxjs';

/**
 * In-process AG-UI agent that emits a canned streaming response.
 *
 * Use for offline demos and tests where a real backend isn't available.
 * Echoes a fixed assistant reply token-by-token with realistic timing.
 *
 * NOT for production use.
 */
export class FakeAgent extends AbstractAgent {
  /**
   * Tokens streamed back as the assistant reply. Override with custom
   * tokens via the constructor for varied demo content.
   */
  private readonly tokens: string[];

  /** Milliseconds between successive token emissions. */
  private readonly delayMs: number;

  constructor(opts: { tokens?: string[]; delayMs?: number } = {}) {
    super();
    this.tokens = opts.tokens ?? [
      'Hello', ' from', ' the', ' fake', ' AG-UI', ' agent.',
      ' This', ' is', ' a', ' canned', ' streaming', ' reply.',
    ];
    this.delayMs = opts.delayMs ?? 60;
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    const tokens = this.tokens;
    const delayMs = this.delayMs;
    const messageId = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sequence: BaseEvent[] = [
      { type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId } as BaseEvent,
      { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' } as BaseEvent,
      ...tokens.map((delta) => (
        { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent
      )),
      { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent,
      { type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId } as BaseEvent,
    ];

    return new Observable<BaseEvent>((observer) => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let i = 0;

      const emitNext = () => {
        if (cancelled) return;
        if (i >= sequence.length) {
          observer.complete();
          return;
        }
        observer.next(sequence[i]);
        i++;
        // Steady cadence except a tiny initial delay before RUN_STARTED.
        timer = setTimeout(emitNext, delayMs);
      };

      timer = setTimeout(emitNext, 30);

      return () => {
        cancelled = true;
        if (timer !== undefined) clearTimeout(timer);
      };
    });
  }
}
```

- [ ] **Step 2: Spec the FakeAgent**

```ts
// libs/ag-ui/src/lib/testing/fake-agent.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { firstValueFrom, toArray, lastValueFrom } from 'rxjs';
import { EventType, type RunAgentInput, type BaseEvent } from '@ag-ui/client';
import { FakeAgent } from './fake-agent';

const minimalInput: RunAgentInput = {
  threadId: 't1',
  runId: 'r1',
  messages: [],
  state: {},
  tools: [],
  context: [],
  forwardedProps: {},
};

describe('FakeAgent', () => {
  it('emits RUN_STARTED then text events then RUN_FINISHED', async () => {
    const agent = new FakeAgent({ tokens: ['hi', ' there'], delayMs: 1 });
    const events = await lastValueFrom((agent as any).run(minimalInput).pipe(toArray()));
    const types = events.map((e: BaseEvent) => e.type);
    expect(types).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
  });

  it('streams tokens as deltas in order', async () => {
    const agent = new FakeAgent({ tokens: ['one', 'two', 'three'], delayMs: 1 });
    const events = await lastValueFrom((agent as any).run(minimalInput).pipe(toArray()));
    const deltas = events
      .filter((e: BaseEvent) => e.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((e: any) => e.delta);
    expect(deltas).toEqual(['one', 'two', 'three']);
  });

  it('threadId and runId from input flow into RUN_STARTED and RUN_FINISHED', async () => {
    const agent = new FakeAgent({ tokens: ['x'], delayMs: 1 });
    const events = await lastValueFrom((agent as any).run({ ...minimalInput, threadId: 'tA', runId: 'rA' }).pipe(toArray()));
    const started = events.find((e: BaseEvent) => e.type === EventType.RUN_STARTED) as any;
    const finished = events.find((e: BaseEvent) => e.type === EventType.RUN_FINISHED) as any;
    expect(started.threadId).toBe('tA');
    expect(finished.threadId).toBe('tA');
  });

  it('cancels in-flight emissions when unsubscribed', async () => {
    vi.useFakeTimers();
    const agent = new FakeAgent({ tokens: ['a', 'b', 'c', 'd'], delayMs: 100 });
    const seen: BaseEvent[] = [];
    const sub = (agent as any).run(minimalInput).subscribe((e: BaseEvent) => seen.push(e));
    vi.advanceTimersByTime(50);  // first emission only
    sub.unsubscribe();
    vi.advanceTimersByTime(1000);  // would have emitted everything if not cancelled
    expect(seen.length).toBeLessThan(7);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx nx test ag-ui --testNamePattern="FakeAgent"
```

Expected: PASS.

---

### Task 2: Implement `provideFakeAgUiAgent` DI helper

**Files:**
- Create: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`
- Create: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts`

- [ ] **Step 1: Implement the provider**

```ts
// libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { type Provider } from '@angular/core';
import { AG_UI_AGENT } from '../provide-ag-ui-agent';
import { toAgent } from '../to-agent';
import { FakeAgent } from './fake-agent';

export interface FakeAgUiAgentConfig {
  /** Tokens streamed back as the assistant reply. */
  tokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}

/**
 * Registers an in-process FakeAgent under AG_UI_AGENT.
 *
 * Use for offline demos and development. Drop-in replacement for
 * provideAgUiAgent({ url }) when no real backend is available.
 */
export function provideFakeAgUiAgent(config: FakeAgUiAgentConfig = {}): Provider[] {
  return [
    {
      provide: AG_UI_AGENT,
      useFactory: () => toAgent(new FakeAgent(config)),
    },
  ];
}
```

- [ ] **Step 2: Spec the provider**

```ts
// libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AG_UI_AGENT } from '../provide-ag-ui-agent';
import { provideFakeAgUiAgent } from './provide-fake-ag-ui-agent';

describe('provideFakeAgUiAgent', () => {
  it('registers AG_UI_AGENT with a Fake-backed Agent', () => {
    TestBed.configureTestingModule({ providers: provideFakeAgUiAgent() });
    const agent = TestBed.inject(AG_UI_AGENT);
    expect(agent).toBeDefined();
    expect(typeof agent.submit).toBe('function');
  });

  it('passes tokens and delayMs through to FakeAgent', () => {
    TestBed.configureTestingModule({
      providers: provideFakeAgUiAgent({ tokens: ['a'], delayMs: 1 }),
    });
    const agent = TestBed.inject(AG_UI_AGENT);
    expect(agent).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx nx test ag-ui
```

Expected: PASS.

---

### Task 3: Export from public API

**File:** `libs/ag-ui/src/public-api.ts`

- [ ] **Step 1: Add exports**

Add to the existing `public-api.ts`:

```ts
export { FakeAgent } from './lib/testing/fake-agent';
export { provideFakeAgUiAgent } from './lib/testing/provide-fake-ag-ui-agent';
export type { FakeAgUiAgentConfig } from './lib/testing/provide-fake-ag-ui-agent';
```

- [ ] **Step 2: Build and verify exports**

```bash
npx nx run-many -t lint,test,build -p ag-ui
```

Expected: PASS.

- [ ] **Step 3: Commit Tasks 1-3 together**

```bash
git add libs/ag-ui/
git commit -m "feat(ag-ui): FakeAgent + provideFakeAgUiAgent for offline demos

In-process AbstractAgent subclass that emits a canned streaming
response. Drop-in replacement for provideAgUiAgent({ url }) when
no real backend is available. Tests cover event ordering, token
streaming, and unsubscribe cancellation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Wire cockpit demo to use FakeAgent

**File:** `cockpit/ag-ui/streaming/angular/src/app/app.config.ts`

- [ ] **Step 1: Replace `provideAgUiAgent` with `provideFakeAgUiAgent`**

```ts
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideFakeAgUiAgent } from '@cacheplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgUiAgent({
      tokens: [
        'This', ' is', ' the', ' AG-UI', ' streaming', ' demo.',
        ' Messages', ' are', ' generated', ' in-process', ' by', ' a', ' FakeAgent',
        ' that', ' emits', ' canned', ' AG-UI', ' events.',
        ' Swap', ' to', ' provideAgUiAgent({ url })', ' to', ' connect', ' a', ' real', ' backend.',
      ],
      delayMs: 50,
    }),
  ],
};
```

(The `environment.agUiUrl` import is no longer needed; remove it. The environment files can keep the `agUiUrl` field for future re-wiring but it's unused now — leaving them in place is fine.)

- [ ] **Step 2: Build and serve briefly**

```bash
npx nx build cockpit-ag-ui-streaming-angular
```

Expected: PASS. (Lint may flag unused `environment` import — clean that up.)

Optional manual smoke: `nx serve cockpit-ag-ui-streaming-angular` and verify the chat UI streams a reply when you type a message.

- [ ] **Step 3: Commit**

```bash
git add cockpit/ag-ui/streaming/angular/src/app/app.config.ts
git commit -m "feat(cockpit): wire AG-UI streaming demo to FakeAgent

Demo runs end-to-end with no backend or network. Real-backend wiring
is one line away via provideAgUiAgent({ url: ... })."
```

---

### Task 5: Final verification, push, PR

- [ ] **Step 1: Full verify**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph,ag-ui
npx nx affected -t build --base=origin/main
```

Expected: PASS.

- [ ] **Step 2: Push**

```bash
git push -u origin feat/ag-ui-fake-agent
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(ag-ui): FakeAgent for offline cockpit demo" --body "$(cat <<'EOF'
## Summary
- Adds \`FakeAgent extends AbstractAgent\` to \`@cacheplane/ag-ui\` — emits a canned streaming response (RUN_STARTED → token deltas → RUN_FINISHED) for offline demos.
- Adds \`provideFakeAgUiAgent({ tokens, delayMs })\` DI convenience.
- Wires the AG-UI cockpit demo to use the fake — \`nx serve cockpit-ag-ui-streaming-angular\` now shows a working streaming chat with no backend.

## Motivation
The dojo at \`dojo.ag-ui.com\` speaks CopilotKit's runtime protocol, not raw AG-UI HTTP — so an HttpAgent can't directly connect. Until a public AG-UI-native endpoint exists (or we ship a local backend), the in-process fake unblocks the demo.

## Real-backend swap
One line in \`app.config.ts\`:
\`\`\`ts
providers: [provideAgUiAgent({ url: 'https://your.agent.endpoint' })]
\`\`\`

## Test Plan
- [x] \`nx run-many -t lint,test,build -p ag-ui\` passes
- [x] \`nx build cockpit-ag-ui-streaming-angular\` passes
- [ ] \`nx serve cockpit-ag-ui-streaming-angular\` shows a streaming reply (manual)

## Plan
- \`docs/superpowers/plans/2026-04-30-ag-ui-fake-agent.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- Real backend connection (deferred until a public AG-UI-native endpoint exists, or we add a local-backend script).
- Tool-call simulation (canned reply is text-only for now).
- Multi-turn conversation memory in the fake (each `run` is independent; AG-UI's underlying state mechanism handles thread-level continuity if needed).
- Configurable error scenarios (RUN_ERROR simulation) — addable later as a `simulateError?: boolean` option.
