# Cockpit Matrix Rollout Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Full capability rollout strategy across Deep Agents and LangGraph, including language policy and completeness tracking.

---

## Goal

Define how the full capability matrix will be instantiated across:

- Deep Agents
- LangGraph
- Python
- TypeScript where officially supportable
- docs
- cockpit modules
- tests

This spec covers completeness and tracking, not repo architecture.

---

## Rollout Principle

The matrix must be complete at the taxonomy level even if implementation maturity differs across cells.

That means:

- every official capability we choose to mirror gets a place in the matrix
- Python gets a canonical implementation path everywhere
- TypeScript is explicitly present or explicitly unavailable
- docs and cockpit status are tracked separately

---

## Capability Status Model

Each registry entry should track both dimensions and lifecycle.

Dimensions:

- `implementation status`
- `docs status`
- `test status`
- `deployment status`

Lifecycle values:

- `planned`
- `implemented`
- `docs-authored`
- `cockpit-integrated`
- `smoke-tested`
- `integration-tested`
- `deployed`

This prevents drift between a dimensional registry view and a lifecycle-only rollout view.

---

## Deep Agents Rollout

The Deep Agents matrix should stay close to official concepts such as:

- getting started / overview
- planning and task management
- context management and filesystem-oriented workflows
- subagents
- memory
- skills
- sandboxes and backend/runtime concerns

The planning phase may refine naming, but the initial inventory below is the approved starting set.

---

## LangGraph Rollout

The LangGraph matrix should stay close to official concepts such as:

- getting started / overview
- persistence
- durable execution
- streaming
- interrupts / human-in-the-loop
- memory
- subgraphs
- time travel
- runtime and deployment-oriented capabilities

The planning phase may refine naming, but the initial inventory below is the approved starting set.

---

## Initial Approved Inventory

The initial planning inventory for the first full matrix is:

Deep Agents:

- `getting-started / overview`
- `core-capabilities / planning`
- `core-capabilities / filesystem`
- `core-capabilities / subagents`
- `core-capabilities / memory`
- `core-capabilities / skills`
- `core-capabilities / sandboxes`

LangGraph:

- `getting-started / overview`
- `core-capabilities / persistence`
- `core-capabilities / durable-execution`
- `core-capabilities / streaming`
- `core-capabilities / interrupts`
- `core-capabilities / memory`
- `core-capabilities / subgraphs`
- `core-capabilities / time-travel`
- `core-capabilities / deployment-runtime`

This inventory is the approved starting manifest for planning. Later planning may refine names or split or merge items only when justified by the current official docs.

---

## Language Rollout Policy

Python:

- always canonical
- always required

TypeScript:

- optional per capability
- added only when support and docs are trustworthy
- explicitly mapped to fallback routes when absent

---

## Completeness Definition

The matrix is not “done” when code exists.

A capability is complete only when all required assets exist:

- cockpit module
- metadata
- docs bundle
- prompts
- code mapping
- smoke tests
- appropriate integration tests

---

## Delivery Discipline

The rollout should prevent silent gaps.

Therefore the matrix registry must be able to answer:

- which capabilities exist
- which languages exist
- which docs pages exist
- which tests exist
- what the fallback behavior is

---

## Non-Goals

This spec does not define:

- shell contracts
- repo layout
- exact CI jobs

---

## Success Criteria

This spec is successful when:

- the full matrix can be tracked without ambiguity
- Python-first and TypeScript-conditional policy is explicit
- completeness is defined as code plus docs plus tests plus cockpit integration
