# Backend-Failure Error UX Design

**Status:** Approved (brainstorm) — ready for implementation plan
**Date:** 2026-06-18
**Scope:** Error path across `@threadplane/chat` (neutral contract + chat error UI) and the `@threadplane/langgraph` + `@threadplane/ag-ui` adapters.

## Problem

A backend/stream failure is caught raw and passed through untouched to the user. The audit traced it:

- The cryptic **"HTTP 500:"** the user sees is the LangGraph SDK's own `Error.message`. `libs/langgraph/.../stream-manager.bridge.ts` does `subjects.error$.next(err)` with no inspection → `Agent.error` (typed `Signal<unknown>`) → `ChatErrorComponent` renders `error.message` / `String(error)` in a `role="alert"` banner.
- **No classification.** Connection-refused, 4xx (auth/bad-request), 5xx (server), stream-died-mid-response, and user-abort all collapse into one opaque string.
- **Abort is handled inconsistently.** AG-UI treats user-stop as graceful idle; LangGraph surfaces it as an *error*.
- **No retry affordance.** `reload()`/`regenerate()` exist as methods but there is no UI; users don't know they can retry.
- **No structured error contract** in the public API.

## Goals

1. A structured, public `AgentError` so consumers (and the chat UI) can reason about *why* a run failed.
2. Legible, cause-specific messages instead of raw SDK strings.
3. A consistent, batteries-included retry affordance for transient failures.
4. Consistent abort semantics across adapters (user-stop is never an error).

Non-goals (YAGNI): a new `events$` error variant; rate-limit/timeout/validation sub-classes beyond the agreed 5-class taxonomy.

## Architecture

The shared error **contract + classifier** live in `@threadplane/chat` (the neutral layer). Both adapters classify at the source (where the raw error + HTTP status are still available) and set the structured value onto the agent's `error` signal. The chat error component reads the structured value and renders legible copy + a conditional retry.

### Component 1 — `AgentError` (`libs/chat/src/lib/agent/agent-error.ts`, new)

```ts
export type AgentErrorKind =
  | 'connection'   // offline / DNS / connection refused / fetch failed
  | 'auth'         // 401 / 403
  | 'server'       // 5xx
  | 'interrupted'  // stream closed mid-response
  | 'aborted';     // user pressed stop (graceful; normally never surfaced)

export class AgentError extends Error {
  readonly kind: AgentErrorKind;
  /** connection | server | interrupted → true; auth | aborted → false */
  readonly retryable: boolean;
  /** HTTP status when known. */
  readonly status?: number;
  /** The original raw error, preserved for debugging/telemetry. */
  override readonly cause: unknown;

  constructor(init: {
    kind: AgentErrorKind;
    message: string;
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(init.message);
    this.name = 'AgentError';
    this.kind = init.kind;
    this.retryable = init.retryable;
    this.status = init.status;
    this.cause = init.cause;
  }
}
```

`extends Error` keeps existing `.message` / `instanceof Error` reads working (chat-error's `extractErrorMessage`, telemetry's error-name extraction).

Default per-kind messages (a `const` map in the same file):
- `connection`: "Can't reach the server. Check your connection and try again."
- `auth`: "Authentication failed. Check your API key or credentials."
- `server`: "The server ran into an error. You can try again."
- `interrupted`: "The response was interrupted. Try again."
- `aborted`: "Stopped." (used only if an aborted error is ever surfaced; normally abort settles to idle)

### Component 2 — `toAgentError(raw, ctx?)` (`libs/chat/src/lib/agent/to-agent-error.ts`, new)

The single classifier. Pure, idempotent, no Angular deps.

```ts
export function toAgentError(raw: unknown): AgentError;
```

Classification order:
1. **Already `AgentError`** → return as-is (idempotent).
2. **Abort** — `raw` is an `Error` whose `name === 'AbortError'` or `/abort/i.test(message)` → `kind: 'aborted'`, `retryable: false`.
3. **HTTP status** — extract from `raw.status` / `raw.cause?.status` if present, else parse a leading `HTTP <nnn>` or a bare 3-digit code from `message`:
   - `401 | 403` → `auth` (retryable false).
   - `>= 500` → `server` (retryable true), `status` set.
   - other 4xx (400/404/429/…) → `server` (retryable **false**), `status` set, message `"The request was rejected (HTTP <status>)."`. Within the 5-class taxonomy `server` is the closest bucket for a non-auth HTTP error; `retryable: false` is what actually drives the UI (no Retry button, since retrying won't help a client-side request error).
4. **Connection** — fetch/network markers (`TypeError: Failed to fetch`, `ECONNREFUSED`, `ENOTFOUND`, `NetworkError`, no `status`) → `kind: 'connection'`, `retryable: true`.
5. **Interrupted** — stream-specific markers (premature close / `ERR_STREAM` / aborted-by-server mid-stream where a run had already started) → `kind: 'interrupted'`, `retryable: true`.
6. **Fallback** — unknown shape → `kind: 'server'`, `retryable: true`, message = the cleaned original message or "Something went wrong. You can try again." `cause` always set to `raw`.

### Component 3 — adapter normalization

**LangGraph** (`libs/langgraph/src/lib/internals/stream-manager.bridge.ts`):
- In the `runStream()` catch: if the error is an abort (matches the same abort predicate) AND an abort was requested, settle to **idle** (`status$.next(Idle)`), do **not** set `error$`. Otherwise `error$.next(toAgentError(err))`.
- This fixes the inconsistency where LangGraph currently shows user-stop as an error. Factor the abort predicate so both adapters share it (export a small `isAbortError(raw)` from the chat layer, reused by `toAgentError` and the bridge).

**AG-UI** (`libs/ag-ui/src/lib/to-agent.ts`):
- `onRunFailed`/`RUN_ERROR`: keep the existing abort→idle path; for real failures `store.error.set(toAgentError(error))`.

### Component 4 — contract changes (`libs/chat/src/lib/agent/agent.ts` + both adapters)

```ts
export interface Agent<TState = Record<string, unknown>> {
  // ...
  error: Signal<AgentError | undefined>;   // was Signal<unknown>
  // ...
  /** Re-run the last submitted input after a failure. No-op if there is
   *  nothing to retry. Clears `error` and sets loading. */
  retry: () => Promise<void>;
}
```

- LangGraph `retry()` → delegates to the existing `resubmitLast()` (what `reload()` already calls), after clearing `error$`.
- AG-UI `retry()` → re-run the last input it sent (the adapter already tracks the last `RunAgentInput`); clear `error`.
- `AgentError` is re-exported from `@threadplane/chat` public-api; `toAgentError` and `AgentErrorKind` too (consumers writing custom backends/error UIs).

### Component 5 — `ChatErrorComponent` (`libs/chat/src/lib/primitives/chat-error/chat-error.component.ts`)

- Reads `agent().error()` (now `AgentError | undefined`).
- Renders the structured `message` in the existing `role="alert"` banner (no raw SDK strings).
- Shows a **Retry** button only when `error()?.retryable`, calling `agent().retry()`. The button is hidden for `auth` (and any non-retryable) errors, where retrying won't help.
- Keep `extractErrorMessage` exported and working (it already handles `Error` → `.message`), so a plain `Error` still renders.

## Data flow (after)

```
backend failure
  → adapter catch (status/cause available)
      → isAbortError? → settle idle (no error)         [both adapters now]
      → else error signal := toAgentError(raw)         [AgentError]
  → Agent.error: Signal<AgentError | undefined>
  → ChatErrorComponent: legible message + Retry (if retryable) → agent.retry()
```

## Error handling & edge cases

- **Retry while loading:** `retry()` is a no-op if a run is already in flight (guard on status), mirroring `regenerate()`'s loading guard.
- **Nothing to retry:** if no prior input was sent, `retry()` resolves without action.
- **Idempotent classifier:** `toAgentError(toAgentError(x))` === first result (kind preserved).
- **Abort mid-stream vs server-interrupt:** only a *user-requested* abort settles to idle; a server/transport close that the user did not request is `interrupted` (retryable).
- **Custom backends:** can throw/set a plain `Error`; `toAgentError` upgrades it (fallback kind `server`, retryable). They may also construct an `AgentError` directly for precise control.

## Testing strategy

- **Unit (`to-agent-error.spec.ts`):** one case per kind from a representative raw error (`HTTP 500: ...` → server+status 500; `{name:'AbortError'}` → aborted; `TypeError: Failed to fetch` → connection; a 401 → auth non-retryable; a mid-stream close → interrupted; unknown → server fallback), plus idempotency and `cause` preservation.
- **Adapter unit tests:** LangGraph bridge routes abort→idle and real error→`AgentError`; AG-UI `onRunFailed`→`AgentError`; `retry()` resubmits last input and clears error (both adapters).
- **Type-spec (strict):** `Agent.error` is `Signal<AgentError | undefined>`; `AgentError extends Error`; `retry` present.
- **e2e (`examples/chat/angular/e2e/error-handling.spec.ts`, upgraded):** assert the banner shows a *legible* message (not a raw SDK string), a **Retry** button appears for the (retryable) stream failure, clicking it recovers — replacing the current generic `/fail|error/i` assertion.
- Existing chat/langgraph/ag-ui unit suites stay green; build one example to confirm source compiles.

## Files touched

- `libs/chat/src/lib/agent/agent-error.ts` *(new)* — `AgentError`, `AgentErrorKind`, default-message map.
- `libs/chat/src/lib/agent/to-agent-error.ts` *(new)* — `toAgentError`, `isAbortError`.
- `libs/chat/src/lib/agent/agent.ts` — `error: Signal<AgentError | undefined>`, `retry()`.
- `libs/chat/src/lib/agent/index.ts` + `libs/chat/src/public-api.ts` — export `AgentError`, `AgentErrorKind`, `toAgentError`.
- `libs/chat/src/lib/primitives/chat-error/chat-error.component.ts` — structured message + conditional Retry.
- `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` + `agent.fn.ts` — normalize + abort→idle + `retry()`.
- `libs/ag-ui/src/lib/to-agent.ts` — normalize + `retry()`.
- `*.spec.ts` for the above + the upgraded `examples/chat` e2e.

## Risks

- **Re-typing `Agent.error`** touches the shared contract, but `AgentError extends Error` keeps `.message`/`instanceof` consumers working; the audit found only `ChatErrorComponent` reads it meaningfully, so the ripple is small. Both adapters must set an `AgentError` (or undefined) — enforced by the contract type.
- **`retry()` added to the contract** — every adapter must implement it; the two first-party adapters do. Custom-backend authors get a compile error until they add it (acceptable, pre-1.0, and the method is small).
