"""Single-node-plus-tools streaming chat graph.

State the client may send via the LangGraph ``submit``'s ``state`` field:

  - ``model`` — OpenAI model name. Default: ``gpt-5-mini``.
  - ``reasoning_effort`` — 'minimal' | 'low' | 'medium' | 'high'.
                           Default: 'minimal' so first-token latency
                           stays low. Demos surface this as a palette
                           dropdown so users can dial in visible reasoning.

Topology:

  __start__ → generate ─┬─ [has tool_calls] ─→ tools ─→ generate (loop)
                        └─ [no tool_calls]  ─→ attach_citations ─→ generate_title ─→ __end__

The terminal ``attach_citations`` node walks back from the final AI
message to the most recent ToolMessage, parses its JSON content, and
replaces the AI message with one carrying ``additional_kwargs.citations``
populated. Uses RemoveMessage + AIMessage with the same id (standard
LangGraph in-place edit pattern), keeping the chat composition's
track-by-id stable.
"""
import json
import os
from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict, NotRequired

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph_sdk import get_client
from langsmith import traceable

from threadplane.middleware.langgraph import bind_client_tools, client_tool_names

from src.streaming.a2ui_partial_handler import A2uiPartialHandler
from src.streaming.envelope_tool import render_a2ui_surface
from src.streaming.envelope_normalizer import normalize_envelope_args
from src.schemas.a2ui_v1 import A2UI_V1_SCHEMA_PROMPT


_TITLE_PROMPT = (
    "In 3-5 words, summarize what the user is asking about. "
    "Output ONLY the title — no quotes, no period, no prefix."
)
_TITLE_MODEL = "gpt-5-mini"


@traceable(name="generate_title", run_type="tool")
async def generate_title(state: "State", config: RunnableConfig) -> dict:
    """Terminal side effect: generate and persist a short thread title.

    Idempotent — only writes when metadata.title is currently absent.
    Errors are NOT raised (title is a UX nicety, never a blocker) but
    ARE returned in the run output so LangSmith captures them — the
    bare `except Exception: return` previously hid a prod failure
    where every title write was throwing silently. The @traceable
    decorator creates a LangSmith child run with these outputs
    visible in the trace UI / runs API.
    """
    thread_id = (config.get("configurable") or {}).get("thread_id")
    # url=None lets the SDK use its in-process ASGI transport when the
    # call originates from inside a LangGraph server graph (which is
    # always the case here). The old fallback to http://localhost:2024
    # PREVENTED that path: it always forced an HTTP round-trip to a
    # port that doesn't exist on the prod runtime container (it does
    # locally because `langgraph dev` listens on 2024 — which is why
    # this only broke in prod). LANGGRAPH_API_URL is only honoured
    # when explicitly set, e.g. for cross-process callbacks.
    sdk_url = os.environ.get("LANGGRAPH_API_URL")
    if not isinstance(thread_id, str) or not thread_id:
        return {}

    try:
        client = get_client(url=sdk_url)
        thread = await client.threads.get(thread_id)
        existing = (thread.get("metadata") or {}).get("title")
        if isinstance(existing, str) and existing.strip():
            return {}

        # Find the first user message in the current state.
        first_user = None
        for m in state.get("messages", []):
            type_attr = getattr(m, "type", None)
            getter = getattr(m, "_getType", None)
            msg_type = type_attr if type_attr else (getter() if callable(getter) else None)
            if msg_type == "human":
                content = getattr(m, "content", None)
                if isinstance(content, str) and content.strip():
                    first_user = content
                    break
        if not first_user:
            return {}
        if first_user.lstrip().startswith("{"):
            return {}

        llm = ChatOpenAI(model=_TITLE_MODEL, temperature=0)
        response = await llm.ainvoke([
            SystemMessage(content=_TITLE_PROMPT),
            HumanMessage(content=first_user),
        ])
        title = (response.content or "").strip().strip('"').strip("'")[:80]
        if not title:
            return {}

        await client.threads.update(
            thread_id,
            metadata={"title": title},
        )
        return {}
    except Exception as e:  # noqa: BLE001 — title is a UX nicety; never block
        # Don't break the run, but DO surface the failure. A bare swallow
        # has hidden a prod bug where every title write was throwing
        # silently. The @traceable decorator captures this return dict in
        # the LangSmith run output (visible via /api/v1/runs/query) so we
        # can diagnose without needing platform stdout access.
        return {
            "error_type": type(e).__name__,
            "error_message": str(e),
            "sdk_url": sdk_url,
            "thread_id": thread_id,
        }


SYSTEM_PROMPT = (
    "You are a helpful, concise assistant. "
    "Format responses with markdown when useful (headings, lists, code blocks, tables). "
    "When the user asks about specific Angular topics or technical questions, "
    "use the `search_documents` tool to find authoritative information before answering. "
    "Cite sources inline using Pandoc-style citation references with the "
    "document `id` field as the refId, e.g. `[^ng-signals-overview]` or "
    "`[^ng-control-flow]`. Each first-use of a document gets an auto-numbered "
    "marker; subsequent references to the same document share the number. "
    "Do not write `[1]` or `[1, 2]` — those are plain text and won't link to "
    "the sources panel. "
    "When the user describes a sensitive or destructive action (deleting "
    "data, sending a customer email, modifying production state, etc.), "
    "call `request_approval` with a clear `reason` BEFORE doing the action. "
    "Do not assume permission. The human's response will tell you whether to "
    "proceed, modify, or stop. "
    "When the user asks for in-depth research on a focused topic (history, "
    "motivation, comparison, deep-dive on something they want explained), "
    "call the `research` tool to dispatch a subagent that focuses on that "
    "topic. Pass the topic verbatim or as a concise rephrasing, and pass "
    "`subagent_type=\"research\"` so the UI surfaces a subagent card while "
    "the child runs. Use the subagent's returned summary to compose your "
    "final answer. Do not call `research` for trivial chit-chat or simple "
    "lookups — those are handled by `search_documents`. "
    " "
    "If the user asks to see / build / render / show / display a UI, "
    "form, card, panel, button, picker, slider, table, list, or any "
    "other interactive surface — INCLUDING phrases like 'build me X', "
    "'render Y', 'show a Z', 'create a form for', 'make a card with' — "
    "you MUST IMMEDIATELY dispatch the schema-generation tool bound "
    "to the conversation. Exactly ONE such tool is bound per request: "
    "either `render_a2ui_surface` or `generate_json_render_spec`. "
    "Do NOT ask clarifying questions about platform, framework, fields, "
    "validation, styling, or anything else. Do NOT describe the UI in "
    "prose. Do NOT request more details from the user. The tool ITSELF "
    "is responsible for filling in reasonable defaults from the user's "
    "request. Pass the user's request VERBATIM as the `request` "
    "argument. Your only job for UI-rendering requests is to route "
    "them to the tool. After the tool returns its payload (a wire-"
    "format string the chat composition renders directly), respond with "
    "at most ONE short sentence acknowledging the dispatch — the user "
    "sees the rendered surface, not your prose. Examples of prompts "
    "that MUST dispatch the tool: 'build a feedback form', 'render a "
    "settings card', 'show me a poll', 'make a contact form'. If the "
    "user is having a casual conversation or asking factual questions, "
    "do NOT dispatch the UI tool — only dispatch when they explicitly "
    "ask for a UI / form / card / interactive surface."
)

_PLANNER_FRAMING = (
    "\n\n--- APP MODE: TRIP PLANNER ---\n"
    "You are a trip-planning assistant driving a live map cockpit. When the user "
    "asks for a plan, RECOMMEND concrete places (a short note each) grouped into "
    "days, and POPULATE the itinerary by calling `add_stop` for each recommendation "
    "(then `day_card` to recap a day). Revise with `move_stop`/`reorder_stop`/`clear_day`. "
    "Do NOT just describe the plan in prose — call the tools so the map and panel update. "
    "Only add stops that are not already present."
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


@tool
def request_approval(reason: str) -> str:
    """Pause and request the human's approval before performing a sensitive
    or destructive action. Provide a clear reason — the human will see it.
    Returns the human's decision verbatim; incorporate it into your next
    step.
    """
    response = interrupt({"type": "approval_request", "reason": reason})
    return f"Human response: {response}"


# Research subagent — a small compiled child graph the parent dispatches
# via the `research` @tool. Running it as an actual subgraph (vs. inline
# logic) is what causes LangGraph to emit stream events under namespace
# prefix `tools:<id>` for the child run, which is what the @threadplane/langgraph
# SubagentTracker keys on to populate `agent.subagents()`.
class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    topic: Optional[str]


async def research_node(state: ResearchState) -> dict:
    """Single-node child graph: focus on the topic, return a short brief.

    Uses gpt-5-mini directly (the parent's model selection does not
    propagate into the subagent — the subagent is a focused contractor).
    """
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


@tool
async def research(topic: str, subagent_type: str = "research") -> str:
    """Dispatch a research subagent to gather facts on a focused topic.
    The subagent returns a concise summary; pass that summary back to
    the user, citing it with the inline citation syntax if appropriate.

    `subagent_type` is a free-form label the parent uses to identify the
    subagent in the UI (the @threadplane/langgraph SubagentTracker keys on it
    to populate `agent.subagents()` for the chat-subagents primitive).
    Always pass a stable identifier like "research".
    """
    # subagent_type is intentionally accepted but unused server-side —
    # it travels in the tool call args so the SubagentTracker can
    # register the dispatch and surface a card while the child graph runs.
    del subagent_type
    result = await research_subgraph.ainvoke({"topic": topic, "messages": []})
    msgs = result.get("messages") if isinstance(result, dict) else None
    if not msgs:
        return "(no research returned)"
    last = msgs[-1]
    content = getattr(last, "content", None) if not isinstance(last, dict) else last.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        # ChatOpenAI may return content as list of blocks; collect text.
        parts = []
        for b in content:
            if isinstance(b, dict) and b.get("type") == "text":
                parts.append(b.get("text", ""))
        return "\n".join(parts) if parts else "(no research returned)"
    return "(no research returned)"


# Used by emit_generated_surface to prepend the chat composition's
# content-classifier sentinel for A2UI mode. The classifier triggers
# rendering when an AI message content begins with this prefix.
A2UI_PREFIX = "---a2ui_JSON---"


@tool
async def generate_json_render_spec(request: str) -> str:
    """Dispatch the json-render schema sub-agent to render a UI surface
    as a json-render Spec ({root, elements, state}). Use this when the
    user asks for UI/forms/cards and state.gen_ui_mode is 'json-render'.
    Pass the user's request verbatim as the `request` argument."""
    from src.schemas.json_render import JSON_RENDER_SCHEMA_PROMPT
    llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
    response = await llm.ainvoke([
        SystemMessage(content=JSON_RENDER_SCHEMA_PROMPT),
        HumanMessage(content=request),
    ])
    return _as_text(response.content).strip()


def _as_text(content) -> str:
    """Normalize a langchain message content to a plain string. ChatOpenAI
    may return content as either str or a list of typed blocks; this
    pulls the text out of either."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


class Stop(TypedDict):
    id: str
    day: int
    place: str
    note: NotRequired[str]
    lat: NotRequired[float]
    lng: NotRequired[float]


class State(TypedDict):
    messages: Annotated[list, add_messages]
    model: Optional[str]
    reasoning_effort: Optional[str]
    gen_ui_mode: Optional[str]
    # Frontend client-tool catalog. The @threadplane/langgraph SDK path
    # (mergeClientTools) sends the browser-declared tool stubs under
    # ``client_tools`` in the run payload; the threadplane-middleware
    # ``_catalog`` reads ``state["tools"]`` first and falls back to
    # ``state["client_tools"]`` — so this channel name feeds the middleware
    # directly with no normalization needed. The channel must exist here so
    # the catalog survives the generate → should_continue path.
    client_tools: Optional[list[dict]]
    # Trip itinerary the frontend client tools (add_stop/move_stop/...)
    # mutate. per-thread checkpoint; last-write-wins (plain key)
    itinerary: list[Stop]


def build_system_prompt(gen_ui_mode: str, client_tools: list, itinerary: list) -> str:
    system = SYSTEM_PROMPT
    if gen_ui_mode == "a2ui":
        system = system + "\n\n--- A2UI v1 SCHEMA ---\n" + A2UI_V1_SCHEMA_PROMPT + (
            "\n\nWhen rendering UI in a2ui mode, emit envelopes in this order: "
            "surfaceUpdate FIRST, then beginRendering, then any dataModelUpdate "
            "entries. This lets the client mount the surface as early as possible."
        )
    if client_tools:
        system = system + _PLANNER_FRAMING
        if itinerary:
            import json as _json
            system = system + (
                "\n\nCURRENT ITINERARY (do not re-add existing stops):\n"
                + _json.dumps(itinerary, ensure_ascii=False)
            )
    return system


async def generate(state: State, config: RunnableConfig) -> dict:
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
    # Pick the GenUI tool matching the user's palette dropdown. Only ONE
    # is bound per request so the parent LLM has a single, unambiguous
    # render tool to choose. ToolNode below is bound to BOTH so either
    # side of the conditional resolves at execution time.
    gen_ui_mode = state.get("gen_ui_mode") or "a2ui"
    gen_ui_tool = (
        render_a2ui_surface if gen_ui_mode == "a2ui"
        else generate_json_render_spec
    )
    # Note on strict mode: OpenAI strict tool binding requires every nested
    # object schema in the parameters tree to declare additionalProperties:
    # false. The envelope shape carries list[dict] for components/contents
    # (untyped inner objects), which strict mode rejects with a 400
    # ('additionalProperties is required to be supplied and to be false').
    # Typing the inner shapes would over-couple this example to the A2UI v1
    # spec; instead we leave strict OFF and rely on the envelope-args
    # normalizer (Python: src/streaming/envelope_normalizer.py; TS:
    # libs/chat/src/lib/a2ui/envelope-normalizer.ts) to canonicalize the
    # four observed argument shapes (envelopes / envelope / positional /
    # flat). The spike showed 80-93% canonical even without strict.
    # bind_client_tools appends the frontend client-tool catalog stubs (read
    # from state["client_tools"], sent by the @threadplane/langgraph SDK
    # mergeClientTools path) to the server tool list so the model can call any
    # browser-declared tool by name (add_stop/move_stop/clear_day/day_card).
    llm = bind_client_tools(
        ChatOpenAI(**kwargs),
        [search_documents, request_approval, research, gen_ui_tool],
        state,
    )
    # Append A2UI v1 schema to system prompt when in a2ui mode, so the parent
    # LLM knows how to construct the envelopes directly. When the frontend
    # client-tool catalog is present (App mode), also inject the trip-planner
    # framing + the current itinerary so the model populates state via the tools.
    system = build_system_prompt(
        gen_ui_mode=gen_ui_mode,
        client_tools=state.get("client_tools") or [],
        itinerary=state.get("itinerary") or [],
    )
    messages = [SystemMessage(content=system)] + state["messages"]
    # When in a2ui mode, attach the partial-envelope sideband handler so
    # the parent LLM's tool_call_chunks for render_a2ui_surface are
    # dispatched as a2ui-partial custom events (consumed by the frontend
    # partial-args bridge).
    callbacks = []
    if gen_ui_mode == "a2ui":
        callbacks.append(A2uiPartialHandler(tool_name="render_a2ui_surface"))
    response = await llm.ainvoke(messages, config={"callbacks": callbacks})
    return {"messages": [response]}


def should_continue(state: State) -> Literal["tools", "attach_citations"]:
    """Conditional edge from generate: route to the server ToolNode when any
    SERVER tool_call is present (GenUI tools, search, approval, research).

    A turn whose calls are ALL frontend client tools must END (route to the
    terminal attach_citations post-process) so the browser can execute them
    and re-run with the resulting ToolMessage — the server ToolNode has no
    implementation for client tools and would otherwise error. Turns with no
    tool calls also terminate at attach_citations (a no-op without search
    results). Mixed server+client turns keep the 'tools' route.
    """
    last = state["messages"][-1]
    if not (isinstance(last, AIMessage) and last.tool_calls):
        return "attach_citations"
    client = client_tool_names(state)
    if all(tc["name"] in client for tc in last.tool_calls):
        return "attach_citations"
    return "tools"


def after_tools(state: State) -> Literal["emit_generated_surface", "generate"]:
    """Conditional edge from tools: if the most recent ToolMessage came
    from a GenUI tool, route to emit_generated_surface (terminal
    post-process that wraps the sub-LLM payload). Otherwise loop back
    to generate so the parent LLM can incorporate the tool result."""
    msgs = state["messages"]
    # Find the most recent ToolMessage and its originating tool_call name
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    for tc in prior.tool_calls:
                        if tc.get("id") == m.tool_call_id and tc.get("name") in (
                            "render_a2ui_surface", "generate_json_render_spec",
                        ):
                            return "emit_generated_surface"
                    break
            break
    return "generate"


async def emit_generated_surface(state: State) -> dict:
    """Post-process for GenUI tool dispatches. Reads the most recent
    ToolMessage carrying the sub-LLM's wire-format payload, identifies
    which protocol the AI dispatched (by tool_call name), wraps the
    payload with the chat composition's content-classifier sentinel,
    emits a fresh AIMessage carrying the wrapped content, and REMOVES
    the AI tool-call message + ToolMessage from history so the chat UI
    doesn't render the raw schema JSON dump alongside the surface."""
    msgs = state["messages"]

    # Find the most recent ToolMessage + its originating AI tool-call message
    tool_msg = None
    ai_tool_call_msg = None
    tool_name = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            tool_msg = m
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    for tc in prior.tool_calls:
                        if tc.get("id") == tool_msg.tool_call_id:
                            tool_name = tc.get("name")
                            ai_tool_call_msg = prior
                            break
                    if tool_name:
                        break
            break

    if tool_msg is None or tool_name is None:
        return {}

    payload = tool_msg.content if isinstance(tool_msg.content, str) else ""
    if not payload:
        return {}

    if tool_name == "render_a2ui_surface":
        # Sub-LLM returns a JSON array of v1 envelopes. Convert to JSONL
        # (one envelope per line) and prepend the classifier sentinel.
        try:
            arr = json.loads(payload)
            if isinstance(arr, list):
                jsonl = "\n".join(json.dumps(env) for env in arr)
            else:
                jsonl = payload
        except json.JSONDecodeError:
            # Sub-LLM may have leading/trailing whitespace or markdown
            # fencing despite the prompt instructions. Try to strip.
            stripped = payload.strip()
            if stripped.startswith("```"):
                lines = stripped.split("\n")
                stripped = "\n".join(line for line in lines if not line.startswith("```"))
            try:
                arr = json.loads(stripped)
                jsonl = "\n".join(json.dumps(env) for env in arr) if isinstance(arr, list) else stripped
            except json.JSONDecodeError:
                arr = None
                jsonl = payload  # let the parser deal with malformed lines

        # Reorder envelopes so beginRendering lands in position 2 (right
        # after the first surfaceUpdate). The surface store gates surface
        # materialization on beginRendering; emitting it early lets the
        # frontend mount the (initially empty) surface and reveal per-
        # component fallbacks while dataModelUpdate envelopes flow.
        try:
            if isinstance(arr, list):
                surface_updates = [e for e in arr if isinstance(e, dict) and "surfaceUpdate" in e]
                begin_renderings = [e for e in arr if isinstance(e, dict) and "beginRendering" in e]
                data_updates = [e for e in arr if isinstance(e, dict) and "dataModelUpdate" in e]
                others = [
                    e for e in arr
                    if isinstance(e, dict)
                    and not ("surfaceUpdate" in e or "beginRendering" in e or "dataModelUpdate" in e)
                ]
                reordered = (
                    surface_updates
                    + (begin_renderings[:1] if begin_renderings else [])
                    + data_updates
                    + others
                    + begin_renderings[1:]
                )
                jsonl = "\n".join(json.dumps(env) for env in reordered)
        except (TypeError, AttributeError, NameError):
            # arr may be unbound or unexpected shape — fall back to existing jsonl.
            pass

        wrapped = A2UI_PREFIX + "\n" + jsonl + "\n"
    elif tool_name == "generate_json_render_spec":
        # json-render: classifier detects content starting with `{`, no
        # prefix needed. Strip whitespace and any markdown fencing the
        # sub-LLM may have included.
        stripped = payload.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            stripped = "\n".join(line for line in lines if not line.startswith("```"))
            stripped = stripped.strip()
        wrapped = stripped
    else:
        return {}

    # In-place replace the ToolMessage with a tiny "rendered" placeholder
    # (langgraph add_messages reducer matches by id and replaces). This
    # collapses the chat-tool-calls result panel from a multi-KB schema
    # dump to a single word. The AI tool-call message stays — its small
    # tool-call card chrome is fine. We append the wrapped surface
    # AIMessage as the final message; the chat composition's content
    # classifier picks up the prefix and mounts <a2ui-surface> /
    # <chat-generative-ui>.
    # In-place replacement: return an AIMessage with the SAME id as the
    # upstream tool-call AI. LangGraph's add_messages reducer matches by
    # id and replaces, so the thread carries ONE AI message per GenUI
    # turn (with both tool_calls AND the wrapped surface content)
    # instead of two — the user sees a single bubble that transforms
    # from skeleton to surface, not a skeleton bubble followed by a
    # separate surface bubble.
    out = []
    placeholder_kwargs = {
        "content": "rendered",
        "tool_call_id": tool_msg.tool_call_id,
    }
    if getattr(tool_msg, "id", None):
        placeholder_kwargs["id"] = tool_msg.id
    out.append(ToolMessage(**placeholder_kwargs))
    replacement_kwargs = {"content": wrapped}
    if ai_tool_call_msg is not None:
        if getattr(ai_tool_call_msg, "id", None):
            replacement_kwargs["id"] = ai_tool_call_msg.id
        replacement_kwargs["tool_calls"] = ai_tool_call_msg.tool_calls
        replacement_kwargs["additional_kwargs"] = ai_tool_call_msg.additional_kwargs or {}
        replacement_kwargs["response_metadata"] = ai_tool_call_msg.response_metadata or {}
    out.append(AIMessage(**replacement_kwargs))
    return {"messages": out}


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
                    # Only treat dicts that look like citation hits — must
                    # carry at least one of title/url/snippet. Skips unrelated
                    # JSON arrays (e.g. A2UI envelope arrays) that the
                    # search_documents tool would never produce.
                    if not any(k in h for k in ("title", "url", "snippet")):
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
_builder.add_node("tools", ToolNode([
    search_documents, request_approval, research,
    render_a2ui_surface, generate_json_render_spec,
]))
_builder.add_node("emit_generated_surface", emit_generated_surface)
_builder.add_node("attach_citations", attach_citations)
_builder.add_node("generate_title", generate_title)
_builder.set_entry_point("generate")
_builder.add_conditional_edges(
    "generate",
    should_continue,
    {
        "tools": "tools",
        "attach_citations": "attach_citations",
    },
)
_builder.add_conditional_edges(
    "tools",
    after_tools,
    {
        "emit_generated_surface": "emit_generated_surface",
        "generate": "generate",
    },
)
_builder.add_edge("emit_generated_surface", "generate_title")
_builder.add_edge("attach_citations", "generate_title")
_builder.add_edge("generate_title", END)

# LangGraph API manages persistence for the deployed graph; keep the
# exported graph free of a custom checkpointer.
graph = _builder.compile()
