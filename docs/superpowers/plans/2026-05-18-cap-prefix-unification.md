# Cockpit cap prefix unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `r-` prefix to all 6 render caps and `da-` prefix to all 6 deep-agents caps (9 actual renames; 3 already prefixed). Each rename keeps registry `id` + `graphName` + per-cap `langgraph.json` graph key + Angular env's `streamingAssistantId` in lockstep.

**Architecture:** Per-cap commit (9 commits). Each touches ~5 files in lockstep. Plus one cumulative commit for tests/fixtures + `update-angular-environments.ts`. Pre-flight grep per cap catches any hidden consumer.

**Tech Stack:** TypeScript (registry + scripts), JSON (langgraph manifests), Angular envs.

---

## Pre-flight notes (READ FIRST)

**Working tree.** Dedicated worktree at `/tmp/cap-prefixes`, branch `claude/cap-prefix-unification` (spec already committed). Start every session with:

```bash
cd /tmp/cap-prefixes
pwd && git branch --show-current && git log --oneline -3
```

Expected: pwd `/tmp/cap-prefixes`, branch `claude/cap-prefix-unification`, top commit `49ae3c4a` (spec).

After any long-running step, confirm branch is still `claude/cap-prefix-unification`. If swap detected, STOP.

**Pre-flight verified during plan-write (2026-05-18):**

Caps to rename (9 total, in fixed order):
- Render (5): spec-rendering, element-rendering, state-management, repeat-loops, computed-functions (NOT r-registry — already prefixed)
- Deep-agents (4): planning, filesystem, skills, sandboxes (NOT da-subagents, da-memory — already prefixed)

Per-cap blast radius (~5 files):
1. `apps/cockpit/scripts/capability-registry.ts` — one row's `id` + `graphName`.
2. `cockpit/<product>/<topic>/python/langgraph.json` — graph entry key.
3. `cockpit/<product>/<topic>/python/docs/guide.md` — embedded `assistantId: '<id>'` code snippet (2 occurrences per file).
4. `cockpit/<product>/<topic>/angular/src/environments/environment.development.ts` — `streamingAssistantId` value.
5. `cockpit/<product>/<topic>/angular/src/environments/environment.ts` — `streamingAssistantId` value.

Plus one cumulative edit:
6. `scripts/update-angular-environments.ts` — 9 row updates for the renamed caps.

**Pre-existing bug discovered:** registry currently has `da-subagents` (id) ≠ `subagents` (graphName). All other rows have id == graphName. This PR's da-subagents row stays unchanged (already correctly prefixed at the registry id), but the **graphName drift will NOT be fixed in this PR** — it's a separate concern. If fixing would be in-scope, scope is doubled. Out of scope here.

**Hard rules.**
- One atomic commit per cap (9 commits for renames).
- One cumulative commit at the end for update-angular-environments.ts.
- Tests/fixtures unchanged in this PR's scope unless verification reveals a snapshot mismatch — then fix in a separate commit.
- Never `git add -A` or `git add .` — stage specific paths.
- Never push, open PR, or `--amend`.
- Never skip hooks.
- If ANY verification fails first-run, STOP and report.

**Heavy steps.** Task 11 runs `nx test cockpit-registry`, `nx test cockpit-docs`, and 4 cockpit aimock e2es (~8 min total).

---

## File Structure

**Modified per cap (5 files × 9 caps = 45 file touches):**
- `apps/cockpit/scripts/capability-registry.ts` (one shared file; 9 row edits across the per-cap commits)
- `cockpit/<product>/<topic>/python/langgraph.json` × 9
- `cockpit/<product>/<topic>/python/docs/guide.md` × 9
- `cockpit/<product>/<topic>/angular/src/environments/environment.development.ts` × 9
- `cockpit/<product>/<topic>/angular/src/environments/environment.ts` × 9

**Modified cumulatively (1 file):**
- `scripts/update-angular-environments.ts`

**Untouched:**
- All `src/index.ts` files (reference topics + module ids, not assistant ids).
- `libs/cockpit-registry/src/lib/manifest.ts` (references topics, not assistant ids).
- All `project.json` files (reference angular/python project names, not assistant ids).
- Directory paths (stay bare).

---

## Task 0: Pre-flight verify (no commit)

- [ ] **Step 1: Confirm starting state — 9 caps with bare-id-as-assistant**

```bash
grep -E "id: '" apps/cockpit/scripts/capability-registry.ts | python3 -c "
import re, sys
expected_bare = {'spec-rendering','element-rendering','state-management','repeat-loops','computed-functions','planning','filesystem','skills','sandboxes'}
found = set()
for line in sys.stdin:
    m = re.search(r\"id: '([^']*)'\", line)
    if m:
        found.add(m.group(1))
missing = expected_bare - found
extra = (expected_bare & found)
print(f'expected bare ids found: {len(extra)}/9')
if missing: print(f'  MISSING: {sorted(missing)}')
print(f'  present: {sorted(extra)}')
"
```

Expected: `expected bare ids found: 9/9`, then the sorted list. If less than 9, some renames already landed — STOP and re-audit.

- [ ] **Step 2: Confirm starting state — 3 caps already correctly prefixed**

```bash
grep -E "id: 'da-subagents'|id: 'da-memory'|id: 'r-registry'" apps/cockpit/scripts/capability-registry.ts | wc -l
```

Expected: `3`.

- [ ] **Step 3: Confirm node_modules present (worktree may be fresh)**

```bash
test -d node_modules && echo "node_modules OK" || (npm ci 2>&1 | tail -3)
```

Expected: `node_modules OK`. If missing, `npm ci` finishes cleanly (no lockfile changes).

---

## Tasks 1-9: Rename one cap per task

Each task follows the SAME 5-step shape. The plan documents Task 1 in full; Tasks 2-9 reference Task 1's template and provide only the cap-specific substitutions.

### Task 1: rename `spec-rendering` → `r-spec-rendering`

**Files:**
- Modify: `apps/cockpit/scripts/capability-registry.ts`
- Modify: `cockpit/render/spec-rendering/python/langgraph.json`
- Modify: `cockpit/render/spec-rendering/python/docs/guide.md`
- Modify: `cockpit/render/spec-rendering/angular/src/environments/environment.development.ts`
- Modify: `cockpit/render/spec-rendering/angular/src/environments/environment.ts`

- [ ] **Step 1: Pre-flight grep for hidden consumers of `spec-rendering` as an assistant id**

```bash
grep -rn "['\"]spec-rendering['\"]" \
  apps/cockpit/scripts/capability-registry.ts \
  cockpit/render/spec-rendering/ \
  libs/ scripts/ .github/ \
  --include='*.ts' --include='*.json' --include='*.md' --include='*.yml' \
  2>/dev/null | \
  grep -vE "topic:|pythonDir:|angularProject|cockpit-render-spec-rendering-(angular|python)" | \
  grep -v node_modules | grep -v __pycache__ | grep -v test-results
```

Expected: matches in the 5 files listed above (registry, langgraph.json, guide.md, 2 environment files) PLUS update-angular-environments.ts. No other matches in live code. If a surprising match appears (e.g., a snapshot file), STOP and add it to the rename list.

- [ ] **Step 2: Apply 5 edits**

```bash
# 1. capability-registry.ts: id + graphName
sed -i '' "s|id: 'spec-rendering', product: 'render', topic: 'spec-rendering', angularProject: 'cockpit-render-spec-rendering-angular', port: 4401, pythonDir: 'cockpit/render/spec-rendering/python', graphName: 'spec-rendering'|id: 'r-spec-rendering', product: 'render', topic: 'spec-rendering', angularProject: 'cockpit-render-spec-rendering-angular', port: 4401, pythonDir: 'cockpit/render/spec-rendering/python', graphName: 'r-spec-rendering'|" apps/cockpit/scripts/capability-registry.ts

# 2. langgraph.json: graph entry key
python3 -c "
import json
p = 'cockpit/render/spec-rendering/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'r-spec-rendering': d['graphs'].pop('spec-rendering')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

# 3. guide.md: 2 occurrences of literal 'spec-rendering' as assistantId
sed -i '' "s|assistantId: 'spec-rendering'|assistantId: 'r-spec-rendering'|g" cockpit/render/spec-rendering/python/docs/guide.md

# 4 + 5. environment.ts files
sed -i '' "s|streamingAssistantId: 'spec-rendering'|streamingAssistantId: 'r-spec-rendering'|" cockpit/render/spec-rendering/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'spec-rendering'|streamingAssistantId: 'r-spec-rendering'|" cockpit/render/spec-rendering/angular/src/environments/environment.ts
```

- [ ] **Step 3: Verify diff is exactly the expected lockstep change**

```bash
git diff --name-only
```

Expected: exactly these 5 files modified.

```bash
git diff apps/cockpit/scripts/capability-registry.ts | head -10
```

Expected: one line changed with both `id: 'r-spec-rendering'` and `graphName: 'r-spec-rendering'`.

```bash
python3 -c "import json; print(list(json.load(open('cockpit/render/spec-rendering/python/langgraph.json'))['graphs']))"
```

Expected: `['r-spec-rendering']`.

```bash
grep streamingAssistantId cockpit/render/spec-rendering/angular/src/environments/environment.development.ts cockpit/render/spec-rendering/angular/src/environments/environment.ts
```

Expected: both files show `streamingAssistantId: 'r-spec-rendering'`.

```bash
grep "assistantId: 'r-spec-rendering'" cockpit/render/spec-rendering/python/docs/guide.md | wc -l
```

Expected: `2`.

- [ ] **Step 4: Verify capability-registry.ts still parses**

```bash
npx tsc --noEmit apps/cockpit/scripts/capability-registry.ts --skipLibCheck 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/scripts/capability-registry.ts \
        cockpit/render/spec-rendering/python/langgraph.json \
        cockpit/render/spec-rendering/python/docs/guide.md \
        cockpit/render/spec-rendering/angular/src/environments/environment.development.ts \
        cockpit/render/spec-rendering/angular/src/environments/environment.ts
git commit -m "$(cat <<'EOF'
chore(cockpit-render): rename spec-rendering → r-spec-rendering

Adds the r- prefix for consistency with the rest of the render product
(r-registry already prefixed). Updates registry id + graphName, the
per-cap langgraph.json graph key, the guide.md code snippet, and both
Angular environment streamingAssistantId values in lockstep.

Production deploy creates a new LangSmith assistant under `r-spec-rendering`.
The old `spec-rendering` assistant becomes orphaned post-merge; manual
cleanup via LangSmith dashboard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: rename `element-rendering` → `r-element-rendering`

Same 5-step template as Task 1, with these substitutions:

| Placeholder | Value |
|---|---|
| Old id | `element-rendering` |
| New id | `r-element-rendering` |
| Per-cap dir | `cockpit/render/element-rendering` |
| Registry row port | `4401` → `4402` |

- [ ] **Step 1: Pre-flight grep** (same shape, sub `spec-rendering` → `element-rendering`)
- [ ] **Step 2: Apply 5 edits** (same shape):

```bash
sed -i '' "s|id: 'element-rendering', product: 'render', topic: 'element-rendering', angularProject: 'cockpit-render-element-rendering-angular', port: 4402, pythonDir: 'cockpit/render/element-rendering/python', graphName: 'element-rendering'|id: 'r-element-rendering', product: 'render', topic: 'element-rendering', angularProject: 'cockpit-render-element-rendering-angular', port: 4402, pythonDir: 'cockpit/render/element-rendering/python', graphName: 'r-element-rendering'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/render/element-rendering/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'r-element-rendering': d['graphs'].pop('element-rendering')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'element-rendering'|assistantId: 'r-element-rendering'|g" cockpit/render/element-rendering/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'element-rendering'|streamingAssistantId: 'r-element-rendering'|" cockpit/render/element-rendering/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'element-rendering'|streamingAssistantId: 'r-element-rendering'|" cockpit/render/element-rendering/angular/src/environments/environment.ts
```

- [ ] **Step 3-4: Verify** (same checks as Task 1, sub names).
- [ ] **Step 5: Commit** with message `chore(cockpit-render): rename element-rendering → r-element-rendering` (otherwise identical body).

### Task 3: rename `state-management` → `r-state-management`

Substitutions: `state-management` → `r-state-management`, dir `cockpit/render/state-management`, port 4403.

```bash
sed -i '' "s|id: 'state-management', product: 'render', topic: 'state-management', angularProject: 'cockpit-render-state-management-angular', port: 4403, pythonDir: 'cockpit/render/state-management/python', graphName: 'state-management'|id: 'r-state-management', product: 'render', topic: 'state-management', angularProject: 'cockpit-render-state-management-angular', port: 4403, pythonDir: 'cockpit/render/state-management/python', graphName: 'r-state-management'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/render/state-management/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'r-state-management': d['graphs'].pop('state-management')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'state-management'|assistantId: 'r-state-management'|g" cockpit/render/state-management/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'state-management'|streamingAssistantId: 'r-state-management'|" cockpit/render/state-management/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'state-management'|streamingAssistantId: 'r-state-management'|" cockpit/render/state-management/angular/src/environments/environment.ts
```

Then verify + commit `chore(cockpit-render): rename state-management → r-state-management`.

### Task 4: rename `repeat-loops` → `r-repeat-loops`

Substitutions: `repeat-loops` → `r-repeat-loops`, dir `cockpit/render/repeat-loops`, port 4405.

```bash
sed -i '' "s|id: 'repeat-loops', product: 'render', topic: 'repeat-loops', angularProject: 'cockpit-render-repeat-loops-angular', port: 4405, pythonDir: 'cockpit/render/repeat-loops/python', graphName: 'repeat-loops'|id: 'r-repeat-loops', product: 'render', topic: 'repeat-loops', angularProject: 'cockpit-render-repeat-loops-angular', port: 4405, pythonDir: 'cockpit/render/repeat-loops/python', graphName: 'r-repeat-loops'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/render/repeat-loops/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'r-repeat-loops': d['graphs'].pop('repeat-loops')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'repeat-loops'|assistantId: 'r-repeat-loops'|g" cockpit/render/repeat-loops/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'repeat-loops'|streamingAssistantId: 'r-repeat-loops'|" cockpit/render/repeat-loops/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'repeat-loops'|streamingAssistantId: 'r-repeat-loops'|" cockpit/render/repeat-loops/angular/src/environments/environment.ts
```

### Task 5: rename `computed-functions` → `r-computed-functions`

Substitutions: dir `cockpit/render/computed-functions`, port 4406.

```bash
sed -i '' "s|id: 'computed-functions', product: 'render', topic: 'computed-functions', angularProject: 'cockpit-render-computed-functions-angular', port: 4406, pythonDir: 'cockpit/render/computed-functions/python', graphName: 'computed-functions'|id: 'r-computed-functions', product: 'render', topic: 'computed-functions', angularProject: 'cockpit-render-computed-functions-angular', port: 4406, pythonDir: 'cockpit/render/computed-functions/python', graphName: 'r-computed-functions'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/render/computed-functions/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'r-computed-functions': d['graphs'].pop('computed-functions')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'computed-functions'|assistantId: 'r-computed-functions'|g" cockpit/render/computed-functions/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'computed-functions'|streamingAssistantId: 'r-computed-functions'|" cockpit/render/computed-functions/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'computed-functions'|streamingAssistantId: 'r-computed-functions'|" cockpit/render/computed-functions/angular/src/environments/environment.ts
```

### Task 6: rename `planning` → `da-planning`

Substitutions: dir `cockpit/deep-agents/planning`, port 4310.

```bash
sed -i '' "s|id: 'planning', product: 'deep-agents', topic: 'planning', angularProject: 'cockpit-deep-agents-planning-angular', port: 4310, pythonDir: 'cockpit/deep-agents/planning/python', graphName: 'planning'|id: 'da-planning', product: 'deep-agents', topic: 'planning', angularProject: 'cockpit-deep-agents-planning-angular', port: 4310, pythonDir: 'cockpit/deep-agents/planning/python', graphName: 'da-planning'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/deep-agents/planning/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'da-planning': d['graphs'].pop('planning')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'planning'|assistantId: 'da-planning'|g" cockpit/deep-agents/planning/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'planning'|streamingAssistantId: 'da-planning'|" cockpit/deep-agents/planning/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'planning'|streamingAssistantId: 'da-planning'|" cockpit/deep-agents/planning/angular/src/environments/environment.ts
```

### Task 7: rename `filesystem` → `da-filesystem`

Substitutions: dir `cockpit/deep-agents/filesystem`, port 4311.

```bash
sed -i '' "s|id: 'filesystem', product: 'deep-agents', topic: 'filesystem', angularProject: 'cockpit-deep-agents-filesystem-angular', port: 4311, pythonDir: 'cockpit/deep-agents/filesystem/python', graphName: 'filesystem'|id: 'da-filesystem', product: 'deep-agents', topic: 'filesystem', angularProject: 'cockpit-deep-agents-filesystem-angular', port: 4311, pythonDir: 'cockpit/deep-agents/filesystem/python', graphName: 'da-filesystem'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/deep-agents/filesystem/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'da-filesystem': d['graphs'].pop('filesystem')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'filesystem'|assistantId: 'da-filesystem'|g" cockpit/deep-agents/filesystem/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'filesystem'|streamingAssistantId: 'da-filesystem'|" cockpit/deep-agents/filesystem/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'filesystem'|streamingAssistantId: 'da-filesystem'|" cockpit/deep-agents/filesystem/angular/src/environments/environment.ts
```

### Task 8: rename `skills` → `da-skills`

Substitutions: dir `cockpit/deep-agents/skills`, port 4314.

```bash
sed -i '' "s|id: 'skills', product: 'deep-agents', topic: 'skills', angularProject: 'cockpit-deep-agents-skills-angular', port: 4314, pythonDir: 'cockpit/deep-agents/skills/python', graphName: 'skills'|id: 'da-skills', product: 'deep-agents', topic: 'skills', angularProject: 'cockpit-deep-agents-skills-angular', port: 4314, pythonDir: 'cockpit/deep-agents/skills/python', graphName: 'da-skills'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/deep-agents/skills/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'da-skills': d['graphs'].pop('skills')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'skills'|assistantId: 'da-skills'|g" cockpit/deep-agents/skills/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'skills'|streamingAssistantId: 'da-skills'|" cockpit/deep-agents/skills/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'skills'|streamingAssistantId: 'da-skills'|" cockpit/deep-agents/skills/angular/src/environments/environment.ts
```

### Task 9: rename `sandboxes` → `da-sandboxes`

Substitutions: dir `cockpit/deep-agents/sandboxes`, port 4315.

```bash
sed -i '' "s|id: 'sandboxes', product: 'deep-agents', topic: 'sandboxes', angularProject: 'cockpit-deep-agents-sandboxes-angular', port: 4315, pythonDir: 'cockpit/deep-agents/sandboxes/python', graphName: 'sandboxes'|id: 'da-sandboxes', product: 'deep-agents', topic: 'sandboxes', angularProject: 'cockpit-deep-agents-sandboxes-angular', port: 4315, pythonDir: 'cockpit/deep-agents/sandboxes/python', graphName: 'da-sandboxes'|" apps/cockpit/scripts/capability-registry.ts

python3 -c "
import json
p = 'cockpit/deep-agents/sandboxes/python/langgraph.json'
d = json.load(open(p))
d['graphs'] = {'da-sandboxes': d['graphs'].pop('sandboxes')}
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

sed -i '' "s|assistantId: 'sandboxes'|assistantId: 'da-sandboxes'|g" cockpit/deep-agents/sandboxes/python/docs/guide.md
sed -i '' "s|streamingAssistantId: 'sandboxes'|streamingAssistantId: 'da-sandboxes'|" cockpit/deep-agents/sandboxes/angular/src/environments/environment.development.ts
sed -i '' "s|streamingAssistantId: 'sandboxes'|streamingAssistantId: 'da-sandboxes'|" cockpit/deep-agents/sandboxes/angular/src/environments/environment.ts
```

---

## Task 10: Update scripts/update-angular-environments.ts (cumulative)

After Tasks 1-9, this script's hardcoded `assistantId` mappings need updating for the 9 renamed caps.

**Files:**
- Modify: `scripts/update-angular-environments.ts`

- [ ] **Step 1: Apply 9 substitutions**

```bash
sed -i '' \
  -e "s|'cockpit/render/spec-rendering/angular', assistantId: 'spec-rendering'|'cockpit/render/spec-rendering/angular', assistantId: 'r-spec-rendering'|" \
  -e "s|'cockpit/render/element-rendering/angular', assistantId: 'element-rendering'|'cockpit/render/element-rendering/angular', assistantId: 'r-element-rendering'|" \
  -e "s|'cockpit/render/state-management/angular', assistantId: 'state-management'|'cockpit/render/state-management/angular', assistantId: 'r-state-management'|" \
  -e "s|'cockpit/render/repeat-loops/angular', assistantId: 'repeat-loops'|'cockpit/render/repeat-loops/angular', assistantId: 'r-repeat-loops'|" \
  -e "s|'cockpit/render/computed-functions/angular', assistantId: 'computed-functions'|'cockpit/render/computed-functions/angular', assistantId: 'r-computed-functions'|" \
  -e "s|'cockpit/deep-agents/planning/angular', assistantId: 'planning'|'cockpit/deep-agents/planning/angular', assistantId: 'da-planning'|" \
  -e "s|'cockpit/deep-agents/filesystem/angular', assistantId: 'filesystem'|'cockpit/deep-agents/filesystem/angular', assistantId: 'da-filesystem'|" \
  -e "s|'cockpit/deep-agents/skills/angular', assistantId: 'skills'|'cockpit/deep-agents/skills/angular', assistantId: 'da-skills'|" \
  -e "s|'cockpit/deep-agents/sandboxes/angular', assistantId: 'sandboxes'|'cockpit/deep-agents/sandboxes/angular', assistantId: 'da-sandboxes'|" \
  scripts/update-angular-environments.ts
```

- [ ] **Step 2: Verify diff is exactly 9 line changes**

```bash
git diff scripts/update-angular-environments.ts | grep -E '^[+-]' | grep -v '^[+-][+-][+-]' | wc -l
```

Expected: `18` (9 lines removed + 9 lines added). If different, sed missed — investigate.

- [ ] **Step 3: tsc check**

```bash
npx tsc --noEmit scripts/update-angular-environments.ts --skipLibCheck 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/update-angular-environments.ts
git commit -m "$(cat <<'EOF'
chore(scripts): update update-angular-environments.ts for renamed caps

Companion to the 9 per-cap rename commits. Updates the script's
hardcoded assistantId mappings so future re-runs preserve the
correct streamingAssistantId values per environment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Cumulative verification (no commit)

- [ ] **Step 1: Final registry state**

```bash
grep -E "id: '" apps/cockpit/scripts/capability-registry.ts | python3 -c "
import re, sys
expected_render_prefixed = {'r-spec-rendering','r-element-rendering','r-state-management','r-registry','r-repeat-loops','r-computed-functions'}
expected_da_prefixed = {'da-planning','da-filesystem','da-subagents','da-memory','da-skills','da-sandboxes'}
ids = []
for line in sys.stdin:
    m = re.search(r\"id: '([^']*)'\", line)
    if m:
        ids.append(m.group(1))
render = [i for i in ids if i.startswith('r-')]
da = [i for i in ids if i.startswith('da-')]
chat = [i for i in ids if i.startswith('c-')]
print(f'render prefixed: {sorted(render)} (expected 6)')
print(f'da prefixed: {sorted(da)} (expected 6)')
print(f'chat prefixed: {sorted(chat)} (expected 11)')
ok = (set(render) == expected_render_prefixed and set(da) == expected_da_prefixed and len(chat) == 11)
print('ALL EXPECTED' if ok else 'MISMATCH')
import sys; sys.exit(0 if ok else 1)
"
```

Expected: `ALL EXPECTED`. If MISMATCH, the rename is incomplete — STOP.

- [ ] **Step 2: Generated shared-deploy manifest still has 32 graphs with renamed ids**

```bash
npx tsx scripts/generate-shared-deployment-config.ts 2>&1 | tail -2
python3 -c "
import json
d = json.load(open('deployments/shared-dev/langgraph.json'))
expected = {'r-spec-rendering','r-element-rendering','r-state-management','r-registry','r-repeat-loops','r-computed-functions','da-planning','da-filesystem','da-subagents','da-memory','da-skills','da-sandboxes'}
names = set(d['graphs'])
missing = expected - names
unexpected_bare = {'spec-rendering','element-rendering','state-management','repeat-loops','computed-functions','planning','filesystem','skills','sandboxes'} & names
print(f'count={len(names)}')
if missing: print(f'  MISSING new ids: {sorted(missing)}')
if unexpected_bare: print(f'  STILL HAS bare ids: {sorted(unexpected_bare)}')
if not missing and not unexpected_bare:
    print('OK — all 11 prefixed render+da graphs present, no bare-id leakage')
import sys; sys.exit(0 if not missing and not unexpected_bare else 1)
"
git checkout HEAD -- deployments/shared-dev/langgraph.json
```

Expected: `count=32`, `OK — all 11 prefixed render+da graphs present, no bare-id leakage`.

- [ ] **Step 3: Spot-check graph boot for one render + one deep-agents renamed cap**

For c-* type graphs the source-of-truth assistant_id matches the graph name. We need to confirm a per-cap dir launches with the new name.

```bash
set -a; source examples/chat/python/.env 2>/dev/null || source cockpit/langgraph/streaming/python/.env 2>/dev/null; set +a
test -n "$OPENAI_API_KEY" && echo "key OK" || (echo "MISSING — STOP"; exit 1)
```

```bash
(cd cockpit/render/spec-rendering/python && uv sync 2>&1 | tail -1 && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -1)
(cd cockpit/deep-agents/planning/python && uv sync 2>&1 | tail -1 && OPENAI_API_KEY="$OPENAI_API_KEY" uv run python -c "from src.graph import graph; print(type(graph).__name__)" 2>&1 | tail -1)
```

Expected each: `Resolved … packages` (or `Audited …`), then `CompiledStateGraph`.

For one of them, boot langgraph dev to confirm the new graph id registers:

```bash
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
(cd cockpit/render/spec-rendering/python && nohup env OPENAI_API_KEY="$OPENAI_API_KEY" uv run langgraph dev --no-browser --host 127.0.0.1 --port 5500 > /tmp/cap-prefix-lg.log 2>&1 &)
until grep -qE "Application started up" /tmp/cap-prefix-lg.log 2>/dev/null; do sleep 1; done
grep -E "graph_id" /tmp/cap-prefix-lg.log | head -3
lsof -t -i :5500 2>/dev/null | xargs kill -9 2>/dev/null
rm -f /tmp/cap-prefix-lg.log
```

Expected: exactly one `graph_id=r-spec-rendering`. If still shows bare `spec-rendering`, the langgraph.json edit didn't land — STOP.

- [ ] **Step 4: Library tests pass**

```bash
npx nx test cockpit-registry --skip-nx-cache 2>&1 | tail -5
npx nx test cockpit-docs --skip-nx-cache 2>&1 | tail -5
```

Expected: both pass. If a snapshot test fails because it pins the bare ids, those snapshots are stale — the manifest list in `libs/cockpit-registry/src/lib/manifest.ts` uses *topics* (which stay bare), not ids, so likely no snapshot breakage. If broken, document the snapshot location for the orchestrator to update in a follow-up commit before push.

- [ ] **Step 5: Existing cockpit aimock e2es**

```bash
npx nx e2e cockpit-langgraph-streaming-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-tool-calls-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-subagents-angular --skip-nx-cache \
  && npx nx e2e cockpit-chat-interrupts-angular --skip-nx-cache
```

Expected: all four pass. None of them touch renamed caps' graphs; they just share the cockpit app runtime.

- [ ] **Step 6: Final reference grep — confirm zero bare-as-assistant references in live code**

```bash
for id in spec-rendering element-rendering state-management repeat-loops computed-functions planning filesystem skills sandboxes; do
  count=$(grep -rn "['\"]$id['\"]" apps/cockpit/ cockpit/ libs/ scripts/ .github/ \
    --include='*.ts' --include='*.json' --include='*.md' 2>/dev/null | \
    grep -v node_modules | grep -v __pycache__ | grep -v dist | grep -v test-results | \
    grep -vE "topic: '$id'|pythonDir: 'cockpit/.*/$id/python'|cockpit-(render|deep-agents)-$id-(angular|python)|runtimeUrl: '[^']*/$id'|'core-capabilities/$id|/$id/python/|/$id/angular/" | \
    wc -l | tr -d ' ')
  echo "  bare '$id' as-assistant: $count residual ref(s)"
done
```

Expected: each shows `0 residual ref(s)`. (The exclusion regex removes legitimate topic-name references like dir paths, project names, runtime URLs.) If any shows >0, investigate.

---

## Task 12: Push, open PR, watch CI, merge

Orchestrator task. Implementer STOPS after Task 11.

- [ ] **Step 1: Push**

```bash
cd /tmp/cap-prefixes
git push -u origin claude/cap-prefix-unification
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --head claude/cap-prefix-unification --title "chore(cockpit): unify render + deep-agents cap prefixes (r-* / da-*)" --body "$(cat <<'EOF'
## Summary
Brings render and deep-agents cap assistant ids to the uniform prefix scheme chat already uses (\`c-*\`). 9 caps renamed; 3 already-prefixed caps unchanged.

| Product | After |
|---|---|
| chat (11) | \`c-*\` (unchanged) |
| deep-agents (6) | \`da-*\` — newly: \`da-planning\`, \`da-filesystem\`, \`da-skills\`, \`da-sandboxes\` |
| render (6) | \`r-*\` — newly: \`r-spec-rendering\`, \`r-element-rendering\`, \`r-state-management\`, \`r-repeat-loops\`, \`r-computed-functions\` |
| langgraph (8) | bare (no collisions; intentionally unchanged) |

Each rename touches 5 files in lockstep per the post-PR-#432 discipline (registry id+graphName, langgraph.json graph key, guide.md code snippet × 2 lines, both Angular environments). Plus one cumulative commit updating \`scripts/update-angular-environments.ts\`.

## Test plan
- [x] 32-graph shared-deploy manifest with all 11 new prefixed ids, no bare-id leakage
- [x] Spot-check graph boot for r-spec-rendering + da-planning (CompiledStateGraph imports clean; langgraph dev registers correctly)
- [x] \`nx test cockpit-registry\` + \`nx test cockpit-docs\` pass
- [x] 4 cockpit aimock e2es pass
- [x] Final reference grep finds zero bare-as-assistant residuals
- [ ] CI Cockpit gates green
- [ ] Post-merge: Deploy LangGraph green (9 new assistants created on LangSmith Cloud)

## Post-merge cleanup
9 old assistants (\`spec-rendering, element-rendering, state-management, repeat-loops, computed-functions, planning, filesystem, skills, sandboxes\`) become orphaned on LangSmith Cloud. Manual dashboard cleanup by a human.

## CI noise
Per the user's standing warning, parallel domain changes may keep unrelated CI red. Real signal here is Cockpit gates + post-merge Deploy LangGraph. Local verification (Task 11) ran clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR#>
```

If Cockpit gates pass, merge. If only unrelated jobs fail, admin-merge as on PR #445.

- [ ] **Step 4: Merge**

```bash
gh pr merge <PR#> --squash --delete-branch
# or --admin --squash --delete-branch if branch protection blocks
```

- [ ] **Step 5: Post-merge watch for Deploy LangGraph**

```bash
gh run list --workflow=deploy-langgraph.yml --limit 1 --json status,conclusion,url
```

If success: chain complete for Threads B + C. If fail: 9 new assistants weren't accepted by LangSmith — inspect log; most likely cause is a name collision or invalid characters.

- [ ] **Step 6: Cleanup worktree**

```bash
cd /Users/blove/repos/angular-agent-framework
git worktree remove --force /tmp/cap-prefixes
```

---

## Self-review notes

**Spec coverage:**
- 9 cap renames in lockstep → Tasks 1-9.
- `scripts/update-angular-environments.ts` updates → Task 10.
- 32-graph manifest with renamed ids → Task 11 Step 2.
- Graph boot verification → Task 11 Step 3.
- Library tests → Task 11 Step 4.
- Cockpit aimock e2e regression → Task 11 Step 5.
- Final grep → Task 11 Step 6.

**Placeholder scan:** none. Every step has exact code + expected output.

**Type consistency:** all 9 rename pairs explicitly documented; assistant_id consistently in both `id` + `graphName` fields per row; `streamingAssistantId` consistently updated across both env files per cap; langgraph.json graph key always matches new id.

**Concurrency note:** dedicated worktree at `/tmp/cap-prefixes`. Per-task branch confirmation after long-running steps.
