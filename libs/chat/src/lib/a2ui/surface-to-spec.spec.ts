// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@cacheplane/a2ui';
import { surfaceToSpec } from './surface-to-spec';

function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
  const map = new Map<string, A2uiComponent>();
  for (const c of components) map.set(c.id, c);
  return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
}

describe('A2uiSurfaceComponent — data flow', () => {
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
    // The renderer will call resolveDynamic on each prop
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
    // Root should have expanded children referencing cloned IDs
    expect(spec.elements['root'].children).toEqual(['item_card__0', 'item_card__1']);
    // Expanded elements should have resolved props from their respective array items
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

describe('A2uiSurfaceComponent — consumer handlers', () => {
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

  it('filters out agent-authored _bindings and uses auto-detected bindings', () => {
    const surface = makeSurface(
      [{
        id: 'root', component: 'TextField', label: 'Name',
        value: { path: '/name' } as any,
        _bindings: { value: '/name' },
      } as any],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['_bindings']).toEqual({ value: '/name' });
  });
});
