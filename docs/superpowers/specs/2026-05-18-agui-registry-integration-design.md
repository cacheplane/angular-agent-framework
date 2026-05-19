# ag-ui demo capability-registry integration — design

> **Place in the larger plan.** Thread A of Task #2 (rename + structural-consistency sweep). Threads B + C already landed via PR #449 (cap prefix unification). The remaining outlier: `cockpit/ag-ui/streaming/angular/` exists as a real cockpit demo but isn't in `apps/cockpit/scripts/capability-registry.ts` — it doesn't fit the registry's current shape (requires `pythonDir`/`graphName`; ag-ui has no Python backend, uses FakeAgent in-process).

## Goal

Make the existing ag-ui streaming demo discoverable through `apps/cockpit/scripts/capability-registry.ts` alongside langgraph/deep-agents/render/chat caps. Schema accommodates no-Python caps; downstream scripts skip Python work when those fields are absent.

## Non-goals

- Adding new ag-ui caps beyond the existing `streaming` demo.
- Adding aimock e2e coverage for ag-ui (separate sub-project under Task #4).
- Cockpit Next.js nav surfacing if it requires manual config beyond auto-render from the registry — flagged as follow-up if discovered.
- Replacing the `FakeAgent` with a real backend.
- Production deploy changes (ag-ui has no LangSmith assistant — out of the shared-dev manifest entirely).

## Schema change

`apps/cockpit/scripts/capability-registry.ts`:

```typescript
export interface Capability {
  id: string;
  product: 'langgraph' | 'deep-agents' | 'render' | 'chat' | 'ag-ui';  // +ag-ui
  topic: string;
  angularProject: string;
  port: number;
  pythonPort?: number;
  pythonDir?: string;   // now optional — ag-ui has none
  graphName?: string;   // now optional — ag-ui has none
}
```

## New registry entry

Append at the end of the `capabilities` array:

```typescript
// AG-UI capabilities (in-process FakeAgent; no Python backend, not deployed to LangSmith)
{ id: 'ag-ui-streaming', product: 'ag-ui', topic: 'streaming', angularProject: 'cockpit-ag-ui-streaming-angular', port: 4600 },
```

Port 4600 picks a new range above chat's 4500s — leaves room for future ag-ui caps.

## Consumer guards

**1. `scripts/generate-shared-deployment-config.ts`**

Add an early skip in the per-cap loop:

```typescript
for (const capability of capabilities) {
  if (!capability.pythonDir) {
    continue; // ag-ui (in-process) and other no-Python caps
  }
  const manifestPath = resolve(rootDir, capability.pythonDir, 'langgraph.json');
  ...
}
```

ag-ui contributes zero graphs to the shared-deploy manifest — correct, since there's no backend to deploy.

**2. `apps/cockpit/cockpit-e2e-wiring.spec.ts`**

The test cross-checks each cap's registry entry against its e2e global-setup config. Currently reads `capability.pythonDir` + `capability.pythonPort` unconditionally. Guard:

```typescript
if (capability.pythonDir !== undefined) {
  if (capability.pythonDir !== wiring.langgraphCwd) {
    errors.push(`${wiring.project}: registry pythonDir ${capability.pythonDir} != global setup langgraphCwd ${wiring.langgraphCwd}`);
  }
}
```

(Same shape for `pythonPort` — it's already wrapped in `!== undefined`.)

ag-ui doesn't have an e2e harness yet, so it won't be in the `wiring` set to begin with — the loop just skips it. The guard is defensive.

## What's untouched

- CI scope classifier (`scripts/ci-scope.mjs`) iterates projects by `project.json` existence — already handles ag-ui correctly today.
- ag-ui's `project.json`, `src/`, env files — all already correct on main.
- Cockpit Next.js sidebar nav — if it auto-pulls from the capability registry, ag-ui appears automatically. If not, that's follow-up scope (out of this PR).
- Per-cap `langgraph.json` — N/A for ag-ui.
- Shared-deploy manifest — stays at 32 graphs (ag-ui adds none).

## Verification

### Local

1. `npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck` clean.
2. `npx tsc --noEmit scripts/generate-shared-deployment-config.ts --skipLibCheck` clean (after the new skip).
3. `npx tsc --noEmit apps/cockpit/cockpit-e2e-wiring.spec.ts --skipLibCheck` clean (after the guard).
4. `npx tsx scripts/generate-shared-deployment-config.ts` succeeds, generated manifest still has **32 graphs** (unchanged).
5. `npx nx test cockpit-e2e-wiring --skip-nx-cache` passes (or whatever the spec's nx target is — verify during implementation; if no dedicated target, run via Playwright config directly).
6. `npx nx build cockpit-ag-ui-streaming-angular --skip-nx-cache` succeeds (unchanged build).
7. **Manual spot-check:** `npx nx serve cockpit-ag-ui-streaming-angular --port 4600` boots; navigating to `http://localhost:4600` shows the AG-UI streaming demo (FakeAgent emits canned events).
8. 4 cockpit aimock e2es (streaming, tool-calls, subagents, c-interrupts) still pass — regression sanity.

### Cockpit nav surfacing (open question)

If the cockpit Next.js app auto-renders nav from `capabilities`, ag-ui appears in the nav alongside the others after this PR. If the nav requires per-cap manual additions (e.g., a hand-maintained sidebar config), this PR is silent on the nav surfacing — that's a follow-up.

Implementation will look at `apps/cockpit/src/components/sidebar/navigation-groups.ts` (or equivalent) and either confirm auto-surfacing or flag the manual edit as a 1-line addition.

## Risk surface

- **Schema typing ripple.** Making `pythonDir` optional changes the TS type. Repo-wide grep at pre-flight catches any unguarded consumer beyond the 2 known.
- **Port 4600 collision.** Verify nothing else binds 4600 today (`lsof -i :4600`); register the new range.
- **Cockpit nav assumption.** If nav doesn't auto-pull, the registry has ag-ui but users still don't see it in the cockpit app. Acceptable; flagged in the PR description for a polish follow-up.
- **No production deploy impact.** ag-ui doesn't deploy to LangSmith. Deploy LangGraph workflow output unchanged.

## Acceptance criteria

- `Capability` interface has `pythonDir?: string`, `graphName?: string`, and `product: ... | 'ag-ui'`.
- New `ag-ui-streaming` entry registered.
- `scripts/generate-shared-deployment-config.ts` has the `!capability.pythonDir` skip; generated manifest still 32 graphs.
- `apps/cockpit/cockpit-e2e-wiring.spec.ts` has the `pythonDir !== undefined` guard.
- `nx build cockpit-ag-ui-streaming-angular` succeeds.
- `nx serve cockpit-ag-ui-streaming-angular --port 4600` boots; demo loads.
- 4 cockpit aimock e2es pass.
- Repo-wide grep finds no other unguarded `capability.pythonDir` / `capability.graphName` consumers.
