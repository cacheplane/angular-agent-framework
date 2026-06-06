# Docs Voice Pass — Getting Started, Batch 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surgically voice-edit the remaining getting-started MDX pages (chat, render, ag-ui, licensing, telemetry) into Brian's technical register — prose only, with code, commands, headings/anchors, MDX components, and links left byte-identical. Same approach proven on LangGraph (#583).

**Architecture:** Edit 11 MDX files in place, grouped by library. The control that keeps this safe is the **diff gate**: every change must be prose; nothing inside fenced code blocks, no command/API/version/link/heading/`<Step title>` text may change. One library per task, each gated by the prose-only diff guard + a voice review before the next.

**Tech Stack:** MDX docs (Next.js), `git diff` as the accuracy gate, dev-server/curl for render check.

**Reference spec:** `docs/superpowers/specs/2026-06-05-docs-voice-gs-batch2-design.md`
**Voice rubric:** `docs/gtm/voice.md` (technical register).

---

## Voice rubric (apply surgically — don't churn in-voice prose)
- Title-as-lede (keep existing); contractions ("it's", "you'll", "let's"); one thought per line; short paragraphs.
- Quickstart pages (tutorial): "Let's" lead-ins on steps where a step intro reads flatly; ensure a brief next-steps close exists (reuse links already present in the docs — verify routes in `apps/website/src/lib/docs-config.ts`; do not invent routes).
- Flag opinions ("For me", "In my experience") + a tradeoff — only where the page already recommends something. Don't invent opinions.
- Trim corporate stiffness/filler; concrete verbs.
- NO emojis, anecdotes, hype ("blazing", "game-changing", "powerful", "seamless", "effortless"), or lecturing ("obviously").

## Hard guardrails (NON-NEGOTIABLE)
1. Never change anything inside a fenced ``` code block, nor any inline `code`, command, API name, type, version, or link/href.
2. Never change heading text (`#`/`##`/`###`) — `rehype-slug` anchors + the on-page TOC depend on it. The `# H1` titles stay exactly as-is (they map to nav/breadcrumb/anchors).
3. Preserve all MDX components (`Callout`, `Steps`/`Step`, `Tabs`/`Tab`, `CodeGroup`, `Card`/`CardGroup`) and their props/attributes — including every `<Step title="...">` (the title renders as content; default: keep verbatim).
4. YAGNI — leave already-in-voice passages alone. If a page needs almost nothing, change almost nothing.
5. No technical corrections folded in. If you spot a real technical error, leave it and note it in your report (separate follow-up).

---

## Per-library diff gate (run after each library's edits, before committing)

For the library's edited files, run BOTH checks. They must pass before the commit step.

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = the space-separated list of edited .mdx paths for this library
for p in $FILES; do
  echo "== $p =="
  echo "headings changed:"; git --no-pager diff "$p" | grep -E "^[+-]\s*#{1,6} " || echo "  (none — good)"
  echo "fences changed:";   git --no-pager diff "$p" | grep -E "^[+-]\s*\`\`\`"   || echo "  (none — good)"
  echo "Step titles changed:"; git --no-pager diff "$p" | grep -E "^[+-].*<Step " || echo "  (none — good)"
done
```
Expected: every line prints "(none — good)". Then eyeball the full `git --no-pager diff $FILES`: every `+`/`-` pair must be prose. If any code/heading/link/`<Step>`/component line appears, revert that specific change.

---

## Task 1: Voice-edit `chat` getting-started (3 pages)

**Files:**
- Modify: `apps/website/content/docs/chat/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/chat/getting-started/quickstart.mdx`
- Modify: `apps/website/content/docs/chat/getting-started/installation.mdx`
- (Do NOT touch `changelog.mdx` — generated/list page, out of scope.)

- [ ] **Step 1: Read all three pages in full**

```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do echo "===== chat/$f ====="; cat "apps/website/content/docs/chat/getting-started/$f.mdx"; done
```
Note where prose is stiff, where contractions are missing, where the quickstart could use a "Let's" lead-in or a next-steps close. Note every code block, command, heading, `<Step title>`, and link — those are off-limits.

- [ ] **Step 2: Edit `introduction.mdx`**

Apply the rubric surgically: title-as-lede (keep existing H1), contractions, one-thought-per-line, trim corporate stiffness. Keep ALL headings, code blocks, `<Callout>`/component props, and every link verbatim. Leave in-voice passages alone.

- [ ] **Step 3: Edit `quickstart.mdx` (tutorial register)**

Keep the `<Steps>`/`<Step>` structure and EVERY command/code block verbatim. Apply a natural "Let's" lead-in where a step intro reads flatly; ensure a short **next-steps** close exists (1–3 links onward — reuse routes already present in the docs; verify against `apps/website/src/lib/docs-config.ts`; do not invent). Contractions throughout. Do not rename any `<Step title="...">`.

- [ ] **Step 4: Edit `installation.mdx` (tighten)**

Keep the `<Steps>` structure, all version requirements, and commands exactly. Tighten requirement/setup blurbs to one-thought-per-line; contractions. Keep headings.

- [ ] **Step 5: Run the per-library diff gate**

Set `FILES` and run the gate block above:
```bash
FILES="apps/website/content/docs/chat/getting-started/introduction.mdx apps/website/content/docs/chat/getting-started/quickstart.mdx apps/website/content/docs/chat/getting-started/installation.mdx"
```
Every guard line must print "(none — good)" and the full diff must be prose-only. Fix any violation before committing.

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/content/docs/chat/getting-started/introduction.mdx apps/website/content/docs/chat/getting-started/quickstart.mdx apps/website/content/docs/chat/getting-started/installation.mdx
git commit -m "docs(chat): voice pass on getting-started pages"
```
Do NOT stage `changelog.mdx`, `next-env.d.ts`, or `tsconfig.tsbuildinfo`.

- [ ] **Step 7: Report**

Per page (1–2 lines): what changed. Paste the diff-gate output. Flag any technical error noticed but NOT fixed.

---

## Task 2: Voice-edit `render` getting-started (3 pages)

**Files:**
- Modify: `apps/website/content/docs/render/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/render/getting-started/quickstart.mdx`
- Modify: `apps/website/content/docs/render/getting-started/installation.mdx`

- [ ] **Step 1: Read all three pages in full**

```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do echo "===== render/$f ====="; cat "apps/website/content/docs/render/getting-started/$f.mdx"; done
```
Note stiff prose, missing contractions, quickstart lead-in/close opportunities. Note every code block, command, heading, `<Step title>`, and link — off-limits.

- [ ] **Step 2: Edit `introduction.mdx`**

Same rubric as Task 1 Step 2. Surgical prose edits only; preserve all headings/code/components/links.

- [ ] **Step 3: Edit `quickstart.mdx` (tutorial register)**

Same as Task 1 Step 3: "Let's" lead-ins where flat, a next-steps close with real routes (verify in `docs-config.ts`), contractions, `<Steps>`/`<Step>` and all code verbatim.

- [ ] **Step 4: Edit `installation.mdx` (tighten)**

Same as Task 1 Step 4: tighten setup/requirement blurbs; contractions; keep structure, versions, commands, headings.

- [ ] **Step 5: Run the per-library diff gate**

```bash
FILES="apps/website/content/docs/render/getting-started/introduction.mdx apps/website/content/docs/render/getting-started/quickstart.mdx apps/website/content/docs/render/getting-started/installation.mdx"
```
Run the gate block; every line "(none — good)"; full diff prose-only. Fix violations before committing.

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/content/docs/render/getting-started/introduction.mdx apps/website/content/docs/render/getting-started/quickstart.mdx apps/website/content/docs/render/getting-started/installation.mdx
git commit -m "docs(render): voice pass on getting-started pages"
```

- [ ] **Step 7: Report** (same shape as Task 1 Step 7).

---

## Task 3: Voice-edit `ag-ui` getting-started (3 pages)

**Files:**
- Modify: `apps/website/content/docs/ag-ui/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/ag-ui/getting-started/quickstart.mdx`
- Modify: `apps/website/content/docs/ag-ui/getting-started/installation.mdx`

- [ ] **Step 1: Read all three pages in full**

```bash
cd /Users/blove/repos/angular-agent-framework
for f in introduction quickstart installation; do echo "===== ag-ui/$f ====="; cat "apps/website/content/docs/ag-ui/getting-started/$f.mdx"; done
```
Note stiff prose, missing contractions, quickstart lead-in/close opportunities. Note every code block, command, heading, `<Step title>`, and link — off-limits.

- [ ] **Step 2: Edit `introduction.mdx`** — same rubric as Task 1 Step 2.

- [ ] **Step 3: Edit `quickstart.mdx`** — same as Task 1 Step 3 (real routes via `docs-config.ts`).

- [ ] **Step 4: Edit `installation.mdx`** — same as Task 1 Step 4.

- [ ] **Step 5: Run the per-library diff gate**

```bash
FILES="apps/website/content/docs/ag-ui/getting-started/introduction.mdx apps/website/content/docs/ag-ui/getting-started/quickstart.mdx apps/website/content/docs/ag-ui/getting-started/installation.mdx"
```
Run the gate block; every line "(none — good)"; full diff prose-only. Fix violations before committing.

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/content/docs/ag-ui/getting-started/introduction.mdx apps/website/content/docs/ag-ui/getting-started/quickstart.mdx apps/website/content/docs/ag-ui/getting-started/installation.mdx
git commit -m "docs(ag-ui): voice pass on getting-started pages"
```

- [ ] **Step 7: Report** (same shape as Task 1 Step 7).

---

## Task 4: Voice-edit `licensing` + `telemetry` intros (2 pages)

**Files:**
- Modify: `apps/website/content/docs/licensing/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/telemetry/getting-started/introduction.mdx`

- [ ] **Step 1: Read both pages in full**

```bash
cd /Users/blove/repos/angular-agent-framework
for p in licensing telemetry; do echo "===== $p/introduction ====="; cat "apps/website/content/docs/$p/getting-started/introduction.mdx"; done
```
Note stiff prose and missing contractions. Note every code block, command, heading, `<Step title>`, and link — off-limits.

- [ ] **Step 2: Edit `licensing/.../introduction.mdx`** — same rubric as Task 1 Step 2 (intro register). Surgical; preserve all headings/code/components/links.

- [ ] **Step 3: Edit `telemetry/.../introduction.mdx`** — same rubric as Task 1 Step 2.

- [ ] **Step 4: Run the per-library diff gate**

```bash
FILES="apps/website/content/docs/licensing/getting-started/introduction.mdx apps/website/content/docs/telemetry/getting-started/introduction.mdx"
```
Run the gate block; every line "(none — good)"; full diff prose-only. Fix violations before committing.

- [ ] **Step 5: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/content/docs/licensing/getting-started/introduction.mdx apps/website/content/docs/telemetry/getting-started/introduction.mdx
git commit -m "docs(licensing,telemetry): voice pass on getting-started intros"
```

- [ ] **Step 6: Report** (same shape as Task 1 Step 7).

---

## Task 5: Render verification (all 11 pages)

**Files:** none (verification)

- [ ] **Step 1: Serve + check all 11 routes return 200**

```bash
cd /Users/blove/repos/angular-agent-framework
lsof -ti tcp:3000 >/dev/null 2>&1 || (export PATH=/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH && npx nx serve website --port 3000 > /tmp/wd-voice2.log 2>&1 &)
sleep 25
for r in \
  "chat/getting-started/introduction" "chat/getting-started/quickstart" "chat/getting-started/installation" \
  "render/getting-started/introduction" "render/getting-started/quickstart" "render/getting-started/installation" \
  "ag-ui/getting-started/introduction" "ag-ui/getting-started/quickstart" "ag-ui/getting-started/installation" \
  "licensing/getting-started/introduction" "telemetry/getting-started/introduction"; do
  curl -s -o /dev/null -w "$r %{http_code}\n" "http://localhost:3000/docs/$r"
done
```
Expected: all `200`.

- [ ] **Step 2: Confirm headings/anchors unchanged vs origin/main for every edited page**

```bash
cd /Users/blove/repos/angular-agent-framework
for p in \
  chat/getting-started/introduction chat/getting-started/quickstart chat/getting-started/installation \
  render/getting-started/introduction render/getting-started/quickstart render/getting-started/installation \
  ag-ui/getting-started/introduction ag-ui/getting-started/quickstart ag-ui/getting-started/installation \
  licensing/getting-started/introduction telemetry/getting-started/introduction; do
  f="apps/website/content/docs/$p.mdx"
  diff <(git show origin/main:"$f" 2>/dev/null | grep -E "^#{1,6} ") <(grep -E "^#{1,6} " "$f") >/dev/null && echo "$p headings identical" || echo "$p HEADINGS CHANGED — investigate"
done
```
Expected: "headings identical" for all 11.

(No e2e change needed — these routes already exist; the docs e2e and slug-page tests still cover rendering.)

---

## Manual / reviewer verification (required before merge)
- [ ] **Accuracy diff review:** read the full `git diff origin/main...HEAD` — confirm prose-only across all 11 files (no code/command/API/version/link/heading/`<Step>`/component change). This is the gate.
- [ ] **Voice review:** each page reads in Brian's technical register (contractions, one-thought-per-line; quickstarts have "Let's" + a next-steps close), with no emojis/hype/anecdotes.
- [ ] All 11 routes render; anchors/TOC unchanged.

## Self-Review (completed during planning)
- **Spec coverage:** chat ×3 (Task 1), render ×3 (Task 2), ag-ui ×3 (Task 3), licensing+telemetry intros (Task 4) = 11 pages ✓; `changelog.mdx` excluded (Task 1 note) ✓; one PR, per-library tasks each gated by prose-only diff before the next ✓; render + heading-identity check (Task 5) ✓; rubric + guardrails carried verbatim from the LangGraph batch ✓; accuracy + voice review gate noted ✓. Out-of-scope (guides/concepts/reference, a2ui, technical fixes) excluded.
- **Placeholder scan:** No TBD/TODO. Prose edits are author-judgment (a voice pass), but the rubric, off-limits list, and the automated heading/fence/`<Step>` guard make the boundaries exact; commands have expected output.
- **Consistency:** file paths identical across each task's edit/gate/commit/verify steps; all 11 paths re-listed identically in Task 5; the `FILES` variable in each gate matches that task's `git add` set; H1 titles preserved (match docs-config titles).
