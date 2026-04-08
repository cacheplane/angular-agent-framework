# Agent-First Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-time high-quality docs generation system that produces agent-first Markdown documentation from code and examples, then supports long-lived contributor iteration with advisory drift reporting.

**Architecture:** The docs system will extract structured source-of-truth artifacts from code, examples, tests, prompts, and manifests; synthesize excellent first-pass developer documentation; materialize that output into Markdown; and provide drift warnings rather than CI gates. The implementation is split into extraction, synthesis, Markdown generation, validation/reporting, and docs-surface integration.

**Tech Stack:** Nx, TypeScript, Next.js, Markdown/MDX, cockpit manifest metadata, Node scripts

---

## File Map

- Create: `libs/docs-source/**`
  Extract source-of-truth artifacts from code, examples, tests, prompts, and manifests.
- Create: `libs/docs-synthesis/**`
  Assemble page models and narrative synthesis inputs.
- Create: `libs/docs-generation/**`
  Materialize generated Markdown and frontmatter into the docs tree.
- Create: `libs/docs-drift/**`
  Compare generated expectations against maintained Markdown and emit advisory warnings/prompts.
- Modify: `apps/website/content/docs/**`
  Receive generated Markdown baseline.
- Modify: `apps/website/src/lib/docs.ts`
  Read generated metadata and content consistently.
- Modify: `apps/cockpit/**` only if UI integration needs richer source mappings.
- Create: `tools/docs/**`
  Entry scripts for generation, validation, and drift reporting.

This plan intentionally separates extraction, synthesis, generation, and drift reporting so each part can be tested independently.

## Ownership Rules

- Generated Markdown is written into `apps/website/content/docs/**` for the initial pass.
- Generator-owned metadata blocks and sections must be clearly marked.
- Post-generation contributor edits are allowed.
- The generator must not blindly overwrite maintained Markdown during ordinary iteration.
- Drift reporting compares current source-of-truth expectations to maintained Markdown and emits warnings/prompts rather than forcing regeneration.

## Narrative Rules

For the initial pass, narrative sections such as:

- why this example exists
- architecture
- common failure modes
- related examples

are generated from structured heuristics based on:

- manifest metadata
- prompt assets
- verification targets
- commands
- code maps
- dependency relationships

These sections are expected to be strong but not perfect. They become editable Markdown after generation.

## First-Pass Scope

The first pass must cover all docs families coherently, but implementation should prioritize sources that already have structured metadata and good extraction surfaces:

- cockpit capability docs
- Deep Agents capability docs
- LangGraph capability docs
- StreamResource library docs where current examples, prompts, tests, and code maps are sufficient

If a docs family has weaker source data, generate the best viable baseline rather than inventing unsupported claims.

---

### Task 1: Build the source extraction layer

**Files:**
- Create: `libs/docs-source/project.json`
- Create: `libs/docs-source/package.json`
- Create: `libs/docs-source/tsconfig.json`
- Create: `libs/docs-source/src/index.ts`
- Create: `libs/docs-source/src/lib/extract-manifest.ts`
- Create: `libs/docs-source/src/lib/extract-code-map.ts`
- Create: `libs/docs-source/src/lib/extract-prompts.ts`
- Create: `libs/docs-source/src/lib/extract-verification.ts`
- Create: `libs/docs-source/src/lib/docs-source.spec.ts`

- [ ] **Step 1: Write failing tests for manifest, code-map, prompt, and verification extraction**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement minimal extractors against existing cockpit and website metadata**
- [ ] **Step 3: Implement minimal extractors against existing cockpit, docs, prompt, and verification metadata**
- [ ] **Step 4: Export the extraction APIs**
- [ ] **Step 5: Re-run the targeted tests**
- [ ] **Step 6: Commit**

Run:
- `npx vitest run libs/docs-source/src/lib/docs-source.spec.ts`

Expected:
- tests fail before implementation and pass after extractors are added

---

### Task 2: Build the page synthesis layer

**Files:**
- Create: `libs/docs-synthesis/project.json`
- Create: `libs/docs-synthesis/package.json`
- Create: `libs/docs-synthesis/tsconfig.json`
- Create: `libs/docs-synthesis/src/index.ts`
- Create: `libs/docs-synthesis/src/lib/page-model.ts`
- Create: `libs/docs-synthesis/src/lib/synthesize-page.ts`
- Create: `libs/docs-synthesis/src/lib/synthesize-page.spec.ts`

- [ ] **Step 1: Write failing tests for the standard page model**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement synthesis for the standard sections**
- [ ] **Step 4: Ensure the output includes frontend, backend, prompts, verification, and failure modes**
- [ ] **Step 5: Re-run the targeted tests**
- [ ] **Step 6: Commit**

Run:
- `npx vitest run libs/docs-synthesis/src/lib/synthesize-page.spec.ts`

Expected:
- a synthesized page model exists for capability docs and library docs, including generated narrative sections

---

### Task 3: Materialize generated Markdown

**Files:**
- Create: `libs/docs-generation/project.json`
- Create: `libs/docs-generation/package.json`
- Create: `libs/docs-generation/tsconfig.json`
- Create: `libs/docs-generation/src/index.ts`
- Create: `libs/docs-generation/src/lib/render-markdown.ts`
- Create: `libs/docs-generation/src/lib/render-markdown.spec.ts`
- Create: `tools/docs/generate-docs.ts`
- Modify: `apps/website/content/docs/**`

- [ ] **Step 1: Write failing tests for Markdown rendering with stable frontmatter/metadata**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement Markdown rendering from the synthesized page model**
- [ ] **Step 4: Add the generation script**
- [ ] **Step 5: Materialize representative docs into the website docs tree**
- [ ] **Step 6: Re-run the targeted tests**
- [ ] **Step 7: Commit**

Run:
- `npx vitest run libs/docs-generation/src/lib/render-markdown.spec.ts`
- `npx tsx tools/docs/generate-docs.ts --check`

Expected:
- generated Markdown is deterministic and suitable for long-lived editing

---

### Task 4: Integrate generated docs with the existing docs surfaces

**Files:**
- Modify: `apps/website/src/lib/docs.ts`
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`
- Modify: any docs-routing helpers that need to consume generated metadata
- Create/Modify: tests for generated-doc resolution

- [ ] **Step 1: Write failing tests for generated-doc discovery in the website docs layer**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Update the docs reader to consume generated Markdown and metadata consistently**
- [ ] **Step 4: Re-run the targeted tests**
- [ ] **Step 5: Build the website**
- [ ] **Step 6: Commit**

Run:
- targeted docs tests introduced in this task
- `NX_DAEMON=false npx nx build website --skip-nx-cache`

Expected:
- website docs resolve generated content correctly

---

### Task 5: Add advisory drift reporting

**Files:**
- Create: `libs/docs-drift/project.json`
- Create: `libs/docs-drift/package.json`
- Create: `libs/docs-drift/tsconfig.json`
- Create: `libs/docs-drift/src/index.ts`
- Create: `libs/docs-drift/src/lib/detect-drift.ts`
- Create: `libs/docs-drift/src/lib/detect-drift.spec.ts`
- Create: `tools/docs/report-drift.ts`

- [ ] **Step 1: Write failing tests for stale-doc detection**
- [ ] **Step 2: Run the targeted tests to verify they fail**
- [ ] **Step 3: Implement drift detection against selected source-of-truth fields**
- [ ] **Step 4: Emit warning output and suggested prompt/update brief instead of exit failures**
- [ ] **Step 5: Re-run the targeted tests**
- [ ] **Step 6: Commit**

Run:
- `npx vitest run libs/docs-drift/src/lib/detect-drift.spec.ts`
- `npx tsx tools/docs/report-drift.ts`

Expected:
- drift is reported clearly without gating documentation updates

---

### Task 6: Generate the first full docs baseline

**Files:**
- Modify: `apps/website/content/docs/**`
- Modify: any generation config or templates needed

- [ ] **Step 1: Run the full docs generation pipeline against the current codebase**
- [ ] **Step 2: Review representative outputs across StreamResource, Deep Agents, LangGraph, and cockpit-linked docs**
- [ ] **Step 3: Fix the highest-signal generation defects**
- [ ] **Step 4: Re-run generation**
- [ ] **Step 5: Build the website and verify representative routes**
- [ ] **Step 6: Commit**

Run:
- `npx tsx tools/docs/generate-docs.ts`
- `NX_DAEMON=false npx nx build website --skip-nx-cache`

Expected:
- the repository contains a strong first-pass Markdown docs baseline generated from source-of-truth artifacts

---

### Task 7: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run all docs-system test suites**
- [ ] **Step 2: Run generation and drift reporting**
- [ ] **Step 3: Build the website**
- [ ] **Step 4: Review representative docs routes manually or via targeted checks**
- [ ] **Step 5: Commit**

Run:
- `npx vitest run libs/docs-source/src/lib/docs-source.spec.ts libs/docs-synthesis/src/lib/synthesize-page.spec.ts libs/docs-generation/src/lib/render-markdown.spec.ts libs/docs-drift/src/lib/detect-drift.spec.ts`
- `npx tsx tools/docs/generate-docs.ts --check`
- `npx tsx tools/docs/report-drift.ts`
- `NX_DAEMON=false npx nx build website --skip-nx-cache`

Expected:
- docs generation, docs validation, and website build all pass
