# Docs Voice Pass — Getting Started, Batch 2 — Design

**Date:** 2026-06-05
**Status:** Draft for review
**Scope:** Apply the established getting-started voice rubric to the remaining libraries — chat, render, ag-ui, licensing, telemetry. Same surgical, prose-only approach proven on LangGraph (#583). a2ui is already in-voice and excluded.

## Goal

Finish the getting-started voice pass across the remaining libraries so the
whole onboarding surface reads in Brian's technical register — without changing
any technical content. This reuses the rubric and guardrails approved in the
LangGraph batch; it's the same design applied to more files.

## Pages (11)

- `chat/getting-started/`: `introduction.mdx`, `quickstart.mdx`, `installation.mdx`
  (skip `changelog.mdx` — it's a generated/list page, not prose voice).
- `render/getting-started/`: `introduction.mdx`, `quickstart.mdx`, `installation.mdx`.
- `ag-ui/getting-started/`: `introduction.mdx`, `quickstart.mdx`, `installation.mdx`.
- `licensing/getting-started/`: `introduction.mdx`.
- `telemetry/getting-started/`: `introduction.mdx`.

## Voice rubric (technical register — unchanged from the LangGraph batch)

Apply surgically; don't churn prose that's already in-voice.

- Title-as-lede (keep existing). Contractions ("it's", "you'll", "let's"). One
  thought per line; short paragraphs.
- Quickstart pages (tutorial): "Let's" lead-ins where a step intro reads flatly;
  ensure a short next-steps close exists (reuse links already present in the
  docs; verify routes in `docs-config.ts` — don't invent).
- Flag opinions ("For me", "In my experience") + a tradeoff only where the page
  already recommends something. Don't invent opinions.
- Trim corporate stiffness/filler; concrete verbs.
- **Excluded:** no emojis, no anecdotes, no hype ("blazing", "game-changing",
  "powerful", "seamless", "effortless"), no lecturing ("obviously").

## Hard guardrails (non-negotiable — same as LangGraph batch)

1. Never change anything inside a fenced ``` code block, nor any inline `code`,
   command, API name, type, version, or link/href.
2. Never change heading text (`#`/`##`/`###`) — `rehype-slug` anchors + the TOC
   depend on it. The `# H1` titles stay (they map to nav/breadcrumb/anchors).
3. Preserve all MDX components (`Callout`, `Steps`/`Step`, `Tabs`/`Tab`,
   `CodeGroup`, `Card`/`CardGroup`) and their props.
4. YAGNI — leave already-in-voice passages alone.
5. No technical corrections folded in. If a real technical error appears, leave
   it and report it for a separate follow-up.

## Per-page gate (required, per library)

- **Accuracy diff gate:** every `+`/`-` is prose. The heading/code-fence guard
  (`git diff … | grep -E "^[+-]\s*(#{1,6} |\`\`\`)"`) prints nothing changed for
  each file; no command/API/version/link line changed.
- **Render:** each edited page returns HTTP 200; headings/anchors identical to
  `main`.
- **Voice review:** each page reads in the technical register.

## Implementation shape

One PR. Per-library implementer tasks (chat; render; ag-ui; licensing+telemetry
together — both single intros), each followed by the accuracy-diff + voice
review before the next. Group commits per library for a clean history.

## Testing & verification

- The repo-wide heading/fence guard across all 11 edited files shows prose-only.
- All 11 routes return 200; an `anchors-identical-to-main` check passes for each.
- No e2e change needed (routes already exist; docs e2e covers rendering).

## Out of scope

- Guides, concepts, API/reference pages for any library (getting-started only).
- `chat/getting-started/changelog.mdx` (generated/list).
- a2ui (already in-voice).
- Any technical correction (e.g. the separately-flagged `assistantId` mismatch).
