// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiTextFieldComponent } from './text-field.component';

describe('A2uiTextFieldComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.value()).toBe('');
    expect(component.placeholder()).toBe('');
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit binding event on input', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { value: '/name' });

    component.onInput({ target: { value: 'Alice' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiTextFieldComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onInput({ target: { value: 'Alice' } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
