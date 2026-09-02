# PR E: Runtime Subagent Docs + Blog Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every published subagent claim — two matrices, three runtime overview tables, five copies of the `SUBAGENT_*` boilerplate, the event-mapping reference, and two blog posts — rewritten to the runtime-verified truth.

**Architecture:** Pure content PR, hard-gated on PRs A–D being merged. **The verified findings override every drafted value below**: before writing anything, read the three wire-capture docs (`cockpit/runtimes/aws-strands/python/docs/wire-capture-subagents.md`, `cockpit/runtimes/microsoft-agent-framework/python/docs/wire-capture-subagents.md`, `cockpit/runtimes/mastra/angular/docs/wire-capture-subagents.md`) and take cell values + streaming findings from them. Drafts below assume: Strands **Yes** (streamed child text), MAF **Yes** (streamed child text), Mastra **Partial** (lifecycle + final text, no child streaming). If any runtime verified differently, substitute its true value and cause everywhere, symmetrically. Blog register: no contractions (#883), one sentence per line, no incident narrative, no competitor names, frontmatter untouched.

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-subagents-design.md` §4–5.

**Branching:** `git fetch origin main && git checkout -b blove/runtime-subagent-docs origin/main` after A–D merge (verify all four in `git log origin/main --oneline -30`).

---

### Task 1: Canonical matrix — `apps/website/content/docs/choosing-an-adapter/index.mdx`

- [ ] **Step 1 (read first):** lines 85–140 — the 7-column matrix (`:92-97`), the "No cell…" paragraph (`:107`), and the "Subagents are red…" section (`:130-137`).
- [ ] **Step 2:** Update the matrix rows' Subagents + Cause cells (draft; substitute verified values):

```text
| LangGraph (baseline)      | ... | Yes | — |
| AWS Strands               | ... | Yes | State: upstream. Subagents: a small emitter in the backend translates native delegation signals to the protocol's `SUBAGENT_*` events. |
| Microsoft Agent Framework | ... | Yes | Subagents: same emitter pattern. |
| Mastra                    | ... | Partial | Subagents: lifecycle and final text via the emitter; the runtime does not forward child token streams. |
```
(Keep the existing non-subagent cells exactly as they are; match the table's real column layout when editing.)

- [ ] **Step 3:** Replace the `:107` paragraph sentence "No cell in the current matrix is caused by the protocol, and no cell is caused by a bug in our adapter." with:

```text
No cell in the current matrix is caused by the protocol. The protocol carries first-class subagent events (`SUBAGENT_STARTED`, `SUBAGENT_FINISHED`, `SUBAGENT_ERROR`, and a `subagentRunId` attribution field on content events), and `@threadplane/ag-ui` consumes them; a backend reaches them with a small emitter at its bridge boundary.
```

- [ ] **Step 4:** Rewrite the "Subagents are red for every third-party runtime" section (`:130-137`) as (draft; align with verified findings):

```text
## Subagents work through one emitter per backend

The protocol standardized subagent events, and the adapter consumes them: `SUBAGENT_STARTED` opens a card, content events carrying a `subagentRunId` stream into it and never into the transcript, and `SUBAGENT_FINISHED` settles it.
What differs per runtime is how the emitter learns about the delegation.
Strands surfaces the specialist's tool use and its streamed tokens, so the card streams live.
Microsoft Agent Framework attributes every event to an executor, so the card streams live there too.
Mastra reports delegation through lifecycle hooks and hands back the child's final text as a tool result, so its card fills in at completion rather than streaming — that is the one Partial cell, and it is a property of the runtime's delegation model rather than of the protocol or the adapter.
Each demo backend ships its emitter in tree; the pattern is roughly fifty lines per runtime.
```

- [ ] **Step 5:** `npx nx test website` → green. Commit: `docs(website): choosing-an-adapter matrix — verified subagent support per runtime`

### Task 2: Runtimes section — intro + three overviews + three how-it-connects

- [ ] **`runtimes/getting-started/introduction.mdx`**: update the `:32-37` matrix Subagents column to the verified values; replace the `:84` block ("Subagents are unavailable on every third-party runtime…") with:

```text
**Subagents now work on every runtime measured here** — fully on AWS Strands and Microsoft Agent Framework, and as lifecycle-plus-final-text on Mastra.
Each backend ships a small emitter that translates its native delegation signals into the protocol's `SUBAGENT_*` events, which `@threadplane/ag-ui` consumes directly.
The per-runtime pages show the emitter and the wire capture behind each cell.
```

- [ ] **Each `runtimes/<runtime>/overview.mdx`** (`aws-strands`, `microsoft-agent-framework`, `mastra`): flip the Surface-table Subagents row (`:24`) to the verified `Status | How` (e.g. Strands: `| Subagents | Supported | A ~50-line emitter translates the specialist's tool-use and streamed tokens into `SUBAGENT_*` events. |`; Mastra: `| Subagents | Partial | Delegation hooks emit lifecycle events; the child's final text arrives as one message — no token streaming. |`). Rewrite each "Subagents are not available" section into a short "How subagents surface" section describing that runtime's native signals + emitter, citing the demo files and the wire-capture doc. Keep descriptions (frontmatter) unchanged unless they assert the old claim — Strands' description doesn't mention subagents (`:3`), leave all three.
- [ ] **Each `runtimes/<runtime>/how-it-connects.mdx`**: replace the two-sentence `SUBAGENT_*` boilerplate (Strands `:70-74`, Mastra `:57-61`, MAF `:57-61`) with one accurate sentence pair per runtime naming what the emitter consumes and emits (all five copies of the old boilerplate across the section must be gone — grep after: `grep -rn "No runtime measured here emits them" apps/website/content/docs/` → empty).
- [ ] `npx nx test website` → green. Commit: `docs(website): runtimes section — subagent support per verified wire captures`

### Task 3: Event-mapping reference — `apps/website/content/docs/ag-ui/reference/event-mapping.mdx`

- [ ] After the ACTIVITY section (`:176-182`), add a `SUBAGENT_*` subsection documenting: the three lifecycle events and their fields, the `subagentRunId` routing rule (attributed text/tool events feed the child's card and never the transcript), keying (`parentToolCallId ?? subagentRunId`), suspended semantics (card stays running; interrupts flow through the interrupt signal), and that the legacy `activityType: 'subagent'` ACTIVITY path remains supported. Cross-link the runtimes intro.
- [ ] Also update the unqualified claims list from the audit if wording changed around them: `docs/ag-ui/getting-started/introduction.mdx:46` capability bullet becomes "Subagent progress (from `SUBAGENT_*` events, or `ACTIVITY_*` with `activityType: 'subagent'`)"; check `docs/ag-ui/concepts/architecture.mdx:93,202` and `docs/ag-ui/guides/troubleshooting.mdx:140` for the same phrasing and align.
- [ ] `npx nx test website` → green. Commit: `docs(website): document SUBAGENT_* consumption in the AG-UI event mapping`

### Task 4: Blog — `2026-08-31-we-measured-the-runtime-swap.mdx`

- [ ] **Matrix (`:43-48`):** update the Subagents column to the verified values (draft: Yes / Yes / Partial).
- [ ] **Section rewrite (`:137-155`):** replace from "**Subagents are red for all three.**" through "…not portable across it." with (draft — substitute verified specifics; de-contract; one sentence per line):

```text
**Subagents were the last column to converge, and the fix was one seam per runtime.**

The protocol standardized the events — `SUBAGENT_STARTED`, `SUBAGENT_FINISHED`, `SUBAGENT_ERROR`, plus a `subagentRunId` attribution field on ordinary content events — and the adapter consumes them directly.
What no runtime does is emit them natively.
Each one reports delegation in its own dialect: Strands surfaces the specialist's tool use and forwards its token stream, Microsoft Agent Framework attributes every event to an executor, and Mastra reports lifecycle through delegation hooks and returns the child's final text as a tool result.
So each demo backend carries a small emitter — roughly fifty lines — that translates its runtime's dialect into the standard events at the bridge boundary.

Two of the three cards stream live.
Mastra's fills in at completion, because the runtime does not forward child tokens to the caller; that is the one Partial cell, and it belongs to the runtime's delegation model rather than to the protocol or the adapter.
If you are building on server-declared subagents today, the contract to target is the protocol's own events; the emitter is the per-runtime cost, and it is small.
```

- [ ] **Conclusions:** update `:183` ("Subagents are not portable today…") to reflect the verified state (portable through a per-runtime emitter; one Partial), and confirm `:185` still correctly defers to choosing-an-adapter.
- [ ] Full read-through for dangling references; `npx nx test website`; commit `docs(blog): runtime-swap post — verified subagent support via per-runtime emitters`

### Task 5: Blog — `2026-08-31-what-changes-when-the-runtime-changes.mdx`

- [ ] Table row `:199`: `| Subagent delegation | Yes, inferred client-side (with server-announced bindings) | Yes, server-declared via the protocol's `SUBAGENT_*` events | Protocol |` (match the table's actual verdict-column style — read neighboring rows).
- [ ] `:302` caveat: replace the `activityType` convention sentence with one stating the adapter consumes the protocol's `SUBAGENT_*` events and each measured runtime reaches them through a small backend emitter (cross-link the runtime-swap post's section).
- [ ] Editor's note `:306-309`: update it to point at the same section without narrating the change history.
- [ ] `npx nx test website`; commit `docs(blog): runtime-changes post — subagent row reflects the protocol events`

### Task 6: Truthfulness audit + final verification

- [ ] Claims audit (fix the CONTENT on mismatch, never the code): (1) every matrix cell matches its wire-capture doc; (2) `grep -rn "No runtime measured here emits them\|Subagents are unavailable\|red for all three\|red for every third-party" apps/website/content/` → empty; (3) "roughly fifty lines" claims checked against the actual emitter files (`wc -l`) — adjust the number or drop it; (4) the SUBAGENT_* field lists match `@ag-ui/core` 0.0.59 schemas; (5) suspended-semantics wording matches the adapter (`reducer.ts` SUBAGENT_FINISHED handler); (6) no "aimock" or competitor/org names in blog posts; (7) internal links resolve to existing content files.
- [ ] `npx nx test website` full green; render check in the browser for the four heaviest pages (choosing-an-adapter, runtimes intro, both posts).
- [ ] Open PR `docs(website,blog): publish the verified runtime subagent matrix`; body links the three wire-capture docs and the four code PRs; address AI review; arm auto-merge. After deploy, verify one deployed page reflects the new matrix (curl the choosing-an-adapter page for "emitter").
