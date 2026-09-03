# PR-side deploy verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the deploy job's Website and cockpit verification on pull requests against real Vercel preview deployments, with a working runtime iframe, so deploy-only failures surface before merge.

**Architecture:** Two new scope-gated CI jobs. `website-preview-e2e` assembles the examples with a deterministic Website alias in their parent-origin policy, deploys them as an examples preview under a deterministic alias, builds and deploys the Website as a preview pointed at that examples alias, and runs the ordinary Playwright suite against it. A Playwright global setup seeds the examples origin's protection-bypass cookie as storage state so the iframe loads. `cockpit-preview-smoke` deploys a throwaway cockpit preview and runs the 399-probe smoke against it. Both join the required gate; workflow-guard tests pin the shape.

**Tech Stack:** GitHub Actions, Vercel CLI (`pull`/`build`/`deploy`/`alias`), Playwright (`globalSetup`, `storageState`, `request`), vitest, `node:test` workflow guards.

**Spec:** `docs/superpowers/specs/2026-09-03-pr-side-deploy-verification-design.md`

**Conventions the engineer must know:**

- Website unit tests run from the repo root with `npx nx test website`, or targeted with `cd apps/website && npx vitest run <name>`. Do not pass `--root`; it breaks config paths. Running vitest from `apps/website` falsely fails `cockpit-retirement.spec.ts` (cwd-relative paths); ignore that file when running targeted, and confirm with `npx nx test website` before committing.
- Workflow guards run with `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never `echo` a secret. Pipe values into `gh secret set`.
- `dist/` is gitignored and never uploaded as a CI artifact; generated storage state goes to `dist/apps/website/e2e-runtime-bypass/storage-state.json`. (`apps/website/test-results/` is uploaded on failure by other lanes, so the bypass cookie must not live there.)

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/website/e2e/runtime-bypass-setup.ts` (new) | Playwright `globalSetup`: obtain the examples origin's `_vercel_jwt` bypass cookie and write storage state. Exports `buildRuntimeBypassUrl` and `RUNTIME_BYPASS_STORAGE_STATE`. |
| `apps/website/playwright.config.ts` (modify) | Register the setup and storage state only when `RUNTIME_BYPASS_ORIGIN` and `VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET` are both set. |
| `apps/website/src/playwright-config.spec.ts` (modify) | Unit tests for the conditional wiring. |
| `apps/website/src/runtime-bypass-setup.spec.ts` (new) | Unit tests for the URL builder and the early return. |
| `.github/workflows/ci.yml` (modify) | Add `cockpit-preview-smoke` and `website-preview-e2e` jobs; wire both into `required-pr-checks`. |
| `scripts/ci-workflow.spec.mjs` (modify) | Guards for both jobs and the gate wiring. |

---

### Task 1: Runtime bypass global setup (URL builder + early return)

**Files:**
- Create: `apps/website/e2e/runtime-bypass-setup.ts`
- Create: `apps/website/src/runtime-bypass-setup.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/website/src/runtime-bypass-setup.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import runtimeBypassSetup, {
  RUNTIME_BYPASS_STORAGE_STATE,
  buildRuntimeBypassUrl,
  seedRuntimeBypass,
} from '../e2e/runtime-bypass-setup';

describe('runtime bypass setup', () => {
  it('asks Vercel for the bypass cookie at the runtime origin root', () => {
    expect(
      buildRuntimeBypassUrl(
        'https://threadplane-examples-pr-7-cacheplane.vercel.app',
        'examples-secret'
      )
    ).toBe(
      'https://threadplane-examples-pr-7-cacheplane.vercel.app/?x-vercel-protection-bypass=examples-secret&x-vercel-set-bypass-cookie=true'
    );
  });

  it('rejects a runtime origin that is not a bare https origin', () => {
    for (const origin of [
      'http://threadplane-examples-pr-7-cacheplane.vercel.app',
      'https://threadplane-examples-pr-7-cacheplane.vercel.app/langgraph',
      'https://user:pw@threadplane-examples-pr-7-cacheplane.vercel.app',
    ]) {
      expect(() => buildRuntimeBypassUrl(origin, 'examples-secret')).toThrow(
        /bare https origin/
      );
    }
  });

  it('does nothing when the origin or the secret is unset', async () => {
    await expect(seedRuntimeBypass({})).resolves.toBe('skipped');
    await expect(
      seedRuntimeBypass({ RUNTIME_BYPASS_ORIGIN: 'https://x.vercel.app' })
    ).resolves.toBe('skipped');
    await expect(
      seedRuntimeBypass({ VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 's' })
    ).resolves.toBe('skipped');
  });

  it('ignores the config object Playwright hands to a global setup', async () => {
    // Playwright calls the default export with its FullConfig. Reading the
    // environment from that argument would silently skip the seeding.
    const saved = { ...process.env };
    delete process.env['RUNTIME_BYPASS_ORIGIN'];
    delete process.env['VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET'];
    try {
      await expect(
        runtimeBypassSetup({
          RUNTIME_BYPASS_ORIGIN: 'https://x.vercel.app',
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 's',
        } as never)
      ).resolves.toBe('skipped');
    } finally {
      process.env = saved;
    }
  });

  it('writes storage state under the gitignored test-results directory', () => {
    expect(RUNTIME_BYPASS_STORAGE_STATE).toMatch(
      /dist\/apps\/website\/e2e-runtime-bypass\/storage-state\.json$/
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/website && npx vitest run runtime-bypass-setup`
Expected: FAIL with `Failed to resolve import "../e2e/runtime-bypass-setup"`.

- [ ] **Step 3: Write the setup module**

Create `apps/website/e2e/runtime-bypass-setup.ts`:

```ts
import { request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Playwright globalSetup for runs whose Website preview embeds a runtime
 * from a second protected Vercel project. Deployment protection answers
 * every path on that origin with 302 -> vercel.com/sso-api, and Playwright's
 * extraHTTPHeaders is global, so the Website project's secret would reach
 * the runtime origin and be rejected. Vercel issues a per-origin `_vercel_jwt`
 * bypass cookie when a request carries the owning project's secret together
 * with `x-vercel-set-bypass-cookie=true`; this setup obtains that cookie once
 * and stores it as storage state, so every browser context carries it and
 * the runtime iframe and its subresources load. The examples secret travels
 * only in this one request.
 */
export const RUNTIME_BYPASS_STORAGE_STATE = resolve(
  __dirname,
  '..',
  'test-results',
  'runtime-bypass-storage-state.json'
);

type SetupEnvironment = Readonly<Record<string, string | undefined>>;

export function buildRuntimeBypassUrl(origin: string, secret: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`RUNTIME_BYPASS_ORIGIN must be a bare https origin, received ${origin}`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`RUNTIME_BYPASS_ORIGIN must be a bare https origin, received ${origin}`);
  }
  const url = new URL('/', parsed.origin);
  url.searchParams.set('x-vercel-protection-bypass', secret);
  url.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  return url.toString();
}

export async function seedRuntimeBypass(
  environment: SetupEnvironment
): Promise<'skipped' | 'seeded'> {
  const origin = environment['RUNTIME_BYPASS_ORIGIN'];
  const secret = environment['VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET'];
  if (!origin || !secret) return 'skipped';

  const context = await request.newContext();
  try {
    const response = await context.get(buildRuntimeBypassUrl(origin, secret), {
      maxRedirects: 0,
    });
    const state = await context.storageState();
    const seeded = state.cookies.some((cookie) => cookie.name === '_vercel_jwt');
    if (!seeded) {
      throw new Error(
        `Runtime bypass setup: ${origin} answered ${response.status()} without a _vercel_jwt cookie. Check VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET against the Vercel project that owns that origin.`
      );
    }
    mkdirSync(dirname(RUNTIME_BYPASS_STORAGE_STATE), { recursive: true });
    writeFileSync(RUNTIME_BYPASS_STORAGE_STATE, JSON.stringify(state));
    return 'seeded';
  } finally {
    await context.dispose();
  }
}

// Playwright calls globalSetup with its FullConfig as the only argument.
// Read the environment from the process, never from that argument.
export default async function runtimeBypassSetup(): Promise<'skipped' | 'seeded'> {
  return seedRuntimeBypass(process.env);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/website && npx vitest run runtime-bypass-setup`
Expected: `Tests  5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/e2e/runtime-bypass-setup.ts apps/website/src/runtime-bypass-setup.spec.ts
git commit -m "feat(website): playwright global setup that seeds the runtime origin bypass cookie

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Wire the setup into the Playwright config conditionally

**Files:**
- Modify: `apps/website/playwright.config.ts`
- Modify: `apps/website/src/playwright-config.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('Website Playwright configuration', ...)` block in `apps/website/src/playwright-config.spec.ts`, after the test named `'holds the runtime frame by its session params rather than the local host'`:

```ts
  it('seeds the runtime origin bypass only when both the origin and the examples secret are set', () => {
    const base = createWebsitePlaywrightConfig({
      BASE_URL: 'https://threadplane-pr-7-cacheplane.vercel.app',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'website-secret',
    });
    expect(base.globalSetup).toBeUndefined();
    expect(base.use?.storageState).toBeUndefined();

    const originOnly = createWebsitePlaywrightConfig({
      BASE_URL: 'https://threadplane-pr-7-cacheplane.vercel.app',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'website-secret',
      RUNTIME_BYPASS_ORIGIN: 'https://threadplane-examples-pr-7-cacheplane.vercel.app',
    });
    expect(originOnly.globalSetup).toBeUndefined();

    const both = createWebsitePlaywrightConfig({
      BASE_URL: 'https://threadplane-pr-7-cacheplane.vercel.app',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'website-secret',
      VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: 'examples-secret',
      RUNTIME_BYPASS_ORIGIN: 'https://threadplane-examples-pr-7-cacheplane.vercel.app',
    });
    expect(both.globalSetup).toMatch(/runtime-bypass-setup\.ts$/);
    expect(both.use?.storageState).toMatch(
      /dist\/apps\/website\/e2e-runtime-bypass\/storage-state\.json$/
    );
    // The examples secret must never ride the global header, which reaches
    // the Website origin on every request.
    expect(JSON.stringify(both.use?.extraHTTPHeaders)).not.toContain('examples-secret');
    expect(both.use?.extraHTTPHeaders).toEqual({
      'x-vercel-protection-bypass': 'website-secret',
      'x-vercel-set-bypass-cookie': 'true',
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/website && npx vitest run playwright-config`
Expected: 1 failed: `expected undefined to match /runtime-bypass-setup\.ts$/`.

- [ ] **Step 3: Implement the conditional wiring**

In `apps/website/playwright.config.ts`:

Add after the existing import line:

```ts
import { resolve } from 'node:path';
import { RUNTIME_BYPASS_STORAGE_STATE } from './e2e/runtime-bypass-setup';
```

Add after `const reuseExistingServer = ...;`:

```ts
  // A PR preview embeds its runtime from a second protected Vercel project.
  // extraHTTPHeaders is global, so that origin needs its own bypass, seeded
  // once as a cookie by e2e/runtime-bypass-setup.ts. Both variables must be
  // present; the deploy job and local runs set neither.
  const runtimeBypass = Boolean(
    environment['RUNTIME_BYPASS_ORIGIN'] &&
      environment['VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET']
  );
```

Inside `defineConfig({ ... })`, add directly after the `testIgnore,` line:

```ts
    globalSetup: runtimeBypass
      ? resolve(__dirname, 'e2e', 'runtime-bypass-setup.ts')
      : undefined,
```

Inside the `use: { ... }` object, add directly after the `trace: 'off',` / `video: 'off',` lines:

```ts
      ...(runtimeBypass ? { storageState: RUNTIME_BYPASS_STORAGE_STATE } : {}),
```

- [ ] **Step 4: Run the config tests to verify they pass**

Run: `cd apps/website && npx vitest run playwright-config runtime-bypass-setup`
Expected: `Tests  16 passed (16)`.

- [ ] **Step 5: Confirm the ordinary suite still collects and lint is clean**

Run: `npx playwright test --config apps/website/playwright.config.ts --list | tail -1`
Expected: a line ending in `Total: 107 tests in 12 files` (count may differ by a few; there must be no error).

Run: `npx nx lint website --skip-nx-cache 2>&1 | grep -E "problems|error" | tail -1`
Expected: `0 errors`.

Run: `npx nx test website --skip-nx-cache 2>&1 | tail -3`
Expected: `Successfully ran target test for project website`.

- [ ] **Step 6: Commit**

```bash
git add apps/website/playwright.config.ts apps/website/src/playwright-config.spec.ts
git commit -m "feat(website): opt-in runtime bypass storage state for protected previews

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `cockpit-preview-smoke` job

**Files:**
- Modify: `.github/workflows/ci.yml` (insert after the `cockpit-deploy-smoke` job, before `examples-chat-smoke`)
- Modify: `scripts/ci-workflow.spec.mjs`

- [ ] **Step 1: Write the failing guard test**

Append inside the `describe('CI workflow', ...)` block in `scripts/ci-workflow.spec.mjs`, after the test named `'verifies every protected immutable preview with its own automation bypass'`:

```js
  it('smokes a throwaway cockpit preview on same-repo PRs and queue candidates', async () => {
    const workflow = await readWorkflow();
    const job = readJobBlock(workflow, 'cockpit-preview-smoke');
    const ifBlock = readJobFieldBlock(job, 'if');

    assert.deepEqual(readJobNeeds(job), ['ci-scope']);
    assert.match(ifBlock, /github\.event_name != 'push'/);
    assert.match(ifBlock, /needs\.ci-scope\.outputs\.cockpit_deploy_smoke == 'true'/);
    assert.match(
      ifBlock,
      /github\.event_name == 'merge_group' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository/
    );

    const prepare = readNamedStep(job, 'Prepare cockpit Vercel project (preview)');
    const build = readNamedStep(job, 'Build cockpit redirect service (preview)');
    const deploy = readNamedStep(job, 'Deploy throwaway cockpit preview');
    const smoke = readNamedStep(job, 'Exhaustively verify the cockpit preview');

    assert.match(prepare, /"projectName":"threadplane-cockpit"/);
    assert.match(prepare, /vercel pull --yes --environment=preview/);
    assert.match(build, /vercel build --local-config vercel\.cockpit\.json/);
    assert.doesNotMatch(build, /--prod/);
    assert.match(deploy, /id:\s*deploy_cockpit_preview/);
    assert.match(deploy, /vercel deploy --prebuilt --archive=tgz --skip-domain --yes/);
    assert.doesNotMatch(deploy, /--prod/);
    assert.match(deploy, /--env COCKPIT_WEBSITE_ORIGIN=https:\/\/threadplane\.ai/);
    assert.match(
      smoke,
      /VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET \}\}/
    );
    assert.match(smoke, /-z "\$\{VERCEL_AUTOMATION_BYPASS_SECRET\}"/);
    assert.match(
      smoke,
      /--url "\$\{\{ steps\.deploy_cockpit_preview\.outputs\.deployment_url \}\}"[\s\S]*--mode preview/
    );
    assert.doesNotMatch(job, /vercel promote/);
  });
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok ... smokes a throwaway cockpit preview` and `# fail 1`.

- [ ] **Step 3: Add the job to `ci.yml`**

Insert the following block directly after the `cockpit-deploy-smoke` job (after its last `run:` line) and before `  examples-chat-smoke:`:

```yaml
  cockpit-preview-smoke:
    name: Cockpit — immutable preview smoke
    timeout-minutes: 20
    needs: ci-scope
    # PR-side twin of the deploy job's cockpit verification. Deploys a
    # throwaway preview of the redirect service and runs the exhaustive smoke
    # against it, so platform behaviour (deployment protection, the CDN's
    # slash collapse, route ordering) is exercised before merge. Needs
    # repository secrets, so same-repo PRs and merge-queue candidates only;
    # the token-free dry-run job above still covers forks.
    if: >-
      github.event_name != 'push' &&
      needs.ci-scope.outputs.cockpit_deploy_smoke == 'true' &&
      (github.event_name == 'merge_group' || github.event.pull_request.head.repo.full_name == github.repository)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f # v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Prepare cockpit Vercel project (preview)
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_COCKPIT_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"threadplane-cockpit"}
          EOF
          npx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          rm -rf .vercel/output
      - name: Build cockpit redirect service (preview)
        env:
          COCKPIT_WEBSITE_ORIGIN: https://threadplane.ai
        run: |
          npx vercel build --local-config vercel.cockpit.json --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy throwaway cockpit preview
        id: deploy_cockpit_preview
        run: |
          url=$(npx vercel deploy --prebuilt --archive=tgz --skip-domain --yes --env COCKPIT_WEBSITE_ORIGIN=https://threadplane.ai --token=${{ secrets.VERCEL_TOKEN }} | tail -n 1)
          echo "deployment_url=$url" >> "$GITHUB_OUTPUT"
      - name: Exhaustively verify the cockpit preview
        run: |
          if [ -z "${VERCEL_AUTOMATION_BYPASS_SECRET}" ]; then
            echo "::error::VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET is unset — the protected cockpit preview cannot be verified. Enable 'Protection Bypass for Automation' on the Vercel threadplane-cockpit project and store the value as this repository secret."
            exit 1
          fi
          npx tsx apps/cockpit/scripts/deploy-smoke.ts --url "${{ steps.deploy_cockpit_preview.outputs.deployment_url }}" --mode preview --retries 20 --retry-delay-ms 5000
        env:
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET }}
```

- [ ] **Step 4: Run the guards and validate YAML**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'));print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml scripts/ci-workflow.spec.mjs
git commit -m "ci: smoke a throwaway cockpit preview on pull requests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `website-preview-e2e` job

**Files:**
- Modify: `.github/workflows/ci.yml` (insert after the `website-e2e` job, before `required-pr-checks`)
- Modify: `scripts/ci-workflow.spec.mjs`

- [ ] **Step 1: Write the failing guard test**

Append inside the `describe('CI workflow', ...)` block in `scripts/ci-workflow.spec.mjs`, after the cockpit-preview test from Task 3:

```js
  it('runs the Website suite against a deterministic aliased preview with a matching examples preview', async () => {
    const workflow = await readWorkflow();
    const job = readJobBlock(workflow, 'website-preview-e2e');
    const ifBlock = readJobFieldBlock(job, 'if');

    assert.deepEqual(readJobNeeds(job), ['ci-scope']);
    assert.match(ifBlock, /github\.event_name != 'push'/);
    assert.match(ifBlock, /needs\.ci-scope\.outputs\.website_e2e == 'true'/);
    assert.match(
      ifBlock,
      /github\.event_name == 'merge_group' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository/
    );

    const aliases = readNamedStep(job, 'Derive deterministic preview aliases');
    const guard = readNamedStep(job, 'Require preview bypass secrets');
    const assemble = readNamedStep(job, 'Build and assemble Angular examples for the preview');
    const examples = readNamedStep(job, 'Deploy examples preview and alias it');
    const website = readNamedStep(job, 'Build, deploy, and alias the Website preview');
    const suite = readNamedStep(job, 'Run the Website suite against the aliased preview');

    assert.match(aliases, /id:\s*aliases/);
    assert.match(aliases, /key="pr-\$\{\{ github\.event\.pull_request\.number \}\}"/);
    assert.match(aliases, /key="mq-\$\(echo "\$\{\{ github\.event\.merge_group\.head_sha \}\}" \| cut -c1-8\)"/);
    assert.match(aliases, /website=threadplane-\$\{key\}-cacheplane\.vercel\.app/);
    assert.match(aliases, /examples=threadplane-examples-\$\{key\}-cacheplane\.vercel\.app/);

    assert.match(guard, /-z "\$\{VERCEL_AUTOMATION_BYPASS_SECRET\}"/);
    assert.match(guard, /-z "\$\{VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET\}"/);
    assert.match(guard, /VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/);
    assert.match(guard, /VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET \}\}/);

    // The examples are assembled with the Website alias in their policy and
    // the Website is built with the examples alias as its runtime base.
    assert.match(
      assemble,
      /RUNTIME_PARENT_PREVIEW_ORIGINS:\s*https:\/\/\$\{\{ steps\.aliases\.outputs\.website \}\}/
    );
    assert.match(examples, /working-directory:\s*deploy\/examples/);
    assert.match(examples, /"projectName":"threadplane-examples"/);
    assert.match(examples, /vercel pull --yes --environment=preview/);
    assert.match(examples, /vercel deploy --prebuilt --yes/);
    assert.doesNotMatch(examples, /--prod/);
    assert.match(
      examples,
      /vercel alias set "\$url" "\$\{\{ steps\.aliases\.outputs\.examples \}\}" --scope=\$\{\{ secrets\.VERCEL_ORG_ID \}\}/
    );

    assert.match(website, /"projectName":"threadplane"/);
    assert.match(website, /vercel pull --yes --environment=preview/);
    assert.match(
      website,
      /NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL:\s*https:\/\/\$\{\{ steps\.aliases\.outputs\.examples \}\}/
    );
    assert.match(website, /GROWTH_FORM_POLICY:\s*growth_v1/);
    assert.match(website, /vercel build --token/);
    assert.match(website, /vercel deploy --prebuilt --archive=tgz --skip-domain --yes/);
    assert.doesNotMatch(website, /--prod/);
    assert.match(
      website,
      /vercel alias set "\$url" "\$\{\{ steps\.aliases\.outputs\.website \}\}" --scope=\$\{\{ secrets\.VERCEL_ORG_ID \}\}/
    );

    assert.match(suite, /BASE_URL:\s*https:\/\/\$\{\{ steps\.aliases\.outputs\.website \}\}/);
    assert.match(suite, /RUNTIME_BYPASS_ORIGIN:\s*https:\/\/\$\{\{ steps\.aliases\.outputs\.examples \}\}/);
    assert.match(suite, /VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/);
    assert.match(suite, /VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET:\s*\$\{\{ secrets\.VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET \}\}/);
    assert.match(suite, /npx nx e2e website --skip-nx-cache/);
    assert.doesNotMatch(job, /vercel promote/);
  });
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok ... deterministic aliased preview` and `# fail 1`.

- [ ] **Step 3: Add the job to `ci.yml`**

Insert directly after the `website-e2e` job (after its last step, the `Production-smoke spec must load` step's `run:` block) and before `  required-pr-checks:`:

```yaml
  website-preview-e2e:
    name: Website — e2e (deployed preview)
    timeout-minutes: 40
    needs: ci-scope
    # PR-side twin of the deploy job's post-promotion verification. The
    # ordinary suite runs against a real, protected Vercel preview of the
    # Website whose runtime iframe loads from a matching examples preview, so
    # remote-target assumptions and platform behaviour surface before merge.
    # Two deterministic aliases break the ordering problem: the examples are
    # assembled with the Website alias in their parent-origin policy, and the
    # Website is built with the examples alias as its runtime base. Needs
    # repository secrets, so same-repo PRs and merge-queue candidates only.
    if: >-
      github.event_name != 'push' &&
      needs.ci-scope.outputs.website_e2e == 'true' &&
      (github.event_name == 'merge_group' || github.event.pull_request.head.repo.full_name == github.repository)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f # v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Cache Playwright browsers
        uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            playwright-${{ runner.os }}-
      - run: npx playwright install --with-deps chromium
      - name: Derive deterministic preview aliases
        id: aliases
        run: |
          if [ "${{ github.event_name }}" = "merge_group" ]; then
            key="mq-$(echo "${{ github.event.merge_group.head_sha }}" | cut -c1-8)"
          else
            key="pr-${{ github.event.pull_request.number }}"
          fi
          echo "website=threadplane-${key}-cacheplane.vercel.app" >> "$GITHUB_OUTPUT"
          echo "examples=threadplane-examples-${key}-cacheplane.vercel.app" >> "$GITHUB_OUTPUT"
      - name: Require preview bypass secrets
        # Both previews sit behind deployment protection, and bypass secrets
        # are issued per Vercel project. Fail before creating anything.
        run: |
          if [ -z "${VERCEL_AUTOMATION_BYPASS_SECRET}" ]; then
            echo "::error::VERCEL_AUTOMATION_BYPASS_SECRET is unset — the protected Website preview cannot be verified. Enable 'Protection Bypass for Automation' on the Vercel threadplane project and store the value as this repository secret."
            exit 1
          fi
          if [ -z "${VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET}" ]; then
            echo "::error::VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET is unset — the runtime iframe from the protected examples preview cannot load. Enable 'Protection Bypass for Automation' on the Vercel threadplane-examples project and store the value as this repository secret."
            exit 1
          fi
        env:
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET }}
      - name: Build and assemble Angular examples for the preview
        run: npx tsx scripts/assemble-examples.ts
        env:
          RUNTIME_PARENT_PREVIEW_ORIGINS: https://${{ steps.aliases.outputs.website }}
      - name: Deploy examples preview and alias it
        working-directory: deploy/examples
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_EXAMPLES_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"threadplane-examples"}
          EOF
          npx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          url=$(npx vercel deploy --prebuilt --yes --token=${{ secrets.VERCEL_TOKEN }} | tail -n 1)
          echo "examples deployment: $url"
          npx vercel alias set "$url" "${{ steps.aliases.outputs.examples }}" --scope=${{ secrets.VERCEL_ORG_ID }} --token=${{ secrets.VERCEL_TOKEN }}
      - name: Build, deploy, and alias the Website preview
        env:
          GROWTH_FORM_POLICY: growth_v1
          NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL: https://${{ steps.aliases.outputs.examples }}
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_WEBSITE_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"threadplane"}
          EOF
          npx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          rm -rf .vercel/output
          npx vercel build --token=${{ secrets.VERCEL_TOKEN }}
          url=$(npx vercel deploy --prebuilt --archive=tgz --skip-domain --yes --token=${{ secrets.VERCEL_TOKEN }} | tail -n 1)
          echo "website deployment: $url"
          npx vercel alias set "$url" "${{ steps.aliases.outputs.website }}" --scope=${{ secrets.VERCEL_ORG_ID }} --token=${{ secrets.VERCEL_TOKEN }}
      - name: Run the Website suite against the aliased preview
        run: npx nx e2e website --skip-nx-cache
        env:
          BASE_URL: https://${{ steps.aliases.outputs.website }}
          RUNTIME_BYPASS_ORIGIN: https://${{ steps.aliases.outputs.examples }}
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
          VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET }}
```

- [ ] **Step 4: Run the guards and validate YAML**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'));print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml scripts/ci-workflow.spec.mjs
git commit -m "ci: run the Website suite against an aliased preview with a matching examples preview

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Wire both jobs into the required gate

**Files:**
- Modify: `.github/workflows/ci.yml` (`required-pr-checks` job)
- Modify: `scripts/ci-workflow.spec.mjs`

- [ ] **Step 1: Write the failing guard test**

Append inside the `describe('CI workflow', ...)` block in `scripts/ci-workflow.spec.mjs`, after the Task 4 test:

```js
  it('requires both PR-side preview verifications through the scoped gate', async () => {
    const required = await readRequiredPrChecksJob();
    const needs = readJobNeeds(required);

    assert.ok(needs.includes('website-preview-e2e'));
    assert.ok(needs.includes('cockpit-preview-smoke'));
    assert.match(
      required,
      /RESULT_WEBSITE_PREVIEW_E2E:\s*\$\{\{ needs\.website-preview-e2e\.result \}\}/
    );
    assert.match(
      required,
      /RESULT_COCKPIT_PREVIEW_SMOKE:\s*\$\{\{ needs\.cockpit-preview-smoke\.result \}\}/
    );
    assert.match(
      required,
      /require_scoped "website_e2e" "Website — e2e \(deployed preview\)" "\$RESULT_WEBSITE_PREVIEW_E2E" "\$SCOPE_WEBSITE_E2E"/
    );
    assert.match(
      required,
      /require_scoped "cockpit_deploy_smoke" "Cockpit — immutable preview smoke" "\$RESULT_COCKPIT_PREVIEW_SMOKE" "\$SCOPE_COCKPIT_DEPLOY_SMOKE"/
    );
  });
```

Note on forks: both jobs skip there, `require_scoped` treats `skipped` as acceptable, so the gate stays green on forks without these lanes.

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `not ok ... requires both PR-side preview verifications` and `# fail 1`.

- [ ] **Step 3: Edit the `required-pr-checks` job**

In the `needs:` list, add after `      - website-e2e`:

```yaml
      - website-preview-e2e
      - cockpit-preview-smoke
```

In the step `env:` block, add after `RESULT_WEBSITE_E2E: ${{ needs.website-e2e.result }}`:

```yaml
          RESULT_WEBSITE_PREVIEW_E2E: ${{ needs.website-preview-e2e.result }}
          RESULT_COCKPIT_PREVIEW_SMOKE: ${{ needs.cockpit-preview-smoke.result }}
```

In the `run:` script, add after the line `require_scoped "website_e2e" "Website — e2e" "$RESULT_WEBSITE_E2E" "$SCOPE_WEBSITE_E2E"`:

```bash
          require_scoped "website_e2e" "Website — e2e (deployed preview)" "$RESULT_WEBSITE_PREVIEW_E2E" "$SCOPE_WEBSITE_E2E"
          require_scoped "cockpit_deploy_smoke" "Cockpit — immutable preview smoke" "$RESULT_COCKPIT_PREVIEW_SMOKE" "$SCOPE_COCKPIT_DEPLOY_SMOKE"
```

- [ ] **Step 4: Run the guards and validate YAML**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'));print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml scripts/ci-workflow.spec.mjs
git commit -m "ci: gate merges on the PR-side preview verifications

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Provision the examples bypass secret

**Files:** none in the repo. External state: Vercel project `threadplane-examples`, GitHub repository secret. Run Steps 1–4 in one shell session so `$tok` and `$out` carry over.

The token lives in the primary checkout's root `.env` as `VERCEL_API_TOKEN`. Team `cacheplane` is `team_RWMT2bzjj1nkSXI3N3arQ6CP`; the examples project is `prj_ZDFXcUa8iK3DI4i3S4dMbfFvxo78`.

- [ ] **Step 1: Confirm the project has no bypass yet**

```bash
tok=$(grep -E "^VERCEL_API_TOKEN=" /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2- | tr -d '"'"'"' ')
curl -s -H "Authorization: Bearer $tok" "https://api.vercel.com/v9/projects/prj_ZDFXcUa8iK3DI4i3S4dMbfFvxo78?teamId=team_RWMT2bzjj1nkSXI3N3arQ6CP" | python3 -c 'import sys,json;p=json.load(sys.stdin);print("bypass entries:", len(p.get("protectionBypass") or {}))'
```

Expected: `bypass entries: 0`. If it prints 1 or more, skip Step 2 and read the existing key in Step 3 instead of the generated one.

- [ ] **Step 2: Generate the bypass (value never printed)**

```bash
umask 077
out=/private/tmp/claude-501/examples-bypass.json
curl -s -X PATCH -H "Authorization: Bearer $tok" -H "Content-Type: application/json" "https://api.vercel.com/v1/projects/prj_ZDFXcUa8iK3DI4i3S4dMbfFvxo78/protection-bypass?teamId=team_RWMT2bzjj1nkSXI3N3arQ6CP" -d '{"generate":{}}' > "$out"
python3 -c 'import sys,json;d=json.load(open(sys.argv[1]));print("entries now:", [(k[:4]+"…", v.get("scope")) for k,v in (d.get("protectionBypass") or {}).items()])' "$out"
```

Expected: `entries now: [('xxxx…', 'automation-bypass')]`.

- [ ] **Step 3: Store it as the repository secret**

```bash
python3 -c 'import sys,json;d=json.load(open(sys.argv[1]));print(next(k for k,v in d["protectionBypass"].items() if v.get("scope")=="automation-bypass"),end="")' "$out" | gh secret set VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET --repo cacheplane/angular-agent-framework
gh secret list | grep VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET
rm -f "$out"
```

Expected: a line starting `VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET` with today's timestamp, then the scratch file removed.

- [ ] **Step 4: Prove the bypass opens an examples deployment**

```bash
# GitHub secrets cannot be read back; re-read the key from Vercel for the probe.
key=$(curl -s -H "Authorization: Bearer $tok" "https://api.vercel.com/v9/projects/prj_ZDFXcUa8iK3DI4i3S4dMbfFvxo78?teamId=team_RWMT2bzjj1nkSXI3N3arQ6CP" | python3 -c 'import sys,json;p=json.load(sys.stdin);print(next(k for k,v in p["protectionBypass"].items() if v.get("scope")=="automation-bypass"),end="")')
u=$(curl -s -H "Authorization: Bearer $tok" "https://api.vercel.com/v6/deployments?projectId=prj_ZDFXcUa8iK3DI4i3S4dMbfFvxo78&teamId=team_RWMT2bzjj1nkSXI3N3arQ6CP&limit=1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["deployments"][0]["url"])')
curl -s -o /dev/null -w "without: %{http_code}\n" "https://$u/langgraph/streaming/"
curl -s -o /dev/null -H "x-vercel-protection-bypass: $key" -w "with bypass: %{http_code}\n" "https://$u/langgraph/streaming/"
```

Expected: `without: 302` then `with bypass: 200`.

---

### Task 7: Open the PR and verify both lanes live

**Files:** none new. This task exercises the lanes end to end.

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin blove/pr-side-deploy-verification
gh pr create --base main --title "ci: PR-side deploy verification against real Vercel previews" --body-file - <<'MD'
## Why

Landing #963 took nine fix PRs, every one repairing a step only the push-only deploy job executes. See `docs/superpowers/specs/2026-09-03-pr-side-deploy-verification-design.md`.

## What

- `website-preview-e2e`: assembles the examples with a deterministic Website alias in their policy, deploys them as an examples preview under a deterministic alias, builds and deploys the Website as a preview pointed at that alias, and runs the ordinary suite against it. A Playwright global setup seeds the examples origin's bypass cookie so the runtime iframe reaches Ready.
- `cockpit-preview-smoke`: deploys a throwaway cockpit preview and runs the 399-probe smoke against it.
- Both join the required gate under their existing scope keys. Same-repo PRs and merge-queue candidates only; the token-free dry-run stays for forks.

## Provisioning

`VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET` was generated on the threadplane-examples project and stored before this PR was opened, so this PR's own run exercises both lanes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
MD
```

- [ ] **Step 2: Watch the two new lanes on this PR**

The PR touches `.github/workflows/ci.yml`, which the scope classifier treats as a global CI change, so every scope is on and both lanes run.

```bash
gh pr checks --watch --fail-fast 2>&1 | grep -E "deployed preview|immutable preview smoke|CI — required"
```

Expected: `Website — e2e (deployed preview)` pass, `Cockpit — immutable preview smoke` pass, `CI — required` pass.

- [ ] **Step 3: Confirm the runtime handshake actually ran**

Open the Website lane's log and confirm the serial workspace-shell tests ran rather than skipping:

```bash
run=$(gh pr checks --json name,link --jq '.[]|select(.name=="Website — e2e (deployed preview)")|.link' | grep -oE 'runs/[0-9]+' | cut -d/ -f2)
gh run view "$run" --log 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | grep -E "workspace-shell.spec.ts:146|passed|failed|did not run" | tail -5
```

Expected: the line for `workspace-shell.spec.ts:146 › moves Docs to Run to Code to API to Docs without replacing the runtime frame` shows `✓`, a `passed` total, and no `did not run`.

- [ ] **Step 4: Confirm the aliases resolve**

```bash
n=$(gh pr view --json number --jq .number)
curl -s -o /dev/null -w "website alias: %{http_code}\n" "https://threadplane-pr-${n}-cacheplane.vercel.app/"
curl -s -o /dev/null -w "examples alias: %{http_code}\n" "https://threadplane-examples-pr-${n}-cacheplane.vercel.app/langgraph/streaming/"
```

Expected: both `302` (protected, which proves the aliases exist and point at deployments).

- [ ] **Step 5: Mutation check — reintroduce the #983 bug on a throwaway commit**

```bash
git checkout -b blove/mutation-localhost-abort
python3 - <<'PY'
from pathlib import Path
p = Path('apps/website/e2e/workspace-shell.spec.ts'); s = p.read_text()
old = """    await page.route(
      (url) => url.searchParams.has('cockpit_cap'),
      (route) => route.abort()
    );
"""
assert old in s
p.write_text(s.replace(old, "    await page.route('http://localhost:4300/**', (request) => request.abort());\n", 1))
PY
git commit -am "test: MUTATION — do not merge"
git push -u origin blove/mutation-localhost-abort
gh pr create --base main --draft --title "MUTATION CHECK — do not merge" --body "Verifies website-preview-e2e goes red on a host-bound route abort. Close without merging."
gh pr checks --watch 2>&1 | grep -E "deployed preview"
```

Expected: `Website — e2e (deployed preview)` **fail**, because the reduced-motion loader is gone on a real preview.

Then close the mutation PR and delete its branch:

```bash
gh pr close --delete-branch
git checkout blove/pr-side-deploy-verification
```

- [ ] **Step 6: Merge**

Once the real PR is green and any AI review comments are addressed:

```bash
gh pr merge --squash
```

---

### Task 8: Record the lanes for the next engineer

**Files:**
- Modify: `CONTRIBUTING.md` (add a short subsection near the existing CI notes)

- [ ] **Step 1: Add the subsection**

Find the CI section of `CONTRIBUTING.md` (search for `CI — required`) and add after it:

```markdown
### PR-side deploy verification

Two lanes run the deploy job's verification on pull requests against real
Vercel previews, so deploy-only failures surface before merge:

- **Website — e2e (deployed preview)** builds and deploys the Website and
  the examples as previews under deterministic aliases
  (`threadplane-pr-<n>-cacheplane.vercel.app` and
  `threadplane-examples-pr-<n>-cacheplane.vercel.app`) and runs the ordinary
  suite against the Website alias. The runtime iframe loads because the
  examples are assembled with the Website alias in their parent-origin
  policy and Playwright seeds the examples origin's bypass cookie
  (`apps/website/e2e/runtime-bypass-setup.ts`).
- **Cockpit — immutable preview smoke** deploys a throwaway cockpit preview
  and runs the exhaustive redirect smoke against it.

Both need repository secrets and therefore skip on fork PRs. Each Vercel
project has its own Protection Bypass for Automation secret:
`VERCEL_AUTOMATION_BYPASS_SECRET` (Website),
`VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET`, and
`VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET`. A secret added while a run is in
flight does not reach that run; re-run after provisioning.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(contributing): describe the PR-side deploy verification lanes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

This can land in the same PR as Tasks 1–5 if done before Task 7, or as a one-line follow-up.
