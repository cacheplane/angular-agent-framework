# Handler Injection Context & Consumer-Extensible Handlers Design Spec

**Date:** 2026-04-10
**Status:** Approved

## Overview

Two changes that work together: (1) run all render-lib handlers inside `runInInjectionContext` so they can call `inject()`, and (2) add a `[handlers]` input on `ChatComponent` that threads consumer-provided handler functions to both generative-ui and A2UI rendering surfaces.

This enables consumers to provide async callback functions — executed in Angular's injection context — that respond to spec events and A2UI `functionCall` actions. No protocol changes to json-render or A2UI; this is an Angular runtime enhancement.

## 1. Render-lib: Injection Context for Handlers

### Problem

Handlers registered via `[handlers]` on `RenderSpecComponent` or `provideRender()` execute as plain function calls in `RenderElementComponent.emitFn`. They cannot call `inject()` to access Angular services.

### Solution

Wrap the handler call in `runInInjectionContext(this.parentInjector, ...)` inside `RenderElementComponent.emitFn`.

```typescript
// libs/render/src/lib/render-element.component.ts
private readonly emitFn = (event: string) => {
  const el = this.element();
  if (!el?.on) return;
  const binding = el.on[event];
  if (!binding) return;
  const bindings = Array.isArray(binding) ? binding : [binding];
  for (const b of bindings) {
    const handler = this.ctx.handlers?.[b.action];
    if (handler) {
      runInInjectionContext(this.parentInjector, () =>
        handler(b.params as Record<string, unknown> ?? {}),
      );
    }
  }
};
```

**Impact:** Every handler — json-render, A2UI, global, per-instance — runs in injection context. Existing handlers that don't use `inject()` are unaffected. No changes to the handler type signature (`(params: Record<string, unknown>) => unknown | Promise<unknown>`).

**File:** `libs/render/src/lib/render-element.component.ts` — `emitFn` method

## 2. ChatComponent: Consumer-Extensible Handlers

### Problem

`ChatComponent` has no way for consumers to provide handler functions. A2UI `functionCall` actions are hardcoded to `openUrl` in `A2uiSurfaceComponent`. Generative-ui specs rendered inside chat have no handler mechanism.

### Solution

Add a `[handlers]` input on `ChatComponent` with type `Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>`. Thread it to both rendering surfaces.

### Generative UI Path

`ChatComponent` passes handlers to `ChatGenerativeUiComponent`, which passes them to `<render-spec [handlers]="handlers()">`. The consumer's handler names match the `action` strings in their spec's `on` bindings. This is the existing `RenderSpecComponent` mechanism — `ChatComponent` just exposes it.

**Files:**
- `libs/chat/src/lib/compositions/chat/chat.component.ts` — add `handlers` input, pass in template
- `libs/chat/src/lib/compositions/chat-generative-ui/chat-generative-ui.component.ts` — add `handlers` input, pass to `<render-spec>`

### A2UI Path

`ChatComponent` passes handlers to `A2uiSurfaceComponent` via a new `[handlers]` input. `A2uiSurfaceComponent` replaces its current static `handlers` object with an `internalHandlers` computed signal that merges the two built-in action handlers with consumer-provided function call handlers. The template changes from `[handlers]="handlers"` to `[handlers]="internalHandlers()"` on `<render-spec>`. The `a2ui:localAction` handler changes from a hardcoded `openUrl` check to a lookup by `call` name:

```typescript
// libs/chat/src/lib/a2ui/surface.component.ts
readonly internalHandlers = computed(() => {
  const consumerHandlers = this.handlers();
  return {
    'a2ui:event': (params: Record<string, unknown>) => params,
    'a2ui:localAction': (params: Record<string, unknown>) => {
      const call = params['call'] as string;
      const args = (params['args'] as Record<string, unknown>) ?? {};

      // Consumer handler takes priority
      if (consumerHandlers[call]) {
        return consumerHandlers[call](args);
      }

      // Built-in fallback
      if (call === 'openUrl' && typeof globalThis.window !== 'undefined') {
        globalThis.window.open(String(args['url'] ?? ''), '_blank');
      }
      return undefined;
    },
  };
});
```

**Dispatch logic:** When the agent sends `{"action": {"functionCall": {"call": "addToCart", "args": {"sku": "ABC"}}}}`, the flow is:

1. `surfaceToSpec()` maps it to `on: { click: { action: 'a2ui:localAction', params: { call: 'addToCart', args: { sku: 'ABC' } } } }`
2. `RenderElementComponent.emitFn` calls the `a2ui:localAction` handler inside `runInInjectionContext`
3. The handler looks up `"addToCart"` in consumer handlers, calls it with `{ sku: 'ABC' }`
4. `wrappedHandlers` in `RenderSpecComponent` emits a `RenderHandlerEvent` with the result

**Files:**
- `libs/chat/src/lib/a2ui/surface.component.ts` — add `handlers` input, refactor `a2ui:localAction` dispatch

### Consumer Usage

```typescript
@Component({
  template: `<chat [ref]="agentRef" [views]="catalog" [handlers]="handlers" />`,
})
export class MyComponent {
  agentRef = agent({ apiUrl: '/api', assistantId: 'my-agent' });
  catalog = a2uiBasicCatalog();

  handlers = {
    // A2UI functionCall handler — inject() works
    addToCart: async (args: Record<string, unknown>) => {
      const cart = inject(CartService);
      return cart.add(args['sku'] as string);
    },
    // Override built-in openUrl
    openUrl: (args: Record<string, unknown>) => {
      const router = inject(Router);
      router.navigate([args['url'] as string]);
    },
  };
}
```

The consumer never interacts with internal action names (`a2ui:event`, `a2ui:localAction`). They provide named functions matching the `call` string from the agent's `functionCall` action.

## 3. Documentation Updates

### Updated Pages

- **`chat/components/chat.mdx`** — Add `handlers` to inputs table with type and description
- **`chat/a2ui/overview.mdx`** — Add section on custom functionCall handlers, consumer usage example
- **`render/guides/events.mdx`** — Note that handlers execute in Angular injection context, `inject()` is available

## Spec Alignment

### json-render

The `on` binding format (`{ action: string, params: Record<string, unknown> }`) and handler signature (`(params) => unknown | Promise<unknown>`) are unchanged. Injection context is an Angular runtime detail invisible to the spec format.

### A2UI v0.9

The `functionCall` format (`{ call: string, args: Record<string, unknown> }`) is unchanged. The `call` field was always a string lookup — we're making it extensible rather than hardcoded. The catalog already documents `openUrl` as a function name, and our design preserves it as a built-in fallback.

## Future Considerations (Out of Scope)

- **`provideChat({ handlers })`** — App-wide default handlers via provider. YAGNI for now; input-only is sufficient.
- **Handler return values updating data model** — Automatic state store writes from handler results. Current design emits results on `RenderHandlerEvent`; consumers can observe and react.
- **Handler error boundaries** — Structured error handling for failed async handlers. Current behavior: promise rejection is caught by `wrappedHandlers`, emits event with `result: undefined`.
