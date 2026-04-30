// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { evaluateCheckRules } from './validate';
import type { A2uiCheckRule } from './types';

describe('evaluateCheckRules', () => {
  const model = { name: 'Alice', email: 'alice@example.com', zip: '', agreed: true };

  it('passes when condition evaluates to true', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/name' } } }, message: 'Name required' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('fails when condition evaluates to false', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/zip' } } }, message: 'Zip required' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: false, errors: ['Zip required'] });
  });

  it('resolves path references in condition args', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'email', args: { value: { path: '/email' } } }, message: 'Invalid email' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('supports boolean literal conditions', () => {
    const checks: A2uiCheckRule[] = [
      { condition: true, message: 'Always passes' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('supports path ref conditions (boolean in data model)', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { path: '/agreed' }, message: 'Must agree' },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('handles falsy path ref conditions', () => {
    const modelWithFalse = { ...model, agreed: false };
    const checks: A2uiCheckRule[] = [
      { condition: { path: '/agreed' }, message: 'Must agree' },
    ];
    expect(evaluateCheckRules(checks, modelWithFalse)).toEqual({ valid: false, errors: ['Must agree'] });
  });

  it('supports nested and/or composition', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: {
          call: 'and',
          args: {
            values: [
              { call: 'required', args: { value: { path: '/name' } } },
              { call: 'email', args: { value: { path: '/email' } } },
            ],
          },
        },
        message: 'Name and valid email required',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });

  it('nested and fails when inner condition fails', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: {
          call: 'and',
          args: {
            values: [
              { call: 'required', args: { value: { path: '/name' } } },
              { call: 'required', args: { value: { path: '/zip' } } },
            ],
          },
        },
        message: 'All fields required',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: false, errors: ['All fields required'] });
  });

  it('collects multiple errors from multiple checks', () => {
    const checks: A2uiCheckRule[] = [
      { condition: { call: 'required', args: { value: { path: '/zip' } } }, message: 'Zip required' },
      { condition: false, message: 'Always fails' },
    ];
    const result = evaluateCheckRules(checks, model);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Zip required', 'Always fails']);
  });

  it('returns valid for empty checks array', () => {
    expect(evaluateCheckRules([], model)).toEqual({ valid: true, errors: [] });
  });

  it('supports regex with path-resolved value', () => {
    const checks: A2uiCheckRule[] = [
      {
        condition: { call: 'regex', args: { value: { path: '/name' }, pattern: '^[A-Z]' } },
        message: 'Must start with uppercase',
      },
    ];
    expect(evaluateCheckRules(checks, model)).toEqual({ valid: true, errors: [] });
  });
});
