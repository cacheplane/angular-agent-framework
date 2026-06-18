# Multi-message Subagent Cards (AG-UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each AG-UI subagent's full live transcript (multiple assistant text turns, reasoning, and tool calls with results) in `chat-subagent-card`, instead of a single accumulating text blob.

**Architecture:** One ACTIVITY per subagent carries the transcript as `messages[]` + `toolCalls[]` in its `content`, streamed via JSON-Patch DELTAs (the L1 reducer is untouched — it already applies arbitrary ACTIVITY patches). `to-agent.ts` projects those arrays onto the neutral `Subagent` contract; the card renders an ordered transcript, delegating tool-call rendering to the existing `ChatToolCallCardComponent`. The example graph's `SubagentStreamHandler` emits the per-message/per-tool DELTAs.

**Tech Stack:** Angular signals, Vitest, AG-UI ACTIVITY events (`@ag-ui/core`), Python (LangChain `AsyncCallbackHandler` + `adispatch_custom_event`), Nx, Playwright.

**Branch:** `feat/ag-ui-multi-message-subagent-cards` (spec already committed there).

**Spec:** `docs/superpowers/specs/2026-06-18-ag-ui-multi-message-subagent-cards-design.md`

---

## File Structure

- **Modify** `libs/chat/src/lib/agent/subagent.ts` — add optional `toolCalls?: Signal<ToolCall[]>` to `Subagent`.
- **Modify** `libs/ag-ui/src/lib/to-agent.ts` — project `content.messages`→`Message[]` and `content.toolCalls`→`ToolCall[]`; keep `text` back-compat.
- **Modify** `libs/ag-ui/src/lib/to-agent.spec.ts` (or the nearest existing ag-ui projection spec) — projection tests.
- **Modify** `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts` (+ its `.spec.ts`) — hybrid transcript renderer.
- **Modify** `examples/ag-ui/python/src/streaming/subagent_stream_handler.py` — stateful multi-message/tool emission.
- **Modify** `examples/ag-ui/python/src/streaming/activity_transform.py` (+ its test) — JSON-Patch builders for the new phases.
- **Modify** `examples/ag-ui/angular/e2e/` — add a multi-message subagent e2e spec.

`Message` and `ToolCall` (libs/chat) are unchanged. The L1 reducer (`libs/ag-ui/src/lib/reducer.ts`) is unchanged.

---

### Task 1: `Subagent.toolCalls` contract (additive, non-breaking)

**Files:**
- Modify: `libs/chat/src/lib/agent/subagent.ts`

- [ ] **Step 1: Add the optional field**

In `libs/chat/src/lib/agent/subagent.ts`, add `toolCalls` after `messages`. Import `ToolCall`:

```ts
// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import type { Message } from './message';
import type { ToolCall } from './tool-call';

export type SubagentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface Subagent {
  /** Tool call ID that spawned this subagent. */
  toolCallId: string;
  /** Optional human-readable name. */
  name?: string;
  status: Signal<SubagentStatus>;
  messages: Signal<Message[]>;
  /**
   * The subagent's own tool calls (name/args/result), referenced by
   * `Message.toolCallIds` in `messages`. Optional: adapters that don't surface
   * subagent tool calls omit it; consumers default to `[]`.
   */
  toolCalls?: Signal<ToolCall[]>;
  state: Signal<Record<string, unknown>>;
}
```

- [ ] **Step 2: Verify the libs still build (optional ⇒ no ripple)**

Run: `npx nx run-many -t lint test --projects=chat,ag-ui,langgraph --skip-nx-cache`
Expected: PASS. Because `toolCalls` is optional, no existing `Subagent` constructor (only `to-agent.ts` + test fakes) needs changes yet. (Ignore harmless "pyenv: cannot rehash" stderr.)

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/agent/subagent.ts
git commit -m "feat(chat): add optional Subagent.toolCalls to the neutral contract"
```

---

### Task 2: Projection — `to-agent.ts` maps the transcript arrays

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Test: `libs/ag-ui/src/lib/to-agent.spec.ts`

Context: `subagentFor(id, entry)` (currently ~lines 220-235) builds a stable `Subagent` wrapper from `entry.content()` (a `WritableSignal<Record<string, unknown>>`). Today `messages` is synthesized from `content.text`. We map `content.messages`/`content.toolCalls` with a `text` fallback.

- [ ] **Step 1: Write the failing tests**

In `libs/ag-ui/src/lib/to-agent.spec.ts`, find how existing subagent-projection tests drive activities (they emit `ACTIVITY_SNAPSHOT`/`ACTIVITY_DELTA` through the reducer, then read `agent.subagents()`). Add a describe block. If the file lacks a helper to push activity events, mirror the existing subagent test's setup. The behavioral assertions:

```ts
it('projects content.messages into Subagent.messages', () => {
  // Arrange: drive an ACTIVITY_SNAPSHOT for activityType 'subagent' whose
  // content.messages = [{id:'m1',role:'assistant',content:'hi',toolCallIds:['t1'],reasoning:'think'}]
  // (use the same mechanism the existing 'subagent' projection test uses)
  const sa = agent.subagents!().get('sub-1')!;
  expect(sa.messages().map(m => ({ id: m.id, role: m.role, content: m.content, toolCallIds: m.toolCallIds, reasoning: m.reasoning })))
    .toEqual([{ id: 'm1', role: 'assistant', content: 'hi', toolCallIds: ['t1'], reasoning: 'think' }]);
});

it('projects content.toolCalls into Subagent.toolCalls', () => {
  // content.toolCalls = [{id:'t1',name:'search',args:{q:'x'},status:'complete',result:{n:1}}]
  const sa = agent.subagents!().get('sub-1')!;
  expect(sa.toolCalls!()).toEqual([{ id: 't1', name: 'search', args: { q: 'x' }, status: 'complete', result: { n: 1 } }]);
});

it('falls back to a single message when only content.text is present (back-compat)', () => {
  // content = { toolCallId:'sub-1', status:'running', text:'partial answer' } (no messages/toolCalls)
  const sa = agent.subagents!().get('sub-1')!;
  expect(sa.messages()).toEqual([{ id: 'sub-1', role: 'assistant', content: 'partial answer' }]);
  expect(sa.toolCalls!()).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test ag-ui --skip-nx-cache -- to-agent`
Expected: FAIL — `messages` still synthesized from `text`; `toolCalls` undefined.

- [ ] **Step 3: Implement the projection**

In `libs/ag-ui/src/lib/to-agent.ts`, add a `ToolCall` import (from `@threadplane/chat` — match how `Subagent`/`Message` are imported at the top of the file) and replace the `subagentFor` wrapper body's `messages` computed + add a `toolCalls` computed:

```ts
function subagentFor(id: string, entry: ActivityEntry): Subagent {
  let w = subagentWrappers.get(id);
  if (!w) {
    w = {
      toolCallId: (entry.content()['toolCallId'] as string) ?? id,
      name: entry.content()['name'] as string | undefined,
      status: computed(() => (entry.content()['status'] as SubagentStatus) ?? 'running'),
      messages: computed<Message[]>(() => {
        const c = entry.content();
        const raw = c['messages'];
        if (Array.isArray(raw)) {
          return (raw as Array<Record<string, unknown>>).map((m, i) => ({
            id: (m['id'] as string) ?? `${id}-${i}`,
            role: (m['role'] as Message['role']) ?? 'assistant',
            content: typeof m['content'] === 'string' ? (m['content'] as string) : (m['content'] as Message['content']) ?? '',
            ...(Array.isArray(m['toolCallIds']) ? { toolCallIds: m['toolCallIds'] as string[] } : {}),
            ...(typeof m['reasoning'] === 'string' ? { reasoning: m['reasoning'] as string } : {}),
          }));
        }
        // Back-compat: single accumulating text blob (current shipped emitter).
        return [{ id, role: 'assistant', content: String(c['text'] ?? '') }];
      }),
      toolCalls: computed<ToolCall[]>(() => {
        const raw = entry.content()['toolCalls'];
        return Array.isArray(raw) ? (raw as ToolCall[]) : [];
      }),
      state: computed(() => (entry.content()['state'] as Record<string, unknown>) ?? {}),
    };
    subagentWrappers.set(id, w);
  }
  return w;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx nx test ag-ui --skip-nx-cache -- to-agent`
Expected: PASS (new + existing ag-ui projection tests).

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts
git commit -m "feat(ag-ui): project subagent transcript (messages[] + toolCalls[]) with text back-compat"
```

---

### Task 3: Card — hybrid transcript renderer

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts`
- Test: `libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.spec.ts`

Context: `ChatToolCallCardComponent` takes `[toolCall]: ToolCallInfo` where `ToolCallInfo = {id, name, args, result?, status?}`. The card maps each `ToolCall` → `ToolCallInfo` and renders one card per call.

- [ ] **Step 1: Write the failing test**

In the spec, render `ChatSubagentCardComponent` with a fake `Subagent` whose `messages()` has two messages (one with `toolCallIds:['t1']` + `reasoning`) and `toolCalls()` has `t1`. Assert:

```ts
it('renders an ordered transcript with reasoning and a delegated tool-call card', () => {
  const sa: Subagent = {
    toolCallId: 'sub-1',
    status: signal('running'),
    messages: signal([
      { id: 'm1', role: 'assistant', content: 'searching', reasoning: 'plan', toolCallIds: ['t1'] },
      { id: 'm2', role: 'assistant', content: 'done' },
    ]),
    toolCalls: signal([{ id: 't1', name: 'search', args: { q: 'x' }, status: 'complete', result: { n: 1 } }]),
    state: signal({}),
  };
  // mount with [subagent]="sa"
  const host = fixture.nativeElement as HTMLElement;
  expect(host.querySelectorAll('.sac__msg').length).toBe(2);
  expect(host.textContent).toContain('searching');
  expect(host.textContent).toContain('done');
  expect(host.textContent).toContain('plan'); // reasoning
  expect(host.querySelectorAll('chat-tool-call-card').length).toBe(1); // delegated render
});
```

(Match the existing spec's TestBed setup — it already imports `ChatSubagentCardComponent`. Add `ChatToolCallCardComponent` to the test module imports if the harness needs it.)

- [ ] **Step 2: Run to verify failure**

Run: `npx nx test chat --skip-nx-cache -- chat-subagent-card`
Expected: FAIL — card still renders only the "Latest message" `<pre>`; no `.sac__msg` / `chat-tool-call-card`.

- [ ] **Step 3: Implement the hybrid renderer**

Replace the template body (the `sac__count` + "Latest message" block) and the class internals:

```ts
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ChatToolCallCardComponent, type ToolCallInfo } from '../chat-tool-call-card/chat-tool-call-card.component';
import { MarkdownComponent } from '../../markdown/markdown.component'; // match the existing markdown renderer import used elsewhere in chat
import type { Subagent, SubagentStatus } from '../../agent/subagent';
import type { Message, ToolCall } from '../../agent';
// ...existing ChatTrace import + statusColor/statusToTraceState helpers stay...

@Component({
  selector: 'chat-subagent-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [/* ChatTrace, */ ChatToolCallCardComponent, MarkdownComponent],
  styles: [/* keep existing styles; add .sac__msg / .sac__reasoning compact styles */],
  template: `
    <chat-trace [state]="state()">
      <span traceLabel>
        <span class="sac__name">{{ subagent().name ?? 'Subagent' }}</span>
        <span class="sac__id">{{ subagent().toolCallId }}</span>
        <span class="sac__pill" [attr.data-status]="subagent().status()">{{ subagent().status() }}</span>
      </span>
      <div class="sac__count">{{ subagent().messages().length }} message(s)</div>
      @for (m of subagent().messages(); track m.id) {
        <div class="sac__msg" [attr.data-role]="m.role">
          @if (m.reasoning) { <div class="sac__reasoning">{{ m.reasoning }}</div> }
          @if (textOf(m); as t) { <chat-markdown [markdown]="t" /> }
          @for (tc of toolCallsFor(m); track tc.id) {
            <chat-tool-call-card [toolCall]="toToolCallInfo(tc)" />
          }
        </div>
      }
    </chat-trace>
  `,
})
export class ChatSubagentCardComponent {
  readonly subagent = input.required<Subagent>();
  readonly state = computed<TraceState>(() => statusToTraceState(this.subagent().status()));

  protected textOf(m: Message): string {
    const c = m.content;
    return typeof c === 'string' ? c : '';
  }
  protected toolCallsFor(m: Message): ToolCall[] {
    const ids = m.toolCallIds ?? [];
    if (ids.length === 0) return [];
    const all = this.subagent().toolCalls?.() ?? [];
    return ids.map((id) => all.find((tc) => tc.id === id)).filter((tc): tc is ToolCall => !!tc);
  }
  protected toToolCallInfo(tc: ToolCall): ToolCallInfo {
    return { id: tc.id, name: tc.name, args: tc.args, result: tc.result, status: tc.status };
  }
}
```

Notes for the implementer: verify the exact markdown component selector/inputs the chat lib uses elsewhere (e.g. `grep -rn "chat-markdown\|MarkdownComponent" libs/chat/src/lib | head`) and match it; if the lib renders markdown via a different selector/input, use that. Keep the existing `statusColor`/`statusToTraceState`/`ChatTrace` imports.

- [ ] **Step 4: Run to verify pass**

Run: `npx nx test chat --skip-nx-cache -- chat-subagent-card`
Expected: PASS.

- [ ] **Step 5: Build the chat lib (catch template/import errors)**

Run: `npx nx build chat --skip-nx-cache`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.ts libs/chat/src/lib/compositions/chat-subagent-card/chat-subagent-card.component.spec.ts
git commit -m "feat(chat): chat-subagent-card renders full transcript (hybrid, reuses tool-call card)"
```

---

### Task 4: Spike — de-risk the Python callback emission

**Files:** (temporary instrumentation only — reverted at task end)
- Modify (temp): `examples/ag-ui/python/src/streaming/subagent_stream_handler.py`

The `SubagentStreamHandler` (an `AsyncCallbackHandler`) currently uses only `on_llm_new_token`. Multi-message emission needs to delineate (a) distinct assistant turns, (b) tool calls (id/name/args), (c) tool results. This task determines, against the REAL research subgraph, which callbacks fire and what payloads they carry — before committing to the emission code in Task 5.

- [ ] **Step 1: Instrument and log**

Temporarily add logging to the handler for `on_llm_start`, `on_llm_new_token`, `on_llm_end`, `on_tool_start`, `on_tool_end` — printing the run_id and the relevant payload fields. For `on_llm_end`, inspect `response.generations[0][0].message.tool_calls` (the AIMessage tool calls: `{id, name, args}`). For `on_tool_end`, inspect `output`/`outputs`.

- [ ] **Step 2: Run a real research turn and capture**

Use the existing local serve path (the examples/ag-ui dev harness with OPENAI_API_KEY, or the aimock fixture harness) to drive a prompt that triggers the research subagent, and capture the handler log. The existing F5 e2e / live-smoke notes in memory describe how to serve examples/ag-ui locally.

- [ ] **Step 3: Document the validated mechanism**

Write the findings into the plan-adjacent spike note (append to the spec's "L3 emission" section or a short comment block in `subagent_stream_handler.py`): which callback opens a new message, where tool-call id/name/args are reliably available, and where the tool result is available. Confirm whether `on_llm_start`/`on_llm_end` fire once per assistant turn for this subgraph.

- [ ] **Step 4: Revert the temporary logging**

Remove the print instrumentation. No commit for this task (it's a spike) unless the documented note lands in the spec — in which case commit only the doc note.

**If the spike shows the callbacks do NOT cleanly delineate messages/tool calls** (e.g. tool calls aren't available in `on_llm_end` for this subgraph): STOP and report — Task 5's emission strategy must be revised (e.g. tap the subgraph's message stream instead of callbacks). Do not force the callback approach.

---

### Task 5: Python emission — multi-message handler + transform builders

**Files:**
- Modify: `examples/ag-ui/python/src/streaming/activity_transform.py` (+ its test, e.g. `examples/ag-ui/python/tests/test_activity_transform.py` — match the existing test location)
- Modify: `examples/ag-ui/python/src/streaming/subagent_stream_handler.py`

Implement using the mechanism validated in Task 4. The transform stays a pure, stateless 1:1 mapper; the handler is the stateful accumulator (it already buffers text).

- [ ] **Step 1: Write the failing transform tests**

In the activity_transform test file, add cases for the new phases (the existing tests cover `started`/`message`/`finished`). The transform maps a `subagent_activity` CUSTOM value `{subagent_id, phase, ...}` → an `ActivitySnapshotEvent`/`ActivityDeltaEvent`. New phases and expected patches:

```python
def test_message_start_adds_message():
    ev = subagent_custom_to_activity(custom('subagent_activity', {
        'subagent_id': 's1', 'phase': 'message_start', 'message_id': 'm1', 'index': 0}))
    assert ev.type == EventType.ACTIVITY_DELTA
    assert {'op': 'add', 'path': '/messages/-', 'value': {'id': 'm1', 'role': 'assistant', 'content': '', 'toolCallIds': []}} in ev.patch

def test_message_streams_content_at_index():
    ev = subagent_custom_to_activity(custom('subagent_activity', {
        'subagent_id': 's1', 'phase': 'message', 'index': 0, 'text': 'hello'}))
    assert ev.patch == [{'op': 'replace', 'path': '/messages/0/content', 'value': 'hello'}]

def test_tool_call_appends_and_links():
    ev = subagent_custom_to_activity(custom('subagent_activity', {
        'subagent_id': 's1', 'phase': 'tool_call', 'index': 0,
        'tool_call_id': 't1', 'name': 'search', 'args': {'q': 'x'}, 'tool_call_ids': ['t1']}))
    assert {'op': 'add', 'path': '/toolCalls/-', 'value': {'id': 't1', 'name': 'search', 'args': {'q': 'x'}, 'status': 'running'}} in ev.patch
    assert {'op': 'replace', 'path': '/messages/0/toolCallIds', 'value': ['t1']} in ev.patch

def test_tool_result_updates_call():
    ev = subagent_custom_to_activity(custom('subagent_activity', {
        'subagent_id': 's1', 'phase': 'tool_result', 'tool_index': 0, 'result': {'n': 1}, 'status': 'complete'}))
    assert {'op': 'replace', 'path': '/toolCalls/0/status', 'value': 'complete'} in ev.patch
    assert {'op': 'replace', 'path': '/toolCalls/0/result', 'value': {'n': 1}} in ev.patch
```

Also update the `started` snapshot test to expect the new empty arrays: `content={'toolCallId': sid, 'name': ..., 'status': 'running', 'messages': [], 'toolCalls': []}`.

- [ ] **Step 2: Run to verify failure**

Run: `cd examples/ag-ui/python && uv run pytest tests/test_activity_transform.py -q`
Expected: FAIL on the new phase cases.

- [ ] **Step 3: Implement the transform builders**

In `activity_transform.py`, change the `started` snapshot to seed `messages: [], toolCalls: []` (drop the old `text: ''`), and add `phase` handlers returning the patches asserted above (`message_start`, `message`, `tool_call`, `tool_result`; keep `finished` → replace `/status`). Keep the function pure (build patches purely from the event fields — `index`, `tool_index`, ids — so no transform-side state).

- [ ] **Step 4: Run to verify pass**

Run: `cd examples/ag-ui/python && uv run pytest tests/test_activity_transform.py -q`
Expected: PASS.

- [ ] **Step 5: Implement the stateful handler**

Rewrite `subagent_stream_handler.py` per the Task-4-validated mechanism: track a current message index + per-message buffer + tool-call ids; emit `message_start` on a new assistant turn, `message` (text_so_far for the current index) on each token, `tool_call` when a tool call is observed, `tool_result` when its result arrives. Each emit is `adispatch_custom_event('subagent_activity', {subagent_id, phase, ...})`, best-effort (the existing try/except for missing run context stays).

- [ ] **Step 6: Verify the python package imports + unit tests pass**

Run: `cd examples/ag-ui/python && uv run pytest -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/ag-ui/python/src/streaming/activity_transform.py examples/ag-ui/python/src/streaming/subagent_stream_handler.py examples/ag-ui/python/tests/test_activity_transform.py
git commit -m "feat(examples/ag-ui): emit multi-message subagent transcript (handler + transform)"
```

---

### Task 6: e2e + full gates

**Files:**
- Create/Modify: an `examples/ag-ui/angular/e2e/*.spec.ts` (extend the existing subagent e2e)

- [ ] **Step 1: Add the multi-message e2e**

Extend the existing examples/ag-ui subagent e2e (the F5 spec) so that during a research run it asserts the subagent card surfaces **≥2** transcript messages AND at least one `chat-tool-call-card`. Use durable-signal assertions (poll/`expect`-based, robust under aimock replay) exactly as the F5 e2e does. Reuse the F5 e2e's harness/fixtures; if a new aimock fixture is needed for a multi-step research transcript, add it alongside the existing ones.

- [ ] **Step 2: Run the e2e**

Run: `npx nx e2e <examples-ag-ui-e2e-project> --skip-nx-cache` (find the exact project name in `examples/ag-ui/angular/project.json`). First free any stale ports if the harness uses fixed ones.
Expected: the multi-message + tool-call assertions pass.

- [ ] **Step 3: Full gates**

```bash
npx nx run-many -t lint test --projects=chat,ag-ui --skip-nx-cache
npx nx build chat --skip-nx-cache
cd examples/ag-ui/python && uv run pytest -q && cd -
npm run generate-api-docs   # Subagent.toolCalls is public API
```
- Confirm `git diff apps/website/content/docs/*/api/api-docs.json` reflects the `toolCalls` addition; the diff MUST contain no references to external research repositories.
- Confirm the cockpit `ag-ui/subagents` capability is unaffected (it uses the single-text/back-compat path) — run its e2e if changed: `npx nx e2e cockpit-ag-ui-subagents-angular --skip-nx-cache`.
- If any `cockpit/ag-ui/*` python/graph source changed (it should NOT in this plan), regenerate the Railway deploy bundle: `npx tsx scripts/generate-ag-ui-deployment-config.ts` and commit `deployments/ag-ui-dev/`. (This plan does not touch cockpit, so expect no regen.)

- [ ] **Step 4: Commit + push + PR**

```bash
git add examples/ag-ui/angular/e2e apps/website/content/docs
git commit -m "test(examples/ag-ui): e2e for multi-message subagent card; regen api-docs"
git push -u origin feat/ag-ui-multi-message-subagent-cards
gh pr create --title "feat(ag-ui): multi-message subagent cards (full transcript)" --body "..."
```

PR body: summarize the transcript wire shape, the additive `Subagent.toolCalls`, the back-compat projection, and the hybrid card; link the spec. No external-repo references.

---

## Notes for the implementer

- The L1 reducer (`libs/ag-ui/src/lib/reducer.ts`) is **not** modified — it already applies arbitrary ACTIVITY JSON-Patches; the new `/messages/*` and `/toolCalls/*` paths flow through unchanged.
- `Subagent.toolCalls` is **optional** — every consumer must default (`subagent().toolCalls?.() ?? []`). This keeps the change non-breaking (only `to-agent.ts` and test fakes construct a neutral `Subagent`; the langgraph adapter uses its own `SubagentStreamRef`).
- Keep `role:'tool'` result messages out of the card render path — the tool-call card already shows the result.
- Do NOT migrate the cockpit `ag-ui/subagents` capability — it deliberately exercises the back-compat (`text`) branch.
- Any new `*.spec.ts` placed under an app's `src/` must `import { describe, it, expect, ... } from 'vitest'` (tsconfig type-checks specs).
- Persist NO external-repo names anywhere (spec/docs/code/comments/PR).
