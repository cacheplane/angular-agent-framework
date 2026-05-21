# Licensing Verification Runtime (PR C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop on the `@ngaf/chat` relicense: get the production public key into the published bundle by wiring `CACHEPLANE_LICENSE_PUBLIC_KEY` into `publish.yml`; deploy the existing `apps/minting-service` to Vercel via CI so Stripe webhooks land somewhere live; fix a known idempotency bug in `runLicenseCheck`; document the `provideChat({ license })` convention; and wire one example app to read a license string from a build-time env so the verify path is exercised in routine CI.

**Architecture:** Mostly operational and infrastructure work — the crypto, minting code, and Stripe handler all already exist. Three repo edits: a one-line workflow env addition, a new ~30-line `minting-deploy` CI job mirroring the existing `deploy` job patterns, and a small `run-license-check.ts` fix. Plus library docs and an example wiring that's a no-op when `NGAF_LICENSE_TOKEN` is unset.

**Tech Stack:** GitHub Actions (existing `.github/workflows/{publish,ci}.yml`), Vercel CLI (deploy step), Vitest (the existing licensing spec), Angular 20 + Vite environment (example app build-time defines).

**Reference:** Spec at `docs/superpowers/specs/2026-05-20-licensing-verification-runtime-design.md`.

---

## File map

- **Modify:** `libs/licensing/src/lib/run-license-check.ts` — fix the idempotency bug (return cached `LicenseStatus`, not the constant `'licensed'`).
- **Modify:** `libs/licensing/src/lib/run-license-check.spec.ts` — add a regression test for the idempotency fix.
- **Modify:** `.github/workflows/publish.yml` — add `env: CACHEPLANE_LICENSE_PUBLIC_KEY: ${{ secrets.CACHEPLANE_LICENSE_PUBLIC_KEY }}` to the build step that runs `nx ... build ...licensing`.
- **Modify:** `.github/workflows/ci.yml` — add a `minting-deploy` job parallel to the existing website/cockpit/examples/demo deploys.
- **Modify:** `libs/chat/README.md` — add a short "Using a commercial license" section.
- **Modify:** `examples/chat/angular/src/app/app.config.ts` — add a `provideChat({ license })` provider that reads from a build-time define.
- **Modify:** `examples/chat/angular/src/environments/environment.ts` and `environment.development.ts` — add `license?: string` to the environment type if not present.
- **Modify:** `examples/chat/angular/project.json` — wire a Vite/Webpack define for `NGAF_LICENSE_TOKEN` from env at build time.

**Operational (not code; document in PR description):**
- Set GH secret `VERCEL_MINTING_PROJECT_ID = prj_3x6SBua2bmAk374uFrp0MdqZSe9u`.
- In Vercel UI: assign `minting.threadplane.ai` to the `threadplane-minting-service` project.
- In Stripe Dashboard: point the live webhook endpoint at `https://minting.threadplane.ai/api/stripe-webhook`.

No changes to `libs/chat/src/`, `libs/render/`, `libs/agent/`, `libs/langgraph/`, `libs/ag-ui/`, `libs/a2ui/`, `libs/telemetry/`, `libs/design-tokens/`, the cockpit, the website, or any other example app.

---

## Task 1: Fix `runLicenseCheck` idempotency bug

**Files:**
- Modify: `libs/licensing/src/lib/run-license-check.ts`
- Modify: `libs/licensing/src/lib/run-license-check.spec.ts`

**Background:** The current `runLicenseCheck` has a `done: Set<string>` keyed by `${package}|${token}`. On a second call with the same key, it returns the constant string `'licensed'` regardless of what the actual status was. This means: a no-token first call returns `'missing'` (correctly), but a no-token second call returns `'licensed'` (incorrectly). The fix is to cache the computed `LicenseStatus` on the dedup record and return *that*.

- [ ] **Step 1: Write the failing regression test**

Use Edit on `libs/licensing/src/lib/run-license-check.spec.ts`. Add this test inside the existing `describe('runLicenseCheck', () => { ... })` block (before the closing `});` brace; if there's already an `it('is idempotent...')` style test, place this one immediately after it):

```ts
  it('returns the cached actual status on repeat calls, not a constant', async () => {
    // No-token first call: status should be 'missing' (production) or
    // 'noncommercial' (dev). Force the production posture so we get 'missing'.
    const result1 = await runLicenseCheck({
      package: '@ngaf/chat',
      token: undefined,
      publicKey: kp.publicKey,
      isNoncommercial: false,
      warn,
    });
    expect(result1).toBe('missing');

    // Second call with the same (package, token) tuple: must return the
    // same status that was computed, not the literal 'licensed'.
    const result2 = await runLicenseCheck({
      package: '@ngaf/chat',
      token: undefined,
      publicKey: kp.publicKey,
      isNoncommercial: false,
      warn,
    });
    expect(result2).toBe('missing');
  });
```

- [ ] **Step 2: Run the test and confirm it fails as expected**

Run from repo root: `npx vitest run libs/licensing/src/lib/run-license-check.spec.ts 2>&1 | tail -20`
Expected: the new test fails with `Expected: "missing" / Received: "licensed"`.

- [ ] **Step 3: Apply the fix**

Use Edit on `libs/licensing/src/lib/run-license-check.ts`. Replace the existing `done` set declaration and the cached-path return with a `Map` that stores the computed status:

Find:

```ts
const done = new Set<string>();

export async function runLicenseCheck(
  options: RunLicenseCheckOptions,
): Promise<LicenseStatus> {
  const key = `${options.package}|${options.token ?? ''}`;
  if (done.has(key)) {
    // Idempotent: re-running with identical inputs is a no-op.
    return 'licensed';
  }
  done.add(key);
```

Replace with:

```ts
const done = new Map<string, LicenseStatus>();

export async function runLicenseCheck(
  options: RunLicenseCheckOptions,
): Promise<LicenseStatus> {
  const key = `${options.package}|${options.token ?? ''}`;
  const cached = done.get(key);
  if (cached !== undefined) {
    // Idempotent: re-running with identical inputs returns the same status
    // that was computed on the first call (not a hard-coded 'licensed').
    return cached;
  }
```

Then find the last line of the function:

```ts
  emitNag(evaluated, { package: options.package, warn: options.warn });

  return evaluated.status;
}
```

Replace with:

```ts
  emitNag(evaluated, { package: options.package, warn: options.warn });

  done.set(key, evaluated.status);
  return evaluated.status;
}
```

Then update the test-only reset function. Find:

```ts
/** @internal testing hook only. */
export function __resetRunLicenseCheckStateForTests(): void {
  done.clear();
}
```

Confirm `done.clear()` still works — it's a `Map` now, so `.clear()` is still valid. No change needed to that function.

- [ ] **Step 4: Run the test to confirm pass**

Run: `npx vitest run libs/licensing/src/lib/run-license-check.spec.ts 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 5: Run the broader licensing test suite for regressions**

Run: `npx nx run licensing:test 2>&1 | tail -8`
Expected: `Successfully ran target test for project licensing`.

- [ ] **Step 6: Commit**

```bash
git add libs/licensing/src/lib/run-license-check.ts libs/licensing/src/lib/run-license-check.spec.ts
git commit -m "$(cat <<'EOF'
fix(licensing): runLicenseCheck idempotency returns cached status

Previously, repeat calls with the same (package, token) tuple short-
circuited to the literal 'licensed' regardless of what was actually
computed on the first call. That hid 'missing' / 'expired' / 'tampered'
statuses from any caller that invoked the check twice.

Switches the dedup `Set<string>` to a `Map<string, LicenseStatus>` and
returns the cached actual status. Adds a regression test for the
no-token path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `CACHEPLANE_LICENSE_PUBLIC_KEY` into `publish.yml`

**Files:**
- Modify: `.github/workflows/publish.yml`

**Background:** The repo already has a GH Actions secret `CACHEPLANE_LICENSE_PUBLIC_KEY` (set 2026-04-30) and the licensing build's prebuild script `libs/licensing/scripts/generate-public-key.mjs` reads it as an env var. But no workflow currently injects the secret as an env var for that step, so published `@ngaf/chat` bundles ship with the dev fixture key. Fix: add the env injection to the build step.

- [ ] **Step 1: Read the build step**

Run: `grep -n "nx run-many\|build\|licensing" .github/workflows/publish.yml | head -20`
Confirm there's a build step around line 51 invoking `npx nx run-many -t lint,test,build --projects=$NPM_PUBLISHABLE_PROJECTS`. The `licensing` project is in that list (per `NPM_PUBLISHABLE_PROJECTS=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry`).

- [ ] **Step 2: Read the surrounding YAML for indentation**

Run: `sed -n '40,60p' .github/workflows/publish.yml`
Capture the exact indentation of the `run:` line — the `env:` block must be a sibling.

- [ ] **Step 3: Add the env injection**

Use Edit on `.github/workflows/publish.yml`. Find the lint/test/build step (the one with `run: npx nx run-many -t lint,test,build --projects=$NPM_PUBLISHABLE_PROJECTS --skip-nx-cache`). Add an `env:` block at the same indentation level as the `run:` key. The final shape of the step should look like (preserving exact indentation from your sed output):

```yaml
      - name: Lint, test, and build publishable libraries
        env:
          CACHEPLANE_LICENSE_PUBLIC_KEY: ${{ secrets.CACHEPLANE_LICENSE_PUBLIC_KEY }}
        run: npx nx run-many -t lint,test,build --projects=$NPM_PUBLISHABLE_PROJECTS --skip-nx-cache
```

(If the existing step already has an `env:` block, add the new line inside it instead of creating a duplicate `env:`.)

- [ ] **Step 4: Validate YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish.yml')); print('ok')"`
Expected: `ok`. If you see a YAMLError, your indentation is off — re-check Step 2's sed output.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "$(cat <<'EOF'
ci(publish): inject CACHEPLANE_LICENSE_PUBLIC_KEY into licensing build

The GH secret existed since 2026-04-30 but was never referenced by any
workflow. As a result, the published @ngaf/chat bundle baked in the
dev-fixture public key from libs/licensing/fixtures/dev-public-key.hex
— meaning real license tokens signed by the minting service would not
verify in consumer apps.

This single-line addition wires the secret into the env block of the
build step that runs `nx ... build ... licensing`. The existing
prebuild script (libs/licensing/scripts/generate-public-key.mjs)
already reads the env var and emits the prod hex into
license-public-key.generated.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `minting-deploy` job to `ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

**Background:** Five Vercel projects deploy from CI today: `threadplane` (website), `threadplane-cockpit`, `threadplane-examples`, `threadplane-demo`, and a sixth that varies. The `threadplane-minting-service` Vercel project exists (project ID `prj_3x6SBua2bmAk374uFrp0MdqZSe9u`) and has all needed runtime env vars set — it's just not in the CI deploy step. We add it parallel to the existing patterns.

- [ ] **Step 1: Read the existing demo-deploy step as the template**

Run: `sed -n '545,580p' .github/workflows/ci.yml`
This is the `threadplane-demo` deploy block — confirm the structure: `mkdir -p .vercel` → write `.vercel/project.json` → `vercel pull` → `vercel build` (optional; demo uses `assemble-demo.ts` first) → `vercel deploy --prebuilt --prod`. The minting service has its own `apps/minting-service/vercel.json` so we can skip the assemble step.

- [ ] **Step 2: Find where to insert the new job**

Run: `grep -n "^\s*deploy:\|^\s*[a-z-]*-deploy:\|^\s*production-smoke:" .github/workflows/ci.yml`
This locates the job boundaries. Insert the new `minting-deploy:` job AFTER the existing demo deploy block and BEFORE the `production-smoke:` job (so `production-smoke` can `needs:` it later).

- [ ] **Step 3: Add the minting-deploy job**

Use Edit on `.github/workflows/ci.yml` to insert this new job at the position identified in Step 2. The exact indentation of `minting-deploy:` must match the existing top-level jobs (typically 2 spaces).

```yaml
  minting-deploy:
    name: Minting service deploy
    needs: [library]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v6.0.2
      - name: Use Node.js 22
        uses: actions/setup-node@v6.0.0
        with:
          node-version: 22
      - name: Install pnpm
        uses: pnpm/action-setup@v4.1.0
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Deploy minting service to Vercel (production)
        working-directory: apps/minting-service
        run: |
          mkdir -p .vercel
          cat > .vercel/project.json <<EOF
          {"projectId":"${{ secrets.VERCEL_MINTING_PROJECT_ID }}","orgId":"${{ secrets.VERCEL_ORG_ID }}","projectName":"threadplane-minting-service"}
          EOF
          npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          npx vercel deploy --prebuilt --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
      - name: Verify minting service health
        env:
          MINTING_URL: https://minting.threadplane.ai
        run: |
          for i in 1 2 3 4 5; do
            if curl -sf -o /dev/null "$MINTING_URL/api/health"; then
              echo "Minting service is healthy."
              exit 0
            fi
            echo "Waiting for minting service; attempt $i/5..."
            sleep 5
          done
          echo "::error::Minting service did not respond at $MINTING_URL/api/health"
          exit 1
```

`needs: [library]` matches the existing deploy jobs' dependency: they all wait for the `library` job (lint/test/build of the npm-publishable libs) before deploying. The `if:` gate restricts deploys to push events on `main`. The health-check loop matches the canonical-demo verify-stamp pattern.

(If the `production-smoke` job has a `needs:` list, optionally add `minting-deploy` to it so the smoke step can hit `/api/health` itself; this is optional and not blocking — leave it as a follow-up note in the PR if you don't make that edit.)

- [ ] **Step 4: Validate YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`.

- [ ] **Step 5: Confirm `VERCEL_MINTING_PROJECT_ID` is mentioned as a required secret**

Search for the secrets-comment block in `ci.yml` (around lines 424–428 the deploy job has a comment listing required secrets). Add `VERCEL_MINTING_PROJECT_ID — threadplane-minting-service project id` to that list if a similar comment exists in your new job's section or in a top-of-deploy block.

Run: `grep -n "VERCEL_.*PROJECT_ID" .github/workflows/ci.yml` and verify `VERCEL_MINTING_PROJECT_ID` appears at least once (in the new job's `.vercel/project.json` write) and ideally in any reference list.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: deploy apps/minting-service to threadplane-minting-service on push

The Vercel project (prj_3x6SBua2bmAk374uFrp0MdqZSe9u) exists with all
runtime env vars (LICENSE_SIGNING_PRIVATE_KEY_HEX, RESEND_API_KEY,
Neon Postgres set) but was never deployed via CI. Adds a parallel
deploy job mirroring the existing patterns, gated on push to main.

Requires GH secret VERCEL_MINTING_PROJECT_ID (operational; not in
this PR). Hits /api/health after deploy to confirm the service
returned 200 within 30s of going live.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add "Using a commercial license" section to `libs/chat/README.md`

**Files:**
- Modify: `libs/chat/README.md`

- [ ] **Step 1: Find the right insertion point**

Run: `grep -n "^## " libs/chat/README.md | head -10`
The README opens with the source-available framing and a top-level "Commercial use" section (added in PR A). After that, there are sections for runtime adapters, install, usage, etc.

Insert the new section "## Using a commercial license" immediately after the existing "## Commercial use" section and before whatever comes next (likely "## Runtime adapters" or "## Install").

- [ ] **Step 2: Add the section**

Use Edit on `libs/chat/README.md`. Find the existing block that ends the "Commercial use" section (the paragraph that ends `…the [Threadplane pricing page](https://threadplane.ai/pricing) for plans.`). Append the new section immediately after that paragraph:

```markdown
## Using a commercial license

After purchase, Threadplane emails a signed license token to the address on your receipt. Paste it into your app's `provideChat()` configuration:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideChat } from '@ngaf/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideChat({
      license: 'eyJ…',  // The token from your purchase email.
    }),
  ],
};
```

The library verifies the token's signature on boot. A missing, expired, or tampered token logs a `console.warn` advisory but does not block rendering — chat continues to work either way. Tokens are validated offline; no calls to Threadplane are made at runtime.

The license string is safe to commit to source control if your repository is private, or to read from a build-time env var for public repositories:

```typescript
declare const NGAF_LICENSE_TOKEN: string | undefined;

providers: [
  provideChat({
    license: typeof NGAF_LICENSE_TOKEN === 'string' ? NGAF_LICENSE_TOKEN : undefined,
  }),
],
```

(See `examples/chat/angular/` in the framework repo for a working example.)
```

(Note: the triple-backtick code blocks above are nested inside the markdown content of this plan file. When you write to `libs/chat/README.md`, the outer block delimiters should be plain triple-backticks; the inner `typescript` blocks remain as triple-backticks.)

- [ ] **Step 3: Verify the headings**

Run: `grep -n "^## " libs/chat/README.md | head -10`
Expected: the section "Using a commercial license" appears between "Commercial use" and the next pre-existing section.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/README.md
git commit -m "$(cat <<'EOF'
docs(chat): add "Using a commercial license" section to README

Shows the provideChat({ license: '…' }) snippet customers paste after
purchase, plus the build-time-define variant for public repos. Notes
that verification is offline and advisory (console.warn, no render
block) — matches PR C's enforcement policy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `examples/chat/angular/` to read `NGAF_LICENSE_TOKEN`

**Files:**
- Modify: `examples/chat/angular/src/app/app.config.ts`
- Modify: `examples/chat/angular/src/environments/environment.ts`
- Modify: `examples/chat/angular/src/environments/environment.development.ts`
- Modify: `examples/chat/angular/project.json`

**Background:** Today `examples/chat/angular/src/app/app.config.ts` doesn't call `provideChat()` at all. To exercise the verify path during smoke testing, the demo needs a `provideChat({ license })` call that reads a build-time env var. When `NGAF_LICENSE_TOKEN` is unset (default), `license: undefined` is passed and behavior matches today's. This means the demo stays unlicensed in main, but a smoke-test session can inject a real token via env.

- [ ] **Step 1: Add `license?: string` to environment types**

Use Edit on `examples/chat/angular/src/environments/environment.ts`. Find the environment object (typically `export const environment = { … }`). Add `license: undefined as string | undefined,` as a field. If the file declares an explicit type (e.g., `export const environment: Environment = …`), update that interface to include `license?: string`.

Do the same for `environment.development.ts`. Both files should expose the same shape.

- [ ] **Step 2: Update app.config.ts**

Use Edit on `examples/chat/angular/src/app/app.config.ts`. Find the imports block and the `providers` array. Modify the file as follows:

Find the import line:

```ts
import { LANGGRAPH_THREADS_CONFIG } from '@ngaf/langgraph';
```

Add immediately after it:

```ts
import { provideChat } from '@ngaf/chat';
```

In the `providers: [ … ]` array, add `provideChat()` AS THE LAST entry (after the existing `LANGGRAPH_THREADS_CONFIG` provider):

```ts
    // Optional license token, populated by a Vite/Webpack build-time
    // define from NGAF_LICENSE_TOKEN env var. Undefined in normal dev,
    // letting @ngaf/chat run in advisory/noncommercial mode. Set for
    // smoke tests against the verify path.
    provideChat({
      license: environment.license,
    }),
```

- [ ] **Step 3: Wire the build-time define in project.json**

Read `examples/chat/angular/project.json`:

```
cat examples/chat/angular/project.json | python3 -m json.tool | head -60
```

Find the `targets.build` config (likely under `executor: "@angular/build:application"` or similar). The simplest approach is **not** to use a build-time `define` (Angular's CLI doesn't support arbitrary Vite-style defines easily) but instead to use a `fileReplacements` strategy or to read at deploy time. Given the constraint, do the simplest thing: use the existing `environment.ts` / `environment.development.ts` pattern.

For the **runtime** value, we let the deploy step set the value by overwriting the environment file. Add a one-line script step or a `prebuild` hook in `examples/chat/angular/project.json` that runs `node tools/inject-license-token.mjs` (we don't have to create this script in this PR — the env-var injection happens at the deploy level via `vercel build` reading `NGAF_LICENSE_TOKEN` env from Vercel project settings, then a small shell line in the deploy step that rewrites `environment.ts` before `vercel build`).

**Concretely for this PR:** stop at the level of "the code reads `environment.license`; setting it during deploy is operational." Update the file map note accordingly — `examples/chat/angular/project.json` does NOT need a change in this PR. Smoke-test runbook in the spec explains how to set it locally during a smoke session.

Remove `examples/chat/angular/project.json` from the **Files** list at the top of this task — it does not need to change.

- [ ] **Step 4: Type-check + lint + test the example**

From repo root:
```
npx nx run examples-chat-angular:lint 2>&1 | tail -5
npx nx run examples-chat-angular:build 2>&1 | tail -10
```
Both expected: success.

- [ ] **Step 5: Confirm behavior is unchanged when license is undefined**

Boot the dev server briefly: `npx nx serve examples-chat-angular --port 4400` in one shell. From another shell or browser, hit `http://localhost:4400/`. Confirm the page loads without errors. Stop the dev server.

(With `environment.license = undefined`, `provideChat({ license: undefined })` triggers `runLicenseCheck` with no token; `inferNoncommercial()` should return `true` in dev mode, so the status is `'noncommercial'` and a single `console.warn` is emitted — that's the expected baseline.)

- [ ] **Step 6: Commit**

```bash
git add examples/chat/angular/src/app/app.config.ts examples/chat/angular/src/environments/environment.ts examples/chat/angular/src/environments/environment.development.ts
git commit -m "$(cat <<'EOF'
feat(examples-chat): wire optional @ngaf/chat license into app.config

Adds provideChat({ license: environment.license }) so a smoke-test
session can drop a real token into environment.ts and exercise the
verify path end-to-end. When license is undefined (the default in
main), the demo behaves identically to today: runLicenseCheck fires
once advisorily, status is 'noncommercial' under dev NODE_ENV, no
blocking. The token is intentionally absent from environment.ts so
the demo stays unlicensed in main.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Licensing tests**

Run: `npx nx run licensing:test 2>&1 | tail -8`
Expected: `Successfully ran target test for project licensing`.

- [ ] **Step 2: Chat tests (regression check — no library code changed but `provideChat` is exercised in the example)**

Run: `npx nx run chat:test 2>&1 | tail -8`
Expected: `Successfully ran target test for project chat`.

- [ ] **Step 3: Examples chat build**

Run: `npx nx run examples-chat-angular:build 2>&1 | tail -8`
Expected: `Successfully ran target build for project examples-chat-angular`.

- [ ] **Step 4: Workflow YAML validation (both files)**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"
```
Expected: `ok`.

- [ ] **Step 5: Scope check**

```bash
git diff --name-only origin/main..HEAD | grep -vE '^(libs/licensing/|libs/chat/README\.md|\.github/workflows/(publish|ci)\.yml|examples/chat/angular/|docs/superpowers/)' | head
```
Expected: empty.

- [ ] **Step 6: Confirm operational gaps documented in PR description**

When opening the PR, include a checklist of operational tasks that close the loop:

```
- [ ] Add GH secret `VERCEL_MINTING_PROJECT_ID = prj_3x6SBua2bmAk374uFrp0MdqZSe9u`
- [ ] Assign domain `minting.threadplane.ai` to the threadplane-minting-service Vercel project
- [ ] Point Stripe live-mode webhook at https://minting.threadplane.ai/api/stripe-webhook
- [ ] After PR merges, on first publish of @ngaf/chat: confirm dist/libs/licensing/fesm2022/*.mjs contains the prod public-key hex (not the dev fixture 793132582f3d…)
- [ ] Execute the end-to-end smoke test runbook from docs/superpowers/specs/2026-05-20-licensing-verification-runtime-design.md
```

---

## Self-review

**Spec coverage:**
- Spec § Idempotency bug fix → Task 1 (both source fix + regression test). ✓
- Spec § CI public-key injection → Task 2. ✓
- Spec § Minting service CI deploy → Task 3. ✓
- Spec § `provideChat({ license })` documentation → Task 4. ✓
- Spec § Example wiring → Task 5. ✓
- Spec § Smoke test runbook → not in plan; that's operational, runs from the spec post-merge. ✓
- Spec § Operational tasks (GH secret, Vercel domain, Stripe webhook URL) → Task 6 Step 6 (documented in PR description). ✓
- Spec out-of-scope items (origin allowlist, claims schema, nag UI, render block) → not in plan. ✓

**Placeholder scan:** No TBD/TODO. Task 5's Step 3 explicitly walks back the originally-planned `project.json` build-define change to "operational, not in this PR" — that's documented inline as a deliberate scope decision, not a placeholder.

**Type consistency:** `LicenseStatus` import in Task 1 is consistent with the existing module. `provideChat`, `ChatConfig.license` consistent across Tasks 4 and 5. `environment.license` is the same field name in environment.ts, environment.development.ts, and app.config.ts.

Plan complete.
