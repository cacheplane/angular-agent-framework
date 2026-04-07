# Cockpit Phase 3 Cockpit Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cockpit shell, thin adapter contract, navigation tree, language switching, and core code/prompt/docs panes.

**Architecture:** Implement the shell against the Phase 1 manifest and Phase 2 repo boundaries. Do not fill the full matrix yet; use a small representative set while proving the shell contract.

**Tech Stack:** Next.js, React, TypeScript, Nx, Playwright or Vitest where appropriate

---

### Task 1: Implement the shell contract in code

**Files:**
- Create: `libs/cockpit-shell/src/lib/capability-contract.ts`
- Create: `libs/cockpit-shell/src/lib/capability-contract.spec.ts`
- Modify: `libs/cockpit-shell/src/index.ts`

- [ ] **Step 1: Write the failing contract tests**
- [ ] **Step 2: Run them to confirm failure**
- [ ] **Step 3: Implement the thin shell contract**
- [ ] **Step 4: Re-run the tests**

Run:
- `npx vitest run libs/cockpit-shell/src/lib/capability-contract.spec.ts`

Expected:
- docs-only entries and runtime entries are distinguished correctly

### Task 2: Build navigation and route resolution

**Files:**
- Create: `apps/cockpit/src/components/navigation/**`
- Create: `apps/cockpit/src/lib/route-resolution.ts`
- Create: `apps/cockpit/src/lib/route-resolution.spec.ts`
- Modify: `apps/cockpit/src/app/page.tsx`

- [ ] **Step 1: Write failing tests for manifest-driven route resolution**
- [ ] **Step 2: Run them to confirm failure**
- [ ] **Step 3: Implement product/section/topic/page navigation**
- [ ] **Step 4: Re-run the tests**

Run:
- `npx vitest run apps/cockpit/src/lib/route-resolution.spec.ts`

Expected:
- shell routes resolve from manifest metadata only

### Task 3: Implement language switching and fallback

**Files:**
- Create: `apps/cockpit/src/components/language-switcher.tsx`
- Create: `apps/cockpit/src/components/language-switcher.spec.tsx`
- Modify: relevant shell pages/components

- [ ] **Step 1: Write failing UI tests for equivalent-page switching**
- [ ] **Step 2: Run them to confirm failure**
- [ ] **Step 3: Implement the switcher using Phase 1 resolution helpers**
- [ ] **Step 4: Re-run the tests**

Run:
- `npx vitest run apps/cockpit/src/components/language-switcher.spec.tsx`

Expected:
- switcher lands on equivalent pages or correct overview fallback

### Task 4: Implement shell panes

**Files:**
- Create: `apps/cockpit/src/components/code-pane/**`
- Create: `apps/cockpit/src/components/prompt-pane/**`
- Create: `apps/cockpit/src/components/docs-pane/**`
- Modify: `apps/cockpit/src/app/**`

- [ ] **Step 1: Add failing tests for pane rendering from metadata**
- [ ] **Step 2: Implement minimal code/prompt/docs panes**
- [ ] **Step 3: Re-run the tests**

Run:
- `npx vitest run apps/cockpit/src/components --passWithNoTests=false`

Expected:
- shell displays metadata-driven panes for representative modules

### Task 5: Verify the representative shell

**Files:**
- Verify only

- [ ] **Step 1: Build the cockpit**
- [ ] **Step 2: Run shell tests**
- [ ] **Step 3: Add a commit**

Run:
- `npx nx build cockpit --skip-nx-cache`
- `npx nx test cockpit --skip-nx-cache`

Expected:
- cockpit shell is buildable and navigable with representative content
