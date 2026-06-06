# Docs Voice Pass — LangGraph Getting Started — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surgically voice-edit the three LangGraph getting-started MDX pages into Brian's technical register — prose only, with code, commands, headings/anchors, and links left byte-identical.

**Architecture:** Edit three MDX files in place. The control that keeps this safe is the **diff gate**: every change must be prose; nothing inside fenced code blocks, no command/API/version/link/heading text may change.

**Tech Stack:** MDX docs (Next.js), `git diff` as the accuracy gate, Playwright/dev-server for render check.

**Reference spec:** `docs/superpowers/specs/2026-06-05-docs-voice-langgraph-gs-design.md`
**Voice rubric:** `docs/gtm/voice.md` (technical register).

---

## Voice rubric (apply surgically — don't churn in-voice prose)
- Title-as-lede (keep existing); contractions ("it's", "you'll", "let's"); one thought per line; short paragraphs.
- Quickstart: "Let's" lead-ins on steps where natural; a brief next-steps close if missing.
- Flag opinions ("For me", "In my experience") + a tradeoff — only where the page already recommends something. Don't invent opinions.
- Trim corporate stiffness/filler; concrete verbs.
- NO emojis, anecdotes, hype ("blazing", "game-changing", "powerful", "seamless"), or lecturing ("obviously").

## Hard guardrails (NON-NEGOTIABLE)
1. Never change anything inside a fenced ``` code block, nor any inline `code`, command, API name, type, version, or link/href.
2. Never change heading text (`#`/`##`/`###`) — `rehype-slug` anchors + the on-page TOC depend on it. The `# H1` titles stay exactly: "Introduction", "Quick Start", "Installation".
3. Preserve all MDX components (`Callout`, `Steps`, `Step`) and their props/attributes.
4. YAGNI — leave already-in-voice passages alone. If a page needs almost nothing, change almost nothing.
5. No technical corrections folded in. If you spot a real technical error, leave it and note it in your report (separate follow-up).

---

## Task 1: Voice-edit the three pages

**Files:**
- Modify: `apps/website/content/docs/langgraph/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/langgraph/getting-started/quickstart.mdx`
- Modify: `apps/website/content/docs/langgraph/getting-started/installation.mdx`

- [ ] **Step 1: Read all three pages in full**

```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do echo "===== $f ====="; cat "apps/website/content/docs/langgraph/getting-started/$f.mdx"; done
```
Note where prose is stiff, where contractions are missing, where the quickstart could use a "Let's" lead-in or a next-steps close. Note every code block, command, heading, and link — those are off-limits.

- [ ] **Step 2: Edit `introduction.mdx` (light touch)**

Already strong (title-as-lede, "What you'll learn" callout, `## What is injectAgent()?`). Apply only: tighten any long/stiff sentences into one-thought-per-line, ensure contractions, make the adapter-picker blockquote read naturally. Keep ALL headings, the `injectAgent()` code block, the `<Callout>`, and every link verbatim.

- [ ] **Step 3: Edit `quickstart.mdx` (tutorial register)**

Keep the `<Steps>`/`<Step>` structure and EVERY command/code block verbatim. Apply: a natural "Let's" lead-in where a step introduction reads flatly; ensure a short **next-steps** close exists at the end (1–3 links onward to guides/concepts — reuse links already present elsewhere in the docs, e.g. `/docs/langgraph/guides/streaming`, `/docs/langgraph/concepts/agent-contract`; do not invent routes). Contractions throughout. Do not rename any `<Step title="...">` (those render as headings/anchors-ish and are content) unless purely cosmetic and clearly better — default: keep.

- [ ] **Step 4: Edit `installation.mdx` (tighten)**

Keep the `<Steps>` structure, all version requirements, and commands exactly. Tighten the requirement blurbs to one-thought-per-line; contractions. Keep headings.

- [ ] **Step 5: Self-check the diff is prose-only**

```bash
cd /Users/blove/repos/angular-agent-framework
git --no-pager diff apps/website/content/docs/langgraph/getting-started/
```
Verify by eye: every `+`/`-` pair is prose. NO changes inside ``` fences, NO changed commands/API names/versions/links, NO changed heading lines (`#`/`##`/`###`/`<Step title>`). If any code/heading/link line shows in the diff, revert that specific change.

Automated guard — confirm headings and code fences are unchanged in count and text:
```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do
  p="apps/website/content/docs/langgraph/getting-started/$f.mdx"
  echo "== $f =="
  echo "headings:"; git --no-pager diff "$p" | grep -E "^[+-]\s*#{1,6} " || echo "  (no heading lines changed — good)"
  echo "code fences changed:"; git --no-pager diff "$p" | grep -E "^[+-]\s*\`\`\`" || echo "  (no fence lines changed — good)"
done
```
Expected: every line prints "(no … changed — good)". If a heading or fence line appears, fix it before committing.

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/content/docs/langgraph/getting-started/
git commit -m "docs(langgraph): voice pass on getting-started pages"
```
Do NOT stage `next-env.d.ts` / `tsconfig.tsbuildinfo`.

- [ ] **Step 7: Report**

Report what you changed per page (1–2 lines each), confirm the diff is prose-only (paste the heading/fence guard output), and flag any technical error you noticed but did NOT fix.

---

## Task 2: Render verification

**Files:** none (verification)

- [ ] **Step 1: Serve + check the three pages render 200 with intact anchors**

```bash
cd /Users/blove/repos/angular-agent-framework
lsof -ti tcp:3000 >/dev/null 2>&1 || (export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH && npx nx serve website --port 3000 > /tmp/wd-voice.log 2>&1 &)
sleep 25
for r in introduction quickstart installation; do
  curl -s -o /dev/null -w "$r %{http_code}\n" "http://localhost:3000/docs/langgraph/getting-started/$r"
done
```
Expected: all `200`.

- [ ] **Step 2: Confirm headings/anchors unchanged vs main**

```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do
  p="apps/website/content/docs/langgraph/getting-started/$f.mdx"
  diff <(git show origin/main:"$p" 2>/dev/null | grep -E "^#{1,6} ") <(grep -E "^#{1,6} " "$p") && echo "$f headings identical" || echo "$f HEADINGS CHANGED — investigate"
done
```
Expected: "headings identical" for all three.

(No e2e change needed — these routes already exist; the docs e2e and slug-page tests still cover rendering.)

---

## Manual / reviewer verification (required before merge)
- [ ] **Accuracy diff review:** read the full `git diff` — confirm prose-only (no code/command/API/version/link/heading change). This is the gate.
- [ ] **Voice review:** each page reads in Brian's technical register (contractions, one-thought-per-line, quickstart has "Let's" + a next-steps close), with no emojis/hype/anecdotes.
- [ ] Pages render; anchors/TOC unchanged.

## Self-Review (completed during planning)
- **Spec coverage:** all 3 pages (Task 1 steps 2-4) ✓; prose-only diff gate (Task 1 step 5 + Task 2 step 2) ✓; render check (Task 2 step 1) ✓; voice rubric + guardrails carried verbatim ✓; accuracy + voice review gate noted ✓. Out-of-scope (guides/concepts/reference, other libraries, technical fixes) excluded.
- **Placeholder scan:** No TBD/TODO. The prose edits are inherently author-judgment (a voice pass), but the rubric, the off-limits list, and the automated heading/fence guard make the boundaries exact; commands have expected output.
- **Consistency:** file paths consistent across tasks; the heading/fence guard in Task 1 step 5 and Task 2 step 2 use the same three files; "Quick Start" H1 preserved (matches docs-config title).
