# Comprehensive Docs Overhaul — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 18 docs pages to gold standard quality — every page shows both Python agent code AND Angular agent code, uses correct MDX syntax, has 200+ lines of rich content, and tells the product story.

**Architecture:** Each task rewrites one MDX file. The gold standard is `introduction.mdx` (337 lines) and `langgraph-basics.mdx` (384 lines). Every page should pair Python LangGraph patterns with Angular agent consumption, use correct Tab label syntax, include Callouts, Steps, and CardGroup navigation.

**Tech Stack:** MDX with custom components (Callout, Steps, Tabs/Tab with label prop, CardGroup/Card, FeatureChips, ArchFlowDiagram)

---

## Phase 0: Critical Fixes (do first, affects all pages)

### Task 0: Fix Cross-Cutting Issues

**Files:** Multiple

- [ ] **Step 1: Fix import path inconsistency**

Search all MDX and TSX files for `@ngxp/angular` and `@angular/angular`. Replace ALL with `@cacheplane/angular`.

Run: `grep -rn "@ngxp/angular\|@angular/angular" apps/website/content/docs-v2/ apps/website/src/`

Replace all occurrences with `@cacheplane/angular`.

- [ ] **Step 2: Fix API method inconsistency**

Search for `.stream(` in docs (should be `.submit(`). Search for `status() === 'streaming'` (should be `status() === 'loading'`).

- [ ] **Step 3: Fix broken links**

Search for `/docs-v2/` (should be `/docs/`). Search for `/docs/guides/branching` and `/docs/guides/error-handling` (don't exist — remove or replace).

- [ ] **Step 4: Fix unclosed code fence in state-management.mdx**

Line ~60 has an unclosed TypeScript code fence that swallows the rest of the page.

- [ ] **Step 5: Fix .tsx file extensions**

Search for `.tsx` in Tab labels (should be `.ts` — this is Angular, not React).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(website): resolve import paths, API naming, broken links, code fence"
```

---

## Phase 1: Rewrite THIN Pages (highest impact)

Each page below needs to be expanded to 200+ lines with Python + Angular code pairs.

### Task 1: Rewrite `concepts/angular-signals.mdx` (76 → 250+ lines)

Current: Surface-level primer. No Python code. No streaming lifecycle explanation.

New content needed:
- How `toSignal()` converts BehaviorSubjects internally
- Streaming lifecycle: idle → loading → streaming tokens → resolved
- `computed()` for derived AI state (message count, last message, tool progress)
- `effect()` for side effects (analytics, logging, error reporting)
- A complete component example showing all signal patterns
- Performance: why Signals + OnPush is efficient for high-frequency streaming
- Python agent code showing what produces the streaming events that Signals consume

### Task 2: Rewrite `concepts/agent-architecture.mdx` (70 → 250+ lines)

Current: 5-bullet overview, single code snippet, 3-line pattern list.

New content needed:
- Full ReAct agent pattern with Python code + Angular agent code
- Tool calling: Python `@tool` decorator → Angular `toolCalls()` signal
- Multi-agent: Python supervisor graph → Angular `subagents()` signal
- Error handling and recovery patterns
- Planning phase: how LLMs decide actions
- Checkpointing: how `history()` and `branch()` expose decisions

### Task 3: Rewrite `concepts/state-management.mdx` (83 → 200+ lines)

Current: Has syntax error (unclosed code fence). No Python code. ASCII diagram.

New content needed:
- Fix unclosed code fence
- Python TypedDict with reducers → TypeScript interface mapping
- How `Annotated[list, add]` works and why messages accumulate
- State updates during streaming (partial values)
- Checkpoint model: persistence, restore, branching
- Tabs showing Python state definition + Angular consumption
- Replace ASCII diagram with Steps component

### Task 4: Rewrite `guides/memory.mdx` (83 → 200+ lines)

Current: Thinnest guide. No Tabs, no Python, no template code.

New content needed:
- Python: agent state with memory fields, LangGraph Store API
- Short-term (thread-scoped) vs long-term (cross-thread) memory
- Semantic memory with vector search
- Tabs: TypeScript component + Angular template for memory-aware UI
- How memory updates surface through `value()` signal

### Task 5: Rewrite `guides/interrupts.mdx` (96 → 200+ lines)

Current: No Python code. Dangling reference to BagTemplate. Tab syntax wrong.

New content needed:
- Python: `raise Interrupt(value={...})` in agent node
- Python: graph structure with approval node
- Full approval component: TypeScript + Template in Tabs
- Multi-step approval pattern
- Typed interrupt payloads with BagTemplate (explain the reference)
- Steps component for interrupt lifecycle
- Fix Tab syntax to use `label` prop

### Task 6: Rewrite `guides/persistence.mdx` (107 → 200+ lines)

Current: No Python code. Tab syntax wrong.

New content needed:
- Python: checkpointer setup (MemorySaver, PostgresSaver)
- Python: thread_id in graph invocation
- Full thread-list component: TypeScript + Template
- Thread switching UI pattern
- Fix Tab syntax to use `label` prop

### Task 7: Rewrite `guides/testing.mdx` (124 → 200+ lines)

Current: No Tabs, no Python, no template code.

New content needed:
- Python: how to test the agent side
- Tabs: spec file + component file pairs
- Testing subagent interactions
- Testing interrupts and thread switching
- Integration testing with real LangGraph dev server
- Steps for test setup workflow

### Task 8: Rewrite `guides/deployment.mdx` (108 → 200+ lines)

Current: Tab syntax wrong. Introduction page has better deployment content.

New content needed:
- Python: LangGraph Cloud deployment (langgraph.json, CLI)
- LangSmith deployment walkthrough
- Authentication / API key configuration
- CORS configuration for SSE
- CI/CD pipeline example
- Monitoring and health checks
- Fix Tab syntax to use `label` prop

---

## Phase 2: Polish CLOSE Pages

### Task 9: Polish `guides/streaming.mdx` (206 lines — fix issues)

Fix:
- Import path: `@angular/angular` → `@cacheplane/angular`
- `.stream()` → `.submit()`
- `'streaming'` status → `'loading'`
- Add Python agent showing `stream_mode` configuration
- Add `ChangeDetectionStrategy.OnPush` to component

### Task 10: Polish `guides/time-travel.mdx` (175 lines — fix issues)

Fix:
- `.tsx` extension in Tab label → `.ts`
- Remove broken link to `/docs-v2/guides/branching`
- Add Python checkpointer setup code
- Expand to 200+ lines

### Task 11: Polish `guides/subgraphs.mdx` (199 lines — fix issues)

Fix:
- `.tsx` extension in Tab label → `.ts`
- Remove broken link to `/docs-v2/guides/error-handling`
- Add Python subgraph composition code

### Task 12: Polish `getting-started/quickstart.mdx` (131 lines)

Fix:
- Tab syntax: `items={[...]}` → `<Tab label="...">`
- Replace plain `##` numbered headings with `<Steps>/<Step>`
- Add `ChangeDetectionStrategy.OnPush`
- Add error display (`chat.error()`) to template
- Add agent setup context or link

### Task 13: Polish `getting-started/installation.mdx` (103 lines)

Fix:
- Tab syntax: `items={[...]}` → `<Tab label="...">`
- Fix `process.env` error → use Angular `environment.ts`
- Fix verify example (needs injection context)
- Add troubleshooting section
- Expand "Next steps" to 4+ cards

---

## Phase 3: Expand API Pages

### Task 14: Expand 4 API Reference Pages

Fix import path `@ngxp/angular` → `@cacheplane/angular` in all 4.
Add "What's Next" CardGroup to all 4.
Expand intros with more context about when/why to use each.

---

## Execution Strategy

**Phase 0** (Task 0): Do first — fixes affect all pages. Single commit.
**Phase 1** (Tasks 1-8): Highest impact. 8 full rewrites. Dispatch as parallel subagents.
**Phase 2** (Tasks 9-13): Polish passes. 5 targeted fixes. Dispatch as parallel subagents.
**Phase 3** (Task 14): API pages. Single task.

Total: 15 tasks, ~14 files rewritten.

## Quality Checklist (apply to every page)

- [ ] 200+ lines of content
- [ ] Python LangGraph code showing the agent/server pattern
- [ ] Angular agent code showing the frontend consumption
- [ ] Both paired together to tell the product story
- [ ] All imports use `@cacheplane/angular`
- [ ] All Tab components use `<Tab label="...">` syntax
- [ ] `ChangeDetectionStrategy.OnPush` in component examples
- [ ] At least 2 Callouts (tip, info, or warning)
- [ ] "What's Next" CardGroup with 4+ cards
- [ ] No broken links
- [ ] Correct API method names (`.submit()`, not `.stream()`)
- [ ] Correct status values (`'loading'`, not `'streaming'`)
