# Docs Voice Pass — LangGraph Getting Started — Design

**Date:** 2026-06-05
**Status:** Draft for review
**Scope:** A surgical voice pass over the three LangGraph getting-started pages, applying Brian's writing patterns (technical register) without changing any technical content. First batch of a multi-library getting-started voice pass.

## Goal

Bring the LangGraph onboarding pages fully into Brian's voice (technical
register) — the same rubric used for the a2ui pages — while leaving every
technical claim, code sample, command, and anchor intact. These pages are
already decent, so this is a **tightening pass**, not a rewrite.

This is the first batch of the broader "voice pass over existing docs." Breadth
for the whole effort: **intros + getting-started pages only** (skip guides,
concepts, and API/reference). Each library is its own spec → plan cycle;
LangGraph is first.

## Pages (3)

- `apps/website/content/docs/langgraph/getting-started/introduction.mdx`
- `apps/website/content/docs/langgraph/getting-started/quickstart.mdx`
- `apps/website/content/docs/langgraph/getting-started/installation.mdx`

## Voice rubric (technical register)

Apply where it genuinely improves the page — surgical, not wholesale:

- Title restated as a one-line lede (most pages already do this — keep it).
- Contractions natural ("it's", "you'll", "don't", "let's").
- One thought per line; short paragraphs.
- Quickstart (tutorial): "Let's" transitions opening major steps where natural,
  and a brief closing **next-steps / `## Conclusion`** if missing.
- Opinions flagged ("For me", "In my experience") and paired with a tradeoff —
  only where the page actually makes a recommendation; don't manufacture
  opinions.
- Trim corporate stiffness and filler; prefer the concrete verb.

**Excluded:** no emojis, no anecdotes, no hype ("blazing", "game-changing",
"powerful", "seamless", "effortless"), no lecturing ("obviously").

## Hard guardrails (the risk in a voice pass)

1. **Never change a technical claim, code snippet, shell command, API name,
   type, version string, or link/href.** Voice = prose phrasing/structure only.
2. **Preserve heading text.** `rehype-slug` derives `#anchors` from heading
   text; the on-page TOC and any deep links depend on them. Tighten body copy,
   not section titles. (Decided default: keep headings stable. Rename a heading
   only with explicit sign-off.)
3. Preserve all MDX components (`Callout`, `Steps`/`Step`, etc.), their props,
   frontmatter conventions (these pages have none — title is the `# H1`), and
   cross-links.
4. **YAGNI:** if a passage is already in-voice, leave it. Surgical edits beat
   churn. The `# H1` titles ("Introduction", "Quick Start", "Installation")
   stay — they map to nav/breadcrumb/anchors.

## Per-page approach

- **introduction.mdx** — already strong (title-as-lede, "What you'll learn"
  callout, `## What is injectAgent()?` H2-as-question). Light touch: tighten any
  long sentences, ensure contractions, confirm the adapter-picker note reads
  naturally. Keep all headings + code.
- **quickstart.mdx** — tutorial register. Add "Let's" framing to step lead-ins
  where natural; ensure a short next-steps close exists (link onward to the
  guides/concepts). Keep the `<Steps>`/`<Step>` structure, every command, and
  the provider/config code verbatim.
- **installation.mdx** — reference-ish but onboarding. Tighten the requirement
  blurbs; keep the `<Steps>` structure, version requirements, and commands
  exactly.

## Testing & verification

- **Accuracy diff gate (required):** for each page, the git diff must show
  **prose-only** changes — no edits inside fenced code blocks, no changed
  commands/API names/versions/links, no changed heading text or MDX component
  props. A reviewer verifies the diff line-by-line.
- **Render:** each page returns HTTP 200 on the dev server and renders
  unchanged structurally (same headings/anchors, same code blocks, same
  callouts/steps).
- **Voice review:** each page checked against the rubric above.
- **Links/anchors:** confirm no in-page anchor changed (headings preserved) and
  cross-links still resolve.

## Out of scope

- LangGraph guides, concepts, and API/reference pages (later, if at all — this
  effort is getting-started only).
- Other libraries' getting-started (chat, render, ag-ui, a2ui[already in-voice],
  licensing, telemetry) — each its own later batch.
- Any structural/navigation/component change; any technical correction (if a
  real technical error is spotted, flag it separately — don't fold a content fix
  into a voice edit).
