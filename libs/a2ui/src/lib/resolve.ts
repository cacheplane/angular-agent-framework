// SPDX-License-Identifier: MIT
import { getByPointer } from './pointer.js';

export interface A2uiScope {
  basePath: string;
  item: unknown;
}

interface PathRef { path: string }
interface LiteralString { literalString: string }
interface LiteralNumber { literalNumber: number }
interface LiteralBoolean { literalBoolean: boolean }
interface LiteralArray { literalArray: unknown[] }

function isPathRef(v: unknown): v is PathRef {
  return typeof v === 'object' && v !== null && 'path' in v && typeof (v as PathRef).path === 'string';
}
function isLiteralString(v: unknown): v is LiteralString {
  return typeof v === 'object' && v !== null && 'literalString' in v;
}
function isLiteralNumber(v: unknown): v is LiteralNumber {
  return typeof v === 'object' && v !== null && 'literalNumber' in v;
}
function isLiteralBoolean(v: unknown): v is LiteralBoolean {
  return typeof v === 'object' && v !== null && 'literalBoolean' in v;
}
function isLiteralArray(v: unknown): v is LiteralArray {
  return typeof v === 'object' && v !== null && 'literalArray' in v;
}

function resolvePathRef(ref: PathRef, model: Record<string, unknown>, scope?: A2uiScope): unknown {
  const path = ref.path;
  if (path.startsWith('/')) return getByPointer(model, path);
  if (scope) return getByPointer(model, `${scope.basePath}/${path}`);
  return getByPointer(model, '/' + path);
}

export function resolveDynamic(
  value: unknown,
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(item => resolveDynamic(item, model, scope));

  // Literal wrappers — unwrap. Order matters less than mutual exclusivity.
  if (isLiteralString(value)) return value.literalString;
  if (isLiteralNumber(value)) return value.literalNumber;
  if (isLiteralBoolean(value)) return value.literalBoolean;
  if (isLiteralArray(value)) return value.literalArray;

  // Path reference
  if (isPathRef(value)) return resolvePathRef(value, model, scope);

  // Plain literal passthrough (string, number, boolean, plain object without wrappers)
  return value;
}
