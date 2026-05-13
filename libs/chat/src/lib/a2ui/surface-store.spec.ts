// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createA2uiSurfaceStore } from './surface-store';

function setup() {
  let store!: ReturnType<typeof createA2uiSurfaceStore>;
  TestBed.configureTestingModule({});
  TestBed.runInInjectionContext(() => {
    store = createA2uiSurfaceStore();
  });
  return store;
}

describe('A2uiSurfaceStore (v1, deferred-apply)', () => {
  test('starts with no surfaces', () => {
    const store = setup();
    expect(store.surfaces().size).toBe(0);
  });

  test('surfaceUpdate alone does not expose surface', () => {
    const store = setup();
    store.apply({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    });
    expect(store.surfaces().size).toBe(0);
  });

  test('beginRendering commits buffered surfaceUpdate', () => {
    const store = setup();
    store.apply({
      surfaceUpdate: {
        surfaceId: 's1',
        components: [{ id: 'root', component: { Card: { child: 'inner' } } }],
      },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const surfaces = store.surfaces();
    expect(surfaces.size).toBe(1);
    const s = surfaces.get('s1');
    expect(s?.components.has('root')).toBe(true);
    expect(s?.dataModel).toEqual({});
  });

  test('beginRendering commits buffered dataModelUpdate too', () => {
    const store = setup();
    store.apply({
      surfaceUpdate: { surfaceId: 's1', components: [
        { id: 'root', component: { Text: { text: { path: '/title' } } } },
      ] },
    });
    store.apply({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'title', valueString: 'Hello' }],
      },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const s = store.surfaces().get('s1');
    expect(s?.dataModel).toEqual({ title: 'Hello' });
  });

  test('post-render dataModelUpdate applies incrementally', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'x' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    store.apply({
      dataModelUpdate: { surfaceId: 's1', contents: [{ key: 'count', valueNumber: 7 }] },
    });
    expect(store.surfaces().get('s1')?.dataModel).toEqual({ count: 7 });
  });

  test('post-render surfaceUpdate stays buffered until second beginRendering', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'a' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'b' } } } },
    ] } });
    // Without a second beginRendering, the new surfaceUpdate stays buffered.
    const root = store.surfaces().get('s1')?.components.get('root');
    expect((root?.component as { Text: { text: { literalString: string } } }).Text.text.literalString).toBe('a');
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const root2 = store.surfaces().get('s1')?.components.get('root');
    expect((root2?.component as { Text: { text: { literalString: string } } }).Text.text.literalString).toBe('b');
  });

  test('deleteSurface clears both buffer and committed surface', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Card: { child: 'inner' } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    expect(store.surfaces().size).toBe(1);
    store.apply({ deleteSurface: { surfaceId: 's1' } });
    expect(store.surfaces().size).toBe(0);
  });

  test('dataModelUpdate before any surfaceUpdate is a no-op', () => {
    const store = setup();
    store.apply({
      dataModelUpdate: { surfaceId: 's1', contents: [{ key: 'name', valueString: 'B' }] },
    });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    // No surfaceUpdate ever arrived; commit is a no-op.
    expect(store.surfaces().size).toBe(0);
  });

  test('surface() returns a signal for a specific surface', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'hi' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const s = store.surface('s1');
    expect(s()).toBeDefined();
    expect(s()!.surfaceId).toBe('s1');
  });

  test('captures styles from beginRendering (v1 spec)', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'hi' } } } },
    ] } });
    store.apply({ beginRendering: {
      surfaceId: 's1',
      root: 'root',
      styles: { font: 'Roboto', primaryColor: '#FF6633' },
    } });
    const s = store.surfaces().get('s1')!;
    expect(s.styles).toEqual({ font: 'Roboto', primaryColor: '#FF6633' });
  });

  test('omits styles field when beginRendering does not include it', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'hi' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const s = store.surfaces().get('s1')!;
    expect(s.styles).toBeUndefined();
  });

  test('preserves existing styles on re-render when new beginRendering omits them', () => {
    const store = setup();
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'hi' } } } },
    ] } });
    store.apply({ beginRendering: {
      surfaceId: 's1',
      root: 'root',
      styles: { primaryColor: '#0A84FF' },
    } });
    // Second beginRendering without styles — keep prior.
    store.apply({ surfaceUpdate: { surfaceId: 's1', components: [
      { id: 'root', component: { Text: { text: { literalString: 'hi' } } } },
    ] } });
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } });
    const s = store.surfaces().get('s1')!;
    expect(s.styles).toEqual({ primaryColor: '#0A84FF' });
  });
});

describe('createA2uiSurfaceStore — applyPartialArgs', () => {
  test('dispatches each envelope via apply() in order', () => {
    const store = setup();
    const envelopes = [
      { surfaceUpdate: { surfaceId: 's1', components: [{ id: 'c', type: 'text', props: {} }] } },
      { beginRendering: { surfaceId: 's1', root: 'c' } },
    ];
    store.applyPartialArgs('tc-1', envelopes);
    expect(store.surfaces().get('s1')?.components.has('c')).toBe(true);
  });

  test('records the tool_call_id as live (queryable)', () => {
    const store = setup();
    expect(store.isPartialLive('tc-1')).toBe(false);
    store.applyPartialArgs('tc-1', [{ surfaceUpdate: { surfaceId: 's1', components: [] } }]);
    expect(store.isPartialLive('tc-1')).toBe(true);
  });

  test('ignores invalid envelopes silently', () => {
    const store = setup();
    // missing required top-level key — apply() ignores
    store.applyPartialArgs('tc-x', [{ junk: 1 } as never]);
    expect(store.surfaces().size).toBe(0);
    expect(store.isPartialLive('tc-x')).toBe(true);  // still tracked
  });
});

describe('A2uiSurfaceStore — per-component readiness', () => {
  const surfaceUpdate = (id: string, components: { id: string; def: unknown }[]) => ({
    surfaceUpdate: {
      surfaceId: id,
      components: components.map((c) => ({ id: c.id, component: c.def })),
    },
  } as never);
  const beginRendering = (id: string, root: string) => ({
    beginRendering: { surfaceId: id, root },
  } as never);
  const dataModelUpdate = (id: string, contents: { key: string; valueString?: string }[]) => ({
    dataModelUpdate: { surfaceId: id, contents },
  } as never);

  test('extracts bindings from a component on surfaceUpdate apply', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    const view = store.surfaceState('s1')()!.componentViews.get('c1')!;
    expect(view.bindings).toEqual(['$.form.name']);
  });

  test('component.ready is false when bindings are unpopulated', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(false);
  });

  test('component.ready becomes true when all bindings are populated by dataModelUpdate', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.form.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    store.apply({
      dataModelUpdate: {
        surfaceId: 's1',
        contents: [{ key: 'form', valueMap: [{ key: 'name', valueString: 'Ada' }] }],
      },
    } as never);
    const view = store.surfaceState('s1')()!.componentViews.get('c1')!;
    expect(view.ready).toBe(true);
    const textFieldProps = view.props['TextField'] as Record<string, unknown>;
    expect(textFieldProps['value']).toBe('Ada');
  });

  test('resolveProps substitutes partial references (mixed literal + {$.path}) in props', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { Button: { label: 'Hello {$.name}!' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    const initialView = store.surfaceState('s1')()!.componentViews.get('c1')!;
    expect(initialView.bindings).toEqual(['$.name']);
    expect(initialView.ready).toBe(false);

    store.apply(dataModelUpdate('s1', [{ key: 'name', valueString: 'Ada' }]));
    const view = store.surfaceState('s1')()!.componentViews.get('c1')!;
    expect(view.ready).toBe(true);
    const buttonProps = view.props['Button'] as Record<string, unknown>;
    expect(buttonProps['label']).toBe('Hello Ada!');
  });

  test('component.ready stays true after a later dataModelUpdate clears a binding (monotonic)', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'c1', def: { TextField: { value: '{$.name}' } } },
    ]));
    store.apply(beginRendering('s1', 'c1'));
    store.apply(dataModelUpdate('s1', [{ key: 'name', valueString: 'Ada' }]));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(true);
    store.apply(dataModelUpdate('s1', [{ key: 'other', valueString: 'x' }]));
    expect(store.surfaceState('s1')()!.componentViews.get('c1')!.ready).toBe(true);
  });

  test('multiple components have independent readiness', () => {
    const store = setup();
    store.apply(surfaceUpdate('s1', [
      { id: 'a', def: { TextField: { value: '{$.x}' } } },
      { id: 'b', def: { TextField: { value: '{$.y}' } } },
    ]));
    store.apply(beginRendering('s1', 'a'));
    store.apply(dataModelUpdate('s1', [{ key: 'x', valueString: '1' }]));
    const state = store.surfaceState('s1')()!;
    expect(state.componentViews.get('a')!.ready).toBe(true);
    expect(state.componentViews.get('b')!.ready).toBe(false);
  });
});
