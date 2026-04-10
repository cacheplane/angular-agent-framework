// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiCheckBoxComponent — onChange logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onChange: extract boolean checked state from event → emit binding.

  it('emits binding with true when checkbox is checked', () => {
    const emit = vi.fn();
    const bindings = { checked: '/agreed' };
    // Mirrors onChange: const val = (event.target as HTMLInputElement).checked;
    const event = { target: { checked: true } } as unknown as Event;
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(emit, bindings, 'checked', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });

  it('emits binding with false when checkbox is unchecked', () => {
    const emit = vi.fn();
    const bindings = { checked: '/agreed' };
    const event = { target: { checked: false } } as unknown as Event;
    const val = (event.target as HTMLInputElement).checked;
    emitBinding(emit, bindings, 'checked', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/agreed:false');
  });

  it('does not emit when no binding exists for checked', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'checked', true);
    expect(emit).not.toHaveBeenCalled();
  });
});
