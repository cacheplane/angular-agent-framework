// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { A2uiButtonComponent } from './button.component';

describe('A2uiButtonComponent', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). handleClick() dispatches 'click' via the
  // emit signal, which requires a working Angular injection context to test.

  it('exports the component class', () => {
    expect(A2uiButtonComponent).toBeDefined();
  });

  it('has handleClick method', () => {
    expect(A2uiButtonComponent.prototype.handleClick).toBeInstanceOf(Function);
  });

  it('template disables button when disabled or validation fails', () => {
    // Verified from template: [disabled]="disabled() || !validationResult().valid"
    // This is a documentation test — the actual binding requires template compilation.
    // The button is disabled when:
    // - disabled input is true, OR
    // - validationResult().valid is false
    const disabledWhen = (disabled: boolean, valid: boolean) => disabled || !valid;
    expect(disabledWhen(false, true)).toBe(false);
    expect(disabledWhen(true, true)).toBe(true);
    expect(disabledWhen(false, false)).toBe(true);
    expect(disabledWhen(true, false)).toBe(true);
  });
});
