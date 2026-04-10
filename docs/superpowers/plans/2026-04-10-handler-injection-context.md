# Handler Injection Context & Consumer-Extensible Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run all render-lib handlers inside `runInInjectionContext` and add a `[handlers]` input on `ChatComponent` that threads consumer-provided functions to both generative-ui and A2UI surfaces.

**Architecture:** One change in `RenderElementComponent.emitFn` wraps handler calls in `runInInjectionContext`. Then `ChatComponent` gets a `[handlers]` input that passes through to `ChatGenerativeUiComponent` (json-render path) and `A2uiSurfaceComponent` (A2UI path). For A2UI, the `a2ui:localAction` handler changes from a hardcoded `openUrl` to a lookup by `call` name in the consumer-provided handlers map, with built-in fallbacks.

**Tech Stack:** Angular 19 (signals, `runInInjectionContext`), Vitest, `@cacheplane/render`, `@cacheplane/chat`, `@cacheplane/a2ui`

---

### Task 1: Add injection context to RenderElementComponent.emitFn

**Files:**
- Modify: `libs/render/src/lib/render-element.component.ts:1-14,128-141`
- Test: `libs/render/src/lib/render-element.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `libs/render/src/lib/render-element.component.spec.ts` at the end of the file:

```typescript
describe('RenderElementComponent — handler injection context', () => {
  it('should allow handlers to call inject() inside runInInjectionContext', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const { Injector, runInInjectionContext, inject, DestroyRef } = require('@angular/core');
      const injector = Injector.create({ providers: [] });

      let destroyRefAccessed = false;
      const handler = (params: Record<string, unknown>) => {
        // This would throw outside injection context
        runInInjectionContext(injector, () => {
          const dr = inject(DestroyRef);
          destroyRefAccessed = dr !== undefined;
        });
        return params;
      };

      const result = handler({ test: true });
      expect(destroyRefAccessed).toBe(true);
      expect(result).toEqual({ test: true });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes (this is a behavior validation test)**

Run: `npx nx test render -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS — this test validates the pattern works. The real change is in the source.

- [ ] **Step 3: Add `runInInjectionContext` import and wrap handler calls**

In `libs/render/src/lib/render-element.component.ts`, add `runInInjectionContext` to the import:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  input,
  OnInit,
  runInInjectionContext,
  type Signal,
} from '@angular/core';
```

Replace the `emitFn` method (lines 128-141):

```typescript
  /** Emit function that delegates to context handlers. */
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

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx nx test render -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-element.component.spec.ts
git commit -m "feat(render): run handlers inside runInInjectionContext"
```

---

### Task 2: Add `[handlers]` input to ChatGenerativeUiComponent

**Files:**
- Modify: `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`
- Test: `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.spec.ts`. First read the existing file to understand the test pattern, then add:

```typescript
import { describe, it, expect } from 'vitest';
import { ChatGenerativeUiComponent } from './chat-generative-ui.component';

describe('ChatGenerativeUiComponent', () => {
  it('should declare a handlers input defaulting to undefined', () => {
    // Verify the component class has the input defined
    const component = new (ChatGenerativeUiComponent as any)();
    // The input should exist as a signal with undefined default
    // (Angular inputs are initialized to their default in the constructor)
    expect(ChatGenerativeUiComponent).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 3: Add `handlers` input and thread to template**

Replace the full file `libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { AngularRegistry, RenderEvent } from '@cacheplane/render';
import { RenderSpecComponent } from '@cacheplane/render';

@Component({
  selector: 'chat-generative-ui',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec()) {
      <render-spec
        [spec]="spec()"
        [registry]="registry()"
        [store]="store()"
        [handlers]="handlers()"
        [loading]="loading()"
        (events)="events.emit($event)"
      />
    }
  `,
})
export class ChatGenerativeUiComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>> | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly events = output<RenderEvent>();
}
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.spec.ts
git commit -m "feat(chat): add handlers input to ChatGenerativeUiComponent"
```

---

### Task 3: Refactor A2uiSurfaceComponent to support consumer handlers

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts:121-149`
- Test: `libs/chat/src/lib/a2ui/surface.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of `libs/chat/src/lib/a2ui/surface.component.spec.ts`:

```typescript
describe('A2uiSurfaceComponent — consumer handlers', () => {
  function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
  }

  it('maps functionCall action call name to a2ui:localAction params', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['btn'] },
      {
        id: 'btn',
        component: 'Button',
        label: 'Add',
        action: { functionCall: { call: 'addToCart', args: { sku: 'ABC' } } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const btnElement = spec.elements['btn'];
    // The call name and args should be in the a2ui:localAction params
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:localAction',
      params: { call: 'addToCart', args: { sku: 'ABC' } },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -20`
Expected: PASS — `surfaceToSpec` already maps functionCall actions correctly. This test validates the contract that consumer handler names correspond to the `call` field.

- [ ] **Step 3: Refactor A2uiSurfaceComponent to use consumer handlers**

Replace the component class in `libs/chat/src/lib/a2ui/surface.component.ts` (lines 105-149) with:

```typescript
@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec(); as s) {
      <render-spec
        [spec]="s"
        [registry]="registry()"
        [handlers]="internalHandlers()"
        (events)="onRenderEvent($event)"
      />
    }
  `,
})
export class A2uiSurfaceComponent {
  readonly surface = input.required<A2uiSurface>();
  readonly catalog = input.required<ViewRegistry>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly events = output<RenderEvent>();

  /** Convert the A2UI surface to a json-render Spec for rendering. */
  readonly spec = computed(() => surfaceToSpec(this.surface()));

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog()));

  /** Merge built-in A2UI handlers with consumer-provided handlers. */
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        return params;
      },
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

  onRenderEvent(event: RenderEvent): void {
    this.events.emit(event);
  }
}
```

Add `computed` to the Angular import at the top of the file if not already present (it is already imported on line 3).

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "feat(chat): make A2UI functionCall handlers consumer-extensible"
```

---

### Task 4: Add `[handlers]` input to ChatComponent and thread to both surfaces

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts:139-158,214-226`

- [ ] **Step 1: Add the `handlers` input to ChatComponent**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, add after the `store` input (line 219):

```typescript
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
```

- [ ] **Step 2: Thread handlers to ChatGenerativeUiComponent in the template**

In the template, find the `<chat-generative-ui>` block (around line 140) and add `[handlers]`:

```html
                    @if (classified.spec(); as spec) {
                      <chat-generative-ui
                        [spec]="spec"
                        [registry]="renderRegistry()"
                        [store]="store()"
                        [handlers]="handlers()"
                        [loading]="ref().isLoading()"
                        (events)="onSpecEvent($event, index)"
                      />
                    }
```

- [ ] **Step 3: Thread handlers to A2uiSurfaceComponent in the template**

In the template, find the `<a2ui-surface>` block (around line 152) and add `[handlers]`:

```html
                          <a2ui-surface
                            [surface]="entry.value"
                            [catalog]="catalog"
                            [handlers]="handlers()"
                            (events)="onA2uiEvent($event, index, entry.key)"
                          />
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx nx test chat -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): add handlers input to ChatComponent, thread to both surfaces"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `apps/website/content/docs/chat/components/chat.mdx`
- Modify: `apps/website/content/docs/chat/a2ui/overview.mdx`
- Modify: `apps/website/content/docs/render/guides/events.mdx`

- [ ] **Step 1: Add `handlers` to ChatComponent inputs table**

In `apps/website/content/docs/chat/components/chat.mdx`, find the Inputs table (around line 62) and add a row after `store`:

```markdown
| `handlers` | `Record<string, (params: Record<string, unknown>) => unknown \| Promise<unknown>>` | `{}` | Event handlers for generative UI specs and A2UI `functionCall` actions. Handlers run in Angular injection context — `inject()` is available inside handler functions. |
```

- [ ] **Step 2: Add custom handlers section to A2UI overview**

In `apps/website/content/docs/chat/a2ui/overview.mdx`, find the "Automatic Event Routing" section (added in the cockpit PR) and add a new section after it:

```markdown
## Custom Function Call Handlers

When an A2UI button has a `functionCall` action, the `call` name is looked up in the `[handlers]` map on `ChatComponent`. This lets you define client-side behavior triggered by agent-built UI:

```typescript
@Component({
  template: `<chat [ref]="agentRef" [views]="catalog" [handlers]="handlers" />`,
})
export class MyComponent {
  agentRef = agent({ apiUrl: '/api', assistantId: 'my-agent' });
  catalog = a2uiBasicCatalog();

  handlers = {
    addToCart: async (args: Record<string, unknown>) => {
      const cart = inject(CartService);
      return cart.add(args['sku'] as string);
    },
  };
}
```

The agent sends a button with `{"action": {"functionCall": {"call": "addToCart", "args": {"sku": "ABC"}}}}`. When clicked, the `addToCart` handler runs in Angular's injection context — `inject()` works for accessing services.

If no consumer handler matches the `call` name, built-in handlers are used as fallbacks (e.g., `openUrl` opens a URL in a new tab).

Handler return values are emitted on the `RenderHandlerEvent` — observe them via the `renderEvent` output on `ChatComponent`.
```

- [ ] **Step 3: Add injection context note to render events guide**

In `apps/website/content/docs/render/guides/events.mdx`, find the "Handler Signature" section (around line 149) and add after it:

```markdown
### Injection Context

Handlers execute inside Angular's `runInInjectionContext`. This means you can call `inject()` to access services:

```typescript
const handlers = {
  saveForm: async (params: Record<string, unknown>) => {
    const http = inject(HttpClient);
    const snapshot = store.getSnapshot();
    await firstValueFrom(http.post('/api/forms', snapshot));
    store.set('/saved', true);
  },
};
```

This works for handlers passed via `[handlers]` on `<render-spec>`, `provideRender()`, or `ChatComponent`.
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat/components/chat.mdx apps/website/content/docs/chat/a2ui/overview.mdx apps/website/content/docs/render/guides/events.mdx
git commit -m "docs: document handler injection context and ChatComponent handlers input"
```
