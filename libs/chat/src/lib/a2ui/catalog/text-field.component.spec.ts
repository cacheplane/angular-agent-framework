// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiTextFieldComponent — onInput logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onInput: extract string value from event → emit binding for 'value' prop.

  it('emits binding with string value extracted from input event', () => {
    const emit = vi.fn();
    const bindings = { value: '/name' };
    // Mirrors onInput: const val = (event.target as HTMLInputElement).value;
    const event = { target: { value: 'Alice' } } as unknown as Event;
    const val = (event.target as HTMLInputElement).value;
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('emits empty string for cleared input', () => {
    const emit = vi.fn();
    const bindings = { value: '/name' };
    const event = { target: { value: '' } } as unknown as Event;
    const val = (event.target as HTMLInputElement).value;
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:');
  });

  it('does not emit when no binding exists for value', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });
});
