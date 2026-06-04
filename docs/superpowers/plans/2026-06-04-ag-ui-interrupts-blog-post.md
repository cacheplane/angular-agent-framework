# AG-UI Interrupts Blog Post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author and commit `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx` — a full standalone tutorial covering the new ag-ui interrupt support with the "same UI, two adapters" parity angle.

**Architecture:** Single `.mdx` deliverable structured as eight sections (frontmatter + lede + CTAs / goals + parity hook / "when to use an interrupt" / three-piece architecture / four-step scaffold / walk-the-run / closing / image placeholders). Every code block must be verified character-accurate against `cockpit/ag-ui/interrupts` source. The "test" for prose tasks is grep/diff against source. Image PNG capture is a deliberate follow-up — the post ships with `<figure>` placeholders and captions.

**Tech Stack:** MDX (Next.js website), Markdown, bash grep/diff for source verification.

**Spec:** `docs/superpowers/specs/2026-06-04-ag-ui-interrupts-blog-post-design.md`

---

## Conventions

- Run all commands from the repo root: `/Users/blove/repos/angular-agent-framework/.claude/worktrees/interesting-mccarthy-5d4ea0`.
- Commit after each task. Do NOT push.
- The deliverable file is `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`. Subsequent tasks append to it; the first task creates it.
- Voice rule (from `feedback_blog_voice_no_anecdotes`): no anecdotes for Brian; no emojis; trimmed technical register; match the precedent post's voice exactly.

---

## File Structure

**Create:** `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

**Read-only references the implementer will source-verify against:**

| Reference | Purpose |
|---|---|
| `apps/website/content/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular.mdx` | Precedent post (structure, voice, CTA shape, figure conventions, frontmatter format) |
| `cockpit/ag-ui/interrupts/python/src/graph.py` | LangGraph node + `request_approval` interrupt — source for Step 1 code block |
| `cockpit/ag-ui/interrupts/python/src/server.py` | uvicorn FastAPI app + `ag-ui-langgraph` wiring + `/ok` health — source for Step 2 code block |
| `cockpit/ag-ui/interrupts/angular/src/app/app.config.ts` | ag-ui `provideAgent({ url })` — source for Step 3 code block |
| `cockpit/ag-ui/interrupts/angular/proxy.conf.mjs` | `/agent` → backend port wiring |
| `cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts` | Angular component — source for Step 4 code block + parity-diff claim |
| `cockpit/langgraph/interrupts/angular/src/app/app.config.ts` | LangGraph `provideAgent({ apiUrl, assistantId })` — counterpart for the parity diff |
| `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` | LangGraph counterpart for the byte-identical claim |
| `libs/ag-ui/src/lib/reducer.ts` | Confirm the `on_interrupt` handler + JSON-string parse in the adapter |
| `libs/chat/src/lib/agent/agent-interrupt.ts` | Confirm `AgentInterrupt = { id, value, resumable }` shape |

**Image asset paths (referenced but not created in this plan):**

- `apps/website/public/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular/1.png`
- `apps/website/public/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular/2.png`
- `apps/website/public/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular/3.png`

---

## Task 1: Frontmatter + lede + CTAs + Goals + Parity Hook (Sections 1–2)

**Files:** Create `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

- [ ] **Step 1: Pre-verify the parity diff against real source**

Run:
```bash
diff cockpit/langgraph/interrupts/angular/src/app/app.config.ts cockpit/ag-ui/interrupts/angular/src/app/app.config.ts
diff cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts
```
Expected: the app.config.ts diff shows the provider swap (langgraph `provideAgent({ apiUrl, assistantId })` from `@threadplane/langgraph` → ag-ui `provideAgent({ url: '/agent' })` + `provideChat({})` from `@threadplane/ag-ui`). The component diff shows ONLY the `injectAgent` import line — that's the byte-identical-except-the-import claim. If the component diff shows other differences, those are content the post needs to acknowledge — STOP and report before writing.

- [ ] **Step 2: Read the precedent post**

Read `apps/website/content/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular.mdx` end-to-end. Note: frontmatter shape, CTA card MDX block, voice register (short sentences, no emojis, no anecdotes), figure conventions, link styles, code-fence language tags (`ts` vs `python` vs `diff` vs `jsonc`).

- [ ] **Step 3: Author Section 1 (frontmatter + lede + CTAs)**

Create the file with this content (verify each link target):

```mdx
---
title: "Human-in-the-Loop AG-UI Agents in Angular"
description: "Build a human-in-the-loop AG-UI agent in Angular — the same <chat-approval-card> from the LangGraph version, wired to an AG-UI-fronted LangGraph backend via @threadplane/ag-ui."
date: 2026-06-04
tags: [tutorial, ag-ui, angular, agents, hitl, interrupts]
author: brian
featured: true
---

This is how to pause an AG-UI agent in Angular for human approval before it runs a high-stakes tool, using a `CUSTOM` `on_interrupt` event and the `<chat-approval-card>` composition from `@threadplane/chat`. The example is the same refund agent from [Human-in-the-Loop LangGraph Agents in Angular](/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular) — wired through the AG-UI adapter instead. The Angular component is byte-identical except the import.

Everything below is running code from the cockpit example at `cockpit/ag-ui/interrupts`. Clone the repo, run `nx serve cockpit-ag-ui-interrupts-angular`, and follow along.

<div style={{ marginTop: 40, marginBottom: 44 }}>
<CardGroup cols={2}>
  <Card title="Run the live demo" icon="▶" external href="https://cockpit.threadplane.ai/ag-ui/core-capabilities/interrupts/overview/python">
    The refund agent running in the cockpit. Walk the approve / edit / cancel flow yourself.
  </Card>
  <Card title="View the source" icon="⌥" external href="https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/ag-ui/interrupts">
    The exact graph.py, server.py, and Angular component from this post.
  </Card>
</CardGroup>
</div>
```

The description field intentionally drops the backtick chars from `<chat-approval-card>` because YAML frontmatter doesn't render them as code. Match the precedent's pattern (read line 3 of the langgraph post — same convention).

- [ ] **Step 4: Author Section 2 (Goals + parity hook)**

Append to the file:

````mdx
## Goals

- Wire the same refund-approval gate over the AG-UI protocol instead of the LangGraph SDK.
- See how a single `CUSTOM` event named `on_interrupt` becomes `agent.interrupt()` in Angular.
- Swap adapters without touching the component — the parity proof.

## The parity proof

The Angular component file is byte-identical to the LangGraph version from [the precedent post](/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular) except for the `injectAgent` import:

```diff
- import { provideAgent, injectAgent } from '@threadplane/langgraph';
+ import { provideAgent, injectAgent } from '@threadplane/ag-ui';
```

The `app.config.ts` adapter swap is one line in the providers array:

```diff
- provideAgent({ apiUrl: '/api', assistantId: 'interrupts' }),
+ provideAgent({ url: '/agent' }),
```

That's the whole client-side delta. The rest of the file — the template binding `<chat-approval-card>`, the `(action)` handler, the approve / edit / cancel branches, the `submit({ resume })` call — is unchanged.

`<chat-approval-card>` reads `agent.interrupt()` (a `Signal<AgentInterrupt | undefined>`), and `submit({ resume })` is part of the runtime-neutral `Agent` contract declared in `@threadplane/chat`. Both adapters populate the signal and forward the resume; the chat surface above doesn't see the wire format.
````

(The langgraph-side `apiUrl`/`assistantId` strings in the diff above must match the precedent's `app.config.ts` snippet — verify by reading `cockpit/langgraph/interrupts/angular/src/app/app.config.ts` if the literal values differ.)

- [ ] **Step 5: Verify**

```bash
grep -n "byte-identical except the import" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
grep -n "CardGroup cols={2}" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
grep -n "^title:\|^date:\|^author: brian\|^featured: true" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
```
Expected: the parity claim phrase present; CTA group present; frontmatter complete.

- [ ] **Step 6: Commit**

```bash
git add apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
git commit -m "docs(blog): start ag-ui interrupts post — frontmatter + lede + parity hook"
```

---

## Task 2: When to use an interrupt + Architecture (Sections 3–4)

**Files:** Append to `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

- [ ] **Step 1: Verify the AG-UI-specific architecture claims against source**

```bash
# Confirm the on_interrupt branch + JSON parse exist in the adapter:
grep -n "on_interrupt\|JSON.parse\|safeParseJson" libs/ag-ui/src/lib/reducer.ts | head
# Confirm AgentInterrupt shape:
grep -nE "interface AgentInterrupt|id:|value:|resumable:" libs/chat/src/lib/agent/agent-interrupt.ts | head
# Confirm forwardedProps.command.resume path in to-agent.ts:
grep -n "forwardedProps\|command\|resume" libs/ag-ui/src/lib/to-agent.ts | head
# Confirm server.py mounts /agent + has /ok:
grep -nE "add_langgraph_fastapi_endpoint|path=|/ok" cockpit/ag-ui/interrupts/python/src/server.py | head
# Confirm MemorySaver is used:
grep -nE "MemorySaver|checkpointer" cockpit/ag-ui/interrupts/python/src/graph.py cockpit/ag-ui/interrupts/python/src/server.py | head
```
Expected: every claim the post makes about the wire has a matching source line. If `MemorySaver` is NOT in graph.py/server.py, the post must not claim it's there — STOP and reconcile (the spec assumed PR #567's implementer added it).

- [ ] **Step 2: Author Section 3 (When to use an interrupt — paraphrased, AG-UI-tilted)**

Append to the file:

```mdx
## When to use an interrupt

Most tool calls don't need approval. Reads, searches, and lookups can run unattended. Reach for an interrupt when a tool does something the operator wouldn't want to undo by hand: moves money, sends a customer-facing message, deletes a record, or triggers a deploy.

Two practical reasons hold up: it caps the cost of a misfiring agent looping over a write API, and it gives the operator a checkpoint to catch a wrong action before it lands.

The AG-UI angle adds a third. Because AG-UI normalizes the wire across many backends, the same operator-approval checkpoint plugs into LangGraph, CrewAI, Mastra, Pydantic AI, or anything else that speaks AG-UI — with no UI rewrite. If your shop runs more than one agent backend, that's a real benefit. The `<chat-approval-card>` you build today survives the backend you swap in next year.
```

- [ ] **Step 3: Author Section 4 (The architecture — three pieces, AG-UI-tilted)**

Append:

````mdx
## The architecture

Three pieces:

- **AG-UI-fronted LangGraph backend.** The same compiled graph as the LangGraph post, duplicated under `cockpit/ag-ui/interrupts/python` because cockpit examples are standalone. Wrapped with `ag-ui-langgraph`'s `LangGraphAgent(name, graph)` + `add_langgraph_fastapi_endpoint(app, agent, path='/agent')` and served by `uvicorn`. When `interrupt()` fires inside the graph, `ag-ui-langgraph` emits a `CUSTOM` AG-UI event with `name: 'on_interrupt'` and a `value` carrying the interrupt payload — serialized as a JSON string via `dump_json_safe`. The uvicorn server needs a `MemorySaver` checkpointer (`langgraph dev` and LangGraph Platform inject one automatically; plain uvicorn does not, and `aget_state` raises "No checkpointer set" without it).
- **`@threadplane/ag-ui` adapter.** The reducer recognizes the `CUSTOM`/`on_interrupt` event, JSON-parses the string `value` so consumers see the structured object, and sets `agent.interrupt()` to `{ id, value, resumable: true }`. `agent.submit({ resume })` short-circuits the message-append path and calls `source.runAgent({ forwardedProps: { command: { resume } } })`. The server reads `forwarded_props.command.resume`. The adapter exposes the same `Agent` contract as `@threadplane/langgraph`.
- **`@threadplane/chat` UI.** `<chat-approval-card matchKind="refund_approval">` reads `agent.interrupt()`, opens a `<dialog>`-backed modal, and emits `'approve' | 'edit' | 'cancel'`. Resume actions call `agent.submit({ resume: { approved, amount? } })`. Reject calls `submit({ resume: { approved: false } })`. The component doesn't know which adapter is wired. That's the point.

The data flow on resume:

```
<chat-approval-card> (action: approve)
  → agent.submit({ resume: { approved: true, amount: 99.00 } })
    → source.runAgent({ forwardedProps: { command: { resume: { approved, amount } } } })
      → POST /agent (body carries forwarded_props.command.resume)
        → ag-ui-langgraph: Command(resume=value) → graph continues
```

On the LangGraph adapter, the same `submit({ resume })` becomes a native `Client.submit(thread, command={resume:…})` call. Different wire, same Angular surface.
````

- [ ] **Step 4: Verify**

```bash
grep -nE "on_interrupt|dump_json_safe|MemorySaver|forwarded_props\.command\.resume" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx | head
```
Expected: every load-bearing technical term present.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
git commit -m "docs(blog): ag-ui interrupts — when-to-use + architecture sections"
```

---

## Task 3: Scaffold — the four-step code walk (Section 5)

**Files:** Append to `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

This is the largest task. Each step's code block must be source-verified character-by-character against the cockpit example.

- [ ] **Step 1: Verify all four code sources exist + extract**

```bash
sed -n '20,60p' cockpit/ag-ui/interrupts/python/src/graph.py    # the relevant graph node
cat cockpit/ag-ui/interrupts/python/src/server.py
cat cockpit/ag-ui/interrupts/angular/src/app/app.config.ts
cat cockpit/ag-ui/interrupts/angular/proxy.conf.mjs
sed -n '1,30p' cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts   # imports + class decl for the parity claim
```
Note the exact content of each. The Step 1 (graph) code block in the post need not be the full file — the precedent shows ~20 lines around `request_approval`; mirror that scope.

- [ ] **Step 2: Author Section 5 opener + Step 1 (the LangGraph node)**

Append to the file:

````mdx
## Scaffold

Four steps.

<Steps>
<Step title="The LangGraph node">

A structured-output call populates the fields the approval card displays. Then `request_approval` pauses with `interrupt()`:

```python
# graph.py — cockpit/ag-ui/interrupts/python/src/graph.py
<<<PASTE the relevant slice from the source file — the structured-output extractor + the request_approval node + the interrupt(...) payload. Match the precedent post's code-block length conventions (~25–35 lines). End the block with the closing of request_approval.>>>
```

This file is **duplicated** into `cockpit/ag-ui/interrupts/python/src/graph.py` per the cockpit standalone-examples convention — copy, don't import across examples. The graph itself doesn't know it'll be served over AG-UI.

</Step>
````

Replace the `<<<PASTE…>>>` placeholder with the actual code from `cockpit/ag-ui/interrupts/python/src/graph.py`. Pick the slice that shows the `RefundDraft` model + `extractor = ChatOpenAI(...).with_structured_output(RefundDraft)` + `async def draft_refund(...)` + `async def request_approval(...)` ending at the `interrupt(...)` call. Keep imports out unless they're load-bearing for the snippet's readability. Match the precedent's `# graph.py — cockpit/langgraph/interrupts/python/src/graph.py` filename-as-comment convention.

- [ ] **Step 3: Author Step 2 (Wrap with ag-ui-langgraph + uvicorn)**

Append:

````mdx
<Step title="Wrap the graph with ag-ui-langgraph + uvicorn">

`ag-ui-langgraph` translates LangGraph runtime events into AG-UI protocol events and mounts a FastAPI endpoint. We add a `/ok` route for the e2e harness's readiness check:

```python
# server.py — cockpit/ag-ui/interrupts/python/src/server.py
<<<PASTE the full content of cockpit/ag-ui/interrupts/python/src/server.py>>>
```

Run with `uv run uvicorn src.server:app --port 5320`.

Two details worth knowing:

- **`MemorySaver` is mandatory here.** `ag-ui-langgraph` calls `graph.aget_state(config)` to read the post-stream interrupt state. `langgraph dev` and LangGraph Platform inject a checkpointer; plain uvicorn does not. Without one, `aget_state` raises "No checkpointer set" and the run never surfaces the interrupt.
- **The `dump_json_safe` quirk.** When `interrupt({…})` fires, `ag-ui-langgraph` serializes `value` to a JSON string before placing it on the wire so arbitrary Python objects survive JSON-encoding. The `@threadplane/ag-ui` reducer parses it back to an object for you, so the Angular side never sees the string.

</Step>
````

Replace the placeholder with the verbatim content of `server.py`. Use the actual filename-as-comment format.

- [ ] **Step 4: Author Step 3 (app.config.ts + proxy.conf.mjs)**

Append:

````mdx
<Step title="Wire the adapter in app.config.ts">

```ts
// app.config.ts — cockpit/ag-ui/interrupts/angular/src/app/app.config.ts
<<<PASTE the full content of cockpit/ag-ui/interrupts/angular/src/app/app.config.ts>>>
```

The Angular dev server proxies `/agent` to the uvicorn port from `cockpit/ports.mjs`:

```js
// proxy.conf.mjs — cockpit/ag-ui/interrupts/angular/proxy.conf.mjs
<<<PASTE the full content of cockpit/ag-ui/interrupts/angular/proxy.conf.mjs>>>
```

AG-UI's `provideAgent({ url })` and LangGraph's `provideAgent({ apiUrl, assistantId })` share the symmetric provider name but take different config shapes because the wire protocols differ. The provider+inject names are deliberately symmetric across both adapters — that's what makes the component code unchanged.

</Step>
````

Replace placeholders with verbatim source content.

- [ ] **Step 5: Author Step 4 (the Angular component — the parity payoff)**

Append:

````mdx
<Step title="The Angular component">

```ts
// interrupts.component.ts — cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts
<<<PASTE the full content of cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts>>>
```

This is the same file as `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` from the LangGraph post — **byte-identical except for the `injectAgent` import**. The template binds `<chat-approval-card matchKind="refund_approval">` to the agent. When `agent.interrupt()` becomes non-undefined, the dialog opens. The `(action)` event fires `'approve' | 'edit' | 'cancel'`; the handler calls `agent.submit({ resume: { approved, amount? } })`. The `{ approved, amount? }` shape couples back to whatever the LangGraph node will read from `Command(resume=…)` — keep them in sync.

The `matchKind` input is the discriminator pattern that keeps the dialog component reusable across interrupt kinds. If your graph emits `interrupt({ kind: 'deploy_approval', … })`, a separate `<chat-approval-card matchKind="deploy_approval">` instance picks that up — same component, different match.

</Step>
</Steps>
````

Replace the placeholder with the verbatim component source. (Note the closing `</Steps>` tag — only this last step closes the wrapper.)

- [ ] **Step 6: Verify all code blocks match source**

```bash
# Each code block in the .mdx must match its source file. Spot-check by
# extracting one of the longer blocks and diffing structurally:
awk '/```python/,/```/' apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx | grep -c "interrupt(" 
grep -nE "^# (server|graph|app\.config|interrupts\.component|proxy\.conf)\.(py|ts|mjs)" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
# No <<<PASTE>>> placeholders remain:
grep -n "<<<PASTE" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx && echo "PLACEHOLDERS REMAIN" || echo "clean"
# The byte-identical claim text is present:
grep -n "byte-identical except for the .injectAgent. import" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
```
Expected: filename comments present; no `<<<PASTE>>>` markers; parity claim present.

- [ ] **Step 7: Commit**

```bash
git add apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
git commit -m "docs(blog): ag-ui interrupts — scaffold (graph + server + app.config + component)"
```

---

## Task 4: Walk the run + Closing (Sections 6–7)

**Files:** Append to `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`

- [ ] **Step 1: Verify the on-wire JSON example and the resume code against the adapter**

```bash
# Confirm the reducer JSON-parses the value (i.e. the wire example having a string `value` is accurate):
grep -nE "JSON\.parse|safeParseJson|on_interrupt" libs/ag-ui/src/lib/reducer.ts | head
# Confirm submit({ resume }) uses forwardedProps.command.resume in to-agent.ts:
grep -nE "forwardedProps|command|resume" libs/ag-ui/src/lib/to-agent.ts | head
```
Expected: reducer parses string `value`; to-agent.ts forwards `resume` via `forwardedProps.command.resume`.

- [ ] **Step 2: Author Section 6 (Walk the run)**

Append:

````mdx
## Walk the run

### Streaming start → the draft

The user clicks "Refund a duplicate charge." A run starts; token-level `TEXT_MESSAGE_CONTENT` events stream the assistant's draft and `messages()` updates incrementally. For more on the AG-UI streaming model, see [Build Fullstack Agentic Angular Apps Using AG-UI](/blog/2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui).

### The interrupt arrives

The structured-output call finishes, the graph hits `request_approval`, and `interrupt({ kind: 'refund_approval', … })` fires. `ag-ui-langgraph` emits the `CUSTOM` event on the SSE stream:

```jsonc
// AG-UI event on the wire
{
  "type": "CUSTOM",
  "name": "on_interrupt",
  "value": "{\"kind\":\"refund_approval\",\"amount\":99.0,\"customer_id\":\"cus_a8x2k\",\"reason\":\"Duplicate charge on 2024-12-01.\"}"
}
```

`value` is a JSON string — that's the `dump_json_safe` quirk. The `@threadplane/ag-ui` reducer parses it and sets:

```ts
agent.interrupt() // → { id: 'r3w…', value: { kind, amount, customer_id, reason }, resumable: true }
```

`<chat-approval-card matchKind="refund_approval">` is bound to `agent.interrupt()`. The moment the signal becomes non-undefined, the dialog opens with the structured payload. The run has already finished (`RUN_FINISHED` arrived); the graph is parked at its checkpoint until something resumes it.

### Approve, edit, or cancel → resume

When the operator clicks Approve:

```ts
this.agent.submit({ resume: { approved: true, amount: this.editAmount() ?? payload.amount } });
```

The adapter clears `agent.interrupt()` immediately for snappy UX, then forwards the resume:

```ts
source.runAgent({ forwardedProps: { command: { resume: { approved: true, amount: 99 } } } });
```

A new `POST /agent` request fires. `ag-ui-langgraph` reads `forwarded_props.command.resume`, constructs a `Command(resume=…)`, and continues the graph from the checkpoint. Token-level streaming resumes; the assistant confirms the refund issued. Reject (`{ approved: false }`) takes the alternate branch in the graph; edit-then-approve carries a new `amount` through `Command(resume=…)`.

On the langgraph adapter the same `submit({ resume })` becomes a native `Client.submit(thread, command={resume:…})` call. Different wire, same Angular surface.
````

- [ ] **Step 3: Author Section 7 (Closing + pointers)**

Append:

```mdx
## Closing

The runtime-neutral `Agent` contract isn't a marketing line; it's the reason this post existed without rewriting the component. `<chat-approval-card>`, `agent.interrupt()`, and `submit({ resume })` are the stable surface. `on_interrupt` and `forwardedProps.command.resume` are the AG-UI-specific wire details the adapter hides. Pick the adapter that matches your backend — LangGraph SDK direct → `@threadplane/langgraph`; anything AG-UI-fronted, including LangGraph-via-`ag-ui-langgraph` → `@threadplane/ag-ui`. Your chat surface doesn't pick.

Pointers:

- The working example: [`cockpit/ag-ui/interrupts`](https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/ag-ui/interrupts) — Angular + Python, e2e-tested.
- The cross-adapter parity rendered in docs: [Choosing an adapter](https://threadplane.ai/docs/choosing-an-adapter).
- The AG-UI interrupts guide for protocol-level detail: [/docs/ag-ui/guides/interrupts](https://threadplane.ai/docs/ag-ui/guides/interrupts).
- The langgraph counterpart, if you want both sides side-by-side: [Human-in-the-Loop LangGraph Agents in Angular](/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular).
```

- [ ] **Step 4: Verify**

```bash
grep -n "forwarded_props\.command\.resume" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
grep -n "Choosing an adapter\|/docs/ag-ui/guides/interrupts" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
grep -n "^## Closing\|^## Walk the run" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
```
Expected: each section heading + the pointer links present.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
git commit -m "docs(blog): ag-ui interrupts — walk the run + closing"
```

---

## Task 5: Image figure placeholders + verify nav + build

**Files:** Modify `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`; possibly `apps/website/src/lib/blog-config.ts` or similar (verify auto-discovery).

- [ ] **Step 1: Insert three `<figure>` blocks at their beats**

Read the precedent post and observe where its three figures sit. Insert three matching `<figure>` blocks in the new post at parallel beats:

1. After the architecture section closing one-liner (end of Section 4) — the welcome screen.
2. Inside "The interrupt arrives" (Section 6), after the `agent.interrupt()` code block — the approval card dialog open.
3. After "Approve, edit, or cancel" final paragraph (end of Section 6) — the completed run with refund confirmation.

Use this MDX shape (mirror the precedent — width/height match the screenshot dimensions; caption voice matches the precedent's voice):

```mdx
<figure>
  <img src="/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular/1.png" alt="The cockpit ag-ui/interrupts welcome screen showing two suggestion chips: 'Refund a duplicate charge' and 'Refund a chargeback.'" width="1280" height="800" />
  <figcaption>The cockpit refund example on the AG-UI adapter.</figcaption>
</figure>
```

Vary `src`, `alt`, and `figcaption` per figure. The PNGs themselves DO NOT EXIST YET — capturing them is a follow-up step. The post can still ship (frontmatter `featured: true` + image asset MIA results in a broken-image placeholder; the alt text is enough for readability and the editor will fill in the screenshots before publish).

Suggested `alt` text per figure:

1. *"The cockpit ag-ui/interrupts welcome screen showing two suggestion chips."*
2. *"The approval card dialog open over the chat, showing the structured refund payload (customer, amount, reason)."*
3. *"The chat history after the refund was approved and the run completed, showing the assistant's confirmation."*

Suggested `figcaption` per figure (terse, mirroring precedent voice):

1. *"The cockpit refund example on the AG-UI adapter."*
2. *"The approval card with structured payload fields."*
3. *"Run resumed and finished after Approve."*

- [ ] **Step 2: Verify nav registration**

Read `apps/website/src/app/blog/page.tsx` (the blog index route) and `apps/website/src/app/blog/[slug]/page.tsx` to confirm whether posts are auto-discovered from `apps/website/content/blog/*.mdx` or registered in a config (search `grep -rln "human-in-the-loop-langgraph-agents-in-angular" apps/website/src/lib`). If a registry exists, add the new slug; if discovery is automatic, no edit.

- [ ] **Step 3: Build the website**

```bash
npx nx build website 2>&1 | tail -10
```
Expected outcomes:
- If the build succeeds, you're done.
- If the build fails ONLY for the pre-existing `posthog-node` missing-package error (unrelated, predates this branch), that's acceptable — note it in the report.
- If the build fails for a reason CAUSED by the new post (broken MDX syntax, unresolved `<Card>`/`<Steps>` component, missing image route handler), FIX before committing.

- [ ] **Step 4: Verify final state**

```bash
wc -l apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx
grep -c "^## " apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx        # expect ~7 (Goals, parity proof, when to use, architecture, scaffold, walk the run, closing)
grep -c "<figure>" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx   # expect 3
grep -n "<<<PASTE\|TBD\|TODO" apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx && echo "PLACEHOLDERS" || echo "clean"
```
Expected: ~7 `##` headings; 3 `<figure>` blocks; no leftover placeholders.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx \
        apps/website/src 2>/dev/null   # only if nav registration edit was needed; safely no-op if not
git commit -m "docs(blog): ag-ui interrupts — figure placeholders + nav verified"
```

---

## Self-Review (completed during planning)

**Spec coverage:**

- Spec §1 (Frontmatter + lede + CTAs) → T1.
- Spec §2 (Goals + parity hook) → T1.
- Spec §3 (When to use an interrupt — paraphrased) → T2.
- Spec §4 (Architecture — three pieces + data flow trace) → T2.
- Spec §5 (Scaffold — four steps) → T3.
- Spec §6 (Walk the run — three sub-sections) → T4.
- Spec §7 (Closing + pointers) → T4.
- Spec §8 (Images + nav registration) → T5.

All 8 spec sections covered.

**Placeholder scan:** Only `<<<PASTE …>>>` markers in T3 are explicit pre-paste instructions, replaced before T3's commit; T3 Step 6 greps for any leftover markers. Image PNGs are explicitly OUT OF SCOPE per the spec, with descriptive `alt` text serving until they're captured. No `TBD`/`TODO` in executable steps.

**Type/name consistency:** Identifiers used across tasks: `provideAgent`, `injectAgent`, `agent.interrupt()`, `submit({ resume })`, `<chat-approval-card>`, `matchKind="refund_approval"`, `on_interrupt`, `forwardedProps.command.resume`, `forwarded_props.command.resume`, `dump_json_safe`, `MemorySaver`, `ag-ui-langgraph`. All used identically across tasks.

## Risks / verify-as-you-go

- **T1 Step 1 verification** (the component byte-identical claim) is load-bearing. If the live diff shows MORE than the `injectAgent` import line, the parity claim must be adjusted — either trim the prose claim or surface the additional diff in Section 2.
- **`MemorySaver` source check (T2 Step 1)** could surface that PR #567's implementer didn't add it to graph.py specifically. If so, the spec's claim "Needs a `MemorySaver` checkpointer" stays accurate (the implementer DID add it; just confirm the precise file). Adjust the prose to wherever it actually lives.
- **`<Card>`/`<Steps>` MDX components** are assumed available from the precedent post; if the website's MDX setup has changed, T5 Step 3's build catches it.
