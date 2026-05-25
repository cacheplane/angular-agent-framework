# Release Process

The seven publishable libraries (`@threadplane/chat`, `@threadplane/langgraph`, `@threadplane/ag-ui`, `@threadplane/render`, `@threadplane/a2ui`, `@threadplane/licensing`, `@threadplane/telemetry`) ship together at a synchronized version via Nx Release. During the `0.0.x` exploratory phase, only patch bumps are used.

## One-shot release (recommended; second release onward)

> First release? See **[First `@threadplane` release](#first-threadplane-release)** below — the flow is different because there's no prior package under the new npm org yet.

From a clean main branch:

```bash
git checkout main && git pull
npx nx release patch
```

This runs Nx Release in interactive mode, which:

1. Builds all seven publishable projects and patches install telemetry into the publishable package manifests (preVersionCommand).
2. Bumps every package.json version (e.g., `0.0.1` → `0.0.2`).
3. Generates `CHANGELOG.md` from commits since the last tag.
4. Creates a git commit `chore(release): publish v0.0.2`.
5. Tags the commit `v0.0.2`.
6. **Prompts for confirmation, then publishes to npm with provenance.**

After the prompt, push the commit and tag:

```bash
git push origin main --tags
```

The `Publish` GitHub Actions workflow fires on tag push and re-publishes (idempotent — npm rejects duplicate versions).

## Step-by-step (for debugging)

If something goes wrong, run the steps individually:

```bash
# 1. Version bump (writes new versions to package.json files)
npx nx release version --specifier=patch

# 2. Generate changelog (creates CHANGELOG.md, commits, tags)
npx nx release changelog v0.0.2  # use the version produced by step 1

# 3. Publish to npm
npx nx release publish --groups=publishable
```

## First `@threadplane` release

The first publish under the `@threadplane` npm org is manual. The packages must exist on npm before trusted publishing can be configured package-by-package. Run this from a clean, merged `main` branch.

```bash
# 1. Install and build everything
npm ci
npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --skip-nx-cache

# 2. Patch and verify install telemetry in dist manifests
node libs/telemetry/scripts/apply-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing
node libs/telemetry/scripts/verify-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry
node libs/telemetry/scripts/smoke-install-telemetry.mjs dist/libs/chat dist/libs/langgraph dist/libs/ag-ui dist/libs/render dist/libs/a2ui dist/libs/licensing dist/libs/telemetry

# 3. Verify release metadata
node scripts/verify-release-versions.mjs --tag v$(node -p "require('./libs/chat/package.json').version")
npx nx release publish --groups=publishable --dry-run

# 4. Publish manually. Telemetry goes first because the patched manifests
# depend on @threadplane/telemetry.
npm publish dist/libs/telemetry --access public
npm publish dist/libs/a2ui --access public
npm publish dist/libs/render --access public
npm publish dist/libs/licensing --access public
npm publish dist/libs/chat --access public
npm publish dist/libs/ag-ui --access public
npm publish dist/libs/langgraph --access public

# 5. Verify all package pages resolve.
npm view @threadplane/telemetry version
npm view @threadplane/a2ui version
npm view @threadplane/render version
npm view @threadplane/licensing version
npm view @threadplane/chat version
npm view @threadplane/ag-ui version
npm view @threadplane/langgraph version
```

After the first `@threadplane` release, configure npm trusted publishing for all seven packages against `.github/workflows/publish.yml`. Subsequent patch bumps use the one-shot flow above.

## Dry run

Always sanity-check before a real release:

```bash
npx nx release patch --dry-run
```

This prints what would happen without modifying anything.

## Manual workflow trigger

`Publish` workflow accepts `workflow_dispatch` with a `dry-run` input (default `true`). Trigger from the GitHub Actions UI to verify CI's publish path without actually shipping.

## Why patch-only during 0.0.x

While the API is still settling we bump only the patch component (`0.0.1` → `0.0.2` → `0.0.3`). This signals to consumers that breaking changes can land in any release; lock to an exact version.

When the API stabilizes enough to make compatibility promises, transition to `0.1.0` and start using minor/major bumps with conventional-commit-driven semver.

## Why peerDeps use `*` between Threadplane libs

Caret-prefixed ranges (`^0.0.1`) in `0.0.x` don't include subsequent patches because npm semver treats `0.0.x` as breaking. Using `"*"` for inter-Threadplane peerDeps during this phase avoids the range-narrowing problem; the synchronized release group ensures all libs ship the same version anyway. Switch back to `^X.Y.Z` once we hit `0.1.0`.
