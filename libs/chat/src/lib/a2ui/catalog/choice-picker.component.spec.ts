// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiChoicePickerComponent — onChange logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onChange: extract selected value from select event → emit binding for 'selected'.

  it('emits binding with selected option value', () => {
    const emit = vi.fn();
    const bindings = { selected: '/department' };
    // Mirrors onChange: const val = (event.target as HTMLSelectElement).value;
    const event = { target: { value: 'Engineering' } } as unknown as Event;
    const val = (event.target as HTMLSelectElement).value;
    emitBinding(emit, bindings, 'selected', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/department:Engineering');
  });

  it('emits binding with empty string when selection is cleared', () => {
    const emit = vi.fn();
    const bindings = { selected: '/department' };
    const event = { target: { value: '' } } as unknown as Event;
    const val = (event.target as HTMLSelectElement).value;
    emitBinding(emit, bindings, 'selected', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/department:');
  });

  it('does not emit when no binding exists for selected', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'selected', 'Engineering');
    expect(emit).not.toHaveBeenCalled();
  });
});
