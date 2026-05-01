# LangGraph `agent()` Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Refactor `@ngaf/langgraph` so `agent({...})` returns a unified `LangGraphAgent` (extends `AgentWithHistory`) preserving all `AgentRef` public surface. Delete `toAgent(ref)`. Migrate ~23 cockpit components and ~20 website doc files.

**Spec:** `docs/superpowers/specs/2026-05-01-langgraph-agent-unification-design.md`

**Architecture:** Three sequential commits — lib refactor (self-contained; updated tests prove the new surface), cockpit migration (mechanical with type-checking), website docs (mostly auto-regenerated + manual MDX prose).

---

## File Structure

### `@ngaf/langgraph` library

- **Modify:** `libs/langgraph/src/lib/agent.types.ts` — define `LangGraphAgent` interface; remove `AgentRef` from public exports (kept internally if needed).
- **Modify:** `libs/langgraph/src/lib/agent.fn.ts` — `agent()` returns `LangGraphAgent`; folds in the type translation that `to-agent.ts` previously did.
- **Delete:** `libs/langgraph/src/lib/to-agent.ts`
- **Delete:** `libs/langgraph/src/lib/to-agent.spec.ts`
- **Delete:** `libs/langgraph/src/lib/to-agent.conformance.spec.ts`
- **Create:** `libs/langgraph/src/lib/agent.conformance.spec.ts` — runs `runAgentWithHistoryConformance` against an `agent({...})` instance built with `MockAgentTransport`.
- **Modify:** `libs/langgraph/src/lib/agent.fn.spec.ts` — assertions about return-type signal shapes (now runtime-neutral). Add new tests exercising `langGraph*`-prefixed signals.
- **Modify:** `libs/langgraph/src/lib/testing/mock-agent-ref.ts` — rename to `mock-langgraph-agent.ts`; produce `LangGraphAgent` directly (not `AgentRef`).
- **Modify:** `libs/langgraph/src/lib/testing/mock-agent-ref.spec.ts` — rename to match.
- **Modify:** `libs/langgraph/src/public-api.ts` — export `LangGraphAgent` and `mockLangGraphAgent`; remove `toAgent`, `AgentRef` (the internal type stays unexported), `createMockAgentRef`.

### Cockpit (~23 angular demo apps)

Each affected component file: drop the `stream` field + `toAgent` call, collapse to a single `agent` field. Audit for any direct `BaseMessage[]`-typed reads → switch to `langGraphMessages()`.

### Website docs

Most files are MDX prose with code samples that reference `AgentRef` and `toAgent`. Auto-regenerated artifacts (`api-docs.json`, whitepaper PDFs) regenerate after the lib change.

---

### Task 1: Define `LangGraphAgent` and refactor library internals

**Files:**
- Modify: `libs/langgraph/src/lib/agent.types.ts`
- Modify: `libs/langgraph/src/lib/agent.fn.ts`
- Delete: `libs/langgraph/src/lib/to-agent.ts`
- Delete: `libs/langgraph/src/lib/to-agent.spec.ts`
- Delete: `libs/langgraph/src/lib/to-agent.conformance.spec.ts`
- Modify: `libs/langgraph/src/public-api.ts`

#### Step 1: Define `LangGraphAgent` in `agent.types.ts`

After the existing `AgentRef` interface, add the unified type. Keep `AgentRef` internally (it represents the SDK-shaped intermediate state). Add `LangGraphAgent`:

```ts
import type {
  AgentWithHistory, Message, AgentCheckpoint, AgentStatus,
  AgentInterrupt, Subagent, AgentSubmitInput, AgentSubmitOptions, AgentEvent, ToolCall,
} from '@ngaf/chat';

/**
 * Unified LangGraph agent surface returned by `agent({...})`. Extends
 * the runtime-neutral `AgentWithHistory` contract (chat-consumable) with
 * the full LangGraph-specific API.
 */
export interface LangGraphAgent<T = unknown, ResolvedBag extends BagTemplate = BagTemplate>
  extends AgentWithHistory {
  // Raw LangGraph signals (preserve full AgentRef public surface)
  langGraphMessages:    Signal<BaseMessage[]>;
  langGraphInterrupts:  Signal<Interrupt<ResolvedBag['InterruptType']>[]>;
  langGraphToolCalls:   Signal<ToolCallWithResult[]>;
  langGraphHistory:     Signal<ThreadState<T>[]>;

  value:           Signal<T>;
  hasValue:        Signal<boolean>;
  reload:          () => void;
  toolProgress:    Signal<ToolProgress[]>;
  activeSubagents: Signal<SubagentStreamRef[]>;
  customEvents:    Signal<CustomStreamEvent[]>;

  branch:          Signal<string>;
  setBranch:       (branch: string) => void;

  isThreadLoading: Signal<boolean>;
  switchThread:    (threadId: string | null) => void;
  joinStream:      (runId: string, lastEventId?: string) => Promise<void>;

  getMessagesMetadata: (msg: BaseMessage, idx?: number) => MessageMetadata<Record<string, unknown>> | undefined;
  getToolCalls:        (msg: CoreAIMessage) => ToolCallWithResult[];
}
```

(Imports from `@langchain/langgraph-sdk` and `@langchain/core/messages` for the LangGraph types stay; chat types come from `@ngaf/chat`.)

#### Step 2: Refactor `agent.fn.ts` to return `LangGraphAgent`

The internal AgentRef-shaped state stays; the function's RETURN object becomes the unified type. Concretely: continue building all internal signals/subjects as today, then assemble the return object with both runtime-neutral projections AND the raw LangGraph signals.

The translation logic that lives in today's `to-agent.ts` (e.g., `toMessage(BaseMessage): Message`, `toToolCall(...)`, `toInterrupt(...)`, `toSubagent(...)`, `toCheckpoint(...)`, `mapStatus(...)`, `toAgentEvent(...)`, `buildSubmitPayload(...)`, `buildEvents$(...)`) all moves into `agent.fn.ts` as private helpers.

Sketch of the return statement:

```ts
const messagesNeutral: Signal<Message[]> = computed(() => messages$.getValue().map(toMessage));
const toolCallsNeutral: Signal<ToolCall[]> = computed(() => toolCalls$.getValue().map(toToolCall));
const statusNeutral: Signal<AgentStatus> = computed(() => mapStatus(status$.getValue()));
const stateNeutral: Signal<Record<string, unknown>> = computed(() => {
  const v = values$.getValue();
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
});
const interruptNeutral: Signal<AgentInterrupt | undefined> = computed(() => {
  const ix = interrupt$.getValue();
  return ix ? toInterrupt(ix) : undefined;
});
const subagentsNeutral: Signal<Map<string, Subagent>> = computed(() => {
  const out = new Map<string, Subagent>();
  subagents$.getValue().forEach((sa, key) => out.set(key, toSubagent(sa)));
  return out;
});
const historyNeutral: Signal<AgentCheckpoint[]> = computed(() =>
  history$.getValue().map(toCheckpoint),
);
const events$ = buildEvents$(customEvents$);  // still Subject + cursor pattern

return {
  // Runtime-neutral surface (Agent + AgentWithHistory)
  messages: messagesNeutral,
  status: statusNeutral,
  isLoading: isLoading$,
  error: error$,
  toolCalls: toolCallsNeutral,
  state: stateNeutral,
  interrupt: interruptNeutral,
  subagents: subagentsNeutral,
  events$,
  history: historyNeutral,
  submit: (input, opts) => doSubmit(buildSubmitPayload(input), opts ? { signal: opts.signal } as never : undefined),
  stop: () => doStop(),

  // Raw LangGraph signals
  langGraphMessages: messages$,
  langGraphInterrupts: interrupts$,
  langGraphToolCalls: toolCalls$,
  langGraphHistory: history$,

  // Other AgentRef fields preserved
  value: values$,
  hasValue: hasValue$,
  reload,
  toolProgress: toolProgress$,
  activeSubagents: activeSubagents$,
  customEvents: customEvents$,
  branch: branch$,
  setBranch,
  isThreadLoading: isThreadLoading$,
  switchThread,
  joinStream,
  getMessagesMetadata,
  getToolCalls,
};
```

(Variable names like `messages$`, `status$`, etc. are placeholders for whatever the existing internals call them. The actual implementation references the StreamSubjects + helpers already in agent.fn.ts.)

#### Step 3: Delete `to-agent.ts` and its specs

```bash
rm libs/langgraph/src/lib/to-agent.ts
rm libs/langgraph/src/lib/to-agent.spec.ts
rm libs/langgraph/src/lib/to-agent.conformance.spec.ts
```

#### Step 4: Update `agent.fn.spec.ts`

Existing tests assert things like `agent.messages()` returns `BaseMessage[]`. Now they return `Message[]`. Update assertions accordingly. Where a test specifically wants the LangChain-typed message, switch to `agent.langGraphMessages()`.

Add new tests:
- `agent({...}).messages()` returns `Message[]` with role correctly translated (`human` → `'user'`).
- `agent({...}).langGraphMessages()` returns the raw `BaseMessage[]`.
- `agent({...}).history()` returns `AgentCheckpoint[]`; `langGraphHistory()` returns `ThreadState[]`.

#### Step 5: Add conformance test

Create `libs/langgraph/src/lib/agent.conformance.spec.ts`:

```ts
import { runAgentWithHistoryConformance } from '@ngaf/chat';
import { agent } from './agent.fn';
import { MockAgentTransport } from './transport/mock-stream.transport';
import { TestBed } from '@angular/core/testing';

runAgentWithHistoryConformance('agent (LangGraph)', () => {
  let result!: ReturnType<typeof agent>;
  TestBed.runInInjectionContext(() => {
    result = agent({
      apiUrl: '',
      assistantId: 'test',
      transport: new MockAgentTransport(),
    });
  });
  return result;
});
```

#### Step 6: Refactor mock helper

Rename `libs/langgraph/src/lib/testing/mock-agent-ref.ts` → `mock-langgraph-agent.ts`. Update factory function name `createMockAgentRef` → `mockLangGraphAgent`. Returns `LangGraphAgent`-typed mock. Same approach: writable signals for every field.

Spec file rename + adjustments to match.

#### Step 7: Update `public-api.ts`

```ts
// remove
export { toAgent } from './lib/to-agent';
export { createMockAgentRef } from './lib/testing/mock-agent-ref';
export type { AgentRef } from './lib/agent.types';

// add
export type { LangGraphAgent } from './lib/agent.types';
export { mockLangGraphAgent } from './lib/testing/mock-langgraph-agent';
```

(Other exports — `agent`, `provideAgent`, `MockAgentTransport`, `AgentConfig`, `BagTemplate`, etc. — stay unchanged.)

#### Step 8: Verify

```bash
npx nx run-many -t lint,test,build -p langgraph --skip-nx-cache
```

Expected: PASS. The conformance suite covering `runAgentWithHistoryConformance` validates the runtime-neutral surface; remaining specs validate the LangGraph-specific surface.

#### Step 9: Commit

```bash
git add libs/langgraph/
git commit -m "refactor(langgraph): unify agent() return type as LangGraphAgent

Eliminate two-step agent()+toAgent() pattern. agent() now returns
LangGraphAgent extending AgentWithHistory with the full LangGraph-
specific surface preserved (langGraph*-prefixed raw signals where
type collisions exist with the runtime-neutral chat contract).

- Define LangGraphAgent in agent.types.ts
- Fold to-agent translation logic into agent.fn.ts
- Delete to-agent.ts and its specs
- Add agent.conformance.spec.ts
- Rename mockAgentRef → mockLangGraphAgent
- public-api.ts: drop toAgent, AgentRef, createMockAgentRef;
  add LangGraphAgent, mockLangGraphAgent

BREAKING: AgentRef is no longer exported. agent() return type changed
from AgentRef to LangGraphAgent. toAgent() removed entirely.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Migrate cockpit demos

**Files:** ~23 cockpit angular component files (audit list at start).

#### Step 1: Re-audit affected files

```bash
rg -l "\\btoAgent\\(" cockpit/ apps/ --glob '!**/dist/**'
```

Expected: ~23 cockpit files + a few apps/website MDX/TSX files (handled in Task 3).

#### Step 2: Per-file migration pattern

The mechanical edit is:

```ts
// before
protected readonly stream = agent({ apiUrl, assistantId });
protected readonly chatAgent = toAgent(this.stream);
// (template uses [agent]="chatAgent"; methods called as this.stream.foo())

// after
protected readonly agent = agent({ apiUrl, assistantId });
// (template uses [agent]="agent"; methods called as this.agent.foo())
```

Steps per file:

1. Drop the `import { toAgent } from '@ngaf/langgraph';` (or remove `toAgent` from the imports list if it's combined with `agent`).
2. Collapse the two-field initializer into one: `protected readonly agent = agent({...});`. **Note:** TypeScript handles the field-named-same-as-import via property shorthand; no compile error.
   - If the field-name shadowing feels confusing, the implementer may prefer naming the field `chat` or keep `chatAgent`. Either is acceptable per the spec.
3. Update template bindings: `[agent]="chatAgent"` → `[agent]="agent"`. Adjust template references.
4. Update method calls: `this.stream.setBranch(...)` → `this.agent.setBranch(...)`.
5. **For any code that read `BaseMessage`-typed messages off `this.stream.messages()`** — switch to `this.agent.langGraphMessages()` to preserve the LangChain type. Conversely, if it was rendering through chat primitives, `this.agent.messages()` returns `Message[]` directly.

#### Step 3: Verify each app builds

```bash
npx nx affected -t build --base=origin/main 2>&1 | tail -10
```

If any cockpit fails: read the build error, fix the affected component, re-run. Build errors are the migration's main safety net — TypeScript catches missed `toAgent` calls and signal-type mismatches.

#### Step 4: Commit

```bash
git add cockpit/
git commit -m "refactor(cockpit): migrate from agent()+toAgent() two-step to unified LangGraphAgent

23 cockpit angular demos updated. The two field initializers
(stream = agent({...}); chatAgent = toAgent(this.stream)) collapse
to a single field. Code reading raw BaseMessage[] switches to
.langGraphMessages(); chat-template bindings now reference the
unified agent.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Migrate website docs

**Files:** ~20 files in `apps/website/`.

#### Step 1: Audit doc files referencing `AgentRef` or `toAgent`

```bash
rg -l "AgentRef|toAgent" apps/website/ --glob '!**/dist/**' --glob '!**/api-docs.json'
```

#### Step 2: Update MDX prose and code samples

For each MDX file: replace `AgentRef` references with `LangGraphAgent` (or context-appropriate); replace `toAgent(stream)` patterns with the new unified `agent({...})` flow.

Specific files:
- `apps/website/content/docs/agent/concepts/angular-signals.mdx` — prose update.
- `apps/website/content/docs/agent/api/*.mdx` — code samples; update to show `LangGraphAgent`.
- `apps/website/content/docs/chat/components/*.mdx` — many code samples reference `agent()` then `toAgent()`. Update each.
- `apps/website/content/docs/chat/getting-started/*.mdx` — quickstart and installation samples.
- `apps/website/content/docs/render/a2ui/overview.mdx` — likely a code sample reference.
- `apps/website/content/docs/ag-ui/getting-started/introduction.mdx` — has a "vs LangGraph" mention; verify still accurate.
- `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx` — code sample component; update.
- `apps/website/src/lib/docs-config.ts` — page entry `createMockAgentRef()` becomes `mockLangGraphAgent()`. Adjust slug if desired (or keep slug stable to avoid URL breakage).

#### Step 3: Rename `createMockAgentRef` doc page

`apps/website/content/docs/chat/api/create-mock-agent-ref.mdx` → `mock-langgraph-agent.mdx`. Update the page entry in `docs-config.ts`. Or alias both slugs to the new content.

#### Step 4: Regenerate API docs and whitepapers

```bash
npm run generate-api-docs       # rewrites apps/website/public/api-docs.json
npm run generate-narrative-docs # if it covers this content
npm run generate-whitepaper     # whitepaper PDFs
```

Verify the generated artifacts no longer mention `AgentRef`/`toAgent`.

#### Step 5: Update llms.txt

`apps/website/src/app/llms.txt/route.ts` — example code currently shows `agent({...})` + `toAgent` flow. Simplify to single `agent({...})`. Also update the "Key API" section to mention `LangGraphAgent` instead of `AgentRef`.

#### Step 6: Build website

```bash
npx nx build website --skip-nx-cache 2>&1 | tail -3
```

#### Step 7: Update website e2e tests if needed

```bash
rg -nE "AgentRef|toAgent" apps/website/e2e/ 2>&1
```

Likely no e2e changes needed (tests assert page text, not code samples).

#### Step 8: Commit

```bash
git add apps/website/
git commit -m "docs(website): align with unified LangGraphAgent API

Update MDX prose, code samples in chat/agent/render docs to reference
LangGraphAgent + the single agent({...}) flow. Regenerate api-docs.json
and whitepapers. Rename createMockAgentRef doc page to mockLangGraphAgent.
Update llms.txt example.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Final verification, push, PR

#### Step 1: Final residual-check

```bash
echo "AgentRef refs remaining (should be 0 in source, may exist in docs/superpowers historical):"
rg "AgentRef" libs/ cockpit/ apps/ --glob '!**/dist/**' --glob '!**/api-docs.json' --glob '!docs/superpowers/**'

echo "toAgent refs remaining (should be 0 in src; AG-UI keeps its own toAgent):"
rg "\\btoAgent\\(" libs/langgraph/ cockpit/ apps/ --glob '!**/dist/**'
```

Expected: zero hits in both.

#### Step 2: Full build sweep

```bash
npx nx run-many -t lint,test,build -p chat,langgraph,ag-ui --skip-nx-cache
npx nx affected -t build --base=origin/main
```

Expected: PASS.

#### Step 3: Push + open PR

```bash
git push -u origin feat/toagent-review

gh pr create --title "refactor(langgraph): unify agent() return type as LangGraphAgent" --body "$(cat <<'EOF'
## Summary
Eliminates the two-step \`agent({...}) + toAgent(stream)\` pattern. \`agent({...})\` now returns a unified \`LangGraphAgent\` (extends \`AgentWithHistory\`) preserving all \`AgentRef\` public surface. \`toAgent\` removed entirely. ~23 cockpit demos and ~20 website doc files migrated.

## Breaking changes
- \`agent({...})\` return type: \`AgentRef\` → \`LangGraphAgent\`.
- \`toAgent\` removed from \`@ngaf/langgraph\`.
- \`AgentRef\` no longer exported (kept internally as implementation detail).
- \`createMockAgentRef\` → \`mockLangGraphAgent\`.
- \`messages\` signal type changed: \`Signal<BaseMessage[]>\` → \`Signal<Message[]>\`. Use \`langGraphMessages\` for raw LangChain types.

## Migration in cockpit demos
\`\`\`diff
-protected readonly stream = agent({ apiUrl, assistantId });
-protected readonly chatAgent = toAgent(this.stream);
+protected readonly agent = agent({ apiUrl, assistantId });
\`\`\`

## Test Plan
- [x] \`@ngaf/langgraph\` lint/test/build pass with new conformance suite
- [x] All 23 cockpit angular demos build clean
- [x] Website builds clean; regenerated api-docs.json reflects new API
- [x] Zero residual \`AgentRef\`/\`toAgent\` refs in source

## Design + plan
- Spec: \`docs/superpowers/specs/2026-05-01-langgraph-agent-unification-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-01-langgraph-agent-unification.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope

- AG-UI adapter changes. AG-UI's `toAgent(source)` stays as the adapter primitive.
- Adding `provideLangGraphAgent({...})` DI helper. Asymmetry with AG-UI's provider model is accepted per spec.
- Renaming `agent` (the function name).
- Backward-compat aliases for old method names.
- Releasing a new npm version. Plan ends with the merge; the next release bumps will pick up the breaking change.

## Risk

- **Largest mechanical migration in the project's history (~50 files).** Type-check + build provide the safety net.
- **Subtle semantic change in `messages` typing.** Cockpit components that did `m.content` continue to work; ones that downcast to specific LangChain message types (`if (m instanceof HumanMessage)`) need to switch to `langGraphMessages()`.
- **Mock helper rename** could break any code that imported `createMockAgentRef` outside cockpit. Audit scope.
- **Website doc regeneration** may surface other content drift unrelated to this PR; resist scope creep in those follow-up edits.
