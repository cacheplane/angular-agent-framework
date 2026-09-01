# PR 1: SubagentTracker Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test the subagent attribution ladder directly, fix the empty-description rung-1 bug, stop nested delegations from corrupting the outer subagent's card, and delete the dead namespace helper.

**Architecture:** All changes live in `libs/langgraph/src/lib/internals/subagent-tracker.ts` plus a new sibling spec file. The tracker is a plain class with no Angular/DI dependencies, so tests drive it directly — no more bridge-transport tests for ladder behavior. The nested-namespace guard changes `childStreamRefFromNamespace()` so all three bridge call sites route nested delegations to their own `subgraph`-kind stream automatically.

**Tech Stack:** TypeScript, vitest (lib test target: `npx nx test langgraph`).

**Spec:** `docs/superpowers/specs/2026-09-01-blog-damage-control-design.md` (PR 1 section).

---

### Task 1: Characterization spec for the attribution ladder

**Files:**
- Create: `libs/langgraph/src/lib/internals/subagent-tracker.spec.ts`

These six tests pin CURRENT behavior (rungs 1–3, deferred retry, buffering). They must all pass before any production change; they are the safety net for Tasks 2–3.

- [ ] **Step 1: Write the spec file**

```typescript
// SPDX-License-Identifier: MIT
//
// Direct unit coverage for the subagent attribution ladder. The tracker is a
// plain class, so these tests drive it without the stream-manager bridge.
// Reaching rungs 1/2 THROUGH the bridge additionally requires the child's
// `values` event (carrying a human first message) to arrive before any child
// `messages` event — an ordering no bridge test encodes, which is why ladder
// coverage lives here instead.
import { describe, it, expect } from 'vitest';
import type { BaseMessage } from '@langchain/core/messages';
import { SubagentTracker, childStreamRefFromNamespace } from './subagent-tracker';

function taskCall(id: string, args: Record<string, unknown>) {
  return { id, name: 'task', args: { subagent_type: 'researcher', ...args } };
}

function aiMsg(id: string, content: string): BaseMessage {
  return { id, type: 'ai', content } as unknown as BaseMessage;
}

describe('SubagentTracker attribution ladder', () => {
  it('rung 1: exact description match wins even with multiple candidates', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: 'Summarize the meeting notes' }),
      taskCall('call_b', { description: 'Research quantum signals' }),
    ]);
    // Namespace id is an internal UUID — deliberately NOT a tool-call id, so
    // nothing but the ladder can resolve it. Two candidates outstanding, so
    // the positional rung would refuse; only the exact rung can attribute.
    const winner = t.matchSubgraphToSubagent('ns-uuid-1', 'Research quantum signals');
    expect(winner).toBe('call_b');
  });

  it('rung 2: substring match (either direction) wins when exact fails', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: 'Summarize the meeting notes' }),
      taskCall('call_b', { description: 'Research quantum signals' }),
    ]);
    // The child's first human message elaborates on the stored description.
    const winner = t.matchSubgraphToSubagent(
      'ns-uuid-2',
      'Research quantum signals across the 2025 arxiv corpus',
    );
    expect(winner).toBe('call_b');
  });

  it('rung 2: an empty stored description is never a substring match', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: '' }),
      taskCall('call_b', { description: 'Book a flight' }),
    ]);
    // 'anything' contains '' — without the guard at the substring rung,
    // call_a would claim every stream. It must not.
    const winner = t.matchSubgraphToSubagent('ns-uuid-3', 'anything unrelated');
    expect(winner).toBeUndefined();
  });

  it('rung 3: positional fallback attributes only when exactly one candidate is outstanding', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([taskCall('call_solo', { task_description: 'x' })]);
    expect(t.matchSubgraphToSubagent('ns-uuid-4', '')).toBe('call_solo');
  });

  it('rung 3: refuses with two outstanding candidates and buffers instead', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { task_description: 'x' }),
      taskCall('call_b', { task_description: 'y' }),
    ]);
    expect(t.matchSubgraphToSubagent('ns-uuid-5', '')).toBeUndefined();

    // Unattributed messages are held, not dropped and not mis-assigned.
    t.addMessageToSubagent('ns-uuid-5', aiMsg('m1', 'early chunk'));
    for (const subagent of t.getSubagents().values()) {
      expect(subagent.messages).toHaveLength(0);
    }
  });

  it('deferred retry: a pending match resolves when the tool call registers later', () => {
    const t = new SubagentTracker();
    // Child stream arrives BEFORE the parent's tool call — nothing to match yet.
    expect(t.matchSubgraphToSubagent('ns-uuid-6', 'Find flights to Lisbon')).toBeUndefined();
    t.addMessageToSubagent('ns-uuid-6', aiMsg('m1', 'checking fares'));

    // Parent tool call registers; registerFromToolCalls drains pendingMatches.
    t.registerFromToolCalls([taskCall('call_late', { description: 'Find flights to Lisbon' })]);

    const subagent = t.getSubagents().get('call_late');
    expect(subagent?.status).toBe('running');
    expect(subagent?.messages).toEqual([
      expect.objectContaining({ id: 'm1', content: 'checking fares' }),
    ]);
  });
});
```

- [ ] **Step 2: Run the new spec**

Run: `npx nx test langgraph -- subagent-tracker.spec.ts`
Expected: all 6 PASS — these characterize current behavior (the rung-2 empty-description case is already guarded at `subagent-tracker.ts:183`; the Task 2 bug lives in rung 1 and is only reachable with an empty *probe* description, which none of these use). Any failure means the characterization is wrong — stop and re-read `subagent-tracker.ts:151-220` rather than editing production code to fit.

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/src/lib/internals/subagent-tracker.spec.ts
git commit -m "test(langgraph): direct unit coverage for the subagent attribution ladder"
```

---

### Task 2: Fix the empty-description rung-1 bug

**Files:**
- Modify: `libs/langgraph/src/lib/internals/subagent-tracker.ts:173-187`
- Test: `libs/langgraph/src/lib/internals/subagent-tracker.spec.ts`

`ensureToolStreamAttribution` calls the ladder with `description === ''` intending to land on the positional rung (one-candidate safety check). But a subagent whose `description` arg is literally `''` exact-matches at rung 1 (`'' === ''`), silently bypassing that safety check — with two outstanding children, the stream is confidently mis-attributed instead of refused.

- [ ] **Step 1: Write the failing test** (append inside the `describe` block)

```typescript
  it('empty-description attribution never exact-matches an empty stored description', () => {
    const t = new SubagentTracker();
    t.registerFromToolCalls([
      taskCall('call_a', { description: '' }),
      taskCall('call_b', { description: 'Book a flight' }),
    ]);
    // ensureToolStreamAttribution runs the ladder with '' — with two
    // candidates outstanding it must refuse (positional rung), not let
    // '' === '' claim call_a at the exact rung.
    t.ensureToolStreamAttribution('ns-uuid-7');
    t.addMessageToSubagent('ns-uuid-7', aiMsg('m1', 'child token'));
    for (const subagent of t.getSubagents().values()) {
      expect(subagent.messages).toHaveLength(0);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test langgraph -- subagent-tracker.spec.ts`
Expected: FAIL — `call_a` has 1 message (rung 1 matched `''`).

- [ ] **Step 3: Guard the description rungs**

In `matchSubgraphToSubagent`, wrap the two description rungs (the `for` loops at lines 173-178 and 180-187) so they only run for a non-empty description. The positional rung and `pendingMatches` lines stay outside the guard:

```typescript
    // The description rungs are only meaningful with a real description.
    // ensureToolStreamAttribution calls this with '' precisely to skip them:
    // without this guard, a subagent whose `description` arg is literally ''
    // exact-matches every empty-description probe, bypassing the positional
    // rung's one-candidate safety check.
    if (description) {
      for (const [toolCallId, subagent] of this.subagents) {
        if (subagent.kind !== 'tool' || mapped.has(toolCallId)) continue;
        if (subagent.toolCall.args['description'] === description) {
          return establish(toolCallId);
        }
      }

      for (const [toolCallId, subagent] of this.subagents) {
        if (subagent.kind !== 'tool' || mapped.has(toolCallId)) continue;
        const subagentDescription = subagent.toolCall.args['description'];
        if (typeof subagentDescription !== 'string' || !subagentDescription) continue;
        if (description.includes(subagentDescription) || subagentDescription.includes(description)) {
          return establish(toolCallId);
        }
      }
    }
```

- [ ] **Step 4: Run the full lib test suite**

Run: `npx nx test langgraph`
Expected: PASS, including all of `stream-manager.bridge.spec.ts` (the `#847` positional-attribution tests exercise the `''` path and must be unaffected).

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/internals/subagent-tracker.ts libs/langgraph/src/lib/internals/subagent-tracker.spec.ts
git commit -m "fix(langgraph): empty description must not exact-match at the attribution ladder's first rung"
```

---

### Task 3: Nested-delegation guard in `childStreamRefFromNamespace`

**Files:**
- Modify: `libs/langgraph/src/lib/internals/subagent-tracker.ts:409-419`
- Test: `libs/langgraph/src/lib/internals/subagent-tracker.spec.ts`

Today the function returns on the FIRST `tools:` segment, so a namespace like `tools:a|tools:b` (a subagent that itself delegates) resolves to the OUTER child — the grandchild's tokens merge into the outer card and its `values` overwrite the outer child's. New rule: **more than one `tools:` segment ⇒ the stream registers as its own `subgraph`-kind entry**, keyed by the full namespace path (collision-proof, unique per invocation) and exempt from the attribution ladder (subgraph entries are skipped by every rung's `kind !== 'tool'` check, so it can never mis-attach to a sibling). All three bridge call sites (`stream-manager.bridge.ts:769`, `:988`, `:1010`) route on `kind`, so no bridge change is needed. A single `tools:` segment — including one followed by non-`tools:` internal segments — behaves exactly as before.

- [ ] **Step 1: Write the failing tests** (new `describe` block in the same spec file)

```typescript
describe('childStreamRefFromNamespace', () => {
  it('single tools: segment resolves to a tool child by tool-call id', () => {
    expect(childStreamRefFromNamespace(['tools:call-1'])).toEqual({
      key: 'call-1', name: '', kind: 'tool',
    });
  });

  it('a tool child followed by its own internal nodes stays a tool child', () => {
    // `model`/`agent` segments after the tools: segment are the child's own
    // graph internals, not a second delegation.
    expect(childStreamRefFromNamespace(['tools:call-1', 'agent:step-2'])).toEqual({
      key: 'call-1', name: '', kind: 'tool',
    });
  });

  it('plain subgraph namespace resolves to the first segment, named by node', () => {
    expect(childStreamRefFromNamespace(['research:uuid-1'])).toEqual({
      key: 'research:uuid-1', name: 'research', kind: 'subgraph',
    });
  });

  it('nested delegation registers as its own subgraph stream, never the outer tool child', () => {
    expect(childStreamRefFromNamespace(['tools:call-1', 'tools:call-2'])).toEqual({
      key: 'tools:call-1|tools:call-2', name: 'tools', kind: 'subgraph',
    });
  });

  it('nested delegation with intermediate segments still keys the full path', () => {
    expect(childStreamRefFromNamespace(['tools:call-1', 'agent:x', 'tools:call-2'])).toEqual({
      key: 'tools:call-1|agent:x|tools:call-2', name: 'tools', kind: 'subgraph',
    });
  });
});
```

- [ ] **Step 2: Run to verify the two nested cases fail**

Run: `npx nx test langgraph -- subagent-tracker.spec.ts`
Expected: the two nested tests FAIL (current code returns `{ key: 'call-1', kind: 'tool' }`); the other three PASS.

- [ ] **Step 3: Implement**

Replace the function body (keep the existing doc comment, extending it):

```typescript
/**
 * Derive a child stream's identity from an event namespace.
 *
 * `tools:<id>` segments identify a tool-dispatched child by its tool-call id.
 * Any other segment (e.g. `research:<uuid>` from a compiled graph added with
 * `add_node`) identifies a plain subgraph child: the full segment is the key
 * (unique per invocation) and the part before the first ':' is the node name.
 *
 * A namespace with MORE than one `tools:` segment is a nested delegation — a
 * subagent that itself dispatched a delegation tool. That stream registers as
 * its own subgraph-kind entry keyed by the full namespace path: subgraph
 * entries are skipped by every attribution-ladder rung, so a grandchild can
 * neither merge into the outer child's card nor mis-attach to a sibling.
 * Linking it to its parent card (a delegation tree) is deliberately not
 * modeled; the flat map is the contract.
 */
export function childStreamRefFromNamespace(namespace: string[]): ChildStreamRef | undefined {
  const toolSegments = namespace.filter((segment) => segment.startsWith('tools:'));
  if (toolSegments.length > 1) {
    const innermost = toolSegments[toolSegments.length - 1];
    const colon = innermost.indexOf(':');
    return {
      key: namespace.join('|'),
      name: colon > 0 ? innermost.slice(0, colon) : innermost,
      kind: 'subgraph',
    };
  }
  if (toolSegments.length === 1) {
    return { key: toolSegments[0].slice(6), name: '', kind: 'tool' };
  }
  const first = namespace[0];
  if (!first) return undefined;
  const colon = first.indexOf(':');
  return { key: first, name: colon > 0 ? first.slice(0, colon) : first, kind: 'subgraph' };
}
```

- [ ] **Step 4: Run the full lib suite**

Run: `npx nx test langgraph`
Expected: PASS. If any bridge test fails, it means some existing fixture emits a multi-`tools:` namespace — investigate before changing anything (none should, per the pre-work survey).

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/internals/subagent-tracker.ts libs/langgraph/src/lib/internals/subagent-tracker.spec.ts
git commit -m "fix(langgraph): register nested delegations as their own stream instead of corrupting the outer card"
```

---

### Task 4: Delete the dead `extractToolCallIdFromNamespace` export

**Files:**
- Modify: `libs/langgraph/src/lib/internals/subagent-tracker.ts:421-427` (delete the function)

- [ ] **Step 1: Verify it is truly unreferenced**

Run: `grep -rn "extractToolCallIdFromNamespace" libs/ apps/ cockpit/ examples/ --include="*.ts" | grep -v subagent-tracker.ts`
Expected: no output. (It is exported from an internals file, not from `public-api.ts`.) If anything shows up, stop and reassess — do not delete.

- [ ] **Step 2: Delete lines 421-427** (the whole function, nothing else).

- [ ] **Step 3: Lint + test**

Run: `npx nx lint langgraph && npx nx test langgraph`
Expected: PASS. (Reminder: CI fails on lint *errors*, tolerates warnings; strip ANSI before grepping output for ` error `.)

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/src/lib/internals/subagent-tracker.ts
git commit -m "refactor(langgraph): drop dead extractToolCallIdFromNamespace helper"
```

---

### Task 5: Fix the stale bridge-spec comment

**Files:**
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts:2850-2851`

Post-#847, the `messages` event at `:2843` already attributes the namespace positionally via `ensureToolStreamAttribution`, so by the time the `values` event arrives the ladder short-circuits on the existing mapping. The comment claiming the description ladder does the matching is wrong.

- [ ] **Step 1: Replace the comment**

Old (lines 2850-2851):
```typescript
    // Attribution only arrives later, via a values event carrying the child's
    // first human message, which the description ladder matches on.
```

New:
```typescript
    // The messages event above already attributed the namespace positionally
    // (ensureToolStreamAttribution, #847), so this values event finds the
    // mapping in place — the description ladder is short-circuited here. See
    // subagent-tracker.spec.ts for direct ladder coverage.
```

- [ ] **Step 2: Run the touched suite, then commit**

Run: `npx nx test langgraph`
Expected: PASS (comment-only change).

```bash
git add libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts
git commit -m "test(langgraph): correct stale attribution comment in bridge spec"
```

---

### Task 6: Document nested-delegation behavior in the subgraphs guide

**Files:**
- Modify: `apps/website/content/docs/langgraph/guides/subgraphs.mdx` (the "Tracking delegated subagent execution" section, ~line 170)

- [ ] **Step 1: Add a paragraph** immediately after the paragraph beginning "The `subagents()` signal contains a Map of active child streams…":

```markdown
Nested delegation — a subagent that itself dispatches a delegation tool — surfaces as its own entry too, keyed by its full namespace path and treated like a plain subgraph stream. Each level of delegation gets its own stream; the map stays flat, so there's no parent/child linking between the entries.
```

- [ ] **Step 2: Verify the website suite and commit**

Run: `npx nx test website`
Expected: PASS (347+ specs; content assertions live here).

```bash
git add apps/website/content/docs/langgraph/guides/subgraphs.mdx
git commit -m "docs(website): document nested-delegation stream behavior in the subgraphs guide"
```

---

### Task 7: Final verification and PR

- [ ] **Step 1: Full pre-merge lib checks**

Run: `npx nx lint langgraph 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -cE ' error ' ; npx nx test langgraph && npx nx test website`
Expected: `0` errors from lint; both suites PASS.

- [ ] **Step 2: API-docs check** — no public-surface change is expected (the deleted helper was never in `public-api.ts`). Confirm: `git diff main -- libs/langgraph/src/public-api.ts` → empty. If it is NOT empty, run `npm run generate-api-docs` and commit the result.

- [ ] **Step 3: Open the PR** (this branch, base `main`), title `fix(langgraph): harden subagent attribution — ladder tests, empty-description guard, nested-delegation streams`. Read and address AI review comments per CONTRIBUTING before arming auto-merge; only `Vercel – threadplane` gates.
