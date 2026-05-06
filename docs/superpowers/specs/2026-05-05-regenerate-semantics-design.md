# `@ngaf/chat@0.0.26` — Regenerate semantics fix

**Status:** Approved
**Date:** 2026-05-05

## 1. Problem

Live Chrome smoke caught: clicking "Regenerate response" duplicates the conversation (1 user / 1 assistant → 2 user / 2 assistant) instead of replacing the prior assistant message. The button label says "Regenerate response" but the behavior is "Resend prompt."

## 2. Goal

Implement **replace semantics**: regenerate discards the target assistant message (and any subsequent messages), then re-runs the agent on the trailing user prompt. No new user message added.

Matches the conventions of ChatGPT, Claude.ai, and similar products.

## 3. New `Agent` API

```ts
// libs/chat/src/lib/agent/agent.ts (or wherever Agent is defined)
export interface Agent {
  // ...existing methods...

  /**
   * Discards the assistant message at the given index AND all messages after
   * it, then re-runs the agent against the trimmed conversation tail. The
   * preceding user message (at index - 1) is preserved and re-submitted as
   * the agent's input. No new user message is added to the history.
   *
   * Throws if the message at `index` is not a 'assistant' role, or if the
   * agent is currently loading another response.
   */
  regenerate(assistantMessageIndex: number): Promise<void>;
}
```

## 4. Adapter implementations

### 4.1 `@ngaf/langgraph`

LangGraph supports rolling back thread state to a previous checkpoint via `update_state`. The adapter:

1. Find the LangGraph checkpoint just BEFORE the target assistant message (the checkpoint after the user prompt at `index - 1`).
2. `agent.update_state(checkpoint_id)` to roll back thread state.
3. Call `agent.submit({ message: undefined })` (no new input) — the agent re-runs from the rolled-back state.

If checkpoint resolution fails (some thread states don't have per-message checkpoints), fall back to: clear messages [N..end] from local message buffer, then `agent.submit({ messages: messages[0..N-1] })` with the trimmed history.

### 4.2 `@ngaf/ag-ui`

Less mature checkpoint support; uses local-state truncation:

1. Update local thread state via STATE_DELTA: `messages` array sliced to `[0..N-1]`.
2. Dispatch a new run with `messages[0..N-1]` as the input.

## 5. Wiring in the chat composition

In `libs/chat/src/lib/compositions/chat/chat.component.ts`:

```html
<!-- BEFORE: -->
<chat-message-actions
  ...
  (regenerate)="onRegenerate(message)"
/>

<!-- AFTER: -->
<chat-message-actions
  ...
  (regenerate)="onRegenerate(i)"
/>
```

```ts
// Component method
onRegenerate(messageIndex: number): void {
  void this.agent().regenerate(messageIndex);
}
```

The `i` is already in scope from the existing `*ngFor` (or @for) over messages.

## 6. UX guards

- Regenerate button is **disabled when `agent.isLoading()`** (block during streaming).
- Regenerate is only rendered for assistant messages (already true; user messages don't have `<chat-message-actions>`).
- If the target message is the most recent assistant response, this is the typical case. If user regenerates an OLDER message, all messages after it (including subsequent user follow-ups) are discarded.

## 7. Edge cases

| Case | Behavior |
| --- | --- |
| Target message is mid-stream | Disable button (loading state); user must wait or click stop first |
| Target's parent user message has tool calls / branches | The user message is preserved as-is; only assistant content is regenerated |
| Network failure during regenerate | Restore the prior assistant message from local buffer (treat regenerate as transactional — only commit on successful new response start) |
| User regenerates message 2 of 5 | Discards messages [2..4], re-runs from message 1 (the user prompt before message 2) |
| Subagent responses inside the target message | Discarded along with the target message |

## 8. Testing

### 8.1 Unit (per-adapter)

- LangGraph: `regenerate(N)` calls `update_state` to the right checkpoint then submits.
- ag-ui: `regenerate(N)` truncates messages array via STATE_DELTA and re-dispatches.

### 8.2 Integration

- Mock agent with 5 messages (3 assistant, 2 user). Regenerate index 2 → result: messages [0..1] preserved, [2..4] cleared, new run submits.
- Mock agent loading flag: regenerate during loading → throws / no-op.

### 8.3 Live Chrome smoke

- Send a message, wait for response. Click regenerate. Assert: total message count stays 2 (1 user + 1 assistant), user prompt preserved verbatim, assistant content differs from prior response.

## 9. Versioning

`@ngaf/* 0.0.25` → `0.0.26`:
- Adds `regenerate(index)` method to `Agent` interface (additive)
- Bumps `@cacheplane/partial-markdown` peer to `^0.3.0` (consumes nested-list parser)

## 10. Out of scope

- Branching / multi-version timeline (separate feature)
- Editing user prompts before regeneration (separate feature)
- Partial regeneration (regenerating only the latter half of a long response)
