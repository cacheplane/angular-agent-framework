# Agent-First Developer Docs Design

**Date:** 2026-03-21  
**Status:** Proposed  
**Scope:** End-to-end documentation content system for StreamResource, cockpit examples, Deep Agents, and LangGraph, optimized for software developers using agents.

---

## Goal

Create best-in-class developer documentation that is optimized for software developers working with agents.

The docs must:

- cover the full product coherently end to end
- be generated first from code and examples as the source of truth
- materialize into editable Markdown
- remain long-lived and contributor-friendly
- provide excellent first-pass architecture and walkthrough explanations
- support both frontend and backend code explanation through the UI
- report stale docs without gating updates

---

## Core Principle

Code and examples are the absolute source of truth.

Documentation is generated from:

- code
- example manifests
- prompts
- tests
- commands
- runtime metadata

The generated Markdown becomes the long-lived maintained artifact after the initial generation pass.

Generator-owned metadata blocks and sections must be explicitly marked in the Markdown output so later tooling can compare source-of-truth expectations without blindly overwriting contributor edits.

---

## Intended Reader

The primary reader is:

- a software developer using one or more agents to implement, modify, or verify a feature

The docs should therefore optimize for:

- exact goals
- architecture clarity
- file-level orientation
- copy-pasteable commands
- verification steps
- common failure modes
- prompts and implementation briefs
- frontend and backend visibility

---

## Research Direction

The system should learn from platforms such as:

- MkDocs Material
- Mintlify
- Docusaurus
- Fern

But the recommended direction is a custom Next.js-based system integrated with the existing website and cockpit, because:

- the source of truth is custom code/example metadata, not only Markdown
- the cockpit and website must share metadata and navigation
- frontend and backend code views are first-class
- agent-first generated explanations and verification flows are required

---

## Documentation Model

The first version uses a **fully generated seed** model:

1. Extract from code/examples/tests/prompts/manifests
2. Synthesize strong first-pass docs
3. Write Markdown into the docs tree
4. Keep Markdown editable over time
5. Use drift reporting to suggest updates later

This is intentionally not a continuously regenerated docs system.

---

## Source Buckets

Each generated page should draw from five source buckets:

1. Manifest data
- product
- topic
- page id
- language
- maturity
- routing
- fallback behavior

2. Example/module artifacts
- source files
- prompts
- configs
- commands
- runtime class

3. Tests and verification
- smoke targets
- integration targets
- expected outputs
- failure boundaries

4. Code structure
- frontend files
- backend files
- entrypoints
- dependency relationships

5. Narrative synthesis
- generated explanations of:
  - what the example does
  - why it exists
  - how it is structured
  - how to build it
  - how to verify it

For the initial pass, narrative synthesis is allowed to come from:

- structured heuristics derived from manifests, prompts, tests, commands, and code maps
- generator-authored explanatory text based on those inputs

The generated narrative is intended to be strong enough for the first baseline, but it is expected that contributors will improve the Markdown afterward.

---

## Page Model

The standard generated page shape should be:

1. Overview
2. Why this example exists
3. Architecture
4. File map
5. Build steps
6. Prompts
7. Frontend code
8. Backend code
9. Verification
10. Common failure modes
11. Related examples

This page model should apply across:

- StreamResource library docs
- cockpit capability docs
- Deep Agents docs
- LangGraph docs

Not every page needs every section rendered identically, but the model should be consistent enough for agents to rely on it.

---

## Content Scope

This docs program covers all documentation content, not just the new cockpit pages:

- StreamResource library docs
- website docs
- cockpit-linked capability docs
- Deep Agents docs
- LangGraph docs

The docs experience should become coherent end to end.

The first generation pass should prioritize areas that already have useful structured source artifacts:

- cockpit capability docs
- Deep Agents and LangGraph capability docs
- StreamResource library docs where code/examples/prompts/tests already provide enough source material

Areas with weaker source metadata may receive thinner generated pages in v1, but they still need to fit the same page model.

---

## Markdown Output

All generated docs should be written to Markdown so contributors can maintain them over time.

Markdown is the long-lived editable artifact.

The system should preserve:

- stable frontmatter or metadata blocks
- structured references back to source-of-truth artifacts
- enough generated structure that later edits do not require a full rewrite

For the initial system, generated Markdown lives in the same docs tree the website reads. Generator-owned sections must be clearly delimited so drift reporting can stay advisory and ordinary maintenance does not require full regeneration.

---

## Drift Reporting

Post-generation drift handling is advisory only.

The system should:

- detect stale docs relative to code/example metadata where practical
- emit warnings
- suggest a prompt or update brief for the contributor/agent

The system should not:

- fail CI solely because docs diverged after generation
- force a full regeneration pass for ordinary doc maintenance

---

## UX Expectations

The docs experience should be excellent for agent-assisted development:

- architecture explanations should be strong enough to orient an agent quickly
- build steps should be explicit
- verification should be concrete
- frontend and backend code should be surfaced clearly
- prompts should be available and copyable
- related examples should help navigation through the matrix

---

## Non-Goals

This spec does not define:

- exact cockpit implementation details
- exact website UI styling
- final CI workflow wiring
- TypeScript parity rollout policy beyond existing approved cockpit policies

---

## Success Criteria

This spec is successful when:

- docs can be generated once into strong Markdown from source-of-truth artifacts
- the generated output is good enough to serve as the initial high-quality docs baseline
- contributors can iterate on Markdown directly afterward
- stale docs are reported without becoming a hard gate
- the docs are genuinely useful for software developers using agents
