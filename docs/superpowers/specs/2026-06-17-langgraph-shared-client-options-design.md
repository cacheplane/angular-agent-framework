# Shared LangGraph client options (single-source retry budget) — Design

**Status:** Approved (brainstorm 2026-06-17)

**Goal:** Provide one app-wide place to configure the LangGraph SDK client's
retry/tuning options (`LangGraphClientOptions`) so that **both** the streaming
agent transport and the threads adapter obey it — set once, not per subsystem.

## Background

PR #677 added `clientOptions.maxRetries` to the agent path
(`provideAgent` → `agent()` → `FetchStreamTransport` → `createLangGraphClient`
→ SDK `callerOptions`) to let a failed stream connect fail fast under test
while keeping the SDK's resilient default in production.

The threads adapter (`LangGraphThreadsAdapter`) constructs its own client via
`createLangGraphClient(this.config.apiUrl)` **without** options, so thread CRUD
(create / getHistory / getState / updateState) still retries ~15s on a hard
failure. An existing escape hatch — the `LANGGRAPH_CLIENT` injection token —
already lets a consumer inject a fully-built client, but that requires building
the client by hand and is per-subsystem.

This design adds a single shared knob both subsystems read.

## Non-goals (YAGNI)

- No refactor of `apiUrl` wiring (`provideAgent` and `LANGGRAPH_THREADS_CONFIG`
  keep taking `apiUrl` independently).
- No change to the SDK default retry behavior in production.
- No new thread-CRUD-abort e2e (would require aborting `/threads`; tracked as an
  optional follow-up).
- `LANGGRAPH_CLIENT` (inject a pre-built client) stays as-is.

## Architecture

### New DI token (libs/langgraph)

```ts
// LangGraphClientOptions already exists (agent.types.ts, exported).
export const LANGGRAPH_CLIENT_OPTIONS =
  new InjectionToken<LangGraphClientOptions>('LANGGRAPH_CLIENT_OPTIONS');
```

Exported from `libs/langgraph/src/public-api.ts`. Provided once at app root.

### Precedence helper (pure, testable)

A small pure function resolves the effective options without reaching into SDK
internals:

```ts
// libs/langgraph/src/lib/client/resolve-client-options.ts
export function resolveClientOptions(
  ...layers: Array<LangGraphClientOptions | undefined | null>
): LangGraphClientOptions | undefined {
  for (const layer of layers) if (layer) return layer;
  return undefined;
}
```

It returns the first defined layer (highest precedence first). Whole-object
precedence (not per-field merge) keeps semantics obvious; `maxRetries` is the
only field today.

### Read sites

**Agent** (`agent.fn.ts`) — already in an injection context (it calls
`inject(DestroyRef)` / `inject(AGENT_CONFIG, { optional: true })`). Add:

```ts
const sharedClientOptions = inject(LANGGRAPH_CLIENT_OPTIONS, { optional: true });
const clientOptions = resolveClientOptions(
  options.clientOptions,            // 1. agent({ clientOptions }) call-site
  globalConfig?.clientOptions,      // 2. provideAgent({ clientOptions }) (AGENT_CONFIG)
  sharedClientOptions,              // 3. LANGGRAPH_CLIENT_OPTIONS token
);
```

`clientOptions` is then passed into the bridge options (already threaded to
`FetchStreamTransport` in #677). The bridge/transport wiring is unchanged.

**Threads adapter** (`threads-adapter.ts`) — `@Injectable({ providedIn: 'root' })`,
so it can inject the token. On the path where `LANGGRAPH_CLIENT` is **not**
provided:

```ts
private readonly sharedClientOptions =
  inject(LANGGRAPH_CLIENT_OPTIONS, { optional: true }) ?? undefined;
private readonly client: Client =
  inject(LANGGRAPH_CLIENT, { optional: true })
  ?? createLangGraphClient(this.config.apiUrl, this.sharedClientOptions ?? undefined);
```

The threads adapter has no per-call layer, so its precedence is: shared token →
SDK default (or a fully injected `LANGGRAPH_CLIENT` bypasses both).

### Data flow

```
consumer provides LANGGRAPH_CLIENT_OPTIONS at root
  ├─ agent()  →  resolveClientOptions(call, providerCfg, token)  →  bridge → FetchStreamTransport → createLangGraphClient(apiUrl, opts) → SDK callerOptions
  └─ LangGraphThreadsAdapter  →  createLangGraphClient(apiUrl, token)  →  SDK callerOptions
```

## Example app migration (examples/chat)

- `app.config.ts`: add
  `{ provide: LANGGRAPH_CLIENT_OPTIONS, useFactory: () => e2eClientOptions() }`.
  The factory runs at injection time (post-bootstrap) so the
  `THREADPLANE_E2E_MAX_RETRIES` localStorage flag is readable; returning
  `undefined` is fine (read sites treat absent/undefined as "SDK default").
- `DemoShell`: revert `provideAgent` to the **static** object form and drop the
  per-agent `clientOptions: e2eClientOptions()`. The shared token supplies it
  now. This unwinds the factory-form timing workaround added in #677 (net
  simplification).
- `error-handling.spec.ts`, `e2e-overrides.ts` (+ its spec): unchanged. The flag
  now flows through the root token to both the agent and the threads adapter.

## Error handling

No new failure modes. The token is optional everywhere; absence preserves the
SDK default. Providing `undefined` (factory returns `undefined`) behaves
identically to not providing the token.

## Testing

- **Unit (lib):** `resolveClientOptions()` precedence — table-driven (call-site
  wins over provider over token over none).
- **Unit (lib):** `LangGraphThreadsAdapter` threads the injected token into the
  constructed client — `vi.mock` (or spy) `createLangGraphClient` and assert it
  is called with `(apiUrl, { maxRetries: N })` when `LANGGRAPH_CLIENT_OPTIONS` is
  provided, and with `(apiUrl, undefined)` when it is not. Also assert the
  `LANGGRAPH_CLIENT` bypass still wins (createLangGraphClient not called).
- **Unit (example):** existing `e2eClientOptions` spec stays. New specs added
  under `src/` MUST `import { describe, it, expect, ... } from 'vitest'`
  (tsconfig.app.json type-checks specs with `types: []`).
- **e2e:** existing `error-handling.spec.ts` stays green (agent path). No new
  thread-CRUD-abort e2e (out of scope).

## Gates (lesson applied)

- `nx run-many -t lint test --projects=langgraph`
- **`nx build examples-chat-angular`** AND `nx test examples-chat-angular`
  (the app build type-checks specs — `nx test` alone does not catch a spec that
  breaks the app build, which regressed main at #677).
- `npm run generate-api-docs` (the new `LANGGRAPH_CLIENT_OPTIONS` token is public
  API).
- Build one example before claiming green.

## Public API delta

- New export: `LANGGRAPH_CLIENT_OPTIONS` (InjectionToken).
- Possibly `resolveClientOptions` stays internal (not exported) unless a
  consumer needs it — default keep internal.
- `LangGraphClientOptions`, `provideAgent({ clientOptions })` unchanged (#677).
