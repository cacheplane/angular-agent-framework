// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { A2uiSlotDirective } from './a2ui-slot.directive';
import type { A2uiComponentView } from './component-view';
import type { A2uiViews } from './views';

@Component({
  standalone: true, selector: 'a2ui-test-real', changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span data-role="real">REAL:{{ label() ?? "" }}</span>',
})
class RealCmp { readonly label = input<string>(); }

@Component({
  standalone: true, selector: 'a2ui-test-fallback', changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span data-role="fallback">FB</span>',
})
class FallbackCmp {}

@Component({
  standalone: true,
  imports: [A2uiSlotDirective],
  template: `<ng-container *a2uiSlot="view(); views: views()" />`,
})
class HostCmp {
  readonly view = input.required<A2uiComponentView>();
  readonly views = input.required<A2uiViews>();
}

function makeView(over: Partial<A2uiComponentView> = {}): A2uiComponentView {
  return {
    id: 'c1', type: 't', bindings: [], ready: false, props: {}, def: { t: {} } as never,
    ...over,
  };
}

describe('a2uiSlot', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('mounts the fallback while !ready', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: false }));
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="fallback"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeFalsy();
  });

  it('mounts the real component once ready=true', () => {
    const fx = TestBed.createComponent(HostCmp);
    const v = signal(makeView({ ready: false }));
    fx.componentRef.setInput('view', v());
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'Ada' } }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="real"]')!.textContent).toContain('Ada');
  });

  it('monotonic: once real mounts, later ready=false does NOT remount fallback', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'Ada' } }));
    fx.componentRef.setInput('views', { t: { component: RealCmp, fallback: FallbackCmp } });
    fx.detectChanges();
    fx.componentRef.setInput('view', makeView({ ready: false, props: {} }));
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
    expect(fx.nativeElement.querySelector('[data-role="fallback"]')).toBeFalsy();
  });

  it('uses A2uiDefaultFallbackComponent when views[type].fallback is omitted', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: false }));
    fx.componentRef.setInput('views', { t: { component: RealCmp } });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('.a2ui-default-fallback')).toBeTruthy();
  });

  it('accepts bare-Type view entries (legacy shape)', () => {
    const fx = TestBed.createComponent(HostCmp);
    fx.componentRef.setInput('view', makeView({ ready: true, props: { label: 'X' } }));
    fx.componentRef.setInput('views', { t: RealCmp });
    fx.detectChanges();
    expect(fx.nativeElement.querySelector('[data-role="real"]')).toBeTruthy();
  });
});
