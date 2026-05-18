"""Multi-node LangGraph graph for the airline operations KPI dashboard.

Flow:
  router → generate_shell (first turn) or plan_tools (follow-up)
  → call_tools → emit_state → respond
"""

import json
from pathlib import Path
from typing import Annotated, Literal

import uuid
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langgraph.types import Command

from src.dashboard_tools import ALL_TOOLS

_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()

_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True)

# Dedicated planner: full gpt-5 with minimal reasoning effort.
# gpt-5-mini at default reasoning ignores the "EXACTLY ONE tool" directive
# in plan_tools and reflexively calls all four data tools on every
# follow-up — verified in chrome MCP after PR #363 tightened the prompt
# but the model still over-called. Bumping the planner to gpt-5 sharpens
# instruction-following, and reasoning_effort='minimal' suppresses the
# "let me be thorough" deliberation that drives the fan-out.
_planner_llm = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
)
_llm_with_tools = _planner_llm.bind_tools(ALL_TOOLS)


class DashboardState(MessagesState):
    """Extended state that persists the dashboard spec across turns."""
    dashboard_spec: str | None


def router(state: DashboardState) -> Command[Literal["generate_shell", "plan_tools"]]:
    """Route based on whether a dashboard spec already exists."""
    if state.get("dashboard_spec") is None:
        return Command(goto="generate_shell")
    return Command(goto="plan_tools")


async def generate_shell(state: DashboardState) -> Command[Literal["populate_initial_data"]]:
    """Generate the dashboard shell spec on first turn, then dispatch to
    deterministic data-population (skipping plan_tools, which has a
    follow-up-only prompt)."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm.ainvoke(messages)
    spec_text = response.content if isinstance(response.content, str) else ""
    return Command(
        goto="populate_initial_data",
        update={"messages": [response], "dashboard_spec": spec_text},
    )


async def plan_tools(state: DashboardState) -> DashboardState:
    """On follow-up turns, pick the MINIMAL set of tools — usually one."""
    context = (
        f"The current dashboard spec is:\n{state['dashboard_spec']}\n\n"
        "The user has sent a follow-up. Classify and act ONCE — DO NOT ask\n"
        "clarifying questions. Pick the smallest action that satisfies the\n"
        "request and commit to it.\n"
        "\n"
        "1) FILTER / SCOPE (e.g. 'filter to cancelled flights only', 'last 6\n"
        "   months', 'top 3'): call EXACTLY ONE tool — the one that backs the\n"
        "   affected component — with the new parameters. Do NOT call the\n"
        "   other tools. Do NOT regenerate the spec.\n"
        "\n"
        "2) STRUCTURAL change (e.g. 'add a card for X', 'remove the table'):\n"
        "   regenerate the spec, then call only the tools needed to populate\n"
        "   NEW components.\n"
        "\n"
        "3) INTERPRETIVE question that no tool could answer (e.g. 'why is\n"
        "   on-time % low?', 'what does this mean?'): respond in plain prose,\n"
        "   call NO tools. Use this ONLY when no tool fetch could resolve the\n"
        "   question. If a tool could provide more data to help answer, pick\n"
        "   case 1 or 2 instead.\n"
        "\n"
        "Anti-patterns to avoid:\n"
        "  - Asking 'would you also like…' or any clarifying question.\n"
        "    Commit to the most reasonable interpretation and act.\n"
        "  - Calling all four tools. That is reserved for an explicit\n"
        "    'refresh' / 'reload everything' request.\n"
        "  - Responding conversationally when the request mentions filtering,\n"
        "    sorting, or scoping. Those are case 1, always."
    )
    messages = [SystemMessage(content=_PROMPT + "\n\n" + context)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


async def populate_initial_data(state: DashboardState) -> dict:
    """Deterministic first-turn data fetch: invoke all 4 data tools.

    The dashboard prompt mandates 'call ALL four data tools to populate the
    dashboard' on first turn. That's a fixed instruction, not a judgment
    call — encode it as Python instead of paying an LLM round-trip + risking
    the planner refusing to commit to tool calls.

    Synthesizes one AIMessage with tool_calls for all 4 tools + one
    ToolMessage per result. Matches ToolNode's output shape so emit_state
    (which reads ToolMessages by name) needs no changes.
    """
    tool_calls = [
        {
            "name": t.name,
            "args": {},
            "id": f"init_{t.name}_{uuid.uuid4().hex[:8]}",
            "type": "tool_call",
        }
        for t in ALL_TOOLS
    ]
    ai = AIMessage(content="", tool_calls=tool_calls)

    tool_msgs: list[ToolMessage] = []
    for t, tc in zip(ALL_TOOLS, tool_calls):
        result = await t.ainvoke({})
        content = json.dumps(result) if not isinstance(result, str) else result
        tool_msgs.append(ToolMessage(content=content, tool_call_id=tc["id"], name=t.name))

    return {"messages": [ai] + tool_msgs}


def should_call_tools(state: DashboardState) -> Literal["call_tools", "respond"]:
    """Check if the last message has tool calls."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "call_tools"
    return "respond"


async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from tool results.

    Uses LangGraph 1.x's `get_stream_writer()` — `adispatch_custom_event`
    no longer flows into the `custom` stream channel. The chat-lib bridge
    parses the payload as `{name: 'state_update', data: <patches>}`.
    """
    from langgraph.config import get_stream_writer

    tool_results = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_airline_kpis":
                # data is {"on_time": {"value": ..., "delta": ...}, ...}
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_on_time_trend":
                tool_results["/on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                tool_results["/flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                tool_results["/recent_disruptions"] = data
        elif msg.type == "ai":
            break

    if tool_results:
        # The chat-lib bridge (stream-manager.bridge.ts handles the 'custom'
        # case) parses `eventData['name']` for routing and `eventData['data']`
        # for payload; chat.component.ts then forwards data to
        # signal-state-store.update() which expects flat Record<jsonPointer, value>.
        writer = get_stream_writer()
        writer({"name": "state_update", "data": tool_results})

    return state


async def respond(state: DashboardState) -> DashboardState:
    """Generate a brief conversational summary of what just happened on this
    turn. ALWAYS runs (no early-exit) so the user-visible summary is always
    authored by this node, never inherited from plan_tools' chatter."""
    messages = [
        SystemMessage(content=(
            "Provide a brief (1-2 sentence) conversational summary of what "
            "you just did this turn. If you generated a dashboard, say so. "
            "If you filtered data, say what you filtered. "
            "Do NOT output JSON. Do NOT ask follow-up questions."
        ))
    ] + state["messages"]
    response = await _llm.ainvoke(messages)
    return {"messages": [response]}


_builder = StateGraph(DashboardState)
_builder.add_node("router", router)
_builder.add_node("generate_shell", generate_shell)
_builder.add_node("populate_initial_data", populate_initial_data)
_builder.add_node("plan_tools", plan_tools)
_builder.add_node("call_tools", ToolNode(ALL_TOOLS))
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("router")

# First-turn deterministic path: generate_shell returns Command(goto=populate_initial_data),
# so no explicit edge needed from generate_shell. populate_initial_data goes to emit_state.
_builder.add_edge("populate_initial_data", "emit_state")

# Follow-up path: plan_tools may call tools (→ call_tools) or commit to prose (→ respond)
_builder.add_conditional_edges("plan_tools", should_call_tools)

# Tool calling flow (follow-up path)
_builder.add_edge("call_tools", "emit_state")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
