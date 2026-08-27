# Post #9 design: "json-render vs A2UI: Choosing a Generative UI Contract"

**Date:** 2026-08-26
**Status:** Approved (angle A approved in session; second post of the four-post sequence in `docs/superpowers/specs/2026-08-26-blog-sequence-inject-agent-design.md`)

## Intent and evidence

Comparison queries where we already rank: `json render vs a2ui` (16 impressions, position 3.2), `a2ui vs json-render` (14, 11.4), `json-render vs a2ui` (8, 3.5, 25% CTR). The searcher has a decision to make — the highest-intent traffic on the site. Today it lands on the docs page `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx`, a neutral mechanical comparison.

**The post's job:** answer "which one should I pick," not "how do the two differ." Opinionated decision essay; links the docs page for every mechanism it names; must not duplicate its mechanics.

**Slug:** `json-render-vs-a2ui-choosing`
**File:** `apps/website/content/blog/2026-08-26-json-render-vs-a2ui-choosing.mdx`
**Meta description (≤155 chars):** "A fixed spec is easier to validate; A2UI updates over time and sends actions back. Which contract shape fits your surface."
**No licensing callout** (per Brian's direction on post #11 — dropped as unnecessary).

## Angle

Decision essay built on the docs page's central line — *the tradeoff is contract shape, not which renderer is better* — expanded into judgment the neutral reference can't carry:

- Who owns the UI: the application (fixed spec, validate-before-mount) vs. the agent (live surface, protocol discipline).
- Concrete scenarios walked to a verdict: structured result card → json-render; live itinerary updating mid-conversation → A2UI; form whose submission returns to the agent as a structured action → A2UI; dashboard outside chat → json-render.
- The "ladder" (markdown → fixed spec → live protocol) appears only as a two-line framing device in the intro.
- Exactly ONE paired snippet: a ~5-line json-render spec next to a ~5-line A2UI envelope, to make "contract shape" visible. No other code. Not a tutorial.
- Switching-cost section lowers the stakes: in `@threadplane/chat`, both paths render through the same `views` catalog, so the choice is not a one-way door.

Rejected angles: same-surface-built-both-ways (code-heavy, re-treads docs mechanics) and a full three-rung-ladder frame (dilutes the head-to-head the queries ask for).

## Structure

1. **Lede** (no header): restate the decision; two-line ladder framing; link the docs page (`/docs/render/concepts/json-render-vs-a2ui`) as "the mechanical comparison" early.
2. `## What's actually different?` — contract shape, ownership framing, the single paired snippet.
3. `## When does the fixed spec win?` — validate-before-mount, application-owned event semantics, the card/dashboard scenarios.
4. `## When does the protocol win?` — incremental surfaces, data arriving apart from structure, structured actions back; the itinerary/form scenarios.
5. `## What does it cost to switch?` — shared `views` catalog in chat; choice is revisable; opinionated default flagged as opinion.
6. `## Conclusion` — the one-rule heuristic (if you can validate the whole UI before showing it, start with json-render; live conversation artifact → A2UI), forward links: docs comparison page, `/docs/chat/guides/generative-ui`, `/docs/chat/a2ui/overview`.

## Voice and register

Same as post #11: `docs/gtm/voice.md` with the 2026 technical override — H2-as-question, contractions, 1–3-line paragraphs, "Let's" transitions, opinions flagged ("For me," "I think"), no anecdotes, no emoji, no hype, no CTAs.

## Accuracy requirements (drafting gate)

- Every mechanism claim verified against the docs page AND source (`libs/render`, `libs/a2ui`, `libs/chat`): the paired snippet must be a valid minimal spec / valid v0.9 envelope per the vendored official A2UI schemas; the shared-`views`-catalog claim verified in `libs/chat` source.
- Verify named members against published 0.0.58 tarballs (main may be ahead of npm).
- Frontmatter conventions per existing posts; tags along the lines of [generative-ui, a2ui, json-render, angular, agentic-ui].
- A2UI is Google's protocol; if the post names its origin, match how the docs/repo describe it — no speculation about the spec beyond what we implement (v0.9/v0.9.1 line).

## Out of scope

- Docs page changes; posts #1 and #12 (own passes later).
