// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiModalComponent — onBackdropClick logic', () => {
  it('should emit binding to close modal when dismissible', () => {
    const emit = vi.fn();
    const bindings = { open: '/showModal' };
    // Simulates: if (!this.dismissible()) return; emitBinding(...)
    const dismissible = true;
    if (dismissible) {
      emitBinding(emit, bindings, 'open', false);
    }
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/showModal:false');
  });

  it('should not emit when not dismissible', () => {
    const emit = vi.fn();
    const bindings = { open: '/showModal' };
    const dismissible = false;
    if (dismissible) {
      emitBinding(emit, bindings, 'open', false);
    }
    expect(emit).not.toHaveBeenCalled();
  });
});
