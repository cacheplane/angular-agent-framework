# aimock E2E — Phase 2b: structured-markdown scenarios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add three Playwright scenarios that exercise structured markdown rendering (heading, code fence, list) through the aimock E2E harness landed in Phase 2a.

**Architecture:** Extend `aimock-runner.ts` to load all `.json` fixture files in a directory (each contains one or more match/response entries; the runner merges them and registers every entry with the mock). One harness boot serves N specs — no per-spec re-spin. The existing single-file mode keeps working.

**Tech Stack:** `@copilotkit/aimock`, Playwright, vitest.

**Sits on:** Phase 2a ([#309](https://github.com/cacheplane/angular-agent-framework/pull/309)) — the harness, the `hi.json` fixture, the `examples/chat — aimock e2e` per-PR job.

---

## Working environment

- Worktree: `/tmp/aimock-2b` (branch `claude/aimock-markdown-scenarios`).
- `node_modules` symlinked from main checkout; `npx` works directly.
- License header `// SPDX-License-Identifier: MIT` on line 1 of every new TS file.
- One commit per task. DO NOT push, amend, or `git add -A`.

---

## Task 1: Extend `aimock-runner.ts` to support directory mode

**Files:**
- Modify: `examples/chat/aimock-e2e/aimock-runner.ts`
- Modify: `examples/chat/aimock-e2e/aimock-runner.spec.ts`

- [ ] **Step 1: Update the runner**

Replace the contents of `examples/chat/aimock-e2e/aimock-runner.ts` with:

```typescript
// SPDX-License-Identifier: MIT
import { LLMock } from '@copilotkit/aimock';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface AimockHandle {
  /** Port the mock server is listening on. */
  readonly port: number;
  /** Full base URL the OpenAI SDK should target (includes /v1 suffix). */
  readonly baseUrl: string;
  /** Tear down the server. Safe to call multiple times. */
  stop(): Promise<void>;
}

export interface AimockStartOptions {
  mode: 'replay';
  /** Path to a single fixture file OR a directory of fixture files. */
  fixturePath: string;
}

interface FixtureFile {
  fixtures: ReadonlyArray<{
    match: { userMessage: string };
    response: { content: string };
  }>;
}

function loadFixtureEntries(fixturePath: string): FixtureFile['fixtures'] {
  const stats = statSync(fixturePath);
  if (stats.isDirectory()) {
    const merged: FixtureFile['fixtures'][number][] = [];
    const files = readdirSync(fixturePath)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const file of files) {
      const raw = readFileSync(join(fixturePath, file), 'utf-8');
      const parsed = JSON.parse(raw) as FixtureFile;
      for (const fx of parsed.fixtures) merged.push(fx);
    }
    return merged;
  }
  const raw = readFileSync(fixturePath, 'utf-8');
  const parsed = JSON.parse(raw) as FixtureFile;
  return parsed.fixtures;
}

export async function startAimock(opts: AimockStartOptions): Promise<AimockHandle> {
  const entries = loadFixtureEntries(opts.fixturePath);

  const mock = new LLMock({ port: 0 });
  for (const fx of entries) {
    mock.onMessage(fx.match.userMessage, fx.response);
  }
  await mock.start();

  const port = mock.port;
  const baseUrl = `${mock.url}/v1`;
  let stopped = false;

  return {
    port,
    baseUrl,
    async stop() {
      if (stopped) return;
      stopped = true;
      await mock.stop();
    },
  };
}
```

- [ ] **Step 2: Extend the runner spec with a directory-mode test**

Add a third test to `examples/chat/aimock-e2e/aimock-runner.spec.ts` (do not remove or modify the existing two tests). Append this test inside the existing `describe('startAimock', ...)` block:

```typescript
  it('loads and merges all .json files in a directory', async () => {
    workDir = mkdtempSync(join(tmpdir(), 'aimock-test-'));
    writeFileSync(
      join(workDir, 'a.json'),
      JSON.stringify({
        fixtures: [{ match: { userMessage: 'one' }, response: { content: 'A' } }],
      }),
    );
    writeFileSync(
      join(workDir, 'b.json'),
      JSON.stringify({
        fixtures: [{ match: { userMessage: 'two' }, response: { content: 'B' } }],
      }),
    );
    // Non-JSON file in the dir should be ignored.
    writeFileSync(join(workDir, 'README.md'), '# not a fixture');

    handle = await startAimock({ mode: 'replay', fixturePath: workDir });
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/.+\/v1$/);
  });
```

- [ ] **Step 3: Run the runner tests**

```bash
cd /tmp/aimock-2b/examples/chat/aimock-e2e
npx vitest run aimock-runner.spec.ts
```

Expected: 3 passed.

If any test fails, STOP and report.

- [ ] **Step 4: Commit Task 1**

```bash
cd /tmp/aimock-2b
git add examples/chat/aimock-e2e/aimock-runner.ts \
        examples/chat/aimock-e2e/aimock-runner.spec.ts
git commit -m "feat(examples-chat): aimock-runner directory-of-fixtures mode"
```

---

## Task 2: Add the `markdown.json` fixture

**Files:**
- Create: `examples/chat/aimock-e2e/fixtures/markdown.json`

The three entries exercise heading rendering, code-fence rendering, and bullet-list rendering — three of the most common markdown structures that the LLM emits.

- [ ] **Step 1: Write the fixture**

Write `examples/chat/aimock-e2e/fixtures/markdown.json`:

```json
{
  "fixtures": [
    {
      "match": { "userMessage": "respond with a heading" },
      "response": { "content": "# Heading One\n\nA short paragraph below the heading." }
    },
    {
      "match": { "userMessage": "respond with a code fence" },
      "response": { "content": "Here's the snippet:\n\n```typescript\nconst answer = 42;\n```\n\nThat's it." }
    },
    {
      "match": { "userMessage": "respond with a bullet list" },
      "response": { "content": "Three things:\n\n- alpha\n- beta\n- gamma" }
    }
  ]
}
```

- [ ] **Step 2: Commit Task 2**

```bash
cd /tmp/aimock-2b
git add examples/chat/aimock-e2e/fixtures/markdown.json
git commit -m "feat(examples-chat): add markdown-scenarios fixture"
```

---

## Task 3: Switch global-setup default to directory mode

**Files:**
- Modify: `examples/chat/aimock-e2e/global-setup.ts`

- [ ] **Step 1: Update the FIXTURE_PATH default**

In `examples/chat/aimock-e2e/global-setup.ts`, find:

```typescript
const FIXTURE_PATH = process.env.AIMOCK_FIXTURE
  ? resolve(__dirname, process.env.AIMOCK_FIXTURE)
  : resolve(__dirname, 'fixtures/hi.json');
```

Replace with:

```typescript
const FIXTURE_PATH = process.env.AIMOCK_FIXTURE
  ? resolve(__dirname, process.env.AIMOCK_FIXTURE)
  : resolve(__dirname, 'fixtures');
```

(The `AIMOCK_FIXTURE` env var path keeps working for both file and directory targets.)

- [ ] **Step 2: Verify the smoke spec still passes**

```bash
cd /tmp/aimock-2b
npx playwright install --with-deps chromium
cd /tmp/aimock-2b/examples/chat/python
uv sync
cd /tmp/aimock-2b
npx nx run examples-chat-aimock-e2e:test -- smoke.spec.ts
```

Expected: 1 test passes (the existing Phase 2a smoke). Setup time ~60–120s.

If `nx run` with the test arg doesn't pass through to Playwright cleanly, run directly:

```bash
cd /tmp/aimock-2b/examples/chat/aimock-e2e
npx playwright test smoke.spec.ts
```

- [ ] **Step 3: Commit Task 3**

```bash
cd /tmp/aimock-2b
git add examples/chat/aimock-e2e/global-setup.ts
git commit -m "feat(examples-chat): default globalSetup to fixtures directory"
```

---

## Task 4: Add the `markdown.spec.ts` Playwright spec

**Files:**
- Create: `examples/chat/aimock-e2e/markdown.spec.ts`

Three tests, one per scenario. Each sends the matching prompt and asserts on the rendered DOM structure inside the assistant bubble.

- [ ] **Step 1: Write the spec**

Write `examples/chat/aimock-e2e/markdown.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { test, expect, type Locator } from '@playwright/test';

async function sendPrompt(page: Awaited<ReturnType<typeof import('@playwright/test').test.step>> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]['page'], prompt: string): Promise<Locator> {
  await page.goto('/embed');
  const input = page.getByRole('textbox', { name: /message|prompt/i });
  await input.fill(prompt);
  await page.getByRole('button', { name: /send/i }).click();

  const assistantBubble = page.locator('chat-message').filter({ hasNotText: prompt }).last();
  await expect(assistantBubble).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => ((await assistantBubble.innerText()) ?? '').trim().length, { timeout: 30_000 })
    .toBeGreaterThan(0);
  return assistantBubble;
}

test('heading: assistant bubble renders an <h1>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a heading');
  await expect(bubble.locator('h1')).toBeVisible();
  await expect(bubble.locator('h1')).toContainText(/heading one/i);
});

test('code fence: assistant bubble renders <pre><code>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a code fence');
  const codeBlock = bubble.locator('pre code');
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toContainText('const answer = 42');
});

test('bullet list: assistant bubble renders <ul> with three <li>', async ({ page }) => {
  const bubble = await sendPrompt(page, 'respond with a bullet list');
  const list = bubble.locator('ul');
  await expect(list).toBeVisible();
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li').nth(0)).toContainText('alpha');
  await expect(list.locator('li').nth(1)).toContainText('beta');
  await expect(list.locator('li').nth(2)).toContainText('gamma');
});
```

(The `sendPrompt` helper is intentionally defined in this file rather than extracted — Phase 2b keeps the diff scoped to this scenario set. If a Phase 2c spec also needs it, extract then.)

- [ ] **Step 2: Run the new spec**

```bash
cd /tmp/aimock-2b/examples/chat/aimock-e2e
npx playwright test markdown.spec.ts
```

Expected: 3 tests pass. Setup time ~60–120s (one harness boot serves all three).

If any test fails, STOP and report. Common failure modes:
- Heading not rendered → check the partial-markdown integration for headings in the smoke checklist.
- Code fence not rendered as `<pre><code>` → check the `mid-stream incomplete fenced code block` invariant (smoke checklist).
- List structure wrong → check existing `chat-streaming-md` markdown rendering tests.

Do NOT mutate the assertions to match observed output. The fixtures' content is exact; the rendered DOM should match.

- [ ] **Step 3: Run the full Playwright suite (smoke + new spec)**

```bash
cd /tmp/aimock-2b/examples/chat/aimock-e2e
npx playwright test
```

Expected: 4 tests pass total (1 smoke + 3 markdown).

- [ ] **Step 4: Commit Task 4**

```bash
cd /tmp/aimock-2b
git add examples/chat/aimock-e2e/markdown.spec.ts
git commit -m "test(examples-chat): structured-markdown aimock scenarios"
```

---

## Self-review checklist

- [x] Three structured-markdown scenarios covered (heading, code fence, bullet list).
- [x] Existing Phase 2a smoke spec still passes after the directory-mode switch.
- [x] No production code touched (only `examples/chat/aimock-e2e/`).
- [x] `AIMOCK_FIXTURE` env var still works for both file and directory paths.
- [x] No placeholders.
- [x] Type names consistent (`AimockHandle`, `AimockStartOptions`, `startAimock`).
- [x] aimock library name appears only in spec/plan/README/package.json contexts (already established in Phase 2a).
