# Canonical `examples/chat` Demo — Phase 2B: Tool Calls + Citations

**Date:** 2026-05-08
**Status:** Approved
**Phase:** 2B of the canonical demo roadmap
**Builds on:** Phase 1 (PR #213) + Phase 2A reasoning (PR #216) + smoke fix PRs #217 #218 #219

## Goal

Layer tool calls and citations onto the canonical demo by extending the python graph from a single-node `__start__ → generate → __end__` to a ReAct-style loop with a dedicated tool node and a citation post-process step. Add one welcome suggestion that triggers the tool, exercising both surfaces in a single user interaction.

## Why these two together

The Phase 2A spec deferred 2B to bundle these features because they share infrastructure: citations naturally flow from a search-style tool's results, and both require the same graph topology change (tool node + conditional edge). Splitting them would force tool calls to land first with no citations, then citations to arrive with awkward retro-fitting onto an existing tool. Doing both at once keeps the demo flow honest: one search-tool execution produces both a visible tool-call card and a sources panel.

The Angular UI surface needs no changes:

- `<chat-tool-calls>` is already auto-rendered inside `<chat>` (line 154 of `libs/chat/src/lib/compositions/chat/chat.component.ts`). Groups consecutive same-name calls; renders each as `<chat-tool-call-card>` with running/complete/error pill states. Existing chat-0.0.19 spec.
- `<chat-citations>` is already auto-rendered under each `<chat-message>` (line 31 of `libs/chat/src/lib/primitives/chat-message/chat-message.component.ts`). Reads `Message.citations`. Existing chat-0.0.21 spec.
- The `@ngaf/langgraph` adapter already populates `Message.toolCalls` from `tool_calls` on AI messages and `tool` messages by `tool_call_id` (verified via `getToolCallsWithResults` and the existing test "derives toolCalls$ from AI tool calls and matching tool messages").
- The `@ngaf/langgraph` adapter already populates `Message.citations` from `additional_kwargs.citations` / `additional_kwargs.sources` (verified via `extractCitations` in `libs/langgraph/src/lib/internals/extract-citations.ts`).

So Phase 2B is mostly Python-side. The implementation surface is ~120 LOC.

## Reference research

**CopilotKit** (`packages/runtime/src/agents/langgraph/event-source.ts`) wires tool calls via explicit `ActionExecutionStart` / `ActionExecutionArgs` / `ActionExecutionEnd` events emitted from their LangGraph event source — same pattern as their text events. Their downstream consumers accumulate args deltas into a final tool call. The @ngaf/langgraph adapter takes a different path: reads `tool_calls` directly off the LangChain SDK's message stream and uses `getToolCallsWithResults` to pair them. We don't mirror their approach — the existing adapter logic works.

**Hashbrown** (`packages/core/src/utils/assistant-message.ts`) uses OpenAI chat-completion-style tool-call deltas (each chunk carries partial tool_call args that get JSON-concatenated). Different protocol; doesn't apply to LangGraph-mediated flows.

Both reference libraries solve the SAME problem with delta protocols — they don't influence the @ngaf approach beyond confirming that the adapter's existing tool-call merge logic is sound.

## Python graph: from single-node to ReAct + post-process

### Topology

```
__start__ → generate ──┬─ [has tool_calls] ──→ tools ──→ generate (loop)
                       └─ [no tool_calls]  ──→ attach_citations ──→ __end__
```

Standard LangGraph ReAct pattern with one extra terminal node (`attach_citations`) that walks back from the final AI message, finds the most recent `ToolMessage`, parses its JSON content, and replaces the AI message with one that has `additional_kwargs.citations` populated.

### Hardcoded document corpus

Five documents about Angular topics the existing welcome suggestions touch on. No external API calls; deterministic; no API keys needed; demo is reproducible.

```python
DOCUMENTS = [
    {
        "id": "ng-signals-overview",
        "title": "Signals — Angular guide",
        "url": "https://angular.dev/guide/signals",
        "snippet": "Signals are a reactivity primitive that lets you describe values that change over time without manual subscriptions.",
    },
    {
        "id": "ng-signals-rxjs",
        "title": "RxJS interop with signals",
        "url": "https://angular.dev/guide/signals/rxjs-interop",
        "snippet": "toSignal() and toObservable() bridge between RxJS Observables and signals.",
    },
    {
        "id": "ng-control-flow",
        "title": "Built-in control flow — @if, @for, @switch",
        "url": "https://angular.dev/guide/templates/control-flow",
        "snippet": "Native template control flow replaces structural directives like *ngIf and *ngFor with built-in syntax.",
    },
    {
        "id": "ng-standalone",
        "title": "Standalone components",
        "url": "https://angular.dev/guide/components/importing",
        "snippet": "Standalone components, directives, and pipes import their dependencies directly without NgModules.",
    },
    {
        "id": "ng-zoneless",
        "title": "Zoneless change detection",
        "url": "https://angular.dev/guide/experimental/zoneless",
        "snippet": "provideExperimentalZonelessChangeDetection lets Angular run without zone.js by tracking signals and async state directly.",
    },
]
```

### `search_documents` tool

```python
import json
from langchain_core.tools import tool

@tool
def search_documents(query: str) -> str:
    """Search the corpus for documents relevant to the query.

    Returns a JSON list of hits, each with id, title, url, snippet.
    Up to 4 hits are returned. If the query has no matches, returns
    the first 3 documents as a fallback so the demo always has
    something to cite.
    """
    q = (query or "").lower()
    hits = [
        d
        for d in DOCUMENTS
        if q in (d["title"] + " " + d["snippet"]).lower()
    ]
    if not hits:
        hits = DOCUMENTS[:3]
    return json.dumps(hits[:4])
```

### `generate` node binds tools

The existing `generate` function gets one line modified — `bind_tools` on the LLM:

```python
async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        effort = state.get("reasoning_effort") or "minimal"
        kwargs["reasoning"] = {"effort": effort, "summary": "auto"}
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents])
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}
```

The system prompt grows by one paragraph encouraging the model to use the search tool when the user asks about Angular topics:

```python
SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables). "
    "When the user asks about specific Angular topics or technical questions, "
    "use the `search_documents` tool to find authoritative information before answering, "
    "and cite the sources inline using [1], [2], etc."
)
```

### `should_continue` conditional edge

```python
from typing import Literal
from langchain_core.messages import AIMessage

def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "attach_citations"
```

### `tools` node — `langgraph.prebuilt.ToolNode`

```python
from langgraph.prebuilt import ToolNode

# In the graph builder:
builder.add_node("tools", ToolNode([search_documents]))
```

### `attach_citations` post-process

Walks back from the most recent message to find the latest `ToolMessage` batch. Parses its JSON content. Replaces the final AI message with a new one carrying `additional_kwargs.citations` via `RemoveMessage` + `AIMessage` with the same id (standard LangGraph pattern for in-place edits).

```python
import json
from langchain_core.messages import AIMessage, ToolMessage, RemoveMessage

async def attach_citations(state: State) -> dict:
    msgs = state["messages"]
    last = msgs[-1]
    if not isinstance(last, AIMessage) or last.tool_calls:
        return {}

    citations = []
    for m in reversed(msgs[:-1]):
        if isinstance(m, ToolMessage):
            try:
                hits = json.loads(m.content) if isinstance(m.content, str) else []
            except json.JSONDecodeError:
                continue
            if isinstance(hits, list):
                for i, h in enumerate(hits):
                    if not isinstance(h, dict):
                        continue
                    citations.append(
                        {
                            "id": h.get("id") or f"c{i+1}",
                            "index": i + 1,
                            "title": h.get("title"),
                            "url": h.get("url"),
                            "snippet": h.get("snippet"),
                        }
                    )
            break  # only the most recent ToolMessage batch
        elif isinstance(m, AIMessage):
            break

    if not citations:
        return {}

    new_kwargs = dict(getattr(last, "additional_kwargs", {}) or {})
    new_kwargs["citations"] = citations
    return {
        "messages": [
            RemoveMessage(id=last.id),
            AIMessage(
                id=last.id,
                content=last.content,
                additional_kwargs=new_kwargs,
                tool_calls=getattr(last, "tool_calls", []) or [],
                response_metadata=getattr(last, "response_metadata", {}) or {},
            ),
        ]
    }
```

### Graph wiring

```python
builder = StateGraph(State)
builder.add_node("generate", generate)
builder.add_node("tools", ToolNode([search_documents]))
builder.add_node("attach_citations", attach_citations)
builder.set_entry_point("generate")
builder.add_conditional_edges(
    "generate",
    should_continue,
    {"tools": "tools", "attach_citations": "attach_citations"},
)
builder.add_edge("tools", "generate")
builder.add_edge("attach_citations", END)

graph = builder.compile()
```

The existing `state.reasoning_effort` flow is preserved — the kwargs passed to `ChatOpenAI` are unchanged outside the `bind_tools` addition.

## Pytest smokes

`examples/chat/python/tests/test_graph_smoke.py` gains two assertions. No live-LLM tests — the existing tokens-free CI policy stays:

```python
@pytest.mark.smoke
def test_state_graph_has_tools_and_attach_citations_nodes():
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "generate" in nodes
    assert "tools" in nodes
    assert "attach_citations" in nodes


@pytest.mark.smoke
def test_search_documents_tool_returns_json():
    import json
    from src.graph import search_documents
    result = search_documents.invoke({"query": "signals"})
    assert isinstance(result, str)
    parsed = json.loads(result)
    assert isinstance(parsed, list)
    assert len(parsed) > 0
    assert "title" in parsed[0]
    assert "url" in parsed[0]
```

## Demo welcome suggestion

`examples/chat/angular/src/app/modes/welcome-suggestions.ts` gains one entry. The label hints what the prompt exercises:

```ts
{
  label: 'What are Angular signals? (search + cite sources)',
  value:
    'Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them. Cite your sources inline using [1], [2] etc.',
},
```

The list grows from 6 entries to 7. Existing 6 untouched.

## CHECKLIST.md

Populate the empty `## Tool calls` and `## Citations` sections in `examples/chat/smoke/CHECKLIST.md`. The Phase 1 `## Reasoning blocks` template populated in PR #216 is the model:

```markdown
## Tool calls

- [ ] Click "What are Angular signals? (search + cite sources)" welcome suggestion
- [ ] During streaming: a tool-call card appears for `search_documents` with a running pill
- [ ] After tool completes: card collapses to "complete" pill
- [ ] Click the card — args + result panels expand
- [ ] AI response references documents inline (e.g. "Signals are... [1]")

## Citations

- [ ] Sources panel ("Sources") renders below the assistant message
- [ ] 3-5 citations listed with title, url, snippet preview
- [ ] Inline `[1]`, `[2]` markers in the message body link to the corresponding source
- [ ] Click a source title — opens the URL in a new tab
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows the AI message has `additional_kwargs.citations` with the list
```

Other Phase 2+ section headings remain empty pending later phases (interrupts, subagents, generative UI, time travel, multi-thread).

## Files touched

| Path | Change |
|---|---|
| `examples/chat/python/src/graph.py` | +1 corpus const, +1 tool, +`should_continue`, +`attach_citations`, +graph topology change, system prompt extended (~80 LOC) |
| `examples/chat/python/tests/test_graph_smoke.py` | +2 smoke tests |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | +1 entry |
| `examples/chat/smoke/CHECKLIST.md` | populate Tool calls + Citations sections |

Total ≈ 120 LOC (mostly Python).

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (4 pytest), `nx run examples-chat-angular:test/lint/build`.
3. Server-side probe (curl): submit the Angular-signals welcome prompt with model=gpt-5-mini, observe a `ToolMessage` in thread history followed by an AI message with `additional_kwargs.citations` populated with 3-5 entries.
4. Local visual smoke (Chrome MCP): tool-call card renders with status pill that flips running → complete; sources panel renders below the response with 3-5 entries; inline `[1]`, `[2]` markers in the response body.

## Out of scope (defer)

- **Custom `chatToolCallTemplate` per-tool rendering.** The default card is fine for the demo. Polish round in a later phase.
- **Real RAG / vector search.** Hardcoded corpus deterministic. Real RAG belongs in a separate example (e.g. `examples/rag-chat`).
- **Multi-tool workflows.** One tool covers both surfaces. Adding more tools (`get_weather`, `calculator`) is an additive demo enhancement, not a fix.
- **Multi-batch citation accumulation.** `attach_citations` only walks back to the most recent ToolMessage. If the AI calls `search_documents` twice in one turn, only the latest batch becomes citations. Acceptable for the demo.
- **Inline-citation hover / scroll-to-source affordance.** Existing primitives don't do this. Out of scope.
- **Phase 3 features:** interrupts, subagents, time travel, multi-thread.

## Risks

- **Reasoning + tool calls interaction.** `bind_tools` AND `reasoning.effort` should coexist — the OpenAI API supports it. If the smoke surfaces a conflict, fall back to disabling reasoning when tools are bound. Mitigation: the server-side probe in Definition-of-Done step 3 confirms both work together; the welcome suggestion uses gpt-5-mini at default `minimal` effort, so reasoning isn't stressed.
- **Tool-call card rendering edge cases.** The chat composition's `<chat-tool-calls>` already has its own tests; trust that surface. Any rendering bug surfaced in live smoke gets filed against `libs/chat` separately, not as a Phase 2B blocker.
- **Citation extraction edge cases.** `extractCitations` already handles strings, dicts with various key spellings, and missing fields; we ship hits with the canonical `id/title/url/snippet` shape so this stays well-trodden territory.
- **`bind_tools` may serialize the tool spec in a way that exceeds the model's token budget.** Single tool with one string arg is well below any model's tool budget. Not a concern here.
- **The `RemoveMessage + AIMessage with same id` pattern in `attach_citations`.** This is documented LangGraph behaviour for in-place edits; the chat composition's track-by-id stays stable. Tested indirectly via the existing 0.0.29 regenerate path which uses the same RemoveMessage shape.
