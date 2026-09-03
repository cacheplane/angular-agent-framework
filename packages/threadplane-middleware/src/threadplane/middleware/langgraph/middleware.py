"""client-tools middleware: bind client-declared tool stubs and route their
calls to END so the browser executes them and re-runs with a ToolMessage."""
from __future__ import annotations
from typing import Any, Iterable


def _catalog(state: dict) -> list[dict]:
    raw = state.get("tools")
    if not raw:
        raw = state.get("client_tools")
    return [t for t in (raw or []) if isinstance(t, dict) and t.get("name")]


def client_tool_specs(state: dict) -> list[dict]:
    """The client catalog as OpenAI function-tool dicts for ``llm.bind_tools``.

    Each entry in ``state["tools"]`` (or ``state["client_tools"]`` as a
    fallback) is converted to the explicit
    ``{"type": "function", "function": {...}}`` form that is accepted by
    ``ChatOpenAI(...).bind_tools([...])`` regardless of LangChain version.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("parameters", {}) or {},
            },
        }
        for t in _catalog(state)
    ]


def client_tool_names(state: dict) -> set[str]:
    """Return the set of tool names declared by the client in this run."""
    return {t["name"] for t in _catalog(state)}


def _tool_calls(message: Any) -> list:
    tc = (
        message.get("tool_calls")
        if isinstance(message, dict)
        else getattr(message, "tool_calls", None)
    )
    return list(tc or [])


def _call_name(call: Any) -> str | None:
    if isinstance(call, dict):
        return call.get("name") or (call.get("function") or {}).get("name")
    return getattr(call, "name", None)


def last_message(state: dict) -> Any:
    """Return the last message from ``state["messages"]``, or None."""
    msgs = state.get("messages") or []
    return msgs[-1] if msgs else None


def has_client_tool_call(state: dict) -> bool:
    """True if the last message calls at least one tool that is a client tool."""
    names = client_tool_names(state)
    return any(_call_name(c) in names for c in _tool_calls(last_message(state)))


def has_server_tool_call(state: dict, server_tool_names: Iterable[str]) -> bool:
    """True if the last message calls at least one server (non-client) tool.

    A call is treated as a server call when its name appears in
    ``server_tool_names`` OR when its name is not a known client tool name
    (unknown tools are assumed to be server-side).
    """
    server = set(server_tool_names)
    client = client_tool_names(state)
    for c in _tool_calls(last_message(state)):
        n = _call_name(c)
        if n in server or (n is not None and n not in client):
            return True
    return False


def bind_client_tools(llm: Any, server_tools: list, state: dict) -> Any:
    """Bind server tools + the client catalog stubs onto ``llm``.

    Call this *inside* the agent node (per-run) because the client catalog
    arrives in state and may differ between runs.

    Example::

        def agent_node(state):
            bound = bind_client_tools(base_llm, SERVER_TOOLS, state)
            response = bound.invoke(state["messages"])
            return {"messages": [response]}
    """
    return llm.bind_tools([*server_tools, *client_tool_specs(state)])


def a2ui_client_capabilities(state: dict) -> dict | None:
    """Read the A2UI client capabilities advertised by the frontend.

    ``@threadplane/langgraph`` merges them into run payloads under the
    ``a2ui_client_capabilities`` state key when the host configures
    ``a2uiClientCapabilities`` on the agent. Returns the capabilities dict
    (``{"supportedCatalogIds": [...], "inlineCatalogs": [...]}``) or ``None``
    when the client did not advertise any — use it to gate A2UI emission or
    pick a catalog the renderer actually supports::

        caps = a2ui_client_capabilities(state)
        if caps and BASIC_CATALOG_ID in caps.get("supportedCatalogIds", []):
            ...emit A2UI envelopes...
    """
    caps = state.get("a2ui_client_capabilities")
    return caps if isinstance(caps, dict) else None


def route_after_agent(
    state: dict,
    server_tool_names: Iterable[str],
    *,
    tools_node: str = "tools",
    end: str = "__end__",
) -> str:
    """Routing helper to call from a LangGraph conditional edge.

    Returns:
        ``tools_node`` when the last message contains a server tool call
        (so LangGraph dispatches to the server-side ToolNode).
        ``end`` when the last message contains only client tool calls
        (the browser executes the call; map ``end`` to LangGraph's ``END``).
        ``end`` when the last message has no tool calls at all.

    Note: this helper is LangGraph-free — it returns plain strings so callers
    can map the return value to ``END`` themselves::

        from langgraph.graph import END
        graph.add_conditional_edges(
            "agent",
            lambda s: route_after_agent(s, ["search"]),
            {"tools": "tools", "__end__": END},
        )
    """
    if has_server_tool_call(state, server_tool_names):
        return tools_node
    return end

def announce_subagent(config: Any, tool_call_id: str) -> bool:
    """Bind this tool call's child-graph stream to its tool-call id, for UIs.

    LangGraph streams a child graph invoked inside a ``@tool`` body under a
    ``tools:<uuid>`` namespace, where the uuid is a *checkpoint* id assigned
    independently of the tool-call id — nothing on the wire links the two. A
    frontend showing per-subagent progress therefore has to guess which stream
    belongs to which call, which is unsound the moment two children run at
    once.

    Inside the tool body both halves are known: the namespace is the config's
    ``checkpoint_ns`` and the tool-call id arrives via
    ``InjectedToolCallId``. This helper emits them as one custom event::

        from typing import Annotated
        from langchain_core.runnables import RunnableConfig
        from langchain_core.tools import InjectedToolCallId, tool

        @tool
        async def task(
            description: str,
            tool_call_id: Annotated[str, InjectedToolCallId] = None,
            config: RunnableConfig = None,
        ) -> str:
            announce_subagent(config, tool_call_id)
            result = await child_graph.ainvoke({...})
            ...

    ``@threadplane/langgraph`` recognizes the event and attributes the child's
    stream deterministically, before any tokens arrive.

    Returns ``True`` if the event was emitted, ``False`` when anything needed
    is unavailable (no stream writer outside a run, no namespace at the top
    level, missing tool_call_id) — callers never need to guard it.
    """
    if not tool_call_id:
        return False
    namespace = None
    if isinstance(config, dict):
        for section in ("metadata", "configurable"):
            raw = config.get(section)
            if isinstance(raw, dict) and raw.get("checkpoint_ns"):
                namespace = raw["checkpoint_ns"]
                break
    if not namespace:
        return False
    try:
        from langgraph.config import get_stream_writer

        writer = get_stream_writer()
        writer(
            {
                "type": "threadplane.subagent_binding",
                "namespace": namespace,
                "tool_call_id": tool_call_id,
            }
        )
        return True
    except Exception:
        return False
