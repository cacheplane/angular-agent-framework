"""Single-node-plus-tools streaming chat graph.

State the client may send via the LangGraph ``submit``'s ``state`` field:

  - ``model`` — OpenAI model name. Default: ``gpt-5-mini``.
  - ``reasoning_effort`` — 'minimal' | 'low' | 'medium' | 'high'.
                           Default: 'minimal' so first-token latency
                           stays low. Demos surface this as a palette
                           dropdown so users can dial in visible reasoning.

Topology:

  __start__ → generate ─┬─ [has tool_calls] ─→ tools ─→ generate (loop)
                        └─ [no tool_calls]  ─→ attach_citations ─→ __end__

The terminal ``attach_citations`` node walks back from the final AI
message to the most recent ToolMessage, parses its JSON content, and
replaces the AI message with one carrying ``additional_kwargs.citations``
populated. Uses RemoveMessage + AIMessage with the same id (standard
LangGraph in-place edit pattern), keeping the chat composition's
track-by-id stable.
"""
import json
from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool


SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables). "
    "When the user asks about specific Angular topics or technical questions, "
    "use the `search_documents` tool to find authoritative information before answering, "
    "and cite the sources inline using [1], [2], etc."
)

# Reasoning-capable model prefixes. We only attach the ``reasoning``
# parameter when the model name suggests reasoning support; setting it
# on a non-reasoning model would be ignored anyway.
REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(name: str) -> bool:
    return any(name.startswith(p) for p in REASONING_PREFIXES)


# Hardcoded corpus for the search_documents tool. Five Angular topics
# that align with the demo's existing welcome suggestions. Deterministic;
# no external API calls; no API keys required.
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


class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]


async def generate(state: State) -> dict:
    model_name = state.get("model") or "gpt-5-mini"
    kwargs = {"model": model_name, "streaming": True}
    if _is_reasoning_model(model_name):
        # Honor the client's effort selection when present; default to
        # 'minimal' so first-token latency stays low for unconfigured callers.
        effort = state.get("reasoning_effort") or "minimal"
        # `summary='auto'` instructs the OpenAI Responses API to emit
        # summary text inside the reasoning block (otherwise the block
        # arrives with an empty `summary: []` and the chat UI has nothing
        # to render). The adapter's `extractReasoning` reads either the
        # legacy `block.text` field or the modern `block.summary[].text`.
        kwargs["reasoning"] = {"effort": effort, "summary": "auto"}
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents])
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    response = await llm.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    """Conditional edge: route from generate to either the tools node
    (when the AI emitted tool_calls) or the terminal attach_citations
    post-process."""
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "attach_citations"


async def attach_citations(state: State) -> dict:
    """Terminal post-process: walk back from the final AI message to
    the most recent ToolMessage, parse its JSON content, and replace
    the AI message with one carrying additional_kwargs.citations.

    Returns an empty dict (no state update) when there is no preceding
    ToolMessage to draw citations from. The AI message is left as-is
    in that case — citations are an opt-in surface, not required.
    """
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


_builder = StateGraph(State)
_builder.add_node("generate", generate)
_builder.add_node("tools", ToolNode([search_documents]))
_builder.add_node("attach_citations", attach_citations)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {"tools": "tools", "attach_citations": "attach_citations"},
)
_builder.add_edge("tools", "generate")
_builder.add_edge("attach_citations", END)

# LangGraph API manages persistence for the deployed graph; keep the
# exported graph free of a custom checkpointer.
graph = _builder.compile()
