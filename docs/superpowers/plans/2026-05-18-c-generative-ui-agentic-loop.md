# c-generative-ui Agentic-Loop Rewrite (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite c-generative-ui as a single agentic loop where the LLM authors the dashboard spec via a `render_spec` tool (returning the spec as a JSON string) AND chooses the data tools to populate it in the same turn. Use the canonical `emit_generated_surface`-style pattern from `examples/chat/python/src/graph.py` — wrap the spec into AIMessage content via a post-process node so the chat-lib's existing content-classifier picks it up.

**Architecture:** `START → agent ↔ tools → wrap_spec_into_ai → agent (loop, cap 6) → emit_state → respond → END`. `render_spec` returns `json.dumps(spec)` as its ToolMessage content. `wrap_spec_into_ai` is an idempotent post-process that replaces the parent AI tool-call message's content (in place via `add_messages`'s id-match reducer) with the spec JSON, so `<chat-generative-ui>` mounts via the content-classifier. `'render_spec'` added to the chat-lib's default `genuiToolNames` so `<chat-tool-calls>` excludes it.

**Tech Stack:** Python 3.12, LangGraph ≥0.3 (in-place message replacement via `add_messages` id-match — no Command-from-tool required), langchain-openai (`gpt-5` reasoning='minimal' for agent, `gpt-5-mini` for respond), TypeScript (one-line chat-lib default update), uv.

---

## Pre-flight (READ FIRST)

**Supersedes v1.** This plan REPLACES the v1 implementation that used `Command(update=...)` from `render_spec`. v1's `render_spec` Command bypassed the message stream; the frontend never saw the spec. v2 returns the spec as a plain string from the tool (matching the canonical pattern in `examples/chat`).

**Branch hygiene.** The current implementation branch `claude/genui-agentic-loop` has the v1 (broken) implementation. We restart from the spec branch on a fresh implementation branch:

```bash
git fetch origin
git branch -D claude/genui-agentic-loop 2>/dev/null  # discard the v1 attempt
git checkout -b claude/genui-agentic-loop-v2 claude/genui-agentic-loop-spec
```

The v2 spec commit is the latest commit on `claude/genui-agentic-loop-spec`. The v1 plan commit comes before it; that's fine — both live as history on the spec branch.

**Shared-checkout chaos.** Working tree gets switched by parallel agents in this checkout. Every code-modifying step starts with a `git branch --show-current` check. Task 8 (chrome MCP) uses an isolated worktree.

**Reference implementation.** Read `examples/chat/python/src/graph.py` lines 442-593 BEFORE starting Task 2 (the `wrap_spec_into_ai` node). The structure mirrors `emit_generated_surface`; the only adaptation is "loop back to agent instead of going to END."

---

## Files modified

- Modify: `cockpit/chat/generative-ui/python/src/graph.py` (per-cap canonical — full rewrite)
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_graph.py` (umbrella mirror)
- Modify: `cockpit/chat/generative-ui/python/prompts/dashboard.md` (workflow section rewrite)
- Modify: `cockpit/langgraph/streaming/python/prompts/dashboard.md` (umbrella prompt mirror)
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts` (1-line addition to default `genuiToolNames`)

No `dashboard_tools.py` changes. No cockpit consumer changes. No `pyproject.toml` changes. No new dependencies.

---

## Task 1: Add `'render_spec'` to chat-lib's default `genuiToolNames`

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
```

- [ ] **Step 2: Apply the edit**

Find this block (around line 318):

```typescript
  readonly genuiToolNames = input<readonly string[]>([
    'generate_a2ui_schema',
    'generate_json_render_spec',
  ]);
```

Replace with:

```typescript
  readonly genuiToolNames = input<readonly string[]>([
    'generate_a2ui_schema',
    'generate_json_render_spec',
    'render_spec',
  ]);
```

- [ ] **Step 3: Verify**

```bash
grep -A4 "genuiToolNames = input" libs/chat/src/lib/compositions/chat/chat.component.ts | head -6
```

Expected: the array literal contains all three tool names.

- [ ] **Step 4: Commit**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat-lib): include render_spec in default genuiToolNames"
```

---

## Task 2: Rewrite per-cap graph

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py` (replace contents)

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
```

- [ ] **Step 2: Replace `cockpit/chat/generative-ui/python/src/graph.py` with the agentic-loop v2 version**

```python
"""Single-node agentic graph for the airline operations KPI dashboard.

Flow:
  START → agent ↔ tools → wrap_spec_into_ai → agent (loop) → emit_state → respond → END

`agent` is a single LLM call with all 5 tools bound (render_spec + 4 data
tools). After tools run, `wrap_spec_into_ai` post-processes — if the LLM
called render_spec, it replaces the parent AI message's content with the
spec JSON (in place via add_messages' id-match reducer) so the chat-lib's
content-classifier mounts <chat-generative-ui>. Then loops back to agent
until the LLM returns no tool_calls (cap _MAX_TOOL_ITERATIONS per turn).

Mirrors the emit_generated_surface pattern from examples/chat/python/src/graph.py,
adapted for a continuation loop instead of terminal dispatch.
"""

import json
from pathlib import Path
from typing import Literal

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

from src.dashboard_tools import ALL_TOOLS as _DATA_TOOLS

_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()

_MAX_TOOL_ITERATIONS = 6


class DashboardState(MessagesState):
    """The dashboard spec lives in AI message content (the canonical
    chat-lib surface-delivery protocol), not on the state object."""
    pass


@tool
async def render_spec(spec: dict) -> str:
    """Render an interactive dashboard layout from a JSON spec.

    Use this tool to author or update the dashboard layout. The spec is a
    JSON object with `elements` (a dict keyed by component id) and `root`
    (the id of the top-level component). See the system prompt for the full
    schema and component catalog.

    Call this tool FIRST on any turn where the layout needs to be created
    or restructured. After calling render_spec, call the data tools needed
    to populate the components you authored.

    Args:
        spec: The dashboard JSON render spec.

    Returns:
        The spec serialized as JSON. A post-process node (wrap_spec_into_ai)
        wraps this payload into the AI message content where the
        chat-lib's content-classifier picks it up.
    """
    return json.dumps(spec)


_ALL_TOOLS = [render_spec, *_DATA_TOOLS]

_llm_with_tools = ChatOpenAI(
    model="gpt-5",
    temperature=0,
    streaming=True,
    reasoning_effort="minimal",
).bind_tools(_ALL_TOOLS)

_respond_llm = ChatOpenAI(model="gpt-5-mini", temperature=0, streaming=True)


async def agent(state: DashboardState) -> dict:
    """Single agentic node: LLM bound with all 5 tools."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: DashboardState) -> Literal["tools", "emit_state"]:
    """Loop while the agent emits tool_calls, up to _MAX_TOOL_ITERATIONS
    this turn. After the cap, force exit to emit_state — a partial
    dashboard beats an infinite loop."""
    last = state["messages"][-1]
    if not (hasattr(last, "tool_calls") and last.tool_calls):
        return "emit_state"

    iter_count = 0
    for msg in reversed(state["messages"]):
        if msg.type == "human":
            break
        if msg.type == "ai" and getattr(msg, "tool_calls", None):
            iter_count += 1
    if iter_count >= _MAX_TOOL_ITERATIONS:
        return "emit_state"
    return "tools"


async def wrap_spec_into_ai(state: DashboardState) -> dict:
    """Post-process that wraps the most recent render_spec ToolMessage
    payload into the parent AI tool-call message's content (in place via
    LangGraph's add_messages reducer matching by id). The chat-lib's
    content-classifier then sees content starting with `{` and mounts
    <chat-generative-ui>.

    Idempotent: if the parent AI message already has non-empty content
    (already wrapped on a prior iteration), no-op. Also no-op if there
    is no render_spec ToolMessage to process.

    Mirrors emit_generated_surface from examples/chat/python/src/graph.py,
    adapted to loop back to `agent` instead of going to END.
    """
    msgs = state["messages"]

    render_tool_msg: ToolMessage | None = None
    parent_ai: AIMessage | None = None
    for m in reversed(msgs):
        if isinstance(m, ToolMessage) and m.name == "render_spec":
            render_tool_msg = m
            for prior in reversed(msgs):
                if isinstance(prior, AIMessage) and prior.tool_calls:
                    if any(tc.get("id") == render_tool_msg.tool_call_id for tc in prior.tool_calls):
                        parent_ai = prior
                        break
            break

    if render_tool_msg is None or parent_ai is None:
        return {}

    existing = parent_ai.content
    if isinstance(existing, str) and existing.strip():
        return {}

    payload = render_tool_msg.content if isinstance(render_tool_msg.content, str) else ""
    if not payload:
        return {}

    stripped = payload.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        stripped = "\n".join(line for line in lines if not line.startswith("```")).strip()

    out: list = []

    placeholder_kwargs: dict = {
        "content": "rendered",
        "tool_call_id": render_tool_msg.tool_call_id,
        "name": "render_spec",
    }
    if getattr(render_tool_msg, "id", None):
        placeholder_kwargs["id"] = render_tool_msg.id
    out.append(ToolMessage(**placeholder_kwargs))

    replacement_kwargs: dict = {
        "content": stripped,
        "tool_calls": parent_ai.tool_calls,
        "additional_kwargs": parent_ai.additional_kwargs or {},
        "response_metadata": parent_ai.response_metadata or {},
    }
    if getattr(parent_ai, "id", None):
        replacement_kwargs["id"] = parent_ai.id
    out.append(AIMessage(**replacement_kwargs))

    return {"messages": out}


async def emit_state(state: DashboardState) -> DashboardState:
    """Emit state_update custom events from data tool results. Walks
    state["messages"] in reverse, accumulates state patches from
    ToolMessages produced this turn (until the most recent human message
    — NOT ai, since the loop produces multiple AI messages per turn).

    Ignores tool names not in the known set (e.g. render_spec, whose
    payload was already wrapped into AI content by wrap_spec_into_ai
    and whose ToolMessage is now the "rendered" stub).
    """
    from langgraph.config import get_stream_writer

    tool_results: dict = {}
    for msg in reversed(state["messages"]):
        if msg.type == "tool":
            try:
                data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
            except (json.JSONDecodeError, TypeError):
                continue

            if msg.name == "query_airline_kpis":
                for section_key, section_val in data.items():
                    if isinstance(section_val, dict):
                        for k, v in section_val.items():
                            tool_results[f"/{section_key}/{k}"] = v
            elif msg.name == "query_on_time_trend":
                tool_results["/on_time_trend"] = data
            elif msg.name == "query_flights_by_airline":
                tool_results["/flights_by_airline"] = data
            elif msg.name == "query_recent_disruptions":
                tool_results["/recent_disruptions"] = data
        elif msg.type == "human":
            break

    if tool_results:
        writer = get_stream_writer()
        writer({"name": "state_update", "data": tool_results})

    return state


async def respond(state: DashboardState) -> dict:
    """Generate a brief conversational summary of what just happened on
    this turn. ALWAYS runs (no early-exit)."""
    messages = [
        SystemMessage(content=(
            "Provide a brief (1-2 sentence) conversational summary of what "
            "you just did this turn. If you generated a dashboard, say so. "
            "If you filtered data, say what you filtered. "
            "Do NOT output JSON. Do NOT ask follow-up questions."
        ))
    ] + state["messages"]
    response = await _respond_llm.ainvoke(messages)
    return {"messages": [response]}


_builder = StateGraph(DashboardState)
_builder.add_node("agent", agent)
_builder.add_node("tools", ToolNode(_ALL_TOOLS))
_builder.add_node("wrap_spec_into_ai", wrap_spec_into_ai)
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("agent")
_builder.add_conditional_edges("agent", should_continue)
_builder.add_edge("tools", "wrap_spec_into_ai")
_builder.add_edge("wrap_spec_into_ai", "agent")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
```

- [ ] **Step 3: Verify compile + render_spec direct call**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
cd cockpit/chat/generative-ui/python && uv run python -c "
import asyncio
from src.graph import graph, render_spec, wrap_spec_into_ai
print('TYPE:', type(graph).__name__)
print('NODES:', sorted(graph.nodes))
result = asyncio.run(render_spec.ainvoke({'spec': {'elements': {'root': {'type': 'dashboard_grid'}}, 'root': 'root'}}))
print('RENDER_SPEC_TYPE:', type(result).__name__)
print('RENDER_SPEC_STARTS_WITH:', result[:20])
assert isinstance(result, str), 'render_spec should return str, not Command'
assert result.startswith('{'), 'spec JSON should start with {'
"
```

Expected:
```
TYPE: CompiledStateGraph
NODES: ['__start__', 'agent', 'emit_state', 'respond', 'tools', 'wrap_spec_into_ai']
RENDER_SPEC_TYPE: str
RENDER_SPEC_STARTS_WITH: {"elements": {"root":
```

(Note: depending on LangGraph version, NODES may or may not include `__end__`. Both are fine — what matters is `wrap_spec_into_ai` and `agent` are present, no `populate_initial_data` / `generate_shell` / `router` / `plan_tools`.)

- [ ] **Step 4: Commit**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "feat(c-generative-ui): rewrite as agentic loop with wrap_spec_into_ai post-process (per-cap)"
```

---

## Task 3: Rewrite per-cap system prompt

**Files:**
- Modify: `cockpit/chat/generative-ui/python/prompts/dashboard.md`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
```

- [ ] **Step 2: Read the existing file, then `Edit` to replace the opening + workflow sections**

Use `Read` to load the file. Find the exact span from `# Airline Operations Dashboard Agent` through the END of the "Follow-up messages" subsection (before `## JSON Render Spec Format`). The existing opening currently describes a sequential "First message" / "Follow-up messages" workflow.

Replace ONLY that span with the following (preserve `## JSON Render Spec Format` and everything below verbatim):

```markdown
# Airline Operations Dashboard Agent

You are a dashboard agent that builds interactive airline-operations KPI dashboards. You have five tools:

- `render_spec(spec)` — Author or update the dashboard layout. The spec is a JSON object describing component types, props, children, and state bindings. See the schema below.
- `query_airline_kpis()` — Snapshot of operational KPIs: on-time %, flights today, avg delay, load factor.
- `query_on_time_trend(months=12)` — On-time performance per month, for the line chart.
- `query_flights_by_airline(airlines=None)` — Daily flight counts per airline, for the bar chart.
- `query_recent_disruptions(limit=5, type=None)` — Recent delays/cancellations, for the data grid.

## Workflow

### When no dashboard exists yet (first turn)

1. Call `render_spec` ONCE with a complete dashboard layout — stat cards, charts, table — using `$state` bindings to the slots the data tools populate (see "State Path Conventions" below).
2. In the SAME turn (same tool_calls array), call EACH data tool that backs a component in your spec. Do NOT call tools whose data your spec doesn't reference.
3. After the tools return, return WITHOUT any further tool calls. A separate node will write a brief conversational summary.

### When the dashboard exists (follow-up turn)

Categorize the user's request and act ONCE. DO NOT ask clarifying questions — pick the most reasonable interpretation and act.

- **Filter / scope** (e.g. "filter to cancelled flights only", "last 6 months", "top 3"): call EXACTLY ONE data tool — the one that backs the affected component — with the new parameters. Do NOT call `render_spec`.
- **Structural change** (e.g. "add a card for X", "remove the table"): call `render_spec` with the modified layout, then call data tools only for the NEW components.
- **Interpretive question** that no tool could resolve (e.g. "why is on-time % low?"): respond in plain prose with no tool calls.

```

- [ ] **Step 3: Verify**

```bash
grep -c "render_spec(spec)" cockpit/chat/generative-ui/python/prompts/dashboard.md
grep -c "JSON Render Spec Format" cockpit/chat/generative-ui/python/prompts/dashboard.md
grep -c "First message" cockpit/chat/generative-ui/python/prompts/dashboard.md
```

Expected (in order): `1`, `1`, `0` (the literal "First message" header must be gone; the new wording says "first turn").

- [ ] **Step 4: Commit**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
git add cockpit/chat/generative-ui/python/prompts/dashboard.md
git commit -m "feat(c-generative-ui): rewrite system prompt for agentic-loop workflow (per-cap)"
```

---

## Task 4: Mirror graph to umbrella

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_graph.py`

- [ ] **Step 1: Verify branch + copy per-cap graph.py to umbrella**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
cp cockpit/chat/generative-ui/python/src/graph.py cockpit/langgraph/streaming/python/src/dashboard_graph.py
```

- [ ] **Step 2: Verify**

```bash
diff cockpit/chat/generative-ui/python/src/graph.py cockpit/langgraph/streaming/python/src/dashboard_graph.py && echo IDENTICAL
cd cockpit/langgraph/streaming/python && uv run python -c "
from src.dashboard_graph import graph, render_spec, wrap_spec_into_ai
print('TYPE:', type(graph).__name__)
print('NODES:', sorted(graph.nodes))
"
```

Expected: `IDENTICAL`, then `TYPE: CompiledStateGraph` with `wrap_spec_into_ai` + `agent` in NODES.

- [ ] **Step 3: Commit**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
git add cockpit/langgraph/streaming/python/src/dashboard_graph.py
git commit -m "feat(c-generative-ui umbrella): mirror agentic-loop graph"
```

---

## Task 5: Mirror prompt to umbrella

**Files:**
- Modify: `cockpit/langgraph/streaming/python/prompts/dashboard.md`

- [ ] **Step 1: Verify branch + copy**

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
cp cockpit/chat/generative-ui/python/prompts/dashboard.md cockpit/langgraph/streaming/python/prompts/dashboard.md
diff cockpit/chat/generative-ui/python/prompts/dashboard.md cockpit/langgraph/streaming/python/prompts/dashboard.md && echo IDENTICAL
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/prompts/dashboard.md
git commit -m "feat(c-generative-ui umbrella): mirror prompt rewrite"
```

---

## Task 6: End-to-end real-LLM smoke (programmatic)

**Files:** none. Requires `OPENAI_API_KEY`.

- [ ] **Step 1: Run 3-turn smoke**

```bash
grep -q '^OPENAI_API_KEY=' .env && echo found
set -a; source .env; set +a
cd cockpit/chat/generative-ui/python && uv run python -c "
import asyncio
from src.graph import graph
from langchain_core.messages import HumanMessage

async def main():
    s1 = await graph.ainvoke({'messages': [HumanMessage(content='Show me a dashboard of airline operations.')]})
    msgs = s1['messages']
    tool_msgs = [m for m in msgs if m.type == 'tool']
    print('TURN1_TOOL_NAMES:', [m.name for m in tool_msgs])

    render_tool_msg = next((m for m in tool_msgs if m.name == 'render_spec'), None)
    assert render_tool_msg is not None, 'expected a render_spec ToolMessage'
    print('RENDER_TOOL_CONTENT:', render_tool_msg.content[:30])
    assert render_tool_msg.content == 'rendered', f'render_spec ToolMessage should be the stub, got {render_tool_msg.content[:50]!r}'

    wrapped_ai = next((m for m in msgs if m.type == 'ai' and isinstance(m.content, str) and m.content.lstrip().startswith('{')), None)
    assert wrapped_ai is not None, 'expected an AI message with spec JSON as content'
    print('WRAPPED_AI_CONTENT_PREFIX:', wrapped_ai.content[:60])

    data_tools = [m for m in tool_msgs if m.name != 'render_spec']
    print('TURN1_DATA_TOOL_COUNT:', len(data_tools))
    assert len(data_tools) >= 1, f'expected >=1 data tool, got {[m.name for m in data_tools]}'

    final = msgs[-1].content if isinstance(msgs[-1].content, str) else str(msgs[-1].content)
    print('TURN1_FINAL_PREFIX:', final[:160])
    assert not final.lstrip().startswith('{'), 'final respond message should be prose, not JSON'

    s2 = await graph.ainvoke({'messages': msgs + [HumanMessage(content='Filter to only cancelled flights')]})
    msgs2 = s2['messages']
    new_tool_msgs = [m for m in msgs2[len(msgs):] if m.type == 'tool']
    new_tool_names = [m.name for m in new_tool_msgs]
    print('TURN2_NEW_TOOL_NAMES:', new_tool_names)
    assert 'render_spec' not in new_tool_names, 'filter should not regen spec'
    assert len(new_tool_names) >= 1

    s3 = await graph.ainvoke({'messages': msgs2 + [HumanMessage(content='Why might on-time percentage be lower than industry average?')]})
    msgs3 = s3['messages']
    new_tool_msgs3 = [m for m in msgs3[len(msgs2):] if m.type == 'tool']
    print('TURN3_NEW_TOOL_NAMES:', [m.name for m in new_tool_msgs3])
    final3 = msgs3[-1].content if isinstance(msgs3[-1].content, str) else str(msgs3[-1].content)
    print('TURN3_FINAL_PREFIX:', final3[:200])

asyncio.run(main())
"
```

Expected:
- TURN1_TOOL_NAMES includes `render_spec` and ≥1 data tool
- RENDER_TOOL_CONTENT is `'rendered'`
- WRAPPED_AI_CONTENT_PREFIX starts with `{`
- TURN1_DATA_TOOL_COUNT ≥ 1
- TURN1_FINAL_PREFIX is prose
- TURN2_NEW_TOOL_NAMES does NOT contain `render_spec`
- TURN3 ideally 0 new tool calls

- [ ] **Step 2: If smoke fails, fix relevant task and re-run. If a fix is needed:**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py cockpit/chat/generative-ui/python/prompts/dashboard.md cockpit/langgraph/streaming/python/src/dashboard_graph.py cockpit/langgraph/streaming/python/prompts/dashboard.md
git commit -m "fix(c-generative-ui): agentic-loop v2 smoke fixes"
```

---

## Task 7: Build verification

**Files:** none.

```bash
cd /Users/blove/repos/angular-agent-framework
pnpm nx run cockpit-chat-generative-ui-python:build
pnpm nx run cockpit-langgraph-streaming-python:build
pnpm nx run chat:build
pnpm nx run cockpit-chat-generative-ui-angular:build
npx tsx scripts/generate-shared-deployment-config.ts && git diff deployments/shared-dev/langgraph.json
```

All should be green; the final `git diff` should produce empty output.

No commit.

---

## Task 8: REQUIRED — chrome MCP smoke (in isolated worktree)

**Files:** none.

- [ ] **Step 1: Create isolated worktree on a tmp branch (avoids "branch already used by worktree" error)**

```bash
ISOLATED_DIR="/tmp/genui-agentic-loop-v2-verify"
rm -rf "$ISOLATED_DIR"
git worktree add -B genui-v2-verify-tmp "$ISOLATED_DIR" claude/genui-agentic-loop-v2
cd "$ISOLATED_DIR" && git branch --show-current
```

Expected: `genui-v2-verify-tmp`.

- [ ] **Step 2: Install per-cap deps in the isolated worktree**

```bash
cd "$ISOLATED_DIR/cockpit/chat/generative-ui/python" && uv sync 2>&1 | tail -3
```

- [ ] **Step 3: Start backend from worktree, frontend from main checkout**

(The Angular dev needs `node_modules` which only exist in the main checkout. The Angular code change in this PR is one line — if a parallel agent flips the main checkout's branch, the practical risk to the Angular dev is low.)

```bash
lsof -t -i :5508 -i :4508 2>/dev/null | xargs kill -9 2>/dev/null
set -a; source /Users/blove/repos/angular-agent-framework/.env; set +a

cd "$ISOLATED_DIR/cockpit/chat/generative-ui/python"
nohup uv run langgraph dev --no-browser --host 127.0.0.1 --port 5508 > /tmp/v2-backend.log 2>&1 &

cd /Users/blove/repos/angular-agent-framework
nohup pnpm nx serve cockpit-chat-generative-ui-angular --port 4508 > /tmp/v2-frontend.log 2>&1 &
```

Wait for `Application started up` in backend log and `Local:` in frontend log.

- [ ] **Step 4: Verify loaded graph is v2**

```bash
curl -s http://localhost:5508/assistants/c-generative-ui/graph | python3 -c "
import json, sys
d = json.load(sys.stdin)
nodes = sorted([n['id'] for n in d.get('nodes', [])])
print('NODES:', nodes)
print('HAS_WRAP:', 'wrap_spec_into_ai' in nodes)
print('HAS_AGENT:', 'agent' in nodes)
print('HAS_GENERATE_SHELL:', 'generate_shell' in nodes)
"
```

Expected: `HAS_WRAP: True`, `HAS_AGENT: True`, `HAS_GENERATE_SHELL: False`. If wrong, STOP — backend cached old code.

- [ ] **Step 5: Drive flow via chrome MCP**

1. Navigate to `http://localhost:4508/`
2. Wait ~5 sec for page idle
3. Use chrome MCP's `find` to locate the chat textarea + `javascript_tool` to set its value to "Show me a dashboard of airline operations." and dispatch the Enter keydown event (bypasses the chip — chip text says "Q3 sales", a separate frontend issue)
4. Wait ~30 sec for the agent loop + respond to finish
5. Expect: populated KPI stat cards (numbers, not "Building UI…"), line chart with data, bar chart, data table with rows
6. Verify via `get_page_text` that the chat-tool-calls UI shows the 4 query_* tool cards but does NOT show a `render_spec` card
7. Take a screenshot with `save_to_disk: true` for the PR description
8. Follow-up: inject "Filter to only cancelled flights" → wait ~15 sec → expect the data table updates

- [ ] **Step 6: If step 5 shows empty cards, debug:**

```bash
TID=$(curl -s -X POST http://localhost:5508/threads/search -H 'Content-Type: application/json' -d '{"limit":1,"order":"desc","order_by":"updated_at"}' | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['thread_id'])")
curl -s "http://localhost:5508/threads/$TID/state" | python3 -c "
import json, sys
d = json.load(sys.stdin)
msgs = d['values'].get('messages', [])
for i, m in enumerate(msgs):
    t = m.get('type'); name = m.get('name','')
    c = m.get('content','')
    if isinstance(c, list): c = str(c)
    tc = m.get('tool_calls',[])
    print(f'[{i}] {t}{\" \"+name if name else \"\"} tc={len(tc)} c[:80]={str(c)[:80]!r}')
"
```

Expect to see at least one AI message whose `content` starts with `{` (the wrapped spec). If absent → `wrap_spec_into_ai` didn't run; check backend log for tracebacks.

- [ ] **Step 7: Stop servers + clean up**

```bash
lsof -t -i :5508 -i :4508 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/v2-backend.log /tmp/v2-frontend.log
cd /Users/blove/repos/angular-agent-framework
git worktree remove "$ISOLATED_DIR" --force
git branch -D genui-v2-verify-tmp 2>&1 | tail -1
```

---

## Task 9: Open PR + watch CI + merge

```bash
test "$(git branch --show-current)" = "claude/genui-agentic-loop-v2" && echo OK || exit 1
git push -u origin claude/genui-agentic-loop-v2
gh pr create --title "refactor(c-generative-ui): agentic loop with canonical surface-delivery (v2)" --body "$(cat <<'EOF'
## Summary
Rewrites c-generative-ui as a single agentic loop where the LLM authors the dashboard spec via a \`render_spec\` tool AND chooses the data tools to populate it in the same turn. Replaces PR #428's deterministic \`populate_initial_data\` fudge with real LLM-driven composition.

Uses the canonical surface-delivery pattern from \`examples/chat/python/src/graph.py\`: \`render_spec\` returns the spec as a plain JSON string in its ToolMessage content; a post-process node \`wrap_spec_into_ai\` swaps that payload into the parent AI tool-call message's content (in place via LangGraph's \`add_messages\` id-match reducer), so the chat-lib's content-classifier mounts \`<chat-generative-ui>\` the same way it does for every other surface in the codebase.

## Why v2
A v1 attempt used \`Command(update=...)\` from \`render_spec\` to write the spec into a state field. Chrome MCP verification revealed the frontend's content-classifier only inspects \`AIMessage.content\` — the spec never reached the renderer; empty placeholder cards forever. v2 respects the established invariant that the frontend's source of truth for surfaces is AIMessage content.

## Architecture
\`\`\`
START → agent ──→ should_continue ──┬→ tools → wrap_spec_into_ai → agent  (loop, cap 6)
                                    └→ emit_state → respond → END
\`\`\`

Removed: \`router\`, \`generate_shell\`, \`populate_initial_data\`, \`plan_tools\`, \`dashboard_spec\` state field. Added: \`agent\`, \`wrap_spec_into_ai\`, \`render_spec\` tool. \`emit_state\` and \`respond\` largely unchanged from PR #428 (the message-walk now breaks on \`human\` since the loop produces multiple AI messages per turn).

## Files
- \`cockpit/chat/generative-ui/python/src/graph.py\` — per-cap canonical (full rewrite)
- \`cockpit/langgraph/streaming/python/src/dashboard_graph.py\` — umbrella mirror
- \`cockpit/chat/generative-ui/python/prompts/dashboard.md\` — agentic workflow + schema preserved
- \`cockpit/langgraph/streaming/python/prompts/dashboard.md\` — umbrella prompt mirror
- \`libs/chat/src/lib/compositions/chat/chat.component.ts\` — add \`'render_spec'\` to default \`genuiToolNames\` (1 line)

## Test plan
- [x] Programmatic real-LLM smoke (3-turn): \`render_spec\` ToolMessage stubbed to "rendered"; an AI message exists with content = wrapped spec JSON; data tools fire; turn-2 filter doesn't regen spec; turn-3 interpretive returns prose
- [x] All builds green (per-cap python, umbrella python, chat lib, Angular consumer)
- [x] Shared deploy manifest unchanged
- [x] Chrome MCP smoke (isolated worktree): KPI cards populated, charts render, \`render_spec\` excluded from \`<chat-tool-calls>\`, filter works on follow-up; screenshot attached
- [ ] CI

Plan: \`docs/superpowers/plans/2026-05-18-c-generative-ui-agentic-loop.md\`
Spec: \`docs/superpowers/specs/2026-05-18-c-generative-ui-agentic-loop-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks <PR#> --watch
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**
- Decision 1 (`render_spec` returns string, no Command) → Task 2 ✓
- Decision 2 (no `dashboard_spec` state field) → Task 2 (`DashboardState` body is `pass`) ✓
- Decision 3 (graph shape) → Task 2 builder block ✓
- Decision 4 (cap 6) → Task 2 (`_MAX_TOOL_ITERATIONS = 6`) ✓
- Decision 5 (model selection) → Task 2 ✓
- Decision 6 (emit_state break-on-human) → Task 2 ✓
- Decision 7 (respond unchanged) → Task 2 ✓
- Decision 8 (`genuiToolNames` default) → Task 1 ✓
- Decision 9 (mirror to umbrella) → Tasks 4 + 5 ✓
- Decision 10 (tool_choice='auto') → Task 2 (no `tool_choice` arg = default auto) ✓
- 3-turn programmatic smoke → Task 6 ✓
- Chrome MCP in isolated worktree → Task 8 ✓
- Frontend genuiToolNames addition → Task 1 ✓

**Placeholder scan:** Every code-modifying step shows full new code. Task 3 references "preserved verbatim" for the schema sections — acceptable, they're already correct in the existing file. Task 8 step 3's caveat about Angular running from the main checkout is explicit.

**Type consistency:**
- `DashboardState(MessagesState): pass` — no extra fields; `render_spec` returns `str`; `wrap_spec_into_ai` returns `dict`; `should_continue` returns `Literal["tools", "emit_state"]` matching builder destinations.
- ToolMessage fields (`tool_call_id`, `name`, `id`, `content`) and AIMessage fields (`id`, `content`, `tool_calls`, `additional_kwargs`, `response_metadata`) match `langchain-core` standard message types.
- `_ALL_TOOLS = [render_spec, *_DATA_TOOLS]` — same list passed to both `bind_tools` (agent) and `ToolNode` (tools).
- Edges `tools → wrap_spec_into_ai → agent` create a loop; `agent`'s conditional edge breaks to `emit_state` when no tool_calls.
- `genuiToolNames` extension is a literal string addition; TypeScript `readonly string[]` accepts it.

**Concurrency:** Every code-modifying task includes a branch-check; Task 8 uses an isolated worktree.
