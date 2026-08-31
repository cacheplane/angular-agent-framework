# Release Process

The six publishable libraries (`@threadplane/chat`, `@threadplane/langgraph`, `@threadplane/ag-ui`, `@threadplane/render`, `@threadplane/a2ui`, `@threadplane/telemetry`) ship together at a synchronized version via Nx Release. During the `0.0.x` exploratory phase, only patch bumps are used.

## Standard release (second release onward)

> First release? See **[First `@threadplane` release](#first-threadplane-release)** below — the flow is different because there's no prior package under the new npm org yet.

> [!WARNING]
> **Do not use `nx release patch`.** The one-shot `nx release` command does not
> work in this repo. `nx.json` configures git options under
> `release.changelog.git`, and Nx rejects the top-level command whenever
> granular git config is present:
>
> `NX  The "release" top level command cannot be used with granular git configuration.`
>
> Use the subcommands below instead.

From a clean main branch:

```bash
git checkout main && git pull

# 1. Version bump. Runs preVersionCommand (builds all six projects), rewrites every
#    package.json, updates package-lock.json, and stages the result.
npx nx release version --specifier=patch

# 2. Changelog + commit + tag + GitHub Release.
#    Pass the BARE version — see the warning below.
npx nx release changelog 0.0.57

# 3. Push. The Publish workflow fires on the tag and publishes to npm
#    with provenance via OIDC trusted publishing.
git push origin main --tags
```

> [!WARNING]
> **Pass the bare version to `changelog`, not `vX.Y.Z`.** `releaseTagPattern` is
> `v{version}`, so Nx prepends the `v` itself. Passing `v0.0.57` produces a
> malformed **`vv0.0.57`** tag and a GitHub Release at
> `/releases/tag/vv0.0.57`. Pass `0.0.57`.
>
> Always `--dry-run` step 2 first and check the printed tag URL before
> committing to it.

Step 3 is what actually ships. You can also publish from your machine with
`npx nx release publish --groups=publishable`, but preferring the tag-driven
workflow means no local npm credentials are needed and provenance is attested
by CI.

### Check the lockfile before pushing

Step 1 regenerates `package-lock.json`. On macOS that can drop the Linux
`@next/swc-*` bindings and break CI. The diff should be **only** the version
lines for the six libs:

```bash
git diff --cached package-lock.json | grep -E '^-' | grep -icE 'linux|darwin|musl|gnu'
# must print 0
```

If it prints anything else, revert the lockfile and re-apply the version lines by hand.

## First `@threadplane` release

The first publish under the `@threadplane` npm org is manual. The packages must exist on npm before trusted publishing can be configured package-by-package. Run this from a clean, merged `main` branch.

```bash
# 1. Install and build everything
npm ci
npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,telemetry --skip-nx-cache

# 2. Verify release metadata
node scripts/verify-release-versions.mjs --tag v$(node -p "require('./libs/chat/package.json').version")
npx nx release publish --groups=publishable --dry-run

# 3. Publish manually.
npm publish dist/libs/telemetry --access public
npm publish dist/libs/a2ui --access public
npm publish dist/libs/render --access public
npm publish dist/libs/chat --access public
npm publish dist/libs/ag-ui --access public
npm publish dist/libs/langgraph --access public

# 5. Verify all package pages resolve.
npm view @threadplane/telemetry version
npm view @threadplane/a2ui version
npm view @threadplane/render version
npm view @threadplane/chat version
npm view @threadplane/ag-ui version
npm view @threadplane/langgraph version
```

After the first `@threadplane` release, configure npm trusted publishing for all six packages against `.github/workflows/publish.yml`. Subsequent patch bumps use the one-shot flow above.

## Dry run

Always sanity-check before a real release. Dry-run each subcommand — the
one-shot `nx release patch --dry-run` fails the same way the real command does:

```bash
npx nx release version --specifier=patch --dry-run
npx nx release changelog 0.0.57 --dry-run   # bare version; check the printed tag URL
```

These print what would happen without modifying anything.

## Is a release actually needed?

Version bumps on `main` do **not** publish — only a pushed `vX.Y.Z` tag does. Main
routinely drifts ahead of npm, and the version on disk can match the version on
npm while the code differs. Check before assuming:

```bash
git rev-list --count "v$(npm view @threadplane/chat version)"..origin/main
```

Anything above `0` means main has unpublished commits.

## Manual workflow trigger

`Publish` workflow accepts `workflow_dispatch` with a `dry-run` input (default `true`). Trigger from the GitHub Actions UI to verify CI's publish path without actually shipping.

## Why patch-only during 0.0.x

While the API is still settling we bump only the patch component (`0.0.1` → `0.0.2` → `0.0.3`). This signals to consumers that breaking changes can land in any release; lock to an exact version.

When the API stabilizes enough to make compatibility promises, transition to `0.1.0` and start using minor/major bumps with conventional-commit-driven semver.

## Why peerDeps use `*` between Threadplane libs

Caret-prefixed ranges (`^0.0.1`) in `0.0.x` don't include subsequent patches because npm semver treats `0.0.x` as breaking. Using `"*"` for inter-Threadplane peerDeps during this phase avoids the range-narrowing problem; the synchronized release group ensures all libs ship the same version anyway. Switch back to `^X.Y.Z` once we hit `0.1.0`.
