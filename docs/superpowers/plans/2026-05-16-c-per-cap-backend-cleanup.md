# c-* Per-Capability Backend Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `cockpit/chat/<name>/python/` runnable via `nx serve` on `port+1000`, fix dev env wiring so Angular dev hits the per-cap backend through the proxy, and sync per-cap python content to match umbrella's `c-<topic>` emission. Production deploy stays unchanged.

**Architecture:** Per-cap python/ stays as a self-contained copy (no umbrella imports). Each gets its own `project.json` with `serve` (`uv run langgraph dev --port 55XX --no-browser`) and `build`. Angular dev env points at `/api` which the proxy forwards to `localhost:55XX`. The `pythonPort` field added to `capability-registry.ts` is dev-only — production deploy still aggregates umbrella code through the existing manifest generator.

**Tech Stack:** Python 3.12, LangGraph, langgraph-cli, langchain-openai (`gpt-5-mini` for prompt-only caps, `gpt-5` reasoning_effort="minimal" for c-subagents planner), uv, Nx 21, Angular 21.

---

## Audit (read once, before tasks)

Today's state (verified via grep):

| Cap | graph.py shape | langgraph.json name | env URL | env assistantId | proxy port | prompt drifted? |
|---|---|---|---|---|---|---|
| messages | `_build_prompt_graph`-equivalent, gpt-5-mini | `c-messages` ✓ | `localhost:4501/api` (dead) | `c-messages` ✓ | 8123 (umbrella) | YES — pre-aviation |
| input | same | `c-input` ✓ | `localhost:4502/api` | `c-input` ✓ | 8123 | YES |
| interrupts | same | `c-interrupts` ✓ | `localhost:4503/api` | `c-interrupts` ✓ | 8123 | YES |
| tool-calls | stub | `c-tool-calls` ✓ | `localhost:4504/api` | `c-tool-calls` ✓ | **8124** ⚠ | n/a — graph replaced |
| subagents | stub | `c-subagents` ✓ | `localhost:4505/api` | `c-subagents` ✓ | **8125** ⚠ | n/a — graph replaced |
| threads | same | `c-threads` ✓ | `localhost:4506/api` | `c-threads` ✓ | 8123 | YES |
| timeline | same | `c-timeline` ✓ | `localhost:4507/api` | `c-timeline` ✓ | 8123 | YES |
| generative-ui | dashboard graph (PR3+A+E synced) | **`generative_ui`** ⚠ | `localhost:4310/api` ⚠ | **`generative_ui`** ⚠ | 8123 | n/a — graph + prompt file `dashboard.md` (NOT generative-ui.md) |
| debug | same as prompt-only | `c-debug` ✓ | `localhost:4509/api` | `c-debug` ✓ | 8123 | YES |
| theming | same | `c-theming` ✓ | `localhost:4510/api` | `c-theming` ✓ | 8123 | YES |
| a2ui | a2ui_graph (PR4 synced) | **`a2ui_form`** ⚠ | `localhost:4511/api` | **`a2ui_form`** ⚠ | 8123 | n/a |

After this PR: every cap's graph name = `c-<topic>`, env URL = `/api`, env assistantId value = `c-<topic>`, proxy target = `localhost:55XX` (per-cap pythonPort), nx serve target exists, prompts and code in per-cap python match what umbrella emits for that cap today.

---

## Task 1: Add `pythonPort` to capability-registry

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts` (only the 11 chat cap entries; type def too if needed)

- [ ] **Step 1: Add the field to each chat cap entry**

For each of the 11 chat cap entries in `apps/cockpit/scripts/capability-registry.ts`, add a `pythonPort` field equal to `port + 1000`. The chat caps and resulting values:

| id | port | pythonPort |
|---|---|---|
| c-messages | 4501 | 5501 |
| c-input | 4502 | 5502 |
| c-interrupts | 4503 | 5503 |
| c-tool-calls | 4504 | 5504 |
| c-subagents | 4505 | 5505 |
| c-threads | 4506 | 5506 |
| c-timeline | 4507 | 5507 |
| c-generative-ui | 4508 | 5508 |
| c-debug | 4509 | 5509 |
| c-theming | 4510 | 5510 |
| c-a2ui | 4511 | 5511 |

For each cap, change the line from:
```ts
{ id: 'c-messages', product: 'chat', topic: 'messages', angularProject: 'cockpit-chat-messages-angular', port: 4501, pythonDir: 'cockpit/langgraph/streaming/python', graphName: 'c-messages' },
```
to:
```ts
{ id: 'c-messages', product: 'chat', topic: 'messages', angularProject: 'cockpit-chat-messages-angular', port: 4501, pythonPort: 5501, pythonDir: 'cockpit/langgraph/streaming/python', graphName: 'c-messages' },
```

If the `Capability` type declaration in the same file enumerates explicit fields, add `pythonPort?: number;`. If it's inferred from `as const` literal, the field shows up automatically.

- [ ] **Step 2: Verify generation script still works**

Run: `npx tsx scripts/generate-shared-deployment-config.ts`
Expected: no error; `deployments/shared-dev/langgraph.json` regenerated. Verify the chat graph names in the output still resolve to `cockpit/langgraph/streaming/python/...` paths (production deploy source unchanged).

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts deployments/shared-dev/langgraph.json
git commit -m "feat(registry): add pythonPort (port+1000) to each chat capability"
```

---

## Task 2: Fix the 2 langgraph.json outliers

**Files:**
- Modify: `cockpit/chat/generative-ui/python/langgraph.json`
- Modify: `cockpit/chat/a2ui/python/langgraph.json`

- [ ] **Step 1: Rename graph in generative-ui standalone**

Replace `cockpit/chat/generative-ui/python/langgraph.json` with:

```json
{
  "graphs": {
    "c-generative-ui": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 2: Rename graph in a2ui standalone**

Replace `cockpit/chat/a2ui/python/langgraph.json` with:

```json
{
  "graphs": {
    "c-a2ui": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/generative-ui/python/langgraph.json cockpit/chat/a2ui/python/langgraph.json
git commit -m "fix(c-per-cap): rename langgraph.json graphs to c-<topic> (generative-ui, a2ui)"
```

---

## Task 3: Create `project.json` for each per-cap python (11 caps)

**Files (CREATE):**
- `cockpit/chat/messages/python/project.json` … `cockpit/chat/a2ui/python/project.json` (11 total)

- [ ] **Step 1: Create a project.json per cap**

Use this template per cap, substituting `<name>` (kebab) and `<port>` (the pythonPort from Task 1):

```json
{
  "name": "cockpit-chat-<name>-python",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/chat/<name>/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/cockpit/chat/<name>/python"],
      "options": {
        "outputPath": "dist/cockpit/chat/<name>/python",
        "main": "cockpit/chat/<name>/python/src/index.ts",
        "tsConfig": "cockpit/chat/<name>/python/tsconfig.json"
      }
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/chat/<name>/python",
        "command": "uv run langgraph dev --port <port> --no-browser"
      }
    }
  }
}
```

Concrete `<name>` / `<port>` pairs (write all 11):
- messages / 5501
- input / 5502
- interrupts / 5503
- tool-calls / 5504
- subagents / 5505
- threads / 5506
- timeline / 5507
- generative-ui / 5508
- debug / 5509
- theming / 5510
- a2ui / 5511

- [ ] **Step 2: Add tsconfig.json where missing**

Some per-cap dirs already have `tsconfig.json` (mirroring umbrella's pattern), some don't. For each cap, check `cockpit/chat/<name>/python/tsconfig.json` — if missing, create it as:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../../dist/cockpit/chat/<name>/python",
    "module": "ESNext",
    "moduleResolution": "Node",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Verify nx discovers projects**

Run: `pnpm nx show projects | grep cockpit-chat-.*-python | sort`
Expected: 11 lines, one per cap (`cockpit-chat-messages-python`, etc.)

- [ ] **Step 4: Verify builds**

Run: `pnpm nx run-many -t build --projects='cockpit-chat-*-python'`
Expected: 11 builds green.

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/*/python/project.json cockpit/chat/*/python/tsconfig.json
git commit -m "feat(c-per-cap): add nx project.json (build+serve) per chat capability"
```

---

## Task 4: Fix all 11 `environment.development.ts`

**Files:**
- Modify: `cockpit/chat/<name>/angular/src/environments/environment.development.ts` × 11

- [ ] **Step 1: Replace each file**

For each cap, the file becomes (keep the existing field NAME, only change values):

**Pattern A — most caps use `streamingAssistantId`:**

`cockpit/chat/messages/angular/src/environments/environment.development.ts`:
```ts
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  streamingAssistantId: 'c-messages',
};
```

Same shape for: `input` (`c-input`), `interrupts` (`c-interrupts`), `tool-calls` (`c-tool-calls`), `subagents` (`c-subagents`), `threads` (`c-threads`), `timeline` (`c-timeline`), `debug` (`c-debug`), `theming` (`c-theming`). 9 files using `streamingAssistantId`.

**Pattern B — generative-ui uses `generativeUiAssistantId`:**

`cockpit/chat/generative-ui/angular/src/environments/environment.development.ts`:
```ts
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  generativeUiAssistantId: 'c-generative-ui',
};
```

**Pattern C — a2ui uses `a2uiAssistantId`:**

`cockpit/chat/a2ui/angular/src/environments/environment.development.ts`:
```ts
export const environment = {
  production: false,
  langGraphApiUrl: '/api',
  a2uiAssistantId: 'c-a2ui',
};
```

- [ ] **Step 2: Verify each Angular project still builds**

Run: `pnpm nx run-many -t build --projects='cockpit-chat-*-angular'`
Expected: 11 builds green (no TS errors from field rename — we kept the field names).

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/*/angular/src/environments/environment.development.ts
git commit -m "fix(c-per-cap): point dev env at /api proxy with c-<topic> assistant ids"
```

---

## Task 5: Fix all 11 `proxy.conf.json`

**Files:**
- Modify: `cockpit/chat/<name>/angular/proxy.conf.json` × 11

- [ ] **Step 1: Replace each file**

Use the cap's pythonPort (5501-5511):

```json
{
  "/api": {
    "target": "http://localhost:<port>",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" },
    "ws": true
  }
}
```

Pairs: messages/5501, input/5502, interrupts/5503, tool-calls/5504, subagents/5505, threads/5506, timeline/5507, generative-ui/5508, debug/5509, theming/5510, a2ui/5511.

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/*/angular/proxy.conf.json
git commit -m "fix(c-per-cap): proxy /api to per-cap python backend (port+1000)"
```

---

## Task 6: Sync the 7 prompt-only caps' `prompts/<name>.md` from umbrella

**Files:**
- Modify: `cockpit/chat/<name>/python/prompts/<name>.md` × 7 (messages, input, interrupts, threads, timeline, debug, theming)

- [ ] **Step 1: Copy from umbrella**

For each of the 7 prompt-only caps, copy the umbrella's aviation-themed prompt into the per-cap dir:

```bash
for cap in messages input interrupts threads timeline debug theming; do
  cp "cockpit/langgraph/streaming/python/prompts/${cap}.md" \
     "cockpit/chat/${cap}/python/prompts/${cap}.md"
done
```

- [ ] **Step 2: Verify the diff is now empty for those 7**

```bash
for cap in messages input interrupts threads timeline debug theming; do
  diff -q "cockpit/langgraph/streaming/python/prompts/${cap}.md" \
          "cockpit/chat/${cap}/python/prompts/${cap}.md"
done
```
Expected: no output (all files identical).

- [ ] **Step 3: Commit**

```bash
git add cockpit/chat/*/python/prompts/*.md
git commit -m "fix(c-per-cap): sync prompt-only prompts to umbrella aviation rewrites (PR 2)"
```

---

## Task 7: Verify the 7 prompt-only caps' `graph.py` structure (no changes expected)

**Files:**
- Read-only: `cockpit/chat/<name>/python/src/graph.py` × 7

- [ ] **Step 1: Verify the existing single-node pattern**

For each cap (messages, input, interrupts, threads, timeline, debug, theming), the existing `graph.py` should already match the pattern: single async node, `ChatOpenAI(model="gpt-5-mini", streaming=True)`, reads `prompts/<name>.md` via `Path(__file__).parent.parent / "prompts" / "<name>.md"`. Confirm via:

```bash
for cap in messages input interrupts threads timeline debug theming; do
  echo "=== $cap ==="
  grep -E "ChatOpenAI|read_text|model=" "cockpit/chat/${cap}/python/src/graph.py"
done
```
Expected output for each: `ChatOpenAI(model="gpt-5-mini", streaming=True)` and a `.read_text()` call.

- [ ] **Step 2: If any cap deviates, replace with the canonical pattern**

If any cap shows a deviation (different model, different prompt path, multi-node graph), replace its `graph.py` with this template (substituting `<name>` and `<NAME>`):

```python
"""Chat <NAME> Graph — single-node prompt LLM."""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_<name>_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "<name>.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_<name>_graph()
```

- [ ] **Step 3: Commit (or skip if no changes)**

```bash
git add cockpit/chat/*/python/src/graph.py 2>/dev/null && \
  git commit -m "fix(c-per-cap): align prompt-only graph.py to canonical single-node pattern" || \
  echo "No graph.py changes needed"
```

---

## Task 8: Rewrite c-tool-calls per-cap to match umbrella

**Files:**
- Modify: `cockpit/chat/tool-calls/python/src/graph.py`
- Create: `cockpit/chat/tool-calls/python/src/aviation_tools.py` (inlined; matches PR 1 pattern)

- [ ] **Step 1: Create inlined aviation_tools.py**

Replace or create `cockpit/chat/tool-calls/python/src/aviation_tools.py` with the 3 tools (lookup_flight, get_airport_info, find_routes) and a minimal hardcoded dataset (10 airports, 4 airlines, ~30 flights). Copy the file verbatim from `cockpit/langgraph/streaming/python/src/aviation_tools.py` (umbrella), then change the import line at the top to be self-contained:

```bash
# After the cp, edit the import to NOT depend on aviation_data.py
cp cockpit/langgraph/streaming/python/src/aviation_tools.py cockpit/chat/tool-calls/python/src/aviation_tools.py
```

If the umbrella aviation_tools.py imports from `aviation_data.py`, also copy `aviation_data.py` into the same dir:

```bash
cp cockpit/langgraph/streaming/python/src/aviation_data.py cockpit/chat/tool-calls/python/src/aviation_data.py
```

(The umbrella copies are the canonical source. Standalone holds duplicates per the "full copy" policy.)

- [ ] **Step 2: Replace graph.py with the umbrella's tool-calls implementation**

Read `cockpit/langgraph/streaming/python/src/chat_graphs.py` and find the `_build_tool_calls_graph()` function plus its prompt file reference. Create `cockpit/chat/tool-calls/python/src/graph.py`:

```python
"""Chat Tool-Calls Graph — canonical agent ↔ ToolNode loop with aviation tools.

Mirrors umbrella's c-tool-calls. Self-contained: aviation_tools + aviation_data
copied into this module.
"""

from pathlib import Path
from typing import Literal

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

from src.aviation_tools import ALL_TOOLS as AVIATION_TOOLS

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_tool_calls_graph():
    """Canonical agent ↔ ToolNode loop with aviation tools bound."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(AVIATION_TOOLS)
    system_prompt = (PROMPTS_DIR / "tool-calls.md").read_text()

    async def agent(state: MessagesState) -> dict:
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "__end__"

    g = StateGraph(MessagesState)
    g.add_node("agent", agent)
    g.add_node("tools", ToolNode(AVIATION_TOOLS))
    g.set_entry_point("agent")
    g.add_conditional_edges("agent", should_continue)
    g.add_edge("tools", "agent")

    return g.compile()


graph = build_tool_calls_graph()
```

- [ ] **Step 3: Verify it imports + the prompt file already exists**

Run:
```bash
ls cockpit/chat/tool-calls/python/prompts/tool-calls.md
cd cockpit/chat/tool-calls/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)"
```
Expected: file exists; printed `CompiledStateGraph`.

If the prompt file content differs from umbrella's, also copy that:
```bash
cp cockpit/langgraph/streaming/python/prompts/tool-calls.md cockpit/chat/tool-calls/python/prompts/tool-calls.md
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/tool-calls/python/src/graph.py cockpit/chat/tool-calls/python/src/aviation_tools.py cockpit/chat/tool-calls/python/src/aviation_data.py cockpit/chat/tool-calls/python/prompts/tool-calls.md
git commit -m "feat(c-tool-calls standalone): full graph + inlined aviation tools (matches PR 1)"
```

---

## Task 9: Rewrite c-subagents per-cap to match umbrella

**Files:**
- Modify: `cockpit/chat/subagents/python/src/graph.py`
- Create: `cockpit/chat/subagents/python/src/aviation_tools.py` + `aviation_data.py` (inlined)
- Modify (if drifted): `cockpit/chat/subagents/python/prompts/subagents.md`

- [ ] **Step 1: Inline aviation tools + data**

```bash
cp cockpit/langgraph/streaming/python/src/aviation_tools.py cockpit/chat/subagents/python/src/aviation_tools.py
cp cockpit/langgraph/streaming/python/src/aviation_data.py cockpit/chat/subagents/python/src/aviation_data.py
```

- [ ] **Step 2: Copy umbrella subagent code into per-cap graph.py**

Read `cockpit/langgraph/streaming/python/src/chat_graphs.py`. Find `_RESEARCH_PROMPT`, `_BOOKING_PROMPT`, `_ITINERARY_PROMPT`, the `_run_subagent()` helper, the `@tool task(...)` definition, and `_build_subagents_graph()`. Build `cockpit/chat/subagents/python/src/graph.py` with the equivalent self-contained module:

```python
"""Chat Subagents Graph — orchestrator LLM with a single `task` tool that
dispatches to specialized aviation subagents (research/booking/itinerary).

Mirrors umbrella's c-subagents. Self-contained: aviation_tools + aviation_data
copied into this module.
"""

from pathlib import Path
from typing import Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState, END
from langgraph.prebuilt import ToolNode

from src.aviation_tools import get_airport_info, find_routes, lookup_flight

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


_RESEARCH_PROMPT = """You research a destination airport. Given a city or
airport code, call get_airport_info to fetch its details and return a brief
paragraph summarizing terminals, weather, and any notable facts."""

_BOOKING_PROMPT = """You find a flight. Given an origin/destination pair,
call find_routes and (optionally) lookup_flight on the most promising option.
Return a single recommended flight with airline, depart/arrive times, and price."""

_ITINERARY_PROMPT = """You assemble a trip itinerary. Given the research and
booking notes from prior subagents, synthesize a 3-bullet trip plan: flight,
arrival, suggested first activity. No tools — synthesis only."""


async def _run_subagent(prompt: str, task_description: str, tools: list) -> str:
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)
    bound = llm.bind_tools(tools) if tools else llm
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=task_description),
    ]
    for _ in range(3):
        response = await bound.ainvoke(messages)
        messages.append(response)
        if not getattr(response, "tool_calls", None):
            return response.content if isinstance(response.content, str) else str(response.content)
        for tool_call in response.tool_calls:
            chosen = next((t for t in tools if t.name == tool_call["name"]), None)
            if chosen is None:
                continue
            result = await chosen.ainvoke(tool_call["args"])
            messages.append(
                HumanMessage(content=f"Tool {chosen.name} returned: {result}")
            )
    return "Subagent reached max iterations."


@tool
async def task(role: Literal["research", "booking", "itinerary"], task_description: str) -> str:
    """Delegate a subtask to a specialized aviation subagent."""
    if role == "research":
        return await _run_subagent(_RESEARCH_PROMPT, task_description, [get_airport_info])
    if role == "booking":
        return await _run_subagent(_BOOKING_PROMPT, task_description, [find_routes, lookup_flight])
    return await _run_subagent(_ITINERARY_PROMPT, task_description, [])


def build_subagents_graph():
    """Orchestrator LLM with a single `task` tool dispatching to subagent fns."""
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools([task])
    system_prompt = (PROMPTS_DIR / "subagents.md").read_text()

    async def orchestrator(state: MessagesState) -> dict:
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "__end__"

    g = StateGraph(MessagesState)
    g.add_node("orchestrator", orchestrator)
    g.add_node("tools", ToolNode([task]))
    g.set_entry_point("orchestrator")
    g.add_conditional_edges("orchestrator", should_continue)
    g.add_edge("tools", "orchestrator")

    return g.compile()


graph = build_subagents_graph()
```

If the umbrella's actual `_run_subagent`, prompts, or `task` tool implementation differ in details (model name, prompt body, iteration count), substitute the umbrella values. The umbrella file is at `cockpit/langgraph/streaming/python/src/chat_graphs.py`.

- [ ] **Step 3: Sync the prompt file**

```bash
cp cockpit/langgraph/streaming/python/prompts/subagents.md cockpit/chat/subagents/python/prompts/subagents.md
```

- [ ] **Step 4: Verify it imports**

```bash
cd cockpit/chat/subagents/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)"
```
Expected: `CompiledStateGraph`.

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/subagents/python/src/graph.py cockpit/chat/subagents/python/src/aviation_tools.py cockpit/chat/subagents/python/src/aviation_data.py cockpit/chat/subagents/python/prompts/subagents.md
git commit -m "feat(c-subagents standalone): full orchestrator+task graph + inlined aviation tools (matches PR 1)"
```

---

## Task 10: Verify generative-ui + a2ui per-cap copies in sync

**Files:**
- Read-only: `cockpit/chat/generative-ui/python/src/*.py`, `cockpit/chat/a2ui/python/src/*.py`

- [ ] **Step 1: Diff structure vs umbrella**

```bash
echo "--- generative-ui graph.py vs umbrella dashboard_graph.py ---"
diff -q cockpit/chat/generative-ui/python/src/graph.py cockpit/langgraph/streaming/python/src/dashboard_graph.py || echo "(differences expected — different import roots)"

echo "--- a2ui graph.py vs umbrella a2ui_graph.py ---"
diff cockpit/chat/a2ui/python/src/graph.py cockpit/langgraph/streaming/python/src/a2ui_graph.py | head -20
```

Both files were synced in PRs 3, 4, and the bug-fix PRs A/E. The diff should show only the import-substitution block (per-cap inlines `_FLIGHTS` and friends instead of `from src.aviation_tools import find_routes`). If a non-trivial logic divergence appears, port the umbrella version into the per-cap, preserving the per-cap's inlined data-tools block.

- [ ] **Step 2: Smoke import**

```bash
cd cockpit/chat/generative-ui/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)"
cd cockpit/chat/a2ui/python && uv run python -c "from src.graph import graph; print(type(graph).__name__)"
```
Expected: both print `CompiledStateGraph`.

- [ ] **Step 3: Commit (only if changes)**

If no changes: skip. Otherwise:
```bash
git add cockpit/chat/generative-ui/python/src/graph.py cockpit/chat/a2ui/python/src/graph.py
git commit -m "chore(c-per-cap): re-sync generative-ui + a2ui standalone with umbrella"
```

---

## Task 11: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Build every chat python**

Run: `pnpm nx run-many -t build --projects='cockpit-chat-*-python'`
Expected: 11 builds green.

- [ ] **Step 2: Build every chat angular**

Run: `pnpm nx run-many -t build --projects='cockpit-chat-*-angular'`
Expected: 11 builds green.

- [ ] **Step 3: Verify production deploy manifest unchanged**

```bash
git stash push -m "wip" -- cockpit chat/* 2>/dev/null || true
npx tsx scripts/generate-shared-deployment-config.ts
git diff deployments/shared-dev/langgraph.json
```
Expected: empty diff (manifest unchanged because production deploy still uses umbrella `pythonDir`).

If diff is non-empty, the production-deploy script picked up our pythonPort field where it shouldn't. Re-read Task 1's notes.

```bash
git stash pop 2>/dev/null || true
```

- [ ] **Step 4: No commit (verification only)**

---

## Task 12: Boot smoke — every per-cap backend starts cleanly

**Files:** none (verification only)

- [ ] **Step 1: Ensure no stale 55XX backends listening**

```bash
for p in 5501 5502 5503 5504 5505 5506 5507 5508 5509 5510 5511; do
  pid=$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
done
sleep 2
```

- [ ] **Step 2: Boot each backend in sequence, confirm /ok, kill**

Run this script from the repo root:

```bash
set -a; source .env; set +a
for cap_port in "messages:5501" "input:5502" "interrupts:5503" "tool-calls:5504" "subagents:5505" "threads:5506" "timeline:5507" "generative-ui:5508" "debug:5509" "theming:5510" "a2ui:5511"; do
  cap=${cap_port%%:*}
  port=${cap_port##*:}
  echo "=== booting $cap on $port ==="
  pnpm nx run cockpit-chat-${cap}-python:serve > /tmp/boot-${cap}.log 2>&1 &
  pid=$!
  for _ in $(seq 1 60); do
    grep -q "Application started up" /tmp/boot-${cap}.log 2>/dev/null && break
    sleep 1
  done
  if grep -q "Application started up" /tmp/boot-${cap}.log; then
    echo "  ✓ $cap up"
  else
    echo "  ✗ $cap FAILED — log tail:"
    tail -15 /tmp/boot-${cap}.log
  fi
  kill $pid 2>/dev/null
  sleep 2
done
```

Expected output: 11 lines all reading `✓ <cap> up`.

If any cap fails, inspect `/tmp/boot-<cap>.log` for the import error, fix the relevant earlier task's code, restart the smoke loop for that cap.

- [ ] **Step 3: No commit (verification only)**

---

## Task 13: Manual chrome MCP smoke — 3 spot checks

**Files:** none (verification only). Requires `OPENAI_API_KEY` in repo-root `.env`.

The user requested chrome MCP verification. Spot-check 3 representative caps: `messages` (simplest), `tool-calls` (LLM + tools), `a2ui` (most complex).

For each of the 3, perform this sequence:

- [ ] **Step 1: For `c-messages` (simple prompt LLM)**

1. Start backend: `pnpm nx run cockpit-chat-messages-python:serve` (background)
2. Start frontend: `pnpm nx serve cockpit-chat-messages-angular --port 4501` (background)
3. Wait for both ready (grep logs for `Application started up` and `Local:`)
4. Chrome MCP: navigate to `http://localhost:4501/`, JS-inject `"Hello"` into the textarea and press Enter (use the same JS pattern from PR 4 / PR 3 chrome tests)
5. Wait 15s, screenshot — expect a conversational AI reply on screen
6. Kill both processes

- [ ] **Step 2: For `c-tool-calls`**

1. Start backend `cockpit-chat-tool-calls-python:serve` on 5504
2. Start frontend `cockpit-chat-tool-calls-angular --port 4504`
3. Chrome MCP: navigate to `http://localhost:4504/`, send `"What is UA123?"`
4. Wait 25s, screenshot — expect: tool-call card for `lookup_flight` + an AI response mentioning UA123 / LAX→JFK / 16:30 arrival
5. Kill both processes

- [ ] **Step 3: For `c-a2ui`**

1. Start backend `cockpit-chat-a2ui-python:serve` on 5511
2. Start frontend `cockpit-chat-a2ui-angular --port 4511`
3. Chrome MCP: navigate to `http://localhost:4511/`, send `"I want to fly from LAX to JFK"`
4. Wait 30s, screenshot — expect the aviation booking form with Origin/Destination/Date/Passengers/Fare class/Search flights
5. Kill both processes

- [ ] **Step 4: No commit (verification only)**

If any spot check fails, debug per-cap (likely wrong prompt path or stale graph code), fix the earlier task, re-run.

---

## Task 14: Open PR, watch CI, merge on green

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(c-per-cap): standalone backends — nx serve + dev env cleanup" --body "$(cat <<'EOF'
## Summary
- Make every cockpit/chat/<name>/python/ a runnable per-cap example backend:
  - New nx serve target (\`uv run langgraph dev --port <pythonPort>\`)
  - pythonPort = angular port + 1000 (5501-5511), captured in capability-registry.ts
- Fix the dev-loop wiring so Angular dev actually hits the per-cap backend (instead of bypassing to ECONNREFUSED on dead ports):
  - dev env URL → /api (proxied)
  - dev env assistantId value → c-<topic> consistently
  - proxy.conf target → localhost:<pythonPort>
- Fix 2 inconsistency outliers: standalone langgraph.json names (\`generative_ui\` → \`c-generative-ui\`, \`a2ui_form\` → \`c-a2ui\`)
- Sync per-cap python content to match umbrella's c-<topic> emission today:
  - 7 prompt-only caps: aviation prompts from PR 2 copied in
  - c-tool-calls: full PR 1 implementation + inlined aviation_tools
  - c-subagents: full PR 1 implementation + inlined aviation_tools
  - c-generative-ui, c-a2ui: verified in sync (synced inline during PR 3/4)
- Production deploy unchanged: shared LangGraph Cloud manifest (deployments/shared-dev/langgraph.json) regenerates byte-identically; pythonDir in capability-registry.ts still points at umbrella.

## Test plan
- [x] \`pnpm nx run-many -t build --projects='cockpit-chat-*-python'\` — green
- [x] \`pnpm nx run-many -t build --projects='cockpit-chat-*-angular'\` — green
- [x] \`npx tsx scripts/generate-shared-deployment-config.ts\` — diff of deployments/shared-dev/langgraph.json is empty
- [x] Boot smoke: every per-cap backend (5501-5511) starts cleanly via nx serve, returns Application-started log
- [x] Chrome MCP smoke (3 caps): c-messages, c-tool-calls, c-a2ui — each renders correctly against its own per-cap backend
- [ ] CI

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

`gh pr checks <PR_NUMBER> --watch`

- [ ] **Step 4: Squash-merge on green**

`gh pr merge <PR_NUMBER> --squash`

---

## Self-Review

**Spec coverage:**
- Decision 1 (production source unchanged) → Task 11 Step 3 asserts ✓
- Decision 2 (full copies, no umbrella imports) → Tasks 8/9 inline aviation_tools+data ✓
- Decision 3 (port+1000 in registry) → Task 1 ✓
- Decision 4 (nx serve target) → Task 3 ✓
- Decision 5 (content sync) → Tasks 6-10 ✓
- Port table → Tasks 1, 3, 5 all use the same numbers ✓
- Wiring fixes (1: project.json, 2: langgraph.json outliers, 3: env files, 4: proxy.conf, 5: registry) → Tasks 3, 2, 4, 5, 1 respectively ✓
- Boot smoke → Task 12 ✓
- Chrome MCP smoke (3 caps) → Task 13 ✓
- Production deploy unchanged → Task 11 Step 3 ✓

**Placeholder scan:** No TBDs. Task 7 Step 2 has a conditional "if any cap deviates, replace with template" — that's an audit step with a complete fix template; acceptable. Task 9 Step 2 says "if the umbrella's actual prompts differ in details, substitute the umbrella values" — acceptable because we explicitly point at the source-of-truth file path.

**Type consistency:** Port numbers (5501-5511) appear identically in Tasks 1, 3, 5, 12. Field names (`pythonPort`, `streamingAssistantId`, etc.) are stable across tasks. Cap order (messages, input, interrupts, tool-calls, subagents, threads, timeline, generative-ui, debug, theming, a2ui) used consistently.
