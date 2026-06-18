# Shared LangGraph Client Options — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one app-wide DI token (`LANGGRAPH_CLIENT_OPTIONS`) that both the streaming agent transport and the threads adapter read, so the LangGraph SDK retry budget is configured once.

**Architecture:** A new `InjectionToken<LangGraphClientOptions>` plus a pure `resolveClientOptions(...layers)` first-defined-wins helper. `agent()` resolves call-site → `provideAgent` → token; `LangGraphThreadsAdapter` reads the token directly (the `LANGGRAPH_CLIENT` bypass stays). `examples/chat` provides the token once at root from its existing `e2eClientOptions()` and reverts `DemoShell` to static `provideAgent`.

**Tech Stack:** Angular standalone DI, `@langchain/langgraph-sdk` Client (`callerOptions.maxRetries`), Vitest, Nx, Playwright.

**Branch:** `feat/langgraph-shared-client-options` (already created off main; the design spec is committed there).

---

## File Structure

- **Create** `libs/langgraph/src/lib/client/client-options.ts` — the `LANGGRAPH_CLIENT_OPTIONS` token + pure `resolveClientOptions()` helper.
- **Create** `libs/langgraph/src/lib/client/client-options.spec.ts` — precedence unit tests.
- **Modify** `libs/langgraph/src/public-api.ts` — export the token.
- **Modify** `libs/langgraph/src/lib/agent.fn.ts` — inject the token, resolve, pass resolved options into the bridge.
- **Modify** `libs/langgraph/src/lib/threads/threads-adapter.ts` — inject the token, pass to `createLangGraphClient`.
- **Modify** `libs/langgraph/src/lib/threads/threads-adapter.spec.ts` — assert the token is threaded.
- **Modify** `examples/chat/angular/src/app/app.config.ts` — provide the token from `e2eClientOptions()`.
- **Modify** `examples/chat/angular/src/app/shell/demo-shell.component.ts` — revert to static `provideAgent`, drop the per-agent `clientOptions` + now-unused import.
- **Regenerate** `apps/website/content/docs/langgraph/api/api-docs.json`.

`LangGraphClientOptions` already exists (`agent.types.ts`, exported). `createLangGraphClient(apiUrl, clientOptions?)` already accepts options (#677).

---

### Task 1: `client-options.ts` — token + `resolveClientOptions`

**Files:**
- Create: `libs/langgraph/src/lib/client/client-options.ts`
- Test: `libs/langgraph/src/lib/client/client-options.spec.ts`
- Modify: `libs/langgraph/src/public-api.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/langgraph/src/lib/client/client-options.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { resolveClientOptions } from './client-options';

describe('resolveClientOptions', () => {
  it('returns undefined when every layer is undefined/null', () => {
    expect(resolveClientOptions(undefined, null, undefined)).toBeUndefined();
    expect(resolveClientOptions()).toBeUndefined();
  });

  it('returns the first defined layer (highest precedence first)', () => {
    expect(resolveClientOptions({ maxRetries: 0 }, { maxRetries: 4 })).toEqual({ maxRetries: 0 });
  });

  it('falls through to a later layer when earlier layers are absent', () => {
    expect(resolveClientOptions(undefined, undefined, { maxRetries: 2 })).toEqual({ maxRetries: 2 });
  });

  it('treats only undefined/null as absent (an empty object is a real layer)', () => {
    expect(resolveClientOptions({}, { maxRetries: 4 })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test langgraph --skip-nx-cache -- client-options`
Expected: FAIL — cannot find module `./client-options` / `resolveClientOptions is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `libs/langgraph/src/lib/client/client-options.ts`:

```ts
// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { LangGraphClientOptions } from '../agent.types';

/**
 * App-wide LangGraph SDK client tuning (e.g. `maxRetries`). Provide once at the
 * app root; both the agent's default {@link FetchStreamTransport} and the
 * {@link LangGraphThreadsAdapter} read it so the retry budget is configured in
 * one place. A per-agent `provideAgent({ clientOptions })` overrides it for that
 * agent. Absent → the SDK default.
 */
export const LANGGRAPH_CLIENT_OPTIONS = new InjectionToken<LangGraphClientOptions>(
  'LANGGRAPH_CLIENT_OPTIONS',
);

/**
 * First-defined-wins resolution across precedence layers (highest first).
 * Whole-object semantics — no per-field merge — so the winning layer is the
 * single source for every option. Returns undefined when all layers are absent.
 */
export function resolveClientOptions(
  ...layers: Array<LangGraphClientOptions | undefined | null>
): LangGraphClientOptions | undefined {
  for (const layer of layers) {
    if (layer) return layer;
  }
  return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test langgraph --skip-nx-cache -- client-options`
Expected: PASS (4 tests).

- [ ] **Step 5: Export the token from the public API**

In `libs/langgraph/src/public-api.ts`, immediately after the existing line
`export { createLangGraphClient, toAbsoluteApiUrl } from './lib/client/create-langgraph-client';` add:

```ts
export { LANGGRAPH_CLIENT_OPTIONS } from './lib/client/client-options';
```

(Do NOT export `resolveClientOptions` — it stays internal.)

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/lib/client/client-options.ts libs/langgraph/src/lib/client/client-options.spec.ts libs/langgraph/src/public-api.ts
git commit -m "feat(langgraph): LANGGRAPH_CLIENT_OPTIONS token + resolveClientOptions helper"
```

---

### Task 2: Agent read site — resolve token in `agent.fn.ts`

**Files:**
- Modify: `libs/langgraph/src/lib/agent.fn.ts`

Context: `agent()` runs in an injection context (it already calls `inject(DestroyRef)` and `inject(AGENT_CONFIG, { optional: true })`). It currently builds the bridge options at the `createStreamManagerBridge({ options: { ...options, apiUrl, transport }, ... })` call. The bridge already forwards `options.clientOptions` to `FetchStreamTransport` (added in #677), so we resolve the effective options here and set `clientOptions` on the bridge options.

- [ ] **Step 1: Add the import**

At the top of `libs/langgraph/src/lib/agent.fn.ts`, alongside the other `./internals` / local imports (e.g. near `import { createStreamManagerBridge } from './internals/stream-manager.bridge';`), add:

```ts
import { LANGGRAPH_CLIENT_OPTIONS, resolveClientOptions } from './client/client-options';
```

- [ ] **Step 2: Inject the token and resolve precedence**

Find this block (currently around lines 146-153):

```ts
  const destroyRef   = inject(DestroyRef);
  const globalConfig = inject(AGENT_CONFIG, { optional: true });
  const destroy$     = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  // Merge: call-site options take precedence over global provider config
  const apiUrl    = options.apiUrl    ?? globalConfig?.apiUrl    ?? '';
  const transport = options.transport ?? globalConfig?.transport;
```

Replace it with (adds the token inject + a resolved `clientOptions`):

```ts
  const destroyRef   = inject(DestroyRef);
  const globalConfig = inject(AGENT_CONFIG, { optional: true });
  const sharedClientOptions = inject(LANGGRAPH_CLIENT_OPTIONS, { optional: true });
  const destroy$     = new Subject<void>();
  destroyRef.onDestroy(() => { destroy$.next(); destroy$.complete(); });

  // Merge: call-site options take precedence over global provider config
  const apiUrl    = options.apiUrl    ?? globalConfig?.apiUrl    ?? '';
  const transport = options.transport ?? globalConfig?.transport;
  // clientOptions precedence: agent({...}) call-site → provideAgent config →
  // app-wide LANGGRAPH_CLIENT_OPTIONS token → SDK default.
  const clientOptions = resolveClientOptions(
    options.clientOptions,
    globalConfig?.clientOptions,
    sharedClientOptions,
  );
```

- [ ] **Step 3: Pass the resolved options into the bridge**

Find the bridge construction (currently around line 293):

```ts
  const manager = createStreamManagerBridge({
    options: { ...options, apiUrl, transport },
    subjects,
    threadId$,
    destroy$: destroy$.asObservable(),
  });
```

Change the `options` line to set the resolved `clientOptions` (it overrides the spread `options.clientOptions`):

```ts
  const manager = createStreamManagerBridge({
    options: { ...options, apiUrl, transport, clientOptions },
    subjects,
    threadId$,
    destroy$: destroy$.asObservable(),
  });
```

- [ ] **Step 4: Verify the lib still type-checks and tests pass**

Run: `npx nx run-many -t lint test --projects=langgraph --skip-nx-cache`
Expected: PASS (existing agent specs still green; no new failures). If an existing `agent.spec.ts` constructs an agent without providing `LANGGRAPH_CLIENT_OPTIONS`, that is fine — `inject(..., { optional: true })` returns `null`.

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/agent.fn.ts
git commit -m "feat(langgraph): agent() resolves LANGGRAPH_CLIENT_OPTIONS (call-site > provider > token)"
```

---

### Task 3: Threads adapter read site + test

**Files:**
- Modify: `libs/langgraph/src/lib/threads/threads-adapter.ts`
- Test: `libs/langgraph/src/lib/threads/threads-adapter.spec.ts`

- [ ] **Step 1: Write the failing test**

In `libs/langgraph/src/lib/threads/threads-adapter.spec.ts`, add the module mock and a new describe block. At the very top of the file (after the existing imports), add a `vi.mock` of the client factory and import its mocked form:

```ts
import { createLangGraphClient } from '../client/create-langgraph-client';
import { LANGGRAPH_CLIENT_OPTIONS } from '../client/client-options';

vi.mock('../client/create-langgraph-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/create-langgraph-client')>();
  return { ...actual, createLangGraphClient: vi.fn(actual.createLangGraphClient) };
});
```

Then add this block at the end of the file (inside the top-level `describe` or as a sibling — match the file's existing structure):

```ts
describe('LangGraphThreadsAdapter client options', () => {
  beforeEach(() => {
    vi.mocked(createLangGraphClient).mockClear();
  });

  it('threads LANGGRAPH_CLIENT_OPTIONS into createLangGraphClient', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'http://x' } },
        { provide: LANGGRAPH_CLIENT_OPTIONS, useValue: { maxRetries: 0 } },
      ],
    });
    TestBed.inject(LangGraphThreadsAdapter);
    expect(createLangGraphClient).toHaveBeenCalledWith('http://x', { maxRetries: 0 });
  });

  it('passes undefined options when the token is absent', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'http://x' } },
      ],
    });
    TestBed.inject(LangGraphThreadsAdapter);
    expect(createLangGraphClient).toHaveBeenCalledWith('http://x', undefined);
  });

  it('does not construct a client when LANGGRAPH_CLIENT is provided (bypass intact)', () => {
    const injected = { threads: {} } as unknown as Client;
    TestBed.configureTestingModule({
      providers: [
        { provide: LANGGRAPH_THREADS_CONFIG, useValue: { apiUrl: 'http://x' } },
        { provide: LANGGRAPH_CLIENT_OPTIONS, useValue: { maxRetries: 0 } },
        { provide: LANGGRAPH_CLIENT, useValue: injected },
      ],
    });
    TestBed.inject(LangGraphThreadsAdapter);
    expect(createLangGraphClient).not.toHaveBeenCalled();
  });
});
```

Note: `TestBed.resetTestingModule()` between tests is handled by the framework's default; if the file disables auto-reset, add `TestBed.resetTestingModule()` in the `beforeEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test langgraph --skip-nx-cache -- threads-adapter`
Expected: FAIL — `createLangGraphClient` called with `('http://x')` not `('http://x', { maxRetries: 0 })` (the adapter doesn't read the token yet); the `undefined` test may already pass.

- [ ] **Step 3: Implement — inject the token and thread it**

In `libs/langgraph/src/lib/threads/threads-adapter.ts`, add the import near the existing `createLangGraphClient` import:

```ts
import { LANGGRAPH_CLIENT_OPTIONS } from '../client/client-options';
```

Then change the client field initializer. Current (around lines 63-65):

```ts
  private readonly config = inject(LANGGRAPH_THREADS_CONFIG);
  private readonly client: Client = inject(LANGGRAPH_CLIENT, { optional: true })
    ?? createLangGraphClient(this.config.apiUrl);
```

Replace with (declare `sharedClientOptions` BEFORE `client` so field-init order is correct):

```ts
  private readonly config = inject(LANGGRAPH_THREADS_CONFIG);
  private readonly sharedClientOptions = inject(LANGGRAPH_CLIENT_OPTIONS, { optional: true }) ?? undefined;
  private readonly client: Client = inject(LANGGRAPH_CLIENT, { optional: true })
    ?? createLangGraphClient(this.config.apiUrl, this.sharedClientOptions);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test langgraph --skip-nx-cache -- threads-adapter`
Expected: PASS (all three new cases + existing threads-adapter tests).

- [ ] **Step 5: Commit**

```bash
git add libs/langgraph/src/lib/threads/threads-adapter.ts libs/langgraph/src/lib/threads/threads-adapter.spec.ts
git commit -m "feat(langgraph): threads adapter reads LANGGRAPH_CLIENT_OPTIONS"
```

---

### Task 4: examples/chat migration — root token + revert DemoShell

**Files:**
- Modify: `examples/chat/angular/src/app/app.config.ts`
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts`

- [ ] **Step 1: Provide the token at app root**

In `examples/chat/angular/src/app/app.config.ts`:

1. Change the langgraph import to add the token. Current:

```ts
import { LANGGRAPH_THREADS_CONFIG } from '@threadplane/langgraph';
```

to:

```ts
import { LANGGRAPH_THREADS_CONFIG, LANGGRAPH_CLIENT_OPTIONS } from '@threadplane/langgraph';
```

2. Add the helper import (after the `provideChat` import line):

```ts
import { e2eClientOptions } from './shell/e2e-overrides';
```

3. In the `providers` array, immediately after the `LANGGRAPH_THREADS_CONFIG` provider object, add:

```ts
    // Single source of truth for the SDK client retry budget — both the agent
    // transport and the threads adapter read this. Production: e2eClientOptions()
    // returns undefined → SDK default. Under e2e: the THREADPLANE_E2E_MAX_RETRIES
    // localStorage flag → fail fast. useFactory runs at injection time (post-
    // bootstrap), so the flag is readable.
    { provide: LANGGRAPH_CLIENT_OPTIONS, useFactory: () => e2eClientOptions() },
```

- [ ] **Step 2: Revert DemoShell to static provideAgent**

In `examples/chat/angular/src/app/shell/demo-shell.component.ts`:

1. Remove the now-unused import line:

```ts
import { e2eClientOptions } from './e2e-overrides';
```

2. Change the `provideAgent` call from the factory form back to a static object, removing the `clientOptions` spread and the factory comment. Current:

```ts
    // Factory form: the config is resolved lazily at injection time (when the
    // AGENT singleton is first constructed), not at module-load. This matters
    // for `clientOptions` below — the e2e flag in localStorage is only reliably
    // readable once the app is running, after bootstrap.
    provideAgent(() => ({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.assistantId,
      // Production keeps the SDK's default connect-retry budget. e2e specs that
      // force a connection failure set localStorage['THREADPLANE_E2E_MAX_RETRIES']
      // so the error surfaces immediately instead of after the backoff window.
      ...(e2eClientOptions() ? { clientOptions: e2eClientOptions() } : {}),
      threadId: threadIdState,
      onThreadId: (id: string) => {
        // The signal→URL effect picks this up and stamps the new id
        // into the URL — no persistence write needed any more, URL is
        // the source of truth.
        threadIdState.set(id);
      },
      // Phase 3B: tells SubagentTracker to treat `research` tool calls as
      // subagent dispatches and to materialize agent.subagents() from the
      // resulting tools:<id>-namespaced stream events.
      subagentToolNames: ['research'],
      telemetry: (event) => telemetrySink?.(event),
    })),
```

Replace with:

```ts
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.assistantId,
      threadId: threadIdState,
      onThreadId: (id: string) => {
        // The signal→URL effect picks this up and stamps the new id
        // into the URL — no persistence write needed any more, URL is
        // the source of truth.
        threadIdState.set(id);
      },
      // Phase 3B: tells SubagentTracker to treat `research` tool calls as
      // subagent dispatches and to materialize agent.subagents() from the
      // resulting tools:<id>-namespaced stream events.
      subagentToolNames: ['research'],
      telemetry: (event) => telemetrySink?.(event),
    }),
```

- [ ] **Step 3: Build the app (CRITICAL — catches spec/app-build breakage)**

Run: `npx nx build examples-chat-angular --skip-nx-cache`
Expected: `Successfully ran target build` (a bundle-budget WARNING is acceptable; an ERROR is not). This gate is mandatory — `nx test` alone does NOT compile the app and would miss a build break.

- [ ] **Step 4: Run the example unit tests**

Run: `npx nx test examples-chat-angular --skip-nx-cache`
Expected: PASS (demo-shell spec + e2e-overrides spec unchanged).

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular/src/app/app.config.ts examples/chat/angular/src/app/shell/demo-shell.component.ts
git commit -m "refactor(examples/chat): provide LANGGRAPH_CLIENT_OPTIONS at root; revert DemoShell to static provideAgent"
```

---

### Task 5: Regenerate api-docs + full gates

**Files:**
- Modify: `apps/website/content/docs/langgraph/api/api-docs.json` (generated)

- [ ] **Step 1: Regenerate API docs**

Run: `npm run generate-api-docs`
Expected: exit 0; `git status --porcelain apps/website/content/docs/langgraph/api/api-docs.json` shows it modified (the new `LANGGRAPH_CLIENT_OPTIONS` token). Confirm no `copilotkit` string appears anywhere in `git diff` (`git diff | grep -i copilotkit` must be empty).

- [ ] **Step 2: Run the full local gates**

Run each; all must pass:
```bash
npx nx run-many -t lint test --projects=langgraph --skip-nx-cache
npx nx build examples-chat-angular --skip-nx-cache
npx nx test examples-chat-angular --skip-nx-cache
```
Expected: all green (bundle-budget WARNING acceptable).

- [ ] **Step 3: Run the examples/chat e2e (agent path still green)**

First free the dev-server ports (now reaped by the new teardown, but be safe):
```bash
lsof -ti :4200 :2024 | xargs -r kill -9 2>/dev/null || true
```
Run: `npx nx e2e examples-chat-angular --skip-nx-cache -- --grep "error handling"`
Expected: 1 passed (the failed stream still surfaces the alert fast — now via the shared token instead of per-agent clientOptions).

- [ ] **Step 4: Commit the generated docs**

```bash
git add apps/website/content/docs/langgraph/api/api-docs.json
git commit -m "docs(langgraph): regenerate api-docs for LANGGRAPH_CLIENT_OPTIONS"
```

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin feat/langgraph-shared-client-options
gh pr create --title "feat(langgraph): single-source LANGGRAPH_CLIENT_OPTIONS for retry budget" --body "..."
```

PR body: summarize the token + precedence, the threads-adapter completion, and the examples/chat migration; link the design spec.

---

## Notes for the implementer

- `inject(TOKEN, { optional: true })` returns `null` when unprovided — `resolveClientOptions` treats `null` as absent, and the threads adapter coerces with `?? undefined` so `createLangGraphClient(apiUrl, undefined)` keeps the SDK default.
- Do NOT add a `clientOptions` field to `LangGraphThreadsConfig` — the token is the single source on the threads side (avoids a second knob).
- Do NOT change the SDK default or refactor `apiUrl` wiring (YAGNI per the spec).
- When adding any new `*.spec.ts` under `examples/chat/angular/src/`, it MUST `import { describe, it, expect, ... } from 'vitest'` — `tsconfig.app.json` type-checks specs with `types: []`, so ambient globals break the app build.
