# Example-first docs — remaining products (PRs 3–8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the 33 remaining mapped docs pages (ag-ui 6, render 6, deep-agents 5, runtimes 3, a2ui 1, chat 12) so each teaches through its running example via `<ExampleCode>`, absorb and delete their walkthroughs, and finish with the walkthrough retirement guard.

**Architecture:** Same contract as the LangGraph pilot (`2026-09-06-docs-example-first-langgraph-pilot.md`, merged as #1029): the page procedure below is copied from it and amended with what the pilot taught. One PR per product, sequential (each removes lines from the same guard file). Pages inside a product are disjoint files and may be implemented in parallel; the product's `PENDING_PAGES` lines are removed in one commit at the START of the product PR so page agents never edit the guard file.

**Spec:** `docs/superpowers/specs/2026-09-05-docs-example-first-content-design.md` (§3 page shape, §5 rollout).

**Decisions fixed (carry over from the pilot)**
- Sequential `<ExampleCode>` blocks only; never inside `<CodeGroup>`/`<Tabs>`.
- No contractions anywhere on a rewritten page; no "cockpit" in prose (the runtime-connection helper is referred to by role: "the host that serves the demo"); no competitor names; US spelling; sentence-case `##`/`###` headings except `## What's Next`.
- Walkthrough `<Summary>`/`<Prompt>`/`<Steps>`/`<Related>` are dropped; `<Tip>`/`<Warning>`/`<Note>` become `Callout` only when the page does not already say it. Walkthroughs have been wrong about checkpointers, `setBranch`, `provideAgent({ config })` and UI affordances on every pilot page: trust the code, never the walkthrough.
- Frontmatter `description:` under 180 characters, one sentence.
- Every API named in a fence is verified against `libs/*/src` before it is written; every hand-written fence is valid in its language.
- `server.py` files (ag-ui) are 13–19 lines: include whole when the page discusses the wire; otherwise mention by name.
- Region markers are comments only; inline Angular templates take `<!-- #region -->`; run `npx nx build <example project>` after marking a template. `deployments/ag-ui-dev/deps/<capability>/**` is TRACKED and generated from `cockpit/ag-ui/**`: after marking an ag-ui source run `npx tsx scripts/generate-ag-ui-deployment-config.ts` and stage ONLY `deployments/ag-ui-dev/deps/<own capability>/`. The runtimes examples (aws-strands, microsoft-agent-framework) are ALSO mirrored into `deployments/ag-ui-dev/deps/<capability>/`; render, deep-agents, langgraph and chat produce no tracked deployments diff (confirm with `git status --short deployments`).
- Local prod build: `rm -rf apps/website/.next dist/apps/website/.next && GROWTH_FORM_POLICY=growth_v1 npx nx build website`; output in `dist/apps/website/.next`.
- Unit runs: `npx nx test website --skip-nx-cache` from the root (the retirement spec is cwd-coupled).

## The page procedure

- [ ] **P1. Read everything first.** The current page, the walkthrough(s), every example file, `docs/gtm/voice.md` lines 1–60, and two finished pilot pages (`apps/website/content/docs/langgraph/guides/persistence.mdx`, `interrupts.mdx`) for tone and heading specificity. Note which hand-written snippets duplicate example code (replace with `<ExampleCode>`) and which teach something the example lacks (keep as fences).
- [ ] **P2. Regions.** For example files over ~60 lines add `#region name` … `#endregion` pairs (`//` TS, `#` Python, `<!-- -->` HTML) around the parts the page discusses; kebab-case names from the real code; nesting allowed; keep line-level regions under ~40 lines. Files under ~60 lines are included whole.
- [ ] **P3. Rewrite to the shape.** Title + lead → `## What the demo does` (two to four sentences: what the Run tab shows, one or two things to try, from the component's welcome suggestions or the prompt file) → `## How it is built` with sentence-case `###` headings that name a concept, walking the example in build order (backend first, then config, then component/template), one to three sentences before each block, at most one plain sentence after (a callout is fine) → the page's own concept sections the example does not show, trimmed of snippets the example now covers → `## What's Next` (keep the CardGroup; for stub pages create one with two to four real routes under `/docs/`).
- [ ] **P4. Delete the walkthrough(s)** with `git rm`.
- [ ] **P5. Do NOT touch `apps/website/src/lib/docs-example-code.spec.ts`** (the product's lines are already removed). The guard's "includes at least one example file" case may list sibling pages still in progress; your own page must not be listed.
- [ ] **P6. Generators** if anything under `cockpit/` changed (see Decisions).
- [ ] **P7. Verify.** `cd apps/website && npx vitest run docs-example-code public-copy docs-search docs.spec` (own page not in any failure); from the root `npx nx test website --skip-nx-cache` may show only the sibling-pending failure class; `grep -n -i cockpit <page>` → nothing; the contraction grep → nothing but `## What's Next`; prod build and `grep -c 'data-example-file=' dist/apps/website/.next/server/app<docsPath>.html` equals the tag count; remove both build dirs.
- [ ] **P8. Commit** the page, marked sources, deleted walkthrough(s), and own deployments dir in ONE commit `docs(<product>): <slug> teaches through the running example`, with the Co-Authored-By trailer.

## Product PRs (sequential; branch `blove/docs-example-first-<product>` from `origin/main`)

Each product PR: (1) one commit removing the product's `PENDING_PAGES` lines; (2) page tasks in parallel, each followed by a factual review that greps the libs for every API named and a fix pass; (3) close-out: `npx nx run-many -t test,lint --projects=website,cockpit-registry,cockpit-shell,scripts --skip-nx-cache`, both generators with no unstaged drift, prod build with per-page tag counts, `npx nx e2e website --skip-nx-cache`; a final cross-page read for consistency; PR with auto-merge.

### PR 3: ag-ui (6 pages)
| page | mdx lines | walkthrough | assets (lines) |
| --- | --- | --- | --- |
| `/docs/ag-ui/guides/client-tools` | 10 (stub) | `cockpit/ag-ui/client-tools/python/docs/guide.md` (262) | `client-tools.component.ts` 87, `weather-card.component.ts` 66, `confirm-booking.component.ts` 69, `app.config.ts` 20, `graph.py` 55, `server.py` 13 |
| `/docs/ag-ui/guides/interrupts` | 169 | `cockpit/ag-ui/interrupts/python/docs/guide.md` (140) | `interrupts.component.ts` 216, `app.config.ts` 20, `graph.py` 122, `server.py` 13 |
| `/docs/ag-ui/guides/json-render` | 10 (stub) | `cockpit/ag-ui/json-render/python/docs/guide.md` (127) | `json-render.component.ts` 62, `app.config.ts` 20, `graph.py` 327, `server.py` 13 |
| `/docs/ag-ui/guides/subagents` | 10 (stub) | `cockpit/ag-ui/subagents/python/docs/guide.md` (170) | `subagents.component.ts` 34, `app.config.ts` 20, `graph.py` 232, `server.py` 19 |
| `/docs/ag-ui/guides/tool-views` | 10 (stub) | `cockpit/ag-ui/tool-views/python/docs/guide.md` (93) | `tool-views.component.ts` 28, `weather-card.component.ts` 52, `app.config.ts` 20, `graph.py` 76, `server.py` 13 |
| `/docs/ag-ui/reference/event-mapping` | 201 | `cockpit/ag-ui/streaming/python/docs/guide.md` (123) | `streaming.component.ts` 30, `app.config.ts` 20, `graph.py` 55, `server.py` 13 |

Notes: the ag-ui adapter is event-driven (`@threadplane/ag-ui`); verify claims in `libs/ag-ui/src`. `event-mapping` is a reference page: keep its event table, add the example walk as the worked case. Two `weather-card.component.ts` basenames exist across capabilities but each page's asset list has only its own, so basenames resolve.

### PR 4: render (6 pages)
| page | mdx | walkthrough | assets |
| --- | --- | --- | --- |
| `/docs/render/api/provide-render` | 221 | `cockpit/render/computed-functions/python/docs/guide.md` (105) | `computed-functions.component.ts` 349, `app.config.ts` 16, `graph.py` 40 |
| `/docs/render/api/render-spec-component` | 194 | `cockpit/render/element-rendering/python/docs/guide.md` (102) | `element-rendering.component.ts` 432, `app.config.ts` 9, `graph.py` 41 |
| `/docs/render/guides/registry` | 290 | `cockpit/render/registry/python/docs/guide.md` (84) | `registry.component.ts` 357, `app.config.ts` 9, `graph.py` 40 |
| `/docs/render/guides/repeat-loops` | 10 (stub) | `cockpit/render/repeat-loops/python/docs/guide.md` (111) | `repeat-loops.component.ts` 436, `app.config.ts` 9, `graph.py` 40 |
| `/docs/render/guides/specs` | 327 | `cockpit/render/spec-rendering/python/docs/guide.md` (103) | `spec-rendering.component.ts` 357, `app.config.ts` 9, `graph.py` 41 |
| `/docs/render/guides/state-store` | 251 | `cockpit/render/state-management/python/docs/guide.md` (91) | `state-management.component.ts` 453, `app.config.ts` 9, `graph.py` 40 |

Notes: the render examples have no agent (the graph is a stub, `app.config.ts` is 9 lines); the component is the whole example, so regions carry the page. The two `api/` pages are API references: keep their reference tables and add the example as the worked case. Verify against `libs/render/src`.

### PR 5: deep-agents (5 pages)
| page | mdx | walkthrough | assets |
| --- | --- | --- | --- |
| `/docs/deep-agents/capabilities/filesystem` | 112 | `.../filesystem/python/docs/guide.md` (136) | `filesystem.component.ts` 289, `app.config.ts` 22, `graph.py` 86 |
| `/docs/deep-agents/capabilities/memory` | 125 | `.../memory/python/docs/guide.md` (127) | `memory.component.ts` 225, `app.config.ts` 22, `graph.py` 93 |
| `/docs/deep-agents/capabilities/planning` | 105 | `.../planning/python/docs/guide.md` (132) | `planning.component.ts` 192, `app.config.ts` 22, `graph.py` 94 |
| `/docs/deep-agents/capabilities/skills` | 112 | `.../skills/python/docs/guide.md` (129) | `skills.component.ts` 241, `app.config.ts` 22, `graph.py` 187 |
| `/docs/deep-agents/capabilities/subagents` | 87 | `.../subagents/python/docs/guide.md` (112) | `subagents.component.ts` 129, `app.config.ts` 30, `graph.py` 119 |

Notes: real `deepagents` 0.7.11 (memory note `deep-agents-rebuild`); task-tool subagents need zero adapter config. Verify against `libs/langgraph/src` and the graph.

### PR 6: runtimes (3 pages)
| page | mdx | walkthrough | assets |
| --- | --- | --- | --- |
| `/docs/runtimes/aws-strands/overview` | 54 | `cockpit/runtimes/aws-strands/python/docs/guide.md` (47) | `aws-strands.component.ts` 286, `app.config.ts` 20, `agent.py` 248, `server.py` 13 |
| `/docs/runtimes/mastra/overview` | 60 | `cockpit/runtimes/mastra/angular/docs/guide.md` (69) | `mastra.component.ts` 276, `app.config.ts` 20, `deployments/ag-ui-mastra/agents.mjs` 152, `server.mjs` 164 |
| `/docs/runtimes/microsoft-agent-framework/overview` | 62 | `.../microsoft-agent-framework/python/docs/guide.md` (39) | `microsoft-agent-framework.component.ts` 257, `app.config.ts` 20, `agent.py` 219, `server.py` 18 |

Notes: these are portability pages (memory note `runtime-portability-matrix`); keep the matrix claims exactly as the wire-capture docs state them. Mastra's backend files live under `deployments/ag-ui-mastra/` (tracked, hand-maintained, not generated).

### PR 7: a2ui (1 page)
| `/docs/a2ui/getting-started/introduction` | 81 | `cockpit/ag-ui/a2ui/python/docs/guide.md` (128) | `a2ui.component.ts` 41, `app.config.ts` 20, `graph.py` 849, `server.py` 13 |

Notes: the graph is 849 lines; use tight regions (the A2UI message construction, one surface update). A2UI v0.9.1 (memory note `a2ui-v09-stable-migration`): verify props against the official schemas, never invent.

### PR 8: chat (12 pages) — also deletes `PENDING_PAGES` and adds the retirement guard
| page | mdx | walkthrough | assets |
| --- | --- | --- | --- |
| `/docs/chat/a2ui/overview` | 296 | `cockpit/chat/a2ui/python/docs/guide.md` (129) | `a2ui.component.ts` 49, `app.config.ts` 22, `graph.py` 848 |
| `/docs/chat/components/chat-debug` | 107 | `cockpit/chat/debug/python/docs/guide.md` (64) | `debug.component.ts` 24, `app.config.ts` 22, `graph.py` 112 |
| `/docs/chat/components/chat-input` | 183 | `cockpit/chat/input/python/docs/guide.md` (74) | `input.component.ts` 188, `app.config.ts` 22, `graph.py` 92 |
| `/docs/chat/components/chat-interrupt-panel` | 174 | `cockpit/chat/interrupts/python/docs/guide.md` (97) | `interrupts.component.ts` 121, `app.config.ts` 22, `graph.py` 147 |
| `/docs/chat/components/chat-subagent-card` | 146 | `cockpit/chat/subagents/python/docs/guide.md` (88) | `subagents.component.ts` 103, `app.config.ts` 26, `graph.py` 249 |
| `/docs/chat/components/chat-tool-calls` | 70 | `cockpit/chat/tool-calls/python/docs/guide.md` (76) | `tool-calls.component.ts` 104, `app.config.ts` 22, `graph.py` 100 |
| `/docs/chat/components/chat-trace` | 213 | `cockpit/chat/timeline/python/docs/guide.md` (83) | `timeline.component.ts` 62, `app.config.ts` 22, `graph.py` 92 |
| `/docs/chat/concepts/message-model` | 274 | `cockpit/chat/messages/python/docs/guide.md` (76) | `messages.component.ts` 165, `app.config.ts` 23, `graph.py` 94 |
| `/docs/chat/guides/client-tools` | 316 | `cockpit/langgraph/client-tools/python/docs/guide.md` (220) | `client-tools.component.ts` 100, `weather-card.component.ts` 66, `confirm-booking.component.ts` 68, `app.config.ts` 23, `graph.py` 54 |
| `/docs/chat/guides/generative-ui` | 208 | `cockpit/chat/generative-ui/python/docs/guide.md` (74) | `generative-ui.component.ts` 72, `app.config.ts` 22, `graph.py` 317 |
| `/docs/chat/guides/theming` | 169 | `cockpit/chat/theming/python/docs/guide.md` (78) | `theming.component.ts` 175, `app.config.ts` 22, `graph.py` 92 |
| `/docs/chat/guides/thread-routing` | 187 | `cockpit/chat/threads/python/docs/guide.md` (89) | `threads.component.ts` 170, `app.config.ts` 38, `graph.py` 116 |

Notes: component pages are API-shaped; keep the API tables and add the example as the worked case. Client-tools: the flush() contract (memory note `client-tool-flush-contract`). Close-out for PR 8 additionally: delete `PENDING_PAGES` and its "lists only mapped pages as pending" case (keep the lower-bound case), and add to `apps/website/src/lib/cockpit-retirement.spec.ts` two cases: no file matches `cockpit/**/docs/guide.md`, and no descriptor in `capabilityModules` has a `docsAssetPaths` key.
