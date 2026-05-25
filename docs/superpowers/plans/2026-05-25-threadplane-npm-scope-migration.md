# Threadplane npm Scope Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the npm package scope from `@ngaf` to `@threadplane`, update current public references from NGAF to Threadplane/threadplane where appropriate, merge the PR only after green CI and local canonical chat validation, then manually deploy all public packages under the new org from the merged commit.

**Architecture:** This is a breaking rename with no backwards compatibility. Package names, TypeScript path aliases, source imports, docs, generated public agent context, release checks, and smoke tooling move to `@threadplane/*`. Sticky runtime identifiers are handled deliberately: some move now because they are package-facing, while externally persisted identifiers such as telemetry events, CSS custom properties, Stripe metadata, and env vars either get explicit compatibility handling or are left in place with documented follow-up if a clean break is unsafe.

**Tech Stack:** npm workspaces, Nx 22, Angular 21, ng-packagr, Playwright, Vitest, GitHub Actions, npm manual publishing, canonical chat demo (`examples/chat/angular`, `examples/chat/python`, `examples/chat/smoke`).

---

## Ground Rules

- No backwards compatibility for package names: do not add `@ngaf/*` alias packages, re-export packages, bridge path aliases, or old package install docs.
- Do not blindly replace every `ngaf` substring. Classify each reference as package scope, product prose, internal code symbol, runtime storage key, CSS variable, telemetry event, Stripe metadata, historical artifact, or generated output.
- Leave historical artifacts alone unless they block current docs generation: `CHANGELOG.md`, old `docs/superpowers/**`, and old GTM reports preserve history.
- Current public docs and generated public agent context must reflect Threadplane and `@threadplane/*`.
- Use root `npm` and repo-native `npx nx ...` commands. Do not substitute pnpm.
- The user will manually create npm OIDC trusted publishing after this migration. The PR must support manual package deployment first.

## Package Scope Decisions

### Public release group

These seven packages are the manual deployment set and remain the only `nx release` publish group:

- `@threadplane/a2ui` from `libs/a2ui`
- `@threadplane/ag-ui` from `libs/ag-ui`
- `@threadplane/chat` from `libs/chat`
- `@threadplane/langgraph` from `libs/langgraph`
- `@threadplane/licensing` from `libs/licensing`
- `@threadplane/render` from `libs/render`
- `@threadplane/telemetry` from `libs/telemetry`

### Internal package names

- Rename `@ngaf-internal/e2e-harness` to `@threadplane-internal/e2e-harness`.
- Rename private workspace package names under `libs/`, `apps/`, `marketing/`, and `tools/` to `@threadplane/*` where they currently use `@ngaf/*`.
- Rename cockpit/demo manifests under `cockpit/**/package.json` to `@threadplane/*`. Also add `"private": true` to cockpit/demo manifests that are not intended for npm release and do not have `nx-release-publish`.

### Runtime identifiers

Handle these separately from package scope:

- `NGAF_CHAT_DEBUG`: rename to `THREADPLANE_CHAT_DEBUG` in build defines and source because it is an app build-time flag. No compatibility required.
- `NGAF_CHAT_STREAM_TRACE`: rename to `THREADPLANE_CHAT_STREAM_TRACE` in tests/source/docs because it is a local debug harness key. No compatibility required unless existing tests require fixture migration.
- `NGAF_LICENSE`: rename docs and source to `THREADPLANE_LICENSE`; keep a short compatibility read of `NGAF_LICENSE` only if the licensing runtime already reads env vars directly. If only docs reference it, do not support the old name.
- `NGAF_TELEMETRY_*`: do not rename blindly. Because this is an external package opt-out and ingest contract, either preserve current env vars for the first `@threadplane/telemetry` release or implement explicit new `THREADPLANE_TELEMETRY_*` names with `NGAF_*` fallback and tests. The implementation owner must make the choice visible in PR notes.
- `ngaf:*` telemetry events: preserve unless the telemetry taxonomy, dashboards, and quality checks are migrated together. Renaming event names is not required for npm scope migration.
- `--ngaf-chat-*` CSS custom properties: preserve unless every consumer stylesheet, theming doc, screenshot/e2e expectation, and cockpit example is migrated in one task. These are public styling API and should not be changed by package-scope search/replace.
- `ngaf_tier_slug` and `ngaf_billing_cycle` Stripe metadata: preserve for existing Stripe products unless the Stripe sync script migrates metadata with a one-time operational runbook.

---

## Task 0: Branch, Preflight, and Audit Snapshot

**Files:**
- Read: `AGENTS.md`
- Read: `package.json`
- Read: `nx.json`
- Read: `.github/workflows/publish.yml`
- Read: `tsconfig.base.json`
- Read: `docs/RELEASE.md`
- Read: `examples/chat/angular/project.json`
- Read: `examples/chat/smoke/cli.mjs`

- [ ] **Step 0.1: Create an isolated branch**

Run:

```bash
git status --short --branch
git switch -c codex/threadplane-npm-scope
```

Expected: clean or only known user changes before branch creation. Stop and inspect if unrelated dirty files exist.

- [ ] **Step 0.2: Confirm npm org state**

Run:

```bash
npm view @threadplane/chat name version 2>&1 || true
npm view @ngaf/chat name version 2>&1 || true
npm org ls threadplane 2>&1 || true
```

Expected: `@threadplane/chat` is unpublished or controlled by the user. If `@threadplane/*` packages already exist, verify ownership before continuing.

- [ ] **Step 0.3: Snapshot current reference counts**

Run:

```bash
rg -l '@ngaf|@ngaf-internal|NGAF|ngaf|Ngaf|ThreadPlane|Angular Agent Framework' \
  -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' | wc -l
rg -n '@ngaf|@ngaf-internal' tsconfig.base.json package-lock.json libs apps examples cockpit marketing tools .github scripts docs/RELEASE.md README.md COMMERCIAL.md \
  -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' | wc -l
rg -n 'NGAF|ngaf|Ngaf' libs apps examples cockpit marketing tools pricing scripts README.md COMMERCIAL.md gtm.md \
  -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' | wc -l
```

Expected: counts captured in the PR description. Counts do not need to match this plan exactly because the repo may have moved.

---

## Task 1: Rename Package Scope and Workspace Resolution

**Files:**
- Modify: `tsconfig.base.json`
- Modify: `package-lock.json`
- Modify: all current workspace `package.json` files with `@ngaf/*`, except archival examples under `docs/superpowers/**`
- Modify: source imports in `libs/**`, `apps/**`, `examples/**`, `cockpit/**`, `marketing/**`, `tools/**`
- Modify: `examples/chat/angular/project.json`
- Modify: `examples/chat/smoke/template/package.json`
- Modify: `examples/chat/smoke/cli.mjs`
- Modify: `examples/chat/smoke/project.json`

- [ ] **Step 1.1: Rewrite scoped package specifiers**

Use a script or structured edit to apply these exact rules outside `node_modules`, `dist`, `coverage`, `tmp`, `CHANGELOG.md`, and `docs/superpowers/**`:

```text
@ngaf/ -> @threadplane/
@ngaf-internal/ -> @threadplane-internal/
```

Expected: package names, peer deps, imports, stylesheet package imports, docs install snippets, and generated public context source templates use `@threadplane/*`.

- [ ] **Step 1.2: Rename obvious code aliases**

Update exported/imported alias names that embed `Ngaf` only as old branding:

```text
NgafChatComponent -> ThreadplaneChatComponent
NGAF_PACKAGES -> THREADPLANE_PACKAGES
```

Do not rename Angular selectors, CSS class names, or public component selectors unless the selector itself contains `ngaf`.

- [ ] **Step 1.3: Add non-interactive smoke consumer mode**

Update `examples/chat/smoke/cli.mjs` and `examples/chat/smoke/project.json` so CI/local verification can run without prompts and without requiring already-published `@threadplane/*` packages.

Required behavior:

- `npx nx run examples-chat-smoke:run` may stay interactive for humans.
- Add a non-interactive target such as `examples-chat-smoke:verify-local` that passes explicit flags or env vars.
- The non-interactive mode must accept package specifiers for the complete package closure, not only a version from `npm view`.
- It must support local tarballs generated from the complete public package closure: `dist/libs/{a2ui,ag-ui,chat,langgraph,licensing,render,telemetry}`. Preferred simple path: `npm pack dist/libs/<pkg> --pack-destination tmp/threadplane-packs`, then write `file:<tarball>` specs into the smoke template for every `@threadplane/*` dependency that could otherwise resolve from npm.
- It must run `npm install` and a deterministic build or test command, then exit. It must not start a long-running `npm start` server unless an explicit flag requests it.

Expected: pre-publish smoke validates built package artifacts locally; post-publish smoke can still validate npm-installed packages.

- [ ] **Step 1.4: Reconcile the lockfile**

Run:

```bash
npm install
```

Expected: `package-lock.json` rewrites workspace package names to `@threadplane/*`. Do not delete the lockfile first.

- [ ] **Step 1.5: Preserve cross-platform native bindings**

Run:

```bash
grep -c '"node_modules/@next/swc-' package-lock.json
```

Expected: at least the existing platform spread is preserved. If the count collapses, restore the lockfile and rerun a targeted `npm install` without deleting it.

- [ ] **Step 1.6: Verify no old package specifiers remain in current code**

Run:

```bash
rg -n '@ngaf|@ngaf-internal' \
  -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' \
  -g '!CHANGELOG.md' -g '!docs/superpowers/**'
```

Expected: no current-code matches. Any remaining match must be explicitly justified in the PR.

---

## Task 2: Update Release, Publish, and Manual Deployment Tooling

**Files:**
- Modify: `nx.json`
- Modify: `.github/workflows/publish.yml`
- Modify: `scripts/verify-release-versions.mjs`
- Modify: `scripts/verify-release-versions.spec.mjs`
- Modify: `libs/telemetry/scripts/apply-install-telemetry.mjs`
- Modify: `libs/telemetry/scripts/assemble-dist.mjs`
- Modify: `libs/telemetry/scripts/assemble-dist.spec.mjs`
- Modify: `libs/telemetry/scripts/verify-install-telemetry.mjs`
- Modify: `libs/telemetry/scripts/smoke-install-telemetry.mjs`
- Modify: telemetry script specs under `libs/telemetry/scripts/*.spec.mjs`
- Modify: `docs/RELEASE.md`

- [ ] **Step 2.1: Keep fixed release group unchanged by project names**

In `nx.json`, keep the `publishable` project list as:

```json
["chat", "langgraph", "ag-ui", "render", "a2ui", "licensing", "telemetry"]
```

Expected: project names do not change; package names do.

- [ ] **Step 2.2: Update release verification scope**

Change `scripts/verify-release-versions.mjs` from checking `packageName.startsWith('@ngaf/')` to `packageName.startsWith('@threadplane/')`.

Update its tests to create `@threadplane/*` package names and to reject omitted public `@threadplane/*` packages.

- [ ] **Step 2.3: Update publish workflow comments and dry-run behavior**

In `.github/workflows/publish.yml`:

- Keep `id-token: write`, but note trusted publishing setup will be manual after migration.
- Keep the publishable project env var.
- Update comments that mention `@ngaf/*` to `@threadplane/*`.
- Add or document a manual workflow dry-run expectation before tag publish.

- [ ] **Step 2.4: Update telemetry install and dist assembly scripts for package names**

Ensure telemetry scripts inspect or print `@threadplane/*` package names. Do not rename telemetry env vars or event names in this task unless Task 3 chooses to migrate them with tests.

Required telemetry package artifact decisions:

- `TELEMETRY_DEP` becomes `@threadplane/telemetry`.
- `POSTINSTALL` uses the new bin name `threadplane-telemetry-postinstall || true`.
- `libs/telemetry/package.json` `bin` key becomes `threadplane-telemetry-postinstall`.
- `libs/telemetry/package.json` and `libs/telemetry/scripts/assemble-dist.mjs` export paths must match the actual Angular package output after rename. Expected path is `./browser/fesm2022/threadplane-telemetry.mjs`, but verify from a real build instead of assuming.
- `assemble-dist.mjs` looks for the generated browser type entry. Update `browser/types/ngaf-telemetry.d.ts` to the actual renamed type file, expected `browser/types/threadplane-telemetry.d.ts`.

Run after changes:

```bash
npx nx build telemetry --skip-nx-cache
node libs/telemetry/scripts/assemble-dist.mjs
node --test libs/telemetry/scripts/assemble-dist.spec.mjs libs/telemetry/scripts/verify-install-telemetry.spec.mjs libs/telemetry/scripts/smoke-install-telemetry.spec.mjs
```

Expected: `dist/libs/telemetry/package.json` names `@threadplane/telemetry`, exposes `./browser` through existing files, and has no `ngaf-telemetry-postinstall` or `ngaf-telemetry.mjs` references unless explicitly justified.

- [ ] **Step 2.5: Update release runbook for manual deployment**

In `docs/RELEASE.md`, document the first manual deployment under `@threadplane`:

```bash
git checkout main
git pull --ff-only
npm ci
npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --skip-nx-cache
node libs/telemetry/scripts/apply-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing
node libs/telemetry/scripts/verify-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry
node libs/telemetry/scripts/smoke-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry
node scripts/verify-release-versions.mjs --tag v<version>
npx nx release publish --groups=publishable --dry-run
npm publish dist/libs/telemetry --access public
npm publish dist/libs/a2ui --access public
npm publish dist/libs/render --access public
npm publish dist/libs/licensing --access public
npm publish dist/libs/chat --access public
npm publish dist/libs/ag-ui --access public
npm publish dist/libs/langgraph --access public
```

Expected: telemetry publishes first because the install-telemetry patch injects `@threadplane/telemetry` into other public package manifests. Then publish leaf packages, then packages with peer references. If `nx release publish` is used manually instead of individual `npm publish`, the runbook must still list all seven package roots and a dry run.

---

## Task 3: Classify and Update NGAF References

**Files:**
- Modify: `README.md`
- Modify: `COMMERCIAL.md`
- Modify: `AGENTS.md`
- Modify: `apps/website/content/**`
- Modify: `apps/website/content/AGENTS.md.template`
- Modify: `apps/website/content/CLAUDE.md.template`
- Modify: `apps/website/public/AGENTS.md`
- Modify: `apps/website/public/CLAUDE.md`
- Modify: `apps/website/src/**`
- Modify: `examples/chat/angular/src/index.html`
- Modify: `examples/chat/smoke/CHECKLIST.md`
- Modify: `examples/chat/smoke/template/src/index.html`
- Modify: `libs/*/README.md`
- Inspect: `libs/telemetry/**`
- Inspect: `libs/chat/src/lib/styles/**`
- Inspect: `pricing/tiers.config.ts`
- Inspect: `scripts/stripe/sync-products.ts`
- Leave historical: `CHANGELOG.md`, `docs/superpowers/**`

- [ ] **Step 3.1: Normalize product casing**

Replace `ThreadPlane` with `Threadplane` in current source/docs. Keep URL/domain lowercase `threadplane.ai`.

- [ ] **Step 3.2: Update current public product prose**

Replace current public uses of:

```text
NGAF -> Threadplane
Angular Agent Framework -> Threadplane
Agent UI for Angular -> Threadplane
```

Use lowercase `agent UI for Angular` only when describing the product category, not as the product name.

- [ ] **Step 3.3: Update current public install snippets and badges**

Replace `@ngaf/*` npm badges, install commands, import examples, and generated public agent context with `@threadplane/*`.

- [ ] **Step 3.4: Update canonical chat demo titles and smoke text**

Use `Threadplane chat - canonical demo`, `Threadplane chat - smoke consumer`, and `Threadplane chat smoke checklist`. Keep ASCII punctuation in edited files.

- [ ] **Step 3.5: Decide each sticky identifier explicitly**

For each category below, either implement a tested rename or add a PR note explaining why it intentionally remains:

```text
NGAF_TELEMETRY_*
NGAF_TELEMETRY_CONFIG and Ngaf telemetry public API symbols
NGAF_LICENSE
NGAF_CHAT_DEBUG
NGAF_CHAT_STREAM_TRACE
ngaf:* telemetry events
--ngaf-chat-* CSS variables
ngaf_tier_slug / ngaf_billing_cycle Stripe metadata
ngaf-chat-demo:* localStorage keys
ngaf-example-projects-v1 localStorage key
data-ngaf-chat-theme and data-ngaf-chat-* attributes
```

Expected default decisions for this PR:

- Rename `NGAF_CHAT_DEBUG` and `NGAF_CHAT_STREAM_TRACE` to `THREADPLANE_*`.
- Rename docs for `NGAF_LICENSE` to `THREADPLANE_LICENSE`.
- Rename telemetry package-facing public API symbols, because these are exported from `@threadplane/telemetry` and no backwards compatibility is required:
  - `provideNgafTelemetry` -> `provideThreadplaneTelemetry`
  - `NgafTelemetryService` -> `ThreadplaneTelemetryService`
  - `NgafTelemetryConfig` -> `ThreadplaneTelemetryConfig`
  - `NGAF_TELEMETRY_CONFIG` -> `THREADPLANE_TELEMETRY_CONFIG`
  - Any other exported `Ngaf*` telemetry type names should become `Threadplane*`.
- Preserve `NGAF_TELEMETRY_*`, `ngaf:*`, `--ngaf-chat-*`, and Stripe metadata unless their full consumers and tests are migrated in the same task.
- Rename repo-local canonical demo storage/data identifiers to `threadplane-*` because no backwards compatibility is required:
  - `ngaf-chat-demo:*` -> `threadplane-chat-demo:*`
  - `ngaf-example-projects-v1` -> `threadplane-example-projects-v1`
  - `data-ngaf-chat-theme` -> `data-threadplane-chat-theme`
- Preserve `data-ngaf-chat-debug` and `data-ngaf-chat-sidebar` only if they are internal debug hooks tied to old CSS/test selectors; otherwise rename them with matching e2e updates.

- [ ] **Step 3.6: Remove misleading public package references**

Current docs mention packages that are not in the public release group. Do not mechanically rewrite those into new public `@threadplane/*` package claims.

Required cleanup:

- Remove or reword `@ngaf/agent` references because there is no `libs/agent/package.json`.
- Remove or reword `@ngaf/design-tokens` public-release references because `libs/design-tokens/package.json` is private and outside `nx.json` release group.
- If private packages are mentioned in contributor docs, label them as private workspace packages rather than published packages.

Expected: public-facing package lists contain only the seven release packages unless a package is clearly marked private/internal.

- [ ] **Step 3.7: Verify classified leftovers**

Run:

```bash
rg -n 'NGAF|ngaf|Ngaf|Angular Agent Framework|ThreadPlane|@ngaf|@ngaf-internal' \
  -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' \
  -g '!CHANGELOG.md' -g '!docs/superpowers/**'
```

Expected: only intentionally preserved runtime identifiers and historical references outside excluded paths. Save the remaining list in the PR description.

---

## Task 4: Regenerate Public Context and Docs

**Files:**
- Modify/generated: `apps/website/public/AGENTS.md`
- Modify/generated: `apps/website/public/CLAUDE.md`
- Modify/generated: website docs outputs touched by repo generators

- [ ] **Step 4.1: Regenerate public agent context**

Run:

```bash
npm run generate-agent-context
```

Expected: generated public context uses Threadplane and `@threadplane/*`.

- [ ] **Step 4.2: Regenerate API/narrative docs only if affected**

If API docs or narrative docs changed because imports/package names are embedded, run the smallest relevant generator:

```bash
npm run generate-api-docs
npm run generate-narrative-docs
```

Expected: generated docs do not reintroduce `@ngaf/*` current install/import guidance.

- [ ] **Step 4.3: Verify generated files did not rewrite historical docs**

Run:

```bash
git diff --name-only | rg '^docs/superpowers/' || true
```

Expected: this plan file may appear; old historical plans/specs should not be churned.

---

## Task 5: Local Verification Before PR

**Files:**
- Verify: full changed set
- Verify: canonical chat demo

- [ ] **Step 5.1: Run focused package checks**

Run:

```bash
npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --skip-nx-cache
```

Expected: all seven public packages pass lint/test/build.

- [ ] **Step 5.2: Run release and telemetry checks**

Run:

```bash
node libs/telemetry/scripts/apply-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing
node libs/telemetry/scripts/verify-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry
node libs/telemetry/scripts/smoke-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry
node scripts/verify-release-versions.mjs --tag v$(node -p "require('./libs/chat/package.json').version")
npx nx release publish --groups=publishable --dry-run
```

Expected: release verification lists only `@threadplane/*` public packages.

- [ ] **Step 5.3: Run canonical chat app checks**

Run:

```bash
npx nx run examples-chat-angular:lint
npx nx run examples-chat-angular:test
npx nx build examples-chat-angular --configuration=production --skip-nx-cache
npx nx build examples-chat-angular --configuration=production-debug --skip-nx-cache
```

Expected: both production builds resolve `@threadplane/chat/debug` correctly.

- [ ] **Step 5.4: Run canonical chat backend and e2e**

Run:

```bash
npx nx run examples-chat-python:test --skip-nx-cache
npx nx run examples-chat-python:smoke --skip-nx-cache
npx nx e2e examples-chat-angular --skip-nx-cache
```

Expected: Playwright harness boots Aimock, LangGraph on `:2024`, Angular on `:4200`, and all canonical chat e2e specs pass.

- [ ] **Step 5.5: Run local packaged smoke consumer before PR**

Run:

```bash
npx nx run examples-chat-smoke:verify-local
```

Expected: the smoke consumer installs local packed tarballs or local registry packages for the complete public package closure (`@threadplane/a2ui`, `@threadplane/ag-ui`, `@threadplane/chat`, `@threadplane/langgraph`, `@threadplane/licensing`, `@threadplane/render`, `@threadplane/telemetry`), then validates the packaged demo flow without prompts and without depending on npm publication.

---

## Task 6: PR, CI, Merge, and Manual Deployment

**Files:**
- Verify: GitHub PR
- Verify: npm package pages after manual deployment

- [ ] **Step 6.1: Review local diff**

Run:

```bash
git diff --stat
git diff --check
rg -n '@ngaf|@ngaf-internal' -g '!node_modules' -g '!dist' -g '!coverage' -g '!tmp' -g '!CHANGELOG.md' -g '!docs/superpowers/**' || true
```

Expected: no whitespace errors; old package specifier leftovers are absent or justified.

- [ ] **Step 6.2: Commit and open PR**

Run:

```bash
git add -A
git commit -m "refactor: migrate npm scope to @threadplane"
git push -u origin codex/threadplane-npm-scope
gh pr create --draft --title "refactor: migrate npm scope to @threadplane" --body-file /tmp/threadplane-pr-body.md
```

Expected: PR body includes audit counts, sticky identifier decisions, local verification results, and manual deployment checklist.

- [ ] **Step 6.3: Wait for green CI**

Run:

```bash
gh pr checks --watch
```

Expected: all required checks pass. If any check fails, inspect logs, fix, rerun local focused verification, and push.

- [ ] **Step 6.4: Mark ready and merge PR**

Only merge when:

- CI is green.
- Local package verification passed.
- Canonical chat demo passed locally.
- PR notes document that OIDC trusted publishing setup remains manual follow-up by the user.

Run:

```bash
gh pr ready
gh pr merge --squash --delete-branch
```

Expected: PR merged on green.

- [ ] **Step 6.5: Validate canonical chat demo against the merged branch**

After PR merge, update local `main` and rerun:

```bash
git checkout main
git pull --ff-only
npm ci
npx nx run examples-chat-angular:lint
npx nx run examples-chat-angular:test
npx nx build examples-chat-angular --configuration=production --skip-nx-cache
npx nx build examples-chat-angular --configuration=production-debug --skip-nx-cache
npx nx e2e examples-chat-angular --skip-nx-cache
npx nx run examples-chat-smoke:verify-local
```

Expected: local canonical chat demo remains green on merged code.

- [ ] **Step 6.6: Manual public package deployment from merged commit**

From updated `main`, the user manually publishes all seven public packages under `@threadplane` using the runbook from Task 2.5.

Minimum verification after publish:

```bash
npm view @threadplane/a2ui version
npm view @threadplane/ag-ui version
npm view @threadplane/chat version
npm view @threadplane/langgraph version
npm view @threadplane/licensing version
npm view @threadplane/render version
npm view @threadplane/telemetry version
```

Expected: all seven package pages resolve to the intended version.

- [ ] **Step 6.7: Run npm-installed smoke consumer after manual deployment**

Run:

```bash
npx nx run examples-chat-smoke:run
```

Expected: the interactive smoke generator can resolve `@threadplane/chat` from npm. For unattended validation, use the non-interactive npm mode added in Task 1.3 if available.

- [ ] **Step 6.8: Handoff for OIDC trusted publishing**

After all seven packages resolve on npm, the user configures npm trusted publishers for the seven `@threadplane/*` packages against `.github/workflows/publish.yml`.

---

## PR Body Checklist

Include this exact checklist, filled in with command results:

```markdown
## Scope
- Migrates npm/package specifiers from `@ngaf/*` to `@threadplane/*`.
- Migrates internal aliases from `@ngaf-internal/*` to `@threadplane-internal/*`.
- Updates current public docs/prose from NGAF/Angular Agent Framework/Agent UI for Angular to Threadplane where appropriate.
- No backwards compatibility packages or aliases.

## Sticky identifiers
- `NGAF_CHAT_DEBUG`: renamed to `THREADPLANE_CHAT_DEBUG`
- `NGAF_CHAT_STREAM_TRACE`: renamed to `THREADPLANE_CHAT_STREAM_TRACE`
- `NGAF_LICENSE`: renamed in current docs/source to `THREADPLANE_LICENSE`
- `NGAF_TELEMETRY_*`: intentionally preserved as the external telemetry opt-out and ingest env contract
- `ngaf:*` telemetry events: intentionally preserved as the analytics taxonomy contract
- `--ngaf-chat-*` CSS variables: intentionally preserved as the public chat theming API
- Stripe metadata keys: intentionally preserved for existing Stripe products

## Verification
- [ ] `npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --skip-nx-cache`
- [ ] telemetry manifest apply/verify/smoke scripts
- [ ] `node scripts/verify-release-versions.mjs --tag v<version>`
- [ ] `npx nx release publish --groups=publishable --dry-run`
- [ ] `npx nx run examples-chat-angular:lint`
- [ ] `npx nx run examples-chat-angular:test`
- [ ] `npx nx build examples-chat-angular --configuration=production --skip-nx-cache`
- [ ] `npx nx build examples-chat-angular --configuration=production-debug --skip-nx-cache`
- [ ] `npx nx e2e examples-chat-angular --skip-nx-cache`
- [ ] `npx nx run examples-chat-smoke:verify-local`
- [ ] Post-publish: `npx nx run examples-chat-smoke:run` or non-interactive npm-installed equivalent

## Manual npm deployment
- [ ] `@threadplane/a2ui`
- [ ] `@threadplane/ag-ui`
- [ ] `@threadplane/chat`
- [ ] `@threadplane/langgraph`
- [ ] `@threadplane/licensing`
- [ ] `@threadplane/render`
- [ ] `@threadplane/telemetry`

## Follow-up
- User will manually configure npm OIDC trusted publishing for all seven `@threadplane/*` packages after this migration.
```
