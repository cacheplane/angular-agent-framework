# Human-in-the-Loop Refund Cockpit + Aligned Blog Post

**Status:** Design approved · ready for implementation plan
**Owner:** Brian Love
**Date:** 2026-05-25

## Goal

Use the third blog post (Human-in-the-Loop LangGraph Agents in Angular) as a forcing function to tighten the HITL pattern in ThreadPlane. By the end of this work:

- The cockpit `interrupts` example is a refund-authorization agent with a structured interrupt payload and three semantically distinct approval actions.
- The chat + langgraph libraries support arbitrary structured values flowing through `agent.submit({ resume })`, not just booleans.
- The blog post teaches the exact pattern a reader can clone-and-run, with screenshots captured from the verified cockpit example.

## Why this matters

The current cockpit `interrupts` example documents a pattern, but its three buttons (Approve / Edit / Cancel) all do the same thing. The file explicitly admits this: *"Each branch intentionally does the same thing in this demo."* That's a meaningful gap — the published API can't actually distinguish action types, because `resume` is a boolean and there's no path for structured data to flow back to LangGraph's `Command(resume=…)`.

Writing the blog against an honest cockpit example forces us to fix the gap. Readers get code that runs verbatim. Brian gets a tight feedback loop on the HITL primitive he's promoting.

## Four pieces, in order

Piece 1 has three sub-pieces (1A, 1B, 1C) that ship together in one PR — they touch the same library tree and share the new button vocabulary.

### Piece 1A — Library: structured `resume` values

Smallest reusable surface; ships independently of the cockpit/blog work.

**Adapter (`libs/langgraph/...`).**
- The type is already permissive (`resume?: unknown` in `LangGraphSubmitOptions`), and the adapter already forwards the value verbatim into LangGraph's `Command(resume=value)`. No type changes needed.
- The "work" here is adding an explicit unit test that demonstrates a structured object flowing through end-to-end. Locks in the behavior the cockpit refund rewrite depends on.

**Chat composition (`libs/chat/.../compositions/chat-interrupt-panel`).**
- `(action)` continues to emit the existing enum string — no behavioral change. Structured payloads aren't needed in v1 (Edit handles its own form via body slot in `ChatApprovalCard`).

**Tests.**
- `libs/langgraph` unit test: `submit({ resume: { approved: true, amount: 47.5 } })` forwards the object intact to the run endpoint.
- No new chat lib tests for this sub-piece; the existing `chat-interrupt-panel.spec.ts` covers the unchanged behavior.

### Piece 1B — Library: `ChatApprovalCard` composition

New panel-style composition purpose-built for structured approval flows. Coexists with `ChatInterruptPanel`; neither deprecates the other.

**File layout.**
- `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts`
- `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.spec.ts`
- Exported from `libs/chat/src/index.ts`.

**Public API.**

```html
<chat-approval-card
  [agent]="agent"
  [matchKind]="'refund_approval'"
  [title]="'Refund approval required'"
  [showEdit]="true"
  (action)="onAction($event)"
>
  <ng-template #body let-payload>
    Refund <strong>{{ payload.amount | currency }}</strong>
    to <code>{{ payload.customer_id }}</code>?
    <p>{{ payload.reason }}</p>
  </ng-template>
</chat-approval-card>
```

- `[agent]` — required. Reads `agent.interrupt()`.
- `[matchKind]` — optional. When set, only renders if `interrupt.value.kind === matchKind`. Lets callers register multiple cards on one agent.
- `[title]` — optional. Defaults to `"Approval required"`.
- `[showEdit]` — optional boolean. Defaults to `false`. Controls whether the Edit button appears.
- `(action)` — emits `{ action: 'approve' | 'edit' | 'cancel' }`. No payload. Edit semantics are the caller's (body template reveals a custom editor; saving emits a direct `agent.submit(...)` from the caller).
- `<ng-template #body let-payload>` — content child template ref. Composition reads it via `contentChild('body', { read: TemplateRef })`.

**Visual treatment — native `<dialog>` modal.**
- Uses native HTML `<dialog>` element with `dialog.showModal()` on the interrupt becoming present. Closes via `dialog.close()` after action emit. Top-layer rendering, focus trap, Escape support all free from the platform.
- Width 440px. Centered. Box-shadow `0 20px 50px rgba(0,0,0,0.18)`.
- Surface: `--ngaf-chat-surface` (`#ffffff` light / `rgb(28,28,28)` dark) — the existing chat token prefix; system-wide rename to `--threadplane-chat-*` is a separate refactor out of this scope.
- Header: 14px padding, amber warning SVG icon (`--ngaf-chat-warning-text`) + bold title 14px. Bottom 1px separator (`--ngaf-chat-separator`).
- Body: 14–16px padding. Projected `<ng-template #body>` content.
- Actions row: 8–14px padding, right-aligned, 6px gap.
  - **Cancel** (text-only, left of the row) → emits `{ action: 'cancel' }`.
  - **Edit** (secondary outlined, middle, only when `[showEdit]=true`) → emits `{ action: 'edit' }`.
  - **Approve** (primary dark filled, right) → emits `{ action: 'approve' }`.
- Escape key → treated as Cancel (emit + close).
- Backdrop click → does **not** close. Deliberate: the user must use a button to make the decision.
- Action button styling matches the refreshed `ChatInterruptPanel` (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-text`) so both compositions share visual vocabulary. Button styles live inline in each component's `styles:` block (no shared util file yet).

**Tests.**
- Renders body template with payload bound.
- Emits the right action enum on click.
- Respects `matchKind` (renders nothing when interrupt kind ≠ matchKind).
- Hides Edit button when `showEdit=false`.
- Calls `dialog.showModal()` when interrupt becomes present, `dialog.close()` after action.
- Escape key emits `{ action: 'cancel' }`.

### Piece 1C — Library: `ChatInterruptPanel` visual refresh

Keep current layout and API. Refresh the visual vocabulary to match the new approval-card idiom.

**Changes.**
- Drop the `border-left: 3px solid var(--*-chat-warning-text)` thick amber border.
- Replace the large triangle warning SVG in the header with a small amber dot (6px circle) inside an uppercase mono eyebrow row: `<span class="dot"></span> Agent paused — review needed`.
- Body text uses `--threadplane-chat-text` (not muted) — the body content is the message, not a caption.
- Action buttons use the same `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-text` styles as `ChatApprovalCard`. Same button vocabulary across both compositions.
- Keep using `--ngaf-chat-*` tokens for now; system-wide rename is out of scope.

**No behavioral change.** Same inputs, same `(action)` output enum, same DOM placement (caller still renders it where it sits today).

### Piece 2 — Cockpit `interrupts` example → refund agent

Modifies the existing `cockpit/langgraph/interrupts/` example in place. No new directory.

**Python graph (`python/src/graph.py`).**

Restructure as a three-node graph:
1. `draft_refund` — reads the conversation, asks the LLM to extract `customer_id`, `amount`, `reason`. Writes them to state.
2. `request_approval` — calls `interrupt({ kind: 'refund_approval', amount, customer_id, reason })`. The resume value is `{ approved: bool, amount?: number }`. Writes the resume result to state.
3. `issue_refund` — runs only when `state['decision']['approved']` is true. Uses the (possibly edited) amount. Logs a fake `refund_id`.

The graph edges go `draft → request_approval → issue` with an early-exit from `request_approval` to `END` when `approved=false`.

**System prompt (`python/prompts/interrupts.md`).**

Rewrite as a refund-authorization assistant prompt. Short, plain, signal-native voice consistent with other cockpit prompts.

**Angular component (`angular/src/app/interrupts.component.ts`).**
- Update welcome suggestions to refund-flavored prompts (e.g., "Refund $47.50 to customer cus_123 for a duplicate charge").
- Wire `(action)` from `chat-interrupt-panel` to a handler that maps each action to a structured resume payload:
  - `approve` → `agent.submit({ resume: { approved: true } })`
  - `edit` (with `payload.amount` from the inline edit) → `agent.submit({ resume: { approved: true, amount: payload.amount } })`
  - `cancel` → `agent.submit({ resume: { approved: false } })`

**Approval card (`angular/src/app/views/approval-card.component.ts`).**
- Reads structured payload fields from the interrupt: `amount`, `customer_id`, `reason`.
- Renders them in a refund-receipt-style card.
- Edit button toggles an inline `<input type="number">` for the amount. Submit-from-edit emits `{ action: 'edit', payload: { amount: newAmount } }`.
- Cancel and Approve emit `{ action: 'cancel' }` and `{ action: 'approve' }` (no payload).
- Migrates the still-existing `--ngaf-chat-*` CSS custom property references to `--threadplane-chat-*` (the post-rename names). Not the central goal of this work, but it's a worktree-local nit caught on the way.

**E2E (`angular/e2e/interrupts.spec.ts`).**

Extend with three new assertions:
1. Approval card displays `amount`, `customer_id`, `reason` from the structured payload.
2. Approve path: card → Approve → `issue_refund` ran → final message mentions refund issued.
3. Cancel path: card → Cancel → `issue_refund` did NOT run → final message confirms cancellation.

Edit path is exercised manually (Piece 3); not in automated e2e because of the inline form.

### Piece 3 — Manual review checkpoint

Before writing any blog prose, validate the cockpit example in a real browser. Loops back to Piece 1 or 2 if anything looks off.

**Setup.**
- I bring up `cockpit-langgraph-interrupts-angular` on a local port (`nx serve cockpit-langgraph-interrupts-angular`).
- I bring up the LangGraph backend on its dev port.
- I create a Chrome MCP tab (or reuse Brian's existing tab) pointed at the cockpit URL.

**Walkthrough.**
- Brian types a refund prompt in the cockpit chat.
- We watch the agent draft the refund, then the approval card render with structured fields.
- Brian clicks **Edit**, adjusts the amount, submits — we observe the graph branch on the edited amount.
- Reset thread; Brian clicks **Approve** on a fresh refund — observe the approve branch.
- Reset thread; Brian clicks **Cancel** — observe the rejection branch and the "no refund issued" message.

**Screenshots.**
- Three frames captured from the same Chrome session (kept ≤ 1024px wide to dodge the >2000px corruption issue we hit earlier):
  1. Agent mid-draft, no card yet.
  2. Approval card visible with full structured payload.
  3. Post-approval confirmation in the chat.
- Saved to `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/{1,2,3}.png`.

**Sign-off.**
- Brian explicitly approves the UI and screenshots before Piece 4 starts.
- If anything looks off, loop back to Piece 1/2 with a concrete fix.

### Piece 4 — Blog post rewrite

Replaces the draft committed in PR #550. Same title, same SEO target, same voice doc compliance.

**Content changes from the v1 draft:**
- Code blocks copied verbatim from the verified cockpit `graph.py`, `interrupts.component.ts`, `approval-card.component.ts`. No invented APIs.
- The 10-step "under the hood" trace updated to match the actual runtime sequence (including the new structured-resume value path).
- Three screenshots embedded as `<figure>` elements (which inherit the screenshot-frame design shipped earlier).
- Production patterns section keeps idempotency / audit trail / when-NOT-to-interrupt, but grounded in actual cockpit code instead of handwaving.
- Closing forward-links to the next post (durable threads).

**Reused from the v1 draft:**
- Title, SEO description, frontmatter.
- The Stripe-anecdote opener.
- "Why interrupts matter" philosophical section.
- `## Goals` block with `Have fun!` last bullet.
- The voice tells: "freakin' cool 💚," "(haha)," "For me," `## Conclusion`.

## Out of scope (explicit non-goals)

- A "fake Stripe" actual refund integration (the `issue_refund` node logs a fake `refund_id`; no external call).
- Multi-turn / chained approvals (one interrupt per run).
- Inline message editing beyond the amount field (no "edit the assistant's whole response").
- Persistent thread storage beyond LangGraph's checkpointer (durable threads is post #4).
- A pre-built "approval card" composition in the chat library (the cockpit's component stays scenario-specific).
- API renames or breaking changes to `agent.submit`. Backward compatible only.

## Definition of done

- Library tests green; no breaking changes to existing callers.
- Cockpit `interrupts` e2e green; three new assertions added.
- Manual walkthrough completed; Brian signs off on UI + screenshots.
- Three screenshots committed under `apps/website/public/blog/.../{1,2,3}.png`.
- Blog post `2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx` updated; renders at `/blog/...` locally; three `<figure>` elements visible.
- PR #550 (the v1 draft) updated with the rewritten content OR replaced with a fresh PR depending on diff readability.

## Files touched

**Library (Pieces 1A / 1B / 1C):**
- `libs/langgraph/src/.../*.ts` — adapter type loosening + tests *(1A)*
- `libs/chat/src/lib/primitives/chat-interrupt/*.ts` — `submitResume` helper + tests *(1A)*
- `libs/chat/src/lib/compositions/chat-interrupt-panel/*.ts` — typed action output + visual refresh + token migration + tests *(1A + 1C)*
- `libs/chat/src/lib/compositions/chat-approval-card/chat-approval-card.component.ts` — new dialog composition + tests *(1B)*
- `libs/chat/src/index.ts` — export `ChatApprovalCardComponent` *(1B)*

**Cockpit (Piece 2):**
- `cockpit/langgraph/interrupts/python/src/graph.py`
- `cockpit/langgraph/interrupts/python/prompts/interrupts.md`
- `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`
- `cockpit/langgraph/interrupts/angular/src/app/views/approval-card.component.ts`
- `cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`

**Blog (Piece 4):**
- `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx` (rewrite)
- `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/1.png`
- `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/2.png`
- `apps/website/public/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular/3.png`

## PR strategy

Three PRs, in order:

1. **`libs(chat,langgraph): structured resume + ChatApprovalCard dialog composition`** — Pieces 1A + 1B + 1C bundled. They touch the same library tree and share the new shared button vocabulary; splitting them creates churn without payoff. Mergeable independently of cockpit/blog.
2. **`feat(cockpit): refund-authorization interrupts example`** — Piece 2. Depends on PR #1. **Auto-merge strictly disabled.** Stays in draft state until the Piece 3 manual review completes and Brian explicitly approves.
3. **`docs(blog): rewrite HITL post against verified cockpit example`** — Piece 4. Depends on PR #2 merging. Replaces the PR #550 draft (we close #550 and open this fresh, since the content is a complete rewrite).

Each PR small, each independently reviewable. The strict-gate on PR #2 enforces the forcing-function loop — no merge until the dialog UX has been seen running in a real browser.
