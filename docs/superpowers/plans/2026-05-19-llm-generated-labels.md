# LLM-Generated Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's hardcoded `KNOWN_LABELS` map in `libs/chat` (from PR #464) with action-label derivation from the LLM-authored Button's child Text. Add inline LLM-driven thread-title generation to c-a2ui's per-cap graph (Pattern D from the design spec — fully inline node, no shared helper, no topology magic).

**Architecture:** Two independent halves of one PR:
1. **chat-lib (TypeScript)** — `A2uiActionMessage.action.label?: string`; `buildA2uiActionMessage` derives + stamps it from the source Button's Text child; `a2uiActionLabel` prefers it; `KNOWN_LABELS` deleted.
2. **c-a2ui graph (Python)** — new inline `generate_title` node added to `cockpit/chat/a2ui/python/src/graph.py`; reads `config.configurable.thread_id`, idempotency-checks via SDK, calls gpt-5-mini, writes `metadata.thread_title`. Wired between `respond` and `END`.

**Tech Stack:** TypeScript (libs/a2ui, libs/chat); Python 3.12 + langchain-openai + langgraph + langgraph-sdk (cockpit/chat/a2ui/python). No new dependencies.

---

## Pre-flight (READ FIRST)

**Branch:** spec is on `claude/labels-design-spec` (commit `32169ea1`). Implementation branches off the spec branch:

```bash
git fetch origin
git checkout -b claude/llm-generated-labels claude/labels-design-spec
```

**Shared-checkout caveat:** this repo's working tree gets switched by parallel agents. Every code-modifying task begins with `git branch --show-current` check; STOP if you're not on `claude/llm-generated-labels`.

**Hard rules:**
- One commit per code-modifying task (Tasks 1-7).
- Never `git add -A` or `git add .` — stage specific paths only.
- Verification snippets must produce the expected output before committing.
- Never push, open PR, or `--amend` from inside the implementer subagent — Task 10 (orchestrator) handles that.

---

## File structure

| File | Status | Purpose |
|---|---|---|
| `libs/a2ui/src/lib/types.ts` | Modified | Add `label?: string` to `A2uiActionMessage.action` |
| `libs/chat/src/lib/a2ui/build-action-message.ts` | Modified | New `deriveActionLabel()` helper + stamp `action.label` |
| `libs/chat/src/lib/a2ui/build-action-message.spec.ts` | Modified | New cases for label derivation |
| `libs/chat/src/lib/a2ui/action-label.ts` | Modified | Prefer `action.label`; delete `KNOWN_LABELS` |
| `cockpit/chat/a2ui/python/src/graph.py` | Modified | Add inline `generate_title` node + wire it |

---

## Task 1: Add `label?: string` to `A2uiActionMessage`

**Files:**
- Modify: `libs/a2ui/src/lib/types.ts`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
```

- [ ] **Step 2: Find the existing `A2uiActionMessage` interface (around line 252)** and add the optional `label` field

Find:

```typescript
export interface A2uiActionMessage {
  version: 'v1';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
  };
  metadata?: {
    a2uiClientDataModel: A2uiClientDataModel;
  };
}
```

Replace with:

```typescript
export interface A2uiActionMessage {
  version: 'v1';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
    /**
     * Optional human-friendly label for the action — typically derived
     * from the source component's authored text (e.g. a Button's child
     * Text literalString). Set by `buildA2uiActionMessage` when the
     * source is a Button-with-Text-child; left undefined otherwise.
     * Used by the chat-lib's transcript renderer to label the user
     * bubble; backends may ignore. See spec
     * 2026-05-19-llm-generated-labels-design.md.
     */
    label?: string;
  };
  metadata?: {
    a2uiClientDataModel: A2uiClientDataModel;
  };
}
```

- [ ] **Step 3: Verify the file still type-checks**

```bash
npx tsc --noEmit -p libs/a2ui/tsconfig.lib.json 2>&1 | tail -3
```

Expected: no errors (silent success).

- [ ] **Step 4: Commit**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
git add libs/a2ui/src/lib/types.ts
git commit -m "feat(a2ui): add optional A2uiActionMessage.action.label field"
```

---

## Task 2: Implement `deriveActionLabel` + stamp in `buildA2uiActionMessage`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/build-action-message.ts`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
```

- [ ] **Step 2: Replace the file contents**

The current file is short. Replace with:

```typescript
// SPDX-License-Identifier: MIT
import type { A2uiSurface, A2uiActionMessage } from '@ngaf/a2ui';

function toDynamicValue(v: unknown): unknown {
  if (typeof v === 'string') return { literalString: v };
  if (typeof v === 'number') return { literalNumber: v };
  if (typeof v === 'boolean') return { literalBoolean: v };
  return { literalString: String(v) };
}

/**
 * Derive a human-readable label for an outgoing action by walking from
 * the source component to its authored visible text. Today supported:
 * Button → child Text → literalString. Returns null for other component
 * types or when the linkage isn't well-formed; callers fall back to a
 * camelCase humanization of `action.name`.
 *
 * Why: the chat-lib used to ship a hardcoded `KNOWN_LABELS` map
 * (bookingSubmit → 'Search flights') that embedded app-specific
 * knowledge in the primitive. The LLM that authors a surface already
 * writes the Button's visible text — reuse it as the action label.
 * See spec 2026-05-19-llm-generated-labels-design.md.
 */
function deriveActionLabel(surface: A2uiSurface, sourceId: string): string | null {
  const source = surface.components.get(sourceId);
  if (!source) return null;
  const buttonProps = (source.component as { Button?: { child?: string } }).Button;
  if (!buttonProps?.child) return null;
  const labelText = surface.components.get(buttonProps.child);
  if (!labelText) return null;
  const textProps = (labelText.component as { Text?: { text?: { literalString?: string } } }).Text;
  const literal = textProps?.text?.literalString;
  return typeof literal === 'string' && literal.length > 0 ? literal : null;
}

/** Builds an A2uiActionMessage from handler params and the current surface.
 *  The action.context is serialized as v1 DynamicValue-wrapped entries.
 *  Sets action.label when the source component is a Button with a Text
 *  child whose literalString is non-empty. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const rawContext = (params['context'] as Record<string, unknown>) ?? {};
  const wrappedContext: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawContext)) {
    wrappedContext[k] = toDynamicValue(v);
  }

  const sourceComponentId = params['sourceComponentId'] as string;

  const message: A2uiActionMessage = {
    version: 'v1',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context: wrappedContext,
    },
  };

  const label = deriveActionLabel(surface, sourceComponentId);
  if (label) message.action.label = label;

  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v1',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}
```

- [ ] **Step 3: Verify type-checks**

```bash
npx tsc --noEmit -p libs/chat/tsconfig.lib.json 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
git add libs/chat/src/lib/a2ui/build-action-message.ts
git commit -m "feat(chat): derive action.label from source Button's Text child"
```

---

## Task 3: Update `build-action-message.spec.ts` for label derivation

**Files:**
- Modify: `libs/chat/src/lib/a2ui/build-action-message.spec.ts`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
```

- [ ] **Step 2: Read the existing spec to understand the test helpers**

```bash
head -30 libs/chat/src/lib/a2ui/build-action-message.spec.ts
```

Note the `makeSurface(components, dataModel?, sendDataModel?)` and `makeTextComp()` helpers — reuse them.

- [ ] **Step 3: Append four new test cases inside the existing `describe('buildA2uiActionMessage (v1)', ...)` block**

Find the closing `});` of the describe block and insert these tests just before it:

```typescript
  it('derives action.label from source Button child Text', () => {
    const components: A2uiComponent[] = [
      { id: 'submit-btn', component: { Button: { child: 'submit-label', action: { name: 'formSubmit' } } } },
      { id: 'submit-label', component: { Text: { text: { literalString: 'Search flights' } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'submit-btn', name: 'formSubmit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBe('Search flights');
  });

  it('leaves action.label undefined when source is not a Button', () => {
    const components: A2uiComponent[] = [
      { id: 'cb', component: { CheckBox: { label: { literalString: 'Agree' }, checked: { literalBoolean: false } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'cb', name: 'agreeToggle', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });

  it('leaves action.label undefined when Button has no child Text id', () => {
    const components: A2uiComponent[] = [
      { id: 'submit-btn', component: { Button: { action: { name: 'formSubmit' } } as unknown as { child: string; action: { name: string } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'submit-btn', name: 'formSubmit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });

  it('leaves action.label undefined when sourceComponentId does not exist in surface', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = { surfaceId: 's1', sourceComponentId: 'ghost-id', name: 'click', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });
```

- [ ] **Step 4: Run the spec**

```bash
npx nx run chat:test --testPathPattern=build-action-message 2>&1 | tail -10
```

Expected: all tests pass (the 4 new ones + the existing 7).

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
git add libs/chat/src/lib/a2ui/build-action-message.spec.ts
git commit -m "test(chat): add cases for action.label derivation"
```

---

## Task 4: Remove `KNOWN_LABELS` from `action-label.ts`; prefer `action.label`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/action-label.ts`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
```

- [ ] **Step 2: Replace the file contents**

```typescript
// SPDX-License-Identifier: MIT
/**
 * Synthesize a short human-readable label for a serialized A2UI action
 * message, so the chat composition can render "Search flights" instead
 * of a raw `{"version":"v1","action":...}` JSON dump as a user bubble.
 *
 * Per the A2UI v0.9 spec, action messages flow on the client → agent
 * return channel and are framed as typed events (closer to tool calls
 * than user utterances). The spec is silent on chat-bubble rendering;
 * Google's "A2UI in Practice" article and the Stream Chat reference
 * both warn against modeling actions as chat-history user turns.
 *
 * Label source priority:
 *   1. `action.label` if present — populated by `buildA2uiActionMessage`
 *      from the source component's authored visible text (e.g. a
 *      Button's child Text literalString). This is the LLM-authored
 *      label and the preferred source.
 *   2. CamelCase humanization of `action.name` (`bookingSubmit` →
 *      "Booking submit"). Used when no label was stamped — typically
 *      because the source component isn't a Button-with-Text-child.
 *
 * Returns null for any content that isn't a v1 A2UI action message;
 * callers should fall back to the original content in that case.
 *
 * Design context: a previous iteration shipped a hardcoded
 * `KNOWN_LABELS` map (bookingSubmit → 'Search flights') that embedded
 * app-specific knowledge in the chat-lib primitive. That map was
 * removed in favor of derivation from the authored UI; see spec
 * 2026-05-19-llm-generated-labels-design.md.
 *
 * Sources:
 *   - https://a2ui.org/specification/v0.9-a2ui/
 *   - https://medium.com/google-cloud/a2ui-in-practice-patterns-pitfalls-and-the-messages-that-hold-it-together-658720b83789
 *   - https://getstream.io/blog/a2ui-chat-integration/
 */

export function a2uiActionLabel(content: string): string | null {
  if (typeof content !== 'string' || content.length === 0) return null;
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed['version'] !== 'v1') return null;
  const action = parsed['action'];
  if (!isRecord(action)) return null;
  const name = action['name'];
  if (typeof name !== 'string' || name.length === 0) return null;

  // Preferred: label stamped at emit time by buildA2uiActionMessage from
  // the source component's authored visible text.
  const authoredLabel = action['label'];
  if (typeof authoredLabel === 'string' && authoredLabel.length > 0) {
    return authoredLabel;
  }

  // Fallback: humanize the camelCase action name.
  return humanizeCamelCase(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** "bookingSubmit" → "Booking submit". "addToCart" → "Add to cart". */
function humanizeCamelCase(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
```

Note what changed:
- `KNOWN_LABELS` and its helpers (`unwrapContextString`, `readLiteralString`) are removed
- Authored-label path added
- CamelCase humanizer is the only fallback

- [ ] **Step 3: Run the existing spec (if there is one) — or add one**

```bash
ls libs/chat/src/lib/a2ui/action-label.spec.ts 2>&1 | head -1
```

If no spec exists, create one at `libs/chat/src/lib/a2ui/action-label.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { a2uiActionLabel } from './action-label';

describe('a2uiActionLabel', () => {
  it('returns the authored label when action.label is present', () => {
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'bookingSubmit', label: 'Search flights' },
    });
    expect(a2uiActionLabel(content)).toBe('Search flights');
  });

  it('falls back to camelCase humanization when no label', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'bookingSubmit' } });
    expect(a2uiActionLabel(content)).toBe('Booking submit');
  });

  it('humanizes single-word action name', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'submit' } });
    expect(a2uiActionLabel(content)).toBe('Submit');
  });

  it('humanizes multi-camel action name', () => {
    const content = JSON.stringify({ version: 'v1', action: { name: 'addItemToCart' } });
    expect(a2uiActionLabel(content)).toBe('Add item to cart');
  });

  it('returns null for non-v1 messages', () => {
    expect(a2uiActionLabel('{"version":"v2","action":{"name":"x"}}')).toBeNull();
  });

  it('returns null for non-action JSON', () => {
    expect(a2uiActionLabel('{"foo":"bar"}')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(a2uiActionLabel('Hello world')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(a2uiActionLabel('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(a2uiActionLabel('{not json')).toBeNull();
  });

  it('prefers authored label over humanization', () => {
    // Even if name would humanize to "Foo bar", the label wins.
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'fooBar', label: 'Custom Label' },
    });
    expect(a2uiActionLabel(content)).toBe('Custom Label');
  });

  it('falls back to humanization when label is empty string', () => {
    const content = JSON.stringify({
      version: 'v1',
      action: { name: 'fooBar', label: '' },
    });
    expect(a2uiActionLabel(content)).toBe('Foo bar');
  });
});
```

- [ ] **Step 4: Run the spec**

```bash
npx nx run chat:test --testPathPattern=action-label 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
git add libs/chat/src/lib/a2ui/action-label.ts libs/chat/src/lib/a2ui/action-label.spec.ts
git commit -m "refactor(chat): drop KNOWN_LABELS; derive action label from authored UI"
```

---

## Task 5: Verify chat-lib builds + all tests pass

**Files:** none (verification only).

- [ ] **Step 1: Build chat lib**

```bash
npx nx run chat:build 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 2: Run all chat tests**

```bash
npx nx run chat:test 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 3: No commit (verification only).**

---

## Task 6: Add inline `generate_title` node to c-a2ui graph

**Files:**
- Modify: `cockpit/chat/a2ui/python/src/graph.py`

- [ ] **Step 1: Verify branch**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
```

- [ ] **Step 2: Add `langgraph_sdk.get_client` to the imports near the top of the file**

Find the existing imports block (around line 22-27) and add:

```python
import os
# ... existing imports ...
from langgraph_sdk import get_client
```

If `os` is already imported, just add the `langgraph_sdk` line.

- [ ] **Step 3: Add the `generate_title` node + its prompt constant**

Find a good insertion point — after the existing `respond`-like terminal node definitions but before the `_builder = StateGraph(...)` block. (Search for the line that creates the StateGraph; insert immediately above it.)

Add this block:

```python
# ── generate_title node (inline; matches Pattern D from spec
#     2026-05-19-llm-generated-labels-design.md) ──────────────────────────────

_TITLE_PROMPT = (
    "In 3-5 words, summarize what the user is asking about. "
    "Output ONLY the title — no quotes, no period, no prefix."
)
_TITLE_MODEL = "gpt-5-mini"


async def generate_title(state: MessagesState, config) -> dict:
    """Background title generation: on the first turn, summarize the user's
    intent into 3-5 words and persist to LangGraph thread metadata so the
    sidenav shows something meaningful instead of a UUID slice.

    Idempotent — skips when metadata.thread_title already exists. Errors
    are swallowed (title is a UX nicety, never a blocker). Runs after the
    user-visible terminal node so it never blocks the response. See spec
    2026-05-19-llm-generated-labels-design.md.
    """
    thread_id = (config.get("configurable") or {}).get("thread_id")
    if not thread_id:
        return {}
    sdk_url = os.environ.get("LANGGRAPH_API_URL", "http://localhost:2024")
    try:
        client = get_client(url=sdk_url)
        thread = await client.threads.get(thread_id)
        if (thread.get("metadata") or {}).get("thread_title"):
            return {}
        first_user = next(
            (m for m in state["messages"] if getattr(m, "type", None) == "human"),
            None,
        )
        if not first_user or not isinstance(first_user.content, str):
            return {}
        # Skip action-message JSON (those flow as human-role too)
        if first_user.content.lstrip().startswith("{"):
            return {}
        llm = ChatOpenAI(model=_TITLE_MODEL, temperature=0)
        response = await llm.ainvoke([
            SystemMessage(content=_TITLE_PROMPT),
            HumanMessage(content=first_user.content),
        ])
        title = (response.content or "").strip().strip('"').strip("'")[:80]
        if title:
            await client.threads.update(thread_id, metadata={"thread_title": title})
    except Exception as err:  # noqa: BLE001 — title is a UX nicety; never block
        _logger.warning("Thread title generation failed: %s", err)
    return {}
```

- [ ] **Step 4: Wire `generate_title` into the builder**

Find the existing builder block. It currently looks something like:

```python
_builder = StateGraph(MessagesState)
_builder.add_node("router", router)
# ... other nodes ...
_builder.add_node("confirm_booking", confirm_booking)
# ... edges ...
_builder.add_edge("confirm_booking", END)
```

Add the node and rewire the terminal edges to go through `generate_title` instead of directly to END.

Add this line after the last `_builder.add_node(...)`:

```python
_builder.add_node("generate_title", generate_title)
```

Then change the terminal edges. Find each `_builder.add_edge("...", END)` and replace with two edges:

```python
# BEFORE
_builder.add_edge("build_form", END)
_builder.add_edge("search_flights", END)
_builder.add_edge("confirm_booking", END)

# AFTER
_builder.add_edge("build_form", "generate_title")
_builder.add_edge("search_flights", "generate_title")
_builder.add_edge("confirm_booking", "generate_title")
_builder.add_edge("generate_title", END)
```

(Use a `Read` first to see the exact terminal edges in your version of the file, then apply the same rewrite to each.)

- [ ] **Step 5: Verify the file parses and the graph compiles**

```bash
cd cockpit/chat/a2ui/python && uv run python -c "
from src.graph import graph, generate_title
print('TYPE:', type(graph).__name__)
nodes = sorted(graph.get_graph().nodes)
print('NODES:', nodes)
print('HAS_GENERATE_TITLE:', 'generate_title' in nodes)
"
```

Expected: `TYPE: CompiledStateGraph`, `HAS_GENERATE_TITLE: True`. The exact node list will include `__start__`, `__end__`, the original cap nodes (`router`, `build_form`, `search_flights`, `confirm_booking`), and `generate_title`.

- [ ] **Step 6: Commit**

```bash
test "$(git branch --show-current)" = "claude/llm-generated-labels" && echo OK || exit 1
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(c-a2ui): inline generate_title node writes LangGraph thread metadata"
```

---

## Task 7: REQUIRED — programmatic real-LLM smoke (c-a2ui)

**Files:** none (verification only). Requires `OPENAI_API_KEY` in repo-root `.env` AND a running `langgraph dev` for c-a2ui (the node calls back into the SDK).

- [ ] **Step 1: Boot c-a2ui's langgraph dev**

```bash
lsof -t -i :5511 2>/dev/null | xargs kill -9 2>/dev/null
set -a; source .env; set +a
nohup pnpm nx run cockpit-chat-a2ui-python:serve > /tmp/a2ui-backend.log 2>&1 &
until grep -qE "Application started up" /tmp/a2ui-backend.log; do sleep 2; done
echo READY
```

- [ ] **Step 2: Smoke that title is written via SDK after a turn**

```bash
cd cockpit/chat/a2ui/python && uv run python -c "
import asyncio, os
from langgraph_sdk import get_client

os.environ['LANGGRAPH_API_URL'] = 'http://localhost:5511'

async def main():
    client = get_client(url='http://localhost:5511')
    thread = await client.threads.create()
    tid = thread['thread_id']
    print('THREAD:', tid)
    # Run the agent once
    async for chunk in client.runs.stream(
        thread_id=tid,
        assistant_id='c-a2ui',
        input={'messages': [{'role': 'user', 'content': 'I want to fly LAX to JFK'}]},
        stream_mode=['values'],
    ):
        pass
    # Re-fetch the thread; title should now exist in metadata
    thread = await client.threads.get(tid)
    title = (thread.get('metadata') or {}).get('thread_title')
    print('TITLE:', repr(title))
    assert title and len(title) > 0, 'title not written'
    assert len(title) <= 80, f'title too long: {len(title)} chars'
    # Idempotency: re-run shouldn't overwrite
    await client.runs.stream(
        thread_id=tid,
        assistant_id='c-a2ui',
        input={'messages': [{'role': 'user', 'content': 'Filter to cancelled flights'}]},
        stream_mode=['values'],
    ).__anext__()
    # Drain
    async for chunk in client.runs.stream(
        thread_id=tid,
        assistant_id='c-a2ui',
        input=None,
        stream_mode=['values'],
    ):
        pass
    thread2 = await client.threads.get(tid)
    title2 = (thread2.get('metadata') or {}).get('thread_title')
    print('TITLE_AFTER_2ND:', repr(title2))
    assert title2 == title, 'title overwritten on subsequent turn (idempotency broken)'
    print('SMOKE_PASS')

asyncio.run(main())
"
```

Expected: `TITLE: '<some 3-5 word summary>'`, `TITLE_AFTER_2ND: <same value>`, `SMOKE_PASS`.

If the title is empty or the assertion fails, debug: print the langgraph dev backend log to see whether `generate_title` ran and what error it surfaced.

- [ ] **Step 3: Smoke that buildA2uiActionMessage stamps the label**

This is a TypeScript unit test added in Task 3. The same assertion was verified in Step 4 of Task 3. No additional Python smoke needed here.

- [ ] **Step 4: Stop the backend**

```bash
lsof -t -i :5511 2>/dev/null | xargs kill -9 2>/dev/null
```

- [ ] **Step 5: No commit (verification only).**

---

## Task 8: Build verification

**Files:** none.

- [ ] **Step 1: Build chat lib**

```bash
npx nx run chat:build 2>&1 | tail -3
```

- [ ] **Step 2: Build c-a2ui python**

```bash
npx nx run cockpit-chat-a2ui-python:build 2>&1 | tail -3
```

- [ ] **Step 3: Build c-a2ui angular (sanity)**

```bash
npx nx run cockpit-chat-a2ui-angular:build 2>&1 | tail -3
```

- [ ] **Step 4: Production deploy manifest unchanged**

```bash
npx tsx scripts/generate-shared-deployment-config.ts && git diff deployments/shared-dev/langgraph.json
```

Expected: empty diff.

- [ ] **Step 5: No commit.**

---

## Task 9: REQUIRED — chrome MCP end-to-end smoke

**Files:** none. Boots c-a2ui dev backend + frontend; uses chrome MCP to verify both the action label and the thread title rendering.

- [ ] **Step 1: Boot the dev servers from this branch's working tree**

```bash
lsof -t -i :5511 -i :4511 2>/dev/null | xargs kill -9 2>/dev/null
set -a; source .env; set +a
nohup pnpm nx run cockpit-chat-a2ui-python:serve > /tmp/a2ui-backend.log 2>&1 &
nohup pnpm nx serve cockpit-chat-a2ui-angular --port 4511 > /tmp/a2ui-frontend.log 2>&1 &
until grep -qE "Application started up" /tmp/a2ui-backend.log && curl -s -o /dev/null http://localhost:4511/; do sleep 3; done
echo BOTH_READY
```

- [ ] **Step 2: Drive the flow via chrome MCP**

1. Navigate to `http://localhost:4511/`
2. Click the `LAX → JFK` welcome chip
3. Wait ~15-20s for the booking form to render
4. Click `Search flights` on the form
5. Wait ~15-20s for the results surface to render

Verify both:
- **Action label**: the user bubble for the Search submission shows `"Search flights"` (the Button's authored text), NOT raw JSON
- **Thread title**: after the turn completes, refresh the page (or wait for the sidenav to re-fetch). The thread in the sidenav should display a generated title like *"Flight LAX to JFK"* or similar 3-5 word summary, NOT the raw UUID slice.

- [ ] **Step 3: If thread title doesn't appear in the sidenav**

This may indicate a frontend SDK adapter issue (not sourcing `Thread.title` from `thread.metadata.thread_title`). Inspect:

```bash
curl -s -X POST http://localhost:5511/threads/search -H 'Content-Type: application/json' -d '{"limit":1,"order":"desc","order_by":"updated_at"}' | python3 -m json.tool | head -20
```

Confirm `metadata.thread_title` is present in the thread record. If yes but the sidenav doesn't show it, the langgraph adapter needs to map `metadata.thread_title` → `Thread.title`. Document the gap in the PR description and file as out-of-scope (the backend write is the deliverable for this PR).

- [ ] **Step 4: Stop servers + cleanup**

```bash
lsof -t -i :5511 -i :4511 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/a2ui-backend.log /tmp/a2ui-frontend.log
```

---

## Task 10: Open PR + watch CI + merge (orchestrator)

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/llm-generated-labels
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(chat + c-a2ui): LLM-generated labels — thread titles + drop KNOWN_LABELS" --body "$(cat <<'EOF'
## Summary
Implements the LLM-generated labels design (spec 2026-05-19-llm-generated-labels-design.md). Two related fixes in one PR:

### 1. Action labels — drop hardcoded \`KNOWN_LABELS\`
PR #464 added a hardcoded map in libs/chat (\`bookingSubmit → 'Search flights'\`) embedding app-specific knowledge in the primitive. **Removed entirely.** Replaced with derivation from the **authored UI**: when emitting an \`A2uiActionMessage\`, \`buildA2uiActionMessage\` walks from the source Button to its child Text and stamps the literal as \`action.label\`. The transcript renderer (\`a2uiActionLabel\`) prefers \`action.label\` and falls back to camelCase humanization. The chat-lib stops knowing about specific app actions.

### 2. Thread titles — inline LLM node per-cap
Added \`generate_title\` as a normal LangGraph node in \`cockpit/chat/a2ui/python/src/graph.py\` (Pattern D from the spec — fully inline, ~25 lines, visible in the topology). After the cap's terminal node, fires a cheap LLM call (\`gpt-5-mini\`) summarizing the first user message in 3-5 words and persists via \`client.threads.update(thread_id, metadata={'thread_title': ...})\`. Idempotent; errors swallowed; never blocks the user-visible response.

## Files
- \`libs/a2ui/src/lib/types.ts\` — \`A2uiActionMessage.action.label?: string\`
- \`libs/chat/src/lib/a2ui/build-action-message.ts\` — \`deriveActionLabel\` helper + stamp
- \`libs/chat/src/lib/a2ui/build-action-message.spec.ts\` — 4 new cases
- \`libs/chat/src/lib/a2ui/action-label.ts\` — drop KNOWN_LABELS; prefer \`action.label\`
- \`libs/chat/src/lib/a2ui/action-label.spec.ts\` — new spec (11 cases)
- \`cockpit/chat/a2ui/python/src/graph.py\` — inline \`generate_title\` node + wiring

## Test plan
- [x] chat-lib build green
- [x] chat-lib tests green (existing + 4 new + 11 new = expanded coverage)
- [x] c-a2ui python build green
- [x] c-a2ui angular build green
- [x] Shared deploy manifest unchanged
- [x] Programmatic real-LLM smoke (c-a2ui): turn 1 writes \`thread.metadata.thread_title\`; turn 2 doesn't overwrite (idempotency)
- [x] Chrome MCP smoke: form submit bubble shows 'Search flights' from authored Button text (not hardcoded map); sidenav shows generated title (or documented frontend SDK gap if missing)
- [ ] CI

## Scope
**c-a2ui only** for the inline title node — proves the pattern. Other cockpit caps (c-generative-ui, c-tool-calls, c-subagents, c-interrupts, c-messages, c-input, c-debug, c-theming, c-threads, c-timeline) will adopt the same inline pattern in follow-up PRs, one at a time.

Spec: \`docs/superpowers/specs/2026-05-19-llm-generated-labels-design.md\`
Plan: \`docs/superpowers/plans/2026-05-19-llm-generated-labels.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#> --watch
```

- [ ] **Step 4: Merge on green**

```bash
gh pr merge <PR#> --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**
- Decision 1 (per-cap independence) → respected; no cross-cap imports introduced ✓
- Decision 2 (fully inline) → Task 6 puts node + LLM call + SDK write all in graph.py ✓
- Decision 3 (when title fires) → unconditional edge with idempotency in node body ✓
- Decision 4 (gpt-5-mini default) → Task 6 ✓
- Decision 5 (title prompt) → Task 6 (`_TITLE_PROMPT` constant) ✓
- Decision 6 (SDK persistence) → Task 6 (`client.threads.update`) ✓
- Decision 7 (failures swallowed) → Task 6 (try/except around the whole body) ✓
- Decision 8 (Button → Text child source) → Task 2 (`deriveActionLabel` helper) ✓
- Decision 9 (camelCase fallback) → Task 4 (action-label.ts) ✓
- Decision 10 (kill KNOWN_LABELS) → Task 4 (removed entirely) ✓
- Decision 11 (wire-compat: `label?: string` optional) → Task 1 ✓
- Decision 12 (c-a2ui only) → Task 6 only touches c-a2ui ✓

**Placeholder scan:** No TBDs. Every code-modifying step contains the full code to add/replace. Task 6 Step 4 says "Use a `Read` first to see the exact terminal edges" — that's a direct instruction, not a placeholder.

**Type consistency:**
- `A2uiActionMessage.action.label?: string` (Task 1) matches the read in `a2uiActionLabel` (Task 4 — `action['label']`) and the write in `buildA2uiActionMessage` (Task 2 — `message.action.label = label`).
- `deriveActionLabel(surface, sourceId): string | null` (Task 2) — caller (Task 2 same file) checks truthiness; no type mismatch.
- `generate_title(state: MessagesState, config) -> dict` (Task 6) — matches LangGraph's expected node signature; `config` parameter is auto-injected by LangGraph runtime.
- All test cases (Tasks 3, 4) use the existing test helpers (`makeSurface`, `makeTextComp`) where applicable; new fixtures are inline and consistent with the production types.
