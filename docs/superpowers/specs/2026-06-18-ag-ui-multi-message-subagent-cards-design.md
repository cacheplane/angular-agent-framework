# Multi-message subagent cards (AG-UI) — Design

**Status:** Approved (brainstorm 2026-06-18)

**Goal:** Extend the AG-UI subagent cards so each subagent accumulates and renders a **full transcript** — multiple assistant text turns, reasoning, and tool calls (with results) — streamed live, instead of a single accumulating text blob.

## Background

F5 shipped subagent cards over AG-UI via native ACTIVITY events: a graph emits a `subagent_activity` CUSTOM event → an owned `ActivityEmittingAgent._dispatch_event` maps it to `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` → the L1 reducer (`libs/ag-ui`) accumulates activities generically → `toAgent()` projects `activityType==='subagent'` to the neutral `Subagent` contract → `chat-subagents`/`chat-subagent-card` render.

Today the activity `content` carries a single accumulating `text` field; the projection synthesizes **one** `Message` from it (`to-agent.ts` `subagentFor`), and the card shows that latest text. This design carries the subagent's full message transcript instead.

The neutral types already support a transcript: `Message` has `role: 'tool'`, `toolCallId`, `toolCallIds`, and `reasoning`; `ToolCall` has `{id, name, args, status, result?, error?}`. The only neutral-contract addition is exposing the subagent's tool calls.

## Architecture (Approach 1 — fat activity content)

One ACTIVITY per subagent (unchanged identity model), whose `content` carries the transcript as arrays; streamed via JSON-Patch DELTAs. The L1 reducer is **untouched** (it already applies arbitrary ACTIVITY patches).

### A. Neutral contract (libs/chat)

Add `toolCalls` to `Subagent` (`libs/chat/src/lib/agent/subagent.ts`):

```ts
export interface Subagent {
  toolCallId: string;
  name?: string;
  status: Signal<SubagentStatus>;
  messages: Signal<Message[]>;
  toolCalls: Signal<ToolCall[]>;   // NEW — the subagent's tool calls (name/args/result)
  state: Signal<Record<string, unknown>>;
}
```

`Message` and `ToolCall` are unchanged.

### B. Wire shape (L3 ↔ L1 activity `content`)

```
{ toolCallId, name, status,
  messages:  [{ id, role, content, toolCallIds?, reasoning? }, …],
  toolCalls: [{ id, name, args, status, result?, error? }, …] }
```

DELTAs (RFC-6902 JSON-Patch), live:
- `ACTIVITY_SNAPSHOT` on subagent start → `{toolCallId, name, status:'running', messages:[], toolCalls:[]}`.
- New message: `{op:'add', path:'/messages/-', value:{id, role:'assistant', content:''}}`.
- Token stream into the in-progress message: `{op:'replace', path:'/messages/<n>/content', value:<accumulated text>}` (text_so_far pattern — replace, since JSON-Patch has no string append).
- Tool call: `{op:'add', path:'/toolCalls/-', value:{id, name, args, status:'running'}}` plus `{op:'replace', path:'/messages/<n>/toolCallIds', value:[…]}`.
- Tool result: `{op:'replace', path:'/toolCalls/<k>/status', value:'complete'}` + `{op:'replace', path:'/toolCalls/<k>/result', value:<result>}`.
- Finish: `{op:'replace', path:'/status', value:'complete'}`.

The reducer's existing `applyPatch` handles all of these — **no reducer change**.

### C. Projection (libs/ag-ui `to-agent.ts`)

`subagentFor` maps the new arrays, with explicit back-compat:

```ts
messages: computed<Message[]>(() => {
  const c = entry.content();
  if (Array.isArray(c['messages'])) {
    return (c['messages'] as RawMsg[]).map((m) => ({
      id: m.id, role: m.role, content: m.content ?? '',
      ...(m.toolCallIds ? { toolCallIds: m.toolCallIds } : {}),
      ...(m.reasoning ? { reasoning: m.reasoning } : {}),
    }));
  }
  // Back-compat: single accumulating text (current shipped emitter).
  return [{ id, role: 'assistant', content: String(c['text'] ?? '') }];
}),
toolCalls: computed<ToolCall[]>(() => {
  const c = entry.content();
  return Array.isArray(c['toolCalls']) ? (c['toolCalls'] as ToolCall[]) : [];
}),
```

The stable per-subagent wrapper (keyed by messageId) and the prune loop are unchanged.

### D. Card rendering (libs/chat `chat-subagent-card`, hybrid)

Replace the single "latest message" block with an ordered transcript:

```html
@for (m of subagent().messages(); track m.id) {
  <div class="sac__msg" [attr.data-role]="m.role">
    @if (m.reasoning) { <div class="sac__reasoning">{{ m.reasoning }}</div> }
    @if (textOf(m); as t) { <!-- markdown render of t --> }
    @for (tc of toolCallsFor(m); track tc.id) {
      <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
    }
  </div>
}
```

- `toolCallsFor(m)` resolves `m.toolCallIds` against `subagent().toolCalls()`.
- Reuse the existing **`ChatToolCallCardComponent`** (per-call card; result included) — the "hard part" of tool rendering — without the `Agent`-coupled `chat-tool-calls` wrapper.
- The in-progress (last) message's `content` updates in place; `track m.id` keeps the DOM stable (no `@for` re-creation).
- Compact, nested styling distinct from the main thread.

### E. L3 emission (examples/ag-ui graph)

Extend `SubagentStreamHandler` + `activity_transform.py`:
- on assistant token → `add` a message (first token) then `replace` its content (text_so_far);
- on tool call → `add` to `toolCalls` + `replace` the assistant message's `toolCallIds`;
- on tool result → `replace` that tool call's `result`/`status`.

Transport unchanged from F5 (`adispatch_custom_event` → `subagent_activity` CUSTOM → `ActivityEmittingAgent._dispatch_event` → ACTIVITY_DELTA). `activity_transform` gains small pure patch-builders for messages/toolcalls. The research subagraph is already LLM-driven (reasoning + a search tool + a summary), so it produces a genuine multi-message transcript for the demo.

The cockpit `ag-ui/subagents` capability stays on the single-text path (exercises the back-compat branch) — not migrated here.

## Data flow

```
research subgraph stream
  → SubagentStreamHandler (delineates messages/tool calls)
  → adispatch_custom_event('subagent_activity', {phase, ...})
  → ActivityEmittingAgent._dispatch_event → activity_transform → ACTIVITY_SNAPSHOT/DELTA
  → L1 reducer applyPatch (generic, unchanged) → activities store
  → toAgent subagentFor → Subagent{ messages[], toolCalls[] }
  → chat-subagents → chat-subagent-card → ordered transcript + reused tool-call cards
```

## Error handling

- Malformed/partial wire entries: the projection defensively defaults (`content ?? ''`, non-array → `[]`); a message missing an `id` falls back to its index for `track`.
- A tool result arriving before its call (out-of-order): `toolCallsFor` simply finds nothing yet; the card renders the call once it appears (id lookup, never positional).
- Back-compat: emitters that still send `text` render as a single assistant message; emitters sending `messages` render the full transcript. Both paths are unit-tested.

## Testing

- **Unit (libs/ag-ui):** projection maps `content.messages`→`Message[]` and `content.toolCalls`→`ToolCall[]`; the `text` back-compat fallback; stable wrapper identity + content liveness across DELTAs.
- **Unit (libs/chat):** `chat-subagent-card` renders an ordered transcript (≥2 messages), reasoning, and a reused tool-call card; updates live when the last message's content changes; `track m.id` stability.
- **Unit (python):** `activity_transform` message/toolcall patch-builders produce the expected JSON-Patch ops for each phase.
- **e2e (examples/ag-ui):** during a research run, a subagent card surfaces ≥2 messages and a tool-call card — durable-signal assertions (F5 e2e precedent; robust under aimock replay).
- **Gates:** `ag-ui` + `chat` lint/test; examples/ag-ui e2e; cockpit `ag-ui/subagents` e2e still green (back-compat); Railway deploy regen if any `cockpit/ag-ui/*` source changes; api-docs regen (the `Subagent.toolCalls` addition is public API).

## Scope guardrails (YAGNI)

- No neutral-`Message` change; the L1 reducer is untouched.
- `role:'tool'` result messages are not separately rendered (the tool-call card already shows the result).
- The cockpit `ag-ui/subagents` capability is not migrated (it validates the back-compat branch).
- No new chat-tool-calls decoupling refactor — reuse the per-call card directly.

## Public API delta

- `Subagent.toolCalls: Signal<ToolCall[]>` (additive).
- No other public surface changes.
