"""Capture parent task tool_calls + orchestrator continuation for c-subagents.

Mirrors cockpit/langgraph/streaming/python/src/chat_graphs.py's
_build_subagents_graph() LLM setup: ChatOpenAI(gpt-5-mini, streaming=True)
bound with the `task` tool, system prompt from prompts/subagents.md.

Iterates the agent <-> tool loop until the LLM stops emitting tool_calls;
each loop iteration is one round of `task` dispatch + tool result. Writes
all rounds into a single aimock fixture file using the hasToolResult
discriminator on continuation entries.

Run from repo root:
  OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \\
    python cockpit/chat/subagents/angular/e2e/scripts/record-c-subagents.py
"""
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

env_path = Path("cockpit/langgraph/streaming/python/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

if not os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY not set", file=sys.stderr)
    sys.exit(1)

sys.path.insert(0, str(Path("cockpit/langgraph/streaming/python/src").resolve()))

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI

from src.chat_graphs import task  # type: ignore  # the @tool the orchestrator dispatches with

PROMPT = "Plan a trip from LAX to JFK"
SYSTEM_PROMPT = (
    Path("cockpit/langgraph/streaming/python/prompts/subagents.md").read_text()
)

llm = ChatOpenAI(model="gpt-5-mini", temperature=0).bind_tools([task])

# Agent <-> tool loop. Capture each LLM response. Stop when LLM emits no tool_calls.
history = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=PROMPT)]
captured_responses = []


async def run_loop():
    for round_i in range(5):  # 5 rounds is plenty; recursion limit safety
        response = await llm.ainvoke(history)
        captured_responses.append(response)
        tcs = response.tool_calls or []
        if not tcs:
            print(f"round {round_i}: orchestrator emitted final text ({len(response.content or '')} chars)")
            return
        print(f"round {round_i}: {len(tcs)} task tool_calls")
        # Add the AI message to history and execute each tool call.
        history.append(
            AIMessage(
                content=response.content or "",
                tool_calls=[
                    {"name": tc.get("name"), "args": tc.get("args") or {}, "id": tc.get("id") or f"call_{uuid.uuid4().hex[:12]}", "type": "tool_call"}
                    for tc in tcs
                ],
            )
        )
        for tc in tcs:
            result = await task.ainvoke(tc.get("args") or {})
            history.append(
                ToolMessage(
                    content=str(result),
                    tool_call_id=tc.get("id") or f"call_{uuid.uuid4().hex[:12]}",
                )
            )
    print("WARNING: reached round 5 without final-text response; using last captured", file=sys.stderr)


asyncio.run(run_loop())

if not captured_responses:
    print("No LLM responses captured", file=sys.stderr)
    sys.exit(2)

# Build fixture.
# - First entry: orchestrator's FINAL response (last in captured_responses). Match needs
#   hasToolResult=true since by then the request history includes tool results.
# - Second entry: orchestrator's FIRST response (the initial task tool_calls fanout).
#   Match needs just userMessage (no tool_result in history yet).
first = captured_responses[0]
last = captured_responses[-1]

if not first.tool_calls:
    print("First orchestrator call did NOT emit tool_calls; cannot build subagents fixture", file=sys.stderr)
    print("Content:", str(first.content)[:200])
    sys.exit(3)

final_text = last.content if isinstance(last.content, str) else ""
if last is first or last.tool_calls:
    # Single-round flow: only one response, which had tool_calls. We don't have a
    # continuation text. Fail loudly - the test needs both.
    print("LLM did not emit a final-text continuation; aborting", file=sys.stderr)
    print("Tried 5 rounds; last response still had tool_calls:", bool(last.tool_calls))
    sys.exit(4)

fixture = {
    "fixtures": [
        # ORDER MATTERS: continuation match is more specific (hasToolResult);
        # aimock evaluates fixtures top-to-bottom.
        {
            "match": {"userMessage": PROMPT, "hasToolResult": True},
            "response": {"content": final_text},
        },
        {
            "match": {"userMessage": PROMPT},
            "response": {
                "toolCalls": [
                    {"name": tc.get("name"), "arguments": tc.get("args") or {}}
                    for tc in first.tool_calls
                ]
            },
        },
    ]
}

out_path = Path("cockpit/chat/subagents/angular/e2e/fixtures/c-subagents.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"\nWrote fixture to {out_path}")
print(f"  first call: {len(first.tool_calls)} task tool_calls")
print(f"  continuation: {len(final_text)} chars; first 80: {final_text[:80]!r}")
