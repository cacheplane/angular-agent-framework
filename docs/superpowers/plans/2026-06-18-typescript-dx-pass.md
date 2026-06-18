# TypeScript DX Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `@threadplane/*` hero primitives (`tools/action/view/ask`, `provideAgent/injectAgent`) infer correctly under `strict: true`, link schemas to handler args / component inputs, carry agent state types through DI, and read cleanly on hover — validated against the cockpit + canonical examples as forcing functions.

**Architecture:** Five library workstreams in `@threadplane/chat`, `@threadplane/render`, `@threadplane/langgraph`, `@threadplane/ag-ui`, each gated by a hand-rolled `strict: true` type-test file. Then a four-tier example-validation pass: migrate + flip `strict: true` on the client-tools forcing-function apps, build-net across all `provideAgent`/`injectAgent` apps, live smoke, and the type-test gate in CI.

**Tech Stack:** Angular 21 (signal inputs, `InputSignal`), TypeScript ≥ 5 (`const` type params), Nx, vitest, Standard Schema (vendored), Zod (`zod/v4`) in examples.

**Reference spec:** `docs/superpowers/specs/2026-06-18-typescript-dx-pass-design.md`. Core type machinery for WS1 + WS2 was verified compiling under `strict: true` during design.

**Conventions for the implementer:**
- No backwards-compatibility constraint. Flat named exports stay.
- Never name the reference framework in code/comments/commits (describe techniques generically).
- The render lib's vitest has no Angular template compiler; type-level behavior is validated by `*.type-spec.ts` files compiled with `tsc`, not by runtime tests.
- Type-test TDD loop: the "failing test" is a `tsc -p <type-tests-tsconfig>` run that errors before the implementation lands and passes after. `@ts-expect-error` lines invert the assertion (an *unused* `@ts-expect-error` is itself a compile error, so they double as negative tests).
- Commit after each task.

---

## File Structure

**`libs/chat`**
- `src/lib/client-tools/tool-def.ts` — MODIFY: `FunctionToolDef<S,R>`, new `AnyFunctionToolDef`, `ViewToolDef<S,C>`, `AskToolDef<S,C>`, `ClientToolDef` union.
- `src/lib/client-tools/tools.ts` — MODIFY: `action<S,R>`, generic `tools<const M>`, generic `view<S,C>`/`ask<S,C>`, `ViewProps` re-export point.
- `src/lib/client-tools/component-inputs.ts` — NEW: `ComponentInputs`, `CompatibleProps`, `AcceptComponent`.
- `src/lib/agent/agent.ts` — MODIFY: `Agent<TState = Record<string, unknown>>`.
- `src/lib/agent/agent-with-history.ts` — MODIFY: `AgentWithHistory<TState = Record<string, unknown>>`.
- `src/lib/agent/agent-ref.ts` — NEW: `AgentRef<TState>`, `createAgentRef`.
- `src/lib/internals/prettify.ts` — NEW: `Prettify<T>` (internal).
- `src/lib/client-tools/*.type-spec.ts`, `src/lib/agent/*.type-spec.ts` — NEW type-tests.
- `src/testing/type-assert.ts` — NEW: `Equal`, `Expect` (shared by type-specs; no vitest dep).
- `tsconfig.type-tests.json` — NEW: strict tsconfig for type-specs.
- `project.json` — MODIFY: add `type-tests` target.
- `src/public-api.ts` — MODIFY: re-exports + JSDoc-touched symbols.

**`libs/langgraph`**
- `src/lib/agent.provider.ts`, `src/lib/inject-agent.ts`, `src/lib/agent.types.ts` — MODIFY: ref overloads; `LangGraphAgent<T>` already generic.
- `src/lib/*.type-spec.ts`, `tsconfig.type-tests.json`, `project.json` — NEW type-test gate.

**`libs/ag-ui`**
- `src/lib/to-agent.ts`, `src/lib/provide-agent.ts` — MODIFY: `AgUiAgent<T>`, ref overloads.

**Examples (forcing functions)**
- `cockpit/ag-ui/client-tools/angular/`, `cockpit/langgraph/client-tools/angular/`, `examples/ag-ui/angular/` — MODIFY: typed APIs + `strict: true`.
- `examples/chat/angular/`, one `cockpit/langgraph/*`, one `cockpit/chat/*` — MODIFY: `createAgentRef`.

---

## Task 1: Type-test harness (WS5 foundation)

**Files:**
- Create: `libs/chat/src/testing/type-assert.ts`
- Create: `libs/chat/tsconfig.type-tests.json`
- Create: `libs/chat/src/lib/client-tools/tools.type-spec.ts` (smoke)
- Modify: `libs/chat/project.json`

- [ ] **Step 1: Create the type-assertion kit**

`libs/chat/src/testing/type-assert.ts`:
```ts
// SPDX-License-Identifier: MIT
/** Compile-time assertion helpers for *.type-spec.ts files (no runtime, no vitest dep). */

/** Exact-type equality (invariant). `Equal<A, B>` is `true` iff A and B are identical. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** Passes only when `T` is exactly `true`; otherwise a compile error. */
export type Expect<T extends true> = T;

/** True if `A` is assignable to `B`. */
export type Assignable<A, B> = A extends B ? true : false;
```

- [ ] **Step 2: Create the strict type-tests tsconfig**

`libs/chat/tsconfig.type-tests.json`:
```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "strictFunctionTypes": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src/**/*.type-spec.ts", "src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 3: Add a smoke type-spec that should pass immediately**

`libs/chat/src/lib/client-tools/tools.type-spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { Equal, Expect } from '../../testing/type-assert';

// Harness smoke — proves the type-test pipeline runs.
type _smoke = Expect<Equal<1, 1>>;
```

- [ ] **Step 4: Add the nx `type-tests` target**

In `libs/chat/project.json`, add to `targets`:
```json
"type-tests": {
  "executor": "nx:run-commands",
  "options": {
    "command": "tsc --noEmit -p libs/chat/tsconfig.type-tests.json"
  }
}
```

- [ ] **Step 5: Run the gate — expect PASS (harness only)**

Run: `npx nx type-tests chat`
Expected: exits 0 (only the smoke assertion present).

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/testing/type-assert.ts libs/chat/tsconfig.type-tests.json \
  libs/chat/src/lib/client-tools/tools.type-spec.ts libs/chat/project.json
git commit -m "test(chat): strict type-test harness (Equal/Expect + tsconfig + nx target)"
```

---

## Task 2: WS1 — variance-safe tool-def types

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts`
- Modify: `libs/chat/src/lib/client-tools/tools.type-spec.ts`

- [ ] **Step 1: Write the failing type-spec**

Replace the body of `libs/chat/src/lib/client-tools/tools.type-spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { Equal, Expect } from '../../testing/type-assert';
import type { StandardSchemaV1 } from '@threadplane/render';
import type { FunctionToolDef, ClientToolDef } from './tool-def';
import { action, tools } from './tools';
import { z } from 'zod/v4';

const moveSchema = z.object({ fromDay: z.number(), placeId: z.string() });

// action() infers handler arg from the schema output and carries the return type R.
const moveAction = action('Move a stop', moveSchema, (a) => a.fromDay + 1);
type _argInfer = Expect<Equal<Parameters<typeof moveAction.handler>[0], { fromDay: number; placeId: string }>>;
type _retInfer = Expect<Equal<typeof moveAction, FunctionToolDef<typeof moveSchema, number>>>;

// A precise FunctionToolDef must be assignable into the bivariant union.
const _u: ClientToolDef = moveAction;

// tools() preserves per-key tool types AND literal keys under strict.
const registry = tools({
  move_stop: moveAction,
  note: action('Note', z.object({ text: z.string() }), (a) => a.text),
});
type _keys = Expect<Equal<keyof typeof registry, 'move_stop' | 'note'>>;
type _perKey = Expect<Equal<(typeof registry)['move_stop'], FunctionToolDef<typeof moveSchema, number>>>;
```

- [ ] **Step 2: Run the gate — expect FAIL**

Run: `npx nx type-tests chat`
Expected: FAIL — `tools()` currently returns `ClientToolRegistry` (widened), so `_keys`/`_perKey` error; `FunctionToolDef` has no `R` param so `_retInfer` errors.

- [ ] **Step 3: Rewrite `tool-def.ts`**

`libs/chat/src/lib/client-tools/tool-def.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';

/** Precise authored function tool — what `action()` returns. Carries the schema
 *  `S` and the handler's resolved return type `R`. */
export interface FunctionToolDef<S extends StandardSchemaV1 = StandardSchemaV1, R = unknown> {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: S;
  readonly handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>;
}

/** Bivariant union member used only for registry storage/iteration. The handler
 *  param is `any` (NOT `never`): `any` is simultaneously a supertype any precise
 *  `FunctionToolDef<S,R>` is assignable to under `strictFunctionTypes`, AND
 *  callable by internal code that has narrowed by `kind` and parsed runtime args.
 *  A `never` param would satisfy the former but break the latter. */
export interface AnyFunctionToolDef {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: StandardSchemaV1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bivariance escape hatch; see note above
  readonly handler: (args: any) => unknown | Promise<unknown>;
}

export interface ViewToolDef<S extends StandardSchemaV1 = StandardSchemaV1, C = unknown> {
  readonly kind: 'view';
  readonly description: string;
  readonly schema: S;
  readonly component: Type<C>;
}

export interface AskToolDef<S extends StandardSchemaV1 = StandardSchemaV1, C = unknown> {
  readonly kind: 'ask';
  readonly description: string;
  readonly schema: S;
  readonly component: Type<C>;
}

/** A client tool the model can call; executed in the browser. */
export type ClientToolDef =
  | AnyFunctionToolDef
  | ViewToolDef
  | AskToolDef;

/** A frozen, name-keyed registry of client tools. */
export type ClientToolRegistry = Readonly<Record<string, ClientToolDef>>;
```

- [ ] **Step 4: Run the gate — expect partial progress**

Run: `npx nx type-tests chat`
Expected: still FAILS on `_keys`/`_perKey` (tools.ts not yet generic) but `_retInfer`/`_argInfer`/`_u` now depend on Task 3. Proceed to Task 3 before re-running.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/client-tools/tool-def.ts
git commit -m "feat(chat): variance-safe ClientToolDef (FunctionToolDef<S,R> + bivariant AnyFunctionToolDef)"
```

---

## Task 3: WS1 — generic `action` + `tools`

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tools.ts`

- [ ] **Step 1: Rewrite `action` and `tools` (view/ask updated in Task 5)**

In `libs/chat/src/lib/client-tools/tools.ts`, replace the `action` and `tools` definitions (leave `view`/`ask` for Task 5). Update the imports to add `ClientToolDef` and the `FunctionToolDef` generic:
```ts
// SPDX-License-Identifier: MIT
import type { Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';
import type { ClientToolDef, FunctionToolDef } from './tool-def';

/** Async function tool — its resolved return value becomes the tool result. */
export function action<S extends StandardSchemaV1, R>(
  description: string,
  schema: S,
  handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>,
): FunctionToolDef<S, R> {
  return { kind: 'function', description, schema, handler };
}

// ... view()/ask() remain here for now (updated in Task 5) ...

/** Collect named client tools into a frozen registry (the key is the tool name).
 *  Generic + `const` over the map so per-tool types and literal keys survive. */
export function tools<const M extends Record<string, ClientToolDef>>(map: M): Readonly<M> {
  return Object.freeze({ ...map });
}
```

- [ ] **Step 2: Run the gate — expect the WS1 assertions to PASS**

Run: `npx nx type-tests chat`
Expected: PASS for all assertions in `tools.type-spec.ts` (`_argInfer`, `_retInfer`, `_u`, `_keys`, `_perKey`).

- [ ] **Step 3: Run the chat unit suite + lint to catch internal call-site fallout**

Run: `npx nx run-many -t test lint --projects=chat --skip-nx-cache`
Expected: PASS. The `any`-param member keeps `coordinator`/`executor` `def.handler(args)` calls valid. If any internal site that previously relied on `ClientToolRegistry` now sees a narrowed type, fix by reading through `ClientToolDef` (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/client-tools/tools.ts
git commit -m "feat(chat): generic tools()/action() — strict-safe registry with per-key + literal-key types"
```

---

## Task 4: WS2 — component-input extraction types

**Files:**
- Create: `libs/chat/src/lib/client-tools/component-inputs.ts`
- Create: `libs/chat/src/lib/client-tools/view-ask.type-spec.ts`

- [ ] **Step 1: Create the type machinery**

`libs/chat/src/lib/client-tools/component-inputs.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { InputSignal, InputSignalWithTransform, Type } from '@angular/core';
import type { StandardSchemaV1, StandardSchemaInferOutput } from '@threadplane/render';

/** Value type carried by an Angular signal input. */
type InputValue<P> =
  P extends InputSignal<infer T> ? T :
  P extends InputSignalWithTransform<infer T, infer _U> ? T :
  never;

/** A component instance's declared signal inputs, as a plain prop bag. */
export type ComponentInputs<C> = {
  [K in keyof C as C[K] extends InputSignal<unknown> | InputSignalWithTransform<unknown, unknown>
    ? K
    : never]: InputValue<C[K]>;
};

/** STRICT: every prop the schema PRODUCES must be a declared input with an
 *  assignable type. FLEXIBLE: the component may declare extra inputs the schema
 *  doesn't fill. A schema key absent from `Inputs` maps to `never`, so its
 *  (non-never) value fails assignment and the error pins to that prop. */
export type CompatibleProps<Out, Inputs> = {
  [K in keyof Out]: K extends keyof Inputs ? Inputs[K] : never;
};

/** The accepted `component` parameter type for `view`/`ask`: the real component
 *  `Type<C>` when the schema output is compatible, else a labelled error tuple
 *  that surfaces both shapes in the compiler message. */
export type AcceptComponent<S extends StandardSchemaV1, C> =
  StandardSchemaInferOutput<S> extends CompatibleProps<StandardSchemaInferOutput<S>, ComponentInputs<C>>
    ? Type<C>
    : readonly [
        'Schema output is not assignable to this component’s inputs',
        StandardSchemaInferOutput<S>,
        ComponentInputs<C>,
      ];

/** Reverse helper: derive a component's input prop types FROM a schema, so a
 *  component authored straight from the schema is guaranteed compatible. */
export type ViewProps<S extends StandardSchemaV1> = StandardSchemaInferOutput<S>;
```

- [ ] **Step 2: Write the failing type-spec (good + 3 bad + assignable-to-union)**

`libs/chat/src/lib/client-tools/view-ask.type-spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import { z } from 'zod/v4';
import type { ClientToolDef, ViewToolDef } from './tool-def';
import { view, ask } from './tools';
import { tools } from './tools';

@Component({ template: '' })
class DayCardComponent {
  day = input.required<number>();
  places = input<string[]>([]);       // optional (default)
  highlight = input<boolean>(false);  // extra input NOT in schema
}

@Component({ template: '' })
class UnrelatedComponent {
  title = input.required<string>();
}

const daySchema = z.object({ day: z.number(), places: z.array(z.string()) });

// ✅ good — schema output keys ⊆ inputs, compatible types; extra `highlight` allowed.
const dayView = view('Show a day', daySchema, DayCardComponent);

// the view tool stays assignable to the registry union and through tools().
const _u: ClientToolDef = dayView;
const _reg = tools({ day_card: view('Show a day', daySchema, DayCardComponent) });

// the result carries the component type.
const _carries: ViewToolDef<typeof daySchema, DayCardComponent> = dayView;

// ❌ typo prop the component can't receive.
const typoSchema = z.object({ dayz: z.number() });
// @ts-expect-error  `dayz` is not an input of DayCardComponent
const _bad1 = view('typo', typoSchema, DayCardComponent);

// ❌ type mismatch (day: string vs input number).
const wrongType = z.object({ day: z.string() });
// @ts-expect-error  day: string not assignable to input day: number
const _bad2 = view('wrong type', wrongType, DayCardComponent);

// ❌ unrelated component.
// @ts-expect-error  schema output {day, places} has no matching inputs on UnrelatedComponent
const _bad3 = ask('unrelated', daySchema, UnrelatedComponent);
```

- [ ] **Step 3: Run the gate — expect FAIL**

Run: `npx nx type-tests chat`
Expected: FAIL — `view`/`ask` are still non-generic (`component: Type<unknown>`), so the good case has no linkage and the three `@ts-expect-error` lines are *unused* (which is itself a compile error). Implemented in Task 5.

- [ ] **Step 4: Commit (machinery only; spec stays red until Task 5)**

```bash
git add libs/chat/src/lib/client-tools/component-inputs.ts libs/chat/src/lib/client-tools/view-ask.type-spec.ts
git commit -m "feat(chat): ComponentInputs/AcceptComponent type machinery for view/ask linkage"
```

---

## Task 5: WS2 — generic `view` / `ask`

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tools.ts`

- [ ] **Step 1: Make `view`/`ask` generic + export `ViewProps`**

In `libs/chat/src/lib/client-tools/tools.ts`, replace the `view` and `ask` functions and extend imports:
```ts
import type { ViewToolDef, AskToolDef } from './tool-def';
import type { AcceptComponent } from './component-inputs';
export type { ViewProps } from './component-inputs';

/** Render-only component tool — the model fills its props; auto-acknowledged.
 *  The component's signal inputs are checked against the schema's output type. */
export function view<S extends StandardSchemaV1, C>(
  description: string,
  schema: S,
  component: AcceptComponent<S, C>,
): ViewToolDef<S, C> {
  return { kind: 'view', description, schema, component: component as Type<C> };
}

/** Interactive (HITL) component tool — the value it emits becomes the result.
 *  The component's signal inputs are checked against the schema's output type. */
export function ask<S extends StandardSchemaV1, C>(
  description: string,
  schema: S,
  component: AcceptComponent<S, C>,
): AskToolDef<S, C> {
  return { kind: 'ask', description, schema, component: component as Type<C> };
}
```

- [ ] **Step 2: Run the gate — expect PASS**

Run: `npx nx type-tests chat`
Expected: PASS — good case compiles, `_u`/`_reg`/`_carries` hold, all three `@ts-expect-error` lines are now *used* (the bad cases genuinely error).

- [ ] **Step 3: Run chat unit suite + lint**

Run: `npx nx run-many -t test lint --projects=chat --skip-nx-cache`
Expected: PASS (the `as Type<C>` cast keeps the runtime object shape identical; coordinator reads `component` unchanged).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/client-tools/tools.ts
git commit -m "feat(chat): generic view()/ask() — strict-but-flexible schema<->component input linkage"
```

---

## Task 6: WS3 — genericize the neutral `Agent` contract

**Files:**
- Modify: `libs/chat/src/lib/agent/agent.ts`
- Modify: `libs/chat/src/lib/agent/agent-with-history.ts`

- [ ] **Step 1: Genericize `Agent`**

In `libs/chat/src/lib/agent/agent.ts`, change the interface declaration and the `state` member:
```ts
export interface Agent<TState = Record<string, unknown>> {
  // ...unchanged members...
  state: Signal<TState>;
  // ...rest unchanged...
}
```
(Only the `interface Agent` line and `state:` line change; everything else stays.)

- [ ] **Step 2: Thread the param through `AgentWithHistory`**

In `libs/chat/src/lib/agent/agent-with-history.ts`:
```ts
export interface AgentWithHistory<TState = Record<string, unknown>> extends Agent<TState> {
  history: Signal<AgentCheckpoint[]>;
  messageCheckpoints?: Signal<ReadonlyMap<string, string>>;
}
```

- [ ] **Step 3: Build chat + the adapters to confirm the default contains the ripple**

Run: `npx nx run-many -t build --projects=chat,langgraph,ag-ui --skip-nx-cache`
Expected: PASS. The `= Record<string, unknown>` default means every existing `Agent` / `AgentWithHistory` reference is unchanged. If `LangGraphAgent extends AgentWithHistory` now needs `AgentWithHistory<T>` to surface typed `state`, that is done in Task 8 — a plain build here should still pass because `LangGraphAgent<T = unknown>` defaulting keeps it valid.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/agent/agent.ts libs/chat/src/lib/agent/agent-with-history.ts
git commit -m "feat(chat): genericize Agent<TState> + AgentWithHistory<TState> (default Record<string,unknown>)"
```

---

## Task 7: WS3 — `createAgentRef` typed DI handle

**Files:**
- Create: `libs/chat/src/lib/agent/agent-ref.ts`
- Modify: `libs/chat/src/lib/agent/index.ts`
- Create: `libs/chat/src/lib/agent/agent-ref.type-spec.ts`

- [ ] **Step 1: Write the failing type-spec**

`libs/chat/src/lib/agent/agent-ref.type-spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { InjectionToken } from '@angular/core';
import type { Equal, Expect } from '../../testing/type-assert';
import type { Agent } from './agent';
import { createAgentRef, type AgentRef } from './agent-ref';

interface TripState { day: number; places: string[]; }

const trip = createAgentRef<TripState>('trip');
type _refTyped = Expect<Equal<typeof trip, AgentRef<TripState>>>;
type _tokenTyped = Expect<Equal<typeof trip.token, InjectionToken<Agent<TripState>>>>;
```

- [ ] **Step 2: Run the gate — expect FAIL**

Run: `npx nx type-tests chat`
Expected: FAIL — module `./agent-ref` does not exist.

- [ ] **Step 3: Create `agent-ref.ts`**

`libs/chat/src/lib/agent/agent-ref.ts`:
```ts
// SPDX-License-Identifier: MIT
import { InjectionToken } from '@angular/core';
import type { Agent } from './agent';

/** A typed handle that threads a state shape through Angular DI from
 *  `provideAgent(ref, …)` to `injectAgent(ref)` without per-call-site
 *  restatement of the generic. */
export interface AgentRef<TState> {
  readonly token: InjectionToken<Agent<TState>>;
}

/**
 * Create a typed agent handle.
 *
 * @param debugName Optional name shown in Angular DI error messages.
 * @returns An {@link AgentRef} carrying a state-typed `InjectionToken`.
 * @example
 * ```ts
 * interface TripState { day: number; places: string[]; }
 * export const TRIP = createAgentRef<TripState>('trip');
 * // app.config.ts: provideAgent(TRIP, { assistantId: 'trip' })
 * // component:     const agent = injectAgent(TRIP); // LangGraphAgent<TripState>
 * ```
 */
export function createAgentRef<TState>(debugName?: string): AgentRef<TState> {
  return { token: new InjectionToken<Agent<TState>>(debugName ?? 'ThreadplaneAgent') };
}
```

- [ ] **Step 4: Export from the agent barrel**

In `libs/chat/src/lib/agent/index.ts`, add:
```ts
export type { AgentRef } from './agent-ref';
export { createAgentRef } from './agent-ref';
```

- [ ] **Step 5: Run the gate — expect PASS**

Run: `npx nx type-tests chat`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/agent/agent-ref.ts libs/chat/src/lib/agent/index.ts libs/chat/src/lib/agent/agent-ref.type-spec.ts
git commit -m "feat(chat): createAgentRef typed DI handle (AgentRef<TState>)"
```

---

## Task 8: WS3 — LangGraph `provideAgent`/`injectAgent` ref overloads

**Files:**
- Modify: `libs/langgraph/src/lib/agent.types.ts` (LangGraphAgent extends `AgentWithHistory<T>`)
- Modify: `libs/langgraph/src/lib/agent.provider.ts`
- Modify: `libs/langgraph/src/lib/inject-agent.ts`
- Create: `libs/langgraph/tsconfig.type-tests.json`, `libs/langgraph/src/lib/inject-agent.type-spec.ts`
- Modify: `libs/langgraph/project.json`

- [ ] **Step 1: Set up the langgraph type-test gate**

`libs/langgraph/tsconfig.type-tests.json`:
```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "strictFunctionTypes": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src/**/*.type-spec.ts", "src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```
Add to `libs/langgraph/project.json` `targets`:
```json
"type-tests": {
  "executor": "nx:run-commands",
  "options": {
    "command": "tsc --noEmit -p libs/langgraph/tsconfig.type-tests.json"
  }
}
```

- [ ] **Step 2: Write the failing type-spec**

`libs/langgraph/src/lib/inject-agent.type-spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import type { Signal } from '@angular/core';
import { createAgentRef } from '@threadplane/chat';
import type { Equal, Expect } from '@threadplane/chat/testing';
import { injectAgent } from './inject-agent';
import type { LangGraphAgent } from './agent.types';

interface TripState { day: number; places: string[]; }
const TRIP = createAgentRef<TripState>('trip');

declare function ctx<T>(fn: () => T): T;

// injectAgent(ref) is typed LangGraphAgent<TripState>; state is Signal<TripState>.
const typed = ctx(() => injectAgent(TRIP));
type _agent = Expect<Equal<typeof typed, LangGraphAgent<TripState>>>;
type _state = Expect<Equal<ReturnType<typeof typed.state>, TripState>>;
type _value = Expect<Equal<ReturnType<typeof typed.value>, TripState>>;

// no-arg form stays valid (default state).
const plain = ctx(() => injectAgent());
type _plainState = Expect<Equal<ReturnType<typeof plain.state>, Record<string, unknown>>>;
```
> Note: this references `@threadplane/chat/testing`. If `Equal`/`Expect` are not already re-exported there, import them via a relative path to the chat source `type-assert.ts` instead, or add the re-export in Task 10. Prefer adding the re-export in Task 10 and using the package path here.

- [ ] **Step 3: Run the gate — expect FAIL**

Run: `npx nx type-tests langgraph`
Expected: FAIL — `injectAgent(ref)` overload does not exist; `LangGraphAgent` `state` not yet typed off `T`.

- [ ] **Step 4: Make `LangGraphAgent` surface typed state**

In `libs/langgraph/src/lib/agent.types.ts`, change the declaration:
```ts
export interface LangGraphAgent<T = unknown, ResolvedBag extends BagTemplate = BagTemplate>
  extends AgentWithHistory<T> {
```
(`AgentWithHistory<T>` now flows `T` into the inherited `state: Signal<T>`. Import `AgentWithHistory` from `@threadplane/chat` if not already.)

- [ ] **Step 5: Add the ref overloads to `provideAgent`**

In `libs/langgraph/src/lib/agent.provider.ts`, replace the single `provideAgent` signature with overloads (keep the existing body, route the token):
```ts
import type { AgentRef } from '@threadplane/chat';

export function provideAgent<T = Record<string, unknown>>(
  ref: AgentRef<T>,
  configOrFactory: AgentConfig<T> | (() => AgentConfig<T>),
): Provider[];
export function provideAgent<T = Record<string, unknown>>(
  configOrFactory: AgentConfig<T> | (() => AgentConfig<T>),
): Provider[];
export function provideAgent<T = Record<string, unknown>>(
  refOrConfig: AgentRef<T> | AgentConfig<T> | (() => AgentConfig<T>),
  maybeConfig?: AgentConfig<T> | (() => AgentConfig<T>),
): Provider[] {
  const ref = isAgentRef<T>(refOrConfig) ? refOrConfig : undefined;
  const configOrFactory = (ref ? maybeConfig : refOrConfig) as
    | AgentConfig<T>
    | (() => AgentConfig<T>);

  const resolveConfig = (): AgentConfig<T> =>
    typeof configOrFactory === 'function' ? configOrFactory() : configOrFactory;

  const providers: Provider[] = [
    { provide: AGENT_CONFIG, useFactory: resolveConfig },
    { provide: AGENT, useFactory: agentFactory<T> },
  ];
  // Also bind the typed ref token to the same singleton, when a ref is used.
  if (ref) {
    providers.push({ provide: ref.token, useExisting: AGENT });
  }
  return providers;
}
```
Extract the existing `useFactory` body into a named `agentFactory<T>()` (same logic, currently inline) so both `AGENT` and the ref alias resolve one singleton. Add the guard:
```ts
function isAgentRef<T>(x: unknown): x is AgentRef<T> {
  return typeof x === 'object' && x !== null && 'token' in x;
}
```

- [ ] **Step 6: Add the ref overload to `injectAgent`**

`libs/langgraph/src/lib/inject-agent.ts`:
```ts
import { inject } from '@angular/core';
import type { BagTemplate } from '@langchain/langgraph-sdk';
import type { AgentRef } from '@threadplane/chat';
import { AGENT } from './agent.provider';
import type { LangGraphAgent } from './agent.types';

export function injectAgent(): LangGraphAgent;
export function injectAgent<T, ResolvedBag extends BagTemplate = BagTemplate>(
  ref: AgentRef<T>,
): LangGraphAgent<T, ResolvedBag>;
export function injectAgent<T, ResolvedBag extends BagTemplate = BagTemplate>(
  ref?: AgentRef<T>,
): LangGraphAgent<T, ResolvedBag> {
  return inject(ref ? ref.token : AGENT) as LangGraphAgent<T, ResolvedBag>;
}
```
(The bare `injectAgent<T>()` generic-only form is removed; callers either use the default or pass a ref.)

- [ ] **Step 7: Run the gate + langgraph suite**

Run: `npx nx type-tests langgraph && npx nx run-many -t test lint build --projects=langgraph --skip-nx-cache`
Expected: PASS. (If the type-spec import of `@threadplane/chat/testing` fails, complete Task 10's re-export first, then re-run.)

- [ ] **Step 8: Commit**

```bash
git add libs/langgraph/src/lib/agent.types.ts libs/langgraph/src/lib/agent.provider.ts \
  libs/langgraph/src/lib/inject-agent.ts libs/langgraph/tsconfig.type-tests.json \
  libs/langgraph/src/lib/inject-agent.type-spec.ts libs/langgraph/project.json
git commit -m "feat(langgraph): provideAgent/injectAgent AgentRef overloads — typed state through DI"
```

---

## Task 9: WS3 — AG-UI generic agent + ref overloads

**Files:**
- Modify: `libs/ag-ui/src/lib/to-agent.ts` (`AgUiAgent<T>`)
- Modify: `libs/ag-ui/src/lib/provide-agent.ts`

- [ ] **Step 1: Genericize `AgUiAgent`**

In `libs/ag-ui/src/lib/to-agent.ts`, change the `AgUiAgent` interface to extend the generic neutral contract:
```ts
export interface AgUiAgent<TState = Record<string, unknown>> extends Agent<TState> {
  // ...existing extensions (customEvents, clientTools, subagents) unchanged...
}
```
`toAgent` keeps returning `AgUiAgent` (default state); no signature change needed beyond the interface.

- [ ] **Step 2: Add ref overloads to `provideAgent` + `injectAgent`**

In `libs/ag-ui/src/lib/provide-agent.ts`:
```ts
import type { AgentRef } from '@threadplane/chat';

export function provideAgent<T = Record<string, unknown>>(
  ref: AgentRef<T>,
  configOrFactory: AgentConfig | (() => AgentConfig),
): Provider[];
export function provideAgent(
  configOrFactory: AgentConfig | (() => AgentConfig),
): Provider[];
export function provideAgent<T = Record<string, unknown>>(
  refOrConfig: AgentRef<T> | AgentConfig | (() => AgentConfig),
  maybeConfig?: AgentConfig | (() => AgentConfig),
): Provider[] {
  const ref = isAgentRef<T>(refOrConfig) ? refOrConfig : undefined;
  const configOrFactory = (ref ? maybeConfig : refOrConfig) as
    | AgentConfig
    | (() => AgentConfig);
  const providers: Provider[] = [
    { provide: AGENT, useFactory: () => buildAgUiAgent(configOrFactory) },
  ];
  if (ref) providers.push({ provide: ref.token, useExisting: AGENT });
  return providers;
}

export function injectAgent(): AgUiAgent;
export function injectAgent<T>(ref: AgentRef<T>): AgUiAgent<T>;
export function injectAgent<T>(ref?: AgentRef<T>): AgUiAgent<T> {
  return inject(ref ? ref.token : AGENT) as AgUiAgent<T>;
}

function isAgentRef<T>(x: unknown): x is AgentRef<T> {
  return typeof x === 'object' && x !== null && 'token' in x;
}
```
Extract the existing HttpAgent-construction `useFactory` body into a `buildAgUiAgent(configOrFactory)` helper (same logic).

- [ ] **Step 3: Run ag-ui suite + build**

Run: `npx nx run-many -t test lint build --projects=ag-ui --skip-nx-cache`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/src/lib/to-agent.ts libs/ag-ui/src/lib/provide-agent.ts
git commit -m "feat(ag-ui): genericize AgUiAgent<T> + provideAgent/injectAgent AgentRef overloads"
```

---

## Task 10: WS4 — Prettify hovers + re-exports

**Files:**
- Create: `libs/chat/src/lib/internals/prettify.ts`
- Modify: `libs/chat/src/lib/client-tools/tool-def.ts` (wrap inferred surfaces)
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/testing/` barrel (re-export `Equal`/`Expect`)

- [ ] **Step 1: Add the internal `Prettify` helper**

`libs/chat/src/lib/internals/prettify.ts`:
```ts
// SPDX-License-Identifier: MIT
/**
 * @internal
 * Identity mapped type that flattens an object type so editor quick-info shows
 * the expanded shape instead of a raw conditional/mapped-type expression.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

- [ ] **Step 2: Apply `Prettify` to the inferred public surfaces**

In `libs/chat/src/lib/client-tools/component-inputs.ts`, wrap `ViewProps`:
```ts
import type { Prettify } from '../internals/prettify';
export type ViewProps<S extends StandardSchemaV1> = Prettify<StandardSchemaInferOutput<S>>;
```
(Leave `tool-def.ts` interfaces as-is — interfaces already hover cleanly; `Prettify` is for inferred *type aliases* like `ViewProps` and `ToolArgs`.)

- [ ] **Step 3: Add re-exports to the chat public API**

In `libs/chat/src/public-api.ts`, in the client-tools block:
```ts
export { tools, action, view, ask } from './lib/client-tools/tools';
export type { ViewProps } from './lib/client-tools/component-inputs';
// Schema typing helpers (so consumers don't reach into @threadplane/render):
export type {
  StandardSchemaV1,
  StandardSchemaInferInput,
  StandardSchemaInferOutput,
} from '@threadplane/render';
/** Inferred argument type for a schema (alias of StandardSchemaInferOutput). */
export type ToolArgs<S extends import('@threadplane/render').StandardSchemaV1> =
  import('@threadplane/render').StandardSchemaInferOutput<S>;
export type {
  FunctionToolDef, AnyFunctionToolDef, ViewToolDef, AskToolDef, ClientToolDef, ClientToolRegistry,
} from './lib/client-tools/tool-def';
```
And ensure the agent block re-exports the ref (it flows from the `./lib/agent` barrel updated in Task 7 — confirm `AgentRef`/`createAgentRef` appear in `public-api.ts`'s `export … from './lib/agent'`; add explicitly if the barrel is enumerated):
```ts
export { createAgentRef } from './lib/agent';
export type { AgentRef } from './lib/agent';
```

- [ ] **Step 4: Re-export the type-assert kit from `@threadplane/chat/testing`**

Find the testing secondary entry point (`libs/chat/src/testing.ts` or `libs/chat/testing/`); add:
```ts
export type { Equal, Expect, Assignable } from './testing/type-assert';
```
> If the testing entry point imports vitest at module level, keep `type-assert` import as a `export type` only (it has no runtime), so it stays bundle-safe.

- [ ] **Step 5: Verify chat builds, type-tests pass, langgraph type-spec resolves the testing import**

Run: `npx nx run-many -t build type-tests --projects=chat --skip-nx-cache && npx nx type-tests langgraph`
Expected: PASS, including the langgraph `inject-agent.type-spec.ts` import of `@threadplane/chat/testing`.

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/internals/prettify.ts libs/chat/src/lib/client-tools/component-inputs.ts \
  libs/chat/src/public-api.ts libs/chat/src/testing* 
git commit -m "feat(chat): Prettify hovers + re-export StandardSchema*/ToolArgs/AgentRef + testing type-assert"
```

---

## Task 11: WS4 — JSDoc with `@example` on hero exports

**Files:**
- Modify: `libs/chat/src/lib/client-tools/tools.ts`
- Modify: `libs/chat/src/lib/provide-chat.ts`
- Modify: `libs/render/src/lib/provide-render.ts`, `libs/render/src/lib/define-angular-registry.ts`
- (`createAgentRef`, `provideAgent`/`injectAgent` JSDoc already added in their tasks.)

- [ ] **Step 1: Add `@param`/`@returns`/`@example` to `tools`/`action`/`view`/`ask`**

Replace the terse one-line comments in `libs/chat/src/lib/client-tools/tools.ts`. Example for `action`:
```ts
/**
 * Declare an async function tool the model can call; its resolved return value
 * becomes the tool result shipped back to the model.
 *
 * @param description Natural-language description the model sees.
 * @param schema Standard Schema (e.g. a Zod object) for the tool's arguments;
 *   the handler's argument type is inferred from it.
 * @param handler Runs in the browser when the model calls the tool.
 * @returns A {@link FunctionToolDef} for inclusion in {@link tools}.
 * @example
 * ```ts
 * const move = action('Move a stop', z.object({ fromDay: z.number() }), (a) => a.fromDay);
 * const registry = tools({ move_stop: move });
 * ```
 */
```
Add equivalents for `view`, `ask` (mention the schema↔component input check + `ViewProps`) and `tools` (mention literal-key/per-key preservation). Keep each accurate to the signatures from Tasks 3 & 5.

- [ ] **Step 2: Add JSDoc to `provideChat`, `provideRender`, `defineAngularRegistry`**

Add a `@param`/`@returns`/`@example` block to each (they currently have none). Example for `defineAngularRegistry` mentions the `getEntry` accessor.

- [ ] **Step 3: Verify hovers compile (build the libs)**

Run: `npx nx run-many -t build lint --projects=chat,render --skip-nx-cache`
Expected: PASS (JSDoc is comments; this confirms nothing else regressed).

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/client-tools/tools.ts libs/chat/src/lib/provide-chat.ts \
  libs/render/src/lib/provide-render.ts libs/render/src/lib/define-angular-registry.ts
git commit -m "docs(chat,render): @param/@returns/@example JSDoc on hero exports"
```

---

## Task 12: Tier-1 forcing function — `cockpit/ag-ui/client-tools`

**Files:**
- Modify: `cockpit/ag-ui/client-tools/angular/tsconfig.json` (flip `strict`)
- Modify: `cockpit/ag-ui/client-tools/angular/src/app/client-tools.component.ts`
- Modify: `cockpit/ag-ui/client-tools/angular/src/app/app.config.ts`
- Modify: the view/ask component(s) under that app (input types to match schemas)

- [ ] **Step 1: Flip the app to strict**

In `cockpit/ag-ui/client-tools/angular/tsconfig.json`, set `"strict": true` (remove `"strict": false`). Leave `angularCompilerOptions` as-is unless step 4 requires `strictTemplates`.

- [ ] **Step 2: Build — observe the failures (the forcing function in action)**

Run: `npx nx build cockpit-ag-ui-client-tools-angular`
Expected: FAIL with `strictFunctionTypes`/typing errors on the `tools({...})` registry and any untyped `view`/`ask` components — this is the bug surfacing exactly as a real consumer would see it.

- [ ] **Step 3: Migrate call sites to the typed APIs**

Update `client-tools.component.ts` so `tools({...})` composes `action`/`view`/`ask` results directly (the typed registry now compiles). For each `view`/`ask`, ensure the paired component's signal inputs match the schema output (use `ViewProps<typeof schema>` to type a component input bag where helpful). Fix any genuine schema↔component mismatches the compiler now flags.

- [ ] **Step 4: Resolve remaining strict fallout**

Fix any unrelated `strict` errors in this app's own code (implicit `any`, null checks). If the fallout is disproportionate and unrelated to the typed APIs, fall back to adding only `"strictFunctionTypes": true` to this app's tsconfig (the exact flag that masked the bug) and note it in the commit body.

- [ ] **Step 5: Build green**

Run: `npx nx build cockpit-ag-ui-client-tools-angular`
Expected: PASS under strict.

- [ ] **Step 6: Commit**

```bash
git add cockpit/ag-ui/client-tools/angular
git commit -m "test(cockpit/ag-ui): client-tools app on strict:true + typed tools/view/ask (forcing function)"
```

---

## Task 13: Tier-1 forcing function — `cockpit/langgraph/client-tools`

**Files:**
- Modify: `cockpit/langgraph/client-tools/angular/tsconfig.json`
- Modify: `cockpit/langgraph/client-tools/angular/src/app/client-tools.component.ts`
- Modify: `cockpit/langgraph/client-tools/angular/src/app/app.config.ts` (optionally `createAgentRef`)
- Modify: paired view/ask components

- [ ] **Step 1: Flip to strict**

Set `"strict": true` in `cockpit/langgraph/client-tools/angular/tsconfig.json`.

- [ ] **Step 2: Build — observe failures**

Run: `npx nx build cockpit-langgraph-client-tools-angular`
Expected: FAIL (same class of typed-registry/view-ask errors).

- [ ] **Step 3: Migrate to typed APIs + a typed agent ref**

Same migration as Task 12 for `tools/view/ask`. Additionally define a `createAgentRef<TState>()` for this app's state and use `provideAgent(ref, {...})` + `injectAgent(ref)` so the LangGraph typed-state path is exercised end to end.

- [ ] **Step 4: Resolve remaining strict fallout (same fallback rule as Task 12 step 4).**

- [ ] **Step 5: Build green**

Run: `npx nx build cockpit-langgraph-client-tools-angular`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cockpit/langgraph/client-tools/angular
git commit -m "test(cockpit/langgraph): client-tools app on strict:true + typed tools/view/ask + createAgentRef"
```

---

## Task 14: Tier-1 forcing function — `examples/ag-ui` (canonical itinerary)

**Files:**
- Modify: `examples/ag-ui/angular/tsconfig.json`
- Modify: `examples/ag-ui/angular/src/app/client-tools.ts`
- Modify: `examples/ag-ui/angular/src/app/app.config.ts`, `shell/ag-ui-shell.component.ts`
- Modify: the itinerary view/ask components (e.g. `day_card`, `clear_day`) input types

- [ ] **Step 1: Flip to strict**

Set `"strict": true` in `examples/ag-ui/angular/tsconfig.json`.

- [ ] **Step 2: Build — observe failures**

Run: `npx nx build examples-ag-ui-angular`
Expected: FAIL (typed registry + view/ask linkage on the real itinerary tools).

- [ ] **Step 3: Migrate the canonical demo**

Update `client-tools.ts` to the typed registry; ensure `day_card`/`clear_day`/etc. components' signal inputs match their schemas (this is the demo that surfaced NG0950 — typed linkage now guards it at compile time). Use `createAgentRef` for the itinerary state and wire `provideAgent(ref, …)` / `injectAgent(ref)`.

- [ ] **Step 4: Resolve remaining strict fallout (same fallback rule).**

- [ ] **Step 5: Build green**

Run: `npx nx build examples-ag-ui-angular`
Expected: PASS under strict.

- [ ] **Step 6: Commit**

```bash
git add examples/ag-ui/angular
git commit -m "test(examples/ag-ui): canonical itinerary on strict:true + typed client-tools + createAgentRef (forcing function)"
```

---

## Task 15: Tier-2 — build-net + representative `createAgentRef` migrations

**Files:**
- Modify: `examples/chat/angular/src/app/shell/demo-shell.component.ts` (+ `app.config.ts`)
- Modify: one `cockpit/langgraph/*` app (e.g. `cockpit/langgraph/streaming/angular`) — `createAgentRef`
- Modify: one `cockpit/chat/*` app (e.g. `cockpit/chat/messages/angular`) — `createAgentRef`

- [ ] **Step 1: Migrate `examples/chat` to a typed agent ref**

In `examples/chat/angular`, define `createAgentRef<ChatState>()`, switch `provideAgent`/`injectAgent` to the ref form, and read typed `agent.state` somewhere to exercise the type. Keep the app's existing `strict` setting (Tier-2 proves non-breakage, not strict adoption).

- [ ] **Step 2: Migrate one langgraph + one chat cockpit app likewise** (pick the simplest of each).

- [ ] **Step 3: Build the migrated three**

Run: `npx nx run-many -t build --projects=examples-chat-angular,cockpit-langgraph-streaming-angular,cockpit-chat-messages-angular --skip-nx-cache`
Expected: PASS.

- [ ] **Step 4: Build-net — every affected app must still build green on existing settings**

Run: `npx nx run-many -t build --projects=tag:scope:cockpit,examples-ag-ui-angular,examples-chat-angular --skip-nx-cache`
(If a `scope:cockpit` tag does not exist, enumerate the angular projects: `npx nx run-many -t build --all --skip-nx-cache` and confirm no regression vs. baseline.)
Expected: PASS across all `provideAgent`/`injectAgent` apps — proof the `Agent<TState>` default contains the genericization ripple.

- [ ] **Step 5: Commit**

```bash
git add examples/chat/angular cockpit/langgraph/streaming/angular cockpit/chat/messages/angular
git commit -m "test(examples,cockpit): representative createAgentRef migrations + build-net for Agent<TState>"
```

---

## Task 16: Tier-4 — full type-test + unit gate

**Files:** none (verification + any straggler fixes)

- [ ] **Step 1: Run both type-test gates**

Run: `npx nx run-many -t type-tests --projects=chat,langgraph --skip-nx-cache`
Expected: PASS — all WS1/WS2/WS3 assertions and the `@ts-expect-error` negative tests hold under strict.

- [ ] **Step 2: Run the full affected unit + lint + build suite**

Run: `npx nx run-many -t test lint build --projects=chat,render,langgraph,ag-ui --skip-nx-cache`
Expected: PASS (0 lint errors; warnings pre-existing).

- [ ] **Step 3: Commit any straggler fixes** (only if steps surfaced something).

```bash
git commit -am "fix(dx): resolve straggler type/lint issues from the DX pass" || echo "nothing to commit"
```

---

## Task 17: Tier-3 — live-LLM smoke (manual gate)

**Files:** none

- [ ] **Step 1: Serve each forcing-function app with a real key and drive it**

Per the live-LLM-smoke gate, for each of `cockpit/ag-ui/client-tools`, `cockpit/langgraph/client-tools`, `examples/ag-ui` (itinerary), and `examples/chat`: serve with a real API key, drive the tool flows in Chrome, and confirm zero console errors and that view/ask tool flows complete (type changes are erased at runtime, but the migrations touched real call sites). Free ports between runs; do not run e2e while a live serve holds the same ports.

- [ ] **Step 2: Record the smoke result** in the PR description (which apps, what flows, console-clean confirmation).

> This is a human/controller gate — do not mark complete on green unit/type tests alone.

---

## Task 18: Final review + PR

- [ ] **Step 1: Final whole-implementation code review** (subagent-driven-development's terminal reviewer): correctness of the variance formulation, the `view`/`ask` linkage (incl. the error-tuple branch), the DI ref overloads in both adapters, no internal-type leaks in the built `.d.ts`, JSDoc accuracy.

- [ ] **Step 2: Push the branch and open the PR**

```bash
git push -u origin claude/typescript-dx-pass
gh pr create --base main --title "feat: TypeScript DX pass — strict-safe tools/view/ask + typed agent DI" --body-file <(...)
```
PR body summarizes the five workstreams, the four-tier example validation (incl. the strict-flipped forcing-function apps and the live-smoke result), and links the spec.

- [ ] **Step 3: Enable auto-merge** (`gh pr merge --squash --auto`) and finish via `superpowers:finishing-a-development-branch`.

---

## Self-Review (against the spec)

**Spec coverage:**
- WS1 (tools/action strict fix + per-key/literal keys + return type) → Tasks 2, 3. ✓
- WS2 (view/ask linkage + ViewProps) → Tasks 4, 5. ✓
- WS3 (Agent<TState> + AgentWithHistory<TState> + createAgentRef + both adapters) → Tasks 6, 7, 8, 9. ✓
- WS4 (Prettify, re-exports incl. StandardSchema*/ToolArgs/AgentRef, JSDoc) → Tasks 10, 11. ✓
- WS5 (strict type-test gate) → Task 1 (harness) + per-WS type-specs + Task 16 (full gate). ✓
- Tier 1 (migrate + strict on 3 apps) → Tasks 12, 13, 14. ✓
- Tier 2 (build-net + representative refs) → Task 15. ✓
- Tier 3 (live smoke) → Task 17. ✓
- Tier 4 (type-spec gate) → Tasks 1/16. ✓

**Type consistency:** `FunctionToolDef<S,R>`, `AnyFunctionToolDef`, `ViewToolDef<S,C>`, `AskToolDef<S,C>`, `ClientToolDef`, `AcceptComponent<S,C>`, `ComponentInputs<C>`, `ViewProps<S>`, `ToolArgs<S>`, `Agent<TState>`, `AgentWithHistory<TState>`, `AgentRef<TState>`, `createAgentRef`, `LangGraphAgent<T>`, `AgUiAgent<T>` — names used consistently across tasks.

**Placeholder scan:** no TBD/TODO; every code step shows real code. The one soft spot (`@threadplane/chat/testing` re-export ordering) is explicitly sequenced: Task 10 adds the re-export; Task 8's note says complete Task 10 first if the import fails. Task 15 step 4 gives a concrete fallback if no `scope:cockpit` tag exists.
