# Cockpit Phase 5 Capability Matrix Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full approved Deep Agents and LangGraph capability matrix in the harness and docs system, Python-first and TypeScript where support is strong enough.

**Architecture:** Roll out capability modules topic-by-topic using the contracts and generators established in earlier phases. Each topic is incomplete until its cockpit module, docs bundle, prompts, code mapping, and tests exist together.

**Tech Stack:** Nx, TypeScript, Python, Next.js, pytest, Vitest

---

## Rollout Batches

- Batch A: product overviews and getting started
- Batch B: Deep Agents core capabilities
- Batch C: LangGraph core capabilities
- Batch D: TypeScript parity candidates

---

### Task 1: Implement Batch A

**Files:**
- Create/Modify: manifest entries already approved in Phase 1
- Create: docs content for both product overviews
- Create: any docs-only cockpit bindings required

- [ ] **Step 1: Add overview docs for Deep Agents and LangGraph**
- [ ] **Step 2: Verify language fallback for overview pages**
- [ ] **Step 3: Commit**

Run:
- representative docs route checks

Expected:
- both product overviews exist and are reachable from the shell and website

### Task 2: Implement Deep Agents capability modules

**Files:**
- Create: `cockpit/deep-agents/planning/python/**`
- Create: `cockpit/deep-agents/filesystem/python/**`
- Create: `cockpit/deep-agents/subagents/python/**`
- Create: `cockpit/deep-agents/memory/python/**`
- Create: `cockpit/deep-agents/skills/python/**`
- Create: `cockpit/deep-agents/sandboxes/python/**`
- Create matching docs bundles and tests

- [ ] **Step 1: For each topic, scaffold the module**
- [ ] **Step 2: Add prompts, code mappings, and docs bundle entries**
- [ ] **Step 3: Add smoke tests**
- [ ] **Step 4: Verify each topic before moving on**

Run:
- topic-level smoke targets for each implemented topic

Expected:
- every approved Deep Agents topic has a canonical Python reference module

### Task 3: Implement LangGraph capability modules

**Files:**
- Create: `cockpit/langgraph/persistence/python/**`
- Create: `cockpit/langgraph/durable-execution/python/**`
- Create: `cockpit/langgraph/streaming/python/**`
- Create: `cockpit/langgraph/interrupts/python/**`
- Create: `cockpit/langgraph/memory/python/**`
- Create: `cockpit/langgraph/subgraphs/python/**`
- Create: `cockpit/langgraph/time-travel/python/**`
- Create: `cockpit/langgraph/deployment-runtime/python/**`
- Create matching docs bundles and tests

- [ ] **Step 1: For each topic, scaffold the module**
- [ ] **Step 2: Add prompts, code mappings, and docs bundle entries**
- [ ] **Step 3: Add smoke tests**
- [ ] **Step 4: Verify each topic before moving on**

Run:
- topic-level smoke targets for each implemented topic

Expected:
- every approved LangGraph topic has a canonical Python reference module

### Task 4: Add TypeScript parity candidates

**Files:**
- Create only where the official docs/support are strong enough

- [ ] **Step 1: Identify parity candidates from the approved matrix**
- [ ] **Step 2: Add TypeScript modules and docs where justified**
- [ ] **Step 3: Verify switcher equivalence or fallback behavior**

Run:
- representative language-switch tests

Expected:
- TypeScript pages exist only where they can be defended as real references

### Task 5: Verify matrix completeness

**Files:**
- Verify manifest, docs, and tests

- [ ] **Step 1: Validate the manifest against the approved inventory**
- [ ] **Step 2: Verify no approved topic is missing required assets**
- [ ] **Step 3: Commit**

Run:
- a manifest completeness check command added in Phase 1 or Phase 6

Expected:
- approved matrix inventory is fully represented and status-tracked
