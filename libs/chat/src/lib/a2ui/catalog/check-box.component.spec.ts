// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiCheckBoxComponent } from './check-box.component';

describe('A2uiCheckBoxComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.checked()).toBe(false);
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit binding event on change', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { checked: '/agreed' });

    component.onChange({ target: { checked: true } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiCheckBoxComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onChange({ target: { checked: true } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
