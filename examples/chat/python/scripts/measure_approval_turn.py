"""Measure the hero's post-approval turn against a LIVE backend.

For each run: new thread, send the hero prompt, wait for the interrupt,
resume with "approved", and record which tools were called and how long the
final assistant message is. Prints per-run rows and the median.

    cd examples/chat/python
    export OPENAI_API_KEY=...            # the dev server needs it, not this script
    uv run langgraph dev --port 2024 --no-browser &
    uv run python scripts/measure_approval_turn.py --runs 10

Compare against the figures in
docs/superpowers/specs/2026-09-04-hero-executable-approval-tools-design.md:
the shipped narration was 482 characters; before the tools, the walked-through
prompt produced a median 5,802-character plan. The spec's gate: if this is
still thousands of characters, STOP and rethink rather than trimming by hand.
"""
import argparse
import asyncio
import json
import statistics

from langgraph_sdk import get_client

PROMPT = "Clean up our old database backups, anything older than 90 days."


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


async def one_run(client, assistant_id: str) -> dict:
    thread = await client.threads.create()
    tid = thread["thread_id"]
    await client.runs.wait(tid, assistant_id, input={"messages": [{"role": "human", "content": PROMPT}]})
    state = await client.threads.get_state(tid)
    interrupted = bool(state.get("tasks") and any(t.get("interrupts") for t in state["tasks"]))
    if interrupted:
        await client.runs.wait(tid, assistant_id, command={"resume": "approved"})
        state = await client.threads.get_state(tid)
    msgs = state["values"]["messages"]
    tools = [tc["name"] for m in msgs if m.get("type") == "ai" for tc in (m.get("tool_calls") or [])]
    final = next((m for m in reversed(msgs) if m.get("type") == "ai" and not m.get("tool_calls")), None)
    text = _text(final.get("content")) if final else ""
    backups = state["values"].get("backups")
    return {
        "thread_id": tid,
        "interrupted": interrupted,
        "tools": tools,
        "chars": len(text),
        "lines": text.count("\n") + 1 if text else 0,
        "remaining": len(backups) if isinstance(backups, list) else None,
        "text": text,
    }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=10)
    ap.add_argument("--url", default="http://localhost:2024")
    ap.add_argument("--assistant", default="chat")
    ap.add_argument("--show", action="store_true", help="print each final answer")
    args = ap.parse_args()
    client = get_client(url=args.url)
    rows = []
    for i in range(args.runs):
        r = await one_run(client, args.assistant)
        rows.append(r)
        print(f"{i+1:>2}  interrupt={r['interrupted']!s:5}  chars={r['chars']:>5}  lines={r['lines']:>3}  remaining={r['remaining']}  tools={r['tools']}")
        if args.show:
            print("    " + r["text"].replace("\n", "\n    "))
    chars = [r["chars"] for r in rows]
    listed_first = sum(1 for r in rows if r["tools"][:1] == ["list_backups"])
    deleted = sum(1 for r in rows if "delete_backups" in r["tools"])
    print(json.dumps({
        "runs": len(rows),
        "interrupted": sum(1 for r in rows if r["interrupted"]),
        "list_backups_first": listed_first,
        "delete_backups_called": deleted,
        "used_request_approval": sum(1 for r in rows if "request_approval" in r["tools"]),
        "median_chars": statistics.median(chars) if chars else 0,
        "max_chars": max(chars) if chars else 0,
        "remaining_rows_after_approval": sorted({r["remaining"] for r in rows if r["remaining"] is not None}),
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
