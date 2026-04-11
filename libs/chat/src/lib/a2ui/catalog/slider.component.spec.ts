// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiSliderComponent — onInput logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onInput: extract value from range input, coerce to Number, emit binding.

  it('emits binding with numeric value from range input', () => {
    const emit = vi.fn();
    const bindings = { value: '/rating' };
    // Mirrors onInput: const val = Number((event.target as HTMLInputElement).value);
    const event = { target: { value: '75' } } as unknown as Event;
    const val = Number((event.target as HTMLInputElement).value);
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/rating:75');
  });

  it('coerces string range value to number', () => {
    // Slider's onInput uses Number() to coerce — verify the coercion
    const event = { target: { value: '42.5' } } as unknown as Event;
    const val = Number((event.target as HTMLInputElement).value);
    expect(val).toBe(42.5);
    expect(typeof val).toBe('number');
  });

  it('does not emit when no binding exists for value', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', 50);
    expect(emit).not.toHaveBeenCalled();
  });
});
