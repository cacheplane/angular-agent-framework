// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiCheckRule } from './types';
import { resolveDynamic } from './resolve';

export interface A2uiValidationResult {
  valid: boolean;
  errors: string[];
}

export function evaluateCheckRules(
  checks: A2uiCheckRule[],
  model: Record<string, unknown>,
): A2uiValidationResult {
  const errors: string[] = [];
  for (const check of checks) {
    const result = resolveDynamic(check.condition, model);
    if (!result) errors.push(check.message);
  }
  return { valid: errors.length === 0, errors };
}
