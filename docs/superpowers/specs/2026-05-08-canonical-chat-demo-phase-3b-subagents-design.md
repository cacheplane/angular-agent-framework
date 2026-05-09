# Canonical `examples/chat` Demo — Phase 3B: Subagents

**Date:** 2026-05-08
**Status:** Approved
**Phase:** 3B of the canonical demo roadmap (orthogonal to 3A)
**Builds on:** Phase 1 (PR #213) + Phase 2A (PR #216) + Phase 2B (PR #220) + smoke fix PRs #217 #218 #219 #221 + Phase 3A (PRs #222 #223)

## Goal

Layer subagents onto the canonical demo by adding a compiled child graph (`research`) the parent LLM can dispatch as a tool. Surface running and completed subagents in the demo shell via the existing `<chat-subagents>` composition. Add one welcome suggestion that exercises the flow.

## Why split from 3A

Phase 3 covers two roadmap items: interrupts and subagents. They are orthogonal — different graph patterns, different UI primitives, different risk profiles. 3A shipped tool-driven HITL on top of the existing `tools` ToolNode. 3B introduces a child graph nested inside the same ToolNode. Splitting follows the 2A→2B cadence: smaller individually-shippable units, easier review, separately validatable in live smoke before stacking the next change.

## Scope

Tool-driven subagent dispatch — the parent AI decides when to delegate by calling the `research` tool. The tool body invokes a compiled child `StateGraph` via `await subgraph.ainvoke(...)` so LangGraph emits stream events with namespace prefix `tools:<id>` for the child run. The `@ngaf/langgraph` adapter's `SubagentTracker` keys on that prefix and on tool calls whose name appears in `subagentToolNames`, so registering `['research']` populates `agent.subagents()` automatically. The frontend mounts `<chat-subagents>` (read-only display) above the chat input.

## Approaches considered

- **Multiple subagents (research + summarize + cite)** — Richer demo but ~250 LOC and multi-PR territory. Rejected: YAGNI for a primitive showcase.
- **Plain `@tool` returning a synthesized "subagent" payload** — Simpler graph code but does not exercise the SubagentTracker code path: no `tools:` namespace events get emitted because no subgraph runs. The card would render empty. Rejected.
- **Single compiled child graph (chosen)** — One `research` subagent built as a small `StateGraph` with its own ChatOpenAI node. The parent calls it via a `@tool` body that awaits the compiled subgraph. Selected because it actually drives the tracker, mirrors the real-world subagent shape, and stays under 100 LOC.

## Python graph

### `research` subagent (child graph)

A two-line StateGraph: a single `research_node` invokes ChatOpenAI with a focused system prompt, then ends. Compiled at module load and held in a module-level constant.

```python
class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    topic: Optional[str]


async def research_node(state: ResearchState) -> dict:
    topic = state.get("topic") or ""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    system = SystemMessage(content=(
        "You are a focused research subagent. Given a topic, return a "
        "concise factual summary (3-6 bullets). Do not ask the user "
        "questions; the parent agent already gathered the topic."
    ))
    user = HumanMessage(content=f"Topic: {topic}")
    response = await llm.ainvoke([system, user])
    return {"messages": [response]}


_research_builder = StateGraph(ResearchState)
_research_builder.add_node("research_node", research_node)
_research_builder.set_entry_point("research_node")
_research_builder.add_edge("research_node", END)
research_subgraph = _research_builder.compile()
```

### `research` tool exposed to the parent

```python
@tool
async def research(topic: str) -> str:
    """Dispatch a research subagent to gather facts on a focused topic.
    The subagent returns a concise summary; pass that summary back to
    the user, citing it with the inline citation syntax if appropriate."""
    result = await research_subgraph.ainvoke({"topic": topic, "messages": []})
    last = result["messages"][-1] if result.get("messages") else None
    return last.content if last else "(no research returned)"
```

### Wiring

Three edits to the parent graph in `examples/chat/python/src/graph.py`:

1. Import `HumanMessage` from `langchain_core.messages` (already present for `SystemMessage`/`AIMessage` siblings).
2. Add the `ResearchState` TypedDict + `research_node` + compiled `research_subgraph` near the top of the module (after the `DOCUMENTS` corpus).
3. Add `research` to the parent's tool list:
   - `bind_tools([search_documents, request_approval, research])`
   - `ToolNode([search_documents, request_approval, research])`
4. Extend `SYSTEM_PROMPT` with one paragraph instructing the parent to dispatch `research` for in-depth topic questions.

No new graph edges or nodes at the parent level — the existing `tools` ToolNode handles dispatch.

## Angular wiring

### Adapter config

In `examples/chat/angular/src/app/shell/demo-shell.component.ts` (the call site of the `agent({...})` factory at line 84), add `subagentToolNames: ['research']` to the options object. This single configuration knob tells `SubagentTracker` to treat `research` tool calls as subagent dispatches and to materialize `agent.subagents()` from the resulting `tools:<id>`-namespaced stream events.

### Shell mount

`demo-shell.component.html` adds one block adjacent to the existing interrupt-panel block:

```html
@if (agent.subagents && agent.subagents().size > 0) {
  <div class="demo-shell__subagents" role="region" aria-label="Active subagents">
    <chat-subagents [agent]="agent" />
  </div>
}
```

`demo-shell.component.css` adds a fixed-position rule mirroring `.demo-shell__interrupt-panel` (positioned above the chat input, z-index just under the interrupt panel, max-width 640px). The two never coexist in practice (an interrupt fires only mid-tool-call; subagents render once the parent has emitted a tool_call but before tool result lands), but stacking is well-defined.

### Welcome suggestion

Append to `welcome-suggestions.ts`:

```ts
{
  label: 'Demo: dispatch a research subagent',
  value:
    'Use the research subagent to investigate the history and motivation behind Angular standalone components, then report back with a concise summary.',
}
```

## TDD

`examples/chat/python/tests/test_graph_smoke.py` adds two tests:

1. `test_research_tool_exists` — imports the module, asserts `research` is in the tools bound to the parent and that `research_subgraph` is a compiled `Graph`.
2. `test_state_graph_topology_unchanged` — already added in 3A; extend to assert the parent ToolNode binds three tools (`search_documents`, `request_approval`, `research`).

Both tests run via the existing pytest harness; no new test infrastructure.

## Verification

### Server-side probe

Curl `POST /threads/{tid}/runs/stream` with the research prompt; expect:
- A parent `messages` event with a `tool_call` to `research`.
- One or more `messages` / `updates` events whose namespace prefix is `tools:<id>` (the child subgraph emitting state).
- A parent `messages` event after the subagent returns, carrying the synthesized summary.

### Live smoke

Reload the demo in Chrome. Click the new welcome suggestion. Expect:
- `<chat-subagents>` mounts with one subagent card while the child runs.
- The card surfaces the subagent's status (running → done) per `SubagentTracker` state.
- Once the subagent returns, the parent AI emits its final summary message; the card remains in "done" state.
- No interaction is required — the card is read-only in 3B (Phase 4 may add interactivity).

## Out of scope (deferred)

- **Subagent interactivity** — clicking into a card to expand its message stream. The current `<chat-subagent-card>` is a read-only summary; deeper drill-in is a Phase 4+ concern.
- **Multiple parallel subagents** — the demo dispatches one at a time. The tracker supports many; richer demos belong in a later phase.
- **Subagent-level interrupts** — the `research` subagent does not call `interrupt()`. Composing 3A + 3B (parent dispatches subagent that itself requests approval) is technically supported by both layers but unnecessary for this demo.

## Files touched

| File | Change |
|---|---|
| `examples/chat/python/src/graph.py` | Add `ResearchState`, `research_node`, `research_subgraph`, `research` tool; extend `bind_tools` + `ToolNode` + `SYSTEM_PROMPT`. |
| `examples/chat/python/tests/test_graph_smoke.py` | Two new tests (or extend existing topology test). |
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | Add `subagentToolNames: ['research']` to the `agent({...})` options. |
| `examples/chat/angular/src/app/shell/demo-shell.component.html` | `@if` block mounting `<chat-subagents>`. |
| `examples/chat/angular/src/app/shell/demo-shell.component.css` | `.demo-shell__subagents` positioning rule. |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | One new entry. |
| `examples/chat/smoke/CHECKLIST.md` | Populate the Subagents section. |

Total ≈ 90 LOC.

## Phasing for the implementation plan

- Phase 0 — Branch creation
- Phase 1 — Python graph: TDD (failing `research_tool_exists` + topology regression) → implement subgraph + tool + bind to parent + system prompt → tests pass
- Phase 2 — Angular adapter config: `subagentToolNames: ['research']`
- Phase 3 — Angular shell wiring: `<chat-subagents>` import + `@if` block + CSS positioning
- Phase 4 — Welcome suggestion entry
- Phase 5 — CHECKLIST.md (Subagents section)
- Phase 6 — Verification (server-side probe confirming `tools:`-namespaced events) + PR
