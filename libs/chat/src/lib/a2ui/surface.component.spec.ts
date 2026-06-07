// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiSurfaceComponent } from './surface.component';
import type { A2uiSurfaceState } from './surface-store';
import { createA2uiSurfaceStore } from './surface-store';
import { a2uiBasicCatalog } from './catalog';

@Component({ standalone: true, selector: 'a2ui-test-real', template: '<span data-role="real"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class RealCmp {}
@Component({ standalone: true, selector: 'a2ui-test-custom-fb', template: '<span data-role="custom-fb"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class CustomFallback {}

function makeState(components: Array<{ id: string; type: string; props?: Record<string, unknown> }> = []): A2uiSurfaceState {
  const compsMap = new Map<string, never>(
    components.map((c) => [c.id, {
      id: c.id,
      component: { [c.type]: c.props ?? {} },
    } as never]),
  );
  return {
    surface: {
      surfaceId: 's1', catalogId: 'basic',
      components: compsMap, dataModel: {},
    } as never,
    componentViews: new Map() as never,
  };
}

describe('A2uiSurfaceComponent — empty surface', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [A2uiSurfaceComponent] }));

  it('renders the default fallback when state.surface has no components', () => {
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState([]));
    fx.componentRef.setInput('catalog', { t: RealCmp });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.a2ui-default-fallback')).toBeTruthy();
  });

  it('renders a custom fallback when surfaceFallback is set and surface is empty', () => {
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState([]));
    fx.componentRef.setInput('catalog', { t: RealCmp });
    fx.componentRef.setInput('surfaceFallback', CustomFallback);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="custom-fb"]')).toBeTruthy();
  });
});

describe('A2uiSurfaceComponent — nested children with real catalog (regression)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [A2uiSurfaceComponent] }));

  it('renders Column children defined via children.explicitList', () => {
    // Reproduces the contact-form bug: a Column with explicitList children
    // must actually render those children. Prior to the fix, the slot path
    // pushed wrapped wire-format props onto the catalog component which
    // had no matching `Column` input — so childKeys stayed empty and the
    // Column rendered as an empty <div>.
    const store = createA2uiSurfaceStore();
    store.apply({ surfaceUpdate: {
      surfaceId: 's1',
      components: [
        { id: 'root', component: { Column: {
          children: { explicitList: ['leaf'] },
          distribution: 'start',
          alignment: 'stretch',
        } } },
        { id: 'leaf', component: { Text: {
          text: { literalString: 'Hello' },
          usageHint: 'h2',
        } } },
      ],
    } } as never);
    store.apply({ beginRendering: { surfaceId: 's1', root: 'root' } } as never);

    const state = store.surfaceState('s1')();
    expect(state).toBeDefined();

    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', state);
    fx.componentRef.setInput('catalog', a2uiBasicCatalog());
    fx.detectChanges();

    // The Text leaf must appear inside the rendered surface. If the
    // Column's childKeys input was never set, no Text gets rendered.
    expect(fx.nativeElement.textContent).toContain('Hello');
  });
});
