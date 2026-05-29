# Adapter Testing-Surface Alignment

**Status:** Design — ready for plan
**Date:** 2026-05-28
**Owner:** Brian Love

## Background

The agent→langgraph rename (PR #556) gave `@threadplane/langgraph` and `@threadplane/ag-ui` a symmetric *wiring* surface (`provideAgent` / `injectAgent` / `AgentConfig`). Their **testing** surfaces were intentionally left asymmetric and are this phase's subject.

There are three layers of test doubles in the framework, each for a different test scope:

| Layer | Test double | What's real | What's faked | Scope |
|---|---|---|---|---|
| **1. Contract** | `mockAgent` (chat) / `mockLangGraphAgent` (langgraph) | nothing | the whole `Agent` (writable signals) | component/unit — set `messages()`, assert render |
| **2. Wire/transport** | `provideFakeAgent` / `FakeAgent` (ag-ui), `MockAgentTransport` (langgraph) | the real adapter pipeline (reducers, signal wiring) | the backend (canned wire events) | adapter-integration, in-browser, no server |
| **3. LLM provider** | aimock (`libs/e2e-harness`, `@copilotkit/aimock` `LLMock`) | Angular app + real `langgraph dev` + real Python graph + real adapter | only the nondeterministic LLM (OpenAI fixtures) | full Playwright e2e |

**aimock (layer 3) is out of scope and needs no alignment.** It's graph/backend-side and adapter-agnostic — it replays OpenAI calls for whatever Python graph runs, indifferent to which frontend adapter is used. Its fixture format (OpenAI chat-completions matching) must NOT be unified with layer-2 token configs (LangGraph/AG-UI wire events) — different protocols, different process boundaries.

This phase aligns **layers 1 and 2** across the two adapters.

## Current state and gaps

| | Layer 2 — fake-backend | Layer 1 — writable-signal mock |
|---|---|---|
| **chat** (neutral) | — | `mockAgent()` / `MockAgent` / `MockAgentOptions` — exists, in `@threadplane/chat` **main** public-api |
| **langgraph** | `MockAgentTransport` (low-level `StreamEvent[][]` script; no one-call helper) | `mockLangGraphAgent()` / `MockLangGraphAgent` — **independent reimplementation**, does not use `mockAgent` |
| **ag-ui** | `provideFakeAgent({tokens, reasoningTokens, delayMs})` + `FakeAgent` + **local** `FakeAgentConfig` | — (consumers can use chat's `mockAgent`) |

Three gaps:

1. langgraph has no one-call fake-backend provider (consumers hand-assemble `provideAgent({ transport: new MockAgentTransport(script) })`).
2. `FakeAgentConfig` is ag-ui-local, not shared, so the two adapters' fake-backend configs aren't a single type.
3. `mockLangGraphAgent` duplicates the ~40-signal neutral bag instead of extending `mockAgent`.

## Goals

1. Both adapters expose a one-call `provideFakeAgent(config: FakeAgentConfig)` with the **same** `{tokens, reasoningTokens, delayMs}` config.
2. `FakeAgentConfig` is a single canonical type owned by `@threadplane/chat/testing`.
3. `mockLangGraphAgent` is built on the neutral `mockAgent`, eliminating the duplicated signal bag.
4. A "which test double for which scope" selection table is documented so users pick the right layer.

## Non-goals

- Any change to aimock (layer 3) or its fixtures.
- A separate `mockAgUiAgent` — ag-ui's `Agent` *is* the neutral contract, so ag-ui consumers use `mockAgent` directly.
- Backwards compatibility / deprecation shims. Breaking changes are accepted; **no re-exports** for moved symbols.
- Unifying `provideFakeAgent` token config with aimock fixture format.

## Design

### 2a. Shared `FakeAgentConfig` in `@threadplane/chat/testing`

```ts
// libs/chat/testing/fake-agent-config.ts  (exported from chat/testing/public-api.ts)
export interface FakeAgentConfig {
  /** Assistant reply, streamed token-by-token. */
  tokens?: string[];
  /** Optional reasoning chunks emitted before the text reply. */
  reasoningTokens?: string[];
  /** Milliseconds between successive token emissions. */
  delayMs?: number;
}
```

ag-ui's local `FakeAgentConfig` (in `libs/ag-ui/src/lib/testing/provide-fake-agent.ts`) is **deleted**. ag-ui imports `FakeAgentConfig` from `@threadplane/chat/testing` and does **not** re-export it. Consumers that referenced `FakeAgentConfig` from `@threadplane/ag-ui` now import it from `@threadplane/chat/testing` (breaking — accepted).

### 2b. langgraph `provideFakeAgent(config: FakeAgentConfig)` (new)

A one-call helper mirroring ag-ui's. It synthesizes a `StreamEvent[][]` script that streams `reasoningTokens` (if any) then `tokens` as a single assistant message with `delayMs` spacing, and returns:

```ts
provideAgent({ assistantId: 'fake', transport: new MockAgentTransport(synthesizedScript) })
```

- Imports `FakeAgentConfig` from `@threadplane/chat/testing` (no re-export).
- Exported from `libs/langgraph/src/public-api.ts`.
- The raw `provideAgent({ transport: new MockAgentTransport(scriptedBatches) })` path remains the **advanced escape hatch** for tests needing tool calls, interrupts, or multi-batch scripting.
- The synthesized script must produce wire events that the langgraph adapter's reducers translate into `messages()` (assistant text) and, when `reasoningTokens` are present, the reasoning surface — matching how `MockAgentTransport` events already flow. Exact `StreamEvent` shapes are determined by reading `MockAgentTransport`'s existing event handling during implementation.

### 2c. `mockLangGraphAgent` extends `mockAgent` (refactor)

`mockLangGraphAgent(initial)` calls chat's `mockAgent(initial)` to obtain the shared neutral writable signals (`messages`, `status`, `isLoading`, `error`, `toolCalls`, `interrupt`, `subagents`, `history`, `state`, lifecycle stub, `events$`), then layers the LangGraph-specific writable signals on top: `langGraphMessages`, `langGraphInterrupts`, `langGraphToolCalls`, `toolProgress`, `queue`, `branch`, `langGraphHistory`, `experimentalBranchTree`, `isThreadLoading`, `activeSubagents`, `customEvents`, `hasValue`, `value`.

- `MockLangGraphAgent extends MockAgent` (the chat type), adding the LangGraph-specific writable signals.
- The neutral signals are created by `mockAgent`, not re-declared.
- `mockAgent`'s `MockAgentOptions` is the base of `mockLangGraphAgent`'s `initial` parameter; LangGraph-only initial fields (e.g. `langGraphMessages`, `isThreadLoading`) extend it.
- Existing langgraph component/spec tests that consume `mockLangGraphAgent` must pass unchanged.

### 2d. ag-ui writable-signal mock — none added

ag-ui's adapter produces the neutral `Agent` contract, so ag-ui consumers use `mockAgent()` from `@threadplane/chat` directly for component/unit tests. Documented in the ag-ui testing guide; no `mockAgUiAgent` is added.

### Resulting symmetry

| | Layer 2 — fake-backend | Layer 1 — writable-signal mock |
|---|---|---|
| langgraph | `provideFakeAgent({tokens, …})` | `mockLangGraphAgent()` (extends `mockAgent`) |
| ag-ui | `provideFakeAgent({tokens, …})` | `mockAgent()` (from chat, neutral) |

Same `provideFakeAgent({tokens, reasoningTokens, delayMs})` call shape on both adapters, backed by one shared `FakeAgentConfig`.

## Documentation

- **`apps/website/content/docs/langgraph/guides/testing.mdx`** (exists): document `provideFakeAgent({tokens})` (layer 2) and `mockLangGraphAgent()` (layer 1, extends `mockAgent`).
- **`apps/website/content/docs/ag-ui/guides/testing.mdx`**: create if absent; document `provideFakeAgent({tokens})` and using neutral `mockAgent()` for component tests.
- **Test-double selection table** (the three-layer pyramid from Background): canonical copy added as a new "Testing" section on the existing **Choosing-an-adapter** page (`apps/website/content/docs/choosing-an-adapter/index.mdx`) — it's already adapter-neutral and the natural home for cross-adapter guidance. Both adapter testing guides link to it rather than duplicating it. Guidance: don't reach for aimock when a `mockAgent` unit test suffices; don't hand-roll transport mocks when `provideFakeAgent` exists.
- **Lib READMEs** (`libs/langgraph/README.md`, `libs/ag-ui/README.md`): short "Testing" subsection — `provideFakeAgent({tokens})` plus a one-liner pointing at neutral `mockAgent` for unit tests.

## Testing (TDD)

- **chat:** `FakeAgentConfig` is a type (no runtime test). `mockAgent` keeps existing coverage; add an assertion only if its source is touched.
- **langgraph:** new `provideFakeAgent` spec — TestBed-provide it, `injectAgent()`, drive the fake stream, assert `messages()`/`status()` reflect the canned tokens, including `reasoningTokens` ordering and `delayMs` spacing. Refactored `mockLangGraphAgent` — existing specs pass unchanged; add a spec asserting the returned object satisfies the neutral `MockAgent` shape.
- **ag-ui:** existing `provide-fake-agent.spec.ts` passes after the `FakeAgentConfig` import move.

## Versioning

Additive new exports plus one internal refactor → **patch** bump, applied **uniformly** across all publishable libs `0.0.48 → 0.0.49` (per the uniform-version CI gate enforced by `scripts/verify-release-versions.mjs`: chat, langgraph, ag-ui, render, a2ui, licensing, telemetry).

## Phasing (one PR, ordered commits)

1. **chat** — add `FakeAgentConfig` to `chat/testing`.
2. **ag-ui** — delete local `FakeAgentConfig`, import from chat/testing; specs green.
3. **langgraph** — add `provideFakeAgent` + spec; refactor `mockLangGraphAgent` to extend `mockAgent` + specs green.
4. **docs** — testing guides, selection-table page + cross-links, README testing subsections.
5. **versioning + verification** — uniform bump to `0.0.49`; `nx run-many -t lint test build` green for chat, langgraph, ag-ui, website.

## Risks

| Risk | Mitigation |
|---|---|
| Synthesized `StreamEvent` shapes in langgraph `provideFakeAgent` don't match what the adapter reducers expect | Implementation reads `MockAgentTransport`'s existing event handling + an existing transport-driven spec to mirror the exact event shapes; the new spec asserts `messages()` actually populates. |
| `mockLangGraphAgent` refactor changes behavior relied on by existing component tests | Existing specs are the regression gate — they must pass unchanged. No public signal removed; only the construction is rerouted through `mockAgent`. |
| Moving `FakeAgentConfig` breaks external imports | Accepted (no backwards-compat requirement). Consumers re-point to `@threadplane/chat/testing`. |
| Forgetting the uniform version bump | Codified in `feedback_uniform_publishable_versions.md`; verify with `node scripts/verify-release-versions.mjs`. |

## Open decisions

None. All decisions captured above were approved during brainstorming.
