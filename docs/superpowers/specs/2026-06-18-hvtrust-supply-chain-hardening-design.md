# HVTrust Supply-Chain Hardening — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm), pending implementation plan
**Owner:** Brian Love

## Background

[HVTracker](https://github.com/YugantM/hvtracker) (live at hvtracker.net) is a public
trust registry that ranks open-source AI agent projects — threadplane's exact category —
by an **HVTrust** score (0–100). It deliberately rewards *verifiable supply-chain evidence*
over GitHub stars.

### How HVTrust is computed

From `compute_trust_score()` in HVTracker's `fetch_and_build.py`:

```
HVTrust = clamp( gate( confidence × Σ(weightᵢ · dimᵢ) − penalties ) )
```

Five weighted dimensions (each a 0–1 sub-score × weight):

| Dimension | Weight | Inputs |
|---|---|---|
| Safety / Integrity | 25 | `0.5·OSSF-Scorecard + 0.3·has_provenance + 0.2·signed_commits_ratio` |
| Identity / Provenance | 18 | `0.6·listed_in_registry + 0.4·has_provenance` |
| Transparency | 17 | `0.5·license_present + 0.5·OSSF-Scorecard` |
| Maintenance | 20 | `0.6·freshness(180d) + 0.4·log(weekly_commits)` |
| Adoption | 20 | `0.6·log(stars/100k) + 0.4·log(downloads/1M)`, capped |

Modifiers: **confidence** = present÷applicable signal types (floored 0.4);
**penalties** = −10 if no push in >365 days; **gate** caps delisted/rejected at 25,
legacy at 70. **Evidence grade** is a band of the final score: A ≥80, B ≥65, C ≥50, D <50.

### threadplane's measured baseline (2026-06-18)

| Signal | Value |
|---|---|
| License | MIT ✓ |
| npm provenance (SLSA attestations) | **Present ✓** on all published `@threadplane/*` |
| Last push / freshness | today (max) |
| Weekly commits | ~29 (843 / 90d) |
| Stars | 99 |
| Weekly downloads (scope) | ~450 across 8 published packages |
| Commit verification on `main` | All recent commits `verification.reason: valid` (GitHub squash-merge signing) |
| OSSF Scorecard | **Not run** |
| Listed on HVTracker | No (handled separately by owner) |
| Repo hardening | No SECURITY.md, no Dependabot/Renovate, no CodeQL, Actions pinned by tag not SHA |

**Computed today (confidence ≈ 1.0):** ~49 (auto-crawl, not listed, no Scorecard) → Grade D;
~70 once listed + Scorecard ~5.0 → Grade B. The dominant lever is the **OSSF Scorecard**,
whose score feeds both Safety (×0.5) and Transparency (×0.5) — ~21 points of weight.

## Goal

Raise threadplane's HVTrust by closing *evidence-publishing* gaps with genuine
supply-chain improvements. No score gaming. Registering with HVTracker and chasing
Adoption are explicitly **out of scope**.

## Traceability

| Change | OSSF Scorecard check | HVTrust effect |
|---|---|---|
| Scorecard workflow + `publish_results` | (enables measurement + badge) | Makes Safety/Transparency computable; HVTracker ingests it |
| `SECURITY.md` + private vuln reporting | Security-Policy (0→10) | ↑ Scorecard → Safety/Transparency |
| CodeQL workflow | SAST (0→10) | ↑ Scorecard |
| Renovate + pin Actions by SHA | Dependency-Update-Tool + Pinned-Dependencies | ↑ Scorecard |
| Top-level `permissions:` on 3 publish workflows | Token-Permissions | ↑ Scorecard |
| Secret scanning + push protection + Dependabot security updates | (repo posture) | ↑ Scorecard |
| Require signed commits on `main` + SSH-sign local | (locks signed ratio) | Safety ×0.2 held at max |
| Signed git tags + SLSA provenance on Release artifacts | Signed-Releases (0→high) | ↑ Scorecard; Safety/Identity provenance |

## Components

### 1. OSSF Scorecard workflow (`.github/workflows/scorecard.yml`)
- `ossf/scorecard-action`, **pinned by SHA**.
- Triggers: weekly `schedule`, `push` to `main`, `branch_protection_rule`.
- Least-privilege perms: `security-events: write`, `id-token: write`, `contents: read`, `actions: read`.
- `publish_results: true` (publishes to the public OpenSSF API — required for the badge and
  for HVTracker to read). SARIF uploaded to GitHub code scanning.
- Add the Scorecard badge to `README.md`.
- **Optional follow-up:** a fine-grained read `SCORECARD_TOKEN` secret to unlock the
  Branch-Protection check (the default `GITHUB_TOKEN` can't read branch protection).
  Flagged, not required for the first pass.

### 2. Hardening files
- `SECURITY.md` — supported versions + private reporting via GitHub Security Advisories.
  Enable **Private vulnerability reporting** in repo settings.
- `.github/workflows/codeql.yml` — CodeQL for `javascript-typescript` **and** `python`
  (the repo ships the Python middleware). Pinned by SHA, minimal perms.
- Add top-level `permissions: contents: read` to `publish.yml`, `publish-middleware-npm.yml`,
  `publish-middleware-python.yml` (the only 3 of 8 workflows lacking it; job-level
  `id-token: write` already elevates where needed).

### 3. Renovate (`renovate.json`)
- Extends `config:recommended` + `helpers:pinGitHubActionDigests` (pins every Action by SHA
  and keeps the SHAs current — satisfies Dependency-Update-Tool **and** Pinned-Dependencies).
- Grouped, scheduled updates to limit PR noise.
- Initial bulk SHA-pinning pass across all 8 existing workflows (via `pinact` locally) so we
  don't wait on Renovate's first run.
- **Manual step (owner):** install the Renovate GitHub App on the repo. The config lands in
  the PR.

### 4. Commit signing — enforce + sign local
- Local SSH commit signing: `gpg.format=ssh`, `commit.gpgsign=true`, existing SSH key as
  `user.signingkey`; add that key as a **signing key** on GitHub. Capture exact setup in
  `CONTRIBUTING.md`.
- Enforce `required_signatures` on `main` branch protection (`gh api`). Safe: GitHub
  squash-merges, Renovate-app commits, and Dependabot commits are all auto-signed; only stray
  unsigned *direct* pushes to `main` are rejected (intended).

### 5. Release signing — full SLSA artifacts
- Signed tags: `tag.gpgsign=true` so `nx release` tags are SSH-signed (piggybacks on #4).
  Existing npm provenance untouched.
- GitHub Release provenance: add `slsa-framework/slsa-github-generator` (generic generator)
  to the tag-triggered release flow — hash the built artifacts (npm pack tarballs of the
  publishable libs), generate a signed `*.intoto.jsonl`, attach it to the GitHub Release.
  This is what Scorecard's Signed-Releases check inspects (Release assets), complementing the
  registry-side npm provenance.
- PyPI: enable attestations in the Python publish (`gh-action-pypi-publish` with
  `attestations: true`).
- Heaviest component; sequenced last.

## Sequencing

1. Hardening files + token perms + Scorecard workflow + repo settings *(makes Scorecard measurable)*
2. Renovate + SHA pinning
3. Commit signing + enforcement
4. SLSA release artifacts

Each step is an independent PR-sized chunk.

## Verification

- Run `scorecard` locally (or read the first published run) before/after to confirm check deltas.
- Confirm the badge renders in `README.md`.
- Confirm a dry-run release produces and attaches the SLSA provenance `*.intoto.jsonl`.
- Confirm `required_signatures` is active via `gh api .../branches/main/protection`.

## Out of scope

- Registering with HVTracker (owner handling separately).
- Adoption optimization (log-capped; not worth the effort).
- Fuzzing and CII-Best-Practices Scorecard checks (high effort, low marginal HVTrust return).
