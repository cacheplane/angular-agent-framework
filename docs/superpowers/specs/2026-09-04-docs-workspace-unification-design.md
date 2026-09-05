# Docs and workspace unification — design

**Date:** 2026-09-04
**Status:** approved

## Problem

The 2026-09 control-plane program folded the standalone Cockpit into the
Website: every docs page now renders through one workspace shell with Docs,
Run, Code, and API modes, and all 41 capability topics have a live runtime.
Three things still keep the surface from reading as one:

1. **Two route families.** Six topics whose docs page is shared with a
   sibling capability have no docs page of their own and live only at
   `/workspace/<product>/<topic>`: `langgraph/durable-execution`,
   `ag-ui/client-tools`, `ag-ui/tool-views`, `ag-ui/json-render`,
   `ag-ui/subagents`, and `render/repeat-loops`. The pairing is encoded in
   `PRIMARY_CAPABILITY_BY_DOCS_PATH` in
   `libs/cockpit-registry/src/lib/workspace-resolution.ts` and in the
   `/workspace/[product]/[topic]` route.
2. **"Cockpit" on the surface.** The sidebar's aria-label reads "Cockpit
   navigation"; about 25 `data-cockpit-*` hooks and `.cockpit-*` classes
   drive styling and tests; a screenshot asset is named `cockpit-run.webp`;
   two prose mentions in blog and docs use the word as a product name.
3. **A redirect service that only exists to serve a retired host.**
   `apps/cockpit` is a 308 table for 47 legacy paths with its own Vercel
   project (`threadplane-cockpit`, domains `cockpit.threadplane.ai` and
   `cockpit-smoky.vercel.app`, 100+ deployments), a bypass secret, three CI
   jobs, cockpit steps inside the deploy job, a 544-line smoke script, and
   a `legacyPath` field on every manifest entry. The examples proxies still
   trust the retired host in their CORS allowlists. Three libraries
   (`cockpit-docs`, `cockpit-testing`, `cockpit-ui`) are empty scaffolds
   with no consumer.

The owner has decided that legacy redirects and inbound links to the old
host no longer matter.

## Goal

One route family under `/docs`, a surface that never says "cockpit", and no
infrastructure whose only purpose is the retired host.

## Non-goals

- Renaming internal packages (`@threadplane/cockpit-*`, `workspace-react`),
  Nx project names, the `cockpit/` example directories, or the `cockpit_*`
  CI scope keys and job ids. The word stays in identifiers.
- Building the approved-but-unbuilt "workspace control plane v2" spec.
- Any change to `examples.threadplane.ai`, the assembled Angular examples,
  or the runtime bridge. They are the Run-mode runtime, not cockpit
  leftovers.
- Writing new long-form guides for the six consolidated topics. Their pages
  start as short framing plus the narrative docs the examples already ship.

## Facts the design rests on

- The docs route (`apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`)
  requires a registered `DocsPage` in `apps/website/src/lib/docs-config.ts`
  and an MDX file under `apps/website/content/docs/<library>/<section>/`;
  a missing doc is a 404.
- Every workspace page, docs-backed or not, renders `WebsiteWorkspace` with
  a content bundle from `libs/cockpit-shell/src/lib/workspace-content.ts`
  that already carries `narrativeDocs` read from the descriptor's
  `docsAssetPaths`. The six workspace-only topics all have those.
- `libs/cockpit-registry/src/lib/docs-links.ts` maps each topic to its docs
  path; `COCKPIT_TOPICS_WITHOUT_DOCS` is empty. Making the six mappings
  unique removes every shared docs path, which is the only reason the
  primary-capability override and the `/workspace` route exist.
- `apps/cockpit/scripts/capability-registry.ts` is the single source of
  truth for the 41 assembled examples and is imported by
  `scripts/assemble-examples.ts`, `scripts/generate-ag-ui-deployment-config.ts`,
  two CI path filters, and two guard specs. `serve-example.ts`,
  `generate-combined-langgraph.ts`, and `runtime-wiring-audit.ts` (with its
  two specs) are developer tooling that happens to live in `apps/cockpit`.
- `resolveLegacyPath`, `getLegacyWebsiteRedirect`,
  `resolveLegacyRequestMode`, and the manifest's `legacyPath` field are
  consumed only by `apps/cockpit`, its smoke script, and their tests; the
  Website references `legacyPath` only in specs and in the production smoke.
- `scripts/ag-ui-proxy.ts:54` and `scripts/examples-middleware.ts:18` list
  `https://cockpit.threadplane.ai` in `ALLOWED_ORIGINS`.
- `threadplane.ai` DNS is hosted on Vercel; the `cockpit` record lives in
  that zone. The `threadplane-cockpit` project holds env vars nothing else
  uses.
- `apps/website/src/lib/cockpit-retirement.spec.ts` scans the Website tree
  for the retired host string and pins one blog alt text; it does not
  check the bare word.

## Design

### Part A — one route family

For each of the six topics, add a `DocsPage` and an MDX file:

| topic | new docs path |
| --- | --- |
| `langgraph/durable-execution` | `/docs/langgraph/guides/durable-execution` |
| `ag-ui/client-tools` | `/docs/ag-ui/guides/client-tools` |
| `ag-ui/tool-views` | `/docs/ag-ui/guides/tool-views` |
| `ag-ui/json-render` | `/docs/ag-ui/guides/json-render` |
| `ag-ui/subagents` | `/docs/ag-ui/guides/subagents` |
| `render/repeat-loops` | `/docs/render/guides/repeat-loops` |

Each MDX page carries frontmatter in the house shape, a one-paragraph
framing of the capability, a pointer to the sibling guide it used to share,
and nothing that duplicates the narrative docs the bundle renders. All
three target sections (`langgraph/guides`, `ag-ui/guides`, `render/guides`)
already exist in `docs-config.ts`; the pages are appended to them.

Registry changes: `docs-links.ts` maps the six topics to the new paths;
`PRIMARY_CAPABILITY_BY_DOCS_PATH` and `resolveWorkspaceOnlyRoute` are
deleted; `getWorkspaceDestinationPath` always returns the docs path;
`validate-manifest.ts` asserts every entry's docs path is unique and
non-empty instead of asserting the workspace-only invariants. The
`/workspace/[product]/[topic]` route directory is deleted, and
`apps/website/src/app/docs/page.tsx` resolves its default example by docs
path. `WebsiteWorkspace` loses `routeKind="workspace"`.

Sitemap, docs index, sidebar, prev/next links, and the search index derive
from `docs-config.ts`, so the six pages appear without further wiring; the
public-copy and docs e2e gates cover them.

### Part B — surface rename

- `aria-label="Cockpit navigation"` becomes `"Documentation navigation"`,
  matching the existing "Documentation control plane" dialog label.
- Every `data-cockpit-*` attribute becomes `data-workspace-*` and every
  `.cockpit-*` class becomes `.workspace-*`, across `libs/workspace-react`,
  `apps/website/src/styles`, and the Playwright specs that select on them
  (`apps/website/e2e/*.spec.ts`). The rename is mechanical and lands in one
  commit so selectors and markup never disagree.
- `apps/website/public/screenshots/cockpit-run.webp` becomes
  `workspace-run.webp`; its one reference is updated.
- The two prose mentions (`content/blog/2026-05-17-*.mdx:287` link text and
  `content/docs/chat/getting-started/introduction.mdx:47`) are reworded to
  "workspace" or "debug panel".
- `cockpit-retirement.spec.ts` gains a second guard: the bare word
  "cockpit" (case-insensitive) must not appear in Website-served copy —
  MDX prose, JSX text, aria-labels, titles — with an explicit allowlist for
  repository paths (`cockpit/...`, `apps/cockpit/...` until Part C removes
  them) and package names. The guard reads the same file set as the host
  guard.

### Part C — retire the redirect service in the repo

Delete:

- `apps/cockpit/` except the four relocated scripts, `vercel.cockpit.json`,
  `apps/cockpit/scripts/deploy-smoke.ts` and `.spec.ts`,
  `apps/cockpit/scripts/vercel-config.spec.ts`, and the `cockpit` Nx app.
- `legacyPath` from `manifest.types.ts`, `manifest.ts`, and
  `validate-manifest.ts`; `resolveLegacyPath`, `resolveLegacyRequestMode`,
  and `getLegacyWebsiteRedirect` with their tests; the legacy assertions in
  `platform-production-smoke.spec.ts`, `WebsiteWorkspace.spec.tsx`,
  `workspace-provider.spec.tsx`, and `workspace-shell.spec.tsx`.
- `libs/cockpit-docs`, `libs/cockpit-testing`, `libs/cockpit-ui`, their
  tsconfig path aliases, and their entries in the CI `run-many` list.
- `https://cockpit.threadplane.ai` from both proxies' `ALLOWED_ORIGINS`.

Relocate, updating every importer, path filter, guard spec, quickstart, and
README that names the old path:

| from | to |
| --- | --- |
| `apps/cockpit/scripts/capability-registry.ts` | `libs/cockpit-registry/src/lib/capability-registry.ts` (exported from the package index) |
| `apps/cockpit/scripts/serve-example.ts` (+spec) | `scripts/examples/serve-example.ts` |
| `apps/cockpit/scripts/generate-combined-langgraph.ts` | `scripts/examples/generate-combined-langgraph.ts` |
| `apps/cockpit/runtime-wiring-audit.ts` (+ `cockpit-capability-wiring.spec.ts`, `cockpit-e2e-wiring.spec.ts`) | `scripts/examples/runtime-wiring-audit.ts` and specs alongside |

CI (`.github/workflows/ci.yml` and `scripts/ci-workflow.spec.mjs`):

- Delete jobs `cockpit-deploy-smoke` and `cockpit-preview-smoke`, their
  scope gating, their entries in `required-pr-checks` (needs, env,
  `require_scoped` / `require_preview` lines), and the guard tests that
  describe them.
- Delete the deploy job's cockpit steps: prepare, build, deploy,
  exhaustive verify, promotion freshness, promote, production redirects;
  and the guard tests that order and pin them. The
  `VERCEL_COCKPIT_*` secrets are no longer referenced.
- The `cockpit` job stops building `nx build cockpit`; it keeps the libs
  `run-many` test target minus the three deleted scaffolds.
- The examples deploy step and `examples_changed` detection are unchanged.
- `PREVIEW_LANES_ELIGIBLE` and `require_preview` remain for the Website
  preview lane.

The `cockpit_*` scope keys in `scripts/ci-scope.mjs` stay, per the
non-goals; `cockpit_deploy_smoke` becomes unused and is removed from the
key list with its guard, since nothing consumes it.

### Part D — external cleanup (after Part C is on main)

1. Delete the Vercel project `threadplane-cockpit`
   (`prj_nVbpDgli7yjZxOaLKh2C2SBARJQd`) through the API with the team
   token. This removes its domains, deployments, env, and bypass secret.
2. Delete the `cockpit` DNS record from the `threadplane.ai` zone on
   Vercel.
3. Delete the repository secrets `VERCEL_COCKPIT_PROJECT_ID` and
   `VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET`.
4. Confirm `https://cockpit.threadplane.ai/` no longer resolves.

Memory notes that record the cockpit project id and bypass are updated in
the same session.

## Sequencing

Three pull requests in order, each green through CI including the
PR-side preview lanes, then Part D by hand:

1. Part A.
2. Part B.
3. Part C.

Part A before Part C so that the docs pages exist before the legacy table
that once pointed at their workspace paths disappears. Part B before Part C
so the word-guard's allowlist for `apps/cockpit` paths can be dropped in
Part C rather than added and removed.

## Error handling

- Part A: a topic whose new MDX is missing fails `docs.spec.ts` and the
  public-copy gate at build; the manifest validator fails the build if two
  entries resolve to one docs path.
- Part B: the word-guard fails the Website unit suite on any user-facing
  regression; e2e selector drift fails `website-e2e`.
- Part C: the guard suite fails if any deleted job or step is still
  referenced; `ci-scope.spec.mjs` fails if a removed key is still emitted.
- Part D: each API deletion is confirmed by a follow-up GET returning 404
  before the next step.

## Testing

- Part A: `npx nx test website`, `npx nx test cockpit-registry`,
  `npx nx e2e website` locally with the six new pages visited; the
  `website-preview-e2e` lane on the PR exercises Run mode on each.
- Part B: unit guard plus `npx nx e2e website`; the PR lane confirms the
  renamed selectors against a deployed preview.
- Part C: `node --test scripts/ci-workflow.spec.mjs scripts/ci-scope.spec.mjs`,
  `npx nx run-many -t test --projects=cockpit-registry,cockpit-shell,cockpit-runtime-bridge,workspace-react`,
  `npx tsx scripts/assemble-examples.ts` completes, the three quickstarts'
  commands run from the new path.
- Part D: `curl -sI https://cockpit.threadplane.ai/` fails to resolve;
  `gh secret list` no longer lists the two secrets.

## Cost

Part A adds six thin pages and removes one route and one override table.
Part B is a mechanical rename. Part C removes roughly 3,500 lines
(redirect app, smoke script, legacy resolution, scaffolds, CI steps) and
about six minutes from every main push's deploy job. Part D removes one
Vercel project and its 100-plus deployments.
