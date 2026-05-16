"""Capture parent first-call (tool_call) + continuation (text) for c-tool-calls.

Mirrors cockpit/langgraph/streaming/python/src/chat_graphs.py's
_build_tool_calls_graph() LLM setup: ChatOpenAI(gpt-5-mini, streaming=True)
bound with AVIATION_TOOLS, system prompt from prompts/tool-calls.md.

Two LLM calls captured, written into one fixture with the hasToolResult
discriminator on the continuation entry.

Run from repo root:
  OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
    python cockpit/chat/tool-calls/angular/e2e/scripts/record-c-tool-calls.py
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

from src.aviation_tools import ALL_TOOLS as AVIATION_TOOLS, lookup_flight  # type: ignore

PROMPT = "What's the status of UA123?"
SYSTEM_PROMPT = (
    Path("cockpit/langgraph/streaming/python/prompts/tool-calls.md").read_text()
)

llm = ChatOpenAI(model="gpt-5-mini", temperature=0).bind_tools(AVIATION_TOOLS)

# 1. Parent's first call.
first = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=PROMPT)])
assert first.tool_calls, f"Parent did not emit tool_calls; content={first.content!r}"
tc = first.tool_calls[0]
tc_args = tc.get("args") or {}
tc_id = tc.get("id") or f"call_{uuid.uuid4().hex[:12]}"
print(f"1. parent tool_call name={tc.get('name')} args={tc_args}")

# 2. Tool result (real lookup_flight).
tool_result = asyncio.run(lookup_flight.ainvoke(tc_args))  # returns canned aviation data
print(f"2. tool result length={len(str(tool_result))}")

# 3. Parent's continuation call.
continuation = llm.invoke(
    [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=PROMPT),
        AIMessage(
            content="",
            tool_calls=[{"name": tc.get("name"), "args": tc_args, "id": tc_id, "type": "tool_call"}],
        ),
        ToolMessage(content=str(tool_result), tool_call_id=tc_id),
    ],
)
text = continuation.content if isinstance(continuation.content, str) else ""
if not text.strip():
    print("Continuation returned empty; aborting", file=sys.stderr)
    sys.exit(2)
print(f"3. continuation: {len(text)} chars; first 80: {text[:80]!r}")

fixture = {
    "fixtures": [
        # ORDER MATTERS: continuation match is more specific (hasToolResult);
        # aimock evaluates fixtures top-to-bottom and picks the first match.
        {
            "match": {"userMessage": PROMPT, "hasToolResult": True},
            "response": {"content": text},
        },
        {
            "match": {"userMessage": PROMPT},
            "response": {"toolCalls": [{"name": tc.get("name"), "arguments": tc_args}]},
        },
    ]
}

out_path = Path("cockpit/chat/tool-calls/angular/e2e/fixtures/c-tool-calls.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"\nWrote fixture to {out_path}")
