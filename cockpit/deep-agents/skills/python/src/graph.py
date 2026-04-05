"""
Deep Agents Skills Graph

Demonstrates a multi-skill agent that selects specialized tools based on
the user's request. The agent can calculate math expressions, count words
in text, and summarize content. Tool calls are visible to the frontend
via stream.messages(), powering the skill invocation sidebar.
"""

from pathlib import Path
from typing import Annotated
import operator
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage, AIMessage
from langchain_core.tools import tool

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class SkillsState(dict):
    messages: Annotated[list[BaseMessage], operator.add]


@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression and return the result.

    Args:
        expression: A mathematical expression to evaluate (e.g. '42 * 7').
    """
    try:
        result = eval(expression, {"__builtins__": {}}, {})  # noqa: S307
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {e}"


@tool
def word_count(text: str) -> str:
    """Count the number of words in a piece of text.

    Args:
        text: The text to count words in.
    """
    words = text.split()
    return f"{len(words)} words"


@tool
def summarize(text: str) -> str:
    """Summarize a piece of text in one sentence.

    Args:
        text: The text to summarize.
    """
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    if not sentences:
        return "No content to summarize."
    first = sentences[0]
    total = len(sentences)
    return f"{first}. [{total} sentence(s) total]"


def build_skills_graph():
    tools = [calculator, word_count, summarize]
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True).bind_tools(tools)
    tool_node = ToolNode(tools)

    async def agent(state: SkillsState) -> dict:
        """Choose and call the appropriate skill tool."""
        system_prompt = (PROMPTS_DIR / "skills.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: SkillsState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(SkillsState)
    graph.add_node("agent", agent)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {
        "tools": "tools",
        END: END,
    })
    graph.add_edge("tools", "agent")
    return graph.compile()


graph = build_skills_graph()
