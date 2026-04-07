# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four review regressions in stream event handling, reactive thread switching, MCP package entrypoints, and MCP API docs discovery without regressing the current deployment.

**Architecture:** Split the work into two isolated tracks. The `libs/angular` track fixes LangGraph transport normalization and reactive thread resets. The `packages/mcp` track fixes packaged entrypoints and ensures API docs ship with and load from the published artifact. Each track gets its own worktree and verification loop, then both are integrated back into the single-commit history on `main`.

**Tech Stack:** Nx, Angular signals, RxJS, TypeScript, Node.js, LangGraph SDK, MCP package packaging

---

## File Map

- Modify: `libs/angular/src/lib/transport/fetch-stream.transport.ts`
  Normalise LangGraph SDK stream event names into the shapes the bridge already consumes.
- Modify: `libs/angular/src/lib/internals/stream-manager.bridge.ts`
  Reset stream state when a bound `threadId` observable changes, matching `switchThread()`.
- Modify: `libs/angular/src/lib/internals/stream-manager.bridge.spec.ts`
  Add regression coverage for reactive thread switching and real event normalization behavior at the bridge level.
- Modify: `libs/angular/src/lib/transport/mock-stream.transport.ts`
  Only if needed to keep transport tests representative of the real normalized stream shape.
- Modify: `libs/angular/src/lib/angular.fn.spec.ts`
  Add or update integration tests around `threadId` signal changes if the bridge tests are not sufficient.
- Modify: `packages/mcp/package.json`
  Point `main`, `bin`, and `start` at the actual built output path.
- Modify: `packages/mcp/src/data/loader.ts`
  Resolve API docs from packaged locations and monorepo development locations.
- Modify: `packages/mcp/project.json`
  Ensure the build copies `api-docs.json` into the package output if it does not already.
- Modify: `packages/mcp/src/data/loader.spec.ts`
  Add packaging-oriented tests for loader path resolution.
- Create: `packages/mcp/src/index.spec.ts`
  Add a package entrypoint smoke test only if the build output path cannot be covered sufficiently via existing package/build checks.

---

### Task 1: Create isolated worktrees for the two independent fix tracks

**Files:**
- Verify: `.worktrees/`
- Verify: `.gitignore`

- [ ] **Step 1: Verify `.worktrees/` is the project-local worktree root and is ignored**

Run: `ls -d .worktrees && git check-ignore -q .worktrees`
Expected: `.worktrees` exists and `git check-ignore` exits `0`.

- [ ] **Step 2: Create a worktree for stream runtime fixes**

Run: `git worktree add .worktrees/review-lib-fixes -b review-lib-fixes`
Expected: new worktree created on branch `review-lib-fixes`.

- [ ] **Step 3: Create a worktree for MCP packaging fixes**

Run: `git worktree add .worktrees/review-mcp-fixes -b review-mcp-fixes`
Expected: new worktree created on branch `review-mcp-fixes`.

- [ ] **Step 4: Install dependencies and capture a baseline in each worktree**

Run in each worktree: `npm install`
Expected: lockfile-compatible install with no dependency graph changes.

- [ ] **Step 5: Run targeted baseline tests before changes**

Run in `review-lib-fixes`: `npx nx test angular --skip-nx-cache`
Run in `review-mcp-fixes`: `npx tsc -p packages/mcp/tsconfig.json`
Expected: baseline status captured before implementation begins.

---

### Task 2: Fix LangGraph message event normalization

**Files:**
- Modify: `libs/angular/src/lib/transport/fetch-stream.transport.ts`
- Test: `libs/angular/src/lib/internals/stream-manager.bridge.spec.ts`

- [ ] **Step 1: Write a failing regression test for real LangGraph message event variants**

Add a test that feeds `messages/partial`, `messages/complete`, and `messages/metadata` through the bridge-facing event path and asserts only the message-bearing variants update `messages$`.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run libs/angular/src/lib/internals/stream-manager.bridge.spec.ts -t "normalizes LangGraph message events"`
Expected: FAIL because `messages/partial` and `messages/complete` are not mapped to `messages`.

- [ ] **Step 3: Implement the minimal transport normalization**

Map LangGraph message stream event names to the local event contract:
- `messages/partial` -> `messages`
- `messages/complete` -> `messages`
- `messages/metadata` -> ignored or mapped to a non-disruptive event the bridge does not treat as message state

- [ ] **Step 4: Re-run the targeted test**

Run: `npx vitest run libs/angular/src/lib/internals/stream-manager.bridge.spec.ts -t "normalizes LangGraph message events"`
Expected: PASS

---

### Task 3: Reset bridge state when the bound `threadId` changes

**Files:**
- Modify: `libs/angular/src/lib/internals/stream-manager.bridge.ts`
- Test: `libs/angular/src/lib/internals/stream-manager.bridge.spec.ts`
- Test: `libs/angular/src/lib/angular.fn.spec.ts`

- [ ] **Step 1: Write a failing regression test for reactive thread changes**

Add a test where `threadId$` emits one thread, bridge state is populated, then `threadId$` emits a different value. Assert messages, values, history, interrupts, and loading state reset immediately, without waiting for a new submit.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run libs/angular/src/lib/internals/stream-manager.bridge.spec.ts -t "resets state when threadId observable changes"`
Expected: FAIL because the subscription only mutates `currentThreadId`.

- [ ] **Step 3: Implement the minimal reset behavior**

Extract a shared reset helper used by both the `threadId$` subscription and `switchThread()`. Preserve current thread assignment while clearing all stateful subjects.

- [ ] **Step 4: Re-run targeted tests**

Run:
- `npx vitest run libs/angular/src/lib/internals/stream-manager.bridge.spec.ts`
- `npx vitest run libs/angular/src/lib/angular.fn.spec.ts`
Expected: PASS

---

### Task 4: Fix MCP package entrypoints to match Nx output

**Files:**
- Modify: `packages/mcp/package.json`
- Verify: `packages/mcp/project.json`

- [ ] **Step 1: Inspect the actual build output shape**

Run: `npx nx build mcp --skip-nx-cache && find dist/packages/mcp -maxdepth 3 -type f | sort`
Expected: confirm whether entrypoint is `src/index.js` or another path.

- [ ] **Step 2: Write a failing packaged runtime smoke check**

Use a command-based smoke test or scripted check that validates `node <declared-entrypoint>` exists after build.

- [ ] **Step 3: Update package manifest entrypoints**

Point `main`, `bin`, and `start` to the real built file path. Keep the shebang path executable for published installs.

- [ ] **Step 4: Re-run build and smoke check**

Run:
- `npx nx build mcp --skip-nx-cache`
- `node dist/packages/mcp/src/index.js --help || true`
Expected: entrypoint resolves without `MODULE_NOT_FOUND`.

---

### Task 5: Make API docs available from the built MCP package

**Files:**
- Modify: `packages/mcp/src/data/loader.ts`
- Modify: `packages/mcp/project.json`
- Test: `packages/mcp/src/data/loader.spec.ts`

- [ ] **Step 1: Write a failing test for packaged path resolution**

Simulate loader execution from a built package directory and assert it finds packaged `api-docs.json` before falling back to monorepo development paths.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx vitest run packages/mcp/src/data/loader.spec.ts`
Expected: FAIL because current paths only work in the repo checkout.

- [ ] **Step 3: Implement packaging-safe resolution**

Update loader candidates to prefer package-local paths such as:
- `../api-docs.json`
- `../../api-docs.json`
- packaged asset locations under `dist/packages/mcp`
Then keep monorepo development fallbacks.

- [ ] **Step 4: Ensure the build copies `api-docs.json` into the MCP package output**

Update `packages/mcp/project.json` assets if needed so the packaged artifact contains the docs file the loader expects.

- [ ] **Step 5: Re-run targeted tests and a built-package smoke check**

Run:
- `npx vitest run packages/mcp/src/data/loader.spec.ts`
- `npx nx build mcp --skip-nx-cache`
- `find dist/packages/mcp -maxdepth 3 -name 'api-docs.json' -o -name 'index.js' | sort`
Expected: tests pass and the built artifact includes both the runnable entrypoint and API docs.

---

### Task 6: Integrate, review, and verify end-to-end

**Files:**
- Verify: `libs/angular/**/*`
- Verify: `packages/mcp/**/*`

- [ ] **Step 1: Merge both worktree branches back into the main working tree**

Use non-interactive git commands only.

- [ ] **Step 2: Run full targeted verification from the main tree**

Run:
- `npx nx test angular --skip-nx-cache`
- `npx nx build mcp --skip-nx-cache`
- `node dist/packages/mcp/src/index.js --help || true`

Expected: all targeted verification passes and the MCP entrypoint resolves.

- [ ] **Step 3: Request final review against the implemented diff**

Run a code review pass focused on the four reported regressions and verify each is explicitly resolved.

- [ ] **Step 4: Amend the single root commit and force-push**

Keep repository history at one commit unless the user asks otherwise.

