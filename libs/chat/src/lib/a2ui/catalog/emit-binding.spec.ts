// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('emitBinding', () => {
  it('emits a2ui:datamodel event with path and value', () => {
    const emit = vi.fn();
    emitBinding(emit, { value: '/name' }, 'value', 'Alice');
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/name:Alice');
  });

  it('does nothing when binding prop is not in bindings map', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });

  it('does nothing when bindings is undefined', () => {
    const emit = vi.fn();
    emitBinding(emit, undefined, 'value', 'Alice');
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits numeric values', () => {
    const emit = vi.fn();
    emitBinding(emit, { value: '/count' }, 'value', 42);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/count:42');
  });

  it('emits boolean values', () => {
    const emit = vi.fn();
    emitBinding(emit, { checked: '/agreed' }, 'checked', true);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/agreed:true');
  });
});
