# `@threadplane/middleware/langgraph` — LangGraph.js client-tools middleware

**Date:** 2026-06-15
**Status:** Design — awaiting review
**Author:** Brian Love (with Claude)

## Goal

Ship the TypeScript/LangGraph.js twin of the published Python `threadplane-client-tools`
middleware, so a LangGraph.js backend can support the `@threadplane/chat` client-tools
capability (frontend-declared `action`/`view`/`ask` tools the browser executes) exactly
the way a Python LangGraph backend does today.

The middleware does two things, mirroring Python:

1. **Bind** a client-tool catalog (arriving in the run input as `client_tools`, mirrored
   onto graph state) onto the chat model as OpenAI-format function stubs — alongside any
   real server tools — so the model can call them.
2. **Route** the turn: when the model's last message contains *only* client-tool calls
   (no server-tool calls), route to `END` so the run ends, the browser executes the tool,
   and the frontend re-submits a `ToolMessage` to continue. Server-tool calls route to the
   tools node as normal; no tool calls route to the end node.

## Naming & home decisions

These were settled during brainstorming and supersede the day-old `threadplane-client-tools`
naming:

| Axis | Decision |
|---|---|
| npm package | `@threadplane/middleware` |
| npm import | `@threadplane/middleware/langgraph` (vendor-first subpath) |
| PyPI distribution | `threadplane-middleware` (renamed from `threadplane-client-tools`) |
| Python import | `from threadplane.middleware.langgraph import bind_client_tools` |
| Versioning | independent cadence from `0.0.1`; **not** in the Angular lockstep release group |
| Backwards compat | **none** — clean cut; `threadplane-client-tools` 0.0.1 left published but dormant |

**Why vendor-first (`/langgraph`), not feature-first (`/client-tools`):** every symbol is
LangGraph-coupled — the `Annotation` state-channel fragment, the conditional-edge router
that returns a LangGraph routing string, the `state.tools` reads. It is not portable to
another agent framework, so the subpath should state that constraint. It also mirrors the
frontend's vendor entrypoints (`@threadplane/langgraph`, `@threadplane/ag-ui`). "Client
tools" lives as function names (`bindClientTools`), not a path segment. Future LangGraph
middleware (auth, telemetry, guardrails) adds exports/submodules under `/langgraph`; a
future non-LangGraph framework gets a sibling subpath (`/mastra`, `/vercel-ai`). Single
level today (YAGNI); nest to `/langgraph/<feature>` only if a feature grows large — adding
exports to an existing subpath is non-breaking.

## Repository layout

`packages/` is the established home for publishable non-Angular distributions (currently
`cacheplane`, `threadplane` [PEP 420 namespace root], `threadplane-client-tools`). Both
language packages live there:

The **Python** package lives in `packages/` (the home for publishable non-Angular Python
distributions). The **JS** package follows the repo's own convention for publishable
non-Angular TypeScript libraries — `libs/<name>`, built with `@nx/js:tsc` — mirroring the
existing `libs/telemetry` and `libs/licensing` (themselves non-Angular publishable TS libs).
So the JS package is `libs/middleware` (Nx project name `middleware`), NOT a `packages/`
sibling.

```
packages/
  threadplane/                     # unchanged — namespace root (provides `threadplane`)
  threadplane-middleware/          # RENAMED from threadplane-client-tools (Python)
    pyproject.toml                 #   name = "threadplane-middleware"
    src/threadplane/middleware/langgraph/
      __init__.py                  #   re-exports the 7 public symbols
      middleware.py                #   moved from client_tools/middleware.py (unchanged logic)
    tests/test_middleware.py
    README.md

libs/
  middleware/                      # NEW — npm @threadplane/middleware (TypeScript)
    package.json                   #   "type":"module"; "exports": { "./langgraph": ... }; peerDeps
    project.json                   #   @nx/js:tsc build + @nx/vitest:test + @nx/eslint:lint
    tsconfig.json                  #   extends ../../tsconfig.base.json (mirror libs/telemetry)
    tsconfig.lib.json              #   declaration:true, emitDeclarationOnly:false
    tsconfig.spec.json             #   types: ["vitest/globals","node"]
    vite.config.mts                #   @nx/vitest config (environment: node, globals: true)
    src/
      langgraph/
        index.ts                   #   public surface for the /langgraph subpath
        middleware.ts              #   bindClientTools, routing, predicates
        channel.ts                 #   clientToolsChannel() Annotation fragment
        router.ts                  #   clientToolsRouter() conditional-edge factory
        types.ts                   #   ClientToolSpec, ClientToolsState
      langgraph.spec.ts            #   unit (fakes, mirrors Python suite)
      integration.spec.ts          #   in-process real StateGraph + fake chat model
    README.md
```

The JS package builds with `@nx/js:tsc` and tests with `@nx/vitest:test` (the repo's native
toolchain — there is no `tsup` anywhere in the repo), exactly mirroring `libs/telemetry`'s
`project.json`. It participates in `nx affected`/CI like every other lib. It has **no
workspace dependencies** (so no shared-types build coupling), and is deliberately **excluded
from the `publishable` Nx release group** in `nx.json` (that group is the lockstep Angular
libs); it publishes on its own cadence via the staged npm workflow below.

## JS API surface (`@threadplane/middleware/langgraph`)

### 1:1 mirror of the Python public API (camelCased)

```ts
// types.ts
export interface ClientToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema (OpenAI function `parameters`)
}

// a minimal structural view of the slice of graph state we read
export interface ClientToolsState {
  messages: BaseMessage[];               // from @langchain/core (type-only)
  tools?: ClientToolSpec[];              // primary channel
  client_tools?: ClientToolSpec[];       // fallback channel (raw run input)
}
```

```ts
// middleware.ts
// Read the catalog from state.tools, falling back to state.client_tools.
export function clientToolSpecs(state: ClientToolsState): ClientToolSpec[];
export function clientToolNames(state: ClientToolsState): Set<string>;

// Bind client stubs (as OpenAI function tools) + any server tools onto a chat model.
// `llm` is anything with .bindTools (Runnable<...>); typed against @langchain/core.
export function bindClientTools<M extends BindableModel>(
  llm: M,
  serverTools: ServerTool[],
  state: ClientToolsState,
): M;

export function lastMessage(state: ClientToolsState): BaseMessage | undefined;
export function hasClientToolCall(state: ClientToolsState): boolean; // last AI msg calls a client tool

// A call is a "server" call when its name is in serverToolNames OR is not a known client
// tool (unknown tools are assumed server-side) — mirrors the Python signature exactly.
export function hasServerToolCall(
  state: ClientToolsState,
  serverToolNames: Iterable<string>,
): boolean;

// Router decision string for a conditional edge. Mirrors Python's
// route_after_agent(state, server_tool_names, *, tools_node="tools", end="__end__"):
//   has server tool call            -> toolsNode (default "tools")
//   has client tool call (only)     -> end       (default "__end__")
//   no tool calls                   -> end
export function routeAfterAgent(
  state: ClientToolsState,
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): string;
```

Semantics match Python exactly, including the precedence rule: a turn that mixes a server
tool call and a client tool call routes to the **server** destination (the server tool runs
first; the client call surfaces on a later turn).

### Idiomatic LangGraph.js extras

```ts
// channel.ts — drop-in state channels so a graph declares the client-tools slice in one line
export function clientToolsChannel(): {
  tools: ReturnType<typeof Annotation<ClientToolSpec[] | undefined>>;
  client_tools: ReturnType<typeof Annotation<ClientToolSpec[] | undefined>>;
};
// Usage: const State = Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() });

// router.ts — prebuilt conditional-edge callback wrapping routeAfterAgent.
// serverToolNames is bound once at construction; the returned callback takes only state.
export function clientToolsRouter(
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): (state: ClientToolsState) => string;
// Usage: graph.addConditionalEdges("agent", clientToolsRouter([]), ["tools", END]);
// (pass [] when there are no server tools — the common client-tools-only case)
```

`@langchain/core` and `@langchain/langgraph` are **peer dependencies** (and dev deps for
tests). The package ships no runtime dependencies of its own. `Annotation`/`MessagesAnnotation`
are imported from `@langchain/langgraph`.

## Python clean-cut rename

Same logic, new home and import path. No behavior changes to `middleware.py`.

**Package move:**
- `packages/threadplane-client-tools/` → `packages/threadplane-middleware/`
- `pyproject.toml`: `name = "threadplane-middleware"`, version reset to `0.0.1`, description
  unchanged in substance.
- `src/threadplane/client_tools/` → `src/threadplane/middleware/langgraph/` (PEP 420 chain:
  `threadplane` → `threadplane.middleware` → `threadplane.middleware.langgraph`, all
  `__init__`-free except the leaf, which re-exports the 7 symbols).
- `tests/` move with the package; assertions unchanged.

**In-repo consumers to migrate (same PR):**
- `cockpit/ag-ui/client-tools/python/src/graph.py`
- `cockpit/langgraph/client-tools/python/src/graph.py`
- `examples/ag-ui/python/src/graph.py`
- each consumer's `pyproject.toml` dependency + regenerated `uv.lock` / `requirements.txt`
- the import string changes `from threadplane.client_tools import …`
  → `from threadplane.middleware.langgraph import …`

**Deploy configs to regenerate (drift-guarded):**
- `deployments/shared-dev/deps/langgraph-client-tools/` (vendored source + graph)
- `deployments/ag-ui-dev/deps/client_tools/` (vendored source + graph)
- Regenerate via the existing generator scripts; verify the drift guard passes.

**Docs:**
- `cockpit/ag-ui/client-tools/python/docs/guide.md`,
  `cockpit/langgraph/client-tools/python/docs/guide.md`
- `packages/threadplane/README.md`, the package README
- the stale plan doc reference under `docs/superpowers/plans/` (historical — update import
  string only if it's presented as current guidance; otherwise leave as dated record)

**Workflow rename:**
- `.github/workflows/publish-client-tools-python.yml` →
  `publish-middleware-python.yml`, pointed at `packages/threadplane-middleware`, same
  `workflow_dispatch`-only trigger with `dry-run` defaulting to `true`. Trusted-publishing
  config updated to the new PyPI project once it exists.

**Sequencing (mirrors the prior two-step):**
1. PR 1 — rename + migrate all in-repo consumers using **path sources** (`uv` path deps) so
   nothing depends on a published artifact; smoke targets + deploy drift guards green.
2. You publish `threadplane-middleware 0.0.1` to PyPI (your keystroke; dry-run first).
3. PR 2 — flip the three consumers' `pyproject.toml` from path source to the published
   `threadplane-middleware>=0.0.1`; regen locks; smoke green.

`threadplane-client-tools` 0.0.1 stays published but receives no further releases. No alias
shim (the package is a day old with no known external consumers).

## Verification ladder

1. **Unit (vitest)** — pure fakes (plain objects for state, a stub model recording
   `bindTools` args), mirroring the Python `test_middleware.py` case-for-case: catalog read
   with/without fallback, name set, bind merges server + client tools, the three predicates,
   and every `routeAfterAgent` branch including the mixed-call precedence rule.
2. **In-process integration (vitest)** — build a real `StateGraph` with
   `Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() })`, an `agent`
   node using `bindClientTools` over a **scripted fake chat model**, `clientToolsRouter()`
   edges, and a no-op `tools` node. Assert the full loop in-process (no server): bind →
   model emits a client-only tool call → router → `END` → caller appends a `ToolMessage` →
   re-invoke → model produces the final content. Dev-deps `@langchain/langgraph` +
   `@langchain/core`.
3. **Demo server + reused frontend (manual live smoke)** — a minimal Node/TS LangGraph.js
   server added as a **language sibling** at `examples/ag-ui/node/` (alongside the existing
   `examples/ag-ui/python/` and `examples/ag-ui/angular/`), exposing `/agent` via
   `@ag-ui/langgraph` (npm `0.0.41`) with a client-tools graph built on this middleware.
   Because the catalog is frontend-declared, the same generic bind→route-to-END graph drives
   the existing itinerary client tools unchanged. For the smoke, point the existing
   `examples/ag-ui/angular` itinerary demo's dev proxy at the `node` backend instead of
   `python` (identical `/agent` contract) and drive the function/view/ask loop in Chrome with
   a real `OPENAI_API_KEY` — satisfying the standing live-LLM-before-merge gate. No second
   frontend ships: the TS backend is a third runtime behind the same demo.

## npm publishing

A new **staged** `workflow_dispatch` workflow (`publish-middleware-npm.yml`) for
`@threadplane/middleware`, mirroring the Python staged workflow: `dry-run` input defaulting
to `true`, Node 24 / npm 11+ for trusted publishing + provenance, `nx build middleware` then
`npm publish dist/libs/middleware`. Not tag-triggered and not part of the Angular `nx release` lockstep group.
The first real publish is bootstrapped by you after the dry run is clean.

## Out of scope

- Non-LangGraph frameworks (Mastra, Vercel AI SDK) — the vendor-first layout leaves room,
  but no sibling subpath is built now.
- Additional middleware features (auth, telemetry, guardrails) — layout anticipates them;
  none implemented here.
- Any change to the frontend adapters or `@threadplane/chat` — the TS backend speaks the
  existing AG-UI client-tools contract unchanged.
- A second Angular frontend for the TS demo — the `node` backend is a third runtime behind
  the existing `examples/ag-ui/angular` itinerary demo.

## Risks & mitigations

- **`bindTools` typing across LangChain model classes** — type `bindClientTools` against the
  `@langchain/core` `Runnable`/`BindableModel` surface and return the same model type;
  validate against `ChatOpenAI` in the integration test.
- **Annotation API drift between `@langchain/langgraph` minor versions** — pin a tested peer
  range; the integration test (real `StateGraph`) catches incompatibilities CI-side.
- **PyPI rename leaving dangling references** — a repo-wide `grep` for `threadplane.client_tools`
  / `threadplane_client_tools` / `threadplane-client-tools` is part of PR 1's acceptance
  (zero hits outside `.venv`/historical dated docs).
- **Deploy drift guards** — regenerate vendored deploy deps and confirm both deploy configs
  pass their drift checks before merge (these guards have bitten before).

## Implementation phases (detail deferred to the plan)

1. Python clean-cut rename + consumer migration (path sources) + workflow rename + docs.
2. JS package scaffold (`libs/middleware`: @nx/js:tsc / @nx/vitest / @nx/eslint, `/langgraph` export) + mirror API +
   extras, with the unit suite.
3. JS in-process integration test.
4. TS demo server + live smoke against the reused cockpit frontend.
5. npm staged publish workflow.
6. (Your keystrokes, out of band) publish `threadplane-middleware` to PyPI, then PR 2 to
   flip Python consumers to the published version; bootstrap the first npm publish.
