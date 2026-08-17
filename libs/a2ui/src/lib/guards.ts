// SPDX-License-Identifier: MIT

/** Returns true when `value` is an A2UI dynamic path reference. */
export function isPathRef(value: unknown): value is { path: string } {
  return typeof value === 'object' && value !== null
    && 'path' in value && typeof (value as { path: unknown }).path === 'string';
}

/** Returns true when `value` is an A2UI client-side function call. */
export function isFunctionCall(
  value: unknown,
): value is { call: string; args?: Record<string, unknown> } {
  return typeof value === 'object' && value !== null
    && 'call' in value && typeof (value as { call: unknown }).call === 'string';
}
