# "json-render vs A2UI: Choosing a Generative UI Contract" Blog Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an opinionated decision essay for the `json render vs a2ui` query cluster (highest-intent traffic on the site, already ranking #3) that answers "which should I pick," complementing the mechanical docs comparison.

**Architecture:** One new MDX file in `apps/website/content/blog/`. No code changes. Decision essay with exactly one paired snippet; links the docs comparison page for all mechanics.

**Tech Stack:** MDX blog content, Next.js website (`apps/website`), vitest for content validation.

**Spec:** `docs/superpowers/specs/2026-08-26-json-render-vs-a2ui-post-design.md`
**Branch:** `blove/json-render-vs-a2ui-post` (off main at `9064d456`)

---

## Verified facts (source of truth)

- **json-render `Spec`** (`@json-render/core`, `dist/store-utils-*.d.ts:380`): `{ root: string; elements: Record<string, UIElement>; state?: Record<string, unknown> }`. `UIElement`: `{ type: string; props: P; children?: string[]; visible?; on?; repeat? }`. Docs describe it as a "flat UI tree structure (optimized for LLM generation)".
- **A2UI envelopes** (`libs/a2ui/src/lib/parser.ts:4`): recognized keys `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`; JSONL example from source: `{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"basic"}}`. Official vendored JSON schemas live in `libs/a2ui` — verify any envelope fields the post shows against them (memory: verify props against official schemas; surface owns liveStore).
- **Shared catalog claim:** chat's `[views]` input feeds both paths — json-render via `ViewRegistry`→`AngularRegistry` conversion, A2UI via the same catalog shape (`apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx` "Registries And Catalogs"; chat-side code in `libs/chat/src/lib/a2ui/views.ts` and `surface.component.ts`). The docs page states: "The same `views` input is used by both paths."
- **Chat detection** (docs page "Chat Detection"): text → markdown; leading `{` → json-render; leading `---a2ui_JSON---` → A2UI JSONL.
- **Positioning lines available to reuse (docs page):** "the tradeoff is not 'which renderer is better.' The tradeoff is contract shape"; "the registry is the allowlist"; "Use markdown when the best UI is text."
- **A2UI origin:** Google's agent-to-UI protocol; we implement the v0.9/v0.9.1 line with vendored official schemas. Don't speculate beyond what we implement.

---

### Task 1: Author the post

**Files:**
- Create: `apps/website/content/blog/2026-08-26-json-render-vs-a2ui-choosing.mdx`

Slug derives from filename minus date → `/blog/json-render-vs-a2ui-choosing`.

- [ ] **Step 1: Create the file with this exact frontmatter**

```yaml
---
title: 'json-render vs A2UI: Choosing a Generative UI Contract'
description: 'A fixed spec is easier to validate; A2UI updates over time and sends actions back. Which contract shape fits your surface.'
date: 2026-08-26
tags: [generative-ui, a2ui, json-render, angular, agentic-ui]
author: brian
featured: false
draft: false
---
```

Description is 120 chars (≤155). **No licensing callout** — dropped per Brian's direction.

- [ ] **Step 2: Write the body**

1. **Lede** (no header): one sentence restating the decision. Then the two-line ladder framing (markdown when text is the best UI → a fixed spec when you can validate up front → a live protocol when the surface keeps changing). Link the docs comparison page (`/docs/render/concepts/json-render-vs-a2ui`) early, labeled as the mechanical comparison; this post is the decision.
2. **`## What's actually different?`** — answer in the first line: contract shape, not renderer quality. Ownership framing: json-render is an application-owned contract (you define the schema, validate before mount, own event semantics); A2UI is an agent-owned surface (the agent creates it, updates it over time, and receives structured actions back). Then the ONE paired snippet — verify both halves before committing:

   json-render (one fixed spec):
   ```json
   {
     "root": "card",
     "elements": {
       "card": { "type": "Card", "props": { "title": "Order #1042" }, "children": ["total"] },
       "total": { "type": "Text", "props": { "text": "$118.00" } }
     }
   }
   ```

   A2UI (a stream of envelopes, JSONL):
   ```json
   {"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"basic"}}
   {"version":"v0.9","updateComponents":{"surfaceId":"s1","components":[...]}}
   {"version":"v0.9","updateDataModel":{"surfaceId":"s1","...":"..."}}
   ```

   **Verification required:** the `updateComponents`/`updateDataModel` field shapes above are PLACEHOLDERS — before writing, read the vendored official schemas in `libs/a2ui` (and `libs/a2ui/src/lib/parser.ts` + types) and write real, schema-valid minimal envelopes; ellipses are not acceptable in the published post. The json-render half must match `Spec`/`UIElement` from the verified facts (it does; keep prop names if `Card`/`Text` exist in the basic catalog — check `a2uiBasicCatalog`/render examples and substitute real component names if not). One sentence after the snippet lands the point: one is a document you can validate; the other is a conversation you subscribe to.
3. **`## When does the fixed spec win?`** — answer first line, then the scenarios walked to verdicts: a structured result card (agent answers once, UI renders once) and a dashboard/results panel outside chat. The reasons: validate-before-mount, application-owned handlers, custom components with explicit inputs. Include the allowlist point (registry decides what can render) in one line, crediting it as the security posture both share.
4. **`## When does the protocol win?`** — answer first line, then: a live itinerary that updates mid-conversation (structure arrives, data fills in later, agent keeps editing), and a form whose submission returns to the agent as a structured action (with the data model attached when `sendDataModel` is set). The reasons: incremental surfaces, data separate from structure, actions as protocol messages. The cost, stated honestly: protocol discipline — valid envelopes, right order, catalog support, action semantics.
5. **`## What does it cost to switch?`** — answer first line: less than you'd think inside chat. The same `[views]` catalog feeds both paths, and chat detects which contract is streaming (leading `{` vs `---a2ui_JSON---`), so the choice is per-surface, not per-app, and revisable. Flag the default as opinion: start with json-render and step up to A2UI when a surface genuinely needs to live past its first render ("For me…" / "I think…").
6. **`## Conclusion`** — one short paragraph: the one-rule heuristic (if you can validate the whole UI before showing it, start with json-render; if it's a live conversation artifact with partial data, actions, and updates, use A2UI). Forward links: the docs comparison page, `/docs/chat/guides/generative-ui`, `/docs/chat/a2ui/overview`. Closing line is an invitation or forward link, no CTA.

- [ ] **Step 3: Voice pass**

Same gate as post #11 — `docs/gtm/voice.md` with the 2026 technical override: title-restating lede, no "Introduction" header, contractions, 1–3-line paragraphs, H2-as-question answered in the first line, ≥1 "Let's" per major section, opinions flagged, no anecdotes/emoji/hype/CTAs. Additional: don't copy docs-page sentences verbatim except the deliberately reused positioning line ("the tradeoff is contract shape") — paraphrase everything else.

- [ ] **Step 4: Accuracy pass**

- Every mechanism claim checked against the docs page and, where behavioral, source (`libs/chat/src/lib/a2ui/*`, `libs/render/src/lib/*`, `libs/a2ui/src/lib/parser.ts`).
- Published-release check: `npm pack @threadplane/chat@latest @threadplane/render@latest @threadplane/a2ui@latest` into the scratchpad; confirm any named public member (e.g. `a2uiBasicCatalog`, `views`, `sendDataModel` on the surface types) exists in the published `.d.ts`. Drop main-only members.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/blog/2026-08-26-json-render-vs-a2ui-choosing.mdx
git commit -m "feat(website): add 'json-render vs A2UI' blog post"
```

---

### Task 2: Validate

- [ ] **Step 1: Frontmatter + description length**

```bash
cd apps/website && node -e "
const matter = require('gray-matter');
const fs = require('fs');
const f = matter(fs.readFileSync('content/blog/2026-08-26-json-render-vs-a2ui-choosing.mdx','utf8'));
console.log('desc length:', f.data.description.length);
if (f.data.description.length > 155) throw new Error('description too long');
if (!f.data.title || !f.data.date || f.data.author !== 'brian') throw new Error('frontmatter incomplete');
console.log('OK');
"
```

Expected: length ≤155, `OK`.

- [ ] **Step 2: Website test suite** (`nx test website` does not exist):

```bash
cd apps/website && npx vitest run --config vite.config.mts
```

Expected: `src/lib/blog.spec.ts` and `src/lib/sitemap-dates.spec.ts` pass. Known pre-existing failures (do NOT fix, just confirm unchanged): `PostCard.spec.tsx` (1), `Differentiator.spec.tsx` (1), `thanks/page.spec.tsx` (3).

- [ ] **Step 3: Render check** — `npx next dev` on port 3111 from `apps/website` (background), then curl:
  - `/blog/json-render-vs-a2ui-choosing` → 200, contains the post `<title>`, both code blocks render as `<pre data-language="json"`, meta description matches frontmatter
  - `/blog` lists the post
  Kill the server, verify port free, revert any `next-env.d.ts` side-effect edit.

- [ ] **Step 4: Commit fixes** (skip if none):

```bash
git add -A apps/website/content/blog/ && git commit -m "fix(website): render fixes for json-render vs A2UI post"
```

---

### Task 3: PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(website): add 'json-render vs A2UI' blog post" --body "Second post of the GSC-driven blog sequence (spec: docs/superpowers/specs/2026-08-26-json-render-vs-a2ui-post-design.md).

Targets the \`json render vs a2ui\` comparison cluster — the highest-intent traffic on the site (already #3, 25% CTR on one phrasing) — with the decision-intent post; links to (does not replace) the docs comparison page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Merge on green + verify**

Per Brian's standing instruction for this sequence: arm auto-merge (`gh pr merge <n> --squash --auto`) once the PR is open; only `Vercel – threadplane` gates. After merge, verify the post exists on `origin/main` and report the production URL (`https://threadplane.ai/blog/json-render-vs-a2ui-choosing`) once the main deploy completes. The Vercel preview URL is SSO-protected — verify locally + via build success, hand Brian the URL.
