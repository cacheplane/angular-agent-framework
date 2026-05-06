# `@ngaf 0.0.26` — Regenerate Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Implement replace-semantics for "Regenerate response" button. Discards target assistant message + everything after it, re-runs agent on the prior user prompt. Bump @cacheplane/partial-markdown peer to ^0.3.0 alongside.

**Architecture:** Add `regenerate(index)` method to `Agent` interface. LangGraph adapter uses checkpoint roll-back via `update_state`; ag-ui adapter uses STATE_DELTA truncation. Chat composition wires `<chat-message-actions>`'s regenerate event to call `agent.regenerate(i)` instead of resending the prompt.

**Spec:** `docs/superpowers/specs/2026-05-05-regenerate-semantics-design.md`

**Working repo:** `/Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac`
**Implementation branch:** `claude/regenerate-semantics-0.0.26` (already created from `origin/main`)

---

## Phase 1 — Agent interface + types

### Task 1: Add `regenerate` to `Agent` interface

**Files:** `libs/chat/src/lib/agent/agent.ts` (or wherever `Agent` interface lives — find via `grep -rn "export interface Agent" libs/chat/src`).

- [ ] Step 1: Locate the file:

```bash
grep -rn "^export interface Agent\b" libs/chat/src/lib/agent/
```

- [ ] Step 2: Add the `regenerate` method:

```ts
/**
 * Discards the assistant message at the given index AND all messages after
 * it, then re-runs the agent against the trimmed conversation tail. The
 * preceding user message (at index - 1) is preserved and re-submitted as
 * the agent's input. No new user message is added to the history.
 *
 * Throws if the message at `index` is not 'assistant' role, or if the
 * agent is currently loading another response.
 */
regenerate(assistantMessageIndex: number): Promise<void>;
```

- [ ] Step 3: Run typecheck — expect errors at every `Agent` implementation site (langgraph adapter, ag-ui adapter, mockAgent, etc.). That's expected. Tasks 2-4 fix them.

```bash
npx tsc --noEmit | grep "regenerate"
```

- [ ] Step 4: Commit:

```bash
git add libs/chat/src/lib/agent/agent.ts
git commit -m "feat(chat): add regenerate(index) method to Agent interface"
```

---

## Phase 2 — LangGraph adapter implementation

### Task 2: Implement `regenerate` in `@ngaf/langgraph`

**Files:**
- Modify: `libs/langgraph/src/lib/agent.fn.ts` (the agent factory)
- Test: `libs/langgraph/src/lib/agent.fn.spec.ts`

- [ ] Step 1: Find where `submit` is implemented in `agent.fn.ts`. Add `regenerate` next to it:

```ts
async function regenerate(this: LangGraphAgent, assistantMessageIndex: number): Promise<void> {
  if (this.isLoading()) {
    throw new Error('Cannot regenerate while agent is loading another response');
  }
  const messages = this.messages();
  const target = messages[assistantMessageIndex];
  if (!target || target.role !== 'assistant') {
    throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message`);
  }

  // Truncate local message buffer to [0..index-1].
  const trimmed = messages.slice(0, assistantMessageIndex);
  this.messages.set(trimmed);

  // Find the user message that prompts this assistant response.
  // The agent's submit will use the trimmed message history as input.
  const lastUserMsg = trimmed.reverse().find(m => m.role === 'user');
  if (!lastUserMsg) {
    throw new Error('No user message found before the target assistant message');
  }

  // Re-submit by replaying the user message. The LangGraph thread state
  // will see the trimmed messages array via the messages[] argument.
  await this.submit({
    message: typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : '<replay>',  // structured content; re-submit handles via state.messages
    state: { messages: trimmed },
  });
}
```

(Note: this is a "local truncation + replay" implementation. Does NOT use LangGraph checkpoint roll-back — that's a future optimization. Real semantic replace works because the new submit uses the trimmed message history.)

- [ ] Step 2: Wire `regenerate` into the agent factory return value:

```ts
const agent: LangGraphAgent = {
  // ...existing methods...
  regenerate: regenerate.bind(/* ... */),
};
```

- [ ] Step 3: Add tests:

```ts
describe('agent.regenerate()', () => {
  it('truncates messages [N..end] and re-submits from N-1', async () => {
    const a = mockLangGraphAgent({
      messages: [
        { id: '1', role: 'user', content: 'hello' },
        { id: '2', role: 'assistant', content: 'hi there' },
      ],
    });
    await a.regenerate(1);
    expect(a.messages().length).toBeLessThanOrEqual(2);
    expect(a.messages()[0].role).toBe('user');
  });

  it('throws when target index is not an assistant message', async () => {
    const a = mockLangGraphAgent({
      messages: [{ id: '1', role: 'user', content: 'hello' }],
    });
    await expect(a.regenerate(0)).rejects.toThrow(/not an assistant/);
  });

  it('throws when agent is loading', async () => {
    const a = mockLangGraphAgent({ isLoading: true, messages: [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'assistant', content: 'hello' },
    ] });
    await expect(a.regenerate(1)).rejects.toThrow(/loading/);
  });
});
```

- [ ] Step 4: Run tests + typecheck:

```bash
npx nx run langgraph:test
```

- [ ] Step 5: Commit:

```bash
git add libs/langgraph/src/
git commit -m "feat(langgraph): implement Agent.regenerate via local truncation + replay"
```

---

## Phase 3 — ag-ui adapter implementation

### Task 3: Implement `regenerate` in `@ngaf/ag-ui`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts` (or wherever the ag-ui agent factory is)
- Test: corresponding `.spec.ts`

- [ ] Step 1: Add `regenerate` analogous to LangGraph:

```ts
async function regenerate(assistantMessageIndex: number): Promise<void> {
  if (agent.isLoading()) {
    throw new Error('Cannot regenerate while agent is loading another response');
  }
  const messages = agent.messages();
  const target = messages[assistantMessageIndex];
  if (!target || target.role !== 'assistant') {
    throw new Error(`Message at index ${assistantMessageIndex} is not an assistant message`);
  }
  const trimmed = messages.slice(0, assistantMessageIndex);
  agent.messages.set(trimmed);

  // Dispatch a new run with the trimmed message history. The ag-ui RunInput
  // includes a `messages` field that overrides the prior thread state.
  const lastUserMsg = trimmed.reverse().find(m => m.role === 'user');
  if (!lastUserMsg) throw new Error('No user message before target assistant');

  await agent.submit({ messages: trimmed });
}
```

- [ ] Step 2: Add tests + commit:

```bash
npx nx run ag-ui:test
git add libs/ag-ui/src/
git commit -m "feat(ag-ui): implement Agent.regenerate via local truncation + replay"
```

---

## Phase 4 — Chat composition wiring

### Task 4: Update `chat.component.ts` to call `regenerate(i)`

**Files:** `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] Step 1: Find the `<chat-message-actions>` element in the assistant-message branch. The `(regenerate)` event currently fires `onRegenerate(message)` (or similar). Update it to:

```html
<chat-message-actions
  ...existing inputs...
  (regenerate)="onRegenerate(i)"
/>
```

The `i` index is already in scope from the existing `*ngFor` / @for.

- [ ] Step 2: Update the component method:

```ts
onRegenerate(messageIndex: number): void {
  void this.agent().regenerate(messageIndex);
}
```

Remove any prior implementation that called `submitMessage` / `agent.submit` directly.

- [ ] Step 3: Run chat tests + lint:

```bash
npx nx run chat:test
npx nx run chat:lint
```

- [ ] Step 4: Commit:

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): wire regenerate button to Agent.regenerate(index)"
```

---

## Phase 5 — Disable button while loading

### Task 5: Block regenerate during streaming

**Files:** `libs/chat/src/lib/primitives/chat-message-actions/chat-message-actions.component.ts`

- [ ] Step 1: Add a `disabled` input or `isLoading` input:

```ts
readonly disabled = input<boolean>(false);
```

In the regenerate button template:

```html
<button
  type="button"
  class="chat-message-actions__btn"
  [disabled]="disabled()"
  ...
>
```

- [ ] Step 2: In `chat.component.ts`'s `<chat-message-actions>` invocation:

```html
<chat-message-actions
  ...
  [disabled]="agent().isLoading()"
  ...
/>
```

- [ ] Step 3: Lint + test + commit:

```bash
npx nx run chat:test
npx nx run chat:lint
git add libs/chat/src/lib/primitives/chat-message-actions/ libs/chat/src/lib/compositions/chat/
git commit -m "feat(chat): disable regenerate button while agent is loading"
```

---

## Phase 6 — Bump partial-markdown peer + version bump

### Task 6: Bump @cacheplane/partial-markdown peer to ^0.3.0

**Files:** `libs/chat/package.json`, root `package.json`, `package-lock.json`

- [ ] Step 1: In `libs/chat/package.json`, change:

```json
"@cacheplane/partial-markdown": "^0.2.0",
```

to:

```json
"@cacheplane/partial-markdown": "^0.3.0",
```

- [ ] Step 2: In root `package.json`, do the same.

- [ ] Step 3: Run `npm install` from repo root to update lock file.

- [ ] Step 4: Verify `node_modules/@cacheplane/partial-markdown/package.json` is at 0.3.0 or 0.3.1.

- [ ] Step 5: Run all tests:

```bash
npx nx run chat:test
npx nx run chat:lint
```

- [ ] Step 6: Commit:

```bash
git add libs/chat/package.json package.json package-lock.json
git commit -m "chore(deps): bump @cacheplane/partial-markdown peer to ^0.3.0"
```

### Task 7: Sync all @ngaf libs to 0.0.26

- [ ] Step 1: Bump:

```bash
for f in libs/*/package.json; do
  sed -i.bak -E 's/("version"[[:space:]]*:[[:space:]]*")[^"]+(")/\10.0.26\2/' "$f" && rm "$f.bak"
done
```

- [ ] Step 2: Verify, commit:

```bash
grep '"version"' libs/chat/package.json | head -1   # expect 0.0.26
git add libs/*/package.json
git commit -m "chore(release): synchronize all @ngaf libs to 0.0.26"
```

---

## Phase 7 — Push, PR, merge, tag

### Task 8: Open PR

- [ ] Step 1: Push branch:

```bash
git push -u origin claude/regenerate-semantics-0.0.26
```

- [ ] Step 2: Open PR with `gh pr create`. Body covers regenerate semantics + partial-markdown peer bump + version sync.

- [ ] Step 3: Wait for CI green, squash-merge, push tags `v0.0.26` + `ngaf-v0.0.26` at squash-merge SHA.

- [ ] Step 4: Verify all 7 publishable @ngaf libs at 0.0.26 on npm after publish workflow completes.

---

## Phase 8 — Live Chrome validation

### Task 9: Smoke test against published 0.0.26

- [ ] Step 1: Bump `~/tmp/ngaf` to `^0.0.26`, restart `ng serve`, open in Chrome.

- [ ] Step 2: Send a prompt, wait for response. Click regenerate.

- [ ] Step 3: Verify in DOM:
  - Message count BEFORE regenerate: 2 (1 user + 1 assistant)
  - Message count AFTER regenerate completes: 2 (still 1 user + 1 assistant — NOT 4)
  - User message preserved verbatim
  - Assistant content differs (new generation)

- [ ] Step 4: Test regenerate-during-loading: click regenerate while another message is mid-stream. Verify button is disabled.
