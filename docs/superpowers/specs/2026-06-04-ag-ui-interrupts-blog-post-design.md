# Blog Post: "Human-in-the-Loop AG-UI Agents in Angular" — Design

**Date:** 2026-06-04
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

The AG-UI adapter's interrupt support (PR #567) shipped end-to-end with a working `cockpit/ag-ui/interrupts` example proving it. There's a clear distribution opportunity: the framework's first cross-adapter HITL story. Brian shipped the LangGraph-side counterpart a week ago (`2026-05-28-human-in-the-loop-langgraph-agents-in-angular.mdx`). The new post should land as a standalone tutorial that distinguishes itself with the cross-adapter parity angle — not a rewrite of the precedent.

## Goals

- Land a publishable blog post at `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx`.
- Distinguish from the LangGraph HITL precedent via the **"same UI, two adapters"** angle: the Angular component is byte-identical except the adapter import.
- Document the AG-UI-specific HITL wire details once, in a discoverable post: `CUSTOM`/`on_interrupt`, `dump_json_safe` JSON-string `value`, `forwardedProps.command.resume`, the `ag-ui-langgraph` FastAPI + `MemorySaver` infra detail.
- Drive traffic to the working `cockpit/ag-ui/interrupts` demo and source.

## Voice

Voice ground truth: memory `feedback_blog_voice_no_anecdotes`.

- No fabricated first-person stories or anecdotes for Brian.
- Trimmed technical register: no emojis, no rhetoric, no "fun" headers, no exclamation marks.
- Substance over framing. Short sentences. Code-heavy.
- The precedent post (`2026-05-28-…langgraph…`) is the local voice ground truth. Match its register exactly.

Per the user: it is OK to **paraphrase** concepts from the precedent (when-to-use-an-interrupt framing, approval-card UX explanation) so this post stands alone. Do NOT copy paragraphs verbatim — re-author them in the AG-UI context.

## Decisions (from brainstorming)

- **Angle:** "Same UI, two adapters" — runtime-neutral parity.
- **Depth:** Full standalone walkthrough (~6–10k words) mirroring the precedent's structure.
- **Standalone vs. linked:** Stand on its own; paraphrase (don't verbatim-copy) shared concepts; still link the precedent + AG-UI tutorial + choosing-an-adapter docs from the close.
- **Images:** Re-capture three screenshots from `cockpit/ag-ui/interrupts` matching the precedent's beats. Asset capture is a follow-up step, NOT in this spec's scope (the post can ship with placeholder paths committed and screenshots filled in before publish).
- **Author/featured:** `brian` / `featured: true` (matches precedent).

## In-scope vs. out-of-scope

**In scope:**
- The full `.mdx` file content (frontmatter + 7 sections + closing pointers).
- Three figure placeholders with intended captions and `alt` text (so the post is structurally complete; PNGs land separately).

**Out of scope:**
- Capturing the actual `.png` screenshots.
- Any code changes to `@threadplane/ag-ui`, `cockpit/ag-ui/interrupts`, or the framework.
- Reworking the precedent's HITL post.
- Generating an opengraph / social card image (the website's blog template likely handles this from frontmatter).

---

## Design

### Section 1: Frontmatter + lede + CTA cards

**Frontmatter** (mirror the precedent exactly except for slug-specific fields):

```yaml
---
title: "Human-in-the-Loop AG-UI Agents in Angular"
description: "Build a human-in-the-loop AG-UI agent in Angular — the same `<chat-approval-card>` from the LangGraph version, wired to an AG-UI-fronted LangGraph backend via @threadplane/ag-ui."
date: 2026-06-04
tags: [tutorial, ag-ui, angular, agents, hitl, interrupts]
author: brian
featured: true
---
```

**Lede** (two sentences):

> This is how to pause an AG-UI agent in Angular for human approval before it runs a high-stakes tool, using a `CUSTOM` `on_interrupt` event and the `<chat-approval-card>` composition from `@threadplane/chat`. The example is the same refund agent from [Human-in-the-Loop LangGraph Agents in Angular](/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular) — wired through the AG-UI adapter instead. The Angular component is byte-identical except the import.

**A short follow-up paragraph** stating where the running code lives: "Everything below is running code from the cockpit example at `cockpit/ag-ui/interrupts`. Clone the repo, run `nx serve cockpit-ag-ui-interrupts-angular`, and follow along."

**CTA card group** (same shape as precedent):

```mdx
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

### Section 2: Goals + the parity hook

**Goals (three bullets):**
- Wire the same refund-approval gate over the AG-UI protocol instead of the LangGraph SDK.
- See how a single `CUSTOM` event named `on_interrupt` becomes `agent.interrupt()` in Angular.
- Swap adapters without touching the component — the parity proof.

**The parity hook** — place this *before* the architecture section as the post's distinguishing content. Show a side-by-side diff of `app.config.ts` (adapter swap) and the component import:

```diff
- import { provideAgent, injectAgent } from '@threadplane/langgraph';
+ import { provideAgent, injectAgent } from '@threadplane/ag-ui';
```

```diff
- provideAgent({ apiUrl: '/api', assistantId: 'interrupts' }),
+ provideAgent({ url: '/agent' }),
```

**Why this works** (one paragraph): `<chat-approval-card>` reads `agent.interrupt()` (a `Signal<AgentInterrupt | undefined>`), and `submit({ resume })` is part of the runtime-neutral `Agent` contract — `interrupt` is declared on the `Agent` interface in `@threadplane/chat`, both adapters populate it, the chat surface above doesn't see the wire format.

### Section 3: When to use an interrupt (paraphrased, AG-UI-tilted)

A fresh ~150-word section re-covering the precedent's "When to use an interrupt" framing in AG-UI-specific language. Tilt:

- Same heuristic — interrupt when an action moves money, sends a customer-facing message, deletes a record, or triggers a deploy.
- AG-UI-specific addendum: because AG-UI normalizes the wire across many backends, the same operator-approval checkpoint plugs into LangGraph, CrewAI, Mastra, etc. with no UI rewrite. Worth calling out — it's a real benefit for shops running heterogeneous agent backends.

### Section 4: The architecture (three pieces, AG-UI-tilted)

Mirror the precedent's "three pieces" framing; each piece highlights AG-UI specifics.

**1. AG-UI-fronted LangGraph backend.**
- Same compiled graph as the precedent, duplicated under `cockpit/ag-ui/interrupts/python` per the cockpit standalone-examples convention.
- Wrapped with `ag-ui-langgraph`'s `LangGraphAgent(name, graph)` + `add_langgraph_fastapi_endpoint(app, agent, path='/agent')`; mounted as a FastAPI app and served by `uvicorn`.
- When `interrupt()` fires, `ag-ui-langgraph` emits a `CUSTOM` AG-UI event with `name: 'on_interrupt'` and `value: <the interrupt payload, serialized as a JSON string via dump_json_safe>`.
- Needs a `MemorySaver` checkpointer — `langgraph dev`/Platform inject one automatically; plain uvicorn does not, and `aget_state` raises "No checkpointer set" without it.

**2. `@threadplane/ag-ui` adapter.**
- Reducer recognizes `CUSTOM`/`on_interrupt`, JSON-parses the string `value` so consumers see the structured object, sets `agent.interrupt()` to `{ id, value, resumable: true }`.
- `agent.submit({ resume })` short-circuits the message-append path and calls `source.runAgent({ forwardedProps: { command: { resume } } })`. The server reads `forwarded_props.command.resume`.
- Exposes the same `Agent` contract as `@threadplane/langgraph`.

**3. `@threadplane/chat` UI — unchanged.**
- `<chat-approval-card matchKind="refund_approval">` reads `agent.interrupt()` and renders the dialog (`<dialog>`-backed modal, emits `'approve' | 'edit' | 'cancel'`).
- Resume actions call `agent.submit({ resume: { approved, amount? } })`. Reject calls `submit({ resume: { approved: false } })`.
- Adapter-agnostic by design.

**Data-flow trace on resume** (formatted as a code block, indented arrows):

```
<chat-approval-card> (action: approve)
  → agent.submit({ resume: { approved: true, amount: 99.00 } })
    → source.runAgent({ forwardedProps: { command: { resume: { approved, amount } } } })
      → POST /agent (body carries forwarded_props.command.resume)
        → ag-ui-langgraph: Command(resume=value) → graph continues
```

Closing one-liner of the section: *On the LangGraph adapter, the same `submit({ resume })` becomes a native `Client.submit(thread, command={resume:…})` call. Different wire, same Angular surface.*

### Section 5: Scaffold — the code walk

Mirror the precedent's `<Steps>` block. Four steps.

**Step 1 — The LangGraph node.** Identical content to the precedent. Show the `RefundDraft` Pydantic model, `extractor` (`ChatOpenAI.with_structured_output(RefundDraft)`), and the `request_approval` node calling `interrupt({ "kind": "refund_approval", … })`. Add a one-line callout: the file is **duplicated** into `cockpit/ag-ui/interrupts/python/src/graph.py` per the cockpit examples convention — copy, don't import across examples. The graph itself doesn't know it'll be served over AG-UI.

**Step 2 — Wrap with `ag-ui-langgraph` + uvicorn.** The piece the precedent doesn't have. Full `server.py`:

```python
# server.py — cockpit/ag-ui/interrupts/python/src/server.py
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from langgraph.checkpoint.memory import MemorySaver
from .graph import build_graph

graph = build_graph(checkpointer=MemorySaver())  # uvicorn doesn't inject one
agent = LangGraphAgent(name='interrupts', graph=graph)

app = FastAPI(title='cockpit-ag-ui-interrupts')
add_langgraph_fastapi_endpoint(app, agent, path='/agent')

@app.get('/ok')
def ok() -> dict:
    return {'ok': True}
```

Run with `uv run uvicorn src.server:app --port 5320`. Two callouts:

- **`MemorySaver` is mandatory.** Without it, `aget_state` raises "No checkpointer set" because plain uvicorn does not inject one — only `langgraph dev`/Platform do.
- **The `dump_json_safe` quirk.** `ag-ui-langgraph` serializes interrupt `value` to a JSON string on the wire (so arbitrary Python objects survive JSON-encoding). The `@threadplane/ag-ui` reducer parses it back to an object for you, so consumers never see the string.

**Step 3 — `app.config.ts`.** The Angular DI swap:

```ts
// app.config.ts — cockpit/ag-ui/interrupts/angular/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';
import { provideChat } from '@threadplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ url: '/agent' }),
    provideChat({}),
  ],
};
```

Plus `proxy.conf.mjs` routing `/agent` → the uvicorn port:

```js
// proxy.conf.mjs — cockpit/ag-ui/interrupts/angular/proxy.conf.mjs
import { portsFor } from '../../../../cockpit/ports.mjs';
const { langgraph: backend } = portsFor('cockpit-ag-ui-interrupts-angular');
export default { '/agent': { target: `http://localhost:${backend}`, changeOrigin: true, ws: true } };
```

Brief contrast: AG-UI's `provideAgent({ url })` vs. LangGraph's `provideAgent({ apiUrl, assistantId })`. Same provider name (the symmetric surface from the agent→langgraph rename), different config shape because the backend protocols differ.

**Step 4 — The Angular component (the parity payoff).** Show `interrupts.component.ts`. Then state explicitly: this file is **byte-identical** to `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts` from the precedent post, except for the one-line `injectAgent` import. Don't re-walk the template mechanics — paraphrase a tight version of the precedent's approval-card section (~150 words) covering: the `matchKind` input, the dialog open/close lifecycle tied to the `agent.interrupt()` signal becoming non-undefined, the `(action)` event, and how the resume payload's `{ approved, amount? }` shape couples back to the graph's `interrupt(...)` payload.

### Section 6: Walk the run — what the user sees

Narrate observed behavior end-to-end with the wire calls woven in. Three sub-sections.

**Streaming start → the draft.** User clicks "Refund a duplicate charge." Token-level `TEXT_MESSAGE_CONTENT` events stream the assistant's draft; `messages()` updates. One brief paragraph; assume streaming is familiar to readers (link the AG-UI tutorial post).

**The interrupt arrives.** Show the AG-UI event (paraphrased — exact serialization is the adapter's concern):

```jsonc
// AG-UI event on the wire
{
  "type": "CUSTOM",
  "name": "on_interrupt",
  "value": "{\"kind\":\"refund_approval\",\"amount\":99.0,\"customer_id\":\"cus_a8x2k\",\"reason\":\"Duplicate charge on 2024-12-01.\"}"
}
```

Call out the JSON-string detail. Show how the reducer parses it and what the consumer sees:

```ts
agent.interrupt() // → { id: 'r3w…', value: { kind, amount, customer_id, reason }, resumable: true }
```

`<chat-approval-card matchKind="refund_approval">` is bound to `agent.interrupt()`, so the moment that signal becomes non-undefined the dialog opens. The run has already finished (`RUN_FINISHED` arrived); the graph is parked at its checkpoint until something resumes.

**Approve / edit / cancel → resume.** When the operator clicks Approve:

```ts
this.agent.submit({ resume: { approved: true, amount: this.editAmount() ?? payload.amount } });
```

The adapter clears `agent.interrupt()` immediately (snappy UX), then:

```ts
source.runAgent({ forwardedProps: { command: { resume: { approved: true, amount: 99 } } } });
```

A new `POST /agent` fires; `ag-ui-langgraph` reads `forwarded_props.command.resume`, constructs a `Command(resume=…)`, and continues the graph. Token-level streaming resumes; the assistant confirms the refund issued. Reject (`{ approved: false }`) takes the alternate branch; edit-then-approve carries a new `amount`.

Closing one-liner: *On the langgraph adapter the same `submit({ resume })` becomes a native `Client.submit(thread, command={resume:…})` call. Different wire, same Angular surface.*

### Section 7: Closing + durable lesson + pointers

Two paragraphs, no anecdote.

**Paragraph 1 — durable lesson.** The runtime-neutral `Agent` contract isn't a marketing line; it's the reason this post existed without rewriting the component. `<chat-approval-card>`, `agent.interrupt()`, and `submit({ resume })` are the stable surface. `on_interrupt` and `forwardedProps.command.resume` are the AG-UI-specific wire details the adapter hides. Pick the adapter that matches your backend (LangGraph SDK direct → `@threadplane/langgraph`; anything AG-UI-fronted, including LangGraph-via-`ag-ui-langgraph` → `@threadplane/ag-ui`). Your chat surface doesn't pick.

**Paragraph 2 — pointers** (bullet list):
- The working example: `cockpit/ag-ui/interrupts` (Angular + Python).
- The cross-adapter parity rendered in docs: [Choosing an adapter](https://threadplane.ai/docs/choosing-an-adapter).
- The AG-UI interrupts guide for protocol-level detail: [/docs/ag-ui/guides/interrupts](https://threadplane.ai/docs/ag-ui/guides/interrupts).
- The langgraph counterpart, if you want both sides side-by-side: [Human-in-the-Loop LangGraph Agents in Angular](/blog/2026-05-28-human-in-the-loop-langgraph-agents-in-angular).

### Section 8: Images + nav registration

**Images.** Three `<figure>` blocks placed at the precedent post's matching beats:

1. After the architecture section — the cockpit refund example's welcome screen (suggestion chips: "Refund a duplicate charge", "Refund a chargeback").
2. Inside Step 4 or "The interrupt arrives" — the approval card dialog open, showing the refund payload.
3. After "Approve / edit / cancel" — the completed run with refund confirmation in the message list.

All three live under `apps/website/public/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular/{1,2,3}.png`. The MDX references the paths with descriptive `alt` text + `<figcaption>` matching the precedent's caption voice. The actual `.png` files are TBD (capture step is post-this-spec).

**Nav registration.** The website's blog index is auto-generated from `apps/website/content/blog/*.mdx`. The implementation plan will verify (read `apps/website/src/app/blog/page.tsx` and the related `blog/[slug]/page.tsx` route) and, if there IS a manual register list, add the post; otherwise no nav edit.

---

## Success criteria

- `apps/website/content/blog/2026-06-04-human-in-the-loop-ag-ui-agents-in-angular.mdx` exists, frontmatter matches the precedent shape (right tags, `author: brian`, `featured: true`).
- The post stands alone (no required prerequisite reading) while still linking the precedent + tutorial + docs.
- Every code block is copy-pasteable and matches the `cockpit/ag-ui/interrupts` source (graph.py, server.py, app.config.ts, proxy.conf.mjs, interrupts.component.ts). The implementation plan will verify each block against the cockpit example.
- The parity claim is concrete: a literal diff for the import + config; an explicit "byte-identical except the import" callout for the component.
- AG-UI-specific details are accurate: `CUSTOM`/`on_interrupt`, `dump_json_safe` JSON-string `value`, `forwardedProps.command.resume`, `MemorySaver` mandatory for uvicorn.
- `nx build website` succeeds with the new post in place (pre-existing posthog-node failure is unrelated).
- Image placeholders + figcaptions present; capturing the PNGs is a follow-up step.
