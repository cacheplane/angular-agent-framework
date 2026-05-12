# SPDX-License-Identifier: MIT
"""Spike: can the PARENT LLM emit A2UI v1 envelopes directly as tool
arguments (option D from the streaming sub-LLM design discussion)?

Today: parent LLM binds `generate_a2ui_schema(request: str)`; tool body
calls a sub-LLM with the A2UI v1 schema prompt; sub-LLM returns the
envelope array. Two LLM hops, no streaming surface.

Option D: parent LLM binds `render_a2ui_surface(envelopes: list[dict])`
with the A2UI v1 schema in its system prompt; parent emits envelopes
directly as tool_call_chunks; one LLM hop, natural token streaming.

This spike answers: does option D produce results comparable in quality
and reliability to today's sub-LLM path?

Run:
  cd examples/chat/python && source .venv/bin/activate && python spike/parent_envelope_quality.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Make `src` importable when run from the python dir.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.schemas.a2ui_v1 import A2UI_V1_SCHEMA_PROMPT  # noqa: E402


# ---------------------------------------------------------------------------
# Tool schema for option D
# ---------------------------------------------------------------------------

class RenderA2uiSurface(BaseModel):
    """Render a UI surface using A2UI v1 envelopes.

    Emit a JSON array of envelope objects. Required: exactly one
    `surfaceUpdate` (component tree) and one `beginRendering` (root
    reference). Optional: one or more `dataModelUpdate` entries, one
    per state path the surface binds to.

    Each envelope is one of:
      - {"surfaceUpdate": {"surfaceId": str, "root": str,
                            "components": [{"id": str, "type": str, "props": {...}}, ...]}}
      - {"beginRendering": {"surfaceId": str, "root": str}}
      - {"dataModelUpdate": {"surfaceId": str, "contents": [{"path": str, "value": any}, ...]}}

    See the system prompt for full schema details.
    """
    envelopes: list[dict] = Field(
        description=(
            "Ordered list of A2UI v1 envelopes. Must include one surfaceUpdate "
            "and one beginRendering. Each item is a JSON object whose single "
            "top-level key is the envelope type (surfaceUpdate, beginRendering, "
            "or dataModelUpdate)."
        ),
    )


# ---------------------------------------------------------------------------
# Test bench
# ---------------------------------------------------------------------------

TEST_PROMPTS: list[str] = [
    "Render a sign-up card with email and password fields and a Submit button.",
    "Show me a dashboard with 4 KPI cards: revenue $42k, users 1.2k, conversion 3.4%, churn 1.1%.",
    "Make a product card for a blue ceramic mug, $24, with an Add to Cart button.",
    "Render a settings panel with toggles for dark mode, notifications, and analytics.",
    "Show a contact form with name, email, message, and a Submit button.",
    "Render a pricing table with three tiers: Basic $9, Pro $29, Enterprise $99.",
    "Render a profile card for Alex Smith, role Senior Engineer, with an Edit button.",
    "Build a checkout summary: 2 items totaling $48 plus $5 shipping.",
    "Display an error alert: 'Could not connect to server' with a Retry button.",
    "Render a recipe card for 'Pasta Carbonara' with ingredient list and cook time 25 minutes.",
    "Render a confirmation dialog asking 'Delete file?' with Cancel and Delete buttons.",
    "Show a survey with three rating questions and a Submit button.",
    "Render a flight status panel: AA127 from JFK to LAX, departing 9:15am, on time.",
    "Show a task card for 'Write the spec' assigned to me, due tomorrow, with a Complete button.",
    "Render a notification card with title 'New message' and body 'You have a meeting at 3pm'.",
]


SYSTEM_PROMPT = (
    "You are a UI rendering assistant. When the user asks for any UI, form, "
    "card, panel, dashboard, dialog, or visual component, you MUST call the "
    "`render_a2ui_surface` tool with a complete A2UI v1 envelope array. Do "
    "not produce text replies for UI requests.\n\n"
    "Inline A2UI v1 schema:\n\n" + A2UI_V1_SCHEMA_PROMPT
)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@dataclass
class TurnResult:
    prompt: str
    model: str
    elapsed_s: float
    raised_tool_call: bool = False
    parsed_args: bool = False
    has_surface_update: bool = False
    has_begin_rendering: bool = False
    data_update_count: int = 0
    component_count: int = 0
    error: str = ""
    raw_tool_args: dict[str, Any] | None = field(default=None, repr=False)

    @property
    def valid(self) -> bool:
        return (
            self.raised_tool_call
            and self.parsed_args
            and self.has_surface_update
            and self.has_begin_rendering
        )


def validate(envelopes: list[dict]) -> dict:
    """Return validation booleans + component count."""
    has_surface = any(isinstance(e, dict) and "surfaceUpdate" in e for e in envelopes)
    has_begin = any(isinstance(e, dict) and "beginRendering" in e for e in envelopes)
    data_updates = [e for e in envelopes if isinstance(e, dict) and "dataModelUpdate" in e]
    components = 0
    for e in envelopes:
        if isinstance(e, dict) and "surfaceUpdate" in e:
            comps = e["surfaceUpdate"].get("components", [])
            if isinstance(comps, list):
                components += len(comps)
    return {
        "has_surface_update": has_surface,
        "has_begin_rendering": has_begin,
        "data_update_count": len(data_updates),
        "component_count": components,
    }


# ---------------------------------------------------------------------------
# Per-prompt run
# ---------------------------------------------------------------------------

async def run_prompt(model: str, prompt: str) -> TurnResult:
    result = TurnResult(prompt=prompt, model=model, elapsed_s=0.0)
    llm = ChatOpenAI(model=model, temperature=0).bind_tools([RenderA2uiSurface])
    t0 = time.monotonic()
    try:
        response: AIMessage = await llm.ainvoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ])
    except Exception as e:  # noqa: BLE001
        result.error = f"ainvoke: {type(e).__name__}: {e}"
        result.elapsed_s = time.monotonic() - t0
        return result
    result.elapsed_s = time.monotonic() - t0

    tool_calls = getattr(response, "tool_calls", None) or []
    if not tool_calls:
        result.error = "no tool_call emitted (text-only reply)"
        return result

    target = next((tc for tc in tool_calls if tc.get("name") == "RenderA2uiSurface"), None)
    if not target:
        result.error = f"tool_call name mismatch: {[tc.get('name') for tc in tool_calls]}"
        return result

    result.raised_tool_call = True
    args = target.get("args") or {}
    result.raw_tool_args = args

    envelopes = args.get("envelopes")
    if not isinstance(envelopes, list):
        result.error = f"envelopes not a list: type={type(envelopes).__name__}"
        return result

    result.parsed_args = True
    v = validate(envelopes)
    result.has_surface_update = v["has_surface_update"]
    result.has_begin_rendering = v["has_begin_rendering"]
    result.data_update_count = v["data_update_count"]
    result.component_count = v["component_count"]
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> int:
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set — aborting", file=sys.stderr)
        return 2

    models = ["gpt-5-mini", "gpt-5"]
    all_results: dict[str, list[TurnResult]] = {m: [] for m in models}

    for model in models:
        print(f"\n=== {model} ===")
        for i, prompt in enumerate(TEST_PROMPTS, 1):
            r = await run_prompt(model, prompt)
            all_results[model].append(r)
            status = "OK " if r.valid else "FAIL"
            extras = f"comp={r.component_count} dmu={r.data_update_count}" if r.valid else r.error
            print(f"  [{i:>2}/{len(TEST_PROMPTS)}] {status} ({r.elapsed_s:5.2f}s) {extras}")

    print("\n=== Summary ===")
    for model, results in all_results.items():
        n = len(results)
        valid = sum(1 for r in results if r.valid)
        emitted_tool = sum(1 for r in results if r.raised_tool_call)
        parsed = sum(1 for r in results if r.parsed_args)
        ok_surface = sum(1 for r in results if r.has_surface_update)
        ok_begin = sum(1 for r in results if r.has_begin_rendering)
        avg_t = sum(r.elapsed_s for r in results) / n if n else 0
        print(f"\n  {model}:")
        print(f"    valid={valid}/{n} ({100*valid//n}%) | tool={emitted_tool}/{n} | parsed={parsed}/{n} | surfaceUpdate={ok_surface}/{n} | beginRendering={ok_begin}/{n}")
        print(f"    avg latency: {avg_t:.2f}s")

        # Gate decision per model
        rate = (valid / n) * 100 if n else 0
        if rate >= 90:
            verdict = "PASS (D)"
        elif rate >= 70:
            verdict = "PARTIAL (D for gpt-5, E for cheaper)"
        else:
            verdict = "FAIL (fall back to E)"
        print(f"    gate: {verdict}")

    # Dump raw results for inspection
    dump_path = Path(__file__).parent / "spike-results.json"
    with dump_path.open("w") as f:
        json.dump(
            {m: [{**vars(r), "raw_tool_args": r.raw_tool_args} for r in rs] for m, rs in all_results.items()},
            f, indent=2, default=str,
        )
    print(f"\n  Raw results → {dump_path}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
