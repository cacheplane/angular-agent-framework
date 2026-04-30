# Release Process

The eight publishable libraries (`@cacheplane/chat`, `@cacheplane/langgraph`, `@cacheplane/ag-ui`, `@cacheplane/render`, `@cacheplane/a2ui`, `@cacheplane/partial-json`, `@cacheplane/licensing`, `@cacheplane/langgraph-mcp`) ship together at a synchronized version via Nx Release. During the `0.0.x` exploratory phase, only patch bumps are used.

## One-shot release (recommended)

From a clean main branch:

```bash
git checkout main && git pull
npx nx release patch
```

This runs Nx Release in interactive mode, which:

1. Builds all eight publishable projects (preVersionCommand).
2. Bumps every package.json version (e.g., `0.0.1` → `0.0.2`).
3. Generates `CHANGELOG.md` from commits since the last tag.
4. Creates a git commit `chore(release): publish v0.0.2`.
5. Tags the commit `v0.0.2`.
6. **Prompts for confirmation, then publishes to npm with provenance.**

After the prompt, push the commit and tag:

```bash
git push origin main --tags
```

The `Publish` GitHub Actions workflow fires on tag push and re-publishes (idempotent — npm rejects duplicate versions).

## Step-by-step (for debugging)

If something goes wrong, run the steps individually:

```bash
# 1. Version bump (writes new versions to package.json files)
npx nx release version --specifier=patch

# 2. Generate changelog (creates CHANGELOG.md, commits, tags)
npx nx release changelog v0.0.2  # use the version produced by step 1

# 3. Publish to npm
npx nx release publish --groups=publishable
```

## First release ever

The very first publish needs `--first-release` to skip the "previous tag exists" check:

```bash
npx nx release patch --first-release
```

## Dry run

Always sanity-check before a real release:

```bash
npx nx release patch --dry-run
```

This prints what would happen without modifying anything.

## Manual workflow trigger

`Publish` workflow accepts `workflow_dispatch` with a `dry-run` input (default `true`). Trigger from the GitHub Actions UI to verify CI's publish path without actually shipping.

## Why patch-only during 0.0.x

While the API is still settling we bump only the patch component (`0.0.1` → `0.0.2` → `0.0.3`). This signals to consumers that breaking changes can land in any release; lock to an exact version.

When the API stabilizes enough to make compatibility promises, transition to `0.1.0` and start using minor/major bumps with conventional-commit-driven semver.

## Why peerDeps use `*` between cacheplane libs

Caret-prefixed ranges (`^0.0.1`) in `0.0.x` don't include subsequent patches because npm semver treats `0.0.x` as breaking. Using `"*"` for inter-cacheplane peerDeps during this phase avoids the range-narrowing problem; the synchronized release group ensures all libs ship the same version anyway. Switch back to `^X.Y.Z` once we hit `0.1.0`.
