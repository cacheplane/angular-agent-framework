# Client Tools M5 Continuation Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable client-tool continuation guard, surface a typed lifecycle object to `view`/`ask` components, and update the cockpit client-tools demo to exercise aborted and terminal client tools.

**Architecture:** Keep orchestration in `@threadplane/chat`: the coordinator owns continuation accounting, max-turn diagnostics, and group settlement while adapters remain thin `pending`/`settle`/`resolve` transports. View/ask lifecycle is surfaced as additive props on the synthetic render spec so existing components that only read schema fields and `status` keep working. Cockpit changes stay in the existing client-tools demos and use current public APIs (`AbortSignal`, `followUp:false`, durable guard wiring where already available).

**Tech Stack:** Angular signals/effects, Vitest, Playwright cockpit examples, Nx, generated API docs. No new dependencies.

---

## Source Of Truth

- Spec: `docs/superpowers/specs/2026-07-07-client-tool-continuation-architecture-design.md` §5e and milestone M5.
- Prior lifecycle design: `docs/superpowers/specs/2026-06-17-client-tools-view-ask-streaming-lifecycle-design.md`.
- Preserved defaults: current automatic function/view/ask settlement continues to work; the new guard only stops runaway continuation rounds.
- Resolved decisions not reopened: `settle()`, batch-per-group, fail-closed crash policy, max-turns default 10, backend-authoritative dedup.

## File Structure

- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
  - Add exported continuation policy and lifecycle types.
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`
  - Accept continuation policy options.
  - Count consecutive client-tool continuation groups and enforce `maxTurns` default 10.
  - Emit/log a typed diagnostic when the guard is hit.
- Modify: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts`
  - Add an additive `clientTool` lifecycle prop while preserving existing `status`.
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
  - Add a `clientToolContinuationPolicy` input and `clientToolContinuationLimit` output.
  - Pass policy into the coordinator.
- Modify: `libs/chat/src/lib/client-tools/index.ts`
  - Export new public policy/lifecycle types.
- Modify: `libs/chat/src/public-api.ts`
  - Export new public policy/lifecycle types.
- Modify: `apps/website/content/docs/chat/api/api-docs.json`
  - Regenerate after public API changes.
- Modify: `cockpit/ag-ui/client-tools/angular/src/app/client-tools.component.ts`
  - Add terminal (`followUp:false`) and abort-aware tools to the existing cockpit client-tools demo.
- Modify: `cockpit/langgraph/client-tools/angular/src/app/client-tools.component.ts`
  - Mirror the same demo coverage for the LangGraph cockpit client-tools demo.
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`
  - Guard/policy behavior and diagnostics.
- Test: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`
  - Chat input/output wiring for the policy and limit diagnostic.
- Test: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts`
  - Lifecycle prop shape passed to rendered view/ask components.
- Test: `libs/chat/src/lib/client-tools/tools.type-spec.ts` or `view-ask.type-spec.ts`
  - Public lifecycle helper type remains usable with schema-derived props.
- Test: cockpit e2e specs for AG-UI and LangGraph client-tools if existing fixture scripts support these prompts.

---

### Task 1: Continuation Policy Types And Guard

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/client-tools/client-tools-coordinator.ts`
- Test: `libs/chat/src/lib/client-tools/client-tools-coordinator.spec.ts`

- [x] **Step 1: Write failing coordinator tests**

Add tests proving:

```ts
it('stops settling pending tools after the max continuation turn count is hit', async () => {
  const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const onLimit = vi.fn();
  const registry = tools({
    loop: action('loop', z.object({}), async () => 'again'),
  });
  const { pending, resolve, capability } = makeFakeCapability();
  const coordinator = createClientToolsCoordinator(registry, {
    continuationPolicy: { maxTurns: 2, onLimit },
  });

  TestBed.runInInjectionContext(() => coordinator.connect(makeFakeAgent(capability)));

  pending.set([{ id: 'c1', name: 'loop', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();
  pending.set([{ id: 'c2', name: 'loop', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();
  pending.set([{ id: 'c3', name: 'loop', args: {}, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();

  expect(resolve).toHaveBeenCalledTimes(2);
  expect(onLimit).toHaveBeenCalledWith(expect.objectContaining({
    maxTurns: 2,
    attemptedTurn: 3,
    toolCallIds: ['c3'],
  }));
  expect(warn).toHaveBeenCalledOnce();
});
```

Also add tests that:
- omitted policy uses `maxTurns: 10`;
- `maxTurns: 0` disables the guard only when explicitly set;
- the turn count resets only when a new user turn appears in `agent.messages()`, not merely when `pending()` becomes empty between continuation runs.

- [x] **Step 2: Run focused tests to verify RED**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/client-tools/client-tools-coordinator.spec.ts
```

Expected: FAIL because coordinator options do not include a continuation policy and no max-turn guard exists.

- [x] **Step 3: Implement minimal policy types and guard**

Add types in `tool-def.ts`:

```ts
export interface ClientToolContinuationLimitEvent {
  readonly maxTurns: number;
  readonly attemptedTurn: number;
  readonly toolCallIds: readonly string[];
  readonly toolNames: readonly string[];
}

export interface ClientToolContinuationPolicy {
  readonly maxTurns?: number;
  readonly onLimit?: (event: ClientToolContinuationLimitEvent) => void;
}
```

In the coordinator:
- add `continuationPolicy?: ClientToolContinuationPolicy` to `ClientToolsCoordinatorOptions`;
- default `maxTurns` to 10;
- treat explicit `maxTurns: 0` as no limit;
- increment once per new pending group before any settlement;
- key the counter by the latest human-message identity/index visible on `agent.messages()` so a new user turn resets the consecutive continuation count;
- when the attempted turn is above the limit, call `console.error(...)`, call `onLimit(event)`, and skip settlement so no continuation run starts;
- keep group batching semantics unchanged below the limit.

- [x] **Step 4: Run focused tests to verify GREEN**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/client-tools/client-tools-coordinator.spec.ts
```

Expected: PASS.

---

### Task 2: Chat Component Policy Wiring

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Test: `libs/chat/src/lib/compositions/chat/chat.component.client-tools.spec.ts`

- [x] **Step 1: Write failing chat wiring tests**

Add tests proving:

```ts
it('passes clientToolContinuationPolicy into the coordinator and emits limit diagnostics', async () => {
  const cap = makeFakeCapability();
  const limitEvents: unknown[] = [];
  let comp!: ChatComponent;
  runInInjectionContext(injector, () => {
    comp = new ChatComponent();
    setSignalInput(comp.clientTools, clientToolRegistry);
    setSignalInput(comp.clientToolContinuationPolicy, { maxTurns: 1 });
    comp.clientToolContinuationLimit.subscribe((event) => limitEvents.push(event));
    setSignalInput(comp.agent, agentWithClientTools(cap.capability));
    TestBed.flushEffects();
  });
  await drainMicrotasks();

  cap.pending.set([{ id: 'first', name: 'get_weather', args: { city: 'SF' }, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();
  cap.pending.set([{ id: 'second', name: 'get_weather', args: { city: 'LA' }, status: 'complete' }]);
  TestBed.flushEffects();
  await drainMicrotasks();

  expect(limitEvents).toHaveLength(1);
});
```

- [x] **Step 2: Run chat component spec to verify RED**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/compositions/chat/chat.component.client-tools.spec.ts
```

Expected: FAIL because the input/output do not exist.

- [x] **Step 3: Add input/output wiring**

In `ChatComponent`:
- add `clientToolContinuationPolicy = input<ClientToolContinuationPolicy | undefined>(undefined)`;
- add `clientToolContinuationLimit = output<ClientToolContinuationLimitEvent>()`;
- pass `{ ...policy, onLimit: event => { policy?.onLimit?.(event); this.clientToolContinuationLimit.emit(event); } }` into `createClientToolsCoordinator`.

- [x] **Step 4: Run chat component spec to verify GREEN**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/compositions/chat/chat.component.client-tools.spec.ts
```

Expected: PASS.

---

### Task 3: Typed View/Ask Lifecycle Props

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts`
- Test: `libs/chat/src/lib/client-tools/view-ask.type-spec.ts`

- [x] **Step 1: Write failing lifecycle prop tests**

Add a test component with a typed lifecycle input:

```ts
class TestWeatherCardComponent {
  readonly clientTool = input<ClientToolLifecycle | undefined>(undefined);
}
```

Assert a running call receives:

```ts
expect(component.clientTool()).toEqual({
  id: 'c1',
  name: 'weather_card',
  status: 'running',
  phase: 'running',
  hasResult: false,
});
```

Assert an error call receives `phase: 'error'`, `hasResult: true`, and the error value.

- [x] **Step 2: Write failing type assertion**

In `view-ask.type-spec.ts`, add:

```ts
type Inputs = ClientToolViewProps<typeof daySchema>;
const _status: ToolCallStatus | undefined = ({} as Inputs).status;
const _clientTool: ClientToolLifecycle | undefined = ({} as Inputs).clientTool;
```

- [x] **Step 3: Run focused tests to verify RED**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts
NX_DAEMON=false npx nx run chat:type-tests --skip-nx-cache --outputStyle=static
```

Expected: FAIL because `clientTool` lifecycle props and public types do not exist.

- [x] **Step 4: Implement lifecycle model**

Add exported types:

```ts
export type ClientToolLifecyclePhase = 'running' | 'complete' | 'error';

export interface ClientToolLifecycle {
  readonly id: string;
  readonly name: string;
  readonly status: ToolCallStatus;
  readonly phase: ClientToolLifecyclePhase;
  readonly hasResult: boolean;
  readonly result?: unknown;
  readonly error?: unknown;
}

export type ClientToolViewProps<S extends StandardSchemaV1> =
  StandardSchemaInferOutput<S> & {
    readonly status?: ToolCallStatus;
    readonly clientTool?: ClientToolLifecycle;
  };
```

In `ChatToolViewsComponent`, update `toToolViewSpec(tc)` to add `clientTool: toClientToolLifecycle(tc)` while preserving `status`.

- [x] **Step 5: Run focused tests to verify GREEN**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static --testFile=src/lib/primitives/chat-tool-views/chat-tool-views.component.spec.ts
NX_DAEMON=false npx nx run chat:type-tests --skip-nx-cache --outputStyle=static
```

Expected: PASS.

---

### Task 4: Cockpit Client-Tools Demo Coverage

**Files:**
- Modify: `cockpit/ag-ui/client-tools/angular/src/app/client-tools.component.ts`
- Modify: `cockpit/langgraph/client-tools/angular/src/app/client-tools.component.ts`
- Test: existing cockpit client-tools e2e specs if fixture scripts cover deterministic prompts.

- [x] **Step 1: Add failing cockpit assertions where feasible**

If the current scripted cockpit fixtures can be extended deterministically, add tests that:
- prompt an abort-aware long client action, click stop, and assert the result is not continued;
- prompt a terminal view/action declared with `{ followUp: false }` and assert no follow-up summary is required to see the terminal UI.

If fixtures cannot deterministically exercise these paths, document that in the PR body and rely on unit coverage plus local build.

- [x] **Step 2: Run relevant cockpit test/build before implementation**

Run the smallest available target for the edited cockpit projects, for example:

```bash
NX_DAEMON=false npx nx test cockpit-ag-ui-client-tools-angular --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx test cockpit-langgraph-client-tools-angular --skip-nx-cache --outputStyle=static
```

Expected: either FAIL for the new assertions or report no test target; record the actual target names before proceeding.

- [x] **Step 3: Update demo tools**

In both client-tools demos:
- add an abort-aware function tool whose handler observes `context.signal` and exits without resolving when stopped;
- add a terminal tool (`followUp:false`) that renders or returns a visible terminal result;
- update component inputs to optionally read `clientTool` lifecycle where useful, without changing the demo layout into explanatory text.

- [x] **Step 4: Run cockpit verification**

Run the smallest relevant cockpit targets found in `project.json`, plus build if no unit target exists:

```bash
NX_DAEMON=false npx nx build cockpit-ag-ui-client-tools-angular --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx build cockpit-langgraph-client-tools-angular --skip-nx-cache --outputStyle=static
```

Expected: PASS.

---

### Task 5: Public Exports, API Docs, And Full Verification

**Files:**
- Modify: `libs/chat/src/lib/client-tools/index.ts`
- Modify: `libs/chat/src/public-api.ts`
- Regenerate: `apps/website/content/docs/chat/api/api-docs.json`

- [x] **Step 1: Export public API changes**

Export:
- `ClientToolContinuationPolicy`
- `ClientToolContinuationLimitEvent`
- `ClientToolLifecycle`
- `ClientToolLifecyclePhase`
- `ClientToolViewProps`

- [x] **Step 2: Regenerate API docs**

Run:

```bash
npm run generate-api-docs
```

Expected: succeeds and updates chat API docs.

- [x] **Step 3: Run focused verification**

Run:

```bash
NX_DAEMON=false npx nx test chat --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx run chat:type-tests --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx lint chat --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx build chat --skip-nx-cache --outputStyle=static
```

Expected: PASS, with lint warnings allowed only if the command exits 0 and reports no errors.

- [x] **Step 4: Run affected package/cockpit verification**

Run:

```bash
NX_DAEMON=false npx nx test ag-ui --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx test langgraph --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx build cockpit-ag-ui-client-tools-angular --skip-nx-cache --outputStyle=static
NX_DAEMON=false npx nx build cockpit-langgraph-client-tools-angular --skip-nx-cache --outputStyle=static
git diff --check
```

Expected: PASS.

- [x] **Step 5: Review constraints before PR**

Check:

```bash
git diff --name-only origin/main
(git diff origin/main --name-only; git ls-files --others --exclude-standard) | rg -v '^docs/superpowers/' | xargs rg -n 'hashbrown|copilotkit|chatgpt|claude' || true
```

Expected:
- no out-of-scope M6 bridge work;
- no new dependencies;
- no forbidden external-framework references outside `docs/superpowers`;
- public API docs regenerated for new exports.
