# c-generative-ui First-Turn Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the c-generative-ui dashboard demo actually work end-to-end: on first turn populate the spec the LLM just generated (today: zero tool calls → empty placeholder cards). On follow-up turns make `plan_tools` commit to a tool call instead of asking clarifying questions.

**Architecture:** Insert a deterministic `populate_initial_data` node between `generate_shell` and `emit_state`. Route around `plan_tools` on first turn via `Command(goto=...)`. Remove `respond`'s early-exit. Tighten `plan_tools`'s inline prompt with "ACT, do not ASK" + narrower case-3.

**Tech Stack:** Python 3.12, LangGraph (`StateGraph`, `Command`, `ToolNode`), langchain-openai (`gpt-5-mini` + `gpt-5` reasoning=minimal), uv. Per-cap canonical = `cockpit/chat/generative-ui/python/src/graph.py`; umbrella mirror = `cockpit/langgraph/streaming/python/src/dashboard_graph.py`.

---

## Files modified

- Modify: `cockpit/chat/generative-ui/python/src/graph.py` (per-cap canonical)
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_graph.py` (umbrella mirror — keep in sync)

No frontend changes. No new tools. No new prompt files.

---

## Task 1: Add `populate_initial_data` node (per-cap canonical)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`

- [ ] **Step 1: Add `uuid` and `AIMessage`, `ToolMessage` imports**

Find the existing import block:

```python
from langchain_core.messages import SystemMessage
```

Replace with:

```python
import uuid
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
```

(`json` is already imported per the existing `emit_state` node.)

- [ ] **Step 2: Append `populate_initial_data` after `plan_tools` definition**

Find the existing `async def plan_tools(...)` function (ends around the line after `return {"messages": [response]}`). Append below it:

```python


async def populate_initial_data(state: DashboardState) -> dict:
    """Deterministic first-turn data fetch: invoke all 4 data tools.

    The dashboard prompt mandates 'call ALL four data tools to populate the
    dashboard' on first turn. That's a fixed instruction, not a judgment
    call — encode it as Python instead of paying an LLM round-trip + risking
    the planner refusing to commit to tool calls.

    Synthesizes one AIMessage with tool_calls for all 4 tools + one
    ToolMessage per result. Matches ToolNode's output shape so emit_state
    (which reads ToolMessages by name) needs no changes.
    """
    tool_calls = [
        {
            "name": t.name,
            "args": {},
            "id": f"init_{t.name}_{uuid.uuid4().hex[:8]}",
            "type": "tool_call",
        }
        for t in ALL_TOOLS
    ]
    ai = AIMessage(content="", tool_calls=tool_calls)

    tool_msgs: list[ToolMessage] = []
    for t, tc in zip(ALL_TOOLS, tool_calls):
        result = await t.ainvoke({})
        content = json.dumps(result) if not isinstance(result, str) else result
        tool_msgs.append(ToolMessage(content=content, tool_call_id=tc["id"], name=t.name))

    return {"messages": [ai] + tool_msgs}
```

- [ ] **Step 3: Verify import + node callable**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "
import asyncio
from src.graph import populate_initial_data, DashboardState
result = asyncio.run(populate_initial_data({'messages': [], 'dashboard_spec': 'x'}))
msgs = result['messages']
print('N_MESSAGES:', len(msgs))
print('AI_TOOL_CALLS:', len(msgs[0].tool_calls))
print('TOOL_NAMES:', sorted([m.name for m in msgs[1:]]))
print('FIRST_TOOL_CONTENT_PREFIX:', msgs[1].content[:60])
"`

Expected output:
```
N_MESSAGES: 5
AI_TOOL_CALLS: 4
TOOL_NAMES: ['query_airline_kpis', 'query_flights_by_airline', 'query_on_time_trend', 'query_recent_disruptions']
FIRST_TOOL_CONTENT_PREFIX: {"on_time": {"value":
```
(The first-tool content order depends on `ALL_TOOLS` order; the content prefix may show a different tool's payload — the key check is that it starts with `{` or `[`, i.e. valid JSON.)

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "feat(c-generative-ui): add populate_initial_data deterministic tool-call node (per-cap)"
```

---

## Task 2: Convert `generate_shell` to return Command (per-cap canonical)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`

- [ ] **Step 1: Find existing `generate_shell` and replace**

Find:

```python
async def generate_shell(state: DashboardState) -> DashboardState:
    """Generate the dashboard shell spec on first turn."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm.ainvoke(messages)
    spec_text = response.content if isinstance(response.content, str) else ""
    return {
        "messages": [response],
        "dashboard_spec": spec_text,
    }
```

Replace with:

```python
async def generate_shell(state: DashboardState) -> Command[Literal["populate_initial_data"]]:
    """Generate the dashboard shell spec on first turn, then dispatch to
    deterministic data-population (skipping plan_tools, which has a
    follow-up-only prompt)."""
    messages = [SystemMessage(content=_PROMPT)] + state["messages"]
    response = await _llm.ainvoke(messages)
    spec_text = response.content if isinstance(response.content, str) else ""
    return Command(
        goto="populate_initial_data",
        update={"messages": [response], "dashboard_spec": spec_text},
    )
```

(`Command` and `Literal` should already be imported per the existing `router` function.)

- [ ] **Step 2: Verify import + first-turn return type**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "
import inspect
from src.graph import generate_shell
sig = inspect.signature(generate_shell)
print('RETURN_ANNOTATION:', sig.return_annotation)
"`

Expected: `RETURN_ANNOTATION: langgraph.types.Command[Literal['populate_initial_data']]` (exact rendering may vary by Python version; the key is `Command[Literal['populate_initial_data']]` is in the string).

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "feat(c-generative-ui): generate_shell dispatches to populate_initial_data via Command (per-cap)"
```

---

## Task 3: Remove `respond` early-exit + update prompt (per-cap canonical)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`

- [ ] **Step 1: Find existing `respond` and replace**

Find:

```python
async def respond(state: DashboardState) -> DashboardState:
    """Generate a brief conversational summary after tools have run."""
    last = state["messages"][-1]
    if last.type == "ai" and not (hasattr(last, "tool_calls") and last.tool_calls):
        return state

    messages = [
        SystemMessage(content="Provide a brief (1-2 sentence) conversational summary of what you just did. Do NOT output JSON.")
    ] + state["messages"]
    response = await _llm.ainvoke(messages)
    return {"messages": [response]}
```

Replace with:

```python
async def respond(state: DashboardState) -> DashboardState:
    """Generate a brief conversational summary of what just happened on this
    turn. ALWAYS runs (no early-exit) so the user-visible summary is always
    authored by this node, never inherited from plan_tools' chatter."""
    messages = [
        SystemMessage(content=(
            "Provide a brief (1-2 sentence) conversational summary of what "
            "you just did this turn. If you generated a dashboard, say so. "
            "If you filtered data, say what you filtered. "
            "Do NOT output JSON. Do NOT ask follow-up questions."
        ))
    ] + state["messages"]
    response = await _llm.ainvoke(messages)
    return {"messages": [response]}
```

- [ ] **Step 2: Verify**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "
import inspect
from src.graph import respond
src = inspect.getsource(respond)
assert 'early-exit' in src or 'ALWAYS runs' in src, 'docstring not updated'
assert 'return state' not in src.split('return {')[0], 'early-exit still present'
print('OK')
"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "fix(c-generative-ui): respond always re-summarizes, removing early-exit (per-cap)"
```

---

## Task 4: Tighten `plan_tools` prompt (per-cap canonical)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`

- [ ] **Step 1: Find existing `plan_tools` context string and replace**

Find the `context = (...)` block inside `plan_tools` (starts with `f"The current dashboard spec is:\n...`). Replace the entire string assignment with:

```python
    context = (
        f"The current dashboard spec is:\n{state['dashboard_spec']}\n\n"
        "The user has sent a follow-up. Classify and act ONCE — DO NOT ask\n"
        "clarifying questions. Pick the smallest action that satisfies the\n"
        "request and commit to it.\n"
        "\n"
        "1) FILTER / SCOPE (e.g. 'filter to cancelled flights only', 'last 6\n"
        "   months', 'top 3'): call EXACTLY ONE tool — the one that backs the\n"
        "   affected component — with the new parameters. Do NOT call the\n"
        "   other tools. Do NOT regenerate the spec.\n"
        "\n"
        "2) STRUCTURAL change (e.g. 'add a card for X', 'remove the table'):\n"
        "   regenerate the spec, then call only the tools needed to populate\n"
        "   NEW components.\n"
        "\n"
        "3) INTERPRETIVE question that no tool could answer (e.g. 'why is\n"
        "   on-time % low?', 'what does this mean?'): respond in plain prose,\n"
        "   call NO tools. Use this ONLY when no tool fetch could resolve the\n"
        "   question. If a tool could provide more data to help answer, pick\n"
        "   case 1 or 2 instead.\n"
        "\n"
        "Anti-patterns to avoid:\n"
        "  - Asking 'would you also like…' or any clarifying question.\n"
        "    Commit to the most reasonable interpretation and act.\n"
        "  - Calling all four tools. That is reserved for an explicit\n"
        "    'refresh' / 'reload everything' request.\n"
        "  - Responding conversationally when the request mentions filtering,\n"
        "    sorting, or scoping. Those are case 1, always."
    )
```

- [ ] **Step 2: Verify the new prompt is in place**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "
import inspect
from src.graph import plan_tools
src = inspect.getsource(plan_tools)
assert 'DO NOT ask' in src, 'tightened prompt missing'
assert 'Anti-patterns to avoid' in src, 'anti-patterns block missing'
assert 'INTERPRETIVE question' in src, 'narrowed case 3 missing'
print('OK')
"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "fix(c-generative-ui): plan_tools prompt — ACT not ASK, narrower case 3 (per-cap)"
```

---

## Task 5: Rewire builder edges (per-cap canonical)

**Files:**
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`

- [ ] **Step 1: Find the `_builder = StateGraph(DashboardState)` block**

The current block looks like:

```python
_builder = StateGraph(DashboardState)
_builder.add_node("router", router)
_builder.add_node("generate_shell", generate_shell)
_builder.add_node("plan_tools", plan_tools)
_builder.add_node("call_tools", ToolNode(ALL_TOOLS))
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("router")

# After shell generation, go to plan_tools to call all data tools
_builder.add_edge("generate_shell", "plan_tools")

# After plan_tools, check if we need to call tools
_builder.add_conditional_edges("plan_tools", should_call_tools)

# Tool calling flow
_builder.add_edge("call_tools", "emit_state")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
```

Replace with:

```python
_builder = StateGraph(DashboardState)
_builder.add_node("router", router)
_builder.add_node("generate_shell", generate_shell)
_builder.add_node("populate_initial_data", populate_initial_data)
_builder.add_node("plan_tools", plan_tools)
_builder.add_node("call_tools", ToolNode(ALL_TOOLS))
_builder.add_node("emit_state", emit_state)
_builder.add_node("respond", respond)

_builder.set_entry_point("router")

# First-turn deterministic path: generate_shell returns Command(goto=populate_initial_data),
# so no explicit edge needed from generate_shell. populate_initial_data goes to emit_state.
_builder.add_edge("populate_initial_data", "emit_state")

# Follow-up path: plan_tools may call tools (→ call_tools) or commit to prose (→ respond)
_builder.add_conditional_edges("plan_tools", should_call_tools)

# Tool calling flow (follow-up path)
_builder.add_edge("call_tools", "emit_state")
_builder.add_edge("emit_state", "respond")
_builder.add_edge("respond", END)

graph = _builder.compile()
```

- [ ] **Step 2: Verify graph compiles + has the new node**

Run: `cd cockpit/chat/generative-ui/python && uv run python -c "
from src.graph import graph
print('TYPE:', type(graph).__name__)
print('NODES:', sorted(graph.nodes))
"`

Expected: `TYPE: CompiledStateGraph` and `NODES` includes `populate_initial_data`.

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "feat(c-generative-ui): builder wires populate_initial_data, drops generate_shell→plan_tools edge (per-cap)"
```

---

## Task 6: End-to-end real-LLM smoke (per-cap)

**Files:** none (verification only). Requires `OPENAI_API_KEY`.

- [ ] **Step 1: Confirm key present**

Run from repo root: `grep -q '^OPENAI_API_KEY=' .env && echo found`
Expected: `found`

- [ ] **Step 2: Programmatic full-flow smoke**

Run from repo root:

```bash
set -a; source .env; set +a
cd cockpit/chat/generative-ui/python && uv run python -c "
import asyncio, json
from src.graph import graph
from langchain_core.messages import HumanMessage

async def main():
    # Turn 1: first turn
    state1 = await graph.ainvoke({'messages': [HumanMessage(content='Show me a Q3 sales dashboard with three metrics.')], 'dashboard_spec': None})
    msgs = state1['messages']
    tool_msgs = [m for m in msgs if m.type == 'tool']
    print('TURN1_N_MSGS:', len(msgs))
    print('TURN1_TOOL_NAMES:', sorted({m.name for m in tool_msgs}))
    print('TURN1_HAS_SPEC:', bool(state1.get('dashboard_spec')))
    final = msgs[-1].content[:200]
    print('TURN1_FINAL_PREFIX:', final[:120])
    assert len(tool_msgs) >= 4, f'expected >= 4 tool messages, got {len(tool_msgs)}'
    assert state1.get('dashboard_spec'), 'no dashboard_spec'
    assert not final.lstrip().startswith('{'), f'final message looks like JSON: {final[:80]!r}'

    # Turn 2: follow-up filter
    state2 = await graph.ainvoke({'messages': msgs + [HumanMessage(content='Filter to only cancelled flights')], 'dashboard_spec': state1['dashboard_spec']})
    msgs2 = state2['messages']
    new_tool_msgs = [m for m in msgs2[len(msgs):] if m.type == 'tool']
    print('TURN2_NEW_TOOL_CALLS:', [m.name for m in new_tool_msgs])
    final2 = msgs2[-1].content[:200]
    print('TURN2_FINAL_PREFIX:', final2[:120])
    assert len(new_tool_msgs) >= 1, 'expected at least 1 new tool call on follow-up'
    assert '?' not in final2[-2:], f'final message looks like a clarifying question: {final2[-40:]!r}'

asyncio.run(main())
"
```

Expected: TURN1 with `TURN1_TOOL_NAMES` containing all 4 tool names, `TURN1_HAS_SPEC: True`, and a final message that does NOT start with `{`. TURN2 with at least one new tool call and a final message that does NOT end with `?`.

- [ ] **Step 3: If smoke reveals an issue, fix the relevant earlier task and re-run. Otherwise no commit needed.**

If you need to fix something:

```bash
git add cockpit/chat/generative-ui/python/src/graph.py
git commit -m "fix(c-generative-ui): smoke fixes for first-turn flow (per-cap)"
```

---

## Task 7: Mirror to umbrella

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/dashboard_graph.py`

The umbrella is a near-byte-identical copy of the per-cap (post-PR #417 split, with two cosmetic differences confirmed via `diff` at plan-write time: imports `Annotated` and `AIMessage` that the per-cap dropped, plus one extra inline comment). Apply Tasks 1-5's edits identically. The umbrella's import block already includes `AIMessage`, but does NOT include `ToolMessage` or `uuid` — add those.

- [ ] **Step 1: Apply all Tasks 1-5 edits to `cockpit/langgraph/streaming/python/src/dashboard_graph.py`**

Imports: ensure `import uuid` is added and `ToolMessage` is added to the `from langchain_core.messages import ...` line (the existing line already imports `AIMessage, SystemMessage`).

Then: copy the `populate_initial_data` body (Task 1 Step 2), the new `generate_shell` (Task 2 Step 1), the new `respond` (Task 3 Step 1), the new `plan_tools` context string (Task 4 Step 1), and the new builder block (Task 5 Step 1) into the umbrella file at the same relative positions.

- [ ] **Step 2: Verify umbrella module imports + graph compiles**

Run: `cd cockpit/langgraph/streaming/python && uv run python -c "
import asyncio
from src.dashboard_graph import graph, populate_initial_data
print('TYPE:', type(graph).__name__)
print('NODES:', sorted(graph.nodes))
result = asyncio.run(populate_initial_data({'messages': [], 'dashboard_spec': 'x'}))
print('N_MESSAGES:', len(result['messages']))
print('TOOL_NAMES:', sorted([m.name for m in result['messages'][1:]]))
"`

Expected: `TYPE: CompiledStateGraph`, NODES includes `populate_initial_data`, `N_MESSAGES: 5`, all 4 tool names.

- [ ] **Step 3: Confirm umbrella and per-cap match for the changed regions**

```bash
diff <(grep -A 30 "async def populate_initial_data" cockpit/chat/generative-ui/python/src/graph.py) \
     <(grep -A 30 "async def populate_initial_data" cockpit/langgraph/streaming/python/src/dashboard_graph.py)
```

Expected: empty diff (identical bodies).

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/dashboard_graph.py
git commit -m "feat(c-generative-ui umbrella): mirror first-turn fix"
```

---

## Task 8: Build verification

**Files:** none (verification only).

- [ ] **Step 1: Build the per-cap python**

Run from repo root: `pnpm nx run cockpit-chat-generative-ui-python:build`
Expected: green.

- [ ] **Step 2: Build the umbrella python**

Run: `pnpm nx run cockpit-langgraph-streaming-python:build`
Expected: green.

- [ ] **Step 3: Build the Angular app (sanity)**

Run: `pnpm nx run cockpit-chat-generative-ui-angular:build`
Expected: green. (Frontend untouched.)

- [ ] **Step 4: Production deploy manifest unchanged**

Run: `npx tsx scripts/generate-shared-deployment-config.ts && git diff deployments/shared-dev/langgraph.json`
Expected: empty diff. (We changed Python source, not the manifest.)

- [ ] **Step 5: No commit (verification only)**

---

## Task 9: REQUIRED — chrome MCP end-to-end smoke

**Files:** none (verification only). Requires `OPENAI_API_KEY` in repo-root `.env`.

Spot-check the full flow against the per-cap standalone backend (port 5508) + Angular dev (port 4508).

- [ ] **Step 1: Free ports + start servers**

```bash
lsof -t -i :5508 -i :4508 2>/dev/null | xargs kill -9 2>/dev/null
set -a; source .env; set +a
nohup pnpm nx run cockpit-chat-generative-ui-python:serve > /tmp/genui-fix-backend.log 2>&1 &
nohup pnpm nx serve cockpit-chat-generative-ui-angular --port 4508 > /tmp/genui-fix-frontend.log 2>&1 &
```

Wait for both ready (backend log: `Application started up`; frontend log: `Local:.*4508`).

- [ ] **Step 2: Drive flow via chrome MCP**

1. Navigate `http://localhost:4508/`
2. Click "Render a dashboard" chip → wait ~12 sec → expect: KPI stat cards with NUMBERS (not "Building UI…" placeholders), line chart with data, bar chart with bars, data table with rows
3. Verify thread state via `curl -s http://localhost:5508/threads/<latest>/state` → expect ≥4 ToolMessages, final AI message ≠ JSON, final AI message does not contain "stick with"
4. Type "Filter to only the cancelled flights" → press Enter → wait ~12 sec → expect: data table updates (still has rows but only cancellations), no clarifying question in the final AI message
5. Type "Why is on-time % low?" → press Enter → expect: conversational prose answer (no spec regeneration, no new tool calls necessarily — interpretive case 3)

Take a screenshot after step 2 with `save_to_disk: true` for the PR description.

- [ ] **Step 3: If any step fails**

Inspect backend log + frontend console + thread state JSON. Fix the relevant task's code, restart backend, re-run.

- [ ] **Step 4: Stop servers**

```bash
lsof -t -i :5508 -i :4508 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/genui-fix-backend.log /tmp/genui-fix-frontend.log
```

---

## Task 10: Open PR + watch CI + merge

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(c-generative-ui): first-turn populates dashboard + plan_tools commits to actions" --body "$(cat <<'EOF'
## Summary
Fixes the c-generative-ui dashboard demo end-to-end. Today (verified via chrome MCP on 2026-05-18) the first turn emits a valid render spec but zero tool calls — so the UI shows 6 empty \"Building UI…\" placeholder cards forever. Follow-up turns ('Filter to cancelled flights') reply with clarifying questions instead of acting.

Root cause: \`generate_shell\` binds NO tools (physically can't call them); \`plan_tools\` has a separate inline prompt scoped to follow-up turns only, so on first turn it falls through to a 'respond conversationally' case and emits chatter. \`respond\` has an early-exit that lets that chatter pass through as the user-visible summary.

## Changes
- New deterministic node \`populate_initial_data\` invokes all 4 data tools after \`generate_shell\`. No LLM — the prompt mandates 'call ALL four' and that's a fixed instruction.
- \`generate_shell\` now returns \`Command(goto=\"populate_initial_data\")\`, routing around \`plan_tools\` on first turn.
- \`respond\` early-exit removed — always re-summarizes so first-turn and follow-up both produce a real summary.
- \`plan_tools\` prompt tightened: \"ACT, do not ASK\" anti-pattern, narrower case-3 ('respond conversationally only when no tool could resolve the question').

## Files
- \`cockpit/chat/generative-ui/python/src/graph.py\` — per-cap canonical
- \`cockpit/langgraph/streaming/python/src/dashboard_graph.py\` — umbrella mirror (full-copy per PR #396 policy)

## Test plan
- [x] \`pnpm nx run cockpit-chat-generative-ui-python:build\` — green
- [x] \`pnpm nx run cockpit-langgraph-streaming-python:build\` — green
- [x] \`pnpm nx run cockpit-chat-generative-ui-angular:build\` — green
- [x] Shared-deployment manifest unchanged
- [x] Programmatic real-LLM smoke: turn 1 produces ≥4 tool messages + non-JSON conversational summary; turn 2 produces ≥1 new tool call + no clarifying question
- [x] Chrome MCP smoke against per-cap (5508): populated stat cards/chart/table on first turn, filter actually filters on follow-up, interpretive question stays conversational
- [ ] CI

Plan: \`docs/superpowers/plans/2026-05-18-c-generative-ui-first-turn-fix.md\`
Spec: \`docs/superpowers/specs/2026-05-18-c-generative-ui-first-turn-fix-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

`gh pr checks <PR#> --watch`

- [ ] **Step 4: Squash-merge on green**

`gh pr merge <PR#> --squash --delete-branch`

---

## Self-Review

**Spec coverage:**
- Decision 1 (deterministic populate_initial_data) → Task 1 ✓
- Decision 2 (skip plan_tools on first turn via Command) → Task 2 + Task 5 builder rewire ✓
- Decision 3 (tighten plan_tools prompt) → Task 4 ✓
- Decision 4 (remove respond early-exit) → Task 3 ✓
- Decision 5 (no sentinel — let failures propagate) → no task, by design ✓
- Decision 6 (mirror to umbrella) → Task 7 ✓
- Graph shape diagram → Task 5 builder block implements it ✓
- Testing section (programmatic + chrome MCP) → Tasks 6 + 9 ✓
- Risks → addressed in Tasks 1 (json.dumps matches emit_state's json.loads), 3 (extra LLM call cost documented), 4 (case 3 examples preserved), 7 (mirror diff check) ✓

**Placeholder scan:** No TBDs. Every code-modifying step shows full new code. Task 7 explicitly says "copy Tasks 1-5 edits identically" — acceptable because (a) the per-cap code IS the source of truth, (b) the full-copy mirror is required policy per PR #396, (c) duplicating 100+ lines verbatim would double the plan length without adding clarity.

**Type consistency:**
- `populate_initial_data` signature `(state: DashboardState) -> dict` matches the langgraph node interface used by `emit_state` (Task 1 vs existing code).
- `generate_shell` Command return type `Command[Literal["populate_initial_data"]]` matches the new node name registered in the builder (Tasks 2 + 5).
- Tool names referenced in the smoke test (Task 6) match `ALL_TOOLS` definition in `dashboard_tools.py`.
- ToolMessage shape (content as JSON string, name set, tool_call_id matches AIMessage's tool_calls[].id) matches what `emit_state` already expects via its `if msg.name == "query_airline_kpis"` branches.
- Removed edge `generate_shell → plan_tools` (Task 5) accompanied by Command-based dispatch from `generate_shell` (Task 2) — no orphan edges or unreachable nodes.
