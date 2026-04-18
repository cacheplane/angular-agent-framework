# Release Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `nx release` a one-command release pipeline for `@cacheplane/angular`, `@cacheplane/render`, `@cacheplane/chat` — independent per-package semver, Keep-a-Changelog changelogs, enforced conventional commits, GitHub Actions publish with npm provenance.

**Architecture:** Nx Release handles version bumps + changelog generation from conventional commits. Local workflow: developer runs `nx release version` + `nx release changelog` → commits + tags are pushed → GitHub Actions `release.yml` triggers on `<pkg>@v*` tag pattern → runs `nx release publish` with npm provenance via OIDC. Commitlint enforces the conventional commit contract via a husky `commit-msg` hook locally and a CI job on PRs. Verdaccio provides a local dry-run smoke test so we catch config errors without burning a version number.

**Tech Stack:** Nx 22 (`nx release`), `@commitlint/cli` + `@commitlint/config-conventional`, husky, Verdaccio (already installed), GitHub Actions, npm with `--provenance`.

---

## Scope

### In scope
- Nx Release configured for independent per-package versioning of agent / render / chat
- Tag format: `<pkg>@v<version>` (e.g., `@cacheplane/angular@v1.0.0`)
- `CHANGELOG.md` per library in Keep-a-Changelog format, auto-updated by Nx Release
- Conventional commits enforced locally (husky) and on PRs (GitHub Action)
- GitHub Actions workflow `release.yml` that publishes with `--provenance` via OIDC
- Root `package.json` scripts: `release:dry`, `release:version`, `release:publish`
- Local Verdaccio smoke test script
- Release runbook doc

### Out of scope (belongs to other plans)
- Embedding license public key in package builds → licensing plan
- License-test fixtures in CI → licensing plan
- Per-library API freeze / type coverage / docs → stabilization plans
- Resolving `@cacheplane/chat` peer deps on `@cacheplane/a2ui` + `@cacheplane/partial-json` → per-library (chat) plan. This plan treats those two packages as out of v1 publish scope; chat's peer deps will need to be inlined, bundled, or the scope will need to expand — decision belongs with the chat stabilization work.

## File Structure

**Create:**
- `commitlint.config.cjs` — conventional commits config
- `.husky/commit-msg` — husky hook for commitlint
- `.github/workflows/release.yml` — new release workflow
- `.github/workflows/commitlint.yml` — PR commitlint CI
- `libs/agent/CHANGELOG.md` — Keep-a-Changelog seed
- `libs/render/CHANGELOG.md` — seed
- `libs/chat/CHANGELOG.md` — seed
- `scripts/verify-release-local.sh` — Verdaccio dry-run smoke
- `docs/release-runbook.md` — operator docs

**Modify:**
- `nx.json` — expand `release` block (projects, version, changelog, tag format)
- `libs/agent/package.json` — add `publishConfig`
- `libs/render/package.json` — add `publishConfig`
- `libs/chat/package.json` — add `publishConfig`
- `package.json` — add devDeps (`@commitlint/cli`, `@commitlint/config-conventional`, `husky`) + release scripts + `prepare` hook

**Delete:**
- `.github/workflows/publish.yml` — superseded by `release.yml` (done in a dedicated task so the git history shows intent)

---

## Task 1: Install commitlint + husky tooling

**Files:**
- Modify: `package.json`
- Create: `commitlint.config.cjs`
- Create: `.husky/commit-msg`

- [ ] **Step 1: Install devDeps**

Run:
```bash
npm install --save-dev @commitlint/cli@^19.0.0 @commitlint/config-conventional@^19.0.0 husky@^9.0.0
```

Expected: `package.json` updated; `node_modules` installed without error.

- [ ] **Step 2: Create commitlint config**

Create `commitlint.config.cjs`:
```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'agent',
        'render',
        'chat',
        'website',
        'cockpit',
        'release',
        'deps',
        'ci',
        'docs',
        'repo',
      ],
    ],
    'header-max-length': [2, 'always', 100],
  },
};
```

- [ ] **Step 3: Add husky prepare script**

Edit `package.json`. Add to `scripts` block:
```json
"prepare": "husky"
```

- [ ] **Step 4: Initialize husky**

Run:
```bash
npm run prepare
```

Expected: creates `.husky/` directory; no error.

- [ ] **Step 5: Create commit-msg hook**

Create `.husky/commit-msg` with contents:
```sh
npx --no-install commitlint --edit "$1"
```

Make it executable:
```bash
chmod +x .husky/commit-msg
```

- [ ] **Step 6: Verify hook blocks bad commits**

Run:
```bash
git commit --allow-empty -m "bad commit message"
```

Expected: commit rejected, commitlint prints `subject may not be empty` / `type may not be empty` error.

Run:
```bash
git commit --allow-empty -m "chore(repo): verify commitlint hook"
```

Expected: commit succeeds.

- [ ] **Step 7: Reset the verification commit**

Run:
```bash
git reset --hard HEAD~1
```

Expected: last commit removed.

- [ ] **Step 8: Commit the tooling changes**

Run:
```bash
git add package.json package-lock.json commitlint.config.cjs .husky/
git commit -m "chore(release): add commitlint + husky for conventional commits"
```

---

## Task 2: Add commitlint CI check on PRs

**Files:**
- Create: `.github/workflows/commitlint.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/commitlint.yml`:
```yaml
name: Commitlint

on:
  pull_request:
    branches: [main]

jobs:
  commitlint:
    name: Lint PR commits
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Validate commits in PR
        run: |
          npx commitlint \
            --from "${{ github.event.pull_request.base.sha }}" \
            --to "${{ github.event.pull_request.head.sha }}" \
            --verbose
```

- [ ] **Step 2: Commit**

Run:
```bash
git add .github/workflows/commitlint.yml
git commit -m "ci(release): enforce conventional commits on PRs"
```

---

## Task 3: Seed CHANGELOG.md for each library

**Files:**
- Create: `libs/agent/CHANGELOG.md`
- Create: `libs/render/CHANGELOG.md`
- Create: `libs/chat/CHANGELOG.md`

- [ ] **Step 1: Create `libs/agent/CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@cacheplane/angular` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
```

- [ ] **Step 2: Create `libs/render/CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@cacheplane/render` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
```

- [ ] **Step 3: Create `libs/chat/CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@cacheplane/chat` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
```

- [ ] **Step 4: Commit**

Run:
```bash
git add libs/agent/CHANGELOG.md libs/render/CHANGELOG.md libs/chat/CHANGELOG.md
git commit -m "docs(release): seed Keep-a-Changelog files for v1 packages"
```

---

## Task 4: Add `publishConfig` to each library's `package.json`

**Files:**
- Modify: `libs/agent/package.json`
- Modify: `libs/render/package.json`
- Modify: `libs/chat/package.json`

The `publishConfig.provenance` flag tells npm to use the OIDC token from GitHub Actions to sign the published package.

- [ ] **Step 1: Edit `libs/agent/package.json`**

Add a `publishConfig` key before `peerDependencies`:
```json
{
  "name": "@cacheplane/angular",
  "version": "0.0.1",
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "peerDependencies": {
    ...
  }
}
```

- [ ] **Step 2: Edit `libs/render/package.json`**

Add the same `publishConfig` block.

- [ ] **Step 3: Edit `libs/chat/package.json`**

Add the same `publishConfig` block.

- [ ] **Step 4: Verify each file is valid JSON**

Run:
```bash
for f in libs/agent/package.json libs/render/package.json libs/chat/package.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f', 'utf8'))" && echo "$f OK"
done
```

Expected: three lines of `... OK`.

- [ ] **Step 5: Commit**

Run:
```bash
git add libs/agent/package.json libs/render/package.json libs/chat/package.json
git commit -m "feat(release): enable npm provenance for v1 packages"
```

---

## Task 5: Configure Nx Release for independent per-package versioning

**Files:**
- Modify: `nx.json`

- [ ] **Step 1: Replace the `release` block in `nx.json`**

Current block (lines 44–48):
```json
"release": {
  "version": {
    "preVersionCommand": "npx nx run-many -t build"
  }
}
```

Replace with:
```json
"release": {
  "projects": ["agent", "render", "chat"],
  "projectsRelationship": "independent",
  "releaseTagPattern": "{projectName}@v{version}",
  "version": {
    "preVersionCommand": "npx nx run-many -t build -p agent,render,chat",
    "conventionalCommits": true,
    "generatorOptions": {
      "packageRoot": "{projectRoot}",
      "currentVersionResolver": "git-tag",
      "fallbackCurrentVersionResolver": "disk"
    }
  },
  "changelog": {
    "projectChangelogs": {
      "createRelease": "github",
      "file": "{projectRoot}/CHANGELOG.md"
    },
    "workspaceChangelog": false
  }
}
```

**Key behaviors:**
- `projectsRelationship: "independent"` — each package versions on its own schedule
- `releaseTagPattern: "{projectName}@v{version}"` — produces e.g. `agent@v1.0.0`. Note: the Nx project name is `agent` (not `@cacheplane/angular`); the tag uses the project name.
- `conventionalCommits: true` — analyze commits since last tag to determine bump
- `currentVersionResolver: "git-tag"` — reads current version from latest matching tag, falls back to `package.json` on first release
- `projectChangelogs` writes per-library `CHANGELOG.md`; `createRelease: "github"` publishes GitHub Releases
- `workspaceChangelog: false` — don't generate a root changelog (per-package only)

- [ ] **Step 2: Dry-run version to verify config parses**

Run:
```bash
npx nx release version --dry-run
```

Expected: no errors. Output shows what *would* happen for each of `agent`, `render`, `chat` — either "no changes since last tag" or a proposed version bump. No files modified.

- [ ] **Step 3: Commit**

Run:
```bash
git add nx.json
git commit -m "feat(release): configure nx release for independent per-package versioning"
```

---

## Task 6: Add release scripts to root `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add release scripts**

Add to the `scripts` block in root `package.json`:
```json
"release:dry": "nx release --dry-run",
"release:version": "nx release version",
"release:changelog": "nx release changelog",
"release:publish": "nx release publish"
```

- [ ] **Step 2: Verify `release:dry` runs end-to-end without error**

Run:
```bash
npm run release:dry
```

Expected: Nx reports dry-run for version, changelog, and publish phases; no files modified; exit code 0.

- [ ] **Step 3: Commit**

Run:
```bash
git add package.json
git commit -m "chore(release): add nx release npm scripts"
```

---

## Task 7: Create local Verdaccio release smoke-test script

Verdaccio is already installed as a devDep and configured in the `local-registry` Nx target. This script stands up the registry, runs the full release (version + publish) against it, and then tears down. Use this before every real release.

**Files:**
- Create: `scripts/verify-release-local.sh`

- [ ] **Step 1: Create the script**

Create `scripts/verify-release-local.sh`:
```sh
#!/usr/bin/env bash
set -euo pipefail

# Verify the nx release pipeline end-to-end against a local Verdaccio registry.
# Does NOT modify git state or publish to the real npm registry.

ORIGINAL_NPM_CONFIG_REGISTRY="${npm_config_registry:-}"
LOCAL_REGISTRY="http://localhost:4873/"

cleanup() {
  echo "--- cleaning up ---"
  if [ -n "${VERDACCIO_PID:-}" ]; then
    kill "$VERDACCIO_PID" 2>/dev/null || true
  fi
  npm config delete registry --location=project 2>/dev/null || true
  rm -rf tmp/local-registry/storage
  echo "done."
}
trap cleanup EXIT

mkdir -p tmp/local-registry
echo "--- starting verdaccio on $LOCAL_REGISTRY ---"
npx nx local-registry &
VERDACCIO_PID=$!

# Wait for Verdaccio to be ready
for i in {1..30}; do
  if curl -fsS "$LOCAL_REGISTRY" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "$LOCAL_REGISTRY" >/dev/null 2>&1; then
  echo "verdaccio failed to start" >&2
  exit 1
fi

echo "--- building libs ---"
npx nx run-many -t build -p agent,render,chat

echo "--- dry-run version ---"
npx nx release version --dry-run

echo "--- dry-run publish against local registry ---"
npx nx release publish \
  --registry="$LOCAL_REGISTRY" \
  --tag=local-smoke \
  --dry-run

echo ""
echo "✅ release pipeline verified against local registry"
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x scripts/verify-release-local.sh
```

- [ ] **Step 3: Run it to verify**

Run:
```bash
./scripts/verify-release-local.sh
```

Expected: Verdaccio starts, builds succeed, dry-run version + publish both succeed, final message `✅ release pipeline verified against local registry`. Cleanup runs automatically on exit.

- [ ] **Step 4: Commit**

Run:
```bash
git add scripts/verify-release-local.sh
git commit -m "chore(release): add local verdaccio release smoke test"
```

---

## Task 8: Create `release.yml` GitHub Actions workflow

This replaces the old `publish.yml` (removed in Task 9).

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags:
      - 'agent@v*'
      - 'render@v*'
      - 'chat@v*'
  workflow_dispatch:
    inputs:
      version-spec:
        description: 'Version spec (e.g., "patch", "minor", "major", "1.0.0"). Omit to use conventional commits.'
        required: false
        default: ''
      dry-run:
        description: 'Dry run (no publish, no tag push)'
        required: false
        type: boolean
        default: false

permissions:
  contents: write      # push tags + create GitHub Release
  id-token: write      # npm provenance via OIDC

jobs:
  publish:
    name: Publish to npm
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 22
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      - name: Git identity (for version commits)
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      # ── Manual dispatch: run version + changelog, create tags ────────────
      - name: Nx release version (manual dispatch)
        if: github.event_name == 'workflow_dispatch'
        run: |
          SPEC="${{ github.event.inputs.version-spec }}"
          DRY="${{ github.event.inputs.dry-run }}"
          ARGS=""
          if [ -n "$SPEC" ]; then ARGS="$ARGS $SPEC"; fi
          if [ "$DRY" = "true" ]; then ARGS="$ARGS --dry-run"; fi
          npx nx release $ARGS --yes

      # ── Tag-push: build + publish the tagged packages ────────────────────
      - name: Nx release publish (tag push)
        if: github.event_name == 'push'
        run: npx nx release publish --yes
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
```

**Workflow semantics:**
- **Tag push** (`agent@v*`, `render@v*`, `chat@v*`) → Nx detects the matching tags and runs `nx release publish` which publishes only packages whose version matches their tag. This is the normal path when a developer runs `nx release` locally and pushes the generated tags.
- **Manual dispatch** → the workflow itself runs `nx release` end-to-end. Useful for recovery or for fully-CI-driven releases. Supports `--dry-run`.
- `NPM_CONFIG_PROVENANCE=true` + `id-token: write` permission → npm CLI attests the package via GitHub OIDC; the provenance appears on npmjs.com.
- `NPM_TOKEN` must be configured in repo secrets (existing from old `publish.yml`).

- [ ] **Step 2: Commit**

Run:
```bash
git add .github/workflows/release.yml
git commit -m "feat(release): add nx release workflow with npm provenance"
```

---

## Task 9: Remove old `publish.yml`

**Files:**
- Delete: `.github/workflows/publish.yml`

- [ ] **Step 1: Delete the file**

Run:
```bash
git rm .github/workflows/publish.yml
```

- [ ] **Step 2: Commit**

Run:
```bash
git commit -m "chore(release): remove legacy publish workflow superseded by release.yml"
```

---

## Task 10: Write release runbook

**Files:**
- Create: `docs/release-runbook.md`

- [ ] **Step 1: Create the runbook**

Create `docs/release-runbook.md`:
```markdown
# Release Runbook

How to cut a new release of `@cacheplane/angular`, `@cacheplane/render`, or `@cacheplane/chat`.

## Prerequisites

- Clean working tree on `main` (pull latest)
- `NPM_TOKEN` configured in GitHub repo secrets (for CI)
- Local login to npm (`npm login`) if doing a manual publish (not the default path)

## Standard release (preferred)

1. **Pre-flight smoke against local registry:**

   ```bash
   ./scripts/verify-release-local.sh
   ```

   Fix any failures before proceeding.

2. **Version + changelog locally:**

   ```bash
   npm run release:version
   npm run release:changelog
   ```

   Nx analyzes conventional commits since the last `<pkg>@v*` tag for each project and:
   - bumps `libs/<pkg>/package.json` version
   - updates `libs/<pkg>/CHANGELOG.md`
   - creates one commit + one tag per bumped package

3. **Review the generated commit + tags:**

   ```bash
   git log -5 --oneline
   git tag --contains HEAD
   ```

   Expected: one commit per bumped package (e.g., `chore(release): publish @cacheplane/angular@1.0.0`) and matching tags like `agent@v1.0.0`.

4. **Push commits + tags:**

   ```bash
   git push origin main --follow-tags
   ```

   Pushing the tag triggers `.github/workflows/release.yml`, which runs `nx release publish` with npm provenance.

5. **Verify on npm:**

   - https://www.npmjs.com/package/@cacheplane/angular
   - https://www.npmjs.com/package/@cacheplane/render
   - https://www.npmjs.com/package/@cacheplane/chat

   Each published version should have a "Provenance" badge.

## Manual dispatch (recovery path)

Use GitHub Actions → Release → "Run workflow" when:
- A previous release failed mid-publish
- You need to publish without running `nx release` locally

Provide `version-spec` (e.g., `patch`, `1.0.1`) or leave empty to use conventional commits. Check `dry-run` to preview.

## Troubleshooting

**Tag pushed but nothing published:**
- Check the Release workflow run in GitHub Actions
- Common cause: `NPM_TOKEN` expired or missing

**Provenance missing from published package:**
- Confirm the workflow ran on a tag push (not a manual `npm publish`)
- Confirm `permissions: id-token: write` is present in `.github/workflows/release.yml`

**Wrong version bumped:**
- Commit messages since last tag determined the bump. Review with:
  ```bash
  git log <pkg>@v<prev>..HEAD --oneline -- libs/<pkg>
  ```
- To override, use manual dispatch with explicit `version-spec`

**Rolled back release:**
- `npm` publishes are immutable. To "roll back," publish a new patch version.
- If a tag was pushed but the publish failed, delete the tag locally and remote before retrying:
  ```bash
  git tag -d agent@v1.0.0
  git push origin :refs/tags/agent@v1.0.0
  ```

## Version policy

- `@cacheplane/angular`, `@cacheplane/render`, `@cacheplane/chat` follow semver independently.
- Breaking changes to any public export = major bump.
- New exports or non-breaking API additions = minor bump.
- Bug fixes with no API change = patch bump.
- Conventional commit types drive bumps:
  - `feat(<scope>):` → minor
  - `fix(<scope>):` → patch
  - `BREAKING CHANGE:` footer or `!` suffix → major
```

- [ ] **Step 2: Commit**

Run:
```bash
git add docs/release-runbook.md
git commit -m "docs(release): add release runbook"
```

---

## Task 11: End-to-end verification

Final sanity pass — run the full local smoke, then do one dry-run of the GitHub Actions workflow via manual dispatch (requires the workflow to already be on main).

- [ ] **Step 1: Run the local smoke test**

Run:
```bash
./scripts/verify-release-local.sh
```

Expected: green final message.

- [ ] **Step 2: Dry-run version against real git state**

Run:
```bash
npx nx release version --dry-run --verbose
```

Expected: Nx enumerates `agent`, `render`, `chat` and reports what version each would go to based on conventional commits since last tag. Since no tags match `<pkg>@v*` yet, fallback resolver reads current version from `package.json` (`0.0.1`).

- [ ] **Step 3: Verify commitlint on a test commit**

Run:
```bash
git commit --allow-empty -m "invalid: this should fail"
```

Expected: commit rejected by husky hook.

Then:
```bash
git commit --allow-empty -m "chore(release): verify commitlint"
git reset --hard HEAD~1
```

Expected: first succeeds, then reverts.

- [ ] **Step 4: Open a PR**

Once all tasks above are merged, open a PR with at least one commit and confirm the `Commitlint` check runs and passes.

- [ ] **Step 5: Trigger a dry-run release via manual dispatch**

On GitHub:
- Actions → Release → Run workflow
- Leave `version-spec` empty
- Check `dry-run`

Expected: workflow succeeds; logs show what would be versioned/published; nothing is actually published.

---

## Spec coverage check

| Spec requirement (§2 Release Infrastructure) | Task |
|---|---|
| Nx Release configured with per-package semver and independent version lines | Task 5 |
| Tag format `<pkg>@v<version>` | Task 5 (`releaseTagPattern`) + Task 8 (trigger) |
| Keep-a-Changelog format, one `CHANGELOG.md` per library | Tasks 3, 5 |
| Conventional commits enforced in CI (commitlint) | Tasks 1, 2 |
| npm publish with provenance (`--provenance` flag, GitHub OIDC) | Tasks 4, 8 |
| `NPM_TOKEN` prerequisite | Task 10 (runbook) + reused from existing config |
| Public key embedding at compile time | **Out of scope** — licensing plan |
| License-test fixtures in CI | **Out of scope** — licensing plan |
| Release workflow triggered on tag push or manual dispatch | Task 8 |
