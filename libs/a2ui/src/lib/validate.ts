// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiCheck } from './types';

export interface A2uiValidationResult {
  valid: boolean;
  errors: string[];
}

type Validator = (args: Record<string, unknown>) => boolean;

const VALIDATORS: Record<string, Validator> = {
  required: (args) => args['value'] != null && String(args['value']).trim() !== '',
  regex: (args) => new RegExp(String(args['pattern'])).test(String(args['value'] ?? '')),
  length: (args) => {
    const len = String(args['value'] ?? '').length;
    const min = Number(args['min'] ?? 0);
    const max = Number(args['max'] ?? Infinity);
    return len >= min && len <= max;
  },
  numeric: (args) => {
    const n = Number(args['value']);
    return !isNaN(n) && n >= Number(args['min'] ?? -Infinity) && n <= Number(args['max'] ?? Infinity);
  },
  email: (args) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args['value'] ?? '')),
};

export function validateChecks(checks: A2uiCheck[]): A2uiValidationResult {
  const errors: string[] = [];
  for (const check of checks) {
    const validator = VALIDATORS[check.call];
    if (!validator) continue;
    if (!validator(check.args)) {
      errors.push(check.message);
    }
  }
  return { valid: errors.length === 0, errors };
}
