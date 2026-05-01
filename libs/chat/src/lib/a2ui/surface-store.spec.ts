// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { createA2uiSurfaceStore } from './surface-store';
import type { A2uiMessage } from '@ngaf/a2ui';

describe('createA2uiSurfaceStore', () => {
  function setup() {
    let store!: ReturnType<typeof createA2uiSurfaceStore>;
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      store = createA2uiSurfaceStore();
    });
    return store;
  }

  it('starts with no surfaces', () => {
    const store = setup();
    expect(store.surfaces().size).toBe(0);
  });

  it('creates a surface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    expect(store.surfaces().size).toBe(1);
    const s = store.surfaces().get('s1')!;
    expect(s.surfaceId).toBe('s1');
    expect(s.catalogId).toBe('basic');
    expect(s.components.size).toBe(0);
  });

  it('adds components to a surface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({
      type: 'updateComponents',
      surfaceId: 's1',
      components: [
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'Hello' },
      ],
    });
    const s = store.surfaces().get('s1')!;
    expect(s.components.size).toBe(2);
    expect(s.components.get('root')!.component).toBe('Column');
    expect(s.components.get('t1')!.component).toBe('Text');
  });

  it('replaces existing components by id', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({ type: 'updateComponents', surfaceId: 's1', components: [{ id: 't1', component: 'Text', text: 'Old' }] });
    store.apply({ type: 'updateComponents', surfaceId: 's1', components: [{ id: 't1', component: 'Text', text: 'New' }] });
    expect((store.surfaces().get('s1')!.components.get('t1') as any).text).toBe('New');
  });

  it('sets data model at path', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({ type: 'updateDataModel', surfaceId: 's1', path: '/user/name', value: 'Alice' });
    expect((store.surfaces().get('s1')!.dataModel as any).user.name).toBe('Alice');
  });

  it('replaces entire data model when path is omitted', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({ type: 'updateDataModel', surfaceId: 's1', value: { fresh: true } });
    expect(store.surfaces().get('s1')!.dataModel).toEqual({ fresh: true });
  });

  it('deletes data model key when value is omitted', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({ type: 'updateDataModel', surfaceId: 's1', path: '/a', value: 1 });
    store.apply({ type: 'updateDataModel', surfaceId: 's1', path: '/a' });
    expect((store.surfaces().get('s1')!.dataModel as any).a).toBeUndefined();
  });

  it('deletes a surface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    store.apply({ type: 'deleteSurface', surfaceId: 's1' });
    expect(store.surfaces().size).toBe(0);
  });

  it('surface() returns a signal for a specific surface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    const s = store.surface('s1');
    expect(s()).toBeDefined();
    expect(s()!.surfaceId).toBe('s1');
  });

  it('ignores messages for non-existent surfaces', () => {
    const store = setup();
    store.apply({ type: 'updateComponents', surfaceId: 'nope', components: [] });
    expect(store.surfaces().size).toBe(0);
  });

  it('preserves sendDataModel flag from createSurface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic', sendDataModel: true });
    expect(store.surfaces().get('s1')!.sendDataModel).toBe(true);
  });

  it('defaults sendDataModel to undefined when not set', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    expect(store.surfaces().get('s1')!.sendDataModel).toBeUndefined();
  });
});
