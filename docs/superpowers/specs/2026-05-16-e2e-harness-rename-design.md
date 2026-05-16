# E2E harness rename + chat folder consistency — design

> **Place in the larger plan.** Reframe after the aborted full migration ([discussion in this branch's history]; not pushed). Lessons learned:
> 1. The chat and cockpit harnesses solve different problems — chat is single-turn fast replays of one rich app; cockpit is per-app multi-turn tool/subagent flows. The lib's `sendPromptAndWait` is correctly tuned for cockpit but doesn't fit chat.
> 2. The only truly shared piece is the aimock runner (`startAimock` + `AimockHandle`). Process orchestration glue is shared between cockpit examples but NOT with chat.
> 3. The earlier "one helper for everyone" framing made both harnesses worse. Partial sharing (runner only) is the right shape.

## Goal

Rename the harness library from `libs/internal/aimock-harness/` to `libs/e2e-harness/`. Rename the chat aimock e2e dir from `examples/chat/aimock-e2e/` to `examples/chat/angular/e2e/` (location-only, behavior preserved). Chat continues to use its own inline harness modules; the lib's broader API (`createGlobalSetup`, `sendPromptAndWait`, `global-teardown`) stays for cockpit's exclusive use. Chat consumes ONLY `startAimock` from the lib (or stays fully self-contained by keeping its own runner — TBD per-implementation, both are fine).

No behavior change for either harness. All 10 chat specs + all 5+ cockpit specs continue to pass.

## Non-goals

- Changing chat's harness semantics (helpers, wait shape, teardown) — all preserved exactly.
- Changing cockpit harness semantics — preserved exactly.
- Sharing the lib's `sendPromptAndWait` or `createGlobalSetup` with chat. Chat keeps its own.
- Adding new e2e coverage anywhere.
- Renaming Angular projects (`examples-chat-angular`, `cockpit-*-angular` all unchanged).
- Renaming Python projects.

## What changes

### Lib rename: `libs/internal/aimock-harness/` → `libs/e2e-harness/`

- `git mv` the entire directory.
- `project.json`: name `internal-aimock-harness` → `e2e-harness`. `sourceRoot` updates.
- README updates: new project name; clarifies that the lib's broader API is cockpit-tuned and chat uses only the runner.
- All cockpit per-example dirs update their relative imports:
  - OLD: `'../../../../../libs/internal/aimock-harness/src'` (and `/global-teardown`)
  - NEW: `'../../../../../libs/e2e-harness/src'` (and `/global-teardown`)
  - Same 5-segment depth to repo root; only the post-root path simplifies.

### Lib's `sendPromptAndWait` reverted to working cockpit-tuned shape

During the failed migration I changed the lib helper trying to make it chat-friendly. Revert to the cockpit-tuned version that passed c-tool-calls + c-subagents (the agent-idle / "Stop generating" wait):

```typescript
// Wait for the agent to enter the loading state (Stop generating visible).
await expect(page.getByRole('button', { name: /stop generating/i })).toBeVisible({ timeout: 10_000 });
// Wait for the agent to fully finish.
await expect(page.getByRole('button', { name: /stop generating/i })).not.toBeAttached({ timeout: 60_000 });
// Return the last finalized assistant bubble.
const finalizedAssistant = page.locator('chat-message[data-role="assistant"][data-streaming="false"]').last();
await expect(finalizedAssistant).toBeAttached({ timeout: 5_000 });
return finalizedAssistant;
```

This was working pre-session. The earlier modifications hurt chat without helping cockpit; revert.

### Chat dir rename: `examples/chat/aimock-e2e/` → `examples/chat/angular/e2e/`

Pure file move + path adjustments. All chat harness files (`aimock-runner.ts`, `test-helpers.ts`, `global-setup.ts`, `global-teardown.ts`, `playwright.config.ts`, fixtures, scripts, specs, README, project.json, tsconfig.json) move verbatim. Internal relative paths inside the moved files may need adjustment (e.g., `REPO_ROOT = resolve(__dirname, '../../..')` in `global-setup.ts` becomes `'../../../..'` due to one more directory level).

The chat harness keeps its own `aimock-runner.ts` for now. Option to thin it to a re-export from `@e2e-harness` later, but not in this PR — the runner copy is harmless and decouples chat from any future lib changes.

### Chat Nx project dissolved; `e2e` target rolls into `examples-chat-angular`

- Delete `examples/chat/aimock-e2e/project.json` (now `examples/chat/angular/e2e/project.json` — delete).
- Add to `examples/chat/angular/project.json`:
  ```json
  "e2e": {
    "executor": "@nx/playwright:playwright",
    "options": { "config": "examples/chat/angular/e2e/playwright.config.ts" }
  }
  ```
- The `record` and `drift` targets that lived in the chat aimock project.json — move to `examples-chat-angular`'s project.json too (or drop; they're dev-only and the scripts can be shell-invoked directly).

### CI updates

- `ci.yml`:
  - Job id `examples-chat-aimock-e2e` → `examples-chat-e2e`
  - Display name `examples/chat — aimock e2e` → `examples/chat — e2e`
  - Command `npx nx run examples-chat-aimock-e2e:test --skip-nx-cache` → `npx nx e2e examples-chat-angular --skip-nx-cache`
  - Trace artifact path → `examples/chat/angular/e2e/test-results/`, name → `examples-chat-e2e-trace`
  - `deploy.needs` array: swap `examples-chat-aimock-e2e` → `examples-chat-e2e`
- `aimock-drift.yml`:
  - `npx nx run examples-chat-aimock-e2e:drift --skip-nx-cache` → `npx tsx examples/chat/angular/e2e/scripts/drift.ts`

## File deltas at a glance

### Renames (git mv)

- `libs/internal/aimock-harness/` → `libs/e2e-harness/` (whole dir + contents)
- `examples/chat/aimock-e2e/` → `examples/chat/angular/e2e/` (whole dir + contents)

### Modifications

- `libs/e2e-harness/project.json` — `name` field
- `libs/e2e-harness/README.md` — rename references + scope clarification
- `libs/e2e-harness/src/test-helpers.ts` — revert to working cockpit-tuned shape
- Per-example cockpit dirs (3 currently): playwright.config.ts + global-setup-impl.ts + any spec files — update relative imports from `libs/internal/aimock-harness/src` to `libs/e2e-harness/src`
- `examples/chat/angular/e2e/global-setup.ts` — `REPO_ROOT` relative path adjustment for new depth
- `examples/chat/angular/project.json` — add `e2e` target (and optional `record`, `drift` targets)
- `.github/workflows/ci.yml` — chat job rename + path/command updates + `deploy.needs` update
- `.github/workflows/aimock-drift.yml` — invocation path update

### Deletions

- `examples/chat/angular/e2e/project.json` (the `examples-chat-aimock-e2e` Nx project dissolves)
- The empty `examples/chat/aimock-e2e/` directory (after move)

## Components

### Cockpit per-example imports

Each of `cockpit/<product>/<example>/angular/e2e/global-setup-impl.ts` has:

```typescript
import { createGlobalSetup } from '../../../../../libs/internal/aimock-harness/src';
```

Becomes:

```typescript
import { createGlobalSetup } from '../../../../../libs/e2e-harness/src';
```

Each `playwright.config.ts` has:

```typescript
globalTeardown: require.resolve('../../../../../libs/internal/aimock-harness/src/global-teardown'),
```

Becomes:

```typescript
globalTeardown: require.resolve('../../../../../libs/e2e-harness/src/global-teardown'),
```

Cockpit per-example dirs touched (verify during implementation):
- `cockpit/langgraph/streaming/angular/e2e/`
- `cockpit/chat/tool-calls/angular/e2e/`
- `cockpit/chat/subagents/angular/e2e/`

Their spec files generally don't import from the lib (they import from `sendPromptAndWait` via the global-setup-impl path or via a wrapper). Verify with grep.

### Chat e2e dir internal references

After the move, `examples/chat/angular/e2e/global-setup.ts` has:

```typescript
const REPO_ROOT = resolve(__dirname, '../../..');
```

The old `examples/chat/aimock-e2e/` was 3 levels deep (`examples/chat/aimock-e2e/`). The new `examples/chat/angular/e2e/` is 4 levels deep. So:

```typescript
const REPO_ROOT = resolve(__dirname, '../../../..');
```

Other `__dirname`-relative paths in the chat global-setup, scripts, etc. — audit and update.

## Risk surface

- **Chat helper behavior** must NOT change. The migration's failure mode was a lib helper modification breaking chat markdown rendering. This rename keeps chat's own helper intact, so the failure mode can't repeat.
- **Cockpit helper behavior** must NOT change. Reverting the lib's `sendPromptAndWait` to the pre-session working version restores the cockpit-tuned signal.
- **Relative imports** for cockpit per-example dirs need correct path-segment count. Easy to typo; grep verification after the move.
- **`REPO_ROOT` resolution** inside chat's moved global-setup needs the right number of `..` segments. Audit script needed.

## Acceptance criteria

- `libs/internal/aimock-harness/` directory is gone; `libs/e2e-harness/` exists with all the same files (renamed via `git mv`).
- `libs/e2e-harness/project.json` has `name: "e2e-harness"`.
- `libs/e2e-harness/src/test-helpers.ts` matches the pre-session cockpit-tuned shape.
- `examples/chat/aimock-e2e/` directory is gone; `examples/chat/angular/e2e/` exists with all the same files.
- `examples/chat/angular/project.json` has an `e2e` target.
- `examples-chat-aimock-e2e` Nx project no longer exists.
- `nx e2e examples-chat-angular` passes locally with 3/3 consecutive stability runs. All 7 chat specs + the runner spec pass.
- `nx e2e cockpit-langgraph-streaming-angular`, `nx e2e cockpit-chat-tool-calls-angular`, `nx e2e cockpit-chat-subagents-angular` all pass — proves the cockpit lib import rename worked.
- `nx run-many --target=e2e --projects=cockpit-*-angular` (or the equivalent CI loop) passes.
- `ci.yml`'s `examples-chat-e2e` job is green; `deploy.needs` updated.
- `aimock-drift.yml` YAML parses (manual `workflow_dispatch` verification is optional post-merge).
- Final reference grep `grep -rn 'internal/aimock-harness\|examples-chat-aimock-e2e\|examples/chat/aimock-e2e' ... ` returns zero matches outside `docs/superpowers/`.
