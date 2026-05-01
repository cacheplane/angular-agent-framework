# `@cacheplane` → `@ngaf` Org Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Rewrite all 536 references from `@cacheplane/X` → `@ngaf/X`, drop `mcp` from the publishable release group (mark `packages/mcp` private), and update workflow + runbook to reflect the 7-package publishable set. Out of scope: actual first publish, trusted publishing setup.

**Spec:** `docs/superpowers/specs/2026-04-30-ngaf-org-rename-design.md`

---

## File Structure

- 88 `package.json` files: `"name": "@cacheplane/X"` → `"@ngaf/X"`; inter-package peerDeps keys.
- 15 entries in `tsconfig.base.json` `compilerOptions.paths`.
- 448 non-JSON source files: TypeScript imports, README/docs prose.
- `nx.json`: drop `mcp` from `release.groups.publishable.projects` and `release.version.preVersionCommand`.
- `.github/workflows/publish.yml`: update `NPM_PUBLISHABLE_PROJECTS` env var.
- `docs/RELEASE.md`: drop `mcp` from the package list and build command example.
- `packages/mcp/package.json`: add `"private": true`.

---

### Task 1: Pre-flight audit

- [ ] **Step 1: Confirm `@ngaf` is available on npm**

```bash
npm view @ngaf 2>&1 | head -5
```

Expected: `404 Not Found` or "Scope is empty". If a different owner already holds `@ngaf`, STOP — the rename plan needs a different name (defer the user for a new clarification).

- [ ] **Step 2: Snapshot current counts**

```bash
echo "Total @cacheplane refs:"; rg -l "@cacheplane/" --glob '!package-lock.json' --glob '!node_modules/**' --glob '!dist/**' | wc -l
echo "package.json with @cacheplane:"; rg -l '"@cacheplane/' --type json --glob '!package-lock.json' | wc -l
echo "tsconfig.base.json paths:"; rg "@cacheplane/" tsconfig.base.json | wc -l
echo "non-JSON source files:"; rg -l "@cacheplane/" --glob '!*.json' --glob '!package-lock.json' --glob '!node_modules/**' --glob '!dist/**' | wc -l
```

Expected: 536 / 88 / 15 / 448. If the numbers differ, re-audit before proceeding.

---

### Task 2: Bulk rename `@cacheplane` → `@ngaf`

- [ ] **Step 1: Bulk rewrite all source files**

```bash
rg -l "@cacheplane/" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!docs/superpowers/**' \
  --glob '!apps/minting-service/**' | \
  xargs sed -i '' 's|@cacheplane/|@ngaf/|g'
```

(macOS `sed -i ''`; on Linux drop the empty-string arg.)

`docs/superpowers/**` and `apps/minting-service/**` are excluded — historical artifacts and a separately-licensed proprietary service.

- [ ] **Step 2: Verify counts**

```bash
echo "Remaining @cacheplane refs (should be 0 outside exclusions):"
rg -l "@cacheplane/" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!docs/superpowers/**' \
  --glob '!apps/minting-service/**' | wc -l

echo "@ngaf refs introduced:"
rg -l "@ngaf/" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' | wc -l
```

Expected: `0` remaining `@cacheplane`, ~536 new `@ngaf`.

- [ ] **Step 3: Spot-check 3 representative files**

```bash
jq '{name, version, peerDependencies}' libs/chat/package.json
grep -E "@ngaf|@cacheplane" tsconfig.base.json | head -10
grep "from '@" libs/chat/src/lib/agent/agent.ts | head -5
```

Each should show `@ngaf/...` with no residual `@cacheplane/...`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename npm scope @cacheplane → @ngaf across the codebase

Bulk rewrite of 536 references (88 package.json, 15 tsconfig paths,
448 source files + READMEs). Excludes apps/minting-service/ and
docs/superpowers/ historical artifacts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Drop `mcp` from publishable group; mark private

- [ ] **Step 1: Mark `packages/mcp` private**

Edit `packages/mcp/package.json`. Add `"private": true` (alongside other top-level fields). Verify:

```bash
jq '{name, private}' packages/mcp/package.json
```

Expected: `{"name": "@ngaf/langgraph-mcp", "private": true}`.

- [ ] **Step 2: Update `nx.json` release config**

Find the `release.groups.publishable.projects` array and remove `"mcp"`. Final state:

```json
"projects": [
  "chat",
  "langgraph",
  "ag-ui",
  "render",
  "a2ui",
  "partial-json",
  "licensing"
]
```

Update `release.version.preVersionCommand` to drop `mcp`:

```json
"preVersionCommand": "npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing"
```

- [ ] **Step 3: Update `.github/workflows/publish.yml`**

Find the env var:

```yaml
NPM_PUBLISHABLE_PROJECTS: chat,langgraph,ag-ui,render,a2ui,partial-json,licensing,mcp
```

Drop `mcp`:

```yaml
NPM_PUBLISHABLE_PROJECTS: chat,langgraph,ag-ui,render,a2ui,partial-json,licensing
```

- [ ] **Step 4: Update `docs/RELEASE.md`**

In the package-list paragraph and the build command example, drop `@ngaf/langgraph-mcp` / `mcp`. The list should show 7 packages.

- [ ] **Step 5: Verify dry-run still works**

```bash
rm -rf dist/
npx nx release publish --groups=publishable --dry-run 2>&1 | grep "name:" | sort -u
```

Expected: 7 lines, all `@ngaf/<name>`. No `langgraph-mcp` in the output.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/package.json nx.json .github/workflows/publish.yml docs/RELEASE.md
git commit -m "chore: drop mcp from publishable group; mark packages/mcp private

The MCP integration package isn't ready for first release. Mark
packages/mcp 'private: true' so it can't accidentally publish, and
remove from the synchronized publishable release group. Re-add when
the package matures.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Lockfile reconciliation

- [ ] **Step 1: Reinstall**

```bash
npm install 2>&1 | tail -3
```

This rewrites `package-lock.json` with the new package names. Do NOT `rm -f package-lock.json` first — that drops cross-platform native bindings (see `feedback_lockfile_platform_bindings.md`).

- [ ] **Step 2: Verify cross-platform bindings preserved**

```bash
grep -c '"node_modules/@next/swc-' package-lock.json
```

Expected: ≥ 4 (linux-x64-gnu, linux-x64-musl, darwin-arm64, win32-x64). If only 1, lockfile lost cross-platform; restore from `git checkout origin/main -- package-lock.json` and re-run `npm install`.

- [ ] **Step 3: Full library lint/test/build**

```bash
npx nx run-many -t lint,test,build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing --skip-nx-cache 2>&1 | tail -3
```

Expected: PASS for all 7 + the cockpit-* deps. Watch for:
- "Cannot find module '@cacheplane/X'" → missed find/replace.
- "Cannot find module '@ngaf/X'" → tsconfig path or package-lock issue.

- [ ] **Step 4: Commit lockfile**

```bash
git add package-lock.json
git commit -m "chore: reconcile package-lock after @cacheplane → @ngaf rename"
```

---

### Task 5: Final verification, push, PR

- [ ] **Step 1: Final residual-check**

```bash
echo "@cacheplane in source (should be 0):"
rg "@cacheplane/" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!docs/superpowers/**' \
  --glob '!apps/minting-service/**' | wc -l
```

- [ ] **Step 2: Affected app builds**

```bash
npx nx affected -t build --base=origin/main 2>&1 | tail -5
```

Expected: PASS.

- [ ] **Step 3: Push**

```bash
git push -u origin feat/ngaf-org-rename
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "refactor: rename npm scope @cacheplane → @ngaf; drop mcp from publishable group" --body "$(cat <<'EOF'
## Summary
- Bulk rewrite of 536 references from \`@cacheplane/X\` to \`@ngaf/X\`. Affects 88 package.json files, 15 tsconfig paths, 448 source files + READMEs. Excludes \`apps/minting-service/\` (proprietary) and \`docs/superpowers/\` (historical artifacts).
- Drop \`mcp\` from the \`publishable\` release group; mark \`packages/mcp\` \`private: true\`. The MCP integration is deferred to a future release.
- Update \`nx.json\`, \`.github/workflows/publish.yml\`, and \`docs/RELEASE.md\` to reflect the 7-package publishable set.

## Motivation
\`@ngaf\` (Angular Agent Framework, abbreviated) is short (5 chars vs the 24-char alternative), pronounceable, and identifies the project rather than the parent company. npm package names are sticky once published — better to rename now, before the first release.

## Final publishable set
1. \`@ngaf/chat\`
2. \`@ngaf/langgraph\`
3. \`@ngaf/ag-ui\`
4. \`@ngaf/render\`
5. \`@ngaf/a2ui\`
6. \`@ngaf/partial-json\`
7. \`@ngaf/licensing\`

## Test Plan
- [x] Zero \`@cacheplane\` references remain outside excluded paths
- [x] All 7 publishable libs lint/test/build clean
- [x] \`nx release publish --dry-run\` produces 7 tarballs (no langgraph-mcp)
- [x] Cross-platform bindings preserved in package-lock.json

## What this does NOT do
- The actual first publish (manual; user runs locally per \`docs/RELEASE.md\` after this merges).
- Trusted publishing setup (separate PR after the first publish, since trusted publishing requires the packages to exist on npm first).

## Design + plan
- Spec: \`docs/superpowers/specs/2026-04-30-ngaf-org-rename-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-30-ngaf-org-rename.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Post-merge: First publish (manual, user-driven)

Once the rename PR merges and the user has confirmed:
- `npm whoami` returns the user account that owns `@ngaf` org rights
- `NPM_TOKEN` is set locally (e.g., in `.env` or `~/.npmrc`)
- `gh secret list` shows `NPM_TOKEN` set in the repo

Run from a fresh main checkout:

```bash
git checkout main && git pull
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing
npx nx release changelog 0.0.1 --first-release
npx nx release publish --groups=publishable --first-release
git push origin main --tags
```

This publishes 7 packages at version `0.0.1`, generates `CHANGELOG.md`, creates a `v0.0.1` tag, and pushes the tag. The `Publish` workflow fires on tag push but is idempotent (npm rejects duplicate versions).

## Post-publish: Switch to trusted publishing (separate PR)

1. **Per-package npm config** (manual web UI). For each of the 7 packages, navigate to `npmjs.com/package/@ngaf/<name>/access` and add a Trusted Publisher entry pointing to:
   - GitHub repository: `cacheplane/angular-agent-framework`
   - Workflow filename: `publish.yml`
   - Environment: (none)
2. **Workflow update PR:**
   - Drop `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` from the publish steps in `.github/workflows/publish.yml`.
   - Keep `permissions.id-token: write` and `NPM_CONFIG_PROVENANCE: 'true'` (already there).
   - Add a comment in the workflow noting trusted publishing is now active.
3. **Verify** with workflow_dispatch dry-run (`Run workflow → dry-run = true`) before the next real release.
4. **Cleanup** after two consecutive successful releases via trusted publishing: `gh secret delete NPM_TOKEN`.
