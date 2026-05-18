# Marketing Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the structural deliverables of the marketing-meta spec — `marketing/` directory, migrated Cowork home, four skeleton internal packages, voice doc already committed, and a supersede note in the GTM meta. No implementation logic in any subsystem.

**Architecture:** `marketing/` is a new top-level directory with five sub-trees: `assets/`, `channels/`, `agent/`, `cowork/` (Claude skills + draft inboxes), `metrics/`. Four of them are `@ngaf/*` Nx workspace packages marked `"private": true` and resolved via `tsconfig.base.json` paths. `cowork/` is migrated wholesale from the repo root with one `git mv` and a README path update.

**Tech Stack:** Nx workspace packages (`@nx/js:tsc` executor), npm workspaces, TypeScript 5.x. No runtime dependencies introduced — skeletons export empty stubs.

**Spec reference:** `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`. Branch: `marketing-meta` (already created in worktree; commits `4ccf38ef`, `187ef94f`, `7218c235` already on it).

---

## File Structure

**Move (single `git mv`):**

- `cowork/` → `marketing/cowork/` (preserves history)

**New:**

- `marketing/README.md`
- `marketing/.env.example`
- `marketing/cowork/inbox/.gitkeep`
- `marketing/cowork/outbox/.gitkeep`
- `marketing/cowork/archive/.gitkeep`
- `marketing/cowork/marketing/SKILL.md` (stub — body lands in sub-spec 4)
- `marketing/assets/package.json`
- `marketing/assets/project.json`
- `marketing/assets/tsconfig.json`
- `marketing/assets/tsconfig.lib.json`
- `marketing/assets/src/index.ts`
- `marketing/channels/package.json`
- `marketing/channels/project.json`
- `marketing/channels/tsconfig.json`
- `marketing/channels/tsconfig.lib.json`
- `marketing/channels/src/index.ts`
- `marketing/agent/package.json`
- `marketing/agent/project.json`
- `marketing/agent/tsconfig.json`
- `marketing/agent/tsconfig.lib.json`
- `marketing/agent/src/index.ts`
- `marketing/metrics/package.json`
- `marketing/metrics/project.json`
- `marketing/metrics/tsconfig.json`
- `marketing/metrics/tsconfig.lib.json`
- `marketing/metrics/src/index.ts`

**Modified:**

- `marketing/cowork/README.md` — install path notes (post-move it references the new location).
- `package.json` (root) — add `marketing/*` to `workspaces`.
- `tsconfig.base.json` — add paths for the four new packages.
- `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` — append supersede note for Spec 6.

---

## Task 1: Move `cowork/` → `marketing/cowork/`

**Files:**

- Move: `cowork/` → `marketing/cowork/`

- [ ] **Step 1: Create the marketing root**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation
mkdir -p marketing
```

- [ ] **Step 2: Move with git to preserve history**

```bash
git mv cowork marketing/cowork
git status --short
```

Expected: `R  cowork/README.md -> marketing/cowork/README.md` and `R  cowork/gtm/SKILL.md -> marketing/cowork/gtm/SKILL.md`.

- [ ] **Step 3: Verify history is preserved**

```bash
git log --follow --oneline marketing/cowork/gtm/SKILL.md | head -3
```

Expected: at least one historical commit shown (not just the rename).

- [ ] **Step 4: Commit the move**

```bash
git add -A
git commit -m "refactor: move cowork/ to marketing/cowork/

Cowork becomes a subsystem of the marketing umbrella. The /gtm skill
content is unchanged; only its path moves. Install instructions in the
README will be updated in the next commit."
```

---

## Task 2: Update `marketing/cowork/README.md` install paths

**Files:**

- Modify: `marketing/cowork/README.md`

- [ ] **Step 1: Read the current README**

Run: `cat marketing/cowork/README.md` — note the four install snippets (lines that reference `cowork/gtm/SKILL.md`).

- [ ] **Step 2: Update path references**

Edit every occurrence of `cowork/gtm/SKILL.md` → `marketing/cowork/gtm/SKILL.md` in the README. The README has install snippets like:

```bash
cp cowork/gtm/SKILL.md ~/.claude/skills/gtm/SKILL.md
```

Replace with:

```bash
cp marketing/cowork/gtm/SKILL.md ~/.claude/skills/gtm/SKILL.md
```

Also update the "What's in this directory" ASCII tree to show the new layout:

```
marketing/cowork/
├── README.md           # This file.
├── gtm/
│   └── SKILL.md        # The GTM Cowork skill.
├── marketing/
│   └── SKILL.md        # The marketing pipeline Cowork skill (stub; body in sub-spec 4).
├── inbox/              # Drafts awaiting review.
├── outbox/             # Approved + posted drafts.
└── archive/            # Rejected or expired drafts.
```

- [ ] **Step 3: Commit**

```bash
git add marketing/cowork/README.md
git commit -m "docs(marketing/cowork): update install paths after move"
```

---

## Task 3: Add draft inbox/outbox/archive directories

**Files:**

- Create: `marketing/cowork/inbox/.gitkeep`
- Create: `marketing/cowork/outbox/.gitkeep`
- Create: `marketing/cowork/archive/.gitkeep`

- [ ] **Step 1: Create the dirs and gitkeeps**

```bash
mkdir -p marketing/cowork/inbox marketing/cowork/outbox marketing/cowork/archive
touch marketing/cowork/inbox/.gitkeep marketing/cowork/outbox/.gitkeep marketing/cowork/archive/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add marketing/cowork/inbox/.gitkeep marketing/cowork/outbox/.gitkeep marketing/cowork/archive/.gitkeep
git commit -m "feat(marketing/cowork): scaffold inbox/outbox/archive dirs"
```

---

## Task 4: Add `/marketing` Cowork skill stub

**Files:**

- Create: `marketing/cowork/marketing/SKILL.md`

- [ ] **Step 1: Create the stub skill**

```bash
mkdir -p marketing/cowork/marketing
```

Then write `marketing/cowork/marketing/SKILL.md`:

```markdown
---
name: marketing
description: |
  Cacheplane marketing pipeline operator. Reads `marketing/cowork/inbox/*.json`
  draft bundles, presents them for review in conversation, supports
  edit/approve/reject decisions, and dispatches approved drafts to channel
  adapters. Invoke when "drafts are waiting" or when the user wants to
  produce a thread/post for X, LinkedIn, Dev.to, or Reddit.
status: stub
---

# Marketing Cowork skill — STUB

Implementation lands in the cowork-loop sub-spec
(`docs/superpowers/specs/marketing/<date>-cowork-loop-design.md`).

This file exists so the directory shape and skill name are reserved.
Do NOT invoke this skill until the cowork-loop sub-spec is merged.

## Expected file conventions (preview)

- `marketing/cowork/inbox/<id>.json` — drafts awaiting review (agent writes)
- `marketing/cowork/outbox/<id>.json` — approved + posted (skill writes)
- `marketing/cowork/archive/<id>.json` — rejected or expired (skill writes)

`<id>` is `YYYY-MM-DD-<short-slug>`.

## Expected DraftBundle shape (preview)

See `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md` §5.3.
```

- [ ] **Step 2: Commit**

```bash
git add marketing/cowork/marketing/SKILL.md
git commit -m "feat(marketing/cowork): add /marketing skill stub"
```

---

## Task 5: Add `marketing/*` to npm workspaces

**Files:**

- Modify: `package.json` (root)

- [ ] **Step 1: Edit workspaces array**

In root `package.json`, change the `workspaces` array from:

```json
  "workspaces": [
    "packages/*",
    "apps/*",
    "libs/*"
  ],
```

to:

```json
  "workspaces": [
    "packages/*",
    "apps/*",
    "libs/*",
    "marketing/assets",
    "marketing/channels",
    "marketing/agent",
    "marketing/metrics"
  ],
```

(Listing them explicitly rather than `marketing/*` because `marketing/cowork`, `marketing/cowork/inbox`, etc. are NOT packages — they're skill markdown + JSON inbox dirs.)

- [ ] **Step 2: Commit (install runs in Task 11)**

```bash
git add package.json
git commit -m "chore: register marketing/* packages in npm workspaces"
```

---

## Task 6: Scaffold `@ngaf/marketing-assets` skeleton

**Files:**

- Create: `marketing/assets/package.json`
- Create: `marketing/assets/project.json`
- Create: `marketing/assets/tsconfig.json`
- Create: `marketing/assets/tsconfig.lib.json`
- Create: `marketing/assets/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ngaf/marketing-assets",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "marketing/assets"
  },
  "sideEffects": false,
  "private": true
}
```

- [ ] **Step 2: Create project.json**

```json
{
  "name": "marketing-assets",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "marketing/assets/src",
  "projectType": "library",
  "tags": ["scope:marketing", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/marketing/assets"],
      "options": {
        "outputPath": "dist/marketing/assets",
        "main": "marketing/assets/src/index.ts",
        "tsConfig": "marketing/assets/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-assets — Brand asset rendering for the marketing pipeline.
// Skeleton only. Implementation lands in the brand-assets sub-spec.

export interface CardInput {
  template: string;
  title: string;
  subtitle?: string;
  tag?: string;
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}

export function renderCard(_input: CardInput): Promise<RenderedCard> {
  throw new Error(
    '@ngaf/marketing-assets: renderCard() not yet implemented. See brand-assets sub-spec.',
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add marketing/assets/
git commit -m "feat(marketing/assets): scaffold @ngaf/marketing-assets skeleton"
```

---

## Task 7: Scaffold `@ngaf/marketing-channels` skeleton

**Files:**

- Create: `marketing/channels/package.json`
- Create: `marketing/channels/project.json`
- Create: `marketing/channels/tsconfig.json`
- Create: `marketing/channels/tsconfig.lib.json`
- Create: `marketing/channels/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ngaf/marketing-channels",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "marketing/channels"
  },
  "sideEffects": false,
  "private": true
}
```

- [ ] **Step 2: Create project.json**

```json
{
  "name": "marketing-channels",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "marketing/channels/src",
  "projectType": "library",
  "tags": ["scope:marketing", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/marketing/channels"],
      "options": {
        "outputPath": "dist/marketing/channels",
        "main": "marketing/channels/src/index.ts",
        "tsConfig": "marketing/channels/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-channels — Channel adapters for X, LinkedIn, Dev.to, Reddit.
// Skeleton only. Implementations land in the channel-adapters sub-spec.

export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface Draft {
  channel: ChannelId;
  text: string;
  media?: { png: Buffer; alt: string }[];
  threadParts?: string[];
  link?: { url: string; previewTitle?: string };
  scheduledAt?: string;
}

export interface PostResult {
  channel: ChannelId;
  postId: string;
  url: string;
  postedAt: string;
}

export interface PostMetrics {
  postId: string;
  impressions?: number;
  clicks?: number;
  replies?: number;
  shares?: number;
  fetchedAt: string;
}

export interface ChannelAdapter {
  readonly id: ChannelId;
  post(draft: Draft): Promise<PostResult>;
  metrics(postId: string): Promise<PostMetrics>;
}

export function getAdapter(_id: ChannelId): ChannelAdapter {
  throw new Error(
    '@ngaf/marketing-channels: getAdapter() not yet implemented. See channel-adapters sub-spec.',
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add marketing/channels/
git commit -m "feat(marketing/channels): scaffold @ngaf/marketing-channels skeleton"
```

---

## Task 8: Scaffold `@ngaf/marketing-agent` skeleton

**Files:**

- Create: `marketing/agent/package.json`
- Create: `marketing/agent/project.json`
- Create: `marketing/agent/tsconfig.json`
- Create: `marketing/agent/tsconfig.lib.json`
- Create: `marketing/agent/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ngaf/marketing-agent",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "marketing/agent"
  },
  "sideEffects": false,
  "private": true
}
```

- [ ] **Step 2: Create project.json**

```json
{
  "name": "marketing-agent",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "marketing/agent/src",
  "projectType": "library",
  "tags": ["scope:marketing", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/marketing/agent"],
      "options": {
        "outputPath": "dist/marketing/agent",
        "main": "marketing/agent/src/index.ts",
        "tsConfig": "marketing/agent/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-agent — LangGraph drafting agent for the marketing pipeline.
// Skeleton only. Implementation lands in the content-agent sub-spec.

import type { Draft } from '@ngaf/marketing-channels';

export type Trigger =
  | { kind: 'blog-merge'; slug: string }
  | { kind: 'release'; tag: string }
  | { kind: 'cowork-prompt'; topic: string; freeform?: string }
  | { kind: 'cadence'; window: 'weekly' };

export interface DraftBundle {
  id: string;
  trigger: Trigger;
  drafts: Draft[];
  source: { url?: string; title?: string; excerpt?: string };
  createdAt: string;
}

export function draft(_trigger: Trigger): Promise<DraftBundle> {
  throw new Error(
    '@ngaf/marketing-agent: draft() not yet implemented. See content-agent sub-spec.',
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add marketing/agent/
git commit -m "feat(marketing/agent): scaffold @ngaf/marketing-agent skeleton"
```

---

## Task 9: Scaffold `@ngaf/marketing-metrics` skeleton

**Files:**

- Create: `marketing/metrics/package.json`
- Create: `marketing/metrics/project.json`
- Create: `marketing/metrics/tsconfig.json`
- Create: `marketing/metrics/tsconfig.lib.json`
- Create: `marketing/metrics/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ngaf/marketing-metrics",
  "version": "0.0.0",
  "license": "MIT",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "marketing/metrics"
  },
  "sideEffects": false,
  "private": true
}
```

- [ ] **Step 2: Create project.json**

```json
{
  "name": "marketing-metrics",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "marketing/metrics/src",
  "projectType": "library",
  "tags": ["scope:marketing", "type:lib"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/marketing/metrics"],
      "options": {
        "outputPath": "dist/marketing/metrics",
        "main": "marketing/metrics/src/index.ts",
        "tsConfig": "marketing/metrics/tsconfig.lib.json"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// SPDX-License-Identifier: MIT
//
// @ngaf/marketing-metrics — Metrics ingestion for the marketing pipeline.
// Skeleton only. Implementation lands in the metrics-ingest sub-spec.

export interface RunOptions {
  sinceHours?: number;
}

export interface RunResult {
  posts: number;
  eventsEmitted: number;
}

export function run(_opts?: RunOptions): Promise<RunResult> {
  throw new Error(
    '@ngaf/marketing-metrics: run() not yet implemented. See metrics-ingest sub-spec.',
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add marketing/metrics/
git commit -m "feat(marketing/metrics): scaffold @ngaf/marketing-metrics skeleton"
```

---

## Task 10: Add path mappings to `tsconfig.base.json`

**Files:**

- Modify: `tsconfig.base.json`

- [ ] **Step 1: Add four paths**

Find the `"paths"` object in `tsconfig.base.json` (alphabetical with existing `@ngaf/*` entries). Insert these four entries in alphabetical position:

```json
      "@ngaf/marketing-agent": ["marketing/agent/src/index.ts"],
      "@ngaf/marketing-assets": ["marketing/assets/src/index.ts"],
      "@ngaf/marketing-channels": ["marketing/channels/src/index.ts"],
      "@ngaf/marketing-metrics": ["marketing/metrics/src/index.ts"],
```

- [ ] **Step 2: Verify Nx sees the new projects**

```bash
npx nx show projects | grep marketing
```

Expected output (order may vary):
```
marketing-agent
marketing-assets
marketing-channels
marketing-metrics
```

- [ ] **Step 3: Verify the agent skeleton can import from channels (cross-package resolution)**

```bash
npx tsc --noEmit marketing/agent/src/index.ts
```

Expected: clean, no errors. (This validates the `import type { Draft } from '@ngaf/marketing-channels';` resolves via the new path mapping.)

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore(tsconfig): add path mappings for marketing/* packages"
```

---

## Task 11: Install workspaces + verify build

**Files:** none (verification only)

- [ ] **Step 1: Install (surgical, no full lockfile rewrite)**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/gtm+cockpit-instrumentation
npm install --no-audit --no-fund
```

Expected: npm picks up the new `marketing/*` workspaces. No new dependencies are added (skeletons have no `dependencies` blocks). The lockfile may add `marketing/<pkg>` workspace entries; that's expected.

**Per project memory ("Don't regenerate package-lock.json on macOS"):** if the install changes any `@next/swc-*` platform binding entries in package-lock.json, revert those specific changes with `git checkout package-lock.json` and try `npm install --package-lock-only` instead.

- [ ] **Step 2: Verify Nx graph**

```bash
npx nx graph --file=/tmp/nx-graph.json
node -e "const g = require('/tmp/nx-graph.json'); console.log(Object.keys(g.graph.nodes).filter(n => n.startsWith('marketing-')).sort())"
```

Expected: `[ 'marketing-agent', 'marketing-assets', 'marketing-channels', 'marketing-metrics' ]`

- [ ] **Step 3: Verify each package builds**

```bash
npx nx run-many --target=build --projects=marketing-assets,marketing-channels,marketing-agent,marketing-metrics
```

Expected: 4/4 builds succeed. Each produces a `dist/marketing/<pkg>/index.js` and `index.d.ts`.

- [ ] **Step 4: Commit lockfile changes if any**

```bash
git add package-lock.json
git diff --cached --stat
# Only commit if there are real changes
git commit -m "chore: refresh lockfile for marketing/* workspaces" || echo "no lockfile changes"
```

---

## Task 12: Write `marketing/README.md`

**Files:**

- Create: `marketing/README.md`

- [ ] **Step 1: Create the README**

```markdown
# marketing/

Agentic marketing pipeline. Five composable subsystems that turn source content (blog posts, releases, prompts, schedules) into multi-channel posts (X, LinkedIn, Dev.to, Reddit), with Cowork as the human approval surface and PostHog as the feedback loop.

## Structure

```
marketing/
├── assets/      # @ngaf/marketing-assets    — branded image rendering
├── channels/    # @ngaf/marketing-channels  — X, LinkedIn, Dev.to, Reddit adapters
├── agent/       # @ngaf/marketing-agent     — LangGraph drafting agent
├── cowork/      # Claude skills (/gtm, /marketing) + inbox/outbox/archive
└── metrics/     # @ngaf/marketing-metrics   — feedback ingestion → PostHog
```

All four packages are internal (`"private": true`). They are NOT published to npm.

## Specs

- Meta (this umbrella): `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- Sub-specs (when written):
  - `brand-assets` — `docs/superpowers/specs/marketing/<date>-brand-assets-design.md`
  - `channel-adapters` — `docs/superpowers/specs/marketing/<date>-channel-adapters-design.md`
  - `content-agent` — `docs/superpowers/specs/marketing/<date>-content-agent-design.md`
  - `cowork-loop` — `docs/superpowers/specs/marketing/<date>-cowork-loop-design.md`
  - `metrics-ingest` — `docs/superpowers/specs/marketing/<date>-metrics-ingest-design.md`

## Voice + messaging source-of-truth

- `docs/gtm/voice.md` — Brian's tone, phrasing, structural quirks
- `docs/gtm/messaging.md` — positioning, claims, no-go phrases
- `docs/gtm/icp.md` — audience

All in this repo. No machine-local paths in checked-in code.

## Status

This directory was scaffolded by the marketing-meta spec. Subsystems are skeletons. Implementation lands as each sub-spec ships.

```

- [ ] **Step 2: Commit**

```bash
git add marketing/README.md
git commit -m "docs(marketing): add directory charter README"
```

---

## Task 13: Write `marketing/.env.example`

**Files:**

- Create: `marketing/.env.example`

- [ ] **Step 1: Create the file**

```
# marketing/.env.example
#
# Placeholder env var names for the marketing pipeline. Real values live in
# .env at the repo root (gitignored). Copy lines you need into .env and fill
# in your credentials.
#
# Sub-specs may add more keys. This file is documentation, not consumed at
# runtime — each adapter reads its own keys via process.env.

# X / Twitter
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# LinkedIn
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=

# Dev.to
DEVTO_API_KEY=

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=

# Pipeline behavior
# DRY_RUN=1   # Adapters return synthetic PostResults; nothing is posted.
```

- [ ] **Step 2: Commit**

```bash
git add marketing/.env.example
git commit -m "docs(marketing): add .env.example with placeholder channel keys"
```

---

## Task 14: Append supersede note to GTM meta-spec

**Files:**

- Modify: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`

- [ ] **Step 1: Find the Spec 6 row in the workstream decomposition table**

Run: `grep -n 'community-launch' docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`

Expected: at least one line number matching the row `| 6 | community-launch | 3 | ...`.

- [ ] **Step 2: Add a note immediately under the table**

Insert this paragraph after the table (immediately before the "Sequencing notes" heading at line ~134):

```markdown
> **Spec 6 superseded.** The one-shot `community-launch` workstream was replaced by the ongoing marketing pipeline. See `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md` and its sub-specs. The launch exit criterion (week-1 dashboard snapshot, post-mortem doc) moves into the metrics-ingest sub-spec.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
git commit -m "docs(gtm): note marketing umbrella supersedes Spec 6"
```

---

## Task 15: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full build of marketing packages**

```bash
npx nx run-many --target=build --projects=marketing-assets,marketing-channels,marketing-agent,marketing-metrics
```

Expected: 4/4 green.

- [ ] **Step 2: Verify website + cockpit still build (the move didn't break anything)**

```bash
npx nx run website:build
```

Expected: green. (`marketing/cowork/` is unrelated to website, but verify nothing imports from `cowork/` anywhere.)

```bash
grep -rE "from ['\"]\.\.\/\.\.\/\.\.\/cowork|from ['\"]cowork" --include="*.ts" --include="*.tsx" apps/ libs/ 2>&1 | head
```

Expected: no matches. The cowork dir only contains markdown + JSON; nothing should import it.

- [ ] **Step 3: Push branch + open PR**

```bash
git push -u origin marketing-meta
gh pr create --title "feat(marketing): scaffold marketing/ umbrella + cowork migration" --body "$(cat <<'EOF'
## Summary
- Adds `marketing/` directory with 4 internal Nx packages: `@ngaf/marketing-{assets,channels,agent,metrics}` (all `"private": true`, skeletons only)
- Moves `cowork/` → `marketing/cowork/` (single `git mv`, history preserved)
- Adds `marketing/cowork/marketing/SKILL.md` stub (body in cowork-loop sub-spec)
- Adds `marketing/cowork/{inbox,outbox,archive}/.gitkeep`
- Adds `docs/gtm/voice.md` (Brian's pre-2026 voice synthesis)
- Adds `marketing/README.md` + `marketing/.env.example`
- Notes Spec 6 supersede in the GTM meta-spec

Spec: `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
Plan: `docs/superpowers/plans/marketing/2026-05-17-marketing-meta.md`

## Test plan
- [ ] `npx nx run-many --target=build --projects=marketing-*` green
- [ ] `npx nx show projects | grep marketing` lists all 4
- [ ] `npx nx run website:build` green (move didn't break anything)
- [ ] `git log --follow marketing/cowork/gtm/SKILL.md` shows pre-move history

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Enable auto-merge on green**

```bash
gh pr merge --auto --squash
```

---

## Self-review

**Spec coverage check** (against §10 deliverables in the meta-spec):

- ✅ Meta-spec doc — committed as `187ef94f` before plan (out of plan scope)
- ✅ `marketing/README.md` — Task 12
- ✅ Migrate `cowork/` → `marketing/cowork/` — Task 1
- ✅ `marketing/.env.example` — Task 13
- ✅ `docs/gtm/voice.md` — already committed as `7218c235` (out of plan scope, done by subagent)
- ✅ Skeleton `package.json` + `src/index.ts` for 4 packages — Tasks 6, 7, 8, 9
- ✅ `project.json` for each so `nx graph` sees it — Tasks 6, 7, 8, 9
- ✅ `tsconfig.base.json` path mappings — Task 10
- ✅ Workspaces registration — Task 5
- ✅ Inbox/outbox/archive scaffolding — Task 3
- ✅ `/marketing` skill stub — Task 4
- ✅ Cowork README path update — Task 2
- ✅ GTM meta supersede note — Task 14
- ✅ Build verification — Tasks 11, 15

**Placeholder scan:** All steps have concrete code, exact paths, exact commands. The `<date>-<name>-design.md` references in the README and skill stub are intentional (sub-specs haven't been written yet); they're documentation pointers, not code TODOs.

**Type consistency:**
- `Draft`, `PostResult`, `PostMetrics`, `ChannelAdapter`, `ChannelId` defined in Task 7, consumed in Task 8 via `import type { Draft } from '@ngaf/marketing-channels'`. Cross-package import is validated in Task 10 step 3.
- `Trigger`, `DraftBundle` defined in Task 8, referenced in skill stub (Task 4) as documentation.
- `CardInput`, `RenderedCard` defined in Task 6. No cross-package consumers in this plan.
- `RunOptions`, `RunResult` defined in Task 9. No cross-package consumers.

All package names are `@ngaf/marketing-<name>` consistently; all Nx project names are `marketing-<name>` consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/marketing/2026-05-17-marketing-meta.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review between each.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
