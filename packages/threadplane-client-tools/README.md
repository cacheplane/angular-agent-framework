# threadplane-client-tools

LangGraph middleware for binding client-declared tool stubs and routing
client tool calls to `END` so the browser executes them.

## How it works

When a browser client sends a tool catalog (`{name, description, parameters}`
dicts) along with a run request, the graph can expose those tools to the LLM
and route their calls back to the browser instead of executing them
server-side. The browser then executes the call and re-runs the graph with a
`ToolMessage` carrying the result.

The catalog is read from `state["tools"]`, falling back to
`state["client_tools"]` if `tools` is absent.

## Installation

```bash
pip install threadplane-client-tools
```

## Usage

```python
from langgraph.graph import END, StateGraph
from threadplane.client_tools import bind_client_tools, route_after_agent

# Server-side tools your graph owns
SERVER_TOOLS = [search_tool, calculator_tool]
base_llm = ChatOpenAI(model="gpt-4o")

def agent_node(state):
    # bind_client_tools must be called per-run inside the node because
    # the client catalog arrives in state and may differ between runs.
    llm = bind_client_tools(base_llm, SERVER_TOOLS, state)
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def router(state):
    # Returns "tools" for server tool calls, "__end__" otherwise.
    # Map "__end__" to LangGraph's END in add_conditional_edges.
    return route_after_agent(state, [t.name for t in SERVER_TOOLS])

graph = StateGraph(...)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(SERVER_TOOLS))
graph.add_conditional_edges("agent", router, {"tools": "tools", "__end__": END})
```

### What happens with a client tool call

1. The LLM emits a tool call whose name matches a client-declared tool.
2. `route_after_agent` returns `"__end__"` — the graph run ends.
3. The browser receives the partial output, executes the tool locally, and
   re-runs the graph with a `ToolMessage` containing the result.
4. The LLM continues from there as if it had called a server tool.

### Lower-level helpers

```python
from threadplane.client_tools import (
    client_tool_specs,   # → list of OpenAI function-tool dicts
    client_tool_names,   # → set[str] of client tool names
    has_client_tool_call,  # → bool
    has_server_tool_call,  # → bool
    last_message,          # → last message from state["messages"]
)
```

## Development

```bash
uv venv
uv pip install -e '.[test]'
uv run pytest -q
```
