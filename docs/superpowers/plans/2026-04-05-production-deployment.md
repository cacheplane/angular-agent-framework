# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy all 14 capability backends to LangGraph Cloud, host all 14 Angular example apps on Vercel, wire the cockpit to production URLs, and verify end-to-end with smoke tests.

**Architecture:** Three-phase deployment: (1) deploy Python backends to LangGraph Cloud via existing `deploy-langgraph.yml`, capture URLs into a registry file; (2) update Angular production environments with LangGraph Cloud URLs, build and deploy as static sites to a new Vercel project at `examples.cacheplane.ai`; (3) set `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` in cockpit Vercel env, add a production smoke test to CI that verifies the full stack.

**Tech Stack:** LangGraph Cloud (LangSmith), Vercel, Angular static builds, Playwright, GitHub Actions

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `cockpit/langgraph/*/angular/project.json` (8) | Switch to @angular/build:application |
| Modify | `cockpit/deep-agents/*/angular/project.json` (6) | Switch to @angular/build:application |
| Create | `deployment-urls.json` | Registry of LangGraph Cloud URLs per capability |
| Create | `scripts/verify-langgraph-deployments.ts` | Health check + smoke test all 14 backends |
| Modify | `cockpit/langgraph/streaming/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/persistence/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/interrupts/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/memory/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/durable-execution/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/subgraphs/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/time-travel/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/langgraph/deployment-runtime/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/planning/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/filesystem/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/subagents/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/memory/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/skills/angular/src/environments/environment.ts` | Production LangGraph URL |
| Modify | `cockpit/deep-agents/sandboxes/angular/src/environments/environment.ts` | Production LangGraph URL |
| Create | `scripts/assemble-examples.ts` | Build + assemble all Angular apps into deploy directory |
| Create | `vercel.examples.json` | Vercel config for static examples site |
| Modify | `.github/workflows/ci.yml` | Add examples deploy job + production smoke job |
| Create | `apps/cockpit/e2e/production-smoke.spec.ts` | Playwright tests for production verification |

---

### Task 0: Switch Angular apps to @angular/build:application

The 14 Angular example apps currently use `@nx/js:tsc` as their build executor, which produces a TypeScript library output. For production deployment, we need `@angular/build:application` — the modern Angular esbuild builder that produces optimized static bundles.

**Files:**
- Modify: `cockpit/langgraph/streaming/angular/project.json` (and all 13 others)

- [ ] **Step 1: Update all 14 project.json files**

Replace the `build` target in each Angular app's `project.json` and add a `serve` target. The pattern (using streaming as example — adjust the paths for each capability):

```json
{
  "name": "cockpit-langgraph-streaming-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/streaming/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": {
          "base": "dist/cockpit/langgraph/streaming/angular",
          "browser": ""
        },
        "browser": "cockpit/langgraph/streaming/angular/src/main.ts",
        "tsConfig": "cockpit/langgraph/streaming/angular/tsconfig.app.json",
        "styles": ["cockpit/langgraph/streaming/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "none"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "configurations": {
        "production": { "buildTarget": "cockpit-langgraph-streaming-angular:build:production" },
        "development": { "buildTarget": "cockpit-langgraph-streaming-angular:build:development" }
      },
      "defaultConfiguration": "development",
      "options": {
        "proxyConfig": "cockpit/langgraph/streaming/angular/proxy.conf.json"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/langgraph/streaming/angular",
        "command": "npx tsx -e \"import { langgraphStreamingAngularModule } from './src/index.ts'; const module = langgraphStreamingAngularModule; if (module.id !== 'langgraph-streaming-angular' || module.title !== 'LangGraph Streaming (Angular)') { throw new Error('Unexpected module shape for ' + module.id); }\""
      }
    }
  }
}
```

Key changes from the current config:
- `projectType` → `"application"` (was `"library"`)
- `build.executor` → `"@angular/build:application"` (was `"@nx/js:tsc"`)
- `outputPath` → structured `{ base, browser }` for static output
- `browser` entry point → `src/main.ts`
- `styles` array → references the app's `styles.css`
- Added `configurations` for production (budgets, hashing) and development (source maps)
- Added explicit `serve` target with `@angular/build:dev-server` and `proxyConfig`
- Preserved existing `smoke` target

Repeat for all 14 apps, adjusting:
- `name` — e.g., `cockpit-langgraph-persistence-angular`
- All paths — e.g., `cockpit/langgraph/persistence/angular/...`
- `buildTarget` in serve — e.g., `cockpit-langgraph-persistence-angular:build:development`
- `smoke` command module name and expected values

- [ ] **Step 2: Build one app to verify**

```bash
npx nx build cockpit-langgraph-streaming-angular --skip-nx-cache
```

Expected: build succeeds, output in `dist/cockpit/langgraph/streaming/angular/` with `index.html`, `main.js`, `styles.css`.

- [ ] **Step 3: Build all 14 apps**

```bash
npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache
```

Expected: all 14 build successfully.

- [ ] **Step 4: Verify serve still works**

```bash
npx nx serve cockpit-langgraph-streaming-angular --port 4300 &
sleep 15
curl -s -o /dev/null -w "%{http_code}" http://localhost:4300/
```

Expected: HTTP 200. Kill the serve process after.

- [ ] **Step 5: Commit**

```bash
git add cockpit/langgraph/*/angular/project.json cockpit/deep-agents/*/angular/project.json
git commit -m "refactor(cockpit): switch Angular apps to @angular/build:application for production builds"
```

---

### Task 1: Trigger LangGraph Cloud deployments and create deployment URL registry

This task is partially manual — you trigger the GitHub Actions workflow, then capture the resulting URLs.

**Files:**
- Create: `deployment-urls.json`

- [ ] **Step 1: Trigger the LangGraph deploy workflow**

Go to GitHub Actions → "Deploy LangGraph" → "Run workflow" on the `main` branch with no capability filter. This deploys all 14 backends.

Alternatively, via CLI:

```bash
gh workflow run deploy-langgraph.yml --ref main
```

Wait for all 14 matrix jobs to complete (check status with `gh run list --workflow deploy-langgraph.yml --limit 1`).

- [ ] **Step 2: Capture deployment URLs from LangSmith**

After deployment, retrieve the deployment URL for each backend from the LangSmith UI (Deployments page) or via the LangGraph CLI:

```bash
pip install langgraph-cli
# For each capability, check its deployment URL:
langgraph deployments list
```

The URL format is typically `https://<deployment-name>-<hash>.default.us.langgraph.app` or similar.

- [ ] **Step 3: Create deployment-urls.json**

Create `deployment-urls.json` at the workspace root with the actual URLs from Step 2:

```json
{
  "streaming": "https://REPLACE_WITH_ACTUAL_URL",
  "persistence": "https://REPLACE_WITH_ACTUAL_URL",
  "interrupts": "https://REPLACE_WITH_ACTUAL_URL",
  "memory": "https://REPLACE_WITH_ACTUAL_URL",
  "durable-execution": "https://REPLACE_WITH_ACTUAL_URL",
  "subgraphs": "https://REPLACE_WITH_ACTUAL_URL",
  "time-travel": "https://REPLACE_WITH_ACTUAL_URL",
  "deployment-runtime": "https://REPLACE_WITH_ACTUAL_URL",
  "planning": "https://REPLACE_WITH_ACTUAL_URL",
  "filesystem": "https://REPLACE_WITH_ACTUAL_URL",
  "subagents": "https://REPLACE_WITH_ACTUAL_URL",
  "da-memory": "https://REPLACE_WITH_ACTUAL_URL",
  "skills": "https://REPLACE_WITH_ACTUAL_URL",
  "sandboxes": "https://REPLACE_WITH_ACTUAL_URL"
}
```

The keys match the `assistantId` values from each Angular app's `environment.ts`. Replace each `REPLACE_WITH_ACTUAL_URL` with the real URL from LangSmith.

- [ ] **Step 4: Commit**

```bash
git add deployment-urls.json
git commit -m "chore: add LangGraph Cloud deployment URL registry"
```

---

### Task 2: Create backend verification script

**Files:**
- Create: `scripts/verify-langgraph-deployments.ts`

- [ ] **Step 1: Create the verification script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Verify all LangGraph Cloud deployments are healthy and can process messages.
 *
 * Usage:
 *   npx tsx scripts/verify-langgraph-deployments.ts
 *   npx tsx scripts/verify-langgraph-deployments.ts --capability streaming
 *   npx tsx scripts/verify-langgraph-deployments.ts --smoke  # includes send/receive test
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const urls: Record<string, string> = JSON.parse(
  readFileSync(resolve(__dirname, '../deployment-urls.json'), 'utf-8'),
);

const capability = process.argv.find((a) => a === '--capability')
  ? process.argv[process.argv.indexOf('--capability') + 1]
  : null;

const smoke = process.argv.includes('--smoke');

const entries = capability
  ? [[capability, urls[capability]] as const]
  : Object.entries(urls);

let passed = 0;
let failed = 0;

for (const [name, url] of entries) {
  if (!url) {
    console.error(`❌ ${name}: no URL in deployment-urls.json`);
    failed++;
    continue;
  }

  // Health check
  try {
    const res = await fetch(`${url}/ok`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (!data.ok) throw new Error(`/ok returned ${JSON.stringify(data)}`);
    console.log(`✅ ${name}: healthy (${url})`);
  } catch (err) {
    console.error(`❌ ${name}: health check failed — ${(err as Error).message}`);
    failed++;
    continue;
  }

  // Smoke test: send a message and verify AI response
  if (smoke) {
    try {
      // Create a thread
      const threadRes = await fetch(`${url}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: {} }),
        signal: AbortSignal.timeout(10000),
      });
      const thread = await threadRes.json();
      const threadId = thread.thread_id;

      // Send a message
      const runRes = await fetch(`${url}/threads/${threadId}/runs/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant_id: name,
          input: { messages: [{ role: 'human', content: 'hello' }] },
          stream_mode: ['values'],
        }),
        signal: AbortSignal.timeout(30000),
      });

      const text = await runRes.text();
      if (!text.includes('"type":"ai"')) {
        throw new Error('No AI response in stream');
      }
      console.log(`✅ ${name}: smoke test passed`);
    } catch (err) {
      console.error(`❌ ${name}: smoke test failed — ${(err as Error).message}`);
      failed++;
      continue;
    }
  }

  passed++;
}

console.log(`\n${passed} passed, ${failed} failed out of ${entries.length}`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run the health check**

```bash
npx tsx scripts/verify-langgraph-deployments.ts
```

Expected: all 14 backends report healthy. If any fail, check the URL in `deployment-urls.json` and the LangSmith deployment status.

- [ ] **Step 3: Run the smoke test**

```bash
npx tsx scripts/verify-langgraph-deployments.ts --smoke
```

Expected: all 14 backends accept a message and return an AI response. If `OPENAI_API_KEY` is not configured in the LangGraph Cloud environment, this will fail — configure it via LangSmith UI first.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-langgraph-deployments.ts
git commit -m "feat: add LangGraph deployment verification script"
```

---

### Task 3: Update Angular production environment files

**Files:**
- Modify: all 14 `cockpit/*/angular/src/environments/environment.ts` files

- [ ] **Step 1: Create a script to update all environment files from deployment-urls.json**

This is most reliable as a one-time script. Create `scripts/update-angular-environments.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * Update all Angular production environment.ts files with LangGraph Cloud URLs
 * from deployment-urls.json.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const urls: Record<string, string> = JSON.parse(
  readFileSync(resolve(root, 'deployment-urls.json'), 'utf-8'),
);

const capabilities = [
  { dir: 'cockpit/langgraph/streaming/angular', assistantId: 'streaming', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/persistence/angular', assistantId: 'persistence', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/interrupts/angular', assistantId: 'interrupts', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/memory/angular', assistantId: 'memory', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/durable-execution/angular', assistantId: 'durable-execution', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/subgraphs/angular', assistantId: 'subgraphs', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/time-travel/angular', assistantId: 'time-travel', field: 'streamingAssistantId' },
  { dir: 'cockpit/langgraph/deployment-runtime/angular', assistantId: 'deployment-runtime', field: 'deploymentRuntimeAssistantId' },
  { dir: 'cockpit/deep-agents/planning/angular', assistantId: 'planning', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/filesystem/angular', assistantId: 'filesystem', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/subagents/angular', assistantId: 'subagents', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/memory/angular', assistantId: 'da-memory', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/skills/angular', assistantId: 'skills', field: 'streamingAssistantId' },
  { dir: 'cockpit/deep-agents/sandboxes/angular', assistantId: 'sandboxes', field: 'streamingAssistantId' },
];

for (const cap of capabilities) {
  const url = urls[cap.assistantId];
  if (!url) {
    console.error(`⚠️  No URL for ${cap.assistantId} — skipping`);
    continue;
  }

  const envPath = resolve(root, cap.dir, 'src/environments/environment.ts');

  const content = cap.field === 'deploymentRuntimeAssistantId'
    ? `/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '${url}',
  ${cap.field}: '${cap.assistantId}',
};
`
    : `/**
 * Production environment configuration.
 *
 * Points to the LangGraph Cloud deployment managed by LangSmith.
 * The assistantId must match the graph name in langgraph.json.
 */
export const environment = {
  production: true,
  langGraphApiUrl: '${url}',
  ${cap.field}: '${cap.assistantId}',
};
`;

  writeFileSync(envPath, content);
  console.log(`✅ ${cap.assistantId}: ${envPath}`);
}
```

- [ ] **Step 2: Run the script**

```bash
npx tsx scripts/update-angular-environments.ts
```

Expected: 14 files updated with production LangGraph Cloud URLs.

- [ ] **Step 3: Verify one file looks correct**

```bash
cat cockpit/langgraph/streaming/angular/src/environments/environment.ts
```

Expected: `langGraphApiUrl` now contains the LangGraph Cloud URL (not localhost).

- [ ] **Step 4: Commit**

```bash
git add scripts/update-angular-environments.ts
git add cockpit/langgraph/*/angular/src/environments/environment.ts
git add cockpit/deep-agents/*/angular/src/environments/environment.ts
git commit -m "feat(cockpit): update Angular production environments with LangGraph Cloud URLs"
```

---

### Task 4: Create Vercel static hosting for Angular examples

**Files:**
- Create: `vercel.examples.json`
- Create: `scripts/assemble-examples.ts`

- [ ] **Step 1: Create Vercel config for examples**

Create `vercel.examples.json` at the workspace root:

```json
{
  "framework": null,
  "buildCommand": null,
  "outputDirectory": "deploy/examples",
  "installCommand": "npm ci",
  "rewrites": [
    { "source": "/langgraph/:path*/:file(.*\\..*)", "destination": "/langgraph/:path*/:file" },
    { "source": "/langgraph/:path*", "destination": "/langgraph/:path*/index.html" },
    { "source": "/deep-agents/:path*/:file(.*\\..*)", "destination": "/deep-agents/:path*/:file" },
    { "source": "/deep-agents/:path*", "destination": "/deep-agents/:path*/index.html" }
  ]
}
```

The rewrites ensure SPA routing works — any path without a file extension serves `index.html`.

- [ ] **Step 2: Create the assemble script**

Create `scripts/assemble-examples.ts`:

```typescript
#!/usr/bin/env npx tsx
/**
 * Build all 14 Angular example apps and assemble them into a deploy directory
 * for Vercel static hosting.
 *
 * Output structure:
 *   deploy/examples/
 *   ├── langgraph/streaming/     (index.html, main.js, styles.css)
 *   ├── langgraph/persistence/
 *   ├── ...
 *   ├── deep-agents/planning/
 *   └── ...
 *
 * Usage:
 *   npx tsx scripts/assemble-examples.ts          # build + assemble
 *   npx tsx scripts/assemble-examples.ts --skip-build  # assemble only (assumes build already ran)
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy/examples');
const skipBuild = process.argv.includes('--skip-build');

const capabilities = [
  { product: 'langgraph', topic: 'streaming' },
  { product: 'langgraph', topic: 'persistence' },
  { product: 'langgraph', topic: 'interrupts' },
  { product: 'langgraph', topic: 'memory' },
  { product: 'langgraph', topic: 'durable-execution' },
  { product: 'langgraph', topic: 'subgraphs' },
  { product: 'langgraph', topic: 'time-travel' },
  { product: 'langgraph', topic: 'deployment-runtime' },
  { product: 'deep-agents', topic: 'planning' },
  { product: 'deep-agents', topic: 'filesystem' },
  { product: 'deep-agents', topic: 'subagents' },
  { product: 'deep-agents', topic: 'memory' },
  { product: 'deep-agents', topic: 'skills' },
  { product: 'deep-agents', topic: 'sandboxes' },
];

// Step 1: Build all Angular apps
if (!skipBuild) {
  console.log('Building all 14 Angular apps...');
  execSync("npx nx run-many -t build --projects='cockpit-*-angular' --skip-nx-cache", {
    cwd: root,
    stdio: 'inherit',
  });
}

// Step 2: Clean and create deploy directory
if (existsSync(deployDir)) rmSync(deployDir, { recursive: true });

// Step 3: Copy each app's browser output to the deploy directory
for (const cap of capabilities) {
  const src = resolve(root, `dist/cockpit/${cap.product}/${cap.topic}/angular/browser`);
  const dest = resolve(deployDir, `${cap.product}/${cap.topic}`);

  if (!existsSync(src)) {
    console.error(`❌ Missing build output: ${src}`);
    process.exit(1);
  }

  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`✅ ${cap.product}/${cap.topic}`);
}

console.log(`\nAssembled ${capabilities.length} apps to ${deployDir}`);
```

- [ ] **Step 3: Test the assemble script locally**

```bash
npx tsx scripts/assemble-examples.ts
ls deploy/examples/langgraph/streaming/
```

Expected: `index.html`, `main.js`, `styles.css` in the streaming directory. All 14 apps assembled.

- [ ] **Step 4: Add deploy directory to .gitignore**

Add `deploy/` to `.gitignore`:

```
# Deploy artifacts
deploy/
```

- [ ] **Step 5: Commit**

```bash
git add vercel.examples.json scripts/assemble-examples.ts .gitignore
git commit -m "feat: add Vercel static config and assemble script for Angular examples"
```

---

### Task 5: Add examples deploy job to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the examples deploy steps to the existing deploy job**

In `.github/workflows/ci.yml`, add the following steps to the `deploy` job, after the cockpit deploy verification step (around line 261). Insert before the closing of the `deploy` job:

```yaml
      # ── Angular examples deploy ──────────────────────────────────────────
      - name: Check if examples changed
        id: examples_changed
        run: |
          base_sha="${{ github.event.before }}"
          head_sha="${{ github.sha }}"
          if [ -z "$base_sha" ] || [ "$base_sha" = "0000000000000000000000000000000000000000" ]; then
            base_sha="$(git rev-parse "$head_sha^")"
          fi
          changed_files="$(git diff --name-only "$base_sha" "$head_sha")"
          examples_changed=false
          if printf '%s\n' "$changed_files" | grep -E '^cockpit/.*/angular/' >/dev/null; then
            examples_changed=true
          fi
          if printf '%s\n' "$changed_files" | grep -E '^(vercel\.examples\.json|scripts/assemble-examples\.ts)$' >/dev/null; then
            examples_changed=true
          fi
          echo "changed=$examples_changed" >> "$GITHUB_OUTPUT"

      - name: Build and assemble Angular examples
        if: steps.examples_changed.outputs.changed == 'true'
        run: npx tsx scripts/assemble-examples.ts

      - name: Prepare examples Vercel project
        if: steps.examples_changed.outputs.changed == 'true'
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_EXAMPLES_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"cockpit-examples"}
          EOF
          npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          rm -rf .vercel/output

      - name: Deploy Angular examples to Vercel (production)
        if: steps.examples_changed.outputs.changed == 'true'
        run: |
          npx vercel build --prod --local-config vercel.examples.json --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel deploy --prebuilt --archive=tgz --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
```

Also add `VERCEL_EXAMPLES_PROJECT_ID` to the secrets comment at the top of the deploy job:

```yaml
      #   VERCEL_EXAMPLES_PROJECT_ID — examples project id
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Angular examples deploy to Vercel in CI pipeline"
```

---

### Task 6: Create production smoke test

**Files:**
- Create: `apps/cockpit/e2e/production-smoke.spec.ts`

- [ ] **Step 1: Create the production smoke test**

```typescript
import { expect, test } from '@playwright/test';

/**
 * Production smoke test — verifies the full stack is working:
 * cockpit → iframe → Angular app → LangGraph Cloud backend → AI response.
 *
 * Requires environment variables:
 *   EXAMPLES_URL  - e.g., https://examples.cacheplane.ai
 *   OPENAI_API_KEY - for send/receive tests (optional, skips if not set)
 *
 * Run against production:
 *   BASE_URL=https://cockpit.cacheplane.ai \
 *   EXAMPLES_URL=https://examples.cacheplane.ai \
 *   npx playwright test apps/cockpit/e2e/production-smoke.spec.ts
 */

const EXAMPLES_URL = process.env['EXAMPLES_URL'] ?? 'https://examples.cacheplane.ai';

const CAPABILITIES = [
  'langgraph/streaming',
  'langgraph/persistence',
  'langgraph/interrupts',
  'langgraph/memory',
  'langgraph/durable-execution',
  'langgraph/subgraphs',
  'langgraph/time-travel',
  'langgraph/deployment-runtime',
  'deep-agents/planning',
  'deep-agents/filesystem',
  'deep-agents/subagents',
  'deep-agents/memory',
  'deep-agents/skills',
  'deep-agents/sandboxes',
] as const;

test.describe('Production: Angular example apps load', () => {
  for (const cap of CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const url = `${EXAMPLES_URL}/${cap}/`;
      const res = await page.goto(url, { timeout: 15000 });
      expect(res?.status()).toBe(200);
      await expect(page.locator('cp-chat')).toBeVisible({ timeout: 10000 });
    });
  }
});

test.describe('Production: cockpit Run mode embeds examples', () => {
  test('cockpit loads with sidebar navigation', async ({ page }) => {
    await page.goto('/', { timeout: 15000 });
    await expect(page.getByRole('navigation', { name: 'Cockpit navigation' })).toBeVisible();
    // No overview entries should appear
    const links = await page.locator('nav a').allTextContents();
    const overviewLinks = links.filter((t) => t.toLowerCase().includes('overview'));
    expect(overviewLinks).toHaveLength(0);
  });
});

test.describe('Production: send/receive smoke test', () => {
  test.skip(() => !process.env['OPENAI_API_KEY'], 'Requires OPENAI_API_KEY');

  // Test a representative subset: one LangGraph, one Deep Agent
  for (const cap of ['langgraph/streaming', 'deep-agents/planning'] as const) {
    test(`${cap} sends and receives a message`, async ({ page }) => {
      await page.goto(`${EXAMPLES_URL}/${cap}/`, { timeout: 15000 });
      await expect(page.locator('cp-chat')).toBeVisible({ timeout: 10000 });

      await page.fill('input[name="prompt"]', 'hello');
      await page.click('button[type="submit"]');

      await expect(page.locator('.cp-message--ai')).toBeVisible({ timeout: 30000 });
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/e2e/production-smoke.spec.ts
git commit -m "test(cockpit): add production smoke test for deployed examples"
```

---

### Task 7: Add production smoke job to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add production-smoke job**

Add a new job after the `deploy` job in `.github/workflows/ci.yml`:

```yaml
  production-smoke:
    name: Production smoke
    needs: [deploy]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Verify LangGraph backends
        run: npx tsx scripts/verify-langgraph-deployments.ts
      - name: Run production smoke tests
        run: npx playwright test apps/cockpit/e2e/production-smoke.spec.ts --reporter=list
        env:
          BASE_URL: https://cockpit.cacheplane.ai
          EXAMPLES_URL: https://examples.cacheplane.ai
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Also update the `deploy` job's `needs` list in the final deploy step (the `Deploy → Vercel` job) if it has downstream dependencies, and add `production-smoke` to any `needs` lists that reference `deploy`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add production smoke test job after deploy"
```

---

### Task 8: Manual Vercel setup and first deploy

This task is performed manually — not code changes.

- [ ] **Step 1: Create the examples Vercel project**

In the Vercel dashboard:
1. Create a new project named `cockpit-examples` in the `cacheplane` org
2. Set the framework to "Other" (static)
3. Link to the `angular` GitHub repo
4. Set the root directory to `.` (workspace root)
5. Note the project ID

- [ ] **Step 2: Add GitHub secrets**

In GitHub repo Settings → Secrets:
1. Add `VERCEL_EXAMPLES_PROJECT_ID` with the project ID from Step 1
2. Verify `OPENAI_API_KEY` is set (needed for production smoke tests)

- [ ] **Step 3: Set cockpit env var in Vercel**

In the cockpit Vercel project settings → Environment Variables:
1. Add `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` = `https://examples.cacheplane.ai`
2. Apply to Production environment

- [ ] **Step 4: Set examples domain in Vercel**

In the examples Vercel project settings → Domains:
1. Add `examples.cacheplane.ai`
2. Configure DNS (CNAME to `cname.vercel-dns.com`)

- [ ] **Step 5: Trigger initial deploy**

Push all committed changes to `main`. The CI pipeline will:
1. Build and deploy the cockpit (picks up `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL`)
2. Build and deploy the Angular examples to `examples.cacheplane.ai`
3. Run the production smoke test

- [ ] **Step 6: Verify end-to-end**

```bash
# Verify backends
npx tsx scripts/verify-langgraph-deployments.ts --smoke

# Verify examples load
for cap in langgraph/streaming langgraph/persistence deep-agents/planning; do
  curl -s -o /dev/null -w "%{http_code} $cap\n" "https://examples.cacheplane.ai/$cap/"
done

# Verify cockpit
curl -s -o /dev/null -w "%{http_code} cockpit\n" "https://cockpit.cacheplane.ai"

# Run full production smoke
BASE_URL=https://cockpit.cacheplane.ai \
EXAMPLES_URL=https://examples.cacheplane.ai \
npx playwright test apps/cockpit/e2e/production-smoke.spec.ts --reporter=list
```

Expected: all health checks return 200, smoke tests pass.
