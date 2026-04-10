// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiSliderComponent } from './slider.component';

describe('A2uiSliderComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiSliderComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.value()).toBe(0);
    expect(component.min()).toBe(0);
    expect(component.max()).toBe(100);
    expect(component.step()).toBe(1);
  });

  it('should emit binding event on input as number', () => {
    const fixture = TestBed.createComponent(A2uiSliderComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { value: '/rating' });

    component.onInput({ target: { value: '75' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/rating:75');
  });
});
