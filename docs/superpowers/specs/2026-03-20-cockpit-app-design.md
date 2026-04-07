# Cockpit App Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Cockpit shell behavior, runtime contract, adapter model, and user experience boundaries.

---

## Goal

Define a single integrated cockpit application that serves as:

- the live reference surface for all supported capabilities
- a marketing asset at `cockpit.cacheplane.ai`
- the canonical integration surface for examples and testing

---

## Product Direction

The cockpit is a single-pane integrated surface, not a directory of isolated mini-apps.

Users should be able to:

- navigate the capability tree
- switch language context
- inspect prompts
- inspect frontend and backend code
- interact with a capability surface
- understand how the example is built

---

## Core Design Choice

The cockpit uses a thin shell contract plus per-capability adapters.

The shell standardizes:

- routing
- registration
- navigation
- language switching
- docs/code/prompt panes
- lifecycle hooks
- test registration hooks

Each capability owns:

- runtime adapter
- execution surface
- state model
- controls
- backend/frontend composition

Capability surfaces are allowed to look visibly different.

---

## Shell Contract

The shell contract should require only what the shell actually needs:

- stable capability id
- stable topic id
- stable page id
- title and metadata
- product/section/language placement
- availability state
- entry kind
- runtime class
- code and prompt sources
- docs references
- mount/render entrypoint
- smoke/integration hooks

The shell must not require a shared business-state model across all capabilities.

Docs-only entries do not implement runtime hooks or mount entrypoints.

---

## Runtime Model

The cockpit may host capabilities with different runtime needs behind a common shell.

Examples:

- pure browser surface
- browser + server-backed interaction
- long-running graph state
- deep-agent task workflows

The shell must orchestrate these through adapter boundaries, not through a fake universal runtime.

---

## User Experience Regions

The cockpit should provide a consistent frame with regions such as:

- navigation tree
- capability execution surface
- code view
- prompt view
- explanation/docs linkage
- testing/verification status

The execution region is intentionally flexible per capability.

---

## Local And Deployed Modes

The cockpit must work in:

- local development
- deployed production

The same shell should support both modes through environment-aware adapters and feature gating where necessary.

Local and deployed behavior may differ operationally, but not structurally.

---

## Code Visibility

The cockpit should expose both:

- frontend code relevant to the capability
- backend or orchestration code relevant to the capability

Code mapping should be metadata-driven so the shell knows which files to display without hardcoded page logic.

---

## Testing Role

The cockpit is not just a viewer. It is also the integrated verification surface.

Each capability must expose test hooks that allow:

- capability smoke tests
- cockpit integration tests
- docs/capability consistency checks

---

## Non-Goals

This spec does not define:

- exact UI styling
- repo layout
- docs taxonomy
- rollout sequencing

---

## Success Criteria

This spec is successful when:

- the shell contract is thin and stable
- capability adapters can differ significantly without shell rewrites
- the cockpit can host all planned examples in one app
- testing and docs integration are first-class parts of the shell
