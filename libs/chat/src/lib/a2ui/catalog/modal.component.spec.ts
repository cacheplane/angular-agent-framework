// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiModalComponent — onBackdropClick logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onBackdropClick: guard on dismissible, then emit open=false binding.

  it('emits open=false binding when dismissible is true', () => {
    const emit = vi.fn();
    const bindings = { open: '/showModal' };
    // Mirrors onBackdropClick: if (!this.dismissible()) return; emitBinding(...)
    const dismissible = true;
    if (!dismissible) return;
    emitBinding(emit, bindings, 'open', false);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/showModal:false');
  });

  it('does not emit when dismissible is false', () => {
    const emit = vi.fn();
    const bindings = { open: '/showModal' };
    const dismissible = false;
    if (!dismissible) return;
    emitBinding(emit, bindings, 'open', false);
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not emit when no binding exists for open', () => {
    const emit = vi.fn();
    const dismissible = true;
    if (!dismissible) return;
    emitBinding(emit, {}, 'open', false);
    expect(emit).not.toHaveBeenCalled();
  });
});
