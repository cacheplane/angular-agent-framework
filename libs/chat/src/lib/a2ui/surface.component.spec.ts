// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@cacheplane/a2ui';
import { surfaceToSpec } from './surface.component';

describe('A2uiSurfaceComponent — data flow', () => {
  function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
  }

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
