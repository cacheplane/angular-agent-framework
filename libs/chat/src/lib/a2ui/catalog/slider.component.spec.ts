// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiSliderComponent — onInput logic', () => {
  it('should emit binding event with numeric value', () => {
    const emit = vi.fn();
    const bindings = { value: '/rating' };
    emitBinding(emit, bindings, 'value', 75);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/rating:75');
  });
});
