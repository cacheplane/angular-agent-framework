// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiCheckBoxComponent — onChange logic', () => {
  it('should emit binding event for checked state', () => {
    const emit = vi.fn();
    const bindings = { checked: '/agreed' };
    emitBinding(emit, bindings, 'checked', true);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });

  it('should not emit when no binding exists', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'checked', true);
    expect(emit).not.toHaveBeenCalled();
  });
});
