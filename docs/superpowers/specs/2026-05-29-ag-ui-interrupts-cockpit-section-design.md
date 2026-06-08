# AG-UI Interrupt Support + Cockpit `ag-ui` Section — Design

**Date:** 2026-05-29
**Status:** Approved (brainstorming) — pending implementation plan
**Depends on:** the agent→langgraph rename already on `main` (`provideAgent`/`injectAgent` symmetric surface).

## Problem

The README audit surfaced a real capability gap: `@threadplane/ag-ui`'s `toAgent()` does not wire up the runtime-neutral `Agent` contract's optional `interrupt` field, so AG-UI-backed chat cannot surface human-in-the-loop (HITL) interrupts — even though `@threadplane/langgraph` supports them and the chat compositions (`<chat-approval-card>`) are ready to render them.

This effort closes that gap **and** validates it end-to-end by establishing a new, navigable `ag-ui` cockpit section (positioned after `langgraph`) with a working interrupt example backed by a real AG-UI-fronted LangGraph server. As a forcing function it also brings the pre-existing `streaming` example up to the full standalone pattern. A blog post is a planned follow-on, out of scope here.

## Goals

1. Add `interrupt` support to the AG-UI adapter (inbound bridge + resume). `subagents` stays out of scope (no AG-UI streaming channel for it).
2. Register `ag-ui` as a first-class cockpit section in the manifest, ordered after `langgraph`.
3. Add a standalone `cockpit/ag-ui/interrupts` example (Angular + AG-UI-fronted LangGraph backend) mirroring `cockpit/langgraph/interrupts`.
4. Refactor `cockpit/ag-ui/streaming` from its FakeAgent-only shape into a standalone real-backend example matching the same pattern.
5. Deterministic CI e2e for both examples via an AG-UI-specific harness setup + recorded aimock fixtures.

## Decisions (from brainstorming)

- **Scope:** interrupt only (not subagents).
- **Example backend:** AG-UI-fronted LangGraph (most production-like). The same UX/component proves the runtime-neutral contract across adapters.
- **Standalone rule:** each cockpit example is fully self-contained — duplicate the refund graph into the new example; never share/import across examples. (See memory `cockpit-examples-standalone`.)
- **Streaming:** refactor in this effort (not deferred).
- **E2E harness:** add an **AG-UI-specific** global-setup variant (spawns uvicorn); leave the existing langgraph `createGlobalSetup` untouched.
- **Fixtures:** produce via a **`manual/` recorder** per example (mirror langgraph's), capturing real exchanges.
- **Deploy files:** include `vercel.json` + `requirements.txt` for full parity.

## Verified ground truth (from source + the `ag-ui-protocol/ag-ui` repo)

- **Inbound interrupt:** the `ag-ui-langgraph` Python integration emits a `CUSTOM` AG-UI event with `name = "on_interrupt"` (`LangGraphEventTypes.OnInterrupt`) and `value = interrupt.value` after the stream pauses. (`integrations/langgraph/python/ag_ui_langgraph/agent.py`, `types.py:16`.)
- **Resume:** the server reads `input.forwarded_props["command"]["resume"]`. The client resumes by calling `source.runAgent({ forwardedProps: { command: { resume } } })`.
- **Chat contract:** `AgentInterrupt = { id, value, resumable }` (`libs/chat/src/lib/agent/agent-interrupt.ts`); `interrupt?`/`subagents?` are optional on `Agent` (`agent.ts:50-51`); `AgentSubmitInput.resume?: unknown` already exists (`agent-submit.ts:8`). `<chat-approval-card matchKind="…">` matches `interrupt.value.kind`, opens a dialog, emits `(action)`.
- **Reducer today:** `libs/ag-ui/src/lib/reducer.ts` handles RUN/TEXT/REASONING/TOOL_CALL/STATE/MESSAGES/CUSTOM; the `CUSTOM` case forwards to `events$`. `ReducerStore` has no `interrupt`.
- **E2E harness today:** `libs/e2e-harness/src/global-setup-factory.ts` `createGlobalSetup` spawns `uv run langgraph dev --port N --no-browser`, health-checks `http://localhost:N/ok`, and sets `OPENAI_BASE_URL` to an `aimock` (`@copilotkit/aimock` `LLMock`, OpenAI-compatible replay) server seeded from `fixturesDir`. This is LangGraph-Platform-specific.
- **Refund graph:** `cockpit/langgraph/interrupts/python/src/graph.py` raises `interrupt({ "kind": "refund_approval", "amount", "customer_id", "reason" })`.

---

## Design

### 1. AG-UI adapter: interrupt support (`libs/ag-ui/src/lib/`)

**`reducer.ts`:**
- Add `interrupt: WritableSignal<AgentInterrupt | undefined>` to `ReducerStore`.
- In the `CUSTOM` case, branch on `event.name`: when `=== 'on_interrupt'`, set
  `store.interrupt.set({ id: randomId(), value: (event as { value?: unknown }).value, resumable: true })` (reuse the `randomId()` helper already in `to-agent.ts`, or lift it into the reducer's module).
  Other CUSTOM events keep forwarding to `events$` unchanged.
- In `RUN_STARTED`, clear the interrupt (`store.interrupt.set(undefined)`) — a new/resumed run supersedes a pending interrupt. Leave it set through `RUN_FINISHED` (it persists until resumed).

**`to-agent.ts`:**
- Add `interrupt: signal<AgentInterrupt | undefined>(undefined)` to the `store`; expose `interrupt: store.interrupt` on the returned `Agent`.
- In `submit(input, _opts)`: if `input.resume !== undefined`, do NOT append a user message — call
  `await source.runAgent({ forwardedProps: { command: { resume: input.resume } } })`, and clear `store.interrupt` immediately for snappy UX. Run-telemetry uses `requestType: 'resume'`. A normal `submit({ message })` path is unchanged.
- Import `AgentInterrupt` from `@threadplane/chat`.

**Non-goals:** `subagents` stays unset (documented). Purely additive — no breaking change.

**Unit tests** (`reducer.spec.ts`, `to-agent.spec.ts`): `on_interrupt` sets the signal (id present, value passed through, `resumable: true`); `RUN_STARTED` clears it; non-interrupt CUSTOM still emits on `events$`; `submit({ resume })` calls `runAgent` with `forwardedProps.command.resume` and does not append a message; `submit({ message })` unchanged.

### 2. AG-UI backend pattern (`ag-ui-langgraph` over a LangGraph graph)

Each ag-ui example's `python/` is a standalone uvicorn FastAPI app:
- `src/graph.py` — the example's own compiled LangGraph graph.
- `src/server.py` — builds the `ag-ui-langgraph` agent over the compiled graph, mounts it as a FastAPI app exposing the AG-UI POST endpoint, and adds a `GET /ok` health route (so the e2e setup's readiness check matches the langgraph harness convention).
- The graph's model is `ChatOpenAI`, so setting `OPENAI_BASE_URL` (to aimock) makes runs deterministic — same mechanism the langgraph harness already uses.
- `pyproject.toml` / `uv.lock` — own deps: `ag-ui-langgraph`, `langgraph`, `langchain-openai`, `fastapi`, `uvicorn`.
- `requirements.txt` — for deploy parity.
- `langgraph.json` is **not** used (that's LangGraph Platform). Instead the run command is `uv run uvicorn src.server:app --port <backend>`.

### 3. `cockpit/ag-ui/interrupts` (new, standalone)

Mirrors `cockpit/langgraph/interrupts` file-for-file, with the adapter + backend swapped.

**`python/`:** `src/graph.py` (duplicated refund-approval graph, `interrupt({ kind: 'refund_approval', … })`), `src/server.py` (§2), `src/index.ts` (`CockpitCapabilityModule`, `product:'ag-ui'`, `language:'python'`, `topic:'interrupts'`, asset paths, `devPort`), `pyproject.toml`, `uv.lock`, `requirements.txt`, `docs/guide.md`, `prompts/interrupts.md`, `project.json` (targets: `build` tsc on index.ts, `smoke` module-shape check, `serve` running uvicorn on the backend port; tags incl. `scope:cockpit-smoke`), `tsconfig.json`, `.gitignore`.

**`angular/`:** duplicated from langgraph interrupts, with:
- `src/app/app.config.ts` — `provideAgent({ url: '/agent' })` from **`@threadplane/ag-ui`** + `provideChat({})`.
- `src/app/interrupts.component.ts` — essentially identical: `injectAgent()`, `<chat-approval-card matchKind="refund_approval">`, approve/reject/edit → `submit({ resume: { approved, amount? } })`.
- `proxy.conf.mjs` — `/agent` → `http://localhost:${backend}` via `portsFor('cockpit-ag-ui-interrupts-angular')`.
- `src/index.ts` (angular `CockpitCapabilityModule`), `src/main.ts`, `src/main.cockpit.ts`, `src/index.html`, `src/styles.css`, `src/environments/{environment,environment.development}.ts` (no `assistantId`; just the proxied URL).
- `project.json` — `build` (with a `cockpit` configuration), `serve`, `smoke`, `e2e` targets; tags `scope:cockpit-e2e`, `scope:cockpit-examples`.
- `package.json`, `tsconfig.json`, `tsconfig.app.json`, `vercel.json`.
- `e2e/` — see §6.

### 4. `cockpit/ag-ui/streaming` refactor (to standalone real backend)

- **Add `python/`** — a standalone minimal streaming chat graph (single node, `ChatOpenAI` token streaming) modeled on `cockpit/langgraph/streaming/python` but duplicated and wrapped per §2. Full python file set as in §3.
- **`angular/`** — swap `provideFakeAgent({ tokens })` → `provideAgent({ url: '/agent' })`; replace static `proxy.conf.json` with `proxy.conf.mjs` (`portsFor`); add `src/main.cockpit.ts` + `cockpit` build configuration (currently missing); add `e2e/` (§6). Keep `vercel.json`.
- `provideFakeAgent` remains a library export (offline/testing utility + the `/docs/ag-ui/guides/fake-agent` page) — just no longer this example's backend.

### 5. Section registration (`libs/cockpit-registry/src/lib/`)

- `manifest.types.ts` — add `'ag-ui'` to the `CockpitProduct` union.
- `manifest.ts` — add an `'ag-ui'` key to `APPROVED_TOPICS` **immediately after `'langgraph'`** (key order = display order), with `'core-capabilities': ['streaming', 'interrupts']`.
- Reconcile with `validate-manifest.ts` if it cross-checks topics against disk.

### 6. E2E: AG-UI setup variant + manual recorder + fixtures (`libs/e2e-harness` + per example)

- **`libs/e2e-harness`** — add a new `createAgUiGlobalSetup(opts)` factory (sibling to `createGlobalSetup`, langgraph path untouched). It: starts `aimock` (replay, from `fixturesDir`); spawns the uvicorn backend (`uv run uvicorn src.server:app --port <backend>` in the example's `python/` cwd) with `OPENAI_BASE_URL=aimock.baseUrl`, `OPENAI_API_KEY='test-not-used'`, `detached:true`; health-checks `http://localhost:<backend>/ok`; serves the Angular project; records shared state for teardown (reuse `global-teardown`). Export it from `libs/e2e-harness/src/index.ts`.
- **Per example `e2e/`:** `global-setup-impl.ts` (calls `createAgUiGlobalSetup` with `pythonCwd`, `backendPort`, `angularProject`, `angularPort`, `fixturesDir`), `playwright.config.ts` (baseURL from `portsFor`, `globalSetup`, shared `globalTeardown`), `*.spec.ts`, `tsconfig.json`, `fixtures/*.json`.
- **Manual recorder:** `e2e/manual/<topic>.manual.ts` per example (mirror `cockpit/langgraph/interrupts/angular/e2e/manual/interrupts.manual.ts`) to capture real OpenAI exchanges into `fixtures/*.json`, run against a live key locally; committed fixtures drive CI replay.
- **Specs:** interrupts — approval card appears with refund payload, approve resumes and completes, reject skips; streaming — tokens stream into the message list.

### 7. Ports (`cockpit/ports.mjs`)

- Add `cockpit-ag-ui-interrupts-angular` and `cockpit-ag-ui-streaming-angular` with `{ angular, langgraph }` pairs (the `langgraph` slot = backend/uvicorn port), following the `+1000` convention. Proposed block: interrupts `4320 / 5320`, streaming `4321 / 5321`.
- Remove the stale "exception" note about streaming using a Node server on :3000; fix the comment to describe the uvicorn AG-UI backend.
- The python `serve` `--port` and the Playwright `baseURL` must match the registry — `scripts/cockpit-ports.spec.mjs` enforces this.

### 8. CI wiring (`.github/workflows/ci.yml`)

- `cockpit-examples-build` auto-builds `cockpit-*-angular` → both apps picked up automatically.
- e2e auto-discovered by `scripts/cockpit-matrix.mjs` because each angular `project.json` declares an `e2e` target.
- `cockpit-smoke` is a hardcoded list → add `cockpit-ag-ui-interrupts-python` and `cockpit-ag-ui-streaming-python`.

### 9. Deploy files

`vercel.json` (angular) + `requirements.txt` (python) for both examples, mirroring the langgraph streaming example.

## Testing strategy

- Adapter unit tests (§1).
- Example e2e via the AG-UI setup variant + recorded fixtures (§6), auto-run in CI.
- `smoke` targets on both python projects (module-shape check), added to the CI list.
- `nx run-many -t build` for `@threadplane/ag-ui` + both `cockpit-ag-ui-*-angular`; `cockpit-ports.spec.mjs` passes.
- Manual local validation against a live LangGraph+AG-UI server before recording fixtures.

## Out of scope

- `subagents` support in the AG-UI adapter.
- The blog post (planned follow-on).
- Subagent/other ag-ui examples; deeper docs-site content beyond what already exists under `/docs/ag-ui/*`.

## Success criteria

- `@threadplane/ag-ui` exposes a populated `interrupt` signal from `on_interrupt` events and resumes via `submit({ resume })`; unit tests pass.
- `ag-ui` is a registered manifest section ordered after `langgraph`.
- `cockpit/ag-ui/interrupts` and refactored `cockpit/ag-ui/streaming` each run standalone (Angular + uvicorn AG-UI backend), build, smoke, and pass deterministic e2e in CI.
- The interrupts example renders the refund approval card and completes the resume flow using the **same** component shape as `cockpit/langgraph/interrupts` — demonstrating the runtime-neutral contract across adapters.
- No regression to the existing langgraph e2e harness path.
