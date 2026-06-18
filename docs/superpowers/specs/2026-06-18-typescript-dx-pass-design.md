# TypeScript DX Pass — `@threadplane/*` Public API Design

**Status:** Approved (brainstorm) — ready for implementation plan
**Date:** 2026-06-18
**Scope:** Developer-facing TypeScript surface of `@threadplane/chat`, `@threadplane/render`, `@threadplane/langgraph`, `@threadplane/ag-ui`.

## Goal

Make the hero primitives an app developer touches first — `tools/action/view/ask`, `provideAgent/injectAgent`, the render/registry providers — infer correctly under `strict: true`, link schemas to handler args / component inputs / tool results, carry types through Angular DI, and read cleanly on hover. The target bar is the authored-elsewhere reference framework whose TypeScript DX the project owner wants to carry over: precise inference from minimal annotations, readable quick-info, and consistent inline JSDoc guidance.

No backwards-compatibility constraint (the packages are pre-1.0, `0.0.x`). Flat named exports are kept (no namespace wrapper).

## Motivating findings (from the audit)

An empirical probe compiled scratch consumer code against the real published types and read back the inferred types from `tsc`. The defects below ship to npm consumers exactly as written (the `.d.ts` rollup is otherwise clean — no internal-type leaks).

1. **Critical — `tools()` rejects every typed tool under `strict: true`.** `tools(map: Record<string, ClientToolDef>)` takes the non-generic union whose handler is `(args: unknown) => …`. Under `strictFunctionTypes`, a typed `action()` whose handler demands `MoveInput` is not assignable there, so `tools({ move: action(...) })` is a compile error. It has never surfaced because both `examples/ag-ui/angular` and `examples/chat/angular` compile with `strict: false` (which disables `strictFunctionTypes`), while a default Angular CLI app is `strict: true`.
2. **High — `tools()` widens keys + values.** Return type loses per-key tool types (all collapse to `ClientToolDef`) and literal keys (`'move' | 'show'` widen to `string`), so there is no autocomplete or per-tool typing off the registry.
3. **High — `view()` / `ask()` have zero schema↔component linkage.** Signature is `(description, schema: StandardSchemaV1, component: Type<unknown>)`. Any component compiles regardless of whether it can receive the props the model fills from the schema.
4. **High — `provideAgent<T>` does not propagate `T` to `injectAgent`.** DI erases the generic; a dev must restate `injectAgent<MyState>()` at every call site, and omitting it silently yields `Record<string, unknown>`.
5. **High — typed state lives only on `.value`, not `.state`.** The runtime-neutral `state` signal that chat primitives and most docs reference stays `Signal<Record<string, unknown>>` even when the LangGraph-specific `value` is typed.
6. **Medium — `action`'s handler return type is hardcoded `unknown`** (the resolved value becomes the tool result, but its type is discarded).
7. **Medium — `view`/`ask` schema param is non-generic `StandardSchemaV1`** (output type discarded at the boundary; feeds #3).
8. **Minor — `StandardSchemaV1` is not re-exported from `@threadplane/chat`**, though `action/view/ask` all take it; missing `@param`/`@returns`/`@example` JSDoc on several hero exports.

## Architecture

Five independently-testable workstreams. The shared neutral contract (`Agent`, the schema-infer helpers, the agent ref) lives in `@threadplane/chat` / `@threadplane/render`; the adapters (`langgraph`, `ag-ui`) consume it.

### WS1 — `tools()` / `action()` inference

Fixes findings #1, #2, #6.

```ts
// libs/chat/src/lib/client-tools/tool-def.ts

/** Precise authored type — what action() returns. Carries the schema (S) and
 *  the handler's resolved return type (R). */
export interface FunctionToolDef<S extends StandardSchemaV1 = StandardSchemaV1, R = unknown> {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: S;
  readonly handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>;
}

/** Bivariant union member used only for storage/iteration. The handler param is
 *  `any` (NOT `never`): `any` is the one param type that is simultaneously
 *  (a) a supertype any precise `FunctionToolDef<S,R>` is assignable to under
 *  `strictFunctionTypes`, and (b) callable by internal code that has already
 *  narrowed by `kind` and parsed runtime args. A `never` param satisfies (a)
 *  but breaks (b) — the coordinator/executor could no longer call `handler()`. */
export interface AnyFunctionToolDef {
  readonly kind: 'function';
  readonly description: string;
  readonly schema: StandardSchemaV1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bivariance escape hatch; see above
  readonly handler: (args: any) => unknown | Promise<unknown>;
}

export type ClientToolDef =
  | AnyFunctionToolDef
  | ViewToolDef
  | AskToolDef;
```

Verified under `strict: true`: a precise `FunctionToolDef<MoveSchema, number>` is assignable to `ClientToolDef`; `tools({...})` preserves per-key types and literal keys; and an internal consumer that does `if (def.kind === 'function') def.handler(parsedArgs)` type-checks.

```ts
// libs/chat/src/lib/client-tools/tools.ts

export function action<S extends StandardSchemaV1, R>(
  description: string,
  schema: S,
  handler: (args: StandardSchemaInferOutput<S>) => R | Promise<R>,
): FunctionToolDef<S, R> {
  return { kind: 'function', description, schema, handler };
}

/** Collect named client tools into a frozen registry (the key is the tool name).
 *  Generic + const over the map so per-tool types and literal keys survive. */
export function tools<const M extends Record<string, ClientToolDef>>(map: M): Readonly<M> {
  return Object.freeze({ ...map });
}
```

Result: `tools({ move: action('…', moveSchema, h) })` compiles under `strict: true`; the returned registry's `move` key keeps its `FunctionToolDef<MoveSchema, R>` type and the key union is `'move'`. The `ClientToolRegistry` alias becomes `Readonly<Record<string, ClientToolDef>>` (unchanged shape), and `createClientToolsCoordinator`/`toClientToolSpecs` keep accepting `Record<string, ClientToolDef>` — the bivariant member is what lets a typed registry pass that boundary too.

### WS2 — `view()` / `ask()` schema↔component linkage (strict-but-flexible)

Fixes findings #3, #7. **Verified compiling under `strict: true`** (probe: good case + extra inputs accepted; typo, type-mismatch, and unrelated-component cases rejected).

```ts
// libs/chat/src/lib/client-tools/component-inputs.ts  (new)
import type { InputSignal, InputSignalWithTransform, Type } from '@angular/core';

type InputValue<P> =
  P extends InputSignal<infer T> ? T :
  P extends InputSignalWithTransform<infer T, any> ? T : never;

/** The component instance's declared signal inputs, as a plain prop bag. */
export type ComponentInputs<C> = {
  [K in keyof C as C[K] extends InputSignal<any> | InputSignalWithTransform<any, any> ? K : never]:
    InputValue<C[K]>;
};

/** STRICT: every prop the schema PRODUCES must be a real input with an assignable
 *  type. FLEXIBLE: the component may declare extra inputs the schema doesn't fill.
 *  A schema key absent from the inputs maps to `never`, so its (non-never) value
 *  fails assignment and the error pins to that prop. */
export type CompatibleProps<Out, Inputs> = {
  [K in keyof Out]: K extends keyof Inputs ? Inputs[K] : never;
};

export type AcceptComponent<S extends StandardSchemaV1, C> =
  StandardSchemaInferOutput<S> extends CompatibleProps<StandardSchemaInferOutput<S>, ComponentInputs<C>>
    ? Type<C>
    : ['✗ schema output is not assignable to this component’s inputs',
       StandardSchemaInferOutput<S>, ComponentInputs<C>];
```

```ts
// libs/chat/src/lib/client-tools/tools.ts
export function view<S extends StandardSchemaV1, C>(
  description: string, schema: S, component: AcceptComponent<S, C>,
): ViewToolDef<S, C> { return { kind: 'view', description, schema, component: component as Type<C> }; }

export function ask<S extends StandardSchemaV1, C>(
  description: string, schema: S, component: AcceptComponent<S, C>,
): AskToolDef<S, C> { return { kind: 'ask', description, schema, component: component as Type<C> }; }

/** Reverse helper: derive component input types FROM a schema, so a component
 *  authored straight from the schema is guaranteed compatible. */
export type ViewProps<S extends StandardSchemaV1> = StandardSchemaInferOutput<S>;
```

`ViewToolDef<S, C>` / `AskToolDef<S, C>` carry both the schema and the component type. Their `component: Type<C>` is assignable to the union members' `component: Type<unknown>` (covariant construct return), so they remain assignable to `ClientToolDef` and `tools({...})` accepts them.

**Known limitation (intentional):** "every *required* input must be covered by the schema" is not enforceable at compile time — Angular does not brand required inputs in the type system (`input.required<T>()` and `input<T>(default)` are both `InputSignal<T>`). The shipped runtime schema-readiness gate (holds the fallback until streamed props validate) is the backstop for that case. Compile-time blocks structural mismatches; runtime blocks incomplete/missing props.

### WS3 — agent typing through DI

Fixes findings #4, #5. Highest-surface workstream.

```ts
// libs/chat/src/lib/agent/agent.ts
export interface Agent<TState = Record<string, unknown>> {
  // …existing members…
  readonly state: Signal<TState>;   // was Signal<Record<string, unknown>>
}
```

The `= Record<string, unknown>` default means every existing use of bare `Agent` is unchanged.

```ts
// libs/chat/src/lib/agent/agent-ref.ts  (new)
/** A typed handle that threads a state shape through Angular DI from
 *  provideAgent() to injectAgent() without per-call-site restatement. */
export interface AgentRef<TState> { readonly token: InjectionToken<Agent<TState>>; }
export function createAgentRef<TState>(debugName?: string): AgentRef<TState> {
  return { token: new InjectionToken<Agent<TState>>(debugName ?? 'ThreadplaneAgent') };
}
```

Both adapters gain a ref-aware overload while keeping the no-arg form:

```ts
// libs/langgraph + libs/ag-ui (analogous)
export function provideAgent<T>(ref: AgentRef<T>, config: AgentConfig<T> | (() => AgentConfig<T>)): Provider[];
export function provideAgent<T>(config: AgentConfig<T> | (() => AgentConfig<T>)): Provider[]; // default token

export function injectAgent(): LangGraphAgent;                 // default state
export function injectAgent<T>(ref: AgentRef<T>): LangGraphAgent<T>;  // typed via ref
```

The bare generic `injectAgent<T>()` (which never propagated) is removed.

### WS4 — hovers + discoverability

Fixes finding #8 and readability across the board.

- Internal `Prettify<T> = { [K in keyof T]: T[K] } & {}` applied to the public *inferred* types (`FunctionToolDef`, `ViewToolDef`/`AskToolDef`, `ViewProps`, the agent state surface) so quick-info shows the expanded object instead of raw conditional/mapped-type expressions. `Prettify` itself is `@internal`.
- Re-export from `@threadplane/chat`: `StandardSchemaV1`, `StandardSchemaInferInput`, `StandardSchemaInferOutput`, and a convenience alias `ToolArgs<S> = StandardSchemaInferOutput<S>` so a consumer can type a handler/arg without reaching into `@threadplane/render`.
- `@param` / `@returns` / `@example` JSDoc on every hero export: `tools`, `action`, `view`, `ask`, `provideChat`, `provideRender`, `defineAngularRegistry`, `injectRenderHost`, `provideAgent`/`injectAgent` (both adapters), `createAgentRef`, and the `views`/`withViews`/`overrideViews`/`withoutViews`/`toRenderRegistry` helpers.

### WS5 — regression gate (the TDD spine)

A hand-rolled type-assertion kit (no new dependency):

```ts
// libs/chat/src/testing/type-assert.ts (or a shared internal util)
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export type Expect<T extends true> = T;
```

`*.type-spec.ts` files compiled under a dedicated **`strict: true`** tsconfig per touched lib, run in CI via `tsc --noEmit -p tsconfig.type-tests.json`. They assert the public behavior:
- `tools({ x: action('…', s, h) })` compiles; the result's `x` key keeps `FunctionToolDef<…>`; the key union is the literal `'x'`.
- `action` handler arg is the schema output; the carried return type `R` flows.
- the three `view`/`ask` rejection cases hold (typo prop, type mismatch, unrelated component) via `// @ts-expect-error`; the good case (incl. extra inputs) compiles.
- `injectAgent(ref)` is `Agent<TState>`; `agent.state` is `Signal<TState>`.

Whole existing unit suites stay green; one example app is built to confirm lib source still compiles.

## Files touched

- `libs/chat/src/lib/client-tools/tools.ts` — generic `tools`, `action<S,R>`, `view<S,C>`, `ask<S,C>`, `ViewProps`.
- `libs/chat/src/lib/client-tools/tool-def.ts` — `AnyFunctionToolDef` (bivariant union member), `FunctionToolDef<S,R>`, `ViewToolDef<S,C>`, `AskToolDef<S,C>`, the `ClientToolDef` union.
- `libs/chat/src/lib/client-tools/component-inputs.ts` *(new)* — `ComponentInputs`, `CompatibleProps`, `AcceptComponent`.
- `libs/chat/src/lib/agent/agent.ts` — `Agent<TState = Record<string, unknown>>`.
- `libs/chat/src/lib/agent/agent-ref.ts` *(new)* — `AgentRef`, `createAgentRef`.
- `libs/chat/src/public-api.ts` — re-exports (`StandardSchema*`, `ToolArgs`, `ViewProps`, `AgentRef`, `createAgentRef`) + barrel updates.
- `libs/render/src/lib/standard-schema.ts` — confirm `StandardSchemaInfer{Input,Output}` are exported (already present); add `Prettify` internal if hosted here.
- `libs/langgraph/src/lib/agent.provider.ts`, `inject-agent.ts`, `public-api.ts` — ref overloads, `LangGraphAgent<T>` already generic.
- `libs/ag-ui/src/lib/provide-agent.ts`, `to-agent.ts`, `public-api.ts` — genericize `AgUiAgent<T>`, ref overloads.
- JSDoc across all the above hero exports.
- `*.type-spec.ts` + `tsconfig.type-tests.json` in `libs/chat`, `libs/langgraph` (+ project.json target wiring).
- **Tier-1 forcing-function apps flipped to `strict: true` and migrated to the typed APIs:** `cockpit/ag-ui/client-tools/angular`, `cockpit/langgraph/client-tools/angular`, `examples/ag-ui/angular` (tsconfig + the `client-tools*.ts` / `app.config.ts` call sites + the view/ask component input types). Fallout fixed in example code.
- **Tier-2 representative migrations** to `createAgentRef` typed state: `examples/chat/angular` + one `cockpit/langgraph/*` + one `cockpit/chat/*`.
- Docs updated to the new signatures (`tools` typed registry, `view/ask` generic, `createAgentRef` usage).

## Testing strategy

TDD via WS5: write the failing strict type-test, then make it pass. Each workstream's type-spec is its acceptance gate. Existing vitest suites (render, chat, langgraph, ag-ui) must stay green.

### Validation via examples (forcing functions) — required, thorough

The unit type-tests are necessary but not sufficient: the critical bug survived precisely because every example compiles with `strict: false`. The real, non-negotiable acceptance gate is that the **cockpit examples and the canonical `langgraph` + `ag-ui` examples**, compiled the way a real consumer compiles, exercise the new typed APIs and pass. Four tiers:

**Tier 1 — typed-API migration + full `strict: true` (deep forcing functions).** Migrate and flip these apps to `strict: true`, fixing any fallout in the example code:
- `cockpit/ag-ui/client-tools/angular`
- `cockpit/langgraph/client-tools/angular`
- `examples/ag-ui/angular` (the canonical itinerary demo — uses `tools/view/ask` + `provideAgent`/`injectAgent`)

Each is migrated to: a typed `tools({...})` registry; generic `view`/`ask` paired with components whose signal inputs match the schema output (WS2 linkage actively exercised, including at least one intentionally-correct non-trivial schema↔component pair); and `createAgentRef<TState>()` for typed agent state. Compiled under full `strict: true`, these reproduce exactly how an Angular CLI consumer builds — so if WS1/WS2/WS3 regress, these apps fail to compile.

**Tier 2 — build-regression net (proves WS3 genericization is non-breaking).** All ~35 cockpit + canonical apps that call `provideAgent`/`injectAgent` must still build green on their existing settings (the `Agent<TState = Record<string, unknown>>` default must keep them untouched). Run `nx run-many -t build` across every affected angular project. Additionally migrate `examples/chat/angular` and one representative `cockpit/langgraph/*` and `cockpit/chat/*` app to `createAgentRef` typed state as extra forcing functions.

**Tier 3 — live smoke (runtime correctness).** Per the live-LLM-smoke gate, serve with a real key and drive: both client-tools apps (`cockpit/ag-ui/client-tools`, `cockpit/langgraph/client-tools`), the canonical `examples/ag-ui` itinerary, and `examples/chat`. Confirm the typed-API changes did not alter runtime behavior — tool flows complete, zero console errors. (Type changes are erased at runtime, but the migrations touch real call sites, so this guards against accidental behavioral edits.)

**Tier 4 — type-test gate (WS5).** The hand-rolled `strict:true` type-spec files remain the fast unit-level guard that runs in CI on every change.

A workstream is "done" only when its Tier-1 forcing-function apps compile under `strict: true`, the Tier-2 build net is green, and (for the client-tools/canonical apps) the Tier-3 live smoke passes.

## Risks & decisions

- **`Agent<TState>` genericization (WS3) is the highest-surface change.** The `= Record<string, unknown>` default contains the ripple, but it touches the shared contract and both adapters. The Tier-2 build net (all ~35 `provideAgent`/`injectAgent` apps building green on their existing settings) is the explicit proof that the default truly contains it. Accepted as in-scope (comprehensive spec); WS3 is the natural split point if it later needs to be de-risked into its own PR.
- **Flipping Tier-1 apps to full `strict: true` may surface unrelated example-code issues** (implicit `any`, etc.) beyond the typed-API changes. These are fixed in the example code as part of the migration; if the fallout in any one app proves disproportionate, fall back to enabling `strictFunctionTypes: true` alone (the exact flag that masked the bug) for that app and note it.
- **`const` type parameter on `tools()`** requires TypeScript ≥ 5.0; the repo is well past that.
- **The `view`/`ask` error-tuple constraint** must keep `ViewToolDef<S,C>`/`AskToolDef<S,C>` assignable to `ClientToolDef` so `tools({...})` still accepts views/asks — covered by a WS5 type-test.

## Explicitly NOT in scope

- A namespace/`s.*`-style export wrapper (decided: keep flat named exports).
- Enforcing required-input coverage at compile time for `view`/`ask` (not expressible; runtime gate covers it).
- `@threadplane/a2ui` JSDoc and the broader cockpit/internal packages (not developer-facing hero APIs).
- The separate error-UX and thread-persistence follow-ups.
