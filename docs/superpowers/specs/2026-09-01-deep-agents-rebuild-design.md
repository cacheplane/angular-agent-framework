# Design: rebuild the deep-agents cockpit group on the real framework

**Date:** 2026-09-01
**Status:** Approved (Brian, including sandboxes removal)

## Why

The six `cockpit/deep-agents/*` topics are hand-rolled 64–115-line toy StateGraphs from PR #2
that import zero `deepagents` machinery while carrying the framework's name — the same
name-writes-checks-the-code-does-not-cash liability the runtimes arc just cured for AG-UI.
Their guides repeat the langgraph/streaming boilerplate six times; the "subagents" demo renders
no subagent cards at all; the group has no website docs library (7 sentinel links).

A measured spike (2026-09-01, transcripts in scratchpad `spike-deepagents/`) proved the real
`deepagents==0.7.11` works against `@threadplane/langgraph` **with zero adapter changes**:
- `task` tool + `{description, subagent_type}` args + description-seeded child ⇒ our
  SubagentTracker's exact-match rung attributes BEFORE the first child token; **parallel
  fan-out resolves cleanly** (2 children, distinct transcripts/state, no cross-wiring).
- Interrupts native both live (`updates.__interrupt__` + trailing values) and on reload
  (`tasks[0].interrupts`). Resume payload: `{decisions:[{type:"approve"}]}` — a bare list is
  a server TypeError.
- `values.todos` = `[{content, status}]` (no id/activeForm); `values.files` streams with
  StateBackend only.
- Skills/memory state (`skills_metadata`, `memory_contents`) is `PrivateStateAttr` — never in
  streamed values; present in thread state/history. Live panels need a workaround.
- Versions: deepagents 0.7.11, langchain-core 1.6.1, langgraph 1.2.11, langgraph-api 0.13.2;
  co-resolves on CPython 3.12; `langchain-anthropic`+`langchain-google-genai` are mandatory
  transitive imports even for OpenAI-only graphs.

## Scope

**Rebuild five topics** on `deepagents` (per-topic commits, one PR):

| topic | build on | must demonstrate | est |
|---|---|---|---|
| planning | TodoListMiddleware | live todo panel off `value('todos')`, model revising the plan mid-run | S |
| filesystem | FilesystemMiddleware + StateBackend | file-tree panel off `values.files`; `FilesystemPermission` write-interrupt via our interrupt panel | S–M |
| subagents | SubAgentMiddleware | real child graphs streaming into subagent cards, INCLUDING a parallel fan-out turn | S |
| memory | MemoryMiddleware + StoreBackend | cross-thread memory + agent-authored AGENTS.md; live panel via the visibility workaround | M |
| skills | SkillsMiddleware | SKILL.md progressive disclosure per agentskills.io; live panel via the workaround | M |

**Remove the sandboxes topic entirely** — registry entry, dirs, ports, ci wiring, guards'
expectations. Rationale: LocalShellBackend is an unsandboxed host shell and these topics
deploy to the shared LangGraph Cloud deployment ⇒ a public demo with `execute` is RCE on our
infra; real isolation is a paid service or a container story — a deliberate future decision,
not a demo default. The current `run_code` demo is itself fake, so nothing real is lost.

**Skills/memory visibility workaround:** a small graph-side middleware emitting the private
state as a `custom` stream event (renders live via `customEvents`/`events$`), falling back to
settle-time `getState` hydration. App-side; NO adapter changes (the spike found none needed).

**Angular demos:** keep the existing per-topic app shells but rewrite each demo component
around its real surface (todo panel, file tree, subagent cards, memory/skills panels).
Consolidate the six-times-repeated streaming boilerplate: guides link the langgraph/streaming
getting-started instead of re-teaching `provideAgent()` each time.

**Docs:** new `/docs/deep-agents/` website library in the runtimes mold (getting-started
introduction + one page per topic), replacing the sentinel docs links from #918 with real
targets (update `docs-links.ts` mapping + its guard expectations — deep-agents leaves the
sentinel list). Separate PR after the rebuild.

**Fixtures/e2e:** aimock replay per repo convention (hasToolResult entries BEFORE plain
userMessage; turnIndex disambiguation). The spike transcripts are wire-shape references;
committed fixtures are recorded fresh from the rebuilt graphs. e2e must assert the
DIFFERENTIATED surface per topic (cards populate, todos transition, interrupt pauses+resumes)
— not just "an assistant bubble appears" (the vacuous-test disease).

## Constraints

- Cockpit examples standalone: duplicate, never share across examples.
- Python 3.12; per-topic uv.lock; deployment is the shared LangGraph deployment via the
  generated manifest (`scripts/generate-shared-deployment-config.ts`) — verify the deepagents
  dep set flows through it and the drift check stays clean.
- `transcriptNodeNames`, if set anywhere, must include middleware-named nodes
  (`TodoListMiddleware.after_model` etc.).
- No secrets; OPENAI_API_KEY only; never source whole .env.
- Do not weaken the #910/#912/#918 guards; update their expectations for the removed topic.

## Out of scope

Async subagents (out-of-band remote runs — different UI problem), Anthropic/Gemini paths,
LangSmithSandbox, structured-output/response_format, any adapter change, marketing/blog (a
"measured on Deep Agents" post is a natural follow-up, decided separately).
