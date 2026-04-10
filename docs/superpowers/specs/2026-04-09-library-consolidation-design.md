# Library Consolidation: Remove @cacheplane/stream-resource

**Date:** 2026-04-09
**Status:** Approved

## Overview

`@cacheplane/stream-resource` was merged into `@cacheplane/angular` during the rebrand (PR #39). The source code, Nx project, and tsconfig path mapping are already gone. What remains is the empty `libs/stream-resource/` directory and stale references across README, LICENSE-COMMERCIAL, and cockpit docs. This spec covers removing the directory and updating all references so the monorepo reflects 3 libraries (angular, render, chat) — not 4.

## Scope

### 1. Delete Empty Directory

Remove `libs/stream-resource/` (contains only leftover `node_modules/`).

### 2. README.md Updates

The README still describes `streamResource()` as the primary API. Update to reflect the current `agent()` API:

- Hero alt text and tagline: "Enterprise Streaming Resource" → "Enterprise Angular Agent Framework"
- 30-Second Example: `streamResource()` → `agent()`, `chat.messages()` → match current API shape
- Feature comparison table: `streamResource()` → `agent()`
- Architecture section: `streamResource()` → `agent()`, update description to match current internals

### 3. LICENSE-COMMERCIAL URL

Update `stream-resource.dev/pricing` → `cacheplane.ai/pricing`.

### 4. Cockpit Python Docs

~10 files in `cockpit/` reference "stream-resource" or "streamResource()" in prose and code examples. Update to "agent" / `agent()`.

### 5. SVG Assets

`hero.svg` and `arch-diagram.svg` contain embedded "streamResource" text. These are generated assets — flag for manual regeneration rather than attempting SVG text edits.

### 6. Out of Scope

- Historical docs in `docs/superpowers/specs/` and `docs/superpowers/plans/` — these are time-stamped records of past decisions. Leave as-is.
- Website content (`apps/website/content/docs/`) — already uses current `agent()` terminology.
- The monorepo name "stream-resource" (GitHub repo name) — renaming the repo is a separate concern.
