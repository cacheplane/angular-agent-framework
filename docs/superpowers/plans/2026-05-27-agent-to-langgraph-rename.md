# Agent → LangGraph Rename & Adapter API Symmetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the stale `agent` library label across the public surface, reshape both `@threadplane/langgraph` and `@threadplane/ag-ui` to a symmetric `provideAgent` / `injectAgent` / `AgentConfig` API, and add a "Choosing an adapter" docs page so developers can pick between the LangGraph and AG-UI adapters with full clarity.

**Architecture:** Five PR-sized phases (A → E). Phase A reshapes both libs' public APIs in lockstep (foundation). Phase B moves the `/docs/agent` route + content tree to `/docs/langgraph`. Phase C updates every link, label, and telemetry slug in the website. Phase D adds the "Choosing an adapter" page and polishes the getting-started flow. Phase E dispatches five parallel `Explore` subagents to sweep for residuals and lands the final cleanup. No backwards-compatibility shims, no redirects, no deprecated aliases. Patch-version bump (0.0.47 → 0.0.48) for both libs.

**Tech Stack:** Nx monorepo · Angular 20 (libs) · Next.js (`apps/website`) · Vitest + Angular TestBed (lib unit tests) · MDX (docs content) · PostHog (telemetry).

**Reference spec:** [docs/superpowers/specs/2026-05-27-agent-to-langgraph-rename-design.md](../specs/2026-05-27-agent-to-langgraph-rename-design.md)

---

## Phase A — Library API symmetry

**Outcome:** Both libs publish a symmetric three-export public surface (`provideAgent`, `injectAgent`, `AgentConfig`). Internal call sites and specs are updated to the new API. Patch version bumped. Lib unit + conformance suites pass.

**PR scope:** `libs/langgraph/**`, `libs/ag-ui/**` only. No website changes in this phase.

### Task A1: Add `injectAgent()` to `@threadplane/langgraph`

**Files:**
- Create: `libs/langgraph/src/lib/inject-agent.ts`
- Create: `libs/langgraph/src/lib/inject-agent.spec.ts`
- Modify: `libs/langgraph/src/public-api.ts`

The langgraph lib currently exposes an `agent()` factory function that consumers call inside a component. We need a parallel `injectAgent()` helper that resolves the same underlying `Agent` so the public surface matches `@threadplane/ag-ui`. The implementation is the simplest possible: it just calls the existing `agent()` function via Angular DI's `runInInjectionContext`-equivalent (since `agent()` already calls `inject(AGENT_CONFIG, ...)` internally, `injectAgent()` is a one-line passthrough callable from any injection context).

- [ ] **Step 1: Write the failing test**

```ts
// libs/langgraph/src/lib/inject-agent.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideAgent } from './agent.provider';
import { injectAgent } from './inject-agent';

describe('injectAgent', () => {
  it('returns the same Agent instance as agent() does in the same injection context', () => {
    TestBed.configureTestingModule({
      providers: [
        provideAgent({
          apiUrl: 'http://localhost/api',
          assistantId: 'test-assistant',
        }),
      ],
    });
    const injected = TestBed.runInInjectionContext(() => injectAgent());
    expect(injected).toBeDefined();
    // The returned Agent must expose the public AgentContract shape.
    expect(typeof injected.submit).toBe('function');
    expect(typeof injected.messages).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test langgraph -- --test-file=inject-agent.spec.ts`
Expected: FAIL with "Cannot find module './inject-agent'".

- [ ] **Step 3: Write minimal implementation**

```ts
// libs/langgraph/src/lib/inject-agent.ts
// SPDX-License-Identifier: MIT
import { agent } from './agent.fn';
import type { LangGraphAgent } from './agent.types';

/**
 * Retrieve the LangGraph-backed Agent from the current injection context.
 * Mirrors @threadplane/ag-ui's `injectAgent()` so consumer code is identical
 * regardless of which adapter is wired in app.config.ts.
 */
export function injectAgent(): LangGraphAgent {
  return agent();
}
```

- [ ] **Step 4: Add to public-api.ts**

In `libs/langgraph/src/public-api.ts`, add the export (keep `agent` and `AGENT_CONFIG` for now — they're removed in Task A2):

```ts
// SPDX-License-Identifier: MIT
// Primary function (DEPRECATED — see injectAgent. Removed in Task A2.)
export { agent } from './lib/agent.fn';

// Symmetric inject helper (new — matches @threadplane/ag-ui)
export { injectAgent } from './lib/inject-agent';

// Provider
export { provideAgent, AGENT_CONFIG } from './lib/agent.provider';
export type { AgentConfig } from './lib/agent.provider';

// ...rest unchanged
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test langgraph -- --test-file=inject-agent.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full langgraph suite to verify nothing else broke**

Run: `npx nx test langgraph`
Expected: PASS (same number of tests as before plus one new one).

- [ ] **Step 7: Commit**

```bash
git add libs/langgraph/src/lib/inject-agent.ts libs/langgraph/src/lib/inject-agent.spec.ts libs/langgraph/src/public-api.ts
git commit -m "feat(langgraph): add injectAgent() helper for adapter API symmetry"
```

### Task A2: Remove `agent` and `AGENT_CONFIG` from `@threadplane/langgraph` public-api

**Files:**
- Modify: `libs/langgraph/src/public-api.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.spec.ts`
- Modify: `libs/langgraph/src/lib/agent.conformance.spec.ts`
- Modify: `libs/langgraph/src/lib/agent-lifecycle-registry.spec.ts`
- Modify: `libs/langgraph/src/lib/lifecycle.spec.ts`
- Modify: `libs/langgraph/src/lib/agent.provider.spec.ts`

`agent()` and `AGENT_CONFIG` become internal-only. The function bodies stay in `agent.fn.ts` and `agent.provider.ts` — only the public-api re-exports go away. Spec files that import these from the public path must switch to a relative import (they were internal tests anyway; the public path was a convenience).

- [ ] **Step 1: Remove the two exports from public-api.ts**

In `libs/langgraph/src/public-api.ts`:

```ts
// SPDX-License-Identifier: MIT
// Symmetric inject helper (matches @threadplane/ag-ui)
export { injectAgent } from './lib/inject-agent';

// Provider
export { provideAgent } from './lib/agent.provider';
export type { AgentConfig } from './lib/agent.provider';

// Lifecycle monitoring
export { AGENT_LIFECYCLE } from './lib/lifecycle';
export type { AgentLifecycle } from './lib/lifecycle';
export { AgentLifecycleRegistry } from './lib/agent-lifecycle-registry';

// Public types
export type {
  AgentOptions,
  AgentBranchTree,
  AgentBranchTreeFork,
  AgentBranchTreeNode,
  AgentQueue,
  AgentQueueEntry,
  LangGraphAgent,
  LangGraphMultitaskStrategy,
  LangGraphSubmitOptions,
  AgentTransport,
  CustomStreamEvent,
  StreamEvent,
  SubagentStreamRef,
} from './lib/agent.types';

// Re-export from SDK (consumers import from angular, not langgraph-sdk)
export type { BagTemplate, InferBag, Interrupt, ThreadState, SubmitOptions }
  from './lib/agent.types';

// Re-export ResourceStatus shim for convenience
export { ResourceStatus } from './lib/agent.types';

// Test utilities (always exported — tree-shaken in prod builds)
export { MockAgentTransport } from './lib/transport/mock-stream.transport';
export { FetchStreamTransport } from './lib/transport/fetch-stream.transport';

// Mock test utility for LangGraph agent
export { mockLangGraphAgent } from './lib/testing/mock-langgraph-agent';
export type { MockLangGraphAgent } from './lib/testing/mock-langgraph-agent';

// Citation normalizer
export { extractCitations } from './lib/internals/extract-citations';

// SDK Client helper
export { createLangGraphClient, toAbsoluteApiUrl } from './lib/client/create-langgraph-client';

// SDK-backed thread store
export {
  LangGraphThreadsAdapter,
  LANGGRAPH_THREADS_CONFIG,
  LANGGRAPH_CLIENT,
} from './lib/threads/threads-adapter';
export type { LangGraphThreadsConfig } from './lib/threads/threads-adapter';

// Lifecycle helper for hooking refreshes onto agent state transitions.
export { refreshOnRunEnd, refreshOnTransition } from './lib/threads/refresh-on';
```

- [ ] **Step 2: Update spec imports that used the public path**

The spec files at lines listed below currently import `agent` and `AGENT_CONFIG` either from the public-api or directly from sibling files. Switch any public-path imports to the sibling-relative path. Concretely, search each of the following files for `from '../../public-api'` or `from '@threadplane/langgraph'` and switch to the matching relative file:
- `libs/langgraph/src/lib/agent.fn.spec.ts:5` (already imports from `./agent.fn` — verify, no change needed)
- `libs/langgraph/src/lib/agent.conformance.spec.ts:12`
- `libs/langgraph/src/lib/agent-lifecycle-registry.spec.ts:5`
- `libs/langgraph/src/lib/lifecycle.spec.ts:5`
- `libs/langgraph/src/lib/agent.provider.spec.ts:4` (imports `AGENT_CONFIG` — switch to `from './agent.provider'`)

Use Read to inspect each file's current import line, then Edit to switch the source path to the matching relative file (`./agent.fn` for `agent`, `./agent.provider` for `AGENT_CONFIG`). Do NOT use `replace_all`.

- [ ] **Step 3: Run the full langgraph test suite**

Run: `npx nx test langgraph`
Expected: PASS (same test count as Task A1's run).

- [ ] **Step 4: Build to verify no consumer of the public-api breaks**

Run: `npx nx build langgraph`
Expected: PASS, no errors about missing exports.

- [ ] **Step 5: Verify no internal lib code references `from './public-api'` (would be a circular import smell)**

Run: `git grep -n "from './public-api'" libs/langgraph/src/lib/`
Expected: empty output. If non-empty, replace with sibling-relative paths.

- [ ] **Step 6: Commit**

```bash
git add libs/langgraph/src/public-api.ts libs/langgraph/src/lib/
git commit -m "refactor(langgraph): remove agent() and AGENT_CONFIG from public API"
```

### Task A3: Rename ag-ui public API to symmetric names

**Files:**
- Modify: `libs/ag-ui/src/lib/provide-ag-ui-agent.ts`
- Rename: `libs/ag-ui/src/lib/provide-ag-ui-agent.ts` → `libs/ag-ui/src/lib/provide-agent.ts`
- Modify: `libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts`
- Rename: `libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts` → `libs/ag-ui/src/lib/provide-agent.spec.ts`
- Modify: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`
- Rename: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts` → `libs/ag-ui/src/lib/testing/provide-fake-agent.ts`
- Modify: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts`
- Rename: `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts` → `libs/ag-ui/src/lib/testing/provide-fake-agent.spec.ts`
- Modify: `libs/ag-ui/src/public-api.ts`

The rename is mechanical but must be done by hand per occurrence — **DO NOT** use `replace_all` for `AgUiAgent`, `provideAgUiAgent`, `injectAgUiAgent`, `AG_UI_AGENT`, or `AgUiAgentConfig` because they overlap with legitimate substrings (and we already have a memory entry warning against this class of rename). Confirm each occurrence by hand.

- [ ] **Step 1: Rename the symbols inside `provide-ag-ui-agent.ts`**

Using Read first to see the file, then Edit each occurrence:

| Line | Old | New |
|---|---|---|
| 15 | `export interface AgUiAgentConfig` | `export interface AgentConfig` |
| 24 | `export const AG_UI_AGENT = new InjectionToken<Agent>('AG_UI_AGENT')` | `/** @internal — exported for spec access only. Consumers must use injectAgent(). */`<br>`export const AGENT = new InjectionToken<Agent>('AGENT')` (rename token + key; keep `export` but mark `@internal` so specs can import it while signalling that consumers shouldn't) |
| 32 | `export function provideAgUiAgent(config: AgUiAgentConfig): Provider[]` | `export function provideAgent(config: AgentConfig): Provider[]` |
| 35 | `provide: AG_UI_AGENT,` | `provide: AGENT,` |
| 53 | `export function injectAgUiAgent(): Agent` | `export function injectAgent(): Agent` |
| 54 | `return inject(AG_UI_AGENT)` | `return inject(AGENT)` |

Verify with Read after editing.

- [ ] **Step 2: Rename the file**

Run: `git mv libs/ag-ui/src/lib/provide-ag-ui-agent.ts libs/ag-ui/src/lib/provide-agent.ts`

- [ ] **Step 3: Update the spec file in place, then rename it**

The `AGENT` token stays `export`ed (with `/** @internal */` per Step 1) specifically so this spec can import it. The spec's behavioral assertions don't change — only the identifiers.

In `libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts`:
- Line 6: `import { provideAgUiAgent, AG_UI_AGENT } from './provide-ag-ui-agent';` → `import { provideAgent, AGENT } from './provide-agent';`
- Line 67: test name `'provides AG_UI_AGENT token'` → `'provides Agent under the internal AGENT token'`
- Lines 71, 115, 123: `expect(agentProvider.provide).toBe(AG_UI_AGENT)` → `expect(agentProvider.provide).toBe(AGENT)`
- Anywhere else `provideAgUiAgent(...)` appears in this file: → `provideAgent(...)`

After the in-place edits:
Run: `git mv libs/ag-ui/src/lib/provide-ag-ui-agent.spec.ts libs/ag-ui/src/lib/provide-agent.spec.ts`

- [ ] **Step 4: Update the fake-agent files identically**

In `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts`:
- Line 4: `import { AG_UI_AGENT } from '../provide-ag-ui-agent';` → `import { AGENT } from '../provide-agent';`
- Line 8: `export interface FakeAgUiAgentConfig` → `export interface FakeAgentConfig`
- Line 18 comment: `Registers an in-process FakeAgent under AG_UI_AGENT` → `Registers an in-process FakeAgent under AGENT`
- Line 21 comment: `provideAgUiAgent({ url })` → `provideAgent({ url })`
- Line 23: `export function provideFakeAgUiAgent(config: FakeAgUiAgentConfig = {}): Provider[]` → `export function provideFakeAgent(config: FakeAgentConfig = {}): Provider[]`
- Line 26: `provide: AG_UI_AGENT,` → `provide: AGENT,`

Then: `git mv libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.ts libs/ag-ui/src/lib/testing/provide-fake-agent.ts`

In `libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts`:
- Line 5: `import { AG_UI_AGENT } from '../provide-ag-ui-agent';` → `import { AGENT } from '../provide-agent';`
- Line 6: `import { provideFakeAgUiAgent } from './provide-fake-ag-ui-agent';` → `import { provideFakeAgent } from './provide-fake-agent';`
- Line 9 test name: `'registers AG_UI_AGENT with a Fake-backed Agent'` → `'registers AGENT with a Fake-backed Agent'`
- Line 11: `const agent = TestBed.inject(AG_UI_AGENT)` → `const agent = TestBed.inject(AGENT)`
- Line 18: `provideFakeAgUiAgent({ tokens: ['a'], delayMs: 1 })` → `provideFakeAgent({ tokens: ['a'], delayMs: 1 })`

Then: `git mv libs/ag-ui/src/lib/testing/provide-fake-ag-ui-agent.spec.ts libs/ag-ui/src/lib/testing/provide-fake-agent.spec.ts`

- [ ] **Step 5: Rewrite the public-api.ts**

`libs/ag-ui/src/public-api.ts`:

```ts
// SPDX-License-Identifier: MIT
export { toAgent } from './lib/to-agent';
export type { ToAgentOptions } from './lib/to-agent';
export { provideAgent, injectAgent } from './lib/provide-agent';
export type { AgentConfig } from './lib/provide-agent';
export { FakeAgent } from './lib/testing/fake-agent';
export { provideFakeAgent } from './lib/testing/provide-fake-agent';
export type { FakeAgentConfig } from './lib/testing/provide-fake-agent';

// Citation state bridge
export { bridgeCitationsState } from './lib/bridge-citations-state';
```

Note: `AGENT` is intentionally NOT exported.

- [ ] **Step 6: Run the ag-ui suite**

Run: `npx nx test ag-ui`
Expected: PASS.

- [ ] **Step 7: Build ag-ui**

Run: `npx nx build ag-ui`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/ag-ui/
git commit -m "refactor(ag-ui): rename public API to provideAgent/injectAgent/AgentConfig"
```

### Task A4: Update package.json metadata and bump versions

**Files:**
- Modify: `libs/langgraph/package.json`
- Modify: `libs/ag-ui/package.json`

Both packages currently lack `description` and `keywords` fields. Add them, and bump `version` from `0.0.47` to `0.0.48` (patch-only per `feedback_patch_only_releases.md` in memory).

- [ ] **Step 1: Edit `libs/langgraph/package.json`**

After the `"name"` field, add `"description"` and `"keywords"`. Update `"version"`:

```json
{
  "name": "@threadplane/langgraph",
  "version": "0.0.48",
  "description": "LangGraph adapter for @threadplane/chat — Angular bindings for LangGraph Platform.",
  "keywords": ["angular", "langgraph", "langchain", "agent", "adapter", "threadplane"],
  "peerDependencies": { ...unchanged... },
  ...
}
```

- [ ] **Step 2: Edit `libs/ag-ui/package.json`**

```json
{
  "name": "@threadplane/ag-ui",
  "version": "0.0.48",
  "description": "AG-UI protocol adapter for @threadplane/chat — works with any AG-UI-compatible backend.",
  "keywords": ["angular", "ag-ui", "agent", "adapter", "threadplane"],
  "peerDependencies": { ...unchanged... },
  ...
}
```

- [ ] **Step 3: Verify both libs still build with new metadata**

Run: `npx nx run-many -t build --projects=langgraph,ag-ui`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/package.json libs/ag-ui/package.json
git commit -m "chore: add descriptions and keywords; bump langgraph + ag-ui to 0.0.48"
```

### Task A5: Update lib READMEs to use new symmetric API

**Files:**
- Modify: `libs/langgraph/README.md`
- Modify: `libs/ag-ui/README.md`

The READMEs are the npm landing pages. Both must use the new symmetric API in their quick-start blocks. Each must also include a one-line cross-reference to the sibling adapter (the full comparison page lands in Phase D).

- [ ] **Step 1: Read each README to understand the current quick-start shape**

Use Read on `libs/langgraph/README.md` and `libs/ag-ui/README.md`.

- [ ] **Step 2: Update `libs/langgraph/README.md` quick-start**

Replace the quick-start code block with the symmetric form:

````markdown
## Install

```bash
npm install @threadplane/langgraph @threadplane/chat
```

## Quick start

```ts
import { provideAgent, injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-langgraph-deployment',
      assistantId: 'your-graph-name',
    }),
  ],
};

// component
@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class App {
  protected readonly agent = injectAgent();
}
```

> Talking to a non-LangGraph backend? See [`@threadplane/ag-ui`](https://www.npmjs.com/package/@threadplane/ag-ui) — same API shape, AG-UI protocol underneath.
````

- [ ] **Step 3: Update `libs/ag-ui/README.md` quick-start**

Replace the existing quick-start code block (which uses `provideAgUiAgent` / `AG_UI_AGENT`) with the symmetric form:

````markdown
## Install

```bash
npm install @threadplane/ag-ui @threadplane/chat @ag-ui/client
```

## Quick start

```ts
import { provideAgent, injectAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: 'https://your.agent.endpoint' })],
};

// component
@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class App {
  protected readonly agent = injectAgent();
}
```

> Talking to LangGraph Platform directly? See [`@threadplane/langgraph`](https://www.npmjs.com/package/@threadplane/langgraph) — same API shape, LangGraph SDK underneath.
````

Leave the rest of each README (Citations sections, etc.) intact for now. The "Choosing an adapter" page link will be added in Phase D Task D5.

- [ ] **Step 4: Commit**

```bash
git add libs/langgraph/README.md libs/ag-ui/README.md
git commit -m "docs(libs): use symmetric provideAgent/injectAgent API in lib READMEs"
```

### Task A6: Phase A verification gate

- [ ] **Step 1: Run full affected suite**

Run: `npx nx run-many -t lint test build --projects=langgraph,ag-ui`
Expected: all green.

- [ ] **Step 2: Confirm no residual `provideAgUiAgent` / `injectAgUiAgent` / `AG_UI_AGENT` / `AgUiAgentConfig` / `provideFakeAgUiAgent` / `FakeAgUiAgentConfig` symbols remain inside `libs/ag-ui/`**

Run: `git grep -nE "provideAgUiAgent|injectAgUiAgent|AG_UI_AGENT|AgUiAgentConfig|provideFakeAgUiAgent|FakeAgUiAgentConfig" -- libs/ag-ui/`
Expected: empty output. (If non-empty: report which file:line was missed and fix it in a follow-up commit.)

- [ ] **Step 3: Confirm `agent` and `AGENT_CONFIG` are no longer exported from langgraph's public-api**

Run: `git grep -nE "^export.*\\b(agent|AGENT_CONFIG)\\b" -- libs/langgraph/src/public-api.ts`
Expected: empty output (the `agent` function and `AGENT_CONFIG` token are gone from the export list).

- [ ] **Step 4: Open the Phase A PR**

The PR description should include:
- The verification commands above with their pass output
- A note that consumers of `@threadplane/langgraph` and `@threadplane/ag-ui` must update imports (no deprecated aliases ship; this is intentional at 0.0.x per `feedback_patch_only_releases.md`)

---

## Phase B — Website content + route rename

**Outcome:** The MDX content tree moves from `apps/website/content/docs/agent/` to `apps/website/content/docs/langgraph/`. The `LibraryId` union, `docsConfig` entry, content-folder lookup map, and `llms-full.txt` import path are updated. The `agent()` API page entry is replaced by `injectAgent()` and the existing `provide-agent` page entry's content is updated. The dynamic `[library]` route now serves `/docs/langgraph/*`.

**PR scope:** `apps/website/content/docs/`, `apps/website/src/lib/docs-config.ts`, `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, `apps/website/src/app/llms-full.txt/route.ts`, and MDX file content within the moved tree.

### Task B1: Move the content directory

**Files:**
- Move: `apps/website/content/docs/agent/` → `apps/website/content/docs/langgraph/`

- [ ] **Step 1: Confirm current contents**

Run: `ls apps/website/content/docs/agent/`
Expected: section directories (getting-started, guides, concepts, api).

- [ ] **Step 2: Move the directory using git mv**

Run: `git mv apps/website/content/docs/agent apps/website/content/docs/langgraph`
Expected: no error; git tracks the rename so history is preserved.

- [ ] **Step 3: Confirm move**

Run: `ls apps/website/content/docs/langgraph/`
Expected: same section subdirectories as before.
Run: `ls apps/website/content/docs/agent/` (should fail)
Expected: "No such file or directory."

- [ ] **Step 4: Do NOT commit yet** — the website will fail to build until Task B2 updates `docs-config.ts` and the content-folder map. Commit after Task B2.

### Task B2: Update `docs-config.ts` and the content-folder lookup map

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`

- [ ] **Step 1: Update the `LibraryId` union and the `docsConfig` entry**

In `apps/website/src/lib/docs-config.ts`:

- Line 2: change union member `'agent'` → `'langgraph'`
- Line 32 area: in the `docsConfig` array, change the entry's `id: 'agent'` → `id: 'langgraph'`; `title: 'Agent'` → `title: 'LangGraph'`; `description` text → `'LangChain/LangGraph adapter for Angular UI'`
- Line 79 area: in the API section's pages list, replace `{ title: 'agent()', slug: 'agent', section: 'api' }` with `{ title: 'injectAgent()', slug: 'inject-agent', section: 'api' }`. Verify that the existing `provideAgent()` entry already exists; if not present, add `{ title: 'provideAgent()', slug: 'provide-agent', section: 'api' }`.

Use Read first to confirm exact line numbers, then Edit each occurrence individually. **Do NOT use `replace_all`.**

- [ ] **Step 2: Update the content-folder lookup map**

In `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`, around line 29-30, change the entry `'agent': 'agent'` → `'langgraph': 'langgraph'`. (Use Read to confirm exact form; the map maps library IDs to content folder names.)

- [ ] **Step 3: Rename or create the MDX file for the new `inject-agent` API page**

Inside `apps/website/content/docs/langgraph/api/`, the `agent` slug previously pointed to an MDX file describing the `agent()` factory. We need an `inject-agent.mdx` instead.

  - If an `agent.mdx` exists in that directory, `git mv agent.mdx inject-agent.mdx` and rewrite its body to describe `injectAgent()` using the new API (one-liner: `const agent = injectAgent();` in a component).
  - Replace any references to `agent()` with `injectAgent()` in this MDX file.
  - Replace any references to `AGENT_CONFIG` with a sentence explaining that the token is internal and consumers configure via `provideAgent({...})` instead.

- [ ] **Step 4: Update the `provide-agent.mdx` content if it references the removed `agent()` factory or `AGENT_CONFIG`**

Read `apps/website/content/docs/langgraph/api/provide-agent.mdx` (assuming this slug exists in docs-config), find any references to `agent()` factory or `AGENT_CONFIG`, and rewrite to use `injectAgent()`.

- [ ] **Step 5: Update `llms-full.txt/route.ts` import path**

In `apps/website/src/app/llms-full.txt/route.ts:5`:

```ts
// OLD
import agentApiDocs from '../../../content/docs/agent/api/api-docs.json';
// NEW
import langgraphApiDocs from '../../../content/docs/langgraph/api/api-docs.json';
```

Rename any downstream usages of `agentApiDocs` to `langgraphApiDocs` within the same file (use Read to find them; do NOT use `replace_all`).

- [ ] **Step 6: Build the website and confirm `/docs/langgraph/*` resolves**

Run: `npx nx build website`
Expected: PASS, no broken-import errors.

- [ ] **Step 7: Run the website docs route tests**

Run: `npx nx test website -- --test-file=docs.spec.ts`
Expected: most tests will FAIL because they reference `'agent'` as the library id. These are fixed in Task C5 — for now, note the failures in the commit message.

- [ ] **Step 8: Commit Tasks B1 + B2 together**

```bash
git add apps/website/content/docs/ apps/website/src/lib/docs-config.ts apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx apps/website/src/app/llms-full.txt/route.ts
git commit -m "feat(website): move docs/agent → docs/langgraph; update routing config"
```

### Task B3: Sweep moved MDX content for API references

**Files:**
- Modify: every MDX file under `apps/website/content/docs/langgraph/` that references `agent()`, `AGENT_CONFIG`, `provideAgUiAgent`, `injectAgUiAgent`, `AG_UI_AGENT`, or `AgUiAgentConfig`.

- [ ] **Step 1: Find every MDX file with stale API references**

Run: `git grep -nl -E "\bagent\(\)|AGENT_CONFIG|provideAgUiAgent|injectAgUiAgent|AG_UI_AGENT|AgUiAgentConfig" -- 'apps/website/content/docs/langgraph/**.mdx'`

For each file in the output, read the file, then edit each occurrence manually:

| Pattern | Replacement |
|---|---|
| `agent()` (as the langgraph factory) | `injectAgent()` |
| `import { agent } from '@threadplane/langgraph'` | `import { injectAgent } from '@threadplane/langgraph'` |
| `AGENT_CONFIG` (as a token consumers use) | Rewrite the surrounding prose — `AGENT_CONFIG` is now internal; consumers configure via `provideAgent({...})` |
| `provideAgUiAgent` | `provideAgent` |
| `injectAgUiAgent` | `injectAgent` |
| `AG_UI_AGENT` | `AGENT` (and note in surrounding prose that it's an internal token; consumers use `injectAgent()`) |
| `AgUiAgentConfig` | `AgentConfig` |

**Do NOT use `replace_all`** — substring overlap with `AgentLifecycle`, `AgentOptions`, etc.

- [ ] **Step 2: Build to confirm MDX still parses**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/langgraph/
git commit -m "docs(website): update MDX content to use new symmetric API"
```

### Task B4: Phase B verification gate

- [ ] **Step 1: Confirm no MDX content still references the removed/old API symbols**

Run: `git grep -nE "provideAgUiAgent|injectAgUiAgent|AG_UI_AGENT|AgUiAgentConfig|provideFakeAgUiAgent" -- 'apps/website/content/'`
Expected: empty.

- [ ] **Step 2: Confirm no MDX content still references the old `agent()` factory**

Run: `git grep -nE "\\bagent\\(\\)" -- 'apps/website/content/docs/langgraph/'`
Expected: empty (or only prose like "the agent runtime" not `agent()` with parens).

- [ ] **Step 3: Confirm no leftover `content/docs/agent/` references in code**

Run: `git grep -n "content/docs/agent" -- 'apps/website/'`
Expected: empty.

- [ ] **Step 4: Open the Phase B PR**

---

## Phase C — Link references, telemetry, and landing-page CTAs

**Outcome:** Every `/docs/agent/*` href across the website becomes `/docs/langgraph/*`. The library-id string `'agent'` in telemetry allow-lists, the blog `library` prop, and the `analytics/events.ts` type union becomes `'langgraph'`. The `LangGraphCodeShowcase` component and other landing prose that show the `agent()` factory in code snippets are updated to use `injectAgent()`. The two test files that hard-code library IDs (`docs.spec.ts`, `site-metadata.spec.ts`) are updated. Hard-coded code examples in `llms.txt/route.ts` are updated. The `positioning.ts` library defaults are updated.

**PR scope:** `apps/website/src/**` only. No changes to `apps/website/content/`.

### Task C1: Update all `/docs/agent/*` hrefs to `/docs/langgraph/*`

**Files (all under `apps/website/src/`):**
- `app/page.tsx:51, 114`
- `app/langgraph/page.tsx:57, 85, 137`
- `app/ag-ui/page.tsx:57, 123`
- `app/pilot-to-prod/page.tsx:168`
- `app/docs/page.tsx:28, 38`
- `components/shared/Footer.tsx:173, 174`
- `components/docs/mdx/FeatureChips.tsx:13-20` (8 hrefs)
- `components/landing/HomeFAQ.tsx:46`
- `lib/positioning.ts:12-16` (5 hrefs)

- [ ] **Step 1: For each file in the list, find the exact hrefs and update them**

For each file, run Read to confirm the line, then Edit per occurrence. Pattern: replace `/docs/agent/` with `/docs/langgraph/`. **Verify each replacement individually** — there are multiple hrefs per file in some cases.

- [ ] **Step 2: Run the website build**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 3: Confirm zero `/docs/agent/` hrefs remain in src**

Run: `git grep -n "/docs/agent/" -- 'apps/website/src/'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app apps/website/src/components apps/website/src/lib/positioning.ts
git commit -m "chore(website): update /docs/agent/* hrefs to /docs/langgraph/*"
```

### Task C2: Update telemetry library-id slugs

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx:63, 255`
- Modify: `apps/website/src/components/docs/DocsSearch.tsx:68`
- Modify: `apps/website/src/app/blog/[slug]/page.tsx:99`
- Modify: `apps/website/src/lib/analytics/events.ts:85`

These are the places PostHog event payloads carry `library: 'agent'` or `library="agent"`. We rename to `'langgraph'` and accept the time-series seam in PostHog.

- [ ] **Step 1: Update `apps/website/src/components/shared/Nav.tsx`**

Read the file, then make two edits:
- Line 63: `const [mobileLibrary, setMobileLibrary] = useState(activeLibrary || 'agent');` — change default `'agent'` → `'langgraph'`
- Line 255: `library: currentLib.id === 'agent' || currentLib.id === 'render' || currentLib.id === 'chat' ? currentLib.id : 'unknown',` — change `'agent'` → `'langgraph'`

- [ ] **Step 2: Update `apps/website/src/components/docs/DocsSearch.tsx:68`**

`library: page.library === 'agent' || page.library === 'render' || page.library === 'chat' ? page.library : 'unknown',` — change `'agent'` → `'langgraph'`

- [ ] **Step 3: Update `apps/website/src/app/blog/[slug]/page.tsx:99`**

`library="agent"` → `library="langgraph"`

- [ ] **Step 4: Update `apps/website/src/lib/analytics/events.ts:85`**

The type union currently includes `'agent'` — change it to `'langgraph'`. Use Read to see the exact union, then Edit to swap that one member (do NOT use `replace_all`).

- [ ] **Step 5: Run the website tests**

Run: `npx nx test website`
Expected: docs.spec.ts and site-metadata.spec.ts still fail (Task C3 fixes them); other tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx apps/website/src/components/docs/DocsSearch.tsx apps/website/src/app/blog/[slug]/page.tsx apps/website/src/lib/analytics/events.ts
git commit -m "chore(website): rename telemetry library slug 'agent' → 'langgraph'"
```

### Task C3: Update test files that hard-code the `'agent'` library id

**Files:**
- Modify: `apps/website/src/lib/docs.spec.ts:43, 44, 69, 169, 182, 190`
- Modify: `apps/website/src/lib/site-metadata.spec.ts:28-32`

- [ ] **Step 1: Update `apps/website/src/lib/docs.spec.ts`**

Read the file. For each line listed (43, 44, 69, 169, 182, 190), find the `'agent'` literal and change to `'langgraph'`. Some are arguments to `getDocBySlug('agent', ...)`; some are object literals with `library: 'agent'`; one is membership in a `librariesWithApiDocs` array. Edit each individually.

- [ ] **Step 2: Update `apps/website/src/lib/site-metadata.spec.ts`**

Read the file. Replace each `'/docs/agent/...'` path literal in lines 28-32 with `'/docs/langgraph/...'` (preserving the section/slug parts).

- [ ] **Step 3: Run the affected tests**

Run: `npx nx test website -- --test-file=docs.spec.ts site-metadata.spec.ts`
Expected: PASS.

- [ ] **Step 4: Run the full website test suite**

Run: `npx nx test website`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/docs.spec.ts apps/website/src/lib/site-metadata.spec.ts
git commit -m "test(website): update library-id assertions from 'agent' to 'langgraph'"
```

### Task C4: Update landing-page prose and code-snippet components

**Files:**
- Modify: `apps/website/src/app/langgraph/page.tsx:73, 76, 112` (body text + component usage referencing `agent()`)
- Modify: `apps/website/src/app/page.tsx:37` (homepage explanation of `agent()`)
- Modify: `apps/website/src/app/ag-ui/page.tsx:111, 113, 119, 120, 138, 144, 156` (mentions of `provideAgUiAgent` / `AG_UI_AGENT` in prose + code snippet)
- Modify: `apps/website/src/components/landing/Differentiator.tsx:29, 34` (primitives comparison referencing `agent()`)
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx:14, 38` (FAQ answer mentioning `provideAgUiAgent`; migration discussion mentioning `agent()`)
- Modify: `apps/website/src/components/landing/langgraph/LangGraphCodeShowcase.tsx:16, 18` (code snippet importing `agent` from langgraph)
- Modify: `apps/website/src/components/docs/ArchFlowDiagram.tsx:97` (architecture diagram label `agent()`)

For each file: read it, find the references, rewrite them to use the new API. The `LangGraphCodeShowcase` component will most likely change from:

```ts
import { agent } from '@threadplane/langgraph';
// ...
protected readonly agent = agent();
```

to:

```ts
import { injectAgent } from '@threadplane/langgraph';
// ...
protected readonly agent = injectAgent();
```

The ag-ui page's code snippet at lines 138/144/156 changes from `provideAgUiAgent({ url })` / `AG_UI_AGENT` / `inject(AG_UI_AGENT)` to `provideAgent({ url })` / `injectAgent()`.

The prose in `Differentiator.tsx`, `HomeFAQ.tsx`, and `ArchFlowDiagram.tsx` mentioning `agent()` is updated to say `injectAgent()` (or rephrased as "the LangGraph adapter").

- [ ] **Step 1: Update each file in the list**

For each file: Read, identify each line in the list, then Edit per occurrence. **Do NOT use `replace_all`.**

- [ ] **Step 2: Confirm build**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app apps/website/src/components
git commit -m "docs(website): update landing prose and code snippets to symmetric API"
```

### Task C5: Update hard-coded code examples in `llms.txt/route.ts`

**Files:**
- Modify: `apps/website/src/app/llms.txt/route.ts:39, 53, 55, 56, 57`

This file emits AI-assistant-readable summaries. It contains hard-coded code-example strings using the old API.

- [ ] **Step 1: Read the route**

Use Read on `apps/website/src/app/llms.txt/route.ts`.

- [ ] **Step 2: Update the hard-coded code examples**

In lines around 39 (langgraph example) and 53-57 (ag-ui example):
- Replace `'import { agent } from \'@threadplane/langgraph\';'` with `'import { injectAgent } from \'@threadplane/langgraph\';'`
- Replace `'agent()'` usages in code-template strings with `'injectAgent()'`
- Replace `"import { provideAgUiAgent, AG_UI_AGENT } from '@threadplane/ag-ui';"` with `"import { provideAgent, injectAgent } from '@threadplane/ag-ui';"`
- Replace `provideAgUiAgent({ url: 'https://your.endpoint' })` with `provideAgent({ url: 'https://your.endpoint' })`
- Replace `agent = inject(AG_UI_AGENT)` with `agent = injectAgent()`

Also update the description prose around line 39 if it mentions "the `agent` library" — say "the `@threadplane/langgraph` adapter" instead.

- [ ] **Step 3: Confirm output via curl-style test**

Run: `npx nx serve website` (background)
Then in another terminal: `curl -s http://localhost:3000/llms.txt | grep -E "agent\(\)|provideAgUiAgent|AG_UI_AGENT|AgUiAgentConfig"`
Expected: empty (no stale API strings emitted).

Stop the dev server when done: kill the `nx serve` process.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/llms.txt/route.ts
git commit -m "docs(website): update llms.txt code examples to symmetric API"
```

### Task C6: Phase C verification gate

- [ ] **Step 1: Confirm zero residuals in website src**

Run: `git grep -nE "/docs/agent/|'agent' \\?\\? null|library:.*'agent'|library=\"agent\"|provideAgUiAgent|injectAgUiAgent|AG_UI_AGENT|AgUiAgentConfig" -- 'apps/website/src/'`
Expected: empty (or only legitimate prose).

- [ ] **Step 2: Full website build + tests**

Run: `npx nx run-many -t lint test build --projects=website`
Expected: all green.

- [ ] **Step 3: Manual smoke test against running dev server**

Run: `npx nx serve website` (background)

Visit each URL and confirm it renders without 404 or console error:
- `http://localhost:3000/docs` (landing — library card links should target `/docs/langgraph/...`)
- `http://localhost:3000/docs/langgraph/getting-started/introduction`
- `http://localhost:3000/docs/langgraph/api/inject-agent`
- `http://localhost:3000/docs/langgraph/api/provide-agent`
- `http://localhost:3000/langgraph` (langgraph landing — CTAs target `/docs/langgraph/*`)
- `http://localhost:3000/ag-ui` (ag-ui landing — code snippet uses `provideAgent` / `injectAgent`)

And confirm the old URL is gone:
- `curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/docs/agent/getting-started/introduction`
Expected: `404`.

Stop the dev server.

- [ ] **Step 4: Open the Phase C PR**

---

## Phase D — "Choosing an adapter" page + getting-started polish

**Outcome:** A new top-level docs page at `/docs/choosing-an-adapter` lays out the LangGraph vs AG-UI decision with a matrix, side-by-side code comparison, and a note on the rare mixed-adapter case. The page is cross-linked from `/docs` popular topics, `/langgraph` and `/ag-ui` landings, both lib READMEs, and a new `HomeFAQ` entry.

**PR scope:** `apps/website/content/docs/choosing-an-adapter/`, a new `apps/website/src/app/docs/choosing-an-adapter/page.tsx`, plus link insertions in five existing files.

### Task D1: Create the comparison MDX content

**Files:**
- Create: `apps/website/content/docs/choosing-an-adapter/index.mdx`

- [ ] **Step 1: Write the MDX**

Create `apps/website/content/docs/choosing-an-adapter/index.mdx`:

````markdown
---
title: Choosing an adapter
description: Decide between @threadplane/langgraph and @threadplane/ag-ui for your Angular agent UI.
---

# Choosing an adapter

Threadplane ships two adapters that connect a backend agent runtime to `<chat>` in `@threadplane/chat`. Both produce the same runtime-neutral `Agent` contract; pick one based on what your backend speaks.

## At a glance

| If your backend is... | Use |
|---|---|
| **LangGraph Platform** (cloud or self-hosted, via the LangGraph SDK) | `@threadplane/langgraph` |
| **Any AG-UI-protocol backend** — CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime, or LangGraph fronted by AG-UI | `@threadplane/ag-ui` |

## Code comparison

The two adapters share the same public surface — `provideAgent`, `injectAgent`, `AgentConfig`. Swapping is a one-line import change.

### LangGraph adapter

```ts
import { provideAgent, injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-langgraph-deployment',
      assistantId: 'your-graph-name',
    }),
  ],
};

// component
@Component({ imports: [ChatComponent], template: `<chat [agent]="agent" />` })
export class App {
  protected readonly agent = injectAgent();
}
```

### AG-UI adapter

```ts
import { provideAgent, injectAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: 'https://your.agent.endpoint' })],
};

// component
@Component({ imports: [ChatComponent], template: `<chat [agent]="agent" />` })
export class App {
  protected readonly agent = injectAgent();
}
```

The component body is byte-identical. The only thing that changes is the import path and the config shape passed to `provideAgent()`.

## What about both?

Mixing both adapters in one app is unusual — most apps talk to one backend. If you genuinely need both, use TypeScript import renaming:

```ts
import { provideAgent as provideLangGraphAgent } from '@threadplane/langgraph';
import { provideAgent as provideAgUiAgent } from '@threadplane/ag-ui';
```

Note that each adapter uses its own private DI token internally, so providing both does not cause a runtime DI collision — but the developer ergonomics get awkward, and `<chat [agent]="agent" />` can only bind one Agent at a time. We recommend picking one adapter per app.

## Why two adapters?

The `Agent` contract from `@threadplane/chat` is intentionally runtime-neutral. The two adapters exist because they bridge different on-the-wire protocols into that contract:

- `@threadplane/langgraph` talks to the LangGraph SDK directly. You get LangGraph-specific features (thread state, branching, multitask strategies) typed end-to-end.
- `@threadplane/ag-ui` consumes the AG-UI event protocol. Any backend that emits AG-UI events plugs in, regardless of what graph engine sits behind it.

Both adapters are MIT-licensed and live in the same monorepo.
````

- [ ] **Step 2: No commit yet** — the route needs to exist (Task D2) before this MDX is reachable. Commit after Task D2.

### Task D2: Add the static route at `/docs/choosing-an-adapter`

**Files:**
- Create: `apps/website/src/app/docs/choosing-an-adapter/page.tsx`

- [ ] **Step 1: Read an existing top-level docs route to copy its MDX-loading pattern**

Use Read on `apps/website/src/app/docs/licensing/page.tsx` (the licensing route is also a one-off page, so it's the closest pattern).

- [ ] **Step 2: Create `apps/website/src/app/docs/choosing-an-adapter/page.tsx`**

Mirror the licensing route's structure. Specifically:
- Import the MDX content from `content/docs/choosing-an-adapter/index.mdx`
- Wrap it in the same docs-page layout (`Container`, `Section`, etc.)
- Add page metadata via `createPageMetadata({ title: 'Choosing an adapter — Threadplane', description: 'Decide between @threadplane/langgraph and @threadplane/ag-ui.', pathname: '/docs/choosing-an-adapter', type: 'website' })`

Use the licensing page as the reference template — copy its structure and substitute the MDX import and metadata. If the licensing route's MDX-loading pattern differs from what the dynamic `[library]` route does, prefer the licensing pattern (single-page, no library wrapper).

- [ ] **Step 3: Build to confirm the route resolves**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

Run: `npx nx serve website` (background)
Then: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs/choosing-an-adapter`
Expected: `200`.
Visit in a browser to confirm the page renders with the expected sections (At a glance, Code comparison, What about both?, Why two adapters?).

Stop the dev server.

- [ ] **Step 5: Commit Tasks D1 + D2 together**

```bash
git add apps/website/content/docs/choosing-an-adapter/ apps/website/src/app/docs/choosing-an-adapter/
git commit -m "feat(website): add /docs/choosing-an-adapter comparison page"
```

### Task D3: Cross-link the new page from docs landing + lib landings + HomeFAQ

**Files:**
- Modify: `apps/website/src/app/docs/page.tsx`
- Modify: `apps/website/src/app/langgraph/page.tsx`
- Modify: `apps/website/src/app/ag-ui/page.tsx`
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`

- [ ] **Step 1: Add to the docs-landing "Popular topics"**

In `apps/website/src/app/docs/page.tsx`, find the `POPULAR_TOPICS` array (currently three entries). Add a fourth entry:

```ts
{
  title: 'Choosing an adapter',
  description: 'LangGraph or AG-UI? A side-by-side decision guide for picking between the two Threadplane adapters.',
  href: '/docs/choosing-an-adapter',
},
```

- [ ] **Step 2: Add a CTA section to the langgraph landing**

In `apps/website/src/app/langgraph/page.tsx`, find the existing CTA section near the bottom of the page (look for an existing card or CTA block). Add a new card/CTA pointing to `/docs/choosing-an-adapter` with copy along the lines of: "Not sure if `@threadplane/langgraph` is right for your backend? See **Choosing an adapter**."

- [ ] **Step 3: Add the same CTA to the ag-ui landing**

In `apps/website/src/app/ag-ui/page.tsx`, mirror Step 2: add a CTA pointing to `/docs/choosing-an-adapter`. Copy: "Talking to LangGraph Platform directly? See **Choosing an adapter**."

- [ ] **Step 4: Add a new HomeFAQ entry**

In `apps/website/src/components/landing/HomeFAQ.tsx`, add a new Q/A entry:

```ts
{
  q: 'Which adapter should I use — @threadplane/langgraph or @threadplane/ag-ui?',
  a: 'If your backend is LangGraph Platform, use @threadplane/langgraph. If your backend speaks the AG-UI protocol (CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime), use @threadplane/ag-ui. Both expose the same provideAgent/injectAgent API — see /docs/choosing-an-adapter for a side-by-side comparison.',
},
```

Insert it in a sensible position in the FAQ list (after the high-level "what is this" questions, before the implementation-detail questions).

- [ ] **Step 5: Build to verify**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app/docs/page.tsx apps/website/src/app/langgraph/page.tsx apps/website/src/app/ag-ui/page.tsx apps/website/src/components/landing/HomeFAQ.tsx
git commit -m "docs(website): cross-link choosing-an-adapter page from landing + FAQ"
```

### Task D4: Update the lib READMEs to link to the new comparison page

**Files:**
- Modify: `libs/langgraph/README.md`
- Modify: `libs/ag-ui/README.md`

- [ ] **Step 1: In `libs/langgraph/README.md`**, find the cross-reference paragraph added in Phase A Task A5 ("Talking to a non-LangGraph backend? See...") and append a link to the comparison page on the Threadplane website. Final paragraph reads:

> Talking to a non-LangGraph backend? See [`@threadplane/ag-ui`](https://www.npmjs.com/package/@threadplane/ag-ui) — same API shape, AG-UI protocol underneath. Full comparison: [Choosing an adapter](https://threadplane.dev/docs/choosing-an-adapter).

- [ ] **Step 2: In `libs/ag-ui/README.md`**, do the same:

> Talking to LangGraph Platform directly? See [`@threadplane/langgraph`](https://www.npmjs.com/package/@threadplane/langgraph) — same API shape, LangGraph SDK underneath. Full comparison: [Choosing an adapter](https://threadplane.dev/docs/choosing-an-adapter).

(The threadplane.dev URL may be wrong — use whatever the canonical website URL is. Check `apps/website/src/lib/site-metadata.ts` or similar for the canonical host if uncertain.)

- [ ] **Step 3: Commit**

```bash
git add libs/langgraph/README.md libs/ag-ui/README.md
git commit -m "docs(libs): link READMEs to Choosing an adapter page"
```

### Task D5: Polish getting-started MDX to surface the adapter choice up front

**Files:**
- Modify: `apps/website/content/docs/langgraph/getting-started/introduction.mdx`
- (No ag-ui equivalent yet — ag-ui docs were not in scope of the original `agent` library content tree. If a `content/docs/ag-ui/` tree exists, mirror this update there; otherwise skip.)

- [ ] **Step 1: Add an admonition at the top of `introduction.mdx`**

Insert near the top of the introduction MDX (after the frontmatter and the H1):

```mdx
> **Picking an adapter?** This guide covers `@threadplane/langgraph` — the LangGraph adapter. If your backend speaks AG-UI protocol instead, see [`@threadplane/ag-ui`](/ag-ui) or read [Choosing an adapter](/docs/choosing-an-adapter) for a side-by-side comparison.
```

- [ ] **Step 2: Check whether `content/docs/ag-ui/` exists**

Run: `ls apps/website/content/docs/ | grep ag-ui`
- If output is empty: skip this step (no ag-ui content tree to update).
- If output exists: read `content/docs/ag-ui/getting-started/introduction.mdx` and add the symmetric admonition pointing toward langgraph + Choosing an adapter.

- [ ] **Step 3: Build to verify MDX still parses**

Run: `npx nx build website`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/langgraph/getting-started/introduction.mdx
git commit -m "docs(website): surface adapter choice at top of getting-started"
```

### Task D6: Phase D verification gate

- [ ] **Step 1: Build + test website**

Run: `npx nx run-many -t lint test build --projects=website`
Expected: all green.

- [ ] **Step 2: Manual smoke**

Run: `npx nx serve website` (background)

Visit:
- `http://localhost:3000/docs/choosing-an-adapter` — page renders with all four sections
- `http://localhost:3000/docs` — fourth "Popular topics" card links to `/docs/choosing-an-adapter`
- `http://localhost:3000/langgraph` — CTA pointing to `/docs/choosing-an-adapter` is present
- `http://localhost:3000/ag-ui` — same
- `http://localhost:3000/` — scroll to the FAQ; the "Which adapter should I use" entry is present

Stop the dev server.

- [ ] **Step 3: Open the Phase D PR**

---

## Phase E — Sweep + final verification

**Outcome:** Five parallel `Explore` subagents sweep for residual stale references. Their punch-lists drive final cleanup commits. Examples consumer and cockpit prompts are updated to the new API. Final residual-grep gate passes.

**PR scope:** Whatever the sweep surfaces. Expected: `examples/chat/angular/**`, `cockpit/langgraph/**/*.md`, plus any one-off stragglers.

### Task E1: Dispatch the five sweep subagents in parallel

- [ ] **Step 1: Single message with five `Agent` calls in parallel**

Per `superpowers:dispatching-parallel-agents`, send one message containing exactly five `Agent` tool-use blocks, all with `subagent_type: "Explore"` and `run_in_background: false`. Each prompt is reproduced verbatim from the spec ([docs/superpowers/specs/2026-05-27-agent-to-langgraph-rename-design.md](../specs/2026-05-27-agent-to-langgraph-rename-design.md) Verification section). Briefly:

  - **Subagent 1 — Docs content sweep:** scope `apps/website/content/docs/**` + `docs/**` (excluding `docs/superpowers/`). Grep for `agent library`, `@threadplane/agent`, `@ngaf/agent`, `/docs/agent/`, `provideAgUiAgent`, `injectAgUiAgent`, `AG_UI_AGENT`, `AGENT_CONFIG`, `AgUiAgentConfig`, `provideFakeAgUiAgent`, `FakeAgUiAgentConfig`, and `agent()` factory examples that should now be `injectAgent()`. Report file:line. Do NOT edit.
  - **Subagent 2 — Website source sweep:** scope `apps/website/src/**`. Same patterns + `'agent'` as string literal, `library="agent"`, `library: 'agent'`. Report file:line. Do NOT edit.
  - **Subagent 3 — Library READMEs + root README + package.json sweep:** scope `libs/*/README.md`, `libs/*/package.json`, root `README.md`, root `package.json`. Grep for stale library names, `agent()` factory references, old `@ngaf/*` scope mentions, and confirm descriptions name LangGraph or AG-UI explicitly. Report file:line. Do NOT edit.
  - **Subagent 4 — Cockpit + examples + other apps sweep:** scope `cockpit/**`, `apps/**` (excluding `apps/website/`), and `examples/**`. Same patterns. Any consumer of `@threadplane/langgraph` or `@threadplane/ag-ui` using removed exports needs flagging. Report file:line. Do NOT edit.
  - **Subagent 5 — llms.txt sweep:** scope `apps/website/src/app/llms.txt/route.ts`, `apps/website/src/app/llms-full.txt/route.ts`, and any imported content. Confirm the assembled output uses the new library names and API. Report exact paragraphs to edit. Do NOT edit.

- [ ] **Step 2: Aggregate the five reports**

Collect all file:line citations from the subagent responses into a single punch list ordered by file path. Eliminate duplicates.

### Task E2: Land cleanup commits driven by the punch list

For each file in the punch list, work through the planned change.

- [ ] **Step 1: For each file in the punch list, read, edit per occurrence, save**

Apply the same per-occurrence Edit pattern (no `replace_all` for the substring-prone identifiers). Group commits by area:

  - Commit 1: `examples/chat/angular/**` — update `agent` import from `@threadplane/langgraph` to `injectAgent`; update `provideAgent` config shape if needed
  - Commit 2: `cockpit/langgraph/**/*.md` — update prompt + guide files to use `injectAgent()` in place of `agent()` factory examples
  - Commit 3: any other strays surfaced by the sweep (root README updates, etc.)

Use these commit-message patterns:
```bash
git commit -m "chore(examples): update chat/angular to symmetric langgraph API"
git commit -m "docs(cockpit): update prompts and guides to injectAgent()"
git commit -m "chore: final stale-reference cleanup from rename sweep"
```

- [ ] **Step 2: Run the examples-chat suite to confirm the consumer change works**

Run: `npx nx test examples-chat`
Expected: PASS.

(If `examples-chat` isn't the right Nx project name, check `apps/examples-chat/project.json` or `nx show projects | grep example`. The intent is: run whatever test target covers the `examples/chat/angular` consumer.)

### Task E3: Final residual-grep gate

- [ ] **Step 1: Repo-wide stale-reference grep**

Run: `git grep -nE "/docs/agent/|@ngaf/agent|@threadplane/agent|provideAgUiAgent|injectAgUiAgent|AG_UI_AGENT|AgUiAgentConfig|provideFakeAgUiAgent|FakeAgUiAgentConfig|AGENT_CONFIG" -- ':!docs/superpowers'`
Expected: empty.

If non-empty: the sweep missed something. Add a follow-up commit for each remaining occurrence.

- [ ] **Step 2: Repo-wide `agent()` factory-reference grep (best-effort, may produce prose hits)**

Run: `git grep -nE "\\bagent\\(\\)" -- ':!docs/superpowers' 'apps/website/' 'libs/' 'cockpit/' 'examples/'`
Expected: each hit should be either (a) a deliberate doc example that's still valid (review case-by-case), or (b) a real usage that should have been migrated to `injectAgent()` (fix it).

- [ ] **Step 3: Run the full affected test+build matrix one more time**

Run: `npx nx run-many -t lint test build --projects=langgraph,ag-ui,website`
Expected: all green.

Also run any examples or cockpit projects that have test targets:
Run: `npx nx run-many -t test --all` (if reasonable) or run per affected project.

- [ ] **Step 4: Manual end-to-end smoke against `nx serve website`**

Visit the URLs from Phase D Task D6 plus:
- `/docs/langgraph/getting-started/introduction` — the admonition at the top renders
- `/docs/langgraph/api/inject-agent` — page renders with prose describing `injectAgent()`
- `/llms.txt` — examine output, confirm only the new API is mentioned
- `/llms-full.txt` — same

Stop the dev server.

- [ ] **Step 5: Open the Phase E PR with verification log in the description**

The PR description must include:
- The empty output of Step 1's grep
- A note on any `agent()` hits from Step 2 that were intentionally retained (with file:line)
- The pass output of Step 3's `nx run-many`
- A note for the next weekly GTM snapshot Notes section: "PostHog `library: 'agent'` events stopped firing on <date>; `library: 'langgraph'` events began on <date> — expected as part of the agent→langgraph rename."

---

## Verification matrix (final)

After all five phases ship:

| Check | Command / URL | Expected |
|---|---|---|
| Lib build clean | `npx nx run-many -t build --projects=langgraph,ag-ui` | PASS |
| Lib tests clean | `npx nx run-many -t test --projects=langgraph,ag-ui` | PASS |
| Website build clean | `npx nx build website` | PASS |
| Website tests clean | `npx nx test website` | PASS |
| Old route gone | `curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/docs/agent/getting-started/introduction` | `404` |
| New route lives | `curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/docs/langgraph/getting-started/introduction` | `200` |
| Comparison page lives | `curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/docs/choosing-an-adapter` | `200` |
| Public API symmetry — langgraph | `grep -E "provideAgent\|injectAgent\|AgentConfig" libs/langgraph/src/public-api.ts` | all three present |
| Public API symmetry — ag-ui | `grep -E "provideAgent\|injectAgent\|AgentConfig" libs/ag-ui/src/public-api.ts` | all three present |
| Removed exports — langgraph | `grep -E "^export.*\\b(agent\|AGENT_CONFIG)\\b" libs/langgraph/src/public-api.ts` | empty |
| Removed exports — ag-ui | `grep -E "AG_UI_AGENT\|provideAgUiAgent\|injectAgUiAgent\|AgUiAgentConfig\|provideFakeAgUiAgent\|FakeAgUiAgentConfig" libs/ag-ui/src/public-api.ts` | empty |
| Repo-wide residual sweep | `git grep -nE "/docs/agent/\|@ngaf/agent\|@threadplane/agent\|provideAgUiAgent\|injectAgUiAgent\|AG_UI_AGENT\|AgUiAgentConfig" -- ':!docs/superpowers'` | empty |

---

## Risk reminders

- **No `replace_all` for `provideAgent`, `injectAgent`, `AgentConfig`, `provideAgUiAgent`, `injectAgUiAgent`, `AG_UI_AGENT`, `AgUiAgentConfig`, `agent`, or any `Agent*` identifier.** Substring overlap with `AgentLifecycle`, `AgentOptions`, `AgentTransport`, `AgentBranchTree`, `AgentQueue`, etc. will clobber correct names. Always Read + per-occurrence Edit.
- **External `/docs/agent/*` links will 404 after Phase B merges.** Per the design, no redirects.
- **PostHog timeline shows a seam at the rename point** between `library: 'agent'` events stopping and `library: 'langgraph'` events starting. Note in the next weekly GTM snapshot.
- **Patch-only version bump.** Both libs go from `0.0.47` to `0.0.48`. Never bump to `0.1.0` — patch-only policy at 0.0.x per `feedback_patch_only_releases.md`.
- **Don't regenerate `package-lock.json`.** Per `feedback_lockfile_platform_bindings.md`, regeneration on macOS drops Linux `@next/swc-*` bindings and breaks CI. Edit the lockfile surgically only if needed (the version bumps for `@threadplane/langgraph` and `@threadplane/ag-ui` in their own `package.json` files don't require root-lockfile edits in an Nx workspace).
