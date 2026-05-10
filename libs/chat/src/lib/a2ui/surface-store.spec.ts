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
});
