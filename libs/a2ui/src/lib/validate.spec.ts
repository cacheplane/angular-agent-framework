// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { validateChecks } from './validate';
import type { A2uiCheck } from './types';

describe('validateChecks', () => {
  it('required passes for non-empty value', () => {
    const checks: A2uiCheck[] = [{ call: 'required', args: { value: 'hello' }, message: 'Required' }];
    expect(validateChecks(checks)).toEqual({ valid: true, errors: [] });
  });

  it('required fails for empty string', () => {
    const checks: A2uiCheck[] = [{ call: 'required', args: { value: '' }, message: 'Required' }];
    expect(validateChecks(checks)).toEqual({ valid: false, errors: ['Required'] });
  });

  it('required fails for null', () => {
    const checks: A2uiCheck[] = [{ call: 'required', args: { value: null }, message: 'Required' }];
    expect(validateChecks(checks)).toEqual({ valid: false, errors: ['Required'] });
  });

  it('regex passes for matching pattern', () => {
    const checks: A2uiCheck[] = [{ call: 'regex', args: { value: 'abc123', pattern: '^[a-z]+\\d+$' }, message: 'Bad format' }];
    expect(validateChecks(checks)).toEqual({ valid: true, errors: [] });
  });

  it('regex fails for non-matching', () => {
    const checks: A2uiCheck[] = [{ call: 'regex', args: { value: '!!!', pattern: '^\\w+$' }, message: 'Bad' }];
    expect(validateChecks(checks).valid).toBe(false);
  });

  it('length passes within range', () => {
    const checks: A2uiCheck[] = [{ call: 'length', args: { value: 'hello', min: 3, max: 10 }, message: 'Length' }];
    expect(validateChecks(checks).valid).toBe(true);
  });

  it('length fails below min', () => {
    const checks: A2uiCheck[] = [{ call: 'length', args: { value: 'hi', min: 3 }, message: 'Too short' }];
    expect(validateChecks(checks).valid).toBe(false);
  });

  it('numeric passes in range', () => {
    const checks: A2uiCheck[] = [{ call: 'numeric', args: { value: 5, min: 0, max: 10 }, message: 'Range' }];
    expect(validateChecks(checks).valid).toBe(true);
  });

  it('email passes for valid email', () => {
    const checks: A2uiCheck[] = [{ call: 'email', args: { value: 'a@b.com' }, message: 'Email' }];
    expect(validateChecks(checks).valid).toBe(true);
  });

  it('email fails for invalid', () => {
    const checks: A2uiCheck[] = [{ call: 'email', args: { value: 'not-email' }, message: 'Email' }];
    expect(validateChecks(checks).valid).toBe(false);
  });

  it('collects multiple errors', () => {
    const checks: A2uiCheck[] = [
      { call: 'required', args: { value: '' }, message: 'Required' },
      { call: 'email', args: { value: '' }, message: 'Email' },
    ];
    const result = validateChecks(checks);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('ignores unknown check functions', () => {
    const checks: A2uiCheck[] = [{ call: 'unknownCheck', args: {}, message: 'Unknown' }];
    expect(validateChecks(checks).valid).toBe(true);
  });
});
