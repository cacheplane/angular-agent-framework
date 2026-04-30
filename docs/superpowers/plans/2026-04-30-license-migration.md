# License Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Switch all source-file SPDX headers, every public-facing `package.json` `license` field, and the root LICENSE file from `PolyForm-Noncommercial-1.0.0` to `MIT`. Preserve `apps/minting-service/` on its existing proprietary terms. Add `repository`/`homepage`/`bugs` metadata to publishable libs.

**Architecture:** Bulk find/replace with a single exclusion path (`apps/minting-service/`). Then per-`package.json` metadata edits. Then root `LICENSE` rewrite + `LICENSE-COMMERCIAL` removal + `apps/minting-service/LICENSE` creation. README sweep for prose references.

**Spec:** `docs/superpowers/specs/2026-04-30-license-migration-design.md`

---

## File Structure Summary

- **370 source files** under `libs/`, `packages/`, `apps/` (excluding `apps/minting-service/`), and `cockpit/` get their `SPDX-License-Identifier:` header rewritten.
- **77 `package.json` files** get `license` updated from `"PolyForm-Noncommercial-1.0.0"` to `"MIT"`. The publishable libs (`libs/*`, `packages/*`) additionally gain `repository`/`homepage`/`bugs` fields.
- **Root `LICENSE`** rewritten with MIT text.
- **Root `LICENSE-COMMERCIAL`** deleted.
- **`apps/minting-service/LICENSE`** created with proprietary terms (ported from the deleted root `LICENSE-COMMERCIAL`).
- **READMEs** swept for prose references to "PolyForm" or "commercial license required".

---

### Task 1: Bulk SPDX header rewrite

**Files:** all `*.ts` / `*.tsx` / `*.mts` / `*.cts` / `*.js` / `*.mjs` / `*.cjs` / `*.html` / `*.md` / `*.json` / `*.yaml` / `*.yml` files outside `apps/minting-service/` that contain the line `SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0`.

- [ ] **Step 1: Audit before**

```bash
rg -l "SPDX-License-Identifier:.*PolyForm-Noncommercial-1.0.0" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' | wc -l
```

Expected output: **370** (matches the spec's count). If the count is different, re-audit and reconcile before proceeding.

(`docs/superpowers/**` is excluded because spec/plan files reference the SPDX string in code blocks; rewriting them would corrupt historical docs.)

- [ ] **Step 2: Bulk rewrite**

```bash
rg -l "SPDX-License-Identifier:.*PolyForm-Noncommercial-1.0.0" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' | \
  xargs sed -i '' 's|SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0|SPDX-License-Identifier: MIT|g'
```

(macOS-style `sed -i ''` — adjust to `sed -i` on Linux if running on a CI box.)

- [ ] **Step 3: Audit after**

```bash
echo "Files still referencing PolyForm SPDX outside minting-service:"
rg -l "SPDX-License-Identifier:.*PolyForm-Noncommercial-1.0.0" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' | wc -l

echo "Files inside minting-service preserved:"
rg -l "SPDX-License-Identifier:.*PolyForm-Noncommercial-1.0.0" apps/minting-service/ | wc -l
```

Expected: **0** outside, **~16** inside minting-service.

If any "outside" files remain, they're probably in non-standard SPDX format (e.g., a comment without the colon or with extra whitespace). Inspect and rewrite individually.

- [ ] **Step 4: Verify build still passes**

```bash
npx nx run-many -t lint,build -p chat,langgraph,ag-ui --skip-nx-cache
```

Expected: PASS. If a license-header lint rule complains about MIT vs PolyForm consistency, update the rule (separate step in Task 4).

---

### Task 2: Per-package.json metadata updates

**Files:** every `package.json` outside `apps/minting-service/` and `node_modules/` that has `"license": "PolyForm-Noncommercial-1.0.0"`.

The list (audited): root `package.json`, all 16 `libs/*/package.json`, `packages/mcp/package.json`, all `cockpit/**/package.json` (~60), and the relevant `apps/*/package.json` files (cockpit, website, demo, demo-e2e).

#### Step 1: Bulk update `license` field

```bash
rg -l '"license":[[:space:]]*"PolyForm-Noncommercial-1.0.0"' \
  --type json \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' | \
  xargs sed -i '' 's|"license":[[:space:]]*"PolyForm-Noncommercial-1.0.0"|"license": "MIT"|g'
```

- [ ] **Step 2: Verify**

```bash
echo "Files with PolyForm license outside minting-service:"
rg -l '"license":[[:space:]]*"PolyForm-Noncommercial-1.0.0"' \
  --type json \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' | wc -l
```

Expected: **0**.

#### Step 3: Add `repository`/`homepage`/`bugs` to publishable libs

For each of these `package.json` files — only the publishable lib roots, NOT cockpit demos or apps:

- `libs/chat/package.json`
- `libs/langgraph/package.json`
- `libs/ag-ui/package.json`
- `libs/render/package.json`
- `libs/a2ui/package.json`
- `libs/partial-json/package.json`
- `libs/licensing/package.json`
- `libs/cockpit-registry/package.json`
- `libs/cockpit-shell/package.json`
- `libs/cockpit-testing/package.json`
- `libs/cockpit-ui/package.json`
- `libs/cockpit-docs/package.json`
- `libs/db/package.json`
- `libs/design-tokens/package.json`
- `libs/example-layouts/package.json`
- `libs/ui-react/package.json`
- `packages/mcp/package.json`

Add (the `directory` field is the relative path to the package within the monorepo):

```json
"repository": {
  "type": "git",
  "url": "https://github.com/cacheplane/angular-agent-framework.git",
  "directory": "<libs-path>"
},
"homepage": "https://github.com/cacheplane/angular-agent-framework#readme",
"bugs": {
  "url": "https://github.com/cacheplane/angular-agent-framework/issues"
}
```

Per-file edits — for `libs/chat/package.json`:

```json
{
  "name": "@cacheplane/chat",
  "version": "0.0.1",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "libs/chat"
  },
  "homepage": "https://github.com/cacheplane/angular-agent-framework#readme",
  "bugs": {
    "url": "https://github.com/cacheplane/angular-agent-framework/issues"
  },
  "peerDependencies": { ... },
  ...
}
```

Apply analogously to all 17 publishable libs/packages, with `directory` updated to match.

- [ ] **Step 4: Verify build**

```bash
npx nx run-many -t lint,build -p chat,langgraph,ag-ui --skip-nx-cache
```

If `@nx/dependency-checks` flags any newly-added field, update the rule. Most likely it accepts `repository`/`homepage`/`bugs` silently.

---

### Task 3: Root LICENSE files

- [ ] **Step 1: Replace root `LICENSE` with MIT text**

Write to `LICENSE`:

```
MIT License

Copyright (c) 2026 Brian Love d/b/a cacheplane

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Move `LICENSE-COMMERCIAL` content to `apps/minting-service/LICENSE`**

```bash
mv LICENSE-COMMERCIAL apps/minting-service/LICENSE
```

Then edit the new `apps/minting-service/LICENSE` to scope it specifically to the minting service. Replace any references to "the Software" or "the cacheplane framework" with "the cacheplane minting service" or similar specificity.

If the existing `LICENSE-COMMERCIAL` has language that would also apply to broader components, restructure so the file applies only to `apps/minting-service/`.

- [ ] **Step 3: Update `apps/minting-service/package.json`**

Currently has `"license": "PolyForm-Noncommercial-1.0.0"`. Change to:

```json
"license": "SEE LICENSE IN LICENSE",
"private": true
```

(Confirm `private: true` is set; if not, add it. The minting service should never be published.)

- [ ] **Step 4: Verify**

```bash
ls LICENSE LICENSE-COMMERCIAL apps/minting-service/LICENSE 2>&1
cat LICENSE | head -3
cat apps/minting-service/LICENSE | head -3
```

Expected: root `LICENSE-COMMERCIAL` does NOT exist, `LICENSE` starts with "MIT License", `apps/minting-service/LICENSE` starts with the proprietary text.

---

### Task 4: README sweep

**Files:** every `README.md`, `CONTRIBUTING.md`, and any prose doc that mentions "PolyForm", "commercial license", "non-commercial", or "LICENSE-COMMERCIAL".

- [ ] **Step 1: Find references**

```bash
rg -l "PolyForm|commercial license|non-commercial|LICENSE-COMMERCIAL" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' \
  --glob '!*.lock' \
  --glob '!CHANGELOG.md'
```

- [ ] **Step 2: Rewrite each**

For each file in the result:
- Replace "PolyForm Noncommercial License 1.0.0" / "PolyForm-Noncommercial-1.0.0" with "MIT License" / "MIT".
- Replace "Commercial use requires a separate license" / similar with "Free for any use under the MIT License." (or equivalent positive phrasing).
- Remove any "Contact us for a commercial license" sections; replace with a link to the LICENSE file.
- Update the root `README.md` to make the MIT licensing visible at top (status badge or one-line note).

- [ ] **Step 3: Verify**

```bash
rg "PolyForm|LICENSE-COMMERCIAL" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' \
  --glob '!*.lock' \
  --glob '!CHANGELOG.md'
```

Expected output: only references inside `apps/minting-service/` (which legitimately stays proprietary). Anything else needs follow-up.

---

### Task 5: Lint rule sweep

If any ESLint rule, license-checker config, or similar enforces the SPDX string consistency, update it.

- [ ] **Step 1: Find license-related lint config**

```bash
rg -l "PolyForm" .github/ eslint.config.mjs **/eslint.config.mjs 2>&1
rg -l "license" eslint.config.mjs **/eslint.config.mjs 2>&1 | head -10
```

- [ ] **Step 2: If any rule references "PolyForm-Noncommercial-1.0.0" specifically**

Update the rule's expected license string to "MIT". Most likely such a rule exists in `eslint.config.mjs` at the workspace root or in a tooling config like `.licenserc.json`.

- [ ] **Step 3: Run full lint suite**

```bash
npx nx run-many -t lint -p chat,langgraph,ag-ui --skip-nx-cache 2>&1 | tail -10
```

If a license-header rule complains about an MIT/PolyForm mismatch, fix the rule.

---

### Task 6: Final verification

- [ ] **Step 1: Full library lint/test/build sweep**

```bash
npx nx run-many -t lint,test,build -p chat,langgraph,ag-ui,render,a2ui,partial-json,licensing,cockpit-registry,cockpit-shell,cockpit-testing,cockpit-ui,cockpit-docs,db,design-tokens,example-layouts,ui-react --skip-nx-cache 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 2: Affected app builds**

```bash
npx nx affected -t build --base=origin/main 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Sanity grep**

```bash
echo "PolyForm refs outside minting-service (should be 0):"
rg "PolyForm-Noncommercial" \
  --glob '!apps/minting-service/**' \
  --glob '!package-lock.json' \
  --glob '!docs/superpowers/**' \
  --glob '!CHANGELOG.md' | wc -l

echo "MIT SPDX refs (should be ~370):"
rg -l "SPDX-License-Identifier: MIT" --glob '!node_modules/**' | wc -l
```

- [ ] **Step 4: Spot-check 3 random package.json files**

```bash
for f in libs/chat/package.json libs/ag-ui/package.json packages/mcp/package.json; do
  echo "=== $f ==="
  jq '{name, version, license, repository, homepage, bugs}' "$f"
done
```

Each should show `"license": "MIT"` and complete `repository`/`homepage`/`bugs` blocks.

- [ ] **Step 5: Push**

```bash
git push -u origin feat/release-readiness
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --title "feat: relicense to MIT (selective; minting-service stays proprietary)" --body "$(cat <<'EOF'
## Summary
- Switches all source-file SPDX headers from PolyForm-Noncommercial-1.0.0 to MIT (370 files).
- Switches all 77 publishable \`package.json\` \`license\` fields to MIT.
- Adds \`repository\`/\`homepage\`/\`bugs\` metadata to the 17 publishable libraries.
- Replaces root \`LICENSE\` with MIT text. Moves \`LICENSE-COMMERCIAL\` content to \`apps/minting-service/LICENSE\` (re-scoped to that service).
- Sweeps READMEs / docs prose to remove "commercial license required" references.
- \`apps/minting-service/\` stays on its existing proprietary terms.

## Motivation
Aligns with industry SDK norms (CopilotKit, LangChain, Vercel AI SDK all permissive). Removes adoption friction; commercial revenue path shifts to enterprise add-ons + potential managed service.

## Test Plan
- [x] All 16 libs + 1 package + cockpit demos lint/test/build pass
- [x] No residual \`PolyForm\` references outside \`apps/minting-service/\` and historical docs
- [x] Spot-check three package.json files show MIT + complete metadata
- [ ] Manual review of \`LICENSE\` files to confirm wording

## Reversibility
MIT is permanent for shipped code. Anyone who downloads a tagged commit retains MIT rights perpetually. Future releases can change license; past releases remain MIT.

## Design + plan
- Spec: \`docs/superpowers/specs/2026-04-30-license-migration-design.md\`
- Plan: \`docs/superpowers/plans/2026-04-30-license-migration.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- Bumping `version` from `0.0.1` → anything else.
- Actually publishing to npm (the existing `.github/workflows/publish.yml` is stale and broken; fixing it is a separate work item).
- Adding a CHANGELOG.
- Adding a CONTRIBUTING guide or CLA.
- Changing `@cacheplane/licensing` runtime behavior (the lib stays as-is; its purpose just shifts conceptually).
- Updating the `apps/minting-service/` codebase (it stays proprietary, no source-file changes).

---

## Risk

- **Reversibility risk** (called out in the spec): MIT is permanent for any commit that ships under it. Mitigated by the fact that no public release exists yet (everything is `0.0.1`, never published).
- **`LICENSE-COMMERCIAL` content scoping** when moved to `apps/minting-service/LICENSE` — manual review needed to ensure the language doesn't reference "the framework" generically. The migration plan flags this in Task 3 Step 2.
- **Lint/build breakage from license-header rules** — if any tool enforces SPDX consistency, it'll need a one-line update. Caught in Task 5.
