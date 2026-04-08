# Cockpit Phase 2 Harness And Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the product-first repo structure, Nx project boundaries, shared cockpit libraries, and scaffolding path for capability modules.

**Architecture:** Create the foundational repo units without building the full cockpit UI. This phase locks the filesystem layout, Nx project registration, and generated scaffolding conventions that later phases depend on.

**Tech Stack:** Nx, TypeScript, Next.js config, Python run-commands targets

---

### Task 1: Create the cockpit app skeleton

**Files:**
- Create: `apps/cockpit/project.json`
- Create: `apps/cockpit/package.json`
- Create: `apps/cockpit/tsconfig.json`
- Create: `apps/cockpit/next.config.ts`
- Create: `apps/cockpit/src/app/layout.tsx`
- Create: `apps/cockpit/src/app/page.tsx`

- [ ] **Step 1: Create a failing build by registering the app without implementation**
- [ ] **Step 2: Run the cockpit build to confirm failure**
- [ ] **Step 3: Add the minimal Next.js cockpit shell skeleton**
- [ ] **Step 4: Re-run the cockpit build**
- [ ] **Step 5: Commit**

Run:
- `npx nx build cockpit --skip-nx-cache`

Expected:
- initial failure, then successful minimal build

### Task 2: Create shared cockpit library skeletons

**Files:**
- Create: `libs/cockpit-shell/**`
- Create: `libs/cockpit-ui/**`
- Create: `libs/cockpit-docs/**`
- Create: `libs/cockpit-testing/**`

- [ ] **Step 1: Create minimal project files for each shared library**
- [ ] **Step 2: Add placeholder exports aligned to the spec boundaries**
- [ ] **Step 3: Add lightweight build or test targets as appropriate**
- [ ] **Step 4: Verify Nx can target the new libraries**

Run:
- `npx nx graph --file tmp/cockpit-graph.html`
- `npx nx show project cockpit-shell`

Expected:
- new libraries appear as valid Nx projects

### Task 3: Create the product-first capability directory conventions

**Files:**
- Create: `cockpit/deep-agents/.gitkeep`
- Create: `cockpit/langgraph/.gitkeep`
- Create: `cockpit/README.md`
- Create: `tools/generators/cockpit-capability/**` if generation is implemented now

- [ ] **Step 1: Add the top-level product-first directories**
- [ ] **Step 2: Document the expected module shape**
- [ ] **Step 3: If generation is implemented now, scaffold one dry-run capability template**
- [ ] **Step 4: Verify the documented shape matches Phase 1 manifest identity**

Run:
- `rg -n "product-first|topic|page|language" cockpit/README.md`

Expected:
- directory contract is explicit and aligned with the spec

### Task 4: Add one end-to-end scaffolding path

**Files:**
- Create: representative sample under `cockpit/langgraph/streaming/python/**`
- Modify: any generator/template files created in Task 3

- [ ] **Step 1: Create one minimal representative capability module**
- [ ] **Step 2: Verify it can be targeted by Nx if appropriate**
- [ ] **Step 3: Verify metadata binding to `libs/cockpit-registry`**
- [ ] **Step 4: Commit**

Run:
- `npx nx show projects`

Expected:
- one representative module exists and proves the architecture is real

### Task 5: Verify the full phase

**Files:**
- Verify only

- [ ] **Step 1: Build the cockpit app**
- [ ] **Step 2: Verify the new libraries are discoverable**
- [ ] **Step 3: Commit**

Run:
- `npx nx build cockpit --skip-nx-cache`
- `npx nx show projects | rg "cockpit"`

Expected:
- cockpit app and shared libs are registered and buildable
