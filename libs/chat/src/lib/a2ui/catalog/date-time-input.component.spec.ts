// SPDX-License-Identifier: MIT
import { describe, it, expect, vi } from 'vitest';
import { emitBinding } from './emit-binding';

describe('A2uiDateTimeInputComponent — v1 protocol', () => {
  // NOTE: Angular signal-based inputs can't be tested via TestBed without the
  // angular() vite plugin (NG0303). v1: enableDate + enableTime booleans drive
  // htmlInputType; validationResult was removed.

  describe('htmlInputType logic', () => {
    const getType = (enableDate: boolean, enableTime: boolean): string => {
      if (enableDate && enableTime) return 'datetime-local';
      if (enableTime) return 'time';
      return 'date';
    };

    it('returns date when only enableDate is true', () => {
      expect(getType(true, false)).toBe('date');
    });

    it('returns time when only enableTime is true', () => {
      expect(getType(false, true)).toBe('time');
    });

    it('returns datetime-local when both are true', () => {
      expect(getType(true, true)).toBe('datetime-local');
    });

    it('defaults to date when both are false', () => {
      expect(getType(false, false)).toBe('date');
    });
  });

  describe('onChange emit logic', () => {
    it('emits binding with date value', () => {
      const emit = vi.fn();
      const bindings = { value: '/appointmentDate' };
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

    it('does not emit when no binding exists for value', () => {
      const emit = vi.fn();
      emitBinding(emit, {}, 'value', '2026-04-15');
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
