// SPDX-License-Identifier: MIT

/** Returns true when `value` is an A2UI dynamic path reference. */
export function isPathRef(value: unknown): value is { path: string } {
  return typeof value === 'object' && value !== null
    && 'path' in value && typeof (value as { path: unknown }).path === 'string';
}

/** Returns true when `value` is an A2UI string literal wrapper. */
export function isLiteralString(value: unknown): value is { literalString: string } {
  return typeof value === 'object' && value !== null && 'literalString' in value;
}

/** Returns true when `value` is an A2UI number literal wrapper. */
export function isLiteralNumber(value: unknown): value is { literalNumber: number } {
  return typeof value === 'object' && value !== null && 'literalNumber' in value;
}

/** Returns true when `value` is an A2UI boolean literal wrapper. */
export function isLiteralBoolean(value: unknown): value is { literalBoolean: boolean } {
  return typeof value === 'object' && value !== null && 'literalBoolean' in value;
}
