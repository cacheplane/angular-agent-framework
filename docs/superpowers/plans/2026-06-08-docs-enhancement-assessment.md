# Docs Enhancement Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assess all 7 published-lib doc sets (105 `.mdx`) for enhancement opportunities — gaps, missing/weak code examples, clarity, structure — produce one gated findings report, then implement the approved improvements as per-lib PRs.

**Architecture:** Two phases with a human gate between. Phase 1 is a read-only subagent fan-out (one audit agent per lib/section-group + a thin cross-cutting pass) that emits structured findings into a single committed report. After the user picks what to action, Phase 2 dispatches one implementer subagent per lib, each gated by a guardrail check, example typecheck-against-0.0.49, voice/spec review, and render-200. Accuracy is assumed settled by #594–#612; incidental errors are flagged as follow-ups, never folded in.

**Tech Stack:** MDX docs (Next.js App Router), Nx monorepo, `@threadplane/* @0.0.49` (published) for example validation via the `examples/chat/smoke/cli.mjs` consumer harness, `git diff` guards, independent review subagents.

**Spec:** `docs/superpowers/specs/2026-06-08-docs-enhancement-assessment-design.md`
**Findings report (created in Phase 1):** `docs/superpowers/specs/2026-06-08-docs-enhancement-findings.md`
**Branch:** `claude/docs-enhancement-assessment` (already created; spec committed).

---

## Page inventory (exact — for audit task file lists)

- **langgraph (21):** getting-started/{introduction,installation,quickstart}; concepts/{agent-architecture,agent-contract,angular-signals,langgraph-basics,state-management}; guides/{deployment,interrupts,lifecycle,memory,persistence,streaming,subgraphs,testing,time-travel}; api/{fetch-stream-transport,inject-agent,mock-stream-transport,provide-agent}
- **chat (38):** getting-started/{introduction,installation,quickstart,changelog}; concepts/{message-model,primitives-vs-compositions}; guides/{configuration,custom-catalogs,generative-ui,layout-modes,lifecycle,markdown,streaming,theming,writing-an-adapter}; components/{chat,chat-debug,chat-input,chat-interrupt-panel,chat-message-list,chat-popup,chat-reasoning,chat-select,chat-sidebar,chat-subagent-card,chat-tool-call-card,chat-tool-call-template,chat-tool-calls,chat-trace}; api/{chat-config,content-classifier,mock-agent,parse-tree-store,provide-chat}; a2ui/{catalog,overview,surface-component,surface-store}
- **render (14):** getting-started/{introduction,installation,quickstart}; concepts/{json-render-vs-a2ui}; guides/{events,lifecycle,registry,specs,state-store}; api/{define-angular-registry,provide-render,render-spec-component,signal-state-store,views}
- **ag-ui (15):** getting-started/{introduction,installation,quickstart}; concepts/{architecture}; guides/{citations,custom-events,fake-agent,interrupts,testing,troubleshooting}; api/{fake-agent,inject-agent,provide-agent,to-agent}; reference/{event-mapping}
- **a2ui (7):** getting-started/{introduction,quickstart}; guides/{adapters-and-validation,data-model,message-protocol}; reference/{parser-resolver-guards,schema}
- **telemetry (5):** getting-started/{introduction}; guides/{browser,node,privacy-and-opt-out}; reference/{events}
- **licensing (4):** getting-started/{introduction}; guides/{ci-and-offline,setup}; reference/{api}

---

## Shared definitions (used by every audit + implement task)

### Finding schema (each audit agent emits a JSON array of these)

```json
{
  "lib": "chat",
  "page": "guides/writing-an-adapter.mdx",
  "dimension": "examples",          // gaps | examples | clarity | structure | drift
  "severity": "P1",                  // P0 broken/misleading | P1 high-value | P2 nice-to-have
  "recommendation": "Add a complete, runnable minimal adapter example (provideAgent + a 20-line transport) the reader can paste and run; current page only shows the interface signature.",
  "est_effort": "M"                  // S (<15min) | M (15-45min) | L (>45min)
}
```

### Audit agent prompt template (Phase 1 — reused per lib/group)

```
You are auditing docs for ENHANCEMENT only. Accuracy + voice were just reviewed —
do NOT report tone/register nits or re-verify correctness beyond an obvious-error spot-check.

Read these pages: <FILE LIST>
Ground yourself in the real API: read libs/<lib>/src/public-api.ts and the relevant
source, and examples/chat where a runnable pattern exists.

Score each page on the rubric (gaps, examples, clarity, structure, drift) and emit a
JSON array of findings using the Finding schema. Rules:
- Recommendations MUST be concrete and actionable (name the page, the exact missing
  example or section, the specific fix). No vague "improve clarity".
- A page with no real enhancement opportunity gets ZERO findings — do not invent work.
- If you spot a genuine ACCURACY error, add a finding with dimension="drift" severity="P0"
  and prefix recommendation with "ACCURACY-FOLLOWUP:" so it is routed out, not folded in.
- Severity honestly: P1 = a reader is meaningfully better off; P2 = polish.
Return ONLY the JSON array.
```

### Guardrails (every Phase 2 implementer obeys)

1. Prose + example edits only. No `libs/**` source changes.
2. Don't change existing heading text (`#`/`##`/`###`) — `rehype-slug` anchors + TOC depend on it. New sections MAY add new headings; existing ones stay byte-identical.
3. Preserve MDX components/props; supported `Callout` types only (`tip`/`info`/`warning`/`danger`).
4. New/changed TS example snippets MUST typecheck against published 0.0.49 (Task 2 harness) OR be explicitly labeled conceptual/partial.
5. No accuracy corrections folded in — those are separate `ACCURACY-FOLLOWUP` tasks.

### Per-page gate (run after each Phase 2 lib's edits, before commit)

```bash
cd /Users/blove/repos/angular-agent-framework
# $FILES = edited .mdx paths for this lib
for p in $FILES; do
  echo "== $p =="
  echo "existing-heading edits:"; git --no-pager diff "$p" | grep -E "^-\s*#{1,6} " || echo "  (none — good)"
  echo "fence balance:"; git --no-pager diff "$p" | grep -E "^[+-]\s*\`\`\`" | wc -l
  echo "note callout:"; git --no-pager diff "$p" | grep -E "^\+.*type=\"note\"" && echo "  BAD" || echo "  (none — good)"
done
```
"existing-heading edits (none — good)" is required (a `-` heading line means an existing heading changed → revert). Added headings (`+` only, no matching `-`) are allowed.

---

## Task 1 — Phase 1 setup: findings report skeleton

**Files:**
- Create: `docs/superpowers/specs/2026-06-08-docs-enhancement-findings.md`

- [ ] **Step 1: Create the report skeleton**

```markdown
# Docs Enhancement — Findings Report

> Phase 1 output of the docs enhancement assessment. Backlog is GATED: the user
> selects what enters Phase 2. Default: P0+P1 in, P2 deferred.
> `ACCURACY-FOLLOWUP:` findings are routed to separate tasks, NOT folded into enhancement PRs.

## Summary (filled after aggregation)
| Lib | P0 | P1 | P2 | Accuracy-followups |
|---|---|---|---|---|
| langgraph | | | | |
| chat | | | | |
| render | | | | |
| ag-ui | | | | |
| a2ui | | | | |
| telemetry | | | | |
| licensing | | | | |
| cross-cutting | | | | |

## Findings by lib
<!-- one subsection per lib, populated from audit agents -->

## Cross-cutting findings
<!-- example-parity, terminology/cross-link, journey -->
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-08-docs-enhancement-findings.md
git commit -m "docs: findings report skeleton for enhancement assessment"
```

## Task 2 — Build the example-validation harness (published 0.0.49)

**Files:**
- Create: `/Users/blove/tmp/ngaf-docs-validate/` (throwaway consumer; NOT committed)

- [ ] **Step 1: Generate a published-0.0.49 consumer**

```bash
cd /Users/blove/repos/angular-agent-framework/examples/chat/smoke
node cli.mjs --non-interactive --fresh \
  --target /Users/blove/tmp/ngaf-docs-validate \
  --version 0.0.49 --install --no-start
```
Expected: `✓ Smoke consumer ready at /Users/blove/tmp/ngaf-docs-validate` with all 7 `@threadplane/*` at `^0.0.49` from npm.

- [ ] **Step 2: Install peer deps the consumer needs for snippet typechecking**

```bash
cd /Users/blove/tmp/ngaf-docs-validate
npm install --no-save @langchain/langgraph-sdk@^1.7.4 @json-render/core@^0.16.0 @noble/ed25519@^2.2.3
```
Expected: exit 0.

- [ ] **Step 3: Add a snippet typecheck scratch + confirm it works**

Create `/Users/blove/tmp/ngaf-docs-validate/snippet-check.ts` with a known-good import and run:
```bash
cd /Users/blove/tmp/ngaf-docs-validate
printf "import { injectAgent, provideAgent } from '@threadplane/langgraph';\nconst _ = { injectAgent, provideAgent };\n" > snippet-check.ts
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 snippet-check.ts && echo "HARNESS OK"
```
Expected: `HARNESS OK` (proves published types resolve; Phase 2 implementers drop candidate snippets into `snippet-check.ts` to validate them). No commit — this dir is throwaway.

## Task 3 — Phase 1 audit: langgraph (fan-out, 2 agents)

**Files:** read-only audit of the 21 langgraph pages.

- [ ] **Step 1: Dispatch audit agent A (getting-started + concepts, 8 pages)**

Use the Audit agent prompt template with FILE LIST = langgraph getting-started/* + concepts/*. Collect the returned JSON array.

- [ ] **Step 2: Dispatch audit agent B (guides + api, 13 pages)**

FILE LIST = langgraph guides/* + api/*. Collect JSON.

- [ ] **Step 3: Append findings to the report**

Merge both arrays into a `### langgraph` subsection of the findings report (render as a table: page | dim | sev | recommendation | effort). Commit:
```bash
git add docs/superpowers/specs/2026-06-08-docs-enhancement-findings.md
git commit -m "docs(findings): langgraph enhancement audit"
```

## Task 4 — Phase 1 audit: chat (fan-out, 4 agents)

- [ ] **Step 1: Dispatch 4 audit agents** (one each), FILE LISTs:
  - getting-started/* + concepts/* (6)
  - guides/* (9)
  - components/* (14)
  - api/* + a2ui/* (9)
- [ ] **Step 2: Merge into `### chat` subsection; commit** `docs(findings): chat enhancement audit`.

## Task 5 — Phase 1 audit: render + ag-ui (fan-out, 4 agents)

- [ ] **Step 1: render** — 2 agents: R1 = getting-started/* + concepts/* + guides/* (9), R2 = api/* (5).
- [ ] **Step 2: ag-ui** — 2 agents: A1 = getting-started/*+concepts/*+guides/* (10), A2 = api/*+reference/* (5). ag-ui A2 MUST spot-check the post-#632 api pages (fake-agent, inject-agent, provide-agent, to-agent) + custom-events guide for drift.
- [ ] **Step 3: Merge into `### render` and `### ag-ui`; commit** `docs(findings): render + ag-ui enhancement audit`.

## Task 6 — Phase 1 audit: a2ui + telemetry + licensing (fan-out, 3 agents)

- [ ] **Step 1: one agent each** — a2ui (7), telemetry (5), licensing (4).
- [ ] **Step 2: Merge into their subsections; commit** `docs(findings): a2ui + telemetry + licensing enhancement audit`.

## Task 7 — Phase 1 cross-cutting pass (3 agents)

- [ ] **Step 1: Example-parity agent.** Prompt: "Across all 7 libs' getting-started + primary guide, does each have a runnable end-to-end example? Do equivalent concepts (adapter wiring, streaming, testing) get equivalent example depth? Emit findings (dimension=examples or gaps) for libs that lag." 
- [ ] **Step 2: Terminology/cross-link agent.** Prompt: "Check terminology consistency (same term, same meaning across libs) and that key cross-links exist: chat↔langgraph adapter, render↔a2ui, ag-ui↔chat, chat generative-ui↔render. Emit findings (dimension=structure/clarity)."
- [ ] **Step 3: Journey agent (langgraph + chat only).** Prompt: "Walk getting-started → a representative guide → production for langgraph and chat. Note flow gaps and 'missing example at this step'. Emit findings (dimension=gaps/structure)."
- [ ] **Step 4: Merge into `## Cross-cutting findings`; commit** `docs(findings): cross-cutting pass`.

## Task 8 — Phase 1 aggregate + summary + GATE

- [ ] **Step 1:** Fill the Summary table (P0/P1/P2/accuracy counts per lib + cross-cutting). Extract all `ACCURACY-FOLLOWUP:` findings into a short `## Accuracy follow-ups (out of scope here)` list.
- [ ] **Step 2: Commit** `docs(findings): summary + accuracy-followup routing`.
- [ ] **Step 3: Push branch + STOP for the gate.**

```bash
git push -u origin claude/docs-enhancement-assessment
```
Present the report to the user. **Do not start Phase 2 until the user selects scope.** Capture their selection (default P0+P1 in, P2 deferred) before proceeding.

---

## GATE — user selects Phase 2 scope (P0+P1 default; P2 opt-in)

---

## Task 9 — Phase 2: langgraph improvement PR

**Files:** the approved langgraph pages (per the gated backlog).

- [ ] **Step 1: Branch off up-to-date main**

```bash
git fetch origin main -q
git checkout -b claude/docs-enhance-langgraph origin/main
```

- [ ] **Step 2: Dispatch implementer subagent** with: the approved langgraph findings (full text), the Guardrails, and the example-harness instructions (Task 2). It edits only the listed pages, adds/strengthens examples, validates any new TS snippet via `snippet-check.ts`.

- [ ] **Step 3: Per-page gate** — run the Per-page gate block on edited files; "(none — good)" for existing-heading edits. Fix violations.

- [ ] **Step 4: Example validation** — for each new/changed TS snippet, paste into `/Users/blove/tmp/ngaf-docs-validate/snippet-check.ts` and run the tsc command from Task 2 Step 3. Expected: no errors (or the snippet is labeled conceptual). Fix until clean.

- [ ] **Step 5: Spec/voice review subagent** — confirm each change matches its finding, respects guardrails, stays in voice, adds no accuracy corrections. Loop until clean.

- [ ] **Step 6: Render check**

```bash
cd /Users/blove/repos/angular-agent-framework
nx run website:serve &   # or the project's dev command; wait for :3000
for r in <edited langgraph routes>; do curl -s -o /dev/null -w "%{http_code} $r\n" http://localhost:3000/docs/langgraph/$r; done
```
Expected: `200` for every edited route. Kill the server.

- [ ] **Step 7: Commit + PR + auto-merge**

```bash
git add apps/website/content/docs/langgraph
git commit -m "docs(langgraph): enhancement pass — examples, gaps, clarity"
git push -u origin claude/docs-enhance-langgraph
gh pr create --title "docs(langgraph): enhancement pass" --body "Implements approved P0/P1 enhancement findings for langgraph. Examples typecheck against published 0.0.49. Prose+examples only; no accuracy corrections (routed separately)."
gh pr merge --squash --auto
```
Monitor; `gh pr update-branch` if BEHIND.

## Task 10 — Phase 2: chat improvement PR

Same shape as Task 9 with `claude/docs-enhance-chat`, edited files = approved chat pages, routes under `/docs/chat/...`. Commit `docs(chat): enhancement pass — examples, gaps, clarity`. (chat is the largest backlog — if the implementer would touch >~8 pages, split into two implementer dispatches within the same PR, grouped by section, each gated separately before the shared commit.)

## Task 11 — Phase 2: render improvement PR

Same shape, `claude/docs-enhance-render`, `/docs/render/...`, commit `docs(render): enhancement pass — examples, gaps, clarity`.

## Task 12 — Phase 2: ag-ui improvement PR

Same shape, `claude/docs-enhance-ag-ui`, `/docs/ag-ui/...`, commit `docs(ag-ui): enhancement pass — examples, gaps, clarity`.

## Task 13 — Phase 2: a2ui + telemetry + licensing improvement PR(s)

Small backlogs — one PR per lib (`claude/docs-enhance-a2ui`, `-telemetry`, `-licensing`) following Task 9's shape. If any lib has zero approved findings, skip it and note so.

## Task 14 — Land planning artifacts + close out

- [ ] **Step 1:** After all Phase 2 PRs merge, land the spec + plan + final findings report to main via the `claude/docs-enhancement-assessment` branch (rebased on up-to-date main); open a doc-only PR; auto-merge.
- [ ] **Step 2:** Confirm all PRs merged (monitor; `gh pr update-branch` any BEHIND; serialize). Sync local main; delete merged branches.
- [ ] **Step 3:** Spawn separate follow-up tasks for every `ACCURACY-FOLLOWUP` finding (do NOT fold into enhancement PRs).
- [ ] **Step 4:** Remove the throwaway harness: `rm -rf /Users/blove/tmp/ngaf-docs-validate`.

---

## Manual verification (per Phase 2 PR, before merge)
- [ ] Per-page gate: no existing-heading edits; no `note` callouts; fences balanced.
- [ ] Every new/changed TS example typechecks against published 0.0.49 (or is labeled conceptual).
- [ ] Independent review confirms each edit maps to an approved finding, no accuracy corrections folded in, voice intact.
- [ ] All edited routes return HTTP 200; existing headings byte-identical to `main`.

## Self-Review (completed during planning)

- **Spec coverage:** enhancement rubric (gaps/examples/clarity/structure/drift) → audit prompt template + Tasks 3–7 ✓; per-lib audit fan-out with section-grouping for big libs → Tasks 3–6 ✓; thin cross-cutting pass (parity/terminology/journey) → Task 7 ✓; committed findings report + summary → Tasks 1, 8 ✓; gate with P2-deferred default → GATE + Task 8 Step 3 ✓; per-lib Phase 2 PRs in langgraph→…→licensing order → Tasks 9–13 ✓; example typecheck-against-0.0.49 → Task 2 + every Phase 2 Step 4 ✓; guardrails (prose+examples only, no heading churn, accuracy routed separately) → Shared definitions + Task 14 Step 3 ✓; artifacts paths → header ✓.
- **Placeholder scan:** no TBD/TODO. Audit/implement tasks are subagent dispatches by nature; each carries a concrete prompt, file list, schema, and verification command. `<edited routes>` / `<approved pages>` are deliberately bound at runtime by the gated backlog (can't be enumerated before Phase 1) — the binding rule is explicit.
- **Consistency:** Finding schema fields (lib/page/dimension/severity/recommendation/est_effort) used identically in the schema, audit prompt, and report; severities P0/P1/P2 defined once and referenced throughout; the same Per-page gate + harness are referenced by every Phase 2 task; ACCURACY-FOLLOWUP routing appears in the prompt, gate, and Task 14.
