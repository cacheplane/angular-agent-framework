# Deploy Chat & Render Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy all 17 chat/render Python backends to LangGraph Cloud and wire proxy routing so Angular examples work at examples.cacheplane.ai.

**Architecture:** Add CI matrix entries to trigger LangGraph Cloud deployments, add proxy routing in the serverless middleware, and extend production smoke tests to verify chat/render examples load. Deploy names use `c-` prefix for chat and `r-` prefix for render to avoid collisions with existing LangGraph/Deep Agents names.

**Tech Stack:** LangGraph Cloud, Vercel Serverless Functions, Playwright, GitHub Actions

---

## Reference: All 17 Backends

| Product | Topic | Deploy Name | Graph Name (langgraph.json) | Path |
|---------|-------|-------------|----------------------------|------|
| chat | a2ui | c-a2ui | c-a2ui | cockpit/chat/a2ui/python |
| chat | debug | c-debug | c-debug | cockpit/chat/debug/python |
| chat | generative-ui | c-generative-ui | generative_ui | cockpit/chat/generative-ui/python |
| chat | input | c-input | c-input | cockpit/chat/input/python |
| chat | interrupts | c-interrupts | c-interrupts | cockpit/chat/interrupts/python |
| chat | messages | c-messages | c-messages | cockpit/chat/messages/python |
| chat | subagents | c-subagents | c-subagents | cockpit/chat/subagents/python |
| chat | theming | c-theming | c-theming | cockpit/chat/theming/python |
| chat | threads | c-threads | c-threads | cockpit/chat/threads/python |
| chat | timeline | c-timeline | c-timeline | cockpit/chat/timeline/python |
| chat | tool-calls | c-tool-calls | c-tool-calls | cockpit/chat/tool-calls/python |
| render | computed-functions | r-computed-functions | computed-functions | cockpit/render/computed-functions/python |
| render | element-rendering | r-element-rendering | element-rendering | cockpit/render/element-rendering/python |
| render | registry | r-registry | registry | cockpit/render/registry/python |
| render | repeat-loops | r-repeat-loops | repeat-loops | cockpit/render/repeat-loops/python |
| render | spec-rendering | r-spec-rendering | spec-rendering | cockpit/render/spec-rendering/python |
| render | state-management | r-state-management | state-management | cockpit/render/state-management/python |

---

### Task 1: Add Chat/Render Backends to CI Deploy Matrix

**Files:**
- Modify: `.github/workflows/deploy-langgraph.yml:21-49`

- [ ] **Step 1: Add 17 matrix entries after line 49 (sandboxes entry)**

After the existing sandboxes entry, add these entries to the `matrix.include` array:

```yaml
          # Chat capabilities
          - name: c-a2ui
            path: cockpit/chat/a2ui/python
          - name: c-debug
            path: cockpit/chat/debug/python
          - name: c-generative-ui
            path: cockpit/chat/generative-ui/python
          - name: c-input
            path: cockpit/chat/input/python
          - name: c-interrupts
            path: cockpit/chat/interrupts/python
          - name: c-messages
            path: cockpit/chat/messages/python
          - name: c-subagents
            path: cockpit/chat/subagents/python
          - name: c-theming
            path: cockpit/chat/theming/python
          - name: c-threads
            path: cockpit/chat/threads/python
          - name: c-timeline
            path: cockpit/chat/timeline/python
          - name: c-tool-calls
            path: cockpit/chat/tool-calls/python
          # Render capabilities
          - name: r-computed-functions
            path: cockpit/render/computed-functions/python
          - name: r-element-rendering
            path: cockpit/render/element-rendering/python
          - name: r-registry
            path: cockpit/render/registry/python
          - name: r-repeat-loops
            path: cockpit/render/repeat-loops/python
          - name: r-spec-rendering
            path: cockpit/render/spec-rendering/python
          - name: r-state-management
            path: cockpit/render/state-management/python
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-langgraph.yml'))"`

Expected: No error output

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-langgraph.yml
git commit -m "ci: add 17 chat/render backends to LangGraph deploy matrix"
```

---

### Task 2: Add Deployment URLs (Pending)

**Files:**
- Modify: `deployment-urls.json`

- [ ] **Step 1: Add 17 entries with PENDING_DEPLOYMENT placeholder**

The `verify-langgraph-deployments.ts` script already skips entries with value `"PENDING_DEPLOYMENT"`. Add all 17 entries after the existing `sandboxes` entry:

```json
{
  "streaming": "https://streaming-b01895ee8c8d5211967fba7a64c55db8.us.langgraph.app",
  "persistence": "https://persistence-b4038c008b5e537787dda6a6774c8f91.us.langgraph.app",
  "interrupts": "https://interrupts-8e1524d6d8fb558381eed4618129bc50.us.langgraph.app",
  "memory": "https://memory-1b3234dbe2e55ba59010b3469be45a0a.us.langgraph.app",
  "durable-execution": "https://durable-execution-123221d8b543545399d252dc6bd7de1b.us.langgraph.app",
  "subgraphs": "https://subgraphs-c923bcb068c458b09d789f147875f426.us.langgraph.app",
  "time-travel": "https://time-travel-f206148d75f45e75bf30002e68e1b14d.us.langgraph.app",
  "deployment-runtime": "https://deployment-runtime-ce6aad33cc10505faca2b6137e76ba35.us.langgraph.app",
  "planning": "https://planning-7ca04c65ce7650048ec0d16fb96a7638.us.langgraph.app",
  "filesystem": "https://filesystem-2330285f57625bff8654bc026f70a6ae.us.langgraph.app",
  "subagents": "https://da-subagents-31e4639441165df7848aaad426e61728.us.langgraph.app",
  "da-memory": "https://da-memory-15f767adfa6f5cd48bd45a0fa4db29b5.us.langgraph.app",
  "skills": "https://skills-802ff50f64325f1ea973cff1c97a49f9.us.langgraph.app",
  "sandboxes": "https://sandboxes-8c70b6ac20265827aa92397299fcb9f7.us.langgraph.app",
  "c-a2ui": "PENDING_DEPLOYMENT",
  "c-debug": "PENDING_DEPLOYMENT",
  "c-generative-ui": "PENDING_DEPLOYMENT",
  "c-input": "PENDING_DEPLOYMENT",
  "c-interrupts": "PENDING_DEPLOYMENT",
  "c-messages": "PENDING_DEPLOYMENT",
  "c-subagents": "PENDING_DEPLOYMENT",
  "c-theming": "PENDING_DEPLOYMENT",
  "c-threads": "PENDING_DEPLOYMENT",
  "c-timeline": "PENDING_DEPLOYMENT",
  "c-tool-calls": "PENDING_DEPLOYMENT",
  "r-computed-functions": "PENDING_DEPLOYMENT",
  "r-element-rendering": "PENDING_DEPLOYMENT",
  "r-registry": "PENDING_DEPLOYMENT",
  "r-repeat-loops": "PENDING_DEPLOYMENT",
  "r-spec-rendering": "PENDING_DEPLOYMENT",
  "r-state-management": "PENDING_DEPLOYMENT"
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('deployment-urls.json'))"`

Expected: No error output

- [ ] **Step 3: Run verify script to confirm pending entries are skipped**

Run: `npx tsx scripts/verify-langgraph-deployments.ts 2>&1 | tail -5`

Expected: `14 passed, 0 failed out of 31` with 17 entries showing `⏭️ ... skipped (pending deployment)`

- [ ] **Step 4: Commit**

```bash
git add deployment-urls.json
git commit -m "chore: add 17 chat/render deployment URL placeholders"
```

---

### Task 3: Add Proxy Routing for Chat/Render Examples

**Files:**
- Modify: `scripts/examples-middleware.ts:12-44`

- [ ] **Step 1: Add 17 entries to DEPLOYMENT_URLS (after line 27)**

After the `sandboxes` entry in the `DEPLOYMENT_URLS` object, add:

```typescript
  // Chat capabilities (URLs updated after first deployment)
  'c-a2ui': 'PENDING_DEPLOYMENT',
  'c-debug': 'PENDING_DEPLOYMENT',
  'c-generative-ui': 'PENDING_DEPLOYMENT',
  'c-input': 'PENDING_DEPLOYMENT',
  'c-interrupts': 'PENDING_DEPLOYMENT',
  'c-messages': 'PENDING_DEPLOYMENT',
  'c-subagents': 'PENDING_DEPLOYMENT',
  'c-theming': 'PENDING_DEPLOYMENT',
  'c-threads': 'PENDING_DEPLOYMENT',
  'c-timeline': 'PENDING_DEPLOYMENT',
  'c-tool-calls': 'PENDING_DEPLOYMENT',
  // Render capabilities
  'r-computed-functions': 'PENDING_DEPLOYMENT',
  'r-element-rendering': 'PENDING_DEPLOYMENT',
  'r-registry': 'PENDING_DEPLOYMENT',
  'r-repeat-loops': 'PENDING_DEPLOYMENT',
  'r-spec-rendering': 'PENDING_DEPLOYMENT',
  'r-state-management': 'PENDING_DEPLOYMENT',
```

- [ ] **Step 2: Add 17 entries to PATH_TO_KEY (after line 44)**

After the `deep-agents/sandboxes` entry in the `PATH_TO_KEY` object, add:

```typescript
  // Chat capabilities
  'chat/a2ui': 'c-a2ui',
  'chat/debug': 'c-debug',
  'chat/generative-ui': 'c-generative-ui',
  'chat/input': 'c-input',
  'chat/interrupts': 'c-interrupts',
  'chat/messages': 'c-messages',
  'chat/subagents': 'c-subagents',
  'chat/theming': 'c-theming',
  'chat/threads': 'c-threads',
  'chat/timeline': 'c-timeline',
  'chat/tool-calls': 'c-tool-calls',
  // Render capabilities
  'render/computed-functions': 'r-computed-functions',
  'render/element-rendering': 'r-element-rendering',
  'render/registry': 'r-registry',
  'render/repeat-loops': 'r-repeat-loops',
  'render/spec-rendering': 'r-spec-rendering',
  'render/state-management': 'r-state-management',
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit scripts/examples-middleware.ts 2>&1 || echo "Note: standalone TS check may show module errors — that's fine, the esbuild step handles it"`

The real validation is that `npx esbuild scripts/examples-middleware.ts --bundle --format=cjs --platform=node` succeeds (tested during assemble-examples). Run:

`npx esbuild scripts/examples-middleware.ts --bundle --format=cjs --platform=node --outfile=/tmp/test-middleware.js 2>&1`

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add scripts/examples-middleware.ts
git commit -m "feat: add proxy routing for 17 chat/render examples"
```

---

### Task 4: Add Chat/Render Examples to Production Smoke Test

**Files:**
- Modify: `apps/cockpit/e2e/production-smoke.spec.ts:19-34`

- [ ] **Step 1: Add chat capabilities to CAPABILITIES array**

After `'deep-agents/sandboxes'` (line 33), add:

```typescript
  'chat/messages',
  'chat/input',
  'chat/interrupts',
  'chat/tool-calls',
  'chat/subagents',
  'chat/threads',
  'chat/timeline',
  'chat/generative-ui',
  'chat/debug',
  'chat/theming',
  'chat/a2ui',
```

- [ ] **Step 2: Add render capabilities with separate test block**

Render examples don't use the `<chat>` component — they render demo components directly. Add a new constant and test block after the `CAPABILITIES` array (after line 34):

```typescript
const RENDER_CAPABILITIES = [
  'render/spec-rendering',
  'render/element-rendering',
  'render/state-management',
  'render/registry',
  'render/repeat-loops',
  'render/computed-functions',
] as const;
```

Then after the existing `test.describe('Production: Angular example apps load', ...)` block (after line 44), add:

```typescript
test.describe('Production: Render example apps load', () => {
  for (const cap of RENDER_CAPABILITIES) {
    test(`${cap} loads at examples URL`, async ({ page }) => {
      const url = `${EXAMPLES_URL}/${cap}/`;
      const res = await page.goto(url, { timeout: 15000 });
      expect(res?.status()).toBe(200);
    });
  }
});
```

- [ ] **Step 3: Add A2UI to the send/receive smoke test**

In the `for` loop on line 60, add `'chat/a2ui'` to the test array:

```typescript
  for (const cap of ['langgraph/streaming', 'deep-agents/planning', 'chat/a2ui'] as const) {
```

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/e2e/production-smoke.spec.ts
git commit -m "test: add 17 chat/render examples to production smoke tests"
```

---

### Task 5: Trigger Initial Deployments and Capture URLs

This task is manual — it requires running the deploy workflow and capturing URLs.

- [ ] **Step 1: Push branch and trigger workflow dispatch**

Push the branch, then trigger the deploy workflow manually via GitHub Actions UI or CLI:

```bash
gh workflow run deploy-langgraph.yml --ref fix/deploy-chat-render-examples
```

- [ ] **Step 2: Wait for all 31 deployments to complete**

Monitor: `gh run list --workflow=deploy-langgraph.yml --limit 1`

- [ ] **Step 3: Capture deployment URLs**

For each new deployment, get the URL from LangGraph Cloud. The URL format is:
`https://{name}-{hash}.us.langgraph.app`

Update `deployment-urls.json` replacing each `"PENDING_DEPLOYMENT"` with the actual URL.

- [ ] **Step 4: Update examples-middleware.ts**

Replace each `'PENDING_DEPLOYMENT'` in `DEPLOYMENT_URLS` with the actual URL from step 3.

- [ ] **Step 5: Verify all deployments are healthy**

Run: `npx tsx scripts/verify-langgraph-deployments.ts`

Expected: `31 passed, 0 failed out of 31`

- [ ] **Step 6: Commit**

```bash
git add deployment-urls.json scripts/examples-middleware.ts
git commit -m "chore: add deployment URLs for 17 chat/render backends"
```

---

### Task 6: Verify A2UI Example End-to-End

- [ ] **Step 1: Run assemble-examples to rebuild deploy directory**

Run: `npx tsx scripts/assemble-examples.ts`

Expected: All 31 examples assembled successfully, including `chat/a2ui`

- [ ] **Step 2: Run the cockpit build**

Run: `npx nx build cockpit --skip-nx-cache`

Expected: Build succeeds

- [ ] **Step 3: Run chat and a2ui lib tests**

Run: `npx nx run-many -t test --projects=chat,a2ui --skip-nx-cache`

Expected: All tests pass

- [ ] **Step 4: Commit any remaining changes and verify clean tree**

Run: `git status`

Expected: Clean working tree
