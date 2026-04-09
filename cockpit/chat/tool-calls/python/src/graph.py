"""
Chat Tool Calls Graph

A LangGraph StateGraph that demonstrates tool calling with search,
calculator, and weather tools. The agent uses tools proactively
and the frontend renders tool call cards.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage
from langchain_core.tools import tool

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


@tool
def search(query: str) -> str:
    """Search the web for information."""
    return f"Search results for '{query}': Found 3 relevant articles about {query}."


@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression."""
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def weather(city: str) -> str:
    """Get current weather for a city."""
    return f"Weather in {city}: 72F, partly cloudy, humidity 45%."


tools = [search, calculator, weather]


def build_tool_calls_graph():
    """
    Constructs a tool-calling agent with search, calculator, and weather tools.
    Uses conditional edges to route between generation and tool execution.
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(tools)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "tool-calls.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> str:
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return END

    tool_node = ToolNode(tools)

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("generate")
    graph.add_conditional_edges("generate", should_continue)
    graph.add_edge("tools", "generate")

    return graph.compile()


graph = build_tool_calls_graph()
