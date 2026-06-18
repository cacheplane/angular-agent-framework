# Backend-Failure Error UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the opaque "HTTP 500:" surfacing with a structured `AgentError` (classified, retryable), normalized in both adapters, surfaced by the chat error UI as legible copy + a conditional Retry; fix the LangGraph user-abort-as-error inconsistency.

**Architecture:** Contract + classifier live in `@threadplane/chat`; `@threadplane/langgraph` and `@threadplane/ag-ui` classify at the source and set `Agent.error: Signal<AgentError | undefined>`; `ChatErrorComponent` reads it and wires Retry to a new neutral `Agent.retry()`.

**Tech Stack:** Angular 21 (signals), vitest, Nx. No backwards-compatibility constraint (pre-1.0).

**Reference spec:** `docs/superpowers/specs/2026-06-18-backend-error-ux-design.md`.

---

## Task 1: `AgentError` + `toAgentError` classifier (pure, TDD)

**Files:**
- Create: `libs/chat/src/lib/agent/agent-error.ts`
- Create: `libs/chat/src/lib/agent/to-agent-error.ts`
- Create: `libs/chat/src/lib/agent/to-agent-error.spec.ts`

- [ ] **Step 1: Write the failing test** — `to-agent-error.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { AgentError } from './agent-error';
import { toAgentError, isAbortError } from './to-agent-error';

describe('toAgentError', () => {
  it('classifies HTTP 500 message as server + retryable + status', () => {
    const e = toAgentError(new Error('HTTP 500: Internal Server Error'));
    expect(e).toBeInstanceOf(AgentError);
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(true); expect(e.status).toBe(500);
  });
  it('classifies 401 as auth + not retryable', () => {
    const e = toAgentError(new Error('HTTP 401: Unauthorized'));
    expect(e.kind).toBe('auth'); expect(e.retryable).toBe(false); expect(e.status).toBe(401);
  });
  it('classifies non-auth 4xx as server + not retryable', () => {
    const e = toAgentError(new Error('HTTP 404: Not Found'));
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(false); expect(e.status).toBe(404);
  });
  it('classifies fetch failure as connection + retryable', () => {
    const e = toAgentError(new TypeError('Failed to fetch'));
    expect(e.kind).toBe('connection'); expect(e.retryable).toBe(true);
  });
  it('classifies AbortError as aborted + not retryable', () => {
    const ab = new Error('The operation was aborted'); ab.name = 'AbortError';
    const e = toAgentError(ab);
    expect(e.kind).toBe('aborted'); expect(e.retryable).toBe(false);
    expect(isAbortError(ab)).toBe(true);
  });
  it('preserves cause and is idempotent', () => {
    const raw = new Error('HTTP 500: boom');
    const once = toAgentError(raw);
    expect(once.cause).toBe(raw);
    expect(toAgentError(once)).toBe(once);
  });
  it('falls back to server + retryable for unknown shapes', () => {
    const e = toAgentError({ weird: true });
    expect(e.kind).toBe('server'); expect(e.retryable).toBe(true);
  });
  it('reads a structured status off the error/cause', () => {
    const e = toAgentError({ status: 503, message: 'Service Unavailable' });
    expect(e.kind).toBe('server'); expect(e.status).toBe(503); expect(e.retryable).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `npx nx test chat --skip-nx-cache -- to-agent-error` (modules don't exist).

- [ ] **Step 3: Create `agent-error.ts`:**
```ts
// SPDX-License-Identifier: MIT
export type AgentErrorKind = 'connection' | 'auth' | 'server' | 'interrupted' | 'aborted';

/** Structured, classified failure surfaced on `Agent.error`. Extends `Error`
 *  so existing `.message` / `instanceof Error` reads keep working. */
export class AgentError extends Error {
  readonly kind: AgentErrorKind;
  /** connection | server | interrupted → true; auth | aborted → false (+ non-auth 4xx → false). */
  readonly retryable: boolean;
  readonly status?: number;
  override readonly cause: unknown;

  constructor(init: { kind: AgentErrorKind; message: string; retryable: boolean; status?: number; cause?: unknown }) {
    super(init.message);
    this.name = 'AgentError';
    this.kind = init.kind;
    this.retryable = init.retryable;
    this.status = init.status;
    this.cause = init.cause;
  }
}

/** Default human-facing copy per kind. */
export const AGENT_ERROR_MESSAGES: Record<AgentErrorKind, string> = {
  connection: "Can't reach the server. Check your connection and try again.",
  auth: 'Authentication failed. Check your API key or credentials.',
  server: 'The server ran into an error. You can try again.',
  interrupted: 'The response was interrupted. Try again.',
  aborted: 'Stopped.',
};
```

- [ ] **Step 4: Create `to-agent-error.ts`:**
```ts
// SPDX-License-Identifier: MIT
import { AgentError, AGENT_ERROR_MESSAGES, type AgentErrorKind } from './agent-error';

/** True when `raw` represents a user-requested abort (DOMException/Error named
 *  AbortError, or an abort-ish message). Shared by the adapters + the classifier. */
export function isAbortError(raw: unknown): boolean {
  return raw instanceof Error && (raw.name === 'AbortError' || /\babort/i.test(raw.message));
}

function readStatus(raw: unknown): number | undefined {
  const obj = raw as { status?: unknown; cause?: { status?: unknown } } | null;
  const direct = typeof obj?.status === 'number' ? obj.status : undefined;
  const viaCause = typeof obj?.cause?.status === 'number' ? obj!.cause!.status : undefined;
  if (direct ?? viaCause) return (direct ?? viaCause) as number;
  const msg = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  const m = /\b(\d{3})\b/.exec(msg);
  return m ? Number(m[1]) : undefined;
}

function isConnectionError(raw: unknown): boolean {
  if (!(raw instanceof Error)) return false;
  return /failed to fetch|networkerror|econnrefused|enotfound|network request failed|load failed/i.test(
    `${raw.name} ${raw.message}`,
  );
}

function make(kind: AgentErrorKind, retryable: boolean, raw: unknown, status?: number, message?: string): AgentError {
  return new AgentError({ kind, retryable, status, cause: raw, message: message ?? AGENT_ERROR_MESSAGES[kind] });
}

/** Classify any raw error into a structured {@link AgentError}. Idempotent. */
export function toAgentError(raw: unknown): AgentError {
  if (raw instanceof AgentError) return raw;
  if (isAbortError(raw)) return make('aborted', false, raw);

  const status = readStatus(raw);
  if (status !== undefined) {
    if (status === 401 || status === 403) return make('auth', false, raw, status);
    if (status >= 500) return make('server', true, raw, status);
    if (status >= 400) return make('server', false, raw, status, `The request was rejected (HTTP ${status}).`);
  }
  if (isConnectionError(raw)) return make('connection', true, raw);

  // Fallback: unknown server-side failure, allow retry.
  const msg = raw instanceof Error && raw.message ? raw.message : 'Something went wrong. You can try again.';
  return make('server', true, raw, status, msg);
}
```
> Note on `interrupted`: a stream that closes mid-response is classified by the **adapter** (which knows a run had started) — it constructs `new AgentError({ kind: 'interrupted', retryable: true, ... })` directly. `toAgentError` covers the generic raw-error cases; the adapter handles the stream-lifecycle-specific `interrupted` case in Task 3/4.

- [ ] **Step 5: Run — expect PASS.** `npx nx test chat --skip-nx-cache -- to-agent-error`.

- [ ] **Step 6: Commit.**
```bash
git add libs/chat/src/lib/agent/agent-error.ts libs/chat/src/lib/agent/to-agent-error.ts libs/chat/src/lib/agent/to-agent-error.spec.ts
git commit -m "feat(chat): AgentError + toAgentError 5-class classifier (connection/auth/server/interrupted/aborted)"
```

---

## Task 2: Contract — `error: Signal<AgentError>` + `retry()` + exports

**Files:**
- Modify: `libs/chat/src/lib/agent/agent.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Create: `libs/chat/src/lib/agent/agent-error.type-spec.ts`

- [ ] **Step 1: Re-type the contract.** In `agent.ts`, import `AgentError`, change `error: Signal<unknown>` → `error: Signal<AgentError | undefined>`, and add to the Actions section:
```ts
  /** Re-run the last submitted input after a failure. No-op if a run is already
   *  in flight or there is nothing to retry. Clears `error` and sets loading. */
  retry: () => Promise<void>;
```

- [ ] **Step 2: Export from barrel + public-api.** In `libs/chat/src/lib/agent/index.ts` add:
```ts
export { AgentError, AGENT_ERROR_MESSAGES } from './agent-error';
export type { AgentErrorKind } from './agent-error';
export { toAgentError, isAbortError } from './to-agent-error';
```
In `libs/chat/src/public-api.ts`, ensure these flow out (add a value export line `export { AgentError, AGENT_ERROR_MESSAGES, toAgentError, isAbortError } from './lib/agent';` and `export type { AgentErrorKind } from './lib/agent';`).

- [ ] **Step 3: Type-spec** — `agent-error.type-spec.ts` (uses the existing chat type-test harness `../../testing/type-assert`):
```ts
// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Equal, Expect } from '../../testing/type-assert';
import type { Agent } from './agent';
import { AgentError } from './agent-error';

type _errTyped = Expect<Equal<Agent['error'], Signal<AgentError | undefined>>>;
type _retry = Expect<Equal<Agent['retry'], () => Promise<void>>>;
const _isErr: Error = new AgentError({ kind: 'server', message: 'x', retryable: true });
```

- [ ] **Step 4: Build chat + run type-tests — expect adapter type errors are deferred.** Run `npx nx type-tests chat --skip-nx-cache`. The chat lib itself should compile (the contract change is type-only); `npx nx build chat` may fail only if a chat-internal implementation sets `error` to a non-AgentError — fix those sites to use `toAgentError(...)` or `undefined`. The adapters (separate projects) are updated in Tasks 3-4.

- [ ] **Step 5: Commit.**
```bash
git add libs/chat/src/lib/agent/agent.ts libs/chat/src/lib/agent/index.ts libs/chat/src/public-api.ts libs/chat/src/lib/agent/agent-error.type-spec.ts
git commit -m "feat(chat): re-type Agent.error as Signal<AgentError|undefined> + add neutral retry()"
```

---

## Task 3: LangGraph adapter — normalize + abort→idle + `retry()`

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.ts`

- [ ] **Step 1: Normalize + abort→idle in the bridge.** In `stream-manager.bridge.ts` `runStream()` catch (~line 435), replace `subjects.error$.next(err)` with:
```ts
import { toAgentError, isAbortError, AgentError } from '@threadplane/chat';
// ...
} catch (err) {
  if (isAbortError(err) && /* an abort was requested */ abortRequested) {
    subjects.status$.next(ResourceStatus.Idle);   // user stop → graceful, not an error
  } else {
    // A stream that dies after a run started (not a fresh connect failure) → interrupted.
    const e = (startedStreaming && isAbortError(err))
      ? new AgentError({ kind: 'interrupted', message: 'The response was interrupted. Try again.', retryable: true, cause: err })
      : toAgentError(err);
    subjects.error$.next(e);
    subjects.status$.next(ResourceStatus.Error);
  }
}
```
Use the bridge's existing abort-tracking flag (find the field that records a user-requested stop; if none exists, thread one from `stop()`). `startedStreaming` = whether any value/message arrived this run (the bridge already tracks first-value; reuse it). Keep the existing telemetry call.

- [ ] **Step 2: `retry()` in the agent surface.** In `agent.fn.ts`, the returned object currently has `reload: () => manager.resubmitLast()`. Add:
```ts
    retry: async () => {
      if (statusSig() === 'running' /* or the loading signal */) return;
      error$.next(undefined);
      await manager.resubmitLast();
    },
```
Place it alongside `reload`. Ensure `error$` is reachable here (it is — it's the BehaviorSubject feeding `errorSig`). Use the correct loading/status guard already in scope.

- [ ] **Step 3: Tests.** Add/extend a bridge or agent spec asserting: (a) a user-abort settles status to idle and leaves `error` undefined; (b) a thrown `HTTP 500` sets `error` to an `AgentError` with kind `server`; (c) `retry()` clears error and calls `resubmitLast` (spy). Follow the existing langgraph spec patterns (e.g. `agent.fn.spec.ts`).

- [ ] **Step 4: Verify.** `npx nx run-many -t test lint build --projects=langgraph --skip-nx-cache` — green.

- [ ] **Step 5: Commit.**
```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts libs/langgraph/src/lib/agent.fn.ts libs/langgraph/src/lib/*.spec.ts
git commit -m "feat(langgraph): classify errors via toAgentError, abort→idle, neutral retry()"
```

---

## Task 4: AG-UI adapter — normalize + `retry()`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`

- [ ] **Step 1: Normalize in `onRunFailed`.** Replace `store.error.set(error)` with `store.error.set(toAgentError(error))` (import `toAgentError` from `@threadplane/chat`). Keep the existing `settleIfAborted` path (abort → idle, no error) — that already matches the desired behavior.

- [ ] **Step 2: Track last input + `retry()`.** In `submit()` (~line 262), record the input that starts a run (e.g. `let lastInput: AgentSubmitInput | undefined`). Add a `retry` method to the returned `AgUiAgent`:
```ts
    retry: async () => {
      if (store.isLoading()) return;
      if (lastInput === undefined) return;
      store.error.set(undefined);
      await /* the same path submit() uses to (re)run */ runLast(lastInput);
    },
```
Re-run via the same `source.runAgent(...)` path `submit()` uses (factor a small helper if needed). Do not append a duplicate user message on retry — re-run the existing input/messages.

- [ ] **Step 3: Tests.** Extend `to-agent.spec.ts`: a `RUN_ERROR`/`onRunFailed` sets `error` to an `AgentError` (kind from message); abort still settles idle with `error` undefined; `retry()` clears error and re-runs the last input.

- [ ] **Step 4: Verify.** `npx nx run-many -t test lint build --projects=ag-ui --skip-nx-cache` — green; also `npx nx build chat` cross-check.

- [ ] **Step 5: Commit.**
```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/*.spec.ts
git commit -m "feat(ag-ui): classify errors via toAgentError + neutral retry()"
```

---

## Task 5: `ChatErrorComponent` — legible message + conditional Retry

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`
- Modify: `libs/chat/src/lib/primitives/chat-error/chat-error.component.spec.ts`
- Modify: `libs/chat/src/lib/styles/chat-error.styles.ts` (Retry button styling)

- [ ] **Step 1: Update the component.** Read `agent().error()` (now `AgentError | undefined`). Keep `extractErrorMessage` (it handles `Error.message`). Add a computed `retryable = computed(() => this.agent().error()?.retryable ?? false)` and render a Retry button when true:
```ts
template: `
  @if (agent().error(); as err) {
    <div class="chat-error" role="alert">
      <svg class="chat-error__icon" ...></svg>
      <span class="chat-error__msg">{{ err.message }}</span>
      @if (err.retryable) {
        <button type="button" class="chat-error__retry" (click)="agent().retry()">Retry</button>
      }
    </div>
  }
`,
```
Add a `.chat-error__retry` style to `chat-error.styles.ts` consistent with the existing button styling in the lib.

- [ ] **Step 2: Update the spec.** Extend `chat-error.component.spec.ts`: renders `err.message` for an `AgentError`; shows a Retry button when `retryable` true and hides it when false; clicking Retry calls `agent.retry()`. Use a mock agent whose `error` signal returns an `AgentError` (use `mockAgent` from `@threadplane/chat` testing if it supports setting error, else a minimal stub).

- [ ] **Step 3: Verify.** `npx nx run-many -t test lint build --projects=chat --skip-nx-cache` — green.

- [ ] **Step 4: Commit.**
```bash
git add libs/chat/src/lib/primitives/chat-error
git commit -m "feat(chat): ChatErrorComponent renders legible AgentError message + conditional Retry"
```

---

## Task 6: e2e — upgrade `examples/chat` error-handling

**Files:**
- Modify: `examples/chat/angular/e2e/error-handling.spec.ts`

- [ ] **Step 1: Strengthen assertions.** Keep the route-abort setup (fail-fast retries already opt-in via localStorage). After the failure, assert the banner shows a *legible* message (e.g. matches `/can't reach|server|connection|interrupted|try again/i`, NOT a bare `HTTP \d{3}` SDK string) and that a **Retry** button with accessible name `/retry/i` is visible. Then click Retry (after `page.unroute`) and assert recovery (assistant bubble appears) — in addition to / instead of the existing "next send recovers" path.

- [ ] **Step 2: Run.** Free ports first (`4200/4201/2024`); `npx nx e2e examples-chat-angular --skip-nx-cache -- --grep "error handling"`. Expect PASS. (Re-run once in isolation if a streaming flake appears — known-flaky suite.)

- [ ] **Step 3: Commit.**
```bash
git add examples/chat/angular/e2e/error-handling.spec.ts
git commit -m "test(examples/chat): assert legible error message + Retry button + retry recovery"
```

---

## Task 7: Full verification + PR

- [ ] **Step 1: Full gate.** `npx nx run-many -t test lint build type-tests --projects=chat,langgraph,ag-ui --skip-nx-cache` — all green. Build one example: `npx nx build examples-chat-angular`.
- [ ] **Step 2: Final whole-implementation code review** (most-capable reviewer): classifier correctness (each kind, idempotency, status parsing edge cases), abort-vs-interrupted distinction soundness in both adapters, `retry()` no-ops, no internal-type leak, `AgentError extends Error` keeps `.message` consumers working.
- [ ] **Step 3: Open PR** against main, enable auto-merge (`gh pr merge --squash --auto`). If `BEHIND` (post-#684 branch protection requires up-to-date), update from main and re-verify. Regenerate `api-docs` (`npm run generate-api-docs`) and commit if the chat/langgraph/ag-ui api-docs change (new `AgentError`/`retry` exports), to preempt the api-docs bot.
- [ ] **Step 4: Finish** via `superpowers:finishing-a-development-branch`.

---

## Self-Review (against the spec)

- **Coverage:** AgentError + classifier (Task 1) ✓; contract re-type + retry + exports (Task 2) ✓; langgraph normalize/abort→idle/retry (Task 3) ✓; ag-ui normalize/retry (Task 4) ✓; ChatErrorComponent message + Retry (Task 5) ✓; e2e (Task 6) ✓; verify+PR (Task 7) ✓.
- **Type consistency:** `AgentError`, `AgentErrorKind`, `toAgentError`, `isAbortError`, `AGENT_ERROR_MESSAGES`, `Agent.error: Signal<AgentError|undefined>`, `Agent.retry()` used consistently across tasks.
- **No placeholders:** classifier + AgentError have full code; adapter steps reference real files/line-areas (bridge catch ~435, agent.fn reload ~529, ag-ui submit ~262) and name the exact edits. The `interrupted` adapter-vs-classifier split is called out explicitly.
