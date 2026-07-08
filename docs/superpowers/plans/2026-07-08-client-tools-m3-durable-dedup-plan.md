# Client Tool Durable Dedup M3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Tier 1 backend-authoritative client-tool result dedup in `@threadplane/middleware/langgraph`, including an injectable store interface, in-memory implementation, Postgres implementation, and reload lookup helpers.

**Architecture:** Keep durable dedup in the backend middleware package. Graph authors wire the guard into their LangGraph node/route with a `threadId` and a `ClientToolExecutionStore`; browser packages remain unchanged. M3 records inbound client `ToolMessage` results by `toolCallId`, drops duplicate redeliveries before server continuation logic, and exposes lookup for reload reconciliation. Tier 2 claim-before-execute, `settle()`, batching, max-turns, and browser fallback markers stay out of scope.

**Tech Stack:** TypeScript, Vitest, LangChain message classes, Nx, `postgres`-style tagged SQL supplied by consumers, generated API docs.

---

## Source Of Truth

- Spec: `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` §7 and milestone M3.
- Store schema: nullable `tenant_id`, `thread_id`, `tool_call_id`, `status`, `result`, timestamps, first-ship PK `(thread_id, tool_call_id)`.
- No new browser dependencies. The Postgres helper accepts a supplied tagged SQL client; no new install is required in `@threadplane/chat`, `@threadplane/ag-ui`, or `@threadplane/langgraph`.
- M3 only: Tier 1 server guard and lookup. Do not implement Tier 2 pre-execution claims or fail-closed browser execution policy in this PR.

## File Structure

- Create: `libs/middleware/src/langgraph/client-tool-execution-store.ts`
  - `ClientToolResult`, key/status/record types.
  - `ClientToolExecutionStore` interface.
  - `createInMemoryClientToolExecutionStore()` default implementation for deterministic tests and non-persistent backends.
- Create: `libs/middleware/src/langgraph/client-tool-result-guard.ts`
  - Extract client `ToolMessage` results from LangGraph messages.
  - `recordClientToolResults()` records first-seen tool-call results and reports duplicates.
  - `filterDuplicateClientToolResultMessages()` returns messages with duplicate client-tool result redeliveries removed.
  - `lookupClientToolExecutions()` wraps store lookup for reload reconciliation.
- Create: `libs/middleware/src/langgraph/postgres-client-tool-execution-store.ts`
  - `THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA` SQL string.
  - `createPostgresClientToolExecutionStore(sql, opts?)` using a supplied `postgres`-style tagged client.
- Modify: `libs/middleware/src/langgraph/index.ts`
  - Export M3 public API from the existing `/langgraph` entrypoint.
- Modify: `libs/middleware/README.md`
  - Document Tier 1 guard wiring and Postgres store construction.
- Modify: `apps/website/content/docs/middleware/api/api-docs.json`
  - Regenerate after new public exports.
- Test: `libs/middleware/src/client-tool-execution-store.spec.ts`
- Test: `libs/middleware/src/client-tool-result-guard.spec.ts`
- Test: `libs/middleware/src/postgres-client-tool-execution-store.spec.ts`

---

### Task 1: Store Types And In-Memory Store

**Files:**
- Create: `libs/middleware/src/client-tool-execution-store.spec.ts`
- Create: `libs/middleware/src/langgraph/client-tool-execution-store.ts`
- Modify: `libs/middleware/src/langgraph/index.ts`

- [x] **Step 1: Write failing in-memory store tests**

Cover:
- `claim()` returns `'claimed'` for a new `(threadId, toolCallId)`.
- A second `claim()` returns `{ status: 'executing' }`.
- `record()` stores `{ status: 'done', result }`.
- A later `claim()` returns `{ status: 'done', result }`.
- `lookup()` returns only requested known records.
- The returned lookup object cannot mutate internal store state.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
npx vitest run src/client-tool-execution-store.spec.ts --config vite.config.mts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement minimal store**

Implement the interface and in-memory map. Use key format `${threadId}\0${toolCallId}` to avoid accidental collisions.

- [x] **Step 4: Run tests to verify green**

Run:

```bash
npx vitest run src/client-tool-execution-store.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 2: LangGraph ToolMessage Guard Helpers

**Files:**
- Create: `libs/middleware/src/client-tool-result-guard.spec.ts`
- Create: `libs/middleware/src/langgraph/client-tool-result-guard.ts`
- Modify: `libs/middleware/src/langgraph/index.ts`

- [x] **Step 1: Write failing extraction and record tests**

Cover:
- Extracts `tool_call_id` from a LangChain `ToolMessage`.
- Converts `"Error: boom"` content to `{ ok: false, error: 'boom' }`.
- Converts JSON object content to `{ ok: true, value: object }`.
- Converts plain text content to `{ ok: true, value: string }`.
- Ignores non-tool messages and tool messages without an id.
- `recordClientToolResults()` claims and records first-seen result ids.
- A second call with the same result reports the id in `duplicateToolCallIds` and does not overwrite the first stored result.
- `filterDuplicateClientToolResultMessages()` removes only duplicate tool-result messages and leaves non-duplicates in order.
- `lookupClientToolExecutions()` delegates to store lookup.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
npx vitest run src/client-tool-result-guard.spec.ts --config vite.config.mts
```

Expected: FAIL because the guard module does not exist.

- [x] **Step 3: Implement guard helpers**

Implement helper signatures:

```ts
recordClientToolResults(input: {
  threadId: string;
  messages: readonly BaseMessage[];
  store: ClientToolExecutionStore;
}): Promise<{
  recordedToolCallIds: string[];
  duplicateToolCallIds: string[];
}>;

filterDuplicateClientToolResultMessages(input: {
  messages: readonly BaseMessage[];
  duplicateToolCallIds: ReadonlySet<string>;
}): BaseMessage[];

lookupClientToolExecutions(input: {
  threadId: string;
  toolCallIds: readonly string[];
  store: ClientToolExecutionStore;
}): Promise<Record<string, ClientToolExecutionRecord>>;
```

Keep this middleware-only. Do not change browser adapter pending or resolve behavior in M3.

- [x] **Step 4: Run tests to verify green**

Run:

```bash
npx vitest run src/client-tool-result-guard.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 3: Postgres Store

**Files:**
- Create: `libs/middleware/src/postgres-client-tool-execution-store.spec.ts`
- Create: `libs/middleware/src/langgraph/postgres-client-tool-execution-store.ts`
- Modify: `libs/middleware/src/langgraph/index.ts`
- Modify: `libs/middleware/package.json`

- [x] **Step 1: Write failing Postgres store tests**

Use a fake tagged SQL function that records query text and returns scripted rows. Cover:
- `THREADPLANE_CLIENT_TOOL_EXECUTIONS_SCHEMA` contains the table, nullable `tenant_id`, and `PRIMARY KEY (thread_id, tool_call_id)`.
- `claim()` inserts `tenant_id`, `thread_id`, `tool_call_id`, `status='executing'` with `ON CONFLICT DO NOTHING`, returning `'claimed'` when insert returns a row.
- `claim()` reads the existing row on conflict and maps done rows back to `ClientToolExecutionRecord`.
- `record()` stores status `done` and a JSON result without overwriting an already-done row's result.
- `lookup()` returns a record keyed by `tool_call_id` for requested ids.

- [x] **Step 2: Run tests to verify red**

Run:

```bash
npx vitest run src/postgres-client-tool-execution-store.spec.ts --config vite.config.mts
```

Expected: FAIL because the Postgres module does not exist.

- [x] **Step 3: Implement Postgres store**

Use a supplied `postgres`-style SQL tagged function and avoid importing the driver. Add `postgres` as an optional peer/dependency in `libs/middleware/package.json` only if TypeScript requires a package-level dependency for published consumers; otherwise keep the dependency surface unchanged.

- [x] **Step 4: Run tests to verify green**

Run:

```bash
npx vitest run src/postgres-client-tool-execution-store.spec.ts --config vite.config.mts
```

Expected: PASS.

---

### Task 4: Docs, API Docs, And Verification

**Files:**
- Modify: `libs/middleware/README.md`
- Modify: `apps/website/content/docs/middleware/api/api-docs.json`

- [x] **Step 1: Update middleware README**

Add a short “Durable client-tool result guard” section showing:
- in-memory store creation,
- where to call `recordClientToolResults()`,
- how to drop duplicates with `filterDuplicateClientToolResultMessages()`,
- Postgres schema/setup with the exported SQL constant,
- note that Tier 2 claim-before-execute is not part of M3.

- [x] **Step 2: Regenerate API docs**

Run:

```bash
npm run generate-api-docs
```

Expected: middleware docs include new M3 exports.

- [x] **Step 3: Run middleware tests**

Run:

```bash
npx nx test middleware
```

Expected: PASS.

- [x] **Step 4: Run middleware lint and build**

Run:

```bash
npx nx lint middleware
npx nx build middleware
```

Expected: both PASS.

- [x] **Step 5: Run focused library guard**

Run:

```bash
npx nx run-many -t build --projects=chat,langgraph,ag-ui,render,a2ui,licensing,telemetry --configuration=production
```

Expected: PASS, preserving the fix-forwarded library CI gate.

- [x] **Step 6: Diff audit**

Run:

```bash
git diff --check
(git diff --name-only; git ls-files --others --exclude-standard) | rg -v '^docs/superpowers/' | xargs rg -n "hashbrown|copilotkit|chatgpt|claude" || true
```

Expected: no whitespace errors; changed non-plan files contain none of the forbidden external names.
