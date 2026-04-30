# `@cacheplane` → `@ngaf` npm Org Rename + First Publish Setup

## Goal

Rename the npm scope across the entire codebase from `@cacheplane` to `@ngaf` (Angular Agent Framework, abbreviated). Drop `packages/mcp` from the publishable set for the first release (defer; mark private). Prepare the workflow for the user's first manual publish at `0.0.1` and document the path to switch to npm trusted publishing afterward.

## Motivation

- The codebase uses `@cacheplane/*` everywhere as a placeholder scope name. The public-facing identity should match the project, not the company that's incubating it. `@ngaf` is short (5 chars vs `@angular-agent-framework`'s 24), pronounceable, and uniquely identifies the project.
- npm package names are sticky once published; better to rename now (pre-first-release) than after consumers depend on `@cacheplane/*`.
- The MCP integration package isn't ready for first release — drop from publishable group, ship later.

## Scope

### Rename

`@cacheplane/X` → `@ngaf/X` everywhere except:
- `apps/minting-service/` (proprietary; never published; left untouched as a unit).
- Historical docs in `docs/superpowers/specs/` and `docs/superpowers/plans/` (artifacts of past decisions; rewriting corrupts the record).

Affected (audited):
- 88 `package.json` files (lib/cockpit/app/packages roots and inter-package peerDeps).
- 15 entries in `tsconfig.base.json` `compilerOptions.paths`.
- 448 non-JSON source files (TypeScript imports, README/docs prose).

Total: 536 file rewrites. Bulk find/replace, no substring-overlap risk (the literal `@cacheplane/` won't appear inside other identifiers).

### Publishable group changes

Drop `mcp` from the synchronized `publishable` release group. `packages/mcp/package.json` gains `"private": true` so it can't accidentally publish.

Final publishable list (7 packages):
- `@ngaf/chat`
- `@ngaf/langgraph`
- `@ngaf/ag-ui`
- `@ngaf/render`
- `@ngaf/a2ui`
- `@ngaf/partial-json`
- `@ngaf/licensing`

### Workflow + runbook updates

- `nx.json` `release.groups.publishable.projects`: drop `mcp`.
- `nx.json` `release.version.preVersionCommand`: drop `mcp` from the project list.
- `.github/workflows/publish.yml`: update `NPM_PUBLISHABLE_PROJECTS` env var (drop `mcp`).
- `docs/RELEASE.md`: drop `mcp` from the package list and the build-projects command.

### First publish (manual, user-driven; NOT part of the PR)

After the rename PR merges, the user runs the corrected first-release flow from `docs/RELEASE.md`:

```bash
git checkout main && git pull
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing
npx nx release changelog 0.0.1 --first-release
npx nx release publish --groups=publishable --first-release
git push origin main --tags
```

This requires:
- `npm whoami` confirms the user is logged in to the account that owns `@ngaf` org rights.
- `NPM_TOKEN` configured locally (e.g., in `~/.npmrc` or `.env` sourced into shell). Token has `automation` or `publish` scope on the `@ngaf` org.
- `gh secret list` shows `NPM_TOKEN` set in the repo for the workflow's tag-triggered publish path (until trusted publishing replaces it).

### Trusted publishing (post-first-publish, separate PR)

After the first publish creates the 7 packages on npm:

1. **Per-package npm config** (manual, web UI). For each of the 7 packages, navigate to `npmjs.com/package/@ngaf/<name>/access` and add a "Trusted Publisher" entry pointing to:
   - GitHub repository: `cacheplane/angular-agent-framework`
   - Workflow filename: `publish.yml`
   - Environment: (none — public workflow trigger)
2. **Workflow update PR** (separate from this rename):
   - Drop `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` from the publish steps.
   - Keep `permissions.id-token: write` (already present).
   - Keep `NPM_CONFIG_PROVENANCE: 'true'` (already present).
   - The workflow now uses OIDC instead of a token; npm validates the workflow is the configured trusted publisher before accepting the publish.
3. **Secret cleanup** (post-trusted-publishing): once trusted publishing works for two consecutive releases, remove the `NPM_TOKEN` secret from the repo (`gh secret delete NPM_TOKEN`).

## Out of Scope

- The first publish itself (manual; user runs locally; not in the PR).
- Trusted publishing config and workflow update (separate PR after first publish).
- Renaming `apps/minting-service/` (stays proprietary regardless of npm scope).
- MCP package work (deferred; private:true for now).
- Any version-number changes (`0.0.1` stays for first publish).
- Domain or branding changes (this is just an npm scope rename).

## Risk

- **npm scope availability.** `@ngaf` must be claimable on npm. Pre-PR check: `npm view @ngaf` should return 404 or "scope is empty"; if a different scope owner exists, the plan needs a different name. **Verify before merging the PR.**
- **Dist artifact references.** ng-packagr embeds package names into built `.d.ts` and `package.json` artifacts. These are regenerated on build, so as long as we re-run `npx nx run-many -t build` after the rename, dist/ is consistent.
- **Lockfile churn.** `npm install` after the rename will rewrite `package-lock.json` to reflect the new package names. This is expected; the same caveat about preserving cross-platform native bindings (see `feedback_lockfile_platform_bindings.md`) applies — don't `rm -f` the lockfile.
- **External docs / blog posts** — none yet referencing `@cacheplane` since nothing's published. Safe.

## When to Revisit

- If `@ngaf` becomes ambiguous as the project gains other meanings, can rename again before broad adoption.
- If `mcp` package matures and becomes user-facing, re-add to the publishable group (also decide its final name: `@ngaf/mcp` is the natural choice).
