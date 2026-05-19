# aimock scaffold generator + helper consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `scripts/generate-aimock-scaffold.ts` (single-cap throwaway generator) and consolidate the duplicate submit-and-wait helpers in `libs/e2e-harness/`.

**Architecture:** Generator reads the TS capability-registry (via `tsx`'s native TS support), composes 5 e2e/ files from string templates with substitutions, edits the cap's `project.json` via JSON parse/serialize, and inserts a matrix entry into `.github/workflows/ci.yml` via regex-located insertion with YAML reparse verification. Helper consolidation is mechanical migration of 3 specs from `sendPromptAndWait` to `submitAndWaitForResponse` followed by deletion of the old helper.

**Tech Stack:** TypeScript + `tsx` runner, Node fs/path, `js-yaml` (already in repo deps) for ci.yml validation.

---

## File Structure

**Create (1 file):**
- `scripts/generate-aimock-scaffold.ts` — throwaway generator (~250 LOC).

**Modify (5 files):**
- `cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts` — swap import + call.
- `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts` — swap import + call.
- `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts` — swap import + call.
- `libs/e2e-harness/src/test-helpers.ts` — delete `sendPromptAndWait` + `SendPromptAndWaitOptions`.
- `libs/e2e-harness/src/index.ts` — remove the two from re-exports.

---

### Task 1: Migrate streaming.spec.ts

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts`

- [ ] **Step 1: Read the current spec**

Current content (verified):
```typescript
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';

test('streaming: assistant text from the mocked LLM renders in the cockpit chat composition', async ({ page }) => {
  const bubble = await sendPromptAndWait(
    page,
    'Tell me one quick fact about Angular signals in two sentences.',
  );
  // ...
```

- [ ] **Step 2: Swap import and call**

Edit `cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts`:

Replace:
```typescript
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';
```
with:
```typescript
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';
```

Replace:
```typescript
  const bubble = await sendPromptAndWait(
    page,
    'Tell me one quick fact about Angular signals in two sentences.',
  );
```
with:
```typescript
  const bubble = await submitAndWaitForResponse(
    page,
    'Tell me one quick fact about Angular signals in two sentences.',
  );
```

- [ ] **Step 3: Verify**

```bash
cd /tmp/aimock-scaffold-gen && grep -c 'sendPromptAndWait' cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts
```
Expected: `0`.

```bash
cd /tmp/aimock-scaffold-gen && grep -c 'submitAndWaitForResponse' cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts
```
Expected: `2` (one import, one call).

---

### Task 2: Migrate c-tool-calls.spec.ts

**Files:**
- Modify: `cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts`

- [ ] **Step 1: Swap import and call**

Replace the import line:
```typescript
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';
```
with:
```typescript
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';
```

Replace the single call site:
```typescript
  const bubble = await sendPromptAndWait(page, PROMPT);
```
with:
```typescript
  const bubble = await submitAndWaitForResponse(page, PROMPT);
```

- [ ] **Step 2: Verify**

```bash
cd /tmp/aimock-scaffold-gen && \
  grep -c 'sendPromptAndWait' cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts && \
  grep -c 'submitAndWaitForResponse' cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts
```
Expected: `0` then `2`.

---

### Task 3: Migrate c-subagents.spec.ts

**Files:**
- Modify: `cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts`

- [ ] **Step 1: Swap import and call**

Replace the import line:
```typescript
import { sendPromptAndWait } from '../../../../../libs/e2e-harness/src';
```
with:
```typescript
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';
```

Replace the single call site:
```typescript
  const bubble = await sendPromptAndWait(page, PROMPT);
```
with:
```typescript
  const bubble = await submitAndWaitForResponse(page, PROMPT);
```

The spec contains a comment block referencing `sendPromptAndWait` in prose:
```typescript
  // complete (which is the state sendPromptAndWait returns at, since the
```

Update that comment to:
```typescript
  // complete (which is the state submitAndWaitForResponse returns at, since the
```

- [ ] **Step 2: Verify**

```bash
cd /tmp/aimock-scaffold-gen && \
  grep -c 'sendPromptAndWait' cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts && \
  grep -c 'submitAndWaitForResponse' cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts
```
Expected: `0` then `3` (import + call + comment mention).

---

### Task 4: Remove `sendPromptAndWait` from test-helpers.ts

**Files:**
- Modify: `libs/e2e-harness/src/test-helpers.ts`

Current shape (lines verified):
- Lines 4-7: `SendPromptAndWaitOptions` interface — DELETE.
- Lines 10-20: docstring for `sendPromptAndWait` — DELETE.
- Lines 21-57: `sendPromptAndWait` function — DELETE.
- Lines 60-onwards: `sendPromptAndWaitForInterrupt`, `clickInterruptActionAndWaitFinal`, `submitAndWaitForResponse` — KEEP.

- [ ] **Step 1: Delete the interface and function**

Edit `libs/e2e-harness/src/test-helpers.ts`. Remove:

```typescript
export interface SendPromptAndWaitOptions {
  /** Route to navigate to before sending the prompt. Default: '/'. */
  path?: string;
}
```

And remove the entire `sendPromptAndWait` function body (everything from `/**\n * Send a user prompt and wait for the assistant bubble to finalize.` through the closing `}` of the function — including the docstring above it).

After this edit, the file should still start with `// SPDX-License-Identifier: MIT` + the `@playwright/test` import, then jump directly to the next surviving export (`sendPromptAndWaitForInterrupt`).

- [ ] **Step 2: Verify**

```bash
cd /tmp/aimock-scaffold-gen && \
  echo "=== sendPromptAndWait (should be 0) ===" && \
  grep -c '\bsendPromptAndWait\b' libs/e2e-harness/src/test-helpers.ts && \
  echo "=== SendPromptAndWaitOptions (should be 0) ===" && \
  grep -c 'SendPromptAndWaitOptions' libs/e2e-harness/src/test-helpers.ts && \
  echo "=== sendPromptAndWaitForInterrupt (should be 1) ===" && \
  grep -c 'sendPromptAndWaitForInterrupt' libs/e2e-harness/src/test-helpers.ts && \
  echo "=== submitAndWaitForResponse (should be 1) ===" && \
  grep -c 'submitAndWaitForResponse' libs/e2e-harness/src/test-helpers.ts
```

Expected: `0, 0, 1, 1`.

- [ ] **Step 3: Typecheck the harness**

```bash
cd /tmp/aimock-scaffold-gen && npx tsc --noEmit libs/e2e-harness/src/test-helpers.ts --module ESNext --target ES2022 --moduleResolution Bundler --strict --esModuleInterop --skipLibCheck --types node 2>&1 | tail -5
```
Expected: clean.

---

### Task 5: Remove from libs/e2e-harness/src/index.ts re-exports

**Files:**
- Modify: `libs/e2e-harness/src/index.ts`

Current content:
```typescript
// SPDX-License-Identifier: MIT
export { startAimock, type AimockHandle, type AimockStartOptions } from './aimock-runner';
export {
  sendPromptAndWait,
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
  submitAndWaitForResponse,
  type SendPromptAndWaitOptions,
} from './test-helpers';
export { createGlobalSetup, type CreateGlobalSetupOpts } from './global-setup-factory';
```

- [ ] **Step 1: Remove `sendPromptAndWait` and `SendPromptAndWaitOptions`**

Edit `libs/e2e-harness/src/index.ts`. Replace the test-helpers export block with:

```typescript
export {
  sendPromptAndWaitForInterrupt,
  clickInterruptActionAndWaitFinal,
  submitAndWaitForResponse,
} from './test-helpers';
```

- [ ] **Step 2: Verify**

```bash
cd /tmp/aimock-scaffold-gen && \
  echo "=== sendPromptAndWait\\b in index.ts (should be 0) ===" && \
  grep -c '\bsendPromptAndWait\b' libs/e2e-harness/src/index.ts && \
  echo "=== global grep across cockpit + libs (should be 0) ===" && \
  grep -rn '\bsendPromptAndWait\b' cockpit libs 2>&1 | grep -v 'sendPromptAndWaitForInterrupt' | wc -l | tr -d ' '
```

Expected: `0` and `0`.

(The global check verifies migrations in Tasks 1-3 + the harness deletion all stuck together.)

---

### Task 6: Create the generator script

**Files:**
- Create: `scripts/generate-aimock-scaffold.ts`

- [ ] **Step 1: Write the generator**

Create `scripts/generate-aimock-scaffold.ts`:

```typescript
#!/usr/bin/env -S npx tsx
// SPDX-License-Identifier: MIT
//
// Throwaway aimock scaffold generator.
// Usage: npx tsx scripts/generate-aimock-scaffold.ts --cap <id>
//
// For a cap in apps/cockpit/scripts/capability-registry.ts with a pythonDir,
// creates the per-cap aimock e2e directory under
// cockpit/<product>/<topic>/angular/e2e/ (5 files), adds the e2e Nx target
// to cockpit/<product>/<topic>/angular/project.json, and appends a matrix
// entry to the cockpit-e2e job in .github/workflows/ci.yml.
//
// All-or-nothing: validates every precondition before writing anything.
// Refuses on any pre-existing target. Delete after the Task #4 batch lands.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { capabilities, type Capability } from '../apps/cockpit/scripts/capability-registry';

const REPO_ROOT = resolve(__dirname, '..');

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(): { capId: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--cap');
  if (idx === -1 || idx === args.length - 1) {
    die('--cap <id> is required. Example: npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages');
  }
  const capId = args[idx + 1]!;
  if (!capId) die('--cap value cannot be empty');
  return { capId };
}

function findCap(capId: string): Capability {
  const cap = capabilities.find((c) => c.id === capId);
  if (!cap) die(`cap "${capId}" not found in apps/cockpit/scripts/capability-registry.ts`);
  if (!cap.pythonDir) die(`cap "${capId}" has no pythonDir (in-process cap not eligible for aimock e2e)`);
  if (cap.pythonPort === undefined) die(`cap "${capId}" has no pythonPort`);
  return cap;
}

function playwrightConfig(port: number): string {
  return `// SPDX-License-Identifier: MIT
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:${port}',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup-impl.ts',
  globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
});
`;
}

function globalSetupImpl(cap: Capability): string {
  return `// SPDX-License-Identifier: MIT
import { resolve } from 'node:path';
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';

export default createGlobalSetup({
  langgraphCwd: '${cap.pythonDir}',
  langgraphPort: ${cap.pythonPort},
  angularProject: '${cap.angularProject}',
  angularPort: ${cap.port},
  fixturesDir: resolve(__dirname, 'fixtures'),
});
`;
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
`;

function fixtureSkeleton(): string {
  return `{
  "fixtures": [
    {
      "match": { "userMessage": "TODO-prompt" },
      "response": { "content": "TODO-response" }
    }
  ]
}
`;
}

function specSkeleton(capId: string): string {
  return `// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { submitAndWaitForResponse } from '../../../../../libs/e2e-harness/src';

test('${capId}: TODO — describe behavior', async ({ page }) => {
  const bubble = await submitAndWaitForResponse(page, 'TODO-prompt');
  await expect(bubble).toContainText('TODO-substring');
});
`;
}

function e2eTargetEntry(cap: Capability): Record<string, unknown> {
  return {
    executor: '@nx/playwright:playwright',
    options: {
      config: \`cockpit/\${cap.product}/\${cap.topic}/angular/e2e/playwright.config.ts\`,
    },
  };
}

function validateAndPlan(cap: Capability): {
  e2eDir: string;
  files: Record<string, string>;
  projectJsonPath: string;
  projectJson: Record<string, any>;
  ciYmlPath: string;
  ciYmlBefore: string;
  ciYmlAfter: string;
} {
  const e2eDir = resolve(REPO_ROOT, \`cockpit/\${cap.product}/\${cap.topic}/angular/e2e\`);

  const files: Record<string, string> = {
    [\`\${e2eDir}/playwright.config.ts\`]: playwrightConfig(cap.port),
    [\`\${e2eDir}/global-setup-impl.ts\`]: globalSetupImpl(cap),
    [\`\${e2eDir}/tsconfig.json\`]: TSCONFIG,
    [\`\${e2eDir}/fixtures/\${cap.id}.json\`]: fixtureSkeleton(),
    [\`\${e2eDir}/\${cap.id}.spec.ts\`]: specSkeleton(cap.id),
  };

  for (const path of Object.keys(files)) {
    if (existsSync(path)) die(\`\${path} already exists; refusing to overwrite\`);
  }

  const projectJsonPath = resolve(REPO_ROOT, \`cockpit/\${cap.product}/\${cap.topic}/angular/project.json\`);
  if (!existsSync(projectJsonPath)) die(\`\${projectJsonPath} does not exist\`);
  const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
  if (projectJson.targets?.e2e) {
    die(\`project.json already has an e2e target for \${cap.angularProject}\`);
  }

  const ciYmlPath = resolve(REPO_ROOT, '.github/workflows/ci.yml');
  if (!existsSync(ciYmlPath)) die(\`\${ciYmlPath} does not exist\`);
  const ciYmlBefore = readFileSync(ciYmlPath, 'utf8');
  if (ciYmlBefore.includes(\`{ angular: \${cap.angularProject},\`)) {
    die(\`ci.yml matrix already contains entry for \${cap.angularProject}\`);
  }

  // Locate the last existing matrix entry and insert the new one after it.
  // Match indentation of existing lines: 10 spaces + "- { angular: ..."
  const matrixEntryRegex = /^(\\s+- \\{ angular: cockpit-[^}]+\\})\\s*$/gm;
  const matches = [...ciYmlBefore.matchAll(matrixEntryRegex)];
  if (matches.length === 0) {
    die('ci.yml does not contain a recognizable matrix.cap entry to insert after');
  }
  const lastMatch = matches[matches.length - 1]!;
  const insertAt = lastMatch.index! + lastMatch[0].length;

  // Use the existing entry's indentation. Find the leading spaces from lastMatch[1].
  const indent = lastMatch[1].match(/^(\\s+)-/)?.[1] ?? '          ';

  // Pad the cap fields so columns line up roughly with existing entries.
  const angularField = \`angular: \${cap.angularProject},\`;
  const paddedAngular = angularField.padEnd(48);
  const newEntry = \`\\n\${indent}- { \${paddedAngular} python: \${cap.pythonDir} }\`;

  const ciYmlAfter = ciYmlBefore.slice(0, insertAt) + newEntry + ciYmlBefore.slice(insertAt);

  // Verify the result still parses as YAML before committing to write.
  // We require yaml validation to catch unexpected formatting issues.
  // Note: js-yaml is a transitive dep via several repo packages.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml');
  try {
    yaml.load(ciYmlAfter);
  } catch (err) {
    die(\`generated ci.yml fails YAML parse: \${(err as Error).message}\`);
  }

  return { e2eDir, files, projectJsonPath, projectJson, ciYmlPath, ciYmlBefore, ciYmlAfter };
}

function applyPlan(plan: ReturnType<typeof validateAndPlan>, cap: Capability): void {
  // Create directories.
  mkdirSync(plan.e2eDir, { recursive: true });
  mkdirSync(\`\${plan.e2eDir}/fixtures\`, { recursive: true });

  // Write each file.
  for (const [path, content] of Object.entries(plan.files)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(\`  + \${path.slice(REPO_ROOT.length + 1)}\`);
  }

  // Update project.json.
  plan.projectJson.targets = { ...plan.projectJson.targets, e2e: e2eTargetEntry(cap) };
  writeFileSync(plan.projectJsonPath, JSON.stringify(plan.projectJson, null, 2) + '\\n');
  console.log(\`  ~ \${plan.projectJsonPath.slice(REPO_ROOT.length + 1)} (added e2e target)\`);

  // Update ci.yml.
  writeFileSync(plan.ciYmlPath, plan.ciYmlAfter);
  console.log(\`  ~ \${plan.ciYmlPath.slice(REPO_ROOT.length + 1)} (added matrix entry)\`);
}

function main(): void {
  const { capId } = parseArgs();
  const cap = findCap(capId);
  console.log(\`Scaffolding aimock e2e for \${cap.id} (\${cap.angularProject})…\`);
  const plan = validateAndPlan(cap);
  applyPlan(plan, cap);
  console.log(\`Done. Next: hand-author cockpit/\${cap.product}/\${cap.topic}/angular/e2e/fixtures/\${cap.id}.json and \${cap.id}.spec.ts.\`);
}

main();
```

- [ ] **Step 2: Verify the script parses and shows help-ish behavior on missing args**

```bash
cd /tmp/aimock-scaffold-gen && npx tsx scripts/generate-aimock-scaffold.ts 2>&1 | head -3
```
Expected: `Error: --cap <id> is required. ...` and exit code 1.

```bash
cd /tmp/aimock-scaffold-gen && npx tsx scripts/generate-aimock-scaffold.ts --cap nonexistent 2>&1 | head -3
```
Expected: `Error: cap "nonexistent" not found in apps/cockpit/scripts/capability-registry.ts`.

```bash
cd /tmp/aimock-scaffold-gen && npx tsx scripts/generate-aimock-scaffold.ts --cap ag-ui-streaming 2>&1 | head -3
```
Expected: `Error: cap "ag-ui-streaming" has no pythonDir (in-process cap not eligible for aimock e2e)`.

- [ ] **Step 3: Verify generation against a real cap (c-messages)**

Note: c-messages was the pilot in PR #462 (closed). Generating its e2e/ should succeed since the worktree's main branch doesn't have the e2e/ files (PR #462 was unmerged).

```bash
cd /tmp/aimock-scaffold-gen && npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages 2>&1 | head -15
```

Expected output approximately:
```
Scaffolding aimock e2e for c-messages (cockpit-chat-messages-angular)…
  + cockpit/chat/messages/angular/e2e/playwright.config.ts
  + cockpit/chat/messages/angular/e2e/global-setup-impl.ts
  + cockpit/chat/messages/angular/e2e/tsconfig.json
  + cockpit/chat/messages/angular/e2e/fixtures/c-messages.json
  + cockpit/chat/messages/angular/e2e/c-messages.spec.ts
  ~ cockpit/chat/messages/angular/project.json (added e2e target)
  ~ .github/workflows/ci.yml (added matrix entry)
Done. Next: hand-author cockpit/chat/messages/angular/e2e/fixtures/c-messages.json and c-messages.spec.ts.
```

Then verify each generated file makes sense:

```bash
cd /tmp/aimock-scaffold-gen && \
  grep 'baseURL' cockpit/chat/messages/angular/e2e/playwright.config.ts && \
  grep 'langgraphPort' cockpit/chat/messages/angular/e2e/global-setup-impl.ts && \
  grep '{ angular: cockpit-chat-messages-angular' .github/workflows/ci.yml
```

Expected:
```
    baseURL: 'http://localhost:4501',
  langgraphPort: 5501,
          - { angular: cockpit-chat-messages-angular,    python: cockpit/chat/messages/python }
```

- [ ] **Step 4: Verify idempotent failure on re-run**

```bash
cd /tmp/aimock-scaffold-gen && npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages 2>&1 | head -3
```
Expected: `Error: ... already exists; refusing to overwrite` and exit code 1. ci.yml and project.json unmodified by the second run.

- [ ] **Step 5: REVERT the c-messages generation (proof-only)**

The c-messages scaffold is the proof that the generator works. We do NOT ship it in this PR (that's Task #4's re-pilot). Revert:

```bash
cd /tmp/aimock-scaffold-gen && \
  rm -rf cockpit/chat/messages/angular/e2e/ && \
  git checkout cockpit/chat/messages/angular/project.json && \
  git checkout .github/workflows/ci.yml
```

Recreate the `manual/` subdirectory that existed before (it's empty in the worktree but tracked in git? — let's verify):

```bash
cd /tmp/aimock-scaffold-gen && git status cockpit/chat/messages/angular/
```

If the manual/ contents reappeared via `git checkout`, fine. Otherwise no action needed — the original tree had `cockpit/chat/messages/angular/e2e/manual/messages.manual.ts` per the earlier survey; restore it if it was wiped:

```bash
cd /tmp/aimock-scaffold-gen && git checkout cockpit/chat/messages/angular/e2e/ 2>/dev/null || true
```

Final verification — no leftover gen artifacts:

```bash
cd /tmp/aimock-scaffold-gen && git status --short
```

Expected: only the planned files modified — the 3 cap specs, the 2 harness files, and the new generator script. Plus the spec + plan files committed earlier.

---

### Task 7: Stage + commit + push + open PR

**Files:** none new in this task; git plumbing only.

- [ ] **Step 1: Stage and review**

```bash
cd /tmp/aimock-scaffold-gen && git add \
  scripts/generate-aimock-scaffold.ts \
  cockpit/langgraph/streaming/angular/e2e/streaming.spec.ts \
  cockpit/chat/tool-calls/angular/e2e/c-tool-calls.spec.ts \
  cockpit/chat/subagents/angular/e2e/c-subagents.spec.ts \
  libs/e2e-harness/src/test-helpers.ts \
  libs/e2e-harness/src/index.ts && \
  git diff --cached --stat
```

Expected: 6 files. New: scripts/generate-aimock-scaffold.ts. Modified: 3 cap specs, 2 harness files.

- [ ] **Step 2: Commit**

```bash
cd /tmp/aimock-scaffold-gen && git commit -m "$(cat <<'EOF'
feat: aimock scaffold generator + helper consolidation

Ships scripts/generate-aimock-scaffold.ts — a single-cap throwaway
generator that reads apps/cockpit/scripts/capability-registry.ts and
emits a cap's e2e/ directory (5 files) plus the project.json e2e
target plus a ci.yml matrix entry. Validates all preconditions before
writing; refuses on any pre-existing target. Unblocks Task #4 batch.

Consolidates the duplicate submit-and-wait helpers:
- Migrate streaming.spec.ts, c-tool-calls.spec.ts, c-subagents.spec.ts
  from sendPromptAndWait → submitAndWaitForResponse (mechanical swap;
  semantically equivalent for composed-<chat> caps).
- Remove sendPromptAndWait + SendPromptAndWaitOptions from
  libs/e2e-harness/src/{test-helpers,index}.ts.
- Keep sendPromptAndWaitForInterrupt + clickInterruptActionAndWaitFinal
  (interrupt-flow specific; c-interrupts depends on them).

After this PR, batching the 7 chat caps in Task #4 is mechanical:
run the generator per cap → hand-author fixture + spec assertions.

Note: examples/chat/angular/e2e/test-helpers.ts has its own local
sendPromptAndWait — left untouched (separate ownership boundary;
follow-up task if consolidation desired).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

```bash
cd /tmp/aimock-scaffold-gen && git push -u origin claude/aimock-scaffold-gen 2>&1 | tail -3
```

- [ ] **Step 4: Open PR**

```bash
cd /tmp/aimock-scaffold-gen && gh pr create \
  --title "feat: aimock scaffold generator + helper consolidation (Task #15)" \
  --body "$(cat <<'EOF'
## Summary
- Adds \`scripts/generate-aimock-scaffold.ts\` — single-cap throwaway generator. \`npx tsx scripts/generate-aimock-scaffold.ts --cap <id>\` reads the registry, emits 5 e2e/ files, adds the e2e Nx target to \`project.json\`, and appends a matrix entry to \`.github/workflows/ci.yml\`.
- Consolidates the duplicate submit-and-wait helpers in \`libs/e2e-harness/src/\`. Migrates 3 cap specs (\`streaming\`, \`c-tool-calls\`, \`c-subagents\`) from \`sendPromptAndWait\` to \`submitAndWaitForResponse\`. Removes \`sendPromptAndWait\` from the harness.
- All-or-nothing generator semantics: validates every precondition (missing cap, no pythonDir, pre-existing files, pre-existing project.json target, pre-existing ci.yml matrix entry) before writing.

## Wins
- Task #4 batching becomes: \`generator --cap c-input\` → fixture + spec assertions → commit. No copy-paste from c-interrupts each time.
- One canonical submit-and-wait helper in the harness instead of two leaky-vs-durable variants.

## Files
- New: \`scripts/generate-aimock-scaffold.ts\`.
- Modified: 3 cap specs (find/replace import + call), 2 harness files (delete \`sendPromptAndWait\` + \`SendPromptAndWaitOptions\`).

## Test plan
- [ ] CI \`Cockpit — e2e\` matrix passes (4 expansions) — migrated specs still pass.
- [ ] CI \`Cockpit — build / test\` passes.
- [ ] \`git grep 'sendPromptAndWait\\b' cockpit libs\` returns nothing.
- [ ] Manual: \`npx tsx scripts/generate-aimock-scaffold.ts --cap c-messages\` writes the expected files, then refuses on re-run.

## Follow-ups (out of scope)
- Task #4: re-pilot c-messages aimock using the generator.
- Task #4 batch: 7 chat caps via the generator.
- Delete the generator after the batch lands.
- Consolidate \`examples/chat/angular/e2e/test-helpers.ts\`'s local \`sendPromptAndWait\` with the harness's \`submitAndWaitForResponse\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan task |
|---|---|
| Generator CLI `--cap <id>` | Task 6 Step 1 |
| Generator reads registry, validates pythonDir | Task 6 Step 1 (`findCap`) |
| Generator creates 5 e2e/ files | Task 6 Step 1 (`files` map) |
| Generator edits project.json (e2e target) | Task 6 Step 1 (`e2eTargetEntry`) |
| Generator edits ci.yml (matrix entry) | Task 6 Step 1 (regex insertion + yaml reparse) |
| Generator refuses on any pre-existing target | Task 6 Step 1 (`validateAndPlan` checks) |
| Generator refuses unknown cap / no-pythonDir | Task 6 Step 1 (`findCap`) |
| Generator: no partial writes | Task 6 Step 1 (validate-then-apply split) |
| Migrate 3 cap specs to submitAndWaitForResponse | Tasks 1, 2, 3 |
| Remove sendPromptAndWait + SendPromptAndWaitOptions from test-helpers.ts | Task 4 |
| Remove from index.ts re-exports | Task 5 |
| Keep interrupt-flow helpers | Task 4 (KEEP section) |
| `git grep 'sendPromptAndWait\b' cockpit libs` returns nothing | Task 5 Step 2 |
| Final commit + PR | Task 7 |

**Placeholder scan:** searched for "TBD", "TODO", "fill in", "similar to". The generator emits literal `TODO-prompt` / `TODO-response` / `TODO-substring` strings in the SKELETON content — that's intentional (callers hand-author them later). No TBDs in the plan itself.

**Type consistency:**
- The `Capability` interface used by the generator imports from `apps/cockpit/scripts/capability-registry`. Verified the interface has `id`, `product`, `topic`, `angularProject`, `port`, `pythonPort`, `pythonDir`, `graphName`.
- All path templates use forward slashes consistently.
- The generator's `e2eTargetEntry` matches the shape produced by hand for c-interrupts (verified in earlier session work).
- `submitAndWaitForResponse` exists in `libs/e2e-harness/src/index.ts` (added in PR #469); the spec skeleton's import path is correct relative to a cap-level e2e/ dir (5 `../`s up to repo root then `libs/...`).

Inline ambiguity resolved: Task 6 Step 5 (revert c-messages generation) was a real risk — the proof-of-generator step generates real files; we MUST revert before committing. The step is explicit about reverting via `git checkout` for tracked files + `rm -rf` for the newly-created e2e/ tree.
