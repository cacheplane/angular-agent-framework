# AG-UI Interrupt Support + Cockpit `ag-ui` Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `interrupt` support to `@threadplane/ag-ui`, register a navigable `ag-ui` cockpit section after `langgraph`, ship a standalone `ag-ui/interrupts` example (AG-UI-fronted LangGraph), refactor `ag-ui/streaming` to a real backend, all validated by deterministic CI e2e.

**Architecture:** The adapter bridges the AG-UI `CUSTOM`/`on_interrupt` event into `Agent.interrupt` and resumes via `runAgent({ forwardedProps: { command: { resume } } })`. Each cockpit example is fully standalone: its own duplicated LangGraph graph served by a uvicorn `ag-ui-langgraph` FastAPI app. E2E uses a new AG-UI-specific harness setup that points the graph's `ChatOpenAI` at an `aimock` replay server seeded from recorded fixtures.

**Tech Stack:** Angular 20/21, TypeScript, RxJS, `@ag-ui/client`; Python LangGraph + `ag-ui-langgraph` + FastAPI/uvicorn; Nx; Playwright + `@copilotkit/aimock`.

**Spec:** `docs/superpowers/specs/2026-05-29-ag-ui-interrupts-cockpit-section-design.md`

---

## Conventions for this plan

- **"Duplicate"** means `cp` the named template file(s) verbatim, then apply the listed edits. The template files are the source of truth for boilerplate (tsconfig, index.html, main.ts, styles.css, package.json, etc.) — copy them rather than hand-writing.
- Run all commands from the repo root: `/Users/blove/repos/angular-agent-framework/.claude/worktrees/interesting-mccarthy-5d4ea0`.
- Do NOT push. Commit after each task.
- The reference example to mirror everywhere is `cockpit/langgraph/interrupts` (and `cockpit/langgraph/streaming` for the streaming refactor).

---

## File Structure

**Library (novel code):**
- Modify `libs/ag-ui/src/lib/reducer.ts` — `interrupt` in `ReducerStore`, `on_interrupt` handler, clear on `RUN_STARTED`.
- Modify `libs/ag-ui/src/lib/to-agent.ts` — expose `interrupt`, resume path in `submit`.
- Modify/add specs `libs/ag-ui/src/lib/reducer.spec.ts`, `to-agent.spec.ts`.
- Add `libs/e2e-harness/src/ag-ui-global-setup-factory.ts` + export in `index.ts`.
- Modify `libs/cockpit-registry/src/lib/manifest.types.ts`, `manifest.ts` (+ spec/validate).
- Modify `cockpit/ports.mjs`.

**Examples (mostly duplicated):**
- New tree `cockpit/ag-ui/interrupts/{python,angular}/…`.
- Refactor `cockpit/ag-ui/streaming/{angular}` + new `cockpit/ag-ui/streaming/python/…`.

**CI:** Modify `.github/workflows/ci.yml` (`cockpit-smoke` list).

---

## Task 1: Adapter — bridge `on_interrupt` in the reducer

**Files:**
- Modify: `libs/ag-ui/src/lib/reducer.ts`
- Test: `libs/ag-ui/src/lib/reducer.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `libs/ag-ui/src/lib/reducer.spec.ts` (mirror the existing store-construction helper in that file; if a `makeStore()` helper exists, reuse it — otherwise build a store with `signal(...)` for each field including the new `interrupt`):

```ts
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { reduceEvent, type ReducerStore } from './reducer';

function makeStore(): ReducerStore {
  return {
    messages: signal([]), status: signal('idle'), isLoading: signal(false),
    error: signal(null), toolCalls: signal([]), state: signal({}),
    interrupt: signal(undefined), events$: new Subject(),
  };
}

describe('reduceEvent — interrupt', () => {
  it('sets interrupt from a CUSTOM on_interrupt event', () => {
    const store = makeStore();
    reduceEvent({ type: 'CUSTOM', name: 'on_interrupt', value: { kind: 'refund_approval', amount: 42 } } as never, store);
    const ix = store.interrupt();
    expect(ix).toBeTruthy();
    expect(ix!.value).toEqual({ kind: 'refund_approval', amount: 42 });
    expect(ix!.resumable).toBe(true);
    expect(typeof ix!.id).toBe('string');
  });

  it('clears interrupt on RUN_STARTED', () => {
    const store = makeStore();
    store.interrupt.set({ id: 'x', value: {}, resumable: true });
    reduceEvent({ type: 'RUN_STARTED' } as never, store);
    expect(store.interrupt()).toBeUndefined();
  });

  it('still forwards non-interrupt CUSTOM events to events$', () => {
    const store = makeStore();
    const seen: unknown[] = [];
    store.events$.subscribe((e) => seen.push(e));
    reduceEvent({ type: 'CUSTOM', name: 'state_update', value: { a: 1 } } as never, store);
    expect(seen).toEqual([{ type: 'state_update', data: { a: 1 } }]);
    expect(store.interrupt()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx nx test ag-ui --test-file=reducer.spec.ts` (or `npx nx test ag-ui`)
Expected: FAIL — `interrupt` is not on `ReducerStore` (type error) / interrupt stays undefined.

- [ ] **Step 3: Implement**

In `libs/ag-ui/src/lib/reducer.ts`:

1. Add the import and a local id helper near the top:
```ts
import type { Message, AgentStatus, ToolCall, AgentEvent, AgentInterrupt } from '@threadplane/chat';
// ...
function randomId(): string {
  return Math.random().toString(36).slice(2);
}
```
2. Add `interrupt` to `ReducerStore`:
```ts
export interface ReducerStore {
  messages:  WritableSignal<Message[]>;
  status:    WritableSignal<AgentStatus>;
  isLoading: WritableSignal<boolean>;
  error:     WritableSignal<unknown>;
  toolCalls: WritableSignal<ToolCall[]>;
  state:     WritableSignal<Record<string, unknown>>;
  interrupt: WritableSignal<AgentInterrupt | undefined>;
  events$:   Subject<AgentEvent>;
}
```
3. In `case 'RUN_STARTED':`, add `store.interrupt.set(undefined);` alongside the existing sets.
4. Replace the `case 'CUSTOM':` body so `on_interrupt` is handled first:
```ts
case 'CUSTOM': {
  const e = event as unknown as { name: string; value: unknown };
  if (e.name === 'on_interrupt') {
    store.interrupt.set({ id: randomId(), value: e.value, resumable: true });
    return;
  }
  if (e.name === 'state_update' && isRecord(e.value)) {
    store.events$.next({ type: 'state_update', data: e.value });
  } else {
    store.events$.next({ type: 'custom', name: e.name, data: e.value });
  }
  return;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test ag-ui`
Expected: PASS (all reducer specs, including the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/reducer.ts libs/ag-ui/src/lib/reducer.spec.ts
git commit -m "feat(ag-ui): bridge on_interrupt CUSTOM event into reducer interrupt signal"
```

---

## Task 2: Adapter — expose `interrupt` + resume in `to-agent.ts`

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts`
- Test: `libs/ag-ui/src/lib/to-agent.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to `libs/ag-ui/src/lib/to-agent.spec.ts` (mirror the file's existing fake `AbstractAgent` test double; it should record `runAgent` calls). Add a fake that captures the `runAgent` argument:

```ts
it('exposes an interrupt signal that reflects on_interrupt events', () => {
  const { agent, emit } = makeAgentUnderTest(); // helper that returns toAgent(fakeSource) + a way to push events through subscribe()
  emit({ type: 'CUSTOM', name: 'on_interrupt', value: { kind: 'refund_approval' } });
  expect(agent.interrupt!()).toMatchObject({ value: { kind: 'refund_approval' }, resumable: true });
});

it('submit({ resume }) calls runAgent with forwardedProps.command.resume and does not append a message', async () => {
  const { agent, source } = makeAgentUnderTest();
  const before = agent.messages().length;
  await agent.submit({ resume: { approved: true } });
  expect(source.runAgentArg).toEqual({ forwardedProps: { command: { resume: { approved: true } } } });
  expect(agent.messages().length).toBe(before); // no optimistic user message
  expect(agent.interrupt!()).toBeUndefined();   // cleared on resume
});

it('submit({ message }) still appends a user message (unchanged)', async () => {
  const { agent, source } = makeAgentUnderTest();
  await agent.submit({ message: 'hi' });
  expect(agent.messages().some((m) => m.role === 'user' && m.content === 'hi')).toBe(true);
  expect(source.runAgentArg).toBeUndefined(); // message path calls runAgent() with no args
});
```

If `to-agent.spec.ts` lacks a `makeAgentUnderTest`/fake-source helper, add one: a minimal object implementing the `AbstractAgent` surface `to-agent.ts` uses (`subscribe`, `addMessage`, `setMessages`, `runAgent`, `abortRun`), capturing the `runAgent` arg into `runAgentArg`, and exposing an `emit(event)` that invokes the registered `onEvent({ event })`.

- [ ] **Step 2: Run tests, verify fail**

Run: `npx nx test ag-ui`
Expected: FAIL — `agent.interrupt` undefined; resume path appends a message / calls `runAgent()` with no args.

- [ ] **Step 3: Implement**

In `libs/ag-ui/src/lib/to-agent.ts`:
1. Import the type: add `AgentInterrupt` to the existing `@threadplane/chat` import.
2. Add to the `store` object: `interrupt: signal<AgentInterrupt | undefined>(undefined),`.
3. Add to the returned `Agent` object: `interrupt: store.interrupt,` (place beside `state: store.state,`).
4. Change `submit` to handle resume first:
```ts
submit: async (input: AgentSubmitInput, _opts?: AgentSubmitOptions) => {
  if (input.resume !== undefined) {
    store.interrupt.set(undefined);
    const run = startRunTelemetry('resume');
    try {
      await source.runAgent({ forwardedProps: { command: { resume: input.resume } } });
      finishRunTelemetry(run);
    } catch (err) {
      store.status.set('error');
      store.isLoading.set(false);
      store.error.set(err);
      failRunTelemetry(err, run);
    }
    return;
  }
  // ── existing message path unchanged below ──
  const userMsg = buildUserMessage(input);
  // ...rest as-is...
},
```
   (If `source.runAgent`'s typed signature rejects the argument, cast: `await (source.runAgent as (p?: unknown) => Promise<void>)({ forwardedProps: { command: { resume: input.resume } } });` — `@ag-ui/client`'s `runAgent` accepts `RunAgentParameters` incl. `forwardedProps`; verify and prefer the typed call.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npx nx test ag-ui && npx nx build ag-ui`
Expected: PASS; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/to-agent.spec.ts
git commit -m "feat(ag-ui): expose interrupt signal + submit({ resume }) resume path"
```

---

## Task 3: Register `ag-ui` in the cockpit manifest

**Files:**
- Modify: `libs/cockpit-registry/src/lib/manifest.types.ts`
- Modify: `libs/cockpit-registry/src/lib/manifest.ts`
- Modify (if assertions exist): `libs/cockpit-registry/src/lib/manifest.spec.ts`, `validate-manifest.spec.ts`

- [ ] **Step 1: Read the current structures**

Read `manifest.types.ts` and `manifest.ts` fully. Note the `CockpitProduct` union and the exact shape/order of `APPROVED_TOPICS` (keyed by product → section → topic[]). The `langgraph` entry is your template.

- [ ] **Step 2: Add a failing manifest test**

In `manifest.spec.ts`, add:
```ts
it('includes ag-ui after langgraph with streaming + interrupts topics', () => {
  const products = cockpitManifest.map((e) => e.product);
  expect(products).toContain('ag-ui');
  expect(products.indexOf('ag-ui')).toBeGreaterThan(products.indexOf('langgraph'));
  const aguiTopics = cockpitManifest.filter((e) => e.product === 'ag-ui').map((e) => e.topic);
  expect(aguiTopics).toEqual(expect.arrayContaining(['streaming', 'interrupts']));
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx nx test cockpit-registry`
Expected: FAIL (`'ag-ui'` not a `CockpitProduct`; not in manifest).

- [ ] **Step 4: Implement**

1. `manifest.types.ts`: add `'ag-ui'` to the union:
   `export type CockpitProduct = 'deep-agents' | 'langgraph' | 'ag-ui' | 'render' | 'chat';`
2. `manifest.ts`: insert an `'ag-ui'` key into `APPROVED_TOPICS` **immediately after the `langgraph` key**, mirroring langgraph's structure, e.g.:
   ```ts
   'ag-ui': {
     'core-capabilities': ['streaming', 'interrupts'],
   },
   ```
   (Match the exact section key langgraph uses — if langgraph uses `'core-capabilities'`, use that. If the value shape carries per-topic metadata objects rather than bare strings, mirror that shape for `streaming` and `interrupts`.)
3. If `validate-manifest.ts` enforces that every manifest topic has a corresponding on-disk example path, ensure the `ag-ui`/`streaming` and `ag-ui`/`interrupts` paths it expects will exist (they will after Tasks 6–11); if validation runs against disk at test time and those dirs don't exist yet, gate this task's validation accordingly or land it after the example dirs exist. (Prefer: keep manifest edit here; if `validate-manifest.spec.ts` fails purely due to missing dirs, note it and let Task 12's final verification confirm green once examples exist.)

- [ ] **Step 5: Run, verify pass**

Run: `npx nx test cockpit-registry`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/cockpit-registry/src/lib/manifest.types.ts libs/cockpit-registry/src/lib/manifest.ts libs/cockpit-registry/src/lib/manifest.spec.ts
git commit -m "feat(cockpit-registry): register ag-ui section (streaming, interrupts) after langgraph"
```

---

## Task 4: Allocate ports for the two ag-ui examples

**Files:**
- Modify: `cockpit/ports.mjs`
- Verify: `scripts/cockpit-ports.spec.mjs`

- [ ] **Step 1: Read `cockpit/ports.mjs` fully** (the `PORTS` object + the header comment about the ag-ui streaming exception + the convention).

- [ ] **Step 2: Implement**

1. Add two entries to `PORTS` (keep alphabetical grouping consistent with neighbors):
   ```js
   'cockpit-ag-ui-interrupts-angular': { angular: 4320, langgraph: 5320 },
   'cockpit-ag-ui-streaming-angular':  { angular: 4321, langgraph: 5321 },
   ```
   (The `langgraph` slot is the backend/uvicorn port for ag-ui examples.)
2. Update the header comment: remove the "Excludes cockpit-ag-ui-streaming-angular … Node ag-ui server on :3000" exception note; replace with a note that ag-ui examples run a uvicorn `ag-ui-langgraph` backend on the `langgraph` port and proxy `/agent` to it.

   If `4320/5320/4321/5321` collide with any existing entry, pick the next free pair in the same decade and use those numbers consistently in Tasks 6–11 (python `--port`, proxy target, playwright baseURL).

- [ ] **Step 3: Verify**

Run: `node --test scripts/cockpit-ports.spec.mjs` (or the repo's command for it; check `scripts/` / `package.json`). At this point the verifier may require the python project.json `--port` and playwright `baseURL` to exist — those land in Tasks 6–11. If the verifier asserts against not-yet-created files, this is expected; the authoritative green run is Task 12. Confirm at minimum the file parses and the two entries are present:
```bash
node -e "import('./cockpit/ports.mjs').then(m => { const p = m.PORTS; if (!p['cockpit-ag-ui-interrupts-angular'] || !p['cockpit-ag-ui-streaming-angular']) throw new Error('missing'); console.log('ok'); })"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add cockpit/ports.mjs
git commit -m "feat(cockpit): allocate ports for ag-ui interrupts + streaming examples"
```

---

## Task 5: AG-UI-specific e2e global-setup factory

**Files:**
- Create: `libs/e2e-harness/src/ag-ui-global-setup-factory.ts`
- Modify: `libs/e2e-harness/src/index.ts` (export it)

- [ ] **Step 1: Implement the factory**

Model it on `libs/e2e-harness/src/global-setup-factory.ts` (read that file first). Create `ag-ui-global-setup-factory.ts`:

```ts
// SPDX-License-Identifier: MIT
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { startAimock, type AimockHandle } from './aimock-runner';

export interface CreateAgUiGlobalSetupOpts {
  /** Repo-relative path to the python ag-ui-langgraph project (contains src/server.py). */
  pythonCwd: string;
  /** Port the uvicorn AG-UI server binds. */
  backendPort: number;
  /** Nx project name of the Angular dev server. */
  angularProject: string;
  /** Port the Angular dev server should bind. */
  angularPort: number;
  /** Absolute path to the per-example fixtures dir. */
  fixturesDir: string;
  /** Default 90_000. */
  backendReadyTimeoutMs?: number;
  /** Default 120_000. */
  angularReadyTimeoutMs?: number;
}

interface SharedState {
  aimock: AimockHandle;
  backend: ChildProcess;
  backendPort: number;
  angular: ChildProcess;
  angularPort: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __AIMOCK_HARNESS_STATE__: Map<string, SharedState> | undefined;
}

async function waitForPort(url: string, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch { /* not up yet */ }
    await delay(500);
  }
  throw new Error(`[${label}] not ready at ${url} within ${timeoutMs}ms`);
}

function repoRoot(fixturesDir: string): string {
  let dir = fixturesDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'cockpit'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root not found from fixturesDir: ' + fixturesDir);
}

export function createAgUiGlobalSetup(opts: CreateAgUiGlobalSetupOpts): () => Promise<void> {
  const backendTimeout = opts.backendReadyTimeoutMs ?? 90_000;
  const angularTimeout = opts.angularReadyTimeoutMs ?? 120_000;

  return async function globalSetup(): Promise<void> {
    const root = repoRoot(opts.fixturesDir);
    const aimock = await startAimock({ mode: 'replay', fixturePath: opts.fixturesDir });
    console.log(`[ag-ui-harness] aimock listening at ${aimock.baseUrl}`);

    const backend = spawn(
      'uv',
      ['run', 'uvicorn', 'src.server:app', '--port', String(opts.backendPort)],
      {
        cwd: resolve(root, opts.pythonCwd),
        env: { ...process.env, OPENAI_BASE_URL: aimock.baseUrl, OPENAI_API_KEY: 'test-not-used' },
        stdio: 'pipe',
        detached: true,
      },
    );
    backend.stdout?.on('data', (b) => process.stdout.write(`[ag-ui-backend] ${b}`));
    backend.stderr?.on('data', (b) => process.stderr.write(`[ag-ui-backend] ${b}`));

    await waitForPort(`http://localhost:${opts.backendPort}/ok`, backendTimeout, 'ag-ui-backend');
    console.log(`[ag-ui-harness] backend ready on :${opts.backendPort}`);

    const angular = spawn(
      'npx',
      ['nx', 'serve', opts.angularProject, '--port', String(opts.angularPort)],
      { cwd: root, env: { ...process.env }, stdio: 'pipe', detached: true },
    );
    angular.stdout?.on('data', (b) => process.stdout.write(`[angular] ${b}`));
    angular.stderr?.on('data', (b) => process.stderr.write(`[angular] ${b}`));

    await waitForPort(`http://localhost:${opts.angularPort}/`, angularTimeout, 'angular');
    console.log(`[ag-ui-harness] angular ready on :${opts.angularPort} (${opts.angularProject})`);

    if (!globalThis.__AIMOCK_HARNESS_STATE__) globalThis.__AIMOCK_HARNESS_STATE__ = new Map();
    globalThis.__AIMOCK_HARNESS_STATE__.set(opts.angularProject, {
      aimock, backend, backendPort: opts.backendPort, angular, angularPort: opts.angularPort,
    });
  };
}
```

Confirm the existing `global-teardown.ts` reads `__AIMOCK_HARNESS_STATE__` generically (it kills `langgraph`/`backend` + `angular` + stops aimock). If it references a `.langgraph` field by name, update it to also handle a `.backend` field (or rename consistently). Keep the langgraph path working.

- [ ] **Step 2: Export**

In `libs/e2e-harness/src/index.ts`, add: `export { createAgUiGlobalSetup } from './ag-ui-global-setup-factory';` (and its opts type).

- [ ] **Step 3: Typecheck / build**

Run: `npx nx build e2e-harness` (or `npx nx typecheck e2e-harness` if defined)
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add libs/e2e-harness/src/ag-ui-global-setup-factory.ts libs/e2e-harness/src/index.ts libs/e2e-harness/src/global-teardown.ts
git commit -m "feat(e2e-harness): add createAgUiGlobalSetup for uvicorn ag-ui backends"
```

---

## Task 6: `cockpit/ag-ui/interrupts/python` (standalone backend)

**Files (create):** `cockpit/ag-ui/interrupts/python/{src/graph.py, src/server.py, src/index.ts, pyproject.toml, requirements.txt, project.json, tsconfig.json, docs/guide.md, prompts/interrupts.md, .gitignore}`

- [ ] **Step 1: Duplicate the graph**

`cp cockpit/langgraph/interrupts/python/src/graph.py cockpit/ag-ui/interrupts/python/src/graph.py`. Keep it as-is (it raises `interrupt({ "kind": "refund_approval", ... })`). Ensure it exports a compiled `graph` (it does, per `langgraph.json` `./src/graph.py:graph`).

- [ ] **Step 2: Add `src/server.py`** (uvicorn + ag-ui-langgraph FastAPI app + health route)

```python
# SPDX-License-Identifier: MIT
from fastapi import FastAPI
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint
from .graph import graph

agent = LangGraphAgent(name="interrupts", graph=graph)

app = FastAPI(title="cockpit-ag-ui-interrupts")
add_langgraph_fastapi_endpoint(app, agent, path="/agent")

@app.get("/ok")
def ok() -> dict:
    return {"ok": True}
```
**Verify the `ag-ui-langgraph` public API** against the installed package (`uv run python -c "import ag_ui_langgraph; print(dir(ag_ui_langgraph))"`). If `LangGraphAgent`/`add_langgraph_fastapi_endpoint` names differ in the pinned version, adjust to the documented constructor/endpoint helper. The contract that must hold: a FastAPI `app` serving the AG-UI protocol at `/agent` plus a `GET /ok` returning 200.

- [ ] **Step 3: Add `pyproject.toml` + `requirements.txt`**

Duplicate `cockpit/langgraph/interrupts/python/pyproject.toml` and edit: project name → `cockpit-ag-ui-interrupts`; dependencies → add `ag-ui-langgraph`, `fastapi`, `uvicorn[standard]`, keep `langgraph`, `langchain-openai`, `pydantic`. Pin versions consistent with the repo's other python examples where overlapping. Create `requirements.txt` mirroring the resolved deps (for deploy parity, like `cockpit/langgraph/streaming/python/requirements.txt`). Generate `uv.lock` via `uv lock` in that dir.

- [ ] **Step 4: Add `src/index.ts` capability descriptor**

Duplicate `cockpit/langgraph/interrupts/python/src/index.ts` → edit to:
```ts
export const agUiInterruptsPythonModule: CockpitCapabilityModule = {
  id: 'ag-ui-interrupts-python',
  manifestIdentity: { product: 'ag-ui', section: 'core-capabilities', topic: 'interrupts', page: 'overview', language: 'python' },
  title: 'AG-UI Interrupts (Python)',
  docsPath: '/docs/ag-ui/core-capabilities/interrupts/overview/python',
  promptAssetPaths: ['cockpit/ag-ui/interrupts/python/prompts/interrupts.md'],
  codeAssetPaths: [
    'cockpit/ag-ui/interrupts/angular/src/app/interrupts.component.ts',
    'cockpit/ag-ui/interrupts/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: ['cockpit/ag-ui/interrupts/python/src/graph.py', 'cockpit/ag-ui/interrupts/python/src/server.py'],
  docsAssetPaths: ['cockpit/ag-ui/interrupts/python/docs/guide.md'],
  runtimeUrl: 'ag-ui/interrupts',
  devPort: 4320,
};
```
Change the `manifestIdentity.product` type literal to `'ag-ui'` in the interface copy. Keep the exported `CockpitCapabilityModule` interface in-file as the langgraph version does.

- [ ] **Step 5: Add `project.json`**

Duplicate `cockpit/langgraph/interrupts/python/project.json` → edit: `name` → `cockpit-ag-ui-interrupts-python`; all paths → `cockpit/ag-ui/interrupts/python`; `smoke` command imports `agUiInterruptsPythonModule` and asserts `id === 'ag-ui-interrupts-python'` and `title === 'AG-UI Interrupts (Python)'`. Add a `serve` target:
```json
"serve": {
  "executor": "nx:run-commands",
  "options": {
    "cwd": "cockpit/ag-ui/interrupts/python",
    "command": "uv run uvicorn src.server:app --port 5320"
  }
}
```
Keep tags `["scope:cockpit-e2e", "scope:cockpit-examples", "scope:cockpit-smoke"]`.

- [ ] **Step 6: Add docs/prompts/tsconfig/.gitignore**

`cp` `tsconfig.json` and `.gitignore` from the langgraph interrupts python dir (edit paths if any). Duplicate `docs/guide.md` and `prompts/interrupts.md`, adjusting prose to say "AG-UI adapter" / `provideAgent({ url })` from `@threadplane/ag-ui`.

- [ ] **Step 7: Verify smoke + lock**

Run:
```bash
npx nx smoke cockpit-ag-ui-interrupts-python
cd cockpit/ag-ui/interrupts/python && uv lock && uv run python -c "from src.server import app; print('app ok')" ; cd -
```
Expected: smoke passes; `app ok` prints (resolves ag-ui-langgraph + graph imports).

- [ ] **Step 8: Commit**

```bash
git add cockpit/ag-ui/interrupts/python
git commit -m "feat(cockpit): ag-ui/interrupts python backend (ag-ui-langgraph over refund graph)"
```

---

## Task 7: `cockpit/ag-ui/interrupts/angular` (standalone app)

**Files (create):** the full angular tree, duplicated from `cockpit/langgraph/interrupts/angular`.

- [ ] **Step 1: Duplicate the angular app**

```bash
cp -R cockpit/langgraph/interrupts/angular cockpit/ag-ui/interrupts/angular
rm -rf cockpit/ag-ui/interrupts/angular/e2e   # e2e is rebuilt in Task 8
```

- [ ] **Step 2: Swap the adapter wiring**

- `src/app/app.config.ts`: replace the langgraph provider with:
  ```ts
  import { ApplicationConfig } from '@angular/core';
  import { provideAgent } from '@threadplane/ag-ui';
  import { provideChat } from '@threadplane/chat';

  export const appConfig: ApplicationConfig = {
    providers: [
      provideAgent({ url: '/agent' }),
      provideChat({}),
    ],
  };
  ```
- `src/app/interrupts.component.ts`: change the import `from '@threadplane/langgraph'` → `from '@threadplane/ag-ui'` (it uses `injectAgent()`). Everything else (the `<chat-approval-card matchKind="refund_approval">` template, `onAction`, `submitEdit`) stays identical. This sameness is the validation.

- [ ] **Step 3: Proxy + environments**

- Replace `proxy.conf.mjs` content to proxy `/agent` (the ag-ui endpoint), not `/api`:
  ```js
  import { portsFor } from '../../../../cockpit/ports.mjs';
  const { langgraph: backend } = portsFor('cockpit-ag-ui-interrupts-angular');
  export default {
    '/agent': { target: `http://localhost:${backend}`, secure: false, changeOrigin: true, ws: true },
  };
  ```
- `src/environments/environment.ts` + `environment.development.ts`: remove `langGraphApiUrl`/`assistantId` fields; keep whatever the component/app.config references (app.config uses the literal `/agent`, so envs can be minimal — match the shape the langgraph example used but drop assistant fields).

- [ ] **Step 4: Capability descriptor + project name**

- `src/index.ts`: edit the `CockpitCapabilityModule` to `id: 'ag-ui-interrupts-angular'`, `manifestIdentity.product: 'ag-ui'`, `language: 'angular'`, `title: 'AG-UI Interrupts (Angular)'`, `docsPath: '/docs/ag-ui/core-capabilities/interrupts/overview/angular'`, and asset paths under `cockpit/ag-ui/interrupts/...`.
- `project.json`: `name` → `cockpit-ag-ui-interrupts-angular`; update ALL paths to `cockpit/ag-ui/interrupts/angular`; keep `build` (with its `cockpit` configuration), `serve` (proxyConfig → the new `proxy.conf.mjs`), `smoke`, and `e2e` targets; keep tags. Confirm `src/main.cockpit.ts` was copied (it should be — it existed in the langgraph example).
- `package.json`, `tsconfig.json`, `tsconfig.app.json`, `vercel.json`, `src/index.html`, `src/styles.css`, `src/main.ts`: keep copied; fix any embedded project-name/path strings.

- [ ] **Step 5: Verify build (both default + cockpit configs)**

Run:
```bash
npx nx build cockpit-ag-ui-interrupts-angular
npx nx build cockpit-ag-ui-interrupts-angular --configuration=cockpit
```
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add cockpit/ag-ui/interrupts/angular
git commit -m "feat(cockpit): ag-ui/interrupts angular app (provideAgent + approval card, runtime-neutral parity)"
```

---

## Task 8: `cockpit/ag-ui/interrupts` e2e (recorder + fixtures + spec)

**Files (create):** `cockpit/ag-ui/interrupts/angular/e2e/{global-setup-impl.ts, playwright.config.ts, interrupts.spec.ts, tsconfig.json, manual/interrupts.manual.ts, fixtures/interrupts.json}`

- [ ] **Step 1: Duplicate e2e scaffolding + repoint**

Duplicate the four scaffolding files from `cockpit/langgraph/interrupts/angular/e2e/` (`playwright.config.ts`, `tsconfig.json`, `manual/interrupts.manual.ts`, and the spec). Then:
- `playwright.config.ts`: change `portsFor('cockpit-langgraph-interrupts-angular')` → `portsFor('cockpit-ag-ui-interrupts-angular')`. Keep `globalSetup: './global-setup-impl.ts'` and the shared `globalTeardown`.
- `global-setup-impl.ts`: use the new factory:
  ```ts
  import { resolve } from 'node:path';
  import { portsFor } from '../../../../../cockpit/ports.mjs';
  import { createAgUiGlobalSetup } from '@threadplane-internal/e2e-harness';
  const ports = portsFor('cockpit-ag-ui-interrupts-angular');
  export default createAgUiGlobalSetup({
    pythonCwd: 'cockpit/ag-ui/interrupts/python',
    backendPort: ports.langgraph,
    angularProject: 'cockpit-ag-ui-interrupts-angular',
    angularPort: ports.angular,
    fixturesDir: resolve(__dirname, 'fixtures'),
  });
  ```

- [ ] **Step 2: Adapt the spec**

Duplicate `cockpit/langgraph/interrupts/angular/e2e/interrupts.spec.ts`. It is UI-level (clicks a suggestion, asserts the approval card dialog appears, approves) and should work unchanged against the ag-ui backend because the UX is identical. Adjust only the trigger text/selectors if the duplicated component's welcome suggestions differ.

- [ ] **Step 3: Record fixtures**

Run the manual recorder against a live model to capture the LLM exchanges (refund extraction call) into `fixtures/interrupts.json`. Use the langgraph manual harness as the template for record mode:
```bash
# with a real OPENAI_API_KEY exported:
npx tsx cockpit/ag-ui/interrupts/angular/e2e/manual/interrupts.manual.ts   # writes/append fixtures
```
(Mirror exactly how `cockpit/langgraph/interrupts/angular/e2e/manual/interrupts.manual.ts` records into `fixtures/interrupts.json` — same fixture entry shape consumed by `@copilotkit/aimock`.) Commit the resulting `fixtures/interrupts.json`.

- [ ] **Step 4: Run e2e (replay)**

Run: `npx nx e2e cockpit-ag-ui-interrupts-angular`
Expected: PASS — approval card appears with the refund payload; approve resumes and the run completes. (Harness starts aimock + uvicorn `/ok` + angular.)

- [ ] **Step 5: Commit**

```bash
git add cockpit/ag-ui/interrupts/angular/e2e
git commit -m "test(cockpit): ag-ui/interrupts e2e with recorded aimock fixtures"
```

---

## Task 9: `cockpit/ag-ui/streaming/python` (standalone backend)

**Files (create):** same set as Task 6, under `cockpit/ag-ui/streaming/python`.

- [ ] **Step 1: Duplicate + adapt the streaming graph**

`cp cockpit/langgraph/streaming/python/src/graph.py cockpit/ag-ui/streaming/python/src/graph.py`. Keep it minimal (single streaming chat node using `ChatOpenAI`). Ensure it exports a compiled `graph`.

- [ ] **Step 2: `src/server.py`** — identical to Task 6 Step 2 but `LangGraphAgent(name="streaming", graph=graph)` and `title="cockpit-ag-ui-streaming"`.

- [ ] **Step 3: pyproject/requirements/uv.lock/tsconfig/.gitignore/docs/prompts** — duplicate from Task 6's python dir (or the langgraph streaming python dir), edit names/paths to `streaming`.

- [ ] **Step 4: `src/index.ts`** — `id: 'ag-ui-streaming-python'`, `topic: 'streaming'`, `title: 'AG-UI Streaming (Python)'`, `docsPath: '/docs/ag-ui/core-capabilities/streaming/overview/python'`, asset paths under `cockpit/ag-ui/streaming`, `devPort: 4321`.

- [ ] **Step 5: `project.json`** — `name: cockpit-ag-ui-streaming-python`; `serve` runs `uv run uvicorn src.server:app --port 5321`; smoke asserts the streaming module shape; tags incl. `scope:cockpit-smoke`.

- [ ] **Step 6: Verify**

```bash
npx nx smoke cockpit-ag-ui-streaming-python
cd cockpit/ag-ui/streaming/python && uv lock && uv run python -c "from src.server import app; print('app ok')"; cd -
```
Expected: smoke passes; `app ok`.

- [ ] **Step 7: Commit**

```bash
git add cockpit/ag-ui/streaming/python
git commit -m "feat(cockpit): ag-ui/streaming python backend (ag-ui-langgraph)"
```

---

## Task 10: Refactor `cockpit/ag-ui/streaming/angular` to the real backend + full pattern

**Files:** modify the existing `cockpit/ag-ui/streaming/angular/*`.

- [ ] **Step 1: Swap backend wiring**

- `src/app/app.config.ts`: replace `provideFakeAgent({ tokens, delayMs })` with:
  ```ts
  import { provideAgent } from '@threadplane/ag-ui';
  import { provideChat } from '@threadplane/chat';
  export const appConfig: ApplicationConfig = {
    providers: [ provideAgent({ url: '/agent' }), provideChat({}) ],
  };
  ```
- `src/app/streaming.component.ts`: ensure it uses `injectAgent()` from `@threadplane/ag-ui` and `<chat [agent]="agent" />` (adjust if it currently inlines fake content).

- [ ] **Step 2: Proxy + cockpit embedding parity**

- Delete `proxy.conf.json`; add `proxy.conf.mjs`:
  ```js
  import { portsFor } from '../../../../cockpit/ports.mjs';
  const { langgraph: backend } = portsFor('cockpit-ag-ui-streaming-angular');
  export default { '/agent': { target: `http://localhost:${backend}`, secure: false, changeOrigin: true, ws: true } };
  ```
- Add `src/main.cockpit.ts` (copy from `cockpit/langgraph/streaming/angular/src/main.cockpit.ts`, adjust any path/bootstrap names).
- `project.json`: point `serve.options.proxyConfig` → `proxy.conf.mjs`; add the `cockpit` build configuration (mirror the langgraph streaming `project.json`); add an `e2e` target (mirror langgraph streaming). Keep `name: cockpit-ag-ui-streaming-angular`.
- `src/index.ts`: keep `product: 'ag-ui'`, `topic: 'streaming'`; ensure asset paths + `promptAssetPaths`/`codeAssetPaths`/`backendAssetPaths`/`docsAssetPaths` fields match the descriptor shape used in Task 6 (add `backendAssetPaths` pointing at the new python server/graph).

- [ ] **Step 3: Verify build**

```bash
npx nx build cockpit-ag-ui-streaming-angular
npx nx build cockpit-ag-ui-streaming-angular --configuration=cockpit
```
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add cockpit/ag-ui/streaming/angular
git commit -m "refactor(cockpit): ag-ui/streaming uses real ag-ui-langgraph backend + cockpit embedding parity"
```

---

## Task 11: `cockpit/ag-ui/streaming` e2e (recorder + fixtures + spec)

**Files (create):** `cockpit/ag-ui/streaming/angular/e2e/{global-setup-impl.ts, playwright.config.ts, streaming.spec.ts, tsconfig.json, manual/streaming.manual.ts, fixtures/streaming.json}`

- [ ] **Step 1: Duplicate + repoint** — same as Task 8 Step 1 but from `cockpit/langgraph/streaming/angular/e2e/`, project name `cockpit-ag-ui-streaming-angular`, `pythonCwd: 'cockpit/ag-ui/streaming/python'`, `backendPort: ports.langgraph`.

- [ ] **Step 2: Adapt the spec** — duplicate `streaming.spec.ts`; it asserts tokens stream into the message list. Adjust selectors/trigger text only if the component differs.

- [ ] **Step 3: Record fixtures** — run `manual/streaming.manual.ts` with a real key to capture the streamed reply into `fixtures/streaming.json` (mirror langgraph streaming recorder).

- [ ] **Step 4: Run e2e** — `npx nx e2e cockpit-ag-ui-streaming-angular`. Expected: PASS (tokens render).

- [ ] **Step 5: Commit**

```bash
git add cockpit/ag-ui/streaming/angular/e2e
git commit -m "test(cockpit): ag-ui/streaming e2e with recorded aimock fixtures"
```

---

## Task 12: CI smoke list + final verification

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1: Add python smoke entries**

In `ci.yml`'s `cockpit-smoke` job, find the hardcoded `--projects=...` list and add `cockpit-ag-ui-interrupts-python` and `cockpit-ag-ui-streaming-python`.

- [ ] **Step 2: Full local verification**

Run:
```bash
npx nx test ag-ui
npx nx test cockpit-registry
npx nx run-many -t build -p ag-ui cockpit-ag-ui-interrupts-angular cockpit-ag-ui-streaming-angular
npx nx run-many -t smoke -p cockpit-ag-ui-interrupts-python cockpit-ag-ui-streaming-python
node --test scripts/cockpit-ports.spec.mjs
node scripts/cockpit-matrix.mjs   # confirm both ag-ui examples are discovered for e2e
npx nx e2e cockpit-ag-ui-interrupts-angular
npx nx e2e cockpit-ag-ui-streaming-angular
```
Expected: all green; the matrix output lists `cockpit-ag-ui-interrupts-angular` and `cockpit-ag-ui-streaming-angular`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(cockpit): add ag-ui interrupts + streaming python to smoke list"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Adapter interrupt + resume → Tasks 1–2. Manifest section → Task 3. Ports → Task 4. AG-UI e2e harness variant → Task 5. interrupts example (python/angular/e2e) → Tasks 6–8. streaming refactor (python/angular/e2e) → Tasks 9–11. CI smoke + final verify → Task 12. Deploy files (`vercel.json`/`requirements.txt`) → Tasks 6/7/9/10. `subagents` explicitly out of scope. Blog post out of scope. All spec sections covered.
- **Placeholder scan:** Remaining `<…>`-style notes are deliberate "verify-and-adjust" instructions for the external `ag-ui-langgraph` API and port-collision fallback, with the required contract stated — not unresolved TODOs. Novel code (reducer, to-agent, harness factory, server.py, manifest, ports) is given in full; example scaffolding uses explicit copy-from-path + exact edits.
- **Name consistency:** `interrupt` signal, `AgentInterrupt`, `on_interrupt`, `forwardedProps.command.resume`, project names `cockpit-ag-ui-{interrupts,streaming}-{angular,python}`, ports `4320/5320` + `4321/5321`, descriptor ids `ag-ui-{topic}-{lang}` are used consistently across tasks. The e2e factory field is `backendPort` (maps to `ports.langgraph`) in both Task 5 and Tasks 8/11.

## Risks / verify-as-you-go

- **`ag-ui-langgraph` API surface** (Task 6 Step 2) is external — confirm `LangGraphAgent` / `add_langgraph_fastapi_endpoint` names against the installed version; the required contract (FastAPI `app` serving AG-UI at `/agent` + `GET /ok`) is fixed.
- **Fixture recording** (Tasks 8/11) needs a real `OPENAI_API_KEY` locally; CI runs replay-only.
- **`global-teardown`** must handle the new `backend` child (Task 5 Step 1) without breaking the langgraph `langgraph` child.
