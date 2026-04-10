# A2UI Core Quality Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve type safety, code organization, test coverage, public API exports, and DX across the A2UI implementation.

**Architecture:** Extract pure functions from component files, add type guards to eliminate `any` casts, add unit tests for catalog components, extract shared binding utility, and expand public API exports.

**Tech Stack:** Angular 19 (signals, standalone), TypeScript strict, Vitest, @json-render/core, @cacheplane/a2ui, @cacheplane/chat, @cacheplane/render

---

### Task 1: Add Type Guard and Eliminate `any` Casts in `surfaceToSpec`

**Files:**
- Create: `libs/a2ui/src/lib/guards.ts`
- Modify: `libs/a2ui/src/index.ts`
- Create: `libs/a2ui/src/lib/guards.spec.ts`

- [ ] **Step 1: Write the failing test for type guards**

Create `libs/a2ui/src/lib/guards.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { isPathRef, isFunctionCall } from './guards';

describe('isPathRef', () => {
  it('returns true for a path reference object', () => {
    expect(isPathRef({ path: '/name' })).toBe(true);
  });

  it('returns false for a function call (has call property)', () => {
    expect(isPathRef({ path: '/name', call: 'format', args: {} })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPathRef(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isPathRef('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isPathRef(42)).toBe(false);
  });
});

describe('isFunctionCall', () => {
  it('returns true for a function call object', () => {
    expect(isFunctionCall({ call: 'format', args: { value: 1 } })).toBe(true);
  });

  it('returns false for a path reference', () => {
    expect(isFunctionCall({ path: '/name' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFunctionCall(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test a2ui --testPathPattern=guards`
Expected: FAIL — module not found

- [ ] **Step 3: Write the type guards**

Create `libs/a2ui/src/lib/guards.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiPathRef, A2uiFunctionCall } from './types';

/** Narrows an unknown value to A2uiPathRef — has `path` but not `call`. */
export function isPathRef(value: unknown): value is A2uiPathRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    !('call' in value)
  );
}

/** Narrows an unknown value to A2uiFunctionCall — has `call` and `args`. */
export function isFunctionCall(value: unknown): value is A2uiFunctionCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    'call' in value
  );
}
```

- [ ] **Step 4: Export guards from index**

Add to `libs/a2ui/src/index.ts`:

```typescript
export { isPathRef, isFunctionCall } from './lib/guards';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx test a2ui --testPathPattern=guards`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add libs/a2ui/src/lib/guards.ts libs/a2ui/src/lib/guards.spec.ts libs/a2ui/src/index.ts
git commit -m "feat(a2ui): add isPathRef and isFunctionCall type guards"
```

---

### Task 2: Extract `surfaceToSpec` to Dedicated File

**Files:**
- Create: `libs/chat/src/lib/a2ui/surface-to-spec.ts`
- Create: `libs/chat/src/lib/a2ui/surface-to-spec.spec.ts`
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts`
- Modify: `libs/chat/src/lib/a2ui/surface.component.spec.ts`
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Create `surface-to-spec.ts` with improved types**

Create `libs/chat/src/lib/a2ui/surface-to-spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Spec, UIElement } from '@json-render/core';
import type { A2uiSurface, A2uiChildTemplate } from '@cacheplane/a2ui';
import { resolveDynamic, getByPointer, evaluateCheckRules, isPathRef } from '@cacheplane/a2ui';

const RESERVED_KEYS = new Set(['id', 'component', 'children', 'action', 'checks']);

/**
 * Converts an A2UI surface to a json-render Spec by:
 * 1. Walking the flat component map
 * 2. Resolving DynamicValue props against the data model
 * 3. Mapping A2UI children (string[] or template) to json-render children
 * 4. Producing a Spec with root + elements
 */
export function surfaceToSpec(surface: A2uiSurface): Spec | null {
  if (!surface.components.has('root')) return null;

  const elements: Record<string, UIElement> = {};

  for (const [id, comp] of surface.components) {
    const props: Record<string, unknown> = {};

    // Resolve all props except reserved keys, tracking binding paths
    const bindings: Record<string, string> = {};
    for (const [key, value] of Object.entries(comp)) {
      if (RESERVED_KEYS.has(key)) continue;
      if (isPathRef(value)) {
        bindings[key] = value.path;
      }
      props[key] = resolveDynamic(value, surface.dataModel);
    }
    if (Object.keys(bindings).length > 0) {
      props['_bindings'] = bindings;
    }
    // Map action to spec `on` binding
    let on: Record<string, { action: string; params: Record<string, unknown> }> | undefined;
    if (comp.action) {
      if ('event' in comp.action) {
        const evt = comp.action.event;
        const resolvedContext: Record<string, unknown> = {};
        if (evt.context) {
          for (const [key, value] of Object.entries(evt.context)) {
            resolvedContext[key] = resolveDynamic(value, surface.dataModel);
          }
        }
        on = {
          click: {
            action: 'a2ui:event',
            params: {
              surfaceId: surface.surfaceId,
              sourceComponentId: id,
              name: evt.name,
              context: resolvedContext,
            },
          },
        };
      } else if ('functionCall' in comp.action) {
        const fc = comp.action.functionCall;
        on = {
          click: {
            action: 'a2ui:localAction',
            params: { call: fc.call, args: fc.args },
          },
        };
      }
    }
    // Evaluate checks and attach pre-computed validation result
    if (comp.checks) {
      props['validationResult'] = evaluateCheckRules(comp.checks, surface.dataModel);
    }

    // Map children
    let children: string[] | undefined;
    if (Array.isArray(comp.children)) {
      children = comp.children as string[];
    } else if (comp.children && typeof comp.children === 'object' && 'path' in comp.children) {
      // Template expansion — expand over data model array
      const template = comp.children as A2uiChildTemplate;
      const arr = getByPointer(surface.dataModel, template.path);
      if (Array.isArray(arr)) {
        children = arr.map((_, i) => `${template.componentId}__${i}`);
        const templateComp = surface.components.get(template.componentId);
        if (templateComp) {
          for (let i = 0; i < arr.length; i++) {
            const scope = { basePath: `${template.path}/${i}`, item: arr[i] };
            const itemProps: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(templateComp)) {
              if (RESERVED_KEYS.has(key)) continue;
              itemProps[key] = resolveDynamic(value, surface.dataModel, scope);
            }
            elements[`${template.componentId}__${i}`] = {
              type: templateComp.component,
              props: itemProps,
            };
          }
        }
      }
    }

    elements[id] = {
      type: comp.component,
      props,
      ...(children ? { children } : {}),
      ...(on ? { on } : {}),
    };
  }

  return { root: 'root', elements, state: surface.dataModel } as Spec;
}
```

- [ ] **Step 2: Create `surface-to-spec.spec.ts` with all existing tests**

Create `libs/chat/src/lib/a2ui/surface-to-spec.spec.ts` — move ALL `surfaceToSpec`-related describe blocks from `surface.component.spec.ts` into this file. Update the import:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@cacheplane/a2ui';
import { surfaceToSpec } from './surface-to-spec';

function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
  const map = new Map<string, A2uiComponent>();
  for (const c of components) map.set(c.id, c);
  return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
}

describe('surfaceToSpec — data flow', () => {
  it('resolves root component from surface', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['t1'] },
      { id: 't1', component: 'Text', text: 'Hello' },
    ]);
    expect(surface.components.get('root')!.component).toBe('Column');
    expect((surface.components.get('root')!.children as string[])).toEqual(['t1']);
  });

  it('resolves data bindings in component props', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text', text: { path: '/greeting' } as any }],
      { greeting: 'Hello World' },
    );
    expect(surface.dataModel).toEqual({ greeting: 'Hello World' });
  });

  it('handles surfaces with no components', () => {
    const surface = makeSurface([]);
    expect(surface.components.size).toBe(0);
  });

  it('expands template children over data model arrays', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: { path: '/items', componentId: 'item_card' } as any },
        { id: 'item_card', component: 'Text', text: { path: 'name' } as any },
      ],
      { items: [{ name: 'Alice' }, { name: 'Bob' }] },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['item_card__0', 'item_card__1']);
    expect(spec.elements['item_card__0'].props['text']).toBe('Alice');
    expect(spec.elements['item_card__1'].props['text']).toBe('Bob');
  });

  it('returns null when no root component exists', () => {
    const surface = makeSurface([
      { id: 'child', component: 'Text', text: 'No root' },
    ]);
    expect(surfaceToSpec(surface)).toBeNull();
  });
});

describe('surfaceToSpec — action mapping', () => {
  it('maps event action to spec on binding', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['btn'] },
      {
        id: 'btn',
        component: 'Button',
        label: 'Submit',
        action: { event: { name: 'formSubmit', context: { formId: 'signup' } } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const btnElement = spec.elements['btn'];
    expect(btnElement.on).toBeDefined();
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:event',
      params: { surfaceId: 's1', sourceComponentId: 'btn', name: 'formSubmit', context: { formId: 'signup' } },
    });
    expect(btnElement.props['action']).toBeUndefined();
  });

  it('maps local action to spec on binding', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['btn'] },
      {
        id: 'btn',
        component: 'Button',
        label: 'Open',
        action: { functionCall: { call: 'openUrl', args: { url: 'https://example.com' } } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const btnElement = spec.elements['btn'];
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:localAction',
      params: { call: 'openUrl', args: { url: 'https://example.com' } },
    });
  });

  it('passes through elements without actions unchanged', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Text', text: 'Hello' },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].on).toBeUndefined();
  });

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
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:localAction',
      params: { call: 'addToCart', args: { sku: 'ABC' } },
    });
  });
});

describe('surfaceToSpec — state initialization', () => {
  it('initializes spec state from surface dataModel', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text', text: 'Hi' }],
      { count: 0, name: 'test' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.state).toEqual({ count: 0, name: 'test' });
  });
});

describe('surfaceToSpec — v0.9 event action', () => {
  it('resolves context DynamicValue paths against data model', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Submit',
          action: { event: { name: 'formSubmit', context: { email: { path: '/email' } } } },
        },
      ],
      { email: 'alice@example.com' },
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ email: 'alice@example.com' });
  });

  it('resolves context FunctionCall values', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Format',
          action: { event: { name: 'show', context: { price: { call: 'formatCurrency', args: { value: { path: '/amount' } } } } } },
        },
      ],
      { amount: 42 },
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ price: '$42.00' });
  });

  it('passes literal context values through unchanged', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Go',
          action: { event: { name: 'navigate', context: { page: 'home' } } },
        },
      ],
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ page: 'home' });
  });

  it('includes sourceComponentId in event action params', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['submit-btn'] },
      {
        id: 'submit-btn',
        component: 'Button',
        label: 'Submit',
        action: { event: { name: 'formSubmit' } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['submit-btn'].on!['click'].params;
    expect(params['sourceComponentId']).toBe('submit-btn');
  });

  it('defaults context to empty object when not specified', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['btn'] },
      {
        id: 'btn',
        component: 'Button',
        label: 'Click',
        action: { event: { name: 'clicked' } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({});
  });
});

describe('surfaceToSpec — validation', () => {
  it('evaluates checks and attaches validationResult prop', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          value: { path: '/name' },
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
          ],
        },
      ],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: true, errors: [] });
  });

  it('attaches failing validationResult when check fails', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          value: { path: '/name' },
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
          ],
        },
      ],
      { name: '' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: false, errors: ['Name required'] });
  });

  it('evaluates composite and condition', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'Button', label: 'Submit',
          checks: [
            {
              condition: {
                call: 'and',
                args: {
                  values: [
                    { call: 'required', args: { value: { path: '/name' } } },
                    { call: 'email', args: { value: { path: '/email' } } },
                  ],
                },
              },
              message: 'All fields required',
            },
          ],
        },
      ],
      { name: 'Alice', email: 'alice@example.com' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toEqual({ valid: true, errors: [] });
  });

  it('does not attach validationResult when no checks defined', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Text', text: 'Hello' },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['validationResult']).toBeUndefined();
  });

  it('does not pass raw checks as props', () => {
    const surface = makeSurface(
      [
        {
          id: 'root', component: 'TextField', label: 'Name',
          checks: [
            { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Required' },
          ],
        },
      ],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['checks']).toBeUndefined();
  });
});

describe('surfaceToSpec — binding tracking', () => {
  it('attaches _bindings prop for path ref values', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'TextField', label: 'Name', value: { path: '/name' } as any }],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['_bindings']).toEqual({ value: '/name' });
  });

  it('does not attach _bindings for literal values', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Text', text: 'Hello' },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['_bindings']).toBeUndefined();
  });
});
```

- [ ] **Step 3: Update `surface.component.ts` to import from new file**

Replace `surfaceToSpec` function with import in `libs/chat/src/lib/a2ui/surface.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import type { A2uiSurface, A2uiActionMessage } from '@cacheplane/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@cacheplane/render';
import type { ViewRegistry, RenderEvent } from '@cacheplane/render';
import { surfaceToSpec } from './surface-to-spec';
import { buildA2uiActionMessage } from './build-action-message';

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
  readonly action = output<A2uiActionMessage>();

  /** Convert the A2UI surface to a json-render Spec for rendering. */
  readonly spec = computed(() => surfaceToSpec(this.surface()));

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog()));

  /** Merge built-in A2UI handlers with consumer-provided handlers. */
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        const message = buildA2uiActionMessage(params, this.surface());
        this.action.emit(message);
        return message;
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

- [ ] **Step 4: Remove `surfaceToSpec` tests from `surface.component.spec.ts`**

Update `libs/chat/src/lib/a2ui/surface.component.spec.ts` to only contain `buildA2uiActionMessage` tests (which will also be moved in Task 3):

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@cacheplane/a2ui';
import { buildA2uiActionMessage } from './build-action-message';

describe('buildA2uiActionMessage', () => {
  function makeSurface(
    components: A2uiComponent[],
    dataModel: Record<string, unknown> = {},
    sendDataModel?: boolean,
  ): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', sendDataModel, components: map, dataModel };
  }

  it('builds a v0.9 action message with all required fields', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'submit-btn',
      name: 'formSubmit',
      context: { email: 'alice@example.com' },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.version).toBe('v0.9');
    expect(msg.action.name).toBe('formSubmit');
    expect(msg.action.surfaceId).toBe('s1');
    expect(msg.action.sourceComponentId).toBe('submit-btn');
    expect(msg.action.context).toEqual({ email: 'alice@example.com' });
    expect(msg.action.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg.metadata).toBeUndefined();
  });

  it('attaches data model when sendDataModel is true', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
      { name: 'Alice', email: 'alice@co.com' },
      true,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeDefined();
    expect(msg.metadata!.a2uiClientDataModel.version).toBe('v0.9');
    expect(msg.metadata!.a2uiClientDataModel.surfaces['s1']).toEqual({ name: 'Alice', email: 'alice@co.com' });
  });

  it('does not attach data model when sendDataModel is false', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
      { name: 'Alice' },
      false,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('does not attach data model when sendDataModel is undefined', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }], { name: 'Alice' });
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('defaults context to empty object when not provided in params', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'click' } as any;
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context).toEqual({});
  });
});
```

- [ ] **Step 5: Update `public-api.ts` import paths**

In `libs/chat/src/public-api.ts`, change:
```typescript
export { buildA2uiActionMessage } from './lib/a2ui/surface.component';
```
to:
```typescript
export { surfaceToSpec } from './lib/a2ui/surface-to-spec';
export { buildA2uiActionMessage } from './lib/a2ui/build-action-message';
```

- [ ] **Step 6: Run tests to verify everything passes**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-to-spec.ts libs/chat/src/lib/a2ui/surface-to-spec.spec.ts libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts libs/chat/src/public-api.ts
git commit -m "refactor(chat): extract surfaceToSpec to dedicated file with UIElement types"
```

---

### Task 3: Extract `buildA2uiActionMessage` to Dedicated File

**Files:**
- Create: `libs/chat/src/lib/a2ui/build-action-message.ts`
- Create: `libs/chat/src/lib/a2ui/build-action-message.spec.ts`
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts` (already updated in Task 2 to import from new path)
- Delete: `libs/chat/src/lib/a2ui/surface.component.spec.ts` (tests moved)

- [ ] **Step 1: Create `build-action-message.ts`**

Create `libs/chat/src/lib/a2ui/build-action-message.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiSurface, A2uiActionMessage } from '@cacheplane/a2ui';

/** Builds a v0.9 A2uiActionMessage from handler params and the current surface. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const message: A2uiActionMessage = {
    version: 'v0.9',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId: params['sourceComponentId'] as string,
      timestamp: new Date().toISOString(),
      context: (params['context'] as Record<string, unknown>) ?? {},
    },
  };
  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v0.9',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}
```

- [ ] **Step 2: Rename `surface.component.spec.ts` to `build-action-message.spec.ts`**

Rename `libs/chat/src/lib/a2ui/surface.component.spec.ts` → `libs/chat/src/lib/a2ui/build-action-message.spec.ts`

The file already has the correct content from Task 2 Step 4 (only `buildA2uiActionMessage` tests). Just update the import path:

```typescript
import { buildA2uiActionMessage } from './build-action-message';
```

- [ ] **Step 3: Run tests**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/lib/a2ui/build-action-message.ts libs/chat/src/lib/a2ui/build-action-message.spec.ts libs/chat/src/public-api.ts
git rm libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "refactor(chat): extract buildA2uiActionMessage to dedicated file"
```

---

### Task 4: Extract Shared Binding Emission Utility

**Files:**
- Create: `libs/chat/src/lib/a2ui/catalog/emit-binding.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/emit-binding.spec.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/text-field.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/check-box.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/slider.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/modal.component.ts`
- Modify: `libs/chat/src/lib/a2ui/catalog/tabs.component.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/a2ui/catalog/emit-binding.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('emitBinding', () => {
  it('emits a2ui:datamodel event with path and value', () => {
    const emit = vi.fn();
    const bindings = { value: '/name' };
    emitBinding(emit, bindings, 'value', 'Alice');
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('does nothing when binding prop is not in bindings map', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });

  it('does nothing when bindings is undefined', () => {
    const emit = vi.fn();
    emitBinding(emit, undefined, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits numeric values', () => {
    const emit = vi.fn();
    emitBinding(emit, { value: '/count' }, 'value', 42);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/count:42');
  });

  it('emits boolean values', () => {
    const emit = vi.fn();
    emitBinding(emit, { checked: '/agreed' }, 'checked', true);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test chat --testPathPattern=emit-binding`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the utility**

Create `libs/chat/src/lib/a2ui/catalog/emit-binding.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** Emits a data model binding event if the prop has a binding path. */
export function emitBinding(
  emit: (event: string) => void,
  bindings: Record<string, string> | undefined,
  prop: string,
  value: unknown,
): void {
  const path = bindings?.[prop];
  if (path) {
    emit(`a2ui:datamodel:${path}:${value}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test chat --testPathPattern=emit-binding`
Expected: PASS (5 tests)

- [ ] **Step 5: Update all input components to use `emitBinding`**

**text-field.component.ts** — replace `onInput` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onInput(event: Event): void {
  const val = (event.target as HTMLInputElement).value;
  emitBinding(this.emit(), this._bindings(), 'value', val);
}
```

**check-box.component.ts** — replace `onChange` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onChange(event: Event): void {
  const val = (event.target as HTMLInputElement).checked;
  emitBinding(this.emit(), this._bindings(), 'checked', val);
}
```

**slider.component.ts** — replace `onInput` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onInput(event: Event): void {
  const val = Number((event.target as HTMLInputElement).value);
  emitBinding(this.emit(), this._bindings(), 'value', val);
}
```

**choice-picker.component.ts** — replace `onChange` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onChange(event: Event): void {
  const val = (event.target as HTMLSelectElement).value;
  emitBinding(this.emit(), this._bindings(), 'selected', val);
}
```

**date-time-input.component.ts** — replace `onChange` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onChange(event: Event): void {
  const val = (event.target as HTMLInputElement).value;
  emitBinding(this.emit(), this._bindings(), 'value', val);
}
```

**modal.component.ts** — replace `onBackdropClick` body:

```typescript
import { emitBinding } from './emit-binding';

// ...
onBackdropClick(): void {
  if (!this.dismissible()) return;
  emitBinding(this.emit(), this._bindings(), 'open', false);
}
```

**tabs.component.ts** — update `selectTab`:

```typescript
import { emitBinding } from './emit-binding';

// ...
selectTab(index: number): void {
  this.activeIndex.set(index);
  emitBinding(this.emit(), this._bindings(), 'selected', index);
}
```

- [ ] **Step 6: Run full test suite**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/emit-binding.ts libs/chat/src/lib/a2ui/catalog/emit-binding.spec.ts libs/chat/src/lib/a2ui/catalog/text-field.component.ts libs/chat/src/lib/a2ui/catalog/check-box.component.ts libs/chat/src/lib/a2ui/catalog/slider.component.ts libs/chat/src/lib/a2ui/catalog/choice-picker.component.ts libs/chat/src/lib/a2ui/catalog/date-time-input.component.ts libs/chat/src/lib/a2ui/catalog/modal.component.ts libs/chat/src/lib/a2ui/catalog/tabs.component.ts
git commit -m "refactor(chat): extract shared emitBinding utility for catalog input components"
```

---

### Task 5: Add Catalog Component Unit Tests — Input Components

**Files:**
- Create: `libs/chat/src/lib/a2ui/catalog/text-field.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/check-box.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/button.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/choice-picker.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/slider.component.spec.ts`

- [ ] **Step 1: Write TextField tests**

Create `libs/chat/src/lib/a2ui/catalog/text-field.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiTextFieldComponent } from './text-field.component';

describe('A2uiTextFieldComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.value()).toBe('');
    expect(component.placeholder()).toBe('');
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit binding event on input', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { value: '/name' });

    component.onInput({ target: { value: 'Alice' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onInput({ target: { value: 'Alice' } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write CheckBox tests**

Create `libs/chat/src/lib/a2ui/catalog/check-box.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiCheckBoxComponent } from './check-box.component';

describe('A2uiCheckBoxComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.checked()).toBe(false);
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit binding event on change', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { checked: '/agreed' });

    component.onChange({ target: { checked: true } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onChange({ target: { checked: true } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write Button tests**

Create `libs/chat/src/lib/a2ui/catalog/button.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiButtonComponent } from './button.component';

describe('A2uiButtonComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiButtonComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.variant()).toBe('primary');
    expect(component.disabled()).toBe(false);
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit click event on handleClick', () => {
    const fixture = TestBed.createComponent(A2uiButtonComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.handleClick();
    expect(emitFn).toHaveBeenCalledWith('click');
  });
});
```

- [ ] **Step 4: Write ChoicePicker tests**

Create `libs/chat/src/lib/a2ui/catalog/choice-picker.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiChoicePickerComponent } from './choice-picker.component';

describe('A2uiChoicePickerComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.options()).toEqual([]);
    expect(component.selected()).toBe('');
  });

  it('should emit binding event on selection', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { selected: '/department' });

    component.onChange({ target: { value: 'Engineering' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/department:Engineering');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onChange({ target: { value: 'Engineering' } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Write Slider tests**

Create `libs/chat/src/lib/a2ui/catalog/slider.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiSliderComponent } from './slider.component';

describe('A2uiSliderComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiSliderComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.value()).toBe(0);
    expect(component.min()).toBe(0);
    expect(component.max()).toBe(100);
    expect(component.step()).toBe(1);
  });

  it('should emit binding event on input as number', () => {
    const fixture = TestBed.createComponent(A2uiSliderComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { value: '/rating' });

    component.onInput({ target: { value: '75' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/rating:75');
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/text-field.component.spec.ts libs/chat/src/lib/a2ui/catalog/check-box.component.spec.ts libs/chat/src/lib/a2ui/catalog/button.component.spec.ts libs/chat/src/lib/a2ui/catalog/choice-picker.component.spec.ts libs/chat/src/lib/a2ui/catalog/slider.component.spec.ts
git commit -m "test(chat): add unit tests for A2UI input catalog components"
```

---

### Task 6: Add Catalog Component Unit Tests — Display and Complex Components

**Files:**
- Create: `libs/chat/src/lib/a2ui/catalog/text.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/icon.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/image.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/modal.component.spec.ts`
- Create: `libs/chat/src/lib/a2ui/catalog/tabs.component.spec.ts`

- [ ] **Step 1: Write display component tests**

Create `libs/chat/src/lib/a2ui/catalog/text.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiTextComponent } from './text.component';

describe('A2uiTextComponent', () => {
  it('should create with default empty text', () => {
    const fixture = TestBed.createComponent(A2uiTextComponent);
    expect(fixture.componentInstance.text()).toBe('');
  });

  it('should accept text input', () => {
    const fixture = TestBed.createComponent(A2uiTextComponent);
    fixture.componentRef.setInput('text', 'Hello World');
    expect(fixture.componentInstance.text()).toBe('Hello World');
  });
});
```

Create `libs/chat/src/lib/a2ui/catalog/icon.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiIconComponent } from './icon.component';

describe('A2uiIconComponent', () => {
  it('should create with default empty name', () => {
    const fixture = TestBed.createComponent(A2uiIconComponent);
    expect(fixture.componentInstance.name()).toBe('');
  });

  it('should accept name input', () => {
    const fixture = TestBed.createComponent(A2uiIconComponent);
    fixture.componentRef.setInput('name', '🔔');
    expect(fixture.componentInstance.name()).toBe('🔔');
  });
});
```

Create `libs/chat/src/lib/a2ui/catalog/image.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiImageComponent } from './image.component';

describe('A2uiImageComponent', () => {
  it('should create with default empty inputs', () => {
    const fixture = TestBed.createComponent(A2uiImageComponent);
    expect(fixture.componentInstance.url()).toBe('');
    expect(fixture.componentInstance.alt()).toBe('');
  });

  it('should accept url and alt inputs', () => {
    const fixture = TestBed.createComponent(A2uiImageComponent);
    fixture.componentRef.setInput('url', 'https://example.com/img.png');
    fixture.componentRef.setInput('alt', 'Example image');
    expect(fixture.componentInstance.url()).toBe('https://example.com/img.png');
    expect(fixture.componentInstance.alt()).toBe('Example image');
  });
});
```

- [ ] **Step 2: Write Modal tests**

Create `libs/chat/src/lib/a2ui/catalog/modal.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiModalComponent } from './modal.component';

describe('A2uiModalComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiModalComponent);
    const component = fixture.componentInstance;
    expect(component.title()).toBe('');
    expect(component.open()).toBe(false);
    expect(component.dismissible()).toBe(true);
    expect(component.childKeys()).toEqual([]);
  });

  it('should emit binding on backdrop click when dismissible', () => {
    const fixture = TestBed.createComponent(A2uiModalComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { open: '/showModal' });

    component.onBackdropClick();
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/showModal:false');
  });

  it('should not emit on backdrop click when not dismissible', () => {
    const fixture = TestBed.createComponent(A2uiModalComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('dismissible', false);
    fixture.componentRef.setInput('_bindings', { open: '/showModal' });

    component.onBackdropClick();
    expect(emitFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Write Tabs tests**

Create `libs/chat/src/lib/a2ui/catalog/tabs.component.spec.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiTabsComponent } from './tabs.component';

describe('A2uiTabsComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiTabsComponent);
    const component = fixture.componentInstance;
    expect(component.tabs()).toEqual([]);
    expect(component.selected()).toBe(0);
  });

  it('should update activeIndex and emit binding on tab selection', () => {
    const fixture = TestBed.createComponent(A2uiTabsComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { selected: '/activeTab' });

    component.selectTab(2);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/activeTab:2');
  });

  it('should compute activeChildKeys from tabs and activeIndex', () => {
    TestBed.runInInjectionContext(() => {
      const fixture = TestBed.createComponent(A2uiTabsComponent);
      const component = fixture.componentInstance;
      fixture.componentRef.setInput('tabs', [
        { label: 'Tab 1', childKeys: ['a', 'b'] },
        { label: 'Tab 2', childKeys: ['c'] },
      ]);
      fixture.detectChanges();

      expect(component.activeChildKeys()).toEqual(['a', 'b']);
      component.selectTab(1);
      expect(component.activeChildKeys()).toEqual(['c']);
    });
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/catalog/text.component.spec.ts libs/chat/src/lib/a2ui/catalog/icon.component.spec.ts libs/chat/src/lib/a2ui/catalog/image.component.spec.ts libs/chat/src/lib/a2ui/catalog/modal.component.spec.ts libs/chat/src/lib/a2ui/catalog/tabs.component.spec.ts
git commit -m "test(chat): add unit tests for A2UI display and complex catalog components"
```

---

### Task 7: Expand Public API Exports

**Files:**
- Modify: `libs/chat/src/public-api.ts`

- [ ] **Step 1: Add catalog component and A2UI type re-exports**

Update the A2UI section of `libs/chat/src/public-api.ts`:

```typescript
// A2UI
export { createA2uiSurfaceStore } from './lib/a2ui/surface-store';
export type { A2uiSurfaceStore } from './lib/a2ui/surface-store';
export { A2uiSurfaceComponent } from './lib/a2ui/surface.component';
export { surfaceToSpec } from './lib/a2ui/surface-to-spec';
export { buildA2uiActionMessage } from './lib/a2ui/build-action-message';
export { a2uiBasicCatalog } from './lib/a2ui/catalog/index';
export { A2uiValidationErrorsComponent } from './lib/a2ui/catalog/validation-errors.component';
export { emitBinding } from './lib/a2ui/catalog/emit-binding';

// A2UI catalog components (for custom catalog composition via withViews)
export { A2uiTextFieldComponent } from './lib/a2ui/catalog/text-field.component';
export { A2uiCheckBoxComponent } from './lib/a2ui/catalog/check-box.component';
export { A2uiButtonComponent } from './lib/a2ui/catalog/button.component';
export { A2uiChoicePickerComponent } from './lib/a2ui/catalog/choice-picker.component';
export { A2uiSliderComponent } from './lib/a2ui/catalog/slider.component';
export { A2uiDateTimeInputComponent } from './lib/a2ui/catalog/date-time-input.component';
export { A2uiTextComponent } from './lib/a2ui/catalog/text.component';
export { A2uiIconComponent } from './lib/a2ui/catalog/icon.component';
export { A2uiImageComponent } from './lib/a2ui/catalog/image.component';
export { A2uiColumnComponent } from './lib/a2ui/catalog/column.component';
export { A2uiRowComponent } from './lib/a2ui/catalog/row.component';
export { A2uiCardComponent } from './lib/a2ui/catalog/card.component';
export { A2uiDividerComponent } from './lib/a2ui/catalog/divider.component';
export { A2uiListComponent } from './lib/a2ui/catalog/list.component';
export { A2uiModalComponent } from './lib/a2ui/catalog/modal.component';
export { A2uiTabsComponent } from './lib/a2ui/catalog/tabs.component';
export { A2uiAudioPlayerComponent } from './lib/a2ui/catalog/audio-player.component';
export { A2uiVideoComponent } from './lib/a2ui/catalog/video.component';

// A2UI types (re-exported from @cacheplane/a2ui for convenience)
export type {
  A2uiActionMessage, A2uiClientDataModel,
  A2uiSurface, A2uiComponent, A2uiTheme,
  DynamicValue, DynamicString, DynamicNumber, DynamicBoolean,
  A2uiPathRef, A2uiFunctionCall,
  A2uiCheckRule, A2uiValidationResult,
} from '@cacheplane/a2ui';
export { isPathRef, isFunctionCall } from '@cacheplane/a2ui';
```

- [ ] **Step 2: Verify build passes**

Run: `npx nx build chat`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/public-api.ts
git commit -m "feat(chat): expand public API with catalog components and A2UI type re-exports"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `apps/website/content/docs/render/a2ui/overview.mdx`
- Modify: `apps/website/content/docs/render/a2ui/catalog.mdx`

- [ ] **Step 1: Add "Data Model Bindings" section to overview.mdx**

Add after the "Events & Data Model Transport" section in `apps/website/content/docs/render/a2ui/overview.mdx`:

```mdx
## Data Model Bindings

When the agent sets component properties using path references (`{ path: "/name" }`), the surface component
tracks these as **bindings** — a mapping from prop name to JSON Pointer path. These bindings are passed to
catalog components as the `_bindings` prop.

### How Bindings Work

1. **Agent sends components** with path references: `{ value: { path: "/form/name" } }`
2. **`surfaceToSpec`** resolves the path to a current value AND records the binding in `_bindings`
3. **Catalog component** reads the resolved value normally. When the user edits the value, it emits an
   `a2ui:datamodel` event via the `emit` callback
4. **The event string format** is `a2ui:datamodel:{path}:{value}`

### Using `emitBinding`

Catalog components use the `emitBinding` utility to emit binding events:

```typescript
import { emitBinding } from '@cacheplane/chat';

// In your component's change handler:
onInput(event: Event): void {
  const val = (event.target as HTMLInputElement).value;
  emitBinding(this.emit(), this._bindings(), 'value', val);
}
```

### Known Limitations

The current binding mechanism is client-side only — the `a2ui:datamodel` events are emitted
but do not yet flow through the render lib's `StateStore`. This means data model updates
from user input are not reflected back to other components in real time. Full `StateStore`
integration is planned for a future release.

For now, data model state is refreshed when the agent sends an `updateDataModel` message.
```

- [ ] **Step 2: Add component prop reference tables to catalog.mdx**

Add prop reference tables to `apps/website/content/docs/render/a2ui/catalog.mdx` after the existing component sections:

```mdx
## Component Reference

### Input Components

#### TextField

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Label text above the input |
| `value` | `string` | `''` | Current input value |
| `placeholder` | `string` | `''` | Placeholder text |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state |

#### CheckBox

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Label text next to checkbox |
| `checked` | `boolean` | `false` | Whether the checkbox is checked |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state |

#### Slider

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Label text (shows current value) |
| `value` | `number` | `0` | Current slider value |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `step` | `number` | `1` | Step increment |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state |

#### ChoicePicker

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Label text above dropdown |
| `options` | `string[]` | `[]` | Available options |
| `selected` | `string` | `''` | Currently selected option |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state |

#### DateTimeInput

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Label text above input |
| `value` | `string` | `''` | Current value |
| `inputType` | `'date' \| 'time' \| 'datetime-local'` | `'date'` | Input type |
| `min` | `string` | `''` | Minimum value |
| `max` | `string` | `''` | Maximum value |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state |

#### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Button text |
| `variant` | `string` | `'primary'` | Visual variant (`'primary'` or `'borderless'`) |
| `disabled` | `boolean` | `false` | Whether the button is disabled |
| `validationResult` | `A2uiValidationResult` | `{ valid: true, errors: [] }` | Validation state (disables when invalid) |

### Display Components

#### Text

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | `''` | Text content to display |

#### Icon

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | `''` | Icon character or emoji |

#### Image

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | `''` | Image source URL |
| `alt` | `string` | `''` | Alt text for accessibility |

### Layout Components

#### Column

Vertical layout container. Renders child components in a column with `gap-3` spacing.

#### Row

Horizontal layout container. Renders child components in a row with `gap-3` spacing.

#### Card

Card container with border and padding. Renders child components inside.

#### Divider

Horizontal divider line. No props.

### Complex Components

#### Modal

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `''` | Modal header title |
| `open` | `boolean` | `false` | Whether modal is visible |
| `dismissible` | `boolean` | `true` | Whether backdrop click closes the modal |

#### Tabs

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `{ label: string; childKeys: string[] }[]` | `[]` | Tab definitions |
| `selected` | `number` | `0` | Active tab index |
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/render/a2ui/overview.mdx apps/website/content/docs/render/a2ui/catalog.mdx
git commit -m "docs(a2ui): add data model bindings section and component prop reference tables"
```

---

### Task 9: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full A2UI test suite**

Run: `npx nx test a2ui`
Expected: All tests PASS

- [ ] **Step 2: Run full chat test suite**

Run: `npx nx test chat`
Expected: All tests PASS

- [ ] **Step 3: Run TypeScript type check**

Run: `npx nx build a2ui && npx nx build chat`
Expected: Build succeeds with no type errors

- [ ] **Step 4: Run lint**

Run: `npx nx lint a2ui && npx nx lint chat`
Expected: No new lint errors (pre-existing errors acceptable)
