# Cockpit Harness And Repo Architecture Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Repository layout, Nx project model, shared libraries, and capability-module structure for the cockpit harness.

---

## Goal

Define a product-first repository architecture for the cockpit harness that supports:

- one integrated cockpit app
- one canonical demo module per capability
- Python-first examples
- optional TypeScript parity
- shared testing and docs metadata
- Nx-native builds, caching, and task orchestration

---

## Repository Shape

Top-level project structure:

- `apps/website`
- `apps/cockpit`
- `cockpit/deep-agents/<capability>/<language>`
- `cockpit/langgraph/<capability>/<language>`
- `libs/cockpit-*`

The `cockpit/` tree contains capability modules, not standalone deployed apps.

---

## Nx Modeling Rules

Use Nx projects for runnable or independently verifiable units.

Use libraries for reused code and contracts.

Therefore:

- `apps/cockpit` is an Nx app
- each capability module is an Nx project when it has runnable or testable behavior
- shared registry, UI, contracts, and testing utilities are Nx libs

Do not force every capability into a shared lib abstraction. Capability modules are delivery units and should remain independently targetable.

---

## Shared Library Families

Expected shared libraries:

- `libs/cockpit-registry`
  - authoritative manifest schema
  - capability and docs-entry metadata
  - language/fallback resolution
- `libs/cockpit-shell`
  - shell contracts
  - route helpers
  - common loader interfaces
- `libs/cockpit-ui`
  - shell UI primitives
  - code/prompt/docs panels
  - navigation components
- `libs/cockpit-docs`
  - docs mapping
  - page resolution
  - content adapters
- `libs/cockpit-testing`
  - smoke harnesses
  - fixtures
  - shared assertions

---

## Capability Module Shape

Each capability module should be self-describing and minimally coupled.

Expected module responsibilities:

- capability metadata
- runtime adapter
- frontend surface entrypoint if needed
- backend/service wiring if needed
- prompt assets
- docs references
- smoke/integration tests

Expected non-responsibilities:

- shell navigation policy
- language fallback logic
- cross-product UI conventions
- authored docs content

Authored docs content should live under the website/docs content system. Capability modules bind to those docs through manifest references; they do not own the prose files themselves.

---

## Language Strategy

Each capability module may have:

- Python implementation only
- Python and TypeScript implementations

TypeScript parity is optional per capability.

The repo layout must allow:

- missing TypeScript equivalents
- explicit language availability metadata
- stable capability identity regardless of language count

---

## Docs-Only Entries Versus Capability Modules

Not every registry entry becomes a runnable capability module.

Rules:

- `docs-only` entries, such as product overviews and getting-started overviews, live only in the manifest and docs content system
- `capability` entries get cockpit modules and runtime adapters

This prevents the harness from inventing fake runtime modules for narrative-only content.

---

## Dependency Direction

Dependency direction should be:

- capability modules depend on shared shell/testing/docs libs
- apps depend on shared libs and capability modules
- shared libs do not depend on specific capability modules

This keeps the shell generic and avoids inversion where the platform is coupled to particular demos.

---

## Generator Requirement

The architecture should support a future Nx generator that scaffolds:

- capability directory
- metadata skeleton
- test targets
- docs placeholders
- cockpit registration

The repo structure should be chosen with generation in mind.

---

## Non-Goals

This spec does not define:

- cockpit UI behavior
- docs information architecture
- rollout sequencing
- CI workflow details

---

## Success Criteria

This spec is successful when:

- every capability can be added without reshaping the repo
- shared logic has obvious homes in libs
- Nx can cache and target capability-level work
- the shell remains generic while capability modules remain independently testable
