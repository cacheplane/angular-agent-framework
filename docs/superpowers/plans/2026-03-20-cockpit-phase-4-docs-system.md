# Cockpit Phase 4 Docs System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the docs bundle system, shared metadata-driven linking between the website and cockpit, and the product-first docs IA for Deep Agents and LangGraph.

**Architecture:** Extend the existing website docs surface to consume cockpit manifest metadata. Keep authored docs in the website content system while binding them to capability topics and page ids through shared registry metadata.

**Tech Stack:** Next.js, MDX/content files, TypeScript, Nx

---

### Task 1: Create docs bundle resolution helpers

**Files:**
- Create: `libs/cockpit-docs/src/lib/docs-bundle.ts`
- Create: `libs/cockpit-docs/src/lib/docs-bundle.spec.ts`
- Modify: `libs/cockpit-docs/src/index.ts`

- [ ] **Step 1: Write failing tests for docs bundle lookup by topic/page/language**
- [ ] **Step 2: Run them to confirm failure**
- [ ] **Step 3: Implement the minimal docs bundle resolution**
- [ ] **Step 4: Re-run the tests**

Run:
- `npx vitest run libs/cockpit-docs/src/lib/docs-bundle.spec.ts`

Expected:
- docs entries resolve from shared manifest metadata

### Task 2: Create website content structure for the new taxonomy

**Files:**
- Create: `apps/website/content/docs/deep-agents/**`
- Create: `apps/website/content/docs/langgraph/**`
- Create: representative overview/build/prompts/code/testing docs files

- [ ] **Step 1: Add the new product-first docs directories**
- [ ] **Step 2: Create representative content files for one Deep Agents topic and one LangGraph topic**
- [ ] **Step 3: Verify content names align with Phase 1 page ids**

Run:
- `find apps/website/content/docs/deep-agents -maxdepth 4 -type f | sort`
- `find apps/website/content/docs/langgraph -maxdepth 4 -type f | sort`

Expected:
- docs tree matches the approved taxonomy

### Task 3: Bind website routes to the shared docs model

**Files:**
- Modify: `apps/website/src/lib/docs.ts`
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`
- Create: tests around route mapping if missing

- [ ] **Step 1: Write a failing route-resolution test**
- [ ] **Step 2: Run it to confirm failure**
- [ ] **Step 3: Implement docs routing against cockpit metadata**
- [ ] **Step 4: Re-run the test**

Run:
- `npx nx test website --skip-nx-cache` if a website test target exists
- otherwise run the narrow test command introduced for this work

Expected:
- website docs route by shared topic/page/language identity

### Task 4: Add website-to-cockpit linking primitives

**Files:**
- Create: `apps/website/src/components/docs/open-in-cockpit.tsx`
- Modify: docs rendering components as needed

- [ ] **Step 1: Add failing component tests or route assertions**
- [ ] **Step 2: Implement “open in cockpit” and language-aware cross-links**
- [ ] **Step 3: Re-run the tests**

Run:
- targeted component or route tests

Expected:
- website docs link into cockpit views without hardcoded per-page logic

### Task 5: Verify the docs phase

**Files:**
- Verify only

- [ ] **Step 1: Build the website**
- [ ] **Step 2: Verify representative docs routes**
- [ ] **Step 3: Commit**

Run:
- `npx nx build website --skip-nx-cache`

Expected:
- website builds with new docs structure and shared bindings
