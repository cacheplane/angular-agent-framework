# PR 2: Fence Regression Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin split-fence streaming behavior with a consumer-guarantee spec, retire the stale "parser can't recover a fence" workaround comment, and give the cockpit e2e tier its first small-chunk streaming fixture.

**Architecture:** **The bug described in the harness comment no longer exists.** Verified 2026-09-01 against the pinned `@cacheplane/partial-markdown@0.5.8`: every chunking (sizes 1–7, including 1-char splits of the opener) of realistic fenced content materializes as `code-block`; upstream 0.5.6 ("active fenced code blocks now track their opener marker separately from the pending line buffer") fixed it. The examples e2e already proves the full component path at `chunkSize: 3` in CI. So this PR is a *guard*, not a fix: a parser-level spec that fails on a dependency downgrade, honest comments, and a cockpit streaming fixture so that tier is no longer the one with zero small-chunk opt-ins. **No cacheplane change or release is needed.**

**Tech Stack:** vitest (`npx nx test chat`), Playwright + aimock (cockpit e2e).

**Spec:** `docs/superpowers/specs/2026-09-01-blog-damage-control-design.md` (PR 2 section — note the deviation above: spec anticipated an upstream fix; investigation showed it already shipped in 0.5.6).

---

### Task 1: Consumer-guarantee spec for split fences

**Files:**
- Create: `libs/chat/src/lib/markdown/streaming-fence.spec.ts` (sibling and stylistic twin of `streaming-table.spec.ts`)

- [ ] **Step 1: Write the spec**

```typescript
// SPDX-License-Identifier: MIT
//
// Consumer-side guarantee: with the partial-markdown version chat depends on,
// a triple-backtick fence whose opener is split across streamed chunks still
// materializes as a code block — never as a paragraph with inline code.
// Fixed upstream in 0.5.6 (opener-marker tracking); this spec guards against
// a dependency downgrade reintroducing it. The e2e harnesses' large default
// chunkSize is a determinism choice, not a workaround for this — see
// libs/e2e-harness/src/aimock-runner.ts.
import { describe, it, expect } from 'vitest';
import { createPartialMarkdownParser, materialize } from '@cacheplane/partial-markdown';

function finalTypes(chunks: string[]): string[] {
  const p = createPartialMarkdownParser();
  for (const chunk of chunks) p.push(chunk);
  p.finish();
  const doc = materialize(p.root) as { children?: Array<{ type: string }> } | null;
  return (doc?.children ?? []).map((c) => c.type);
}

describe('libs/chat consumes streamed code fences', () => {
  it('recovers an opener split one backtick at a time', () => {
    expect(finalTypes(['`', '`', '`ts\n', 'const x = 1;\n', '```\n']))
      .toEqual(['code-block']);
  });

  it('recovers a closer split one backtick at a time', () => {
    expect(finalTypes(['```ts\nconst x = 1;\n', '`', '`', '`\n']))
      .toEqual(['code-block']);
  });

  it('survives arbitrary small chunkings of fenced content after prose', () => {
    const text = 'Here is the snippet:\n\n```typescript\nconst answer = 42;\n```\n\nDone.\n';
    for (let chunkSize = 1; chunkSize <= 7; chunkSize++) {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) chunks.push(text.slice(i, i + chunkSize));
      const types = finalTypes(chunks);
      expect(types, `chunkSize ${chunkSize}`).toEqual(['paragraph', 'code-block', 'paragraph']);
    }
  });

  it('keeps genuine inline code inline', () => {
    expect(finalTypes(['Use `npm', ' i` first.\n'])).toEqual(['paragraph']);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx nx test chat -- streaming-fence.spec.ts`
Expected: PASS on 0.5.8. If any case fails, STOP — the pre-work verification was wrong and this PR becomes an upstream cacheplane fix (repo `~/repos/cacheplane`, release 0.5.9, surgical lockfile bump — never regenerate `package-lock.json` on macOS). Report to the user before proceeding.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/markdown/streaming-fence.spec.ts
git commit -m "test(chat): guard split-fence recovery against a partial-markdown downgrade"
```

---

### Task 2: Retire the stale workaround comment in the shared harness

**Files:**
- Modify: `libs/e2e-harness/src/aimock-runner.ts:50-58`

- [ ] **Step 1: Replace the comment block** above `new LLMock(...)`.

Old (lines 50-58):
```typescript
  // Use a large chunkSize so each response arrives in 1-2 SSE deltas. This
  // intentionally turns off the partial-markdown streaming path for harness
  // tests: structural assertions (code fence, list) measure the FINAL rendered
  // DOM, not the progressive render. With aggressive default chunking, the
  // partial-markdown parser sometimes can't recover a triple-backtick fence
  // that gets split mid-token, and the final state ends up as inline <code>
  // instead of <pre><code>. Streaming-progressive behavior is covered by the
  // Phase 1 unit-variance tables; the e2e harness is for final-state
  // invariants and cross-stack integration.
```

New:
```typescript
  // Use a large default chunkSize so ordinary fixture responses arrive in 1-2
  // SSE deltas: most e2e assertions measure the final rendered DOM, and big
  // chunks keep them deterministic. This is a determinism default, not a
  // workaround — streaming-progressive behavior is covered by the unit
  // variance tables and by fixtures that opt into small per-fixture
  // chunkSize/latency values (see the fence fixture in
  // cockpit/chat/messages/angular/e2e/fixtures/c-messages.json).
```

- [ ] **Step 2: Type-check the lib and commit**

Run: `npx nx lint e2e-harness`
Expected: PASS (comment-only change; target runs `tsc --noEmit`).

```bash
git add libs/e2e-harness/src/aimock-runner.ts
git commit -m "docs(e2e-harness): chunkSize 4096 is a determinism default, not a parser workaround"
```

---

### Task 3: Small-chunk fence fixture in the cockpit tier

**Files:**
- Modify: `cockpit/chat/messages/angular/e2e/fixtures/c-messages.json`
- Modify: `cockpit/chat/messages/angular/e2e/c-messages.spec.ts`

This gives the cockpit harness its first per-fixture streaming opt-in, mirroring `examples/chat/angular/e2e/fixtures/streaming-markdown.json` ("stream a TypeScript code fence regression", `chunkSize: 3`).

- [ ] **Step 1: Add the fixture entry** — `c-messages.json` becomes:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "Hello" },
      "response": {
        "content": "Hi! I'm the chat-messages capability demo. I show how ChatMessageListComponent, ChatInputComponent, and ChatTypingIndicatorComponent render together. Try sending a few messages to see the bubbles and typing indicator in action."
      }
    },
    {
      "match": { "userMessage": "Stream a TypeScript code fence" },
      "response": {
        "content": "Here is the snippet:\n\n```typescript\nconst answer = 42;\n```\n\nThe constant is available for later use."
      },
      "chunkSize": 3,
      "latency": 25
    }
  ]
}
```

- [ ] **Step 2: Add the spec** — append to `c-messages.spec.ts`:

```typescript
test('c-messages: a code fence streamed in 3-char chunks renders as a code block', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'Stream a TypeScript code fence');

  // Final-state invariant driven through REAL small-chunk streaming: the
  // fence opener arrives split mid-token and must still commit as a block.
  await expect(bubble.locator('pre code')).toHaveCount(1);
  await expect(bubble.locator('pre code')).toContainText('const answer = 42;');
  await expect(bubble).not.toContainText('```');
});
```

- [ ] **Step 3: Run this cap's e2e locally**

Precondition: the worktree has had `npm ci` run once, `uv` is installed, and no stale servers hold this cap's ports (check `cockpit/ports.mjs` mapping for `cockpit-chat-messages-angular`; kill orphans first).

Run: `npx playwright test --config cockpit/chat/messages/angular/e2e/playwright.config.ts`
Expected: all c-messages specs PASS, including the new fence test.

- [ ] **Step 4: Commit**

```bash
git add cockpit/chat/messages/angular/e2e/fixtures/c-messages.json cockpit/chat/messages/angular/e2e/c-messages.spec.ts
git commit -m "test(cockpit): stream a split code fence through the c-messages harness at chunkSize 3"
```

---

### Task 4: Final verification and PR

- [ ] **Step 1: Run the touched suites**

Run: `npx nx test chat && npx nx lint e2e-harness && npx playwright test --config cockpit/chat/messages/angular/e2e/playwright.config.ts`
Expected: PASS across the board.

- [ ] **Step 2: Open the PR**, title `test(chat,cockpit): fence streaming regression guards; retire stale parser-workaround comment`. Note in the PR body that the fence bug was verified already-fixed upstream (partial-markdown 0.5.6) and this pins it. Address AI review comments before arming auto-merge.
