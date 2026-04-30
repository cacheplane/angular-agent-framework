// SPDX-License-Identifier: MIT
import type { A2uiPathRef, A2uiFunctionCall } from './types';

/** Narrows an unknown value to A2uiPathRef — has `path` but not `call`. */
export function isPathRef(value: unknown): value is A2uiPathRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'path' in value &&
    !('call' in value)
  );
}

/** Narrows an unknown value to A2uiFunctionCall — has `call` and `args`. */
export function isFunctionCall(value: unknown): value is A2uiFunctionCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    'call' in value
  );
}
