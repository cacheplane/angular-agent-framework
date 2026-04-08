# Cockpit Phase 6 Testing And Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the cockpit and capability matrix with a production-grade testing and deployment model, including CI, cockpit e2e, capability smoke/integration registration, and deploy smoke for `cockpit.cacheplane.ai`.

**Architecture:** Extend the existing repo testing strategy instead of creating a one-off harness flow. Capability-level smoke and integration remain separate, and cockpit-level verification proves the integrated shell, routing, language fallback, and representative capability loading.

**Tech Stack:** Nx, Playwright, Vitest, pytest, GitHub Actions, Vercel

---

### Task 1: Register capability testing contracts

**Files:**
- Modify: `libs/cockpit-registry/**`
- Modify: capability module metadata as needed

- [ ] **Step 1: Add failing tests for missing smoke or environment declarations**
- [ ] **Step 2: Run them to confirm failure**
- [ ] **Step 3: Extend the manifest schema to require testing contract fields**
- [ ] **Step 4: Re-run the tests**

Run:
- registry validation tests

Expected:
- capabilities cannot exist without explicit testing metadata

### Task 2: Add cockpit-level e2e

**Files:**
- Create: `apps/cockpit/e2e/**`
- Create or modify: `apps/cockpit/playwright.config.ts`
- Modify: `apps/cockpit/project.json`

- [ ] **Step 1: Write failing e2e tests for tree navigation, language switching, and representative capability loading**
- [ ] **Step 2: Run the e2e suite to confirm failure**
- [ ] **Step 3: Implement the minimal shell wiring or test harness support**
- [ ] **Step 4: Re-run the e2e suite**

Run:
- `npx nx e2e cockpit --skip-nx-cache`

Expected:
- cockpit e2e covers the shell contract rather than all business logic

### Task 3: Wire CI for capability smoke and cockpit integration

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/e2e.yml`
- Modify: `.github/workflows/publish.yml` if the cockpit has release-facing artifact checks

- [ ] **Step 1: Add CI jobs for cockpit build/test/e2e**
- [ ] **Step 2: Add representative capability smoke lanes**
- [ ] **Step 3: Keep secret-backed integration explicit and separate**
- [ ] **Step 4: Verify every referenced command is locally runnable**

Run:
- local command matrix matching the new workflow steps

Expected:
- CI catches cockpit and representative capability regressions before merge

### Task 4: Add deployment and post-deploy smoke

**Files:**
- Modify: cockpit deployment workflow or Vercel configuration as needed
- Create: deploy-smoke helper script if needed

- [ ] **Step 1: Define critical cockpit deploy routes**
- [ ] **Step 2: Add post-deploy smoke against `cockpit.cacheplane.ai` or the deployment preview URL**
- [ ] **Step 3: Fail the deploy flow on cockpit health regressions**

Run:
- local dry-run of the deploy smoke script against a known-good URL

Expected:
- deployed cockpit health is verified, not assumed

### Task 5: Verify the final phase

**Files:**
- Verify only

- [ ] **Step 1: Run representative capability smoke targets**
- [ ] **Step 2: Run cockpit build, test, and e2e**
- [ ] **Step 3: Run website build if docs integration changed**
- [ ] **Step 4: Commit**

Run:
- `npx nx build cockpit --skip-nx-cache`
- `npx nx test cockpit --skip-nx-cache`
- `npx nx e2e cockpit --skip-nx-cache`
- representative capability smoke commands
- `npx nx build website --skip-nx-cache`

Expected:
- cockpit platform and representative capability surfaces are release-verifiable
