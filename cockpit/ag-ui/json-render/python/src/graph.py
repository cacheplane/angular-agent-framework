"""Minimal json-render slice: proves spec-in-content + data-in-state over AG-UI.

Replaced by the full dashboard port in a later task. The agent calls
render_spec once (a single stat card bound to /demo/value); wrap_spec_into_ai
puts the spec JSON into AI message content; emit_state returns the demo data
into graph state so ag-ui-langgraph emits STATE_SNAPSHOT.
"""
import json
from pathlib import Path
from typing import Optional
from typing_extensions import TypedDict, Annotated

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

_PROMPT = (Path(__file__).parent.parent / "prompts" / "json-render.md").read_text()


class DashboardState(TypedDict):
    messages: Annotated[list, add_messages]
    demo: Optional[dict]


@tool
async def render_spec(elements: dict, root: str) -> str:
    """Render a dashboard layout. See system prompt for the catalog."""
    return json.dumps({"elements": elements, "root": root})


_TOOLS = [render_spec]
_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=True).bind_tools(_TOOLS)


async def agent(state: DashboardState) -> dict:
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    return {"messages": [await _llm.ainvoke(messages)]}


def route(state: DashboardState) -> str:
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else "emit_state"


async def wrap_spec_into_ai(state: DashboardState) -> dict:
    msgs = state["messages"]
    tool_msg = next((m for m in reversed(msgs)
                     if isinstance(m, ToolMessage) and m.name == "render_spec"), None)
    if tool_msg is None:
        return {}
    parent = next((m for m in reversed(msgs)
                   if isinstance(m, AIMessage) and m.tool_calls
                   and any(tc.get("id") == tool_msg.tool_call_id for tc in m.tool_calls)), None)
    if parent is None or (isinstance(parent.content, str) and parent.content.strip()):
        return {}
    payload = tool_msg.content if isinstance(tool_msg.content, str) else ""
    out = [
        ToolMessage(content="rendered", tool_call_id=tool_msg.tool_call_id, name="render_spec",
                    **({"id": tool_msg.id} if getattr(tool_msg, "id", None) else {})),
        AIMessage(content=payload.strip(), tool_calls=parent.tool_calls,
                  **({"id": parent.id} if getattr(parent, "id", None) else {})),
    ]
    return {"messages": out}


async def emit_state(state: DashboardState) -> dict:
    # Seed demo data into graph state → STATE_SNAPSHOT carries it to the client.
    return {"demo": {"value": 42, "delta": "+1.0"}}


_b = StateGraph(DashboardState)
_b.add_node("agent", agent)
_b.add_node("tools", ToolNode(_TOOLS))
_b.add_node("wrap_spec_into_ai", wrap_spec_into_ai)
_b.add_node("emit_state", emit_state)
_b.set_entry_point("agent")
_b.add_conditional_edges("agent", route, {"tools": "tools", "emit_state": "emit_state"})
_b.add_edge("tools", "wrap_spec_into_ai")
_b.add_edge("wrap_spec_into_ai", "agent")
_b.add_edge("emit_state", END)
graph = _b.compile(checkpointer=MemorySaver())
