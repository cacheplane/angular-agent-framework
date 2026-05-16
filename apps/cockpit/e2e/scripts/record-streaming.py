"""Capture a real text response from the streaming graph's LLM.

Mirrors cockpit/langgraph/streaming/python/src/graph.py's
build_streaming_graph() setup: ChatOpenAI(gpt-5-mini, streaming=True)
+ system prompt from prompts/streaming.md.

Run from repo root:
  OPENAI_API_KEY=sk-... uv run --project cockpit/langgraph/streaming/python \
    python apps/cockpit/e2e/scripts/record-streaming.py
"""
import json
import os
import sys
from pathlib import Path

env_path = Path("cockpit/langgraph/streaming/python/.env")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

if not os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY not set (in env or .env)", file=sys.stderr)
    sys.exit(1)

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

PROMPT = "Tell me one quick fact about Angular signals in two sentences."
SYSTEM_PROMPT = (
    Path("cockpit/langgraph/streaming/python/prompts/streaming.md").read_text()
)

llm = ChatOpenAI(model="gpt-5-mini", temperature=0)
response = llm.invoke(
    [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=PROMPT)],
)
text = response.content if isinstance(response.content, str) else ""
if not text.strip():
    print("LLM returned empty content; cannot build fixture", file=sys.stderr)
    sys.exit(2)
print(f"captured {len(text)} chars; first 80: {text[:80]!r}")

fixture = {
    "fixtures": [
        {
            "match": {"userMessage": PROMPT},
            "response": {"content": text},
        }
    ]
}

out_path = Path("apps/cockpit/e2e/fixtures/streaming.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"\nWrote fixture to {out_path}")
