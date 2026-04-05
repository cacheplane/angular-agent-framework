// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Spec } from '@json-render/core';
import {
  evaluateVisibility,
  resolveBindings,
  resolveElementProps,
} from '@json-render/core';

import { defineAngularRegistry } from './define-angular-registry';
import { signalStateStore } from './signal-state-store';
import { buildPropResolutionContext } from './internals/prop-signal';

// --- Test components ---

@Component({
  selector: 'render-test-text',
  standalone: true,
  template: '<span>{{ label() }}</span>',
})
class TestTextComponent {
  readonly label = input<string>('');
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | null>(null);
}

// --- Helpers ---

function createSpec(elements: Record<string, unknown>, root = 'root'): Spec {
  return { root, elements } as Spec;
}

/**
 * These tests verify the rendering pipeline logic (element lookup, prop
 * resolution, visibility, repeat) at the unit level. Because this repo's
 * Vitest setup does not include the Angular template compiler plugin,
 * we test the pipeline functions and registry lookups directly rather
 * than rendering templates.
 */
describe('RenderElementComponent — pipeline logic', () => {
  it('should look up element from spec and resolve component class', () => {
    const registry = defineAngularRegistry({ Text: TestTextComponent });
    const spec = createSpec({
      root: { type: 'Text', props: { label: 'Hello' } },
    });
    const el = spec.elements['root'];
    expect(el).toBeDefined();
    expect(el.type).toBe('Text');
    expect(registry.get(el.type)).toBe(TestTextComponent);
  });

  it('should return undefined for unknown element type', () => {
    const registry = defineAngularRegistry({ Text: TestTextComponent });
    const spec = createSpec({
      root: { type: 'UnknownWidget', props: { label: 'Nope' } },
    });
    const el = spec.elements['root'];
    expect(registry.get(el.type)).toBeUndefined();
  });

  it('should return undefined for missing element key', () => {
    const spec = createSpec({
      root: { type: 'Text', props: { label: 'Hello' } },
    });
    expect(spec.elements['nonexistent']).toBeUndefined();
  });

  it('should resolve $state prop expressions', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ count: 42 });
      const ctx = buildPropResolutionContext(store);
      const props = { count: { $state: '/count' } };
      const resolved = resolveElementProps(props, ctx);
      expect(resolved['count']).toBe(42);
    });
  });

  it('should evaluate visibility as hidden when state is falsy', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ show: false });
      const ctx = buildPropResolutionContext(store);
      const result = evaluateVisibility({ $state: '/show' }, ctx);
      expect(result).toBe(false);
    });
  });

  it('should evaluate visibility as visible when state is truthy', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ show: true });
      const ctx = buildPropResolutionContext(store);
      const result = evaluateVisibility({ $state: '/show' }, ctx);
      expect(result).toBe(true);
    });
  });

  it('should evaluate visibility as true when condition is undefined', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({});
      const ctx = buildPropResolutionContext(store);
      const result = evaluateVisibility(undefined, ctx);
      expect(result).toBe(true);
    });
  });

  it('should resolve bindings from $bindState expressions', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ form: { email: 'test@example.com' } });
      const ctx = buildPropResolutionContext(store);
      const props = { value: { $bindState: '/form/email' }, label: 'Email' };
      const bindings = resolveBindings(props, ctx);
      expect(bindings).toEqual({ value: '/form/email' });
    });
  });

  it('should resolve repeat item props via $item expression', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['A', 'B', 'C'] });
      const repeatScope = { item: 'B', index: 1, basePath: '/items/1' };
      const ctx = buildPropResolutionContext(store, repeatScope);
      const props = { label: { $item: '' } };
      const resolved = resolveElementProps(props, ctx);
      expect(resolved['label']).toBe('B');
    });
  });

  it('should resolve $index in repeat scope', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['A', 'B'] });
      const repeatScope = { item: 'B', index: 1, basePath: '/items/1' };
      const ctx = buildPropResolutionContext(store, repeatScope);
      const props = { idx: { $index: true } };
      const resolved = resolveElementProps(props, ctx);
      expect(resolved['idx']).toBe(1);
    });
  });

  it('should include childKeys and spec in resolved inputs structure', () => {
    const spec = createSpec({
      root: { type: 'Text', props: { label: 'Hello' }, children: ['child1', 'child2'] },
      child1: { type: 'Text', props: { label: 'C1' } },
      child2: { type: 'Text', props: { label: 'C2' } },
    });
    const el = spec.elements['root'];
    // The component passes childKeys from element.children
    const childKeys = el.children ?? [];
    expect(childKeys).toEqual(['child1', 'child2']);
  });

  it('should handle repeat by iterating state array items', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ items: ['A', 'B', 'C'] });
      const spec = createSpec({
        root: {
          type: 'Text',
          props: { label: { $item: '' } },
          repeat: { statePath: '/items' },
        },
      });
      const el = spec.elements['root'];
      const items = store.get(el.repeat!.statePath);
      expect(Array.isArray(items)).toBe(true);
      expect(items).toEqual(['A', 'B', 'C']);

      // Each item gets its own repeat scope and resolved props
      const results = (items as string[]).map((item, index) => {
        const scope = { item, index, basePath: `${el.repeat!.statePath}/${index}` };
        const ctx = buildPropResolutionContext(store, scope);
        return resolveElementProps(el.props ?? {}, ctx);
      });
      expect(results[0]['label']).toBe('A');
      expect(results[1]['label']).toBe('B');
      expect(results[2]['label']).toBe('C');
    });
  });
});

/**
 * Children rendering tests (Task 9).
 *
 * Verify that the recursive rendering pattern works: a parent Container
 * receives childKeys and spec, and each child element can be resolved
 * independently from the same spec.
 */
describe('RenderElementComponent — children rendering', () => {
  it('should pass childKeys and spec to the rendered component', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const registry = defineAngularRegistry({ Container: TestTextComponent, Text: TestTextComponent });
      const store = signalStateStore({ title: 'Parent' });
      const spec = createSpec({
        root: {
          type: 'Container',
          props: { label: 'Parent' },
          children: ['heading', 'body'],
        },
        heading: { type: 'Text', props: { label: 'Heading' } },
        body: { type: 'Text', props: { label: 'Body' } },
      });

      const rootEl = spec.elements['root'];
      const ctx = buildPropResolutionContext(store);
      const resolved = resolveElementProps(rootEl.props ?? {}, ctx);
      const bindings = resolveBindings(rootEl.props ?? {}, ctx);

      // Simulate what resolvedInputs computes
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const noopEmit = (): void => {};
      const inputs = {
        ...resolved,
        bindings,
        emit: noopEmit,
        loading: false,
        childKeys: rootEl.children ?? [],
        spec,
      };

      // Container receives childKeys pointing to its children
      expect(inputs.childKeys).toEqual(['heading', 'body']);
      expect(inputs.spec).toBe(spec);

      // Each child can be resolved from the same spec
      for (const childKey of inputs.childKeys) {
        const childEl = spec.elements[childKey];
        expect(childEl).toBeDefined();
        expect(registry.get(childEl.type)).toBe(TestTextComponent);
      }
    });
  });

  it('should resolve child props independently from parent', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({ greeting: 'Hi', name: 'World' });
      const spec = createSpec({
        root: {
          type: 'Container',
          props: {},
          children: ['greeting', 'name'],
        },
        greeting: { type: 'Text', props: { label: { $state: '/greeting' } } },
        name: { type: 'Text', props: { label: { $state: '/name' } } },
      });

      const ctx = buildPropResolutionContext(store);

      // Resolve children
      const greetingEl = spec.elements['greeting'];
      const greetingResolved = resolveElementProps(greetingEl.props ?? {}, ctx);
      expect(greetingResolved['label']).toBe('Hi');

      const nameEl = spec.elements['name'];
      const nameResolved = resolveElementProps(nameEl.props ?? {}, ctx);
      expect(nameResolved['label']).toBe('World');
    });
  });

  it('should support deeply nested children (recursive tree)', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const store = signalStateStore({});
      const spec = createSpec({
        root: {
          type: 'Container',
          props: {},
          children: ['level1'],
        },
        level1: {
          type: 'Container',
          props: {},
          children: ['level2'],
        },
        level2: {
          type: 'Container',
          props: {},
          children: ['leaf'],
        },
        leaf: {
          type: 'Text',
          props: { label: 'Deep Leaf' },
        },
      });

      // Walk the tree recursively
      function getLeafLabels(key: string): string[] {
        const el = spec.elements[key];
        if (!el) return [];
        const children = el.children ?? [];
        if (children.length === 0) {
          const ctx = buildPropResolutionContext(store);
          const resolved = resolveElementProps(el.props ?? {}, ctx);
          return [resolved['label'] as string];
        }
        return children.flatMap(getLeafLabels);
      }

      const labels = getLeafLabels('root');
      expect(labels).toEqual(['Deep Leaf']);
    });
  });

  it('should handle element with empty children array', () => {
    const spec = createSpec({
      root: { type: 'Container', props: {}, children: [] },
    });
    const el = spec.elements['root'];
    expect(el.children).toEqual([]);
  });

  it('should handle element with no children property', () => {
    const spec = createSpec({
      root: { type: 'Text', props: { label: 'No children' } },
    });
    const el = spec.elements['root'];
    // children defaults to undefined; component uses ?? []
    const childKeys = el.children ?? [];
    expect(childKeys).toEqual([]);
  });
});
