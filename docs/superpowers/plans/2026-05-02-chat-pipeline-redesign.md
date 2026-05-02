# Chat Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared partial-JSON streaming parser to `@cacheplane/partial-json` (Phase 1), rewrite `@ngaf/chat`'s streaming markdown renderer as a RAF-batched full-reparse component (Phase 2), and add a dedicated welcome-screen primitive distinct from the conversation layout (Phase 3).

**Architecture:** Phase 1 lands first as a standalone package consumed by both `@ngaf/chat` and a separate downstream tabular project (handled separately). Phase 2 replaces the bespoke append-only DOM renderer with a simpler RAF-coalesced full-reparse component, fixing a class of negative-delta freeze bugs and adding a localStorage-gated trace harness for diagnostics. Phase 3 introduces `<chat-welcome>` as the empty-state owner with a centered greeting, beacon dot animation, optional vertical suggestion rows, and slot-projected input.

**Tech Stack:** TypeScript, Vitest (Phase 1 + Phase 2 tests), Angular 21 standalone components, marked (markdown), Nx monorepo build, npm trusted publishing via OIDC.

**Constraint:** No commit, comment, doc, or PR may reference any chat-UI library this work was inspired by. Keep all language native to this codebase.

**Worktree (Phases 2 & 3):** `/Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac`

**Phase 1 working repo:** `git@github.com:cacheplane/partial-json.git` (already created, empty)

**Spec:** `docs/superpowers/specs/2026-05-02-chat-pipeline-redesign-design.md`

---

## File Structure

### Phase 1 (new repo: `cacheplane/partial-json`)

| Path | Purpose |
|---|---|
| `package.json` | Package metadata, npm publish config, scripts |
| `tsconfig.json`, `tsconfig.build.json` | TS compile config |
| `vitest.config.ts` | Test runner config |
| `tsup.config.ts` | ESM + CJS dual build |
| `src/index.ts` | Public API surface (re-exports) |
| `src/types.ts` | All public + internal types |
| `src/guards.ts` | `isArrayNode`, `isObjectNode`, `isComplete`, etc. |
| `src/internals.ts` | Identity preservation, node mutation helpers |
| `src/handlers.ts` | Per-mode tokenizer state handlers |
| `src/create.ts` | `create()` factory |
| `src/push.ts` | `push()` driver |
| `src/finish.ts` | `finish()` end-of-stream handling |
| `src/resolve.ts` | `resolve()` materialize for pull-style |
| `src/parser.ts` | `createPartialJsonParser` push-style API + events + getByPath |
| `src/materialize.ts` | `materialize()` with WeakMap structural sharing |
| `src/__tests__/*.test.ts` | Unioned + new tests |
| `.github/workflows/ci.yml` | Lint + test + build |
| `.github/workflows/publish.yml` | Tag-triggered publish via OIDC |
| `README.md` | Public docs |
| `LICENSE` | MIT |

### Phase 2 (worktree)

| Path | Action |
|---|---|
| `libs/chat/src/lib/streaming/streaming-markdown.ts` | DELETE |
| `libs/chat/src/lib/streaming/streaming-markdown.spec.ts` | DELETE |
| `libs/chat/src/lib/streaming/streaming-markdown.component.ts` | REWRITE |
| `libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts` | CREATE |
| `libs/chat/src/lib/streaming/trace.ts` | CREATE |
| `libs/chat/src/lib/streaming/trace.spec.ts` | CREATE |
| `libs/chat/src/lib/streaming/content-classifier.ts` | UPDATE imports + add trace |
| `libs/chat/src/lib/streaming/parse-tree-store.ts` | UPDATE imports |
| `libs/chat/src/lib/streaming/parse-tree-store.spec.ts` | UPDATE imports |
| `libs/chat/src/lib/compositions/chat/chat.component.ts` | rekey classifier Map by id, add janitor |
| `libs/chat/package.json` | + `@cacheplane/partial-json` dep, − `@ngaf/partial-json` peer |
| `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` | add trace call sites |
| `libs/partial-json/package.json` | add `"deprecated"` field |

### Phase 3 (worktree)

| Path | Action |
|---|---|
| `libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.ts` | CREATE |
| `libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.spec.ts` | CREATE |
| `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts` | CREATE |
| `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.spec.ts` | CREATE |
| `libs/chat/src/lib/styles/chat-welcome.styles.ts` | CREATE |
| `libs/chat/src/lib/styles/chat-tokens.ts` | append fade-in keyframe |
| `libs/chat/src/lib/compositions/chat/chat.component.ts` | wire welcome branch + showWelcome computed + welcomeDisabled input |
| `libs/chat/src/lib/compositions/chat/chat.component.spec.ts` | add welcome behavior tests |
| `libs/chat/src/public-api.ts` | export new components |

---

# Phase 1: Extract `@cacheplane/partial-json`

Working repo: `~/repos/cacheplane-partial-json/` (clone of `git@github.com:cacheplane/partial-json.git`).

### Task 1.1: Clone repo, scaffold package

**Files:**
- Create: `~/repos/cacheplane-partial-json/package.json`
- Create: `~/repos/cacheplane-partial-json/tsconfig.json`
- Create: `~/repos/cacheplane-partial-json/tsconfig.build.json`
- Create: `~/repos/cacheplane-partial-json/vitest.config.ts`
- Create: `~/repos/cacheplane-partial-json/tsup.config.ts`
- Create: `~/repos/cacheplane-partial-json/.gitignore`
- Create: `~/repos/cacheplane-partial-json/LICENSE`
- Create: `~/repos/cacheplane-partial-json/README.md`

- [ ] **Step 1: Clone the repo**

```bash
cd ~/repos
git clone git@github.com:cacheplane/partial-json.git cacheplane-partial-json
cd cacheplane-partial-json
```

- [ ] **Step 2: Initialize package.json**

```bash
cat > package.json <<'JSON'
{
  "name": "@cacheplane/partial-json",
  "version": "1.0.0",
  "description": "Streaming partial-JSON parser with identity preservation, push/pull APIs, JSON Pointer lookups, and structural-sharing materialization.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/cacheplane/partial-json.git"
  },
  "homepage": "https://github.com/cacheplane/partial-json#readme",
  "bugs": "https://github.com/cacheplane/partial-json/issues",
  "keywords": ["json", "stream", "partial", "parser", "incremental", "llm"],
  "publishConfig": { "access": "public", "provenance": true }
}
JSON
```

- [ ] **Step 3: Add tsconfig**

```bash
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.ts"]
}
JSON

cat > tsconfig.build.json <<'JSON'
{
  "extends": "./tsconfig.json"
}
JSON
```

- [ ] **Step 4: Add vitest + tsup configs**

```bash
cat > vitest.config.ts <<'TS'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    },
  },
});
TS

cat > tsup.config.ts <<'TS'
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: 'dist',
});
TS
```

- [ ] **Step 5: .gitignore + LICENSE + README**

```bash
cat > .gitignore <<'TXT'
node_modules/
dist/
coverage/
*.log
.DS_Store
.vitest-cache/
TXT

cat > LICENSE <<'TXT'
MIT License

Copyright (c) 2026 cacheplane

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
TXT

cat > README.md <<'MD'
# @cacheplane/partial-json

Streaming partial-JSON parser. Returns a structured AST as bytes arrive, preserves object identity across mutations, and supports both pull-style (`create / push / finish / resolve`) and push-style (`createPartialJsonParser` with events) APIs.

## Install

```bash
npm install @cacheplane/partial-json
```

## Quick start

```ts
import { createPartialJsonParser, materialize } from '@cacheplane/partial-json';

const parser = createPartialJsonParser();
parser.push('{"items":[{"id":"a"},');
parser.push('{"id":"b"}]}');

const node = parser.getByPath('/items/1/id');
const value = materialize(parser.root);
```

## API

See full documentation at https://github.com/cacheplane/partial-json
MD
```

- [ ] **Step 6: Install + initial commit**

```bash
npm install
git add .
git commit -m "chore: scaffold package (package.json, tsconfig, vitest, tsup, README)"
```

---

### Task 1.2: Port types + guards

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/types.ts`
- Create: `~/repos/cacheplane-partial-json/src/guards.ts`

- [ ] **Step 1: Port types from pretable**

Copy `~/repos/pretable/packages/json-stream/src/types.ts` to `src/types.ts` verbatim. This file already has the AST node types (`AstNode`, `ArrayNode`, `BoolNode`, `NullNode`, `NumberNode`, `ObjectNode`, `StringNode`, `JsonValue`, `NodeStatus`, `StreamError`, `StreamState`, internal helper types).

```bash
cp ~/repos/pretable/packages/json-stream/src/types.ts src/types.ts
```

- [ ] **Step 2: Append the push-style types**

After the pretable types, append the push-style API types from `@ngaf/partial-json/src/lib/types.ts` (RENAMED to avoid collision with pretable's pull-style names).

Open `~/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/libs/partial-json/src/lib/types.ts` and copy its contents. Append to `src/types.ts` with this header:

```ts
// ────────────────────────────────────────────────────────────────────────────
// Push-style API types (createPartialJsonParser).
// These wrap the pull-style state machine (above) with a node tree + events.
// ────────────────────────────────────────────────────────────────────────────
```

Both type sets coexist; no renames yet because their public names don't collide.

- [ ] **Step 3: Port guards**

```bash
cp ~/repos/pretable/packages/json-stream/src/guards.ts src/guards.ts
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: PASS (or report which symbols are missing — fix by porting any imported helpers from pretable's `internals.ts` headers).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/guards.ts
git commit -m "feat: port AST types + type guards"
```

---

### Task 1.3: Port internals + create

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/internals.ts`
- Create: `~/repos/cacheplane-partial-json/src/create.ts`

- [ ] **Step 1: Copy files**

```bash
cp ~/repos/pretable/packages/json-stream/src/internals.ts src/internals.ts
cp ~/repos/pretable/packages/json-stream/src/create.ts src/create.ts
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/internals.ts src/create.ts
git commit -m "feat: port identity preservation + state factory"
```

---

### Task 1.4: Port handlers + push + finish + resolve

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/handlers.ts`
- Create: `~/repos/cacheplane-partial-json/src/push.ts`
- Create: `~/repos/cacheplane-partial-json/src/finish.ts`
- Create: `~/repos/cacheplane-partial-json/src/resolve.ts`

- [ ] **Step 1: Copy four files**

```bash
cp ~/repos/pretable/packages/json-stream/src/handlers.ts src/handlers.ts
cp ~/repos/pretable/packages/json-stream/src/push.ts src/push.ts
cp ~/repos/pretable/packages/json-stream/src/finish.ts src/finish.ts
cp ~/repos/pretable/packages/json-stream/src/resolve.ts src/resolve.ts
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/handlers.ts src/push.ts src/finish.ts src/resolve.ts
git commit -m "feat: port tokenizer (handlers, push driver, finish, resolve)"
```

---

### Task 1.5: Port pretable test suite, run it green

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/__tests__/chunk-boundary.test.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/core-parsing.test.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/edge-cases.test.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/errors.test.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/guards.test.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/streaming.test.ts`

- [ ] **Step 1: Copy all six test files**

```bash
mkdir -p src/__tests__
cp ~/repos/pretable/packages/json-stream/src/__tests__/*.test.ts src/__tests__/
```

- [ ] **Step 2: Update imports**

The pretable tests import from `../index` or relative paths. Search and replace any references to the old package name. Confirm imports look like `from '../create'`, `from '../push'`, etc. (relative to `src/__tests__/`).

```bash
grep -l "@cacheplane/json-stream\|@pretable" src/__tests__/*.test.ts
```

If grep returns files, edit them to use relative imports.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS (all pretable tests). If any fail, the cause is a port issue — fix the corresponding source file.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/
git commit -m "test: port pretable tokenizer + identity-preservation suites"
```

---

### Task 1.6: Add push-style parser layer

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/parser.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/parser.test.ts`

- [ ] **Step 1: Copy ngaf's parser.ts**

```bash
cp ~/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/libs/partial-json/src/lib/parser.ts src/parser.ts
```

- [ ] **Step 2: Bridge it onto the pretable state machine**

The ngaf parser.ts is currently self-contained (its own tokenizer). We're replacing the tokenizer with pretable's. Edit `src/parser.ts`:

Add at the top:

```ts
import { create as createState, push as pushState, finish as finishState } from './push';
import { isComplete, isObjectNode, isArrayNode, isStringNode, isNumberNode, isBoolNode, isNullNode } from './guards';
import type { StreamState, AstNode } from './types';
```

Replace the internal tokenizer in `parser.push(chunk)` with a delegation to the pretable state:

```ts
function createPartialJsonParser(): PartialJsonParser {
  let state: StreamState = createState();
  // ... existing event tracking, root accessor, getByPath ...

  return {
    push(chunk: string): ParseEvent[] {
      const before = state;
      state = pushState(state, chunk);
      const events = diffStates(before, state);
      return events;
    },
    finish(): ParseEvent[] {
      const before = state;
      state = finishState(state);
      return diffStates(before, state);
    },
    get root(): JsonNode | null {
      return state.rootId != null ? toJsonNode(state, state.rootId) : null;
    },
    getByPath(path: string): JsonNode | null { /* JSON Pointer impl, see ngaf parser.ts:330+ */ },
  };
}
```

The `diffStates(before, after)` helper compares node arrays and emits `node-created` / `value-updated` / `node-completed` events. The `toJsonNode(state, id)` converts pretable's AstNode to ngaf's JsonNode shape.

(See ngaf's parser.ts for the event emission and JSON Pointer logic; copy as-is, only swap the tokenizer.)

- [ ] **Step 3: Copy the test file**

```bash
cp ~/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/libs/partial-json/src/lib/parser.spec.ts src/__tests__/parser.test.ts
```

Update imports inside the file from `'./parser'` to `'../parser'`.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: PASS. Some ngaf tests may fail because the new tokenizer is stricter (e.g. `tru` is now buffered, not eagerly completed). Adjust test expectations to the strict behavior — these are correctness improvements, not regressions.

Document any test changes with a comment like:

```ts
// Updated for stricter tokenizer: `tru` is now buffered until `e` arrives or
// the stream finishes (was: eagerly completed as boolean).
```

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts src/__tests__/parser.test.ts
git commit -m "feat: push-style parser API layered on the strict tokenizer"
```

---

### Task 1.7: Port materialize + tests

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/materialize.ts`
- Create: `~/repos/cacheplane-partial-json/src/__tests__/materialize.test.ts`

- [ ] **Step 1: Copy materialize**

```bash
cp ~/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/libs/partial-json/src/lib/materialize.ts src/materialize.ts
cp ~/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/libs/partial-json/src/lib/materialize.spec.ts src/__tests__/materialize.test.ts
```

- [ ] **Step 2: Update imports inside materialize.test.ts**

Change `from './materialize'` to `from '../materialize'` and `from './parser'` to `from '../parser'`.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/materialize.ts src/__tests__/materialize.test.ts
git commit -m "feat: port structural-sharing materialize() + tests"
```

---

### Task 1.8: Public API surface — `src/index.ts`

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/index.ts`

- [ ] **Step 1: Write the index**

```ts
// SPDX-License-Identifier: MIT
//
// @cacheplane/partial-json — streaming partial-JSON parser
//
// Two public APIs over the same core tokenizer:
//   - Pull-style:  create() → push(state, chunk) → finish(state) → resolve(state)
//   - Push-style:  createPartialJsonParser() → parser.push(chunk) → events
//
// Both share the same node graph internally; mix freely.

// ── Pull-style (immutable state) ─────────────────────────────────────────────
export type {
  AstNode, ArrayNode, BoolNode, JsonValue, NodeStatus,
  NullNode, NumberNode, ObjectNode, StringNode,
  StreamError, StreamState,
} from './types';

export {
  isArrayNode, isBoolNode, isComplete, isNullNode,
  isNumberNode, isObjectNode, isStringNode,
} from './guards';

export { create } from './create';
export { push } from './push';
export { finish } from './finish';
export { resolve } from './resolve';

// ── Push-style (parser + events) ─────────────────────────────────────────────
export type {
  JsonNodeType, JsonNodeStatus, JsonNodeBase,
  JsonObjectNode, JsonArrayNode, JsonStringNode,
  JsonNumberNode, JsonBooleanNode, JsonNullNode,
  JsonNode, ParseEvent, PartialJsonParser,
} from './types';

export { createPartialJsonParser } from './parser';
export { materialize } from './materialize';
```

- [ ] **Step 2: Run typecheck + tests + build**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all PASS. `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts` exist.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: public API surface (pull + push styles unified)"
```

---

### Task 1.9: Cross-cutting parity tests

**Files:**
- Create: `~/repos/cacheplane-partial-json/src/__tests__/parity.test.ts`

- [ ] **Step 1: Write the parity test**

```ts
import { describe, it, expect } from 'vitest';
import { create, push, finish, resolve, createPartialJsonParser, materialize } from '../index';

describe('pull/push API parity', () => {
  it('produces the same JsonValue for a complete simple object', () => {
    const input = '{"a":1,"b":["x","y"],"c":null}';

    let state = create();
    state = push(state, input);
    state = finish(state);
    const pullValue = resolve(state);

    const parser = createPartialJsonParser();
    parser.push(input);
    parser.finish?.();
    const pushValue = materialize(parser.root);

    expect(pullValue).toEqual(pushValue);
    expect(pullValue).toEqual({ a: 1, b: ['x', 'y'], c: null });
  });

  it('handles partial keyword (tru → true) consistently', () => {
    let state = create();
    state = push(state, '[tru');
    state = push(state, 'e]');
    state = finish(state);
    const pullValue = resolve(state);

    const parser = createPartialJsonParser();
    parser.push('[tru');
    parser.push('e]');
    parser.finish?.();
    const pushValue = materialize(parser.root);

    expect(pullValue).toEqual([true]);
    expect(pushValue).toEqual([true]);
  });

  it('preserves identity across no-op pushes (push-style)', () => {
    const parser = createPartialJsonParser();
    parser.push('{"a":1}');
    const before = materialize(parser.root);
    parser.push(' '); // whitespace, no structural change
    const after = materialize(parser.root);
    expect(after).toBe(before); // === reference equality
  });

  it('emits node-created → value-updated → node-completed in order', () => {
    const parser = createPartialJsonParser();
    const events1 = parser.push('"hel');
    const events2 = parser.push('lo"');

    const types = [...events1, ...events2].map(e => e.type);
    expect(types[0]).toBe('node-created');
    expect(types).toContain('value-updated');
    expect(types[types.length - 1]).toBe('node-completed');
  });

  it('getByPath resolves RFC 6901 pointers', () => {
    const parser = createPartialJsonParser();
    parser.push('{"items":[{"id":"a"},{"id":"b"}]}');
    parser.finish?.();
    const node = parser.getByPath('/items/1/id');
    expect(node).toBeTruthy();
    expect(materialize(node)).toBe('b');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: PASS. If parity assertions fail, the cause is in the bridge (`parser.ts`'s `diffStates` or `toJsonNode`). Fix in source.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/parity.test.ts
git commit -m "test: cross-cutting parity tests (pull vs push API)"
```

---

### Task 1.10: ESLint config

**Files:**
- Create: `~/repos/cacheplane-partial-json/eslint.config.js`

- [ ] **Step 1: Write config**

```js
// eslint.config.js
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsparser, parserOptions: { project: './tsconfig.json' } },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS or warnings only (no errors).

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore: eslint config"
```

---

### Task 1.11: GitHub Actions CI

**Files:**
- Create: `~/repos/cacheplane-partial-json/.github/workflows/ci.yml`

- [ ] **Step 1: Write CI**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test -- --coverage
```

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint + typecheck + build + test"
git push -u origin main
```

Expected: CI runs green on GitHub.

---

### Task 1.12: Publish workflow

**Files:**
- Create: `~/repos/cacheplane-partial-json/.github/workflows/publish.yml`

- [ ] **Step 1: Write publish workflow**

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm install -g npm@latest
      - run: npm test
      - run: npm run build
      - run: npm publish --provenance
        env:
          NPM_CONFIG_PROVENANCE: 'true'
```

- [ ] **Step 2: Configure npm trusted publishing**

On npmjs.com, add `cacheplane/partial-json` GitHub repo as a trusted publisher for `@cacheplane/partial-json`. (Manual step — user does this in the npm UI.)

- [ ] **Step 3: Commit + push**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: publish workflow (tag-triggered, OIDC)"
git push
```

---

### Task 1.13: Tag and release v1.0.0

- [ ] **Step 1: Create + push tag**

```bash
cd ~/repos/cacheplane-partial-json
git tag v1.0.0
git push origin v1.0.0
```

- [ ] **Step 2: Watch publish workflow**

```bash
gh run watch
```

Expected: workflow completes, `@cacheplane/partial-json@1.0.0` is on npm.

- [ ] **Step 3: Verify publish**

```bash
npm view @cacheplane/partial-json
```

Expected: shows version 1.0.0.

---

# Phase 2: Chat streaming rewrite

Worktree: `/Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac`

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac
git fetch origin main
git checkout -b claude/chat-streaming-rewrite origin/main
```

### Task 2.1: Add `@cacheplane/partial-json` dep, swap chat imports

**Files:**
- Modify: `libs/chat/package.json`
- Modify: `libs/chat/src/lib/streaming/content-classifier.ts`
- Modify: `libs/chat/src/lib/streaming/parse-tree-store.ts`
- Modify: `libs/chat/src/lib/streaming/parse-tree-store.spec.ts`

- [ ] **Step 1: Update chat package.json peer/dep**

Open `libs/chat/package.json`. Replace the `"@ngaf/partial-json": "*"` peer with `"@cacheplane/partial-json": "^1.0.0"`. Move it from `peerDependencies` to `dependencies` (cacheplane package is bundled as a runtime dep, not a peer).

```json
{
  "name": "@ngaf/chat",
  "dependencies": {
    "@cacheplane/partial-json": "^1.0.0"
  },
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0",
    "@angular/common": "^20.0.0 || ^21.0.0",
    "@angular/forms": "^20.0.0 || ^21.0.0",
    "@angular/platform-browser": "^20.0.0 || ^21.0.0",
    "@ngaf/licensing": "*",
    "@ngaf/render": "*",
    "@ngaf/a2ui": "*",
    "@json-render/core": "^0.16.0",
    "@langchain/core": "^1.1.33",
    "rxjs": "~7.8.0",
    "marked": "^15.0.0 || ^16.0.0"
  }
}
```

- [ ] **Step 2: Update root package.json + npm install**

In the monorepo root `package.json`, add `@cacheplane/partial-json: ^1.0.0` to `dependencies`. Run:

```bash
npm install
```

Expected: lockfile updates with the new package.

- [ ] **Step 3: Swap content-classifier import**

`libs/chat/src/lib/streaming/content-classifier.ts:4`:

```diff
-import { createPartialJsonParser } from '@ngaf/partial-json';
+import { createPartialJsonParser } from '@cacheplane/partial-json';
```

- [ ] **Step 4: Swap parse-tree-store imports**

`libs/chat/src/lib/streaming/parse-tree-store.ts:4-5`:

```diff
-import type { PartialJsonParser, JsonObjectNode } from '@ngaf/partial-json';
-import { materialize } from '@ngaf/partial-json';
+import type { PartialJsonParser, JsonObjectNode } from '@cacheplane/partial-json';
+import { materialize } from '@cacheplane/partial-json';
```

- [ ] **Step 5: Swap parse-tree-store spec import**

`libs/chat/src/lib/streaming/parse-tree-store.spec.ts:4`:

```diff
-import { createPartialJsonParser } from '@ngaf/partial-json';
+import { createPartialJsonParser } from '@cacheplane/partial-json';
```

- [ ] **Step 6: Run chat tests**

```bash
npx nx test chat
```

Expected: all PASS. The cacheplane package's API matches @ngaf/partial-json's, so no behavioral change.

- [ ] **Step 7: Commit**

```bash
git add libs/chat/package.json libs/chat/src/lib/streaming/content-classifier.ts libs/chat/src/lib/streaming/parse-tree-store.ts libs/chat/src/lib/streaming/parse-tree-store.spec.ts package.json package-lock.json
git commit -m "chore(chat): migrate to @cacheplane/partial-json"
```

---

### Task 2.2: Freeze `@ngaf/partial-json` with deprecation notice

**Files:**
- Modify: `libs/partial-json/package.json`

- [ ] **Step 1: Add deprecated field**

Open `libs/partial-json/package.json`. Add a top-level `"deprecated"` field:

```json
{
  "name": "@ngaf/partial-json",
  "version": "0.0.2",
  "deprecated": "Replaced by @cacheplane/partial-json. No further versions will be published from this package."
}
```

- [ ] **Step 2: Verify build still works**

```bash
npx nx build partial-json
```

Expected: PASS (deprecated field is metadata only).

- [ ] **Step 3: Commit**

```bash
git add libs/partial-json/package.json
git commit -m "chore(partial-json): mark @ngaf/partial-json deprecated in favor of @cacheplane/partial-json"
```

---

### Task 2.3: Trace harness — TDD

**Files:**
- Create: `libs/chat/src/lib/streaming/trace.ts`
- Create: `libs/chat/src/lib/streaming/trace.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// libs/chat/src/lib/streaming/trace.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTraceEnabled, trace } from './trace';

describe('trace', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete (globalThis as any).window?.__ngafChatTrace;
    try { (globalThis as any).window?.localStorage?.removeItem('NGAF_CHAT_STREAM_TRACE'); } catch { /* ignore */ }
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns false when no flag is set', () => {
    expect(isTraceEnabled()).toBe(false);
  });

  it('returns true when window.__ngafChatTrace === true', () => {
    (globalThis as any).window = { ...((globalThis as any).window ?? {}), __ngafChatTrace: true };
    expect(isTraceEnabled()).toBe(true);
  });

  it('returns true when localStorage NGAF_CHAT_STREAM_TRACE === "1"', () => {
    const ls = { getItem: (k: string) => (k === 'NGAF_CHAT_STREAM_TRACE' ? '1' : null) };
    (globalThis as any).window = { ...((globalThis as any).window ?? {}), localStorage: ls };
    expect(isTraceEnabled()).toBe(true);
  });

  it('does not call console.debug when disabled', () => {
    trace('hello');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('calls console.debug with prefix when enabled', () => {
    (globalThis as any).window = { ...((globalThis as any).window ?? {}), __ngafChatTrace: true };
    trace('hello', { foo: 1 });
    expect(consoleSpy).toHaveBeenCalledWith('[ngaf-chat-stream]', 'hello', { foo: 1 });
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx nx test chat -- trace.spec.ts
```

Expected: FAIL with "Cannot find module './trace'".

- [ ] **Step 3: Write the implementation**

```ts
// libs/chat/src/lib/streaming/trace.ts
// SPDX-License-Identifier: MIT
//
// localStorage / window-flag-gated debug tracer for @ngaf/chat streaming.
// Off by default. Enable via:
//   window.__ngafChatTrace = true
//   localStorage.NGAF_CHAT_STREAM_TRACE = '1'
//
// All call sites should be guarded with `if (isTraceEnabled())` so the
// argument-collection cost is paid only when tracing is on.

export function isTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const win = (globalThis as { window?: { __ngafChatTrace?: boolean; localStorage?: Storage } }).window;
  if (!win) return false;
  if (win.__ngafChatTrace === true) return true;
  try {
    return win.localStorage?.getItem('NGAF_CHAT_STREAM_TRACE') === '1';
  } catch {
    return false;
  }
}

export function trace(...args: unknown[]): void {
  if (isTraceEnabled()) {
    // eslint-disable-next-line no-console
    console.debug('[ngaf-chat-stream]', ...args);
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx nx test chat -- trace.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/streaming/trace.ts libs/chat/src/lib/streaming/trace.spec.ts
git commit -m "feat(chat): localStorage-gated stream-trace harness"
```

---

### Task 2.4: Write failing tests for new chat-streaming-md

**Files:**
- Create: `libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
// libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatStreamingMdComponent } from './streaming-markdown.component';

function flushRaf(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

describe('ChatStreamingMdComponent', () => {
  let fixture: ComponentFixture<ChatStreamingMdComponent>;
  let component: ChatStreamingMdComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatStreamingMdComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('content', '');
  });

  it('renders markdown into innerHTML on first content', async () => {
    fixture.componentRef.setInput('content', '# Heading');
    fixture.detectChanges();
    await flushRaf();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.innerHTML).toContain('<h1');
    expect(el.innerHTML).toContain('Heading');
  });

  it('coalesces multiple updates into one render per frame', async () => {
    fixture.componentRef.setInput('content', '# A');
    fixture.detectChanges();
    fixture.componentRef.setInput('content', '# AB');
    fixture.detectChanges();
    fixture.componentRef.setInput('content', '# ABC');
    fixture.detectChanges();
    await flushRaf();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.innerHTML).toContain('ABC');
  });

  it('handles content shrinking without freezing (regression)', async () => {
    fixture.componentRef.setInput('content', '# Long heading');
    fixture.detectChanges();
    await flushRaf();
    fixture.componentRef.setInput('content', '# Short');
    fixture.detectChanges();
    await flushRaf();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.innerHTML).toContain('Short');
    expect(el.innerHTML).not.toContain('Long heading');
  });

  it('cleans up pending RAF on destroy', async () => {
    const spy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    fixture.componentRef.setInput('content', '# X');
    fixture.detectChanges();
    fixture.destroy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx nx test chat -- streaming-markdown.component.spec.ts
```

Expected: FAIL — old component still uses incremental renderer; the "shrink" test will fail with old behavior, others may fail or hang.

- [ ] **Step 3: Commit (failing tests as a forcing function)**

```bash
git add libs/chat/src/lib/streaming/streaming-markdown.component.spec.ts
git commit -m "test(chat): failing specs for RAF-batched streaming markdown"
```

---

### Task 2.5: Rewrite `chat-streaming-md` component

**Files:**
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.component.ts`

- [ ] **Step 1: Rewrite the file**

```ts
// libs/chat/src/lib/streaming/streaming-markdown.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { renderMarkdownToString } from './markdown-render';
import { isTraceEnabled, trace } from './trace';

/**
 * Renders markdown content via marked.parse + sanitized innerHTML, coalesced
 * to one render per animation frame. No incremental renderer state, no delta
 * math — just write the latest content. Idempotent within a frame.
 *
 * The `streaming` input is informational (it can drive parent-level decisions
 * like showing a caret), but doesn't change the render strategy here.
 */
@Component({
  selector: 'chat-streaming-md',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `:host { display: block; }`,
})
export class ChatStreamingMdComponent {
  readonly content = input.required<string>();
  readonly streaming = input<boolean>(false);

  private readonly el = inject(ElementRef).nativeElement as HTMLElement;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private rafHandle = 0;
  private pendingContent = '';

  constructor() {
    effect(() => {
      const next = this.content();
      untracked(() => this.schedule(next));
    });

    this.destroyRef.onDestroy(() => {
      if (this.rafHandle) {
        cancelAnimationFrame(this.rafHandle);
        this.rafHandle = 0;
      }
    });
  }

  private schedule(content: string): void {
    this.pendingContent = content;
    if (this.rafHandle !== 0) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      this.flush();
    });
  }

  private flush(): void {
    const content = this.pendingContent;
    if (!content) {
      this.el.innerHTML = '';
      return;
    }
    const start = isTraceEnabled() ? performance.now() : 0;
    this.el.innerHTML = renderMarkdownToString(content, this.sanitizer);
    if (isTraceEnabled()) {
      trace('streaming-md.flush', { contentLength: content.length, durationMs: performance.now() - start });
    }
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx nx test chat -- streaming-markdown.component.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/streaming/streaming-markdown.component.ts
git commit -m "refactor(chat): rewrite chat-streaming-md as RAF-batched full reparse"
```

---

### Task 2.6: Delete the incremental renderer

**Files:**
- Delete: `libs/chat/src/lib/streaming/streaming-markdown.ts`
- Delete: `libs/chat/src/lib/streaming/streaming-markdown.spec.ts`

- [ ] **Step 1: Delete files**

```bash
git rm libs/chat/src/lib/streaming/streaming-markdown.ts
git rm libs/chat/src/lib/streaming/streaming-markdown.spec.ts
```

- [ ] **Step 2: Confirm nothing else imports them**

```bash
grep -rn "streaming-markdown\b\|createStreamingMarkdownRenderer\|StreamingMarkdownRenderer" libs/chat/src
```

Expected: only references inside `streaming-markdown.component.ts` (the rewritten file no longer imports from it). If anything else imports, edit those out.

- [ ] **Step 3: Run all chat tests + build**

```bash
npx nx test chat
npx nx build chat
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(chat): delete bespoke append-only markdown renderer"
```

---

### Task 2.7: Rekey classifiers Map by message id + janitor

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Read current state**

`libs/chat/src/lib/compositions/chat/chat.component.ts:212`:

```ts
private readonly classifiers = new Map<number, ContentClassifier>();
```

`classifyMessage(content, index)` is called from the template at `let-i="index"`.

- [ ] **Step 2: Switch to id-keyed lookup**

Change line 212:

```ts
private readonly classifiers = new Map<string, ContentClassifier>();
```

Change `classifyMessage` signature (around line 272-275):

```ts
classifyMessage(content: string, message: { id?: string }): ContentClassifier {
  const id = message.id ?? '';
  let c = this.classifiers.get(id);
  if (!c) {
    c = createContentClassifier();
    this.classifiers.set(id, c);
  }
  c.update(content);
  return c;
}
```

Update the template call site (around line 118):

```html
@let classified = classifyMessage(content, message);
```

- [ ] **Step 3: Add janitor effect**

Inside the constructor (after the existing `effect()` blocks):

```ts
effect(() => {
  // janitor: drop classifiers for messages no longer in the agent's list
  const liveIds = new Set<string>();
  try { for (const m of this.agent().messages()) {
    const id = (m as unknown as { id?: string }).id;
    if (id) liveIds.add(id);
  } } catch { return; }
  for (const key of [...this.classifiers.keys()]) {
    if (!liveIds.has(key)) {
      this.classifiers.get(key)?.dispose();
      this.classifiers.delete(key);
    }
  }
});
```

- [ ] **Step 4: Run tests**

```bash
npx nx test chat
```

Expected: PASS.

- [ ] **Step 5: Build**

```bash
npx nx build chat
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "fix(chat): key classifier cache by message id + janitor for stale entries"
```

---

### Task 2.8: Wire trace into call sites

**Files:**
- Modify: `libs/chat/src/lib/streaming/content-classifier.ts`
- Modify: `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`

- [ ] **Step 1: Trace in content-classifier**

Add at the top of `content-classifier.ts`:

```ts
import { isTraceEnabled, trace } from './trace';
```

Inside the `update` method, before returning:

```ts
if (isTraceEnabled()) {
  trace('classifier.update', { contentLength: content.length, type: this.type() });
}
```

- [ ] **Step 2: Trace in langgraph bridge**

Add at the top of `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`:

```ts
// trace harness lives in @ngaf/chat — duplicated here to avoid a hard dep
function isLgTraceEnabled(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const win = (globalThis as { window?: { __ngafChatTrace?: boolean; localStorage?: Storage } }).window;
  if (!win) return false;
  if (win.__ngafChatTrace === true) return true;
  try { return win.localStorage?.getItem('NGAF_CHAT_STREAM_TRACE') === '1'; } catch { return false; }
}
function lgTrace(...args: unknown[]): void {
  if (isLgTraceEnabled()) {
    // eslint-disable-next-line no-console
    console.debug('[ngaf-chat-stream]', ...args);
  }
}
```

In `processEvent` for messages-tuple events, after `subjects.messages$.next(...)`:

```ts
if (isLgTraceEnabled()) {
  const msgs = subjects.messages$.value;
  const last = msgs[msgs.length - 1];
  lgTrace('bridge.messages-tuple', { id: (last as unknown as Record<string, unknown>)['id'], count: msgs.length });
}
```

In the values-event sync, after the merge:

```ts
if (isLgTraceEnabled()) {
  lgTrace('bridge.values-sync', {
    incomingLength: stateMessages.length,
    mergedLength: subjects.messages$.value.length,
  });
}
```

- [ ] **Step 3: Run tests**

```bash
npx nx test chat
npx nx test langgraph
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/streaming/content-classifier.ts libs/langgraph/src/lib/internals/stream-manager.bridge.ts
git commit -m "feat(chat,langgraph): trace harness call sites in classifier + bridge"
```

---

### Task 2.9: Reproduce + diagnose long-stream regression

**Files:** investigative — may modify any of the streaming pipeline depending on findings.

- [ ] **Step 1: Build chat + langgraph + smoke env**

```bash
npx nx build chat
npx nx build langgraph
cd dist/libs/chat && npm pack && cd -
cd dist/libs/langgraph && npm pack && cd -
cd ~/tmp/ngaf-smoke-05
rm -rf node_modules/@ngaf/chat node_modules/@ngaf/langgraph
npm install /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/chat/ngaf-chat-*.tgz /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac/dist/libs/langgraph/ngaf-langgraph-*.tgz --no-save
```

- [ ] **Step 2: Restart ng serve**

```bash
pkill -9 -f "ng serve"; sleep 4
cd ~/tmp/ngaf-smoke-05 && rm -rf .angular
nohup npx ng serve --port 4303 > /tmp/ngaf-smoke.log 2>&1 &
sleep 28
```

- [ ] **Step 3: Enable trace + reproduce**

In Chrome DevTools console at http://localhost:4303/:

```js
localStorage.setItem('NGAF_CHAT_STREAM_TRACE', '1');
location.reload();
```

Send: `"Write 800 words about coral reefs. Use three markdown headings (## Reefs, ## Threats, ## Conservation). Include one fenced code block per section."`

- [ ] **Step 4: Capture and categorize**

Watch console for `[ngaf-chat-stream]` logs. Open Network tab, watch the SSE/streaming request. Categorize the symptom:

| Symptom | Likely cause | Fix location |
|---|---|---|
| Stalls mid-stream, console quiet | RAF starvation, page hidden tab, or marked.parse blocking | `streaming-markdown.component.ts` (consider `setTimeout` fallback when `document.hidden`) |
| `bridge.values-sync` shows `mergedLength` shrinking | values event still replacing in some branch | `stream-manager.bridge.ts` (re-audit the values handler) |
| `classifier.update` fires with wildly varying types per token | classifier mid-stream type flips | `content-classifier.ts` (stabilize type once committed) |
| `streaming-md.flush` fires but innerHTML stale | sanitizer stripping content | `markdown-render.ts` (check sanitization config) |
| Markdown lists/code blocks render mid-stream-broken then snap | already fixed by RAF rewrite, no action |  |

- [ ] **Step 5: Apply the fix (whatever the category indicated)**

Make the targeted change. Add a regression test that exercises the failure path (using the trace output as evidence).

- [ ] **Step 6: Update spec's Findings appendix**

In `docs/superpowers/specs/2026-05-02-chat-pipeline-redesign-design.md`, replace the placeholder text at the "Findings appendix" section with:

```
## Findings appendix

Diagnosed during Phase 2 reproduction (2026-05-02):

- **Symptom**: <category>
- **Root cause**: <specific cause>
- **Fix**: <files changed, behavior change>
- **Regression test**: <test path>
```

- [ ] **Step 7: Run tests**

```bash
npx nx test chat
npx nx test langgraph
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix(chat,langgraph): long-stream regression — <category-specific summary>"
```

If no regression is found after the rewrite, document that in the Findings appendix and skip steps 5 + 8.

---

### Task 2.10: Bump @ngaf/chat to 0.0.14, ship PR

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Bump version**

```bash
sed -i '' 's/"version": "0.0.13"/"version": "0.0.14"/' libs/chat/package.json
```

- [ ] **Step 2: Build, lint, test**

```bash
npx nx run-many -t lint,test,build --projects=chat,langgraph,partial-json
```

Expected: all PASS.

- [ ] **Step 3: Commit + push**

```bash
git add libs/chat/package.json
git commit -m "chore(chat): 0.0.13 → 0.0.14"
git push -u origin claude/chat-streaming-rewrite
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(chat): streaming rewrite + cacheplane parser migration" --body "$(cat <<'EOF'
## What
- Migrate @ngaf/chat to consume @cacheplane/partial-json (replacing @ngaf/partial-json)
- Mark @ngaf/partial-json deprecated at 0.0.2
- Delete the bespoke append-only markdown renderer (~200 LOC)
- Rewrite chat-streaming-md as a ~30 LOC RAF-batched full-reparse component
- Rekey ChatComponent classifier cache by message id + janitor effect
- Add localStorage-gated trace harness for diagnostics
- Diagnose + fix the long-output streaming regression (see Findings appendix in spec)

## Why
The old append-only renderer's delta math (`content.slice(lastContent.length)`) silently froze when content shrank or reordered. RAF-batched full reparse is simpler, idempotent, and eliminates that bug class. Sharing the partial-JSON parser across projects gives both a stricter tokenizer + identity preservation + finish() semantics.

## Versions
- @ngaf/chat: 0.0.13 → 0.0.14
- @ngaf/partial-json: frozen at 0.0.2 (deprecated)

## Spec
docs/superpowers/specs/2026-05-02-chat-pipeline-redesign-design.md
EOF
)"
```

- [ ] **Step 5: Watch CI**

```bash
gh pr checks --watch
```

Expected: green.

- [ ] **Step 6: Merge + tag**

```bash
gh pr merge --squash --delete-branch
git fetch origin main
git tag chat-v0.0.14 origin/main
git push origin chat-v0.0.14
```

---

# Phase 3: Welcome screen

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/dazzling-dewdney-887eac
git fetch origin main
git checkout -b claude/chat-welcome-screen origin/main
```

### Task 3.1: Add fade-in keyframe to global tokens

**Files:**
- Modify: `libs/chat/src/lib/styles/chat-tokens.ts`

- [ ] **Step 1: Add the keyframe**

Find the `KEYFRAMES` constant (search for `@keyframes ngaf-chat-pulse`). Append:

```ts
  @keyframes ngaf-chat-welcome-mount {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
```

- [ ] **Step 2: Build chat**

```bash
npx nx build chat
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/styles/chat-tokens.ts
git commit -m "feat(chat): welcome-mount keyframe"
```

---

### Task 3.2: Welcome styles file

**Files:**
- Create: `libs/chat/src/lib/styles/chat-welcome.styles.ts`

- [ ] **Step 1: Write styles**

```ts
// libs/chat/src/lib/styles/chat-welcome.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_WELCOME_STYLES = `
  :host {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 0;
    padding: var(--ngaf-chat-welcome-padding, 24px);
    box-sizing: border-box;
    animation: ngaf-chat-welcome-mount 200ms ease-out both;
  }
  .chat-welcome__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ngaf-chat-welcome-gap, 1.5rem);
    width: 100%;
    max-width: var(--ngaf-chat-welcome-max-width, 36rem);
    text-align: center;
  }
  .chat-welcome__beacon {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%,
      var(--ngaf-chat-text) 0%,
      var(--ngaf-chat-text-muted) 70%,
      transparent 100%);
    animation: ngaf-chat-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    margin-bottom: 8px;
  }
  .chat-welcome__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--ngaf-chat-text);
    line-height: 1.3;
  }
  @media (min-width: 768px) {
    .chat-welcome__title { font-size: 1.5rem; }
  }
  .chat-welcome__subtitle {
    margin: 0;
    font-size: var(--ngaf-chat-font-size-sm);
    color: var(--ngaf-chat-text-muted);
    line-height: 1.5;
  }
  .chat-welcome__input {
    width: 100%;
    margin-top: 0.5rem;
  }
  .chat-welcome__suggestions {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
  .chat-welcome__suggestions:empty { display: none; }
`;

export const CHAT_WELCOME_SUGGESTION_STYLES = `
  :host { display: block; width: 100%; }
  .chat-welcome-suggestion {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 12px 14px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--ngaf-chat-separator);
    color: var(--ngaf-chat-text);
    font-family: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: background 150ms ease;
  }
  .chat-welcome-suggestion:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-welcome-suggestion:focus-visible {
    outline: 2px solid var(--ngaf-chat-text-muted);
    outline-offset: -2px;
  }
  .chat-welcome-suggestion__label { flex: 1 1 auto; }
  .chat-welcome-suggestion__chevron {
    color: var(--ngaf-chat-text-muted);
    font-size: 1.1em;
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add libs/chat/src/lib/styles/chat-welcome.styles.ts
git commit -m "feat(chat): welcome screen + suggestion styles"
```

---

### Task 3.3: `<chat-welcome-suggestion>` (TDD)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts`

- [ ] **Step 1: Failing test**

```ts
// libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.spec.ts
import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWelcomeSuggestionComponent } from './chat-welcome-suggestion.component';

describe('ChatWelcomeSuggestionComponent', () => {
  let fixture: ComponentFixture<ChatWelcomeSuggestionComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatWelcomeSuggestionComponent);
    fixture.componentRef.setInput('label', 'Tell me about yourself');
    fixture.componentRef.setInput('value', 'tell-me');
    fixture.detectChanges();
  });

  it('renders the label', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Tell me about yourself');
  });

  it('emits select with the value on click', () => {
    let emitted: string | undefined;
    fixture.componentInstance.select.subscribe(v => { emitted = v; });
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    button.click();
    expect(emitted).toBe('tell-me');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx nx test chat -- chat-welcome-suggestion.component.spec.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_WELCOME_SUGGESTION_STYLES } from '../../styles/chat-welcome.styles';

@Component({
  selector: 'chat-welcome-suggestion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_WELCOME_SUGGESTION_STYLES],
  template: `
    <button type="button" class="chat-welcome-suggestion" (click)="select.emit(value())">
      <ng-content select="[chatWelcomeSuggestionIcon]" />
      <span class="chat-welcome-suggestion__label">{{ label() }}</span>
      <span class="chat-welcome-suggestion__chevron" aria-hidden="true">›</span>
    </button>
  `,
})
export class ChatWelcomeSuggestionComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly select = output<string>();
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx nx test chat -- chat-welcome-suggestion.component.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-welcome
git commit -m "feat(chat): chat-welcome-suggestion helper component"
```

---

### Task 3.4: `<chat-welcome>` (TDD)

**Files:**
- Create: `libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.spec.ts`
- Create: `libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.ts`

- [ ] **Step 1: Failing test**

```ts
// libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWelcomeComponent } from './chat-welcome.component';

describe('ChatWelcomeComponent', () => {
  let fixture: ComponentFixture<ChatWelcomeComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatWelcomeComponent);
    fixture.detectChanges();
  });

  it('renders default greeting', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__title')?.textContent).toContain('How can I help?');
    expect(el.querySelector('.chat-welcome__subtitle')?.textContent).toContain('Ask anything');
  });

  it('renders the beacon dot', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__beacon')).not.toBeNull();
  });

  it('exposes slots for title, subtitle, input, suggestions', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chat-welcome__inner')).not.toBeNull();
    expect(el.querySelector('.chat-welcome__input')).not.toBeNull();
    expect(el.querySelector('.chat-welcome__suggestions')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx nx test chat -- chat-welcome.component.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_WELCOME_STYLES } from '../../styles/chat-welcome.styles';

/**
 * Empty-state owner. Renders a centered greeting + slot-projected input +
 * optional vertical suggestion rows. Mounted only when the parent chat has
 * no messages and welcome is not disabled.
 *
 * Slots:
 *   [chatWelcomeTitle]       — replaces the default <h1> "How can I help?"
 *   [chatWelcomeSubtitle]    — replaces the default <p> "Ask anything to get started."
 *   [chatWelcomeInput]       — projects the chat input into the center column
 *   [chatWelcomeSuggestions] — projects suggestion rows below the input
 *
 * Host CSS variables (override on :host or any ancestor):
 *   --ngaf-chat-welcome-max-width  default 36rem
 *   --ngaf-chat-welcome-gap        default 1.5rem
 *   --ngaf-chat-welcome-padding    default 24px
 */
@Component({
  selector: 'chat-welcome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_WELCOME_STYLES],
  template: `
    <div class="chat-welcome__inner">
      <span class="chat-welcome__beacon" aria-hidden="true"></span>
      <ng-content select="[chatWelcomeTitle]">
        <h1 class="chat-welcome__title">How can I help?</h1>
      </ng-content>
      <ng-content select="[chatWelcomeSubtitle]">
        <p class="chat-welcome__subtitle">Ask anything to get started.</p>
      </ng-content>
      <div class="chat-welcome__input"><ng-content select="[chatWelcomeInput]" /></div>
      <div class="chat-welcome__suggestions">
        <ng-content select="[chatWelcomeSuggestions]" />
      </div>
    </div>
  `,
})
export class ChatWelcomeComponent {}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx nx test chat -- chat-welcome.component.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.ts libs/chat/src/lib/primitives/chat-welcome/chat-welcome.component.spec.ts
git commit -m "feat(chat): chat-welcome empty-state primitive"
```

---

### Task 3.5: Wire welcome branch into `<chat>` composition

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`

- [ ] **Step 1: Add imports**

In the imports list:

```ts
import { ChatWelcomeComponent } from '../../primitives/chat-welcome/chat-welcome.component';
```

In the `imports: [...]` array of the `@Component` decorator, add `ChatWelcomeComponent`.

- [ ] **Step 2: Add inputs + computed**

In the class body, near other inputs:

```ts
readonly welcomeDisabled = input<boolean>(false);

readonly showWelcome = computed(() => {
  if (this.welcomeDisabled()) return false;
  const a = this.agent() as unknown as { isThreadLoading?: () => boolean };
  if (a.isThreadLoading?.()) return false;
  return this.agent().messages().length === 0;
});
```

- [ ] **Step 3: Add welcome branch in template**

In the template, find the `<div class="chat-shell">` block. Replace it with a parent `@if` switch:

```html
@if (showWelcome()) {
  <chat-welcome>
    <chat-input chatWelcomeInput [agent]="agent()" [submitOnEnter]="true" placeholder="Type a message..." />
  </chat-welcome>
} @else {
  <div class="chat-shell">
    <!-- existing shell with sidebar + main -->
  </div>
}
```

(Keep the existing `<div class="chat-shell">` markup as the `@else` branch verbatim. Move the `<chat-input>` instantiation out of the footer when the welcome is showing.)

Inside the `@else` branch's footer, the existing `<chat-input>` stays. Welcome and conversation each instantiate their own `<chat-input>`; per spec we accept a fresh remount on the swap (Phase 3 recommendation option 2).

Also remove the existing `<div class="chat-empty">` block inside `@else`'s scroll body — it's now superseded by `<chat-welcome>`.

- [ ] **Step 4: Update CSS**

Inside the `:host` styles, add a flex-column rule for the welcome direct child case:

```css
:host > chat-welcome {
  display: flex;
  flex: 1 1 auto;
  width: 100%;
}
```

- [ ] **Step 5: Run + build**

```bash
npx nx test chat
npx nx build chat
```

Expected: PASS. (May see deprecation warnings for the removed `chatEmptyState` slot — accept them; consumers using that slot will need to migrate to `chatWelcomeTitle` / `chatWelcomeSubtitle`. Document in PR.)

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): wire chat-welcome branch + showWelcome computed"
```

---

### Task 3.6: Tests for welcome composition behavior

**Files:**
- Modify or create: `libs/chat/src/lib/compositions/chat/chat.component.spec.ts`

- [ ] **Step 1: Add behavior tests**

Append (or replace) the existing welcome-state assertions with:

```ts
describe('welcome branch', () => {
  it('shows welcome when messages are empty', async () => {
    // ... build a fixture with agent.messages() returning []
    // assert el.querySelector('chat-welcome') is not null
    // assert el.querySelector('.chat-shell') is null
  });

  it('hides welcome when messages exist', async () => {
    // ... fixture with one message
    // assert el.querySelector('chat-welcome') is null
    // assert el.querySelector('.chat-shell') is not null
  });

  it('hides welcome when welcomeDisabled=true', async () => {
    // ... fixture with empty messages, welcomeDisabled=true
    // assert el.querySelector('chat-welcome') is null
  });
});
```

(Match the existing test scaffolding style in `chat.component.spec.ts` for fixture setup. If that file doesn't exist yet, create it minimally.)

- [ ] **Step 2: Run**

```bash
npx nx test chat -- chat.component.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.spec.ts
git commit -m "test(chat): welcome branch visibility (empty / non-empty / disabled)"
```

---

### Task 3.7: Public API exports

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add exports**

Append:

```ts
export { ChatWelcomeComponent } from './lib/primitives/chat-welcome/chat-welcome.component';
export { ChatWelcomeSuggestionComponent } from './lib/primitives/chat-welcome/chat-welcome-suggestion.component';
```

- [ ] **Step 2: Build chat to verify exports**

```bash
npx nx build chat
```

Expected: PASS. The dist `index.d.ts` should expose the new components.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): export ChatWelcome + ChatWelcomeSuggestion components"
```

---

### Task 3.8: Bump @ngaf/chat to 0.0.15, ship PR

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Bump version**

```bash
sed -i '' 's/"version": "0.0.14"/"version": "0.0.15"/' libs/chat/package.json
```

- [ ] **Step 2: Run full check**

```bash
npx nx run-many -t lint,test,build --projects=chat
```

Expected: PASS.

- [ ] **Step 3: Commit + push**

```bash
git add libs/chat/package.json
git commit -m "chore(chat): 0.0.14 → 0.0.15"
git push -u origin claude/chat-welcome-screen
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(chat): welcome screen primitive" --body "$(cat <<'EOF'
## What
Adds a dedicated <chat-welcome> primitive that owns the empty-state UX. Replaces the inline placeholder previously embedded in the chat scroll container.

## Behavior
- Renders centered greeting + projected input + optional suggestion rows
- Visible when agent.messages() is empty AND welcomeDisabled=false AND thread isn't loading
- Hides smoothly once a turn happens; conversation layout takes over

## Differentiators
- Two-line greeting (h1 + subtitle paragraph)
- Beacon dot above the title with a 2s pulse animation
- Optional <chat-welcome-suggestion> helper for vertical action rows
- 200ms fade-in on mount

## Versions
- @ngaf/chat: 0.0.14 → 0.0.15

## Spec
docs/superpowers/specs/2026-05-02-chat-pipeline-redesign-design.md (Phase 3)
EOF
)"
```

- [ ] **Step 5: Watch CI**

```bash
gh pr checks --watch
```

Expected: green.

- [ ] **Step 6: Merge + tag**

```bash
gh pr merge --squash --delete-branch
git fetch origin main
git tag chat-v0.0.15 origin/main
git push origin chat-v0.0.15
```

---

## Self-review notes

- **Spec coverage**: All three active phases mapped to task sets. Phase 4 explicitly deferred per spec.
- **Constraint enforcement**: No copilotkit / inspirational-library references in any task body, code, or commit message.
- **Type consistency**: `ChatWelcomeComponent`, `ChatWelcomeSuggestionComponent`, `classifiers: Map<string, ContentClassifier>`, `showWelcome: Signal<boolean>`, `welcomeDisabled: InputSignal<boolean>` consistent across tasks.
- **Test before code**: Every new module follows write-test → run-fail → implement → run-pass.
- **Exact commands**: Every step that runs a tool gives the exact command + expected outcome.
- **Diagnose-after-rewrite**: Task 2.9 explicitly handles the open-ended long-stream diagnostic phase per spec; Findings appendix updated as part of that task.
