# Cockpit IA And Matrix Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Information architecture, capability matrix, language routing, and canonical page model for the cockpit and website docs.

---

## Goal

Define the canonical content structure for a developer-reference cockpit and docs system that mirrors LangChain's official Deep Agents and LangGraph taxonomy as closely as practical.

The resulting IA must support:

- product-first navigation
- Python-first capability coverage
- TypeScript parity where official support is strong enough
- deterministic language switching with fallback behavior
- shared routing and metadata across the cockpit and website

---

## Top-Level Structure

The top-level navigation mirrors LangChain product groupings:

- `Deep Agents`
- `LangGraph`

Each product contains two primary sections:

- `Getting Started`
- `Core Capabilities`

Each capability page is the canonical documentation and demo unit.

---

## Canonical Matrix Unit

The canonical planning and routing unit is:

- `product`
- `section`
- `topic`
- `page`
- `language`

Examples:

- `langgraph / core-capabilities / streaming / overview / python`
- `deep-agents / getting-started / overview / overview / python`

This unit is used consistently across:

- cockpit navigation
- website docs routing
- code organization
- test registration
- language switching

Where:

- `section` is one of `getting-started` or `core-capabilities`
- `topic` is either `overview` for getting-started content or a stable capability id
- `page` is a canonical subpage id

---

## Canonical Page IDs

The initial shared page ids are:

- `overview`
- `build`
- `prompts`
- `code`
- `testing`

These ids exist even if a surface renders them as tabs or sections rather than separate routes.

---

## Language Policy

Python is the canonical baseline for every capability.

TypeScript is added only when:

- official LangChain documentation exists or is strong enough to support a trustworthy reference
- the example does not require invented parity
- the team can defend the implementation as a real reference, not a speculative port

Language availability is per capability, not global.

---

## Language Switching

The docs and cockpit expose a language switcher with this behavior:

1. If an equivalent page exists in the selected language, navigate to it.
2. If no equivalent page exists, fall back to the selected product's `Getting Started / Overview` page in that language if present.
3. If the selected language has no page for that product, fall back to the canonical Python overview.

This behavior must be driven by shared metadata, not hardcoded route rules in the UI.

---

## Required Page Types

Every capability should ultimately have:

- overview
- runnable demo surface in the cockpit
- step-by-step build guide
- prompts
- code walkthrough
- testing notes
- language availability metadata

Getting Started content may aggregate multiple pages, but capability pages remain the primary unit of composition.

---

## Routing Model

The route model should be product-first and capability-first.

Representative shape:

- `/deep-agents/getting-started/overview`
- `/deep-agents/core-capabilities/subagents/python`
- `/langgraph/getting-started/overview`
- `/langgraph/core-capabilities/streaming/python`

The website and cockpit may not expose identical URL patterns internally, but both must resolve from the same logical identifiers.

---

## Matrix Registry Requirements

The registry must describe:

- stable topic id
- stable page id
- stable capability id
- product
- section
- title
- official-doc reference
- canonical language
- supported languages
- equivalent-page mappings
- fallback targets
- entry kind
- runtime class
- implementation status
- docs status
- test status

`entry kind` must distinguish:

- `docs-only`
- `capability`

`runtime class` must distinguish at minimum:

- `docs-only`
- `browser`
- `local-service`
- `secret-gated`
- `deployed-service`

This registry becomes the source of truth for navigation, page generation, and planning.

---

## Getting Started Representation

Getting Started entries are first-class registry entries, but they are `docs-only` by default.

They do not require capability runtime adapters unless a later spec explicitly promotes them into runnable cockpit surfaces.

---

## Non-Goals

This spec does not define:

- Nx project boundaries
- cockpit runtime contracts
- docs rendering internals
- CI workflow details

Those belong to later specs.

---

## Success Criteria

This spec is successful when:

- every planned demo and doc page can be placed in a single unambiguous matrix
- language switching is deterministic
- product and capability grouping stay close to LangChain docs
- later specs can consume stable capability identifiers without redefining taxonomy
