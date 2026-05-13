# CI Testing Coverage — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add input-variance table tests to four streaming-render units (chat-streaming-md, content-classifier, partial-args-bridge, a2ui parser) so the class of regressions PR #290 represented can't ship without a failing test.

**Architecture:** Pure-additive unit tests using vitest's `it.each` / `describe.each`. No new tooling, no new CI jobs, no production code changes. Spec authoritative: [2026-05-13-ci-testing-coverage-plan.md](../specs/2026-05-13-ci-testing-coverage-plan.md).

**Tech Stack:** vitest, Angular TestBed (for component tests), nx.

---

## Working environment

- Worktree path: `/tmp/ci-phase-1` (branch `claude/ci-testing-phase-1`).
- Run tests from worktree root: `nx run chat:test` and `nx run a2ui:test`.
- All new files require the license header `// SPDX-License-Identifier: MIT` on line 1.

## Self-review rule for "expected" values

The variance tables test *behavior that already works*. If any row fails on first run, do NOT change the expected value to match the observed output. STOP and surface the failure — it is either a real regression in the unit (file an issue, do not fix in this branch) or a row whose `expected` was specced incorrectly (escalate before changing).

The exception: rows whose expected text contains "contains X" or "matches /…/" patterns — concretise these to exact assertions on first observed pass, and record the resolved value in the spec via a follow-up doc edit (NOT in this branch).

---

## Task 1: chat-streaming-md input-variance spec

**Files:**
- Create: `libs/chat/src/lib/streaming/streaming-markdown.variants.spec.ts`
- Reference: [libs/chat/src/lib/streaming/streaming-markdown.component.ts](libs/chat/src/lib/streaming/streaming-markdown.component.ts), [libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts](libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts)

- [ ] **Step 1: Create the variants spec with full table**

```typescript
// libs/chat/src/lib/streaming/streaming-markdown.variants.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ChatStreamingMdComponent } from './streaming-markdown.component';

@Component({
  standalone: true,
  imports: [ChatStreamingMdComponent],
  template: `<chat-streaming-md [content]="content()" [streaming]="streaming()" />`,
})
class HostComponent {
  content = signal<string>('');
  streaming = signal<boolean>(false);
}

interface FinalizedRow {
  name: string;
  input: string;
  /** Expected concatenated textContent of the rendered root, trimmed and collapsed-whitespace. */
  expectedText: string;
  /** Optional CSS selector that must match at least once in the rendered DOM. */
  selectorPresent?: string;
  /** Optional CSS selector that must NOT match. */
  selectorAbsent?: string;
}

const finalizedRows: FinalizedRow[] = [
  { name: 'plain text no trailing newline', input: 'Hello', expectedText: 'Hello', selectorPresent: 'p' },
  { name: 'plain text with trailing newline', input: 'Hello\n', expectedText: 'Hello', selectorPresent: 'p' },
  { name: 'heading no trailing newline', input: '# Title', expectedText: 'Title', selectorPresent: 'h1' },
  { name: 'heading with trailing newline', input: '# Title\n', expectedText: 'Title', selectorPresent: 'h1' },
  { name: 'completed bold', input: '**bold**', expectedText: 'bold', selectorPresent: 'strong' },
  { name: 'inline code', input: 'Run `npm test` to verify', expectedText: 'Run npm test to verify', selectorPresent: 'code' },
  { name: 'CRLF line endings', input: 'Line one\r\nLine two\r\n', expectedText: 'Line one Line two' },
  { name: 'whitespace only', input: '   ', expectedText: '', selectorAbsent: 'p' },
  { name: 'empty string', input: '', expectedText: '', selectorAbsent: 'p' },
  { name: 'trailing whitespace no newline', input: 'Answer   ', expectedText: 'Answer', selectorPresent: 'p' },
];

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

describe('ChatStreamingMdComponent — finalized input variance', () => {
  it.each(finalizedRows)('$name', (row) => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set(row.input);
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    expect(normalize(fixture.nativeElement.textContent ?? '')).toBe(row.expectedText);
    if (row.selectorPresent) {
      expect(fixture.nativeElement.querySelector(row.selectorPresent)).toBeTruthy();
    }
    if (row.selectorAbsent) {
      expect(fixture.nativeElement.querySelector(row.selectorAbsent)).toBeNull();
    }
  });
});

interface MidStreamRow {
  name: string;
  /** Content pushed while streaming=true. */
  midStream: string;
  /** Content pushed when streaming flips to false. Defaults to midStream. */
  onFinish?: string;
  expectedText: string;
}

const midStreamRows: MidStreamRow[] = [
  { name: 'partial bold mid-stream then unchanged', midStream: '**bo', expectedText: '**bo' },
  { name: 'partial bold mid-stream then completed', midStream: '**bo', onFinish: '**bold**', expectedText: 'bold' },
  { name: 'unfinished sentence then finalized', midStream: 'The quick', onFinish: 'The quick brown fox.', expectedText: 'The quick brown fox.' },
];

describe('ChatStreamingMdComponent — mid-stream input variance', () => {
  it.each(midStreamRows)('$name', (row) => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.content.set(row.midStream);
    fixture.componentInstance.streaming.set(true);
    fixture.detectChanges();
    fixture.componentInstance.content.set(row.onFinish ?? row.midStream);
    fixture.componentInstance.streaming.set(false);
    fixture.detectChanges();
    expect(normalize(fixture.nativeElement.textContent ?? '')).toBe(row.expectedText);
  });
});
```

- [ ] **Step 2: Run the spec**

Run from `/tmp/ci-phase-1`:

```bash
nx run chat:test -- --run streaming-markdown.variants.spec
```

Expected: all rows pass. If any row fails, STOP — see "Self-review rule for expected values" above. Do not adjust expectations to match a buggy unit; do not adjust the unit in this branch.

- [ ] **Step 3: Run the full chat test suite to confirm no collateral damage**

```bash
nx run chat:test
```

Expected: full suite green.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/streaming/streaming-markdown.variants.spec.ts
git commit -m "test(chat): add chat-streaming-md input-variance table"
```

---

## Task 2: content-classifier input-variance spec

**Files:**
- Create: `libs/chat/src/lib/streaming/content-classifier.variants.spec.ts`
- Reference: [libs/chat/src/lib/streaming/content-classifier.ts](libs/chat/src/lib/streaming/content-classifier.ts), [libs/chat/src/lib/streaming/content-classifier.spec.ts](libs/chat/src/lib/streaming/content-classifier.spec.ts)

- [ ] **Step 1: Create the variants spec**

```typescript
// libs/chat/src/lib/streaming/content-classifier.variants.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createContentClassifier, type ContentType } from './content-classifier';

interface Row {
  name: string;
  pushes: readonly string[];
  expectedType: ContentType;
}

const rows: Row[] = [
  { name: 'single dash', pushes: ['-'], expectedType: 'pending' },
  { name: 'two dashes', pushes: ['--'], expectedType: 'pending' },
  { name: 'three dashes', pushes: ['---'], expectedType: 'pending' },
  { name: '---a', pushes: ['---a'], expectedType: 'pending' },
  { name: '---a2u', pushes: ['---a2u'], expectedType: 'pending' },
  { name: '---a2ui_JSON--- single chunk', pushes: ['---a2ui_JSON---'], expectedType: 'a2ui' },
  { name: '---a2ui_JSON--- in many chunks', pushes: ['---', 'a2u', 'i_JSON', '---'], expectedType: 'a2ui' },
  { name: 'markdown bullet leading dash space', pushes: ['- bullet'], expectedType: 'markdown' },
  { name: 'markdown HR three dashes space', pushes: ['--- horizontal'], expectedType: 'markdown' },
  { name: 'dash followed by non-prefix char', pushes: ['-x'], expectedType: 'markdown' },
  { name: 'long dash-led plain text', pushes: ['-this is just text leading dashes'], expectedType: 'markdown' },
  { name: 'leading brace', pushes: ['{'], expectedType: 'json-render' },
  { name: 'leading whitespace then brace', pushes: ['\n  {'], expectedType: 'json-render' },
  { name: 'leading whitespace then dash', pushes: ['   -'], expectedType: 'pending' },
  { name: 'empty', pushes: [''], expectedType: 'pending' },
  { name: 'whitespace only', pushes: ['   \n  '], expectedType: 'pending' },
];

describe('ContentClassifier — input variance', () => {
  it.each(rows)('$name', (row) => {
    TestBed.configureTestingModule({});
    let type!: ContentType;
    TestBed.runInInjectionContext(() => {
      const c = createContentClassifier();
      let accumulated = '';
      for (const chunk of row.pushes) {
        accumulated += chunk;
        c.update(accumulated);
      }
      type = c.type();
    });
    expect(type).toBe(row.expectedType);
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
nx run chat:test -- --run content-classifier.variants.spec
```

Expected: all rows pass.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/streaming/content-classifier.variants.spec.ts
git commit -m "test(chat): add content-classifier input-variance table"
```

---

## Task 3: partial-args-bridge input-variance block

**Files:**
- Modify: `libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts` (append block at end)
- Reference: [libs/chat/src/lib/a2ui/partial-args-bridge.ts](libs/chat/src/lib/a2ui/partial-args-bridge.ts)

- [ ] **Step 1: Read the existing spec**

Read [libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts](libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts) end-to-end. The new block APPENDS — do not remove or modify existing tests.

- [ ] **Step 2: Append the variance block**

Append the following to the END of the existing file (after the last `});` that closes the existing `describe('createPartialArgsBridge', …)`):

```typescript

interface BridgeRow {
  name: string;
  /** Sequence of (toolCallId, argsSoFar) pushes. */
  pushes: ReadonlyArray<readonly [string, string]>;
  /** Assertion run after the final push. */
  assert: (store: A2uiSurfaceStore, bridge: ReturnType<typeof createPartialArgsBridge>) => void;
}

const SURFACE_S_FULL =
  '{"envelopes":[{"surfaceUpdate":{"surfaceId":"s","components":[{"id":"root","type":"text","props":{}}]}}]}';

function progressivePrefixes(s: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= s.length; i++) out.push(s.slice(0, i));
  return out;
}

const bridgeRows: BridgeRow[] = [
  {
    name: 'envelope arrives across char-by-char chunks',
    pushes: progressivePrefixes(SURFACE_S_FULL).map((p) => ['tc-1', p] as const),
    assert: (store) => {
      expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
    },
  },
  {
    name: 'open brace then closed brace stays unpoisoned',
    pushes: [['tc-2', '{'], ['tc-2', '{}']],
    assert: (store, bridge) => {
      expect(store.surfaces().size).toBe(0);
      expect(bridge.isPoisoned('tc-2')).toBe(false);
    },
  },
  {
    name: 'open envelopes array stays unpoisoned',
    pushes: [['tc-3', '{"envelopes":[']],
    assert: (store, bridge) => {
      expect(store.surfaces().size).toBe(0);
      expect(bridge.isPoisoned('tc-3')).toBe(false);
    },
  },
  {
    name: 'trailing whitespace after valid args',
    pushes: [['tc-4', SURFACE_S_FULL + '   \n  ']],
    assert: (store) => {
      expect(store.surfaces().get('s')?.components.has('root')).toBe(true);
    },
  },
  {
    name: 'garbage prefix poisons',
    pushes: [['tc-5', '{{{not_json']],
    assert: (_store, bridge) => {
      expect(bridge.isPoisoned('tc-5')).toBe(true);
    },
  },
  {
    name: 'valid prefix then garbage suffix poisons',
    pushes: [['tc-6', SURFACE_S_FULL + ' garbage']],
    assert: (_store, bridge) => {
      expect(bridge.isPoisoned('tc-6')).toBe(true);
    },
  },
  {
    name: 'two tool_call_ids mount independent surfaces',
    pushes: [
      ['tc-7a', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"a","components":[{"id":"root","type":"text","props":{}}]}}]}'],
      ['tc-7b', '{"envelopes":[{"surfaceUpdate":{"surfaceId":"b","components":[{"id":"root","type":"text","props":{}}]}}]}'],
    ],
    assert: (store) => {
      expect(store.surfaces().get('a')?.components.has('root')).toBe(true);
      expect(store.surfaces().get('b')?.components.has('root')).toBe(true);
    },
  },
  {
    name: 'identical chunk pushed twice mounts exactly once',
    pushes: [['tc-8', SURFACE_S_FULL], ['tc-8', SURFACE_S_FULL]],
    assert: (store) => {
      expect(store.surfaces().get('s')?.components.size).toBe(1);
    },
  },
];

describe('createPartialArgsBridge — input variance', () => {
  it.each(bridgeRows)('$name', (row) => {
    const store = makeStore();
    const bridge = createPartialArgsBridge(store);
    for (const [tc, args] of row.pushes) bridge.push(tc, args);
    row.assert(store, bridge);
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
nx run chat:test -- --run partial-args-bridge.spec
```

Expected: all existing tests still pass; new `input variance` block passes.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/a2ui/partial-args-bridge.spec.ts
git commit -m "test(chat): add partial-args-bridge input-variance table"
```

---

## Task 4: a2ui parser input-variance block

**Files:**
- Modify: `libs/a2ui/src/lib/parser.spec.ts` (append block at end)
- Reference: [libs/a2ui/src/lib/parser.ts](libs/a2ui/src/lib/parser.ts)

- [ ] **Step 1: Read the existing spec**

Read [libs/a2ui/src/lib/parser.spec.ts](libs/a2ui/src/lib/parser.spec.ts) end-to-end. Append-only — do not modify existing tests.

- [ ] **Step 2: Append the variance block**

Append to the END of the existing file:

```typescript

interface ParserRow {
  name: string;
  /** Sequence of chunks to push. */
  chunks: readonly string[];
  /** Expected envelope-key sequence across all push() calls combined. */
  expectedKeys: readonly string[];
}

const BR = (root: string) =>
  JSON.stringify({ beginRendering: { surfaceId: 's', root } });
const SU = () =>
  JSON.stringify({ surfaceUpdate: { surfaceId: 's', components: [] } });
const DM = (key: string) =>
  JSON.stringify({ dataModelUpdate: { surfaceId: 's', contents: [{ key, valueString: 'v' }] } });

const parserRows: ParserRow[] = [
  { name: 'envelope with CRLF', chunks: [BR('r') + '\r\n'], expectedKeys: ['beginRendering'] },
  { name: 'envelope split mid-key', chunks: ['{"begin', 'Rendering":{"surfaceId":"s","root":"r"}}\n'], expectedKeys: ['beginRendering'] },
  { name: 'envelope split mid-string-value', chunks: ['{"beginRendering":{"surfaceId":"s","root":"', 'r"}}\n'], expectedKeys: ['beginRendering'] },
  { name: 'three envelopes one chunk', chunks: [[SU(), DM('k'), BR('r')].join('\n') + '\n'], expectedKeys: ['surfaceUpdate', 'dataModelUpdate', 'beginRendering'] },
  {
    name: 'three envelopes char-by-char',
    chunks: ([SU(), DM('k'), BR('r')].join('\n') + '\n').split(''),
    expectedKeys: ['surfaceUpdate', 'dataModelUpdate', 'beginRendering'],
  },
  { name: 'malformed line then valid line', chunks: ['{garbage}\n' + BR('r') + '\n'], expectedKeys: ['beginRendering'] },
  { name: 'valid envelope no trailing newline waits', chunks: [BR('r')], expectedKeys: [] },
  { name: 'valid envelope, then trailing newline later', chunks: [BR('r'), '\n'], expectedKeys: ['beginRendering'] },
  { name: 'empty lines between envelopes', chunks: ['\n\n' + BR('r') + '\n\n' + BR('r2') + '\n'], expectedKeys: ['beginRendering', 'beginRendering'] },
  { name: 'whitespace before brace', chunks: ['   ' + BR('r') + '\n'], expectedKeys: ['beginRendering'] },
  { name: 'unrecognised envelope key', chunks: ['{"mysteryUpdate":{}}\n'], expectedKeys: [] },
  {
    name: 'mixed valid + unknown + valid',
    chunks: [[BR('r'), '{"mysteryUpdate":{}}', BR('r2')].join('\n') + '\n'],
    expectedKeys: ['beginRendering', 'beginRendering'],
  },
];

describe('createA2uiMessageParser — input variance', () => {
  test.each(parserRows)('$name', (row) => {
    const parser = createA2uiMessageParser();
    const keys: string[] = [];
    for (const chunk of row.chunks) {
      const msgs = parser.push(chunk);
      for (const m of msgs) keys.push(Object.keys(m)[0]);
    }
    expect(keys).toEqual(row.expectedKeys);
  });
});
```

(Note: existing spec uses `test`, not `it`. The new block matches that convention.)

- [ ] **Step 3: Run the spec**

```bash
nx run a2ui:test -- --run parser.spec
```

Expected: all existing tests still pass; new `input variance` block passes.

- [ ] **Step 4: Commit**

```bash
git add libs/a2ui/src/lib/parser.spec.ts
git commit -m "test(a2ui): add message-parser input-variance table"
```

---

## Task 5: Run full affected test suite

- [ ] **Step 1: Run the chat + a2ui test targets in one go**

```bash
nx run-many --target=test --projects=chat,a2ui
```

Expected: both projects green.

- [ ] **Step 2: If anything is red, STOP**

Do not paper over a red row by mutating its expected. Either it's a real regression (escalate, do not fix in this branch) or the expected was specced incorrectly (escalate to update the spec + plan).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin claude/ci-testing-phase-1
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "test: add Phase 1 input-variance table coverage" --body "$(cat <<'EOF'
## Summary

- Adds input-variance table tests to four streaming-render units (chat-streaming-md, content-classifier, partial-args-bridge, a2ui parser).
- Motivating regression: PR #290 (empty-assistant-bubble) shipped because every chat-streaming-md test fed input ending in `\n`; the "no trailing newline" LLM-response shape was uncovered.
- Phase 1 only — Phase 0 (test-infrastructure audit) and Phase 3 (AIMock E2E + CI wiring) deferred.

Spec: [docs/superpowers/specs/2026-05-13-ci-testing-coverage-plan.md](../blob/claude/ci-testing-phase-1/docs/superpowers/specs/2026-05-13-ci-testing-coverage-plan.md)
Plan: [docs/superpowers/plans/2026-05-13-ci-testing-coverage-phase-1.md](../blob/claude/ci-testing-phase-1/docs/superpowers/plans/2026-05-13-ci-testing-coverage-phase-1.md)

## Test plan

- [x] `nx run chat:test` green
- [x] `nx run a2ui:test` green
- [x] PR #290 regression row (`plain text no trailing newline`) present in chat-streaming-md variance table
EOF
)"
```

---

## Self-review checklist

- [x] Spec coverage: each of the 4 target units has a corresponding task (Tasks 1–4).
- [x] PR #290 row included: `plain text no trailing newline` in Task 1's `finalizedRows`.
- [x] No placeholders, every test body fully written.
- [x] Type names referenced match imports (`ContentType` from content-classifier, `A2uiSurfaceStore` from surface-store, `createPartialArgsBridge` etc.).
- [x] Spec author and plan author agree on the file paths used (matched exactly).
- [x] No production-code changes — additive tests only.

## Execution handoff

Plan complete. Recommended execution: **subagent-driven-development** — fresh subagent per task with review between tasks (5 tasks total, all bite-sized, no shared state).
