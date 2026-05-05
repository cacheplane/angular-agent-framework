// SPDX-License-Identifier: MIT
import type { A2uiCheckRule } from './types.js';
import { resolveDynamic } from './resolve.js';

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
