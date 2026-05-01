# Fix Packaging Bugs and Publish 0.0.2

> Driven by smoke-test findings (`docs/superpowers/plans/2026-05-01-fresh-install-smoke.md`). The 0.0.1 release is unusable end-to-end; three packages shipped raw source, one bundles vitest into runtime.

**Goal:** Land three packaging fixes, verify locally with `npm pack` + smoke-workspace install, then ship 0.0.2 to npm.

---

## Bug summary

1. **`@ngaf/a2ui`, `@ngaf/partial-json`, `@ngaf/licensing` published as source.** No explicit `nx-release-publish` target in their `project.json`; Nx defaulted to publishing the project root rather than `dist/`.
2. **`@ngaf/chat` bundles vitest into runtime.** `runAgentConformance` and `runAgentWithHistoryConformance` are exported from the main public-api and `import { describe, it, expect } from 'vitest'` at module level. ng-packagr bundles vitest into the FESM file.
3. **`@ngaf/render` import of `@ngaf/licensing` fails to resolve** — consequence of bug #1; fixes itself once `@ngaf/licensing` ships actual JS.

---

## Strategy

- **Fix 1 (mechanical):** Add `nx-release-publish` target to the three TS-only libs.
- **Fix 2 (entry point):** Move conformance helpers to `@ngaf/chat/testing` secondary entry point. `mockAgent` stays on the main entry (no vitest dep) for ergonomic test-fixture use without separate import.
- **Verification before publish:** `npm pack` each lib, install tarballs into `~/tmp/ngaf/smoke-workspace`, confirm build passes.
- **Publish 0.0.2:** standard `nx release version 0.0.2 --specifier=patch && nx release publish` flow.

`@ngaf/langgraph` test helpers (`mockLangGraphAgent`) don't import vitest; leave on main entry. AG-UI's `FakeAgent` and `provideFakeAgUiAgent` are runtime utilities (not tests), no vitest dep; leave on main entry.

---

### Task 1: Add publish config to TS-only libs

**Files:** `libs/a2ui/project.json`, `libs/partial-json/project.json`, `libs/licensing/project.json`

For each, add:
```json
"nx-release-publish": {
  "options": {
    "packageRoot": "dist/{projectRoot}"
  }
}
```
to the `targets` block.

- [ ] **Step 1: Edit each project.json**

```bash
for lib in a2ui partial-json licensing; do
  jq '.targets["nx-release-publish"] = { options: { packageRoot: "dist/{projectRoot}" } }' \
    libs/$lib/project.json > libs/$lib/project.json.tmp \
  && mv libs/$lib/project.json.tmp libs/$lib/project.json
done
```

- [ ] **Step 2: Verify**

```bash
for lib in a2ui partial-json licensing; do
  echo "=== $lib ==="
  jq '.targets["nx-release-publish"]' libs/$lib/project.json
done
```

Expected: each shows `{"options": {"packageRoot": "dist/{projectRoot}"}}`.

---

### Task 2: Move conformance helpers to `@ngaf/chat/testing`

**Files:** `libs/chat/src/lib/testing/`, `libs/chat/src/public-api.ts`, new `libs/chat/testing/` secondary entry point.

ng-packagr secondary entry points are colocated subdirectories with their own `ng-package.json`. Convention:

```
libs/chat/
├── ng-package.json               # main entry
├── src/
│   ├── public-api.ts
│   └── lib/
│       └── testing/              # source files
│           ├── agent-conformance.ts
│           └── agent-with-history-conformance.ts
└── testing/                      # NEW — secondary entry
    ├── ng-package.json
    └── public-api.ts
```

The secondary `testing/public-api.ts` re-exports from the source files. The main `src/public-api.ts` STOPS exporting the conformance helpers.

- [ ] **Step 1: Create `libs/chat/testing/ng-package.json`**

```json
{
  "$schema": "../../../node_modules/ng-packagr/ng-package.schema.json",
  "lib": {
    "entryFile": "public-api.ts"
  }
}
```

- [ ] **Step 2: Create `libs/chat/testing/public-api.ts`**

```ts
// SPDX-License-Identifier: MIT
export { runAgentConformance } from '../src/lib/testing/agent-conformance';
export { runAgentWithHistoryConformance } from '../src/lib/testing/agent-with-history-conformance';
```

(Keep `mockAgent` on the main entry; it's pure factory code with no vitest dep and is ergonomically useful for component tests.)

- [ ] **Step 3: Update `libs/chat/src/public-api.ts`**

Remove these lines:
```ts
export { runAgentConformance } from './lib/testing/agent-conformance';
export { runAgentWithHistoryConformance } from './lib/testing/agent-with-history-conformance';
```

Keep:
```ts
export { mockAgent } from './lib/testing/mock-agent';
export type { MockAgent, MockAgentOptions } from './lib/testing/mock-agent';
```

- [ ] **Step 4: Update internal references**

`libs/langgraph/src/lib/agent.conformance.spec.ts` imports `runAgentConformance` — currently from `@ngaf/chat`; should now be `@ngaf/chat/testing`.

```bash
rg -l "runAgentConformance|runAgentWithHistoryConformance" libs/ apps/ cockpit/ --glob '!**/dist/**'
```

For each result, change `from '@ngaf/chat'` → `from '@ngaf/chat/testing'` for these specific imports.

- [ ] **Step 5: Verify chat builds**

```bash
npx nx build chat --skip-nx-cache 2>&1 | tail -3
ls dist/libs/chat/
```

Expected: PASS. `dist/libs/chat/` contains both the main FESM and a `testing/` subdirectory with its own `package.json`/types.

The published artifact will have `exports`:
```json
{
  ".": { ... main entry ... },
  "./testing": { ... testing entry ... }
}
```

(ng-packagr generates this automatically.)

---

### Task 3: Local pack + install verification

Before publishing to npm, validate the fix locally.

- [ ] **Step 1: Build all 7 publishable libs**

```bash
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing --skip-nx-cache 2>&1 | tail -3
```

- [ ] **Step 2: Verify each dist has proper artifacts**

```bash
for lib in chat langgraph ag-ui render a2ui partial-json licensing; do
  echo "=== $lib ==="
  ls dist/libs/$lib/ | head -8
  echo "---"
  jq '{name, main, module, types, exports: (.exports // "none")}' dist/libs/$lib/package.json 2>&1 | head -10
done
```

Expected for ng-packagr libs (chat/langgraph/ag-ui/render): `fesm2022/`, `types/`, `exports.{".":...}` block.

Expected for tsc libs (a2ui/partial-json/licensing): compiled `.js` + `.d.ts` files, valid `main`/`module`/`types`.

If any lib's `dist/` is missing or has only source: that lib's build target needs investigation.

- [ ] **Step 3: Pack each as a local tarball**

```bash
mkdir -p ~/tmp/ngaf/local-tarballs
rm -f ~/tmp/ngaf/local-tarballs/*.tgz

for lib in chat langgraph ag-ui render a2ui partial-json licensing; do
  cd dist/libs/$lib && npm pack --pack-destination ~/tmp/ngaf/local-tarballs && cd -
done

ls ~/tmp/ngaf/local-tarballs/
```

Expected: 7 `.tgz` files.

- [ ] **Step 4: Install local tarballs into smoke workspace**

```bash
cd ~/tmp/ngaf/smoke-workspace
npm install \
  ~/tmp/ngaf/local-tarballs/ngaf-chat-0.0.1.tgz \
  ~/tmp/ngaf/local-tarballs/ngaf-ag-ui-0.0.1.tgz \
  ~/tmp/ngaf/local-tarballs/ngaf-render-0.0.1.tgz \
  ~/tmp/ngaf/local-tarballs/ngaf-licensing-0.0.1.tgz \
  ~/tmp/ngaf/local-tarballs/ngaf-a2ui-0.0.1.tgz \
  ~/tmp/ngaf/local-tarballs/ngaf-partial-json-0.0.1.tgz
```

- [ ] **Step 5: Re-run the AG-UI smoke build**

```bash
cd ~/tmp/ngaf/smoke-workspace
npx ng build ag-ui-fake 2>&1 | tail -10
```

Expected: PASS. If build still fails: capture the new error, address before publish.

If the test imports of `runAgentConformance` need updating to `@ngaf/chat/testing` in the smoke app — they shouldn't, since the AG-UI smoke doesn't use conformance. Only internal lib tests use it.

- [ ] **Step 6: Run dev server (optional but valuable)**

```bash
cd ~/tmp/ngaf/smoke-workspace
npx ng serve ag-ui-fake --port 4300 &
sleep 8
curl -sIo /dev/null -w "%{http_code}\n" http://localhost:4300/
# kill the server
kill %1 2>/dev/null
```

Expected: HTTP 200. Real interactive testing requires browser.

---

### Task 4: Bump and publish 0.0.2

- [ ] **Step 1: Build everything from clean state**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/post-unification-cleanup
rm -rf dist/
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,partial-json,licensing --skip-nx-cache 2>&1 | tail -3
```

- [ ] **Step 2: Version bump**

```bash
npx nx release version --specifier=patch 2>&1 | tail -10
```

Expected: all 7 publishable lib package.json files updated to 0.0.2 (synchronized fixed group).

- [ ] **Step 3: Generate changelog + tag**

```bash
npx nx release changelog 0.0.2 2>&1 | tail -10
```

Expected: `CHANGELOG.md` updated with 0.0.2 entry. New commit `chore(release): publish v0.0.2`. New tag `v0.0.2` (the post-#147 tag pattern; `nx.json` was updated).

- [ ] **Step 4: Source NPM_TOKEN and run publish**

```bash
set -a; source /Users/blove/repos/angular-agent-framework/.env; set +a
npx nx release publish --groups=publishable --access=public --otp=NNNNNN
```

(User provides the OTP at run time; trusted publishing is configured but local-publish still goes through 2FA per npm account settings.)

Expected: 7 packages publish successfully.

- [ ] **Step 5: Push commit + tag**

```bash
git push origin HEAD:main
git push origin v0.0.2
```

Workflow fires on tag push but is idempotent.

- [ ] **Step 6: Verify all 7 at 0.0.2**

```bash
for pkg in chat langgraph ag-ui render a2ui partial-json licensing; do
  echo -n "@ngaf/$pkg: "
  npm view @ngaf/$pkg version
done
```

Expected: all 7 print `0.0.2`.

---

### Task 5: Re-run the smoke against 0.0.2

After 0.0.2 is on npm:

```bash
cd ~/tmp/ngaf/smoke-workspace
rm -rf node_modules package-lock.json
npm install
# package.json already references @ngaf/* without version pins; will pull 0.0.2

npx ng build ag-ui-fake
npx ng build langgraph-build
```

Expected: both build clean. Then `ng serve ag-ui-fake --port 4300` and confirm in browser.

If anything else fails: capture findings, repeat the fix-publish cycle.

---

## Out of Scope

- Renaming or moving `mockAgent` / `mockLangGraphAgent` / `FakeAgent` / `provideFakeAgUiAgent`. They don't import vitest; their bundle cost is negligible.
- Renaming `lib/testing/` directories.
- Improving Tailwind / theming setup in the smoke app.
- Adding LangGraph live-backend test.

## Risk

- **Multi-package version skew during publish.** If the publish for 0.0.2 fails partway (e.g., OTP timeout), some packages land at 0.0.2 while others stay at 0.0.1. The synchronized fixed group + the `--first-release` style retry pattern (re-run with same OTP for missed packages) mitigates this.
- **Secondary entry-point convention.** Some Angular consumers (older ng-packagr, certain bundlers) have rough edges with secondary entry points. Smoke-test against the AG-UI app catches obvious cases.
- **`@ngaf/langgraph` may have similar issues** that didn't surface yet because the smoke didn't actually try to build the langgraph-build app. After 0.0.2 publishes, the smoke MUST build langgraph-build successfully or we have a third packaging bug.
