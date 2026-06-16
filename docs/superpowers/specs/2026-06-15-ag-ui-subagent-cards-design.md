# AG-UI Subagent Cards — Design (F5)

**Campaign:** AG-UI demo, Phase 4. Closes finding **F5** from `2026-06-11-ag-ui-capability-findings.md`.

**Status:** approved 2026-06-15 (native-ACTIVITY architecture).

## Problem

Over the AG-UI transport, a subagent delegation renders as a plain tool row — no `chat-subagent` card. The canonical LangGraph adapter keys on the LangGraph subgraph stream namespace (`tools:<tool_call_id>`), which **does not survive the `ag_ui_langgraph` bridge** (the bridge tracks subgraph boundaries server-side only, for state/message snapshots, and emits nothing the client can key a subagent on).

The chat library already has the consumer contract:
- `Agent.subagents?: Signal<Map<string, Subagent>>` (`libs/chat/src/lib/agent/agent.ts`), optional.
- `Subagent = { toolCallId, name?, status: Signal<SubagentStatus>, messages: Signal<Message[]>, state: Signal<Record<string, unknown>> }` (`libs/chat/src/lib/agent/subagent.ts`). `SubagentStatus = 'pending' | 'running' | 'complete' | 'error'`.
- `ChatSubagentsComponent` renders only `pending`/`running` subagents. **No chat-lib change.**

## Decision: speak the protocol natively (ACTIVITY), not a private CUSTOM convention

`@threadplane/ag-ui` is a **transport library**; the example + cockpit are **reference producers**. The wire should be valid, idiomatic AG-UI so that *any* compliant server emitting subagent activity lights up our cards — not only servers that adopt a private `{name:"subagent"}` CUSTOM blob (which is lock-in by construction).

AG-UI's native primitive for "a typed, identified, incrementally-streamed sub-process" is **ACTIVITY**:
- `ACTIVITY_SNAPSHOT = { messageId, activityType: string, content: Record, replace? }`
- `ACTIVITY_DELTA   = { messageId, activityType: string, patch: JsonPatch[] }`
- (plus an `activity` message role)

`SubAgentInfo`/`MultiAgentCapabilities.subAgents` is only a *static capability descriptor* (`{name, description?}` for agent-picker UIs) — not a runtime carrier. So **`activityType: "subagent"`** over ACTIVITY is the correct native representation. The **envelope** (identity via `messageId`, snapshot/delta semantics, typing) is native and reusable; the **semantics** (`activityType` value + `content` schema) are our convention because AG-UI defines ACTIVITY generically and has not standardized a subagent activity type — if it does later, we adopt by changing one string.

**Scope decision (brainstorming):** build the generic ACTIVITY infrastructure and use it for subagents now. Existing CUSTOM events (`state_update`, `on_interrupt`, `a2ui-partial`) stay on CUSTOM — migrating them to native (`STATE_*`, HITL, `TOOL_CALL_ARGS`) is a **separate follow-up brainstorm** (those paths are load-bearing with their own e2e; not destabilized in this PR). No backwards-compat is kept for subagents — the reducer consumes ACTIVITY only.

**Fidelity (brainstorming):** live token streaming — the card's child text animates as the subagent's LLM thinks.

## Architecture — three clean layers

```
research child-subgraph LLM token
  │ (tapped by SubagentStreamHandler callback)
  ▼  get_stream_writer()({"name":"subagent_activity","data":{phase,...}})         [Layer 3: graph]
  │  ag_ui_langgraph bridge → CUSTOM{name:"subagent_activity", value}
  ▼  ActivityEmittingAgent.run() wraps super().run(): CUSTOM(subagent_activity)
  │  → ACTIVITY_SNAPSHOT / ACTIVITY_DELTA  (drops the CUSTOM)                       [Layer 2: owned server transform]
  ▼  wire: native AG-UI ACTIVITY events
  │  reducer ACTIVITY_SNAPSHOT/DELTA → generic activities store → subagent projection  [Layer 1: libs/ag-ui]
  ▼  toAgent.subagents: Signal<Map<string, Subagent>>
  ▼  ChatSubagentsComponent renders pending/running cards                          [libs/chat — unchanged]
```

### Layer 1 — Library consumer (`libs/ag-ui`): native ACTIVITY → `Agent.subagents`

**Generic activities store** in `ReducerStore` (`libs/ag-ui/src/lib/reducer.ts`):
```ts
interface ActivityEntry {
  messageId: string;
  activityType: string;
  content: WritableSignal<Record<string, unknown>>;
}
activities: WritableSignal<Map<string, ActivityEntry>>;   // keyed by messageId
```

**Two new reducer cases** (generic — not subagent-specific):
- `ACTIVITY_SNAPSHOT`: upsert entry for `messageId`. If new, create with `content: signal(snapshot.content)` and set a **new Map reference** (membership change). If existing, `replace ? set(content) : merge`.
- `ACTIVITY_DELTA`: look up entry; apply the JSON-patch (`patch`) to a clone of `content()` and set the inner `content` signal (live update, no Map churn). Use a tiny RFC-6902 `applyPatch` helper (add/replace/remove are all we emit; keep it minimal and tested). Unknown `messageId` → ignore.
- Reset `activities` to empty Map on `RUN_STARTED` (clean slate, like `customEvents`).

**Subagent projection** on `toAgent` (`libs/ag-ui/src/lib/to-agent.ts`), exposing `subagents: Signal<Map<string, Subagent>>`:
- Filter activities to `activityType === 'subagent'`. For each, produce a `Subagent` keyed by `content.toolCallId ?? messageId`:
  - `status`: `computed(() => entry.content()['status'] ?? 'running')`
  - `messages`: `computed(() => [{ id: messageId, role: 'assistant', content: String(entry.content()['text'] ?? '') }])`
  - `state`: `computed(() => (entry.content()['state'] as Record) ?? {})`
  - `name`: `content.name`.
- **Stable identity:** cache the `Subagent` wrapper per `messageId` (rebuild the outer Map only when activity membership changes) so `chat-subagents` (tracks by `toolCallId`) doesn't churn. Mirror the langgraph adapter's `toSubagent` stability pattern.

This layer is generic: a future `activityType` (plan, progress, tool-trace) reuses the activities store; only its own projection/renderer is new.

### Layer 2 — Producer transport adapter (owned, server-side): subagent intent → ACTIVITY

The bridge maps generic `get_stream_writer` writes to **CUSTOM** and only special-cases its own reserved names (`manually_emit_message/tool_call/state`, `exit`) — there is **no** reserved name for activities. So we own the conversion.

**Primary seam — override `_dispatch_event` (1:1 event transform).** Every event the bridge produces passes through `LangGraphAgent._dispatch_event(self, event) -> event` (synchronous, returns one event; called as `yield self._dispatch_event(SomeEvent(...))`). This is the natural place to convert a reserved custom event into a typed event. New `ActivityEmittingAgent(LangGraphAgent)` (in the example's `python/src/streaming/`, duplicated into the cockpit capability):
```python
class ActivityEmittingAgent(LangGraphAgent):
    def _dispatch_event(self, event):
        activity = subagent_custom_to_activity(event)   # pure fn, unit-tested; None if not ours
        return super()._dispatch_event(activity if activity is not None else event)
    # clone() returns Self via the base impl (constructs type(self)(...)); override only if
    # the spike shows it drops the subclass.
```
`subagent_custom_to_activity(event)` is a **pure, stateless 1:1** function: returns `None` for any event except `CUSTOM{name:"subagent_activity"}`; for those it maps `phase` → one ACTIVITY event (replacing the CUSTOM):
- `started` → `ACTIVITY_SNAPSHOT(messageId=subagent_id, activityType="subagent", content={toolCallId, name, status:"running", text:""}, replace=True)`
- `message` → `ACTIVITY_DELTA(messageId=subagent_id, activityType="subagent", patch=[{op:"replace", path:"/text", value:<text_so_far>}])`
- `finished` → `ACTIVITY_DELTA(... patch=[{op:"replace", path:"/status", value:<status>}])`

Statelessness is possible because **the handler sends accumulated `text_so_far`** (Layer 3), exactly as `A2uiPartialHandler` sends `args_so_far` — JSON-patch has no string-append op, so each DELTA carries the full text via `replace`. No server-side buffer.

`server.py` swaps `LangGraphAgent(...)` → `ActivityEmittingAgent(...)` in the `add_langgraph_fastapi_endpoint(...)` call. This module is the natural future home for CUSTOM→native migrations.

**Fallback seam** (if the spike shows custom events don't flow through `_dispatch_event` in our bridge version, or `clone()` drops the subclass): override `async def run()` to wrap `super().run()` and map events on the way out — same pure `subagent_custom_to_activity` function, applied in the async loop.

### Layer 3 — Reference graph (example + cockpit): emit the intent

- `research` tool gains `tool_call_id: Annotated[str, InjectedToolCallId]`. Keep the child as the compiled `research_subgraph` (subgraph isolation keeps child tokens out of the main bubble). The tool emits `started` before invoking and `finished` after; a `SubagentStreamHandler(tool_call_id)` attached via `config={"callbacks":[...]}` emits a `message` per child token.
- The handler **accumulates** tokens into a per-id buffer and sends `text_so_far` (the full accumulated text) on each `message` (parallels `A2uiPartialHandler`'s `args_so_far`) — this is what lets Layer 2's transform stay stateless.
- **Emission API (T1 spike finding):** emit via `await adispatch_custom_event("subagent_activity", {"subagent_id": tool_call_id, "phase": ..., "text": <text_so_far>, ...})` (from `langchain_core.callbacks`), **not** `get_stream_writer`. The installed `ag_ui_langgraph` bridge drives the graph with `astream_events` and converts `on_custom_event` callbacks into AG-UI `CUSTOM` events at `_dispatch_event`; `get_stream_writer` writes the `custom` stream which this bridge surfaces only as a RAW `on_chain_stream` (never reaching the seam). Confirmed empirically in the T1 seam test.
- Applied to `examples/ag-ui/python/src/graph.py` and the new cockpit capability graph (standalone copies — never share across examples).

## Cockpit `ag-ui/subagents` capability + wiring

New standalone capability mirroring `cockpit/ag-ui/streaming/`'s scaffold and `cockpit/chat/subagents/`'s orchestrator/`task` shape, emitting subagent activity via Layers 2+3.
- **Registry** (`apps/cockpit/scripts/capability-registry.ts`): `{ id: 'ag-ui-subagents', product: 'ag-ui', topic: 'subagents', angularProject: 'cockpit-ag-ui-subagents-angular', port: 4326, pythonPort: 5326, pythonDir: 'cockpit/ag-ui/subagents/python' }` (4326/5326 next free).
- **Nav/website:** registry-driven; verify it appears in the cockpit capability matrix + docs nav.
- **Deploy:** `npx tsx scripts/generate-ag-ui-deployment-config.ts`; commit `deployments/ag-ui-dev/` drift; confirm `scripts/ag-ui-proxy.ts` routes the topic. Same machinery #664 resynced — its own task + post-merge deploy verification.

## Angular app

Cockpit `subagents.component.ts` hosts `<chat [agent]="agent">` with `injectAgent()` from `@threadplane/ag-ui` — `chat` renders `chat-subagents` automatically once `agent.subagents` is populated. `examples/ag-ui` needs no app change (shell already hosts `<chat>`; welcome chips already include "Research subagent").

## Testing

- **`libs/ag-ui` reducer unit (TDD):** `ACTIVITY_SNAPSHOT` creates entry; `ACTIVITY_DELTA` patch applies (replace `/text`, `/status`); `activityType:"subagent"` projects to a `Subagent` with correct toolCallId/name/status/messages; live text accumulation; two concurrent subagents keyed independently; stable subagent identity across deltas; `RUN_STARTED` resets; unknown `messageId` ignored. Plus `applyPatch` helper unit tests.
- **Layer-2 transform unit (python):** `subagent_custom_to_activity` (pure, stateless 1:1) — started→`ACTIVITY_SNAPSHOT`, message(`text_so_far`)→`ACTIVITY_DELTA`(replace `/text`), finished→`ACTIVITY_DELTA`(replace `/status`); returns `None` for any non-`subagent_activity` event. Plus `ActivityEmittingAgent._dispatch_event` returns the converted ACTIVITY for our events and passes everything else through unchanged.
- **`SubagentStreamHandler` unit (python):** mock `get_stream_writer`, assert it accumulates tokens and emits growing `text_so_far` per `message`, with buffer isolation across two `subagent_id`s (mirror `A2uiPartialHandler` test).
- **examples/ag-ui e2e (aimock):** research prompt → subagent card appears `running`, accumulates streamed text, settles `complete` (leaves active set); main bubble does NOT contain the child research text (isolation assertion). Fixture captures ACTIVITY events.
- **cockpit `ag-ui/subagents` e2e (aimock):** capability spec + fixture, mirroring `cockpit/chat/subagents` adapted to AG-UI.
- **Live-LLM Chrome smoke** before merge (real backend) + **production** after deploy (`ag-ui.threadplane.ai` + cockpit). The live smoke is the gate that caught F3/F4 issues the stub harness missed; here it verifies real ACTIVITY events flow end-to-end (the Layer-2 transform especially).

## Risks

- **Layer-2 interposition** (load-bearing): the primary seam is overriding `LangGraphAgent._dispatch_event(self, event) -> event` (every produced event passes through it; the endpoint does `async for event in request_agent.run(...)` after `agent.clone()`). **De-risk first** with a spike (T1): confirm (a) our `subagent_activity` CUSTOM events actually flow through `_dispatch_event`, and (b) `clone()` preserves the subclass (the base `clone()` returns `Self`). Fallbacks if not: override `run()` to wrap `super().run()`, or mount a custom route that wraps `agent.run()` and encodes SSE directly — same pure transform either way.
- **Token leak into main message:** keep the compiled subgraph (proven isolation) + callback tap; the examples e2e asserts the main bubble excludes child text.
- **Deploy drift / Railway redeploy:** same friction as #664; isolated task + post-merge verification.
- **`InjectedToolCallId` availability:** confirm in the installed `langchain_core` (used widely; verify in the graph task).

## Out of scope (logged follow-ups)

- **CUSTOM→native migration** of `state_update`/`on_interrupt`/`a2ui-partial` (separate brainstorm; the Layer-2 module is where they'd land).
- Residual NG0956 during json-render spec assembly; a2ui icon catalog support.
- Multi-message subagents (current research subagent returns one growing message; multiple distinct child messages would extend `content` to a messages array — deferred until a capability needs it).
