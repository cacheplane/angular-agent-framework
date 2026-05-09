# Canonical `examples/chat` Demo — Phase 3A: Interrupts (HITL) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer human-in-the-loop interrupts onto the canonical demo by adding a `request_approval` tool that calls LangGraph's `interrupt()` to pause the graph mid-execution. Wire `<chat-interrupt-panel>` into the demo shell with action handlers that resume the graph via `agent.submit(null, { command: { resume: ... } })`.

**Architecture:** Tool-driven (vs. topology node or conditional edge) — the AI decides when to ask for approval. The `request_approval(reason: str)` tool body calls `langgraph.types.interrupt()`, which the runtime catches, persisting state and pausing the graph. Resume via `Command(resume=<value>)` makes `interrupt(...)` return that value to the tool, which then returns its formatted string to the AI. Frontend mounts `<chat-interrupt-panel>` (interactive composition, NOT the auto-mounted passive `<chat-interrupt>` primitive) and translates its four-action vocabulary (`accept` / `edit` / `respond` / `ignore`) into Command resumes. Existing Phase 2B `tools` ToolNode handles routing automatically; zero new graph edges.

**Tech Stack:** Python 3.12 (uv, `langgraph.types.interrupt`, `langgraph.prebuilt.ToolNode`, `langchain-openai`, `langchain-core`), pytest. Angular 21 (signals, OnPush). No new dependencies — `interrupt` ships in `langgraph`.

**Spec:** `docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-3a-interrupts-design.md`

**Branch:** `claude/examples-chat-phase-3a-interrupts`, branched from `origin/main` (currently `794c914f`).

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. Mentions in markdown spec/plan docs are OK as third-party library names; do not propagate.

---

## File Structure

```
examples/chat/
├── python/
│   ├── src/graph.py                                       # +1 import, +1 tool, bind in 2 places, +1 paragraph in SYSTEM_PROMPT (~25 LOC)
│   └── tests/test_graph_smoke.py                          # +2 smoke tests
├── angular/src/app/
│   ├── shell/
│   │   ├── demo-shell.component.ts                        # +imports, +onInterruptAction handler (~30 LOC)
│   │   ├── demo-shell.component.html                      # +@if(agent.interrupt()) block (~5 LOC)
│   │   └── demo-shell.component.css                       # +.demo-shell__interrupt-panel (~10 LOC)
│   └── modes/welcome-suggestions.ts                       # +1 entry
└── smoke/CHECKLIST.md                                     # populate Interrupts section
```

Total ≈ 90 LOC.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/examples-chat-phase-3a-interrupts origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/examples-chat-phase-3a-interrupts
git log --oneline -1              # must be 794c914f or later
```

---

## Phase 1 — Python graph (TDD)

### Task 1.1: Failing tests

**File:** `examples/chat/python/tests/test_graph_smoke.py`

The current file has 4 tests (post Phase 2B). Append two new test functions at the END of the file:

```python


@pytest.mark.smoke
def test_request_approval_tool_exists():
    from src.graph import request_approval
    assert request_approval is not None
    # @tool decorator gives it a `.name` attribute
    assert request_approval.name == "request_approval"


@pytest.mark.smoke
def test_state_graph_still_includes_attach_citations_node():
    # Regression check: Phase 3A must not break Phase 2B topology.
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "tools" in nodes
    assert "attach_citations" in nodes
```

- [ ] **Step 2: Run smoke — both new tests must FAIL**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: 4 existing pass, 2 new FAIL. The first new test fails with `ImportError: cannot import name 'request_approval' from 'src.graph'`. The second new test passes (Phase 2B already added `tools` and `attach_citations` nodes) — it's a regression check, intentional that it stays green throughout.

If `test_request_approval_tool_exists` somehow passes, an earlier change already added the tool — STOP and report DONE_WITH_CONCERNS.

Do NOT commit yet — Task 1.2 commits the test + implementation together.

### Task 1.2: Implement the request_approval tool + graph wiring + system prompt

**File:** `examples/chat/python/src/graph.py`

Make four edits to the existing file (do NOT replace the whole file — Phase 2B's tool, ToolNode, attach_citations, and graph topology must all remain).

- [ ] **Step 1: Add `interrupt` import**

Locate the existing import block:

```python
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
```

Add a new import line directly below `from langgraph.prebuilt import ToolNode`:

```python
from langgraph.types import interrupt
```

So the import block becomes:

```python
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI
```

- [ ] **Step 2: Extend SYSTEM_PROMPT**

Locate the existing SYSTEM_PROMPT constant. It currently ends with:

```python
    "use the `search_documents` tool to find authoritative information before answering. "
    "Cite sources inline using Pandoc-style citation references with the "
    "document `id` field as the refId, e.g. `[^ng-signals-overview]` or "
    "`[^ng-control-flow]`. Each first-use of a document gets an auto-numbered "
    "marker; subsequent references to the same document share the number. "
    "Do not write `[1]` or `[1, 2]` — those are plain text and won't link to "
    "the sources panel."
)
```

Replace the closing `)` and the line above with one that adds the new paragraph:

```python
    "use the `search_documents` tool to find authoritative information before answering. "
    "Cite sources inline using Pandoc-style citation references with the "
    "document `id` field as the refId, e.g. `[^ng-signals-overview]` or "
    "`[^ng-control-flow]`. Each first-use of a document gets an auto-numbered "
    "marker; subsequent references to the same document share the number. "
    "Do not write `[1]` or `[1, 2]` — those are plain text and won't link to "
    "the sources panel. "
    "When the user describes a sensitive or destructive action (deleting "
    "data, sending a customer email, modifying production state, etc.), "
    "call `request_approval` with a clear `reason` BEFORE doing the action. "
    "Do not assume permission. The human's response will tell you whether to "
    "proceed, modify, or stop."
)
```

(Note the trailing space after "the sources panel." inside the closing string before the new paragraph — required so the concatenated string has a space between sentences.)

- [ ] **Step 3: Add the request_approval tool**

Locate the existing `search_documents` tool definition (decorated with `@tool`). Directly AFTER its closing line (`return json.dumps(hits[:4])`), add:

```python


@tool
def request_approval(reason: str) -> str:
    """Pause and request the human's approval before performing a sensitive
    or destructive action. Provide a clear reason — the human will see it.
    Returns the human's decision verbatim; incorporate it into your next
    step.
    """
    response = interrupt({"type": "approval_request", "reason": reason})
    return f"Human response: {response}"
```

- [ ] **Step 4: Bind both tools in `generate`**

Locate the existing line in `generate`:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents])
```

Replace with:

```python
    llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval])
```

- [ ] **Step 5: Pass both tools to ToolNode**

Locate the existing graph builder line:

```python
_builder.add_node("tools", ToolNode([search_documents]))
```

Replace with:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval]))
```

- [ ] **Step 6: Run smoke tests — all 6 must pass**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/python
uv run pytest -q -m smoke
```

Expected: `6 passed`.

- [ ] **Step 7: Run through Nx**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: pytest 6 passed; Nx reports `Successfully ran target smoke for project examples-chat-python`.

- [ ] **Step 8: Commit (test + implementation together)**

```bash
git add examples/chat/python/src/graph.py \
        examples/chat/python/tests/test_graph_smoke.py
git commit -m "feat(examples-chat-python): request_approval tool with langgraph interrupt"
```

---

## Phase 2 — Angular shell wiring

### Task 2.1: Add ChatInterruptPanelComponent + InterruptAction imports + onInterruptAction handler

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.ts`

The current file imports `ChatDebugComponent` from `@ngaf/chat`. Two edits.

- [ ] **Step 1: Extend the `@ngaf/chat` import**

Locate the existing line:

```ts
import { ChatDebugComponent } from '@ngaf/chat';
```

Replace with:

```ts
import { ChatDebugComponent, ChatInterruptPanelComponent, type InterruptAction } from '@ngaf/chat';
```

- [ ] **Step 2: Add ChatInterruptPanelComponent to the component's `imports` array**

Locate the line:

```ts
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent],
```

Replace with:

```ts
  imports: [RouterOutlet, ControlPalette, ChatDebugComponent, ChatInterruptPanelComponent],
```

- [ ] **Step 3: Add the `onInterruptAction` method to the `DemoShell` class**

Locate the existing `protected onNewConversation(): void {` method. After its closing brace `}`, add a new method:

```ts
  /**
   * Translates the four-action vocabulary from <chat-interrupt-panel>
   * into Command(resume=value) submissions. Phase 3A demo affordance:
   * window.prompt() for `edit` and `respond`. A production app would
   * inline a textarea editor.
   */
  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const interrupt = this.agent.interrupt?.();
    if (!interrupt) return;

    let resume: unknown;
    switch (action) {
      case 'accept':
        resume = 'approved';
        break;
      case 'edit': {
        const reason = (interrupt.value as { reason?: string })?.reason ?? '';
        const edited = window.prompt(
          `Edit your response (current proposal: "${reason}"):`,
          'approved',
        );
        if (edited == null) return;
        resume = edited;
        break;
      }
      case 'respond': {
        const text = window.prompt('Respond to the agent:', '');
        if (text == null) return;
        resume = text;
        break;
      }
      case 'ignore':
        resume = 'denied';
        break;
    }

    await this.agent.submit(null, { command: { resume } } as never);
  }
```

(The `as never` cast on `command` is needed because `LangGraphSubmitOptions.command` is generically typed; the resume payload is runtime-validated by the SDK.)

### Task 2.2: Add the interrupt panel to the demo-shell template

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.html`

The current template has:

```html
  @if (debugOpen()) {
    <div class="demo-shell__debug" role="region" aria-label="Debug overlay">
      <chat-debug [agent]="agent" />
    </div>
  }
</div>
```

- [ ] **Step 1: Insert the interrupt-panel block above the debug block**

Replace that block with:

```html
  @if (agent.interrupt && agent.interrupt()) {
    <div class="demo-shell__interrupt-panel" role="region" aria-label="Approval required">
      <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
    </div>
  }

  @if (debugOpen()) {
    <div class="demo-shell__debug" role="region" aria-label="Debug overlay">
      <chat-debug [agent]="agent" />
    </div>
  }
</div>
```

The `agent.interrupt && agent.interrupt()` guard is because `interrupt` is typed `Signal<AgentInterrupt | undefined>` on `Agent` but `interrupt?` is optional on the `Agent` interface (some runtimes don't implement it). LangGraph does, so this always evaluates correctly at runtime, but the optional chain keeps strict-null happy.

### Task 2.3: Position the interrupt panel via CSS

**File:** `examples/chat/angular/src/app/shell/demo-shell.component.css`

The current file has `:host`, `.demo-shell`, and `.demo-shell__debug` rules.

- [ ] **Step 1: Append the interrupt-panel rule**

Add at the end of the file:

```css

.demo-shell__interrupt-panel {
  position: fixed;
  left: 50%;
  bottom: 96px;            /* sits above the chat input footer */
  transform: translateX(-50%);
  z-index: 998;            /* below the debug drawer (999), above chat content */
  width: min(640px, calc(100vw - 32px));
  background: #1a1d23;
  border: 1px solid #4f8df5;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  padding: 12px 14px;
}
```

- [ ] **Step 2: Build to confirm no type errors**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -5
```

Expected: build succeeds.

If the build fails on `ChatInterruptPanelComponent` not exported, double-check `libs/chat/src/public-api.ts` for the export — it should be there (verified during planning at line 76).

If the build fails on `command` in `agent.submit`, the cast needs adjusting. The interim diagnostic: `npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | head -40` will show the exact error.

- [ ] **Step 3: Run tests — should remain green**

```bash
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -5
```

Expected: 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add examples/chat/angular/src/app/shell/demo-shell.component.ts \
        examples/chat/angular/src/app/shell/demo-shell.component.html \
        examples/chat/angular/src/app/shell/demo-shell.component.css
git commit -m "feat(examples-chat-angular): mount chat-interrupt-panel + onInterruptAction handler"
```

---

## Phase 3 — Welcome suggestion entry

### Task 3.1: Append the welcome suggestion

**File:** `examples/chat/angular/src/app/modes/welcome-suggestions.ts`

The current file has 7 entries. Locate the closing `];` of the array. Insert directly before it:

```ts
  {
    label: 'Demo: ask for approval before a sensitive action',
    value:
      'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
  },
```

The full array now has 8 entries.

- [ ] **Step 1: Build to confirm no syntax error**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 2: Confirm welcome list size**

```bash
grep -c "label:" examples/chat/angular/src/app/modes/welcome-suggestions.ts
```

Expected: `8`.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/angular/src/app/modes/welcome-suggestions.ts
git commit -m "feat(examples-chat-angular): welcome suggestion exercising interrupts"
```

---

## Phase 4 — CHECKLIST.md

### Task 4.1: Populate Interrupts / human-in-the-loop section

**File:** `examples/chat/smoke/CHECKLIST.md`

Locate the empty `## Interrupts / human-in-the-loop` heading. It currently looks like:

```markdown
## Interrupts / human-in-the-loop

```

(possibly with `## Generative UI / A2UI surfaces` and other empty sections after.)

- [ ] **Step 1: Replace just the empty heading with the populated section**

```markdown
## Interrupts / human-in-the-loop

- [ ] Click "Demo: ask for approval before a sensitive action" welcome suggestion
- [ ] AI begins planning, then calls `request_approval` tool — graph pauses
- [ ] Interrupt panel appears above the input with the AI's reason text
- [ ] Click Accept — graph resumes with `'approved'`; AI proceeds with the plan
- [ ] (New conversation, click suggestion again) — Click Edit, type a custom response in the prompt — graph resumes with the typed text
- [ ] (New conversation, click suggestion again) — Click Ignore — graph resumes with `'denied'`; AI acknowledges and stops
- [ ] During pause: server state shows the interrupt — `curl localhost:2024/threads/<id>/state` reports `next` includes the interrupted node and a pending interrupt value
```

DO NOT touch other empty Phase 2+ sections (`## Subagents`, `## Generative UI / A2UI surfaces`, `## Time travel / timeline`, `## Multi-thread`).

- [ ] **Step 2: Verify the diff**

```bash
git diff examples/chat/smoke/CHECKLIST.md | head -30
```

Expected: only the Interrupts section gains content; nothing else changes.

- [ ] **Step 3: Commit**

```bash
git add examples/chat/smoke/CHECKLIST.md
git commit -m "docs(examples-chat-smoke): populate Interrupts checklist"
```

---

## Phase 5 — Verification + PR

### Task 5.1: Full local sweep

- [ ] **Step 1: Python smoke**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run examples-chat-python:smoke --skip-nx-cache 2>&1 | tail -3
```

Expected: 6 passed.

- [ ] **Step 2: Angular tests**

```bash
npx nx run examples-chat-angular:test --skip-nx-cache 2>&1 | tail -3
```

Expected: 9 tests pass.

- [ ] **Step 3: Angular lint**

```bash
npx nx run examples-chat-angular:lint --skip-nx-cache 2>&1 | tail -3
```

Expected: 0 errors.

- [ ] **Step 4: Angular build**

```bash
npx nx run examples-chat-angular:build --skip-nx-cache --configuration=development 2>&1 | tail -3
```

Expected: build succeeds.

- [ ] **Step 5: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```

Expected: 4 commits.

- [ ] **Step 6: Server-side end-to-end probe (interrupt + resume)**

Confirm `OPENAI_API_KEY` is in `examples/chat/python/.env`:

```bash
ls examples/chat/python/.env 2>/dev/null || grep "OPENAI_API_KEY" .env > examples/chat/python/.env
head -1 examples/chat/python/.env | cut -c1-30
```

Start the backend in the background:

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-3a.log 2>&1 &
sleep 4
curl -sf http://localhost:2024/ok && echo " backend OK"
```

Submit the database-backups welcome prompt that triggers `request_approval`. Use `runs/wait` (which returns final state including any pause):

```bash
tid=$(curl -sf -X POST -H 'Content-Type: application/json' http://localhost:2024/threads -d '{}' | python3 -c "import sys,json;print(json.load(sys.stdin)['thread_id'])")
echo "thread=$tid"
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d "{\"assistant_id\":\"chat\",\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.\"}],\"model\":\"gpt-5-mini\"}}" \
  > /tmp/3a-paused.json
```

Inspect the response — at this point the graph SHOULD be paused at an interrupt:

```bash
python3 << 'EOF'
import json
d = json.load(open('/tmp/3a-paused.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
ai_with_tool_calls = [m for m in msgs if m.get('type') == 'ai' and m.get('tool_calls')]
print('total msgs:', len(msgs))
print('AI messages with tool_calls:', len(ai_with_tool_calls))
for ai in ai_with_tool_calls[-1:]:
    for tc in ai.get('tool_calls', []):
        print('  tool_call:', tc.get('name'), '/', json.dumps(tc.get('args', {}))[:80])
EOF
```

Expected: at least one AI message has a `tool_call` with `name: 'request_approval'`. The graph is paused inside that tool. Confirm via thread state:

```bash
curl -sf "http://localhost:2024/threads/$tid/state" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('next:', d.get('next'))
tasks = d.get('tasks', [])
print('tasks count:', len(tasks))
for t in tasks:
    interrupts = t.get('interrupts', [])
    print('  task name:', t.get('name'), 'interrupts:', len(interrupts))
    for it in interrupts[:1]:
        print('    interrupt value:', json.dumps(it.get('value'))[:120])
"
```

Expected: `next` includes the `tools` node; tasks contains a pending interrupt with `value` like `{"type": "approval_request", "reason": "..."}`.

Now resume the graph with `Command(resume='approved')`:

```bash
curl -sf -X POST -H 'Content-Type: application/json' "http://localhost:2024/threads/$tid/runs/wait" \
  -d "{\"assistant_id\":\"chat\",\"command\":{\"resume\":\"approved\"}}" \
  > /tmp/3a-resumed.json

python3 << 'EOF'
import json
d = json.load(open('/tmp/3a-resumed.json'))
msgs = d.get('messages', []) if isinstance(d, dict) else []
final_ai = [m for m in msgs if m.get('type') == 'ai' and not m.get('tool_calls')]
print('total msgs:', len(msgs))
print('final AI (no tool_calls):', len(final_ai))
if final_ai:
    c = final_ai[-1].get('content', '')
    text = c if isinstance(c, str) else next((b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text'), '')
    print('final answer preview:', text[:200].replace('\n', ' '))
EOF
```

Expected: a final AI message exists (no tool_calls), and its text references the approval and provides the plan/cleanup steps. This confirms the interrupt → resume → final-answer cycle works end-to-end.

- [ ] **Step 7: Stop backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```

Expected: nothing listening on :2024.

### Task 5.2: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/examples-chat-phase-3a-interrupts 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(examples-chat): Phase 3A — interrupts (HITL)" --body "$(cat <<'EOF'
## Summary

Layers human-in-the-loop interrupts onto the canonical demo by adding a `request_approval` tool that calls `langgraph.types.interrupt()` to pause the graph mid-execution. Mounts `<chat-interrupt-panel>` (interactive composition) in the demo shell and translates its four-action vocabulary into Command resumes.

- **Python graph**: 1-line import (`langgraph.types.interrupt`), 1 new `@tool` decorator function (~10 LOC), bind in 2 places (LLM `bind_tools`, ToolNode), 1 paragraph appended to SYSTEM_PROMPT. Existing Phase 2B `tools` ToolNode handles routing; zero new graph edges.
- **Demo shell**: import `ChatInterruptPanelComponent` + `InterruptAction` from `@ngaf/chat`; add to `imports` array; new `onInterruptAction` handler maps `'accept' | 'edit' | 'respond' | 'ignore'` to `agent.submit(null, { command: { resume } })`. `window.prompt()` is the demo affordance for `edit` and `respond`.
- **Welcome suggestion**: 8th entry "Demo: ask for approval before a sensitive action" — concrete database-backups scenario.
- **CHECKLIST.md**: Interrupts / human-in-the-loop section populated.

The `<chat-interrupt-panel>` is the *interactive* composition (NOT the auto-mounted passive `<chat-interrupt>` primitive that just shows "Agent paused"). The shell mounts it with `@if (agent.interrupt && agent.interrupt())` so it only appears during a pause.

Spec: \`docs/superpowers/specs/2026-05-08-canonical-chat-demo-phase-3a-interrupts-design.md\`
Plan: \`docs/superpowers/plans/2026-05-08-canonical-chat-demo-phase-3a-interrupts.md\`

Phase 3B (subagents) is a separate spec/plan/PR cycle. Phase 4+ (generative UI, time travel, multi-thread) are later.

## Test plan

### Verified locally
- [x] \`nx run examples-chat-python:smoke\` — 6 passed (4 existing + 2 new)
- [x] \`nx run examples-chat-angular:test\` — 9 passed
- [x] \`nx run examples-chat-angular:lint\` — 0 errors
- [x] \`nx run examples-chat-angular:build\` — succeeds (development)
- [x] **Server-side end-to-end probe**: submit the database-backups welcome prompt with model=gpt-5-mini. Initial response: AI message with tool_calls=[{name: 'request_approval', args: {reason: ...}}], graph paused with \`next\` including the tools node and a pending interrupt value of shape \`{type: 'approval_request', reason: ...}\`. Resume via \`runs/wait\` with \`command={resume: 'approved'}\` produces a final AI message (no tool_calls) with a substantive plan response.

### Pending visual verification
- [ ] After merge: live smoke against the workspace \`examples/chat\` demo. Interrupt panel appears above the chat input when the graph pauses; all four actions (accept/edit/respond/ignore) resume the graph as expected.

(Visual sweep continues against issue #214; rolls together with the next iteration.)
EOF
)"
```

- [ ] **Step 3: Note the PR URL.**

- [ ] **Step 4: Wait for CI; address failures.**

- [ ] **Step 5: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (6 pytest), `nx run examples-chat-angular:test/lint/build`.
3. Server-side probe confirms: AI message with `request_approval` tool call → pause with pending interrupt → `Command(resume='approved')` produces final AI message.
4. Welcome list now has 8 entries; the 8th references "ask for approval".
5. CHECKLIST `## Interrupts / human-in-the-loop` section populated; other Phase 2+ sections remain empty.
