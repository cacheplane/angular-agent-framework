# Canonical `examples/chat` Demo — Phase 3A: Interrupts (HITL)

**Date:** 2026-05-08
**Status:** Approved
**Phase:** 3A of the canonical demo roadmap (orthogonal to 3B)
**Builds on:** Phase 1 (PR #213) + Phase 2A (PR #216) + Phase 2B (PR #220) + smoke fix PRs #217 #218 #219 #221

## Goal

Layer human-in-the-loop interrupts onto the canonical demo by adding a `request_approval` tool that calls LangGraph's `interrupt()` to pause the graph mid-execution. Wire `<chat-interrupt-panel>` into the demo shell with action handlers that resume the graph via `agent.submit(null, { command: { resume: ... } })`. Add one welcome suggestion that exercises the flow.

## Why these are split

Phase 3 covers two roadmap items: interrupts and subagents. Both are orthogonal — different graph patterns, different UI primitives, different risk profiles. Splitting into 3A (interrupts) and 3B (subagents) follows the same cadence that Phase 2A→2B already proved out: smaller individually-shippable units, easier review, separately validatable in live smoke before stacking the next change.

This spec is **3A only**. Subagents get their own brainstorm/spec/plan/PR cycle later.

## Scope

Tool-driven interrupt — the AI decides when to ask for human approval; the tool body calls `interrupt()`. The demo's existing tool-call topology (Phase 2B's `tools` ToolNode) handles routing automatically; no new graph edges. The frontend mounts `<chat-interrupt-panel>` (the interactive composition) and translates its four-action vocabulary (`accept` / `edit` / `respond` / `ignore`) into `Command(resume=...)` resumes.

## Approaches considered

- **Topology node** — add an `await_approval` node between `generate` and `attach_citations` that always interrupts. Forces every conversation through HITL. Rejected: artificial; gates the existing tool-call flow.
- **Conditional node** — `should_interrupt` edge from `generate` based on a heuristic (message length, sensitive-keyword detector). Rejected: brittle and inscrutable.
- **Tool-driven (chosen)** — a `request_approval(reason: str)` tool that calls `interrupt(...)` from inside the tool body. The AI decides when to use it. Stacks naturally on top of the existing `tools` ToolNode wiring. Selected because it adds zero new graph edges and the AI controls when HITL fires.

## Python graph

### `request_approval` tool

```python
from langgraph.types import interrupt

@tool
def request_approval(reason: str) -> str:
    """Pause and request the human's approval before performing a sensitive
    or destructive action. Provide a clear reason — the human will see it.
    Returns the human's decision verbatim; incorporate it into your next
    step."""
    response = interrupt({"type": "approval_request", "reason": reason})
    return f"Human response: {response}"
```

`interrupt()` raises an exception that LangGraph's runtime catches; the graph pauses with state persisted. Resume via `Command(resume=<value>)` makes `interrupt(...)` return `<value>` to the tool, which then returns its formatted string to the AI.

### Wiring

Two minor edits to the existing graph:

1. Bind both tools in `generate`:

```python
llm = ChatOpenAI(**kwargs).bind_tools([search_documents, request_approval])
```

2. Pass both to `ToolNode`:

```python
_builder.add_node("tools", ToolNode([search_documents, request_approval]))
```

### System prompt

Append one paragraph:

> "When the user describes a sensitive or destructive action (deleting data, sending a customer email, modifying production state, etc.), call `request_approval` with a clear `reason` BEFORE doing the action. Do not assume permission. The human's response will tell you whether to proceed, modify, or stop."

## Demo Angular changes

### `<chat-interrupt-panel>` mount in shell

The shell's existing template gains one block:

```html
<!-- demo-shell.component.html -->
@if (agent.interrupt()) {
  <div class="demo-shell__interrupt-panel">
    <chat-interrupt-panel [agent]="agent" (action)="onInterruptAction($event)" />
  </div>
}
```

Position: fixed above the chat input, only visible when an interrupt is active. The component reads `agent.interrupt()` itself; we just wire the `(action)` output. CSS positioning ~10 LOC.

### `onInterruptAction` handler

`InterruptAction` from `@ngaf/chat` is `'accept' | 'edit' | 'respond' | 'ignore'`. The handler translates each to a Command resume:

```ts
import type { InterruptAction } from '@ngaf/chat';

protected async onInterruptAction(action: InterruptAction): Promise<void> {
  const interrupt = this.agent.interrupt();
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

  await this.agent.submit(null, { command: { resume } });
}
```

`window.prompt()` is the demo-grade affordance for `edit` and `respond`. A production app would inline a textarea editor; out of scope for the demo.

### Welcome suggestion

```ts
{
  label: 'Demo: ask for approval before a sensitive action',
  value:
    'I want to clean up old database backups older than 90 days. Walk me through what you would delete, and call request_approval before doing anything destructive so I can review your plan.',
},
```

Concrete domain (database backups), names the tool explicitly, fits the system-prompt heuristic ("destructive action").

## Pytest smokes

Two additions to `examples/chat/python/tests/test_graph_smoke.py`:

```python
@pytest.mark.smoke
def test_request_approval_tool_exists():
    from src.graph import request_approval
    assert request_approval is not None
    assert request_approval.name == "request_approval"


@pytest.mark.smoke
def test_state_graph_still_includes_attach_citations_node():
    # Regression check: Phase 3A should not break Phase 2B topology.
    from src.graph import graph
    nodes = set(graph.get_graph().nodes.keys())
    assert "tools" in nodes
    assert "attach_citations" in nodes
```

No live-LLM tests — the existing tokens-free CI policy stays.

## CHECKLIST.md

Populate the empty `## Interrupts / human-in-the-loop` section in `examples/chat/smoke/CHECKLIST.md`:

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

Other Phase 2+ section headings (Subagents, Generative UI, Time travel, Multi-thread) remain empty pending later phases.

## Files touched

| Path | Change |
|---|---|
| `examples/chat/python/src/graph.py` | +1 import (`langgraph.types.interrupt`), +1 tool, bind in 2 places (generate kwargs + ToolNode), +1 paragraph in SYSTEM_PROMPT (~25 LOC) |
| `examples/chat/python/tests/test_graph_smoke.py` | +2 smoke tests |
| `examples/chat/angular/src/app/shell/demo-shell.component.ts` | +import (`InterruptAction`, `ChatInterruptPanelComponent`), +`onInterruptAction` handler (~30 LOC) |
| `examples/chat/angular/src/app/shell/demo-shell.component.html` | +`@if (agent.interrupt())` block with `<chat-interrupt-panel>` (~5 LOC) |
| `examples/chat/angular/src/app/shell/demo-shell.component.css` | +`.demo-shell__interrupt-panel` positioning (~10 LOC) |
| `examples/chat/angular/src/app/modes/welcome-suggestions.ts` | +1 entry |
| `examples/chat/smoke/CHECKLIST.md` | populate Interrupts / human-in-the-loop section |

Total ≈ 90 LOC.

## Definition of done

1. PR merged.
2. CI green: `nx run examples-chat-python:smoke` (6 pytest), `nx run examples-chat-angular:test/lint/build`.
3. **Server-side probe**: submit the database-backups welcome prompt with model=gpt-5-mini. Response trace shows AI message with `tool_calls=[{name: 'request_approval', ...}]`, the graph pauses with `next` containing the tools node and a pending interrupt value. Issue a follow-up `client.runs.wait(thread_id, command={resume: 'approved'})` and verify the AI continues to a final response.
4. Local visual smoke (Chrome MCP): interrupt panel appears above the input, all four actions (accept/edit/respond/ignore) resume the graph as expected.
5. Welcome list now has 8 entries; the 8th references "ask for approval".

## Out of scope (defer)

- **Inline edit UX in `<chat-interrupt-panel>`** — `window.prompt()` is the demo affordance; a real app would inline a textarea. Not a Phase 3A regression — the panel's `(action='edit')` is a hook the demo can wire to whatever edit UX it wants.
- **Multi-turn HITL** — interrupt → resume → AI calls request_approval again → loop. The implementation supports it naturally; the demo just doesn't exercise it explicitly.
- **Subagents (Phase 3B)** — separate spec/plan/PR cycle.
- **Phase 4+ features** — generative UI, time travel, multi-thread.

## Risks

- **`window.prompt()` is browser-blocking and styled by the OS.** Acceptable for a demo; the goal is to show the resume mechanic, not the edit UX. Mitigation: documented as out-of-scope.
- **Interrupt exception unwinding inside a tool node.** LangGraph's runtime catches the interrupt exception, pauses the graph, and persists state. Standard documented pattern; tested by LangGraph itself.
- **Race: user clicks an action while a NEW interrupt is firing on top of the previous one.** `agent.interrupt()` always returns the most recent; `agent.submit(null, {command: {resume}})` resumes the graph from its current pause point. Should compose correctly without explicit handling.
- **Reasoning + tools + interrupt together.** Same composability concern as Phase 2B's "reasoning + tools" — should work because they're orthogonal LangGraph features. Verified during smoke.
- **Existing Phase 2B `attach_citations` node interaction.** When the graph resumes after an interrupt and produces a final AI message that uses citations from a *prior* search_documents call, `attach_citations` walks back to the most recent `ToolMessage` (which would be the request_approval ToolMessage, NOT a search_documents ToolMessage). The request_approval result isn't JSON-shaped, so `attach_citations` early-exits gracefully (the JSON parse fails the `if isinstance(hits, list)` guard). Citations from earlier search_documents calls in the same conversation are NOT auto-restored. Acceptable: the demo's interrupt scenario doesn't include search_documents in the same flow. If it did, fixing it would be a Phase 3A.1 follow-up.
