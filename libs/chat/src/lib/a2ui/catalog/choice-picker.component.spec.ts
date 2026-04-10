// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiChoicePickerComponent } from './choice-picker.component';

describe('A2uiChoicePickerComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.options()).toEqual([]);
    expect(component.selected()).toBe('');
  });

  it('should emit binding event on selection', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);
    fixture.componentRef.setInput('_bindings', { selected: '/department' });

    component.onChange({ target: { value: 'Engineering' } } as any);
    expect(emitFn).toHaveBeenCalledWith('a2ui:datamodel:/department:Engineering');
  });

  it('should not emit when no binding exists', () => {
    const fixture = TestBed.createComponent(A2uiChoicePickerComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.onChange({ target: { value: 'Engineering' } } as any);
    expect(emitFn).not.toHaveBeenCalled();
  });
});
