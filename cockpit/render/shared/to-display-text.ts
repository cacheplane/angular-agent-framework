// SPDX-License-Identifier: MIT

/**
 * Coerce a resolved element prop (which may be a string, number, boolean, or —
 * for an unresolved/object binding — something else) into display text.
 *
 * Demo view components bind props like `content`/`value` that can resolve to
 * non-string primitives via `$state`/`$fn` bindings (e.g. a numeric
 * `/user/age`). Returning `''` only for strings silently dropped those values;
 * this renders any primitive and treats objects/null as "no text".
 */
export function toDisplayText(value: unknown): string {
  if (value == null) return '';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
    return String(value);
  }
  return '';
}
