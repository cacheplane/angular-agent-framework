# Docs Voice Pass — Beyond Getting-Started — Design

**Date:** 2026-06-07
**Status:** Draft for review
**Scope:** Apply Brian's technical-register voice pass to the remaining docs prose — guides, concepts, reference, components, and api `.mdx` pages across all 7 libraries (~78 pages, ~14,800 lines). Getting-started was already voice-passed (#583, #585). Ships as one per-lib PR each (7 PRs). Same surgical, prose-only approach proven on the getting-started batches.

## Goal

Finish the voice pass so the whole docs prose surface reads in Brian's technical
register — without changing any technical content. This reuses the rubric and
guardrails approved + proven in the getting-started passes; it's the same design
applied to the rest of the docs.

## Surface (~78 pages, all `.mdx` beyond getting-started)

Per lib (guides / concepts / reference / components / api `.mdx`; excludes
`getting-started/*` [done] and generated `api/api-docs.json` [JSON, not prose]):

| Lib | Pages |
|---|---|
| langgraph | 18 (guides 9, concepts 5, api 4) |
| chat | 30 (guides 9, concepts 2, components 14, api 5) |
| render | 11 (guides 5, concepts 1, a2ui 4 [chat-owned, already reviewed], api 5 — voice only) |
| ag-ui | 7 (guides 5, concepts 1, reference 1) |
| a2ui | 5 (guides 3, reference 2) |
| telemetry | 4 (guides 3, reference 1) |
| licensing | 3 (guides 2, reference 1) |

## Voice rubric (technical register — unchanged from the getting-started passes)

Apply surgically; don't churn prose that's already in-voice.

- Title-as-lede (keep existing H1). Contractions ("it's", "you'll", "let's").
  One thought per line; short paragraphs.
- Guides (tutorial/how-to): "Let's" lead-ins where a step intro reads flatly;
  ensure a short next-steps close exists where natural (reuse links already
  present; verify routes in `docs-config.ts` — don't invent).
- Flag opinions ("For me", "In my experience") + a tradeoff only where the page
  already recommends something. Don't invent opinions.
- Trim corporate stiffness/filler; concrete verbs.
- **Excluded:** no emojis, no anecdotes, no hype ("blazing", "game-changing",
  "powerful", "seamless", "effortless"), no lecturing ("obviously").

## Hard guardrails (non-negotiable — same as the getting-started passes)

1. Never change anything inside a fenced ``` code block, nor any inline `code`,
   command, API name, type, version, or link/href.
2. Never change heading text (`#`/`##`/`###`) — `rehype-slug` anchors + the TOC
   depend on it. H1 titles stay (they map to nav/breadcrumb/anchors).
3. Preserve all MDX components (`Callout`, `Steps`/`Step`, `Tabs`/`Tab`,
   `CodeGroup`, `Card`/`CardGroup`) and their props — including every
   `<Step title="...">`. Use only supported `Callout` types (`tip`/`info`/`warning`/`danger`).
4. YAGNI — leave already-in-voice passages alone.
5. No technical corrections folded in. If a real technical error appears, leave
   it and report it for a separate follow-up. (The technical review program just
   completed; these pages are accuracy-fixed.)

## Special handling — reference / api / component pages (YAGNI HARD)

`reference/*`, `api/*`, and `chat/components/*` pages are table/signature/-
reference-heavy with thin narrative. Voice ONLY genuine prose (the page intro,
explanatory paragraphs between code/tables). **Never** touch:
- input/output/parameter/event tables or their rows,
- signatures, code fences, inline API tokens,
- component selectors/props, `<Step title>`.

Many of these pages will change little or nothing. That is expected and correct —
a near-empty diff on a reference page is a success, not a gap.

## Implementation shape — 7 per-lib PRs

One PR per lib. Within a PR, implementer work is grouped by section (e.g.
langgraph: guides / concepts / api) so no single agent edits too much at once.
Each section group is gated by:

1. **Prose-only diff guard:** `git diff … | grep -E "^[+-]\s*(#{1,6} |\`\`\`|.*<Step )"`
   prints nothing changed for each edited file; no command/API/version/link/heading/
   `<Step>` line changed.
2. **Voice review:** an independent subagent confirms each page reads in the
   technical register (no emojis/hype/anecdotes/lecturing) and the guardrails held.
3. **Render check:** each edited page returns HTTP 200; headings identical to `main`.

Each PR branch is cut from up-to-date `origin/main` (the stale-source guard from
the ag-ui/licensing reviews), pushed, auto-merged on green, and monitored.

## Order

Biggest / highest-traffic first: **langgraph → chat → render → ag-ui → a2ui →
telemetry → licensing.** Per-lib PRs merge independently; clean libs/pages just
produce small diffs.

## Testing & verification

- Per edited page: the heading/fence/`<Step>` guard prints "none changed";
  headings byte-identical to `main` (rehype-slug anchors + TOC preserved); HTTP 200.
- Voice review per section group confirms register.
- No e2e change needed (routes already exist; docs e2e covers rendering).

## Out of scope

- `getting-started/*` (already voice-passed).
- Generated `api/api-docs.json` (JSON, not prose).
- Any code/heading/anchor/link/MDX-prop/table change (the guardrails).
- Technical corrections (the accuracy program is done; flag any new error separately).
- The `chat/a2ui/*` content already covered — voice only, no structural change.

## Self-review notes

- **Placeholder scan:** none — the rubric, guardrails, and per-lib page counts are concrete.
- **Internal consistency:** the per-lib PR structure matches the implementation shape + order; the YAGNI-hard reference handling is stated in its own section and echoed in out-of-scope; guardrails match the proven getting-started passes.
- **Scope:** large but decomposed into 7 independent per-lib PRs; each is a working, reviewable unit. Brainstormed once; executed lib-by-lib.
- **Ambiguity:** "everything" = all prose `.mdx` beyond getting-started, but reference/api/component pages get YAGNI-hard treatment (prose-only, often near-empty diffs).
