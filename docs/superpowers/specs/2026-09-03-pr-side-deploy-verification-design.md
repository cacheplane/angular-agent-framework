# PR-side deploy verification — design

**Date:** 2026-09-03
**Status:** approved

## Problem

Landing #963 took nine fix PRs (#967, #970, #973, #974, #981, #982, #983,
#984, #987). Every one of them repaired a step that only the push-to-main
`deploy` job executes: promoting to Vercel, verifying the promoted Website
against production, building and smoking the cockpit redirect artifact.
PR CI cannot reach those steps, so each failure was discovered after merge,
one at a time, with production stalled in between. The Website did not
promote for two days.

Two failure classes account for all nine:

1. **Remote-target assumptions.** Tests and scripts that pass against local
   servers but not against a deployed origin: local fixture ports, a
   `localhost` route abort, a spec that never loaded under CJS.
2. **Platform behaviour.** Things only a real Vercel deployment exhibits:
   team scope on `promote`, deployment protection on unaliased artifacts, the
   CDN's consecutive-slash collapse, a missing preview-environment variable.

## Goal

Run the same verification the deploy job runs, on pull requests, against
real Vercel preview deployments, with full runtime parity so the Website's
embedded runtime handshake is exercised too.

## Non-goals

- Fork pull requests. Both lanes need repository secrets and skip on forks.
- Deleting stale preview deployments when a PR closes.
- Replacing the post-promotion verification on main. It stays; the PR lanes
  are additional.

## Facts the design rests on

- The Website Vercel project is git-linked, but its automatic previews are
  built by Vercel with the preview environment and embed the production
  examples. The examples' `frame-ancestors` policy and the runtime bridge's
  parent-origin allowlist contain only production origins plus the single
  preview origin the deploy job registers when it assembles the examples.
  The allowlist validator rejects wildcards by design. A git-integration
  preview therefore cannot host a working runtime frame. Measured against a
  main-equivalent artifact whose origin had rotated out of the allowlist:
  86 passed, 1 failed, 20 did not run (the workspace-shell file is serial).
- Any Vercel deployment, including a preview, can be aliased to an arbitrary
  unused `<name>.vercel.app` name through the CLI or the aliases API. Aliases
  inherit deployment protection.
- Deployment protection answers every path on a protected deployment with
  `302 -> vercel.com/sso-api`. Protection Bypass for Automation secrets are
  issued per project. The Website and cockpit projects have one each; the
  examples project has none.
- Playwright's `extraHTTPHeaders` is global to the browser context. A page
  that embeds an iframe from a second protected project needs a second
  secret sent only to that origin.
- Probed 2026-09-03 against a protected cockpit deployment: a request that
  carries a valid `_vercel_jwt` cookie for that origin **and** an
  `x-vercel-protection-bypass` header holding a different project's secret is
  served (308 from the app); the wrong header alone is refused (302 to SSO).
  So the Website secret riding the global header does not break the cookie
  seeded for the examples origin.
- `resolveRuntimeUrl` in `libs/cockpit-shell` reads
  `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` at build time, defaulting to
  `https://examples.threadplane.ai`.
- `scripts/assemble-examples.ts` reads `RUNTIME_PARENT_PREVIEW_ORIGINS` and
  bakes those origins into the examples' CSP and bridge allowlist.
- Deploy-job step timings from run 33777374419: Website build + deploy
  2m05s, examples assembly 8m00s, examples deploy 18s, Website suite 1m13s,
  cockpit build 1m04s, cockpit deploy 13s, cockpit smoke 27s.

## Design

### Deterministic aliases

Each lane run derives two alias names from the event:

| event | Website alias | examples alias |
| --- | --- | --- |
| `pull_request` #N | `threadplane-pr-N-cacheplane.vercel.app` | `threadplane-examples-pr-N-cacheplane.vercel.app` |
| `merge_group` | `threadplane-mq-<sha8>-cacheplane.vercel.app` | `threadplane-examples-mq-<sha8>-cacheplane.vercel.app` |

Because both names are known before anything is built, the examples can be
assembled with the Website alias in their parent-origin policy and the
Website can be built with the examples alias as its runtime base, in either
order. A later push to the same PR re-points both aliases at the new
deployments.

### Job: `website-preview-e2e` ("Website — e2e (deployed preview)")

- `needs: ci-scope`; runs when `github.event_name == 'push'` is false and
  the `website_e2e` scope is true, and only for same-repo pull requests or
  merge-group candidates.
- Steps:
  1. `npm ci`, install Chromium.
  2. Assemble the examples with `RUNTIME_PARENT_PREVIEW_ORIGINS` set to
     `https://<website alias>`.
  3. In `deploy/examples`: write `.vercel/project.json` for the examples
     project, `vercel pull --environment=preview`,
     `vercel deploy --prebuilt --yes` (no `--prod`), capture the URL,
     `vercel alias set <url> <examples alias>`.
  4. At the repo root: write `.vercel/project.json` for the Website project,
     `vercel pull --environment=preview`, `vercel build` (no `--prod`) with
     `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL=https://<examples alias>` and
     `GROWTH_FORM_POLICY=growth_v1`, `vercel deploy --prebuilt --archive=tgz
     --skip-domain --yes` (no `--prod`), capture the URL,
     `vercel alias set <url> <website alias>`.
  5. Guard: fail with a provisioning message if either
     `VERCEL_AUTOMATION_BYPASS_SECRET` or
     `VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET` is empty.
  6. `BASE_URL=https://<website alias> npx nx e2e website --skip-nx-cache`
     with both bypass secrets and
     `RUNTIME_BYPASS_ORIGIN=https://<examples alias>` in the environment.
- Every `vercel` call passes `--token` and, for `alias`, `--scope` (alias
  takes bare URLs, like `promote`).

### Playwright config: per-origin bypass

`createWebsitePlaywrightConfig` keeps `extraHTTPHeaders` for the Website
secret. When `VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET` and
`RUNTIME_BYPASS_ORIGIN` are both set, the config also registers a
`globalSetup` script and points `use.storageState` at a file the script
writes. The script requests
`${RUNTIME_BYPASS_ORIGIN}/?x-vercel-protection-bypass=<examples secret>&x-vercel-set-bypass-cookie=true`
with a Playwright request context, which makes Vercel answer with the
`_vercel_jwt` bypass cookie scoped to that origin, and saves the resulting
cookies as storage state. Every browser context then carries the examples
cookie, so the runtime iframe and its subresources load without any spec
importing a custom fixture. The examples secret travels only in that one
setup request; the Website secret keeps travelling only as the global
header. Nothing changes for local runs, production smoke, or the
post-promotion run, where the two variables are unset.

The existing config unit test file gains cases for: `globalSetup` and
`storageState` are set only when both variables are set; the storage-state
path lives under the scratch output directory, never in the repo; the
examples secret never appears in `extraHTTPHeaders`.

### Job: `cockpit-preview-smoke` ("Cockpit — immutable preview smoke")

- `needs: ci-scope`; same event and same-repo guards; runs when the
  `cockpit_deploy_smoke` scope is true.
- Steps: `npm ci`; write `.vercel/project.json` for the cockpit project;
  `vercel pull --environment=preview`; `vercel build --local-config
  vercel.cockpit.json` with `COCKPIT_WEBSITE_ORIGIN=https://threadplane.ai`
  (no `--prod`); `vercel deploy --prebuilt --archive=tgz --skip-domain --yes
  --env COCKPIT_WEBSITE_ORIGIN=https://threadplane.ai` (no `--prod`); guard
  on `VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET`; run
  `apps/cockpit/scripts/deploy-smoke.ts --mode preview --retries 20
  --retry-delay-ms 5000` against the captured URL.
- No alias is needed; the smoke takes the bare deployment URL.
- The token-free `cockpit-deploy-smoke` dry-run job stays unchanged so forks
  keep a check.

### Required gate

Both jobs are added to `required-pr-checks.needs` and to its `RESULT_*` env.
`require_scoped` demands `success` for any in-scope job, and the scope keys
are computed from changed files alone, so on a fork PR the lanes can be in
scope yet legitimately skipped. A wrapper `require_preview` therefore
applies the scoped rule only when `PREVIEW_LANES_ELIGIBLE` (the same
same-repo-or-merge-queue expression the jobs use) is true, and otherwise
treats the lane as unselected, where only a real failure or cancellation is
an error. The wrapper is used for the `website_e2e` and
`cockpit_deploy_smoke` entries.

### Provisioning

- Generate Protection Bypass for Automation on the `threadplane-examples`
  Vercel project (`PATCH /v1/projects/{id}/protection-bypass` with
  `{"generate":{}}`) and store the value as the repository secret
  `VERCEL_EXAMPLES_AUTOMATION_BYPASS_SECRET`.
- Secrets are resolved when a workflow run is created; a run that started
  before the secret existed must be re-run.

### Workflow guards (`scripts/ci-workflow.spec.mjs`)

- Both new jobs exist, are scope-gated, and carry the same-repo guard.
- Neither preview deploy passes `--prod`; neither job contains
  `vercel promote`.
- Both alias names are derived from the event and used consistently in the
  assembly env, the build env, and the `alias set` calls.
- Each bypass secret is wired only to its own project's step.
- The required gate needs and aggregates both jobs.

## Error handling

- Missing secret: fail immediately with a message naming the secret and the
  Vercel project, before any deployment is created.
- Alias collision or alias failure: fail the job; the deployment URL is
  printed so the failure can be inspected.
- Vercel deploy failure: the step fails on the CLI's exit code; nothing is
  aliased.
- Suite or smoke failure: reported as usual; the aliases keep pointing at
  the deployments under test for inspection.

## Testing

- Unit: Playwright config cases above; workflow guard cases above.
- Integration: open a PR that touches only `apps/website/e2e` and confirm
  the Website lane reaches Ready in the runtime handshake tests; open a PR
  that touches only `apps/cockpit` and confirm the cockpit lane runs the
  399-probe smoke. Then, as a mutation check, temporarily reintroduce the
  `localhost:4300` route abort from #983 on a branch and confirm the Website
  lane goes red.

## Cost

Roughly 12 to 14 minutes of wall clock per PR run of the Website lane,
dominated by examples assembly, in parallel with existing lanes. About 3
minutes for the cockpit lane. Three Vercel deployments per Website-lane run,
one per cockpit-lane run.
