# Cockpit chat caps — welcome-suggestion chips backed by aimock test prompts — design

> **Place in the larger plan.** Audit deliverable for task #1 of the post-migration follow-up queue. Surfaced after the suggested-prompts audit revealed that 3 of 11 cockpit chat caps have aimock-tested prompts but no welcome chips, so first-time users have to type prompts that the demos are recorded to respond to. This PR closes the loop: every chip shown to users is a chip we've recorded a fixture for.

## Goal

Add welcome-suggestion chips to `c-tool-calls`, `c-subagents`, and `c-interrupts`. Each chip's `value` string exactly matches the prompt used in that cap's aimock e2e spec, so clicking a chip drives a flow guaranteed to work against the recorded fixtures.

## Non-goals

- Chips for caps without aimock specs (c-messages, c-input, c-debug, c-theming, c-threads, c-timeline, c-a2ui). Phase 2 of the audit — needs test backing first.
- c-generative-ui chip changes (already has 2 chips; no aimock spec yet to drive future drift).
- Extracting prompts into a shared constants module — 3 caps × small change, not worth the indirection.
- Adding a CI-time assertion that chip text matches test prompt — manual PR review is the gate for now.

## Audit context (the why)

| Cap | Chips on main | Aimock test prompt(s) | Status |
|---|---|---|---|
| c-messages, c-input, c-debug, c-theming, c-threads, c-timeline, c-a2ui | none | (no aimock spec) | gap — defer until test backing exists |
| **c-tool-calls** | none | `"What's the status of UA123?"` | **drift — fix here** |
| **c-subagents** | none | `"Plan a trip from LAX to JFK"` | **drift — fix here** |
| **c-interrupts** | none | `"Book me on UA123."` + `"Book me on AA404."` | **drift — fix here (2 chips)** |
| c-generative-ui | 2 chips | (no aimock spec) | inverse: chips without test backing; left alone |

## Architecture

Mirror the c-generative-ui pattern. Each component:

1. Imports `ChatWelcomeSuggestionComponent` from `@ngaf/chat` and adds it to `imports`.
2. Defines a local `SUGGESTIONS` constant — small (`as const`) array of `{ label, value }`.
3. Wraps the existing self-closing `<chat main [agent]="agent" />` to include a body containing `<div chatWelcomeSuggestions>` with one `<chat-welcome-suggestion>` per entry.
4. Adds a `send(text: string)` method that calls `this.agent.submit({ message: text })` and wires it to the chip's `(selected)` output.

The chip `value` strings match each cap's aimock spec `PROMPT` constant exactly (verified during the audit).

## What changes

Three files modified, no new files:

### `cockpit/chat/tool-calls/angular/src/app/tool-calls.component.ts`

Add chip(s):
```typescript
const SUGGESTIONS = [
  { label: 'Look up flight UA123', value: "What's the status of UA123?" },
] as const;
```

### `cockpit/chat/subagents/angular/src/app/subagents.component.ts`

Add chip(s):
```typescript
const SUGGESTIONS = [
  { label: 'Plan a trip', value: 'Plan a trip from LAX to JFK' },
] as const;
```

### `cockpit/chat/interrupts/angular/src/app/interrupts.component.ts`

Add chip(s) — 2, one per flow. Labels hint at the expected user response inside the booking modal:
```typescript
const SUGGESTIONS = [
  { label: 'Book UA123 (confirm)', value: 'Book me on UA123.' },
  { label: 'Book AA404 (cancel)', value: 'Book me on AA404.' },
] as const;
```

Each file also gets:
- `ChatWelcomeSuggestionComponent` import + `imports` array entry.
- Template wrap: replace self-closing `<chat main [agent]="agent" class="flex-1 min-w-0" />` with a paired tag containing the chip slot.
- `protected readonly suggestions = SUGGESTIONS;` field.
- `protected send(text: string): void { void this.agent.submit({ message: text }); }` method.

## Verification

### Local

- `nx build cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular`, `cockpit-chat-interrupts-angular` — each builds clean.
- `nx e2e cockpit-chat-tool-calls-angular`, `cockpit-chat-subagents-angular`, `cockpit-chat-interrupts-angular` — all still pass. The e2e tests submit via `sendPromptAndWait` (which fills the textarea + clicks Send), so chip presence is a pure additive surface and shouldn't affect them.
- `nx e2e cockpit-langgraph-streaming-angular` — passes (regression sanity).
- Visual inspection: `nx serve <project>` for each; landing page shows the chip(s); clicking a chip fills the input + submits.

### CI risk note

Per user direction, other domain changes may be landing in parallel that turn CI red for reasons unrelated to this PR. The trust signal here is local verification + a careful inspection of any CI red post-push to distinguish "real failure" from "transition noise."

## Risk surface

- **Future chip-vs-test drift.** Someone changes the chip's `value` but not the test's `PROMPT` (or vice versa) — chip click takes the user to an unrecorded path. Mitigation: PR description calls out the equality requirement; reviewers catch future drift in code review. A long-term mitigation could be a CI assertion comparing chip `value` to test `PROMPT`, but that's out of scope.
- **Chip labels don't match e2e behavior.** Specifically c-interrupts: the chip labels suggest the user "should" Accept or Ignore. If a curious user clicks "Book UA123 (confirm)" then clicks Ignore in the modal, the demo still works (book_flight returns "Booking cancelled.") — just doesn't match the chip's hint. Acceptable; the label is a suggestion, not a contract.

## Acceptance criteria

- Three component files modified (no other files touched).
- Each chip's `value` matches the corresponding aimock spec `PROMPT` constant byte-for-byte.
- `nx build` succeeds for all three cockpit-chat-* projects.
- All 4 existing cockpit aimock e2es (streaming + tool-calls + subagents + c-interrupts) still pass.
- Manual: serving each cap shows the chip(s); clicking dispatches the prompt successfully.
- No regression in other cockpit aimock or unit tests.
