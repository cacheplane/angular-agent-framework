# `@ngaf/langgraph` Streaming Content Dedup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the visible content duplication in `<chat-streaming-md>` for assistant messages whose content array contains both `reasoning` and `text` blocks (Finding C from the live smoke pass).

**Architecture:** Capture a real chunk sequence from the live demo against `gpt-5` + `effort='high'`, persist it as a unit-test fixture, write a failing replay test that reproduces the duplication, then narrow the fix to `accumulateContent`'s fallback so a final-canonical-shape incoming message replaces partial accumulator content instead of appending. Pin the behaviour with 9 helper unit tests covering `accumulateContent`, `mergeMessages`, and `collapseAdjacentAi`.

**Tech Stack:** TypeScript (`libs/langgraph` + vitest), Node 22 (capture script), LangChain JS SDK, LangGraph in-mem dev server.

**Spec:** `docs/superpowers/specs/2026-05-08-langgraph-streaming-content-dedup-design.md`

**Branch:** `claude/langgraph-streaming-content-dedup`, branched from `origin/main`.

**Hard constraint:** Never reference hashbrown / copilotkit / chatgpt / chatbot-kit / claude in code, comments, commit messages, or PR titles/bodies. (Spec/plan markdown docs already use those library names to ground the analysis — do not propagate them anywhere else.)

---

## File Structure

```
libs/langgraph/
├── src/lib/internals/
│   ├── stream-manager.bridge.ts                              # targeted fix in accumulateContent (~12 LOC)
│   └── stream-manager.bridge.spec.ts                         # +9 helper unit tests + 1 fixture replay test (~280 LOC)
└── test/fixtures/
    ├── capture-streaming-reasoning-puzzle.mjs                # NEW: Node ESM capture script (~50 LOC)
    └── streaming-reasoning-puzzle.json                       # NEW: captured chunks (data, generated)
```

Total ≈ 350 LOC including the fixture.

---

## Phase 0 — Branch creation

### Task 0.1: Create implementation branch

- [ ] **Step 1: Branch from origin/main**

```bash
cd /Users/blove/repos/angular-agent-framework
git fetch origin main
git checkout -b claude/langgraph-streaming-content-dedup origin/main
git rev-parse --abbrev-ref HEAD   # must echo claude/langgraph-streaming-content-dedup
git log --oneline -1              # must be on origin/main HEAD
```

---

## Phase 1 — Capture the chunk fixture

### Task 1.1: Write a standalone Node capture script

**Files:**
- Create: `libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs`

The capture script runs against a live LangGraph dev server. It uses the `@langchain/langgraph-sdk` Client directly — same shape the bridge consumes — and dumps every `messages` event to a JSON file. This is robust against Chrome MCP outages and produces deterministic ground truth.

- [ ] **Step 1: Create the capture script**

Path: `libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs`

```mjs
#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Captures the streaming chunk sequence produced by the LangGraph
 * SDK for a real `gpt-5 + reasoning.effort=high` run against the
 * canonical examples/chat backend. The output JSON is the ground-
 * truth fixture for stream-manager.bridge.spec.ts:
 *   - Each entry is a `messages` event payload (an array of message
 *     tuples) — exactly what the bridge sees per chunk.
 *
 * Run instructions (from repo root):
 *   1. Ensure OPENAI_API_KEY is in examples/chat/python/.env
 *   2. Start backend:
 *        cd examples/chat/python && uv run langgraph dev --port 2024 --no-browser
 *   3. In another terminal, run:
 *        node libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs
 *   4. Output is written to libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@langchain/langgraph-sdk';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(SCRIPT_DIR, 'streaming-reasoning-puzzle.json');
const API_URL = process.env.LANGGRAPH_URL || 'http://localhost:2024';
const ASSISTANT_ID = process.env.LANGGRAPH_ASSISTANT_ID || 'chat';

const PROMPT =
  'Three friends start with 14 apples. They share them so each gets ' +
  'a different prime number of apples and one gets exactly twice as ' +
  'many as another. How many does each get? Walk through your ' +
  'reasoning step by step.';

async function main() {
  const client = new Client({ apiUrl: API_URL });

  const ok = await fetch(`${API_URL}/ok`).then(r => r.ok).catch(() => false);
  if (!ok) {
    console.error(`Backend not reachable at ${API_URL}/ok — is langgraph dev running?`);
    process.exit(1);
  }

  const thread = await client.threads.create();
  console.error(`thread=${thread.thread_id}`);

  const events = [];
  let chunkCount = 0;
  for await (const event of client.runs.stream(thread.thread_id, ASSISTANT_ID, {
    input: {
      messages: [{ role: 'user', content: PROMPT }],
      model: 'gpt-5',
      reasoning_effort: 'high',
    },
    streamMode: ['messages-tuple', 'values'],
  })) {
    chunkCount += 1;
    events.push({ event: event.event, data: event.data });
    if (event.event === 'messages') {
      const tuples = Array.isArray(event.data) ? event.data : [];
      const lastMsg = tuples.length ? tuples[tuples.length - 1] : null;
      const len =
        lastMsg && Array.isArray(lastMsg) && lastMsg[0] && typeof lastMsg[0].content === 'string'
          ? lastMsg[0].content.length
          : '?';
      process.stderr.write(`  chunk #${chunkCount} (messages, len=${len})\n`);
    }
  }

  // Final state — useful as the canonical reference in the assertion.
  const state = await client.threads.getState(thread.thread_id);
  const finalAi = (state.values?.messages || []).filter(m => m.type === 'ai').pop();
  const finalContent = finalAi?.content;
  const canonicalText = Array.isArray(finalContent)
    ? finalContent
        .filter(b => b && (b.type === 'text' || b.type === 'output_text'))
        .map(b => b.text)
        .filter(t => typeof t === 'string')
        .join('')
    : typeof finalContent === 'string'
      ? finalContent
      : '';

  const out = {
    thread_id: thread.thread_id,
    canonical_text_length: canonicalText.length,
    canonical_text: canonicalText,
    events,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.error(`\n✓ wrote ${OUT}`);
  console.error(`  events: ${events.length}, canonical_text_length: ${canonicalText.length}`);
}

main().catch(err => {
  console.error('capture failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Make script executable**

Run:
```bash
chmod +x libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs
```

- [ ] **Step 3: Lint check (parse-only)**

Run:
```bash
node --check libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs
```
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs
git commit -m "chore(langgraph): script to capture streaming reasoning fixture"
```

### Task 1.2: Run the capture script and persist the fixture

- [ ] **Step 1: Ensure OPENAI_API_KEY in `examples/chat/python/.env`**

```bash
cd /Users/blove/repos/angular-agent-framework
ls examples/chat/python/.env 2>/dev/null || grep "OPENAI_API_KEY" .env > examples/chat/python/.env
head -1 examples/chat/python/.env | cut -c1-30
```
Expected: `OPENAI_API_KEY=sk-...` (first 30 chars).

- [ ] **Step 2: Start backend in background**

```bash
nohup uv run --directory examples/chat/python langgraph dev --port 2024 --no-browser > /tmp/exchat-py-c.log 2>&1 &
PY_PID=$!
echo "py pid=$PY_PID"
```

Wait until `/ok` returns:
```bash
for i in $(seq 1 30); do curl -sf http://localhost:2024/ok && break; sleep 2; done
echo " backend OK"
```

- [ ] **Step 3: Run the capture script**

```bash
cd /Users/blove/repos/angular-agent-framework
node libs/langgraph/test/fixtures/capture-streaming-reasoning-puzzle.mjs 2>&1
```

Expected output ends with:
```
✓ wrote /Users/blove/repos/angular-agent-framework/libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json
  events: <some number>, canonical_text_length: <some number>
```

The captured fixture should weigh 50–500 KB depending on response length. Verify:
```bash
ls -lh libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json
python3 -c "import json; d=json.load(open('libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json')); print('events:', len(d['events']), 'canonical_text_length:', d['canonical_text_length'])"
```

- [ ] **Step 4: Stop backend**

```bash
pkill -f "langgraph dev" 2>/dev/null
sleep 1
lsof -nP -iTCP:2024 -sTCP:LISTEN 2>&1 | head -2
```
Expected: nothing listening on :2024.

- [ ] **Step 5: Commit fixture**

```bash
git add libs/langgraph/test/fixtures/streaming-reasoning-puzzle.json
git commit -m "test(langgraph): capture gpt-5 reasoning streaming chunks fixture"
```

**Fallback if Step 3 errors:** If the OpenAI API rejects the request (rate limit, model unavailable, etc.) try `model=gpt-5-mini` instead. Edit the capture script's `model: 'gpt-5'` to `model: 'gpt-5-mini'` and re-run. The duplication symptom appears with both models because it's an adapter bug, not a model bug. Note the model used in the fixture so subsequent assertions match.

---

## Phase 2 — Failing replay test (TDD)

### Task 2.1: Write the captured-fixture replay test

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Add the replay test at the bottom of the file**

Open `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`. After all existing `describe(...)` blocks (the file currently ends after the reasoning-extraction tests), append a new top-level `describe`:

```ts
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'test', 'fixtures', 'streaming-reasoning-puzzle.json'),
    'utf8',
  ),
) as {
  thread_id: string;
  canonical_text_length: number;
  canonical_text: string;
  events: Array<{ event: string; data: unknown }>;
};

describe('stream-manager.bridge — captured streaming replay (Finding C)', () => {
  const { mergeMessages, extractText } = _internalsForTesting;

  it('replaying captured chunks does not duplicate visible answer text', () => {
    // Replay the captured `messages` events through mergeMessages, the
    // exact entry the bridge uses. Each `messages` event payload is an
    // array of [BaseMessage, metadata] tuples — we feed the messages
    // (not the metadata) into the merge.
    let merged: unknown[] = [];
    for (const ev of FIXTURE.events) {
      if (ev.event !== 'messages') continue;
      const tuples = ev.data as unknown[];
      const incoming = tuples
        .map(t => (Array.isArray(t) ? t[0] : t))
        .filter(m => m != null) as unknown[];
      merged = mergeMessages(merged as never, incoming as never) as unknown[];
    }

    const lastAi = (merged as Array<{ type?: string; content?: unknown }>)
      .filter(m => m.type === 'ai')
      .pop();
    expect(lastAi).toBeTruthy();

    const visible = extractText(lastAi!.content);

    // Allow ±20 chars for trailing whitespace differences between the
    // streamed accumulator and the final canonical text. The bug
    // currently produces ≈1.83× length, so this assertion fails before
    // the fix lands.
    const expected = FIXTURE.canonical_text_length;
    expect(visible.length).toBeGreaterThanOrEqual(expected - 20);
    expect(visible.length).toBeLessThanOrEqual(expected + 20);
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -25
```

Expected: 1 test FAILS — the captured-replay assertion `visible.length` is well above `expected + 20` (likely ~1.83× expected). Pre-existing 50 tests still pass.

If the test PASSES (which would mean the bug doesn't reproduce in the captured fixture), STOP and report DONE_WITH_CONCERNS — the capture either didn't trigger the duplication path (try a different prompt), or the bug is intermittent (capture more samples).

Do NOT commit yet — Phase 3 commits the fix + test together as one logical unit.

---

## Phase 3 — Targeted fix in `accumulateContent`

### Task 3.1: Apply the narrow heuristic fix

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

The fix follows spec approach **4a**: detect when incoming content is a "final canonical with reasoning+text array" and treat it as authoritative — replace the existing string accumulator with the canonical's text. For any other shape, keep the current behaviour (prefix detection + delta append fallback).

- [ ] **Step 1: Add a helper to detect the final-canonical content shape**

Open `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`. Locate the `accumulateContent` function (around line 922).

Insert a new helper directly **above** `accumulateContent`:

```ts
/**
 * Heuristic: does this content look like a "final canonical" array
 * carrying both reasoning and visible text blocks? OpenAI's Responses
 * API ships the final assistant message in this shape after the
 * streaming token chunks complete. Detection is narrow (requires BOTH
 * a reasoning-shape block AND a text-shape block in the same array)
 * so it doesn't trip on routine streaming chunks.
 */
function isFinalCanonicalReasoningContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  let hasReasoning = false;
  let hasText = false;
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const t = (block as Record<string, unknown>)['type'];
    if (t === 'reasoning' || t === 'thinking') hasReasoning = true;
    else if (t === 'text' || t === 'output_text') hasText = true;
  }
  return hasReasoning && hasText;
}
```

- [ ] **Step 2: Replace the `accumulateContent` body**

The current function:

```ts
function accumulateContent(existing: unknown, incoming: unknown): string {
  const existingText = extractText(existing);
  const incomingText = extractText(incoming);

  // Always return a string. We never want array content escaping the bridge:
  // (a) downstream consumers expect string content, and (b) findContentMatch
  // stringifies arrays, which would prevent the canonical-message id-swap
  // dedupe from matching the streamed-chunk message after a partial chunk.
  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  // Incoming is a strict-superset of accumulated (final-id swap with full content).
  if (incomingText.startsWith(existingText)) return incomingText;
  // Existing already a strict-superset — chunk arrived after the canonical
  // message merged in via values-sync. Keep what we have.
  if (existingText.startsWith(incomingText)) return existingText;
  // Otherwise treat incoming as a delta and append.
  return existingText + incomingText;
}
```

Replace with:

```ts
function accumulateContent(existing: unknown, incoming: unknown): string {
  const existingText = extractText(existing);
  const incomingText = extractText(incoming);

  // Always return a string. We never want array content escaping the bridge:
  // (a) downstream consumers expect string content, and (b) findContentMatch
  // stringifies arrays, which would prevent the canonical-message id-swap
  // dedupe from matching the streamed-chunk message after a partial chunk.
  if (existingText.length === 0) return incomingText;
  if (incomingText.length === 0) return existingText;
  // Incoming is a strict-superset of accumulated (final-id swap with full content).
  if (incomingText.startsWith(existingText)) return incomingText;
  // Existing already a strict-superset — chunk arrived after the canonical
  // message merged in via values-sync. Keep what we have.
  if (existingText.startsWith(incomingText)) return existingText;
  // Final-canonical detection: when incoming is the "reasoning + text"
  // array shape that ships the authoritative final message after a
  // streaming run, replace the partial streamed accumulator with the
  // canonical text instead of appending. Without this branch a small
  // formatting difference between the streamed accumulator and the
  // canonical text breaks the prefix checks above and visible content
  // is duplicated (`existingText + incomingText`).
  if (isFinalCanonicalReasoningContent(incoming)) return incomingText;
  // Otherwise treat incoming as a delta and append.
  return existingText + incomingText;
}
```

- [ ] **Step 3: Export the new helper for testing**

Locate `_internalsForTesting` (around line 1137):

```ts
export const _internalsForTesting = {
  extractText,
  extractReasoning,
  accumulateContent,
  accumulateReasoning,
  collapseAdjacentAi,
  mergeMessages,
  preserveIds,
  normalizeMessageType,
};
```

Add `isFinalCanonicalReasoningContent`:

```ts
export const _internalsForTesting = {
  extractText,
  extractReasoning,
  accumulateContent,
  accumulateReasoning,
  collapseAdjacentAi,
  mergeMessages,
  preserveIds,
  normalizeMessageType,
  isFinalCanonicalReasoningContent,
};
```

- [ ] **Step 4: Run the replay test — must now PASS**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```

Expected: all langgraph tests pass — the previously-failing `replaying captured chunks does not duplicate visible answer text` test now passes within ±20 chars of the canonical length. Pre-existing 50 tests still pass.

If it still fails, the captured chunks may not match the assumed shape; print one of the failing chunks (`console.log(JSON.stringify(ev.data, null, 2))` near the loop in the spec) and use that to refine the heuristic.

- [ ] **Step 5: Lint**

```bash
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```
Expected: 0 errors.

- [ ] **Step 6: Commit fix + replay test together**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.ts \
        libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "fix(langgraph): replace partial accumulator when final canonical content arrives"
```

---

## Phase 4 — Pin behaviour with helper unit tests

### Task 4.1: `accumulateContent` unit tests (4 cases)

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Add a new `describe` block above the captured-replay block**

Open the spec file. Find the `describe('stream-manager.bridge — reasoning extraction', ...)` block. After it (and before the captured-replay describe added in Phase 2), insert:

```ts
describe('stream-manager.bridge — accumulateContent', () => {
  const { accumulateContent, isFinalCanonicalReasoningContent } = _internalsForTesting;

  it('returns incoming when existing is empty', () => {
    expect(accumulateContent('', 'hello')).toBe('hello');
    expect(accumulateContent(undefined, 'hello')).toBe('hello');
  });

  it('appends sequential string deltas (the legitimate delta path)', () => {
    // existing="hello" + incoming="world" — neither is a prefix of the
    // other, AND incoming is a plain string (no final-canonical
    // reasoning+text array shape). Falls through to delta append.
    expect(accumulateContent('hello', 'world')).toBe('helloworld');
  });

  it('replaces partial accumulator when final canonical reasoning+text array arrives', () => {
    // The bug-fix path: streamed accumulator differs from final
    // canonical (formatting, normalization). Without the fix this
    // would produce 'partial answerCANONICAL ANSWER' (1.83x); with
    // the fix, the canonical text wins.
    const existing = 'partial answer';
    const incoming = [
      { type: 'reasoning', summary: [{ type: 'summary_text', text: 'I thought about it.' }] },
      { type: 'text', text: 'CANONICAL ANSWER' },
    ];
    expect(accumulateContent(existing, incoming)).toBe('CANONICAL ANSWER');
    // Sanity: the heuristic agrees this is a final canonical shape.
    expect(isFinalCanonicalReasoningContent(incoming)).toBe(true);
  });

  it('takes incoming when it is a strict superset of existing', () => {
    expect(accumulateContent('Step 1', 'Step 1: define')).toBe('Step 1: define');
  });
});
```

- [ ] **Step 2: Run tests — all pass**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -5
```
Expected: 4 new tests pass + the captured replay still green + pre-existing tests green.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): pin accumulateContent (delta append + final-canonical replace)"
```

### Task 4.2: `mergeMessages` unit tests (3 cases)

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Add a new describe block (after the accumulateContent block)**

```ts
describe('stream-manager.bridge — mergeMessages', () => {
  const { mergeMessages } = _internalsForTesting;

  function aiMessage(opts: { id?: string; content: unknown }): unknown {
    return { type: 'ai', id: opts.id, content: opts.content, _getType: () => 'ai' };
  }
  function humanMessage(opts: { id?: string; content: string }): unknown {
    return { type: 'human', id: opts.id, content: opts.content, _getType: () => 'human' };
  }

  it('accumulates same-id chunks into a single AI message', () => {
    const c1 = aiMessage({ id: 'run-1', content: 'Hello' });
    const c2 = aiMessage({ id: 'run-1', content: 'Hello world' });
    const merged = mergeMessages([] as never, [c1] as never);
    const merged2 = mergeMessages(merged, [c2] as never);
    expect(merged2.length).toBe(1);
    expect((merged2[0] as { content?: unknown }).content).toBe('Hello world');
  });

  it('chunk without id falls into the trailing AI message', () => {
    const initial = aiMessage({ id: 'run-1', content: 'Hello' });
    const chunk = aiMessage({ content: ' world' }); // no id
    const merged = mergeMessages([initial] as never, [chunk] as never);
    expect(merged.length).toBe(1);
    expect((merged[0] as { content?: unknown }).content).toBe('Hello world');
  });

  it('reasoning+text content array sets next.reasoning AND replaces partial content', () => {
    const initial = aiMessage({ id: 'run-1', content: 'partial' });
    const finalCanonical = aiMessage({
      id: 'run-1',
      content: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: 'thinking…' }] },
        { type: 'text', text: 'final answer' },
      ],
    });
    const merged = mergeMessages([initial] as never, [finalCanonical] as never);
    expect(merged.length).toBe(1);
    const r = merged[0] as { content?: unknown; reasoning?: unknown };
    expect(r.content).toBe('final answer'); // bug-fix path: replaced, not appended
    expect(r.reasoning).toBe('thinking…');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -5
```
Expected: 3 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): pin mergeMessages (id-match, trailing-ai, final-canonical)"
```

### Task 4.3: `collapseAdjacentAi` unit tests (2 cases — regression coverage)

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Add a new describe block**

```ts
describe('stream-manager.bridge — collapseAdjacentAi', () => {
  const { collapseAdjacentAi } = _internalsForTesting;

  function aiMessage(opts: { id?: string; content: unknown }): unknown {
    return { type: 'ai', id: opts.id, content: opts.content, _getType: () => 'ai' };
  }

  it('collapses two adjacent AI messages with identical text into one', () => {
    const a = aiMessage({ id: 'a', content: 'hello world' });
    const b = aiMessage({ id: 'b', content: 'hello world' });
    const out = collapseAdjacentAi([a, b] as never);
    expect(out.length).toBe(1);
    expect((out[0] as { content?: unknown }).content).toBe('hello world');
  });

  it('keeps two adjacent AI messages with non-prefix-related text', () => {
    const a = aiMessage({ id: 'a', content: 'hello' });
    const b = aiMessage({ id: 'b', content: 'goodbye' });
    const out = collapseAdjacentAi([a, b] as never);
    expect(out.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -5
```
Expected: 2 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): pin collapseAdjacentAi (collapse identical, keep distinct)"
```

---

## Phase 5 — Verification + PR

### Task 5.1: Full local sweep

- [ ] **Step 1: Lint**

```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run langgraph:lint --skip-nx-cache 2>&1 | tail -5
```
Expected: 0 errors.

- [ ] **Step 2: Test**

```bash
npx nx run langgraph:test --skip-nx-cache 2>&1 | tail -10
```
Expected: 50 + 9 + 1 = 60 tests pass (existing 50 + 9 helper unit tests + 1 captured-replay).

- [ ] **Step 3: Build (if libs/langgraph has a build target)**

```bash
npx nx run langgraph:build --skip-nx-cache 2>&1 | tail -5 || echo "no build target — OK"
```
Expected: succeeds (or no build target, which is fine).

- [ ] **Step 4: Confirm commit count**

```bash
git rev-list --count origin/main..HEAD
```
Expected: 7 commits.

### Task 5.2: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/langgraph-streaming-content-dedup 2>&1 | tail -3
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(langgraph): replace partial accumulator when final canonical content arrives" --body "$(cat <<'EOF'
## Summary

Eliminates the visible answer-text duplication that surfaced during the live smoke pass against examples/chat after Phase 2A landed. When an AI message's content array contains both a reasoning block (with summary items) and a text block, the visible bubble in <chat-streaming-md> rendered the answer text approximately twice (1.83× expected length).

## Root cause

`accumulateContent` in `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` falls back to `existing + incoming` text concatenation when neither side is a strict prefix of the other. Streaming chunks accumulate ~83% of the answer; the final canonical message arrives with the full text but with small formatting differences (whitespace / Unicode normalization / leading reasoning block shifting which block extractText picks). The prefix check fails, the fallback fires, and the bubble ends up with both copies stitched together.

## Fix

Narrow heuristic that only triggers on a specific final-canonical shape:

```ts
function isFinalCanonicalReasoningContent(content: unknown): boolean {
  // true when content is an array containing BOTH a reasoning/thinking block
  // AND a text/output_text block — the shape OpenAI's Responses API uses for
  // final canonical messages.
}

function accumulateContent(existing, incoming) {
  // ...existing prefix-detection logic kept...
  if (isFinalCanonicalReasoningContent(incoming)) return incomingText; // NEW
  return existingText + incomingText; // legitimate delta-append path preserved
}
```

The legitimate sequential-string-delta path (existing="hello", incoming="world", neither a prefix of the other) is preserved — only the final-canonical-array shape is intercepted. Tests pin both paths explicitly.

## Verification

Captured a real chunk sequence from the running canonical demo (gpt-5 + reasoning.effort=high + the puzzle prompt) into a JSON fixture; replay through mergeMessages without the fix produces text length ~1.83× canonical. With the fix, length is within ±20 chars of canonical.

### Local
- [x] nx run langgraph:lint — green
- [x] nx run langgraph:test — green (60 tests; +9 helper unit tests + 1 captured-replay test)
- [x] Captured-fixture replay produces visible text length matching server canonical

## Test plan
- [ ] CI green
- [ ] After merge: re-run live smoke against the workspace examples/chat demo (issue #214 sweep) — puzzle prompt produces a single, non-duplicated visible answer

Spec: `docs/superpowers/specs/2026-05-08-langgraph-streaming-content-dedup-design.md`
Plan: `docs/superpowers/plans/2026-05-08-langgraph-streaming-content-dedup.md` (lands in PR alongside this implementation, or in a separate small docs PR)

EOF
)"
```

- [ ] **Step 3: Wait for CI; address failures.**

- [ ] **Step 4: Merge once green.**

---

## Definition of done

1. PR merged.
2. CI green: `langgraph:lint`, `langgraph:test`.
3. Captured-fixture replay test passes — final visible text length matches server canonical (±20 chars).
4. The 9 helper unit tests pin both the legitimate delta-append path and the bug-fix replace path.
5. Live smoke against the workspace demo (manual, Chrome MCP if available): puzzle prompt produces a single bubble whose `chat-message[1].textContent.length` is within the range of the server's text block length — no 1.8× duplication.
