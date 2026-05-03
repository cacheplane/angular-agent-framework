"""
Deep Agents Subagents Graph

Demonstrates the orchestrator + subagent delegation pattern. The orchestrator
receives a task and delegates to specialist subagent tools. Each tool call
represents a child agent invocation whose progress streams independently to
the frontend via stream.subagents().
"""

from pathlib import Path
from typing import TypedDict, Annotated
import operator
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage, AIMessage, ToolMessage
from langchain_core.tools import tool

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class SubagentsState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]


def build_subagents_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    @tool
    async def research_agent(topic: str) -> str:
        """Spawn a research subagent to gather information on a topic."""
        research_llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
        response = await research_llm.ainvoke([
            SystemMessage(content="You are a research specialist. Provide concise, factual information."),
            {"role": "human", "content": f"Research this topic and provide key facts: {topic}"},
        ])
        return str(response.content)

    @tool
    async def analysis_agent(content: str) -> str:
        """Spawn an analysis subagent to analyze and synthesize information."""
        analysis_llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
        response = await analysis_llm.ainvoke([
            SystemMessage(content="You are an analysis specialist. Identify patterns, draw insights, and synthesize information clearly."),
            {"role": "human", "content": f"Analyze this content and provide key insights: {content}"},
        ])
        return str(response.content)

    @tool
    async def summary_agent(findings: str) -> str:
        """Spawn a summary subagent to produce a final coherent response."""
        summary_llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
        response = await summary_llm.ainvoke([
            SystemMessage(content="You are a summarization specialist. Produce clear, well-structured summaries."),
            {"role": "human", "content": f"Summarize these findings into a concise final answer: {findings}"},
        ])
        return str(response.content)

    tools = [research_agent, analysis_agent, summary_agent]
    tools_by_name = {t.name: t for t in tools}
    orchestrator_llm = llm.bind_tools(tools)

    async def orchestrate(state: SubagentsState) -> dict:
        """Orchestrator decides which subagents to invoke."""
        system_prompt = (PROMPTS_DIR / "subagents.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await orchestrator_llm.ainvoke(messages)
        return {"messages": [response]}

    async def run_subagents(state: SubagentsState) -> dict:
        """Execute each tool call as a subagent invocation."""
        last_message = state["messages"][-1]
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return {"messages": []}

        tool_messages = []
        for tool_call in last_message.tool_calls:
            tool_fn = tools_by_name.get(tool_call["name"])
            if tool_fn:
                result = await tool_fn.ainvoke(tool_call["args"])
                tool_messages.append(
                    ToolMessage(
                        content=str(result),
                        tool_call_id=tool_call["id"],
                    )
                )
        return {"messages": tool_messages}

    async def respond(state: SubagentsState) -> dict:
        """Produce the final response after all subagents have completed."""
        system_prompt = (PROMPTS_DIR / "subagents.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await orchestrator_llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: SubagentsState) -> str:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "run_subagents"
        return END

    graph = StateGraph(SubagentsState)
    graph.add_node("orchestrate", orchestrate)
    graph.add_node("run_subagents", run_subagents)
    graph.add_node("respond", respond)
    graph.set_entry_point("orchestrate")
    graph.add_conditional_edges("orchestrate", should_continue, {
        "run_subagents": "run_subagents",
        END: END,
    })
    graph.add_edge("run_subagents", "respond")
    graph.add_edge("respond", END)
    return graph.compile()


graph = build_subagents_graph()
