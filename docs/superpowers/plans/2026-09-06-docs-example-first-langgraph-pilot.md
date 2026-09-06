# Example-first docs — LangGraph pilot (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the eight LangGraph docs pages that embed a runnable example so each teaches through that example via `<ExampleCode>`, absorb and delete their eight walkthroughs, and prove the rendered include end to end with a browser test.

**Architecture:** PR 1 (#1025) shipped `<ExampleCode file= region= title=>` (`apps/website/src/components/docs/mdx/ExampleCode.tsx`) bound per page from the registry's asset paths, and the guard `apps/website/src/lib/docs-example-code.spec.ts` with a `PENDING_PAGES` list. This PR is content work under that contract: every page follows one shape (spec §3), pulls code from the example instead of hand-typed copies, adds `#region` markers to long example files, and leaves `PENDING_PAGES` minus its eight entries.

**Tech Stack:** MDX under `apps/website/content/docs/langgraph/guides/`, example sources under `cockpit/langgraph/<topic>/{python,angular}/src/`, Playwright (`apps/website/e2e`), Vitest guards.

**Spec:** `docs/superpowers/specs/2026-09-05-docs-example-first-content-design.md` (§3 page shape, §5 "PR 2, LangGraph pilot").

**Branch:** `blove/docs-example-first-langgraph`, already created from `origin/main` at a3507380.

**Decisions fixed for this PR**
- `CodeGroup` does not tab `ExampleCode` blocks (spec §1). Use sequential `<ExampleCode>` blocks with short prose between them; never wrap them in `<CodeGroup>` or `<Tabs>`.
- Prose register: 2026 voice per `docs/gtm/voice.md`: **no contractions** in any rewritten or new sentence (existing untouched sentences may keep theirs, but every sentence you write or edit uses full forms). Warm peer, opinions flagged ("For me…").
- The word "cockpit" must not appear in page prose (guard `apps/website/src/lib/cockpit-retirement.spec.ts`); say "the running example", "the Run tab", "the Code tab". Never name competitor products.
- Walkthrough `<Prompt>` blocks are dropped (spec Non-goals). `<Tip>`/`<Warning>`/`<Note>` content is absorbed only when the page does not already say it.
- Frontmatter: every page keeps or gains a `description:` under 180 characters, one sentence, no trailing period needed.

**Commands**
- Website unit: `npx nx test website --skip-nx-cache` (run from the repo root; `cockpit-retirement.spec.ts` is cwd-coupled, so do not run vitest from inside `apps/website` for the full suite). Single specs: `cd apps/website && npx vitest run docs-example-code public-copy cockpit-retirement docs-search`.
- Generators after ANY edit under `cockpit/langgraph/**`: `npx tsx scripts/generate-shared-deployment-config.ts && npx tsx scripts/generate-ag-ui-deployment-config.ts`, then `git status --short deployments` and commit whatever changed (post-merge drift gates in `deploy-langgraph.yml` / `deploy-ag-ui.yml` run `git diff --exit-code`).
- Prod build: `rm -rf apps/website/.next dist/apps/website/.next && GROWTH_FORM_POLICY=growth_v1 npx nx build website` (output in `dist/apps/website/.next`).
- E2E (local servers): `npx nx e2e website --skip-nx-cache`; one spec: `cd apps/website && npx playwright test e2e/example-code.spec.ts`.

---

## The page procedure (used by Tasks 2–9)

Each page task names: the page file, the walkthrough file, the example files with their line counts, and a target outline. Do these steps in order for that page.

- [ ] **P1. Read everything first.** The current page, the walkthrough, every example file listed, and `docs/gtm/voice.md` lines 1–60. Note which hand-written snippets on the page duplicate example code (same API calls, same shape) and which teach something the example does not contain (other stream modes, other checkpointers, patterns the demo does not exercise). The first kind is replaced by `<ExampleCode>`; the second kind stays as ordinary fences.

- [ ] **P2. Add regions to long example files.** For any example file over ~60 lines, add named marker pairs around the parts the page will discuss, using the language's form: `// #region name` … `// #endregion` (TypeScript), `# region name` … `# endregion` (Python). Names are kebab-case and describe the concept (`provider`, `submit`, `approve`, `checkpointer`, `fork`). Regions may nest. Do not change any executable line; markers are comments only. Keep a region under ~40 lines where the discussion is line-level. Whole files under ~60 lines need no regions.

- [ ] **P3. Rewrite the page to the outline.** Shape (spec §3):
  1. Title, one-paragraph lead (what the reader gets), then `## What the demo does`: two to four sentences on what the Run tab shows and one or two things to try (draw on the example's welcome suggestions or prompt file where present).
  2. `## How it is built`: walk the example in build order under `###` headings: the backend graph first (`graph.py`, one or more regions), then `app.config.ts` (whole file; explain the provider factory and that the runtime connection is how the running example is wired; a reader's app passes `apiUrl`/`assistantId` directly), then the component (regions), then the template if it is a separate file. Each `<ExampleCode>` gets one to three sentences before it saying what to look at, and at most one sentence after it. Use `title="…"` only when the basename is not self-explanatory (for a region, a title like `graph.py — checkpointer` is good).
  3. `## Concepts` (or the page's own conceptual headings, kept): the explanatory material the current page already carries that the example does not show, trimmed of snippets the example now covers. Keep hand-written fences only for variants the example lacks.
  4. `## What's Next`: keep the existing `CardGroup`.
  Absorb from the walkthrough: any `<Tip>`/`<Warning>`/`<Note>` whose point the page does not already make becomes a `<Callout type="tip|warning|info">`. Drop its `<Summary>`, `<Prompt>`, `<Steps>` (the steps are the "How it is built" walk), and `<Related>` (the page's own What's Next covers it; the walkthrough's links point at retired routes).

- [ ] **P4. Delete the walkthrough** (`git rm cockpit/langgraph/<topic>/python/docs/guide.md`). If the `docs/` directory is then empty, git removes it.

- [ ] **P5. Remove the page from `PENDING_PAGES`** in `apps/website/src/lib/docs-example-code.spec.ts` (one line).

- [ ] **P6. Regenerate deployments** if you touched anything under `cockpit/` (region markers count): run both generators and stage `deployments/`.

- [ ] **P7. Verify.**
  ```bash
  cd apps/website && npx vitest run docs-example-code public-copy cockpit-retirement docs-search docs.spec && cd ../..
  npx nx test website --skip-nx-cache
  grep -n "cockpit" apps/website/content/docs/langgraph/guides/<slug>.mdx   # expect nothing
  grep -nE "\b(don't|doesn't|isn't|it's|you'll|you're|we're|can't|won't|that's|there's|let's|I'm|they're|didn't|wasn't|aren't|hasn't|haven't|shouldn't|wouldn't|couldn't)\b" apps/website/content/docs/langgraph/guides/<slug>.mdx   # expect nothing in lines you wrote
  ```
  Then a prod build (`GROWTH_FORM_POLICY=growth_v1 npx nx build website`) and confirm with `grep -c 'data-example-file=' dist/apps/website/.next/server/app/docs/langgraph/guides/<slug>.html` that the count equals the number of `<ExampleCode>` tags on the page. Then `rm -rf apps/website/.next dist/apps/website/.next`.

- [ ] **P8. Commit** the page, the example files, the deleted walkthrough, the guard spec, and any regenerated deployments in ONE commit: `docs(langgraph): <slug> teaches through the running example`. End the message with a blank line and `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Browser proof of a rendered `ExampleCode` block

**Files:**
- Create: `apps/website/e2e/example-code.spec.ts`

The streaming page already renders `<ExampleCode file="streaming.component.ts" />` (PR 1), so this spec is green before any page rewrite and guards the component for every later page.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

/**
 * `<ExampleCode>` renders a docs page's example file through the docs code
 * pipeline. jsdom proves the element tree; only a browser proves that the
 * fence was highlighted, that the title bar is visible, and that the copy
 * button copies the example source rather than the title or the markers.
 */
test.describe('ExampleCode on a docs page', () => {
  const route = '/docs/langgraph/guides/streaming';
  const file = 'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts';

  test('renders a highlighted, titled, copyable block from the example file', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(route);

    const block = page.locator(`.mdx-example-code[data-example-file="${file}"]`).first();
    await expect(block).toBeVisible();
    await expect(block.locator('.mdx-example-code-title')).toHaveText('streaming.component.ts');
    await expect(block).toHaveAttribute('role', 'group');

    // Highlighted: shiki emits per-token spans with inline colour.
    const pre = block.locator('pre').first();
    await expect(pre).toBeVisible();
    expect(await pre.locator('span[style*="color"]').count()).toBeGreaterThan(10);
    await expect(pre).toContainText('export class StreamingComponent');

    // Copy: the button copies the code, not the title bar.
    await block.locator('button[aria-label="Copy code"]').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('export class StreamingComponent');
    expect(copied).not.toContain('streaming.component.ts\n');
  });
});
```

- [ ] **Step 2: Run it against the local dev server**

Run: `cd apps/website && npx playwright test e2e/example-code.spec.ts`
Expected: 1 passed. If the copy assertion fails because clipboard access is denied in headless mode, look at how `apps/website/e2e/home-hero.spec.ts` grants and reads the clipboard and match it exactly.

- [ ] **Step 3: Confirm it also runs in the production-verify mode**

The spec talks only to the page, so it must NOT be added to `fixtureDrivenSpecs` in `apps/website/playwright.config.ts`. Run: `BASE_URL=https://threadplane.ai npx nx e2e website --skip-nx-cache -- --grep "ExampleCode"` and expect 1 passed (PR 1 is live).

- [ ] **Step 4: Commit**

```bash
git add apps/website/e2e/example-code.spec.ts
git commit -m "test(website): browser proof that ExampleCode renders, highlights, and copies example source"
```

---

### Task 2: Streaming

**Inputs**
- Page: `apps/website/content/docs/langgraph/guides/streaming.mdx` (276 lines)
- Walkthrough: `cockpit/langgraph/streaming/python/docs/guide.md` (126 lines)
- Example: `cockpit/langgraph/streaming/python/src/graph.py` (53), `cockpit/langgraph/streaming/angular/src/app/app.config.ts` (22), `streaming.component.ts` (57). All whole-file; no regions needed.

**Outline**
1. Lead + `## What the demo does` (tokens arrive incrementally into the prebuilt `<chat>`; try the two welcome suggestions).
2. `## How it is built`: `### The graph` → `<ExampleCode file="graph.py" />` (one node, `MessagesState`, `streaming=True`, system prompt read from the prompts file); `### The provider` → `<ExampleCode file="app.config.ts" />`; `### The component` → `<ExampleCode file="streaming.component.ts" />` (typed agent ref, `<chat [agent]>`, `submit`). This replaces the current "How streaming works" tab group AND the PR 1 "### The running example" section; the `agent.py` stream-mode commentary in that tab group moves to Concepts as a short fence showing only the three `astream` calls.
3. Concepts kept: `## Stream status`, `## Stream modes` (tabs stay), `## Error handling` (keep, but its `chat.component.ts` fence shrinks to the `hasError`/`retry()` lines), `## Throttle configuration`.
4. `## What's Next` unchanged.
5. Absorb from the walkthrough: the `<Warning>` about never exposing the LangSmith API key client-side (as a `warning` callout in the provider section, if the page does not already say it).

- [ ] Run the page procedure P1–P8 for `streaming`.

---

### Task 3: Persistence

**Inputs**
- Page: `persistence.mdx` (416 lines). Walkthrough: `cockpit/langgraph/persistence/python/docs/guide.md` (169).
- Example: `graph.py` (40, whole), `app.config.ts` (10, whole), `persistence.component.ts` (205 → regions: `provider`/`agent`, `thread-list`, `switch-thread`, `new-thread`, plus whatever the file's own structure suggests).

**Outline**
1. Lead + `## What the demo does` (threads survive reloads; switch threads in the sidebar; start a new one).
2. `## How it is built`: `### The graph and its checkpointer` → `graph.py`; `### The provider` → `app.config.ts`; `### Listing and switching threads` → component regions in the order the user meets them (list, switch, new).
3. Concepts kept and trimmed: `## Python: Checkpointer Setup` becomes `## Choosing a checkpointer` (keep the MemorySaver/SQLite/Postgres comparison fences; drop any fence that duplicates the example graph), `## Thread IDs in graph invocation`, `## Reactive Thread Switching`, `## Manual Thread Switching`, `## Checkpoint Recovery`, `## Thread Lifecycle`. The two current `## Angular: …` sections (basic persistence, thread-list component) are replaced by the example walk; keep only fragments that show a pattern the demo does not (say so in one sentence).
4. `## What's Next` unchanged.
5. Absorb: walkthrough `<Tip>`/`<Warning>` items not already on the page.

- [ ] Run the page procedure P1–P8 for `persistence`.

---

### Task 4: Interrupts

**Inputs**
- Page: `interrupts.mdx` (588 lines). Walkthrough: `cockpit/langgraph/interrupts/python/docs/guide.md` (147).
- Example: `graph.py` (120 → regions: `state`, `plan`, `approve` (the `interrupt()` call), `execute`, `graph`), `app.config.ts` (21, whole), `interrupts.component.ts` (157 → regions: `agent`, `interrupt-view`, `approve`, `reject`).

**Outline**
1. Lead + `## What the demo does` (the agent proposes, pauses, and waits; approve or reject in the panel).
2. `## How it is built`: `### Pausing the graph` → `graph.py` regions `approve` then `graph`; `### The provider` → `app.config.ts`; `### Surfacing the interrupt` → component regions `interrupt-view`, `approve`, `reject`.
3. Concepts kept and trimmed: `## The Interrupt Lifecycle` (keep, it is the mental model), `## Multi-Step Approval Pattern` (keep only what the demo does not do; if the demo is single-step, keep the section but shorten its fences to the resume call), `## Typed Interrupt Payloads with BagTemplate`, `## Timeout Handling`. The current `## Python: Pausing With An Interrupt` and `## Angular: Building an Approval Component` are replaced by the example walk.
4. `## What's Next` unchanged.

- [ ] Run the page procedure P1–P8 for `interrupts`.

---

### Task 5: Memory

**Inputs**
- Page: `memory.mdx` (442 lines). Walkthrough: `cockpit/langgraph/memory/python/docs/guide.md` (165).
- Example: `graph.py` (115 → regions: `state`, `extract-memory`, `respond`, `graph`), `app.config.ts` (21, whole), `memory.component.ts` (81 → regions: `memory-signal`, `template` or whole if the file reads well as one block).

**Outline**
1. Lead + `## What the demo does` (tell the agent a preference, watch the memory sidebar fill, see it used later in the thread).
2. `## How it is built`: `### Extracting memory in the graph` → `graph.py` regions `state`, `extract-memory`; `### The provider` → `app.config.ts`; `### Reading memory with value()` → component.
3. Concepts kept and trimmed: `## Agent State with Custom Memory Fields` (shrink to the parts the example does not show), `## Short-Term Memory (Thread-Scoped)`, `## Long-Term Memory (Cross-Thread) with the Store API` (keep; the demo is thread-scoped), `## Semantic Memory with Vector Search` (keep), `## Memory Best Practices`. `## Surfacing Memory in Angular with value()` is replaced by the example walk.
4. `## What's Next` unchanged.

- [ ] Run the page procedure P1–P8 for `memory`.

---

### Task 6: Durable execution

**Inputs**
- Page: `durable-execution.mdx` (10-line stub with a description). Walkthrough: `cockpit/langgraph/durable-execution/python/docs/guide.md` (158) — this is the page's main source of narrative.
- Example: `graph.py` (94 → regions per node, e.g. `fetch`, `analyze`, `summarize`, `graph`), `app.config.ts` (21, whole), `durable-execution.component.ts` (215 → regions: `status-badge`, `data-received`, `retry`, `agent`).

**Outline**
1. Keep the stub's lead paragraph (it is good). `## What the demo does` (a multi-node run you can interrupt and retry; the status badge and data-received indicator).
2. `## How it is built`: `### A multi-node graph` → `graph.py` regions in node order, then `graph`; `### The provider` → `app.config.ts`; `### Status, progress, and retry` → component regions `status-badge`, `data-received`, `retry`.
3. `## Concepts`: from the walkthrough's Steps prose and its Tips/Warnings: what durability guarantees and does not, why `submit()` with no input resumes rather than restarts (link to the streaming page's error-handling section), and that the checkpointer is configured as in the Persistence guide (keep the stub's link).
4. `## What's Next`: a `CardGroup` linking Persistence, Time Travel, Interrupts (use the same `Card` markup as the streaming page).

- [ ] Run the page procedure P1–P8 for `durable-execution`.

---

### Task 7: Subgraphs

**Inputs**
- Page: `subgraphs.mdx` (422 lines). Walkthrough: `cockpit/langgraph/subgraphs/python/docs/guide.md` (186).
- Example: `graph.py` (176 → regions: `research-subgraph`, `analysis-subgraph`, `orchestrator`, `graph`), `agent-ref.ts` (23, whole), `subgraphs.component.ts` (217 → regions: `agent`, `subagents`, `progress`, `transcript`), and `app.config.ts` is NOT an asset for this capability (its assets are `agent-ref.ts` and the component) — do not reference it with `<ExampleCode>`.

**Outline**
1. Lead + `## What the demo does` (one request fans out to research and analysis children; watch the subagent cards).
2. `## How it is built`: `### Two children and one orchestrator` → `graph.py` regions in that order; `### Typed state for the parent` → `agent-ref.ts`; `### Rendering delegated work` → component regions `subagents`, `progress`, `transcript`.
3. Concepts kept and trimmed: `## How subgraph composition works` (shrink its fence to what the example does not show, or drop the fence), `## Giving the child its own state`, `## Tracking delegated subagent execution`, `## Subagent stream details`, `## How child streams get matched to tool calls`, `## Orchestrator pattern`, `## Child messages and the parent transcript`, `## Error handling per subagent`, `## When to use subagents vs a single agent`. `## Subagent progress UI` is replaced by the example walk.
4. `## What's Next` unchanged.

- [ ] Run the page procedure P1–P8 for `subgraphs`.

---

### Task 8: Time travel

**Inputs**
- Page: `time-travel.mdx` (315 lines). Walkthrough: `cockpit/langgraph/time-travel/python/docs/guide.md` (146).
- Example: `graph.py` (45, whole), `app.config.ts` (21, whole), `time-travel.component.ts` (232 → regions: `agent`, `history`, `fork`, `branches`).

**Outline**
1. Lead + `## What the demo does` (send a few messages, open the history sidebar, fork from an earlier checkpoint, navigate branches).
2. `## How it is built`: `### A checkpointed graph` → `graph.py`; `### The provider` → `app.config.ts`; `### History, forking, and branches` → component regions in that order.
3. Concepts kept and trimmed: `## How checkpointing works` (keep the server-side `get_state_history` fence; drop parts the example graph shows), `## Browsing execution history`, `## Forking from a checkpoint`, `## Branch navigation` (each shrinks to what the component regions do not already show), `## Comparing checkpoints`, `## Replaying with modified input`. `## Building a history UI` is replaced by the example walk.
4. `## What's Next` unchanged.

- [ ] Run the page procedure P1–P8 for `time-travel`.

---

### Task 9: Deployment

**Inputs**
- Page: `deployment.mdx` (438 lines). Walkthrough: `cockpit/langgraph/deployment-runtime/python/docs/guide.md` (188).
- Example: `graph.py` (48, whole), `app.config.ts` (21, whole), `deployment-runtime.component.ts` (25, whole).

This page is mostly operational guidance the example cannot show (CI, auth, CORS, monitoring). The example's job here is the deployable unit: a graph, a provider, a component. Keep the operational sections.

**Outline**
1. Lead + `## What the demo does` (the smallest deployable pair: a graph on LangGraph Platform and an Angular component reading it through the configured runtime).
2. `## How it is built`: `### The graph you deploy` → `graph.py`; `### Pointing the app at a deployment` → `app.config.ts` (explain that a real app sets `apiUrl` to the deployment URL and `assistantId` to the graph name in `langgraph.json`); `### The component` → `deployment-runtime.component.ts`.
3. Concepts kept: `## Python: LangGraph Cloud deployment` (rename `## Deploying the graph`; keep `### Agent entry point` only if it shows something `graph.py` does not, else drop; keep `### Push and deploy`), `## LangSmith deployment walkthrough`, `## Angular: environment configuration` (rename `## Environment configuration`), `## Authentication`, `## CORS configuration`, `## Error boundaries`, `## Stream recovery`, `## CI/CD pipeline`, `## Monitoring`, `## Deployment checklist`.
4. `## What's Next` unchanged.
5. Absorb: the walkthrough's Vercel-hosting step and its CI tip only where the page lacks them.

- [ ] Run the page procedure P1–P8 for `deployment` (walkthrough directory is `deployment-runtime`).

---

### Task 10: Close out

- [ ] **Step 1: Guard state.** `PENDING_PAGES` in `apps/website/src/lib/docs-example-code.spec.ts` has exactly 32 entries and none start with `/docs/langgraph/`. `ls cockpit/langgraph/*/python/docs/guide.md` lists only `client-tools` (it maps to `/docs/chat/guides/client-tools`, the chat product's PR).

- [ ] **Step 2: Whole-tree verification.**
```bash
npx nx run-many -t test,lint --projects=website,cockpit-registry,cockpit-shell,scripts --skip-nx-cache
npx tsx scripts/generate-shared-deployment-config.ts && npx tsx scripts/generate-ag-ui-deployment-config.ts && git status --short deployments   # expect empty
rm -rf apps/website/.next dist/apps/website/.next && GROWTH_FORM_POLICY=growth_v1 npx nx build website
for s in streaming persistence interrupts memory durable-execution subgraphs time-travel deployment; do echo "$s: $(grep -c 'data-example-file=' dist/apps/website/.next/server/app/docs/langgraph/guides/$s.html)"; done
rm -rf apps/website/.next dist/apps/website/.next
npx nx e2e website --skip-nx-cache
```
Expected: all green; every page count ≥ 3; the e2e suite includes the new `example-code.spec.ts`.

- [ ] **Step 3: Read every page once as a reader** (`cat` each), checking: no "cockpit", no contractions in new prose, each `<ExampleCode>` has a sentence before it, the What-the-demo-does section describes what the Run tab actually shows (compare with the component's welcome suggestions / prompt file), and no heading promises something the example does not deliver.

- [ ] **Step 4: PR.** Push and open the PR with `gh pr create` (title `docs(langgraph): eight guides teach through their running examples`; body lists the pages, the deleted walkthroughs, the region markers added, the e2e spec, and verification; end with the Claude Code footer). Wait for the Website preview lane and spot-check two pages on the aliased preview.
