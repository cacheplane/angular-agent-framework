"""
Deep Agents Filesystem Graph

Demonstrates agent file operations using tool calls. The agent can
read and write files, and the frontend displays each operation in
the sidebar via stream.messages().
"""

from pathlib import Path
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, BaseMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


@tool
def read_file(path: str) -> str:
    """Read a file's contents. Only reads from the workspace directory."""
    return f"Contents of {path}: [simulated file content]"


@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file in the workspace."""
    return f"Successfully wrote {len(content)} bytes to {path}"


class FilesystemState(TypedDict):
    messages: list[BaseMessage]


def build_filesystem_graph():
    tools = [read_file, write_file]
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(tools)

    async def agent(state: FilesystemState) -> dict:
        """Run the agent — may emit tool calls."""
        system_prompt = (PROMPTS_DIR / "filesystem.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: FilesystemState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    tool_node = ToolNode(tools)

    graph = StateGraph(FilesystemState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()


graph = build_filesystem_graph()
