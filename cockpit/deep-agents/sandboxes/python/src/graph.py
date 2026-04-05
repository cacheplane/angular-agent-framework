"""
Deep Agents Sandboxes Graph

Demonstrates a coding agent that writes and executes Python code to solve
problems. The agent uses a `run_code` tool that simulates Python execution
in demo mode, returning realistic stdout output and exit status. Tool calls
are visible via stream.messages(), powering the execution log sidebar.
"""

import json
import re
from pathlib import Path
from typing import Annotated
import operator
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage, AIMessage
from langchain_core.tools import tool

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class SandboxesState(dict):
    messages: Annotated[list[BaseMessage], operator.add]


@tool
def run_code(code: str) -> str:
    """Execute a Python code snippet in a sandbox and return the result.

    In demo mode, simulates execution by parsing print() calls and simple
    expressions. Returns a JSON object with stdout, stderr, and exit_status.

    Args:
        code: The Python code to execute.
    """
    stdout_lines = []
    exit_status = 0

    # Simulate print() calls
    print_pattern = re.compile(r'print\(([^)]+)\)')
    for match in print_pattern.finditer(code):
        arg = match.group(1).strip()
        # Evaluate simple string literals and f-strings in a limited context
        try:
            value = eval(arg, {"__builtins__": {"range": range, "len": len, "str": str, "int": int, "float": float}})  # noqa: S307
            stdout_lines.append(str(value))
        except Exception:
            # Fallback: strip quotes from string literals
            cleaned = arg.strip("'\"")
            stdout_lines.append(cleaned)

    # If no print calls, try to detect syntax errors
    try:
        compile(code, "<sandbox>", "exec")
    except SyntaxError as e:
        return json.dumps({
            "stdout": "",
            "stderr": f"SyntaxError: {e}",
            "exit_status": 1,
        })

    stdout = "\n".join(stdout_lines) if stdout_lines else "(no output)"
    return json.dumps({
        "stdout": stdout,
        "stderr": "",
        "exit_status": exit_status,
    })


def build_sandboxes_graph():
    tools = [run_code]
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True).bind_tools(tools)
    tool_node = ToolNode(tools)

    async def agent(state: SandboxesState) -> dict:
        """Write and run code to solve the user's problem."""
        system_prompt = (PROMPTS_DIR / "sandboxes.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: SandboxesState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(SandboxesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {
        "tools": "tools",
        END: END,
    })
    graph.add_edge("tools", "agent")
    return graph.compile()


graph = build_sandboxes_graph()
