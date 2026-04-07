# Testing Strategy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current ad hoc test coverage into an enforced, release-relevant testing strategy that catches runtime, packaging, and deploy regressions before merge.

**Architecture:** Split the work into three coordinated tracks. Track A owns all workflow and deploy-verification wiring. Track B adds runtime-focused tests and target wiring for the Angular library and example server. Track C hardens MCP artifact verification locally, then hands its named target to Track A for workflow integration. This keeps file ownership disjoint during implementation while preserving a single place for workflow policy.

**Tech Stack:** Nx, Vitest, Playwright, GitHub Actions, Node.js test runner, Python pytest, LangGraph dev server, Vercel deploy workflow

---

## Worktree And Subagent Map

- Worktree: `.worktrees/testing-ci-gates`
  Owner: CI/deploy hardening subagent
  Scope: `.github/workflows/`, `apps/website/project.json`, `apps/website/playwright.config.ts`, `project.json`, any minimal root/package scripts needed for gated execution
- Worktree: `.worktrees/testing-runtime-tests`
  Owner: runtime/integration subagent
  Scope: `libs/angular/`, `examples/chat-agent/`, `e2e/angular-e2e/`, target wiring for those suites
- Worktree: `.worktrees/testing-mcp-artifacts`
  Owner: MCP artifact-verification subagent
  Scope: `packages/mcp/` only

These tracks are intentionally disjoint at the file level so they can be implemented and reviewed in parallel.

---

## File Map

- Modify: `.github/workflows/ci.yml`
  Add missing PR gates for the suites that represent actual user risk.
- Modify: `.github/workflows/e2e.yml`
  Decide whether e2e belongs on `pull_request`, `push`, or both; keep secrets handling explicit.
- Modify: `.github/workflows/publish.yml`
  Add artifact verification before release and extend publish coverage beyond the library-only happy path.
- Modify: `apps/website/project.json`
  Ensure website e2e/build targets are runnable in CI without ad hoc command duplication.
- Modify: `apps/website/playwright.config.ts`
  Ensure CI can run website e2e with an explicit server strategy instead of relying on local-only defaults.
- Modify: `libs/angular/project.json`
  Keep canonical test command stable and add any missing integration-oriented targets if needed.
- Modify: `project.json`
  Add reusable root targets if needed for example-server smoke commands that CI must invoke consistently.
- Modify: `examples/chat-agent/pyproject.toml`
  Add pytest grouping or markers if needed for no-secrets smoke vs. secret-backed integration.
- Modify: `packages/mcp/project.json`
  Add a proper Nx test/smoke target for package artifact verification.
- Modify: `package.json`
  Add root-level helper scripts only if they reduce workflow duplication materially.
- Create/Modify: `packages/mcp/package-smoke.test.mjs`
  Keep built/source-package verification as a first-class smoke suite.
- Create/Modify: `libs/angular/src/lib/transport/*.spec.ts`
  Add transport-level tests for real SDK-like event shapes and cancellation behavior.
- Create/Modify: `examples/chat-agent/tests/test_agent.py`
  Separate always-on smoke/import tests from live-model integration tests.
- Create: `docs/superpowers/plans/2026-03-20-testing-strategy-hardening.md`
  This plan and execution ledger.

---

### Task 1: Harden CI and deploy gates

**Worktree:** `.worktrees/testing-ci-gates`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/e2e.yml`
- Modify: `.github/workflows/publish.yml`
- Modify: `apps/website/project.json`
- Modify: `apps/website/playwright.config.ts`
- Modify: `project.json` if reusable root targets reduce workflow duplication
- Modify: `package.json` (only if helper scripts remove duplication)

- [ ] **Step 1: Baseline the current workflow reality**

Run:
- `gh run list --limit 10`
- `cd .worktrees/testing-ci-gates && npx nx build website --skip-nx-cache`

Expected:
- Confirm current `CI` passes while `E2E` is failing on `main`.
- Capture that website build is locally runnable from the worktree.

- [ ] **Step 2: Write failing workflow expectations on paper before editing**

Document the intended gates:
- PRs must run website e2e, library tests, MCP smoke, and example-server smoke.
- Pushes to `main` keep the heavier e2e/deploy lanes.
- Publish must verify built artifacts before release.
- Workflow files are owned only by this track; other tracks expose named commands/targets for this track to call.

- [ ] **Step 3: Implement minimal workflow hardening**

Required outcomes:
- `ci.yml` runs the currently orphaned but valuable suites on `pull_request`.
- `e2e.yml` no longer waits until after merge to catch breakage.
- `publish.yml` proves artifacts, not just source builds.

- [ ] **Step 4: Verify workflow syntax and invoked commands**

Run:
- `npx nx build website --skip-nx-cache`
- Any newly added helper script commands locally

Expected: every command referenced by workflows is locally runnable.

---

### Task 2: Add runtime-focused library and example-server test coverage

**Worktree:** `.worktrees/testing-runtime-tests`

**Files:**
- Modify: `libs/angular/src/lib/transport/fetch-stream.transport.ts`
- Create/Modify: `libs/angular/src/lib/transport/fetch-stream.transport.spec.ts`
- Modify: `libs/angular/src/lib/internals/stream-manager.bridge.spec.ts`
- Modify: `libs/angular/project.json`
- Create/Modify: `examples/chat-agent/project.json` or modify `project.json`
- Modify: `examples/chat-agent/tests/test_agent.py`
- Modify: `examples/chat-agent/pyproject.toml`
- Modify: `e2e/angular-e2e/project.json` if needed

- [ ] **Step 1: Baseline the existing runtime suite**

Run:
- `cd .worktrees/testing-runtime-tests && npx nx test angular --skip-nx-cache`
- `cd .worktrees/testing-runtime-tests/examples/chat-agent && uv run pytest -q`

Expected:
- Capture current library and example-server status before adding new tests.

- [ ] **Step 2: Add transport-level contract tests for real SDK-like event shapes**

Required coverage:
- `messages/*`
- `updates`
- `interrupt` / `interrupts`
- cancellation / abort on thread change
- `joinStream`

- [ ] **Step 3: Split example-server tests into always-on smoke and secret-backed integration**

Target shape:
- import/cold-start/no-network tests run on every PR
- live OpenAI-backed tests remain opt-in or secret-backed

- [ ] **Step 4: Add or refine Nx/command targets so CI can run these suites directly**

Expected result:
- no ad hoc workflow command strings for Python or integration smoke
- stable, named targets or scripts for reuse
- the example server exposes reusable commands for `uv sync`, no-secrets pytest smoke, and any CI-startable local checks

- [ ] **Step 5: Verify**

Run:
- `cd .worktrees/testing-runtime-tests && npx nx test angular --skip-nx-cache`
- `cd .worktrees/testing-runtime-tests/examples/chat-agent && uv run pytest -q`

Expected: both commands pass, with the no-secrets subset always runnable.

---

### Task 3: Turn MCP package smoke into an enforced artifact-verification lane

**Worktree:** `.worktrees/testing-mcp-artifacts`

**Files:**
- Modify: `packages/mcp/project.json`
- Modify: `packages/mcp/package-smoke.test.mjs`

- [ ] **Step 1: Baseline the current artifact checks**

Run:
- `cd .worktrees/testing-mcp-artifacts && npx nx build mcp --skip-nx-cache`
- `cd .worktrees/testing-mcp-artifacts && node --test packages/mcp/package-smoke.test.mjs`

Expected: current smoke passes locally and proves the suite is ready to be enforced.

- [ ] **Step 2: Create a first-class Nx target for MCP smoke**

Goal: CI and publish workflows call a named target, not a one-off Node command.

- [ ] **Step 3: Extend smoke coverage only where it increases release confidence**

Candidate checks:
- built manifest path resolution
- source manifest path resolution
- bundled docs presence
- optional `npm pack` + temp install smoke if practical

- [ ] **Step 4: Wire the target into CI and publish**

Expected result:
- MCP exposes a named smoke target that Track A can wire into CI and publish.
- Raw `node --test` remains only as a baseline/debug command, not the canonical gate.

- [ ] **Step 5: Verify**

Run:
- `cd .worktrees/testing-mcp-artifacts && npx nx build mcp --skip-nx-cache`
- `cd .worktrees/testing-mcp-artifacts && node --test packages/mcp/package-smoke.test.mjs`
- `cd .worktrees/testing-mcp-artifacts && npx nx test mcp --skip-nx-cache`

Expected: all pass and are reusable from workflows.

---

### Task 4: Add post-deploy verification for the website

**Worktree:** `.worktrees/testing-ci-gates`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Optionally create: small script under `apps/website/scripts/` or `tools/` for URL smoke checks

- [ ] **Step 1: Define the minimum deploy smoke contract**

Required URLs:
- `/`
- `/pricing`
- `/docs/introduction`
- `/api-reference`
- `/llms.txt`

- [ ] **Step 2: Implement post-deploy smoke**

Requirement:
- run after `vercel deploy`
- fail the workflow if the deployed site is not healthy

- [ ] **Step 3: Verify locally as far as possible**

Run the smoke script against a known-good base URL or dry-run the shell logic.

Expected: deploy verification logic is syntactically correct and reusable.

---

### Task 5: Integrate and review

**Files:**
- Verify: all touched workflow, target, and test files

- [ ] **Step 1: Review each worktree diff against its owned track**

- [ ] **Step 2: Merge or port approved diffs back to the main tree**

- [ ] **Step 3: Run the combined verification matrix from main**

Minimum combined matrix:
- `npx nx test angular --skip-nx-cache`
- `npx nx build website --skip-nx-cache`
- `npx nx build mcp --skip-nx-cache`
- `npx nx test mcp --skip-nx-cache`
- `cd examples/chat-agent && uv run pytest -q`

- [ ] **Step 4: Run final review and then merge or squash the approved track diffs after integration verification**
