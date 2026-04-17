# Single Dev Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the remaining cockpit LangSmith dev footprint into one shared deployment, cut traffic over safely, delete the superseded deployments, and merge only after fresh verification.

**Architecture:** Build one combined LangGraph Cloud manifest that contains every still-supported cockpit backend graph, deploy it as a new shared dev deployment, then repoint all runtime URL sources to that single URL. Keep graph names stable so Angular apps and cockpit routing do not need semantic changes, and do the live cleanup only after the combined deployment passes smoke verification.

**Tech Stack:** LangGraph Cloud (LangSmith), Nx, TypeScript scripts, GitHub Actions, Vercel proxy routing, Python LangGraph graphs

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `scripts/generate-shared-deployment-config.ts` | Generate a single deployable `langgraph.json` for all active backends |
| Create | `deployments/shared-dev/langgraph.json` | Generated combined manifest used for cloud deployment |
| Modify | `cockpit/langgraph/streaming/python/langgraph.json` | Normalize graph names that should match cockpit assistant IDs |
| Modify | `.github/workflows/deploy-langgraph.yml` | Replace multi-deployment matrix with one shared deployment job |
| Modify | `deployment-urls.json` | Point all active capabilities at the new shared deployment URL |
| Modify | `scripts/update-angular-environments.ts` | Keep environment sync logic aligned with one shared URL |
| Modify | `scripts/examples-middleware.ts` | Collapse proxy routing to the single shared deployment URL |
| Modify | `AGENTS.md` | Update internal deployment guidance from 14 always-on deployments to 1 |
| Create | `scripts/verify-shared-deployment.ts` | Smoke-test representative graph IDs against the shared deployment |

---

### Task 1: Normalize graph IDs and generate the shared deployment manifest

**Files:**
- Modify: `cockpit/langgraph/streaming/python/langgraph.json`
- Create: `scripts/generate-shared-deployment-config.ts`
- Create: `deployments/shared-dev/langgraph.json`

- [ ] **Step 1: Normalize graph IDs that still do not match runtime assistant IDs**

Update `cockpit/langgraph/streaming/python/langgraph.json` so graph keys match the cockpit assistant IDs:
- `generative_ui` → `c-generative-ui`
- `a2ui_form` → `c-a2ui`

Do not change the underlying Python entrypoints unless needed; keep this a manifest-key normalization so runtime identifiers stay consistent.

- [ ] **Step 2: Write the shared deployment config generator**

Create `scripts/generate-shared-deployment-config.ts` that:
- reads the active LangGraph and deep-agents capabilities from `apps/cockpit/scripts/capability-registry.ts`
- excludes `render/*` capabilities
- includes the chat graphs already consolidated into `cockpit/langgraph/streaming/python/langgraph.json`
- writes a deterministic combined manifest to `deployments/shared-dev/langgraph.json`

The generated manifest must include all supported graph IDs:
- `streaming`, `persistence`, `interrupts`, `memory`, `durable-execution`, `subgraphs`, `time-travel`, `deployment-runtime`
- `planning`, `filesystem`, `subagents`, `da-memory`, `skills`, `sandboxes`
- `c-messages`, `c-input`, `c-debug`, `c-interrupts`, `c-theming`, `c-threads`, `c-timeline`, `c-tool-calls`, `c-subagents`, `c-generative-ui`, `c-a2ui`

- [ ] **Step 3: Run the generator and inspect the output**

Run:

```bash
npx tsx scripts/generate-shared-deployment-config.ts
```

Expected:
- `deployments/shared-dev/langgraph.json` exists
- every expected graph key is present
- paths resolve to repo files without duplicates or stale graph names

- [ ] **Step 4: Verify the generated manifest contents**

Run a targeted check:

```bash
node -e "const f=require('./deployments/shared-dev/langgraph.json'); const required=['streaming','persistence','interrupts','memory','durable-execution','subgraphs','time-travel','deployment-runtime','planning','filesystem','subagents','da-memory','skills','sandboxes','c-generative-ui','c-a2ui']; const missing=required.filter((k)=>!f.graphs[k]); if(missing.length){console.error(missing); process.exit(1)} console.log('ok', Object.keys(f.graphs).length)"
```

Expected: `ok` plus the final graph count, exit code 0.

---

### Task 2: Collapse runtime routing and deployment metadata to one URL

**Files:**
- Modify: `deployment-urls.json`
- Modify: `scripts/update-angular-environments.ts`
- Modify: `scripts/examples-middleware.ts`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update deployment URL registry shape**

Change `deployment-urls.json` so every active capability key points to the same shared deployment URL placeholder or final URL. Keep the existing keys so Angular environment generation and proxy routing remain stable.

- [ ] **Step 2: Update environment sync comments and expectations**

Adjust `scripts/update-angular-environments.ts` comments and assumptions so it is explicit that all active capabilities may legitimately resolve to the same LangGraph Cloud URL.

- [ ] **Step 3: Simplify proxy routing**

Update `scripts/examples-middleware.ts` so:
- all active product paths resolve to the shared deployment URL
- routing logic remains clear and deterministic
- the code no longer implies multiple long-lived backend URLs are expected

Keep the product-path mapping if it still helps future reversibility, but the effective backend URL should be the same.

- [ ] **Step 4: Update contributor guidance**

Revise `AGENTS.md` to state that the intended always-on LangSmith footprint is a single shared cockpit dev deployment, with chat graphs consolidated into it and render demos remaining local/static.

---

### Task 3: Replace the deployment workflow with a single shared deployment job

**Files:**
- Modify: `.github/workflows/deploy-langgraph.yml`

- [ ] **Step 1: Replace the matrix deploy with one shared deployment flow**

Refactor `.github/workflows/deploy-langgraph.yml` so it:
- generates `deployments/shared-dev/langgraph.json`
- deploys from the shared deployment directory/config instead of 14 separate python directories
- uses a single deployment name such as `cockpit-core`

Keep manual dispatch support. If a capability filter remains, document that it is no longer used for the shared deployment path unless you intentionally preserve partial regeneration behavior.

- [ ] **Step 2: Keep required secrets and environment handling valid**

Ensure the workflow still provides `OPENAI_API_KEY` and `LANGSMITH_API_KEY` to the deployment process, and that the shared deployment config points at an `env` file or equivalent runtime secret flow that still works in CI.

- [ ] **Step 3: Review workflow semantics**

Run:

```bash
sed -n '1,220p' .github/workflows/deploy-langgraph.yml
```

Expected: one deploy job, no multi-deployment matrix, comments accurately describe the single-deployment architecture.

---

### Task 4: Add shared deployment verification and perform local smoke checks

**Files:**
- Create: `scripts/verify-shared-deployment.ts`

- [ ] **Step 1: Write a shared deployment smoke verifier**

Create `scripts/verify-shared-deployment.ts` that:
- reads the shared deployment URL from `deployment-urls.json`
- checks `/ok`
- runs representative graph-level smoke tests against at least:
  - `streaming`
  - `deployment-runtime`
  - `planning`
  - `filesystem`

The verifier should fail loudly if any assistant ID cannot create a thread or stream a response.

- [ ] **Step 2: Run local structural verification**

Run:

```bash
npx tsx scripts/verify-shared-deployment.ts --dry-run
```

Expected: script validates config and required graph IDs without making live requests.

- [ ] **Step 3: Run repo-native checks for touched code**

Run:

```bash
npx nx test cockpit --skip-nx-cache
```

Expected: cockpit tests still pass after routing/config changes.

If that scope proves too broad or noisy, run the smallest relevant script/test surface and report the exact result.

---

### Task 5: Deploy, cut over, and delete superseded live deployments

**Files:**
- Modify: `deployment-urls.json` after the shared deployment URL is known

- [ ] **Step 1: Deploy the shared dev deployment**

Run the shared deployment flow with the real LangSmith API key and capture the resulting URL for `cockpit-core`.

Expected: a new single dev deployment exists in LangSmith and reaches `READY`.

- [ ] **Step 2: Update the registry with the real shared URL**

Replace placeholders in `deployment-urls.json` so every active key points at the new shared deployment URL.

- [ ] **Step 3: Run live smoke verification**

Run:

```bash
npx tsx scripts/verify-shared-deployment.ts
```

Expected: all representative graph checks pass against the live shared deployment.

- [ ] **Step 4: Delete the superseded live deployments**

Delete the old active dev deployments only after the live smoke verifier passes:
- `streaming`, `persistence`, `interrupts`, `memory`, `durable-execution`, `subgraphs`, `time-travel`, `deployment-runtime`
- `planning`, `filesystem`, `da-subagents`, `da-memory`, `skills`, `sandboxes`

- [ ] **Step 5: Re-query live inventory**

Run a direct deployment inventory query and confirm exactly one relevant shared cockpit dev deployment remains.

---

### Task 6: Review, PR, and merge on green

**Files:**
- No new files required; this task verifies and publishes the branch

- [ ] **Step 1: Run final verification**

Run the full set of commands actually needed to support the completion claim:

```bash
git diff --check
npx tsx scripts/generate-shared-deployment-config.ts
node -e "const f=require('./deployments/shared-dev/langgraph.json'); console.log(Object.keys(f.graphs).sort().join('\n'))"
npx tsx scripts/verify-shared-deployment.ts
```

Add any repo-native tests that were changed or touched during implementation.

- [ ] **Step 2: Request code review**

Request review against the branch diff after implementation and address any important findings before opening the PR.

- [ ] **Step 3: Open PR**

Create a PR describing:
- move from 14 active dev deployments to 1 shared deployment
- runtime routing cutover
- deletion of superseded deployments
- verification evidence

- [ ] **Step 4: Merge only after green**

Merge only after required checks are green and the PR branch reflects the verified state.
