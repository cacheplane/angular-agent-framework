# Cockpit Phased Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full cockpit platform, capability harness, docs system, and deployment/testing model for Deep Agents and LangGraph developer-reference demos.

**Architecture:** Execute in six ordered phases. Phase 1 locks the shared manifest and IA contract. Phase 2 builds the harness and repo structure. Phase 3 builds the cockpit shell. Phase 4 builds the docs system. Phase 5 fills the full capability matrix. Phase 6 hardens testing and deployment. Earlier phases define contracts that later phases consume.

**Tech Stack:** Nx, Next.js, TypeScript, Python, Playwright, Vitest, pytest, GitHub Actions, Vercel

---

## Compact Context

- Top-level surfaces:
  - `apps/website`
  - `apps/cockpit`
- Product-first capability tree:
  - `cockpit/deep-agents/<capability>/<language>`
  - `cockpit/langgraph/<capability>/<language>`
- Shared library families:
  - `libs/cockpit-registry`
  - `libs/cockpit-shell`
  - `libs/cockpit-ui`
  - `libs/cockpit-docs`
  - `libs/cockpit-testing`
- Canonical registry identity:
  - `product / section / topic / page / language`
- Canonical page ids:
  - `overview`
  - `build`
  - `prompts`
  - `code`
  - `testing`
- Entry kinds:
  - `docs-only`
  - `capability`
- Runtime classes:
  - `docs-only`
  - `browser`
  - `local-service`
  - `secret-gated`
  - `deployed-service`
- Approved starting inventory:
  - Deep Agents: `overview`, `planning`, `filesystem`, `subagents`, `memory`, `skills`, `sandboxes`
  - LangGraph: `overview`, `persistence`, `durable-execution`, `streaming`, `interrupts`, `memory`, `subgraphs`, `time-travel`, `deployment-runtime`

---

## Phase Order

1. Phase 1: Manifest and IA foundation
2. Phase 2: Harness and repo architecture
3. Phase 3: Cockpit shell and adapter contract
4. Phase 4: Docs system and website integration
5. Phase 5: Capability matrix rollout
6. Phase 6: Testing and deployment hardening

---

## Worktree Map

- `.worktrees/cockpit-phase-1-manifest`
- `.worktrees/cockpit-phase-2-harness`
- `.worktrees/cockpit-phase-3-shell`
- `.worktrees/cockpit-phase-4-docs`
- `.worktrees/cockpit-phase-5-matrix`
- `.worktrees/cockpit-phase-6-testing`

Worktree ownership must remain disjoint wherever possible. Phase 5 depends on Phase 1-4 contracts and may need multiple sub-worktrees later, but not before the platform slices are merged.

---

## Phase Plan Files

- [2026-03-20-cockpit-phase-1-manifest-and-ia.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-1-manifest-and-ia.md)
- [2026-03-20-cockpit-phase-2-harness-and-repo.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-2-harness-and-repo.md)
- [2026-03-20-cockpit-phase-3-cockpit-shell.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-3-cockpit-shell.md)
- [2026-03-20-cockpit-phase-4-docs-system.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-4-docs-system.md)
- [2026-03-20-cockpit-phase-5-capability-matrix-rollout.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-5-capability-matrix-rollout.md)
- [2026-03-20-cockpit-phase-6-testing-and-deployment.md](/Users/blove/repos/stream-resource/docs/superpowers/plans/2026-03-20-cockpit-phase-6-testing-and-deployment.md)

---

## Execution Gates

- [ ] Phase 1 must land before any shell/docs/matrix work.
- [ ] Phase 2 must land before capability projects are scaffolded in bulk.
- [ ] Phase 3 and Phase 4 may proceed in parallel after Phase 1 and Phase 2.
- [ ] Phase 5 starts only after the shell, docs metadata contract, and harness generators/structure are in place.
- [ ] Phase 6 runs after at least one representative capability per product is integrated into the cockpit.

---

## Final Integration Matrix

Minimum end-state verification:

- `npx nx build cockpit --skip-nx-cache`
- `npx nx test cockpit --skip-nx-cache`
- `npx nx e2e cockpit --skip-nx-cache`
- `npx nx build website --skip-nx-cache`
- representative Python smoke targets for Deep Agents and LangGraph
- representative TypeScript capability smoke targets where implemented
- post-deploy smoke for `cockpit.cacheplane.ai`

---

## Final Step

- [ ] After all six phases complete and verification passes, run final review and integrate work into the approved branch strategy in effect at that time.
