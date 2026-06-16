# @threadplane/middleware/langgraph (JS package) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents follow superpowers:test-driven-development for each function.

**Goal:** Build `@threadplane/middleware` (npm), imported as `@threadplane/middleware/langgraph` — the TypeScript/LangGraph.js twin of the Python `threadplane-middleware`, so a LangGraph.js backend supports the `@threadplane/chat` client-tools capability.

**Architecture:** Plan B of the two-plan split. A new Nx library `libs/middleware` built with `@nx/js:tsc` and tested with `@nx/vitest:test`, mirroring `libs/telemetry`. The public surface is the single subpath export `./langgraph`. It 1:1-mirrors the Python module's seven functions plus two idiomatic LangGraph.js extras (an `Annotation` channel fragment and a conditional-edge factory). `@langchain/core` + `@langchain/langgraph` are peer dependencies. Verification = vitest units (mirroring the Python suite) + an in-process real-`StateGraph` integration test + a TS demo server at `examples/ag-ui/node` live-smoked through the existing `examples/ag-ui/angular` itinerary frontend. Publishes on its own cadence via a staged `workflow_dispatch` npm workflow — NOT in the Angular `publishable` lockstep group.

**Tech Stack:** TypeScript 5.9 (`@nx/js:tsc`), vitest 4 (`@nx/vitest:test`), `@langchain/core` ^1.1.33 (already in repo), `@langchain/langgraph`, `@ag-ui/langgraph` (^0.0.41, demo only), Nx 22.6, GitHub Actions, npm trusted publishing.

---

## Spec & reference

- Spec: `docs/superpowers/specs/2026-06-15-threadplane-middleware-langgraph-js-design.md` (sections "JS API surface", "Idiomatic LangGraph.js extras", "Verification ladder", "npm publishing").
- **Behavior reference — the Python source this mirrors** (`packages/threadplane-middleware/src/threadplane/middleware/langgraph/middleware.py`). The seven functions and their exact semantics (catalog read with `tools`→`client_tools` fallback; OpenAI function wrapping; the server-vs-client precedence rule) are the contract. Every TS function below has its Python counterpart cited.
- **Build/test pattern reference:** `libs/telemetry/{project.json,package.json,tsconfig.json,tsconfig.lib.json,tsconfig.spec.json,vite.config.mts}` — copy this structure.

## File map

```
libs/middleware/
  package.json            # @threadplane/middleware, type:module, exports ./langgraph, peerDeps
  project.json            # @nx/js:tsc build:node + @nx/vitest:test + @nx/eslint:lint
  tsconfig.json           # extends ../../tsconfig.base.json
  tsconfig.lib.json       # declaration:true, emitDeclarationOnly:false, include src/langgraph
  tsconfig.spec.json      # types: vitest/globals + node
  vite.config.mts         # @nx/vitest, environment node, globals true
  eslint.config.mjs       # extends root (copy libs/telemetry/eslint.config.mjs)
  README.md
  src/
    langgraph/
      index.ts            # re-exports the public surface
      types.ts            # ClientToolSpec, ClientToolsState, OpenAIFunctionTool
      middleware.ts       # clientToolSpecs, clientToolNames, lastMessage, hasClientToolCall,
                          #   hasServerToolCall, bindClientTools, routeAfterAgent
      channel.ts          # clientToolsChannel()
      router.ts           # clientToolsRouter()
    langgraph.spec.ts     # unit tests (mirror Python test_middleware.py)
    integration.spec.ts   # in-process real StateGraph + fake chat model
examples/ag-ui/node/      # demo server (Task 10)
.github/workflows/publish-middleware-npm.yml   # staged npm publish (Task 12)
```

## Root dependency additions (done in Task 1)

- `package.json` root `devDependencies`: `@langchain/langgraph` (integration test + peer-satisfaction), `@ag-ui/langgraph` (^0.0.41, demo server). `@langchain/core` is already present (^1.1.33).
- `libs/middleware/package.json` `peerDependencies`: `@langchain/core`, `@langchain/langgraph`.

> **Lockfile caution (known issue):** installing on macOS can drop the Linux `@next/swc-*` optional-dep entries from `package-lock.json`, breaking CI. Task 1 verifies the lockfile diff and restores any dropped platform bindings surgically. Do NOT blindly regenerate the lockfile.

---

## Task 0: Branch

- [ ] **Step 1: Create the branch from latest main**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/quirky-haslett-d443a4
git fetch origin
git checkout -b claude/middleware-js origin/main
```

---

## Task 1: Scaffold `libs/middleware` + dependencies

**Files:** create the whole `libs/middleware/` config skeleton (no source logic yet — that's TDD'd in later tasks). Modify root `package.json` + `package-lock.json`.

- [ ] **Step 1: Create the package manifest**

`libs/middleware/package.json`:
```json
{
  "name": "@threadplane/middleware",
  "version": "0.0.1",
  "description": "Backend middleware for the Threadplane client-tools capability. The /langgraph entrypoint targets LangGraph.js.",
  "keywords": ["langgraph", "agent", "client-tools", "middleware", "threadplane"],
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "https://github.com/cacheplane/angular-agent-framework.git",
    "directory": "libs/middleware"
  },
  "homepage": "https://github.com/cacheplane/angular-agent-framework#readme",
  "bugs": { "url": "https://github.com/cacheplane/angular-agent-framework/issues" },
  "exports": {
    "./langgraph": {
      "types": "./langgraph/index.d.ts",
      "default": "./langgraph/index.js"
    },
    "./README.md": "./README.md"
  },
  "peerDependencies": {
    "@langchain/core": "^1.0.0",
    "@langchain/langgraph": "^1.0.0 || ^0.4.0 || ^0.3.0"
  }
}
```
> The `exports` paths are relative to the published package root (`dist/libs/middleware`), where `@nx/js:tsc` emits `langgraph/index.js` + `langgraph/index.d.ts`. Confirm the exact `@langchain/langgraph` version range in Step 6 against what actually installs, and tighten the peer range to match (the `||` list is a starting guess).

- [ ] **Step 2: Create the Nx project.json (mirror libs/telemetry's build:node)**

`libs/middleware/project.json`:
```json
{
  "name": "middleware",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/middleware/src",
  "projectType": "library",
  "tags": ["type:lib", "scope:library", "scope:shared"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/libs/middleware"],
      "options": {
        "outputPath": "dist/libs/middleware",
        "main": "libs/middleware/src/langgraph/index.ts",
        "tsConfig": "libs/middleware/tsconfig.lib.json",
        "assets": ["libs/middleware/README.md", "libs/middleware/package.json"]
      }
    },
    "test": {
      "executor": "@nx/vitest:test",
      "options": { "configFile": "libs/middleware/vite.config.mts" }
    },
    "lint": { "executor": "@nx/eslint:lint" }
  }
}
```
> `main` points at `src/langgraph/index.ts`; `@nx/js:tsc` emits to `dist/libs/middleware/langgraph/index.js` preserving the `langgraph/` directory (because `rootDir` is `src`). Verify the emitted path in Step 7 and adjust `exports` if tsc flattens it.

- [ ] **Step 3: Create the tsconfigs (copy libs/telemetry, adjust includes)**

`libs/middleware/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "lib": ["es2022"]
  },
  "include": []
}
```

`libs/middleware/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "rootDir": "src",
    "declaration": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/langgraph/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`libs/middleware/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "declaration": false,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.ts"]
}
```

- [ ] **Step 4: Create the vitest + eslint configs**

`libs/middleware/vite.config.mts`:
```ts
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

`libs/middleware/eslint.config.mjs`: copy `libs/telemetry/eslint.config.mjs` verbatim (it extends the root flat config and sets the project boundary; no per-lib edits needed). Read that file and reproduce it.

- [ ] **Step 5: Create a placeholder README + an empty index so the project resolves**

`libs/middleware/README.md`:
```markdown
# @threadplane/middleware

Backend middleware for the Threadplane client-tools capability.

## `@threadplane/middleware/langgraph`

LangGraph.js helpers that bind frontend-declared client tools onto the model and route
client-tool-only turns to `END` so the browser executes them. See the
[client-tools guide](https://github.com/cacheplane/angular-agent-framework).
```

`libs/middleware/src/langgraph/index.ts` (temporary — replaced as functions land):
```ts
// SPDX-License-Identifier: MIT
export {};
```

- [ ] **Step 6: Add the dependencies (carefully)**

Add `@langchain/langgraph` and `@ag-ui/langgraph` to the ROOT `package.json` `devDependencies` (alphabetically, next to the existing `@langchain/core`). Then install:
```bash
npm install
```
Immediately check the lockfile did NOT drop Linux platform bindings:
```bash
git diff package-lock.json | grep -E "^-.*swc-linux|^-.*@next/swc" || echo "ok: no linux bindings dropped"
```
If that prints removed lines (`-` entries for `@next/swc-linux-*`), restore them: `git checkout package-lock.json`, then re-add ONLY the two new deps by hand-editing `package.json` and running `npm install --package-lock-only` — re-check until the grep prints `ok`. (Known macOS issue: a full install can strip Linux optional deps that CI's `npm ci` needs.)

- [ ] **Step 7: Verify the project is recognized and builds empty**

```bash
npx nx show project middleware --json | head -c 200; echo
npx nx build middleware
```
Expected: `nx show project` prints the project graph entry; `nx build` succeeds and emits `dist/libs/middleware/langgraph/index.js` + `dist/libs/middleware/package.json`. Confirm the emitted path:
```bash
ls dist/libs/middleware/langgraph/index.js dist/libs/middleware/package.json
```
If tsc emitted to a different path (e.g. flattened to `dist/libs/middleware/index.js`), fix `rootDir`/`main` and the package.json `exports` to match, and rebuild.

- [ ] **Step 8: Commit**

```bash
git add libs/middleware package.json package-lock.json
git commit -m "feat(middleware): scaffold libs/middleware (@threadplane/middleware) Nx tsc/vitest package"
```

---

## Task 2: types + `clientToolSpecs` + `clientToolNames` (TDD)

**Mirrors Python** `_catalog`, `client_tool_specs`, `client_tool_names`.

**Files:** Create `src/langgraph/types.ts`, `src/langgraph/middleware.ts`, `src/langgraph.spec.ts`.

- [ ] **Step 1: Write the failing tests**

`libs/middleware/src/langgraph.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { clientToolSpecs, clientToolNames } from './langgraph/middleware';

const WEATHER = { name: 'get_weather', description: 'Weather', parameters: { type: 'object' } };

describe('clientToolSpecs', () => {
  it('wraps each catalog entry as an OpenAI function tool', () => {
    expect(clientToolSpecs({ messages: [], tools: [WEATHER] })).toEqual([
      { type: 'function', function: { name: 'get_weather', description: 'Weather', parameters: { type: 'object' } } },
    ]);
  });
  it('falls back to client_tools when tools is absent', () => {
    expect(clientToolSpecs({ messages: [], client_tools: [WEATHER] })).toHaveLength(1);
  });
  it('defaults missing description/parameters and drops nameless entries', () => {
    const specs = clientToolSpecs({ messages: [], tools: [{ name: 'x' } as never, { description: 'no name' } as never] });
    expect(specs).toEqual([{ type: 'function', function: { name: 'x', description: '', parameters: {} } }]);
  });
  it('returns [] for empty state', () => {
    expect(clientToolSpecs({ messages: [] })).toEqual([]);
  });
});

describe('clientToolNames', () => {
  it('returns the set of catalog names', () => {
    expect(clientToolNames({ messages: [], tools: [WEATHER] })).toEqual(new Set(['get_weather']));
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npx nx test middleware
```
Expected: FAIL (`clientToolSpecs is not a function` / cannot find module).

- [ ] **Step 3: Implement types + the two functions**

`libs/middleware/src/langgraph/types.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { BaseMessage } from '@langchain/core/messages';

/** A frontend-declared client tool: name + description + JSON-Schema parameters. */
export interface ClientToolSpec {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/** The explicit OpenAI function-tool shape accepted by ChatModel.bindTools across versions. */
export interface OpenAIFunctionTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** The slice of graph state this middleware reads. */
export interface ClientToolsState {
  messages: BaseMessage[];
  /** Primary channel — AG-UI/LangGraph merges RunAgentInput.tools here. */
  tools?: ClientToolSpec[];
  /** Fallback channel — the raw run input key. */
  client_tools?: ClientToolSpec[];
}

export type { BaseMessage };
```

`libs/middleware/src/langgraph/middleware.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { ClientToolSpec, ClientToolsState, OpenAIFunctionTool } from './types';

/** Read the catalog from state.tools, falling back to state.client_tools; drop nameless. */
function catalog(state: ClientToolsState): ClientToolSpec[] {
  const raw = state.tools && state.tools.length > 0 ? state.tools : state.client_tools;
  return (raw ?? []).filter((t): t is ClientToolSpec => !!t && typeof t === 'object' && !!t.name);
}

/** The client catalog as OpenAI function-tool dicts for `model.bindTools`. */
export function clientToolSpecs(state: ClientToolsState): OpenAIFunctionTool[] {
  return catalog(state).map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description ?? '', parameters: t.parameters ?? {} },
  }));
}

/** The set of tool names declared by the client in this run. */
export function clientToolNames(state: ClientToolsState): Set<string> {
  return new Set(catalog(state).map((t) => t.name));
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx nx test middleware
```
Expected: PASS (all clientToolSpecs/clientToolNames tests green).

- [ ] **Step 5: Commit**

```bash
git add libs/middleware/src
git commit -m "feat(middleware): clientToolSpecs + clientToolNames (mirror python catalog)"
```

---

## Task 3: `lastMessage` + `hasClientToolCall` + `hasServerToolCall` (TDD)

**Mirrors Python** `_tool_calls`, `_call_name`, `last_message`, `has_client_tool_call`, `has_server_tool_call`.

**Files:** append to `src/langgraph.spec.ts` and `src/langgraph/middleware.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `libs/middleware/src/langgraph.spec.ts`:
```ts
import { lastMessage, hasClientToolCall, hasServerToolCall } from './langgraph/middleware';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

const stateWith = (toolCalls: { name: string }[]) => ({
  messages: [new HumanMessage('hi'), new AIMessage({ content: '', tool_calls: toolCalls.map((c) => ({ name: c.name, args: {}, id: c.name })) })],
  tools: [{ name: 'get_weather', description: '', parameters: {} }],
});

describe('lastMessage', () => {
  it('returns the last message or undefined', () => {
    expect(lastMessage({ messages: [] })).toBeUndefined();
    expect(lastMessage({ messages: [new HumanMessage('a'), new HumanMessage('b')] })?.content).toBe('b');
  });
});

describe('hasClientToolCall', () => {
  it('true when the last AI message calls a client tool', () => {
    expect(hasClientToolCall(stateWith([{ name: 'get_weather' }]))).toBe(true);
  });
  it('false when the last AI message calls only non-client tools', () => {
    expect(hasClientToolCall(stateWith([{ name: 'search' }]))).toBe(false);
  });
  it('false when there are no tool calls', () => {
    expect(hasClientToolCall(stateWith([]))).toBe(false);
  });
});

describe('hasServerToolCall', () => {
  it('true when a call name is in serverToolNames', () => {
    expect(hasServerToolCall(stateWith([{ name: 'search' }]), ['search'])).toBe(true);
  });
  it('true when a call name is unknown (not a client tool)', () => {
    expect(hasServerToolCall(stateWith([{ name: 'mystery' }]), [])).toBe(true);
  });
  it('false when the only call is a known client tool', () => {
    expect(hasServerToolCall(stateWith([{ name: 'get_weather' }]), [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx nx test middleware
```
Expected: FAIL (`lastMessage`/`hasClientToolCall`/`hasServerToolCall` not exported).

- [ ] **Step 3: Implement**

Append to `libs/middleware/src/langgraph/middleware.ts`:
```ts
import type { BaseMessage } from './types';

interface ToolCallLike {
  name?: string;
  function?: { name?: string };
}

function toolCalls(message: unknown): ToolCallLike[] {
  const tc = (message as { tool_calls?: unknown } | null)?.tool_calls;
  return Array.isArray(tc) ? (tc as ToolCallLike[]) : [];
}

function callName(call: ToolCallLike): string | undefined {
  return call.name ?? call.function?.name;
}

/** The last message from state.messages, or undefined. */
export function lastMessage(state: ClientToolsState): BaseMessage | undefined {
  const msgs = state.messages ?? [];
  return msgs.length ? msgs[msgs.length - 1] : undefined;
}

/** True if the last message calls at least one client tool. */
export function hasClientToolCall(state: ClientToolsState): boolean {
  const names = clientToolNames(state);
  return toolCalls(lastMessage(state)).some((c) => {
    const n = callName(c);
    return n !== undefined && names.has(n);
  });
}

/**
 * True if the last message calls at least one server (non-client) tool.
 * A call is server-side when its name is in serverToolNames OR is not a known
 * client tool (unknown tools are assumed server-side).
 */
export function hasServerToolCall(state: ClientToolsState, serverToolNames: Iterable<string>): boolean {
  const server = new Set(serverToolNames);
  const client = clientToolNames(state);
  return toolCalls(lastMessage(state)).some((c) => {
    const n = callName(c);
    return n !== undefined && (server.has(n) || !client.has(n));
  });
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx nx test middleware
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/middleware/src
git commit -m "feat(middleware): lastMessage + client/server tool-call predicates"
```

---

## Task 4: `bindClientTools` + `routeAfterAgent` + index export (TDD)

**Mirrors Python** `bind_client_tools`, `route_after_agent`.

**Files:** append to spec + middleware.ts; write `src/langgraph/index.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `libs/middleware/src/langgraph.spec.ts`:
```ts
import { bindClientTools, routeAfterAgent } from './langgraph/middleware';

describe('bindClientTools', () => {
  it('binds server tools then client stubs (server first), calling bindTools once', () => {
    const calls: unknown[][] = [];
    const fake = { bindTools: (tools: unknown[]) => { calls.push(tools); return 'BOUND'; } };
    const SERVER = { name: 'search' };
    const result = bindClientTools(fake as never, [SERVER as never], { messages: [], tools: [{ name: 'get_weather', description: '', parameters: {} }] });
    expect(result).toBe('BOUND');
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(SERVER); // server tool first
    expect((calls[0][1] as { function: { name: string } }).function.name).toBe('get_weather'); // client stub follows
  });
  it('binds only server tools when there is no client catalog', () => {
    let bound: unknown[] = [];
    const fake = { bindTools: (tools: unknown[]) => { bound = tools; return fake; } };
    bindClientTools(fake as never, [{ name: 'search' } as never], { messages: [] });
    expect(bound).toHaveLength(1);
  });
});

describe('routeAfterAgent', () => {
  const st = (names: string[]) => ({
    messages: [new AIMessage({ content: '', tool_calls: names.map((n) => ({ name: n, args: {}, id: n })) })],
    tools: [{ name: 'get_weather', description: '', parameters: {} }],
  });
  it('routes a server tool call to the tools node', () => {
    expect(routeAfterAgent(st(['search']), ['search'])).toBe('tools');
  });
  it('routes a client-only tool call to END', () => {
    expect(routeAfterAgent(st(['get_weather']), [])).toBe('__end__');
  });
  it('routes no tool calls to END', () => {
    expect(routeAfterAgent(st([]), [])).toBe('__end__');
  });
  it('routes a mixed call to the server (precedence)', () => {
    expect(routeAfterAgent(st(['get_weather', 'search']), ['search'])).toBe('tools');
  });
  it('honors custom node names', () => {
    expect(routeAfterAgent(st(['search']), ['search'], { toolsNode: 'act' })).toBe('act');
    expect(routeAfterAgent(st([]), [], { end: 'DONE' })).toBe('DONE');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx nx test middleware
```
Expected: FAIL.

- [ ] **Step 3: Implement bindClientTools + routeAfterAgent**

Append to `libs/middleware/src/langgraph/middleware.ts`:
```ts
/** A chat model that can bind tools (the LangChain `Runnable.bindTools` surface). */
export interface BindableModel {
  bindTools(tools: unknown[], kwargs?: unknown): unknown;
}

/**
 * Bind server tools + the client catalog stubs onto `llm`. Call this INSIDE the
 * agent node (per-run) — the client catalog arrives in state and may differ per run.
 */
export function bindClientTools<M extends BindableModel>(
  llm: M,
  serverTools: unknown[],
  state: ClientToolsState,
): ReturnType<M['bindTools']> {
  return llm.bindTools([...serverTools, ...clientToolSpecs(state)]) as ReturnType<M['bindTools']>;
}

/**
 * Routing helper for a LangGraph conditional edge. Returns `toolsNode` when the last
 * message has a server tool call (dispatch to the server ToolNode); otherwise `end`
 * (client-only calls — the browser executes them — and no-tool-call turns both end).
 */
export function routeAfterAgent(
  state: ClientToolsState,
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): string {
  const toolsNode = opts?.toolsNode ?? 'tools';
  const end = opts?.end ?? '__end__';
  return hasServerToolCall(state, serverToolNames) ? toolsNode : end;
}
```

- [ ] **Step 4: Write the public index surface**

Replace `libs/middleware/src/langgraph/index.ts`:
```ts
// SPDX-License-Identifier: MIT
export type { ClientToolSpec, ClientToolsState, OpenAIFunctionTool, BaseMessage } from './types';
export {
  clientToolSpecs,
  clientToolNames,
  lastMessage,
  hasClientToolCall,
  hasServerToolCall,
  bindClientTools,
  routeAfterAgent,
  type BindableModel,
} from './middleware';
// extras added in Tasks 5-6:
export { clientToolsChannel } from './channel';
export { clientToolsRouter } from './router';
```
> NOTE: this imports `./channel` and `./router`, which don't exist until Tasks 5–6. To keep the tree compiling NOW, temporarily comment out the last two `export` lines, and uncomment them in Task 6 Step 4. (Mark this in the commit message.)

- [ ] **Step 5: Run tests + typecheck-build**

```bash
npx nx test middleware && npx nx build middleware
```
Expected: tests PASS; build succeeds (with the two extra exports temporarily commented).

- [ ] **Step 6: Commit**

```bash
git add libs/middleware/src
git commit -m "feat(middleware): bindClientTools + routeAfterAgent + public index (extras pending)"
```

---

## Task 5: `clientToolsChannel` Annotation fragment (TDD)

**Files:** `src/langgraph/channel.ts`; append to spec.

- [ ] **Step 1: Write the failing test**

Append to `libs/middleware/src/langgraph.spec.ts`:
```ts
import { clientToolsChannel } from './langgraph/channel';
import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

describe('clientToolsChannel', () => {
  it('produces tools + client_tools channels usable in Annotation.Root', () => {
    const frag = clientToolsChannel();
    expect(Object.keys(frag).sort()).toEqual(['client_tools', 'tools']);
    // The fragment composes into a state annotation without throwing.
    const State = Annotation.Root({ ...MessagesAnnotation.spec, ...frag });
    expect(State.spec).toHaveProperty('tools');
    expect(State.spec).toHaveProperty('client_tools');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx nx test middleware
```
Expected: FAIL (cannot find `./langgraph/channel`).

- [ ] **Step 3: Implement**

`libs/middleware/src/langgraph/channel.ts`:
```ts
// SPDX-License-Identifier: MIT
import { Annotation } from '@langchain/langgraph';
import type { ClientToolSpec } from './types';

/**
 * State channels for the client-tools catalog. Spread into Annotation.Root so a graph
 * declares the `tools` (primary) and `client_tools` (fallback) slices in one line:
 *
 *   const State = Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() });
 *
 * Both are last-value-wins channels (the catalog is replaced per run, not accumulated).
 */
export function clientToolsChannel() {
  return {
    tools: Annotation<ClientToolSpec[] | undefined>(),
    client_tools: Annotation<ClientToolSpec[] | undefined>(),
  };
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx nx test middleware
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/middleware/src
git commit -m "feat(middleware): clientToolsChannel Annotation fragment"
```

---

## Task 6: `clientToolsRouter` factory (TDD) + enable extras export

**Files:** `src/langgraph/router.ts`; append to spec; uncomment index exports.

- [ ] **Step 1: Write the failing test**

Append to `libs/middleware/src/langgraph.spec.ts`:
```ts
import { clientToolsRouter } from './langgraph/router';

describe('clientToolsRouter', () => {
  const st = (names: string[]) => ({
    messages: [new AIMessage({ content: '', tool_calls: names.map((n) => ({ name: n, args: {}, id: n })) })],
    tools: [{ name: 'get_weather', description: '', parameters: {} }],
  });
  it('returns a callback that routes via routeAfterAgent with bound serverToolNames', () => {
    const route = clientToolsRouter(['search']);
    expect(route(st(['search']))).toBe('tools');
    expect(route(st(['get_weather']))).toBe('__end__');
  });
  it('honors custom node names', () => {
    const route = clientToolsRouter([], { end: 'DONE' });
    expect(route(st([]))).toBe('DONE');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx nx test middleware
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`libs/middleware/src/langgraph/router.ts`:
```ts
// SPDX-License-Identifier: MIT
import { routeAfterAgent } from './middleware';
import type { ClientToolsState } from './types';

/**
 * A prebuilt conditional-edge callback. serverToolNames is bound once at construction;
 * the returned function takes only state.
 *
 *   graph.addConditionalEdges('agent', clientToolsRouter([]), ['tools', END]);
 */
export function clientToolsRouter(
  serverToolNames: Iterable<string>,
  opts?: { toolsNode?: string; end?: string },
): (state: ClientToolsState) => string {
  const names = [...serverToolNames];
  return (state: ClientToolsState) => routeAfterAgent(state, names, opts);
}
```

- [ ] **Step 4: Enable the extras exports in index.ts**

Uncomment the two `export` lines for `./channel` and `./router` in `libs/middleware/src/langgraph/index.ts` (added in Task 4 Step 4).

- [ ] **Step 5: Run tests + build**

```bash
npx nx test middleware && npx nx lint middleware && npx nx build middleware
```
Expected: all tests PASS, lint clean, build emits `dist/libs/middleware/langgraph/{index,middleware,channel,router,types}.{js,d.ts}`.

- [ ] **Step 6: Commit**

```bash
git add libs/middleware/src
git commit -m "feat(middleware): clientToolsRouter factory + enable extras export"
```

---

## Task 7: In-process StateGraph integration test

Proves the full loop with a real LangGraph.js graph + a scripted fake chat model: bind → client-only tool call → route to END → caller appends ToolMessage → re-invoke → final content.

**Files:** `libs/middleware/src/integration.spec.ts`.

- [ ] **Step 1: Write the integration test**

`libs/middleware/src/integration.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { Annotation, MessagesAnnotation, StateGraph, END } from '@langchain/langgraph';
import { AIMessage, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { bindClientTools, clientToolsChannel, clientToolsRouter } from './langgraph';

// A scripted fake chat model exposing the bindTools + invoke surface the graph uses.
class FakeModel {
  bound: unknown[] = [];
  private turn = 0;
  bindTools(tools: unknown[]) { this.bound = tools; return this; }
  async invoke(messages: unknown[]) {
    this.turn += 1;
    if (this.turn === 1) {
      // First turn: call the client tool get_weather.
      return new AIMessage({ content: '', tool_calls: [{ name: 'get_weather', args: { city: 'SF' }, id: 'call_1' }] });
    }
    // Second turn (after the ToolMessage): summarize.
    return new AIMessage({ content: 'It is 65F in SF.' });
  }
}

const State = Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() });

function buildGraph(model: FakeModel) {
  const agent = async (state: typeof State.State) => {
    const bound = bindClientTools(model, [], state);
    const res = await (bound as FakeModel).invoke(state.messages);
    return { messages: [res] };
  };
  return new StateGraph(State)
    .addNode('agent', agent)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', clientToolsRouter([]), ['tools' as never, END])
    .compile();
}

describe('client-tools loop (in-process)', () => {
  it('binds the client stub, ends on the client call, then continues after a ToolMessage', async () => {
    const model = new FakeModel();
    const graph = buildGraph(model);
    const tools = [{ name: 'get_weather', description: 'Weather', parameters: { type: 'object' } }];

    // Run 1: the model calls the client tool; the graph ends (browser would execute it).
    const r1 = await graph.invoke({ messages: [new HumanMessage('weather in SF?')], tools });
    const last1 = r1.messages[r1.messages.length - 1] as AIMessage;
    expect(last1.tool_calls?.[0]?.name).toBe('get_weather');
    // The client stub was bound onto the model.
    expect((model.bound[0] as { function: { name: string } }).function.name).toBe('get_weather');

    // Run 2: the frontend re-submits with the executed ToolMessage; the model summarizes.
    const r2 = await graph.invoke({
      messages: [...r1.messages, new ToolMessage({ content: '65F', tool_call_id: 'call_1' })],
      tools,
    });
    expect((r2.messages[r2.messages.length - 1] as AIMessage).content).toBe('It is 65F in SF.');
  });
});
```

- [ ] **Step 2: Run — verify pass**

```bash
npx nx test middleware
```
Expected: PASS (the integration test plus all units). If the LangGraph `addConditionalEdges` path-array typing rejects `'tools'` since no `tools` node exists, change the mapping to `[END]` and route only to END (there are no server tools in this test) — keep the assertion on the two-run loop.

- [ ] **Step 3: Commit**

```bash
git add libs/middleware/src/integration.spec.ts
git commit -m "test(middleware): in-process StateGraph client-tools loop integration"
```

---

## Task 8: README + final package verification

- [ ] **Step 1: Flesh out the README with a usage example**

Replace `libs/middleware/README.md` with install + a minimal graph example using `clientToolsChannel`, `bindClientTools`, and `clientToolsRouter` (mirror the structure of `packages/threadplane-middleware/README.md` but in TypeScript). Include the `@threadplane/middleware/langgraph` import path and the peer-dependency note (`@langchain/core`, `@langchain/langgraph`).

- [ ] **Step 2: Full verification**

```bash
npx nx lint middleware && npx nx test middleware && npx nx build middleware
node -e "const p=require('./dist/libs/middleware/package.json'); console.log(p.name, p.version, JSON.stringify(p.exports['./langgraph']))"
ls dist/libs/middleware/langgraph/index.d.ts
```
Expected: lint clean, all tests pass, build green, the printed package.json has the `./langgraph` export, and the `.d.ts` exists.

- [ ] **Step 3: Commit**

```bash
git add libs/middleware/README.md
git commit -m "docs(middleware): README usage example"
```

---

## Task 9: Open PR for the JS package (core)

- [ ] **Step 1: Push + PR**

```bash
git push -u origin claude/middleware-js
gh pr create --base main --head claude/middleware-js \
  --title "feat(middleware): @threadplane/middleware/langgraph — LangGraph.js client-tools middleware" \
  --body "Plan B core: new Nx lib \`libs/middleware\` (npm \`@threadplane/middleware\`, import \`@threadplane/middleware/langgraph\`), the TS twin of \`threadplane-middleware\`. 1:1 mirror of the 7 Python functions + clientToolsChannel/clientToolsRouter extras. Vitest units (mirror the Python suite) + in-process StateGraph integration test. Built with @nx/js:tsc, excluded from the Angular publishable lockstep group.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --squash --auto claude/middleware-js
```
> The demo server (Task 10) and npm publish workflow (Task 12) can ship in this same PR or a follow-up — see notes. If splitting, open them as a second PR off the merged main.

---

## Task 10: Demo server `examples/ag-ui/node` (live-smoke harness)

A minimal LangGraph.js + `@ag-ui/langgraph` server exposing `/agent`, used to live-smoke the middleware behind the existing Angular itinerary demo.

**Files:** `examples/ag-ui/node/{package.json,tsconfig.json,src/graph.ts,src/server.ts,README.md}` (+ Nx `project.json` with a `serve` run-commands target if the repo's example-serving harness requires it — check `examples/ag-ui/python`'s nx wiring and mirror the registration).

- [ ] **Step 1: Survey the existing examples/ag-ui wiring**

Read `examples/ag-ui/python/src/{graph.py,server.py}` and `examples/ag-ui/angular/proxy.conf*.json` (or the dev-server proxy config) to learn the exact `/agent` contract, port, and how the Angular dev proxy targets the backend. Note the port the Angular app proxies `/agent` to.

- [ ] **Step 2: Implement the graph**

`examples/ag-ui/node/src/graph.ts` — a `StateGraph` using `Annotation.Root({ ...MessagesAnnotation.spec, ...clientToolsChannel() })`, an `agent` node that does `bindClientTools(new ChatOpenAI({ model: 'gpt-4o-mini', streaming: true }), [], state)` then `await bound.invoke([system, ...state.messages])`, and `addConditionalEdges('agent', clientToolsRouter([]), [END])`. Compile WITHOUT a checkpointer (the AG-UI server manages threads). Import the middleware from `@threadplane/middleware/langgraph`.

- [ ] **Step 3: Implement the server**

`examples/ag-ui/node/src/server.ts` — stand up the `@ag-ui/langgraph` agent over the compiled graph and serve `/agent` on the SAME port the Angular dev proxy expects (from Step 1). Read OPENAI_API_KEY from env.

- [ ] **Step 4: Register + typecheck**

Add `examples/ag-ui/node/package.json` + `tsconfig.json` (mirror an existing TS example if one exists; else a minimal `tsc --noEmit` typecheck). Ensure `npx tsc -p examples/ag-ui/node/tsconfig.json --noEmit` is clean.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/node
git commit -m "feat(examples/ag-ui): node (LangGraph.js) backend using @threadplane/middleware/langgraph"
```

---

## Task 11: Live-LLM smoke (manual gate — per the standing rule)

Not a CI test — the standing live-LLM-before-merge gate.

- [ ] **Step 1: Serve the node backend + the existing Angular itinerary demo**

Start `examples/ag-ui/node` with a real `OPENAI_API_KEY` (from repo-root `.env`) on the port the Angular proxy targets, and serve `examples/ag-ui/angular` pointed at it (the dev proxy already routes `/agent`; no frontend change). Free conflicting ports first; do NOT run the e2e suite against the same ports simultaneously.

- [ ] **Step 2: Drive the three behaviors in Chrome**

Confirm against the real model: an `action` client tool (e.g. add_stop) mutates the panel and the run continues after the ToolMessage; a `view` renders; an `ask` resolves and freezes. Capture a screenshot. If a streaming-shape bug appears (the class the reducer fix addressed), fix before merge.

- [ ] **Step 3: Record the smoke result in the PR**

Comment the outcome (+ screenshot) on the PR. This task has no commit.

---

## Task 12: Staged npm publish workflow

**Files:** `.github/workflows/publish-middleware-npm.yml`.

- [ ] **Step 1: Author the workflow (mirror publish-middleware-python.yml structure)**

`workflow_dispatch` only, `dry_run` input default `true`; `permissions: id-token: write` (trusted publishing + provenance); Node 24 + npm 11+; steps: checkout → setup-node (registry npmjs) → `npm ci` → `npm i -g npm@latest` → `npx nx build middleware` → publish. Real publish: `npm publish dist/libs/middleware --provenance --access public`; dry-run: add `--dry-run`. Include the header comment documenting the first-publish bootstrap (a maintainer's local `npm publish` with a token creates the package; subsequent releases use OIDC) and the trusted-publisher setup note for npm.

- [ ] **Step 2: Validate the workflow YAML**

```bash
npx tsx -e "1" 2>/dev/null; python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-middleware-npm.yml')); print('yaml ok')"
```
Expected: `yaml ok`.

- [ ] **Step 3: Commit (+ include in the PR)**

```bash
git add .github/workflows/publish-middleware-npm.yml
git commit -m "ci(middleware): staged npm publish workflow (workflow_dispatch, dry-run default)"
git push
```

---

## Out-of-band (maintainer keystrokes, after merge)

1. Bootstrap the first npm publish of `@threadplane/middleware@0.0.1` (local `npm publish` with a token creates the package; configure the npm trusted publisher for `publish-middleware-npm.yml`; thereafter dispatch the workflow).
2. Nothing couples this to the Python `threadplane-middleware` publish — they are independent.

---

## Self-review notes

- **Spec coverage:** layout `libs/middleware` (Task 1), 1:1 mirror of all 7 Python functions (Tasks 2–4), both extras `clientToolsChannel`/`clientToolsRouter` (Tasks 5–6), peer deps + no runtime deps (Task 1), in-process integration (Task 7), demo server at `examples/ag-ui/node` + reused frontend smoke (Tasks 10–11), staged npm workflow excluded from the lockstep group (Task 12). The `serverToolNames` parameter threads through `hasServerToolCall`/`routeAfterAgent`/`clientToolsRouter` consistently (matches the corrected spec).
- **Placeholders:** the only deferred specifics are (a) the exact `@langchain/langgraph` peer version range — pinned against the actual install in Task 1 Step 6; (b) the demo server's port/proxy contract — read from the existing `examples/ag-ui/python` wiring in Task 10 Step 1; (c) the emitted dist path — verified in Task 1 Step 7. Each is an explicit verify-and-adjust step, not a vague instruction.
- **Type consistency:** `ClientToolSpec`/`ClientToolsState`/`OpenAIFunctionTool`/`BindableModel` defined in Task 2, reused unchanged in Tasks 3–7. Function names match the spec exactly.
- **Risk — Annotation/StateGraph API drift:** the integration test (Task 7) exercises the real API; Step 2 includes a fallback if `addConditionalEdges` path typing rejects a non-existent `tools` node.
