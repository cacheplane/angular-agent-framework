# Deep Agents Capability Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 6 Deep Agents capability examples with Angular apps, Python backends, tutorial docs, and e2e tests. Deep Agents examples use the shared `@cacheplane/chat` component but with specialized sidebars showing agent execution details (task trees, file operations, subagent activity, memory stores, skill registries, sandbox logs).

**Architecture:** Each capability follows the LangGraph example pattern but with richer sidebar content. The Python graphs use LangGraph tool-calling patterns (agents that invoke tools). The Angular components leverage `stream.toolCalls()`, `stream.toolProgress()`, and `stream.subagents()` signals for real-time agent activity visualization.

**Tech Stack:** Angular 21, `@cacheplane/angular`, `@cacheplane/chat`, LangGraph (Python), Playwright

---

## Capabilities

| # | Capability | Port | Key Feature | Sidebar Content |
|---|-----------|------|-------------|----------------|
| 1 | Planning | 4310 | `value()` (plan in state) | Task tree with status badges |
| 2 | Filesystem | 4311 | `toolCalls()` | File operation log |
| 3 | Subagents | 4312 | `subagents()`, `activeSubagents()` | Subagent activity panel |
| 4 | Memory | 4313 | `value()` (memory store) | Key-value memory browser |
| 5 | Skills | 4314 | `toolCalls()` | Skill invocation log |
| 6 | Sandboxes | 4315 | `toolCalls()` | Execution log viewer |

---

### Task 1: Deep Agents Planning example (port 4310)

Follow the EXACT structure of `cockpit/langgraph/persistence/`. Create all files under `cockpit/deep-agents/planning/`.

**Angular Component** — Uses `ChatComponent` with a sidebar showing a task decomposition tree. The agent receives a complex task, breaks it into steps, and executes them. The sidebar shows each step's status (pending → running → complete).

The component watches `stream.value()` for a `plan` field:
```typescript
planSteps = computed(() => {
  const val = this.stream.value() as { plan?: Array<{ title: string; status: string }> };
  return val?.plan ?? [];
});
```

**Python Graph** — Agent that decomposes tasks into subtasks:
- `plan` node: LLM generates a JSON plan with steps
- `execute` node: Processes each step sequentially
- State includes `plan: list[dict]` with `title` and `status` fields

**Prompt**: Task decomposition agent that breaks complex requests into ordered steps.

**Docs**: Tutorial covering task planning, plan state signal, status visualization.

**E2E**: Test chat renders, message sends, response received.

**Module**: Update `cockpit/deep-agents/planning/python/src/index.ts` with real paths, devPort: 4310.

---

### Task 2: Deep Agents Filesystem example (port 4311)

**Angular Component** — Sidebar shows file operation log from `stream.toolCalls()`. Each tool call shows the operation type (read/write), file path, and status.

**Python Graph** — Agent with file read/write tools:
```python
@tool
def read_file(path: str) -> str:
    """Read a file from the workspace."""
    return Path(path).read_text()

@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file."""
    Path(path).write_text(content)
    return f"Written to {path}"
```

---

### Task 3: Deep Agents Subagents example (port 4312)

**Angular Component** — Sidebar shows subagent activity using `stream.subagents()`. Each subagent has a status badge and message count. This is the flagship Deep Agents feature.

**Python Graph** — Orchestrator agent that delegates to specialist subagents via tool calls. Uses `subagentToolNames` option in `agent()`.

---

### Task 4: Deep Agents Memory example (port 4313)

**Angular Component** — Sidebar shows agent's persistent memory as key-value pairs from `stream.value()`. Agent learns facts from conversation.

**Python Graph** — Agent with memory extraction and retrieval. State includes `agent_memory: dict`.

---

### Task 5: Deep Agents Skills example (port 4314)

**Angular Component** — Sidebar shows available skills and invocation history from `stream.toolCalls()`. Each skill shows name, description, and last invocation result.

**Python Graph** — Agent with multiple specialized tools (skills): calculator, web search, code interpreter stubs.

---

### Task 6: Deep Agents Sandboxes example (port 4315)

**Angular Component** — Sidebar shows execution logs: stdin, stdout, exit code from `stream.toolCalls()`. Code execution results displayed with syntax highlighting.

**Python Graph** — Agent with a code execution tool that runs Python snippets and returns output.

---

### Task 7: Wire all Deep Agents modules into route-resolution

Import and register all 6 Deep Agents modules in `apps/cockpit/src/lib/route-resolution.ts`.

---

### Task 8: Full test suite + build + push

Run all tests, build cockpit, verify 25 static pages (19 LangGraph + 6 Deep Agents), push.
