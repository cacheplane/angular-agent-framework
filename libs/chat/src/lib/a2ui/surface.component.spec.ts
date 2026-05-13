// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiSurfaceComponent } from './surface.component';
import type { A2uiSurfaceState } from './surface-store';
import type { A2uiViews } from './views';

@Component({ standalone: true, selector: 't-real', template: '<span data-role="real"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class RealCmp {}
@Component({ standalone: true, selector: 't-fb', template: '<span data-role="custom-fb"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class CustomFallback {}

function makeState(componentViews: Map<string, unknown>): A2uiSurfaceState {
  return {
    surface: {
      surfaceId: 's1', catalogId: 'basic',
      components: new Map(), dataModel: {},
    } as never,
    componentViews: componentViews as never,
  };
}

describe('A2uiSurfaceComponent — progressive rendering', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [A2uiSurfaceComponent] }));

  it('renders the default fallback when state.componentViews is empty', () => {
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(new Map()));
    fx.componentRef.setInput('catalog', { t: RealCmp });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.a2ui-default-fallback')).toBeTruthy();
  });

  it('renders the catalog fallback when a component is not ready', () => {
    const views = new Map<string, unknown>([['c1', {
      id: 'c1', type: 't', bindings: ['$.x'], ready: false, props: {}, def: { t: {} },
    }]]);
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(views));
    fx.componentRef.setInput('catalog', { t: { component: RealCmp, fallback: CustomFallback } } satisfies A2uiViews);
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="custom-fb"]')).toBeTruthy();
  });

  it('renders the real component when ready=true', () => {
    const views = new Map<string, unknown>([['c1', {
      id: 'c1', type: 't', bindings: [], ready: true, props: {}, def: { t: {} },
    }]]);
    const fx = TestBed.createComponent(A2uiSurfaceComponent);
    fx.componentRef.setInput('state', makeState(views));
    fx.componentRef.setInput('catalog', { t: { component: RealCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
  });
});
