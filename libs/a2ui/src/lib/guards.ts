// SPDX-License-Identifier: MIT

export function isPathRef(value: unknown): value is { path: string } {
  return typeof value === 'object' && value !== null
    && 'path' in value && typeof (value as { path: unknown }).path === 'string';
}

export function isLiteralString(value: unknown): value is { literalString: string } {
  return typeof value === 'object' && value !== null && 'literalString' in value;
}

export function isLiteralNumber(value: unknown): value is { literalNumber: number } {
  return typeof value === 'object' && value !== null && 'literalNumber' in value;
}

export function isLiteralBoolean(value: unknown): value is { literalBoolean: boolean } {
  return typeof value === 'object' && value !== null && 'literalBoolean' in value;
}
