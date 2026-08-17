// SPDX-License-Identifier: MIT
import { getByPointer } from './pointer.js';
import { isFunctionCall, isPathRef } from './guards.js';

export interface A2uiScope {
  basePath: string;
  item: unknown;
}

function resolvePathRef(
  ref: { path: string },
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  const path = ref.path;
  if (path.startsWith('/')) return getByPointer(model, path);
  if (scope) return getByPointer(model, `${scope.basePath}/${path}`);
  return getByPointer(model, '/' + path);
}

/**
 * Resolves an A2UI v0.9 dynamic value against a client data model.
 *
 * Bare literals (strings, numbers, booleans) pass through unchanged, `{ path }`
 * references read from the model by JSON-pointer path, arrays resolve
 * element-wise, and client-side function calls (`{ call }`) resolve to
 * `undefined` until function execution ships. Unrecognized plain objects pass
 * through unchanged.
 *
 * @example
 * ```ts
 * const model = { customer: { name: 'Ada' } };
 * resolveDynamic({ path: '/customer/name' }, model); // 'Ada'
 * resolveDynamic('Checkout', model); // 'Checkout'
 * ```
 */
export function resolveDynamic(
  value: unknown,
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(item => resolveDynamic(item, model, scope));

  // Client-side function call — execution ships in a later phase. Checked
  // before path refs so `{ call, args: { path: ... } }`-style args never
  // masquerade as bindings.
  if (isFunctionCall(value)) return undefined;

  // Path reference
  if (isPathRef(value)) return resolvePathRef(value, model, scope);

  // Bare literal passthrough (string, number, boolean, plain object)
  return value;
}
