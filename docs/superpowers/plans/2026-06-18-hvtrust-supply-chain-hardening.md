# HVTrust Supply-Chain Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise threadplane's HVTracker "HVTrust" score by closing supply-chain evidence gaps with genuine hardening — OSSF Scorecard publishing, security/SAST/dependency config, pinned Actions, enforced commit signing, and SLSA-attested releases.

**Architecture:** Pure repository + CI configuration. No application code changes. Work is sequenced into four PR-sized groups; group 1 alone makes the OSSF Scorecard measurable. "Tests" are verification commands: YAML validity (`actionlint`), `gh api` assertions on repo/branch settings, and `scorecard` score deltas.

**Tech Stack:** GitHub Actions, OSSF Scorecard, CodeQL, Renovate, `pinact` (Action SHA pinning), SSH commit/tag signing, `slsa-github-generator`, npm OIDC trusted publishing (already in place), PyPI trusted publishing.

**Spec:** [docs/superpowers/specs/2026-06-18-hvtrust-supply-chain-hardening-design.md](../specs/2026-06-18-hvtrust-supply-chain-hardening-design.md)

**Manual owner steps (not automatable, called out where relevant):** install the Renovate GitHub App (Task 7); configure local SSH signing key on the maintainer machine (Task 9); optionally create a `SCORECARD_TOKEN` secret (noted in Task 5).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `.github/workflows/scorecard.yml` | Run + publish OSSF Scorecard | 5 |
| `.github/workflows/codeql.yml` | CodeQL SAST for JS/TS + Python | 4 |
| `SECURITY.md` | Vulnerability disclosure policy | 2 |
| `.github/workflows/publish.yml` | + top-level least-privilege perms | 3 |
| `.github/workflows/publish-middleware-npm.yml` | + top-level least-privilege perms | 3 |
| `.github/workflows/publish-middleware-python.yml` | + top-level perms; + PyPI attestations | 3, 13 |
| `renovate.json` | Dependency updates + Action SHA pinning | 7 |
| all `.github/workflows/*.yml` | Actions pinned by commit SHA | 8 |
| `CONTRIBUTING.md` | Document SSH commit/tag signing setup | 9 |
| `README.md` | OSSF Scorecard badge | 5 |
| `.github/workflows/release-provenance.yml` | SLSA provenance for Release artifacts | 12 |

---

## Preconditions

- [ ] **Confirm tooling is available** (install on demand in later tasks; just verify access now):

Run:
```bash
gh auth status
command -v docker || echo "docker missing (needed for scorecard local run)"
npx --yes actionlint --version 2>/dev/null || echo "actionlint via npx ok"
```
Expected: `gh` authenticated; note whether docker exists (Task 1 needs it or falls back to reading the first published run).

---

## Group 1 — Make Scorecard measurable (hardening + publishing)

### Task 1: Capture OSSF Scorecard baseline

**Files:**
- Create: `docs/superpowers/audits/2026-06-18-scorecard-baseline.md`

- [ ] **Step 1: Run Scorecard against the repo**

Run (requires a token with public-repo read; classic PAT or `gh auth token`):
```bash
export GITHUB_AUTH_TOKEN=$(gh auth token)
docker run -e GITHUB_AUTH_TOKEN \
  gcr.io/openssf/scorecard:stable \
  --repo=github.com/cacheplane/angular-agent-framework --format=json > /tmp/scorecard-baseline.json
```
If docker is unavailable, skip the run and record "baseline deferred to first published run" instead.

- [ ] **Step 2: Record per-check scores**

Run:
```bash
python3 -c "import json;d=json.load(open('/tmp/scorecard-baseline.json'));print('AGGREGATE',d['score']);[print(c['name'],c['score']) for c in d['checks']]"
```

- [ ] **Step 3: Write the baseline audit file**

Create `docs/superpowers/audits/2026-06-18-scorecard-baseline.md` containing the aggregate score and the per-check table from Step 2 (paste the actual numbers). This is the before-state we measure deltas against in Task 14.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-18-scorecard-baseline.md
git commit -m "docs(audit): OSSF Scorecard baseline before hardening"
```

### Task 2: SECURITY.md + private vulnerability reporting

**Files:**
- Create: `SECURITY.md`

- [ ] **Step 1: Create `SECURITY.md`**

```markdown
# Security Policy

## Supported Versions

threadplane publishes patch-level releases of the `@threadplane/*` packages.
Only the latest published version of each package is supported with security
fixes.

| Package scope | Supported |
| ------------- | --------- |
| `@threadplane/*` (latest) | ✅ |
| older versions | ❌ |

## Reporting a Vulnerability

Please report security issues privately via GitHub's
[private vulnerability reporting](https://github.com/cacheplane/angular-agent-framework/security/advisories/new).

We aim to acknowledge reports within 5 business days and to provide a
remediation timeline after triage. Please do not open public issues for
security vulnerabilities.
```

- [ ] **Step 2: Enable private vulnerability reporting (repo setting)**

Run:
```bash
gh api -X PUT repos/cacheplane/angular-agent-framework/private-vulnerability-reporting
```
Expected: HTTP 204 (no output) or a JSON confirming enabled.

- [ ] **Step 3: Verify the file is valid markdown and the setting took**

Run:
```bash
test -f SECURITY.md && echo "SECURITY.md present"
gh api repos/cacheplane/angular-agent-framework/private-vulnerability-reporting --jq '.enabled'
```
Expected: `SECURITY.md present` and `true`.

- [ ] **Step 4: Commit**

```bash
git add SECURITY.md
git commit -m "docs(security): add SECURITY.md vulnerability disclosure policy"
```

### Task 3: Top-level least-privilege permissions on publish workflows

**Files:**
- Modify: `.github/workflows/publish.yml` (add top-level `permissions:` after the `env:` block, before `jobs:`)
- Modify: `.github/workflows/publish-middleware-npm.yml`
- Modify: `.github/workflows/publish-middleware-python.yml`

- [ ] **Step 1: Add top-level `permissions` to `publish.yml`**

Insert immediately before the `jobs:` line:
```yaml
permissions:
  contents: read

jobs:
```
The existing job-level block (`contents: read` + `id-token: write`) stays as-is — job-level elevation is correct and is what Token-Permissions rewards.

- [ ] **Step 2: Add the same top-level block to `publish-middleware-npm.yml` and `publish-middleware-python.yml`**

Insert before each file's `jobs:` line:
```yaml
permissions:
  contents: read

jobs:
```

- [ ] **Step 3: Validate all three workflows parse**

Run:
```bash
npx --yes actionlint .github/workflows/publish.yml .github/workflows/publish-middleware-npm.yml .github/workflows/publish-middleware-python.yml
```
Expected: no output (exit 0). Note: `actionlint` may warn on shellcheck items unrelated to this change; only permission/syntax errors are blockers.

- [ ] **Step 4: Confirm each file now has a top-level `permissions:`**

Run:
```bash
for f in publish publish-middleware-npm publish-middleware-python; do
  awk '/^permissions:/{found=1} /^jobs:/{print FILENAME, (found?"OK":"MISSING"); exit}' .github/workflows/$f.yml
done
```
Expected: three `OK` lines.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/publish.yml .github/workflows/publish-middleware-npm.yml .github/workflows/publish-middleware-python.yml
git commit -m "ci: set least-privilege top-level token permissions on publish workflows"
```

### Task 4: CodeQL SAST workflow

**Files:**
- Create: `.github/workflows/codeql.yml`

- [ ] **Step 1: Create `.github/workflows/codeql.yml`**

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '27 4 * * 1'

permissions:
  contents: read

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        language: ['javascript-typescript', 'python']
    steps:
      - name: Checkout
        uses: actions/checkout@v6.0.2
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: '/language:${{ matrix.language }}'
```
(Actions left at tags here; Task 8 pins every Action by SHA across all workflows.)

- [ ] **Step 2: Validate the workflow parses**

Run:
```bash
npx --yes actionlint .github/workflows/codeql.yml
```
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/codeql.yml
git commit -m "ci: add CodeQL SAST for javascript-typescript and python"
```

### Task 5: OSSF Scorecard workflow + README badge

**Files:**
- Create: `.github/workflows/scorecard.yml`
- Modify: `README.md` (add badge near the top badge row)

- [ ] **Step 1: Create `.github/workflows/scorecard.yml`**

```yaml
name: Scorecard supply-chain security

on:
  branch_protection_rule:
  schedule:
    - cron: '18 5 * * 2'
  push:
    branches: [main]

permissions: read-all

jobs:
  analysis:
    name: Scorecard analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      id-token: write
      contents: read
      actions: read
    steps:
      - name: Checkout code
        uses: actions/checkout@v6.0.2
        with:
          persist-credentials: false
      - name: Run analysis
        uses: ossf/scorecard-action@v2.4.0
        with:
          results_file: results.sarif
          results_format: sarif
          publish_results: true
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: SARIF file
          path: results.sarif
          retention-days: 5
      - name: Upload to code-scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```
**Optional follow-up (note in PR description, do not block):** to unlock the Branch-Protection check, create a fine-grained read PAT secret `SCORECARD_TOKEN` and add `repo_token: ${{ secrets.SCORECARD_TOKEN }}` to the "Run analysis" step. The default `GITHUB_TOKEN` cannot read branch protection.

- [ ] **Step 2: Add the badge to `README.md`**

Find the existing badge row near the top of `README.md` (the line(s) containing other shield badges). Add, on its own line in that row:
```markdown
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/cacheplane/angular-agent-framework/badge)](https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework)
```
If no badge row exists, add this line immediately under the top-level `# ` heading.

- [ ] **Step 3: Validate the workflow parses**

Run:
```bash
npx --yes actionlint .github/workflows/scorecard.yml
```
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/scorecard.yml README.md
git commit -m "ci: add OSSF Scorecard workflow with public results + README badge"
```

### Task 6: Repo posture settings

**Files:** none (GitHub repo settings via API)

- [ ] **Step 1: Enable secret scanning + push protection + Dependabot security updates**

Run:
```bash
gh api -X PATCH repos/cacheplane/angular-agent-framework \
  -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled' \
  -f 'security_and_analysis[dependabot_security_updates][status]=enabled'
```
Expected: JSON response; no error.

- [ ] **Step 2: Verify all three are enabled**

Run:
```bash
gh api repos/cacheplane/angular-agent-framework --jq '.security_and_analysis | {secret_scanning:.secret_scanning.status, push_protection:.secret_scanning_push_protection.status, dependabot:.dependabot_security_updates.status}'
```
Expected: all three `enabled`.

- [ ] **Step 3: Record the change**

No file to commit. Note in the PR description that repo posture settings were enabled (these are account-side, not in git).

---

## Group 2 — Renovate + Action SHA pinning

### Task 7: Renovate configuration

**Files:**
- Create: `renovate.json`

- [ ] **Step 1: Create `renovate.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    "helpers:pinGitHubActionDigests",
    ":dependencyDashboard",
    ":semanticCommits"
  ],
  "schedule": ["before 9am on monday"],
  "prConcurrentLimit": 5,
  "packageRules": [
    {
      "matchManagers": ["github-actions"],
      "groupName": "github-actions",
      "pinDigests": true
    },
    {
      "matchManagers": ["npm"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "npm minor+patch"
    }
  ]
}
```

- [ ] **Step 2: Validate the config**

Run:
```bash
npx --yes --package renovate -- renovate-config-validator renovate.json
```
Expected: `Validating renovate.json` ... `Config validated successfully`.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git commit -m "ci: add Renovate config with GitHub Action digest pinning"
```

- [ ] **Step 4: MANUAL OWNER STEP — install the Renovate GitHub App**

Install the Renovate app on `cacheplane/angular-agent-framework` at https://github.com/apps/renovate (or confirm the org already has it). This activates the config. Document completion in the PR; nothing to commit.

### Task 8: Pin all GitHub Actions by commit SHA

**Files:**
- Modify: every `.github/workflows/*.yml`

- [ ] **Step 1: Pin all Actions by SHA with `pinact`**

Run:
```bash
go install github.com/suzuki-shunsuke/pinact/cmd/pinact@latest 2>/dev/null || \
  brew install pinact
pinact run
```
If neither `go` nor `brew` is available, use the Docker image:
```bash
docker run --rm -v "$PWD":/work -w /work -e GITHUB_TOKEN=$(gh auth token) \
  ghcr.io/suzuki-shunsuke/pinact:latest run
```
This rewrites every `uses: org/action@vX` to `uses: org/action@<40-char-sha> # vX` in place.

- [ ] **Step 2: Verify no Action remains unpinned**

Run:
```bash
grep -rhE "uses: " .github/workflows/ | grep -vE "@[0-9a-f]{40}" | grep -E "@v?[0-9]" || echo "ALL PINNED"
```
Expected: `ALL PINNED`.

- [ ] **Step 3: Validate all workflows still parse**

Run:
```bash
npx --yes actionlint .github/workflows/*.yml
```
Expected: exit 0 (pre-existing shellcheck warnings, if any, are not blockers).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: pin all GitHub Actions to commit SHAs"
```

---

## Group 3 — Commit signing + enforcement

### Task 9: SSH commit/tag signing setup + CONTRIBUTING docs

**Files:**
- Create or Modify: `CONTRIBUTING.md` (add a "Signed commits" section; create the file if absent)

- [ ] **Step 1: MANUAL OWNER STEP — configure local SSH signing**

On the maintainer machine:
```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub   # existing key
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```
Then add the SAME public key as a **Signing Key** (not just Authentication Key) at
https://github.com/settings/ssh/new with key type "Signing Key".

- [ ] **Step 2: Verify a signed commit is produced**

Run (in this repo, on a throwaway file):
```bash
git commit --allow-empty -m "chore: verify signing" -S
git log -1 --show-signature 2>&1 | grep -i "good \"git\" signature\|Good signature" && echo "SIGNED OK"
git reset --soft HEAD~1   # undo the throwaway commit
```
Expected: `SIGNED OK`.

- [ ] **Step 3: Document in `CONTRIBUTING.md`**

Add (create the file with a `# Contributing` heading if it doesn't exist) a section:
```markdown
## Signed commits

`main` requires signed commits. Configure SSH commit signing once:

\`\`\`bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true
\`\`\`

Then add the same public key as a **Signing Key** at
<https://github.com/settings/ssh/new>. Commits merged through the GitHub UI and
bot commits (Renovate, Dependabot) are signed automatically.
```

- [ ] **Step 4: Commit (signed)**

```bash
git add CONTRIBUTING.md
git commit -m "docs(contributing): document required SSH commit signing"
```

### Task 10: Enforce required signatures on `main`

**Files:** none (branch protection via API)

- [ ] **Step 1: Enable required signatures on `main`**

Run:
```bash
gh api -X POST repos/cacheplane/angular-agent-framework/branches/main/protection/required_signatures \
  -H "Accept: application/vnd.github+json"
```
Expected: JSON with `"enabled": true`.

- [ ] **Step 2: Verify enforcement is active**

Run:
```bash
gh api repos/cacheplane/angular-agent-framework/branches/main/protection/required_signatures --jq '.enabled'
```
Expected: `true`.

- [ ] **Step 3: Record**

No file to commit. Note in PR description that `main` now requires signed commits.

---

## Group 4 — SLSA release artifacts

### Task 11: Confirm signed tags flow through `nx release`

**Files:** none (relies on Task 9 `tag.gpgsign=true`)

- [ ] **Step 1: Verify a dry-run tag would be signed**

Run:
```bash
git config --get tag.gpgsign
git tag -s _sigcheck -m "sig check" && git tag -v _sigcheck 2>&1 | grep -i "good signature" && echo "TAG SIGNING OK"
git tag -d _sigcheck
```
Expected: `true`, then `TAG SIGNING OK`.

- [ ] **Step 2: No commit** (configuration is local/global from Task 9). Note completion in PR description.

### Task 12: SLSA provenance for GitHub Release artifacts

**Files:**
- Create: `.github/workflows/release-provenance.yml`

- [ ] **Step 1: Create `.github/workflows/release-provenance.yml`**

```yaml
name: Release provenance (SLSA)

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  build-artifacts:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      hashes: ${{ steps.hash.outputs.hashes }}
    env:
      NPM_PUBLISHABLE_PROJECTS: chat,langgraph,ag-ui,render,a2ui,licensing,telemetry
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: actions/setup-node@v6.3.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Build publishable projects
        env:
          CACHEPLANE_LICENSE_PUBLIC_KEY: ${{ secrets.CACHEPLANE_LICENSE_PUBLIC_KEY }}
        run: npx nx run-many -t build --projects=$NPM_PUBLISHABLE_PROJECTS --skip-nx-cache
      - name: Pack tarballs
        run: |
          mkdir -p release-artifacts
          for p in chat langgraph ag-ui render a2ui licensing telemetry; do
            npm pack "dist/libs/$p" --pack-destination release-artifacts
          done
      - name: Generate subject hashes
        id: hash
        run: |
          cd release-artifacts
          echo "hashes=$(sha256sum *.tgz | base64 -w0)" >> "$GITHUB_OUTPUT"
      - name: Upload tarballs to the release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "${{ github.event.release.tag_name }}" release-artifacts/*.tgz --clobber

  provenance:
    needs: [build-artifacts]
    permissions:
      actions: read
      id-token: write
      contents: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0
    with:
      base64-subjects: ${{ needs.build-artifacts.outputs.hashes }}
      upload-assets: true
```
This produces a signed `*.intoto.jsonl` provenance attached to the GitHub Release — what
Scorecard's Signed-Releases check inspects. (Actions pinned by SHA in the next Renovate
run / Task 8 re-run; the reusable SLSA workflow is referenced by its release tag as required
by the generator.)

- [ ] **Step 2: Validate the workflow parses**

Run:
```bash
npx --yes actionlint .github/workflows/release-provenance.yml
```
Expected: exit 0. (`actionlint` may not resolve the reusable-workflow outputs of the SLSA call — a `workflow_call` warning there is acceptable.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-provenance.yml
git commit -m "ci: generate SLSA provenance for GitHub Release artifacts"
```

### Task 13: Enable PyPI attestations

**Files:**
- Modify: `.github/workflows/publish-middleware-python.yml`

- [ ] **Step 1: Inspect the current publish step**

Run:
```bash
grep -nE "pypa/gh-action-pypi-publish|twine|python -m build|attestations" .github/workflows/publish-middleware-python.yml
```
Determine whether it uses `pypa/gh-action-pypi-publish` (supports `attestations: true`) or raw `twine`.

- [ ] **Step 2a: If it uses `pypa/gh-action-pypi-publish`** — add `attestations: true` under its `with:`:

```yaml
      - name: Publish to PyPI (real release — OIDC trusted publishing)
        uses: pypa/gh-action-pypi-publish@release/v1
        with:
          attestations: true
```

- [ ] **Step 2b: If it uses raw `twine`** — switch the publish step to `pypa/gh-action-pypi-publish@release/v1` with `attestations: true` (it defaults to OIDC trusted publishing, matching the existing `id-token: write`). Keep any existing `packages-dir` pointing at the built `dist/`.

- [ ] **Step 3: Validate**

Run:
```bash
npx --yes actionlint .github/workflows/publish-middleware-python.yml
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish-middleware-python.yml
git commit -m "ci: enable PyPI build provenance attestations on middleware publish"
```

### Task 14: Final verification — Scorecard delta

**Files:**
- Modify: `docs/superpowers/audits/2026-06-18-scorecard-baseline.md` (append an "after" section)

- [ ] **Step 1: Re-run Scorecard** (after Group 1–2 are merged to `main`; the published run is authoritative)

Run:
```bash
export GITHUB_AUTH_TOKEN=$(gh auth token)
docker run -e GITHUB_AUTH_TOKEN gcr.io/openssf/scorecard:stable \
  --repo=github.com/cacheplane/angular-agent-framework --format=json > /tmp/scorecard-after.json
python3 -c "import json;d=json.load(open('/tmp/scorecard-after.json'));print('AGGREGATE',d['score']);[print(c['name'],c['score']) for c in d['checks']]"
```

- [ ] **Step 2: Append the delta to the audit file**

Add an "After hardening" table next to the baseline, and confirm these checks improved:
`Security-Policy`, `SAST`, `Token-Permissions`, `Pinned-Dependencies`, `Dependency-Update-Tool`,
`Signed-Releases`. Note any check still at 0 with a one-line reason.

- [ ] **Step 3: Confirm the badge renders**

Run:
```bash
curl -sI "https://api.scorecard.dev/projects/github.com/cacheplane/angular-agent-framework/badge" | head -1
```
Expected: `HTTP/2 200` (may take up to one scheduled run after first publish to populate).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-18-scorecard-baseline.md
git commit -m "docs(audit): record OSSF Scorecard delta after hardening"
```

---

## Self-Review notes

- **Spec coverage:** Scorecard workflow (T5), SECURITY.md + private reporting (T2), CodeQL (T4), Renovate + SHA pinning (T7, T8), token permissions (T3), repo settings (T6), commit signing + enforcement (T9, T10), signed tags + SLSA artifacts (T11, T12), PyPI attestations (T13), verification (T1, T14). All spec sections mapped.
- **Out of scope (per spec), intentionally absent:** HVTracker registration, Adoption optimization, Fuzzing, CII-Best-Practices.
- **Sequencing guard:** Task 8 pins Actions in workflows created by Tasks 4, 5, 12. Task 14 must run only after Groups 1–2 land on `main`.
