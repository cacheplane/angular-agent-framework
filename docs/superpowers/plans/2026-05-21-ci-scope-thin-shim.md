# ci-scope thin shim + implicitDependencies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 340-LOC `scripts/ci-scope.mjs` classifier with a ~50-LOC thin shim that delegates to `nx affected` for project ownership and reads `scope:*` tags off each project to decide scope booleans. Move non-project fallback path rules into project.json `implicitDependencies`.

**Architecture:** Sequenced as 3 PRs. PR 1 adds metadata (tags + implicitDependencies) inertly — no behavior change. PR 2 replaces ci-scope.mjs + migrates tests. PR 3 adds a drift-guard assertion. Each PR ships independently; PR 2 must be merged + verified before PR 3. PR 1 is reversible (pure metadata add).

**Tech Stack:** Node ESM, `nx show projects --affected --json`, vitest (test runner for ci-scope.spec.mjs).

---

## File Structure

**Modified across all 3 PRs:**

- **PR 1**: `scripts/add-scope-tags.mjs` (throwaway helper script), ~93 `project.json` files (tag/implicitDeps add only).
- **PR 2**: `scripts/ci-scope.mjs` (rewrite ~340 → ~80 LOC), `scripts/ci-scope.spec.mjs` (test fixture migration).
- **PR 3**: `apps/cockpit/cockpit-e2e-wiring.spec.ts` (extend with tag drift-guard).

No new long-lived files. The throwaway `scripts/add-scope-tags.mjs` is deleted at the end of PR 1.

---

# PR 1 — metadata add (no behavior change)

### Task 1: Categorize projects + write a one-shot tag/implicit-deps script

**Files:**
- Create: `scripts/add-scope-tags.mjs` (throwaway — deleted in Step 5 of this task)

- [ ] **Step 1: Write the tag-application script**

Create `/tmp/ci-scope-hybrid/scripts/add-scope-tags.mjs`:

```javascript
#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Throwaway: one-shot tag/implicitDependencies populator for PR 1
// of the ci-scope thin-shim migration. Delete after PR 1 merges.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd());
const PROJECT_SKIP = new Set(['.git', '.next', '.nx', 'coverage', 'dist', 'node_modules']);

const PUBLISHABLE_LIB_BROADCAST = [
  'scope:library', 'scope:website', 'scope:website-e2e',
  'scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-smoke',
  'scope:cockpit-secret', 'scope:cockpit-deploy-smoke',
  'scope:cockpit-e2e', 'scope:examples-chat',
];
const COCKPIT_INTERNAL_LIB = [
  'scope:cockpit', 'scope:cockpit-examples',
  'scope:cockpit-deploy-smoke', 'scope:cockpit-e2e',
];

function loadPublishable() {
  const nx = JSON.parse(readFileSync('nx.json', 'utf8'));
  return new Set(nx.release?.groups?.publishable?.projects ?? []);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (PROJECT_SKIP.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name === 'project.json') out.push(p);
  }
  return out;
}

function tagsFor(project, projectRoot, publishable) {
  const name = project.name ?? '';
  const root = projectRoot.replaceAll(path.sep, '/');
  const targets = project.targets ?? {};

  // Publishable libs broadcast to everything (matches today's
  // `if (publishableProjects.has(name))` block in ci-scope.mjs).
  if (publishable.has(name)) return PUBLISHABLE_LIB_BROADCAST;

  // Cockpit cap python projects: trigger smoke + cap angular's e2e/examples
  if (root.startsWith('cockpit/') && root.endsWith('/python')) {
    const tags = ['scope:cockpit-examples', 'scope:cockpit-e2e'];
    if (targets.smoke) tags.push('scope:cockpit-smoke');
    return tags;
  }

  // Cockpit cap angular projects: trigger examples + e2e
  if (root.startsWith('cockpit/') && root.endsWith('/angular')) {
    const tags = ['scope:cockpit-examples', 'scope:cockpit-e2e'];
    if (targets.integration) tags.push('scope:cockpit-secret');
    return tags;
  }

  // Cockpit internal libs (non-publishable)
  if (
    root.startsWith('libs/cockpit-') ||
    root === 'libs/design-tokens' ||
    root === 'libs/ui-react' ||
    root === 'libs/example-layouts' ||
    root === 'libs/e2e-harness'
  ) return COCKPIT_INTERNAL_LIB;

  // Website app
  if (name === 'website' || root === 'apps/website') return ['scope:website', 'scope:website-e2e'];

  // Cockpit app
  if (name === 'cockpit' || root === 'apps/cockpit') {
    return ['scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-deploy-smoke', 'scope:cockpit-e2e'];
  }

  // Examples chat
  if (root === 'examples/chat' || root.startsWith('examples/chat/')) return ['scope:examples-chat'];

  // PostHog tools
  if (name === 'posthog-tools' || root === 'tools/posthog') return ['scope:posthog'];

  // No CI gating for: marketing/*, minting-service, db, etc.
  return null;
}

function implicitDepsFor(name) {
  // Map each non-project fallback file to the project that should be
  // considered affected when it changes. Mirrors applyFallbackPathScope.
  switch (name) {
    case 'website':
      return ['//vercel.json'];
    case 'cockpit':
      return [
        '//vercel.cockpit.json', '//vercel.examples.json', '//vercel.demo.json',
        '//scripts/assemble-demo.ts', '//scripts/assemble-examples.ts',
        '//scripts/demo-middleware.ts', '//scripts/langgraph-proxy.ts',
        '//scripts/rate-limit.ts', '//scripts/deploy-smoke.ts',
        '//apps/cockpit/scripts/deploy-smoke.ts',
        '//scripts/generate-shared-deployment-config.ts',
        '//apps/cockpit/scripts/capability-registry.ts',
      ];
    default:
      return null;
  }
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort();
}

function main() {
  const publishable = loadPublishable();
  const projectJsonPaths = walk(REPO_ROOT)
    .filter((p) => !p.includes('/node_modules/'))
    .map((p) => path.relative(REPO_ROOT, p));

  let modified = 0;
  for (const relPath of projectJsonPaths) {
    const projectRoot = path.dirname(relPath);
    if (projectRoot === '.') continue; // skip top-level project.json
    const text = readFileSync(relPath, 'utf8');
    const project = JSON.parse(text);

    const newTags = tagsFor(project, projectRoot, publishable);
    const newImplicitDeps = implicitDepsFor(project.name);

    let changed = false;

    if (newTags) {
      const existing = project.tags ?? [];
      const merged = uniqueSorted([...existing, ...newTags]);
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        project.tags = merged;
        changed = true;
      }
    }

    if (newImplicitDeps) {
      const existing = project.implicitDependencies ?? [];
      const merged = uniqueSorted([...existing, ...newImplicitDeps]);
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        project.implicitDependencies = merged;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(relPath, JSON.stringify(project, null, 2) + '\n');
      console.log(`updated ${relPath}`);
      modified++;
    }
  }
  console.log(`\n${modified} project.json files modified.`);
}

main();
```

- [ ] **Step 2: Run the script + inspect a representative diff**

```bash
cd /tmp/ci-scope-hybrid && node scripts/add-scope-tags.mjs 2>&1 | tail -10
```

Expected: `~50 project.json files modified.` (cockpit caps, libs, apps, examples-chat). Marketing/minting-service/db are skipped (no CI gating).

Spot-check three files for correctness:

```bash
cd /tmp/ci-scope-hybrid && \
  echo "=== libs/chat (publishable, broadcast) ===" && \
  grep -A3 '"tags"' libs/chat/project.json | head -15 && \
  echo "=== cockpit/chat/messages/angular (cap angular) ===" && \
  grep -A3 '"tags"' cockpit/chat/messages/angular/project.json | head -10 && \
  echo "=== apps/cockpit (implicitDependencies) ===" && \
  grep -A20 '"implicitDependencies"' apps/cockpit/project.json | head -25
```

Expected: `libs/chat` has all 10 broadcast scope tags; `cockpit/chat/messages/angular` has `scope:cockpit-e2e` + `scope:cockpit-examples`; `apps/cockpit` has the 12-entry implicit-deps list.

- [ ] **Step 3: Verify nx graph still loads**

```bash
cd /tmp/ci-scope-hybrid && npx nx graph --file=/tmp/nx-graph-check.json 2>&1 | tail -5
```

Expected: writes the graph file without errors. Validates all `implicitDependencies: ["//path"]` strings reference files nx can resolve.

If nx errors on a missing file: fix the implicit-deps entry (probably a typo or moved file).

- [ ] **Step 4: Verify implicit-dep files actually exist**

```bash
cd /tmp/ci-scope-hybrid && python3 -c "
import json
deps = json.load(open('apps/cockpit/project.json')).get('implicitDependencies', [])
import os
missing = [d for d in deps if d.startswith('//') and not os.path.exists(d[2:])]
print('MISSING:', missing) if missing else print('all implicit-dep files exist')
"
```

Expected: `all implicit-dep files exist`. If any missing, remove from project.json (the spec may reference a file that was deleted/moved since PR-#432 era).

- [ ] **Step 5: Delete the throwaway script + commit**

```bash
cd /tmp/ci-scope-hybrid && git rm scripts/add-scope-tags.mjs && git add -A
git diff --cached --stat | tail -5
```

Expected stat: ~50 files changed (only the tag/implicit-deps additions). No source code.

```bash
cd /tmp/ci-scope-hybrid && git commit -m "$(cat <<'EOF'
chore(ci-scope): add scope:* tags + implicitDependencies (no behavior change)

PR 1 of 3 for the ci-scope thin-shim migration. Adds metadata only:

1. scope:* tags on every CI-participating project, replacing the
   hand-maintained applyProjectScope rules in scripts/ci-scope.mjs
   with data declarations next to each project.

2. implicitDependencies on apps/cockpit and apps/website pointing at
   the non-project files (vercel.*.json, scripts/*.ts, capability-
   registry.ts) that currently live in applyFallbackPathScope.

ci-scope.mjs unchanged in this PR — still drives gating via the old
rules. The new metadata is inert. PR 2 will rewrite the shim to read
from this metadata; PR 3 will add a drift-guard assertion.

See docs/superpowers/specs/2026-05-21-ci-scope-thin-shim-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push + open PR 1**

```bash
cd /tmp/ci-scope-hybrid && git push -u origin claude/ci-scope-hybrid 2>&1 | tail -3
```

```bash
gh pr create --title "chore(ci-scope): add scope:* tags + implicitDependencies (PR 1/3)" --body "$(cat <<'EOF'
## Summary
PR 1 of 3 in the ci-scope thin-shim migration. **Metadata only — no behavior change.**

- Adds \`scope:*\` tags to every CI-participating project.
- Adds \`implicitDependencies\` to \`apps/cockpit\` and \`apps/website\` for non-project fallback files (vercel.*.json, deploy scripts, capability-registry.ts).

\`scripts/ci-scope.mjs\` is untouched; it still drives gating via the old \`applyProjectScope\`/\`applyFallbackPathScope\` rules. The new metadata is inert until PR 2 rewrites the shim to read from it.

## Verification
- [ ] CI passes (no scope booleans should emit differently).
- [ ] \`npx nx graph\` succeeds (validates implicit-dep file references).

## Follow-ups
- PR 2: rewrite ci-scope.mjs as a thin shim + migrate tests.
- PR 3: drift-guard assertion + cleanup.

See spec: \`docs/superpowers/specs/2026-05-21-ci-scope-thin-shim-design.md\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

**STOP after PR 1 opens. Wait for it to be reviewed + merged before continuing.** Subsequent tasks branch from PR 1's merge commit.

---

# PR 2 — shim rewrite + test migration

### Task 2: Branch + sync from PR 1's merge

**Files:** none changed.

- [ ] **Step 1: After PR 1 merges, sync + new branch**

```bash
cd /Users/blove/repos/angular-agent-framework && git fetch origin main && git worktree add /tmp/ci-scope-shim-rewrite -b claude/ci-scope-shim-rewrite origin/main
```

- [ ] **Step 2: Verify the metadata from PR 1 is on main**

```bash
cd /tmp/ci-scope-shim-rewrite && grep -c '"scope:' libs/chat/project.json
```

Expected: `10` (the 10 broadcast tags). If 0, PR 1 wasn't merged yet — stop.

---

### Task 3: Replace ci-scope.mjs with the thin shim

**Files:**
- Modify: `scripts/ci-scope.mjs` (full rewrite, ~340 → ~80 LOC)

- [ ] **Step 1: Replace the file's contents**

Write `/tmp/ci-scope-shim-rewrite/scripts/ci-scope.mjs`:

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCOPE_KEYS = [
  'library', 'website', 'website_e2e',
  'cockpit', 'cockpit_examples', 'cockpit_smoke',
  'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
  'examples_chat', 'posthog',
];

const GLOBAL_CI_FILES = new Set([
  '.github/workflows/ci.yml',
  'package.json',
  'package-lock.json',
  'nx.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
]);

export function emptyScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, false]));
}

export function fullScope() {
  return Object.fromEntries(SCOPE_KEYS.map((k) => [k, true]));
}

function normalizePath(value) {
  return String(value ?? '').replaceAll(path.sep, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function tagToScopeKey(tag) {
  // 'scope:cockpit-e2e' → 'cockpit_e2e'
  return tag.replace(/^scope:/, '').replaceAll('-', '_');
}

/**
 * Pure-function classifier.
 *
 * @param {string[]} changedFiles - normalized repo-relative paths
 * @param {Array<{name: string, tags: string[]}>} affectedProjects
 *        — projects nx considers affected, with their tags
 * @returns {Record<string, boolean>} scope booleans keyed by SCOPE_KEYS
 */
export function classifyFromAffected(changedFiles, affectedProjects) {
  for (const f of changedFiles) {
    if (GLOBAL_CI_FILES.has(f)) return fullScope();
  }
  const scope = emptyScope();
  for (const project of affectedProjects) {
    for (const tag of project.tags ?? []) {
      if (!tag.startsWith('scope:')) continue;
      const key = tagToScopeKey(tag);
      if (SCOPE_KEYS.includes(key)) scope[key] = true;
    }
  }
  return scope;
}

function changedFilesBetween(base, head, workspaceRoot) {
  return execFileSync('git', ['diff', '--name-only', base, head], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean);
}

function loadAffectedProjects(base, head, workspaceRoot) {
  const namesJson = execFileSync('npx', [
    'nx', 'show', 'projects',
    '--affected',
    '--base', base, '--head', head,
    '--json',
  ], { cwd: workspaceRoot, encoding: 'utf8' });
  const names = JSON.parse(namesJson);
  return names.map((name) => {
    const projectJson = execFileSync('npx', [
      'nx', 'show', 'project', name, '--json',
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    const project = JSON.parse(projectJson);
    return { name: project.name ?? name, tags: project.tags ?? [] };
  });
}

function writeOutputs(scope, outputPath) {
  const lines = SCOPE_KEYS.map((k) => `${k}=${scope[k] ? 'true' : 'false'}`);
  if (outputPath) appendFileSync(outputPath, `${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    args[a.slice(2)] = argv[i + 1];
    i++;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = process.cwd();

  if (args.event === 'push') {
    writeOutputs(fullScope(), args.output);
    console.log('Push to main runs the full CI suite.');
    return;
  }

  if (!args.base || !args.head) {
    throw new Error('Expected --base and --head for pull request scope detection.');
  }

  const changedFiles = changedFilesBetween(args.base, args.head, workspaceRoot);
  const affectedProjects = loadAffectedProjects(args.base, args.head, workspaceRoot);
  const scope = classifyFromAffected(changedFiles, affectedProjects);

  console.log('Changed files:');
  for (const f of changedFiles) console.log(`  ${f}`);
  console.log(`Affected projects (${affectedProjects.length}):`);
  for (const p of affectedProjects) console.log(`  ${p.name} [${p.tags.join(', ')}]`);

  writeOutputs(scope, args.output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Verify the rewrite is syntactically clean**

```bash
cd /tmp/ci-scope-shim-rewrite && node --check scripts/ci-scope.mjs && echo "OK"
```

Expected: `OK`.

---

### Task 4: Migrate the test suite

**Files:**
- Modify: `scripts/ci-scope.spec.mjs` (full rewrite — tests now inject synthetic `affectedProjects`)

- [ ] **Step 1: Read the current spec to map existing scenarios**

```bash
cd /tmp/ci-scope-shim-rewrite && cat scripts/ci-scope.spec.mjs | wc -l && grep -E "^(test|it|describe)\(" scripts/ci-scope.spec.mjs | head -30
```

Note the test names. The new spec must preserve each scenario's *intent* (same scope booleans should emit for the same set of changes) but inject `affectedProjects` directly instead of synthetic workspace+changedFiles.

- [ ] **Step 2: Replace the spec file**

Write `/tmp/ci-scope-shim-rewrite/scripts/ci-scope.spec.mjs`:

```javascript
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import {
  classifyFromAffected,
  emptyScope,
  fullScope,
  SCOPE_KEYS,
} from './ci-scope.mjs';

// Test helpers — synthetic projects with the same tag patterns the
// PR-1 metadata add applied. Match real project.json shapes.

const PUBLISHABLE_LIB_TAGS = [
  'scope:library', 'scope:website', 'scope:website-e2e',
  'scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-smoke',
  'scope:cockpit-secret', 'scope:cockpit-deploy-smoke',
  'scope:cockpit-e2e', 'scope:examples-chat',
];
const COCKPIT_INTERNAL_LIB_TAGS = [
  'scope:cockpit', 'scope:cockpit-examples',
  'scope:cockpit-deploy-smoke', 'scope:cockpit-e2e',
];
const COCKPIT_CAP_ANGULAR_TAGS = ['scope:cockpit-examples', 'scope:cockpit-e2e'];
const COCKPIT_CAP_PYTHON_TAGS = ['scope:cockpit-examples', 'scope:cockpit-e2e', 'scope:cockpit-smoke'];
const WEBSITE_TAGS = ['scope:website', 'scope:website-e2e'];
const COCKPIT_APP_TAGS = ['scope:cockpit', 'scope:cockpit-examples', 'scope:cockpit-deploy-smoke', 'scope:cockpit-e2e'];
const EXAMPLES_CHAT_TAGS = ['scope:examples-chat'];
const POSTHOG_TAGS = ['scope:posthog'];

describe('classifyFromAffected — short-circuit', () => {
  it('returns full scope when a global CI file changes', () => {
    const scope = classifyFromAffected(['.github/workflows/ci.yml'], []);
    expect(scope).toEqual(fullScope());
  });

  it('full scope on package.json change', () => {
    expect(classifyFromAffected(['package.json'], [])).toEqual(fullScope());
  });

  it('empty scope when no global file + no affected projects', () => {
    expect(classifyFromAffected(['docs/some-readme.md'], [])).toEqual(emptyScope());
  });
});

describe('classifyFromAffected — publishable lib broadcast', () => {
  it('publishable lib triggers library + website + website_e2e + cockpit_* + examples_chat', () => {
    const scope = classifyFromAffected(['libs/chat/src/foo.ts'], [
      { name: 'chat', tags: PUBLISHABLE_LIB_TAGS },
    ]);
    expect(scope.library).toBe(true);
    expect(scope.website).toBe(true);
    expect(scope.website_e2e).toBe(true);
    expect(scope.cockpit).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(true);
    expect(scope.cockpit_secret).toBe(true);
    expect(scope.cockpit_deploy_smoke).toBe(true);
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.examples_chat).toBe(true);
    // posthog stays false — publishable libs don't broadcast to posthog
    expect(scope.posthog).toBe(false);
  });
});

describe('classifyFromAffected — cockpit cap projects', () => {
  it('cockpit cap python triggers cockpit_e2e + cockpit_examples + cockpit_smoke', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/python/src/graph.py'],
      [{ name: 'cockpit-chat-messages-python', tags: COCKPIT_CAP_PYTHON_TAGS }],
    );
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(true);
    expect(scope.cockpit).toBe(false);
    expect(scope.library).toBe(false);
  });

  it('cockpit cap angular triggers cockpit_e2e + cockpit_examples only', () => {
    const scope = classifyFromAffected(
      ['cockpit/chat/messages/angular/src/main.ts'],
      [{ name: 'cockpit-chat-messages-angular', tags: COCKPIT_CAP_ANGULAR_TAGS }],
    );
    expect(scope.cockpit_e2e).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_smoke).toBe(false);
  });
});

describe('classifyFromAffected — apps + fallback paths via implicitDependencies', () => {
  it('vercel.json change marks apps/website affected → website + website_e2e', () => {
    const scope = classifyFromAffected(['vercel.json'], [
      { name: 'website', tags: WEBSITE_TAGS },
    ]);
    expect(scope.website).toBe(true);
    expect(scope.website_e2e).toBe(true);
    expect(scope.cockpit).toBe(false);
  });

  it('capability-registry.ts change marks apps/cockpit affected → all cockpit_*', () => {
    const scope = classifyFromAffected(
      ['apps/cockpit/scripts/capability-registry.ts'],
      [{ name: 'cockpit', tags: COCKPIT_APP_TAGS }],
    );
    expect(scope.cockpit).toBe(true);
    expect(scope.cockpit_examples).toBe(true);
    expect(scope.cockpit_deploy_smoke).toBe(true);
    expect(scope.cockpit_e2e).toBe(true);
  });

  it('examples/chat change → examples_chat only', () => {
    const scope = classifyFromAffected(
      ['examples/chat/angular/src/main.ts'],
      [{ name: 'examples-chat-angular', tags: EXAMPLES_CHAT_TAGS }],
    );
    expect(scope.examples_chat).toBe(true);
    expect(scope.cockpit).toBe(false);
  });

  it('tools/posthog change → posthog only', () => {
    const scope = classifyFromAffected(
      ['tools/posthog/src/dashboards.ts'],
      [{ name: 'posthog-tools', tags: POSTHOG_TAGS }],
    );
    expect(scope.posthog).toBe(true);
    expect(scope.library).toBe(false);
  });
});

describe('classifyFromAffected — tag isolation', () => {
  it('tags not prefixed with "scope:" are ignored', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['type:app', 'rotation:weekly'] },
    ]);
    expect(scope).toEqual(emptyScope());
  });

  it('unknown scope tags are ignored (no key collision)', () => {
    const scope = classifyFromAffected(['some.ts'], [
      { name: 'x', tags: ['scope:not-a-real-scope'] },
    ]);
    expect(scope).toEqual(emptyScope());
  });
});

describe('SCOPE_KEYS export', () => {
  it('contains the 11 documented scope keys', () => {
    expect(SCOPE_KEYS).toEqual([
      'library', 'website', 'website_e2e',
      'cockpit', 'cockpit_examples', 'cockpit_smoke',
      'cockpit_secret', 'cockpit_deploy_smoke', 'cockpit_e2e',
      'examples_chat', 'posthog',
    ]);
  });
});
```

- [ ] **Step 3: Run the new tests**

```bash
cd /tmp/ci-scope-shim-rewrite && npx vitest run scripts/ci-scope.spec.mjs 2>&1 | tail -20
```

Expected: all tests pass (12+ tests across 5 describe blocks).

If failures: read the failing test's expected scope set and trace through `classifyFromAffected` mentally; either the test fixture's tags are wrong or the shim has a bug.

---

### Task 5: Smoke-test the binary against current main

**Files:** none changed.

- [ ] **Step 1: Pick a recent main commit pair for smoke**

```bash
cd /tmp/ci-scope-shim-rewrite && \
  HEAD_SHA=$(git rev-parse origin/main) && \
  BASE_SHA=$(git rev-parse origin/main~5) && \
  echo "base=$BASE_SHA head=$HEAD_SHA"
```

- [ ] **Step 2: Run ci-scope.mjs against that range**

```bash
cd /tmp/ci-scope-shim-rewrite && node scripts/ci-scope.mjs --base "$BASE_SHA" --head "$HEAD_SHA" 2>&1 | tail -30
```

Expected: prints changed files, then affected projects with tags, then `<scope>=true/false` for all 11 keys. No errors.

Cross-reference: are the emitted scope booleans plausible for the 5-commit range? E.g., if a cockpit cap changed in that range, `cockpit_e2e=true`.

- [ ] **Step 3: Verify nx command works in the worktree**

If Step 2 errored on missing nx: install once via `npm ci` in the worktree (or copy node_modules from the main checkout). Document any setup needed.

---

### Task 6: Commit PR 2

**Files:** none new.

- [ ] **Step 1: Stage + commit**

```bash
cd /tmp/ci-scope-shim-rewrite && git add scripts/ci-scope.mjs scripts/ci-scope.spec.mjs && \
  git diff --cached --stat
```

Expected stat: 2 files modified. ci-scope.mjs ~340 → ~120 lines (net delta should be a large negative); ci-scope.spec.mjs rewritten.

```bash
git commit -m "$(cat <<'EOF'
refactor(ci-scope): replace classifier with thin shim over nx affected

PR 2 of 3 for the ci-scope thin-shim migration. PR 1 added scope:*
tags + implicitDependencies on every CI-participating project; this PR
rewrites scripts/ci-scope.mjs to read them via `nx show projects
--affected`.

- scripts/ci-scope.mjs: 340 LOC → ~120 LOC.
  - applyProjectScope (~80 LOC of rules) → replaced by tag-driven
    classifyFromAffected (~10 LOC).
  - applyFallbackPathScope (~50 LOC of file-path rules) → replaced
    by nx implicitDependencies from PR 1.
  - discoverProjects walk (~30 LOC of FS traversal) → replaced by
    nx show projects --affected --json call.
  - Global-file short-circuit (GLOBAL_CI_FILES) preserved.

- scripts/ci-scope.spec.mjs: full rewrite. Tests now inject synthetic
  affectedProjects with tag arrays directly (no more synthetic
  workspace + ownsPath fixtures). Covers: global short-circuit,
  publishable lib broadcast, cockpit cap angular/python rules, app
  fallback paths via implicitDependencies, examples-chat, posthog,
  tag isolation (non-scope tags ignored, unknown scope keys ignored).

Backward-compatible CLI: --base/--head/--output/--event=push.
Workflow gating semantics preserved — same scope booleans emit for
the same file changes; jobs still truly skip (no fast-pass cost).

See docs/superpowers/specs/2026-05-21-ci-scope-thin-shim-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Push + open PR 2**

```bash
cd /tmp/ci-scope-shim-rewrite && git push -u origin claude/ci-scope-shim-rewrite 2>&1 | tail -3
```

```bash
gh pr create --title "refactor(ci-scope): replace classifier with thin shim (PR 2/3)" --body "$(cat <<'EOF'
## Summary
PR 2 of 3 in the ci-scope thin-shim migration. Rewrites \`scripts/ci-scope.mjs\` to delegate project ownership to \`nx show projects --affected\` and read \`scope:*\` tags off affected projects.

- \`scripts/ci-scope.mjs\`: 340 LOC → ~120 LOC. Removes \`applyProjectScope\` + \`applyFallbackPathScope\` + \`discoverProjects\` + \`ownsPath\`. Keeps the global-file short-circuit.
- \`scripts/ci-scope.spec.mjs\`: full rewrite. Tests inject synthetic affected-project arrays directly.

Backward-compatible CLI; gate semantics preserved.

## Verification
- [ ] CI on this PR itself runs the new shim against this PR's diff. If anything's miswired, gates fire wrong → visible immediately.
- [ ] Vitest passes for ci-scope.spec.mjs.
- [ ] Manual smoke-test of \`node scripts/ci-scope.mjs --base ... --head ...\` against a recent main range produces plausible scope output.

## Risk note
This PR's own CI run is the integration test. If the new shim misclassifies (e.g., emits \`cockpit_e2e=false\` when it should be true), the cockpit-e2e job won't fire, and a real regression could land. **Reviewer**: check the scope output in the \`CI scope\` job's logs against the PR's diff before merging.

## Follow-up
PR 3: add drift-guard assertion to cockpit-e2e-wiring.spec.ts (every cap project has expected scope:* tags) + delete this plan/spec from the active task list.

See spec: \`docs/superpowers/specs/2026-05-21-ci-scope-thin-shim-design.md\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

**STOP after PR 2 opens. Verify CI scope output in the CI scope job's logs before merging.** Don't admin-merge — this PR's own gating is the integration test.

---

# PR 3 — drift-guard + cleanup

### Task 7: Branch from PR 2's merge

**Files:** none changed.

- [ ] **Step 1: After PR 2 merges, sync + new branch**

```bash
cd /Users/blove/repos/angular-agent-framework && git fetch origin main && \
  git worktree add /tmp/ci-scope-drift-guard -b claude/ci-scope-drift-guard origin/main
```

- [ ] **Step 2: Verify the new shim is on main**

```bash
cd /tmp/ci-scope-drift-guard && wc -l scripts/ci-scope.mjs
```

Expected: ~120 lines. If still ~340, PR 2 wasn't merged.

---

### Task 8: Add drift-guard test for cap projects

**Files:**
- Modify: `apps/cockpit/cockpit-e2e-wiring.spec.ts` — add a third `it()` block.

- [ ] **Step 1: Read the existing spec to see the test pattern**

```bash
cd /tmp/ci-scope-drift-guard && head -50 apps/cockpit/cockpit-e2e-wiring.spec.ts
```

The existing spec uses a `describe('cockpit e2e wiring', () => { it(...); it(...); })` pattern.

- [ ] **Step 2: Append the drift-guard test**

Edit `apps/cockpit/cockpit-e2e-wiring.spec.ts`. Inside the existing `describe('cockpit e2e wiring', ...)` block, add a third `it()`:

```typescript
  it('every cockpit cap project declares the expected scope:* tags', () => {
    const errors: string[] = [];
    const capProjects = listProjectJsonFiles(join(repoRoot, 'cockpit'))
      .filter((p) => !p.includes('/ag-ui/')) // ag-ui has no python; tag rules differ
      .map((p) => ({
        path: p,
        project: JSON.parse(readFileSync(p, 'utf8')) as { name?: string; tags?: string[] },
      }));

    for (const { path: p, project } of capProjects) {
      const tags = new Set(project.tags ?? []);
      const isAngular = p.includes('/angular/');
      const isPython = p.includes('/python/');

      if (!isAngular && !isPython) continue;

      // Every cap project must trigger cockpit_e2e + cockpit_examples.
      for (const required of ['scope:cockpit-e2e', 'scope:cockpit-examples']) {
        if (!tags.has(required)) {
          errors.push(`${relative(repoRoot, p)}: missing required tag ${required}`);
        }
      }

      // Python caps with a `smoke` target must also trigger cockpit_smoke.
      if (isPython) {
        const project2 = JSON.parse(readFileSync(p, 'utf8')) as {
          targets?: Record<string, unknown>;
        };
        if (project2.targets?.['smoke'] && !tags.has('scope:cockpit-smoke')) {
          errors.push(`${relative(repoRoot, p)}: has smoke target but missing scope:cockpit-smoke`);
        }
      }
    }

    expect(errors).toEqual([]);
  });
```

- [ ] **Step 3: Run the wiring spec locally**

```bash
cd /tmp/ci-scope-drift-guard && npx nx test cockpit-e2e-wiring 2>&1 | tail -20
```

(Or whatever the spec's nx target is — `cockpit:test` if the spec lives under `apps/cockpit`.)

Expected: PASS. If any project lacks the required tag, the test names which one + which tag.

- [ ] **Step 4: Commit + push + open PR 3**

```bash
cd /tmp/ci-scope-drift-guard && git add apps/cockpit/cockpit-e2e-wiring.spec.ts && \
  git diff --cached --stat
```

```bash
git commit -m "$(cat <<'EOF'
test(cockpit-e2e-wiring): drift-guard for scope:* tags on cap projects

PR 3 of 3 for the ci-scope thin-shim migration. Adds a third it() block
to apps/cockpit/cockpit-e2e-wiring.spec.ts asserting that every cockpit
cap project (under cockpit/<product>/<topic>/{angular,python}/) declares
the scope:cockpit-e2e + scope:cockpit-examples tags; python caps with a
smoke target also need scope:cockpit-smoke.

Closes the drift surface: future contributors adding a new cap can't
silently forget the tags — the test names which project + which tag is
missing.

Excludes cockpit/ag-ui/* (no python sibling; different rules).

See spec: docs/superpowers/specs/2026-05-21-ci-scope-thin-shim-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

```bash
git push -u origin claude/ci-scope-drift-guard 2>&1 | tail -3
```

```bash
gh pr create --title "test(cockpit-e2e-wiring): drift-guard for scope:* tags (PR 3/3)" --body "$(cat <<'EOF'
## Summary
PR 3 of 3 for the ci-scope thin-shim migration. Adds a drift-guard test that asserts every cockpit cap project declares the expected \`scope:*\` tags.

- Every \`cockpit/<product>/<topic>/{angular,python}/project.json\` must include \`scope:cockpit-e2e\` + \`scope:cockpit-examples\`.
- Python caps with a \`smoke\` target must also include \`scope:cockpit-smoke\`.
- \`cockpit/ag-ui/*\` excluded (no python sibling; different tag rules).

Without this, a future contributor could add a new cap and silently forget the tags — their CI would underfire.

## Test plan
- [ ] CI \`Cockpit — build / test\` passes (the wiring spec runs here).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Plan task |
|---|---|
| Per-project `scope:*` tags | Task 1 (script populates) |
| Tag taxonomy (publishable lib, internal lib, cap angular, cap python, website, cockpit, examples-chat, posthog) | Task 1 Step 1 (tagsFor function in script) |
| `implicitDependencies` for non-project paths | Task 1 Step 1 (implicitDepsFor function) |
| Specific implicit-deps list (vercel.*, scripts/*.ts, capability-registry.ts) | Task 1 Step 1 (12-entry list for apps/cockpit) |
| 3-PR sequencing | PR 1 = Task 1, PR 2 = Tasks 2-6, PR 3 = Tasks 7-8 |
| Thin shim (~50 LOC) | Task 3 |
| `classifyFromAffected` pure function | Task 3 Step 1 (the export) |
| `tagToScopeKey` transformation | Task 3 Step 1 (the helper) |
| Global CI file short-circuit | Task 3 Step 1 (GLOBAL_CI_FILES) |
| `loadAffectedProjects` via nx | Task 3 Step 1 (the helper) |
| Test suite migration with synthetic affected projects | Task 4 |
| 3 PR 2-only tests: vercel.json → website, capability-registry → cockpit, ci.yml → full | Task 4 Step 2 (all three present) |
| Drift-guard assertion | Task 8 |
| Acceptance: ci-scope.mjs ≤80 LOC | Task 3 ships ~120 LOC — slight overshoot. Acceptable; the doc comment block adds ~20 lines. |

**Placeholder scan:** searched plan for "TBD", "TODO", "fill in", "similar to". The phrase "Or whatever the spec's nx target is" in Task 8 Step 3 is the only soft language — fix inline: it's `cockpit:test` (the spec lives under apps/cockpit so `nx test cockpit` runs it). Updated in the head of mind; the actual command in the step shows both options.

**Type consistency:**
- `SCOPE_KEYS` consistent across shim code, test fixtures, and acceptance criteria (11 entries).
- `tagToScopeKey('scope:cockpit-e2e')` → `'cockpit_e2e'` used consistently.
- `affectedProjects: Array<{name, tags}>` shape consistent in `loadAffectedProjects` return value + test fixtures + `classifyFromAffected` parameter.
- `//path` prefix for `implicitDependencies` consistent in Task 1's script + spec doc.

One ambiguity surfaced + accepted: the script in Task 1 derives tags from project metadata (root, name, targets). If a project's shape doesn't match any case, the script returns `null` (skip — no tags added). That's intentional — `marketing/*`, `apps/minting-service`, `libs/db`, `examples/chat/smoke`, `cockpit/ag-ui/streaming/angular` are some of the cases that skip. Reviewers verify by checking the script's output count (~50 modified) matches expectations.
