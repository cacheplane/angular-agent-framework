# aimock E2E — Phase 2c: A2UI v1 single-bubble invariant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a Playwright scenario that drives an A2UI v1 GenUI prompt through the aimock harness and asserts the single-bubble invariant from PR #297 — exactly ONE assistant bubble per GenUI turn, with `<a2ui-surface>` rendered inside it.

**Architecture:** The mock returns a tool-call response (`render_a2ui_surface` with envelopes as args). The Python graph processes the tool_call and re-emits the surface as `---a2ui_JSON---\n`-prefixed content in the same AI message. Angular renders one bubble with the surface inside.

**Scope:** single-bubble invariant only. Progressive mount (the `a2ui-partial` event-stream chunked-args behavior) is deferred to Phase 2d.

**Sits on:** Phase 2b ([#314](https://github.com/cacheplane/angular-agent-framework/pull/314)) — directory-of-fixtures runner. Plan lives at `docs/superpowers/plans/2026-05-15-aimock-a2ui-single-bubble.md`.

---

## Working environment

- Worktree: `/tmp/aimock-2c` (branch `claude/aimock-a2ui-single-bubble`).
- `node_modules` symlinked from main checkout.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS file.
- One commit per task. DO NOT push, amend, or `git add -A`.
- The fixture file format is the same as Phase 2b — `{fixtures: [{match, response}]}`. The `response` field gains a `toolCalls` entry instead of `content`.

---

## Task 0: De-risk the tool-call flow

**Files:** None (investigation only).

This task validates the integration assumption that aimock can serve tool-call responses to the langgraph Python agent and that the resulting bubble carries the surface. If anything fails, STOP and report — the scope needs to shrink or the spec needs revision.

- [ ] **Step 1: Validate the mock fixture format for tool-calls**

Write a one-off scratch fixture at `/tmp/aimock-tc-fixture.json`:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "show me a tiny surface" },
      "response": {
        "toolCalls": [
          {
            "name": "render_a2ui_surface",
            "arguments": {
              "envelopes": [
                {
                  "surfaceUpdate": {
                    "surfaceId": "s1",
                    "components": [
                      { "id": "root", "component": { "Text": { "text": { "literalString": "Hello from the mock!" } } } }
                    ]
                  }
                },
                { "beginRendering": { "surfaceId": "s1", "root": "root" } }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

Write a scratch Node script at `/tmp/aimock-tc-smoke.mjs`:

```javascript
import { LLMock } from "@copilotkit/aimock";
import OpenAI from "openai";

const mock = new LLMock({ port: 0 });
mock.loadFixtureFile("/tmp/aimock-tc-fixture.json");
await mock.start();
console.log("aimock url:", mock.url);

const client = new OpenAI({ apiKey: "test", baseURL: `${mock.url}/v1` });
const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "show me a tiny surface" }],
  tools: [
    {
      type: "function",
      function: {
        name: "render_a2ui_surface",
        parameters: { type: "object", properties: { envelopes: { type: "array" } } },
      },
    },
  ],
});

console.log(JSON.stringify(completion.choices[0].message, null, 2));
await mock.stop();
```

Run:
```bash
cd /tmp/aimock-2c
npm install --no-save --no-package-lock @copilotkit/aimock openai
node /tmp/aimock-tc-smoke.mjs
```

Expected: the printed message contains `tool_calls` array with a `render_a2ui_surface` call whose `arguments` (string) parses to `{envelopes: [...]}` matching the fixture.

If the mock does not emit `tool_calls`: STOP. The mock may require a different matcher shape (e.g., the request must declare the tool in its `tools` array AND the mock matches on toolName). Try adjusting the fixture's `match` to `{toolName: "render_a2ui_surface"}` and re-run. Report which shape worked.

- [ ] **Step 2: Verify the langgraph Python agent honors a tool-call response**

Locate the existing Phase 2a smoke flow's tool-call handling:

```bash
grep -n "render_a2ui_surface\|bind_tools" /tmp/aimock-2c/examples/chat/python/src/streaming/envelope_tool.py /tmp/aimock-2c/examples/chat/python/src/graph.py
```

Confirm the agent binds the `render_a2ui_surface` tool to the LLM. If the binding is conditional (e.g., gated on Gen UI mode), document the condition — the spec assumes the default flow includes A2UI tool binding.

- [ ] **Step 3: Run a manual end-to-end probe**

Start the harness with the scratch tool-call fixture:

```bash
cd /tmp/aimock-2c
ln -sf /tmp/aimock-tc-fixture.json examples/chat/aimock-e2e/fixtures/tc-probe.json
# Run the smoke spec with a custom prompt — modify smoke.spec.ts inline (do NOT commit) to send "show me a tiny surface" and pause for inspection.
```

Skip this step if Step 1's printed `tool_calls` shape is unambiguous — the Playwright spec in Task 4 will exercise the full path. The point of Step 3 is to catch agent-side surprises (e.g., agent rejects tool_calls without a finish_reason that matches its expectation). If you can resolve any agent-side issue by reading code, do so; if not, STOP and report.

- [ ] **Step 4: Clean up**

```bash
rm -f /tmp/aimock-tc-fixture.json /tmp/aimock-tc-smoke.mjs
rm -f /tmp/aimock-2c/examples/chat/aimock-e2e/fixtures/tc-probe.json
```

Confirm working tree is clean: `git status`.

- [ ] **Step 5: Report**

DE-RISK COMPLETE or DE-RISK FAILED. Include:
- The fixture `match` shape that worked (`{userMessage}`, `{toolName}`, or both).
- The exact shape of `completion.choices[0].message.tool_calls[0]` (key path to `arguments`).
- Whether the agent has any conditional gating on tool binding.

If de-risk passes, proceed to Task 1. If it fails in a way that makes the single-bubble assertion impossible (e.g., mock won't emit tool_calls at all), STOP and escalate.

---

## Task 1: Add the `a2ui-surface.json` fixture

**Files:**
- Create: `examples/chat/aimock-e2e/fixtures/a2ui-surface.json`

- [ ] **Step 1: Write the fixture**

Write `examples/chat/aimock-e2e/fixtures/a2ui-surface.json`. **Adapt the `match` shape to whatever Task 0 verified worked.** The contents below use `userMessage`; if Task 0 found `toolName` is required, use that instead.

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "show me a tiny surface" },
      "response": {
        "toolCalls": [
          {
            "name": "render_a2ui_surface",
            "arguments": {
              "envelopes": [
                {
                  "surfaceUpdate": {
                    "surfaceId": "s1",
                    "components": [
                      {
                        "id": "root",
                        "component": {
                          "Text": { "text": { "literalString": "Hello from the mock!" } }
                        }
                      }
                    ]
                  }
                },
                { "beginRendering": { "surfaceId": "s1", "root": "root" } }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

- [ ] **Step 2: Commit Task 1**

```bash
cd /tmp/aimock-2c
git add examples/chat/aimock-e2e/fixtures/a2ui-surface.json
git commit -m "feat(examples-chat): add a2ui surface fixture"
```

---

## Task 2: Add the `a2ui-single-bubble.spec.ts` Playwright spec

**Files:**
- Create: `examples/chat/aimock-e2e/a2ui-single-bubble.spec.ts`

- [ ] **Step 1: Write the spec**

Write `examples/chat/aimock-e2e/a2ui-single-bubble.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test('a2ui single bubble: one assistant bubble carries tool_calls + rendered surface', async ({ page }) => {
  await page.goto('/embed');

  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill('show me a tiny surface');
  await page.getByRole('button', { name: /send/i }).click();

  // Surface element appears inside the conversation.
  const surface = page.locator('a2ui-surface');
  await expect(surface).toBeVisible({ timeout: 30_000 });
  await expect(surface).toContainText('Hello from the mock!');

  // Single-bubble invariant: count assistant messages once the surface is mounted.
  // Skeleton bubbles (chat-genui-skeleton) must NOT exist as separate <chat-message>.
  const assistantBubbles = page.locator('chat-message').filter({
    has: page.locator('a2ui-surface, chat-streaming-md, [data-role="assistant"]'),
  });
  await expect(assistantBubbles).toHaveCount(1);

  // No standalone skeleton in the DOM after the turn.
  await expect(page.locator('chat-genui-skeleton')).toHaveCount(0);
});
```

**Note on the assistantBubbles selector:** The filter targets `<chat-message>` elements that contain at least one of: an `<a2ui-surface>` (the GenUI bubble), a `<chat-streaming-md>` (the markdown bubble), or any element marked `data-role="assistant"` (defensive — if the chat composition uses a role attribute elsewhere). If the actual class/structure differs, adjust the selector — but it MUST result in `toHaveCount(1)` for the single-bubble invariant. Do not loosen the count assertion.

- [ ] **Step 2: Run the spec**

```bash
cd /tmp/aimock-2c
npx playwright install --with-deps chromium
cd examples/chat/python
uv sync
cd /tmp/aimock-2c/examples/chat/aimock-e2e
npx playwright test a2ui-single-bubble.spec.ts
```

Expected: 1 test passes. Wall-clock ~60–120s.

If it fails with surface not visible: the agent flow may need additional triggers (e.g., a Gen UI mode setting in the palette). Check the existing smoke spec's flow — it just sends a prompt; A2UI is the default Gen UI mode per the smoke checklist, so no palette change should be needed. Report the failure and the trace.

If it fails with `toHaveCount(2)`: this is a real regression in the single-bubble behavior (PR #297). Capture the trace, DO NOT modify the test — this is precisely the regression Phase 2c exists to catch.

- [ ] **Step 3: Run the full Playwright suite**

```bash
cd /tmp/aimock-2c/examples/chat/aimock-e2e
npx playwright test
```

Expected: 5 tests pass (1 smoke + 3 markdown + 1 a2ui-single-bubble).

- [ ] **Step 4: Commit Task 2**

```bash
cd /tmp/aimock-2c
git add examples/chat/aimock-e2e/a2ui-single-bubble.spec.ts
git commit -m "test(examples-chat): A2UI single-bubble invariant aimock scenario"
```

---

## Self-review checklist

- [x] Task 0 de-risk runs before any committed code lands.
- [x] Single-bubble invariant assertion uses `toHaveCount(1)` against a filtered selector — not a brittle CSS selector.
- [x] Skeleton-bubble residue assertion (`chat-genui-skeleton` count 0) lives alongside the single-bubble assertion.
- [x] Existing Phase 2a + 2b specs still pass (smoke + 3 markdown).
- [x] No production code touched.
- [x] Fixture content is exact; assertions must match it without mutation.
- [x] aimock library name appears only in fixture/source TS imports and plan/spec/README contexts (established in Phase 2a/2b).
