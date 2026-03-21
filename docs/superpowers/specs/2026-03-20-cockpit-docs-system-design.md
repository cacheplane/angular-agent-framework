# Cockpit Docs System Design

**Date:** 2026-03-20  
**Status:** Proposed  
**Scope:** Website docs model, shared content contracts, and how cockpit examples map to step-by-step developer-reference documentation.

---

## Goal

Define a documentation system that turns each capability into a developer-reference unit with:

- conceptual explanation
- step-by-step build guidance
- prompts
- code walkthroughs
- testing notes
- language-aware navigation

The website and cockpit must share the same underlying capability identity and metadata.

---

## Documentation Units

Each capability should eventually produce a docs bundle containing:

- overview
- getting-started context if needed
- build steps
- prompts
- code walkthrough
- testing story
- language availability

These may be rendered as separate pages or sections, but they belong to one capability bundle.

The canonical subpage ids for every bundle are:

- `overview`
- `build`
- `prompts`
- `code`
- `testing`

---

## Shared Metadata

The docs system must not infer structure from file paths alone.

It should consume shared metadata that provides:

- capability id
- topic id
- page id
- product
- language
- title
- summary
- official-doc references
- equivalent-language mappings
- fallback routes
- code file mappings
- prompt file mappings
- implementation status

The authoritative schema for this metadata is owned by `libs/cockpit-registry`.

---

## Relationship Between Website And Cockpit

The website is the narrative documentation surface.

The cockpit is the interactive reference surface.

The docs system should make them mutually reinforcing:

- website pages link into cockpit capability views
- cockpit views link back to the structured build guide and explanation
- both surfaces resolve content from shared capability metadata

---

## Content Authoring Model

Docs content should be authored in a structured way that supports generation and embedding.

Expected authoring concerns:

- explanatory prose
- prompts
- ordered build steps
- code references
- testing references

The system should support gradual generation later, but the initial design assumes curated authored content.

Authored docs should live in the website content system, not in capability module directories. Capability modules may reference docs content, but they do not own it.

---

## Language Switching Behavior

The docs system inherits the matrix behavior:

- navigate to equivalent page when available
- otherwise fall back to product `Getting Started / Overview`

This must behave the same in the website and cockpit.

---

## Embed Model

The website should be able to embed cockpit-aware references without duplicating logic.

Examples:

- “open in cockpit”
- “view Python implementation”
- “switch to TypeScript”
- “see prompts”

These should resolve from metadata, not custom code per page.

---

## Testing Story In Docs

Each capability docs bundle must surface the testing story explicitly.

At minimum:

- smoke expectations
- integration expectations
- local verification command references

This aligns docs with the examples harness instead of treating testing as an afterthought.

---

## Non-Goals

This spec does not define:

- cockpit shell UI internals
- Nx project boundaries
- CI workflows

---

## Success Criteria

This spec is successful when:

- every capability can be documented with a predictable bundle shape
- website and cockpit remain linked through shared metadata
- language availability and fallback behavior are consistent
- testing guidance is part of the standard documentation contract
