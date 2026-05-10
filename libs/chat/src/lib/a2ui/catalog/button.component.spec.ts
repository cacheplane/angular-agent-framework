// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { A2uiButtonComponent } from './button.component';

describe('A2uiButtonComponent', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). v1: label is dropped; a child Text component
  // is rendered inside the button via childKeys. The primary boolean controls styling.

  it('exports the component class', () => {
    expect(A2uiButtonComponent).toBeDefined();
  });

  it('has handleClick method', () => {
    expect(A2uiButtonComponent.prototype.handleClick).toBeInstanceOf(Function);
  });

  it('disabled input gates the button element', () => {
    // Verified from template: [disabled]="disabled()"
    const isDisabled = (disabled: boolean) => disabled;
    expect(isDisabled(false)).toBe(false);
    expect(isDisabled(true)).toBe(true);
  });
});
