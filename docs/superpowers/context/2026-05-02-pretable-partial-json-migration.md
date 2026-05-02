# Migrate pretable to consume @cacheplane/partial-json

**Use as a self-contained prompt for a fresh session.** Hand this file to a new agent after Phase 1 of the chat pipeline redesign has shipped (i.e., `@cacheplane/partial-json@1.0.0` is on npm).

---

## Context

Two projects historically maintained their own partial-JSON streaming parsers:

- `~/repos/pretable/packages/json-stream/` — strict tokenizer with explicit state machine, identity preservation, `finish()` semantics. Purpose-built for tabular streaming.
- `~/repos/angular-agent-framework/libs/partial-json/` — published as `@ngaf/partial-json@0.0.2`. Lighter tokenizer, plus event API, `getByPath` (RFC 6901), and `materialize()` with WeakMap structural sharing.

Phase 1 of the chat pipeline redesign extracted a unified parser to `@cacheplane/partial-json@1.0.0` (new repo: `github.com/cacheplane/partial-json`). The new package combines:

- pretable's tokenizer + identity preservation + `finish()`
- @ngaf/partial-json's event API + `getByPath` + `materialize`

Public API is documented in the new repo's README. Both pull-style (`create / push / finish / resolve`) and push-style (`createPartialJsonParser` with events) are supported. Internally they share the same node graph, so consumers can mix.

The angular-agent-framework monorepo has already migrated its consumers (`@ngaf/chat`, `@ngaf/a2ui`, `@ngaf/render`). `@ngaf/partial-json` is frozen at 0.0.2 with a deprecation notice.

This task migrates pretable to consume `@cacheplane/partial-json` and deletes its local `packages/json-stream/` directory.

## Goals

- Pretable's `packages/stream-adapter`, `packages/grid-core`, and any other internal consumers import from `@cacheplane/partial-json` instead of `./packages/json-stream`.
- Pretable's `packages/json-stream/` directory is deleted.
- All existing tests continue to pass without semantic changes.
- pretable's published packages (if any) bump appropriately.

## Non-goals

- API behavior changes in pretable's public surface. The migration must be transparent to pretable's downstream users.
- Adding new features to the parser. Phase 1 already merged the feature sets.
- Touching `~/repos/angular-agent-framework`. Its consumers were migrated in Phase 1.

## Pre-flight checks

1. Confirm `@cacheplane/partial-json@1.0.0` is published:
   ```bash
   npm view @cacheplane/partial-json
   ```
2. Read the new package's README to understand its public API.
3. Read pretable's current parser entry point: `~/repos/pretable/packages/json-stream/src/index.ts`. Note exported names.
4. Find every consumer of the local parser:
   ```bash
   cd ~/repos/pretable
   grep -rn "from ['\"]\.\./json-stream" packages
   grep -rn "from ['\"]\.\./\.\./json-stream" packages
   grep -rn "from ['\"]@pretable/json-stream" packages apps
   ```

   Expected hits (from the original audit):
   - `packages/stream-adapter/src/parse-partial-stream.ts`
   - `packages/stream-adapter/src/connect-partial-stream.ts`
   - `apps/streaming-demo/src/replay-engine.ts`
   - any tests under `packages/json-stream/src/__tests__/`

## Migration steps

### 1. Add the dependency

In each pretable package that consumes the parser, add `@cacheplane/partial-json` to `dependencies` (or `peerDependencies` for libraries):

```json
"dependencies": {
  "@cacheplane/partial-json": "^1.0.0"
}
```

### 2. Rewrite imports

For every file found in pre-flight step 4, replace the local-parser import with the npm package. Two cases:

**Pull-style imports** (most common in pretable):

```ts
// before
import { create, push, finish, resolve, type StreamState } from '../json-stream/src';

// after
import { create, push, finish, resolve, type StreamState } from '@cacheplane/partial-json';
```

**AST node type imports**:

```ts
// before
import type { ArrayNode, ObjectNode, StringNode } from '../json-stream/src/types';

// after
import type { ArrayNode, ObjectNode, StringNode } from '@cacheplane/partial-json';
```

The new package re-exports all public types from its top-level index.

### 3. Verify behavior parity

Run pretable's existing test suite. Expected: no regressions. The new package's tokenizer is a superset of pretable's (same strict validation, plus additional partial-keyword handling).

```bash
cd ~/repos/pretable
pnpm test  # or whatever the project's test runner is
```

If any test fails, read the failure carefully. Likely causes:

- A test was relying on a quirk of the old parser that the new one fixes (e.g., the partial-keyword bug in @ngaf was fixed; pretable should not have been affected, but verify).
- An API name changed. Cross-reference with the new package's exports.

### 4. Delete `packages/json-stream/`

Once tests pass:

```bash
git rm -r packages/json-stream
```

Update pretable's workspace configuration (root `package.json`, `pnpm-workspace.yaml`, or equivalent) to remove the `json-stream` workspace package entry.

### 5. Update top-level docs

Pretable's README (or architecture docs) likely reference `packages/json-stream`. Update to reference `@cacheplane/partial-json`.

### 6. Verify the streaming demo

```bash
cd apps/streaming-demo
pnpm dev
```

Manually exercise the streaming demo end-to-end. Confirm:

- Parser handles real LLM output without errors
- Identity preservation still works (rows that haven't changed don't trigger re-renders)
- `finish()` semantics close open containers correctly at stream end

### 7. Commit and PR

Single commit, descriptive message. Title example:

> chore(json-stream): migrate to @cacheplane/partial-json

PR body should include:

- Why the migration (single source of truth shared with another consumer; shared improvements)
- What changed (imports rewritten, local package deleted)
- What didn't change (public API, behavior, test outcomes)
- Test plan (existing test suite + manual streaming demo verification)

Do NOT reference the other consumer project by name in commits, PRs, or docs unless explicitly asked. Keep the migration self-contained to pretable.

## Edge cases to watch

- **Test files referencing internal helpers**: If pretable tests imported non-public helpers (e.g., `internals.ts`), those won't be exported from the npm package. Either rewrite the tests against the public API, or delete them as redundant (the npm package has its own tests).
- **`finish()` ordering**: Pretable's `parsePartialStream` calls `finish(state)` at end of stream. Confirm this works identically in the new package. Should be a no-op since the algorithm is the same.
- **Error message format**: If pretable surfaces parser errors to its UI, confirm the error message strings haven't changed in ways that break user-visible text.
- **Performance**: Pretable batches updates on RAF and is sensitive to per-token allocation. Run a perf comparison on a 1000-row stream before and after.

## Rollback

If migration breaks pretable badly, revert by restoring `packages/json-stream/` from git history and reverting the imports. The new package is additive; nothing pretable does today is incompatible with keeping its local parser.

## When done

Confirm in the chat:

- Imports updated, local package deleted
- All tests passing
- Streaming demo verified
- PR opened (or merged, depending on the user's workflow)

Report any unexpected findings (especially around behavior parity or perf differences).
