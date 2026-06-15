# AG-UI Subagent Cards — Design (F5)

**Campaign:** AG-UI demo, Phase 4. Closes finding **F5** from `2026-06-11-ag-ui-capability-findings.md`.

**Status:** approved 2026-06-15.

## Problem

Over the AG-UI transport, a subagent delegation renders as a plain tool row — no `chat-subagent` card. The canonical LangGraph adapter populates `Agent.subagents` by keying on the LangGraph subgraph stream namespace (`tools:<tool_call_id>`). That namespace **does not survive the `ag_ui_langgraph` bridge**: the AG-UI wire protocol is flat (`TEXT_MESSAGE_*`, `TOOL_CALL_*`, `CUSTOM`, …) with no native subagent identity. Confirmed by reading the bridge (`ag_ui_langgraph/agent.py`): it tracks subgraph boundaries server-side only (to manage state/message snapshots) and emits nothing the client can key a subagent on.

The chat library already has everything it needs on the consumer side:
- `Agent.subagents?: Signal<Map<string, Subagent>>` (`libs/chat/src/lib/agent/agent.ts`) — optional, adapters that don't support it leave it undefined.
- `Subagent = { toolCallId, name?, status: Signal<SubagentStatus>, messages: Signal<Message[]>, state: Signal<Record<string, unknown>> }` (`libs/chat/src/lib/agent/subagent.ts`). `SubagentStatus = 'pending' | 'running' | 'complete' | 'error'`.
- `ChatSubagentsComponent` renders only `pending`/`running` subagents (name, status, message count + latest message content).

So the work is entirely in the **graph** (emit subagent identity/lifecycle as CUSTOM events) and the **`@threadplane/ag-ui` adapter** (fold those events into `Agent.subagents`). No chat-lib change.

## Decisions (settled in brainstorming)

- **Scope:** full parity — fix `examples/ag-ui` AND add a dedicated `cockpit/ag-ui/subagents` capability (registry + nav + aimock e2e + Railway deploy), mirroring `cockpit/chat/subagents`.
- **Fidelity:** live token streaming — the card's child text animates as the subagent's LLM thinks.
- **Event schema:** a single discriminated `subagent` CUSTOM event with a `phase` field (one reducer case, one docs entry), not three separate event names.

## Architecture

```
research child-subgraph LLM tokens
   │  (tapped by SubagentStreamHandler callback)
   ▼
get_stream_writer()({"name":"subagent","data":{...phase...}})   [graph]
   │  ag_ui_langgraph bridge → AG-UI CUSTOM event {name:"subagent", value:{...}}
   ▼
reducer 'CUSTOM' case, name==='subagent'  → store.subagents (Map of per-subagent signals)   [libs/ag-ui]
   ▼
toAgent exposes subagents: Signal<Map<string, Subagent>>
   ▼
ChatSubagentsComponent renders pending/running cards   [libs/chat — unchanged]
```

### 1. Event schema

CUSTOM event name `subagent`. On the wire (`ag_ui_langgraph` maps the writer's `data` → CUSTOM `value`), the reducer receives `{ name: "subagent", value: <payload> }`. Payload phases:

```jsonc
{ "tool_call_id": "<id>", "phase": "started",  "name": "research" }
{ "tool_call_id": "<id>", "phase": "message",  "delta": "<token text>" }
{ "tool_call_id": "<id>", "phase": "finished", "status": "complete" }   // status optional, defaults "complete"; "error" allowed
```

- `tool_call_id` keys the subagent (matches the neutral `Subagent.toolCallId`, and the parent tool call so the card associates with its tool row).
- `started` carries the human-readable `name`.
- `message` carries an incremental `delta` (mirrors `TEXT_MESSAGE_CONTENT`); the reducer accumulates it into the subagent's single assistant message.
- `finished` carries an optional terminal `status`.

### 2. Python graph emission

**New callback** `SubagentStreamHandler` (in `examples/ag-ui/python/src/streaming/`, mirroring `A2uiPartialHandler`'s `get_stream_writer()` usage). Constructed with `(tool_call_id, name)`. Overrides:
- `on_llm_start` → writer `{"name":"subagent","data":{"tool_call_id":id,"phase":"started","name":name}}`
- `on_llm_new_token(token)` → writer `{...,"phase":"message","delta":token}`
- `on_llm_end` → writer `{...,"phase":"finished","status":"complete"}`

Guard `get_stream_writer()` for `RuntimeError` (no writer outside a stream run) exactly like `A2uiPartialHandler`, so unit tests can mock the writer.

**`research` tool changes** (`examples/ag-ui/python/src/graph.py`):
- Add `tool_call_id: Annotated[str, InjectedToolCallId]` (from `langchain_core.tools`) so the tool knows its own id.
- Keep running the child as the compiled `research_subgraph` — subgraph isolation is what keeps the child's tokens OUT of the main assistant message over AG-UI. Attach `SubagentStreamHandler(tool_call_id, subagent_type)` via `config={"callbacks": [handler]}` on the subgraph invocation so the child LLM's tokens are tapped into `subagent` custom events.
- Return the final summary string unchanged (the orchestrator still cites it).

**Why a callback, not inline streaming:** running the child LLM directly with `.astream()` inside the ToolNode risks the bridge surfacing those tokens as main-thread `TEXT_MESSAGE_*` deltas. The subgraph + callback pattern is already proven for A2UI (`A2uiPartialHandler`) and keeps the child stream isolated.

### 3. `@threadplane/ag-ui` reducer + toAgent

**Store** (`libs/ag-ui/src/lib/reducer.ts`): add `store.subagents` — a `signal<Map<string, SubagentEntry>>` where

```ts
interface SubagentEntry {
  toolCallId: string;
  name?: string;
  status: WritableSignal<SubagentStatus>;
  messages: WritableSignal<Message[]>;   // single assistant message that grows
  state: WritableSignal<Record<string, unknown>>;
}
```

**Reducer `CUSTOM` case**, branch on `e.name === 'subagent'` (alongside the existing `on_interrupt` / `state_update` branches), reading `phase` from the parsed value:
- `started`: create a new entry with `status: signal('running')`, empty `messages`/`state`; set a **new Map reference** on `store.subagents` so `activeSubagents` recomputes (membership changed).
- `message`: look up entry by `tool_call_id`; append `delta` to its single assistant message's content via the inner `messages` signal (create the message on first delta). No Map-reference change needed — the card binds the inner signal directly. (Mirror the `TEXT_MESSAGE_CONTENT` accumulation logic.)
- `finished`: set the entry's `status` signal to `value.status ?? 'complete'`; replace the Map reference so `activeSubagents` drops it from the rendered (pending/running) set.

Unknown/missing `tool_call_id` on `message`/`finished` → ignore safely (defensive, like other reducer guards).

**`toAgent`** (`libs/ag-ui/src/lib/to-agent.ts`): expose `subagents` on the returned `AgUiAgent`, projecting `store.subagents()` to `Map<string, Subagent>` (the entries already hold neutral-shaped signals, so projection is a shallow map — like langgraph's `toSubagent`). Reset `store.subagents` to an empty Map on `RUN_STARTED` (new run starts clean), consistent with how `customEvents` is reset.

### 4. Cockpit `ag-ui/subagents` capability

New standalone capability (cockpit-examples-standalone rule: **duplicate, never import across examples**). Mirror the file layout of `cockpit/ag-ui/streaming/` for the AG-UI scaffold (server.py, project.json, pyproject.toml, vercel.json, proxy.conf.mjs, angular app, e2e harness) and the orchestrator/`task`-tool shape of `cockpit/chat/subagents/python/src/graph.py` for the subagent logic — but emit `subagent` custom events via the `SubagentStreamHandler` (copied into this capability's `python/src/streaming/`).

- **Registry:** add to `apps/cockpit/scripts/capability-registry.ts`:
  `{ id: 'ag-ui-subagents', product: 'ag-ui', topic: 'subagents', angularProject: 'cockpit-ag-ui-subagents-angular', port: 4326, pythonPort: 5326, pythonDir: 'cockpit/ag-ui/subagents/python' }` (4326/5326 are the next free ag-ui ports).
- **Nav/website:** register in the cockpit capability modules + website/docs nav the same way the ag-ui product was wired in Phase 1 (the registry drives most of it; verify the capability appears in the matrix).
- **Deploy:** regenerate the Railway bundle — `npx tsx scripts/generate-ag-ui-deployment-config.ts`, commit `deployments/ag-ui-dev/` drift, and confirm the proxy (`scripts/ag-ui-proxy.ts`) routes the new topic. This is the same machinery #664 resynced.

### 5. Angular app component

The cockpit `subagents.component.ts` hosts `<chat [agent]="agent">` with `injectAgent()` from `@threadplane/ag-ui` (no extra wiring — `chat` renders `chat-subagents` automatically when `agent.subagents` is populated). `examples/ag-ui` needs no app change: the shell already hosts `<chat>` and the welcome chips already include "Research subagent".

## Testing

- **`libs/ag-ui` reducer unit tests (TDD):** `subagent` started/message/finished → correct `subagents` Map; status lifecycle `running`→`complete`; delta accumulation into one growing message; two concurrent subagents keyed independently; `RUN_STARTED` resets; defensive ignore of unknown `tool_call_id`.
- **`SubagentStreamHandler` unit test (python):** mock `get_stream_writer`, assert started/message/finished writes with correct payloads (mirror the `A2uiPartialHandler` test).
- **examples/ag-ui e2e (aimock):** research prompt → a subagent card appears in `running`, accumulates streamed text, settles to `complete` (card leaves the active set). Fixture captures the `subagent` custom events.
- **cockpit `ag-ui/subagents` e2e (aimock):** capability-specific spec + fixture, mirroring `cockpit/chat/subagents` assertions adapted to the AG-UI transport.
- **Live-LLM Chrome smoke** before merge (real backend) and **post-merge production** (`ag-ui.threadplane.ai` + the cockpit deployment) — the live smoke is the gate that caught F3/F4 issues the stub harness missed.

## Risks

- **Token leak into main message:** if the child stream isn't fully isolated, child tokens could appear in the main assistant bubble. Mitigation: keep the compiled subgraph (proven isolation) + the callback-tap pattern; the examples e2e asserts the main bubble does NOT contain the child's research text.
- **Deploy drift / Railway redeploy** (Section 4): same friction as #664. Treat the deployment regen as its own task with a post-merge deploy verification; expect a possible drift-guard resync.
- **`InjectedToolCallId` availability:** confirm the installed `langchain_core` version exposes it (it's used widely; verify during T-graph).

## Out of scope (logged follow-ups, not this spec)

- Residual NG0956 during json-render spec assembly.
- a2ui icon catalog support (`trending_up` rendered as text).
- Multi-message subagents (the research subagent returns one message; the design supports one growing assistant message per subagent — multiple distinct child messages would need a message-id in the `message` phase, deferred until a capability needs it).
