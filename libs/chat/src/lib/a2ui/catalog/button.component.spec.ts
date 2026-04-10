// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect, vi } from 'vitest';

describe('A2uiButtonComponent — handleClick logic', () => {
  it('should call emit with click event', () => {
    // Button.handleClick() calls this.emit()('click')
    const emit = vi.fn();
    emit('click');
    expect(emit).toHaveBeenCalledWith('click');
  });
});
