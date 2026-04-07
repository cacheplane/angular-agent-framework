# Cockpit Phase 1 Manifest And IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared cockpit manifest, canonical IDs, language fallback behavior, and initial approved matrix inventory as executable code and content contracts.

**Architecture:** Build `libs/cockpit-registry` first and make it the single owner of topic/page/language metadata. Add deterministic resolution helpers and initial manifest data for both products. No cockpit UI or docs rendering belongs in this phase.

**Tech Stack:** Nx, TypeScript, Vitest, JSON or TS data modules

---

### Task 1: Create the registry library

**Files:**
- Create: `libs/cockpit-registry/project.json`
- Create: `libs/cockpit-registry/package.json`
- Create: `libs/cockpit-registry/tsconfig.json`
- Create: `libs/cockpit-registry/src/index.ts`
- Create: `libs/cockpit-registry/src/lib/manifest.types.ts`
- Create: `libs/cockpit-registry/src/lib/manifest.ts`
- Create: `libs/cockpit-registry/src/lib/manifest.spec.ts`

- [ ] **Step 1: Write the failing manifest type test**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Implement the minimal manifest schema types**
- [ ] **Step 4: Add exports**
- [ ] **Step 5: Run the targeted test to verify it passes**

Run:
- `npx vitest run libs/cockpit-registry/src/lib/manifest.spec.ts`

Expected:
- initial failure before implementation
- passing after schema is added

### Task 2: Encode the approved starting inventory

**Files:**
- Modify: `libs/cockpit-registry/src/lib/manifest.ts`
- Modify: `libs/cockpit-registry/src/lib/manifest.spec.ts`

- [ ] **Step 1: Write failing tests for the approved Deep Agents and LangGraph inventory**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Add manifest entries for all approved topics**
- [ ] **Step 4: Mark `getting-started / overview` entries as `docs-only`**
- [ ] **Step 5: Run the targeted test to verify it passes**

Run:
- `npx vitest run libs/cockpit-registry/src/lib/manifest.spec.ts`

Expected:
- manifest contains all approved topics and languages

### Task 3: Implement language and fallback resolution

**Files:**
- Create: `libs/cockpit-registry/src/lib/resolve-language.ts`
- Create: `libs/cockpit-registry/src/lib/resolve-language.spec.ts`
- Modify: `libs/cockpit-registry/src/index.ts`

- [ ] **Step 1: Write failing tests for equivalent-page and fallback resolution**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Implement page-equivalent lookup**
- [ ] **Step 4: Implement fallback to product `getting-started / overview`**
- [ ] **Step 5: Run the targeted test to verify it passes**

Run:
- `npx vitest run libs/cockpit-registry/src/lib/resolve-language.spec.ts`

Expected:
- deterministic page resolution for matching and missing parity cases

### Task 4: Add validation helpers for planning and CI use

**Files:**
- Create: `libs/cockpit-registry/src/lib/validate-manifest.ts`
- Create: `libs/cockpit-registry/src/lib/validate-manifest.spec.ts`
- Modify: `libs/cockpit-registry/src/index.ts`

- [ ] **Step 1: Write failing tests for invalid duplicate ids and invalid fallback targets**
- [ ] **Step 2: Run the targeted test to verify it fails**
- [ ] **Step 3: Implement validation helpers**
- [ ] **Step 4: Export the helpers**
- [ ] **Step 5: Run the targeted test to verify it passes**

Run:
- `npx vitest run libs/cockpit-registry/src/lib/validate-manifest.spec.ts`

Expected:
- manifest validation rejects duplicate or inconsistent entries

### Task 5: Verify the full phase

**Files:**
- Verify only

- [ ] **Step 1: Run the registry test suite**
- [ ] **Step 2: Run any lint/build target added for the new library**
- [ ] **Step 3: Commit**

Run:
- `npx nx test cockpit-registry --skip-nx-cache`
- `npx nx lint cockpit-registry --skip-nx-cache`

Expected:
- both pass
