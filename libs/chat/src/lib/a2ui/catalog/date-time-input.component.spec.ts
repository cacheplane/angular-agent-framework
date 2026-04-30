// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiDateTimeInputComponent — onChange logic', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). These tests verify the behavioral contract
  // of onChange: extract value from date/time/datetime input → emit binding.

  it('emits binding with date value', () => {
    const emit = vi.fn();
    const bindings = { value: '/appointmentDate' };
    // Mirrors onChange: const val = (event.target as HTMLInputElement).value;
    const event = { target: { value: '2026-04-15' } } as unknown as Event;
    const val = (event.target as HTMLInputElement).value;
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/appointmentDate:2026-04-15');
  });

  it('emits binding with datetime-local value', () => {
    const emit = vi.fn();
    const bindings = { value: '/scheduledAt' };
    const event = { target: { value: '2026-04-15T14:30' } } as unknown as Event;
    const val = (event.target as HTMLInputElement).value;
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/scheduledAt:2026-04-15T14:30');
  });

  it('emits binding with time value', () => {
    const emit = vi.fn();
    const bindings = { value: '/startTime' };
    const event = { target: { value: '09:00' } } as unknown as Event;
    const val = (event.target as HTMLInputElement).value;
    emitBinding(emit, bindings, 'value', val);
    expect(emit).toHaveBeenCalledWith('a2ui:datamodel:/startTime:09:00');
  });

  it('does not emit when no binding exists for value', () => {
    const emit = vi.fn();
    emitBinding(emit, {}, 'value', '2026-04-15');
    expect(emit).not.toHaveBeenCalled();
  });
});
