# Client Tools — Plan 01: Render Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@threadplane/render` two agent-agnostic capabilities the client-tools feature needs: self-describing registry entries (`schema` + `description`) and a typed component output channel (`injectRenderHost()` exposing `set`/`emit`/`result`, with a new `RenderResultEvent`).

**Architecture:** Additive only. `RenderViewEntry` gains optional `schema`/`description`. A new element-scoped `RenderHost` is provided by `RenderElementComponent` and obtained by mounted components via `injectRenderHost()`; `host.result(value)` emits a new `RenderResultEvent` through the existing `RenderSpecComponent.events` output. The legacy string `emit` input stays functional (its removal + the a2ui catalog migration is Plan 01b), so every step builds green.

**Tech Stack:** Angular 20 (standalone, signals, DI), Vitest + `@angular/core/testing` TestBed, `@json-render/core`, `@standard-schema/spec` (types-only).

---

### Task 1: Add `@standard-schema/spec` and extend `RenderViewEntry`

**Files:**
- Modify: `libs/render/package.json` (add dependency)
- Modify: `libs/render/src/lib/render.types.ts:27-32` (RenderViewEntry)
- Test: `libs/render/src/lib/views.spec.ts`

- [ ] **Step 1: Add the types-only Standard Schema dependency**

Run: `npm install --save --workspace=libs/render @standard-schema/spec@^1.0.0`
Expected: `@standard-schema/spec` appears under `dependencies` in `libs/render/package.json`. (Zero-runtime; types only.)

- [ ] **Step 2: Write the failing test**

Add to `libs/render/src/lib/views.spec.ts`:

```typescript
it('preserves schema and description on object-form entries', () => {
  const schema = { '~standard': { version: 1, vendor: 'test', validate: (v: unknown) => ({ value: v }) } } as never;
  const reg = views({
    weather_card: { component: CompA, schema, description: 'Show a weather card' },
  });
  const entry = reg['weather_card'] as { component: unknown; schema?: unknown; description?: string };
  expect(entry.component).toBe(CompA);
  expect(entry.schema).toBe(schema);
  expect(entry.description).toBe('Show a weather card');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx test render -- views.spec`
Expected: FAIL — TypeScript error that `schema`/`description` are not assignable to `RenderViewEntry`.

- [ ] **Step 4: Extend `RenderViewEntry`**

In `libs/render/src/lib/render.types.ts`, add the import at the top (after the existing `@json-render/core` import):

```typescript
import type { StandardSchemaV1 } from '@standard-schema/spec';
```

Replace the `RenderViewEntry` interface (currently lines ~27-32):

```typescript
export interface RenderViewEntry {
  component: Type<unknown>;
  fallback?: Type<unknown>;
  /** Optional props contract for this component (Zod/Valibot/ArkType via
   * Standard Schema). Carried + exposed by the render lib but NOT enforced
   * on mount; consumers (e.g. client-tools) read it to advertise the
   * component to a model and to validate incoming props. */
  schema?: StandardSchemaV1;
  /** Optional human/model-facing description of what this component renders. */
  description?: string;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test render -- views.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/render/package.json libs/render/src/lib/render.types.ts libs/render/src/lib/views.spec.ts
git commit -m "feat(render): RenderViewEntry carries optional schema + description"
```

---

### Task 2: Add `RenderResultEvent` to the `RenderEvent` union

**Files:**
- Modify: `libs/render/src/lib/render-event.ts`
- Modify: `libs/render/src/public-api.ts:38-44` (event exports)
- Test: `libs/render/src/lib/render-event.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `libs/render/src/lib/render-event.spec.ts`:

```typescript
import type { RenderEvent, RenderResultEvent } from './render-event';

it('RenderResultEvent is assignable to RenderEvent', () => {
  const ev: RenderResultEvent = { type: 'result', value: { ok: true }, elementKey: 'btn1' };
  const wide: RenderEvent = ev;
  expect(wide.type).toBe('result');
  if (wide.type === 'result') {
    expect(wide.value).toEqual({ ok: true });
    expect(wide.elementKey).toBe('btn1');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test render -- render-event.spec`
Expected: FAIL — `RenderResultEvent` not exported / not part of the union.

- [ ] **Step 3: Add the interface and extend the union**

In `libs/render/src/lib/render-event.ts`, add before the `RenderEvent` union type:

```typescript
export interface RenderResultEvent {
  readonly type: 'result';
  readonly value: unknown;
  readonly elementKey?: string;
}
```

Then update the union:

```typescript
export type RenderEvent =
  | RenderHandlerEvent
  | RenderStateChangeEvent
  | RenderLifecycleEvent
  | RenderResultEvent;
```

- [ ] **Step 4: Export it from the public API**

In `libs/render/src/public-api.ts`, update the events export block:

```typescript
export type {
  RenderEvent,
  RenderHandlerEvent,
  RenderStateChangeEvent,
  RenderLifecycleEvent,
  RenderResultEvent,
} from './lib/render-event';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test render -- render-event.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/lib/render-event.ts libs/render/src/lib/render-event.spec.ts libs/render/src/public-api.ts
git commit -m "feat(render): add RenderResultEvent to the RenderEvent union"
```

---

### Task 3: Define `RenderHost`, the `RENDER_HOST` token, and `injectRenderHost()`

**Files:**
- Create: `libs/render/src/lib/contexts/render-host.ts`
- Modify: `libs/render/src/public-api.ts` (add export)
- Test: `libs/render/src/lib/contexts/render-host.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/render/src/lib/contexts/render-host.spec.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RENDER_HOST, injectRenderHost, type RenderHost } from './render-host';

@Component({ standalone: true, template: '' })
class HostConsumer {
  readonly host = injectRenderHost();
}

describe('injectRenderHost', () => {
  it('returns the provided RENDER_HOST', () => {
    const calls: unknown[] = [];
    const fake: RenderHost = {
      set: (p, v) => calls.push(['set', p, v]),
      emit: (e, payload) => calls.push(['emit', e, payload]),
      result: (v) => calls.push(['result', v]),
    };
    TestBed.configureTestingModule({
      imports: [HostConsumer],
      providers: [{ provide: RENDER_HOST, useValue: fake }],
    });
    const fx = TestBed.createComponent(HostConsumer);
    fx.componentInstance.host.set('/x', 1);
    fx.componentInstance.host.result({ ok: true });
    expect(calls).toEqual([['set', '/x', 1], ['result', { ok: true }]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test render -- render-host.spec`
Expected: FAIL — module `./render-host` does not exist.

- [ ] **Step 3: Create the host contract + injector**

Create `libs/render/src/lib/contexts/render-host.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { InjectionToken, inject } from '@angular/core';

/**
 * The element-scoped host a mounted view component talks back through.
 * Agent-agnostic: `result(value)` just means "this component produced a
 * value"; the render lib surfaces it as a RenderResultEvent and never
 * interprets it. Provided per-element by RenderElementComponent.
 */
export interface RenderHost {
  /** Write a value to the render state store at a JSON-Pointer path. */
  set(path: string, value: unknown): void;
  /** Fire a named event; routed to the element's `on[event]` handlers. */
  emit(event: string, payload?: Record<string, unknown>): void;
  /** Announce this component's result value (e.g. a HITL submission). */
  result(value: unknown): void;
}

export const RENDER_HOST = new InjectionToken<RenderHost>('RENDER_HOST');

/** Obtain the element-scoped RenderHost from inside a mounted view component. */
export function injectRenderHost(): RenderHost {
  return inject(RENDER_HOST);
}
```

- [ ] **Step 4: Export from the public API**

In `libs/render/src/public-api.ts`, add after the Contexts block:

```typescript
export { RENDER_HOST, injectRenderHost } from './lib/contexts/render-host';
export type { RenderHost } from './lib/contexts/render-host';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test render -- render-host.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/lib/contexts/render-host.ts libs/render/src/lib/contexts/render-host.spec.ts libs/render/src/public-api.ts
git commit -m "feat(render): add RenderHost contract + injectRenderHost()"
```

---

### Task 4: Provide `RenderHost` per element in `RenderElementComponent`

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts` (imports, `@Component.providers`, a `host` field + handler-routing helper)
- Test: `libs/render/src/lib/render-element.component.spec.ts`

Context: `RenderElementComponent` already injects `RENDER_CONTEXT` as `this.ctx` (with `store` and `emitEvent`), exposes `elementKey` and `element()`, and has a private `emitFn` that routes `el.on[event]` handlers via `runInInjectionContext(this.parentInjector, …)`. We add a `host` field that reuses that routing for `emit`, writes the store for `set`, and emits a `RenderResultEvent` via `this.ctx.emitEvent` for `result`. We provide it element-scoped so `NgComponentOutlet`-mounted children can inject it.

- [ ] **Step 1: Write the failing test**

Add to `libs/render/src/lib/render-element.component.spec.ts` (reuse the file's existing imports for `RenderElementComponent`, `RENDER_CONTEXT`, `signalStateStore`, `defineAngularRegistry`; add the ones below):

```typescript
import { Component as HostCmp, inject as ngInject } from '@angular/core';
import { injectRenderHost } from './contexts/render-host';
import type { RenderEvent } from './render-event';

@HostCmp({ standalone: true, template: '<button (click)="fire()">go</button>' })
class ResultEmitter {
  private readonly host = injectRenderHost();
  fire() { this.host.result({ picked: 2 }); }
}

@HostCmp({
  standalone: true,
  imports: [RenderElementComponent],
  template: `<render-element [elementKey]="'w1'" [spec]="spec" />`,
})
class ResultHost {
  spec = { root: 'w1', elements: { w1: { type: 'emitter', props: {} } } } as Spec;
}

describe('RenderElementComponent — RenderHost', () => {
  it('result(value) reaches the host as a RenderResultEvent', () => {
    const events: RenderEvent[] = [];
    const store = signalStateStore({});
    TestBed.configureTestingModule({
      imports: [ResultHost],
      providers: [{
        provide: RENDER_CONTEXT,
        useValue: {
          store,
          registry: defineAngularRegistry({ emitter: ResultEmitter }),
          functions: {},
          handlers: {},
          emitEvent: (e: RenderEvent) => events.push(e),
        },
      }],
    });
    const fx = TestBed.createComponent(ResultHost);
    fx.detectChanges();
    fx.nativeElement.querySelector('button').click();
    expect(events).toContainEqual({ type: 'result', value: { picked: 2 }, elementKey: 'w1' });
  });

  it('set(path, value) writes the render state store', () => {
    const store = signalStateStore({});
    @HostCmp({ standalone: true, template: '' })
    class SetterCmp {
      private readonly host = injectRenderHost();
      constructor() { this.host.set('/seats', 3); }
    }
    @HostCmp({
      standalone: true,
      imports: [RenderElementComponent],
      template: `<render-element [elementKey]="'s1'" [spec]="spec" />`,
    })
    class SetHost { spec = { root: 's1', elements: { s1: { type: 'setter', props: {} } } } as Spec; }
    TestBed.configureTestingModule({
      imports: [SetHost],
      providers: [{
        provide: RENDER_CONTEXT,
        useValue: { store, registry: defineAngularRegistry({ setter: SetterCmp }), functions: {}, handlers: {} },
      }],
    });
    const fx = TestBed.createComponent(SetHost);
    fx.detectChanges();
    expect(store.getSnapshot()).toMatchObject({ seats: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test render -- render-element.component.spec`
Expected: FAIL — `NullInjectorError: No provider for InjectionToken RENDER_HOST`.

- [ ] **Step 3: Import the host token + extract a handler-routing helper**

In `libs/render/src/lib/render-element.component.ts`, add to the imports near `RENDER_CONTEXT`:

```typescript
import { RENDER_HOST, type RenderHost } from './contexts/render-host';
```

Add a private helper that performs the existing `el.on[event]` routing (factor it out of `emitFn` so both `emitFn` and the host reuse it). Insert it just above `emitFn`:

```typescript
  /** Invokes the element's `on[event]` handler bindings (shared by the
   * legacy string `emit` input and the typed RenderHost). */
  private invokeHandlers(event: string, payload?: Record<string, unknown>): void {
    const el = this.element();
    if (!el?.on) return;
    const binding = el.on[event];
    if (!binding) return;
    const bindings = Array.isArray(binding) ? binding : [binding];
    for (const b of bindings) {
      const handler = this.ctx.handlers?.[b.action];
      if (handler) {
        const params = { ...(b.params as Record<string, unknown> ?? {}), ...(payload ?? {}) };
        runInInjectionContext(this.parentInjector, () => handler(params));
      }
    }
  }
```

- [ ] **Step 4: Add the `host` field and provide it element-scoped**

Add the `host` field to the class (near `emitFn`):

```typescript
  /** Element-scoped host injected by mounted view components via
   * injectRenderHost(). `set` writes the store; `emit` routes element
   * handlers; `result` surfaces a RenderResultEvent for this element. */
  readonly host: RenderHost = {
    set: (path: string, value: unknown) => this.ctx.store?.set(path, value),
    emit: (event: string, payload?: Record<string, unknown>) => this.invokeHandlers(event, payload),
    result: (value: unknown) =>
      this.ctx.emitEvent?.({ type: 'result', value, elementKey: this.elementKey() }),
  };
```

In the `@Component({...})` decorator, add a `providers` array (or extend it if one exists) so the mounted child can inject the ancestor element's host:

```typescript
  providers: [
    { provide: RENDER_HOST, useFactory: () => inject(RenderElementComponent).host },
  ],
```

> `inject(RenderElementComponent)` runs when the child resolves `RENDER_HOST`, by which point the ancestor `RenderElementComponent` is constructed and its `host` field is set.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test render -- render-element.component.spec`
Expected: PASS (both new tests + all existing element tests still green).

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-element.component.spec.ts
git commit -m "feat(render): provide element-scoped RenderHost (set/emit/result)"
```

---

### Task 5: Full render lib green + barrel verification

**Files:**
- Test/verify only.

- [ ] **Step 1: Run the full render unit suite**

Run: `npx nx test render`
Expected: PASS (all suites).

- [ ] **Step 2: Lint + typecheck the render lib**

Run: `npx nx lint render && npx nx run render:build`
Expected: PASS — no type errors; `injectRenderHost`, `RenderHost`, `RenderResultEvent` are exported from the built barrel.

- [ ] **Step 3: Confirm downstream still builds (chat consumes render)**

Run: `npx nx run chat:build`
Expected: PASS — the additive changes don't break `@threadplane/chat` (legacy `emit` input untouched).

- [ ] **Step 4: Commit any incidental fixes**

```bash
git add -A libs/render
git commit -m "test(render): full suite green for client-tools foundation" --allow-empty
```

---

## Self-Review

- **Spec coverage (Section 1):** `RenderViewEntry.schema/description` → Task 1. `RenderResultEvent` → Task 2. `injectRenderHost()` `set`/`emit`/`result` → Tasks 3–4. The `a2ui:datamodel:` removal + catalog port is explicitly deferred to Plan 01b (see index) — Plan 01 keeps the legacy `emit` working so builds stay green.
- **Placeholders:** none — every code step shows full code; tests use the verbatim TestBed pattern from the existing render specs.
- **Type consistency:** `RenderHost` (`set`/`emit`/`result`) is identical across Task 3 (definition), Task 4 (implementation), and the tests. `RenderResultEvent` fields (`type:'result'`, `value`, `elementKey?`) match in Tasks 2 and 4. `emitEvent` is read off `RenderContext` exactly as defined in `contexts/render-context.ts`.
- **Risk:** the `RENDER_HOST` `useFactory: () => inject(RenderElementComponent).host` relies on the child resolving the token under the element's injector (true for `NgComponentOutlet` children). Task 4's first test exercises exactly this path; if it fails with a null injector, switch the provider to `{ provide: RENDER_HOST, useFactory: (el: RenderElementComponent) => el.host, deps: [RenderElementComponent] }`.
