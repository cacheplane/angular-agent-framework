// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@threadplane/a2ui';
import { surfaceToSpec } from './surface-to-spec';

function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
  const map = new Map<string, A2uiComponent>();
  for (const c of components) map.set(c.id, c);
  return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
}

describe('surfaceToSpec (v1)', () => {
  it('resolves root component from surface', () => {
    const surface = makeSurface([
      { id: 'root', component: { Column: { children: { explicitList: ['t1'] } } } },
      { id: 't1', component: { Text: { text: { literalString: 'Hello' } } } },
    ]);
    expect(surface.components.get('root')!.component).toMatchObject({ Column: {} });
  });

  it('resolves DynamicString literalString prop', () => {
    const surface = makeSurface([
      { id: 'root', component: { Text: { text: { literalString: 'Hi' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['text']).toBe('Hi');
  });

  it('leaves DynamicString path prop as $bindState marker for json-render', () => {
    // Path refs preserve their dynamic resolution: surface-to-spec emits
    // a `$bindState` marker so json-render reads the current value from
    // its state store on every render. This is what enables user input
    // (TextField, MultipleChoice, etc.) to write back through the
    // a2ui:datamodel:<path>:<value> emit protocol and have the UI
    // reflect those writes immediately.
    const surface = makeSurface(
      [{ id: 'root', component: { Text: { text: { path: '/greeting' } } } }],
      { greeting: 'Hello World' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['text']).toEqual({ $bindState: '/greeting' });
    // Spec.state seeds the json-render store with the initial value.
    expect(spec.state).toEqual({ greeting: 'Hello World' });
  });

  it('returns null when surface has no components', () => {
    const surface = makeSurface([]);
    expect(surfaceToSpec(surface)).toBeNull();
  });

  it('Card: single child rendered as length-1 children array', () => {
    const surface = makeSurface([
      { id: 'root', component: { Card: { child: 'inner' } } },
      { id: 'inner', component: { Text: { text: { literalString: 'body' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['inner']);
  });

  it('Button: child rendered as length-1 children array', () => {
    const surface = makeSurface([
      { id: 'root', component: { Button: { child: 'lbl', action: { name: 'click' } } } },
      { id: 'lbl', component: { Text: { text: { literalString: 'OK' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['lbl']);
  });

  it('Column: explicitList children', () => {
    const surface = makeSurface([
      { id: 'root', component: { Column: { children: { explicitList: ['a', 'b'] } } } },
      { id: 'a', component: { Text: { text: { literalString: 'A' } } } },
      { id: 'b', component: { Text: { text: { literalString: 'B' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['a', 'b']);
  });

  it('List: template expansion over dataModel array', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: { List: { children: { template: { componentId: 'item', dataBinding: '/items' } } } } },
        // Relative path 'name' is resolved against each item's basePath (/items/0, /items/1)
        { id: 'item', component: { Text: { text: { path: 'name' } } } },
      ],
      { items: [{ name: 'Alice' }, { name: 'Bob' }] },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['item__0', 'item__1']);
    expect(spec.elements['item__0'].props['text']).toBe('Alice');
    expect(spec.elements['item__1'].props['text']).toBe('Bob');
  });

  it('Modal: entryPointChild + contentChild as children array', () => {
    const surface = makeSurface([
      { id: 'root', component: { Modal: { entryPointChild: 'trigger', contentChild: 'body', title: { literalString: 'My Modal' } } } },
      { id: 'trigger', component: { Button: { child: 'lbl', action: { name: 'open' } } } },
      { id: 'body', component: { Text: { text: { literalString: 'content' } } } },
      { id: 'lbl', component: { Text: { text: { literalString: 'Open' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['trigger', 'body']);
  });

  it('Tabs: tabItems children', () => {
    const surface = makeSurface([
      { id: 'root', component: { Tabs: { tabItems: [
        { title: { literalString: 'Tab 1' }, child: 'panel1' },
        { title: { literalString: 'Tab 2' }, child: 'panel2' },
      ] } } },
      { id: 'panel1', component: { Text: { text: { literalString: 'Panel 1' } } } },
      { id: 'panel2', component: { Text: { text: { literalString: 'Panel 2' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].children).toEqual(['panel1', 'panel2']);
  });

  it('maps Button action to spec on.click binding', () => {
    const surface = makeSurface([
      { id: 'root', component: { Column: { children: { explicitList: ['btn'] } } } },
      {
        id: 'btn',
        component: { Button: {
          child: 'lbl',
          action: { name: 'formSubmit', context: [
            { key: 'formId', value: { literalString: 'signup' } },
          ] },
        } },
      },
      { id: 'lbl', component: { Text: { text: { literalString: 'Submit' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    const btnElement = spec.elements['btn'];
    expect(btnElement.on).toBeDefined();
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:event',
      params: { surfaceId: 's1', sourceComponentId: 'btn', name: 'formSubmit', context: { formId: 'signup' } },
    });
  });

  it('resolves action context DynamicValue path', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: { Column: { children: { explicitList: ['btn'] } } } },
        {
          id: 'btn',
          component: { Button: {
            child: 'lbl',
            action: { name: 'submit', context: [
              { key: 'email', value: { path: '/email' } },
            ] },
          } },
        },
        { id: 'lbl', component: { Text: { text: { literalString: 'Go' } } } },
      ],
      { email: 'alice@example.com' },
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ email: 'alice@example.com' });
  });

  it('passes through elements without actions unchanged', () => {
    const surface = makeSurface([
      { id: 'root', component: { Text: { text: { literalString: 'Hello' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].on).toBeUndefined();
  });

  it('initializes spec state from surface dataModel', () => {
    const surface = makeSurface(
      [{ id: 'root', component: { Text: { text: { literalString: 'Hi' } } } }],
      { count: 0, name: 'test' },
    );
    const spec = surfaceToSpec(surface)!;
    expect(spec.state).toEqual({ count: 0, name: 'test' });
  });

  it('attaches _bindings prop for path ref values', () => {
    const surface = makeSurface(
      [{ id: 'root', component: { TextField: { label: { literalString: 'Name' }, text: { path: '/name' } } } }],
      { name: 'Alice' },
    );
    const spec = surfaceToSpec(surface)!;
    // Path refs become $bindState markers (see "leaves DynamicString
    // path prop" test above). _bindings still maps prop name → path so
    // catalog components emit a2ui:datamodel:<path>:<value> on user
    // input.
    expect(spec.elements['root'].props['text']).toEqual({ $bindState: '/name' });
    expect(spec.elements['root'].props['_bindings']).toEqual({ text: '/name' });
  });

  it('does not attach _bindings for literal values', () => {
    const surface = makeSurface([
      { id: 'root', component: { Text: { text: { literalString: 'Hello' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.elements['root'].props['_bindings']).toBeUndefined();
  });

  it('uses first component as root when no root component exists', () => {
    const surface = makeSurface([
      { id: 'child', component: { Text: { text: { literalString: 'No root' } } } },
    ]);
    const spec = surfaceToSpec(surface)!;
    expect(spec.root).toBe('child');
  });
});
