# Client Tools M1 Pending Predicate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated client-tool `pending` predicate into a pure shared `@threadplane/chat` helper without changing adapter behavior.

**Architecture:** Add one pure function in chat's client-tools package that receives plain inputs (`isLoading`, `toolCalls`, `catalogNames`, `resolvedIds`) and returns the same filtered tool-call list both adapters compute today. AG-UI and LangGraph keep their own signals, result application, and transport-specific continuation logic.

**Tech Stack:** TypeScript, Angular computed signals, Vitest, Nx, existing `@threadplane/chat` public API generation.

---

## Scope Guard

M1 is spec §6 only. Do not add `settle()`, batching, abort signals, durable stores, max-turn guards, or continuation policy changes. Adapter behavior must remain byte-for-byte equivalent at the observable level: `pending()` is still empty while loading, excludes non-catalog calls, excludes calls with `result !== undefined`, excludes locally resolved ids, and keeps current resolve semantics.

Because `selectPendingClientToolCalls` is exported from `@threadplane/chat`, run `npm run generate-api-docs` and include the generated API docs diff.

## File Structure

- Create: `libs/chat/src/lib/client-tools/select-pending-client-tool-calls.ts`
  - Owns the pure predicate and its input interface.
- Create: `libs/chat/src/lib/client-tools/select-pending-client-tool-calls.spec.ts`
  - Covers loading, catalog filtering, result filtering, resolved-id filtering, multiple matches, and input immutability expectations.
- Modify: `libs/chat/src/lib/client-tools/index.ts`
  - Export the helper and input type.
- Modify: `libs/chat/src/public-api.ts`
  - Re-export the helper from the package public API.
- Modify: `libs/ag-ui/src/lib/client-tools.ts`
  - Import and use the helper inside the existing `computed`, leaving `catalog` and `resolvedIds` signals local.
- Modify: `libs/langgraph/src/lib/client-tools.ts`
  - Import and use the helper inside the existing `computed`, leaving `catalog`, `resolvedIds`, and `applyClientResult` local.
- Generated: website API docs touched by `npm run generate-api-docs`.

## Task 1: Shared Predicate

**Files:**
- Create: `libs/chat/src/lib/client-tools/select-pending-client-tool-calls.spec.ts`
- Create: `libs/chat/src/lib/client-tools/select-pending-client-tool-calls.ts`
- Modify: `libs/chat/src/lib/client-tools/index.ts`
- Modify: `libs/chat/src/public-api.ts`

- [x] **Step 1: Write the failing shared predicate tests**

Tests should import `selectPendingClientToolCalls` from `./select-pending-client-tool-calls` and assert:

```ts
expect(selectPendingClientToolCalls({
  isLoading: true,
  toolCalls: [{ id: 'c1', name: 'get_weather', args: {}, status: 'complete' }],
  catalogNames: new Set(['get_weather']),
  resolvedIds: new Set(),
})).toEqual([]);
```

Also cover catalog mismatch, existing `result`, local `resolvedIds`, multiple included calls, and stable reference behavior for matching tool-call objects.

- [x] **Step 2: Run the red test**

Run: `npx vitest run src/lib/client-tools/select-pending-client-tool-calls.spec.ts --config vite.config.mts` from `libs/chat`.

Expected: fail because the helper file does not exist.

- [x] **Step 3: Implement the pure helper**

Create:

```ts
export interface SelectPendingClientToolCallsInput {
  isLoading: boolean;
  toolCalls: readonly ToolCall[];
  catalogNames: ReadonlySet<string>;
  resolvedIds: ReadonlySet<string>;
}

export function selectPendingClientToolCalls(
  input: SelectPendingClientToolCallsInput,
): readonly ToolCall[] {
  if (input.isLoading) return [];
  return input.toolCalls.filter(
    (tc) =>
      input.catalogNames.has(tc.name) &&
      tc.result === undefined &&
      !input.resolvedIds.has(tc.id),
  );
}
```

- [x] **Step 4: Export the helper**

Export from `libs/chat/src/lib/client-tools/index.ts` and `libs/chat/src/public-api.ts`.

- [x] **Step 5: Run the shared predicate tests**

Run: `npx vitest run src/lib/client-tools/select-pending-client-tool-calls.spec.ts --config vite.config.mts` from `libs/chat`.

Expected: pass.

## Task 2: Adapter Wiring

**Files:**
- Modify: `libs/ag-ui/src/lib/client-tools.ts`
- Modify: `libs/langgraph/src/lib/client-tools.ts`
- Test: `libs/ag-ui/src/lib/client-tools.spec.ts`
- Test: `libs/langgraph/src/lib/client-tools.spec.ts`

- [x] **Step 1: Replace AG-UI inline predicate**

Inside `pending: computed(() => ...)`, keep building local `catalogNames` and reading local `resolvedIds`, then return `selectPendingClientToolCalls({ isLoading: store.isLoading(), toolCalls: store.toolCalls(), catalogNames, resolvedIds: done })`.

- [x] **Step 2: Run AG-UI focused tests**

Run: `npx vitest run src/lib/client-tools.spec.ts --config vite.config.mts` from `libs/ag-ui`.

Expected: pass with unchanged behavior.

- [x] **Step 3: Replace LangGraph inline predicate**

Inside `const pending = computed(...)`, keep building local `catalogNames` and reading local `resolvedIds`, then return the shared helper.

- [x] **Step 4: Run LangGraph focused tests**

Run: `npx vitest run src/lib/client-tools.spec.ts --config vite.config.mts` from `libs/langgraph`.

Expected: pass with unchanged behavior.

## Task 3: Docs and Verification

**Files:**
- Generated API docs under `apps/website/content/docs/**` as produced by the repo generator.

- [x] **Step 1: Regenerate API docs**

Run: `npm run generate-api-docs`.

Expected: generated docs include `selectPendingClientToolCalls` and `SelectPendingClientToolCallsInput`.

- [x] **Step 2: Run project tests**

Run:

```bash
npx nx test chat
npx nx test ag-ui
npx nx test langgraph
```

Expected: all pass.

- [x] **Step 3: Run lint and count errors**

Run:

```bash
npx nx lint chat 2>&1 | tee /tmp/threadplane-chat-m1-lint.log; grep -cE ' error ' /tmp/threadplane-chat-m1-lint.log
npx nx lint ag-ui 2>&1 | tee /tmp/threadplane-ag-ui-m1-lint.log; grep -cE ' error ' /tmp/threadplane-ag-ui-m1-lint.log
npx nx lint langgraph 2>&1 | tee /tmp/threadplane-langgraph-m1-lint.log; grep -cE ' error ' /tmp/threadplane-langgraph-m1-lint.log
```

Expected: each grep count is `0`.

- [x] **Step 4: Diff audit**

Run:

```bash
git diff --check
git diff --name-only
rg -n "hashbrown|copilotkit|chatgpt|claude" libs docs apps/website/content/docs || true
```

Expected: no whitespace errors; changed files match M1 scope; forbidden external names are absent from code and generated docs except already-existing design/plan markdown where allowed.
