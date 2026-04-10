// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { A2uiButtonComponent } from './button.component';

describe('A2uiButtonComponent', () => {
  it('should create with default inputs', () => {
    const fixture = TestBed.createComponent(A2uiButtonComponent);
    const component = fixture.componentInstance;
    expect(component.label()).toBe('');
    expect(component.variant()).toBe('primary');
    expect(component.disabled()).toBe(false);
    expect(component.validationResult()).toEqual({ valid: true, errors: [] });
  });

  it('should emit click event on handleClick', () => {
    const fixture = TestBed.createComponent(A2uiButtonComponent);
    const component = fixture.componentInstance;
    const emitFn = vi.fn();
    fixture.componentRef.setInput('emit', emitFn);

    component.handleClick();
    expect(emitFn).toHaveBeenCalledWith('click');
  });
});
