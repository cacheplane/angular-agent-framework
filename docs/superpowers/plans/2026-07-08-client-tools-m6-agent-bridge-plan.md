# Client Tools M6 Agent Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider-to-Threadplane `Agent` bridge only after the provider event contract is available and characterized. M6 is explicitly marked future/deferred in the Revision 4 client-tool continuation spec, so the first executable step is a discovery/contract PR, not an adapter guessed from incomplete inputs.

**Architecture:** Preserve the runtime-neutral `Agent` contract as the migration boundary. If the provider emits AG-UI-compatible events, reuse the existing `@threadplane/ag-ui` reducer/`toAgent` behavior through a thin adapter. If it emits a distinct event shape, add a narrow bespoke reducer in a provider-specific package or private adapter module, backed by conformance tests against the same `Agent` invariants already used by AG-UI and LangGraph. Do not add runtime dependencies or public exports until the event contract and package boundary are approved.

**Tech Stack:** Angular signals, RxJS `Observable`, Vitest, Nx package targets, existing `Agent` conformance patterns, generated API docs only if a public export is added. No new dependencies without explicit approval.

---

## Source Of Truth

- Spec: `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` §8, §10 M6, and §12 open item 2.
- Handoff: `docs/superpowers/context/2026-07-07-client-tools-continuation-handoff.md`.
- Existing bridge pattern: `libs/ag-ui/src/lib/to-agent.ts` and `libs/ag-ui/src/lib/reducer.ts`.
- Existing DI/provider pattern: `libs/ag-ui/src/lib/provide-agent.ts` and `libs/langgraph/src/lib/agent.provider.ts`.
- Existing neutral contract: `libs/chat/src/lib/agent/agent.ts`.

## Entry Criteria

Do not begin runtime implementation until at least one of these is true:

- A local provider package/source directory exists in this repository with stable event types and provider construction APIs.
- An approved dependency addition identifies the exact package, version, exported event/provider types, and bundle target.
- A pinned upstream source snapshot or fixture corpus is committed under an approved testing/documentation location.

Initial repo audit on 2026-07-08 found no local provider source package or dependency for this M6 bridge. A local provider source pointer was later supplied at `/Users/blove/repos/hashbrown`; discovery notes live at `docs/superpowers/context/2026-07-08-client-tools-m6-provider-contract-notes.md`.

## Scope Guard

- Keep M6 additive. Do not alter `Agent`, `ClientToolsCapability`, existing AG-UI behavior, or existing LangGraph behavior.
- Do not introduce hidden recursive continuation semantics. Continuation remains an explicit chat-layer policy from M5.
- Do not add new dependencies without explicit approval.
- Do not add public exports without regenerating API docs and including the docs diff.
- Do not mention external framework names in code, comments, commit messages, or PR text. Mentions are allowed in this plan/spec context only.
- If implementation proceeds, test against current behavior and the existing `Agent` contract rather than aspirational provider features.

## File Structure

Discovery-only PR:

- Add or modify: `docs/superpowers/plans/2026-07-08-client-tools-m6-agent-bridge-plan.md`
- Optional add: `docs/superpowers/context/2026-07-08-client-tools-m6-provider-contract-notes.md`
  - Only if event/provider contract details are supplied during discovery.

Implementation PR, once entry criteria are met:

- Add: provider-specific adapter module, location TBD after package-boundary decision:
  - Option A: new library/package if this is a first-class published adapter.
  - Option B: private adapter under an existing package if the provider is only an internal migration aid.
- Test: provider adapter conformance spec mirroring `libs/ag-ui/src/lib/to-agent.conformance.spec.ts`.
- Test: provider reducer/unit specs for event-to-signal projection.
- Test: DI/provider specs if an Angular `provideAgent` helper is added.
- Modify: public API barrel only if the bridge is intentionally public.
- Modify: `apps/website/content/docs/chat/api/api-docs.json` only after public API changes.

---

## Task 1: Provider Event Contract Discovery

**Files:**
- Optional add: `docs/superpowers/context/2026-07-08-client-tools-m6-provider-contract-notes.md`

- [x] **Step 1: Capture provider source and version**

Record:

- package/source location;
- exact version or commit;
- browser bundle target;
- provider construction API;
- subscription/event API;
- stop/abort API;
- message history mutation API, if any.

- [x] **Step 2: Capture event fixtures**

Collect minimal real or source-derived fixtures for:

- run start;
- run finish;
- run error;
- assistant text streaming;
- message snapshot or equivalent history replacement;
- state snapshot/delta, if available;
- tool-call start/args/end/result;
- custom events;
- interrupt or human-in-the-loop equivalent;
- activity/subagent equivalent, if available;
- abort/cancel delivery.

- [x] **Step 3: Compare against AG-UI reducer coverage**

Produce a table with three columns:

- provider event;
- existing AG-UI reducer case that can handle it;
- adapter gap or custom projection required.

Decision gate:

- If events are AG-UI-compatible, implement a thin provider wrapper that feeds `toAgent()`.
- If events are not AG-UI-compatible, implement a bespoke reducer that writes the neutral `Agent` signals directly.
- If tool/message mutation APIs are missing, do not implement `submit`, `retry`, `regenerate`, or `stop` until equivalent APIs are confirmed.

Discovery result: the inspected provider exposes a stateful chat/resource API plus internal transport frames, not an AG-UI `AbstractAgent`-style public event subscriber. First implementation should therefore use a bespoke provider-state-to-`Agent` adapter proof, not the existing AG-UI reducer.

## Task 2: Adapter Boundary Decision

**Files:**
- Modify this plan or add contract notes if the decision is made before implementation.

- [ ] **Step 1: Choose package boundary**

Pick one:

- new published adapter package, if consumers should import it directly;
- private/internal adapter, if this is only a migration bridge;
- no code, if provider APIs are unstable or unavailable.

- [ ] **Step 2: Decide public API shape**

If public, mirror existing adapter ergonomics:

```ts
toAgent(source, options?)
provideAgent(configOrFactory)
injectAgent(ref?)
```

Use a provider-specific prefix internally if needed to avoid collisions with existing adapter types, but keep the consumer mental model aligned with AG-UI and LangGraph.

- [ ] **Step 3: Decide client-tools mapping**

Confirm whether provider tools are:

- backend/protocol tools only;
- browser-executed tools that can map to `ClientToolsCapability`;
- mixed.

Only map browser-executed tools into Threadplane `action`/`view`/`ask` when the provider supplies stable pending-call identifiers and a result-return API.

## Task 3: Contract Tests First

**Files:**
- Add: adapter conformance spec path TBD.
- Add: provider fake/test fixture path TBD.

- [ ] **Step 1: Build a scriptable provider fake**

Create a test-only fake from the captured event contract. It must support:

- deterministic event scripts;
- cancellable run cadence;
- message/tool history inspection;
- branch-on-tool-result behavior if the provider supports continuation.

- [ ] **Step 2: Write failing `Agent` conformance tests**

Cover:

- initial signal state;
- submit appends/sends user input as provider expects;
- run start/end update `status` and `isLoading`;
- text stream produces an assistant message;
- run error populates `error`;
- stop/abort settles without leaving loading true;
- retry does not duplicate the user message;
- regenerate trims at the selected assistant message and reruns;
- custom events flow through `events$` or adapter-specific signal if supported.

- [ ] **Step 3: Write client-tools bridge tests only if supported**

If provider has stable browser tool primitives, cover:

- catalog registration;
- pending projection;
- action result return;
- view auto-ack;
- ask result;
- M5 continuation policy interop through `<chat>`.

Do not implement client-tools mapping if the provider lacks stable tool-call IDs or result APIs.

## Task 4: Minimal Adapter Implementation

**Files:**
- Add/modify only after Tasks 1-3 pass their decision gates.

- [ ] **Step 1: Implement event reduction**

Prefer the AG-UI reducer path if compatible. Otherwise implement only the reducer cases proven by fixtures. Unknown events must be ignored or surfaced as neutral custom events; they must not crash the stream.

- [ ] **Step 2: Implement actions**

Map:

- `submit`;
- `stop`;
- `retry`;
- `regenerate`;

to provider APIs only where semantics match the existing `Agent` contract. Throwing is acceptable for programmer misuse, but normal unsupported provider features should be absent or no-op only if that matches existing adapter precedent.

- [ ] **Step 3: Add Angular provider wiring**

If public or DI-supported, mirror the existing typed `AgentRef` overloads and factory config pattern from AG-UI/LangGraph.

- [ ] **Step 4: Add public exports and docs only after approval**

If the adapter is public:

```bash
npm run generate-api-docs
```

Expected: generated API docs include the new bridge types. Commit generated docs with the public export.

## Task 5: Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run focused adapter tests**

Run the new adapter test target or focused Vitest spec.

- [ ] **Step 2: Run affected existing adapter/chat tests**

Run:

```bash
NX_DAEMON=false npx nx test ag-ui --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx test langgraph --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static
```

Expected: all pass. If the new bridge is in its own project, run its test/lint/build target as well.

- [ ] **Step 3: Lint and build affected projects**

Run the smallest affected Nx lint/build targets. If API docs changed, verify generated docs are committed.

- [ ] **Step 4: Forbidden-reference scan**

Before committing code, run a staged diff scan excluding `docs/superpowers/**` and confirm no forbidden external framework names appear in code, comments, commit text, or PR text.

- [ ] **Step 5: Diff audit**

Confirm the diff contains no unrelated refactors, no package dependency changes unless explicitly approved, and no behavior changes to existing AG-UI or LangGraph adapters.

---

## Current Recommendation

Stop after this discovery plan until the provider event contract is supplied. The spec explicitly defers M6 because the reducer-vs-bespoke-adapter choice depends on that event shape; implementing now would require guessing a public API and event reducer from absent inputs.
